const {
  getRawData,
  applyFilters,
  getKpis,
  getFunnel,
  groupUniqueCount,
  groupUniqueCountByFinalApprover,
  getMonthly,
  getDepartmentSpend,
  getDepartmentPerformance,
  getLegalEntities,
  getVendors,
  getPurchaseTypes,
  getPoRevisions,
  getApprovalStatus,
  computeAging,
  getInsights,
  paginateTable,
} = require("./dataService");

const { getSplitPoAnalysis, paginateSplitPoTable } = require("./splitPoService");

const {
  getPo2GrnData,
  applyGrnFilters,
  getGrnKpis,
  getGrnFunnel,
  computePoToGrnAging,
  getGrnByReceivingOrg,
  getGrnMonthly,
  getGrnVendors,
  getGrnReturnRejectAnalysis,
  paginateGrnTable,
} = require("./grnService");

const { query, queryOne } = require("../config/db");
const { generateDayEndPdf } = require("./pdfService");
const { sendDayEndReportEmail, isEmailConfigured, getRecipients } = require("./emailService");
const {
  clampQueryToDataAccess,
  canAccessComponent,
  filterKpisByDomains,
  hasDomain,
} = require("./dataAccessService");

const REPORT_COMPONENTS = [
  { key: "section-executive-overview", type: "section", title: "Executive Overview", section: "KPI Sections" },
  { key: "section-grn-overview", type: "section", title: "GRN Overview (PO → Receipt)", section: "KPI Sections" },
  { key: "kpi-total-pr", type: "kpi", title: "Total Purchase Requisitions", section: "Executive KPIs" },
  { key: "kpi-total-po", type: "kpi", title: "Total Purchase Orders", section: "Executive KPIs" },
  { key: "kpi-approved-po", type: "kpi", title: "Approved Purchase Orders", section: "Executive KPIs" },
  { key: "kpi-pending-po", type: "kpi", title: "Pending Purchase Orders", section: "Executive KPIs" },
  { key: "kpi-total-spend", type: "kpi", title: "Total Spend", section: "Executive KPIs" },
  { key: "chart-insights", type: "chart", title: "Insights", section: "Analytics" },
  { key: "chart-funnel", type: "chart", title: "Procurement Funnel", section: "Analytics" },
  { key: "chart-approval-status", type: "chart", title: "Approval Status", section: "Analytics" },
  { key: "chart-top-pr-creators", type: "chart", title: "Top PR Creators", section: "Analytics" },
  { key: "chart-top-po-creators", type: "chart", title: "Top PO Creators", section: "Analytics" },
  { key: "chart-top-approvers", type: "chart", title: "Top Final Approvers", section: "Analytics" },
  { key: "chart-dept-spend", type: "chart", title: "Department Wise Spending", section: "Analytics" },
  { key: "chart-legal-entity", type: "chart", title: "Entity Wise Analysis", section: "Analytics" },
  { key: "chart-monthly-trend", type: "chart", title: "Monthly Procurement Trend", section: "Analytics" },
  { key: "chart-spend-analysis", type: "chart", title: "Purchase Analysis", section: "Analytics" },
  { key: "chart-purchase-type-mix", type: "chart", title: "Purchase Type Mix", section: "Purchase Types" },
  { key: "chart-purchase-type-volume", type: "chart", title: "Purchase Type Volume", section: "Purchase Types" },
  { key: "chart-po-revision-count", type: "chart", title: "PO Revision Count", section: "PO Revisions" },
  { key: "chart-po-revision-linkage", type: "chart", title: "Revised POs · PR Linkage", section: "PO Revisions" },
  { key: "chart-most-revised-pos", type: "chart", title: "Most Revised POs", section: "PO Revisions" },
  { key: "chart-vendor-analysis", type: "chart", title: "Vendor Analysis", section: "Analytics" },
  { key: "chart-procurement-aging", type: "chart", title: "Procurement Aging", section: "Analytics" },
  { key: "chart-split-po-watch", type: "chart", title: "Split PO Watch", section: "Split PO" },
  { key: "chart-grn-funnel", type: "chart", title: "PO → GRN Funnel", section: "GRN Analysis" },
  { key: "chart-po-to-grn-aging", type: "chart", title: "PO → GRN Aging", section: "GRN Analysis" },
  { key: "chart-grn-receiving-org", type: "chart", title: "GRN by Receiving Org", section: "GRN Analysis" },
  { key: "chart-grn-monthly", type: "chart", title: "GRN Monthly Trend", section: "GRN Analysis" },
  { key: "chart-grn-vendors", type: "chart", title: "GRN Vendor Receipts", section: "GRN Analysis" },
  { key: "chart-grn-quality", type: "chart", title: "GRN Receipt Quality", section: "GRN Analysis" },
  { key: "chart-dept-performance", type: "chart", title: "Department Performance", section: "Department Performance" },
  { key: "table-audit", type: "table", title: "Interactive Audit Table", section: "Tables" },
  { key: "table-grn", type: "table", title: "PO → GRN Data Table", section: "Tables" },
  { key: "table-split-po", type: "table", title: "Split PO Suspicious Clusters", section: "Tables" },
];

