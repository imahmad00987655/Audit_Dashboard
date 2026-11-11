"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download, ChevronLeft, ChevronRight, ArrowUpDown, Search, X, FilterX, Table2, GripVertical, RotateCcw, CheckCircle2, Clock3, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { api, type AuditRow } from "@/lib/api";
import { useDashboard } from "@/context/dashboard-context";
import { useDeferredReady } from "@/hooks/use-deferred-ready";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/input";
import { ChartIconBadge } from "@/components/dashboard/charts";
import { cn, formatCurrency, formatForeignAmount } from "@/lib/utils";
import { toast } from "sonner";

type ColDef = { key: keyof AuditRow; label: string; placeholder?: string };

const DEFAULT_COLUMNS: ColDef[] = [
  { key: "COMP_NAME", label: "Organization", placeholder: "Company…" },
  { key: "DEPARTMENT", label: "Department", placeholder: "Dept…" },
  { key: "REQ_NO", label: "PR No", placeholder: "PR…" },
  { key: "REQ_CREADED_BY", label: "PR Creator", placeholder: "Creator…" },
  { key: "CREATION_DATE_PR", label: "PR Date", placeholder: "Date…" },
  { key: "PO_NO", label: "PO No", placeholder: "PO…" },
  { key: "PO_CREATED_BY", label: "PO Creator", placeholder: "Creator…" },
  { key: "PO_CREATION_DATE", label: "PO Date", placeholder: "Date…" },
  { key: "APPROVER_NAME", label: "Approver", placeholder: "Name…" },
  { key: "PO_APPROVE", label: "Status", placeholder: "Status…" },
  { key: "PO_AMT", label: "Amount", placeholder: "Amt…" },
  { key: "CURRENCY_CODE", label: "Currency", placeholder: "PKR…" },
  { key: "PO_EXCH_RATE", label: "Exch Rate", placeholder: "Rate…" },
  { key: "PO_EXCH_RATE_DATE", label: "Exch Date", placeholder: "Date…" },
  { key: "PURCHASE_TYPE", label: "Purchase Type", placeholder: "Type…" },
  { key: "PO_REVISED_COUNT", label: "PO Revised", placeholder: "Rev…" },
  { key: "VENDOR_NAME", label: "Vendor", placeholder: "Vendor…" },
  { key: "CONTROL_STATUS", label: "Control", placeholder: "Ctrl…" },
  { key: "ITEM_CODE", label: "Item Code", placeholder: "Code…" },
  { key: "ITEM_DESC", label: "Item", placeholder: "Item…" },
];

const COLUMN_ORDER_KEY = "audit-table-column-order-v2";

const EXPORT_HEADERS: Record<keyof AuditRow, string> = {
  ORGANIZATION_NAME: "Organization (Legacy)",
  COMP_NAME: "Organization",
  DEPARTMENT: "Department",
  REQ_NO: "PR No",
  REQ_CREADED_BY: "PR Creator",
  CREATION_DATE_PR: "PR Date",
  PO_NO: "PO No",
  PO_CREATED_BY: "PO Creator",
  PO_CREATION_DATE: "PO Date",
  PO_APPROVE: "Status",
  APPROVER_NAME: "Approver",
  PO_AMT: "Amount",
  CURRENCY_CODE: "Currency",
  PO_EXCH_RATE: "Exch Rate",
  PO_EXCH_RATE_DATE: "Exch Rate Date",
  PURCHASE_TYPE: "Purchase Type",
  PO_REVISED_COUNT: "PO Revised",
  VENDOR_ID: "Vendor ID",
  VENDOR_NAME: "Vendor",
  CONTROL_STATUS: "Control",
  ITEM_CODE: "Item Code",
  ITEM_DESC: "Item",
  PR_AUTHORIZATION_STATUS: "PR Auth",
  PO_AUTHORIZATION_STATUS: "PO Auth",
};

function defaultColumnOrder(): (keyof AuditRow)[] {
  return DEFAULT_COLUMNS.map((c) => c.key);
}

