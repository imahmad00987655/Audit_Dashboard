"use client";

import { useEffect, useState } from "react";

/** Delay enabling heavy queries so above-the-fold KPIs paint first. */
export function useDeferredReady(delayMs = 400) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);
  return ready;
}
