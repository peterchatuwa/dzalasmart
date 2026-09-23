import crypto from "crypto";
import { plotHectares } from "./plots.js";
import { HttpError } from "./util.js";

function field(input, ...keys) {
  for (const key of keys) {
    const value = input?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function withParcelAliases(parcel) {
  if (!parcel) return parcel;
  return {
    ...parcel,
    area_hectares: parcel.area_hectares ?? parcel.size_hectares ?? null,
  };
}

function withActivityAliases(activity) {
  if (!activity) return activity;
  const labor = Number(activity.labor_cost) || 0;
  const materials = Number(activity.material_cost) || 0;
  const equipment = Number(activity.equipment_cost) || 0;
  return {
    ...activity,
    cost_mwk: activity.cost_mwk ?? labor + materials + equipment,
  };
}

function withMonitoringAliases(record) {
  if (!record) return record;
  return {
    ...record,
    observation_date: record.observation_date || record.monitoring_date || null,
    pests_observed: record.pests_observed || record.pest_observed || null,
    diseases_observed: record.diseases_observed || record.disease_observed || null,
  };
}

function withCostAliases(cost) {
  if (!cost) return cost;
  return {
    ...cost,
    amount: cost.amount ?? (Number(cost.total_cost) || 0),
  };
}

// ============================================================================
// HOUSEHOLD MANAGEMENT
// ============================================================================

export async function addHouseholdMember(db, farmerId, input) {
  const member = {
    id: crypto.randomUUID(),
    farmer_id: farmerId,
    name: String(input.name || "").trim(),
    relationship: String(input.relationship || "").trim(),
    age: input.age || null,
    gender: input.gender || null,
    education_level: input.educationLevel || null,
    involved_in_farming: Boolean(field(input, "involvedInFarming", "involved_in_farming")),
  };

  if (!member.name) throw HttpError(400, "Member name is required");
  if (!member.relationship) throw HttpError(400, "Relationship is required");

  await db.prepare(`
    INSERT INTO household_members (id, farmer_id, name, relationship, age, gender, education_level, involved_in_farming)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    member.id,
    member.farmer_id,
    member.name,
    member.relationship,
    member.age,
    member.gender,
    member.education_level,
    member.involved_in_farming
  );

  return member;
}

export async function listHouseholdMembers(db, farmerId) {
  const recorded = await db.prepare(`
    SELECT id, name, relationship, age, gender, education_level, involved_in_farming, created_at
    FROM household_members
    WHERE farmer_id = ?
    ORDER BY created_at ASC
  `).all(farmerId);
  const registered = await db.prepare(`
    SELECT id, name, relationship, age, gender, contributes_labor, created_at
    FROM farmer_household_members
    WHERE farmer_id = ?
    ORDER BY created_at ASC
  `).all(farmerId);

  const seen = new Set((recorded || []).map((member) => member.id));
  const fromRegistration = (registered || [])
    .filter((member) => !seen.has(member.id))
    .map((member) => ({
      ...member,
      involved_in_farming: Boolean(member.contributes_labor),
    }));

  return [...(recorded || []), ...fromRegistration];
}

// ============================================================================
// LAND PARCEL MANAGEMENT
// ============================================================================

export async function addLandParcel(db, farmerId, input) {
  const parcel = {
    id: crypto.randomUUID(),
    farmer_id: farmerId,
    parcel_name: field(input, "parcelName", "parcel_name") || `Parcel ${Date.now()}`,
    size_hectares: parseFloat(field(input, "sizeHectares", "size_hectares", "areaHectares", "area_hectares")),
    ownership_type: String(field(input, "ownershipType", "ownership_type") || "").trim(),
    title_deed_number: field(input, "titleDeedNumber", "title_deed_number") || null,
    gps_latitude: field(input, "gpsLatitude", "gps_latitude", "latitude") || null,
    gps_longitude: field(input, "gpsLongitude", "gps_longitude", "longitude") || null,
    gps_accuracy: input.gpsAccuracy || null,
    soil_type: field(input, "soilType", "soil_type") || null,
    soil_ph: input.soilPh || null,
    slope: input.slope || null,
    water_source: field(input, "waterSource", "water_source") || null,
    distance_to_water_meters: input.distanceToWater || null,
    distance_to_home_meters: input.distanceToHome || null,
    previous_crop: input.previousCrop || null,
    fallow_years: input.fallowYears || 0,
  };

  if (isNaN(parcel.size_hectares) || parcel.size_hectares <= 0) {
    throw HttpError(400, "Valid parcel size is required");
  }
  if (!parcel.ownership_type) {
    throw HttpError(400, "Ownership type is required");
  }

  await db.prepare(`
    INSERT INTO land_parcels (
      id, farmer_id, parcel_name, size_hectares, ownership_type, title_deed_number,
      gps_latitude, gps_longitude, gps_accuracy, soil_type, soil_ph, slope,
      water_source, distance_to_water_meters, distance_to_home_meters,
      previous_crop, fallow_years
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    parcel.id,
    parcel.farmer_id,
    parcel.parcel_name,
    parcel.size_hectares,
    parcel.ownership_type,
    parcel.title_deed_number,
    parcel.gps_latitude,
    parcel.gps_longitude,
    parcel.gps_accuracy,
    parcel.soil_type,
    parcel.soil_ph,
    parcel.slope,
    parcel.water_source,
    parcel.distance_to_water_meters,
    parcel.distance_to_home_meters,
    parcel.previous_crop,
    parcel.fallow_years
  );

  return withParcelAliases(parcel);
}

function fromRegisteredParcel(row) {
  return withParcelAliases({
    ...row,
    size_hectares: row.hectares,
    area_hectares: row.hectares,
    ownership_type: row.tenure_type || row.ownership_type || "owned",
    water_source: row.water_access || row.irrigation_type || row.water_source || null,
    gps_latitude: row.lat ?? row.gps_latitude,
    gps_longitude: row.lon ?? row.gps_longitude,
    status: row.active === 0 || row.active === false ? "inactive" : "active",
  });
}

export async function listLandParcels(db, farmerId) {
  const parcels = await db.prepare(`
    SELECT *
    FROM land_parcels
    WHERE farmer_id = ?
    ORDER BY created_at DESC
  `).all(farmerId);
  const registered = await db.prepare(`
    SELECT *
    FROM farm_land_parcels
    WHERE farmer_id = ?
    ORDER BY created_at DESC
  `).all(farmerId);

  const seen = new Set((parcels || []).map((parcel) => parcel.id));
  return [
    ...(parcels || []).map(withParcelAliases),
    ...(registered || []).filter((parcel) => !seen.has(parcel.id)).map(fromRegisteredParcel),
  ];
}

export async function listLandParcelsForFarmer(db, farmer) {
  const parcels = await listLandParcels(db, farmer.id);
  if (parcels.length) return parcels;

  const place = farmer.village || farmer.epa || farmer.district || "Home";
  const hectares = await plotHectares(db, farmer.id);
  await addLandParcel(db, farmer.id, {
    parcelName: `${place} plot`,
    sizeHectares: hectares > 0 ? hectares : 1,
    ownershipType: "owned",
    soilType: [farmer.soilType, farmer.nutrientStatus].filter(Boolean).join(" · ") || null,
  });
  return listLandParcels(db, farmer.id);
}

// ============================================================================
// PRODUCTION SEASON MANAGEMENT
// ============================================================================

export async function createProductionSeason(db, farmerId, input) {
  const parcelId = field(input, "parcelId", "parcel_id");
  const inLand = await db.prepare("SELECT id FROM land_parcels WHERE id = ? AND farmer_id = ?")
    .get(parcelId, farmerId);
  const registered = await db.prepare("SELECT * FROM farm_land_parcels WHERE id = ? AND farmer_id = ?")
    .get(parcelId, farmerId);

  if (!inLand && !registered) {
    throw HttpError(404, "Land parcel not found");
  }

  if (!inLand && registered) {
    await db.prepare(`
      INSERT INTO land_parcels (
        id, farmer_id, parcel_name, size_hectares, ownership_type,
        gps_latitude, gps_longitude, soil_type, water_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      registered.id,
      farmerId,
      registered.parcel_name || "Plot",
      registered.hectares,
      registered.tenure_type || "owned",
      registered.lat,
      registered.lon,
      registered.soil_type,
      registered.water_access
    );
  }

  const season = {
    id: crypto.randomUUID(),
    farmer_id: farmerId,
    parcel_id: parcelId,
    season_name: field(input, "seasonName", "season_name") || "2025-2026",
    crop: String(input.crop || "").trim(),
    variety: input.variety || null,
    area_hectares: parseFloat(field(input, "areaHectares", "area_hectares")),
    status: "active",
  };

  if (!season.crop) throw HttpError(400, "Crop is required");
  if (isNaN(season.area_hectares) || season.area_hectares <= 0) {
    throw HttpError(400, "Valid area is required");
  }

  await db.prepare(`
    INSERT INTO production_seasons (id, farmer_id, parcel_id, season_name, crop, variety, area_hectares, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    season.id,
    season.farmer_id,
    season.parcel_id,
    season.season_name,
    season.crop,
    season.variety,
    season.area_hectares,
    season.status
  );

  return season;
}

export async function listProductionSeasons(db, farmerId, status = null) {
  let query = `
    SELECT ps.*,
           COALESCE(lp.parcel_name, fp.parcel_name) AS parcel_name,
           COALESCE(lp.size_hectares, fp.hectares) AS parcel_size
    FROM production_seasons ps
    LEFT JOIN land_parcels lp ON ps.parcel_id = lp.id
    LEFT JOIN farm_land_parcels fp ON ps.parcel_id = fp.id
    WHERE ps.farmer_id = ?
      AND (lp.id IS NOT NULL OR fp.id IS NOT NULL)
  `;
  const params = [farmerId];

  if (status) {
    query += " AND ps.status = ?";
    params.push(status);
  }

  query += " ORDER BY ps.created_at DESC";

  const seasons = (await db.prepare(query).all(...params)) || [];
  const history = await db.prepare(`
    SELECT h.id, h.crop, h.season AS season_name, h.parcel_id,
           p.hectares AS area_hectares, p.parcel_name, 'active' AS status
    FROM parcel_crop_history h
    JOIN farm_land_parcels p ON p.id = h.parcel_id
    WHERE p.farmer_id = ?
    ORDER BY h.created_at DESC
  `).all(farmerId);

  const seen = new Set(seasons.map((season) => season.id));
  return [
    ...seasons,
    ...(history || []).filter((season) => !seen.has(season.id)),
  ];
}

// ============================================================================
// PRODUCTION ACTIVITIES
// ============================================================================

async function assertFarmerSeason(db, seasonId, farmerId) {
  const season = await db.prepare(`
    SELECT id, farmer_id, crop, planting_date
    FROM production_seasons
    WHERE id = ?
  `).get(seasonId);
  if (!season || (farmerId && season.farmer_id !== farmerId)) {
    throw HttpError(404, "Season not found");
  }
  return season;
}

async function rememberPlantingDate(db, seasonId, date) {
  if (!date) return;
  await db.prepare(`
    UPDATE production_seasons
    SET planting_date = ?
    WHERE id = ? AND planting_date IS NULL
  `).run(String(date).slice(0, 10), seasonId);
}

export async function logProductionActivity(db, seasonId, input, farmerId) {
  await assertFarmerSeason(db, seasonId, farmerId);
  const activity = {
    id: crypto.randomUUID(),
    season_id: seasonId,
    activity_type: String(field(input, "activityType", "activity_type") || "").trim(),
    activity_date: field(input, "activityDate", "activity_date") || new Date().toISOString().split('T')[0],
    description: input.description || null,
    labor_hours: field(input, "laborHours", "labor_hours") || null,
    labor_cost: field(input, "laborCost", "labor_cost", "costMwk", "cost_mwk") || null,
    materials_used: input.materialsUsed ? JSON.stringify(input.materialsUsed) : null,
    material_cost: input.materialCost || null,
    equipment_used: input.equipmentUsed || null,
    equipment_cost: input.equipmentCost || null,
    weather_conditions: input.weatherConditions || null,
    photos: input.photos ? JSON.stringify(input.photos) : null,
    notes: input.notes || null,
    recorded_by: input.recordedBy || "farmer",
  };

  if (!activity.activity_type) throw HttpError(400, "Activity type is required");

  await db.prepare(`
    INSERT INTO production_activities (
      id, season_id, activity_type, activity_date, description,
      labor_hours, labor_cost, materials_used, material_cost,
      equipment_used, equipment_cost, weather_conditions, photos, notes, recorded_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    activity.id,
    activity.season_id,
    activity.activity_type,
    activity.activity_date,
    activity.description,
    activity.labor_hours,
    activity.labor_cost,
    activity.materials_used,
    activity.material_cost,
    activity.equipment_used,
    activity.equipment_cost,
    activity.weather_conditions,
    activity.photos,
    activity.notes,
    activity.recorded_by
  );

  if (String(activity.activity_type).toLowerCase() === "planting") {
    await rememberPlantingDate(db, seasonId, activity.activity_date);
  }

  return withActivityAliases(activity);
}

export async function listProductionActivities(db, seasonId, farmerId) {
  await assertFarmerSeason(db, seasonId, farmerId);
  const activities = await db.prepare(`
    SELECT *
    FROM production_activities
    WHERE season_id = ?
    ORDER BY activity_date DESC, created_at DESC
  `).all(seasonId);
  return (activities || []).map(withActivityAliases);
}

// ============================================================================
// PLANTING DETAILS
// ============================================================================

export async function recordPlantingDetails(db, seasonId, input, farmerId) {
  await assertFarmerSeason(db, seasonId, farmerId);
  const planting = {
    id: crypto.randomUUID(),
    season_id: seasonId,
    planting_date: input.plantingDate || new Date().toISOString().split('T')[0],
    planting_method: input.plantingMethod || null,
    row_spacing_cm: input.rowSpacing || null,
    plant_spacing_cm: input.plantSpacing || null,
    seed_rate_kg_per_ha: input.seedRate || null,
    seed_variety: input.seedVariety || null,
    seed_source: input.seedSource || null,
    population_target: input.populationTarget || null,
    actual_germination_rate: input.germinationRate || null,
    replanting_done: input.replantingDone || false,
    replanting_date: input.replantingDate || null,
    notes: input.notes || null,
  };

  await db.prepare(`
    INSERT INTO planting_details (
      id, season_id, planting_date, planting_method, row_spacing_cm, plant_spacing_cm,
      seed_rate_kg_per_ha, seed_variety, seed_source, population_target,
      actual_germination_rate, replanting_done, replanting_date, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    planting.id,
    planting.season_id,
    planting.planting_date,
    planting.planting_method,
    planting.row_spacing_cm,
    planting.plant_spacing_cm,
    planting.seed_rate_kg_per_ha,
    planting.seed_variety,
    planting.seed_source,
    planting.population_target,
    planting.actual_germination_rate,
    planting.replanting_done,
    planting.replanting_date,
    planting.notes
  );

  await db.prepare("UPDATE production_seasons SET status = 'active' WHERE id = ?").run(seasonId);
  await rememberPlantingDate(db, seasonId, planting.planting_date);

  return planting;
}

// ============================================================================
// DAILY MONITORING
// ============================================================================

export async function logDailyMonitoring(db, seasonId, input, farmerId) {
  await assertFarmerSeason(db, seasonId, farmerId);
  const monitoring = {
    id: crypto.randomUUID(),
    season_id: seasonId,
    monitoring_date: field(input, "monitoringDate", "monitoring_date", "observationDate", "observation_date") || new Date().toISOString().split('T')[0],
    crop_stage: field(input, "cropStage", "crop_stage") || null,
    crop_health: field(input, "cropHealth", "crop_health") || null,
    pest_observed: field(input, "pestObserved", "pest_observed", "pestsObserved", "pests_observed") || null,
    pest_severity: input.pestSeverity || null,
    disease_observed: field(input, "diseaseObserved", "disease_observed", "diseasesObserved", "diseases_observed") || null,
    disease_severity: input.diseaseSeverity || null,
    weed_pressure: input.weedPressure || null,
    soil_moisture: input.soilMoisture || null,
    rainfall_mm: input.rainfall || null,
    temperature_max: input.temperatureMax || null,
    temperature_min: input.temperatureMin || null,
    photos: input.photos ? JSON.stringify(input.photos) : null,
    action_taken: field(input, "actionTaken", "action_taken") || null,
    extension_visit: input.extensionVisit || false,
    extension_officer_id: input.extensionOfficerId || null,
    notes: input.notes || null,
  };

  await db.prepare(`
    INSERT INTO farm_monitoring (
      id, season_id, monitoring_date, crop_stage, crop_health,
      pest_observed, pest_severity, disease_observed, disease_severity,
      weed_pressure, soil_moisture, rainfall_mm, temperature_max, temperature_min,
      photos, action_taken, extension_visit, extension_officer_id, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    monitoring.id,
    monitoring.season_id,
    monitoring.monitoring_date,
    monitoring.crop_stage,
    monitoring.crop_health,
    monitoring.pest_observed,
    monitoring.pest_severity,
    monitoring.disease_observed,
    monitoring.disease_severity,
    monitoring.weed_pressure,
    monitoring.soil_moisture,
    monitoring.rainfall_mm,
    monitoring.temperature_max,
    monitoring.temperature_min,
    monitoring.photos,
    monitoring.action_taken,
    monitoring.extension_visit,
    monitoring.extension_officer_id,
    monitoring.notes
  );

  return withMonitoringAliases(monitoring);
}

export async function getMonitoringHistory(db, seasonId, farmerId) {
  await assertFarmerSeason(db, seasonId, farmerId);
  const records = await db.prepare(`
    SELECT *
    FROM farm_monitoring
    WHERE season_id = ?
    ORDER BY monitoring_date DESC
  `).all(seasonId);
  return (records || []).map(withMonitoringAliases);
}

// ============================================================================
// COST TRACKING
// ============================================================================

export async function recordProductionCost(db, seasonId, input, farmerId) {
  await assertFarmerSeason(db, seasonId, farmerId);
  const cost = {
    id: crypto.randomUUID(),
    season_id: seasonId,
    category_id: field(input, "categoryId", "category_id", "costCategoryId", "cost_category_id") || null,
    cost_date: field(input, "costDate", "cost_date") || new Date().toISOString().split('T')[0],
    description: String(input.description || "").trim(),
    quantity: input.quantity || null,
    unit: input.unit || null,
    unit_cost: input.unitCost || null,
    total_cost: parseFloat(field(input, "totalCost", "total_cost", "amount")),
    payment_method: field(input, "paymentMethod", "payment_method") || null,
    paid_to: input.paidTo || null,
    receipt_number: input.receiptNumber || null,
    stage: field(input, "stage", "productionStage", "production_stage") || null,
    activity_id: input.activityId || null,
    notes: input.notes || null,
  };

  if (!cost.description) throw HttpError(400, "Cost description is required");
  if (isNaN(cost.total_cost)) throw HttpError(400, "Valid total cost is required");

  await db.prepare(`
    INSERT INTO production_costs (
      id, season_id, category_id, cost_date, description, quantity, unit,
      unit_cost, total_cost, payment_method, paid_to, receipt_number,
      stage, activity_id, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cost.id,
    cost.season_id,
    cost.category_id,
    cost.cost_date,
    cost.description,
    cost.quantity,
    cost.unit,
    cost.unit_cost,
    cost.total_cost,
    cost.payment_method,
    cost.paid_to,
    cost.receipt_number,
    cost.stage,
    cost.activity_id,
    cost.notes
  );

  return cost;
}

export async function getProductionCostSummary(db, seasonId, farmerId) {
  await assertFarmerSeason(db, seasonId, farmerId);
  const costs = await db.prepare(`
    SELECT 
      pc.*,
      cc.category_name
    FROM production_costs pc
    LEFT JOIN cost_categories cc ON pc.category_id = cc.id
    WHERE pc.season_id = ?
    ORDER BY pc.cost_date DESC
  `).all(seasonId);

  const rows = costs || [];
  const totalCost = rows.reduce((sum, c) => sum + parseFloat(c.total_cost), 0);
  
  const byCategory = {};
  const byStage = {};

  rows.forEach(cost => {
    const cat = cost.category_name || "Other";
    byCategory[cat] = (byCategory[cat] || 0) + parseFloat(cost.total_cost);

    const stage = cost.stage || "unspecified";
    byStage[stage] = (byStage[stage] || 0) + parseFloat(cost.total_cost);
  });

  const summary = {
    land_preparation: byCategory["Land Preparation"] || 0,
    seeds: byCategory["Seeds & Planting Materials"] || 0,
    fertilizers: byCategory["Fertilizers"] || 0,
    labor: byCategory["Labor"] || 0,
    total: totalCost,
  };

  return {
    costs: rows.map(withCostAliases),
    summary,
    totalCost,
    byCategory,
    byStage,
  };
}

// ============================================================================
// OFFTAKE AGREEMENTS
// ============================================================================

export async function createOfftakeAgreement(db, farmerId, input) {
  const agreement = {
    id: crypto.randomUUID(),
    farmer_id: farmerId,
    season_id: input.seasonId || null,
    buyer_name: String(input.buyerName || "").trim(),
    buyer_contact: input.buyerContact || null,
    buyer_type: input.buyerType || null,
    crop: String(input.crop || "").trim(),
    variety: input.variety || null,
    quality_grade: input.qualityGrade || null,
    contracted_quantity_kg: parseFloat(input.contractedQuantity),
    price_per_kg: parseFloat(input.pricePerKg),
    total_value: parseFloat(input.contractedQuantity) * parseFloat(input.pricePerKg),
    delivery_date: input.deliveryDate || null,
    delivery_location: input.deliveryLocation || null,
    payment_terms: input.paymentTerms || null,
    advance_payment: input.advancePayment || 0,
    contract_date: input.contractDate || new Date().toISOString().split('T')[0],
    contract_status: "active",
    delivered_quantity_kg: 0,
    payment_received: input.advancePayment || 0,
    contract_document: input.contractDocument || null,
    notes: input.notes || null,
  };

  if (!agreement.buyer_name) throw HttpError(400, "Buyer name is required");
  if (!agreement.crop) throw HttpError(400, "Crop is required");
  if (isNaN(agreement.contracted_quantity_kg) || agreement.contracted_quantity_kg <= 0) {
    throw HttpError(400, "Valid contracted quantity is required");
  }
  if (isNaN(agreement.price_per_kg) || agreement.price_per_kg <= 0) {
    throw HttpError(400, "Valid price per kg is required");
  }

  await db.prepare(`
    INSERT INTO offtake_agreements (
      id, farmer_id, season_id, buyer_name, buyer_contact, buyer_type,
      crop, variety, quality_grade, contracted_quantity_kg, price_per_kg, total_value,
      delivery_date, delivery_location, payment_terms, advance_payment,
      contract_date, contract_status, delivered_quantity_kg, payment_received,
      contract_document, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    agreement.id,
    agreement.farmer_id,
    agreement.season_id,
    agreement.buyer_name,
    agreement.buyer_contact,
    agreement.buyer_type,
    agreement.crop,
    agreement.variety,
    agreement.quality_grade,
    agreement.contracted_quantity_kg,
    agreement.price_per_kg,
    agreement.total_value,
    agreement.delivery_date,
    agreement.delivery_location,
    agreement.payment_terms,
    agreement.advance_payment,
    agreement.contract_date,
    agreement.contract_status,
    agreement.delivered_quantity_kg,
    agreement.payment_received,
    agreement.contract_document,
    agreement.notes
  );

  return agreement;
}

export async function listOfftakeAgreements(db, farmerId, status = null) {
  let query = `
    SELECT *
    FROM offtake_agreements
    WHERE farmer_id = ?
  `;
  const params = [farmerId];

  if (status) {
    query += " AND contract_status = ?";
    params.push(status);
  }

  query += " ORDER BY contract_date DESC";

  return await db.prepare(query).all(...params);
}

function dayLabel(value) {
  if (!value) return "";
  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const stamp = Number(value);
    return new Date(stamp < 1e12 ? stamp * 1000 : stamp).toISOString().slice(0, 10);
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : String(value).slice(0, 10);
}

export async function farmerHomeSummary(db, farmerId) {
  let hectares = 0;
  try {
    const land = await db.prepare(`
      SELECT COALESCE(SUM(size_hectares), 0) AS hectares
      FROM land_parcels
      WHERE farmer_id = ?
    `).get(farmerId);
    hectares = Number(land?.hectares) || 0;
  } catch {
    hectares = 0;
  }
  if (!hectares) {
    try {
      const registered = await db.prepare(`
        SELECT COALESCE(SUM(hectares), 0) AS hectares
        FROM farm_land_parcels
        WHERE farmer_id = ?
      `).get(farmerId);
      hectares = Number(registered?.hectares) || 0;
    } catch {
      hectares = 0;
    }
  }

  const receipts = await db.prepare(`
    SELECT COUNT(*)::int AS n FROM warehouse_receipts WHERE farmer_id = ?
  `).get(farmerId);
  const loans = await db.prepare(`
    SELECT COUNT(*)::int AS n FROM loan_requests WHERE farmer_id = ?
  `).get(farmerId);

  const recent = [];
  try {
    const activities = await db.prepare(`
      SELECT pa.activity_type, pa.description, pa.activity_date::text AS activity_date, ps.crop
      FROM production_activities pa
      JOIN production_seasons ps ON ps.id = pa.season_id
      WHERE ps.farmer_id = ?
      ORDER BY pa.activity_date DESC
      LIMIT 5
    `).all(farmerId);
    for (const row of activities || []) {
      const title = row.description || row.activity_type;
      recent.push({
        title: `${row.crop ? `${row.crop}: ` : ""}${title}`,
        when: dayLabel(row.activity_date),
        sort: dayLabel(row.activity_date),
      });
    }
  } catch {
    // Seasons live in the farm-management schema. Home still loads without them.
  }

  const receiptRows = await db.prepare(`
    SELECT crop, status, created_at
    FROM warehouse_receipts
    WHERE farmer_id = ?
    ORDER BY created_at DESC
    LIMIT 5
  `).all(farmerId);
  for (const row of receiptRows || []) {
    recent.push({
      title: `Warehouse receipt · ${row.crop} · ${row.status}`,
      when: dayLabel(row.created_at),
      sort: dayLabel(row.created_at),
    });
  }
  recent.sort((a, b) => String(b.sort).localeCompare(String(a.sort)));

  return {
    hectares,
    receipts: Number(receipts?.n) || 0,
    loans: Number(loans?.n) || 0,
    recent: recent.slice(0, 5).map(({ title, when }) => ({ title, when })),
  };
}
