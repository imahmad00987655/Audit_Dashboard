/**
 * Per-user data scope: which companies + which data domains (PR/PO/Spend/…).
 * Empty ACL rows = unrestricted (legacy users). Explicit rows = enforced.
 */

const { query } = require("../config/db");

const DATA_DOMAINS = [
  { key: "pr", label: "Purchase Requisitions (PR)" },
  { key: "po", label: "Purchase Orders (PO)" },
  { key: "spend", label: "Spend" },
  { key: "approvals", label: "Approvals" },
  { key: "grn", label: "GRN / Receipts" },
  { key: "split_po", label: "Split PO Watch" },
];

const DOMAIN_KEYS = new Set(DATA_DOMAINS.map((d) => d.key));

/** component_key → required data domain (null = no domain gate) */
const COMPONENT_DOMAIN = {
  "feature-filters": null,
  "feature-chatbot": null,
  "feature-day-end-report": null,
  "section-executive-overview": null,
  "section-grn-overview": "grn",
  "kpi-total-pr": "pr",
  "kpi-total-po": "po",
  "kpi-approved-po": "po",
  "kpi-pending-po": "po",
  "kpi-total-spend": "spend",
  "chart-insights": null,
  "chart-funnel": "po",
  "chart-approval-status": "approvals",
  "chart-top-pr-creators": "pr",
  "chart-top-po-creators": "po",
  "chart-top-approvers": "approvals",
  "chart-dept-spend": "spend",
  "chart-legal-entity": null,
  "chart-monthly-trend": null,
  "chart-spend-analysis": "spend",
  "chart-purchase-type-mix": "po",
  "chart-purchase-type-volume": "po",
  "chart-po-revision-count": "po",
  "chart-po-revision-linkage": "po",
  "chart-most-revised-pos": "po",
  "chart-vendor-analysis": "po",
  "chart-procurement-aging": "po",
  "chart-split-po-watch": "split_po",
  "chart-grn-funnel": "grn",
  "chart-po-to-grn-aging": "grn",
  "chart-grn-receiving-org": "grn",
  "chart-grn-monthly": "grn",
  "chart-grn-vendors": "grn",
  "chart-grn-quality": "grn",
  "chart-dept-performance": null,
  "table-audit": "po",
  "table-grn": "grn",
  "table-split-po": "split_po",
};

