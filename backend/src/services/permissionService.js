const { query, queryOne } = require("../config/db");

const FEATURE_KEYS = ["feature-filters", "feature-chatbot", "feature-day-end-report"];

async function ensurePermissionsSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      component_key VARCHAR(64) NOT NULL,
      granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_user_perm (user_id, component_key),
      KEY idx_user_perm_user (user_id),
      CONSTRAINT fk_user_perm_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  for (const [key, title, order] of [
    ["feature-filters", "Filter Bar", 5],
    ["feature-chatbot", "Audit Chatbot", 6],
    ["feature-day-end-report", "Day-End Report", 7],
  ]) {
    await query(
      `INSERT INTO report_components (component_key, component_type, title, section_name, display_order)
       VALUES (?, 'section', ?, 'Features', ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), section_name = VALUES(section_name)`,
      [key, title, order]
    );
  }

  const users = await query(`SELECT id, role FROM users WHERE is_active = 1`);
  for (const u of users) {
    if (u.role === "admin") continue;
    const row = await queryOne(`SELECT COUNT(*) AS c FROM user_permissions WHERE user_id = ?`, [u.id]);
    if (Number(row.c) === 0) {
      await grantAllPermissionsToUser(u.id);
    }
  }
}

async function listAllComponentKeys() {
  const rows = await query(
    `SELECT component_key AS componentKey FROM report_components WHERE is_active = 1 ORDER BY display_order`
  );
  return rows.map((r) => r.componentKey);
}

async function listComponentsGrouped() {
  const rows = await query(
    `SELECT component_key AS componentKey, component_type AS componentType, title, section_name AS sectionName, display_order AS displayOrder
     FROM report_components WHERE is_active = 1 ORDER BY display_order`
  );
  return rows;
}

async function getUserPermissions(userId, role) {
  if (role === "admin") {
    return listAllComponentKeys();
  }
  const rows = await query(
    `SELECT component_key AS componentKey FROM user_permissions WHERE user_id = ? ORDER BY component_key`,
    [userId]
  );
  return rows.map((r) => r.componentKey);
}

async function setUserPermissions(userId, keys) {
  const unique = [...new Set((keys || []).map(String).filter(Boolean))];
  await query(`DELETE FROM user_permissions WHERE user_id = ?`, [userId]);
  if (!unique.length) return [];
  const placeholders = unique.map(() => "(?, ?)").join(", ");
  const params = unique.flatMap((k) => [userId, k]);
  await query(`INSERT INTO user_permissions (user_id, component_key) VALUES ${placeholders}`, params);
  return unique;
}

async function grantAllPermissionsToUser(userId) {
  const keys = await listAllComponentKeys();
  return setUserPermissions(userId, keys);
}

async function userHasPermission(userId, role, key) {
  if (role === "admin") return true;
  const row = await queryOne(
    `SELECT id FROM user_permissions WHERE user_id = ? AND component_key = ? LIMIT 1`,
    [userId, key]
  );
  return Boolean(row);
}

module.exports = {
  FEATURE_KEYS,
  ensurePermissionsSchema,
  listAllComponentKeys,
  listComponentsGrouped,
  getUserPermissions,
  setUserPermissions,
  grantAllPermissionsToUser,
  userHasPermission,
};
