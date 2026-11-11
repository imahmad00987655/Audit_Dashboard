export interface DashboardFilters {
  organization?: string;
  organizationName?: string;
  operatingUnit?: string;
  department?: string;
  prCreator?: string;
  poCreator?: string;
  approver?: string;
  approvalStatus?: string;
  purchaseType?: string;
  poRevised?: string;
  poLinkage?: string;
  year?: string;
  month?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  vendorId?: string;
  aging?: string;
  reqNo?: string;
  poNo?: string;
  itemCode?: string;
  receivingOrg?: string;
  receiptNum?: string;
  grnUser?: string;
  grnLinkage?: string;
  poToGrnAging?: string;
  backdated?: string;
  grnReturnStatus?: string;
}

export interface CurrencyBreakdown {
  code: string;
  amount: number;
  lineCount: number;
  convertedPkr: number;
}

export interface CurrencySpend {
  pkrNative: number;
  pkrLineCount: number;
  foreignInPkr: number;
  foreignLineCount: number;
  combinedPkr: number;
  foreignCurrencies: CurrencyBreakdown[];
  primaryForeign: CurrencyBreakdown | null;
  missingRateCount: number;
  missingRateAmount: number;
}

export interface GrnKpis {
  totalReceipts: number;
  posWithGrn: number;
  posWithoutGrn: number;
  amountReceived: number;
  totalGrnQty: number;
  fulfillmentRate: number;
  avgPoToGrnDays: number | null;
  backdatedGrnCount: number;
  grnLineCount: number;
}

export interface CommandCenterKpis {
  totalPRs: number;
  approvedPRs: number;
  pendingPRs: number;
  totalPOs: number;
  approvedPOs: number;
  pendingPOs: number;
  totalPoValue: number;
  posWithoutGrn: number;
  posWithGrn: number;
  totalReceivedQty: number;
  pendingReceivingQty: number;
  totalReceipts: number;
  amountReceived: number;
  backdatedGrnCount: number;
}

export interface CommandCenterNode {
  id: string;
  type: string;
  stage: string;
  label: string;
  subtitle?: string;
  count?: number;
  value?: number;
  meta?: Record<string, number | undefined>;
}

export interface CommandCenterLink {
  id: string;
  from: string;
  to: string;
  weight: number;
  kind: string;
  verified?: boolean;
}

export interface CommandCenterActivity {
  id: string;
  fingerprint: string;
  kind: string;
  title: string;
  documentRef: string;
  reqNo?: string | null;
  hasPrLink?: boolean;
  hasPoLink?: boolean;
  vendor?: string | null;
  department?: string | null;
  amount?: number | null;
  quantity?: number | null;
  receiptNum?: string | null;
  receivingOrg?: string | null;
  grnUser?: string | null;
  currency?: string;
  status?: string | null;
  timestamp?: string | null;
  backdatedDays?: number | null;
}

export interface CommandCenterPipeline {
  prToPo: number;
  poToGrn: number;
  awaitingReceipt: number;
  partiallyReceived: number;
  fullyReceived: number;
  pendingApproval: number;
  linkedPos: number;
}

export interface CommandCenterData {
  generatedAt: string;
  kpis: CommandCenterKpis;
  pipeline: CommandCenterPipeline;
  network: { nodes: CommandCenterNode[]; links: CommandCenterLink[] };
  activity: CommandCenterActivity[];
}

