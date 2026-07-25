// app/(protected)/match/[matchId]/simulate/page.tsx
"use client"

import { useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Gavel, Play, Pause, Square, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  const stopRequestedRef = useRef(false)
  const logIdRef = useRef(0)

  const setRun = (s: RunState) => {
    runStateRef.current = s
    setRunState(s)
  }

  const pushLog = (text: string, emphasis?: boolean) => {
    logIdRef.current += 1
    setLog((prev) => [...prev.slice(-300), { id: logIdRef.current, text, emphasis }])
  }

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

  const waitWhilePaused = async () => {
    while (runStateRef.current === "paused" && !stopRequestedRef.current) {
      await sleep(150)
    }
  }

  async function insertBall(matchId: string, row: SimBallRow) {
    const { error } = await supabase.from("balls").insert({ match_id: matchId, ...row })
    if (error) throw new Error(`Failed writing ball: ${error.message}`)
  }

  async function runInnings(matchId: string, state: InningsSimState, label: string): Promise<InningsSimState> {
    let current = state
    while (!current.finished) {
      if (stopRequestedRef.current) return current
      await waitWhilePaused()
      if (stopRequestedRef.current) return current

      const { state: next, row, commentary } = simulateNextDelivery(current)
      current = next
      if (row) {
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
    stopRequestedRef.current = false
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

      const setup = parseMatchSetup(matchRow.match_setup)
      if (!setup) {
        throw new Error(
          "This match's match_setup isn't in the { team1: {name, short}, team2: {name, short}, ... } shape the live page expects, so simulated data wouldn't render. Fix match_setup for this match first."
        )
      }

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

      if (bracketRow) {
        await supabase.from("bracket_matches").update({ status: "live" }).eq("id", bracketRow.id)
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
      innings1 = await runInnings(matchId, innings1, teamAPool.teamShort)
      if (stopRequestedRef.current) {
        pushLog("Stopped.")
        setRun("idle")
        return
      }

      const target = innings1.runs + 1
      pushLog(`Innings 1 complete: ${teamAPool.teamName} ${innings1.runs}/${innings1.wkts}. Target: ${target}.`, true)

      const { error: setupUpdateErr } = await supabase
        .from("matches")
        .update({ match_setup: { ...setup, overs: oversLimit, target } })
        .eq("id", matchId)
      if (setupUpdateErr) throw new Error(`Failed updating target: ${setupUpdateErr.message}`)

      let innings2 = createInningsState({
        inningsNumber: 2,
        battingTeam: teamBPool,
        bowlingTeam: teamAPool,
        oversLimit,
        target,
        startSequence: innings1.sequence,
      })
      innings2 = await runInnings(matchId, innings2, teamBPool.teamShort)
      if (stopRequestedRef.current) {
        pushLog("Stopped.")
        setRun("idle")
        return
      }

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
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.")
      setRun("error")
    }
  }

  function handlePauseResume() {
    if (runStateRef.current === "running") setRun("paused")
    else if (runStateRef.current === "paused") setRun("running")
  }

  function handleStop() {
    stopRequestedRef.current = true
    setRun("idle")
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-16 relative section-pattern">
      <div className="absolute inset-0 z-0 section-gradient" />
      <div className="max-w-2xl mx-auto relative z-10">
        <div className="flex items-center gap-3 mb-2 fade-in">
          <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0 bg-gold/10 border border-gold">
            <Gavel className="w-5 h-5 text-gold" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-cinzel text-white">
            Match <span className="gold-gradient-text">Simulator</span>
          </h1>
        </div>
        <p className="text-gray-300 text-sm mb-8 fade-in">
          Paste a match_id and this will generate a full match, ball by ball, writing directly into{" "}
          <code className="text-gold">balls</code> and updating <code className="text-gold">matches</code> /{" "}
          <code className="text-gold">bracket_matches</code> as it goes. Open the live match page in another tab to
          watch it update in real time.
        </p>

        <Card className="bg-black/50 border border-gold/20 shine hover:border-gold/40 transition-all duration-300 mb-8 fade-in-up">
          <CardContent className="p-6 md:p-8 space-y-6">
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
              <label className="text-xs uppercase tracking-widest text-gold/70 font-cinzel">
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

            <div className="flex flex-wrap gap-3 pt-2 border-t border-gold/10">
              <Button
                onClick={() => handleStart(true)}
                disabled={runState === "running" || runState === "paused"}
                className="bg-gold hover:bg-gold/90 text-black font-bold font-cinzel uppercase tracking-wide text-xs px-5 py-5 disabled:opacity-40"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset &amp; Simulate
              </Button>
              <Button
                variant="outline"
                onClick={handlePauseResume}
                disabled={runState !== "running" && runState !== "paused"}
                className="border-gold text-gold hover:bg-gold/10 font-bold font-cinzel uppercase tracking-wide text-xs px-5 py-5 bg-transparent disabled:opacity-40"
              >
                {runState === "paused" ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                {runState === "paused" ? "Resume" : "Pause"}
              </Button>
              <Button
                variant="outline"
                onClick={handleStop}
                disabled={runState !== "running" && runState !== "paused"}
                className="border-red-500/40 text-red-400 hover:bg-red-500/10 font-bold font-cinzel uppercase tracking-wide text-xs px-5 py-5 bg-transparent disabled:opacity-40"
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
            {scoreLine && (
              <p className="text-gold font-cinzel font-bold text-sm border-t border-gold/10 pt-4">{scoreLine}</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-black/50 border border-gold/20 fade-in-up stagger-2">
          <CardContent className="p-4 md:p-6">
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
    </main>
  )
}