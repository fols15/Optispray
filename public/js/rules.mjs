// Shared business rules. The browser and the server import this same file,
// so the calculator, the validation and the shift report always agree.
// Fixed figures come from the project brief and must not be changed.

export const KIT_PRICE = { 24: 10_300_000, 36: 14_300_000 }; // KZT, excluding VAT
export const VAT_RATE = 0.16;
export const SAVING_RATES = [0.30, 0.40];   // the calculator shows both, side by side
export const PAYBACK_LIMIT = 2;             // seasons
export const THRESHOLD_HA = { 24: 2900, 36: 4000 }; // two-season payback at 30% and about 6,000 KZT/ha
export const HERBICIDE_COST = 6000;         // KZT per hectare for a burndown pass (DairyNews, 2026a); tenge saved in shift reports
export const MAX_SAVING = 0.41;             // highest saving measured so far; never show more
export const SAVING_PASS = 0.30;            // pass level for a shift report
export const SPOT_SHARE_TARGET = 0.90;      // share of pass time in spot mode
export const STOP_LIMIT_HOURS = 48;         // repair promise
export const REGIONS = ["akmola", "kostanay", "north_kz", "pavlodar", "east_kz", "karaganda", "other"];
export const MAX_STOPS = 20;

// ---------- numbers ----------
// Accepts digits with spaces as thousands separators (3 100). Whole-number fields
// also accept commas as thousands separators (3,100). Decimal fields accept one
// "." or "," as the decimal mark, and reject an ambiguous "1,200".
// Returns { value } or { code } where code is a key of the "err" strings.
export function parseNumber(raw, { integer = false, allowZero = false, min = 0, max = Infinity } = {}) {
  let s = String(raw ?? "").trim().replace(/[\s  ]/g, "");
  if (s === "") return { code: "empty" };
  if (/^[−-]/.test(s)) {
    const rest = s.slice(1).replace(",", ".");
    return /^\d+(\.\d+)?$/.test(rest) ? { code: "negative" } : { code: "nan" };
  }
  if (integer) {
    if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
    if (/^\d+[.,]\d+$/.test(s)) return { code: "not_integer" };
    if (!/^\d+$/.test(s)) return { code: "nan" };
  } else {
    if (/^\d{1,3},\d{3}$/.test(s) || /^\d{1,3}(,\d{3}){2,}/.test(s)) return { code: "ambiguous" };
    s = s.replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(s)) return { code: "nan" };
  }
  const value = Number(s);
  if (!Number.isFinite(value)) return { code: "nan" };
  if (value === 0 && !allowZero) return { code: "zero" };
  if (value < min) return { code: "too_small" };
  if (value > max) return { code: "too_large" };
  return { value };
}

// ---------- payback calculator ----------
// price / (hectares x cost x rate), at 30% and 40%.
export function payback(boom, hectares, cost) {
  const price = KIT_PRICE[boom];
  if (!price || !(hectares > 0) || !(cost > 0)) return null;
  const rows = SAVING_RATES.map((rate) => {
    const seasonSaving = hectares * cost * rate;
    const seasons = price / seasonSaving;
    return { rate, seasonSaving, seasons, withinLimit: seasons <= PAYBACK_LIMIT };
  });
  return {
    boom, hectares, cost, price,
    priceWithVat: Math.round(price * (1 + VAT_RATE)),
    rows,
    belowThreshold: !rows[0].withinLimit,         // judged at the cautious 30% saving
    thresholdAtYourCost: Math.round(price / (PAYBACK_LIMIT * cost * SAVING_RATES[0]) / 100) * 100,
  };
}

// The calculator inputs: returns { values, issues } where issues[field] is a code.
// "empty" and "zero" hectares are prompts, not errors: the page asks for a figure.
export function checkCalculator({ boom, hectares, cost }) {
  const issues = {};
  const b = Number(boom);
  if (!(b === 24 || b === 36)) issues.boom = "choose";
  const ha = parseNumber(hectares, { integer: true, max: 300_000 });
  if (ha.code) issues.hectares = ha.code;
  const c = parseNumber(cost, { integer: true, max: 100_000 });
  if (c.code) issues.cost = c.code;
  return { issues, values: { boom: b, hectares: ha.value, cost: c.value } };
}

