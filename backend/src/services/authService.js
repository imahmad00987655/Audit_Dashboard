const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query, queryOne } = require("../config/db");
const { getUserPermissions } = require("./permissionService");
const { getUserDataAccess } = require("./dataAccessService");

const JWT_SECRET = process.env.JWT_SECRET || "audit-dashboard-change-me-in-production";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "8h";
const BCRYPT_ROUNDS = 12;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function signJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyJwt(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function findUserByUsername(username) {
  return queryOne(
    `SELECT id, username, email, password_hash, full_name, role, is_active
     FROM users WHERE username = ? LIMIT 1`,
    [username]
  );
}

async function findUserById(id) {
  return queryOne(
    `SELECT id, username, email, full_name, role, is_active, created_at
     FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
}

async function login(username, password, meta = {}) {
  const user = await findUserByUsername(username);
  if (!user || !user.is_active) {
    throw new Error("Invalid username or password");
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error("Invalid username or password");
  }

  const sessionToken = generateSessionToken();
  const tokenHash = hashToken(sessionToken);

  const sessionResult = await query(
    `INSERT INTO login_sessions (user_id, session_token, ip_address, user_agent, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [user.id, tokenHash, meta.ip || null, meta.userAgent || null]
  );

  const jwtToken = signJwt({
    sub: user.id,
    sid: sessionResult.insertId,
    username: user.username,
    role: user.role,
  });

  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json, ip_address)
     VALUES (?, 'login', 'session', ?, JSON_OBJECT('username', ?), ?)`,
    [user.id, String(sessionResult.insertId), user.username, meta.ip || null]
  );

  return {
    token: jwtToken,
    sessionId: sessionResult.insertId,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      permissions: await getUserPermissions(user.id, user.role),
      dataAccess: await getUserDataAccess(user.id, user.role),
    },
  };
}

async function logout(userId, sessionId, meta = {}) {
  const session = await queryOne(
    `SELECT id, login_at, logout_at FROM login_sessions
     WHERE id = ? AND user_id = ? AND is_active = 1 LIMIT 1`,
    [sessionId, userId]
  );

  if (session) {
    await query(
      `UPDATE login_sessions
       SET logout_at = NOW(),
           duration_seconds = TIMESTAMPDIFF(SECOND, login_at, NOW()),
           is_active = 0
       WHERE id = ?`,
      [session.id]
    );
  }

  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
     VALUES (?, 'logout', 'session', ?, ?)`,
    [userId, String(sessionId), meta.ip || null]
  );
}

async function validateSession(userId, sessionId) {
  const session = await queryOne(
    `SELECT id FROM login_sessions
     WHERE id = ? AND user_id = ? AND is_active = 1 LIMIT 1`,
    [sessionId, userId]
  );
  return Boolean(session);
}

async function getLoginHistory(userId, limit = 50) {
  return query(
    `SELECT
       ls.id,
       ls.user_id AS userId,
       u.username,
       u.full_name AS fullName,
       ls.login_at AS loginAt,
       ls.logout_at AS logoutAt,
       ls.duration_seconds AS durationSeconds,
       ls.ip_address AS ipAddress,
       ls.is_active AS isActive
     FROM login_sessions ls
     JOIN users u ON u.id = ls.user_id
     WHERE ls.user_id = ?
     ORDER BY ls.login_at DESC
     LIMIT ?`,
    [userId, limit]
  );
}

async function getAllLoginHistory(limit = 100) {
  return query(
    `SELECT
       ls.id,
       ls.user_id AS userId,
       u.username,
       u.full_name AS fullName,
       ls.login_at AS loginAt,
       ls.logout_at AS logoutAt,
       ls.duration_seconds AS durationSeconds,
       ls.ip_address AS ipAddress,
       ls.is_active AS isActive
     FROM login_sessions ls
     JOIN users u ON u.id = ls.user_id
     ORDER BY ls.login_at DESC
     LIMIT ?`,
    [limit]
  );
}

async function createUser({ username, email, password, fullName, role = "user" }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const result = await query(
    `INSERT INTO users (username, email, password_hash, full_name, role)
     VALUES (?, ?, ?, ?, ?)`,
    [username, email, passwordHash, fullName, role]
  );
  return findUserById(result.insertId);
}

async function ensureAdminSeed() {
  const username = String(process.env.ADMIN_USERNAME || "admin").trim() || "admin";
  const password = String(process.env.ADMIN_PASSWORD || "").trim();
  const email = String(process.env.ADMIN_EMAIL || "admin@localhost").trim() || "admin@localhost";

  const existing = await findUserByUsername(username);
  if (existing) return existing;

  // Never ship a hardcoded password — seed only when ADMIN_PASSWORD is set locally.
  if (!password) {
    console.warn(
      `[auth] No admin user yet. Set ADMIN_PASSWORD in .env to create "${username}" on next start.`
    );
    return null;
  }

  return createUser({
    username,
    email,
    password,
    fullName: "System Administrator",
    role: "admin",
  });
}

module.exports = {
  signJwt,
  verifyJwt,
  hashToken,
  login,
  logout,
  validateSession,
  findUserById,
  findUserByUsername,
  getLoginHistory,
  getAllLoginHistory,
  createUser,
  ensureAdminSeed,
  BCRYPT_ROUNDS,
};
