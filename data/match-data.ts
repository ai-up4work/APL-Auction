// data/match-data.ts
//
// Match-detail data layer, backed by Supabase.
//
// SOURCE OF TRUTH (reconciled against the real `public` schema):
//
//   - `matches.match_setup` (jsonb, NOT NULL) → confirmed real shape:
//         {
//           date, time, toss, overs,
//           team1: { name, short },
//           team2: { name, short },
//           venue,
//           tournamentId,
//           currentInnings   // 1 | 2 — explicit, set by the simulator
//         }
//     This is the baseline. It has NO real foreign keys to `teams` — team
//     identity here is just an embedded name/short pair. It's the only
//     source of truth for STANDALONE / FRIENDLY matches.
//
//   - `bracket_matches` → for matches that ARE part of a tournament
//     bracket, this table links back via `overlay_match_id = matches.id`
//     and carries REAL foreign keys: `team_a_id` / `team_b_id` →
//     `teams.id`, plus its own `tournament_id`, `venue`, `scheduled_at`,
//     `status`, `score_a` / `score_b`. Preferred over match_setup's
//     embedded fields when it exists.
//
//   - `teams` → scoped to an `auction_id`, reached only via
//     bracket_matches.team_a_id/team_b_id (no direct matches → teams FK).
//
//   - `balls` → ball-by-ball truth. Batting/bowling cards, fall of
//     wickets, extras, and over-by-over totals are ALL derived from this
//     table.
//
//   - `match_state.live_state` → used ONLY for win probability.
//
// MATCH STATUS:
//   Whether a match is "live" can't be inferred from overs/wickets
//   arithmetic alone — a match with 0 balls recorded and a match that's
//   genuinely in progress can look identical to that arithmetic (both
//   have runs < target, wickets < 10, overs < limit). So `matchStatus` is
//   now explicit:
//     - "not_started": no rows in `balls` for this match at all (or
//       bracket_matches.status === "upcoming" when a bracket row exists)
//     - "live": at least one ball recorded and still in progress (or
//       bracket_matches.status === "live")
//     - "completed": innings finished by overs/wickets/target, or
//       bracket_matches.status === "completed"
//   The UI should use `matchStatus`, not guess from raw totals.
//
// CURRENT INNINGS:
//   Similarly, WHICH innings is in progress is read from the explicit
//   `match_setup.currentInnings` flag rather than inferred from
//   `target`'s presence. Arithmetic alone can't distinguish "1st innings
//   still batting, no target computed yet" from "2nd innings hasn't
//   started" — both have hasBallData possibly true/false independently.
//   `currentInnings` removes that ambiguity: it's written by the
//   simulator (or any future manual scoring UI) at the exact moment each
//   innings starts.
//
// LOOKUP RESULT SHAPE:
//   getMatchDetailById returns a MatchLookupResult — either
//   { ok: true, match } or a typed failure with a human-readable reason —
//   instead of `null`, so the page can render a real diagnostic.

import { supabase } from "@/lib/supabase"
import { slugify } from "@/data/site-data"

// ─────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ─────────────────────────────────────────────────────────────
export interface BattingRow {
  name: string
  runs: number
  balls: number
  fours: number
  sixes: number
  notOut: boolean
  how: string
}

export interface BowlingRow {
  name: string
  overs: string
  runs: number
  wkts: number
  econ: string
}

export type FowEntry = [string, string, string]

export interface MatchSquad {
  team: string
  captain: string
  players: { name: string; role: string; xi: boolean }[]
}

export interface InningsComplete {
  batting: BattingRow[]
  bowling: BowlingRow[]
  fow: FowEntry[]
  extras: number
  extrasNote: string
  total: number
  wkts: number
  overs: string
  overRuns: number[]
  dnb?: string[]
  potm?: { name: string; note: string }
}

