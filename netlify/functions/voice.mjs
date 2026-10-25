// POST /api/voice {text, lang} -> audio
// Order: ElevenLabs (ELEVENLABS_API_KEY) -> Sarvam AI (SARVAM_API_KEY) -> Microsoft Azure (AZURE_SPEECH_KEY + AZURE_SPEECH_REGION)
//        -> OpenAI TTS / Gemini TTS through the Netlify AI Gateway. If none works the app uses music only.
import { GoogleGenAI } from "@google/genai";
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
  const hi = body.lang === "hi";
  // Sarvam AI (Indian voices, Hindi + Indian English) – SARVAM_API_KEY
  if (env("SARVAM_API_KEY")) {
    try {
      const r = await fetch("https://api.sarvam.ai/text-to-speech", {
        method: "POST", headers: { "api-subscription-key": env("SARVAM_API_KEY"), "content-type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 2400), language_code: hi ? "hi-IN" : "en-IN", model: env("SARVAM_MODEL") || "bulbul:v4-flash", speaker: env("SARVAM_SPEAKER") || "shubh_enhi_ads", pace: parseFloat(env("SARVAM_PACE") || "1.1"), output_audio_codec: "mp3", speech_sample_rate: 44100 }),
      });
      if (r.ok) { const j = await r.json(); const b64 = (j.audios || []).join(""); if (b64) return new Response(Buffer.from(b64, "base64"), { headers: { "content-type": "audio/mpeg" } }); why.push("sarvam: no audio"); }
      else why.push(`sarvam: ${r.status} ${scrub(await r.text()).slice(0, 140)}`);
    } catch (e) { why.push("sarvam: " + scrub(e.message)); }
  }
  // Microsoft Azure Speech (free tier: 0.5 million neural characters / month) – AZURE_SPEECH_KEY + AZURE_SPEECH_REGION
  if (env("AZURE_SPEECH_KEY")) {
    try {
      const region = env("AZURE_SPEECH_REGION") || "centralindia", lang = hi ? "hi-IN" : "en-IN";
      const name = hi ? (env("AZURE_VOICE_HI") || "hi-IN-MadhurNeural") : (env("AZURE_VOICE_EN") || "en-IN-PrabhatNeural");
      const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${name}"><prosody rate="${env("AZURE_RATE") || "+10%"}">${esc(text)}</prosody></voice></speak>`;
      const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST", headers: { "Ocp-Apim-Subscription-Key": env("AZURE_SPEECH_KEY"), "content-type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3", "user-agent": "chanakya-ai" }, body: ssml,
      });
      if (r.ok) { const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 1000) return new Response(buf, { headers: { "content-type": "audio/mpeg" } }); why.push("azure: empty audio"); }
      else why.push(`azure: ${r.status} ${scrub(await r.text()).slice(0, 140)}`);
    } catch (e) { why.push("azure: " + scrub(e.message)); }
  }
  if (P.openai) {   // OpenAI TTS through the AI Gateway (mp3)
    // The gateway rejects the SDK's default "Accept: application/octet-stream" for audio, so try other Accept values.
    const base = (env("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
    const body = JSON.stringify({ model: env("OPENAI_TTS_MODEL") || "gpt-4o-mini-tts", voice: env("OPENAI_VOICE") || "onyx", input: text, response_format: "mp3", instructions: "Energetic, clear Indian TV news anchor. Brisk pace." });
    for (const accept of ["*/*", "audio/mpeg", "application/json"]) {
      try {
        const r = await fetch(base + "/audio/speech", { method: "POST", headers: { authorization: "Bearer " + env("OPENAI_API_KEY"), "content-type": "application/json", accept }, body });
        if (r.ok) { const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 2000) return new Response(buf, { headers: { "content-type": "audio/mpeg" } }); why.push("openai: empty audio"); break; }
        const t = scrub(await r.text()); why.push(`openai(${accept}): ${r.status} ${t.slice(0, 120)}`); if (!/accept/i.test(t)) break;
      } catch (e) { why.push("openai: " + scrub(e.message)); break; }
    }
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
