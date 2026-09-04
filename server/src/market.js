import { DISTRICT_COORDS } from "./places.js";
import { MARKET as FALLBACK_MARKET } from "./weather.js";

const LOCALBUY_URL = "https://www.localbuyex.com/";
const CACHE_MS = 30 * 60 * 1000;

const WAREHOUSE_COORDS = {
  Lilongwe: [-13.98, 33.78],
  Kasungu: [-13.03, 33.48],
  Mchinji: [-13.80, 32.88],
};

const CODE_TO_CROP = {
  WH: "Maize",
  SB: "Soya beans",
  LR: "Irish Potatoes",
  BN: "Beans",
  SM: "Sesame",
};

const PLAN_CROP_SOURCES = {
  Maize: ["Maize"],
  Groundnuts: ["Groundnuts"],
  Soybeans: ["Soya beans", "Soya Beans"],
  "Pigeon peas": ["Pigeon peas"],
  Sorghum: ["Sorghum"],
  "Irish Potatoes": ["Irish Potatoes", "Irish Potato"],
  "Sweet potatoes": ["Sweet potatoes"],
  Tomatoes: ["Tomatoes"],
  Onions: ["Onions"],
  Cassava: ["Cassava"],
  Rice: ["Rice"],
  Tobacco: ["Tobacco"],
  Cabbages: ["Cabbages"],
  Beans: ["Beans"],
  Sesame: ["Sesame"],
};

const YIELD_KG_HA = {
  Maize: 3500,
  "Soya beans": 1800,
  Soybeans: 1800,
  "Irish Potatoes": 18000,
  Beans: 900,
  Sesame: 800,
  Groundnuts: 1200,
  "Pigeon peas": 1000,
  Sorghum: 1200,
  Tobacco: 1400,
};

let cache = {
  at: 0,
  live: false,
  source: "NAMIS-style reference prices — illustrative for this demo",
  sourceUrl: null,
  catalog: [],
  trendByCode: new Map(),
};

let refreshing = null;

function fmtMoney(amount) {
  return `MWK ${Math.round(amount).toLocaleString("en")}`;
}

