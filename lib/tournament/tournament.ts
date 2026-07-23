// lib/tournament/tournament.ts
// ─────────────────────────────────────────────────────────────────────────────
// Data access for tournaments, using the shared Supabase client (lib/supabase.ts).
//
// Org scoping here is a query-shape/perf convenience, not the security
// boundary — RLS policies on `tournaments` (via `is_org_member`) are what
// actually enforce that a user can only ever see their own org's rows.
//
// NOTE: `supabase` from lib/supabase.ts persists its session in localStorage,
// which only exists in the browser. If this file is imported into a Server
// Component, there's no localStorage on the server to read a session from —
// queries run as the anonymous role. getTournamentById below is written to
// be called from app/tournament/[slug]/page.tsx (a Server Component), so it
// will only return rows visible to `anon` under your RLS policies. If
// `tournaments` requires org membership to read, this will 404 for every
// tournament until either (a) RLS grants anon SELECT on the fields needed
// for a public tournament page, or (b) this is switched to a cookie-based
// server client instead.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";
import type { Tournament, BracketMatch } from "@/data/tournament-data";
import { slugify } from "@/data/tournament-data";
// Tournament = ShowcaseSlide & TournamentExtras. ShowcaseSlide only requires
// tag, slug, title, by, image — everything else on it (and all of
// TournamentExtras) is optional, so a partial DB mapping is a valid
// Tournament as long as those five are present. No `as Tournament` cast
// needed; TypeScript enforces the required fields directly below.

export type TournamentCardData = {
  id: string;
  title: string;
  by: string;
  tag: string;
  image: string;
  status: string;
};

/**
 * `tournaments.status` is unconstrained free text (defaults to `'setup'`,
 * no CHECK constraint in the schema), but ShowcaseSlide.status is the
 * strict union "Upcoming" | "Live" | "Completed". This maps the known
 * values and falls back to "Upcoming" for anything else (e.g. "setup",
 * "paused") rather than silently producing an invalid value.
 */
function mapTournamentStatus(dbStatus: string): "Upcoming" | "Live" | "Completed" {
  const normalized = dbStatus.toLowerCase();
  if (normalized === "live") return "Live";
  if (normalized === "completed") return "Completed";
  return "Upcoming";
}

/**
 * Fetches every tournament belonging to the given org.
 */
export async function getTournamentsForOrg(
  orgId: string
): Promise<TournamentCardData[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      `
      id,
      name,
      format,
      status,
      created_at,
      organizations ( name, logo_url )
    `
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getTournamentsForOrg failed:", error.message);
    return [];
  }

  return (data ?? []).map((t) => {
    // Supabase sometimes infers an embedded single-row relation as an array
    // type even though it's one row per tournament. Normalize both shapes.
    const org = Array.isArray(t.organizations)
      ? t.organizations[0]
      : t.organizations;

    return {
      id: t.id,
      title: t.name,
      by: org?.name ?? "Unknown Org",
      tag: t.format === "single_elimination" ? "Knockout" : "Double Elim",
      image: org?.logo_url || "/placeholder.svg",
      status: t.status,
    };
  });
}

/**
 * Resolves a user's org id from their profile.
 * Pass the id from useAuth()'s `user` — no need to re-fetch the session here.
 * Returns null if the profile has no org set.
 */
export async function getOrgIdForUser(userId: string): Promise<string | null> {
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("current_org_id")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("getOrgIdForUser failed:", error.message);
    return null;
  }

  return profile?.current_org_id ?? null;
}

/**
 * Convenience wrapper: resolves the given user's org, then fetches that
 * org's tournaments. Returns an empty array if there's no org — callers
 * decide how to handle that (empty state, prompt to join an org, etc).
 */
export async function getTournamentsForUser(userId: string): Promise<{
  orgId: string | null;
  tournaments: TournamentCardData[];
}> {
  const orgId = await getOrgIdForUser(userId);
  if (!orgId) {
    return { orgId: null, tournaments: [] };
  }

  const tournaments = await getTournamentsForOrg(orgId);
  return { orgId, tournaments };
}

