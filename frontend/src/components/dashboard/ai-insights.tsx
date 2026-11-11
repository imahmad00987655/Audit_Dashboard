"use client";

import { useQuery } from "@tanstack/react-query";
import { Brain, Lightbulb, AlertTriangle, Users, Building2, Clock, Package, Warehouse, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useDashboard } from "@/context/dashboard-context";
import { useDeferredReady } from "@/hooks/use-deferred-ready";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/input";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

export function AiInsights() {
  const { filters } = useDashboard();
  const ready = useDeferredReady(200);
  const { data, isLoading, isPending } = useQuery({
    queryKey: ["insights", filters],
    queryFn: () => api.insights(filters),
    enabled: ready,
  });

  const insights = data?.data;

  if (!ready || isLoading || isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-[#0055a5]" /> Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  const cards = [
    {
      icon: Users,
      title: "Highest PR Creator",
      body: insights.highestPRCreator
        ? `${insights.highestPRCreator.name} created ${formatNumber(insights.highestPRCreator.count)} unique PRs`
        : "No data",
    },
    {
      icon: Users,
      title: "Highest PO Creator",
      body: insights.highestPOCreator
        ? `${insights.highestPOCreator.name} created ${formatNumber(insights.highestPOCreator.count)} unique POs`
        : "No data",
    },
    {
      icon: Building2,
      title: "Highest Procurement Dept",
      body: insights.highestProcurementDepartment
        ? `${insights.highestProcurementDepartment.name} · ${formatNumber(insights.highestProcurementDepartment.prCount)} PRs / ${formatNumber(insights.highestProcurementDepartment.poCount)} POs`
        : "No data",
    },
    {
      icon: Lightbulb,
      title: "Highest Spend Department",
      body: insights.highestSpendDepartment
        ? `${insights.highestSpendDepartment.name} · ${formatCurrency(insights.highestSpendDepartment.spend)}`
        : "No data",
    },
    {
      icon: Building2,
      title: "Top Entity",
      body: insights.maxProcurementOrganization
        ? `${insights.maxProcurementOrganization.name} · ${formatCurrency(insights.maxProcurementOrganization.spend)}`
        : "No data",
    },
    {
      icon: Clock,
      title: "Pending Approvals",
      body: `${formatNumber(insights.pendingApprovalSummary.pendingPOs)} pending · ${formatPercent(insights.pendingApprovalSummary.approvalRate)} approval rate`,
    },
    {
      icon: AlertTriangle,
      title: "Procurement Bottlenecks",
      body: insights.bottlenecks.message,
    },
    {
      icon: Brain,
      title: "Approval Delay Insight",
      body: `${insights.approvalDelayInsights.recommendation} (${formatPercent(insights.approvalDelayInsights.avgPendingShare)} pending share)`,
    },
  ];

  if (insights.grn) {
    const g = insights.grn;
    cards.push(
      {
        icon: Package,
        title: "PO → GRN Bottleneck",
        body: g.poToGrnBottleneck.message,
      },
      {
        icon: Warehouse,
        title: "Top Receiving Org",
        body: g.topReceivingOrg
          ? `${g.topReceivingOrg.org} · ${formatCurrency(g.topReceivingOrg.amountReceived)} received`
          : "No GRN data",
      },
      {
        icon: Package,
        title: "GRN Fulfillment",
        body: `${formatPercent(g.fulfillmentInsight.rate)} qty fulfillment · ${g.fulfillmentInsight.recommendation}`,
      },
      {
        icon: AlertTriangle,
        title: "Slow GRN Vendor",
        body: g.slowestGrnVendor
          ? `${g.slowestGrnVendor.vendorName} avg ${g.slowestGrnVendor.avgDays} days PO→GRN`
          : "No slow vendor pattern detected",
      }
    );
  }

  if (insights.splitPo?.length) {
    for (const s of insights.splitPo.slice(0, 3)) {
      cards.push({
        icon: ShieldAlert,
        title: s.title,
        body: s.message,
      });
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b-4 border-[#fff200] bg-[#0055a5] px-5 py-4 text-white">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Brain className="h-4 w-4 text-[#fff200]" />
          Insights
        </div>
      </div>
      <CardContent className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-xl border border-[#0055a5]/10 bg-[#eef5fc] p-3 dark:border-[#0055a5]/15 dark:bg-[#152a45]"
          >
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#0055a5] dark:text-[#7eb6e8]">
              <c.icon className="h-3.5 w-3.5" />
              {c.title}
            </div>
            <p className="text-sm leading-relaxed text-[#2a4a6e] dark:text-[#e8f1fa]">{c.body}</p>
          </div>
        ))}
        <div className="rounded-xl border border-[#0055a5]/10 bg-[#eef5fc] p-3 md:col-span-2 xl:col-span-4 dark:border-[#0055a5]/15 dark:bg-[#0055a5]/20">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6d8499]">
            Top 10 Procurement Users
          </div>
          <div className="flex flex-wrap gap-2">
            {(insights.topProcurementUsers || []).map((u) => (
              <span
                key={u.name}
                className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-[#0055a5] shadow-sm dark:bg-[#0f1c30] dark:text-[#7eb6e8]"
              >
                {u.name} · {u.prs} PR / {u.pos} PO
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
