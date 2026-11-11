/**
 * Greetings, thanks, help — no OpenAI/tools needed.
 * Replies mirror user's language style.
 */

function normalize(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[!.?,،۔…]+/g, "")
    .replace(/\s+/g, " ");
}

function wordCount(text) {
  return normalize(text).split(" ").filter(Boolean).length;
}

const GREETINGS = new Set([
  "hello",
  "hi",
  "hey",
  "hii",
  "hola",
  "salam",
  "salaam",
  "assalam",
  "assalamu alaikum",
  "assalam o alaikum",
  "asalam o alaikum",
  "aoa",
  "adaab",
  "adab",
  "good morning",
  "good afternoon",
  "good evening",
  "kaise ho",
  "kesay ho",
  "kya hal hai",
  "kya haal hai",
  "ki haal ae",
  "ki haal",
  "kiven ho",
  "ہیلو",
  "ہیلوو",
  "سلام",
  "السلام علیکم",
  "السلام",
  "وعلیکم السلام",
]);

const THANKS = new Set([
  "thanks",
  "thank you",
  "shukriya",
  "shukria",
  "jazakallah",
  "jazak allah",
  "ok thanks",
  "theek hai shukriya",
  "shukriya veere",
  "شکریہ",
  "شکریہ بہت",
  "بہت شکریہ",
]);

const HELP = new Set([
  "help",
  "madad",
  "guide",
  "kya kar sakte ho",
  "kya kar sakte hain",
  "kya pooch sakta hun",
  "kya pooch sakte hain",
  "commands",
  "options",
  "مدد",
  "کیا پوچھ سکتا ہوں",
]);

function matchesSet(text, set) {
  const n = normalize(text);
  if (!n) return false;
  if (set.has(n)) return true;
  for (const phrase of set) {
    if (n === phrase || n.startsWith(`${phrase} `) || n.endsWith(` ${phrase}`)) {
      return true;
    }
  }
  return false;
}

function isGreeting(text) {
  const n = normalize(text);
  if (!n || wordCount(n) > 8) return false;
  if (matchesSet(n, GREETINGS)) return true;
  if (/^(hello|hi|hey|salam|assalam|aoa|ہیلو|سلام)/i.test(n)) return true;
  if (/assalam.*alaikum|salam.*alaikum|السلام/i.test(n)) return true;
  return false;
}

function isThanks(text) {
  const n = normalize(text);
  if (!n || wordCount(n) > 10) return false;
  return matchesSet(n, THANKS) || /^(thanks|shukri|شکریہ)/i.test(n);
}

function isHelpRequest(text) {
  const n = normalize(text);
  if (!n || wordCount(n) > 12) return false;
  // Exact help phrases only — do NOT treat "…guide karna" about PO/PR as help menu
  if (matchesSet(n, HELP) && !/\b(po|pr|grn|spend|report|purchase|order|requisition|master|procon)\b/i.test(n)) {
    return true;
  }
  return /^(help|madad|kya kar sakte|kya pooch|مدد)(\s|$)/i.test(n);
}

function greetingReply(name, style, options = {}) {
  const n = name || "dost";
  const companyNames = Array.isArray(options.companyNames) ? options.companyNames.filter(Boolean) : [];
  const shortCompanies = companyNames
    .map((c) => {
      const s = String(c);
      if (/procon/i.test(s)) return "Procon";
      if (/master/i.test(s)) return "Master";
      if (/foamco/i.test(s)) return "Foamco";
      const first = s.split(/\s+/)[0];
      return first.length > 2 ? first : s.slice(0, 24);
    })
    .filter(Boolean);
  const companyBit =
    shortCompanies.length > 0
      ? shortCompanies.length === 1
        ? shortCompanies[0]
        : shortCompanies.length === 2
          ? `${shortCompanies[0]} aur ${shortCompanies[1]}`
          : `${shortCompanies.slice(0, -1).join(", ")} aur ${shortCompanies[shortCompanies.length - 1]}`
      : null;

  if (style === "english") {
    const optionsEn = [
      companyBit
        ? `Hello ${n}! How are you? I'm your audit assistant — I can check ${companyBit} procurement data. Ask me anything.`
        : `Hello ${n}! How are you? I'm your audit assistant — I can help with the companies in your live data. Ask me anything.`,
      `Hi ${n}! Good to see you. I can help with the topics you have access to. What do you need?`,
    ];
    return optionsEn[Math.floor(Math.random() * optionsEn.length)];
  }
  if (style === "punjabi") {
    const optionsPj = [
      `Wa Alaikum Assalam ${n}! Ki haal ae? Main audit assistant aan — tuhade allowed topics te madad kar sakda aan. Dass ki chahida ae.`,
      `AOA ${n}! Changa? Main ithe haan madad lai. Puchh lao.`,
    ];
    return optionsPj[Math.floor(Math.random() * optionsPj.length)];
  }
  if (style === "urdu_script") {
    return `السلام علیکم ${n}! میں آپ کا آڈٹ اسسٹنٹ ہوں — جو topics آپ کے access میں ہیں ان پر مدد کر سکتا ہوں۔ پوچھیں۔`;
  }
  const optionsMsg = [
    companyBit
      ? `Assalam o Alaikum, ${n}! Main aapka audit assistant hoon — ${companyBit} ka data dekh sakta hoon. Boliye ${n}, aaj kya dekhna hai?`
      : `Wa Alaikum Assalam, ${n}! Kaise hain aap? Main audit assistant hoon — jo topics aapke access mein hain un par madad kar sakta hoon. Jo poochna ho boliye.`,
    companyBit
      ? `AOA ${n}! Theek hain? Main ${companyBit} ka data dekh sakta hoon — poochhiye zara.`
      : `AOA ${n}! Theek hain? Main yahan hoon aapki madad ke liye. Poochhiye zara.`,
  ];
  return optionsMsg[Math.floor(Math.random() * optionsMsg.length)];
}

