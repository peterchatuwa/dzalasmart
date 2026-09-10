import { hashPin, pinMatches, signStaffToken } from "./auth.js";
import { HttpError, assertPin, normalizePhone, publicStaff } from "./util.js";

const STAFF_ROLES = {
  extension: "Extension officer",
  cooperative: "Cooperative manager",
  ministry: "Ministry official",
  fum: "Farmers Union director",
};

export const DEMO_STAFF = [
  {
    name: "Mercy Chirwa",
    phone: "+265888000101",
    role: "extension",
    org: "Zidyana EPA",
    district: "Nkhotakota",
    epa: "Zidyana",
  },
  {
    name: "Joseph Phiri",
    phone: "+265888000102",
    role: "cooperative",
    org: "Kasungu Central Warehouse",
    district: "Kasungu",
    epa: "Kaluluma",
  },
  {
    name: "Chikondi Moyo",
    phone: "+265888000103",
    role: "ministry",
    org: "Ministry of Agriculture",
    district: "Lilongwe",
    epa: null,
  },
  {
    name: "Davis Mwale",
    phone: "+265888000104",
    role: "fum",
    org: "FUM National Office",
    district: "Lilongwe",
    epa: null,
  },
  {
    name: "Admin User",
    phone: "+265888000199",
    role: "system_admin",
    org: "System Administration",
    district: null,
    epa: null,
  },
  {
    name: "Sarah Banda",
    phone: "+265888000105",
    role: "ngo",
    org: "World Vision Malawi",
    district: null,
    epa: null,
  },
  {
    name: "Francis Kamoto",
    phone: "+265888000106",
    role: "input_supplier",
    org: "Smallholder Farmers Fertiliser Revolving Fund",
    district: null,
    epa: null,
  },
  {
    name: "Grace Tembo",
    phone: "+265888000107",
    role: "financial_institution",
    org: "National Bank of Malawi - Agri Finance",
    district: null,
    epa: null,
  },
  {
    name: "Patrick Lungu",
    phone: "+265888000108",
    role: "mechanisation_supplier",
    org: "Malawi Tractor Hire Services",
    district: null,
    epa: null,
  },
  {
    name: "Elizabeth Nyoni",
    phone: "+265888000109",
    role: "buyer",
    org: "Export Trading Group",
    district: null,
    epa: null,
  },
];

export function roleLabel(role) {
  return STAFF_ROLES[role] || role;
}

export async function loginStaff(db, input, jwtSecret) {
  const phone = normalizePhone(input.phone);
  const staff = await db.prepare("SELECT * FROM staff WHERE phone = ?").get(phone);
  if (!staff || !pinMatches(assertPin(input.pin), staff.pin_hash)) {
    throw HttpError(401, "Phone or PIN is incorrect");
  }
  return {
    token: signStaffToken(staff, jwtSecret),
    staff: publicStaff(staff),
  };
}

export async function seedStaffIfEmpty(db) {
  const insert = db.prepare(`
    INSERT INTO staff (id, name, phone, pin_hash, role, org, district, epa, created_at)
    VALUES (@id, @name, @phone, @pin_hash, @role, @org, @district, @epa, @created_at)
  `);
  let added = 0;
  for (const person of DEMO_STAFF) {
    const exists = await db.prepare("SELECT id FROM staff WHERE phone = ?").get(person.phone);
    if (exists) continue;
    await insert.run({
      id: crypto.randomUUID(),
      name: person.name,
      phone: person.phone,
      pin_hash: hashPin("1234"),
      role: person.role,
      org: person.org,
      district: person.district,
      epa: person.epa,
      created_at: Date.now(),
    });
    added += 1;
  }
  return added > 0;
}

export async function staffIdByRole(db, role) {
  return (await db.prepare("SELECT id FROM staff WHERE role = ?").get(role))?.id || null;
}

export const STAFF_ROLES = [
  "extension",
  "cooperative",
  "ministry",
  "fum",
  "system_admin",
  "ngo",
  "financial_institution",
  "input_supplier",
  "mechanisation_supplier",
  "buyer",
];

