"use client"

import { useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Gavel, Play, Pause, Square, RotateCcw, Radio, Zap, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { AppHeader } from "@/components/app-header"
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

// ─────────────────────────────────────────────────────────────
// SQUAD RESOLUTION
//
// setup.squads can show up in two shapes by the time this page runs:
//
//  1. GROUPED — written by the match editor once someone's saved there:
//     [{ teamId: "team1"|"team2", captain, players: [{name, role, xi}] }]
//
//  2. FLAT — written directly by createFriendlyMatch (organization.ts)
//     when a match is created from an auction or Squad Board, and never
//     touched in the editor since:
//     [{ name, role, team: "<short code>", captain?: boolean }]
//
// Previously poolFromSetup only understood shape #1, so simulating a
// match straight after creation (before ever opening /edit) silently
// fell back to made-up placeholder names instead of the real roster
// that was right there in match_setup. resolveSquad() below normalizes
// either shape into the same { players, xi } view before poolFromSetup
// builds the actual batting/bowling pools from it.
// ─────────────────────────────────────────────────────────────

interface ResolvedSquadPlayer {
  name: string
  role: string
  xi: boolean
}

function isGroupedSquads(rawSquads: any[]): boolean {
  return rawSquads.some((s) => s && typeof s === "object" && "teamId" in s)
}

function resolveSquad(setup: MatchSetup, side: "team1" | "team2"): ResolvedSquadPlayer[] | null {
  const rawSquads: any[] = Array.isArray((setup as any).squads) ? (setup as any).squads : []
  if (rawSquads.length === 0) return null

  const teamMeta = side === "team1" ? setup.team1 : setup.team2

  if (isGroupedSquads(rawSquads)) {
    const squad = rawSquads.find((s) => {
      const tag = s.teamId?.toLowerCase?.() ?? ""
      return tag === side || tag === teamMeta.short?.toLowerCase() || tag === teamMeta.name?.toLowerCase()
    })
    if (!squad || !Array.isArray(squad.players)) return null
    return squad.players.map((p: any) => ({ name: p?.name ?? "", role: p?.role ?? "Batter", xi: !!p?.xi }))
  }

  // Flat shape — bucket by short code. Anything that doesn't clearly
  // match team2's code falls to team1, same rule the editor uses.
  const team1Short = (setup.team1?.short ?? "").toUpperCase()
  const team2Short = (setup.team2?.short ?? "").toUpperCase()
  const wantTeam2 = side === "team2"

  const matched = rawSquads.filter((p: any) => {
    const code = (p?.team ?? "").toString().toUpperCase()
    const isTeam2 = !!code && code === team2Short && code !== team1Short
    return wantTeam2 ? isTeam2 : !isTeam2
  })

  // No players ended up on this side at all (e.g. codes didn't resolve) —
  // treat as "no squad data" rather than an empty XI.
  if (matched.length === 0) return null

  return matched.map((p: any, idx: number) => ({
    name: p?.name ?? "",
    role: p?.role ?? "Batter",
    xi: idx < 11, // flat shape carries no xi flag — default first 11 in order
  }))
}

function poolFromSetup(setup: MatchSetup, side: "team1" | "team2"): SimPlayerPool | null {
  const players = resolveSquad(setup, side)
  if (!players) return null
  const teamMeta = side === "team1" ? setup.team1 : setup.team2

  const xi = players.filter((p) => p.xi && p.name.trim()).map((p) => p.name)
  if (xi.length < 2) return null
  const bowlers = players
    .filter((p) => p.xi && p.name.trim())
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

const statusMeta: Record<RunState, { label: string; accent: string }> = {
  idle: { label: "IDLE", accent: "#9CA3AF" },
  running: { label: "LIVE", accent: "#F5A623" },
  paused: { label: "PAUSED", accent: "#C0C0C0" },
  done: { label: "COMPLETE", accent: "#4ADE80" },
  error: { label: "ERROR", accent: "#F87171" },
}

/** Shared normalization for comparing team name/code strings — trim +
 *  lowercase, so "Kolkata Knight Riders " and "kolkata knight riders"
 *  compare equal. Used both by resolveBracketTeamSides (comparing a
 *  match_setup snapshot against live bracket teams) and by the
 *  bracket-team resync step in handleStart (deciding whether that
 *  snapshot has actually drifted and needs rewriting). */
function normField(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase()
}

// Same card shell used across the admin dashboard (OrganizationClient,
// MatchesTab, TeamsManager, the match editor) — kept consistent here
// since this page is only ever reached from the editor's "Go to
// Simulator" link, not from the public site.
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-black/50 border border-gold/20 shine hover:border-gold/40 transition-all duration-300 rounded-lg p-6 md:p-10 shadow-lg shadow-black/40 ${className}`}
    >
      {children}
    </div>
  )
}

// ── DB cleanup helper ────────────────────────────────────────────
// CHANGED — was a client-side delete loop (deleteRows per table) that
// compared a pre-delete SELECT count against the delete's affected-row
// count to detect RLS-blocked deletes. That check can't catch the case
// where RLS's SELECT policy hides rows entirely (e.g. rows written by a
// different session/role — the real live-scoring flow, not this
// simulator): both the count and the delete come back 0, it looks like
// "nothing to delete," and the old rows are still sitting in the table
// — which is exactly what caused "duplicate key value violates unique
// constraint balls_match_id_innings_number_sequence_key" when
// resimulating an already-completed match.
//
// Now calls reset_match_scoring(p_match_id), a SECURITY DEFINER Postgres
// function that bypasses RLS for this one well-scoped cleanup and
// reliably deletes every balls/match_state/engine_state/ball_commentary
// row for the match regardless of who originally wrote them — and also
// resets the linked bracket_matches row (status/score_a/score_b) in the
// same call, so handleClear() no longer needs its own separate update
// for that.
//
// NOTE: reset_match_scoring should also delete this match's
// match_team_stats rows and roll back its previously-applied standings
// entry (mirror of upsert_standing_after_match but subtracting) — see
// the accompanying SQL migration notes. Not shown here since it's a
// change to that existing function, not new code in this file.
async function clearMatchData(matchId: string): Promise<{ allOk: boolean; failures: string[] }> {
  const { data, error } = await supabase.rpc("reset_match_scoring", { p_match_id: matchId })

  if (error) {
    console.error("[reset_match_scoring] failed:", error.message)
    return { allOk: false, failures: [error.message] }
  }

  console.log("[reset_match_scoring] result:", data)
  return { allOk: true, failures: [] }
}

// ── Bracket team resolution ──────────────────────────────────────
// bracket_matches.team_a_id / team_b_id reference public.teams, while
// teamAPool/teamBPool below are built from match_setup.team1/team2
// (names/shorts only, no team_id). Nothing in the files available
// guarantees team_a_id always corresponds to team1 positionally — so
// rather than assume that mapping, this fetches both team rows and
// matches them by code/name against setup.team1/team2. If it can't
// confidently resolve both sides, it logs a warning and skips the
// score/winner write (falls back to just marking the match
// 'completed', same as before) rather than risking a swapped score.
async function resolveBracketTeamSides(
  bracketRow: { team_a_id: string | null; team_b_id: string | null },
  setup: MatchSetup
): Promise<{ teamAIsSetupTeam1: boolean } | null> {
  if (!bracketRow.team_a_id || !bracketRow.team_b_id) return null

  const { data: teamRows, error } = await supabase
    .from("teams")
    .select("id, code, name")
    .in("id", [bracketRow.team_a_id, bracketRow.team_b_id])

  if (error || !teamRows || teamRows.length !== 2) {
    console.warn("[resolveBracketTeamSides] couldn't load both bracket teams:", error?.message)
    return null
  }

  const teamARow = teamRows.find((t) => t.id === bracketRow.team_a_id)
  const teamBRow = teamRows.find((t) => t.id === bracketRow.team_b_id)
  if (!teamARow || !teamBRow) return null

  const norm = normField
  const t1Code = norm(setup.team1.short)
  const t1Name = norm(setup.team1.name)
  const t2Code = norm(setup.team2.short)
  const t2Name = norm(setup.team2.name)

  const matchesTeam1 = (code: string, name: string) =>
    (t1Code && (code === t1Code)) || (t1Name && name === t1Name)
  const matchesTeam2 = (code: string, name: string) =>
    (t2Code && (code === t2Code)) || (t2Name && name === t2Name)

  const aCode = norm(teamARow.code)
  const aName = norm(teamARow.name)
  const bCode = norm(teamBRow.code)
  const bName = norm(teamBRow.name)

  if (matchesTeam1(aCode, aName) && matchesTeam2(bCode, bName)) {
    return { teamAIsSetupTeam1: true }
  }
  if (matchesTeam2(aCode, aName) && matchesTeam1(bCode, bName)) {
    return { teamAIsSetupTeam1: false }
  }

  console.warn(
    `[resolveBracketTeamSides] ambiguous mapping — bracket team_a="${teamARow.name}" team_b="${teamBRow.name}" vs setup team1="${setup.team1.name}" team2="${setup.team2.name}". Skipping bracket score/winner write.`
  )
  return null
}

export default function SimulateMatchPage() {
  useScrollTop()
  const params = useParams<{ matchId: string }>()
  const matchIdFromRoute = params?.matchId ?? ""

  const [matchIdInput, setMatchIdInput] = useState(matchIdFromRoute)
  const [runState, setRunState] = useState<RunState>("idle")
  const [speedMs, setSpeedMs] = useState(30000)
  const [log, setLog] = useState<LogLine[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [scoreLine, setScoreLine] = useState<string>("")
  const [usedRealSquads, setUsedRealSquads] = useState<{ team1: boolean; team2: boolean } | null>(null)

  const runStateRef = useRef<RunState>("idle")
  const speedRef = useRef(speedMs)
  const logIdRef = useRef(0)

  // NEW — synchronous re-entrancy guard. `runState === "running"` (used
  // to disable the Start button) is a React state value: it doesn't
  // actually change until the next render, so there's a real window
  // between a click and the button visually disabling where a second
  // click, or a second tab open on the same match, could call
  // handleStart() again before the first call had disabled anything.
  // Both calls would then run their own fully-correct innings-1 ->
  // innings-2 sequence independently, writing to the same match_id at
  // the same time — which looks exactly like "both innings simulating
  // in parallel" even though neither run, on its own, ever does that.
  // runTokenRef (below) only ever protected one run from racing itself;
  // it does nothing to stop a second independent call. isRunningRef is
  // checked and set synchronously as the very first thing in
  // handleStart(), before any `await`, so a second call can never get
  // past that check while a run is genuinely in progress.
  const isRunningRef = useRef(false)

  // Every call to handleStart() bumps this to a new unique value ("this
  // run's token"). Any in-flight delivery loop from a PREVIOUS run
  // captures its own token at start time and compares against
  // runTokenRef.current on every iteration — the moment they differ,
  // that loop knows a newer run (or a Clear) has since started and exits
  // immediately instead of racing new inserts / deletes.
  const runTokenRef = useRef(0)

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
    // upsert, not insert — a safety net against the rare remaining race
    // (e.g. a run that outlives a Clear click's delete), not a
    // substitute for isRunningRef actually preventing overlapping runs.
    const { error } = await supabase
      .from("balls")
      .upsert({ match_id: matchId, ...row }, { onConflict: "match_id,innings_number,sequence" })
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
    // Synchronous guard — must be the very first thing in this function,
    // before any await, so a second overlapping call is rejected
    // immediately rather than slipping through while `runState` hasn't
    // re-rendered yet. See isRunningRef's declaration above for why this
    // is necessary in addition to runTokenRef.
    if (isRunningRef.current) {
      console.warn("[handleStart] ignored — a run is already in progress for this page instance.")
      return
    }
    isRunningRef.current = true

    setErrorMsg(null)
    setLog([])
    setUsedRealSquads(null)
    const myToken = ++runTokenRef.current // invalidates any previous in-flight run
    const matchId = matchIdInput.trim()
    if (!matchId) {
      setErrorMsg("Paste a match_id first.")
      isRunningRef.current = false
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

      const { data: bracketRow } = await supabase
        .from("bracket_matches")
        .select("id, status, team_a_id, team_b_id, tournament_id")
        .eq("overlay_match_id", matchId)
        .maybeSingle()

      // ── Resync match_setup.team1/team2 from the CURRENT bracket teams ──
      // bracket_matches.team_a_id/team_b_id is the live source of truth
      // for which two teams actually occupy this bracket slot right now
      // — it can change any time an earlier feeder match gets
      // re-simulated with a different winner. match_setup.team1/team2 is
      // only ever written once, when this `matches` row is first created
      // and linked via overlay_match_id, and NOTHING previously kept it
      // in sync afterward. So re-simulating an earlier round left this
      // match still "remembering" whichever teams occupied the slot the
      // very first time it ran — which is exactly what produced the
      // "couldn't confidently match bracket teams" warning and
      // placeholder player names on a resimulate: resolveBracketTeamSides
      // was correctly comparing a stale snapshot against live data and
      // finding no match.
      //
      // Runs whenever this match is linked to a bracket slot at all, not
      // only when reset=true — the bracket's teams could just as easily
      // have changed between two runs regardless of the reset flag.
      // team_a_id is treated as team1 and team_b_id as team2 here (rather
      // than inferring which is which, the way resolveBracketTeamSides
      // has to for a possibly-stale row) — this write IS what makes them
      // match going forward, so there's nothing to infer. Stale squads
      // are cleared in the same step (any roster in match_setup.squads
      // was tied to whichever teams occupied this slot before) so
      // poolFromSetup cleanly falls back to placeholder players instead
      // of silently mixing an old roster in under a new team name.
      let bracketTeamsResynced = false
      if (bracketRow?.team_a_id && bracketRow?.team_b_id) {
        const { data: currentBracketTeams, error: currentTeamsErr } = await supabase
          .from("teams")
          .select("id, code, name")
          .in("id", [bracketRow.team_a_id, bracketRow.team_b_id])

        if (currentTeamsErr) {
          console.error("[handleStart] failed loading current bracket teams for resync:", currentTeamsErr.message)
        } else if (currentBracketTeams && currentBracketTeams.length === 2) {
          const liveTeamA = currentBracketTeams.find((t) => t.id === bracketRow.team_a_id)
          const liveTeamB = currentBracketTeams.find((t) => t.id === bracketRow.team_b_id)

          if (liveTeamA && liveTeamB) {
            const teamsDrifted =
              normField(parsedSetup.team1?.name) !== normField(liveTeamA.name) ||
              normField(parsedSetup.team1?.short) !== normField(liveTeamA.code) ||
              normField(parsedSetup.team2?.name) !== normField(liveTeamB.name) ||
              normField(parsedSetup.team2?.short) !== normField(liveTeamB.code)

            if (teamsDrifted) {
              const prevTeam1Name = parsedSetup.team1?.name ?? "(unset)"
              const prevTeam2Name = parsedSetup.team2?.name ?? "(unset)"
              parsedSetup.team1 = { ...parsedSetup.team1, name: liveTeamA.name, short: liveTeamA.code }
              parsedSetup.team2 = { ...parsedSetup.team2, name: liveTeamB.name, short: liveTeamB.code }
              // Old roster belonged to whichever teams previously sat in
              // this slot — no longer meaningful once the teams change,
              // so clear it rather than let poolFromSetup silently pair
              // it with the wrong team.
              ;(parsedSetup as any).squads = []
              bracketTeamsResynced = true
              pushLog(
                `Bracket teams for this match changed since it was last simulated (was "${prevTeam1Name}" vs "${prevTeam2Name}", now "${liveTeamA.name}" vs "${liveTeamB.name}") — match info and squads have been resynced.`,
                true
              )
            }
          }
        }
      }

      // Build the authoritative setup only after bracket synchronization. The
      // previous code captured `setup` before the resync, so the database was
      // updated with the new teams but pools/results still used the old teams.
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

      // A feeder-team change makes the previous scoring state invalid even if
      // the operator did not press Reset explicitly.
      if (bracketTeamsResynced && !reset) {
        pushLog("Clearing stale scoring state because the bracket teams changed…")
        const { allOk, failures } = await clearMatchData(matchId)
        if (!allOk) {
          throw new Error(`Failed clearing stale data after bracket resync: ${failures.join("; ")}`)
        }
      }

      if (reset) {
        pushLog("Clearing any existing balls/state/commentary for this match…")
        const { allOk, failures } = await clearMatchData(matchId)
        if (!allOk) {
          // Don't silently continue into a fresh simulation on top of
          // data that failed to clear (e.g. stale commentary lines
          // sitting under RLS) — surface it and stop here.
          throw new Error(`Failed clearing existing data before reset: ${failures.join("; ")}`)
        }
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
      const realTeamAPool = poolFromSetup(setup, "team1")
      const realTeamBPool = poolFromSetup(setup, "team2")
      const teamAPool = realTeamAPool ?? generatePlaceholderPool(setup.team1.name, setup.team1.short)
      const teamBPool = realTeamBPool ?? generatePlaceholderPool(setup.team2.name, setup.team2.short)
      setUsedRealSquads({ team1: !!realTeamAPool, team2: !!realTeamBPool })

      pushLog(`Starting simulation: ${teamAPool.teamName} vs ${teamBPool.teamName}, ${oversLimit} overs a side.`, true)
      if (!realTeamAPool || !realTeamBPool) {
        pushLog(
          `Note: ${!realTeamAPool && !realTeamBPool ? "both squads" : !realTeamAPool ? teamAPool.teamName : teamBPool.teamName} had no usable roster in match_setup — using placeholder players for ${
            !realTeamAPool && !realTeamBPool ? "them" : "this side"
          }.`
        )
      }
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

      const teamAWon = innings2.runs < target - 1
      const isTie = innings2.runs === target - 1
      const resultText = isTie
        ? "Match tied."
        : innings2.runs >= target
          ? `${teamBPool.teamName} win by ${10 - innings2.wkts} wicket${10 - innings2.wkts === 1 ? "" : "s"}.`
          : `${teamAPool.teamName} win by ${target - 1 - innings2.runs} runs.`

      pushLog(`Innings 2 complete: ${teamBPool.teamName} ${innings2.runs}/${innings2.wkts}. ${resultText}`, true)

      // ── Mark the match complete on `matches` itself ──────────────
      // Previously nothing durable recorded "this match finished" on
      // the matches row for standalone (non-bracket) matches —
      // currentInnings stayed at 2 forever. matchComplete is added
      // alongside the runtime fields so the live page (or anything
      // else reading match_setup) can detect completion without a
      // bracket link.
      const { error: completeUpdateErr } = await supabase
        .from("matches")
        .update({
          match_setup: {
            ...setup,
            overs: oversLimit,
            target,
            currentInnings: 2,
            matchComplete: true,
            resultText,
          },
        })
        .eq("id", matchId)
      if (completeUpdateErr) {
        // Non-fatal — the simulation itself succeeded and bracket/
        // standings writes below still matter, so log and continue
        // rather than throwing here.
        console.error("[handleStart] failed setting matchComplete flag:", completeUpdateErr.message)
      }

      // ── Bracket + match_team_stats + standings (via DB trigger) ──
      //
      // FIXED (was: silently marking bracket_matches 'completed' with
      // no score_a/score_b/winner_team_id when the team-side mapping
      // was ambiguous, or when match_team_stats failed to write).
      // `status = 'completed'` with no winner is exactly the state
      // that stalls a live/losers-bracket match's downstream slot
      // forever — nothing propagates, and it's silent: the bracket UI
      // shows a "completed" card with no score and no visible error.
      //
      // Both fallback branches below now leave the bracket match at
      // `status: 'live'` instead of `'completed'` when the result
      // can't be safely written. This keeps the match visibly
      // unresolved on the bracket (so it doesn't look done when it
      // isn't) rather than quietly locking in a dead end. The engine
      // simulation itself still completed fine either way — this only
      // affects whether the *bracket* reflects that.
      if (bracketRow) {
        const sides = await resolveBracketTeamSides(bracketRow, setup)

        if (sides) {
          const { teamAIsSetupTeam1 } = sides
          // bracket "team A" maps to whichever of our pools actually
          // corresponds to bracket_matches.team_a_id, per resolveBracketTeamSides.
          const bracketTeamAId = bracketRow.team_a_id as string
          const bracketTeamBId = bracketRow.team_b_id as string

          const bracketTeamAStats = teamAIsSetupTeam1
            ? { runs: innings1.runs, ballsFaced: innings1.legalBalls, runsConceded: innings2.runs, ballsBowled: innings2.legalBalls, isWinner: teamAWon }
            : { runs: innings2.runs, ballsFaced: innings2.legalBalls, runsConceded: innings1.runs, ballsBowled: innings1.legalBalls, isWinner: !teamAWon }

          const bracketTeamBStats = teamAIsSetupTeam1
            ? { runs: innings2.runs, ballsFaced: innings2.legalBalls, runsConceded: innings1.runs, ballsBowled: innings1.legalBalls, isWinner: !teamAWon }
            : { runs: innings1.runs, ballsFaced: innings1.legalBalls, runsConceded: innings2.runs, ballsBowled: innings2.legalBalls, isWinner: teamAWon }

          if (isTie) {
            bracketTeamAStats.isWinner = false
            bracketTeamBStats.isWinner = false
          }

          const { error: statsErr } = await supabase.from("match_team_stats").upsert(
            [
              {
                match_id: matchId,
                team_id: bracketTeamAId,
                runs_scored: bracketTeamAStats.runs,
                balls_faced: bracketTeamAStats.ballsFaced,
                runs_conceded: bracketTeamAStats.runsConceded,
                balls_bowled: bracketTeamAStats.ballsBowled,
                is_winner: bracketTeamAStats.isWinner,
              },
              {
                match_id: matchId,
                team_id: bracketTeamBId,
                runs_scored: bracketTeamBStats.runs,
                balls_faced: bracketTeamBStats.ballsFaced,
                runs_conceded: bracketTeamBStats.runsConceded,
                balls_bowled: bracketTeamBStats.ballsBowled,
                is_winner: bracketTeamBStats.isWinner,
              },
            ],
            { onConflict: "match_id,team_id" }
          )

          if (statsErr) {
            // FIXED: previously wrote status: "completed" here with no
            // score/winner — the bracket would show this match as
            // finished while every downstream slot stayed stuck
            // forever, with no visible sign of why. Leaving status at
            // "live" instead means the bracket keeps showing the match
            // as unresolved, matching reality, until this is retried
            // or fixed manually.
            console.error("[handleStart] failed writing match_team_stats:", statsErr.message)
            pushLog(
              `Warning: could not record match_team_stats — standings won't update for this match, and the bracket match has been LEFT LIVE (not marked completed) so it doesn't silently stall. (${statsErr.message})`
            )
            const { error: statusErr } = await supabase
              .from("bracket_matches")
              .update({ status: "live" })
              .eq("id", bracketRow.id)
            if (statusErr) {
              console.error("[handleStart] failed to leave bracket_matches status as 'live':", statusErr.message)
            }
          } else {
            // This single UPDATE, once match_team_stats above has
            // committed, is what fires
            // trg_bracket_match_completed_update_standings and rolls
            // the result into `standings` automatically.
            const { error: bracketUpdateErr } = await supabase
              .from("bracket_matches")
              .update({
                score_a: bracketTeamAStats.runs,
                score_b: bracketTeamBStats.runs,
                winner_team_id: isTie ? null : bracketTeamAStats.isWinner ? bracketTeamAId : bracketTeamBId,
                result_source: "overlay",
                status: "completed",
              })
              .eq("id", bracketRow.id)

            if (bracketUpdateErr) {
              // The write that actually sets status: 'completed' failed
              // outright — the row is still whatever it was before this
              // call (we set it to 'live' earlier in this same run), so
              // there's no risk of a "completed but no result" state
              // here. Just surface it.
              console.error("[handleStart] failed updating bracket_matches:", bracketUpdateErr.message)
              pushLog(`Warning: bracket match update failed — ${bracketUpdateErr.message}`)
            } else {
              pushLog("Bracket match marked completed — standings updated.", true)
            }
          }
        } else {
          // FIXED: previously wrote status: "completed" here too, with
          // score_a/score_b/winner_team_id all left null "to avoid
          // writing a possibly-swapped result." The intent (don't guess
          // a swapped score) was right, but marking it 'completed'
          // anyway created exactly the same stuck-forever bracket node
          // as the statsErr branch above, just from a different cause.
          // Leaving status at "live" keeps the bracket honest — this
          // match visibly still needs attention — instead of quietly
          // dead-ending downstream slots with no result to propagate.
          pushLog(
            "Warning: couldn't confidently match bracket teams to this match's squads — bracket match has been LEFT LIVE (not marked completed), and score/winner/standings were skipped. Check bracket_matches.team_a_id/team_b_id and match_setup.team1/team2 for this match, then re-run or fix the row manually.",
          )
          const { error: statusErr } = await supabase
            .from("bracket_matches")
            .update({ status: "live" })
            .eq("id", bracketRow.id)
          if (statusErr) {
            console.error("[handleStart] failed to leave bracket_matches status as 'live':", statusErr.message)
          }
        }
      }

      setRun("done")
    } catch (err) {
      if (myToken !== runTokenRef.current) return // a stale run's error — ignore it, a newer run is active
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.")
      setRun("error")
    } finally {
      // Always released, on every exit path (success, throw, or an early
      // `return` from a superseded-token check) — otherwise a single
      // stuck `true` here would permanently block every future
      // Start/Reset click on this page instance, even after a genuine
      // error or a Stop.
      isRunningRef.current = false
    }
  }

  function handlePauseResume() {
    if (runStateRef.current === "running") setRun("paused")
    else if (runStateRef.current === "paused") setRun("running")
  }

  function handleStop() {
    runTokenRef.current++ // invalidates any in-flight loop immediately
    // NOTE: isRunningRef is intentionally left alone here — the
    // in-flight handleStart() call's own `finally` block will clear it
    // once its current await resolves and its next token check bails
    // it out. Clearing it here too, from a different call stack, would
    // race that finally block and could very rarely re-open the guard's
    // window a moment before the stale run has actually stopped writing.
    setRun("idle")
  }

  // Wipes every trace of this match's simulated data — balls, live/engine
  // state, ball-by-ball commentary, bracket score/status, and the
  // runtime-only match_setup keys (target, currentInnings, matchComplete,
  // resultText) — while leaving team1/team2/venue/etc alone. This is
  // what makes the live match page fall back to "not_started" and empty
  // scorecards the instant it's clicked, via Realtime.
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
    setUsedRealSquads(null)

    try {
      // clearMatchData now also resets the linked bracket_matches row
      // (status -> 'upcoming', score_a/score_b -> null) as part of the
      // same reset_match_scoring() call. NOTE: reset_match_scoring
      // should also be extended to delete match_team_stats rows and
      // reverse the standings entry for this match (see the SQL
      // migration notes) — otherwise clearing a match after it's been
      // rolled into standings leaves the standings numbers stale.
      const { allOk, failures } = await clearMatchData(matchId)
      if (!allOk) {
        throw new Error(
          `Some data failed to clear — ${failures.join("; ")}`
        )
      }

      const { data: matchRow } = await supabase
        .from("matches")
        .select("match_setup")
        .eq("id", matchId)
        .maybeSingle()

      if (matchRow?.match_setup) {
        const { target, currentInnings, matchComplete, resultText, ...rest } = matchRow.match_setup as Record<string, unknown>
        await supabase.from("matches").update({ match_setup: rest }).eq("id", matchId)
      }

      pushLog("Cleared — all deliveries, live state, and commentary have been wiped.", true)
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

      <AppHeader title="Match Simulator" />

      <section className="pt-26 sm:pt-30 pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 max-w-3xl">
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-2 font-cinzel">
            <Gavel className="w-3.5 h-3.5" />
            Match Simulator
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-white font-cinzel mb-2">Simulate this Match</h1>
          <p className="text-gray-400 text-sm">
            Generates a full match, ball by ball, writing directly into <code className="text-gold">balls</code> and
            updating <code className="text-gold">matches</code> / <code className="text-gold">bracket_matches</code>{" "}
            as it goes. Open the live match page in another tab to watch it update in real time.
          </p>
        </div>
      </section>

      <section className="pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 max-w-3xl">
          {/* ── Control panel ── */}
          <Panel className="mb-8 space-y-8">
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

            {usedRealSquads && (
              <p className="text-xs text-gray-400 -mt-4">
                Squads used:{" "}
                <span className={usedRealSquads.team1 ? "text-green-400" : "text-amber-400"}>
                  Team 1 {usedRealSquads.team1 ? "(from match_setup)" : "(placeholder)"}
                </span>
                {" · "}
                <span className={usedRealSquads.team2 ? "text-green-400" : "text-amber-400"}>
                  Team 2 {usedRealSquads.team2 ? "(from match_setup)" : "(placeholder)"}
                </span>
              </p>
            )}

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
                Speed: <span className="text-gold">{speedMs/1000}s</span> per ball
              </label>
              <input
                type="range"
                min={500}
                max={60000}
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
          <Panel>
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

          <div className="text-center mt-10">
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
