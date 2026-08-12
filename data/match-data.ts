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

async function buildSquads(setup: MatchSetup, teamAName: string, teamBName: string): Promise<MatchSquad[]> {
  if (!setup.squads || setup.squads.length === 0) return []

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

  // Build squads with enriched player data
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
      players: s.players?.map((p) => {
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
    // Raw ball-by-ball log for the live 2nd innings — see BALL-BY-BALL
    // DELIVERIES note at the top of this file.
    deliveries: innings2Agg.deliveries,
  }

  const squads = await buildSquads(setup, teamA.name, teamB.name)

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
// TOURNAMENT STATS — series-wide leaderboards for the Stats tab.
// Aggregates every `balls` row across every match in a tournament,
// grouped by player rather than by match.
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
}

export interface BowlingStatRow {
  player: string
  matches: number
  inns: number
  wkts: number
  avg: number | null
  econ: number
  best: string
}

interface TournamentStats {
  battingStats: PlayerStatRow[]
  bowlingStats: BowlingStatRow[]
}

export async function getTournamentStats(tournamentId: string): Promise<TournamentStats> {
  // 1. Matches linked via the real `matches.tournament_id` column.
  const { data: directMatches, error: directErr } = await supabase
    .from("matches")
    .select("id")
    .eq("tournament_id", tournamentId)

  if (directErr) {
    console.error("[getTournamentStats] direct matches query failed:", directErr.message)
  }

  // 2. Matches whose tournament link only lives in
  //    match_setup.tournamentId (the JSON field) — this is the same
  //    field getMatchDetailById falls back to via
  //    `tournamentIdToResolve = bracketRow?.tournament_id ?? setup.tournamentId`.
  //    It is NOT written back into the real tournament_id column, so a
  //    tournament made up of standalone matches (no bracket_matches
  //    rows) would never be found without this query.
  const { data: jsonLinkedMatches, error: jsonLinkedErr } = await supabase
    .from("matches")
    .select("id")
    .eq("match_setup->>tournamentId", tournamentId)

  if (jsonLinkedErr) {
    console.error("[getTournamentStats] json-linked matches query failed:", jsonLinkedErr.message)
  }

  // 3. Matches linked via bracket_matches (real FK, tournament brackets).
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
      ...(directMatches ?? []).map((m) => m.id as string),
      ...(jsonLinkedMatches ?? []).map((m) => m.id as string),
      ...(bracketRows ?? []).map((b) => b.overlay_match_id as string),
    ])
  )

  console.log(
    `[getTournamentStats] tournamentId=${tournamentId} — direct=${directMatches?.length ?? 0} jsonLinked=${
      jsonLinkedMatches?.length ?? 0
    } bracket=${bracketRows?.length ?? 0} → ${matchIds.length} unique match ids:`,
    matchIds
  )

  if (matchIds.length === 0) {
    console.warn(
      `[getTournamentStats] no matches resolved for tournamentId=${tournamentId} — Stats tab will show locked.`
    )
    return { battingStats: [], bowlingStats: [] }
  }

  // 4. Every ball from every one of those matches, in one query.
  const { data: ballRows, error: ballsErr } = await supabase
    .from("balls")
    .select(
      "match_id, innings_number, sequence, over_number, ball_number, striker_name, bowler_name, runs, extra_type, is_wicket, dismissal_type"
    )
    .in("match_id", matchIds)
    .order("sequence", { ascending: true })

  if (ballsErr) {
    console.error("[getTournamentStats] balls query failed:", ballsErr.message)
    return { battingStats: [], bowlingStats: [] }
  }

  const allBalls = ballRows ?? []
  console.log(`[getTournamentStats] fetched ${allBalls.length} ball rows across ${matchIds.length} matches`)

  if (allBalls.length === 0) {
    console.warn(
      `[getTournamentStats] matches resolved but zero balls rows exist for them yet — Stats tab will show locked until scoring starts.`
    )
    return { battingStats: [], bowlingStats: [] }
  }

  type BatAcc = {
    matches: Set<string>
    innings: Set<string> // `${match_id}-${innings_number}`
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

  for (const row of allBalls) {
    const striker = row.striker_name ?? "Unknown"
    const bowler = row.bowler_name ?? "Unknown"
    const isWide = row.extra_type === "wide"
    const isNoBall = row.extra_type === "no_ball"
    const isBye = row.extra_type === "bye"
    const isLegBye = row.extra_type === "leg_bye"
    const isLegal = !isWide && !isNoBall
    const inningsKey = `${row.match_id}-${row.innings_number}`

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

  const battingStats: PlayerStatRow[] = [...batting.entries()].map(([player, b]) => {
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

  const bowlingStats: BowlingStatRow[] = [...bowling.entries()]
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

  console.log(
    `[getTournamentStats] built ${battingStats.length} batting rows, ${bowlingStats.length} bowling rows`
  )

  return { battingStats, bowlingStats }
}