/**
 * Fetches a single tournament (by tournaments.id) with its bracket, for the
 * public tournament detail page.
 *
 * SCOPE NOTE — the `tournaments` table + related schema only supports a
 * subset of the `Tournament` (ShowcaseSlide & TournamentExtras) type that
 * TournamentDetailClient renders:
 *   - slug, title (name), by/image (via organizations), status: mapped ✅
 *     (slug is DERIVED via slugify(name) — tournaments has no slug column,
 *     so this breaks if two tournaments share a name; see note below)
 *   - tag: mapped from `format`, but onto a DIFFERENT vocabulary than the
 *     rest of the showcase uses ("Knockout"/"Double Elim" vs "Auction"/
 *     "Bracket"/"Overlay"/"League") — there's no column indicating which
 *     of those four categories a tournament belongs to.
 *   - bracket: mapped ✅ via bracket_matches.tournament_id (direct FK)
 *   - pointsTable: NOT mapped. `standings` links to `auctions.id`
 *     (auction_id), and `auctions` links to `tournaments.id` — there's no
 *     direct tournaments -> standings path. Populating this needs a join
 *     through `auctions` (tournaments.id -> auctions.tournament_id ->
 *     standings.auction_id), and only works if a tournament has exactly
 *     one associated auction.
 *   - liveMatch, fixtures, squads, runsLeaderboard, wicketsLeaderboard,
 *     awards, prizePool, prizes, description, startDate, website, twitter,
 *     discord: NOT mapped — no columns anywhere in the schema for these.
 *     All optional on the type, so simply omitted here; TournamentDetailClient's
 *     existing hasX checks hide those tabs rather than render broken data.
 */
export async function getTournamentById(id: string): Promise<Tournament | null> {
  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select(
      `
      id,
      name,
      format,
      status,
      organizations ( name, logo_url )
    `
    )
    .eq("id", id)
    .single();

  if (error || !tournament) {
    console.error("getTournamentById failed:", error?.message);
    return null;
  }

  const org = Array.isArray(tournament.organizations)
    ? tournament.organizations[0]
    : tournament.organizations;

  const { data: bracketRows, error: bracketError } = await supabase
    .from("bracket_matches")
    .select(
      `
      id,
      round,
      score_a,
      score_b,
      team_a:team_a_id ( name, code ),
      team_b:team_b_id ( name, code ),
      winner:winner_team_id ( code )
      `
    )
    .eq("tournament_id", tournament.id)
    .order("round", { ascending: true });

  if (bracketError) {
    console.error("getTournamentById bracket fetch failed:", bracketError.message);
  }

  const bracket: BracketMatch[] = (bracketRows ?? []).map((m: any) => {
    const teamA = Array.isArray(m.team_a) ? m.team_a[0] : m.team_a;
    const teamB = Array.isArray(m.team_b) ? m.team_b[0] : m.team_b;
    const winner = Array.isArray(m.winner) ? m.winner[0] : m.winner;

    return {
      id: m.id,
      label: `Round ${m.round}`,
      team1: {
        name: teamA?.name ?? "TBD",
        short: teamA?.code ?? "TBD",
        score: m.score_a != null ? String(m.score_a) : undefined,
      },
      team2: {
        name: teamB?.name ?? "TBD",
        short: teamB?.code ?? "TBD",
        score: m.score_b != null ? String(m.score_b) : undefined,
      },
      winner: winner?.code,
    };
  });

  const result: Tournament = {
    // ShowcaseSlide required fields
    tag: tournament.format === "single_elimination" ? "Knockout" : "Double Elim",
    slug: slugify(tournament.name),
    title: tournament.name,
    by: org?.name ?? "Unknown Org",
    image: org?.logo_url || "/placeholder.svg",
    // ShowcaseSlide optional fields we do have data for
    status: mapTournamentStatus(tournament.status),
    // TournamentExtras
    bracket,
  };

  return result;
}