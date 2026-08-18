// scripts/repairDoubleElimByes.ts
// One-time repair for tournaments where a bye's losers-bracket slot never
// got resolved (see bracketData.ts bye-handling fix). Safe to re-run —
// only touches rows that are still incomplete because of a bye; never
// overwrites a match that already has a real score/winner.
//
// Run with: npx tsx scripts/repairDoubleElimByes.ts <tournamentId>
// Requires a service-role Supabase client (bypasses RLS) — swap the
// import below for one if your default client is RLS-restricted.

import { supabase } from "@/lib/supabase";
import { advanceResultToNextMatches } from "@/lib/tournament/bracketData";

interface Row {
  id: string;
  bracket_type: "winners" | "losers" | "grand_final" | "round_robin";
  round: number;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_team_id: string | null;
  status: "upcoming" | "live" | "completed";
  feeder_match_a_id: string | null;
  feeder_match_b_id: string | null;
}

async function fetchRows(tournamentId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from("bracket_matches")
    .select(
      "id, bracket_type, round, team_a_id, team_b_id, winner_team_id, status, feeder_match_a_id, feeder_match_b_id"
    )
    .eq("tournament_id", tournamentId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function markCompleted(id: string, winnerTeamId: string) {
  const { error } = await supabase
    .from("bracket_matches")
    .update({ status: "completed", winner_team_id: winnerTeamId })
    .eq("id", id);
  if (error) throw new Error(`Failed to complete ${id}: ${error.message}`);
}

async function fillSlot(id: string, field: "team_a_id" | "team_b_id", teamId: string) {
  const { error } = await supabase
    .from("bracket_matches")
    .update({ [field]: teamId })
    .eq("id", id);
  if (error) throw new Error(`Failed to fill ${field} on ${id}: ${error.message}`);
}

async function repair(tournamentId: string) {
  let changed = true;
  let pass = 0;

  while (changed) {
    changed = false;
    pass++;
    const rows = await fetchRows(tournamentId);
    const byId = new Map(rows.map((r) => [r.id, r]));

    // 1. WB round-1 byes: exactly one real team, never marked completed.
    for (const r of rows) {
      if (r.bracket_type !== "winners" || r.round !== 1) continue;
      if (r.status === "completed") continue;
      const aOnly = r.team_a_id && !r.team_b_id;
      const bOnly = r.team_b_id && !r.team_a_id;
      if (!aOnly && !bOnly) continue;

      const winnerId = (aOnly ? r.team_a_id : r.team_b_id)!;
      console.log(`[pass ${pass}] Completing WB bye ${r.id} -> winner ${winnerId}`);
      await markCompleted(r.id, winnerId);
      // Cascades winners->winners advancement normally (not a drop, since
      // both sides of a WB->WB feed use the winner) — this part already
      // works via your existing function.
      await advanceResultToNextMatches(r.id, winnerId);
      changed = true;
    }

    // 2. Losers-bracket matches with a bye feeder: the "L:" side can
    //    never be filled (a bye produces no loser). If the OTHER side is
    //    already known (a real team dropped in), this match is decided —
    //    complete it and cascade forward the same way.
    for (const r of rows) {
      if (r.bracket_type !== "losers") continue;
      if (r.status === "completed") continue;

      const feederA = r.feeder_match_a_id ? byId.get(r.feeder_match_a_id) : null;
      const feederB = r.feeder_match_b_id ? byId.get(r.feeder_match_b_id) : null;

      const aFeederIsBye =
        feederA?.bracket_type === "winners" &&
        feederA.status === "completed" &&
        (!feederA.team_a_id || !feederA.team_b_id);
      const bFeederIsBye =
        feederB?.bracket_type === "winners" &&
        feederB.status === "completed" &&
        (!feederB.team_a_id || !feederB.team_b_id);

      if (!aFeederIsBye && !bFeederIsBye) continue;

      const realSlot = aFeederIsBye ? r.team_b_id : r.team_a_id;
      const emptySlot = aFeederIsBye ? r.team_a_id : r.team_b_id;

      // Both sides empty (double-bye) — nothing to resolve yet this pass.
      if (!realSlot) continue;
      // Already has both — shouldn't hit the bye branch, skip defensively.
      if (emptySlot) continue;

      console.log(`[pass ${pass}] Completing LB bye-through ${r.id} -> winner ${realSlot}`);
      await markCompleted(r.id, realSlot);
      await advanceResultToNextMatches(r.id, realSlot);
      changed = true;
    }
  }

  console.log(`Done after ${pass} pass(es).`);
}

const tournamentId = process.argv[2];
if (!tournamentId) {
  console.error("Usage: npx tsx scripts/repairDoubleElimByes.ts <tournamentId>");
  process.exit(1);
}
repair(tournamentId).catch((e) => {
  console.error(e);
  process.exit(1);
});