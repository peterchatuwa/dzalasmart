import { matchCommodityName } from "./catalog.js";
import { fmtPricePerKg } from "./normalize.js";
import { WAREHOUSE_HUBS } from "./locations.js";
import {
  formatNetMargin,
  formatTransportSummary,
  resolveTransportCost,
} from "./logistics.js";
import { listCommodities, listLatestPrices, resolveCommodity } from "./store.js";

function buyStats(rows) {
  const priced = rows.filter((row) => row.buyPricePerKg != null);
  if (!priced.length) return null;
  const lowest = priced.reduce((a, b) => (a.buyPricePerKg <= b.buyPricePerKg ? a : b));
  const highest = priced.reduce((a, b) => (a.buyPricePerKg >= b.buyPricePerKg ? a : b));
  return {
    count: priced.length,
    lowestBuy: lowest.buyPricePerKg,
    highestBuy: highest.buyPricePerKg,
    spread: highest.buyPricePerKg - lowest.buyPricePerKg,
    lowest,
    highest,
  };
}

function summarizeRow(row, district) {
  return {
    district: district || row.district,
    market: row.market,
    source: row.source,
    sourceSlug: row.sourceSlug,
    priceKind: row.priceKind,
    buyPricePerKg: row.buyPricePerKg,
    sellPricePerKg: row.sellPricePerKg,
    buyPrice: row.buyPrice,
    sellPrice: row.sellPrice,
    updatedLabel: row.updatedLabel,
  };
}

function pickPrimaryPrice(rows, { marketOnly = false } = {}) {
  const pool = marketOnly ? rows.filter((row) => row.priceKind === "market") : rows;
  return pool.find((row) => row.sourceSlug === "localbuy" && row.buyPricePerKg != null)
    || pool.find((row) => row.buyPricePerKg != null)
    || null;
}

function sellPriceAt(row) {
  return row.sellPricePerKg ?? row.buyPricePerKg ?? null;
}

export async function compareDistrictPrices(db, { commoditySlug, districts = [] }) {
  const commodity = await resolveCommodity(db, commoditySlug);
  if (!commodity) throw new Error("Unknown commodity");

  const districtList = districts.length
    ? districts
    : WAREHOUSE_HUBS;

  const rows = [];
  for (const district of districtList) {
    const prices = await listLatestPrices(db, { commoditySlug: commodity.slug, district });
    const best = pickPrimaryPrice(prices);
    if (best) rows.push(summarizeRow(best, district));
  }

  const stats = buyStats(rows);
  return {
    commodity: commodity.name,
    commoditySlug: commodity.slug,
    districts: rows,
    stats: stats ? {
      lowestBuy: stats.lowestBuy,
      highestBuy: stats.highestBuy,
      spread: stats.spread,
      lowestDistrict: stats.lowest.district || stats.lowest.market,
      highestDistrict: stats.highest.district || stats.highest.market,
      lowestBuyLabel: fmtPricePerKg(stats.lowestBuy),
      highestBuyLabel: fmtPricePerKg(stats.highestBuy),
    } : null,
  };
}

export async function compareSourcePrices(db, { commoditySlug, district }) {
  const commodity = await resolveCommodity(db, commoditySlug);
  if (!commodity) throw new Error("Unknown commodity");
  if (!district) throw new Error("District is required");

  const sources = (await listLatestPrices(db, { commoditySlug: commodity.slug, district }))
    .map((row) => summarizeRow(row, district));
  const marketSources = sources.filter((row) => row.priceKind === "market");
  const procurementSources = sources.filter((row) => row.priceKind === "procurement");
  const stats = buyStats(sources);

  return {
    commodity: commodity.name,
    commoditySlug: commodity.slug,
    district,
    sources,
    marketSources,
    procurementSources,
    stats: stats ? {
      lowestBuy: stats.lowestBuy,
      highestBuy: stats.highestBuy,
      spread: stats.spread,
      lowestSource: stats.lowest.source,
      highestSource: stats.highest.source,
      lowestBuyLabel: fmtPricePerKg(stats.lowestBuy),
      highestBuyLabel: fmtPricePerKg(stats.highestBuy),
    } : null,
  };
}

async function hubPriceMap(db, commoditySlug) {
  const map = new Map();
  for (const hub of WAREHOUSE_HUBS) {
    const prices = await listLatestPrices(db, { commoditySlug, district: hub });
    const best = pickPrimaryPrice(prices, { marketOnly: true });
    if (best) map.set(hub, summarizeRow(best, hub));
  }
  return map;
}

export async function findMarketOpportunities(db, { commoditySlug, loadKg } = {}) {
  const commodities = commoditySlug
    ? [await resolveCommodity(db, commoditySlug)].filter(Boolean)
    : (await listCommodities(db)).map((row) => ({ slug: row.slug, name: row.name }));

  const opportunities = [];
  for (const commodity of commodities) {
    const hubPrices = await hubPriceMap(db, commodity.slug);
    if (hubPrices.size < 2) continue;

    for (const fromDistrict of WAREHOUSE_HUBS) {
      const buyRow = hubPrices.get(fromDistrict);
        if (buyRow?.buyPricePerKg == null) continue;
      for (const toDistrict of WAREHOUSE_HUBS) {
        if (toDistrict === fromDistrict) continue;
        const sellRow = hubPrices.get(toDistrict);
        const sellPrice = sellRow ? sellPriceAt(sellRow) : null;
        if (sellPrice == null || buyRow.buyPricePerKg == null) continue;

        const transport = await resolveTransportCost(db, fromDistrict, toDistrict, loadKg);
        const transportPerKg = transport?.transportPerKg ?? 0;
        const grossSpreadPerKg = sellPrice - buyRow.buyPricePerKg;
        const netMarginPerKg = grossSpreadPerKg - transportPerKg;
        if (grossSpreadPerKg <= 0) continue;

        opportunities.push({
          commodity: commodity.name,
          commoditySlug: commodity.slug,
          fromDistrict,
          toDistrict,
          buyLow: buyRow,
          buyHigh: sellRow,
          buyPricePerKg: buyRow.buyPricePerKg,
          sellPricePerKg: sellPrice,
          buyPrice: buyRow.buyPrice,
          sellPrice: sellRow?.sellPrice || fmtPricePerKg(sellPrice),
          route: transport,
          transportPerKg,
          transportLabel: transport?.transportLabel || fmtPricePerKg(transportPerKg),
          grossSpreadPerKg,
          grossSpreadLabel: fmtPricePerKg(grossSpreadPerKg),
          netMarginPerKg,
          netMarginLabel: formatNetMargin(netMarginPerKg),
          spreadPerKg: grossSpreadPerKg,
          spreadLabel: fmtPricePerKg(grossSpreadPerKg),
          profitable: netMarginPerKg > 0,
          note: transport
            ? `${commodity.name}: buy ${buyRow.buyPrice} in ${fromDistrict}, `
              + `sell ${fmtPricePerKg(sellPrice)} in ${toDistrict}. `
              + `${formatTransportSummary(transport, transportPerKg)}. `
              + `Net margin ${formatNetMargin(netMarginPerKg)}${netMarginPerKg > 0 ? "" : " (not profitable after haulage)"}.`
            : `Buy in ${fromDistrict}, sell in ${toDistrict}. Transport cost not configured.`,
        });
      }
    }
  }

  opportunities.sort((a, b) => b.netMarginPerKg - a.netMarginPerKg);
  return opportunities;
}

export async function resolveCompareCommodity(db, label) {
  const matched = matchCommodityName(label);
  if (matched) return resolveCommodity(db, matched.slug);
  return resolveCommodity(db, label);
}