async function ensureDataAccessSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS user_data_access (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      access_type ENUM('organization', 'domain') NOT NULL,
      access_value VARCHAR(255) NOT NULL,
      granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_uda (user_id, access_type, access_value),
      KEY idx_uda_user (user_id),
      CONSTRAINT fk_uda_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function normalizeList(values) {
  return [...new Set((values || []).map((v) => String(v || "").trim()).filter(Boolean))];
}

async function getUserDataAccess(userId, role) {
  if (String(role || "").toLowerCase() === "admin") {
    return {
      organizations: ["*"],
      domains: DATA_DOMAINS.map((d) => d.key),
      unrestricted: true,
    };
  }

  const rows = await query(
    `SELECT access_type AS accessType, access_value AS accessValue
     FROM user_data_access WHERE user_id = ? ORDER BY access_type, access_value`,
    [userId]
  );

  const organizations = rows.filter((r) => r.accessType === "organization").map((r) => r.accessValue);
  const domains = rows
    .filter((r) => r.accessType === "domain")
    .map((r) => r.accessValue)
    .filter((d) => DOMAIN_KEYS.has(d));

  // No ACL rows yet → legacy unrestricted
  const unrestricted = organizations.length === 0 && domains.length === 0;

  return {
    organizations,
    domains: unrestricted ? DATA_DOMAINS.map((d) => d.key) : domains,
    unrestricted,
  };
}

async function setUserDataAccess(userId, { organizations = [], domains = [] } = {}) {
  const orgs = normalizeList(organizations);
  const doms = normalizeList(domains).filter((d) => DOMAIN_KEYS.has(d));

  await query(`DELETE FROM user_data_access WHERE user_id = ?`, [userId]);

  const rows = [
    ...orgs.map((v) => ["organization", v]),
    ...doms.map((v) => ["domain", v]),
  ];
  if (!rows.length) return { organizations: [], domains: [], unrestricted: true };

  const placeholders = rows.map(() => "(?, ?, ?)").join(", ");
  const params = rows.flatMap(([t, v]) => [userId, t, v]);
  await query(
    `INSERT INTO user_data_access (user_id, access_type, access_value) VALUES ${placeholders}`,
    params
  );

  return {
    organizations: orgs,
    domains: doms,
    unrestricted: false,
  };
}

function orgNameMatches(allowedName, candidate) {
  const a = String(allowedName || "").trim().toLowerCase();
  const b = String(candidate || "").trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function splitOrgTokens(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Clamp query.organization to the user's allowed companies.
 * Returns a shallow-copied query object.
 */
function clampQueryToDataAccess(query = {}, dataAccess) {
  if (!dataAccess || dataAccess.unrestricted) return { ...query };
  const allowed = dataAccess.organizations || [];
  if (!allowed.length) {
    // Explicit empty company list → no rows
    return { ...query, organization: "__NO_ACCESS__" };
  }

  const requested = splitOrgTokens(query.organization);
  let nextOrgs;
  if (!requested.length) {
    nextOrgs = allowed;
  } else {
    nextOrgs = requested.filter((r) => allowed.some((a) => orgNameMatches(a, r)));
    if (!nextOrgs.length) nextOrgs = allowed;
  }

  return { ...query, organization: nextOrgs.join(",") };
}

function filterOrganizationOptions(organizations, dataAccess) {
  if (!dataAccess || dataAccess.unrestricted) return organizations || [];
  const allowed = dataAccess.organizations || [];
  if (!allowed.length) return [];
  return (organizations || []).filter((o) => allowed.some((a) => orgNameMatches(a, o)));
}

function hasDomain(dataAccess, domain) {
  if (!dataAccess || dataAccess.unrestricted) return true;
  return (dataAccess.domains || []).includes(domain);
}

function canAccessComponent(componentKey, dataAccess) {
  if (!dataAccess || dataAccess.unrestricted) return true;
  const domain = COMPONENT_DOMAIN[componentKey];
  if (domain == null) return true;
  return hasDomain(dataAccess, domain);
}

function filterKpisByDomains(kpis, dataAccess) {
  if (!kpis || !dataAccess || dataAccess.unrestricted) return kpis;
  const out = { ...kpis };
  if (!hasDomain(dataAccess, "pr")) {
    delete out.totalPurchaseRequisitions;
  }
  if (!hasDomain(dataAccess, "po")) {
    delete out.totalPurchaseOrders;
    delete out.approvedPurchaseOrders;
    delete out.pendingPurchaseOrders;
    delete out.approvalRate;
  }
  if (!hasDomain(dataAccess, "spend")) {
    delete out.totalSpend;
    delete out.currencySpend;
    delete out.nonPoSpend;
  }
  if (!hasDomain(dataAccess, "grn") && out.grn) {
    delete out.grn;
  }
  return out;
}

function assertDomainOrThrow(dataAccess, domain, label = domain) {
  if (!hasDomain(dataAccess, domain)) {
    const err = new Error(`Access denied for ${label}`);
    err.status = 403;
    throw err;
  }
}

module.exports = {
  DATA_DOMAINS,
  DOMAIN_KEYS,
  COMPONENT_DOMAIN,
  ensureDataAccessSchema,
  getUserDataAccess,
  setUserDataAccess,
  clampQueryToDataAccess,
  filterOrganizationOptions,
  hasDomain,
  canAccessComponent,
  filterKpisByDomains,
  assertDomainOrThrow,
  orgNameMatches,
};
