// Storage for local development and tests: one JSON file per record under a folder.
import { mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

export function fileStore(dir) {
  const safe = (k) => String(k).replace(/[^A-Za-z0-9_-]/g, "_");
  const path = (col, key) => join(dir, col, safe(key) + ".json");
  return {
    async put(col, key, obj) {
      await mkdir(join(dir, col), { recursive: true });
      await writeFile(path(col, key), JSON.stringify(obj, null, 2));
    },
    async get(col, key) {
      try { return JSON.parse(await readFile(path(col, key), "utf8")); } catch { return null; }
    },
    async del(col, key) { await rm(path(col, key), { force: true }); },
    async list(col) {
      let names = [];
      try { names = await readdir(join(dir, col)); } catch { return []; }
      const out = [];
      for (const n of names) if (n.endsWith(".json")) out.push(JSON.parse(await readFile(join(dir, col, n), "utf8")));
      return out;
    },
  };
}

// In-memory version used by the unit tests.
export function memoryStore() {
  const data = new Map();
  const m = (col) => (data.has(col) ? data.get(col) : data.set(col, new Map()).get(col));
  return {
    put: async (col, key, obj) => void m(col).set(key, structuredClone(obj)),
    get: async (col, key) => (m(col).has(key) ? structuredClone(m(col).get(key)) : null),
    del: async (col, key) => void m(col).delete(key),
    list: async (col) => [...m(col).values()].map((v) => structuredClone(v)),
  };
}
