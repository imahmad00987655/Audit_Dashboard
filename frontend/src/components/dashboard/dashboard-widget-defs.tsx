"use client";

import type { UseQueryResult } from "@tanstack/react-query";
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
import type { DashboardWidgetDef } from "@/components/dashboard/dashboard-widget-grid";
import { KpiCard, CurrencySpendKpiCard } from "@/components/dashboard/kpi-cards";
import { AiInsights } from "@/components/dashboard/ai-insights";
import { DepartmentPerformanceCards } from "@/components/dashboard/department-performance";
import { AuditTable } from "@/components/dashboard/audit-table";
import { GrnTable } from "@/components/dashboard/grn-table";
import { SplitPoTable } from "@/components/dashboard/split-po-table";
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
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { DashboardFilters, DrillPath } from "@/lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any */

type WidgetBuilderArgs = {
  pushDrill: (item: DrillPath) => void;
  setFilter: (key: keyof DashboardFilters, value: string) => void;
  kpis: any;
  kpisQ: UseQueryResult<any>;
  spend: any;
  prQ: UseQueryResult<any>;
  poQ: UseQueryResult<any>;
  apprQ: UseQueryResult<any>;
  deptQ: UseQueryResult<any>;
  legalQ: UseQueryResult<any>;
  vendorQ: UseQueryResult<any>;
  purchaseTypeQ: UseQueryResult<any>;
  revisionQ: UseQueryResult<any>;
  revisions: any;
  grn: any;
  splitPo: any;
};

