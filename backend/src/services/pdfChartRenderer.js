/**
 * PDF chart/table drawing helpers for day-end reports (pdfkit).
 */

const MGI = {
  blue: "#0055a5",
  blueLight: "#2f7ec4",
  red: "#e31e24",
  yellow: "#fff200",
  gray: "#6d8499",
  ink: "#2a4a6e",
  green: "#3d9b6a",
};

function fillMonthlyGaps(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const sorted = [...rows].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const startParts = String(sorted[0].month).split("-").map(Number);
  const endParts = String(sorted[sorted.length - 1].month).split("-").map(Number);
  if (startParts.length < 2 || endParts.length < 2) return sorted;

  const byMonth = new Map(sorted.map((r) => [r.month, r]));
  const out = [];
  let y = startParts[0];
  let m = startParts[1];
  const endY = endParts[0];
  const endM = endParts[1];

  while (y < endY || (y === endY && m <= endM)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(
      byMonth.get(key) || {
        month: key,
        purchaseRequisitions: 0,
        purchaseOrders: 0,
        spend: 0,
      }
    );
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function maxOf(items, key) {
  return items.reduce((m, row) => Math.max(m, Number(row[key]) || 0), 0) || 1;
}

function ensureSpace(doc, ctx, height) {
  const limit = doc.page.height - ctx.footerMargin;
  const maxBlock = Math.max(40, limit - ctx.marginTop);
  const need = Math.min(Math.max(0, height), maxBlock);

  // Already near top of a fresh page — do not create another empty page.
  if (doc.y <= ctx.marginTop + 1) return;

  if (doc.y + need <= limit) return;

  doc.addPage();
  doc.y = ctx.marginTop;
  doc.x = ctx.marginLeft;
}

/** Keep pdfkit cursor on-page; overflowing absolute draws cause blank page storms. */
function clampCursor(doc, ctx) {
  const limit = doc.page.height - ctx.footerMargin;
  if (doc.y > limit) {
    doc.addPage();
    doc.y = ctx.marginTop;
    doc.x = ctx.marginLeft;
  } else {
    doc.x = ctx.marginLeft;
  }
}

function resetCursor(doc, ctx) {
  doc.x = ctx.marginLeft;
}

/** Wrapped text block — always starts at left margin (avoids pdfkit x-cursor drift). */
function writeWrapped(doc, ctx, text, options = {}) {
  resetCursor(doc, ctx);
  doc.text(String(text ?? ""), ctx.marginLeft, doc.y, {
    width: ctx.contentWidth,
    lineGap: options.lineGap ?? 3,
    align: options.align || "left",
  });
}

function pdfSafe(value) {
  return String(value ?? "")
    .replace(/[·•–—→]/g, "-")
    .replace(/[^\t\n\r\x20-\x7E]/g, "?");
}

function drawSectionTitle(doc, ctx, title, subtitle) {
  ensureSpace(doc, ctx, 48);
  const x = ctx.marginLeft;
  doc.save();
  doc.rect(x, doc.y, 4, 18).fill(MGI.red);
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(13).fillColor(MGI.blue).text(pdfSafe(title), x + 10, doc.y, {
    width: ctx.contentWidth - 10,
  });
  doc.moveDown(0.15);
  if (subtitle) {
    doc.font("Helvetica").fontSize(9).fillColor(MGI.gray).text(pdfSafe(subtitle), x + 10, doc.y, {
      width: ctx.contentWidth - 10,
    });
    doc.moveDown(0.2);
  } else {
    doc.moveDown(0.15);
  }
  const lineY = doc.y;
  doc.moveTo(x, lineY).lineTo(x + ctx.contentWidth, lineY).strokeColor("#dde8f2").lineWidth(1).stroke();
  doc.moveDown(0.35);
  clampCursor(doc, ctx);
}

function drawHorizontalBarChart(doc, ctx, items, options = {}) {
  const {
    labelKey = "name",
    valueKey = "count",
    maxItems = 10,
    barColor = MGI.blue,
    formatValue = (v) => String(v),
    title = "Top items",
    labelWidth = 130,
    rowHeight = 22,
    labelChars = 34,
  } = options;

  const rows = (items || []).slice(0, maxItems);
  if (!rows.length) {
    doc.font("Helvetica").fontSize(10).fillColor(MGI.gray).text("No data in current filter.", ctx.marginLeft, doc.y);
    doc.moveDown(0.5);
    resetCursor(doc, ctx);
    return;
  }

  const chartH = 16 + rows.length * rowHeight;
  ensureSpace(doc, ctx, chartH + 10);

  doc.font("Helvetica-Bold").fontSize(10).fillColor(MGI.ink).text(pdfSafe(title), ctx.marginLeft, doc.y, {
    width: ctx.contentWidth,
  });
  doc.moveDown(0.35);

  const chartTop = doc.y;
  const labelW = labelWidth;
  const barX = ctx.marginLeft + labelW;
  const barMaxW = Math.max(40, ctx.contentWidth - labelW - 72);
  const peak = maxOf(rows, valueKey);

  rows.forEach((row, i) => {
    const y = chartTop + i * rowHeight;
    const label = String(row[labelKey] ?? row.department ?? row.stage ?? row.name ?? "Unknown").slice(0, labelChars);
    const value = Number(row[valueKey]) || 0;
    const barW = Math.max(2, (value / peak) * barMaxW);

    doc.font("Helvetica").fontSize(8).fillColor(MGI.ink).text(pdfSafe(label), ctx.marginLeft, y + 3, {
      width: labelW - 6,
      ellipsis: true,
    });
    doc.save();
    doc.rect(barX, y + 2, barW, 12).fill(i % 2 === 0 ? barColor : MGI.blueLight);
    doc.restore();
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MGI.ink).text(formatValue(value), barX + barW + 4, y + 3, {
      width: Math.max(48, ctx.marginLeft + ctx.contentWidth - (barX + barW + 4)),
      ellipsis: true,
    });
  });

  doc.y = chartTop + rows.length * rowHeight + 8;
  clampCursor(doc, ctx);
}

function drawVerticalBarChart(doc, ctx, items, options = {}) {
  const {
    labelKey = "name",
    valueKey = "count",
    maxItems = 8,
    barColor = MGI.blue,
    formatValue = (v) => String(v),
  } = options;

  const rows = (items || []).slice(0, maxItems);
  if (!rows.length) {
    doc.font("Helvetica").fontSize(10).fillColor(MGI.gray).text("No data in current filter.");
    doc.moveDown(0.5);
    return;
  }

  const chartH = 150;
  ensureSpace(doc, ctx, chartH + 20);

  const top = doc.y;
  const left = ctx.marginLeft + 20;
  const width = ctx.contentWidth - 40;
  const height = 110;
  const peak = maxOf(rows, valueKey);
  const slot = width / rows.length;

  doc.save();
  doc.rect(left, top, width, height).strokeColor("#dde8f2").lineWidth(1).stroke();
  doc.restore();

  rows.forEach((row, i) => {
    const value = Number(row[valueKey]) || 0;
    const barH = Math.max(2, (value / peak) * (height - 16));
    const x = left + i * slot + slot * 0.15;
    const barW = slot * 0.7;
    const y = top + height - barH - 8;

    doc.save();
    doc.rect(x, y, barW, barH).fill(i % 2 === 0 ? barColor : MGI.red);
    doc.restore();

    const label = String(row[labelKey] ?? row.stage ?? row.name ?? "").slice(0, 10);
    doc.font("Helvetica").fontSize(7).fillColor(MGI.gray).text(label, x - 2, top + height + 2, {
      width: barW + 8,
      align: "center",
    });
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MGI.ink).text(formatValue(value), x - 2, y - 10, {
      width: barW + 8,
      align: "center",
    });
  });

  doc.y = top + chartH;
  clampCursor(doc, ctx);
}

