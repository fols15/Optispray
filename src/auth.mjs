// Team login: one shared account whose password is set as an environment
// variable on the host. Sessions are a signed cookie (no session table).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SESSION_HOURS = 12;
export const COOKIE = "ops_session";

function secretFrom(env) {
  // SESSION_SECRET is optional; without it the key is derived from the password,
  // so changing the password also signs everyone out.
  return env.SESSION_SECRET || createHash("sha256").update("optispray-session:" + env.TEAM_PASSWORD).digest("hex");
}

function same(a, b) {
  const x = createHash("sha256").update(String(a)).digest();
  const y = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(x, y);
}

export function loginConfigured(env) {
  return Boolean(env.TEAM_PASSWORD && env.TEAM_PASSWORD.length >= 8);
}

export function checkLogin(env, user, password) {
  if (!loginConfigured(env)) return false;
  const okUser = same(user, env.TEAM_USER || "pilot-team");
  const okPass = same(password, env.TEAM_PASSWORD);
  return okUser && okPass;
}

const b64 = (s) => Buffer.from(s).toString("base64url");

export function makeSession(env, now = Date.now()) {
  const payload = b64(JSON.stringify({ u: env.TEAM_USER || "pilot-team", exp: now + SESSION_HOURS * 3600e3 }));
  const sig = createHmac("sha256", secretFrom(env)).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readSession(env, token, now = Date.now()) {
  if (!loginConfigured(env) || !token || typeof token !== "string") return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const want = createHmac("sha256", secretFrom(env)).update(payload).digest("base64url");
  if (!same(sig, want)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > now ? data : null;
  } catch {
    return null;
  }
}

export function sessionCookie(token, secure) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${secure ? "; Secure" : ""}`;
}

export function clearCookie(secure) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function cookieValue(header, name = COOKIE) {
  for (const part of String(header || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}
