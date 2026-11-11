"use client";

import { useCallback, useMemo } from "react";
import ReactGridLayout, {
  useContainerWidth,
  verticalCompactor,
  type Layout,
} from "react-grid-layout";
import { GripVertical, Move } from "lucide-react";
import { useDashboardLayout } from "@/context/dashboard-layout-context";
import { usePermission } from "@/hooks/use-permission";
import { GRID_COLS, GRID_ROW_HEIGHT } from "@/lib/dashboard-layout";
import { cn } from "@/lib/utils";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export type DashboardWidgetDef = {
  id: string;
  permission?: string;
  anyOf?: string[];
  render: () => React.ReactNode;
};

type Props = {
  widgets: DashboardWidgetDef[];
};

export function DashboardWidgetGrid({ widgets }: Props) {
  const { mergedLayout, editMode, setLayout } = useDashboardLayout();
  const { can, canAny, isAdmin } = usePermission();
  const { width, containerRef, mounted } = useContainerWidth();

  const visibleWidgets = useMemo(() => {
    return widgets.filter((w) => {
      if (w.permission) return can(w.permission);
      if (w.anyOf?.length) return canAny(w.anyOf);
      return true;
    });
  }, [widgets, can, canAny]);

  const visibleLayout = useMemo(() => {
    const ids = new Set(visibleWidgets.map((w) => w.id));
    return mergedLayout.filter((item) => ids.has(item.i));
  }, [mergedLayout, visibleWidgets]);

  const onLayoutChange = useCallback(
    (newLayout: Layout) => {
      if (!editMode || !isAdmin) return;
      const byId = new Map(mergedLayout.map((item) => [item.i, item]));
      for (const item of newLayout) {
        byId.set(item.i, { ...byId.get(item.i), ...item });
      }
      setLayout(Array.from(byId.values()));
    },
    [editMode, isAdmin, mergedLayout, setLayout]
  );

  const canEdit = editMode && isAdmin;

  return (
    <div className="dashboard-widget-grid">
      {canEdit && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#0055a5]/20 bg-[#0055a5]/6 px-4 py-2.5 text-sm text-[#2a4a6e] dark:border-[#3d9ae8]/25 dark:bg-[#3d9ae8]/10 dark:text-[#e8f1fa]">
          <Move className="h-4 w-4 shrink-0 text-[#0055a5] dark:text-[#7eb6e8]" />
          <span>
            <strong>Customize mode</strong> — drag the handle to move widgets, pull corners to resize.
            Save when done.
          </span>
        </div>
      )}

      <div
        ref={containerRef}
        className={cn(
          "relative -mx-1",
          canEdit && "rounded-2xl p-1 ring-2 ring-[#0055a5]/25 ring-offset-2 ring-offset-[#f4f8fc] dark:ring-offset-[#0a1628]"
        )}
      >
        {mounted && width > 0 && (
          <ReactGridLayout
            className="layout"
            layout={visibleLayout}
            width={width}
            gridConfig={{
              cols: GRID_COLS,
              rowHeight: GRID_ROW_HEIGHT,
              margin: [12, 12],
              containerPadding: [4, 0],
            }}
            dragConfig={{
              enabled: canEdit,
              handle: ".widget-drag-handle",
            }}
            resizeConfig={{ enabled: canEdit }}
            compactor={verticalCompactor}
            onLayoutChange={onLayoutChange}
          >
            {visibleWidgets.map((widget) => (
              <div
                key={widget.id}
                className={cn(
                  "flex flex-col overflow-hidden rounded-2xl border border-transparent bg-transparent",
                  canEdit && "border-[#0055a5]/15 bg-white shadow-sm dark:border-[#3d9ae8]/20 dark:bg-[#122238]"
                )}
              >
                {canEdit && (
                  <div className="widget-drag-handle flex shrink-0 cursor-grab items-center gap-1.5 border-b border-slate-100 bg-slate-50/90 px-3 py-1.5 active:cursor-grabbing dark:border-white/10 dark:bg-[#0f1c30]">
                    <GripVertical className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {widget.id.replace(/-/g, " ")}
                    </span>
                  </div>
                )}
                <div className="min-h-0 flex-1 overflow-auto">{widget.render()}</div>
              </div>
            ))}
          </ReactGridLayout>
        )}
      </div>
    </div>
  );
}
