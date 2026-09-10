import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { seedIfEmpty } from "../src/farmers.js";
import { baseNdvi, nationalView, ndviStatus, periodIndex } from "../src/ndvi.js";
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

async function setup() {
  const db = await openDatabase(":memory:");
  await seedIfEmpty(db);
  await seedStaffIfEmpty(db);
  return createApp(db, { jwtSecret: "test-secret" });
}

test("base NDVI is deterministic and classifies into healthy, watch, and alert bands", () => {
  const period = periodIndex(Date.parse("2026-09-04T08:00:00Z"));
  const nkhotakota = baseNdvi("Nkhotakota", period);
  assert.equal(baseNdvi("Nkhotakota", period), nkhotakota);
  assert.ok(nkhotakota >= 0.35 && nkhotakota <= 0.74);
  assert.equal(ndviStatus(0.61), "healthy");
  assert.equal(ndviStatus(0.5), "watch");
  assert.equal(ndviStatus(0.4), "alert");
});

test("national view flags Grace's district after a pest report and scopes extension to one district", async (t) => {
  const db = await openDatabase(":memory:");
  await seedIfEmpty(db);
  await seedStaffIfEmpty(db);
  const grace = await db.prepare("SELECT * FROM farmers WHERE phone = ?").get("+265888000001");
  await db
    .prepare(
      `
    INSERT INTO pest_reports (id, farmer_id, symptoms, match_name, channel, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `
    )
    .run(crypto.randomUUID(), grace.id, "holes in the leaves", "Fall Armyworm (on maize)", "mobile", Date.now());

  const ministry = await nationalView(
    db,
    { role: "ministry" },
    {
      now: Date.parse("2026-09-04T08:00:00Z"),
      weatherAlerts: [{ district: "Chikwawa", alert: "severe" }],
    }
  );
  assert.equal(ministry.scope, "national");
  assert.ok(ministry.districts.length >= 28);
  const nkhotakota = ministry.districts.find((row) => row.name === "Nkhotakota");
  assert.ok(nkhotakota);
  assert.ok(nkhotakota.pestReports >= 1);
  assert.notEqual(nkhotakota.status, "healthy");
  assert.ok(ministry.foodSecurityRisk.some((row) => row.district === "Chikwawa"));

  const mercy = await nationalView(
    db,
    { role: "extension", district: "Nkhotakota", epa: "Zidyana" },
    {
      now: Date.parse("2026-09-04T08:00:00Z"),
    }
  );
  assert.equal(mercy.scope, "Nkhotakota");
  assert.ok(mercy.districts.every((row) => row.name === "Nkhotakota"));
  assert.equal(mercy.stats.farmersRegistered, 1);
});

test("GET /api/staff/national returns the ministry crop-health map", async (t) => {
  const { url, close } = await listen(await setup());
  t.after(close);

  const ministry = await json(`${url}/api/staff/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000103", pin: "1234" }),
  });
  const payload = await json(`${url}/api/staff/national`, {
    headers: { Authorization: `Bearer ${ministry.body.token}` },
  });
  assert.equal(payload.res.status, 200);
  assert.equal(payload.body.scope, "national");
  assert.ok(payload.body.districts.length >= 28);
  assert.ok(payload.body.stats.epasMonitored >= 120);
  assert.ok(Array.isArray(payload.body.regions));
});