export interface Kpis {
  totalPurchaseRequisitions: number;
  totalPurchaseOrders: number;
  approvedPurchaseOrders: number;
  pendingPurchaseOrders: number;
  totalSpend: number;
  currencySpend: CurrencySpend;
  nonPoSpend: number;
  totalDepartments: number;
  totalLegalEntities: number;
  approvalRate: number;
  grn?: GrnKpis;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface MonthlyPoint {
  month: string;
  purchaseRequisitions: number;
  purchaseOrders: number;
  spend: number;
}

export interface DepartmentSpend {
  department: string;
  spend: number;
  approvedSpend: number;
  pendingSpend: number;
  prCount: number;
  poCount: number;
}

export interface DepartmentPerformance {
  department: string;
  totalPR: number;
  totalPO: number;
  spend: number;
  approvalRate: number;
  avgProcessingTime: number | null;
  processingMetric?: string | null;
  processingPoCount?: number;
}

export interface LegalEntity {
  name: string;
  spend: number;
  prCount: number;
  poCount: number;
}

export interface Vendor {
  vendorId: string;
  vendorName: string;
  spend: number;
  poCount: number;
}

export interface PurchaseType {
  name: string;
  spend: number;
  prCount: number;
  poCount: number;
}

export interface PoRevisionBucket {
  name: string;
  withPr: number;
  withoutPr: number;
  total: number;
}

export interface PoRevisionSummary {
  totalPOs: number;
  revisedPOs: number;
  neverRevised: number;
  totalRevisionEvents: number;
  withPr: { total: number; revised: number; neverRevised: number };
  withoutPr: { total: number; revised: number; neverRevised: number };
}

export interface PoRevisionTopItem {
  poNo: string;
  revisedCount: number;
  hasPr: boolean;
  linkage: string;
  spend: number;
  vendorName: string;
}

export interface PoRevisionData {
  summary: PoRevisionSummary;
  buckets: PoRevisionBucket[];
  topRevised: PoRevisionTopItem[];
}

export interface ApprovalStatusItem {
  name: string;
  value: number;
  color: string;
}

export interface FunnelStage {
  stage: string;
  count: number;
}

export interface AgingBucket {
  name: string;
  count: number;
}

export interface FilterOptions {
  organizations: string[];
  organizationNames?: string[];
  operatingUnits: string[];
  departments: string[];
  prCreators: string[];
  poCreators: string[];
  approvers: string[];
  years: number[];
  months: { value: number; label: string }[];
  approvalStatuses: string[];
  purchaseTypes: string[];
  receivingOrgs?: string[];
  grnUsers?: string[];
  grnLinkages?: { value: string; label: string }[];
  poToGrnAgingBuckets?: string[];
  grnReturnStatuses?: { value: string; label: string }[];
}

export interface GrnReceivingOrg {
  org: string;
  amountReceived: number;
  grnQty: number;
  poCount: number;
  receiptCount: number;
}

export interface GrnMonthlyPoint {
  month: string;
  receiptCount: number;
  poCount: number;
  amountReceived: number;
  grnQty: number;
}

export interface GrnVendor {
  vendorId: string;
  vendorName: string;
  amountReceived: number;
  grnQty: number;
  poCount: number;
}

export interface GrnInsights {
  grnSummary: GrnKpis;
  topReceivingOrg: GrnReceivingOrg | null;
  topGrnVendor: GrnVendor | null;
  slowestGrnVendor: { vendorId: string; vendorName: string; avgDays: number } | null;
  poToGrnBottleneck: { slow30PlusDays: number; posWithoutGrn: number; message: string };
  fulfillmentInsight: { rate: number; recommendation: string };
}

export interface GrnReturnBucket {
  key: string;
  name: string;
  count: number;
  qty: number;
  color: string;
}

export interface GrnReturnVendor {
  vendorId: string;
  vendorName: string;
  returnQty: number;
  lineCount: number;
}

export interface GrnReturnRejectData {
  summary: {
    totalLines: number;
    returnLines: number;
    totalReturnQty: number;
    acceptRejectLines: number;
    deliveryGapLines: number;
    cleanLines: number;
    returnRate: number;
    acceptRejectRate: number;
  };
  buckets: GrnReturnBucket[];
  topVendorsByReturn: GrnReturnVendor[];
}

export interface GrnRow {
  PO_NO: string;
  PO_DATE: string;
  VENDOR_ID: number | string;
  VENDOR_NAME: string;
  ITEM_CODE: string;
  ITEM_DESC: string;
  PO_QTY: number;
  PO_AMT: number;
  RATE: number;
  CURRENCY_CODE: string;
  RECEIPT_NUM: string;
  CREATION_DATE_RECEIPT: string;
  GRN_DATE: string;
  GRN_QTY: number;
  RECEIVE_QTY: number;
  ACCEPT_QTY: number;
  DELIVER_QTY: number;
  RETURN_QTY: number | null;
  AMOUNT_RECEIVED: number;
  ORG_RECEIVING_RSL: string;
  USER_NAME: string;
  SUBMIT_NAME: string;
  APPROVER_NAME: string;
  PO_APPROVE: string;
  PO_SUBMIT: string;
  PO_FORWARD: string;
  BACKDATED_DAYS: number;
  PO_TO_GRN_DAYS: number | null;
}

export interface AuditRow {
  ORGANIZATION_NAME: string;
  COMP_NAME?: string;
  DEPARTMENT: string;
  REQ_NO: string;
  REQ_CREADED_BY: string;
  CREATION_DATE_PR: string;
  PO_NO: string;
  PO_CREATED_BY: string;
  PO_CREATION_DATE: string;
  PO_APPROVE: string | null;
  APPROVER_NAME: string;
  PO_AMT: number;
  CURRENCY_CODE?: string | null;
  PO_EXCH_RATE?: number | string | null;
  PO_EXCH_RATE_DATE?: string | null;
  ITEM_DESC: string;
  ITEM_CODE?: string;
  VENDOR_ID: number | string;
  VENDOR_NAME?: string;
  PURCHASE_TYPE?: string;
  PO_REVISED_COUNT?: number | string | null;
  CONTROL_STATUS: string;
  PR_AUTHORIZATION_STATUS: string;
  PO_AUTHORIZATION_STATUS: string;
}

export interface SplitPoClusterPo {
  poNo: string;
  amountPkr: number;
  rawAmount: number;
  currency: string;
  poCreationDate: string;
  approverName: string;
  approverFinal: string;
  poApproved: boolean;
}

export interface SplitPoCluster {
  id: string;
  creator: string;
  itemCode: string;
  itemDesc: string;
  vendorId: string;
  vendorName: string;
  department: string;
  organization: string;
  windowStart: string;
  windowEnd: string;
  windowDays: number;
  poCount: number;
  totalAmountPkr: number;
  maxSinglePoPkr: number;
  approvalLimitPkr: number;
  excessAmountPkr: number;
  riskLevel: "high" | "medium";
  pattern: string;
  pos: SplitPoClusterPo[];
  approvers: string[];
}

export interface SplitPoAnalysis {
  summary: {
    approvalLimitPkr: number;
    windowDays: number;
    suspiciousClusters: number;
    dedupedClusters?: number;
    flaggedPos: number;
    flaggedCreators: number;
    flaggedItemCodes: number;
    totalSplitAmountPkr: number;
    totalExcessPkr: number;
    highRiskClusters: number;
  };
  byCreator: { name: string; clusterCount: number; poCount: number; totalAmountPkr: number; excessPkr: number }[];
  byItemCode: {
    itemCode: string;
    itemDesc: string;
    clusterCount: number;
    poCount: number;
    totalAmountPkr: number;
    excessPkr: number;
  }[];
  dailyTrend: { date: string; clusters: number; poCount: number; excessPkr: number }[];
  clusters: SplitPoCluster[];
}

export interface SplitPoInsight {
  type: string;
  title: string;
  message: string;
}

export interface Insights {
  highestPRCreator: NamedCount | null;
  highestPOCreator: NamedCount | null;
  highestProcurementDepartment: { name: string; prCount: number; poCount: number } | null;
  highestSpendDepartment: { name: string; spend: number } | null;
  maxProcurementOrganization: LegalEntity | null;
  pendingApprovalSummary: {
    pendingPOs: number;
    approvedPOs: number;
    approvalRate: number;
  };
  bottlenecks: {
    aging10PlusDays: number;
    pendingApprovals: number;
    message: string;
  };
  approvalDelayInsights: {
    avgPendingShare: number;
    recommendation: string;
  };
  topProcurementUsers: { name: string; prs: number; pos: number }[];
  grn?: GrnInsights;
  splitPo?: SplitPoInsight[];
}

export interface DrillPath {
  level: string;
  value: string;
  label: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5057";

export interface UserDataAccess {
  organizations: string[];
  domains: string[];
  unrestricted?: boolean;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: "admin" | "user";
  permissions?: string[];
  dataAccess?: UserDataAccess;
}

export interface AdminComponent {
  componentKey: string;
  componentType: string;
  title: string;
  sectionName: string;
  displayOrder: number;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: "admin" | "user";
  isActive: number | boolean;
  createdAt?: string;
  permissions: string[];
  dataAccess?: UserDataAccess;
}

export interface ReportEmailRecipient {
  id: number;
  email: string;
  createdAt: string;
}

export interface LoginSession {
  id: number;
  userId: number;
  username: string;
  fullName: string;
  loginAt: string;
  logoutAt: string | null;
  durationSeconds: number | null;
  ipAddress: string | null;
  isActive: number;
}

export interface DayEndReportStatus {
  locked: boolean;
  report: {
    id: number;
    reportDate: string;
    submittedAt: string;
    remarks: string;
    emailStatus: string;
    pdfFilename: string;
  } | null;
}

export interface DataFeedStatus {
  live: boolean;
  procurement: {
    live: boolean;
    records: number;
    fetchedAt: string | null;
    lastError: string | null;
  };
  grn: {
    live: boolean;
    records: number;
    fetchedAt: string | null;
    lastError: string | null;
  };
  checkedAt: string;
}

function getAuthHeaders(includeJson = true): HeadersInit {
  const headers: Record<string, string> = {};
  if (includeJson) headers["Content-Type"] = "application/json";
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("audit_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...getAuthHeaders(hasBody),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res as unknown as T;
}

export function buildQuery(filters: DashboardFilters, extra: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...extra }).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  });
  return params.toString();
}

