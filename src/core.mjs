// The whole API in one function: handle(request, deps) -> Response.
// It runs unchanged on Netlify (netlify/functions/api.mjs) and on the local
// dev server (dev-server.mjs); only the storage adapter differs.
//
// deps = { store, env, ip, now }
//   store: { put(col, key, obj), get(col, key), list(col), del(col, key) }
import { randomBytes, createHash } from "node:crypto";
import { checkApplication, checkShift, shiftResults } from "../public/js/rules.mjs";
import { checkLogin, loginConfigured, makeSession, readSession, sessionCookie, clearCookie, cookieValue } from "./auth.mjs";

const MAX_BODY = 8 * 1024;
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O, 1/I/L

// Requests allowed per client address in each window.
export const LIMITS = {
  application: { max: 5, windowSec: 3600 },
  login: { max: 10, windowSec: 900 },
  shift: { max: 60, windowSec: 3600 },
};

function code(n, alphabet = ALPHABET) {
  const bytes = randomBytes(n);
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s;
}
export const newRef = () => `OPS-${code(6)}`;
export const newReportId = () => code(20, "abcdefghijkmnpqrstuvwxyz23456789"); // ~100 bits

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

// Fixed-window counter per (bucket, hashed address). The address itself is never stored.
async function limited(deps, bucket) {
  const { max, windowSec } = LIMITS[bucket];
  const now = deps.now();
  const win = Math.floor(now / 1000 / windowSec);
  const who = createHash("sha256").update((deps.env.RATE_SALT || "ops") + "|" + (deps.ip || "unknown")).digest("hex").slice(0, 24);
  const key = `${bucket}-${who}-${win}`;
  const rec = (await deps.store.get("ratelimit", key)) || { n: 0 };
  if (rec.n >= max) return true;
  await deps.store.put("ratelimit", key, { n: rec.n + 1, until: (win + 1) * windowSec * 1000 });
  return false;
}

async function readJson(req) {
  const type = req.headers.get("content-type") || "";
  if (!type.includes("application/json")) return { error: json(415, { error: "json_only" }) };
  const text = await req.text();
  if (text.length > MAX_BODY) return { error: json(413, { error: "too_large" }) };
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    return { body };
  } catch {
    return { error: json(400, { error: "bad_json" }) };
  }
}

// A browser on another site cannot send JSON here without CORS, but check the Origin too.
function sameOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

function isSecure(req) {
  return new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
}

function session(req, deps) {
  return readSession(deps.env, cookieValue(req.headers.get("cookie")), deps.now());
}

export async function handle(req, deps) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = req.method;

  if (method !== "GET" && method !== "HEAD" && !sameOrigin(req)) return json(403, { error: "origin" });

  try {
    // ---- pilot application (public) ----
    if (path === "/api/applications" && method === "POST") {
      if (await limited(deps, "application")) return json(429, { error: "rate_limited" });
      const { body, error } = await readJson(req);
      if (error) return error;
      const r = checkApplication(body);
      if (!r.ok) return json(422, { error: "invalid", fields: r.errors });
      let ref = newRef();
      for (let i = 0; i < 5 && (await deps.store.get("applications", ref)); i++) ref = newRef();
      await deps.store.put("applications", ref, { ref, createdAt: new Date(deps.now()).toISOString(), ...r.value });
      return json(201, { ref });
    }

    if (path === "/api/applications" && method === "GET") {
      if (!session(req, deps)) return json(401, { error: "login" });
      const items = await deps.store.list("applications");
      items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return json(200, { items });
    }

    // ---- team login ----
    if (path === "/api/session" && method === "GET") {
      return json(200, { loggedIn: Boolean(session(req, deps)), configured: loginConfigured(deps.env) });
    }

    if (path === "/api/login" && method === "POST") {
      if (await limited(deps, "login")) return json(429, { error: "rate_limited" });
      const { body, error } = await readJson(req);
      if (error) return error;
      if (!loginConfigured(deps.env)) return json(503, { error: "login_not_configured" });
      if (!checkLogin(deps.env, String(body.user || ""), String(body.password || ""))) {
        return json(401, { error: "wrong_login" });
      }
      return json(200, { loggedIn: true }, { "set-cookie": sessionCookie(makeSession(deps.env, deps.now()), isSecure(req)) });
    }

    if (path === "/api/logout" && method === "POST") {
      return json(200, { loggedIn: false }, { "set-cookie": clearCookie(isSecure(req)) });
    }

    // ---- shift log (team) and shift reports (public by link) ----
    if (path === "/api/shifts" && method === "POST") {
      if (!session(req, deps)) return json(401, { error: "login" });
      if (await limited(deps, "shift")) return json(429, { error: "rate_limited" });
      const { body, error } = await readJson(req);
      if (error) return error;
      const r = checkShift(body, new Date(deps.now()));
      if (!r.ok) return json(422, { error: "invalid", fields: r.errors });
      const id = newReportId();
      await deps.store.put("shifts", id, { id, createdAt: new Date(deps.now()).toISOString(), ...r.value });
      return json(201, { id });
    }

    if (path === "/api/shifts" && method === "GET") {
      if (!session(req, deps)) return json(401, { error: "login" });
      const items = (await deps.store.list("shifts")).map((s) => ({ ...s, results: shiftResults(s) }));
      items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return json(200, { items });
    }

    const m = path.match(/^\/api\/shifts\/([a-z2-9]{20})$/);
    if (m && method === "GET") {
      const s = await deps.store.get("shifts", m[1]);
      if (!s) return json(404, { error: "not_found" });
      return json(200, { shift: s, results: shiftResults(s) });
    }

    return json(404, { error: "no_route" });
  } catch (e) {
    console.error("api error", e);
    return json(500, { error: "server" });
  }
}
