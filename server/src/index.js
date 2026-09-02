import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { openDatabase } from "./db.js";
import { seedIfEmpty } from "./farmers.js";
import { seedStaffIfEmpty } from "./staff.js";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, "..", ".env") });

const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || "local-dev-secret";
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(here, "..", process.env.DATABASE_PATH)
  : path.join(here, "..", "data", "dzalasmart.db");

const db = openDatabase(databasePath);
const seeded = seedIfEmpty(db);
const staffSeeded = seedStaffIfEmpty(db);
const frontendDir = path.join(here, "..", "..", "frontend");
const app = createApp(db, { jwtSecret, frontendDir });

app.listen(port, "0.0.0.0", () => {
  console.log(`DzalaSmart app: http://localhost:${port}`);
  console.log(`Staff desk:     http://localhost:${port}/staff`);
  console.log(`API health:     http://localhost:${port}/health`);
  console.log("Listening on all interfaces so an Android emulator can use http://10.0.2.2:4000");
  console.log(`Database: ${databasePath}`);
  if (staffSeeded) {
    console.log("Seeded demo staff (PIN 1234):");
    console.log("  Mercy Chirwa  +265888000101  — Extension, Zidyana EPA");
    console.log("  Joseph Phiri  +265888000102  — Cooperative, Kasungu warehouse");
  }
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
