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
//
// SHARED SQUAD SOURCE (see also data/match-data.ts):
//   `buildSquad` and `getSquadsByTeamIds` below are exported so that
//   data/match-data.ts's getMatchDetailById can pull a bracket-linked
//   match's two squads from the EXACT same teams -> players -> rules
//   pipeline the tournament detail page uses, instead of maintaining a
//   second, separately-drifting resolution of the same data. See the
//   SQUAD RESOLUTION note at the top of data/match-data.ts for the
//   history of why match_setup.squads[].teamId matching was unreliable
//   in the first place — getSquadsByTeamIds sidesteps that entirely for
//   any match whose teams resolved via bracket_matches (i.e. have real
//   teams.id UUIDs).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";
import type { Tournament, BracketMatch, Squad } from "@/data/tournament-data";
import { slugify } from "@/data/tournament-data";
import type { Round, MatchNode, TeamNode } from "@/components/tournament/TournamentBracket";
import type { DoubleElimData } from "@/lib/tournament/doubleElim";
import { getAwardsForTournament as getAwardTemplatesForTournament } from "@/lib/tournament/awards";
import {
  getMatchNrrBreakdownForTournament,
  type MatchNrrBreakdownRow,
} from "@/lib/tournament/standings";
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
 * `tournaments.format` (DB enum: single_elimination | double_elimination |
 * round_robin) -> the `bracketFormat` field TournamentExtras and
 * BracketPreviewPanel actually key off of ("single" | "double"). There's no
 * chart-style bracket for round_robin, so it returns undefined there and
 * the caller falls back to the legacy flat `bracket` array / points table.
 */
function mapBracketFormat(dbFormat: string): "single" | "double" | undefined {
  if (dbFormat === "single_elimination") return "single";
  if (dbFormat === "double_elimination") return "double";
  return undefined;
}

/**
 * Fetches every tournament belonging to the given org.
 */
