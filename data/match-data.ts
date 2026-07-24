// data/match-data.ts
//
// Match-detail data layer, backed by Supabase — no hardcoded match data.
//
// SOURCE OF TRUTH:
//   - `matches.match_setup` (jsonb)   → static config: teams, venue, date,
//                                       time, toss, pitch, context, round,
//                                       officials, squads.
//   - `balls`                        → ball-by-ball truth. Batting cards,
//                                       bowling cards, fall of wickets,
//                                       extras, and over-by-over totals are
//                                       ALL derived from this table rather
//                                       than trusted from a cached snapshot,
//                                       so completed and in-progress
//                                       matches use the exact same code path.
//   - `match_state.live_state`       → used ONLY for the handful of fields
//                                       that need actual match-engine logic
//                                       rather than arithmetic on `balls`
//                                       (e.g. win probability). Everything
//                                       else is recomputed from `balls` so
//                                       stale/missing live_state can't
//                                       desync the scorecard.
//   - `bracket_matches` + `tournaments` → optional tournament back-link.
//
// ASSUMPTIONS CALLED OUT INLINE (please verify against your real data):
//   1. `matches.match_setup` shape — see `MatchSetup` below. Adjust the
//      parsing in `parseMatchSetup` if your actual jsonb differs.
//   2. Bowler is not charged runs on `bye`/`leg_bye` extras; batter does
//      not get fours/sixes credit on any extra; wides don't count as a
//      ball faced by the batter; no-balls do. Standard scoring convention,
//      but tweak `aggregateInnings` if your rules differ.
//   3. Tournament linkage is matches → bracket_matches.overlay_match_id →
//      bracket_matches.tournament_id → tournaments.id → slugify(name).
//      Your `tournaments` table has no `slug` column, so this assumes
//      slugify(tournament.name) matches the curated slugs used in
//      site-data.ts/tournament-data.ts. If it doesn't, add a real `slug`
//      column to `tournaments` and swap the `.select` below to use it.

import { supabase } from "@/lib/supabase"
import { slugify } from "@/data/site-data"

// ─────────────────────────────────────────────────────────────
// PUBLIC TYPES (unchanged shape — MatchDetailClient doesn't need to care
// that this data now comes from Supabase instead of a static object)
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

export interface MatchDetail {
  id: string
  tournamentSlug?: string
  tournamentName?: string
  round: string
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
  teamA: { id: string; name: string; short: string }
  teamB: { id: string; name: string; short: string }
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
  /** true while innings 2 hasn't reached its final recorded ball yet */
  isLive: boolean
  /** From match_state.live_state, when the engine populates it. Everything
   *  else on this object is derived from `balls`, not from this blob. */
  winProb?: { a: number; b: number }
}

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

/**
 * Expected shape of `matches.match_setup`. This is a guess based on what
 * the UI needs and what isn't already covered by dedicated columns
 * elsewhere in the schema — confirm against how your match-setup flow
 * actually writes this jsonb, and adjust `parseMatchSetup` if it differs.
 */
interface MatchSetup {
  teamAId: string
  teamBId: string
  round?: string
  venue?: string
  date?: string
  time?: string
  toss?: string
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
  extra_type: string | null // 'wide' | 'no_ball' | 'bye' | 'leg_bye' | 'penalty' | null
  is_wicket: boolean
  dismissal_type: string | null
  batsman_out: string | null
  fielder: string | null
}

interface TeamRow {
  id: string
  name: string
  code: string
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

    // ── team total / extras ──
    teamTotal += row.runs
    if (row.extra_type) {
      extrasTotal += row.runs
      if (isWide) extrasByType.wd += row.runs
      else if (isNoBall) extrasByType.nb += row.runs
      else if (isBye) extrasByType.b += row.runs
      else if (isLegBye) extrasByType.lb += row.runs
      else extrasByType.p += row.runs
    }

    // ── batter ──
    if (!batting.has(striker)) {
      batting.set(striker, { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, how: "", order: battingOrder++ })
    }
    const bat = batting.get(striker)!
    // Wides aren't faced by the batter; no-balls are.
    if (!isWide) bat.balls += 1
    // Byes/leg-byes/wides/no-ball-extra-runs aren't credited to the batter's
    // run tally — only genuine bat-off runs are (approximated here as "no
    // extra_type at all", which misses runs scored off a no-ball bat
    // contact; adjust if your `balls` rows separate bat-runs from
    // no-ball-runs explicitly).
    if (!row.extra_type) {
      bat.runs += row.runs
      if (row.runs === 4) bat.fours += 1
      if (row.runs === 6) bat.sixes += 1
    }

    // ── bowler ──
    if (!bowling.has(bowler)) {
      bowling.set(bowler, { legalBalls: 0, runs: 0, wkts: 0, order: bowlingOrder++ })
    }
    const bowl = bowling.get(bowler)!
    if (isLegal) bowl.legalBalls += 1
    // Byes/leg-byes aren't charged against the bowler's runs conceded.
    if (!isBye && !isLegBye) bowl.runs += row.runs

