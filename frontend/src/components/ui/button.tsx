"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0055a5]/35 disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-[#fff200]/35",
        variant === "default" && "bg-[#0055a5] text-white hover:bg-[#2f7ec4] dark:bg-[#3d9ae8] dark:text-[#0a1628] dark:hover:bg-[#7eb6e8]",
        variant === "outline" &&
          "border border-[#0055a5]/40 bg-white text-[#0055a5] hover:bg-[#eef5fc] dark:border-white/20 dark:bg-transparent dark:text-[#e8f1fa] dark:hover:bg-white/10",
        variant === "ghost" &&
          "text-[#0055a5] hover:bg-[#eef5fc] dark:text-[#7eb6e8] dark:hover:bg-white/10",
        variant === "secondary" &&
          "bg-[#fff200] text-[#0055a5] hover:bg-[#f5e800] dark:text-[#0a1628]",
        variant === "destructive" && "bg-[#e31e24] text-white hover:bg-[#c4181e]",
        size === "default" && "h-10 px-4 py-2",
        size === "sm" && "h-8 rounded-md px-3 text-xs",
        size === "lg" && "h-11 px-6",
        size === "icon" && "h-9 w-9",
        className
      )}
      {...props}
    />
  );
}
