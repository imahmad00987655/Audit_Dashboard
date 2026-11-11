/**
 * Split PO fraud detection — same creator + item code, multiple POs within N days
 * exceeding COO approval limit (default 5 lac PKR).
 */
const { resolveDepartmentName } = require("./dataService");
const APPROVAL_LIMIT_PKR = Number(process.env.APPROVAL_LIMIT_PKR || 500000);
const SPLIT_WINDOW_DAYS = Number(process.env.SPLIT_WINDOW_DAYS || 3);

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

function dateUtcKey(d) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function poAmountPkr(r) {
  const amt = Number(r.PO_AMT) || 0;
  const code = String(r.CURRENCY_CODE || "PKR").trim().toUpperCase();
  if (code === "PKR") return amt;
  const rate = Number(r.PO_EXCH_RATE) || 0;
  if (rate > 0) return amt * rate;
  return amt;
}

function isCancelledPo(r) {
  const cancel = String(r.CANCEL_FLAG_PO || r.PO_CANCEL || "").toUpperCase();
  return cancel === "Y" || cancel === "YES" || cancel === "CANCEL" || cancel === "CANCELLED";
}

function buildPoItemLines(rows) {
  const map = new Map();
  for (const r of rows) {
    if (isEmpty(r.PO_NO) || isEmpty(r.ITEM_CODE)) continue;
    if (isCancelledPo(r)) continue;
    const key = `${r.PO_NO}|${String(r.ITEM_CODE).trim()}`;
    const date = parseDate(r.PO_CREATION_DATE);
    if (!date) continue;

    const line = {
      poNo: String(r.PO_NO),
      itemCode: String(r.ITEM_CODE).trim(),
      itemDesc: String(r.ITEM_DESC || r.ITEM_DESC_PR || "").trim(),
      creator: String(r.PO_CREATED_BY || "").trim(),
      vendorId: String(r.VENDOR_ID || ""),
      vendorName: String(r.VENDOR_NAME || "").trim(),
      department: resolveDepartmentName(r.DEPARTMENT),
      organization: String(r.ORGANIZATION_NAME || r.COMP_NAME || "").trim(),
      poCreationDate: date,
      amountPkr: poAmountPkr(r),
      rawAmount: Number(r.PO_AMT) || 0,
      currency: String(r.CURRENCY_CODE || "PKR").trim(),
      approverName: String(r.APPROVER_NAME || "").trim(),
      approverFinal: String(r.APPROVER_FINAL || "").trim(),
      poApproved: String(r.PO_APPROVE || "").toUpperCase() === "APPROVE",
    };

    if (!map.has(key)) {
      map.set(key, line);
    } else {
      const e = map.get(key);
      e.amountPkr += line.amountPkr;
      e.rawAmount += line.rawAmount;
    }
  }
  return [...map.values()];
}

