// Mobile API Endpoints for Android App
// Handles data collection from Nzeru Farmer mobile app

import crypto from "crypto";
import { hashPin } from "./auth.js";

/**
 * Process and save farmer data from mobile app
 */
async function saveMobileFarmer(db, data) {
  const {
    fullName,
    phone,
    district,
    epa,
    village,
    gender,
    dateOfBirth,
    householdSize,
    householdType,
    livestock,
    photo
  } = data;

  // Check if farmer already exists
  const existing = await db.one(
    'SELECT id FROM farmers WHERE phone = $1',
    [phone]
  ).catch(() => null);

  if (existing) {
    return {
      success: false,
      error: 'Farmer with this phone number already exists',
      farmerId: existing.id
    };
  }

  // Generate unique IDs
  const farmerId = 'farmer_' + crypto.randomBytes(8).toString('hex');
  const farmerCode = 'F' + Date.now().toString().slice(-8);
  const defaultPin = await bcrypt.hash('0000', 10);
  const now = Date.now();

  // Map district to region
  const regionMap = {
    'Lilongwe': 'Central',
    'Blantyre': 'Southern',
    'Mzuzu': 'Northern',
    'Zomba': 'Southern',
    'Kasungu': 'Central',
    'Mangochi': 'Southern',
    'Salima': 'Central',
    'Dedza': 'Central'
  };
  const region = regionMap[district] || 'Central';

  // Parse date of birth to timestamp
  const dobTimestamp = dateOfBirth ? new Date(dateOfBirth).getTime() : null;

  // Insert new farmer
  await db.none(
    `INSERT INTO farmers (
      id, code, name, phone, pin_hash, district, epa, region, village,
      gender, date_of_birth, household_size, household_type, livestock,
      registration_source, status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [
      farmerId,
      farmerCode,
      fullName,
      phone,
      defaultPin,
      district,
      epa || null,
      region,
      village || null,
      gender || null,
      dobTimestamp,
      householdSize || null,
      householdType || null,
      livestock || null,
      'mobile_app',
      'active',
      now,
      now
    ]
  );

  // Store photo if provided (base64)
  // TODO: Optimize photo storage (compress, upload to S3, etc.)
  const photoStored = !!photo;

  return {
    success: true,
    farmerId,
    farmerCode,
    message: 'Farmer registered successfully. Default PIN is 0000.',
    photoStored
  };
}

/**
 * Process and save parcel data from mobile app
 */
async function saveMobileParcel(db, data) {
  const {
    farmerPhone,
    name,
    size,
    tenure,
    soilType,
    waterSource,
    location,
    photo
  } = data;

  // Find farmer by phone
  const farmer = await db.one(
    'SELECT id FROM farmers WHERE phone = $1',
    [farmerPhone]
  ).catch(() => null);

  if (!farmer) {
    return {
      success: false,
      error: 'Farmer not found. Please register farmer first.'
    };
  }

  // Generate unique ID
  const parcelId = 'parcel_' + crypto.randomBytes(8).toString('hex');
  const now = Date.now();

  // Map water source to water_access field
  const waterAccessMap = {
    'rain': 'rainfed_only',
    'borehole': 'borehole',
    'river': 'river_stream',
    'irrigation': 'irrigation_system'
  };
  const waterAccess = waterAccessMap[waterSource] || 'rainfed_only';

  // Insert parcel
  await db.none(
    `INSERT INTO farm_land_parcels (
      id, farmer_id, parcel_name, hectares, tenure_type, 
      lat, lon, accuracy_m, soil_type, water_access,
      active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      parcelId,
      farmer.id,
      name,
      size,
      tenure || 'customary',
      location?.latitude || null,
      location?.longitude || null,
      location?.accuracy || null,
      soilType || null,
      waterAccess,
      1, // active
      now,
      now
    ]
  );

  return {
    success: true,
    parcelId,
    farmerId: farmer.id,
    message: 'Parcel saved successfully',
    photoStored: !!photo
  };
}

/**
 * Process and save crop data from mobile app
 */
