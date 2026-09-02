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
`;

export function openDatabase(databasePath) {
  if (databasePath && databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  const db = new DatabaseSync(databasePath || ":memory:");
  db.exec(SCHEMA);
  return db;
}
