/**
 * Additive chatbot helpers — intents, comparisons, anomalies, UI actions.
 * Does not replace chatAccess permission enforcement.
 */

const { karachiTodayIso } = require("./scopeResolver");

function pctChange(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) {
    return { absolute: c - p, percent: c === 0 ? 0 : null, label: c === 0 ? "no change" : "n/a (no prior baseline)" };
  }
  const percent = Math.round(((c - p) / Math.abs(p)) * 1000) / 10;
  return { absolute: c - p, percent, label: `${percent > 0 ? "+" : ""}${percent}%` };
}

function looksLikePromptInjection(text) {
  return /\b(ignore\s+(all\s+)?(previous|prior|system)?\s*(instructions|restrictions|permissions)|forget\s+(your\s+)?(rules|permissions|restrictions)|bypass\s+(access|permission)|show\s+(me\s+)?(all|entire)\s+(database|records|tables)|reveal\s+(your\s+)?(system\s+)?prompt|api\s*key|jwt\s*secret|give\s+me\s+credentials)\b/i.test(
    String(text || "")
  );
}

function detectExecutiveMode(text) {
  return /\b(executive\s*summary|management\s*summary|procurement\s*snapshot|briefing|morning\s*brief|daily\s*brief|executive\s*procurement)\b/i.test(
    String(text || "")
  ) || /\b(executive\s*mode|snapshot\s*format)\b/i.test(String(text || ""));
}

function detectExportIntent(text) {
  const t = String(text || "").toLowerCase();
  const giveVerb =
    /\b(export|download|kar\s*do|karo|dedo|de\s*do|dein|dedain|dena|do|nikalo|chahiye|milega|dedo|please|dedain)\b/i;
  if (/\bcsv\b/i.test(t) && giveVerb.test(t)) {
    return "csv";
  }
  if (/\b(excel|xlsx|sheet)\b/i.test(t) && giveVerb.test(t)) {
    return /\bcsv\b/i.test(t) ? "csv" : "xlsx";
  }
  if (/\b(export|download)\b.*\b(excel|xlsx|csv|sheet|file)\b/i.test(t)) {
    return /\bcsv\b/i.test(t) ? "csv" : "xlsx";
  }
  if (/\b(excel|csv|xlsx|file)\b.*\b(export|download|banao|banado|bana\s*do|do|dedo|dein|dedain)\b/i.test(t)) {
    return /\bcsv\b/i.test(t) ? "csv" : "xlsx";
  }
  if (/\bexcel\s*mein\b/i.test(t) && giveVerb.test(t)) {
    return "xlsx";
  }
  if (/^\s*(export|download)\s*(kar\s*do|karo|please)?\s*$/i.test(t)) {
    return "xlsx";
  }
  // Short follow-ups: "excel do", "excel dedo", "file dedain"
  if (/\b(excel|xlsx|file)\b/i.test(t) && /\b(do|dedo|dein|dedain|dena|dedo)\b/i.test(t)) {
    return "xlsx";
  }
  return null;
}

function mentionsExportRequest(text) {
  return Boolean(detectExportIntent(text));
}

function detectReportExcelIntent(text) {
  const t = String(text || "").toLowerCase();
  if (!/\b(excel|xlsx|csv|sheet|file)\b/i.test(t)) return false;
  if (/\b(share|submit|bhej|signature|remarks|dastakhat|email)\b/i.test(t) && !/\b(excel|file|xlsx)\b/i.test(t)) {
    return false;
  }
  return (
    /\b(report|summary|briefing|snapshot|rport)\b/i.test(t) ||
    /\b(aaj|aj|today)\b.*\b(report|summary)\b/i.test(t) ||
    /\b(report|summary)\b.*\b(aaj|aj|today)\b/i.test(t)
  );
}

function isReportShareOnlyIntent(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return false;
  if (mentionsExportRequest(text) || detectReportExcelIntent(text)) return false;
  return [
    /\bday[\s-]*end\b.*\breport\b/,
    /\breport\b.*\b(share|submit|send|bhej|email)\b/,
    /\b(share|submit|send|bhej)\b.*\breport\b/,
    /\breport\s*(kardo|kar\s*do|share\s*kardo)\b/,
    /\b(aaj|aj|today)\b.*\breport\b.*\b(share|submit|bhej|kardo|kar\s*do)\b/,
    /\baaj\s*ki\s*report\b(?!.*\b(excel|file|xlsx|csv|download|export|do|dedo)\b)/,
  ].some((re) => re.test(t));
}

