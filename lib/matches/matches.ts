// lib/matches/matches.ts
// ─────────────────────────────────────────────────────────────────────────
// Bracket-fixture match creation/linking, and deletion.
//
// Manual, unlinked match creation (the old "Manual Matches" section in
// MatchesManager) has been removed from the UI — every match for a
// tournament now traces back to a bracket fixture. createManualMatch /
// getStandaloneMatchesForTournament / deleteStandaloneMatch are left here,
// unused, in case anything else in the app still references them; nothing
// in the current UI calls them anymore.
//
// createMatchForFixture writes match_setup in the SAME flat team1/team2
// shape createFriendlyMatch (organization.ts) uses — this is the shape
// /match/[id]/edit's fromRawSetup already parses (team1.name, a flat
// `squads` array keyed by team short code). Previously this used a
// different shape (teamA/teamB) that the edit page couldn't read at all,
// so a fixture-created match's teams/squads showed up blank when you
// tried to edit them. Fixed here.
//
// `matches.auction_id` is NOT a real link to a bidding auction — every
// match self-references its own `id` (see the earlier auction_id fix).
// ─────────────────────────────────────────────────────────────────────────

import { supabase } from "@/lib/supabase"

export interface SquadPlayer {
  id: string
  name: string
  role: string
  /** Whether this player is in the starting XI vs. on the bench. */
  xi: boolean
}

export interface ManualMatchTeam {
  name: string
  color: string
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

export interface FriendlyMatchSummary {
  id: string
  auctionId: string
  team1Name: string
  team2Name: string
  team1Logo: string | null
  team2Logo: string | null
  round: string
  createdAt: string
  tournamentName: string | null
  tournamentId: string | null
  overlayConfigured: boolean
  auctionLinked: boolean
  venue: string | null
  date: string | null
  time: string | null
}

export interface FixtureRow {
  id: string
  round: number
  position: number
  bracketType: string
  teamAId: string | null
  teamBId: string | null
  teamAName: string | null
  teamACode: string | null
  teamAColor: string | null
  teamALogo: string | null
  teamBName: string | null
  teamBCode: string | null
  teamBColor: string | null
  teamBLogo: string | null
  winnerTeamId: string | null
  scoreA: number | null
  scoreB: number | null
  venue: string | null
  scheduledAt: string | null
  status: string
  overlayMatchId: string | null
}

/** Minimal shape needed to create a match for a fixture — a plain
 *  FixtureRow satisfies this structurally, but callers that only have a
 *  bare bracket_matches row (generateBracket.ts, advanceResultToNextMatches
 *  in bracketData.ts) don't need to fabricate the extra display-only
 *  fields (bracketType, position, scoreA/B, status, etc.) just to call
 *  createMatchForFixture. */
export interface FixtureLike {
  id: string
  teamAId: string | null
  teamBId: string | null
  round: number
  venue?: string | null
  scheduledAt?: string | null
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
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Keeps `squad` (names) in lockstep with `squadPlayers` (full detail) so
 *  callers only ever need to manage one list. Only used by the (now
 *  unused-by-UI) createManualMatch/updateManualMatch below. */
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

/** UNUSED BY THE CURRENT UI — left in place in case anything else in the
 *  app still calls it. The "Manual Matches" section that used to call
 *  this was removed from MatchesManager.tsx; every match now traces back
 *  to a bracket fixture via createMatchForFixture below. */
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

/** UNUSED BY THE CURRENT UI — see insertMatch note above. */
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

/** UNUSED BY THE CURRENT UI — see insertMatch note above. */
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

/** UNUSED BY THE CURRENT UI — see insertMatch note above. */
/** Standalone matches only — filtered directly in the query via
 *  `tournament_id is null`, rather than trusting the client to filter
 *  FriendlyMatchSummary.tournamentId after the fact. This is the
 *  source of truth for the Matches tab's list. */
export async function getStandaloneMatchesForOrg(orgId: string): Promise<FriendlyMatchSummary[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("id, auction_id, match_setup, created_at, tournament_id")
    .eq("org_id", orgId)
    .is("tournament_id", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getStandaloneMatchesForOrg failed:", error.message);
    return [];
  }

  const matches = data ?? [];
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length === 0) return [];

  const [{ data: channelRows }, { data: weatherRows }] = await Promise.all([
    supabase.from("on_air_channels").select("match_id, channels").in("match_id", matchIds),
    supabase.from("weather_readings").select("match_id, coords").in("match_id", matchIds),
  ]);

