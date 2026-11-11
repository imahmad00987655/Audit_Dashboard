/**
 * Detect reply language/style from the LATEST user message.
 * Returns: "english" | "punjabi" | "urdu_script" | "message" (Roman Urdu / WhatsApp style)
 */

const STRONG_ROMAN_URDU =
  /\b(aaj|ajj|aj|kal|kitni|kitna|kitne|kitney|batao|bata\s*do|btao|kardo|kar\s*do|kar\s*dein|karna|nahi|nahin|kyun|kyu|dekho|dekhiye|theek\s*hai|bilkul|shukriya|shukria|pooch|sawal|zyada|pehley|pehle|abhi|kaise|kesay|kya\s*haal|kya\s*hal|mujhe|mujhey|aapko|apko|dena|do\s*na|bata\s*dein|woh|yeh|usse|iske|unke|hamare|hamari|hawaley|hawale|kay|say|zara|btana|kon|hai|hain|hein)\b/i;

const PUNJABI =
  /\b(ki\s*haal|kihaal|kiven|kida[n]?|tuhada|tuhadi|tussi|tusii|menu|menū|fer|dass|dass\s*deo|oye|veere|kithe|kinna|kinni|kinne|kinniyan|theek\s*ae|changa|gal\s*sun|punjabi|ajj\s*di|hun\s*tak)\b/i;

const ENGLISH_SIGNAL =
  /\b(how|many|much|what|when|where|which|please|show|tell|give|today|yesterday|report|purchase|orders?|requisitions?|compare|summary|pending|approved|spend|total|for|from|until|between|company|companies|master|procon|grn|can\s+you|could\s+you|i\s+want|i\s+need|checking|count|list|help|thanks|thank\s+you|funnel|receipts?)\b/i;

const ENGLISH_STOP =
  /\b(the|a|an|is|are|was|were|of|to|for|in|on|with|and|or|my|our|this|that|can|could|would|should|me|us|you|i|do|does|did|have|has|been|be|will|not|any|all)\b/gi;

