// Demo: the cab-screen simulator from the earlier prototype.
// Everything here is generated sample data. Nothing is measured, saved or sent.
// Text comes from i18n.mjs (keys starting with "sim.").
import { formatNumber } from "./i18n.mjs";

const MAP_THRESHOLD = 0.23;   // gives a sample map with about 62% of the field sprayed
const SAMPLE_SHARE = 0.62;    // sprayed share in the sample report (38% saving, below the 41% maximum)

function markup() {
  const T = (k) => `data-t="${k}"`;
  return `<div class="sim">
  <p class="sim-tag" ${T("tag")}></p>
  <div class="sim-grid">
    <div class="device">
      <div class="app">
        <nav class="rail" data-aria="railLabel">
          <button type="button" data-go="start" aria-current="page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4l14 8-14 8z"/></svg><span ${T("navStart")}></span></button>
          <button type="button" data-go="check"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg><span ${T("navCheck")}></span></button>
          <button type="button" data-go="spray"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M6 6v3M12 6v3M18 6v3"/><path d="M6 12l-2 7M6 12l2 7M12 12l-2 7M12 12l2 7M18 12l-2 7M18 12l2 7"/></svg><span ${T("navSpray")}></span></button>
          <button type="button" data-go="report"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M9 13h6M9 17h6M9 9h3"/></svg><span ${T("navReport")}></span></button>
          <button type="button" data-go="service"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 0-5-5l2.5 2.5-1 2.5-2.5 1z"/></svg><span ${T("navService")}></span></button>
        </nav>
        <div class="main">
          <div class="status">
            <span class="f" id="st-field"></span>
            <span class="chip"><i></i><span ${T("stSensors")}></span></span>
            <span class="chip"><i></i><span ${T("stGnss")}></span></span>
            <span class="chip"><i></i><span ${T("stOffline")}></span></span>
            <span class="clock" id="clock">--:--</span>
          </div>

          <div class="screen" data-s="start">
            <h2 ${T("startTitle")}></h2>
            <div class="grid2">
              <div class="panel">
                <h3 ${T("fieldJob")}></h3>
                <label class="lbl" for="sel-field" ${T("field")}></label>
                <select id="sel-field"><option value="0"></option><option value="1"></option><option value="2"></option></select>
                <span class="lbl gap" ${T("mode")}></span>
                <div class="cseg" id="mode">
                  <button type="button" aria-pressed="true" data-v="spot" ${T("mSpot")}></button>
                  <button type="button" aria-pressed="false" data-v="spotbg" ${T("mSpotBg")}></button>
                  <button type="button" aria-pressed="false" data-v="broad" ${T("mBroad")}></button>
                </div>
                <span class="lbl gap" ${T("preset")}></span>
                <div class="cseg" id="preset">
                  <button type="button" aria-pressed="true" ${T("pStubble")}></button>
                  <button type="button" aria-pressed="false" ${T("pFallow")}></button>
                  <button type="button" aria-pressed="false" ${T("pPre")}></button>
                </div>
              </div>
              <div class="panel">
                <h3 ${T("product")}></h3>
                <div class="grid2 tight">
                  <div><label class="lbl" for="in-prod" ${T("herb")}></label><select id="in-prod"><option ${T("prod1")}></option><option ${T("prod2")}></option></select></div>
                  <div><label class="lbl" for="in-rate" ${T("rate")}></label><input id="in-rate" type="number" value="2.0" step="0.1" min="0.5" max="5"></div>
                  <div><label class="lbl" for="in-water" ${T("water")}></label><input id="in-water" type="number" value="100" step="10" min="50" max="200"></div>
                  <div><label class="lbl" for="in-price" ${T("price")}></label><input id="in-price" type="number" value="2750" step="50" min="500"></div>
                </div>
                <dl class="kv">
                  <dt ${T("kvSensors")}></dt><dd class="ok" ${T("kvSensorsV")}></dd>
                  <dt ${T("kvValves")}></dt><dd class="ok" ${T("kvValvesV")}></dd>
                  <dt ${T("kvBoom")}></dt><dd ${T("kvBoomV")}></dd>
                  <dt ${T("kvSpare")}></dt><dd ${T("kvSpareV")}></dd>
                </dl>
              </div>
            </div>
            <button type="button" class="big" id="btn-start"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 4l14 8-14 8z"/></svg><span ${T("startPass")}></span></button>
          </div>

          <div class="screen" data-s="check" hidden>
            <h2 ${T("checkTitle")}></h2>
            <div class="panel">
              <h3 ${T("signal")}></h3>
              <div class="sens" id="sens"></div>
              <p class="warn small" id="dust-msg" ${T("dustMsg")}></p>
            </div>
            <div class="grid2">
              <div class="panel">
                <h3 ${T("sensTitle")}></h3>
                <label class="lbl" for="in-sens"><span ${T("sensLbl")}></span>: <b id="sens-v">6</b> / 10</label>
                <input id="in-sens" type="range" min="1" max="10" value="6">
                <p class="dim small" ${T("sensHint")}></p>
              </div>
              <div class="panel">
                <h3 ${T("leafTitle")}></h3>
                <p class="small" ${T("leafHint")}></p>
                <div class="row"><button type="button" class="cbtn primary" id="btn-leaf" ${T("leafBtn")}></button><button type="button" class="cbtn" id="btn-retest" ${T("retest")}></button></div>
                <p id="leaf-out" class="toast" role="status" hidden></p>
              </div>
            </div>
          </div>

          <div class="screen" data-s="spray" hidden>
            <div class="row between">
              <h2 id="spray-title"></h2>
              <div class="row">
                <button type="button" class="cbtn" id="btn-pause" ${T("pause")}></button>
                <button type="button" class="cbtn" id="btn-broad" ${T("toBroad")}></button>
              </div>
            </div>
            <div class="readouts">
              <div class="ro"><b id="r-speed">17.8</b><span ${T("roSpeed")}></span></div>
              <div class="ro"><b id="r-area"></b><span ${T("roArea")}></span></div>
              <div class="ro"><b id="r-share"></b><span ${T("roShare")}></span></div>
              <div class="ro"><b id="r-saved"></b><span ${T("roSaved")}></span></div>
            </div>
            <div class="fieldbox">
              <canvas id="field" role="img" data-aria="fieldLabel"></canvas>
              <div class="nozz" id="nozz" role="img" data-aria="nozzLabel"></div>
            </div>
            <div class="legend"><span><i class="lg-weed"></i><span ${T("lgWeed")}></span></span><span><i class="lg-open"></i><span ${T("lgOpen")}></span></span><span><i class="lg-blk"></i><span ${T("lgBlk")}></span></span></div>
            <div class="alert" id="alert" role="alert" hidden>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5"/><circle cx="12" cy="18" r=".6"/></svg>
              <div>
                <p><b ${T("alTitle")}></b><br><span ${T("alText")}></span></p>
                <div class="row"><button type="button" class="cbtn primary" id="btn-ack" ${T("ack")}></button><button type="button" class="cbtn" id="btn-howclean" ${T("howClean")}></button></div>
                <ol class="steps" id="clean-steps" hidden><li ${T("cl1")}></li><li ${T("cl2")}></li><li ${T("cl3")}></li></ol>
              </div>
            </div>
          </div>

          <div class="screen" data-s="report" hidden>
            <h2 ${T("repTitle")}></h2>
            <div class="readouts">
              <div class="ro"><b id="s-area"></b><span ${T("rArea")}></span></div>
              <div class="ro"><b id="s-share"></b><span ${T("rShare")}></span></div>
              <div class="ro"><b id="s-saved"></b><span ${T("rSaved")}></span></div>
              <div class="ro"><b id="s-kzt"></b><span ${T("rKzt")}></span></div>
            </div>
            <div class="grid2">
              <div class="panel">
                <h3 ${T("mapTitle")}></h3>
                <canvas id="map" width="560" height="300" role="img" data-aria="mapLabel"></canvas>
                <div class="legend"><span><i class="lg-spr"></i><span ${T("mSpr")}></span></span><span><i class="lg-skip"></i><span ${T("mSkip")}></span></span></div>
              </div>
              <div class="panel">
                <h3 ${T("detTitle")}></h3>
                <dl class="kv">
                  <dt ${T("dTime")}></dt><dd>20:05 – 07:40</dd>
                  <dt ${T("dSpeed")}></dt><dd id="d-speed"></dd>
                  <dt ${T("dUsed")}></dt><dd id="d-used"></dd>
                  <dt ${T("dBroad")}></dt><dd id="d-broad"></dd>
                  <dt ${T("dPerHa")}></dt><dd id="d-perha"></dd>
                </dl>
                <h3 class="gap" ${T("evTitle")}></h3>
                <ul class="events"><li ${T("ev1")}></li><li ${T("ev2")}></li></ul>
                <div class="row"><button type="button" class="cbtn" id="btn-usb" ${T("usb")}></button><button type="button" class="cbtn" id="btn-send" ${T("send")}></button></div>
                <p id="rep-out" class="toast" role="status" hidden></p>
              </div>
            </div>
          </div>

          <div class="screen" data-s="service" hidden>
            <h2 ${T("srvTitle")}></h2>
            <div class="grid2">
              <div class="panel">
                <h3 ${T("kitTitle")}></h3>
                <dl class="kv">
                  <dt ${T("kSens")}></dt><dd>2</dd><dt ${T("kValve")}></dt><dd>4</dd>
                  <dt ${T("kFuse")}></dt><dd>6</dd><dt ${T("kCable")}></dt><dd>1</dd>
                </dl>
                <h3 class="gap" ${T("swapTitle")}></h3>
                <ol class="steps"><li ${T("sw1")}></li><li ${T("sw2")}></li><li ${T("sw3")}></li><li ${T("sw4")}></li></ol>
              </div>
              <div class="panel">
                <h3 ${T("reqTitle")}></h3>
                <label class="lbl" for="in-prob" ${T("prob")}></label>
                <select id="in-prob"><option ${T("pr1")}></option><option ${T("pr2")}></option><option ${T("pr3")}></option><option ${T("pr4")}></option></select>
                <div class="row"><button type="button" class="cbtn primary" id="btn-req" ${T("reqBtn")}></button></div>
                <p id="req-out" class="toast" role="status" hidden></p>
                <p class="dim small" ${T("reqNote")}></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <aside class="guide">
      <h2 ${T("gTitle")}></h2>
      <ol><li ${T("g1")}></li><li ${T("g2")}></li><li ${T("g3")}></li><li ${T("g4")}></li><li ${T("g5")}></li></ol>
      <button type="button" class="btn" id="btn-sim" ${T("simBlk")}></button>
      <button type="button" class="btn" id="btn-dust" ${T("simDust")}></button>
      <p class="muted small" ${T("gNote")}></p>
    </aside>
  </div></div>`;
}

