"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Area,
  AreaChart,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  LabelList,
} from "recharts";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Filter,
  PieChart as PieChartIcon,
  UserPen,
  PackageCheck,
  ShieldCheck,
  Building2,
  Landmark,
  TrendingUp,
  WalletCards,
  Truck,
  Hourglass,
  ClipboardList,
  ShoppingCart,
  BadgeCheck,
  FileSearch,
  Tags,
  RefreshCw,
  Link2,
  Unlink,
  Package,
  Warehouse,
  Receipt,
  Undo2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { formatCompactAxis, formatCurrency, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { addMonths, endOfMonth, format, isValid, parseISO, startOfMonth } from "date-fns";
import type {
  AgingBucket,
  ApprovalStatusItem,
  DepartmentSpend,
  FunnelStage,
  LegalEntity,
  MonthlyPoint,
  NamedCount,
  PurchaseType,
  PoRevisionBucket,
  PoRevisionData,
  PoRevisionTopItem,
  Vendor,
  GrnReceivingOrg,
  GrnMonthlyPoint,
  GrnVendor,
  GrnReturnRejectData,
  SplitPoAnalysis,
} from "@/lib/api";

export const MGI = {
  blue: "#0055a5",
  blueDark: "#2f7ec4",
  red: "#e31e24",
  yellow: "#fff200",
  white: "#ffffff",
  soft: "#eef5fc",
  gray: "#6d8499",
  ink: "#2a4a6e",
  // aliases used across charts
  navy: "#0055a5",
  sky: "#3d8fd1",
  light: "#7eb6e8",
  teal: "#2f7ec4",
  green: "#3d9b6a",
  /** Dark gold — readable on light backgrounds (avoid neon #fff200) */
  amber: "#c9a800",
  amberDark: "#8a6f00",
};

const BAR_COLORS = [MGI.blue, MGI.red, MGI.yellow, MGI.blueDark, MGI.sky, "#c4181e", "#e6da00", MGI.light];

/** Funnel uses a deeper gold so white/dark labels stay readable on "Submitted". */
const FUNNEL_COLORS = [MGI.blue, MGI.red, "#c9a800", MGI.blueDark, MGI.sky, "#c4181e", "#b8960a", "#2f7ec4"];

function isLightBarBackground(hex: string) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.72;
}

/** Shared Recharts motion */
export const CHART_ANIM = {
  isAnimationActive: true,
  animationDuration: 950,
  animationEasing: "ease-out" as const,
};

export const AXIS_TICK = { fontSize: 11, fill: MGI.ink, fontWeight: 600 as const };
export const GRID_STROKE = "rgba(42,74,110,0.12)";

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid rgba(0,85,165,0.18)",
  background: "#ffffff",
  color: "#2a4a6e",
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(47,126,196,0.12)",
};

/** High-contrast chip label — white bg + bold ink (clearly readable) */
function ChipLabel(props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string | null;
  formatter?: (v: unknown) => string;
  anchor?: "right" | "top" | "center";
  /** Extra px shift up (negative Y) — used to stagger dense bar labels */
  staggerY?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, value, formatter, anchor = "right", staggerY = 0 } = props;
  if (value === undefined || value === null || value === "") return null;

  const text = formatter ? formatter(value) : String(value);
  const numX = Number(x);
  const numY = Number(y);
  const numW = Number(width) || 0;
  const numH = Number(height) || 0;

  const approxCharW = 5.6;
  const padX = 4;
  const boxW = Math.max(22, text.length * approxCharW + padX * 2);
  const boxH = 16;

  let cx = numX;
  let cy = numY;

  if (anchor === "right") {
    cx = numX + (numW || 0) + 6;
    cy = numY + (numH ? numH / 2 : 0) - boxH / 2;
  } else if (anchor === "top") {
    if (numW > 0) {
      cx = numX + numW / 2 - boxW / 2;
      cy = numY - boxH - 4 - staggerY;
    } else {
      cx = numX - boxW / 2;
      cy = numY - boxH - 6 - staggerY;
    }
  } else {
    cx = numX + (numW || 0) / 2 - boxW / 2;
    cy = numY + (numH || 0) / 2 - boxH / 2;
  }

  return (
    <g style={{ pointerEvents: "none" }} className="chart-value-chip">
      <rect
        x={cx}
        y={cy}
        width={boxW}
        height={boxH}
        rx={4}
        ry={4}
        fill="#ffffff"
        stroke={MGI.blue}
        strokeWidth={1.5}
        filter="url(#chipShadow)"
      />
      <text
        x={cx + boxW / 2}
        y={cy + boxH / 2 + 3.2}
        textAnchor="middle"
        fill={MGI.ink}
        fontSize={9}
        fontWeight={800}
        letterSpacing="0.01em"
      >
        {text}
      </text>
    </g>
  );
}

/** SVG defs for label shadows — put once inside each chart */
export function ChartDefs() {
  return (
    <defs>
      <filter id="chipShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodColor="#2a4a6e" floodOpacity="0.22" />
      </filter>
    </defs>
  );
}

function makeChipLabel(
  anchor: "right" | "top" | "center",
  formatter?: (v: unknown) => string,
  opts?: {
    hideZero?: boolean;
    allowIndex?: (index: number, value: number) => boolean;
    /** Alternate vertical offset so adjacent bar chips don't collide */
    stagger?: boolean;
  }
) {
  // Recharts LabelList content props are loosely typed; accept any and pick fields we need.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const RenderChip = (props: any) => {
    const raw = Number(props.value);
    if (opts?.hideZero && (!Number.isFinite(raw) || raw === 0)) return null;
    const idx = typeof props.index === "number" ? props.index : -1;
    if (opts?.allowIndex && idx >= 0 && !opts.allowIndex(idx, raw)) return null;
    const staggerY = opts?.stagger && idx >= 0 ? (idx % 2 === 0 ? 0 : 16) : 0;
    return (
      <ChipLabel
        x={props.x}
        y={props.y}
        width={props.width}
        height={props.height}
        value={props.value}
        formatter={formatter}
        anchor={anchor}
        staggerY={staggerY}
      />
    );
  };
  RenderChip.displayName = `ChipLabel_${anchor}`;
  return RenderChip;
}

/** Pick up to `max` months for labels: first, last, and highest peaks — line charts only. */
function pickLabelIndices(values: number[], max = 5): Set<number> {
  const n = values.length;
  if (n === 0) return new Set();
  if (n <= max) return new Set(values.map((_, i) => i));
  const picks = new Set<number>([0, n - 1]);
  const ranked = values
    .map((v, i) => ({ v: Number(v) || 0, i }))
    .filter((d) => d.v > 0)
    .sort((a, b) => b.v - a.v);
  for (const d of ranked) {
    if (picks.size >= max) break;
    const near = [...picks].some((p) => Math.abs(p - d.i) === 1 && n > 6);
    if (near) continue;
    picks.add(d.i);
  }
  for (const d of ranked) {
    if (picks.size >= max) break;
    picks.add(d.i);
  }
  return picks;
}

function safeYDomain(pad = 1.18): [number, (max: number) => number] {
  return [
    0,
    (max: number) => {
      const m = Number(max);
      if (!Number.isFinite(m) || m <= 0) return 1;
      return m * pad;
    },
  ];
}

/** Department stacked bar — label at end of full bar (approved + pending). */
function makeDeptSpendBarLabel(formatter: ((v: unknown) => string) | undefined, segment: "approved" | "pending") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Render = (props: any) => {
    const payload = (props.payload ?? {}) as {
      approvedSpend?: number;
      pendingSpend?: number;
      total?: number;
    };
    const pending = Number(payload.pendingSpend) || 0;
    const total = Number(props.value ?? payload.total) || 0;
    if (!total) return null;

    // Pending segment draws label when pending > 0; approved draws when pending = 0.
    if (segment === "pending" && pending <= 0) return null;
    if (segment === "approved" && pending > 0) return null;

    return (
      <ChipLabel
        x={props.x}
        y={props.y}
        width={props.width}
        height={props.height}
        value={total}
        formatter={formatter}
        anchor="right"
      />
    );
  };
  Render.displayName = `DeptSpendLabel_${segment}`;
  return Render;
}

type ChartIconTone = "blue" | "red" | "yellow" | "sky" | "green";

const CHART_ICON_TONES: Record<
  ChartIconTone,
  { badge: string; glow: string; glowFade: string }
> = {
  blue: {
    badge:
      "bg-[#eef5fc] text-[#0055a5] ring-[#0055a5]/15 dark:bg-[#1a2d4a] dark:text-[#7eb6e8] dark:ring-white/10",
    glow: "rgba(0,85,165,0.38)",
    glowFade: "rgba(0,85,165,0)",
  },
  red: {
    badge:
      "bg-[#fde8e9] text-[#e31e24] ring-[#e31e24]/15 dark:bg-[#3a1520] dark:text-[#ff6b6f] dark:ring-[#e31e24]/30",
    glow: "rgba(227,30,36,0.38)",
    glowFade: "rgba(227,30,36,0)",
  },
  yellow: {
    badge:
      "bg-[#fff9cc] text-[#9a8a00] ring-[#fff200]/60 dark:bg-[#3a3510] dark:text-[#fff200] dark:ring-[#fff200]/30",
    glow: "rgba(212,168,0,0.42)",
    glowFade: "rgba(212,168,0,0)",
  },
  sky: {
    badge:
      "bg-[#e8f4fc] text-[#2f7ec4] ring-[#2f7ec4]/20 dark:bg-[#152a45] dark:text-[#7eb6e8] dark:ring-white/10",
    glow: "rgba(47,126,196,0.38)",
    glowFade: "rgba(47,126,196,0)",
  },
  green: {
    badge:
      "bg-[#e8f6ee] text-[#3d9b6a] ring-[#3d9b6a]/20 dark:bg-[#143028] dark:text-[#5dce8a] dark:ring-white/10",
    glow: "rgba(61,155,106,0.38)",
    glowFade: "rgba(61,155,106,0)",
  },
};

type IconMotionKind = "spin" | "bounce" | "sway" | "pulse" | "float";

