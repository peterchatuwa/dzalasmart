import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { APP_NAME } from "./brand.js";
import { createApp } from "./app.js";
import { openDatabase } from "./db.js";
import { seedIfEmpty } from "./farmers.js";
import { seedContractsIfEmpty, seedFloorsIfEmpty } from "./floors.js";
import { seedStaffIfEmpty, staffIdByRole } from "./staff.js";
import { seedMarketCatalog } from "./market.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const port = config.port;
const jwtSecret = config.jwtSecret;

async function main() {
  const db = await openDatabase(config.databaseUrl);
  await seedMarketCatalog(db);
  const seeded = await seedIfEmpty(db);
  const staffSeeded = await seedStaffIfEmpty(db);
  await seedFloorsIfEmpty(db);
  await seedContractsIfEmpty(db, await staffIdByRole(db, "cooperative"));
  const frontendDir = path.join(here, "..", "..", "frontend");
  const app = createApp(db, { jwtSecret, frontendDir });

  app.listen(port, "0.0.0.0", () => {
    logger.info(`${APP_NAME} server started`);
    logger.info(`Farmer app: http://localhost:${port}`);
    logger.info(`Staff desk: http://localhost:${port}/staff`);
    logger.info(`API health: http://localhost:${port}/health`);
    logger.info("Listening on all interfaces (Android emulator: http://10.0.2.2:4000)");
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Database: ${config.databaseUrl === ":memory:" ? "in-memory (pg-mem)" : "PostgreSQL"}`);

    if (staffSeeded) {
      logger.info("Seeded demo staff (PIN 1234):");
      logger.info("  Mercy Chirwa  +265888000101  — Extension, Zidyana EPA");
      logger.info("  Joseph Phiri  +265888000102  — Cooperative, Kasungu warehouse");
      logger.info("  Chikondi Moyo +265888000103  — Ministry of Agriculture");
      logger.info("  Davis Mwale   +265888000104  — Farmers Union of Malawi");
    }
    if (seeded) {
      logger.info("Seeded demo farmers (PIN 1234):");
      logger.info("  Grace Banda   +265888000001  — season at Harvest");
      logger.info("  Joseph Kaunda +265888000002  — season at Land Preparation");
      logger.info("  Estere Mvula  +265888000003  — season not started");
    }
  });
}

main().catch((error) => {
  logger.error({ err: error }, "Fatal error during startup");
  process.exit(1);
});
