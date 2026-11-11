"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  ShoppingCart,
  CheckCircle2,
  Clock3,
  CircleDollarSign,
  Building2,
  Landmark,
  UserPen,
  PackageCheck,
  ShieldCheck,
  LayoutDashboard,
  Package,
  Receipt,
  Timer,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { useDashboard } from "@/context/dashboard-context";
import { useDeferredReady } from "@/hooks/use-deferred-ready";
import { usePermission } from "@/hooks/use-permission";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard/header";
import { FilterBar } from "@/components/dashboard/filter-bar";
import {
  DashboardSectionNav,
  type DashboardSectionId,
} from "@/components/dashboard/dashboard-section-nav";
import { KpiCard, CurrencySpendKpiCard } from "@/components/dashboard/kpi-cards";
import { AiInsights } from "@/components/dashboard/ai-insights";
import { DepartmentPerformanceCards } from "@/components/dashboard/department-performance";
import { AuditTable } from "@/components/dashboard/audit-table";
import { GrnTable } from "@/components/dashboard/grn-table";
import { SplitPoTable } from "@/components/dashboard/split-po-table";
import { ConnectedDrillStrip } from "@/components/dashboard/drilldown-panel";
import { DashboardScrollControl } from "@/components/dashboard/dashboard-scroll-control";
import { DashboardJumpFab } from "@/components/dashboard/dashboard-jump-fab";
import {
  HorizontalBarChartCard,
  FunnelChart,
  ApprovalDonut,
  DepartmentSpendChart,
  LegalEntityChart,
  MonthlyTrendChart,
  SpendAreaChart,
  VendorChart,
  AgingChart,
  PurchaseTypeChart,
  PurchaseTypeVolumeChart,
  PoRevisionBucketChart,
  PoRevisionLinkageChart,
  PoRevisionTopChart,
  ChartIconBadge,
  GrnFunnelChart,
  PoToGrnAgingChart,
  GrnReceivingOrgChart,
  GrnMonthlyChart,
  GrnVendorChart,
  GrnReturnRejectChart,
  SplitPoWatchChart,
} from "@/components/dashboard/charts";
import { Skeleton } from "@/components/ui/input";
import { AuditChatBot } from "@/components/chat/AuditChatBot";
import { PermissionGate } from "@/components/permission-gate";

