import { readFileSync } from "node:fs";
import { farmBrief } from "./farm-guides.js";
import { fetchDistrictWeather, fieldAdviceFor, publicWeather } from "./weather.js";
import { listProductionSeasons } from "./production-management.js";

const CALENDARS = JSON.parse(readFileSync(new URL("../data/crop-calendars.json", import.meta.url), "utf8"));

const GENERIC = {
  water: [
    { from: 0, to: 30, every: 3, note: "Keep the young crop moist" },
    { from: 31, to: 90, every: 4, note: "Water if the soil is dry below the surface" },
  ],
  tasks: [
    { type: "weeding", label: "First weeding", from: 14, to: 21 },
    { type: "fertilizing", label: "Apply fertiliser", from: 21, to: 28 },
    { type: "weeding", label: "Second weeding", from: 28, to: 35 },
  ],
};

const CROPS = {
  maize: {
    water: [
      { from: 0, to: 20, every: 3, note: "Establishment — keep the seedbed moist" },
      { from: 21, to: 45, every: 4, note: "Vegetative growth" },
      { from: 46, to: 75, every: 2, note: "Tasselling and silking — do not let maize dry out" },
      { from: 76, to: 130, every: 4, note: "Grain fill" },
    ],
    tasks: [
      { type: "weeding", label: "First weeding", from: 14, to: 21 },
      { type: "fertilizing", label: "Top-dress with nitrogen", from: 21, to: 28 },
      { type: "weeding", label: "Second weeding", from: 28, to: 35 },
    ],
  },
  soya: {
    water: [
      { from: 0, to: 20, every: 4, note: "Establishment" },
      { from: 35, to: 60, every: 3, note: "Flowering and pod fill — soya needs steady moisture" },
      { from: 61, to: 110, every: 5, note: "Late pod fill" },
    ],
    tasks: [
      { type: "weeding", label: "First weeding", from: 14, to: 21 },
      { type: "weeding", label: "Second weeding", from: 28, to: 35 },
    ],
  },
  groundnut: {
    water: [
      { from: 0, to: 30, every: 4, note: "Establishment — avoid waterlogging" },
      { from: 40, to: 70, every: 4, note: "Pegging — keep soil moist but not flooded" },
    ],
    tasks: [
      { type: "weeding", label: "Weed before pegging", from: 14, to: 28 },
      { type: "fertilizing", label: "Apply gypsum or calcium", from: 40, to: 50 },
    ],
  },
  bean: {
    water: [
      { from: 0, to: 20, every: 3, note: "Establishment" },
      { from: 25, to: 50, every: 3, note: "Flowering — beans drop flowers if they dry out" },
    ],
    tasks: [
      { type: "weeding", label: "Weed the beans", from: 14, to: 25 },
    ],
  },
  rice: {
    water: [
      { from: 0, to: 90, every: 1, note: "Keep the paddy flooded or the soil saturated" },
    ],
    tasks: [
      { type: "weeding", label: "Weed the rice", from: 15, to: 30 },
      { type: "fertilizing", label: "Top-dress nitrogen", from: 25, to: 35 },
    ],
  },
  tobacco: {
    water: [
      { from: 0, to: 30, every: 3, note: "Transplant establishment" },
      { from: 31, to: 70, every: 4, note: "Leaf growth" },
    ],
    tasks: [
      { type: "weeding", label: "Weed and ridge", from: 14, to: 28 },
      { type: "fertilizing", label: "Side-dress fertiliser", from: 21, to: 30 },
    ],
  },
};

function calendarKey(crop) {
  const key = String(crop || "").toLowerCase();
  if (key.includes("maize")) return "maize";
  if (key.includes("soya") || key.includes("soy")) return "soya";
  if (key.includes("ground")) return "groundnut";
  if (key.includes("rice")) return "rice";
  if (key.includes("tobacco")) return "tobacco";
  return "";
}

function varietyFor(calendar, district) {
  const band = (calendar?.bands || []).find((item) => (item.districts || []).includes(district));
  return band ? `Use ${band.varieties} in this district.` : "";
}

function cropPlan(crop, district) {
  const key = calendarKey(crop) || legacyCropKey(crop);
  const names = {
    maize: "Maize",
    soya: "Soya",
    groundnut: "Groundnuts",
    bean: "Beans",
    rice: "Rice",
    tobacco: "Tobacco",
  };
  const base = (key && CROPS[key]) || GENERIC;
  const calendar = CALENDARS[key];
  return {
    name: names[key] || crop || "Crop",
    water: base.water,
    tasks: calendar?.tasks?.length ? calendar.tasks : base.tasks,
    variety: varietyFor(calendar, district),
  };
}

