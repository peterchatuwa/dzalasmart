import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { seedIfEmpty } from "../src/farmers.js";
import { insertObservations } from "../src/market/store.js";
import { seedMarketCatalog } from "../src/market.js";
import { parseLocalBuyHtml } from "../src/market/collectors/localbuy.js";

const SAMPLE_HTML = `
<table><tbody>
<tr>
  <td>WH</td><td><a title="Maize">Maize</a></td><td>A</td>
  <td>1,050.00</td><td>1,150.00</td><td>Kasungu</td>
</tr>
</tbody></table>`;

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

test("market prices API returns persisted multi-source rows", async (t) => {
  const db = await openDatabase(":memory:");
  await seedMarketCatalog(db);
  const catalog = parseLocalBuyHtml(SAMPLE_HTML).catalog;
  await insertObservations(db, "localbuy", catalog.map((row) => ({
    commoditySlug: row.commoditySlug,
    locationSlug: `warehouse-kasungu`,
    buyPricePerKg: row.buyPricePerKg,
    sellPricePerKg: row.sellPricePerKg,
    grade: row.grade,
  })));
  const app = createApp(db, { jwtSecret: "test-secret" });
  const { url, close } = await listen(app);
  t.after(close);

  const payload = await fetch(`${url}/api/market/prices?district=Kasungu`).then((r) => r.json());
  assert.ok(payload.prices.length >= 1);
  assert.equal(payload.prices[0].crop, "Maize");
  assert.equal(payload.prices[0].buyPricePerKg, 1050);
  assert.ok(payload.sources.some((row) => row.slug === "localbuy"));
});

test("market history API returns stored observations", async (t) => {
  const db = await openDatabase(":memory:");
  await seedMarketCatalog(db);
  const now = Date.now();
  await insertObservations(db, "manual", [{
    commoditySlug: "maize",
    locationSlug: "kasungu",
    buyPricePerKg: 900,
    sellPricePerKg: 1000,
    priceKind: "market",
    observedAt: now - 86_400_000,
  }]);
  await insertObservations(db, "manual", [{
    commoditySlug: "maize",
    locationSlug: "kasungu",
    buyPricePerKg: 950,
    sellPricePerKg: 1050,
    priceKind: "market",
    observedAt: now,
  }]);
  const app = createApp(db, { jwtSecret: "test-secret" });
  const { url, close } = await listen(app);
  t.after(close);

  const payload = await fetch(`${url}/api/market/history?commodity=maize&district=Kasungu&days=30`)
    .then((r) => r.json());
  assert.equal(payload.points.length, 2);
  assert.equal(payload.points[0].buyPricePerKg, 900);
  assert.equal(payload.points[1].buyPricePerKg, 950);
});

test("staff can enter a manual market price", async (t) => {
  const db = await openDatabase(":memory:");
  await seedMarketCatalog(db);
  await seedIfEmpty(db);
  const { seedStaffIfEmpty } = await import("../src/staff.js");
  await seedStaffIfEmpty(db);
  const app = createApp(db, { jwtSecret: "test-secret" });
  const { url, close } = await listen(app);
  t.after(close);

  const login = await fetch(`${url}/api/staff/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+265888000103", pin: "1234" }),
  }).then((r) => r.json());

  const saved = await fetch(`${url}/api/staff/market/observations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${login.token}`,
    },
    body: JSON.stringify({
      crop: "Maize",
      district: "Lilongwe",
      buyPricePerKg: 920,
      sellPricePerKg: 1100,
      notes: "Manual test entry",
    }),
  });
  assert.equal(saved.status, 201);

  const prices = await fetch(`${url}/api/market/prices?district=Lilongwe`).then((r) => r.json());
  assert.ok(prices.prices.some((row) => row.sourceSlug === "manual" && row.buyPricePerKg === 920));
});