async function apiGet<T>(path: string, filters: DashboardFilters = {}, extra: Record<string, string | number | undefined> = {}): Promise<T> {
  const qs = buildQuery(filters, extra);
  return apiFetch<T>(`${path}${qs ? `?${qs}` : ""}`);
}

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<{ success: boolean; data: { user: AuthUser; token: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => apiFetch<{ success: boolean }>("/auth/logout", { method: "POST" }),
  me: () => apiFetch<{ success: boolean; data: AuthUser }>("/auth/me"),
  sessions: () => apiFetch<{ success: boolean; data: LoginSession[] }>("/auth/sessions"),
};

export const adminApi = {
  components: () => apiFetch<{ success: boolean; data: AdminComponent[] }>("/admin/components"),
  users: () => apiFetch<{ success: boolean; data: AdminUser[] }>("/admin/users"),
  getUser: (id: number) => apiFetch<{ success: boolean; data: AdminUser }>(`/admin/users/${id}`),
  createUser: (payload: {
    username: string;
    email: string;
    password: string;
    fullName: string;
    role?: "admin" | "user";
    permissions?: string[];
    dataAccess?: { organizations: string[]; domains: string[] };
  }) =>
    apiFetch<{ success: boolean; data: AdminUser }>("/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateUser: (
    id: number,
    payload: Partial<{
      email: string;
      fullName: string;
      role: "admin" | "user";
      isActive: boolean;
      password: string;
      permissions: string[];
      dataAccess: { organizations: string[]; domains: string[] };
    }>
  ) =>
    apiFetch<{ success: boolean; data: AdminUser }>(`/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteUser: (id: number) =>
    apiFetch<{ success: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),
  organizations: () =>
    apiFetch<{ success: boolean; data: string[] }>("/admin/organizations"),
  dataDomains: () =>
    apiFetch<{ success: boolean; data: { key: string; label: string }[] }>("/admin/data-domains"),
  reportEmails: () =>
    apiFetch<{ success: boolean; data: ReportEmailRecipient[] }>("/admin/report-emails"),
  addReportEmail: (email: string) =>
    apiFetch<{ success: boolean; data: ReportEmailRecipient }>("/admin/report-emails", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  deleteReportEmail: (id: number) =>
    apiFetch<{ success: boolean }>(`/admin/report-emails/${id}`, { method: "DELETE" }),
};

export const reportsApi = {
  components: () => apiFetch<{ success: boolean; data: import("@/lib/report-components").ReportComponent[] }>("/reports/components"),
  status: (date: string) =>
    apiFetch<{ success: boolean; data: DayEndReportStatus }>(`/reports/status?date=${encodeURIComponent(date)}`),
  submitDayEnd: (payload: {
    reportDate: string;
    remarks: string;
    filters: DashboardFilters;
    selectedKeys: string[];
    signatureImage: string;
  }) =>
    apiFetch<{ success: boolean; data: { id: number; reportDate: string; pdfFilename: string; emailStatus: string; locked: boolean } }>(
      "/reports/day-end",
      { method: "POST", body: JSON.stringify(payload) }
    ),
  previewPdf: async (payload: {
    reportDate: string;
    remarks: string;
    filters: DashboardFilters;
    selectedKeys: string[];
    signatureImage?: string | null;
  }) => {
    const res = await fetch(`${API_BASE}/reports/preview-pdf`, {
      method: "POST",
      credentials: "include",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "PDF preview failed");
    }
    return res.blob();
  },
  downloadPdf: (reportId: number) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("audit_token") : null;
    return `${API_BASE}/reports/day-end/${reportId}/pdf${token ? `?token=${token}` : ""}`;
  },
  history: () => apiFetch<{ success: boolean; data: unknown[] }>("/reports/history"),
};

export const api = {
  dataFeedStatus: () => apiFetch<{ success: boolean; data: DataFeedStatus }>("/dashboard/data-feed-status"),
  commandCenter: (f: DashboardFilters) =>
    apiGet<{ success: boolean; data: CommandCenterData }>("/dashboard/command-center", f),
  kpis: (f: DashboardFilters) => apiGet<{ success: boolean; data: Kpis }>("/dashboard/kpis", f),
  prCreators: (f: DashboardFilters) => apiGet<{ success: boolean; data: NamedCount[] }>("/dashboard/pr-creators", f),
  poCreators: (f: DashboardFilters) => apiGet<{ success: boolean; data: NamedCount[] }>("/dashboard/po-creators", f),
  approvers: (f: DashboardFilters) => apiGet<{ success: boolean; data: NamedCount[] }>("/dashboard/approvers", f),
  spend: (f: DashboardFilters) =>
    apiGet<{
      success: boolean;
      data: {
        monthly: MonthlyPoint[];
        byDepartment: DepartmentSpend[];
        aging: AgingBucket[];
        approvalStatus: ApprovalStatusItem[];
        funnel: FunnelStage[];
        poToGrnAging?: AgingBucket[];
        grnFunnel?: FunnelStage[];
      };
    }>("/dashboard/spend", f),
  grn: (f: DashboardFilters) =>
    apiGet<{
      success: boolean;
      data: {
        kpis: GrnKpis;
        aging: AgingBucket[];
        funnel: FunnelStage[];
        byReceivingOrg: GrnReceivingOrg[];
        monthly: GrnMonthlyPoint[];
        vendors: GrnVendor[];
        returnReject: GrnReturnRejectData;
      };
    }>("/dashboard/grn", f),
  monthly: (f: DashboardFilters) => apiGet<{ success: boolean; data: MonthlyPoint[] }>("/dashboard/monthly", f),
  legalEntities: (f: DashboardFilters) => apiGet<{ success: boolean; data: LegalEntity[] }>("/dashboard/legal-entities", f),
  departments: (f: DashboardFilters) =>
    apiGet<{
      success: boolean;
      data: { spend: DepartmentSpend[]; performance: DepartmentPerformance[] };
    }>("/dashboard/departments", f),
  vendors: (f: DashboardFilters) => apiGet<{ success: boolean; data: Vendor[] }>("/dashboard/vendors", f),
  purchaseTypes: (f: DashboardFilters) =>
    apiGet<{ success: boolean; data: PurchaseType[] }>("/dashboard/purchase-types", f),
  poRevisions: (f: DashboardFilters) =>
    apiGet<{ success: boolean; data: PoRevisionData }>("/dashboard/po-revisions", f),
  insights: (f: DashboardFilters) => apiGet<{ success: boolean; data: Insights }>("/dashboard/insights", f),
  filters: (f: DashboardFilters = {}) =>
    apiGet<{ success: boolean; data: FilterOptions }>("/dashboard/filters", f),
  table: (f: DashboardFilters, page: number, pageSize: number, sortBy?: string, sortDir?: string) =>
    apiGet<{
      success: boolean;
      data: AuditRow[];
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }>("/dashboard/table", f, { page, pageSize, sortBy, sortDir }),
  grnTable: (f: DashboardFilters, page: number, pageSize: number, sortBy?: string, sortDir?: string) =>
    apiGet<{
      success: boolean;
      data: GrnRow[];
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }>("/dashboard/grn-table", f, { page, pageSize, sortBy, sortDir }),
  splitPo: (f: DashboardFilters) =>
    apiGet<{ success: boolean; data: SplitPoAnalysis }>("/dashboard/split-po", f),
  splitPoTable: (f: DashboardFilters, page: number, pageSize: number) =>
    apiGet<{
      success: boolean;
      data: SplitPoCluster[];
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }>("/dashboard/split-po-table", f, { page, pageSize }),
  drilldown: (f: DashboardFilters, level: string, value: string) =>
    apiGet<{ success: boolean; data: unknown }>("/dashboard/drilldown", f, { level, value }),
};

export const chatApi = {
  status: () =>
    apiFetch<{ success: boolean; data: { configured: boolean; model: string; allowed?: boolean } }>(
      "/chat/status"
    ),
  ask: (payload: {
    message: string;
    filters?: DashboardFilters;
    history?: { role: "user" | "assistant"; content: string }[];
  }) =>
    apiFetch<{
      success: boolean;
      data: {
        reply: string;
        usedTools: string[];
        model: string;
        refused?: boolean;
        action?: "share_day_end_report" | null;
      };
    }>("/chat/ask", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
