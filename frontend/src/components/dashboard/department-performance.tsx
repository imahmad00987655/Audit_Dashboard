"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  LabelList,
  ComposedChart,
  Line,
} from "recharts";
import type { DepartmentPerformance } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { useDashboard } from "@/context/dashboard-context";
import { MGI, CHART_ANIM, AXIS_TICK, GRID_STROKE, ChartDefs, ChartIconBadge } from "@/components/dashboard/charts";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  GitCompareArrows,
  Percent,
  Timer,
  Gauge,
  LayoutDashboard,
  Factory,
  Wrench,
  BedDouble,
  Building2,
  ShoppingCart,
  Layers,
  Scissors,
  FileText,
  Package,
  Wallet,
  BadgeCheck,
  Cog,
  Boxes,
  ClipboardList,
} from "lucide-react";

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid rgba(0,85,165,0.18)",
  background: "#ffffff",
  color: "#2a4a6e",
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(47,126,196,0.12)",
};

/** Pick a friendly icon from department name keywords */
function departmentIcon(name: string): LucideIcon {
  const s = name.toLowerCase();
  if (s.includes("without pr") || s.includes("manual")) return ShoppingCart;
  if (s.includes("pillow") || s.includes("wadding") || s.includes("foam") || s.includes("gao") || s.includes("mattress"))
    return BedDouble;
  if (s.includes("production") || s.includes("plant") || s.includes("manufactur")) return Factory;
  if (s.includes("common") || s.includes("general") || s.includes("shared")) return Layers;
  if (s.includes("zipper") || s.includes("stitch") || s.includes("sewing") || s.includes("textile")) return Scissors;
  if (s.includes("mechanical") || s.includes("maintenance") || s.includes("repair") || s.includes("utility"))
    return Wrench;
  if (s.includes("admin") || s.includes("hr") || s.includes("finance") || s.includes("office")) return Building2;
  if (s.includes("pack")) return Package;
  if (s.includes("store") || s.includes("warehouse") || s.includes("inventory")) return Boxes;
  if (s.includes("quality") || s.includes("qc")) return BadgeCheck;
  if (s.includes("engineering") || s.includes("tech")) return Cog;
  return ClipboardList;
}

const DEPT_ICON_TONES = ["blue", "red", "sky", "yellow", "green"] as const;

/** Short “what is this based on?” strip under chart titles */
function MetricBasis({ basis, formula }: { basis: string; formula: string }) {
  return (
    <div className="mt-2 rounded-lg border border-[#0055a5]/15 bg-[#eef5fc] px-2.5 py-1.5 dark:border-white/10 dark:bg-[#152a45]">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[#0055a5] dark:text-[#7eb6e8]">
        Basis: {basis}
      </div>
      <div className="mt-0.5 text-[11px] font-medium leading-snug text-[#2a4a6e] dark:text-[#c5d6e8]">
        {formula}
      </div>
    </div>
  );
}

function ValueChip(props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string | null;
  formatter?: (v: unknown) => string;
  anchor?: "right" | "top";
}) {
  const { x = 0, y = 0, width = 0, height = 0, value, formatter, anchor = "top" } = props;
  if (value === undefined || value === null || value === "") return null;
  const text = formatter ? formatter(value) : String(value);
  const numX = Number(x);
  const numY = Number(y);
  const numW = Number(width) || 0;
  const numH = Number(height) || 0;
  const boxW = Math.max(32, text.length * 7 + 14);
  const boxH = 20;
  let cx = numX;
  let cy = numY;
  if (anchor === "right") {
    cx = numX + numW + 6;
    cy = numY + numH / 2 - boxH / 2;
  } else if (numW > 0) {
    cx = numX + numW / 2 - boxW / 2;
    cy = numY - boxH - 4;
  } else {
    cx = numX - boxW / 2;
    cy = numY - boxH - 6;
  }
  return (
    <g style={{ pointerEvents: "none" }} className="chart-value-chip">
      <rect
        x={cx}
        y={cy}
        width={boxW}
        height={boxH}
        rx={5}
        fill="#ffffff"
        stroke={MGI.blue}
        strokeWidth={1.75}
        filter="url(#chipShadow)"
      />
      <text
        x={cx + boxW / 2}
        y={cy + boxH / 2 + 4}
        textAnchor="middle"
        fill={MGI.ink}
        fontSize={11}
        fontWeight={800}
      >
        {text}
      </text>
    </g>
  );
}

