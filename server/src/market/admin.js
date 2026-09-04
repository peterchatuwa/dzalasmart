import { HttpError } from "../util.js";
import { toPricePerKg } from "./normalize.js";
import {
  insertObservations,
  resolveCommodity,
  resolveLocation,
  updateSourceStatus,
} from "./store.js";

export async function recordManualObservation(db, staff, input = {}) {
  const commodity = await resolveCommodity(db, input.crop);
  if (!commodity) throw HttpError(400, "Unknown commodity");
  const location = await resolveLocation(db, {
    district: input.district,
    locationSlug: input.locationSlug,
  });
  if (!location) throw HttpError(400, "District or market location is required");

  const rawAmount = Number(input.pricePerKg ?? input.buyPricePerKg);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    throw HttpError(400, "Price must be a positive number");
  }
  const unit = input.unit || "kg";
  const buyPricePerKg = toPricePerKg(rawAmount, unit);
  const sellRaw = input.sellPricePerKg != null ? Number(input.sellPricePerKg) : null;
  const sellPricePerKg = sellRaw != null ? toPricePerKg(sellRaw, unit) : null;

  const count = await insertObservations(db, "manual", [{
    commodityId: commodity.id,
    locationId: location.id,
    buyPricePerKg,
    sellPricePerKg,
    rawUnit: unit,
    rawAmount,
    priceKind: input.priceKind || "market",
    grade: input.grade || null,
    notes: input.notes || `Entered by ${staff.name}`,
    metadata: { staffId: staff.id, staffRole: staff.role },
  }]);
  if (!count) throw HttpError(500, "Could not save price");
  await updateSourceStatus(db, "manual", { ok: true });
  return { saved: count };
}
