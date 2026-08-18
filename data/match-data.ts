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
//
// TEAM LOGO/COLOR (STANDALONE MATCHES):
//   `match_setup.team1` / `team2` can carry `logo` / `color` — written by
//   the Match Editor's Details section (see the ImageUploadField/
//   ColorInput fields there, and toRawSetup's
//   `team1: { name, short, logo, color }` on save). Previously
//   `MatchSetupTeam` only declared `name`/`short`, so these were invisible
//   to the fallback teamA/teamB construction below — meaning standalone
//   matches (no bracket_matches row) never showed a team logo/color no
//   matter what was saved in the editor, even though bracket-linked
//   matches (which resolve teamA/teamB from the real `teams` table
//   instead) worked fine. Both are now read through.
//
// MATCH BANNER FALLBACK:
//   `tournamentLogoUrl` (the match hero banner) previously fell back to
//   `bracketRow?.tournament_id` when the match itself had no banner set
//   — a raw UUID, not an image URL, which rendered as a broken image.
//   It now falls back to the tournament's own banner (`image_url`),
//   then its logo (`logo_url`), then finally `undefined` so the hero's
//   own "not available" placeholder background kicks in — see
//   resolvedTournamentBannerUrl below.
//
// BALL-BY-BALL DELIVERIES (additive):
//   Batting/bowling cards, fall-of-wickets, and per-over totals were
//   already derived from `balls`, but the individual deliveries
//   themselves were discarded after aggregation — the Overs tab could
//   only ever show a per-over run total plus a "W" chip for any wicket
//   that fell in that over, never the actual ball-by-ball sequence
//   (dot, 1, 4, 6, wd, nb...). `InningsComplete.deliveries` (and the
//   matching field on `innings2Partial`) now carries that raw sequence
//   through, in the same over_number/ball_number shape the `balls`
//   table already stores. It's optional so nothing that builds an
//   `InningsComplete`-shaped object elsewhere (e.g. the live-match hook,
//   if it doesn't go through aggregateInnings) is required to supply
//   it — callers that don't have it just fall back to the old
//   wicket-only chip display.
//
// COMMENTARY PLAYER CONTEXT (additive):
//   DeliveryEntry now also carries striker/nonStriker/bowler names plus
//   dismissal detail (dismissalType/batsmanOut/fielder). This is what
//   lets the Groq-generated commentary say "Kumar strikes, castles
//   Sharma" instead of just "a wicket fell" — see
//   hooks/use-ball-commentary.ts and app/api/commentary/generate.
//   These fields were already present on the raw `balls` row; this just
//   stops them being discarded during aggregation.
//
// TOURNAMENT STATS — MATCH RESOLUTION (fixed):
//   getTournamentStats previously ran three parallel queries to resolve
//   which matches belong to a tournament, including a direct
//   `matches.tournament_id = tournamentId` filter. Per the SOURCE OF
//   TRUTH note above, `matches` has NO real tournament_id column —
//   the only place a tournament link lives on a standalone match row is
//   inside `match_setup.tournamentId` (JSON). Querying a non-existent
//   column doesn't throw in a way that surfaces obviously; Supabase/PostgREST
//   returns an error object, which the code only console.error'd and
//   continued past — so it silently ran (and failed) on every call. That
//   query is removed. Match resolution now relies on the two real paths:
//   the `match_setup->>tournamentId` JSON filter, and `bracket_matches`.
//
// TOURNAMENT STATS — PLAYER PHOTOS + PER-MATCH BREAKDOWN (additive):
//   `balls.striker_name` / `balls.bowler_name` are plain text, not FKs,
//   so the original aggregation had no route to a player photo at all —
//   PlayerStatRow/BowlingStatRow simply didn't carry one, and the UI's
//   "avatar" was always just initials. getTournamentStats now does a
//   best-effort name lookup against `players` (falling back to
//   `player_bank`, same two-table fallback buildSquads already uses for
//   Squads) and attaches `img` to each row when a match is found by
//   name. This is inherently fuzzy — two different players who share an
//   exact display name will collide — but it's the only signal
//   available without turning `balls` into a real FK table.
//
//   Separately, aggregation used to fold every ball across every match
//   into one tournament-wide total and discard `match_id` in the
//   process, so there was no way to see "how did this player do in just
//   THIS match" after the fact. getTournamentStats now also aggregates
//   per match (same logic, scoped to that match's balls) and returns
//   `matches` (id + display label per match) plus
//   `battingStatsByMatch` / `bowlingStatsByMatch` keyed by match id, so
//   a caller can offer a match filter without a second round-trip.
//
// SQUAD RESOLUTION (fixed, then unified with the tournament page):
//   buildSquads() previously matched `match_setup.squads[].teamId`
//   against only three candidates: the literal strings "team1"/"team2",
//   `match_setup.team{1,2}.short`, and the team's display name. For a
//   bracket-linked match, the ONLY real team identity is `teams.id` (a
//   UUID) — resolved via `bracket_matches.team_a_id`/`team_b_id` — and
//   that UUID is very likely what got written into `match_setup.squads[].teamId`
//   at save time, since it's the identity the rest of the system treats
//   as canonical for a bracket match. None of the three old candidates
//   ever matched a UUID, so the squad silently fell through to
//   "Unknown Team" every time, with no error surfaced.
//
//   That's now moot for bracket-linked matches: rather than trying to
//   parse match_setup.squads[].teamId at all, buildSquads calls
//   getSquadsByTeamIds (lib/tournament/tournament.ts) with the two
//   resolved teams.id UUIDs — the EXACT same teams -> players -> rules ->
//   buildSquad pipeline the tournament detail page's Squads tab uses.
//   This is what keeps a team's squad identical whether it's viewed from
//   the tournament page or from one of that team's individual match
//   pages, instead of maintaining two resolutions of the same data that
//   could silently drift apart.
//
//   For STANDALONE matches (no bracket_matches row), there is no
//   tournament-level squad source to point at — teamA.id/teamB.id are
//   just short codes, not real teams.id values — so those still resolve
//   squads the original way:
//     1. buildSquads matches match_setup.squads[].teamId against the
//        resolved teamA.id/teamB.id first, then falls back to
//        "team1"/"team2", match_setup.team{1,2}.short, and the team's
//        display name. If none of those match, it falls back to array
//        position (match_setup.squads is always written as exactly two
//        squads, so squads[0] = teamA, squads[1] = teamB) instead of
//        labeling the team "Unknown Team".
//     2. If match_setup.squads is missing entirely, OR a resolved squad
//        has zero players (empty array / upstream field-name mismatch),
//        buildSquads falls back to the auction roster itself —
//        `players` rows where `sold_to_team_id` matches the team's real
//        UUID (only meaningful for bracket-linked matches, since that's
//        the only case where teamA.id/teamB.id are genuine teams.id
//        values — for standalone matches this fallback correctly
//        produces nothing).