export function buildDashboardWidgetDefs(args: WidgetBuilderArgs): DashboardWidgetDef[] {
  const {
    pushDrill,
    setFilter,
    kpis,
    kpisQ,
    spend,
    prQ,
    poQ,
    apprQ,
    deptQ,
    legalQ,
    vendorQ,
    purchaseTypeQ,
    revisions,
    grn,
    splitPo,
  } = args;

  return [
    {
      id: "section-executive-overview",
      permission: "section-executive-overview",
      render: () => (
        <section className="h-full px-1">
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
                  pushDrill({ level: "overview", value: "ALL", label: "All Purchase Requisitions" })
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
      ),
    },
    {
      id: "section-grn-overview",
      permission: "section-grn-overview",
      render: () =>
        kpis?.grn ? (
          <section className="h-full px-1">
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
                delay={0.32}
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
                delay={0.36}
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
                delay={0.4}
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
                delay={0.44}
                onClick={
                  kpis.grn.posWithoutGrn > 0
                    ? () => pushDrill({ level: "grnLinkage", value: "withoutGrn", label: "POs without GRN" })
                    : undefined
                }
              />
            </div>
          </section>
        ) : null,
    },
    {
      id: "chart-insights",
      permission: "chart-insights",
      render: () => <AiInsights />,
    },
    {
      id: "chart-funnel",
      permission: "chart-funnel",
      render: () =>
        spend ? (
          <FunnelChart
            data={spend.funnel}
            onStageClick={(stage) => {
              const s = stage.toLowerCase();
              if (s.includes("approv")) {
                pushDrill({ level: "approvalStatus", value: "APPROVED", label: stage });
              } else if (s.includes("grn") || s.includes("goods received")) {
                pushDrill({ level: "grnLinkage", value: "withGrn", label: stage });
              } else {
                pushDrill({ level: "overview", value: "ALL", label: stage });
              }
            }}
          />
        ) : (
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-approval-status",
      permission: "chart-approval-status",
      render: () =>
        spend ? (
          <ApprovalDonut
            data={spend.approvalStatus}
            onSliceClick={(name) =>
              pushDrill({ level: "approvalStatus", value: name.toUpperCase(), label: name })
            }
          />
        ) : (
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-top-pr-creators",
      permission: "chart-top-pr-creators",
      render: () =>
        prQ.data ? (
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
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-top-po-creators",
      permission: "chart-top-po-creators",
      render: () =>
        poQ.data ? (
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
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-top-approvers",
      permission: "chart-top-approvers",
      render: () =>
        apprQ.data ? (
          <HorizontalBarChartCard
            title="Top Final Approvers"
            description="Click a bar · Approved POs by final approver (APPROVER_FINAL)"
            data={apprQ.data.data}
            valueLabel="Approved POs"
            icon={ShieldCheck}
            iconTone="green"
            onBarClick={(name) =>
              pushDrill({ level: "approver", value: name, label: `Final approver: ${name}` })
            }
          />
        ) : (
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-dept-spend",
      permission: "chart-dept-spend",
      render: () =>
        deptQ.data ? (
          <DepartmentSpendChart
            data={deptQ.data.data.spend}
            onClick={(dept) => pushDrill({ level: "department", value: dept, label: dept })}
          />
        ) : (
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-legal-entity",
      permission: "chart-legal-entity",
      render: () =>
        legalQ.data ? (
          <LegalEntityChart
            data={legalQ.data.data}
            onClick={(name) => pushDrill({ level: "organization", value: name, label: name })}
          />
        ) : (
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-monthly-trend",
      permission: "chart-monthly-trend",
      render: () =>
        spend ? (
          <MonthlyTrendChart
            data={spend.monthly}
            onMonthClick={(month) => pushDrill({ level: "month", value: month, label: `Month ${month}` })}
          />
        ) : (
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-spend-analysis",
      permission: "chart-spend-analysis",
      render: () =>
        spend ? (
          <SpendAreaChart
            data={spend.monthly}
            onMonthClick={(month) => pushDrill({ level: "month", value: month, label: `Month ${month}` })}
          />
        ) : (
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-purchase-type-mix",
      permission: "chart-purchase-type-mix",
      render: () => (
        <div className="h-full">
          <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
            Purchase Type Analysis
          </h2>
          {purchaseTypeQ.data ? (
            <PurchaseTypeChart
              data={purchaseTypeQ.data.data}
              onClick={(name) => pushDrill({ level: "purchaseType", value: name, label: `Type: ${name}` })}
            />
          ) : (
            <Skeleton className="h-full min-h-80 w-full" />
          )}
        </div>
      ),
    },
    {
      id: "chart-purchase-type-volume",
      permission: "chart-purchase-type-volume",
      render: () =>
        purchaseTypeQ.data ? (
          <PurchaseTypeVolumeChart
            data={purchaseTypeQ.data.data}
            onClick={(name) => pushDrill({ level: "purchaseType", value: name, label: `Type: ${name}` })}
          />
        ) : (
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "po-revision-summary",
      anyOf: ["chart-po-revision-count", "chart-po-revision-linkage", "chart-most-revised-pos"],
      render: () => (
        <div className="h-full px-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
            PO Revision Analysis
          </h2>
          {revisions ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#6d8499]">
                    {card.label}
                  </div>
                  <div className="mt-0.5 text-xl font-extrabold tabular-nums text-[#0055a5] dark:text-[#7eb6e8]">
                    {card.value}
                  </div>
                  <div className="text-[11px] font-medium text-[#6d8499] dark:text-[#9aa8b8]">{card.hint}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "chart-po-revision-count",
      permission: "chart-po-revision-count",
      render: () =>
        revisions ? (
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
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-po-revision-linkage",
      permission: "chart-po-revision-linkage",
      render: () =>
        revisions ? (
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
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-most-revised-pos",
      permission: "chart-most-revised-pos",
      render: () =>
        revisions ? (
          <PoRevisionTopChart
            data={revisions.topRevised}
            onClick={(poNo) => pushDrill({ level: "poNo", value: poNo, label: `PO #${poNo}` })}
          />
        ) : (
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-vendor-analysis",
      permission: "chart-vendor-analysis",
      render: () =>
        vendorQ.data ? (
          <VendorChart
            data={vendorQ.data.data}
            onClick={(id, name) => pushDrill({ level: "vendor", value: id, label: name || `Vendor ${id}` })}
          />
        ) : (
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-procurement-aging",
      permission: "chart-procurement-aging",
      render: () =>
        spend ? (
          <AgingChart
            data={spend.aging}
            onClick={(bucket) => pushDrill({ level: "aging", value: bucket, label: `Aging: ${bucket}` })}
          />
        ) : (
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-dept-performance",
      permission: "chart-dept-performance",
      render: () =>
        deptQ.data ? <DepartmentPerformanceCards data={deptQ.data.data.performance} /> : null,
    },
    {
      id: "chart-split-po-watch",
      permission: "chart-split-po-watch",
      render: () => (
        <div className="h-full px-1">
          <div className="mb-3 flex items-start gap-3">
            <ChartIconBadge icon={ShieldAlert} tone="red" className="h-8 w-8 rounded-lg" />
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
                Split PO Watch
              </h2>
              <p className="text-xs text-[#6d8499]">
                Detects 15 lac orders split into 3×5 lac POs (same creator + item code within 3 days)
              </p>
            </div>
          </div>
          {splitPo ? (
            <SplitPoWatchChart
              data={splitPo}
              onCreatorClick={(name) => pushDrill({ level: "poCreator", value: name, label: name })}
              onItemClick={(code, desc) => pushDrill({ level: "itemCode", value: code, label: desc || code })}
            />
          ) : (
            <Skeleton className="h-full min-h-72 w-full" />
          )}
        </div>
      ),
    },
    {
      id: "table-split-po",
      permission: "table-split-po",
      render: () => <SplitPoTable />,
    },
    {
      id: "chart-grn-funnel",
      permission: "chart-grn-funnel",
      render: () => (
        <div className="h-full px-1">
          <div className="mb-3 flex items-start gap-3">
            <ChartIconBadge icon={Package} tone="green" className="h-8 w-8 rounded-lg" />
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
                PO → GRN Analysis
              </h2>
              <p className="text-xs text-[#6d8499]">
                Submitted → Approved → Receipt → Received → Accepted → Delivered
              </p>
            </div>
          </div>
          {grn ? (
            <GrnFunnelChart
              data={grn.funnel}
              onStageClick={() => pushDrill({ level: "grnLinkage", value: "withGrn", label: "GRN pipeline" })}
            />
          ) : (
            <Skeleton className="h-full min-h-80 w-full" />
          )}
        </div>
      ),
    },
    {
      id: "chart-po-to-grn-aging",
      permission: "chart-po-to-grn-aging",
      render: () =>
        spend?.poToGrnAging ? (
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
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-grn-receiving-org",
      permission: "chart-grn-receiving-org",
      render: () =>
        grn ? (
          <GrnReceivingOrgChart
            data={grn.byReceivingOrg}
            onClick={(org) => pushDrill({ level: "receivingOrg", value: org, label: org })}
          />
        ) : (
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-grn-monthly",
      permission: "chart-grn-monthly",
      render: () =>
        grn ? <GrnMonthlyChart data={grn.monthly} /> : <Skeleton className="h-full min-h-80 w-full" />,
    },
    {
      id: "chart-grn-vendors",
      permission: "chart-grn-vendors",
      render: () =>
        grn ? (
          <GrnVendorChart
            data={grn.vendors}
            onClick={(id, name) => pushDrill({ level: "vendor", value: id, label: name || `Vendor ${id}` })}
          />
        ) : (
          <Skeleton className="h-full min-h-80 w-full" />
        ),
    },
    {
      id: "chart-grn-quality",
      permission: "chart-grn-quality",
      render: () =>
        grn?.returnReject ? (
          <GrnReturnRejectChart
            data={grn.returnReject}
            onBucketClick={(key, label) =>
              pushDrill({ level: "grnReturnStatus", value: key, label: `GRN: ${label}` })
            }
            onVendorClick={(id, name) =>
              pushDrill({ level: "vendor", value: id, label: name || `Vendor ${id}` })
            }
          />
        ) : (
          <Skeleton className="h-full min-h-72 w-full" />
        ),
    },
    {
      id: "table-audit",
      permission: "table-audit",
      render: () => <AuditTable />,
    },
    {
      id: "table-grn",
      permission: "table-grn",
      render: () => <GrnTable />,
    },
  ];
}
