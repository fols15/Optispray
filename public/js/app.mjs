// OptiSpray Pilot Hub: one small single-page app without a framework.
// Screens are plain functions that return HTML; text comes from i18n.mjs,
// arithmetic and validation from rules.mjs (shared with the server).
import { STRINGS, LANGS, formatNumber } from "./i18n.mjs";
import * as R from "./rules.mjs";

// ---------------------------------------------------------------- language
let lang = "en";
try {
  const saved = localStorage.getItem("ops-lang");
  if (LANGS.includes(saved)) lang = saved;
  else if ((navigator.language || "").toLowerCase().startsWith("kk")) lang = "kk";
} catch { /* storage blocked: stay on English */ }

function t(key, vars = {}) {
  let s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n, d = 0) => formatNumber(n, d, lang);
const fmtDate = (iso) => { const [y, m, d] = iso.slice(0, 10).split("-"); return t("date.format", { y, d: +d, month: t("month." + +m) }); };
const fmtStamp = (iso) => { const x = new Date(iso); const p2 = (n) => String(n).padStart(2, "0"); return t("date.stamp", { date: fmtDate(`${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`), time: `${p2(x.getHours())}:${p2(x.getMinutes())}` }); };
// one decimal, rounded down, so 89.96% shows as 89.9% and never looks like it meets a 90% target
const pct = (x) => t("common.pct", { n: fmt(Math.floor(x * 1000 + 1e-9) / 10, 1) });
const kzt = (n) => t("common.kzt", { n: fmt(Math.round(n)) });
// A report link is built from wherever the site is running, never from a fixed host.
const reportUrl = (id) => new URL(`/report/${encodeURIComponent(id)}`, location.origin).href;

// Error codes can carry a bound: "too_small|10" -> "This is too small: enter at least 10."
function errText(code) {
  const [c, n] = String(code).split("|");
  const vars = n === undefined ? {} : { n: fmt(Number(n), n.includes(".") ? 1 : 0) };
  if (c === "date_old") vars.date = fmtDate(R.PILOT_START);
  return t("err." + c, vars);
}
// Fill a whole-sentence template and make one of its values bold. Word order stays in the strings file.
function tBold(key, vars, boldKey) {
  const mark = "\u0000";
  const [a, b = ""] = t(key, { ...vars, [boldKey]: mark }).split(mark);
  return `${esc(a)}<b>${esc(vars[boldKey])}</b>${esc(b)}`;
}

function setLang(l) {
  lang = l;
  try { localStorage.setItem("ops-lang", l); } catch { /* ignore */ }
  render({ keepFocus: true });
}

// ---------------------------------------------------------------- state
// Everything typed lives here, so switching language or a failed save never loses it.
const state = {
  calc: { boom: "", hectares: "", cost: "" },
  calcShown: false,
  apply: { name: "", region: "", hectares: "", sprayer: "", boomWidth: "", nozzleSpacing: "", contact: "" },
  applyErrors: {}, applyStatus: "idle", applyRef: null, applyCarried: false,
  session: null,
  login: { user: "", password: "" }, loginError: null, loginBusy: false,
  shift: newShift(), shiftErrors: {}, shiftStatus: "idle", shiftId: null,
  lists: {},
};

function newShift() {
  const today = new Date();
  const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return { field: "", date: iso, hectares: "", litresSpot: "", broadcastRate: "", spotMinutes: "", totalMinutes: "", stops: [] };
}

// ---------------------------------------------------------------- small UI helpers
const ICON = {
  err: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16.5v.5"/></svg>',
  info: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  ok: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>',
  warn: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
};

function msgHtml(id, error, prompt) {
  if (error) return `<p class="msg msg-err" id="${id}-msg">${ICON.err}<span>${esc(errText(error))}</span></p>`;
  if (prompt) return `<p class="msg msg-prompt" id="${id}-msg">${ICON.info}<span>${esc(prompt)}</span></p>`;
  return `<p class="msg" id="${id}-msg" hidden></p>`;
}

// Update one field's message without re-rendering the form (keeps the caret where it is).
function setMessage(id, error, prompt = null) {
  const old = document.getElementById(`${id}-msg`);
  if (!old) return;
  old.outerHTML = msgHtml(id, error, prompt);
  const inputs = id === "boom" ? document.querySelectorAll('input[name="boom"]') : [document.getElementById(id)];
  inputs.forEach((el) => {
    if (!el) return;
    if (error || (id === "boom" && prompt)) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
    el.closest(".field")?.classList.toggle("has-error", Boolean(error));
  });
}

function field({ id, label, value = "", error = null, prompt = null, hint = null, inputmode = null, type = "text", autocomplete = "off", required = true, extra = "" }) {
  const describedBy = [hint && `${id}-hint`, `${id}-msg`].filter(Boolean).join(" ");
  return `<div class="field${error ? " has-error" : ""}">
    <label for="${id}">${esc(label)}</label>
    ${hint ? `<p class="hint" id="${id}-hint">${esc(hint)}</p>` : ""}
    <input id="${id}" name="${id}" type="${type}" value="${esc(value)}" autocomplete="${autocomplete}"
      ${inputmode ? `inputmode="${inputmode}"` : ""} ${required ? 'aria-required="true"' : ""}
      ${error ? 'aria-invalid="true"' : ""} aria-describedby="${describedBy}" ${extra}>
    ${msgHtml(id, error, prompt)}
  </div>`;
}

function select({ id, label, value, options, error, placeholder }) {
  return `<div class="field${error ? " has-error" : ""}">
    <label for="${id}">${esc(label)}</label>
    <select id="${id}" name="${id}" aria-required="true" aria-describedby="${id}-msg"${error ? ' aria-invalid="true"' : ""}>
      <option value="">${esc(placeholder)}</option>
      ${options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("")}
    </select>
    ${msgHtml(id, error, null)}
  </div>`;
}

