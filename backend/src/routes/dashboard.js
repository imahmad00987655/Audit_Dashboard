const express = require("express");
const {
  getRawData,
  applyFilters,
  getDataFeedStatus,
  getKpis,
  getFunnel,
  groupUniqueCount,
  groupUniqueCountByFinalApprover,
  resolveFinalApprover,
  getMonthly,
  getDepartmentSpend,
  getDepartmentPerformance,
  getLegalEntities,
  getVendors,
  getPurchaseTypes,
  getPoRevisions,
  getApprovalStatus,
  computeAging,
  getInsights,
  getFilterOptions,
  paginateTable,
  isApproved,
  primaryCompName,
  resolveLegalEntityName,
  resolveDepartmentName,
  operatingUnitName,
} = require("../services/dataService");

const {
  getSplitPoAnalysis,
  paginateSplitPoTable,
  getSplitPoInsights,
} = require("../services/splitPoService");

const {
  getPo2GrnData,
  applyGrnFilters,
  withFilteredGrn,
  getGrnKpis,
  getGrnFunnel,
  computePoToGrnAging,
  getGrnByReceivingOrg,
  getGrnMonthly,
  getGrnVendors,
  getGrnFilterOptions,
  getGrnInsights,
  getGrnReturnRejectAnalysis,
  paginateGrnTable,
} = require("../services/grnService");

const {
  clampQueryToDataAccess,
  filterOrganizationOptions,
  filterKpisByDomains,
  hasDomain,
} = require("../services/dataAccessService");

const { getCommandCenter } = require("../services/commandCenterService");

const router = express.Router();

function userDataAccess(req) {
  return req.user?.dataAccess || { unrestricted: true, organizations: ["*"], domains: [] };
}

function scopedQuery(req) {
  return clampQueryToDataAccess(req.query, userDataAccess(req));
}