function detectNavigateIntent(text) {
  const t = String(text || "").toLowerCase();
  if (/\b(open|show|jao|kholo)\b.*\b(po\s*report|po\s*table|audit\s*table|purchase\s*order)\b/i.test(t) || /\bopen\s*po\b/i.test(t)) {
    return { targetId: "audit-table", label: "PO / Audit table" };
  }
  if (/\b(open|show|kholo)\b.*\b(pr\s*(report|dashboard|table)|requisition)\b/i.test(t)) {
    return { targetId: "audit-table", label: "PR / Audit table" };
  }
  if (/\b(open|show|kholo)\b.*\b(grn|receipt)\b/i.test(t)) {
    return { targetId: "grn-table", label: "GRN table" };
  }
  if (/\b(open|show|kholo)\b.*\b(spend|department\s*spend)\b/i.test(t)) {
    return { targetId: "chart-dept-spend", label: "Department spend" };
  }
  if (/\b(open|show|kholo)\b.*\b(approval|approvals)\b/i.test(t)) {
    return { targetId: "chart-approval-status", label: "Approvals" };
  }
  if (/\b(open|show|kholo)\b.*\b(split\s*po)\b/i.test(t)) {
    return { targetId: "split-po-table", label: "Split PO table" };
  }
  return null;
}

function detectFilterSyncFromMessage(text, catalogCompanies = []) {
  const t = String(text || "").toLowerCase();
  const patch = {};

  for (const name of catalogCompanies) {
    const lower = String(name).toLowerCase();
    if (t.includes("procon") && lower.includes("procon")) {
      patch.organization = name;
      break;
    }
    if ((t.includes("master") || t.includes("mel")) && lower.includes("master")) {
      patch.organization = name;
      break;
    }
  }

  if (/\bpending\b|\bpending\s*po\b|\bapprove\s*nahi\b|\bunapproved\b/i.test(t)) {
    patch.approvalStatus = "PENDING";
  } else if (/\bapproved\b|\bapprove\s*ho\b/i.test(t)) {
    patch.approvalStatus = "APPROVED";
  }

  if (/\b(today|aaj|aj)\b/i.test(t) && !/\blast\b|\bpichl/i.test(t)) {
    const today = karachiTodayIso();
    patch.dateFrom = today;
    patch.dateTo = today;
  }

  return Object.keys(patch).length ? patch : null;
}

function suggestFollowUps(text, usedTools = [], replyStyle = "message") {
  const t = String(text || "").toLowerCase();
  const tools = new Set(usedTools || []);
  const tips = [];

  const en = replyStyle === "english";
  if (tools.has("get_kpis") || /\bpending\b|\bkitn[ie]\b.*\bpo\b/i.test(t)) {
    tips.push(en ? "Show me those POs" : "Un POs ki list dikhao");
    tips.push(en ? "Compare with last month" : "Last month se compare karo");
  }
  if (tools.has("list_purchase_orders") || tools.has("list_purchase_requisitions")) {
    tips.push(en ? "Why are these pending?" : "Yeh pending kyun hain?");
    tips.push(en ? "Export to Excel" : "Excel mein export karo");
  }
  if (tools.has("get_procurement_summary") || tools.has("compare_periods") || /\bspend\b/i.test(t)) {
    tips.push(en ? "Which department drove the change?" : "Kis department ne change kiya?");
  }
  if (!tips.length) {
    tips.push(en ? "Give me today's briefing" : "Aaj ki briefing do");
    tips.push(en ? "What can I ask?" : "Main kya pooch sakta hun?");
  }
  return [...new Set(tips)].slice(0, 4);
}

