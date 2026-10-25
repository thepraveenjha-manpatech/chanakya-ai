// Shared AI helpers for Chanakya AI.
// Provider order: Claude (Anthropic) -> Gemini -> OpenAI.
// On Netlify the AI Gateway injects ANTHROPIC_* / GEMINI_* / OPENAI_* credentials automatically
// (no keys needed). A key you set yourself in Netlify env vars takes priority over the gateway.
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { getStore } from "@netlify/blobs";

const env = (k) => (globalThis.Netlify?.env?.get(k) ?? process.env[k]) || "";

export const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
export const scrub = (s) => String(s || "").replace(/(sk-[\w-]{8,}|AQ\.[\w-]+|AIza[\w-]+|nf[a-z]_[\w-]+)/g, "[key]").slice(0, 400);

export function providers() {
  return {
    anthropic: !!(env("ANTHROPIC_API_KEY") || env("ANTHROPIC_BASE_URL")),
    gemini: !!(env("GEMINI_API_KEY") || env("GOOGLE_GEMINI_BASE_URL")),
    openai: !!(env("OPENAI_API_KEY") || env("OPENAI_BASE_URL")),
    gateway: !!env("NETLIFY_AI_GATEWAY_URL"),
  };
}

export function checkCode(req) {
  const code = env("ACCESS_CODE");
  return !code || req.headers.get("x-access-code") === code;
}

export function store() {
  try { return getStore("chanakya-ai"); } catch { return null; }
}

const CLAUDE_MODELS = () => [env("CLAUDE_MODEL"), "claude-sonnet-5-5", "claude-sonnet-4-5", "claude-sonnet-4-5-20250929", "claude-sonnet-4-20250514", "claude-3-7-sonnet-latest"].filter(Boolean);
const GEMINI_MODELS = () => [env("GEMINI_MODEL"), "gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"].filter(Boolean);
const OPENAI_MODELS = () => [env("OPENAI_MODEL"), "gpt-4.1-mini", "gpt-4o-mini"].filter(Boolean);
const notFound = (e) => /not[_ ]?found|does not exist|unknown model|invalid model|model.*(not|un)available|404/i.test(String(e?.message || e) + " " + (e?.status || ""));

// image: {mime, b64} or null. Returns {text, provider, model}
export async function ask({ system, prompt, image, maxTokens = 4000, json = true }) {
  const p = providers(), errors = [];
  if (p.anthropic) {
    const client = new Anthropic();
    for (const model of CLAUDE_MODELS()) {
      try {
        const content = [];
        if (image) content.push({ type: "image", source: { type: "base64", media_type: image.mime, data: image.b64 } });
        content.push({ type: "text", text: prompt });
        const r = await client.messages.create({ model, max_tokens: maxTokens, temperature: 0.2, system, messages: [{ role: "user", content }] });
        const text = (r.content || []).map((c) => c.text || "").join("");
        if (text) return { text, provider: "claude", model };
      } catch (e) { errors.push(`claude/${model}: ${scrub(e.message)}`); if (!notFound(e)) break; }
    }
  }
  if (p.gemini) {
    const ai = new GoogleGenAI({});
    for (const model of GEMINI_MODELS()) {
      try {
        const parts = [];
        if (image) parts.push({ inlineData: { mimeType: image.mime, data: image.b64 } });
        parts.push({ text: prompt });
        const r = await ai.models.generateContent({ model, contents: [{ role: "user", parts }], config: { systemInstruction: system, temperature: 0.2, maxOutputTokens: maxTokens, ...(json ? { responseMimeType: "application/json" } : {}) } });
        const text = r.text || "";
        if (text) return { text, provider: "gemini", model };
      } catch (e) { errors.push(`gemini/${model}: ${scrub(e.message)}`); if (!notFound(e)) break; }
    }
  }
  if (p.openai) {
    const client = new OpenAI();
    for (const model of OPENAI_MODELS()) {
      try {
        const content = [{ type: "text", text: prompt }];
        if (image) content.unshift({ type: "image_url", image_url: { url: `data:${image.mime};base64,${image.b64}` } });
        const r = await client.chat.completions.create({ model, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: "system", content: system }, { role: "user", content }], ...(json ? { response_format: { type: "json_object" } } : {}) });
        const text = r.choices?.[0]?.message?.content || "";
        if (text) return { text, provider: "openai", model };
      } catch (e) { errors.push(`openai/${model}: ${scrub(e.message)}`); if (!notFound(e)) break; }
    }
  }
  const err = new Error(errors.length ? errors.join(" | ") : "No AI provider available (AI Gateway not active and no key set)");
  err.code = errors.length ? "ai_failed" : "no_ai";
  throw err;
}

export function parseJSON(text) {
  const t = String(text || "").replace(/```(?:json)?/g, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("AI did not return JSON");
  return JSON.parse(t.slice(a, b + 1));
}

export async function getLessons() {
  const s = store(); if (!s) return [];
  try { return (await s.get("lessons", { type: "json" })) || []; } catch { return []; }
}
export async function setLessons(list) {
  const s = store(); if (!s) return;
  await s.setJSON("lessons", list.slice(-40));
}
