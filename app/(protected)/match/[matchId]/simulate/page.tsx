// app/(protected)/match/[matchId]/simulate/page.tsx
"use client"

import { useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Gavel, Play, Pause, Square, RotateCcw, Radio, Zap, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TypeText } from "@/components/landing/type-text"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"
import { pageStyles } from "@/data/site-data"
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

// Fills in any MISSING or BLANK match-info fields with sensible
// defaults — checked field-by-field (via .trim()) rather than checking
// whether the parent `officials` object exists at all. A match whose
// `officials` object is present but has e.g. an empty `format: ""`
// would previously pass the `setup.officials ? setup.officials : {...}`
// check (the object itself is truthy) and keep the blank field forever.
function withDefaultMatchInfo(setup: MatchSetup): MatchSetup {
  const now = new Date()
  const isoDate = now.toISOString().split("T")[0]
  const hhmm = now.toTimeString().slice(0, 5)

  const officials = setup.officials ?? ({} as MatchSetup["officials"])

  return {
    ...setup,
    officials: {
      referee: officials?.referee?.trim() ? officials.referee : "Merline",
      thirdUmpire: officials?.thirdUmpire?.trim() ? officials.thirdUmpire : "Askalaan",
      umpires: officials?.umpires?.trim() ? officials.umpires : "Sr George",
      format: officials?.format?.trim() ? officials.format : "T20 · 20 overs per side",
    },
    venue: setup.venue?.trim() ? setup.venue : "Simulated Grounds",
    date: setup.date?.trim() ? setup.date : isoDate,
    time: setup.time?.trim() ? setup.time : hhmm,
    toss: setup.toss?.trim() ? setup.toss : `${setup.team1.name} won the toss and elected to bat`,
  }
}

// Same "badge chip" language used in the Core Modules section on the
// homepage (h-7 px-3 border rounded, font-mono tracking-[2px] label) so
// the run status reads as part of the same design system.
const statusMeta: Record<RunState, { label: string; accent: string }> = {
  idle: { label: "IDLE", accent: "#9CA3AF" },
  running: { label: "LIVE", accent: "#F5A623" },
  paused: { label: "PAUSED", accent: "#C0C0C0" },
  done: { label: "COMPLETE", accent: "#4ADE80" },
  error: { label: "ERROR", accent: "#F87171" },
}

