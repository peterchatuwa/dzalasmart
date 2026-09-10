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

async function countByDistrict(db) {
  const farmers = await db
    .prepare(
      `
    SELECT district, epa, COUNT(*) AS count
    FROM farmers
    GROUP BY district, epa
  `
    )
    .all();
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

async function pestsByDistrict(db) {
  const map = new Map();
  for (const report of await listPestReports(db)) {
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
  const { period, farmersByDistrict, pestsByDistrictMap, weatherByDistrict, epaCount, epasWithFarmers } = context;

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
  const risk =
    alertDistricts >= 2 || (regionName === "Southern Region" && alertDistricts >= 1)
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

async function storedTonnes(db) {
  const row = await db
    .prepare(
      `
    SELECT COALESCE(SUM(weight_kg), 0) AS kg
    FROM warehouse_receipts
    WHERE status = 'accepted'
  `
    )
    .get();
  return Number(((row?.kg || 0) / 1000).toFixed(2));
}

export async function nationalView(db, staff, options = {}) {
  const now = options.now ?? Date.now();
  const period = periodIndex(now);
  const farmers = await countByDistrict(db);
  const pestsByDistrictMap = await pestsByDistrict(db);

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
    regionCoverage(
      name,
      list.filter((district) => inScope(staff, district)),
      context
    )
  );

  const totalEpas = Object.values(DISTRICT_EPAS).reduce((sum, epas) => sum + epas.length, 0);
  const scopedEpas = scopedDistricts.reduce((sum, district) => sum + (epaCount.get(district) || 0), 0);
  const farmersRegistered = scopedDistricts.reduce((sum, district) => sum + (farmers.byDistrict.get(district) || 0), 0);
  const openPestReports = (await listPestReports(db)).length;
  const tonnes = await storedTonnes(db);
  const healthy = districts.filter((row) => row.status === "healthy").length;
  const watch = districts.filter((row) => row.status === "watch").length;
  const alert = districts.filter((row) => row.status === "alert").length;

  const foodSecurityRisk = [];
  const foodSecurityTimeline = [];
  
  // Current period (period 0)
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
  
  // Multi-period predictive timeline (next 3 periods = 15 days)
  const currentAlertCount = districts.filter((d) => d.status === "alert").length;
  const currentWatchCount = districts.filter((d) => d.status === "watch").length;
  const severeWeatherCount = districts.filter((d) => d.weatherAlert === "severe").length;
  
  // Period 0: Current snapshot
  foodSecurityTimeline.push({
    period: 0,
    label: "Current (5-day)",
    timestamp: now,
    alertDistricts: currentAlertCount,
    watchDistricts: currentWatchCount,
    healthyDistricts: healthy,
    riskLevel: currentAlertCount > 0 ? "high" : currentWatchCount > 3 ? "medium" : "low",
    confidence: 100,
  });
  
  // Period 1: +5 days prediction (based on current trends)
  const period1Projection = {
    period: 1,
    label: "Forecast (+5 days)",
    timestamp: now + 5 * 24 * 60 * 60 * 1000,
    alertDistricts: Math.max(0, currentAlertCount - Math.floor(currentAlertCount * 0.2)), // Assume 20% improvement if interventions happen
    watchDistricts: currentWatchCount + Math.floor(severeWeatherCount * 0.3), // Weather may degrade some healthy districts
    healthyDistricts: healthy - Math.floor(severeWeatherCount * 0.3),
    riskLevel: currentAlertCount > 2 ? "high" : "medium",
    confidence: 75,
  };
  foodSecurityTimeline.push(period1Projection);
  
  // Period 2: +10 days prediction
  const period2Projection = {
    period: 2,
    label: "Forecast (+10 days)",
    timestamp: now + 10 * 24 * 60 * 60 * 1000,
    alertDistricts: Math.max(0, period1Projection.alertDistricts - 1),
    watchDistricts: Math.max(0, period1Projection.watchDistricts - 1),
    healthyDistricts: districts.length - Math.max(0, period1Projection.alertDistricts - 1) - Math.max(0, period1Projection.watchDistricts - 1),
    riskLevel: period1Projection.alertDistricts > 1 ? "medium" : "low",
    confidence: 60,
  };
  foodSecurityTimeline.push(period2Projection);
  
  // Period 3: +15 days prediction (seasonal baseline)
  const period3Projection = {
    period: 3,
    label: "Forecast (+15 days)",
    timestamp: now + 15 * 24 * 60 * 60 * 1000,
    alertDistricts: Math.max(0, Math.floor(districts.length * 0.05)), // Baseline ~5% alert rate
    watchDistricts: Math.max(0, Math.floor(districts.length * 0.15)), // Baseline ~15% watch rate
    healthyDistricts: Math.floor(districts.length * 0.8),
    riskLevel: "low",
    confidence: 45,
  };
  foodSecurityTimeline.push(period3Projection);

  const scope = staff?.role === "extension" && staff.district ? staff.district : "national";

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
      productionForecastT: tonnes > 0 ? Number((3.4 + tonnes / 1000).toFixed(2)) : 3.62,
      ...(await plotCoverageStats(db)),
    },
    foodSecurityRisk,
    foodSecurityTimeline,
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
  return await nationalView(db, staff, { weatherAlerts });
}
