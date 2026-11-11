"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultiOption = { value: string; label: string };

interface MultiSelectProps {
  label: string;
  options: MultiOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
  /** Single-select mode still uses the same modern popover UI */
  single?: boolean;
}

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "All",
  searchable = true,
  className,
  single = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(term) || o.value.toLowerCase().includes(term)
    );
  }, [options, q]);

  const selectedLabels = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]));
    return value.map((v) => map.get(v) || v);
  }, [options, value]);

  const toggle = (v: string) => {
    if (single) {
      onChange(value.includes(v) ? [] : [v]);
      setOpen(false);
      return;
    }
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  const allSelected = !single && options.length > 0 && value.length === options.length;

  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? selectedLabels[0]
        : `${value.length} selected`;

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group flex h-10 w-full items-center gap-2 rounded-xl border bg-white px-3 text-left shadow-sm transition",
          "border-[#0055a5]/18 hover:border-[#0055a5]/45 hover:shadow-md",
          "dark:border-white/15 dark:bg-[#0f1c30] dark:hover:border-[#3d9ae8]/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0055a5]/30 dark:focus-visible:ring-[#fff200]/25",
          open && "border-[#0055a5] ring-2 ring-[#0055a5]/20 dark:border-[#3d9ae8] dark:ring-[#fff200]/15",
          value.length > 0 && "border-[#0055a5]/40 bg-[#f8fbfe] dark:border-[#3d9ae8]/40 dark:bg-[#152a45]"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0 flex-1">
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
            {label}
            {value.length > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0055a5] px-1 text-[9px] text-white dark:bg-[#3d9ae8] dark:text-[#0a1628]">
                {value.length}
              </span>
            )}
          </span>
          <span
            className={cn(
              "block truncate text-sm font-semibold",
              value.length ? "text-[#2a4a6e] dark:text-[#e8f1fa]" : "text-[#6d8499] dark:text-[#9aa8b8]"
            )}
          >
            {summary}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {value.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              className="rounded-md p-0.5 text-[#6d8499] hover:bg-[#eef5fc] hover:text-[#e31e24] dark:hover:bg-[#1a2d4a]"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange([]);
                }
              }}
              aria-label={`Clear ${label}`}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronsUpDown className="h-4 w-4 text-[#2f7ec4] opacity-80 dark:text-[#7eb6e8]" />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-[#0055a5]/20 bg-white shadow-xl shadow-[#0055a5]/10 dark:border-white/15 dark:bg-[#122238] dark:shadow-black/40">
          {searchable && (
            <div className="border-b border-[#0055a5]/10 p-2 dark:border-white/10">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6d8499]" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  className="h-8 w-full rounded-lg border border-[#0055a5]/15 bg-[#f8fbfe] pl-8 pr-2 text-xs text-[#2a4a6e] outline-none focus:border-[#0055a5]/40 focus:ring-1 focus:ring-[#0055a5]/25 dark:border-white/10 dark:bg-[#0f1c30] dark:text-[#e8f1fa]"
                />
              </div>
            </div>
          )}

          {!single && (
            <div className="flex items-center justify-between gap-2 border-b border-[#0055a5]/10 px-3 py-1.5 dark:border-white/10">
              <button
                type="button"
                className="text-[11px] font-bold text-[#0055a5] hover:underline dark:text-[#7eb6e8]"
                onClick={() => onChange(allSelected ? [] : options.map((o) => o.value))}
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
              <span className="text-[10px] font-medium text-[#6d8499] dark:text-[#9aa8b8]">
                {value.length}/{options.length}
              </span>
            </div>
          )}

          <ul
            role="listbox"
            aria-multiselectable={!single}
            className="max-h-56 overflow-auto py-1"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-[#6d8499] dark:text-[#9aa8b8]">No matches</li>
            )}
            {filtered.map((o) => {
              const checked = value.includes(o.value);
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(o.value)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition",
                      checked
                        ? "bg-[#eef5fc] text-[#0055a5] dark:bg-[#1a2d4a] dark:text-[#7eb6e8]"
                        : "text-[#2a4a6e] hover:bg-[#f8fbfe] dark:text-[#e8f1fa] dark:hover:bg-[#152a45]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                        single ? "rounded-full" : "rounded",
                        checked
                          ? "border-[#0055a5] bg-[#0055a5] text-white dark:border-[#3d9ae8] dark:bg-[#3d9ae8] dark:text-[#0a1628]"
                          : "border-[#0055a5]/30 bg-white dark:border-white/25 dark:bg-[#0f1c30]"
                      )}
                    >
                      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{o.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Parse comma-separated filter string → string[] */
export function parseMulti(value?: string): string[] {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Join selected values for API query */
export function joinMulti(values: string[]): string | undefined {
  return values.length ? values.join(",") : undefined;
}
