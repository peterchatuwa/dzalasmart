import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { askAdvisor, matchDisease, recommendCrops } from "../src/advisor.js";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { seedIfEmpty } from "../src/farmers.js";
import { seedFloorsIfEmpty } from "../src/floors.js";
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
  await seedFloorsIfEmpty(db);
  return { db, app: createApp(db, { jwtSecret: "test-secret" }) };
}

test("maize is recommended on fertile loam", () => {
  const crops = recommendCrops("Loamy", "Balanced / fertile");
  assert.ok(crops.includes("Maize"));
});

test("holes in the leaves match fall armyworm", () => {
  const match = matchDisease("holes in the leaves and worms on maize");
  assert.equal(match.name, "Fall Armyworm (on maize)");
  const reply = askAdvisor({ text: "holes in the leaves", topic: "pest" });
  assert.equal(reply.kind, "pest");
  assert.match(reply.reply, /Fall Armyworm/);
  assert.match(reply.reply, /Emamectin/);
});

test("fertiliser questions hit the general knowledge base", () => {
  const reply = askAdvisor({ text: "which fertiliser should I use for top dress?" });
  assert.equal(reply.kind, "general");
  assert.match(reply.reply, /Urea|CAN|basal/i);
});

test("POST /api/advisor/ask logs a pest report for a signed-in farmer", async (t) => {
  const { app } = await setup();
  const { url, close } = await listen(app);
  t.after(close);

  const login = await json(`${url}/api/farmers/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000001", pin: "1234" }),
  });
  const asked = await json(`${url}/api/advisor/ask`, {
    method: "POST",
    headers: { Authorization: `Bearer ${login.body.token}` },
    body: JSON.stringify({ text: "holes in the leaves", topic: "pest", lang: "en" }),
  });
  assert.equal(asked.res.status, 200);
  assert.equal(asked.body.kind, "pest");
  assert.equal(asked.body.match, "Fall Armyworm (on maize)");

  const staffLogin = await json(`${url}/api/staff/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000101", pin: "1234" }),
  });
  const pests = await json(`${url}/api/staff/pests`, {
    headers: { Authorization: `Bearer ${staffLogin.body.token}` },
  });
  assert.equal(pests.res.status, 200);
  assert.equal(pests.body.reports[0].farmerName, "Grace Banda");
  assert.equal(pests.body.reports[0].matchName, "Fall Armyworm (on maize)");
});

test("USSD option 4 reports a pest onto the same farmer record", async (t) => {
  const { app } = await setup();
  const { url, close } = await listen(app);
  t.after(close);

  const menu = await fetch(`${url}/ussd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: "+265888000003", text: "" }),
  });
  const menuText = await menu.text();
  assert.match(menuText, /4\. Report a pest problem/);

  const choice = await fetch(`${url}/ussd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: "+265888000003", text: "4" }),
  });
  assert.match(await choice.text(), /Worms on leaves/);

  const report = await fetch(`${url}/ussd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: "+265888000003", text: "4*1" }),
  });
  const reportText = await report.text();
  assert.match(reportText, /^END /);
  assert.match(reportText, /Fall Armyworm/);
  assert.match(reportText, /extension/);

  const staffLogin = await json(`${url}/api/staff/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000101", pin: "1234" }),
  });
  const pests = await json(`${url}/api/staff/pests`, {
    headers: { Authorization: `Bearer ${staffLogin.body.token}` },
  });
  assert.equal(pests.body.reports[0].channel, "ussd");
  assert.equal(pests.body.reports[0].farmerName, "Estere Mvula");
});

test("crop ask uses the farmer soil record when none is posted", async (t) => {
  const { app } = await setup();
  const { url, close } = await listen(app);
  t.after(close);

  const login = await json(`${url}/api/farmers/login`, {
    method: "POST",
    body: JSON.stringify({ phone: "+265888000001", pin: "1234" }),
  });
  const asked = await json(`${url}/api/advisor/ask`, {
    method: "POST",
    headers: { Authorization: `Bearer ${login.body.token}` },
    body: JSON.stringify({ topic: "crop", lang: "en" }),
  });
  assert.equal(asked.res.status, 200);
  assert.equal(asked.body.kind, "crop");
  assert.match(asked.body.reply, /Groundnuts|Cassava|Sweet potatoes/);
});
