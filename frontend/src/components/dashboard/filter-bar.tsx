"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, RotateCcw, Search, Sparkles, X, MousePointerClick } from "lucide-react";
import { api } from "@/lib/api";
import { useDashboard } from "@/context/dashboard-context";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { MultiSelect, joinMulti, parseMulti } from "@/components/ui/multi-select";
import { ChartIconBadge } from "@/components/dashboard/charts";
import type { DashboardFilters } from "@/lib/api";
import { cn } from "@/lib/utils";

const FILTER_CHIP_KEYS: (keyof DashboardFilters)[] = [
  "organization",
  "organizationName",
  "operatingUnit",
  "department",
  "prCreator",
  "poCreator",
  "approver",
  "approvalStatus",
  "purchaseType",
  "poRevised",
  "poLinkage",
  "year",
  "month",
  "search",
  "vendorId",
  "aging",
  "reqNo",
  "poNo",
  "itemCode",
  "receivingOrg",
  "grnUser",
  "grnLinkage",
  "grnReturnStatus",
  "poToGrnAging",
  "backdated",
];

const FILTER_LABELS: Partial<Record<keyof DashboardFilters, string>> = {
  organization: "Company",
  organizationName: "Organization Name",
  operatingUnit: "Operating Unit",
  department: "Department",
  prCreator: "PR Creator",
  poCreator: "PO Creator",
  approver: "Final Approver",
  approvalStatus: "Status",
  purchaseType: "Purchase Type",
  poRevised: "PO Revised",
  poLinkage: "PO Linkage",
  year: "Year",
  month: "Month",
  search: "Search",
  vendorId: "Vendor",
  aging: "Aging",
  reqNo: "PR No",
  poNo: "PO No",
  itemCode: "Item Code",
  receivingOrg: "Receiving Org",
  grnUser: "GRN User",
  grnLinkage: "GRN Linkage",
  grnReturnStatus: "Receipt Quality",
  poToGrnAging: "PO->GRN Aging",
  backdated: "Backdated GRN",
};

