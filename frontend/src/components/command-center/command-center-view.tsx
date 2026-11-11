"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
  Filter,
  ArrowLeft,
  Radio,
  Clock3,
} from "lucide-react";
import { format } from "date-fns";
import { api, type CommandCenterActivity, type CommandCenterNode } from "@/lib/api";
import { useDashboard } from "@/context/dashboard-context";
import { FilterBar } from "@/components/dashboard/filter-bar";
import {
  ProcurementNetwork,
  type FlowViewMode,
} from "@/components/command-center/procurement-network";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { ingestActivity, resetActivityBaseline } from "@/lib/command-center-events";
import { playCommandCenterAlert, unlockCommandCenterSound } from "@/lib/command-center-sound";

const POLL_MS = 20_000;
const TOAST_TTL_MS = 7_000;
const MAX_TOASTS = 2;

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function KpiChip({
  label,
  value,
  formatter,
  accent,
}: {
  label: string;
  value: number;
  formatter?: (n: number) => string;
  accent?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
      <div className="truncate text-[8px] font-bold uppercase tracking-[0.12em] text-[#9aa8b8]">{label}</div>
      <div className={cn("mt-0.5 text-base font-extrabold tabular-nums leading-none lg:text-lg", accent || "text-white")}>
        <AnimatedCounter value={value} formatter={formatter || ((n) => formatNumber(Math.round(n)))} duration={700} />
      </div>
    </div>
  );
}