function parseMoney(raw) {
  const value = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function parseFallbackPrice(label) {
  const row = FALLBACK_MARKET.find((item) => item.crop === label);
  if (!row) return null;
  const match = row.price.match(/([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function warehouseHub(location = "") {
  const key = String(location).split("/")[0].trim();
  if (/^Lilongwe/i.test(key)) return "Lilongwe";
  if (/^Kasungu/i.test(key)) return "Kasungu";
  if (/^Mchinji/i.test(key)) return "Mchinji";
  return key || "Lilongwe";
}

export function nearestWarehouseHub(district) {
  const coords = DISTRICT_COORDS[district];
  if (!coords) return "Lilongwe";
  let best = "Lilongwe";
  let bestDist = Infinity;
  for (const [hub, hubCoords] of Object.entries(WAREHOUSE_COORDS)) {
    const dist = haversineKm(coords, hubCoords);
    if (dist < bestDist) {
      bestDist = dist;
      best = hub;
    }
  }
  return best;
}

export function parseLocalBuyHtml(html) {
  const catalog = [];
  const rowRe = /<tr>\s*<td>([A-Z]{2})<\/td>\s*<td>[\s\S]*?title="([^"]+)"[\s\S]*?<\/td>\s*<td>([^<]*)<\/td>[\s\S]*?<td>([\d,]+\.?\d*)<\/td>\s*<td>([\d,]+\.?\d*)<\/td>\s*<td>([^<]+)<\/td>/g;
  let match;
  while ((match = rowRe.exec(html)) !== null) {
    const buyPrice = parseMoney(match[4]);
    if (buyPrice == null) continue;
    catalog.push({
      code: match[1],
      product: match[2].trim(),
      crop: CODE_TO_CROP[match[1]] || match[2].trim(),
      grade: match[3].trim(),
      buyPricePerKg: buyPrice,
      sellPricePerKg: parseMoney(match[5]),
      warehouse: match[6].trim(),
      hub: warehouseHub(match[6]),
    });
  }

  const trendByCode = new Map();
  const tickerRe = /([A-Z]{2})\s+([\d,]+\.?\d*)\s*:[\s\S]*?text-(success|danger|muted)[^>]*>[\s\S]*?([\d.]+)/g;
  while ((match = tickerRe.exec(html)) !== null) {
    const delta = Number(match[4]);
    if (!Number.isFinite(delta) || delta === 0) {
      trendByCode.set(match[1], { trend: "flat", trendLabel: "— steady" });
      continue;
    }
    const trend = match[3] === "danger" ? "down" : "up";
    trendByCode.set(match[1], {
      trend,
      trendLabel: trend === "up" ? `↗ +${delta.toLocaleString("en")}` : `↘ -${delta.toLocaleString("en")}`,
    });
  }

  return { catalog, trendByCode };
}

function catalogForDistrict(catalog, district) {
  if (!district) return catalog;
  const hub = nearestWarehouseHub(district);
  return catalog.filter((row) => row.hub === hub);
}

function buildDisplayRows(catalog, trendByCode, district) {
  const hub = district ? nearestWarehouseHub(district) : null;
  return catalog.map((row) => {
    const yieldKgHa = YIELD_KG_HA[row.crop] || 1000;
    const trend = trendByCode.get(row.code) || { trend: "flat", trendLabel: "— live" };
    return {
      crop: row.crop,
      product: row.product,
      price: `${fmtMoney(row.buyPricePerKg)}/kg buy`,
      pricePerKg: row.buyPricePerKg,
      trend: trend.trend,
      trendLabel: trend.trendLabel,
      yieldKg: `${yieldKgHa.toLocaleString("en")} kg`,
      net: `${fmtMoney(row.buyPricePerKg * yieldKgHa)}/ha`,
      warehouse: row.warehouse,
      hub: row.hub,
      grade: row.grade,
      live: true,
    };
  });
}

function commodityPriceFromCatalog(catalog, names) {
  for (const name of names) {
    const row = catalog.find((item) => item.crop === name || item.product === name);
    if (row) return row.buyPricePerKg;
  }
  return null;
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

export async function refreshMarketCache(force = false) {
  if (!force && cache.catalog.length && Date.now() - cache.at < CACHE_MS) return cache;
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const res = await fetch(LOCALBUY_URL, {
        headers: { Accept: "text/html", "User-Agent": "NzeruZaAlimi/1.0 (+market-prices)" },
      });
      if (!res.ok) throw new Error(`LocalBuyEx HTTP ${res.status}`);
      const { catalog, trendByCode } = parseLocalBuyHtml(await res.text());
      if (!catalog.length) throw new Error("No commodity rows parsed");
      return applyCache({
        live: true,
        source: "Live buying prices from LocalBuyEx warehouses",
        sourceUrl: LOCALBUY_URL,
        catalog,
        trendByCode,
      });
    } catch {
      return applyCache({
        live: false,
        source: "NAMIS-style reference prices — LocalBuyEx feed unavailable, showing fallback",
        sourceUrl: LOCALBUY_URL,
        catalog: [],
        trendByCode: new Map(),
      });
    }
  })();

  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
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

export async function marketPayload(options = {}) {
  await refreshMarketCache();
  const district = options.district || null;
  const view = marketView(district);
  const meta = getMarketMeta(district);
  const note = district
    ? `Prices at the ${meta.warehouseHub} LocalBuyEx warehouse nearest to ${district}.`
    : "Log in or pass your district to see warehouse prices near you.";
  return {
    ...meta,
    note,
    rows: view.rows,
  };
}

export function resetMarketCacheForTests() {
  cache = {
    at: 0,
    live: false,
    source: "NAMIS-style reference prices — illustrative for this demo",
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
