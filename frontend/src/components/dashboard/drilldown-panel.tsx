"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, X } from "lucide-react";
import { api } from "@/lib/api";
import { useDashboard } from "@/context/dashboard-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/input";

/** Connected drill strip — keeps charts + table in sync; deepen drill from here */
export function ConnectedDrillStrip() {
  const { drillPath, activeDrill, filters, pushDrill, popDrill, clearDrill } = useDashboard();

  const { data, isLoading } = useQuery({
    queryKey: ["drilldown-strip", filters, activeDrill?.level, activeDrill?.value],
    queryFn: () =>
      api.drilldown(filters, activeDrill?.level || "overview", activeDrill?.value || "ALL"),
    enabled: drillPath.length > 0,
  });

  if (!drillPath.length) return null;

  const payload = data?.data as {
    kpis?: {
      totalPurchaseRequisitions: number;
      totalPurchaseOrders: number;
      approvedPurchaseOrders: number;
      pendingPurchaseOrders: number;
      totalSpend: number;
    };
    prCreators?: { name: string; count: number }[];
    poCreators?: { name: string; count: number }[];
  };

  return (
    <Card className="border-[#0055a5]/30 bg-[#eef5fc] dark:bg-[#0055a5]/20">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-[#0055a5] dark:text-[#7eb6e8]">
            Connected drill-down
          </span>
          <span className="text-xs text-[#6d8499]">· all charts + table update together</span>
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-[#0055a5] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#2f7ec4]"
            onClick={() =>
              document.getElementById("audit-table")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            Go to table
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[#e31e24] hover:bg-white"
            onClick={clearDrill}
          >
            <X className="h-3 w-3" /> Clear path
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="rounded-md bg-white px-2 py-1 text-xs font-bold text-[#0055a5] shadow-sm"
            onClick={clearDrill}
          >
            All
          </button>
          {drillPath.map((d, i) => (
            <div key={`${d.level}-${d.value}-${i}`} className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-[#6d8499]" />
              <button
                type="button"
                className="rounded-md bg-[#0055a5] px-2 py-1 text-xs font-bold text-white"
                onClick={() => popDrill(i)}
                title="Go back to this level"
              >
                {d.label}
              </button>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {[
              { label: "PRs", value: formatNumber(payload?.kpis?.totalPurchaseRequisitions || 0) },
              { label: "POs", value: formatNumber(payload?.kpis?.totalPurchaseOrders || 0) },
              { label: "Approved", value: formatNumber(payload?.kpis?.approvedPurchaseOrders || 0) },
              { label: "Pending", value: formatNumber(payload?.kpis?.pendingPurchaseOrders || 0) },
              { label: "Spend", value: formatCurrency(payload?.kpis?.totalSpend || 0, true) },
            ].map((k) => (
              <div key={k.label} className="rounded-lg bg-white p-2 shadow-sm dark:bg-[#0f1c30]">
                <div className="text-[10px] uppercase tracking-wide text-[#6d8499]">{k.label}</div>
                <div className="text-sm font-bold text-[#0055a5] dark:text-[#7eb6e8]">{k.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6d8499]">
              Drill deeper → PR Creator
            </div>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {(payload?.prCreators || []).slice(0, 15).map((p) => (
                <Button
                  key={p.name}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => pushDrill({ level: "prCreator", value: p.name, label: `PR: ${p.name}` })}
                >
                  {p.name} ({p.count})
                </Button>
              ))}
              {!payload?.prCreators?.length && !isLoading && (
                <span className="text-xs text-[#6d8499]">No further PR creators</span>
              )}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6d8499]">
              Drill deeper → PO Creator
            </div>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {(payload?.poCreators || []).slice(0, 15).map((p) => (
                <Button
                  key={p.name}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => pushDrill({ level: "poCreator", value: p.name, label: `PO: ${p.name}` })}
                >
                  {p.name} ({p.count})
                </Button>
              ))}
              {!payload?.poCreators?.length && !isLoading && (
                <span className="text-xs text-[#6d8499]">No further PO creators</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
