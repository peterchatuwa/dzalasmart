import pg from "pg";

const { Pool } = pg;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS farmers (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  district TEXT NOT NULL,
  epa TEXT,
  region TEXT NOT NULL,
  soil_type TEXT,
  nutrient_status TEXT,
  gender TEXT,
  date_of_birth BIGINT,
  national_id TEXT,
  village TEXT,
  marital_status TEXT,
  household_size INTEGER,
  household_type TEXT,
  livestock TEXT,
  primary_language TEXT DEFAULT 'en',
  education_level TEXT,
  years_of_experience INTEGER,
  registration_source TEXT DEFAULT 'mobile_app',
  verified INTEGER DEFAULT 0,
  verification_date BIGINT,
  status TEXT NOT NULL DEFAULT 'active',
  email TEXT,
  alternative_phone TEXT,
  photo_url TEXT,
  last_active_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT
);

CREATE TABLE IF NOT EXISTS season_events (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  stage_index INTEGER NOT NULL,
  stage_key TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  channel TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_farmer ON season_events(farmer_id, stage_index);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  org TEXT NOT NULL,
  district TEXT,
  epa TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS warehouse_receipts (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  staff_id TEXT NOT NULL REFERENCES staff(id),
  crop TEXT NOT NULL,
  weight_kg DOUBLE PRECISION NOT NULL,
  moisture_pct DOUBLE PRECISION NOT NULL,
  price_per_kg INTEGER NOT NULL,
  asset_value INTEGER NOT NULL,
  loan_cap INTEGER NOT NULL,
  loan_disbursed INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_receipts_farmer ON warehouse_receipts(farmer_id, created_at);

CREATE TABLE IF NOT EXISTS price_floors (
  crop TEXT PRIMARY KEY,
  price_per_kg INTEGER NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS offtake_contracts (
  id TEXT PRIMARY KEY,
  buyer TEXT NOT NULL,
  crop TEXT NOT NULL,
  district TEXT NOT NULL,
  price_per_kg INTEGER NOT NULL,
  floor_per_kg INTEGER NOT NULL,
  status TEXT NOT NULL,
  farmer_id TEXT REFERENCES farmers(id),
  staff_id TEXT NOT NULL REFERENCES staff(id),
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contracts_created ON offtake_contracts(created_at);

CREATE TABLE IF NOT EXISTS pest_reports (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  symptoms TEXT NOT NULL,
  match_name TEXT,
  channel TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pests_created ON pest_reports(created_at);

CREATE TABLE IF NOT EXISTS farm_plans (
  farmer_id TEXT PRIMARY KEY REFERENCES farmers(id),
  crops_json TEXT NOT NULL,
  readiness_json TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS farm_land_parcels (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  parcel_name TEXT,
  hectares DOUBLE PRECISION NOT NULL,
  tenure_type TEXT NOT NULL DEFAULT 'customary',
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  polygon_json TEXT,
  accuracy_m DOUBLE PRECISION,
  soil_type TEXT,
  topography TEXT,
  water_access TEXT DEFAULT 'rainfed_only',
  irrigation_type TEXT,
  ndvi DOUBLE PRECISION,
  last_ndvi_update BIGINT,
  title_deed_number TEXT,
  lease_expiry BIGINT,
  landlord_name TEXT,
  rental_cost_per_season INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_parcels_farmer ON farm_land_parcels(farmer_id, active);

CREATE TABLE IF NOT EXISTS parcel_crop_history (
  id TEXT PRIMARY KEY,
  parcel_id TEXT NOT NULL REFERENCES farm_land_parcels(id),
  crop TEXT NOT NULL,
  season TEXT NOT NULL,
  yield_kg DOUBLE PRECISION,
  notes TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_parcel_history ON parcel_crop_history(parcel_id, season);

CREATE TABLE IF NOT EXISTS inputs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  standard_price INTEGER NOT NULL,
  supplier TEXT,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inputs_category ON inputs(category, active);

CREATE TABLE IF NOT EXISTS farmer_vouchers (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  issued_by TEXT NOT NULL REFERENCES staff(id),
  season TEXT NOT NULL,
  status TEXT NOT NULL,
  issued_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  redeemed_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_vouchers_farmer ON farmer_vouchers(farmer_id, status);
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON farmer_vouchers(code);

CREATE TABLE IF NOT EXISTS voucher_inputs (
  id TEXT PRIMARY KEY,
  voucher_id TEXT NOT NULL REFERENCES farmer_vouchers(id),
  input_id TEXT NOT NULL REFERENCES inputs(id),
  quantity DOUBLE PRECISION NOT NULL,
  unit_price INTEGER NOT NULL,
  subsidy_rate DOUBLE PRECISION NOT NULL,
  farmer_contribution INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_voucher_inputs_voucher ON voucher_inputs(voucher_id);

CREATE TABLE IF NOT EXISTS input_redemptions (
  id TEXT PRIMARY KEY,
  voucher_id TEXT NOT NULL REFERENCES farmer_vouchers(id),
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  agro_dealer TEXT NOT NULL,
  location TEXT NOT NULL,
  district TEXT NOT NULL,
  staff_id TEXT REFERENCES staff(id),
  redeemed_at BIGINT NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_redemptions_farmer ON input_redemptions(farmer_id, redeemed_at);
CREATE INDEX IF NOT EXISTS idx_redemptions_district ON input_redemptions(district, redeemed_at);

CREATE TABLE IF NOT EXISTS redemption_inputs (
  id TEXT PRIMARY KEY,
  redemption_id TEXT NOT NULL REFERENCES input_redemptions(id),
  input_id TEXT NOT NULL REFERENCES inputs(id),
  quantity_issued DOUBLE PRECISION NOT NULL,
  batch_number TEXT,
  expiry_date BIGINT
);

CREATE INDEX IF NOT EXISTS idx_redemption_inputs_redemption ON redemption_inputs(redemption_id);

CREATE TABLE IF NOT EXISTS market_sources (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  url TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_ok_at BIGINT,
  last_error TEXT,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_commodities (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS market_locations (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id TEXT REFERENCES market_locations(id),
  region TEXT,
  district TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_market_locations_district ON market_locations(district);
CREATE INDEX IF NOT EXISTS idx_market_locations_region ON market_locations(region);

CREATE TABLE IF NOT EXISTS market_price_observations (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES market_sources(id),
  commodity_id TEXT NOT NULL REFERENCES market_commodities(id),
  location_id TEXT NOT NULL REFERENCES market_locations(id),
  buy_price_per_kg DOUBLE PRECISION,
  sell_price_per_kg DOUBLE PRECISION,
  raw_unit TEXT,
  raw_amount DOUBLE PRECISION,
  price_kind TEXT NOT NULL DEFAULT 'market',
  grade TEXT,
  notes TEXT,
  observed_at BIGINT NOT NULL,
  fetched_at BIGINT NOT NULL,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_market_obs_commodity ON market_price_observations(commodity_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_obs_location ON market_price_observations(location_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_obs_source ON market_price_observations(source_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS market_logistics_routes (
  id TEXT PRIMARY KEY,
  from_district TEXT NOT NULL,
  to_district TEXT NOT NULL,
  distance_km DOUBLE PRECISION,
  cost_per_kg DOUBLE PRECISION NOT NULL,
  cost_flat_mwk DOUBLE PRECISION,
  notes TEXT,
  updated_at BIGINT NOT NULL,
  UNIQUE(from_district, to_district)
);

CREATE INDEX IF NOT EXISTS idx_market_routes_from ON market_logistics_routes(from_district);

CREATE TABLE IF NOT EXISTS market_price_alerts (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  commodity_slug TEXT NOT NULL,
  district TEXT NOT NULL,
  location_slug TEXT,
  direction TEXT NOT NULL,
  threshold_per_kg DOUBLE PRECISION NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  last_triggered_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_market_alerts_farmer ON market_price_alerts(farmer_id, active);
CREATE INDEX IF NOT EXISTS idx_market_alerts_active ON market_price_alerts(active, commodity_slug, district);

CREATE TABLE IF NOT EXISTS market_price_alert_events (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL REFERENCES market_price_alerts(id),
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  commodity_slug TEXT NOT NULL,
  district TEXT NOT NULL,
  location_slug TEXT,
  direction TEXT NOT NULL,
  threshold_per_kg DOUBLE PRECISION NOT NULL,
  observed_price_per_kg DOUBLE PRECISION NOT NULL,
  source_slug TEXT,
  message TEXT NOT NULL,
  triggered_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_alert_events_farmer ON market_price_alert_events(farmer_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_locations_type ON market_locations(type);

CREATE TABLE IF NOT EXISTS farmer_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  district TEXT NOT NULL,
  epa TEXT,
  registration_number TEXT,
  registration_date BIGINT,
  leader_farmer_id TEXT REFERENCES farmers(id),
  status TEXT NOT NULL DEFAULT 'active',
  member_count INTEGER DEFAULT 0,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS farmer_group_members (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  group_id TEXT NOT NULL REFERENCES farmer_groups(id),
  role TEXT NOT NULL DEFAULT 'member',
  joined_at BIGINT NOT NULL,
  left_at BIGINT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_unique ON farmer_group_members(farmer_id, group_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_group_members_farmer ON farmer_group_members(farmer_id, status);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON farmer_group_members(group_id, status);

CREATE TABLE IF NOT EXISTS farmer_household_members (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  relationship TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT,
  age INTEGER,
  in_school INTEGER DEFAULT 0,
  contributes_labor INTEGER DEFAULT 0,
  has_disability INTEGER DEFAULT 0,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_household_farmer ON farmer_household_members(farmer_id);

CREATE TABLE IF NOT EXISTS farmer_assets (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  asset_type TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  condition TEXT,
  acquisition_date BIGINT,
  estimated_value INTEGER,
  notes TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_farmer ON farmer_assets(farmer_id, asset_type);

CREATE TABLE IF NOT EXISTS extension_visits (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  staff_id TEXT NOT NULL REFERENCES staff(id),
  visit_date BIGINT NOT NULL,
  visit_type TEXT NOT NULL,
  topics_covered TEXT,
  recommendations TEXT,
  farmer_feedback TEXT,
  follow_up_required INTEGER DEFAULT 0,
  follow_up_date BIGINT,
  follow_up_notes TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visits_farmer ON extension_visits(farmer_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_staff ON extension_visits(staff_id, visit_date);
`;

function toPgSql(sql) {
  return sql
    .replace(/ORDER BY (\w+)\s+COLLATE NOCASE/gi, "ORDER BY LOWER($1)")
    .replace(/(\w+)\s*=\s*\?\s+COLLATE NOCASE/gi, "LOWER($1) = LOWER(?)")
    .replace(/\bexcluded\./gi, "EXCLUDED.");
}

function compileSql(sql, params) {
  let pgSql = toPgSql(sql);

  if (params && typeof params === "object" && !Array.isArray(params)) {
    const values = [];
    const order = [];
    pgSql = pgSql.replace(/@(\w+)/g, (_, name) => {
      if (!order.includes(name)) order.push(name);
      return `$${order.indexOf(name) + 1}`;
    });
    for (const name of order) values.push(params[name]);
    return { text: pgSql, values };
  }

  const values = Array.isArray(params) ? [...params] : params === undefined ? [] : [params];
  let index = 0;
  pgSql = pgSql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
  return { text: pgSql, values };
}

function normalizeRow(row) {
  if (!row) return row;
  const out = { ...row };
  if (typeof out.n === "string" && /^\d+$/.test(out.n)) out.n = Number(out.n);
  if (typeof out.kg === "string" && /^\d+$/.test(out.kg)) out.kg = Number(out.kg);
  return out;
}

class Statement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
  }

  async get(...params) {
    const input = params.length === 1 ? params[0] : params;
    const { text, values } = compileSql(this.sql, input);
    const result = await this.db.query(text, values);
    return normalizeRow(result.rows[0]);
  }

  async all(...params) {
    const input = params.length === 1 ? params[0] : params;
    const { text, values } = compileSql(this.sql, input);
    const result = await this.db.query(text, values);
    return result.rows.map(normalizeRow);
  }

  async run(...params) {
    const input = params.length === 1 ? params[0] : params;
    const { text, values } = compileSql(this.sql, input);
    const result = await this.db.query(text, values);
    return { changes: result.rowCount ?? 0 };
  }
}

export class Database {
  constructor(clientOrPool) {
    this.client = clientOrPool;
    this.pool = clientOrPool instanceof Pool ? clientOrPool : null;
  }

  prepare(sql) {
    return new Statement(this, sql);
  }

  async query(text, values = []) {
    if (this.pool) return this.pool.query(text, values);
    return this.client.query(text, values);
  }

  async exec(sql) {
    const statements = sql
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part && !part.startsWith("PRAGMA"));
    for (const statement of statements) {
      await this.query(statement);
    }
  }

  async close() {
    if (this.pool) await this.pool.end();
    else if (this.client?.end) await this.client.end();
  }
}

async function openMemoryDatabase() {
  const { newDb } = await import("pg-mem");
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  const db = new Database(pool);
  await db.exec(SCHEMA);
  return db;
}

async function openPostgresDatabase(connectionString) {
  const pool = new Pool({ connectionString });
  const db = new Database(pool);
  await db.exec(SCHEMA);
  return db;
}

export async function openDatabase(target) {
  const memory = target === ":memory:" || process.env.PG_MEM === "1";
  if (memory) return openMemoryDatabase();

  const connectionString = process.env.DATABASE_URL || target;
  if (!connectionString || !String(connectionString).startsWith("postgres")) {
    throw new Error(
      'Set DATABASE_URL to a PostgreSQL connection string (postgres://…). Tests may use openDatabase(":memory:").'
    );
  }
  return openPostgresDatabase(connectionString);
}
