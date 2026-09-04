import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { seedIfEmpty } from "../src/farmers.js";
import { seedStaffIfEmpty } from "../src/staff.js";
import { gradeMoisture } from "../src/warehouse.js";

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

test("gradeMoisture matches the original warehouse meter bands", () => {
  assert.equal(gradeMoisture("Maize", 12.4), "accepted");
  assert.equal(gradeMoisture("Maize", 13.5), "accepted");
  assert.equal(gradeMoisture("Maize", 15.1), "drying_required");
  assert.equal(gradeMoisture("Maize", 18), "rejected");
  assert.equal(gradeMoisture("Groundnuts", 9.8), "accepted");
  assert.equal(gradeMoisture("Groundnuts", 12), "drying_required");
});

test("cooperative intake grades grain, writes a receipt, and advances Harvest to Post-Harvest", async (t) => {
  const { url, close } = await listen(setup());
  t.after(close);

  const coopLogin = await json(`${url}/api/staff/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000102", pin: "1234" }),
  });
  assert.equal(coopLogin.body.staff.role, "cooperative");
  const coopToken = coopLogin.body.token;

  const list = await json(`${url}/api/staff/farmers`, {
    headers: { Authorization: `Bearer ${coopToken}` },
  });
  const grace = list.body.farmers.find((row) => row.farmer.phone === "+265888000001");
  assert.equal(grace.currentStage.key, "harvest");

  const intake = await json(`${url}/api/staff/warehouse/intake`, {
    method: "POST",
    headers: { Authorization: `Bearer ${coopToken}` },
    body: JSON.stringify({
      farmerId: grace.farmer.id,
      crop: "Maize",
      weightKg: 82,
      moisturePct: 12.4,
    }),
  });
  assert.equal(intake.res.status, 201);
  assert.equal(intake.body.receipt.status, "accepted");
  assert.equal(intake.body.receipt.statusLabel, "Graded");
  assert.equal(intake.body.receipt.weightKg, 82);
  assert.equal(intake.body.receipt.assetValue, 86100);
  assert.equal(intake.body.receipt.loanCap, 51660);
  assert.equal(intake.body.receipt.loanDisbursed, 0);
  assert.equal(intake.body.receipt.loanPending, true);
  assert.equal(intake.body.stageAdvanced, true);
  assert.equal(intake.body.farmer.currentStage.key, "post_harvest");
  assert.equal(intake.body.farmer.events.at(-1).channel, "warehouse");
  assert.equal(intake.body.farmer.receipts.length, 1);

  const ledger = await json(`${url}/api/staff/warehouse`, {
    headers: { Authorization: `Bearer ${coopToken}` },
  });
  assert.equal(ledger.body.acceptedLots, 1);
  assert.equal(ledger.body.storedKg, 82);
});

test("wet grain is logged as drying required and does not advance the season", async (t) => {
  const { url, close } = await listen(setup());
  t.after(close);

  const coopLogin = await json(`${url}/api/staff/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000102", pin: "1234" }),
  });
  const list = await json(`${url}/api/staff/farmers`, {
    headers: { Authorization: `Bearer ${coopLogin.body.token}` },
  });
  const grace = list.body.farmers.find((row) => row.farmer.phone === "+265888000001");

  const wet = await json(`${url}/api/staff/warehouse/intake`, {
    method: "POST",
    headers: { Authorization: `Bearer ${coopLogin.body.token}` },
    body: JSON.stringify({
      farmerId: grace.farmer.id,
      crop: "Maize",
      weightKg: 65,
      moisturePct: 15.1,
    }),
  });
  assert.equal(wet.res.status, 201);
  assert.equal(wet.body.receipt.status, "drying_required");
  assert.equal(wet.body.receipt.loanDisbursed, 0);
  assert.equal(wet.body.stageAdvanced, false);
  assert.equal(wet.body.farmer.currentStage.key, "harvest");
});