function notice(kind, title, text, actions = "") {
  const role = kind === "err" || kind === "warn" ? ' role="alert"' : "";
  return `<div class="notice notice-${kind}"${role}>${ICON[kind] || ICON.info}<div>
    ${title ? `<p class="notice-title">${esc(title)}</p>` : ""}${text ? `<p>${esc(text)}</p>` : ""}${actions}</div></div>`;
}

function errorCount(errors) {
  let n = 0;
  for (const [k, v] of Object.entries(errors)) n += k === "stopRows" ? v.filter(Boolean).reduce((a, r) => a + Object.keys(r).length, 0) : 1;
  return n;
}

function summary(errors) {
  const n = errorCount(errors);
  if (!n) return "";
  return `<p class="msg msg-err summary" id="summary" role="alert">${ICON.err}<span>${esc(n === 1 ? t("common.fixField") : t("common.fixFields", { n }))}</span></p>`;
}

function updateSummary(errors) {
  const el = document.getElementById("summary");
  if (!el) return;
  const n = errorCount(errors);
  if (!n) { el.remove(); return; }
  el.querySelector("span").textContent = n === 1 ? t("common.fixField") : t("common.fixFields", { n });
}

function focusFirstError() {
  const el = document.querySelector('[aria-invalid="true"]');
  if (el) el.focus();
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: options.body ? { "content-type": "application/json" } : {},
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, data };
}

function failureNotice(kind, retryId) {
  const text = kind === "rate" ? t("common.rateLimited") : kind === "server" ? t("common.serverError") : t("common.offline");
  return notice("err", t("common.unsavedTitle"), text, `<button type="button" class="btn" id="${retryId}">${esc(t("common.retry"))}</button>`);
}

// ---------------------------------------------------------------- screens
function home() {
  return `<section class="hero">
      <h1 tabindex="-1">${esc(t("home.title"))}</h1>
      <p class="lead">${esc(t("home.lead"))}</p>
      <a class="btn btn-primary btn-big" href="/calculator" data-link>${esc(t("home.cta"))}</a>
    </section>
    <div class="cols">
      <section class="card"><h2>${esc(t("home.suitsTitle"))}</h2>
        <ul class="ticks">${["suits1", "suits2", "suits3", "suits4"].map((k) => `<li>${esc(t("home." + k))}</li>`).join("")}</ul></section>
      <section class="card"><h2>${esc(t("home.factsTitle"))}</h2>
        <ul class="ticks">${["fact1", "fact2", "fact3"].map((k) => `<li>${esc(t("home." + k))}</li>`).join("")}</ul></section>
    </div>`;
}

// ---- calculator
function calcView() {
  const c = state.calc;
  const { issues, values } = R.checkCalculator(c);
  const shown = state.calcShown;
  const prompts = { empty: true, zero: true };
  const haIssue = shown ? issues.hectares : null, costIssue = shown ? issues.cost : null;
  const boomErr = shown && issues.boom;
  const radios = [24, 36].map((b) => `<label class="choice">
      <input type="radio" name="boom" value="${b}"${String(c.boom) === String(b) ? " checked" : ""} aria-describedby="boom-msg"${boomErr ? ' aria-invalid="true"' : ""}>
      <span>${esc(t("calc.boom" + b))}</span></label>`).join("");

  return `<h1 tabindex="-1">${esc(t("calc.title"))}</h1>
    <p class="lead">${esc(t("calc.lead"))}</p>
    <form id="calc-form" class="card form" novalidate>
      <fieldset class="field"><legend>${esc(t("calc.boom"))}</legend>
        <div class="choices">${radios}</div>
        ${msgHtml("boom", null, boomErr ? t("calc.promptBoom") : null)}
      </fieldset>
      ${field({ id: "c-ha", label: t("calc.ha"), hint: t("calc.haHint"), value: c.hectares, inputmode: "numeric",
        error: haIssue && !prompts[haIssue] ? haIssue : null, prompt: haIssue && prompts[haIssue] ? t("calc.promptHa") : null })}
      ${field({ id: "c-cost", label: t("calc.cost"), hint: t("calc.costHint"), value: c.cost, inputmode: "numeric",
        error: costIssue && costIssue !== "empty" ? costIssue : null, prompt: costIssue === "empty" ? t("calc.promptCost") : null })}
      <button class="btn btn-primary" type="submit">${esc(t("calc.submit"))}</button>
    </form>
    <section id="calc-result" class="result" aria-live="polite">${shown && !Object.keys(issues).length ? calcResult(values) : ""}</section>`;
}

function seasonsText(s) {
  return s > 10 ? t("calc.more", { n: fmt(10) }) : t("common.seasons", { n: fmt(s, 1) });
}

