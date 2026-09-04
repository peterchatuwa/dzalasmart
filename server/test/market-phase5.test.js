import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { seedMarketCatalog } from "../src/market.js";
import { parseLocalBuyHtml } from "../src/market/collectors/localbuy.js";
import { insertObservations } from "../src/market/store.js";
import { upsertLogisticsRoute } from "../src/market/logistics.js";

const SAMPLE_HTML = `
<table><tbody>
<tr>
  <td>WH</td><td><a title="Maize">Maize</a></td><td>A</td>
  <td>980.00</td><td>1100.00</td><td>Lilongwe</td>
</tr>
<tr>
  <td>WH</td><td><a title="Maize">Maize</a></td><td>A</td>
  <td>1,050.00</td><td>1,200.00</td><td>Kasungu</td>
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

test("logistics routes subtract haulage from opportunity margin", async (t) => {
  const db = await openDatabase(":memory:");
  await seedMarketCatalog(db);
  const catalog = parseLocalBuyHtml(SAMPLE_HTML).catalog;
  await insertObservations(db, "localbuy", catalog.map((row) => ({
    commoditySlug: row.commoditySlug,
    locationSlug: `warehouse-${row.hub.toLowerCase()}`,
    buyPricePerKg: row.buyPricePerKg,
    sellPricePerKg: row.sellPricePerKg,
    grade: row.grade,
  })));
  await upsertLogisticsRoute(db, {
    fromDistrict: "Lilongwe",
    toDistrict: "Kasungu",
    costPerKg: 200,
    distanceKm: 105,
  });

  const app = createApp(db, { jwtSecret: "test-secret" });
  const { url, close } = await listen(app);
  t.after(close);

  const opps = await fetch(`${url}/api/market/opportunities?commodity=maize`).then((r) => r.json());
  const lilongweToKasungu = opps.opportunities.find((row) =>
    row.fromDistrict === "Lilongwe" && row.toDistrict === "Kasungu");
  assert.ok(lilongweToKasungu);
  assert.equal(lilongweToKasungu.grossSpreadPerKg, 220);
  assert.equal(lilongweToKasungu.transportPerKg, 200);
  assert.equal(lilongweToKasungu.netMarginPerKg, 20);
  assert.equal(lilongweToKasungu.profitable, true);

  const kasunguToLilongwe = opps.opportunities.find((row) =>
    row.fromDistrict === "Kasungu" && row.toDistrict === "Lilongwe");
  assert.ok(kasunguToLilongwe);
  assert.equal(kasunguToLilongwe.grossSpreadPerKg, 50);
  assert.ok(kasunguToLilongwe.transportPerKg > 0);
  assert.equal(kasunguToLilongwe.netMarginPerKg, 50 - kasunguToLilongwe.transportPerKg);
});

test("ministry can save a logistics route", async (t) => {
  const db = await openDatabase(":memory:");
  await seedMarketCatalog(db);
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

  const saved = await fetch(`${url}/api/staff/market/routes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${login.token}`,
    },
    body: JSON.stringify({
      fromDistrict: "Mchinji",
      toDistrict: "Lilongwe",
      costPerKg: 40,
      distanceKm: 35,
    }),
  });
  assert.equal(saved.status, 201);

  const routes = await fetch(`${url}/api/market/logistics/routes`).then((r) => r.json());
  assert.ok(routes.routes.some((row) =>
    row.fromDistrict === "Mchinji" && row.toDistrict === "Lilongwe" && row.costPerKg === 40));
});