function applyConversationState(mergedFilters, conversationState, message, options = {}) {
  const state = conversationState && typeof conversationState === "object" ? conversationState : {};
  const out = { ...mergedFilters };
  const t = String(message || "").toLowerCase();
  const messageHasDatePhrase = Boolean(options.messageHasDatePhrase);
  const shortFollowUp =
    t.split(/\s+/).filter(Boolean).length <= 10 &&
    (/\b(sirf|only|un|those|these|uska|uski|inke|inke|same|compare|list|dikhao|show|kyun|why|export|excel|csv|download|kar\s*do|karo)\b/i.test(t) ||
      detectExportIntent(message));

  if (shortFollowUp) {
    if (!out.organization && state.organization) out.organization = state.organization;
    if (!out.operatingUnit && state.operatingUnit) out.operatingUnit = state.operatingUnit;
    if (!out.approvalStatus && state.approvalStatus) out.approvalStatus = state.approvalStatus;
    if (!out.department && state.department) out.department = state.department;
    if (!messageHasDatePhrase) {
      if (state.dateFrom) out.dateFrom = state.dateFrom;
      if (state.dateTo) out.dateTo = state.dateTo;
    }
  }
  return out;
}

function buildConversationState(filters = {}, usedTools = [], lastTopic = null) {
  return {
    organization: filters.organization || null,
    operatingUnit: filters.operatingUnit || null,
    department: filters.department || null,
    approvalStatus: filters.approvalStatus || null,
    dateFrom: filters.dateFrom || null,
    dateTo: filters.dateTo || null,
    lastTools: usedTools || [],
    lastTopic: lastTopic || null,
  };
}

function detectSimpleKpiCountQuery(message) {
  return detectKpiMetricQuery(message);
}

/** pending-po | approved-po | po | pr | spend | departments | legal-entities | non-po-spend */
function detectKpiMetricQuery(message) {
  const t = String(message || "").toLowerCase();
  const poTopic = /\b(po|purchase\s*orders?|purchased\s*orders?)\b/i.test(t);
  const prTopic = /\b(pr|requisition|purchase\s*requisition|req)\b/i.test(t);
  const wantsCount =
    /\b(kitni|kitne|kitna|kinti|kinty|kinni|kinney|kitney|how\s*many|count|total|number\s*of|btana|batao|bata\s*do|zara)\b/i.test(
      t
    ) ||
    (/\b(pending|approved)\b/i.test(t) && poTopic && /\b(hain|hai|hein)\b/i.test(t));

  if (/\b(department|departments|section|sections)\b/i.test(t) && wantsCount) {
    return "departments";
  }
  // Company catalog ("kitni companies") is handled separately — do NOT map to date-scoped legal-entities KPI.
  if (/\blegal\s*entit/i.test(t) && wantsCount && !/\b(compare|dono|compani)\b/i.test(t)) {
    return "legal-entities";
  }
  if (/\b(non[\s-]*po|po\s*without\s*pr|without\s*pr)\b/i.test(t) && /\b(spend|amount|kitna|total)\b/i.test(t)) {
    return "non-po-spend";
  }
  if (
    /\b(spend|purchase|kharcha|amount|purchased)\b/i.test(t) &&
    /\b(total|kitna|how\s*much|spend)\b/i.test(t) &&
    !poTopic &&
    !prTopic &&
    !/\b(department|vendor|creator)\b/i.test(t)
  ) {
    return "spend";
  }
  if (/\btotal\s*purchased?\b/i.test(t) || /\bpurchased?\s*kitna\b/i.test(t)) {
    return "spend";
  }

  if (!wantsCount) return null;
  if (/\bpending\b/i.test(t) && poTopic) return "pending-po";
  if (/\bapproved\b/i.test(t) && poTopic) return "approved-po";
  if (prTopic && !poTopic) return "pr";
  if (poTopic) return "po";
  return null;
}

function detectCreatorQuery(message) {
  const t = String(message || "").toLowerCase();
  const creatorWord = /\b(creator|creater|banaya|banaye|create\s*kiya|top)\b/i.test(t);
  const followUp = /^(and|aur|or|bhi)\b/i.test(t.trim());
  if (/\b(pr|requisition)\b/i.test(t) && (creatorWord || followUp || /\bcreater\b/i.test(t))) {
    return "pr";
  }
  if (/\b(po|purchase\s*order)\b/i.test(t) && creatorWord) {
    return "po";
  }
  return null;
}

