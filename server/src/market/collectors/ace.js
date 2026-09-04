import { matchCommodityName } from "../catalog.js";
import { parseMoney } from "../normalize.js";

const ACE_BASE = "https://bvo.aceafrica.org";
export const ACE_BID_URL = `${ACE_BASE}/bid-volume-only.aspx`;
export const ACE_OFFER_URL = `${ACE_BASE}/offer-volume-only.aspx`;

const BVO_ROW_RE =
  /<tr[^>]*>\s*(?:<td[^>]*>[\s\S]*?<\/td>\s*)*?<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([\d,]+(?:\.\d+)?)<\/td>/gi;

const PLAIN_BVO_RE =
  /([A-Za-z][A-Za-z ]{2,30})\s+(?:Grade\s+[A-Z]\s+)?([A-Za-z ]+)?\s*MWK\s*([\d,]+(?:\.\d+)?)/gi;

function normalizeLocation(raw) {
  const value = String(raw || "").trim();
  if (!value) return "Lilongwe";
  return value.split(/[\/,]/)[0].trim();
}

function pushAceRow(rows, seen, commodityLabel, locationLabel, priceText) {
  const commodity = matchCommodityName(commodityLabel);
  const price = parseMoney(priceText);
  if (!commodity || price == null) return;
  const location = normalizeLocation(locationLabel);
  const key = `${commodity.slug}:${location.toLowerCase()}:${price}`;
  if (seen.has(key)) return;
  seen.add(key);
  rows.push({
    crop: commodity.name,
    commoditySlug: commodity.slug,
    buyPricePerKg: price,
    sellPricePerKg: null,
    location,
    market: `${location} (ACE exchange)`,
    priceKind: "market",
    metadata: { exchange: "ACE", side: "bid" },
  });
}

export function parseAceHtml(html, side = "bid") {
  const rows = [];
  const seen = new Set();
  let match;

  while ((match = BVO_ROW_RE.exec(html)) !== null) {
    pushAceRow(rows, seen, match[1], match[3] || match[2], match[4]);
  }

  if (!rows.length) {
    const text = String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    while ((match = PLAIN_BVO_RE.exec(text)) !== null) {
      pushAceRow(rows, seen, match[1], match[2], match[3]);
    }
  }

  return rows.map((row) => ({
    ...row,
    metadata: { ...row.metadata, side },
  }));
}

async function fetchAcePage(url, side) {
  const res = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; NzeruZaAlimi/1.0; +market-prices)",
    },
  });
  if (!res.ok) throw new Error(`ACE HTTP ${res.status} for ${url}`);
  return parseAceHtml(await res.text(), side);
}

export async function fetchAce() {
  const [bids, offers] = await Promise.all([
    fetchAcePage(ACE_BID_URL, "bid"),
    fetchAcePage(ACE_OFFER_URL, "offer"),
  ]);
  const merged = new Map();
  for (const row of [...bids, ...offers]) {
    const key = `${row.commoditySlug}:${row.location.toLowerCase()}`;
    const existing = merged.get(key);
    if (!existing || row.buyPricePerKg > existing.buyPricePerKg) {
      merged.set(key, row);
    }
  }
  return [...merged.values()];
}
