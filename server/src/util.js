export function normalizePhone(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    const error = new Error("Phone number is required");
    error.status = 400;
    throw error;
  }
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "265" + digits.slice(1);
  if (digits.length === 9) digits = "265" + digits;
  if (!digits.startsWith("265") || digits.length < 12) {
    const error = new Error("Enter a valid Malawi phone number");
    error.status = 400;
    throw error;
  }
  return "+" + digits;
}

export function assertPin(pin) {
  if (!/^\d{4}$/.test(String(pin || ""))) {
    const error = new Error("PIN must be 4 digits");
    error.status = 400;
    throw error;
  }
  return String(pin);
}

export function publicFarmer(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    phone: row.phone,
    district: row.district,
    epa: row.epa,
    region: row.region,
    soilType: row.soil_type,
    nutrientStatus: row.nutrient_status,
    createdAt: row.created_at,
  };
}

export function HttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
