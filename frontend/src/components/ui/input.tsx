"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-[#0055a5]/20 bg-white px-3 py-1 text-sm text-[#2a4a6e] shadow-sm transition placeholder:text-[#6d8499] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0055a5]/30",
        "dark:border-white/15 dark:bg-[#0f1c30] dark:text-[#e8f1fa] dark:placeholder:text-[#9aa8b8] dark:focus-visible:ring-[#fff200]/30",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-9 w-full rounded-md border border-[#0055a5]/20 bg-white px-3 py-1 text-sm text-[#2a4a6e] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0055a5]/30",
        "dark:border-white/15 dark:bg-[#0f1c30] dark:text-[#e8f1fa]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "success" | "warning" | "danger" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        variant === "default" && "bg-[#eef5fc] text-[#0055a5] dark:bg-[#1a2d4a] dark:text-[#7eb6e8]",
        variant === "success" && "bg-[#0055a5]/10 text-[#0055a5] dark:bg-[#0055a5]/30 dark:text-[#7eb6e8]",
        variant === "warning" && "bg-[#fff200]/50 text-[#2f7ec4] dark:bg-[#fff200]/20 dark:text-[#fff200]",
        variant === "danger" && "bg-[#e31e24]/12 text-[#e31e24]",
        variant === "muted" && "bg-[#f3f7fc] text-[#6d8499] dark:bg-[#1a2d4a] dark:text-[#9aa8b8]",
        className
      )}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[#eef5fc] dark:bg-[#1a2d4a]", className)}
      {...props}
    />
  );
}
