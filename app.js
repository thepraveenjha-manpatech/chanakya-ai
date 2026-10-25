/* Chanakya AI – Director (built by ManpaTech for Your Chanakya)
   Image -> EDIT PLAN (AI director, or on-device editor) -> QUALITY CHECK (AI second pass + layout critic)
   -> scene-by-scene voice -> recorded 1080x1920 reel.  Feedback teaches the director new rules. */
(() => {
"use strict";
const W = 1080, H = 1920, FPS = 30, TR = 0.34;
const C = { navy: "#0B1F5C", dark: "#06113A", red: "#C8101A", yel: "#FFD21F", org: "#F7A600", ink: "#0B1F5C", mute: "#6b7aa8" };
const BRAND = { phone: "8447088008", site: "Yourchanakya.com" };
const FONT = 'Inter, NotoDev, "Noto Sans Devanagari", sans-serif';
const $ = (id) => document.getElementById(id);
const store = { get: (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const API = () => (store.get("api") || window.API_BASE || "").replace(/\/$/, "");
const HDR = () => ({ "content-type": "application/json", "x-access-code": store.get("code") });
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) { r = Math.min(Array.isArray(r) ? r[0] : r, w / 2, h / 2); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); };
const hasDev = (s) => /[ऀ-ॿ]/.test(s || "");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isNA = (v) => /^\s*(n\.?\s*[\/|il1]?\s*a\.?|nil|none|-+|–|—|not applicable|)\s*$/i.test(String(v ?? ""));

/* ---------------- UI wiring ---------------- */
let imgEl = null, imgData = "", thumb = "", server = { ok: false, ai: false, lessons: 0 };
$("code").value = store.get("code"); $("api").value = store.get("api");
$("code").onchange = () => { store.set("code", $("code").value.trim()); checkServer(); };
$("api").onchange = () => { store.set("api", $("api").value.trim()); checkServer(); };
$("file").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  const url = URL.createObjectURL(f); const im = new Image(); im.src = url; await im.decode().catch(() => {});
  const mk = (max, q) => { const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)); const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s); const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", q); };
  imgData = mk(2000, 0.9); thumb = mk(360, 0.6); imgEl = new Image(); imgEl.src = imgData; await imgEl.decode();
  $("dropTxt").innerHTML = ""; const p = new Image(); p.src = imgData; $("dropTxt").appendChild(p); $("drop").classList.add("has");
  $("go").disabled = false; $("out").hidden = true; $("prog").hidden = true;
};
const STEPS = ["Studying the image like an editor", "Planning scenes & script", "Quality check – verifying every value", "Creating voice", "Rendering the reel", "Ready"];
function showSteps() { $("prog").hidden = false; $("steps").innerHTML = STEPS.map((s) => `<li><span>○</span><em style="font-style:normal">${s}</em></li>`).join(""); $("msg").textContent = ""; $("notes").style.display = "none"; $("notesList").innerHTML = ""; setBar(0); }
function step(i, st, note) { const li = $("steps").children[i]; if (!li) return; li.className = st; li.firstChild.textContent = { done: "✔", err: "✖", on: "●", skip: "–" }[st] || "○"; if (note) li.lastChild.textContent = STEPS[i] + " – " + note; }
function setBar(p) { $("bar").firstElementChild.style.width = Math.round(p * 100) + "%"; }
function notes(list) { if (!list || !list.length) return; $("notes").style.display = "block"; list.forEach((n) => { const li = document.createElement("li"); li.textContent = n; $("notesList").appendChild(li); }); }

async function checkServer() {
  const b = $("aiBadge");
  try {
    const r = await fetch(API() + "/api/director", { headers: HDR() }); if (!r.ok) throw 0; const j = await r.json();
    const ai = j.ai && (j.ai.anthropic || j.ai.gemini || j.ai.openai);
    server = { ok: true, ai, lessons: j.lessons || 0 };
    b.className = "badge" + (ai ? " ok" : ""); b.textContent = ai ? `AI editor online · ${j.lessons || 0} learned rules` : "Server online, but no AI is active – on-device editor will be used";
    loadRules();
  } catch { server = { ok: false, ai: false, lessons: 0 }; b.className = "badge"; b.textContent = "On-device editor (offline mode – no AI server)"; }
}
async function loadRules() {
  const ul = $("rules"); ul.innerHTML = "";
  try { const r = await fetch(API() + "/api/feedback?view=rules", { headers: HDR() }); const j = await r.json();
    (j.rules || []).forEach((x, i) => { const li = document.createElement("li"); li.textContent = x.rule; const del = document.createElement("button"); del.textContent = "remove"; del.onclick = async () => { await fetch(API() + "/api/feedback", { method: "POST", headers: HDR(), body: JSON.stringify({ action: "delete_rule", index: i }) }); loadRules(); }; li.appendChild(del); ul.appendChild(li); });
    if (!(j.rules || []).length) ul.innerHTML = '<li class="small">No rules yet – they appear when you send feedback.</li>';
  } catch { ul.innerHTML = '<li class="small">Available in the online version.</li>'; }
}
$("addRule").onclick = async () => { const rule = $("newRule").value.trim(); if (!rule) return; try { await fetch(API() + "/api/feedback", { method: "POST", headers: HDR(), body: JSON.stringify({ action: "add_rule", rule }) }); $("newRule").value = ""; loadRules(); } catch {} };
$("exp").onclick = async () => {
  let data = { exported: new Date().toISOString(), local_feedback: JSON.parse(store.get("fb_local") || "[]") };
  try { const [a, b] = await Promise.all([fetch(API() + "/api/feedback?view=runs", { headers: HDR() }).then((r) => r.json()), fetch(API() + "/api/feedback?view=rules", { headers: HDR() }).then((r) => r.json())]); data.runs = a.runs; data.rules = b.rules; } catch {}
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" })); a.download = "chanakya_ai_review_log.json"; a.click();
};

/* ---------------- 1. DIRECTOR: AI edit plan ---------------- */
async function aiPlan(hint) {
  const r = await fetch(API() + "/api/director", { method: "POST", headers: HDR(), body: JSON.stringify({ mode: "plan", image: imgData, thumb, hint }) });
  const j = await r.json().catch(() => ({})); if (!r.ok || !j.plan) throw new Error(j.detail || j.error || "AI editor unavailable (" + r.status + ")");
  return j;
}
async function aiReview(plan) {
  const r = await fetch(API() + "/api/director", { method: "POST", headers: HDR(), body: JSON.stringify({ mode: "review", image: imgData, plan }) });
  const j = await r.json().catch(() => ({})); if (!r.ok || !j.plan) throw new Error(j.detail || j.error || "review failed"); return j.plan;
}

