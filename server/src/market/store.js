import { fmtPricePerKg, relativeUpdatedLabel } from "./normalize.js";
import { matchCommodityName } from "./catalog.js";
import { districtSlug, nearestWarehouseHub } from "./locations.js";
import {
  commodityIdBySlug,
  locationIdBySlug,
  sourceIdBySlug,
} from "./seed.js";

const INSERT_OBS = `
  INSERT INTO market_price_observations (
    id, source_id, commodity_id, location_id,
    buy_price_per_kg, sell_price_per_kg, raw_unit, raw_amount,
    price_kind, grade, notes, observed_at, fetched_at, metadata_json
  ) VALUES (
    @id, @source_id, @commodity_id, @location_id,
    @buy_price_per_kg, @sell_price_per_kg, @raw_unit, @raw_amount,
    @price_kind, @grade, @notes, @observed_at, @fetched_at, @metadata_json
  )
`;

export async function updateSourceStatus(db, slug, { ok, error = null }) {
  const now = Date.now();
  if (ok) {
    await db.prepare(`
      UPDATE market_sources
      SET last_ok_at = ?, last_error = NULL, updated_at = ?
      WHERE slug = ?
    `).run(now, now, slug);
  } else {
    await db.prepare(`
      UPDATE market_sources
      SET last_error = ?, updated_at = ?
      WHERE slug = ?
    `).run(String(error || "Unknown error").slice(0, 500), now, slug);
  }
}

export async function insertObservations(db, sourceSlug, rows, fetchedAt = Date.now()) {
  const sourceId = await sourceIdBySlug(db, sourceSlug);
  if (!sourceId) throw new Error(`Unknown market source: ${sourceSlug}`);
  let count = 0;
  for (const row of rows) {
    const commodityId = row.commodityId
      || (row.commoditySlug ? await commodityIdBySlug(db, row.commoditySlug) : null);
    const locationId = row.locationId
      || (row.locationSlug ? await locationIdBySlug(db, row.locationSlug) : null);
    if (!commodityId || !locationId) continue;
    await db.prepare(INSERT_OBS).run({
      id: crypto.randomUUID(),
      source_id: sourceId,
      commodity_id: commodityId,
      location_id: locationId,
      buy_price_per_kg: row.buyPricePerKg ?? null,
      sell_price_per_kg: row.sellPricePerKg ?? null,
      raw_unit: row.rawUnit || "kg",
      raw_amount: row.rawAmount ?? row.buyPricePerKg ?? null,
      price_kind: row.priceKind || "market",
      grade: row.grade || null,
      notes: row.notes || null,
      observed_at: row.observedAt || fetchedAt,
      fetched_at: fetchedAt,
      metadata_json: row.metadata ? JSON.stringify(row.metadata) : null,
    });
    count += 1;
  }
  return count;
}

function mapObservationRow(row) {
  return {
    id: row.id,
    commodity: row.commodity_name,
    commoditySlug: row.commodity_slug,
    market: row.location_name,
    locationSlug: row.location_slug,
    district: row.district,
    region: row.region,
    buyPricePerKg: row.buy_price_per_kg,
    sellPricePerKg: row.sell_price_per_kg,
    buyPrice: fmtPricePerKg(row.buy_price_per_kg),
    sellPrice: fmtPricePerKg(row.sell_price_per_kg),
    source: row.source_name,
    sourceSlug: row.source_slug,
    priceKind: row.price_kind,
    grade: row.grade,
    observedAt: Number(row.observed_at) || null,
    fetchedAt: Number(row.fetched_at) || null,
    updatedLabel: relativeUpdatedLabel(row.fetched_at),
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
  };
}

const OBS_SELECT = `
  SELECT o.*,
         c.name AS commodity_name, c.slug AS commodity_slug,
         l.name AS location_name, l.slug AS location_slug, l.district, l.region,
         s.name AS source_name, s.slug AS source_slug
  FROM market_price_observations o
  JOIN market_commodities c ON c.id = o.commodity_id
  JOIN market_locations l ON l.id = o.location_id
  JOIN market_sources s ON s.id = o.source_id
`;