import { supabase } from "@/lib/supabase"
import { slugify } from "@/data/site-data"
import { getSquadsByTeamIds } from "@/lib/tournament/tournament"
import type { Squad } from "@/data/tournament-data"

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

/**
 * A single delivery, straight from `balls` (one row per ball). Kept
 * deliberately close to the DB row shape rather than pre-formatted, so
 * the UI layer decides how to label/style each ball (dot, boundary,
 * wide, wicket, ...), and so downstream consumers (like the Groq
 * commentary generator) have everything they need without a second
 * fetch.
 *
 *   over          — over number, matching the same 1-indexed convention
 *                    already used by InningsComplete.overRuns / the Overs tab.
 *   ball          — ball number within that over, as stored on the row.
 *   runs          — total runs on this delivery (bat + extra runs combined,
 *                    same as `balls.runs`).
 *   extraType     — null for a normal delivery; otherwise "wide",
 *                    "no_ball", "bye", "leg_bye", or whatever `balls.extra_type`
 *                    holds.
 *   isWicket      — whether this delivery produced a dismissal.
 *   striker       — batter facing this delivery.
 *   nonStriker    — batter at the other end.
 *   bowler        — bowler of this delivery.
 *   dismissalType — e.g. "bowled", "caught", "run_out" (only meaningful when isWicket).
 *   batsmanOut    — who was actually dismissed (usually striker, but not
 *                    always — e.g. a non-striker run out).
 *   fielder       — fielder involved in the dismissal, if any.
 */
export interface DeliveryEntry {
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

export interface MatchSquad {
  team: string
  captain: string
  players: { name: string; role: string; xi: boolean; img?: string }[]
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
  /** Full ball-by-ball sequence for this innings, when available — see
   *  the BALL-BY-BALL DELIVERIES note above. Optional/additive: existing
   *  code paths that only read overRuns/fow/etc. are unaffected. */
  deliveries?: DeliveryEntry[]
  dnb?: string[]
  potm?: { name: string; note: string }
}

export interface MatchTeamRef {
  /** Real teams.id when resolved via bracket_matches; otherwise the short code. */
  id: string
  name: string
  short: string
  /** Populated either via bracket_matches → teams, or from the embedded
   *  match_setup.team1/team2 fallback (standalone matches). */
  logo?: string
  color?: string
}

export type MatchStatus = "not_started" | "live" | "completed"

export interface MatchDetail {
  id: string
  tournamentSlug?: string
  tournamentName?: string
  round: string
  tournamentId?: string
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
    /** Same as InningsComplete.deliveries — the live 2nd-innings ball
     *  sequence so far. Optional/additive, see BALL-BY-BALL DELIVERIES
     *  note above. */
    deliveries?: DeliveryEntry[]
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
  /** Match's own banner if set, else the parent tournament's banner/logo
   *  as a fallback — see MATCH BANNER FALLBACK note above. */
  tournamentLogoUrl?: string
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
  img?: string
}

interface MatchSetupSquad {
  teamId: string
  captain: string
  players: MatchSetupSquadPlayer[]
}

interface MatchSetupTeam {
  name: string
  short: string
  /** Written by the Match Editor's team logo upload (ImageUploadField)
   *  and color picker for standalone matches — see toRawSetup's
   *  `team1: { name, short, logo, color }` on save. Optional since older
   *  rows / auction-seeded matches may not have set these directly here
   *  (auction-seeded ones are usually superseded by the bracket_matches
   *  → teams lookup anyway). */
  logo?: string
  color?: string
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
  /** Set by the Match Editor's banner upload field — see toRawSetup. */
  tournamentLogoUrl?: string
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
  matchNumber: number | null
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
  // Raw per-delivery log, in play order — see DeliveryEntry / the
  // BALL-BY-BALL DELIVERIES note at the top of this file.
  const deliveries: DeliveryEntry[] = []

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

