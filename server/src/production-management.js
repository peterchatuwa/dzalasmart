import crypto from "crypto";
import { HttpError } from "./util.js";

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
    involved_in_farming: input.involvedInFarming || false,
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
  return await db.prepare(`
    SELECT id, name, relationship, age, gender, education_level, involved_in_farming, created_at
    FROM household_members
    WHERE farmer_id = ?
    ORDER BY created_at ASC
  `).all(farmerId);
}

// ============================================================================
// LAND PARCEL MANAGEMENT
// ============================================================================

export async function addLandParcel(db, farmerId, input) {
  const parcel = {
    id: crypto.randomUUID(),
    farmer_id: farmerId,
    parcel_name: input.parcelName || `Parcel ${Date.now()}`,
    size_hectares: parseFloat(input.sizeHectares),
    ownership_type: String(input.ownershipType || "").trim(),
    title_deed_number: input.titleDeedNumber || null,
    gps_latitude: input.gpsLatitude || null,
    gps_longitude: input.gpsLongitude || null,
    gps_accuracy: input.gpsAccuracy || null,
    soil_type: input.soilType || null,
    soil_ph: input.soilPh || null,
    slope: input.slope || null,
    water_source: input.waterSource || null,
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

  return parcel;
}

export async function listLandParcels(db, farmerId) {
  return await db.prepare(`
    SELECT *
    FROM land_parcels
    WHERE farmer_id = ?
    ORDER BY created_at DESC
  `).all(farmerId);
}

// ============================================================================
// PRODUCTION SEASON MANAGEMENT
// ============================================================================

export async function createProductionSeason(db, farmerId, input) {
  const parcelExists = await db.prepare("SELECT id FROM land_parcels WHERE id = ? AND farmer_id = ?")
    .get(input.parcelId, farmerId);
  
  if (!parcelExists) {
    throw HttpError(404, "Land parcel not found");
  }

  const season = {
    id: crypto.randomUUID(),
    farmer_id: farmerId,
    parcel_id: input.parcelId,
    season_name: input.seasonName || "2025-2026",
    crop: String(input.crop || "").trim(),
    variety: input.variety || null,
    area_hectares: parseFloat(input.areaHectares),
    status: "planned",
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
    SELECT ps.*, lp.parcel_name, lp.size_hectares as parcel_size
    FROM production_seasons ps
    JOIN land_parcels lp ON ps.parcel_id = lp.id
    WHERE ps.farmer_id = ?
  `;
  const params = [farmerId];

  if (status) {
    query += " AND ps.status = ?";
    params.push(status);
  }

  query += " ORDER BY ps.created_at DESC";

  return await db.prepare(query).all(...params);
}

// ============================================================================
// PRODUCTION ACTIVITIES
// ============================================================================

export async function logProductionActivity(db, seasonId, input) {
  const activity = {
    id: crypto.randomUUID(),
    season_id: seasonId,
    activity_type: String(input.activityType || "").trim(),
    activity_date: input.activityDate || new Date().toISOString().split('T')[0],
    description: input.description || null,
    labor_hours: input.laborHours || null,
    labor_cost: input.laborCost || null,
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

  return activity;
}

export async function listProductionActivities(db, seasonId) {
  return await db.prepare(`
    SELECT *
    FROM production_activities
    WHERE season_id = ?
    ORDER BY activity_date DESC, created_at DESC
  `).all(seasonId);
}

// ============================================================================
// PLANTING DETAILS
// ============================================================================

export async function recordPlantingDetails(db, seasonId, input) {
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

  // Update season status to active
  await db.prepare("UPDATE production_seasons SET status = 'active' WHERE id = ?").run(seasonId);

  return planting;
}

// ============================================================================
// DAILY MONITORING
// ============================================================================

export async function logDailyMonitoring(db, seasonId, input) {
  const monitoring = {
    id: crypto.randomUUID(),
    season_id: seasonId,
    monitoring_date: input.monitoringDate || new Date().toISOString().split('T')[0],
    crop_stage: input.cropStage || null,
    crop_health: input.cropHealth || null,
    pest_observed: input.pestObserved || null,
    pest_severity: input.pestSeverity || null,
    disease_observed: input.diseaseObserved || null,
    disease_severity: input.diseaseSeverity || null,
    weed_pressure: input.weedPressure || null,
    soil_moisture: input.soilMoisture || null,
    rainfall_mm: input.rainfall || null,
    temperature_max: input.temperatureMax || null,
    temperature_min: input.temperatureMin || null,
    photos: input.photos ? JSON.stringify(input.photos) : null,
    action_taken: input.actionTaken || null,
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

  return monitoring;
}

export async function getMonitoringHistory(db, seasonId) {
  return await db.prepare(`
    SELECT *
    FROM farm_monitoring
    WHERE season_id = ?
    ORDER BY monitoring_date DESC
  `).all(seasonId);
}

// ============================================================================
// COST TRACKING
// ============================================================================

export async function recordProductionCost(db, seasonId, input) {
  const cost = {
    id: crypto.randomUUID(),
    season_id: seasonId,
    category_id: input.categoryId || null,
    cost_date: input.costDate || new Date().toISOString().split('T')[0],
    description: String(input.description || "").trim(),
    quantity: input.quantity || null,
    unit: input.unit || null,
    unit_cost: input.unitCost || null,
    total_cost: parseFloat(input.totalCost),
    payment_method: input.paymentMethod || null,
    paid_to: input.paidTo || null,
    receipt_number: input.receiptNumber || null,
    stage: input.stage || null,
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

export async function getProductionCostSummary(db, seasonId) {
  const costs = await db.prepare(`
    SELECT 
      pc.*,
      cc.category_name
    FROM production_costs pc
    LEFT JOIN cost_categories cc ON pc.category_id = cc.id
    WHERE pc.season_id = ?
    ORDER BY pc.cost_date DESC
  `).all(seasonId);

  const totalCost = costs.reduce((sum, c) => sum + parseFloat(c.total_cost), 0);
  
  const byCategory = {};
  const byStage = {};

  costs.forEach(cost => {
    const cat = cost.category_name || "Other";
    byCategory[cat] = (byCategory[cat] || 0) + parseFloat(cost.total_cost);

    const stage = cost.stage || "unspecified";
    byStage[stage] = (byStage[stage] || 0) + parseFloat(cost.total_cost);
  });

  return {
    costs,
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
