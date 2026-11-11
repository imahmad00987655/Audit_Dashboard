const express = require("express");
const {
  login,
  logout,
  findUserById,
  getLoginHistory,
  getAllLoginHistory,
} = require("../services/authService");
const { getUserPermissions } = require("../services/permissionService");
const { getUserDataAccess } = require("../services/dataAccessService");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 8 * 60 * 60 * 1000,
  path: "/",
};

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Username and password required" });
    }

    const result = await login(username, password, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.cookie("audit_token", result.token, COOKIE_OPTS);
    res.json({ success: true, data: { user: result.user, token: result.token } });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  try {
    await logout(req.user.id, req.sessionId, { ip: req.ip });
    res.clearCookie("audit_token", { path: "/" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await findUserById(req.user.id);
  const permissions = await getUserPermissions(user.id, user.role);
  const dataAccess = await getUserDataAccess(user.id, user.role);
  res.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      permissions,
      dataAccess,
    },
  });
});

router.get("/sessions", requireAuth, async (req, res) => {
  try {
    const history =
      req.user.role === "admin"
        ? await getAllLoginHistory(Number(req.query.limit) || 100)
        : await getLoginHistory(req.user.id, Number(req.query.limit) || 50);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/sessions/all", requireAuth, requireAdmin, async (req, res) => {
  try {
    const history = await getAllLoginHistory(Number(req.query.limit) || 200);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