export async function getTournamentsForPublic(): Promise<TournamentCardData[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      `
      id,
      name,
      format,
      status,
      image_url,
      created_at,
      organizations ( name, logo_url )
    `
    )
    .order("created_at", { ascending: false })

  if (error) {
    console.error("getTournamentsForPublic failed:", error.message)
    return []
  }

  return (data ?? []).map((t) => {
    const org = Array.isArray(t.organizations) ? t.organizations[0] : t.organizations
    return {
      id: t.id,
      title: t.name,
      by: org?.name ?? "Valiant League",
      tag: t.format === "single_elimination" ? "Knockout" : t.format === "round_robin" ? "League" : "Double Elimination",
      image: t.image_url || org?.logo_url || "/placeholder.svg",
      status: mapTournamentStatus(t.status ?? "setup"),
    }
  })
}

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
      image_url,
      created_at,
      organizations ( name, logo_url ),
      tournament_id
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
      tag: t.format === "single_elimination" ? "Knockout" : "Double Elimination",
      // Prefer the tournament's own image, fall back to the org logo,
      // then the placeholder — same priority order as getTournamentById.
      image: t.image_url || org?.logo_url || "/placeholder.svg",
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
 * Updates tournament fields that have real columns — which, per the real
 * schema, is now most of them: name, format, status, category,
 * description, startDate, imageUrl, logoUrl, prizePool, website, twitter,
 * discord.
 *
 * `imageUrl` maps to `tournaments.image_url` (the banner shown on the
 * tournament page) and `logoUrl` maps to `tournaments.logo_url` (the
 * smaller badge/watermark shown on the bracket and elsewhere) — these are
 * two distinct columns, kept separate on purpose.
 *
 * Still NOT covered here (no column/table, or intentionally derived —
 * see getTournamentById's schema note below): fixtures results/status,
 * prizes list, awards, pointsTable, squads, liveMatch, leaderboards.
 *
 * RLS (via is_org_member) is what actually stops a user editing a
 * tournament outside their org — this function doesn't re-check org_id
 * itself.
 */
export async function updateTournament(
  id: string,
  patch: Partial<{
    name: string;
    format: "single_elimination" | "double_elimination" | "round_robin";
    status: string;
    category: "Auction" | "Bracket" | "Overlay" | "League";
    description: string;
    startDate: string;
    imageUrl: string;
    logoUrl: string;
    prizePool: string;
    website: string;
    twitter: string;
    discord: string;
  }>
): Promise<boolean> {
  if (Object.keys(patch).length === 0) return true;

  const { startDate, imageUrl, logoUrl, prizePool, ...rest } = patch;
  const payload: Record<string, unknown> = { ...rest };
  // Empty string isn't valid for a `date` column — Postgres needs NULL
  // to represent "no date set", not "".
  if (startDate !== undefined) payload.start_date = startDate === "" ? null : startDate;
  if (imageUrl !== undefined) payload.image_url = imageUrl;
  if (logoUrl !== undefined) payload.logo_url = logoUrl;
  if (prizePool !== undefined) payload.prize_pool = prizePool;

  const { error } = await supabase.from("tournaments").update(payload).eq("id", id);

  if (error) {
    console.error("updateTournament failed:", error.message);
    return false;
  }
  return true;
}

export type TournamentEditData = {
  id: string;
  name: string;
  format: "single_elimination" | "double_elimination" | "round_robin";
  status: string;
  category: "Auction" | "Bracket" | "Overlay" | "League" | null;
  description: string;
  startDate: string; // "" if unset, else "YYYY-MM-DD"
  imageUrl: string;
  logoUrl: string;
  prizePool: string;
  website: string;
  twitter: string;
  discord: string;
  orgId: string | null;
  sourceType?: "board" | "auction";
  sourceId?: string | null;
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
  // Try to fetch with source fields first
  let { data, error } = await supabase
    .from("tournaments")
    .select(
      "id, name, format, status, category, description, start_date, image_url, logo_url, prize_pool, website, twitter, discord, org_id, source_type, source_id"
    )
    .eq("id", id)
    .single();

  // If the query fails due to missing columns, retry without source fields
  if (error && error.message?.includes("source_type")) {
    const { data: retryData, error: retryError } = await supabase
      .from("tournaments")
      .select(
        "id, name, format, status, category, description, start_date, image_url, logo_url, prize_pool, website, twitter, discord, org_id"
      )
      .eq("id", id)
      .single();

    if (retryError) {
      console.error("getTournamentForEdit failed:", retryError?.message);
      return null;
    }
    data = retryData as any;
    error = retryError;
  }

  if (error || !data) {
    console.error("getTournamentForEdit failed:", error?.message);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    format: data.format,
    status: data.status,
    category: data.category ?? null,
    description: data.description ?? "",
    startDate: data.start_date ?? "",
    imageUrl: data.image_url ?? "",
    logoUrl: data.logo_url ?? "",
    prizePool: data.prize_pool ?? "",
    website: data.website ?? "",
    twitter: data.twitter ?? "",
    discord: data.discord ?? "",
    orgId: data.org_id ?? null,
    sourceType: (data as any).source_type ?? "board", // Default to board if not present
    sourceId: (data as any).source_id ?? null,
  };
}

/**
 * Replaces every prize row for a tournament with the given list — simplest
 * correct approach for a short, fully-editable, reorderable list (delete +
 * reinsert instead of diffing individual rows). Called with an empty array
 * to clear all prizes.
 */
export async function savePrizesForTournament(
  tournamentId: string,
  prizes: { place: string; reward: string }[]
): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from("tournament_prizes")
    .delete()
    .eq("tournament_id", tournamentId);

  if (deleteError) {
    console.error("savePrizesForTournament(delete) failed:", deleteError.message);
    return false;
  }

  if (prizes.length === 0) return true;

  const { error: insertError } = await supabase.from("tournament_prizes").insert(
    prizes.map((p, i) => ({
      tournament_id: tournamentId,
      place: p.place,
      reward: p.reward,
      sort_order: i,
    }))
  );

  if (insertError) {
    console.error("savePrizesForTournament(insert) failed:", insertError.message);
    return false;
  }
  return true;
}

