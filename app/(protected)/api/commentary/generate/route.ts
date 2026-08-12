// app/api/commentary/generate/route.ts
import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase" // server-side client — service role, bypasses RLS

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
  recentCommentary: string[]
  /**
   * CANDIDATES, not a claimed set. The client sends every ball it
   * thinks might need commentary; this route does the atomic claim
   * itself (server-side, service-role) and only generates for whichever
   * subset it actually wins. This is what keeps the write path off the
   * client entirely — no RLS policy needs to allow browser writes to
   * ball_commentary at all.
   */
  deliveries: DeliveryContext[]
}

const MAX_DELIVERIES_PER_REQUEST = 8
const TOKENS_PER_LINE = 70
const BASE_OVERHEAD_TOKENS = 60
const MAX_TOKENS_CEILING = 700
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

async function markFailed(matchId: string, inningsNumber: number, deliveries: { over: number; ball: number }[]) {
  if (deliveries.length === 0) return
  const rows = deliveries.map((d) => ({
    match_id: matchId,
    innings_number: inningsNumber,
    over: d.over,
    ball: d.ball,
    status: "failed" as const,
    text: null,
  }))
  const { error } = await supabase
    .from("ball_commentary")
    .upsert(rows, { onConflict: "match_id,innings_number,over,ball" })
  if (error) {
    console.error("[commentary/generate] failed to persist failed-status rows:", error.message)
  }
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

  const candidates = body.deliveries.slice(0, MAX_DELIVERIES_PER_REQUEST)

  // ── ATOMIC CLAIM ──────────────────────────────────────────────
  // INSERT ... ON CONFLICT DO NOTHING RETURNING *, under the
  // service-role client (bypasses RLS — this is the only path that
  // ever writes to ball_commentary). If another device/request already
  // has a row (pending, ready, or failed) for a ball, that row is
  // skipped and NOT returned — so `claimedKeys` is exactly the subset
  // this request, and only this request, is now responsible for.
  const placeholderRows = candidates.map((d) => ({
    match_id: body.matchId,
    innings_number: body.inningsNumber,
    over: d.over,
    ball: d.ball,
    status: "pending" as const,
    text: null,
  }))

  const { data: claimedRows, error: claimErr } = await supabase
    .from("ball_commentary")
    .upsert(placeholderRows, { onConflict: "match_id,innings_number,over,ball", ignoreDuplicates: true })
    .select("over, ball")

  if (claimErr) {
    console.error("[commentary/generate] claim failed:", claimErr.message)
    return NextResponse.json({ error: "Claim failed", detail: claimErr.message }, { status: 500 })
  }

  const claimedKeySet = new Set((claimedRows ?? []).map((r) => `${r.over}.${r.ball}`))
  const deliveries = candidates.filter((d) => claimedKeySet.has(`${d.over}.${d.ball}`))

  if (deliveries.length === 0) {
    // Every candidate was already claimed by another concurrent request
    // (race between two devices hitting this route at nearly the same
    // moment). Nothing to generate — the other request owns these balls
    // and Realtime will deliver the outcome to everyone.
    return NextResponse.json({ commentary: [], claimed: 0 })
  }

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
    recentCommentary: body.recentCommentary.slice(-5),
    deliveries,
  }

  let groqRes: Response
  try {
    groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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
    // We already claimed these balls — if we don't resolve them, they
    // stay 'pending' forever and no device (including this one) can
    // ever retry them again, since claims are exclusive by design.
    await markFailed(body.matchId, body.inningsNumber, deliveries)
    return NextResponse.json({ error: "Groq request failed", detail: String(err) }, { status: 502 })
  }

  if (!groqRes.ok) {
    const detail = await groqRes.text()
    console.error("[commentary/generate] Groq returned an error:", groqRes.status, detail)
    const isRateLimit = groqRes.status === 429
    await markFailed(body.matchId, body.inningsNumber, deliveries)
    return NextResponse.json(
      { error: "Groq returned an error", detail, code: isRateLimit ? "rate_limit_exceeded" : undefined },
      { status: 502 },
    )
  }

  const data = await groqRes.json()
  const content = data?.choices?.[0]?.message?.content
  const finishReason = data?.choices?.[0]?.finish_reason

  if (!content) {
    await markFailed(body.matchId, body.inningsNumber, deliveries)
    return NextResponse.json({ error: "No content in Groq response" }, { status: 502 })
  }
  if (finishReason === "length") {
    await markFailed(body.matchId, body.inningsNumber, deliveries)
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
    await markFailed(body.matchId, body.inningsNumber, deliveries)
    return NextResponse.json({ error: "Failed to parse Groq JSON", raw: content }, { status: 502 })
  }

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

  // Any claimed ball the model didn't return a valid line for still
  // needs resolving — otherwise it's stuck at 'pending' forever.
  const validatedKeys = new Set(validated.map((c) => `${c.over}.${c.ball}`))
  const missing = deliveries.filter((d) => !validatedKeys.has(`${d.over}.${d.ball}`))
  if (missing.length > 0) {
    await markFailed(body.matchId, body.inningsNumber, missing)
  }

  if (validated.length === 0) {
    return NextResponse.json({ error: "No valid commentary entries after validation", raw: content }, { status: 502 })
  }

  const rows = validated.map((c) => ({
    match_id: body.matchId,
    innings_number: body.inningsNumber,
    over: c.over,
    ball: c.ball,
    text: c.text,
    status: "ready" as const,
  }))

  const { error: upsertErr } = await supabase
    .from("ball_commentary")
    .upsert(rows, { onConflict: "match_id,innings_number,over,ball" })

  if (upsertErr) {
    console.error("[commentary/generate] upsert failed:", upsertErr.message, upsertErr)
    await markFailed(body.matchId, body.inningsNumber, deliveries)
    return NextResponse.json(
      { error: "Failed to persist commentary to database", detail: upsertErr.message },
      { status: 502 },
    )
  }

  return NextResponse.json({ commentary: validated })
}