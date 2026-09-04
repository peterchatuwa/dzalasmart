import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { seedIfEmpty } from "../src/farmers.js";

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        server,
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

test("farmer register, login, and ordered season events", async (t) => {
  const db = await openDatabase(":memory:");
  const app = createApp(db, { jwtSecret: "test-secret" });
  const { url, close } = await listen(app);
  t.after(close);

  const registered = await json(`${url}/api/farmers/register`, {
    method: "POST",
    body: JSON.stringify({
      name: "Test Farmer",
      phone: "0888000999",
      pin: "4321",
      district: "Lilongwe",
      epa: "Mitundu",
    }),
  });
  assert.equal(registered.res.status, 201);
  assert.equal(registered.body.farmer.phone, "+265888000999");
  assert.ok(registered.body.token);

  const login = await json(`${url}/api/farmers/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000999", pin: "4321" }),
  });
  assert.equal(login.res.status, 200);
  const token = login.body.token;

  const first = await json(`${url}/api/farmers/me/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  assert.equal(first.res.status, 201);
  assert.equal(first.body.currentStage.key, "input_redemption");
  assert.equal(first.body.events[0].channel, "mobile");

  const skip = await json(`${url}/api/farmers/me/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ stageKey: "harvest" }),
  });
  assert.equal(skip.res.status, 409);

  const next = await json(`${url}/api/farmers/me/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ stageKey: "land_preparation" }),
  });
  assert.equal(next.res.status, 201);
  assert.equal(next.body.currentStage.key, "land_preparation");
});

test("USSD logs the next milestone onto the same farmer record", async (t) => {
  const db = await openDatabase(":memory:");
  await seedIfEmpty(db);
  const app = createApp(db, { jwtSecret: "test-secret" });
  const { url, close } = await listen(app);
  t.after(close);

  const menu = await fetch(`${url}/ussd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: "+265888000003", text: "" }),
  });
  const menuText = await menu.text();
  assert.match(menuText, /^CON /);
  assert.match(menuText, /Estere Mvula/);

  const confirm = await fetch(`${url}/ussd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: "+265888000003", text: "1*1" }),
  });
  const confirmText = await confirm.text();
  assert.match(confirmText, /^END Input Redemption recorded/);

  const login = await json(`${url}/api/farmers/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000003", pin: "1234" }),
  });
  const status = await json(`${url}/api/farmers/me/status`, {
    headers: { Authorization: `Bearer ${login.body.token}` },
  });
  assert.equal(status.body.currentStage.key, "input_redemption");
  assert.equal(status.body.events[0].channel, "ussd");
});

test("staff can read a farmer record but cannot write stages", async (t) => {
  const db = await openDatabase(":memory:");
  await seedIfEmpty(db);
  const { seedStaffIfEmpty } = await import("../src/staff.js");
  await seedStaffIfEmpty(db);
  const app = createApp(db, { jwtSecret: "test-secret" });
  const { url, close } = await listen(app);
  t.after(close);

  const staffLogin = await json(`${url}/api/staff/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000101", pin: "1234" }),
  });
  assert.equal(staffLogin.res.status, 200);
  assert.equal(staffLogin.body.staff.role, "extension");
  const staffToken = staffLogin.body.token;

  const list = await json(`${url}/api/staff/farmers`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(list.res.status, 200);
  const estere = list.body.farmers.find((row) => row.farmer.phone === "+265888000003");
  assert.ok(estere);

  const detail = await json(`${url}/api/staff/farmers/${estere.farmer.id}`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(detail.res.status, 200);
  assert.equal(detail.body.farmer.name, "Estere Mvula");

  const blockedWrite = await json(`${url}/api/farmers/me/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({}),
  });
  assert.equal(blockedWrite.res.status, 403);
});
