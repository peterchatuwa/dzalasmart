import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { openDatabase } from "./db.js";
import { seedIfEmpty } from "./farmers.js";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, "..", ".env") });

const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || "local-dev-secret";
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(here, "..", process.env.DATABASE_PATH)
  : path.join(here, "..", "data", "dzalasmart.db");

const db = openDatabase(databasePath);
const seeded = seedIfEmpty(db);
const app = createApp(db, { jwtSecret });

app.listen(port, () => {
  console.log(`DzalaSmart API listening on http://localhost:${port}`);
  console.log(`Database: ${databasePath}`);
  if (seeded) {
    console.log("Seeded demo farmers (PIN 1234):");
    console.log("  Grace Banda   +265888000001  — season at Harvest");
    console.log("  Joseph Kaunda +265888000002  — season at Land Preparation");
    console.log("  Estere Mvula  +265888000003  — season not started");
  }
  if (!process.env.JWT_SECRET) {
    console.log("JWT_SECRET is using the local default. Set it in server/.env before deploying.");
  }
});