export async function getPrizesForTournament(
  tournamentId: string
): Promise<{ place: string; reward: string }[]> {
  const { data, error } = await supabase
    .from("tournament_prizes")
    .select("place, reward")
    .eq("tournament_id", tournamentId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getPrizesForTournament failed:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Maps rich `tournament_award_templates` rows — the SAME data
 * `AwardsManager` edits, fetched via the correctly-wired
 * getAwardsForTournament in lib/tournament/awards.ts — down to the
 * AwardEntry shape the public tournament page's AwardsGrid renders.
 * Every field AwardsManager captures (title, description, award type,
 * prize category, prize value, image) is preserved here so the public
 * page can show all of it, not just image + title + one text line.
 */
async function getAwardsForTournament(tournamentId: string) {
  try {
    const templates = await getAwardTemplatesForTournament(tournamentId);
    return templates.map((t) => ({
      label: t.title,
      name: t.description,
      note: t.awardType === "team" ? "Team Award" : "Individual Award",
      imageUrl: t.imageUrl,
      prizeCategory: t.prizeCategory,
      prizeValue: t.prizeValue,
      awardType: t.awardType,
    }));
  } catch (err) {
    console.error(
      "getAwardsForTournament failed:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

/**
 * Points table, read directly from `standings` — it already carries a
 * direct tournament_id FK plus computed nrr/form, no join through auctions
 * needed. This is match-result-derived data, not something the edit page
 * writes to; it's populated by recomputeStandingsForTournament (see
 * lib/tournament/standings.ts) as matches complete.
 *
 * Each row also carries `matches`: the per-match runs/overs breakdown
 * behind that team's NRR, from getMatchNrrBreakdownForTournament — this is
 * what lets the public page's calculation overlay show match-by-match
 * figures instead of just the final aggregate NRR. This is a second
 * read-only query (not a write), so it's safe to run on every page load
 * alongside the `standings` select.
 *
 * `team_id` is selected and returned explicitly as `id`. teams.code is NOT
 * guaranteed unique across the whole `teams` table (different auctions can
 * each create their own team with the same short code, e.g. two unrelated
 * "KKR" teams from two different auctions both ending up in this
 * tournament's standings), so `team_id` — the FK this whole join is built
 * on — is the only field on this row guaranteed unique, and is what the
 * client should key its list on instead of `short`.
 */
async function getPointsTableForTournament(tournamentId: string) {
  const [{ data, error }, breakdownByTeam] = await Promise.all([
    supabase
      .from("standings")
      .select("team_id, played, won, lost, points, nrr, form, teams:team_id ( name, code )")
      .eq("tournament_id", tournamentId),
    getMatchNrrBreakdownForTournament(tournamentId),
  ]);

  if (error) {
    console.error("getPointsTableForTournament failed:", error.message);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
    return {
      // Genuinely unique per row — use this as the React key, not `short`.
      id: row.team_id as string,
      team: team?.name ?? "Unknown",
      short: team?.code ?? "???",
      played: row.played,
      won: row.won,
      lost: row.lost,
      nrr: String(row.nrr),
      points: row.points,
      form: (row.form ?? []) as ("W" | "L" | "NR")[],
      matches: breakdownByTeam.get(row.team_id) ?? [],
    };
  });
}

/**
 * Schedule, derived from `bracket_matches` — there's no separate fixtures
 * table; bracket_matches already carries venue/scheduled_at/status per
 * match (and supports bracket_type = 'round_robin'), so it doubles as the
 * source for both the Bracket tab and the Schedule tab. Not hand-edited
 * here; match scheduling/results update these rows directly.
 *
 * `overlay_match_id` (aliased below to `matchId`) is what makes a
 * schedule card clickable — it's the same FK BracketPanel already reads
 * via hasMatchDetail/matchId to link a bracket slot through to its real
 * `/match/[id]` page. Previously this wasn't selected here at all, so
 * every fixture card silently rendered as non-clickable even when a live
 * match existed for it.
 */
async function getFixturesForTournament(tournamentId: string) {
  const { data, error } = await supabase
    .from("bracket_matches")
    .select(
      `
      id, round, scheduled_at, venue, status, score_a, score_b, overlay_match_id, match_number,
      team_a:team_a_id ( name, logo ),
      team_b:team_b_id ( name, logo ),
      winner:winner_team_id ( name ),
      matches:overlay_match_id ( match_setup )
      `
    )
    .eq("tournament_id", tournamentId)
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("getFixturesForTournament failed:", error.message);
    return [];
  }

  return (data ?? []).map((m: any) => {
    const teamA = Array.isArray(m.team_a) ? m.team_a[0] : m.team_a;
    const teamB = Array.isArray(m.team_b) ? m.team_b[0] : m.team_b;
    const winner = Array.isArray(m.winner) ? m.winner[0] : m.winner;
    const linkedMatch = Array.isArray(m.matches) ? m.matches[0] : m.matches;
    const setup = linkedMatch?.match_setup;

    const scheduled = m.scheduled_at ? new Date(m.scheduled_at) : null;

    // match_setup.date is "YYYY-MM-DD", match_setup.time is "HH:mm" — parse
    // them into a real Date so formatting matches the scheduled_at path
    // instead of showing raw strings.
    const setupDateTime =
      !scheduled && setup?.date
        ? new Date(`${setup.date}T${setup.time || "00:00"}`)
        : null;

    const dateLabel = scheduled
      ? scheduled.toLocaleDateString()
      : setupDateTime && !isNaN(setupDateTime.getTime())
      ? setupDateTime.toLocaleDateString()
      : setup?.date || "TBD";

    const timeLabel = scheduled
      ? scheduled.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : setupDateTime && !isNaN(setupDateTime.getTime()) && setup?.time
      ? setupDateTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : setup?.time || "";

    return {
      id: m.id,
      matchId: m.overlay_match_id ?? undefined,
      matchNumber: m.match_number ?? undefined,
      team1: teamA?.name ?? "TBD",
      team2: teamB?.name ?? "TBD",
      team1Logo: teamA?.logo ?? undefined,
      team2Logo: teamB?.logo ?? undefined,
      date: dateLabel,
      time: timeLabel,
      venue: m.venue || setup?.venue || "",
      status: m.status as "upcoming" | "live" | "completed",
      result:
        winner && m.score_a != null && m.score_b != null
          ? `${winner.name} won (${m.score_a} - ${m.score_b})`
          : undefined,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// BRACKET CHART DATA — Round[] / DoubleElimData for BracketPreviewPanel
// ─────────────────────────────────────────────────────────────

/**
 * Converts a raw joined team row + score/winner code into the TeamNode
 * shape TournamentBracket/DoubleElimBoard/BracketPreviewPanel consume.
 * Returns null for an unfilled slot (team not yet decided/TBD).
 */
function toTeamNode(
  team: { name: string; code: string; color?: string | null } | null | undefined,
  score: number | null | undefined,
  winnerCode?: string | null
): TeamNode | null {
  if (!team) return null;
  return {
    id: team.code,
    code: team.code,
    name: team.name,
    color: team.color ?? "#4a5168",
    score: score ?? undefined,
    isWinner: winnerCode ? winnerCode === team.code : undefined,
  };
}

/**
 * Converts one raw bracket_matches row (with team_a/team_b/winner already
 * joined) into a MatchNode.
 */
function toMatchNode(m: any): MatchNode {
  const teamA = Array.isArray(m.team_a) ? m.team_a[0] : m.team_a;
  const teamB = Array.isArray(m.team_b) ? m.team_b[0] : m.team_b;
  const winner = Array.isArray(m.winner) ? m.winner[0] : m.winner;

  return {
    id: m.id,
    label: `Round ${m.round}`,
    matchNumber: m.match_number ?? undefined,   // <-- add this
    status: m.status === "completed" ? "completed" : m.status === "live" ? "live" : "scheduled",
    teamA: toTeamNode(teamA, m.score_a, winner?.code),
    teamB: toTeamNode(teamB, m.score_b, winner?.code),
    aFrom: m.feeder_match_a_id ?? null,
    bFrom: m.feeder_match_b_id ?? null,
    venue: m.venue ?? undefined,
    date: m.scheduled_at ? new Date(m.scheduled_at).toLocaleDateString() : undefined,
  };
}

/**
 * Groups already-built MatchNodes (parallel array to `rows`, same order)
 * into Round[] keyed by bracket_matches.round, sorted ascending. Rows are
 * expected to already be ordered by `position` within each round (the
 * caller's query does this), so match order within a Round is preserved.
 */
function groupIntoRounds(rows: { round: number }[], matches: MatchNode[], namePrefix: string): Round[] {
  const byRound = new Map<number, MatchNode[]>();
  rows.forEach((row, i) => {
    const arr = byRound.get(row.round) ?? [];
    arr.push(matches[i]);
    byRound.set(row.round, arr);
  });
  return [...byRound.keys()]
    .sort((a, b) => a - b)
    .map((rn, idx) => ({
      id: idx,
      name: `${namePrefix} ${rn}`,
      shortName: `R${rn}`,
      matches: byRound.get(rn) ?? [],
    }));
}

/**
 * Builds real bracket-chart data for a tournament from `bracket_matches`,
 * shaped for BracketPreviewPanel: Round[] for single elimination,
 * DoubleElimData for double elimination. Returns {} for round_robin (or
 * on query error) — the caller then falls back to the legacy flat
 * `bracket` array / points table instead of a chart.
 *
 * ASSUMPTION: for double elimination, `bracket_type = 'grand_final'` rows
 * are ordered by `position` — position 0 is the grand final itself, and a
 * second row (position 1), if present, is the bracket-reset decider match
 * (only played if the loser's-bracket team wins the first grand final).
 * Adjust the gfRows indexing below if your data encodes this differently.
 */
async function getBracketChartDataForTournament(
  tournamentId: string,
  dbFormat: string
): Promise<{
  bracketFormat?: "single" | "double";
  bracketRounds?: Round[];
  doubleElimData?: DoubleElimData;
}> {
  const bracketFormat = mapBracketFormat(dbFormat);
  if (!bracketFormat) return {};

  const { data: rows, error } = await supabase
    .from("bracket_matches")
    .select(
      `
      id, round, position, bracket_type, score_a, score_b, status,
      venue, scheduled_at, feeder_match_a_id, feeder_match_b_id, match_number,
      team_a:team_a_id ( name, code, color ),
      team_b:team_b_id ( name, code, color ),
      winner:winner_team_id ( code )
      `
    )
    .eq("tournament_id", tournamentId)
    .order("round", { ascending: true })
    .order("position", { ascending: true });

  if (error || !rows) {
    console.error("getBracketChartDataForTournament failed:", error?.message);
    return { bracketFormat };
  }

  if (bracketFormat === "single") {
    const winnerRows = rows.filter((r) => r.bracket_type === "winners");
    return {
      bracketFormat,
      bracketRounds: groupIntoRounds(winnerRows, winnerRows.map(toMatchNode), "Round"),
    };
  }

  // double elimination
  const winnersRows = rows.filter((r) => r.bracket_type === "winners");
  const losersRows = rows.filter((r) => r.bracket_type === "losers");
  const gfRows = rows
    .filter((r) => r.bracket_type === "grand_final")
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const winners = groupIntoRounds(winnersRows, winnersRows.map(toMatchNode), "WB Round");
  const losers = groupIntoRounds(losersRows, losersRows.map(toMatchNode), "LB Round");
  const grandFinal: MatchNode = gfRows[0]
    ? toMatchNode(gfRows[0])
    : {
        id: "gf-empty",
        label: "Grand Final",
        status: "scheduled",
        teamA: null,
        teamB: null,
        aFrom: null,
        bFrom: null,
      };
  const bracketReset: MatchNode | null = gfRows[1] ? toMatchNode(gfRows[1]) : null;

  return { bracketFormat, doubleElimData: { winners, losers, grandFinal, bracketReset } };
}


/**
 * Fetches a single tournament (by tournaments.id) with its bracket, squads,
 * prizes, awards, points table, and fixtures, for the public tournament
 * detail page.
 *
 * SCHEMA NOTE (corrected against the real DB schema — tournaments already
 * has more columns than earlier drafts of this file assumed):
 *   - slug, title (name), by/image (via organizations), status,
 *     description, startDate, prizePool, website, twitter, discord: all
 *     mapped ✅ directly from real columns on `tournaments`.
 *   - tag: mapped from `format` onto "Knockout"/"Double Elim" — note
 *     `tournaments.category` (Auction/Bracket/Overlay/League) is the
 *     *actual* column matching the rest of the showcase's tag vocabulary
 *     and isn't used here yet; consider switching `tag` to read
 *     `category` directly once every tournament has one set.
 *   - bracket: mapped ✅ via bracket_matches.tournament_id (legacy flat
 *     array, kept for round_robin tournaments / as a raw data source).
 *   - bracketFormat / bracketRounds / doubleElimData: mapped ✅ via
 *     getBracketChartDataForTournament, derived from tournaments.format +
 *     bracket_matches. This is what the Bracket tab's chart-style
 *     BracketPreviewPanel actually renders; the flat `bracket` array above
 *     is only used as a fallback for round_robin tournaments.
 *   - fixtures: mapped ✅ — derived from the same bracket_matches rows
 *     (venue/scheduled_at/status/scores/overlay_match_id). There's no
 *     separate fixtures table; bracket_matches already supports
 *     bracket_type='round_robin'.
 *   - prizes: mapped ✅ via tournament_prizes.tournament_id
 *   - awards: mapped ✅ via tournament_award_templates.tournament_id (the
 *     rich AwardsManager data, reused from lib/tournament/awards.ts — see
 *     getAwardsForTournament above)
 *   - pointsTable: mapped ✅ via standings.tournament_id (direct FK —
 *     no join through auctions needed; nrr/form are precomputed columns)
 *   - squads: mapped ✅ — derived from the linked auction's results
 *     (players.sold_to_team_id / owner_team_code), see
 *     getSquadsForTournament above. NOT a hand-edited table. Teams show
 *     even before any players are sold (see note in that function), and
 *     respect the tournament's saved team selection subset if one exists.
 *   - liveMatch, runsLeaderboard, wicketsLeaderboard: NOT mapped. These
 *     come from matches/balls/match_team_stats (live scoring + per-player
 *     aggregation) — real but more involved queries, left as a later pass.
 *     Optional on the type, so simply omitted; existing hasX checks hide
 *     those tabs rather than render broken data.
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
      category,
      description,
      start_date,
      image_url,
      logo_url,
      prize_pool,
      website,
      twitter,
      discord,
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

  const [
    { data: bracketRows, error: bracketError },
    squads,
    prizes,
    awards,
    pointsTable,
    fixtures,
    chartBracket,
  ] = await Promise.all([
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
    getPrizesForTournament(tournament.id),
    getAwardsForTournament(tournament.id),
    getPointsTableForTournament(tournament.id),
    getFixturesForTournament(tournament.id),
    getBracketChartDataForTournament(tournament.id, tournament.format),
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
    image: tournament.image_url || org?.logo_url || "/placeholder.svg",
    // ShowcaseSlide optional fields we do have data for
    status: mapTournamentStatus(tournament.status),
    // TournamentExtras
    description: tournament.description || undefined,
    startDate: tournament.start_date || undefined,
    prizePool: tournament.prize_pool || undefined,
    website: tournament.website || undefined,
    twitter: tournament.twitter || undefined,
    discord: tournament.discord || undefined,
    prizes: prizes.length ? prizes : undefined,
    awards: awards.length ? awards : undefined,
    pointsTable: pointsTable.length ? pointsTable : undefined,
    fixtures: fixtures.length ? fixtures : undefined,
    bracket,
    bracketFormat: chartBracket.bracketFormat,
    bracketRounds: chartBracket.bracketRounds,
    doubleElimData: chartBracket.doubleElimData,
    squads: squads.length ? squads : undefined,
  };

  return result;
}


/**
 * Derives squads for a tournament from its linked auction's results —
 * NOT a hand-edited table. `players.sold_to_team_id` tells us which team
 * bought each player, and `players.owner_team_code` (already used to
 * derive `isCaptain` in loadAuction) tells us who the captain is.
 *
 * FALLBACK (bracket-only / board tournaments): `teams` and `players` are
 * only ever linked to a tournament *indirectly*, via `auctions.tournament_id`.
 * A tournament created from the bracket builder (`source_type = 'board'`)
 * has no such auction row, even though it can still have real `teams` sitting
 * in `bracket_matches.team_a_id` / `team_b_id` (same rows the Bracket tab
 * renders). Previously this function returned `[]` the moment the auction
 * lookup came up empty, which hid squads entirely for those tournaments even
 * though bracket data clearly existed. Now, if no linked auction is found,
 * it falls back to pulling the distinct teams referenced by this
 * tournament's `bracket_matches` directly, and delegates to
 * getSquadsByTeamIds (below) for the actual teams -> players -> rules ->
 * buildSquad pipeline — the SAME function data/match-data.ts calls for a
 * single bracket-linked match's two teams, so the two pages can never
 * silently drift in what they show for a given team.
 *
 * TEAM SUBSET: if the tournament has an explicit team selection saved in
 * `tournament_teams` (see saveTournamentTeamSelection in
 * lib/tournament/manualTeams.ts), only those teams are shown here — this
 * is what lets a tournament include just some of a linked auction's or
 * Squad Board's teams instead of all of them. No rows saved yet means
 * "every team under the linked auction" (or, in the fallback path, every
 * team appearing in this tournament's bracket), same as before this table
 * existed, so tournaments that never touch the team picker are unaffected.
 *
 * ASSUMPTION: one auction per tournament (in the primary/linked path).
 * `auctions.tournament_id` is a direct FK (set via linkAuctionTournament in
 * lib/auctionDb.ts). If a tournament can have multiple linked auctions
 * (re-auctions, etc.), this takes the most recently created one — adjust
 * the `.order()` / add a parameter if you need to pick a specific one
 * instead.
 *
 * Players with no sold_to_team_id (unsold, or the auction hasn't run yet)
 * are excluded from rosters. Teams with no sold players are still
 * included, with an empty `players` array — every team created for the
 * auction (or every team seen in the bracket, in the fallback path) should
 * be visible on the tournament page (e.g. "Squad to be announced") rather
 * than disappearing until players are actually sold. See SquadsPanel in
 * the tournament detail client for how the empty-roster case is rendered.
 *
 * Also surfaces owner, logo, and purse spent/remaining per team (from
 * `teams.owner`/`teams.logo`/`teams.remaining_purse`, with the starting
 * budget read from `rules.total_points` for the relevant auction(s)).
 * `teams.pin` is deliberately never selected here — it's the private
 * auction access code, not public-page data.
 */
export async function getSquadsForTournament(tournamentId: string): Promise<Squad[]> {
  // Team-selection subset, if any has been saved — used by both the
  // primary and fallback paths below.
  const { data: selectionRows, error: selectionErr } = await supabase
    .from("tournament_team_selections")
    .select("team_id")
    .eq("tournament_id", tournamentId);
  if (selectionErr) console.error("getSquadsForTournament(selection) failed:", selectionErr.message);
  const selectedIds =
    selectionRows && selectionRows.length > 0 ? new Set(selectionRows.map((r) => r.team_id)) : null;

  // ── Primary path: tournament has a linked auction ──────────────────
  const { data: auction, error: auctionErr } = await supabase
    .from("auctions")
    .select("id")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (auctionErr) {
    console.error("getSquadsForTournament(auction lookup) failed:", auctionErr.message);
  }

  if (auction) {
    const [
      { data: teams, error: teamsErr },
      { data: players, error: playersErr },
      { data: rules, error: rulesErr },
    ] = await Promise.all([
      // owner, logo, remaining_purse added for the squads page (owner name,
      // team badge, purse spent) — pin is intentionally NOT selected here,
      // it's a private auction access code and should never reach a public
      // page's response payload.
      supabase
        .from("teams")
        .select("id, code, name, color, tier, owner, logo, remaining_purse")
        .eq("auction_id", auction.id),
        supabase
          .from("players")
          .select("name, role, img, sold_to_team_id, owner_team_code")
          .eq("auction_id", auction.id)
          .not("sold_to_team_id", "is", null),
      // rules.total_points is the per-team starting budget for this auction —
      // teams.remaining_purse alone doesn't tell us how much was spent
      // without knowing what they started with.
      supabase.from("rules").select("total_points").eq("auction_id", auction.id).maybeSingle(),
    ]);

    if (teamsErr) console.error("getSquadsForTournament(teams) failed:", teamsErr.message);
    if (playersErr) console.error("getSquadsForTournament(players) failed:", playersErr.message);
    if (rulesErr) console.error("getSquadsForTournament(rules) failed:", rulesErr.message);

    if (teams && teams.length > 0) {
      const includedTeams = selectedIds ? teams.filter((t) => selectedIds.has(t.id)) : teams;
      const totalPurse = rules?.total_points ?? 50000;
      const rosterFor = (teamId: string) => (players ?? []).filter((p) => p.sold_to_team_id === teamId);

      return includedTeams.map((t) => buildSquad(t, rosterFor(t.id), totalPurse));
    }
    // Linked auction exists but has no teams yet (e.g. auction just
    // created) — fall through to the bracket-derived path below rather
    // than returning an empty squads list outright.
  }

  // ── Fallback path: no linked auction (or it has no teams) — derive
  // squads directly from the teams appearing in this tournament's own
  // bracket_matches instead. ─────────────────────────────────────────
  const { data: bracketTeamRows, error: bracketTeamErr } = await supabase
    .from("bracket_matches")
    .select("team_a_id, team_b_id")
    .eq("tournament_id", tournamentId);

  if (bracketTeamErr) {
    console.error("getSquadsForTournament(bracket teams) failed:", bracketTeamErr.message);
    return [];
  }

  const teamIds = new Set<string>();
  for (const row of bracketTeamRows ?? []) {
    if (row.team_a_id) teamIds.add(row.team_a_id);
    if (row.team_b_id) teamIds.add(row.team_b_id);
  }
  if (teamIds.size === 0) return [];

  // Delegate to the shared team-id -> squads pipeline (teams -> players ->
  // rules -> buildSquad) — the SAME function data/match-data.ts calls
  // directly for a single match's two teams. Previously this fetched
  // teams/players/rules inline here as a second, hand-duplicated copy of
  // that same logic; now there's exactly one implementation.
  const idList = selectedIds
    ? [...teamIds].filter((teamId) => selectedIds.has(teamId))
    : [...teamIds];

  return getSquadsByTeamIds(idList);
}

/**
 * Same underlying source as getSquadsForTournament's bracket-derived
 * fallback (teams -> players.sold_to_team_id -> rules.total_points ->
 * buildSquad), but scoped directly to a given set of `teams.id` values
 * instead of resolved from a tournament_id via bracket_matches.
 *
 * This is what lets a single match (data/match-data.ts's
 * getMatchDetailById) pull its two teams' squads from the EXACT same
 * place the tournament detail page does, without needing to know which
 * tournament the match belongs to — it only needs the two teams' real
 * `teams.id` UUIDs, which it already has once a match resolves through
 * `bracket_matches`.
 *
 * Only meaningful for teams with a real teams.id (bracket-linked
 * matches/teams) — there is no equivalent shared source for standalone
 * teams that only ever exist as a name/short-code pair embedded in
 * match_setup.
 */
export async function getSquadsByTeamIds(teamIds: string[]): Promise<Squad[]> {
  if (teamIds.length === 0) return [];

  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, code, name, color, tier, owner, logo, remaining_purse, auction_id")
    .in("id", teamIds);

  if (teamsErr) {
    console.error("getSquadsByTeamIds(teams) failed:", teamsErr.message);
    return [];
  }
  if (!teams || teams.length === 0) return [];

  // Teams here may belong to more than one auction_id (rare, but the
  // schema allows it), so fetch players and rules per distinct auction_id
  // rather than assuming a single shared one.
  const auctionIds = [...new Set(teams.map((t) => t.auction_id))];

  const [{ data: players, error: playersErr }, { data: rulesRows, error: rulesErr }] = await Promise.all([
    supabase
      .from("players")
      .select("name, role, img, sold_to_team_id, owner_team_code, auction_id")
      .in("auction_id", auctionIds)
      .not("sold_to_team_id", "is", null),
    supabase.from("rules").select("auction_id, total_points").in("auction_id", auctionIds),
  ]);

  if (playersErr) console.error("getSquadsByTeamIds(players) failed:", playersErr.message);
  if (rulesErr) console.error("getSquadsByTeamIds(rules) failed:", rulesErr.message);

  const totalPurseByAuction = new Map<string, number>();
  for (const r of rulesRows ?? []) totalPurseByAuction.set(r.auction_id, r.total_points);

  const rosterFor = (teamId: string) => (players ?? []).filter((p) => p.sold_to_team_id === teamId);

  return teams.map((t) =>
    buildSquad(t, rosterFor(t.id), totalPurseByAuction.get(t.auction_id) ?? 50000)
  );
}

/**
 * Shared shaping logic for one team + its sold players into a Squad, used
 * by getSquadsForTournament's primary (linked-auction) path and by
 * getSquadsByTeamIds above — which is itself used both by
 * getSquadsForTournament's bracket-derived fallback AND directly by
 * data/match-data.ts for a single match's two teams. Exported so that
 * call site (and any other future one) can't silently drift from this
 * shaping logic by re-implementing it.
 */
export function buildSquad(
  t: { id: string; code: string; name: string; color?: string | null; tier?: string | null; owner?: string | null; logo?: string | null; remaining_purse?: number | null },
  roster: { name: string; role?: string | null; img?: string | null; sold_to_team_id: string | null; owner_team_code?: string | null }[],
  totalPurse: number
): Squad {
  const captain = roster.find((p) => p.owner_team_code === t.code);
  const remaining = t.remaining_purse ?? totalPurse;
  return {
    team: t.name,
    captain: captain?.name ?? "TBD",
    color: t.color ?? undefined,
    tier: t.tier ?? undefined,
    owner: t.owner ?? undefined,
    logo: t.logo || "",
    purseSpent: Math.max(totalPurse - remaining, 0),
    purseRemaining: remaining,
    players: roster.map((p) => ({
      name: p.name,
      role: p.role ?? undefined,
      image: p.img || undefined,   // <-- this line was missing
      isCaptain: p.owner_team_code === t.code,
    })),
  };
}