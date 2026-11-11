"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  BarChart3,
  ShieldAlert,
  Table2,
  Sparkles,
  Funnel,
  PieChart,
  Users,
  Building2,
  TrendingUp,
  Wallet,
  Tags,
  RefreshCcw,
  Store,
  Clock3,
  Gauge,
  X,
  Compass,
  type LucideIcon,
} from "lucide-react";
import type { DashboardSectionId } from "@/components/dashboard/dashboard-section-nav";
import { cn } from "@/lib/utils";

export type DashboardJumpTarget = {
  id: string;
  label: string;
  section: DashboardSectionId;
  icon: LucideIcon;
  hint?: string;
};

/** Chart / section anchors used by the floating jump menu */
export const DASHBOARD_JUMP_TARGETS: DashboardJumpTarget[] = [
  { id: "jump-overview", label: "Executive Overview", section: "overview", icon: LayoutDashboard, hint: "KPIs" },
  { id: "jump-insights", label: "AI Insights", section: "overview", icon: Sparkles },
  { id: "jump-grn-overview", label: "GRN Overview", section: "grn", icon: Package },
  { id: "jump-grn-charts", label: "GRN Charts", section: "grn", icon: BarChart3 },
  { id: "jump-funnel", label: "Procurement Funnel", section: "analytics", icon: Funnel },
  { id: "jump-approval", label: "Approval Status", section: "analytics", icon: PieChart },
  { id: "jump-creators", label: "Top Creators", section: "analytics", icon: Users },
  { id: "jump-dept-legal", label: "Dept & Legal Entity", section: "analytics", icon: Building2 },
  { id: "jump-trends", label: "Monthly Trends", section: "analytics", icon: TrendingUp },
  { id: "jump-spend", label: "Spend Analysis", section: "analytics", icon: Wallet },
  { id: "jump-purchase-type", label: "Purchase Type", section: "analytics", icon: Tags },
  { id: "jump-revisions", label: "PO Revisions", section: "analytics", icon: RefreshCcw },
  { id: "jump-vendors", label: "Vendor Analysis", section: "analytics", icon: Store },
  { id: "jump-aging", label: "Procurement Aging", section: "analytics", icon: Clock3 },
  { id: "jump-dept-performance", label: "Dept Performance", section: "analytics", icon: Gauge },
  { id: "jump-risk", label: "Split PO Risk", section: "risk", icon: ShieldAlert },
  { id: "jump-tables", label: "Detail Tables", section: "tables", icon: Table2 },
];

type Props = {
  activeSection: DashboardSectionId;
  visibleSectionIds: DashboardSectionId[];
  onJump: (section: DashboardSectionId, anchorId: string) => void;
};

export function DashboardJumpFab({ activeSection, visibleSectionIds, onJump }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () => DASHBOARD_JUMP_TARGETS.filter((t) => visibleSectionIds.includes(t.section)),
    [visibleSectionIds]
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length < 2) return null;

  return (
    <div ref={rootRef} className="fixed bottom-6 left-4 z-50 md:bottom-8 md:left-6">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="absolute bottom-[4.25rem] left-0 w-[min(18.5rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#0055a5]/20 bg-white/95 shadow-[0_16px_40px_rgba(0,85,165,0.22)] backdrop-blur-md dark:border-white/15 dark:bg-[#0f1c30]/96"
          >
            <div className="flex items-center justify-between border-b border-[#0055a5]/10 px-3 py-2.5 dark:border-white/10">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#0055a5] dark:text-[#7eb6e8]">
                  Quick jump
                </div>
                <div className="text-[11px] text-[#6d8499] dark:text-[#9aa8b8]">Chart / section pe seedha jao</div>
              </div>
              <button
                type="button"
                aria-label="Close jump menu"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-[#6d8499] hover:bg-[#0055a5]/8 hover:text-[#0055a5] dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[min(22rem,50vh)] space-y-0.5 overflow-y-auto p-1.5">
              {items.map((item, i) => {
                const Icon = item.icon;
                const here = item.section === activeSection;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.025, 0.25) }}
                    onClick={() => {
                      onJump(item.section, item.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                      here
                        ? "bg-[#0055a5]/10 text-[#0055a5] dark:bg-[#3d9ae8]/15 dark:text-[#7eb6e8]"
                        : "text-[#2a4a6e] hover:bg-[#0055a5]/8 dark:text-[#e8f1fa] dark:hover:bg-white/8"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        here
                          ? "bg-[#0055a5] text-white dark:bg-[#3d9ae8] dark:text-[#0a1628]"
                          : "bg-[#eef5fc] text-[#0055a5] dark:bg-[#122238] dark:text-[#7eb6e8]"
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.25} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold leading-tight">{item.label}</span>
                      {item.hint && (
                        <span className="block truncate text-[10px] text-[#6d8499] dark:text-[#9aa8b8]">{item.hint}</span>
                      )}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close quick jump" : "Open quick jump"}
        title="Quick jump · charts & sections"
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.94 }}
        className={cn(
          "relative flex h-14 w-14 items-center justify-center rounded-full border-2 shadow-[0_10px_28px_rgba(0,85,165,0.35)] transition",
          open
            ? "border-[#fff200] bg-[#e31e24] text-white"
            : "border-[#fff200] bg-[#0055a5] text-white dark:bg-[#3d9ae8] dark:text-[#0a1628]"
        )}
      >
        {/* Soft orbit ring */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-[-5px] rounded-full border border-[#fff200]/50"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          style={{ borderStyle: "dashed" }}
        />
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-[#fff200]/25"
          animate={{ scale: [1, 1.35, 1], opacity: [0.45, 0, 0.45] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
        />
        {open ? <X className="relative h-6 w-6" strokeWidth={2.5} /> : <Compass className="relative h-6 w-6" strokeWidth={2.5} />}
      </motion.button>
    </div>
  );
}
