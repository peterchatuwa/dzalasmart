import { DISTRICT_COORDS, regionForDistrict } from "../places.js";

export const WAREHOUSE_HUBS = ["Lilongwe", "Kasungu", "Mchinji"];

export const WAREHOUSE_COORDS = {
  Lilongwe: [-13.98, 33.78],
  Kasungu: [-13.03, 33.48],
  Mchinji: [-13.80, 32.88],
};

export const MAJOR_TRADING_CENTRES = [
  { name: "Lilongwe City", district: "Lilongwe", lat: -13.97, lon: 33.78 },
  { name: "Kasungu Boma", district: "Kasungu", lat: -13.03, lon: 33.48 },
  { name: "Mchinji Boma", district: "Mchinji", lat: -13.80, lon: 32.88 },
  { name: "Mzuzu City", district: "Mzimba", lat: -11.45, lon: 34.02 },
  { name: "Blantyre City", district: "Blantyre", lat: -15.79, lon: 35.00 },
  { name: "Zomba City", district: "Zomba", lat: -15.39, lon: 35.32 },
  { name: "Mangochi Boma", district: "Mangochi", lat: -14.48, lon: 35.26 },
  { name: "Balaka Boma", district: "Balaka", lat: -14.98, lon: 34.95 },
  { name: "Salima Boma", district: "Salima", lat: -13.78, lon: 34.43 },
  { name: "Nkhotakota Boma", district: "Nkhotakota", lat: -12.92, lon: 34.30 },
  { name: "Dedza Boma", district: "Dedza", lat: -14.38, lon: 34.33 },
  { name: "Ntcheu Boma", district: "Ntcheu", lat: -14.82, lon: 34.63 },
  { name: "Mulanje Boma", district: "Mulanje", lat: -16.03, lon: 35.50 },
  { name: "Thyolo Boma", district: "Thyolo", lat: -16.07, lon: 35.14 },
  { name: "Karonga Boma", district: "Karonga", lat: -9.93, lon: 33.93 },
  { name: "Nsanje Boma", district: "Nsanje", lat: -16.92, lon: 35.26 },
];

export function haversineKm(a, b) {
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

export function districtSlug(district) {
  return String(district || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function tradingCentreSlug(name, district) {
  return `tc-${districtSlug(district)}-${String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export async function ensureTradingCentre(db, input = {}) {
  const district = String(input.district || "").trim();
  const name = String(input.name || input.market || "").trim();
  if (!district || !name) return null;
  const slug = input.slug || tradingCentreSlug(name, district);
  const region = input.region || regionForDistrict(district);
  const parent = await db.prepare(`
    SELECT id FROM market_locations WHERE slug = ? AND type = 'district'
  `).get(districtSlug(district));
  const coords = DISTRICT_COORDS[district] || [input.lat, input.lon];
  await db.prepare(`
    INSERT INTO market_locations (id, slug, name, type, parent_id, region, district, lat, lon)
    VALUES (@id, @slug, @name, 'trading_centre', @parent_id, @region, @district, @lat, @lon)
    ON CONFLICT(slug) DO UPDATE SET
      name = EXCLUDED.name,
      parent_id = EXCLUDED.parent_id,
      region = EXCLUDED.region,
      district = EXCLUDED.district,
      lat = EXCLUDED.lat,
      lon = EXCLUDED.lon
  `).run({
    id: `loc-${slug}`,
    slug,
    name,
    parent_id: parent?.id || null,
    region,
    district,
    lat: input.lat ?? coords?.[0] ?? null,
    lon: input.lon ?? coords?.[1] ?? null,
  });
  return slug;
}

export async function listLocationTree(db, filters = {}) {
  const rows = await db.prepare(`
    SELECT id, slug, name, type, parent_id, region, district, lat, lon
    FROM market_locations
    ORDER BY
      CASE type
        WHEN 'region' THEN 1
        WHEN 'district' THEN 2
        WHEN 'market' THEN 3
        WHEN 'trading_centre' THEN 4
        ELSE 5
      END,
      name
  `).all();

  const byId = new Map(rows.map((row) => [row.id, {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    region: row.region,
    district: row.district,
    lat: row.lat,
    lon: row.lon,
    children: [],
  }]));

  const roots = [];
  for (const row of rows) {
    const node = byId.get(row.id);
    if (row.parent_id && byId.has(row.parent_id)) {
      byId.get(row.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  }

  if (filters.district) {
    const district = String(filters.district).trim();
    return roots.flatMap((region) => region.children.filter((node) => node.district === district || node.name === district));
  }
  if (filters.region) {
    return roots.filter((node) => node.name === filters.region || node.region === filters.region);
  }
  return roots;
}

export async function listTradingCentres(db, district = null) {
  if (district) {
    return db.prepare(`
      SELECT slug, name, district, region, lat, lon
      FROM market_locations
      WHERE type = 'trading_centre' AND district = ?
      ORDER BY name
    `).all(district);
  }
  return db.prepare(`
    SELECT slug, name, district, region, lat, lon
    FROM market_locations
    WHERE type = 'trading_centre'
    ORDER BY district, name
  `).all();
}