function calcResult(v) {
  const p = R.payback(v.boom, v.hectares, v.cost);
  if (!p) return "";
  const [r30, r40] = p.rows;
  const head = p.belowThreshold
    ? notice("warn", t("calc.warnTitle"), null, `<p>${esc(t("calc.warnText", { boom: p.boom, s: fmt(r30.seasons, 1) }))}</p>
        ${r40.withinLimit ? "" : `<p>${esc(t("calc.warnBoth", { s: fmt(r40.seasons, 1) }))}</p>`}
        <p>${esc(t("calc.warnThresholds"))}</p>
        ${p.cost !== R.HERBICIDE_COST ? `<p>${esc(t("calc.warnYourCost", { boom: p.boom, ha: fmt(p.thresholdAtYourCost) }))}</p>` : ""}`)
    : notice("ok", t("calc.okTitle"), t("calc.okText", { boom: p.boom, s: fmt(r30.seasons, 1) }));
  const scale = Math.min(6, Math.max(3, Math.ceil(Math.max(r30.seasons, r40.seasons))));
  const bar = (row) => `<div class="bar-row">
      <span class="bar-label">${esc(t("calc.at", { r: Math.round(row.rate * 100) }))}</span>
      <span class="bar-track"><span class="bar ${row.withinLimit ? "bar-ok" : "bar-over"}" data-w="${Math.min(100, (row.seasons / scale) * 100)}"></span>
        <span class="bar-limit" data-left="${(R.PAYBACK_LIMIT / scale) * 100}"></span></span>
      <span class="bar-value">${esc(seasonsText(row.seasons))}</span></div>`;
  const card = (row) => `<div class="rate-card">
      <h3>${esc(t("calc.at", { r: Math.round(row.rate * 100) }))}</h3>
      <dl><dt>${esc(t("calc.seasonSaving"))}</dt><dd>${esc(kzt(row.seasonSaving))}</dd>
        <dt>${esc(t("calc.payback"))}</dt><dd>${esc(seasonsText(row.seasons))}</dd></dl>
      <p class="status ${row.withinLimit ? "status-ok" : "status-bad"}">${row.withinLimit ? ICON.ok : ICON.warn}<span>${esc(t(row.withinLimit ? "calc.within" : "calc.above"))}</span></p>
    </div>`;
  return `<h2>${esc(t("calc.resultTitle"))}</h2>
    <p class="price"><span>${esc(t("calc.price", { boom: p.boom }))}</span><b>${esc(t("calc.priceValue", { price: fmt(p.price), vat: fmt(p.priceWithVat) }))}</b></p>
    ${head}
    <div class="rate-cards">${card(r30)}${card(r40)}</div>
    <figure class="chart" aria-label="${esc(t("calc.chartLabel"))}">
      ${bar(r30)}${bar(r40)}
      <p class="chart-key"><span class="key-line" aria-hidden="true"></span>${esc(t("calc.limit"))}</p>
    </figure>
    <p class="note">${esc(t("calc.note"))}</p>
    <a class="btn btn-primary" href="/apply" data-link id="to-apply">${esc(t("calc.toApply"))}</a>`;
}