function chartIconMotionKind(Icon: LucideIcon): IconMotionKind {
  const name = (Icon.displayName ?? Icon.name ?? "").toLowerCase();
  if (name.includes("refresh") || name.includes("rotate") || name.includes("sync")) return "spin";
  if (name.includes("trend") || name.includes("truck") || name.includes("cart") || name.includes("arrow"))
    return "bounce";
  if (name.includes("filter") || name.includes("hourglass") || name.includes("link") || name.includes("timer") || name.includes("clock"))
    return "sway";
  if (
    name.includes("pie") ||
    name.includes("wallet") ||
    name.includes("landmark") ||
    name.includes("building") ||
    name.includes("clipboard") ||
    name.includes("tag") ||
    name.includes("shield") ||
    name.includes("check") ||
    name.includes("table") ||
    name.includes("gauge") ||
    name.includes("percent") ||
    name.includes("banknote") ||
    name.includes("layout") ||
    name.includes("dollar") ||
    name.includes("file")
  )
    return "pulse";
  return "float";
}

function AnimatedChartIcon({
  Icon,
  kind,
  iconClassName = "h-4.5 w-4.5",
}: {
  Icon: LucideIcon;
  kind: IconMotionKind;
  iconClassName?: string;
}) {
  const motionByKind: Record<
    IconMotionKind,
    { animate: Record<string, number | number[]>; transition: Record<string, unknown> }
  > = {
    spin: {
      animate: { rotate: [0, 0, 360] },
      transition: { duration: 9, repeat: Infinity, ease: "linear", times: [0, 0.82, 1] },
    },
    bounce: {
      animate: { y: [0, -2.5, 0] },
      transition: { duration: 2.35, repeat: Infinity, ease: "easeInOut" },
    },
    sway: {
      animate: { rotate: [-7, 7, -7] },
      transition: { duration: 3.1, repeat: Infinity, ease: "easeInOut" },
    },
    pulse: {
      animate: { scale: [1, 1.14, 1] },
      transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
    },
    float: {
      animate: { y: [0, -1.75, 0] },
      transition: { duration: 2.9, repeat: Infinity, ease: "easeInOut" },
    },
  };

  const iconMotion = motionByKind[kind];

  return (
    <motion.span className="relative z-10 inline-flex" animate={iconMotion.animate} transition={iconMotion.transition}>
      <Icon className={iconClassName} strokeWidth={2.25} />
    </motion.span>
  );
}

function accentClassToGlow(accent: string): { glow: string; glowFade: string } {
  if (accent.includes("fff200")) {
    return { glow: "rgba(47,126,196,0.55)", glowFade: "rgba(47,126,196,0)" };
  }
  if (accent.includes("e31e24")) {
    return { glow: "rgba(255,255,255,0.44)", glowFade: "rgba(255,255,255,0)" };
  }
  if (accent.includes("3d9b6a")) {
    return { glow: "rgba(255,255,255,0.4)", glowFade: "rgba(255,255,255,0)" };
  }
  return { glow: "rgba(255,255,255,0.38)", glowFade: "rgba(255,255,255,0)" };
}

/** Soft or solid icon badge — glow, shimmer & icon-specific motion */
export function ChartIconBadge({
  icon: Icon,
  tone = "blue",
  variant = "soft",
  accentClass,
  className,
  delay = 0,
  iconClassName,
}: {
  icon: LucideIcon;
  tone?: ChartIconTone;
  variant?: "soft" | "solid";
  accentClass?: string;
  className?: string;
  delay?: number;
  iconClassName?: string;
}) {
  const isSolid = variant === "solid" && Boolean(accentClass);
  const softMeta = CHART_ICON_TONES[tone];
  const glowMeta = isSolid && accentClass ? accentClassToGlow(accentClass) : softMeta;
  const kind = chartIconMotionKind(Icon);
  const resolvedIconClass = iconClassName ?? (isSolid ? "h-4 w-4" : "h-4.5 w-4.5");
  const radiusClass = isSolid ? "rounded-lg" : "rounded-xl";

  return (
    <motion.span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden ring-1 shadow-sm",
        isSolid ? "h-8 w-8 ring-white/25" : "h-9 w-9",
        isSolid && accentClass
          ? cn(accentClass, accentClass.includes("fff200") ? "text-[#2f7ec4]" : "text-white")
          : softMeta.badge,
        radiusClass,
        className
      )}
      initial={{ opacity: 0, scale: 0.55, rotate: -16 }}
      whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
      viewport={{ once: true, margin: "-24px" }}
      transition={{ type: "spring", stiffness: 440, damping: 20, delay }}
      whileHover={{ scale: 1.14, rotate: 8, y: -3 }}
    >
      <motion.span
        aria-hidden
        className={cn("pointer-events-none absolute inset-0", radiusClass)}
        animate={{
          boxShadow: [`0 0 0 0 ${glowMeta.glow}`, `0 0 0 7px ${glowMeta.glowFade}`, `0 0 0 0 ${glowMeta.glow}`],
        }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
      />

      <motion.span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-r from-transparent to-transparent",
          isSolid ? "via-white/40" : "via-white/55 dark:via-white/18"
        )}
        animate={{ x: ["-130%", "230%"] }}
        transition={{ duration: 1.65, repeat: Infinity, repeatDelay: 3.8, ease: "easeInOut" }}
      />

      <motion.span
        aria-hidden
        className={cn("pointer-events-none absolute -inset-px opacity-60", radiusClass)}
        style={{
          background: `radial-gradient(circle at 30% 25%, ${glowMeta.glow}, transparent 62%)`,
        }}
        animate={{ opacity: [0.35, 0.75, 0.35] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.span
        aria-hidden
        className="absolute right-1 top-1 z-20 h-1 w-1 rounded-full bg-current"
        animate={{ opacity: [0.2, 0.9, 0.2], scale: [0.8, 1.35, 0.8] }}
        transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
      />

      <AnimatedChartIcon Icon={Icon} kind={kind} iconClassName={resolvedIconClass} />
    </motion.span>
  );
}

function ChartShell({
  title,
  description,
  children,
  className,
  contentClassName,
  actions,
  icon,
  iconTone = "blue",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
  iconTone?: "blue" | "red" | "yellow" | "sky" | "green";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      <Card className="h-full overflow-visible">
        <CardHeader className="relative z-20 overflow-visible">
          <div className="flex min-w-0 items-start gap-3">
            {icon && <ChartIconBadge icon={icon} tone={iconTone} />}
            <div className="min-w-0 flex-1">
              <CardTitle>{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
          {actions ? <div className="mt-3 w-full min-w-0">{actions}</div> : null}
        </CardHeader>
        <CardContent className={cn("overflow-hidden", contentClassName ?? "h-85")}>{children}</CardContent>
      </Card>
    </motion.div>
  );
}

function funnelStageLayout(stageCount: number) {
  if (stageCount >= 7) {
    return {
      contentClassName: "min-h-105 max-h-120 overflow-y-auto py-1",
      outerGap: "gap-0.5",
      innerGap: "gap-0.5",
      bar: "min-h-10 h-10",
      connector: "h-1",
      label: "text-[10px] leading-tight",
      iconBox: "h-4 w-4",
      iconSize: "h-2.5 w-2.5",
      count: "px-1.5 py-0 text-[10px]",
    };
  }
  if (stageCount >= 6) {
    return {
      contentClassName: "min-h-95 py-1",
      outerGap: "gap-1",
      innerGap: "gap-0.5",
      bar: "h-11",
      connector: "h-1.5",
      label: "text-[11px]",
      iconBox: "h-5 w-5",
      iconSize: "h-3 w-3",
      count: "px-2 py-0 text-[11px]",
    };
  }
  if (stageCount >= 5) {
    return {
      contentClassName: "min-h-95 py-1",
      outerGap: "gap-1.5",
      innerGap: "gap-0.5",
      bar: "h-12",
      connector: "h-2",
      label: "text-[11px]",
      iconBox: "h-5 w-5",
      iconSize: "h-3 w-3",
      count: "px-2 py-0 text-[11px]",
    };
  }
  return {
    contentClassName: "h-95",
    outerGap: "gap-2.5",
    innerGap: "gap-1",
    bar: "h-12",
    connector: "h-2.5",
    label: "text-xs",
    iconBox: "h-6 w-6",
    iconSize: "h-3.5 w-3.5",
    count: "px-2.5 py-0.5 text-[12px]",
  };
}

/** Month-range filter for monthly trend / spend charts */
type MonthPreset = "3" | "6" | "12" | "all" | "custom";

function monthKeyFromDate(iso: string): string {
  return iso.slice(0, 7);
}

function fillMonthlyGaps(data: MonthlyPoint[]): MonthlyPoint[] {
  if (data.length === 0) return [];
  const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
  const start = parseISO(`${sorted[0].month}-01`);
  const end = parseISO(`${sorted[sorted.length - 1].month}-01`);
  if (!isValid(start) || !isValid(end)) return sorted;

  const byMonth = new Map(sorted.map((d) => [d.month, d]));
  const out: MonthlyPoint[] = [];
  let cur = start;
  while (cur <= end) {
    const key = format(cur, "yyyy-MM");
    out.push(
      byMonth.get(key) ?? {
        month: key,
        purchaseRequisitions: 0,
        purchaseOrders: 0,
        spend: 0,
      }
    );
    cur = addMonths(cur, 1);
  }
  return out;
}

function getMonthlyDateBounds(data: MonthlyPoint[]) {
  if (data.length === 0) return { min: "", max: "" };
  const months = data.map((d) => d.month).sort();
  const first = parseISO(`${months[0]}-01`);
  const last = parseISO(`${months[months.length - 1]}-01`);
  if (!isValid(first) || !isValid(last)) return { min: "", max: "" };
  return {
    min: format(first, "yyyy-MM-dd"),
    max: format(endOfMonth(last), "yyyy-MM-dd"),
  };
}

function useMonthlyRangeFilter(data: MonthlyPoint[]) {
  const filledData = useMemo(() => fillMonthlyGaps(data), [data]);
  const bounds = useMemo(() => getMonthlyDateBounds(filledData), [filledData]);

  const [preset, setPreset] = useState<MonthPreset>("12");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const applyPreset = useCallback(
    (p: MonthPreset) => {
      if (!bounds.max || !bounds.min) {
        setFromDate("");
        setToDate("");
        return;
      }
      setPreset(p);
      const maxD = parseISO(bounds.max);
      if (!isValid(maxD)) return;

      if (p === "all") {
        setFromDate(bounds.min);
        setToDate(bounds.max);
        return;
      }

      const n = Number(p);
      const from = startOfMonth(addMonths(maxD, -(n - 1)));
      const minD = parseISO(bounds.min);
      setFromDate(format(from < minD ? minD : from, "yyyy-MM-dd"));
      setToDate(bounds.max);
    },
    [bounds]
  );

  useEffect(() => {
    if (!bounds.max) return;
    if (!fromDate || !toDate) applyPreset("12");
  }, [bounds, fromDate, toDate, applyPreset]);

  const onFromChange = (value: string) => {
    setPreset("custom");
    setFromDate(value);
    if (toDate && value && value > toDate) setToDate(value);
  };

  const onToChange = (value: string) => {
    setPreset("custom");
    setToDate(value);
    if (fromDate && value && value < fromDate) setFromDate(value);
  };

  const filtered = useMemo(() => {
    if (!fromDate || !toDate) return filledData;
    const fromM = monthKeyFromDate(fromDate);
    const toM = monthKeyFromDate(toDate);
    return filledData.filter((d) => d.month >= fromM && d.month <= toM);
  }, [filledData, fromDate, toDate]);

  const rangeLabel =
    fromDate && toDate
      ? `${fromDate} → ${toDate} (${filtered.length} mo.)`
      : filtered.length > 0
        ? `${filtered[0].month} → ${filtered[filtered.length - 1].month} (${filtered.length} mo.)`
        : "No data in range";

  return {
    preset,
    applyPreset,
    fromDate,
    toDate,
    onFromChange,
    onToChange,
    filtered,
    rangeLabel,
    bounds,
    // Keep chips off when many months — tooltip still shows exact values
    showLabels: filtered.length <= 8,
  };
}

function ChartDateFilter({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <DatePicker
      label={label}
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      compact
      placeholder="YYYY-MM-DD"
      className="w-[10.5rem] shrink-0"
    />
  );
}

function SeriesToggle({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-bold transition",
        active
          ? "shadow-sm"
          : "border-[#0055a5]/15 bg-white/60 text-[#6d8499] opacity-60 line-through dark:border-white/10 dark:bg-[#0f1c30]/60 dark:text-[#9aa8b8]"
      )}
      style={
        active
          ? { borderColor: color, backgroundColor: `${color}18`, color }
          : undefined
      }
      title={active ? `Hide ${label}` : `Show ${label}`}
    >
      {label}
    </button>
  );
}