function wordList(text) {
  return (String(text).toLowerCase().match(/[a-z\u0600-\u06FF\u0A00-\u0A7F']+/g) || []).filter(Boolean);
}

function detectReplyStyle(text) {
  const raw = String(text || "").trim();
  if (!raw) return "message";

  if (/[\u0600-\u06FF]/.test(raw)) return "urdu_script";
  if (/[\u0A00-\u0A7F]/.test(raw)) return "punjabi";

  const t = raw.toLowerCase();
  const words = wordList(t);
  if (!words.length) return "message";

  // Short English greetings / thanks
  if (/^(hello|hi|hey|hii|good morning|good afternoon|good evening|thanks|thank you)\b/.test(t)) {
    return "english";
  }

  if (PUNJABI.test(t)) return "punjabi";

  // Short chat follow-ups stay in message style ("and pr creater", "sirf aj ka")
  if (
    words.length <= 5 &&
    /^(and|aur|or|bhi|sirf|uska|uski|unke|wo|woh|yeh|phir)\b/i.test(t)
  ) {
    return "message";
  }

  const strongUrdu = STRONG_ROMAN_URDU.test(t);
  const engSignal = ENGLISH_SIGNAL.test(t);
  const engStops = (t.match(ENGLISH_STOP) || []).length;
  const latinWords = words.filter((w) => /^[a-z']+$/i.test(w));
  const engRatio = latinWords.length ? engStops / latinWords.length : 0;

  // Clear English question / sentence
  if (engSignal && !strongUrdu) return "english";
  if (!strongUrdu && engStops >= 2 && engRatio >= 0.25) return "english";
  if (!strongUrdu && latinWords.length >= 4 && engStops >= 1 && !STRONG_ROMAN_URDU.test(t)) {
    return "english";
  }

  // Roman Urdu / message chat style
  if (strongUrdu) return "message";

  // Short casual without clear English grammar → message style
  if (latinWords.length <= 3 && !engSignal) return "message";

  // Default English if it looks like a full English line
  if (engStops >= 1 && !strongUrdu) return "english";

  return "message";
}

function languageInstruction(style) {
  switch (style) {
    case "english":
      return [
        "CRITICAL LANGUAGE LOCK = ENGLISH",
        "- The latest user message is in ENGLISH.",
        "- Your ENTIRE reply must be in ENGLISH only (including openers).",
        "- FORBIDDEN in this reply: Roman Urdu, Urdu script, Punjabi (no 'Theek hai', 'Dekho', 'Haan bilkul', 'main data de raha').",
        "- Good openers: \"Sure\", \"Okay\", \"Alright\", \"Looking at the numbers…\", \"Here's what I found\".",
        "- Previous chat language does NOT matter — only this message's language matters.",
      ].join("\n");
    case "punjabi":
      return [
        "CRITICAL LANGUAGE LOCK = PUNJABI",
        "- Latest message is Punjabi. Reply in natural Roman Punjabi (or Gurmukhi if they used it).",
        "- Examples: \"Theek ae\", \"Dass daan\", \"Vekho\".",
        "- Do not reply in English-only or Urdu-only.",
        "- Previous chat language does NOT matter.",
      ].join("\n");
    case "urdu_script":
      return [
        "CRITICAL LANGUAGE LOCK = URDU SCRIPT",
        "- Latest message is in Urdu script. Reply fully in Urdu script (اردو).",
        "- Do not reply in English or Roman Urdu.",
        "- Previous chat language does NOT matter.",
      ].join("\n");
    case "message":
    default:
      return [
        "CRITICAL LANGUAGE LOCK = MESSAGE / ROMAN URDU CHAT STYLE",
        "- Latest message is casual chat / Roman Urdu (message wording).",
        "- Reply in the SAME casual message style (short Roman Urdu mix is OK).",
        "- Examples: \"Theek hai\", \"Dekho\", \"Haan bilkul\", \"Numbers yeh hain\".",
        "- Do not switch to formal essay English.",
        "- Previous chat language does NOT matter.",
      ].join("\n");
  }
}

function politeRefusalForStyle(style) {
  switch (style) {
    case "english":
      return "I can't guide you on this — it isn't part of your assigned access. If you have a question on a topic you're allowed to see, ask anytime.";
    case "punjabi":
      return "Iss barey guide nahi kar sakda — eh tuhade assigned access vich nahi. Jo topic allowed ae oh pooch lena.";
    case "urdu_script":
      return "میں آپ کو اس حوالے سے گائیڈ نہیں کر سکتا — یہ آپ کے assigned access میں شامل نہیں۔";
    case "message":
    default:
      return "Main aapko iss hawalay se guide nahi kar sakta — yeh area aapke assigned access mein nahi. Jo allowed topic ho wo pooch lo.";
  }
}

function languageLockTag(style) {
  switch (style) {
    case "english":
      return "[SYSTEM: Reply in ENGLISH only. No Roman Urdu.]";
    case "punjabi":
      return "[SYSTEM: Reply in PUNJABI only.]";
    case "urdu_script":
      return "[SYSTEM: Reply in Urdu script only.]";
    default:
      return "[SYSTEM: Reply in casual Roman Urdu / message chat style.]";
  }
}

/** True when model drifted away from the locked style. */
function replyMismatchesStyle(reply, style) {
  const t = String(reply || "");
  if (!t) return false;
  if (style === "english") {
    return /\b(theek hai|dekho|haan bilkul|main dekh|main aapko|aapke assigned|hawalay|kitni|batao|kar raha hun|nahi kar sakta|pooch lo|yeh area)\b/i.test(
      t
    );
  }
  if (style === "urdu_script") {
    return !/[\u0600-\u06FF]/.test(t);
  }
  if (style === "punjabi") {
    return /\b(theek hai|main aapko|looking at|here's what|i can't guide)\b/i.test(t) &&
      !/\b(ae|aan|vich|tussi|dass|veere|kinni)\b/i.test(t);
  }
  return false;
}

function emptyDataFallback(style) {
  switch (style) {
    case "english":
      return "Hmm, I couldn't get clear data for that yet. Share company name and date range and I'll check again.";
    case "punjabi":
      return "Hmm, data clear nahi milia. Company te date range dass ke dubara puchho.";
    case "urdu_script":
      return "ڈیٹا واضح نہیں ملا۔ کمپنی اور تاریخ بتا کر دوبارہ پوچھیں۔";
    default:
      return "Hmm, is sawal ka data abhi clear nahi mila. Company aur date range thori clear karke dubara poochhiye — main phir dekh leta hoon.";
  }
}

module.exports = {
  detectReplyStyle,
  languageInstruction,
  politeRefusalForStyle,
  languageLockTag,
  replyMismatchesStyle,
  emptyDataFallback,
};
