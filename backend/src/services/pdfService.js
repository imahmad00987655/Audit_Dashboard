const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { PDFDocument: PDFLibDocument } = require("pdf-lib");
const {
  MGI,
  ensureSpace,
  clampCursor,
  drawSectionTitle,
  drawDataTable,
  drawKpiStrip,
  renderComponentChart,
  writeWrapped,
  resetCursor,
  formatCurrency,
  formatNumber,
} = require("./pdfChartRenderer");

const REPORTS_DIR = process.env.REPORTS_DIR || path.join(__dirname, "../../storage/reports");

const FILTER_LABELS = {
  dateFrom: "From Date",
  dateTo: "To Date",
  year: "Year",
  month: "Month",
  organization: "Company Name",
  operatingUnit: "Operating Unit",
  department: "Department",
  division: "Division",
  section: "Section",
  location: "Location",
  vendor: "Vendor",
  poStatus: "PO Status",
  purchaseType: "Purchase Type",
  reqNo: "PR Number",
  poNo: "PO Number",
  search: "Search",
};

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

function pdfSafe(value) {
  return String(value ?? "")
    .replace(/[·•–—→]/g, "-")
    .replace(/[^\t\n\r\x20-\x7E]/g, "?");
}

function formatForeignAmount(amount, code) {
  const n = Number(amount) || 0;
  return `${code} ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

function formatFilters(filters = {}) {
  const entries = Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "No filters applied - full dataset for report date range.";
  return entries
    .map(([k, v]) => pdfSafe(`${FILTER_LABELS[k] || k}: ${v}`))
    .join("\n");
}

function formatCurrencySpend(cs) {
  if (!cs || typeof cs !== "object") return "No spend data";
  const lines = [`PKR Amount: ${formatCurrency(cs.pkrNative)} (${formatNumber(cs.pkrLineCount)} PKR lines)`];

  const foreign = cs.primaryForeign || cs.foreignCurrencies?.[0];
  if (foreign) {
    lines.push(
      `${foreign.code} Amount: ${formatForeignAmount(foreign.amount, foreign.code)} (${formatNumber(foreign.lineCount)} lines -> ${formatCurrency(foreign.convertedPkr)})`
    );
  } else if (cs.foreignLineCount) {
    lines.push(`Foreign Lines: ${formatNumber(cs.foreignLineCount)}`);
  }

  lines.push(`Combined PKR: ${formatCurrency(cs.combinedPkr)}`);

  if (cs.missingRateCount) {
    lines.push(`Missing FX Rate: ${formatNumber(cs.missingRateCount)} lines (${formatCurrency(cs.missingRateAmount)})`);
  }

  return lines.map(pdfSafe).join("\n");
}

function formatGrnKpis(grn) {
  if (!grn || typeof grn !== "object") return "No GRN data";
  return [
    `Total Receipts: ${formatNumber(grn.totalReceipts)}`,
    `POs with GRN: ${formatNumber(grn.posWithGrn)}`,
    `POs without GRN: ${formatNumber(grn.posWithoutGrn)}`,
    `Amount Received: ${formatCurrency(grn.amountReceived)}`,
    `Total GRN Qty: ${formatNumber(grn.totalGrnQty)}`,
    `Fulfillment Rate: ${grn.fulfillmentRate ?? 0}%`,
    `Avg PO to GRN Days: ${grn.avgPoToGrnDays ?? "N/A"}`,
    `Backdated GRN Count: ${formatNumber(grn.backdatedGrnCount)}`,
    `GRN Line Count: ${formatNumber(grn.grnLineCount)}`,
  ]
    .map(pdfSafe)
    .join("\n");
}

function formatLegalEntities(entities) {
  if (!Array.isArray(entities) || !entities.length) return "No legal entities in current filter";
  return entities
    .slice(0, 15)
    .map(
      (e, i) =>
        pdfSafe(
          `${i + 1}. ${e.name} | Spend: ${formatCurrency(e.spend)} | PRs: ${formatNumber(e.prCount)} | POs: ${formatNumber(e.poCount)}`
        )
    )
    .join("\n");
}

function formatExecutiveOverview(data) {
  if (!data || typeof data !== "object") return "No data available";

  const lines = [
    `Pending Purchase Orders: ${formatNumber(data.pendingPurchaseOrders)}`,
    `Non-PO Spend: ${formatCurrency(data.nonPoSpend)}`,
    `Total Departments: ${formatNumber(data.totalDepartments)}`,
    `Total Legal Entities: ${formatNumber(data.totalLegalEntities)}`,
    `Approval Rate: ${data.approvalRate ?? 0}%`,
    "",
    "Spend Breakdown:",
    formatCurrencySpend(data.currencySpend),
  ];

  if (Array.isArray(data.legalEntities) && data.legalEntities.length) {
    lines.push("", "Top Legal Entities:", formatLegalEntities(data.legalEntities.slice(0, 8)));
  }

  if (data.grn) {
    lines.push("", "GRN Summary:", formatGrnKpis(data.grn));
  }

  return lines.join("\n");
}

function formatNamedCountList(items, labelKey = "name", valueKey = "count") {
  if (!Array.isArray(items) || !items.length) return "No data";
  return items
    .slice(0, 12)
    .map((row, i) => pdfSafe(`${i + 1}. ${row[labelKey] || "Unknown"} | Count: ${formatNumber(row[valueKey])}`))
    .join("\n");
}

function summarizeInsights(data) {
  if (!data || typeof data !== "object") return "No insights in current filter.";

  const lines = [];
  if (data.highestPRCreator) {
    lines.push(`Top PR Creator: ${data.highestPRCreator.name} (${formatNumber(data.highestPRCreator.count)})`);
  }
  if (data.highestPOCreator) {
    lines.push(`Top PO Creator: ${data.highestPOCreator.name} (${formatNumber(data.highestPOCreator.count)})`);
  }
  if (data.pendingApprovalSummary) {
    const p = data.pendingApprovalSummary;
    lines.push(
      `Pending POs: ${formatNumber(p.pendingPOs)} | Approved: ${formatNumber(p.approvedPOs)} | Rate: ${p.approvalRate ?? 0}%`
    );
  }
  if (data.bottlenecks?.message) {
    lines.push(`Bottleneck: ${pdfSafe(data.bottlenecks.message)}`);
  }
  if (data.approvalDelayInsights?.recommendation) {
    lines.push(`Recommendation: ${pdfSafe(data.approvalDelayInsights.recommendation)}`);
  }

  return lines.map(pdfSafe).join("\n") || "No insights in current filter.";
}

function formatTablePreview(tableResult) {
  if (!tableResult?.data?.length) return null;
  const rows = tableResult.data.slice(0, 10);
  const headers = Object.keys(rows[0]).slice(0, 6);
  return {
    headers,
    rows: rows.map((row) => headers.map((h) => String(row[h] ?? "").slice(0, 40))),
    total: tableResult.pagination?.total ?? rows.length,
  };
}

function summarizeComponentData(key, data) {
  if (!data || data.error) return data?.error ? `Error: ${data.error}` : "No data available";

  switch (key) {
    case "chart-insights":
      return summarizeInsights(data);
    case "chart-funnel":
    case "chart-approval-status":
    case "chart-top-pr-creators":
    case "chart-top-po-creators":
    case "chart-top-approvers":
    case "section-executive-overview":
    case "section-grn-overview":
      return null;
    case "kpi-total-spend":
      return ["Spend Breakdown:", formatCurrencySpend(data.currencySpend)].join("\n");
    case "chart-po-revision-linkage":
    case "chart-split-po-watch":
    case "chart-grn-quality":
    case "chart-grn-funnel":
      if (typeof data === "object" && !Array.isArray(data)) {
        return Object.entries(data)
          .slice(0, 12)
          .map(([k, v]) => pdfSafe(`${k}: ${typeof v === "number" ? formatNumber(v) : v}`))
          .join("\n");
      }
      break;
    default:
      break;
  }

  if (Array.isArray(data)) {
    if (data[0]?.stage !== undefined && data[0]?.count !== undefined) {
      return data
        .slice(0, 12)
        .map((row, i) => pdfSafe(`${i + 1}. ${row.stage}: ${formatNumber(row.count)}`))
        .join("\n");
    }
    if (data[0]?.name !== undefined && data[0]?.value !== undefined && data[0]?.color !== undefined) {
      return data
        .slice(0, 10)
        .map((row, i) => pdfSafe(`${i + 1}. ${row.name}: ${formatNumber(row.value)}`))
        .join("\n");
    }
    if (data[0]?.name !== undefined && (data[0]?.spend !== undefined || data[0]?.count !== undefined)) {
      return data
        .slice(0, 10)
        .map((row, i) => {
          const parts = [`${i + 1}. ${row.name}`];
          if (row.spend !== undefined) parts.push(`Spend: ${formatCurrency(row.spend)}`);
          if (row.count !== undefined) parts.push(`Count: ${formatNumber(row.count)}`);
          return pdfSafe(parts.join(" | "));
        })
        .join("\n");
    }
    return formatNamedCountList(data);
  }

  if (typeof data === "object") {
    if (data.totalReceipts !== undefined) return formatGrnKpis(data);
    if (data.pkrNative !== undefined || data.combinedPkr !== undefined) return formatCurrencySpend(data);
    const lines = [];
    for (const [k, v] of Object.entries(data)) {
      if (v === null || v === undefined) continue;
      if (typeof v === "number") {
        const isMoney = /spend|amount|pkr|cost|received/i.test(k);
        lines.push(pdfSafe(`${k}: ${isMoney ? formatCurrency(v) : formatNumber(v)}`));
      } else if (typeof v === "string") {
        lines.push(pdfSafe(`${k}: ${v}`));
      }
    }
    return lines.slice(0, 20).join("\n") || "No data";
  }

  return pdfSafe(String(data));
}

function drawCoverHeader(doc, ctx) {
  doc.save();
  doc.rect(0, 0, doc.page.width, 8).fill(MGI.blue);
  doc.rect(0, 8, doc.page.width, 3).fill(MGI.yellow);
  doc.rect(0, 11, doc.page.width, 2).fill(MGI.red);
  doc.restore();

  doc.y = 42;
  doc.font("Helvetica-Bold").fontSize(22).fillColor(MGI.blue).text("Procurement Audit Dashboard", {
    align: "center",
  });
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(14).fillColor(MGI.ink).text("Day-End Audit Report", { align: "center" });
  doc.moveDown(1);
}

function drawInfoBox(doc, ctx, title, body) {
  ensureSpace(doc, ctx, 70);
  const top = doc.y;
  doc.save();
  doc.roundedRect(ctx.marginLeft, top, ctx.contentWidth, 8, 2).fill(MGI.blue);
  doc.restore();

  doc.font("Helvetica-Bold").fontSize(11).fillColor(MGI.blue).text(title, ctx.marginLeft, top + 14);
  doc.font("Helvetica").fontSize(9.5).fillColor(MGI.ink).text(body, ctx.marginLeft, top + 30, {
    width: ctx.contentWidth,
    lineGap: 3,
  });

  const boxH = doc.y - top + 12;
  doc.save();
  doc.roundedRect(ctx.marginLeft, top, ctx.contentWidth, boxH, 8).strokeColor("#dde8f2").lineWidth(1).stroke();
  doc.restore();
  doc.y = top + boxH + 14;
  resetCursor(doc, ctx);
}

function drawMetaRow(doc, ctx, reportDate, user) {
  ensureSpace(doc, ctx, 40);
  const top = doc.y;
  const colW = ctx.contentWidth / 2;
  doc.font("Helvetica").fontSize(9).fillColor(MGI.gray).text("Report Date", ctx.marginLeft, top);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(MGI.ink).text(pdfSafe(reportDate), ctx.marginLeft, top + 12);
  doc.font("Helvetica").fontSize(9).fillColor(MGI.gray).text("Submitted By", ctx.marginLeft + colW, top);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(MGI.ink)
    .text(pdfSafe(`${user.fullName} (${user.username})`), ctx.marginLeft + colW, top + 12, { width: colW - 8 });
  doc.font("Helvetica").fontSize(9).fillColor(MGI.gray).text("Generated At", ctx.marginLeft, top + 32);
  doc.font("Helvetica").fontSize(10).fillColor(MGI.ink).text(new Date().toLocaleString(), ctx.marginLeft, top + 44);
  doc.y = top + 66;
  resetCursor(doc, ctx);
}

function drawPageFooter(doc, ctx, pageNumber, pageCount) {
  const y = doc.page.height - 36;
  doc.save();
  doc.moveTo(ctx.marginLeft, y - 8).lineTo(ctx.marginLeft + ctx.contentWidth, y - 8).strokeColor("#dde8f2").lineWidth(1).stroke();
  doc.restore();
  doc.font("Helvetica").fontSize(8).fillColor(MGI.gray);
  doc.text("Procurement Audit Dashboard | Confidential", ctx.marginLeft, y, {
    width: ctx.contentWidth,
    align: "center",
  });
  doc.text(`Page ${pageNumber} of ${pageCount}`, ctx.marginLeft, y + 10, {
    width: ctx.contentWidth,
    align: "right",
  });
}

function parseDataUrlImage(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  if (!buf.length || buf.length > 1_500_000) return null;
  return { buffer: buf, type: m[1].toLowerCase() === "png" ? "png" : "jpg" };
}

function drawSignatureBlock(doc, ctx, { user, signatureImage, reportDate }) {
  const blockH = signatureImage ? 132 : 100;
  ensureSpace(doc, ctx, blockH + 12);

  const top = doc.y + 4;
  doc.save();
  doc.roundedRect(ctx.marginLeft, top, ctx.contentWidth, blockH, 8).strokeColor("#dde8f2").lineWidth(1).stroke();
  doc.restore();

  doc.font("Helvetica-Bold").fontSize(11).fillColor(MGI.blue).text("Authorized Officer Signature", ctx.marginLeft + 14, top + 10);

  doc.font("Helvetica").fontSize(9).fillColor(MGI.gray).text("Submitted by", ctx.marginLeft + 14, top + 30);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(MGI.ink)
    .text(pdfSafe(`${user.fullName} (${user.username})`), ctx.marginLeft + 14, top + 44, {
      width: ctx.contentWidth * 0.45,
    });

  doc.font("Helvetica").fontSize(9).fillColor(MGI.gray).text("Report date", ctx.marginLeft + 14, top + 64);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(MGI.ink).text(pdfSafe(reportDate), ctx.marginLeft + 14, top + 78);

  const sigX = ctx.marginLeft + ctx.contentWidth * 0.52;
  const sigW = ctx.contentWidth * 0.42;
  doc.font("Helvetica").fontSize(8).fillColor(MGI.gray).text("Signature", sigX, top + 30);

  const parsed = parseDataUrlImage(signatureImage);
  if (parsed) {
    try {
      doc.image(parsed.buffer, sigX, top + 42, {
        fit: [sigW, 70],
        align: "left",
        valign: "center",
      });
    } catch {
      doc.font("Helvetica").fontSize(9).fillColor(MGI.gray).text("Signature image unavailable", sigX, top + 64);
    }
  } else {
    doc
      .moveTo(sigX, top + 88)
      .lineTo(sigX + sigW, top + 88)
      .strokeColor("#c5d5e6")
      .lineWidth(1)
      .stroke();
    doc.font("Helvetica").fontSize(8).fillColor(MGI.gray).text("No signature captured", sigX, top + 92);
  }

  doc.y = top + blockH + 10;
  clampCursor(doc, ctx);
}

/** Remove footer-only / nearly empty pages that pdfkit sometimes leaves behind. */
async function trimSparsePages(pdfPath, minStreamBytes = 400) {
  const bytes = fs.readFileSync(pdfPath);
  const pdf = await PDFLibDocument.load(bytes);
  const { PDFName } = require("pdf-lib");
  const total = pdf.getPageCount();
  if (total <= 1) return 0;

  const removeIdx = [];
  for (let i = 0; i < total; i += 1) {
    const page = pdf.getPages()[i];
    const contents = page.node.lookup(PDFName.of("Contents"));
    let len = 0;
    if (contents && contents.contents) {
      len = contents.contents.length;
    }
    // Keep first page always; drop sparse pages (footer-only ~140-230 bytes)
    if (i > 0 && len < minStreamBytes) removeIdx.push(i);
  }

  // Remove from end so indices stay valid
  for (let i = removeIdx.length - 1; i >= 0; i -= 1) {
    pdf.removePage(removeIdx[i]);
  }

  if (removeIdx.length) {
    fs.writeFileSync(pdfPath, await pdf.save());
  }
  return removeIdx.length;
}

function renderComponentSection(doc, ctx, comp, data, formatters) {
  drawSectionTitle(doc, ctx, comp.title, `${comp.type.toUpperCase()} | ${comp.section} | Filtered dashboard data`);

  if (comp.key.startsWith("kpi-") && data && typeof data === "object" && data.value !== undefined) {
    const isMoney = /spend/i.test(comp.key);
    drawKpiStrip(doc, ctx, [
      {
        label: comp.title,
        value: isMoney ? formatCurrency(data.value) : formatNumber(data.value),
      },
    ]);
    if (data.currencySpend) {
      doc.moveDown(0.15);
      doc.font("Helvetica").fontSize(9).fillColor(MGI.ink);
      writeWrapped(doc, ctx, formatCurrencySpend(data.currencySpend));
    }
    doc.moveDown(0.25);
    return;
  }

  const chartRendered = renderComponentChart(doc, ctx, comp.key, data, formatters);

  if (comp.key.startsWith("table-")) {
    const table = formatTablePreview(data);
    if (table) {
      drawDataTable(doc, ctx, table.headers, table.rows, { maxRows: 10 });
      doc.font("Helvetica").fontSize(8).fillColor(MGI.gray);
      writeWrapped(
        doc,
        ctx,
        pdfSafe(`Showing ${table.rows.length} of ${formatNumber(table.total)} rows (current filters).`)
      );
      doc.moveDown(0.35);
      return;
    }
  }

  if (!chartRendered) {
    const summary = summarizeComponentData(comp.key, data);
    if (summary && summary !== "No data available" && summary !== "No data") {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(MGI.ink);
      writeWrapped(doc, ctx, "Summary");
      doc.moveDown(0.1);
      doc.font("Helvetica").fontSize(9).fillColor(MGI.ink);
      writeWrapped(doc, ctx, summary);
      doc.moveDown(0.25);
    }
  }

  doc.moveDown(0.15);
  clampCursor(doc, ctx);
}

async function stampFooters(pdfPath) {
  const { rgb, StandardFonts } = require("pdf-lib");
  const pdf = await PDFLibDocument.load(fs.readFileSync(pdfPath));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const total = pages.length;
  const gray = rgb(0.427, 0.518, 0.6);

  pages.forEach((page, i) => {
    const { width } = page.getSize();
    page.drawLine({
      start: { x: 48, y: 44 },
      end: { x: width - 48, y: 44 },
      thickness: 1,
      color: rgb(0.867, 0.91, 0.949),
    });
    page.drawText("Procurement Audit Dashboard | Confidential", {
      x: width / 2 - 95,
      y: 30,
      size: 8,
      font,
      color: gray,
    });
    page.drawText(`Page ${i + 1} of ${total}`, {
      x: width - 110,
      y: 18,
      size: 8,
      font,
      color: gray,
    });
  });

  fs.writeFileSync(pdfPath, await pdf.save());
}

async function generateDayEndPdf({
  user,
  reportDate,
  remarks,
  filters,
  selectedComponents,
  componentData,
  signatureImage = null,
}) {
  ensureReportsDir();

  const safeUser = String(user.username).replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = `day-end_${safeUser}_${reportDate}_${Date.now()}.pdf`;
  const pdfPath = path.join(REPORTS_DIR, filename);

  const formatters = {
    executiveText: formatExecutiveOverview,
    grnText: formatGrnKpis,
  };

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4", bufferPages: true, autoFirstPage: true });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    const ctx = {
      marginLeft: 48,
      marginTop: 48,
      contentWidth: doc.page.width - 96,
      footerMargin: 52,
    };

    drawCoverHeader(doc, ctx);
    drawMetaRow(doc, ctx, reportDate, user);
    drawInfoBox(doc, ctx, "Applied Dashboard Filters", formatFilters(filters));
    drawInfoBox(doc, ctx, "Day-End Remarks", pdfSafe(remarks || "-"));

    doc.font("Helvetica-Bold").fontSize(12).fillColor(MGI.blue).text("Selected Components & Charts", ctx.marginLeft, doc.y, {
      width: ctx.contentWidth,
    });
    doc.moveDown(0.25);
    doc.font("Helvetica").fontSize(9).fillColor(MGI.gray);
    writeWrapped(
      doc,
      ctx,
      pdfSafe(
        `${selectedComponents.length} component(s) included below. Charts and tables reflect the same filters active on the dashboard at submission time.`
      )
    );
    doc.moveDown(0.45);

    for (const comp of selectedComponents) {
      ensureSpace(doc, ctx, 52);
      const data = componentData[comp.key];
      renderComponentSection(doc, ctx, comp, data, formatters);
    }

    doc.moveDown(0.2);
    drawSignatureBlock(doc, ctx, { user, signatureImage, reportDate });

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  try {
    // Without footers, empty pages are tiny; content pages are larger.
    const removed = await trimSparsePages(pdfPath, 120);
    if (removed > 0) console.log(`[pdf] trimmed ${removed} sparse blank page(s)`);
    await stampFooters(pdfPath);
  } catch (err) {
    console.warn("[pdf post-process]", err.message);
  }

  return { pdfPath, filename };
}

module.exports = { generateDayEndPdf, REPORTS_DIR };