function MonthlyChartFilterBar({
  filter,
  seriesToggles,
}: {
  filter: ReturnType<typeof useMonthlyRangeFilter>;
  seriesToggles?: React.ReactNode;
}) {
  const presets: { key: MonthPreset; label: string }[] = [
    { key: "3", label: "3M" },
    { key: "6", label: "6M" },
    { key: "12", label: "12M" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="flex w-full max-w-full flex-col items-stretch gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {presets.map(({ key, label }) => (
          <Button
            key={key}
            type="button"
            variant={filter.preset === key ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-[10px] font-bold"
            onClick={() => filter.applyPreset(key)}
            title={`Show last ${label === "All" ? "all months" : `${label.replace("M", "")} months`}`}
          >
            {label}
          </Button>
        ))}
        <span className="ml-1 text-[10px] font-medium text-[#6d8499] dark:text-[#9aa8b8]">
          {filter.rangeLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <ChartDateFilter
          label="From"
          value={filter.fromDate}
          onChange={filter.onFromChange}
          min={filter.bounds.min || undefined}
          max={filter.toDate || filter.bounds.max || undefined}
        />
        <ChartDateFilter
          label="To"
          value={filter.toDate}
          onChange={filter.onToChange}
          min={filter.fromDate || filter.bounds.min || undefined}
          max={filter.bounds.max || undefined}
        />
        {seriesToggles}
      </div>
    </div>
  );
}

function MonthlyChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[#6d8499] dark:text-[#9aa8b8]">
      {message}
    </div>
  );
}

function getPayloadName(d: unknown, key: string) {
  const obj = d as Record<string, unknown>;
  if (obj?.[key]) return String(obj[key]);
  if (obj?.payload && typeof obj.payload === "object") {
    const p = obj.payload as Record<string, unknown>;
    if (p[key]) return String(p[key]);
  }
  return "";
}

/** Readable legend row — avoids Recharts default overlap / low-contrast text */
function ChartLegendRow({
  payload,
}: {
  payload?: ReadonlyArray<{ value?: string; color?: string }>;
}) {
  if (!payload?.length) return null;
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pt-1">
      {payload.map((entry) => (
        <li
          key={String(entry.value)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2a4a6e] dark:text-[#e8f1fa]"
        >
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-[#0055a5]/15"
            style={{ backgroundColor: entry.color }}
          />
          {entry.value}
        </li>
      ))}
    </ul>
  );
}

export function HorizontalBarChartCard({
  title,
  description,
  data,
  onBarClick,
  valueLabel = "Count",
  icon,
  iconTone = "blue",
}: {
  title: string;
  description?: string;
  data: NamedCount[];
  onBarClick?: (name: string) => void;
  valueLabel?: string;
  icon?: LucideIcon;
  iconTone?: "blue" | "red" | "yellow" | "sky" | "green";
}) {
  const chartData = data.slice(0, 12).map((d) => ({ name: d.name, value: d.count }));
  return (
    <ChartShell title={title} description={description} icon={icon} iconTone={iconTone}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 72, top: 8, bottom: 8 }}>
          <ChartDefs />
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} />
          <YAxis type="category" dataKey="name" width={110} tick={AXIS_TICK} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatNumber(Number(v)), valueLabel]} />
          <Bar
            dataKey="value"
            radius={[0, 6, 6, 0]}
            barSize={18}
            cursor="pointer"
            {...CHART_ANIM}
            onClick={(d) => {
              const name = getPayloadName(d, "name");
              if (name) onBarClick?.(name);
            }}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
            <LabelList
              dataKey="value"
              content={makeChipLabel("right", (v) => formatNumber(Number(v)))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}


function funnelDocMeta(stage: string): { kind: "PR" | "PO" | "GRN"; unit: string; hint: string } {
  const s = stage.toLowerCase();
  if (s.includes("grn") || s.includes("goods received")) {
    return { kind: "GRN", unit: "GRNs", hint: "goods receipts" };
  }
  if (s.includes("requisition") || /\bprs?\b/.test(s) || s.startsWith("pr ")) {
    return { kind: "PR", unit: "PRs", hint: "unique purchase requisitions" };
  }
  return { kind: "PO", unit: "POs", hint: "unique purchase orders" };
}

export function FunnelChart({
  data,
  onStageClick,
}: {
  data: FunnelStage[];
  onStageClick?: (stage: string) => void;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const layout = funnelStageLayout(data.length);
  const stageIcon = (stage: string) => {
    const s = stage.toLowerCase();
    if (s.includes("requisition") || /\bprs?\b/.test(s)) return ClipboardList;
    if (s.includes("submit")) return FileSearch;
    if (s.includes("approv")) return BadgeCheck;
    if (s.includes("closed")) return CheckCircle2;
    if (s.includes("grn") || s.includes("goods") || s.includes("received")) return Package;
    if (s.includes("order") || s.includes("po")) return ShoppingCart;
    return FileSearch;
  };

  return (
    <ChartShell
      title="Procurement Funnel"
      description="PR → PO created → PO submitted → PO approved → PO closed · count = unique docs · click to drill"
      icon={Filter}
      iconTone="blue"
      contentClassName={layout.contentClassName}
    >
      <div className={cn("flex h-full flex-col justify-center px-2", layout.outerGap)}>
        {data.map((stage, i) => {
          const width = 52 + (stage.count / max) * 48;
          const StageIcon = stageIcon(stage.stage);
          const barColor = FUNNEL_COLORS[i % FUNNEL_COLORS.length];
          const lightBar = isLightBarBackground(barColor);
          const meta = funnelDocMeta(stage.stage);
          return (
            <motion.div
              key={stage.stage}
              className={cn("flex flex-col items-center", layout.innerGap)}
              initial={{ opacity: 0, scaleX: 0.72 }}
              whileInView={{ opacity: 1, scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              style={{ originX: 0.5 }}
            >
              <button
                type="button"
                title={`${stage.stage}: ${formatNumber(stage.count)} ${meta.hint}`}
                onClick={() => onStageClick?.(stage.stage)}
                className={cn(
                  "flex w-full max-w-full items-center justify-between gap-2 rounded-lg px-3 font-semibold shadow-sm transition hover:opacity-90 hover:brightness-105",
                  layout.bar,
                  layout.label,
                  lightBar ? "text-[#0055a5]" : "text-white"
                )}
                style={{ width: `${width}%`, backgroundColor: barColor }}
              >
                <span
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-1.5 truncate text-left",
                    lightBar ? "text-[#0055a5]" : "text-white drop-shadow"
                  )}
                >
                  <motion.span
                    className={cn(
                      "inline-flex shrink-0 items-center justify-center rounded-md",
                      layout.iconBox,
                      lightBar ? "bg-[#0055a5]/12" : "bg-white/20"
                    )}
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
                    whileHover={{ scale: 1.15, rotate: 8 }}
                  >
                    <motion.span
                      animate={{ y: [0, -1, 0] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.12 }}
                    >
                      <StageIcon className={layout.iconSize} strokeWidth={2.5} />
                    </motion.span>
                  </motion.span>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate">{stage.stage}</span>
                    <span
                      className={cn(
                        "truncate text-[9px] font-semibold uppercase tracking-wide opacity-90",
                        lightBar ? "text-[#0055a5]/80" : "text-white/85"
                      )}
                    >
                      {meta.kind} · {meta.hint}
                    </span>
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-md bg-white tabular-nums font-extrabold text-[#0055a5] shadow-sm",
                    layout.count
                  )}
                >
                  {formatNumber(stage.count)}{" "}
                  <span className="text-[9px] font-bold opacity-80">{meta.unit}</span>
                </span>
              </button>
              {i < data.length - 1 && <div className={cn("w-px bg-[#6d8499]/35", layout.connector)} />}
            </motion.div>
          );
        })}
      </div>
    </ChartShell>
  );
}


