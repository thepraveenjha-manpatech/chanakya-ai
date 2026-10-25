// Chanakya AI – learning from feedback.
// POST /api/feedback {id, rating:"up"|"down", note, summary}  -> saves feedback; a note is turned into a new rule
// POST /api/feedback {action:"delete_rule", index}            -> removes a learned rule
// POST /api/feedback {action:"add_rule", rule}                -> adds a rule written by the admin
// GET  /api/feedback?view=rules | runs                        -> learned rules / last 30 runs with feedback (for review)
import { J, ask, checkCode, store, getLessons, setLessons, scrub } from "../lib/ai.mjs";

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export default async (req) => {
  if (!checkCode(req)) return J({ error: "bad access code" }, 401);
  const s = store();
  if (req.method === "GET") {
    const view = new URL(req.url).searchParams.get("view") || "rules";
    if (view === "rules") return J({ rules: await getLessons() });
    if (!s) return J({ runs: [] });
    const { blobs } = await s.list({ prefix: "runs/" });
    const keys = blobs.map((b) => b.key).sort().slice(-30);
    const runs = [];
    for (const k of keys) {
      const r = await s.get(k, { type: "json" }).catch(() => null); if (!r) continue;
      const fb = await s.get("feedback/" + r.id, { type: "json" }).catch(() => null);
      runs.push({ id: r.id, ts: r.ts, provider: r.provider, title: r.plan?.headline?.title, type: r.plan?.content_type, scenes: (r.plan?.scenes || []).map((x) => x.type), feedback: fb });
    }
    return J({ runs: runs.reverse() });
  }
  if (req.method !== "POST") return J({ error: "GET or POST only" }, 405);
  let b; try { b = await req.json(); } catch { return J({ error: "bad json" }, 400); }
  const lessons = await getLessons();

  if (b.action === "delete_rule") {
    const i = parseInt(b.index, 10); if (i >= 0 && i < lessons.length) lessons.splice(i, 1);
    await setLessons(lessons); return J({ rules: lessons });
  }
  if (b.action === "add_rule") {
    const rule = clip(b.rule, 220); if (rule) lessons.push({ rule, ts: new Date().toISOString(), from: "admin" });
    await setLessons(lessons); return J({ rules: lessons });
  }

  const id = clip(b.id, 40) || "local-" + Date.now().toString(36);
  const fb = { id, rating: b.rating === "up" ? "up" : "down", note: clip(b.note, 600), summary: clip(b.summary, 600), ts: new Date().toISOString() };
  if (s) await s.setJSON("feedback/" + id, fb).catch(() => {});
  let rule = "";
  if (fb.note) {
    try {
      const r = await ask({
        json: false, maxTokens: 120,
        system: "You maintain the style guide of a video editor who makes NEET counselling news reels for 'Your Chanakya'. You turn client feedback into short, general, actionable rules.",
        prompt: `The client gave this feedback (${fb.rating === "up" ? "they liked the video" : "they did NOT like the video"}) on a reel.\nReel summary: ${fb.summary || "n/a"}\nFeedback: "${fb.note}"\n\nWrite ONE general rule (max 28 words, imperative, no quotes) that the editor must follow in all future reels so that ${fb.rating === "up" ? "this good thing is repeated" : "this never happens again"}. If the feedback is only about this specific video's facts, still generalise it. Return only the rule text.`,
      });
      rule = clip(r.text.replace(/^["'\-\d.\s]+|["']$/g, ""), 220);
    } catch (e) { rule = clip(fb.note, 220); }   // no AI available: keep the note itself as the rule
    if (rule) { lessons.push({ rule, ts: fb.ts, from: fb.rating }); await setLessons(lessons); }
  }
  return J({ ok: true, rule, rules: lessons.length });
};

export const config = { path: "/api/feedback" };
