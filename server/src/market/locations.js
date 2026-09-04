import { DISTRICT_COORDS } from "../places.js";

export const WAREHOUSE_COORDS = {
  Lilongwe: [-13.98, 33.78],
  Kasungu: [-13.03, 33.48],
  Mchinji: [-13.80, 32.88],
};

function haversineKm(a, b) {
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
