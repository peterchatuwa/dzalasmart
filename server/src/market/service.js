import { MARKET as FALLBACK_MARKET } from "../weather.js";
import { PLAN_CROP_SOURCES } from "./catalog.js";
import { fetchLocalBuy, LOCALBUY_URL, parseLocalBuyHtml } from "./collectors/localbuy.js";
import { fetchUlimi, ULIMI_URL, parseUlimiHtml } from "./collectors/ulimi.js";
import { fetchAce, ACE_BID_URL, parseAceHtml } from "./collectors/ace.js";
import { fetchNamis, NAMIS_WFP_URL, parseNamisCsv } from "./collectors/namis.js";
import { fmtMoney, relativeUpdatedLabel } from "./normalize.js";
import {
  nearestWarehouseHub,
  warehouseHub,
  ensureTradingCentre,
  listLocationTree,
  listTradingCentres,
} from "./locations.js";
import {
  insertObservations,
  listCommodities,
  listLatestPrices,
  listSources,
  latestPriceForCrop,
  priceHistory,
  updateSourceStatus,
} from "./store.js";
import { warehouseLocationId } from "./seed.js";
import {
  compareDistrictPrices,
  compareSourcePrices,
  findMarketOpportunities,
  resolveCompareCommodity,
} from "./compare.js";
import { buildMarketExport } from "./export.js";
import { listLogisticsRoutes, upsertLogisticsRoute } from "./logistics.js";
import { buildTrendSeries } from "./trends.js";
import {
  createFarmerAlert,
  deleteFarmerAlert,
  evaluateMarketAlerts,
  listFarmerAlertEvents,
  listFarmerAlerts,
  marketAlertsPayload,
  staffMarketAlertsPayload,
} from "./alerts.js";

const CACHE_MS = 30 * 60 * 1000;

const YIELD_KG_HA = {
  Maize: 3500,
  Soybeans: 1800,
  "Soya beans": 1800,
  "Irish Potatoes": 18000,
  Beans: 900,
  Sesame: 800,
  Groundnuts: 1200,
  "Pigeon peas": 1000,
  Sorghum: 1200,
};

let cache = {
  at: 0,
  live: false,
  source: "Reference prices — refresh to load live feeds",
  sourceUrl: null,
  catalog: [],
  trendByCode: new Map(),
};

let refreshing = null;

