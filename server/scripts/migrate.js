#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../src/db.js";
import { config } from "../src/config.js";
import { logger } from "../src/logger.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");

async function ensureMigrationsTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at BIGINT NOT NULL
    )
  `);
}

async function getAppliedMigrations(db) {
  const result = await db.query("SELECT version FROM schema_migrations ORDER BY version");
  return new Set(result.rows.map((row) => row.version));
}

async function applyMigration(db, filename) {
  const version = filename.replace(/\.js$/, "");
  const migrationPath = join(migrationsDir, filename);
  
  logger.info(`Applying migration: ${version}`);
  
  try {
    const migration = await import(migrationPath);
    
    if (typeof migration.up !== "function") {
      throw new Error(`Migration ${version} does not export an 'up' function`);
    }
    
    await migration.up(db);
    await db.query("INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)", [
      version,
      Date.now(),
    ]);
    
    logger.info(`✓ Applied migration: ${version}`);
  } catch (error) {
    logger.error({ err: error }, `✗ Failed to apply migration: ${version}`);
    throw error;
  }
}

async function main() {
  const db = await openDatabase(config.databaseUrl);
  
  try {
    await ensureMigrationsTable(db);
    
    const applied = await getAppliedMigrations(db);
    const files = await readdir(migrationsDir);
    const migrationFiles = files
      .filter((f) => f.endsWith(".js") && !f.startsWith("_"))
      .sort();
    
    const pending = migrationFiles.filter((f) => {
      const version = f.replace(/\.js$/, "");
      return !applied.has(version);
    });
    
    if (pending.length === 0) {
      logger.info("No pending migrations");
      return;
    }
    
    logger.info(`Found ${pending.length} pending migration(s)`);
    
    for (const file of pending) {
      await applyMigration(db, file);
    }
    
    logger.info("All migrations applied successfully");
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  logger.error({ err: error }, "Migration failed");
  process.exit(1);
});
