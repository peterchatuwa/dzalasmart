import { HttpError } from "./util.js";

/**
 * NGO & Donors M&E Telemetry Module
 * Provides monitoring and evaluation metrics for development programs
 */

export async function getTelemetryDashboard(db, filters = {}) {
  const { district, startDate, endDate } = filters;
  const now = Date.now();
  const start = startDate || now - 90 * 24 * 60 * 60 * 1000; // Default: last 90 days
  const end = endDate || now;

  // Farmer registration trends
  const farmerQuery = district
    ? "SELECT COUNT(*) as count, district FROM farmers WHERE created_at >= ? AND created_at <= ? AND district = ? GROUP BY district"
    : "SELECT COUNT(*) as count, district FROM farmers WHERE created_at >= ? AND created_at <= ? GROUP BY district";

  const farmerParams = district ? [start, end, district] : [start, end];
  const farmersByDistrict = await db.prepare(farmerQuery).all(...farmerParams);

  // Input voucher utilization
  const voucherQuery = district
    ? `SELECT 
        COUNT(*) as total_issued,
        SUM(CASE WHEN status = 'redeemed' THEN 1 ELSE 0 END) as redeemed,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
      FROM farmer_vouchers fv
      JOIN farmers f ON fv.farmer_id = f.id
      WHERE fv.issued_at >= ? AND fv.issued_at <= ? AND f.district = ?`
    : `SELECT 
        COUNT(*) as total_issued,
        SUM(CASE WHEN status = 'redeemed' THEN 1 ELSE 0 END) as redeemed,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
      FROM farmer_vouchers
      WHERE issued_at >= ? AND issued_at <= ?`;

  const voucherParams = district ? [start, end, district] : [start, end];
  const voucherStats = await db.prepare(voucherQuery).get(...voucherParams);

  // Group membership trends
  const groupQuery = district
    ? `SELECT 
        COUNT(DISTINCT g.id) as total_groups,
        COUNT(gm.id) as total_members,
        AVG(g.member_count) as avg_group_size
      FROM farmer_groups g
      LEFT JOIN farmer_group_members gm ON g.id = gm.group_id AND gm.status = 'active'
      WHERE g.district = ?`
    : `SELECT 
        COUNT(DISTINCT g.id) as total_groups,
        COUNT(gm.id) as total_members,
        AVG(g.member_count) as avg_group_size
      FROM farmer_groups g
      LEFT JOIN farmer_group_members gm ON g.id = gm.group_id AND gm.status = 'active'`;

  const groupParams = district ? [district] : [];
  const groupStats = await db.prepare(groupQuery).get(...groupParams);

  // Extension visit effectiveness
  const visitQuery = district
    ? `SELECT 
        COUNT(*) as total_visits,
        COUNT(DISTINCT farmer_id) as farmers_reached,
        SUM(CASE WHEN follow_up_required = 1 THEN 1 ELSE 0 END) as follow_ups_needed
      FROM extension_visits ev
      JOIN farmers f ON ev.farmer_id = f.id
      WHERE ev.visit_date >= ? AND ev.visit_date <= ? AND f.district = ?`
    : `SELECT 
        COUNT(*) as total_visits,
        COUNT(DISTINCT farmer_id) as farmers_reached,
        SUM(CASE WHEN follow_up_required = 1 THEN 1 ELSE 0 END) as follow_ups_needed
      FROM extension_visits
      WHERE visit_date >= ? AND visit_date <= ?`;

  const visitParams = district ? [start, end, district] : [start, end];
  const visitStats = await db.prepare(visitQuery).get(...visitParams);

  // Loan disbursement data
  const loanQuery = district
    ? `SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'approved' THEN requested_amount ELSE 0 END) as total_disbursed,
        AVG(CASE WHEN status = 'approved' THEN requested_amount END) as avg_loan_amount
      FROM loan_requests lr
      JOIN farmers f ON lr.farmer_id = f.id
      WHERE lr.requested_at >= ? AND lr.requested_at <= ? AND f.district = ?`
    : `SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'approved' THEN requested_amount ELSE 0 END) as total_disbursed,
        AVG(CASE WHEN status = 'approved' THEN requested_amount END) as avg_loan_amount
      FROM loan_requests
      WHERE requested_at >= ? AND requested_at <= ?`;

  const loanParams = district ? [start, end, district] : [start, end];
  const loanStats = await db.prepare(loanQuery).get(...loanParams);

  // Gender disaggregation
  const genderQuery = district
    ? "SELECT gender, COUNT(*) as count FROM farmers WHERE district = ? GROUP BY gender"
    : "SELECT gender, COUNT(*) as count FROM farmers GROUP BY gender";

  const genderParams = district ? [district] : [];
  const genderBreakdown = await db.prepare(genderQuery).all(...genderParams);

  // Calculate redemption rate
  const redemptionRate =
    voucherStats.total_issued > 0 ? ((voucherStats.redeemed / voucherStats.total_issued) * 100).toFixed(1) : 0;

  // Calculate loan approval rate
  const approvalRate = loanStats.total_requests > 0 ? ((loanStats.approved / loanStats.total_requests) * 100).toFixed(1) : 0;

  return {
    period: {
      start,
      end,
      days: Math.floor((end - start) / (24 * 60 * 60 * 1000)),
    },
    district: district || "All Districts",
    farmers: {
      byDistrict: farmersByDistrict,
      total: farmersByDistrict.reduce((sum, d) => sum + d.count, 0),
      genderBreakdown,
    },
    vouchers: {
      totalIssued: voucherStats.total_issued || 0,
      redeemed: voucherStats.redeemed || 0,
      expired: voucherStats.expired || 0,
      active: voucherStats.active || 0,
      redemptionRate: `${redemptionRate}%`,
    },
    groups: {
      totalGroups: groupStats.total_groups || 0,
      totalMembers: groupStats.total_members || 0,
      avgGroupSize: groupStats.avg_group_size ? Math.round(groupStats.avg_group_size) : 0,
    },
    extension: {
      totalVisits: visitStats.total_visits || 0,
      farmersReached: visitStats.farmers_reached || 0,
      followUpsNeeded: visitStats.follow_ups_needed || 0,
      avgVisitsPerFarmer:
        visitStats.farmers_reached > 0 ? (visitStats.total_visits / visitStats.farmers_reached).toFixed(1) : 0,
    },
    loans: {
      totalRequests: loanStats.total_requests || 0,
      approved: loanStats.approved || 0,
      totalDisbursed: loanStats.total_disbursed || 0,
      avgLoanAmount: loanStats.avg_loan_amount ? Math.round(loanStats.avg_loan_amount) : 0,
      approvalRate: `${approvalRate}%`,
    },
  };
}