function parseFallbackPrice(label) {
  const row = FALLBACK_MARKET.find((item) => item.crop === label);
  if (!row) return null;
  const match = row.price.match(/([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function applyCache(payload) {
  cache = {
    at: Date.now(),
    live: payload.live,
    source: payload.source,
    sourceUrl: payload.sourceUrl,
    catalog: payload.catalog || [],
    trendByCode: payload.trendByCode || new Map(),
  };
  return cache;
}

function catalogForDistrict(catalog, district) {
  if (!district) return catalog;
  const hub = nearestWarehouseHub(district);
  return catalog.filter((row) => row.hub === hub);
}

function commodityPriceFromCatalog(catalog, names) {
  for (const name of names) {
    const row = catalog.find((item) => item.crop === name || item.product === name);
    if (row) return row.buyPricePerKg;
  }
  return null;
}

async function persistLocalBuy(db, parsed, fetchedAt) {
  const rows = [];
  for (const item of parsed.catalog) {
    if (!item.commoditySlug) continue;
    const locId = await warehouseLocationId(db, item.hub);
    if (!locId) continue;
    rows.push({
      commoditySlug: item.commoditySlug,
      locationId: locId,
      buyPricePerKg: item.buyPricePerKg,
      sellPricePerKg: item.sellPricePerKg,
      grade: item.grade,
      metadata: { code: item.code, warehouse: item.warehouse, hub: item.hub },
    });
  }
  if (rows.length) {
    await insertObservations(db, "localbuy", rows, fetchedAt);
    await updateSourceStatus(db, "localbuy", { ok: true });
  }
  return rows.length;
}

async function persistUlimi(db, parsed, fetchedAt) {
  const rows = parsed.map((item) => ({
    commoditySlug: item.commoditySlug,
    locationSlug: "ulimi-national",
    buyPricePerKg: item.buyPricePerKg,
    sellPricePerKg: item.sellPricePerKg,
    metadata: { market: item.market },
  }));
  if (rows.length) {
    await insertObservations(db, "ulimi", rows, fetchedAt);
    await updateSourceStatus(db, "ulimi", { ok: true });
  }
  return rows.length;
}

async function persistAce(db, parsed, fetchedAt) {
  const rows = [];
  for (const item of parsed) {
    if (!item.commoditySlug) continue;
    const locationSlug = await ensureTradingCentre(db, {
      name: item.market || `${item.location} (ACE exchange)`,
      district: warehouseHub(item.location),
      lat: null,
      lon: null,
    });
    if (!locationSlug) continue;
    rows.push({
      commoditySlug: item.commoditySlug,
      locationSlug,
      buyPricePerKg: item.buyPricePerKg,
      sellPricePerKg: item.sellPricePerKg,
      priceKind: item.priceKind || "market",
      metadata: item.metadata,
    });
  }
  if (rows.length) {
    await insertObservations(db, "ace", rows, fetchedAt);
  }
  await updateSourceStatus(db, "ace", {
    ok: true,
    error: rows.length ? null : "No active ACE bids or offers right now",
  });
  return rows.length;
}

async function persistNamis(db, parsed, fetchedAt) {
  const rows = [];
  for (const item of parsed) {
    if (!item.commoditySlug) continue;
    const locationSlug = await ensureTradingCentre(db, {
      name: item.market,
      district: item.district,
      region: item.region,
      lat: item.lat,
      lon: item.lon,
    });
    if (!locationSlug) continue;
    rows.push({
      commoditySlug: item.commoditySlug,
      locationSlug,
      buyPricePerKg: item.buyPricePerKg,
      sellPricePerKg: item.sellPricePerKg,
      priceKind: item.priceKind || "reference",
      observedAt: item.observedAt,
      metadata: item.metadata,
    });
  }
  if (rows.length) {
    await insertObservations(db, "namis", rows, fetchedAt);
    await updateSourceStatus(db, "namis", { ok: true });
  }
  return rows.length;
}

export async function refreshAllSources(db, force = false) {
  if (!force && cache.catalog.length && Date.now() - cache.at < CACHE_MS) {
    return { cache, sources: await listSources(db) };
  }
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const fetchedAt = Date.now();
    let catalog = [];
    let trendByCode = new Map();
    let live = false;
    const errors = [];

    try {
      const parsed = await fetchLocalBuy();
      catalog = parsed.catalog;
      trendByCode = parsed.trendByCode;
      if (db) await persistLocalBuy(db, parsed, fetchedAt);
      live = true;
    } catch (error) {
      errors.push(`LocalBuyEx: ${error.message}`);
      if (db) await updateSourceStatus(db, "localbuy", { ok: false, error: error.message });
    }

    try {
      const ulimiRows = await fetchUlimi();
      if (db) await persistUlimi(db, ulimiRows, fetchedAt);
    } catch (error) {
      errors.push(`Ulimi: ${error.message}`);
      if (db) await updateSourceStatus(db, "ulimi", { ok: false, error: error.message });
    }

    try {
      const aceRows = await fetchAce();
      if (db) await persistAce(db, aceRows, fetchedAt);
    } catch (error) {
      errors.push(`ACE: ${error.message}`);
      if (db) await updateSourceStatus(db, "ace", { ok: false, error: error.message });
    }

    if (process.env.MARKET_LIGHT_REFRESH !== "1" && !process.argv.includes("--test")) {
      try {
        const namisRows = await fetchNamis(force);
        if (db) await persistNamis(db, namisRows, fetchedAt);
      } catch (error) {
        errors.push(`NAMIS: ${error.message}`);
        if (db) await updateSourceStatus(db, "namis", { ok: false, error: error.message });
      }
    }

    if (db) {
      try {
        await evaluateMarketAlerts(db);
      } catch (error) {
        errors.push(`Alerts: ${error.message}`);
      }
    }

    applyCache({
      live,
      source: live
        ? "Live prices from LocalBuyEx, Ulimi, ACE, and NAMIS — stored in PostgreSQL"
        : "Reference prices — live feeds unavailable",
      sourceUrl: LOCALBUY_URL,
      catalog,
      trendByCode,
    });

    return { cache, errors, sources: db ? await listSources(db) : [] };
  })();

  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
}

export async function refreshMarketCache(db, force = false) {
  const result = await refreshAllSources(db, force);
  return result.cache;
}

export function marketView(district = null) {
  if (!cache.live || !cache.catalog.length) {
    return {
      rows: FALLBACK_MARKET,
      catalog: [],
      hub: district ? nearestWarehouseHub(district) : null,
      scoped: false,
    };
  }
  const scopedCatalog = catalogForDistrict(cache.catalog, district);
  const rows = scopedCatalog.length
    ? buildDisplayRows(scopedCatalog, cache.trendByCode, district)
    : buildDisplayRows(cache.catalog, cache.trendByCode, district);
  return {
    rows,
    catalog: scopedCatalog.length ? scopedCatalog : cache.catalog,
    hub: district ? nearestWarehouseHub(district) : null,
    scoped: Boolean(district),
  };
}

function buildDisplayRows(catalog, trendByCode, district) {
  return catalog.map((row) => {
    const yieldKgHa = YIELD_KG_HA[row.crop] || 1000;
    const trend = trendByCode.get(row.code) || { trend: "flat", trendLabel: "— live" };
    return {
      crop: row.crop,
      product: row.product,
      price: `${fmtMoney(row.buyPricePerKg)}/kg buy`,
      pricePerKg: row.buyPricePerKg,
      sellPricePerKg: row.sellPricePerKg,
      trend: trend.trend,
      trendLabel: trend.trendLabel,
      yieldKg: `${yieldKgHa.toLocaleString("en")} kg`,
      net: `${fmtMoney(row.buyPricePerKg * yieldKgHa)}/ha`,
      warehouse: row.warehouse,
      hub: row.hub,
      grade: row.grade,
      live: true,
      source: "LocalBuyEx",
    };
  });
}

function rowsFromObservations(observations) {
  return observations.map((row) => ({
    crop: row.commodity,
    commoditySlug: row.commoditySlug,
    market: row.market,
    district: row.district,
    region: row.region,
    buyPricePerKg: row.buyPricePerKg,
    sellPricePerKg: row.sellPricePerKg,
    buyPrice: row.buyPrice,
    sellPrice: row.sellPrice,
    source: row.source,
    sourceSlug: row.sourceSlug,
    priceKind: row.priceKind,
    grade: row.grade,
    observedAt: row.observedAt,
    fetchedAt: row.fetchedAt,
    updatedLabel: row.updatedLabel,
    live: true,
  }));
}

export function getMarketRows(district = null) {
  return marketView(district).rows;
}

export function getMarketMeta(district = null) {
  const view = marketView(district);
  return {
    source: cache.source,
    sourceUrl: cache.sourceUrl,
    live: cache.live,
    fetchedAt: cache.at || null,
    district: district || null,
    warehouseHub: view.hub,
    scoped: view.scoped,
  };
}

export function getMarketPrice(crop, district = null) {
  if (cache.live && cache.catalog.length) {
    const scoped = district ? catalogForDistrict(cache.catalog, district) : cache.catalog;
    const live = commodityPriceFromCatalog(scoped, PLAN_CROP_SOURCES[crop] || [crop]);
    if (live != null) return live;
    if (district) return null;
  }
  const aliases = {
    Maize: "Maize (MH26)",
    Groundnuts: "Groundnuts",
    Soybeans: "Soya beans",
    "Pigeon peas": "Pigeon peas",
    "Irish Potatoes": "Irish potato",
  };
  return parseFallbackPrice(aliases[crop] || crop);
}

export async function getMarketPriceFromDb(db, crop, district = null) {
  if (db) {
    const fromDb = await latestPriceForCrop(db, crop, district);
    if (fromDb != null) return fromDb;
  }
  return getMarketPrice(crop, district);
}

export async function marketPayload(db, options = {}) {
  await refreshMarketCache(db);
  const district = options.district || null;
  const hub = district ? nearestWarehouseHub(district) : null;
  const observations = db ? await listLatestPrices(db, { district }) : [];
  const tableRows = observations.length
    ? rowsFromObservations(observations)
    : rowsFromObservations(
        marketView(district).rows.map((row) => ({
          commodity: row.crop,
          market: row.warehouse || hub,
          district: row.hub,
          buyPricePerKg: row.pricePerKg,
          sellPricePerKg: row.sellPricePerKg,
          buyPrice: row.price,
          sellPrice: row.sellPricePerKg ? `${fmtMoney(row.sellPricePerKg)}/kg` : null,
          source: "LocalBuyEx",
          sourceSlug: "localbuy",
          priceKind: "market",
          grade: row.grade,
          fetchedAt: cache.at,
          updatedLabel: relativeUpdatedLabel(cache.at),
        }))
      );

  return {
    ...getMarketMeta(district),
    note: district
      ? `Prices near ${district}${hub ? ` · nearest warehouse ${hub}` : ""}.`
      : "Log in or pass your district to see prices near you.",
    rows: marketView(district).rows,
    prices: tableRows,
    commodities: db ? await listCommodities(db) : [],
    sources: db ? await listSources(db) : [],
    warehouseHub: hub,
  };
}

export async function marketPricesPayload(db, filters = {}) {
  await refreshMarketCache(db, Boolean(filters.refresh));
  const observations = await listLatestPrices(db, filters);
  const prices = rowsFromObservations(observations);
  const buyValues = prices.map((r) => r.buyPricePerKg).filter((n) => n != null);
  return {
    prices,
    commodities: await listCommodities(db),
    sources: await listSources(db),
    filters,
    stats: {
      count: prices.length,
      lowestBuy: buyValues.length ? Math.min(...buyValues) : null,
      highestBuy: buyValues.length ? Math.max(...buyValues) : null,
    },
  };
}

export async function marketHistoryPayload(db, filters = {}) {
  const history = await priceHistory(db, filters);
  return {
    commodity: filters.commoditySlug || null,
    district: filters.district || null,
    source: filters.sourceSlug || null,
    days: Math.min(365, Math.max(1, Number(filters.days) || 30)),
    points: history,
  };
}

export async function marketComparePayload(db, filters = {}) {
  const commodity = await resolveCompareCommodity(db, filters.commodity || filters.commoditySlug);
  if (!commodity) throw new Error("Unknown commodity");
  const districts = String(filters.districts || "")
    .split(",")
    .map((row) => row.trim())
    .filter(Boolean);
  return compareDistrictPrices(db, { commoditySlug: commodity.slug, districts });
}

export async function marketSourcesComparePayload(db, filters = {}) {
  const commodity = await resolveCompareCommodity(db, filters.commodity || filters.commoditySlug);
  if (!commodity) throw new Error("Unknown commodity");
  const district = String(filters.district || "").trim();
  if (!district) throw new Error("District is required");
  return compareSourcePrices(db, { commoditySlug: commodity.slug, district });
}

export async function marketOpportunitiesPayload(db, filters = {}) {
  const commodity =
    filters.commodity || filters.commoditySlug
      ? (await resolveCompareCommodity(db, filters.commodity || filters.commoditySlug))?.slug
      : undefined;
  const opportunities = await findMarketOpportunities(db, {
    commoditySlug: commodity,
    loadKg: filters.loadKg ? Number(filters.loadKg) : undefined,
  });
  return {
    commodity: commodity || null,
    count: opportunities.length,
    profitableCount: opportunities.filter((row) => row.profitable).length,
    opportunities,
  };
}

export async function marketLogisticsRoutesPayload(db) {
  const routes = await listLogisticsRoutes(db);
  return { routes, count: routes.length };
}

export async function saveLogisticsRoute(db, input = {}) {
  const route = await upsertLogisticsRoute(db, input);
  return { route };
}

export async function marketTrendsPayload(db, filters = {}) {
  const commodity = await resolveCompareCommodity(db, filters.commodity || filters.commoditySlug || "maize");
  if (!commodity) throw new Error("Unknown commodity");
  return buildTrendSeries(db, {
    commoditySlug: commodity.slug,
    district: filters.district || undefined,
    sourceSlug: filters.sourceSlug || undefined,
    locationSlug: filters.locationSlug || undefined,
    range: filters.range || "30d",
  });
}

export async function marketExportPayload(db, filters = {}) {
  return buildMarketExport(db, filters);
}

export async function marketLocationsPayload(db, filters = {}) {
  const tree = await listLocationTree(db, filters);
  const tradingCentres = await listTradingCentres(db, filters.district || null);
  return {
    tree,
    tradingCentres,
    count: tradingCentres.length,
    district: filters.district || null,
    region: filters.region || null,
  };
}

export async function marketAlertsPayloadForFarmer(db, farmer) {
  return marketAlertsPayload(db, farmer);
}

export async function saveMarketAlert(db, farmer, input = {}) {
  const alert = await createFarmerAlert(db, farmer, input);
  return { alert };
}

export async function removeMarketAlert(db, farmer, alertId) {
  return deleteFarmerAlert(db, farmer.id, alertId);
}

export async function staffMarketAlertsSummary(db) {
  return staffMarketAlertsPayload(db);
}

export function resetMarketCacheForTests() {
  cache = {
    at: 0,
    live: false,
    source: "Reference prices",
    sourceUrl: null,
    catalog: [],
    trendByCode: new Map(),
  };
  refreshing = null;
}

export function setMarketCacheForTests(payload) {
  applyCache({
    live: true,
    source: "Test market feed",
    sourceUrl: LOCALBUY_URL,
    catalog: payload.catalog || [],
    trendByCode: payload.trendByCode || new Map(),
  });
}

export {
  parseLocalBuyHtml,
  parseUlimiHtml,
  parseAceHtml,
  parseNamisCsv,
  nearestWarehouseHub,
  warehouseHub,
  LOCALBUY_URL,
  ULIMI_URL,
  ACE_BID_URL,
  NAMIS_WFP_URL,
  listFarmerAlerts,
  listFarmerAlertEvents,
  evaluateMarketAlerts,
};