async function saveMobileCrop(db, data) {
  const {
    farmerPhone,
    parcelName,
    cropType,
    variety,
    plantingDate,
    expectedHarvest,
    areaPlanted,
    expectedYield,
    irrigation,
    notes,
    photo
  } = data;

  // Find farmer by phone
  const farmer = await db.one(
    'SELECT id FROM farmers WHERE phone = $1',
    [farmerPhone]
  ).catch(() => null);

  if (!farmer) {
    return {
      success: false,
      error: 'Farmer not found'
    };
  }

  // Find parcel by name and farmer
  const parcel = await db.one(
    'SELECT id FROM farm_land_parcels WHERE farmer_id = $1 AND parcel_name = $2',
    [farmer.id, parcelName]
  ).catch(() => null);

  if (!parcel) {
    return {
      success: false,
      error: 'Parcel not found. Please add parcel first.'
    };
  }

  // Generate unique ID
  const historyId = 'crop_' + crypto.randomBytes(8).toString('hex');
  const now = Date.now();

  // Determine season based on planting date
  const plantDate = plantingDate ? new Date(plantingDate) : new Date();
  const month = plantDate.getMonth() + 1;
  const year = plantDate.getFullYear();
  const season = month >= 11 || month <= 4 ? `${year}/${year+1}` : `${year} dry`;

  // Insert crop history record
  const notesText = [
    variety ? `Variety: ${variety}` : null,
    irrigation !== 'none' ? `Irrigation: ${irrigation}` : null,
    areaPlanted ? `Area: ${areaPlanted}ha` : null,
    expectedYield ? `Expected: ${expectedYield}kg` : null,
    notes
  ].filter(Boolean).join('. ');

  await db.none(
    `INSERT INTO parcel_crop_history (
      id, parcel_id, crop, season, yield_kg, notes, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      historyId,
      parcel.id,
      cropType,
      season,
      expectedYield || null,
      notesText || null,
      now
    ]
  );

  return {
    success: true,
    cropId: historyId,
    farmerId: farmer.id,
    parcelId: parcel.id,
    season,
    message: 'Crop data saved successfully',
    photoStored: !!photo
  };
}

/**
 * Get mobile app statistics for a specific user or district
 */
async function getMobileStats(db, filters = {}) {
  const { district, epa } = filters;

  let whereConditions = [];
  let params = [];
  let paramIndex = 1;

  if (district) {
    whereConditions.push(`f.district = $${paramIndex++}`);
    params.push(district);
  }

  if (epa) {
    whereConditions.push(`f.epa = $${paramIndex++}`);
    params.push(epa);
  }

  const whereClause = whereConditions.length > 0 
    ? 'WHERE ' + whereConditions.join(' AND ') 
    : '';

  // Get counts
  const stats = await db.one(
    `SELECT
      COUNT(DISTINCT f.id) as farmers_count,
      COUNT(DISTINCT p.id) as parcels_count,
      COUNT(DISTINCT c.id) as crops_count,
      COALESCE(SUM(p.hectares), 0) as total_land_hectares,
      COALESCE(SUM(c.yield_kg), 0) as total_expected_yield_kg
    FROM farmers f
    LEFT JOIN farm_land_parcels p ON p.farmer_id = f.id
    LEFT JOIN parcel_crop_history c ON c.parcel_id = p.id
    ${whereClause}`,
    params
  );

  // Get crop breakdown
  const cropBreakdown = await db.any(
    `SELECT
      c.crop,
      COUNT(*) as count,
      COALESCE(SUM(c.yield_kg), 0) as total_yield
    FROM parcel_crop_history c
    JOIN farm_land_parcels p ON p.id = c.parcel_id
    JOIN farmers f ON f.id = p.farmer_id
    ${whereClause}
    GROUP BY c.crop
    ORDER BY count DESC`,
    params
  );

  return {
    farmers_count: parseInt(stats.farmers_count),
    parcels_count: parseInt(stats.parcels_count),
    crops_count: parseInt(stats.crops_count),
    total_land_hectares: parseFloat(stats.total_land_hectares),
    total_expected_yield_kg: parseFloat(stats.total_expected_yield_kg),
    cropBreakdown
  };
}

/**
 * Get recent mobile submissions for monitoring
 */
async function getRecentMobileSubmissions(db, limit = 50) {
  const farmers = await db.any(
    `SELECT 
      id, phone, name, district, epa,
      created_at as timestamp,
      'farmer' as type
    FROM farmers
    WHERE registration_source = 'mobile_app'
    ORDER BY created_at DESC
    LIMIT $1`,
    [Math.floor(limit / 3)]
  );

  const parcels = await db.any(
    `SELECT
      p.id, f.phone, p.parcel_name as name, p.hectares,
      p.created_at as timestamp,
      'parcel' as type
    FROM farm_land_parcels p
    JOIN farmers f ON f.id = p.farmer_id
    ORDER BY p.created_at DESC
    LIMIT $1`,
    [Math.floor(limit / 3)]
  );

  const crops = await db.any(
    `SELECT
      c.id, f.phone, c.crop, c.yield_kg,
      c.created_at as timestamp,
      'crop' as type
    FROM parcel_crop_history c
    JOIN farm_land_parcels p ON p.id = c.parcel_id
    JOIN farmers f ON f.id = p.farmer_id
    ORDER BY c.created_at DESC
    LIMIT $1`,
    [Math.floor(limit / 3)]
  );

  // Combine and sort by timestamp
  const all = [...farmers, ...parcels, ...crops]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  return all;
}

export {
  saveMobileFarmer,
  saveMobileParcel,
  saveMobileCrop,
  getMobileStats,
  getRecentMobileSubmissions
};
