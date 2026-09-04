import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { seedIfEmpty } from "../src/farmers.js";
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

test("extension visit queue is scoped to the officer EPA and flags pests and harvests", async (t) => {
  const { url, close } = await listen(await setup());
  t.after(close);

  const mercy = await json(`${url}/api/staff/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000101", pin: "1234" }),
  });
  const ministry = await json(`${url}/api/staff/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000103", pin: "1234" }),
  });
  const graceLogin = await json(`${url}/api/farmers/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000001", pin: "1234" }),
  });

  const before = await json(`${url}/api/staff/visits`, {
    headers: { Authorization: `Bearer ${mercy.body.token}` },
  });
  assert.equal(before.res.status, 200);
  const graceBefore = before.body.visits.find((row) => row.farmerName === "Grace Banda");
  assert.ok(graceBefore);
  assert.equal(graceBefore.priority, "high");
  assert.match(graceBefore.reason, /grain not yet taken in/i);
  assert.equal(before.body.visits.some((row) => row.farmerName === "Estere Mvula"), false);

  await json(`${url}/api/advisor/ask`, {
    method: "POST",
    headers: { Authorization: `Bearer ${graceLogin.body.token}` },
    body: JSON.stringify({ text: "holes in the leaves", topic: "pest", lang: "en" }),
  });

  const afterPest = await json(`${url}/api/staff/visits`, {
    headers: { Authorization: `Bearer ${mercy.body.token}` },
  });
  const gracePest = afterPest.body.visits.find((row) => row.farmerName === "Grace Banda");
  assert.equal(gracePest.source, "pest");
  assert.match(gracePest.reason, /Fall Armyworm/);
  assert.ok(afterPest.body.stats.openPestReports >= 1);

  const national = await json(`${url}/api/staff/visits`, {
    headers: { Authorization: `Bearer ${ministry.body.token}` },
  });
  assert.ok(national.body.visits.find((row) => row.farmerName === "Estere Mvula"));
  assert.equal(
    national.body.visits.find((row) => row.farmerName === "Estere Mvula").reason,
    "First planting-season check-in"
  );
});
