import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { seedIfEmpty } from "../src/farmers.js";
import { buildPolygon, estimateCentroid, getFarmerPlot, saveFarmerPlot } from "../src/plots.js";
import { saveFarmPlan } from "../src/plan.js";
import { seedStaffIfEmpty } from "../src/staff.js";

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
  seedStaffIfEmpty(db);
  return createApp(db, { jwtSecret: "test-secret" });
}

test("estimateCentroid offsets each EPA within a district", () => {
  const nkhotakota = estimateCentroid({ district: "Nkhotakota", epa: "Zidyana" });
  const linga = estimateCentroid({ district: "Nkhotakota", epa: "Linga" });
  assert.notEqual(nkhotakota.lat, linga.lat);
  assert.equal(buildPolygon(nkhotakota.lat, nkhotakota.lon, 1).length, 4);
});

test("GPS plot save replaces the estimate and staff can read it back", async (t) => {
  const db = openDatabase(":memory:");
  seedIfEmpty(db);
  seedStaffIfEmpty(db);
  const grace = db.prepare("SELECT * FROM farmers WHERE phone = ?").get("+265888000001");
  saveFarmPlan(db, grace, {
    crops: [{ crop: "Maize", hectares: 1.2, startMonth: "11" }],
    readiness: {},
  });

  const saved = saveFarmerPlot(db, grace, {
    lat: -12.8172,
    lon: 34.2891,
    source: "gps",
    accuracyM: 8,
  });
  assert.equal(saved.plot.source, "gps");
  assert.equal(saved.plot.hectares, 1.2);
  assert.ok(saved.plot.ndvi >= 0.32);

  const { url, close } = await listen(createApp(db, { jwtSecret: "test-secret" }));
  t.after(close);

  const mercy = await json(`${url}/api/staff/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000101", pin: "1234" }),
  });
  const detail = await json(`${url}/api/staff/farmers/${grace.id}`, {
    headers: { Authorization: `Bearer ${mercy.body.token}` },
  });
  assert.equal(detail.body.plot.plot.source, "gps");
  assert.match(detail.body.plot.coordsLabel, /S/);
});

test("GET /api/farmers/me/plot creates an estimated plot on first load", async (t) => {
  const { url, close } = await listen(setup());
  t.after(close);

  const login = await json(`${url}/api/farmers/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000003", pin: "1234" }),
  });
  const plot = await json(`${url}/api/farmers/me/plot`, {
    headers: { Authorization: `Bearer ${login.body.token}` },
  });
  assert.equal(plot.res.status, 200);
  assert.equal(plot.body.plot.source, "estimated");
  assert.ok(plot.body.map.embedUrl.includes("openstreetmap.org"));
});
