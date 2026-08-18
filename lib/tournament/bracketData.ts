// lib/tournament/bracketData.ts
import { supabase } from "@/lib/supabase";
import type { Round, MatchNode, TeamNode } from "@/components/tournament/TournamentBracket";
import type { DoubleElimData } from "@/lib/tournament/doubleElim";
import { roundMetaFor } from "@/lib/tournament/seeding";
import {
  teamFromResult,
  resolveByeIfNeeded,
} from "@/lib/tournament/doubleElim";
import { BYE_TEAM } from "@/lib/tournament/seeding";

/* ------------------------------------------------------------------ */
/*  Raw row shape, straight off bracket_matches + team joins           */
/* ------------------------------------------------------------------ */

type TeamRef = { id: string; code: string; name: string; color: string; logo: string | null } | null;

interface BracketMatchRow {
  id: string;
  bracket_type: "winners" | "losers" | "grand_final" | "round_robin";
  round: number;
  position: number;
  match_number: number | null;
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
      match_number,
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
    matchNumber: row.match_number ?? undefined,
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
/*  Bye reconciliation — CLIENT-SIDE (in-memory, read path)            */
/*                                                                      */
/*  CONFIRMED DB CONVENTION (from production data, not assumption):    */
/*  a bye is never represented as a live "L:<id>" reference to a bye   */
/*  match. Instead, the dead side of a losers-bracket slot is simply   */
/*  left with NO team and NO feeder (feeder_match_*_id is null). A     */
/*  "phantom" double-bye slot (both WB1 feeders were byes) is stored   */
/*  as status:'completed' with winner_team_id: null and no feeders at  */
/*  all — a decided-but-empty placeholder that flows forward.          */
/*                                                                      */
/*  This pass detects dead slots by that shape — not by chasing "L:"   */
/*  strings — and repeats to a fixed point so multi-round bye chains   */
/*  resolve correctly no matter how deep.                              */
/* ------------------------------------------------------------------ */

/** WB round 1 is the only round where teams are seeded directly rather
 *  than fed from an earlier match, so a null feeder there is normal —
 *  byes are instead detected by "only one real team present". */
function markWinnersByes(winners: Round[]) {
  const wb1 = winners[0];
  if (!wb1) return;
  for (const m of wb1.matches) {
    if (m.status === "completed") continue;
    const aOnly = m.teamA && !m.teamB;
    const bOnly = m.teamB && !m.teamA;
    if (aOnly) {
      m.status = "completed";
      m.teamA = { ...m.teamA!, isWinner: true };
      m.teamB = { ...BYE_TEAM };
    } else if (bOnly) {
      m.status = "completed";
      m.teamB = { ...m.teamB!, isWinner: true };
      m.teamA = { ...BYE_TEAM };
    }
  }
}

/** A losers-bracket slot's feeder is "dead" if there's no feeder at all,
 *  or the feeder match is completed but produced no winner (a phantom
 *  bye slot itself) — meaning nothing will ever arrive in that side. */
function isDeadFeeder(fromLabel: string | null, byId: Map<string, MatchNode>): boolean {
  if (!fromLabel) return true;
  const source = byId.get(fromLabel.slice(2));
  if (!source) return false;
  if (source.status !== "completed") return false;
  const hasWinner = !!(source.teamA?.isWinner || source.teamB?.isWinner);
  return !hasWinner;
}

function allDoubleElimNodes(data: DoubleElimData): MatchNode[] {
  return [
    ...data.winners.flatMap((r) => r.matches),
    ...data.losers.flatMap((r) => r.matches),
    data.grandFinal,
    ...(data.bracketReset ? [data.bracketReset] : []),
  ];
}

/**
 * Runs after buildDoubleEliminationData reconstructs the bracket from DB
 * rows. Fixes byes purely from structure — no team + no live feeder in
 * a losers-bracket slot means it's a permanent bye-through, matching the
 * confirmed DB convention. Repeats to a fixed point so bye chains and
 * downstream advancement cascade correctly.
 */
function resolveByesInDoubleElimData(data: DoubleElimData): DoubleElimData {
  markWinnersByes(data.winners);

  let changed = true;
  while (changed) {
    changed = false;
    const nodes = allDoubleElimNodes(data);
    const byId = new Map(nodes.map((m) => [m.id, m]));

    // Losers-bracket dead-slot detection.
    for (const round of data.losers) {
      for (const m of round.matches) {
        if (m.status === "completed") continue;
        if (!m.teamA && isDeadFeeder(m.aFrom, byId)) {
          m.teamA = { ...BYE_TEAM };
          changed = true;
        }
        if (!m.teamB && isDeadFeeder(m.bFrom, byId)) {
          m.teamB = { ...BYE_TEAM };
          changed = true;
        }
      }
    }

    // Advance real results along W:/L: references.
    for (const target of nodes) {
      if (target.aFrom && !target.teamA) {
        const source = byId.get(target.aFrom.slice(2));
        const team = source ? teamFromResult(source, target.aFrom.startsWith("L:")) : null;
        if (team) {
          target.teamA = { ...team, score: undefined, isWinner: undefined };
          changed = true;
        }
      }
      if (target.bFrom && !target.teamB) {
        const source = byId.get(target.bFrom.slice(2));
        const team = source ? teamFromResult(source, target.bFrom.startsWith("L:")) : null;
        if (team) {
          target.teamB = { ...team, score: undefined, isWinner: undefined };
          changed = true;
        }
      }
    }

    // Complete any slot that now has a real team opposite a BYE placeholder.
    for (const m of nodes) {
      if (resolveByeIfNeeded(m)) changed = true;
    }

    // Double-bye slot: both sides are BYE placeholders — resolve as a
    // decided-but-empty phantom so it can still flow forward and later
    // be swapped for a real team, without falsely marking either side
    // "isWinner" (there is no real winner here).
    for (const round of data.losers) {
      for (const m of round.matches) {
        const aIsBye = m.teamA?.code === "BYE";
        const bIsBye = m.teamB?.code === "BYE";
        if (aIsBye && bIsBye && m.status !== "completed") {
          m.status = "completed";
          changed = true;
        }
      }
    }
  }

  return data;
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

  return resolveByesInDoubleElimData({ winners, losers, grandFinal, bracketReset });
}

/* ------------------------------------------------------------------ */
/*  Bye reconciliation — SERVER-SIDE (writes to bracket_matches)       */
/*                                                                      */
/*  Same dead-slot convention as the client-side pass above, but       */
/*  operating directly on DB rows and persisting the result — this is  */
/*  what actually unblocks the admin from recording the NEXT match,    */
/*  since the client-side pass alone only fixes what's *displayed*,    */
/*  not what's stored. Idempotent: safe to call after every write.     */
/* ------------------------------------------------------------------ */

interface RawRow {
  id: string;
  status: "upcoming" | "live" | "completed";
  team_a_id: string | null;
  team_b_id: string | null;
  winner_team_id: string | null;
  feeder_match_a_id: string | null;
  feeder_match_b_id: string | null;
}

async function fetchRawRows(tournamentId: string): Promise<RawRow[]> {
  const { data, error } = await supabase
    .from("bracket_matches")
    .select("id, status, team_a_id, team_b_id, winner_team_id, feeder_match_a_id, feeder_match_b_id")
    .eq("tournament_id", tournamentId);
  if (error) {
    console.error("reconcileByeMatches: fetch failed:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Walks every bracket_matches row for a tournament and completes any
 * "dead" losers-bracket slot — no team and no live feeder (or a feeder
 * that itself resolved to a phantom bye) — as an automatic bye-through
 * for whichever real team sits in the other slot. Also cascades the
 * result forward via advanceResultToNextMatches, and re-propagates any
 * already-completed match as a safety net for anything previously missed.
 *
 * Call this after bracket generation and after every result write —
 * it's cheap, idempotent, and the single source of truth for the bye
 * convention so we don't end up with two slightly different
 * implementations drifting apart again.
 */
export async function reconcileByeMatches(tournamentId: string): Promise<{ touched: string[] }> {
  const touched: string[] = [];
  let changed = true;

  while (changed) {
    changed = false;
    const rows = await fetchRawRows(tournamentId);
    const byId = new Map(rows.map((r) => [r.id, r]));

    // Safety net: re-propagate anything already completed, in case an
    // earlier advance was missed for any reason.
    for (const r of rows) {
      if (r.status === "completed" && r.winner_team_id) {
        await advanceResultToNextMatches(r.id, r.winner_team_id);
      }
    }

    function isDead(feederId: string | null): boolean {
      if (!feederId) return true;
      const feeder = byId.get(feederId);
      if (!feeder) return false;
      return feeder.status === "completed" && !feeder.winner_team_id;
    }

    for (const r of rows) {
      if (r.status === "completed") continue;
      const aDead = !r.team_a_id && isDead(r.feeder_match_a_id);
      const bDead = !r.team_b_id && isDead(r.feeder_match_b_id);

      if (r.team_a_id && bDead) {
        await supabase
          .from("bracket_matches")
          .update({ status: "completed", winner_team_id: r.team_a_id })
          .eq("id", r.id);
        await advanceResultToNextMatches(r.id, r.team_a_id);
        touched.push(r.id);
        changed = true;
      } else if (r.team_b_id && aDead) {
        await supabase
          .from("bracket_matches")
          .update({ status: "completed", winner_team_id: r.team_b_id })
          .eq("id", r.id);
        await advanceResultToNextMatches(r.id, r.team_b_id);
        touched.push(r.id);
        changed = true;
      } else if (!r.team_a_id && !r.team_b_id && aDead && bDead) {
        await supabase.from("bracket_matches").update({ status: "completed" }).eq("id", r.id);
        touched.push(r.id);
        changed = true;
      }
    }
  }

  return { touched };
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

async function getMatchTeamsAndType(matchId: string): Promise<{
  bracketType: BracketMatchRow["bracket_type"];
  teamAId: string | null;
  teamBId: string | null;
  tournamentId: string | null;
} | null> {
  const { data, error } = await supabase
    .from("bracket_matches")
    .select("bracket_type, team_a_id, team_b_id, tournament_id")
    .eq("id", matchId)
    .maybeSingle();

  if (error) {
    console.error("getMatchTeamsAndType failed:", error.message);
    return null;
  }
  if (!data) return null;

  return {
    bracketType: data.bracket_type,
    teamAId: data.team_a_id,
    teamBId: data.team_b_id,
    tournamentId: (data as any).tournament_id ?? null,
  };
}

/**
 * After a match is completed, pushes the advancing team(s) straight into
 * whichever downstream match(es) reference this match as a feeder, then
 * runs reconcileByeMatches for the tournament as a safety net so any
 * bye-through slot that's now decided also gets completed and cascaded —
 * this is what makes future double-elim brackets self-heal automatically
 * instead of getting stuck the way this tournament did.
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

  if (targets && targets.length > 0) {
    for (const target of targets) {
      const isDrop = source.bracketType === "winners" && target.bracket_type === "losers";
      const advancingTeamId = isDrop ? loserTeamId : winnerTeamId;
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
      }
    }
  }

  // Safety net: sweep for any bye-through slot that's now decided as a
  // result of this write, and cascade it forward too.
  if (source.tournamentId) {
    try {
      await reconcileByeMatches(source.tournamentId);
    } catch (e) {
      console.error("advanceResultToNextMatches: reconcileByeMatches failed:", e);
      // Don't fail the whole call — the primary advancement above already
      // succeeded; reconciliation is a best-effort extra pass.
    }
  }

  return { ok: true };
}

/**
 * Admin manually edits a match on the bracket page. Always wins over
 * overlay sync from this point forward — sets result_source='manual'
 * so a later overlay completion won't overwrite it silently.
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
    }
  }

  return { ok: true };
}

/**
 * Called from the overlay-completion path for the bracket_matches row
 * linked via overlay_match_id. Skips the write entirely if a human has
 * already manually set this match.
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