// End-to-end check of the full journey in a phone-sized browser, in both languages,
// including the six boundary and error cases from the brief.
// Needs Playwright with Chromium (and optionally axe-core for an accessibility scan):
//   node dev-server.mjs &   then   node scripts/e2e.mjs http://localhost:8888 [path/to/axe.min.js]
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:8888";
const AXE = process.argv[3] ? readFileSync(process.argv[3], "utf8") : null;
const USER = process.env.TEAM_USER || "pilot-team", PASS = process.env.TEAM_PASSWORD || "local-only-password";
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok   " : "  FAIL ") + msg); if (!cond) failures++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, bypassCSP: Boolean(AXE) }); // CSP blocks the injected axe script
const page = await ctx.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) consoleErrors.push(m.text()); });
const text = () => page.locator("main").innerText();

async function audit(label) {
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(width <= 390, `${label}: no horizontal scroll at 390 px (${width})`);
  const small = await page.evaluate(() => [...document.querySelectorAll("main a, main button, main input, main select, header a, header button, .choice")]
    .filter((el) => el.offsetParent && !el.closest(".sim .nozz") && el.type !== "radio" && el.type !== "hidden")
    .map((el) => { const r = el.getBoundingClientRect(); return { t: (el.textContent || el.id || el.name).trim().slice(0, 30), w: r.width, h: r.height }; })
    .filter((r) => r.h < 44 || r.w < 44));
  ok(small.length === 0, `${label}: touch targets at least 44x44 ${small.length ? JSON.stringify(small) : ""}`);
  if (AXE) {
    await page.addScriptTag({ content: AXE });
    const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] })).violations.map((v) => `${v.id}: ${v.nodes.length}`));
    ok(res.length === 0, `${label}: axe WCAG A/AA ${res.join(", ")}`);
  }
}