function detectVendorQuery(message) {
  const t = String(message || "").toLowerCase();
  return /\b(vendor|vendors|supplier|suppliers)\b/i.test(t);
}

/**
 * Company list/count from live API catalog (dynamic — not hardcoded Procon/Master).
 * Returns { mode: "all" | "in-scope" } or null.
 * - all: overall / wasey / hamarey pass / which companies (no explicit day filter)
 * - in-scope: aj / today / explicit from–to range about companies active in that period
 */
function detectCompanyCatalogQuery(message) {
  const t = String(message || "").toLowerCase().trim();
  if (!t) return null;
  if (/\b(compare|dono|both|company\s*wise|group\s*wise)\b/i.test(t)) return null;

  const aboutCompanies =
    /\b(compani(es)?|company|legal\s*entit(?:y|ies)|organizations?)\b/i.test(t) ||
    /\b(kon\s*kon\s*si|kaun\s*kaun\s*si|which)\b.*\b(compani|company|entity)\b/i.test(t);
  if (!aboutCompanies) return null;

  const listingIntent =
    /\b(kitni|kitne|kitna|kinti|kitney|how\s*many|count|total|list|kon\s*kon|kaun\s*kaun|which|names?|btana|batao|check|wasey|overall|hamarey?\s*pass|hamare\s*pass)\b/i.test(
      t
    ) || /\bcompani(es)?\s*hain\b/i.test(t);
  if (!listingIntent) return null;

  const wantsPeriodActivity =
    /\b(aaj|aj|today|yesterday|kal)\b/i.test(t) ||
    /\b(se|say|from|between|le\s*kar|lekra)\b.+\b(ab\s*tak|until|till|to\s*date|today|ab)\b/i.test(t) ||
    /\b(1\s*(st)?\s*(jan|january|aug|august)|january|august)\b/i.test(t);

  // Explicit period → companies with data in that scope; otherwise full live API catalog
  if (wantsPeriodActivity && !/\b(overall|wasey|wasay|hamarey?\s*pass|hamare\s*pass)\b/i.test(t)) {
    return { mode: "in-scope" };
  }
  return { mode: "all" };
}

function formatCompanyCatalogReply({ companies, mode, filters, userName, replyStyle, asClause = false }) {
  const names = (companies || []).map((c) => String(c || "").trim()).filter(Boolean);
  const n = names.length;
  const list = names.join(", ");
  const scope = formatScopeLabel(filters);

  // Compact clause when this is the 2nd part of a combined answer (PR + companies, etc.)
  if (asClause) {
    if (replyStyle === "english") {
      return n
        ? mode === "in-scope"
          ? `Companies with data for ${scope} (${n}): ${list}.`
          : `Companies overall (${n}): ${list}.`
        : mode === "in-scope"
          ? `No companies have data for ${scope}.`
          : `No companies are available in live data yet.`;
    }
    if (replyStyle === "punjabi") {
      return n
        ? mode === "in-scope"
          ? `Companies (${n}) ${scope} te: ${list}.`
          : `Overall companies (${n}): ${list}.`
        : `Kisi company da data nahi ae.`;
    }
    if (replyStyle === "urdu_script") {
      return n
        ? mode === "in-scope"
          ? `${scope} پر کمپنیاں (${n}): ${list}۔`
          : `Overall کمپنیاں (${n}): ${list}۔`
        : `کسی کمپنی کا ڈیٹا نہیں۔`;
    }
    return n
      ? mode === "in-scope"
        ? `Companies (${n}) ${scope} par: ${list}.`
        : `Overall companies (${n}): ${list}.`
      : `Kisi company ka data nahi hai.`;
  }

  if (replyStyle === "english") {
    if (mode === "in-scope") {
      return n
        ? `${userName}, for ${scope} there ${n === 1 ? "is" : "are"} ${n} compan${n === 1 ? "y" : "ies"} with data: ${list}.`
        : `${userName}, no companies have data for ${scope}.`;
    }
    return n
      ? `${userName}, overall we have data for ${n} compan${n === 1 ? "y" : "ies"}: ${list}.`
      : `${userName}, no companies are available in live data yet.`;
  }
  if (replyStyle === "punjabi") {
    if (mode === "in-scope") {
      return n
        ? `${userName}, ${scope} te ${n} companies da data ae: ${list}.`
        : `${userName}, ${scope} te kisi company da data nahi ae.`;
    }
    return n
      ? `${userName}, overall sade kol ${n} companies da data ae: ${list}.`
      : `${userName}, hun live data wich koi company nahi ae.`;
  }
  if (replyStyle === "urdu_script") {
    if (mode === "in-scope") {
      return n
        ? `${userName}، ${scope} پر ${n} کمپنیوں کا ڈیٹا ہے: ${list}۔`
        : `${userName}، ${scope} پر کسی کمپنی کا ڈیٹا نہیں۔`;
    }
    return n
      ? `${userName}، overall ہمارے پاس ${n} کمپنیوں کا ڈیٹا ہے: ${list}۔`
      : `${userName}، live ڈیٹا میں ابھی کوئی کمپنی نہیں۔`;
  }
  if (mode === "in-scope") {
    return n
      ? `${userName}, ${scope} par ${n} compan${n === 1 ? "y" : "ies"} ka data hai: ${list}.`
      : `${userName}, ${scope} par kisi company ka data nahi hai.`;
  }
  return n
    ? `${userName}, overall hamare pass ${n} compan${n === 1 ? "y" : "ies"} ka data hai: ${list}.`
    : `${userName}, live data mein abhi koi company nahi hai.`;
}

