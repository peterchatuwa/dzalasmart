import { matchCommodityName } from "../catalog.js";
import { parseMoney } from "../normalize.js";

const ULIMI_URL = "https://www.ulimi.online/";

export { ULIMI_URL };

export function parseUlimiHtml(html) {
  const rows = [];
  const re = /([A-Za-z][A-Za-z ]*?)MWK\s*([\d,]+)\s*\/\s*kg/gi;
  let match;
  const seen = new Set();
  while ((match = re.exec(html)) !== null) {
    const label = match[1].trim();
    const price = parseMoney(match[2]);
    if (!label || price == null) continue;
    const commodity = matchCommodityName(label);
    if (!commodity) continue;
    const key = commodity.slug;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      crop: commodity.name,
      commoditySlug: commodity.slug,
      buyPricePerKg: price,
      sellPricePerKg: null,
      market: "Malawi (Ulimi platform)",
    });
  }
  return rows;
}

export async function fetchUlimi() {
  const res = await fetch(ULIMI_URL, {
    headers: { Accept: "text/html", "User-Agent": "NzeruZaAlimi/1.0 (+market-prices)" },
  });
  if (!res.ok) throw new Error(`Ulimi HTTP ${res.status}`);
  const rows = parseUlimiHtml(await res.text());
  if (!rows.length) throw new Error("No commodity prices parsed from Ulimi");
  return rows;
}