function getReportComponents() {
  return REPORT_COMPONENTS;
}

function isAdminUser(user) {
  return String(user?.role || "").toLowerCase() === "admin";
}

/**
 * Intersect selected keys with dashboard permissions + data-domain access.
 */
function authorizeReportKeys(selectedKeys = [], user = null) {
  const isAdmin = isAdminUser(user);
  const permissions = new Set(user?.permissions || []);
  const dataAccess = user?.dataAccess;

  return (selectedKeys || []).filter((key) => {
    if (!REPORT_COMPONENTS.some((c) => c.key === key)) return false;
    if (!isAdmin && !permissions.has(key)) return false;
    return canAccessComponent(key, dataAccess);
  });
}

function getAllowedReportComponents(user) {
  const allowedKeys = new Set(authorizeReportKeys(REPORT_COMPONENTS.map((c) => c.key), user));
  return REPORT_COMPONENTS.filter((c) => allowedKeys.has(c.key));
}

function resolveSelectedComponents(keys = []) {
  const set = new Set(keys);
  return REPORT_COMPONENTS.filter((c) => set.has(c.key));
}

function assertCanUseDayEndReport(user) {
  if (isAdminUser(user)) return;
  const perms = user?.permissions || [];
  if (!perms.includes("feature-day-end-report")) {
    const err = new Error("Day-end report is not part of your assigned access.");
    err.status = 403;
    throw err;
  }
}

async function withFiltered(filters, dataAccess) {
  const scoped = clampQueryToDataAccess(filters || {}, dataAccess);
  const raw = await getRawData();
  return { rows: applyFilters(raw, scoped), filters: scoped };
}

