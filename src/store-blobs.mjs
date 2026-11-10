// Storage on Netlify: one Netlify Blobs store per collection, strong consistency
// so a new application is visible in the team list straight away.
import { getStore } from "@netlify/blobs";

const stores = {};
const s = (col) => (stores[col] ||= getStore({ name: `optispray-${col}`, consistency: "strong" }));

export const blobStore = {
  put: (col, key, obj) => s(col).setJSON(key, obj),
  get: (col, key) => s(col).get(key, { type: "json" }),
  del: (col, key) => s(col).delete(key),
  async list(col) {
    const { blobs } = await s(col).list();
    const items = await Promise.all(blobs.map((b) => s(col).get(b.key, { type: "json" })));
    return items.filter(Boolean);
  },
};
