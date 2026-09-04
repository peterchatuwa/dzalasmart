import { HttpError } from "../util.js";
import { matchCommodityName } from "./catalog.js";
import { toPricePerKg } from "./normalize.js";
import { insertObservations, resolveCommodity, resolveLocation, updateSourceStatus } from "./store.js";
import { sourceIdBySlug } from "./seed.js";

const HEADER_ALIASES = {
  commodity: ["commodity", "crop", "product"],
  district: ["district", "location", "market"],
  buy: ["buy_price_per_kg", "buy", "buyprice", "price", "price_per_kg"],
  sell: ["sell_price_per_kg", "sell", "sellprice"],
  priceKind: ["price_kind", "kind", "type"],
  unit: ["unit", "raw_unit"],
  observedAt: ["observed_at", "date", "observed", "observation_date"],
  notes: ["notes", "note", "comment"],
};

function normalizeHeader(cell) {
  return String(cell || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function headerIndex(headerRow) {
  const map = {};
  headerRow.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(key) && map[field] == null) map[field] = index;
    }
  });
  if (map.commodity == null || map.buy == null) {
    throw HttpError(400, "CSV header must include commodity/crop and buy price columns");
  }
  return map;
}

function splitCsvLine(line) {
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
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function parseObservedAt(raw) {
  if (!raw) return Date.now();
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 1_000_000_000_000) return numeric;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function parseMarketCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (!lines.length) throw HttpError(400, "CSV is empty");

  const firstCells = splitCsvLine(lines[0]);
  const looksLikeHeader = firstCells.some((cell) =>
    ["commodity", "crop", "buy", "buy_price_per_kg", "district"].includes(normalizeHeader(cell)));
  const idx = looksLikeHeader ? headerIndex(firstCells) : {
    commodity: 0,
    district: 1,
    buy: 2,
    sell: 3,
    priceKind: 4,
    unit: 5,
    observedAt: 6,
    notes: 7,
  };
  const start = looksLikeHeader ? 1 : 0;
  const rows = [];

  for (let lineNo = start; lineNo < lines.length; lineNo += 1) {
    const cells = splitCsvLine(lines[lineNo]);
    if (!cells.length || cells.every((cell) => !cell)) continue;
    const commodityLabel = cells[idx.commodity];
    const commodity = matchCommodityName(commodityLabel);
    if (!commodity) {
      throw HttpError(400, `Unknown commodity on line ${lineNo + 1}: ${commodityLabel}`);
    }
    const buyRaw = Number(cells[idx.buy]);
    if (!Number.isFinite(buyRaw) || buyRaw <= 0) {
      throw HttpError(400, `Invalid buy price on line ${lineNo + 1}`);
    }
    const unit = idx.unit != null ? cells[idx.unit] || "kg" : "kg";
    const sellRaw = idx.sell != null && cells[idx.sell] ? Number(cells[idx.sell]) : null;
    rows.push({
      commoditySlug: commodity.slug,
      district: idx.district != null ? cells[idx.district] : null,
      buyPricePerKg: toPricePerKg(buyRaw, unit),
      sellPricePerKg: sellRaw != null ? toPricePerKg(sellRaw, unit) : null,
      rawUnit: unit,
      rawAmount: buyRaw,
      priceKind: idx.priceKind != null ? (cells[idx.priceKind] || "market") : null,
      observedAt: parseObservedAt(idx.observedAt != null ? cells[idx.observedAt] : null),
      notes: idx.notes != null ? cells[idx.notes] || null : null,
    });
  }

  if (!rows.length) throw HttpError(400, "No data rows found in CSV");
  return rows;
}

const IMPORTABLE_SOURCES = new Set(["admarc", "nfra", "ace", "namis", "worldbank", "manual"]);

export async function importMarketCsv(db, staff, input = {}) {
  const sourceSlug = String(input.sourceSlug || input.source || "manual").trim().toLowerCase();
  if (!IMPORTABLE_SOURCES.has(sourceSlug)) {
    throw HttpError(400, "Imports must target ADMARC, NFRA, ACE, NAMIS, World Bank, or manual");
  }
  const sourceId = await sourceIdBySlug(db, sourceSlug);
  if (!sourceId) throw HttpError(400, "Unknown market source");

  const defaultPriceKind = input.priceKind
    || (sourceSlug === "admarc" || sourceSlug === "nfra" ? "procurement" : "reference");
  const parsed = parseMarketCsv(input.csv || input.text || "");
  const observationRows = [];

  for (const row of parsed) {
    const commodity = await resolveCommodity(db, row.commoditySlug);
    if (!commodity) continue;
    const location = await resolveLocation(db, { district: row.district });
    if (!location) {
      throw HttpError(400, `Unknown district: ${row.district || "(missing)"}`);
    }
    observationRows.push({
      commodityId: commodity.id,
      locationId: location.id,
      buyPricePerKg: row.buyPricePerKg,
      sellPricePerKg: row.sellPricePerKg,
      rawUnit: row.rawUnit,
      rawAmount: row.rawAmount,
      priceKind: row.priceKind || defaultPriceKind,
      notes: row.notes || `Imported by ${staff.name}`,
      observedAt: row.observedAt,
      metadata: { staffId: staff.id, import: true, sourceSlug },
    });
  }

  const saved = await insertObservations(db, sourceSlug, observationRows);
  if (!saved) throw HttpError(400, "No rows could be imported");
  await updateSourceStatus(db, sourceSlug, { ok: true });
  return { saved, sourceSlug, priceKind: defaultPriceKind };
}
