require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const dashboardRoutes = require("./routes/dashboard");
const authRoutes = require("./routes/auth");
const reportRoutes = require("./routes/reports");
const chatRoutes = require("./chat/routes");
const { requireAuth } = require("./middleware/auth");
const { getRawData, startProcurementBackgroundRefresh } = require("./services/dataService");
const adminRoutes = require("./routes/admin");
const { ensureAdminSeed } = require("./services/authService");
const { ensurePermissionsSchema } = require("./services/permissionService");
const { ensureDataAccessSchema } = require("./services/dataAccessService");
const { ensureReportEmailRecipientsSchema } = require("./services/reportEmailRecipientService");
const { ensureChatMemorySchema } = require("./chat/chatMemoryService");

const app = express();
const PORT = process.env.PORT || 5057;

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3033";

app.use(
  cors({
    origin: corsOrigin.split(",").map((o) => o.trim()),
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "4mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "procurement-audit-api" });
});

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/reports", reportRoutes);
app.use("/dashboard", requireAuth, dashboardRoutes);
app.use("/chat", requireAuth, chatRoutes);

app.use((err, _req, res, _next) => {
  console.error("[API Error]", err.message);
  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Procurement Audit API listening on 0.0.0.0:${PORT}`);

  try {
    const admin = await ensureAdminSeed();
    if (admin) {
      console.log(`Admin user ready (${admin.username})`);
    }
  } catch (e) {
    console.warn("Admin seed skipped (DB may not be ready):", e.message);
  }

  try {
    await ensurePermissionsSchema();
    console.log("User permissions schema ready");
  } catch (e) {
    console.warn("Permissions schema skipped:", e.message);
  }

  try {
    await ensureDataAccessSchema();
    console.log("User data access schema ready");
  } catch (e) {
    console.warn("Data access schema skipped:", e.message);
  }

  try {
    await ensureReportEmailRecipientsSchema();
    console.log("Report email recipients ready");
  } catch (e) {
    console.warn("Report email recipients schema skipped:", e.message);
  }

  try {
    await ensureChatMemorySchema();
    console.log("Chat query memory schema ready");
  } catch (e) {
    console.warn("Chat memory schema skipped:", e.message);
  }

  try {
    const data = await getRawData();
    console.log(`Cached ${data.length.toLocaleString()} procurement records`);
    const { getPo2GrnData, startGrnBackgroundRefresh } = require("./services/grnService");
    const grn = await getPo2GrnData();
    console.log(`Cached ${grn.length.toLocaleString()} PO→GRN records`);
    startProcurementBackgroundRefresh();
    startGrnBackgroundRefresh();
  } catch (e) {
    console.warn("Initial data prefetch failed (will retry on request):", e.message);
    startProcurementBackgroundRefresh();
    try {
      const { startGrnBackgroundRefresh } = require("./services/grnService");
      startGrnBackgroundRefresh();
    } catch {
      /* ignore */
    }
  }
});
