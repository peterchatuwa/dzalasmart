import { parseTrendRange } from "./trends.js";
import { priceHistory } from "./store.js";
import { resolveCompareCommodity } from "./compare.js";

function csvCell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function safeIso(timestamp) {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

export function observationsToCsv(rows) {
  const header = [
    "observed_at",
    "commodity",
    "commodity_slug",
    "district",
    "market",
    "source",
    "source_slug",
    "price_kind",
    "buy_price_per_kg",
    "sell_price_per_kg",
    "grade",
    "notes",
  ].join(",");
  const lines = rows.map((row) => [
    safeIso(row.fetchedAt || row.observedAt),
    row.commodity,
    row.commoditySlug,
    row.district || "",
    row.market,
    row.source,
    row.sourceSlug,
    row.priceKind,
    row.buyPricePerKg ?? "",
    row.sellPricePerKg ?? "",
    row.grade || "",
    row.notes || "",
  ].map(csvCell).join(","));
  return [header, ...lines].join("\n");
}

export async function buildMarketExport(db, filters = {}) {
  const rangeInfo = parseTrendRange(filters.range || `${filters.days || 30}d`);
  const days = filters.days ? Math.min(365, Math.max(1, Number(filters.days))) : rangeInfo.days;
  const commodity = filters.commodity || filters.commoditySlug
    ? await resolveCompareCommodity(db, filters.commodity || filters.commoditySlug)
    : null;

  const rows = await priceHistory(db, {
    commoditySlug: commodity?.slug,
    district: filters.district || undefined,
    sourceSlug: filters.sourceSlug || undefined,
    locationSlug: filters.locationSlug || undefined,
    days,
    maxRows: filters.maxRows || 5000,
  });

  return {
    filename: buildExportFilename({
      commodity: commodity?.slug,
      district: filters.district,
      days,
    }),
    csv: observationsToCsv(rows),
    rowCount: rows.length,
    days,
  };
}

function buildExportFilename({ commodity, district, days }) {
  const parts = ["market-prices"];
  if (commodity) parts.push(commodity);
  if (district) parts.push(String(district).toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  parts.push(`${days}d`);
  return `${parts.join("-")}.csv`;
}
