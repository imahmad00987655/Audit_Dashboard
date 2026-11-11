/**
 * Chat tools — audit-focused aggregates from live dashboard data.
 */
const {
  getKpis,
  getFunnel,
  getApprovalStatus,
  getInsights,
  groupUniqueCount,
  getLegalEntities,
  getOperatingUnitSpend,
  getDepartmentSpend,
  getVendors,
  getFilterOptions,
  resolveLegalEntityName,
  primaryCompName,
  hasFinalApprover,
  resolveDepartmentName,
} = require("../services/dataService");

const { getPo2GrnData, applyGrnFilters, getGrnKpis } = require("../services/grnService");
const { withResolvedScope } = require("./scopeResolver");

const SCOPE_KEYS = [
  "dateFrom",
  "dateTo",
  "organization",
  "operatingUnit",
  "department",
  "year",
  "month",
  "approvalStatus",
  "purchaseType",
];

const scopeProps = {
  dateFrom: { type: "string", description: "YYYY-MM-DD start date" },
  dateTo: { type: "string", description: "YYYY-MM-DD end date" },
  organization: {
    type: "string",
    description:
      "Company name — aliases OK: Procon, PROCON ENGINEERING, Master, Master Enterprises, MEL",
  },
  operatingUnit: {
    type: "string",
    description: "Operating unit, e.g. MEL - I (Head Office) or Proc M9 Head Office",
  },
  department: { type: "string", description: "Department name filter" },
};

function pickFilters(args = {}, baseFilters = {}) {
  const out = { ...baseFilters };
  for (const k of SCOPE_KEYS) {
    if (args[k] !== undefined && args[k] !== null && args[k] !== "") {
      out[k] = String(args[k]);
    }
  }
  return out;
}

function formatSpendSummary(currencySpend) {
  if (!currencySpend || typeof currencySpend !== "object") return null;
  return {
    combinedPkr: currencySpend.combinedPkr,
    pkrNative: currencySpend.pkrNative,
    foreignInPkr: currencySpend.foreignInPkr,
    primaryForeign: currencySpend.primaryForeign
      ? {
          code: currencySpend.primaryForeign.code,
          amount: currencySpend.primaryForeign.amount,
          convertedPkr: currencySpend.primaryForeign.convertedPkr,
        }
      : null,
  };
}

function isEmpty(v) {
  return v === null || v === undefined || v === "";
}

function buildPurchaseOrderList(rows, limit = 50) {
  const byPo = new Map();
  for (const r of rows) {
    if (isEmpty(r.PO_NO)) continue;
    const poNo = String(r.PO_NO);
    let entry = byPo.get(poNo);
    if (!entry) {
      entry = {
        poNo,
        reqNo: r.REQ_NO || null,
        createdBy: r.PO_CREATED_BY || null,
        creationDate: r.PO_CREATION_DATE || null,
        vendor: r.VENDOR_NAME || null,
        amountPkr: 0,
        approvalStatus: "Pending",
        department: resolveDepartmentName(r.DEPARTMENT),
        operatingUnit: r.OPERATING_UNIT_NAME || null,
      };
      byPo.set(poNo, entry);
    }
    if (hasFinalApprover(r)) {
      entry.approvalStatus = "Approved";
    } else if (entry.approvalStatus !== "Approved") {
      const flag = String(r.PO_APPROVE || "").trim().toUpperCase();
      if (flag === "REJECT") entry.approvalStatus = "Rejected";
    }
    entry.amountPkr = Math.max(entry.amountPkr, Number(r.PO_AMT) || 0);
    if (!entry.reqNo && r.REQ_NO) entry.reqNo = r.REQ_NO;
    if (!entry.vendor && r.VENDOR_NAME) entry.vendor = r.VENDOR_NAME;
    if (!entry.createdBy && r.PO_CREATED_BY) entry.createdBy = r.PO_CREATED_BY;
  }

  return [...byPo.values()]
    .sort((a, b) => {
      const ta = new Date(a.creationDate || 0).getTime() || 0;
      const tb = new Date(b.creationDate || 0).getTime() || 0;
      return tb - ta;
    })
    .slice(0, limit);
}

