const express = require("express");
const { requireAuth, requireAdmin, clearAuthCache } = require("../middleware/auth");
const {
  listUsers,
  getUserDetail,
  createManagedUser,
  updateManagedUser,
  deleteManagedUser,
} = require("../services/adminService");
const { listComponentsGrouped } = require("../services/permissionService");
const { DATA_DOMAINS } = require("../services/dataAccessService");
const {
  listReportEmailRecipients,
  addReportEmailRecipient,
  deleteReportEmailRecipient,
} = require("../services/reportEmailRecipientService");
const { getRawData, getFilterOptions } = require("../services/dataService");

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get("/components", async (_req, res, next) => {
  try {
    const data = await listComponentsGrouped();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/data-domains", (_req, res) => {
  res.json({ success: true, data: DATA_DOMAINS });
});

router.get("/organizations", async (_req, res, next) => {
  try {
    const raw = await getRawData();
    const opts = getFilterOptions(raw);
    res.json({ success: true, data: opts.organizations || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/users", async (_req, res, next) => {
  try {
    const data = await listUsers();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/users/:id", async (req, res, next) => {
  try {
    const data = await getUserDetail(Number(req.params.id));
    if (!data) return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/users", async (req, res, next) => {
  try {
    const { username, email, password, fullName, role, permissions, dataAccess } = req.body || {};
    if (!username || !email || !password || !fullName) {
      return res.status(400).json({ success: false, error: "username, email, password, fullName required" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }
    if (role !== "admin") {
      const orgs = dataAccess?.organizations || [];
      const domains = dataAccess?.domains || [];
      if (!orgs.length) {
        return res.status(400).json({
          success: false,
          error: "Select at least one company for data access",
        });
      }
      if (!domains.length) {
        return res.status(400).json({
          success: false,
          error: "Select at least one data type (PR, PO, Spend, …)",
        });
      }
    }
    const data = await createManagedUser({
      username,
      email,
      password,
      fullName,
      role,
      permissions,
      dataAccess,
    });
    clearAuthCache();
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put("/users/:id", async (req, res, next) => {
  try {
    const body = req.body || {};
    if (body.role !== "admin" && body.dataAccess) {
      const orgs = body.dataAccess.organizations || [];
      const domains = body.dataAccess.domains || [];
      if (!orgs.length) {
        return res.status(400).json({
          success: false,
          error: "Select at least one company for data access",
        });
      }
      if (!domains.length) {
        return res.status(400).json({
          success: false,
          error: "Select at least one data type (PR, PO, Spend, …)",
        });
      }
    }
    const data = await updateManagedUser(Number(req.params.id), body);
    clearAuthCache();
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete("/users/:id", async (req, res, next) => {
  try {
    const data = await deleteManagedUser(Number(req.params.id), req.user.id);
    clearAuthCache();
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get("/report-emails", async (_req, res, next) => {
  try {
    const data = await listReportEmailRecipients();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/report-emails", async (req, res, next) => {
  try {
    const { email } = req.body || {};
    const data = await addReportEmailRecipient(email);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete("/report-emails/:id", async (req, res, next) => {
  try {
    const data = await deleteReportEmailRecipient(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