export function DashboardView() {
  const { filters, pushDrill, setFilter } = useDashboard();
  const { can, canAny } = usePermission();
  const heavyReady = useDeferredReady(450);
  const [activeSection, setActiveSection] = useState<DashboardSectionId>("overview");

  const visibleSections = useMemo(() => {
    const ids: DashboardSectionId[] = [];
    if (can("section-executive-overview") || can("chart-insights")) ids.push("overview");
    if (
      can("section-grn-overview") ||
      canAny([
        "chart-grn-funnel",
        "chart-po-to-grn-aging",
        "chart-grn-receiving-org",
        "chart-grn-monthly",
        "chart-grn-vendors",
        "chart-grn-quality",
      ])
    ) {
      ids.push("grn");
    }
    if (
      canAny([
        "chart-funnel",
        "chart-approval-status",
        "chart-top-pr-creators",
        "chart-top-po-creators",
        "chart-top-approvers",
        "chart-dept-spend",
        "chart-legal-entity",
        "chart-monthly-trend",
        "chart-spend-analysis",
        "chart-purchase-type-mix",
        "chart-purchase-type-volume",
        "chart-po-revision-count",
        "chart-po-revision-linkage",
        "chart-most-revised-pos",
        "chart-vendor-analysis",
        "chart-procurement-aging",
        "chart-dept-performance",
      ])
    ) {
      ids.push("analytics");
    }
    if (canAny(["chart-split-po-watch", "table-split-po"])) ids.push("risk");
    if (canAny(["table-audit", "table-grn"])) ids.push("tables");
    return ids;
  }, [can, canAny]);

  useEffect(() => {
    if (!visibleSections.length) return;
    if (!visibleSections.includes(activeSection)) {
      setActiveSection(visibleSections[0]);
    }
  }, [visibleSections, activeSection]);

  const onSectionChange = (id: DashboardSectionId) => {
    setActiveSection(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onJumpTo = (section: DashboardSectionId, anchorId: string) => {
    const go = () => {
      const el = document.getElementById(anchorId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (section !== activeSection) {
      setActiveSection(section);
      window.setTimeout(go, 80);
      window.setTimeout(go, 240);
      return;
    }
    go();
  };

  const showOverview = activeSection === "overview";
  const showGrn = activeSection === "grn";
  const showAnalytics = activeSection === "analytics";
  const showRisk = activeSection === "risk";
  const showTables = activeSection === "tables";

  const kpisQ = useQuery({ queryKey: ["kpis", filters], queryFn: () => api.kpis(filters) });
  const prQ = useQuery({
    queryKey: ["pr-creators", filters],
    queryFn: () => api.prCreators(filters),
    enabled: showAnalytics,
  });
  const poQ = useQuery({
    queryKey: ["po-creators", filters],
    queryFn: () => api.poCreators(filters),
    enabled: showAnalytics,
  });
  const apprQ = useQuery({
    queryKey: ["approvers", filters],
    queryFn: () => api.approvers(filters),
    enabled: showAnalytics,
  });
  const spendQ = useQuery({
    queryKey: ["spend", filters],
    queryFn: () => api.spend(filters),
    enabled: showAnalytics || showGrn,
  });
  const legalQ = useQuery({
    queryKey: ["legal", filters],
    queryFn: () => api.legalEntities(filters),
    enabled: showAnalytics,
  });
  const deptQ = useQuery({
    queryKey: ["departments", filters],
    queryFn: () => api.departments(filters),
    enabled: showAnalytics,
  });
  const vendorQ = useQuery({
    queryKey: ["vendors", filters],
    queryFn: () => api.vendors(filters),
    enabled: heavyReady && showAnalytics,
  });
  const purchaseTypeQ = useQuery({
    queryKey: ["purchase-types", filters],
    queryFn: () => api.purchaseTypes(filters),
    enabled: heavyReady && showAnalytics,
  });
  const revisionQ = useQuery({
    queryKey: ["po-revisions", filters],
    queryFn: () => api.poRevisions(filters),
    enabled: heavyReady && showAnalytics,
  });
  const grnQ = useQuery({
    queryKey: ["grn", filters],
    queryFn: () => api.grn(filters),
    enabled: showGrn,
  });
  const splitPoQ = useQuery({
    queryKey: ["split-po", filters],
    queryFn: () => api.splitPo(filters),
    enabled: heavyReady && showRisk,
  });

  const kpis = kpisQ.data?.data;
  const spend = spendQ.data?.data;
  const revisions = revisionQ.data?.data;
  const grn = grnQ.data?.data;
  const splitPo = splitPoQ.data?.data;

  return (
    <div className="mx-auto max-w-400 space-y-6 px-4 py-6 md:px-6">
      <DashboardHeader />
      <PermissionGate permission="feature-filters">
        <FilterBar />
      </PermissionGate>

      <DashboardSectionNav
        active={activeSection}
        visibleIds={visibleSections}
        onChange={onSectionChange}
      />

      {showOverview && (
      <PermissionGate permission="section-executive-overview">
      <section id="jump-overview" className="scroll-mt-24">
        <div className="mb-3 flex items-start gap-3">
          <ChartIconBadge icon={LayoutDashboard} tone="sky" className="h-8 w-8 rounded-lg" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
            Executive Overview
          </h2>
        </div>
        {kpisQ.isLoading || !kpis ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Total Purchase Requisitions"
              value={kpis.totalPurchaseRequisitions}
              formatter={(n) => formatNumber(Math.round(n))}
              icon={FileText}
              tooltip="Unique REQ_NO count · click to open overview"
              accent="bg-[#0055a5]"
              gauge={
                kpis.totalPurchaseRequisitions
                  ? Math.min(100, (kpis.totalPurchaseOrders / kpis.totalPurchaseRequisitions) * 100)
                  : 0
              }
              deltaLabel="Orders from PRs"
              delay={0}
              onClick={() =>
                pushDrill({
                  level: "overview",
                  value: "ALL",
                  label: "All Purchase Requisitions",
                })
              }
            />
            <KpiCard
              title="Total Purchase Orders"
              value={kpis.totalPurchaseOrders}
              formatter={(n) => formatNumber(Math.round(n))}
              icon={ShoppingCart}
              tooltip="Unique PO_NO · Gauge = PO Approval Rate (Approved POs ÷ Total POs) · not PR/GRN"
              accent="bg-[#2f7ec4]"
              gauge={Number(kpis.approvalRate) || 0}
              deltaLabel="PO approval rate"
              delay={0.04}
              onClick={() => setFilter("approvalStatus", "")}
            />
            <KpiCard
              title="Approved Purchase Orders"
              value={kpis.approvedPurchaseOrders}
              formatter={(n) => formatNumber(Math.round(n))}
              icon={CheckCircle2}
              tooltip="Unique PO_NO with final approver (APPROVER_FINAL) · PO-based, not PR/GRN"
              accent="bg-[#0055a5]"
              gauge={
                kpis.totalPurchaseOrders
                  ? (kpis.approvedPurchaseOrders / kpis.totalPurchaseOrders) * 100
                  : 0
              }
              deltaLabel="Of all POs"
              delay={0.08}
              onClick={() =>
                pushDrill({ level: "approvalStatus", value: "APPROVED", label: "Approved POs" })
              }
            />
            <KpiCard
              title="Pending Purchase Orders"
              value={kpis.pendingPurchaseOrders}
              formatter={(n) => formatNumber(Math.round(n))}
              icon={Clock3}
              tooltip="Unique PO_NO without APPROVER_FINAL (awaiting final approval)"
              accent="bg-[#fff200]"
              gaugeColor="#e6b800"
              gauge={
                kpis.totalPurchaseOrders
                  ? (kpis.pendingPurchaseOrders / kpis.totalPurchaseOrders) * 100
                  : 0
              }
              deltaLabel="Awaiting action"
              delay={0.12}
              onClick={() =>
                pushDrill({ level: "approvalStatus", value: "PENDING", label: "Pending POs" })
              }
            />
            <CurrencySpendKpiCard
              currencySpend={
                kpis.currencySpend ?? {
                  pkrNative: kpis.totalSpend,
                  pkrLineCount: 0,
                  foreignInPkr: 0,
                  foreignLineCount: 0,
                  combinedPkr: kpis.totalSpend,
                  foreignCurrencies: [],
                  primaryForeign: null,
                  missingRateCount: 0,
                  missingRateAmount: 0,
                }
              }
              poLinkedShare={
                kpis.totalSpend
                  ? Math.min(100, ((kpis.totalSpend - kpis.nonPoSpend) / kpis.totalSpend) * 100)
                  : 0
              }
              delay={0.16}
            />
            <KpiCard
              title="Po Without Pr"
              value={kpis.nonPoSpend}
              formatter={(n) => formatCurrency(n, true)}
              icon={CircleDollarSign}
              tooltip="PO exists without REQ_NO"
              accent="bg-[#e31e24]"
              gauge={kpis.totalSpend ? (kpis.nonPoSpend / kpis.totalSpend) * 100 : 0}
              deltaLabel="Of total spend"
              delay={0.2}
            />
            <KpiCard
              title="Total Departments & Sections"
              value={kpis.totalDepartments}
              formatter={(n) => formatNumber(Math.round(n))}
              icon={Building2}
              tooltip="Unique DEPARTMENT"
              accent="bg-[#2f7ec4]"
              gauge={Math.min(100, kpis.totalDepartments * 3.5)}
              deltaLabel="Coverage"
              delay={0.24}
            />
            <KpiCard
              title="Total Legal Entities"
              value={kpis.totalLegalEntities}
              formatter={(n) => formatNumber(Math.round(n))}
              icon={Landmark}
              tooltip="Unique COMP_NAME (entity / company)"
              accent="bg-[#e31e24]"
              gauge={Math.min(100, kpis.totalLegalEntities * 18)}
              deltaLabel="Entities live"
              delay={0.28}
            />
          </div>
        )}
      </section>
      </PermissionGate>
      )}

      {showOverview && (
        <PermissionGate permission="chart-insights">
          <div id="jump-insights" className="scroll-mt-24">
            <AiInsights />
          </div>
        </PermissionGate>
      )}

      {showGrn && (
      <>
      <PermissionGate permission="section-grn-overview">
        {kpisQ.isLoading || !kpis ? (
          <section id="jump-grn-overview" className="scroll-mt-24">
            <div className="mb-3 flex items-start gap-3">
              <ChartIconBadge icon={Package} tone="green" className="h-8 w-8 rounded-lg" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
                GRN Overview (PO → Receipt)
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          </section>
        ) : kpis?.grn ? (
          <section id="jump-grn-overview" className="scroll-mt-24">
            <div className="mb-3 flex items-start gap-3">
              <ChartIconBadge icon={Package} tone="green" className="h-8 w-8 rounded-lg" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
                GRN Overview (PO → Receipt)
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                title="Total Receipts"
                value={kpis.grn.totalReceipts}
                formatter={(n) => formatNumber(Math.round(n))}
                icon={Receipt}
                tooltip="Unique RECEIPT_NUM in filtered GRN data"
                accent="bg-[#3d9b6a]"
                gauge={Math.min(100, kpis.grn.totalReceipts * 2)}
                deltaLabel="GRN receipts"
                delay={0}
              />
              <KpiCard
                title="PO's with GRN"
                value={kpis.grn.posWithGrn}
                formatter={(n) => formatNumber(Math.round(n))}
                icon={PackageCheck}
                tooltip="Unique PO_NO with goods receipt"
                accent="bg-[#0055a5]"
                gauge={
                  kpis.totalPurchaseOrders
                    ? Math.min(100, (kpis.grn.posWithGrn / kpis.totalPurchaseOrders) * 100)
                    : 0
                }
                deltaLabel="Of total POs"
                delay={0.04}
                onClick={() => pushDrill({ level: "grnLinkage", value: "withGrn", label: "POs with GRN" })}
              />
              <KpiCard
                title="Amount Received"
                value={kpis.grn.amountReceived}
                formatter={(n) => formatCurrency(n, true)}
                icon={CircleDollarSign}
                tooltip="Sum of AMOUNT_RECEIVED from po2grn"
                accent="bg-[#2f7ec4]"
                gauge={Math.min(100, kpis.grn.fulfillmentRate)}
                deltaLabel={`${Math.round(kpis.grn.fulfillmentRate)}% qty fulfill`}
                delay={0.08}
              />
              <KpiCard
                title="Avg PO → GRN Days"
                value={kpis.grn.avgPoToGrnDays ?? 0}
                formatter={(n) => (n ? `${n.toFixed(1)}d` : "—")}
                icon={Timer}
                tooltip="Average calendar days from PO_DATE to GRN_DATE"
                accent="bg-[#fff200]"
                gaugeColor="#d4a800"
                gauge={kpis.grn.avgPoToGrnDays != null ? Math.min(100, kpis.grn.avgPoToGrnDays * 2) : 0}
                deltaLabel={
                  kpis.grn.posWithoutGrn > 0
                    ? `${formatNumber(kpis.grn.posWithoutGrn)} POs no GRN`
                    : "All POs received"
                }
                delay={0.12}
                onClick={
                  kpis.grn.posWithoutGrn > 0
                    ? () => pushDrill({ level: "grnLinkage", value: "withoutGrn", label: "POs without GRN" })
                    : undefined
                }
              />
            </div>
          </section>
        ) : null}
      </PermissionGate>

      <PermissionGate anyOf={["chart-grn-funnel", "chart-po-to-grn-aging", "chart-grn-receiving-org", "chart-grn-monthly", "chart-grn-vendors", "chart-grn-quality"]}>
      <section id="jump-grn-charts" className="scroll-mt-24">
        <div className="mb-3 flex items-start gap-3">
          <ChartIconBadge icon={Package} tone="green" className="h-8 w-8 rounded-lg" />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
              PO → GRN Analysis
            </h2>
            <p className="text-xs text-[#6d8499]">Submitted → Approved → Receipt → Received → Accepted → Delivered → Fully received</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <PermissionGate permission="chart-grn-funnel">
          {grn ? (
            <GrnFunnelChart
              data={grn.funnel}
              onStageClick={() => pushDrill({ level: "grnLinkage", value: "withGrn", label: "GRN pipeline" })}
            />
          ) : (
            <Skeleton className="h-95 w-full" />
          )}
          </PermissionGate>
          <PermissionGate permission="chart-po-to-grn-aging">
          {spend?.poToGrnAging ? (
            <PoToGrnAgingChart
              data={spend.poToGrnAging}
              onClick={(bucket) => pushDrill({ level: "poToGrnAging", value: bucket, label: `PO→GRN: ${bucket}` })}
            />
          ) : grn ? (
            <PoToGrnAgingChart
              data={grn.aging}
              onClick={(bucket) => pushDrill({ level: "poToGrnAging", value: bucket, label: `PO→GRN: ${bucket}` })}
            />
          ) : (
            <Skeleton className="h-95 w-full" />
          )}
          </PermissionGate>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <PermissionGate permission="chart-grn-receiving-org">
          {grn ? (
            <GrnReceivingOrgChart
              data={grn.byReceivingOrg}
              onClick={(org) => pushDrill({ level: "receivingOrg", value: org, label: org })}
            />
          ) : (
            <Skeleton className="h-95 w-full" />
          )}
          </PermissionGate>
          <PermissionGate permission="chart-grn-monthly">
          {grn ? (
            <GrnMonthlyChart data={grn.monthly} />
          ) : (
            <Skeleton className="h-95 w-full" />
          )}
          </PermissionGate>
          <PermissionGate permission="chart-grn-vendors">
          {grn ? (
            <GrnVendorChart
              data={grn.vendors}
              onClick={(id, name) => pushDrill({ level: "vendor", value: id, label: name || `Vendor ${id}` })}
            />
          ) : (
            <Skeleton className="h-95 w-full" />
          )}
          </PermissionGate>
        </div>
        <PermissionGate permission="chart-grn-quality">
        {grn?.returnReject ? (
          <div className="mt-4">
            <GrnReturnRejectChart
              data={grn.returnReject}
              onBucketClick={(key, label) =>
                pushDrill({ level: "grnReturnStatus", value: key, label: `GRN: ${label}` })
              }
              onVendorClick={(id, name) =>
                pushDrill({ level: "vendor", value: id, label: name || `Vendor ${id}` })
              }
            />
          </div>
        ) : (
          <Skeleton className="mt-4 h-80 w-full" />
        )}
        </PermissionGate>
      </section>
      </PermissionGate>
      </>
      )}

      {showAnalytics && (
      <div className="space-y-6">
      <section id="jump-funnel" className="scroll-mt-24 grid gap-4 lg:grid-cols-2">
        <PermissionGate permission="chart-funnel">
        {spend ? (
          <FunnelChart
            data={spend.funnel}
            onStageClick={(stage) => {
              const s = stage.toLowerCase();
              if (s.includes("approv")) {
                pushDrill({ level: "approvalStatus", value: "APPROVED", label: stage });
              } else if (s.includes("grn") || s.includes("goods received")) {
                pushDrill({ level: "grnLinkage", value: "withGrn", label: stage });
              } else if (s.includes("requisition")) {
                pushDrill({ level: "overview", value: "ALL", label: stage });
              } else if (s.includes("order")) {
                pushDrill({ level: "overview", value: "ALL", label: stage });
              } else {
                pushDrill({ level: "overview", value: "ALL", label: stage });
              }
            }}
          />
        ) : (
          <Skeleton className="h-95 w-full" />
        )}
        </PermissionGate>
        <PermissionGate permission="chart-approval-status">
        <div id="jump-approval" className="scroll-mt-24">
        {spend ? (
          <ApprovalDonut
            data={spend.approvalStatus}
            onSliceClick={(name) =>
              pushDrill({
                level: "approvalStatus",
                value: name.toUpperCase(),
                label: name,
              })
            }
          />
        ) : (
          <Skeleton className="h-95 w-full" />
        )}
        </div>
        </PermissionGate>
      </section>

      <section id="jump-creators" className="scroll-mt-24 grid gap-4 lg:grid-cols-3">
        <PermissionGate permission="chart-top-pr-creators">
        {prQ.data ? (
          <HorizontalBarChartCard
            title="Top PR Creators"
            description="Click a bar · Unique REQ_NO by creator"
            data={prQ.data.data}
            valueLabel="PRs"
            icon={UserPen}
            iconTone="blue"
            onBarClick={(name) => pushDrill({ level: "prCreator", value: name, label: `PR: ${name}` })}
          />
        ) : (
          <Skeleton className="h-95 w-full" />
        )}
        </PermissionGate>
        <PermissionGate permission="chart-top-po-creators">
        {poQ.data ? (
          <HorizontalBarChartCard
            title="Top PO Creators"
            description="Click a bar · Unique PO_NO by creator"
            data={poQ.data.data}
            valueLabel="POs"
            icon={PackageCheck}
            iconTone="red"
            onBarClick={(name) => pushDrill({ level: "poCreator", value: name, label: `PO: ${name}` })}
          />
        ) : (
          <Skeleton className="h-95 w-full" />
        )}
        </PermissionGate>
        <PermissionGate permission="chart-top-approvers">
        {apprQ.data ? (
          <HorizontalBarChartCard
            title="Top Final Approvers"
            description="Click a bar · Approved POs by final approver (APPROVER_FINAL)"
            data={apprQ.data.data}
            valueLabel="Approved POs"
            icon={ShieldCheck}
            iconTone="green"
            onBarClick={(name) => pushDrill({ level: "approver", value: name, label: `Final approver: ${name}` })}
          />
        ) : (
          <Skeleton className="h-95 w-full" />
        )}
        </PermissionGate>
      </section>

      <section id="jump-dept-legal" className="scroll-mt-24 grid gap-4 lg:grid-cols-2">
        <PermissionGate permission="chart-dept-spend">
        {deptQ.data ? (
          <DepartmentSpendChart
            data={deptQ.data.data.spend}
            onClick={(dept) => pushDrill({ level: "department", value: dept, label: dept })}
          />
        ) : (
          <Skeleton className="h-95 w-full" />
        )}
        </PermissionGate>
        <PermissionGate permission="chart-legal-entity">
        {legalQ.data ? (
          <LegalEntityChart
            data={legalQ.data.data}
            onClick={(name) => pushDrill({ level: "organization", value: name, label: name })}
          />
        ) : (
          <Skeleton className="h-95 w-full" />
        )}
        </PermissionGate>
      </section>

      <section id="jump-trends" className="scroll-mt-24 grid gap-4 lg:grid-cols-2">
        <PermissionGate permission="chart-monthly-trend">
        {spend ? (
          <MonthlyTrendChart
            data={spend.monthly}
            onMonthClick={(month) => pushDrill({ level: "month", value: month, label: `Month ${month}` })}
          />
        ) : (
          <Skeleton className="h-95 w-full" />
        )}
        </PermissionGate>
        <PermissionGate permission="chart-spend-analysis">
        <div id="jump-spend" className="scroll-mt-24">
        {spend ? (
          <SpendAreaChart
            data={spend.monthly}
            onMonthClick={(month) => pushDrill({ level: "month", value: month, label: `Month ${month}` })}
          />
        ) : (
          <Skeleton className="h-95 w-full" />
        )}
        </div>
        </PermissionGate>
      </section>

      <PermissionGate anyOf={["chart-purchase-type-mix", "chart-purchase-type-volume"]}>
      <section id="jump-purchase-type" className="scroll-mt-24">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
          Purchase Type Analysis
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <PermissionGate permission="chart-purchase-type-mix">
          {purchaseTypeQ.data ? (
            <PurchaseTypeChart
              data={purchaseTypeQ.data.data}
              onClick={(name) =>
                pushDrill({ level: "purchaseType", value: name, label: `Type: ${name}` })
              }
            />
          ) : (
            <Skeleton className="h-95 w-full" />
          )}
          </PermissionGate>
          <PermissionGate permission="chart-purchase-type-volume">
          {purchaseTypeQ.data ? (
            <PurchaseTypeVolumeChart
              data={purchaseTypeQ.data.data}
              onClick={(name) =>
                pushDrill({ level: "purchaseType", value: name, label: `Type: ${name}` })
              }
            />
          ) : (
            <Skeleton className="h-95 w-full" />
          )}
          </PermissionGate>
        </div>
      </section>
      </PermissionGate>

      <PermissionGate anyOf={["chart-po-revision-count", "chart-po-revision-linkage", "chart-most-revised-pos"]}>
      <section id="jump-revisions" className="scroll-mt-24">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
          PO Revision Analysis
        </h2>
        {revisions ? (
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Unique POs",
                value: formatNumber(revisions.summary.totalPOs),
                hint: "With PO number",
                onClick: undefined as (() => void) | undefined,
              },
              {
                label: "Revised POs",
                value: formatNumber(revisions.summary.revisedPOs),
                hint: `${formatNumber(revisions.summary.totalRevisionEvents)} total revisions`,
                onClick: () =>
                  pushDrill({ level: "poRevised", value: "revised", label: "Revised POs (1+)" }),
              },
              {
                label: "Revised · With PR",
                value: formatNumber(revisions.summary.withPr.revised),
                hint: `of ${formatNumber(revisions.summary.withPr.total)} PR-linked POs`,
                onClick: () => {
                  pushDrill({ level: "poRevised", value: "revised", label: "Revised POs (1+)" });
                  pushDrill({ level: "poLinkage", value: "withPr", label: "POs with PR" });
                },
              },
              {
                label: "Revised · Without PR",
                value: formatNumber(revisions.summary.withoutPr.revised),
                hint: `of ${formatNumber(revisions.summary.withoutPr.total)} non-PR POs`,
                onClick: () => {
                  pushDrill({ level: "poRevised", value: "revised", label: "Revised POs (1+)" });
                  pushDrill({ level: "poLinkage", value: "withoutPr", label: "POs without PR" });
                },
              },
            ].map((card) => (
              <button
                key={card.label}
                type="button"
                disabled={!card.onClick}
                onClick={card.onClick}
                className="rounded-xl border border-[#0055a5]/12 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-[#0055a5]/35 disabled:cursor-default dark:border-white/10 dark:bg-[#0f1c30]"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#6d8499]">{card.label}</div>
                <div className="mt-0.5 text-xl font-extrabold tabular-nums text-[#0055a5] dark:text-[#7eb6e8]">
                  {card.value}
                </div>
                <div className="text-[11px] font-medium text-[#6d8499] dark:text-[#9aa8b8]">{card.hint}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-3">
          <PermissionGate permission="chart-po-revision-count">
          {revisions ? (
            <PoRevisionBucketChart
              data={revisions.buckets}
              onBucketClick={(bucket) =>
                pushDrill({
                  level: "poRevised",
                  value: bucket,
                  label: bucket === "0" ? "Never revised" : `Revised ${bucket}×`,
                })
              }
            />
          ) : (
            <Skeleton className="h-95 w-full" />
          )}
          </PermissionGate>
          <PermissionGate permission="chart-po-revision-linkage">
          {revisions ? (
            <PoRevisionLinkageChart
              summary={revisions.summary}
              onClick={(linkage) =>
                pushDrill({
                  level: "poLinkage",
                  value: linkage,
                  label: linkage === "withPr" ? "POs with PR" : "POs without PR",
                })
              }
            />
          ) : (
            <Skeleton className="h-95 w-full" />
          )}
          </PermissionGate>
          <PermissionGate permission="chart-most-revised-pos">
          {revisions ? (
            <PoRevisionTopChart
              data={revisions.topRevised}
              onClick={(poNo) => pushDrill({ level: "poNo", value: poNo, label: `PO #${poNo}` })}
            />
          ) : (
            <Skeleton className="h-95 w-full" />
          )}
          </PermissionGate>
        </div>
      </section>
      </PermissionGate>

      <section id="jump-vendors" className="scroll-mt-24 grid gap-4 lg:grid-cols-2">
        <PermissionGate permission="chart-vendor-analysis">
        {vendorQ.data ? (
          <VendorChart
            data={vendorQ.data.data}
            onClick={(id, name) =>
              pushDrill({ level: "vendor", value: id, label: name || `Vendor ${id}` })
            }
          />
        ) : (
          <Skeleton className="h-95" />
        )}
        </PermissionGate>
        <PermissionGate permission="chart-procurement-aging">
        <div id="jump-aging" className="scroll-mt-24">
        {spend ? (
          <AgingChart
            data={spend.aging}
            onClick={(bucket) => pushDrill({ level: "aging", value: bucket, label: `Aging: ${bucket}` })}
          />
        ) : (
          <Skeleton className="h-95" />
        )}
        </div>
        </PermissionGate>
      </section>

      <PermissionGate permission="chart-dept-performance">
        <div id="jump-dept-performance" className="scroll-mt-24">
          {deptQ.data && <DepartmentPerformanceCards data={deptQ.data.data.performance} />}
        </div>
      </PermissionGate>
      </div>
      )}

      {showRisk && (
      <PermissionGate anyOf={["chart-split-po-watch", "table-split-po"]}>
      <section id="jump-risk" className="scroll-mt-24">
        <div className="mb-3 flex items-start gap-3">
          <ChartIconBadge icon={ShieldAlert} tone="red" className="h-8 w-8 rounded-lg" />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
              Split PO Watch
            </h2>
            <p className="text-xs text-[#6d8499]">
              Detects 15 lac orders split into 3×5 lac POs (same creator + item code within 3 days) · widen date filter for history
            </p>
          </div>
        </div>
        {splitPo ? (
          <PermissionGate permission="chart-split-po-watch">
          <SplitPoWatchChart
            data={splitPo}
            onCreatorClick={(name) => pushDrill({ level: "poCreator", value: name, label: name })}
            onItemClick={(code, desc) => pushDrill({ level: "itemCode", value: code, label: desc || code })}
          />
          </PermissionGate>
        ) : (
          <Skeleton className="h-80 w-full" />
        )}
        <PermissionGate permission="table-split-po">
        <div className="mt-4">
          <SplitPoTable />
        </div>
        </PermissionGate>
      </section>
      </PermissionGate>
      )}

      {showTables && (
      <div id="jump-tables" className="scroll-mt-24 space-y-6">
        <ConnectedDrillStrip />
        <PermissionGate permission="table-audit">
          <AuditTable />
        </PermissionGate>
        <PermissionGate permission="table-grn">
          <GrnTable />
        </PermissionGate>
      </div>
      )}

      <footer className="border-t-4 border-[#e31e24] pb-8 pt-4 text-center text-xs text-[#0055a5] dark:text-[#7eb6e8]">
        <span className="font-display font-bold tracking-tight dark:text-[#fff200]">MASTER</span>
        {" · "}Group of Industries · Since 1963 · Procurement Audit Platform
      </footer>

      <DashboardJumpFab
        activeSection={activeSection}
        visibleSectionIds={visibleSections}
        onJump={onJumpTo}
      />
      <DashboardScrollControl />
      <PermissionGate permission="feature-chatbot">
        <AuditChatBot />
      </PermissionGate>
    </div>
  );
}
