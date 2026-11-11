"use client";

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  BarChart3,
  ShieldAlert,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardSectionId = "overview" | "grn" | "analytics" | "risk" | "tables";

export type DashboardSectionTab = {
  id: DashboardSectionId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  hint: string;
};

export const DASHBOARD_SECTIONS: DashboardSectionTab[] = [
  {
    id: "overview",
    label: "Overview",
    shortLabel: "Overview",
    icon: LayoutDashboard,
    hint: "Executive KPIs & insights",
  },
  {
    id: "grn",
    label: "GRN",
    shortLabel: "GRN",
    icon: Package,
    hint: "Receipts & PO → GRN",
  },
  {
    id: "analytics",
    label: "Analytics",
    shortLabel: "Analytics",
    icon: BarChart3,
    hint: "Charts & spend analysis",
  },
  {
    id: "risk",
    label: "Risk",
    shortLabel: "Risk",
    icon: ShieldAlert,
    hint: "Split PO watch",
  },
  {
    id: "tables",
    label: "Tables",
    shortLabel: "Tables",
    icon: Table2,
    hint: "Audit & GRN detail",
  },
];

type Props = {
  active: DashboardSectionId;
  visibleIds: DashboardSectionId[];
  onChange: (id: DashboardSectionId) => void;
};

export function DashboardSectionNav({ active, visibleIds, onChange }: Props) {
  const tabs = DASHBOARD_SECTIONS.filter((s) => visibleIds.includes(s.id));
  if (tabs.length <= 1) return null;

  return (
    <nav
      aria-label="Dashboard sections"
      className="sticky top-0 z-30 -mx-4 border-b border-[#0055a5]/12 bg-[#f3f7fc]/92 px-4 backdrop-blur-md dark:border-white/10 dark:bg-[#0a1628]/92 md:-mx-6 md:px-6"
    >
      <div className="flex gap-1 overflow-x-auto py-2.5 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              title={tab.hint}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition",
                isActive
                  ? "bg-[#0055a5] text-white shadow-sm dark:bg-[#3d9ae8] dark:text-[#0a1628]"
                  : "text-[#2a4a6e] hover:bg-[#0055a5]/8 dark:text-[#e8f1fa] dark:hover:bg-white/8"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />
              <span className="whitespace-nowrap">{tab.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
