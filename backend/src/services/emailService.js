const nodemailer = require("nodemailer");
const { query } = require("../config/db");
const { getActiveRecipientEmails } = require("./reportEmailRecipientService");

let transporter = null;
let transporterKey = "";

function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!isEmailConfigured()) return null;
  const key = `${process.env.SMTP_HOST}:${process.env.SMTP_PORT}:${process.env.SMTP_USER}`;
  if (!transporter || transporterKey !== key) {
    transporterKey = key;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

function getEnvRecipients() {
  const raw = process.env.REPORT_EMAIL_RECIPIENTS || "";
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

async function getRecipients() {
  try {
    return await getActiveRecipientEmails();
  } catch {
    return getEnvRecipients();
  }
}

async function sendDayEndReportEmail({ reportId, to, subject, text, html, pdfPath, pdfFilename }) {
  const transport = getTransporter();
  if (!transport) {
    return { sent: false, skipped: true, error: "SMTP not configured" };
  }

  const recipients = to && to.length ? to : await getRecipients();
  if (!recipients.length) {
    return { sent: false, skipped: true, error: "No recipients configured" };
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients.join(", "),
    subject,
    text,
    html,
    attachments: pdfPath
      ? [{ filename: pdfFilename || "day-end-report.pdf", path: pdfPath }]
      : [],
  };

  try {
    await transport.sendMail(mailOptions);
    for (const recipient of recipients) {
      await query(
        `INSERT INTO email_logs (day_end_report_id, recipient_email, subject, status, sent_at)
         VALUES (?, ?, ?, 'sent', NOW())`,
        [reportId, recipient, subject]
      );
    }
    return { sent: true, recipients };
  } catch (err) {
    for (const recipient of recipients) {
      await query(
        `INSERT INTO email_logs (day_end_report_id, recipient_email, subject, status, error_message)
         VALUES (?, ?, ?, 'failed', ?)`,
        [reportId, recipient, subject, err.message]
      );
    }
    return { sent: false, error: err.message, recipients };
  }
}

module.exports = { sendDayEndReportEmail, isEmailConfigured, getRecipients };
