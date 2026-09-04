import { CROP_INFO } from "./advisor.js";
import { listFloors } from "./floors.js";
import { getMarketPrice } from "./market.js";
import { HttpError } from "./util.js";

export const PLAN_CROPS = [
  "Maize", "Groundnuts", "Soybeans", "Cassava", "Sweet potatoes", "Sorghum",
  "Pigeon peas", "Rice", "Tobacco", "Cabbages", "Tomatoes", "Irish Potatoes", "Onions",
];

export const PLANTING_WINDOWS = {
  Maize: { start: 11, end: 12, label: "Nov–Dec" },
  Groundnuts: { start: 11, end: 12, label: "Nov–Dec" },
  Soybeans: { start: 11, end: 12, label: "Nov–Dec" },
  Cassava: { start: 11, end: 1, label: "Nov–Jan" },
  "Sweet potatoes": { start: 10, end: 12, label: "Oct–Dec" },
  Sorghum: { start: 11, end: 12, label: "Nov–Dec" },
  "Pigeon peas": { start: 11, end: 12, label: "Nov–Dec" },
  Rice: { start: 11, end: 1, label: "Nov–Jan" },
  Tobacco: { start: 9, end: 11, label: "Sep–Nov" },
  Cabbages: { start: 3, end: 10, label: "Mar–Oct" },
  Tomatoes: { start: 2, end: 8, label: "Feb–Aug" },
  Onions: { start: 3, end: 6, label: "Mar–Jun" },
  "Irish Potatoes": { start: 3, end: 7, label: "Mar–Jul" },
};

const BUDGET_MODEL = {
  Maize: { yieldKgHa: 1800, priceMwkKg: 610, costPerHa: 450000, riskScore: 40, laborDaysHa: 45, peakWorkersHa: 3, category: "grain" },
  Groundnuts: { yieldKgHa: 900, priceMwkKg: 460, costPerHa: 230000, riskScore: 45, laborDaysHa: 55, peakWorkersHa: 4, category: "legume" },
  Soybeans: { yieldKgHa: 1100, priceMwkKg: 520, costPerHa: 260000, riskScore: 42, laborDaysHa: 50, peakWorkersHa: 3, category: "legume" },
  Cassava: { yieldKgHa: 12000, priceMwkKg: 120, costPerHa: 380000, riskScore: 30, laborDaysHa: 60, peakWorkersHa: 3, category: "root" },
  "Sweet potatoes": { yieldKgHa: 8000, priceMwkKg: 150, costPerHa: 350000, riskScore: 33, laborDaysHa: 55, peakWorkersHa: 3, category: "root" },
  Sorghum: { yieldKgHa: 1200, priceMwkKg: 350, costPerHa: 220000, riskScore: 38, laborDaysHa: 40, peakWorkersHa: 3, category: "grain" },
  "Pigeon peas": { yieldKgHa: 900, priceMwkKg: 480, costPerHa: 210000, riskScore: 40, laborDaysHa: 45, peakWorkersHa: 3, category: "legume" },
  Rice: { yieldKgHa: 2200, priceMwkKg: 580, costPerHa: 620000, riskScore: 55, laborDaysHa: 70, peakWorkersHa: 5, category: "grain" },
  Tobacco: { yieldKgHa: 1000, priceMwkKg: 2400, costPerHa: 1150000, riskScore: 62, laborDaysHa: 95, peakWorkersHa: 5, category: "cash" },
  Cabbages: { yieldKgHa: 27000, priceMwkKg: 300, costPerHa: 3200000, riskScore: 59, laborDaysHa: 115, peakWorkersHa: 5, category: "vegetable" },
  Tomatoes: { yieldKgHa: 25000, priceMwkKg: 350, costPerHa: 3400000, riskScore: 55, laborDaysHa: 110, peakWorkersHa: 5, category: "vegetable" },
  "Irish Potatoes": { yieldKgHa: 18000, priceMwkKg: 900, costPerHa: 5200000, riskScore: 50, laborDaysHa: 100, peakWorkersHa: 5, category: "root" },
  Onions: { yieldKgHa: 20000, priceMwkKg: 400, costPerHa: 3000000, riskScore: 52, laborDaysHa: 95, peakWorkersHa: 4, category: "vegetable" },
};