export function FilterBar() {
  const {
    filters,
    baseFilters,
    setFilter,
    resetFilters,
    drillPath,
    removeDrillAt,
    clearDrill,
  } = useDashboard();
  const { data } = useQuery({
    queryKey: [
      "filter-options",
      filters.organization,
      filters.organizationName,
      filters.operatingUnit,
      filters.dateFrom,
      filters.dateTo,
      filters.year,
      filters.month,
    ],
    queryFn: () =>
      api.filters({
        organization: filters.organization,
        organizationName: filters.organizationName,
        operatingUnit: filters.operatingUnit,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        year: filters.year,
        month: filters.month,
      }),
  });

  const opts = data?.data;

  // Drop selected child values that are no longer valid after cascade
  useEffect(() => {
    if (!opts) return;
    const prune = (key: keyof DashboardFilters, allowed: string[] | undefined) => {
      const raw = baseFilters[key];
      if (!raw || !allowed?.length) return;
      const selected = parseMulti(String(raw));
      const next = selected.filter((v) => allowed.includes(v));
      if (next.length !== selected.length) {
        setFilter(key, joinMulti(next) || "");
      }
    };
    prune("organizationName", opts.organizationNames);
    prune("operatingUnit", opts.operatingUnits);
    prune("department", opts.departments);
    prune("prCreator", opts.prCreators);
    prune("poCreator", opts.poCreators);
    prune("approver", opts.approvers);
    prune("purchaseType", opts.purchaseTypes);
    prune("receivingOrg", opts.receivingOrgs);
    prune("grnUser", opts.grnUsers);
  }, [opts, baseFilters, setFilter]);

  const setMulti = (key: keyof DashboardFilters, values: string[]) => {
    setFilter(key, joinMulti(values) || "");
  };

  const yearOptions = useMemo(
    () => (opts?.years || []).map((y) => ({ value: String(y), label: String(y) })),
    [opts?.years]
  );
  const monthOptions = useMemo(
    () => (opts?.months || []).map((m) => ({ value: String(m.value), label: m.label })),
    [opts?.months]
  );
  const orgOptions = useMemo(
    () => (opts?.organizations || []).map((o) => ({ value: o, label: o })),
    [opts?.organizations]
  );
  const organizationNameOptions = useMemo(
    () => (opts?.organizationNames || []).map((o) => ({ value: o, label: o })),
    [opts?.organizationNames]
  );
  const operatingUnitOptions = useMemo(
    () => (opts?.operatingUnits || []).map((o) => ({ value: o, label: o })),
    [opts?.operatingUnits]
  );
  const deptOptions = useMemo(
    () => (opts?.departments || []).map((d) => ({ value: d, label: d })),
    [opts?.departments]
  );
  const prOptions = useMemo(
    () => (opts?.prCreators || []).map((d) => ({ value: d, label: d })),
    [opts?.prCreators]
  );
  const poOptions = useMemo(
    () => (opts?.poCreators || []).map((d) => ({ value: d, label: d })),
    [opts?.poCreators]
  );
  const approverOptions = useMemo(
    () => (opts?.approvers || []).map((d) => ({ value: d, label: d })),
    [opts?.approvers]
  );
  const statusOptions = useMemo(
    () =>
      (opts?.approvalStatuses || []).map((s) => ({
        value: s,
        label: s.charAt(0) + s.slice(1).toLowerCase(),
      })),
    [opts?.approvalStatuses]
  );
  const purchaseTypeOptions = useMemo(
    () => (opts?.purchaseTypes || []).map((t) => ({ value: t, label: t })),
    [opts?.purchaseTypes]
  );
  const revisionOptions = useMemo(
    () => [
      { value: "0", label: "Never revised" },
      { value: "1", label: "1 revision" },
      { value: "2", label: "2 revisions" },
      { value: "3", label: "3 revisions" },
      { value: "4+", label: "4+ revisions" },
      { value: "revised", label: "Any revised (1+)" },
    ],
    []
  );
  const linkageOptions = useMemo(
    () => [
      { value: "withPr", label: "With PR" },
      { value: "withoutPr", label: "Without PR" },
    ],
    []
  );
  const grnLinkageOptions = useMemo(
    () => opts?.grnLinkages || [
      { value: "withGrn", label: "With GRN" },
      { value: "withoutGrn", label: "Without GRN" },
    ],
    [opts?.grnLinkages]
  );
  const grnReturnStatusOptions = useMemo(
    () => opts?.grnReturnStatuses || [
      { value: "return", label: "Returned to Vendor" },
      { value: "acceptReject", label: "QC Partial Reject" },
      { value: "deliveryGap", label: "Not Fully Delivered" },
      { value: "clean", label: "All OK" },
    ],
    [opts?.grnReturnStatuses]
  );
  const receivingOrgOptions = useMemo(
    () => (opts?.receivingOrgs || []).map((o) => ({ value: o, label: o })),
    [opts?.receivingOrgs]
  );
  const grnUserOptions = useMemo(
    () => (opts?.grnUsers || []).map((u) => ({ value: u, label: u })),
    [opts?.grnUsers]
  );
  const poToGrnAgingOptions = useMemo(
    () => (opts?.poToGrnAgingBuckets || []).map((b) => ({ value: b, label: b })),
    [opts?.poToGrnAgingBuckets]
  );

  const activeCount = useMemo(() => {
    let n = drillPath.length;
    for (const k of FILTER_CHIP_KEYS) {
      if (baseFilters[k]) n += 1;
    }
    return n;
  }, [baseFilters, drillPath.length]);

  const manualFilterChips = useMemo(() => {
    const chips: { key: keyof DashboardFilters; value: string; label: string }[] = [];
    for (const key of FILTER_CHIP_KEYS) {
      const raw = baseFilters[key];
      if (!raw) continue;
      const values = raw.includes(",") ? parseMulti(raw) : [raw];
      for (const val of values) {
        const prefix = FILTER_LABELS[key] || key;
        chips.push({ key, value: val, label: `${prefix}: ${val}` });
      }
    }
    return chips;
  }, [baseFilters]);

  const removeManualChip = (key: keyof DashboardFilters, value: string) => {
    const raw = baseFilters[key];
    if (!raw) return;
    if (raw.includes(",")) {
      const next = parseMulti(raw).filter((v) => v !== value);
      setFilter(key, joinMulti(next) || "");
    } else {
      setFilter(key, "");
    }
  };

  return (
    <div className="sticky top-0 z-40 -mx-4 border-b border-[#0055a5]/15 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md md:-mx-6 md:px-6 dark:border-white/10 dark:bg-[#0a1628]/95">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <ChartIconBadge icon={Filter} tone="red" className="h-8 w-8 rounded-lg" />
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-[#0055a5] dark:text-[#fff200]">
              Global Filters
              {activeCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eef5fc] px-2 py-0.5 text-[10px] font-bold text-[#2f7ec4] dark:bg-[#1a2d4a] dark:text-[#7eb6e8]">
                  <Sparkles className="h-3 w-3" />
                  {activeCount} active
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#6d8499] dark:text-[#9aa8b8]">
              Multi-select - chart drill-down filters show below - remove any chip without refresh
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={resetFilters}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      {(drillPath.length > 0 || manualFilterChips.length > 0) && (
        <div className="mb-3 rounded-xl border border-[#0055a5]/15 bg-[#f8fbfe] px-3 py-2.5 dark:border-white/10 dark:bg-[#0f1c30]/80">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0055a5] dark:text-[#7eb6e8]">
              Active filters
            </span>
            {drillPath.length > 0 && (
              <button
                type="button"
                onClick={clearDrill}
                className="text-[10px] font-bold text-[#e31e24] hover:underline"
              >
                Clear all drill-down
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {drillPath.map((d, i) => (
              <span
                key={`drill-${d.level}-${d.value}-${i}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#0055a5] py-0.5 pl-2 pr-1 text-[11px] font-semibold text-white shadow-sm dark:bg-[#3d9ae8] dark:text-[#0a1628]"
                title="From chart drill-down - click x to remove"
              >
                <MousePointerClick className="h-3 w-3 shrink-0 opacity-80" />
                <span className="truncate">{d.label}</span>
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-white/20"
                  onClick={() => removeDrillAt(i)}
                  aria-label={`Remove drill filter ${d.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {manualFilterChips.map((chip) => (
              <span
                key={`manual-${chip.key}-${chip.value}`}
                className={cn(
                  "inline-flex max-w-full items-center gap-1 rounded-full border border-[#0055a5]/20 bg-white py-0.5 pl-2 pr-1 text-[11px] font-semibold text-[#0055a5] shadow-sm",
                  "dark:border-white/15 dark:bg-[#122238] dark:text-[#7eb6e8]"
                )}
                title="From global filters - click x to remove"
              >
                <Filter className="h-3 w-3 shrink-0 opacity-70" />
                <span className="truncate">{chip.label}</span>
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-[#eef5fc] hover:text-[#e31e24] dark:hover:bg-[#1a2d4a]"
                  onClick={() => removeManualChip(chip.key, chip.value)}
                  aria-label={`Remove filter ${chip.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Date range - custom calendar popover */}
      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <DatePicker
          label="From"
          value={filters.dateFrom || ""}
          onChange={(v) => {
            setFilter("dateFrom", v);
            if (filters.dateTo && v && v > filters.dateTo) setFilter("dateTo", v);
          }}
          max={filters.dateTo || undefined}
          iconClassName="text-[#2f7ec4]"
        />
        <DatePicker
          label="To"
          value={filters.dateTo || ""}
          onChange={(v) => {
            setFilter("dateTo", v);
            if (filters.dateFrom && v && v < filters.dateFrom) setFilter("dateFrom", v);
          }}
          min={filters.dateFrom || undefined}
          iconClassName="text-[#e31e24]"
        />
        <MultiSelect
          label="Year"
          options={yearOptions}
          value={parseMulti(filters.year)}
          onChange={(v) => setMulti("year", v)}
          placeholder="All years"
        />
        <MultiSelect
          label="Month"
          options={monthOptions}
          value={parseMulti(filters.month)}
          onChange={(v) => setMulti("month", v)}
          placeholder="All months"
        />
      </div>

      {/* Dimension filters - multi checkbox */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        <MultiSelect
          label="Company Name"
          options={orgOptions}
          value={parseMulti(filters.organization)}
          onChange={(v) => setMulti("organization", v)}
          placeholder="All Company"
        />
        <MultiSelect
          label="Organization Name"
          options={organizationNameOptions}
          value={parseMulti(filters.organizationName)}
          onChange={(v) => setMulti("organizationName", v)}
          placeholder="All organizations"
        />
        <MultiSelect
          label="Operating Unit"
          options={operatingUnitOptions}
          value={parseMulti(filters.operatingUnit)}
          onChange={(v) => setMulti("operatingUnit", v)}
          placeholder="All operating units"
        />
        <MultiSelect
          label="Department"
          options={deptOptions}
          value={parseMulti(filters.department)}
          onChange={(v) => setMulti("department", v)}
          placeholder="All departments"
        />
        <MultiSelect
          label="PR Creator"
          options={prOptions}
          value={parseMulti(filters.prCreator)}
          onChange={(v) => setMulti("prCreator", v)}
          placeholder="All PR creators"
        />
        <MultiSelect
          label="PO Creator"
          options={poOptions}
          value={parseMulti(filters.poCreator)}
          onChange={(v) => setMulti("poCreator", v)}
          placeholder="All PO creators"
        />
        <MultiSelect
          label="Final Approver"
          options={approverOptions}
          value={parseMulti(filters.approver)}
          onChange={(v) => setMulti("approver", v)}
          placeholder="All final approvers"
        />
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MultiSelect
          label="Approval Status"
          options={statusOptions}
          value={parseMulti(filters.approvalStatus)}
          onChange={(v) => setMulti("approvalStatus", v)}
          placeholder="All statuses"
          searchable={false}
        />
        <MultiSelect
          label="Purchase Type"
          options={purchaseTypeOptions}
          value={parseMulti(filters.purchaseType)}
          onChange={(v) => setMulti("purchaseType", v)}
          placeholder="All purchase types"
        />
        <MultiSelect
          label="PO Revisions"
          options={revisionOptions}
          value={parseMulti(filters.poRevised)}
          onChange={(v) => setMulti("poRevised", v)}
          placeholder="All revision counts"
          searchable={false}
        />
        <MultiSelect
          label="PO Linkage"
          options={linkageOptions}
          value={parseMulti(filters.poLinkage)}
          onChange={(v) => setMulti("poLinkage", v)}
          placeholder="With / without PR"
          searchable={false}
        />
        <div className="relative md:col-span-2 xl:col-span-1">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-[#0055a5]/18 bg-white px-3 shadow-sm transition focus-within:border-[#0055a5] focus-within:ring-2 focus-within:ring-[#0055a5]/20 hover:border-[#0055a5]/40 dark:border-white/15 dark:bg-[#0f1c30] dark:focus-within:border-[#3d9ae8] dark:focus-within:ring-[#fff200]/20">
            <Search className="h-4 w-4 shrink-0 text-[#2f7ec4]" />
            <span className="sr-only">Global search</span>
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-[#2a4a6e] outline-none placeholder:text-[#6d8499] dark:text-[#e8f1fa] dark:placeholder:text-[#9aa8b8]"
              placeholder="Global search (PR, PO, vendor, item...)"
              value={filters.search || ""}
              onChange={(e) => setFilter("search", e.target.value)}
            />
            {filters.search && (
              <button
                type="button"
                className="rounded-md p-0.5 text-[#6d8499] hover:bg-[#eef5fc] hover:text-[#e31e24] dark:hover:bg-[#1a2d4a]"
                onClick={() => setFilter("search", "")}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MultiSelect
          label="Receiving Organization"
          options={receivingOrgOptions}
          value={parseMulti(filters.receivingOrg)}
          onChange={(v) => setMulti("receivingOrg", v)}
          placeholder="All receiving orgs"
        />
        <MultiSelect
          label="GRN User"
          options={grnUserOptions}
          value={parseMulti(filters.grnUser)}
          onChange={(v) => setMulti("grnUser", v)}
          placeholder="All GRN users"
        />
        <MultiSelect
          label="GRN Linkage"
          options={grnLinkageOptions}
          value={parseMulti(filters.grnLinkage)}
          onChange={(v) => setMulti("grnLinkage", v)}
          placeholder="With / without GRN"
          searchable={false}
        />
        <MultiSelect
          label="Receipt Quality"
          options={grnReturnStatusOptions}
          value={parseMulti(filters.grnReturnStatus)}
          onChange={(v) => setMulti("grnReturnStatus", v)}
          placeholder="All receipt types"
          searchable={false}
        />
        <MultiSelect
          label="PO -> GRN Aging"
          options={poToGrnAgingOptions}
          value={parseMulti(filters.poToGrnAging)}
          onChange={(v) => setMulti("poToGrnAging", v)}
          placeholder="All PO->GRN buckets"
          searchable={false}
        />
        <MultiSelect
          label="Backdated GRN"
          options={[
            { value: "yes", label: "Backdated only" },
          ]}
          value={filters.backdated ? ["yes"] : []}
          onChange={(v) => setFilter("backdated", v.includes("yes") ? "yes" : "")}
          placeholder="All GRNs"
          searchable={false}
        />
      </div>
    </div>
  );
}
