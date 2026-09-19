import { randomBytes } from "node:crypto";
import { getInputById } from "./inputs.js";
import { getFarmerById } from "./farmers.js";

function generateId(prefix = "vch") {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

/**
 * Generate a human-readable voucher code
 * Format: FISP-2024-ABCD1234
 */
function generateVoucherCode(season) {
  const year = season || new Date().getFullYear();
  const suffix = randomBytes(4)
    .toString("hex")
    .toUpperCase()
    .slice(0, 8);
  return `FISP-${year}-${suffix}`;
}

export const VOUCHER_STATUS = {
  ACTIVE: "active",
  REDEEMED: "redeemed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

/**
 * Issue a new voucher to a farmer
 */
export async function issueVoucher(db, staff, data = {}) {
  const farmerId = String(data.farmerId || "").trim();
  if (!farmerId) throw new Error("Farmer ID is required");

  const farmer = await getFarmerById(db, farmerId);
  if (!farmer) throw new Error("Farmer not found");

  const season = String(data.season || "").trim() || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;

  const inputs = Array.isArray(data.inputs) ? data.inputs : [];
  if (inputs.length === 0) {
    throw new Error("At least one input is required");
  }

  // Validate inputs
  const voucherInputs = [];
  for (const item of inputs) {
    const input = await getInputById(db, item.inputId);
    if (!input) throw new Error(`Input ${item.inputId} not found`);

    const quantity = Number(item.quantity);
    if (!quantity || quantity <= 0) {
      throw new Error(`Invalid quantity for ${input.name}`);
    }

    const subsidyRate = Number(item.subsidyRate);
    if (subsidyRate < 0 || subsidyRate > 1) {
      throw new Error("Subsidy rate must be between 0 and 1");
    }

    const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : input.standardPrice;
    if (unitPrice <= 0) {
      throw new Error(`Invalid unit price for ${input.name}`);
    }

    const farmerContribution = Math.round(unitPrice * quantity * (1 - subsidyRate));

    voucherInputs.push({
      id: generateId("vin"),
      input,
      quantity,
      unitPrice,
      subsidyRate,
      farmerContribution,
    });
  }

  // Create voucher
  const voucherId = generateId("vch");
  const code = generateVoucherCode(season.split("/")[0]);
  const issuedAt = Date.now();

  // Expires in 6 months by default
  const expiresAt = data.expiresAt || issuedAt + 6 * 30 * 24 * 60 * 60 * 1000;

  await db
    .prepare(
      `INSERT INTO farmer_vouchers (id, code, farmer_id, issued_by, season, status, issued_at, expires_at, redeemed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    )
    .run(voucherId, code, farmerId, staff.id, season, VOUCHER_STATUS.ACTIVE, issuedAt, expiresAt);

  // Add voucher inputs
  for (const item of voucherInputs) {
    await db
      .prepare(
        `INSERT INTO voucher_inputs (id, voucher_id, input_id, quantity, unit_price, subsidy_rate, farmer_contribution)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(item.id, voucherId, item.input.id, item.quantity, item.unitPrice, item.subsidyRate, item.farmerContribution);
  }

  return getVoucherById(db, voucherId);
}

/**
 * Get voucher by ID with full details
 */
export async function getVoucherById(db, voucherId) {
  const voucher = await db.prepare("SELECT * FROM farmer_vouchers WHERE id = ?").get(voucherId);

  if (!voucher) return null;

  // Get voucher inputs
  const inputRows = await db
    .prepare(
      `SELECT vi.*, i.name as input_name, i.category as input_category, i.unit as input_unit
       FROM voucher_inputs vi
       JOIN inputs i ON vi.input_id = i.id
       WHERE vi.voucher_id = ?`
    )
    .all(voucherId);

  const inputs = inputRows.map((row) => ({
    id: row.id,
    inputId: row.input_id,
    inputName: row.input_name,
    inputCategory: row.input_category,
    inputUnit: row.input_unit,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    subsidyRate: row.subsidy_rate,
    farmerContribution: row.farmer_contribution,
  }));

  const totalValue = inputs.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalFarmerContribution = inputs.reduce((sum, item) => sum + item.farmerContribution, 0);
  const totalSubsidy = totalValue - totalFarmerContribution;

  return {
    id: voucher.id,
    code: voucher.code,
    farmerId: voucher.farmer_id,
    issuedBy: voucher.issued_by,
    season: voucher.season,
    status: voucher.status,
    issuedAt: voucher.issued_at,
    expiresAt: voucher.expires_at,
    redeemedAt: voucher.redeemed_at || null,
    inputs,
    summary: {
      totalValue,
      totalFarmerContribution,
      totalSubsidy,
      subsidyPercentage: totalValue > 0 ? (totalSubsidy / totalValue) * 100 : 0,
    },
  };
}

/**
 * Get voucher by code
 */
export async function getVoucherByCode(db, code) {
  const voucher = await db.prepare("SELECT * FROM farmer_vouchers WHERE code = ?").get(code);

  if (!voucher) return null;

  return getVoucherById(db, voucher.id);
}

/**
 * List vouchers for a farmer
 */
export async function listFarmerVouchers(db, farmerId, options = {}) {
  const status = options.status || null;
  const season = options.season || null;

  let query = "SELECT * FROM farmer_vouchers WHERE farmer_id = ?";
  const params = [farmerId];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  if (season) {
    query += " AND season = ?";
    params.push(season);
  }

  query += " ORDER BY issued_at DESC";

  const rows = await db.prepare(query).all(...params);

  const vouchers = [];
  for (const row of rows) {
    vouchers.push(await getVoucherById(db, row.id));
  }

  return vouchers;
}

/**
 * List all vouchers (staff view)
 */
export async function listAllVouchers(db, options = {}) {
  const status = options.status || null;
  const season = options.season || null;
  const district = options.district || null;

  let query = `SELECT fv.* 
               FROM farmer_vouchers fv
               JOIN farmers f ON fv.farmer_id = f.id
               WHERE 1=1`;
  const params = [];

  if (status) {
    query += " AND fv.status = ?";
    params.push(status);
  }

  if (season) {
    query += " AND fv.season = ?";
    params.push(season);
  }

  if (district) {
    query += " AND f.district = ?";
    params.push(district);
  }

  query += " ORDER BY fv.issued_at DESC LIMIT 100";

  const rows = await db.prepare(query).all(...params);

  const vouchers = [];
  for (const row of rows) {
    vouchers.push(await getVoucherById(db, row.id));
  }

  return vouchers;
}

/**
 * Redeem a voucher
 */
export async function redeemVoucher(db, data = {}) {
  const voucherCode = String(data.voucherCode || "").trim().toUpperCase();
  if (!voucherCode) throw new Error("Voucher code is required");

  const voucher = await getVoucherByCode(db, voucherCode);
  if (!voucher) throw new Error("Voucher not found");

  if (voucher.status === VOUCHER_STATUS.REDEEMED) {
    throw new Error("This voucher has already been redeemed");
  }

  if (voucher.status === VOUCHER_STATUS.EXPIRED) {
    throw new Error("This voucher has expired");
  }

  if (voucher.status === VOUCHER_STATUS.CANCELLED) {
    throw new Error("This voucher has been cancelled");
  }

  if (Date.now() > voucher.expiresAt) {
    await db.prepare("UPDATE farmer_vouchers SET status = ? WHERE id = ?").run(VOUCHER_STATUS.EXPIRED, voucher.id);
    throw new Error("This voucher has expired");
  }

  const agroDealer = String(data.agroDealer || "").trim();
  if (!agroDealer) throw new Error("Agro-dealer name is required");

  const location = String(data.location || "").trim();
  if (!location) throw new Error("Redemption location is required");

  const district = String(data.district || "").trim() || "Unknown";

  const staffId = data.staffId || null;
  const notes = String(data.notes || "").trim() || null;

  const redemptionInputs = Array.isArray(data.inputs) ? data.inputs : [];
  if (redemptionInputs.length === 0) {
    throw new Error("At least one input must be issued");
  }

  // Validate redemption inputs match voucher
  for (const item of redemptionInputs) {
    const voucherInput = voucher.inputs.find((vi) => vi.inputId === item.inputId);
    if (!voucherInput) {
      throw new Error(`Input ${item.inputId} is not part of this voucher`);
    }

    const quantityIssued = Number(item.quantityIssued);
    if (!quantityIssued || quantityIssued <= 0 || quantityIssued > voucherInput.quantity) {
      throw new Error(
        `Invalid quantity for ${voucherInput.inputName}. Must be between 0 and ${voucherInput.quantity}`
      );
    }
  }

  // Create redemption record
  const redemptionId = generateId("red");
  const redeemedAt = Date.now();

  await db
    .prepare(
      `INSERT INTO input_redemptions (id, voucher_id, farmer_id, agro_dealer, location, district, staff_id, redeemed_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(redemptionId, voucher.id, voucher.farmerId, agroDealer, location, district, staffId, redeemedAt, notes);

  // Add redemption inputs
  for (const item of redemptionInputs) {
    await db
      .prepare(
        `INSERT INTO redemption_inputs (id, redemption_id, input_id, quantity_issued, batch_number, expiry_date)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        generateId("rin"),
        redemptionId,
        item.inputId,
        item.quantityIssued,
        item.batchNumber || null,
        item.expiryDate || null
      );
  }

  // Update voucher status
  await db
    .prepare("UPDATE farmer_vouchers SET status = ?, redeemed_at = ? WHERE id = ?")
    .run(VOUCHER_STATUS.REDEEMED, redeemedAt, voucher.id);

  return getRedemptionById(db, redemptionId);
}

/**
 * Get redemption by ID
 */
export async function getRedemptionById(db, redemptionId) {
  const redemption = await db.prepare("SELECT * FROM input_redemptions WHERE id = ?").get(redemptionId);

  if (!redemption) return null;

  const inputRows = await db
    .prepare(
      `SELECT ri.*, i.name as input_name, i.category as input_category, i.unit as input_unit
       FROM redemption_inputs ri
       JOIN inputs i ON ri.input_id = i.id
       WHERE ri.redemption_id = ?`
    )
    .all(redemptionId);

  const inputs = inputRows.map((row) => ({
    id: row.id,
    inputId: row.input_id,
    inputName: row.input_name,
    inputCategory: row.input_category,
    inputUnit: row.input_unit,
    quantityIssued: row.quantity_issued,
    batchNumber: row.batch_number || null,
    expiryDate: row.expiry_date || null,
  }));

  return {
    id: redemption.id,
    voucherId: redemption.voucher_id,
    farmerId: redemption.farmer_id,
    agroDealer: redemption.agro_dealer,
    location: redemption.location,
    district: redemption.district,
    staffId: redemption.staff_id || null,
    redeemedAt: redemption.redeemed_at,
    notes: redemption.notes || null,
    inputs,
  };
}

/**
 * List redemptions for a farmer
 */
export async function listFarmerRedemptions(db, farmerId) {
  const rows = await db
    .prepare("SELECT id FROM input_redemptions WHERE farmer_id = ? ORDER BY redeemed_at DESC")
    .all(farmerId);

  const redemptions = [];
  for (const row of rows) {
    redemptions.push(await getRedemptionById(db, row.id));
  }

  return redemptions;
}

/**
 * List all redemptions (staff view)
 */
export async function listAllRedemptions(db, options = {}) {
  const district = options.district || null;
  const limit = options.limit || 100;

  let query = "SELECT id FROM input_redemptions WHERE 1=1";
  const params = [];

  if (district) {
    query += " AND district = ?";
    params.push(district);
  }

  query += " ORDER BY redeemed_at DESC LIMIT ?";
  params.push(limit);

  const rows = await db.prepare(query).all(...params);

  const redemptions = [];
  for (const row of rows) {
    redemptions.push(await getRedemptionById(db, row.id));
  }

  return redemptions;
}

/**
 * Cancel a voucher (staff only)
 */
export async function cancelVoucher(db, voucherId, reason = null) {
  const voucher = await getVoucherById(db, voucherId);
  if (!voucher) throw new Error("Voucher not found");

  if (voucher.status === VOUCHER_STATUS.REDEEMED) {
    throw new Error("Cannot cancel a redeemed voucher");
  }

  await db.prepare("UPDATE farmer_vouchers SET status = ? WHERE id = ?").run(VOUCHER_STATUS.CANCELLED, voucherId);

  return { ...voucher, status: VOUCHER_STATUS.CANCELLED };
}

/**
 * Get voucher statistics
 */
export async function getVoucherStats(db, options = {}) {
  const district = options.district || null;
  const season = options.season || null;

  let whereClause = "WHERE 1=1";
  const params = [];

  if (season) {
    whereClause += " AND fv.season = ?";
    params.push(season);
  }

  if (district) {
    whereClause += " AND f.district = ?";
    params.push(district);
  }

  const stats = await db
    .prepare(
      `SELECT 
         COUNT(*) as total_vouchers,
         SUM(CASE WHEN fv.status = 'active' THEN 1 ELSE 0 END) as active_vouchers,
         SUM(CASE WHEN fv.status = 'redeemed' THEN 1 ELSE 0 END) as redeemed_vouchers,
         SUM(CASE WHEN fv.status = 'expired' THEN 1 ELSE 0 END) as expired_vouchers,
         SUM(CASE WHEN fv.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_vouchers
       FROM farmer_vouchers fv
       JOIN farmers f ON fv.farmer_id = f.id
       ${whereClause}`
    )
    .get(...params);

  return {
    totalVouchers: stats.total_vouchers || 0,
    activeVouchers: stats.active_vouchers || 0,
    redeemedVouchers: stats.redeemed_vouchers || 0,
    expiredVouchers: stats.expired_vouchers || 0,
    cancelledVouchers: stats.cancelled_vouchers || 0,
    redemptionRate:
      stats.total_vouchers > 0 ? ((stats.redeemed_vouchers / stats.total_vouchers) * 100).toFixed(1) : 0,
  };
}

/**
 * Seed demo vouchers
 */
export async function seedVouchersIfEmpty(db) {
  const count = await db.prepare("SELECT COUNT(*) as count FROM farmer_vouchers").get();

  if (count.count > 0) return false;

  // Get first staff member (cooperative officer)
  const staff = await db.prepare("SELECT * FROM staff WHERE role = 'cooperative' LIMIT 1").get();
  if (!staff) return false;

  // Get demo farmers
  const farmers = await db.prepare("SELECT * FROM farmers LIMIT 3").all();
  if (farmers.length === 0) return false;

  const season = "2024/25";
  const now = Date.now();
  const expiresAt = now + 6 * 30 * 24 * 60 * 60 * 1000;

  // Issue vouchers to first two farmers
  for (let i = 0; i < 2; i++) {
    const farmer = farmers[i];
    const voucherId = generateId("vch");
    const code = generateVoucherCode("2024");

    await db
      .prepare(
        `INSERT INTO farmer_vouchers (id, code, farmer_id, issued_by, season, status, issued_at, expires_at, redeemed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      )
      .run(
        voucherId,
        code,
        farmer.id,
        staff.id,
        season,
        i === 0 ? VOUCHER_STATUS.REDEEMED : VOUCHER_STATUS.ACTIVE,
        now,
        expiresAt
      );

    // Add inputs to voucher (typical maize package)
    const inputs = [
      { id: "inp_maize_hybrid", quantity: 10, unitPrice: 2500, subsidy: 0.7 }, // 10kg maize seed, 70% subsidy
      { id: "inp_npk", quantity: 2, unitPrice: 32000, subsidy: 0.5 }, // 2 bags NPK, 50% subsidy
      { id: "inp_urea", quantity: 1, unitPrice: 35000, subsidy: 0.5 }, // 1 bag Urea, 50% subsidy
    ];

    for (const input of inputs) {
      const farmerContribution = Math.round(input.unitPrice * input.quantity * (1 - input.subsidy));
      await db
        .prepare(
          `INSERT INTO voucher_inputs (id, voucher_id, input_id, quantity, unit_price, subsidy_rate, farmer_contribution)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(generateId("vin"), voucherId, input.id, input.quantity, input.unitPrice, input.subsidy, farmerContribution);
    }

    // Create redemption for first farmer
    if (i === 0) {
      const redemptionId = generateId("red");
      await db
        .prepare(
          `INSERT INTO input_redemptions (id, voucher_id, farmer_id, agro_dealer, location, district, staff_id, redeemed_at, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          redemptionId,
          voucherId,
          farmer.id,
          "Lilongwe Agro Supplies",
          "Lilongwe Market",
          farmer.district,
          staff.id,
          now,
          "Demo redemption - FISP 2024/25"
        );

      // Add redeemed inputs
      for (const input of inputs) {
        await db
          .prepare(
            `INSERT INTO redemption_inputs (id, redemption_id, input_id, quantity_issued, batch_number, expiry_date)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(generateId("rin"), redemptionId, input.id, input.quantity, null, null);
      }

      await db
        .prepare("UPDATE farmer_vouchers SET redeemed_at = ? WHERE id = ?")
        .run(now, voucherId);
    }
  }

  return true;
}
