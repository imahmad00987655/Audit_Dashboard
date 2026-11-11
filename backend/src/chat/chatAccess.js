/**
 * Maps chatbot tools / KPI fields to dashboard permission keys.
 * Admin panel grants these same keys — chat must respect them strictly.
 */

const KPI_FIELD_PERMISSIONS = {
  totalPurchaseRequisitions: "kpi-total-pr",
  totalPRs: "kpi-total-pr",
  totalPurchaseOrders: "kpi-total-po",
  totalPOs: "kpi-total-po",
  approvedPurchaseOrders: "kpi-approved-po",
  approvedPOs: "kpi-approved-po",
  pendingPurchaseOrders: "kpi-pending-po",
  pendingPOs: "kpi-pending-po",
  approvalRate: "kpi-approved-po",
  approvalRatePct: "kpi-approved-po",
  totalSpendPkr: "kpi-total-spend",
  totalSpend: "kpi-total-spend",
  nonPoSpendPkr: "kpi-total-spend",
  currencySpend: "kpi-total-spend",
};

const GRN_KEYS = [
  "section-grn-overview",
  "chart-grn-funnel",
  "chart-po-to-grn-aging",
  "chart-grn-receiving-org",
  "chart-grn-monthly",
  "chart-grn-vendors",
  "chart-grn-quality",
  "table-grn",
];

const EXEC_KPI_KEYS = [
  "kpi-total-pr",
  "kpi-total-po",
  "kpi-approved-po",
  "kpi-pending-po",
  "kpi-total-spend",
];

/** Tool → at least one of these keys required (empty = allowed if chatbot itself is allowed). */
const TOOL_REQUIRED_ANY = {
  list_companies_and_units: [],
  // KPIs only — not a free pass to insights/GRN/compare
  get_kpis: [...EXEC_KPI_KEYS, "section-executive-overview"],
  get_funnel: ["chart-funnel"],
  get_approval_status: ["chart-approval-status"],
  get_top_creators: ["chart-top-pr-creators", "chart-top-po-creators"],
  get_insights: ["chart-insights"],
  get_legal_entities: ["chart-legal-entity"],
  get_operating_units: ["feature-filters", "chart-legal-entity", "section-executive-overview"],
  get_department_spend: ["chart-dept-spend", "section-executive-overview", ...EXEC_KPI_KEYS],
  get_vendors: ["chart-vendor-analysis", "table-audit", "kpi-total-spend", "section-executive-overview"],
  get_grn_summary: GRN_KEYS,
  // Snapshot only when they have a real overview section or charts — KPI-only users use get_kpis
  get_audit_snapshot: [
    "section-executive-overview",
    "section-grn-overview",
    "chart-insights",
    "chart-funnel",
    "chart-approval-status",
    "chart-dept-spend",
    "chart-legal-entity",
    ...GRN_KEYS,
  ],
  get_group_comparison: ["chart-legal-entity", "section-executive-overview"],
  list_purchase_orders: ["table-audit", "kpi-total-po", "kpi-approved-po", "kpi-pending-po"],
  list_purchase_requisitions: ["table-audit", "kpi-total-pr"],
};

const POLITE_REFUSAL =
  "Main aapko iss hawalay se guide nahi kar sakta — yeh area aapke assigned access mein shamil nahi. Agar koi allowed topic (jo aapke dashboard rights mein hai) poochna ho to zaroor batayein.";

/** Topic keywords → permission keys needed (any). */
const TOPIC_GUARDS = [
  {
    name: "GRN",
    pattern: /\b(grn|receipt|receiving|po\s*to\s*grn|goods\s*receipt|backdated\s*grn)\b/i,
    keys: GRN_KEYS,
  },
  {
    name: "funnel",
    pattern: /\b(funnel|procurement\s*funnel)\b/i,
    keys: ["chart-funnel"],
  },
  {
    name: "creators",
    pattern: /\b(top\s*pr\s*creator|top\s*po\s*creator|pr\s*creator|po\s*creator|kis\s*ne\s*(zyada|sabse))\b/i,
    keys: ["chart-top-pr-creators", "chart-top-po-creators"],
  },
  {
    name: "department spend",
    pattern: /\b(department\s*spend|dept\s*spend|department\s*wise)\b/i,
    keys: ["chart-dept-spend"],
  },
  {
    name: "entity wise / company chart",
    pattern: /\b(legal\s*entity|company\s*wise\s*chart|entity\s*analysis)\b/i,
    keys: ["chart-legal-entity"],
  },
  {
    name: "split PO",
    pattern: /\b(split\s*po|suspicious\s*cluster)\b/i,
    keys: ["chart-split-po-watch", "table-split-po"],
  },
];

