const { query, queryOne } = require("../config/db");

function parseEnvRecipients() {
  const raw = process.env.REPORT_EMAIL_RECIPIENTS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function ensureReportEmailRecipientsSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS report_email_recipients (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_report_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const row = await queryOne(`SELECT COUNT(*) AS c FROM report_email_recipients`);
  if (Number(row.c) === 0) {
    for (const email of parseEnvRecipients()) {
      await query(`INSERT IGNORE INTO report_email_recipients (email) VALUES (?)`, [email]);
    }
  }
}

async function listReportEmailRecipients() {
  return query(
    `SELECT id, email, created_at AS createdAt FROM report_email_recipients ORDER BY email ASC`
  );
}

async function getActiveRecipientEmails() {
  const rows = await query(`SELECT email FROM report_email_recipients ORDER BY email ASC`);
  if (rows.length) return rows.map((r) => r.email);
  return parseEnvRecipients();
}

async function addReportEmailRecipient(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) throw new Error("Email is required");
  if (!isValidEmail(normalized)) throw new Error("Invalid email address");

  const existing = await queryOne(`SELECT id FROM report_email_recipients WHERE email = ?`, [normalized]);
  if (existing) throw new Error("Email already added");

  const result = await query(`INSERT INTO report_email_recipients (email) VALUES (?)`, [normalized]);
  return queryOne(`SELECT id, email, created_at AS createdAt FROM report_email_recipients WHERE id = ?`, [
    result.insertId,
  ]);
}

async function deleteReportEmailRecipient(id) {
  const result = await query(`DELETE FROM report_email_recipients WHERE id = ?`, [Number(id)]);
  if (!result.affectedRows) throw new Error("Email not found");
  return { deleted: true };
}

module.exports = {
  ensureReportEmailRecipientsSchema,
  listReportEmailRecipients,
  getActiveRecipientEmails,
  addReportEmailRecipient,
  deleteReportEmailRecipient,
};
