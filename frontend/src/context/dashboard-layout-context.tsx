"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Layout } from "react-grid-layout";
import { toast } from "sonner";
import {
  DEFAULT_DASHBOARD_LAYOUT,
  LAYOUT_STORAGE_KEY,
  loadSavedLayout,
  mergeLayoutWithDefaults,
} from "@/lib/dashboard-layout";

type DashboardLayoutContextValue = {
  layout: Layout;
  mergedLayout: Layout;
  editMode: boolean;
  isDirty: boolean;
  enterEditMode: () => void;
  cancelEdit: () => void;
  saveLayout: () => void;
  resetLayout: () => void;
  setLayout: (layout: Layout) => void;
};

const DashboardLayoutContext = createContext<DashboardLayoutContextValue | null>(null);

export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<Layout>(() => {
    const saved = loadSavedLayout();
    return saved ? mergeLayoutWithDefaults(saved) : DEFAULT_DASHBOARD_LAYOUT;
  });
  const [editMode, setEditMode] = useState(false);
  const [snapshot, setSnapshot] = useState<Layout | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const mergedLayout = useMemo(() => mergeLayoutWithDefaults(layout), [layout]);

  const setLayout = useCallback((next: Layout) => {
    setLayoutState(next);
    setIsDirty(true);
  }, []);

  const enterEditMode = useCallback(() => {
    setSnapshot([...mergedLayout]);
    setEditMode(true);
  }, [mergedLayout]);

  const cancelEdit = useCallback(() => {
    if (snapshot) setLayoutState(snapshot);
    setSnapshot(null);
    setEditMode(false);
    setIsDirty(false);
  }, [snapshot]);

  const saveLayout = useCallback(() => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    setSnapshot(null);
    setEditMode(false);
    setIsDirty(false);
    toast.success("Dashboard layout saved for all users");
  }, [layout]);

  const resetLayout = useCallback(() => {
    setLayoutState(DEFAULT_DASHBOARD_LAYOUT);
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
    setSnapshot(null);
    setEditMode(false);
    setIsDirty(false);
    toast.success("Dashboard layout reset to default");
  }, []);

  const value = useMemo(
    () => ({
      layout,
      mergedLayout,
      editMode,
      isDirty,
      enterEditMode,
      cancelEdit,
      saveLayout,
      resetLayout,
      setLayout,
    }),
    [
      layout,
      mergedLayout,
      editMode,
      isDirty,
      enterEditMode,
      cancelEdit,
      saveLayout,
      resetLayout,
      setLayout,
    ]
  );

  return (
    <DashboardLayoutContext.Provider value={value}>{children}</DashboardLayoutContext.Provider>
  );
}

export function useDashboardLayout() {
  const ctx = useContext(DashboardLayoutContext);
  if (!ctx) {
    throw new Error("useDashboardLayout must be used within DashboardLayoutProvider");
  }
  return ctx;
}
