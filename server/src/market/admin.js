import { HttpError } from "../util.js";
import { MARKET_SOURCES } from "./catalog.js";
import { toPricePerKg } from "./normalize.js";
import { insertObservations, resolveCommodity, resolveLocation, updateSourceStatus } from "./store.js";
import { sourceIdBySlug } from "./seed.js";

const MANUAL_SOURCES = new Set(
  MARKET_SOURCES.filter((row) => row.kind === "manual" || row.kind === "import").map((row) => row.slug)
);

function defaultPriceKind(sourceSlug) {
  if (sourceSlug === "admarc" || sourceSlug === "nfra") return "procurement";
  if (sourceSlug === "worldbank") return "reference";
  return "market";
}

export async function recordManualObservation(db, staff, input = {}) {
  const sourceSlug = String(input.sourceSlug || input.source || "manual")
    .trim()
    .toLowerCase();
  if (!MANUAL_SOURCES.has(sourceSlug)) {
    throw HttpError(400, "Manual entry must use a staff-managed source (manual, ADMARC, NFRA, ACE, NAMIS, World Bank)");
  }
  if (!(await sourceIdBySlug(db, sourceSlug))) {
    throw HttpError(400, "Unknown market source");
  }

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
  const priceKind = input.priceKind || defaultPriceKind(sourceSlug);

  const count = await insertObservations(db, sourceSlug, [
    {
      commodityId: commodity.id,
      locationId: location.id,
      buyPricePerKg,
      sellPricePerKg,
      rawUnit: unit,
      rawAmount,
      priceKind,
      grade: input.grade || null,
      notes: input.notes || `Entered by ${staff.name}`,
      metadata: { staffId: staff.id, staffRole: staff.role, sourceSlug },
    },
  ]);
  if (!count) throw HttpError(500, "Could not save price");
  await updateSourceStatus(db, sourceSlug, { ok: true });
  return { saved: count, sourceSlug, priceKind };
}
