import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

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
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS season_events (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  stage_index INTEGER NOT NULL,
  stage_key TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  channel TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_farmer ON season_events(farmer_id, stage_index);

CREATE TABLE IF NOT EXISTS warehouse_receipts (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  staff_id TEXT NOT NULL REFERENCES staff(id),
  crop TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  moisture_pct REAL NOT NULL,
  price_per_kg INTEGER NOT NULL,
  asset_value INTEGER NOT NULL,
  loan_cap INTEGER NOT NULL,
  loan_disbursed INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_receipts_farmer ON warehouse_receipts(farmer_id, created_at);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  org TEXT NOT NULL,
  district TEXT,
  epa TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS price_floors (
  crop TEXT PRIMARY KEY,
  price_per_kg INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
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
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contracts_created ON offtake_contracts(created_at);

CREATE TABLE IF NOT EXISTS pest_reports (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  symptoms TEXT NOT NULL,
  match_name TEXT,
  channel TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pests_created ON pest_reports(created_at);

CREATE TABLE IF NOT EXISTS farm_plans (
  farmer_id TEXT PRIMARY KEY REFERENCES farmers(id),
  crops_json TEXT NOT NULL,
  readiness_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS farm_plots (
  farmer_id TEXT PRIMARY KEY REFERENCES farmers(id),
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  hectares REAL NOT NULL,
  polygon_json TEXT NOT NULL,
  source TEXT NOT NULL,
  accuracy_m REAL,
  ndvi REAL NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

export function openDatabase(databasePath) {
  if (databasePath && databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  const db = new DatabaseSync(databasePath || ":memory:");
  db.exec(SCHEMA);
  return db;
}
