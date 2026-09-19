-- Add tables for Farmer App endpoints
-- Run this with: node server/src/migrate.js add-farmer-app-tables.sql

-- Market Prices table
CREATE TABLE IF NOT EXISTS market_prices (
  id TEXT PRIMARY KEY,
  crop TEXT NOT NULL,
  price REAL NOT NULL,
  district TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_market_prices_district ON market_prices(district);
CREATE INDEX IF NOT EXISTS idx_market_prices_crop ON market_prices(crop);

-- Price Floors table
CREATE TABLE IF NOT EXISTS price_floors (
  id TEXT PRIMARY KEY,
  crop TEXT NOT NULL,
  floor_price REAL NOT NULL,
  season TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_price_floors_season ON price_floors(season);

-- Advisor Queries table (for logging farmer questions)
CREATE TABLE IF NOT EXISTS advisor_queries (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_advisor_queries_farmer ON advisor_queries(farmer_id);
CREATE INDEX IF NOT EXISTS idx_advisor_queries_created ON advisor_queries(created_at);

-- Insert some sample market prices for testing
INSERT OR IGNORE INTO market_prices (id, crop, price, district, recorded_at) VALUES
  ('mp-1', 'Maize', 180, 'Lilongwe', datetime('now')),
  ('mp-2', 'Maize', 175, 'Kasungu', datetime('now')),
  ('mp-3', 'Maize', 185, 'Mzimba', datetime('now')),
  ('mp-4', 'Maize', 170, 'Nkhotakota', datetime('now')),
  ('mp-5', 'Soya', 350, 'Lilongwe', datetime('now')),
  ('mp-6', 'Soya', 340, 'Kasungu', datetime('now')),
  ('mp-7', 'Soya', 360, 'Mzimba', datetime('now')),
  ('mp-8', 'Groundnuts', 280, 'Lilongwe', datetime('now')),
  ('mp-9', 'Groundnuts', 270, 'Kasungu', datetime('now')),
  ('mp-10', 'Tobacco', 450, 'Kasungu', datetime('now'));

-- Insert government floor prices
INSERT OR IGNORE INTO price_floors (id, crop, floor_price, season) VALUES
  ('pf-1', 'Maize', 150, '2025-2026'),
  ('pf-2', 'Soya', 300, '2025-2026'),
  ('pf-3', 'Groundnuts', 250, '2025-2026'),
  ('pf-4', 'Tobacco', 400, '2025-2026');
