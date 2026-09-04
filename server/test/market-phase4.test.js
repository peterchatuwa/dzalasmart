import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { observationsToCsv } from "../src/market/export.js";
import { parseTrendRange } from "../src/market/trends.js";
import { insertObservations } from "../src/market/store.js";
import { seedMarketCatalog } from "../src/market.js";

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

test("parseTrendRange maps 30d, 3m, and 1y", () => {
  assert.equal(parseTrendRange("30d").days, 30);
  assert.equal(parseTrendRange("3m").days, 90);
  assert.equal(parseTrendRange("1y").days, 365);
});

test("observationsToCsv renders a header and quoted notes", () => {
  const csv = observationsToCsv([{
    fetchedAt: Date.parse("2026-01-15T10:00:00.000Z"),
    commodity: "Maize",
    commoditySlug: "maize",
    district: "Lilongwe",
    market: "Lilongwe warehouse",
    source: "LocalBuyEx",
    sourceSlug: "localbuy",
    priceKind: "market",
    buyPricePerKg: 900,
    sellPricePerKg: 1000,
    grade: "A",
    notes: "note, with comma",
  }]);
  assert.match(csv, /^observed_at,commodity,/);
  assert.match(csv, /"note, with comma"/);
});

test("market trends API returns chart-ready series", async (t) => {
  const db = await openDatabase(":memory:");
  await seedMarketCatalog(db);
  const now = Date.now();
  await insertObservations(db, "manual", [
    {
      commoditySlug: "maize",
      locationSlug: "lilongwe",
      buyPricePerKg: 900,
      observedAt: now - 5 * 86_400_000,
    },
    {
      commoditySlug: "maize",
      locationSlug: "lilongwe",
      buyPricePerKg: 950,
      observedAt: now - 2 * 86_400_000,
    },
    {
      commoditySlug: "maize",
      locationSlug: "lilongwe",
      buyPricePerKg: 980,
      observedAt: now,
    },
  ]);
  const app = createApp(db, { jwtSecret: "test-secret" });
  const { url, close } = await listen(app);
  t.after(close);

  const payload = await fetch(`${url}/api/market/trends?commodity=maize&district=Lilongwe&range=30d`)
    .then((r) => r.json());
  assert.equal(payload.commoditySlug, "maize");
  assert.ok(payload.series.length >= 1);
  assert.ok(payload.labels.length >= 1);
  assert.equal(payload.stats.lastBuy, 980);
});

test("market export API returns CSV attachment", async (t) => {
  const db = await openDatabase(":memory:");
  await seedMarketCatalog(db);
  await insertObservations(db, "manual", [{
    commoditySlug: "maize",
    locationSlug: "kasungu",
    buyPricePerKg: 1050,
    priceKind: "market",
  }]);
  const app = createApp(db, { jwtSecret: "test-secret" });
  const { url, close } = await listen(app);
  t.after(close);

  const res = await fetch(`${url}/api/market/export?commodity=maize&district=Kasungu&range=30d`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /text\/csv/);
  const csv = await res.text();
  assert.match(csv, /^observed_at,commodity,/);
  assert.match(csv, /Maize/);
  assert.match(csv, /Kasungu/);
});
