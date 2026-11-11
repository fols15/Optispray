// Unit tests for the shared rules: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import * as R from "../public/js/rules.mjs";

test("fixed figures match the brief", () => {
  assert.equal(R.KIT_PRICE[36], 14_300_000);
  assert.equal(R.KIT_PRICE[24], 10_300_000);
  assert.equal(R.VAT_RATE, 0.16);
  assert.equal(R.HERBICIDE_COST, 6000);
  assert.deepEqual(R.THRESHOLD_HA, { 24: 2900, 36: 4000 });
  assert.equal(R.PAYBACK_LIMIT, 2);
  assert.equal(R.MAX_SAVING, 0.41);
  assert.deepEqual(R.SAVING_RATES, [0.3, 0.4]);
});

test("payback = price / (hectares x cost x rate), at 30% and 40%", () => {
  const p = R.payback(36, 5000, 5500);
  assert.equal(p.rows[0].seasonSaving, 5000 * 5500 * 0.3);
  assert.equal(p.rows[0].seasons, 14_300_000 / (5000 * 5500 * 0.3));
  assert.equal(p.rows[1].seasons, 14_300_000 / (5000 * 5500 * 0.4));
  assert.equal(p.priceWithVat, 16_588_000);
  assert.equal(p.belowThreshold, false);
});

test("the brief's thresholds give about a two-season payback at 30% and 6,000 KZT/ha", () => {
  // exact two-season areas: 10.3 M / (2 x 6,000 x 0.3) = 2,861 ha; 14.3 M / 3,600 = 3,972 ha
  assert.ok(Math.abs(R.payback(24, 2900, 6000).rows[0].seasons - 2) < 0.03);
  assert.ok(Math.abs(R.payback(36, 4000, 6000).rows[0].seasons - 2) < 0.03);
  assert.equal(R.payback(24, 1000, 6000).thresholdAtYourCost, R.THRESHOLD_HA[24]);
  assert.equal(R.payback(36, 1000, 6000).thresholdAtYourCost, R.THRESHOLD_HA[36]);
  assert.equal(R.payback(24, 2800, 6000).belowThreshold, true);
  assert.equal(R.payback(24, 2900, 6000).belowThreshold, false);
});

test("a farm below the threshold is flagged, judged at 30%", () => {
  const p = R.payback(36, 3000, 5500);
  assert.equal(p.belowThreshold, true);
  assert.equal(p.rows[0].withinLimit, false);
});

test("empty or zero hectares never give a result", () => {
  assert.equal(R.payback(36, 0, 5500), null);
  assert.equal(R.checkCalculator({ boom: "36", hectares: "", cost: "5500" }).issues.hectares, "empty");
  assert.equal(R.checkCalculator({ boom: "36", hectares: "0", cost: "5500" }).issues.hectares, "zero");
  assert.equal(R.checkCalculator({ boom: "", hectares: "1", cost: "1" }).issues.boom, "choose");
});

test("negative and non-numeric input is rejected", () => {
  assert.equal(R.parseNumber("-5", { integer: true }).code, "negative");
  assert.equal(R.parseNumber("−5", { integer: true }).code, "negative");
  assert.equal(R.parseNumber("abc", { integer: true }).code, "nan");
  assert.equal(R.parseNumber("12a", {}).code, "nan");
  assert.equal(R.parseNumber("1e5", { integer: true }).code, "nan");
  assert.equal(R.parseNumber("3.5", { integer: true }).code, "not_integer");
});

test("number formats people type are accepted", () => {
  assert.equal(R.parseNumber("3 100", { integer: true }).value, 3100);
  assert.equal(R.parseNumber("3,100", { integer: true }).value, 3100);
  assert.equal(R.parseNumber("1,5").value, 1.5);
  assert.equal(R.parseNumber("1.5").value, 1.5);
  assert.equal(R.parseNumber("1,200").code, "ambiguous");
});

test("application keeps only the listed fields", () => {
  const r = R.checkApplication({
    name: "  Test   Person ", region: "kostanay", hectares: "5 000", sprayer: "Amazone UX 5200",
    boomWidth: "36", nozzleSpacing: "50", contact: "+7 701 000 00 00", extra: "dropped",
  });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.value).sort(), ["boomWidth", "contact", "hectares", "name", "nozzleSpacing", "region", "sprayer"]);
  assert.equal(r.value.name, "Test Person");
  assert.equal(r.value.hectares, 5000);
});

test("application: blank required fields and bad contact are reported per field", () => {
  const r = R.checkApplication({ region: "mars", contact: "call me" });
  assert.equal(r.ok, false);
  assert.equal(r.errors.name, "required");
  assert.equal(r.errors.region, "choose");
  assert.equal(r.errors.hectares, "empty");
  assert.equal(r.errors.contact, "contact");
  assert.equal(R.checkContact("farm@example.kz").value, "farm@example.kz");
});

const goodShift = { field: "Field 7", date: "2026-06-10", hectares: "200", litresSpot: "260", broadcastRate: "2", spotMinutes: "450", totalMinutes: "480", stops: [{ what: "Filter", hours: "1.5" }] };

test("shift results: saving, tenge and spot share", () => {
  const r = R.checkShift(goodShift, new Date("2026-06-11T08:00:00Z"));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const x = R.shiftResults(r.value);
  assert.equal(x.broadcastLitres, 400);
  assert.ok(Math.abs(x.saving - 0.35) < 1e-9);
  assert.equal(x.tengeSaved, Math.round(200 * 6000 * 0.35));
  assert.equal(x.spotShare, 450 / 480);
  assert.equal(x.passesSaving, true);
  assert.equal(x.passesSpotShare, true);
  assert.equal(x.longestStop, 1.5);
  assert.equal(x.stopWithinLimit, true);
});

test("a shift with a saving above 41% is not accepted", () => {
  const r = R.checkShift({ ...goodShift, litresSpot: "200" }, new Date("2026-06-11T08:00:00Z")); // 50%
  assert.equal(r.errors.litresSpot, "saving_too_high");
  const ok = R.checkShift({ ...goodShift, litresSpot: "236" }, new Date("2026-06-11T08:00:00Z")); // exactly 41%
  assert.equal(ok.ok, true);
});

test("shift: impossible values are caught", () => {
  const now = new Date("2026-06-11T08:00:00Z");
  assert.equal(R.checkShift({ ...goodShift, litresSpot: "500" }, now).errors.litresSpot, "saving_negative");
  assert.equal(R.checkShift({ ...goodShift, spotMinutes: "500" }, now).errors.spotMinutes, "spot_gt_total");
  assert.equal(R.checkShift({ ...goodShift, date: "2026-07-30" }, now).errors.date, "date_future");
  assert.equal(R.checkShift({ ...goodShift, date: "2026-02-30" }, now).errors.date, "date");
  assert.equal(R.checkShift({ ...goodShift, stops: [{ what: "", hours: "-2" }] }, now).errors.stopRows[0].hours, "negative");
  assert.equal(R.checkShift({ ...goodShift, stops: [] }, now).ok, true);
});

test("longest stop is compared with 48 hours", () => {
  const r = R.checkShift({ ...goodShift, stops: [{ what: "Wait for valve", hours: "52" }, { what: "", hours: "2" }] }, new Date("2026-06-11T08:00:00Z"));
  const x = R.shiftResults(r.value);
  assert.equal(x.longestStop, 52);
  assert.equal(x.stopWithinLimit, false);
});
