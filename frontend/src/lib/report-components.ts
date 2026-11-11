export interface ReportComponent {
  key: string;
  type: "section" | "kpi" | "chart" | "table";
  title: string;
  section: string;
}

export const REPORT_COMPONENTS: ReportComponent[] = [
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

export function groupComponentsBySection(components: ReportComponent[]) {
  const map = new Map<string, ReportComponent[]>();
  for (const c of components) {
    if (!map.has(c.section)) map.set(c.section, []);
    map.get(c.section)!.push(c);
  }
  return Array.from(map.entries());
}