/* ---------------- 1b. DIRECTOR: on-device editor (OCR + editing rules) ---------------- */
async function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
async function ocrPrep(srcUrl, clean) {
  const im = await loadImg(srcUrl); if (!im) return srcUrl;
  const sc = Math.max(1, Math.min(3, 2400 / Math.max(im.width, im.height)));
  const w = Math.round(im.width * sc), h = Math.round(im.height * sc);
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d");
  x.imageSmoothingQuality = "high"; x.drawImage(im, 0, 0, w, h); c.__scale = sc;
  if (!clean) return c;
  const d = x.getImageData(0, 0, w, h), p = d.data, n = w * h, g = new Uint8Array(n); let sum = 0;
  for (let i = 0; i < n; i++) { g[i] = p[4 * i] * 0.299 + p[4 * i + 1] * 0.587 + p[4 * i + 2] * 0.114; sum += g[i]; }
  const inv = sum / n < 110, dk = new Uint8Array(n), kill = new Uint8Array(n);
  for (let i = 0; i < n; i++) dk[i] = (inv ? 255 - g[i] : g[i]) < 150 ? 1 : 0;
  const LH = Math.max(40, w / 8 | 0), LV = Math.max(30, h / 12 | 0);
  for (let yy = 0; yy < h; yy++) { let j = 0; while (j < w) { if (dk[yy * w + j]) { let k = j; while (k < w && dk[yy * w + k]) k++; if (k - j >= LH) for (let q = j; q < k; q++) kill[yy * w + q] = 1; j = k; } else j++; } }
  for (let xx = 0; xx < w; xx++) { let j = 0; while (j < h) { if (dk[j * w + xx]) { let k = j; while (k < h && dk[k * w + xx]) k++; if (k - j >= LV) for (let q = j; q < k; q++) kill[q * w + xx] = 1; j = k; } else j++; } }
  for (let i = 0; i < n; i++) { const v = dk[i] && !kill[i] ? 0 : 255; p[4 * i] = p[4 * i + 1] = p[4 * i + 2] = v; p[4 * i + 3] = 255; }
  x.putImageData(d, 0, 0); return c;
}
async function ocrRun(img) {
  if (Tesseract.createWorker) {
    const wk = await Tesseract.createWorker("eng+hin");
    try { await wk.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" }); const r = await wk.recognize(img); return r.data; } finally { try { await wk.terminate(); } catch {} }
  }
  return (await Tesseract.recognize(img, "eng+hin")).data;
}
function fixOcr(l) {
  return String(l).replace(/[|_¦\[\]{}]+/g, " ")
    .replace(/(\d)\s*(?:O0|0O)CT\b/g, "$1 OCT").replace(/(\d)\s*[0O]CT\b/g, "$1 OCT").replace(/\b0CT\b/g, "OCT").replace(/(\d)\s*N[O0]V\b/g, "$1 NOV").replace(/(\d)(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/g, "$1 $2")
    .replace(/\b(\d{1,2})\s*([Tt7])([Oo0])\s*(\d{1,2})\b/g, (m, x, t, o, y) => x + " " + (t === "7" || o === "0" ? "TO" : t + o) + " " + y)
    .replace(/\b(TILL|till|Till)(\d)/g, "$1 $2").replace(/\bN\s?[\/|Il1]\s?A\b/g, "N/A").replace(/^NA$/, "N/A").replace(/\bM[O0]\s?\(/g, "MD(").replace(/\b(\d{1,3}),(\d{2})\.(\d{3})\b/g, "$1,$2,$3").replace(/\b(\d{1,3})\.(\d{2}),(\d{3})\b/g, "$1,$2,$3").replace(/\s+/g, " ").replace(/^[\s\-–=.,:;]+|[\s\-–=.,:;]+$/g, "").trim();
}
const STATES = ["ANDHRA PRADESH","ARUNACHAL PRADESH","ASSAM","BIHAR","CHHATTISGARH","GOA","GUJARAT","HARYANA","HIMACHAL PRADESH","JHARKHAND","KARNATAKA","KERALA","MADHYA PRADESH","MAHARASHTRA","MANIPUR","MEGHALAYA","MIZORAM","NAGALAND","ODISHA","PUNJAB","RAJASTHAN","SIKKIM","TAMIL NADU","TELANGANA","TRIPURA","UTTAR PRADESH","UTTARAKHAND","WEST BENGAL","DELHI","CHANDIGARH","PUDUCHERRY","JAMMU AND KASHMIR","JAMMU & KASHMIR","LADAKH"];
const tcase = (s) => s.toLowerCase().replace(/(^|\s|\()\S/g, (m) => m.toUpperCase());
function fixLabel(l) { const k = l.toUpperCase().replace(/[^A-Z&]/g, ""); const st = STATES.find((x) => x.replace(/[^A-Z&]/g, "") === k); if (!st) return l; return l === l.toUpperCase() ? st : tcase(st); }
const MONEY = /^\d{1,3}(,\d{2,3})+(\.\d+)?$|^\d{5,}$/;
const DATEISH = /\b(\d{1,2}[\s-]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|till|to\s+\d|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i;

const MON = "(?:JAN|FEB|MAR|APR|MAY|JUNE?|JULY?|AUG|SEPT?|OCT|NOV|DEC)[A-Z]*";
const DT = new RegExp(`(?:(?:TILL|UPTO|UP TO|FROM|BY)\\s+\\d{1,2}(?:st|nd|rd|th)?\\s*${MON})|(?:\\d{1,2}(?:st|nd|rd|th)?\\s*(?:TO|-|–)\\s*\\d{1,2}(?:st|nd|rd|th)?\\s*${MON})|(?:\\d{1,2}(?:st|nd|rd|th)?[\\s-]${MON}(?:-\\d{2,4}|\\s\\d{4})?)|(?:\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4})|(?:will be shared? soon|to be (?:announced|notified)|awaited)|(?:\\bN\\/A\\b)|(?:\\b\\d{1,3}(?:,\\d{2,3})+\\b)`, "gi");
const PAIRS = ["CHOICE FILLING", "CHOICE LOCKING", "SEAT ALLOTMENT", "LAST DATE", "START DATE", "END DATE", "DOCUMENT VERIFICATION", "FEE PAYMENT", "MERIT LIST", "ROUND 1", "ROUND 2", "ROUND 3", "MOP UP", "STRAY VACANCY", "RESULT DATE", "JOINING DATE", "FEE HEAD", "ALL INDIA"];
// a merged cell like "04-Nov 5 TO 10 NOV" or "Madhya Pradesh 10 to 20 OCT" -> separate cells
function splitDT(c) {
  const ms = [...c.text.matchAll(DT)]; if (!ms.length) return [c];
  const pieces = []; const pre = c.text.slice(0, ms[0].index).trim(); if (pre) pieces.push({ t: pre, a: 0, b: ms[0].index });
  ms.forEach((m) => pieces.push({ t: m[0].replace(/\s+/g, " ").trim(), a: m.index, b: m.index + m[0].length }));
  const tail = c.text.slice(ms[ms.length - 1].index + ms[ms.length - 1][0].length).trim(); if (tail && tail.length > 2) pieces.push({ t: tail, a: c.text.length - tail.length, b: c.text.length });
  if (pieces.length < 2) return [c];
  const L = c.text.length || 1, X = (i) => c.x0 + (c.x1 - c.x0) * i / L;
  return pieces.map((p) => ({ text: p.t, x0: X(p.a), x1: X(p.b), xc: (X(p.a) + X(p.b)) / 2, conf: c.conf }));
}
function splitHeaderCell(c) {
  let t = " " + c.text.toUpperCase().replace(/\s+/g, " ") + " "; PAIRS.forEach((p, i) => { t = t.split(" " + p + " ").join(` §${i} `); });
  const parts = t.trim().split(" ").filter(Boolean).map((w) => (w[0] === "§" ? PAIRS[+w.slice(1)] : w)); if (parts.length < 2) return [c];
  const L = c.text.length || 1; let pos = 0;
  return parts.map((p) => { const a = pos, b = pos + p.length; pos = b + 1; const X = (i) => c.x0 + (c.x1 - c.x0) * Math.min(i, L) / L; return { text: p, x0: X(a), x1: X(b), xc: (X(a) + X(b)) / 2, conf: c.conf }; });
}
// split one OCR line into cells using the horizontal gaps between words
function lineCells(line) {
  const ws = (line.words || []).filter((w) => w.text && w.text.trim() && w.bbox && !/^[.,:;'"`~•·]+$/.test(w.text.trim())).sort((a, b) => a.bbox.x0 - b.bbox.x0);
  if (!ws.length) return [];
  const hs = ws.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b), hh = hs[Math.floor(hs.length / 2)] || 20;
  const cells = []; let cur = null;
  for (const w of ws) {
    if (/^[|¦\[\]]+[.,]?$/.test(w.text.trim())) { cur = null; continue; }
    if (cur && w.bbox.x0 - cur.x1 <= hh * 1.15) { cur.text += " " + w.text; cur.x1 = w.bbox.x1; cur.conf.push(w.confidence); }
    else { cur = { text: w.text, x0: w.bbox.x0, x1: w.bbox.x1, conf: [w.confidence] }; cells.push(cur); }
  }
  cells.forEach((c) => { c.text = fixOcr(c.text); c.xc = (c.x0 + c.x1) / 2; });
  return cells.filter((c) => c.text).flatMap(splitDT);
}
function tableFromLines(lines) {
  const L = lines.map((l) => ({ text: fixOcr(l.text), cells: lineCells(l), y: l.bbox ? l.bbox.y0 : 0, conf: l.confidence ?? 90 })).filter((l) => l.text.length > 1);
  const counts = {}; L.forEach((l) => { if (l.cells.length >= 3) counts[l.cells.length] = (counts[l.cells.length] || 0) + 1; });
  const k = +Object.keys(counts).sort((a, b) => counts[b] - counts[a] || b - a)[0];
  if (!k || counts[k] < 3) return null;
  const ref = L.filter((l) => l.cells.length === k);
  const anchors = [...Array(k)].map((_, i) => ({ x0: Math.min(...ref.map((l) => l.cells[i].x0)), x1: Math.max(...ref.map((l) => l.cells[i].x1)), xc: ref.reduce((s, l) => s + l.cells[i].xc, 0) / ref.length }));
  const first = L.indexOf(ref[0]), last = L.lastIndexOf(ref[ref.length - 1]);
  const nearest = (x) => anchors.reduce((bi, a, i) => (Math.abs(a.xc - x) < Math.abs(anchors[bi].xc - x) ? i : bi), 0);
  const place = (l) => {
    const row = Array(k).fill(""), span = {};
    l.cells.forEach((c) => {
      const covered = anchors.map((a, i) => (c.x0 <= a.xc && c.x1 >= a.xc ? i : -1)).filter((i) => i >= 0);
      const i = covered.length ? covered[0] : nearest(c.xc);
      row[i] = row[i] ? row[i] + " " + c.text : c.text;
      if (covered.length > 1) span[i] = covered.length;
    });
    return { row, span };
  };
  // header = up to 3 lines right above the first data line that hold no numbers
  let hdrRows = [], top = first;
  for (let j = first - 1; j >= Math.max(0, first - 3); j--) {
    const l = L[j]; if (!l.cells.length || /\d{2}/.test(l.text) && !/\(yearly\)|20\d\d/i.test(l.text)) break;
    if (l.cells.length < 2 && hdrRows.length) break;
    if (l.cells.length < 2) break;
    hdrRows.unshift(place(l).row); top = j;
  }
  let header = hdrRows.length ? anchors.map((_, i) => hdrRows.map((r) => r[i]).filter(Boolean).join(" ").trim()) : [];
  if (header.length && header.filter(Boolean).length < k && hdrRows.length === 1) header = [];
  if (!header.length) { // header line just above the data that has fewer cells than columns (merged words)
    const hl = L[first - 1];
    if (hl && hl.cells.length >= 2 && hl.cells.length < k && !/\d{2}/.test(hl.text)) { let cs = hl.cells; while (cs.length < k) { const i = cs.reduce((bi, c, j) => (c.text.split(" ").length > cs[bi].text.split(" ").length ? j : bi), 0); const sp = splitHeaderCell(cs[i]); if (sp.length < 2) break; cs = [...cs.slice(0, i), ...sp, ...cs.slice(i + 1)]; } if (cs.length === k) { header = cs.map((c) => c.text); top = first - 1; } }
  }
  // the first ref line may itself be the header (no digits)
  let bodyStart = first;
  if (!header.length && !/\d/.test(L[first].text)) { header = place(L[first]).row; bodyStart = first + 1; }
  let section = "";
  const rows = [], spans = [];
  for (let j = bodyStart; j <= last; j++) {
    const l = L[j];
    if (l.cells.length === 1 && !/\d{3}/.test(l.text)) { if (!rows.length) section = l.text; continue; }
    if (l.cells.length < 2) continue;
    const p = place(l);
    if (!p.row[0] && rows.length) { // continuation line of a wrapped row name
      const prev = rows[rows.length - 1]; p.row.forEach((v, i) => { if (v) prev[i] = (prev[i] + " " + v).trim(); }); continue;
    }
    // a text cell (e.g. "will be share soon") with empty neighbours spans those columns
    for (let i = 1; i < k; i++) { const v = p.row[i]; if (!v || /\d/.test(v) || p.span[i]) continue; let a = i, b = i; while (a - 1 >= 1 && !p.row[a - 1]) a--; while (b + 1 < k && !p.row[b + 1]) b++; if (b > a) { p.row[i] = ""; p.row[a] = v; p.span[a] = b - a + 1; i = b; } }
    rows.push(p.row); spans.push(p.span);
  }
  if (rows.length < 2) return null;
  const pre = L.slice(0, top).filter((l) => l.conf >= 55).map((l) => l.text.replace(/^college\s+\S+\s*&\s*\S+\s*/i, "")).filter((t) => t.length > 2 && !(section && t === section));
  return { header, rows, spans, section, pre };
}
const VOCAB = ["AI","AIQ","ALL","INDIA","STATE","MGMT","MANAGEMENT","NRI","NATURE","TUITION","FEES","FEE","YEARLY","ANNUAL","QUOTA","PARTICULARS","HEAD","REGISTRATION","CHOICE","FILLING","LOCKING","RESULT","REPORTING","SEATS","SEAT","CATEGORY","COURSE","BRANCH","TOTAL","HOSTEL","SECURITY","DEPOSIT","OPEN","GENERAL","OBC","SC","ST","EWS","PWD","ROUND","DATE","LAST","START","END","STATUS","COLLEGE","NAME","ADDRESS","STATE-WISE","DEEMED","GOVT","PRIVATE","PAID","MBBS","BDS","MD","MS","DNB"];
function lev(a, b) { const d = [...Array(b.length + 1).keys()]; for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return d[b.length]; }
function bag(a, b) { const m = {}; for (const c of a) m[c] = (m[c] || 0) + 1; let o = 0; for (const c of b) if (m[c] > 0) { m[c]--; o++; } return 2 * o / (a.length + b.length); }
function fixHeader(h) {
  return String(h).replace(/\(/g, " (").split(/\s+/).map((tok) => {
    let core = tok.replace(/[^A-Za-z]/g, "").toUpperCase(); if (!core || VOCAB.includes(core) || /\d/.test(tok)) return tok;
    if (core.length <= 2) { const g = core.replace(/L/g, "I").replace(/1/g, "I"); return VOCAB.includes(g) ? g : ""; }
    let best = "", bs = 0; for (const v of VOCAB) { const sc = core.length <= 3 ? (lev(core, v) <= 1 && v.length <= 4 ? 0.9 : 0) : Math.max(1 - lev(core, v) / Math.max(core.length, v.length), bag(core, v) >= 0.79 && Math.abs(core.length - v.length) <= 1 ? 0.8 : 0); if (sc > bs) { bs = sc; best = v; } }
    if (bs >= 0.66) return tok.toUpperCase().replace(core, best);
    return core.length <= 2 ? "" : tok;
  }).filter(Boolean).join(" ").replace(/\s+\(/g, "(").trim();
}
function shortenHeaders(header) {
  header = header.map((h, i) => (i ? fixHeader(h) : h));
  if (header.length < 3) return { cols: header, suffix: "" };
  const vals = header.slice(1).map((h) => h.toUpperCase().replace(/\s+/g, " ").trim());
  const toks = vals.map((v) => v.replace(/\(/g, " (").split(" ").filter(Boolean));
  let multi = toks.filter((t) => t.length > 2); if (multi.length < 2) multi = toks.filter((t) => t.length > 1); let common = [];
  if (multi.length >= 2) for (let n = 1; n <= 5; n++) { const tail = multi[0].slice(-n).join(" "); if (multi.every((t) => t.slice(-n).join(" ") === tail && t.length > n)) common = multi[0].slice(-n); else break; }
  const strip = (t) => { for (let n = common.length; n > 0; n--) { const tail = common.slice(-n).join(" "); if (t.length > n && t.slice(-n).join(" ") === tail) return t.slice(0, t.length - n); } return t; };
  const cut = toks.map((t) => strip(t).filter((w) => !/^(NATURE|SEAT|SEATS|CATEGORY)$/i.test(w)).join(" ").trim());
  const quota = cut.map((c) => (/^(AI|AIQ|ALL INDIA|STATE|MGMT|MANAGEMENT|NRI|PAID|GOVT|DEEMED)$/i.test(c) ? c + " QUOTA" : c));
  return { cols: [header[0], ...quota.map((c, i) => c || vals[i])], suffix: common.join(" ").replace(/\s+\(/g, " (") };
}
function inr(v) { const n = parseFloat(String(v).replace(/,/g, "")); return isFinite(n) ? n : NaN; }
function lakh(v) { const n = inr(v); if (!isFinite(n)) return v; if (n >= 1e7) return (n / 1e7).toFixed(2).replace(/\.?0+$/, "") + " crore"; if (n >= 1e5) { const l = Math.floor(n / 1e5), t = Math.round((n % 1e5) / 1e3); return l + " lakh" + (t ? " " + t + " thousand" : ""); } return String(n); }
async function localPlan(hint) {
  $("msg").textContent = "Reading the image on this device (first run downloads language data)…";
  if (!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js");
  const good = (d) => (d.words || []).filter((w) => w.confidence > 50 && w.text.replace(/\W/g, "").length >= 2).length;
  let data = await ocrRun(await ocrPrep(imgData, true));
  if (good(data) < 12) { const d2 = await ocrRun(await ocrPrep(imgData, false)); if (good(d2) > good(data)) data = d2; }
  $("msg").textContent = "";
  const lines = (data.lines || []).filter((l) => l.confidence > 35 && l.text.trim().length > 1);
  if (good(data) < 4 || !lines.length) throw new Error("Couldn't read any text in this image. Please upload a clearer image.");
  const T = tableFromLines(lines);
  return T ? planFromTable(T, hint) : planFromText(lines.map((l) => fixOcr(l.text)).filter((l) => l.length > 3));
}
function planFromTable(T, hint) {
  const ed = [];
  const nameIdx = 0, valIdx = T.header.map((_, i) => i).filter((i) => i > 0);
  let { cols, suffix } = shortenHeaders(T.header.length ? T.header : T.rows[0].map((_, i) => (i ? "COLUMN " + i : "ITEM")));
  const all = T.rows.map((r, i) => ({ r: r.map((c) => (isNA(c) && c ? "N/A" : c)), span: T.spans[i] || {} }));
  const keep = all.filter((x) => x.r.slice(1).some((v) => v && !isNA(v)));
  const dropped = all.filter((x) => !keep.includes(x)).map((x) => x.r[0]).filter(Boolean);
  // shared prefix like "MD(" -> move into the label
  let prefix = "";
  const pm = keep.length && keep.every((x) => /^([A-Z]{2,6})\s*\(/.test(x.r[0])) ? keep[0].r[0].match(/^([A-Z]{2,6})\s*\(/)[1] : "";
  if (pm && keep.every((x) => x.r[0].startsWith(pm))) { prefix = pm; const strip = (s) => s.replace(new RegExp("^" + pm + "\\s*\\("), "").replace(/\)\s*$/, ""); keep.forEach((x) => (x.r[0] = strip(x.r[0]))); dropped.forEach((d, i) => (dropped[i] = strip(d))); cols[0] = pm + " " + (/^particulars|fee head|^item/i.test(cols[0]) ? "BRANCH" : cols[0]); }
  else { keep.forEach((x) => (x.r[0] = fixLabel(x.r[0]))); const up = keep.filter((x) => x.r[0] === x.r[0].toUpperCase()).length > keep.length / 2; if (up) keep.forEach((x) => { if (x.r[0].length <= 4) x.r[0] = x.r[0].toUpperCase(); }); }
  const isFee = /fee|tuition|₹|rs\.?/i.test(T.header.join(" ") + " " + T.section + " " + T.pre.join(" ")) || keep.some((x) => x.r.slice(1).some((v) => MONEY.test(v)));
  const isSched = !isFee && keep.some((x) => x.r.slice(1).some((v) => DATEISH.test(v)));
  // title block
  let inst = "", place = "";
  const pre = T.pre.filter((t) => !/^college name|^name\s*&|^address$/i.test(t));
  const blk = pre.join(" ").replace(/\s+/g, " ").trim();
  if (/institute|college|university|medical|sciences|hospital|aiims/i.test(blk)) { inst = blk.split(",")[0].trim(); place = blk.slice(inst.length).replace(/^[,\s]+/, ""); place = place.split(/,\s*/).filter((x) => x.toLowerCase() !== inst.toLowerCase()).join(", "); }
  const heading = !inst && pre.length ? pre.reduce((a, b) => (b.length > a.length && b.length < 90 ? b : a), pre[0]) : "";
  const firstCol = String(cols[0] || "").toUpperCase();
  const label = [prefix, (suffix || T.section.replace(/^[IVX\d. ]+[A-Z]?\s*[—–-]\s*/, "") || (/^STATE/.test(firstCol) && isSched ? "STATE-WISE SCHEDULE" : heading ? "" : isFee ? "FEES" : "DETAILS"))].filter(Boolean).join(" ").replace(/\s+/g, " ").toUpperCase() || heading.toUpperCase();
  const city = (place.match(/([A-Z][a-z]+),?\s*(Rajasthan|Uttar Pradesh|Maharashtra|Gujarat|Karnataka|Tamil Nadu|Kerala|Bihar|Madhya Pradesh|Haryana|Punjab|Delhi|Telangana|Andhra Pradesh|West Bengal|Odisha|Assam|Jharkhand|Chhattisgarh|Uttarakhand|Himachal Pradesh)/) || [])[0] || "";
  const short = inst.replace(/\b(of|and|&)\b/gi, " ").split(/\s+/).slice(0, 3).join(" ");
  const P = {
    content_type: isFee ? "fee_structure" : isSched ? "counselling_schedule" : "other", language: "en",
    series: /neet\s*pg/i.test(blk) || prefix === "MD" || prefix === "MS" ? "NEET PG" : /neet/i.test(blk) ? "NEET" : "",
    is_official_notice: false,
    intro: { kicker: isFee ? "FEE STRUCTURE" : isSched ? "SCHEDULE" : "KEY DETAILS", big: (heading || label).split(" ").slice(0, 4).join(" "), sub: inst ? (short + (city ? ", " + city.split(",")[0] : "")) : "" },
    headline: { title: heading || tcase(label.toLowerCase()).replace(/\bMd\b/, "MD").replace(/\bMs\b/, "MS"), subtitle: inst ? (inst + (place ? ", " + place : "")) : isSched ? "State-wise registration, choice filling, result and reporting dates" : "", chips: [city, suffix.match(/year/i) ? "Per year" : "", isFee ? keep.length + " " + (prefix ? prefix + " " : "") + "branches with fees" : isSched && /^STATE/.test(firstCol) ? keep.length + " states / MCC" : ""].filter(Boolean) },
    scenes: [], show_original: true, editor_notes: ed, source_header: T.header,
    hook_say: isFee ? `${prefix || ""} fees${inst ? " at " + inst : ""}. Here is what you will pay.` : `${heading || label}. Here are the details.`,
  };
  if (dropped.length) ed.push(`Removed the rows where every value is N/A (${dropped.length} read) – summarised in one note instead`);
  const vcols = cols.slice(1);
  // big numbers for fee tables
  if (isFee) {
    const cand = []; keep.forEach((x) => x.r.slice(1).forEach((v, i) => { if (MONEY.test(v)) cand.push({ row: x.r[0], col: vcols[i], v, n: inr(v) }); }));
    cand.sort((a, b) => b.n - a.n);
    const seen = new Set(), top = cand.filter((c) => (seen.has(c.row) ? false : seen.add(c.row))).slice(0, 2);
    if (top.length) { P.scenes.push({ type: "stats", label: top.length > 1 ? "TOP FEES" : "HIGHEST FEE", items: top.map((c) => ({ label: (prefix ? prefix + " " : "") + c.row, value: c.v, sub: tcase((c.col || "").toLowerCase()) + (suffix.match(/year/i) ? " • per year" : "") })), say: top.map((c) => `${(prefix ? prefix + " " : "") + c.row}, ${c.col ? tcase(c.col.toLowerCase()) : ""}: ${lakh(c.v)} rupees`).join(". ") + "." }); ed.push("Opened with the highest fee as the hook"); }
  }
  P.scenes.push({ type: "table", label: label || "DETAILS", columns: cols, rows: keep.map((x) => x.r), spans: keep.map((x) => x.span), highlight_col: isFee ? 1 : Math.min(3, cols.length - 1), note: suffix.match(/year/i) ? "Fees per year, as printed on the sheet" : "", say: isFee ? keep.slice(0, 4).map((x) => `${x.r[0]}: ${x.r.slice(1).filter((v) => MONEY.test(v)).map(lakh)[0] || "not listed"}`).join(". ") + "." : `Here is the ${label.toLowerCase()}. Check your row carefully.` });
  if (dropped.length) {
    const names = dropped.slice(0, 4).join(", ");
    // on-device reading can miss a row, so no exact count here – only names that were read
    P.scenes.push({ type: "callout", label: "NOTE", text: `Other ${prefix ? prefix + " " : ""}options show N/A on this sheet, e.g. ${names}.`, say: `Many other ${prefix ? prefix + " " : ""}options show no fee on this sheet. Confirm with the college before choice filling.` });
  }
  P.caption = `${P.headline.title}${inst ? " – " + inst : ""}\n\n` + keep.map((x) => "• " + x.r[0] + ": " + x.r.slice(1).map((v, i) => `${vcols[i]} ${v || "—"}`).join(" | ")).join("\n") + (dropped.length ? `\n\nOther options show N/A on this sheet.` : "");
  P.hashtags = (P.series ? "#" + P.series.replace(/\s+/g, "") + " " : "") + (isFee ? "#MedicalFees #FeeStructure " : "#Counselling ") + "#NEET #YourChanakya";
  ed.push("Made by the on-device editor (no AI server) – values read with OCR, please double-check");
  return P;
}
function planFromText(lines) {
  const top = lines.slice(0, 6); const title = top.reduce((a, b) => (b.length > a.length && b.length < 130 ? b : a), top[0]);
  const rest = lines.filter((l) => l !== title);
  const key = /\d|date|last|fee|round|deadline|time|link|www|http|तिथि|दिनांक|शुल्क|अंतिम/i;
  const items = rest.filter((l) => key.test(l) && l.length > 8).slice(0, 5).map((l) => { const m = l.split(/\s*[:\-–]\s+/); return m.length > 1 ? { label: m[0].slice(0, 28), value: m.slice(1).join(": ").slice(0, 140) } : { label: "KEY POINT", value: l.slice(0, 140) }; });
  if (!items.length) rest.slice(0, 4).forEach((l) => items.push({ label: "KEY POINT", value: l.slice(0, 140) }));
  return { content_type: "notice", language: hasDev(title) ? "hi" : "en", series: /neet\s*pg/i.test(title) ? "NEET PG" : /neet/i.test(title) ? "NEET UG" : "", is_official_notice: /notice|nmc|mcc|nta|circular|सूचना/i.test(lines.join(" ")),
    intro: { kicker: "LATEST UPDATE", big: title.split(" ").slice(0, 4).join(" "), sub: "" }, headline: { title, subtitle: "", chips: [] },
    scenes: [{ type: "bullets", label: "KEY POINTS", items, say: items.map((i) => i.label + ". " + i.value).join(". ") }], hook_say: title, show_original: true,
    caption: title + "\n\n" + items.map((i) => "• " + i.label + ": " + i.value).join("\n"), hashtags: "#NEET #YourChanakya", editor_notes: ["Made by the on-device editor (no AI server) – please double-check the text"] };
}

/* ---------------- 2. CRITIC: layout & rule checks with auto-fix ---------------- */
function critic(P) {
  const fixes = [];
  P.intro = P.intro || {}; P.headline = P.headline || {}; P.headline.chips = (P.headline.chips || []).filter(Boolean).slice(0, 3);
  if (!P.intro.big) P.intro.big = (P.headline.title || "LATEST UPDATE").split(" ").slice(0, 4).join(" ");
  if (!P.headline.title) P.headline.title = P.intro.big;
  const out = [];
  for (const s of P.scenes || []) {
    if (s.type === "table") {
      const ncol = Math.max(s.columns?.length || 0, ...s.rows.map((r) => r.length));
      let rows = s.rows.map((r, i) => ({ r: [...r, ...Array(Math.max(0, ncol - r.length)).fill("")], sp: (s.spans || [])[i] || {} }));
      const before = rows.length; rows = rows.filter((x) => x.r.slice(1).some((v) => v && !isNA(v)) || Object.keys(x.sp).length);
      if (rows.length < before) fixes.push(`Critic: hid ${before - rows.length} table row(s) where every value was N/A`);
      if (!rows.length) continue;
      const per = 7, pages = Math.ceil(rows.length / per);
      if (pages > 1) fixes.push(`Critic: split the ${rows.length}-row table into ${pages} readable pages`);
      for (let p = 0; p < pages; p++) { const part = rows.slice(p * per, (p + 1) * per); out.push({ ...s, columns: (s.columns || []).concat(Array(Math.max(0, ncol - (s.columns || []).length)).fill("")), rows: part.map((x) => x.r), spans: part.map((x) => x.sp), page: pages > 1 ? `${p + 1}/${pages}` : "", say: p === 0 ? s.say : "" }); }
    } else if (s.type === "bullets") {
      const items = s.items.filter((i) => i.value); for (let p = 0; p < items.length; p += 4) out.push({ ...s, items: items.slice(p, p + 4), page: items.length > 4 ? `${p / 4 + 1}/${Math.ceil(items.length / 4)}` : "", say: p === 0 ? s.say : "" });
      if (items.length > 4) fixes.push("Critic: split long point list into pages of 4");
    } else if (s.type === "stats") { if (s.items.length) out.push({ ...s, items: s.items.slice(0, 4) }); }
    else if (s.type === "callout" && s.text) out.push(s);
  }
  if (!out.length) throw new Error("The editor could not find anything worth showing in this image.");
  P.scenes = out.slice(0, 8);
  if (!P.is_official_notice) { const strip = (t) => String(t || "").replace(/\bofficial\b\s*/gi, ""); P.intro.kicker = strip(P.intro.kicker); P.scenes.forEach((s) => (s.label = strip(s.label))); }
  return fixes;
}

/* ---------------- audio ---------------- */
let AC = null, voiceErr = "";
const actx = () => (AC = AC || new (window.AudioContext || window.webkitAudioContext)());
async function decode(buf) { return await actx().decodeAudioData(buf.slice(0)); }
async function loadStored(name) { try { const r = await fetch((window.EMBED && EMBED["voice/" + name + ".mp3"]) || "voice/" + name + ".mp3"); return await decode(await r.arrayBuffer()); } catch { return null; } }
async function fetchVoice(text, lang) {
  if (!$("vo").checked || !server.ok || !text || text.length < 5) return null;
  try {
    const r = await fetch(API() + "/api/voice", { method: "POST", headers: HDR(), body: JSON.stringify({ text, lang }) });
    if (!r.ok) { try { const j = await r.json(); voiceErr = j.detail || j.error || String(r.status); } catch { voiceErr = String(r.status); } return null; }
    const b = await decode(await r.arrayBuffer()); return b.duration > 0.6 ? b : null;
  } catch (e) { voiceErr = String(e.message || e); return null; }
}
function envelope(buf, startT, env) {
  const d = buf.getChannelData(0), hop = Math.floor(buf.sampleRate / FPS), n = Math.floor(d.length / hop), rms = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < hop; k += 4) { const v = d[i * hop + k]; s += v * v; } rms[i] = Math.sqrt(s / (hop / 4)); }
  const sorted = Array.from(rms).filter((v) => v > 1e-4).sort((a, b) => a - b); const ref = sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : 1;
  let v = 0; const f0 = Math.round(startT * FPS);
  for (let i = 0; i < n; i++) { const x = Math.min(1, rms[i] / ref); v = x > v ? x : v * 0.6 + x * 0.4; if (f0 + i < env.length) env[f0 + i] = Math.max(env[f0 + i], v); }
}
async function mixAudio(total, placements, env, sfxTimes) {
  const SR = 44100, oc = new OfflineAudioContext(2, Math.ceil((total + 0.5) * SR), SR);
  const master = oc.createDynamicsCompressor(); master.threshold.value = -10; master.ratio.value = 4; master.connect(oc.destination);
  const noise = oc.createBuffer(1, SR, SR); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const bed = oc.createGain(); bed.connect(master);
  for (let t = 0; t < total; t += 0.04) { const e = env[Math.min(env.length - 1, Math.floor(t * FPS))] || 0; const fade = Math.min(1, t / 0.15, (total - t) / 1.4); bed.gain.setValueAtTime(0.28 * (1 - 0.74 * e) * Math.max(0, fade), t); }
  const bpm = 104, beat = 60 / bpm, bar = beat * 4, mf = (m) => 440 * 2 ** ((m - 69) / 12);
  const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], roots = [57, 53, 48, 55];
  const env1 = (g, t, a, dur, peak) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); };
  const osc = (type, f, t, dur, peak, a, dest) => { const o = oc.createOscillator(), g = oc.createGain(); o.type = type; o.frequency.value = f; env1(g, t, a, dur, peak); o.connect(g); g.connect(dest || bed); o.start(t); o.stop(t + dur + 0.05); return o; };
  const nz = (t, dur, hp, peak, dest) => { const s = oc.createBufferSource(), f = oc.createBiquadFilter(), g = oc.createGain(); s.buffer = noise; f.type = "highpass"; f.frequency.value = hp; env1(g, t, 0.002, dur, peak); s.connect(f); f.connect(g); g.connect(dest || bed); s.start(t); s.stop(t + dur + 0.05); };
  const padLp = oc.createBiquadFilter(); padLp.type = "lowpass"; padLp.frequency.value = 900; const padG = oc.createGain(); padG.gain.value = 0.09; padLp.connect(padG); padG.connect(bed);
  for (let b = 0, t0 = 0; t0 < total; b++, t0 = b * bar) {
    const i = b % 4;
    chords[i].forEach((m) => [-7, 7].forEach((c) => { const o = oc.createOscillator(), g = oc.createGain(); o.type = "sawtooth"; o.frequency.value = mf(m); o.detune.value = c; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + 0.25); g.gain.setValueAtTime(1, t0 + bar - 0.25); g.gain.linearRampToValueAtTime(0, t0 + bar); o.connect(g); g.connect(padLp); o.start(t0); o.stop(t0 + bar + 0.05); }));
    for (let k = 0; k < 8; k++) { const f = mf((k % 4 !== 3 ? roots[i] : roots[i] + 7) - 12); osc("sine", f, t0 + k * beat / 2, 0.3, 0.2, 0.004); }
    const arp = [chords[i][0] + 12, chords[i][1] + 12, chords[i][2] + 12, chords[i][1] + 12];
    for (let k = 0; k < 16; k++) { if (k % 2 === 1 && k % 4 !== 3) continue; osc("sine", mf(arp[k % 4]), t0 + k * beat / 4, 0.14, 0.08, 0.002); }
    for (let k = 0; k < 4; k++) { const ts = t0 + k * beat; if (k % 2 === 0) { const o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(140, ts); o.frequency.exponentialRampToValueAtTime(48, ts + 0.12); env1(g, ts, 0.003, 0.22, 0.55); o.connect(g); g.connect(bed); o.start(ts); o.stop(ts + 0.3); } else nz(ts, 0.12, 1500, 0.25); }
    for (let k = 0; k < 8; k++) nz(t0 + k * beat / 2 + beat / 4, 0.04, 7000, 0.07);
  }
  const sfx = oc.createGain(); sfx.gain.value = 0.5; sfx.connect(master);
  sfxTimes.forEach(([t, kind]) => {
    if (kind === "pop") { const o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(1100, t); o.frequency.exponentialRampToValueAtTime(600, t + 0.1); env1(g, t, 0.003, 0.14, 0.5); o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 0.2); }
    else if (kind === "tick") { const o = oc.createOscillator(), g = oc.createGain(); o.frequency.value = 1800; env1(g, t, 0.002, 0.05, 0.18); o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 0.08); }
    else { const s = oc.createBufferSource(), f = oc.createBiquadFilter(), g = oc.createGain(); s.buffer = noise; f.type = "bandpass"; f.Q.value = 0.8; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(5200, t + 0.4); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.18); g.gain.linearRampToValueAtTime(0.0001, t + 0.42); s.connect(f); f.connect(g); g.connect(sfx); s.start(t); s.stop(t + 0.5); }
  });
  placements.forEach(({ buf, t }) => { const s = oc.createBufferSource(); s.buffer = buf; s.connect(master); s.start(t); });
  return await oc.startRendering();
}

/* ---------------- 3. TIMELINE: scene durations from voice + reading time ---------------- */
function readTime(s) {
  if (s.type === "table") return 2.4 + s.rows.length * 1.15 + (s.columns.length > 3 ? 0.8 : 0);
  if (s.type === "stats") return 2.0 + s.items.length * 1.6;
  if (s.type === "bullets") return 1.6 + s.items.reduce((a, i) => a + 1.1 + (i.label.length + i.value.length) / 38, 0);
  if (s.type === "callout") return 1.8 + s.text.split(/\s+/).length / 3.3;
  return 3;
}
const TRANS = { table: "wipe", stats: "circle", bullets: "up", callout: "zoom" };
function buildTimeline(P, voices, hook, cta) {
  const sc = []; let t = 0; const place = []; const add = (o) => { o.start = t; t += o.dur; sc.push(o); return o; };
  const hv = voices[0];
  add({ type: "intro", dur: 2.5, tr: "none" });
  add({ type: "headline", dur: Math.max(3.4, hv ? hv.duration - 2.1 + 0.6 : 3.8), tr: "wipe" });
  if (hv) place.push({ buf: hv, t: 0.35 }); else if (hook) place.push({ buf: hook, t: 0.2 });
  P.scenes.forEach((s, i) => {
    const v = voices[i + 1], o = add({ type: "scene", s, dur: clamp(Math.max(readTime(s), v ? v.duration + 0.7 : 0), 3, 14), tr: TRANS[s.type] || "wipe" });
    if (v) place.push({ buf: v, t: o.start + 0.35 });
  });
  if (P.show_original && imgEl) add({ type: "original", dur: 3.2, tr: "up" });
  const ctaS = add({ type: "cta", dur: cta ? cta.duration + 1.0 : 6, tr: "zoom" });
  if (cta) place.push({ buf: cta, t: ctaS.start + 0.45 });
  const sfx = []; sc.forEach((s, i) => { if (i) sfx.push([s.start - 0.05, s.tr === "pop" ? "pop" : "whoosh"]); if (s.s && s.s.type === "table") s.s.rows.forEach((_, r) => sfx.push([s.start + 0.45 + r * 0.16, "tick"])); });
  return { sc, total: t, place, sfx };
}

/* ---------------- 4. DRAWING ---------------- */
const cv = $("cv"), ctx = cv.getContext("2d");
const mobile = matchMedia("(pointer:coarse)").matches; const SC = mobile ? 2 / 3 : 1; cv.width = Math.round(W * SC); cv.height = Math.round(H * SC);
const IMG = {}; let bgC, chromeC;
const ease = { out: (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3), back: (x) => { x = clamp(x, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); } };
function loadImg(src) { return new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }); }
function wrap(x, text, w) {
  const out = []; for (const para of String(text).split(/\n/)) {
    let line = ""; for (let word of para.split(/\s+/).filter(Boolean)) {
      while (x.measureText(word).width > w) { let k = word.length; while (k > 1 && x.measureText(word.slice(0, k)).width > w) k--; if (line) { out.push(line); line = ""; } out.push(word.slice(0, k)); word = word.slice(k); }
      const tryL = line ? line + " " + word : word; if (x.measureText(tryL).width <= w) line = tryL; else { out.push(line); line = word; }
    } if (line) out.push(line);
  } return out;
}
function fit(x, text, w, h, max, min, weight, maxLines = 99) {
  const dev = hasDev(text);
  const words = String(text).split(/\s+/).filter(Boolean);
  for (let s = max; s >= min; s -= 2) { x.font = `${weight} ${s}px ${FONT}`; if (s > min && words.some((wd) => x.measureText(wd).width > w)) continue; const lh = s * (dev ? 1.45 : 1.18), lines = wrap(x, text, w); if (lines.length * lh <= h && lines.length <= maxLines) return { s, lines, lh, weight }; }
  x.font = `${weight} ${min}px ${FONT}`; const lh = min * (dev ? 1.45 : 1.18); let lines = wrap(x, text, w); const mx = Math.max(1, Math.min(maxLines, Math.floor(h / lh))); if (lines.length > mx) { lines = lines.slice(0, mx); lines[mx - 1] = lines[mx - 1].replace(/\s*\S*$/, "") + "…"; } return { s: min, lines, lh, weight };
}
function txt(x, f, px, py, color, align = "left", base = "top") { x.fillStyle = color; x.textAlign = align; x.textBaseline = base; x.font = `${f.weight || 900} ${f.s}px ${FONT}`; f.lines.forEach((l, i) => x.fillText(l, px, py + i * f.lh)); }
function pill(x, label, px, py, h, bg, fg, size, padX = 28, align = "left") {
  x.font = `900 ${size}px ${FONT}`; const w = x.measureText(label).width + padX * 2, X = align === "center" ? px - w / 2 : align === "right" ? px - w : px;
  x.fillStyle = bg; x.beginPath(); x.roundRect(X, py, w, h, h / 2); x.fill(); x.fillStyle = fg; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(label, X + w / 2, py + h / 2 + 2); return w;
}
function mkBg() {
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0E2470"); g.addColorStop(1, C.dark); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = "rgba(255,255,255,.045)"; x.lineWidth = 2; for (let i = 0; i < W; i += 72) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let j = 0; j < H; j += 72) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
  if (IMG.logo) { x.globalAlpha = 0.06; const w = 860, h = w * IMG.logo.height / IMG.logo.width; x.drawImage(IMG.logo, (W - w) / 2, 820, w, h); x.globalAlpha = 1; }
  const r = x.createRadialGradient(W * 0.75, 380, 50, W * 0.75, 380, 900); r.addColorStop(0, "rgba(70,110,235,.30)"); r.addColorStop(1, "rgba(70,110,235,0)"); x.fillStyle = r; x.fillRect(0, 0, W, H);
  const r2 = x.createRadialGradient(W * 0.1, 1500, 50, W * 0.1, 1500, 700); r2.addColorStop(0, "rgba(200,16,26,.18)"); r2.addColorStop(1, "rgba(200,16,26,0)"); x.fillStyle = r2; x.fillRect(0, 0, W, H);
  return c;
}
let TICKER = "", tickW = 0;
function mkChrome(P) {
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.beginPath(); x.roundRect(48, 52, 250, 126, 26); x.fill();
  if (IMG.logo) { const w = 214, h = w * IMG.logo.height / IMG.logo.width; x.drawImage(IMG.logo, 66, 52 + (126 - h) / 2, w, h); }
  const tag = (P.series || "LATEST UPDATE").toUpperCase(); x.font = `900 30px ${FONT}`; const w = x.measureText(tag).width + 76;
  x.fillStyle = C.red; x.beginPath(); x.roundRect(W - 48 - w, 84, w, 64, 32); x.fill(); x.fillStyle = "#fff"; x.beginPath(); x.arc(W - 48 - w + 30, 116, 8, 0, 7); x.fill();
  x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(tag, W - 48 - w / 2 + 12, 118);
  x.fillStyle = C.red; x.beginPath(); x.roundRect(48, 1500, W - 96, 76, 14); x.fill();
  x.fillStyle = C.yel; x.beginPath(); x.roundRect(48, 1500, 270, 76, 14); x.fill(); x.fillStyle = C.navy; x.font = `900 30px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("YOUR CHANAKYA", 183, 1540);
  pill(x, BRAND.site, 48, 1640, 78, C.yel, C.navy, 38, 34); const pw = (x.font = `900 40px ${FONT}`, x.measureText("☎ " + BRAND.phone).width + 68);
  x.fillStyle = "#fff"; x.beginPath(); x.roundRect(W - 48 - pw, 1640, pw, 78, 39); x.fill(); x.fillStyle = C.navy; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("☎ " + BRAND.phone, W - 48 - pw / 2, 1681);
  x.fillStyle = "rgba(255,255,255,.62)"; x.font = `700 26px ${FONT}`;
  x.fillText(P.is_official_notice ? "Information as per the official notice shown. Please verify on the official website." : "Values as printed on the shared image. Please verify with the official source.", W / 2, 1790);
  TICKER = ["YOUR CHANAKYA", P.series, P.headline.title, "FOLLOW FOR EVERY NOTIFICATION & UPDATE", "CALL " + BRAND.phone].filter(Boolean).map((s) => s.toUpperCase()).join("   •   ") + "   •   "; tickW = 0;
  return c;
}
function drawChrome(t, total) {
  ctx.drawImage(chromeC, 0, 0);
  ctx.save(); ctx.beginPath(); ctx.rect(330, 1504, W - 48 - 330 - 14, 68); ctx.clip(); ctx.fillStyle = "#fff"; ctx.font = `900 32px ${FONT}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  if (!tickW) tickW = ctx.measureText(TICKER).width; const off = (t * 150) % tickW; for (let k = -1; k < 3; k++) ctx.fillText(TICKER, 330 - off + k * tickW, 1540); ctx.restore();
  ctx.fillStyle = C.yel; ctx.fillRect(0, 1486, W * Math.min(1, t / total), 8);
}
function avatar(cx, cy, D, env, label) {
  const sc = 1 + 0.045 * env, bob = -6 * env, R = D / 2 * sc;
  ctx.save(); ctx.translate(cx, cy + bob);
  const g = ctx.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.35); g.addColorStop(0, "rgba(255,210,31,.35)"); g.addColorStop(1, "rgba(255,210,31,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.35, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fillStyle = "#fff"; ctx.fill(); ctx.save(); ctx.clip();
  if (IMG.avatar) { const s = Math.max(2 * R / IMG.avatar.width, 2 * R / IMG.avatar.height); ctx.drawImage(IMG.avatar, -IMG.avatar.width * s / 2, -IMG.avatar.height * s / 2, IMG.avatar.width * s, IMG.avatar.height * s); } ctx.restore();
  ctx.lineWidth = Math.max(6, D * 0.03); ctx.strokeStyle = C.yel; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke(); ctx.restore();
  if (label) pill(ctx, "CHANAKYA SIR", cx, cy + bob + R - 14, Math.max(40, D * 0.14), C.red, "#fff", Math.max(22, D * 0.075), 22, "center");
}
function hlBlocks(text, x0, y0, w, h, max, min, lt, delay = 0.1) {
  const st = hasDev(text) ? text : text.toUpperCase(); const f = fit(ctx, st, w, h, max, min, 900, 4);
  let y = y0; f.lines.forEach((l, i) => {
    const k = ease.out((lt - delay - i * 0.09) / 0.35); if (k <= 0) { y += f.lh + 10; return; }
    ctx.font = `900 ${f.s}px ${FONT}`; const lw = ctx.measureText(l).width;
    ctx.fillStyle = C.yel; ctx.beginPath(); ctx.roundRect(x0 - 10, y + 2, (lw + 44) * k, f.lh - 2, 12); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 10, y, (lw + 44) * k, f.lh + 4); ctx.clip(); ctx.fillStyle = C.navy; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(l, x0 + 12, y + (f.lh - f.s) / 2 - 2); ctx.restore();
    y += f.lh + 10;
  });
  return y;
}
function sceneHeader(s, lt, env) {
  avatar(W - 48 - 98, 214 + 98, 196, env, true);
  const lab = (s.label || "").toUpperCase() + (s.page ? "   " + s.page : "");
  ctx.save(); ctx.globalAlpha = ease.out(lt / 0.3); ctx.translate((1 - ease.out(lt / 0.3)) * -40, 0);
  const f = fit(ctx, lab, 700, 140, 46, 30, 900, 2);
  ctx.fillStyle = C.red; ctx.fillRect(48, 262, 12, f.lines.length * f.lh + 6);
  txt(ctx, f, 80, 262, "#fff"); ctx.restore();
  return 262 + f.lines.length * f.lh + 34;
}
// Indian / western grouping for the count-up animation
function groupLike(orig, n) {
  const s = String(Math.round(n)); if (!/,/.test(orig)) return s;
  const indian = /\d,\d{2},\d{3}/.test(orig); if (!indian) return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const last3 = s.slice(-3), rest = s.slice(0, -3); return rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
}
function drawTable(s, lt, top, P) {
  const cols = s.columns.length ? s.columns : s.rows[0].map(() => ""); const n = cols.length;
  const X0 = 40, TW = W - 80, bottom = 1440 - (s.note ? 60 : 0);
  // column widths from content (first column wider)
  ctx.font = `900 38px ${FONT}`;
  const need = cols.map((c, i) => Math.max(...String(c).split(/\s+/).map((wd) => ctx.measureText(wd.toUpperCase()).width * 0.8), ...s.rows.map((r) => (i === 0 ? Math.max(...String(r[i] || "").split(/\s+/).map((wd) => ctx.measureText(wd).width)) : ctx.measureText(String(r[i] || "")).width))) + (i === s.highlight_col ? 56 : 34));
  need[0] = clamp(need[0], TW * 0.24, TW * 0.36); const tot = need.reduce((a, b) => a + b, 0);
  // first column sized to its content, value columns share the rest equally (even, calm look)
  const w0 = clamp(need[0], TW * 0.24, TW * (n >= 5 ? 0.3 : 0.36)); let wsz = [w0, ...Array(n - 1).fill((TW - w0) / Math.max(1, n - 1))];
  const xs = [X0]; wsz.forEach((v, i) => xs.push(xs[i] + v));
  // header
  const hf = cols.map((c, i) => fit(ctx, String(c).toUpperCase(), wsz[i] - 18, 96, 30, 18, 900, 3));
  const hh = Math.max(...hf.map((f) => f.lines.length * f.lh)) + 30;
  const avail = bottom - top - hh - 10, rh = clamp(avail / s.rows.length, 84, s.rows.length <= 4 ? 200 : 170);
  top += Math.max(0, (avail - rh * s.rows.length) * 0.35);
  const hk = ease.out(lt / 0.3);
  ctx.save(); ctx.globalAlpha = hk; ctx.fillStyle = C.yel; ctx.beginPath(); ctx.roundRect(X0, top, TW, hh, 18); ctx.fill();
  hf.forEach((f, i) => txt(ctx, f, i === 0 ? xs[i] + 22 : xs[i] + wsz[i] / 2, top + (hh - f.lines.length * f.lh) / 2, C.navy, i === 0 ? "left" : "center"));
  ctx.restore();
  // one font size per column so the table looks even
  const colMax = cols.map((_, ci) => {
    let m = ci === 0 ? (rh > 170 ? 44 : 40) : (rh > 170 ? 46 : 40);
    s.rows.forEach((r, ri) => { const sp = (s.spans && s.spans[ri]) || {}; if (sp[ci] > 1) return; const v = String(r[ci] ?? ""); if (!v) return;
      const cw = xs[ci + 1] - xs[ci]; const f = ci === 0 ? fit(ctx, v, cw - 30, rh - 22, m, 22, 900, 2) : fit(ctx, isNA(v) ? "N/A" : v, cw - (ci === s.highlight_col ? 40 : 22), rh - 26, m, 18, 900, /\d/.test(v) && v.length < 16 ? 1 : 2); m = Math.min(m, f.s); });
    return m; });
  if (n > 2) { const v = Math.min(...colMax.slice(1)); for (let i = 1; i < n; i++) colMax[i] = v; }
  let y = top + hh + 10;
  s.rows.forEach((r, ri) => {
    const k = ease.out((lt - 0.4 - ri * 0.16) / 0.35); if (k <= 0) { y += rh; return; }
    ctx.save(); ctx.globalAlpha = k; ctx.translate((1 - k) * 120, 0);
    ctx.fillStyle = ri % 2 ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.17)"; ctx.beginPath(); ctx.roundRect(X0, y + 4, TW, rh - 8, 16); ctx.fill();
    const sp = (s.spans && s.spans[ri]) || {};
    for (let ci = 0; ci < n; ci++) {
      const span = sp[ci] || 1; let v = String(r[ci] ?? ""); if (!v && ci > 0 && Object.keys(sp).some((k2) => +k2 < ci && +k2 + sp[k2] > ci)) continue;
      const cw = xs[Math.min(n, ci + span)] - xs[ci], na = isNA(v);
      if (ci === 0) { const f = fit(ctx, v, cw - 30, rh - 22, colMax[0], 22, 900, 2); txt(ctx, f, xs[ci] + 22, y + (rh - f.lines.length * f.lh) / 2, C.yel); continue; }
      if (span > 1) { const f = fit(ctx, v, cw - 24, rh - 24, 36, 20, 800, 2); f.weight = 800; ctx.font = `italic 800 ${f.s}px ${FONT}`; ctx.fillStyle = "rgba(255,255,255,.88)"; ctx.textAlign = "center"; ctx.textBaseline = "top"; f.lines.forEach((l, li) => ctx.fillText(l, xs[ci] + cw / 2, y + (rh - f.lines.length * f.lh) / 2 + li * f.lh)); continue; }
      const f = fit(ctx, na ? "N/A" : v, cw - (ci === s.highlight_col ? 40 : 22), rh - 26, colMax[ci], 18, 900, /\d/.test(v) && v.length < 16 ? 1 : 2);
      const cy = y + (rh - f.lines.length * f.lh) / 2;
      if (ci === s.highlight_col && !na) {
        ctx.font = `900 ${f.s}px ${FONT}`; const lw = Math.max(...f.lines.map((l) => ctx.measureText(l).width)) + 26, lh2 = f.lines.length * f.lh + 12;
        ctx.fillStyle = C.yel; ctx.beginPath(); ctx.roundRect(xs[ci] + cw / 2 - lw / 2, cy - 6, lw, lh2, 12); ctx.fill(); txt(ctx, f, xs[ci] + cw / 2, cy, C.navy, "center");
      } else txt(ctx, f, xs[ci] + cw / 2, cy, na ? "rgba(255,255,255,.45)" : "#fff", "center");
    }
    ctx.restore(); y += rh;
  });
  if (s.note) { ctx.globalAlpha = ease.out((lt - 0.8) / 0.4); const f = fit(ctx, s.note, TW - 20, 56, 30, 22, 700, 2); txt(ctx, f, W / 2, Math.min(y + 14, 1395), "rgba(255,255,255,.78)", "center"); ctx.globalAlpha = 1; }
}
function drawStats(s, lt, top, P) {
  const n = s.items.length, X0 = 48, TW = W - 96, bottom = 1450, gap = 26;
  const grid = n === 4, rowsN = grid ? 2 : n, colsN = grid ? 2 : 1;
  const ch = Math.min(n === 1 ? 560 : n === 2 ? 420 : 380, (bottom - top - gap * (rowsN - 1)) / rowsN), cw = (TW - gap * (colsN - 1)) / colsN;
  top += Math.max(0, (bottom - top - (ch * rowsN + gap * (rowsN - 1))) * 0.35);
  const money = P.content_type === "fee_structure";
  s.items.forEach((it, i) => {
    const k = ease.back((lt - 0.15 - i * 0.35) / 0.45); if (k <= 0) return;
    const r = grid ? Math.floor(i / 2) : i, c = grid ? i % 2 : 0, x = X0 + c * (cw + gap), y = top + r * (ch + gap);
    ctx.save(); ctx.translate(x + cw / 2, y + ch / 2); ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k); ctx.globalAlpha = clamp(k, 0, 1); ctx.translate(-(x + cw / 2), -(y + ch / 2));
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 30); ctx.fill();
    ctx.fillStyle = i === 0 ? C.red : C.org; ctx.beginPath(); ctx.roundRect(x, y, 20, ch, [30, 0, 0, 30]); ctx.fill();
    const pad = 50, lf = fit(ctx, (it.label || "").toUpperCase(), cw - pad - 30, ch * 0.24, 40, 24, 900, 2); txt(ctx, lf, x + pad, y + 30, C.red);
    // count-up value
    const raw = String(it.value), num = inr(raw), p = ease.out((lt - 0.3 - i * 0.35) / 0.9);
    const shown = isFinite(num) && /^\d[\d,]*$/.test(raw) && p < 1 ? groupLike(raw, num * p) : raw;
    const pre = money && isFinite(num) && /^\d[\d,]*$/.test(raw) ? "₹" : "";
    const vf = fit(ctx, pre + raw, cw - pad - 30, ch * 0.45, grid ? 96 : n === 1 ? 170 : 132, 44, 900, 1);
    ctx.font = `900 ${vf.s}px ${FONT}`; ctx.fillStyle = C.navy; ctx.textAlign = "left"; ctx.textBaseline = "top";
    const vy = y + 30 + lf.lines.length * lf.lh + 14; ctx.fillText(pre + shown, x + pad, vy);
    if (it.sub) { const sf = fit(ctx, it.sub, cw - pad - 30, ch - (vy - y) - vf.lh - 20, 34, 22, 700, 2); txt(ctx, sf, x + pad, vy + vf.lh + 8, C.mute); }
    ctx.restore();
  });
}
function drawBullets(s, lt, top) {
  const n = s.items.length, gap = 22, bottom = 1450, ch = Math.min(250, (bottom - top - gap * (n - 1)) / n);
  s.items.forEach((p, j) => {
    const k = ease.back((lt - 0.2 - j * 0.45) / 0.4); if (k <= 0) return; const y = top + j * (ch + gap);
    ctx.save(); ctx.globalAlpha = clamp(k, 0, 1); ctx.translate((1 - clamp(k, 0, 1)) * 80, 0);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(48, y, 984, ch, 26); ctx.fill();
    ctx.fillStyle = j % 2 ? C.org : C.red; ctx.beginPath(); ctx.roundRect(48, y, 18, ch, [26, 0, 0, 26]); ctx.fill();
    const lab = fit(ctx, hasDev(p.label) ? p.label : p.label.toUpperCase(), 900, ch * 0.3, 34, 22, 900, 1); txt(ctx, lab, 92, y + 18, C.red);
    const val = fit(ctx, p.value, 900, ch - 18 - lab.lh - 26, 52, 26, 800, 4); txt(ctx, val, 92, y + 18 + lab.lh + 6, C.navy);
    ctx.restore();
  });
}
function drawCallout(s, lt, top) {
  const k = ease.back((lt - 0.1) / 0.5), y0 = Math.max(top + 40, 560), h = 760;
  ctx.save(); ctx.globalAlpha = clamp(k, 0, 1); ctx.translate(W / 2, y0 + h / 2); ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k); ctx.translate(-W / 2, -(y0 + h / 2));
  ctx.fillStyle = "rgba(255,210,31,.10)"; ctx.strokeStyle = C.yel; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(60, y0, W - 120, h, 34); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.yel; ctx.beginPath(); ctx.arc(W / 2, y0, 70, 0, 7); ctx.fill(); ctx.fillStyle = C.navy; ctx.font = `900 92px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("!", W / 2, y0 + 6);
  const f = fit(ctx, s.text, W - 220, h - 160, 70, 36, 800, 7); txt(ctx, f, W / 2, y0 + 110 + (h - 160 - f.lines.length * f.lh) / 2, "#fff", "center");
  ctx.restore();
}
function drawContent(sc, lt, P, env) {
  ctx.drawImage(bgC, 0, 0);
  if (sc.type === "intro") {
    const k = ease.back(lt / 0.55);
    if (P.intro.kicker) pill(ctx, P.intro.kicker.toUpperCase(), W / 2, 236, 70, C.yel, C.navy, 36, 34, "center");
    avatar(W / 2, 600, 340 * (0.82 + 0.18 * k), env, true);
    const big = hasDev(P.intro.big) ? P.intro.big : P.intro.big.toUpperCase(); const f = fit(ctx, big, 980, 330, 132, 60, 900, 3);
    const a = ease.out((lt - 0.2) / 0.4); ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * 40);
    const g = ctx.createLinearGradient(0, 860, 0, 860 + f.lines.length * f.lh); g.addColorStop(0, "#FFE680"); g.addColorStop(1, C.org);
    txt(ctx, f, W / 2, 860, g, "center"); ctx.restore();
    if (P.intro.sub) { ctx.globalAlpha = ease.out((lt - 0.5) / 0.4); const s2 = fit(ctx, P.intro.sub, 920, 140, 48, 30, 800, 2); txt(ctx, s2, W / 2, 880 + f.lines.length * f.lh + 30, "#fff", "center"); ctx.globalAlpha = 1; }
  } else if (sc.type === "headline") {
    avatar(W - 48 - 98, 214 + 98, 196, env, true);
    ctx.fillStyle = C.red; ctx.fillRect(48, 420, 260 * ease.out(lt / 0.4), 12);
    let y = hlBlocks(P.headline.title, 58, 470, 960, 440, 112, 54, lt);
    if (P.headline.subtitle) { ctx.globalAlpha = ease.out((lt - 0.45) / 0.4); const f = fit(ctx, P.headline.subtitle, 980, 300, 46, 28, 700, 5); txt(ctx, f, 48, y + 26, "#E8ECFF"); y += 26 + f.lines.length * f.lh; ctx.globalAlpha = 1; }
    let x = 48; y += 34;
    (P.headline.chips || []).forEach((c, i) => { const a = ease.back((lt - 0.7 - i * 0.15) / 0.35); if (a <= 0) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.font = `900 34px ${FONT}`; const w = ctx.measureText(c).width + 56; if (x + w > W - 48) { x = 48; y += 86; } ctx.strokeStyle = C.yel; ctx.lineWidth = 4; ctx.fillStyle = "rgba(255,210,31,.12)"; ctx.beginPath(); ctx.roundRect(x, y, w, 70, 35); ctx.fill(); ctx.stroke(); ctx.fillStyle = C.yel; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(c, x + w / 2, y + 37); ctx.restore(); x += w + 16; });
  } else if (sc.type === "scene") {
    const s = sc.s, top = sceneHeader(s, lt, env);
    if (s.type === "table") drawTable(s, lt, Math.max(top, 440), P);
    else if (s.type === "stats") drawStats(s, lt, Math.max(top, 450), P);
    else if (s.type === "bullets") drawBullets(s, lt, Math.max(top, 450));
    else if (s.type === "callout") drawCallout(s, lt, top);
  } else if (sc.type === "original") {
    avatar(W - 48 - 98, 214 + 98, 196, env, true);
    pill(ctx, P.is_official_notice ? "ORIGINAL NOTICE" : "SOURCE IMAGE", 48, 290, 64, C.yel, C.navy, 32, 28);
    const x0 = 48, y0 = 430, w0 = 984, h0 = 1020; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(x0, y0, w0, h0, 30); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(x0, y0, w0, h0, 30); ctx.clip();
    const pad = 18, s0 = Math.min((w0 - 2 * pad) / imgEl.width, (h0 - 2 * pad) / imgEl.height) * (1 + 0.08 * (lt / sc.dur));
    ctx.drawImage(imgEl, x0 + w0 / 2 - imgEl.width * s0 / 2, y0 + h0 / 2 - imgEl.height * s0 / 2, imgEl.width * s0, imgEl.height * s0); ctx.restore();
  } else if (sc.type === "cta") {
    avatar(W / 2, 376, 300, env, true);
    const k = ease.back((lt - 0.1) / 0.45); ctx.save(); ctx.translate(W / 2, 700); ctx.scale(k, k); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(-270, -100, 540, 200, 30); ctx.fill();
    if (IMG.logo) { const w = 460, h = w * IMG.logo.height / IMG.logo.width; ctx.drawImage(IMG.logo, -w / 2, -h / 2, w, h); } ctx.restore();
    ctx.globalAlpha = ease.out((lt - 0.3) / 0.4);
    txt(ctx, { s: 66, lines: ["FOLLOW YOUR CHANAKYA"], lh: 80, weight: 900 }, W / 2, 850, C.yel, "center");
    txt(ctx, { s: 42, lines: ["for every notification & update"], lh: 56, weight: 700 }, W / 2, 940, "#fff", "center");
    ctx.globalAlpha = 1; const bk = 1 + 0.04 * Math.sin(lt * 7);
    ctx.save(); ctx.translate(W / 2, 1120); ctx.scale(bk, bk); ctx.fillStyle = C.red; ctx.beginPath(); ctx.roundRect(-330, -58, 660, 116, 58); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = `900 52px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("CALL NOW  " + BRAND.phone, 0, 3); ctx.restore();
    txt(ctx, { s: 54, lines: [BRAND.site], lh: 66, weight: 900 }, W / 2, 1220, C.yel, "center");
  }
}
function drawFrame(t, TL, P, envArr) {
  const sc = TL.sc; let i = sc.length - 1; for (let k = 0; k < sc.length; k++) if (t < sc[k].start + sc[k].dur) { i = k; break; }
  const s = sc[i], lt = Math.max(0, t - s.start), env = envArr[Math.min(envArr.length - 1, Math.floor(t * FPS))] || 0;
  ctx.setTransform(SC, 0, 0, SC, 0, 0); ctx.clearRect(0, 0, W, H);
  if (i > 0 && lt < TR && s.tr !== "none") {
    const prev = sc[i - 1], p = ease.out(lt / TR);
    drawContent(prev, prev.dur, P, env);
    ctx.save(); ctx.beginPath();
    if (s.tr === "circle") ctx.arc(W / 2, H / 2, p * 1300, 0, 7); else if (s.tr === "wipe") ctx.rect(0, 0, W * p, H); else if (s.tr === "up") ctx.rect(0, H * (1 - p), W, H * p); else ctx.rect(0, 0, W, H);
    ctx.clip(); if (s.tr === "zoom") { ctx.globalAlpha = p; ctx.translate(W / 2, H / 2); const z = 1.15 - 0.15 * p; ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); }
    drawContent(s, lt, P, env); ctx.restore();
  } else drawContent(s, lt, P, env);
  drawChrome(t, TL.total);
}

