"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarRange, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = parseISO(value);
  return isValid(d) ? d : undefined;
}

function toIsoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function dateOnlyMs(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

interface DatePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: LucideIcon;
  iconClassName?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  /** Smaller control for chart toolbars */
  compact?: boolean;
}

export function DatePicker({
  label,
  value,
  onChange,
  icon: Icon = CalendarRange,
  iconClassName = "text-[#2f7ec4]",
  min,
  max,
  placeholder = "Select date",
  className,
  compact = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => parseIsoDate(value) || new Date());
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = parseIsoDate(value);
  const minDate = parseIsoDate(min);
  const maxDate = parseIsoDate(max);

  useEffect(() => {
    const parsed = parseIsoDate(value);
    if (parsed) setViewMonth(parsed);
  }, [value]);

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

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const isDisabled = (day: Date) => {
    const t = dateOnlyMs(day);
    if (minDate && t < dateOnlyMs(minDate)) return true;
    if (maxDate && t > dateOnlyMs(maxDate)) return true;
    return false;
  };

  const display = selected
    ? compact
      ? format(selected, "yyyy-MM-dd")
      : format(selected, "dd MMM yyyy")
    : placeholder;
  const hasValue = !!selected;

  const pickToday = () => {
    const today = new Date();
    if (isDisabled(today)) return;
    onChange(toIsoDate(today));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group flex w-full items-center rounded-xl border bg-white text-left shadow-sm transition",
          compact ? "h-9 gap-1.5 px-2" : "h-10 gap-2 px-3",
          "border-[#0055a5]/18 hover:border-[#0055a5]/45 hover:shadow-md",
          "dark:border-white/15 dark:bg-[#0f1c30] dark:hover:border-[#3d9ae8]/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0055a5]/30 dark:focus-visible:ring-[#fff200]/25",
          open && "border-[#0055a5] ring-2 ring-[#0055a5]/20 dark:border-[#3d9ae8] dark:ring-[#fff200]/15",
          hasValue && "border-[#0055a5]/40 bg-[#f8fbfe] dark:border-[#3d9ae8]/40 dark:bg-[#152a45]"
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Icon className={cn("shrink-0", compact ? "h-3.5 w-3.5" : "h-4 w-4", iconClassName)} />
        {compact ? (
          <>
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-[#6d8499] dark:text-[#9aa8b8]">
              {label}
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[11px] font-semibold tabular-nums",
                hasValue ? "text-[#2a4a6e] dark:text-[#e8f1fa]" : "text-[#6d8499] dark:text-[#9aa8b8]"
              )}
            >
              {display}
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1">
            <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-[#6d8499] dark:text-[#9aa8b8]">
              {label}
            </span>
            <span
              className={cn(
                "block truncate text-sm font-semibold",
                hasValue ? "text-[#2a4a6e] dark:text-[#e8f1fa]" : "text-[#6d8499] dark:text-[#9aa8b8]"
              )}
            >
              {display}
            </span>
          </span>
        )}
        {hasValue && (
          <span
            role="button"
            tabIndex={0}
            className="shrink-0 rounded-md p-0.5 text-[#6d8499] hover:bg-[#eef5fc] hover:text-[#e31e24] dark:hover:bg-[#1a2d4a]"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
              }
            }}
            aria-label={`Clear ${label}`}
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`${label} calendar`}
          className={cn(
            "absolute top-[calc(100%+6px)] z-[100] w-[280px] min-w-[280px] overflow-hidden rounded-2xl border border-[#0055a5]/20 bg-white shadow-xl shadow-[#0055a5]/10 dark:border-white/15 dark:bg-[#122238] dark:shadow-black/40",
            compact ? "right-0" : "left-0"
          )}
        >
          <div className="border-b border-[#0055a5]/10 bg-linear-to-r from-[#eef5fc] to-white px-3 py-2.5 dark:border-white/10 dark:from-[#152a45] dark:to-[#122238]">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setViewMonth((m) => subMonths(m, 1))}
                className="rounded-lg p-1.5 text-[#0055a5] transition hover:bg-white/80 dark:text-[#7eb6e8] dark:hover:bg-[#1a2d4a]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-sm font-bold text-[#0055a5] dark:text-[#7eb6e8]">{format(viewMonth, "MMMM yyyy")}</p>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                className="rounded-lg p-1.5 text-[#0055a5] transition hover:bg-white/80 dark:text-[#7eb6e8] dark:hover:bg-[#1a2d4a]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-3">
            <div className="mb-1 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-[#6d8499] dark:text-[#9aa8b8]"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {days.map((day) => {
                const inMonth = isSameMonth(day, viewMonth);
                const sel = selected ? isSameDay(day, selected) : false;
                const today = isToday(day);
                const disabled = isDisabled(day);

                return (
                  <div key={day.toISOString()} className="flex aspect-square items-center justify-center p-0.5">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onChange(toIsoDate(day));
                        setOpen(false);
                      }}
                      className={cn(
                        "flex h-full w-full max-h-9 max-w-9 items-center justify-center rounded-full text-xs font-semibold transition",
                        !inMonth && "text-[#6d8499]/35 dark:text-[#9aa8b8]/35",
                        inMonth &&
                          !sel &&
                          !disabled &&
                          "text-[#2a4a6e] hover:bg-[#eef5fc] dark:text-[#e8f1fa] dark:hover:bg-[#1a2d4a]",
                        sel && "bg-[#0055a5] text-white shadow-sm dark:bg-[#3d9ae8] dark:text-[#0a1628]",
                        today &&
                          !sel &&
                          "font-bold text-[#0055a5] underline decoration-[#fff200] decoration-2 underline-offset-2 dark:text-[#fff200]",
                        disabled && "cursor-not-allowed opacity-30 hover:bg-transparent"
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#0055a5]/10 px-3 py-2 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="rounded-lg px-2 py-1 text-xs font-bold text-[#e31e24] transition hover:bg-[#e31e24]/8"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={pickToday}
              className="rounded-lg bg-[#0055a5] px-3 py-1 text-xs font-bold text-white transition hover:bg-[#2f7ec4] dark:bg-[#3d9ae8] dark:text-[#0a1628] dark:hover:bg-[#7eb6e8]"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
