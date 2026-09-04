import assert from "node:assert/strict";
import test from "node:test";
import { buildPassport } from "../src/passport.js";

const farmer = {
  id: "f1",
  name: "Grace Banda",
  code: "MW-NKT-0417-2291",
  phone: "+265888000001",
  district: "Nkhotakota",
  epa: "Zidyana",
  region: "Central",
};

test("passport stays unrated until a season stage is logged", () => {
  const passport = buildPassport({
    farmer,
    events: [],
    seasonComplete: false,
  }, [], []);
  assert.equal(passport.grade, "—");
  assert.equal(passport.netIncome, 0);
  assert.equal(passport.score, 300);
});

test("graded grain plus a cleared sale become net income and lift the grade", () => {
  const status = {
    farmer,
    events: Array.from({ length: 8 }, (_, i) => ({ stageIndex: i })),
    seasonComplete: true,
  };
  const receipts = [{
    status: "accepted",
    crop: "Maize",
    weightKg: 82,
    pricePerKg: 1050,
    assetValue: 86100,
    loanCap: 51660,
    loanDisbursed: 51660,
    createdAt: 1,
  }];
  const contracts = [{
    farmerId: "f1",
    status: "cleared",
    crop: "Maize",
    pricePerKg: 610,
    buyer: "AgroBuy Traders",
    createdAt: 2,
  }];
  const passport = buildPassport(status, receipts, contracts);
  assert.equal(passport.saleIncome, 50020);
  assert.equal(passport.netIncome, 50020);
  assert.equal(passport.warehouseValue, 0);
  assert.equal(passport.loanDisbursed, 51660);
  assert.equal(passport.grade, "A");
  assert.equal(passport.checks.find((row) => row.id === "sale").done, true);
});
