import { HttpError } from "./util.js";

/**
 * Financial Institutions Module
 * Provides grain-backed lending dashboard for lenders
 */

export async function getLendingOpportunities(db, filters = {}) {
  const { district, minBankability, limit = 50 } = filters;

  // Get farmers with stored grain and their bankability scores
  let query = `
    SELECT 
      f.id,
      f.name,
      f.phone,
      f.district,
      f.epa,
      f.household_size,
      f.years_of_experience,
      wr.id as receipt_id,
      wr.code as receipt_code,
      wr.crop,
      wr.weight_kg,
      wr.moisture_pct,
      wr.asset_value,
      wr.loan_cap,
      wr.loan_disbursed,
      wr.status as receipt_status,
      wr.created_at as receipt_date
    FROM farmers f
    JOIN warehouse_receipts wr ON f.id = wr.farmer_id
    WHERE wr.status = 'accepted' AND wr.loan_disbursed = 0
  `;

  const params = [];

  if (district) {
    query += " AND f.district = ?";
    params.push(district);
  }

  query += " ORDER BY wr.asset_value DESC";

  if (limit) {
    query += " LIMIT ?";
    params.push(limit);
  }

  const opportunities = await db.prepare(query).all(...params);

  // For each opportunity, compute their bankability score
  // This is simplified - in production, call the actual bankability function
  const enrichedOpportunities = opportunities.map((opp) => {
    // Simple heuristic bankability based on available data
    let score = 50;
    if (opp.years_of_experience >= 5) score += 10;
    if (opp.household_size >= 3 && opp.household_size <= 7) score += 10;
    if (opp.moisture_pct <= 13.5) score += 15;
    if (opp.weight_kg >= 1000) score += 15;

    const grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
    const riskLevel = score >= 70 ? "low" : score >= 50 ? "medium" : "high";

    return {
      ...opp,
      bankability: {
        score,
        grade,
        riskLevel,
      },
      loanAvailable: opp.loan_cap,
      collateralValue: opp.asset_value,
    };
  });

  // Filter by minimum bankability if specified
  const filtered = minBankability
    ? enrichedOpportunities.filter((o) => o.bankability.score >= minBankability)
    : enrichedOpportunities;

  return filtered;
}

export async function getLendingPortfolio(db, filters = {}) {
  const { district } = filters;

  // Get all disbursed loans
  let query = `
    SELECT 
      lr.id,
      lr.requested_amount,
      lr.status,
      lr.requested_at,
      lr.disbursed_at,
      f.name as farmer_name,
      f.phone as farmer_phone,
      f.district,
      wr.code as receipt_code,
      wr.crop,
      wr.weight_kg,
      wr.asset_value
    FROM loan_requests lr
    JOIN farmers f ON lr.farmer_id = f.id
    JOIN warehouse_receipts wr ON lr.receipt_id = wr.id
    WHERE lr.status = 'approved'
  `;

  const params = [];

  if (district) {
    query += " AND f.district = ?";
    params.push(district);
  }

  query += " ORDER BY lr.disbursed_at DESC";

  const loans = await db.prepare(query).all(...params);

  // Calculate portfolio metrics
  const totalDisbursed = loans.reduce((sum, l) => sum + l.requested_amount, 0);
  const totalCollateral = loans.reduce((sum, l) => sum + l.asset_value, 0);
  const avgLoanSize = loans.length > 0 ? totalDisbursed / loans.length : 0;

  const byDistrict = {};
  loans.forEach((loan) => {
    if (!byDistrict[loan.district]) {
      byDistrict[loan.district] = {
        district: loan.district,
        count: 0,
        totalDisbursed: 0,
        totalCollateral: 0,
      };
    }
    byDistrict[loan.district].count += 1;
    byDistrict[loan.district].totalDisbursed += loan.requested_amount;
    byDistrict[loan.district].totalCollateral += loan.asset_value;
  });

  return {
    loans,
    summary: {
      totalLoans: loans.length,
      totalDisbursed,
      totalCollateral,
      avgLoanSize: Math.round(avgLoanSize),
      collateralCoverage: totalDisbursed > 0 ? ((totalCollateral / totalDisbursed) * 100).toFixed(1) + "%" : "N/A",
    },
    byDistrict: Object.values(byDistrict),
  };
}

export async function getRiskAssessment(db, filters = {}) {
  const { district } = filters;

  // Get loan performance data
  let query = `
    SELECT 
      COUNT(*) as total_requests,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM loan_requests lr
    JOIN farmers f ON lr.farmer_id = f.id
  `;

  const params = [];

  if (district) {
    query += " WHERE f.district = ?";
    params.push(district);
  }

  const stats = await db.prepare(query).get(...params);

  const approvalRate = stats.total_requests > 0 ? ((stats.approved / stats.total_requests) * 100).toFixed(1) : 0;
  const rejectionRate = stats.total_requests > 0 ? ((stats.rejected / stats.total_requests) * 100).toFixed(1) : 0;

  return {
    district: district || "All Districts",
    totalRequests: stats.total_requests || 0,
    approved: stats.approved || 0,
    rejected: stats.rejected || 0,
    pending: stats.pending || 0,
    approvalRate: `${approvalRate}%`,
    rejectionRate: `${rejectionRate}%`,
    riskLevel: approvalRate >= 80 ? "low" : approvalRate >= 60 ? "medium" : "high",
  };
}
