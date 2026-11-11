"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const EDGE_THRESHOLD = 56;
const SCROLL_MIN_MS = 1600;
const SCROLL_MAX_MS = 4800;
const SCROLL_MS_PER_PX = 1.1;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function smoothScrollTo(targetTop: number, onDone?: () => void) {
  const startTop = window.scrollY || document.documentElement.scrollTop;
  const distance = Math.abs(targetTop - startTop);
  if (distance < 2) {
    onDone?.();
    return () => {};
  }

  const duration = Math.min(SCROLL_MAX_MS, Math.max(SCROLL_MIN_MS, distance * SCROLL_MS_PER_PX));
  const startTime = performance.now();
  let frameId = 0;

  const step = (now: number) => {
    const progress = Math.min(1, (now - startTime) / duration);
    const next = startTop + (targetTop - startTop) * easeInOutCubic(progress);
    window.scrollTo(0, next);

    if (progress < 1) {
      frameId = requestAnimationFrame(step);
    } else {
      window.scrollTo(0, targetTop);
      onDone?.();
    }
  };

  frameId = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frameId);
}

export function DashboardScrollControl() {
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const cancelScrollRef = useRef<(() => void) | null>(null);

  const updateScrollState = useCallback(() => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    setCanScroll(maxScroll > 80);
    setAtTop(scrollTop <= EDGE_THRESHOLD);
    setAtBottom(maxScroll - scrollTop <= EDGE_THRESHOLD);
  }, []);

  useEffect(() => {
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      window.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      cancelScrollRef.current?.();
    };
  }, [updateScrollState]);

  const runScroll = (targetTop: number) => {
    if (scrolling) return;
    cancelScrollRef.current?.();
    setScrolling(true);
    cancelScrollRef.current = smoothScrollTo(targetTop, () => {
      setScrolling(false);
      cancelScrollRef.current = null;
      updateScrollState();
    });
  };

  const scrollToTop = () => runScroll(0);

  const scrollToBottom = () => {
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    runScroll(maxScroll);
  };

  if (!canScroll) return null;

  const upDisabled = atTop || scrolling;
  const downDisabled = atBottom || scrolling;

  return (
    <div
      className="fixed bottom-6 right-4 z-50 flex flex-col overflow-hidden rounded-xl border-2 border-[#0055a5]/30 bg-white/95 shadow-[0_8px_28px_rgba(0,85,165,0.18)] backdrop-blur-sm dark:border-white/15 dark:bg-[#0a1528]/95 md:bottom-8 md:right-6"
      aria-label="Dashboard scroll"
    >
      <button
        type="button"
        onClick={scrollToTop}
        disabled={upDisabled}
        aria-label="Scroll to top"
        title="Aahista top par jayein"
        className={cn(
          "flex h-11 w-11 items-center justify-center transition-colors",
          upDisabled
            ? "cursor-default text-[#6d8499]/45"
            : "text-[#0055a5] hover:bg-[#0055a5]/10 active:bg-[#0055a5]/15 dark:text-[#7eb6e8] dark:hover:bg-white/10"
        )}
      >
        <ChevronUp className="h-6 w-6" strokeWidth={2.75} />
      </button>

      <div className="h-px bg-[#0055a5]/15 dark:bg-white/10" />

      <button
        type="button"
        onClick={scrollToBottom}
        disabled={downDisabled}
        aria-label="Scroll to bottom"
        title="Aahista neeche tak jayein"
        className={cn(
          "flex h-11 w-11 items-center justify-center transition-colors",
          downDisabled
            ? "cursor-default text-[#6d8499]/45"
            : "text-[#e31e24] hover:bg-[#e31e24]/8 active:bg-[#e31e24]/12 dark:text-[#ff6b6f] dark:hover:bg-white/10"
        )}
      >
        <ChevronDown className="h-6 w-6" strokeWidth={2.75} />
      </button>
    </div>
  );
}
