import { listPestReports } from "./advisor.js";
import { baseNdvi, ndviLabel, ndviStatus, periodIndex } from "./ndvi.js";
import { DISTRICT_COORDS } from "./places.js";
import { HttpError } from "./util.js";

const MALAWI = { latMin: -17.5, latMax: -9, lonMin: 32.5, lonMax: 36.5 };

function hashSeed(text) {
  let h = 0;
  for (const ch of text) {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return h;
}

function epaJitter(district, epa) {
  const h = hashSeed(`${district}|${epa || ""}`);
  return {
    dLat: (h % 100) / 1000 - 0.05,
    dLon: ((h >> 3) % 100) / 1000 - 0.05,
  };
}

export function estimateCentroid(farmer) {
  const coords = DISTRICT_COORDS[farmer.district] || [-13.5, 34.0];
  const jitter = epaJitter(farmer.district, farmer.epa);
  return {
    lat: Number((coords[0] + jitter.dLat).toFixed(6)),
    lon: Number((coords[1] + jitter.dLon).toFixed(6)),
  };
}

export async function plotHectares(db, farmerId) {
  const row = await db.prepare("SELECT crops_json FROM farm_plans WHERE farmer_id = ?").get(farmerId);
  if (row) {
    try {
      const crops = JSON.parse(row.crops_json);
      const total = crops.reduce((sum, item) => sum + (Number(item.hectares) || 0), 0);
      if (total > 0) return Number(total.toFixed(2));
    } catch {
      /* fall through */
    }
  }
  return 1.0;
}

export function buildPolygon(lat, lon, hectares) {
  const sideM = Math.sqrt(Math.max(hectares, 0.1) * 10000);
  const halfLat = (sideM / 2) / 111000;
  const halfLon = (sideM / 2) / (111000 * Math.cos((lat * Math.PI) / 180));
  return [
    { lat: lat - halfLat, lon: lon - halfLon },
    { lat: lat - halfLat, lon: lon + halfLon },
    { lat: lat + halfLat, lon: lon + halfLon },
    { lat: lat + halfLat, lon: lon - halfLon },
  ].map((point) => ({
    lat: Number(point.lat.toFixed(6)),
    lon: Number(point.lon.toFixed(6)),
  }));
}

export async function plotNdvi(db, farmer) {
  let ndvi = baseNdvi(farmer.district, periodIndex());
  const h = hashSeed(farmer.id);
  ndvi = Number((ndvi + ((h % 11) - 5) / 100).toFixed(2));
  const pests = (await listPestReports(db)).filter((row) => row.farmerId === farmer.id).length;
  if (pests) ndvi = Number(Math.max(0.32, ndvi - pests * 0.05).toFixed(2));
  return ndvi;
}

function assertMalawiCoords(lat, lon) {
  if (lat < MALAWI.latMin || lat > MALAWI.latMax || lon < MALAWI.lonMin || lon > MALAWI.lonMax) {
    throw HttpError(400, "Coordinates must fall inside Malawi");
  }
}

function mapLinks(lat, lon) {
  const d = 0.04;
  const bbox = `${(lon - d).toFixed(4)},${(lat - d).toFixed(4)},${(lon + d).toFixed(4)},${(lat + d).toFixed(4)}`;
  return {
    bbox,
    embedUrl: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lon.toFixed(5)}`,
    openUrl: `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lon.toFixed(5)}#map=14/${lat.toFixed(5)}/${lon.toFixed(5)}`,
  };
}

function rowToPlot(row) {
  return {
    lat: row.lat,
    lon: row.lon,
    hectares: row.hectares,
    polygon: JSON.parse(row.polygon_json),
    source: row.source,
    accuracyM: row.accuracy_m,
    ndvi: row.ndvi,
    ndviStatus: ndviStatus(row.ndvi),
    ndviLabel: ndviLabel(row.ndvi),
    updatedAt: row.updated_at,
    verified: row.source === "gps",
  };
}

async function persistPlot(db, farmer, data) {
  const now = Date.now();
  const ndvi = await plotNdvi(db, farmer);
  await db.prepare(`
    INSERT INTO farm_plots (
      farmer_id, lat, lon, hectares, polygon_json, source, accuracy_m, ndvi, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(farmer_id) DO UPDATE SET
      lat = excluded.lat,
      lon = excluded.lon,
      hectares = excluded.hectares,
      polygon_json = excluded.polygon_json,
      source = excluded.source,
      accuracy_m = excluded.accuracy_m,
      ndvi = excluded.ndvi,
      updated_at = excluded.updated_at
  `).run(
    farmer.id,
    data.lat,
    data.lon,
    data.hectares,
    JSON.stringify(data.polygon),
    data.source,
    data.accuracyM ?? null,
    ndvi,
    now,
  );
}

export async function ensureEstimatedPlot(db, farmer) {
  const existing = await db.prepare("SELECT * FROM farm_plots WHERE farmer_id = ?").get(farmer.id);
  if (existing) return rowToPlot(existing);
  const centroid = estimateCentroid(farmer);
  const hectares = await plotHectares(db, farmer.id);
  const polygon = buildPolygon(centroid.lat, centroid.lon, hectares);
  await persistPlot(db, farmer, {
    ...centroid,
    hectares,
    polygon,
    source: "estimated",
    accuracyM: null,
  });
  return rowToPlot(await db.prepare("SELECT * FROM farm_plots WHERE farmer_id = ?").get(farmer.id));
}

export async function getFarmerPlot(db, farmer) {
  let plot = await ensureEstimatedPlot(db, farmer);
  const hectares = await plotHectares(db, farmer.id);
  if (Math.abs(plot.hectares - hectares) > 0.01) {
    const polygon = buildPolygon(plot.lat, plot.lon, hectares);
    await persistPlot(db, farmer, {
      lat: plot.lat,
      lon: plot.lon,
      hectares,
      polygon,
      source: plot.source,
      accuracyM: plot.accuracyM,
    });
    plot = rowToPlot(await db.prepare("SELECT * FROM farm_plots WHERE farmer_id = ?").get(farmer.id));
  }
  const map = mapLinks(plot.lat, plot.lon);
  return {
    plot,
    map,
    coordsLabel: `${Math.abs(plot.lat).toFixed(4)}°${plot.lat < 0 ? "S" : "N"}, ${Math.abs(plot.lon).toFixed(4)}°${plot.lon < 0 ? "W" : "E"}`,
    note: plot.verified
      ? "GPS pin captured from the farmer phone and saved on the server."
      : "EPA centroid estimate — tap Use my location to replace this with a real GPS pin.",
  };
}

export async function saveFarmerPlot(db, farmer, input = {}) {
  const lat = Number(input.lat);
  const lon = Number(input.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw HttpError(400, "lat and lon are required");
  }
  assertMalawiCoords(lat, lon);
  const hectares = input.hectares != null
    ? Math.max(0.1, Number(input.hectares) || await plotHectares(db, farmer.id))
    : await plotHectares(db, farmer.id);
  const polygon = buildPolygon(lat, lon, hectares);
  await persistPlot(db, farmer, {
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    hectares,
    polygon,
    source: input.source === "gps" ? "gps" : "manual",
    accuracyM: input.accuracyM != null ? Number(input.accuracyM) : null,
  });
  return getFarmerPlot(db, farmer);
}

export async function plotCoverageStats(db) {
  const rows = await db.prepare("SELECT source FROM farm_plots").all();
  const verified = rows.filter((row) => row.source === "gps").length;
  return {
    farmersWithPlots: rows.length,
    verifiedGpsPlots: verified,
  };
}
