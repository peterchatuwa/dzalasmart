import assert from "node:assert/strict";
import test from "node:test";
import { careAdvice, guideForCrop, seasonActions, seasonSetup, upcomingAction } from "../src/crop-care.js";
import { adviceFromGuides, buildFarmerQuotes, farmBrief, guideLines, quoteRows } from "../src/farm-guides.js";
import { DISTRICT_EPAS, sectionsFor } from "../src/places.js";

test("official EPAs include the farmer extension areas already in use", () => {
  assert.ok(DISTRICT_EPAS.Kasungu.includes("Kaluluma"));
  assert.ok(DISTRICT_EPAS.Nkhotakota.includes("Zidyana"));
  assert.ok(DISTRICT_EPAS.Balaka.includes("Bazale"));
  assert.ok(sectionsFor("Kasungu", "Kaluluma").length > 0);
  assert.ok(Object.values(DISTRICT_EPAS).reduce((sum, epas) => sum + epas.length, 0) > 200);
});

test("maize calendar follows the district production sheet", () => {
  const guide = guideForCrop("Maize", "Kasungu");
  assert.match(guide.variety, /SC 555/);
  const weeding = guide.tasks.find((task) => task.type === "weeding" && task.from === 14);
  assert.equal(weeding.label, "First weeding");
  const basal = guide.tasks.find((task) => task.from === 0 && task.type === "fertilizing");
  assert.match(basal.detail, /basal NPK/i);
});

test("the season setup names the district variety and the planting line", () => {
  const setup = seasonSetup("Maize", "Kasungu");
  assert.match(setup.varieties, /SC 555/);
  assert.match(setup.planting, /75x25cm/);
  assert.match(setup.planting, /basal NPK/i);
  assert.equal(setup.onSheet, true);
  assert.match(upcomingAction("Maize", "Kasungu", 11), /First weeding in 3 days/);
  assert.match(setup.phaseNote, /land preparation/);
  assert.match(setup.phaseNote, /day you record planting/);
  const cotton = seasonSetup("Cotton", "Kasungu");
  assert.equal(cotton.onSheet, false);
  assert.match(cotton.note, /short general plan/);
});

test("a new season starts with land preparation, and crop days start at planting", () => {
  const today = "2026-09-23";
  const prep = seasonActions({ id: "s", crop: "Maize" }, [], today, [], "Kasungu");
  assert.ok(prep.length > 0);
  assert.ok(prep.every((action) => action.phase === "prep"));
  assert.ok(prep.some((action) => /plough/i.test(action.label)));
  assert.equal(careAdvice("Maize", "Kasungu", { planted: false, openPrep: prep.length }).includes("land preparation"), true);

  const done = prep.map((action) => ({
    activity_type: action.logType,
    description: action.label,
    activity_date: "2026-09-20",
  }));
  const ready = seasonActions({ id: "s", crop: "Maize" }, done, today, [], "Kasungu");
  assert.equal(ready.length, 1);
  assert.equal(ready[0].phase, "plant");
  assert.equal(ready[0].logType, "planting");
  assert.match(ready[0].detail, /You can plant now/);
  assert.match(careAdvice("Maize", "Kasungu", { planted: false, openPrep: 0 }), /You can plant now/);

  const early = seasonActions({ id: "s", crop: "Maize", created_at: "2026-06-01" }, [], today, [], "Kasungu");
  assert.ok(early.every((action) => action.phase === "prep"));

  const planted = seasonActions(
    { id: "s", crop: "Maize", planting_date: "2026-09-09" },
    [],
    today,
    [],
    "Kasungu",
  );
  const weeding = planted.find((action) => action.label.includes("First weeding"));
  assert.equal(weeding.ageDays, 14);
  assert.ok(planted.every((action) => action.phase === "crop"));
});

test("groundnuts in the Shire Valley use a short-duration variety", () => {
  const guide = guideForCrop("Groundnuts", "Chikwawa");
  assert.match(guide.variety, /Chitala|CG 7/);
  assert.ok(guide.tasks.some((task) => task.label === "Apply gypsum"));
});

test("Kasungu maize guide gives seed, break-even, suppliers, and buyers", () => {
  const brief = farmBrief({ crop: "Maize", district: "Kasungu", epa: "Kaluluma", hectares: 0.25 });
  assert.match(brief.seed, /25 kg\/ha/);
  assert.match(brief.seed, /6\.25 kg for 0\.25 ha/);
  assert.match(brief.margin, /district gross-margin sheet/);
  assert.match(brief.margin, /MWK 897\/kg/);
  assert.match(brief.margin, /3,257 kg\/ha/);
  assert.match(brief.suppliers, /Yara Malawi/);
  assert.match(brief.suppliers, /Optichem/);
  assert.match(brief.buyers, /NFRA/);
});

test("advisor adds the guide only for seed, input, and market questions", () => {
  const brief = farmBrief({ crop: "Maize", district: "Kasungu", epa: "Kaluluma", hectares: 0.25 });
  assert.match(guideLines("how much seed do I plant", brief), /6\.25 kg/);
  assert.equal(guideLines("holes in the leaves", brief), "");
  assert.match(guideLines("where can I sell maize", brief), /NFRA/);
  assert.match(guideLines("where do I buy fertiliser", brief), /Yara Malawi/);
  const advice = adviceFromGuides("what is the maize price", {
    district: "Kasungu",
    epa: "Kaluluma",
  });
  assert.match(advice, /MWK 897\/kg/);
  assert.match(guideLines("where do I buy fertiliser", brief), /62\.5 kg for 0\.25 ha/);
});

test("each field keeps its own quote, seed, and fertiliser quantity", () => {
  const quotes = buildFarmerQuotes({
    district: "Kasungu",
    epa: "Kaluluma",
    liveRows: quoteRows([
      { crop: "Maize", pricePerKg: 1050, warehouse: "Kasungu", source: "LocalBuyEx", live: true },
      { crop: "Soya beans", pricePerKg: 1200, warehouse: "Lilongwe", source: "LocalBuyEx", live: true },
    ]),
    floors: [
      { crop: "Maize", pricePerKg: 550 },
      { crop: "Soybeans", pricePerKg: 490 },
    ],
    fields: [
      { seasonId: "near-road", parcelName: "Near the road", crop: "Maize", hectares: 0.25 },
      { seasonId: "river", parcelName: "River field", crop: "Soya", hectares: 1 },
    ],
  });
  assert.equal(quotes[0].today.pricePerKg, 1050);
  assert.equal(quotes[0].floor.pricePerKg, 550);
  assert.equal(quotes[0].plan.pricePerKg, 1100);
  assert.equal(quotes[0].plan.marginForField, 164900);
  assert.match(quotes[0].seed, /6\.25 kg/);
  assert.match(quotes[0].fieldInputs, /62\.5 kg for 0\.25 ha/);
  assert.equal(quotes[1].today.pricePerKg, 1200);
  assert.equal(quotes[1].floor.pricePerKg, 490);
  assert.match(quotes[1].seed, /for 1 ha/);
});

test("bean prices stay separate from soya", () => {
  const [quote] = buildFarmerQuotes({
    district: "Kasungu",
    liveRows: quoteRows([{ crop: "Soya beans", pricePerKg: 1200, live: true, source: "LocalBuyEx" }]),
    floors: [{ crop: "Soybeans", pricePerKg: 490 }],
    fields: [{ crop: "Beans", hectares: 1 }],
  });
  assert.equal(quote.today, null);
  assert.equal(quote.floor, null);
});