function bindCalc() {
  const form = document.getElementById("calc-form");
  const sync = () => {
    const boom = form.querySelector('input[name="boom"]:checked');
    state.calc = { boom: boom ? boom.value : "", hectares: form["c-ha"].value, cost: form["c-cost"].value };
  };
  form.addEventListener("submit", (e) => {
    e.preventDefault(); sync(); state.calcShown = true; render({ keepFocus: true });
    const { issues } = R.checkCalculator(state.calc);
    if (Object.keys(issues).length) focusFirstError() || document.querySelector(".msg-prompt")?.closest(".field")?.querySelector("input")?.focus();
    else document.getElementById("calc-result").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  // after the first result, keep it in step with what is typed
  // re-draw only when a value really changed, so a tap on "Apply" right after typing is not lost
  let shownFor = JSON.stringify(state.calc);
  const live = () => {
    sync();
    const key = JSON.stringify(state.calc);
    if (!state.calcShown || key === shownFor) return;
    shownFor = key; calcMessages(); refreshPart("calc-result", calcResultOrPrompt);
  };
  form.addEventListener("input", live);
  form.addEventListener("change", live);
}
function calcMessages() {
  const { issues } = R.checkCalculator(state.calc);
  const prompt = (code) => ["empty", "zero"].includes(code);
  setMessage("boom", null, issues.boom ? t("calc.promptBoom") : null);
  setMessage("c-ha", issues.hectares && !prompt(issues.hectares) ? issues.hectares : null, issues.hectares && prompt(issues.hectares) ? t("calc.promptHa") : null);
  setMessage("c-cost", issues.cost && issues.cost !== "empty" ? issues.cost : null, issues.cost === "empty" ? t("calc.promptCost") : null);
}
function calcResultOrPrompt() {
  const { issues, values } = R.checkCalculator(state.calc);
  if (Object.keys(issues).length) {
    const msg = issues.boom ? t("calc.promptBoom") : issues.hectares ? (["empty", "zero"].includes(issues.hectares) ? t("calc.promptHa") : errText(issues.hectares))
      : (issues.cost === "empty" ? t("calc.promptCost") : errText(issues.cost));
    return `<p class="msg msg-prompt">${ICON.info}<span>${esc(msg)}</span></p>`;
  }
  return calcResult(values);
}
function refreshPart(id, fn) { const el = document.getElementById(id); if (el) { el.innerHTML = fn(); applySizes(el); } }

// ---- pilot application
function applyView() {
  if (state.applyStatus === "done") {
    return `<h1 tabindex="-1">${esc(t("apply.doneTitle"))}</h1>
      <div class="card done">${ICON.ok}<p>${esc(t("apply.doneRef"))}</p><p class="ref" id="ref">${esc(state.applyRef)}</p>
      <p>${esc(t("apply.doneText", { contact: state.apply.contact }))}</p>
      <a class="btn" href="/" data-link id="apply-home">${esc(t("apply.another"))}</a></div>`;
  }
  const a = state.apply, e = state.applyErrors;
  const regions = R.REGIONS.map((k) => [k, t("region." + k)]);
  const busy = state.applyStatus === "sending";
  return `<h1 tabindex="-1">${esc(t("apply.title"))}</h1>
    <p class="lead">${esc(t("apply.lead"))}</p>
    ${notice("info", t("apply.privacyTitle"), t("apply.privacy"))}
    <form id="apply-form" class="card form" novalidate>
      ${summary(e)}
      <p class="hint">${esc(t("apply.allRequired"))}</p>
      ${state.applyCarried ? `<p class="msg msg-prompt">${ICON.info}<span>${esc(t("apply.carried"))}</span></p>` : ""}
      ${field({ id: "name", label: t("apply.name"), value: a.name, error: e.name, autocomplete: "name" })}
      ${select({ id: "region", label: t("apply.region"), value: a.region, options: regions, error: e.region, placeholder: t("apply.regionChoose") })}
      ${field({ id: "hectares", label: t("apply.ha"), value: a.hectares, error: e.hectares, inputmode: "numeric" })}
      ${field({ id: "sprayer", label: t("apply.sprayer"), hint: t("apply.sprayerHint"), value: a.sprayer, error: e.sprayer })}
      ${field({ id: "boomWidth", label: t("apply.boom"), hint: t("apply.boomHint"), value: a.boomWidth, error: e.boomWidth, inputmode: "numeric" })}
      ${field({ id: "nozzleSpacing", label: t("apply.nozzle"), hint: t("apply.nozzleHint"), value: a.nozzleSpacing, error: e.nozzleSpacing, inputmode: "numeric" })}
      ${field({ id: "contact", label: t("apply.contact"), hint: t("apply.contactHint"), value: a.contact, error: e.contact, autocomplete: "tel" })}
      <div id="apply-status">${applyStatusHtml()}</div>
      <button class="btn btn-primary" type="submit"${busy ? ' disabled aria-busy="true"' : ""}>${esc(busy ? t("common.sending") : t("apply.submit"))}</button>
    </form>`;
}
function applyStatusHtml() {
  const s = state.applyStatus;
  return s === "offline" || s === "server" || s === "rate" ? failureNotice(s, "apply-retry") : "";
}

function bindApply() {
  const home = document.getElementById("apply-home");
  if (home) home.addEventListener("click", resetApply);
  const form = document.getElementById("apply-form");
  if (!form) return;
  const upd = (ev) => {
    const k = ev.target.name;
    if (!(k in state.apply)) return;
    state.apply[k] = ev.target.value;
    if (state.applyErrors[k]) {
      const now = R.checkApplication(state.apply).errors;
      if (!now[k]) { delete state.applyErrors[k]; setMessage(k, null); updateSummary(state.applyErrors); }
    }
  };
  form.addEventListener("input", upd);
  form.addEventListener("change", upd);
  form.addEventListener("submit", (ev) => { ev.preventDefault(); sendApplication(); });
  document.getElementById("apply-retry")?.addEventListener("click", sendApplication);
}

async function sendApplication() {
  const r = R.checkApplication(state.apply);
  state.applyErrors = r.errors;
  if (!r.ok) { state.applyStatus = "idle"; render({ keepFocus: true }); focusFirstError(); return; }
  state.applyStatus = "sending"; render({ keepFocus: true });
  try {
    const { status, data } = await api("/api/applications", { method: "POST", body: r.value });
    if (status === 201) { state.applyStatus = "done"; state.applyRef = data.ref; render(); return; }
    if (status === 422 && data?.fields) { state.applyErrors = data.fields; state.applyStatus = "idle"; render({ keepFocus: true }); focusFirstError(); return; }
    state.applyStatus = status === 429 ? "rate" : "server";
  } catch {
    state.applyStatus = "offline";
  }
  render({ keepFocus: true });
  document.getElementById("apply-retry")?.focus();
}

// ---- team area
async function ensureSession() {
  if (state.session) return state.session;
  try {
    const { status, data } = await api("/api/session");
    state.session = status === 200 ? data : { loggedIn: false, configured: true, error: true };
  } catch {
    state.session = { loggedIn: false, configured: true, error: true };
  }
  return state.session;
}

function loginView() {
  const l = state.login, err = state.loginError;
  const msg = err === "wrong" ? t("team.wrong") : err === "rate" ? t("team.tooMany") : err === "config" ? t("team.notConfigured") : err === "offline" ? t("common.offline") : null;
  return `<h1 tabindex="-1">${esc(t("team.title"))}</h1>
    <p class="lead">${esc(t("team.lead"))}</p>
    <form id="login-form" class="card form narrow" novalidate>
      ${msg ? `<p class="msg msg-err summary" role="alert">${ICON.err}<span>${esc(msg)}</span></p>` : ""}
      ${field({ id: "user", label: t("team.user"), value: l.user, autocomplete: "username" })}
      ${field({ id: "password", label: t("team.password"), value: l.password, type: "password", autocomplete: "current-password" })}
      <button class="btn btn-primary" type="submit"${state.loginBusy ? ' disabled aria-busy="true"' : ""}>${esc(state.loginBusy ? t("common.sending") : t("team.signIn"))}</button>
    </form>`;
}

function bindLogin() {
  const form = document.getElementById("login-form");
  if (!form) return;
  form.addEventListener("input", (ev) => { state.login[ev.target.name] = ev.target.value; });
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    state.loginBusy = true; state.loginError = null; render({ keepFocus: true });
    try {
      const { status } = await api("/api/login", { method: "POST", body: { user: state.login.user, password: state.login.password } });
      state.loginBusy = false;
      if (status === 200) {
        state.session = { loggedIn: true, configured: true }; state.login = { user: "", password: "" };
        navigate(location.pathname === "/team" ? "/team/applications" : location.pathname, { replace: true });
        return;
      }
      state.loginError = status === 429 ? "rate" : status === 503 ? "config" : "wrong";
    } catch {
      state.loginBusy = false; state.loginError = "offline";
    }
    render({ keepFocus: true });
    document.getElementById("user")?.focus();
  });
}

function teamTabs(active) {
  const tab = (path, key) => `<a href="${path}" data-link class="tab"${active === path ? ' aria-current="page"' : ""}>${esc(t(key))}</a>`;
  return `<nav class="tabs" aria-label="${esc(t("team.tabsLabel"))}">
      ${tab("/team/applications", "team.tabApps")}${tab("/team/shift", "team.tabShift")}${tab("/team/reports", "team.tabReports")}
      <button type="button" class="btn btn-quiet" id="sign-out">${esc(t("team.signOut"))}</button></nav>`;
}

