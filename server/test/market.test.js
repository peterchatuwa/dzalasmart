import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { seedIfEmpty } from "../src/farmers.js";
import {
  getMarketPrice,
  nearestWarehouseHub,
  parseLocalBuyHtml,
  resetMarketCacheForTests,
  setMarketCacheForTests,
} from "../src/market.js";
import { computeBudget } from "../src/plan.js";
import { seedFloorsIfEmpty } from "../src/floors.js";

const SAMPLE_HTML = `
<marquee>
  <span class="mx-3">WH 1,050.00 : <span class="text-muted"> 0.00</span></span> |
  <span class="mx-3">SB 1,200.00 : <span class="text-success">&#9650; 300.00</span></span> |
  <span class="mx-3">BN 2,300.00 : <span class="text-success">&#9650; 1,100.00</span></span>
</marquee>
<table><tbody>
<tr>
  <td>WH</td>
  <td><a href="#" title="Maize">Maize</a></td>
  <td>A</td>
  <td>1,050.00</td>
  <td>1,050.00</td>
  <td>Kasungu</td>
</tr>
<tr>
  <td>SB</td>
  <td><a href="#" title="Soya Beans">Soya Beans</a></td>
  <td>A</td>
  <td>1,200.00</td>
  <td>1,500.00</td>
  <td>Lilongwe</td>
</tr>
<tr>
  <td>BN</td>
  <td><a href="#" title="Beans">Beans</a></td>
  <td>B</td>
  <td>2,300.00</td>
  <td>3,400.00</td>
  <td>Mchinji</td>
</tr>
</tbody></table>`;

const SAMPLE_CATALOG = parseLocalBuyHtml(SAMPLE_HTML).catalog;

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

test("parseLocalBuyHtml extracts warehouse buying prices and ticker moves", () => {
  const parsed = parseLocalBuyHtml(SAMPLE_HTML);
  assert.equal(parsed.catalog.length, 3);
  assert.equal(parsed.catalog[0].buyPricePerKg, 1050);
  assert.equal(parsed.catalog[1].hub, "Lilongwe");
  assert.equal(parsed.trendByCode.get("SB").trend, "up");
});

test("nearestWarehouseHub picks Kasungu for Nkhotakota farmers", () => {
  assert.equal(nearestWarehouseHub("Nkhotakota"), "Kasungu");
  assert.equal(nearestWarehouseHub("Lilongwe"), "Lilongwe");
  assert.equal(nearestWarehouseHub("Mchinji"), "Mchinji");
});

test("getMarketPrice is scoped to the farmer district warehouse", () => {
  resetMarketCacheForTests();
  setMarketCacheForTests({ catalog: SAMPLE_CATALOG, trendByCode: new Map() });
  assert.equal(getMarketPrice("Maize", "Nkhotakota"), 1050);
  assert.equal(getMarketPrice("Soybeans", "Nkhotakota"), null);
  assert.equal(getMarketPrice("Soybeans", "Lilongwe"), 1200);
});

test("computeBudget uses district-scoped LocalBuyEx prices", async () => {
  resetMarketCacheForTests();
  const db = await openDatabase(":memory:");
  await seedFloorsIfEmpty(db);
  setMarketCacheForTests({ catalog: SAMPLE_CATALOG, trendByCode: new Map() });
  const budget = await computeBudget("Maize", 1, db, "Kasungu");
  assert.equal(budget.priceMwkKg, 1050);
  assert.equal(budget.marketPrice, 1050);
});

test("GET /api/market scopes rows to the requested district", async (t) => {
  resetMarketCacheForTests();
  setMarketCacheForTests({ catalog: SAMPLE_CATALOG, trendByCode: new Map() });
  const db = await openDatabase(":memory:");
  await seedIfEmpty(db);
  const { url, close } = await listen(createApp(db, { jwtSecret: "test-secret" }));
  t.after(close);

  const payload = await fetch(`${url}/api/market?district=Nkhotakota`).then((res) => res.json());
  assert.equal(payload.warehouseHub, "Kasungu");
  assert.equal(payload.rows.length, 1);
  assert.equal(payload.rows[0].crop, "Maize");
  assert.match(payload.source, /LocalBuyEx|NAMIS|Test market feed/);
});
