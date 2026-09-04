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
  created_at BIGINT NOT NULL
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

CREATE TABLE IF NOT EXISTS farm_plots (
  farmer_id TEXT PRIMARY KEY REFERENCES farmers(id),
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  hectares DOUBLE PRECISION NOT NULL,
  polygon_json TEXT NOT NULL,
  source TEXT NOT NULL,
  accuracy_m DOUBLE PRECISION,
  ndvi DOUBLE PRECISION NOT NULL,
  updated_at BIGINT NOT NULL
);

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

  const values = Array.isArray(params)
    ? [...params]
    : params === undefined
      ? []
      : [params];
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
      "Set DATABASE_URL to a PostgreSQL connection string (postgres://…). Tests may use openDatabase(\":memory:\")."
    );
  }
  return openPostgresDatabase(connectionString);
}