function detectSplitPoClusters(lines) {
  const groups = new Map();
  for (const line of lines) {
    if (!line.creator || !line.itemCode) continue;
    const gk = `${line.creator}|${line.itemCode}|${line.vendorId}`;
    if (!groups.has(gk)) groups.set(gk, []);
    groups.get(gk).push(line);
  }

  const clusters = [];
  const seen = new Set();

  for (const [, groupLines] of groups) {
    groupLines.sort((a, b) => a.poCreationDate - b.poCreationDate);

    for (let i = 0; i < groupLines.length; i++) {
      const windowStart = groupLines[i].poCreationDate;
      const windowEnd = new Date(windowStart);
      windowEnd.setUTCDate(windowEnd.getUTCDate() + SPLIT_WINDOW_DAYS - 1);

      const inWindow = groupLines.filter(
        (l) => l.poCreationDate >= windowStart && l.poCreationDate <= windowEnd
      );

      const poMap = new Map();
      for (const l of inWindow) {
        if (!poMap.has(l.poNo)) poMap.set(l.poNo, l);
      }
      const pos = [...poMap.values()];
      if (pos.length < 2) continue;

      const totalAmount = pos.reduce((s, p) => s + p.amountPkr, 0);
      const maxSingle = Math.max(...pos.map((p) => p.amountPkr));
      const allUnderLimit = pos.every((p) => p.amountPkr <= APPROVAL_LIMIT_PKR);

      if (totalAmount <= APPROVAL_LIMIT_PKR) continue;
      if (!allUnderLimit && pos.length < 3) continue;

      const clusterKey = `${pos[0].creator}|${pos[0].itemCode}|${dateUtcKey(windowStart)}|${pos
        .map((p) => p.poNo)
        .sort()
        .join(",")}`;
      if (seen.has(clusterKey)) continue;
      seen.add(clusterKey);

      clusters.push({
        id: clusterKey,
        creator: pos[0].creator,
        itemCode: pos[0].itemCode,
        itemDesc: pos[0].itemDesc,
        vendorId: pos[0].vendorId,
        vendorName: pos[0].vendorName,
        department: pos[0].department,
        organization: pos[0].organization,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        windowDays: SPLIT_WINDOW_DAYS,
        poCount: pos.length,
        totalAmountPkr: Math.round(totalAmount),
        maxSinglePoPkr: Math.round(maxSingle),
        approvalLimitPkr: APPROVAL_LIMIT_PKR,
        excessAmountPkr: Math.round(Math.max(0, totalAmount - APPROVAL_LIMIT_PKR)),
        riskLevel: allUnderLimit ? "high" : "medium",
        pattern: allUnderLimit ? "split_under_limit" : "aggregate_over_limit",
        pos: pos
          .map((p) => ({
            poNo: p.poNo,
            amountPkr: Math.round(p.amountPkr),
            rawAmount: p.rawAmount,
            currency: p.currency,
            poCreationDate: p.poCreationDate.toISOString(),
            approverName: p.approverName,
            approverFinal: p.approverFinal,
            poApproved: p.poApproved,
          }))
          .sort((a, b) => new Date(a.poCreationDate) - new Date(b.poCreationDate)),
        approvers: [...new Set(pos.map((p) => p.approverName).filter(Boolean))],
      });
    }
  }

  return clusters.sort(
    (a, b) => b.totalAmountPkr - a.totalAmountPkr || b.poCount - a.poCount
  );
}

function dedupeClustersForMetrics(clusters) {
  const sorted = [...clusters].sort(
    (a, b) => b.excessAmountPkr - a.excessAmountPkr || b.totalAmountPkr - a.totalAmountPkr
  );
  const usedPos = new Set();
  const deduped = [];
  for (const c of sorted) {
    const poNos = c.pos.map((p) => p.poNo);
    if (poNos.some((p) => usedPos.has(p))) continue;
    poNos.forEach((p) => usedPos.add(p));
    deduped.push(c);
  }
  return deduped;
}

function aggregateByCreator(clusters) {
  const map = new Map();
  for (const c of clusters) {
    if (!map.has(c.creator)) {
      map.set(c.creator, { name: c.creator, clusterCount: 0, poCount: 0, totalAmountPkr: 0, excessPkr: 0 });
    }
    const e = map.get(c.creator);
    e.clusterCount += 1;
    e.poCount += c.poCount;
    e.totalAmountPkr += c.totalAmountPkr;
    e.excessPkr += c.excessAmountPkr;
  }
  return [...map.values()].sort((a, b) => b.excessPkr - a.excessPkr || b.clusterCount - a.clusterCount);
}

function aggregateByItemCode(clusters) {
  const map = new Map();
  for (const c of clusters) {
    const key = c.itemCode;
    if (!map.has(key)) {
      map.set(key, {
        itemCode: c.itemCode,
        itemDesc: c.itemDesc,
        clusterCount: 0,
        poCount: 0,
        totalAmountPkr: 0,
        excessPkr: 0,
      });
    }
    const e = map.get(key);
    e.clusterCount += 1;
    e.poCount += c.poCount;
    e.totalAmountPkr += c.totalAmountPkr;
    e.excessPkr += c.excessAmountPkr;
  }
  return [...map.values()].sort((a, b) => b.excessPkr - a.excessPkr || b.clusterCount - a.clusterCount);
}