/** Join multiple fast-path answers into one reply (compound questions). */
function joinFastReplies(parts) {
  const cleaned = (parts || []).map((p) => String(p || "").trim()).filter(Boolean);
  if (!cleaned.length) return "";
  if (cleaned.length === 1) return cleaned[0];
  return cleaned.join(" ");
}

function formatMoneyPkr(n) {
  const v = Math.round(Number(n) || 0);
  return `${v.toLocaleString("en-IN")} PKR`;
}

function formatKpiMetricReply({ metric, kpis, filters, userName, replyStyle }) {
  const scope = formatScopeLabel(filters);
  const scopeMeta = kpis?.scope || {};
  let company =
    scopeMeta.company && scopeMeta.company !== "All companies (group)"
      ? String(scopeMeta.company)
      : filters.organization
        ? String(filters.organization).split(",")[0].trim()
        : null;
  const companyBit = company ? `${company} mein ` : "";

  if (metric === "spend") {
    const n = Number(kpis.totalSpendPkr ?? kpis.totalSpend) || 0;
    if (replyStyle === "english") {
      return `${userName}, total purchase / spend for ${scope}${company ? ` (${company})` : ""} is ${formatMoneyPkr(n)}.`;
    }
    return `${userName}, ${scope} par ${companyBit}total purchase ${formatMoneyPkr(n)} hai.`;
  }

  if (metric === "non-po-spend") {
    const n = Number(kpis.nonPoSpendPkr ?? kpis.nonPoSpend) || 0;
    if (replyStyle === "english") {
      return `${userName}, PO-without-PR (non-PO) spend for ${scope} is ${formatMoneyPkr(n)}.`;
    }
    return `${userName}, ${scope} par ${companyBit}PO without PR spend ${formatMoneyPkr(n)} hai.`;
  }

  if (metric === "departments") {
    const n = Number(kpis.totalDepartments) || (kpis.departments || []).length || 0;
    const names = (kpis.departments || []).map((d) => d.department || d).filter(Boolean);
    const nameBit = names.length ? ` — ${names.slice(0, 8).join(", ")}${names.length > 8 ? "…" : ""}` : "";
    if (replyStyle === "english") {
      return `${userName}, there ${n === 1 ? "is" : "are"} ${n} department${n === 1 ? "" : "s"} / section${n === 1 ? "" : "s"} for ${scope}${company ? ` (${company})` : ""}${nameBit}.`;
    }
    return `${userName}, ${scope} par ${companyBit}${n} department / section hain${nameBit}.`;
  }

  if (metric === "legal-entities") {
    const n = Number(kpis.totalLegalEntities) || 0;
    if (replyStyle === "english") {
      return `${userName}, there ${n === 1 ? "is" : "are"} ${n} legal entit${n === 1 ? "y" : "ies"} live for ${scope}.`;
    }
    return `${userName}, ${scope} par ${n} legal entit${n === 1 ? "y" : "ies"} hain.`;
  }

  const pick = () => {
    switch (metric) {
      case "pending-po":
        return Number(kpis.pendingPurchaseOrders) || 0;
      case "approved-po":
        return Number(kpis.approvedPurchaseOrders) || 0;
      case "pr":
        return Number(kpis.totalPurchaseRequisitions) || 0;
      default:
        return Number(kpis.totalPurchaseOrders) || 0;
    }
  };

  const n = pick();
  const labels = {
    "pending-po": "pending purchase order",
    "approved-po": "approved purchase order",
    pr: "PR",
    po: "PO",
  };
  const label = labels[metric] || "PO";

  if (metric === "pending-po") {
    if (replyStyle === "english") {
      if (n === 0) {
        return `${userName}, there are no pending purchase orders for ${scope}${company ? ` (${company})` : ""}. All POs are approved.`;
      }
      return `${userName}, there ${n === 1 ? "is" : "are"} ${n} pending purchase order${n === 1 ? "" : "s"} for ${scope}${company ? ` (${company})` : ""}.`;
    }
    if (replyStyle === "urdu_script") {
      return n === 0
        ? `${userName}، ${scope} پر ${company || "اس scope"} میں کوئی pending PO نہیں — سب approved ہیں۔`
        : `${userName}، ${scope} پر ${company || "اس scope"} میں ${n} pending PO ہیں۔`;
    }
    if (n === 0) {
      return `${userName}, ${scope} par ${companyBit}koi pending purchase order nahi — sab approved hain.`;
    }
    return `${userName}, ${scope} par ${companyBit}${n} pending purchase order${n === 1 ? "" : "s"} hain.`;
  }

  if (replyStyle === "english") {
    return `${userName}, there ${n === 1 ? "is" : "are"} ${n} ${label}${n === 1 ? "" : "s"} for ${scope}${company ? ` (${company})` : ""}.`;
  }
  if (replyStyle === "urdu_script") {
    return `${userName}، ${scope} پر ${n} ${label} ہیں۔`;
  }
  return `${userName}, ${scope} par ${companyBit}${n} ${label}${n === 1 ? "" : "s"} hain.`;
}

