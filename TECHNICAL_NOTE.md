# OptiSpray Pilot Hub: technical note

**Live URL:** {{LIVE_URL}} · **Repository:** https://github.com/fols15/optispray-pilot-hub
**Test credentials (team area, `/team`):** {{CREDENTIALS}}

## Platform
Netlify, free plan: static files from Netlify's CDN, one serverless function (Node.js 22) for `/api/*`, and Netlify Blobs for storage. No build step and no framework. Every push to `main` on GitHub redeploys the site.

## Architecture
- **Browser.** One HTML page with four ES modules: `app.mjs` (screens, router, forms), `i18n.mjs` (every English and Kazakh string), `rules.mjs` (fixed figures, payback arithmetic, validation) and `demo.mjs` (the simulator, loaded only on `/demo`).
- **Server.** `netlify/functions/api.mjs` passes each request to `src/core.mjs`. The server imports the same `rules.mjs`, so the browser checks cannot be bypassed and both sides compute identical results.
- **API.** `POST /api/applications` (public) · `GET /api/applications` (team) · `POST /api/login`, `/api/logout`, `GET /api/session` · `POST` and `GET /api/shifts` (team) · `GET /api/shifts/{id}` (public, by link).

## Storage
Netlify Blobs, strong consistency. Store `applications`: key = reference number `OPS-XXXXXX`. Store `shifts`: key = 20-character random id (about 100 bits, cannot be guessed); report figures are recomputed from the raw shift on every read. Store `ratelimit`: request counters keyed by a salted hash of the address; no IP address is stored. Only the fields listed in the brief are saved, and calculator inputs stay in the browser unless they are carried into an application.

## Security and privacy
Validation on both sides; JSON only, 8 KB body limit, same-origin check. Rate limits per address: 5 applications per hour, 10 sign-in attempts per 15 minutes, 60 shifts per hour. One team account: password from an environment variable, session in an HMAC-signed HttpOnly, Secure, SameSite=Strict cookie for 12 hours. Content Security Policy allows only the site itself; fonts are self-hosted; no analytics, trackers or third-party requests.

## Accessibility and languages
Touch targets of 44 px or more, labels tied to inputs, errors shown with icon and text, not by colour alone, and linked through `aria-describedby`. Works at 390 px and with the keyboard. Checked with axe-core (WCAG 2.1 A/AA) on every screen in both languages. Language choice is remembered and sets `<html lang>`.

## Dependencies
Runtime: `@netlify/blobs` 11.1.6. Fonts: IBM Plex Sans and IBM Plex Sans Condensed (SIL Open Font License). Tests: the built-in Node test runner (23 unit and API tests); optional Playwright and axe-core script that walks the full journey in both languages, including the six boundary and error cases.

## Deployment
GitHub repository → Netlify "Import from Git" → environment variable `TEAM_PASSWORD` → deploy. Local copy: `npm install`, `npm run dev`; it runs the same API code with JSON files instead of Blobs.

## Limitations
- The Kazakh text is a draft until a native speaker reviews `docs/kk-review.xlsx`.
- One shared team account, with no roles and no audit log. Applicants cannot edit or delete an application online; they ask the team.
- No offline mode. A shift typed without signal stays on the page until it is sent, but is lost if the page is closed.
- Rate-limit counters are read then written, not atomic, and old counters are not cleaned up. Lists load every record. Both are fine at pilot scale, not at thousands of records.
- Netlify Blobs keeps data in the USA (us-east-2). Before a real launch, Kazakhstan's personal data law requires storing citizens' personal data on servers in Kazakhstan.
- The demo is generated sample data. Its 1-to-10 sensitivity slider is kept from the earlier prototype, although 6 of 12 respondents found it confusing.
