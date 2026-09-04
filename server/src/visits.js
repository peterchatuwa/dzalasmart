import { listPestReports } from "./advisor.js";
import { listFarmerSummaries } from "./farmers.js";
import { listReceiptsForFarmer } from "./warehouse.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function inArea(staff, place) {
  if (!staff || staff.role !== "extension") return true;
  if (staff.epa && place.epa) return place.epa === staff.epa;
  if (staff.district && place.district) return place.district === staff.district;
  return true;
}

function upsert(map, visit) {
  const prev = map.get(visit.farmerId);
  if (!prev) {
    map.set(visit.farmerId, visit);
    return;
  }
  const rank = { high: 2, routine: 1 };
  if ((rank[visit.priority] || 0) > (rank[prev.priority] || 0)) {
    map.set(visit.farmerId, visit);
    return;
  }
  if (visit.priority === prev.priority && visit.at > prev.at) {
    map.set(visit.farmerId, visit);
  }
}

export function visitQueue(db, staff) {
  const now = Date.now();
  const weekAgo = now - WEEK_MS;
  const farmers = listFarmerSummaries(db).filter((row) => inArea(staff, row.farmer));
  const pests = listPestReports(db).filter((row) => inArea(staff, row));
  const byFarmer = new Map();

  for (const report of pests) {
    upsert(byFarmer, {
      farmerId: report.farmerId,
      farmerName: report.farmerName,
      farmerCode: report.farmerCode,
      district: report.district,
      epa: report.epa,
      reason: report.matchName
        ? `Suspected ${report.matchName}`
        : "Pest report waiting for a field visit",
      priority: "high",
      source: "pest",
      at: report.createdAt,
    });
  }

  for (const row of farmers) {
    const farmer = row.farmer;
    const receipts = listReceiptsForFarmer(db, farmer.id);
    const accepted = receipts.filter((item) => item.status === "accepted");
    const pendingLoan = receipts.some((item) => item.loanPending);
    const stageKey = row.currentStage?.key || null;
    const stageIndex = row.currentStage?.index ?? -1;

    if (pendingLoan) {
      upsert(byFarmer, {
        farmerId: farmer.id,
        farmerName: farmer.name,
        farmerCode: farmer.code,
        district: farmer.district,
        epa: farmer.epa,
        reason: "Warehouse loan waiting for the farmer to accept",
        priority: "routine",
        source: "loan",
        at: row.lastEventAt || farmer.createdAt,
      });
    }

    if (stageIndex >= 4 && accepted.length === 0) {
      upsert(byFarmer, {
        farmerId: farmer.id,
        farmerName: farmer.name,
        farmerCode: farmer.code,
        district: farmer.district,
        epa: farmer.epa,
        reason: "Harvest logged — grain not yet taken in at the warehouse",
        priority: "high",
        source: "harvest",
        at: row.lastEventAt || now,
      });
    } else if (stageIndex < 0) {
      upsert(byFarmer, {
        farmerId: farmer.id,
        farmerName: farmer.name,
        farmerCode: farmer.code,
        district: farmer.district,
        epa: farmer.epa,
        reason: "First planting-season check-in",
        priority: "routine",
        source: "onboarding",
        at: farmer.createdAt,
      });
    } else if (stageKey === "input_redemption") {
      upsert(byFarmer, {
        farmerId: farmer.id,
        farmerName: farmer.name,
        farmerCode: farmer.code,
        district: farmer.district,
        epa: farmer.epa,
        reason: "Input voucher redeemed — follow up on land preparation",
        priority: "routine",
        source: "stage",
        at: row.lastEventAt || now,
      });
    }
  }

  const visits = [...byFarmer.values()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
    return b.at - a.at;
  });

  const ussdFarmers = new Set(
    db.prepare(`
      SELECT DISTINCT farmer_id FROM season_events
      WHERE channel = 'ussd' AND created_at >= ?
    `).all(weekAgo).map((row) => row.farmer_id)
  );
  for (const row of db.prepare(`
    SELECT DISTINCT farmer_id FROM pest_reports
    WHERE channel = 'ussd' AND created_at >= ?
  `).all(weekAgo)) {
    ussdFarmers.add(row.farmer_id);
  }

  const area = staff?.role === "extension"
    ? [staff.epa, staff.district].filter(Boolean).join(" · ") || "Assigned area"
    : "All districts";

  return {
    area,
    visits,
    stats: {
      flagged: visits.length,
      high: visits.filter((row) => row.priority === "high").length,
      routine: visits.filter((row) => row.priority === "routine").length,
      openPestReports: pests.length,
      ussdFarmersThisWeek: ussdFarmers.size,
    },
  };
}
