// Netlify entry point: every /api/* request goes to the shared handler,
// with Netlify Blobs as storage and the client address from Netlify.
import { handle } from "../../src/core.mjs";
import { blobStore } from "../../src/store-blobs.mjs";

export default async (req, context) =>
  handle(req, {
    store: blobStore,
    env: process.env,
    ip: context.ip,
    now: () => Date.now(),
  });

export const config = { path: "/api/*" };
