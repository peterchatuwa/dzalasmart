import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { seedIfEmpty } from "../src/farmers.js";
import { judgeOffer, seedFloorsIfEmpty } from "../src/floors.js";
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
  seedFloorsIfEmpty(db);
  return createApp(db, { jwtSecret: "test-secret" });
}

async function login(url, phone) {
  const payload = await json(`${url}/api/staff/login`, {
    method: "POST",
    body: JSON.stringify({ phone, pin: "1234" }),
  });
  return payload.body.token;
}

test("judgeOffer blocks prices below the ministry floor", () => {
  assert.equal(judgeOffer(610, 550), "cleared");
  assert.equal(judgeOffer(550, 550), "cleared");
  assert.equal(judgeOffer(380, 420), "blocked");
});

test("cooperative offers below the floor are recorded as blocked", async (t) => {
  const { url, close } = await listen(setup());
  t.after(close);
  const token = await login(url, "+265888000102");

  const blocked = await json(`${url}/api/staff/contracts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      buyer: "Kanyenda Vendor Group",
      crop: "Groundnuts",
      district: "Kasungu",
      pricePerKg: 380,
    }),
  });
  assert.equal(blocked.res.status, 201);
  assert.equal(blocked.body.contract.status, "blocked");
  assert.match(blocked.body.contract.statusLabel, /blocked/i);
  assert.equal(blocked.body.stageAdvanced, false);

  const cleared = await json(`${url}/api/staff/contracts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      buyer: "AgroBuy Traders",
      crop: "Maize",
      district: "Nkhotakota",
      pricePerKg: 610,
    }),
  });
  assert.equal(cleared.body.contract.status, "cleared");

  const monitor = await json(`${url}/api/staff/contracts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(monitor.body.violationCount, 1);
  assert.equal(monitor.body.clearedCount, 1);
  assert.equal(monitor.body.floors.find((row) => row.crop === "Maize").pricePerKg, 550);
});

test("only the ministry can change floors; FUM and extension cannot write contracts", async (t) => {
  const { url, close } = await listen(setup());
  t.after(close);
  const ministry = await login(url, "+265888000103");
  const fum = await login(url, "+265888000104");
  const extension = await login(url, "+265888000101");

  const updated = await json(`${url}/api/staff/floors`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${ministry}` },
    body: JSON.stringify({ crop: "Maize", pricePerKg: 800 }),
  });
  assert.equal(updated.res.status, 200);
  assert.equal(updated.body.floors.find((row) => row.crop === "Maize").pricePerKg, 800);

  const fumBlocked = await json(`${url}/api/staff/floors`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${fum}` },
    body: JSON.stringify({ crop: "Maize", pricePerKg: 100 }),
  });
  assert.equal(fumBlocked.res.status, 403);

  const extOffer = await json(`${url}/api/staff/contracts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${extension}` },
    body: JSON.stringify({
      buyer: "Buyer #9932",
      crop: "Maize",
      district: "Lilongwe",
      pricePerKg: 650,
    }),
  });
  assert.equal(extOffer.res.status, 403);
});

test("a cleared farmer sale writes Marketing after warehouse grading", async (t) => {
  const { url, close } = await listen(setup());
  t.after(close);
  const coop = await login(url, "+265888000102");
  const list = await json(`${url}/api/staff/farmers`, {
    headers: { Authorization: `Bearer ${coop}` },
  });
  const grace = list.body.farmers.find((row) => row.farmer.phone === "+265888000001");

  await json(`${url}/api/staff/warehouse/intake`, {
    method: "POST",
    headers: { Authorization: `Bearer ${coop}` },
    body: JSON.stringify({
      farmerId: grace.farmer.id,
      crop: "Maize",
      weightKg: 82,
      moisturePct: 12.4,
    }),
  });

  const sale = await json(`${url}/api/staff/contracts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${coop}` },
    body: JSON.stringify({
      buyer: "Chikweo Millers",
      crop: "Maize",
      district: "Nkhotakota",
      pricePerKg: 595,
      farmerId: grace.farmer.id,
    }),
  });
  assert.equal(sale.res.status, 201);
  assert.equal(sale.body.contract.status, "cleared");
  assert.equal(sale.body.stageAdvanced, true);
  assert.equal(sale.body.farmer.currentStage.key, "marketing");
  assert.equal(sale.body.farmer.events.at(-1).channel, "sale");
});
