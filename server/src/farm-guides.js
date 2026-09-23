import { readFileSync } from "node:fs";

const GUIDES = JSON.parse(readFileSync(new URL("../data/farm-guides.json", import.meta.url), "utf8"));

const CROP_KEYS = [
  ["groundnut", "groundnut"],
  ["ground nut", "groundnut"],
  ["maize", "maize"],
  ["chimanga", "maize"],
  ["soya", "soya"],
  ["soybean", "soya"],
  ["soy", "soya"],
  ["rice", "rice"],
  ["mpunga", "rice"],
  ["tobacco", "tobacco"],
  ["fodya", "tobacco"],
  ["cotton", "cotton"],
  ["bean", "bean"],
];

function cropGuideKey(crop) {
  const key = String(crop || "").toLowerCase();
  const match = CROP_KEYS.find(([needle]) => key.includes(needle));
  return match ? match[1] : "";
}

function cropFromText(text) {
  return cropGuideKey(text);
}

function districtFamily(name) {
  const key = String(name || "");
  if (/mzimba/i.test(key)) return ["Mzimba", "Mzimba North", "Mzimba South"];
  if (/lilongwe/i.test(key)) return ["Lilongwe", "Lilongwe East", "Lilongwe West"];
  if (/dowa/i.test(key)) return ["Dowa", "Dowa East", "Dowa West"];
  if (/nkhata/i.test(key)) return ["Nkhata Bay", "Nkhatabay"];
  return key ? [key] : [];
}

function pick(table, crop, district) {
  const rows = table?.[crop] || {};
  for (const name of districtFamily(district)) {
    if (rows[name]) return rows[name];
  }
  return rows.National || null;
}

