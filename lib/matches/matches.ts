// lib/matches/matches.ts
// ─────────────────────────────────────────────────────────────────────────
// Manual match creation, linking to bracket_matches, and deletion.
//
// IMPORTANT SCHEMA NOTE:
// `matches.auction_id` is a `text` column that is NOT NULL and UNIQUE — it
// is NOT a foreign key to `auctions.id` in this table. In practice it's
// used as a free-text session code (the live-scoring room code). Manual
// matches created here get a generated UUID-shaped code (see
// generateSessionCode for why it has to look like a real UUID).
//
// `matches` also has no `tournament_id` column. To know which tournament a
// manual match belongs to (for both fixture-linked and fully standalone
// matches), we stash `tournamentId` inside `match_setup` (jsonb) and filter
// on it with PostgREST's `->>` operator. If you'd rather have a real
// column, add `tournament_id uuid references tournaments(id)` to `matches`
// and swap the `match_setup->>tournamentId` filters below for a plain
// `.eq("tournament_id", tournamentId)` — the rest of this file doesn't
// need to change.
//
// MATCH_SETUP SHAPE:
// This mirrors the JSON shape used elsewhere in the app (e.g. the
// auction/live-match setup flow) so a match created here plugs into the
// same downstream consumers without translation:
//
//   {
//     teamA: { name, color, squad, squadPlayers, logoUrl, shortCode },
//     teamB: { ...same },
//     venue, format, season, matchMeta, matchTitle,
//     tossWinner, tossDecision, tournament, kickoffTime,
//     matchNumber, tournamentName, tournamentLogoUrl
//   }
//
// `tournamentId` and `overs` are NOT part of that public shape but are
// still tracked internally: `tournamentId` for the tournament-filter query
// above, and `overs` because match-detail rendering (over limits, CRR/RRR)
// needs a numeric ball count that `format` alone doesn't give you. Both
// are optional extra keys on the stored jsonb and are simply ignored by
// any other consumer that only knows about the public shape.
// ─────────────────────────────────────────────────────────────────────────

import { supabase } from "@/lib/supabase"

export interface SquadPlayer {
  id: string
  name: string
  role: string
  xi: boolean
  imageUrl?: string
}

export interface ManualMatchTeam {
  name: string
  color: string
  /** Quick-reference list of player names/ids on the squad. Kept in sync
   *  with squadPlayers — derived automatically, not edited directly. */
  squad: string[]
  squadPlayers: SquadPlayer[]
  logoUrl: string
  shortCode: string
}

export interface MatchSetup {
  teamA: ManualMatchTeam
  teamB: ManualMatchTeam
  venue: string
  format: string
  season: string
  matchMeta: string
  matchTitle: string
  tossWinner: string
  tossDecision: string
  tournament: string
  kickoffTime: string
  matchNumber: string
  tournamentName: string
  tournamentLogoUrl: string
  // ── internal-only, not part of the shared public shape ──
  tournamentId: string | null
  overs: number
}

export interface MatchSummary {
  id: string
  sessionCode: string
  tournamentId: string | null
  teamA: ManualMatchTeam
  teamB: ManualMatchTeam
  venue: string
  format: string
  season: string
  matchMeta: string
  matchTitle: string
  tossWinner: string
  tossDecision: string
  tournament: string
  kickoffTime: string
  matchNumber: string
  tournamentName: string
  tournamentLogoUrl: string
  overs: number
  matchSetupCompleted: boolean
  createdAt: string
}

export interface FixtureRow {
  id: string
  round: number
  position: number
  bracketType: string
  teamAId: string | null
  teamBId: string | null
  teamAName: string | null
  teamBName: string | null
  winnerTeamId: string | null
  scoreA: number | null
  scoreB: number | null
  venue: string | null
  scheduledAt: string | null
  status: string
  overlayMatchId: string | null
}

type Result<T> = { ok: true } & T | { ok: false; error: string }

function emptyTeam(name = "", shortCode = "", color = "#c9971f"): ManualMatchTeam {
  return {
    name,
    color,
    squad: [],
    squadPlayers: [],
    logoUrl: "",
    shortCode,
  }
}

