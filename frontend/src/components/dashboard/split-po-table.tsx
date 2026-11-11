"use client";

import { Fragment, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ShieldAlert } from "lucide-react";
import { api, type SplitPoCluster } from "@/lib/api";
import { useDashboard } from "@/context/dashboard-context";
import { useDeferredReady } from "@/hooks/use-deferred-ready";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/input";
import { ChartIconBadge } from "@/components/dashboard/charts";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function RiskBadge({ level }: { level: SplitPoCluster["riskLevel"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        level === "high"
          ? "bg-[#e31e24]/12 text-[#e31e24]"
          : "bg-[#d4a800]/15 text-[#9a7600] dark:text-[#fff200]"
      )}
    >
      {level === "high" ? "High risk" : "Medium"}
    </span>
  );
}

export function SplitPoTable() {
  const { filters, pushDrill } = useDashboard();
  const tablesReady = useDeferredReady(900);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setExpanded(null);
  }, [filters]);

  const { data, isLoading, isFetching, isPending } = useQuery({
    queryKey: ["split-po-table", filters, page, pageSize],
    queryFn: () => api.splitPoTable(filters, page, pageSize),
    enabled: tablesReady,
  });
  const tableLoading = !tablesReady || isLoading || isPending;

  const rows = data?.data || [];
  const pagination = data?.pagination;

  return (
    <Card id="split-po-table" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-start gap-3">
          <ChartIconBadge icon={ShieldAlert} tone="red" />
          <div>
            <CardTitle>Split PO Suspicious Clusters</CardTitle>
            <p className="text-xs text-[#6d8499]">
              Same PO creator + item code within 3 days exceeding COO 5 lac limit · expand row for PO details
              {isFetching ? " · refreshing…" : ""}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto rounded-xl border border-[#0055a5]/15">
          <table className="min-w-280 w-full border-collapse text-left text-xs">
            <thead className="bg-[#eef5fc]/95 dark:bg-[#152a45]/95">
              <tr>
                {[
                  "",
                  "Risk",
                  "PO Creator",
                  "Item Code",
                  "Vendor",
                  "Window",
                  "POs",
                  "Total (PKR)",
                  "Excess (PKR)",
                  "Approvers",
                ].map((h) => (
                  <th key={h || "exp"} className="whitespace-nowrap px-3 py-2.5 font-semibold text-[#6d8499]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={10} className="px-3 py-2">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : rows.map((row) => {
                    const open = expanded === row.id;
                    return (
                      <Fragment key={row.id}>
                        <tr className="border-t border-[#0055a5]/10 hover:bg-[#eef5fc] dark:border-white/5 dark:hover:bg-[#152a45]">
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              className="rounded p-1 text-[#6d8499] hover:bg-white hover:text-[#0055a5]"
                              onClick={() => setExpanded(open ? null : row.id)}
                              aria-label={open ? "Collapse" : "Expand PO list"}
                            >
                              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <RiskBadge level={row.riskLevel} />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="font-medium text-[#0055a5] hover:underline"
                              onClick={() =>
                                pushDrill({ level: "poCreator", value: row.creator, label: row.creator })
                              }
                            >
                              {row.creator}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="font-mono text-[11px] text-[#0055a5] hover:underline"
                              onClick={() =>
                                pushDrill({
                                  level: "itemCode",
                                  value: row.itemCode,
                                  label: row.itemCode,
                                })
                              }
                            >
                              {row.itemCode}
                            </button>
                            <div className="max-w-45 truncate text-[10px] text-[#6d8499]">{row.itemDesc}</div>
                          </td>
                          <td className="max-w-40 truncate px-3 py-2">{row.vendorName || "—"}</td>
                          <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                            {fmtDate(row.windowStart)} – {fmtDate(row.windowEnd)}
                          </td>
                          <td className="px-3 py-2 tabular-nums font-semibold">{row.poCount}</td>
                          <td className="px-3 py-2 tabular-nums">{formatCurrency(row.totalAmountPkr)}</td>
                          <td className="px-3 py-2 tabular-nums font-semibold text-[#e31e24]">
                            {formatCurrency(row.excessAmountPkr)}
                          </td>
                          <td className="max-w-36 truncate px-3 py-2 text-[10px]">{row.approvers.join(", ") || "—"}</td>
                        </tr>
                        {open && (
                          <tr className="border-t border-[#0055a5]/8 bg-[#f8fbff] dark:bg-[#0a1528]/50">
                            <td colSpan={10} className="px-4 py-3">
                              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#6d8499]">
                                PO breakdown · max single PO {formatCurrency(row.maxSinglePoPkr)} · limit{" "}
                                {formatCurrency(row.approvalLimitPkr)}
                              </div>
                              <div className="overflow-auto rounded-lg border border-[#0055a5]/10">
                                <table className="w-full text-xs">
                                  <thead className="bg-white/80 dark:bg-[#0f1c30]">
                                    <tr>
                                      {["PO No", "PO Date", "Amount (PKR)", "Currency", "Approver", "Status"].map(
                                        (h) => (
                                          <th key={h} className="px-3 py-2 text-left font-semibold text-[#6d8499]">
                                            {h}
                                          </th>
                                        )
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.pos.map((p) => (
                                      <tr key={p.poNo} className="border-t border-[#0055a5]/8">
                                        <td className="px-3 py-2">
                                          <button
                                            type="button"
                                            className="font-medium text-[#0055a5] hover:underline"
                                            onClick={() =>
                                              pushDrill({ level: "poNo", value: p.poNo, label: `PO #${p.poNo}` })
                                            }
                                          >
                                            {p.poNo}
                                          </button>
                                        </td>
                                        <td className="px-3 py-2 tabular-nums">{fmtDate(p.poCreationDate)}</td>
                                        <td className="px-3 py-2 tabular-nums">{formatCurrency(p.amountPkr)}</td>
                                        <td className="px-3 py-2">{p.currency}</td>
                                        <td className="px-3 py-2">{p.approverName || "—"}</td>
                                        <td className="px-3 py-2">{p.poApproved ? "Approved" : "Pending"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
              {!tableLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-16 text-center text-[#6d8499]">
                    No split PO patterns in the current date filter. Widen From/To dates to scan historical data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#6d8499]">
            Page {pagination?.page || page} of {pagination?.totalPages || 1} ·{" "}
            {formatNumber(pagination?.total || 0)} suspicious clusters
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination || page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
