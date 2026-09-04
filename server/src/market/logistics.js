import { HttpError } from "../util.js";
import { fmtPricePerKg } from "./normalize.js";
import { DISTRICT_COORDS } from "../places.js";
import { WAREHOUSE_COORDS, WAREHOUSE_HUBS, haversineKm } from "./locations.js";

const DEFAULT_LOAD_KG = 1000;
const DEFAULT_RATE_PER_KM = 0.65;

function routeKey(fromDistrict, toDistrict) {
  return `${fromDistrict}→${toDistrict}`;
}

function hubCoords(district) {
  return WAREHOUSE_COORDS[district] || DISTRICT_COORDS[district] || null;
}

export function estimateDistanceKm(fromDistrict, toDistrict) {
  const from = hubCoords(fromDistrict);
  const to = hubCoords(toDistrict);
  if (!from || !to) return null;
  return Math.round(haversineKm(from, to));
}

export function estimateCostPerKg(fromDistrict, toDistrict) {
  const distance = estimateDistanceKm(fromDistrict, toDistrict);
  if (distance == null) return null;
  return Math.max(15, Math.round(distance * DEFAULT_RATE_PER_KM));
}

export function transportCostPerKg(route, loadKg = DEFAULT_LOAD_KG) {
  if (!route) return null;
  const perKg = Number(route.costPerKg);
  const flat = Number(route.costFlatMwk || 0);
  const load = Math.max(1, Number(loadKg) || DEFAULT_LOAD_KG);
  if (!Number.isFinite(perKg)) return null;
  return perKg + (flat / load);
}

function mapRoute(row) {
  return {
    id: row.id,
    fromDistrict: row.from_district,
    toDistrict: row.to_district,
    distanceKm: row.distance_km,
    costPerKg: row.cost_per_kg,
    costFlatMwk: row.cost_flat_mwk,
    costLabel: fmtPricePerKg(row.cost_per_kg),
    notes: row.notes,
    updatedAt: row.updated_at,
    routeLabel: routeKey(row.from_district, row.to_district),
  };
}

export async function listLogisticsRoutes(db) {
  const rows = await db.prepare(`
    SELECT id, from_district, to_district, distance_km, cost_per_kg, cost_flat_mwk, notes, updated_at
    FROM market_logistics_routes
    ORDER BY from_district, to_district
  `).all();
  return rows.map(mapRoute);
}

export async function getLogisticsRoute(db, fromDistrict, toDistrict) {
  const row = await db.prepare(`
    SELECT id, from_district, to_district, distance_km, cost_per_kg, cost_flat_mwk, notes, updated_at
    FROM market_logistics_routes
    WHERE from_district = ? AND to_district = ?
  `).get(fromDistrict, toDistrict);
  return row ? mapRoute(row) : null;
}

export async function resolveTransportCost(db, fromDistrict, toDistrict, loadKg = DEFAULT_LOAD_KG) {
  const route = await getLogisticsRoute(db, fromDistrict, toDistrict);
  if (route) {
    return {
      ...route,
      transportPerKg: transportCostPerKg(route, loadKg),
      transportLabel: fmtPricePerKg(transportCostPerKg(route, loadKg)),
      estimated: false,
    };
  }
  const distanceKm = estimateDistanceKm(fromDistrict, toDistrict);
  const costPerKg = estimateCostPerKg(fromDistrict, toDistrict);
  if (costPerKg == null) return null;
  return {
    fromDistrict,
    toDistrict,
    distanceKm,
    costPerKg,
    costFlatMwk: null,
    transportPerKg: costPerKg,
    transportLabel: fmtPricePerKg(costPerKg),
    routeLabel: routeKey(fromDistrict, toDistrict),
    estimated: true,
  };
}

export async function upsertLogisticsRoute(db, input = {}) {
  const fromDistrict = String(input.fromDistrict || input.from || "").trim();
  const toDistrict = String(input.toDistrict || input.to || "").trim();
  if (!fromDistrict || !toDistrict) throw HttpError(400, "From and to districts are required");
  if (fromDistrict === toDistrict) throw HttpError(400, "Route must connect two different districts");

  const costPerKg = Number(input.costPerKg ?? input.cost_per_kg);
  if (!Number.isFinite(costPerKg) || costPerKg < 0) {
    throw HttpError(400, "costPerKg must be a non-negative number");
  }

  const distanceKm = input.distanceKm != null
    ? Number(input.distanceKm)
    : estimateDistanceKm(fromDistrict, toDistrict);
  const costFlatMwk = input.costFlatMwk != null ? Number(input.costFlatMwk) : null;
  const now = Date.now();
  const id = input.id || `route-${fromDistrict.toLowerCase()}-${toDistrict.toLowerCase()}`.replace(/[^a-z0-9-]+/g, "-");

  await db.prepare(`
    INSERT INTO market_logistics_routes (
      id, from_district, to_district, distance_km, cost_per_kg, cost_flat_mwk, notes, updated_at
    ) VALUES (@id, @from_district, @to_district, @distance_km, @cost_per_kg, @cost_flat_mwk, @notes, @updated_at)
    ON CONFLICT(from_district, to_district) DO UPDATE SET
      distance_km = EXCLUDED.distance_km,
      cost_per_kg = EXCLUDED.cost_per_kg,
      cost_flat_mwk = EXCLUDED.cost_flat_mwk,
      notes = EXCLUDED.notes,
      updated_at = EXCLUDED.updated_at
  `).run({
    id,
    from_district: fromDistrict,
    to_district: toDistrict,
    distance_km: distanceKm,
    cost_per_kg: costPerKg,
    cost_flat_mwk: costFlatMwk,
    notes: input.notes || null,
    updated_at: now,
  });

  return getLogisticsRoute(db, fromDistrict, toDistrict);
}

export async function seedLogisticsRoutes(db) {
  const existing = await db.prepare("SELECT COUNT(*) AS count FROM market_logistics_routes").get();
  if (Number(existing?.count) > 0) return;

  const pairs = [];
  for (const from of WAREHOUSE_HUBS) {
    for (const to of WAREHOUSE_HUBS) {
      if (from === to) continue;
      pairs.push({ from, to });
    }
  }
  for (const pair of pairs) {
    await upsertLogisticsRoute(db, {
      fromDistrict: pair.from,
      toDistrict: pair.to,
      costPerKg: estimateCostPerKg(pair.from, pair.to),
      distanceKm: estimateDistanceKm(pair.from, pair.to),
      notes: "Default warehouse-to-warehouse haulage estimate",
    });
  }
}

export function formatNetMargin(netMarginPerKg) {
  if (netMarginPerKg == null) return null;
  return fmtPricePerKg(netMarginPerKg);
}

export function formatTransportSummary(route, transportPerKg) {
  if (!route) return "Transport cost unknown";
  const bits = [`${route.fromDistrict} → ${route.toDistrict}`];
  if (route.distanceKm != null) bits.push(`${route.distanceKm} km`);
  bits.push(fmtPricePerKg(transportPerKg));
  if (route.estimated) bits.push("estimated");
  return bits.join(" · ");
}

export { DEFAULT_LOAD_KG, WAREHOUSE_HUBS };