export function ApprovalDonut({
  data,
  onSliceClick,
}: {
  data: ApprovalStatusItem[];
  onSliceClick?: (name: string) => void;
}) {
  const colors: Record<string, string> = {
    Approved: MGI.blue,
    Pending: MGI.yellow,
    Rejected: MGI.red,
  };
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);

  return (
    <ChartShell title="Approval Status" description="Click a slice or status card to drill" icon={PieChartIcon} iconTone="sky">
      <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 h-50 sm:h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <ChartDefs />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={88}
                paddingAngle={3}
                cursor="pointer"
                {...CHART_ANIM}
                onClick={(d) => {
                  const name = getPayloadName(d, "name");
                  if (name) onSliceClick?.(name);
                }}
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={colors[d.name] || d.color} stroke="#fff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatNumber(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
          <motion.div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6d8499]">Total POs</div>
            <div className="text-lg font-extrabold text-[#0055a5]">{formatNumber(total)}</div>
          </motion.div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-40">
          {data.map((d, i) => {
            const pct = total ? Math.round((Number(d.value) / total) * 1000) / 10 : 0;
            const color = colors[d.name] || d.color;
            return (
              <motion.button
                key={d.name}
                type="button"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
                onClick={() => onSliceClick?.(d.name)}
                className="rounded-lg border border-[#0055a5]/15 bg-white p-2.5 text-left shadow-sm transition hover:border-[#0055a5] hover:shadow-md dark:border-white/10 dark:bg-[#0f1c30]"
              >
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-xs font-bold text-[#0055a5] dark:text-[#7eb6e8]">{d.name}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2 pl-5">
                  <span className="text-base font-extrabold tabular-nums text-[#2a4a6e] dark:text-[#e8f1fa]">
                    {formatNumber(Number(d.value))}
                  </span>
                  <span className="rounded bg-[#eef5fc] px-1.5 py-0.5 text-[11px] font-bold text-[#0055a5] dark:bg-[#1a2d4a] dark:text-[#7eb6e8]">{pct}%</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </ChartShell>
  );
}


export function DepartmentSpendChart({
  data,
  onClick,
}: {
  data: DepartmentSpend[];
  onClick?: (dept: string) => void;
}) {
  const chartData = data.slice(0, 10).map((d) => ({
    ...d,
    total: d.approvedSpend + d.pendingSpend,
    deptShort: d.department.length > 32 ? `${d.department.slice(0, 30)}…` : d.department,
  }));

  return (
    <ChartShell
      title="Department Wise Spending"
      description="Spend totals on bars · click to drill"
      icon={Building2}
      iconTone="blue"
      contentClassName="h-95 overflow-visible"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 4, right: 118, top: 8, bottom: 28 }}
          barCategoryGap="18%"
        >
          <ChartDefs />
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            tickFormatter={(v) => formatCurrency(Number(v), true)}
          />
          <YAxis
            type="category"
            dataKey="deptShort"
            width={148}
            tick={{ fontSize: 10, fill: MGI.ink, fontWeight: 600 }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) => [
              formatCurrency(Number(v)),
              name === "approvedSpend" ? "Approved" : name === "pendingSpend" ? "Pending" : String(name),
            ]}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as DepartmentSpend | undefined;
              return row?.department || "";
            }}
          />
          <Legend verticalAlign="bottom" content={(props) => <ChartLegendRow payload={props.payload} />} />
          <Bar
            dataKey="approvedSpend"
            stackId="deptSpend"
            fill={MGI.blue}
            name="Approved"
            barSize={20}
            cursor="pointer"
            isAnimationActive={false}
            onClick={(d) => {
              const name = getPayloadName(d, "department");
              if (name) onClick?.(name);
            }}
          >
            <LabelList
              dataKey="total"
              content={makeDeptSpendBarLabel((v) => formatCurrency(Number(v), true), "approved")}
            />
          </Bar>
          <Bar
            dataKey="pendingSpend"
            stackId="deptSpend"
            fill="#c9a800"
            name="Pending"
            radius={[0, 4, 4, 0]}
            barSize={20}
            cursor="pointer"
            isAnimationActive={false}
            onClick={(d) => {
              const name = getPayloadName(d, "department");
              if (name) onClick?.(name);
            }}
          >
            <LabelList
              dataKey="total"
              content={makeDeptSpendBarLabel((v) => formatCurrency(Number(v), true), "pending")}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}


