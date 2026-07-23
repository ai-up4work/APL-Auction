import { supabase } from "@/lib/supabase";
import type { Round, MatchNode } from "@/components/tournament/TournamentBracket";
import type { DoubleElimData } from "@/lib/tournament/doubleElim";
import { generateSingleElimination } from "@/lib/tournament/singleElim";
import { generateDoubleElimination } from "@/lib/tournament/doubleElim";
import { randomDraw, type AdminTeam } from "@/lib/tournament/seeding";

export type SeedingMethod = "random" | "creation_order";

export interface GenerateBracketResult {
  ok: boolean;
  error?: string;
}

/**
 * Checks whether bracket_matches already has any rows for this tournament —
 * used to gate the "Generate" button (show "Regenerate" instead) without
 * fetching the full bracket.
 */
export async function hasBracketGenerated(tournamentId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("bracket_matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);
  if (error) {
    console.error("hasBracketGenerated failed:", error.message);
    return false;
  }
  return !!count && count > 0;
}

/** Deletes every bracket_matches row for a tournament — call before
 *  generateBracketForTournament if you want to regenerate from scratch. */
export async function deleteBracketForTournament(tournamentId: string): Promise<GenerateBracketResult> {
  const { error } = await supabase.from("bracket_matches").delete().eq("tournament_id", tournamentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Populates bracket_matches for a tournament from its linked auction's
 * teams. Refuses if a bracket already exists — call
 * deleteBracketForTournament first if the caller wants to regenerate.
 *
 * Inserts are sequential (one row at a time, round by round) rather than
 * batched, so each row's real DB uuid is known before later rounds need
 * to reference it as a feeder_match_a_id/feeder_match_b_id — batching
 * with .select() would rely on Postgres preserving row order, which this
 * avoids entirely.
 */
export async function generateBracketForTournament(
  tournamentId: string,
  seeding: SeedingMethod = "random"
): Promise<GenerateBracketResult> {
  const { data: tournament, error: tErr } = await supabase
    .from("tournaments")
    .select("id, format")
    .eq("id", tournamentId)
    .single();
  if (tErr || !tournament) return { ok: false, error: "Tournament not found." };
  if (tournament.format === "round_robin") {
    return { ok: false, error: "Round-robin tournaments don't use a bracket." };
  }

  if (await hasBracketGenerated(tournamentId)) {
    return { ok: false, error: "A bracket already exists for this tournament." };
  }

  const { data: auction, error: aErr } = await supabase
    .from("auctions")
    .select("id")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (aErr) return { ok: false, error: aErr.message };
  if (!auction) return { ok: false, error: "No auction is linked to this tournament yet." };

  const { data: teamsRaw, error: teamsErr } = await supabase
    .from("teams")
    .select("id, code, name, color, logo, created_at")
    .eq("auction_id", auction.id)
    .order("created_at", { ascending: true });
  if (teamsErr) return { ok: false, error: teamsErr.message };
  if (!teamsRaw || teamsRaw.length < 2) {
    return { ok: false, error: "Need at least 2 teams to generate a bracket." };
  }

  const teams: AdminTeam[] = teamsRaw.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    color: t.color || undefined,
    logo: t.logo || undefined,
  }));
  const seeded = seeding === "random" ? randomDraw(teams) : teams;

  try {
    if (tournament.format === "double_elimination") {
      const data = generateDoubleElimination(seeded);
      await insertDoubleElim(tournamentId, data);
    } else {
      const rounds = generateSingleElimination(seeded);
      await insertSingleElim(tournamentId, rounds);
    }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Failed to generate bracket." };
  }

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function realTeamId(team: MatchNode["teamA"]): string | null {
  if (!team || team.code === "BYE") return null;
  return team.id;
}

function realWinnerId(m: MatchNode): string | null {
  if (m.teamA?.isWinner && m.teamA.code !== "BYE") return m.teamA.id;
  if (m.teamB?.isWinner && m.teamB.code !== "BYE") return m.teamB.id;
  return null;
}

function stripPrefix(label: string | null): string | null {
  return label ? label.replace(/^[WL]:/, "") : null;
}

/* ------------------------------------------------------------------ */
/*  Single elimination insert                                           */
/* ------------------------------------------------------------------ */

async function insertSingleElim(tournamentId: string, rounds: Round[]) {
  const idMap = new Map<string, string>(); // generated match id -> real uuid

  for (let r = 0; r < rounds.length; r++) {
    const round = rounds[r];
    for (let i = 0; i < round.matches.length; i++) {
      const m = round.matches[i];
      const row = {
        tournament_id: tournamentId,
        bracket_type: "winners" as const,
        round: r + 1,
        position: i + 1,
        team_a_id: realTeamId(m.teamA),
        team_b_id: realTeamId(m.teamB),
        feeder_match_a_id: m.aFrom ? idMap.get(m.aFrom) ?? null : null,
        feeder_match_b_id: m.bFrom ? idMap.get(m.bFrom) ?? null : null,
        status: m.status === "completed" ? "completed" : "upcoming",
        winner_team_id: realWinnerId(m),
      };
      const { data, error } = await supabase.from("bracket_matches").insert(row).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "Insert failed.");
      idMap.set(m.id, data.id);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Double elimination insert                                           */
/* ------------------------------------------------------------------ */

async function insertDoubleElim(tournamentId: string, data: DoubleElimData) {
  const idMap = new Map<string, string>();

  async function insertRound(round: Round, bracketType: "winners" | "losers", roundNumber: number) {
    for (let i = 0; i < round.matches.length; i++) {
      const m = round.matches[i];
      const feederA = stripPrefix(m.aFrom);
      const feederB = stripPrefix(m.bFrom);
      const row = {
        tournament_id: tournamentId,
        bracket_type: bracketType,
        round: roundNumber,
        position: i + 1,
        team_a_id: realTeamId(m.teamA),
        team_b_id: realTeamId(m.teamB),
        feeder_match_a_id: feederA ? idMap.get(feederA) ?? null : null,
        feeder_match_b_id: feederB ? idMap.get(feederB) ?? null : null,
        status: m.status === "completed" ? "completed" : "upcoming",
        winner_team_id: realWinnerId(m),
      };
      const { data: inserted, error } = await supabase.from("bracket_matches").insert(row).select("id").single();
      if (error || !inserted) throw new Error(error?.message ?? "Insert failed.");
      idMap.set(m.id, inserted.id);
    }
  }

  for (let ri = 0; ri < data.winners.length; ri++) {
    await insertRound(data.winners[ri], "winners", ri + 1);
  }
  for (let ri = 0; ri < data.losers.length; ri++) {
    await insertRound(data.losers[ri], "losers", ri + 1);
  }

  const gfFeederA = stripPrefix(data.grandFinal.aFrom);
  const gfFeederB = stripPrefix(data.grandFinal.bFrom);
  const { error: gfErr } = await supabase.from("bracket_matches").insert({
    tournament_id: tournamentId,
    bracket_type: "grand_final" as const,
    round: 1,
    position: 1,
    team_a_id: realTeamId(data.grandFinal.teamA),
    team_b_id: realTeamId(data.grandFinal.teamB),
    feeder_match_a_id: gfFeederA ? idMap.get(gfFeederA) ?? null : null,
    feeder_match_b_id: gfFeederB ? idMap.get(gfFeederB) ?? null : null,
    status: data.grandFinal.status === "completed" ? "completed" : "upcoming",
    winner_team_id: realWinnerId(data.grandFinal),
  });
  if (gfErr) throw new Error(gfErr.message);

  // bracketReset is only created in-memory after a real grand-final result
  // is recorded (see recordDoubleElimResult) — there's nothing to insert
  // for it yet at generation time.
}