  const overlaySet = new Set<string>();
  (channelRows ?? []).forEach((c: any) => {
    if (Array.isArray(c.channels) && c.channels.length > 0) overlaySet.add(c.match_id);
  });
  (weatherRows ?? []).forEach((w: any) => {
    const coords = (w.coords ?? {}) as { lat?: number; lng?: number };
    if (typeof coords.lat === "number" && typeof coords.lng === "number") overlaySet.add(w.match_id);
  });

  return matches.map((m: any) => {
    const setup = (m.match_setup ?? {}) as Record<string, any>;
    return {
      id: m.id,
      auctionId: m.auction_id ?? m.id,
      team1Name: setup.team1?.name ?? "Team 1",
      team2Name: setup.team2?.name ?? "Team 2",
      team1Logo: setup.team1?.logo || null,
      team2Logo: setup.team2?.logo || null,
      round: setup.round ?? "Friendly",
      createdAt: m.created_at,
      tournamentName: null, // standalone by query, always null
      tournamentId: null,   // standalone by query, always null
      overlayConfigured: overlaySet.has(m.id),
      auctionLinked: Array.isArray(setup.squads) && setup.squads.length > 0,
      venue: setup.venue || null,
      date: setup.date || null,
      time: setup.time || null,
    };
  });
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
       team_a:teams!bracket_matches_team_a_id_fkey(name, code, color, logo),
       team_b:teams!bracket_matches_team_b_id_fkey(name, code, color, logo)`
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
    teamACode: r.team_a?.code ?? null,
    teamAColor: r.team_a?.color ?? null,
    teamALogo: r.team_a?.logo ?? null,
    teamBName: r.team_b?.name ?? null,
    teamBCode: r.team_b?.code ?? null,
    teamBColor: r.team_b?.color ?? null,
    teamBLogo: r.team_b?.logo ?? null,
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

/**
 * Creates a `matches` row for a bracket fixture and links it back via
 * `bracket_matches.overlay_match_id`. Pulls each team's real color/logo
 * (from `teams`) and its currently-sold roster (from `players`) so a
 * fixture-created match carries exactly what the old standalone
 * match-creation form used to let you set by hand — nothing is lost by
 * going through the bracket instead of typing it manually.
 *
 * Writes match_setup in the flat team1/team2 shape (matching
 * createFriendlyMatch in organization.ts) — this is the shape
 * /match/[id]/edit's fromRawSetup already parses correctly. `rosterLocked:
 * true` because these teams' rosters live on the real teams/players
 * tables (via the auction or Squad Board the tournament is linked to);
 * editing a player here should happen at the source, same rule
 * organization.ts's createFriendlyMatch already applies for auction-
 * sourced matches.
 *
 * Called automatically — from generateBracketForTournament for round 1,
 * and from advanceResultToNextMatches whenever a later fixture gets both
 * its teams filled in — as well as as a manual fallback button in
 * MatchesManager for the rare case auto-creation didn't fire (e.g. an
 * older bracket generated before this existed).
 */
export async function createMatchForFixture(
  fixture: FixtureLike,
  orgId: string,
  tournamentId: string
): Promise<Result<{ matchId: string; sessionCode: string }>> {
  if (!fixture.teamAId || !fixture.teamBId) {
    return { ok: false, error: "Both teams need to be decided by the bracket before a match can be created." }
  }

  const { data: teamRows, error: teamErr } = await supabase
    .from("teams")
    .select("id, name, code, color, logo")
    .in("id", [fixture.teamAId, fixture.teamBId])

  if (teamErr || !teamRows || teamRows.length !== 2) {
    return { ok: false, error: teamErr?.message ?? "Couldn't load the fixture's teams." }
  }
  const tA = teamRows.find((t) => t.id === fixture.teamAId)!
  const tB = teamRows.find((t) => t.id === fixture.teamBId)!

  const team1 = { name: tA.name, short: tA.code, logo: tA.logo || "", color: tA.color || "#c9971f", id: tA.id }
  const team2 = { name: tB.name, short: tB.code, logo: tB.logo || "", color: tB.color || "#c9971f", id: tB.id }

  const { data: playerRows, error: playersErr } = await supabase
    .from("players")
    .select("name, role, img, sold_to_team_id, owner_team_code")
    .in("sold_to_team_id", [fixture.teamAId, fixture.teamBId])

  if (playersErr) {
    console.error("createMatchForFixture(players) failed:", playersErr.message)
  }

  // Group players by team with playerId references - images will be fetched dynamically
  const team1Players = (playerRows ?? [])
    .filter((p: any) => p.sold_to_team_id === fixture.teamAId)
    .map((p: any) => ({
      name: p.name,
      role: p.role,
      xi: true,
      playerId: p.id,
    }))
  
  const team2Players = (playerRows ?? [])
    .filter((p: any) => p.sold_to_team_id === fixture.teamBId)
    .map((p: any) => ({
      name: p.name,
      role: p.role,
      xi: true,
      playerId: p.id,
    }))

  // Find captains: first player with owner_team_code, or first player if none found
  const team1Captain = (playerRows ?? []).find((p: any) => p.sold_to_team_id === fixture.teamAId && p.owner_team_code)?.name || team1Players[0]?.name || ""
  const team2Captain = (playerRows ?? []).find((p: any) => p.sold_to_team_id === fixture.teamBId && p.owner_team_code)?.name || team2Players[0]?.name || ""

  const squads = [
    {
      teamId: fixture.teamAId,
      captain: team1Captain,
      players: team1Players,
    },
    {
      teamId: fixture.teamBId,
      captain: team2Captain,
      players: team2Players,
    },
  ].filter((s) => s.players.length > 0)

  const newId = crypto.randomUUID()
  const matchSetup = {
    tournamentName: "",
    round: `Round ${fixture.round}`,
    team1,
    team2,
    venue: fixture.venue ?? "",
    date: "",
    time: fixture.scheduledAt ?? "",
    toss: "",
    overs: 20,
    officials: { format: "", umpires: "", thirdUmpire: "", referee: "" },
    squads,
    rosterLocked: true,
  }

  const { data, error } = await supabase
    .from("matches")
    .insert({
      id: newId,
      // Self-referencing, matching createFriendlyMatch's fix — never
      // reuse the fixture/tournament/auction's own id here.
      auction_id: newId,
      org_id: orgId,
      match_setup: matchSetup,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't create the match." }
  }

  const { error: linkErr } = await supabase
    .from("bracket_matches")
    .update({ overlay_match_id: data.id, status: "live", result_source: "overlay" })
    .eq("id", fixture.id)

  if (linkErr) {
    return { ok: false, error: `Match was created but couldn't be linked to the bracket: ${linkErr.message}` }
  }

