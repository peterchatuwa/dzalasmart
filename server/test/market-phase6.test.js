import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { seedMarketCatalog } from "../src/market.js";
import { parseAceHtml } from "../src/market/collectors/ace.js";
import { parseNamisCsv } from "../src/market/collectors/namis.js";
import { evaluateMarketAlerts } from "../src/market/alerts.js";
import { insertObservations } from "../src/market/store.js";
import { ensureTradingCentre } from "../src/market/locations.js";
import { seedIfEmpty } from "../src/farmers.js";

const FIXTURES = path.join(process.cwd(), "test", "fixtures");

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

test("ACE parser extracts commodity prices from BVO table rows", () => {
  const html = fs.readFileSync(path.join(FIXTURES, "ace-bvo.html"), "utf8");
  const rows = parseAceHtml(html);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].commoditySlug, "maize");
  assert.equal(rows[0].buyPricePerKg, 920);
});

test("NAMIS parser keeps recent WFP retail rows per market", () => {
  const csv = fs.readFileSync(path.join(FIXTURES, "namis-wfp-sample.csv"), "utf8");
  const rows = parseNamisCsv(csv, Date.parse("2026-09-01T00:00:00Z"));
  assert.equal(rows.length, 3);
  const lilongwe = rows.find((row) => row.market === "Lilongwe City");
  assert.ok(lilongwe);
  assert.equal(lilongwe.commoditySlug, "maize");
  assert.equal(lilongwe.buyPricePerKg, 980);
});

test("location hierarchy exposes trading centres for a district", async (t) => {
  const db = await openDatabase(":memory:");
  await seedMarketCatalog(db);
  const app = createApp(db, { jwtSecret: "test-secret" });
  const { url, close } = await listen(app);
  t.after(close);

  const payload = await fetch(`${url}/api/market/locations?district=Lilongwe`).then((r) => r.json());
  assert.ok(payload.tradingCentres.some((row) => row.name === "Lilongwe City"));
  assert.ok(payload.count >= 1);
});

test("price alerts trigger when a stored price crosses the threshold", async (t) => {
  const db = await openDatabase(":memory:");
  await seedMarketCatalog(db);
  await seedIfEmpty(db);
  const farmer = await db.prepare("SELECT * FROM farmers WHERE phone = ?").get("+265888000001");
  const locationSlug = await ensureTradingCentre(db, {
    name: "Nkhotakota Boma",
    district: "Nkhotakota",
  });
  await insertObservations(db, "namis", [
    {
      commoditySlug: "maize",
      locationSlug,
      buyPricePerKg: 1100,
      priceKind: "reference",
    },
  ]);

  const app = createApp(db, { jwtSecret: "test-secret" });
  const { url, close } = await listen(app);
  t.after(close);

  const login = await fetch(`${url}/api/farmers/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: farmer.phone, pin: "1234" }),
  }).then((r) => r.json());

  const created = await fetch(`${url}/api/market/alerts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${login.token}`,
    },
    body: JSON.stringify({
      commoditySlug: "maize",
      direction: "above",
      thresholdPerKg: 1000,
      district: farmer.district,
    }),
  });
  assert.equal(created.status, 201);

  const triggered = await evaluateMarketAlerts(db);
  assert.equal(triggered.length, 1);
  assert.match(triggered[0].message, /above/i);

  const payload = await fetch(`${url}/api/market/alerts`, {
    headers: { Authorization: `Bearer ${login.token}` },
  }).then((r) => r.json());
  assert.equal(payload.events.length, 1);
});
