// lib/matches/matches.ts
// ─────────────────────────────────────────────────────────────────────────
// Manual match creation, linking to bracket_matches, and deletion.
//
// IMPORTANT SCHEMA NOTE:
// `matches.auction_id` is a `text` column that is NOT NULL and UNIQUE — it
// is NOT a foreign key to `auctions.id` in this table. In practice it's
// used as a free-text session code (the live-scoring room code). Manual
// matches created here get a generated code like "manual-abc123-lz9f2q".
//
// `matches` also has no `tournament_id` column. To know which tournament a
// manual match belongs to (for both fixture-linked and fully standalone
// matches), we stash `tournamentId` inside `match_setup` (jsonb) and filter
// on it with PostgREST's `->>` operator. If you'd rather have a real
// column, add `tournament_id uuid references tournaments(id)` to `matches`
// and swap the `match_setup->>tournamentId` filters below for a plain
// `.eq("tournament_id", tournamentId)` — the rest of this file doesn't
// need to change.
// ─────────────────────────────────────────────────────────────────────────

import { supabase } from "@/lib/supabase"

export interface ManualMatchTeam {
  name: string
  short: string
}

export interface MatchSetup {
  tournamentId: string | null
  team1: ManualMatchTeam
  team2: ManualMatchTeam
  venue: string
  overs: number
  date: string
  time: string
  toss: string | null
}

export interface MatchSummary {
  id: string
  sessionCode: string
  tournamentId: string | null
  team1: ManualMatchTeam
  team2: ManualMatchTeam
  venue: string
  overs: number
  date: string
  time: string
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

function rowToSummary(row: any): MatchSummary {
  const setup = (row.match_setup ?? {}) as Partial<MatchSetup>
  return {
    id: row.id,
    sessionCode: row.auction_id,
    tournamentId: setup.tournamentId ?? null,
    team1: setup.team1 ?? { name: "Team A", short: "TBA" },
    team2: setup.team2 ?? { name: "Team B", short: "TBB" },
    venue: setup.venue ?? "",
    overs: setup.overs ?? 20,
    date: setup.date ?? "",
    time: setup.time ?? "",
    matchSetupCompleted: !!row.match_setup_completed,
    createdAt: row.created_at,
  }
}

// ── Create a manual match row (no bracket link yet) ────────────────────
async function insertMatch(params: {
  orgId: string
  tournamentId: string | null
  team1: ManualMatchTeam
  team2: ManualMatchTeam
  venue?: string
  overs?: number
  matchDate?: string
  matchTime?: string
}): Promise<Result<{ matchId: string; sessionCode: string }>> {
  const setup: MatchSetup = {
    tournamentId: params.tournamentId,
    team1: params.team1,
    team2: params.team2,
    venue: params.venue ?? "",
    overs: params.overs ?? 20,
    date: params.matchDate ?? "",
    time: params.matchTime ?? "",
    toss: null,
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
  team1: ManualMatchTeam
  team2: ManualMatchTeam
  venue?: string
  overs?: number
  matchDate?: string
  matchTime?: string
}): Promise<Result<{ matchId: string; sessionCode: string }>> {
  return insertMatch(input)
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
    team1: { name: fixture.teamAName ?? "Team A", short: (fixture.teamAName ?? "TBA").slice(0, 3).toUpperCase() },
    team2: { name: fixture.teamBName ?? "Team B", short: (fixture.teamBName ?? "TBB").slice(0, 3).toUpperCase() },
    venue: fixture.venue ?? "",
    matchDate: fixture.scheduledAt ?? "",
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