function listState(key, url, renderItems) {
  const st = state.lists[key];
  if (!st || st.status === "loading") {
    if (!st) loadList(key, url);
    return `<p class="msg msg-prompt" role="status">${ICON.info}<span>${esc(t("common.loading"))}</span></p>`;
  }
  if (st.status === "error") return notice("err", null, t("team.loadFailed"), `<button type="button" class="btn" data-reload="${key}">${esc(t("common.retry"))}</button>`);
  return renderItems(st.items);
}
async function loadList(key, url) {
  state.lists[key] = { status: "loading" };
  try {
    const { status, data } = await api(url);
    if (status === 401) { state.session = { loggedIn: false, configured: true }; delete state.lists[key]; render(); return; }
    state.lists[key] = status === 200 ? { status: "ok", items: data.items } : { status: "error" };
  } catch {
    state.lists[key] = { status: "error" };
  }
  render({ keepFocus: true });
}

function appsView() {
  return `<h1 tabindex="-1">${esc(t("team.appsTitle"))}</h1>${teamTabs("/team/applications")}
    ${listState("apps", "/api/applications", (items) => !items.length
      ? `<div class="empty card"><p>${esc(t("team.appsEmpty"))}</p></div>`
      : `<p>${esc(t("team.appsCount", { n: items.length }))}</p><ul class="items">${items.map((a) => `<li class="card item">
          <p class="ref">${esc(a.ref)}</p>
          <dl class="kv">
            <dt>${esc(t("team.received"))}</dt><dd>${esc(fmtStamp(a.createdAt))}</dd>
            <dt>${esc(t("apply.name"))}</dt><dd>${esc(a.name)}</dd>
            <dt>${esc(t("apply.region"))}</dt><dd>${esc(t("region." + a.region))}</dd>
            <dt>${esc(t("apply.ha"))}</dt><dd>${esc(fmt(a.hectares))}</dd>
            <dt>${esc(t("apply.sprayer"))}</dt><dd>${esc(a.sprayer)}</dd>
            <dt>${esc(t("apply.boom"))}</dt><dd>${esc(fmt(a.boomWidth))}</dd>
            <dt>${esc(t("apply.nozzle"))}</dt><dd>${esc(fmt(a.nozzleSpacing))}</dd>
            <dt>${esc(t("apply.contact"))}</dt><dd>${esc(a.contact)}</dd>
          </dl></li>`).join("")}</ul>`)}`;
}

function reportsView() {
  return `<h1 tabindex="-1">${esc(t("reports.title"))}</h1>${teamTabs("/team/reports")}
    ${listState("shifts", "/api/shifts", (items) => !items.length
      ? `<div class="empty card"><p>${esc(t("reports.empty"))}</p></div>`
      : `<ul class="items">${items.map((s) => `<li class="card item">
          <p><a href="/report/${esc(s.id)}" data-link>${esc(t("report.subtitle", { field: s.field, date: fmtDate(s.date) }))}</a></p>
          <p class="muted">${esc(t("reports.item", { ha: t("common.ha", { n: fmt(s.hectares, 1) }), saving: pct(s.results.saving) }))}</p></li>`).join("")}</ul>`)}`;
}

// ---- shift log
function shiftPreview(s) {
  // The date and field name do not change the figures, so they are not needed for the preview.
  const r = R.checkShift({ ...s, field: s.field || "x", date: R.PILOT_START, stops: s.stops });
  const keys = ["hectares", "litresSpot", "broadcastRate", "spotMinutes", "totalMinutes"];
  if (keys.some((k) => r.errors[k])) {
    const special = r.errors.litresSpot === "saving_too_high" || r.errors.litresSpot === "saving_negative" ? r.errors.litresSpot
      : r.errors.spotMinutes === "spot_gt_total" ? "spot_gt_total" : null;
    return `<p class="msg msg-prompt">${ICON.info}<span>${esc(special ? errText(special) : t("shift.previewWait"))}</span></p>`;
  }
  const res = R.shiftResults(r.value);   // stops with an unfinished duration are left out until they are complete
  const vt = (value, target) => esc(t("report.valueTarget", { value, target }));
  const stop = res.longestStop === null ? t("report.noStops") : t("common.hours", { n: fmt(res.longestStop, 1) });
  return `<dl class="kv"><dt>${esc(t("report.saving"))}</dt><dd>${vt(pct(res.saving), t("report.savingTarget"))}</dd>
    <dt>${esc(t("report.spot"))}</dt><dd>${vt(pct(res.spotShare), t("report.spotTarget"))}</dd>
    <dt>${esc(t("report.stop"))}</dt><dd>${vt(stop, t("report.stopTarget"))}</dd>
    <dt>${esc(t("report.tenge"))}</dt><dd>${esc(kzt(res.tengeSaved))}</dd></dl>`;
}

