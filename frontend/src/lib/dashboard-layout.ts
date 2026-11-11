import type { Layout, LayoutItem } from "react-grid-layout";

export const LAYOUT_STORAGE_KEY = "mgi_dashboard_layout_v1";
export const GRID_COLS = 12;
export const GRID_ROW_HEIGHT = 48;

/** Default layout mirrors the original static dashboard order. */
export const DEFAULT_DASHBOARD_LAYOUT: Layout = [
  { i: "section-executive-overview", x: 0, y: 0, w: 12, h: 5, minW: 4, minH: 3 },
  { i: "section-grn-overview", x: 0, y: 5, w: 12, h: 4, minW: 4, minH: 3 },
  { i: "chart-insights", x: 0, y: 9, w: 12, h: 5, minW: 4, minH: 3 },
  { i: "chart-funnel", x: 0, y: 14, w: 6, h: 9, minW: 3, minH: 5 },
  { i: "chart-approval-status", x: 6, y: 14, w: 6, h: 9, minW: 3, minH: 5 },
  { i: "chart-top-pr-creators", x: 0, y: 23, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "chart-top-po-creators", x: 4, y: 23, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "chart-top-approvers", x: 8, y: 23, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "chart-dept-spend", x: 0, y: 32, w: 6, h: 9, minW: 3, minH: 5 },
  { i: "chart-legal-entity", x: 6, y: 32, w: 6, h: 9, minW: 3, minH: 5 },
  { i: "chart-monthly-trend", x: 0, y: 41, w: 6, h: 10, minW: 4, minH: 6 },
  { i: "chart-spend-analysis", x: 6, y: 41, w: 6, h: 10, minW: 4, minH: 6 },
  { i: "chart-purchase-type-mix", x: 0, y: 50, w: 6, h: 9, minW: 3, minH: 5 },
  { i: "chart-purchase-type-volume", x: 6, y: 50, w: 6, h: 9, minW: 3, minH: 5 },
  { i: "po-revision-summary", x: 0, y: 59, w: 12, h: 3, minW: 4, minH: 2 },
  { i: "chart-po-revision-count", x: 0, y: 62, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "chart-po-revision-linkage", x: 4, y: 62, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "chart-most-revised-pos", x: 8, y: 62, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "chart-vendor-analysis", x: 0, y: 71, w: 6, h: 9, minW: 3, minH: 5 },
  { i: "chart-procurement-aging", x: 6, y: 71, w: 6, h: 9, minW: 3, minH: 5 },
  { i: "chart-dept-performance", x: 0, y: 80, w: 12, h: 10, minW: 4, minH: 5 },
  { i: "chart-split-po-watch", x: 0, y: 90, w: 12, h: 9, minW: 4, minH: 5 },
  { i: "table-split-po", x: 0, y: 99, w: 12, h: 10, minW: 4, minH: 5 },
  { i: "chart-grn-funnel", x: 0, y: 109, w: 6, h: 9, minW: 3, minH: 5 },
  { i: "chart-po-to-grn-aging", x: 6, y: 109, w: 6, h: 9, minW: 3, minH: 5 },
  { i: "chart-grn-receiving-org", x: 0, y: 118, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "chart-grn-monthly", x: 4, y: 118, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "chart-grn-vendors", x: 8, y: 118, w: 4, h: 9, minW: 3, minH: 5 },
  { i: "chart-grn-quality", x: 0, y: 127, w: 12, h: 9, minW: 4, minH: 5 },
  { i: "table-audit", x: 0, y: 136, w: 12, h: 12, minW: 4, minH: 6 },
  { i: "table-grn", x: 0, y: 148, w: 12, h: 12, minW: 4, minH: 6 },
];

export function loadSavedLayout(): Layout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LayoutItem[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function mergeLayoutWithDefaults(saved: Layout): Layout {
  const byId = new Map(saved.map((item) => [item.i, item]));
  const merged: LayoutItem[] = DEFAULT_DASHBOARD_LAYOUT.map((def) => {
    const existing = byId.get(def.i);
    if (!existing) return { ...def };
    return {
      ...def,
      ...existing,
      minW: def.minW,
      minH: def.minH,
    };
  });

  for (const item of saved) {
    if (!merged.some((m) => m.i === item.i)) {
      merged.push(item);
    }
  }

  return merged;
}