export function CommandCenterView() {
  const { filters } = useDashboard();
  const preferReduced = useReducedMotion();
  const now = useClock();
  const [animate, setAnimate] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [selected, setSelected] = useState<CommandCenterNode | null>(null);
  const [toasts, setToasts] = useState<CommandCenterActivity[]>([]);
  const [ticker, setTicker] = useState<CommandCenterActivity[]>([]);
  const [highlightHub, setHighlightHub] = useState<string | null>(null);
  const [pulseEvent, setPulseEvent] = useState<CommandCenterActivity | null>(null);
  const [viewMode, setViewMode] = useState<FlowViewMode>("flow");
  const rootRef = useRef<HTMLDivElement>(null);
  const toastIdsRef = useRef<Set<string>>(new Set());

  const motionOn = animate && !preferReduced;

  const q = useQuery({
    queryKey: ["command-center", filters],
    queryFn: () => api.commandCenter(filters),
    refetchInterval: POLL_MS,
    staleTime: 10_000,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const data = q.data?.data;
  const kpis = data?.kpis;
  const lastOk = q.dataUpdatedAt ? new Date(q.dataUpdatedAt) : null;
  const live = !q.isError && !!data;
  const stale = q.isError && !!data;
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    resetActivityBaseline();
    setToasts([]);
    setPulseEvent(null);
    toastIdsRef.current = new Set();
  }, [filterKey]);

  useEffect(() => {
    if (!data?.activity?.length) return;
    const { fresh } = ingestActivity(data.activity);
    setTicker(data.activity.slice(0, 6));
    if (!fresh.length) return;

    const uniqueFresh = fresh.filter((e) => {
      if (toastIdsRef.current.has(e.id)) return false;
      toastIdsRef.current.add(e.id);
      return true;
    });
    if (!uniqueFresh.length) return;

    setToasts((prev) => [...uniqueFresh.slice(0, MAX_TOASTS), ...prev].slice(0, MAX_TOASTS));
    setPulseEvent(uniqueFresh[0]);

    const hub =
      uniqueFresh[0]?.kind === "grn" || uniqueFresh[0]?.kind === "backdated_grn"
        ? "hub-grn"
        : uniqueFresh[0]?.kind === "po"
          ? "hub-po"
          : "hub-pr";
    setHighlightHub(hub);
    const t = window.setTimeout(() => {
      setHighlightHub(null);
      setPulseEvent(null);
    }, 4200);
    if (soundOn && soundReady) playCommandCenterAlert();
    return () => window.clearTimeout(t);
  }, [data?.generatedAt, data?.activity, soundOn, soundReady]);

  useEffect(() => {
    if (!toasts.length) return;
    const id = window.setTimeout(() => setToasts((prev) => prev.slice(0, -1)), TOAST_TTL_MS);
    return () => window.clearTimeout(id);
  }, [toasts]);

  useEffect(() => {
    const onFs = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFs = useCallback(async () => {
    try {
      if (!document.fullscreenElement) await rootRef.current?.requestFullscreen?.();
      else await document.exitFullscreen();
    } catch {
      /* blocked */
    }
  }, []);

  const toggleSound = useCallback(async () => {
    if (soundOn) {
      setSoundOn(false);
      return;
    }
    const ok = await unlockCommandCenterSound();
    setSoundReady(ok);
    setSoundOn(ok);
    if (ok) playCommandCenterAlert();
  }, [soundOn]);

  const detailLines = useMemo(() => {
    if (!selected) return [];
    const lines: string[] = [`Type: ${selected.type}`, `Stage: ${selected.stage.toUpperCase()}`];
    if (typeof selected.count === "number") lines.push(`Count: ${formatNumber(selected.count)}`);
    if (typeof selected.value === "number" && selected.value > 0) {
      lines.push(`Value: ${formatCurrency(selected.value, true)}`);
    }
    if (selected.meta) {
      Object.entries(selected.meta).forEach(([k, v]) => {
        if (v == null) return;
        lines.push(`${k}: ${typeof v === "number" && v > 1000 ? formatNumber(v) : v}`);
      });
    }
    return lines;
  }, [selected]);

  return (
    <div
      ref={rootRef}
      className="flex h-[100dvh] max-h-[100dvh] w-[100dvw] max-w-[100dvw] flex-col overflow-hidden bg-[#050d18] text-[#e8f1fa]"
    >
      {/* Header — single row, no wrap overflow */}
      <header className="relative z-20 shrink-0 border-b border-white/10 bg-[#0c1830]">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-[#e31e24]" />
        {motionOn && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#fff200] to-transparent"
            animate={{ x: ["-30%", "130%"] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
          />
        )}
        <div className="flex h-12 items-center justify-between gap-2 overflow-hidden px-3">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-[#7eb6e8]"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </Link>
            <div className="relative hidden h-8 w-8 shrink-0 overflow-hidden rounded-md border-2 border-[#fff200] bg-white sm:block">
              <Image src="/master-logo.png" alt="Master" fill className="object-contain p-0.5" />
            </div>
            <div className="min-w-0 truncate">
              <span className="rounded bg-[#0055a5] px-1.5 py-0.5 text-[11px] font-black text-[#fff200]">MASTER</span>
              <span className="ml-1.5 text-[11px] font-bold text-white">Command Center</span>
              <span className="ml-2 hidden text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#7eb6e8] lg:inline">
                Live Procurement
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase",
                live && !stale ? "border-[#3d9b6a]/40 text-[#7ddea8]" : "border-[#e31e24]/40 text-[#ff8a8e]"
              )}
            >
              <Radio className={cn("h-3 w-3", motionOn && live && "animate-pulse")} />
              {live && !stale ? "Live" : "Offline"}
            </span>
            <span className="hidden tabular-nums text-[10px] text-[#9aa8b8] md:inline">
              <Clock3 className="mr-1 inline h-3 w-3" />
              {lastOk ? format(lastOk, "HH:mm:ss") : "—"}
            </span>
            <span className="hidden tabular-nums text-[10px] font-semibold text-[#c5d6e8] sm:inline">
              {format(now, "HH:mm:ss")}
            </span>
            <Button type="button" size="sm" variant="outline" className="h-7 border-white/15 bg-white/5 px-2 text-[10px] text-white" onClick={() => setFiltersOpen((v) => !v)}>
              <Filter className="h-3 w-3" />
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 border-white/15 bg-white/5 px-2 text-white" onClick={() => setAnimate((v) => !v)}>
              {animate ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn("h-7 border-white/15 px-2 text-[10px]", soundOn ? "bg-[#3d9b6a]/25 text-[#7ddea8]" : "bg-white/5 text-white")}
              onClick={toggleSound}
            >
              {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 border-white/15 bg-white/5 px-2 text-white" onClick={toggleFs}>
              {isFs ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {filtersOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-white/10">
              <div className="max-h-[32vh] overflow-y-auto overflow-x-hidden p-2">
                <FilterBar />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* KPIs */}
      <section className="shrink-0 border-b border-white/10 px-2 py-1.5">
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-5 lg:grid-cols-9">
          <KpiChip label="Total PRs" value={kpis?.totalPRs || 0} accent="text-[#7eb6e8]" />
          <KpiChip label="Approved PRs" value={kpis?.approvedPRs || 0} accent="text-[#7ddea8]" />
          <KpiChip label="Pending PRs" value={kpis?.pendingPRs || 0} accent="text-[#fff200]" />
          <KpiChip label="Total POs" value={kpis?.totalPOs || 0} accent="text-[#7eb6e8]" />
          <KpiChip label="PO Value" value={kpis?.totalPoValue || 0} formatter={(n) => formatCurrency(n, true)} />
          <KpiChip label="POs w/ GRN" value={kpis?.posWithGrn || 0} accent="text-[#7ddea8]" />
          <KpiChip label="POs w/o GRN" value={kpis?.posWithoutGrn || 0} accent="text-[#ff8a8e]" />
          <KpiChip label="Received Qty" value={kpis?.totalReceivedQty || 0} />
          <KpiChip label="Pending Qty" value={kpis?.pendingReceivingQty || 0} accent="text-[#fff200]" />
        </div>
      </section>

      {/* Main network — fills remaining */}
      <div className="relative min-h-0 flex-1 overflow-hidden p-1.5">
        {data?.network ? (
          <ProcurementNetwork
            nodes={data.network.nodes}
            links={data.network.links}
            pipeline={data.pipeline}
            animate={motionOn}
            highlightHub={highlightHub}
            pulseEvent={pulseEvent}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onSelect={setSelected}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-white/10 text-sm text-[#9aa8b8]">
            {q.isLoading ? "Loading command center…" : "No data for filters"}
          </div>
        )}

        <AnimatePresence>
          {selected && (
            <motion.aside
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-3 left-3 z-30 w-[min(18rem,calc(100%-1.5rem))] rounded-xl border border-[#fff200]/35 bg-[#0f1c30]/95 p-2.5 shadow-xl backdrop-blur"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#fff200]">Detail</div>
                  <div className="truncate text-sm font-extrabold text-white">{selected.label}</div>
                </div>
                <button type="button" className="text-[#9aa8b8]" onClick={() => setSelected(null)} aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-[11px] text-[#c5d6e8]">
                {detailLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </motion.aside>
          )}
        </AnimatePresence>

        <div className="pointer-events-none absolute right-3 top-3 z-40 flex w-[min(17rem,calc(100%-1.5rem))] flex-col gap-1.5">
          <AnimatePresence>
            {toasts.map((t) => {
              const isGrn = t.kind === "grn" || t.kind === "backdated_grn";
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-auto rounded-lg border border-[#fff200]/40 bg-[#122238]/95 p-2 shadow-[0_0_20px_rgba(255,242,0,0.15)]"
                >
                  <div className="flex justify-between gap-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#fff200]">{t.title}</span>
                    <button type="button" onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}>
                      <X className="h-3 w-3 text-[#9aa8b8]" />
                    </button>
                  </div>
                  {isGrn ? (
                    <>
                      <div className="text-xs font-bold text-white">
                        {t.receiptNum ? `GRN ${t.receiptNum}` : "Goods receipt"}
                      </div>
                      <div className="text-[10px] text-[#c5d6e8]">PO #{t.documentRef}</div>
                      {t.vendor && <div className="truncate text-[10px] text-[#c5d6e8]">{t.vendor}</div>}
                      {t.quantity != null && (
                        <div className="text-[10px] text-[#9aa8b8]">Qty {formatNumber(t.quantity)}</div>
                      )}
                      {t.receivingOrg && (
                        <div className="truncate text-[10px] text-[#9aa8b8]">{t.receivingOrg}</div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-bold text-white">PO #{t.documentRef}</div>
                      {t.reqNo && (
                        <div className="text-[10px] text-[#7eb6e8]">
                          PR #{t.reqNo}
                          {t.hasPrLink === false ? " · unlinked" : ""}
                        </div>
                      )}
                      {t.vendor && <div className="truncate text-[10px] text-[#c5d6e8]">{t.vendor}</div>}
                      {t.department && <div className="truncate text-[10px] text-[#9aa8b8]">{t.department}</div>}
                      {t.amount != null && t.amount > 0 && (
                        <div className="text-[10px] font-semibold text-[#fff200]">
                          {formatCurrency(t.amount, true)}
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Activity — fixed 6-cell grid, NO horizontal scroll */}
      <footer className="shrink-0 border-t border-white/10 bg-[#080f1c]">
        <div className="flex h-6 items-center gap-2 px-3">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#e31e24]">Activity</span>
          {motionOn && (
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-[#e31e24]"
              animate={{ opacity: [1, 0.2, 1], scale: [1, 1.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
          <span className="text-[9px] text-[#6d8499]">Latest in filter · no side scroll</span>
        </div>
        <div className="grid grid-cols-2 gap-1 px-2 pb-2 sm:grid-cols-3 lg:grid-cols-6">
          {ticker.length === 0 && (
            <div className="col-span-full py-2 text-center text-[11px] text-[#6d8499]">No recent activity</div>
          )}
          {ticker.map((e, i) => (
            <motion.div
              key={e.id}
              className="min-w-0 overflow-hidden rounded-md border border-white/10 bg-white/5 px-2 py-1.5"
              animate={motionOn ? { borderColor: ["rgba(255,255,255,0.1)", "rgba(0,85,165,0.45)", "rgba(255,255,255,0.1)"] } : undefined}
              transition={motionOn ? { duration: 2.5, repeat: Infinity, delay: i * 0.2 } : undefined}
            >
              <div className="flex items-center justify-between gap-1 overflow-hidden">
                <span className="truncate text-[8px] font-bold uppercase text-[#7eb6e8]">{e.kind.replace("_", " ")}</span>
                <span className="shrink-0 text-[8px] text-[#6d8499]">
                  {e.timestamp ? format(new Date(e.timestamp), "HH:mm") : "—"}
                </span>
              </div>
              <div className="truncate text-[11px] font-bold text-white">#{e.documentRef}</div>
              <div className="truncate text-[9px] text-[#9aa8b8]">{e.vendor || e.status || "—"}</div>
            </motion.div>
          ))}
        </div>
      </footer>
    </div>
  );
}
