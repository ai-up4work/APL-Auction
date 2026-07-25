// app/(protected)/match/[matchId]/simulate/page.tsx
"use client"

import { useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Gavel, Play, Pause, Square, RotateCcw, Radio, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TypeText } from "@/components/landing/type-text"
import { supabaseBrowser as supabase } from "@/lib/matches/supabase-browser"
import { parseMatchSetup, type MatchSetup } from "@/lib/matches/cricket-engine"
import {
  createInningsState,
  generatePlaceholderPool,
  simulateNextDelivery,
  type InningsSimState,
  type SimBallRow,
  type SimPlayerPool,
} from "@/lib/matches/simulator-engine"

type RunState = "idle" | "running" | "paused" | "done" | "error"

interface LogLine {
  id: number
  text: string
  emphasis?: boolean
}

function poolFromSetup(setup: MatchSetup, side: "team1" | "team2"): SimPlayerPool | null {
  if (!setup.squads || setup.squads.length === 0) return null
  const teamMeta = side === "team1" ? setup.team1 : setup.team2
  const squad = setup.squads.find((s) => {
    const tag = s.teamId?.toLowerCase?.() ?? ""
    return tag === side || tag === teamMeta.short.toLowerCase() || tag === teamMeta.name.toLowerCase()
  })
  if (!squad) return null
  const xi = squad.players.filter((p) => p.xi).map((p) => p.name)
  if (xi.length < 2) return null
  const bowlers = squad.players
    .filter((p) => p.xi && (p.role === "Bowler" || p.role === "All-rounder" || p.role === "WK-Batter" || true))
    .map((p) => p.name)
  return {
    teamName: teamMeta.name,
    teamShort: teamMeta.short,
    battingOrder: xi,
    bowlers: bowlers.length >= 3 ? bowlers.slice(0, 6) : xi.slice(0, 6),
  }
}

function withDefaultMatchInfo(setup: MatchSetup): MatchSetup {
  const now = new Date()
  const isoDate = now.toISOString().split("T")[0]
  const hhmm = now.toTimeString().slice(0, 5)

  return {
    ...setup,
    venue: setup.venue?.trim() ? setup.venue : "Simulated Grounds",
    date: setup.date?.trim() ? setup.date : isoDate,
    time: setup.time?.trim() ? setup.time : hhmm,
    toss: setup.toss?.trim() ? setup.toss : `${setup.team1.name} won the toss and elected to bat`,
  }
}

const statusMeta: Record<RunState, { label: string; color: string }> = {
  idle: { label: "IDLE", color: "#9CA3AF" },
  running: { label: "LIVE", color: "#F5A623" },
  paused: { label: "PAUSED", color: "#C0C0C0" },
  done: { label: "COMPLETE", color: "#4ADE80" },
  error: { label: "ERROR", color: "#F87171" },
}