export function LegalEntityChart({
  data,
  onClick,
}: {
  data: LegalEntity[];
  onClick?: (name: string) => void;
}) {
  const colors = [MGI.blue, MGI.red, MGI.yellow, MGI.blueDark, MGI.sky, MGI.light];
  const total = data.reduce((s, d) => s + (Number(d.spend) || 0), 0);
  const chartData = data.map((d, i) => ({
    ...d,
    color: colors[i % colors.length],
  }));

  return (
    <ChartShell
      title="Entity Wise Analysis"
      description="Click a slice or card to drill · labels stay clear"
      icon={Landmark}
      iconTone="red"
    >
      <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 h-50 sm:h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <ChartDefs />
              <Pie
                data={chartData}
                dataKey="spend"
                nameKey="name"
                innerRadius={54}
                outerRadius={86}
                paddingAngle={2}
                cursor="pointer"
                {...CHART_ANIM}
                onClick={(d) => {
                  const name = getPayloadName(d, "name");
                  if (name) onClick?.(name);
                }}
              >
                {chartData.map((d) => (
                  <Cell key={d.name} fill={d.color} stroke="#fff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
          <motion.div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6d8499]">Total spend</div>
            <div className="text-base font-extrabold text-[#0055a5]">{formatCurrency(total, true)}</div>
          </motion.div>
        </div>

        <div className="flex max-h-full w-full shrink-0 flex-col gap-1.5 overflow-auto sm:w-50">
          {chartData.map((d, i) => {
            const pct = total ? Math.round((Number(d.spend) / total) * 1000) / 10 : 0;
            return (
              <motion.button
                key={d.name}
                type="button"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.05, duration: 0.3 }}
                onClick={() => onClick?.(d.name)}
                className="rounded-lg border border-[#0055a5]/12 bg-white p-2 text-left shadow-sm transition hover:border-[#0055a5] hover:shadow-md dark:border-white/10 dark:bg-[#0f1c30]"
                title={d.name}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-[#0055a5] dark:text-[#7eb6e8]">{d.name}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2 pl-4.5">
                  <span className="text-sm font-extrabold tabular-nums text-[#2a4a6e] dark:text-[#e8f1fa]">
                    {formatCurrency(Number(d.spend), true)}
                  </span>
                  <span className="rounded bg-[#eef5fc] px-1.5 py-0.5 text-[10px] font-bold text-[#0055a5] dark:bg-[#1a2d4a] dark:text-[#7eb6e8]">
                    {pct}%
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </ChartShell>
  );
}


export function MonthlyTrendChart({
  data,
  onMonthClick,
}: {
  data: MonthlyPoint[];
  onMonthClick?: (month: string) => void;
}) {
  const filter = useMonthlyRangeFilter(data);
  const view = filter.filtered;
  const [showPRs, setShowPRs] = useState(true);
  const [showPOs, setShowPOs] = useState(true);
  const [showSpend, setShowSpend] = useState(true);

  const prLabelIdx = useMemo(
    () => pickLabelIndices(view.map((d) => Number(d.purchaseRequisitions) || 0), 4),
    [view]
  );
  const poLabelIdx = useMemo(
    () => pickLabelIndices(view.map((d) => Number(d.purchaseOrders) || 0), 4),
    [view]
  );
  const spendLabelIdx = useMemo(
    () => pickLabelIndices(view.map((d) => Number(d.spend) || 0), 4),
    [view]
  );

  return (
    <ChartShell
      title="Monthly Procurement Trend"
      description="Filter by date (year-month-day) · toggle PRs / POs / Spend · click month to drill"
      contentClassName="h-95 overflow-visible"
      actions={
        <MonthlyChartFilterBar
          filter={filter}
          seriesToggles={
            <div className="flex flex-wrap items-center gap-1">
              <SeriesToggle label="PRs" active={showPRs} color={MGI.blue} onClick={() => setShowPRs((v) => !v)} />
              <SeriesToggle label="POs" active={showPOs} color={MGI.red} onClick={() => setShowPOs((v) => !v)} />
              <SeriesToggle
                label="Spend"
                active={showSpend}
                color={MGI.amber}
                onClick={() => setShowSpend((v) => !v)}
              />
            </div>
          }
        />
      }
      icon={TrendingUp}
      iconTone="green"
    >
      {!showPRs && !showPOs && !showSpend ? (
        <MonthlyChartEmpty message="Turn on at least one series: PRs, POs, or Spend." />
      ) : view.length === 0 ? (
        <MonthlyChartEmpty message="No data in selected date range. Try 3M / 6M / 12M / All or change From-To dates." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={view}
            margin={{ left: 8, right: showSpend ? 56 : 16, top: 28, bottom: 12 }}
            onClick={(state) => {
              const label = (state as { activeLabel?: string })?.activeLabel;
              if (label) onMonthClick?.(String(label));
            }}
          >
            <ChartDefs />
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis
              dataKey="month"
              tick={AXIS_TICK}
              interval={view.length > 10 ? "preserveStartEnd" : 0}
              minTickGap={24}
              height={36}
            />
            <YAxis
              yAxisId="left"
              width={44}
              tick={AXIS_TICK}
              hide={!showPRs && !showPOs}
              domain={safeYDomain(1.12)}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              width={52}
              tick={AXIS_TICK}
              tickFormatter={(v) => formatCompactAxis(v)}
              hide={!showSpend}
              domain={safeYDomain(1.15)}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v, name) => (name === "Spend" ? formatCurrency(Number(v)) : formatNumber(Number(v)))}
            />
            <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} content={ChartLegendRow} />
            {showPRs && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="purchaseRequisitions"
                name="PRs"
                stroke={MGI.blue}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: MGI.blue, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                cursor="pointer"
                {...CHART_ANIM}
              >
                {filter.showLabels && (
                  <LabelList
                    dataKey="purchaseRequisitions"
                    content={makeChipLabel("top", (v) => formatNumber(Number(v)), {
                      hideZero: true,
                      allowIndex: (i) => prLabelIdx.has(i),
                    })}
                  />
                )}
              </Line>
            )}
            {showPOs && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="purchaseOrders"
                name="POs"
                stroke={MGI.red}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: MGI.red, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                cursor="pointer"
                {...CHART_ANIM}
                animationBegin={100}
              >
                {filter.showLabels && (
                  <LabelList
                    dataKey="purchaseOrders"
                    content={makeChipLabel("top", (v) => formatNumber(Number(v)), {
                      hideZero: true,
                      allowIndex: (i) => poLabelIdx.has(i),
                    })}
                  />
                )}
              </Line>
            )}
            {showSpend && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="spend"
                name="Spend"
                stroke={MGI.amber}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: MGI.yellow, stroke: MGI.amberDark, strokeWidth: 1.5 }}
                activeDot={{ r: 6 }}
                cursor="pointer"
                {...CHART_ANIM}
                animationBegin={200}
              >
                {filter.showLabels && (
                  <LabelList
                    dataKey="spend"
                    content={makeChipLabel("top", (v) => formatCompactAxis(Number(v)), {
                      hideZero: true,
                      allowIndex: (i) => spendLabelIdx.has(i),
                    })}
                  />
                )}
              </Line>
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}


export function SpendAreaChart({
  data,
  onMonthClick,
}: {
  data: MonthlyPoint[];
  onMonthClick?: (month: string) => void;
}) {
  const filter = useMonthlyRangeFilter(data);
  const view = filter.filtered;
  const dense = view.length > 8;

  return (
    <ChartShell
      title="Purchase Analysis"
      description="Monthly spend bars + trend line · filter by date · click a month to drill"
      actions={<MonthlyChartFilterBar filter={filter} />}
      icon={WalletCards}
      iconTone="yellow"
      contentClassName="h-95 overflow-visible"
    >
      {view.length === 0 ? (
        <MonthlyChartEmpty message="No data in selected date range. Try 3M / 6M / 12M / All or change From-To dates." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={view}
            margin={{ left: 4, right: 20, top: dense ? 48 : 40, bottom: dense ? 28 : 8 }}
            barCategoryGap={dense ? "18%" : "28%"}
            onClick={(state) => {
              const label = (state as { activeLabel?: string })?.activeLabel;
              if (label) onMonthClick?.(String(label));
            }}
          >
            <ChartDefs />
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis
              dataKey="month"
              tick={AXIS_TICK}
              interval={0}
              minTickGap={12}
              angle={dense ? -35 : 0}
              textAnchor={dense ? "end" : "middle"}
              height={dense ? 48 : 32}
              tickFormatter={(v) => {
                const s = String(v || "");
                if (dense && /^\d{4}-\d{2}$/.test(s)) {
                  const [y, m] = s.split("-");
                  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                  return `${names[Number(m) - 1] || m} ${y.slice(2)}`;
                }
                return s;
              }}
            />
            <YAxis
              width={52}
              tick={AXIS_TICK}
              tickFormatter={(v) => formatCompactAxis(v)}
              domain={safeYDomain(1.28)}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v) => [formatCurrency(Number(v)), "Spend"]}
              labelFormatter={(label) => `Month ${label}`}
            />
            <Bar
              dataKey="spend"
              name="Spend"
              fill={MGI.blue}
              radius={[6, 6, 0, 0]}
              maxBarSize={dense ? 40 : 52}
              cursor="pointer"
              {...CHART_ANIM}
            >
              {view.map((row, i) => (
                <Cell
                  key={`${row.month}-${i}`}
                  fill={Number(row.spend) > 0 ? MGI.blue : "#c5d6e8"}
                />
              ))}
              <LabelList
                dataKey="spend"
                content={makeChipLabel("top", (v) => formatCompactAxis(Number(v)), {
                  hideZero: true,
                  stagger: true,
                })}
              />
            </Bar>
            <Line
              type="monotone"
              dataKey="spend"
              name="Trend"
              stroke={MGI.red}
              strokeWidth={2.25}
              dot={{ r: 3, fill: MGI.red, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              legendType="none"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}


export function PurchaseTypeChart({
  data,
  onClick,
}: {
  data: PurchaseType[];
  onClick?: (name: string) => void;
}) {
  const colors = [MGI.blue, MGI.red, MGI.yellow, MGI.blueDark, MGI.sky, MGI.green, MGI.light];
  const totalSpend = data.reduce((s, d) => s + (Number(d.spend) || 0), 0);
  const totalPos = data.reduce((s, d) => s + (Number(d.poCount) || 0), 0);
  const chartData = data.map((d, i) => ({
    ...d,
    color: colors[i % colors.length],
  }));

  return (
    <ChartShell
      title="Purchase Type Mix"
      description="Spend share by demand type · click to drill"
      icon={Tags}
      iconTone="sky"
    >
      <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 h-50 sm:h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <ChartDefs />
              <Pie
                data={chartData}
                dataKey="spend"
                nameKey="name"
                innerRadius={54}
                outerRadius={86}
                paddingAngle={2}
                cursor="pointer"
                {...CHART_ANIM}
                onClick={(d) => {
                  const name = getPayloadName(d, "name");
                  if (name) onClick?.(name);
                }}
              >
                {chartData.map((d) => (
                  <Cell key={d.name} fill={d.color} stroke="#fff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, _n, item) => {
                  const row = item?.payload as PurchaseType | undefined;
                  return [
                    `${formatCurrency(Number(v))} · ${formatNumber(row?.poCount || 0)} POs`,
                    "Spend",
                  ];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <motion.div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6d8499]">Total spend</div>
            <div className="text-base font-extrabold text-[#0055a5]">{formatCurrency(totalSpend, true)}</div>
            <div className="text-[10px] font-semibold text-[#6d8499]">{formatNumber(totalPos)} POs</div>
          </motion.div>
        </div>

        <div className="flex max-h-full w-full shrink-0 flex-col gap-1.5 overflow-auto sm:w-52.5">
          {chartData.map((d, i) => {
            const pct = totalSpend ? Math.round((Number(d.spend) / totalSpend) * 1000) / 10 : 0;
            return (
              <motion.button
                key={d.name}
                type="button"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.05, duration: 0.3 }}
                onClick={() => onClick?.(d.name)}
                className="rounded-lg border border-[#0055a5]/12 bg-white p-2 text-left shadow-sm transition hover:border-[#0055a5] hover:shadow-md dark:border-white/10 dark:bg-[#0f1c30]"
                title={d.name}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-[#0055a5] dark:text-[#7eb6e8]">
                    {d.name}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2 pl-4.5">
                  <span className="text-sm font-extrabold tabular-nums text-[#2a4a6e] dark:text-[#e8f1fa]">
                    {formatCurrency(Number(d.spend), true)}
                  </span>
                  <span className="rounded bg-[#eef5fc] px-1.5 py-0.5 text-[10px] font-bold text-[#0055a5] dark:bg-[#1a2d4a] dark:text-[#7eb6e8]">
                    {pct}%
                  </span>
                </div>
                <div className="mt-0.5 pl-4.5 text-[10px] font-semibold text-[#6d8499] dark:text-[#9aa8b8]">
                  {formatNumber(d.poCount)} POs · {formatNumber(d.prCount)} PRs
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </ChartShell>
  );
}


export function PurchaseTypeVolumeChart({
  data,
  onClick,
}: {
  data: PurchaseType[];
  onClick?: (name: string) => void;
}) {
  const chartData = data.map((d) => ({
    ...d,
    label: d.name.length > 18 ? `${d.name.slice(0, 16)}…` : d.name,
  }));

  return (
    <ChartShell
      title="Purchase Type Volume"
      description="PO count by type · click to drill"
      icon={ClipboardList}
      iconTone="blue"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 72, top: 8, bottom: 8 }}>
          <ChartDefs />
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} />
          <YAxis type="category" dataKey="label" width={120} tick={AXIS_TICK} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) =>
              name === "poCount" ? [formatNumber(Number(v)), "POs"] : [formatCurrency(Number(v)), "Spend"]
            }
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as PurchaseType | undefined;
              return row?.name || "";
            }}
          />
          <Bar
            dataKey="poCount"
            radius={[0, 6, 6, 0]}
            fill={MGI.blue}
            barSize={18}
            cursor="pointer"
            {...CHART_ANIM}
            onClick={(d) => {
              const name = getPayloadName(d, "name");
              if (name) onClick?.(name);
            }}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
            <LabelList dataKey="poCount" content={makeChipLabel("right", (v) => formatNumber(Number(v)))} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}


const REVISION_BUCKET_LABELS: Record<string, string> = {
  "0": "Never revised",
  "1": "1 revision",
  "2": "2 revisions",
  "3": "3 revisions",
  "4+": "4+ revisions",
};

export function PoRevisionBucketChart({
  data,
  onBucketClick,
}: {
  data: PoRevisionBucket[];
  onBucketClick?: (bucket: string) => void;
}) {
  const chartData = data.map((d) => ({
    ...d,
    label: REVISION_BUCKET_LABELS[d.name] || d.name,
  }));

  return (
    <ChartShell
      title="PO Revision Count"
      description="Unique POs by times revised · stacked With PR / Without PR"
      icon={RefreshCw}
      iconTone="yellow"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 4, right: 8, top: 36, bottom: 8 }}>
          <ChartDefs />
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis dataKey="label" tick={AXIS_TICK} interval={0} angle={-18} textAnchor="end" height={52} />
          <YAxis tick={AXIS_TICK} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) => [
              formatNumber(Number(v)),
              name === "withPr" ? "With PR" : name === "withoutPr" ? "Without PR" : String(name),
            ]}
          />
          <Legend
            formatter={(value) => (value === "withPr" ? "With PR" : value === "withoutPr" ? "Without PR" : value)}
          />
          <Bar
            dataKey="withPr"
            stackId="rev"
            fill={MGI.blue}
            cursor="pointer"
            {...CHART_ANIM}
            onClick={(d) => {
              const name = getPayloadName(d, "name");
              if (name) onBucketClick?.(name);
            }}
          />
          <Bar
            dataKey="withoutPr"
            stackId="rev"
            fill={MGI.red}
            radius={[6, 6, 0, 0]}
            cursor="pointer"
            {...CHART_ANIM}
            animationBegin={80}
            onClick={(d) => {
              const name = getPayloadName(d, "name");
              if (name) onBucketClick?.(name);
            }}
          >
            <LabelList dataKey="total" content={makeChipLabel("top", (v) => formatNumber(Number(v)))} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}


export function PoRevisionLinkageChart({
  summary,
  onClick,
}: {
  summary: PoRevisionData["summary"];
  onClick?: (linkage: "withPr" | "withoutPr") => void;
}) {
  const chartData = [
    {
      name: "With PR",
      value: summary.withPr.revised,
      total: summary.withPr.total,
      key: "withPr" as const,
      color: MGI.blue,
    },
    {
      name: "Without PR",
      value: summary.withoutPr.revised,
      total: summary.withoutPr.total,
      key: "withoutPr" as const,
      color: MGI.red,
    },
  ];
  const totalRevised = summary.revisedPOs;

  return (
    <ChartShell
      title="Revised POs · PR Linkage"
      description="How many revised POs had a PR vs came without PR"
      icon={Link2}
      iconTone="red"
    >
      <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 h-50 sm:h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <ChartDefs />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={54}
                outerRadius={86}
                paddingAngle={3}
                cursor="pointer"
                {...CHART_ANIM}
                onClick={(d) => {
                  const key = getPayloadName(d, "key") as "withPr" | "withoutPr" | "";
                  if (key === "withPr" || key === "withoutPr") onClick?.(key);
                }}
              >
                {chartData.map((d) => (
                  <Cell key={d.key} fill={d.color} stroke="#fff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, _n, item) => {
                  const row = item?.payload as (typeof chartData)[number] | undefined;
                  return [
                    `${formatNumber(Number(v))} revised of ${formatNumber(row?.total || 0)} POs`,
                    row?.name || "",
                  ];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <motion.div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6d8499]">Revised POs</div>
            <div className="text-lg font-extrabold text-[#0055a5]">{formatNumber(totalRevised)}</div>
          </motion.div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-48">
          {chartData.map((d, i) => {
            const pct = totalRevised ? Math.round((d.value / totalRevised) * 1000) / 10 : 0;
            const Icon = d.key === "withPr" ? Link2 : Unlink;
            return (
              <motion.button
                key={d.key}
                type="button"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.08, duration: 0.3 }}
                onClick={() => onClick?.(d.key)}
                className="rounded-lg border border-[#0055a5]/12 bg-white p-2.5 text-left shadow-sm transition hover:border-[#0055a5] hover:shadow-md dark:border-white/10 dark:bg-[#0f1c30]"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: `${d.color}22` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: d.color }} />
                  </span>
                  <span className="text-xs font-bold text-[#0055a5] dark:text-[#7eb6e8]">{d.name}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2 pl-8">
                  <span className="text-base font-extrabold tabular-nums text-[#2a4a6e] dark:text-[#e8f1fa]">
                    {formatNumber(d.value)}
                  </span>
                  <span className="rounded bg-[#eef5fc] px-1.5 py-0.5 text-[11px] font-bold text-[#0055a5] dark:bg-[#1a2d4a] dark:text-[#7eb6e8]">
                    {pct}%
                  </span>
                </div>
                <div className="mt-0.5 pl-8 text-[10px] font-semibold text-[#6d8499]">
                  of {formatNumber(d.total)} {d.name.toLowerCase()} POs
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </ChartShell>
  );
}


export function PoRevisionTopChart({
  data,
  onClick,
}: {
  data: PoRevisionTopItem[];
  onClick?: (poNo: string) => void;
}) {
  const chartData = data.map((d) => ({
    ...d,
    label: d.poNo.length > 14 ? `${d.poNo.slice(0, 12)}…` : d.poNo,
  }));

  return (
    <ChartShell
      title="Most Revised POs"
      description="Top POs by revision count · click to open PO"
      icon={RefreshCw}
      iconTone="sky"
    >
      {chartData.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-[#6d8499]">No revised POs in this filter</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 56, top: 8, bottom: 8 }}>
            <ChartDefs />
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
            <YAxis type="category" dataKey="label" width={88} tick={AXIS_TICK} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v) => [formatNumber(Number(v)), "Revisions"]}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as PoRevisionTopItem | undefined;
                if (!row) return "";
                return `PO ${row.poNo} · ${row.linkage} · ${row.vendorName}`;
              }}
            />
            <Bar
              dataKey="revisedCount"
              radius={[0, 6, 6, 0]}
              fill={MGI.yellow}
              stroke={MGI.blue}
              strokeWidth={1}
              barSize={16}
              cursor="pointer"
              {...CHART_ANIM}
              onClick={(d) => {
                const po = getPayloadName(d, "poNo");
                if (po) onClick?.(po);
              }}
            >
              <LabelList dataKey="revisedCount" content={makeChipLabel("right", (v) => formatNumber(Number(v)))} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
}


export function VendorChart({
  data,
  onClick,
}: {
  data: Vendor[];
  onClick?: (vendorId: string, vendorName?: string) => void;
}) {
  const chartData = data.map((d) => ({
    ...d,
    // Short label for axis; full name stays in tooltip / drill
    label:
      (d.vendorName || d.vendorId).length > 22
        ? `${(d.vendorName || d.vendorId).slice(0, 20)}…`
        : d.vendorName || d.vendorId,
  }));

  return (
    <ChartShell title="Vendor Analysis" description="Vendor names on bars · click to drill" icon={Truck} iconTone="red">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 80, top: 8, bottom: 8 }}>
          <ChartDefs />
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatCurrency(v, true)} />
          <YAxis type="category" dataKey="label" width={128} tick={AXIS_TICK} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => formatCurrency(Number(v))}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as { vendorName?: string; vendorId?: string } | undefined;
              return row?.vendorName || row?.vendorId || "";
            }}
          />
          <Bar
            dataKey="spend"
            radius={[0, 6, 6, 0]}
            fill={MGI.red}
            barSize={18}
            cursor="pointer"
            {...CHART_ANIM}
            onClick={(d) => {
              const id = getPayloadName(d, "vendorId");
              const name = getPayloadName(d, "vendorName");
              if (id) onClick?.(id, name || undefined);
            }}
          >
            <LabelList
              dataKey="spend"
              content={makeChipLabel("right", (v) => formatCurrency(Number(v), true))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}


