import { hashPin, pinMatches, signStaffToken } from "./auth.js";
import { HttpError, assertPin, normalizePhone, publicStaff } from "./util.js";

const STAFF_ROLES = {
  extension: "Extension officer",
  cooperative: "Cooperative manager",
};

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
  const count = db.prepare("SELECT COUNT(*) AS n FROM staff").get().n;
  if (count > 0) return false;

  const demo = [
    {
      id: crypto.randomUUID(),
      name: "Mercy Chirwa",
      phone: "+265888000101",
      pin_hash: hashPin("1234"),
      role: "extension",
      org: "Zidyana EPA",
      district: "Nkhotakota",
      epa: "Zidyana",
      created_at: Date.now(),
    },
    {
      id: crypto.randomUUID(),
      name: "Joseph Phiri",
      phone: "+265888000102",
      pin_hash: hashPin("1234"),
      role: "cooperative",
      org: "Kasungu Central Warehouse",
      district: "Kasungu",
      epa: "Kaluluma",
      created_at: Date.now(),
    },
  ];

  const insert = db.prepare(`
    INSERT INTO staff (id, name, phone, pin_hash, role, org, district, epa, created_at)
    VALUES (@id, @name, @phone, @pin_hash, @role, @org, @district, @epa, @created_at)
  `);
  for (const person of demo) insert.run(person);
  return true;
}
