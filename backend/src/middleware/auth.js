const jwt = require("jsonwebtoken");
const { findUserById, validateSession } = require("../services/authService");
const { getUserPermissions } = require("../services/permissionService");
const { getUserDataAccess } = require("../services/dataAccessService");

const JWT_SECRET = process.env.JWT_SECRET || "audit-dashboard-change-me-in-production";

/** Short in-memory cache so parallel dashboard requests do not hit MySQL 2× each. */
const AUTH_CACHE_TTL_MS = 30_000;
const authCache = new Map();

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  if (req.cookies && req.cookies.audit_token) {
    return req.cookies.audit_token;
  }
  return null;
}

async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const cacheKey = `${payload.sub}:${payload.sid}`;
    const cached = authCache.get(cacheKey);
    if (cached && Date.now() - cached.at < AUTH_CACHE_TTL_MS) {
      req.user = cached.user;
      req.sessionId = payload.sid;
      return next();
    }

    const user = await findUserById(payload.sub);
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, error: "Invalid session" });
    }

    const sessionValid = await validateSession(payload.sub, payload.sid);
    if (!sessionValid) {
      return res.status(401).json({ success: false, error: "Session expired" });
    }

    const permissions = await getUserPermissions(user.id, user.role);
    const dataAccess = await getUserDataAccess(user.id, user.role);
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      permissions,
      dataAccess,
    };
    req.sessionId = payload.sid;
    authCache.set(cacheKey, { at: Date.now(), user: req.user });
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }
  next();
}

/** Invalidate auth cache after permission / data-access changes. */
function clearAuthCache() {
  authCache.clear();
}

module.exports = { requireAuth, requireAdmin, extractToken, clearAuthCache };