function hasAny(permissions, keys) {
  if (!keys || keys.length === 0) return true;
  const set = new Set(permissions || []);
  return keys.some((k) => set.has(k));
}

function isAdminRole(role) {
  return String(role || "").trim().toLowerCase() === "admin";
}

function canUseChatbot(user) {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  return (user.permissions || []).includes("feature-chatbot");
}

function canUseTool(toolName, permissions, role) {
  if (isAdminRole(role)) return true;
  const required = TOOL_REQUIRED_ANY[toolName];
  if (required === undefined) return false;
  return hasAny(permissions, required);
}

function filterToolsByPermissions(toolDefinitions, permissions, role) {
  if (isAdminRole(role)) return toolDefinitions;
  return toolDefinitions.filter((t) => canUseTool(t.function?.name, permissions, role));
}

/**
 * If the user asks about a topic they don't have rights for, return refusal reason.
 * Returns null when OK to proceed.
 */
function detectDisallowedTopic(message, permissions, role) {
  if (isAdminRole(role)) return null;
  const text = String(message || "");
  for (const guard of TOPIC_GUARDS) {
    if (guard.pattern.test(text) && !hasAny(permissions, guard.keys)) {
      return guard.name;
    }
  }
  return null;
}

function filterKpisStrict(obj, permissions, role) {
  if (!obj || typeof obj !== "object") return obj;
  if (isAdminRole(role)) return obj;
  const set = new Set(permissions || []);
  // section-executive-overview alone does NOT unlock every KPI — only explicit kpi-* keys
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "scope" || key === "departments" || key === "totalDepartments" || key === "totalLegalEntities") {
      // Always keep scope; department/entity counts are executive overview companions
      if (key === "scope") {
        out.scope = value;
        continue;
      }
      if (
        set.has("section-executive-overview") ||
        hasAny(permissions, EXEC_KPI_KEYS) ||
        set.has("chart-dept-spend") ||
        set.has("chart-legal-entity")
      ) {
        out[key] = value;
      }
      continue;
    }
    const needed = KPI_FIELD_PERMISSIONS[key];
    if (!needed) continue;
    if (set.has(needed)) out[key] = value;
  }
  return out;
}

function filterAuditSnapshot(result, permissions, role) {
  if (isAdminRole(role)) return result;
  const set = new Set(permissions || []);
  const out = { scope: result.scope };

  if (hasAny(permissions, EXEC_KPI_KEYS) || set.has("section-executive-overview")) {
    out.procurement = filterKpisStrict(
      {
        scope: result.scope,
        ...(result.procurement || {}),
      },
      permissions,
      role
    );
    delete out.procurement.scope;
  }

  if (set.has("chart-approval-status")) {
    out.approval = result.approval;
  }

  if (hasAny(permissions, GRN_KEYS)) {
    out.grn = result.grn;
  }

  if (set.has("chart-dept-spend")) {
    out.topDepartments = result.topDepartments;
  }

  if (set.has("chart-legal-entity") || set.has("feature-filters") || set.has("section-executive-overview")) {
    out.operatingUnits = result.operatingUnits;
  }

  if (set.has("chart-insights")) {
    out.auditObservations = result.auditObservations;
  }

  out.note =
    "ONLY discuss fields present above. Do NOT invent GRN, funnel, creators, or other metrics that are missing.";
  return out;
}

