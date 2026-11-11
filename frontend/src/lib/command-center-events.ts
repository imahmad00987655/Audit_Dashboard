import type { CommandCenterActivity } from "@/lib/api";

const STORAGE_KEY = "mgi-cc-seen-fingerprints-v1";
const BASELINE_KEY = "mgi-cc-baseline-ready-v1";
const MAX_STORED = 800;

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>) {
  if (typeof window === "undefined") return;
  const arr = [...set].slice(-MAX_STORED);
  sessionStorage.setItem(key, JSON.stringify(arr));
}

/** Call when global filters change so historical rows in the new scope are not treated as live. */
export function resetActivityBaseline() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(BASELINE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}

/** First poll establishes baseline — nothing announced as "new". */
export function ingestActivity(activity: CommandCenterActivity[]): {
  isBaseline: boolean;
  fresh: CommandCenterActivity[];
} {
  const seen = readSet(STORAGE_KEY);
  const baselineReady = sessionStorage.getItem(BASELINE_KEY) === "1";

  if (!baselineReady) {
    for (const e of activity) seen.add(e.fingerprint);
    writeSet(STORAGE_KEY, seen);
    sessionStorage.setItem(BASELINE_KEY, "1");
    return { isBaseline: true, fresh: [] };
  }

  const fresh: CommandCenterActivity[] = [];
  for (const e of activity) {
    if (seen.has(e.fingerprint)) continue;
    seen.add(e.fingerprint);
    fresh.push(e);
  }
  writeSet(STORAGE_KEY, seen);
  return { isBaseline: false, fresh };
}
