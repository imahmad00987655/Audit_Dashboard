/** Keep in sync with backend/src/services/dataAccessService.js */

export const DATA_DOMAINS = [
  { key: "pr", label: "Purchase Requisitions (PR)" },
  { key: "po", label: "Purchase Orders (PO)" },
  { key: "spend", label: "Spend" },
  { key: "approvals", label: "Approvals" },
  { key: "grn", label: "GRN / Receipts" },
  { key: "split_po", label: "Split PO Watch" },
] as const;

export type DataDomainKey = (typeof DATA_DOMAINS)[number]["key"];

/** component_key → required data domain (undefined = no domain gate) */
export const COMPONENT_DOMAIN: Record<string, DataDomainKey | null> = {
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
