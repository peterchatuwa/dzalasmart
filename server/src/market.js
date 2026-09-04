import { MARKET as FALLBACK_MARKET } from "./weather.js";

const ULIMI_URL = "https://ulimi.online/";
const CACHE_MS = 30 * 60 * 1000;

const DISPLAY_CROPS = [
  "Maize",
  "Groundnuts",
  "Soya beans",
  "Pigeon peas",
  "Beans",
];

const ULIMI_TO_CANONICAL = {
  Maize: "Maize",
  "Ground Nuts": "Groundnuts",
  Soya: "Soya beans",
  "Pigeon Peas": "Pigeon peas",
  Beans: "Beans",
};

const PLAN_CROP_SOURCES = {
  Maize: ["Maize"],
  Groundnuts: ["Groundnuts", "Ground Nuts"],
  Soybeans: ["Soya beans", "Soya", "Soya Beans", "Soybeans"],
  "Pigeon peas": ["Pigeon peas", "Pigeon Peas"],
  Sorghum: ["Sorghum"],
  "Irish Potatoes": ["Potatoes", "Irish Potatoes", "Irish potato"],
  "Sweet potatoes": ["Sweet Potatoes", "Sweet potatoes"],
  Tomatoes: ["Tomatoes"],
  Onions: ["Onions"],
  Cassava: ["Cassava"],
  Rice: ["Rice", "Beans"],
  Tobacco: ["Tobacco"],
  Cabbages: ["Cabbages"],
};

const YIELD_KG_HA = {
  Maize: 3500,
  Groundnuts: 1200,
  "Soya beans": 1800,
  Soybeans: 1800,
  "Pigeon peas": 1000,
  Beans: 900,
  "Irish potato": 12000,
  "Irish Potatoes": 18000,
  Sorghum: 1200,
  Tobacco: 1400,
};

const DISPLAY_LABELS = {
  Maize: ["Maize"],
  Groundnuts: ["Groundnuts", "Ground Nuts"],
  "Soya beans": ["Soya beans", "Soya", "Soya Beans", "Soybeans"],
  "Pigeon peas": ["Pigeon peas", "Pigeon Peas"],
  Beans: ["Beans"],
};

let cache = {
  at: 0,
  live: false,
  source: "NAMIS-style reference prices — illustrative for this demo",
  sourceUrl: null,
  rows: FALLBACK_MARKET,
  byCommodity: new Map(),
  trends: new Map(),
};

let refreshing = null;

function fmtMoney(amount) {
  return `MWK ${Math.round(amount).toLocaleString("en")}`;
}

