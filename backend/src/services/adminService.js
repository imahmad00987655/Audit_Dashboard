const bcrypt = require("bcryptjs");
const { query, queryOne } = require("../config/db");
const { BCRYPT_ROUNDS, findUserById } = require("./authService");
const { getUserPermissions, setUserPermissions, grantAllPermissionsToUser } = require("./permissionService");
const { getUserDataAccess, setUserDataAccess } = require("./dataAccessService");

async function listUsers() {
  const users = await query(
    `SELECT id, username, email, full_name AS fullName, role, is_active AS isActive, created_at AS createdAt
     FROM users ORDER BY created_at DESC`
  );
  const withPerms = await Promise.all(
    users.map(async (u) => ({
      ...u,
      permissions: await getUserPermissions(u.id, u.role),
      dataAccess: await getUserDataAccess(u.id, u.role),
    }))
  );
  return withPerms;
}

async function getUserDetail(userId) {
  const user = await findUserById(userId);
  if (!user) return null;
  const permissions = await getUserPermissions(user.id, user.role);
  const dataAccess = await getUserDataAccess(user.id, user.role);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    isActive: user.is_active,
    createdAt: user.created_at,
    permissions,
    dataAccess,
  };
}

async function createManagedUser({
  username,
  email,
  password,
  fullName,
  role = "user",
  permissions = [],
  dataAccess,
}) {
  const existing = await queryOne(`SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1`, [
    username,
    email,
  ]);
  if (existing) throw new Error("Username or email already exists");

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const result = await query(
    `INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)`,
    [username, email, passwordHash, fullName, role === "admin" ? "admin" : "user"]
  );
  const userId = result.insertId;

  if (role === "admin") {
    await grantAllPermissionsToUser(userId);
  } else {
    await setUserPermissions(userId, permissions);
    if (dataAccess) {
      await setUserDataAccess(userId, dataAccess);
    }
  }

  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json)
     VALUES (?, 'user_created', 'user', ?, JSON_OBJECT('username', ?, 'role', ?))`,
    [userId, String(userId), username, role]
  );

  return getUserDetail(userId);
}

async function updateManagedUser(userId, { email, fullName, role, isActive, password, permissions, dataAccess }) {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  const updates = [];
  const params = [];

  if (email !== undefined) {
    updates.push("email = ?");
    params.push(email);
  }
  if (fullName !== undefined) {
    updates.push("full_name = ?");
    params.push(fullName);
  }
  if (role !== undefined) {
    updates.push("role = ?");
    params.push(role === "admin" ? "admin" : "user");
  }
  if (isActive !== undefined) {
    updates.push("is_active = ?");
    params.push(isActive ? 1 : 0);
  }
  if (password) {
    updates.push("password_hash = ?");
    params.push(await bcrypt.hash(password, BCRYPT_ROUNDS));
  }

  if (updates.length) {
    params.push(userId);
    await query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
  }

  const updated = await findUserById(userId);
  if (updated.role === "admin") {
    await grantAllPermissionsToUser(userId);
  } else {
    if (permissions !== undefined) {
      await setUserPermissions(userId, permissions);
    }
    if (dataAccess !== undefined) {
      await setUserDataAccess(userId, dataAccess);
    }
  }

  return getUserDetail(userId);
}

async function deleteManagedUser(userId, actorId) {
  if (Number(userId) === Number(actorId)) {
    throw new Error("You cannot delete your own account");
  }
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");
  if (user.role === "admin") {
    const adminCount = await queryOne(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND is_active = 1`);
    if (Number(adminCount.c) <= 1) throw new Error("Cannot delete the last active admin");
  }
  await query(`DELETE FROM users WHERE id = ?`, [userId]);
  return { deleted: true };
}

module.exports = {
  listUsers,
  getUserDetail,
  createManagedUser,
  updateManagedUser,
  deleteManagedUser,
};