export interface MatchTeamRef {
  /** Real teams.id when resolved via bracket_matches; otherwise the short code. */
  id: string
  name: string
  short: string
  /** Only populated when resolved via bracket_matches → teams. */
  logo?: string
  color?: string
}

export type MatchStatus = "not_started" | "live" | "completed"

export interface MatchDetail {
  id: string
  tournamentSlug?: string
  tournamentName?: string
  round: string
  /** Empty string means genuinely not set — the UI should show that explicitly, not hide it. */
  venue: string
  date: string
  time: string
  toss: string
  target: number
  resultNote: string
  pitch: string
  context: string
  officials: {
    umpires: string
    thirdUmpire: string
    referee: string
    format: string
  }
  teamA: MatchTeamRef
  teamB: MatchTeamRef
  innings1: InningsComplete
  innings2Final: InningsComplete
  innings2Partial: {
    runsAtStart: number
    wktsAtStart: number
    overAtStart: string
    overRunsAtStart: number[]
    over19ExtraRuns: number
    batting: BattingRow[]
    bowling: BowlingRow[]
    fow: FowEntry[]
  }
  squads: MatchSquad[]
  /** Explicit status — see the block comment above. Prefer this over isLive. */
  matchStatus: MatchStatus
  /** Derived from matchStatus === "live", kept for callers that only need the boolean. */
  isLive: boolean
  /** True once at least one ball has been recorded for this match, in either innings. */
  hasBallData: boolean
  /**
   * Explicit — which innings is currently in progress (or most recently
   * was, once completed). Read from `match_setup.currentInnings`, falling
   * back to a best-effort guess (2 once any ball data exists, else 1)
   * only for older rows written before this field existed.
   */
  currentInnings: 1 | 2
  /** From match_state.live_state, when the engine populates it. */
  winProb?: { a: number; b: number }
}

/**
 * Why a lookup failed, plus enough detail to actually debug it.
 */
export interface MatchLookupFailure {
  ok: false
  reason:
    | "match_not_found"
    | "match_setup_invalid"
    | "tournament_mismatch"
    | "balls_query_failed"
  message: string
  detail?: string
}

export type MatchLookupResult = { ok: true; match: MatchDetail } | MatchLookupFailure

// ─────────────────────────────────────────────────────────────
// DB ROW SHAPES (trimmed to the columns we actually use)
// ─────────────────────────────────────────────────────────────
interface MatchSetupSquadPlayer {
  playerId?: string
  name: string
  role: string
  xi: boolean
}

interface MatchSetupSquad {
  teamId: string
  captain: string
  players: MatchSetupSquadPlayer[]
}

interface MatchSetupTeam {
  name: string
  short: string
}

interface MatchSetup {
  team1: MatchSetupTeam
  team2: MatchSetupTeam
  date?: string
  time?: string
  toss?: string | null
  overs?: number
  venue?: string
  tournamentId?: string
  round?: string
  pitch?: string
  context?: string
  target?: number
  resultNote?: string
  officials?: {
    umpires?: string
    thirdUmpire?: string
    referee?: string
    format?: string
  }
  squads?: MatchSetupSquad[]
  currentInnings?: 1 | 2
}

interface BallRow {
  id: number
  match_id: string
  innings_number: number
  sequence: number
  over_number: number
  ball_number: number
  striker_name: string | null
  non_striker_name: string | null
  bowler_name: string | null
  runs: number
  extra_type: string | null
  is_wicket: boolean
  dismissal_type: string | null
  batsman_out: string | null
  fielder: string | null
}

interface BracketMatchRow {
  id: string
  tournament_id: string
  team_a_id: string | null
  team_b_id: string | null
  venue: string | null
  scheduled_at: string | null
  status: "upcoming" | "live" | "completed"
  round: number
  score_a: number | null
  score_b: number | null
}

interface TeamRow {
  id: string
  name: string
  code: string
  logo: string | null
  color: string
}