function drawMonthlyTrendChart(doc, ctx, rows, options = {}) {
  const { spendOnly = false } = options;
  const data = fillMonthlyGaps(rows).slice(-18);
  if (!data.length) {
    doc.font("Helvetica").fontSize(10).fillColor(MGI.gray).text("No monthly data in current filter.");
    doc.moveDown(0.5);
    return;
  }

  const chartH = 165;
  ensureSpace(doc, ctx, chartH + 60);

  const top = doc.y;
  const left = ctx.marginLeft + 36;
  const width = ctx.contentWidth - 52;
  const height = 100;

  const maxCount = Math.max(
    1,
    ...data.map((d) => Math.max(Number(d.purchaseOrders) || 0, Number(d.purchaseRequisitions) || 0))
  );
  const maxSpend = Math.max(1, ...data.map((d) => Number(d.spend) || 0));
  const slot = width / data.length;

  doc.save();
  doc.rect(left, top, width, height).fill("#f8fbfe").strokeColor("#dde8f2").lineWidth(1).stroke();
  doc.restore();

  data.forEach((row, i) => {
    const x = left + i * slot + slot * 0.1;
    const barW = slot * 0.35;

    if (!spendOnly) {
      const po = Number(row.purchaseOrders) || 0;
      const pr = Number(row.purchaseRequisitions) || 0;
      const poH = Math.max(1, (po / maxCount) * (height - 20));
      const prH = Math.max(1, (pr / maxCount) * (height - 20));
      doc.save();
      doc.rect(x, top + height - poH - 6, barW, poH).fill(MGI.red);
      doc.rect(x + barW + 2, top + height - prH - 6, barW, prH).fill(MGI.blue);
      doc.restore();
    }

    const spend = Number(row.spend) || 0;
    const spendH = Math.max(1, (spend / maxSpend) * (height - 20));
    doc.save();
    doc.rect(x + (spendOnly ? barW * 0.25 : 0), top + height - spendH - 6, spendOnly ? barW : barW * 2 + 2, spendH)
      .fill("#7eb6e8")
      .opacity(spendOnly ? 0.85 : 0.45);
    doc.restore();

    doc.font("Helvetica").fontSize(6).fillColor(MGI.gray).text(String(row.month).slice(5), x - 2, top + height + 4, {
      width: barW + 10,
      align: "center",
    });
  });

  doc.y = top + chartH + 6;
  clampCursor(doc, ctx);
  doc.font("Helvetica").fontSize(8).fillColor(MGI.ink);
  if (spendOnly) {
    writeWrapped(doc, ctx, "Bars show monthly spend (filtered data).");
  } else {
    writeWrapped(doc, ctx, "Red = POs | Blue = PRs | Light blue overlay = Spend");
  }
  doc.moveDown(0.25);

  drawDataTable(
    doc,
    ctx,
    ["Month", "PRs", "POs", "Spend (PKR)"],
    data.map((r) => [
      r.month,
      String(r.purchaseRequisitions ?? 0),
      String(r.purchaseOrders ?? 0),
      formatCurrency(r.spend),
    ])
  );
}

