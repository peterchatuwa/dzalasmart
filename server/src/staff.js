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
];

export function roleLabel(role) {
  return STAFF_ROLES[role] || role;
}

export function loginStaff(db, input, jwtSecret) {
  const phone = normalizePhone(input.phone);
  const staff = db.prepare("SELECT * FROM staff WHERE phone = ?").get(phone);
  if (!staff || !pinMatches(assertPin(input.pin), staff.pin_hash)) {
    throw HttpError(401, "Phone or PIN is incorrect");
  }
  return {
    token: signStaffToken(staff, jwtSecret),
    staff: publicStaff(staff),
  };
}

export function seedStaffIfEmpty(db) {
  const insert = db.prepare(`
    INSERT INTO staff (id, name, phone, pin_hash, role, org, district, epa, created_at)
    VALUES (@id, @name, @phone, @pin_hash, @role, @org, @district, @epa, @created_at)
  `);
  let added = 0;
  for (const person of DEMO_STAFF) {
    const exists = db.prepare("SELECT id FROM staff WHERE phone = ?").get(person.phone);
    if (exists) continue;
    insert.run({
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

export function staffIdByRole(db, role) {
  return db.prepare("SELECT id FROM staff WHERE role = ?").get(role)?.id || null;
}