const DEFAULT_MODEL = { yieldKgHa: 1000, priceMwkKg: 400, costPerHa: 300000, riskScore: 50, laborDaysHa: 50, peakWorkersHa: 3, category: "grain" };

const CATEGORY_COST_SPLIT = {
  grain: { Seed: 0.15, Fertiliser: 0.35, Irrigation: 0.05, Labour: 0.30, Transport: 0.15 },
  legume: { Seed: 0.20, Fertiliser: 0.15, Irrigation: 0.05, Labour: 0.40, Transport: 0.20 },
  root: { Seed: 0.25, Fertiliser: 0.20, Irrigation: 0.10, Labour: 0.30, Transport: 0.15 },
  vegetable: { Seed: 0.28, Fertiliser: 0.13, Irrigation: 0.10, Labour: 0.29, Transport: 0.20 },
  cash: { Seed: 0.10, Fertiliser: 0.30, Irrigation: 0.05, Labour: 0.35, Transport: 0.20 },
};

const READINESS_DEFAULTS = {
  waterSource: "Rainfed only",
  landTenure: "Customary estate",
  experience: "4–10 seasons",
  visitFrequency: "Monthly",
  labourModel: "Family labour",
  supplierDistance: "Within 10 km",
  solarPump: false,
  storage: false,
  equipment: false,
  agronomist: false,
  agritex: true,
  ownTransport: false,
  bulkBuy: false,
};

const READINESS_SCORES = {
  waterSource: { "Rainfed only": 0.2, Borehole: 0.8, "Irrigation scheme": 1.0, "River / dambo": 0.5 },
  landTenure: { "Communal land": 0.4, "Customary estate": 0.6, "Title deed / freehold": 1.0, Leasehold: 0.8 },
  experience: { "Beginner (some knowledge)": 0.3, "1–3 seasons": 0.55, "4–10 seasons": 0.8, "10+ seasons": 1.0 },
  visitFrequency: { Monthly: 1.0, Quarterly: 0.7, Rarely: 0.3 },
  labourModel: { "Family labour": 0.5, "Family + hired": 0.8, "Mostly hired": 1.0 },
  supplierDistance: { "Within 10 km": 1.0, "10–30 km": 0.7, "30–50 km": 0.4, "Over 50 km": 0.15 },
};

const TOGGLE_SCORES = {
  solarPump: 0.6,
  storage: 1.0,
  equipment: 1.0,
  agronomist: 0.4,
  agritex: 0.8,
  ownTransport: 0.7,
  bulkBuy: 0.6,
};

const DAILY_PLAN = {
  grain: [
    { day: "Day -21", title: "Land preparation", desc: "Plough and ridge the plot; incorporate basal fertiliser." },
    { day: "Day -7", title: "Input check", desc: "Confirm seed and fertiliser are on hand before the rains start.", tone: "risk" },
    { day: "Day 0", title: "Planting", desc: "Plant at recommended spacing once rains are established." },
    { day: "Day 21", title: "First weeding & top-dressing", desc: "Weed and apply top-dressing fertiliser.", tone: "good" },
    { day: "Day 45", title: "Second weeding", desc: "Control weeds and check for fall armyworm or stalk borer." },
    { day: "Day 100–120", title: "Harvest window", desc: "Begin harvest once grain moisture is right for storage.", tone: "good" },
  ],
  legume: [
    { day: "Day -14", title: "Land preparation", desc: "Plough and prepare ridges; inoculate seed if available." },
    { day: "Day 0", title: "Planting", desc: "Plant at recommended spacing once rains are established." },
    { day: "Day 21", title: "Weeding", desc: "First weeding round — legumes are sensitive to early weed competition.", tone: "risk" },
    { day: "Day 40", title: "Pest check", desc: "Scout for aphids and pod borers; spray only if thresholds are exceeded." },
    { day: "Day 90–110", title: "Harvest window", desc: "Harvest once pods have dried or matured.", tone: "good" },
  ],
  root: [
    { day: "Day -14", title: "Land preparation", desc: "Ridge the land to allow good root/tuber development." },
    { day: "Day 0", title: "Planting", desc: "Plant cuttings or seed tubers at recommended spacing." },
    { day: "Day 30", title: "Weeding & earthing up", desc: "Weed and earth up ridges to protect developing roots.", tone: "good" },
    { day: "Day 90", title: "Mid-season pest check", desc: "Scout for weevils and blight; treat only if needed.", tone: "risk" },
    { day: "Day 150–270", title: "Harvest window", desc: "Harvest window varies by crop — confirm with your Agritex officer.", tone: "good" },
  ],
  vegetable: [
    { day: "Day -40", title: "Nursery bed preparation", desc: "Prepare well-drained seedling trays or raised beds." },
    { day: "Day 0", title: "Transplant", desc: "Transplant hardened seedlings into the main field." },
    { day: "Day 30", title: "Weeding & maintenance", desc: "Hand weeding, staking, and pest scouting." },
    { day: "Day 60–90", title: "Harvest window", desc: "Harvest as produce reaches market size.", tone: "good" },
  ],
  cash: [
    { day: "Day -50", title: "Nursery preparation", desc: "Prepare seedbeds and sow into sterilised nursery trays." },
    { day: "Day 0", title: "Transplanting", desc: "Transplant into the main field at recommended spacing." },
    { day: "Day 35", title: "Topping & suckering", desc: "Remove flower heads and suckers to direct growth into leaf quality.", tone: "risk" },
    { day: "Day 70–100", title: "Reaping & curing", desc: "Reap leaves in stages and cure according to grade requirements.", tone: "good" },
  ],
};