router.get("/data-feed-status", async (req, res, next) => {
  try {
    const data = await getDataFeedStatus(req.query.force === "1");
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

async function withFiltered(req) {
  const raw = await getRawData();
  const q = scopedQuery(req);
  let rows = applyFilters(raw, q);

  if (q.grnLinkage) {
    const links = String(q.grnLinkage)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (links.length) {
      const grnRaw = await getPo2GrnData();
      const grnPos = new Set(
        grnRaw
          .filter((r) => r.RECEIPT_NUM || r.GRN_DATE || Number(r.GRN_QTY) > 0)
          .map((r) => String(r.PO_NO))
      );
      rows = rows.filter((r) => {
        if (!r.PO_NO) return false;
        const has = grnPos.has(String(r.PO_NO));
        return links.some((l) => {
          if (l === "withGrn") return has;
          if (l === "withoutGrn") return !has;
          return false;
        });
      });
    }
  }

  if (q.grnReturnStatus) {
    const { applyGrnFilters: applyGrnOnly } = require("../services/grnService");
    const grnRaw = await getPo2GrnData();
    const grnFiltered = applyGrnOnly(grnRaw, { grnReturnStatus: q.grnReturnStatus });
    const poSet = new Set(grnFiltered.map((r) => String(r.PO_NO)));
    rows = rows.filter((r) => r.PO_NO && poSet.has(String(r.PO_NO)));
  }

  return rows;
}

async function withFilteredPair(req) {
  const prPoRows = await withFiltered(req);
  const access = userDataAccess(req);
  if (!hasDomain(access, "grn")) {
    return { prPoRows, grnRows: [] };
  }
  const originalQuery = req.query;
  req.query = scopedQuery(req);
  try {
    const grnRows = await withFilteredGrn(req, prPoRows);
    return { prPoRows, grnRows };
  } finally {
    req.query = originalQuery;
  }
}

router.get("/command-center", async (req, res, next) => {
  try {
    const { prPoRows, grnRows } = await withFilteredPair(req);
    const data = getCommandCenter(prPoRows, grnRows);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get("/kpis", async (req, res, next) => {
  try {
    const access = userDataAccess(req);
    const { prPoRows, grnRows } = await withFilteredPair(req);
    const data = filterKpisByDomains(
      {
        ...getKpis(prPoRows),
        ...(hasDomain(access, "grn") ? { grn: getGrnKpis(grnRows, prPoRows) } : {}),
      },
      access
    );
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get("/pr-creators", async (req, res, next) => {
  try {
    const rows = await withFiltered(req);
    const limit = Number(req.query.limit) || 15;
    const data = groupUniqueCount(rows, "REQ_CREADED_BY", "REQ_NO").slice(0, limit);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get("/po-creators", async (req, res, next) => {
  try {
    const rows = await withFiltered(req);
    const limit = Number(req.query.limit) || 15;
    const data = groupUniqueCount(rows, "PO_CREATED_BY", "PO_NO").slice(0, limit);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get("/approvers", async (req, res, next) => {
  try {
    const rows = await withFiltered(req);
    const limit = Number(req.query.limit) || 15;
    const approved = rows.filter(isApproved);
    const data = groupUniqueCountByFinalApprover(approved, "PO_NO").slice(0, limit);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get("/spend", async (req, res, next) => {
  try {
    const { prPoRows, grnRows } = await withFilteredPair(req);
    const funnel = getFunnel(prPoRows);
    const grnReceived = new Set(
      grnRows.filter((r) => r.RECEIPT_NUM || r.GRN_DATE).map((r) => String(r.PO_NO))
    ).size;
    funnel.push({ stage: "Goods Received (GRN)", count: grnReceived });

    res.json({
      success: true,
      data: {
        monthly: getMonthly(prPoRows),
        byDepartment: getDepartmentSpend(prPoRows),
        aging: computeAging(prPoRows),
        approvalStatus: getApprovalStatus(prPoRows),
        funnel,
        poToGrnAging: computePoToGrnAging(grnRows),
        grnFunnel: getGrnFunnel(grnRows),
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get("/monthly", async (req, res, next) => {
  try {
    const rows = await withFiltered(req);
    res.json({ success: true, data: getMonthly(rows) });
  } catch (e) {
    next(e);
  }
});

router.get("/legal-entities", async (req, res, next) => {
  try {
    const rows = await withFiltered(req);
    res.json({ success: true, data: getLegalEntities(rows) });
  } catch (e) {
    next(e);
  }
});

router.get("/departments", async (req, res, next) => {
  try {
    const rows = await withFiltered(req);
    res.json({
      success: true,
      data: {
        spend: getDepartmentSpend(rows),
        performance: getDepartmentPerformance(rows),
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get("/vendors", async (req, res, next) => {
  try {
    const rows = await withFiltered(req);
    res.json({ success: true, data: getVendors(rows, req.query.limit) });
  } catch (e) {
    next(e);
  }
});

router.get("/purchase-types", async (req, res, next) => {
  try {
    const rows = await withFiltered(req);
    res.json({ success: true, data: getPurchaseTypes(rows) });
  } catch (e) {
    next(e);
  }
});

router.get("/po-revisions", async (req, res, next) => {
  try {
    const rows = await withFiltered(req);
    res.json({ success: true, data: getPoRevisions(rows) });
  } catch (e) {
    next(e);
  }
});

router.get("/table", async (req, res, next) => {
  try {
    const rows = await withFiltered(req);
    res.json({ success: true, ...paginateTable(rows, req.query) });
  } catch (e) {
    next(e);
  }
});

router.get("/funnel", async (req, res, next) => {
  try {
    const rows = await withFiltered(req);
    res.json({ success: true, data: getFunnel(rows) });
  } catch (e) {
    next(e);
  }
});

router.get("/aging", async (req, res, next) => {
  try {
    const rows = await withFiltered(req);
    res.json({ success: true, data: computeAging(rows) });
  } catch (e) {
    next(e);
  }
});

router.get("/insights", async (req, res, next) => {
  try {
    const { prPoRows, grnRows } = await withFilteredPair(req);
    const splitPo = getSplitPoAnalysis(prPoRows);
    res.json({
      success: true,
      data: {
        ...getInsights(prPoRows),
        grn: getGrnInsights(grnRows, prPoRows),
        splitPo: getSplitPoInsights(splitPo),
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get("/split-po", async (req, res, next) => {
  try {
    const rows = await withFiltered(req);
    res.json({ success: true, data: getSplitPoAnalysis(rows) });
  } catch (e) {
    next(e);
  }
});

router.get("/split-po-table", async (req, res, next) => {
  try {
    const rows = await withFiltered(req);
    res.json({ success: true, ...paginateSplitPoTable(rows, req.query) });
  } catch (e) {
    next(e);
  }
});

router.get("/grn", async (req, res, next) => {
  try {
    const { prPoRows, grnRows } = await withFilteredPair(req);
    res.json({
      success: true,
      data: {
        kpis: getGrnKpis(grnRows, prPoRows),
        aging: computePoToGrnAging(grnRows),
        funnel: getGrnFunnel(grnRows),
        byReceivingOrg: getGrnByReceivingOrg(grnRows),
        monthly: getGrnMonthly(grnRows),
        vendors: getGrnVendors(grnRows, req.query.limit),
        returnReject: getGrnReturnRejectAnalysis(grnRows),
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get("/grn-table", async (req, res, next) => {
  try {
    const { prPoRows, grnRows } = await withFilteredPair(req);
    res.json({ success: true, ...paginateGrnTable(grnRows, req.query) });
  } catch (e) {
    next(e);
  }
});

router.get("/filters", async (req, res, next) => {
  try {
    const access = userDataAccess(req);
    const q = scopedQuery(req);
    const raw = await getRawData();
    const grnRaw = await getPo2GrnData();

    // Date scope only — company list stays complete for switching (then clamped)
    const dateScope = {
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      year: q.year,
      month: q.month,
    };
    const dateScopedRows = applyFilters(raw, dateScope);
    const dateScopedGrn = applyGrnFilters(grnRaw, dateScope, dateScopedRows);

    // Cascade: company → organization name → OU → departments/creators etc.
    const companyScope = {
      ...dateScope,
      organization: q.organization,
    };
    const companyScopedRows = applyFilters(raw, companyScope);
    const companyOpts = getFilterOptions(companyScopedRows);

    const cascadeScope = {
      ...dateScope,
      organization: q.organization,
      organizationName: q.organizationName,
      operatingUnit: q.operatingUnit,
    };
    const cascadedRows = applyFilters(raw, cascadeScope);
    const cascadedGrn = applyGrnFilters(grnRaw, cascadeScope, cascadedRows);

    const baseOpts = getFilterOptions(dateScopedRows);
    const cascadedOpts = getFilterOptions(cascadedRows);
    const grnBase = getGrnFilterOptions(dateScopedGrn);
    const grnCascaded = getGrnFilterOptions(cascadedGrn);

    const organizations = filterOrganizationOptions(baseOpts.organizations, access);
    const organizationNames = q.organization
      ? companyOpts.organizationNames
      : baseOpts.organizationNames;

    res.json({
      success: true,
      data: {
        ...cascadedOpts,
        organizations,
        organizationNames,
        // If no company selected, OUs from full date scope; else company-scoped
        operatingUnits: q.organization
          ? cascadedOpts.operatingUnits
          : baseOpts.operatingUnits,
        receivingOrgs: q.organization || q.organizationName || q.operatingUnit
          ? grnCascaded.receivingOrgs
          : grnBase.receivingOrgs,
        grnUsers: q.organization || q.organizationName || q.operatingUnit
          ? grnCascaded.grnUsers
          : grnBase.grnUsers,
        years: baseOpts.years.length ? baseOpts.years : cascadedOpts.years,
        grnLinkages: hasDomain(access, "grn")
          ? [
              { value: "withGrn", label: "With GRN" },
              { value: "withoutGrn", label: "Without GRN" },
            ]
          : [],
        poToGrnAgingBuckets: hasDomain(access, "grn")
          ? ["0-7 Days", "8-14 Days", "15-30 Days", "30+ Days"]
          : [],
        grnReturnStatuses: hasDomain(access, "grn")
          ? [
              { value: "return", label: "Returned to Vendor" },
              { value: "acceptReject", label: "QC Partial Reject" },
              { value: "deliveryGap", label: "Not Fully Delivered" },
              { value: "clean", label: "All OK" },
            ]
          : [],
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get("/drilldown", async (req, res, next) => {
  try {
    const rows = await withFiltered(req);
    const { level, value } = req.query;

    let filtered = rows;
    if (level === "department" && value) {
      filtered = rows.filter((r) => resolveDepartmentName(r.DEPARTMENT) === String(value).trim());
    } else if (level === "organization" && value && value !== "ALL") {
      const primary = primaryCompName(rows);
      filtered = rows.filter((r) => resolveLegalEntityName(r, primary) === String(value).trim());
    } else if (level === "operatingUnit" && value) {
      filtered = rows.filter((r) => operatingUnitName(r) === String(value).trim());
    } else if (level === "prCreator" && value) {
      filtered = rows.filter((r) => r.REQ_CREADED_BY === value);
    } else if (level === "poCreator" && value) {
      filtered = rows.filter((r) => r.PO_CREATED_BY === value);
    } else if (level === "approver" && value) {
      filtered = rows.filter((r) => resolveFinalApprover(r) === value);
    } else if (level === "reqNo" && value) {
      filtered = rows.filter((r) => String(r.REQ_NO) === String(value));
    } else if (level === "poNo" && value) {
      filtered = rows.filter((r) => String(r.PO_NO) === String(value));
    } else if (level === "itemCode" && value) {
      filtered = rows.filter((r) => String(r.ITEM_CODE || "").trim() === String(value).trim());
    } else if (level === "vendor" && value) {
      filtered = rows.filter((r) => String(r.VENDOR_ID) === String(value));
    } else if (level === "purchaseType" && value) {
      filtered = rows.filter((r) => {
        const t = String(r.PURCHASE_TYPE || "").trim() || "Unspecified";
        return t === value;
      });
    } else if (level === "poRevised" && value) {
      filtered = rows.filter((r) => {
        if (r.PO_NO == null || String(r.PO_NO).trim() === "") return false;
        const n = Number(r.PO_REVISED_COUNT);
        const rev = Number.isFinite(n) ? n : 0;
        const b = rev >= 4 ? "4+" : String(Math.max(0, Math.floor(rev)));
        if (value === "revised" || value === "1+") return rev > 0;
        return b === value;
      });
    } else if (level === "poLinkage" && value) {
      filtered = rows.filter((r) => {
        if (r.PO_NO == null || String(r.PO_NO).trim() === "") return false;
        const hasPr = !(r.REQ_NO == null || String(r.REQ_NO).trim() === "");
        if (value === "withPr") return hasPr;
        if (value === "withoutPr") return !hasPr;
        return false;
      });
    } else if (level === "approvalStatus" && value) {
      const status = String(value).toUpperCase();
      const finalApprovedPos = new Set();
      for (const r of rows) {
        if (r.PO_NO && String(r.APPROVER_FINAL || "").trim()) {
          finalApprovedPos.add(String(r.PO_NO));
        }
      }
      if (status === "APPROVED") {
        filtered = rows.filter(
          (r) => r.PO_NO && finalApprovedPos.has(String(r.PO_NO))
        );
      } else if (status === "PENDING") {
        filtered = rows.filter(
          (r) => r.PO_NO && !finalApprovedPos.has(String(r.PO_NO))
        );
      } else if (status === "REJECTED") {
        filtered = rows.filter(
          (r) =>
            String(r.PO_APPROVE || "").toUpperCase() === "REJECT" ||
            String(r.PO_AUTHORIZATION_STATUS || "").toUpperCase() === "REJECTED"
        );
      }
    } else if (level === "receivingOrg" && value) {
      const grnRows = await withFilteredGrn(req, rows);
      const pos = new Set(
        grnRows.filter((r) => String(r.ORG_RECEIVING_RSL || "").trim() === String(value).trim()).map((r) => String(r.PO_NO))
      );
      filtered = rows.filter((r) => pos.has(String(r.PO_NO)));
    } else if (level === "receiptNum" && value) {
      const grnRows = await withFilteredGrn(req, rows);
      const pos = new Set(grnRows.filter((r) => String(r.RECEIPT_NUM) === String(value)).map((r) => String(r.PO_NO)));
      filtered = rows.filter((r) => pos.has(String(r.PO_NO)));
    } else if (level === "poToGrnAging" && value) {
      const { applyGrnFilters } = require("../services/grnService");
      const grnFiltered = applyGrnFilters(await getPo2GrnData(), { ...req.query, poToGrnAging: value }, rows);
      const poSet = new Set(grnFiltered.map((r) => String(r.PO_NO)));
      filtered = rows.filter((r) => poSet.has(String(r.PO_NO)));
    } else if (level === "grnLinkage" && value) {
      const grnRaw = await getPo2GrnData();
      const grnPos = new Set(
        grnRaw.filter((r) => r.RECEIPT_NUM || r.GRN_DATE).map((r) => String(r.PO_NO))
      );
      filtered = rows.filter((r) => {
        if (!r.PO_NO) return false;
        const has = grnPos.has(String(r.PO_NO));
        if (value === "withGrn") return has;
        if (value === "withoutGrn") return !has;
        return false;
      });
    } else if (level === "grnReturnStatus" && value) {
      const { applyGrnFilters } = require("../services/grnService");
      const grnFiltered = applyGrnFilters(await getPo2GrnData(), { grnReturnStatus: value });
      const poSet = new Set(grnFiltered.map((r) => String(r.PO_NO)));
      filtered = rows.filter((r) => poSet.has(String(r.PO_NO)));
    }
    // overview / aging / ALL → keep currently filtered rows

    res.json({
      success: true,
      data: {
        kpis: getKpis(filtered),
        prCreators: groupUniqueCount(filtered, "REQ_CREADED_BY", "REQ_NO").slice(0, 20),
        poCreators: groupUniqueCount(filtered, "PO_CREATED_BY", "PO_NO").slice(0, 20),
        records: paginateTable(filtered, { ...req.query, pageSize: req.query.pageSize || 50 }),
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    await getRawData(true);
    await getPo2GrnData(true);
    res.json({ success: true, message: "Cache refreshed" });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
