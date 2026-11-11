const express = require("express");
const fs = require("fs");
const {
  getAllowedReportComponents,
  getReportStatus,
  submitDayEndReport,
  getReportHistory,
  getReportById,
  fetchComponentData,
  resolveSelectedComponents,
  authorizeReportKeys,
  assertCanUseDayEndReport,
} = require("../services/reportService");
const { generateDayEndPdf } = require("../services/pdfService");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/components", requireAuth, (req, res) => {
  try {
    assertCanUseDayEndReport(req.user);
    res.json({ success: true, data: getAllowedReportComponents(req.user) });
  } catch (err) {
    res.status(err.status || 403).json({ success: false, error: err.message });
  }
});

router.get("/status", requireAuth, async (req, res) => {
  try {
    const reportDate = req.query.date || new Date().toISOString().slice(0, 10);
    const status = await getReportStatus(req.user.id, reportDate);
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  try {
    const history = await getReportHistory(req.user.id, Number(req.query.limit) || 30);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/preview-pdf", requireAuth, async (req, res) => {
  try {
    assertCanUseDayEndReport(req.user);
    const { filters = {}, selectedKeys = [], remarks = "", reportDate, signatureImage = null } =
      req.body || {};
    const authorizedKeys = authorizeReportKeys(selectedKeys, req.user);
    const selectedComponents = resolveSelectedComponents(authorizedKeys);
    if (!selectedComponents.length) {
      return res.status(400).json({
        success: false,
        error: "Select at least one component you are allowed to see",
      });
    }

    const { componentData, filters: scopedFilters } = await fetchComponentData(
      filters,
      authorizedKeys,
      req.user
    );
    const { pdfPath, filename } = await generateDayEndPdf({
      user: req.user,
      reportDate: reportDate || new Date().toISOString().slice(0, 10),
      remarks: remarks || "Preview — not submitted",
      filters: scopedFilters,
      selectedComponents,
      componentData,
      signatureImage,
    });

    res.download(pdfPath, filename, (err) => {
      if (err) console.error("[PDF preview download]", err.message);
      fs.unlink(pdfPath, () => {});
    });
  } catch (err) {
    console.error("[PDF preview]", err);
    const status = err.status || 500;
    res.status(status).json({ success: false, error: err.message || "PDF preview failed" });
  }
});

router.post("/day-end", requireAuth, async (req, res) => {
  try {
    const { reportDate, remarks, filters = {}, selectedKeys = [], signatureImage = null } =
      req.body || {};
    if (!reportDate) {
      return res.status(400).json({ success: false, error: "Report date is required" });
    }

    const result = await submitDayEndReport({
      user: req.user,
      sessionId: req.sessionId,
      reportDate,
      remarks,
      filters,
      selectedKeys,
      signatureImage,
      ip: req.ip,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    const status = err.status
      ? err.status
      : err.message.includes("already been submitted")
        ? 409
        : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.get("/day-end/:id/pdf", requireAuth, async (req, res) => {
  try {
    const report = await getReportById(req.user.id, req.params.id);
    if (!report || !report.pdfPath || !fs.existsSync(report.pdfPath)) {
      return res.status(404).json({ success: false, error: "Report PDF not found" });
    }
    res.download(report.pdfPath, report.pdfFilename);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
