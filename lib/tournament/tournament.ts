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
import type { Tournament, BracketMatch, Squad } from "@/data/tournament-data";
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
 * Updates the subset of tournament fields that currently have real columns
 * (`name`, `format`, `status`). Everything else on the `Tournament` type
 * (description, startDate, prizePool, prizes, website/twitter/discord,
 * fixtures, awards) has no backing column/table yet — see the schema note
 * on getTournamentById below. Add those columns first, then extend this
 * function's `patch` type and the insert/update payload to match.
 *
 * RLS (via is_org_member) is what actually stops a user editing a
 * tournament outside their org — this function doesn't re-check org_id
 * itself.
 */
export async function updateTournament(
  id: string,
  patch: Partial<{
    name: string;
    format: "single_elimination" | "double_elimination";
    status: string;
  }>
): Promise<boolean> {
  if (Object.keys(patch).length === 0) return true;

  const { error } = await supabase.from("tournaments").update(patch).eq("id", id);

  if (error) {
    console.error("updateTournament failed:", error.message);
    return false;
  }
  return true;
}

export type TournamentEditData = {
  id: string;
  name: string;
  format: "single_elimination" | "double_elimination";
  status: string;
  orgId: string | null;
};

/**
 * Fetches the raw editable fields for a tournament, plus its org_id — used
 * by the /tournament/[id]/edit page to (a) populate the form with real
 * enum values (getTournamentById's `tag`/`status` are already reshaped for
 * public display and aren't safe to write back), and (b) let the page
 * confirm the viewer's org matches before showing anything editable. The
 * actual access control is still RLS — this check just avoids flashing a
 * form to someone who can't save it anyway.
 */
export async function getTournamentForEdit(id: string): Promise<TournamentEditData | null> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, format, status, org_id")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("getTournamentForEdit failed:", error?.message);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    format: data.format,
    status: data.status,
    orgId: data.org_id ?? null,
  };
}

/**
 * Derives squads for a tournament from its linked auction's results —
 * NOT a hand-edited table. `players.sold_to_team_id` tells us which team
 * bought each player, and `players.owner_team_code` (already used to
 * derive `isCaptain` in loadAuction) tells us who the captain is.
 *
 * ASSUMPTION: one auction per tournament. `auctions.tournament_id` is a
 * direct FK (set via linkAuctionTournament in lib/auctionDb.ts). If a
 * tournament can have multiple linked auctions (re-auctions, etc.), this
 * takes the most recently created one — adjust the `.order()` / add a
 * parameter if you need to pick a specific one instead.
 *
 * Players with no sold_to_team_id (unsold, or the auction hasn't run yet)
 * are excluded rather than shown as free agents.
 */
export async function getSquadsForTournament(tournamentId: string): Promise<Squad[]> {
  const { data: auction, error: auctionErr } = await supabase
    .from("auctions")
    .select("id")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (auctionErr) {
    console.error("getSquadsForTournament(auction lookup) failed:", auctionErr.message);
    return [];
  }
  if (!auction) return []; // no auction linked yet

  const [{ data: teams, error: teamsErr }, { data: players, error: playersErr }] =
    await Promise.all([
      supabase.from("teams").select("id, code, name").eq("auction_id", auction.id),
      supabase
        .from("players")
        .select("name, sold_to_team_id, owner_team_code")
        .eq("auction_id", auction.id)
        .not("sold_to_team_id", "is", null),
    ]);

  if (teamsErr) console.error("getSquadsForTournament(teams) failed:", teamsErr.message);
  if (playersErr) console.error("getSquadsForTournament(players) failed:", playersErr.message);
  if (!teams || !players) return [];

  return teams
    .map((t) => {
      const roster = players.filter((p) => p.sold_to_team_id === t.id);
      const captain = roster.find((p) => p.owner_team_code === t.code);
      return {
        team: t.name,
        captain: captain?.name ?? "TBD",
        players: roster.map((p) => ({
          name: p.name,
          isCaptain: p.owner_team_code === t.code,
        })),
      };
    })
    .filter((s) => s.players.length > 0); // hide teams with no completed purchases
}

/**
 * Fetches a single tournament (by tournaments.id) with its bracket and
 * squads, for the public tournament detail page.
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
 *   - squads: mapped ✅ — derived from the linked auction's results
 *     (players.sold_to_team_id / owner_team_code), see
 *     getSquadsForTournament above. NOT a hand-edited table.
 *   - pointsTable: NOT mapped. `standings` links to `auctions.id`
 *     (auction_id), and `auctions` links to `tournaments.id` — there's no
 *     direct tournaments -> standings path. Populating this needs a join
 *     through `auctions` (tournaments.id -> auctions.tournament_id ->
 *     standings.auction_id), and only works if a tournament has exactly
 *     one associated auction.
 *   - liveMatch, fixtures, runsLeaderboard, wicketsLeaderboard, awards,
 *     prizePool, prizes, description, startDate, website, twitter,
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

  const [{ data: bracketRows, error: bracketError }, squads] = await Promise.all([
    supabase
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
      .order("round", { ascending: true }),
    getSquadsForTournament(tournament.id),
  ]);

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
    squads: squads.length ? squads : undefined,
  };

  return result;
}