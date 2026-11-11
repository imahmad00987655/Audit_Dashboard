/**
 * Live Procurement Command Center — aggregated view for PR → PO → GRN.
 * Uses filtered PR/PO + GRN rows from existing data pipelines (no invented fields).
 */

function isEmpty(v) {
  return v === null || v === undefined || v === "";
}

function poAmtInPkr(r) {
  const amt = Number(r.PO_AMT) || 0;
  const code = String(r.CURRENCY_CODE || "PKR").toUpperCase();
  if (code === "PKR" || !code) return amt;
  const rate = Number(r.PO_EXCH_RATE) || 0;
  return rate > 0 ? amt * rate : amt;
}

function uniqueCount(rows, key) {
  const set = new Set();
  for (const r of rows) {
    const v = r[key];
    if (!isEmpty(v)) set.add(String(v));
  }
  return set.size;
}

function isPoApproved(r) {
  return String(r.PO_APPROVE || "").toUpperCase() === "APPROVE";
}

function isPrApproved(r) {
  const flag = String(r.PR_APPROVE || "").toUpperCase();
  const auth = String(r.PR_AUTHORIZATION_STATUS || "").toUpperCase();
  return flag === "APPROVE" || auth === "APPROVED";
}

function hasGrnReceipt(r) {
  return !isEmpty(r.RECEIPT_NUM) || !isEmpty(r.GRN_DATE) || Number(r.GRN_QTY) > 0 || Number(r.RECEIVE_QTY) > 0;
}

