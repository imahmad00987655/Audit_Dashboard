"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function AnimatedCounter({
  value,
  formatter,
  className,
  duration = 900,
}: {
  value: number;
  formatter?: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const to = value || 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const text = formatter ? formatter(display) : Math.round(display).toLocaleString();

  return <span className={cn("tabular-nums", className)}>{text}</span>;
}
