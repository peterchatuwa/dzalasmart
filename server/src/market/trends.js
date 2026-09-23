import { resolveCompareCommodity } from "./compare.js";
import { priceHistory } from "./store.js";

export function parseTrendRange(range = "30d") {
  const key = String(range || "30d")
    .trim()
    .toLowerCase();
  if (key === "3m" || key === "90d") return { days: 90, label: "3 months", range: "3m" };
  if (key === "1y" || key === "365d") return { days: 365, label: "1 year", range: "1y" };
  return { days: 30, label: "30 days", range: "30d" };
}

function safeDate(timestamp) {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dayKey(timestamp) {
  const date = safeDate(timestamp);
  return date ? date.toISOString().slice(0, 10) : null;
}

function upsertDailyPoint(bucket, point) {
  const date = dayKey(point.fetchedAt || point.observedAt);
  if (!date) return;
  const existing = bucket.find((row) => row.date === date);
  if (existing) {
    existing.buyPricePerKg = point.buyPricePerKg;
    existing.sellPricePerKg = point.sellPricePerKg;
    existing.fetchedAt = point.fetchedAt;
    return;
  }
  bucket.push({
    date,
    buyPricePerKg: point.buyPricePerKg,
    sellPricePerKg: point.sellPricePerKg,
    fetchedAt: point.fetchedAt,
  });
}

export async function buildTrendSeries(db, filters = {}) {
  const rangeInfo = parseTrendRange(filters.range);
  const commodity = await resolveCompareCommodity(db, filters.commodity || filters.commoditySlug);
  if (!commodity) throw new Error("Unknown commodity");

  const points = await priceHistory(db, {
    commoditySlug: commodity.slug,
    district: filters.district || undefined,
    sourceSlug: filters.sourceSlug || undefined,
    locationSlug: filters.locationSlug || undefined,
    days: rangeInfo.days,
    maxRows: 5000,
  });

  const bySource = new Map();
  for (const point of points) {
    if (!bySource.has(point.sourceSlug)) {
      bySource.set(point.sourceSlug, {
        source: point.source,
        sourceSlug: point.sourceSlug,
        priceKind: point.priceKind,
        points: [],
      });
    }
    upsertDailyPoint(bySource.get(point.sourceSlug).points, point);
  }

  const series = [...bySource.values()].map((row) => ({
    ...row,
    points: row.points.sort((a, b) => a.date.localeCompare(b.date)),
  }));

  const labels = [...new Set(series.flatMap((row) => row.points.map((p) => p.date)))].sort();
  const stats = summarizeTrend(points);

  return {
    commodity: commodity.name,
    commoditySlug: commodity.slug,
    district: filters.district || null,
    sourceSlug: filters.sourceSlug || null,
    range: rangeInfo.range,
    rangeLabel: rangeInfo.label,
    days: rangeInfo.days,
    labels,
    series,
    stats,
  };
}

function summarizeTrend(points) {
  const buys = points.map((row) => row.buyPricePerKg).filter((value) => value != null);
  if (!buys.length) return null;
  const first = buys[0];
  const last = buys[buys.length - 1];
  return {
    count: points.length,
    firstBuy: first,
    lastBuy: last,
    change: last - first,
    changePct: first ? Number((((last - first) / first) * 100).toFixed(1)) : null,
    lowestBuy: Math.min(...buys),
    highestBuy: Math.max(...buys),
  };
}