function parseTs(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function topGrouped(rows, nameFn, valueFn, limit) {
  const map = new Map();
  for (const r of rows) {
    const name = nameFn(r);
    if (!name) continue;
    if (!map.has(name)) map.set(name, { name, value: 0, count: 0 });
    const e = map.get(name);
    e.value += valueFn(r) || 0;
    e.count += 1;
  }
  return [...map.values()].sort((a, b) => b.value - a.value || b.count - a.count).slice(0, limit);
}

function countPrStatus(rows) {
  const byReq = new Map();
  for (const r of rows) {
    if (isEmpty(r.REQ_NO)) continue;
    const id = String(r.REQ_NO);
    if (!byReq.has(id)) byReq.set(id, false);
    if (isPrApproved(r)) byReq.set(id, true);
  }
  let approved = 0;
  let pending = 0;
  for (const ok of byReq.values()) {
    if (ok) approved += 1;
    else pending += 1;
  }
  return { total: byReq.size, approved, pending };
}

function countPoStatus(rows) {
  const byPo = new Map();
  for (const r of rows) {
    if (isEmpty(r.PO_NO)) continue;
    const id = String(r.PO_NO);
    if (!byPo.has(id)) byPo.set(id, { approved: false, spend: 0, hasPr: false });
    const e = byPo.get(id);
    if (isPoApproved(r)) e.approved = true;
    if (!isEmpty(r.REQ_NO)) e.hasPr = true;
    e.spend += poAmtInPkr(r);
  }
  let approved = 0;
  let pending = 0;
  let spend = 0;
  let linkedToPr = 0;
  for (const e of byPo.values()) {
    if (e.approved) approved += 1;
    else pending += 1;
    if (e.hasPr) linkedToPr += 1;
    spend += e.spend;
  }
  return { total: byPo.size, approved, pending, spend, linkedToPr };
}

/**
 * Quantity-aware receiving classification for approved POs.
 * Fully received requires ordered qty known and received >= ordered (after returns).
 */
function receivingMetrics(prPoRows, grnRows) {
  const approvedPos = new Set();
  const orderedByPo = new Map();

  for (const r of prPoRows) {
    if (isEmpty(r.PO_NO)) continue;
    const po = String(r.PO_NO);
    if (isPoApproved(r)) approvedPos.add(po);
    const lineKey = `${po}|${r.PO_LINE_ID || r.ITEM_CODE || ""}|${r.PO_QTY || ""}`;
    if (!orderedByPo.has(po)) orderedByPo.set(po, { qty: 0, lines: new Set() });
    const e = orderedByPo.get(po);
    if (!e.lines.has(lineKey)) {
      e.lines.add(lineKey);
      e.qty += Number(r.PO_QTY) || 0;
    }
  }

  const receivedByPo = new Map();
  const returnedByPo = new Map();
  const receiptSet = new Set();
  let totalReceivedQty = 0;
  let amountReceived = 0;
  let backdatedCount = 0;

  for (const r of grnRows) {
    if (!hasGrnReceipt(r)) continue;
    const po = String(r.PO_NO || "");
    if (!po) continue;
    const recv = Number(r.RECEIVE_QTY) || Number(r.GRN_QTY) || 0;
    const ret = Number(r.RETURN_QTY) || 0;
    receivedByPo.set(po, (receivedByPo.get(po) || 0) + recv);
    if (ret > 0) returnedByPo.set(po, (returnedByPo.get(po) || 0) + ret);
    totalReceivedQty += recv;
    amountReceived += Number(r.AMOUNT_RECEIVED) || 0;
    if (!isEmpty(r.RECEIPT_NUM)) receiptSet.add(String(r.RECEIPT_NUM));
    if (Number(r.BACKDATED_DAYS) > 0) backdatedCount += 1;
  }

  let posWithGrn = 0;
  let posWithoutGrn = 0;
  let partiallyReceived = 0;
  let fullyReceived = 0;
  let pendingReceivingQty = 0;

  for (const po of approvedPos) {
    const ordered = orderedByPo.get(po)?.qty || 0;
    const rawReceived = receivedByPo.get(po) || 0;
    const returned = returnedByPo.get(po) || 0;
    const netReceived = Math.max(0, rawReceived - returned);

    if (netReceived <= 0 && rawReceived <= 0) {
      posWithoutGrn += 1;
      pendingReceivingQty += Math.max(0, ordered);
      continue;
    }

    posWithGrn += 1;
    pendingReceivingQty += Math.max(0, ordered - netReceived);

    if (ordered > 0 && netReceived >= ordered) {
      fullyReceived += 1;
    } else if (netReceived > 0 || rawReceived > 0) {
      partiallyReceived += 1;
    }
  }

  return {
    totalReceipts: receiptSet.size,
    posWithGrn,
    posWithoutGrn,
    partiallyReceived,
    fullyReceived,
    totalReceivedQty,
    pendingReceivingQty,
    amountReceived,
    backdatedCount,
  };
}

function buildNetwork(prPoRows, grnRows, pr, po, recv) {
  const hubs = [
    {
      id: "hub-pr",
      type: "hub",
      stage: "pr",
      label: "PR Hub",
      subtitle: "Requisitions",
      count: pr.total,
      meta: { approved: pr.approved, pending: pr.pending },
    },
    {
      id: "hub-po",
      type: "hub",
      stage: "po",
      label: "PO Hub",
      subtitle: "Purchase Orders",
      count: po.total,
      meta: { approved: po.approved, pending: po.pending, spend: po.spend, linkedToPr: po.linkedToPr },
    },
    {
      id: "hub-grn",
      type: "hub",
      stage: "grn",
      label: "GRN Hub",
      subtitle: "Goods Receipt",
      count: recv.totalReceipts,
      meta: {
        posWithGrn: recv.posWithGrn,
        posWithoutGrn: recv.posWithoutGrn,
        partiallyReceived: recv.partiallyReceived,
        fullyReceived: recv.fullyReceived,
        receivedQty: recv.totalReceivedQty,
      },
    },
  ];

  const companies = topGrouped(
    prPoRows,
    (r) => String(r.COMP_NAME || "").trim(),
    (r) => poAmtInPkr(r),
    8
  ).map((x, i) => ({
    id: `company-${i}`,
    type: "company",
    stage: "pr",
    label: x.name,
    count: x.count,
    value: x.value,
  }));

  const departments = topGrouped(
    prPoRows,
    (r) => String(r.DEPARTMENT || "").trim(),
    () => 1,
    10
  ).map((x, i) => ({
    id: `dept-${i}`,
    type: "department",
    stage: "pr",
    label: x.name,
    count: uniqueCount(
      prPoRows.filter((r) => String(r.DEPARTMENT || "").trim() === x.name),
      "REQ_NO"
    ),
    value: x.value,
  }));

  // Vendors drive the PO tree — return enough for a full dynamic filter-scoped tree
  const vendors = topGrouped(
    prPoRows.filter((r) => !isEmpty(r.PO_NO)),
    (r) => String(r.VENDOR_NAME || r.VENDOR_ID || "").trim(),
    (r) => poAmtInPkr(r),
    16
  ).map((x, i) => {
    const vendorRows = prPoRows.filter((r) => String(r.VENDOR_NAME || r.VENDOR_ID || "").trim() === x.name);
    const poCount = uniqueCount(vendorRows, "PO_NO");
    const grnPoSet = new Set(
      grnRows.filter((r) => hasGrnReceipt(r) && String(r.VENDOR_NAME || r.VENDOR_ID || "").trim() === x.name).map((r) => String(r.PO_NO))
    );
    return {
      id: `vendor-${i}`,
      type: "vendor",
      stage: "po",
      label: x.name,
      count: poCount,
      value: x.value,
      meta: { poCount, grnPoCount: grnPoSet.size },
    };
  });

  const receivingOrgs = topGrouped(
    grnRows.filter(hasGrnReceipt),
    (r) => String(r.ORG_RECEIVING_RSL || "").trim(),
    (r) => Number(r.AMOUNT_RECEIVED) || 0,
    10
  ).map((x, i) => ({
    id: `recv-${i}`,
    type: "receivingOrg",
    stage: "grn",
    label: x.name,
    count: x.count,
    value: x.value,
  }));

  const operatingUnits = topGrouped(
    prPoRows,
    (r) => String(r.OPERATING_UNIT_NAME || r.OPERATING_UNIT || "").trim(),
    () => 1,
    6
  ).map((x, i) => ({
    id: `ou-${i}`,
    type: "operatingUnit",
    stage: "pr",
    label: x.name,
    count: x.count,
    value: x.value,
  }));

  const prCreators = topGrouped(
    prPoRows.filter((r) => !isEmpty(r.REQ_CREADED_BY)),
    (r) => String(r.REQ_CREADED_BY || "").trim(),
    () => 1,
    6
  ).map((x, i) => ({
    id: `prcreator-${i}`,
    type: "prCreator",
    stage: "pr",
    label: x.name,
    count: uniqueCount(
      prPoRows.filter((r) => String(r.REQ_CREADED_BY || "").trim() === x.name),
      "REQ_NO"
    ),
    value: x.value,
  }));

  const grnUsers = topGrouped(
    grnRows.filter(hasGrnReceipt),
    (r) => String(r.USER_NAME || r.SUBMIT_NAME || "").trim(),
    () => 1,
    6
  ).map((x, i) => ({
    id: `grnuser-${i}`,
    type: "grnUser",
    stage: "grn",
    label: x.name,
    count: x.count,
    value: x.value,
  }));

  const items = topGrouped(
    prPoRows.filter((r) => !isEmpty(r.ITEM_DESC) || !isEmpty(r.ITEM_CODE)),
    (r) => String(r.ITEM_DESC || r.ITEM_CODE || "").trim(),
    (r) => poAmtInPkr(r),
    6
  ).map((x, i) => ({
    id: `item-${i}`,
    type: "item",
    stage: "po",
    label: x.name.length > 36 ? `${x.name.slice(0, 34)}…` : x.name,
    count: x.count,
    value: x.value,
  }));

  const nodes = [
    ...hubs,
    ...companies,
    ...departments,
    ...vendors,
    ...receivingOrgs,
    ...operatingUnits,
    ...prCreators,
    ...grnUsers,
    ...items,
  ];

  const verifiedPrToPo = po.linkedToPr || 0;
  const links = [
    {
      id: "flow-pr-po",
      from: "hub-pr",
      to: "hub-po",
      weight: verifiedPrToPo || 1,
      kind: "pipeline",
      verified: verifiedPrToPo > 0,
    },
    {
      id: "flow-po-grn",
      from: "hub-po",
      to: "hub-grn",
      weight: recv.posWithGrn || 1,
      kind: "pipeline",
      verified: recv.posWithGrn > 0,
    },
  ];

  for (const n of companies) links.push({ id: `l-${n.id}`, from: n.id, to: "hub-pr", weight: n.count || 1, kind: "satellite" });
  for (const n of departments) links.push({ id: `l-${n.id}`, from: n.id, to: "hub-pr", weight: n.count || 1, kind: "satellite" });
  for (const n of operatingUnits) links.push({ id: `l-${n.id}`, from: n.id, to: "hub-pr", weight: n.count || 1, kind: "satellite" });
  for (const n of prCreators) links.push({ id: `l-${n.id}`, from: n.id, to: "hub-pr", weight: n.count || 1, kind: "satellite" });
  for (const n of vendors) links.push({ id: `l-${n.id}`, from: n.id, to: "hub-po", weight: n.count || 1, kind: "satellite" });
  for (const n of items) links.push({ id: `l-${n.id}`, from: n.id, to: "hub-po", weight: n.count || 1, kind: "satellite" });
  for (const n of receivingOrgs) links.push({ id: `l-${n.id}`, from: n.id, to: "hub-grn", weight: n.count || 1, kind: "satellite" });
  for (const n of grnUsers) links.push({ id: `l-${n.id}`, from: n.id, to: "hub-grn", weight: n.count || 1, kind: "satellite" });

  return { nodes, links };
}

function buildActivityCandidates(prPoRows, grnRows, limit = 40) {
  const events = [];

  const poSeen = new Set();
  for (const r of prPoRows) {
    if (isEmpty(r.PO_NO)) continue;
    const po = String(r.PO_NO);
    if (poSeen.has(po)) continue;
    poSeen.add(po);
    const ts =
      parseTs(r.PO_CREATION_DATE) ||
      parseTs(r.SUBMIT_DATE) ||
      parseTs(r.APPROVER_FINAL_DATE) ||
      parseTs(r.APPROVER_DATE) ||
      0;
    const fingerprint = `po|${po}|${r.PO_CREATION_DATE || ""}|${r.PO_APPROVE || ""}`;
    const reqNo = !isEmpty(r.REQ_NO) ? String(r.REQ_NO) : null;
    events.push({
      id: fingerprint,
      fingerprint,
      kind: "po",
      title: isPoApproved(r) ? "Purchase Order Approved" : "Purchase Order Detected",
      documentRef: po,
      reqNo,
      hasPrLink: Boolean(reqNo),
      vendor: String(r.VENDOR_NAME || "").trim() || null,
      department: String(r.DEPARTMENT || "").trim() || null,
      amount: poAmtInPkr(r),
      currency: "PKR",
      status: String(r.PO_APPROVE || r.PO_AUTHORIZATION_STATUS || "").trim() || null,
      timestamp: ts ? new Date(ts).toISOString() : null,
      ts,
    });
  }

  const grnSeen = new Set();
  for (const r of grnRows) {
    if (!hasGrnReceipt(r)) continue;
    const receipt = String(r.RECEIPT_NUM || `${r.PO_NO}-${r.GRN_DATE || ""}`);
    const key = `${r.PO_NO}|${receipt}`;
    if (grnSeen.has(key)) continue;
    grnSeen.add(key);
    const ts = parseTs(r.GRN_DATE) || parseTs(r.CREATION_DATE_RECEIPT) || 0;
    const fingerprint = `grn|${r.PO_NO}|${receipt}|${r.GRN_DATE || r.CREATION_DATE_RECEIPT || ""}`;
    const backdated = Number(r.BACKDATED_DAYS) > 0;
    events.push({
      id: fingerprint,
      fingerprint,
      kind: backdated ? "backdated_grn" : "grn",
      title: backdated ? "Backdated GRN" : "Goods Received",
      documentRef: String(r.PO_NO || ""),
      receiptNum: String(r.RECEIPT_NUM || "").trim() || null,
      hasPoLink: !isEmpty(r.PO_NO),
      vendor: String(r.VENDOR_NAME || "").trim() || null,
      department: null,
      quantity: Number(r.RECEIVE_QTY) || Number(r.GRN_QTY) || null,
      receivingOrg: String(r.ORG_RECEIVING_RSL || "").trim() || null,
      grnUser: String(r.USER_NAME || r.SUBMIT_NAME || "").trim() || null,
      amount: Number(r.AMOUNT_RECEIVED) || null,
      currency: String(r.CURRENCY_CODE || "PKR"),
      status: backdated ? `Backdated ${r.BACKDATED_DAYS}d` : "Received",
      timestamp: ts ? new Date(ts).toISOString() : null,
      ts,
      backdatedDays: backdated ? Number(r.BACKDATED_DAYS) : null,
    });
  }

  events.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return events.slice(0, limit).map(({ ts, ...rest }) => rest);
}

function getCommandCenter(prPoRows, grnRows) {
  const pr = countPrStatus(prPoRows);
  const po = countPoStatus(prPoRows);
  const recv = receivingMetrics(prPoRows, grnRows);
  const network = buildNetwork(prPoRows, grnRows, pr, po, recv);
  const activity = buildActivityCandidates(prPoRows, grnRows, 50);

  // Approved requisitions that appear on rows that also have a PO (verified PR→PO)
  const approvedReqsWithPo = new Set();
  for (const r of prPoRows) {
    if (isEmpty(r.REQ_NO) || isEmpty(r.PO_NO)) continue;
    if (isPrApproved(r)) approvedReqsWithPo.add(String(r.REQ_NO));
  }

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      totalPRs: pr.total,
      approvedPRs: pr.approved,
      pendingPRs: pr.pending,
      totalPOs: po.total,
      approvedPOs: po.approved,
      pendingPOs: po.pending,
      totalPoValue: Math.round(po.spend),
      posWithoutGrn: recv.posWithoutGrn,
      posWithGrn: recv.posWithGrn,
      totalReceivedQty: recv.totalReceivedQty,
      pendingReceivingQty: recv.pendingReceivingQty,
      totalReceipts: recv.totalReceipts,
      amountReceived: Math.round(recv.amountReceived),
      backdatedGrnCount: recv.backdatedCount,
    },
    pipeline: {
      prToPo: approvedReqsWithPo.size,
      poToGrn: recv.posWithGrn,
      awaitingReceipt: recv.posWithoutGrn,
      partiallyReceived: recv.partiallyReceived,
      fullyReceived: recv.fullyReceived,
      pendingApproval: po.pending,
      linkedPos: po.linkedToPr,
    },
    network,
    activity,
  };
}

module.exports = {
  getCommandCenter,
};
