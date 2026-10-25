// Chanakya AI – Director.  The "video editor brain".
// GET  /api/director                    -> health: which AI is available, number of learned rules
// POST /api/director {mode:"plan", image}          -> edit plan (what the reel shows and says, scene by scene)
// POST /api/director {mode:"review", image, plan}  -> second pass: checks every value against the image, fixes the plan
import { J, ask, parseJSON, providers, checkCode, store, getLessons, scrub } from "../lib/ai.mjs";

const SCHEMA = `{
 "content_type": "fee_structure | counselling_schedule | seat_matrix | result_or_cutoff | notice | college_info | exam_info | poster | other",
 "language": "en | hi",
 "series": "short brand pill seen top-right, ONLY from evidence in the image, e.g. 'NEET PG', 'NEET UG 2026', 'MD/MS ADMISSION' (max 18 chars)",
 "is_official_notice": true/false,
 "intro":   {"kicker": "<=3 words, e.g. FEE STRUCTURE", "big": "<=4 words, the hook headline", "sub": "<=10 words, e.g. college short name + city"},
 "headline":{"title": "<=9 words", "subtitle": "<=22 words: full institute / authority / address as printed", "chips": ["<=3 short facts e.g. 'Udaipur, Rajasthan', 'Yearly tuition'"]},
 "scenes": [
   {"type":"stats",   "label":"<=4 words", "items":[{"label":"<=5 words","value":"verbatim number/date <=14 chars","sub":"<=7 words context"}], "say":"narration"},
   {"type":"table",   "label":"<=5 words", "columns":["<=14 chars", "..."], "rows":[["row name","cell","cell"]], "highlight_col": 1, "note":"<=12 words or ''", "say":"narration"},
   {"type":"bullets", "label":"<=4 words", "items":[{"label":"<=4 words","value":"verbatim detail <=110 chars"}], "say":"narration"},
   {"type":"callout", "label":"<=3 words e.g. NOTE / IMPORTANT", "text":"<=24 words", "say":"narration"}
 ],
 "hook_say": "first spoken line, <=12 words, grabs attention",
 "show_original": true/false,
 "caption": "Instagram caption, <=650 chars, emojis ok, include the key numbers verbatim",
 "hashtags": "6-9 hashtags",
 "editor_notes": ["2-5 short notes explaining your editorial choices"]
}`;

const RULES = `HOW TO EDIT
1. First understand the image: what is it, who issued it, what is the student/parent's question it answers.
2. FACTS ARE SACRED: copy every number, date, name and amount exactly as printed (keep Indian digit grouping like 32,55,000, keep spelling/typos of the source). Never invent, round or calculate a value that is not printed. You MAY count things you can see (e.g. "12 branches show N/A") — counts must be exact.
3. REMOVE NOISE: drop rows/columns that are entirely N/A, blank, "-" or "nil"; drop repeated headers, serial numbers, page furniture. Mention dropped information ONCE in a short callout (list names only when 6 or fewer).
4. CHOOSE THE RIGHT VISUAL for each idea:
   - "stats": 1-4 big numbers that matter most (highest/lowest fee, last date, total seats). Great for 1-4 meaningful rows.
   - "table": when comparison across columns matters. Max 6 rows and max 4 columns per table scene; split into more table scenes if needed (max 3). Short column headers. If every row shares a prefix like "MD(", put it in the label (e.g. label "MD TUITION FEES (YEARLY)") and keep the rest of the row name as printed.
   - "bullets": 2-5 key facts of a notice (dates, eligibility, documents, steps).
   - "callout": one important note, warning or deadline.
   Use 2-5 scenes in total. Do not repeat the same information in two scenes.
5. NARRATION ("say"): natural spoken news-anchor style for Indian NEET aspirants, in the language of the image (English or Hindi). 8-30 words per scene, total of all "say" + "hook_say" <= 120 words. Speak amounts naturally ("32 lakh 55 thousand rupees per year") but they must equal the printed values.
6. Never call something "official" unless the image is clearly an official notice from an authority (set is_official_notice accordingly).
7. show_original = true when the original image is readable enough to be worth showing for trust; false for low-quality crops.
8. Keep every on-screen text inside the length limits — the video is 1080x1920 and must be readable on a phone.
9. PRIVACY: never show or speak candidate names, registration/roll numbers, application numbers, phone numbers or other personal details of students. For allotment / merit lists show only ranks (AIR), scores, category, course and college; summarise (e.g. closing rank per college) instead of listing people.`;