export async function getImpactMetrics(db, filters = {}) {
  const { district } = filters;

  // Season completion rates
  const seasonQuery = district
    ? `SELECT 
        COUNT(DISTINCT farmer_id) as total_farmers,
        COUNT(DISTINCT CASE WHEN stage_index >= 7 THEN farmer_id END) as completed_season
      FROM season_events se
      JOIN farmers f ON se.farmer_id = f.id
      WHERE f.district = ?`
    : `SELECT 
        COUNT(DISTINCT farmer_id) as total_farmers,
        COUNT(DISTINCT CASE WHEN stage_index >= 7 THEN farmer_id END) as completed_season
      FROM season_events`;

  const seasonParams = district ? [district] : [];
  const seasonStats = await db.prepare(seasonQuery).get(...seasonParams);

  // Warehouse grain deliveries
  const warehouseQuery = district
    ? `SELECT 
        COUNT(*) as total_receipts,
        SUM(weight_kg) as total_kg,
        AVG(weight_kg) as avg_kg_per_farmer,
        SUM(loan_disbursed) as total_loans_disbursed
      FROM warehouse_receipts wr
      JOIN farmers f ON wr.farmer_id = f.id
      WHERE f.district = ?`
    : `SELECT 
        COUNT(*) as total_receipts,
        SUM(weight_kg) as total_kg,
        AVG(weight_kg) as avg_kg_per_farmer,
        SUM(loan_disbursed) as total_loans_disbursed
      FROM warehouse_receipts`;

  const warehouseParams = district ? [district] : [];
  const warehouseStats = await db.prepare(warehouseQuery).get(...warehouseParams);

  const completionRate =
    seasonStats.total_farmers > 0 ? ((seasonStats.completed_season / seasonStats.total_farmers) * 100).toFixed(1) : 0;

  return {
    district: district || "All Districts",
    seasonProgress: {
      totalFarmers: seasonStats.total_farmers || 0,
      completedSeason: seasonStats.completed_season || 0,
      completionRate: `${completionRate}%`,
    },
    production: {
      totalReceipts: warehouseStats.total_receipts || 0,
      totalKg: warehouseStats.total_kg || 0,
      avgKgPerFarmer: warehouseStats.avg_kg_per_farmer ? Math.round(warehouseStats.avg_kg_per_farmer) : 0,
      totalLoansDisbursed: warehouseStats.total_loans_disbursed || 0,
    },
  };
}