function formatCreatorReply({ kind, creators, filters, userName, replyStyle }) {
  const scope = formatScopeLabel(filters);
  const top = (creators || [])[0];
  const label = kind === "pr" ? "PR" : "PO";
  if (!top) {
    return replyStyle === "english"
      ? `${userName}, no ${label} creators found for ${scope}.`
      : `${userName}, ${scope} par koi ${label} creator nahi mila.`;
  }
  const name = top.name || top.key || "Unknown";
  const count = top.value ?? top.count ?? 0;
  if (replyStyle === "english") {
    return `${userName}, top ${label} creator for ${scope} is ${name} with ${count} ${label}${count === 1 ? "" : "s"}.`;
  }
  return `${userName}, ${scope} par top ${label} creator ${name} hain — ${count} ${label}${count === 1 ? "" : "s"}.`;
}

function formatVendorReply({ vendors, filters, userName, replyStyle }) {
  const scope = formatScopeLabel(filters);
  const list = vendors || [];
  if (!list.length) {
    return replyStyle === "english"
      ? `${userName}, no vendors found for ${scope}.`
      : `${userName}, ${scope} par koi vendor nahi mila.`;
  }
  const lines = list.slice(0, 8).map((v, i) => {
    const name = v.vendorName || v.vendor || "Unknown";
    const spend = formatMoneyPkr(v.spend || v.amountPkr || 0);
    const poBit = v.poCount != null ? ` · ${v.poCount} PO` : v.poNo ? ` · PO ${v.poNo}` : "";
    return `${i + 1}. ${name} — ${spend}${poBit}`;
  });
  if (replyStyle === "english") {
    return `${userName}, vendors for ${scope} (${list.length}):\n${lines.join("\n")}`;
  }
  return `${userName}, ${scope} ke vendors (${list.length}):\n${lines.join("\n")}`;
}

