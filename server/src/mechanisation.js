import crypto from "crypto";
import { HttpError } from "./util.js";

/**
 * Mechanisation Suppliers Module
 * Handles equipment inventory and booking management
 */

export const EQUIPMENT_TYPES = ["tractor", "planter", "harvester", "sprayer", "thresher", "ridger", "plough"];

export async function listEquipment(db, filters = {}) {
  const { type, district, status = "available" } = filters;

  let query = "SELECT * FROM equipment WHERE 1=1";
  const params = [];

  if (type) {
    query += " AND type = ?";
    params.push(type);
  }

  if (district) {
    query += " AND district = ?";
    params.push(district);
  }

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  query += " ORDER BY name ASC";

  return await db.prepare(query).all(...params);
}

export async function getEquipmentById(db, id) {
  return await db.prepare("SELECT * FROM equipment WHERE id = ?").get(id);
}

export async function createEquipment(db, supplier, input) {
  const name = String(input.name || "").trim();
  const type = String(input.type || "").trim();
  const capacity = String(input.capacity || "").trim();
  const ratePerDay = Number(input.ratePerDay);
  const ratePerHectare = input.ratePerHectare ? Number(input.ratePerHectare) : null;
  const district = String(input.district || "").trim() || null;

  if (!name || name.length < 2) {
    throw HttpError(400, "Equipment name is required");
  }
  if (!EQUIPMENT_TYPES.includes(type)) {
    throw HttpError(400, `Invalid equipment type. Must be one of: ${EQUIPMENT_TYPES.join(", ")}`);
  }
  if (!Number.isInteger(ratePerDay) || ratePerDay <= 0) {
    throw HttpError(400, "Rate per day must be a positive integer");
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(
      "INSERT INTO equipment (id, name, type, capacity, rate_per_day, rate_per_hectare, supplier_id, district, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(id, name, type, capacity, ratePerDay, ratePerHectare, supplier.id, district, "available", now);

  return await getEquipmentById(db, id);
}

export async function updateEquipment(db, id, input) {
  const equipment = await getEquipmentById(db, id);
  if (!equipment) {
    throw HttpError(404, "Equipment not found");
  }

  const updates = [];
  const params = [];

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (name.length < 2) throw HttpError(400, "Name must be at least 2 characters");
    updates.push("name = ?");
    params.push(name);
  }

  if (input.ratePerDay !== undefined) {
    const rate = Number(input.ratePerDay);
    if (!Number.isInteger(rate) || rate <= 0) throw HttpError(400, "Rate must be a positive integer");
    updates.push("rate_per_day = ?");
    params.push(rate);
  }

  if (input.ratePerHectare !== undefined) {
    updates.push("rate_per_hectare = ?");
    params.push(input.ratePerHectare ? Number(input.ratePerHectare) : null);
  }

  if (input.status !== undefined) {
    const status = String(input.status).trim();
    if (!["available", "maintenance", "retired"].includes(status)) {
      throw HttpError(400, "Invalid status");
    }
    updates.push("status = ?");
    params.push(status);
  }

  if (updates.length === 0) {
    return equipment;
  }

  params.push(id);
  await db.prepare(`UPDATE equipment SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  return await getEquipmentById(db, id);
}

export async function listBookings(db, filters = {}) {
  const { equipmentId, farmerId, status, district, limit = 100 } = filters;

  let query = `
    SELECT 
      eb.*,
      e.name as equipment_name,
      e.type as equipment_type,
      f.name as farmer_name,
      f.phone as farmer_phone,
      f.district as farmer_district
    FROM equipment_bookings eb
    JOIN equipment e ON eb.equipment_id = e.id
    JOIN farmers f ON eb.farmer_id = f.id
    WHERE 1=1
  `;

  const params = [];

  if (equipmentId) {
    query += " AND eb.equipment_id = ?";
    params.push(equipmentId);
  }

  if (farmerId) {
    query += " AND eb.farmer_id = ?";
    params.push(farmerId);
  }

  if (status) {
    query += " AND eb.status = ?";
    params.push(status);
  }

  if (district) {
    query += " AND f.district = ?";
    params.push(district);
  }

  query += " ORDER BY eb.start_date DESC LIMIT ?";
  params.push(limit);

  return await db.prepare(query).all(...params);
}

export async function createBooking(db, input) {
  const equipmentId = String(input.equipmentId || "").trim();
  const farmerId = String(input.farmerId || "").trim();
  const startDate = Number(input.startDate);
  const endDate = input.endDate ? Number(input.endDate) : null;
  const hectares = input.hectares ? Number(input.hectares) : null;

  if (!equipmentId) throw HttpError(400, "Equipment ID is required");
  if (!farmerId) throw HttpError(400, "Farmer ID is required");
  if (!Number.isInteger(startDate) || startDate <= Date.now()) {
    throw HttpError(400, "Start date must be in the future");
  }

  const equipment = await getEquipmentById(db, equipmentId);
  if (!equipment) throw HttpError(404, "Equipment not found");
  if (equipment.status !== "available") {
    throw HttpError(409, "Equipment is not available for booking");
  }

  // Check for conflicts
  const conflicts = await db
    .prepare(
      `SELECT id FROM equipment_bookings 
       WHERE equipment_id = ? 
       AND status IN ('pending', 'confirmed') 
       AND start_date <= ? 
       AND (end_date IS NULL OR end_date >= ?)`
    )
    .all(equipmentId, endDate || startDate + 7 * 24 * 60 * 60 * 1000, startDate);

  if (conflicts.length > 0) {
    throw HttpError(409, "Equipment is already booked for these dates");
  }

  // Calculate cost
  let totalCost = 0;
  if (hectares && equipment.rate_per_hectare) {
    totalCost = Math.round(hectares * equipment.rate_per_hectare);
  } else if (endDate) {
    const days = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
    totalCost = days * equipment.rate_per_day;
  } else {
    totalCost = equipment.rate_per_day;
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(
      "INSERT INTO equipment_bookings (id, equipment_id, farmer_id, booking_date, start_date, end_date, hectares, total_cost, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(id, equipmentId, farmerId, now, startDate, endDate, hectares, totalCost, "pending", now);

  return (await listBookings(db, { farmerId })).find((b) => b.id === id);
}

export async function confirmBooking(db, bookingId) {
  const booking = await db.prepare("SELECT * FROM equipment_bookings WHERE id = ?").get(bookingId);
  if (!booking) throw HttpError(404, "Booking not found");
  if (booking.status !== "pending") throw HttpError(409, "Booking is not pending");

  const now = Date.now();
  await db.prepare("UPDATE equipment_bookings SET status = ?, confirmed_at = ? WHERE id = ?").run("confirmed", now, bookingId);

  return (await listBookings(db, {})).find((b) => b.id === bookingId);
}

export async function completeBooking(db, bookingId) {
  const booking = await db.prepare("SELECT * FROM equipment_bookings WHERE id = ?").get(bookingId);
  if (!booking) throw HttpError(404, "Booking not found");
  if (booking.status !== "confirmed") throw HttpError(409, "Booking is not confirmed");

  const now = Date.now();
  await db.prepare("UPDATE equipment_bookings SET status = ?, completed_at = ? WHERE id = ?").run("completed", now, bookingId);

  return (await listBookings(db, {})).find((b) => b.id === bookingId);
}

export async function cancelBooking(db, bookingId) {
  const booking = await db.prepare("SELECT * FROM equipment_bookings WHERE id = ?").get(bookingId);
  if (!booking) throw HttpError(404, "Booking not found");
  if (booking.status === "completed") throw HttpError(409, "Cannot cancel completed booking");

  await db.prepare("UPDATE equipment_bookings SET status = ? WHERE id = ?").run("cancelled", bookingId);

  return (await listBookings(db, {})).find((b) => b.id === bookingId);
}

export async function getBookingStats(db, filters = {}) {
  const { district, supplierId } = filters;

  let query = `
    SELECT 
      COUNT(*) as total_bookings,
      SUM(CASE WHEN eb.status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN eb.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN eb.status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN eb.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(eb.total_cost) as total_revenue
    FROM equipment_bookings eb
    JOIN farmers f ON eb.farmer_id = f.id
    JOIN equipment e ON eb.equipment_id = e.id
    WHERE 1=1
  `;

  const params = [];

  if (district) {
    query += " AND f.district = ?";
    params.push(district);
  }

  if (supplierId) {
    query += " AND e.supplier_id = ?";
    params.push(supplierId);
  }

  return await db.prepare(query).get(...params);
}
