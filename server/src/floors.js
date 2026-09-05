import { assertPlace } from "./places.js";
import { farmerStatus, getFarmerById, logStage } from "./farmers.js";
import { stageByKey } from "./stages.js";
import { HttpError } from "./util.js";

const POST_HARVEST_INDEX = stageByKey("post_harvest").index;

export const DEFAULT_FLOORS = [
  { crop: "Maize", pricePerKg: 550 },
  { crop: "Groundnuts", pricePerKg: 420 },
  { crop: "Soybeans", pricePerKg: 490 },
  { crop: "Rice", pricePerKg: 500 },
  { crop: "Pigeon peas", pricePerKg: 400 },
];

const STATUS_LABEL = {
  cleared: "Above floor",
  blocked: "Below floor — blocked",
};

export function judgeOffer(pricePerKg, floorPerKg) {
  return pricePerKg >= floorPerKg ? "cleared" : "blocked";
}

export async function listFloors(db) {
  return (await db.prepare("SELECT crop, price_per_kg, updated_at FROM price_floors ORDER BY crop").all()).map(
    (row) => ({
      crop: row.crop,
      pricePerKg: row.price_per_kg,
      updatedAt: row.updated_at,
    })
  );
}

export async function floorFor(db, crop) {
  const name = String(crop || "").trim();
  const row = await db.prepare("SELECT * FROM price_floors WHERE crop = ? COLLATE NOCASE").get(name);
  return row ? { crop: row.crop, pricePerKg: row.price_per_kg } : null;
}

function publicContract(row) {
  return {
    id: row.id,
    buyer: row.buyer,
    crop: row.crop,
    district: row.district,
    pricePerKg: row.price_per_kg,
    floorPerKg: row.floor_per_kg,
    status: row.status,
    statusLabel: STATUS_LABEL[row.status] || row.status,
    farmerId: row.farmer_id,
    farmerName: row.farmer_name || null,
    farmerCode: row.farmer_code || null,
    staffName: row.staff_name,
    createdAt: row.created_at,
  };
}

const CONTRACT_SELECT = `
  SELECT c.*, f.name AS farmer_name, f.code AS farmer_code, s.name AS staff_name
  FROM offtake_contracts c
  LEFT JOIN farmers f ON f.id = c.farmer_id
  JOIN staff s ON s.id = c.staff_id
`;

export async function listContracts(db) {
  return (await db.prepare(`${CONTRACT_SELECT} ORDER BY c.created_at DESC`).all()).map(publicContract);
}

export async function listContractsForFarmer(db, farmerId) {
  return (await listContracts(db)).filter((row) => row.farmerId === farmerId);
}

export async function contractMonitor(db) {
  const contracts = await listContracts(db);
  const violations = contracts.filter((row) => row.status === "blocked");
  return {
    floors: await listFloors(db),
    contracts,
    violationCount: violations.length,
    clearedCount: contracts.filter((row) => row.status === "cleared").length,
  };
}

export async function setFloor(db, staff, input = {}) {
  const crop = String(input.crop || "").trim();
  const existing = await floorFor(db, crop);
  if (!existing && !DEFAULT_FLOORS.some((row) => row.crop.toLowerCase() === crop.toLowerCase())) {
    throw HttpError(400, "Unknown crop");
  }
  const pricePerKg = Number(input.pricePerKg);
  if (!Number.isInteger(pricePerKg) || pricePerKg < 1 || pricePerKg > 100000) {
    throw HttpError(400, "Floor price must be a whole number of MWK per kg");
  }
  const name = existing?.crop || DEFAULT_FLOORS.find((row) => row.crop.toLowerCase() === crop.toLowerCase()).crop;
  await db
    .prepare(
      `
    INSERT INTO price_floors (crop, price_per_kg, updated_at, updated_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(crop) DO UPDATE SET price_per_kg = excluded.price_per_kg, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  `
    )
    .run(name, pricePerKg, Date.now(), staff.id);
  return { floors: await listFloors(db) };
}

export async function recordOffer(db, staff, input = {}) {
  const buyer = String(input.buyer || "").trim();
  if (buyer.length < 2) throw HttpError(400, "Buyer name is required");
  const floor = await floorFor(db, input.crop);
  if (!floor) throw HttpError(400, "No ministry floor for that crop");
  const district = String(input.district || "").trim();
  assertPlace(district);

  const pricePerKg = Number(input.pricePerKg);
  if (!Number.isInteger(pricePerKg) || pricePerKg < 1 || pricePerKg > 100000) {
    throw HttpError(400, "Offer price must be a whole number of MWK per kg");
  }

  let farmer = null;
  if (input.farmerId) {
    farmer = await getFarmerById(db, input.farmerId);
    if (!farmer) throw HttpError(404, "Farmer not found");
    const status = await farmerStatus(db, farmer);
    const currentIndex = status.currentStage?.index ?? -1;
    if (currentIndex < POST_HARVEST_INDEX) {
      throw HttpError(
        409,
        "This farmer has not reached Post-Harvest Handling yet. Grain must be graded before it can be sold."
      );
    }
  }

  const status = judgeOffer(pricePerKg, floor.pricePerKg);
  const row = {
    id: crypto.randomUUID(),
    buyer,
    crop: floor.crop,
    district,
    price_per_kg: pricePerKg,
    floor_per_kg: floor.pricePerKg,
    status,
    farmer_id: farmer?.id || null,
    staff_id: staff.id,
    created_at: Date.now(),
  };

  await db
    .prepare(
      `
    INSERT INTO offtake_contracts
      (id, buyer, crop, district, price_per_kg, floor_per_kg, status, farmer_id, staff_id, created_at)
    VALUES
      (@id, @buyer, @crop, @district, @price_per_kg, @floor_per_kg, @status, @farmer_id, @staff_id, @created_at)
  `
    )
    .run(row);

  let stageAdvanced = false;
  let farmerRecord = farmer ? await farmerStatus(db, farmer) : null;
  if (farmer && status === "cleared" && (farmerRecord.currentStage?.index ?? -1) === POST_HARVEST_INDEX) {
    farmerRecord = await logStage(db, farmer, { channel: "sale" });
    stageAdvanced = true;
  }

  const contract = (await listContracts(db)).find((item) => item.id === row.id);
  return {
    contract,
    stageAdvanced,
    farmer: farmerRecord,
    monitor: await contractMonitor(db),
  };
}

export async function seedFloorsIfEmpty(db) {
  const count = (await db.prepare("SELECT COUNT(*) AS n FROM price_floors").get()).n;
  if (count > 0) return false;
  const insert = db.prepare(`
    INSERT INTO price_floors (crop, price_per_kg, updated_at, updated_by)
    VALUES (?, ?, ?, NULL)
  `);
  const now = Date.now();
  for (const row of DEFAULT_FLOORS) await insert.run(row.crop, row.pricePerKg, now);
  return true;
}

export async function seedContractsIfEmpty(db, staffId) {
  const count = (await db.prepare("SELECT COUNT(*) AS n FROM offtake_contracts").get()).n;
  if (count > 0 || !staffId) return false;
  const demo = [
    { buyer: "AgroBuy Traders", crop: "Maize", district: "Nkhotakota", pricePerKg: 610 },
    { buyer: "Kanyenda Vendor Group", crop: "Groundnuts", district: "Kasungu", pricePerKg: 380 },
    { buyer: "Chikweo Millers", crop: "Maize", district: "Dedza", pricePerKg: 595 },
  ];
  for (const offer of demo) {
    await recordOffer(db, { id: staffId }, offer);
  }
  return true;
}
