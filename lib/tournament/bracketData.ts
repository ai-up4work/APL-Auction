import { supabase } from "@/lib/supabase";
import type { Round, MatchNode, TeamNode } from "@/components/tournament/TournamentBracket";
import type { DoubleElimData } from "@/lib/tournament/doubleElim";
import { roundMetaFor } from "@/lib/tournament/seeding";

/* ------------------------------------------------------------------ */
/*  Raw row shape, straight off bracket_matches + team joins           */
/* ------------------------------------------------------------------ */

type TeamRef = { id: string; code: string; name: string; color: string; logo: string | null } | null;

interface BracketMatchRow {
  id: string;
  bracket_type: "winners" | "losers" | "grand_final" | "round_robin";
  round: number;
  position: number;
  score_a: number | null;
  score_b: number | null;
  winner_team_id: string | null;
  status: "upcoming" | "live" | "completed";
  venue: string | null;
  scheduled_at: string | null;
  feeder_match_a_id: string | null;
  feeder_match_b_id: string | null;
  team_a: TeamRef;
  team_b: TeamRef;
}

function normalizeOne<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

/**
 * Fetches every bracket_matches row for a tournament, with team_a/team_b
 * joined for display. Works for single elim (all bracket_type='winners'),
 * double elim (winners/losers/grand_final mixed), or round robin (which
 * has no bracket to render here — callers should show standings instead).
 */
export async function getBracketMatchesForTournament(tournamentId: string): Promise<BracketMatchRow[]> {
  const { data, error } = await supabase
    .from("bracket_matches")
    .select(
      `
      id,
      bracket_type,
      round,
      position,
      score_a,
      score_b,
      winner_team_id,
      status,
      venue,
      scheduled_at,
      feeder_match_a_id,
      feeder_match_b_id,
      team_a:team_a_id ( id, code, name, color, logo ),
      team_b:team_b_id ( id, code, name, color, logo )
      `
    )
    .eq("tournament_id", tournamentId)
    .order("round", { ascending: true })
    .order("position", { ascending: true });

  if (error) {
    console.error("getBracketMatchesForTournament failed:", error.message);
    return [];
  }

  return (data ?? []).map((r: any) => ({
    ...r,
    team_a: normalizeOne<TeamRef>(r.team_a),
    team_b: normalizeOne<TeamRef>(r.team_b),
  }));
}

/* ------------------------------------------------------------------ */
/*  Shared row -> node mapping                                         */
/* ------------------------------------------------------------------ */

function mapStatus(s: BracketMatchRow["status"]): MatchNode["status"] {
  return s === "upcoming" ? "scheduled" : s;
}

function teamNodeFromRow(
  team: TeamRef,
  status: BracketMatchRow["status"],
  score: number | null,
  winnerTeamId: string | null
): TeamNode | null {
  if (!team) return null;
  const decided = status === "completed";
  return {
    id: team.id,
    code: team.code,
    name: team.name,
    color: team.color,
    logo: team.logo || undefined,
    score: decided ? score ?? undefined : undefined,
    isWinner: decided ? winnerTeamId === team.id : undefined,
  };
}

/** "W:id" for a winner advancing, "L:id" for a loser dropping into the
 *  losers bracket — determined purely from bracket_type, since the DB
 *  doesn't store the prefix directly. A winners-bracket feeder landing in
 *  a losers-bracket target is always a drop; every other combination
 *  (winners->winners, losers->losers, either->grand_final) advances the
 *  winner, matching generateDoubleElimination's convention exactly. */
function feederLabel(
  feederId: string | null,
  targetType: BracketMatchRow["bracket_type"],
  typeById: Map<string, BracketMatchRow["bracket_type"]>
): string | null {
  if (!feederId) return null;
  const feederType = typeById.get(feederId);
  const isDrop = feederType === "winners" && targetType === "losers";
  return `${isDrop ? "L" : "W"}:${feederId}`;
}

