/**
 * Data service - fetches & caches procurement data from source API
 */
const DATA_URL = process.env.DATA_URL || "http://192.168.1.209:6070/callcenterreportdata";
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 5 * 60 * 1000);
/** Serve cached rows this long even after TTL while a background refresh runs. */
const STALE_MAX_MS = Number(process.env.CACHE_STALE_MAX_MS || 30 * 60 * 1000);

let cache = {
  data: null,
  fetchedAt: 0,
  loading: null,
  lastError: null,
  lastOkAt: 0,
};

async function fetchRawData() {
  const res = await fetch(DATA_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch source data: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : data?.data || [];
}

function startProcurementRefresh() {
  if (cache.loading) return cache.loading;

  const request = fetchRawData()
    .then((data) => {
      cache.data = data;
      cache.fetchedAt = Date.now();
      cache.lastOkAt = Date.now();
      cache.lastError = null;
      cache.loading = null;
      return data;
    })
    .catch((err) => {
      cache.loading = null;
      cache.lastError = err.message;
      if (cache.data) return cache.data;
      throw err;
    });

  cache.loading = request;
  return request;
}

/**
 * Stale-while-revalidate: return cached rows immediately when available,
 * refresh in background after TTL so page reloads stay fast.
 */
async function getRawData(force = false) {
  const now = Date.now();
  const age = cache.data ? now - cache.fetchedAt : Infinity;
  const fresh = cache.data && age < CACHE_TTL_MS;
  const usableStale = cache.data && age < STALE_MAX_MS;

  if (force) {
    return startProcurementRefresh();
  }

  if (fresh) {
    return cache.data;
  }

  if (usableStale) {
    startProcurementRefresh().catch(() => {});
    return cache.data;
  }

  if (cache.loading) return cache.loading;
  return startProcurementRefresh();
}

function procurementStatusSnapshot() {
  return {
    live: Boolean(cache.data?.length) && !cache.lastError,
    records: cache.data?.length ?? 0,
    fetchedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
    lastError: cache.lastError,
    refreshing: Boolean(cache.loading),
    stale: cache.data ? Date.now() - cache.fetchedAt >= CACHE_TTL_MS : true,
  };
}

/** Live badge must NOT download full datasets — that blocked the UI for ~30s+. */
async function getProcurementFeedStatus(force = false) {
  if (force) {
    try {
      await startProcurementRefresh();
    } catch {
      /* snapshot still returned below */
    }
  } else if (cache.data && Date.now() - cache.fetchedAt >= CACHE_TTL_MS) {
    startProcurementRefresh().catch(() => {});
  } else if (!cache.data && !cache.loading) {
    startProcurementRefresh().catch(() => {});
  }

  return procurementStatusSnapshot();
}

async function getDataFeedStatus(force = false) {
  const { getGrnFeedStatus } = require("./grnService");
  const [procurement, grn] = await Promise.all([
    getProcurementFeedStatus(force),
    getGrnFeedStatus(force),
  ]);

  return {
    live: procurement.live && grn.live,
    procurement,
    grn,
    checkedAt: new Date().toISOString(),
  };
}

/** Keep cache warm without blocking requests (call from server boot). */
function startProcurementBackgroundRefresh(intervalMs = Math.max(60_000, Math.floor(CACHE_TTL_MS * 0.8))) {
  const tick = () => {
    startProcurementRefresh().catch((err) => {
      console.warn("[procurement cache refresh]", err.message);
    });
  };
  const id = setInterval(tick, intervalMs);
  if (typeof id.unref === "function") id.unref();
  return id;
}

function isEmpty(v) {
  return v === null || v === undefined || v === "";
}

function hasFinalApprover(row) {
  return !isEmpty(row.APPROVER_FINAL);
}

/** One status per PO_NO — approved when APPROVER_FINAL is set on any line. */
function countPoByFinalApprover(rows) {
  const byPo = new Map();
  for (const r of rows) {
    if (isEmpty(r.PO_NO)) continue;
    const po = String(r.PO_NO);
    if (!byPo.has(po)) byPo.set(po, false);
    if (hasFinalApprover(r)) byPo.set(po, true);
  }

  let approved = 0;
  let pending = 0;
  for (const hasFinal of byPo.values()) {
    if (hasFinal) approved += 1;
    else pending += 1;
  }
  return { approved, pending };
}

function poApproveFlag(row) {
  return String(row.PO_APPROVE || "").trim().toUpperCase();
}

/** Approved PO line — uses API column PO_APPROVE only (not PO_AUTHORIZATION_STATUS). */
function isApproved(row) {
  return poApproveFlag(row) === "APPROVE";
}

function isRejected(row) {
  return poApproveFlag(row) === "REJECT";
}

/** Pending PO line — PO_APPROVE is neither APPROVE nor REJECT. */
function isPending(row) {
  const flag = poApproveFlag(row);
  return flag !== "APPROVE" && flag !== "REJECT";
}

function compName(r) {
  return String(r.COMP_NAME || "").trim();
}

function operatingUnitName(r) {
  return String(r.OPERATING_UNIT_NAME || "").trim();
}

/** Most frequent non-empty COMP_NAME in the row set (single legal entity fallback). */
function primaryCompName(rows) {
  const counts = new Map();
  for (const r of rows) {
    const c = compName(r);
    if (c) counts.set(c, (counts.get(c) || 0) + 1);
  }
  if (!counts.size) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function resolveLegalEntityName(r, primary) {
  const comp = compName(r);
  if (comp) return comp;
  if (primary) return primary;
  return "Unspecified";
}

/** Display name for DEPARTMENT — API uses "Manual PO" for direct POs without a PR. */
function resolveDepartmentName(dept) {
  const d = String(dept ?? "").trim();
  if (!d) return "Unknown";
  if (d.toLowerCase() === "manual po") return "PO without PR";
  return d;
}

function uniqueDepartmentCount(rows) {
  const set = new Set();
  for (const r of rows) {
    if (!isEmpty(r.DEPARTMENT)) set.add(resolveDepartmentName(r.DEPARTMENT));
  }
  return set.size;
}

function uniqueDepartmentValues(rows) {
  const set = new Set();
  for (const r of rows) {
    if (!isEmpty(r.DEPARTMENT)) set.add(resolveDepartmentName(r.DEPARTMENT));
  }
  return [...set].sort();
}

function uniqueLegalEntityCount(rows) {
  const primary = primaryCompName(rows);
  const set = new Set();
  for (const r of rows) {
    set.add(resolveLegalEntityName(r, primary));
  }
  return set.size;
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d;
  const m = String(v).trim().match(/^(\d{1,2})-([A-Z]{3})-(\d{2,4})$/i);
  if (!m) return null;
  const months = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const mo = months[m[2].toUpperCase()];
  if (mo === undefined) return null;
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  return new Date(Date.UTC(y, mo, Number(m[1])));
}

/** Case-insensitive name match — handles "Procon" vs "PROCON ENGINEERING (PVT) LTD". */
function nameMatchesFilter(filterTokens, actual) {
  const actualLower = String(actual || "").trim().toLowerCase();
  if (!actualLower || !filterTokens.length) return false;
  return filterTokens.some((token) => {
    const tokenLower = String(token || "").trim().toLowerCase();
    if (!tokenLower) return false;
    return (
      actualLower === tokenLower ||
      actualLower.includes(tokenLower) ||
      tokenLower.includes(actualLower)
    );
  });
}

function splitFilterTokens(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Map user/LLM company text to canonical COMP_NAME when possible. */
function resolveOrganizationFilter(rows, organization) {
  if (!organization) return organization;
  const tokens = splitFilterTokens(organization);
  const primary = primaryCompName(rows);
  const known = new Set();
  for (const r of rows) {
    known.add(resolveLegalEntityName(r, primary));
  }
  const knownList = [...known];
  const resolved = tokens.map((tok) => {
    const exact = knownList.find((k) => k.toLowerCase() === tok.toLowerCase());
    if (exact) return exact;
    const partial = knownList.filter(
      (k) =>
        k.toLowerCase().includes(tok.toLowerCase()) ||
        tok.toLowerCase().includes(k.toLowerCase())
    );
    if (partial.length === 1) return partial[0];
    return tok;
  });
  return resolved.join(",");
}

function resolveOperatingUnitFilter(rows, operatingUnit) {
  if (!operatingUnit) return operatingUnit;
  const tokens = splitFilterTokens(operatingUnit);
  const known = new Set(rows.map((r) => operatingUnitName(r)).filter(Boolean));
  const knownList = [...known];
  const resolved = tokens.map((tok) => {
    const exact = knownList.find((k) => k.toLowerCase() === tok.toLowerCase());
    if (exact) return exact;
    const partial = knownList.filter(
      (k) =>
        k.toLowerCase().includes(tok.toLowerCase()) ||
        tok.toLowerCase().includes(k.toLowerCase())
    );
    if (partial.length === 1) return partial[0];
    return tok;
  });
  return resolved.join(",");
}

function applyFilters(data, query = {}) {
  let rows = data;

  const {
    organization,
    organizationName,
    operatingUnit,
    department,
    prCreator,
    poCreator,
    approver,
    approvalStatus,
    year,
    month,
    dateFrom,
    dateTo,
    search,
    vendorId,
    aging,
    reqNo,
    poNo,
  } = query;

  const primaryLegalEntity = primaryCompName(rows);

  if (organization) {
    const orgs = splitFilterTokens(organization);
    if (orgs.length) {
      rows = rows.filter((r) =>
        nameMatchesFilter(orgs, resolveLegalEntityName(r, primaryLegalEntity))
      );
    }
  }

  if (organizationName) {
    const names = splitFilterTokens(organizationName);
    if (names.length) {
      rows = rows.filter((r) =>
        nameMatchesFilter(names, String(r.ORGANIZATION_NAME || "").trim())
      );
    }
  }

  if (operatingUnit) {
    const units = splitFilterTokens(operatingUnit);
    if (units.length) {
      rows = rows.filter((r) => nameMatchesFilter(units, operatingUnitName(r)));
    }
  }

  if (department) {
    const deps = String(department).split(",").map((s) => s.trim()).filter(Boolean);
    if (deps.length) {
      rows = rows.filter((r) => deps.includes(resolveDepartmentName(r.DEPARTMENT)));
    }
  }

  if (prCreator) {
    const creators = String(prCreator).split(",").map((s) => s.trim()).filter(Boolean);
    if (creators.length) {
      rows = rows.filter((r) => creators.includes(r.REQ_CREADED_BY));
    }
  }

  if (poCreator) {
    const creators = String(poCreator).split(",").map((s) => s.trim()).filter(Boolean);
    if (creators.length) {
      rows = rows.filter((r) => creators.includes(r.PO_CREATED_BY));
    }
  }

  if (approver) {
    const approvers = String(approver).split(",").map((s) => s.trim()).filter(Boolean);
    if (approvers.length) {
      rows = rows.filter((r) => approvers.includes(resolveFinalApprover(r)));
    }
  }

  if (query.purchaseType) {
    const types = String(query.purchaseType)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (types.length) {
      rows = rows.filter((r) => {
        const t = String(r.PURCHASE_TYPE || "").trim() || "Unspecified";
        return types.includes(t);
      });
    }
  }

  if (approvalStatus) {
    const statuses = String(approvalStatus)
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (statuses.length) {
      const finalApprovedPos = new Set();
      for (const r of rows) {
        if (!isEmpty(r.PO_NO) && hasFinalApprover(r)) {
          finalApprovedPos.add(String(r.PO_NO));
        }
      }
      rows = rows.filter((r) => {
        return statuses.some((status) => {
          if (status === "APPROVED") {
            return !isEmpty(r.PO_NO) && finalApprovedPos.has(String(r.PO_NO));
          }
          if (status === "PENDING") {
            return !isEmpty(r.PO_NO) && !finalApprovedPos.has(String(r.PO_NO));
          }
          if (status === "REJECTED") {
            return (
              String(r.PO_APPROVE || "").toUpperCase() === "REJECT" ||
              String(r.PO_AUTHORIZATION_STATUS || "").toUpperCase() === "REJECTED"
            );
          }
          return false;
        });
      });
    }
  }

  if (year) {
    const years = String(year)
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));
    if (years.length) {
      rows = rows.filter((r) => {
        const d = parseDate(r.PO_CREATION_DATE) || parseDate(r.CREATION_DATE_PR);
        return d && years.includes(d.getFullYear());
      });
    }
  }

  if (month) {
    const months = String(month)
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 12);
    if (months.length) {
      rows = rows.filter((r) => {
        const d = parseDate(r.PO_CREATION_DATE) || parseDate(r.CREATION_DATE_PR);
        return d && months.includes(d.getMonth() + 1);
      });
    }
  }

  if (dateFrom) {
    const from = new Date(dateFrom);
    rows = rows.filter((r) => {
      const d = parseDate(r.PO_CREATION_DATE) || parseDate(r.CREATION_DATE_PR);
      return d && d >= from;
    });
  }

  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    rows = rows.filter((r) => {
      const d = parseDate(r.PO_CREATION_DATE) || parseDate(r.CREATION_DATE_PR);
      return d && d <= to;
    });
  }

  if (vendorId) {
    rows = rows.filter((r) => String(r.VENDOR_ID) === String(vendorId));
  }

  if (reqNo) {
    rows = rows.filter((r) => String(r.REQ_NO) === String(reqNo));
  }

  if (poNo) {
    rows = rows.filter((r) => String(r.PO_NO) === String(poNo));
  }

  if (query.itemCode) {
    const codes = String(query.itemCode)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (codes.length) {
      rows = rows.filter((r) => codes.includes(String(r.ITEM_CODE || "").trim()));
    }
  }

  if (aging) {
    const bucket = String(aging);
    rows = rows.filter((r) => {
      if (isEmpty(r.PO_NO) || isEmpty(r.REQ_NO) || isEmpty(r.CREATION_DATE_PR) || isEmpty(r.PO_CREATION_DATE))
        return false;
      const days = prToPoCalendarDays(r.CREATION_DATE_PR, r.PO_CREATION_DATE);
      if (days === null) return false;
      return agingBucket(days) === bucket;
    });
  }

  if (query.poRevised) {
    const buckets = String(query.poRevised)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (buckets.length) {
      rows = rows.filter((r) => {
        if (isEmpty(r.PO_NO)) return false;
        const n = Number(r.PO_REVISED_COUNT);
        const rev = Number.isFinite(n) ? n : 0;
        const b = revisionBucket(rev);
        return buckets.some((wanted) => {
          if (wanted === "revised" || wanted === "1+") return rev > 0;
          return wanted === b;
        });
      });
    }
  }

  if (query.poLinkage) {
    const links = String(query.poLinkage)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (links.length) {
      rows = rows.filter((r) => {
        if (isEmpty(r.PO_NO)) return false;
        const hasPr = !isEmpty(r.REQ_NO);
        return links.some((l) => {
          if (l === "withPr") return hasPr;
          if (l === "withoutPr") return !hasPr;
          return false;
        });
      });
    }
  }

  if (search) {
    const q = String(search).toLowerCase();
    rows = rows.filter((r) => {
      const hay = [
        r.REQ_NO,
        r.PO_NO,
        r.COMP_NAME,
        r.ORGANIZATION_NAME,
        r.OPERATING_UNIT_NAME,
        r.DEPARTMENT,
        resolveDepartmentName(r.DEPARTMENT),
        r.REQ_CREADED_BY,
        r.PO_CREATED_BY,
        r.APPROVER_NAME,
        r.ITEM_DESC,
        r.VENDOR_ID,
        r.VENDOR_NAME,
        r.PURCHASE_TYPE,
        r.PO_REVISED_COUNT,
        r.CONTROL_STATUS,
        r.CURRENCY_CODE,
        r.PO_EXCH_RATE,
        r.PO_EXCH_RATE_DATE,
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }

  return rows;
}

function uniqueCount(rows, key) {
  const set = new Set();
  for (const r of rows) {
    const v = r[key];
    if (!isEmpty(v)) set.add(String(v));
  }
  return set.size;
}

function resolveFinalApprover(r) {
  const final = String(r.APPROVER_FINAL || "").trim();
  if (final) return final;
  return String(r.APPROVER_NAME || "").trim();
}

function uniqueValues(rows, key) {
  const set = new Set();
  for (const r of rows) {
    const v = r[key];
    if (!isEmpty(v)) set.add(String(v));
  }
  return [...set].sort();
}

function groupUniqueCountByFinalApprover(rows, uniqueKey = "PO_NO") {
  const map = new Map();
  for (const r of rows) {
    const g = resolveFinalApprover(r);
    const u = r[uniqueKey];
    if (isEmpty(g) || isEmpty(u)) continue;
    if (!map.has(g)) map.set(g, new Set());
    map.get(g).add(String(u));
  }
  return [...map.entries()]
    .map(([name, set]) => ({ name, count: set.size }))
    .sort((a, b) => b.count - a.count);
}

function uniqueFinalApprovers(rows) {
  const set = new Set();
  for (const r of rows) {
    const v = resolveFinalApprover(r);
    if (v) set.add(v);
  }
  return [...set].sort();
}

function groupUniqueCount(rows, groupKey, uniqueKey) {
  const map = new Map();
  for (const r of rows) {
    const g = r[groupKey];
    const u = r[uniqueKey];
    if (isEmpty(g) || isEmpty(u)) continue;
    if (!map.has(g)) map.set(g, new Set());
    map.get(g).add(String(u));
  }
  return [...map.entries()]
    .map(([name, set]) => ({ name, count: set.size }))
    .sort((a, b) => b.count - a.count);
}

function sumUniquePoAmt(rows) {
  // Sum PO_AMT once per PO_NO to avoid line-item double counting where possible
  const seen = new Map();
  for (const r of rows) {
    const po = r.PO_NO;
    const amt = Number(r.PO_AMT) || 0;
    if (isEmpty(po)) {
      // still count amount if no PO
      continue;
    }
    if (!seen.has(String(po))) {
      seen.set(String(po), amt);
    } else {
      // accumulate line amounts for same PO
      seen.set(String(po), (seen.get(String(po)) || 0) + amt);
    }
  }
  // Also include rows without PO_NO (direct amounts)
  let extra = 0;
  for (const r of rows) {
    if (isEmpty(r.PO_NO)) extra += Number(r.PO_AMT) || 0;
  }
  let total = extra;
  for (const v of seen.values()) total += v;
  return total;
}

function normalizeCurrency(code) {
  const c = String(code ?? "").trim().toUpperCase();
  return c || "PKR";
}

/** PO line amount in PKR (native PKR or foreign × PO_EXCH_RATE). */
function poAmtInPkr(r) {
  const amt = Number(r.PO_AMT) || 0;
  if (!amt) return 0;
  const code = normalizeCurrency(r.CURRENCY_CODE);
  if (code === "PKR") return amt;
  const rate = Number(r.PO_EXCH_RATE);
  if (Number.isFinite(rate) && rate > 0) return amt * rate;
  return 0;
}

function sumAllPoAmt(rows) {
  return rows.reduce((acc, r) => acc + poAmtInPkr(r), 0);
}

function computeCurrencySpend(rows) {
  const byCurrency = {};
  let pkrNative = 0;
  let pkrLineCount = 0;
  let foreignInPkr = 0;
  let foreignLineCount = 0;
  let missingRateCount = 0;
  let missingRateAmount = 0;

  for (const r of rows) {
    const amt = Number(r.PO_AMT) || 0;
    if (!amt) continue;
    const code = normalizeCurrency(r.CURRENCY_CODE);
    if (!byCurrency[code]) {
      byCurrency[code] = { code, amount: 0, lineCount: 0, convertedPkr: 0 };
    }
    byCurrency[code].amount += amt;
    byCurrency[code].lineCount += 1;

    if (code === "PKR") {
      pkrNative += amt;
      pkrLineCount += 1;
    } else {
      foreignLineCount += 1;
      const rate = Number(r.PO_EXCH_RATE);
      if (Number.isFinite(rate) && rate > 0) {
        const converted = amt * rate;
        foreignInPkr += converted;
        byCurrency[code].convertedPkr += converted;
      } else {
        missingRateCount += 1;
        missingRateAmount += amt;
      }
    }
  }

  const foreignCurrencies = Object.values(byCurrency)
    .filter((c) => c.code !== "PKR")
    .sort((a, b) => b.amount - a.amount);

  return {
    pkrNative,
    pkrLineCount,
    foreignInPkr,
    foreignLineCount,
    combinedPkr: pkrNative + foreignInPkr,
    foreignCurrencies,
    primaryForeign: foreignCurrencies[0] || null,
    missingRateCount,
    missingRateAmount,
  };
}

function nonPoSpend(rows) {
  return rows.reduce((acc, r) => {
    const hasPo = !isEmpty(r.PO_NO);
    const noReq = isEmpty(r.REQ_NO);
    if (hasPo && noReq) return acc + poAmtInPkr(r);
    return acc;
  }, 0);
}

function agingBucket(days) {
  if (days === null || days < 0) return null;
  if (days <= 2) return "0-2 Days";
  if (days <= 5) return "3-5 Days";
  if (days <= 10) return "6-10 Days";
  return "10+ Days";
}

function revisionBucket(n) {
  const rev = Number(n);
  const v = Number.isFinite(rev) ? Math.max(0, Math.floor(rev)) : 0;
  if (v >= 4) return "4+";
  return String(v);
}

/** Calendar days from PR creation to PO creation (date-only, not 24-hour floor). */
function prToPoCalendarDays(prDate, poDate) {
  const pr = parseDate(prDate);
  const po = parseDate(poDate);
  if (!pr || !po) return null;
  const prUtc = Date.UTC(pr.getUTCFullYear(), pr.getUTCMonth(), pr.getUTCDate());
  const poUtc = Date.UTC(po.getUTCFullYear(), po.getUTCMonth(), po.getUTCDate());
  return Math.max(0, Math.floor((poUtc - prUtc) / (1000 * 60 * 60 * 24)));
}

/** Final approval date for a PO (when process is complete). */
function poFinalizedDate(entry) {
  return entry.finalApproveDate || entry.approveDate || null;
}

/** PO is fully done — has final/approve date and approval signal. */
function isPoFinalized(entry) {
  const end = poFinalizedDate(entry);
  if (!end) return false;
  const approved = String(entry.poApprove || "").toUpperCase() === "APPROVE";
  const authApproved = String(entry.poAuthStatus || "").toUpperCase() === "APPROVED";
  return approved || authApproved || !!entry.finalApproveDate;
}

/**
 * Scenario A — Manual/direct PO: PO_CREATION_DATE → APPROVER_FINAL_DATE (or APPROVER_DATE)
 * Scenario B — PR-linked PO: CREATION_DATE_PR (earliest) → APPROVER_FINAL_DATE (or APPROVER_DATE)
 * Only finalized POs are included in the average.
 */
function poCycleDays(entry) {
  if (!isPoFinalized(entry)) return null;
  const end = poFinalizedDate(entry);

  if (entry.hasReq) {
    if (!entry.prDate) return null;
    return prToPoCalendarDays(entry.prDate, end);
  }

  if (!entry.poCreated) return null;
  return prToPoCalendarDays(entry.poCreated, end);
}

function processingMetricLabel(prLinked, directPo) {
  if (prLinked > 0 && directPo > 0) return "Mixed: PR→Final & PO Create→Final";
  if (directPo > 0) return "PO Create → Final Approve (PO without PR)";
  if (prLinked > 0) return "PR Create → Final Approve (linked PO)";
  return null;
}

function computeAging(rows) {
  const buckets = {
    "0-2 Days": new Set(),
    "3-5 Days": new Set(),
    "6-10 Days": new Set(),
    "10+ Days": new Set(),
  };
  const seen = new Set();

  for (const r of rows) {
    if (isEmpty(r.PO_NO) || isEmpty(r.REQ_NO) || isEmpty(r.CREATION_DATE_PR) || isEmpty(r.PO_CREATION_DATE))
      continue;
    const key = String(r.PO_NO);
    if (seen.has(key)) continue;
    seen.add(key);

    const pr = parseDate(r.CREATION_DATE_PR);
    const po = parseDate(r.PO_CREATION_DATE);
    if (!pr || !po) continue;
    const days = prToPoCalendarDays(pr, po);
    if (days === null) continue;
    const bucket = agingBucket(days);
    if (bucket) buckets[bucket].add(key);
  }

  return Object.entries(buckets).map(([name, set]) => ({ name, count: set.size }));
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getKpis(rows) {
  const totalPR = uniqueCount(rows, "REQ_NO");
  const totalPO = uniqueCount(rows, "PO_NO");
  const { approved: approvedPO, pending: pendingPO } = countPoByFinalApprover(rows);
  const currencySpend = computeCurrencySpend(rows);
  const totalSpend = currencySpend.combinedPkr;
  const nonPo = nonPoSpend(rows);
  const departments = uniqueDepartmentCount(rows);
  const legalEntities = uniqueLegalEntityCount(rows);

  return {
    totalPurchaseRequisitions: totalPR,
    totalPurchaseOrders: totalPO,
    approvedPurchaseOrders: approvedPO,
    pendingPurchaseOrders: pendingPO,
    totalSpend,
    currencySpend,
    nonPoSpend: nonPo,
    totalDepartments: departments,
    totalLegalEntities: legalEntities,
    approvalRate: totalPO ? Math.round((approvedPO / totalPO) * 1000) / 10 : 0,
  };
}

function getFunnel(rows) {
  const prCreated = uniqueCount(rows, "REQ_NO");
  const poCreated = uniqueCount(rows, "PO_NO");
  const submitted = uniqueCount(
    rows.filter((r) => String(r.PO_SUBMIT || "").toUpperCase() === "SUBMIT"),
    "PO_NO"
  );
  const approved = uniqueCount(rows.filter(isApproved), "PO_NO");
  const closed = uniqueCount(
    rows.filter((r) => String(r.CONTROL_STATUS || "").toUpperCase() === "CLOSED"),
    "PO_NO"
  );

  return [
    { stage: "Purchase Requisitions (PR)", count: prCreated },
    { stage: "Purchase Orders Created (PO)", count: poCreated },
    { stage: "POs Submitted", count: submitted },
    { stage: "POs Approved", count: approved },
    { stage: "POs Closed", count: closed },
  ];
}

function getMonthly(rows) {
  const map = new Map();

  for (const r of rows) {
    const prDate = parseDate(r.CREATION_DATE_PR);
    const poDate = parseDate(r.PO_CREATION_DATE);

    if (prDate && !isEmpty(r.REQ_NO)) {
      const k = monthKey(prDate);
      if (!map.has(k)) map.set(k, { month: k, prs: new Set(), pos: new Set(), spend: 0 });
      map.get(k).prs.add(String(r.REQ_NO));
    }

    if (poDate && !isEmpty(r.PO_NO)) {
      const k = monthKey(poDate);
      if (!map.has(k)) map.set(k, { month: k, prs: new Set(), pos: new Set(), spend: 0 });
      map.get(k).pos.add(String(r.PO_NO));
      map.get(k).spend += Number(r.PO_AMT) || 0;
    } else if (poDate) {
      const k = monthKey(poDate);
      if (!map.has(k)) map.set(k, { month: k, prs: new Set(), pos: new Set(), spend: 0 });
      map.get(k).spend += Number(r.PO_AMT) || 0;
    }
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => ({
      month: v.month,
      purchaseRequisitions: v.prs.size,
      purchaseOrders: v.pos.size,
      spend: v.spend,
    }));
}

function getDepartmentSpend(rows) {
  const map = new Map();
  for (const r of rows) {
    const dept = resolveDepartmentName(r.DEPARTMENT);
    if (!map.has(dept)) {
      map.set(dept, { department: dept, spend: 0, approvedSpend: 0, pendingSpend: 0, prs: new Set(), pos: new Set() });
    }
    const entry = map.get(dept);
    const amt = Number(r.PO_AMT) || 0;
    entry.spend += amt;
    if (isApproved(r)) entry.approvedSpend += amt;
    else entry.pendingSpend += amt;
    if (!isEmpty(r.REQ_NO)) entry.prs.add(String(r.REQ_NO));
    if (!isEmpty(r.PO_NO)) entry.pos.add(String(r.PO_NO));
  }

  return [...map.values()]
    .map((d) => ({
      department: d.department,
      spend: d.spend,
      approvedSpend: d.approvedSpend,
      pendingSpend: d.pendingSpend,
      prCount: d.prs.size,
      poCount: d.pos.size,
    }))
    .sort((a, b) => b.spend - a.spend);
}

function getDepartmentPerformance(rows) {
  const map = new Map();
  const poByDept = new Map();

  for (const r of rows) {
    const dept = resolveDepartmentName(r.DEPARTMENT);
    if (!map.has(dept)) {
      map.set(dept, {
        department: dept,
        prs: new Set(),
        pos: new Set(),
        approved: new Set(),
        spend: 0,
      });
      poByDept.set(dept, new Map());
    }
    const e = map.get(dept);
    const deptPos = poByDept.get(dept);
    if (!isEmpty(r.REQ_NO)) e.prs.add(String(r.REQ_NO));
    if (!isEmpty(r.PO_NO)) e.pos.add(String(r.PO_NO));
    if (isApproved(r) && !isEmpty(r.PO_NO)) e.approved.add(String(r.PO_NO));
    e.spend += Number(r.PO_AMT) || 0;

    if (!isEmpty(r.PO_NO)) {
      const poKey = String(r.PO_NO);
      if (!deptPos.has(poKey)) {
        deptPos.set(poKey, {
          hasReq: false,
          prDate: null,
          poCreated: null,
          approveDate: null,
          finalApproveDate: null,
          poApprove: null,
          poAuthStatus: null,
        });
      }
      const pe = deptPos.get(poKey);
      if (!isEmpty(r.REQ_NO)) pe.hasReq = true;
      if (r.CREATION_DATE_PR) {
        const pr = parseDate(r.CREATION_DATE_PR);
        const existing = pe.prDate ? parseDate(pe.prDate) : null;
        if (pr && (!existing || pr < existing)) pe.prDate = r.CREATION_DATE_PR;
      }
      if (r.PO_CREATION_DATE) pe.poCreated = r.PO_CREATION_DATE;
      if (r.APPROVER_DATE) pe.approveDate = r.APPROVER_DATE;
      if (r.APPROVER_FINAL_DATE) pe.finalApproveDate = r.APPROVER_FINAL_DATE;
      if (r.PO_APPROVE) pe.poApprove = r.PO_APPROVE;
      if (r.PO_AUTHORIZATION_STATUS) pe.poAuthStatus = r.PO_AUTHORIZATION_STATUS;
    }
  }

  return [...map.values()]
    .map((e) => {
      const deptPos = poByDept.get(e.department) || new Map();
      const processingDays = [];
      let prLinked = 0;
      let directPo = 0;

      for (const pe of deptPos.values()) {
        if (!pe.hasReq && !pe.poCreated) continue;
        const days = poCycleDays(pe);
        if (days === null) continue;
        processingDays.push(days);
        if (pe.hasReq) prLinked += 1;
        else directPo += 1;
      }

      const poCount = e.pos.size;
      const avgProcessing =
        processingDays.length > 0
          ? Math.round((processingDays.reduce((a, b) => a + b, 0) / processingDays.length) * 10) / 10
          : null;
      return {
        department: e.department,
        totalPR: e.prs.size,
        totalPO: poCount,
        spend: e.spend,
        approvalRate: poCount ? Math.round((e.approved.size / poCount) * 1000) / 10 : 0,
        avgProcessingTime: avgProcessing,
        processingMetric: processingMetricLabel(prLinked, directPo),
        processingPoCount: processingDays.length,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

function getLegalEntities(rows) {
  const primary = primaryCompName(rows);
  const map = new Map();
  for (const r of rows) {
    const org = resolveLegalEntityName(r, primary);
    if (!map.has(org)) {
      map.set(org, { name: org, spend: 0, prs: new Set(), pos: new Set() });
    }
    const e = map.get(org);
    e.spend += poAmtInPkr(r);
    if (!isEmpty(r.REQ_NO)) e.prs.add(String(r.REQ_NO));
    if (!isEmpty(r.PO_NO)) e.pos.add(String(r.PO_NO));
  }
  return [...map.values()]
    .map((e) => ({
      name: e.name,
      spend: e.spend,
      prCount: e.prs.size,
      poCount: e.pos.size,
    }))
    .sort((a, b) => b.spend - a.spend);
}

function getOperatingUnitSpend(rows) {
  const map = new Map();
  for (const r of rows) {
    const name = operatingUnitName(r) || "Unspecified";
    if (!map.has(name)) {
      map.set(name, { name, spend: 0, prs: new Set(), pos: new Set() });
    }
    const e = map.get(name);
    e.spend += poAmtInPkr(r);
    if (!isEmpty(r.REQ_NO)) e.prs.add(String(r.REQ_NO));
    if (!isEmpty(r.PO_NO)) e.pos.add(String(r.PO_NO));
  }
  return [...map.values()]
    .map((e) => ({
      name: e.name,
      spend: e.spend,
      prCount: e.prs.size,
      poCount: e.pos.size,
    }))
    .sort((a, b) => b.spend - a.spend);
}

function getPurchaseTypes(rows) {
  const map = new Map();
  for (const r of rows) {
    const name = String(r.PURCHASE_TYPE || "").trim() || "Unspecified";
    if (!map.has(name)) {
      map.set(name, { name, spend: 0, prs: new Set(), pos: new Set() });
    }
    const e = map.get(name);
    e.spend += Number(r.PO_AMT) || 0;
    if (!isEmpty(r.REQ_NO)) e.prs.add(String(r.REQ_NO));
    if (!isEmpty(r.PO_NO)) e.pos.add(String(r.PO_NO));
  }
  return [...map.values()]
    .map((e) => ({
      name: e.name,
      spend: e.spend,
      prCount: e.prs.size,
      poCount: e.pos.size,
    }))
    .sort((a, b) => b.spend - a.spend || b.poCount - a.poCount);
}

function getPoRevisions(rows) {
  const byPo = new Map();
  for (const r of rows) {
    if (isEmpty(r.PO_NO)) continue;
    const id = String(r.PO_NO);
    const revRaw = Number(r.PO_REVISED_COUNT);
    const rev = Number.isFinite(revRaw) ? Math.max(0, Math.floor(revRaw)) : 0;
    const hasPr = !isEmpty(r.REQ_NO);
    if (!byPo.has(id)) {
      byPo.set(id, {
        poNo: id,
        revisedCount: rev,
        hasPr,
        spend: 0,
        vendorName: String(r.VENDOR_NAME || "").trim(),
      });
    }
    const e = byPo.get(id);
    e.revisedCount = Math.max(e.revisedCount, rev);
    if (hasPr) e.hasPr = true;
    e.spend += Number(r.PO_AMT) || 0;
    if (!e.vendorName && r.VENDOR_NAME) e.vendorName = String(r.VENDOR_NAME).trim();
  }

  const order = ["0", "1", "2", "3", "4+"];
  const bucketMap = Object.fromEntries(
    order.map((name) => [name, { name, withPr: 0, withoutPr: 0, total: 0 }])
  );

  let revisedPOs = 0;
  let totalRevisionEvents = 0;
  let withPrTotal = 0;
  let withPrRevised = 0;
  let withoutPrTotal = 0;
  let withoutPrRevised = 0;

  for (const e of byPo.values()) {
    const b = revisionBucket(e.revisedCount);
    if (e.hasPr) {
      bucketMap[b].withPr += 1;
      withPrTotal += 1;
      if (e.revisedCount > 0) withPrRevised += 1;
    } else {
      bucketMap[b].withoutPr += 1;
      withoutPrTotal += 1;
      if (e.revisedCount > 0) withoutPrRevised += 1;
    }
    bucketMap[b].total += 1;
    totalRevisionEvents += e.revisedCount;
    if (e.revisedCount > 0) revisedPOs += 1;
  }

  const topRevised = [...byPo.values()]
    .filter((e) => e.revisedCount > 0)
    .sort((a, b) => b.revisedCount - a.revisedCount || b.spend - a.spend)
    .slice(0, 10)
    .map((e) => ({
      poNo: e.poNo,
      revisedCount: e.revisedCount,
      hasPr: e.hasPr,
      linkage: e.hasPr ? "With PR" : "Without PR",
      spend: e.spend,
      vendorName: e.vendorName || "—",
    }));

  return {
    summary: {
      totalPOs: byPo.size,
      revisedPOs,
      neverRevised: byPo.size - revisedPOs,
      totalRevisionEvents,
      withPr: {
        total: withPrTotal,
        revised: withPrRevised,
        neverRevised: withPrTotal - withPrRevised,
      },
      withoutPr: {
        total: withoutPrTotal,
        revised: withoutPrRevised,
        neverRevised: withoutPrTotal - withoutPrRevised,
      },
    },
    buckets: order.map((name) => bucketMap[name]),
    topRevised,
  };
}

function getVendors(rows, limit = 10) {
  const map = new Map();
  for (const r of rows) {
    if (isEmpty(r.VENDOR_ID)) continue;
    const id = String(r.VENDOR_ID);
    const name = String(r.VENDOR_NAME || "").trim() || id;
    if (!map.has(id)) map.set(id, { vendorId: id, vendorName: name, spend: 0, poCount: new Set() });
    const e = map.get(id);
    // Prefer a real name if later rows have it
    if ((!e.vendorName || e.vendorName === id) && name && name !== id) e.vendorName = name;
    e.spend += Number(r.PO_AMT) || 0;
    if (!isEmpty(r.PO_NO)) e.poCount.add(String(r.PO_NO));
  }
  return [...map.values()]
    .map((e) => ({
      vendorId: e.vendorId,
      vendorName: e.vendorName || e.vendorId,
      spend: e.spend,
      poCount: e.poCount.size,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, Number(limit) || 10);
}

function getApprovalStatus(rows) {
  const approved = uniqueCount(rows.filter(isApproved), "PO_NO");
  const rejected = uniqueCount(
    rows.filter(
      (r) =>
        String(r.PO_APPROVE || "").toUpperCase() === "REJECT" ||
        String(r.PO_AUTHORIZATION_STATUS || "").toUpperCase() === "REJECTED"
    ),
    "PO_NO"
  );
  const pending = uniqueCount(
    rows.filter((r) => !isApproved(r) && !(
      String(r.PO_APPROVE || "").toUpperCase() === "REJECT" ||
      String(r.PO_AUTHORIZATION_STATUS || "").toUpperCase() === "REJECTED"
    )),
    "PO_NO"
  );

  return [
    { name: "Approved", value: approved, color: "#37b767" },
    { name: "Pending", value: pending, color: "#d4a017" },
    { name: "Rejected", value: rejected, color: "#f05454" },
  ];
}

function getInsights(rows) {
  const prCreators = groupUniqueCount(rows, "REQ_CREADED_BY", "REQ_NO");
  const poCreators = groupUniqueCount(rows, "PO_CREATED_BY", "PO_NO");
  const depts = getDepartmentSpend(rows);
  const orgs = getLegalEntities(rows);
  const kpis = getKpis(rows);
  const aging = computeAging(rows);
  const slowBucket = aging.find((a) => a.name === "10+ Days");

  const topUsers = new Map();
  for (const p of prCreators.slice(0, 10)) {
    topUsers.set(p.name, { name: p.name, prs: p.count, pos: 0 });
  }
  for (const p of poCreators.slice(0, 10)) {
    if (!topUsers.has(p.name)) topUsers.set(p.name, { name: p.name, prs: 0, pos: p.count });
    else topUsers.get(p.name).pos = p.count;
  }

  return {
    highestPRCreator: prCreators[0] || null,
    highestPOCreator: poCreators[0] || null,
    highestProcurementDepartment: depts[0]
      ? { name: depts[0].department, prCount: depts[0].prCount, poCount: depts[0].poCount }
      : null,
    highestSpendDepartment: depts[0]
      ? { name: depts[0].department, spend: depts[0].spend }
      : null,
    maxProcurementOrganization: orgs[0] || null,
    pendingApprovalSummary: {
      pendingPOs: kpis.pendingPurchaseOrders,
      approvedPOs: kpis.approvedPurchaseOrders,
      approvalRate: kpis.approvalRate,
    },
    bottlenecks: {
      aging10PlusDays: slowBucket?.count || 0,
      pendingApprovals: kpis.pendingPurchaseOrders,
      message:
        (slowBucket?.count || 0) > 0
          ? `${slowBucket.count} POs took more than 10 days from PR to PO creation`
          : "No major aging bottlenecks detected",
    },
    approvalDelayInsights: {
      avgPendingShare: kpis.totalPurchaseOrders
        ? Math.round((kpis.pendingPurchaseOrders / kpis.totalPurchaseOrders) * 1000) / 10
        : 0,
      recommendation:
        kpis.pendingPurchaseOrders > kpis.approvedPurchaseOrders * 0.2
          ? "Pending approvals are elevated — review approver workload and escalation paths."
          : "Approval pipeline is healthy relative to approved volume.",
    },
    topProcurementUsers: [...topUsers.values()]
      .sort((a, b) => b.prs + b.pos - (a.prs + a.pos))
      .slice(0, 10),
  };
}

function getFilterOptions(rows) {
  const years = new Set();
  for (const r of rows) {
    const d = parseDate(r.PO_CREATION_DATE) || parseDate(r.CREATION_DATE_PR);
    if (d) years.add(d.getFullYear());
  }

  return {
    organizations: uniqueValues(rows, "COMP_NAME"),
    organizationNames: uniqueValues(rows, "ORGANIZATION_NAME"),
    operatingUnits: uniqueValues(rows, "OPERATING_UNIT_NAME"),
    departments: uniqueDepartmentValues(rows),
    prCreators: uniqueValues(rows, "REQ_CREADED_BY"),
    poCreators: uniqueValues(rows, "PO_CREATED_BY"),
    approvers: uniqueFinalApprovers(rows),
    years: [...years].sort((a, b) => b - a),
    months: [
      { value: 1, label: "January" },
      { value: 2, label: "February" },
      { value: 3, label: "March" },
      { value: 4, label: "April" },
      { value: 5, label: "May" },
      { value: 6, label: "June" },
      { value: 7, label: "July" },
      { value: 8, label: "August" },
      { value: 9, label: "September" },
      { value: 10, label: "October" },
      { value: 11, label: "November" },
      { value: 12, label: "December" },
    ],
    approvalStatuses: ["APPROVED", "PENDING", "REJECTED"],
    purchaseTypes: uniqueValues(rows, "PURCHASE_TYPE").concat(
      rows.some((r) => !String(r.PURCHASE_TYPE || "").trim()) ? ["Unspecified"] : []
    ).filter((v, i, a) => a.indexOf(v) === i),
  };
}

function paginateTable(rows, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(200, Math.max(10, Number(query.pageSize) || 25));
  const sortBy = query.sortBy || "PO_CREATION_DATE";
  const sortDir = (query.sortDir || "desc").toLowerCase() === "asc" ? 1 : -1;

  const sorted = [...rows].sort((a, b) => {
    let av = a[sortBy];
    let bv = b[sortBy];
    if (sortBy.includes("DATE") || sortBy.includes("CREATION")) {
      av = parseDate(av)?.getTime() ?? 0;
      bv = parseDate(bv)?.getTime() ?? 0;
    } else if (typeof av === "number" || typeof bv === "number") {
      av = Number(av) || 0;
      bv = Number(bv) || 0;
    } else {
      av = String(av ?? "").toLowerCase();
      bv = String(bv ?? "").toLowerCase();
    }
    if (av < bv) return -1 * sortDir;
    if (av > bv) return 1 * sortDir;
    return 0;
  });

  const total = sorted.length;
  const start = (page - 1) * pageSize;
  const data = sorted.slice(start, start + pageSize).map((r) => ({
    ORGANIZATION_NAME: r.ORGANIZATION_NAME,
    COMP_NAME: r.COMP_NAME,
    DEPARTMENT: resolveDepartmentName(r.DEPARTMENT),
    REQ_NO: r.REQ_NO,
    REQ_CREADED_BY: r.REQ_CREADED_BY,
    CREATION_DATE_PR: r.CREATION_DATE_PR,
    PO_NO: r.PO_NO,
    PO_CREATED_BY: r.PO_CREATED_BY,
    PO_CREATION_DATE: r.PO_CREATION_DATE,
    PO_APPROVE: r.PO_APPROVE,
    APPROVER_NAME: r.APPROVER_NAME,
    PO_AMT: r.PO_AMT,
    CURRENCY_CODE: r.CURRENCY_CODE,
    PO_EXCH_RATE: r.PO_EXCH_RATE,
    PO_EXCH_RATE_DATE: r.PO_EXCH_RATE_DATE,
    ITEM_DESC: r.ITEM_DESC,
    ITEM_CODE: r.ITEM_CODE,
    VENDOR_ID: r.VENDOR_ID,
    VENDOR_NAME: r.VENDOR_NAME,
    PURCHASE_TYPE: r.PURCHASE_TYPE,
    PO_REVISED_COUNT: r.PO_REVISED_COUNT,
    CONTROL_STATUS: r.CONTROL_STATUS,
    PR_AUTHORIZATION_STATUS: r.PR_AUTHORIZATION_STATUS,
    PO_AUTHORIZATION_STATUS: r.PO_AUTHORIZATION_STATUS,
  }));

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

module.exports = {
  getRawData,
  getProcurementFeedStatus,
  getDataFeedStatus,
  startProcurementBackgroundRefresh,
  applyFilters,
  resolveOrganizationFilter,
  resolveOperatingUnitFilter,
  getKpis,
  getFunnel,
  groupUniqueCount,
  groupUniqueCountByFinalApprover,
  resolveFinalApprover,
  uniqueFinalApprovers,
  getMonthly,
  getDepartmentSpend,
  getDepartmentPerformance,
  getLegalEntities,
  getOperatingUnitSpend,
  getVendors,
  getPurchaseTypes,
  getPoRevisions,
  getApprovalStatus,
  computeAging,
  getInsights,
  getFilterOptions,
  paginateTable,
  isApproved,
  isPending,
  hasFinalApprover,
  primaryCompName,
  resolveLegalEntityName,
  resolveDepartmentName,
  operatingUnitName,
};