// Same card shell used throughout the site (testimonials, contact,
// match-detail tabs): black/50 base, gold/20 border, gold/40 on hover —
// so this page reads as part of the same product instead of a
// bolted-on admin tool.
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-black/50 border border-gold/20 shine hover:border-gold/40 transition-all duration-300 rounded-lg p-6 md:p-10 shadow-lg shadow-black/40 ${className}`}
    >
      {children}
    </div>
  )
}

export default function SimulateMatchPage() {
  useScrollTop()
  const router = useRouter()
  const params = useParams<{ matchId: string }>()
  const matchIdFromRoute = params?.matchId ?? ""

  const [isNavOpen, setIsNavOpen] = useState(false)
  const [matchIdInput, setMatchIdInput] = useState(matchIdFromRoute)
  const [runState, setRunState] = useState<RunState>("idle")
  const [speedMs, setSpeedMs] = useState(1200)
  const [log, setLog] = useState<LogLine[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [scoreLine, setScoreLine] = useState<string>("")

  const runStateRef = useRef<RunState>("idle")
  const speedRef = useRef(speedMs)
  const logIdRef = useRef(0)

  // Every call to handleStart() bumps this to a new unique value ("this
  // run's token"). Any in-flight delivery loop from a PREVIOUS run
  // captures its own token at start time and compares against
  // runTokenRef.current on every iteration — the moment they differ,
  // that loop knows a newer run (or a Clear) has since started and exits
  // immediately instead of racing new inserts / deletes.
  const runTokenRef = useRef(0)

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }
  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  const setRun = (s: RunState) => {
    runStateRef.current = s
    setRunState(s)
  }

  // Captures logIdRef.current into a local `id` BEFORE calling setLog,
  // rather than reading logIdRef.current from inside the updater
  // closure. At very low speedMs, multiple pushLog() calls can get
  // queued before React flushes state, and each queued updater would
  // otherwise close over the *same* ref and could read it after a
  // later call had already bumped it again — producing two log lines
  // with an identical id (and the "two children with the same key"
  // warning). Capturing the value up front removes that race.
  const pushLog = (text: string, emphasis?: boolean) => {
    logIdRef.current += 1
    const id = logIdRef.current
    setLog((prev) => [...prev.slice(-300), { id, text, emphasis }])
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
        setup.toss !== parsedSetup.toss ||
        setup.officials?.format !== parsedSetup.officials?.format ||
        setup.officials?.referee !== parsedSetup.officials?.referee ||
        setup.officials?.umpires !== parsedSetup.officials?.umpires ||
        setup.officials?.thirdUmpire !== parsedSetup.officials?.thirdUmpire

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

      // currentInnings is the explicit source of truth for which innings
      // is in progress — the UI reads this instead of guessing from ball
      // counts, so "Team B need X runs" never shows up while team A is
      // still batting.
      const { error: infoUpdateErr } = await supabase
        .from("matches")
        .update({ match_setup: { ...setup, currentInnings: 1 } })
        .eq("id", matchId)
      if (infoUpdateErr) throw new Error(`Failed setting match info: ${infoUpdateErr.message}`)
      if (infoWasFilled) {
        pushLog(
          `Filled in missing match info — venue: "${setup.venue}", date: "${setup.date}", toss: "${setup.toss}", format: "${setup.officials?.format}".`
        )
      }

      const oversLimit = setup.overs ?? 20
      const teamAPool = poolFromSetup(setup, "team1") ?? generatePlaceholderPool(setup.team1.name, setup.team1.short)
      const teamBPool = poolFromSetup(setup, "team2") ?? generatePlaceholderPool(setup.team2.name, setup.team2.short)

      pushLog(`Starting simulation: ${teamAPool.teamName} vs ${teamBPool.teamName}, ${oversLimit} overs a side.`, true)
      pushLog(`1st innings: ${teamAPool.teamName} batting.`, true)

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

      // Flip currentInnings to 2 in the SAME write that sets the target,
      // so the two facts ("2nd innings has started" and "this is the
      // target") always land together — no window where one has updated
      // and the other hasn't.
      const { error: setupUpdateErr } = await supabase
        .from("matches")
        .update({ match_setup: { ...setup, overs: oversLimit, target, currentInnings: 2 } })
        .eq("id", matchId)
      if (setupUpdateErr) throw new Error(`Failed updating target: ${setupUpdateErr.message}`)

      if (myToken !== runTokenRef.current) return

      pushLog(`2nd innings: ${teamBPool.teamName} chasing ${target}.`, true)

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

  // Wipes every trace of this match's simulated data — balls, live/engine
  // state, bracket score/status, and the runtime-only match_setup keys
  // (target, currentInnings) — while leaving team1/team2/venue/etc alone.
  // This is what makes the live match page fall back to "not_started"
  // and empty scorecards the instant it's clicked, via Realtime.
  async function handleClear() {
    const matchId = matchIdInput.trim()
    if (!matchId) {
      setErrorMsg("Paste a match_id first.")
      return
    }

    runTokenRef.current++ // kill any in-flight loop immediately
    setRun("idle")
    setErrorMsg(null)
    setLog([])
    setScoreLine("")

    try {
      await supabase.from("balls").delete().eq("match_id", matchId)
      await supabase.from("match_state").delete().eq("match_id", matchId)
      await supabase.from("engine_state").delete().eq("match_id", matchId)

      const { data: bracketRow } = await supabase
        .from("bracket_matches")
        .select("id")
        .eq("overlay_match_id", matchId)
        .maybeSingle()

      if (bracketRow) {
        await supabase
          .from("bracket_matches")
          .update({ status: "upcoming", score_a: null, score_b: null })
          .eq("id", bracketRow.id)
      }

      const { data: matchRow } = await supabase
        .from("matches")
        .select("match_setup")
        .eq("id", matchId)
        .maybeSingle()

      if (matchRow?.match_setup) {
        const { target, currentInnings, ...rest } = matchRow.match_setup as Record<string, unknown>
        await supabase.from("matches").update({ match_setup: rest }).eq("id", matchId)
      }

      pushLog("Cleared — all deliveries, live state, and match progress have been wiped.", true)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to clear match data.")
      setRun("error")
    }
  }

  const status = statusMeta[runState]

  return (
    <main className="overflow-x-hidden max-w-full">
      <style
        dangerouslySetInnerHTML={{
          __html: `${pageStyles}
          html, body {
            overflow-x: hidden;
            max-width: 100%;
          }`,
        }}
      />

      <SiteHeader
        activeSection="tournament"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      {/* ═══════════════════════════════════════════
          HEADER — same section-pattern + gold-gradient
          title treatment as every other section on site.
      ═══════════════════════════════════════════ */}
      <section className="relative pt-28 pb-12 section-pattern bg-black border-b border-gold/10">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 text-center fade-in">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-md mb-6 bg-gold/10 border border-gold shrink-0">
            <Gavel className="w-6 h-6 text-gold" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-6 font-cinzel tracking-wider section-title inline-block">
            <TypeText text="Match " speed={45} />
            <TypeText text="Simulator" speed={45} delay={220} className="text-gold" />
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mt-4">
            Generates a full match, ball by ball, writing directly into <code className="text-gold">balls</code> and
            updating <code className="text-gold">matches</code> / <code className="text-gold">bracket_matches</code>{" "}
            as it goes. Open the live match page in another tab to watch it update in real time.
          </p>
        </div>
      </section>

      <section className="py-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 max-w-3xl">
          {/* ── Control panel ── */}
          <Panel className="mb-8 space-y-8 fade-in-up stagger-1">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div
                className="flex items-center gap-2 h-7 px-3 border rounded w-fit"
                style={{ borderColor: status.accent, backgroundColor: "rgba(0,0,0,0.4)" }}
              >
                <Radio className="w-3 h-3" style={{ color: status.accent }} />
                <span className="text-[11px] font-mono tracking-[2px]" style={{ color: status.accent }}>
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
                className="bg-gold hover:bg-gold/90 text-black font-bold font-cinzel uppercase tracking-wide text-xs px-6 py-6 disabled:opacity-40"
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
              <Button
                variant="outline"
                onClick={handleClear}
                disabled={runState === "running" || runState === "paused"}
                className="border-red-500/40 text-red-400 hover:bg-red-500/10 font-bold font-cinzel uppercase tracking-wide text-xs px-6 py-6 bg-transparent disabled:opacity-40"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>

            {errorMsg && (
              <p className="text-red-400 text-sm border border-red-500/30 bg-red-500/10 rounded-md px-4 py-3">
                {errorMsg}
              </p>
            )}
          </Panel>

          {/* ── Log panel ── */}
          <Panel className="fade-in-up stagger-2">
            <div className="flex items-center justify-between mb-4">
              <span className="font-cinzel text-xs text-gold uppercase tracking-widest">Delivery Log</span>
              <span className="font-mono text-[10px] text-gray-500 tracking-widest">{log.length} EVENTS</span>
            </div>
            <div className="border border-gold/10 rounded-md bg-black/40 h-96 overflow-y-auto font-mono text-xs p-4 space-y-1.5">
              {log.length === 0 && (
                <p className="text-gray-500">Log will appear here once the simulation starts.</p>
              )}
              {log.map((l, index) => (
                // Keyed on `${l.id}-${index}` rather than l.id alone —
                // id comes from a ref counter that's bumped synchronously
                // in pushLog(), but under very fast simulation speeds
                // React can still end up rendering two entries with a
                // matching id if state updates get batched unexpectedly.
                // Pairing with array index guarantees uniqueness within
                // this render regardless of what id turns out to be.
                <p key={`${l.id}-${index}`} className={l.emphasis ? "text-gold font-bold" : "text-gray-400"}>
                  {l.text}
                </p>
              ))}
            </div>
          </Panel>

          <div className="text-center mt-10 fade-in-up stagger-3">
            {matchIdFromRoute ? (
              <Link href={`/match/${matchIdFromRoute}`}>
                <Button
                  variant="outline"
                  className="border-gold text-gold hover:bg-gold/10 bg-transparent font-bold"
                >
                  Back to Match
                </Button>
              </Link>
            ) : (
              <Link href="/">
                <Button className="bg-gold hover:bg-gold/90 py-2 text-black font-bold">Back Home</Button>
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}