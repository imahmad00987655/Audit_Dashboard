"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { DashboardFilters, DrillPath } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface DashboardContextValue {
  filters: DashboardFilters;
  baseFilters: DashboardFilters;
  setFilter: (key: keyof DashboardFilters, value: string) => void;
  setFilters: (next: DashboardFilters) => void;
  resetFilters: () => void;
  drillPath: DrillPath[];
  pushDrill: (item: DrillPath) => void;
  popDrill: (index?: number) => void;
  removeDrillAt: (index: number) => void;
  clearDrill: () => void;
  activeDrill: DrillPath | null;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultFilters(organization?: string): DashboardFilters {
  const today = todayISO();
  return {
    dateFrom: today,
    dateTo: today,
    ...(organization ? { organization } : {}),
  };
}

function filtersFromPath(path: DrillPath[]): DashboardFilters {
  const next: DashboardFilters = {};
  for (const item of path) {
    if (!item.value || item.value === "ALL") continue;
    if (item.level === "department") next.department = item.value;
    else if (item.level === "organization") next.organization = item.value;
    else if (item.level === "operatingUnit") next.operatingUnit = item.value;
    else if (item.level === "prCreator") next.prCreator = item.value;
    else if (item.level === "poCreator") next.poCreator = item.value;
    else if (item.level === "approver") next.approver = item.value;
    else if (item.level === "approvalStatus") next.approvalStatus = item.value;
    else if (item.level === "purchaseType") next.purchaseType = item.value;
    else if (item.level === "poRevised") next.poRevised = item.value;
    else if (item.level === "poLinkage") next.poLinkage = item.value;
    else if (item.level === "vendor") next.vendorId = item.value;
    else if (item.level === "aging") next.aging = item.value;
    else if (item.level === "reqNo") next.reqNo = item.value;
    else if (item.level === "poNo") next.poNo = item.value;
    else if (item.level === "itemCode") next.itemCode = item.value;
    else if (item.level === "receivingOrg") next.receivingOrg = item.value;
    else if (item.level === "receiptNum") next.receiptNum = item.value;
    else if (item.level === "grnUser") next.grnUser = item.value;
    else if (item.level === "grnLinkage") next.grnLinkage = item.value;
    else if (item.level === "poToGrnAging") next.poToGrnAging = item.value;
    else if (item.level === "grnReturnStatus") next.grnReturnStatus = item.value;
    else if (item.level === "year") next.year = item.value;
    else if (item.level === "month") {
      const [y, m] = item.value.split("-");
      if (y) next.year = y;
      if (m) next.month = String(Number(m));
    }
  }
  return next;
}

function drillLevelsForFilterKey(key: keyof DashboardFilters): string[] {
  switch (key) {
    case "department":
      return ["department"];
    case "organization":
      return ["organization"];
    case "operatingUnit":
      return ["operatingUnit"];
    case "prCreator":
      return ["prCreator"];
    case "poCreator":
      return ["poCreator"];
    case "approver":
      return ["approver"];
    case "approvalStatus":
      return ["approvalStatus"];
    case "purchaseType":
      return ["purchaseType"];
    case "poRevised":
      return ["poRevised"];
    case "poLinkage":
      return ["poLinkage"];
    case "vendorId":
      return ["vendor"];
    case "aging":
      return ["aging"];
    case "reqNo":
      return ["reqNo"];
    case "poNo":
      return ["poNo"];
    case "itemCode":
      return ["itemCode"];
    case "receivingOrg":
      return ["receivingOrg"];
    case "receiptNum":
      return ["receiptNum"];
    case "grnUser":
      return ["grnUser"];
    case "grnLinkage":
      return ["grnLinkage"];
    case "poToGrnAging":
      return ["poToGrnAging"];
    case "grnReturnStatus":
      return ["grnReturnStatus"];
    case "backdated":
      return ["backdated"];
    case "year":
      return ["year", "month"];
    case "month":
      return ["month"];
    default:
      return [];
  }
}

function removeDrillForFilterKey(path: DrillPath[], key: keyof DashboardFilters): DrillPath[] {
  const levels = new Set(drillLevelsForFilterKey(key));
  if (!levels.size) return path;
  return path.filter((p) => !levels.has(p.level));
}