export function mount(root, opts) {
  let lang = opts.lang, t = opts.t;
  const s = (k, v) => t("sim." + k, v);
  root.innerHTML = markup();
  const $ = (id) => root.querySelector("#" + id);
  const nf = (n, d = 1) => formatNumber(n, d, lang);

  // ---- screens
  let current = "start", mode = "spot", paused = false, running = false, dusty = true, blocked = -1;
  function go(name) {
    current = name;
    root.querySelectorAll(".screen").forEach((el) => { el.hidden = el.dataset.s !== name; });
    root.querySelectorAll(".rail button").forEach((b) => { if (b.dataset.go === name) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    if (name === "spray") { resizeField(); running = !paused; }
    if (name === "report") drawMap();
  }
  root.querySelectorAll(".rail button").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
  $("btn-start").addEventListener("click", () => go("spray"));
  $("sel-field").addEventListener("change", () => { $("st-field").textContent = s("field" + $("sel-field").value); });
  for (const id of ["mode", "preset"]) {
    const g = $(id);
    g.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      if (id === "mode") { mode = b.dataset.v; sprayTitle(); }
    }));
  }
  function sprayTitle() { $("spray-title").textContent = s("sprayTitle", { mode: s(mode === "spot" ? "modeSpot" : mode === "spotbg" ? "modeSpotBg" : "modeBroad") }); }

  // ---- self-test screen
  function drawSens() {
    const box = $("sens");
    box.innerHTML = "";
    for (let i = 1; i <= 24; i++) {
      const d = document.createElement("div"), bad = dusty && i === 9, bar = document.createElement("small");
      d.className = bad ? "w" : "";
      d.textContent = i;
      bar.style.width = (bad ? 72 : 96 + ((i * 7) % 5)) + "%";
      d.appendChild(bar);
      box.appendChild(d);
    }
    $("dust-msg").hidden = !dusty;
  }
  drawSens();
  $("in-sens").addEventListener("input", () => { $("sens-v").textContent = $("in-sens").value; });
  $("btn-leaf").addEventListener("click", () => { const o = $("leaf-out"); o.hidden = false; o.textContent = s("leafOk"); });
  $("btn-retest").addEventListener("click", () => { dusty = false; drawSens(); const o = $("leaf-out"); o.hidden = false; o.textContent = s("retestOk"); });
  $("btn-dust").addEventListener("click", () => { dusty = true; drawSens(); go("check"); });

  // ---- live field (generated weeds; the counters are sample numbers)
  const cv = $("field"), cx = cv.getContext("2d"), dpr = Math.max(1, window.devicePixelRatio || 1);
  let W = 0, H = 0;
  const NZ = 48, nozzBars = [];
  for (let n = 0; n < NZ; n++) { const i = document.createElement("i"); $("nozz").appendChild(i); nozzBars.push(i); }
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const NWEED = 130;
  let weeds = [], patches = [];
  const openUntil = new Float32Array(NZ);
  const shift = { ha: 186.4, sprayedHa: 186.4 * 0.63 };
  function addWeed(y) {
    const cxp = rnd() * W, n = 3 + Math.floor(rnd() * 6);
    for (let j = 0; j < n; j++) weeds.push({ x: Math.min(W - 4, Math.max(4, cxp + (rnd() - 0.5) * W * 0.07)), y: y + (rnd() - 0.5) * 36, r: 2.5 + rnd() * 4.5 });
  }
  function resizeField() {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!weeds.length) while (weeds.length < NWEED) addWeed(rnd() * H * 1.3 - H * 0.3);
    drawField();
  }
  const BOOM = 0.66;
  let simT = 0, last = 0;
  function step(dt) {
    const pxPerS = H * 0.22, boomY = H * BOOM, nw = W / NZ;
    simT += dt;
    for (const w of weeds) w.y += pxPerS * dt;
    weeds = weeds.filter((w) => w.y < H + 20);
    while (weeds.length < NWEED) addWeed(-rnd() * H * 0.6 - 10);
    let openCount = 0;
    for (let z = 0; z < NZ; z++) {
      const x0 = z * nw, x1 = x0 + nw;
      const hit = weeds.some((w) => w.x + w.r > x0 && w.x - w.r < x1 && Math.abs(w.y - boomY) < w.r + 6);
      if (hit) openUntil[z] = simT + 0.4;
      let open = mode === "broad" || simT < openUntil[z];
      if (z === blocked) open = false;
      if (open) { openCount++; patches.push({ x: x0, y: boomY, w: nw, h: pxPerS * dt + 1 }); }
      nozzBars[z].className = z === blocked ? "blk" : open ? "on" : "";
    }
    for (const p of patches) p.y += pxPerS * dt;
    patches = patches.filter((p) => p.y < H + 5);
    // sample counters, sped up x20 so they move; sprayed share kept between 60% and 80%
    const dHa = (24 * 17.8 / 3.6 * dt / 10000) * 20;
    const shareNow = mode === "spot" ? Math.min(0.8, 0.6 + 0.4 * (openCount / NZ)) : 1;
    shift.ha += dHa; shift.sprayedHa += dHa * shareNow;
  }
  function drawField() {
    if (!W) return;
    const boomY = H * BOOM, nw = W / NZ;
    cx.fillStyle = "#3A2E21"; cx.fillRect(0, 0, W, H);
    cx.strokeStyle = "rgba(120,98,64,.55)"; cx.lineWidth = 1;
    for (let xr = 6; xr < W; xr += 14) { cx.beginPath(); cx.moveTo(xr, 0); cx.lineTo(xr, H); cx.stroke(); }
    if (mode === "spotbg") { cx.fillStyle = "rgba(124,203,235,.10)"; cx.fillRect(0, boomY, W, H - boomY); }
    cx.fillStyle = "rgba(124,203,235,.28)";
    for (const p of patches) cx.fillRect(p.x, p.y, p.w, p.h);
    for (const w of weeds) {
      cx.fillStyle = "#71C23A"; cx.beginPath(); cx.arc(w.x, w.y, w.r, 0, 6.283); cx.fill();
      cx.fillStyle = "#9BE05E"; cx.beginPath(); cx.arc(w.x - w.r * 0.3, w.y - w.r * 0.3, w.r * 0.35, 0, 6.283); cx.fill();
    }
    cx.fillStyle = "#C9D3BD"; cx.fillRect(0, boomY - 5, W, 6);
    for (let k = 0; k < 24; k++) { cx.fillStyle = dusty && k === 8 ? "#F2B33D" : "#B9D85A"; cx.fillRect(k * W / 24 + W / 48 - 6, boomY - 12, 12, 8); }
    for (let z = 0; z < NZ; z++) {
      let open = mode === "broad" || simT < openUntil[z];
      if (z === blocked) open = false;
      if (open) { cx.fillStyle = "rgba(124,203,235,.55)"; cx.beginPath(); cx.moveTo(z * nw + nw / 2, boomY); cx.lineTo(z * nw - 1, boomY + 26); cx.lineTo(z * nw + nw + 1, boomY + 26); cx.closePath(); cx.fill(); }
      if (z === blocked) { cx.fillStyle = "#E5533D"; cx.fillRect(z * nw + 1, boomY - 2, nw - 2, 6); }
    }
    cx.fillStyle = "rgba(13,17,10,.7)"; cx.fillRect(8, 8, 150, 24);
    cx.fillStyle = "#EAF0E0"; cx.font = "600 12px 'IBM Plex Sans', sans-serif"; cx.fillText(s("direction"), 16, 24);
  }
  function readouts() {
    const share = shift.sprayedHa / shift.ha, rate = parseFloat($("in-rate").value) || 2;
    $("r-area").textContent = nf(shift.ha);
    $("r-share").textContent = Math.round(share * 100) + "%";
    $("r-saved").textContent = nf((shift.ha - shift.sprayedHa) * rate);
  }
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    if (current === "spray" && running) { step(reduce ? dt * 0.3 : dt); drawField(); readouts(); }
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  $("btn-pause").addEventListener("click", () => { paused = !paused; running = !paused; $("btn-pause").textContent = s(paused ? "resume" : "pause"); });
  $("btn-broad").addEventListener("click", () => { root.querySelectorAll("#mode button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === "broad")); mode = "broad"; sprayTitle(); });
  $("btn-sim").addEventListener("click", () => { blocked = 30; $("alert").hidden = false; go("spray"); });
  $("btn-ack").addEventListener("click", () => { $("alert").hidden = true; });
  $("btn-howclean").addEventListener("click", () => { const el = $("clean-steps"); el.hidden = !el.hidden; });
  const onResize = () => resizeField();
  window.addEventListener("resize", onResize);

  // ---- sample shift report (fixed sample numbers, 38% saving)
  function sampleReport() {
    const ha = 248, broad = ha * 2, used = broad * SAMPLE_SHARE, saving = 1 - SAMPLE_SHARE;
    $("s-area").textContent = nf(ha);
    $("s-share").textContent = Math.round(SAMPLE_SHARE * 100) + "%";
    $("s-saved").textContent = s("litres", { n: nf(broad - used) });
    $("s-kzt").textContent = "≈" + nf(Math.round(ha * 5500 * saving / 1000) * 1000, 0);
    $("d-speed").textContent = s("kmh", { n: nf(17.6) });
    $("d-used").textContent = s("litres", { n: nf(used) });
    $("d-broad").textContent = s("litres", { n: nf(broad) });
    $("d-perha").textContent = "≈" + s("kzt", { n: nf(Math.round(5500 * saving / 10) * 10, 0) });
  }
  function drawMap() {
    const m = $("map"), g = m.getContext("2d"), cols = 56, rows = 30, cw = m.width / cols, ch = m.height / rows;
    let sd = 11;
    const r2 = () => { sd = (sd * 48271) % 2147483647; return (sd - 1) / 2147483646; };
    const centres = [];
    for (let i = 0; i < 16; i++) centres.push([r2() * cols, r2() * rows, 3 + r2() * 6]);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      let v = 0;
      for (const c of centres) { const d = Math.hypot(x - c[0], (y - c[1]) * 1.2); v = Math.max(v, 1 - d / c[2]); }
      g.fillStyle = v + r2() * 0.35 > MAP_THRESHOLD ? "#3E8FB0" : "#4A3B2A";
      g.fillRect(x * cw, y * ch, cw - 1, ch - 1);
    }
  }
  const toast = (id, key) => { const o = $(id); o.hidden = false; o.textContent = s(key); };
  $("btn-usb").addEventListener("click", () => toast("rep-out", "usbOut"));
  $("btn-send").addEventListener("click", () => toast("rep-out", "sendOut"));
  $("btn-req").addEventListener("click", () => toast("req-out", "reqOut"));

  // ---- clock (the tablet's local time)
  const clock = () => { const d = new Date(); $("clock").textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  clock();
  const timer = setInterval(clock, 30000);

  // ---- text
  function applyText() {
    root.querySelectorAll("[data-t]").forEach((el) => { el.textContent = s(el.dataset.t); });
    root.querySelectorAll("[data-aria]").forEach((el) => { el.setAttribute("aria-label", s(el.dataset.aria)); });
    const sel = $("sel-field");
    [...sel.options].forEach((o, i) => { o.textContent = s("field" + i); });
    $("st-field").textContent = s("field" + sel.value);
    $("btn-pause").textContent = s(paused ? "resume" : "pause");
    sprayTitle(); sampleReport(); readouts(); drawField();
  }
  applyText();

  return {
    setLang(l, tt) { lang = l; t = tt; applyText(); },
    unmount() { cancelAnimationFrame(raf); clearInterval(timer); window.removeEventListener("resize", onResize); root.innerHTML = ""; },
  };
}