    deliveries.push({
      over: row.over_number,
      ball: row.ball_number,
      runs: row.runs,
      extraType: row.extra_type,
      isWicket: row.is_wicket,
      striker: row.striker_name,
      nonStriker: row.non_striker_name,
      bowler: row.bowler_name,
      dismissalType: row.dismissal_type,
      batsmanOut: row.batsman_out,
      fielder: row.fielder,
    })
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
    deliveries,
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

/**
 * Converts one tournament-shaped Squad (from
 * lib/tournament/tournament.ts's getSquadsByTeamIds — the same object
 * shape the tournament detail page's Squads tab renders) into this
 * file's MatchSquad shape.
 *
 * There's no playing-XI concept at the teams/players source level (see
 * buildSquad in lib/tournament/tournament.ts — every rostered player is
 * just "on the team", full stop), so every player here is marked
 * xi: true, same trade-off buildSquadsFromAuctionRoster below already
 * made for its own auction-roster fallback.
 */
function squadToMatchSquad(s: Squad): MatchSquad {
  return {
    team: s.team,
    captain: s.captain,
    players: (s.players ?? []).map((p) => ({
      name: p.name,
      role: p.role ?? "",
      xi: true,
      img: p.image,
    })),
  }
}

/**
 * Fallback squad source, used when `match_setup.squads` is missing
 * entirely, or a resolved squad ends up with zero players. Pulls the
 * real auction roster straight from `players.sold_to_team_id`.
 *
 * IMPORTANT: this only produces real data for BRACKET-LINKED matches,
 * where teamAId/teamBId are genuine `teams.id` UUIDs (resolved via
 * `bracket_matches.team_a_id`/`team_b_id` in getMatchDetailById). For
 * standalone matches, teamAId/teamBId are just short codes (e.g. "KBG"),
 * which won't match any `players.sold_to_team_id` row — in that case
 * this correctly returns empty squads, since there genuinely is no
 * auction roster to fall back to.
 *
 * Because this is the auction roster rather than a per-match selection,
 * there's no concept of "captain" or "playing XI vs bench" at this
 * level — every rostered player is marked `xi: true` so the whole squad
 * still renders under "Playing XI" rather than silently vanishing into
 * an empty bench section.
 */
async function buildSquadsFromAuctionRoster(
  teamAId: string,
  teamAName: string,
  teamBId: string,
  teamBName: string,
): Promise<MatchSquad[]> {
  const { data: rosterRows, error } = await supabase
    .from("players")
    .select("id, name, role, img, sold_to_team_id")
    .in("sold_to_team_id", [teamAId, teamBId])

  if (error) {
    console.error("[buildSquadsFromAuctionRoster] roster lookup failed:", error.message)
    return []
  }
  if (!rosterRows || rosterRows.length === 0) return []

  const toSquad = (teamId: string, teamName: string): MatchSquad => ({
    team: teamName,
    captain: "",
    players: rosterRows
      .filter((p) => p.sold_to_team_id === teamId)
      .map((p) => ({
        name: p.name,
        role: p.role,
        xi: true,
        img: p.img || undefined,
      })),
  })

  return [toSquad(teamAId, teamAName), toSquad(teamBId, teamBName)]
}

/**
 * Resolves the two squads for a match.
 *
 * BRACKET-LINKED matches (isBracketLinked === true, i.e. teamAId/teamBId
 * are real `teams.id` UUIDs resolved via `bracket_matches.team_a_id` /
 * `team_b_id`): squads are pulled from getSquadsByTeamIds — the EXACT
 * same teams -> players -> rules -> buildSquad pipeline
 * lib/tournament/tournament.ts uses for the tournament detail page's
 * Squads tab. This is the change described in the SQUAD RESOLUTION note
 * at the top of this file: rather than trying to parse
 * match_setup.squads[].teamId (which for bracket matches is very likely
 * a UUID nothing here used to check against directly), this goes
 * straight to the shared source of truth by team id. If that shared
 * source comes back empty (e.g. a team not yet linked to any auction
 * roster), this falls through to the original match_setup-based
 * resolution below rather than showing nothing.
 *
 * STANDALONE matches (no bracket_matches row): there is no
 * tournament-level squad source to point at, since teamAId/teamBId are
 * just short codes here, not real teams.id values. These always use the
 * original match_setup.squads resolution.
 */
async function buildSquads(
  setup: MatchSetup,
  teamAId: string,
  teamAName: string,
  teamBId: string,
  teamBName: string,
  isBracketLinked: boolean,
): Promise<MatchSquad[]> {
  if (isBracketLinked) {
    const tournamentSquads = await getSquadsByTeamIds([teamAId, teamBId])
    if (tournamentSquads.length > 0) {
      const squadByTeamName = new Map(tournamentSquads.map((s) => [s.team, s]))
      const teamASquad = squadByTeamName.get(teamAName)
      const teamBSquad = squadByTeamName.get(teamBName)
      return [
        teamASquad ? squadToMatchSquad(teamASquad) : { team: teamAName, captain: "", players: [] },
        teamBSquad ? squadToMatchSquad(teamBSquad) : { team: teamBName, captain: "", players: [] },
      ]
    }
    // Shared source came back empty (e.g. these teams.id values aren't
    // linked to any auction roster yet) — fall through to the
    // match_setup-based resolution below rather than showing nothing.
  }

  // No match_setup.squads at all — go straight to the auction-roster
  // fallback (see SQUAD RESOLUTION note at the top of this file).
  if (!setup.squads || setup.squads.length === 0) {
    return buildSquadsFromAuctionRoster(teamAId, teamAName, teamBId, teamBName)
  }

  // Collect all playerIds from all squads
  const playerIds = new Set<string>()
  setup.squads.forEach((s) => {
    s.players?.forEach((p) => {
      if (p.playerId) playerIds.add(p.playerId)
    })
  })

  // Fetch player data (including images) from the players table, with fallback to player_bank
  const playerMap = new Map<string, { name: string; img?: string }>()
  if (playerIds.size > 0) {
    // First try players table
    const { data: playerRows, error } = await supabase
      .from("players")
      .select("id, name, img")
      .in("id", Array.from(playerIds))

    playerRows?.forEach((p) => {
      playerMap.set(p.id, { name: p.name, img: p.img || undefined })
    })

    // For players without images, try to get from player_bank by name
    const missingPlayers = Array.from(playerIds).filter((id) => {
      const mapped = playerMap.get(id)
      return !mapped?.img
    })

    if (missingPlayers.length > 0) {
      // Get player names first
      const playerNames: { [key: string]: string } = {}
      playerRows?.forEach((p) => {
        playerNames[p.id] = p.name
      })

      // Query player_bank by names
      const namesToSearch = Object.values(playerNames)
      if (namesToSearch.length > 0) {
        const { data: bankPlayers } = await supabase
          .from("player_bank")
          .select("name, img")
          .in("name", namesToSearch)
          .limit(100)

        const bankByName = new Map(bankPlayers?.map((p: any) => [p.name, p.img]))

        // Update player map with images from player_bank
        missingPlayers.forEach((id) => {
          const playerData = playerMap.get(id)
          if (playerData) {
            const bankImg = bankByName.get(playerData.name)
            if (bankImg) {
              playerData.img = bankImg
            }
          }
        })
      }
    }
  }

  // Build squads with enriched player data.
  //
  // Matching now checks against the REAL resolved team id first
  // (teamAId/teamBId — a genuine teams.id UUID for bracket-linked
  // matches, or the short code for standalone matches), before falling
  // back to the older "team1"/"team2" tag / short / name checks. See the
  // SQUAD RESOLUTION note at the top of this file for why the UUID
  // check has to come first: for bracket matches it's very likely the
  // ONLY thing squad.teamId actually contains. (In practice, bracket
  // matches will usually already have returned above via
  // getSquadsByTeamIds — this path mainly matters for standalone
  // matches, or as a fallback if the shared source had nothing yet.)
  const squadsSource = setup.squads
  const squads: MatchSquad[] = squadsSource.map((s, index) => {
    const tag = s.teamId?.toLowerCase?.() ?? ""
    const isTeamA =
      tag === teamAId.toLowerCase() ||
      tag === "team1" ||
      tag === setup.team1.short.toLowerCase() ||
      tag === teamAName.toLowerCase()
    const isTeamB =
      tag === teamBId.toLowerCase() ||
      tag === "team2" ||
      tag === setup.team2.short.toLowerCase() ||
      tag === teamBName.toLowerCase()

    // Last-resort fallback: match_setup.squads is always written as
    // exactly two squads in array order [teamA, teamB]. If the teamId
    // tag matches neither known identity, use position instead of
    // labeling the team "Unknown Team" — this keeps the UI honest
    // (showing the real team name) even when the tag itself is
    // unrecognized/malformed.
    const teamName = isTeamA ? teamAName : isTeamB ? teamBName : index === 0 ? teamAName : teamBName

    return {
      team: teamName,
      captain: s.captain,
      players:
        s.players?.map((p) => {
          const playerData = p.playerId ? playerMap.get(p.playerId) : null
          return {
            name: playerData?.name || p.name,
            role: p.role,
            xi: p.xi,
            img: playerData?.img || p.img || undefined,
          }
        }) || [],
    }
  })

  // Per-squad fallback: a squad may have resolved a correct team name
  // above but still have zero players — either match_setup.squads[].players
  // was saved as an empty array, or whatever wrote it used different
  // field names than this reader expects. Rather than showing an empty
  // "Playing XI" for that team, backfill from the auction roster.
  const anyEmpty = squads.some((sq) => sq.players.length === 0)
  if (!anyEmpty) return squads

  const rosterFallback = await buildSquadsFromAuctionRoster(teamAId, teamAName, teamBId, teamBName)
  if (rosterFallback.length === 0) return squads // nothing to backfill with (e.g. standalone match)

  return squads.map((sq, i) => (sq.players.length > 0 ? sq : rosterFallback[i] ?? sq))
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
  // Tournament's own banner/logo — used as a fallback for the match hero
  // when the match itself has no tournamentLogoUrl set (see MATCH
  // BANNER FALLBACK note at the top of this file).
  let resolvedTournamentBannerUrl: string | undefined
  const tournamentIdToResolve = bracketRow?.tournament_id ?? setup.tournamentId

  if (tournamentIdToResolve) {
    const { data: tournamentRow } = await supabase
      .from("tournaments")
      .select("name, image_url, logo_url")
      .eq("id", tournamentIdToResolve)
      .maybeSingle()

    if (tournamentRow?.name) {
      resolvedTournamentName = tournamentRow.name
      resolvedTournamentSlug = slugify(tournamentRow.name)
    }
    // Prefer the tournament's banner image; fall back to its logo if no
    // banner was ever set, so the match hero still shows *something*
    // tournament-branded rather than nothing.
    resolvedTournamentBannerUrl = tournamentRow?.image_url || tournamentRow?.logo_url || undefined
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
  //    fall back to the embedded match_setup.team1/team2 (this is the
  //    ONLY path standalone/friendly matches ever take, since they have
  //    no bracket_matches row at all — so logo/color here now come
  //    straight from what the Match Editor saved into match_setup). ──
  let teamA: MatchTeamRef = {
    id: setup.team1.short,
    name: setup.team1.name,
    short: setup.team1.short,
    logo: setup.team1.logo || undefined,
    color: setup.team1.color || undefined,
  }
  let teamB: MatchTeamRef = {
    id: setup.team2.short,
    name: setup.team2.name,
    short: setup.team2.short,
    logo: setup.team2.logo || undefined,
    color: setup.team2.color || undefined,
  }

  // Whether teamA/teamB below end up resolved from bracket_matches ->
  // teams (real teams.id UUIDs) rather than the match_setup fallback
  // (short codes) — also drives which squad source buildSquads uses,
  // see the SQUAD RESOLUTION note at the top of this file.
  const isBracketLinked = !!(bracketRow?.team_a_id && bracketRow?.team_b_id)

  if (isBracketLinked) {
    const { data: teamRows } = await supabase
      .from("teams")
      .select("id, name, code, logo, color")
      .in("id", [bracketRow!.team_a_id, bracketRow!.team_b_id])

    const teamARow = teamRows?.find((t) => t.id === bracketRow!.team_a_id) as TeamRow | undefined
    const teamBRow = teamRows?.find((t) => t.id === bracketRow!.team_b_id) as TeamRow | undefined

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
    // Raw ball-by-ball log for the live 2nd innings — see BALL-BY-BALL
    // DELIVERIES note at the top of this file.
    deliveries: innings2Agg.deliveries,
  }

  // See SQUAD RESOLUTION note at the top of this file: for bracket-linked
  // matches, buildSquads now goes straight to getSquadsByTeamIds — the
  // same source lib/tournament/tournament.ts uses for the tournament
  // page's Squads tab — using the resolved teamA.id/teamB.id (real
  // teams.id UUIDs). Standalone matches fall back to the original
  // match_setup.squads resolution, since there's no tournament-level
  // squad source to point at for them.
  const squads = await buildSquads(setup, teamA.id, teamA.name, teamB.id, teamB.name, isBracketLinked)

  // Match's own banner first; otherwise the parent tournament's banner
  // or logo (resolvedTournamentBannerUrl); otherwise undefined so the
  // hero section's own "not available" placeholder background is used
  // instead of a broken image src (this used to fall back to
  // bracketRow?.tournament_id — a raw UUID, not an image URL).
  const tournamentLogoUrl = setup.tournamentLogoUrl || resolvedTournamentBannerUrl || undefined

  const match: MatchDetail = {
    id: matchRow.id,
    tournamentSlug: resolvedTournamentSlug,
    tournamentName: resolvedTournamentName,
    tournamentId: tournamentIdToResolve,
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
    squads,
    matchStatus,
    isLive,
    hasBallData,
    currentInnings,
    winProb,
    tournamentLogoUrl,
  }
  return { ok: true, match }
}

export async function hasMatchDetail(matchId: string): Promise<boolean> {
  const { data, error } = await supabase.from("matches").select("id").eq("id", matchId).maybeSingle()
  return !error && !!data
}

// ─────────────────────────────────────────────────────────────
// TOURNAMENT STATS — series-wide leaderboards for the Stats tab,
// PLUS a per-match breakdown and best-effort player photos.
//
// Match resolution: two real paths only (see the TOURNAMENT STATS —
// MATCH RESOLUTION note at the top of this file for why the third,
// `matches.tournament_id`, was removed):
//   1. `match_setup->>tournamentId` — standalone matches whose only link
//      to a tournament lives inside the match_setup JSON.
//   2. `bracket_matches.tournament_id` — bracket-linked matches, real FK.
// ─────────────────────────────────────────────────────────────
export interface PlayerStatRow {
  player: string
  matches: number
  inns: number
  runs: number
  avg: number | null
  sr: number
  fours: number
  sixes: number
  /** Best-effort photo, resolved by name against `players` then
   *  `player_bank` — see the PLAYER PHOTOS note at the top of this
   *  file. Undefined when no match was found (falls back to an
   *  initials avatar in the UI). */
  img?: string
}

export interface BowlingStatRow {
  player: string
  matches: number
  inns: number
  wkts: number
  avg: number | null
  econ: number
  best: string
  /** See PlayerStatRow.img. */
  img?: string
}

/** One match that contributed to a tournament's stats — used to power
 *  a match filter on the Stats tab without a second round-trip. */
export interface MatchStatSummary {
  id: string
  /** Human-readable label, e.g. "Valiant Originals vs Desert Hawks · 16 Jul". */
  label: string
  date?: string
}

interface TournamentStats {
  battingStats: PlayerStatRow[]
  bowlingStats: BowlingStatRow[]
  /** Every match that contributed at least one ball to these stats,
   *  for a match-filter UI. Empty if there's no ball data yet. */
  matches: MatchStatSummary[]
  /** Same shape as battingStats/bowlingStats, but scoped to a single
   *  match — keyed by match id. Use `matches` to build a picker, then
   *  index into this (falling back to the tournament-wide arrays above
   *  for an "All matches" option). */
  battingStatsByMatch: Record<string, PlayerStatRow[]>
  bowlingStatsByMatch: Record<string, BowlingStatRow[]>
}

/** Minimal ball shape the aggregation helper actually needs — a subset
 *  of the full `balls` row, shared by both the tournament-wide and the
 *  per-match aggregation passes below. */
interface StatsBallRow {
  match_id: string
  sequence: number
  striker_name: string | null
  bowler_name: string | null
  runs: number
  extra_type: string | null
  is_wicket: boolean
  dismissal_type: string | null
}

/**
 * Aggregates a set of balls (any subset — tournament-wide or scoped to
 * one match) into batting/bowling stat rows. Factored out of
 * getTournamentStats so the exact same logic runs once for the overall
 * totals and once per match, instead of two hand-maintained copies.
 * Does not attach `img` — that's resolved once, afterward, against the
 * full set of names seen across every pass (see getTournamentStats).
 */
function aggregatePlayerStats(rows: StatsBallRow[]): {
  battingStats: Omit<PlayerStatRow, "img">[]
  bowlingStats: Omit<BowlingStatRow, "img">[]
} {
  type BatAcc = {
    matches: Set<string>
    innings: Set<string>
    runs: number
    balls: number
    fours: number
    sixes: number
    dismissals: number
  }
  type BowlAcc = {
    matches: Set<string>
    innings: Set<string>
    legalBalls: number
    runs: number
    wkts: number
    bestWkts: number
    bestRuns: number
  }

  const batting = new Map<string, BatAcc>()
  const bowling = new Map<string, BowlAcc>()
  const bowlerInningsFigures = new Map<string, { wkts: number; runs: number }>()

  for (const row of rows) {
    const striker = row.striker_name ?? "Unknown"
    const bowler = row.bowler_name ?? "Unknown"
    const isWide = row.extra_type === "wide"
    const isNoBall = row.extra_type === "no_ball"
    const isBye = row.extra_type === "bye"
    const isLegBye = row.extra_type === "leg_bye"
    const isLegal = !isWide && !isNoBall
    // NOTE: without innings_number in StatsBallRow we can't split
    // multi-innings-per-match figures apart here; that's fine for the
    // tournament-wide pass (innings_number was already dropped by the
    // caller's select before this refactor too) but see
    // getTournamentStats for the real query, which DOES select
    // innings_number and folds it into this key.
    const inningsKey = `${row.match_id}-${(row as any).innings_number ?? 1}`

    if (!batting.has(striker)) {
      batting.set(striker, {
        matches: new Set(),
        innings: new Set(),
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        dismissals: 0,
      })
    }
    const bat = batting.get(striker)!
    bat.matches.add(row.match_id)
    bat.innings.add(inningsKey)
    if (!isWide) bat.balls += 1
    if (!row.extra_type) {
      bat.runs += row.runs
      if (row.runs === 4) bat.fours += 1
      if (row.runs === 6) bat.sixes += 1
    }
    if (row.is_wicket) bat.dismissals += 1

    if (!bowling.has(bowler)) {
      bowling.set(bowler, {
        matches: new Set(),
        innings: new Set(),
        legalBalls: 0,
        runs: 0,
        wkts: 0,
        bestWkts: 0,
        bestRuns: 0,
      })
    }
    const bowl = bowling.get(bowler)!
    bowl.matches.add(row.match_id)
    bowl.innings.add(inningsKey)
    if (isLegal) bowl.legalBalls += 1
    if (!isBye && !isLegBye) bowl.runs += row.runs
    if (row.is_wicket && row.dismissal_type !== "run_out") bowl.wkts += 1

    const figKey = `${bowler}__${inningsKey}`
    if (!bowlerInningsFigures.has(figKey)) {
      bowlerInningsFigures.set(figKey, { wkts: 0, runs: 0 })
    }
    const fig = bowlerInningsFigures.get(figKey)!
    if (!isBye && !isLegBye) fig.runs += row.runs
    if (row.is_wicket && row.dismissal_type !== "run_out") fig.wkts += 1
  }

  // Roll bowlerInningsFigures up into each bowler's best-figures.
  // "Best" = most wickets, ties broken by fewest runs conceded.
  for (const [figKey, fig] of bowlerInningsFigures) {
    const bowlerName = figKey.split("__")[0]
    const bowl = bowling.get(bowlerName)
    if (!bowl) continue
    if (fig.wkts > bowl.bestWkts || (fig.wkts === bowl.bestWkts && fig.runs < bowl.bestRuns)) {
      bowl.bestWkts = fig.wkts
      bowl.bestRuns = fig.runs
    }
  }

  const battingStats = [...batting.entries()].map(([player, b]) => {
    const outs = b.dismissals
    const avg = outs > 0 ? b.runs / outs : null
    const sr = b.balls > 0 ? (b.runs / b.balls) * 100 : 0
    return {
      player,
      matches: b.matches.size,
      inns: b.innings.size,
      runs: b.runs,
      avg,
      sr,
      fours: b.fours,
      sixes: b.sixes,
    }
  })

  const bowlingStats = [...bowling.entries()]
    .filter(([, b]) => b.legalBalls > 0)
    .map(([player, b]) => {
      const oversFaced = b.legalBalls / 6
      const avg = b.wkts > 0 ? b.runs / b.wkts : null
      const econ = oversFaced > 0 ? b.runs / oversFaced : 0
      const best = b.bestWkts > 0 || b.bestRuns > 0 ? `${b.bestWkts}/${b.bestRuns}` : "--"
      return {
        player,
        matches: b.matches.size,
        inns: b.innings.size,
        wkts: b.wkts,
        avg,
        econ,
        best,
      }
    })

  return { battingStats, bowlingStats }
}

/**
 * Best-effort player-name → photo lookup, same two-table fallback
 * (`players` then `player_bank`) buildSquads already uses for Squads.
 * `balls.striker_name`/`bowler_name` are plain text, so this is a name
 * match, not an FK join — two players sharing an exact display name
 * will collide onto the same photo. That's an acceptable trade-off
 * given the schema; a real fix would mean turning `balls` into a
 * player-FK table, which is a bigger migration than this function.
 */
async function resolvePlayerPhotosByName(names: string[]): Promise<Map<string, string>> {
  const imgByName = new Map<string, string>()
  const uniqueNames = [...new Set(names)].filter((n) => n && n !== "Unknown")
  if (uniqueNames.length === 0) return imgByName

  const { data: playerRows, error: playersErr } = await supabase
    .from("players")
    .select("name, img")
    .in("name", uniqueNames)

  if (playersErr) {
    console.error("[resolvePlayerPhotosByName] players lookup failed:", playersErr.message)
  }
  playerRows?.forEach((p) => {
    if (p.img) imgByName.set(p.name, p.img)
  })

  const missing = uniqueNames.filter((n) => !imgByName.has(n))
  if (missing.length > 0) {
    const { data: bankRows, error: bankErr } = await supabase
      .from("player_bank")
      .select("name, img")
      .in("name", missing)

    if (bankErr) {
      console.error("[resolvePlayerPhotosByName] player_bank lookup failed:", bankErr.message)
    }
    bankRows?.forEach((p: any) => {
      if (p.img && !imgByName.has(p.name)) imgByName.set(p.name, p.img)
    })
  }

  return imgByName
}

export async function getTournamentStats(tournamentId: string): Promise<TournamentStats> {
  const emptyResult: TournamentStats = {
    battingStats: [],
    bowlingStats: [],
    matches: [],
    battingStatsByMatch: {},
    bowlingStatsByMatch: {},
  }

  // 1. Matches whose tournament link lives in match_setup.tournamentId
  //    (the JSON field) — this is the same field getMatchDetailById
  //    falls back to via
  //    `tournamentIdToResolve = bracketRow?.tournament_id ?? setup.tournamentId`.
  //    This is the ONLY way a tournament made up of standalone matches
  //    (no bracket_matches rows) is ever found.
  const { data: jsonLinkedMatches, error: jsonLinkedErr } = await supabase
    .from("matches")
    .select("id, match_setup")
    .eq("match_setup->>tournamentId", tournamentId)

  if (jsonLinkedErr) {
    console.error("[getTournamentStats] json-linked matches query failed:", jsonLinkedErr.message)
  }

  // 2. Matches linked via bracket_matches (real FK, tournament brackets).
  const { data: bracketRows, error: bracketErr } = await supabase
    .from("bracket_matches")
    .select("overlay_match_id")
    .eq("tournament_id", tournamentId)
    .not("overlay_match_id", "is", null)

  if (bracketErr) {
    console.error("[getTournamentStats] bracket_matches query failed:", bracketErr.message)
  }

  const matchIds = Array.from(
    new Set([
      ...(jsonLinkedMatches ?? []).map((m) => m.id as string),
      ...(bracketRows ?? []).map((b) => b.overlay_match_id as string),
    ])
  )

  if (matchIds.length === 0) {
    console.warn(
      `[getTournamentStats] no matches resolved for tournamentId=${tournamentId} — Stats tab will show locked.`
    )
    return emptyResult
  }

  // 3. Every ball from every one of those matches, in one query.
  const { data: ballRows, error: ballsErr } = await supabase
    .from("balls")
    .select(
      "match_id, innings_number, sequence, over_number, ball_number, striker_name, bowler_name, runs, extra_type, is_wicket, dismissal_type"
    )
    .in("match_id", matchIds)
    .order("sequence", { ascending: true })

  if (ballsErr) {
    console.error("[getTournamentStats] balls query failed:", ballsErr.message)
    return emptyResult
  }

  const allBalls = ballRows ?? []

  if (allBalls.length === 0) {
    console.warn(
      `[getTournamentStats] matches resolved but zero balls rows exist for them yet — Stats tab will show locked until scoring starts.`
    )
    return emptyResult
  }

  // 4. Build match labels for whichever matches actually have ball data
  //    (no point listing a match filter option for a match nobody has
  //    scored yet). Reads match_setup for team names, which every row
  //    in `matches` has regardless of whether it's bracket-linked.
  const matchIdsWithBalls = [...new Set(allBalls.map((b) => b.match_id as string))]
  const { data: matchRows, error: matchRowsErr } = await supabase
    .from("matches")
    .select("id, match_setup")
    .in("id", matchIdsWithBalls)

  if (matchRowsErr) {
    console.error("[getTournamentStats] match label lookup failed:", matchRowsErr.message)
  }

  const matches: MatchStatSummary[] = (matchRows ?? []).map((m: any) => {
    const setup = m.match_setup ?? {}
    const t1 = setup.team1?.name ?? "Team A"
    const t2 = setup.team2?.name ?? "Team B"
    const date: string | undefined = setup.date || undefined
    return {
      id: m.id,
      label: date ? `${t1} vs ${t2} · ${date}` : `${t1} vs ${t2}`,
      date,
    }
  })

  // 5. Aggregate overall, then again per match — same helper both times.
  const overall = aggregatePlayerStats(allBalls as StatsBallRow[])

  const ballsByMatch = new Map<string, StatsBallRow[]>()
  for (const b of allBalls as StatsBallRow[]) {
    const arr = ballsByMatch.get(b.match_id) ?? []
    arr.push(b)
    ballsByMatch.set(b.match_id, arr)
  }

  const perMatchRaw = new Map<
    string,
    { battingStats: Omit<PlayerStatRow, "img">[]; bowlingStats: Omit<BowlingStatRow, "img">[] }
  >()
  for (const [matchId, rows] of ballsByMatch) {
    perMatchRaw.set(matchId, aggregatePlayerStats(rows))
  }

  // 6. Resolve player photos once, against every name seen anywhere
  //    (overall totals cover every name a per-match pass could produce,
  //    so one lookup is enough for both).
  const allNames = [
    ...overall.battingStats.map((r) => r.player),
    ...overall.bowlingStats.map((r) => r.player),
  ]
  const imgByName = await resolvePlayerPhotosByName(allNames)

  const battingStats: PlayerStatRow[] = overall.battingStats.map((r) => ({
    ...r,
    img: imgByName.get(r.player),
  }))
  const bowlingStats: BowlingStatRow[] = overall.bowlingStats.map((r) => ({
    ...r,
    img: imgByName.get(r.player),
  }))

  const battingStatsByMatch: Record<string, PlayerStatRow[]> = {}
  const bowlingStatsByMatch: Record<string, BowlingStatRow[]> = {}
  for (const [matchId, agg] of perMatchRaw) {
    battingStatsByMatch[matchId] = agg.battingStats.map((r) => ({ ...r, img: imgByName.get(r.player) }))
    bowlingStatsByMatch[matchId] = agg.bowlingStats.map((r) => ({ ...r, img: imgByName.get(r.player) }))
  }

  return { battingStats, bowlingStats, matches, battingStatsByMatch, bowlingStatsByMatch }
}