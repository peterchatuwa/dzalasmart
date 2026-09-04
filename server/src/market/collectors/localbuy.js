import { matchCommodityName } from "../catalog.js";
import { parseMoney } from "../normalize.js";
import { warehouseHub } from "../locations.js";

const LOCALBUY_URL = "https://www.localbuyex.com/";

const CODE_TO_CROP = {
  WH: "Maize",
  SB: "Soya beans",
  LR: "Irish Potatoes",
  BN: "Beans",
  SM: "Sesame",
};

export { LOCALBUY_URL };

export function parseLocalBuyHtml(html) {
  const catalog = [];
  const rowRe = /<tr>\s*<td>([A-Z]{2})<\/td>\s*<td>[\s\S]*?title="([^"]+)"[\s\S]*?<\/td>\s*<td>([^<]*)<\/td>\s*<td>([\d,]+\.?\d*)<\/td>\s*<td>([\d,]+\.?\d*)<\/td>\s*<td>([^<]+)<\/td>/g;
  let match;
  while ((match = rowRe.exec(html)) !== null) {
    const buyPrice = parseMoney(match[4]);
    if (buyPrice == null) continue;
    const cropName = CODE_TO_CROP[match[1]] || match[2].trim();
    const commodity = matchCommodityName(cropName) || matchCommodityName(match[2].trim());
    catalog.push({
      code: match[1],
      product: match[2].trim(),
      crop: commodity?.name || cropName,
      commoditySlug: commodity?.slug || null,
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

export async function fetchLocalBuy() {
  const res = await fetch(LOCALBUY_URL, {
    headers: { Accept: "text/html", "User-Agent": "NzeruZaAlimi/1.0 (+market-prices)" },
  });
  if (!res.ok) throw new Error(`LocalBuyEx HTTP ${res.status}`);
  const parsed = parseLocalBuyHtml(await res.text());
  if (!parsed.catalog.length) throw new Error("No commodity rows parsed from LocalBuyEx");
  return parsed;
}