// ---------- text fields ----------
function text(raw, { required = true, maxLen = 100, minLen = 1 } = {}) {
  const s = String(raw ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return required ? { code: "required" } : { value: "" };
  if (s.length < minLen) return { code: "too_short" };
  if (s.length > maxLen) return { code: "too_long" };
  return { value: s };
}

export function checkContact(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { code: "required" };
  if (s.length > 120) return { code: "too_long" };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return { value: s };
  const digits = s.replace(/[\s()+\-.]/g, "");
  if (/^\+?[\d\s()\-.]+$/.test(s) && /^\d{10,15}$/.test(digits)) return { value: s };
  return { code: "contact" };
}

// ---------- pilot application ----------
// Only the fields listed in the brief are read; anything else is dropped.
export function checkApplication(input = {}) {
  const errors = {}, value = {};
  const put = (key, r) => { if (r.code) errors[key] = r.code; else value[key] = r.value; };
  put("name", text(input.name, { minLen: 2, maxLen: 100 }));
  put("region", REGIONS.includes(input.region) ? { value: input.region } : { code: "choose" });
  put("hectares", parseNumber(input.hectares, { integer: true, max: 300_000 }));
  put("sprayer", text(input.sprayer, { minLen: 2, maxLen: 100 }));
  put("boomWidth", parseNumber(input.boomWidth, { integer: true, min: 6, max: 60 }));
  put("nozzleSpacing", parseNumber(input.nozzleSpacing, { integer: true, min: 10, max: 100 }));
  put("contact", checkContact(input.contact));
  return { errors, value, ok: Object.keys(errors).length === 0 };
}

// ---------- shift log ----------
export function shiftResults(s) {
  const broadcastLitres = s.hectares * s.broadcastRate;
  const saving = 1 - s.litresSpot / broadcastLitres;
  const stops = s.stops || [];
  const longestStop = stops.length ? Math.max(...stops.map((x) => x.hours)) : null;
  return {
    broadcastLitres,
    litresSaved: broadcastLitres - s.litresSpot,
    saving,
    tengeSaved: Math.round(s.hectares * HERBICIDE_COST * saving),
    spotShare: s.spotMinutes / s.totalMinutes,
    longestStop,
    passesSaving: saving >= SAVING_PASS,
    passesSpotShare: s.spotMinutes / s.totalMinutes >= SPOT_SHARE_TARGET,
    stopWithinLimit: longestStop === null ? null : longestStop <= STOP_LIMIT_HOURS,
  };
}

function checkDate(raw, today) {
  const s = String(raw ?? "").trim();
  if (!s) return { code: "required" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { code: "date" };
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return { code: "date" };
  if (s < "2026-01-01") return { code: "date_old" };
  const limit = new Date(today.getTime() + 36 * 3600 * 1000).toISOString().slice(0, 10);
  if (s > limit) return { code: "date_future" };
  return { value: s };
}

export function checkShift(input = {}, today = new Date()) {
  const errors = {}, value = {};
  const put = (key, r) => { if (r.code) errors[key] = r.code; else value[key] = r.value; };
  put("field", text(input.field, { maxLen: 80 }));
  put("date", checkDate(input.date, today));
  put("hectares", parseNumber(input.hectares, { max: 3000 }));
  put("litresSpot", parseNumber(input.litresSpot, { allowZero: true, max: 1_000_000 }));
  put("broadcastRate", parseNumber(input.broadcastRate, { max: 500 }));
  put("spotMinutes", parseNumber(input.spotMinutes, { integer: true, allowZero: true, max: 1440 }));
  put("totalMinutes", parseNumber(input.totalMinutes, { integer: true, max: 1440 }));

  const rawStops = Array.isArray(input.stops) ? input.stops : [];
  const stops = [], stopErrors = [];
  if (rawStops.length > MAX_STOPS) errors.stops = "too_many";
  rawStops.slice(0, MAX_STOPS).forEach((st, i) => {
    const what = text(st && st.what, { required: false, maxLen: 80 });
    const hours = parseNumber(st && st.hours, { max: 720 });
    const e = {};
    if (what.code) e.what = what.code;
    if (hours.code) e.hours = hours.code;
    if (Object.keys(e).length) stopErrors[i] = e;
    else stops.push({ what: what.value, hours: hours.value });
  });
  if (stopErrors.length) errors.stopRows = stopErrors;
  value.stops = stops;

  if (!errors.spotMinutes && !errors.totalMinutes && value.spotMinutes > value.totalMinutes) {
    errors.spotMinutes = "spot_gt_total";
  }
  if (!errors.hectares && !errors.litresSpot && !errors.broadcastRate) {
    const saving = 1 - value.litresSpot / (value.hectares * value.broadcastRate);
    if (saving > MAX_SAVING + 1e-9) errors.litresSpot = "saving_too_high";
    else if (saving < 0) errors.litresSpot = "saving_negative";
  }
  return { errors, value, ok: Object.keys(errors).length === 0 };
}