async function journey(lang) {
  console.log(`\n== ${lang.toUpperCase()} ==`);
  await page.goto(BASE + "/");
  await page.click(`#lang-${lang}`);
  ok((await page.getAttribute("html", "lang")) === lang, "html lang attribute updated");
  await audit("home");

  // --- calculator: nothing pre-filled
  await page.click('a[href="/calculator"] >> nth=0');
  ok((await page.inputValue("#c-ha")) === "" && (await page.inputValue("#c-cost")) === "" && !(await page.isChecked('input[value="36"]')) && !(await page.isChecked('input[value="24"]')), "calculator starts empty");
  await page.click('#calc-form button[type="submit"]');
  let main = await text();
  ok(!(await page.locator("#calc-result h2").count()), "1. empty input gives prompts, no result");
  ok(!/Infinity|NaN|∞/.test(main), "1. no infinity or NaN on the page");
  await page.locator(".choice").nth(1).click();
  await page.fill("#c-cost", "5500");
  await page.fill("#c-ha", "0");
  await page.click('#calc-form button[type="submit"]');
  ok(!(await page.locator("#calc-result h2").count()) && /hectare|гектар/i.test(await page.locator("#c-ha-msg").innerText()), "1. zero hectares gives a prompt, not a result");
  await page.fill("#c-ha", "-500");
  await page.click('#calc-form button[type="submit"]');
  const neg = await page.locator("#c-ha-msg").innerText();
  ok(lang === "en" ? /negative/.test(neg) : /теріс/.test(neg), `2. negative rejected in ${lang}: "${neg}"`);
  await page.fill("#c-ha", "abc");
  await page.click('#calc-form button[type="submit"]');
  const nan = await page.locator("#c-ha-msg").innerText();
  ok(lang === "en" ? /digits/.test(nan) : /цифр/.test(nan), `2. non-numeric rejected in ${lang}: "${nan}"`);
  await page.fill("#c-ha", "3000");
  await page.click('#calc-form button[type="submit"]');
  main = await text();
  ok(lang === "en" ? /Above the two-season limit/.test(main) && /3,100 ha/.test(main) && /4,300 ha/.test(main)
    : /шектен асады/.test(main) && /3 100/.test(main) && /4 300/.test(main), "3. below threshold gives an explicit warning with thresholds");
  await page.fill("#c-ha", "6000");
  await page.waitForTimeout(100);
  main = await text();
  ok(/1[.,]4/.test(main) && /1[.,]1/.test(main), "result shows 30% and 40% paybacks (1.4 and 1.1 seasons)");
  ok(lang === "en" ? /14,300,000/.test(main) : /14\s300\s000/.test(main), "kit price shown");
  ok(!/4[2-9]%|[5-9]\d%/.test(main), "no saving above 41% shown");
  await audit("calculator result");

  // --- application
  await page.click("#to-apply");
  ok((await page.inputValue("#boomWidth")) === "36" && (await page.inputValue("#hectares")) === "6000", "calculator figures carried into the application");
  await page.click('#apply-form button[type="submit"]');
  const nameMsg = await page.locator("#name-msg").innerText();
  ok(nameMsg.length > 3 && (await page.getAttribute("#name", "aria-invalid")) === "true", `4. blank required field gives an inline error: "${nameMsg}"`);
  ok(await page.locator("#summary").isVisible(), "4. error summary shown");
  await page.fill("#name", lang === "en" ? "Test Owner" : "Сынақ Иесі");
  await page.selectOption("#region", "kostanay");
  await page.fill("#sprayer", "Test sprayer X");
  await page.fill("#nozzleSpacing", "50");
  await page.fill("#contact", "+7 700 000 00 00");
  // failed save: block the request once
  await page.route("**/api/applications", (route) => route.abort());
  await page.click('#apply-form button[type="submit"]');
  await page.waitForSelector("#apply-retry");
  main = await text();
  ok((lang === "en" ? /Not sent yet/.test(main) : /жіберілген жоқ/.test(main)) && (await page.inputValue("#name")).length > 3, "6. failed save keeps the answers and says not sent");
  await page.unroute("**/api/applications");
  await page.click("#apply-retry");
  await page.waitForSelector("#ref");
  const ref = (await page.locator("#ref").innerText()).trim();
  ok(/^OPS-[A-Z0-9]{6}$/.test(ref), `application stored, reference ${ref}`);
  await audit("application sent");

  // --- team: login, list, shift log, report
  await page.goto(BASE + "/team");
  await page.fill("#user", USER); await page.fill("#password", "wrong-password");
  await page.click('#login-form button[type="submit"]');
  await page.waitForSelector(".summary");
  ok(true, "wrong password rejected");
  await page.fill("#password", PASS);
  await page.click('#login-form button[type="submit"]');
  await page.waitForSelector(".item .ref");
  ok((await text()).includes(ref), "application retrievable in the team list");
  await page.reload();
  await page.waitForSelector(".item .ref");
  ok((await text()).includes(ref), "still there after a refresh (stored on the server)");

  await page.click('a[href="/team/shift"]');
  await page.fill("#field", lang === "en" ? "Field 7" : "7-алқап");
  await page.fill("#hectares", "200");
  await page.fill("#litresSpot", "150");
  await page.fill("#broadcastRate", "2");
  await page.fill("#spotMinutes", "430");
  await page.fill("#totalMinutes", "480");
  await page.click("#add-stop");
  await page.fill("#stop-what-0", lang === "en" ? "Blocked filter" : "Сүзгі бітелді");
  await page.fill("#stop-hours-0", "1,5");
  await page.click('#shift-form button[type="submit"]');
  const hi = await page.locator("#litresSpot-msg").innerText();
  ok(/41/.test(hi), `saving above 41% refused: "${hi}"`);
  ok(!/62%/.test(await text()), "the refused saving is not displayed");
  await page.fill("#litresSpot", "260");
  await page.click('#shift-form button[type="submit"]');
  await page.waitForSelector("#report-link");
  const link = await page.inputValue("#report-link");
  ok(/\/report\/[a-z2-9]{20}$/.test(link), "shift saved, report link given");

  const owner = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const op = await owner.newPage();
  await op.goto(BASE + "/"); await op.click(`#lang-${lang}`);
  await op.goto(link);
  await op.waitForSelector(".checks");
  const rep = await op.locator("main").innerText();
  ok(/35[.,]0%/.test(rep) && /90%/.test(rep) && /48/.test(rep) && (lang === "en" ? /385,000/.test(rep) : /385\s000/.test(rep)), "owner opens the report by link without login: 35%, 385,000 KZT");
  await owner.close();
  await page.goto(link); await page.waitForSelector(".checks");
  await audit("report");

  // --- 5. empty states
  await page.goto(BASE + "/report");
  ok((lang === "en" ? /No shift data yet/ : /деректері әзірге жоқ/).test(await text()), "5. report page with no data shows a written empty state");
  await page.goto(BASE + "/report/aaaaaaaaaaaaaaaaaaaa");
  await page.waitForSelector(".empty");
  ok(true, "unknown report link shows a written message");

  await page.goto(BASE + "/demo");
  await page.waitForSelector(".sim .big");
  main = await text();
  ok(lang === "en" ? /simulation, not live hardware/.test(main) : /симуляция/.test(main), "demo labelled as a simulation");
  await page.click("#btn-start"); await page.waitForTimeout(1200);
  const share = parseInt(await page.locator("#r-share").innerText(), 10);
  ok(share >= 59, `demo never implies a saving above 41% (sprayed share ${share}%)`);
  await page.click('.rail button[data-go="report"]');
  ok(!/4[2-9]%/.test(await text()), "demo report stays at or below 41%");
  await audit("demo");
  await page.click("#btn-send");
  ok(/(nothing was sent|ештеңе жіберілген жоқ)/.test(await page.locator("#rep-out").innerText()), "demo says nothing is sent");
  await page.click("#sign-out").catch(() => {});
}

// keyboard only: reach the calculator, fill it and submit without the mouse
await page.goto(BASE + "/calculator");
await page.keyboard.press("Tab"); // skip link
let guard = 0;
while (!(await page.evaluate(() => document.activeElement?.name === "boom")) && guard++ < 30) await page.keyboard.press("Tab");
await page.keyboard.press("ArrowRight"); // 24 m -> 36 m
await page.keyboard.press("Tab"); await page.keyboard.type("6000");
await page.keyboard.press("Tab"); await page.keyboard.type("5500");
await page.keyboard.press("Enter");
await page.waitForTimeout(200);
ok(await page.locator("#calc-result h2").count() === 1 && await page.isChecked('input[value="36"]'), "calculator is usable with the keyboard alone");

await journey("en");
await page.goto(BASE + "/team");
if (await page.locator("#sign-out").count()) await page.click("#sign-out");
await journey("kk");
await page.reload();
ok((await page.getAttribute("html", "lang")) === "kk", "language choice remembered after reload");
ok(consoleErrors.length === 0, `no script errors ${consoleErrors.join(" | ")}`);
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
