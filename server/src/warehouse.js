import { farmerStatus, getFarmerById, logStage } from "./farmers.js";
import { listContractsForFarmer } from "./floors.js";
import { buildPassport } from "./passport.js";
import { stageByKey } from "./stages.js";
import { HttpError } from "./util.js";

const HARVEST_INDEX = stageByKey("harvest").index;
const LOAN_RATIO = 0.6;

export const GRAIN_CROPS = [
  { crop: "Maize", pricePerKg: 1050, acceptAt: 13.5, dryingAt: 16 },
  { crop: "Groundnuts", pricePerKg: 2400, acceptAt: 10, dryingAt: 14 },
  { crop: "Soybeans", pricePerKg: 1720, acceptAt: 13, dryingAt: 16 },
  { crop: "Rice", pricePerKg: 580, acceptAt: 14, dryingAt: 16 },
  { crop: "Pigeon peas", pricePerKg: 1150, acceptAt: 13, dryingAt: 16 },
];

const STATUS_LABEL = {
  accepted: "Graded",
  drying_required: "Drying required",
  rejected: "Rejected",
};

export function cropSpec(name) {
  return (
    GRAIN_CROPS.find(
      (row) =>
        row.crop.toLowerCase() ===
        String(name || "")
          .trim()
          .toLowerCase()
    ) || null
  );
}

export function gradeMoisture(crop, moisturePct) {
  const spec = cropSpec(crop);
  if (!spec) throw HttpError(400, "Unknown crop");
  if (moisturePct <= spec.acceptAt) return "accepted";
  if (moisturePct <= spec.dryingAt) return "drying_required";
  return "rejected";
}

function genReceiptCode(district) {
  const letters = (district || "MW")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const n = String(Math.floor(1000 + Math.random() * 9000));
  return `WR-${letters}-${n}`;
}

function publicReceipt(row) {
  return {
    id: row.id,
    code: row.code,
    farmerId: row.farmer_id,
    farmerCode: row.farmer_code,
    farmerName: row.farmer_name,
    crop: row.crop,
    weightKg: row.weight_kg,
    moisturePct: row.moisture_pct,
    pricePerKg: row.price_per_kg,
    assetValue: row.asset_value,
    loanCap: row.loan_cap,
    loanDisbursed: row.loan_disbursed,
    loanPending: row.status === "accepted" && row.loan_cap > 0 && row.loan_disbursed === 0,
    status: row.status,
    statusLabel: STATUS_LABEL[row.status] || row.status,
    staffName: row.staff_name,
    warehouse: row.warehouse,
    createdAt: row.created_at,
  };
}

const RECEIPT_SELECT = `
  SELECT r.*, f.code AS farmer_code, f.name AS farmer_name,
         s.name AS staff_name, s.org AS warehouse
  FROM warehouse_receipts r
  JOIN farmers f ON f.id = r.farmer_id
  JOIN staff s ON s.id = r.staff_id
`;

export async function listReceipts(db) {
  return (await db.prepare(`${RECEIPT_SELECT} ORDER BY r.created_at DESC`).all()).map(publicReceipt);
}

export async function listReceiptsForFarmer(db, farmerId) {
  return (await db.prepare(`${RECEIPT_SELECT} WHERE r.farmer_id = ? ORDER BY r.created_at DESC`).all(farmerId)).map(
    publicReceipt
  );
}

export async function withReceipts(db, status) {
  const receipts = await listReceiptsForFarmer(db, status.farmer.id);
  const contracts = await listContractsForFarmer(db, status.farmer.id);
  return {
    ...status,
    receipts,
    passport: buildPassport(status, receipts, contracts),
  };
}

export function pendingLoanReceipts(receipts) {
  return receipts.filter((row) => row.loanPending).sort((a, b) => a.createdAt - b.createdAt);
}