test("extension staff cannot write intake, and unharvested farmers are refused", async (t) => {
  const { url, close } = await listen(setup());
  t.after(close);

  const extLogin = await json(`${url}/api/staff/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000101", pin: "1234" }),
  });
  const coopLogin = await json(`${url}/api/staff/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000102", pin: "1234" }),
  });
  const list = await json(`${url}/api/staff/farmers`, {
    headers: { Authorization: `Bearer ${coopLogin.body.token}` },
  });
  const grace = list.body.farmers.find((row) => row.farmer.phone === "+265888000001");
  const joseph = list.body.farmers.find((row) => row.farmer.phone === "+265888000002");

  const blocked = await json(`${url}/api/staff/warehouse/intake`, {
    method: "POST",
    headers: { Authorization: `Bearer ${extLogin.body.token}` },
    body: JSON.stringify({
      farmerId: grace.farmer.id,
      crop: "Maize",
      weightKg: 82,
      moisturePct: 12.4,
    }),
  });
  assert.equal(blocked.res.status, 403);

  const early = await json(`${url}/api/staff/warehouse/intake`, {
    method: "POST",
    headers: { Authorization: `Bearer ${coopLogin.body.token}` },
    body: JSON.stringify({
      farmerId: joseph.farmer.id,
      crop: "Maize",
      weightKg: 40,
      moisturePct: 12,
    }),
  });
  assert.equal(early.res.status, 409);
});

test("farmer accepts the warehouse loan from the app after grading", async (t) => {
  const { url, close } = await listen(setup());
  t.after(close);

  const coopLogin = await json(`${url}/api/staff/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000102", pin: "1234" }),
  });
  const list = await json(`${url}/api/staff/farmers`, {
    headers: { Authorization: `Bearer ${coopLogin.body.token}` },
  });
  const grace = list.body.farmers.find((row) => row.farmer.phone === "+265888000001");
  await json(`${url}/api/staff/warehouse/intake`, {
    method: "POST",
    headers: { Authorization: `Bearer ${coopLogin.body.token}` },
    body: JSON.stringify({
      farmerId: grace.farmer.id,
      crop: "Maize",
      weightKg: 82,
      moisturePct: 12.4,
    }),
  });

  const farmerLogin = await json(`${url}/api/farmers/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000001", pin: "1234" }),
  });
  const before = await json(`${url}/api/farmers/me/status`, {
    headers: { Authorization: `Bearer ${farmerLogin.body.token}` },
  });
  assert.equal(before.body.receipts[0].loanPending, true);
  assert.equal(before.body.passport.loanPending, 51660);
  assert.equal(before.body.passport.loanDisbursed, 0);
  assert.equal(before.body.passport.grade, "C");

  const paid = await json(`${url}/api/farmers/me/loans`, {
    method: "POST",
    headers: { Authorization: `Bearer ${farmerLogin.body.token}` },
    body: JSON.stringify({}),
  });
  assert.equal(paid.res.status, 200);
  assert.equal(paid.body.receipt.loanDisbursed, 51660);
  assert.equal(paid.body.farmer.passport.loanDisbursed, 51660);
  assert.equal(paid.body.farmer.passport.loanPending, 0);

  const again = await json(`${url}/api/farmers/me/loans`, {
    method: "POST",
    headers: { Authorization: `Bearer ${farmerLogin.body.token}` },
    body: JSON.stringify({}),
  });
  assert.equal(again.res.status, 409);
});

test("USSD option 5 shows the warehouse advance and pays it on confirm", async (t) => {
  const { url, close } = await listen(setup());
  t.after(close);

  const coopLogin = await json(`${url}/api/staff/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000102", pin: "1234" }),
  });
  const list = await json(`${url}/api/staff/farmers`, {
    headers: { Authorization: `Bearer ${coopLogin.body.token}` },
  });
  const grace = list.body.farmers.find((row) => row.farmer.phone === "+265888000001");
  await json(`${url}/api/staff/warehouse/intake`, {
    method: "POST",
    headers: { Authorization: `Bearer ${coopLogin.body.token}` },
    body: JSON.stringify({
      farmerId: grace.farmer.id,
      crop: "Maize",
      weightKg: 82,
      moisturePct: 12.4,
    }),
  });

  const menu = await fetch(`${url}/ussd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: "+265888000001", text: "" }),
  });
  assert.match(await menu.text(), /5\. Warehouse & loan/);

  const empty = await fetch(`${url}/ussd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: "+265888000002", text: "5" }),
  });
  assert.match(await empty.text(), /No grain has been taken in yet/);

  const offer = await fetch(`${url}/ussd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: "+265888000001", text: "5" }),
  });
  const offerText = await offer.text();
  assert.match(offerText, /^CON /);
  assert.match(offerText, /Advance MWK 51,660/);

  const accept = await fetch(`${url}/ussd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: "+265888000001", text: "5*1" }),
  });
  const acceptText = await accept.text();
  assert.match(acceptText, /^END /);
  assert.match(acceptText, /51,660/);
  assert.match(acceptText, /mobile money/);
});
