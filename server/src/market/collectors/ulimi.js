import { matchCommodityName } from "../catalog.js";
import { parseMoney } from "../normalize.js";

const ULIMI_URL = "https://www.ulimi.online/";

export { ULIMI_URL };

const TICKER_ITEM_RE =
  /opacity-70">([^<]+)<\/span>\s*<span[^>]*>\s*MWK\s*([\d,]+(?:\.\d+)?)\s*\/\s*kg\s*<\/span>/gi;

const PLAIN_PRICE_RE =
  /([A-Za-z][A-Za-z ]*?)\s+MWK\s*([\d,]+(?:\.\d+)?)\s*\/\s*kg/gi;

function stripHtmlComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

function pushRow(rows, seen, label, priceText) {
  const price = parseMoney(priceText);
  if (!label || price == null) return;
  const commodity = matchCommodityName(label);
  if (!commodity || seen.has(commodity.slug)) return;
  seen.add(commodity.slug);
  rows.push({
    crop: commodity.name,
    commoditySlug: commodity.slug,
    buyPricePerKg: price,
    sellPricePerKg: null,
    market: "Malawi (Ulimi platform)",
  });
}

export function parseUlimiHtml(html) {
  const rows = [];
  const seen = new Set();
  const scope = stripHtmlComments(html);
  let match;

  while ((match = TICKER_ITEM_RE.exec(scope)) !== null) {
    pushRow(rows, seen, match[1].trim(), match[2]);
  }

  if (!rows.length) {
    const text = scope.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    while ((match = PLAIN_PRICE_RE.exec(text)) !== null) {
      pushRow(rows, seen, match[1].trim(), match[2]);
    }
  }

  return rows;
}

export async function fetchUlimi() {
  const res = await fetch(ULIMI_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; NzeruZaAlimi/1.0; +market-prices)",
    },
  });
  if (!res.ok) throw new Error(`Ulimi HTTP ${res.status}`);
  const rows = parseUlimiHtml(await res.text());
  if (!rows.length) throw new Error("No commodity prices parsed from Ulimi");
  return rows;
}
