// lib/tournament/overlay.ts
import { supabase } from "@/lib/supabase";
import { getOrCreateMatch } from "@/lib/matchPersistence";

export type OverlayFixture = {
  id: string; // bracket_matches.id
  round: number;
  status: "upcoming" | "live" | "completed";
  venue: string | null;
  scheduledAt: string | null;
  overlayMatchId: string | null;
  tournamentId: string;
  tournamentName: string;
  teamA: { id: string; name: string; code: string };
  teamB: { id: string; name: string; code: string };
};

export type TournamentOption = {
  id: string;
  name: string;
  format: "single_elimination" | "double_elimination" | "round_robin";
  fixtureCount: number;
};

/**
 * Tournaments that actually have fixtures to pick from — feeds the
 * "By Tournament" selector. Counting via a second grouped query rather
 * than embedding bracket_matches(*) and counting client-side, since we
 * only need the count here, not the rows.
 */
export async function getTournamentsWithFixtures(): Promise<TournamentOption[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, format, bracket_matches(count)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getTournamentsWithFixtures failed:", error.message);
    return [];
  }

  return (data ?? [])
    .map((t: any) => ({
      id: t.id,
      name: t.name,
      format: t.format,
      fixtureCount: t.bracket_matches?.[0]?.count ?? 0,
    }))
    .filter((t) => t.fixtureCount > 0);
}

/**
 * Fixtures for one tournament, eligible for overlay (both teams resolved).
 * Same shape as before, just scoped to a single tournament instead of all.
 */
export async function getFixturesForTournamentOverlay(
  tournamentId: string
): Promise<OverlayFixture[]> {
  const { data, error } = await supabase
    .from("bracket_matches")
    .select(
      `
      id, round, status, venue, scheduled_at, overlay_match_id,
      tournament:tournament_id ( id, name ),
      team_a:team_a_id ( id, name, code ),
      team_b:team_b_id ( id, name, code )
      `
    )
    .eq("tournament_id", tournamentId)
    .not("team_a_id", "is", null)
    .not("team_b_id", "is", null)
    .order("round", { ascending: true });

  if (error) {
    console.error("getFixturesForTournamentOverlay failed:", error.message);
    return [];
  }

  return (data ?? []).map((m: any) => {
    const tournament = Array.isArray(m.tournament) ? m.tournament[0] : m.tournament;
    const teamA = Array.isArray(m.team_a) ? m.team_a[0] : m.team_a;
    const teamB = Array.isArray(m.team_b) ? m.team_b[0] : m.team_b;
    return {
      id: m.id,
      round: m.round,
      status: m.status,
      venue: m.venue,
      scheduledAt: m.scheduled_at,
      overlayMatchId: m.overlay_match_id,
      tournamentId: tournament?.id ?? "",
      tournamentName: tournament?.name ?? "Unknown Tournament",
      teamA: { id: teamA?.id ?? "", name: teamA?.name ?? "TBD", code: teamA?.code ?? "TBD" },
      teamB: { id: teamB?.id ?? "", name: teamB?.name ?? "TBD", code: teamB?.code ?? "TBD" },
    };
  });
}

/**
 * Manual path: auctions not necessarily tied to any tournament fixture —
 * lets the admin jump straight into an overlay for any auction (e.g.
 * standalone exhibition matches, or testing). Shows every auction with
 * its team count so an empty/unset-up auction isn't a dead end.
 */
export type AuctionOption = {
  id: string;
  name: string;
  status: string;
  teamCount: number;
};

export async function getAuctionsForManualOverlay(): Promise<AuctionOption[]> {
  const { data, error } = await supabase
    .from("auctions")
    .select("id, name, status, teams(count)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAuctionsForManualOverlay failed:", error.message);
    return [];
  }

  return (data ?? []).map((a: any) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    teamCount: a.teams?.[0]?.count ?? 0,
  }));
}

/**
 * Resolves the real auction_id backing a fixture (teams.auction_id is the
 * real FK, unlike matches.auction_id).
 */
export async function resolveAuctionIdForFixture(bracketMatchId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("bracket_matches")
    .select("team_a:team_a_id ( auction_id )")
    .eq("id", bracketMatchId)
    .single();

  if (error || !data) {
    console.error("resolveAuctionIdForFixture failed:", error?.message);
    return null;
  }
  const teamA: any = Array.isArray(data.team_a) ? data.team_a[0] : data.team_a;
  return teamA?.auction_id ?? null;
}

/**
 * The one function the picker calls for a tournament fixture. Combines:
 *   1. resolve auction_id from the fixture's teams
 *   2. getOrCreateMatch(auctionId) — guarantees a `matches` row exists
 *      BEFORE we try to link, closing the "link silently no-ops on first
 *      visit" gap from before
 *   3. backfill bracket_matches.overlay_match_id + status='live'
 * Returns the auctionId to navigate to either way — steps 2/3 are best
 * effort bookkeeping, not blockers, so a link failure still lets the
 * admin get into the overlay (just without bracket progression wired up
 * yet, which can self-heal next time this runs).
 */
export async function startOverlayForFixture(
  bracketMatchId: string
): Promise<{ ok: true; auctionId: string } | { ok: false; error: string }> {
  const auctionId = await resolveAuctionIdForFixture(bracketMatchId);
  if (!auctionId) {
    return { ok: false, error: "Couldn't resolve the auction for this fixture." };
  }

  const match = await getOrCreateMatch(auctionId);
  if (!match) {
    return { ok: false, error: "Couldn't create or load the match record." };
  }

  const { error: linkErr } = await supabase
    .from("bracket_matches")
    .update({ overlay_match_id: match.id, status: "live" })
    .eq("id", bracketMatchId);

  if (linkErr) {
    console.error("startOverlayForFixture(link) failed:", linkErr.message);
    // Non-fatal — still navigate, just log it.
  }

  return { ok: true, auctionId };
}