function buildPurchaseRequisitionList(rows, limit = 50) {
  const byReq = new Map();
  for (const r of rows) {
    if (isEmpty(r.REQ_NO)) continue;
    const reqNo = String(r.REQ_NO);
    if (byReq.has(reqNo)) {
      const entry = byReq.get(reqNo);
      if (!entry.linkedPoNo && r.PO_NO) entry.linkedPoNo = String(r.PO_NO);
      continue;
    }
    byReq.set(reqNo, {
      reqNo,
      createdBy: r.REQ_CREADED_BY || null,
      creationDate: r.CREATION_DATE_PR || null,
      department: resolveDepartmentName(r.DEPARTMENT),
      operatingUnit: r.OPERATING_UNIT_NAME || null,
      linkedPoNo: r.PO_NO ? String(r.PO_NO) : null,
    });
  }

  return [...byReq.values()]
    .sort((a, b) => {
      const ta = new Date(a.creationDate || 0).getTime() || 0;
      const tb = new Date(b.creationDate || 0).getTime() || 0;
      return tb - ta;
    })
    .slice(0, limit);
}

function formatScope(resolvedFilters) {
  return {
    company: resolvedFilters.organization || "All companies (group)",
    operatingUnit: resolvedFilters.operatingUnit || null,
    dateFrom: resolvedFilters.dateFrom || null,
    dateTo: resolvedFilters.dateTo || null,
  };
}

function approvalBreakdown(rows) {
  const status = getApprovalStatus(rows);
  const approved = status.find((s) => s.name === "Approved")?.value || 0;
  const pending = status.find((s) => s.name === "Pending")?.value || 0;
  const rejected = status.find((s) => s.name === "Rejected")?.value || 0;
  return { approved, pending, rejected, breakdown: status };
}