/* ---------------- rendering: frame-perfect (WebCodecs) with live-recording fallback ---------------- */
// Every frame is drawn at its exact time and encoded, so the video never freezes or skips –
// even if the phone screen dims or the user switches tabs – and it is usually faster than real time.
async function wcRecord(TL, P, envArr, audioBuf) {
  if (!window.VideoEncoder || !window.AudioEncoder || !window.Mp4Muxer || !window.VideoFrame) return null;
  const w = cv.width, h = cv.height, fps = FPS, test = !!window.__WC_TEST;
  const vopts = [["avc1.640028", "avc"], ["avc1.4d0028", "avc"], ["avc1.42003e", "avc"]].concat(test ? [["vp09.00.10.08", "vp9"]] : []);
  const aopts = [["mp4a.40.2", "aac"]].concat(test ? [["opus", "opus"]] : []);
  let vc = null, ac = null;
  for (const [codec, mux] of vopts) { const c = { codec, width: w, height: h, bitrate: 8_000_000, framerate: fps }; if (mux === "avc") c.avc = { format: "avc" }; try { if ((await VideoEncoder.isConfigSupported(c)).supported) { vc = { c, mux }; break; } } catch {} }
  const SR = audioBuf.sampleRate;
  for (const [codec, mux] of aopts) { const c = { codec, sampleRate: mux === "opus" ? 48000 : SR, numberOfChannels: 2, bitrate: 160000 }; try { if ((await AudioEncoder.isConfigSupported(c)).supported) { ac = { c, mux }; break; } } catch {} }
  if (!vc || !ac) return null;
  if (ac.c.sampleRate !== SR) { // resample (only needed for opus in tests)
    const oc = new OfflineAudioContext(2, Math.ceil(audioBuf.duration * ac.c.sampleRate), ac.c.sampleRate); const s0 = oc.createBufferSource(); s0.buffer = audioBuf; s0.connect(oc.destination); s0.start(); audioBuf = await oc.startRendering();
  }
  const sr = audioBuf.sampleRate;
  const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: vc.mux, width: w, height: h, frameRate: fps }, audio: { codec: ac.mux, numberOfChannels: 2, sampleRate: sr }, fastStart: "in-memory", firstTimestampBehavior: "offset" });
  let err = null;
  const ve = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => (err = e) }); ve.configure(vc.c);
  const ae = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => (err = e) }); ae.configure(ac.c);
  const L = audioBuf.getChannelData(0), R = audioBuf.numberOfChannels > 1 ? audioBuf.getChannelData(1) : L, total = Math.min(L.length, Math.ceil(TL.total * sr));
  for (let i = 0; i < total; i += 4096) { const n = Math.min(4096, total - i), d = new Float32Array(n * 2); d.set(L.subarray(i, i + n), 0); d.set(R.subarray(i, i + n), n); ae.encode(new AudioData({ format: "f32-planar", sampleRate: sr, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / sr * 1e6), data: d })); }
  const N = Math.ceil(TL.total * fps);
  for (let f = 0; f < N; f++) {
    if (err) throw err;
    const t = f / fps; drawFrame(Math.min(t, TL.total - 0.001), TL, P, envArr);
    const vf = new VideoFrame(cv, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / fps) });
    ve.encode(vf, { keyFrame: f % (fps * 2) === 0 }); vf.close();
    if (ve.encodeQueueSize > 6) await new Promise((r) => { const chk = () => (ve.encodeQueueSize > 2 ? setTimeout(chk, 2) : r()); chk(); });
    if (f % 10 === 0) { setBar(0.3 + 0.7 * f / N); await new Promise((r) => setTimeout(r, 0)); }
  }
  await ve.flush(); await ae.flush(); if (err) throw err; muxer.finalize();
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}