function thanksReply(name, style) {
  const n = name || "dost";
  if (style === "english") {
    return `Happy to help, ${n}! Ask anytime if you need anything else.`;
  }
  if (style === "punjabi") {
    return `Khushi hoi ${n}! Hor kujh chahida hove te dass dena.`;
  }
  if (style === "urdu_script") {
    return `خوشی ہوئی ${n}! اور کچھ چاہیے ہو تو بتا دیجیے۔`;
  }
  const options = [
    `Khushi hui ${n}! Aur kuch chahiye ho to bas bol dena.`,
    `Shukriya ${n} — koi aur cheez dekhni ho to poochh lena.`,
    `Theek hai ${n}, jab marzi dubara sawal kar lena.`,
  ];
  return options[Math.floor(Math.random() * options.length)];
}

function helpReply(name, style, options = {}) {
  const n = name || "dost";
  const allowedTopics = String(options.allowedTopics || "").trim();
  const isAdmin = String(options.role || "").toLowerCase() === "admin";
  const topicHint = isAdmin
    ? null
    : allowedTopics
      ? allowedTopics
          .split("\n")
          .map((l) => l.replace(/^- /, "").trim())
          .filter((l) => l && !/^FORBIDDEN/i.test(l))
          .slice(0, 8)
      : [];

  if (style === "english") {
    if (!isAdmin && topicHint && topicHint.length) {
      return [
        `Sure ${n}. Based on your access I can help with:`,
        "",
        ...topicHint.map((t) => `• ${t}`),
        "",
        "Ask in English anytime — I'll answer in English.",
      ].join("\n");
    }
    return [
      `Sure ${n}, I can help with things like:`,
      "",
      '• "Procon report from 1 August to now"',
      '• "How many POs for Master Enterprises?"',
      '• "Compare both companies"',
      '• "Share today\'s report"',
      "",
      "Type or use the mic — whatever you prefer.",
    ].join("\n");
  }
  if (style === "punjabi") {
    if (!isAdmin && topicHint && topicHint.length) {
      return [
        `Bilkul ${n}, tuhade access mutabiq main eh dass sakda aan:`,
        "",
        ...topicHint.map((t) => `• ${t}`),
        "",
        "Punjabi vich puchho — jawab vi Punjabi vich aavega.",
      ].join("\n");
    }
    return [
      `Bilkul ${n}, main eh sab dass sakda aan:`,
      "",
      '• "Procon da report 1 August ton hun tak"',
      '• "Master te kinniyan POs ne?"',
      '• "Dona companies compare karo"',
      "",
      "Type kar lao ya mic nal bol lao.",
    ].join("\n");
  }
  if (style === "urdu_script") {
    if (!isAdmin && topicHint && topicHint.length) {
      return `بالکل ${n}، آپ کے access کے مطابق:\n${topicHint.map((t) => `• ${t}`).join("\n")}`;
    }
    return `بالکل ${n}، میں PO، PR، spend اور رپورٹ شیئر میں مدد کر سکتا ہوں۔ پوچھیں۔`;
  }
  if (!isAdmin && topicHint && topicHint.length) {
    return [
      `Bilkul ${n}, aapke access ke mutabiq main ye bata sakta hoon:`,
      "",
      ...topicHint.map((t) => `• ${t}`),
      "",
      "Message style mein poocho — jawab bhi usi style mein aayega.",
    ].join("\n");
  }
  return [
    `Bilkul ${n}, main ye sab bata sakta hoon — examples:`,
    "",
    '• "Procon ka report 1 August se ab tak"',
    '• "Master Enterprises pe kitni POs hain?"',
    '• "Dono companies compare karo"',
    '• "Aaj ki report share karo"',
    "",
    "Type kar ke ya mic se bol sakte hain.",
  ].join("\n");
}

function trySmallTalk(message, name, style = "message", options = {}) {
  // Pure English greetings like "hi" / "hello" should reply in English
  let resolved = style;
  const n = normalize(message);
  if (/^(hello|hi|hey|hii|good morning|good afternoon|good evening)\b/.test(n)) {
    resolved = "english";
  } else if (/^(thanks|thank you)\b/.test(n)) {
    resolved = "english";
  } else if (/^(aoa|salam|assalam|kaise|kesay|kya hal)/.test(n)) {
    resolved = style === "english" ? "message" : style;
  }

  if (isGreeting(message)) return greetingReply(name, resolved, options);
  if (isThanks(message)) return thanksReply(name, resolved);
  if (isHelpRequest(message)) return helpReply(name, resolved, options);
  return null;
}

module.exports = {
  isGreeting,
  isThanks,
  isHelpRequest,
  trySmallTalk,
};