function generateSessionCode(): string {
  // `matches.auction_id` is typed `text`, but a DB trigger
  // (trg_check_auction_destination_on_matches) casts it to `uuid` before
  // calling check_auction_destination(uuid) — a slug like "manual-xxx"
  // fails that cast with "invalid input syntax for type uuid". Generating
  // a real UUID string here keeps the column unique (still enforced by
  // its UNIQUE constraint) while satisfying the trigger's cast.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID (older browsers).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Keeps `squad` (names) in lockstep with `squadPlayers` (full detail) so
 *  callers only ever need to manage one list. */
function withDerivedSquad(team: ManualMatchTeam): ManualMatchTeam {
  return { ...team, squad: team.squadPlayers.map((p) => p.name) }
}

function rowToSummary(row: any): MatchSummary {
  const setup = (row.match_setup ?? {}) as Partial<MatchSetup>
  return {
    id: row.id,
    sessionCode: row.auction_id,
    tournamentId: setup.tournamentId ?? null,
    teamA: setup.teamA ?? emptyTeam("Team A", "TBA"),
    teamB: setup.teamB ?? emptyTeam("Team B", "TBB"),
    venue: setup.venue ?? "",
    format: setup.format ?? "T20",
    season: setup.season ?? "",
    matchMeta: setup.matchMeta ?? "",
    matchTitle: setup.matchTitle ?? "",
    tossWinner: setup.tossWinner ?? "",
    tossDecision: setup.tossDecision ?? "",
    tournament: setup.tournament ?? "",
    kickoffTime: setup.kickoffTime ?? "",
    matchNumber: setup.matchNumber ?? "",
    tournamentName: setup.tournamentName ?? "",
    tournamentLogoUrl: setup.tournamentLogoUrl ?? "",
    overs: setup.overs ?? 20,
    matchSetupCompleted: !!row.match_setup_completed,
    createdAt: row.created_at,
  }
}

// ── Create a manual match row (no bracket link yet) ────────────────────
async function insertMatch(params: {
  orgId: string
  tournamentId: string | null
  teamA: ManualMatchTeam
  teamB: ManualMatchTeam
  venue?: string
  format?: string
  season?: string
  matchMeta?: string
  matchTitle?: string
  tossWinner?: string
  tossDecision?: string
  tournament?: string
  kickoffTime?: string
  matchNumber?: string
  tournamentName?: string
  tournamentLogoUrl?: string
  overs?: number
}): Promise<Result<{ matchId: string; sessionCode: string }>> {
  const setup: MatchSetup = {
    teamA: withDerivedSquad(params.teamA),
    teamB: withDerivedSquad(params.teamB),
    venue: params.venue ?? "",
    format: params.format ?? "T20",
    season: params.season ?? "",
    matchMeta: params.matchMeta ?? "",
    matchTitle: params.matchTitle ?? "",
    tossWinner: params.tossWinner ?? "",
    tossDecision: params.tossDecision ?? "",
    tournament: params.tournament ?? "",
    kickoffTime: params.kickoffTime ?? "",
    matchNumber: params.matchNumber ?? "",
    tournamentName: params.tournamentName ?? "",
    tournamentLogoUrl: params.tournamentLogoUrl ?? "",
    tournamentId: params.tournamentId,
    overs: params.overs ?? 20,
  }

  const { data, error } = await supabase
    .from("matches")
    .insert({
      auction_id: generateSessionCode(),
      org_id: params.orgId,
      match_setup: setup,
      match_setup_completed: true,
    })
    .select("id, auction_id")
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't create the match." }
  }

  return { ok: true, matchId: data.id, sessionCode: data.auction_id }
}

// ── Standalone match: not tied to any bracket fixture ───────────────────
export async function createManualMatch(input: {
  orgId: string
  tournamentId: string | null
  teamA: ManualMatchTeam
  teamB: ManualMatchTeam
  venue?: string
  format?: string
  season?: string
  matchMeta?: string
  matchTitle?: string
  tossWinner?: string
  tossDecision?: string
  tournament?: string
  kickoffTime?: string
  matchNumber?: string
  tournamentName?: string
  tournamentLogoUrl?: string
  overs?: number
}): Promise<Result<{ matchId: string; sessionCode: string }>> {
  return insertMatch(input)
}