function parseFallbackPrice(label) {
  const row = FALLBACK_MARKET.find((item) => item.crop === label);
  if (!row) return null;
  const match = row.price.match(/([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function trendFromDelta(current, previous) {
  if (!previous || !current) return { trend: "flat", trendLabel: "— live" };
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return { trend: "flat", trendLabel: "— 0.0%" };
  if (pct > 0) return { trend: "up", trendLabel: `↗ +${pct.toFixed(1)}%` };
  return { trend: "down", trendLabel: `↘ ${pct.toFixed(1)}%` };
}

export function parseUlimiHtml(html) {
  const itemRe = /opacity-70">([^<]+)<\/span><span class="font-medium">MWK\s*([\d,]+)\/kg<\/span><span class="text-xs text-(green|red)-600">[\s\S]*?([\d.]+)%/g;
  const byCommodity = new Map();
  const trends = new Map();
  let match;

  while ((match = itemRe.exec(html)) !== null) {
    const rawName = match[1].trim();
    const canonical = ULIMI_TO_CANONICAL[rawName] || rawName;
    const pricePerKg = Number(match[2].replace(/,/g, ""));
    if (!Number.isFinite(pricePerKg)) continue;

    const bucket = byCommodity.get(canonical) || [];
    bucket.push(pricePerKg);
    byCommodity.set(canonical, bucket);

    if (!trends.has(canonical)) {
      const direction = match[3] === "green" ? "up" : "down";
      const pct = Number(match[4]);
      trends.set(canonical, {
        trend: direction,
        trendLabel: direction === "up" ? `↗ +${pct}%` : `↘ -${pct}%`,
      });
    }
  }

  return { byCommodity, trends };
}

function commodityPrice(byCommodity, names) {
  for (const name of names) {
    const prices = byCommodity.get(name);
    if (prices?.length) {
      const avg = prices.reduce((sum, value) => sum + value, 0) / prices.length;
      return Math.round(avg);
    }
  }
  return null;
}

function buildDisplayRows(byCommodity, trends) {
  const rows = [];
  for (const crop of DISPLAY_CROPS) {
    const pricePerKg = commodityPrice(byCommodity, DISPLAY_LABELS[crop] || [crop]);
    if (!pricePerKg) continue;
    const yieldKgHa = YIELD_KG_HA[crop] || 1000;
    const liveTrend = trends.get(crop);
    const fallback = parseFallbackPrice(crop === "Maize" ? "Maize (MH26)" : crop);
    const { trend, trendLabel } = liveTrend || trendFromDelta(pricePerKg, fallback);
    rows.push({
      crop,
      price: `${fmtMoney(pricePerKg)}/kg`,
      pricePerKg,
      trend,
      trendLabel,
      yieldKg: `${yieldKgHa.toLocaleString("en")} kg`,
      net: `${fmtMoney(pricePerKg * yieldKgHa)}/ha`,
      live: true,
    });
  }
  return rows.length ? rows : null;
}

function applyCache(payload) {
  cache = {
    at: Date.now(),
    live: payload.live,
    source: payload.source,
    sourceUrl: payload.sourceUrl,
    rows: payload.rows,
    byCommodity: payload.byCommodity,
    trends: payload.trends || new Map(),
  };
  return cache;
}

export async function refreshMarketCache(force = false) {
  if (!force && cache.rows && Date.now() - cache.at < CACHE_MS) return cache;
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const res = await fetch(ULIMI_URL, {
        headers: { Accept: "text/html", "User-Agent": "NzeruZaAlimi/1.0 (+market-prices)" },
      });
      if (!res.ok) throw new Error(`Ulimi HTTP ${res.status}`);
      const html = await res.text();
      const { byCommodity, trends } = parseUlimiHtml(html);
      const rows = buildDisplayRows(byCommodity, trends);
      if (!rows?.length) throw new Error("No commodity rows parsed");
      return applyCache({
        live: true,
        source: "Live prices from Ulimi marketplace",
        sourceUrl: ULIMI_URL,
        rows,
        byCommodity,
        trends,
      });
    } catch {
      return applyCache({
        live: false,
        source: "NAMIS-style reference prices — Ulimi feed unavailable, showing fallback",
        sourceUrl: ULIMI_URL,
        rows: FALLBACK_MARKET,
        byCommodity: new Map(),
        trends: new Map(),
      });
    }
  })();

  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
}

export function getMarketRows() {
  return cache.rows;
}

export function getMarketMeta() {
  return {
    source: cache.source,
    sourceUrl: cache.sourceUrl,
    live: cache.live,
    fetchedAt: cache.at || null,
  };
}

export function getMarketPrice(crop) {
  const names = PLAN_CROP_SOURCES[crop] || [crop];
  const live = commodityPrice(cache.byCommodity, names);
  if (live != null) return live;

  const aliases = {
    Maize: "Maize (MH26)",
    Groundnuts: "Groundnuts",
    Soybeans: "Soya beans",
    "Pigeon peas": "Pigeon peas",
    "Irish Potatoes": "Irish potato",
  };
  return parseFallbackPrice(aliases[crop] || crop);
}

export async function marketPayload() {
  await refreshMarketCache();
  return {
    ...getMarketMeta(),
    rows: getMarketRows(),
  };
}

export function resetMarketCacheForTests() {
  cache = {
    at: 0,
    live: false,
    source: "NAMIS-style reference prices — illustrative for this demo",
    sourceUrl: null,
    rows: FALLBACK_MARKET,
    byCommodity: new Map(),
    trends: new Map(),
  };
  refreshing = null;
}

export function setMarketCacheForTests(payload) {
  applyCache({
    live: true,
    source: "Test market feed",
    sourceUrl: ULIMI_URL,
    rows: payload.rows || FALLBACK_MARKET,
    byCommodity: payload.byCommodity || new Map(),
    trends: payload.trends || new Map(),
  });
}