export function AgingChart({
  data,
  onClick,
}: {
  data: AgingBucket[];
  onClick?: (bucket: string) => void;
}) {
  const order = ["0-2 Days", "3-5 Days", "6-10 Days", "10+ Days"];
  const chartData = order.map((name) => data.find((d) => d.name === name) || { name, count: 0 });
  const colors = [MGI.blue, MGI.yellow, "#f5a623", MGI.red];
  return (
    <ChartShell title="Procurement Aging" description="Counts on bars · click to drill" icon={Hourglass} iconTone="yellow">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 4, right: 8, top: 36, bottom: 8 }}>
          <ChartDefs />
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis dataKey="name" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatNumber(Number(v))} />
          <Bar
            dataKey="count"
            radius={[6, 6, 0, 0]}
            barSize={42}
            cursor="pointer"
            {...CHART_ANIM}
            onClick={(d) => {
              const name = getPayloadName(d, "name");
              if (name) onClick?.(name);
            }}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={colors[i]} />
            ))}
            <LabelList dataKey="count" content={makeChipLabel("top", (v) => formatNumber(Number(v)))} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}


export function GrnFunnelChart({
  data,
  onStageClick,
}: {
  data: FunnelStage[];
  onStageClick?: (stage: string) => void;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const layout = funnelStageLayout(data.length);
  const stageIcon = (stage: string) => {
    const s = stage.toLowerCase();
    if (s.includes("approved")) return BadgeCheck;
    if (s.includes("submit")) return FileSearch;
    if (s.includes("receipt")) return Receipt;
    if (s.includes("received") && !s.includes("fully")) return PackageCheck;
    if (s.includes("accepted")) return ShieldCheck;
    if (s.includes("delivered")) return Truck;
    if (s.includes("fully")) return Package;
    return Package;
  };

  return (
    <ChartShell
      title="PO → GRN Funnel"
      description="Submitted → Approved → Receipt → … · cumulative · click to drill"
      icon={Package}
      iconTone="green"
      contentClassName={layout.contentClassName}
    >
      <div className={cn("flex flex-col justify-center px-1 sm:px-2", layout.outerGap)}>
        {data.map((stage, i) => {
          const width = 48 + (stage.count / max) * 52;
          const StageIcon = stageIcon(stage.stage);
          const barColor = FUNNEL_COLORS[i % FUNNEL_COLORS.length];
          const lightBar = isLightBarBackground(barColor);
          return (
            <motion.div
              key={stage.stage}
              className={cn("flex w-full flex-col items-center", layout.innerGap)}
              initial={{ opacity: 0, scaleX: 0.72 }}
              whileInView={{ opacity: 1, scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              style={{ originX: 0.5 }}
            >
              <button
                type="button"
                onClick={() => onStageClick?.(stage.stage)}
                className={cn(
                  "flex w-full max-w-full items-center justify-between gap-1.5 rounded-md px-2.5 font-semibold shadow-sm transition hover:opacity-90",
                  layout.bar,
                  layout.label,
                  lightBar ? "text-[#0055a5]" : "text-white"
                )}
                style={{ width: `${width}%`, backgroundColor: barColor }}
              >
                <span
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-1 text-left leading-tight",
                    lightBar ? "text-[#0055a5]" : "text-white drop-shadow"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center justify-center rounded",
                      layout.iconBox,
                      lightBar ? "bg-[#0055a5]/12" : "bg-white/20"
                    )}
                  >
                    <StageIcon className={layout.iconSize} strokeWidth={2.5} />
                  </span>
                  <span className="wrap-break-word">{stage.stage}</span>
                </span>
                <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-[#0055a5] shadow-sm">
                  {formatNumber(stage.count)}
                </span>
              </button>
            </motion.div>
          );
        })}
      </div>
    </ChartShell>
  );
}


export function PoToGrnAgingChart({
  data,
  onClick,
}: {
  data: AgingBucket[];
  onClick?: (bucket: string) => void;
}) {
  const order = ["0-7 Days", "8-14 Days", "15-30 Days", "30+ Days"];
  const chartData = order.map((name) => data.find((d) => d.name === name) || { name, count: 0 });
  const colors = [MGI.green, MGI.sky, MGI.yellow, MGI.red];
  return (
    <ChartShell title="PO → GRN Aging" description="Days from PO to GRN · click to drill" icon={Hourglass} iconTone="sky">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 4, right: 8, top: 36, bottom: 8 }}>
          <ChartDefs />
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis dataKey="name" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatNumber(Number(v))} />
          <Bar
            dataKey="count"
            radius={[6, 6, 0, 0]}
            barSize={42}
            cursor="pointer"
            {...CHART_ANIM}
            onClick={(d) => {
              const name = getPayloadName(d, "name");
              if (name) onClick?.(name);
            }}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={colors[i]} />
            ))}
            <LabelList dataKey="count" content={makeChipLabel("top", (v) => formatNumber(Number(v)))} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}