const SYSTEM = (lessons) => `You are the senior video editor and content director at "Your Chanakya" — a NEET UG / NEET PG counselling and medical-admission guidance brand in India (presenter: "Chanakya Sir", phone 8447088008, Yourchanakya.com).
You turn an uploaded image (notice, fee structure, seat matrix, counselling schedule, cut-off/result list, college details, poster) into the EDIT PLAN of a 30-55 second vertical news-style reel. Think like a professional editor: decide what this image really says, what the 3-5 take-aways are, and the clearest, most engaging way to show each one.

${RULES}
${lessons.length ? "\nRULES LEARNED FROM THE CLIENT'S FEEDBACK (follow strictly, they override defaults):\n" + lessons.map((l, i) => `${i + 1}. ${l.rule}`).join("\n") : ""}

Return ONLY one JSON object in exactly this shape (no markdown):
${SCHEMA}`;

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
function normalize(p) {
  const out = {
    content_type: clip(p.content_type, 40) || "other",
    language: p.language === "hi" ? "hi" : "en",
    series: clip(p.series, 22),
    is_official_notice: !!p.is_official_notice,
    intro: { kicker: clip(p.intro?.kicker, 30), big: clip(p.intro?.big, 40), sub: clip(p.intro?.sub, 80) },
    headline: { title: clip(p.headline?.title, 90), subtitle: clip(p.headline?.subtitle, 200), chips: (p.headline?.chips || []).slice(0, 3).map((c) => clip(c, 30)).filter(Boolean) },
    hook_say: clip(p.hook_say, 120),
    show_original: p.show_original !== false,
    caption: clip(p.caption, 900), hashtags: clip(p.hashtags, 200),
    editor_notes: (p.editor_notes || []).slice(0, 8).map((n) => clip(n, 160)).filter(Boolean),
    scenes: [],
  };
  for (const s of (p.scenes || []).slice(0, 7)) {
    const say = clip(s.say, 260), label = clip(s.label, 40);
    if (s.type === "stats" && Array.isArray(s.items) && s.items.length)
      out.scenes.push({ type: "stats", label, say, items: s.items.slice(0, 4).map((i) => ({ label: clip(i.label, 40), value: clip(i.value, 22), sub: clip(i.sub, 60) })).filter((i) => i.value) });
    else if (s.type === "table" && Array.isArray(s.rows) && s.rows.length) {
      const columns = (s.columns || []).slice(0, 5).map((c) => clip(c, 22));
      const rows = s.rows.slice(0, 8).map((r) => (Array.isArray(r) ? r : [r]).slice(0, 5).map((c) => clip(typeof c === "object" ? c?.t : c, 40)));
      out.scenes.push({ type: "table", label, say, columns, rows, highlight_col: Number.isInteger(s.highlight_col) ? s.highlight_col : -1, note: clip(s.note, 80) });
    } else if (s.type === "bullets" && Array.isArray(s.items) && s.items.length)
      out.scenes.push({ type: "bullets", label, say, items: s.items.slice(0, 5).map((i) => ({ label: clip(i.label, 40), value: clip(i.value, 140) })).filter((i) => i.value) });
    else if (s.type === "callout" && s.text)
      out.scenes.push({ type: "callout", label: label || "NOTE", say, text: clip(s.text, 180) });
  }
  if (!out.scenes.length) throw new Error("plan had no usable scenes");
  return out;
}

function imageOf(body) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(body.image || "");
  if (!m) throw Object.assign(new Error("image must be a jpeg/png/webp data URL"), { status: 400 });
  if (m[2].length > 5_000_000) throw Object.assign(new Error("image too large"), { status: 413 });
  return { mime: m[1], b64: m[2] };
}

export default async (req, context) => {
  if (req.method === "GET") {
    const lessons = await getLessons();
    return J({ ok: true, ai: providers(), lessons: lessons.length, version: "director-3" });
  }
  if (req.method !== "POST") return J({ error: "GET or POST only" }, 405);
  if (!checkCode(req)) return J({ error: "bad access code" }, 401);
  let body; try { body = await req.json(); } catch { return J({ error: "bad json" }, 400); }
  let image; try { image = imageOf(body); } catch (e) { return J({ error: e.message }, e.status || 400); }
  const lessons = await getLessons();
  const system = SYSTEM(lessons);
  try {
    if (body.mode === "review") {
      const draft = JSON.stringify(body.plan || {}).slice(0, 20000);
      const prompt = `You are now the QUALITY CHECKER for this reel. Below is the draft edit plan made from this image.
Check it line by line against the image:
- every number, date, amount, name and column value must match the image exactly (fix any mismatch, swapped column, missing row or invented value);
- rows that are entirely N/A / blank must not be shown in tables (mention them in a callout instead);
- the editorial rules and the client's learned rules must be followed; every text must respect its length limit;
- the story must be clear for a NEET aspirant in 40 seconds.
Return the COMPLETE corrected plan JSON in the same shape. Add to "editor_notes" one note starting with "QC:" saying what you fixed (or "QC: all values verified").
DRAFT PLAN:
${draft}`;
      const r = await ask({ system, prompt, image, maxTokens: 4000 });
      return J({ plan: normalize(parseJSON(r.text)), provider: r.provider, model: r.model });
    }
    const prompt = `Make the edit plan for this image.${body.hint ? "\nThe user adds: " + clip(body.hint, 300) : ""}`;
    const r = await ask({ system, prompt, image, maxTokens: 4000 });
    const plan = normalize(parseJSON(r.text));
    const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
    const s = store();
    if (s) context?.waitUntil?.(s.setJSON(`runs/${id}`, { id, ts: new Date().toISOString(), provider: r.provider, model: r.model, plan, thumb: body.thumb || "" }).catch(() => {}));
    return J({ id, plan, provider: r.provider, model: r.model, lessons: lessons.length });
  } catch (e) {
    return J({ error: e.code === "no_ai" ? "no_ai" : "ai_failed", detail: scrub(e.message) }, e.code === "no_ai" ? 501 : 502);
  }
};

export const config = { path: "/api/director" };