function scopedOrgFromUser(user: {
  role?: string;
  dataAccess?: { unrestricted?: boolean; organizations?: string[] };
} | null): string | undefined {
  if (!user || user.role === "admin") return undefined;
  const da = user.dataAccess;
  if (!da || da.unrestricted) return undefined;
  const orgs = da.organizations || [];
  if (!orgs.length) return undefined;
  // Single company → lock filter; multiple → join so charts default to allowed set
  return orgs.join(",");
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const scopedOrg = scopedOrgFromUser(user);
  const [baseFilters, setBaseFilters] = useState<DashboardFilters>(() => defaultFilters());
  const [drillPath, setDrillPath] = useState<DrillPath[]>([]);
  const [activeDrill, setActiveDrill] = useState<DrillPath | null>(null);

  // When user / data access changes, reset dates + apply allowed companies
  useEffect(() => {
    if (!user?.id) return;
    setBaseFilters(defaultFilters(scopedOrg));
    setDrillPath([]);
    setActiveDrill(null);
  }, [user?.id, scopedOrg]);

  const filters = useMemo(() => {
    const drilled = filtersFromPath(drillPath);
    return { ...baseFilters, ...drilled };
  }, [baseFilters, drillPath]);

  const setFilter = useCallback((key: keyof DashboardFilters, value: string) => {
    setBaseFilters((prev) => {
      const next: DashboardFilters = { ...prev, [key]: value || undefined };
      if (key === "organization") {
        delete next.organizationName;
        delete next.operatingUnit;
        delete next.department;
        delete next.prCreator;
        delete next.poCreator;
        delete next.approver;
        delete next.purchaseType;
        delete next.receivingOrg;
        delete next.grnUser;
      }
      if (key === "organizationName") {
        delete next.operatingUnit;
        delete next.department;
        delete next.prCreator;
        delete next.poCreator;
        delete next.approver;
        delete next.purchaseType;
        delete next.receivingOrg;
        delete next.grnUser;
      }
      if (key === "operatingUnit") {
        delete next.department;
        delete next.prCreator;
        delete next.poCreator;
        delete next.approver;
        delete next.purchaseType;
        delete next.receivingOrg;
        delete next.grnUser;
      }
      return next;
    });
    setDrillPath((prev) => removeDrillForFilterKey(prev, key));
  }, []);

  const setFilters = useCallback((next: DashboardFilters) => {
    setBaseFilters(next);
  }, []);

  const resetFilters = useCallback(() => {
    setBaseFilters(defaultFilters(scopedOrg));
    setDrillPath([]);
    setActiveDrill(null);
  }, [scopedOrg]);

  const pushDrill = useCallback((item: DrillPath) => {
    if (!item.value) return;
    setDrillPath((prev) => {
      const idx = prev.findIndex((p) => p.level === item.level);
      if (idx >= 0) {
        const same = prev[idx].value === item.value;
        if (same) return prev;
        return [...prev.slice(0, idx), item];
      }
      return [...prev, item];
    });
    setActiveDrill(item);
  }, []);

  const popDrill = useCallback((index?: number) => {
    setDrillPath((prev) => {
      const next =
        index === undefined ? prev.slice(0, -1) : prev.slice(0, Math.max(0, index + 1));
      setActiveDrill(next.length ? next[next.length - 1] : null);
      return next;
    });
  }, []);

  const removeDrillAt = useCallback((index: number) => {
    setDrillPath((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setActiveDrill(next.length ? next[next.length - 1] : null);
      return next;
    });
  }, []);

  const clearDrill = useCallback(() => {
    setDrillPath([]);
    setActiveDrill(null);
  }, []);

  const value = useMemo(
    () => ({
      filters,
      baseFilters,
      setFilter,
      setFilters,
      resetFilters,
      drillPath,
      pushDrill,
      popDrill,
      removeDrillAt,
      clearDrill,
      activeDrill,
    }),
    [
      filters,
      baseFilters,
      setFilter,
      setFilters,
      resetFilters,
      drillPath,
      pushDrill,
      popDrill,
      removeDrillAt,
      clearDrill,
      activeDrill,
    ]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
