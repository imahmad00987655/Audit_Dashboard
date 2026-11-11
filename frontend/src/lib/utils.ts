import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
}

/** Compact PKR in Western scale (K / M / B) — not Lakh/Crore. */
function formatPkrMillions(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}PKR ${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}PKR ${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}PKR ${(abs / 1e3).toFixed(1)}K`;
  return `${sign}PKR ${Math.round(abs).toLocaleString("en-US")}`;
}

/** Short axis/chip labels (no PKR prefix) to avoid overlap. */
export function formatCompactAxis(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${Math.round(abs)}`;
}

export function formatCurrency(n: number | null | undefined, compact = false) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (compact) return formatPkrMillions(n);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatForeignAmount(n: number | null | undefined, code: string, compact = false) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const currency = String(code || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2,
    }).format(n);
  } catch {
    return `${n.toLocaleString("en-US", { maximumFractionDigits: compact ? 1 : 2 })} ${currency}`;
  }
}

export function formatPercent(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n}%`;
}
