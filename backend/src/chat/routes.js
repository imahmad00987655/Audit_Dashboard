const express = require("express");
const { askAuditBot, isChatConfigured } = require("./chatService");
const { canUseChatbot, POLITE_REFUSAL } = require("./chatAccess");

const router = express.Router();

/** Simple per-user rate limit (in-memory). */
const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

function rateLimit(userId) {
  const now = Date.now();
  const key = String(userId || "anon");
  let b = buckets.get(key);
  if (!b || now - b.start >= WINDOW_MS) {
    b = { start: now, count: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  return b.count <= MAX_PER_WINDOW;
}

router.get("/status", (req, res) => {
  res.json({
    success: true,
    data: {
      configured: isChatConfigured(),
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      allowed: canUseChatbot(req.user),
    },
  });
});

router.post("/ask", async (req, res, next) => {
  try {
    if (!isChatConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Chatbot is not configured. Set OPENAI_API_KEY on the server.",
      });
    }

    if (!canUseChatbot(req.user)) {
      return res.status(403).json({
        success: false,
        error: POLITE_REFUSAL,
      });
    }

    if (!rateLimit(req.user?.id)) {
      return res.status(429).json({
        success: false,
        error: "Too many questions. Please wait a minute and try again.",
      });
    }

    const { message, filters, history } = req.body || {};
    const data = await askAuditBot({
      message,
      filters: filters && typeof filters === "object" ? filters : {},
      history: Array.isArray(history) ? history : [],
      user: req.user
        ? {
            id: req.user.id,
            role: req.user.role,
            permissions: req.user.permissions || [],
            username: req.user.username,
            fullName: req.user.fullName,
          }
        : null,
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error("[chat/ask]", err.message);
    next(err);
  }
});

module.exports = router;