function parseMarketPrice(crop) {
  return getMarketPrice(crop);
}

function floorPrice(db, crop) {
  const row = listFloors(db).find((item) => item.crop === crop);
  return row?.pricePerKg || null;
}

function getModel(crop) {
  return BUDGET_MODEL[crop] || DEFAULT_MODEL;
}

function inPlantingWindow(month, start, end) {
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
}

export function plantingWindowStatus(crop, startMonth, now = new Date()) {
  const win = PLANTING_WINDOWS[crop];
  const month = Number(startMonth) || now.getMonth() + 1;
  if (!win) return { status: "unknown", label: "No window on file", window: null };
  if (inPlantingWindow(month, win.start, win.end)) {
    return { status: "ontime", label: `Inside ${win.label}`, window: win };
  }
  const dist = Math.min(
    Math.abs(month - win.start),
    Math.abs(month - win.end),
    Math.abs(month - win.start + 12),
  );
  return {
    status: dist <= 2 ? "early" : "late",
    label: dist <= 2 ? `Slightly early for ${win.label}` : `Outside ${win.label}`,
    window: win,
  };
}

export function computeBudget(crop, hectares, db) {
  const model = getModel(crop);
  const ha = Math.max(0.1, Number(hectares) || 1);
  const marketPrice = parseMarketPrice(crop);
  const floor = floorPrice(db, crop);
  const priceMwkKg = marketPrice || model.priceMwkKg;
  const totalCost = model.costPerHa * ha;
  const totalRevenue = model.yieldKgHa * priceMwkKg * ha;
  const totalMargin = totalRevenue - totalCost;
  const roi = totalCost > 0 ? Math.round((totalMargin / totalCost) * 100) : 0;
  const split = CATEGORY_COST_SPLIT[model.category] || CATEGORY_COST_SPLIT.grain;
  const costBreakdown = Object.entries(split).map(([label, frac]) => ({
    label,
    amount: Math.round(totalCost * frac),
  }));
  const grade = model.riskScore <= 40 ? "A" : model.riskScore <= 55 ? "B" : model.riskScore <= 70 ? "C" : "D";
  return {
    crop,
    hectares: ha,
    yieldKgHa: model.yieldKgHa,
    priceMwkKg,
    referencePrice: model.priceMwkKg,
    marketPrice,
    floorPrice: floor,
    belowFloor: floor != null && priceMwkKg < floor,
    costPerHa: model.costPerHa,
    riskScore: model.riskScore,
    category: model.category,
    totalCost,
    totalRevenue,
    totalMargin,
    roi,
    costBreakdown,
    grade,
    peakStaff: Math.max(1, Math.round(model.peakWorkersHa * ha)),
    profitable: totalMargin > 0,
  };
}

