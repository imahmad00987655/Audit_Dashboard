/**
 * GRN / PO→Receipt data from po2grn API — joined with PR/PO filters via PO_NO
 */
const PO2GRN_URL = process.env.PO2GRN_URL || "http://localhost:6070/callcenterreportdata/po2grn";
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 5 * 60 * 1000);
const STALE_MAX_MS = Number(process.env.CACHE_STALE_MAX_MS || 30 * 60 * 1000);

let grnCache = { data: null, fetchedAt: 0, loading: null, lastError: null, lastOkAt: 0 };

function isEmpty(v) {
  return v === null || v === undefined || v === "";
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

async function fetchPo2GrnRaw() {
  const res = await fetch(PO2GRN_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch po2grn data: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : data?.data || [];
}

function startGrnRefresh() {
  if (grnCache.loading) return grnCache.loading;

  const request = fetchPo2GrnRaw()
    .then((data) => {
      grnCache.data = data;
      grnCache.fetchedAt = Date.now();
      grnCache.lastOkAt = Date.now();
      grnCache.lastError = null;
      grnCache.loading = null;
      return data;
    })
    .catch((err) => {
      grnCache.loading = null;
      grnCache.lastError = err.message;
      if (grnCache.data) return grnCache.data;
      throw err;
    });

  grnCache.loading = request;
  return request;
}

/**
 * Stale-while-revalidate: GRN upstream is often 30s+ — never block page loads on it
 * once we have any cached snapshot.
 */
async function getPo2GrnData(force = false) {
  const now = Date.now();
  const age = grnCache.data ? now - grnCache.fetchedAt : Infinity;
  const fresh = grnCache.data && age < CACHE_TTL_MS;
  const usableStale = grnCache.data && age < STALE_MAX_MS;

  if (force) {
    return startGrnRefresh();
  }

  if (fresh) {
    return grnCache.data;
  }

  if (usableStale) {
    startGrnRefresh().catch(() => {});
    return grnCache.data;
  }

  if (grnCache.loading) return grnCache.loading;
  return startGrnRefresh();
}

function grnStatusSnapshot() {
  return {
    live: Boolean(grnCache.data?.length) && !grnCache.lastError,
    records: grnCache.data?.length ?? 0,
    fetchedAt: grnCache.fetchedAt ? new Date(grnCache.fetchedAt).toISOString() : null,
    lastError: grnCache.lastError,
    refreshing: Boolean(grnCache.loading),
    stale: grnCache.data ? Date.now() - grnCache.fetchedAt >= CACHE_TTL_MS : true,
  };
}

/** Instant status for Live badge — never awaits full po2grn download. */
async function getGrnFeedStatus(force = false) {
  if (force) {
    try {
      await startGrnRefresh();
    } catch {
      /* snapshot below */
    }
  } else if (grnCache.data && Date.now() - grnCache.fetchedAt >= CACHE_TTL_MS) {
    startGrnRefresh().catch(() => {});
  } else if (!grnCache.data && !grnCache.loading) {
    startGrnRefresh().catch(() => {});
  }

  return grnStatusSnapshot();
}

function startGrnBackgroundRefresh(intervalMs = Math.max(60_000, Math.floor(CACHE_TTL_MS * 0.8))) {
  const tick = () => {
    startGrnRefresh().catch((err) => {
      console.warn("[grn cache refresh]", err.message);
    });
  };
  const id = setInterval(tick, intervalMs);
  if (typeof id.unref === "function") id.unref();
  return id;
}

function poScopeFromPrPo(query) {
  return !!(
    query.organization ||
    query.organizationName ||
    query.operatingUnit ||
    query.department ||
    query.prCreator ||
    query.poCreator ||
    query.approver ||
    query.purchaseType ||
    query.approvalStatus ||
    query.poRevised ||
    query.poLinkage ||
    query.aging ||
    query.reqNo
  );
}

function poNoSetFromRows(prPoRows) {
  const set = new Set();
  for (const r of prPoRows) {
    if (!isEmpty(r.PO_NO)) set.add(String(r.PO_NO));
  }
  return set;
}

function grnPoDate(r) {
  return parseDate(r.PO_DATE) || parseDate(r.GRN_DATE) || parseDate(r.CREATION_DATE_RECEIPT);
}

function hasGrnReceipt(r) {
  return !isEmpty(r.RECEIPT_NUM) || !isEmpty(r.GRN_DATE) || Number(r.GRN_QTY) > 0;
}

function poToGrnCalendarDays(poDate, grnDate) {
  const po = parseDate(poDate);
  const grn = parseDate(grnDate);
  if (!po || !grn) return null;
  const poUtc = Date.UTC(po.getUTCFullYear(), po.getUTCMonth(), po.getUTCDate());
  const grnUtc = Date.UTC(grn.getUTCFullYear(), grn.getUTCMonth(), grn.getUTCDate());
  return Math.max(0, Math.floor((grnUtc - poUtc) / (1000 * 60 * 60 * 24)));
}

function poToGrnAgingBucket(days) {
  if (days === null || days < 0) return null;
  if (days <= 7) return "0-7 Days";
  if (days <= 14) return "8-14 Days";
  if (days <= 30) return "15-30 Days";
  return "30+ Days";
}

function applyGrnFilters(grnRows, query = {}, prPoRows = null) {
  let rows = grnRows;

  if (prPoRows && poScopeFromPrPo(query)) {
    const poSet = poNoSetFromRows(prPoRows);
    rows = rows.filter((r) => poSet.has(String(r.PO_NO)));
  }

  if (query.poNo) {
    rows = rows.filter((r) => String(r.PO_NO) === String(query.poNo));
  }

  if (query.vendorId) {
    rows = rows.filter((r) => String(r.VENDOR_ID) === String(query.vendorId));
  }

  if (query.receivingOrg) {
    const orgs = String(query.receivingOrg).split(",").map((s) => s.trim()).filter(Boolean);
    if (orgs.length) {
      rows = rows.filter((r) => orgs.includes(String(r.ORG_RECEIVING_RSL || "").trim()));
    }
  }

  if (query.receiptNum) {
    rows = rows.filter((r) => String(r.RECEIPT_NUM) === String(query.receiptNum));
  }

  if (query.grnUser) {
    const users = String(query.grnUser).split(",").map((s) => s.trim()).filter(Boolean);
    if (users.length) {
      rows = rows.filter((r) => users.includes(String(r.USER_NAME || "").trim()));
    }
  }

  if (query.grnLinkage) {
    const links = String(query.grnLinkage).split(",").map((s) => s.trim()).filter(Boolean);
    if (links.length) {
      const allGrnPos = new Set(grnRows.filter(hasGrnReceipt).map((r) => String(r.PO_NO)));
      rows = rows.filter((r) => {
        const po = String(r.PO_NO);
        const received = hasGrnReceipt(r) || allGrnPos.has(po);
        return links.some((l) => {
          if (l === "withGrn") return received;
          if (l === "withoutGrn") return !received;
          return false;
        });
      });
    }
  }

  if (query.poToGrnAging) {
    const bucket = String(query.poToGrnAging);
    rows = rows.filter((r) => {
      const days = poToGrnCalendarDays(r.PO_DATE, r.GRN_DATE || r.CREATION_DATE_RECEIPT);
      if (days === null) return false;
      return poToGrnAgingBucket(days) === bucket;
    });
  }

  if (query.backdated === "yes" || query.backdated === "true") {
    rows = rows.filter((r) => Number(r.BACKDATED_DAYS) > 0);
  }

  if (query.grnReturnStatus) {
    const statuses = String(query.grnReturnStatus)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length) {
      rows = rows.filter((r) => statuses.includes(classifyGrnLine(r)));
    }
  }

  if (query.year) {
    const years = String(query.year)
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));
    if (years.length) {
      rows = rows.filter((r) => {
        const d = grnPoDate(r);
        return d && years.includes(d.getFullYear());
      });
    }
  }

  if (query.month) {
    const months = String(query.month)
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 12);
    if (months.length) {
      rows = rows.filter((r) => {
        const d = grnPoDate(r);
        return d && months.includes(d.getMonth() + 1);
      });
    }
  }

  if (query.dateFrom) {
    const from = new Date(query.dateFrom);
    rows = rows.filter((r) => {
      const d = grnPoDate(r);
      return d && d >= from;
    });
  }

  if (query.dateTo) {
    const to = new Date(query.dateTo);
    to.setHours(23, 59, 59, 999);
    rows = rows.filter((r) => {
      const d = grnPoDate(r);
      return d && d <= to;
    });
  }

  if (query.search) {
    const q = String(query.search).toLowerCase();
    rows = rows.filter((r) => {
      const hay = [
        r.PO_NO,
        r.RECEIPT_NUM,
        r.VENDOR_NAME,
        r.VENDOR_ID,
        r.ITEM_CODE,
        r.ITEM_DESC,
        r.ORG_RECEIVING_RSL,
        r.USER_NAME,
        r.SUBMIT_NAME,
        r.APPROVER_NAME,
        r.CURRENCY_CODE,
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

function uniqueValues(rows, key) {
  const set = new Set();
  for (const r of rows) {
    const v = r[key];
    if (!isEmpty(v)) set.add(String(v));
  }
  return [...set].sort();
}

function getGrnKpis(grnRows, prPoRows = []) {
  const receipts = uniqueCount(grnRows.filter(hasGrnReceipt), "RECEIPT_NUM");
  const posWithGrn = uniqueCount(grnRows.filter(hasGrnReceipt), "PO_NO");
  const approvedPos = new Set();
  for (const r of prPoRows) {
    if (!isEmpty(r.PO_NO) && String(r.PO_APPROVE || "").toUpperCase() === "APPROVE") {
      approvedPos.add(String(r.PO_NO));
    }
  }
  const allGrnPos = new Set(grnRows.filter(hasGrnReceipt).map((r) => String(r.PO_NO)));
  let posWithoutGrn = 0;
  for (const po of approvedPos) {
    if (!allGrnPos.has(po)) posWithoutGrn += 1;
  }

  let amountReceived = 0;
  let poQty = 0;
  let grnQty = 0;
  const poSeen = new Set();
  const agingDays = [];
  let backdatedCount = 0;

  for (const r of grnRows) {
    amountReceived += Number(r.AMOUNT_RECEIVED) || 0;
    poQty += Number(r.PO_QTY) || 0;
    grnQty += Number(r.GRN_QTY) || Number(r.RECEIVE_QTY) || 0;
    if (Number(r.BACKDATED_DAYS) > 0) backdatedCount += 1;

    const poKey = String(r.PO_NO);
    if (!poSeen.has(poKey)) {
      poSeen.add(poKey);
      const days = poToGrnCalendarDays(r.PO_DATE, r.GRN_DATE || r.CREATION_DATE_RECEIPT);
      if (days !== null) agingDays.push(days);
    }
  }

  const avgPoToGrnDays =
    agingDays.length > 0
      ? Math.round((agingDays.reduce((a, b) => a + b, 0) / agingDays.length) * 10) / 10
      : null;

  const fulfillmentRate =
    poQty > 0 ? Math.round((Math.min(grnQty, poQty) / poQty) * 1000) / 10 : 0;

  return {
    totalReceipts: receipts,
    posWithGrn,
    posWithoutGrn,
    amountReceived,
    totalGrnQty: grnQty,
    fulfillmentRate,
    avgPoToGrnDays,
    backdatedGrnCount: backdatedCount,
    grnLineCount: grnRows.length,
  };
}

function getGrnFunnel(grnRows) {
  const poMap = new Map();

  for (const r of grnRows) {
    const po = String(r.PO_NO || "");
    if (!po) continue;
    if (!poMap.has(po)) {
      poMap.set(po, {
        approved: false,
        submitted: false,
        receipt: false,
        received: false,
        accepted: false,
        delivered: false,
        full: false,
      });
    }
    const s = poMap.get(po);
    if (String(r.PO_APPROVE || "").toUpperCase() === "APPROVE") s.approved = true;
    if (String(r.PO_SUBMIT || "").toUpperCase() === "SUBMIT") s.submitted = true;
    if (!isEmpty(r.RECEIPT_NUM)) s.receipt = true;
    if (Number(r.RECEIVE_QTY) > 0) s.received = true;
    if (Number(r.ACCEPT_QTY) > 0) s.accepted = true;
    if (!isEmpty(r.GRN_DATE) || Number(r.DELIVER_QTY) > 0) s.delivered = true;
    const poQ = Number(r.PO_QTY) || 0;
    const recv = Number(r.RECEIVE_QTY) || Number(r.GRN_QTY) || 0;
    if (poQ > 0 && recv >= poQ) s.full = true;
  }

  const stages = [
    { stage: "PO Submitted", test: (s) => s.submitted },
    { stage: "PO Approved", test: (s) => s.submitted && s.approved },
    { stage: "Receipt Created", test: (s) => s.submitted && s.approved && s.receipt },
    { stage: "Received", test: (s) => s.submitted && s.approved && s.receipt && s.received },
    { stage: "Accepted", test: (s) => s.submitted && s.approved && s.receipt && s.received && s.accepted },
    {
      stage: "GRN Delivered",
      test: (s) =>
        s.submitted && s.approved && s.receipt && s.received && s.accepted && s.delivered,
    },
    {
      stage: "Fully Received",
      test: (s) =>
        s.submitted &&
        s.approved &&
        s.receipt &&
        s.received &&
        s.accepted &&
        s.delivered &&
        s.full,
    },
  ];

  return stages.map(({ stage, test }) => ({
    stage,
    count: [...poMap.values()].filter(test).length,
  }));
}

function computePoToGrnAging(grnRows) {
  const buckets = {
    "0-7 Days": new Set(),
    "8-14 Days": new Set(),
    "15-30 Days": new Set(),
    "30+ Days": new Set(),
  };
  const seen = new Set();

  for (const r of grnRows) {
    const po = String(r.PO_NO);
    if (seen.has(po)) continue;
    seen.add(po);
    const days = poToGrnCalendarDays(r.PO_DATE, r.GRN_DATE || r.CREATION_DATE_RECEIPT);
    if (days === null) continue;
    const bucket = poToGrnAgingBucket(days);
    if (bucket) buckets[bucket].add(po);
  }

  return Object.entries(buckets).map(([name, set]) => ({ name, count: set.size }));
}

function getGrnByReceivingOrg(grnRows) {
  const map = new Map();
  for (const r of grnRows) {
    const org = String(r.ORG_RECEIVING_RSL || "").trim() || "Unknown";
    if (!map.has(org)) {
      map.set(org, { org, amountReceived: 0, grnQty: 0, poCount: new Set(), receiptCount: new Set() });
    }
    const e = map.get(org);
    e.amountReceived += Number(r.AMOUNT_RECEIVED) || 0;
    e.grnQty += Number(r.GRN_QTY) || Number(r.RECEIVE_QTY) || 0;
    if (!isEmpty(r.PO_NO)) e.poCount.add(String(r.PO_NO));
    if (!isEmpty(r.RECEIPT_NUM)) e.receiptCount.add(String(r.RECEIPT_NUM));
  }
  return [...map.values()]
    .map((e) => ({
      org: e.org,
      amountReceived: e.amountReceived,
      grnQty: e.grnQty,
      poCount: e.poCount.size,
      receiptCount: e.receiptCount.size,
    }))
    .sort((a, b) => b.amountReceived - a.amountReceived);
}

function getGrnMonthly(grnRows) {
  const map = new Map();
  for (const r of grnRows) {
    const d = parseDate(r.GRN_DATE) || parseDate(r.CREATION_DATE_RECEIPT) || parseDate(r.PO_DATE);
    if (!d) continue;
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map.has(k)) {
      map.set(k, { month: k, receipts: new Set(), pos: new Set(), amountReceived: 0, grnQty: 0 });
    }
    const e = map.get(k);
    if (!isEmpty(r.RECEIPT_NUM)) e.receipts.add(String(r.RECEIPT_NUM));
    if (!isEmpty(r.PO_NO)) e.pos.add(String(r.PO_NO));
    e.amountReceived += Number(r.AMOUNT_RECEIVED) || 0;
    e.grnQty += Number(r.GRN_QTY) || 0;
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => ({
      month: v.month,
      receiptCount: v.receipts.size,
      poCount: v.pos.size,
      amountReceived: v.amountReceived,
      grnQty: v.grnQty,
    }));
}

function getGrnVendors(grnRows, limit = 10) {
  const map = new Map();
  for (const r of grnRows) {
    if (isEmpty(r.VENDOR_ID)) continue;
    const id = String(r.VENDOR_ID);
    const name = String(r.VENDOR_NAME || "").trim() || id;
    if (!map.has(id)) {
      map.set(id, { vendorId: id, vendorName: name, amountReceived: 0, grnQty: 0, poCount: new Set() });
    }
    const e = map.get(id);
    if ((!e.vendorName || e.vendorName === id) && name && name !== id) e.vendorName = name;
    e.amountReceived += Number(r.AMOUNT_RECEIVED) || 0;
    e.grnQty += Number(r.GRN_QTY) || 0;
    if (!isEmpty(r.PO_NO)) e.poCount.add(String(r.PO_NO));
  }
  return [...map.values()]
    .map((e) => ({
      vendorId: e.vendorId,
      vendorName: e.vendorName,
      amountReceived: e.amountReceived,
      grnQty: e.grnQty,
      poCount: e.poCount.size,
    }))
    .sort((a, b) => b.amountReceived - a.amountReceived)
    .slice(0, Number(limit) || 10);
}

function getGrnFilterOptions(grnRows) {
  const years = new Set();
  for (const r of grnRows) {
    const d = grnPoDate(r);
    if (d) years.add(d.getFullYear());
  }
  return {
    receivingOrgs: uniqueValues(grnRows, "ORG_RECEIVING_RSL"),
    grnUsers: uniqueValues(grnRows, "USER_NAME"),
    years: [...years].sort((a, b) => b - a),
  };
}

function getGrnInsights(grnRows, prPoRows = []) {
  const kpis = getGrnKpis(grnRows, prPoRows);
  const aging = computePoToGrnAging(grnRows);
  const slow = aging.find((a) => a.name === "30+ Days");
  const orgs = getGrnByReceivingOrg(grnRows);
  const vendors = getGrnVendors(grnRows, 5);

  const vendorMap = new Map();
  for (const r of grnRows) {
    if (isEmpty(r.VENDOR_ID)) continue;
    const id = String(r.VENDOR_ID);
    const days = poToGrnCalendarDays(r.PO_DATE, r.GRN_DATE || r.CREATION_DATE_RECEIPT);
    if (days === null) continue;
    if (!vendorMap.has(id)) {
      vendorMap.set(id, {
        vendorId: id,
        vendorName: String(r.VENDOR_NAME || id),
        days: [],
      });
    }
    vendorMap.get(id).days.push(days);
  }
  let slowestVendor = null;
  for (const v of vendorMap.values()) {
    if (!v.days.length) continue;
    const avg = v.days.reduce((a, b) => a + b, 0) / v.days.length;
    if (!slowestVendor || avg > slowestVendor.avgDays) {
      slowestVendor = { vendorId: v.vendorId, vendorName: v.vendorName, avgDays: Math.round(avg * 10) / 10 };
    }
  }

  return {
    grnSummary: kpis,
    topReceivingOrg: orgs[0] || null,
    topGrnVendor: vendors[0] || null,
    slowestGrnVendor: slowestVendor,
    poToGrnBottleneck: {
      slow30PlusDays: slow?.count || 0,
      posWithoutGrn: kpis.posWithoutGrn,
      message:
        kpis.posWithoutGrn > 0
          ? `${kpis.posWithoutGrn} approved POs have no GRN receipt yet`
          : slow?.count
            ? `${slow.count} POs took over 30 days from PO to GRN`
            : "PO→GRN pipeline is flowing normally",
    },
    fulfillmentInsight: {
      rate: kpis.fulfillmentRate,
      recommendation:
        kpis.fulfillmentRate < 90
          ? "GRN fulfillment is below 90% — review partial receipts and vendor delivery SLAs."
          : "GRN quantity fulfillment is healthy relative to PO quantities.",
    },
  };
}

function paginateGrnTable(grnRows, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(200, Math.max(10, Number(query.pageSize) || 25));
  const sortBy = query.sortBy || "GRN_DATE";
  const sortDir = (query.sortDir || "desc").toLowerCase() === "asc" ? 1 : -1;

  const sorted = [...grnRows].sort((a, b) => {
    let av = a[sortBy];
    let bv = b[sortBy];
    if (String(sortBy).includes("DATE") || sortBy === "PO_DATE") {
      av = parseDate(av)?.getTime() ?? 0;
      bv = parseDate(bv)?.getTime() ?? 0;
    } else if (typeof av === "number" || typeof bv === "number" || !Number.isNaN(Number(av))) {
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
  const data = sorted.slice(start, start + pageSize).map((r) => {
    const poToGrnDays = poToGrnCalendarDays(r.PO_DATE, r.GRN_DATE || r.CREATION_DATE_RECEIPT);
    return {
      PO_NO: r.PO_NO,
      PO_DATE: r.PO_DATE,
      VENDOR_ID: r.VENDOR_ID,
      VENDOR_NAME: r.VENDOR_NAME,
      ITEM_CODE: r.ITEM_CODE,
      ITEM_DESC: r.ITEM_DESC,
      PO_QTY: r.PO_QTY,
      PO_AMT: r.PO_AMT,
      RATE: r.RATE,
      CURRENCY_CODE: r.CURRENCY_CODE,
      RECEIPT_NUM: r.RECEIPT_NUM,
      CREATION_DATE_RECEIPT: r.CREATION_DATE_RECEIPT,
      GRN_DATE: r.GRN_DATE,
      GRN_QTY: r.GRN_QTY,
      RECEIVE_QTY: r.RECEIVE_QTY,
      ACCEPT_QTY: r.ACCEPT_QTY,
      DELIVER_QTY: r.DELIVER_QTY,
      RETURN_QTY: r.RETURN_QTY,
      AMOUNT_RECEIVED: r.AMOUNT_RECEIVED,
      ORG_RECEIVING_RSL: r.ORG_RECEIVING_RSL,
      USER_NAME: r.USER_NAME,
      SUBMIT_NAME: r.SUBMIT_NAME,
      APPROVER_NAME: r.APPROVER_NAME,
      PO_APPROVE: r.PO_APPROVE,
      PO_SUBMIT: r.PO_SUBMIT,
      PO_FORWARD: r.PO_FORWARD,
      BACKDATED_DAYS: r.BACKDATED_DAYS,
      PO_TO_GRN_DAYS: poToGrnDays,
    };
  });

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

function classifyGrnLine(r) {
  const ret = Number(r.RETURN_QTY) || 0;
  const recv = Number(r.RECEIVE_QTY) || 0;
  const accept = Number(r.ACCEPT_QTY) || 0;
  const deliver = Number(r.DELIVER_QTY) || 0;
  if (ret > 0) return "return";
  if (recv > 0 && accept < recv) return "acceptReject";
  if (accept > 0 && deliver < accept) return "deliveryGap";
  return "clean";
}

const GRN_RETURN_LABELS = {
  clean: "All OK",
  return: "Returned to Vendor",
  acceptReject: "QC Partial Reject",
  deliveryGap: "Not Fully Delivered",
};

function getGrnReturnRejectAnalysis(grnRows) {
  const bucketMap = {
    clean: { key: "clean", name: GRN_RETURN_LABELS.clean, count: 0, qty: 0, color: "#3d9b6a" },
    return: { key: "return", name: GRN_RETURN_LABELS.return, count: 0, qty: 0, color: "#e31e24" },
    acceptReject: { key: "acceptReject", name: GRN_RETURN_LABELS.acceptReject, count: 0, qty: 0, color: "#d4a800" },
    deliveryGap: { key: "deliveryGap", name: GRN_RETURN_LABELS.deliveryGap, count: 0, qty: 0, color: "#2f7ec4" },
  };
  const vendorReturns = new Map();

  for (const r of grnRows) {
    const kind = classifyGrnLine(r);
    bucketMap[kind].count += 1;

    const ret = Number(r.RETURN_QTY) || 0;
    const recv = Number(r.RECEIVE_QTY) || 0;
    const accept = Number(r.ACCEPT_QTY) || 0;
    const deliver = Number(r.DELIVER_QTY) || 0;

    if (kind === "return") {
      bucketMap.return.qty += ret;
      const id = String(r.VENDOR_ID || r.VENDOR_NAME || "unknown");
      const name = String(r.VENDOR_NAME || id);
      if (!vendorReturns.has(id)) {
        vendorReturns.set(id, { vendorId: id, vendorName: name, returnQty: 0, lineCount: 0 });
      }
      const v = vendorReturns.get(id);
      v.returnQty += ret;
      v.lineCount += 1;
      if (name && name !== id) v.vendorName = name;
    } else if (kind === "acceptReject") {
      bucketMap.acceptReject.qty += Math.max(0, recv - accept);
    } else if (kind === "deliveryGap") {
      bucketMap.deliveryGap.qty += Math.max(0, accept - deliver);
    }
  }

  const totalLines = grnRows.length || 1;

  return {
    summary: {
      totalLines: grnRows.length,
      returnLines: bucketMap.return.count,
      totalReturnQty: bucketMap.return.qty,
      acceptRejectLines: bucketMap.acceptReject.count,
      deliveryGapLines: bucketMap.deliveryGap.count,
      cleanLines: bucketMap.clean.count,
      returnRate: Math.round((bucketMap.return.count / totalLines) * 1000) / 10,
      acceptRejectRate: Math.round((bucketMap.acceptReject.count / totalLines) * 1000) / 10,
    },
    buckets: ["return", "acceptReject", "deliveryGap", "clean"].map((k) => bucketMap[k]),
    topVendorsByReturn: [...vendorReturns.values()]
      .sort((a, b) => b.returnQty - a.returnQty || b.lineCount - a.lineCount)
      .slice(0, 10),
  };
}

async function withFilteredGrn(req, prPoRows) {
  const grnRaw = await getPo2GrnData();
  return applyGrnFilters(grnRaw, req.query, prPoRows);
}

module.exports = {
  getPo2GrnData,
  getGrnFeedStatus,
  startGrnBackgroundRefresh,
  applyGrnFilters,
  withFilteredGrn,
  getGrnKpis,
  getGrnFunnel,
  computePoToGrnAging,
  getGrnByReceivingOrg,
  getGrnMonthly,
  getGrnVendors,
  getGrnFilterOptions,
  getGrnInsights,
  getGrnReturnRejectAnalysis,
  classifyGrnLine,
  paginateGrnTable,
  poToGrnCalendarDays,
  poToGrnAgingBucket,
};
