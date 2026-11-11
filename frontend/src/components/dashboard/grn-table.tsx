"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ArrowUpDown, PackageCheck } from "lucide-react";
import { api, type GrnRow } from "@/lib/api";
import { useDashboard } from "@/context/dashboard-context";
import { useDeferredReady } from "@/hooks/use-deferred-ready";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/input";
import { ChartIconBadge } from "@/components/dashboard/charts";
import { cn, formatCurrency, formatForeignAmount, formatNumber } from "@/lib/utils";

const COLUMNS: { key: keyof GrnRow; label: string }[] = [
  { key: "PO_NO", label: "PO No" },
  { key: "PO_DATE", label: "PO Date" },
  { key: "VENDOR_NAME", label: "Vendor" },
  { key: "ITEM_CODE", label: "Item Code" },
  { key: "ITEM_DESC", label: "Item" },
  { key: "PO_QTY", label: "PO Qty" },
  { key: "PO_AMT", label: "PO Amt" },
  { key: "GRN_QTY", label: "GRN Qty" },
  { key: "RECEIVE_QTY", label: "Received" },
  { key: "ACCEPT_QTY", label: "Accepted" },
  { key: "DELIVER_QTY", label: "Delivered" },
  { key: "RETURN_QTY", label: "Return" },
  { key: "AMOUNT_RECEIVED", label: "Amt Received" },
  { key: "CURRENCY_CODE", label: "Curr" },
  { key: "RECEIPT_NUM", label: "Receipt #" },
  { key: "CREATION_DATE_RECEIPT", label: "Receipt Created" },
  { key: "GRN_DATE", label: "GRN Date" },
  { key: "ORG_RECEIVING_RSL", label: "Receiving Org" },
  { key: "USER_NAME", label: "GRN User" },
  { key: "SUBMIT_NAME", label: "Submitted By" },
  { key: "APPROVER_NAME", label: "Approver" },
  { key: "PO_TO_GRN_DAYS", label: "PO→GRN Days" },
  { key: "BACKDATED_DAYS", label: "Backdated" },
  { key: "PO_APPROVE", label: "PO Status" },
  { key: "PO_SUBMIT", label: "Submit" },
  { key: "PO_FORWARD", label: "Forward" },
];

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function GrnTable() {
  const { filters, pushDrill } = useDashboard();
  const tablesReady = useDeferredReady(800);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [sortBy, setSortBy] = useState<keyof GrnRow>("GRN_DATE");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const { data, isLoading, isFetching, isPending } = useQuery({
    queryKey: ["grn-table", filters, page, pageSize, sortBy, sortDir],
    queryFn: () => api.grnTable(filters, page, pageSize, sortBy, sortDir),
    enabled: tablesReady,
  });
  const tableLoading = !tablesReady || isLoading || isPending;

  const rows = data?.data || [];
  const pagination = data?.pagination;

  const toggleSort = (key: keyof GrnRow) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const renderCell = (row: GrnRow, key: keyof GrnRow) => {
    switch (key) {
      case "PO_NO":
        return row.PO_NO ? (
          <button
            type="button"
            className="font-medium text-[#0055a5] hover:underline"
            onClick={() => pushDrill({ level: "poNo", value: String(row.PO_NO), label: `PO #${row.PO_NO}` })}
          >
            {row.PO_NO}
          </button>
        ) : (
          "—"
        );
      case "PO_DATE":
      case "GRN_DATE":
      case "CREATION_DATE_RECEIPT":
        return fmtDate(row[key] as string);
      case "VENDOR_NAME":
        return (
          <button
            type="button"
            className="hover:text-[#0055a5] hover:underline"
            onClick={() =>
              pushDrill({ level: "vendor", value: String(row.VENDOR_ID), label: row.VENDOR_NAME || String(row.VENDOR_ID) })
            }
          >
            {row.VENDOR_NAME || row.VENDOR_ID || "—"}
          </button>
        );
      case "RECEIPT_NUM":
        return row.RECEIPT_NUM ? (
          <button
            type="button"
            className="font-medium text-[#0055a5] hover:underline"
            onClick={() => pushDrill({ level: "receiptNum", value: String(row.RECEIPT_NUM), label: `Receipt #${row.RECEIPT_NUM}` })}
          >
            {row.RECEIPT_NUM}
          </button>
        ) : (
          "—"
        );
      case "ORG_RECEIVING_RSL":
        return row.ORG_RECEIVING_RSL ? (
          <button
            type="button"
            className="hover:text-[#0055a5] hover:underline"
            onClick={() =>
              pushDrill({ level: "receivingOrg", value: row.ORG_RECEIVING_RSL, label: row.ORG_RECEIVING_RSL })
            }
          >
            {row.ORG_RECEIVING_RSL}
          </button>
        ) : (
          "—"
        );
      case "AMOUNT_RECEIVED": {
        const code = String(row.CURRENCY_CODE || "PKR").trim().toUpperCase() || "PKR";
        const amt = Number(row.AMOUNT_RECEIVED) || 0;
        return code === "PKR" ? formatCurrency(amt) : formatForeignAmount(amt, code);
      }
      case "PO_QTY":
      case "GRN_QTY":
      case "RECEIVE_QTY":
      case "ACCEPT_QTY":
      case "DELIVER_QTY":
      case "RETURN_QTY":
      case "BACKDATED_DAYS":
      case "PO_TO_GRN_DAYS": {
        const n = row[key];
        return n != null ? formatNumber(Number(n)) : "—";
      }
      case "PO_AMT": {
        const code = String(row.CURRENCY_CODE || "PKR").trim().toUpperCase() || "PKR";
        const amt = Number(row.PO_AMT) || 0;
        return code === "PKR" ? formatCurrency(amt) : formatForeignAmount(amt, code);
      }
      default:
        return String(row[key] ?? "—");
    }
  };

  return (
    <Card id="grn-table" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-start gap-3">
          <ChartIconBadge icon={PackageCheck} tone="green" />
          <div>
            <CardTitle>PO → GRN Data Table</CardTitle>
            <p className="text-xs text-[#6d8499]">
              Goods receipt lines from po2grn API · connected to global filters
              {isFetching ? " · refreshing…" : ""}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-140 overflow-auto rounded-xl border border-[#0055a5]/15">
          <table className="min-w-360 w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[#eef5fc]/95 backdrop-blur dark:bg-[#152a45]/95">
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-3 py-2.5 font-semibold text-[#6d8499]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-[#0055a5]"
                      onClick={() => toggleSort(c.key)}
                    >
                      {c.label}
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={COLUMNS.length} className="px-3 py-2">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                : rows.map((row, idx) => (
                    <tr
                      key={`${row.PO_NO}-${row.RECEIPT_NUM}-${idx}`}
                      className="border-t border-[#0055a5]/10 transition hover:bg-[#eef5fc] dark:border-white/5 dark:hover:bg-[#152a45]"
                    >
                      {COLUMNS.map((c) => (
                        <td
                          key={c.key}
                          className={cn(
                            "px-3 py-2",
                            (c.key.includes("QTY") || c.key.includes("AMT") || c.key.includes("DAYS")) &&
                              "whitespace-nowrap tabular-nums"
                          )}
                        >
                          {renderCell(row, c.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
              {!tableLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-16 text-center text-[#6d8499]">
                    No GRN records match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#6d8499]">
            Showing {rows.length} on this page · Page {pagination?.page || page} of {pagination?.totalPages || 1} ·{" "}
            {(pagination?.total || 0).toLocaleString()} GRN lines
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
