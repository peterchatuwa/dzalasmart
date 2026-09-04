import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseUlimiHtml } from "../src/market/collectors/ulimi.js";

const TICKER_SNIPPET = `
<div id="ticker">
  <div><span class="opacity-70">Maize</span><span class="font-medium">MWK 900/kg</span></div>
  <div><span class="opacity-70">Ground Nuts</span><span class="font-medium">MWK 2300/kg</span></div>
  <div><span class="opacity-70">Soya</span><span class="font-medium">MWK 800/kg</span></div>
  <div><span class="opacity-70">Pigeon Peas</span><span class="font-medium">MWK 1500/kg</span></div>
  <div><span class="opacity-70">Beans</span><span class="font-medium">MWK 2000/kg</span></div>
  <div><span class="opacity-70">Maize</span><span class="font-medium">MWK 900/kg</span></div>
</div>`;

test("parseUlimiHtml reads ticker span pairs", () => {
  const rows = parseUlimiHtml(TICKER_SNIPPET);
  assert.equal(rows.length, 5);
  assert.deepEqual(
    rows.map((row) => [row.commoditySlug, row.buyPricePerKg]),
    [
      ["maize", 900],
      ["groundnuts", 2300],
      ["soya-beans", 800],
      ["pigeon-peas", 1500],
      ["beans", 2000],
    ]
  );
});

test("parseUlimiHtml parses saved Ulimi homepage fixture", () => {
  const html = readFileSync(new URL("./fixtures/ulimi-home.html", import.meta.url), "utf8");
  const rows = parseUlimiHtml(html);
  assert.equal(rows.length, 5);
  assert.ok(rows.some((row) => row.commoditySlug === "maize" && row.buyPricePerKg === 900));
  assert.ok(rows.some((row) => row.commoditySlug === "groundnuts" && row.buyPricePerKg === 2300));
});