export function GrnReceivingOrgChart({
  data,
  onClick,
}: {
  data: GrnReceivingOrg[];
  onClick?: (org: string) => void;
}) {
  const chartData = data.slice(0, 12).map((d) => ({
    ...d,
    label: d.org.length > 24 ? `${d.org.slice(0, 22)}…` : d.org,
  }));
  return (
    <ChartShell title="GRN by Receiving Org" description="Amount received · click to drill" icon={Warehouse} iconTone="blue">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 80, top: 8, bottom: 8 }}>
          <ChartDefs />
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatCurrency(v, true)} />
          <YAxis type="category" dataKey="label" width={130} tick={AXIS_TICK} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => formatCurrency(Number(v))}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as GrnReceivingOrg | undefined;
              return row?.org || "";
            }}
          />
          <Bar
            dataKey="amountReceived"
            radius={[0, 6, 6, 0]}
            fill={MGI.blue}
            barSize={18}
            cursor="pointer"
            {...CHART_ANIM}
            onClick={(d) => {
              const org = (d as { payload?: GrnReceivingOrg }).payload?.org;
              if (org) onClick?.(org);
            }}
          >
            <LabelList
              dataKey="amountReceived"
              content={makeChipLabel("right", (v) => formatCurrency(Number(v), true))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}


export function GrnMonthlyChart({ data }: { data: GrnMonthlyPoint[] }) {
  return (
    <ChartShell title="GRN Monthly Trend" description="Receipts & amount received over time" icon={TrendingUp} iconTone="green">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 4, right: 8, top: 16, bottom: 8 }}>
          <ChartDefs />
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis dataKey="month" tick={AXIS_TICK} />
          <YAxis yAxisId="left" tick={AXIS_TICK} />
          <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} tickFormatter={(v) => formatCurrency(v, true)} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Area yAxisId="left" type="monotone" dataKey="receiptCount" name="Receipts" stroke={MGI.blue} fill={MGI.blue} fillOpacity={0.2} {...CHART_ANIM} />
          <Area yAxisId="right" type="monotone" dataKey="amountReceived" name="Amount" stroke={MGI.green} fill={MGI.green} fillOpacity={0.15} {...CHART_ANIM} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}


export function GrnVendorChart({
  data,
  onClick,
}: {
  data: GrnVendor[];
  onClick?: (vendorId: string, vendorName?: string) => void;
}) {
  const chartData = data.map((d) => ({
    ...d,
    label: (d.vendorName || d.vendorId).length > 22 ? `${(d.vendorName || d.vendorId).slice(0, 20)}…` : d.vendorName || d.vendorId,
  }));
  return (
    <ChartShell title="GRN Vendor Receipts" description="Amount received by vendor · click to drill" icon={Truck} iconTone="red">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 80, top: 8, bottom: 8 }}>
          <ChartDefs />
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatCurrency(v, true)} />
          <YAxis type="category" dataKey="label" width={128} tick={AXIS_TICK} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
          <Bar
            dataKey="amountReceived"
            radius={[0, 6, 6, 0]}
            fill={MGI.red}
            barSize={18}
            cursor="pointer"
            {...CHART_ANIM}
            onClick={(d) => {
              const row = (d as { payload?: GrnVendor }).payload;
              if (row?.vendorId) onClick?.(row.vendorId, row.vendorName);
            }}
          >
            <LabelList dataKey="amountReceived" content={makeChipLabel("right", (v) => formatCurrency(Number(v), true))} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}