function shortName(name: string) {
  return name.length > 14 ? `${name.slice(0, 12)}…` : name;
}

export function DepartmentPerformanceCards({ data }: { data: DepartmentPerformance[] }) {
  const { pushDrill } = useDashboard();
  const list = data.slice(0, 8);

  if (!list.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-[#6d8499]">No department performance data.</CardContent>
      </Card>
    );
  }

  const spendData = list.map((d) => ({
    name: shortName(d.department),
    full: d.department,
    spend: d.spend,
  }));

  const volumeData = list.map((d) => ({
    name: shortName(d.department),
    full: d.department,
    pr: d.totalPR,
    po: d.totalPO,
  }));

  const approvalData = [...list]
    .sort((a, b) => b.approvalRate - a.approvalRate)
    .map((d) => ({
      name: shortName(d.department),
      full: d.department,
      rate: d.approvalRate,
      fill: d.approvalRate >= 99 ? MGI.blue : d.approvalRate >= 95 ? MGI.yellow : MGI.red,
    }));

  const processingData = list.map((d) => ({
    name: shortName(d.department),
    full: d.department,
    days: d.avgProcessingTime ?? 0,
    hasTiming: d.avgProcessingTime != null,
    daysLabel:
      d.avgProcessingTime == null
        ? "N/A"
        : d.avgProcessingTime === 0
          ? "0d"
          : `${d.avgProcessingTime}d`,
    metric: d.processingMetric || "",
    timedPos: d.processingPoCount || 0,
    pr: d.totalPR,
    po: d.totalPO,
  }));

  function processingBarColor(d: (typeof processingData)[number]) {
    if (!d.hasTiming) return MGI.gray;
    if (d.days >= 10) return MGI.red;
    if (d.days >= 5) return MGI.yellow;
    return MGI.blue;
  }

  const radarLike = list.map((d, i) => ({
    name: shortName(d.department),
    full: d.department,
    score: Math.min(100, Math.round(d.approvalRate * 0.6 + Math.min(40, (d.totalPO / (list[0]?.totalPO || 1)) * 40))),
    fill: [MGI.blue, MGI.red, MGI.yellow, MGI.blueDark, MGI.sky, "#c4181e", "#e6da00", MGI.light][i % 8],
  }));

  const drill = (full: string) => pushDrill({ level: "department", value: full, label: full });

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-start gap-3">
          <ChartIconBadge icon={LayoutDashboard} tone="blue" />
          <div>
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[#0055a5]">
              Department Performance
            </h2>
            <p className="text-xs text-[#6d8499]">
              Visual analytics · Approval Rate &amp; Processing Time are <span className="font-semibold text-[#0055a5]">PO-based</span> (not PR / GRN) · click to drill
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Spend ranking */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <ChartIconBadge icon={Banknote} tone="blue" />
              <div>
                <CardTitle>Department Wise Spending</CardTitle>
                <CardDescription>Top departments by PO amount (PKR)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendData} layout="vertical" margin={{ left: 4, right: 72, top: 8, bottom: 8 }}>
                <ChartDefs />
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatCurrency(v, true)} />
                <YAxis type="category" dataKey="name" width={100} tick={AXIS_TICK} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => formatCurrency(Number(v))}
                  labelFormatter={(_, payload) => String((payload?.[0]?.payload as { full?: string })?.full || "")}
                />
                <Bar
                  dataKey="spend"
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                  cursor="pointer"
                  {...CHART_ANIM}
                  onClick={(d) => {
                    const full = String((d as { full?: string }).full || (d as { payload?: { full?: string } }).payload?.full || "");
                    if (full) drill(full);
                  }}
                >
                  {spendData.map((_, i) => (
                    <Cell key={i} fill={i % 2 === 0 ? MGI.blue : MGI.red} />
                  ))}
                  <LabelList
                    dataKey="spend"
                    content={(p) => (
                      <ValueChip
                        x={p.x}
                        y={p.y}
                        width={p.width}
                        height={p.height}
                        value={p.value as string | number | undefined}
                        anchor="right"
                        formatter={(v) => formatCurrency(Number(v), true)}
                      />
                    )}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* PR vs PO volume */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <ChartIconBadge icon={GitCompareArrows} tone="red" />
              <div>
                <CardTitle>PR vs PO Volume</CardTitle>
                <CardDescription>Unique requisitions and purchase orders</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} margin={{ left: 4, right: 8, top: 32, bottom: 48 }}>
                <ChartDefs />
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="name" tick={AXIS_TICK} angle={-28} textAnchor="end" height={55} interval={0} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => formatNumber(Number(v))}
                  labelFormatter={(_, payload) => String((payload?.[0]?.payload as { full?: string })?.full || "")}
                />
                <Legend />
                <Bar
                  dataKey="pr"
                  name="PRs"
                  fill={MGI.blue}
                  radius={[4, 4, 0, 0]}
                  barSize={14}
                  cursor="pointer"
                  {...CHART_ANIM}
                  onClick={(d) => {
                    const full = String((d as { full?: string }).full || (d as { payload?: { full?: string } }).payload?.full || "");
                    if (full) drill(full);
                  }}
                >
                  <LabelList
                    dataKey="pr"
                    content={(p) => (
                      <ValueChip
                        x={p.x}
                        y={p.y}
                        width={p.width}
                        height={p.height}
                        value={p.value as string | number | undefined}
                        formatter={(v) => formatNumber(Number(v))}
                      />
                    )}
                  />
                </Bar>
                <Bar
                  dataKey="po"
                  name="POs"
                  fill={MGI.red}
                  radius={[4, 4, 0, 0]}
                  barSize={14}
                  cursor="pointer"
                  {...CHART_ANIM}
                  onClick={(d) => {
                    const full = String((d as { full?: string }).full || (d as { payload?: { full?: string } }).payload?.full || "");
                    if (full) drill(full);
                  }}
                >
                  <LabelList
                    dataKey="po"
                    content={(p) => (
                      <ValueChip
                        x={p.x}
                        y={p.y}
                        width={p.width}
                        height={p.height}
                        value={p.value as string | number | undefined}
                        formatter={(v) => formatNumber(Number(v))}
                      />
                    )}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Approval rate */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <ChartIconBadge icon={Percent} tone="green" />
              <div className="min-w-0 flex-1">
                <CardTitle>Approval Rate</CardTitle>
                <CardDescription>Higher is better · blue ≥99% · yellow ≥95% · red below</CardDescription>
                <MetricBasis
                  basis="Purchase Orders (PO) — not PR or GRN"
                  formula="Approved POs ÷ Total POs × 100 · Approved = PO_APPROVE is APPROVE"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={approvalData} layout="vertical" margin={{ left: 4, right: 56, top: 8, bottom: 8 }}>
                <ChartDefs />
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={AXIS_TICK} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={100} tick={AXIS_TICK} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [formatPercent(Number(v)), "PO approval rate"]}
                  labelFormatter={(_, payload) => String((payload?.[0]?.payload as { full?: string })?.full || "")}
                />
                <Bar
                  dataKey="rate"
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                  cursor="pointer"
                  {...CHART_ANIM}
                  onClick={(d) => {
                    const full = String((d as { full?: string }).full || (d as { payload?: { full?: string } }).payload?.full || "");
                    if (full) drill(full);
                  }}
                >
                  {approvalData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                  <LabelList
                    dataKey="rate"
                    content={(p) => (
                      <ValueChip
                        x={p.x}
                        y={p.y}
                        width={p.width}
                        height={p.height}
                        value={p.value as string | number | undefined}
                        anchor="right"
                        formatter={(v) => formatPercent(Number(v))}
                      />
                    )}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Processing time + PR overlay */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <ChartIconBadge icon={Timer} tone="yellow" />
              <div className="min-w-0 flex-1">
                <CardTitle>Avg Processing Time</CardTitle>
                <CardDescription>Average cycle days for finalized POs only (GRN not included)</CardDescription>
                <MetricBasis
                  basis="Purchase Order cycle — not GRN"
                  formula="PR-linked: PR create → Final approve · Direct PO (no PR): PO create → Final approve · then average"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={processingData} margin={{ left: 4, right: 8, top: 32, bottom: 48 }}>
                <ChartDefs />
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="name" tick={AXIS_TICK} angle={-28} textAnchor="end" height={55} interval={0} />
                <YAxis yAxisId="left" tick={AXIS_TICK} />
                <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, name, item) => {
                    if (name === "PR count") return [formatNumber(Number(v)), "PR count"];
                    if (name === "PO count") return [formatNumber(Number(v)), "PO count"];
                    const row = (item?.payload ?? {}) as (typeof processingData)[number];
                    if (!row.hasTiming) {
                      return [`No submit/PR dates · ${formatNumber(row.po || 0)} POs`, "Avg days"];
                    }
                    const dayText =
                      row.days === 0 ? "0 days (same calendar day)" : `${row.days} days`;
                    return [
                      `${dayText} · ${row.metric || "Avg cycle"} · ${formatNumber(row.timedPos || 0)}/${formatNumber(row.po || 0)} POs timed`,
                      "Avg days",
                    ];
                  }}
                  labelFormatter={(_, payload) => String((payload?.[0]?.payload as { full?: string })?.full || "")}
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="days"
                  name="Avg days"
                  fill={MGI.blue}
                  minPointSize={6}
                  radius={[4, 4, 0, 0]}
                  barSize={22}
                  cursor="pointer"
                  {...CHART_ANIM}
                  onClick={(d) => {
                    const full = String((d as { full?: string }).full || (d as { payload?: { full?: string } }).payload?.full || "");
                    if (full) drill(full);
                  }}
                >
                  {processingData.map((d, i) => (
                    <Cell key={i} fill={processingBarColor(d)} />
                  ))}
                  <LabelList
                    dataKey="daysLabel"
                    content={(p) => {
                      const row = processingData[p.index ?? 0];
                      if (!row) return null;
                      return (
                        <ValueChip
                          x={p.x}
                          y={p.y}
                          width={p.width}
                          height={p.height}
                          value={row.daysLabel}
                          formatter={(v) => String(v)}
                        />
                      );
                    }}
                  />
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="pr"
                  name="PR count"
                  stroke={MGI.yellow}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: MGI.blueDark, stroke: MGI.yellow, strokeWidth: 2 }}
                  {...CHART_ANIM}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="po"
                  name="PO count"
                  stroke={MGI.red}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={{ r: 3, fill: MGI.red, stroke: "#fff", strokeWidth: 1 }}
                  {...CHART_ANIM}
                  animationBegin={120}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Performance snapshot — compact row, clear numbers */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <ChartIconBadge icon={Gauge} tone="sky" />
            <div>
              <CardTitle>Performance Snapshot</CardTitle>
              <CardDescription>Composite score from approval rate + PO volume · click to drill</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-[#0055a5]/15 bg-[#eef5fc]/60 p-3 dark:bg-[#0055a5]/10">
            <div className="grid items-center gap-3 md:grid-cols-[180px_1fr]">
              <div className="mx-auto size-42.5">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="24%"
                    outerRadius="100%"
                    data={radarLike}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <ChartDefs />
                    <RadialBar
                      background={{ fill: "rgba(0,85,165,0.08)" }}
                      dataKey="score"
                      cornerRadius={4}
                      cursor="pointer"
                      {...CHART_ANIM}
                      onClick={(d) => {
                        const full = String(
                          (d as { full?: string }).full ||
                            (d as { payload?: { full?: string } }).payload?.full ||
                            ""
                        );
                        if (full) drill(full);
                      }}
                    >
                      {radarLike.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </RadialBar>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v) => [`Score ${v}`, "Performance"]}
                      labelFormatter={(_, payload) =>
                        String((payload?.[0]?.payload as { full?: string })?.full || "")
                      }
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {radarLike.map((d) => {
                  const Icon = departmentIcon(d.full);
                  return (
                  <button
                    key={d.full}
                    type="button"
                    onClick={() => drill(d.full)}
                    className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-left shadow-sm transition hover:ring-1 hover:ring-[#0055a5]"
                    title={d.full}
                  >
                    <span
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white"
                      style={{ backgroundColor: d.fill }}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#0055a5]">
                      {d.full}
                    </span>
                    <span className="shrink-0 rounded bg-[#0055a5] px-2 py-0.5 text-xs font-bold tabular-nums text-white">
                      {d.score}
                    </span>
                  </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {list.map((d, i) => {
              const DeptIcon = departmentIcon(d.department);
              const tone = DEPT_ICON_TONES[i % DEPT_ICON_TONES.length];
              return (
              <button
                key={d.department}
                type="button"
                onClick={() => drill(d.department)}
                className="rounded-xl border border-[#0055a5]/20 bg-[#eef5fc] p-3 text-left transition hover:border-[#e31e24] hover:shadow-md dark:border-white/10 dark:bg-[#152a45]"
              >
                <div className="flex items-center gap-2.5">
                  <ChartIconBadge icon={DeptIcon} tone={tone} className="h-8 w-8 rounded-lg" />
                  <div className="min-w-0 truncate font-display text-sm font-bold text-[#0055a5] dark:text-[#fff200]">
                    {d.department}
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white px-2 py-1.5 shadow-sm dark:bg-[#0f1c30]">
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#6d8499] dark:text-[#9aa8b8]">
                      <FileText className="h-3 w-3 text-[#0055a5] dark:text-[#7eb6e8]" />
                      PR
                    </div>
                    <div className="text-base font-bold tabular-nums text-[#0055a5] dark:text-[#7eb6e8]">{formatNumber(d.totalPR)}</div>
                  </div>
                  <div className="rounded-lg bg-white px-2 py-1.5 shadow-sm dark:bg-[#0f1c30]">
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#6d8499] dark:text-[#9aa8b8]">
                      <Package className="h-3 w-3 text-[#e31e24]" />
                      PO
                    </div>
                    <div className="text-base font-bold tabular-nums text-[#e31e24]">{formatNumber(d.totalPO)}</div>
                  </div>
                  <div className="rounded-lg bg-white px-2 py-1.5 shadow-sm dark:bg-[#0f1c30]">
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#6d8499] dark:text-[#9aa8b8]">
                      <Wallet className="h-3 w-3 text-[#2f7ec4]" />
                      Spend
                    </div>
                    <div className="text-sm font-bold tabular-nums text-[#2a4a6e] dark:text-[#e8f1fa]">
                      {formatCurrency(d.spend, true)}
                    </div>
                  </div>
                  <div
                    className="rounded-lg bg-white px-2 py-1.5 shadow-sm dark:bg-[#0f1c30]"
                    title="PO approval rate: Approved POs ÷ Total POs (not PR/GRN)"
                  >
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#6d8499] dark:text-[#9aa8b8]">
                      <BadgeCheck className="h-3 w-3 text-[#3d9b6a]" />
                      PO Rate
                    </div>
                    <div className="text-sm font-bold tabular-nums text-[#0055a5] dark:text-[#7eb6e8]">
                      {formatPercent(d.approvalRate)}
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white dark:bg-[#0f1c30]">
                      <div
                        className="h-full rounded-full bg-[#0055a5]"
                        style={{ width: `${Math.min(100, d.approvalRate)}%` }}
                      />
                    </div>
                    <div className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#fff200] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#2f7ec4]">
                      <Timer className="h-3 w-3" />
                      {d.avgProcessingTime != null ? `${d.avgProcessingTime}d avg` : "N/A"}
                    </div>
                  </div>
                  {d.processingMetric && d.avgProcessingTime != null && (
                    <div className="truncate text-[10px] font-medium text-[#6d8499]" title={d.processingMetric}>
                      {d.processingMetric}
                    </div>
                  )}
                </div>
              </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
