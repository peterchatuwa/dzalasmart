import crypto from "crypto";
import { HttpError } from "./util.js";

/**
 * Buyers & Off-takers Module
 * Manages buyer accounts and their contract views
 */

export async function listBuyers(db, filters = {}) {
  const { district, status = "active" } = filters;

  let query = "SELECT * FROM buyers WHERE 1=1";
  const params = [];

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

export async function getBuyerById(db, id) {
  return await db.prepare("SELECT * FROM buyers WHERE id = ?").get(id);
}

export async function getBuyerByStaffId(db, staffId) {
  return await db.prepare("SELECT * FROM buyers WHERE staff_id = ?").get(staffId);
}

export async function createBuyer(db, creator, input) {
  const name = String(input.name || "").trim();
  const org = String(input.org || "").trim();
  const phone = String(input.phone || "").trim() || null;
  const email = String(input.email || "").trim() || null;
  const district = String(input.district || "").trim() || null;
  const commodities = String(input.commodities || "").trim() || null;
  const creditLimit = input.creditLimit ? Number(input.creditLimit) : 0;
  const staffId = String(input.staffId || "").trim() || null;

  if (!name || name.length < 2) {
    throw HttpError(400, "Buyer name is required");
  }
  if (!org || org.length < 2) {
    throw HttpError(400, "Organization is required");
  }

  // If linking to staff account, verify it exists and has buyer role
  if (staffId) {
    const staff = await db.prepare("SELECT * FROM staff WHERE id = ?").get(staffId);
    if (!staff) {
      throw HttpError(404, "Staff account not found");
    }
    if (staff.role !== "buyer") {
      throw HttpError(400, "Staff account must have buyer role");
    }
    // Check if already linked
    const existing = await db.prepare("SELECT id FROM buyers WHERE staff_id = ?").get(staffId);
    if (existing) {
      throw HttpError(409, "This staff account is already linked to a buyer");
    }
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(
      "INSERT INTO buyers (id, staff_id, name, org, phone, email, district, commodities, credit_limit, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(id, staffId, name, org, phone, email, district, commodities, creditLimit, "active", now);

  return await getBuyerById(db, id);
}

export async function updateBuyer(db, id, input) {
  const buyer = await getBuyerById(db, id);
  if (!buyer) {
    throw HttpError(404, "Buyer not found");
  }

  const updates = [];
  const params = [];

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (name.length < 2) throw HttpError(400, "Name must be at least 2 characters");
    updates.push("name = ?");
    params.push(name);
  }

  if (input.org !== undefined) {
    const org = String(input.org).trim();
    if (org.length < 2) throw HttpError(400, "Organization must be at least 2 characters");
    updates.push("org = ?");
    params.push(org);
  }

  if (input.phone !== undefined) {
    updates.push("phone = ?");
    params.push(String(input.phone).trim() || null);
  }

  if (input.email !== undefined) {
    updates.push("email = ?");
    params.push(String(input.email).trim() || null);
  }

  if (input.creditLimit !== undefined) {
    const limit = Number(input.creditLimit);
    if (!Number.isInteger(limit) || limit < 0) throw HttpError(400, "Credit limit must be a non-negative integer");
    updates.push("credit_limit = ?");
    params.push(limit);
  }

  if (input.status !== undefined) {
    const status = String(input.status).trim();
    if (!["active", "suspended", "inactive"].includes(status)) {
      throw HttpError(400, "Invalid status");
    }
    updates.push("status = ?");
    params.push(status);
  }

  if (updates.length === 0) {
    return buyer;
  }

  params.push(id);
  await db.prepare(`UPDATE buyers SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  return await getBuyerById(db, id);
}

export async function getBuyerContracts(db, buyerId, filters = {}) {
  const { status, crop, district, limit = 100 } = filters;

  let query = `
    SELECT * FROM offtake_contracts
    WHERE buyer_id = ?
  `;

  const params = [buyerId];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  if (crop) {
    query += " AND crop = ?";
    params.push(crop);
  }

  if (district) {
    query += " AND district = ?";
    params.push(district);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  return await db.prepare(query).all(...params);
}

export async function getBuyerDashboard(db, buyerId) {
  const buyer = await getBuyerById(db, buyerId);
  if (!buyer) {
    throw HttpError(404, "Buyer not found");
  }

  // Get all contracts
  const contracts = await db.prepare("SELECT * FROM offtake_contracts WHERE buyer_id = ?").all(buyerId);

  // Calculate stats
  const totalContracts = contracts.length;
  const active = contracts.filter((c) => c.status === "cleared").length;
  const blocked = contracts.filter((c) => c.status === "blocked").length;

  const totalValue = contracts.reduce((sum, c) => sum + c.price_per_kg * c.weight_kg, 0);
  const totalWeight = contracts.reduce((sum, c) => sum + c.weight_kg, 0);

  // Group by commodity
  const byCommodity = {};
  contracts.forEach((contract) => {
    if (!byCommodity[contract.crop]) {
      byCommodity[contract.crop] = {
        crop: contract.crop,
        count: 0,
        totalWeight: 0,
        totalValue: 0,
      };
    }
    byCommodity[contract.crop].count += 1;
    byCommodity[contract.crop].totalWeight += contract.weight_kg;
    byCommodity[contract.crop].totalValue += contract.price_per_kg * contract.weight_kg;
  });

  return {
    buyer,
    summary: {
      totalContracts,
      active,
      blocked,
      totalValue,
      totalWeight,
      avgPrice: totalWeight > 0 ? Math.round(totalValue / totalWeight) : 0,
    },
    byCommodity: Object.values(byCommodity),
    recentContracts: contracts.slice(0, 10),
  };
}