export function suggestCrops(farmer) {
  const soil = farmer.soilType || "Sandy loam";
  const nutrient = farmer.nutrientStatus || "Balanced / fertile";
  const scored = PLAN_CROPS.map((crop) => {
    const info = CROP_INFO[crop];
    if (!info) return { crop, score: 0 };
    let score = 0;
    if (info.soils.includes(soil)) score += 2;
    if (info.nutrients.includes(nutrient)) score += 2;
    if (crop === "Maize") score += 1;
    return { crop, score, reason: info.reason };
  }).sort((a, b) => b.score - a.score);
  return scored.filter((row) => row.score > 0).slice(0, 3);
}

export function computeBankability(readiness = READINESS_DEFAULTS) {
  const merged = { ...READINESS_DEFAULTS, ...readiness };
  const checks = [];
  for (const [key, map] of Object.entries(READINESS_SCORES)) {
    checks.push(map[merged[key]] ?? 0.5);
  }
  for (const [key, weight] of Object.entries(TOGGLE_SCORES)) {
    checks.push(merged[key] ? weight : 0);
  }
  const score = checks.length ? Math.round((checks.reduce((a, b) => a + b, 0) / checks.length) * 100) : 0;
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
  const status = score >= 70 ? "Bankable" : score >= 40 ? "Developing — partially bankable" : "Incomplete — not bankable";
  return { score, grade, status, checks };
}

function loadStoredPlan(db, farmerId) {
  const row = db.prepare("SELECT crops_json, readiness_json, updated_at FROM farm_plans WHERE farmer_id = ?").get(farmerId);
  if (!row) return null;
  return {
    crops: JSON.parse(row.crops_json),
    readiness: JSON.parse(row.readiness_json),
    updatedAt: row.updated_at,
  };
}

function defaultCrops(farmer) {
  const suggested = suggestCrops(farmer);
  const crop = suggested[0]?.crop || "Maize";
  const month = String(new Date().getMonth() + 1);
  return [{ crop, hectares: 1, startMonth: month }];
}

export function saveFarmPlan(db, farmer, input) {
  const crops = Array.isArray(input.crops) ? input.crops : null;
  if (!crops?.length) throw HttpError(400, "Add at least one crop to the plan");
  const cleaned = crops.map((row) => {
    const crop = String(row.crop || "").trim();
    if (!PLAN_CROPS.includes(crop)) throw HttpError(400, `Unsupported crop: ${crop}`);
    const hectares = Math.max(0.1, Number(row.hectares) || 0.1);
    const startMonth = String(Math.min(12, Math.max(1, Number(row.startMonth) || new Date().getMonth() + 1)));
    return { crop, hectares, startMonth };
  });
  const readiness = { ...READINESS_DEFAULTS, ...(input.readiness || {}) };
  const now = Date.now();
  db.prepare(`
    INSERT INTO farm_plans (farmer_id, crops_json, readiness_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(farmer_id) DO UPDATE SET
      crops_json = excluded.crops_json,
      readiness_json = excluded.readiness_json,
      updated_at = excluded.updated_at
  `).run(farmer.id, JSON.stringify(cleaned), JSON.stringify(readiness), now);
  return buildFarmPlan(db, farmer, { stored: { crops: cleaned, readiness, updatedAt: now } });
}

