-- Comprehensive Farm Management System Schema
-- Covers: Registration, Production Tracking, Cost Management, Market Intelligence

-- ============================================================================
-- 1. ENHANCED FARMER REGISTRATION
-- ============================================================================

-- Household Members table
CREATE TABLE IF NOT EXISTS household_members (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL, -- spouse, child, parent, sibling, other
  age INTEGER,
  gender TEXT,
  education_level TEXT,
  involved_in_farming BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE
);

-- Land Parcels table (comprehensive)
CREATE TABLE IF NOT EXISTS land_parcels (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  parcel_name TEXT,
  size_hectares REAL NOT NULL,
  ownership_type TEXT NOT NULL, -- owned, leased, borrowed, communal
  title_deed_number TEXT,
  gps_latitude REAL,
  gps_longitude REAL,
  gps_accuracy REAL,
  soil_type TEXT,
  soil_ph REAL,
  slope TEXT, -- flat, gentle, moderate, steep
  water_source TEXT, -- rainfed, irrigation, borehole, river
  distance_to_water_meters REAL,
  distance_to_home_meters REAL,
  previous_crop TEXT,
  fallow_years INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_land_parcels_farmer ON land_parcels(farmer_id);

-- Production History table
CREATE TABLE IF NOT EXISTS production_history (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  parcel_id TEXT,
  season TEXT NOT NULL, -- e.g., "2024-2025", "2025-2026"
  crop TEXT NOT NULL,
  variety TEXT,
  area_planted_hectares REAL,
  planting_date DATE,
  harvest_date DATE,
  yield_kg REAL,
  yield_per_hectare REAL,
  quality_grade TEXT,
  total_revenue REAL,
  total_costs REAL,
  net_profit REAL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (parcel_id) REFERENCES land_parcels(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_production_history_farmer ON production_history(farmer_id);
CREATE INDEX IF NOT EXISTS idx_production_history_season ON production_history(season);

-- ============================================================================
-- 2. PRODUCTION CYCLE TRACKING
-- ============================================================================

-- Production Seasons table (current active seasons)
CREATE TABLE IF NOT EXISTS production_seasons (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  parcel_id TEXT NOT NULL,
  season_name TEXT NOT NULL,
  crop TEXT NOT NULL,
  variety TEXT,
  area_hectares REAL NOT NULL,
  status TEXT DEFAULT 'planned', -- planned, active, harvested, sold, completed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (parcel_id) REFERENCES land_parcels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_production_seasons_farmer ON production_seasons(farmer_id);
CREATE INDEX IF NOT EXISTS idx_production_seasons_status ON production_seasons(status);

-- Production Activities table (detailed activity log)
CREATE TABLE IF NOT EXISTS production_activities (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  activity_type TEXT NOT NULL, -- land_prep, planting, weeding, fertilizing, spraying, irrigation, monitoring, harvesting
  activity_date DATE NOT NULL,
  description TEXT,
  labor_hours REAL,
  labor_cost REAL,
  materials_used TEXT, -- JSON array of materials
  material_cost REAL,
  equipment_used TEXT,
  equipment_cost REAL,
  weather_conditions TEXT,
  photos TEXT, -- JSON array of photo URLs
  notes TEXT,
  recorded_by TEXT, -- farmer or extension officer
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (season_id) REFERENCES production_seasons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_production_activities_season ON production_activities(season_id);
CREATE INDEX IF NOT EXISTS idx_production_activities_date ON production_activities(activity_date);

-- Input Allocation table (seeds, fertilizer, pesticides accessed)
CREATE TABLE IF NOT EXISTS input_allocations (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  input_type TEXT NOT NULL, -- seed, fertilizer, pesticide, herbicide, equipment
  input_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL, -- kg, liters, bags, pieces
  cost_per_unit REAL,
  total_cost REAL,
  source TEXT, -- voucher, cash_purchase, credit, government, ngo
  voucher_id TEXT,
  supplier_name TEXT,
  acquisition_date DATE,
  application_date DATE,
  application_rate TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (season_id) REFERENCES production_seasons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_input_allocations_season ON input_allocations(season_id);

-- Planting Details table
CREATE TABLE IF NOT EXISTS planting_details (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  planting_date DATE NOT NULL,
  planting_method TEXT, -- broadcasting, rows, hills, dibbling
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

-- Daily Farm Monitoring table
CREATE TABLE IF NOT EXISTS farm_monitoring (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  monitoring_date DATE NOT NULL,
  crop_stage TEXT, -- germination, vegetative, flowering, grain_filling, maturity
  crop_health TEXT, -- excellent, good, fair, poor, critical
  pest_observed TEXT,
  pest_severity TEXT, -- none, low, moderate, high, severe
  disease_observed TEXT,
  disease_severity TEXT,
  weed_pressure TEXT, -- none, low, moderate, high
  soil_moisture TEXT, -- dry, adequate, waterlogged
  rainfall_mm REAL,
  temperature_max REAL,
  temperature_min REAL,
  photos TEXT, -- JSON array
  action_taken TEXT,
  extension_visit BOOLEAN DEFAULT FALSE,
  extension_officer_id TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (season_id) REFERENCES production_seasons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_farm_monitoring_season ON farm_monitoring(season_id);
CREATE INDEX IF NOT EXISTS idx_farm_monitoring_date ON farm_monitoring(monitoring_date);

-- Disease Detection & Control table
CREATE TABLE IF NOT EXISTS disease_pest_control (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  detection_date DATE NOT NULL,
  issue_type TEXT NOT NULL, -- pest, disease, weed, nutrient_deficiency
  issue_name TEXT NOT NULL,
  severity TEXT NOT NULL, -- low, moderate, high, severe
  area_affected_percentage REAL,
  symptoms_description TEXT,
  photos TEXT, -- JSON array
  diagnosis_source TEXT, -- farmer, extension, lab, app_ai
  control_method TEXT, -- chemical, biological, cultural, mechanical
  product_used TEXT,
  application_date DATE,
  application_rate TEXT,
  cost REAL,
  effectiveness TEXT, -- excellent, good, fair, poor
  follow_up_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (season_id) REFERENCES production_seasons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_disease_pest_control_season ON disease_pest_control(season_id);

-- Harvest Projection table
CREATE TABLE IF NOT EXISTS harvest_projections (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  projection_date DATE NOT NULL,
  projected_yield_kg REAL NOT NULL,
  projected_harvest_date DATE,
  confidence_level TEXT, -- low, medium, high
  projection_method TEXT, -- visual, sample, model, historical
  factors_considered TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (season_id) REFERENCES production_seasons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_harvest_projections_season ON harvest_projections(season_id);

-- Actual Harvest table
CREATE TABLE IF NOT EXISTS harvests (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  harvest_date DATE NOT NULL,
  quantity_kg REAL NOT NULL,
  quality_grade TEXT,
  moisture_content REAL,
  damaged_percentage REAL,
  storage_location TEXT,
  storage_method TEXT, -- hermetic_bags, granary, warehouse, sold_immediately
  immediate_sale_kg REAL,
  stored_kg REAL,
  home_consumption_kg REAL,
  losses_kg REAL,
  loss_reason TEXT,
  photos TEXT, -- JSON array
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (season_id) REFERENCES production_seasons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_harvests_season ON harvests(season_id);

-- ============================================================================
-- 3. PRODUCTION COST TRACKING
-- ============================================================================

-- Cost Categories table
CREATE TABLE IF NOT EXISTS cost_categories (
  id TEXT PRIMARY KEY,
  category_name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Insert standard cost categories
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

-- Production Costs table (detailed cost tracking)
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
  payment_method TEXT, -- cash, mobile_money, credit, voucher, in_kind
  paid_to TEXT,
  receipt_number TEXT,
  stage TEXT, -- pre_planting, planting, growing, harvesting, post_harvest
  activity_id TEXT, -- link to production_activities
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
-- 4. MARKET INTELLIGENCE & OFFTAKE AGREEMENTS
-- ============================================================================

-- Market Conditions table
CREATE TABLE IF NOT EXISTS market_conditions (
  id TEXT PRIMARY KEY,
  district TEXT NOT NULL,
  market_name TEXT,
  report_date DATE NOT NULL,
  crop TEXT NOT NULL,
  supply_level TEXT, -- very_low, low, normal, high, very_high
  demand_level TEXT, -- very_low, low, normal, high, very_high
  price_trend TEXT, -- falling, stable, rising
  market_pressure TEXT, -- low, moderate, high
  buyers_present INTEGER,
  quality_requirements TEXT,
  preferred_delivery_terms TEXT,
  notes TEXT,
  reported_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_conditions_district ON market_conditions(district);
CREATE INDEX IF NOT EXISTS idx_market_conditions_date ON market_conditions(report_date);
CREATE INDEX IF NOT EXISTS idx_market_conditions_crop ON market_conditions(crop);

-- Enhanced Market Prices table (updating existing)
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS market_name TEXT;
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS quality_grade TEXT;
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS volume_available_kg REAL;
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS price_trend TEXT;

-- Offtake Agreements table
CREATE TABLE IF NOT EXISTS offtake_agreements (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  season_id TEXT,
  buyer_name TEXT NOT NULL,
  buyer_contact TEXT,
  buyer_type TEXT, -- processor, trader, cooperative, exporter, warehouse
  crop TEXT NOT NULL,
  variety TEXT,
  quality_grade TEXT,
  contracted_quantity_kg REAL NOT NULL,
  price_per_kg REAL NOT NULL,
  total_value REAL NOT NULL,
  delivery_date DATE,
  delivery_location TEXT,
  payment_terms TEXT, -- immediate, 7_days, 14_days, 30_days, upon_delivery
  advance_payment REAL DEFAULT 0,
  contract_date DATE NOT NULL,
  contract_status TEXT DEFAULT 'active', -- active, partially_fulfilled, fulfilled, cancelled
  delivered_quantity_kg REAL DEFAULT 0,
  payment_received REAL DEFAULT 0,
  contract_document TEXT, -- URL or file path
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (season_id) REFERENCES production_seasons(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_offtake_agreements_farmer ON offtake_agreements(farmer_id);
CREATE INDEX IF NOT EXISTS idx_offtake_agreements_status ON offtake_agreements(contract_status);
CREATE INDEX IF NOT EXISTS idx_offtake_agreements_season ON offtake_agreements(season_id);

-- Delivery Records table (for offtake agreements)
CREATE TABLE IF NOT EXISTS delivery_records (
  id TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL,
  delivery_date DATE NOT NULL,
  quantity_kg REAL NOT NULL,
  quality_grade TEXT,
  moisture_content REAL,
  accepted_quantity_kg REAL,
  rejected_quantity_kg REAL,
  rejection_reason TEXT,
  price_per_kg REAL,
  payment_amount REAL,
  payment_date DATE,
  payment_method TEXT,
  receipt_number TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agreement_id) REFERENCES offtake_agreements(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_delivery_records_agreement ON delivery_records(agreement_id);

-- Market Intelligence Reports table
CREATE TABLE IF NOT EXISTS market_intelligence (
  id TEXT PRIMARY KEY,
  report_date DATE NOT NULL,
  report_type TEXT NOT NULL, -- weekly, monthly, seasonal, special
  crop TEXT NOT NULL,
  district TEXT,
  national_production_estimate_mt REAL,
  regional_production_estimate_mt REAL,
  import_volume_mt REAL,
  export_volume_mt REAL,
  stock_levels_mt REAL,
  demand_forecast TEXT,
  price_forecast TEXT,
  key_insights TEXT,
  recommendations TEXT,
  data_sources TEXT,
  report_document TEXT, -- URL or file path
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_intelligence_crop ON market_intelligence(crop);
CREATE INDEX IF NOT EXISTS idx_market_intelligence_date ON market_intelligence(report_date);
