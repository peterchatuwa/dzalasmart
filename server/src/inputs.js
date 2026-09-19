import { randomBytes } from "node:crypto";

function generateId(prefix = "inp") {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export const INPUT_CATEGORIES = {
  SEED: "seed",
  FERTILIZER: "fertilizer",
  PESTICIDE: "pesticide",
  HERBICIDE: "herbicide",
  TOOL: "tool",
  OTHER: "other",
};

export const INPUT_UNITS = {
  KG: "kg",
  LITER: "liter",
  BAG: "bag",
  PIECE: "piece",
};

/**
 * List all active inputs, optionally filtered by category
 */
export async function listInputs(db, options = {}) {
  const category = options.category || null;
  const includeInactive = options.includeInactive || false;

  let query = "SELECT * FROM inputs WHERE 1=1";
  const params = [];

  if (category) {
    query += " AND category = ?";
    params.push(category);
  }

  if (!includeInactive) {
    query += " AND active = 1";
  }

  query += " ORDER BY category, name";

  const rows = await db.prepare(query).all(...params);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    standardPrice: row.standard_price,
    supplier: row.supplier || null,
    description: row.description || null,
    active: row.active === 1,
    createdAt: row.created_at,
  }));
}

/**
 * Get input by ID
 */
export async function getInputById(db, inputId) {
  const row = await db.prepare("SELECT * FROM inputs WHERE id = ?").get(inputId);

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    standardPrice: row.standard_price,
    supplier: row.supplier || null,
    description: row.description || null,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

/**
 * Create a new input (staff only)
 */
export async function createInput(db, data = {}) {
  const name = String(data.name || "").trim();
  if (!name) throw new Error("Input name is required");

  const category = String(data.category || "").toLowerCase();
  if (!Object.values(INPUT_CATEGORIES).includes(category)) {
    throw new Error(`Invalid category. Must be one of: ${Object.values(INPUT_CATEGORIES).join(", ")}`);
  }

  const unit = String(data.unit || "").toLowerCase();
  if (!Object.values(INPUT_UNITS).includes(unit)) {
    throw new Error(`Invalid unit. Must be one of: ${Object.values(INPUT_UNITS).join(", ")}`);
  }

  const standardPrice = Number(data.standardPrice);
  if (!standardPrice || standardPrice <= 0) {
    throw new Error("Standard price must be a positive number");
  }

  const id = generateId("inp");
  const supplier = String(data.supplier || "").trim() || null;
  const description = String(data.description || "").trim() || null;
  const createdAt = Date.now();

  await db
    .prepare(
      `INSERT INTO inputs (id, name, category, unit, standard_price, supplier, description, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
    )
    .run(id, name, category, unit, standardPrice, supplier, description, createdAt);

  return getInputById(db, id);
}

/**
 * Update an existing input (staff only)
 */
export async function updateInput(db, inputId, data = {}) {
  const existing = await getInputById(db, inputId);
  if (!existing) throw new Error("Input not found");

  const updates = [];
  const params = [];

  if (data.name !== undefined) {
    const name = String(data.name).trim();
    if (!name) throw new Error("Input name cannot be empty");
    updates.push("name = ?");
    params.push(name);
  }

  if (data.category !== undefined) {
    const category = String(data.category).toLowerCase();
    if (!Object.values(INPUT_CATEGORIES).includes(category)) {
      throw new Error(`Invalid category. Must be one of: ${Object.values(INPUT_CATEGORIES).join(", ")}`);
    }
    updates.push("category = ?");
    params.push(category);
  }

  if (data.unit !== undefined) {
    const unit = String(data.unit).toLowerCase();
    if (!Object.values(INPUT_UNITS).includes(unit)) {
      throw new Error(`Invalid unit. Must be one of: ${Object.values(INPUT_UNITS).join(", ")}`);
    }
    updates.push("unit = ?");
    params.push(unit);
  }

  if (data.standardPrice !== undefined) {
    const standardPrice = Number(data.standardPrice);
    if (!standardPrice || standardPrice <= 0) {
      throw new Error("Standard price must be a positive number");
    }
    updates.push("standard_price = ?");
    params.push(standardPrice);
  }

  if (data.supplier !== undefined) {
    updates.push("supplier = ?");
    params.push(String(data.supplier).trim() || null);
  }

  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(String(data.description).trim() || null);
  }

  if (data.active !== undefined) {
    updates.push("active = ?");
    params.push(data.active ? 1 : 0);
  }

  if (updates.length === 0) {
    return existing;
  }

  params.push(inputId);
  const query = `UPDATE inputs SET ${updates.join(", ")} WHERE id = ?`;
  await db.prepare(query).run(...params);

  return getInputById(db, inputId);
}

/**
 * Deactivate an input (soft delete)
 */
export async function deactivateInput(db, inputId) {
  const existing = await getInputById(db, inputId);
  if (!existing) throw new Error("Input not found");

  await db.prepare("UPDATE inputs SET active = 0 WHERE id = ?").run(inputId);

  return { ...existing, active: false };
}

/**
 * Seed initial input catalog if empty
 */
export async function seedInputsIfEmpty(db) {
  const count = await db.prepare("SELECT COUNT(*) as count FROM inputs").get();

  if (count.count > 0) return false;

  const now = Date.now();

  const seedInputs = [
    // Seeds
    { id: "inp_maize_hybrid", name: "Maize Hybrid Seed (SC627)", category: "seed", unit: "kg", price: 2500 },
    { id: "inp_maize_opv", name: "Maize OPV Seed (ZM523)", category: "seed", unit: "kg", price: 1800 },
    { id: "inp_groundnut", name: "Groundnut Seed (CG7)", category: "seed", unit: "kg", price: 1200 },
    { id: "inp_soybean", name: "Soybean Seed (Tikolore)", category: "seed", unit: "kg", price: 1500 },
    { id: "inp_beans", name: "Bean Seed (Sugar 131)", category: "seed", unit: "kg", price: 1000 },

    // Fertilizers
    { id: "inp_npk", name: "NPK 23:21:0+4S Fertilizer", category: "fertilizer", unit: "bag", price: 32000 },
    { id: "inp_urea", name: "Urea 46% N Fertilizer", category: "fertilizer", unit: "bag", price: 35000 },
    { id: "inp_dap", name: "DAP 18:46:0 Fertilizer", category: "fertilizer", unit: "bag", price: 38000 },
    { id: "inp_can", name: "CAN 27% N Fertilizer", category: "fertilizer", unit: "bag", price: 28000 },
    { id: "inp_manure", name: "Organic Compost (50kg bag)", category: "fertilizer", unit: "bag", price: 5000 },

    // Pesticides
    { id: "inp_cypermethrin", name: "Cypermethrin 10% EC (Armyworm)", category: "pesticide", unit: "liter", price: 8500 },
    { id: "inp_lambda", name: "Lambda-cyhalothrin 5% EC", category: "pesticide", unit: "liter", price: 9200 },
    { id: "inp_chlorpyrifos", name: "Chlorpyrifos 48% EC (Termite)", category: "pesticide", unit: "liter", price: 7800 },

    // Herbicides
    { id: "inp_glyphosate", name: "Glyphosate 480 SL", category: "herbicide", unit: "liter", price: 6500 },
    { id: "inp_atrazine", name: "Atrazine 500 SC", category: "herbicide", unit: "liter", price: 5800 },

    // Tools
    { id: "inp_hoe", name: "Farming Hoe", category: "tool", unit: "piece", price: 3500 },
    { id: "inp_sprayer", name: "Knapsack Sprayer 16L", category: "tool", unit: "piece", price: 25000 },
  ];

  for (const input of seedInputs) {
    await db
      .prepare(
        `INSERT INTO inputs (id, name, category, unit, standard_price, supplier, description, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
      )
      .run(input.id, input.name, input.category, input.unit, input.price, null, null, now);
  }

  return true;
}