function shiftView() {
  if (state.shiftStatus === "done") {
    const link = reportUrl(state.shiftId);
    return `<h1 tabindex="-1">${esc(t("shift.doneTitle"))}</h1>${teamTabs("/team/shift")}
      <div class="card done">${ICON.ok}<p>${esc(t("shift.doneText"))}</p>
        <label class="sr-only" for="report-link">${esc(t("report.title"))}</label>
        <input id="report-link" class="linkbox" readonly value="${esc(link)}">
        <div class="row"><button type="button" class="btn" id="copy-link">${esc(t("common.copy"))}</button>
        <a class="btn btn-primary" href="/report/${esc(state.shiftId)}" data-link>${esc(t("shift.open"))}</a></div>
        <p id="copy-status" class="muted" role="status"></p>
        <button type="button" class="btn btn-quiet" id="shift-again">${esc(t("shift.another"))}</button></div>`;
  }
  const s = state.shift, e = state.shiftErrors, rows = e.stopRows || [];
  const busy = state.shiftStatus === "sending";
  const stops = s.stops.map((st, i) => `<fieldset class="stop"><legend>${esc(t("shift.stopN", { n: i + 1 }))}</legend>
      ${field({ id: `stop-what-${i}`, label: t("shift.stopWhat"), value: st.what, error: rows[i]?.what, required: false, extra: `data-stop="${i}" data-key="what"` })}
      ${field({ id: `stop-hours-${i}`, label: t("shift.stopHours"), value: st.hours, error: rows[i]?.hours, inputmode: "decimal", extra: `data-stop="${i}" data-key="hours"` })}
      <button type="button" class="btn btn-quiet" data-remove="${i}">${esc(t("shift.removeStop", { n: i + 1 }))}</button></fieldset>`).join("");
  return `<h1 tabindex="-1">${esc(t("shift.title"))}</h1>${teamTabs("/team/shift")}
    <p class="lead">${esc(t("shift.lead"))}</p>
    <form id="shift-form" class="card form" novalidate>
      ${summary(e)}
      <p class="hint">${esc(t("shift.allRequired"))}</p>
      ${field({ id: "field", label: t("shift.field"), value: s.field, error: e.field })}
      ${field({ id: "date", label: t("shift.date"), value: s.date, error: e.date, type: "date" })}
      ${field({ id: "hectares", label: t("shift.ha"), value: s.hectares, error: e.hectares, inputmode: "decimal" })}
      ${field({ id: "litresSpot", label: t("shift.litres"), value: s.litresSpot, error: e.litresSpot, inputmode: "decimal" })}
      ${field({ id: "broadcastRate", label: t("shift.rate"), hint: t("shift.rateHint"), value: s.broadcastRate, error: e.broadcastRate, inputmode: "decimal" })}
      ${field({ id: "spotMinutes", label: t("shift.spotMin"), value: s.spotMinutes, error: e.spotMinutes, inputmode: "numeric" })}
      ${field({ id: "totalMinutes", label: t("shift.totalMin"), value: s.totalMinutes, error: e.totalMinutes, inputmode: "numeric" })}
      <fieldset class="field stops"><legend>${esc(t("shift.stops"))}</legend>
        <p class="hint">${esc(t("shift.stopsHint"))}</p>
        ${e.stops ? `<p class="msg msg-err">${ICON.err}<span>${esc(errText(e.stops))}</span></p>` : ""}
        ${stops || `<p class="muted">${esc(t("shift.noStops"))}</p>`}
        <button type="button" class="btn" id="add-stop">${esc(t("shift.addStop"))}</button>
      </fieldset>
      <section class="preview" aria-live="polite"><h2>${esc(t("shift.preview"))}</h2><div id="shift-preview">${shiftPreview(s)}</div></section>
      <div id="shift-status">${["offline", "server", "rate"].includes(state.shiftStatus) ? failureNotice(state.shiftStatus, "shift-retry") : ""}</div>
      <button class="btn btn-primary" type="submit"${busy ? ' disabled aria-busy="true"' : ""}>${esc(busy ? t("common.sending") : t("shift.submit"))}</button>
    </form>`;
}

function bindShift() {
  document.getElementById("copy-link")?.addEventListener("click", copyLink);
  document.getElementById("shift-again")?.addEventListener("click", () => {
    state.shift = newShift(); state.shiftErrors = {}; state.shiftStatus = "idle"; state.shiftId = null; render();
  });
  const form = document.getElementById("shift-form");
  if (!form) return;
  form.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.dataset.stop !== undefined) state.shift.stops[+el.dataset.stop][el.dataset.key] = el.value;
    else if (el.name in state.shift) state.shift[el.name] = el.value;
    refreshPart("shift-preview", () => shiftPreview(state.shift));
    const now = R.checkShift(state.shift).errors, e = state.shiftErrors;
    for (const k of Object.keys(e)) {
      if (k !== "stopRows" && k !== "stops" && !now[k]) { delete e[k]; setMessage(k, null); }
    }
    (e.stopRows || []).forEach((row, i) => row && Object.keys(row).forEach((key) => {
      if (!now.stopRows?.[i]?.[key]) { delete row[key]; setMessage(`stop-${key}-${i}`, null); }
    }));
    updateSummary(e);
  });
  form.addEventListener("click", (ev) => {
    const rm = ev.target.closest("[data-remove]");
    if (rm) { state.shift.stops.splice(+rm.dataset.remove, 1); delete state.shiftErrors.stopRows; render({ keepFocus: true }); document.getElementById("add-stop")?.focus(); }
  });
  document.getElementById("add-stop").addEventListener("click", () => {
    if (state.shift.stops.length >= R.MAX_STOPS) return;
    state.shift.stops.push({ what: "", hours: "" }); render({ keepFocus: true });
    document.getElementById(`stop-what-${state.shift.stops.length - 1}`)?.focus();
  });
  form.addEventListener("submit", (ev) => { ev.preventDefault(); sendShift(); });
  document.getElementById("shift-retry")?.addEventListener("click", sendShift);
}

async function sendShift() {
  const r = R.checkShift(state.shift);
  state.shiftErrors = r.errors;
  if (!r.ok) { state.shiftStatus = "idle"; render({ keepFocus: true }); focusFirstError(); return; }
  state.shiftStatus = "sending"; render({ keepFocus: true });
  try {
    const { status, data } = await api("/api/shifts", { method: "POST", body: r.value });
    if (status === 201) { state.shiftStatus = "done"; state.shiftId = data.id; delete state.lists.shifts; render(); return; }
    if (status === 401) { state.session = { loggedIn: false, configured: true }; state.shiftStatus = "idle"; render(); return; }
    if (status === 422 && data?.fields) { state.shiftErrors = data.fields; state.shiftStatus = "idle"; render({ keepFocus: true }); focusFirstError(); return; }
    state.shiftStatus = status === 429 ? "rate" : "server";
  } catch {
    state.shiftStatus = "offline";
  }
  render({ keepFocus: true });
  document.getElementById("shift-retry")?.focus();
}

async function copyLink() {
  const input = document.getElementById("report-link"), out = document.getElementById("copy-status");
  try { await navigator.clipboard.writeText(input.value); out.textContent = t("common.copied"); }
  catch { input.select(); out.textContent = t("common.copyFailed"); }
}

