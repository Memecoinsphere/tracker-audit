/* Tracker Audit — static PWA (web conversion of a SwiftUI app).
 *
 * IMPORTANT: Everything here is COSMETIC / LOCAL ONLY.
 * IDFA / IDFV shown here are LOCAL PSEUDO-IDENTIFIERS (random UUIDs generated in
 * this browser). A web page cannot read the real device advertising/vendor IDs.
 * Data persists in localStorage only. No network calls (CSP connect-src 'none'),
 * no analytics, no tracking, no third-party code.
 */

// ===== PASSCODE (change here) =====
const PASSCODE = "6767";
// ==================================

const decoyEl = document.getElementById("decoy");
const lockEl = document.getElementById("lock");
const panelEl = document.getElementById("panel");
const dotsEl = document.getElementById("dots");
const errorEl = document.getElementById("lockError");
const keypadEl = document.getElementById("keypad");
const lockPanelBtn = document.getElementById("lockPanelBtn");
const decoyTimeEl = document.getElementById("decoyTime");
const decoyDateEl = document.getElementById("decoyDate");

let entered = "";
let view = "decoy"; // decoy | lock | panel

/* ---------- localStorage helpers (UserDefaults -> localStorage) ---------- */
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}
function saveJSON(key, value) {
  // Local only — never sent anywhere.
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota/private */ }
}
function isoNow() { return new Date().toISOString(); }

function renderLog(listEl, lines, emptyText) {
  listEl.textContent = "";
  if (!lines.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = emptyText || "No entries yet";
    listEl.appendChild(li);
    return;
  }
  for (const line of lines) {
    const li = document.createElement("li");
    li.textContent = line; // textContent: never interpreted as HTML
    listEl.appendChild(li);
  }
}

/* ---------- Views ---------- */
function show(name) {
  view = name;
  decoyEl.hidden = name !== "decoy";
  lockEl.hidden = name !== "lock";
  panelEl.hidden = name !== "panel";
  decoyEl.setAttribute("aria-hidden", name === "decoy" ? "false" : "true");
  if (name === "lock") { entered = ""; updateDots(); errorEl.hidden = true; }
  if (name === "panel") { App.onUnlock(); } else { App.onLock(); }
}

function updateDots() {
  const dots = dotsEl.querySelectorAll(".dot");
  dots.forEach((d, i) => { d.classList.toggle("filled", i < entered.length); });
}

function onDigit(d) {
  if (view !== "lock" || entered.length >= 4) return;
  errorEl.hidden = true;
  entered += d;
  updateDots();
  if (entered.length === 4) {
    if (entered === PASSCODE) { show("panel"); }
    else { errorEl.hidden = false; entered = ""; setTimeout(updateDots, 180); }
  }
}
function onDelete() {
  if (view !== "lock" || !entered.length) return;
  entered = entered.slice(0, -1);
  errorEl.hidden = true;
  updateDots();
}

keypadEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-k]");
  if (!btn) return;
  const k = btn.getAttribute("data-k");
  if (k === "del") onDelete(); else onDigit(k);
});
lockPanelBtn.addEventListener("click", () => { show("decoy"); });

/* ---------- Hidden gesture: double-tap in top ~15% strip ---------- */
const TOP_STRIP_RATIO = 0.15;
const DOUBLE_TAP_MS = 350;
let lastTopTapAt = 0;

function isTopStrip(clientY) {
  const h = window.innerHeight || document.documentElement.clientHeight;
  return clientY <= h * TOP_STRIP_RATIO;
}
function onPointerDown(e) {
  if (view !== "decoy") return;
  if (typeof e.button === "number" && e.button !== 0) return;
  const y = e.clientY;
  if (!isTopStrip(y)) { lastTopTapAt = 0; return; }
  const now = performance.now();
  if (lastTopTapAt && now - lastTopTapAt <= DOUBLE_TAP_MS) { lastTopTapAt = 0; show("lock"); }
  else { lastTopTapAt = now; }
}
decoyEl.addEventListener("pointerdown", onPointerDown, { passive: true });

/* ---------- Decoy clock ---------- */
const FR_DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const FR_MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
function pad2(n) { return String(n).padStart(2, "0"); }
function tickClock() {
  const now = new Date();
  decoyTimeEl.textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
  decoyDateEl.textContent = FR_DAYS[now.getDay()] + " " + now.getDate() + " " + FR_MONTHS[now.getMonth()];
}
tickClock();
setInterval(tickClock, 15000);

/* ================= App-specific logic ================= */
// Keys
const K_IDS = "tracker_audit.ids.v1";
const K_LOG = "tracker_audit.log.v1";
const LOG_MAX = 15;

/** Random UUID v4 — LOCAL SIMULATION only (not a real device identifier). */
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID().toUpperCase();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return (h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20)).toUpperCase();
}

/** Read or (first run) generate the two simulated identifiers; persist them. */
function getIds() {
  let ids = loadJSON(K_IDS, null);
  if (!ids || !ids.idfa || !ids.idfv) {
    ids = { idfa: uuid(), idfv: uuid() };
    saveJSON(K_IDS, ids);
  }
  return ids;
}

const App = {
  init() {
    this.idfaEl = document.getElementById("idfa");
    this.idfvEl = document.getElementById("idfv");
    this.logEl = document.getElementById("log");
    document.getElementById("refreshBtn").addEventListener("click", () => {
      const ids = getIds(); // re-read stored (simulated) identifiers
      const line = isoNow() + ": IDFA=" + ids.idfa.slice(0,8) + "… IDFV=" + ids.idfv.slice(0,8) + "…";
      const log = [line, ...loadJSON(K_LOG, [])].slice(0, LOG_MAX);
      saveJSON(K_LOG, log);
      this.render();
    });
    document.getElementById("resetBtn").addEventListener("click", () => {
      saveJSON(K_IDS, { idfa: uuid(), idfv: uuid() }); // regenerate new simulated IDs
      this.render();
    });
    getIds(); // ensure generated on first run
  },
  render() {
    const ids = getIds();
    this.idfaEl.textContent = ids.idfa;
    this.idfvEl.textContent = ids.idfv;
    renderLog(this.logEl, loadJSON(K_LOG, []), "No entries yet");
  },
  onUnlock() { this.render(); },
  onLock() {},
};

/* ================= Boot ================= */
App.init();
show("decoy");

/* PWA service worker (app-shell only, same-origin) */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  });
}
