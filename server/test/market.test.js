import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { seedIfEmpty } from "../src/farmers.js";
import {
  getMarketPrice,
  parseUlimiHtml,
  resetMarketCacheForTests,
  setMarketCacheForTests,
} from "../src/market.js";
import { computeBudget } from "../src/plan.js";
import { seedFloorsIfEmpty } from "../src/floors.js";

const SAMPLE_HTML = `
<div id="ticker">
  <div><span class="opacity-70">Maize</span><span class="font-medium">MWK 900/kg</span><span class="text-xs text-green-600">▲ 2.4%</span></div>
  <div><span class="opacity-70">Ground Nuts</span><span class="font-medium">MWK 2300/kg</span><span class="text-xs text-red-600">▼ 0.8%</span></div>
  <div><span class="opacity-70">Soya</span><span class="font-medium">MWK 800/kg</span><span class="text-xs text-green-600">▲ 1.1%</span></div>
  <div><span class="opacity-70">Pigeon Peas</span><span class="font-medium">MWK 1500/kg</span><span class="text-xs text-green-600">▲ 0.6%</span></div>
  <div><span class="opacity-70">Maize</span><span class="font-medium">MWK 900/kg</span><span class="text-xs text-green-600">▲ 2.4%</span></div>
</div>`;

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

test("parseUlimiHtml extracts ticker prices and trends", () => {
  const parsed = parseUlimiHtml(SAMPLE_HTML);
  assert.equal(parsed.byCommodity.get("Maize").length, 2);
  assert.equal(parsed.byCommodity.get("Groundnuts")[0], 2300);
  assert.equal(parsed.byCommodity.get("Soya beans")[0], 800);
  assert.equal(parsed.trends.get("Maize").trend, "up");
  assert.match(parsed.trends.get("Groundnuts").trendLabel, /0\.8/);
});

test("getMarketPrice reads from the in-memory Ulimi cache", () => {
  resetMarketCacheForTests();
  setMarketCacheForTests({
    byCommodity: new Map([
      ["Maize", [900]],
      ["Groundnuts", [2300]],
    ]),
  });
  assert.equal(getMarketPrice("Maize"), 900);
  assert.equal(getMarketPrice("Groundnuts"), 2300);
});

test("computeBudget uses cached Ulimi prices when available", () => {
  resetMarketCacheForTests();
  const db = openDatabase(":memory:");
  seedFloorsIfEmpty(db);
  setMarketCacheForTests({ byCommodity: new Map([["Maize", [880]]]) });
  const budget = computeBudget("Maize", 1, db);
  assert.equal(budget.priceMwkKg, 880);
  assert.equal(budget.marketPrice, 880);
});

test("GET /api/market returns rows and source metadata", async (t) => {
  resetMarketCacheForTests();
  setMarketCacheForTests({
    rows: [{ crop: "Groundnuts", price: "MWK 2,300/kg", trend: "down", trendLabel: "↘ -0.8%", yieldKg: "1,200 kg", net: "MWK 2,760,000/ha" }],
    byCommodity: new Map([["Groundnuts", [2300]]]),
  });
  const db = openDatabase(":memory:");
  seedIfEmpty(db);
  const { url, close } = await listen(createApp(db, { jwtSecret: "test-secret" }));
  t.after(close);

  const payload = await fetch(`${url}/api/market`).then((res) => res.json());
  assert.ok(payload.rows.length >= 1);
  assert.match(payload.source, /Ulimi|NAMIS|Test market feed/);
});
