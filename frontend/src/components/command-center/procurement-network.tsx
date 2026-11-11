"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  CommandCenterActivity,
  CommandCenterLink,
  CommandCenterNode,
  CommandCenterPipeline,
} from "@/lib/api";
import { formatNumber, cn } from "@/lib/utils";

export type FlowViewMode = "flow" | "vendor" | "status";

const TYPE_COLOR: Record<string, string> = {
  hub: "#7eb6e8",
  company: "#fff200",
  department: "#3d9b6a",
  operatingUnit: "#3d8fd1",
  vendor: "#e31e24",
  receivingOrg: "#5ec8ff",
  prCreator: "#7eb6e8",
  grnUser: "#3d9b6a",
  item: "#c5d6e8",
};

const TYPE_LABEL: Record<string, string> = {
  company: "Company",
  department: "Department",
  operatingUnit: "Op. Unit",
  vendor: "Vendor",
  receivingOrg: "Receiving",
  prCreator: "PR Creator",
  grnUser: "GRN User",
  item: "Item",
};

/** Wide landscape canvas so trees fill left→right on TV / desktop */
const CANVAS_W = 160;
const CANVAS_H = 90;

const HUB = {
  pr: { x: 28, y: 48, color: "#2f7ec4", label: "Requisition", stage: "PR" },
  po: { x: 80, y: 48, color: "#e31e24", label: "Purchase Order", stage: "PO" },
  grn: { x: 132, y: 48, color: "#3d9b6a", label: "Goods Receipt", stage: "GRN" },
} as const;

type HubKey = keyof typeof HUB;

/** Curved energy paths in wide viewBox */
const PATHS = {
  prPo: [
    "M 38 48 C 50 32, 62 32, 68 48",
    "M 38 48 C 50 48, 62 48, 68 48",
    "M 38 48 C 50 64, 62 64, 68 48",
  ],
  poGrn: [
    "M 92 48 C 104 32, 116 32, 122 48",
    "M 92 48 C 104 48, 116 48, 122 48",
    "M 92 48 C 104 64, 116 64, 122 48",
  ],
};

const PR_PO_COLORS = ["#7eb6e8", "#fff200", "#ffffff", "#e31e24"];
const PO_GRN_COLORS = ["#e31e24", "#fff200", "#7ddea8", "#ffffff"];

