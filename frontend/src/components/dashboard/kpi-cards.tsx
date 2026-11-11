"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, Info, Wallet, CircleDollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { ChartIconBadge } from "@/components/dashboard/charts";
import { cn, formatCurrency, formatForeignAmount, formatNumber } from "@/lib/utils";
import type { CurrencySpend } from "@/lib/api";

interface KpiCardProps {
  title: string;
  value: number;
  formatter?: (n: number) => string;
  icon: LucideIcon;
  tooltip?: string;
  accent?: string;
  gaugeColor?: string;
  gauge?: number;
  deltaLabel?: string;
  onClick?: () => void;
  delay?: number;
}

function accentToColor(accent: string): string {
  if (accent.includes("e31e24")) return "#e31e24";
  if (accent.includes("fff200")) return "#d4a800";
  if (accent.includes("2f7ec4")) return "#2f7ec4";
  if (accent.includes("3d9b6a")) return "#3d9b6a";
  return "#0055a5";
}

/** Yellow delta chip with animated trending arrow */
function AnimatedDeltaChip({ label, delay = 0 }: { label: string; delay?: number }) {
  return (
    <motion.div
      className="relative mt-2.5 inline-flex max-w-full items-center gap-1 overflow-hidden rounded-md bg-[#fff200] px-2 py-0.5 text-2.5 font-bold text-[#2f7ec4] dark:text-[#0a1628]"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.38, delay: delay + 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-white/55 to-transparent"
        animate={{ x: ["-125%", "225%"] }}
        transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 4.2, ease: "easeInOut" }}
      />

      <motion.span
        aria-hidden
        className="pointer-events-none absolute -left-0.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#2f7ec4]/15"
        animate={{ scale: [0.6, 1.8], opacity: [0.45, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
      />

      <motion.span
        className="relative inline-flex shrink-0"
        animate={{ y: [0, -2.5, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 1.55, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.span
          animate={{ rotate: [-4, 4, -4] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <TrendingUp className="h-3 w-3" strokeWidth={2.75} />
        </motion.span>
      </motion.span>

      <motion.span
        className="relative truncate"
        animate={{ opacity: [0.88, 1, 0.88] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        {label}
      </motion.span>
    </motion.div>
  );
}

/** Large, readable semi-circle speedometer */
function SpeedGauge({
  value,
  color,
  delay = 0,
}: {
  value: number;
  color: string;
  delay?: number;
}) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const r = 42;
  const cx = 60;
  const cy = 54;
  const startAngle = Math.PI;
  const endAngle = 0;
  const angle = startAngle + (endAngle - startAngle) * (pct / 100);

  const polar = (a: number, radius = r) => ({
    x: cx + radius * Math.cos(a),
    y: cy - radius * Math.sin(a),
  });

  const start = polar(startAngle);
  const end = polar(endAngle);
  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 0 ${end.x} ${end.y}`;
  const circumference = Math.PI * r;
  const dash = (pct / 100) * circumference;

  const needleLen = r - 10;
  const nx = cx + needleLen * Math.cos(angle);
  const ny = cy - needleLen * Math.sin(angle);

  return (
    <div className="flex w-full flex-col items-center">
      <svg viewBox="0 0 120 70" className="h-18 w-full max-w-35 overflow-visible">
        {/* tick marks */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const a = startAngle + (endAngle - startAngle) * t;
          const o = polar(a, r + 1);
          const i = polar(a, r - 7);
          return (
            <line
              key={t}
              x1={i.x}
              y1={i.y}
              x2={o.x}
              y2={o.y}
              stroke="rgba(42,74,110,0.28)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}

        {/* track */}
        <path d={trackPath} fill="none" stroke="var(--mgi-blue-soft)" strokeWidth={11} strokeLinecap="round" />

        {/* progress */}
        <motion.path
          d={trackPath}
          fill="none"
          stroke={color}
          strokeWidth={11}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - dash }}
          transition={{ duration: 1.1, delay: delay + 0.12, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* needle */}
        <motion.line
          x1={cx}
          y1={cy}
          initial={{ x2: cx - needleLen, y2: cy }}
          animate={{ x2: nx, y2: ny }}
          transition={{ duration: 1, delay: delay + 0.18, ease: [0.22, 1, 0.36, 1] }}
          stroke="#2a4a6e"
          strokeWidth={2.75}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={6} fill="#ffffff" stroke={color} strokeWidth={2.5} />
        <circle cx={cx} cy={cy} r={2.5} fill={color} />
      </svg>

      {/* % below arc — never overlaps needle */}
      <div
        className="mt-0.5 rounded-full px-2.5 py-0.5 text-sm font-extrabold tabular-nums text-white shadow-sm"
        style={{ backgroundColor: color }}
      >
        {Math.round(pct)}%
      </div>
    </div>
  );
}

export function KpiCard({
  title,
  value,
  formatter,
  icon: Icon,
  tooltip,
  accent = "bg-[#0055a5]",
  gaugeColor,
  gauge = 0,
  deltaLabel = "Live",
  onClick,
  delay = 0,
}: KpiCardProps) {
  const color = gaugeColor || accentToColor(accent);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      className="group text-left"
      title={tooltip}
    >
      <Card className="relative overflow-hidden border-[#0055a5]/15 p-4 shadow-sm transition-shadow group-hover:shadow-md">
        <div className={cn("absolute inset-x-0 top-0 h-1.5", accent)} />

        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-2.75 font-semibold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
            <span className="truncate">{title}</span>
            {tooltip && <Info className="h-3 w-3 shrink-0 opacity-60" />}
          </div>
          <ChartIconBadge icon={Icon} variant="solid" accentClass={accent} delay={delay} />
        </div>

        {/* Value + gauge side by side — gauge bigger & clear */}
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0 shrink">
            <div className="text-6.5 font-bold leading-none tracking-tight text-[#0055a5] dark:text-[#7eb6e8]">
              <AnimatedCounter value={value} formatter={formatter} />
            </div>
            <AnimatedDeltaChip label={deltaLabel} delay={delay} />
          </div>

          <div className="shrink-0">
            <SpeedGauge value={gauge} color={color} delay={delay} />
          </div>
        </div>
      </Card>
    </motion.button>
  );
}

function SpendSection({
  label,
  value,
  subtitle,
  accentClass,
}: {
  label: string;
  value: string;
  subtitle: string;
  accentClass: string;
}) {
  return (
    <div className="flex min-w-0 flex-col px-1.5 first:pl-0 last:pr-0">
      <div className="truncate text-2 font-semibold uppercase tracking-wide text-[#6d8499] dark:text-[#9aa8b8]">
        {label}
      </div>
      <div className={cn("mt-0.5 truncate text-sm font-bold leading-tight tabular-nums", accentClass)}>
        {value}
      </div>
      <div className="mt-0.5 truncate text-2.25 leading-tight text-[#6d8499] dark:text-[#9aa8b8]" title={subtitle}>
        {subtitle}
      </div>
    </div>
  );
}

export function CurrencySpendKpiCard({
  currencySpend,
  poLinkedShare = 0,
  delay = 0,
}: {
  currencySpend: CurrencySpend;
  poLinkedShare?: number;
  delay?: number;
}) {
  const foreign = currencySpend.primaryForeign;
  const foreignLabel = foreign
    ? foreign.code
    : currencySpend.foreignCurrencies.length
      ? currencySpend.foreignCurrencies.map((c) => c.code).join("/")
      : "FX";

  const foreignValue = foreign
    ? formatForeignAmount(foreign.amount, foreign.code, true)
    : "—";

  const foreignSubtitle = foreign
    ? `${formatNumber(foreign.lineCount)} lines → ${formatCurrency(foreign.convertedPkr, true)}`
    : currencySpend.foreignLineCount
      ? `${formatNumber(currencySpend.foreignLineCount)} lines`
      : "No FX lines";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="group text-left"
      title="PKR native + foreign PO amounts converted at PO_EXCH_RATE"
    >
      <Card className="relative overflow-hidden border-[#0055a5]/15 p-4 shadow-sm transition-shadow group-hover:shadow-md">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[#0055a5]" />

        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-2.75 font-semibold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
            <span className="truncate">Total Purchase</span>
            <CircleDollarSign className="h-3.5 w-3.5 shrink-0 text-[#0055a5] dark:text-[#7eb6e8]" aria-hidden />
            <Info className="h-3 w-3 shrink-0 opacity-60" />
          </div>
          <ChartIconBadge
            icon={Wallet}
            variant="solid"
            accentClass="bg-[#0055a5]"
            delay={delay}
          />
        </div>

        <div className="mt-2.5 grid grid-cols-3 divide-x divide-[#0055a5]/12">
          <SpendSection
            label="PKR Amount"
            value={formatCurrency(currencySpend.pkrNative, true)}
            subtitle={`${formatNumber(currencySpend.pkrLineCount)} PKR lines`}
            accentClass="text-[#0055a5] dark:text-[#7eb6e8]"
          />
          <SpendSection
            label={`${foreignLabel} Amount`}
            value={foreignValue}
            subtitle={foreignSubtitle}
            accentClass="text-[#2f7ec4] dark:text-[#7eb6e8]"
          />
          <SpendSection
            label="Combined PKR"
            value={formatCurrency(currencySpend.combinedPkr, true)}
            subtitle={`PKR + FX · ${Math.round(poLinkedShare)}% PO-linked`}
            accentClass="text-[#3d9b6a] dark:text-[#6fd4a0]"
          />
        </div>

        <AnimatedDeltaChip label="@ PO_EXCH_RATE" delay={delay} />
      </Card>
    </motion.div>
  );
}
