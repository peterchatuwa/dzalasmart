import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { seedIfEmpty } from "../src/farmers.js";
import { computeBudget, plantingWindowStatus, suggestCrops } from "../src/plan.js";
import { seedFloorsIfEmpty } from "../src/floors.js";
import { resetMarketCacheForTests, setMarketCacheForTests } from "../src/market.js";

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

async function json(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await res.json();
  return { res, body };
}

function setup() {
  const db = openDatabase(":memory:");
  seedIfEmpty(db);
  seedFloorsIfEmpty(db);
  return createApp(db, { jwtSecret: "test-secret" });
}

test("computeBudget uses live market prices and flags prices below the ministry floor", () => {
  resetMarketCacheForTests();
  const db = openDatabase(":memory:");
  seedFloorsIfEmpty(db);
  setMarketCacheForTests({ byCommodity: new Map([["Maize", [1050]]]) });
  const budget = computeBudget("Maize", 1, db);
  assert.equal(budget.priceMwkKg, 1050);
  assert.equal(budget.profitable, true);
  assert.equal(budget.belowFloor, false);
});

test("suggestCrops ranks groundnuts on sandy low-nitrogen soils", () => {
  const picks = suggestCrops({ soilType: "Sandy loam", nutrientStatus: "Low nitrogen" });
  assert.ok(picks[0].crop === "Groundnuts" || picks[1]?.crop === "Groundnuts");
});

test("planting window flags a summer vegetable planted in December as late for onions", () => {
  const status = plantingWindowStatus("Onions", 12);
  assert.equal(status.status, "late");
});

test("farmer plan persists and returns bankability plus cashflow tabs", async (t) => {
  const { url, close } = await listen(setup());
  t.after(close);

  const login = await json(`${url}/api/farmers/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000001", pin: "1234" }),
  });
  const saved = await json(`${url}/api/farmers/me/plan`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${login.body.token}` },
    body: JSON.stringify({
      crops: [{ crop: "Maize", hectares: 1.2, startMonth: "11" }],
      readiness: {
        waterSource: "Irrigation scheme",
        landTenure: "Title deed / freehold",
        experience: "10+ seasons",
        storage: true,
        equipment: true,
        agritex: true,
        ownTransport: true,
        bulkBuy: true,
      },
    }),
  });
  assert.equal(saved.res.status, 200);
  assert.ok(saved.body.combined.totalMargin > 0);
  assert.ok(saved.body.bankability.score >= 70);
  assert.equal(saved.body.crops[0].crop, "Maize");

  const loaded = await json(`${url}/api/farmers/me/plan`, {
    headers: { Authorization: `Bearer ${login.body.token}` },
  });
  assert.equal(loaded.body.crops[0].hectares, 1.2);
  assert.ok(Array.isArray(loaded.body.tabs.cashflow));
  assert.ok(loaded.body.weatherNote);
});