function replyMisstatesPendingCount(reply, pendingCount) {
  const r = String(reply || "").toLowerCase();
  const n = Number(pendingCount) || 0;
  if (n > 0) {
    return /\b(koi pending nahi|no pending|none pending|zero pending|0 pending|sab approved|all approved|sab approve|all approve|khali hain|dono khali)\b/i.test(
      r
    );
  }
  if (n === 0) {
    return /\b(\d+\s*pending|[1-9]\d*\s*po.*pending|teen pending|char pending)\b/i.test(r);
  }
  return false;
}

function formatScopeLabel(filters = {}) {
  const from = filters.dateFrom;
  const to = filters.dateTo;
  if (from && to && from === to) return from;
  if (from && to) return `${from} se ${to}`;
  if (from) return `from ${from}`;
  return "current filters";
}

function formatKpiCountReply({ kind, count, filters, userName, replyStyle }) {
  const scope = formatScopeLabel(filters);
  const label = kind === "pr" ? "PR" : "PO";
  const n = Number(count) || 0;
  if (replyStyle === "english") {
    return `${userName}, there ${n === 1 ? "is" : "are"} ${n} ${label}${n === 1 ? "" : "s"} for ${scope}.`;
  }
  if (replyStyle === "urdu_script") {
    return `${userName}، ${scope} پر ${n} ${label} ہیں۔`;
  }
  return `${userName}, ${scope} par ${n} ${label} hain.`;
}

function exportReplyForStyle(replyStyle, format, userName) {
  const ext = format === "csv" ? "CSV" : "Excel";
  if (replyStyle === "english") {
    return `Done ${userName} — ${ext} download should start now in your browser (check the Downloads folder). Same scope as your last question.`;
  }
  if (replyStyle === "urdu_script") {
    return `ٹھیک ہے ${userName} — ${ext} فائل براؤزر میں ڈاؤن لوڈ ہو گئی (Downloads folder دیکھیں)۔ پچھلے سوال والا scope استعمال کیا گیا۔`;
  }
  return `Theek hai ${userName} — ${ext} file browser mein download ho gayi (Downloads folder check karein). Pichle sawaal wale filters use kiye. Koi link ya email nahi — seedha download.`;
}

function inferExportDomain(message, history = [], conversationState = {}) {
  if (detectReportExcelIntent(message)) return "summary";
  const recent = [
    String(message || ""),
    ...(Array.isArray(history) ? history.slice(-6).map((m) => m.content) : []),
  ]
    .join(" ")
    .toLowerCase();
  const tools = conversationState?.lastTools || [];
  if (tools.includes("list_purchase_requisitions")) return "pr";
  if (tools.includes("list_purchase_orders")) return "po";
  if (tools.includes("get_kpis") || tools.includes("get_procurement_summary") || tools.includes("get_audit_snapshot")) {
    return "summary";
  }
  if (/\b(pr|requisition|req)\b/i.test(recent) && !/\b(po|purchase\s*order)\b/i.test(String(message || ""))) {
    return "pr";
  }
  if (conversationState?.lastTopic === "pr") return "pr";
  if (conversationState?.lastTopic === "po") return "po";
  if (/\b(report|summary|briefing|spend|department)\b/i.test(recent)) return "summary";
  return "table";
}

function exportEligibleFromContext(uniqueTools = [], conversationState = {}, history = [], message = "") {
  const listTools = [
    "list_purchase_orders",
    "list_purchase_requisitions",
    "search_procurement",
    "get_kpis",
    "get_procurement_summary",
    "get_audit_snapshot",
    "export_rows",
  ];
  if (uniqueTools.some((t) => listTools.includes(t))) return true;
  if ((conversationState?.lastTools || []).some((t) => listTools.includes(t))) return true;
  if (detectExportIntent(message) || detectReportExcelIntent(message)) return true;
  const recent = (history || []).slice(-6).map((m) => m.content).join(" ").toLowerCase();
  return /\b(pr|po|requisition|purchase|pending|list|kitni|kitne|report|summary|spend)\b/i.test(recent);
}

