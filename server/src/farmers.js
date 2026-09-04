import { hashPin, pinMatches, signFarmerToken } from "./auth.js";
import { assertPlace } from "./places.js";
import { STAGES, publicStage, stageByIndex, stageByKey } from "./stages.js";
import { HttpError, assertPin, normalizePhone, publicFarmer } from "./util.js";

function genFarmerCode(district) {
  const letters = (district || "MW").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  const r1 = String(Math.floor(1000 + Math.random() * 9000));
  const r2 = String(Math.floor(1000 + Math.random() * 9000));
  return `MW-${letters}-${r1}-${r2}`;
}

async function currentStageIndex(db, farmerId) {
  const row = await db.prepare(
    "SELECT MAX(stage_index) AS max_index FROM season_events WHERE farmer_id = ?"
  ).get(farmerId);
  return row?.max_index == null ? -1 : row.max_index;
}

async function listEvents(db, farmerId) {
  return (await db.prepare(
    `SELECT id, stage_index, stage_key, stage_name, channel, created_at
     FROM season_events WHERE farmer_id = ? ORDER BY stage_index ASC`
  ).all(farmerId)).map((row) => ({
    id: row.id,
    stageIndex: row.stage_index,
    stageKey: row.stage_key,
    stageName: row.stage_name,
    channel: row.channel,
    createdAt: row.created_at,
  }));
}

export async function farmerStatus(db, farmer) {
  const currentIndex = await currentStageIndex(db, farmer.id);
  const current = stageByIndex(currentIndex);
  const next = stageByIndex(currentIndex + 1);
  return {
    farmer: publicFarmer(farmer),
    currentStage: publicStage(current),
    nextStage: publicStage(next),
    seasonComplete: currentIndex >= STAGES.length - 1,
    events: await listEvents(db, farmer.id),
  };
}

export async function getFarmerById(db, id) {
  return (await db.prepare("SELECT * FROM farmers WHERE id = ?").get(id)) || null;
}

export async function listFarmerSummaries(db) {
  const rows = await db.prepare("SELECT * FROM farmers ORDER BY name COLLATE NOCASE").all();
  const summaries = [];
  for (const row of rows) {
    const status = await farmerStatus(db, row);
    summaries.push({
      farmer: status.farmer,
      currentStage: status.currentStage,
      nextStage: status.nextStage,
      eventCount: status.events.length,
      lastEventAt: status.events.at(-1)?.createdAt || null,
    });
  }
  return summaries;
}

export async function findFarmerByPhone(db, phone) {
  return (await db.prepare("SELECT * FROM farmers WHERE phone = ?").get(normalizePhone(phone))) || null;
}

export async function registerFarmer(db, input, jwtSecret) {
  const name = String(input.name || "").trim();
  if (name.length < 2) throw HttpError(400, "Name is required");
  const phone = normalizePhone(input.phone);
  const pin = assertPin(input.pin);
  const district = String(input.district || "").trim();
  const epa = String(input.epa || "").trim() || null;
  const region = assertPlace(district, epa);
  const existing = await db.prepare("SELECT id FROM farmers WHERE phone = ?").get(phone);
  if (existing) throw HttpError(409, "This phone is already registered");

  const farmer = {
    id: crypto.randomUUID(),
    code: String(input.code || genFarmerCode(district)),
    name,
    phone,
    pin_hash: hashPin(pin),
    district,
    epa,
    region,
    soil_type: input.soilType || null,
    nutrient_status: input.nutrientStatus || null,
    created_at: Date.now(),
  };

  await db.prepare(`
    INSERT INTO farmers (id, code, name, phone, pin_hash, district, epa, region, soil_type, nutrient_status, created_at)
    VALUES (@id, @code, @name, @phone, @pin_hash, @district, @epa, @region, @soil_type, @nutrient_status, @created_at)
  `).run(farmer);

  const saved = await db.prepare("SELECT * FROM farmers WHERE id = ?").get(farmer.id);
  return {
    token: signFarmerToken(saved, jwtSecret),
    farmer: publicFarmer(saved),
  };
}

export async function loginFarmer(db, input, jwtSecret) {
  const farmer = await findFarmerByPhone(db, input.phone);
  if (!farmer || !pinMatches(assertPin(input.pin), farmer.pin_hash)) {
    throw HttpError(401, "Phone or PIN is incorrect");
  }
  return {
    token: signFarmerToken(farmer, jwtSecret),
    farmer: publicFarmer(farmer),
  };
}

export async function logStage(db, farmer, input = {}) {
  const currentIndex = await currentStageIndex(db, farmer.id);
  if (currentIndex >= STAGES.length - 1) {
    throw HttpError(409, "This season is already complete");
  }
  const next = stageByIndex(currentIndex + 1);
  const requested = input.stageKey ? stageByKey(input.stageKey) : next;
  if (!requested) throw HttpError(400, "Unknown stage");
  if (requested.index !== next.index) {
    throw HttpError(409, `Next milestone must be ${next.name}`);
  }

  const event = {
    id: crypto.randomUUID(),
    farmer_id: farmer.id,
    stage_index: next.index,
    stage_key: next.key,
    stage_name: next.name,
    channel: input.channel || "api",
    created_at: Date.now(),
  };

  await db.prepare(`
    INSERT INTO season_events (id, farmer_id, stage_index, stage_key, stage_name, channel, created_at)
    VALUES (@id, @farmer_id, @stage_index, @stage_key, @stage_name, @channel, @created_at)
  `).run(event);

  return await farmerStatus(db, farmer);
}

export async function seedIfEmpty(db) {
  const count = (await db.prepare("SELECT COUNT(*) AS n FROM farmers").get()).n;
  if (count > 0) return false;

  const demo = [
    {
      name: "Grace Banda",
      phone: "+265888000001",
      pin: "1234",
      district: "Nkhotakota",
      epa: "Zidyana",
      code: "MW-NKT-0417-2291",
      soilType: "Sandy loam",
      nutrientStatus: "Low nitrogen",
      eventsThrough: 4,
    },
    {
      name: "Joseph Kaunda",
      phone: "+265888000002",
      pin: "1234",
      district: "Kasungu",
      epa: "Kaluluma",
      code: "MW-KAS-0842-1187",
      soilType: "Clay loam",
      nutrientStatus: "Low phosphorus",
      eventsThrough: 1,
    },
    {
      name: "Estere Mvula",
      phone: "+265888000003",
      pin: "1234",
      district: "Balaka",
      epa: "Bazale",
      code: "MW-BAL-0219-3364",
      soilType: "Sandy",
      nutrientStatus: "Balanced / fertile",
      eventsThrough: -1,
    },
  ];

  for (const person of demo) {
    const created = await registerFarmer(db, person, "seed-only");
    const farmer = await db.prepare("SELECT * FROM farmers WHERE id = ?").get(created.farmer.id);
    for (let i = 0; i <= person.eventsThrough; i++) {
      await logStage(db, farmer, { channel: "seed" });
    }
  }
  return true;
}