function dailyTrend(clusters) {
  const map = new Map();
  for (const c of clusters) {
    const d = new Date(c.windowStart);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, { date: key, clusters: 0, poCount: 0, excessPkr: 0 });
    const e = map.get(key);
    e.clusters += 1;
    e.poCount += c.poCount;
    e.excessPkr += c.excessAmountPkr;
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function getSplitPoAnalysis(prPoRows) {
  const lines = buildPoItemLines(prPoRows);
  const allClusters = detectSplitPoClusters(lines);
  const metricClusters = dedupeClustersForMetrics(allClusters);
  const flaggedPoSet = new Set();
  for (const c of allClusters) {
    for (const p of c.pos) flaggedPoSet.add(p.poNo);
  }

  return {
    summary: {
      approvalLimitPkr: APPROVAL_LIMIT_PKR,
      windowDays: SPLIT_WINDOW_DAYS,
      suspiciousClusters: allClusters.length,
      dedupedClusters: metricClusters.length,
      flaggedPos: flaggedPoSet.size,
      flaggedCreators: new Set(metricClusters.map((c) => c.creator)).size,
      flaggedItemCodes: new Set(metricClusters.map((c) => c.itemCode)).size,
      totalSplitAmountPkr: metricClusters.reduce((s, c) => s + c.totalAmountPkr, 0),
      totalExcessPkr: metricClusters.reduce((s, c) => s + c.excessAmountPkr, 0),
      highRiskClusters: metricClusters.filter((c) => c.riskLevel === "high").length,
    },
    byCreator: aggregateByCreator(metricClusters).slice(0, 15),
    byItemCode: aggregateByItemCode(metricClusters).slice(0, 15),
    dailyTrend: dailyTrend(metricClusters),
    clusters: allClusters.slice(0, 50),
  };
}

function paginateSplitPoTable(prPoRows, query = {}) {
  const lines = buildPoItemLines(prPoRows);
  let clusters = detectSplitPoClusters(lines);

  if (query.poCreator) {
    const creators = String(query.poCreator).split(",").map((s) => s.trim()).filter(Boolean);
    if (creators.length) clusters = clusters.filter((c) => creators.includes(c.creator));
  }
  if (query.itemCode) {
    const codes = String(query.itemCode).split(",").map((s) => s.trim()).filter(Boolean);
    if (codes.length) clusters = clusters.filter((c) => codes.includes(c.itemCode));
  }
  if (query.riskLevel) {
    clusters = clusters.filter((c) => c.riskLevel === String(query.riskLevel));
  }

  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize) || 25));
  const total = clusters.length;
  const start = (page - 1) * pageSize;
  const data = clusters.slice(start, start + pageSize);

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

function getSplitPoInsights(analysis) {
  const { summary, byCreator, clusters } = analysis;
  const insights = [];

  if (summary.suspiciousClusters === 0) {
    insights.push({
      type: "success",
      title: "No split PO patterns detected",
      message: `No creator + item-code clusters exceeded ${(summary.approvalLimitPkr / 100000).toFixed(0)} lac within ${summary.windowDays} days in the current filter.`,
    });
    return insights;
  }

  const top = byCreator[0];
  if (top) {
    insights.push({
      type: "alert",
      title: "Split PO approval bypass risk",
      message: `${top.name} has ${top.clusterCount} suspicious cluster(s) — ${top.poCount} POs totalling ${Math.round(top.totalAmountPkr / 100000)} lac PKR (excess ~${Math.round(top.excessPkr / 100000)} lac above COO limit).`,
    });
  }

  const highRisk = clusters.filter((c) => c.riskLevel === "high").slice(0, 2);
  for (const c of highRisk) {
    insights.push({
      type: "warning",
      title: `${c.poCount}× PO split — ${c.itemCode}`,
      message: `${c.creator} created ${c.poCount} POs for "${c.itemDesc || c.itemCode}" totalling ${Math.round(c.totalAmountPkr / 100000)} lac within ${c.windowDays} days (each ≤ ${(c.approvalLimitPkr / 100000).toFixed(0)} lac). POs: ${c.pos.map((p) => p.poNo).join(", ")}`,
    });
  }

  return insights;
}

module.exports = {
  APPROVAL_LIMIT_PKR,
  SPLIT_WINDOW_DAYS,
  getSplitPoAnalysis,
  paginateSplitPoTable,
  getSplitPoInsights,
  buildPoItemLines,
  detectSplitPoClusters,
};