function EntityRail({
  title,
  accent,
  items,
  selectedId,
  animate,
  focusVendor,
  onSelect,
}: {
  title: string;
  accent: string;
  items: CommandCenterNode[];
  selectedId: string | null;
  animate: boolean;
  focusVendor?: boolean;
  onSelect: (n: CommandCenterNode) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-[#0a1628]/90">
      <div
        className="shrink-0 border-b border-white/10 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em]"
        style={{ color: accent }}
      >
        {title}
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-hidden p-1.5">
        {items.length === 0 && (
          <div className="px-2 py-3 text-[11px] text-[#6d8499]">No entities in scope</div>
        )}
        {items.slice(0, 8).map((n, i) => {
          const active = selectedId === n.id;
          const dimVendor = focusVendor && n.type === "vendor" && !active;
          return (
            <motion.button
              key={n.id}
              type="button"
              initial={false}
              animate={
                animate
                  ? {
                      opacity: dimVendor ? 0.45 : [0.75, 1, 0.75],
                      borderColor: active ? "#fff200" : "rgba(255,255,255,0.1)",
                    }
                  : { opacity: dimVendor ? 0.45 : 1 }
              }
              transition={animate ? { duration: 2.4 + i * 0.12, repeat: Infinity, ease: "easeInOut" } : undefined}
              onClick={() => onSelect(n)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition",
                active
                  ? "border-[#fff200] bg-[#fff200]/10 shadow-[0_0_16px_rgba(255,242,0,0.2)]"
                  : "border-white/10 bg-white/5 hover:border-white/25"
              )}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/20"
                style={{ background: TYPE_COLOR[n.type] || "#7eb6e8", boxShadow: `0 0 10px ${TYPE_COLOR[n.type]}` }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold leading-tight text-white">{n.label}</span>
                <span className="text-[9px] uppercase tracking-wide text-[#9aa8b8]">
                  {TYPE_LABEL[n.type] || n.type}
                </span>
              </span>
              <span className="shrink-0 rounded-md bg-[#122238] px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-[#fff200]">
                {formatNumber(n.count || 0)}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({
  label,
  count,
  color,
  emphasize,
}: {
  label: string;
  count: number;
  color: string;
  emphasize?: boolean;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide backdrop-blur-sm sm:text-[9px]",
        emphasize && "ring-1 ring-[#fff200]/50"
      )}
      style={{
        color,
        borderColor: `${color}55`,
        background: `${color}14`,
        boxShadow: emphasize ? `0 0 12px ${color}44` : undefined,
      }}
    >
      {label}
      <span className="tabular-nums text-white/90">{formatNumber(count)}</span>
    </span>
  );
}

type PathParticle = {
  el: SVGCircleElement;
  pathIdx: number;
  t: number;
  speed: number;
  r: number;
  color: string;
  event: boolean;
  life: number;
};

/** Continuous particles along path geometry — waits until path refs exist */
function PathParticles({
  pathRefs,
  animate,
  colors,
  count,
  speedMin,
  speedMax,
  eventBurst,
  burstColor,
}: {
  pathRefs: { current: (SVGPathElement | null)[] };
  animate: boolean;
  colors: string[];
  count: number;
  speedMin: number;
  speedMax: number;
  eventBurst: number;
  burstColor: string;
}) {
  const canvasRef = useRef<SVGGElement>(null);
  const particles = useRef<PathParticle[]>([]);
  const raf = useRef(0);
  const lastBurst = useRef(0);
  const burstRef = useRef(eventBurst);
  const burstColorRef = useRef(burstColor);
  const speedMaxRef = useRef(speedMax);
  const seeded = useRef(false);

  burstRef.current = eventBurst;
  burstColorRef.current = burstColor;
  speedMaxRef.current = speedMax;

  useEffect(() => {
    const root = canvasRef.current;
    if (!animate || !root) {
      cancelAnimationFrame(raf.current);
      particles.current.forEach((p) => p.el.remove());
      particles.current = [];
      seeded.current = false;
      return;
    }

    const paths = () => pathRefs.current.filter(Boolean) as SVGPathElement[];

    const spawn = (opts: Omit<PathParticle, "el">) => {
      const el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      el.setAttribute("r", String(opts.r));
      el.setAttribute("fill", opts.color);
      el.setAttribute("opacity", "0.95");
      el.style.filter = `drop-shadow(0 0 ${opts.event ? 8 : 5}px ${opts.color})`;
      root.appendChild(el);
      particles.current.push({ ...opts, el });
    };

    const seedAmbient = (livePaths: SVGPathElement[]) => {
      particles.current.forEach((p) => p.el.remove());
      particles.current = [];
      for (let i = 0; i < count; i++) {
        spawn({
          pathIdx: i % livePaths.length,
          t: (i / count) % 1,
          speed: speedMin + Math.random() * (speedMax - speedMin),
          r: i % 3 === 0 ? 2.4 : i % 2 === 0 ? 1.7 : 1.25,
          color: colors[i % colors.length],
          event: false,
          life: 1,
        });
      }
      seeded.current = true;
    };

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const livePaths = paths();

      if (!livePaths.length) {
        raf.current = requestAnimationFrame(tick);
        return;
      }
      if (!seeded.current) seedAmbient(livePaths);

      if (burstRef.current !== lastBurst.current) {
        lastBurst.current = burstRef.current;
        const mid = Math.floor(livePaths.length / 2);
        for (let i = 0; i < 4; i++) {
          spawn({
            pathIdx: mid,
            t: 0,
            speed: speedMaxRef.current * 1.8,
            r: 3.1,
            color: burstColorRef.current,
            event: true,
            life: 1,
          });
        }
      }

      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        const path = livePaths[p.pathIdx % livePaths.length];
        if (!path) continue;
        const len = path.getTotalLength() || 1;
        p.t += p.speed * dt;
        if (p.event) p.life -= dt * 0.35;
        if (p.t > 1) {
          if (p.event) {
            p.el.remove();
            particles.current.splice(i, 1);
            continue;
          }
          p.t -= 1;
        }
        if (p.event && p.life <= 0) {
          p.el.remove();
          particles.current.splice(i, 1);
          continue;
        }
        const pt = path.getPointAtLength(Math.max(0, Math.min(1, p.t)) * len);
        p.el.setAttribute("cx", String(pt.x));
        p.el.setAttribute("cy", String(pt.y));
        p.el.setAttribute(
          "opacity",
          String(p.event ? Math.max(0.2, p.life) : 0.65 + 0.35 * Math.sin(now / 320 + i))
        );
      }

      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      particles.current.forEach((p) => p.el.remove());
      particles.current = [];
      seeded.current = false;
    };
  }, [animate, pathRefs, colors, count, speedMin, speedMax]);

  return <g ref={canvasRef} aria-hidden />;
}

/** Always-on flowing dash + glow along energy curves */
function FlowingPath({
  d,
  stroke,
  animate,
  thick,
  delay = 0,
  dimmed,
}: {
  d: string;
  stroke: string;
  animate: boolean;
  thick?: boolean;
  delay?: number;
  dimmed?: boolean;
}) {
  return (
    <>
      {/* Soft bloom underlay */}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={thick ? 2.2 : 1.4}
        strokeLinecap="round"
        opacity={dimmed ? 0.12 : 0.28}
        style={{ filter: "blur(1.2px)" }}
      />
      {/* Core luminous line */}
      <motion.path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={thick ? 0.7 : 0.38}
        strokeLinecap="round"
        opacity={dimmed ? 0.35 : 0.9}
        animate={
          animate
            ? { opacity: dimmed ? [0.25, 0.4, 0.25] : [0.55, 1, 0.55] }
            : undefined
        }
        transition={{ duration: 1.8, repeat: Infinity, delay, ease: "easeInOut" }}
      />
      {/* Travelling dash energy */}
      {animate && (
        <motion.path
          d={d}
          fill="none"
          stroke="#fff200"
          strokeWidth={thick ? 0.85 : 0.5}
          strokeLinecap="round"
          strokeDasharray="2.5 7"
          opacity={dimmed ? 0.35 : 0.95}
          animate={{ strokeDashoffset: [0, -19] }}
          transition={{ duration: 1.1 + delay * 0.2, repeat: Infinity, ease: "linear" }}
          style={{ filter: "drop-shadow(0 0 2px #fff200)" }}
        />
      )}
      {animate && (
        <motion.path
          d={d}
          fill="none"
          stroke="#ffffff"
          strokeWidth={thick ? 0.45 : 0.28}
          strokeLinecap="round"
          strokeDasharray="1.2 5.5"
          opacity={0.75}
          animate={{ strokeDashoffset: [0, -13] }}
          transition={{ duration: 0.75 + delay * 0.15, repeat: Infinity, ease: "linear", delay: 0.15 }}
        />
      )}
    </>
  );
}

function HubNode({
  hub,
  count,
  animate,
  hot,
  selected,
  dimmed,
  onClick,
}: {
  hub: (typeof HUB)[HubKey];
  count: number;
  animate: boolean;
  hot?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  onClick: () => void;
}) {
  return (
    <g
      transform={`translate(${hub.x}, ${hub.y})`}
      opacity={dimmed ? 0.35 : 1}
      className="cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      {animate && (
        <>
          <motion.circle
            r={16}
            fill={hub.color}
            animate={{ r: [13, 18, 13], opacity: [0.12, 0.32, 0.12] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            style={{ filter: "blur(2.5px)" }}
          />
          <motion.circle
            r={11}
            fill="none"
            stroke={hub.color}
            strokeWidth={0.45}
            animate={{ r: [10, 16], opacity: [0.7, 0] }}
            transition={{ duration: 2.1, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.circle
            r={11}
            fill="none"
            stroke="#fff200"
            strokeWidth={0.25}
            animate={{ r: [9.5, 14.5], opacity: [0.45, 0] }}
            transition={{ duration: 2.1, repeat: Infinity, ease: "easeOut", delay: 1.05 }}
          />
          <motion.circle
            r={12.8}
            fill="none"
            stroke={`${hub.color}aa`}
            strokeWidth={0.3}
            strokeDasharray="2.2 2.8"
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "0px 0px" }}
          />
        </>
      )}
      <circle
        r={9.5}
        fill={`url(#grad-${hub.stage})`}
        stroke={selected || hot ? "#fff200" : hub.color}
        strokeWidth={selected || hot ? 0.75 : 0.5}
        style={{
          filter: hot
            ? `drop-shadow(0 0 8px ${hub.color}) drop-shadow(0 0 5px #fff200)`
            : `drop-shadow(0 0 6px ${hub.color})`,
        }}
      />
      {animate && (
        <motion.circle
          r={9.5}
          fill="none"
          stroke={hub.color}
          strokeWidth={0.55}
          animate={{ opacity: [0.35, 0.95, 0.35], r: [9.3, 10.2, 9.3] }}
          transition={{ duration: hot ? 0.8 : 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <circle r={7.2} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={0.25} />
      <text
        textAnchor="middle"
        y={-0.6}
        fill="#fff"
        fontSize={3.6}
        fontWeight={800}
        style={{ letterSpacing: "0.06em" }}
      >
        {hub.stage}
      </text>
      <rect x={-5.5} y={2.2} width={11} height={3.2} rx={1.2} fill={hub.color} opacity={0.95} />
      <text textAnchor="middle" y={4.5} fill="#06101f" fontSize={2.2} fontWeight={800}>
        {formatNumber(count)}
      </text>
      <text textAnchor="middle" y={14.2} fill={hub.color} fontSize={2.3} fontWeight={700}>
        {hub.label}
      </text>
    </g>
  );
}

function shortenLabel(label: string, max = 26) {
  const t = (label || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Adaptive filter-driven tree: grows with node count (multi-column),
 * auto width/height inside the SVG viewBox.
 */
function SatelliteTree({
  hubX,
  hubY,
  hubColor,
  items,
  direction,
  selectedId,
  dimmed,
  animate,
  onSelect,
  maxLeaves = 12,
}: {
  hubX: number;
  hubY: number;
  hubColor: string;
  items: CommandCenterNode[];
  direction: "up" | "down";
  selectedId: string | null;
  dimmed?: boolean;
  animate: boolean;
  onSelect: (n: CommandCenterNode) => void;
  maxLeaves?: number;
}) {
  const list = useMemo(
    () =>
      [...items]
        .sort((a, b) => (b.count || 0) - (a.count || 0) || (b.value || 0) - (a.value || 0))
        .slice(0, maxLeaves),
    [items, maxLeaves]
  );

  if (!list.length) return null;

  const up = direction === "up";
  const sign = up ? -1 : 1;
  const n = list.length;

  const trunkStart = hubY + sign * (up ? 10.5 : 16);
  const forkY = hubY + sign * (up ? 16.5 : 21);

  // Vertical budget from fork to canvas edge
  const edge = up ? 3 : CANVAS_H - 3;
  const availH = Math.max(8, Math.abs(edge - forkY) - 1.5);

  // Edge-to-edge of the canvas — no left/right empty gutter
  const padX = 0.6;
  const totalW = CANVAS_W - padX * 2;
  const gap = 0.45;

  // Cap columns so each chip stays wide enough for readable names
  const cols = n <= 2 ? Math.max(1, n) : n <= 5 ? 3 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(n / cols);

  const rowH = Math.min(6.4, Math.max(3.8, availH / rows));
  const chipH = Math.min(5.3, rowH - 0.45);
  const chipW = (totalW - (cols - 1) * gap) / cols;
  // Bold caps are wide (~1.05 units/char); reserve room for count on the right
  const fontSize = chipW > 28 ? 1.85 : 1.55;
  const labelMax = Math.max(10, Math.floor((chipW - 8.5) / (fontSize * 0.62)));

  const gridLeft = padX;

  const firstRowY = forkY + sign * (rowH * 0.72);
  const lastRowY = firstRowY + sign * ((rows - 1) * rowH);

  const colXs = Array.from({ length: cols }, (_, c) => gridLeft + chipW / 2 + c * (chipW + gap));
  const railLeft = colXs[0];
  const railRight = colXs[cols - 1];

  const leaves = list.map((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      node,
      x: colXs[col],
      y: firstRowY + sign * (row * rowH),
      i,
      col,
      row,
    };
  });

  const trunkPath = `M ${hubX} ${trunkStart} L ${hubX} ${forkY}`;
  const railPath = cols > 1 ? `M ${railLeft} ${forkY} L ${railRight} ${forkY}` : "";
  const treeKey = list.map((x) => x.id).join("|");

  return (
    <g opacity={dimmed ? 0.28 : 1} key={treeKey}>
      <path d={trunkPath} fill="none" stroke={hubColor} strokeWidth={1.5} opacity={0.16} style={{ filter: "blur(0.8px)" }} />
      <motion.path
        d={trunkPath}
        fill="none"
        stroke={hubColor}
        strokeWidth={0.45}
        strokeLinecap="round"
        animate={animate ? { opacity: [0.55, 1, 0.55] } : undefined}
        transition={{ duration: 2.2, repeat: Infinity }}
      />
      {railPath && (
        <path d={railPath} fill="none" stroke={hubColor} strokeWidth={0.4} strokeLinecap="round" opacity={0.9} />
      )}

      {/* Per-column spines for multi-row trees */}
      {colXs.map((cx) => {
        const colLeaves = leaves.filter((l) => l.x === cx);
        if (!colLeaves.length) return null;
        const endY = colLeaves[colLeaves.length - 1].y;
        return (
          <path
            key={`spine-${cx}`}
            d={`M ${cx} ${forkY} L ${cx} ${endY}`}
            fill="none"
            stroke={hubColor}
            strokeWidth={0.32}
            strokeLinecap="round"
            opacity={0.75}
          />
        );
      })}

      <circle cx={hubX} cy={forkY} r={1} fill={hubColor} style={{ filter: `drop-shadow(0 0 3px ${hubColor})` }} />
      {animate && (
        <motion.circle
          cx={hubX}
          cy={forkY}
          r={1}
          fill="none"
          stroke="#fff200"
          strokeWidth={0.25}
          animate={{ r: [1, 2.2], opacity: [0.7, 0] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      )}

      <AnimatePresence initial={false}>
        {leaves.map(({ node, x, y, i }) => {
          const color = TYPE_COLOR[node.type] || hubColor;
          const selected = selectedId === node.id;
          const label = shortenLabel(node.label, labelMax);
          const stem = `M ${x} ${forkY} L ${x} ${y}`;

          return (
            <motion.g
              key={node.id}
              initial={animate ? { opacity: 0, scale: 0.85 } : false}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4) }}
            >
              <path d={stem} fill="none" stroke={color} strokeWidth={0.28} strokeLinecap="round" opacity={0.55} />
              <circle cx={x} cy={forkY} r={0.45} fill={color} opacity={0.9} />

              {animate && i < 8 && (
                <motion.path
                  d={stem}
                  fill="none"
                  stroke="#fff200"
                  strokeWidth={0.22}
                  strokeDasharray="1 3"
                  animate={{ strokeDashoffset: up ? [0, 8] : [0, -8] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear", delay: i * 0.12 }}
                />
              )}

              <g
                transform={`translate(${x}, ${y})`}
                className="cursor-pointer"
                onClick={() => onSelect(node)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect(node);
                }}
              >
                <title>{`${node.label}${typeof node.count === "number" ? ` (${node.count})` : ""}`}</title>
                <defs>
                  <clipPath id={`chip-clip-${node.id}`}>
                    {/* Leave right strip clear for the count so long names never spill out */}
                    <rect
                      x={-chipW / 2 + 0.3}
                      y={-chipH / 2 + 0.15}
                      width={Math.max(6, chipW - 5.2)}
                      height={chipH - 0.3}
                      rx={0.45}
                    />
                  </clipPath>
                </defs>
                <rect
                  x={-chipW / 2}
                  y={-chipH / 2}
                  width={chipW}
                  height={chipH}
                  rx={0.7}
                  fill="rgba(6,14,28,0.97)"
                  stroke={selected ? "#fff200" : color}
                  strokeWidth={selected ? 0.45 : 0.28}
                  style={{
                    filter: selected
                      ? "drop-shadow(0 0 3px #fff200)"
                      : `drop-shadow(0 0 2px ${color}88)`,
                  }}
                />
                <g clipPath={`url(#chip-clip-${node.id})`}>
                  <circle cx={-chipW / 2 + 1.15} cy={0} r={0.55} fill={color} />
                  <text
                    x={-chipW / 2 + 2.2}
                    y={0.55}
                    fill="#ffffff"
                    fontSize={fontSize}
                    fontWeight={700}
                  >
                    {label}
                  </text>
                </g>
                {typeof node.count === "number" && (
                  <text
                    x={chipW / 2 - 0.55}
                    y={0.55}
                    textAnchor="end"
                    fill={color}
                    fontSize={1.4}
                    fontWeight={800}
                  >
                    {formatNumber(node.count)}
                  </text>
                )}
              </g>
            </motion.g>
          );
        })}
      </AnimatePresence>

      {/* Count badge on fork — shows live tree size after filters */}
      <g transform={`translate(${hubX + 3.2}, ${forkY})`}>
        <rect x={0} y={-1.6} width={8.5} height={3.2} rx={1} fill="rgba(8,18,36,0.92)" stroke={hubColor} strokeWidth={0.25} />
        <text x={4.25} y={0.55} textAnchor="middle" fill={hubColor} fontSize={1.5} fontWeight={800}>
          {n}
        </text>
      </g>

      {animate && (
        <motion.circle
          r={0.6}
          fill="#fff200"
          style={{ filter: "drop-shadow(0 0 3px #fff200)" }}
          animate={{
            cx: [hubX, hubX, railLeft, railRight],
            cy: [trunkStart, forkY, forkY, forkY],
            opacity: [0, 1, 1, 0],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </g>
  );
}

export function ProcurementNetwork({
  nodes,
  links,
  pipeline,
  animate,
  highlightHub,
  pulseEvent,
  viewMode,
  onViewModeChange,
  onSelect,
}: {
  nodes: CommandCenterNode[];
  links: CommandCenterLink[];
  pipeline?: CommandCenterPipeline | null;
  animate: boolean;
  highlightHub?: string | null;
  pulseEvent?: CommandCenterActivity | null;
  viewMode: FlowViewMode;
  onViewModeChange: (m: FlowViewMode) => void;
  onSelect: (node: CommandCenterNode | null) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [burstPrPo, setBurstPrPo] = useState(0);
  const [burstPoGrn, setBurstPoGrn] = useState(0);
  const [flashLeg, setFlashLeg] = useState<"pr-po" | "po-grn" | null>(null);

  const prPoRefs = useRef<(SVGPathElement | null)[]>([]);
  const poGrnRefs = useRef<(SVGPathElement | null)[]>([]);

  const hubs = useMemo(() => {
    const by = (id: string) => nodes.find((n) => n.id === id);
    return { pr: by("hub-pr"), po: by("hub-po"), grn: by("hub-grn") };
  }, [nodes]);

  // Drop stale selection when filters rebuild the network
  useEffect(() => {
    if (!selectedId) return;
    if (nodes.some((n) => n.id === selectedId)) return;
    setSelectedId(null);
    onSelect(null);
  }, [nodes, selectedId, onSelect]);

  const leftItems = useMemo(
    () =>
      nodes
        .filter((n) => n.stage === "pr" && n.type !== "hub" && !["prCreator", "item"].includes(n.type))
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .slice(0, 8),
    [nodes]
  );
  const rightItems = useMemo(
    () =>
      nodes
        .filter((n) => (n.stage === "po" || n.stage === "grn") && n.type !== "hub" && n.type !== "item" && n.type !== "grnUser")
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .slice(0, 8),
    [nodes]
  );

  // Filter-scoped entities — counts change with dashboard filters; trees grow/shrink live
  const satellites = useMemo(() => {
    const sortByWeight = (arr: CommandCenterNode[]) =>
      [...arr].sort((a, b) => (b.count || 0) - (a.count || 0) || (b.value || 0) - (a.value || 0));
    return {
      pr: sortByWeight(
        nodes.filter(
          (n) => n.stage === "pr" && ["company", "department", "operatingUnit", "prCreator"].includes(n.type)
        )
      ),
      po: sortByWeight(nodes.filter((n) => n.type === "vendor")),
      grn: sortByWeight(
        nodes.filter((n) => n.stage === "grn" && ["receivingOrg", "grnUser"].includes(n.type))
      ),
    };
  }, [nodes]);

  const pipelineLinks = useMemo(() => links.filter((l) => l.kind === "pipeline"), [links]);
  const prPoVerified = pipelineLinks.find((l) => l.id === "flow-pr-po")?.verified !== false;
  const poGrnVerified = pipelineLinks.find((l) => l.id === "flow-po-grn")?.verified !== false;

  const pick = useCallback(
    (n: CommandCenterNode) => {
      const next = selectedId === n.id ? null : n.id;
      setSelectedId(next);
      onSelect(next ? n : null);
    },
    [onSelect, selectedId]
  );

  useEffect(() => {
    if (!pulseEvent) return;
    const isGrn = pulseEvent.kind === "grn" || pulseEvent.kind === "backdated_grn";
    if (isGrn) {
      if (pulseEvent.hasPoLink === false) return;
      setBurstPoGrn((v) => v + 1);
      setFlashLeg("po-grn");
    } else if (pulseEvent.kind === "po") {
      setBurstPrPo((v) => v + 1);
      setFlashLeg("pr-po");
    }
    const t = window.setTimeout(() => setFlashLeg(null), 3200);
    return () => window.clearTimeout(t);
  }, [pulseEvent]);

  const selected = selectedId ? nodes.find((n) => n.id === selectedId) : null;
  const vendorFocus = viewMode === "vendor" || selected?.type === "vendor";
  const statusFocus = viewMode === "status";

  const dimHub = (id: string) => {
    if (!selected) return false;
    if (selected.type === "hub") return selected.id !== id;
    if (selected.type === "vendor") return id === "hub-pr";
    if (selected.stage === "pr") return id === "hub-grn";
    if (selected.stage === "grn") return id === "hub-pr";
    return false;
  };

  return (
    <div className="relative flex h-full min-h-0 w-full gap-2 overflow-hidden rounded-2xl border border-white/10 bg-[#050d18] p-2">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-[#0055a5]/20 blur-3xl"
          animate={animate ? { x: [0, 30, 0], opacity: [0.25, 0.45, 0.25] } : undefined}
          transition={{ duration: 7, repeat: Infinity }}
        />
        <motion.div
          className="absolute -right-16 bottom-1/4 h-56 w-56 rounded-full bg-[#e31e24]/12 blur-3xl"
          animate={animate ? { y: [0, -24, 0], opacity: [0.2, 0.4, 0.2] } : undefined}
          transition={{ duration: 6, repeat: Infinity }}
        />
      </div>

      <div className="relative z-10 hidden w-[20%] min-w-[150px] max-w-[220px] shrink-0 md:block">
        <EntityRail
          title="PR side"
          accent="#7eb6e8"
          items={leftItems}
          selectedId={selectedId}
          animate={animate}
          onSelect={pick}
        />
      </div>

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-1 px-1">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#fff200]">
            Live pipeline · PR → PO → GRN
          </div>
          <div className="flex items-center gap-1">
            {(["flow", "vendor", "status"] as FlowViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onViewModeChange(m)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide transition",
                  viewMode === m
                    ? "border-[#fff200]/50 bg-[#fff200]/15 text-[#fff200]"
                    : "border-white/10 bg-white/5 text-[#9aa8b8] hover:border-white/25"
                )}
              >
                {m}
              </button>
            ))}
            {animate && (
              <motion.span
                className="ml-1 rounded-full border border-[#3d9b6a]/40 bg-[#3d9b6a]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#7ddea8]"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              >
                ● Live
              </motion.span>
            )}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-[#0055a5]/35 bg-[#06101f]">
          <svg
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id={`grad-PR`} cx="35%" cy="30%">
                <stop offset="0%" stopColor="#5aa0e0" stopOpacity="0.85" />
                <stop offset="55%" stopColor="#0a1628" />
                <stop offset="100%" stopColor="#050d18" />
              </radialGradient>
              <radialGradient id={`grad-PO`} cx="35%" cy="30%">
                <stop offset="0%" stopColor="#ff5a5f" stopOpacity="0.75" />
                <stop offset="45%" stopColor="#fff200" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#050d18" />
              </radialGradient>
              <radialGradient id={`grad-GRN`} cx="35%" cy="30%">
                <stop offset="0%" stopColor="#5ecf90" stopOpacity="0.8" />
                <stop offset="55%" stopColor="#0a1628" />
                <stop offset="100%" stopColor="#050d18" />
              </radialGradient>
              <linearGradient id={`g-prpo-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2f7ec4" />
                <stop offset="55%" stopColor="#fff200" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#e31e24" />
              </linearGradient>
              <linearGradient id={`g-pogr-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#e31e24" />
                <stop offset="50%" stopColor="#fff200" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#3d9b6a" />
              </linearGradient>
              <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.1" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Technical grid */}
            <g opacity={0.18} stroke="#7eb6e8" strokeWidth={0.08}>
              {Array.from({ length: Math.ceil(CANVAS_H / 10) + 1 }).map((_, i) => (
                <line key={`h${i}`} x1={0} y1={i * 10} x2={CANVAS_W} y2={i * 10} />
              ))}
              {Array.from({ length: Math.ceil(CANVAS_W / 10) + 1 }).map((_, i) => (
                <line key={`v${i}`} x1={i * 10} y1={0} x2={i * 10} y2={CANVAS_H} />
              ))}
            </g>

            {/* Ambient dots */}
            {animate &&
              Array.from({ length: 14 }).map((_, i) => (
                <motion.circle
                  key={`amb-${i}`}
                  cx={6 + ((i * 11) % (CANVAS_W - 12))}
                  cy={8 + ((i * 9) % (CANVAS_H - 16))}
                  r={0.35}
                  fill={i % 3 === 0 ? "#fff200" : "#7eb6e8"}
                  animate={{
                    opacity: [0.15, 0.7, 0.15],
                    cy: [8 + ((i * 9) % (CANVAS_H - 16)), 16 + ((i * 7) % (CANVAS_H - 24))],
                  }}
                  transition={{ duration: 4 + (i % 4), repeat: Infinity, delay: i * 0.2 }}
                />
              ))}

            {/* Invisible geometry for particle tracking */}
            <g opacity={0} pointerEvents="none">
              {PATHS.prPo.map((d, i) => (
                <path
                  key={`prpo-ref-${i}`}
                  ref={(el) => {
                    prPoRefs.current[i] = el;
                  }}
                  d={d}
                />
              ))}
              {PATHS.poGrn.map((d, i) => (
                <path
                  key={`pogr-ref-${i}`}
                  ref={(el) => {
                    poGrnRefs.current[i] = el;
                  }}
                  d={d}
                />
              ))}
            </g>

            {/* Energy streams PR → PO — continuous glow */}
            <g
              opacity={viewMode === "vendor" && !selected ? 0.55 : flashLeg === "po-grn" && selected ? 0.4 : 1}
              filter={`url(#glow-${uid})`}
            >
              {PATHS.prPo.map((d, i) => (
                <FlowingPath
                  key={`prpo-${i}`}
                  d={d}
                  stroke={i === 1 ? `url(#g-prpo-${uid})` : "#2f7ec4"}
                  animate={animate}
                  thick={i === 1}
                  delay={i * 0.18}
                  dimmed={!prPoVerified && i !== 1}
                />
              ))}
              {animate && flashLeg === "pr-po" && (
                <motion.path
                  d={PATHS.prPo[1]}
                  fill="none"
                  stroke="#fff200"
                  strokeWidth={1.2}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 1 }}
                  animate={{ pathLength: 1, opacity: [1, 0.15] }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              )}
            </g>

            {/* Energy streams PO → GRN — continuous glow */}
            <g opacity={flashLeg === "pr-po" ? 0.55 : 1} filter={`url(#glow-${uid})`}>
              {PATHS.poGrn.map((d, i) => (
                <FlowingPath
                  key={`pogr-${i}`}
                  d={d}
                  stroke={i === 1 ? `url(#g-pogr-${uid})` : "#3d9b6a"}
                  animate={animate}
                  thick={i === 1}
                  delay={i * 0.18 + 0.1}
                  dimmed={!poGrnVerified && i !== 1}
                />
              ))}
              {animate && flashLeg === "po-grn" && (
                <motion.path
                  d={PATHS.poGrn[1]}
                  fill="none"
                  stroke="#7ddea8"
                  strokeWidth={1.2}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 1 }}
                  animate={{ pathLength: 1, opacity: [1, 0.15] }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              )}
            </g>

            <PathParticles
              pathRefs={prPoRefs}
              animate={animate}
              colors={PR_PO_COLORS}
              count={12}
              speedMin={0.18}
              speedMax={0.42}
              eventBurst={burstPrPo}
              burstColor="#fff200"
            />
            <PathParticles
              pathRefs={poGrnRefs}
              animate={animate}
              colors={PO_GRN_COLORS}
              count={12}
              speedMin={0.18}
              speedMax={0.42}
              eventBurst={burstPoGrn}
              burstColor="#7ddea8"
            />

            {/* Dynamic filter-driven trees — grow/shrink with scoped data */}
            <SatelliteTree
              hubX={HUB.pr.x}
              hubY={HUB.pr.y}
              hubColor="#fff200"
              items={satellites.pr}
              direction="up"
              selectedId={selectedId}
              dimmed={Boolean(selected && selected.type === "hub" && selected.id !== "hub-pr")}
              animate={animate}
              onSelect={pick}
              maxLeaves={10}
            />
            <SatelliteTree
              hubX={HUB.po.x}
              hubY={HUB.po.y}
              hubColor="#e31e24"
              items={satellites.po}
              direction="down"
              selectedId={selectedId}
              dimmed={vendorFocus && selected?.type !== "vendor"}
              animate={animate}
              onSelect={pick}
              maxLeaves={14}
            />
            <SatelliteTree
              hubX={HUB.grn.x}
              hubY={HUB.grn.y}
              hubColor="#3d9b6a"
              items={satellites.grn}
              direction="up"
              selectedId={selectedId}
              dimmed={Boolean(selected && selected.type === "vendor")}
              animate={animate}
              onSelect={pick}
              maxLeaves={10}
            />

            <HubNode
              hub={HUB.pr}
              count={hubs.pr?.count || 0}
              animate={animate}
              hot={highlightHub === "hub-pr"}
              selected={selectedId === "hub-pr"}
              dimmed={dimHub("hub-pr")}
              onClick={() => hubs.pr && pick(hubs.pr)}
            />
            <HubNode
              hub={HUB.po}
              count={hubs.po?.count || 0}
              animate={animate}
              hot={highlightHub === "hub-po" || flashLeg === "pr-po"}
              selected={selectedId === "hub-po"}
              dimmed={dimHub("hub-po")}
              onClick={() => hubs.po && pick(hubs.po)}
            />
            <HubNode
              hub={HUB.grn}
              count={hubs.grn?.count || 0}
              animate={animate}
              hot={highlightHub === "hub-grn" || flashLeg === "po-grn"}
              selected={selectedId === "hub-grn"}
              dimmed={dimHub("hub-grn")}
              onClick={() => hubs.grn && pick(hubs.grn)}
            />
          </svg>

          {/* Status pills overlay */}
          <div
            className={cn(
              "pointer-events-none absolute inset-x-2 top-2 flex flex-wrap justify-center gap-1 transition-opacity",
              statusFocus ? "opacity-100" : "opacity-90"
            )}
          >
            <StatusPill label="PR→PO linked" count={pipeline?.prToPo || 0} color="#7eb6e8" emphasize={statusFocus} />
            <StatusPill label="Pending approval" count={pipeline?.pendingApproval || 0} color="#fff200" emphasize={statusFocus} />
            <StatusPill label="Awaiting receipt" count={pipeline?.awaitingReceipt || 0} color="#ff8a8e" emphasize={statusFocus} />
            <StatusPill label="Partial GRN" count={pipeline?.partiallyReceived || 0} color="#e31e24" emphasize={statusFocus} />
            <StatusPill label="Fully received" count={pipeline?.fullyReceived || 0} color="#7ddea8" emphasize={statusFocus} />
          </div>

          {!prPoVerified && (
            <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-[#0f1c30]/85 px-2 py-0.5 text-[8px] text-[#9aa8b8]">
              Some POs lack verified PR links
            </div>
          )}
        </div>

        <div className="mt-1 grid grid-cols-2 gap-1 md:hidden">
          {[...leftItems, ...rightItems].slice(0, 6).map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => pick(n)}
              className="truncate rounded-md border border-white/10 bg-white/5 px-2 py-1 text-left text-[10px] font-bold text-white"
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: TYPE_COLOR[n.type] }} />
              {n.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 hidden w-[20%] min-w-[150px] max-w-[220px] shrink-0 md:block">
        <EntityRail
          title="PO / GRN"
          accent="#ff8a8e"
          items={rightItems}
          selectedId={selectedId}
          animate={animate}
          focusVendor={vendorFocus}
          onSelect={pick}
        />
      </div>

      <AnimatePresence>
        {selectedId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute bottom-2 left-1/2 z-20 hidden -translate-x-1/2 rounded-full border border-[#fff200]/40 bg-[#0f1c30]/90 px-3 py-1 text-[10px] text-[#fff200] md:block"
          >
            Focused · unrelated paths dimmed
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