function legacyCropKey(crop) {
  const key = String(crop || "").toLowerCase();
  if (key.includes("bean") || key.includes("pea")) return "bean";
  return "";
}

export function guideForCrop(crop, district) {
  const plan = cropPlan(crop, district);
  return { name: plan.name, variety: plan.variety, tasks: plan.tasks };
}

export function seasonSetup(crop, district) {
  const plan = cropPlan(crop, district);
  const key = calendarKey(crop);
  const calendar = key ? CALENDARS[key] : null;
  const band = (calendar?.bands || []).find((item) => (item.districts || []).includes(district));
  const planting = (plan.tasks || []).find((task) => task.from <= 0 && task.to >= 0);
  const onSheet = Boolean(calendar?.tasks?.length);
  return {
    crop: plan.name,
    variety: plan.variety,
    varieties: band?.varieties || "",
    planting: planting?.detail || "",
    onSheet,
    note: onSheet ? "" : `${plan.name} is not on a district production sheet yet, so the actions are a short general plan.`,
    phaseNote: "The season starts with land preparation. When that work is done, the app tells you it is time to plant. Watering, weeding, and fertiliser dates are counted from the day you record planting.",
  };
}

export function upcomingAction(crop, district, ageDays) {
  const age = Number(ageDays);
  if (!Number.isFinite(age)) return "";
  const next = [...(cropPlan(crop, district).tasks || [])]
    .filter((task) => task.from > age)
    .sort((a, b) => a.from - b.from || a.label.localeCompare(b.label))[0];
  if (!next) return "";
  const days = next.from - age;
  if (days <= 1) return `Next: ${next.label} tomorrow.`;
  return `Next: ${next.label} in ${days} days (day ${next.from}).`;
}

function malawiDate(date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: "Africa/Blantyre" });
}