// ─────────────────────────────────────────────────────────────
// AGGREGATION — balls → scorecard
// ─────────────────────────────────────────────────────────────
function formatOvers(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6)
  const rem = legalBalls % 6
  return `${overs}.${rem}`
}

function aggregateInnings(balls: BallRow[]): Omit<InningsComplete, "dnb" | "potm"> {
  const sorted = [...balls].sort((a, b) => a.sequence - b.sequence)

  type BatAcc = { runs: number; balls: number; fours: number; sixes: number; out: boolean; how: string; order: number }
  type BowlAcc = { legalBalls: number; runs: number; wkts: number; order: number }

  const batting = new Map<string, BatAcc>()
  const bowling = new Map<string, BowlAcc>()
  const fow: FowEntry[] = []
  const overRunsMap = new Map<number, number>()

  let battingOrder = 0
  let bowlingOrder = 0
  let extrasTotal = 0
  const extrasByType = { wd: 0, nb: 0, b: 0, lb: 0, p: 0 }
  let teamTotal = 0
  let teamWkts = 0
  let legalDeliveries = 0
  let lastOver = 0
  let lastBallInOver = 0

  for (const row of sorted) {
    const striker = row.striker_name ?? "Unknown"
    const bowler = row.bowler_name ?? "Unknown"
    const isWide = row.extra_type === "wide"
    const isNoBall = row.extra_type === "no_ball"
    const isBye = row.extra_type === "bye"
    const isLegBye = row.extra_type === "leg_bye"
    const isLegal = !isWide && !isNoBall

    teamTotal += row.runs
    if (row.extra_type) {
      extrasTotal += row.runs
      if (isWide) extrasByType.wd += row.runs
      else if (isNoBall) extrasByType.nb += row.runs
      else if (isBye) extrasByType.b += row.runs
      else if (isLegBye) extrasByType.lb += row.runs
      else extrasByType.p += row.runs
    }

    if (!batting.has(striker)) {
      batting.set(striker, { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, how: "", order: battingOrder++ })
    }
    const bat = batting.get(striker)!
    if (!isWide) bat.balls += 1
    if (!row.extra_type) {
      bat.runs += row.runs
      if (row.runs === 4) bat.fours += 1
      if (row.runs === 6) bat.sixes += 1
    }

    if (!bowling.has(bowler)) {
      bowling.set(bowler, { legalBalls: 0, runs: 0, wkts: 0, order: bowlingOrder++ })
    }
    const bowl = bowling.get(bowler)!
    if (isLegal) bowl.legalBalls += 1
    if (!isBye && !isLegBye) bowl.runs += row.runs

    if (row.is_wicket) {
      teamWkts += 1
      bat.out = true
      const dismissalText = row.dismissal_type
        ? `${row.dismissal_type}${row.fielder ? ` (${row.fielder})` : ""}`
        : "out"
      bat.how = dismissalText
      if (row.dismissal_type !== "run_out") bowl.wkts += 1
      fow.push([
        `${teamWkts}-${teamTotal}`,
        row.batsman_out ?? striker,
        formatOvers(legalDeliveries + (isLegal ? 1 : 0)),
      ])
    }

    if (isLegal) {
      legalDeliveries += 1
      lastOver = row.over_number
      lastBallInOver = row.ball_number
    }
    overRunsMap.set(row.over_number, (overRunsMap.get(row.over_number) ?? 0) + row.runs)
  }

  const battingRows: BattingRow[] = [...batting.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([name, b]) => ({
      name,
      runs: b.runs,
      balls: b.balls,
      fours: b.fours,
      sixes: b.sixes,
      notOut: !b.out,
      how: b.how,
    }))

  const bowlingRows: BowlingRow[] = [...bowling.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([name, b]) => {
      const oversFaced = b.legalBalls / 6
      return {
        name,
        overs: formatOvers(b.legalBalls),
        runs: b.runs,
        wkts: b.wkts,
        econ: oversFaced > 0 ? (b.runs / oversFaced).toFixed(2) : "0.00",
      }
    })

  const extrasNoteParts: string[] = []
  if (extrasByType.b) extrasNoteParts.push(`b ${extrasByType.b}`)
  if (extrasByType.lb) extrasNoteParts.push(`lb ${extrasByType.lb}`)
  if (extrasByType.wd) extrasNoteParts.push(`wd ${extrasByType.wd}`)
  if (extrasByType.nb) extrasNoteParts.push(`nb ${extrasByType.nb}`)
  if (extrasByType.p) extrasNoteParts.push(`p ${extrasByType.p}`)

  const maxOver = Math.max(0, ...[...overRunsMap.keys()])
  const overRuns: number[] = []
  for (let o = 1; o <= maxOver; o++) overRuns.push(overRunsMap.get(o) ?? 0)

  return {
    batting: battingRows,
    bowling: bowlingRows,
    fow,
    extras: extrasTotal,
    extrasNote: extrasNoteParts.join(", ") || "none",
    total: teamTotal,
    wkts: teamWkts,
    overs: legalDeliveries > 0 ? `${lastOver}.${lastBallInOver}` : "0.0",
    overRuns,
  }
}