function filterToolResult(toolName, result, permissions, role) {
  if (!result || result.error || result.denied) return result;
  if (isAdminRole(role)) return result;

  switch (toolName) {
    case "get_kpis":
      return filterKpisStrict(result, permissions, role);
    case "get_audit_snapshot":
      return filterAuditSnapshot(result, permissions, role);
    case "get_top_creators": {
      const kind = result.kind;
      if (kind === "pr" && !(permissions || []).includes("chart-top-pr-creators")) {
        return { denied: true, message: POLITE_REFUSAL };
      }
      if (kind === "po" && !(permissions || []).includes("chart-top-po-creators")) {
        return { denied: true, message: POLITE_REFUSAL };
      }
      return result;
    }
    case "get_group_comparison": {
      if (!result.companies) return result;
      return {
        ...result,
        companies: result.companies.map((c) => {
          const slim = { company: c.company, operatingUnits: c.operatingUnits };
          const filtered = filterKpisStrict(
            {
              totalPRs: c.totalPRs,
              totalPOs: c.totalPOs,
              approvedPOs: c.approvedPOs,
              pendingPOs: c.pendingPOs,
              approvalRatePct: c.approvalRatePct,
              totalSpendPkr: c.totalSpendPkr,
            },
            permissions,
            role
          );
          Object.assign(slim, filtered);
          if (hasAny(permissions, GRN_KEYS)) {
            slim.grnFulfillmentPct = c.grnFulfillmentPct;
            slim.posWithoutGrn = c.posWithoutGrn;
          }
          if ((permissions || []).includes("chart-approval-status")) {
            slim.approval = c.approval;
          }
          return slim;
        }),
        note: "Only mention KPI fields present for each company.",
      };
    }
    case "get_insights":
      // Insights tool itself is gated; still strip GRN-ish flags if no GRN rights
      if (!hasAny(permissions, GRN_KEYS) && result.bottlenecks) {
        return { ...result, note: "Do not discuss GRN." };
      }
      return result;
    default:
      return result;
  }
}

function describeAllowedTopics(permissions, role) {
  if (isAdminRole(role)) return "Full dashboard access (all topics).";
  const set = new Set(permissions || []);
  const lines = [];
  const bits = [];
  if (set.has("kpi-total-pr")) bits.push("PR counts only");
  if (set.has("kpi-total-po")) bits.push("PO counts only");
  if (set.has("kpi-approved-po")) bits.push("approved PO count");
  if (set.has("kpi-pending-po")) bits.push("pending PO count");
  if (set.has("kpi-total-spend")) bits.push("spend total");
  if (bits.length) lines.push(`Executive KPIs: ${bits.join(", ")}`);
  if (set.has("section-executive-overview")) lines.push("Executive overview section");
  if (set.has("chart-funnel")) lines.push("Procurement funnel");
  if (set.has("chart-approval-status")) lines.push("Approval status chart");
  if (set.has("chart-insights")) lines.push("Insights");
  if (set.has("chart-dept-spend")) lines.push("Department spend");
  if (set.has("chart-legal-entity")) lines.push("Legal entity / company comparison");
  if (set.has("chart-top-pr-creators")) lines.push("Top PR creators");
  if (set.has("chart-top-po-creators")) lines.push("Top PO creators");
  if (hasAny(permissions, GRN_KEYS)) lines.push("GRN / receipts");
  if (set.has("table-audit") || set.has("kpi-total-po")) lines.push("PO number lists");
  if (set.has("table-audit") || set.has("kpi-total-pr")) lines.push("PR number lists");
  lines.push("FORBIDDEN unless listed above: GRN, funnel, creators, department charts, anything not listed.");
  return lines.length ? lines.map((l) => `- ${l}`).join("\n") : "- (no data topics granted — only greetings)";
}

module.exports = {
  TOOL_REQUIRED_ANY,
  POLITE_REFUSAL,
  canUseChatbot,
  canUseTool,
  filterToolsByPermissions,
  filterToolResult,
  describeAllowedTopics,
  detectDisallowedTopic,
  GRN_KEYS,
  EXEC_KPI_KEYS,
};
