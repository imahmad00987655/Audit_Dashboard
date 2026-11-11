/**
 * Low-cost OpenAI chat — tool calling only; scoped by user dashboard permissions.
 */
const OpenAI = require("openai");
const { TOOL_DEFINITIONS, runTool } = require("./tools");
const { resolveScopeFromMessage, karachiTodayIso } = require("./scopeResolver");
const { trySmallTalk } = require("./smallTalk");
const {
  canUseChatbot,
  canUseTool,
  filterToolsByPermissions,
  filterToolResult,
  describeAllowedTopics,
  detectDisallowedTopic,
  POLITE_REFUSAL,
} = require("./chatAccess");
const { embedText, saveChatQuery, findSimilarQueries } = require("./chatMemoryService");
const { detectReplyStyle, languageInstruction, politeRefusalForStyle, languageLockTag, replyMismatchesStyle, emptyDataFallback } = require("./replyStyle");
const {
  detectKpiMetricQuery,
  detectCreatorQuery,
  detectVendorQuery,
  detectCompanyCatalogQuery,
  formatKpiMetricReply,
  formatCreatorReply,
  formatVendorReply,
  formatCompanyCatalogReply,
  joinFastReplies,
  replyMisstatesPendingCount,
} = require("./chatEnhancements");

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_HISTORY = 6;
const MAX_TOOL_ROUNDS = 4;

function isReportShareIntent(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return false;
  return [
    /\bday[\s-]*end\b.*\breport\b/,
    /\breport\b.*\b(share|submit|send|bhej|email)\b/,
    /\b(share|submit|send|bhej)\b.*\breport\b/,
    /\breport\s*(kardo|kar\s*do|share\s*kardo)\b/,
    /\b(aaj|aj|today)\b.*\breport\b/,
    /\baaj\s*ki\s*report\b/,
  ].some((re) => re.test(t));
}

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }
  return new OpenAI({ apiKey: key });
}

function formatCompanyList(catalog) {
  return catalog
    .map((c) => `- ${c.canonicalName} (aliases: ${c.aliases.slice(0, 4).join(", ")})`)
    .join("\n");
}

function systemPrompt(filters, context = {}) {
  const {
    catalog = [],
    detectedScope = {},
    today,
    groupComparison,
    allowedTopics = "",
    memoryHints = [],
    role,
    userName = "",
    replyStyle = "message",
    refusalLine = "",
  } = context;

  const filterHint =
    filters && Object.keys(filters).length
      ? `Active dashboard filters: ${JSON.stringify(filters)}`
      : "No dashboard filters active.";

  const detectedHint = Object.keys(detectedScope).length
    ? `Auto-detected from user message (use unless user overrides): ${JSON.stringify(detectedScope)}`
    : "";

  const memoryBlock =
    memoryHints.length > 0
      ? [
          "",
          "Similar past Q&A from THIS user only (facts/tone hints). Do NOT copy their language — follow LANGUAGE LOCK for the latest message:",
          "Do NOT copy numbers or facts from memory — always use fresh tool results for counts.",
          ...memoryHints.map(
            (m, i) =>
              `${i + 1}. Q: ${String(m.userMessage).slice(0, 180)} → A: ${String(m.assistantReply || "").slice(0, 220)}`
          ),
        ]
      : [];

  const greetName = userName || "colleague";

  return [
    "You are a friendly senior Internal Audit colleague at Master Group — helpful, warm, and professional.",
    "Mirror the user's language and chat style exactly for every reply.",
    "",
    languageInstruction(replyStyle),
    "",
    `Logged-in user first name: ${greetName}`,
    role === "admin" || String(role).toLowerCase() === "admin"
      ? "- THIS USER IS ADMIN with FULL access to every dashboard topic. NEVER refuse. NEVER say 'assigned access'. Always use tools and answer."
      : `- Address them casually by name sometimes — in THEIR language style.`,
    "- On greetings: greet back in the same language/style + their name.",
    "",
    "Personality & tone:",
    "- Sound human; short opener then answer.",
    "- Avoid stiff labels like 'Scope:', 'Findings:', 'KPI Summary:' unless user asked for a formal report.",
    "- Numbers must come ONLY from tool results — never guess.",
    "- If get_kpis returns totalDepartments / departments / totalSpendPkr, use those exact numbers.",
    "- Never say departments are empty if totalDepartments > 0.",
    "- If user says 'guide' about PO/PR/spend/GRN/vendor/department, they want DATA help — call tools, do not refuse.",
    "- Short follow-ups like 'and pr creator' or 'sirf aaj ka' continue the SAME topic with SAME date scope.",
    "- Explain briefly what numbers mean in plain language in the SAME language as the user.",
    "- Never say 'As an AI', 'I am a language model', or list tool names in the reply.",
    "",
    "ACCESS CONTROL (critical):",
    role === "admin" || String(role).toLowerCase() === "admin"
      ? "- Admin: ignore permission limits. Answer all procurement questions with tools."
      : [
          "- This user may only discuss topics they are granted on the Admin panel.",
          "- Allowed topics for this user:",
          allowedTopics || "- (none)",
          "- If the user asks about anything outside allowed topics, do NOT call tools and do NOT invent data.",
          `- Reply ONLY with this polite refusal (already in correct language): "${refusalLine || POLITE_REFUSAL}"`,
          "- Do not explain permissions systems, roles, or how to get access. Story ends after the polite line.",
        ].join("\n"),
    "",
    "Companies in live data (ALWAYS use this list — it updates when API adds companies; never hardcode only Procon/Master):",
    formatCompanyList(catalog) || "- Load via list_companies_and_units",
    "",
    "Tools (internal — user ko mat batana; only tools available in this request are allowed):",
    "- Report / summary → get_audit_snapshot (only if available)",
    "- Overall / kitni companies / kon kon si companies → list_companies_and_units (use companies = full catalog)",
    "- Dono companies compare → get_group_comparison",
    "- Single number → get_kpis or get_grn_summary",
    "- PO numbers → list_purchase_orders",
    "- PR numbers → list_purchase_requisitions",
    "- If user asks to share/submit today's day-end report: do NOT invent success — the UI will open remarks+signature form.",
    "",
    "Scope:",
    `- Aaj ki date (Karachi): ${today || karachiTodayIso()}`,
    "- Company aliases come from live data; dates auto-detect from the message and OVERRIDE dashboard date filters.",
    "- For 'overall / wasey / hamarey pass kitni companies' use FULL catalog (all dates), not today's active subset.",
    groupComparison ? "- User wants company comparison — use get_group_comparison if allowed." : "",
    ...memoryBlock,
    "",
    "Greetings & thanks: warm, short, human — same language as user — no tools.",
    "Off-topic: politely redirect in the SAME language — say you help with procurement/audit questions.",
    "NOT off-topic: hello, salam, shukriya, help.",
  ]
    .filter(Boolean)
    .join("\n")
    .concat("\n\n", filterHint, detectedHint ? `\n${detectedHint}` : "");
}

function normalizeHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

async function persistQuery(payload) {
  try {
    await saveChatQuery(payload);
  } catch (err) {
    console.warn("[chat persist]", err.message);
  }
}

async function askAuditBot({ message, filters = {}, history = [], user = null }) {
  const text = String(message || "").trim();
  if (!text) {
    throw new Error("Message is required.");
  }
  if (text.length > 1500) {
    throw new Error("Message is too long (max 1500 characters).");
  }

  const permissions = user?.permissions || [];
  const role = user?.role || "user";
  const userId = user?.id;
  const rawName = String(user?.fullName || "").trim();
  const userName =
    !rawName || /^system$/i.test(rawName.split(/\s+/)[0])
      ? String(user?.username || "dost").trim().split(/\s+/)[0]
      : rawName.split(/\s+/)[0];
  const userNameTitle = (userName || "dost").charAt(0).toUpperCase() + (userName || "dost").slice(1);
  const replyStyle = detectReplyStyle(text);
  const refusalLine = politeRefusalForStyle(replyStyle);
  const adminUser = String(role || "").toLowerCase() === "admin";

  if (!canUseChatbot(user)) {
    const reply = refusalLine;
    const embedding = await embedText(text);
    await persistQuery({
      userId,
      userMessage: text,
      assistantReply: reply,
      usedTools: [],
      filters,
      permissions,
      refused: true,
      embedding,
    });
    return { reply, usedTools: [], model: MODEL, refused: true, replyStyle };
  }

  if (isReportShareIntent(text)) {
    const canReport =
      adminUser || (permissions || []).includes("feature-day-end-report");
    let reply;
    if (!canReport) {
      reply = refusalLine;
    } else if (replyStyle === "english") {
      reply = `Okay ${userNameTitle} — let's share today's report. Add remarks and your signature in the chat, then tap Share.`;
    } else if (replyStyle === "punjabi") {
      reply = `Theek ae ${userNameTitle} — ajj di report share karde aan. Chat vich remarks te signature paa lao, phir Share dabao.`;
    } else if (replyStyle === "urdu_script") {
      reply = `ٹھیک ہے ${userNameTitle} — آج کی رپورٹ شیئر کرتے ہیں۔ چیٹ میں remarks اور دستخط شامل کریں، پھر Share دبائیں۔`;
    } else {
      reply = `Theek hai ${userNameTitle} — aaj ki report share karte hain. Chat mein remarks aur signature add karein, phir Share dabayein.`;
    }
    const embedding = await embedText(text);
    await persistQuery({
      userId,
      userMessage: text,
      assistantReply: reply,
      usedTools: [],
      filters,
      permissions,
      refused: !canReport,
      embedding,
    });
    return {
      reply,
      usedTools: [],
      model: MODEL,
      refused: !canReport,
      action: canReport ? "share_day_end_report" : null,
      replyStyle,
    };
  }

  // Resolve live company catalog early (greetings + company questions need it).
  let scopeContext;
  try {
    scopeContext = await resolveScopeFromMessage(text, filters);
  } catch (err) {
    console.warn("[chat scope]", err.message);
    scopeContext = { scope: { ...filters }, catalog: [], groupComparison: false, today: karachiTodayIso() };
  }
  const companyNames = (scopeContext.catalog || []).map((c) => c.canonicalName).filter(Boolean);

  const smallTalkReply = trySmallTalk(text, userNameTitle, replyStyle, {
    permissions,
    role,
    allowedTopics: describeAllowedTopics(permissions, role),
    companyNames,
  });
  if (smallTalkReply) {
    const embedding = await embedText(text);
    await persistQuery({
      userId,
      userMessage: text,
      assistantReply: smallTalkReply,
      usedTools: [],
      filters,
      permissions,
      refused: false,
      embedding,
    });
    return {
      reply: smallTalkReply,
      usedTools: [],
      model: MODEL,
      refused: false,
      replyStyle,
    };
  }

  const blockedTopic = detectDisallowedTopic(text, permissions, role);
  if (blockedTopic) {
    const embedding = await embedText(text);
    await persistQuery({
      userId,
      userMessage: text,
      assistantReply: refusalLine,
      usedTools: [],
      filters,
      permissions,
      refused: true,
      embedding,
    });
    return { reply: refusalLine, usedTools: [], model: MODEL, refused: true, replyStyle };
  }

  const embedding = await embedText(text);
  let memoryHints = [];
  if (userId && embedding) {
    try {
      memoryHints = await findSimilarQueries(userId, embedding, { limit: 3 });
    } catch (err) {
      console.warn("[chat memory retrieve]", err.message);
    }
  }

  const mergedFilters = { ...filters, ...scopeContext.scope };
  const allowedTools = filterToolsByPermissions(TOOL_DEFINITIONS, permissions, role);
  const allowedTopics = describeAllowedTopics(permissions, role);

  const companyCatalogQ = detectCompanyCatalogQuery(text);
  const kpiMetric = detectKpiMetricQuery(text);
  const creatorKind = detectCreatorQuery(text);
  const vendorAsked = detectVendorQuery(text);

  // Compound questions (e.g. "how many PR today and also tell me the companies") —
  // gather every matching fast-path and join into one reply instead of answering only the first.
  const compoundParts = [];
  const compoundTools = [];

  if (kpiMetric && (adminUser || canUseTool("get_kpis", permissions, role))) {
    try {
      const kpiResult = filterToolResult(
        "get_kpis",
        await runTool("get_kpis", {}, mergedFilters),
        permissions,
        role
      );
      if (kpiResult && !kpiResult.denied && !kpiResult.error) {
        compoundParts.push(
          formatKpiMetricReply({
            metric: kpiMetric,
            kpis: kpiResult,
            filters: mergedFilters,
            userName: userNameTitle,
            replyStyle,
          })
        );
        compoundTools.push("get_kpis");
      }
    } catch (err) {
      console.warn("[chat kpi fast-path]", err.message);
    }
  }

  if (companyCatalogQ && (adminUser || canUseTool("list_companies_and_units", permissions, role))) {
    try {
      const toolFilters =
        companyCatalogQ.mode === "all"
          ? {
              ...(mergedFilters.organization ? { organization: mergedFilters.organization } : {}),
              ...(mergedFilters.operatingUnit ? { operatingUnit: mergedFilters.operatingUnit } : {}),
            }
          : mergedFilters;
      const catalogResult = filterToolResult(
        "list_companies_and_units",
        await runTool("list_companies_and_units", {}, toolFilters),
        permissions,
        role
      );
      if (catalogResult && !catalogResult.denied && !catalogResult.error) {
        const companies =
          companyCatalogQ.mode === "all"
            ? catalogResult.companies || companyNames
            : catalogResult.companiesInScope || catalogResult.companies || [];
        const asClause = compoundParts.length > 0;
        compoundParts.push(
          formatCompanyCatalogReply({
            companies,
            mode: companyCatalogQ.mode,
            filters: companyCatalogQ.mode === "all" ? {} : mergedFilters,
            userName: userNameTitle,
            replyStyle,
            asClause,
          })
        );
        compoundTools.push("list_companies_and_units");
      }
    } catch (err) {
      console.warn("[chat company catalog fast-path]", err.message);
    }
  }

  if (creatorKind && (adminUser || canUseTool("get_top_creators", permissions, role))) {
    try {
      const creatorResult = filterToolResult(
        "get_top_creators",
        await runTool("get_top_creators", { kind: creatorKind, limit: 5 }, mergedFilters),
        permissions,
        role
      );
      if (creatorResult && !creatorResult.denied && !creatorResult.error) {
        compoundParts.push(
          formatCreatorReply({
            kind: creatorKind,
            creators: creatorResult.creators || [],
            filters: mergedFilters,
            userName: userNameTitle,
            replyStyle,
          })
        );
        compoundTools.push("get_top_creators");
      }
    } catch (err) {
      console.warn("[chat creator fast-path]", err.message);
    }
  }

  if (vendorAsked && (adminUser || canUseTool("get_vendors", permissions, role))) {
    // Only take vendor fast-path alone when no KPI/company already answered —
    // or when message is clearly about vendors (avoid eating compound PR+company).
    const vendorOnly = !kpiMetric && !companyCatalogQ && !creatorKind;
    if (vendorOnly || /\b(vendor|vendors|supplier)\b/i.test(text)) {
      try {
        const vendorResult = filterToolResult(
          "get_vendors",
          await runTool("get_vendors", { limit: 10 }, mergedFilters),
          permissions,
          role
        );
        if (vendorResult && !vendorResult.denied && !vendorResult.error) {
          // Skip vendor if this was a pure KPI/company compound without vendor words
          if (/\b(vendor|vendors|supplier)\b/i.test(text)) {
            compoundParts.push(
              formatVendorReply({
                vendors: vendorResult.vendors || [],
                filters: mergedFilters,
                userName: userNameTitle,
                replyStyle,
              })
            );
            compoundTools.push("get_vendors");
          }
        }
      } catch (err) {
        console.warn("[chat vendor fast-path]", err.message);
      }
    }
  }

  if (compoundParts.length) {
    const fastReply = joinFastReplies(compoundParts);
    await persistQuery({
      userId,
      userMessage: text,
      assistantReply: fastReply,
      usedTools: compoundTools,
      filters: mergedFilters,
      permissions,
      refused: false,
      embedding,
    });
    return {
      reply: fastReply,
      usedTools: compoundTools,
      model: MODEL,
      refused: false,
      replyStyle,
    };
  }

  if (!allowedTools.length) {
    const reply = refusalLine;
    await persistQuery({
      userId,
      userMessage: text,
      assistantReply: reply,
      usedTools: [],
      filters: mergedFilters,
      permissions,
      refused: true,
      embedding,
    });
    return { reply, usedTools: [], model: MODEL, refused: true, replyStyle };
  }

  const client = getClient();
  const usedTools = [];
  let refused = false;
  let lastKpiResult = null;
  const messages = [
    {
      role: "system",
      content: systemPrompt(filters, {
        catalog: scopeContext.catalog,
        detectedScope: scopeContext.scope,
        today: scopeContext.today,
        groupComparison: scopeContext.groupComparison,
        allowedTopics,
        memoryHints,
        role,
        userName: userNameTitle,
        replyStyle,
        refusalLine,
      }),
    },
    ...normalizeHistory(history),
    {
      role: "user",
      content: `${languageLockTag(replyStyle)}\n\n${text}`,
    },
  ];

  let reply = "";
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      max_tokens: 650,
      messages,
      tools: allowedTools,
      tool_choice: "auto",
    });

    const choice = completion.choices?.[0];
    const assistantMessage = choice?.message;
    if (!assistantMessage) {
      throw new Error("No response from OpenAI.");
    }

    messages.push(assistantMessage);

    const toolCalls = assistantMessage.tool_calls;
    if (!toolCalls?.length) {
      reply = String(assistantMessage.content || "").trim();
      break;
    }

    for (const call of toolCalls) {
      const name = call.function?.name;
      let args = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}");
      } catch {
        args = {};
      }
      usedTools.push(name);

      let result;
      if (!canUseTool(name, permissions, role)) {
        refused = true;
        result = { denied: true, message: refusalLine };
      } else {
        try {
          result = await runTool(name, args, mergedFilters);
          result = filterToolResult(name, result, permissions, role);
          if (name === "get_kpis" && result && !result.denied && !result.error) {
            lastKpiResult = result;
          }
          if (result?.denied) {
            refused = true;
            result = { ...result, message: result.message || refusalLine };
          }
        } catch (err) {
          result = { error: err.message || "Tool failed" };
        }
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 12000),
      });
    }
  }

  if (!reply) {
    messages.push({
      role: "system",
      content: languageInstruction(replyStyle),
    });
    const final = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 650,
      messages,
    });
    reply = String(final.choices?.[0]?.message?.content || "").trim();
  }

  if (
    lastKpiResult &&
    replyMisstatesPendingCount(reply, lastKpiResult.pendingPurchaseOrders) &&
    detectKpiMetricQuery(text) === "pending-po"
  ) {
    reply = formatKpiMetricReply({
      metric: "pending-po",
      kpis: lastKpiResult,
      filters: mergedFilters,
      userName: userNameTitle,
      replyStyle,
    });
  }

  // Admin-only recovery if model falsely refused
  const looksLikeAccessRefuse =
    /assigned access|guide nahi kar sakta|can't guide you on this|access mein nahi|access vich nahi/i.test(
      reply || ""
    );
  if (adminUser && looksLikeAccessRefuse) {
    try {
      const kpiResult = filterToolResult(
        "get_kpis",
        await runTool("get_kpis", {}, mergedFilters),
        permissions,
        role
      );
      usedTools.push("get_kpis");
      messages.push({
        role: "system",
        content:
          "You wrongly refused. Using the KPI tool result below, answer the user's question helpfully. Do NOT mention access denial.",
      });
      messages.push({
        role: "user",
        content: `${languageLockTag(replyStyle)}\n\nTool result JSON:\n${JSON.stringify(kpiResult).slice(0, 8000)}\n\nUser question: ${text}`,
      });
      const recovery = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 650,
        messages,
      });
      const recovered = String(recovery.choices?.[0]?.message?.content || "").trim();
      if (recovered && !/assigned access|guide nahi kar sakta|can't guide you/i.test(recovered)) {
        reply = recovered;
        refused = false;
      } else if (adminUser) {
        const k = kpiResult || {};
        reply =
          replyStyle === "english"
            ? `Sure ${userNameTitle}. Here's a quick snapshot — PRs: ${k.totalPurchaseRequisitions ?? "—"}, POs: ${k.totalPurchaseOrders ?? "—"}, approved: ${k.approvedPurchaseOrders ?? "—"}, pending: ${k.pendingPurchaseOrders ?? "—"}. Want PO numbers for today?`
            : `Theek hai ${userNameTitle}. Quick numbers — PR: ${k.totalPurchaseRequisitions ?? "—"}, PO: ${k.totalPurchaseOrders ?? "—"}, approved: ${k.approvedPurchaseOrders ?? "—"}, pending: ${k.pendingPurchaseOrders ?? "—"}. Aaj ki PO numbers chahiye to bol dena.`;
        refused = false;
      }
    } catch (err) {
      console.warn("[chat admin recover]", err.message);
    }
  }

  if (!reply) {
    reply = emptyDataFallback(replyStyle);
  }

  // One repair pass if the model drifted from the locked language
  if (reply && replyMismatchesStyle(reply, replyStyle) && !refused) {
    try {
      messages.push({
        role: "system",
        content: `${languageInstruction(replyStyle)}\nRewrite your last answer in the locked language ONLY. Keep the same facts/numbers. Do not refuse access.`,
      });
      messages.push({
        role: "user",
        content: `${languageLockTag(replyStyle)}\nRewrite this answer correctly:\n${reply}`,
      });
      const fixed = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 650,
        messages,
      });
      const repaired = String(fixed.choices?.[0]?.message?.content || "").trim();
      if (repaired && !replyMismatchesStyle(repaired, replyStyle)) {
        reply = repaired;
      }
    } catch (err) {
      console.warn("[chat language repair]", err.message);
    }
  }

  await persistQuery({
    userId,
    userMessage: text,
    assistantReply: reply,
    usedTools: [...new Set(usedTools)],
    filters: mergedFilters,
    permissions,
    refused,
    embedding,
  });

  return {
    reply,
    usedTools: [...new Set(usedTools)],
    model: MODEL,
    refused,
    replyStyle,
  };
}

function isChatConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

module.exports = {
  askAuditBot,
  isChatConfigured,
};
