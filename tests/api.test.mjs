// API tests against the shared handler with an in-memory store: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle, LIMITS } from "../src/core.mjs";
import { memoryStore } from "../src/store-file.mjs";

const env = { TEAM_USER: "pilot-team", TEAM_PASSWORD: "test-password-123", RATE_SALT: "t" };
function setup(ip = "10.0.0.1") {
  const store = memoryStore();
  let now = Date.parse("2026-06-11T08:00:00Z");
  const deps = { store, env, ip, now: () => now };
  const call = (method, path, body, headers = {}) =>
    handle(new Request("https://hub.example" + path, {
      method,
      headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    }), deps);
  return { store, deps, call, tick: (ms) => { now += ms; } };
}
const app = { name: "Test Person", region: "akmola", hectares: "5000", sprayer: "Amazone UX", boomWidth: "36", nozzleSpacing: "50", contact: "test@example.kz" };
const shift = { field: "Field 7", date: "2026-06-10", hectares: "200", litresSpot: "260", broadcastRate: "2", spotMinutes: "450", totalMinutes: "480", stops: [] };

async function login(call) {
  const r = await call("POST", "/api/login", { user: "pilot-team", password: "test-password-123" });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  return cookie.split(";")[0];
}

test("an application is stored, gets a reference and is retrievable by the team", async () => {
  const { call } = setup();
  const r = await call("POST", "/api/applications", app);
  assert.equal(r.status, 201);
  const { ref } = await r.json();
  assert.match(ref, /^OPS-[2-9A-HJKMNP-Z]{6}$/);

  assert.equal((await call("GET", "/api/applications")).status, 401);
  const cookie = await login(call);
  const list = await (await call("GET", "/api/applications", null, { cookie })).json();
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].ref, ref);
  assert.equal(list.items[0].contact, "test@example.kz");
  assert.equal(list.items[0].hectares, 5000);
});

test("invalid applications are refused with per-field codes", async () => {
  const { call, store } = setup();
  const r = await call("POST", "/api/applications", { ...app, hectares: "-3", contact: "" });
  assert.equal(r.status, 422);
  const body = await r.json();
  assert.equal(body.fields.hectares, "negative");
  assert.equal(body.fields.contact, "required");
  assert.equal((await store.list("applications")).length, 0);
});

test("only JSON from the same origin is accepted", async () => {
  const { call } = setup();
  const r1 = await handle(new Request("https://hub.example/api/applications", { method: "POST", headers: { "content-type": "text/plain" }, body: "x" }), setup().deps);
  assert.equal(r1.status, 415);
  const r2 = await call("POST", "/api/applications", app, { origin: "https://evil.example" });
  assert.equal(r2.status, 403);
  const big = await call("POST", "/api/applications", { ...app, name: "x".repeat(9000) });
  assert.equal(big.status, 413);
});

test("applications are rate-limited per address", async () => {
  const { call, tick } = setup("10.0.0.9");
  for (let i = 0; i < LIMITS.application.max; i++) assert.equal((await call("POST", "/api/applications", app)).status, 201);
  assert.equal((await call("POST", "/api/applications", app)).status, 429);
  tick(LIMITS.application.windowSec * 1000);
  assert.equal((await call("POST", "/api/applications", app)).status, 201);
});

test("wrong logins fail and are rate-limited", async () => {
  const { call } = setup("10.0.0.7");
  assert.equal((await call("POST", "/api/login", { user: "pilot-team", password: "nope" })).status, 401);
  for (let i = 1; i < LIMITS.login.max; i++) await call("POST", "/api/login", { user: "x", password: "y" });
  assert.equal((await call("POST", "/api/login", { user: "pilot-team", password: "test-password-123" })).status, 429);
});

test("a forged or expired session is refused", async () => {
  const { call, tick } = setup();
  assert.equal((await call("GET", "/api/shifts", null, { cookie: "ops_session=abc.def" })).status, 401);
  const cookie = await login(call);
  assert.equal((await call("GET", "/api/shifts", null, { cookie })).status, 200);
  tick(13 * 3600e3);
  assert.equal((await call("GET", "/api/shifts", null, { cookie })).status, 401);
});

test("login without a configured password is unavailable", async () => {
  const r = await handle(new Request("https://hub.example/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
    { store: memoryStore(), env: {}, ip: "1", now: () => Date.now() });
  assert.equal(r.status, 503);
});

test("a shift is logged by the team and its report opens by link without login", async () => {
  const { call } = setup();
  assert.equal((await call("POST", "/api/shifts", shift)).status, 401);
  const cookie = await login(call);
  const r = await call("POST", "/api/shifts", shift, { cookie });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  assert.match(id, /^[a-z2-9]{20}$/);
  const rep = await call("GET", `/api/shifts/${id}`);
  assert.equal(rep.status, 200);
  const data = await rep.json();
  assert.ok(Math.abs(data.results.saving - 0.35) < 1e-9);
  assert.equal(data.results.tengeSaved, 385000);
  assert.equal((await call("GET", "/api/shifts/aaaaaaaaaaaaaaaaaaaa")).status, 404);
});

test("the server refuses a shift with a saving above 41%", async () => {
  const { call } = setup();
  const cookie = await login(call);
  const r = await call("POST", "/api/shifts", { ...shift, litresSpot: "100" }, { cookie });
  assert.equal(r.status, 422);
  assert.equal((await r.json()).fields.litresSpot, "saving_too_high");
});

test("a storage failure returns 500 and stores nothing", async () => {
  const { deps } = setup();
  deps.store.put = async () => { throw new Error("disk full"); };
  const r = await handle(new Request("https://hub.example/api/applications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(app) }), deps);
  assert.equal(r.status, 500);
});