function rowToMatchNode(
  row: BracketMatchRow,
  typeById: Map<string, BracketMatchRow["bracket_type"]>,
  options: { prefixed: boolean } = { prefixed: false }
): MatchNode {
  const aFrom = options.prefixed
    ? feederLabel(row.feeder_match_a_id, row.bracket_type, typeById)
    : row.feeder_match_a_id;
  const bFrom = options.prefixed
    ? feederLabel(row.feeder_match_b_id, row.bracket_type, typeById)
    : row.feeder_match_b_id;

  return {
    id: row.id,
    label: row.id,
    status: mapStatus(row.status),
    teamA: teamNodeFromRow(row.team_a, row.status, row.score_a, row.winner_team_id),
    teamB: teamNodeFromRow(row.team_b, row.status, row.score_b, row.winner_team_id),
    aFrom,
    bFrom,
    venue: row.venue || undefined,
    date: row.scheduled_at ? new Date(row.scheduled_at).toLocaleDateString() : undefined,
    time: row.scheduled_at
      ? new Date(row.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : undefined,
  };
}

function groupByRound(rows: BracketMatchRow[]): Map<number, BracketMatchRow[]> {
  const map = new Map<number, BracketMatchRow[]>();
  for (const r of rows) {
    if (!map.has(r.round)) map.set(r.round, []);
    map.get(r.round)!.push(r);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/*  Single elimination                                                  */
/* ------------------------------------------------------------------ */

/**
 * Groups real bracket_matches rows by round and maps each to a Round/
 * MatchNode pair that TournamentBracket already knows how to render.
 * No "W:"/"L:" prefixing needed here — that's only relevant for double
 * elimination's winners/losers routing — so aFrom/bFrom are just the raw
 * feeder match ids, matching TournamentBracket's direct id comparison.
 */
export function buildSingleEliminationRounds(rows: BracketMatchRow[]): Round[] {
  const relevant = rows.filter((r) => r.bracket_type !== "losers" && r.bracket_type !== "grand_final");
  const typeById = new Map(relevant.map((r) => [r.id, r.bracket_type]));
  const grouped = groupByRound(relevant);
  const roundNumbers = [...grouped.keys()].sort((a, b) => a - b);

  return roundNumbers.map((roundNum) => {
    const matchRows = grouped.get(roundNum)!;
    const meta = roundMetaFor(matchRows.length * 2);
    return {
      id: roundNum,
      name: meta.name,
      shortName: meta.shortName,
      matches: matchRows.map((r) => rowToMatchNode(r, typeById, { prefixed: false })),
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Double elimination                                                  */
/* ------------------------------------------------------------------ */

export function buildDoubleEliminationData(rows: BracketMatchRow[]): DoubleElimData | null {
  const typeById = new Map(rows.map((r) => [r.id, r.bracket_type]));

  const winnersRows = rows.filter((r) => r.bracket_type === "winners");
  const losersRows = rows.filter((r) => r.bracket_type === "losers");
  const gfRows = rows
    .filter((r) => r.bracket_type === "grand_final")
    .sort((a, b) => a.round - b.round);

  if (winnersRows.length === 0 || gfRows.length === 0) return null;

  function buildSide(sideRows: BracketMatchRow[], label: "Winners" | "Losers", idOffset: number): Round[] {
    const grouped = groupByRound(sideRows);
    const roundNumbers = [...grouped.keys()].sort((a, b) => a - b);
    return roundNumbers.map((roundNum) => {
      const matchRows = grouped.get(roundNum)!;
      return {
        id: idOffset + roundNum,
        name: `${label} — Round ${roundNum}`,
        shortName: `${label === "Winners" ? "WB" : "LB"}${roundNum}`,
        matches: matchRows.map((r) => rowToMatchNode(r, typeById, { prefixed: true })),
      };
    });
  }

  const winners = buildSide(winnersRows, "Winners", 0);
  const losers = buildSide(losersRows, "Losers", 100);

  const grandFinal = rowToMatchNode(gfRows[0], typeById, { prefixed: true });
  const bracketReset = gfRows[1]
    ? { ...rowToMatchNode(gfRows[1], typeById, { prefixed: true }), aFrom: null, bFrom: null }
    : null;

  return { winners, losers, grandFinal, bracketReset };
}

/* ------------------------------------------------------------------ */
/*  Writing results back into bracket_matches                          */
/* ------------------------------------------------------------------ */

interface BracketMatchResultInput {
  scoreA: number | null;
  scoreB: number | null;
  winnerTeamId: string | null;
  status: "upcoming" | "live" | "completed";
  venue?: string | null;
  scheduledAt?: string | null;
}

/**
 * Looks up just enough about a match (its bracket_type and current
 * team_a_id/team_b_id) to figure out who the *loser* was, and whether
 * this match's bracket_type means a "drop" (winners -> losers) applies
 * to whoever feeds off of it.
 */
async function getMatchTeamsAndType(matchId: string): Promise<{
  bracketType: BracketMatchRow["bracket_type"];
  teamAId: string | null;
  teamBId: string | null;
} | null> {
  const { data, error } = await supabase
    .from("bracket_matches")
    .select("bracket_type, team_a_id, team_b_id")
    .eq("id", matchId)
    .maybeSingle();

  if (error) {
    console.error("getMatchTeamsAndType failed:", error.message);
    return null;
  }
  if (!data) return null;

  return { bracketType: data.bracket_type, teamAId: data.team_a_id, teamBId: data.team_b_id };
}

/**
 * After a match is completed, pushes the advancing team(s) straight into
 * whichever downstream match(es) reference this match as a feeder
 * (feeder_match_a_id / feeder_match_b_id) — so the bracket updates
 * immediately instead of waiting for the sibling feeder match to also
 * finish before a team shows up in the next round.
 *
 * A winners-bracket match feeding into a losers-bracket match is a drop:
 * the LOSER advances into that slot, not the winner. Every other
 * combination (winners->winners, losers->losers, either->grand_final)
 * advances the winner — this mirrors the W:/L: convention already used
 * by feederLabel() on the read side, just applied here as a write.
 *
 * Safe to call for single elimination too: if there are no downstream
 * matches referencing this one as a feeder (e.g. it's the final), this
 * is a no-op.
 */
export async function advanceResultToNextMatches(
  matchId: string,
  winnerTeamId: string
): Promise<{ ok: boolean; error?: string }> {
  const source = await getMatchTeamsAndType(matchId);
  if (!source) {
    return { ok: false, error: "Source match not found" };
  }

  const loserTeamId =
    source.teamAId && source.teamAId !== winnerTeamId
      ? source.teamAId
      : source.teamBId && source.teamBId !== winnerTeamId
      ? source.teamBId
      : null;

  const { data: targets, error } = await supabase
    .from("bracket_matches")
    .select("id, bracket_type, feeder_match_a_id, feeder_match_b_id")
    .or(`feeder_match_a_id.eq.${matchId},feeder_match_b_id.eq.${matchId}`);

  if (error) {
    console.error("advanceResultToNextMatches lookup failed:", error.message);
    return { ok: false, error: error.message };
  }
  if (!targets || targets.length === 0) {
    // No downstream match references this one (e.g. it's the final) —
    // nothing to advance.
    return { ok: true };
  }

  for (const target of targets) {
    const isDrop = source.bracketType === "winners" && target.bracket_type === "losers";
    const advancingTeamId = isDrop ? loserTeamId : winnerTeamId;

    // If it's a drop but there's no resolvable loser yet (shouldn't
    // normally happen once a match is completed, but guards against a
    // partially-filled match), skip this target rather than writing null
    // over a slot that may already be correctly populated.
    if (!advancingTeamId) continue;

    const field = target.feeder_match_a_id === matchId ? "team_a_id" : "team_b_id";
    const { error: updateError } = await supabase
      .from("bracket_matches")
      .update({ [field]: advancingTeamId })
      .eq("id", target.id);

    if (updateError) {
      console.error(
        `advanceResultToNextMatches: failed to advance team into match ${target.id}:`,
        updateError.message
      );
      // Keep going for other targets (e.g. grand final can be fed by two
      // different matches) rather than bailing out entirely.
    }
  }

  return { ok: true };
}

/**
 * Admin manually edits a match on the bracket page. Always wins over
 * overlay sync from this point forward — sets result_source='manual'
 * so a later overlay completion won't overwrite it silently.
 *
 * On completion, also immediately advances the winner (or, for a
 * winners->losers drop, the loser) into whichever next match(es)
 * reference this one as a feeder — so the next round's card shows the
 * correct team right away instead of waiting on its sibling match.
 */
export async function updateBracketMatchResult(
  matchId: string,
  result: BracketMatchResultInput
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("bracket_matches")
    .update({
      score_a: result.scoreA,
      score_b: result.scoreB,
      winner_team_id: result.winnerTeamId,
      status: result.status,
      ...(result.venue !== undefined ? { venue: result.venue } : {}),
      ...(result.scheduledAt !== undefined ? { scheduled_at: result.scheduledAt } : {}),
      result_source: "manual",
    })
    .eq("id", matchId);

  if (error) {
    console.error("updateBracketMatchResult failed:", error.message);
    return { ok: false, error: error.message };
  }

  if (result.status === "completed" && result.winnerTeamId) {
    const advance = await advanceResultToNextMatches(matchId, result.winnerTeamId);
    if (!advance.ok) {
      console.error("updateBracketMatchResult: failed to advance winner:", advance.error);
      // The result itself already saved successfully — don't fail the
      // whole operation just because propagation to the next match hit
      // an issue; the admin can re-save or the overlay path can retry.
    }
  }

  return { ok: true };
}

/**
 * Called from the overlay-completion path (wherever a live `matches` row
 * gets finalized) for the bracket_matches row linked via overlay_match_id.
 * Skips the write entirely if a human has already manually set this match,
 * so the live engine never stomps a deliberate override.
 *
 * Also advances the winner into the next match immediately on success,
 * same as the manual path above.
 */
export async function syncOverlayResultToBracket(
  overlayMatchId: string,
  result: { scoreA: number; scoreB: number; winnerTeamId: string }
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const { data: existing, error: fetchError } = await supabase
    .from("bracket_matches")
    .select("id, result_source")
    .eq("overlay_match_id", overlayMatchId)
    .maybeSingle();

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!existing) return { ok: true, skipped: true };

  if (existing.result_source === "manual") {
    return { ok: true, skipped: true };
  }

  const { error } = await supabase
    .from("bracket_matches")
    .update({
      score_a: result.scoreA,
      score_b: result.scoreB,
      winner_team_id: result.winnerTeamId,
      status: "completed",
      result_source: "overlay",
    })
    .eq("id", existing.id);

  if (error) return { ok: false, error: error.message };

  const advance = await advanceResultToNextMatches(existing.id, result.winnerTeamId);
  if (!advance.ok) {
    console.error("syncOverlayResultToBracket: failed to advance winner:", advance.error);
    // Result already saved; propagation failure shouldn't surface as an
    // overall failure to the caller.
  }

  return { ok: true };
}

/** Fetches team_a/team_b for a single bracket_matches row — used by the
 *  match-result editor to show team names without needing the full
 *  rounds/DoubleElimData structure passed back in. */
export async function getBracketMatchTeams(
  matchId: string
): Promise<{ teamA: TeamRef; teamB: TeamRef } | null> {
  const { data, error } = await supabase
    .from("bracket_matches")
    .select(`team_a:team_a_id ( id, code, name, color, logo ), team_b:team_b_id ( id, code, name, color, logo )`)
    .eq("id", matchId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    teamA: normalizeOne<TeamRef>((data as any).team_a),
    teamB: normalizeOne<TeamRef>((data as any).team_b),
  };
}

/* ------------------------------------------------------------------ */
/*  Generating a bracket from a tournament's existing teams            */
/*  (append this section to lib/tournament/bracketData.ts)             */
/* ------------------------------------------------------------------ */

type SeedTeam = { id: string; code: string; name: string } | null; // null = bye

/**
 * Finds the auction linked to this tournament and returns its teams in a
 * stable order (by created_at) for seeding. Mirrors the auction lookup in
 * getSquadsForTournament — one auction per tournament, most recent wins if
 * there happen to be more than one.
 */
async function getTeamsForTournament(
  tournamentId: string
): Promise<{ id: string; code: string; name: string }[]> {
  const { data: auction, error: auctionErr } = await supabase
    .from("auctions")
    .select("id")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (auctionErr || !auction) {
    if (auctionErr) console.error("getTeamsForTournament(auction lookup) failed:", auctionErr.message);
    return [];
  }

  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, code, name")
    .eq("auction_id", auction.id)
    .order("created_at", { ascending: true });

  if (teamsErr) {
    console.error("getTeamsForTournament(teams) failed:", teamsErr.message);
    return [];
  }

  return teams ?? [];
}

/**
 * Standard single-elimination seeding order for a bracket of `size`
 * (a power of two): returns an array of 1-indexed seed numbers arranged
 * so that adjacent pairs are the round-1 matchups, top seeds spread out
 * across the bracket (e.g. size=4 -> [1,4,2,3], meaning 1v4 and 2v3).
 */
function seedOrder(size: number): number[] {
  let seeds = [1];
  while (seeds.length < size) {
    const n = seeds.length;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(2 * n + 1 - s);
    }
    seeds = next;
  }
  return seeds;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Generates a single-elimination bracket for a tournament from its
 * existing teams (via the linked auction) and writes it as real
 * bracket_matches rows.
 *
 * - Team count doesn't need to be a power of two: the bracket is padded
 *   up to the next power of two with byes. A bye match is created
 *   already completed, with the present team recorded as the winner, so
 *   it advances into round 2 immediately rather than sitting on an
 *   empty "vs TBD" match waiting for someone to record a result nobody
 *   can play.
 * - Rounds are created in order (round 1 first, then round 2, ...) so
 *   each round's rows can set feeder_match_a_id/feeder_match_b_id to the
 *   *actual* ids of the previous round's just-inserted rows.
 * - Safe to call only when no bracket_matches rows exist yet for this
 *   tournament — callers should guard on that (see the page component),
 *   since this doesn't delete or merge with an existing bracket.
 */
export async function generateBracketForTournament(
  tournamentId: string
): Promise<{ ok: boolean; error?: string }> {
  const teams = await getTeamsForTournament(tournamentId);
  if (teams.length < 2) {
    return { ok: false, error: "Need at least 2 teams with an auction linked to this tournament." };
  }

  const { data: existing, error: existingErr } = await supabase
    .from("bracket_matches")
    .select("id")
    .eq("tournament_id", tournamentId)
    .limit(1);

  if (existingErr) return { ok: false, error: existingErr.message };
  if (existing && existing.length > 0) {
    return { ok: false, error: "A bracket already exists for this tournament." };
  }

  const size = nextPowerOfTwo(teams.length);
  const order = seedOrder(size);
  // order[i] is a 1-indexed seed; map seed -> team, seeds beyond
  // teams.length are byes (null).
  const bracketSlots: SeedTeam[] = order.map((seed) => teams[seed - 1] ?? null);

  const totalRounds = Math.log2(size);

  // previousRoundMatches[i] = { id, winnerTeamId (if a bye decided it already) }
  let previousRoundMatches: { id: string; winnerTeamId: string | null }[] = [];

  for (let round = 1; round <= totalRounds; round++) {
    if (round === 1) {
      const rowsToInsert = [];
      for (let i = 0; i < bracketSlots.length; i += 2) {
        const teamA = bracketSlots[i];
        const teamB = bracketSlots[i + 1];
        const isBye = !teamA || !teamB;
        const winner = !teamA ? teamB : !teamB ? teamA : null;

        rowsToInsert.push({
          tournament_id: tournamentId,
          bracket_type: "winners" as const,
          round,
          position: i / 2,
          team_a_id: teamA?.id ?? null,
          team_b_id: teamB?.id ?? null,
          winner_team_id: winner?.id ?? null,
          status: isBye ? ("completed" as const) : ("upcoming" as const),
          result_source: isBye ? ("manual" as const) : null,
        });
      }

      const { data: inserted, error } = await supabase
        .from("bracket_matches")
        .insert(rowsToInsert)
        .select("id, winner_team_id")
        .order("position", { ascending: true });

      if (error) return { ok: false, error: error.message };
      previousRoundMatches = (inserted ?? []).map((r) => ({ id: r.id, winnerTeamId: r.winner_team_id }));
    } else {
      const rowsToInsert = [];
      for (let i = 0; i < previousRoundMatches.length; i += 2) {
        const feederA = previousRoundMatches[i];
        const feederB = previousRoundMatches[i + 1];

        rowsToInsert.push({
          tournament_id: tournamentId,
          bracket_type: "winners" as const,
          round,
          position: i / 2,
          feeder_match_a_id: feederA.id,
          feeder_match_b_id: feederB.id,
          // If either feeder was already decided by a bye, fill the slot
          // immediately instead of leaving it TBD until someone re-saves
          // that match.
          team_a_id: feederA.winnerTeamId,
          team_b_id: feederB.winnerTeamId,
          status: "upcoming" as const,
        });
      }

      const { data: inserted, error } = await supabase
        .from("bracket_matches")
        .insert(rowsToInsert)
        .select("id, winner_team_id")
        .order("position", { ascending: true });

      if (error) return { ok: false, error: error.message };
      previousRoundMatches = (inserted ?? []).map((r) => ({ id: r.id, winnerTeamId: r.winner_team_id }));
    }
  }

  return { ok: true };
}