function drawSpendMixChart(doc, ctx, items, options = {}) {
  const { valueKey = "spend", labelKey = "name" } = options;
  const rows = (items || []).slice(0, 8);
  if (!rows.length) {
    doc.font("Helvetica").fontSize(10).fillColor(MGI.gray).text("No data in current filter.");
    doc.moveDown(0.5);
    return;
  }

  const total = rows.reduce((s, r) => s + (Number(r[valueKey]) || 0), 0) || 1;
  drawHorizontalBarChart(doc, ctx, rows, {
    labelKey,
    valueKey,
    maxItems: 8,
    barColor: MGI.green,
    formatValue: (v) => `${formatCurrency(v)} (${Math.round((v / total) * 1000) / 10}%)`,
    title: "Share by category (filtered)",
  });
}

function drawKpiStrip(doc, ctx, kpis) {
  ensureSpace(doc, ctx, 54);
  const top = doc.y;
  const gap = 8;
  const cardW = (ctx.contentWidth - gap * (kpis.length - 1)) / kpis.length;

  kpis.forEach((kpi, i) => {
    const x = ctx.marginLeft + i * (cardW + gap);
    doc.save();
    doc.roundedRect(x, top, cardW, 42, 6).fill("#f8fbfe").strokeColor("#dde8f2").lineWidth(1).stroke();
    doc.restore();
    doc.font("Helvetica").fontSize(7).fillColor(MGI.gray).text(kpi.label, x + 8, top + 8, { width: cardW - 16 });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(MGI.blue).text(kpi.value, x + 8, top + 22, {
      width: cardW - 16,
    });
  });

  doc.x = ctx.marginLeft;
  doc.y = top + 52;
  clampCursor(doc, ctx);
}

function drawMetricTable(doc, ctx, rows) {
  drawDataTable(doc, ctx, ["Metric", "Value"], rows);
}