export function GrnReturnRejectChart({
  data,
  onBucketClick,
  onVendorClick,
}: {
  data: GrnReturnRejectData;
  onBucketClick?: (key: string, label: string) => void;
  onVendorClick?: (vendorId: string, vendorName: string) => void;
}) {
  const { summary, buckets, topVendorsByReturn } = data;

  const issueBuckets = useMemo(
    () =>
      buckets
        .filter((b) => b.key !== "clean")
        .map((b) => ({
          ...b,
          shortName:
            b.key === "return"
              ? "Returned"
              : b.key === "acceptReject"
                ? "QC Reject"
                : "Not Delivered",
        })),
    [buckets]
  );

  const hasIssueLines = issueBuckets.some((b) => b.count > 0);
  const issueLineTotal =
    summary.returnLines + summary.acceptRejectLines + summary.deliveryGapLines;
  const cleanRate =
    summary.totalLines > 0
      ? Math.round((summary.cleanLines / summary.totalLines) * 1000) / 10
      : 0;

  const distribution = useMemo(() => {
    const slices = [
      { key: "clean", name: "All OK", value: summary.cleanLines, color: "#3d9b6a" },
      { key: "return", name: "Returned", value: summary.returnLines, color: "#e31e24" },
      {
        key: "acceptReject",
        name: "QC Reject",
        value: summary.acceptRejectLines,
        color: "#d4a800",
      },
      {
        key: "deliveryGap",
        name: "Not Delivered",
        value: summary.deliveryGapLines,
        color: "#2f7ec4",
      },
    ].filter((s) => s.value > 0);
    return slices.length ? slices : [{ key: "clean", name: "Clean", value: 1, color: "#3d9b6a" }];
  }, [summary]);

  const vendorData = useMemo(
    () =>
      topVendorsByReturn.slice(0, 8).map((v) => ({
        ...v,
        label: v.vendorName.length > 20 ? `${v.vendorName.slice(0, 18)}…` : v.vendorName,
      })),
    [topVendorsByReturn]
  );

  const statCards = [
    {
      key: "return",
      label: "Returned Items",
      value: formatNumber(summary.returnLines),
      hint: `${summary.returnRate}% of receipt lines`,
      border: "border-l-[#e31e24]",
      valueClass: "text-[#e31e24]",
      bg: "from-[#e31e24]/6 to-transparent",
      drillKey: "return" as const,
    },
    {
      key: "returnQty",
      label: "Return Quantity",
      value: formatNumber(summary.totalReturnQty),
      hint: "Total units sent back",
      border: "border-l-[#e31e24]",
      valueClass: "text-[#e31e24]",
      bg: "from-[#e31e24]/5 to-transparent",
      drillKey: null,
    },
    {
      key: "acceptReject",
      label: "QC Partial Reject",
      value: formatNumber(summary.acceptRejectLines),
      hint: `${summary.acceptRejectRate}% · received but not all accepted`,
      border: "border-l-[#d4a800]",
      valueClass: "text-[#9a7600] dark:text-[#fff200]",
      bg: "from-[#fff200]/10 to-transparent",
      drillKey: "acceptReject" as const,
    },
    {
      key: "deliveryGap",
      label: "Not Fully Delivered",
      value: formatNumber(summary.deliveryGapLines),
      hint: "accepted but not all delivered",
      border: "border-l-[#2f7ec4]",
      valueClass: "text-[#2f7ec4]",
      bg: "from-[#2f7ec4]/8 to-transparent",
      drillKey: "deliveryGap" as const,
    },
  ];

  return (
    <ChartShell
      title="GRN Receipt Quality"
      description="Returns · QC rejects · incomplete delivery · click any card to filter"
      icon={Undo2}
      iconTone="red"
      contentClassName="py-3"
    >
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {statCards.map((c) => (
          <button
            key={c.key}
            type="button"
            disabled={!c.drillKey}
            onClick={() => {
              if (!c.drillKey) return;
              const bucket = buckets.find((b) => b.key === c.drillKey);
              if (bucket) onBucketClick?.(bucket.key, bucket.name);
            }}
            className={cn(
              "rounded-xl border border-[#0055a5]/10 bg-linear-to-r px-3 py-2.5 text-left shadow-sm transition",
              "hover:border-[#0055a5]/25 hover:shadow-md dark:border-white/10",
              c.bg,
              c.drillKey ? "cursor-pointer" : "cursor-default",
              "border-l-4",
              c.border
            )}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#6d8499]">{c.label}</div>
            <div className={cn("mt-0.5 text-xl font-extrabold tabular-nums", c.valueClass)}>{c.value}</div>
            <div className="text-[10px] font-medium text-[#6d8499]">{c.hint}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-[#0055a5]/10 bg-[#f8fbff]/70 p-3 dark:border-white/10 dark:bg-[#0a1528]/40">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#6d8499]">
              Problem types
            </div>
            <span className="rounded-full bg-[#3d9b6a]/12 px-2 py-0.5 text-[10px] font-semibold text-[#3d9b6a]">
              {cleanRate}% all OK
            </span>
          </div>

          {hasIssueLines ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={issueBuckets} margin={{ left: 0, right: 36, top: 18, bottom: 4 }}>
                <ChartDefs />
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="shortName"
                  tick={{ ...AXIS_TICK, fontSize: 10 }}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={AXIS_TICK} width={32} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, _n, p) => {
                    const row = p?.payload as { qty?: number; name?: string } | undefined;
                    return [
                      `${formatNumber(Number(v))}${row?.qty ? ` · qty ${formatNumber(row.qty)}` : ""}`,
                      row?.name || "Lines",
                    ];
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                  maxBarSize={48}
                  cursor="pointer"
                  {...CHART_ANIM}
                  onClick={(d) => {
                    const row = (d as { payload?: { key?: string; name?: string } }).payload;
                    if (row?.key) onBucketClick?.(row.key, row.name || row.key);
                  }}
                >
                  {issueBuckets.map((b) => (
                    <Cell key={b.key} fill={b.color} />
                  ))}
                  <LabelList dataKey="count" content={makeChipLabel("top", (v) => formatNumber(Number(v)))} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-52.5 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#3d9b6a]/25 bg-[#3d9b6a]/5 px-4 text-center dark:border-[#3d9b6a]/30 dark:bg-[#3d9b6a]/8">
              <CheckCircle2 className="h-8 w-8 text-[#3d9b6a]" />
              <p className="text-sm font-semibold text-[#2a4a6e] dark:text-[#e8f1fa]">
                No problems in current filter
              </p>
              <p className="text-xs text-[#6d8499]">
                {formatNumber(summary.cleanLines)} lines all OK · click cards above to explore
              </p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#0055a5]/10 bg-[#f8fbff]/70 p-3 dark:border-white/10 dark:bg-[#0a1528]/40">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#6d8499]">
            {vendorData.length ? "Vendors with most returns" : "OK vs problem lines"}
          </div>

          {vendorData.length ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={vendorData} layout="vertical" margin={{ left: 0, right: 52, top: 4, bottom: 4 }}>
                <ChartDefs />
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={108}
                  tick={{ ...AXIS_TICK, fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatNumber(Number(v))} />
                <Bar
                  dataKey="returnQty"
                  radius={[0, 6, 6, 0]}
                  fill={MGI.red}
                  barSize={14}
                  maxBarSize={18}
                  cursor="pointer"
                  {...CHART_ANIM}
                  onClick={(d) => {
                    const row = (d as { payload?: { vendorId?: string; vendorName?: string } }).payload;
                    if (row?.vendorId) onVendorClick?.(row.vendorId, row.vendorName || row.vendorId);
                  }}
                >
                  <LabelList dataKey="returnQty" content={makeChipLabel("right", (v) => formatNumber(Number(v)))} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-52.5 flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={68}
                    paddingAngle={2}
                    stroke="none"
                    {...CHART_ANIM}
                    onClick={(d) => {
                      const row = d as { key?: string; name?: string };
                      if (row?.key) onBucketClick?.(row.key, row.name || row.key);
                    }}
                  >
                    {distribution.map((s) => (
                      <Cell key={s.key} fill={s.color} className="cursor-pointer" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v, name) => [formatNumber(Number(v)), String(name)]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
                {distribution.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#6d8499] transition hover:text-[#0055a5] dark:hover:text-[#7eb6e8]"
                    onClick={() => onBucketClick?.(s.key, s.name)}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name} · {formatNumber(s.value)}
                  </button>
                ))}
              </div>
              {issueLineTotal === 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[#6d8499]">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#d4a800]" />
                  No returns in filter — widen dates to see vendor returns
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </ChartShell>
  );
}

export function SplitPoWatchChart({
  data,
  onCreatorClick,
  onItemClick,
}: {
  data: SplitPoAnalysis;
  onCreatorClick?: (name: string) => void;
  onItemClick?: (code: string, desc: string) => void;
}) {
  const { summary, byCreator, byItemCode, dailyTrend } = data;
  const limitLac = summary.approvalLimitPkr / 100000;

  const truncateAxisLabel = (text: string, max = 24) => {
    const s = String(text || "").trim();
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  };

  const creatorData = byCreator.slice(0, 6).map((c) => ({
    ...c,
    label: truncateAxisLabel(c.name, 18),
    fullLabel: c.name,
  }));

  const itemData = byItemCode.slice(0, 6).map((i) => ({
    ...i,
    label: truncateAxisLabel(i.itemCode, 22),
    fullLabel: i.itemCode,
  }));

  const splitAxisTick = { ...AXIS_TICK, fontSize: 10, fill: MGI.ink };
  const splitValueLabel = makeChipLabel("right", (v) => formatCurrency(Number(v), true));

  const creatorAxisWidth = useMemo(
    () => Math.min(168, Math.max(96, ...creatorData.map((c) => c.label.length * 6.2))),
    [creatorData]
  );
  const itemAxisWidth = useMemo(
    () => Math.min(188, Math.max(108, ...itemData.map((i) => i.label.length * 5.6))),
    [itemData]
  );
  const barChartHeight = (rows: number) => Math.max(220, rows * 36 + 32);

  const trendData = useMemo(() => {
    const maxExcess = Math.max(0, ...dailyTrend.map((d) => Number(d.excessPkr) || 0));
    const labelThreshold = maxExcess > 0 ? maxExcess * 0.06 : 0;
    return dailyTrend.map((d) => {
      const excess = Number(d.excessPkr) || 0;
      const date = String(d.date || "");
      const prettyDate =
        date.length >= 10
          ? new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
          : date;
      const showLabel =
        excess > 0 && (dailyTrend.length <= 14 || excess >= labelThreshold || excess === maxExcess);
      return { ...d, prettyDate, showLabel };
    });
  }, [dailyTrend]);

  const splitTrendPointLabel = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Render = (props: any) => {
      if (!props?.payload?.showLabel) return null;
      return makeChipLabel("top", (v) => formatCurrency(Number(v), true))(props);
    };
    Render.displayName = "SplitTrendPointLabel";
    return Render;
  }, []);

  const trendChartHeight = Math.max(260, Math.min(300, trendData.length * 6 + 210));

  return (
    <ChartShell
      title="Split PO Watch"
      description={`Same creator + item code · ${summary.windowDays}-day window · COO limit ${limitLac.toFixed(0)} lac PKR · click to drill`}
      icon={ShieldAlert}
      iconTone="red"
      contentClassName="py-3"
    >
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          {
            label: "Suspicious clusters",
            value: formatNumber(summary.suspiciousClusters),
            hint: `${summary.highRiskClusters} high risk · ${summary.dedupedClusters ?? summary.suspiciousClusters} unique`,
            tone: "text-[#e31e24]",
          },
          {
            label: "Flagged POs",
            value: formatNumber(summary.flaggedPos),
            hint: "Distinct PO numbers",
            tone: "text-[#8a6f00] dark:text-[#e6c84a]",
          },
          {
            label: "Flagged creators",
            value: formatNumber(summary.flaggedCreators),
            hint: "PO creators",
            tone: "text-[#2f7ec4]",
          },
          {
            label: "Excess amount",
            value: formatCurrency(summary.totalExcessPkr, true),
            hint: "Above 5 lac limit · deduplicated POs",
            tone: "text-[#e31e24]",
          },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-l-4 border-l-[#e31e24]/60 border-[#0055a5]/10 bg-linear-to-r from-[#e31e24]/5 to-transparent px-3 py-2.5 shadow-sm dark:border-white/10"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#6d8499]">{c.label}</div>
            <div className={cn("mt-0.5 text-xl font-extrabold tabular-nums", c.tone)}>{c.value}</div>
            <div className="text-[10px] font-medium leading-snug text-[#6d8499]">{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <div className="rounded-xl border border-[#0055a5]/10 bg-[#f8fbff]/70 p-3 dark:border-white/10 dark:bg-[#0a1528]/40">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#2a4a6e]">By PO creator</div>
          {creatorData.length ? (
            <ResponsiveContainer width="100%" height={barChartHeight(creatorData.length)}>
              <BarChart
                data={creatorData}
                layout="vertical"
                margin={{ left: 4, right: 88, top: 4, bottom: 4 }}
              >
                <ChartDefs />
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                <XAxis
                  type="number"
                  tick={splitAxisTick}
                  tickFormatter={(v) => formatCurrency(Number(v), true)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={creatorAxisWidth}
                  tick={splitAxisTick}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [formatCurrency(Number(v)), "Excess PKR"]}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { fullLabel?: string; name?: string } | undefined;
                    return row?.fullLabel || row?.name || "";
                  }}
                />
                <Bar
                  dataKey="excessPkr"
                  fill={MGI.red}
                  stroke="#a8181e"
                  strokeWidth={1}
                  barSize={18}
                  radius={[0, 6, 6, 0]}
                  cursor="pointer"
                  {...CHART_ANIM}
                  onClick={(d) => {
                    const row = (d as { payload?: { name?: string } }).payload;
                    if (row?.name) onCreatorClick?.(row.name);
                  }}
                >
                  <LabelList dataKey="excessPkr" content={splitValueLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-55 items-center justify-center text-xs text-[#6d8499]">No split patterns in filter</div>
          )}
        </div>

        <div className="rounded-xl border border-[#0055a5]/10 bg-[#f8fbff]/70 p-3 dark:border-white/10 dark:bg-[#0a1528]/40">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#2a4a6e]">By item code</div>
          {itemData.length ? (
            <ResponsiveContainer width="100%" height={barChartHeight(itemData.length)}>
              <BarChart
                data={itemData}
                layout="vertical"
                margin={{ left: 4, right: 88, top: 4, bottom: 4 }}
              >
                <ChartDefs />
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                <XAxis
                  type="number"
                  tick={splitAxisTick}
                  tickFormatter={(v) => formatCurrency(Number(v), true)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={itemAxisWidth}
                  tick={splitAxisTick}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, _n, p) => {
                    const row = p?.payload as { itemDesc?: string; excessPkr?: number } | undefined;
                    return [formatCurrency(Number(row?.excessPkr ?? v)), row?.itemDesc || "Item"];
                  }}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { fullLabel?: string; itemCode?: string } | undefined;
                    return row?.fullLabel || row?.itemCode || "";
                  }}
                />
                <Bar
                  dataKey="excessPkr"
                  fill={MGI.amber}
                  stroke={MGI.amberDark}
                  strokeWidth={1.25}
                  barSize={18}
                  radius={[0, 6, 6, 0]}
                  cursor="pointer"
                  {...CHART_ANIM}
                  onClick={(d) => {
                    const row = (d as { payload?: { itemCode?: string; itemDesc?: string } }).payload;
                    if (row?.itemCode) onItemClick?.(row.itemCode, row.itemDesc || row.itemCode);
                  }}
                >
                  <LabelList dataKey="excessPkr" content={splitValueLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-55 items-center justify-center text-xs text-[#6d8499]">No item clusters detected</div>
          )}
        </div>

        <div className="rounded-xl border border-[#0055a5]/10 bg-[#f8fbff]/70 p-3 dark:border-white/10 dark:bg-[#0a1528]/40">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#2a4a6e]">Daily excess trend</div>
          {trendData.length ? (
            <ResponsiveContainer width="100%" height={trendChartHeight}>
              <AreaChart data={trendData} margin={{ left: 2, right: 12, top: 36, bottom: 24 }}>
                <ChartDefs />
                <defs>
                  <linearGradient id="splitExcessFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={MGI.red} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={MGI.red} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="prettyDate"
                  tick={{ ...splitAxisTick, fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  angle={-28}
                  textAnchor="end"
                  height={42}
                  interval={trendData.length > 16 ? Math.ceil(trendData.length / 8) - 1 : 0}
                />
                <YAxis
                  tick={splitAxisTick}
                  width={56}
                  tickFormatter={(v) => formatCurrency(Number(v), true)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, _n, p) => {
                    const row = p?.payload as { clusters?: number; poCount?: number; excessPkr?: number } | undefined;
                    const excess = Number(row?.excessPkr ?? v);
                    return [
                      formatCurrency(excess),
                      `Excess PKR · ${formatNumber(row?.clusters ?? 0)} clusters · ${formatNumber(row?.poCount ?? 0)} POs`,
                    ];
                  }}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { date?: string } | undefined;
                    return row?.date ? `Date: ${row.date}` : "";
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="excessPkr"
                  stroke={MGI.red}
                  fill="url(#splitExcessFill)"
                  strokeWidth={2.5}
                  dot={{
                    r: 3,
                    fill: MGI.red,
                    stroke: "#ffffff",
                    strokeWidth: 1.5,
                  }}
                  activeDot={{ r: 5, fill: MGI.red, stroke: "#ffffff", strokeWidth: 2 }}
                  {...CHART_ANIM}
                >
                  <LabelList dataKey="excessPkr" content={splitTrendPointLabel} />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-55 items-center justify-center text-xs text-[#6d8499]">No trend data</div>
          )}
        </div>
      </div>
    </ChartShell>
  );
}

