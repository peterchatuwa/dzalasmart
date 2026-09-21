-- Deploy Comprehensive Farm Management System to PostgreSQL
-- Run this on the VPS database

-- ============================================================================
-- 1. HOUSEHOLD MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS household_members (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  education_level TEXT,
  involved_in_farming BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_household_members_farmer ON household_members(farmer_id);

-- ============================================================================
-- 2. LAND PARCELS
-- ============================================================================

CREATE TABLE IF NOT EXISTS land_parcels (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  parcel_name TEXT,
  size_hectares REAL NOT NULL,
  ownership_type TEXT NOT NULL,
  title_deed_number TEXT,
  gps_latitude REAL,
  gps_longitude REAL,
  gps_accuracy REAL,
  soil_type TEXT,
  soil_ph REAL,
  slope TEXT,
  water_source TEXT,
  distance_to_water_meters REAL,
  distance_to_home_meters REAL,
  previous_crop TEXT,
  fallow_years INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_land_parcels_farmer ON land_parcels(farmer_id);

-- ============================================================================
-- 3. PRODUCTION SEASONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS production_seasons (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  parcel_id TEXT NOT NULL,
  season_name TEXT NOT NULL,
  crop TEXT NOT NULL,
  variety TEXT,
  area_hectares REAL NOT NULL,
  status TEXT DEFAULT 'planned',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (parcel_id) REFERENCES land_parcels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_production_seasons_farmer ON production_seasons(farmer_id);
CREATE INDEX IF NOT EXISTS idx_production_seasons_status ON production_seasons(status);

-- ============================================================================
-- 4. PRODUCTION ACTIVITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS production_activities (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  activity_date DATE NOT NULL,
  description TEXT,
  labor_hours REAL,
  labor_cost REAL,
  materials_used TEXT,
  material_cost REAL,
  equipment_used TEXT,
  equipment_cost REAL,
  weather_conditions TEXT,
  photos TEXT,
  notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (season_id) REFERENCES production_seasons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_production_activities_season ON production_activities(season_id);
CREATE INDEX IF NOT EXISTS idx_production_activities_date ON production_activities(activity_date);

-- ============================================================================
-- 5. PLANTING DETAILS
-- ============================================================================

CREATE TABLE IF NOT EXISTS planting_details (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  planting_date DATE NOT NULL,
  planting_method TEXT,
  row_spacing_cm REAL,
  plant_spacing_cm REAL,
  seed_rate_kg_per_ha REAL,
  seed_variety TEXT,
  seed_source TEXT,
  population_target INTEGER,
  actual_germination_rate REAL,
  replanting_done BOOLEAN DEFAULT FALSE,
  replanting_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (season_id) REFERENCES production_seasons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_planting_details_season ON planting_details(season_id);

-- ============================================================================
-- 6. DAILY FARM MONITORING
-- ============================================================================

CREATE TABLE IF NOT EXISTS farm_monitoring (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  monitoring_date DATE NOT NULL,
  crop_stage TEXT,
  crop_health TEXT,
  pest_observed TEXT,
  pest_severity TEXT,
  disease_observed TEXT,
  disease_severity TEXT,
  weed_pressure TEXT,
  soil_moisture TEXT,
  rainfall_mm REAL,
  temperature_max REAL,
  temperature_min REAL,
  photos TEXT,
  action_taken TEXT,
  extension_visit BOOLEAN DEFAULT FALSE,
  extension_officer_id TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (season_id) REFERENCES production_seasons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_farm_monitoring_season ON farm_monitoring(season_id);
CREATE INDEX IF NOT EXISTS idx_farm_monitoring_date ON farm_monitoring(monitoring_date);

-- ============================================================================
-- 7. COST CATEGORIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_categories (
  id TEXT PRIMARY KEY,
  category_name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0
);

INSERT INTO cost_categories (id, category_name, description, sort_order) VALUES
  ('cc-1', 'Land Preparation', 'Ploughing, harrowing, ridging', 1),
  ('cc-2', 'Seeds & Planting Materials', 'Certified seeds, local seeds, seedlings', 2),
  ('cc-3', 'Fertilizers', 'Basal, top-dressing, organic manure', 3),
  ('cc-4', 'Pesticides & Herbicides', 'Insecticides, fungicides, herbicides', 4),
  ('cc-5', 'Labor', 'Family labor, hired labor, casual workers', 5),
  ('cc-6', 'Equipment & Tools', 'Rent or purchase of equipment', 6),
  ('cc-7', 'Irrigation', 'Water, fuel, maintenance', 7),
  ('cc-8', 'Transportation', 'Input delivery, produce transport', 8),
  ('cc-9', 'Storage', 'Bags, warehouse fees, fumigation', 9),
  ('cc-10', 'Other', 'Miscellaneous expenses', 10)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. PRODUCTION COSTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS production_costs (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  cost_date DATE NOT NULL,
  description TEXT NOT NULL,
  quantity REAL,
  unit TEXT,
  unit_cost REAL,
  total_cost REAL NOT NULL,
  payment_method TEXT,
  paid_to TEXT,
  receipt_number TEXT,
  stage TEXT,
  activity_id TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (season_id) REFERENCES production_seasons(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES cost_categories(id),
  FOREIGN KEY (activity_id) REFERENCES production_activities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_production_costs_season ON production_costs(season_id);
CREATE INDEX IF NOT EXISTS idx_production_costs_category ON production_costs(category_id);
CREATE INDEX IF NOT EXISTS idx_production_costs_stage ON production_costs(stage);

-- ============================================================================
-- 9. OFFTAKE AGREEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS offtake_agreements (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  season_id TEXT,
  buyer_name TEXT NOT NULL,
  buyer_contact TEXT,
  buyer_type TEXT,
  crop TEXT NOT NULL,
  variety TEXT,
  quality_grade TEXT,
  contracted_quantity_kg REAL NOT NULL,
  price_per_kg REAL NOT NULL,
  total_value REAL NOT NULL,
  delivery_date DATE,
  delivery_location TEXT,
  payment_terms TEXT,
  advance_payment REAL DEFAULT 0,
  contract_date DATE NOT NULL,
  contract_status TEXT DEFAULT 'active',
  delivered_quantity_kg REAL DEFAULT 0,
  payment_received REAL DEFAULT 0,
  contract_document TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (season_id) REFERENCES production_seasons(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_offtake_agreements_farmer ON offtake_agreements(farmer_id);
CREATE INDEX IF NOT EXISTS idx_offtake_agreements_status ON offtake_agreements(contract_status);
CREATE INDEX IF NOT EXISTS idx_offtake_agreements_season ON offtake_agreements(season_id);

-- ============================================================================
-- COMPLETE!
-- ============================================================================

-- Verify tables were created
SELECT 
  'household_members' as table_name, COUNT(*) as row_count FROM household_members
UNION ALL
SELECT 'land_parcels', COUNT(*) FROM land_parcels
UNION ALL
SELECT 'production_seasons', COUNT(*) FROM production_seasons
UNION ALL
SELECT 'production_activities', COUNT(*) FROM production_activities
UNION ALL
SELECT 'planting_details', COUNT(*) FROM planting_details
UNION ALL
SELECT 'farm_monitoring', COUNT(*) FROM farm_monitoring
UNION ALL
SELECT 'cost_categories', COUNT(*) FROM cost_categories
UNION ALL
SELECT 'production_costs', COUNT(*) FROM production_costs
UNION ALL
SELECT 'offtake_agreements', COUNT(*) FROM offtake_agreements;