function drawDataTable(doc, ctx, headers, rows, options = {}) {
  const { maxRows = 12 } = options;
  const body = (rows || []).slice(0, maxRows);
  if (!body.length) return;

  const colCount = headers.length;
  const colW = ctx.contentWidth / colCount;
  const rowH = 16;
  const x0 = ctx.marginLeft;
  const limit = doc.page.height - ctx.footerMargin;

  const drawHeader = () => {
    ensureSpace(doc, ctx, rowH * 2);
    let y = doc.y;
    doc.save();
    doc.rect(x0, y, ctx.contentWidth, rowH).fill(MGI.blue);
    doc.restore();
    headers.forEach((h, i) => {
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff").text(h, x0 + i * colW + 4, y + 4, {
        width: colW - 8,
        ellipsis: true,
      });
    });
    doc.y = y + rowH;
  };

  drawHeader();

  body.forEach((row, ri) => {
    if (doc.y + rowH > limit) {
      doc.addPage();
      doc.y = ctx.marginTop;
      doc.x = ctx.marginLeft;
      drawHeader();
    }

    const y = doc.y;
    if (ri % 2 === 0) {
      doc.save();
      doc.rect(x0, y, ctx.contentWidth, rowH).fill("#f8fbfe");
      doc.restore();
    }
    row.forEach((cell, ci) => {
      doc.font("Helvetica").fontSize(7.5).fillColor(MGI.ink).text(String(cell ?? ""), x0 + ci * colW + 4, y + 4, {
        width: colW - 8,
        ellipsis: true,
      });
    });
    doc.y = y + rowH;
  });

  doc.y += 6;
  clampCursor(doc, ctx);
}

function formatCurrency(amount) {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  // Western scale (Millions) — not Crores
  if (abs >= 1e9) return `${sign}PKR ${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}PKR ${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}PKR ${(abs / 1e3).toFixed(1)}K`;
  return `${sign}PKR ${Math.round(abs).toLocaleString("en-US")}`;
}

