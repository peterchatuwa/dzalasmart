import { HttpError } from "../util.js";
import { fmtMoney, fmtPricePerKg } from "./normalize.js";
import { listLatestPrices } from "./store.js";
import { resolveCompareCommodity } from "./compare.js";

const DEBOUNCE_MS = 24 * 60 * 60 * 1000;

function mapAlertRow(row) {
  return {
    id: row.id,
    commoditySlug: row.commodity_slug,
    district: row.district,
    locationSlug: row.location_slug,
    direction: row.direction,
    thresholdPerKg: row.threshold_per_kg,
    thresholdLabel: fmtPricePerKg(row.threshold_per_kg),
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastTriggeredAt: row.last_triggered_at,
  };
}

function mapEventRow(row) {
  return {
    id: row.id,
    alertId: row.alert_id,
    commoditySlug: row.commodity_slug,
    district: row.district,
    locationSlug: row.location_slug,
    direction: row.direction,
    thresholdPerKg: row.threshold_per_kg,
    observedPricePerKg: row.observed_price_per_kg,
    observedPriceLabel: fmtPricePerKg(row.observed_price_per_kg),
    sourceSlug: row.source_slug,
    message: row.message,
    triggeredAt: row.triggered_at,
  };
}

export async function listFarmerAlerts(db, farmerId) {
  const rows = await db
    .prepare(
      `
    SELECT * FROM market_price_alerts
    WHERE farmer_id = ?
    ORDER BY active DESC, updated_at DESC
  `
    )
    .all(farmerId);
  return rows.map(mapAlertRow);
}

export async function listFarmerAlertEvents(db, farmerId, limit = 20) {
  const rows = await db
    .prepare(
      `
    SELECT * FROM market_price_alert_events
    WHERE farmer_id = ?
    ORDER BY triggered_at DESC
    LIMIT ?
  `
    )
    .all(farmerId, Math.min(100, Math.max(1, limit)));
  return rows.map(mapEventRow);
}

export async function createFarmerAlert(db, farmer, input = {}) {
  const commodity = await resolveCompareCommodity(db, input.commodity || input.commoditySlug);
  if (!commodity) throw HttpError(400, "Unknown commodity");
  const district = String(input.district || farmer.district || "").trim();
  if (!district) throw HttpError(400, "District is required");
  const direction = String(input.direction || "")
    .trim()
    .toLowerCase();
  if (!["above", "below"].includes(direction)) {
    throw HttpError(400, "Direction must be above or below");
  }
  const threshold = Number(input.thresholdPerKg ?? input.threshold);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw HttpError(400, "Threshold must be a positive price per kg");
  }
  const now = Date.now();
  const id = crypto.randomUUID();
  await db
    .prepare(
      `
    INSERT INTO market_price_alerts (
      id, farmer_id, commodity_slug, district, location_slug,
      direction, threshold_per_kg, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `
    )
    .run(
      id,
      farmer.id,
      commodity.slug,
      district,
      String(input.locationSlug || input.location || "").trim() || null,
      direction,
      threshold,
      now,
      now
    );
  return mapAlertRow(await db.prepare("SELECT * FROM market_price_alerts WHERE id = ?").get(id));
}

export async function deleteFarmerAlert(db, farmerId, alertId) {
  const row = await db
    .prepare(
      `
    SELECT * FROM market_price_alerts WHERE id = ? AND farmer_id = ?
  `
    )
    .get(alertId, farmerId);
  if (!row) throw HttpError(404, "Alert not found");
  await db.prepare("DELETE FROM market_price_alerts WHERE id = ?").run(alertId);
  return { ok: true, id: alertId };
}

async function latestPriceForAlert(db, alert) {
  const rows = await listLatestPrices(db, {
    commoditySlug: alert.commodity_slug,
    district: alert.district,
    locationSlug: alert.location_slug || undefined,
  });
  const preferred = alert.location_slug
    ? rows.find((row) => row.locationSlug === alert.location_slug && row.buyPricePerKg != null)
    : null;
  return preferred || rows.find((row) => row.buyPricePerKg != null) || null;
}

function shouldTrigger(alert, price) {
  if (price == null) return false;
  if (alert.direction === "above") return price >= alert.threshold_per_kg;
  return price <= alert.threshold_per_kg;
}

function buildAlertMessage(alert, observation) {
  const price = fmtPricePerKg(observation.buyPricePerKg);
  const threshold = fmtPricePerKg(alert.threshold_per_kg);
  const verb = alert.direction === "above" ? "rose above" : "fell below";
  const place = observation.market || alert.district;
  return `${observation.commodity || alert.commodity_slug} in ${place} ${verb} ${threshold} — now ${price} (${observation.source || "market feed"}).`;
}

export async function evaluateMarketAlerts(db) {
  const alerts = await db
    .prepare(
      `
    SELECT * FROM market_price_alerts WHERE active = 1
  `
    )
    .all();
  const triggered = [];
  const now = Date.now();

  for (const alert of alerts) {
    if (alert.last_triggered_at && now - alert.last_triggered_at < DEBOUNCE_MS) continue;
    const observation = await latestPriceForAlert(db, alert);
    if (!observation || !shouldTrigger(alert, observation.buyPricePerKg)) continue;

    const message = buildAlertMessage(alert, observation);
    const eventId = crypto.randomUUID();
    await db
      .prepare(
        `
      INSERT INTO market_price_alert_events (
        id, alert_id, farmer_id, commodity_slug, district, location_slug,
        direction, threshold_per_kg, observed_price_per_kg, source_slug, message, triggered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        eventId,
        alert.id,
        alert.farmer_id,
        alert.commodity_slug,
        alert.district,
        alert.location_slug,
        alert.direction,
        alert.threshold_per_kg,
        observation.buyPricePerKg,
        observation.sourceSlug || null,
        message,
        now
      );
    await db
      .prepare(
        `
      UPDATE market_price_alerts
      SET last_triggered_at = ?, updated_at = ?
      WHERE id = ?
    `
      )
      .run(now, now, alert.id);
    triggered.push(mapEventRow(await db.prepare("SELECT * FROM market_price_alert_events WHERE id = ?").get(eventId)));
  }

  return triggered;
}

export async function marketAlertsPayload(db, farmer) {
  const alerts = await listFarmerAlerts(db, farmer.id);
  const events = await listFarmerAlertEvents(db, farmer.id, 10);
  return {
    alerts,
    events,
    activeCount: alerts.filter((row) => row.active).length,
    recentCount: events.length,
  };
}

export async function staffMarketAlertsPayload(db) {
  const summary = await db
    .prepare(
      `
    SELECT
      COUNT(*) FILTER (WHERE active = 1) AS active_alerts,
      COUNT(DISTINCT farmer_id) FILTER (WHERE active = 1) AS farmers_with_alerts
    FROM market_price_alerts
  `
    )
    .get();
  const recent = await db
    .prepare(
      `
    SELECT e.*, f.name AS farmer_name, f.phone AS farmer_phone
    FROM market_price_alert_events e
    JOIN farmers f ON f.id = e.farmer_id
    ORDER BY e.triggered_at DESC
    LIMIT 20
  `
    )
    .all();
  return {
    activeAlerts: Number(summary?.active_alerts) || 0,
    farmersWithAlerts: Number(summary?.farmers_with_alerts) || 0,
    recentEvents: recent.map((row) => ({
      ...mapEventRow(row),
      farmerName: row.farmer_name,
      farmerPhone: row.farmer_phone,
    })),
  };
}