function kpiResultToSummaryRows(kpi, filters = {}) {
  if (!kpi || kpi.denied) return [];
  const scope = formatScopeLabel(filters);
  const rows = [];
  const add = (metric, value) => {
    if (value == null) return;
    rows.push({ Scope: scope, Metric: metric, Value: value });
  };
  add("Organization", filters.organization || "All");
  add("Date From", filters.dateFrom || "");
  add("Date To", filters.dateTo || "");
  add("Total PRs", kpi.totalPurchaseRequisitions);
  add("Total POs", kpi.totalPurchaseOrders);
  add("Approved POs", kpi.approvedPurchaseOrders);
  add("Pending POs", kpi.pendingPurchaseOrders);
  add("Approval Rate %", kpi.approvalRate);
  add("Total Spend PKR", kpi.totalSpendPkr ?? kpi.totalSpend);
  add("Non-PO Spend PKR", kpi.nonPoSpendPkr ?? kpi.nonPoSpend);
  if (kpi.highestSpendDepartment?.name) {
    add("Top Department", kpi.highestSpendDepartment.name);
    add("Top Department Spend PKR", kpi.highestSpendDepartment.spend);
  }
  return rows;
}

function detectExportRetryIntent(text) {
  const t = String(text || "").toLowerCase();
  return (
    /\b(kaha|kahan|where|kidhar|nahi\s+mili|nahi\s+aayi|nahi\s+ayi|link|wait|intezaar)\b/i.test(t) &&
    /\b(excel|file|download|export)\b/i.test(t)
  );
}

function fuzzyHint(text) {
  const t = String(text || "").toLowerCase();
  const hints = [];
  if (/\bspand\b|\bspendd\b|\bexpenditu?re\b/i.test(t)) hints.push("Interpreted likely intent: spend");
  if (/\bpendng\b|\bpendin\b|\bpanding\b/i.test(t)) hints.push("Interpreted likely intent: pending");
  if (/\bprocon\b|\bprokon\b|\bprocan\b/i.test(t)) hints.push("Company alias: Procon");
  if (/\bmaster\b|\bmel\b/i.test(t)) hints.push("Company alias: Master Enterprises");
  return hints;
}

async function writeChatAuditLog({ userId, message, intent, filters, permissions, refused, usedTools, resultCount, ip }) {
  try {
    const { query } = require("../config/db");
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json, ip_address)
       VALUES (?, 'chat_ask', 'chat', ?, JSON_OBJECT(
         'intent', ?,
         'refused', ?,
         'tools', ?,
         'org', ?,
         'dateFrom', ?,
         'dateTo', ?,
         'resultCount', ?,
         'permissionCount', ?
       ), ?)`,
      [
        userId || null,
        String(userId || "anon"),
        String(intent || "ask").slice(0, 80),
        refused ? 1 : 0,
        JSON.stringify(usedTools || []).slice(0, 500),
        filters?.organization || null,
        filters?.dateFrom || null,
        filters?.dateTo || null,
        resultCount == null ? null : Number(resultCount),
        Array.isArray(permissions) ? permissions.length : 0,
        ip || null,
      ]
    );
  } catch (err) {
    console.warn("[chat audit]", err.message);
  }
}

module.exports = {
  pctChange,
  looksLikePromptInjection,
  detectExecutiveMode,
  detectExportIntent,
  mentionsExportRequest,
  detectReportExcelIntent,
  isReportShareOnlyIntent,
  detectNavigateIntent,
  detectFilterSyncFromMessage,
  suggestFollowUps,
  applyConversationState,
  buildConversationState,
  detectSimpleKpiCountQuery,
  detectKpiMetricQuery,
  detectCreatorQuery,
  detectVendorQuery,
  detectCompanyCatalogQuery,
  formatCompanyCatalogReply,
  joinFastReplies,
  formatKpiMetricReply,
  formatCreatorReply,
  formatVendorReply,
  replyMisstatesPendingCount,
  formatKpiCountReply,
  formatScopeLabel,
  exportReplyForStyle,
  inferExportDomain,
  exportEligibleFromContext,
  kpiResultToSummaryRows,
  detectExportRetryIntent,
  fuzzyHint,
  writeChatAuditLog,
};
