# Chanakya AI – Director  (built by ManpaTech for Your Chanakya)

Upload a notice / fee structure / schedule / seat matrix image -> the AI editor studies it, plans the reel
scene by scene (table, big numbers, key note, points), checks every value against the image a second time,
writes the narration, and records a 1080x1920 branded reel with Chanakya Sir in the browser.

## How it thinks
1. **Director** (`/api/director`, mode `plan`) – Claude (or Gemini / OpenAI) through the Netlify AI Gateway: understands the image, removes noise (all-N/A rows), picks the visual for each idea, writes the script.
2. **Quality check** (mode `review`) – a second AI pass compares every number/date/name with the image and fixes the plan.
3. **Layout critic** (in the browser) – splits long tables into pages, hides empty rows, keeps text readable.
4. **Learning** (`/api/feedback`) – every 👍/👎 note becomes a short rule (stored in Netlify Blobs) that the director follows in every next video. Rules can be viewed / removed / added in Settings.
5. **On-device editor** – if no AI is available, OCR + editing rules still build a clean reel.

## Environment variables (all optional)
- none needed when Netlify AI Gateway is active (it injects the AI credentials)
- `ACCESS_CODE` – team password for the tool
- `ELEVENLABS_API_KEY` – use the ElevenLabs Surjit voice (capped by `MAX_CHARS` 900 per line and `DAILY_CHAR_CAP` 9000/day)
- `CLAUDE_MODEL` / `GEMINI_MODEL` / `OPENAI_MODEL` – override model names
- Do NOT set an old/invalid `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` – your own key overrides the gateway.

## Health check
Open `/api/director` – shows which AI is active and how many rules were learned.
Review log for Claude: Settings -> "Download review log".
