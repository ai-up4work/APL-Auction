// app/api/admin/repair-byes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { advanceResultToNextMatches } from "@/lib/tournament/bracketData";

interface Row {
  id: string;
  bracket_type: string;
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
      "id, bracket_type, team_a_id, team_b_id, winner_team_id, status, feeder_match_a_id, feeder_match_b_id"
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

async function repair(tournamentId: string) {
  const log: string[] = [];
  let changed = true;
  let pass = 0;

  while (changed) {
    changed = false;
    pass++;
    const rows = await fetchRows(tournamentId);
    const byId = new Map(rows.map((r) => [r.id, r]));

    // Safety net: re-run propagation for every already-completed match
    // with a winner, in case an earlier advance was missed.
    for (const r of rows) {
      if (r.status === "completed" && r.winner_team_id) {
        await advanceResultToNextMatches(r.id, r.winner_team_id);
      }
    }

    // A slot is "dead" if it has no team AND (no feeder at all, OR its
    // feeder is a completed match with no winner — a phantom bye).
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
        log.push(`[pass ${pass}] ${r.id}: bye-through -> winner ${r.team_a_id}`);
        await markCompleted(r.id, r.team_a_id);
        await advanceResultToNextMatches(r.id, r.team_a_id);
        changed = true;
      } else if (r.team_b_id && aDead) {
        log.push(`[pass ${pass}] ${r.id}: bye-through -> winner ${r.team_b_id}`);
        await markCompleted(r.id, r.team_b_id);
        await advanceResultToNextMatches(r.id, r.team_b_id);
        changed = true;
      } else if (!r.team_a_id && !r.team_b_id && aDead && bDead) {
        log.push(`[pass ${pass}] ${r.id}: phantom double-bye, marking completed (no winner)`);
        const { error } = await supabase
          .from("bracket_matches")
          .update({ status: "completed" })
          .eq("id", r.id);
        if (error) throw new Error(error.message);
        changed = true;
      }
    }
  }

  log.push(`Done after ${pass} pass(es).`);
  return log;
}

export async function POST(req: NextRequest) {
  let tournamentId: string | undefined;
  try {
    const body = await req.json();
    tournamentId = body?.tournamentId;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!tournamentId) {
    return NextResponse.json({ ok: false, error: "tournamentId is required" }, { status: 400 });
  }
  try {
    const log = await repair(tournamentId);
    return NextResponse.json({ ok: true, log });
  } catch (e: any) {
    console.error("repair-byes failed:", e);
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}