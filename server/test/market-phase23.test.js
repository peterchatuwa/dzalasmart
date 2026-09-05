import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { seedIfEmpty } from "../src/farmers.js";
import { parseMarketCsv } from "../src/market/import.js";
import { insertObservations } from "../src/market/store.js";
import { seedMarketCatalog } from "../src/market.js";
import { parseLocalBuyHtml } from "../src/market/collectors/localbuy.js";

const SAMPLE_HTML = `
<table><tbody>
<tr>
  <td>WH</td><td><a title="Maize">Maize</a></td><td>A</td>
  <td>1,050.00</td><td>1,150.00</td><td>Kasungu</td>
</tr>
<tr>
  <td>WH</td><td><a title="Maize">Maize</a></td><td>A</td>
  <td>980.00</td><td>1,080.00</td><td>Lilongwe</td>
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

test("parseMarketCsv imports ADMARC-style procurement rows", () => {
  const rows = parseMarketCsv(`commodity,district,buy_price_per_kg,price_kind
Maize,Lilongwe,450,procurement
Groundnuts,Kasungu,1200,procurement`);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].commoditySlug, "maize");
  assert.equal(rows[0].buyPricePerKg, 450);
  assert.equal(rows[0].priceKind, "procurement");
  assert.equal(rows[1].priceKind, "procurement");
});

test("parseMarketCsv leaves price kind empty when column is missing", () => {
  const rows = parseMarketCsv(`commodity,district,buy_price_per_kg
Maize,Lilongwe,450`);
  assert.equal(rows[0].priceKind, null);
});

test("staff can import ADMARC CSV prices", async (t) => {
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

  const imported = await fetch(`${url}/api/staff/market/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${login.token}`,
    },
    body: JSON.stringify({
      sourceSlug: "admarc",
      priceKind: "procurement",
      csv: "commodity,district,buy_price_per_kg\nMaize,Lilongwe,460",
    }),
  });
  assert.equal(imported.status, 201);

  const sources = await fetch(`${url}/api/market/sources/compare?commodity=maize&district=Lilongwe`).then((r) =>
    r.json()
  );
  assert.ok(sources.sources.some((row) => row.sourceSlug === "admarc" && row.priceKind === "procurement"));
});

test("market compare API highlights warehouse spreads", async (t) => {
  const db = await openDatabase(":memory:");
  await seedMarketCatalog(db);
  const catalog = parseLocalBuyHtml(SAMPLE_HTML).catalog;
  await insertObservations(
    db,
    "localbuy",
    catalog.map((row) => ({
      commoditySlug: row.commoditySlug,
      locationSlug: `warehouse-${row.hub.toLowerCase()}`,
      buyPricePerKg: row.buyPricePerKg,
      sellPricePerKg: row.sellPricePerKg,
      grade: row.grade,
    }))
  );
  const app = createApp(db, { jwtSecret: "test-secret" });
  const { url, close } = await listen(app);
  t.after(close);

  const compare = await fetch(`${url}/api/market/compare?commodity=maize`).then((r) => r.json());
  assert.equal(compare.commoditySlug, "maize");
  assert.ok(compare.districts.length >= 2);
  assert.ok(compare.stats.spread >= 70);

  const opps = await fetch(`${url}/api/market/opportunities?commodity=maize`).then((r) => r.json());
  assert.ok(opps.opportunities.length >= 1);
  assert.ok(opps.opportunities[0].spreadPerKg >= 70);
});

test("manual ADMARC entry is tagged procurement", async (t) => {
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
      district: "Kasungu",
      sourceSlug: "nfra",
      priceKind: "procurement",
      buyPricePerKg: 470,
    }),
  });
  assert.equal(saved.status, 201);

  const prices = await fetch(`${url}/api/market/prices?district=Kasungu&commodity=maize`).then((r) => r.json());
  assert.ok(prices.prices.some((row) => row.sourceSlug === "nfra" && row.priceKind === "procurement"));
});
