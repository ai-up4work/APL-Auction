import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase" // server-side client

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"

interface DeliveryContext {
  over: number
  ball: number
  runs: number
  extraType: string | null
  isWicket: boolean
  striker: string | null
  nonStriker: string | null
  bowler: string | null
  dismissalType?: string | null
  batsmanOut?: string | null
  fielder?: string | null
}

interface GenerateBody {
  matchId: string
  inningsNumber: 1 | 2
  teamBatting: string
  teamBowling: string
  target?: number
  scoreState: { total: number; wkts: number; oversLabel: string; crr: string; rrr: string | null }
  striker?: { name: string; runs: number; balls: number }
  nonStriker?: { name: string; runs: number; balls: number }
  bowlerFigures?: { name: string; overs: string; runs: number; wkts: number }
  /** Oldest → newest, up to 5 lines already shown — for continuity. */
  recentCommentary: string[]
  /** One batch's worth of deliveries needing commentary (capped client-side, but re-capped here too). */
  deliveries: DeliveryContext[]
}

// ── Token-safety knobs ───────────────────────────────────────────
// Hard ceiling on how many deliveries we'll ever generate for in one
// call, independent of what the client sends. Keeps a single worst-case
// request bounded even if a future client change forgets to cap batches.
const MAX_DELIVERIES_PER_REQUEST = 8
// Rough token budget per commentary line: ~20 words (the prompt's own
// limit) is ~30 tokens of prose, plus JSON punctuation/field overhead.
// 70 gives real headroom without leaving the door open to a 900-token
// blowout on a small batch.
const TOKENS_PER_LINE = 70
// Fixed overhead for the JSON wrapper ({"commentary":[...]}) plus a
// small safety margin.
const BASE_OVERHEAD_TOKENS = 60
// Absolute cap regardless of batch size, as a last-resort backstop.
const MAX_TOKENS_CEILING = 700
// Server-side enforcement of the "under 20 words" instruction — trims
// any line the model doesn't keep short, so a rambling response can't
// bloat what gets cached and later re-sent as recentCommentary context.
const MAX_WORDS_PER_LINE = 22

const SYSTEM_PROMPT = `You are a live cricket commentator. You will receive JSON describing deliveries needing commentary in a T20 match: match/score context, the two batters and bowler currently involved, the last few commentary lines already said (for continuity — don't repeat their phrasing or exact wording), and a list of deliveries needing commentary.

Write one punchy sentence per delivery, under 20 words, varied in structure, reacting to the actual score situation (a dot ball in a tense chase reads differently than one with the game already won). Never repeat a sentence structure from recentCommentary. Use player names naturally instead of "the batter". Reference milestones or partnership/bowling figures only when they're genuinely notable given the state provided.

Respond ONLY with JSON, no markdown fences, in exactly this shape:
{"commentary":[{"over":<number>,"ball":<number>,"text":"<string>"}, ...]}
One entry per delivery given, in the same over/ball values as the input, same order. Do not add entries for deliveries not given to you.`

function truncateToWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text.trim()
  return words.slice(0, maxWords).join(" ") + "…"
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 })
  }

  let body: GenerateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.matchId || !body.deliveries?.length) {
    return NextResponse.json({ error: "matchId and deliveries are required" }, { status: 400 })
  }

  // Re-cap here even though the client already batches — this route
  // shouldn't trust the caller to always enforce it, since that's the
  // one thing standing between a request and a runaway prompt size.
  const deliveries = body.deliveries.slice(0, MAX_DELIVERIES_PER_REQUEST)

  // Scale max_tokens to the actual batch size instead of a flat 900 —
  // a 2-ball batch doesn't need budget for 6 lines, and this also means
  // a genuinely full batch still has enough room to finish its JSON
  // instead of getting cut off mid-object (which would fail parsing
  // below and lose the whole batch).
  const maxTokens = Math.min(MAX_TOKENS_CEILING, BASE_OVERHEAD_TOKENS + deliveries.length * TOKENS_PER_LINE)

  const userPayload = {
    match: {
      teamBatting: body.teamBatting,
      teamBowling: body.teamBowling,
      innings: body.inningsNumber,
      target: body.target ?? null,
    },
    state: body.scoreState,
    striker: body.striker ?? null,
    nonStriker: body.nonStriker ?? null,
    bowler: body.bowlerFigures ?? null,
    // Context window is already small (hook caps at 5 lines) — kept
    // as-is here, just re-sliced defensively in case a caller changes.
    recentCommentary: body.recentCommentary.slice(-5),
    deliveries,
  }

  let groqRes: Response
  try {
    groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.9,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      }),
    })
  } catch (err) {
    return NextResponse.json({ error: "Groq request failed", detail: String(err) }, { status: 502 })
  }

  if (!groqRes.ok) {
    const detail = await groqRes.text()
    return NextResponse.json({ error: "Groq returned an error", detail }, { status: 502 })
  }

  const data = await groqRes.json()
  const content = data?.choices?.[0]?.message?.content
  const finishReason = data?.choices?.[0]?.finish_reason
  if (!content) {
    return NextResponse.json({ error: "No content in Groq response" }, { status: 502 })
  }
  if (finishReason === "length") {
    // The response got cut off by max_tokens before finishing its JSON.
    // Parsing would fail anyway, so bail early with a clear signal
    // instead of a confusing parse error — the hook will retry this
    // batch on a later tick.
    return NextResponse.json(
      { error: "Groq response truncated by max_tokens", detail: `batch size ${deliveries.length}` },
      { status: 502 },
    )
  }

  let parsed: { commentary: { over: number; ball: number; text: string }[] }
  try {
    parsed = JSON.parse(content)
    if (!Array.isArray(parsed.commentary)) throw new Error("commentary is not an array")
  } catch {
    return NextResponse.json({ error: "Failed to parse Groq JSON", raw: content }, { status: 502 })
  }

  // Validate against what was actually requested: drop any entry that
  // doesn't correspond to a delivery we sent (hallucinated over/ball,
  // or a duplicate), and trim any line that ignored the word limit.
  // This keeps both the cache and what later gets fed back in as
  // recentCommentary trustworthy and bounded.
  const requestedKeys = new Set(deliveries.map((d) => `${d.over}.${d.ball}`))
  const seen = new Set<string>()
  const validated = parsed.commentary
    .filter((c) => {
      const k = `${c.over}.${c.ball}`
      if (!requestedKeys.has(k) || seen.has(k) || !c.text?.trim()) return false
      seen.add(k)
      return true
    })
    .map((c) => ({ ...c, text: truncateToWords(c.text, MAX_WORDS_PER_LINE) }))

  if (validated.length === 0) {
    return NextResponse.json({ error: "No valid commentary entries after validation", raw: content }, { status: 502 })
  }

  const rows = validated.map((c) => ({
    match_id: body.matchId,
    innings_number: body.inningsNumber,
    over: c.over,
    ball: c.ball,
    text: c.text,
  }))

  const { error: upsertErr } = await supabase
    .from("ball_commentary")
    .upsert(rows, { onConflict: "match_id,innings_number,over,ball" })

  if (upsertErr) {
    console.error("[commentary/generate] upsert failed:", upsertErr.message)
    // still return the generated text even if the cache write failed
  }

  return NextResponse.json({ commentary: validated })
}