export async function listLatestPrices(db, filters = {}) {
  const params = [];
  const where = ["c.active = 1"];

  if (filters.commoditySlug) {
    params.push(filters.commoditySlug);
    where.push(`c.slug = $${params.length}`);
  }
  if (filters.sourceSlug) {
    params.push(filters.sourceSlug);
    where.push(`s.slug = $${params.length}`);
  }
  if (filters.district) {
    const hub = nearestWarehouseHub(filters.district);
    params.push(filters.district, hub, `warehouse-${districtSlug(hub)}`, "ulimi-national");
    where.push(`(
      l.district = $${params.length - 3}
      OR l.district = $${params.length - 2}
      OR l.slug = $${params.length - 1}
      OR l.slug = $${params.length}
    )`);
  }
  if (filters.region) {
    params.push(filters.region);
    where.push(`l.region = $${params.length}`);
  }

  const sql = `
    SELECT DISTINCT ON (o.commodity_id, o.location_id, o.source_id)
      o.id, o.source_id, o.commodity_id, o.location_id,
      o.buy_price_per_kg, o.sell_price_per_kg, o.raw_unit, o.raw_amount,
      o.price_kind, o.grade, o.notes, o.observed_at, o.fetched_at, o.metadata_json,
      c.name AS commodity_name, c.slug AS commodity_slug,
      l.name AS location_name, l.slug AS location_slug, l.district, l.region,
      s.name AS source_name, s.slug AS source_slug
    FROM market_price_observations o
    JOIN market_commodities c ON c.id = o.commodity_id
    JOIN market_locations l ON l.id = o.location_id
    JOIN market_sources s ON s.id = o.source_id
    WHERE ${where.join(" AND ")}
    ORDER BY o.commodity_id, o.location_id, o.source_id, o.fetched_at DESC
  `;

  const result = await db.query(sql, params);
  return result.rows.map(mapObservationRow);
}

export async function priceHistory(db, filters = {}) {
  const params = [];
  const where = ["1=1"];
  const days = Math.min(365, Math.max(1, Number(filters.days) || 30));
  params.push(Date.now() - days * 86_400_000);
  where.push(`o.fetched_at >= $${params.length}`);

  if (filters.commoditySlug) {
    params.push(filters.commoditySlug);
    where.push(`c.slug = $${params.length}`);
  }
  if (filters.district) {
    params.push(filters.district);
    where.push(`l.district = $${params.length}`);
  }
  if (filters.sourceSlug) {
    params.push(filters.sourceSlug);
    where.push(`s.slug = $${params.length}`);
  }
  if (filters.locationSlug) {
    params.push(filters.locationSlug);
    where.push(`l.slug = $${params.length}`);
  }

  const limit = Math.min(5000, Math.max(1, Number(filters.maxRows) || 500));
  const sql = `
    ${OBS_SELECT}
    WHERE ${where.join(" AND ")}
    ORDER BY o.fetched_at ASC
    LIMIT ${limit}
  `;
  const rows = await db.query(sql, params);
  return rows.rows.map(mapObservationRow);
}

export async function listSources(db) {
  return (await db.prepare(`
    SELECT slug, name, kind, url, enabled, last_ok_at, last_error, updated_at
    FROM market_sources
    ORDER BY name
  `).all()).map((row) => ({
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    url: row.url,
    enabled: Boolean(row.enabled),
    lastOkAt: row.last_ok_at,
    lastError: row.last_error,
    updatedAt: row.updated_at,
    status: row.last_error ? "error" : row.last_ok_at ? "ok" : "pending",
    updatedLabel: relativeUpdatedLabel(row.last_ok_at || row.updated_at),
  }));
}

export async function listCommodities(db) {
  return (await db.prepare(`
    SELECT slug, name, aliases_json FROM market_commodities WHERE active = 1 ORDER BY name
  `).all()).map((row) => ({
    slug: row.slug,
    name: row.name,
    aliases: JSON.parse(row.aliases_json || "[]"),
  }));
}

export async function latestPriceForCrop(db, crop, district = null) {
  const commodity = await resolveCommodity(db, crop);
  if (!commodity) return null;
  const rows = await listLatestPrices(db, { commoditySlug: commodity.slug, district });
  const localbuy = rows.find((r) => r.sourceSlug === "localbuy" && r.buyPricePerKg != null);
  if (localbuy) return localbuy.buyPricePerKg;
  const ulimi = rows.find((r) => r.sourceSlug === "ulimi" && r.buyPricePerKg != null);
  if (ulimi) return ulimi.buyPricePerKg;
  return rows.find((r) => r.buyPricePerKg != null)?.buyPricePerKg ?? null;
}

export async function resolveCommodity(db, crop) {
  const name = String(crop || "").trim();
  const matched = matchCommodityName(name);
  if (matched) {
    return db.prepare("SELECT id, slug, name FROM market_commodities WHERE slug = ?").get(matched.slug);
  }
  return db.prepare(`
    SELECT id, slug, name FROM market_commodities
    WHERE LOWER(name) = LOWER(?)
    LIMIT 1
  `).get(name);
}

export async function resolveLocation(db, { district, locationSlug }) {
  if (locationSlug) {
    return db.prepare("SELECT id, slug, name, district FROM market_locations WHERE slug = ?").get(locationSlug);
  }
  if (district) {
    return db.prepare("SELECT id, slug, name, district FROM market_locations WHERE district = ? AND type = 'district'").get(district);
  }
  return null;
}