/* ---------------- recording ---------------- */
function pickMime() { for (const m of ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]) if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; return ""; }
async function record(TL, P, envArr, audioBuf) {
  const ac = actx(); if (ac.state === "suspended") await ac.resume();
  const dest = ac.createMediaStreamDestination(); const src = ac.createBufferSource(); src.buffer = audioBuf; src.connect(dest);
  const stream = cv.captureStream(FPS); dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  const mime = pickMime(), rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 7_000_000, audioBitsPerSecond: 160000 }); const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  let wl = null; try { wl = await navigator.wakeLock.request("screen"); } catch {}
  drawFrame(0, TL, P, envArr); rec.start(500); const t0 = performance.now() + 150; src.start(ac.currentTime + 0.15);
  await new Promise((res) => { const loop = () => { const t = Math.max(0, (performance.now() - t0) / 1000); drawFrame(Math.min(t, TL.total - 0.001), TL, P, envArr); setBar(0.3 + 0.7 * Math.min(1, t / TL.total)); if (t >= TL.total + 0.25) res(); else requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
  rec.stop(); await done; try { src.stop(); } catch {} try { wl && wl.release(); } catch {}
  return new Blob(chunks, { type: (mime || "video/webm").split(";")[0] });
}

/* ---------------- main flow ---------------- */
let outBlob = null, outName = "YourChanakya_Reel", lastRun = null, rating = "";
async function run() {
  $("go").disabled = true; $("out").hidden = true; showSteps(); setBar(0.02); rating = ""; $("up").className = $("down").className = ""; $("fbMsg").textContent = ""; $("fbNote").value = "";
  const hint = $("hint").value.trim();
  try {
    step(0, "on"); step(1, "on");
    let P, id = "", src = "on-device editor";
    if (server.ai) {
      try { const j = await aiPlan(hint); P = j.plan; id = j.id; src = "AI editor · " + j.provider; }
      catch (e) { $("msg").textContent = "AI editor problem (" + String(e.message).slice(0, 160) + ") – switching to the on-device editor."; }
    }
    if (!P) P = await localPlan(hint);
    step(0, "done", src); step(1, "done", P.scenes.length + " scenes"); notes(P.editor_notes); setBar(0.12);
    step(2, "on");
    if (server.ai && id && $("qc").checked) {
      try { const before = JSON.stringify(P.scenes); const R = await aiReview(P); P = R; const qn = (P.editor_notes || []).filter((n) => /^QC/i.test(n)); notes(qn.length ? qn : ["QC: values verified against the image"]); step(2, "done", JSON.stringify(P.scenes) === before ? "all values verified" : "corrections applied"); }
      catch (e) { step(2, "err", "AI check unavailable – layout check only"); }
    }
    const fixes = critic(P); notes(fixes);
    if ($("steps").children[2].className === "on") step(2, "done", fixes.length ? fixes.length + " layout fixes" : "layout OK");
    setBar(0.18);
    // voice, scene by scene (so every line lands exactly on its scene)
    step(3, "on");
    const lang = P.language === "hi" ? "hi" : "en";
    const lines = [P.hook_say, ...P.scenes.map((s) => s.say)];
    const voices = await Promise.all(lines.map((t) => fetchVoice(t, lang)));
    const nv = voices.filter(Boolean).length;
    const [cta, hook] = await Promise.all([loadStored("cta_" + lang), /neet/i.test(P.series + " " + P.headline.title) ? loadStored("hook_" + lang) : Promise.resolve(null)]);
    step(3, nv ? "done" : "skip", nv ? `${nv} voice lines` : "no AI voice – music + end voice" + (voiceErr ? " (" + String(voiceErr).slice(0, 90) + ")" : "")); voiceErr = ""; setBar(0.24);
    await document.fonts.ready; await Promise.all(["900 40px Inter", "800 40px Inter", "700 40px Inter", "900 40px NotoDev", "700 40px NotoDev"].map((f) => document.fonts.load(f, "अआ Aa").catch(() => {})));
    IMG.logo = IMG.logo || await loadImg((window.EMBED && EMBED["assets/logo.png"]) || "assets/logo.png"); IMG.avatar = IMG.avatar || await loadImg((window.EMBED && EMBED["assets/avatar.jpg"]) || "assets/avatar.jpg");
    bgC = mkBg(); chromeC = mkChrome(P);
    const TL = buildTimeline(P, voices, hook, cta);
    const envArr = new Float32Array(Math.ceil(TL.total * FPS) + 5); TL.place.forEach((p) => envelope(p.buf, p.t, envArr));
    const audioBuf = await mixAudio(TL.total, TL.place, envArr, TL.sfx); setBar(0.3);
    step(4, "on");
    let blob = null, how = "frame-perfect";
    try { blob = await wcRecord(TL, P, envArr, audioBuf); } catch (e) { console.warn("frame-perfect render failed, using live recording", e); blob = null; }
    if (!blob) { how = "live recording – keep this screen open"; $("msg").textContent = "Recording live – keep this screen open and don't switch apps."; blob = await record(TL, P, envArr, audioBuf); $("msg").textContent = ""; }
    step(4, "done", Math.round(TL.total) + " s · " + how);
    outBlob = blob; const ext = blob.type.includes("mp4") ? "mp4" : "webm"; outName = "YourChanakya_" + (P.headline.title || "Reel").replace(/[^\wऀ-ॿ]+/g, "_").slice(0, 40) + "." + ext;
    $("vid").src = URL.createObjectURL(blob); $("out").hidden = false; step(5, "done"); setBar(1);
    $("cap").value = (P.caption || P.headline.title) + `\n\nFollow Your Chanakya for every notification & update.\n📞 ${BRAND.phone} | ${BRAND.site}\n\n${P.hashtags || "#YourChanakya #NEET"}`;
    $("det").textContent = JSON.stringify(P, null, 1);
    lastRun = { id, summary: `${P.content_type}: ${P.headline.title} | scenes: ${P.scenes.map((s) => s.type + (s.label ? "(" + s.label + ")" : "")).join(", ")} | ${src}` };
    $("out").scrollIntoView({ behavior: "smooth" });
  } catch (e) { console.error(e); $("msg").textContent = (e.message || String(e)); }
  $("go").disabled = false;
}
$("go").onclick = run;
$("up").onclick = () => { rating = "up"; $("up").className = "sel"; $("down").className = ""; };
$("down").onclick = () => { rating = "down"; $("down").className = "sel"; $("up").className = ""; };
$("fbSend").onclick = async () => {
  if (!rating) { $("fbMsg").textContent = "Tap 👍 or 👎 first."; return; }
  const fb = { id: lastRun?.id || "", rating, note: $("fbNote").value.trim(), summary: lastRun?.summary || "" };
  $("fbMsg").textContent = "Sending…";
  try {
    const r = await fetch(API() + "/api/feedback", { method: "POST", headers: HDR(), body: JSON.stringify(fb) }); const j = await r.json(); if (!r.ok) throw 0;
    $("fbMsg").textContent = j.rule ? "✔ Learned a new rule: “" + j.rule + "” – it will be used in every next video." : "✔ Thanks – saved."; loadRules(); checkServer();
  } catch {
    const l = JSON.parse(store.get("fb_local") || "[]"); l.push({ ...fb, ts: new Date().toISOString() }); store.set("fb_local", JSON.stringify(l.slice(-50)));
    $("fbMsg").textContent = "Saved on this device (learning works in the online version). Use Settings → Download review log to send it for review.";
  }
};
$("dl").onclick = () => { if (!outBlob) return; const a = document.createElement("a"); a.href = URL.createObjectURL(outBlob); a.download = outName; a.click(); };
$("sh").onclick = async () => { try { const f = new File([outBlob], outName, { type: outBlob.type }); if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], text: $("cap").value }); else $("dl").click(); } catch {} };
$("cp").onclick = () => { $("cap").select(); try { navigator.clipboard.writeText($("cap").value); } catch { document.execCommand("copy"); } $("cp").textContent = "Copied ✔"; setTimeout(() => ($("cp").textContent = "Copy caption"), 1500); };
checkServer();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
window.__CHANAKYA = { critic, planFromTable, tableFromLines, buildTimeline };
})();