export default function SimulateMatchPage() {
  const params = useParams<{ matchId: string }>()
  const matchIdFromRoute = params?.matchId ?? ""

  const [matchIdInput, setMatchIdInput] = useState(matchIdFromRoute)
  const [runState, setRunState] = useState<RunState>("idle")
  const [speedMs, setSpeedMs] = useState(1200)
  const [log, setLog] = useState<LogLine[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [scoreLine, setScoreLine] = useState<string>("")

  const runStateRef = useRef<RunState>("idle")
  const speedRef = useRef(speedMs)
  const logIdRef = useRef(0)

  // Replaces the old shared `stopRequestedRef` boolean. Every call to
  // handleStart() bumps this to a new unique value ("this run's token").
  // Any in-flight delivery loop from a PREVIOUS run captures its own
  // token at start time and compares against runTokenRef.current on
  // every iteration — the moment they differ, that loop knows a newer
  // run has since started (via Stop, or Reset & Simulate clicked again
  // before the old loop noticed it should stop) and exits immediately
  // instead of racing the new run's inserts. This is what was causing
  // "duplicate key value violates unique constraint
  // balls_match_id_innings_number_sequence_key" — two overlapping loops
  // both computing sequence numbers from 0 and both trying to insert.
  const runTokenRef = useRef(0)

  const setRun = (s: RunState) => {
    runStateRef.current = s
    setRunState(s)
  }

  const pushLog = (text: string, emphasis?: boolean) => {
    logIdRef.current += 1
    setLog((prev) => [...prev.slice(-300), { id: logIdRef.current, text, emphasis }])
  }

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

  const waitWhilePaused = async (token: number) => {
    while (runStateRef.current === "paused" && token === runTokenRef.current) {
      await sleep(150)
    }
  }

  async function insertBall(matchId: string, row: SimBallRow) {
    const { error } = await supabase.from("balls").insert({ match_id: matchId, ...row })
    if (error) throw new Error(`Failed writing ball: ${error.message}`)
  }

  async function runInnings(
    matchId: string,
    state: InningsSimState,
    label: string,
    token: number
  ): Promise<InningsSimState> {
    let current = state
    while (!current.finished) {
      if (token !== runTokenRef.current) return current // superseded — bail without touching the DB
      await waitWhilePaused(token)
      if (token !== runTokenRef.current) return current

      const { state: next, row, commentary } = simulateNextDelivery(current)
      current = next
      if (row) {
        // Re-check right before the write too — the await above can
        // cross a tick where a newer run started mid-delivery.
        if (token !== runTokenRef.current) return current
        await insertBall(matchId, row)
        const overLabel = `${row.over_number}.${row.ball_number}`
        pushLog(`[${label} ${overLabel}] ${commentary}`, row.is_wicket)
        setScoreLine(`${label}: ${current.runs}/${current.wkts} (${current.legalBalls / 6 | 0}.${current.legalBalls % 6} ov)`)
      }
      await sleep(speedRef.current)
    }
    return current
  }

  async function handleStart(reset: boolean) {
    setErrorMsg(null)
    setLog([])
    const myToken = ++runTokenRef.current // invalidates any previous in-flight run
    const matchId = matchIdInput.trim()
    if (!matchId) {
      setErrorMsg("Paste a match_id first.")
      return
    }

    setRun("running")

    try {
      const { data: matchRow, error: matchErr } = await supabase
        .from("matches")
        .select("id, match_setup")
        .eq("id", matchId)
        .maybeSingle()

      if (matchErr) throw new Error(matchErr.message)
      if (!matchRow) throw new Error("No match found with that id.")

      const parsedSetup = parseMatchSetup(matchRow.match_setup)
      if (!parsedSetup) {
        throw new Error(
          "This match's match_setup isn't in the { team1: {name, short}, team2: {name, short}, ... } shape the live page expects, so simulated data wouldn't render. Fix match_setup for this match first."
        )
      }

      const setup = withDefaultMatchInfo(parsedSetup)
      const infoWasFilled =
        setup.venue !== parsedSetup.venue ||
        setup.date !== parsedSetup.date ||
        setup.time !== parsedSetup.time ||
        setup.toss !== parsedSetup.toss

      const { data: bracketRow } = await supabase
        .from("bracket_matches")
        .select("id, status")
        .eq("overlay_match_id", matchId)
        .maybeSingle()

      if (reset) {
        pushLog("Clearing any existing balls/state for this match…")
        await supabase.from("balls").delete().eq("match_id", matchId)
        await supabase.from("match_state").delete().eq("match_id", matchId)
        await supabase.from("engine_state").delete().eq("match_id", matchId)
      }

      if (myToken !== runTokenRef.current) return // superseded during the delete/await above

      if (bracketRow) {
        await supabase.from("bracket_matches").update({ status: "live" }).eq("id", bracketRow.id)
      }

      if (infoWasFilled) {
        const { error: infoUpdateErr } = await supabase
          .from("matches")
          .update({ match_setup: setup })
          .eq("id", matchId)
        if (infoUpdateErr) throw new Error(`Failed setting match info: ${infoUpdateErr.message}`)
        pushLog(`Filled in missing match info — venue: "${setup.venue}", date: "${setup.date}", toss: "${setup.toss}".`)
      }

      const oversLimit = setup.overs ?? 20
      const teamAPool = poolFromSetup(setup, "team1") ?? generatePlaceholderPool(setup.team1.name, setup.team1.short)
      const teamBPool = poolFromSetup(setup, "team2") ?? generatePlaceholderPool(setup.team2.name, setup.team2.short)

      pushLog(`Starting simulation: ${teamAPool.teamName} vs ${teamBPool.teamName}, ${oversLimit} overs a side.`, true)

      let innings1 = createInningsState({
        inningsNumber: 1,
        battingTeam: teamAPool,
        bowlingTeam: teamBPool,
        oversLimit,
        startSequence: 0,
      })
      innings1 = await runInnings(matchId, innings1, teamAPool.teamShort, myToken)
      if (myToken !== runTokenRef.current) return // a newer run took over — abandon silently

      const target = innings1.runs + 1
      pushLog(`Innings 1 complete: ${teamAPool.teamName} ${innings1.runs}/${innings1.wkts}. Target: ${target}.`, true)

      const { error: setupUpdateErr } = await supabase
        .from("matches")
        .update({ match_setup: { ...setup, overs: oversLimit, target } })
        .eq("id", matchId)
      if (setupUpdateErr) throw new Error(`Failed updating target: ${setupUpdateErr.message}`)

      if (myToken !== runTokenRef.current) return

      let innings2 = createInningsState({
        inningsNumber: 2,
        battingTeam: teamBPool,
        bowlingTeam: teamAPool,
        oversLimit,
        target,
        startSequence: innings1.sequence,
      })
      innings2 = await runInnings(matchId, innings2, teamBPool.teamShort, myToken)
      if (myToken !== runTokenRef.current) return

      const resultText =
        innings2.runs >= target
          ? `${teamBPool.teamName} win by ${10 - innings2.wkts} wicket${10 - innings2.wkts === 1 ? "" : "s"}.`
          : innings2.runs === target - 1
            ? "Match tied."
            : `${teamAPool.teamName} win by ${target - 1 - innings2.runs} runs.`

      pushLog(`Innings 2 complete: ${teamBPool.teamName} ${innings2.runs}/${innings2.wkts}. ${resultText}`, true)

      if (bracketRow) {
        await supabase.from("bracket_matches").update({ status: "completed" }).eq("id", bracketRow.id)
      }

      setRun("done")
    } catch (err) {
      if (myToken !== runTokenRef.current) return // a stale run's error — ignore it, a newer run is active
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.")
      setRun("error")
    }
  }

  function handlePauseResume() {
    if (runStateRef.current === "running") setRun("paused")
    else if (runStateRef.current === "paused") setRun("running")
  }

  function handleStop() {
    runTokenRef.current++ // invalidates any in-flight loop immediately
    setRun("idle")
  }

  const status = statusMeta[runState]

  return (
    <main className="min-h-screen bg-black text-white relative section-pattern">
      <div className="absolute inset-0 z-0 section-gradient" />

      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* ── Header ── */}
          <div className="text-center mb-12 fade-in">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-md flex items-center justify-center shrink-0 bg-gold/10 border border-gold">
                <Gavel className="w-6 h-6 text-gold" />
              </div>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-6 section-title inline-block">
              <TypeText text="Match " speed={45} />
              <TypeText text="Simulator" speed={45} delay={220} className="text-gold" />
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto mt-4">
              Generates a full match, ball by ball, writing directly into <code className="text-gold">balls</code> and
              updating <code className="text-gold">matches</code> / <code className="text-gold">bracket_matches</code>{" "}
              as it goes. Open the live match page in another tab to watch it update in real time.
            </p>
          </div>

          {/* ── Control card ── */}
          <Card className="bg-black/70 border border-gold/20 box-hover-effect shine transition-all duration-300 mb-8 fade-in-up stagger-1">
            <CardContent className="p-6 md:p-10 space-y-8">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div
                  className="flex items-center gap-2 h-7 px-3 border rounded w-fit"
                  style={{ borderColor: status.color, backgroundColor: "rgba(0,0,0,0.4)" }}
                >
                  <Radio className="w-3 h-3" style={{ color: status.color }} />
                  <span className="text-[11px] font-mono tracking-[2px]" style={{ color: status.color }}>
                    {status.label}
                  </span>
                </div>
                {scoreLine && <span className="font-cinzel font-bold text-sm text-gold">{scoreLine}</span>}
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-gold/70 font-cinzel">
                  Match ID <span className="text-gray-500 normal-case">(from URL)</span>
                </label>
                <input
                  value={matchIdInput}
                  readOnly
                  placeholder="Navigate to /match/<id>/simulate"
                  className="mt-2 w-full bg-black/60 border border-gold/20 rounded-md px-3 py-2.5 text-sm font-mono text-gray-300 cursor-not-allowed focus:outline-none"
                />
                {!matchIdFromRoute && (
                  <p className="text-red-400 text-xs mt-2">
                    No match id found in the URL. Go to /match/&lt;id&gt;/simulate instead of this page directly.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-gold/70 font-cinzel flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-gold" />
                  Speed: <span className="text-gold">{speedMs}ms</span> per ball
                </label>
                <input
                  type="range"
                  min={200}
                  max={3000}
                  step={100}
                  value={speedMs}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setSpeedMs(v)
                    speedRef.current = v
                  }}
                  className="w-full mt-3 accent-[#f5a623]"
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-6 border-t border-gold/10">
                <Button
                  onClick={() => handleStart(true)}
                  disabled={runState === "running" || runState === "paused"}
                  className="pulse bg-gold hover:bg-gold/90 text-black font-bold font-cinzel uppercase tracking-wide text-xs px-6 py-6 disabled:opacity-40 disabled:animate-none"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset &amp; Simulate
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePauseResume}
                  disabled={runState !== "running" && runState !== "paused"}
                  className="border-gold text-gold hover:bg-gold/10 font-bold font-cinzel uppercase tracking-wide text-xs px-6 py-6 bg-transparent disabled:opacity-40"
                >
                  {runState === "paused" ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                  {runState === "paused" ? "Resume" : "Pause"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleStop}
                  disabled={runState !== "running" && runState !== "paused"}
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 font-bold font-cinzel uppercase tracking-wide text-xs px-6 py-6 bg-transparent disabled:opacity-40"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              </div>

              {errorMsg && (
                <p className="text-red-400 text-sm border border-red-500/30 bg-red-500/10 rounded-md px-4 py-3">
                  {errorMsg}
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Log card ── */}
          <Card className="bg-black/70 border border-gold/20 glow-effect fade-in-up stagger-2">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="font-cinzel text-xs text-gray-300 tracking-widest">DELIVERY LOG</span>
                <span className="font-mono text-[10px] text-gray-500 tracking-widest">{log.length} EVENTS</span>
              </div>
              <div className="h-96 overflow-y-auto font-mono text-xs space-y-1.5 pr-1">
                {log.length === 0 && (
                  <p className="text-gray-500">Log will appear here once the simulation starts.</p>
                )}
                {log.map((l) => (
                  <p key={l.id} className={l.emphasis ? "text-gold font-bold" : "text-gray-400"}>
                    {l.text}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}