// ── Update an existing manual match's setup fields ──────────────────────
// Merges the given partial fields into the existing match_setup so an
// edit form can be a simple "patch" rather than needing to resend the
// entire setup blob every time.
export async function updateManualMatch(
  matchId: string,
  patch: Partial<Omit<MatchSetup, "tournamentId">>
): Promise<Result<{}>> {
  const { data: existing, error: fetchError } = await supabase
    .from("matches")
    .select("match_setup")
    .eq("id", matchId)
    .single()

  if (fetchError || !existing) {
    return { ok: false, error: fetchError?.message ?? "Match not found." }
  }

  const current = (existing.match_setup ?? {}) as MatchSetup

  const merged: MatchSetup = {
    ...current,
    ...patch,
    teamA: patch.teamA ? withDerivedSquad({ ...current.teamA, ...patch.teamA }) : current.teamA,
    teamB: patch.teamB ? withDerivedSquad({ ...current.teamB, ...patch.teamB }) : current.teamB,
  }

  const { error } = await supabase
    .from("matches")
    .update({ match_setup: merged })
    .eq("id", matchId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteStandaloneMatch(matchId: string): Promise<Result<{}>> {
  await cleanUpMatchDependents(matchId)
  const { error } = await supabase.from("matches").delete().eq("id", matchId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function getStandaloneMatchesForTournament(
  tournamentId: string
): Promise<Result<{ matches: MatchSummary[] }>> {
  // Pull every match tagged with this tournament, then exclude the ones
  // already linked to a bracket fixture so the two lists don't overlap.
  const { data: rows, error } = await supabase
    .from("matches")
    .select("id, auction_id, match_setup, match_setup_completed, created_at")
    .eq("match_setup->>tournamentId", tournamentId)
    .order("created_at", { ascending: false })

  if (error) return { ok: false, error: error.message }

  const { data: linked, error: linkedError } = await supabase
    .from("bracket_matches")
    .select("overlay_match_id")
    .eq("tournament_id", tournamentId)
    .not("overlay_match_id", "is", null)

  if (linkedError) return { ok: false, error: linkedError.message }

  const linkedIds = new Set((linked ?? []).map((r) => r.overlay_match_id))
  const standalone = (rows ?? []).filter((r) => !linkedIds.has(r.id))

  return { ok: true, matches: standalone.map(rowToSummary) }
}

// ── Fixture-linked matches (bracket_matches → matches via overlay) ──────
export async function getFixturesWithMatches(
  tournamentId: string
): Promise<Result<{ fixtures: FixtureRow[] }>> {
  const { data, error } = await supabase
    .from("bracket_matches")
    .select(
      `id, round, position, bracket_type, team_a_id, team_b_id, winner_team_id,
       score_a, score_b, venue, scheduled_at, status, overlay_match_id,
       team_a:teams!bracket_matches_team_a_id_fkey(name),
       team_b:teams!bracket_matches_team_b_id_fkey(name)`
    )
    .eq("tournament_id", tournamentId)
    .order("round", { ascending: true })
    .order("position", { ascending: true })

  if (error) return { ok: false, error: error.message }

  const fixtures: FixtureRow[] = (data ?? []).map((r: any) => ({
    id: r.id,
    round: r.round,
    position: r.position,
    bracketType: r.bracket_type,
    teamAId: r.team_a_id,
    teamBId: r.team_b_id,
    teamAName: r.team_a?.name ?? null,
    teamBName: r.team_b?.name ?? null,
    winnerTeamId: r.winner_team_id,
    scoreA: r.score_a,
    scoreB: r.score_b,
    venue: r.venue,
    scheduledAt: r.scheduled_at,
    status: r.status,
    overlayMatchId: r.overlay_match_id,
  }))

  return { ok: true, fixtures }
}

export async function createMatchForFixture(
  fixture: FixtureRow,
  orgId: string,
  tournamentId: string
): Promise<Result<{ matchId: string; sessionCode: string }>> {
  if (!fixture.teamAId || !fixture.teamBId) {
    return { ok: false, error: "Both teams need to be decided by the bracket before a match can be created." }
  }

  const created = await insertMatch({
    orgId,
    tournamentId,
    teamA: emptyTeam(
      fixture.teamAName ?? "Team A",
      (fixture.teamAName ?? "TBA").slice(0, 3).toUpperCase()
    ),
    teamB: emptyTeam(
      fixture.teamBName ?? "Team B",
      (fixture.teamBName ?? "TBB").slice(0, 3).toUpperCase()
    ),
    venue: fixture.venue ?? "",
    kickoffTime: fixture.scheduledAt ?? "",
    matchMeta: `Round ${fixture.round}`,
  })

  if (!created.ok) return created

  const { error } = await supabase
    .from("bracket_matches")
    .update({
      overlay_match_id: created.matchId,
      status: "live",
      result_source: "overlay",
    })
    .eq("id", fixture.id)

  if (error) {
    return { ok: false, error: `Match was created but couldn't be linked to the bracket: ${error.message}` }
  }

  return created
}

export async function unlinkAndDeleteFixtureMatch(
  bracketMatchId: string,
  matchId: string
): Promise<Result<{}>> {
  const { error: unlinkError } = await supabase
    .from("bracket_matches")
    .update({ overlay_match_id: null, status: "upcoming", result_source: null })
    .eq("id", bracketMatchId)

  if (unlinkError) return { ok: false, error: unlinkError.message }

  await cleanUpMatchDependents(matchId)

  const { error } = await supabase.from("matches").delete().eq("id", matchId)
  if (error) return { ok: false, error: error.message }

  return { ok: true }
}

// ── Recording a fixture result and advancing the bracket ────────────────
export async function recordFixtureResult(
  fixture: FixtureRow,
  winnerTeamId: string,
  scoreA: number | null,
  scoreB: number | null
): Promise<Result<{}>> {
  const { error } = await supabase
    .from("bracket_matches")
    .update({
      winner_team_id: winnerTeamId,
      score_a: scoreA,
      score_b: scoreB,
      status: "completed",
    })
    .eq("id", fixture.id)

  if (error) return { ok: false, error: error.message }

  // Push the winner into whichever next-round match feeds off this one.
  const { data: nextAsA, error: nextAError } = await supabase
    .from("bracket_matches")
    .select("id")
    .eq("feeder_match_a_id", fixture.id)
    .maybeSingle()
  if (nextAError) return { ok: false, error: nextAError.message }
  if (nextAsA) {
    const { error: advanceError } = await supabase
      .from("bracket_matches")
      .update({ team_a_id: winnerTeamId })
      .eq("id", nextAsA.id)
    if (advanceError) return { ok: false, error: advanceError.message }
  }

  const { data: nextAsB, error: nextBError } = await supabase
    .from("bracket_matches")
    .select("id")
    .eq("feeder_match_b_id", fixture.id)
    .maybeSingle()
  if (nextBError) return { ok: false, error: nextBError.message }
  if (nextAsB) {
    const { error: advanceError } = await supabase
      .from("bracket_matches")
      .update({ team_b_id: winnerTeamId })
      .eq("id", nextAsB.id)
    if (advanceError) return { ok: false, error: advanceError.message }
  }

  return { ok: true }
}

// ── Shared cleanup for anything hanging off a `matches` row ─────────────
async function cleanUpMatchDependents(matchId: string) {
  await supabase.from("balls").delete().eq("match_id", matchId)
  await supabase.from("match_state").delete().eq("match_id", matchId)
  await supabase.from("engine_state").delete().eq("match_id", matchId)
  await supabase.from("weather_readings").delete().eq("match_id", matchId)
  await supabase.from("on_air_channels").delete().eq("match_id", matchId)
  await supabase.from("match_team_stats").delete().eq("match_id", matchId)
}