function formatNumber(n) {
  return (Number(n) || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

function spendBreakdownRows(currencySpend) {
  if (!currencySpend || typeof currencySpend !== "object") {
    return [["Combined PKR", "No spend data"]];
  }
  const rows = [
    ["PKR Native", `${formatCurrency(currencySpend.pkrNative)} (${formatNumber(currencySpend.pkrLineCount)} lines)`],
  ];
  const foreign = currencySpend.primaryForeign || currencySpend.foreignCurrencies?.[0];
  if (foreign) {
    rows.push([
      `${foreign.code} Foreign`,
      `${foreign.code} ${Number(foreign.amount || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })} -> ${formatCurrency(foreign.convertedPkr)}`,
    ]);
  }
  rows.push(["Combined PKR", formatCurrency(currencySpend.combinedPkr)]);
  return rows;
}

function renderExecutiveOverviewSection(doc, ctx, data) {
  drawKpiStrip(doc, ctx, [
    { label: "Total PRs", value: formatNumber(data.totalPurchaseRequisitions) },
    { label: "Total POs", value: formatNumber(data.totalPurchaseOrders) },
    { label: "Approved POs", value: formatNumber(data.approvedPurchaseOrders) },
    { label: "Total Spend", value: formatCurrency(data.totalSpend) },
  ]);
  doc.moveDown(0.35);

  drawMetricTable(doc, ctx, [
    ["Pending Purchase Orders", formatNumber(data.pendingPurchaseOrders)],
    ["Non-PO Spend", formatCurrency(data.nonPoSpend)],
    ["Total Departments", formatNumber(data.totalDepartments)],
    ["Total Legal Entities", formatNumber(data.totalLegalEntities)],
    ["Approval Rate", `${data.approvalRate ?? 0}%`],
  ]);

  doc.moveDown(0.25);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(MGI.ink);
  writeWrapped(doc, ctx, "Spend Breakdown");
  doc.moveDown(0.15);
  drawMetricTable(doc, ctx, spendBreakdownRows(data.currencySpend));

  if (Array.isArray(data.legalEntities) && data.legalEntities.length) {
    doc.moveDown(0.25);
    drawHorizontalBarChart(doc, ctx, data.legalEntities, {
      labelKey: "name",
      valueKey: "spend",
      maxItems: 6,
      formatValue: formatCurrency,
      title: "Top Legal Entities (filtered)",
    });
  }

  if (data.grn && typeof data.grn === "object") {
    doc.moveDown(0.25);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(MGI.ink);
    writeWrapped(doc, ctx, "GRN Summary");
    doc.moveDown(0.15);
    drawMetricTable(doc, ctx, [
      ["Total Receipts", formatNumber(data.grn.totalReceipts)],
      ["POs with GRN", formatNumber(data.grn.posWithGrn)],
      ["POs without GRN", formatNumber(data.grn.posWithoutGrn)],
      ["Amount Received", formatCurrency(data.grn.amountReceived)],
      ["Fulfillment Rate", `${data.grn.fulfillmentRate ?? 0}%`],
      ["Avg PO to GRN Days", String(data.grn.avgPoToGrnDays ?? "N/A")],
    ]);
  }
}

function renderGrnOverviewSection(doc, ctx, data) {
  drawKpiStrip(doc, ctx, [
    { label: "Receipts", value: formatNumber(data.totalReceipts) },
    { label: "POs w/ GRN", value: formatNumber(data.posWithGrn) },
    { label: "Amount Received", value: formatCurrency(data.amountReceived) },
    { label: "Fulfillment", value: `${data.fulfillmentRate ?? 0}%` },
  ]);
  doc.moveDown(0.35);
  drawMetricTable(doc, ctx, [
    ["POs without GRN", formatNumber(data.posWithoutGrn)],
    ["Total GRN Qty", formatNumber(data.totalGrnQty)],
    ["Backdated GRN Count", formatNumber(data.backdatedGrnCount)],
    ["GRN Line Count", formatNumber(data.grnLineCount)],
    ["Avg PO to GRN Days", String(data.avgPoToGrnDays ?? "N/A")],
  ]);
}

function renderInsightsSection(doc, ctx, data) {
  if (!data || typeof data !== "object") {
    writeWrapped(doc, ctx, "No insights in current filter.");
    return;
  }

  const mainRows = [];

  if (data.highestPRCreator) {
    mainRows.push([
      "Top PR Creator",
      `${data.highestPRCreator.name} (${formatNumber(data.highestPRCreator.count)} PRs)`,
    ]);
  }
  if (data.highestPOCreator) {
    mainRows.push([
      "Top PO Creator",
      `${data.highestPOCreator.name} (${formatNumber(data.highestPOCreator.count)} POs)`,
    ]);
  }
  if (data.highestProcurementDepartment) {
    const d = data.highestProcurementDepartment;
    mainRows.push([
      "Top PR/PO Department",
      `${d.name} (PRs ${formatNumber(d.prCount)}, POs ${formatNumber(d.poCount)})`,
    ]);
  }
  if (data.highestSpendDepartment) {
    const d = data.highestSpendDepartment;
    mainRows.push(["Top Spend Department", `${d.name} (${formatCurrency(d.spend)})`]);
  }
  if (data.maxProcurementOrganization) {
    const o = data.maxProcurementOrganization;
    mainRows.push([
      "Top Organization",
      `${o.name} (PRs ${formatNumber(o.prCount || 0)}, Spend ${formatCurrency(o.spend || 0)})`,
    ]);
  }
  if (data.pendingApprovalSummary) {
    const p = data.pendingApprovalSummary;
    mainRows.push(["Pending POs", formatNumber(p.pendingPOs)]);
    mainRows.push(["Approved POs", formatNumber(p.approvedPOs)]);
    mainRows.push(["Approval Rate", `${p.approvalRate ?? 0}%`]);
  }
  if (data.bottlenecks) {
    mainRows.push([
      "Bottleneck Alert",
      pdfSafe(data.bottlenecks.message || `${formatNumber(data.bottlenecks.aging10PlusDays)} POs aged 10+ days`),
    ]);
  }
  if (data.approvalDelayInsights) {
    const a = data.approvalDelayInsights;
    mainRows.push(["Pending Share of POs", `${a.avgPendingShare ?? 0}%`]);
    mainRows.push(["Recommendation", pdfSafe(a.recommendation || "-")]);
  }

  drawDataTable(doc, ctx, ["Insight", "Value"], mainRows);

  if (Array.isArray(data.topProcurementUsers) && data.topProcurementUsers.length) {
    doc.moveDown(0.25);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(MGI.ink);
    writeWrapped(doc, ctx, "Top Procurement Users");
    doc.moveDown(0.15);
    drawDataTable(
      doc,
      ctx,
      ["User", "PRs", "POs"],
      data.topProcurementUsers.slice(0, 10).map((u) => [
        pdfSafe(u.name),
        formatNumber(u.prs),
        formatNumber(u.pos),
      ])
    );
  }
}

function renderComponentChart(doc, ctx, key, data, formatters) {
  switch (key) {
    case "chart-monthly-trend":
      drawMonthlyTrendChart(doc, ctx, data, { spendOnly: false });
      return true;
    case "chart-spend-analysis":
      drawMonthlyTrendChart(doc, ctx, data, { spendOnly: true });
      return true;
    case "chart-grn-monthly":
      drawMonthlyTrendChart(
        doc,
        ctx,
        (data || []).map((r) => ({
          month: r.month,
          purchaseRequisitions: r.receiptCount || 0,
          purchaseOrders: r.poCount || 0,
          spend: r.amountReceived || 0,
        })),
        { spendOnly: false }
      );
      return true;
    case "chart-funnel":
      drawHorizontalBarChart(doc, ctx, data, {
        labelKey: "stage",
        valueKey: "count",
        maxItems: 8,
        formatValue: formatNumber,
        title: "Procurement funnel (filtered)",
        labelWidth: 168,
        rowHeight: 24,
        labelChars: 42,
        barColor: MGI.green,
      });
      return true;
    case "chart-approval-status":
      drawHorizontalBarChart(doc, ctx, data, {
        labelKey: "name",
        valueKey: "value",
        maxItems: 5,
        formatValue: formatNumber,
        title: "PO approval status (filtered)",
        barColor: MGI.green,
      });
      return true;
    case "chart-procurement-aging":
    case "chart-po-to-grn-aging":
    case "chart-po-revision-count":
      drawHorizontalBarChart(doc, ctx, data, {
        labelKey: "name",
        valueKey: "count",
        formatValue: formatNumber,
      });
      return true;
    case "chart-top-pr-creators":
    case "chart-top-po-creators":
    case "chart-top-approvers":
      drawHorizontalBarChart(doc, ctx, data, {
        labelKey: "name",
        valueKey: "count",
        formatValue: formatNumber,
        barColor: MGI.red,
      });
      return true;
    case "chart-dept-spend":
      drawHorizontalBarChart(doc, ctx, data, {
        labelKey: "department",
        valueKey: "spend",
        formatValue: formatCurrency,
      });
      return true;
    case "chart-legal-entity":
    case "chart-vendor-analysis":
    case "chart-grn-vendors":
    case "chart-grn-receiving-org":
      drawHorizontalBarChart(doc, ctx, data, {
        labelKey: "name",
        valueKey: "spend",
        formatValue: formatCurrency,
      });
      return true;
    case "chart-purchase-type-mix":
    case "chart-purchase-type-volume":
      drawSpendMixChart(doc, ctx, data, { valueKey: "spend", labelKey: "name" });
      return true;
    case "chart-dept-performance":
      drawDataTable(
        doc,
        ctx,
        ["Department", "PRs", "POs", "Spend", "Approval %"],
        (data || []).slice(0, 12).map((r) => [
          r.department,
          formatNumber(r.totalPR),
          formatNumber(r.totalPO),
          formatCurrency(r.spend),
          `${r.approvalRate ?? 0}%`,
        ])
      );
      return true;
    case "chart-insights":
      if (data && typeof data === "object") {
        renderInsightsSection(doc, ctx, data);
        return true;
      }
      return false;
    case "chart-most-revised-pos":
      drawDataTable(
        doc,
        ctx,
        ["PO", "Revisions", "Spend"],
        (data || []).slice(0, 10).map((r) => [r.poNo || r.name || "-", formatNumber(r.revisionCount || r.count), formatCurrency(r.spend)])
      );
      return true;
    case "section-executive-overview":
      if (data && typeof data === "object") {
        renderExecutiveOverviewSection(doc, ctx, data);
        return true;
      }
      return false;
    case "section-grn-overview":
      if (data && typeof data === "object") {
        renderGrnOverviewSection(doc, ctx, data);
        return true;
      }
      return false;
    default:
      if (key.startsWith("kpi-") && data && typeof data === "object" && data.value !== undefined) {
        drawKpiStrip(doc, ctx, [{ label: "Value", value: formatCurrency(data.value) }]);
        return true;
      }
      return false;
  }
}

module.exports = {
  MGI,
  fillMonthlyGaps,
  ensureSpace,
  clampCursor,
  drawSectionTitle,
  drawHorizontalBarChart,
  drawVerticalBarChart,
  drawMonthlyTrendChart,
  drawKpiStrip,
  drawDataTable,
  writeWrapped,
  resetCursor,
  renderComponentChart,
  formatCurrency,
  formatNumber,
};