function grouped(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function mwk(value) {
  const text = grouped(value);
  return text ? `MWK ${text}` : "";
}

function scaleInput(item, hectares) {
  const text = String(item.perHa || "");
  const amount = text.match(/([\d.]+)\s*(kg|g|ml|l)\b/i);
  if (!amount) return `${item.specification}: ${text} per ha`;
  const qty = Math.round(Number(amount[1]) * hectares * 10) / 10;
  const shown = Number.isInteger(qty) ? String(qty) : String(qty);
  return `${item.specification}: ${shown} ${amount[2]} for ${hectares} ha`;
}

function quantity(perHa, hectares) {
  const qty = Math.round(Number(perHa) * Number(hectares) * 100) / 100;
  if (!Number.isFinite(qty) || qty <= 0) return "";
  return Number.isInteger(qty) ? String(qty) : String(qty);
}

function supplierFor(district, epa) {
  const family = new Set(districtFamily(district));
  const rows = (GUIDES.suppliers || []).filter((row) =>
    (row.districts || []).some((name) => family.has(name))
  );
  if (!rows.length) return "";
  const epaName = String(epa || "").toLowerCase();
  const exact = rows.find((row) =>
    (row.epas || []).some((name) => String(name).toLowerCase() === epaName)
  );
  return (exact || rows[0]).suppliers || "";
}

export function farmBrief({ crop, district, epa, hectares } = {}) {
  const key = cropGuideKey(crop);
  if (!key) return null;
  const seed = pick(GUIDES.seed, key, district);
  const margin = pick(GUIDES.margins, key, district);
  const offtake = GUIDES.offtake?.[key] || null;
  const inputs = GUIDES.inputs?.[key] || [];
  const area = Number(hectares);
  const brief = { crop: key, district: district || "" };

  if (seed) {
    const qty = quantity(seed.perHa, area);
    brief.seed = qty
      ? `Seed: ${qty} ${seed.unit} for ${area} ha (${seed.perHa} ${seed.unit}/ha, ${seed.variety}).`
      : `Seed: ${seed.perHa} ${seed.unit}/ha, ${seed.variety}.`;
  }
  if (margin?.breakEvenPrice) {
    const place = district || "This district";
    const marginText = margin.marginMwk != null ? ` Gross margin about ${mwk(margin.marginMwk)}/ha.` : "";
    brief.margin = `From the district gross-margin sheet: ${place} break-even ${mwk(margin.breakEvenPrice)}/kg at ${grouped(margin.yieldKgHa)} kg/ha.${marginText}`;
    const marginForField = area > 0 && margin.marginMwk != null ? Math.round(margin.marginMwk * area) : null;
    brief.plan = {
      pricePerKg: margin.priceMwk,
      breakEvenPrice: margin.breakEvenPrice,
      yieldKgHa: margin.yieldKgHa,
      marginPerHa: margin.marginMwk,
      marginForField,
    };
    if (marginForField != null) {
      brief.fieldMargin = `This field (${area} ha): gross margin about ${mwk(marginForField)}.`;
    }
  }
  const supplier = supplierFor(district, epa);
  if (supplier) brief.suppliers = `Inputs near you: ${supplier}`;
  if (inputs.length) {
    const top = inputs.slice(0, 2);
    brief.inputs = top.map((item) => `${item.specification}: ${item.perHa}`).join(". ");
    if (area > 0) brief.fieldInputs = top.map((item) => scaleInput(item, area)).join(". ");
  }
  if (offtake?.buyers) brief.buyers = `Sell to ${offtake.buyers}.`;
  if (offtake?.transport) brief.transport = offtake.transport;
  return brief.seed || brief.margin || brief.suppliers || brief.buyers ? brief : null;
}

export function guideLines(text, brief) {
  if (!brief) return "";
  const lowered = String(text || "").toLowerCase();
  const wantsSeed = /\b(seed|sow|sowing|planting rate|variety)\b/.test(lowered);
  const wantsInputs = /fertil|input|manure|\burea\b|\bnpk\b|supplier|agro-?dealer/.test(lowered)
    || (/\b(buy|where)\b/.test(lowered) && /seed|fertil|input|chemical/.test(lowered));
  const wantsMarket = /\b(sell|price|market|buyer|offtake|transport)\b/.test(lowered);
  const lines = [];
  if (wantsSeed && brief.seed) lines.push(brief.seed);
  if (wantsInputs) {
    if (brief.fieldInputs) lines.push(brief.fieldInputs);
    else if (brief.inputs) lines.push(`Per hectare: ${brief.inputs}.`);
    if (brief.suppliers) lines.push(brief.suppliers);
  }
  if (wantsMarket) {
    if (brief.margin) lines.push(brief.margin);
    if (brief.fieldMargin) lines.push(brief.fieldMargin);
    if (brief.buyers) lines.push(brief.buyers);
    if (brief.transport) lines.push(brief.transport);
  }
  return lines.join("\n");
}

export function adviceFromGuides(text, { district, epa, growing } = {}) {
  const rows = (growing || []).filter((row) => row && row.crop);
  const targets = rows.length ? rows : [{ crop: cropFromText(text) }];
  const chunks = [];
  for (const row of targets) {
    if (!row.crop) continue;
    const brief = row.guide || farmBrief({
      crop: row.crop,
      district,
      epa,
      hectares: row.hectares,
    });
    const lines = guideLines(text, brief);
    if (!lines) continue;
    chunks.push(rows.length > 1 ? `${row.crop}:\n${lines}` : lines);
  }
  return chunks.join("\n\n");
}

const BOARD_CROPS = ["Maize", "Soya", "Groundnuts", "Rice", "Beans"];

function moneyIn(value) {
  const match = String(value || "").match(/([\d,]+(?:\.\d+)?)/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function nameMatches(cropName, key) {
  const name = String(cropName || "").toLowerCase();
  if (!key || !name) return false;
  if (key === "bean") return /\bbeans?\b/.test(name) && !/soya|soy/.test(name);
  if (key === "soya") return /soya|soybean|\bsoy\b/.test(name);
  if (key === "groundnut") return name.includes("groundnut");
  return name.includes(key);
}

export function quoteRows(rows) {
  return (rows || [])
    .map((row) => {
      const pricePerKg = Number(row.pricePerKg ?? row.buyPricePerKg ?? moneyIn(row.price));
      return {
        crop: row.crop,
        pricePerKg: Number.isFinite(pricePerKg) ? pricePerKg : null,
        place: row.warehouse || row.hub || row.market || null,
        source: row.source || (row.live ? "LocalBuyEx" : "Reference"),
        live: Boolean(row.live),
      };
    })
    .filter((row) => row.crop && row.pricePerKg != null);
}

function matchLive(rows, crop) {
  const key = cropGuideKey(crop);
  const hits = (rows || []).filter((row) => nameMatches(row.crop, key));
  return hits.find((row) => row.live) || hits[0] || null;
}

function matchFloor(floors, crop) {
  const key = cropGuideKey(crop);
  const row = (floors || []).find((floor) => cropGuideKey(floor.crop) === key);
  if (!row || !Number.isFinite(Number(row.pricePerKg ?? row.price_per_kg))) return null;
  return { crop: row.crop, pricePerKg: Number(row.pricePerKg ?? row.price_per_kg) };
}

export function buildFarmerQuotes({ district, epa, liveRows, floors, fields } = {}) {
  const targets = (fields || []).filter((row) => row && row.crop);
  const list = targets.length ? targets : BOARD_CROPS.map((crop) => ({ crop }));
  return list.map((field) => {
    const brief = field.guide || farmBrief({
      crop: field.crop,
      district,
      epa,
      hectares: field.hectares,
    });
    return {
      seasonId: field.seasonId || null,
      parcelId: field.parcelId || null,
      parcelName: field.parcelName || null,
      crop: field.crop,
      hectares: Number(field.hectares) > 0 ? Number(field.hectares) : null,
      today: matchLive(liveRows, field.crop),
      floor: matchFloor(floors, field.crop),
      plan: brief?.plan || null,
      seed: brief?.seed || null,
      fieldInputs: brief?.fieldInputs || null,
      fieldMargin: brief?.fieldMargin || null,
    };
  });
}

export function formatFarmerQuotes(quotes, meta = {}) {
  const head = meta?.live
    ? `Warehouse prices${meta.warehouseHub ? ` · ${meta.warehouseHub}` : ""}`
    : "Reference prices";
  const body = (quotes || []).map((quote) => {
    const place = quote.parcelName ? `${quote.parcelName} · ` : "";
    const today = quote.today
      ? `${quote.today.live ? "Today" : "Reference"}: MWK ${grouped(quote.today.pricePerKg)}/kg (${quote.today.source}${quote.today.place ? `, ${quote.today.place}` : ""})`
      : "Today: no warehouse quote";
    const floor = quote.floor ? `Floor: MWK ${grouped(quote.floor.pricePerKg)}/kg` : "Floor: not set";
    return [`${place}${quote.crop}`, today, floor].join("\n");
  }).join("\n\n");
  return body ? `${head}\n\n${body}` : head;
}
