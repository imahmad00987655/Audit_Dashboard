/**
 * Persist chat queries + OpenAI embeddings for later vector retrieval.
 * Embeddings stored as JSON float arrays (MySQL-compatible; no special VECTOR type required).
 */
const OpenAI = require("openai");
const { query, queryOne } = require("../config/db");

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

async function ensureChatMemorySchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS chat_query_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      user_message TEXT NOT NULL,
      assistant_reply TEXT NULL,
      used_tools_json JSON NULL,
      filters_json JSON NULL,
      permissions_snapshot_json JSON NULL,
      refused TINYINT(1) NOT NULL DEFAULT 0,
      embedding_json LONGTEXT NULL,
      embedding_model VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_chat_user_created (user_id, created_at),
      KEY idx_chat_created (created_at),
      CONSTRAINT fk_chat_query_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function embedText(text) {
  const client = getClient();
  if (!client) return null;
  const input = String(text || "").trim().slice(0, 4000);
  if (!input) return null;
  try {
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input,
    });
    return res.data?.[0]?.embedding || null;
  } catch (err) {
    console.warn("[chat memory embed]", err.message);
    return null;
  }
}

async function saveChatQuery({
  userId,
  userMessage,
  assistantReply,
  usedTools = [],
  filters = {},
  permissions = [],
  refused = false,
  embedding = null,
}) {
  if (!userId || !userMessage) return null;

  let embeddingJson = null;
  let embeddingModel = null;
  if (Array.isArray(embedding) && embedding.length) {
    embeddingJson = JSON.stringify(embedding);
    embeddingModel = EMBEDDING_MODEL;
  }

  const result = await query(
    `INSERT INTO chat_query_logs
      (user_id, user_message, assistant_reply, used_tools_json, filters_json,
       permissions_snapshot_json, refused, embedding_json, embedding_model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      String(userMessage).slice(0, 8000),
      assistantReply ? String(assistantReply).slice(0, 16000) : null,
      JSON.stringify(usedTools || []),
      JSON.stringify(filters || {}),
      JSON.stringify(permissions || []),
      refused ? 1 : 0,
      embeddingJson,
      embeddingModel,
    ]
  );
  return result.insertId;
}

/**
 * Retrieve similar past queries for this user (vector cosine over stored embeddings).
 */
async function findSimilarQueries(userId, embedding, { limit = 5, minScore = 0.72 } = {}) {
  if (!userId || !Array.isArray(embedding) || !embedding.length) return [];

  const rows = await query(
    `SELECT id, user_message AS userMessage, assistant_reply AS assistantReply,
            refused, embedding_json AS embeddingJson, created_at AS createdAt
     FROM chat_query_logs
     WHERE user_id = ? AND embedding_json IS NOT NULL AND refused = 0
     ORDER BY id DESC
     LIMIT 300`,
    [userId]
  );

  const scored = [];
  for (const row of rows) {
    let vec;
    try {
      vec = JSON.parse(row.embeddingJson);
    } catch {
      continue;
    }
    const score = cosineSimilarity(embedding, vec);
    if (score >= minScore) {
      scored.push({
        id: row.id,
        userMessage: row.userMessage,
        assistantReply: row.assistantReply,
        refused: Boolean(row.refused),
        score,
        createdAt: row.createdAt,
      });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

module.exports = {
  ensureChatMemorySchema,
  embedText,
  saveChatQuery,
  findSimilarQueries,
  EMBEDDING_MODEL,
};