// ─────────────────────────────────────────────────────────────
// FETCHERS
// ─────────────────────────────────────────────────────────────
function isMatchSetupTeam(v: unknown): v is MatchSetupTeam {
  return !!v && typeof v === "object" && typeof (v as any).name === "string" && typeof (v as any).short === "string"
}

function parseMatchSetup(raw: unknown): MatchSetup | null {
  if (!raw || typeof raw !== "object") return null
  const setup = raw as Partial<MatchSetup>
  if (!isMatchSetupTeam(setup.team1) || !isMatchSetupTeam(setup.team2)) return null
  return setup as MatchSetup
}

function buildSquads(setup: MatchSetup, teamAName: string, teamBName: string): MatchSquad[] {
  if (!setup.squads || setup.squads.length === 0) return []
  return setup.squads.map((s) => {
    const tag = s.teamId?.toLowerCase?.() ?? ""
    const isTeamA =
      tag === "team1" || tag === setup.team1.short.toLowerCase() || tag === teamAName.toLowerCase()
    const isTeamB =
      tag === "team2" || tag === setup.team2.short.toLowerCase() || tag === teamBName.toLowerCase()
    const teamName = isTeamA ? teamAName : isTeamB ? teamBName : "Unknown Team"
    return {
      team: teamName,
      captain: s.captain,
      players: s.players.map((p) => ({ name: p.name, role: p.role, xi: p.xi })),
    }
  })
}

/**
 * Fetch a single match and assemble it into the `MatchDetail` shape the
 * client component expects. Returns a MatchLookupResult rather than
 * `null`, so the caller can render exactly why a lookup failed.
 */