async function fetchComponentData(filters, keys, user = null) {
  const dataAccess = user?.dataAccess;
  const authorizedKeys = user ? authorizeReportKeys(keys, user) : keys || [];
  const wanted = new Set(authorizedKeys);
  const { rows: filtered, filters: scopedFilters } = await withFiltered(filters, dataAccess);

  let grnFiltered = [];
  const needsGrn =
    hasDomain(dataAccess, "grn") &&
    [...wanted].some(
      (k) => k.includes("grn") || k === "section-grn-overview" || k === "section-executive-overview"
    );
  if (needsGrn) {
    const grnRaw = await getPo2GrnData();
    grnFiltered = applyGrnFilters(grnRaw, scopedFilters, filtered);
  }

  let kpis =
    wanted.has("section-executive-overview") || [...wanted].some((k) => k.startsWith("kpi-"))
      ? {
          ...getKpis(filtered),
          ...(hasDomain(dataAccess, "grn") ? { grn: getGrnKpis(grnFiltered, filtered) } : {}),
          legalEntities: getLegalEntities(filtered),
        }
      : null;

  if (kpis) {
    kpis = filterKpisByDomains(kpis, dataAccess);
  }

  const loaders = {
    "section-executive-overview": () => kpis,
    "section-grn-overview": () =>
      hasDomain(dataAccess, "grn")
        ? (kpis && kpis.grn) || getGrnKpis(grnFiltered, filtered)
        : null,
    "kpi-total-pr": () => ({ value: (kpis || getKpis(filtered)).totalPurchaseRequisitions }),
    "kpi-total-po": () => ({ value: (kpis || getKpis(filtered)).totalPurchaseOrders }),
    "kpi-approved-po": () => ({ value: (kpis || getKpis(filtered)).approvedPurchaseOrders }),
    "kpi-pending-po": () => ({ value: (kpis || getKpis(filtered)).pendingPurchaseOrders }),
    "kpi-total-spend": () => {
      const k = kpis || getKpis(filtered);
      return { value: k.totalSpend, currencySpend: k.currencySpend };
    },
    "chart-insights": () => getInsights(filtered),
    "chart-funnel": () => getFunnel(filtered),
    "chart-approval-status": () => getApprovalStatus(filtered),
    "chart-top-pr-creators": () => groupUniqueCount(filtered, "REQ_CREADED_BY", "REQ_NO").slice(0, 15),
    "chart-top-po-creators": () => groupUniqueCount(filtered, "PO_CREATED_BY", "PO_NO").slice(0, 15),
    "chart-top-approvers": () => groupUniqueCountByFinalApprover(filtered),
    "chart-dept-spend": () => getDepartmentSpend(filtered),
    "chart-legal-entity": () => getLegalEntities(filtered),
    "chart-monthly-trend": () => getMonthly(filtered),
    "chart-spend-analysis": () => getMonthly(filtered),
    "chart-purchase-type-mix": () => getPurchaseTypes(filtered),
    "chart-purchase-type-volume": () => getPurchaseTypes(filtered),
    "chart-po-revision-count": () => getPoRevisions(filtered).buckets,
    "chart-po-revision-linkage": () => getPoRevisions(filtered).summary,
    "chart-most-revised-pos": () => getPoRevisions(filtered).topRevised,
    "chart-vendor-analysis": () => getVendors(filtered),
    "chart-procurement-aging": () => computeAging(filtered),
    "chart-split-po-watch": () => getSplitPoAnalysis(filtered).summary,
    "chart-grn-funnel": () => getGrnFunnel(grnFiltered),
    "chart-po-to-grn-aging": () => computePoToGrnAging(grnFiltered),
    "chart-grn-receiving-org": () => getGrnByReceivingOrg(grnFiltered),
    "chart-grn-monthly": () => getGrnMonthly(grnFiltered),
    "chart-grn-vendors": () => getGrnVendors(grnFiltered),
    "chart-grn-quality": () => getGrnReturnRejectAnalysis(grnFiltered),
    "chart-dept-performance": () => getDepartmentPerformance(filtered),
    "table-audit": () => paginateTable(filtered, { page: 1, pageSize: 25 }),
    "table-grn": () => paginateGrnTable(grnFiltered, { page: 1, pageSize: 25 }),
    "table-split-po": () => paginateSplitPoTable(filtered, { page: 1, pageSize: 25 }),
  };

  const result = {};
  for (const key of authorizedKeys) {
    const loader = loaders[key];
    if (!loader) continue;
    try {
      result[key] = loader();
    } catch (err) {
      console.error(`[report data ${key}]`, err.message);
      result[key] = { error: err.message };
    }
  }
  return { componentData: result, filters: scopedFilters, selectedKeys: authorizedKeys };
}

async function getReportStatus(userId, reportDate) {
  const existing = await queryOne(
    `SELECT id, report_date AS reportDate, submitted_at AS submittedAt, remarks,
            email_status AS emailStatus, pdf_filename AS pdfFilename
     FROM day_end_reports
     WHERE user_id = ? AND report_date = ?
     LIMIT 1`,
    [userId, reportDate]
  );
  return { locked: Boolean(existing), report: existing };
}