    // ── wicket ──
    if (row.is_wicket) {
      teamWkts += 1
      bat.out = true
      const dismissalText = row.dismissal_type
        ? `${row.dismissal_type}${row.fielder ? ` (${row.fielder})` : ""}`
        : "out"
      bat.how = dismissalText
      // Run-outs aren't credited to the bowler.
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
function parseMatchSetup(raw: unknown): MatchSetup | null {
  if (!raw || typeof raw !== "object") return null
  const setup = raw as Partial<MatchSetup>
  if (!setup.teamAId || !setup.teamBId) return null
  return setup as MatchSetup
}

function buildSquads(setup: MatchSetup, teamA: TeamRow, teamB: TeamRow): MatchSquad[] {
  if (!setup.squads || setup.squads.length === 0) return []
  return setup.squads.map((s) => {
    const team = s.teamId === teamA.id ? teamA : s.teamId === teamB.id ? teamB : null
    return {
      team: team?.name ?? "Unknown Team",
      captain: s.captain,
      players: s.players.map((p) => ({ name: p.name, role: p.role, xi: p.xi })),
    }
  })
}

/**
 * Fetch a single match and assemble it into the `MatchDetail` shape the
 * client component expects. Returns null if the match doesn't exist, or
 * (when `tournamentSlug` is passed) if it exists but doesn't belong to
 * that tournament.
 *
 * Pass no `tournamentSlug` for the standalone `/match/[matchId]` route —
 * any match resolves there, tournament-linked or not (friendlies included).
 */
export async function getMatchDetailById(
  matchId: string,
  tournamentSlug?: string
): Promise<MatchDetail | null> {
  const { data: matchRow, error: matchErr } = await supabase
    .from("matches")
    .select("id, match_setup")
    .eq("id", matchId)
    .maybeSingle()

  if (matchErr || !matchRow) return null

  const setup = parseMatchSetup(matchRow.match_setup)
  if (!setup) return null

  const { data: teamRows, error: teamErr } = await supabase
    .from("teams")
    .select("id, name, code")
    .in("id", [setup.teamAId, setup.teamBId])

  if (teamErr || !teamRows || teamRows.length < 2) return null
  const teamA = teamRows.find((t) => t.id === setup.teamAId) as TeamRow
  const teamB = teamRows.find((t) => t.id === setup.teamBId) as TeamRow

  // ── optional tournament linkage ──
  let resolvedTournamentSlug: string | undefined
  let resolvedTournamentName: string | undefined

  const { data: bracketRow } = await supabase
    .from("bracket_matches")
    .select("tournament_id")
    .eq("overlay_match_id", matchId)
    .maybeSingle()

  if (bracketRow?.tournament_id) {
    const { data: tournamentRow } = await supabase
      .from("tournaments")
      .select("name")
      .eq("id", bracketRow.tournament_id)
      .maybeSingle()

    if (tournamentRow?.name) {
      resolvedTournamentName = tournamentRow.name
      resolvedTournamentSlug = slugify(tournamentRow.name)
    }
  }

  if (tournamentSlug !== undefined) {
    if (!resolvedTournamentSlug || resolvedTournamentSlug !== slugify(tournamentSlug)) {
      return null
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

  if (ballErr) return null

  const innings1Balls = (ballRows ?? []).filter((b) => b.innings_number === 1)
  const innings2Balls = (ballRows ?? []).filter((b) => b.innings_number === 2)

  const innings1 = aggregateInnings(innings1Balls)
  const innings2Agg = aggregateInnings(innings2Balls)

  const target = setup.target ?? innings1.total + 1
  // 20-over T20 assumed for "is this innings finished" — adjust if you
  // support other formats (overs limit isn't in match_setup above; add a
  // field there if it varies per match).
  const oversLimit = 20
  const [innings2OversNum, innings2BallsNum] = innings2Agg.overs.split(".").map(Number)
  const innings2LegalBalls = innings2OversNum * 6 + innings2BallsNum
  const isLive =
    innings2LegalBalls < oversLimit * 6 &&
    innings2Agg.wkts < 10 &&
    !(innings2Agg.total >= target && target > 0)

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

  // ── innings2Partial: same aggregated data, kept as its own field to
  // match the existing MatchDetailClient prop shape (it renders this while
  // `isLive` is true, and innings2Final once the match is done) ──
  const innings2Partial = {
    runsAtStart: 0,
    wktsAtStart: 0,
    overAtStart: "0.0",
    overRunsAtStart: [] as number[],
    over19ExtraRuns: 0,
    batting: innings2Agg.batting,
    bowling: innings2Agg.bowling,
    fow: innings2Agg.fow,
  }

  return {
    id: matchRow.id,
    tournamentSlug: resolvedTournamentSlug,
    tournamentName: resolvedTournamentName,
    round: setup.round ?? "",
    venue: setup.venue ?? "",
    date: setup.date ?? "",
    time: setup.time ?? "",
    toss: setup.toss ?? "",
    target,
    resultNote: setup.resultNote ?? (isLive ? "" : "Match completed"),
    pitch: setup.pitch ?? "",
    context: setup.context ?? "",
    officials: {
      umpires: setup.officials?.umpires ?? "",
      thirdUmpire: setup.officials?.thirdUmpire ?? "",
      referee: setup.officials?.referee ?? "",
      format: setup.officials?.format ?? "T20 · 20 overs per side",
    },
    teamA: { id: teamA.id, name: teamA.name, short: teamA.code },
    teamB: { id: teamB.id, name: teamB.name, short: teamB.code },
    innings1,
    innings2Final: innings2Agg,
    innings2Partial,
    squads: buildSquads(setup, teamA, teamB),
    isLive,
    winProb,
  }
}

export async function hasMatchDetail(matchId: string): Promise<boolean> {
  const { data, error } = await supabase.from("matches").select("id").eq("id", matchId).maybeSingle()
  return !error && !!data
}