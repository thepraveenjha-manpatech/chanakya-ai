// POST /api/voice {text, lang} -> audio (mp3 from ElevenLabs, or wav from Gemini TTS)
// ElevenLabs is used only if ELEVENLABS_API_KEY is set (voice Surjit, capped per call and per day).
// Otherwise OpenAI TTS or Gemini TTS (through the Netlify AI Gateway or your GEMINI_API_KEY). If neither works the app uses music only.
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { J, checkCode, providers, scrub } from "../lib/ai.mjs";

const env = (k) => (globalThis.Netlify?.env?.get(k) ?? process.env[k]) || "";
let spent = 0, day = "";

export default async (req) => {
  if (req.method !== "POST") return J({ error: "POST only" }, 405);
  if (!checkCode(req)) return J({ error: "bad access code" }, 401);
  let body; try { body = await req.json(); } catch { return J({ error: "bad json" }, 400); }
  const max = Math.min(parseInt(env("MAX_CHARS") || "900", 10), 2000);
  const text = String(body.text || "").replace(/\s+/g, " ").trim().slice(0, max);
  if (text.length < 5) return J({ error: "no text" }, 400);
  const today = new Date().toISOString().slice(0, 10);
  if (day !== today) { day = today; spent = 0; }
  const key = env("ELEVENLABS_API_KEY");
  if (key) {
    if (spent + text.length > parseInt(env("DAILY_CHAR_CAP") || "9000", 10)) return J({ error: "daily voice cap reached" }, 429);
    const voice = env("VOICE_ID") || "VjO7ISmjKXrpJvGaErIS";
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_96`, {
      method: "POST", headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: env("ELEVEN_MODEL") || "eleven_v4", voice_settings: { speed: 1.12, stability: 0.5, similarity_boost: 0.8 } }),
    });
    if (r.ok) { spent += text.length; return new Response(await r.arrayBuffer(), { headers: { "content-type": "audio/mpeg" } }); }
  }
  const P = providers(), why = [];
  if (P.openai) {   // OpenAI TTS through the AI Gateway (mp3)
    try {
      const client = new OpenAI();
      const r = await client.audio.speech.create({ model: env("OPENAI_TTS_MODEL") || "gpt-4o-mini-tts", voice: env("OPENAI_VOICE") || "onyx", input: text, response_format: "mp3", instructions: "Energetic, clear Indian TV news anchor. Brisk pace." });
      const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 2000) return new Response(buf, { headers: { "content-type": "audio/mpeg" } });
    } catch (e) { why.push("openai: " + scrub(e.message)); }
  }
  if (!P.gemini) return J({ error: "voice not available", detail: why.join(" | ") || "no voice provider" }, 501);
  try {
    const ai = new GoogleGenAI({});
    const r = await ai.models.generateContent({
      model: env("GEMINI_TTS_MODEL") || "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: "Read this as an energetic, clear Indian TV news anchor, at a brisk pace: " + text }] }],
      config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: env("GEMINI_VOICE") || "Charon" } } } },
    });
    const b64 = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
    if (!b64) return J({ error: "no audio" }, 502);
    const pcm = Buffer.from(b64, "base64"), h = Buffer.alloc(44), sr = 24000;
    h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
    return new Response(Buffer.concat([h, pcm]), { headers: { "content-type": "audio/wav" } });
  } catch (e) { why.push("gemini: " + scrub(e.message)); return J({ error: "voice failed", detail: why.join(" | ") }, 502); }
};

export const config = { path: "/api/voice" };