// ---- shift report (public, read-only)
const reports = {};
function reportView(id) {
  if (!id) {
    return `<h1 tabindex="-1">${esc(t("report.title"))}</h1>
      <div class="empty card"><p class="notice-title">${esc(t("report.emptyTitle"))}</p><p>${esc(t("report.emptyText"))}</p></div>`;
  }
  const r = reports[id];
  if (!r) { loadReport(id); return `<h1 tabindex="-1">${esc(t("report.title"))}</h1><p class="msg msg-prompt" role="status">${ICON.info}<span>${esc(t("common.loading"))}</span></p>`; }
  if (r.status === "loading") return `<h1 tabindex="-1">${esc(t("report.title"))}</h1><p class="msg msg-prompt" role="status">${ICON.info}<span>${esc(t("common.loading"))}</span></p>`;
  if (r.status === "missing") {
    return `<h1 tabindex="-1">${esc(t("report.title"))}</h1>
      <div class="empty card"><p class="notice-title">${esc(t("report.notFoundTitle"))}</p><p>${esc(t("report.notFoundText"))}</p></div>`;
  }
  if (r.status === "error") {
    return `<h1 tabindex="-1">${esc(t("report.title"))}</h1>${notice("err", null, t("report.loadFailed"), `<button type="button" class="btn" id="report-retry">${esc(t("common.retry"))}</button>`)}`;
  }
  const s = r.shift, x = r.results;
  const check = (label, value, target, ok) => `<li class="check ${ok ? "check-ok" : "check-bad"}">${ok ? ICON.ok : ICON.warn}
      <div><p class="check-label">${tBold("report.checkLine", { label, value, target }, "value")}</p>
      <p class="check-verdict">${esc(ok ? t("report.yes") : t("report.no"))}</p></div></li>`;
  const stopCheck = x.longestStop === null
    ? `<li class="check check-ok">${ICON.ok}<div><p class="check-label">${tBold("report.checkLine", { label: t("report.stop"), value: t("report.noStops"), target: t("report.stopTarget") }, "value")}</p>
      <p class="check-verdict">${esc(t("report.yes"))}</p></div></li>`
    : check(t("report.stop"), t("common.hours", { n: fmt(x.longestStop, 1) }), t("report.stopTarget"), x.stopWithinLimit);
  return `<h1 tabindex="-1">${esc(t("report.title"))}</h1>
    <p class="lead">${esc(t("report.subtitle", { field: s.field, date: fmtDate(s.date) }))}</p>
    <p class="muted">${esc(t("report.readOnly"))}</p>
    <dl class="figures">
      <div><dt>${esc(t("report.ha"))}</dt><dd>${esc(t("common.ha", { n: fmt(s.hectares, 1) }))}</dd></div>
      <div><dt>${esc(t("report.used"))}</dt><dd>${esc(t("common.l", { n: fmt(s.litresSpot, 1) }))}</dd></div>
      <div><dt>${esc(t("report.broadcast"))}</dt><dd>${esc(t("common.l", { n: fmt(x.broadcastLitres, 1) }))}</dd></div>
      <div><dt>${esc(t("report.saved"))}</dt><dd>${esc(t("common.l", { n: fmt(x.litresSaved, 1) }))}</dd></div>
      <div><dt>${esc(t("report.tenge"))}</dt><dd>${esc(kzt(x.tengeSaved))}</dd></div>
    </dl>
    <h2>${esc(t("report.checks"))}</h2>
    <ul class="checks">
      ${check(t("report.saving"), pct(x.saving), t("report.savingTarget"), x.passesSaving)}
      ${check(t("report.spot"), pct(x.spotShare), t("report.spotTarget"), x.passesSpotShare)}
      ${stopCheck}
    </ul>
    ${s.stops.length ? `<h2>${esc(t("report.stopsTitle"))}</h2><ul class="plain">${s.stops.map((st) =>
      `<li>${esc(t("report.stopItem", { what: st.what || t("report.stopNoText"), hours: t("common.hours", { n: fmt(st.hours, 1) }) }))}</li>`).join("")}</ul>` : ""}
    <details class="how"><summary>${esc(t("report.how"))}</summary><ul class="plain">
      <li>${esc(t("report.how1"))}</li><li>${esc(t("report.how2"))}</li><li>${esc(t("report.how3"))}</li></ul></details>
    <p>${esc(t("shift.doneText"))}</p>
    <label class="sr-only" for="report-link">${esc(t("report.title"))}</label>
    <input id="report-link" class="linkbox" readonly value="${esc(reportUrl(id))}">
    <button type="button" class="btn" id="copy-link">${esc(t("common.copy"))}</button>
    <p id="copy-status" class="muted" role="status"></p>`;
}
async function loadReport(id) {
  reports[id] = { status: "loading" };
  try {
    const { status, data } = await api(`/api/shifts/${encodeURIComponent(id)}`);
    reports[id] = status === 200 ? { status: "ok", ...data } : status === 404 ? { status: "missing" } : { status: "error" };
  } catch {
    reports[id] = { status: "error" };
  }
  if (location.pathname === `/report/${id}`) render({ keepFocus: true });
}
function bindReport(id) {
  document.getElementById("copy-link")?.addEventListener("click", copyLink);
  document.getElementById("report-retry")?.addEventListener("click", () => { delete reports[id]; render({ keepFocus: true }); });
}

// ---- demo (simulator is loaded only on this screen)
let demo = null;
function demoView() {
  return `<h1 tabindex="-1">${esc(t("demo.title"))}</h1>
    ${notice("warn", null, t("demo.banner"))}
    <p class="lead">${esc(t("demo.lead"))}</p>
    <div id="sim-root"></div>`;
}
async function mountDemo() {
  const mod = await import("./demo.mjs");
  if (location.pathname !== "/demo") return;
  demo = mod.mount(document.getElementById("sim-root"), { lang, t });
}

