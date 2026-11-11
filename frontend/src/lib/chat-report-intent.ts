/**
 * Detect day-end / share-report intent from Urdu-English chat text.
 */
export function detectReportShareIntent(text: string): boolean {
  const t = String(text || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .trim();
  if (!t) return false;

  const patterns = [
    /\bday[\s-]*end\b.*\breport\b/,
    /\breport\b.*\b(share|submit|send|bhej|email)\b/,
    /\b(share|submit|send|bhej)\b.*\breport\b/,
    /\breport\s*(kardo|kar\s*do|kar\s*dein|share\s*kardo|share\s*kar\s*do)\b/,
    /\b(aaj|aj|today)\b.*\breport\b.*(share|bhej|submit|kardo|kar\s*do)/,
    /\breport\b.*(aaj|aj|today).*(share|bhej|kardo)/,
    /\b(share|bhej)\b.*(aaj|today).*\breport\b/,
    /\baaj\s*ki\s*report\b/,
    /\btoday'?s?\s*report\b.*(share|send|submit)?/,
  ];

  return patterns.some((re) => re.test(t));
}

export function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
