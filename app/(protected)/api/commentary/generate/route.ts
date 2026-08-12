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
  /** One over's worth of deliveries needing commentary. */
  deliveries: DeliveryContext[]
}

const SYSTEM_PROMPT = `You are a live cricket commentator. You will receive JSON describing one over of a T20 match: match/score context, the two batters and bowler currently involved, the last few commentary lines already said (for continuity — don't repeat their phrasing or exact wording), and a list of deliveries needing commentary.

Write one punchy sentence per delivery, under 20 words, varied in structure, reacting to the actual score situation (a dot ball in a tense chase reads differently than one with the game already won). Never repeat a sentence structure from recentCommentary. Use player names naturally instead of "the batter". Reference milestones or partnership/bowling figures only when they're genuinely notable given the state provided.

Respond ONLY with JSON, no markdown fences, in exactly this shape:
{"commentary":[{"over":<number>,"ball":<number>,"text":"<string>"}, ...]}
One entry per delivery given, in the same over/ball values as the input, same order.`

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
    recentCommentary: body.recentCommentary,
    deliveries: body.deliveries,
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
        max_tokens: 900,
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
  if (!content) {
    return NextResponse.json({ error: "No content in Groq response" }, { status: 502 })
  }

  let parsed: { commentary: { over: number; ball: number; text: string }[] }
  try {
    parsed = JSON.parse(content)
    if (!Array.isArray(parsed.commentary)) throw new Error("commentary is not an array")
  } catch {
    return NextResponse.json({ error: "Failed to parse Groq JSON", raw: content }, { status: 502 })
  }

  const rows = parsed.commentary.map((c) => ({
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

  return NextResponse.json({ commentary: parsed.commentary })
}