export async function getMatchDetailById(
  matchId: string,
  tournamentSlug?: string
): Promise<MatchLookupResult> {
  const { data: matchRow, error: matchErr } = await supabase
    .from("matches")
    .select("id, match_setup")
    .eq("id", matchId)
    .maybeSingle()

  if (matchErr) {
    return {
      ok: false,
      reason: "match_not_found",
      message: "The database rejected the lookup for this match.",
      detail: matchErr.message,
    }
  }

  if (!matchRow) {
    return {
      ok: false,
      reason: "match_not_found",
      message: "No match exists with this ID.",
      detail: `matchId "${matchId}" returned no row from "matches". Either the ID is wrong, the row was never inserted, or a Row-Level Security policy on "matches" is silently hiding it from this request.`,
    }
  }

  const setup = parseMatchSetup(matchRow.match_setup)
  if (!setup) {
    return {
      ok: false,
      reason: "match_setup_invalid",
      message: "This match exists, but its setup data is missing or malformed.",
      detail: `"matches.match_setup" for id "${matchId}" doesn't have valid team1/team2 objects (each needs { name, short }). Raw value: ${JSON.stringify(
        matchRow.match_setup
      )}`,
    }
  }

  // ── bracket linkage: authoritative when present ──
  const { data: bracketRow } = await supabase
    .from("bracket_matches")
    .select("id, tournament_id, team_a_id, team_b_id, venue, scheduled_at, status, round, score_a, score_b")
    .eq("overlay_match_id", matchId)
    .maybeSingle<BracketMatchRow>()

  let resolvedTournamentSlug: string | undefined
  let resolvedTournamentName: string | undefined
  const tournamentIdToResolve = bracketRow?.tournament_id ?? setup.tournamentId

  if (tournamentIdToResolve) {
    const { data: tournamentRow } = await supabase
      .from("tournaments")
      .select("name")
      .eq("id", tournamentIdToResolve)
      .maybeSingle()

    if (tournamentRow?.name) {
      resolvedTournamentName = tournamentRow.name
      resolvedTournamentSlug = slugify(tournamentRow.name)
    }
  }

  if (tournamentSlug !== undefined) {
    if (!resolvedTournamentSlug || resolvedTournamentSlug !== slugify(tournamentSlug)) {
      return {
        ok: false,
        reason: "tournament_mismatch",
        message: "This match exists, but not under the tournament in this URL.",
        detail: `URL tournamentSlug is "${tournamentSlug}", but this match resolves to "${
          resolvedTournamentSlug ?? "no tournament"
        }".`,
      }
    }
  }

  // ── team identity: prefer real teams rows via bracket_matches, else
  //    fall back to the embedded match_setup.team1/team2 ──
  let teamA: MatchTeamRef = { id: setup.team1.short, name: setup.team1.name, short: setup.team1.short }
  let teamB: MatchTeamRef = { id: setup.team2.short, name: setup.team2.name, short: setup.team2.short }

  if (bracketRow?.team_a_id && bracketRow?.team_b_id) {
    const { data: teamRows } = await supabase
      .from("teams")
      .select("id, name, code, logo, color")
      .in("id", [bracketRow.team_a_id, bracketRow.team_b_id])

    const teamARow = teamRows?.find((t) => t.id === bracketRow.team_a_id) as TeamRow | undefined
    const teamBRow = teamRows?.find((t) => t.id === bracketRow.team_b_id) as TeamRow | undefined

    if (teamARow && teamBRow) {
      teamA = { id: teamARow.id, name: teamARow.name, short: teamARow.code, logo: teamARow.logo ?? undefined, color: teamARow.color }
      teamB = { id: teamBRow.id, name: teamBRow.name, short: teamBRow.code, logo: teamBRow.logo ?? undefined, color: teamBRow.color }
    }
  }

  // ── ball-by-ball for both innings ──
  const { data: ballRows, error: ballErr } = await supabase
    .from("balls")
    .select(
      "id, match_id, innings_number, sequence, over_number, ball_number, striker_name, non_striker_name, bowler_name, runs, extra_type, is_wicket, dismissal_type, batsman_out, fielder"
    )
    .eq("match_id", matchId)
    .order("sequence", { ascending: true })

  if (ballErr) {
    return {
      ok: false,
      reason: "balls_query_failed",
      message: "The database rejected the lookup for this match's ball-by-ball data.",
      detail: ballErr.message,
    }
  }

  const allBalls = ballRows ?? []
  const hasBallData = allBalls.length > 0

  const innings1Balls = allBalls.filter((b) => b.innings_number === 1)
  const innings2Balls = allBalls.filter((b) => b.innings_number === 2)

  const innings1 = aggregateInnings(innings1Balls)
  const innings2Agg = aggregateInnings(innings2Balls)

  const target = setup.target ?? innings1.total + 1
  const oversLimit = setup.overs ?? 20
  const [innings2OversNum, innings2BallsNum] = innings2Agg.overs.split(".").map(Number)
  const innings2LegalBalls = innings2OversNum * 6 + innings2BallsNum

  // Arithmetic can only distinguish "live" from "completed" — it cannot
  // tell "0 balls bowled, not started" apart from "in progress", since
  // both satisfy runs < target && wkts < 10 && overs < limit. So it's
  // only consulted when we already know balls have been recorded.
  const arithmeticIsLive =
    hasBallData &&
    innings2LegalBalls < oversLimit * 6 &&
    innings2Agg.wkts < 10 &&
    !(innings2Agg.total >= target && target > 0)

  let matchStatus: MatchStatus
  if (bracketRow?.status) {
    matchStatus = bracketRow.status === "live" ? "live" : bracketRow.status === "completed" ? "completed" : "not_started"
  } else if (!hasBallData) {
    matchStatus = "not_started"
  } else {
    matchStatus = arithmeticIsLive ? "live" : "completed"
  }

  const isLive = matchStatus === "live"

  // Explicit currentInnings from match_setup wins. Only for rows written
  // before this field existed do we fall back to a guess — and even then
  // it's a guess, never treated as ground truth for new data.
  const currentInnings: 1 | 2 = setup.currentInnings ?? (hasBallData ? 2 : 1)

  // ── live-engine-only fields ──
  let winProb: { a: number; b: number } | undefined
  const { data: liveStateRow } = await supabase
    .from("match_state")
    .select("live_state")
    .eq("match_id", matchId)
    .maybeSingle()

  const liveState = liveStateRow?.live_state as { winProbA?: number; winProbB?: number } | undefined
  if (liveState?.winProbA !== undefined && liveState?.winProbB !== undefined) {
    winProb = { a: liveState.winProbA, b: liveState.winProbB }
  }

  const innings2Partial = {
    runsAtStart: 0,
    wktsAtStart: 0,
    overAtStart: "0.0",
    // Fixed: this was hardcoded to [], which meant the Overs and Graphs
    // tabs saw an empty over-by-over breakdown on the very first SSR
    // paint of a live 2nd innings, no matter how many overs had actually
    // been bowled. It now carries the real, currently aggregated
    // per-over runs for innings 2.
    overRunsAtStart: innings2Agg.overRuns,
    over19ExtraRuns: 0,
    batting: innings2Agg.batting,
    bowling: innings2Agg.bowling,
    fow: innings2Agg.fow,
  }

  const match: MatchDetail = {
    id: matchRow.id,
    tournamentSlug: resolvedTournamentSlug,
    tournamentName: resolvedTournamentName,
    round: setup.round ?? (bracketRow?.round !== undefined ? `Round ${bracketRow.round}` : ""),
    venue: setup.venue || bracketRow?.venue || "",
    date: setup.date || (bracketRow?.scheduled_at ? new Date(bracketRow.scheduled_at).toLocaleDateString() : ""),
    time: setup.time || (bracketRow?.scheduled_at ? new Date(bracketRow.scheduled_at).toLocaleTimeString() : ""),
    toss: setup.toss ?? "",
    target,
    resultNote: setup.resultNote ?? (matchStatus === "completed" ? "Match completed" : ""),
    pitch: setup.pitch ?? "",
    context: setup.context ?? "",
    officials: {
      umpires: setup.officials?.umpires ?? "",
      thirdUmpire: setup.officials?.thirdUmpire ?? "",
      referee: setup.officials?.referee ?? "",
      format: setup.officials?.format ?? `T20 · ${oversLimit} overs per side`,
    },
    teamA,
    teamB,
    innings1,
    innings2Final: innings2Agg,
    innings2Partial,
    squads: buildSquads(setup, teamA.name, teamB.name),
    matchStatus,
    isLive,
    hasBallData,
    currentInnings,
    winProb,
  }

  return { ok: true, match }
}

export async function hasMatchDetail(matchId: string): Promise<boolean> {
  const { data, error } = await supabase.from("matches").select("id").eq("id", matchId).maybeSingle()
  return !error && !!data
}