function buildAuditFlags(kpis, approval, grn, insights) {
  const flags = [];
  if (kpis.pendingPurchaseOrders > 0 && kpis.approvalRate < 90) {
    flags.push(`Approval rate ${kpis.approvalRate}% — ${kpis.pendingPurchaseOrders} POs still pending final approval.`);
  }
  if (grn.posWithoutGrn > 0) {
    flags.push(`${grn.posWithoutGrn} approved POs have no GRN receipt yet.`);
  }
  if (grn.backdatedGrnCount > 0) {
    flags.push(`${grn.backdatedGrnCount} backdated GRN lines require review.`);
  }
  if (insights.bottlenecks?.aging10PlusDays > 0) {
    flags.push(`${insights.bottlenecks.aging10PlusDays} POs aged 10+ days from PR to PO creation.`);
  }
  if (kpis.nonPoSpend > 0) {
    flags.push(`Non-PO spend of PKR ${Math.round(kpis.nonPoSpend).toLocaleString()} detected.`);
  }
  return flags;
}

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "list_companies_and_units",
      description:
        "List ALL companies (legal entities) and operating units from live API data. Use for 'kitni companies', 'kon kon si companies', 'overall companies ka data'. Returns full catalog plus companies active in current date filters.",
      parameters: {
        type: "object",
        properties: {
          dateFrom: scopeProps.dateFrom,
          dateTo: scopeProps.dateTo,
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_audit_snapshot",
      description:
        "PRIMARY tool for audit reports. Returns procurement KPIs, approval status, GRN fulfillment, risk flags, top departments/creators for one company or OU in a date range. Use for 'report', 'summary', 'audit' questions.",
      parameters: {
        type: "object",
        properties: { ...scopeProps },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_group_comparison",
      description:
        "Compare all companies side-by-side (whatever is in live data): PRs, POs, spend, approval rate, GRN. Use when user asks company-wise / dono companies / group comparison.",
      parameters: {
        type: "object",
        properties: {
          dateFrom: scopeProps.dateFrom,
          dateTo: scopeProps.dateTo,
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_kpis",
      description: "Quick KPI totals only — PRs, POs, spend, approval rate for a scope.",
      parameters: {
        type: "object",
        properties: { ...scopeProps },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_funnel",
      description: "Procurement funnel stages for a company/OU/date scope.",
      parameters: {
        type: "object",
        properties: {
          dateFrom: scopeProps.dateFrom,
          dateTo: scopeProps.dateTo,
          organization: scopeProps.organization,
          operatingUnit: scopeProps.operatingUnit,
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_approval_status",
      description: "PO approval breakdown (approved/pending/rejected) for a scope.",
      parameters: {
        type: "object",
        properties: {
          dateFrom: scopeProps.dateFrom,
          dateTo: scopeProps.dateTo,
          organization: scopeProps.organization,
          operatingUnit: scopeProps.operatingUnit,
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_creators",
      description: "Top PR or PO creators within company/OU/date scope.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["pr", "po"] },
          limit: { type: "integer" },
          ...scopeProps,
        },
        required: ["kind"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_insights",
      description: "Audit insights: bottlenecks, top creators, pending summary for a scope.",
      parameters: {
        type: "object",
        properties: {
          dateFrom: scopeProps.dateFrom,
          dateTo: scopeProps.dateTo,
          organization: scopeProps.organization,
          operatingUnit: scopeProps.operatingUnit,
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_legal_entities",
      description: "Company-wise spend, PR and PO counts.",
      parameters: {
        type: "object",
        properties: {
          dateFrom: scopeProps.dateFrom,
          dateTo: scopeProps.dateTo,
          operatingUnit: scopeProps.operatingUnit,
          limit: { type: "integer" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_operating_units",
      description: "Operating-unit-wise spend, PR and PO counts.",
      parameters: {
        type: "object",
        properties: {
          dateFrom: scopeProps.dateFrom,
          dateTo: scopeProps.dateTo,
          organization: scopeProps.organization,
          limit: { type: "integer" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_department_spend",
      description:
        "Department / section list with spend, PR and PO counts. Use for 'kitne departments', department-wise, sections.",
      parameters: {
        type: "object",
        properties: { ...scopeProps, limit: { type: "integer" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_vendors",
      description:
        "Top vendors by PO spend for the scope. Use for vendor guide, vendor-wise amounts, 'vendors aaj'.",
      parameters: {
        type: "object",
        properties: { ...scopeProps, limit: { type: "integer" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_purchase_orders",
      description:
        "Returns actual PO numbers with details (vendor, amount, approval status, creator, date). Use when user asks for PO numbers, PO list, 'PO no dena', 'kaun si PO', specific PO lookup.",
      parameters: {
        type: "object",
        properties: {
          poNo: { type: "string", description: "Optional specific PO number to look up" },
          limit: { type: "integer", description: "Max POs to return (default 30, max 50)" },
          ...scopeProps,
          approvalStatus: {
            type: "string",
            enum: ["APPROVED", "PENDING", "REJECTED"],
            description: "Filter by approval status",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_purchase_requisitions",
      description:
        "Returns actual PR / requisition numbers with details. Use when user asks for PR numbers, PR list, 'REQ no', requisition numbers.",
      parameters: {
        type: "object",
        properties: {
          reqNo: { type: "string", description: "Optional specific PR number to look up" },
          limit: { type: "integer", description: "Max PRs to return (default 30, max 50)" },
          ...scopeProps,
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_grn_summary",
      description: "GRN / receipt summary: fulfillment rate, POs without GRN, backdated GRNs.",
      parameters: {
        type: "object",
        properties: {
          dateFrom: scopeProps.dateFrom,
          dateTo: scopeProps.dateTo,
          organization: scopeProps.organization,
          operatingUnit: scopeProps.operatingUnit,
        },
        additionalProperties: false,
      },
    },
  },
];

async function runTool(name, args, baseFilters) {
  const filters = pickFilters(args, baseFilters || {});
  if (args.poNo) filters.poNo = String(args.poNo);
  const listLimit = Math.min(50, Math.max(5, Number(args.limit) || 30));
  const aggLimit = Math.min(15, Math.max(3, Number(args.limit) || 8));

  switch (name) {
    case "list_companies_and_units": {
      // Always expose full live API catalog so newly added companies appear without redeploy.
      const { raw, rows, resolvedFilters } = await withResolvedScope(filters);
      const allOpts = getFilterOptions(raw);
      const scopeOpts = getFilterOptions(rows);
      return {
        scope: formatScope(resolvedFilters),
        companies: allOpts.organizations,
        companiesInScope: scopeOpts.organizations,
        operatingUnits: allOpts.operatingUnits,
        operatingUnitsInScope: scopeOpts.operatingUnits,
        totalCompanies: allOpts.organizations.length,
        totalCompaniesInScope: scopeOpts.organizations.length,
        note: "companies = full live API catalog (all dates). companiesInScope = active under current date/org filters. Prefer companies for 'overall kitni companies'. Aliases OK for filtering.",
      };
    }
    case "get_audit_snapshot": {
      const { rows, resolvedFilters } = await withResolvedScope(filters);
      const kpis = getKpis(rows);
      const approval = approvalBreakdown(rows);
      const insights = getInsights(rows);
      const grnRaw = await getPo2GrnData();
      const grnRows = applyGrnFilters(grnRaw, resolvedFilters, rows);
      const grn = getGrnKpis(grnRows, rows);
      const topDepts = getDepartmentSpend(rows).slice(0, 5);
      const ous = getOperatingUnitSpend(rows);

      return {
        scope: formatScope(resolvedFilters),
        procurement: {
          totalPRs: kpis.totalPurchaseRequisitions,
          totalPOs: kpis.totalPurchaseOrders,
          approvedPOs: kpis.approvedPurchaseOrders,
          pendingPOs: kpis.pendingPurchaseOrders,
          approvalRatePct: kpis.approvalRate,
          totalSpendPkr: kpis.totalSpend,
          nonPoSpendPkr: kpis.nonPoSpend,
          departments: kpis.totalDepartments,
          currencySpend: formatSpendSummary(kpis.currencySpend),
        },
        approval,
        grn: {
          totalReceipts: grn.totalReceipts,
          posWithGrn: grn.posWithGrn,
          posWithoutGrn: grn.posWithoutGrn,
          fulfillmentRatePct: grn.fulfillmentRate,
          amountReceivedPkr: grn.amountReceived,
          avgPoToGrnDays: grn.avgPoToGrnDays,
          backdatedGrnLines: grn.backdatedGrnCount,
        },
        operatingUnits: ous.map((o) => ({
          name: o.name,
          spend: o.spend,
          prCount: o.prCount,
          poCount: o.poCount,
        })),
        topDepartments: topDepts,
        auditObservations: {
          highestPRCreator: insights.highestPRCreator,
          highestPOCreator: insights.highestPOCreator,
          highestSpendDepartment: insights.highestSpendDepartment,
          bottlenecks: insights.bottlenecks,
          riskFlags: buildAuditFlags(kpis, approval, grn, insights),
        },
      };
    }
    case "get_group_comparison": {
      const { rows, resolvedFilters } = await withResolvedScope(filters);
      const companies = getLegalEntities(rows);
      const grnRaw = await getPo2GrnData();
      const comparison = [];

      for (const company of companies) {
        const primary = primaryCompName(rows);
        const companyRows = rows.filter(
          (r) => resolveLegalEntityName(r, primary) === company.name
        );
        const kpis = getKpis(companyRows);
        const approval = approvalBreakdown(companyRows);
        const grnRows = applyGrnFilters(grnRaw, { ...resolvedFilters, organization: company.name }, companyRows);
        const grn = getGrnKpis(grnRows, companyRows);
        const ous = getOperatingUnitSpend(companyRows);

        comparison.push({
          company: company.name,
          operatingUnits: ous.map((o) => o.name),
          totalPRs: kpis.totalPurchaseRequisitions,
          totalPOs: kpis.totalPurchaseOrders,
          approvedPOs: kpis.approvedPurchaseOrders,
          pendingPOs: kpis.pendingPurchaseOrders,
          approvalRatePct: kpis.approvalRate,
          totalSpendPkr: kpis.totalSpend,
          grnFulfillmentPct: grn.fulfillmentRate,
          posWithoutGrn: grn.posWithoutGrn,
          approval,
        });
      }

      return {
        scope: formatScope(resolvedFilters),
        companies: comparison,
        groupTotals: {
          totalPRs: comparison.reduce((s, c) => s + c.totalPRs, 0),
          totalPOs: comparison.reduce((s, c) => s + c.totalPOs, 0),
          totalSpendPkr: comparison.reduce((s, c) => s + c.totalSpendPkr, 0),
        },
      };
    }
    case "get_kpis": {
      const { rows, resolvedFilters } = await withResolvedScope(filters);
      const k = getKpis(rows);
      const depts = getDepartmentSpend(rows);
      return {
        scope: formatScope(resolvedFilters),
        totalPurchaseRequisitions: k.totalPurchaseRequisitions,
        totalPurchaseOrders: k.totalPurchaseOrders,
        approvedPurchaseOrders: k.approvedPurchaseOrders,
        pendingPurchaseOrders: k.pendingPurchaseOrders,
        approvalRate: k.approvalRate,
        totalSpendPkr: k.totalSpend,
        nonPoSpendPkr: k.nonPoSpend,
        currencySpend: formatSpendSummary(k.currencySpend),
        totalDepartments: k.totalDepartments,
        totalLegalEntities: k.totalLegalEntities,
        departments: depts.slice(0, 15).map((d) => ({
          department: d.department,
          spend: d.spend,
          prCount: d.prCount,
          poCount: d.poCount,
        })),
      };
    }
    case "get_funnel": {
      const { rows, resolvedFilters } = await withResolvedScope(filters);
      return { scope: formatScope(resolvedFilters), funnel: getFunnel(rows) };
    }
    case "get_approval_status": {
      const { rows, resolvedFilters } = await withResolvedScope(filters);
      return {
        scope: formatScope(resolvedFilters),
        ...approvalBreakdown(rows),
      };
    }
    case "get_top_creators": {
      const { rows, resolvedFilters } = await withResolvedScope(filters);
      const kind = String(args.kind || "po").toLowerCase();
      const list =
        kind === "pr"
          ? groupUniqueCount(rows, "REQ_CREADED_BY", "REQ_NO").slice(0, aggLimit)
          : groupUniqueCount(rows, "PO_CREATED_BY", "PO_NO").slice(0, aggLimit);
      return { scope: formatScope(resolvedFilters), kind, creators: list };
    }
    case "get_insights": {
      const { rows, resolvedFilters } = await withResolvedScope(filters);
      const insights = getInsights(rows);
      return {
        scope: formatScope(resolvedFilters),
        highestPRCreator: insights.highestPRCreator,
        highestPOCreator: insights.highestPOCreator,
        highestSpendDepartment: insights.highestSpendDepartment,
        pendingApprovalSummary: insights.pendingApprovalSummary,
        bottlenecks: insights.bottlenecks,
        approvalDelayInsights: insights.approvalDelayInsights,
      };
    }
    case "get_legal_entities": {
      const { rows, resolvedFilters } = await withResolvedScope(filters);
      return {
        scope: formatScope(resolvedFilters),
        companies: getLegalEntities(rows).slice(0, aggLimit).map((e) => ({
          name: e.name,
          spend: e.spend,
          prCount: e.prCount,
          poCount: e.poCount,
        })),
      };
    }
    case "get_operating_units": {
      const { rows, resolvedFilters } = await withResolvedScope(filters);
      return {
        scope: formatScope(resolvedFilters),
        operatingUnits: getOperatingUnitSpend(rows).slice(0, aggLimit).map((e) => ({
          name: e.name,
          spend: e.spend,
          prCount: e.prCount,
          poCount: e.poCount,
        })),
      };
    }
    case "get_department_spend": {
      const { rows, resolvedFilters } = await withResolvedScope(filters);
      return {
        scope: formatScope(resolvedFilters),
        totalDepartments: getDepartmentSpend(rows).length,
        departments: getDepartmentSpend(rows)
          .slice(0, aggLimit)
          .map((d) => ({
            department: d.department,
            spend: d.spend,
            prCount: d.prCount,
            poCount: d.poCount,
          })),
      };
    }
    case "get_vendors": {
      const { rows, resolvedFilters } = await withResolvedScope(filters);
      const vendors = getVendors(rows, aggLimit).map((v) => ({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        spend: v.spend,
        poCount: v.poCount,
      }));
      return {
        scope: formatScope(resolvedFilters),
        totalVendors: vendors.length,
        vendors,
      };
    }
    case "list_purchase_orders": {
      const { rows, resolvedFilters } = await withResolvedScope(filters);
      const orders = buildPurchaseOrderList(rows, listLimit);
      return {
        scope: formatScope(resolvedFilters),
        totalMatchingPOs: orders.length,
        purchaseOrders: orders,
        note: orders.length
          ? "Share poNo values with the user when they ask for PO numbers."
          : "No POs matched this scope — confirm company and date range.",
      };
    }
    case "list_purchase_requisitions": {
      const reqFilters = { ...filters };
      if (args.reqNo) {
        reqFilters.reqNo = String(args.reqNo);
      }
      const { rows, resolvedFilters } = await withResolvedScope(reqFilters);
      let requisitions = buildPurchaseRequisitionList(rows, listLimit);
      if (args.reqNo) {
        requisitions = requisitions.filter((r) => r.reqNo === String(args.reqNo));
      }
      return {
        scope: formatScope(resolvedFilters),
        totalMatchingPRs: requisitions.length,
        purchaseRequisitions: requisitions,
        note: requisitions.length
          ? "Share reqNo values with the user when they ask for PR numbers."
          : "No PRs matched this scope — confirm company and date range.",
      };
    }
    case "get_grn_summary": {
      const { rows, resolvedFilters } = await withResolvedScope(filters);
      const grnRaw = await getPo2GrnData();
      const grnRows = applyGrnFilters(grnRaw, resolvedFilters, rows);
      const g = getGrnKpis(grnRows, rows);
      return {
        scope: formatScope(resolvedFilters),
        totalReceipts: g.totalReceipts,
        posWithGrn: g.posWithGrn,
        posWithoutGrn: g.posWithoutGrn,
        amountReceivedPkr: g.amountReceived,
        fulfillmentRate: g.fulfillmentRate,
        avgPoToGrnDays: g.avgPoToGrnDays,
        backdatedGrnCount: g.backdatedGrnCount,
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

module.exports = {
  TOOL_DEFINITIONS,
  runTool,
};
