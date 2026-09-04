export function parseMoney(raw) {
  const value = Number(String(raw || "").replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

export function fmtMoney(amount) {
  return `MWK ${Math.round(amount).toLocaleString("en")}`;
}

export function fmtPricePerKg(amount) {
  if (amount == null) return null;
  return `${fmtMoney(amount)}/kg`;
}

/** Convert common Malawi units to MWK per kg. */
export function toPricePerKg(amount, unit = "kg") {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  const u = String(unit || "kg").toLowerCase().replace(/\s+/g, "");
  if (u === "kg" || u === "perkg") return value;
  if (u === "50kg" || u === "50kgbag" || u === "bag50") return value / 50;
  if (u === "90kg" || u === "90kgbag" || u === "bag90") return value / 90;
  if (u === "tonne" || u === "ton" || u === "t") return value / 1000;
  return value;
}

export function relativeUpdatedLabel(fetchedAt) {
  if (!fetchedAt) return "Unknown";
  const ageMs = Date.now() - fetchedAt;
  if (ageMs < 86_400_000) return "Today";
  if (ageMs < 172_800_000) return "Yesterday";
  return new Date(fetchedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