function loadColumnOrder(): (keyof AuditRow)[] {
  if (typeof window === "undefined") return defaultColumnOrder();
  try {
    const raw = localStorage.getItem(COLUMN_ORDER_KEY);
    if (!raw) return defaultColumnOrder();
    const parsed = JSON.parse(raw) as string[];
    const valid = new Set(DEFAULT_COLUMNS.map((c) => c.key));
    const order = parsed.filter((k) => valid.has(k as keyof AuditRow)) as (keyof AuditRow)[];
    for (const c of DEFAULT_COLUMNS) {
      if (!order.includes(c.key)) order.push(c.key);
    }
    return order.length ? order : defaultColumnOrder();
  } catch {
    return defaultColumnOrder();
  }
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function cellSearchText(row: AuditRow, key: keyof AuditRow): string {
  const v = row[key];
  if (v === null || v === undefined) return "";
  if (key === "CREATION_DATE_PR" || key === "PO_CREATION_DATE") {
    return `${String(v)} ${fmtDate(String(v))}`.toLowerCase();
  }
  if (key === "PO_AMT") {
    const code = String(row.CURRENCY_CODE || "PKR").toUpperCase();
    const n = Number(v) || 0;
    return `${n} ${code} ${formatCurrency(n)} ${formatCurrency(n, true)}`.toLowerCase();
  }
  if (key === "PO_EXCH_RATE_DATE") {
    return `${String(v)} ${fmtDate(String(v))}`.toLowerCase();
  }
  if (key === "PO_APPROVE") {
    const approved = String(v || "").toUpperCase() === "APPROVE";
    return `${String(v || "")} ${approved ? "approved" : "pending"}`.toLowerCase();
  }
  return String(v).toLowerCase();
}

function fmtExchRate(rate: AuditRow["PO_EXCH_RATE"]) {
  if (rate == null || rate === "") return "—";
  const n = Number(rate);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—";
}

type StatusKind = "approved" | "pending" | "other";

function resolveStatusKind(value: string | null | undefined): StatusKind {
  const raw = String(value || "").trim();
  const upper = raw.toUpperCase();
  if (upper === "APPROVE" || upper === "APPROVED") return "approved";
  if (!raw || upper === "PENDING" || upper.includes("PEND") || upper.includes("WAIT")) return "pending";
  return "other";
}

function statusLabel(value: string | null | undefined, kind: StatusKind) {
  if (kind === "approved") return "APPROVED";
  if (kind === "pending") return String(value || "PENDING").trim().toUpperCase() || "PENDING";
  return String(value || "—").trim().toUpperCase() || "—";
}

function AnimatedStatusBadge({
  value,
  rowIndex = 0,
}: {
  value: string | null | undefined;
  rowIndex?: number;
}) {
  const kind = resolveStatusKind(value);
  const label = statusLabel(value, kind);
  const Icon = kind === "approved" ? CheckCircle2 : kind === "pending" ? Clock3 : AlertCircle;

  const styles = {
    approved: {
      shell: "border-[#0055a5]/25 bg-[#0055a5]/10 text-[#0055a5] dark:border-[#7eb6e8]/30 dark:bg-[#0055a5]/30 dark:text-[#7eb6e8]",
      glow: "rgba(0,85,165,0.35)",
      glowFade: "rgba(0,85,165,0)",
      dot: "bg-[#3d9b6a]",
    },
    pending: {
      shell: "border-[#fff200]/70 bg-[#fff200]/55 text-[#2f7ec4] dark:border-[#fff200]/35 dark:bg-[#fff200]/20 dark:text-[#fff200]",
      glow: "rgba(212,168,0,0.45)",
      glowFade: "rgba(212,168,0,0)",
      dot: "bg-[#d4a800]",
    },
    other: {
      shell: "border-[#6d8499]/25 bg-[#f3f7fc] text-[#6d8499] dark:border-white/15 dark:bg-[#1a2d4a] dark:text-[#9aa8b8]",
      glow: "rgba(109,132,153,0.35)",
      glowFade: "rgba(109,132,153,0)",
      dot: "bg-[#6d8499]",
    },
  }[kind];

  return (
    <motion.span
      className={cn(
        "relative inline-flex items-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
        styles.shell
      )}
      initial={{ opacity: 0, scale: 0.82, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 420,
        damping: 24,
        delay: Math.min(rowIndex * 0.025, 0.35),
      }}
      whileHover={{ scale: 1.06, y: -1 }}
      title={label}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-white/45 to-transparent dark:via-white/15"
        animate={{ x: ["-130%", "230%"] }}
        transition={{
          duration: 1.55,
          repeat: Infinity,
          repeatDelay: kind === "pending" ? 2.2 : 3.6,
          ease: "easeInOut",
        }}
      />

      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        animate={{
          boxShadow: [`0 0 0 0 ${styles.glow}`, `0 0 0 5px ${styles.glowFade}`, `0 0 0 0 ${styles.glow}`],
        }}
        transition={{ duration: 2.3, repeat: Infinity, ease: "easeOut" }}
      />

      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <motion.span
          className={cn("absolute inline-flex h-full w-full rounded-full opacity-70", styles.dot)}
          animate={{ scale: [1, 2.1], opacity: [0.55, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.span
          className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", styles.dot)}
          animate={kind === "pending" ? { opacity: [0.65, 1, 0.65] } : { scale: [1, 1.15, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </span>

      <motion.span
        className="relative inline-flex shrink-0"
        animate={
          kind === "approved"
            ? { scale: [1, 1.12, 1] }
            : kind === "pending"
              ? { rotate: [-8, 8, -8] }
              : { y: [0, -1, 0] }
        }
        transition={{ duration: kind === "pending" ? 2.5 : 2.1, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon className="h-3 w-3" strokeWidth={2.5} />
      </motion.span>

      <motion.span
        className="relative max-w-24 truncate"
        animate={kind === "pending" ? { opacity: [0.82, 1, 0.82] } : undefined}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {label}
      </motion.span>
    </motion.span>
  );
}

function exportCellValue(row: AuditRow, key: keyof AuditRow): string | number {
  switch (key) {
    case "COMP_NAME":
      return row.COMP_NAME || row.ORGANIZATION_NAME || "";
    case "CREATION_DATE_PR":
    case "PO_CREATION_DATE":
    case "PO_EXCH_RATE_DATE":
      return row[key] ? fmtDate(String(row[key])) : "";
    case "PO_AMT":
      return Number(row.PO_AMT) || 0;
    case "CURRENCY_CODE":
      return String(row.CURRENCY_CODE || "PKR").trim() || "PKR";
    case "PO_EXCH_RATE":
      return row.PO_EXCH_RATE ?? "";
    case "PURCHASE_TYPE":
      return String(row.PURCHASE_TYPE || "").trim() || "Unspecified";
    case "PO_REVISED_COUNT":
      return row.PO_REVISED_COUNT ?? 0;
    case "VENDOR_NAME":
      return String(row.VENDOR_NAME || row.VENDOR_ID || "");
    default:
      return String(row[key] ?? "");
  }
}

export function AuditTable() {
  const { filters, pushDrill } = useDashboard();
  const tablesReady = useDeferredReady(700);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [sortBy, setSortBy] = useState("PO_CREATION_DATE");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [colFilters, setColFilters] = useState<Partial<Record<keyof AuditRow, string>>>({});
  const [columnOrder, setColumnOrder] = useState<(keyof AuditRow)[]>(defaultColumnOrder);
  const [columnOrderReady, setColumnOrderReady] = useState(false);
  const [dragKey, setDragKey] = useState<keyof AuditRow | null>(null);
  const [dragOverKey, setDragOverKey] = useState<keyof AuditRow | null>(null);

  useEffect(() => {
    setColumnOrder(loadColumnOrder());
    setColumnOrderReady(true);
  }, []);

  const orderedColumns = useMemo(() => {
    const map = new Map(DEFAULT_COLUMNS.map((c) => [c.key, c]));
    return columnOrder.map((k) => map.get(k)).filter(Boolean) as ColDef[];
  }, [columnOrder]);

  useEffect(() => {
    if (!columnOrderReady) return;
    localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(columnOrder));
  }, [columnOrder, columnOrderReady]);

  const moveColumn = (from: keyof AuditRow, to: keyof AuditRow) => {
    if (from === to) return;
    setColumnOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(from);
      const toIdx = next.indexOf(to);
      if (fromIdx < 0 || toIdx < 0) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, from);
      return next;
    });
  };

  const resetColumnOrder = () => {
    setColumnOrder(defaultColumnOrder());
    toast.success("Column order reset");
  };

  const renderCell = (row: AuditRow, key: keyof AuditRow, rowIndex = 0) => {
    switch (key) {
      case "COMP_NAME":
        return (
          <button
            type="button"
            className="text-[#0055a5] hover:underline"
            onClick={() => {
              const name = String(row.COMP_NAME || "").trim() || row.ORGANIZATION_NAME || "";
              if (!name) return;
              pushDrill({ level: "organization", value: name, label: name });
            }}
          >
            {row.COMP_NAME || row.ORGANIZATION_NAME || "—"}
          </button>
        );
      case "DEPARTMENT":
        return (
          <button
            type="button"
            className="hover:text-[#0055a5] hover:underline"
            onClick={() => pushDrill({ level: "department", value: row.DEPARTMENT, label: row.DEPARTMENT })}
          >
            {row.DEPARTMENT || "—"}
          </button>
        );
      case "REQ_NO":
        return row.REQ_NO ? (
          <button
            type="button"
            className="font-medium text-[#0055a5] hover:underline"
            onClick={() =>
              pushDrill({ level: "reqNo", value: String(row.REQ_NO), label: `PR #${row.REQ_NO}` })
            }
          >
            {row.REQ_NO}
          </button>
        ) : (
          "—"
        );
      case "REQ_CREADED_BY":
        return (
          <button
            type="button"
            className="hover:text-[#0055a5] hover:underline"
            onClick={() =>
              pushDrill({ level: "prCreator", value: row.REQ_CREADED_BY, label: row.REQ_CREADED_BY })
            }
          >
            {row.REQ_CREADED_BY || "—"}
          </button>
        );
      case "CREATION_DATE_PR":
        return fmtDate(row.CREATION_DATE_PR);
      case "PO_NO":
        return row.PO_NO ? (
          <button
            type="button"
            className="font-medium text-[#0055a5] hover:underline"
            onClick={() =>
              pushDrill({ level: "poNo", value: String(row.PO_NO), label: `PO #${row.PO_NO}` })
            }
          >
            {row.PO_NO}
          </button>
        ) : (
          "—"
        );
      case "PO_CREATED_BY":
        return (
          <button
            type="button"
            className="hover:text-[#0055a5] hover:underline"
            onClick={() =>
              pushDrill({ level: "poCreator", value: row.PO_CREATED_BY, label: row.PO_CREATED_BY })
            }
          >
            {row.PO_CREATED_BY || "—"}
          </button>
        );
      case "PO_CREATION_DATE":
        return fmtDate(row.PO_CREATION_DATE);
      case "APPROVER_NAME":
        return row.APPROVER_NAME || "—";
      case "PO_APPROVE":
        return <AnimatedStatusBadge value={row.PO_APPROVE} rowIndex={rowIndex} />;
      case "PO_AMT": {
        const code = String(row.CURRENCY_CODE || "PKR").trim().toUpperCase() || "PKR";
        const amt = Number(row.PO_AMT) || 0;
        return code === "PKR" ? formatCurrency(amt) : formatForeignAmount(amt, code);
      }
      case "CURRENCY_CODE":
        return String(row.CURRENCY_CODE || "PKR").trim() || "PKR";
      case "PO_EXCH_RATE":
        return fmtExchRate(row.PO_EXCH_RATE);
      case "PO_EXCH_RATE_DATE":
        return fmtDate(row.PO_EXCH_RATE_DATE ?? undefined);
      case "PURCHASE_TYPE": {
        const type = String(row.PURCHASE_TYPE || "").trim() || "Unspecified";
        return (
          <button
            type="button"
            className="hover:text-[#0055a5] hover:underline"
            onClick={() => pushDrill({ level: "purchaseType", value: type, label: `Type: ${type}` })}
          >
            {type}
          </button>
        );
      }
      case "PO_REVISED_COUNT":
        return row.PO_NO ? (
          <button
            type="button"
            className="font-semibold tabular-nums hover:text-[#0055a5] hover:underline"
            onClick={() => {
              const n = Number(row.PO_REVISED_COUNT);
              const rev = Number.isFinite(n) ? n : 0;
              const bucket = rev >= 4 ? "4+" : String(Math.max(0, Math.floor(rev)));
              pushDrill({
                level: "poRevised",
                value: bucket,
                label: rev === 0 ? "Never revised" : `Revised ${bucket}×`,
              });
            }}
          >
            {Number.isFinite(Number(row.PO_REVISED_COUNT)) ? Number(row.PO_REVISED_COUNT) : 0}
          </button>
        ) : (
          "—"
        );
      case "VENDOR_NAME":
        return (
          <span className="block max-w-55 truncate" title={String(row.VENDOR_NAME || row.VENDOR_ID || "")}>
            {row.VENDOR_NAME || row.VENDOR_ID || "—"}
          </span>
        );
      case "CONTROL_STATUS":
        return row.CONTROL_STATUS || "—";
      case "ITEM_DESC":
        return (
          <span className="block max-w-55 truncate" title={row.ITEM_DESC}>
            {row.ITEM_DESC || "—"}
          </span>
        );
      default:
        return String(row[key] ?? "—");
    }
  };

  const cellClassName = (key: keyof AuditRow) =>
    cn(
      "px-3 py-2",
      (key === "CREATION_DATE_PR" ||
        key === "PO_CREATION_DATE" ||
        key === "PO_EXCH_RATE_DATE" ||
        key === "PO_AMT" ||
        key === "CURRENCY_CODE" ||
        key === "PO_EXCH_RATE") &&
        "whitespace-nowrap tabular-nums",
      key === "PO_AMT" && "font-semibold"
    );

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    setPage(1);
  }, [colFilters]);

  const { data, isLoading, isFetching, isPending } = useQuery({
    queryKey: ["audit-table", filters, page, pageSize, sortBy, sortDir],
    queryFn: () => api.table(filters, page, pageSize, sortBy, sortDir),
    enabled: tablesReady,
  });
  const tableLoading = !tablesReady || isLoading || isPending;

  const activeColFilterCount = useMemo(
    () => Object.values(colFilters).filter((v) => v && v.trim()).length,
    [colFilters]
  );

  const rows = useMemo(() => {
    const list = data?.data || [];
    const entries = Object.entries(colFilters).filter(([, q]) => q && q.trim()) as [keyof AuditRow, string][];
    if (!entries.length) return list;
    return list.filter((r) =>
      entries.every(([key, q]) => cellSearchText(r, key).includes(q.trim().toLowerCase()))
    );
  }, [data, colFilters]);

  const pagination = data?.pagination;

  const setColFilter = (key: keyof AuditRow, value: string) => {
    setColFilters((prev) => {
      const next = { ...prev };
      if (!value.trim()) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const clearColFilters = () => setColFilters({});

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const exportRows = async (type: "csv" | "xlsx") => {
    try {
      const all = await api.table(filters, 1, 200, sortBy, sortDir);
      let exportList = all.data || [];
      const entries = Object.entries(colFilters).filter(([, q]) => q && q.trim()) as [keyof AuditRow, string][];
      if (entries.length) {
        exportList = exportList.filter((r) =>
          entries.every(([key, q]) => cellSearchText(r, key).includes(q.trim().toLowerCase()))
        );
      }
      const exportData = exportList.map((r) => {
        const row: Record<string, string | number> = {};
        for (const c of orderedColumns) {
          row[EXPORT_HEADERS[c.key]] = exportCellValue(r, c.key);
        }
        return row;
      });

      if (type === "csv") {
        const header = Object.keys(exportData[0] || {}).join(",");
        const body = exportData
          .map((row) =>
            Object.values(row)
              .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
              .join(",")
          )
          .join("\n");
        const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `procurement-audit-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Audit");
        XLSX.writeFile(wb, `procurement-audit-${Date.now()}.xlsx`);
      }
      toast.success(`Exported ${exportData.length} rows`);
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <Card id="audit-table" className="scroll-mt-24">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ChartIconBadge icon={Table2} tone="blue" />
          <div>
            <CardTitle>Interactive Audit Table</CardTitle>
            <p className="text-xs text-[#6d8499]">
              Drag column handles to reorder · per-column search · sort · export
              {isFetching ? " · refreshing…" : ""}
              {activeColFilterCount > 0 ? ` · ${activeColFilterCount} column filter${activeColFilterCount > 1 ? "s" : ""}` : ""}
              {filters.department || filters.prCreator || filters.poCreator || filters.organization || filters.vendorId || filters.aging
                ? " · filtered by drill path"
                : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={resetColumnOrder} title="Reset column order">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset columns
          </Button>
          {activeColFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="rounded-xl text-[#e31e24]" onClick={clearColFilters}>
              <FilterX className="h-3.5 w-3.5" />
              Clear column filters
            </Button>
          )}
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => exportRows("csv")}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => exportRows("xlsx")}>
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-140 overflow-auto rounded-xl border border-[#0055a5]/15">
          <table className="min-w-350 w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[#eef5fc]/95 backdrop-blur dark:bg-[#152a45]/95">
              <tr>
                {orderedColumns.map((c) => (
                  <th
                    key={c.key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragKey && dragKey !== c.key) setDragOverKey(c.key);
                    }}
                    onDragLeave={() => {
                      if (dragOverKey === c.key) setDragOverKey(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragKey) moveColumn(dragKey, c.key);
                      setDragKey(null);
                      setDragOverKey(null);
                    }}
                    className={cn(
                      "whitespace-nowrap px-3 pb-1 pt-2.5 font-semibold text-[#6d8499] transition",
                      dragOverKey === c.key && "bg-[#0055a5]/10 ring-2 ring-inset ring-[#0055a5]/35",
                      dragKey === c.key && "opacity-40"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDragKey(c.key);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDragKey(null);
                          setDragOverKey(null);
                        }}
                        className="cursor-grab rounded p-0.5 text-[#6d8499] hover:bg-[#0055a5]/10 hover:text-[#0055a5] active:cursor-grabbing"
                        title="Drag to reorder column"
                        aria-label={`Drag ${c.label} column`}
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-[#0055a5]"
                        onClick={() => toggleSort(c.key)}
                      >
                        {c.label}
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
              <tr className="border-b border-[#0055a5]/15">
                {orderedColumns.map((c) => {
                  const val = colFilters[c.key] || "";
                  return (
                    <th key={`filter-${c.key}`} className="px-2 pb-2.5 pt-1 align-top">
                      <div className="relative min-w-25">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#6d8499]" />
                        <input
                          value={val}
                          onChange={(e) => setColFilter(c.key, e.target.value)}
                          placeholder={c.placeholder || "Search…"}
                          className="h-7 w-full rounded-lg border border-[#0055a5]/15 bg-white pl-7 pr-6 text-2.75 font-medium text-[#2a4a6e] outline-none placeholder:text-[#6d8499]/70 focus:border-[#0055a5]/45 focus:ring-1 focus:ring-[#0055a5]/25 dark:border-white/15 dark:bg-[#0f1c30] dark:text-[#e8f1fa] dark:placeholder:text-[#9aa8b8]"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                        {val && (
                          <button
                            type="button"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#6d8499] hover:bg-[#eef5fc] hover:text-[#e31e24]"
                            onClick={() => setColFilter(c.key, "")}
                            aria-label={`Clear ${c.label} filter`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {tableLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={orderedColumns.length} className="px-3 py-2">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                : rows.map((row, idx) => (
                    <tr
                      key={`${row.PO_NO}-${row.REQ_NO}-${idx}`}
                      className="border-t border-[#0055a5]/10 transition hover:bg-[#eef5fc] dark:border-white/5 dark:hover:bg-[#152a45]"
                    >
                      {orderedColumns.map((c) => (
                        <td key={c.key} className={cellClassName(c.key)}>
                          {renderCell(row, c.key, idx)}
                        </td>
                      ))}
                    </tr>
                  ))}
              {!tableLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={orderedColumns.length} className="px-3 py-16 text-center text-[#6d8499]">
                    No procurement records match the current filters.
                    {activeColFilterCount > 0 && (
                      <>
                        {" "}
                        <button type="button" className="font-semibold text-[#0055a5] hover:underline" onClick={clearColFilters}>
                          Clear column searches
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#6d8499]">
            Showing {rows.length} on this page
            {activeColFilterCount > 0 ? " (after column search)" : ""}
            {" · "}
            Page {pagination?.page || page} of {pagination?.totalPages || 1} ·{" "}
            {(pagination?.total || 0).toLocaleString()} records
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
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