export async function acceptWarehouseLoan(db, farmer, input = {}) {
  const receipts = await listReceiptsForFarmer(db, farmer.id);
  const pending = pendingLoanReceipts(receipts);
  const target = input.receiptId ? receipts.find((row) => row.id === input.receiptId) : pending[0] || null;

  if (!target) {
    if (receipts.some((row) => row.status === "accepted" && row.loanDisbursed > 0)) {
      throw HttpError(409, "This warehouse loan has already been sent to the registered wallet.");
    }
    if (receipts.some((row) => row.status === "drying_required")) {
      throw HttpError(409, "Grain is still drying. No loan until moisture is at the accept band.");
    }
    throw HttpError(409, "No graded grain is waiting for a loan. Deliver to your cooperative after harvest.");
  }
  if (target.status !== "accepted" || target.loanCap <= 0) {
    throw HttpError(409, "This lot is not eligible for a warehouse loan.");
  }
  if (target.loanDisbursed > 0) {
    throw HttpError(409, "This warehouse loan has already been sent to the registered wallet.");
  }

  await db.prepare("UPDATE warehouse_receipts SET loan_disbursed = loan_cap WHERE id = ?").run(target.id);
  const updated = (await listReceiptsForFarmer(db, farmer.id)).find((row) => row.id === target.id);
  return {
    receipt: updated,
    farmer: await withReceipts(db, await farmerStatus(db, farmer)),
  };
}

export async function warehouseSummary(db) {
  const receipts = await listReceipts(db);
  const accepted = receipts.filter((row) => row.status === "accepted");
  const totalKg = accepted.reduce((sum, row) => sum + row.weightKg, 0);
  const moistureSum = accepted.reduce((sum, row) => sum + row.moisturePct * row.weightKg, 0);
  const latest = accepted[0] || receipts[0] || null;
  return {
    lotsToday: receipts.filter((row) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return row.createdAt >= start.getTime();
    }).length,
    acceptedLots: accepted.length,
    rejectedLots: receipts.filter((row) => row.status === "rejected").length,
    dryingLots: receipts.filter((row) => row.status === "drying_required").length,
    storedKg: Number(totalKg.toFixed(1)),
    avgMoisture: totalKg ? Number((moistureSum / totalKg).toFixed(1)) : null,
    latest,
    receipts,
  };
}

export async function recordIntake(db, staff, input = {}) {
  const farmer = await getFarmerById(db, input.farmerId);
  if (!farmer) throw HttpError(404, "Farmer not found");

  const spec = cropSpec(input.crop);
  if (!spec) throw HttpError(400, "Unknown crop");

  const weightKg = Number(input.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 50000) {
    throw HttpError(400, "Weight must be between 0 and 50,000 kg");
  }

  const moisturePct = Number(input.moisturePct);
  if (!Number.isFinite(moisturePct) || moisturePct < 0 || moisturePct > 40) {
    throw HttpError(400, "Moisture must be between 0 and 40%");
  }

  const status = await farmerStatus(db, farmer);
  const currentIndex = status.currentStage?.index ?? -1;
  if (currentIndex < HARVEST_INDEX) {
    throw HttpError(409, "This farmer has not reached Harvest yet. Grain can only be taken in after harvest.");
  }

  const grade = gradeMoisture(spec.crop, moisturePct);
  const assetValue = Math.round(weightKg * spec.pricePerKg);
  const loanCap = Math.round(assetValue * LOAN_RATIO);
  const accepted = grade === "accepted";

  let code = genReceiptCode(farmer.district);
  while (await db.prepare("SELECT id FROM warehouse_receipts WHERE code = ?").get(code)) {
    code = genReceiptCode(farmer.district);
  }

  const row = {
    id: crypto.randomUUID(),
    code,
    farmer_id: farmer.id,
    staff_id: staff.id,
    crop: spec.crop,
    weight_kg: Number(weightKg.toFixed(1)),
    moisture_pct: Number(moisturePct.toFixed(1)),
    price_per_kg: spec.pricePerKg,
    asset_value: assetValue,
    loan_cap: accepted ? loanCap : 0,
    loan_disbursed: 0,
    status: grade,
    created_at: Date.now(),
  };

  await db
    .prepare(
      `
    INSERT INTO warehouse_receipts
      (id, code, farmer_id, staff_id, crop, weight_kg, moisture_pct, price_per_kg, asset_value, loan_cap, loan_disbursed, status, created_at)
    VALUES
      (@id, @code, @farmer_id, @staff_id, @crop, @weight_kg, @moisture_pct, @price_per_kg, @asset_value, @loan_cap, @loan_disbursed, @status, @created_at)
  `
    )
    .run(row);

  let stageAdvanced = false;
  let nextStatus = await farmerStatus(db, farmer);
  if (accepted && currentIndex === HARVEST_INDEX) {
    nextStatus = await logStage(db, farmer, { channel: "warehouse" });
    stageAdvanced = true;
  }

  const receipt = (await listReceiptsForFarmer(db, farmer.id)).find((item) => item.id === row.id);
  return {
    receipt,
    stageAdvanced,
    farmer: await withReceipts(db, nextStatus),
  };
}
