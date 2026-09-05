#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");

function timestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}${second}`;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

async function main() {
  const name = process.argv.slice(2).join(" ").trim();

  if (!name) {
    console.error("Usage: npm run migrate:create -- migration_name");
    process.exit(1);
  }

  const slug = slugify(name);
  const version = `${timestamp()}_${slug}`;
  const filename = `${version}.js`;
  const filepath = join(migrationsDir, filename);

  const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

export async function up(db) {
  // Add your migration code here
  await db.query(\`
    -- Your SQL here
  \`);
}

export async function down(db) {
  // Add your rollback code here
  await db.query(\`
    -- Your rollback SQL here
  \`);
}
`;

  await writeFile(filepath, template, "utf-8");
  console.log(`Created migration: ${filename}`);
  console.log(`Edit: server/migrations/${filename}`);
}

main().catch((error) => {
  console.error("Failed to create migration:", error);
  process.exit(1);
});
