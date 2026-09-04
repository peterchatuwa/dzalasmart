import { matchCommodityName } from "../catalog.js";
import { districtSlug } from "../locations.js";

export const NAMIS_WFP_URL =
  "https://data.humdata.org/dataset/75ecb747-717e-4ce5-b7af-0e13cc95ba63/resource/da3ed5da-d6ad-4a86-b4bc-b77e74d01ab7/download/wfp_food_prices_mwi.csv";

const CACHE_MS = 6 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 90;

let cache = { at: 0, rows: [] };

const WFP_COMMODITY_HINTS = [
  ["maize", /maize/i],
  ["beans", /^beans$/i],
  ["groundnuts", /groundnut/i],
  ["rice", /^rice$/i],
  ["pigeon-peas", /cowpea|pigeon/i],
  ["soya-beans", /soya|soybean/i],
  ["sorghum", /sorghum/i],
  ["cassava", /cassava/i],
  ["tomatoes", /tomato/i],
  ["onions", /onion/i],
];

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

function mapWfpCommodity(label) {
  const key = String(label || "").trim();
  for (const [slug, pattern] of WFP_COMMODITY_HINTS) {
    if (pattern.test(key)) {
      const matched = matchCommodityName(slug.replace(/-/g, " "));
      if (matched) return matched;
    }
  }
  return matchCommodityName(key);
}

function normalizeDistrict(admin2) {
  const value = String(admin2 || "").trim();
  if (!value) return null;
  return value.replace(/\b(District|Boma)\b/gi, "").trim();
}

export function parseNamisCsv(csvText, now = Date.now()) {
  const lines = String(csvText || "").split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];
  const header = parseCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase());
  const idx = Object.fromEntries(header.map((name, index) => [name, index]));
  const cutoff = now - LOOKBACK_DAYS * 86_400_000;
  const latest = new Map();

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const dateText = cells[idx.date];
    const observedAt = Date.parse(`${dateText}T00:00:00Z`);
    if (!Number.isFinite(observedAt) || observedAt < cutoff) continue;
    const unit = String(cells[idx.unit] || "").trim().toUpperCase();
    if (unit !== "KG") continue;
    const priceType = String(cells[idx.pricetype] || "").trim();
    if (priceType && !/retail/i.test(priceType)) continue;
    const commodity = mapWfpCommodity(cells[idx.commodity]);
    if (!commodity) continue;
    const district = normalizeDistrict(cells[idx.admin2]);
    const market = String(cells[idx.market] || "").trim();
    if (!district || !market || /national average/i.test(market)) continue;
    const price = Number(cells[idx.price]);
    if (!Number.isFinite(price) || price <= 0) continue;
    const lat = Number(cells[idx.latitude]);
    const lon = Number(cells[idx.longitude]);
    const key = `${commodity.slug}:${districtSlug(district)}:${districtSlug(market)}`;
    const existing = latest.get(key);
    if (!existing || observedAt >= existing.observedAt) {
      latest.set(key, {
        crop: commodity.name,
        commoditySlug: commodity.slug,
        district,
        region: String(cells[idx.admin1] || "").replace(/\s+Region$/i, " Region").trim() || null,
        market,
        buyPricePerKg: price,
        sellPricePerKg: null,
        observedAt,
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
        priceKind: "reference",
        metadata: { dataset: "WFP retail", marketId: cells[idx.market_id] || null },
      });
    }
  }

  return [...latest.values()];
}

export async function fetchNamis(force = false) {
  if (!force && cache.rows.length && Date.now() - cache.at < CACHE_MS) {
    return cache.rows;
  }
  const res = await fetch(NAMIS_WFP_URL, {
    headers: {
      Accept: "text/csv",
      "User-Agent": "Mozilla/5.0 (compatible; NzeruZaAlimi/1.0; +market-prices)",
    },
  });
  if (!res.ok) throw new Error(`NAMIS/WFP HTTP ${res.status}`);
  const rows = parseNamisCsv(await res.text());
  if (!rows.length) throw new Error("No recent NAMIS/WFP retail prices parsed");
  cache = { at: Date.now(), rows };
  return rows;
}

export function resetNamisCacheForTests() {
  cache = { at: 0, rows: [] };
}
