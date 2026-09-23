import assert from "node:assert/strict";
import test from "node:test";
import { ALERT_DISTRICTS, regionForDistrict } from "../src/places.js";
import { alertHeadline, classifyAlert, fieldAdviceFor, seasonAdvice } from "../src/weather.js";

test("classifyAlert uses rain and wind thresholds from the original site", () => {
  assert.equal(classifyAlert({ rain3day: 10, current: { wind_speed_10m: 10 } }), "clear");
  assert.equal(classifyAlert({ rain3day: 30, current: { wind_speed_10m: 10 } }), "watch");
  assert.equal(classifyAlert({ rain3day: 70, current: { wind_speed_10m: 10 } }), "severe");
  assert.equal(classifyAlert({ rain3day: 0, current: { wind_speed_10m: 50 } }), "severe");
});

test("field advice follows recent rain", () => {
  assert.match(fieldAdviceFor({ rain3day: 50, current: { temperature_2m: 24 } }), /waterlogging/);
  assert.match(fieldAdviceFor({ rain3day: 12, current: { temperature_2m: 24 } }), /moisture/);
});

test("season advice is Malawi dry vs rainy calendar", () => {
  const dry = seasonAdvice(new Date("2026-06-15"));
  assert.match(dry.label, /Dry/);
  const rains = seasonAdvice(new Date("2026-12-15"));
  assert.match(rains.label, /rainy/i);
});

test("alert districts match the original Open-Meteo watch list", () => {
  assert.deepEqual(ALERT_DISTRICTS, [
    "Karonga",
    "Mzuzu",
    "Rumphi",
    "Lilongwe",
    "Kasungu",
    "Salima",
    "Blantyre",
    "Chikwawa",
    "Nsanje",
  ]);
  assert.equal(regionForDistrict("Mzuzu"), "Northern Region");
  assert.equal(alertHeadline("clear"), "No warnings");
  assert.equal(alertHeadline("watch"), "Elevated rain or wind");
});