function addDays(iso, days) {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(startIso, endIso) {
  const start = new Date(`${String(startIso).slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${String(endIso).slice(0, 10)}T00:00:00Z`);
  return Math.round((end - start) / 86400000);
}

function planParts(plan) {
  const tasks = plan.tasks || [];
  return {
    prep: tasks.filter((task) => task.to < 0).sort((a, b) => a.from - b.from || a.label.localeCompare(b.label)),
    plant: tasks.find((task) => task.from <= 0 && task.to >= 0) || null,
    crop: tasks.filter((task) => task.from > 0),
  };
}

function plantingDate(season) {
  const raw = season?.planting_date;
  if (!raw) return null;
  if (typeof raw === "number" || /^\d+$/.test(String(raw))) {
    const value = Number(raw);
    return malawiDate(new Date(value < 1e12 ? value * 1000 : value));
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return String(raw).slice(0, 10);
  return malawiDate(parsed);
}

function taskLogged(activities, task) {
  const label = String(task.label || "").toLowerCase();
  return (activities || []).some((activity) => {
    const type = activity.activity_type;
    const typeOk = type === task.type || type === task.logType || (task.phase === "plant" && type === "planting");
    if (!typeOk) return false;
    const note = String(activity.description || "").toLowerCase();
    if (label && note && !note.includes(label)) return false;
    return true;
  });
}

function taskCard(season, plan, task, date, status, ageDays, phase, detail) {
  return {
    id: `${season.id}:${phase}:${task.type}:${task.from}:${task.label}`,
    seasonId: season.id,
    crop: plan.name,
    parcelName: season.parcel_name || "Plot",
    type: task.type,
    logType: phase === "plant" ? "planting" : task.type,
    phase,
    label: `${task.label} (${plan.name})`,
    detail,
    status,
    dueDate: date,
    ageDays,
  };
}

export function careAdvice(crop, district, { planted = false, ageDays = null, openPrep = 0 } = {}) {
  if (!planted) {
    if (openPrep > 0) {
      return openPrep === 1
        ? "1 land preparation task is still open. Planting comes after it is done."
        : `${openPrep} land preparation tasks are still open. Planting comes after they are done.`;
    }
    return "Land preparation is done. You can plant now.";
  }
  return upcomingAction(crop, district, ageDays);
}

function rainOn(forecast, iso) {
  const day = (forecast || []).find((item) => item.date === iso);
  return day ? Number(day.rain) || 0 : 0;
}

function activityDateKey(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function activityOn(activities, type, iso) {
  return (activities || []).some((activity) => {
    return activity.activity_type === type && activityDateKey(activity.activity_date) === iso;
  });
}

function activityInWindow(activities, type, startIso, fromDay, toDay, label) {
  return (activities || []).some((activity) => {
    if (activity.activity_type !== type) return false;
    const note = String(activity.description || "").toLowerCase();
    if (label && note && !note.includes(String(label).toLowerCase())) return false;
    const when = activityDateKey(activity.activity_date);
    if (!when) return false;
    const age = daysBetween(startIso, when);
    return age >= fromDay && age <= toDay;
  });
}

export function seasonActions(season, activities, date, forecast, district) {
  const plan = cropPlan(season.crop, district);
  const parts = planParts(plan);
  const planted = plantingDate(season);

  if (!planted) {
    const openPrep = parts.prep.filter((task) => !taskLogged(activities, { ...task, phase: "prep", logType: task.type }));
    if (openPrep.length) {
      return openPrep.map((task) => taskCard(season, plan, task, date, "due", null, "prep", task.detail));
    }
    const plant = parts.plant || {
      type: "planting",
      from: 0,
      label: "Record planting",
      detail: "Mark this done on the day you sow. Watering, weeding, and fertiliser dates start from that day.",
    };
    if (taskLogged(activities, { ...plant, phase: "plant", logType: "planting" })) return [];
    const lead = parts.prep.length
      ? "Land preparation is done. You can plant now. "
      : "You can plant now. ";
    return [taskCard(season, plan, plant, date, "due", null, "plant", `${lead}${plant.detail || ""}`.trim())];
  }

  const age = daysBetween(planted, date);
  if (!Number.isFinite(age) || age < 0 || age > 180) return [];

  const rain = rainOn(forecast, date);
  const tasks = [];
  const waterStage = plan.water.find((stage) => age >= stage.from && age <= stage.to);
  const calendarCoversWater = plan.tasks.some((task) => {
    return task.type === "irrigation" && age >= task.from && age <= task.to;
  });
  if (waterStage && !calendarCoversWater && (age - waterStage.from) % waterStage.every === 0) {
    const done = (activities || []).some((activity) => {
      if (activity.activity_type !== "irrigation") return false;
      const when = activityDateKey(activity.activity_date);
      if (!when) return false;
      const gap = daysBetween(when, date);
      return gap >= 0 && gap < waterStage.every;
    });
    const coveredByRain = !done && rain >= 8;
    tasks.push({
      id: `${season.id}:irrigation:${date}`,
      seasonId: season.id,
      crop: plan.name,
      parcelName: season.parcel_name || "Plot",
      type: "irrigation",
      label: `Water the ${plan.name.toLowerCase()}`,
      detail: coveredByRain
        ? `${rain.toFixed(0)} mm of rain is forecast, so watering is not required today.`
        : `${waterStage.note}. Last required interval is every ${waterStage.every} days.`,
      phase: "crop",
      logType: "irrigation",
      status: done ? "done" : coveredByRain ? "covered" : "due",
      dueDate: date,
      ageDays: age,
    });
  }

  for (const task of parts.crop) {
    if (age < task.from || age > task.to) continue;
    const done = activityInWindow(activities, task.type, planted, task.from, task.to, task.label);
    const detail = task.detail;
    tasks.push({
      id: `${season.id}:${task.type}:${task.from}:${task.label}`,
      seasonId: season.id,
      crop: plan.name,
      parcelName: season.parcel_name || "Plot",
      type: task.type,
      logType: task.type,
      phase: "crop",
      label: `${task.label} (${plan.name})`,
      detail,
      status: done ? "done" : "due",
      dueDate: date,
      ageDays: age,
    });
  }

  return tasks;
}

function actionPhrase(label) {
  return String(label || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function careNotifications(upcoming) {
  const cancelIds = [2201, 2202, 2203];
  for (let dayIndex = 0; dayIndex < 3; dayIndex += 1) {
    for (let slot = 0; slot < 8; slot += 1) cancelIds.push(4000 + dayIndex * 8 + slot);
  }

  const notifications = [];
  (upcoming || []).forEach((day, dayIndex) => {
    if (dayIndex > 2) return;
    const groups = new Map();
    for (const task of day.tasks || []) {
      if (task.status !== "due") continue;
      const key = task.seasonId || `${task.crop}:${task.parcelName}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(task);
    }
    let slot = 0;
    for (const tasks of groups.values()) {
      if (slot >= 8) break;
      const first = tasks[0];
      const actions = [...new Set(tasks.map((task) => actionPhrase(task.label)).filter(Boolean))];
      const dayLabel = Number.isFinite(first.ageDays) ? `Day ${first.ageDays}. ` : "";
      notifications.push({
        id: 4000 + dayIndex * 8 + slot,
        dayIndex,
        date: day.date,
        seasonId: first.seasonId,
        crop: first.crop,
        parcelName: first.parcelName,
        ageDays: first.ageDays,
        title: `${first.crop} · ${first.parcelName}`,
        body: `${dayLabel}${actions.join(". ")}.`,
      });
      slot += 1;
    }
  });
  return { notifications, cancelIds };
}

function growingCrops(seasons, today, todayTasks, district, epa, activitiesBySeason) {
  const rows = [];
  for (const season of seasons) {
    const activities = activitiesBySeason.get(season.id) || [];
    const plantedOn = plantingDate(season);
    const age = plantedOn ? daysBetween(plantedOn, today) : null;
    if (plantedOn && (!Number.isFinite(age) || age < -1 || age > 180)) continue;
    const plan = cropPlan(season.crop, district);
    const parts = planParts(plan);
    const openPrep = plantedOn
      ? 0
      : parts.prep.filter((task) => !taskLogged(activities, { ...task, phase: "prep", logType: task.type })).length;
    const hectares = Number(season.area_hectares || season.parcel_size);
    rows.push({
      seasonId: season.id,
      parcelId: season.parcel_id || null,
      crop: plan.name,
      parcelName: season.parcel_name || "Plot",
      planted: Boolean(plantedOn),
      ageDays: plantedOn ? age : null,
      hectares: Number.isFinite(hectares) ? hectares : null,
      variety: plan.variety,
      nextAction: careAdvice(season.crop, district, {
        planted: Boolean(plantedOn),
        ageDays: age,
        openPrep,
      }),
      guide: farmBrief({
        crop: plan.name,
        district,
        epa,
        hectares: Number.isFinite(hectares) ? hectares : null,
      }),
      dueActions: (todayTasks || [])
        .filter((task) => task.seasonId === season.id && task.status === "due")
        .map((task) => task.label),
    });
  }
  return rows;
}

function dedupeTasks(tasks) {
  const byKey = new Map();
  for (const task of tasks) {
    const key = `${task.seasonId}:${task.type}:${task.label}:${task.dueDate}`;
    const existing = byKey.get(key);
    if (!existing || task.status === "done") byKey.set(key, task);
  }
  return [...byKey.values()];
}

export async function dailyFarmCare(db, farmer) {
  const today = malawiDate();
  let weather = null;
  try {
    weather = publicWeather(await fetchDistrictWeather(farmer.district));
  } catch {
    weather = null;
  }

  const seasons = (await listProductionSeasons(db, farmer.id)).filter((season) => {
    return !season.status || season.status === "active" || season.status === "planned";
  });

  const activitiesBySeason = new Map();
  for (const season of seasons) {
    const activities = await db.prepare(`
      SELECT activity_type, activity_date::text AS activity_date, description
      FROM production_activities
      WHERE season_id = ?
    `).all(season.id);
    activitiesBySeason.set(season.id, activities || []);
  }

  const days = [0, 1, 2].map((offset) => addDays(today, offset));
  const upcoming = [];
  for (const date of days) {
    const tasks = [];
    for (const season of seasons) {
      tasks.push(...seasonActions(
        season,
        activitiesBySeason.get(season.id) || [],
        date,
        weather?.forecast,
        farmer.district,
      ));
    }
    upcoming.push({ date, tasks: dedupeTasks(tasks) });
  }

  const tasks = upcoming[0]?.tasks || [];
  const { notifications, cancelIds } = careNotifications(upcoming);
  return {
    date: today,
    forecast: weather?.forecast || [],
    advice: weather ? weather.fieldAdvice : fieldAdviceFor({ rain3day: 0, current: {} }),
    alert: weather?.alert || "unavailable",
    alertHeadline: weather?.alertHeadline || "Weather unavailable",
    tasks,
    growing: growingCrops(seasons, today, tasks, farmer.district, farmer.epa, activitiesBySeason),
    notifications,
    cancelIds,
    upcoming,
  };
}
