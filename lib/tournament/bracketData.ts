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