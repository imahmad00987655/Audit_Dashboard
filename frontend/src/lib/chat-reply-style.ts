/**
 * Mirrors backend/src/chat/replyStyle.js — keep in sync.
 */

export type ReplyStyle = "english" | "punjabi" | "urdu_script" | "message";

const STRONG_ROMAN_URDU =
  /\b(aaj|ajj|aj|kal|kitni|kitna|kitne|kitney|batao|bata\s*do|btao|kardo|kar\s*do|kar\s*dein|karna|nahi|nahin|kyun|kyu|dekho|dekhiye|theek\s*hai|bilkul|shukriya|shukria|pooch|sawal|zyada|pehley|pehle|abhi|kaise|kesay|kya\s*haal|kya\s*hal|mujhe|mujhey|aapko|apko|dena|do\s*na|bata\s*dein|woh|yeh|usse|iske|unke|hamare|hamari|hawaley|hawale|kay|say|zara|btana|kon|hai|hain|hein)\b/i;

const PUNJABI =
  /\b(ki\s*haal|kihaal|kiven|kida[n]?|tuhada|tuhadi|tussi|tusii|menu|menū|fer|dass|dass\s*deo|oye|veere|kithe|kinna|kinni|kinne|kinniyan|theek\s*ae|changa|gal\s*sun|punjabi|ajj\s*di|hun\s*tak)\b/i;

const ENGLISH_SIGNAL =
  /\b(how|many|much|what|when|where|which|please|show|tell|give|today|yesterday|report|purchase|orders?|requisitions?|compare|summary|pending|approved|spend|total|for|from|until|between|company|companies|master|procon|grn|can\s+you|could\s+you|i\s+want|i\s+need|checking|count|list|help|thanks|thank\s+you|funnel|receipts?)\b/i;

const ENGLISH_STOP =
  /\b(the|a|an|is|are|was|were|of|to|for|in|on|with|and|or|my|our|this|that|can|could|would|should|me|us|you|i|do|does|did|have|has|been|be|will|not|any|all)\b/gi;

function wordList(text: string) {
  return (String(text).toLowerCase().match(/[a-z\u0600-\u06FF\u0A00-\u0A7F']+/g) || []).filter(Boolean);
}

export function detectReplyStyle(text: string): ReplyStyle {
  const raw = String(text || "").trim();
  if (!raw) return "message";

  if (/[\u0600-\u06FF]/.test(raw)) return "urdu_script";
  if (/[\u0A00-\u0A7F]/.test(raw)) return "punjabi";

  const t = raw.toLowerCase();
  const words = wordList(t);
  if (!words.length) return "message";

  if (/^(hello|hi|hey|hii|good morning|good afternoon|good evening|thanks|thank you)\b/.test(t)) {
    return "english";
  }

  if (PUNJABI.test(t)) return "punjabi";

  if (words.length <= 5 && /^(and|aur|or|bhi|sirf|uska|uski|unke|wo|woh|yeh|phir)\b/i.test(t)) {
    return "message";
  }

  const strongUrdu = STRONG_ROMAN_URDU.test(t);
  const engSignal = ENGLISH_SIGNAL.test(t);
  const engStops = (t.match(ENGLISH_STOP) || []).length;
  const latinWords = words.filter((w) => /^[a-z']+$/i.test(w));
  const engRatio = latinWords.length ? engStops / latinWords.length : 0;

  if (engSignal && !strongUrdu) return "english";
  if (!strongUrdu && engStops >= 2 && engRatio >= 0.25) return "english";
  if (!strongUrdu && latinWords.length >= 4 && engStops >= 1) return "english";
  if (strongUrdu) return "message";
  if (latinWords.length <= 3 && !engSignal) return "message";
  if (engStops >= 1 && !strongUrdu) return "english";
  return "message";
}

export function statusLineFor(style: ReplyStyle) {
  if (style === "english") return "Checking now…";
  if (style === "punjabi") return "Data check kar raha aan…";
  if (style === "urdu_script") return "ڈیٹا چیک کر رہا ہوں…";
  return "Main dekh raha hun / check kar raha hun…";
}

export function politeRefusalForStyle(style: ReplyStyle) {
  switch (style) {
    case "english":
      return "I can't guide you on this — it isn't part of your assigned access. If you have a question on a topic you're allowed to see, ask anytime.";
    case "punjabi":
      return "Iss barey guide nahi kar sakda — eh tuhade assigned access vich nahi. Jo topic allowed ae oh pooch lena.";
    case "urdu_script":
      return "میں آپ کو اس حوالے سے گائیڈ نہیں کر سکتا — یہ آپ کے assigned access میں شامل نہیں۔";
    default:
      return "Main aapko iss hawalay se guide nahi kar sakta — yeh area aapke assigned access mein nahi. Jo allowed topic ho wo pooch lo.";
  }
}