export async function listAllStaff(db, filters = {}) {
  let query = "SELECT * FROM staff";
  const conditions = [];
  const params = [];

  if (filters.role) {
    conditions.push("role = ?");
    params.push(filters.role);
  }

  if (filters.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  } else {
    // Default to active only
    conditions.push("status = ?");
    params.push("active");
  }

  if (filters.district) {
    conditions.push("district = ?");
    params.push(filters.district);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY created_at DESC";

  return await db.prepare(query).all(...params);
}

export async function getStaffById(db, id) {
  return await db.prepare("SELECT * FROM staff WHERE id = ?").get(id);
}

export async function createStaff(db, creator, input) {
  const name = String(input.name || "").trim();
  const phone = normalizePhone(input.phone);
  const role = String(input.role || "").trim();
  const org = String(input.org || "").trim();
  const district = String(input.district || "").trim() || null;
  const epa = String(input.epa || "").trim() || null;
  const pin = String(input.pin || "").trim();

  if (!name || name.length < 2) {
    throw HttpError(400, "Name is required");
  }
  if (!phone) {
    throw HttpError(400, "Valid phone number is required");
  }
  if (!STAFF_ROLES.includes(role)) {
    throw HttpError(400, `Invalid role. Must be one of: ${STAFF_ROLES.join(", ")}`);
  }
  if (!org || org.length < 2) {
    throw HttpError(400, "Organization is required");
  }
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    throw HttpError(400, "PIN must be exactly 4 digits");
  }

  // Check if phone already exists
  const existing = await db.prepare("SELECT id FROM staff WHERE phone = ?").get(phone);
  if (existing) {
    throw HttpError(409, "This phone number is already registered");
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(
      "INSERT INTO staff (id, name, phone, pin_hash, role, org, district, epa, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(id, name, phone, hashPin(pin), role, org, district, epa, "active", creator.id, now);

  return await getStaffById(db, id);
}

export async function updateStaff(db, id, input) {
  const staff = await getStaffById(db, id);
  if (!staff) {
    throw HttpError(404, "Staff member not found");
  }

  const updates = [];
  const params = [];

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (name.length < 2) throw HttpError(400, "Name must be at least 2 characters");
    updates.push("name = ?");
    params.push(name);
  }

  if (input.role !== undefined) {
    const role = String(input.role).trim();
    if (!STAFF_ROLES.includes(role)) {
      throw HttpError(400, `Invalid role. Must be one of: ${STAFF_ROLES.join(", ")}`);
    }
    updates.push("role = ?");
    params.push(role);
  }

  if (input.org !== undefined) {
    const org = String(input.org).trim();
    if (org.length < 2) throw HttpError(400, "Organization must be at least 2 characters");
    updates.push("org = ?");
    params.push(org);
  }

  if (input.district !== undefined) {
    updates.push("district = ?");
    params.push(String(input.district).trim() || null);
  }

  if (input.epa !== undefined) {
    updates.push("epa = ?");
    params.push(String(input.epa).trim() || null);
  }

  if (updates.length === 0) {
    return staff;
  }

  updates.push("updated_at = ?");
  params.push(Date.now());
  params.push(id);

  await db.prepare(`UPDATE staff SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  return await getStaffById(db, id);
}

export async function deactivateStaff(db, id) {
  const staff = await getStaffById(db, id);
  if (!staff) {
    throw HttpError(404, "Staff member not found");
  }

  await db.prepare("UPDATE staff SET status = ?, updated_at = ? WHERE id = ?").run("inactive", Date.now(), id);

  return await getStaffById(db, id);
}

export async function reactivateStaff(db, id) {
  const staff = await getStaffById(db, id);
  if (!staff) {
    throw HttpError(404, "Staff member not found");
  }

  await db.prepare("UPDATE staff SET status = ?, updated_at = ? WHERE id = ?").run("active", Date.now(), id);

  return await getStaffById(db, id);
}
