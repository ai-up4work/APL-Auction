// lib/tournament/fixtures.ts
// ─────────────────────────────────────────────────────────────────────────────
// Fixture data for the Tournament Edit page's Matches section. Separate from
// lib/tournament/overlay.ts's getFixturesForTournamentOverlay (that one is
// shaped for the /overlay picker flow) — this one is shaped for inline
// editing: venue/schedule fields plus whether a manual match_setup exists.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";

export type EditableFixture = {
  id: string; // bracket_matches.id
  round: number;
  bracketType: "winners" | "losers" | "grand_final" | "round_robin";
  status: "upcoming" | "live" | "completed";
  venue: string | null;
  scheduledAt: string | null; // ISO, for <input type="datetime-local">
  overlayMatchId: string | null;
  teamA: { id: string; name: string } | null;
  teamB: { id: string; name: string } | null;
};

export async function getFixturesForTournamentEdit(
  tournamentId: string
): Promise<EditableFixture[]> {
  const { data, error } = await supabase
    .from("bracket_matches")
    .select(
      `
      id, round, bracket_type, status, venue, scheduled_at, overlay_match_id,
      team_a:team_a_id ( id, name ),
      team_b:team_b_id ( id, name )
      `
    )
    .eq("tournament_id", tournamentId)
    .order("round", { ascending: true })
    .order("position", { ascending: true });

  if (error) {
    console.error("getFixturesForTournamentEdit failed:", error.message);
    return [];
  }

  return (data ?? []).map((m: any) => {
    const teamA = Array.isArray(m.team_a) ? m.team_a[0] : m.team_a;
    const teamB = Array.isArray(m.team_b) ? m.team_b[0] : m.team_b;
    return {
      id: m.id,
      round: m.round,
      bracketType: m.bracket_type,
      status: m.status,
      venue: m.venue,
      scheduledAt: m.scheduled_at,
      overlayMatchId: m.overlay_match_id,
      teamA: teamA ? { id: teamA.id, name: teamA.name } : null,
      teamB: teamB ? { id: teamB.id, name: teamB.name } : null,
    };
  });
}

/**
 * Updates only scheduling fields — venue/scheduled_at. Low-risk, separate
 * from result/match-setup changes on purpose (see prior discussion: match
 * results propagate to bracket progression and shouldn't share a save
 * button with "what time does this start").
 */
export async function updateFixtureSchedule(
  bracketMatchId: string,
  patch: { venue?: string; scheduledAt?: string | null }
): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (patch.venue !== undefined) payload.venue = patch.venue;
  if (patch.scheduledAt !== undefined) payload.scheduled_at = patch.scheduledAt;

  const { error } = await supabase.from("bracket_matches").update(payload).eq("id", bracketMatchId);
  if (error) {
    console.error("updateFixtureSchedule failed:", error.message);
    return false;
  }
  return true;
}