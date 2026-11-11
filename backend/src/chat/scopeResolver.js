/**
 * Dynamic scope detection — companies, dates, aliases from live data (not hardcoded).
 */
const {
  getRawData,
  applyFilters,
  getFilterOptions,
  resolveOrganizationFilter,
  resolveOperatingUnitFilter,
} = require("../services/dataService");

function karachiTodayIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function karachiYear() {
  return karachiTodayIso().slice(0, 4);
}

/** Build searchable aliases from canonical company names in data. */
function buildCompanyCatalog(rows) {
  const names = getFilterOptions(rows).organizations;
  return names.map((canonicalName) => {
    const lower = canonicalName.toLowerCase();
    const aliases = new Set([lower, canonicalName]);

    for (const token of lower.split(/[^a-z0-9]+/)) {
      if (token.length >= 3) aliases.add(token);
    }

    if (lower.includes("procon")) {
      aliases.add("procon");
      aliases.add("procon engineering");
      aliases.add("procon eng");
    }
    if (lower.includes("master")) {
      aliases.add("master");
      aliases.add("master enterprise");
      aliases.add("master enterprises");
      aliases.add("mel");
    }
    if (lower.includes("foamco")) {
      aliases.add("foamco");
      aliases.add("foam");
    }

    return {
      canonicalName,
      aliases: [...aliases].sort((a, b) => b.length - a.length),
    };
  });
}

function detectCompanyFromMessage(message, rows) {
  const text = String(message || "").toLowerCase();
  if (!text.trim()) return null;

  const catalog = buildCompanyCatalog(rows);
  let best = null;
  let bestLen = 0;

  for (const entry of catalog) {
    for (const alias of entry.aliases) {
      if (alias.length < 3) continue;
      if (text.includes(alias) && alias.length > bestLen) {
        bestLen = alias.length;
        best = entry.canonicalName;
      }
    }
  }

  return best;
}

function detectOperatingUnitFromMessage(message, rows) {
  const text = String(message || "").toLowerCase();
  const units = getFilterOptions(rows).operatingUnits;
  let best = null;
  let bestLen = 0;
  for (const unit of units) {
    const lower = unit.toLowerCase();
    if (text.includes(lower) && lower.length > bestLen) {
      bestLen = lower.length;
      best = unit;
    }
    if (lower.includes("head office") && text.includes("head office") && lower.length > bestLen) {
      bestLen = lower.length;
      best = unit;
    }
  }
  return best;
}

function detectDateRangeFromMessage(message) {
  const text = String(message || "").toLowerCase();
  const today = karachiTodayIso();
  const year = karachiYear();
  const toNow = /(ab\s*tak|until\s*now|till\s*(date|now)|se\s*ab|say\s*ab|to\s*date|le\s*kar\s*(ab|aaj|today)|lekra\s*(ab|aaj|today)|to\s*(today|ab|aaj))/i.test(
    text
  );

  const augToNow =
    /(1\s*(st)?\s*aug(ust)?|august\s*1|۱\s*اگست)/i.test(text) && toNow;
  if (augToNow) {
    return { dateFrom: `${year}-08-01`, dateTo: today, explicit: true };
  }

  const janToNow =
    /(1\s*(st)?\s*jan(uary)?|january\s*1|۱\s*جنوری|1\s*january)/i.test(text) && toNow;
  if (janToNow) {
    return { dateFrom: `${year}-01-01`, dateTo: today, explicit: true };
  }

  // e.g. "15 march say ab tak" / "from 2026-03-01 to today"
  const mdY = text.match(
    /\b(\d{1,2})\s*(st|nd|rd|th)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s*(\d{4}))?/i
  );
  if (mdY && toNow) {
    const months = {
      jan: "01",
      january: "01",
      feb: "02",
      february: "02",
      mar: "03",
      march: "03",
      apr: "04",
      april: "04",
      may: "05",
      jun: "06",
      june: "06",
      jul: "07",
      july: "07",
      aug: "08",
      august: "08",
      sep: "09",
      sept: "09",
      september: "09",
      oct: "10",
      october: "10",
      nov: "11",
      november: "11",
      dec: "12",
      december: "12",
    };
    const day = String(mdY[1]).padStart(2, "0");
    const mon = months[String(mdY[3]).toLowerCase()];
    const y = mdY[4] || year;
    if (mon) {
      return { dateFrom: `${y}-${mon}-${day}`, dateTo: today, explicit: true };
    }
  }

  const isoFrom = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoFrom && toNow) {
    return { dateFrom: isoFrom[1], dateTo: today, explicit: true };
  }

  if (/\b(aaj|aj|today)\b/i.test(text)) {
    return { dateFrom: today, dateTo: today, explicit: true };
  }

  if (/\byesterday\b|\bkal\b/i.test(text)) {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - 1);
    const iso = d.toISOString().slice(0, 10);
    return { dateFrom: iso, dateTo: iso, explicit: true };
  }

  return null;
}

function wantsGroupComparison(message) {
  const text = String(message || "").toLowerCase();
  return (
    /(dono|both|compare|comparison|group\s*wise|company\s*wise|companies)/i.test(text) &&
    /(company|companies|entity|entities|group)/i.test(text)
  );
}

async function resolveScopeFromMessage(message, baseFilters = {}) {
  const raw = await getRawData();
  const scope = { ...baseFilters };

  const detectedCompany = detectCompanyFromMessage(message, raw);
  const detectedOu = detectOperatingUnitFromMessage(message, raw);
  const detectedDates = detectDateRangeFromMessage(message);

  if (detectedCompany && !scope.organization) {
    scope.organization = detectedCompany;
  }
  if (detectedOu && !scope.operatingUnit) {
    scope.operatingUnit = detectedOu;
  }
  // Message dates always win over dashboard filters when user stated a period.
  if (detectedDates?.explicit) {
    scope.dateFrom = detectedDates.dateFrom;
    scope.dateTo = detectedDates.dateTo;
  } else if (detectedDates) {
    if (!scope.dateFrom) scope.dateFrom = detectedDates.dateFrom;
    if (!scope.dateTo) scope.dateTo = detectedDates.dateTo;
  }

  if (scope.organization) {
    scope.organization = resolveOrganizationFilter(raw, scope.organization);
  }
  if (scope.operatingUnit) {
    scope.operatingUnit = resolveOperatingUnitFilter(raw, scope.operatingUnit);
  }

  return {
    raw,
    scope,
    catalog: buildCompanyCatalog(raw),
    groupComparison: wantsGroupComparison(message),
    today: karachiTodayIso(),
  };
}

async function withResolvedScope(filters) {
  const raw = await getRawData();
  const resolved = { ...filters };
  if (resolved.organization) {
    resolved.organization = resolveOrganizationFilter(raw, resolved.organization);
  }
  if (resolved.operatingUnit) {
    resolved.operatingUnit = resolveOperatingUnitFilter(raw, resolved.operatingUnit);
  }
  return {
    raw,
    rows: applyFilters(raw, resolved),
    resolvedFilters: resolved,
  };
}

module.exports = {
  karachiTodayIso,
  buildCompanyCatalog,
  detectCompanyFromMessage,
  detectDateRangeFromMessage,
  resolveScopeFromMessage,
  withResolvedScope,
};