export function buildFarmPlan(db, farmer, options = {}) {
  const stored = options.stored || loadStoredPlan(db, farmer.id) || {
    crops: defaultCrops(farmer),
    readiness: { ...READINESS_DEFAULTS },
    updatedAt: null,
  };
  const budgets = stored.crops.map((row) => ({
    ...row,
    planting: plantingWindowStatus(row.crop, row.startMonth),
    budget: computeBudget(row.crop, row.hectares, db),
    cropInfo: CROP_INFO[row.crop] || null,
  }));
  const combined = budgets.reduce((acc, row) => {
    const b = row.budget;
    acc.hectares += b.hectares;
    acc.totalCost += b.totalCost;
    acc.totalRevenue += b.totalRevenue;
    acc.totalMargin += b.totalMargin;
    acc.peakStaff = Math.max(acc.peakStaff, b.peakStaff);
    acc.riskScore = Math.max(acc.riskScore, b.riskScore);
    return acc;
  }, { hectares: 0, totalCost: 0, totalRevenue: 0, totalMargin: 0, peakStaff: 0, riskScore: 0 });
  combined.roi = combined.totalCost > 0 ? Math.round((combined.totalMargin / combined.totalCost) * 100) : 0;
  combined.profitable = combined.totalMargin > 0;

  const primary = budgets[0]?.budget || computeBudget("Maize", 1, db);
  const bankability = computeBankability(stored.readiness);
  const weather = options.weather;

  return {
    crops: budgets,
    readiness: stored.readiness,
    updatedAt: stored.updatedAt,
    combined,
    bankability,
    suggestedCrops: suggestCrops(farmer),
    cropOptions: PLAN_CROPS,
    readinessFields: Object.keys(READINESS_DEFAULTS),
    primaryCrop: budgets[0]?.crop || "Maize",
    tabs: {
      dailyPlan: DAILY_PLAN[primary.category] || DAILY_PLAN.grain,
      cashflow: buildCashflow(combined),
      inputs: primary.costBreakdown,
      sensitivity: buildSensitivity(primary),
    },
    decisions: buildDecisions(budgets, combined, bankability),
    weatherNote: weather
      ? `${weather.district} is ${weather.alert.toUpperCase()} — ${weather.fieldAdvice}`
      : null,
  };
}

function buildCashflow(combined) {
  return [
    { label: "Month 1 — land prep & first inputs", amount: -Math.round(combined.totalCost * 0.45) },
    { label: "Month 2 — labour & fertiliser top-up", amount: -Math.round(combined.totalCost * 0.35) },
    { label: "Month 3 — final inputs & transport", amount: -Math.round(combined.totalCost * 0.20) },
    { label: "Harvest & sale — total revenue", amount: Math.round(combined.totalRevenue) },
  ];
}

function buildSensitivity(budget) {
  const priceVars = [-0.2, -0.1, 0, 0.1, 0.2];
  const yieldSteps = [-0.4, -0.2, -0.1, 0, 0.1, 0.2, 0.4];
  return yieldSteps.map((ys) => {
    const yieldKgHa = Math.max(1, Math.round(budget.yieldKgHa * (1 + ys)));
    return {
      yieldKgHa,
      base: ys === 0,
      cells: priceVars.map((pv) => {
        const price = budget.priceMwkKg * (1 + pv);
        const margin = Math.round(yieldKgHa * price - budget.costPerHa);
        return { priceChange: pv, margin, base: pv === 0 && ys === 0 };
      }),
    };
  });
}

function buildDecisions(budgets, combined, bankability) {
  const items = [];
  items.push({
    icon: combined.profitable ? "✓" : "!",
    title: combined.profitable ? "Projected margin is positive" : "Margin is negative at current prices",
    detail: `Combined margin ${combined.totalMargin >= 0 ? "MWK " + combined.totalMargin.toLocaleString("en") : "below zero"} on ${combined.hectares.toFixed(1)} ha.`,
  });
  items.push({
    icon: bankability.score >= 70 ? "✓" : "!",
    title: `Bankability ${bankability.score}/100 — ${bankability.status}`,
    detail: bankability.score >= 70
      ? "Readiness profile is strong enough for most lenders to review."
      : "Complete the readiness answers before asking for finance.",
  });
  const late = budgets.filter((row) => row.planting.status === "late");
  if (late.length) {
    items.push({
      icon: "!",
      title: `${late.length} crop${late.length === 1 ? "" : "s"} outside the planting window`,
      detail: late.map((row) => `${row.crop} (${row.planting.label})`).join("; "),
    });
  }
  const belowFloor = budgets.filter((row) => row.budget.belowFloor);
  if (belowFloor.length) {
    items.push({
      icon: "!",
      title: "Market price below ministry floor",
      detail: belowFloor.map((row) => `${row.crop} at MWK ${row.budget.priceMwkKg}/kg`).join("; "),
    });
  }
  if (budgets.length <= 1) {
    items.push({
      icon: "!",
      title: "Mono-cropping risk",
      detail: "Consider adding a legume or root crop to spread price and weather risk.",
    });
  }
  return items;
}

export function getFarmPlan(db, farmer, options = {}) {
  return buildFarmPlan(db, farmer, options);
}
