// Local server for development, tests and the screen recording.
// Same API code as on Netlify (src/core.mjs); records are kept as JSON files in .data/.
//   npm run dev            -> http://localhost:8888
//   TEAM_PASSWORD=... PORT=... DATA_DIR=... node dev-server.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "./src/core.mjs";
import { fileStore } from "./src/store-file.mjs";

const ROOT = fileURLToPath(new URL("./public/", import.meta.url));
const PORT = Number(process.env.PORT || 8888);
const env = {
  TEAM_USER: process.env.TEAM_USER || "pilot-team",
  TEAM_PASSWORD: process.env.TEAM_PASSWORD || "local-only-password",
  RATE_SALT: "local",
};
const store = fileStore(process.env.DATA_DIR || ".data");
const SPA = /^\/(calculator|apply|demo|team(\/.*)?|report(\/.*)?)?$/;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".json": "application/json", ".txt": "text/plain; charset=utf-8",
};
const SECURITY = {
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "x-frame-options": "DENY",
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      const r = await handle(request, { store, env, ip: req.socket.remoteAddress, now: () => Date.now() });
      const headers = Object.fromEntries(r.headers);
      res.writeHead(r.status, { ...SECURITY, ...headers });
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let file = SPA.test(url.pathname) ? "index.html" : normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
    if (file.includes("..")) throw Object.assign(new Error("bad path"), { code: "ENOENT" });
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, { ...SECURITY, "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch (e) {
    if (e.code === "ENOENT" || e.code === "EISDIR") {
      const body = await readFile(join(ROOT, "404.html"));
      res.writeHead(404, { ...SECURITY, "content-type": TYPES[".html"] });
      res.end(body);
    } else {
      console.error(e);
      res.writeHead(500);
      res.end("server error");
    }
  }
}).listen(PORT, () => console.log(`OptiSpray Pilot Hub on http://localhost:${PORT}  (team login: ${env.TEAM_USER} / ${env.TEAM_PASSWORD})`));
