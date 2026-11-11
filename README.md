# OptiSpray Pilot Hub

**Live:** https://strong-malasada-e5acc3.netlify.app

A small bilingual web app (English and Kazakh) for the OptiSpray pilot:

- **Farm owners** check payback with their own figures and apply for a pilot on their own field.
  Each application is stored on the server and gets a reference number.
- **The pilot team** (agronomist, operator) logs each shift. The app computes the herbicide
  saving and the spot-mode share and gives a read-only report link for the farm owner.
- **Demo**: the cab-screen simulator from the earlier prototype, clearly labelled as a simulation
  with sample data.

Student project for Technology Entrepreneurship (Astana IT University).
See [TECHNICAL_NOTE.md](TECHNICAL_NOTE.md) for platform, architecture, storage and limitations.

## Run it locally

Needs Node.js 22.12 or newer. No build step.

```bash
npm install
npm run dev          # http://localhost:8888
npm test             # unit and API tests
```

Local team login: `pilot-team` / `local-only-password` (set `TEAM_PASSWORD` to change it).
Local records are written as JSON files to `.data/`.

Optional browser check of the whole journey in both languages (needs Playwright with Chromium):

```bash
node scripts/e2e.mjs http://localhost:8888 path/to/axe.min.js
```

## Deploy on Netlify

1. On Netlify: **Add new project → Import an existing project → GitHub →** this repository.
   Build settings come from `netlify.toml` (no build command, publish `public`, functions `netlify/functions`).
2. **Project configuration → Environment variables**, add:
   - `TEAM_PASSWORD`: the team password (at least 8 characters)
   - optional `TEAM_USER` (default `pilot-team`) and `SESSION_SECRET`
3. Deploy. Storage (Netlify Blobs) needs no setup.

Test credentials for examiners are given in the submitted copy of the technical note, not in this
public repository. Change `TEAM_PASSWORD` after the defence.

## Where things are

| Path | What it is |
|---|---|
| `public/index.html` | The single HTML page |
| `public/js/app.mjs` | Screens, router, forms |
| `public/js/i18n.mjs` | **All text, English and Kazakh, in one file** |
| `public/js/rules.mjs` | Fixed figures, payback arithmetic, validation (shared with the server) |
| `public/js/demo.mjs` | The cab-screen simulator (sample data only) |
| `public/css/app.css` | Styles; fonts are self-hosted in `public/fonts/` |
| `netlify/functions/api.mjs` | Netlify entry point for `/api/*` |
| `src/core.mjs` | The API: routes, validation, rate limits |
| `src/auth.mjs` | Team login with a signed cookie |
| `src/store-blobs.mjs`, `src/store-file.mjs` | Storage on Netlify Blobs / local files |
| `dev-server.mjs` | Local server using the same API code |
| `tests/` | Unit and API tests (`npm test`) |
| `docs/kk-review.xlsx` | Every string side by side for the Kazakh review |