  return { ok: true, matchId: data.id, sessionCode: newId }
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

  // Advance the winner into whichever next fixture(s) feed off this one.
  // Uses a plain array query rather than .maybeSingle() — a bracket
  // should only ever have ONE next match per feeder slot, but if bracket
  // generation ever produced duplicate feeder links, .maybeSingle() would
  // throw ("multiple rows returned") and abort the whole result save.
  // This instead advances every match found and logs a warning so the
  // underlying data issue is visible without blocking the save.
  const { data: nextAsA, error: nextAError } = await supabase
    .from("bracket_matches")
    .select("id")
    .eq("feeder_match_a_id", fixture.id)

  if (nextAError) return { ok: false, error: nextAError.message }
  if (nextAsA && nextAsA.length > 0) {
    if (nextAsA.length > 1) {
      console.error(
        `recordFixtureResult: ${nextAsA.length} bracket_matches rows share feeder_match_a_id = ${fixture.id} — bracket wiring is corrupted for this tournament.`
      )
    }
    const { error: advanceError } = await supabase
      .from("bracket_matches")
      .update({ team_a_id: winnerTeamId })
      .in("id", nextAsA.map((r) => r.id))
    if (advanceError) return { ok: false, error: advanceError.message }
  }

  const { data: nextAsB, error: nextBError } = await supabase
    .from("bracket_matches")
    .select("id")
    .eq("feeder_match_b_id", fixture.id)

  if (nextBError) return { ok: false, error: nextBError.message }
  if (nextAsB && nextAsB.length > 0) {
    if (nextAsB.length > 1) {
      console.error(
        `recordFixtureResult: ${nextAsB.length} bracket_matches rows share feeder_match_b_id = ${fixture.id} — bracket wiring is corrupted for this tournament.`
      )
    }
    const { error: advanceError } = await supabase
      .from("bracket_matches")
      .update({ team_b_id: winnerTeamId })
      .in("id", nextAsB.map((r) => r.id))
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
