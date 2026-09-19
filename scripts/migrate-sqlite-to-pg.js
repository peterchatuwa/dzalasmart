#!/usr/bin/env node
/**
 * One-off migration from legacy SQLite (server/data/dzalasmart.db) to PostgreSQL.
 *
 * Usage:
 *   DATABASE_URL=postgres://user:pass@localhost:5432/nzeru node scripts/migrate-sqlite-to-pg.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { openDatabase } from "../server/src/db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlitePath = path.join(here, "..", "server", "data", "dzalasmart.db");
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Set DATABASE_URL to your PostgreSQL connection string.");
  process.exit(1);
}

if (!fs.existsSync(sqlitePath)) {
  console.error(`SQLite file not found: ${sqlitePath}`);
  process.exit(1);
}

const sqlite = new DatabaseSync(sqlitePath);

const tables = [
  "farmers",
  "season_events",
  "staff",
  "warehouse_receipts",
  "price_floors",
  "offtake_contracts",
  "pest_reports",
  "farm_plans",
  "farm_plots",
];

const pgDb = await openDatabase(connectionString);
const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query("BEGIN");
  for (const table of tables) {
    const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
    if (!rows.length) {
      console.log(`${table}: (empty)`);
      continue;
    }
    await client.query(`DELETE FROM ${table}`);
    const cols = Object.keys(rows[0]);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const insert = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
    for (const row of rows) {
      await client.query(
        insert,
        cols.map((col) => row[col])
      );
    }
    console.log(`${table}: migrated ${rows.length} row(s)`);
  }
  await client.query("COMMIT");
  console.log("Migration complete.");
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Migration failed:", error.message);
  process.exit(1);
} finally {
  await client.end();
  await pgDb.close();
}
