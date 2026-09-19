import { HttpError } from "./util.js";

/**
 * Input Suppliers Module
 * Handles voucher redemption from the supplier's perspective
 */

export async function getSupplierRedemptions(db, supplierId, filters = {}) {
  const { district, startDate, endDate, limit = 100 } = filters;
  const now = Date.now();
  const start = startDate || now - 30 * 24 * 60 * 60 * 1000; // Default: last 30 days
  const end = endDate || now;

  let query = `
    SELECT 
      ir.id,
      ir.redeemed_at,
      ir.location,
      ir.district,
      ir.notes,
      fv.code as voucher_code,
      fv.season,
      f.name as farmer_name,
      f.phone as farmer_phone,
      f.district as farmer_district,
      s.name as staff_name,
      json_group_array(
        json_object(
          'input_id', ri.input_id,
          'input_name', i.name,
          'category', i.category,
          'quantity_issued', ri.quantity_issued,
          'unit', i.unit,
          'batch_number', ri.batch_number,
          'expiry_date', ri.expiry_date
        )
      ) as inputs
    FROM input_redemptions ir
    JOIN farmer_vouchers fv ON ir.voucher_id = fv.id
    JOIN farmers f ON ir.farmer_id = f.id
    LEFT JOIN staff s ON ir.staff_id = s.id
    LEFT JOIN redemption_inputs ri ON ir.id = ri.redemption_id
    LEFT JOIN inputs i ON ri.input_id = i.id
    WHERE ir.redeemed_at >= ? AND ir.redeemed_at <= ?
  `;

  const params = [start, end];

  if (district) {
    query += " AND ir.district = ?";
    params.push(district);
  }

  query += " GROUP BY ir.id ORDER BY ir.redeemed_at DESC LIMIT ?";
  params.push(limit);

  const redemptions = await db.prepare(query).all(...params);

  return redemptions.map((r) => ({
    ...r,
    inputs: JSON.parse(r.inputs || "[]"),
  }));
}

export async function getSupplierStats(db, filters = {}) {
  const { district, startDate, endDate } = filters;
  const now = Date.now();
  const start = startDate || now - 30 * 24 * 60 * 60 * 1000;
  const end = endDate || now;

  let query = `
    SELECT 
      COUNT(DISTINCT ir.id) as total_redemptions,
      COUNT(DISTINCT ir.farmer_id) as unique_farmers,
      ir.district,
      json_group_array(DISTINCT i.category) as categories
    FROM input_redemptions ir
    LEFT JOIN redemption_inputs ri ON ir.id = ri.redemption_id
    LEFT JOIN inputs i ON ri.input_id = i.id
    WHERE ir.redeemed_at >= ? AND ir.redeemed_at <= ?
  `;

  const params = [start, end];

  if (district) {
    query += " AND ir.district = ?";
    params.push(district);
  }

  query += " GROUP BY ir.district";

  const stats = await db.prepare(query).all(...params);

  // Get input-level breakdown
  let inputQuery = `
    SELECT 
      i.id,
      i.name,
      i.category,
      i.unit,
      SUM(ri.quantity_issued) as total_quantity,
      COUNT(DISTINCT ir.id) as redemption_count
    FROM redemption_inputs ri
    JOIN inputs i ON ri.input_id = i.id
    JOIN input_redemptions ir ON ri.redemption_id = ir.id
    WHERE ir.redeemed_at >= ? AND ir.redeemed_at <= ?
  `;

  const inputParams = [start, end];

  if (district) {
    inputQuery += " AND ir.district = ?";
    inputParams.push(district);
  }

  inputQuery += " GROUP BY i.id ORDER BY total_quantity DESC";

  const inputBreakdown = await db.prepare(inputQuery).all(...inputParams);

  return {
    period: {
      start,
      end,
      days: Math.floor((end - start) / (24 * 60 * 60 * 1000)),
    },
    district: district || "All Districts",
    summary: stats.map((s) => ({
      ...s,
      categories: JSON.parse(s.categories || "[]").filter(Boolean),
    })),
    inputBreakdown,
    totalRedemptions: stats.reduce((sum, s) => sum + s.total_redemptions, 0),
    uniqueFarmers: stats.reduce((sum, s) => sum + s.unique_farmers, 0),
  };
}

export async function recordSupplierInventory(db, supplierId, input) {
  // This is a placeholder for future inventory management
  // For now, we'll just validate and return success
  const inputId = String(input.inputId || "").trim();
  const quantity = Number(input.quantity);
  const batchNumber = String(input.batchNumber || "").trim();

  if (!inputId) {
    throw HttpError(400, "Input ID is required");
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw HttpError(400, "Quantity must be a positive number");
  }

  // Verify input exists
  const inputExists = await db.prepare("SELECT id FROM inputs WHERE id = ?").get(inputId);
  if (!inputExists) {
    throw HttpError(404, "Input not found");
  }

  // In a full implementation, this would update an inventory table
  // For now, just return success
  return {
    success: true,
    message: "Inventory recorded successfully",
    inputId,
    quantity,
    batchNumber,
  };
}