// ---------------------------------------------------------------- router
const ROUTES = [
  [/^\/$/, () => ({ html: home() })],
  [/^\/calculator$/, () => ({ html: calcView(), bind: bindCalc })],
  [/^\/apply$/, () => ({ html: applyView(), bind: bindApply })],
  [/^\/demo$/, () => ({ html: demoView(), bind: mountDemo })],
  [/^\/report\/?$/, () => ({ html: reportView(null) })],
  [/^\/report\/([a-z2-9]+)$/, (m) => ({ html: reportView(m[1]), bind: () => bindReport(m[1]) })],
  [/^\/team(\/(applications|shift|reports))?\/?$/, (m) => ({ team: m[2] || "" })],
];

function header(path) {
  const link = (href, key) => {
    const current = href === "/" ? path === "/" : path.startsWith(href);
    return `<a href="${href}" data-link${current ? ' aria-current="page"' : ""}>${esc(t(key))}</a>`;
  };
  return `<a class="brand" href="/" data-link><span class="mark" aria-hidden="true"></span><b>OptiSpray</b><span class="tag">Pilot Hub</span></a>
    <div class="lang" role="group" aria-label="${esc(t("lang.label"))}">
      <button type="button" id="lang-en" data-lang="en" aria-pressed="${lang === "en"}" aria-label="${esc(STRINGS.en["lang.en"])}" lang="en">EN</button>
      <button type="button" id="lang-kk" data-lang="kk" aria-pressed="${lang === "kk"}" aria-label="${esc(STRINGS.kk["lang.kk"])}" lang="kk">ҚАЗ</button>
    </div>
    <nav class="nav" aria-label="${esc(t("nav.label"))}">
      ${link("/", "nav.home")}${link("/calculator", "nav.calc")}${link("/apply", "nav.apply")}${link("/demo", "nav.demo")}${link("/team", "nav.team")}
    </nav>`;
}

function applySizes(root = document) {
  root.querySelectorAll("[data-w]").forEach((el) => { el.style.width = el.dataset.w + "%"; });
  root.querySelectorAll("[data-left]").forEach((el) => { el.style.left = el.dataset.left + "%"; });
}

let lastPath = null;
async function render({ keepFocus = false } = {}) {
  const path = location.pathname.replace(/(.)\/+$/, "$1");
  if (demo && path !== "/demo") { demo.unmount(); demo = null; }
  document.documentElement.lang = lang;
  document.title = t("app.title");
  document.getElementById("top").innerHTML = header(path);
  document.getElementById("skip").textContent = t("nav.skip");
  document.getElementById("foot").textContent = t("foot.text");

  if (path === "/apply" && path !== lastPath) {
    if (state.applyStatus === "done") resetApply();
    carryOver();
  }
  let view = null;
  for (const [re, fn] of ROUTES) { const m = path.match(re); if (m) { view = fn(m); break; } }
  if (!view) { navigate("/", { replace: true }); return; }

  if ("team" in view) {
    const sess = state.session || (await ensureSession());
    if (location.pathname.replace(/(.)\/+$/, "$1") !== path) return; // navigated away meanwhile
    if (!sess.loggedIn) view = { html: loginView(), bind: bindLogin };
    else if (view.team === "") { navigate("/team/applications", { replace: true }); return; }
    else view = view.team === "applications" ? { html: appsView() } : view.team === "shift" ? { html: shiftView(), bind: bindShift } : { html: reportsView() };
  }

  const main = document.getElementById("main");
  const active = keepFocus && document.activeElement && document.activeElement.id;
  if (demo && path === "/demo") { demo.setLang(lang, t); updateDemoText(); }
  else { main.innerHTML = view.html; applySizes(main); if (view.bind) view.bind(); }
  bindTeamCommon();

  if (path !== lastPath) {
    lastPath = path;
    if (!keepFocus) main.querySelector("h1")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } else if (active) {
    document.getElementById(active)?.focus({ preventScroll: true });
  }
}

function updateDemoText() {
  const main = document.getElementById("main");
  main.querySelector("h1").textContent = t("demo.title");
  main.querySelector(".notice p").textContent = t("demo.banner");
  main.querySelector(".lead").textContent = t("demo.lead");
}

function bindTeamCommon() {
  document.getElementById("sign-out")?.addEventListener("click", async () => {
    try { await api("/api/logout", { method: "POST", body: {} }); } catch { /* cookie expires anyway */ }
    state.session = { loggedIn: false, configured: true }; state.lists = {};
    navigate("/team");
  });
  document.querySelectorAll("[data-reload]").forEach((b) => b.addEventListener("click", () => { delete state.lists[b.dataset.reload]; render({ keepFocus: true }); }));
}

function navigate(to, { replace = false } = {}) {
  if (replace) history.replaceState(null, "", to); else history.pushState(null, "", to);
  render();
}

function resetApply() {
  state.apply = { name: "", region: "", hectares: "", sprayer: "", boomWidth: "", nozzleSpacing: "", contact: "" };
  state.applyErrors = {}; state.applyStatus = "idle"; state.applyRef = null; state.applyCarried = false;
}

// Whatever was typed into the calculator goes into the application form.
function carryOver() {
  const c = state.calc, a = state.apply;
  let carried = false;
  if (c.boom && !a.boomWidth) { a.boomWidth = String(c.boom); carried = true; }
  if (c.hectares && !a.hectares) { a.hectares = c.hectares; carried = true; }
  if (carried) state.applyCarried = true;
}

document.addEventListener("click", (ev) => {
  const a = ev.target.closest("a[data-link]");
  if (a && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && ev.button === 0) {
    ev.preventDefault();
    if (a.getAttribute("href") !== location.pathname) navigate(a.getAttribute("href"));
    return;
  }
  const b = ev.target.closest("[data-lang]");
  if (b) setLang(b.dataset.lang);
});
window.addEventListener("popstate", () => render());
render();
