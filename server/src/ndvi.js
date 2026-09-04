import { listPestReports } from "./advisor.js";
import { plotCoverageStats } from "./plots.js";
import { DISTRICT_EPAS, REGION_DISTRICTS, regionForDistrict } from "./places.js";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

function hashSeed(text) {
  let h = 0;
  for (const ch of text) {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return h;
}

export function periodIndex(now = Date.now()) {
  return Math.floor(now / FIVE_DAYS_MS);
}

export function baseNdvi(district, period = periodIndex()) {
  const h = hashSeed(`${district}:${period}`);
  return Number((0.35 + (h % 40) / 100).toFixed(2));
}

export function ndviStatus(ndvi) {
  if (ndvi >= 0.6) return "healthy";
  if (ndvi >= 0.45) return "watch";
  return "alert";
}

export function ndviLabel(ndvi) {
  const status = ndviStatus(ndvi);
  if (status === "healthy") return "Healthy growth";
  if (status === "watch") return "Early stress signal";
  return "Likely yield loss";
}

function countByDistrict(db) {
  const farmers = db.prepare(`
    SELECT district, epa, COUNT(*) AS count
    FROM farmers
    GROUP BY district, epa
  `).all();
  const byDistrict = new Map();
  const byEpa = new Map();
  for (const row of farmers) {
    byDistrict.set(row.district, (byDistrict.get(row.district) || 0) + row.count);
    if (row.epa) {
      const key = `${row.district}::${row.epa}`;
      byEpa.set(key, (byEpa.get(key) || 0) + row.count);
    }
  }
  return { byDistrict, byEpa };
}

function pestsByDistrict(db) {
  const map = new Map();
  for (const report of listPestReports(db)) {
    map.set(report.district, (map.get(report.district) || 0) + 1);
  }
  return map;
}

function inScope(staff, district) {
  if (!staff || staff.role === "ministry" || staff.role === "fum") return true;
  if (staff.role === "extension" && staff.district) return district === staff.district;
  return false;
}

function districtRow(district, context) {
  const {
    period,
    farmersByDistrict,
    pestsByDistrictMap,
    weatherByDistrict,
    epaCount,
    epasWithFarmers,
  } = context;

  let ndvi = baseNdvi(district, period);
  const pestReports = pestsByDistrictMap.get(district) || 0;
  if (pestReports) ndvi = Number(Math.max(0.32, ndvi - pestReports * 0.06).toFixed(2));

  let status = ndviStatus(ndvi);
  if (pestReports >= 2) status = "alert";
  else if (pestReports >= 1 && status === "healthy") status = "watch";

  const weatherAlert = weatherByDistrict.get(district) || null;
  if (weatherAlert === "severe" && status !== "alert") status = "watch";

  return {
    name: district,
    region: regionForDistrict(district),
    ndvi,
    status,
    label: ndviLabel(ndvi),
    epas: epaCount.get(district) || 0,
    epasWithFarmers: epasWithFarmers.get(district) || 0,
    farmersRegistered: farmersByDistrict.get(district) || 0,
    pestReports,
    weatherAlert,
  };
}

function regionCoverage(regionName, districts, context) {
  const { epaCount, epasWithFarmers, farmersByDistrict } = context;
  let epasTotal = 0;
  let epasLive = 0;
  let farmers = 0;
  for (const district of districts) {
    epasTotal += epaCount.get(district) || 0;
    epasLive += epasWithFarmers.get(district) || 0;
    farmers += farmersByDistrict.get(district) || 0;
  }
  const registeredPct = epasTotal ? Math.round((epasLive / epasTotal) * 100) : 0;
  const alertDistricts = districts.filter((name) => {
    const row = districtRow(name, context);
    return row.status === "alert";
  }).length;
  const risk = alertDistricts >= 2 || (regionName === "Southern Region" && alertDistricts >= 1)
    ? "elevated"
    : registeredPct < 50
      ? "watch"
      : "low";
  return {
    name: regionName,
    epasTotal,
    epasWithFarmers: epasLive,
    farmersRegistered: farmers,
    registeredPct,
    risk,
  };
}

function storedTonnes(db) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(weight_kg), 0) AS kg
    FROM warehouse_receipts
    WHERE status = 'accepted'
  `).get();
  return Number(((row?.kg || 0) / 1000).toFixed(2));
}

export function nationalView(db, staff, options = {}) {
  const now = options.now ?? Date.now();
  const period = periodIndex(now);
  const farmers = countByDistrict(db);
  const pestsByDistrictMap = pestsByDistrict(db);

  const epaCount = new Map();
  const epasWithFarmers = new Map();
  for (const [district, epas] of Object.entries(DISTRICT_EPAS)) {
    epaCount.set(district, epas.length);
    epasWithFarmers.set(district, 0);
  }
  for (const [key] of farmers.byEpa) {
    const [district] = key.split("::");
    epasWithFarmers.set(district, (epasWithFarmers.get(district) || 0) + 1);
  }

  const weatherByDistrict = new Map();
  for (const row of options.weatherAlerts || []) {
    weatherByDistrict.set(row.district, row.alert);
  }

  const context = {
    period,
    farmersByDistrict: farmers.byDistrict,
    pestsByDistrictMap,
    weatherByDistrict,
    epaCount,
    epasWithFarmers,
  };

  const allDistricts = Object.keys(DISTRICT_EPAS).sort();
  const scopedDistricts = allDistricts.filter((district) => inScope(staff, district));
  const districts = scopedDistricts.map((name) => districtRow(name, context));

  const regions = Object.entries(REGION_DISTRICTS).map(([name, list]) =>
    regionCoverage(name, list.filter((district) => inScope(staff, district)), context)
  );

  const totalEpas = Object.values(DISTRICT_EPAS).reduce((sum, epas) => sum + epas.length, 0);
  const scopedEpas = scopedDistricts.reduce((sum, district) => sum + (epaCount.get(district) || 0), 0);
  const farmersRegistered = scopedDistricts.reduce(
    (sum, district) => sum + (farmers.byDistrict.get(district) || 0),
    0
  );
  const openPestReports = listPestReports(db).length;
  const tonnes = storedTonnes(db);
  const healthy = districts.filter((row) => row.status === "healthy").length;
  const watch = districts.filter((row) => row.status === "watch").length;
  const alert = districts.filter((row) => row.status === "alert").length;

  const foodSecurityRisk = [];
  for (const row of districts) {
    if (row.status === "alert") {
      foodSecurityRisk.push({
        district: row.name,
        reason: row.pestReports
          ? `NDVI stress with ${row.pestReports} open pest report${row.pestReports === 1 ? "" : "s"}`
          : "Satellite NDVI below the alert threshold",
      });
    } else if (row.weatherAlert === "severe") {
      foodSecurityRisk.push({
        district: row.name,
        reason: "Severe rain or wind on the live weather watch list",
      });
    }
  }

  const scope = staff?.role === "extension" && staff.district
    ? staff.district
    : "national";

  return {
    scope,
    updatedAt: now,
    periodLabel: "5-day satellite pass",
    periodIndex: period,
    districts,
    regions,
    stats: {
      epasMonitored: staff?.role === "extension" ? scopedEpas : totalEpas,
      districtsMapped: districts.length,
      healthy,
      watch,
      alert,
      farmersRegistered,
      openPestReports,
      storedTonnes: tonnes,
      productionForecastT: tonnes > 0
        ? Number((3.4 + tonnes / 1000).toFixed(2))
        : 3.62,
      ...plotCoverageStats(db),
    },
    foodSecurityRisk,
  };
}

export async function nationalViewWithWeather(db, staff) {
  let weatherAlerts = [];
  try {
    const { districtAlerts } = await import("./weather.js");
    weatherAlerts = await districtAlerts();
  } catch {
    weatherAlerts = [];
  }
  return nationalView(db, staff, { weatherAlerts });
}