async function submitDayEndReport({ user, sessionId, reportDate, remarks, filters, selectedKeys, signatureImage, ip }) {
  assertCanUseDayEndReport(user);

  const status = await getReportStatus(user.id, reportDate);
  if (status.locked) {
    throw new Error(`Remarks for ${reportDate} have already been submitted and are locked.`);
  }

  const authorizedKeys = authorizeReportKeys(selectedKeys, user);
  const selectedComponents = resolveSelectedComponents(authorizedKeys);
  if (!selectedComponents.length) {
    throw new Error("Select at least one chart or table you are allowed to see for the day-end report.");
  }
  if (!remarks || !String(remarks).trim()) {
    throw new Error("Remarks are required for day-end report submission.");
  }
  if (!signatureImage || typeof signatureImage !== "string" || !signatureImage.startsWith("data:image/")) {
    throw new Error("Officer signature is required before submit.");
  }

  const {
    componentData,
    filters: scopedFilters,
    selectedKeys: finalKeys,
  } = await fetchComponentData(filters, authorizedKeys, user);

  const finalComponents = resolveSelectedComponents(finalKeys);

  const { pdfPath, filename } = await generateDayEndPdf({
    user,
    reportDate,
    remarks: String(remarks).trim(),
    filters: scopedFilters,
    selectedComponents: finalComponents,
    componentData,
    signatureImage,
  });

  const recipients = await getRecipients();
  const emailConfigured = isEmailConfigured();

  const insertResult = await query(
    `INSERT INTO day_end_reports
      (user_id, session_id, report_date, remarks, filters_json, selected_components_json,
       report_data_json, pdf_filename, pdf_path, email_status, email_recipients)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      sessionId || null,
      reportDate,
      String(remarks).trim(),
      JSON.stringify(scopedFilters),
      JSON.stringify(finalComponents),
      JSON.stringify(componentData),
      filename,
      pdfPath,
      emailConfigured && recipients.length ? "pending" : "skipped",
      recipients.join(", ") || null,
    ]
  );

  const reportId = insertResult.insertId;

  for (const comp of finalComponents) {
    await query(
      `INSERT INTO day_end_report_components (day_end_report_id, component_key, component_title)
       VALUES (?, ?, ?)`,
      [reportId, comp.key, comp.title]
    );
  }

  let emailStatus = emailConfigured && recipients.length ? "pending" : "skipped";
  let emailError = null;
  let emailSentAt = null;

  if (emailConfigured && recipients.length) {
    const emailResult = await sendDayEndReportEmail({
      reportId,
      subject: `Day-End Report · ${reportDate} · ${user.fullName}`,
      text: `Day-end procurement audit report for ${reportDate}.\n\nRemarks:\n${remarks}`,
      html: `<p>Day-end procurement audit report for <strong>${reportDate}</strong>.</p><p><strong>Submitted by:</strong> ${user.fullName} (${user.username})</p><p><strong>Remarks:</strong></p><p>${String(remarks).replace(/\n/g, "<br>")}</p>`,
      pdfPath,
      pdfFilename: filename,
    });

    if (emailResult.sent) {
      emailStatus = "sent";
      emailSentAt = new Date();
    } else if (emailResult.skipped) {
      emailStatus = "skipped";
      emailError = emailResult.error;
    } else {
      emailStatus = "failed";
      emailError = emailResult.error;
    }

    await query(
      `UPDATE day_end_reports SET email_status = ?, email_sent_at = ?, email_error = ? WHERE id = ?`,
      [emailStatus, emailSentAt, emailError, reportId]
    );
  }

  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json, ip_address)
     VALUES (?, 'day_end_report_submit', 'day_end_report', ?, JSON_OBJECT('reportDate', ?, 'components', ?), ?)`,
    [user.id, String(reportId), reportDate, finalKeys.length, ip || null]
  );

  return {
    id: reportId,
    reportDate,
    pdfFilename: filename,
    emailStatus,
    emailError,
    locked: true,
  };
}

async function getReportHistory(userId, limit = 30) {
  return query(
    `SELECT
       id,
       report_date AS reportDate,
       remarks,
       submitted_at AS submittedAt,
       email_status AS emailStatus,
       pdf_filename AS pdfFilename,
       selected_components_json AS selectedComponentsJson
     FROM day_end_reports
     WHERE user_id = ?
     ORDER BY report_date DESC
     LIMIT ?`,
    [userId, limit]
  );
}

async function getReportById(userId, reportId) {
  return queryOne(
    `SELECT id, report_date AS reportDate, pdf_path AS pdfPath, pdf_filename AS pdfFilename
     FROM day_end_reports WHERE id = ? AND user_id = ? LIMIT 1`,
    [reportId, userId]
  );
}

module.exports = {
  getReportComponents,
  getAllowedReportComponents,
  authorizeReportKeys,
  resolveSelectedComponents,
  fetchComponentData,
  getReportStatus,
  submitDayEndReport,
  getReportHistory,
  getReportById,
  assertCanUseDayEndReport,
};
