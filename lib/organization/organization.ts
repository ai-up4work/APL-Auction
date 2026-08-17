// app/lib/organization/organization.ts
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

/* ────────────────────────────────────────────────────────────────── */
/*  ORG CONTEXT                                                        */
/* ────────────────────────────────────────────────────────────────── */

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  description: string | null;
  logoUrl: string | null;
  createdAt?: string;
}

/** The org the current user belongs to (assumes one org per user for now,
 *  same assumption TournamentEditClient already makes via getOrgIdForUser). */
export async function getOrgForUser(userId: string): Promise<OrgSummary | null> {
  const { data: profile, error: profileErr } = await supabase
    .from("user_profiles")
    .select("current_org_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr || !profile?.current_org_id) return null;

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id, name, slug, plan, description, logo_url")
    .eq("id", profile.current_org_id)
    .maybeSingle();

  if (orgErr || !org) return null;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    description: org.description,
    logoUrl: org.logo_url,
  };
}

export interface UpdateOrgInput {
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
}

export interface UpdateOrgResult {
  ok: boolean;
  error?: string;
}

/** Updates the organization's editable fields. `slug` is UNIQUE in the
 *  schema — a duplicate will come back as a Postgres unique-violation
 *  (error code 23505), which is surfaced as a friendly message rather
 *  than the raw constraint error. */
export async function updateOrganization(orgId: string, input: UpdateOrgInput): Promise<UpdateOrgResult> {
  const { error } = await supabase
    .from("organizations")
    .update({
      name: input.name.trim(),
      slug: input.slug.trim(),
      description: input.description.trim() || null,
      logo_url: input.logoUrl.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (error) {
    console.error("updateOrganization failed:", error.message);
    if (error.code === "23505") {
      return { ok: false, error: "That slug is already taken — pick a different one." };
    }
    return { ok: false, error: "Couldn't save changes — please try again." };
  }
  return { ok: true };
}

/* ────────────────────────────────────────────────────────────────── */
/*  TOURNAMENTS                                                        */
/* ────────────────────────────────────────────────────────────────── */

export interface TournamentSummary {
  id: string;
  name: string;
  format: string;
  status: string;
  category: string | null;
  createdAt: string;
  /** Cover image for the tournament card. Falls back to `logoUrl`, then to
   *  a placeholder in the UI when both are empty. */
  imageUrl: string | null;
  logoUrl: string | null;
  /** Source type: "board" (editable) or "auction" (locked) */
  sourceType?: "board" | "auction";
  /** ID of the source board or auction */
  sourceId?: string | null;
}

export async function getTournamentsForOrg(orgId: string): Promise<TournamentSummary[]> {
  // Try to fetch with source fields first, fall back to without if columns don't exist
  let { data, error } = await supabase
    .from("tournaments")
    .select("id, name, format, status, category, created_at, image_url, logo_url, source_type, source_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  // If the query fails due to missing columns, retry without them
  if (error && error.message?.includes("source_type")) {
    const { data: retryData, error: retryError } = await supabase
      .from("tournaments")
      .select("id, name, format, status, category, created_at, image_url, logo_url")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (retryError) {
      console.error("getTournamentsForOrg failed:", retryError.message);
      return [];
    }
    data = retryData as any;
    error = retryError;
  }

  if (error) {
    console.error("getTournamentsForOrg failed:", error.message);
    return [];
  }

  return (data ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    format: t.format,
    status: t.status,
    category: t.category,
    createdAt: t.created_at,
    imageUrl: t.image_url,
    logoUrl: t.logo_url,
    sourceType: t.source_type ?? "board", // Default to board if not present
    sourceId: t.source_id ?? null,
  }));
}

export interface CreateTournamentInput {
  name: string;
  format: "single_elimination" | "double_elimination" | "round_robin";
  category?: "Auction" | "Bracket" | "Overlay" | "League";
  /** Optional logo URL set at creation time — shown on the tournament's
   *  card via TournamentSummary.logoUrl (imageUrl still takes priority if
   *  it's ever set separately, e.g. from the tournament's edit page). */
  logoUrl?: string;
  /** Source of the tournament: "board" (from Team Pool) or "auction" (from real auction)
   *  If "auction", sourceId must be provided and will lock player editing */
  source?: "board" | "auction";
  /** ID of the source board or auction. Required if source is "auction" */
  sourceId?: string | null;
}

/** Creates a bare tournament row — the resulting id is where the caller
 *  should route the user next (/tournaments/[id]/edit) to fill in the rest. */
export async function createTournament(
  orgId: string,
  userId: string,
  input: CreateTournamentInput
): Promise<string | null> {
  const insertData: any = {
    org_id: orgId,
    name: input.name,
    format: input.format,
    category: input.category ?? null,
    created_by: userId,
    status: "setup",
    logo_url: input.logoUrl?.trim() || null,
  };

  if (input.source !== undefined) {
    insertData.source_type = input.source ?? "board";
  }
  if (input.sourceId !== undefined) {
    insertData.source_id = input.sourceId ?? null;
  }

  let { data, error } = await supabase
    .from("tournaments")
    .insert(insertData)
    .select("id")
    .single();

  // Schema hasn't been migrated yet — retry without source fields
  if (error && (error.message?.includes("source_type") || error.message?.includes("source_id"))) {
    delete insertData.source_type;
    delete insertData.source_id;
    const retry = await supabase.from("tournaments").insert(insertData).select("id").single();
    data = retry.data as any;
    error = retry.error;
  }

  if (error || !data) {
    console.error("createTournament failed:", error?.message);
    return null;
  }
  return data.id;
}

export interface DeleteTournamentResult extends UpdateOrgResult {
  /** How many matches (and their bracket/live-play data) were removed
   *  along with the tournament, for a one-line confirmation message. */
  deletedMatchCount?: number;
}

/** Deletes a tournament AND everything that can only exist attached to
 *  it — matches, bracket slots, standings, prizes, awards, activity log,
 *  award templates — rather than blocking with "still has stuff linked".
 *
 *  Auctions are only *unlinked* (tournament_id -> null), never deleted:
 *  an auction (or Squad Board) has a life of its own outside a
 *  tournament and shouldn't disappear just because the tournament did.
 *
 *  Order matters because of two FKs that point at each other:
 *    matches.bracket_match_id -> bracket_matches(id)
 *    bracket_matches.overlay_match_id -> matches(id)
 *  So matches.bracket_match_id is nulled out BEFORE bracket_matches rows
 *  are deleted, and the match rows (plus every live-play/broadcast child
 *  row keyed on match_id) are removed only after that.
 *
 *  Not run as a single DB transaction — each step is a separate Supabase
 *  call. A failure partway through can leave things partially cleaned up;
 *  if that matters, move this into a Postgres RPC/function instead. */
/** Deletes rows matching `column = value` in `table`, then re-counts to
 *  confirm they're actually gone. Supabase/PostgREST does NOT return an
 *  error when a DELETE is silently blocked by Row Level Security and
 *  matches zero rows — it just reports success on a no-op. Without this
 *  verification, deleteTournament below can believe a step succeeded
 *  (e.g. clearing `standings`) when RLS actually left every row in
 *  place, and only find out several steps later when the tournament's
 *  own FK constraint finally rejects the delete — which is exactly what
 *  produced the confusing "standings_tournament_id_fkey" 409 here. */
async function deleteAndVerify(
  table: string,
  column: string,
  value: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: deleteErr } = await supabase.from(table).delete().eq(column, value);
  if (deleteErr) {
    console.error(`deleteAndVerify(${table}) delete failed:`, deleteErr.message);
    return { ok: false, error: `Couldn't delete from ${table.replace(/_/g, " ")} — please try again.` };
  }

  const { count, error: countErr } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);

  if (countErr) {
    console.error(`deleteAndVerify(${table}) verify failed:`, countErr.message);
    // Can't confirm either way — fail closed rather than risk the caller
    // proceeding to delete the parent row against a real FK.
    return { ok: false, error: `Couldn't confirm ${table.replace(/_/g, " ")} was cleared — please try again.` };
  }

  if ((count ?? 0) > 0) {
    console.error(`deleteAndVerify(${table}) blocked: ${count} row(s) still present after delete — likely RLS.`);
    return {
      ok: false,
      error: `${count} row${count === 1 ? "" : "s"} in ${table.replace(
        /_/g,
        " "
      )} couldn't be deleted — this is usually a permissions (Row Level Security) issue rather than something you can retry your way past. Contact support if it persists.`,
    };
  }

  return { ok: true };
}

export async function deleteTournament(tournamentId: string): Promise<DeleteTournamentResult> {
  // 1. Which matches belong to this tournament?
  const { data: matchRows, error: matchLookupErr } = await supabase
    .from("matches")
    .select("id")
    .eq("tournament_id", tournamentId);

  if (matchLookupErr) {
    console.error("deleteTournament(match lookup) failed:", matchLookupErr.message);
    return { ok: false, error: "Couldn't check this tournament's matches — please try again." };
  }

  const matchIds = (matchRows ?? []).map((m: any) => m.id);

  if (matchIds.length > 0) {
    // Break matches -> bracket_matches before bracket_matches rows go away.
    const { data: unlinkedRows, error: unlinkBracketErr } = await supabase
      .from("matches")
      .update({ bracket_match_id: null })
      .in("id", matchIds)
      .select("id");
    if (unlinkBracketErr) {
      console.error("deleteTournament(unlink bracket_match_id) failed:", unlinkBracketErr.message);
      return { ok: false, error: "Couldn't detach this tournament's bracket matches — please try again." };
    }
    if ((unlinkedRows ?? []).length !== matchIds.length) {
      console.error(
        `deleteTournament(unlink bracket_match_id) blocked: expected ${matchIds.length}, updated ${
          (unlinkedRows ?? []).length
        } — likely RLS.`
      );
      return {
        ok: false,
        error: "Couldn't update all of this tournament's matches — this looks like a permissions issue. Please try again or contact support.",
      };
    }
  }

  // 2. Bracket slots (tournament_id is NOT NULL — must be deleted, can't unlink).
  const bracketResult = await deleteAndVerify("bracket_matches", "tournament_id", tournamentId);
  if (!bracketResult.ok) return bracketResult;

  if (matchIds.length > 0) {
    // 3. Every table hanging off a match's live-play/broadcast data.
    const matchChildTables = [
      "balls",
      "ball_commentary",
      "match_state",
      "engine_state",
      "weather_readings",
      "on_air_channels",
      "match_team_stats",
      "match_sim_control",
    ] as const;

    for (const table of matchChildTables) {
      for (const matchId of matchIds) {
        const result = await deleteAndVerify(table, "match_id", matchId);
        if (!result.ok) return result;
      }
    }
  }

  // 4. Award templates — tournament-scoped (and some are match-scoped too,
  //    but deleting by tournament_id covers both).
  const templatesResult = await deleteAndVerify("tournament_award_templates", "tournament_id", tournamentId);
  if (!templatesResult.ok) return templatesResult;

  // 5. The matches themselves, now that every child row is gone.
  if (matchIds.length > 0) {
    const { data: deletedMatches, error: matchDelErr } = await supabase
      .from("matches")
      .delete()
      .in("id", matchIds)
      .select("id");
    if (matchDelErr) {
      console.error("deleteTournament(matches) failed:", matchDelErr.message);
      return {
        ok: false,
        error: "One of this tournament's matches still has data that couldn't be removed — please try again.",
      };
    }
    if ((deletedMatches ?? []).length !== matchIds.length) {
      console.error(
        `deleteTournament(matches) blocked: expected ${matchIds.length}, deleted ${
          (deletedMatches ?? []).length
        } — likely RLS.`
      );
      return {
        ok: false,
        error: "Not all of this tournament's matches could be deleted — this looks like a permissions issue. Please try again or contact support.",
      };
    }
  }

  // 6. Standings, prizes, awards, selections, activity log — all
  //    tournament-scoped (NOT NULL tournament_id), so deleted outright.
  const tournamentScopedTables = [
    "standings",
    "tournament_prizes",
    "tournament_awards",
    "tournament_team_selections",
    "tournament_activity",
  ] as const;

  for (const table of tournamentScopedTables) {
    const result = await deleteAndVerify(table, "tournament_id", tournamentId);
    if (!result.ok) return result;
  }

  // 7. Auctions are NEVER deleted here — just unlinked. An auction (or a
  //    Squad Board) can exist independently of any tournament.
  const { data: unlinkedAuctions, error: unlinkAuctionsErr } = await supabase
    .from("auctions")
    .update({ tournament_id: null })
    .eq("tournament_id", tournamentId)
    .select("id");
  if (unlinkAuctionsErr) {
    console.error("deleteTournament(unlink auctions) failed:", unlinkAuctionsErr.message);
    return { ok: false, error: "Couldn't unlink this tournament's auctions — please try again." };
  }
  // Verify none are left pointing at this tournament (covers the same
  // silent-RLS-no-op case as everything else above).
  const { count: remainingAuctions, error: auctionCountErr } = await supabase
    .from("auctions")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);
  if (auctionCountErr) {
    console.error("deleteTournament(verify auctions unlinked) failed:", auctionCountErr.message);
    return { ok: false, error: "Couldn't confirm this tournament's auctions were unlinked — please try again." };
  }
  if ((remainingAuctions ?? 0) > 0) {
    console.error(`deleteTournament(unlink auctions) blocked: ${remainingAuctions} still linked — likely RLS.`);
    return {
      ok: false,
      error: "Couldn't unlink this tournament's auctions — this looks like a permissions issue. Please try again or contact support.",
    };
  }

  // 8. Finally, the tournament row itself.
  const { error } = await supabase.from("tournaments").delete().eq("id", tournamentId);
  if (error) {
    console.error("deleteTournament failed:", error.message);
    if (error.code === "23503") {
      return {
        ok: false,
        error:
          "This tournament still has linked data that couldn't be cleared (likely a permissions/RLS restriction on one of its related tables) — please contact support.",
      };
    }
    return { ok: false, error: "Couldn't delete that tournament — please try again." };
  }

  return { ok: true, deletedMatchCount: matchIds.length };
}

/** Bulk delete — same cascading behavior as the single-row version per id,
 *  plus a running total of how many matches were removed across the whole
 *  batch, so the caller can show one summary line. */
export async function deleteTournaments(
  tournamentIds: string[]
): Promise<{ okIds: string[]; failedIds: string[]; totalMatchesDeleted: number }> {
  const okIds: string[] = [];
  const failedIds: string[] = [];
  let totalMatchesDeleted = 0;
  for (const id of tournamentIds) {
    const result = await deleteTournament(id);
    if (result.ok) {
      okIds.push(id);
      totalMatchesDeleted += result.deletedMatchCount ?? 0;
    } else {
      failedIds.push(id);
    }
  }
  return { okIds, failedIds, totalMatchesDeleted };
}

/* ────────────────────────────────────────────────────────────────── */
/*  AUCTIONS (lookup only — auction creation/editing lives elsewhere)  */
/* ────────────────────────────────────────────────────────────────── */

export interface AuctionSummary {
  id: string;
  name: string;
  status: string;
  tournamentName: string | null;
  createdAt: string;
}

export type AuctionOption = AuctionSummary;

/** Real, user-facing auctions only. Squad Boards (see SQUAD BOARDS section
 *  below) are stored as auction rows with `is_synthetic = true` purely so
 *  they can reuse the teams/players plumbing — they must never show up
 *  here, in the Matches tab's auction picker, or in the assignable-auctions
 *  list.
 *
 *  NOTE: this filters on `is_synthetic`, not `status`. The `auctions.status`
 *  column has a DB-level CHECK constraint that only allows
 *  'setup' | 'live' | 'paused' | 'completed' — there is no synthetic-only
 *  status value, so a Squad Board row's `status` is a normal, valid value
 *  (defaults to 'setup'). `is_synthetic` is the actual real-vs-synthetic
 *  marker.
 *
 *  DEFENSIVE CHECK: `is_synthetic` alone has been observed to be
 *  unreliable — a friendly-match placeholder auction (see
 *  createFriendlyMatch, which self-references matches.id as
 *  matches.auction_id, relying on a DB trigger to mark the resulting
 *  auctions row is_synthetic = true) has shown up here with
 *  is_synthetic = false, most likely because the trigger doesn't cover
 *  every insert path or is missing entirely. Same defensive pattern as
 *  getSquadBoardsForOrg below: any candidate id that also exists in
 *  `matches` is definitely a placeholder, regardless of what the flag
 *  says, and is excluded here too. */
export async function getAuctionsForOrg(orgId: string): Promise<AuctionSummary[]> {
  const { data, error } = await supabase
    .from("auctions")
    .select("id, name, status, created_at, tournaments(name)")
    .eq("org_id", orgId)
    .eq("is_synthetic", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAuctionsForOrg failed:", error.message);
    return [];
  }

  const candidates = data ?? [];
  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((a: any) => a.id);
  const { data: matchRows, error: matchErr } = await supabase
    .from("matches")
    .select("id")
    .in("id", candidateIds);

  if (matchErr) {
    console.error("getAuctionsForOrg(match-placeholder check) failed:", matchErr.message);
    // Fail open rather than silently hiding real auctions if this lookup breaks.
    return candidates.map((a: any) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      tournamentName: a.tournaments?.name ?? null,
      createdAt: a.created_at,
    }));
  }

  const matchPlaceholderIds = new Set((matchRows ?? []).map((m: any) => m.id));

  return candidates
    .filter((a: any) => !matchPlaceholderIds.has(a.id))
    .map((a: any) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      tournamentName: a.tournaments?.name ?? null,
      createdAt: a.created_at,
    }));
}

export interface CreateAuctionInput {
  name: string;
  tournamentId?: string;
}

export async function createAuction(
  orgId: string,
  userId: string,
  input: CreateAuctionInput
): Promise<string | null> {
  const { data, error } = await supabase
    .from("auctions")
    .insert({
      org_id: orgId,
      name: input.name.trim(),
      created_by: userId,
      tournament_id: input.tournamentId ?? null,
      status: "setup",
      is_synthetic: false,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createAuction failed:", error?.message);
    return null;
  }
  return data.id;
}

/** Deletes an auction and everything scoped to it.
 *
 *  Unlike tournaments (see deleteTournament above), teams here can't be
 *  "unlinked" — `teams.auction_id` is NOT NULL, so a team can never exist
 *  independent of an auction. The reusable, org-level concept is
 *  `team_pool` (see TEAM POOL section below), which has no auction_id at
 *  all; assignPoolTeamToAuction COPIES a pool team into a fresh `teams`
 *  row per auction. So deleting an auction's teams never touches the
 *  pool master — it's still assignable into a new auction afterward.
 *
 *  Order matters:
 *    1. players (auction_id NOT NULL, and sold players FK to teams.id
 *       via sold_to_team_id — must go before teams or that FK blocks).
 *    2. player_bank_assignments / team_pool_assignments /
 *       tournament_team_selections rows referencing these teams — all
 *       nullable FKs so they won't block a teams delete, but left as-is
 *       they'd be stale references to a deleted team, confusing anything
 *       that joins through them later (e.g. getAssignableTeamsForOrg).
 *    3. teams themselves (auction_id NOT NULL — delete, not unlink).
 *    4. the auction row.
 *
 *  NOTE: previously this unlinked from a table called "auction_teams",
 *  which does not exist in the schema (the real table is "teams"), and
 *  tried to null out teams.auction_id, which is NOT NULL — both always
 *  failed. Fixed to delete the real rows instead. */
export async function deleteAuction(auctionId: string): Promise<UpdateOrgResult> {
  // Which teams belong to this auction — needed to clean up rows that
  // reference teams.id but aren't cleared automatically (nullable FKs,
  // not ON DELETE CASCADE).
  const { data: teamRows, error: teamLookupErr } = await supabase
    .from("teams")
    .select("id")
    .eq("auction_id", auctionId);

  if (teamLookupErr) {
    console.error("deleteAuction(team lookup) failed:", teamLookupErr.message);
    return { ok: false, error: "Couldn't check this auction's teams — please try again." };
  }
  const teamIds = (teamRows ?? []).map((t: any) => t.id);

  // Players are auction-scoped (auction_id NOT NULL) — delete before
  // teams, since sold players FK to teams.id via sold_to_team_id.
  const { error: deletePlayersError } = await supabase
    .from("players")
    .delete()
    .eq("auction_id", auctionId);

  if (deletePlayersError) {
    console.error("Failed to delete players for auction:", deletePlayersError.message);
    return { ok: false, error: "Couldn't remove this auction's players — please try again." };
  }

  if (teamIds.length > 0) {
    // Stale player_bank_assignments pointing at these teams.
    const { error: unlinkBankAssignErr } = await supabase
      .from("player_bank_assignments")
      .delete()
      .in("team_id", teamIds);
    if (unlinkBankAssignErr) {
      console.error("deleteAuction(player_bank_assignments cleanup) failed:", unlinkBankAssignErr.message);
    }

    // Stale team_pool_assignments — this auction's copy of each pool team
    // is going away. The team_pool master row itself is untouched, so
    // it's still assignable to a new auction afterward.
    const { error: unlinkPoolAssignErr } = await supabase
      .from("team_pool_assignments")
      .delete()
      .in("teams_row_id", teamIds);
    if (unlinkPoolAssignErr) {
      console.error("deleteAuction(team_pool_assignments cleanup) failed:", unlinkPoolAssignErr.message);
    }

    // Stale tournament_team_selections — if any of these teams were
    // selected into a tournament, that selection is no longer valid.
    const { error: unlinkSelectionsErr } = await supabase
      .from("tournament_team_selections")
      .delete()
      .in("team_id", teamIds);
    if (unlinkSelectionsErr) {
      console.error("deleteAuction(tournament_team_selections cleanup) failed:", unlinkSelectionsErr.message);
    }
  }

  // Teams themselves — auction_id is NOT NULL, so delete rather than unlink.
  const { error: deleteTeamsError } = await supabase
    .from("teams")
    .delete()
    .eq("auction_id", auctionId);

  if (deleteTeamsError) {
    console.error("Failed to delete teams for auction:", deleteTeamsError.message);
    return { ok: false, error: "Couldn't remove this auction's teams — please try again." };
  }

  // Now delete the auction itself
  const { error: deleteError } = await supabase.from("auctions").delete().eq("id", auctionId);
  if (deleteError) {
    console.error("deleteAuction failed:", deleteError.message);
    return { ok: false, error: "Couldn't delete that auction — please try again." };
  }
  return { ok: true };
}

export interface AuctionTeamOption {
  id: string;
  name: string;
  code: string;
  logo: string;
}

/** Given team ids whose own `logo` column is empty, looks up each team's
 *  Team Pool source (via team_pool_assignments) and returns a Map of
 *  teamId -> pool logo, for whichever ones actually have one set.
 *
 *  WHY THIS EXISTS: assignPoolTeamToAuction copies `poolTeam.logo` into
 *  the new `teams` row ONCE, at insert time. If a team was assigned onto
 *  an auction/Squad Board before its Team Pool entry had a logo, the
 *  copied `teams.logo` stays "" forever — adding a logo to Team Pool
 *  later does NOT retroactively update rows that were already copied.
 *  Both getTeamsForAuction and getSquadBoardsWithPreviewForOrg call this
 *  to fall back to the live Team Pool logo whenever `teams.logo` is
 *  empty, so the UI self-heals without needing a manual re-assign.
 *
 *  Two flat queries, no embedded-join guessing (same defensive pattern
 *  used elsewhere in this file). Safe to call with an empty array. */
async function backfillLogosFromPool(missingLogoTeamIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (missingLogoTeamIds.length === 0) return result;

  const { data: assignmentRows, error: assignErr } = await supabase
    .from("team_pool_assignments")
    .select("teams_row_id, pool_team_id")
    .in("teams_row_id", missingLogoTeamIds);

  if (assignErr) {
    console.error("backfillLogosFromPool(assignments) failed:", assignErr.message);
    return result;
  }

  const poolTeamIds = Array.from(
    new Set((assignmentRows ?? []).map((r: any) => r.pool_team_id).filter(Boolean))
  );
  if (poolTeamIds.length === 0) return result;

  const { data: poolRows, error: poolErr } = await supabase
    .from("team_pool")
    .select("id, logo")
    .in("id", poolTeamIds);

  if (poolErr) {
    console.error("backfillLogosFromPool(pool) failed:", poolErr.message);
    return result;
  }

  const logoByPoolId = new Map((poolRows ?? []).map((p: any) => [p.id, p.logo || ""]));
  (assignmentRows ?? []).forEach((r: any) => {
    const logo = logoByPoolId.get(r.pool_team_id);
    if (logo) result.set(r.teams_row_id, logo);
  });

  return result;
}

/** Same self-healing pattern as backfillLogosFromPool above, but for
 *  player photos instead of team logos.
 *
 *  WHY THIS EXISTS: assignBankPlayerToTeam copies `bankPlayer.img` into
 *  the new `players` row ONCE, at insert time. If a player was assigned
 *  onto a team/Squad Board before their Player Bank entry had a photo,
 *  the copied `players.img` stays "" forever — adding a photo to the
 *  Player Bank entry later does NOT retroactively update rows that were
 *  already copied. getTeamRoster calls this to fall back to the live
 *  Player Bank photo whenever `players.img` is empty, so the UI
 *  self-heals without needing a manual re-assign. */
async function backfillImagesFromBank(missingImgPlayerIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (missingImgPlayerIds.length === 0) return result;

  const { data: assignmentRows, error: assignErr } = await supabase
    .from("player_bank_assignments")
    .select("players_row_id, bank_player_id")
    .in("players_row_id", missingImgPlayerIds);

  if (assignErr) {
    console.error("backfillImagesFromBank(assignments) failed:", assignErr.message);
    return result;
  }

  const bankPlayerIds = Array.from(
    new Set((assignmentRows ?? []).map((r: any) => r.bank_player_id).filter(Boolean))
  );
  if (bankPlayerIds.length === 0) return result;

  const { data: bankRows, error: bankErr } = await supabase
    .from("player_bank")
    .select("id, img")
    .in("id", bankPlayerIds);

  if (bankErr) {
    console.error("backfillImagesFromBank(bank) failed:", bankErr.message);
    return result;
  }

  const imgByBankId = new Map((bankRows ?? []).map((p: any) => [p.id, p.img || ""]));
  (assignmentRows ?? []).forEach((r: any) => {
    const img = imgByBankId.get(r.bank_player_id);
    if (img) result.set(r.players_row_id, img);
  });

  return result;
}

export interface BracketTeamFallback {
  team1Name?: string;
  team1Logo?: string;
  team2Name?: string;
  team2Logo?: string;
  venue?: string;
  date?: string;
  time?: string;
}

/** Same self-healing pattern as backfillLogosFromPool/backfillImagesFromBank
 *  above, but for a match's team names/logos.
 *
 *  WHY THIS EXISTS: match_setup.team1/team2 is a JSON snapshot copied in
 *  ONCE at match-creation time (see createFriendlyMatch) — it isn't a
 *  foreign key, so there's nothing to re-fetch from `teams` by id if the
 *  snapshot ever ends up with an empty name (e.g. a bracket slot that was
 *  pre-created before real teams were assigned to it). For a
 *  tournament-linked match, though, there IS a second place the real team
 *  lives: bracket_matches.team_a_id / team_b_id, once that slot has been
 *  filled in. This looks the team up there and returns its name/logo so
 *  callers can fall back to real data instead of a bare "Team 1"/"Team 2"
 *  placeholder.
 *
 *  ASSUMES team_a -> team1 and team_b -> team2 by position. There's no
 *  stored mapping tying "team1 in this match's JSON" to "team_a in this
 *  bracket slot" — this holds for how bracket slots normally get filled,
 *  but isn't a hard guarantee if a match was ever edited independently of
 *  its slot.
 *
 *  Only useful for matches with a real bracket_matches row (i.e.
 *  tournament-linked matches) — standalone matches have no slot to fall
 *  back to and simply won't appear in the returned map. Safe to call with
 *  an empty array. */
async function backfillTeamsFromBracket(matchIds: string[]): Promise<Map<string, BracketTeamFallback>> {
  const result = new Map<string, BracketTeamFallback>();
  if (matchIds.length === 0) return result;

  const { data: bracketRows, error: bracketErr } = await supabase
    .from("bracket_matches")
    .select("overlay_match_id, team_a_id, team_b_id, venue, scheduled_at")
    .in("overlay_match_id", matchIds);

  if (bracketErr) {
    console.error("backfillTeamsFromBracket(bracket lookup) failed:", bracketErr.message);
    return result;
  }

  const rows = (bracketRows ?? []).filter((r: any) => r.overlay_match_id);
  if (rows.length === 0) return result;

  const teamIds = Array.from(
    new Set(rows.flatMap((r: any) => [r.team_a_id, r.team_b_id]).filter(Boolean))
  );

  const { data: teamRows, error: teamErr } = teamIds.length
    ? await supabase.from("teams").select("id, name, logo").in("id", teamIds)
    : { data: [], error: null };

  if (teamErr) {
    console.error("backfillTeamsFromBracket(teams lookup) failed:", teamErr.message);
    return result;
  }

  const teamById = new Map((teamRows ?? []).map((t: any) => [t.id, t]));

  rows.forEach((r: any) => {
    const teamA = r.team_a_id ? teamById.get(r.team_a_id) : null;
    const teamB = r.team_b_id ? teamById.get(r.team_b_id) : null;
    const scheduled = r.scheduled_at ? new Date(r.scheduled_at) : null;

    result.set(r.overlay_match_id, {
      team1Name: teamA?.name || undefined,
      team1Logo: teamA?.logo || undefined,
      team2Name: teamB?.name || undefined,
      team2Logo: teamB?.logo || undefined,
      venue: r.venue || undefined,
      date: scheduled ? scheduled.toLocaleDateString() : undefined,
      time: scheduled ? scheduled.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
    });
  });

  return result;
}

export async function getTeamsForAuction(auctionId: string): Promise<AuctionTeamOption[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, code, logo")
    .eq("auction_id", auctionId)
    .order("name", { ascending: true });

  if (error) {
    console.error("getTeamsForAuction failed:", error.message);
    return [];
  }
  const teams = data ?? [];

  const missingLogoIds = teams.filter((t: any) => !t.logo).map((t: any) => t.id);
  const poolLogoByTeamId = await backfillLogosFromPool(missingLogoIds);

  return teams.map((t: any) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    logo: t.logo || poolLogoByTeamId.get(t.id) || "",
  }));
}

/* ────────────────────────────────────────────────────────────────── */
/*  FRIENDLY MATCHES                                                   */
/* ────────────────────────────────────────────────────────────────── */

export interface FriendlyMatchSummary {
  id: string;
  /** The id used to resolve this match's Overlay Control Room route
   *  (`/overlay/[auctionId]/admin`). For an auction-sourced match this is
   *  the real auction's id (`matches.auction_id`). For a manual/standalone
   *  match, `matches.auction_id` is NULL in the DB (see createFriendlyMatch
   *  below), so this falls back to the match's own `id` — a synthetic
   *  "auction id" that matchPersistence.ts's getOrCreateMatch must also
   *  know how to resolve when there's no real auctions row behind it.
   *  Always use this field for the overlay link — never `id` directly and
   *  never assume the two are the same for every match. */
  auctionId: string;
  team1Name: string;
  team2Name: string;
  /** Team logo URLs pulled from match_setup at creation time (copied from
   *  whichever Team Pool / auction team the match's teams came from). Null
   *  when the source team had no logo set — the UI shows a placeholder. */
  team1Logo: string | null;
  team2Logo: string | null;
  round: string;
  createdAt: string;
  tournamentName: string | null;
  /** The id of the tournament this match's bracket slot belongs to, when
   *  it's linked (via bracket_matches.tournament_id). Null for standalone
   *  matches. Used by the Tournaments tab to group each tournament's
   *  matches for display right alongside that tournament — kept separate
   *  from `tournamentName` since the name alone can't be used to key a
   *  lookup safely (two tournaments could share a name). */
  tournamentId: string | null;
  overlayConfigured: boolean;
  /** True if this match's teams were pulled from an auction (i.e. it has
   *  a non-empty squads array in match_setup) rather than typed manually.
   *  Used purely for the "linked to auction" status badge — there is no
   *  separate FK for this, so it's inferred from the presence of squads. */
  auctionLinked: boolean;
  /** Venue / date / time filled in from the match's edit panel. Blank/null
   *  for a freshly-created standalone match that hasn't been edited yet —
   *  the UI only shows these once they're populated. */
  venue: string | null;
  date: string | null;
  time: string | null;
}


export type CreateFriendlyMatchInput =
  | { teamSource: "manual"; team1Name: string; team2Name: string; team1Logo?: string; team2Logo?: string; round?: string }
  | { teamSource: "auction"; auctionId: string; team1Id: string; team2Id: string; round?: string };

export async function createFriendlyMatch(
  orgId: string,
  input: CreateFriendlyMatchInput,
  tournamentId?: string | null,
  bracketMatchId?: string | null
): Promise<string | null> {
  const newId = crypto.randomUUID();

  let team1: { name: string; short: string; logo: string };
  let team2: { name: string; short: string; logo: string };
  let squads: { name: string; role: string; team: string; captain?: boolean; imageUrl?: string }[] = [];
  // True only when the source is a REAL bidding auction (not a Squad
  // Board, and not a standalone/manual match). Computed once, here, and
  // baked into match_setup.rosterLocked below.
  let rosterLocked = false;
  // Informational reference to whichever auction/Squad Board these teams
  // came from — stored inside match_setup only. NEVER written to the
  // matches.auction_id column: that column must stay unique-per-match
  // (every match self-references its own `id`), because a source
  // auction/Squad Board is shared across every match built from it, and
  // reusing its id as auction_id would violate the UNIQUE constraint on
  // the second match created from the same board, and would also make
  // getOrCreateMatch's lookup ambiguous between matches sharing a source.
  let sourceAuctionId: string | null = null;

  if (input.teamSource === "manual") {
    team1 = { name: input.team1Name.trim(), short: shortCode(input.team1Name), logo: input.team1Logo?.trim() || "" };
    team2 = { name: input.team2Name.trim(), short: shortCode(input.team2Name), logo: input.team2Logo?.trim() || "" };
  } else {
    sourceAuctionId = input.auctionId;

    const { data: teamRows, error: teamErr } = await supabase
      .from("teams")
      .select("id, name, code, logo")
      .in("id", [input.team1Id, input.team2Id]);

    if (teamErr || !teamRows || teamRows.length !== 2) {
      console.error("createFriendlyMatch(auction teams) failed:", teamErr?.message);
      return null;
    }
    const t1 = teamRows.find((t) => t.id === input.team1Id)!;
    const t2 = teamRows.find((t) => t.id === input.team2Id)!;
    team1 = { name: t1.name, short: t1.code, logo: t1.logo || "" };
    team2 = { name: t2.name, short: t2.code, logo: t2.logo || "" };

    const { data: playerRows, error: playersErr } = await supabase
      .from("players")
      .select("name, role, img, sold_to_team_id, owner_team_code")
      .in("sold_to_team_id", [input.team1Id, input.team2Id]);

    if (playersErr) {
      console.error("createFriendlyMatch(auction players) failed:", playersErr.message);
    }

    // Group players by team with playerId references - images will be fetched dynamically
    const team1Players = (playerRows ?? [])
      .filter((p: any) => p.sold_to_team_id === input.team1Id)
      .map((p: any) => ({
        name: p.name,
        role: p.role,
        xi: true,
        playerId: p.id,
      }))
    
    const team2Players = (playerRows ?? [])
      .filter((p: any) => p.sold_to_team_id === input.team2Id)
      .map((p: any) => ({
        name: p.name,
        role: p.role,
        xi: true,
        playerId: p.id,
      }))

    // Find captains: first player with owner_team_code, or first player if none found
    const team1Captain = (playerRows ?? []).find((p: any) => p.sold_to_team_id === input.team1Id && p.owner_team_code)?.name || team1Players[0]?.name || ""
    const team2Captain = (playerRows ?? []).find((p: any) => p.sold_to_team_id === input.team2Id && p.owner_team_code)?.name || team2Players[0]?.name || ""

    // Flatten players into the squads array with team reference
    const team1Squads = team1Players.map((p) => ({
      name: p.name,
      role: p.role,
      team: t1.code,
      captain: p.name === team1Captain || undefined,
      imageUrl: undefined,
    }))

    const team2Squads = team2Players.map((p) => ({
      name: p.name,
      role: p.role,
      team: t2.code,
      captain: p.name === team2Captain || undefined,
      imageUrl: undefined,
    }))

    squads = [...team1Squads, ...team2Squads];

    // Was this pulled from a real bidding auction, or a Squad Board
    // (which is just a synthetic auction row reusing the same tables)?
    // Checked once, here, while input.auctionId (the real source id) is
    // still in scope — this is the only point in the app where that
    // distinction can still be made for this match.
    const { data: sourceAuction, error: sourceErr } = await supabase
      .from("auctions")
      .select("is_synthetic")
      .eq("id", input.auctionId)
      .maybeSingle();

    if (sourceErr) {
      console.error("createFriendlyMatch(source auction lookup) failed:", sourceErr.message);
    }
    rosterLocked = sourceAuction ? !sourceAuction.is_synthetic : false;
  }

  const matchSetup = {
    tournamentName: "",
    round: input.round?.trim() || "Friendly Match",
    team1,
    team2,
    venue: "",
    date: "",
    time: "",
    toss: "",
    overs: 20,
    officials: { format: "", umpires: "", thirdUmpire: "", referee: "" },
    squads,
    rosterLocked,
    sourceAuctionId,
  };

  const { data, error } = await supabase
    .from("matches")
    .insert({
      id: newId,
      // Always self-reference — see sourceAuctionId comment above for why
      // this must never be input.auctionId.
      auction_id: newId,
      org_id: orgId,
      tournament_id: tournamentId || null,
      bracket_match_id: bracketMatchId || null,
      match_setup: matchSetup,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createFriendlyMatch failed:", error?.message);
    return null;
  }
  return data.id;
}

/** Friendly wrapper around a Postgres FK-violation (23503) so the caller
 *  can show something more useful than "please try again" when a match
 *  still has live-play data (balls, match_state, engine_state, etc.) or is
 *  still linked from a bracket. */
export async function deleteFriendlyMatch(matchId: string): Promise<UpdateOrgResult> {
  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) {
    console.error("deleteFriendlyMatch failed:", error.message);
    if (error.code === "23503") {
      return {
        ok: false,
        error:
          "This match still has recorded play data or a bracket link and can't be deleted yet. Disconnect it from its bracket slot first, or contact support if it has live scoring data.",
      };
    }
    return { ok: false, error: "Couldn't delete that match — please try again." };
  }
  return { ok: true };
}

/** Bulk delete for the Matches tab's multi-select. Callers should filter
 *  out tournament-linked matches before calling this (same rule as the
 *  single-match delete: disconnect from the bracket first).
 *
 *  Deletes one row at a time (rather than a single `.in()` call) so that
 *  one match with FK-blocking play data doesn't cause the entire batch to
 *  fail — the UI can drop only the ids that actually succeeded and report
 *  the rest, with reasons, as failures. */
export async function deleteFriendlyMatches(
  matchIds: string[]
): Promise<{ okIds: string[]; failed: { id: string; error: string }[] }> {
  const okIds: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const id of matchIds) {
    const result = await deleteFriendlyMatch(id);
    if (result.ok) okIds.push(id);
    else failed.push({ id, error: result.error ?? "Couldn't delete that match." });
  }
  return { okIds, failed };
}

function shortCode(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 4) || "TBD";
}

/* ────────────────────────────────────────────────────────────────── */
/*  REALTIME SYNC                                                       */
/* ────────────────────────────────────────────────────────────────── */

export function subscribeToOrgMatches(orgId: string, onChange: () => void): RealtimeChannel {
  const channel = supabase
    .channel(`org-matches-${orgId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "matches", filter: `org_id=eq.${orgId}` },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "bracket_matches", 
        filter: `tournament_id=in.(SELECT id FROM tournaments WHERE org_id=eq.${orgId})` },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "on_air_channels" },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "weather_readings" },
      onChange
    )
    .subscribe();
  return channel;
}

/**
 * Fetch all matches for a specific tournament, filtered by tournament_id.
 * This is preferred over getFriendlyMatchesForOrg when you need tournament-specific matches.
 */
export async function getMatchesForTournament(tournamentId: string): Promise<FriendlyMatchSummary[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("id, match_setup, created_at, bracket_match_id, tournament_id")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getMatchesForTournament failed:", error.message);
    return [];
  }

  const matches = data ?? [];
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length === 0) return [];

  const [{ data: channelRows }, { data: weatherRows }, bracketFallbackByMatch] = await Promise.all([
    supabase.from("on_air_channels").select("match_id, channels").in("match_id", matchIds),
    supabase.from("weather_readings").select("match_id, coords").in("match_id", matchIds),
    backfillTeamsFromBracket(matchIds),
  ]);

  const overlaySet = new Set<string>();
  (channelRows ?? []).forEach((c: any) => {
    if (Array.isArray(c.channels) && c.channels.length > 0) overlaySet.add(c.match_id);
  });
  (weatherRows ?? []).forEach((w: any) => {
    const coords = (w.coords ?? {}) as { lat?: number; lng?: number };
    if (typeof coords.lat === "number" && typeof coords.lng === "number") overlaySet.add(w.match_id);
  });

  return matches.map((m: any) => {
    const setup = (m.match_setup ?? {}) as Record<string, any>;
    const fallback = bracketFallbackByMatch.get(m.id);
    return {
      id: m.id,
      auctionId: m.id,
      team1Name: setup.team1?.name || fallback?.team1Name || "Team 1",
      team2Name: setup.team2?.name || fallback?.team2Name || "Team 2",
      team1Logo: setup.team1?.logo || fallback?.team1Logo || null,
      team2Logo: setup.team2?.logo || fallback?.team2Logo || null,
      round: setup.round ?? "Friendly",
      createdAt: m.created_at,
      tournamentName: null,
      tournamentId: m.tournament_id ?? null,
      overlayConfigured: overlaySet.has(m.id),
      auctionLinked: Array.isArray(setup.squads) && setup.squads.length > 0,
      venue: setup.venue || null,
      date: setup.date || null,
      time: setup.time || null,
    };
  });
}

export function subscribeToOrgTournaments(orgId: string, onChange: () => void): RealtimeChannel {
  const channel = supabase
    .channel(`org-tournaments-${orgId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tournaments", filter: `org_id=eq.${orgId}` },
      onChange
    )
    .subscribe();
  return channel;
}

export function unsubscribe(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}

/* ────────────────────────────────────────────────────────────────── */
/*  PLAYER BANK                                                        */
/* ────────────────────────────────────────────────────────────────── */

export interface BankPlayer {
  id: string;
  name: string;
  role: string;
  origin: string;
  country: string;
  img: string;
  capped: boolean;
  notes: string | null;
}

export interface BankPlayerInput {
  name: string;
  role: BankPlayer["role"];
  origin: string;
  country?: string;
  img?: string;
  capped?: boolean;
  notes?: string;
}

export async function getPlayerBank(orgId: string): Promise<BankPlayer[]> {
  const { data, error } = await supabase
    .from("player_bank")
    .select("id, name, role, origin, country, img, capped, notes, img")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (error) {
    console.error("getPlayerBank failed:", error.message);
    return [];
  }
  return data ?? [];
}

export async function addBankPlayer(
  orgId: string,
  userId: string,
  input: BankPlayerInput
): Promise<BankPlayer | null> {
  const { data, error } = await supabase
    .from("player_bank")
    .insert({
      org_id: orgId,
      created_by: userId,
      name: input.name,
      role: input.role,
      origin: input.origin,
      country: input.country ?? "",
      img: input.img ?? "",
      capped: input.capped ?? false,
      notes: input.notes ?? null,
    })
    .select("id, name, role, origin, country, img, capped, notes")
    .single();

  if (error || !data) {
    console.error("addBankPlayer failed:", error?.message);
    return null;
  }
  return data;
}

/** Updates a Player Bank entry. If `img` is part of the patch, the new
 *  photo is also pushed out to every `players` row that was ever copied
 *  from this bank player (found via player_bank_assignments) — not just
 *  the ones whose own `img` is currently empty. */
export async function updateBankPlayer(playerId: string, patch: Partial<BankPlayerInput>): Promise<boolean> {
  const { error } = await supabase.from("player_bank").update(patch).eq("id", playerId);
  if (error) {
    console.error("updateBankPlayer failed:", error.message);
    return false;
  }

  if (patch.img !== undefined) {
    await propagateBankPlayerImageToAssignedPlayers(playerId, patch.img);
  }

  return true;
}

/** Pushes a bank player's current `img` to every `players` row that was
 *  copied from them (looked up via player_bank_assignments.bank_player_id
 *  -> players_row_id). Called from updateBankPlayer whenever `img`
 *  changes. Safe to call even if the bank player was never assigned to a
 *  team — it just finds zero rows and does nothing. */
async function propagateBankPlayerImageToAssignedPlayers(bankPlayerId: string, img: string): Promise<void> {
  const { data: assignmentRows, error: assignErr } = await supabase
    .from("player_bank_assignments")
    .select("players_row_id")
    .eq("bank_player_id", bankPlayerId);

  if (assignErr) {
    console.error("propagateBankPlayerImageToAssignedPlayers(lookup) failed:", assignErr.message);
    return;
  }

  const playerRowIds = Array.from(
    new Set((assignmentRows ?? []).map((r: any) => r.players_row_id).filter(Boolean))
  );
  if (playerRowIds.length === 0) return;

  const { error: updateErr } = await supabase
    .from("players")
    .update({ img: img || "" })
    .in("id", playerRowIds);

  if (updateErr) {
    console.error("propagateBankPlayerImageToAssignedPlayers(update) failed:", updateErr.message);
  }
}

/** Deletes a Player Bank entry, and propagates the deletion to every
 *  `players` row that was ever copied from it (found via
 *  player_bank_assignments), plus the assignment rows themselves. */
export async function deleteBankPlayer(playerId: string): Promise<boolean> {
  const cleanedUp = await removeAssignedPlayersForBankPlayer(playerId);
  if (!cleanedUp) return false;

  const { error } = await supabase.from("player_bank").delete().eq("id", playerId);
  if (error) {
    console.error("deleteBankPlayer failed:", error.message);
    return false;
  }
  return true;
}

/** Removes every `players` row copied from this bank player, and the
 *  `player_bank_assignments` rows that link them, in that order. Used by
 *  deleteBankPlayer above. Safe to call even if the bank player was never
 *  assigned to a team — it just finds zero rows and returns true. */
async function removeAssignedPlayersForBankPlayer(bankPlayerId: string): Promise<boolean> {
  const { data: assignmentRows, error: assignErr } = await supabase
    .from("player_bank_assignments")
    .select("players_row_id")
    .eq("bank_player_id", bankPlayerId);

  if (assignErr) {
    console.error("removeAssignedPlayersForBankPlayer(lookup) failed:", assignErr.message);
    return false;
  }

  const playerRowIds = Array.from(
    new Set((assignmentRows ?? []).map((r: any) => r.players_row_id).filter(Boolean))
  );

  if (playerRowIds.length > 0) {
    const { error: deletePlayersErr } = await supabase.from("players").delete().in("id", playerRowIds);
    if (deletePlayersErr) {
      console.error("removeAssignedPlayersForBankPlayer(delete players) failed:", deletePlayersErr.message);
      return false;
    }
  }

  const { error: deleteAssignErr } = await supabase
    .from("player_bank_assignments")
    .delete()
    .eq("bank_player_id", bankPlayerId);

  if (deleteAssignErr) {
    console.error("removeAssignedPlayersForBankPlayer(delete assignments) failed:", deleteAssignErr.message);
    return false;
  }

  return true;
}

/* ── Assignment: bank player -> a real team's roster ── */

export interface AssignableTeam {
  teamId: string;
  teamName: string;
  teamCode: string;
  auctionId: string;
  auctionName: string;
  tournamentName: string | null;
}

export async function getAssignableTeamsForOrg(orgId: string): Promise<AssignableTeam[]> {
  const { data, error } = await supabase
    .from("team_pool_assignments")
    .select(
      "teams_row_id, auction_id, team_pool!inner(id, name, code, org_id), auctions!inner(id, name, tournament_id, tournaments(name))"
    )
    .eq("team_pool.org_id", orgId);

  if (error) {
    console.error("getAssignableTeamsForOrg failed:", error.message);
    return [];
  }

  return (data ?? [])
    .filter((row: any) => row.teams_row_id && row.auction_id)
    .map((row: any) => ({
      teamId: row.teams_row_id,
      teamName: row.team_pool?.name ?? "Team",
      teamCode: row.team_pool?.code ?? "",
      auctionId: row.auction_id,
      auctionName: row.auctions?.name ?? "Auction",
      tournamentName: row.auctions?.tournaments?.name ?? null,
    }));
}

export interface AssignResult {
  ok: boolean;
  error?: string;
}

export interface TeamRosterPlayer {
  id: string;
  name: string;
  role: string;
  isCaptain: boolean;
  img: string;
}

export async function getTeamRoster(teamId: string): Promise<TeamRosterPlayer[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, role, owner_team_code, img")
    .eq("sold_to_team_id", teamId)
    .order("name", { ascending: true });

  if (error) {
    console.error("getTeamRoster failed:", error.message);
    return [];
  }
  const players = data ?? [];

  const missingImgIds = players.filter((p: any) => !p.img).map((p: any) => p.id);
  const bankImgByPlayerId = await backfillImagesFromBank(missingImgIds);

  return players.map((p: any) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    isCaptain: !!p.owner_team_code,
    img: p.img || bankImgByPlayerId.get(p.id) || "",
  }));
}

export async function getAssignedBankPlayerIdsForBoard(boardId: string): Promise<string[]> {
  const boardTeams = await getTeamsForAuction(boardId);
  const teamIds = boardTeams.map((t) => t.id);
  if (teamIds.length === 0) return [];

  const { data, error } = await supabase
    .from("player_bank_assignments")
    .select("bank_player_id")
    .in("team_id", teamIds);

  if (error) {
    console.error("getAssignedBankPlayerIdsForBoard failed:", error.message);
    return [];
  }
  return Array.from(new Set((data ?? []).map((r: any) => r.bank_player_id).filter(Boolean)));
}

export async function getAssignedPoolTeamIdsForBoard(boardId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("team_pool_assignments")
    .select("pool_team_id")
    .eq("auction_id", boardId);

  if (error) {
    console.error("getAssignedPoolTeamIdsForBoard failed:", error.message);
    return [];
  }
  return Array.from(new Set((data ?? []).map((r: any) => r.pool_team_id).filter(Boolean)));
}


export async function assignBankPlayerToTeam(
  bankPlayer: BankPlayer,
  team: AssignableTeam,
  isCaptain: boolean
): Promise<AssignResult> {
  const boardTeams = await getTeamsForAuction(team.auctionId);
  const boardTeamIds = boardTeams.map((t) => t.id);

  if (boardTeamIds.length > 0) {
    const { data: existingAssignments, error: existingErr } = await supabase
      .from("player_bank_assignments")
      .select("id")
      .eq("bank_player_id", bankPlayer.id)
      .in("team_id", boardTeamIds);

    if (existingErr) {
      console.error("assignBankPlayerToTeam(duplicate check) failed:", existingErr.message);
      return { ok: false, error: "Couldn't verify this player's existing assignments — please try again." };
    }

    if ((existingAssignments ?? []).length > 0) {
      return {
        ok: false,
        error: `${bankPlayer.name} is already assigned to a team on this board/auction — a player can't be on two teams in the same one.`,
      };
    }
  }

  const { data: inserted, error } = await supabase
    .from("players")
    .insert({
      auction_id: team.auctionId,
      name: bankPlayer.name,
      role: bankPlayer.role,
      origin: bankPlayer.origin,
      country: bankPlayer.country || "",
      img: bankPlayer.img || "",
      capped: bankPlayer.capped,
      sold_to_team_id: team.teamId,
      owner_team_code: isCaptain ? team.teamCode : null,
      status: "sold",
      is_manual_entry: true,
      is_unsold_final: true,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("assignBankPlayerToTeam(insert player) failed:", error?.message);
    return { ok: false, error: "Couldn't add this player to the team — please try again." };
  }

  if (isCaptain) {
    await supabase.from("players").update({ owner_team_code: null }).eq("sold_to_team_id", team.teamId).neq("id", inserted.id);
  }

  const { error: logErr } = await supabase.from("player_bank_assignments").insert({
    bank_player_id: bankPlayer.id,
    players_row_id: inserted.id,
    team_id: team.teamId,
  });
  if (logErr) {
    console.error("assignBankPlayerToTeam(log) failed:", logErr.message);
  }

  return { ok: true };
}

/* ────────────────────────────────────────────────────────────────── */
/*  TEAM POOL                                                          */
/* ────────────────────────────────────────────────────────────────── */

export interface PoolTeam {
  id: string;
  name: string;
  code: string;
  owner: string;
  color: string;
  logo: string;
  tier: string;
  notes: string | null;
}

export interface PoolTeamInput {
  name: string;
  code: string;
  owner?: string;
  color?: string;
  logo?: string;
  tier?: PoolTeam["tier"];
  notes?: string;
}

export async function getTeamPool(orgId: string): Promise<PoolTeam[]> {
  const { data, error } = await supabase
    .from("team_pool")
    .select("id, name, code, owner, color, logo, tier, notes")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (error) {
    console.error("getTeamPool failed:", error.message);
    return [];
  }
  return data ?? [];
}

export async function addPoolTeam(orgId: string, userId: string, input: PoolTeamInput): Promise<PoolTeam | null> {
  const { data, error } = await supabase
    .from("team_pool")
    .insert({
      org_id: orgId,
      created_by: userId,
      name: input.name,
      code: input.code,
      owner: input.owner ?? "",
      color: input.color ?? "#e45d35",
      logo: input.logo ?? "",
      tier: input.tier ?? "Pro",
      notes: input.notes ?? null,
    })
    .select("id, name, code, owner, color, logo, tier, notes")
    .single();

  if (error || !data) {
    console.error("addPoolTeam failed:", error?.message);
    return null;
  }
  return data;
}

export async function updatePoolTeam(poolTeamId: string, patch: Partial<PoolTeamInput>): Promise<boolean> {
  const { error } = await supabase.from("team_pool").update(patch).eq("id", poolTeamId);
  if (error) {
    console.error("updatePoolTeam failed:", error.message);
    return false;
  }
  return true;
}

export async function deletePoolTeam(poolTeamId: string): Promise<boolean> {
  const { error } = await supabase.from("team_pool").delete().eq("id", poolTeamId);
  if (error) {
    console.error("deletePoolTeam failed:", error.message);
    return false;
  }
  return true;
}

/* ── Assignment: pool team -> a real auction's team list ── */

export async function getAssignableAuctionsForOrg(orgId: string): Promise<AuctionSummary[]> {
  const auctions = await getAuctionsForOrg(orgId);
  return auctions.filter((a) => a.status !== "completed");
}

export interface AssignResultWithId extends AssignResult {
  /** The id of the newly-inserted `teams` row, when the assignment
   *  succeeded. Lets callers (e.g. createAuctionWithPoolTeams below)
   *  immediately assign bank players onto this team without a second
   *  round-trip to look it back up. */
  teamId?: string;
}

export async function assignPoolTeamToAuction(poolTeam: PoolTeam, auction: AuctionSummary): Promise<AssignResultWithId> {
  const { data: inserted, error } = await supabase
    .from("teams")
    .insert({
      auction_id: auction.id,
      name: poolTeam.name,
      code: poolTeam.code,
      owner: poolTeam.owner || "TBD",
      color: poolTeam.color || "#e45d35",
      logo: poolTeam.logo || "",
      tier: poolTeam.tier || "Pro",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("assignPoolTeamToAuction(insert team) failed:", error?.message);
    if (error?.code === "23505") {
      return { ok: false, error: "That team code is already used in this auction — try a different code." };
    }
    return { ok: false, error: "Couldn't add this team to the auction — please try again." };
  }

  const { error: logErr } = await supabase.from("team_pool_assignments").insert({
    pool_team_id: poolTeam.id,
    teams_row_id: inserted.id,
    auction_id: auction.id,
  });
  if (logErr) {
    console.error("assignPoolTeamToAuction(log) failed:", logErr.message);
  }

  return { ok: true, teamId: inserted.id };
}

/* ── Seeding a brand-new auction with Team Pool teams + Player Bank
     players — INDEPENDENTLY of each other. A Squad Board is where you
     pre-assign a specific player onto a specific team with no bidding;
     a real auction is the opposite of that on purpose. So here:
       - selected Team Pool teams are copied onto the auction as bidding
         teams (same insert as assignPoolTeamToAuction — untouched).
       - selected Player Bank players are copied into the auction's
         bidding POOL only: `auction_id` set, but `sold_to_team_id` /
         `sold_price` / `lot_order` all left null, `status: 'available'`.
         That's the exact shape of a player typed in by hand during
         setup, before Shuffle/Launch ever run — so they flow through
         the real auction/bidding UI normally afterward, with no team
         pre-assigned. ── */

export interface CreateAuctionWithPoolSeedsResult {
  id: string | null;
  /** Pool team names that failed to be copied onto the new auction (e.g.
   *  a duplicate team code within this auction). */
  teamErrors: string[];
  /** Bank player names that failed to be copied into the auction's pool. */
  playerErrors: string[];
}

/** Copies a Player Bank entry into a brand-new (or existing) auction's
 *  bidding pool — NOT onto any team. Deliberately does NOT reuse
 *  assignBankPlayerToTeam: that function immediately marks a player
 *  'sold' onto a specific team with no bidding step (right for Squad
 *  Boards, wrong here). These players still need to go through Shuffle
 *  and the live auction like any other pool player. */
export async function addBankPlayerToAuctionPool(auctionId: string, bankPlayer: BankPlayer): Promise<AssignResult> {
  const { data: inserted, error } = await supabase
    .from("players")
    .insert({
      auction_id: auctionId,
      name: bankPlayer.name,
      role: bankPlayer.role,
      origin: bankPlayer.origin,
      country: bankPlayer.country || "",
      img: bankPlayer.img || "",
      capped: bankPlayer.capped,
      status: "available",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("addBankPlayerToAuctionPool(insert player) failed:", error?.message);
    return { ok: false, error: "Couldn't add this player to the auction pool — please try again." };
  }

  // Logged with team_id: null — this player hasn't been assigned to a
  // team, just made available in this auction's pool. Lets the image
  // backfill machinery (and any future "where did this pool player come
  // from" lookup) still trace it back to its Player Bank source.
  const { error: logErr } = await supabase.from("player_bank_assignments").insert({
    bank_player_id: bankPlayer.id,
    players_row_id: inserted.id,
    team_id: null,
  });
  if (logErr) {
    console.error("addBankPlayerToAuctionPool(log) failed:", logErr.message);
  }

  return { ok: true };
}

/** Creates the auction row, then:
 *    1. copies each selected Team Pool team onto it as a bidding team
 *       (assignPoolTeamToAuction — unchanged, teams are ready to bid with)
 *    2. copies each selected Player Bank player into the auction's pool
 *       as an available, unsold player (addBankPlayerToAuctionPool above)
 *  Teams and players are independent selections — no player is
 *  pre-assigned to any team; that only happens through actual bidding
 *  (or Shuffle -> Launch) afterward, same as a manually-built auction. */
export async function createAuctionWithPoolSeeds(
  orgId: string,
  userId: string,
  input: CreateAuctionInput,
  poolTeamIds: string[],
  bankPlayerIds: string[]
): Promise<CreateAuctionWithPoolSeedsResult> {
  const auctionId = await createAuction(orgId, userId, input);
  if (!auctionId) return { id: null, teamErrors: [], playerErrors: [] };

  const teamErrors: string[] = [];
  const playerErrors: string[] = [];

  if (poolTeamIds.length > 0) {
    const poolTeams = await getTeamPool(orgId);
    const selectedTeams = poolTeams.filter((t) => poolTeamIds.includes(t.id));

    const auctionStub: AuctionSummary = {
      id: auctionId,
      name: input.name.trim(),
      status: "setup",
      tournamentName: null,
      createdAt: new Date().toISOString(),
    };

    for (const team of selectedTeams) {
      const result = await assignPoolTeamToAuction(team, auctionStub);
      if (!result.ok) teamErrors.push(team.name);
    }
  }

  if (bankPlayerIds.length > 0) {
    const bankPlayers = await getPlayerBank(orgId);
    const selectedPlayers = bankPlayers.filter((p) => bankPlayerIds.includes(p.id));

    for (const player of selectedPlayers) {
      const result = await addBankPlayerToAuctionPool(auctionId, player);
      if (!result.ok) playerErrors.push(player.name);
    }
  }

  return { id: auctionId, teamErrors, playerErrors };
}

/* ────────────────────────────────────────────────────────────────── */
/*  SQUAD BOARDS  (formerly "Rosters")                                  */
/* ────────────────────────────────────────────────────────────────── */

export interface SquadBoard {
  id: string;
  name: string;
  createdAt: string;
}

export async function getSquadBoardsForOrg(orgId: string): Promise<SquadBoard[]> {
  const { data, error } = await supabase
    .from("auctions")
    .select("id, name, created_at")
    .eq("org_id", orgId)
    .eq("is_synthetic", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getSquadBoardsForOrg failed:", error.message);
    return [];
  }

  const candidates = data ?? [];
  if (candidates.length === 0) return [];

  // A DB trigger auto-creates a placeholder `auctions` row (is_synthetic
  // = true) for every `matches` insert, purely to satisfy the FK on
  // matches.auction_id — every friendly match self-references its own id
  // as auction_id (see createFriendlyMatch). Those placeholder rows are
  // NOT real Squad Boards and must never show up in this list. They're
  // identifiable because their auction id is also a matches.id (a real
  // user-created Squad Board's id never appears in `matches` this way).
  const candidateIds = candidates.map((r: any) => r.id);
  const { data: matchRows, error: matchErr } = await supabase
    .from("matches")
    .select("id")
    .in("id", candidateIds);

  if (matchErr) {
    console.error("getSquadBoardsForOrg(match-placeholder check) failed:", matchErr.message);
    // Fail open rather than silently hiding real boards if this lookup breaks.
    return candidates.map((r: any) => ({ id: r.id, name: r.name, createdAt: r.created_at }));
  }

  const matchPlaceholderIds = new Set((matchRows ?? []).map((m: any) => m.id));

  return candidates
    .filter((r: any) => !matchPlaceholderIds.has(r.id))
    .map((r: any) => ({ id: r.id, name: r.name, createdAt: r.created_at }));
}

export interface SquadBoardPreview extends SquadBoard {
  teamCount: number;
  playerCount: number;
  teamLogos: string[];
}

export async function getSquadBoardsWithPreviewForOrg(orgId: string): Promise<SquadBoardPreview[]> {
  const boards = await getSquadBoardsForOrg(orgId);
  if (boards.length === 0) return [];
  const boardIds = boards.map((b) => b.id);

  const { data: teamRows, error: teamsErr } = await supabase
    .from("teams")
    .select("id, auction_id, logo")
    .in("auction_id", boardIds);

  if (teamsErr) {
    console.error("getSquadBoardsWithPreviewForOrg(teams) failed:", teamsErr.message);
  }
  const teams = teamRows ?? [];
  const teamIds = teams.map((t: any) => t.id);

  const missingLogoIds = teams.filter((t: any) => !t.logo).map((t: any) => t.id);
  const poolLogoByTeamId = await backfillLogosFromPool(missingLogoIds);

  const playerCounts: Record<string, number> = {};
  if (teamIds.length > 0) {
    const { data: playerRows, error: playersErr } = await supabase
      .from("players")
      .select("sold_to_team_id")
      .in("sold_to_team_id", teamIds);
    if (playersErr) {
      console.error("getSquadBoardsWithPreviewForOrg(players) failed:", playersErr.message);
    }
    (playerRows ?? []).forEach((p: any) => {
      if (!p.sold_to_team_id) return;
      playerCounts[p.sold_to_team_id] = (playerCounts[p.sold_to_team_id] ?? 0) + 1;
    });
  }

  const teamsByBoard = new Map<string, { id: string; logo: string }[]>();
  teams.forEach((t: any) => {
    const list = teamsByBoard.get(t.auction_id) ?? [];
    list.push({ id: t.id, logo: t.logo || poolLogoByTeamId.get(t.id) || "" });
    teamsByBoard.set(t.auction_id, list);
  });

  return boards.map((b) => {
    const boardTeams = teamsByBoard.get(b.id) ?? [];
    const playerCount = boardTeams.reduce((sum, t) => sum + (playerCounts[t.id] ?? 0), 0);
    return {
      ...b,
      teamCount: boardTeams.length,
      playerCount,
      teamLogos: boardTeams.map((t) => t.logo).filter(Boolean).slice(0, 4),
    };
  });
}

export async function createSquadBoard(orgId: string, userId: string, name: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("auctions")
    .insert({
      org_id: orgId,
      name: name.trim(),
      created_by: userId,
      is_synthetic: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createSquadBoard failed:", error?.message);
    return null;
  }
  return data.id;
}

/** Deletes a Squad Board and everything scoped to it. Same shape as
 *  deleteAuction above — Squad Board "teams" are just `teams` rows with
 *  auction_id pointing at a synthetic auction, so they have exactly the
 *  same NOT NULL constraint and can't be unlinked, only deleted.
 *
 *  NOTE: previously this unlinked from a table called "auction_teams",
 *  which does not exist in the schema, and tried to null out
 *  teams.auction_id, which is NOT NULL — both always failed. Fixed to
 *  delete the real rows instead, in FK-safe order. */
export async function deleteSquadBoard(boardId: string): Promise<UpdateOrgResult> {
  // Which teams belong to this board — needed to clean up rows that
  // reference teams.id but aren't cleared automatically (nullable FKs,
  // not ON DELETE CASCADE).
  const { data: teamRows, error: teamLookupErr } = await supabase
    .from("teams")
    .select("id")
    .eq("auction_id", boardId);

  if (teamLookupErr) {
    console.error("deleteSquadBoard(team lookup) failed:", teamLookupErr.message);
    return { ok: false, error: "Couldn't check this board's teams — please try again." };
  }
  const teamIds = (teamRows ?? []).map((t: any) => t.id);

  // Players are auction-scoped (auction_id NOT NULL) — delete before
  // teams, since sold players FK to teams.id via sold_to_team_id.
  const { error: deletePlayersError } = await supabase
    .from("players")
    .delete()
    .eq("auction_id", boardId);

  if (deletePlayersError) {
    console.error("Failed to delete players for squad board:", deletePlayersError.message);
    return { ok: false, error: "Couldn't remove this board's players — please try again." };
  }

  if (teamIds.length > 0) {
    const { error: unlinkBankAssignErr } = await supabase
      .from("player_bank_assignments")
      .delete()
      .in("team_id", teamIds);
    if (unlinkBankAssignErr) {
      console.error("deleteSquadBoard(player_bank_assignments cleanup) failed:", unlinkBankAssignErr.message);
    }

    const { error: unlinkPoolAssignErr } = await supabase
      .from("team_pool_assignments")
      .delete()
      .in("teams_row_id", teamIds);
    if (unlinkPoolAssignErr) {
      console.error("deleteSquadBoard(team_pool_assignments cleanup) failed:", unlinkPoolAssignErr.message);
    }

    const { error: unlinkSelectionsErr } = await supabase
      .from("tournament_team_selections")
      .delete()
      .in("team_id", teamIds);
    if (unlinkSelectionsErr) {
      console.error("deleteSquadBoard(tournament_team_selections cleanup) failed:", unlinkSelectionsErr.message);
    }
  }

  // Teams themselves — auction_id is NOT NULL, so delete rather than unlink.
  const { error: deleteTeamsError } = await supabase
    .from("teams")
    .delete()
    .eq("auction_id", boardId);

  if (deleteTeamsError) {
    console.error("Failed to delete teams for squad board:", deleteTeamsError.message);
    return { ok: false, error: "Couldn't remove this board's teams — please try again." };
  }

  // Now delete the board itself
  const { error: deleteError } = await supabase.from("auctions").delete().eq("id", boardId);
  if (deleteError) {
    console.error("deleteSquadBoard failed:", deleteError.message);
    return { ok: false, error: "Couldn't delete that Squad Board — please try again." };
  }
  return { ok: true };
}

export async function assignPoolTeamToSquadBoard(poolTeam: PoolTeam, board: SquadBoard): Promise<AssignResultWithId> {
  return assignPoolTeamToAuction(poolTeam, {
    id: board.id,
    name: board.name,
    status: "setup",
    tournamentName: null,
    createdAt: board.createdAt,
  });
}

export async function assignBankPlayerToSquadBoardTeam(
  bankPlayer: BankPlayer,
  team: AuctionTeamOption,
  board: SquadBoard,
  isCaptain: boolean
): Promise<AssignResult> {
  return assignBankPlayerToTeam(
    bankPlayer,
    {
      teamId: team.id,
      teamName: team.name,
      teamCode: team.code,
      auctionId: board.id,
      auctionName: board.name,
      tournamentName: null,
    },
    isCaptain
  );
}


export async function getFriendlyMatchesForOrg(orgId: string): Promise<FriendlyMatchSummary[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("id, auction_id, match_setup, created_at, tournament_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getFriendlyMatchesForOrg failed:", error.message);
    return [];
  }

  const matches = data ?? [];
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length === 0) return [];

  const [{ data: brackets, error: bracketsErr }, { data: channelRows }, { data: weatherRows }, bracketFallbackByMatch] =
    await Promise.all([
      supabase
        .from("bracket_matches")
        // `tournament_id` is selected alongside the joined tournament name so
        // callers (e.g. the Tournaments tab) can group matches by tournament
        // id — the name alone isn't a safe grouping key since two
        // tournaments could share one.
        .select("overlay_match_id, tournament_id, tournaments(name)")
        .in("overlay_match_id", matchIds),
      supabase.from("on_air_channels").select("match_id, channels").in("match_id", matchIds),
      supabase.from("weather_readings").select("match_id, coords").in("match_id", matchIds),
      backfillTeamsFromBracket(matchIds),
    ]);

  if (bracketsErr) {
    console.error("getFriendlyMatchesForOrg(brackets) failed:", bracketsErr.message);
  }

  const tournamentByMatch = new Map<string, string>();
  const tournamentIdByMatch = new Map<string, string>();
  (brackets ?? []).forEach((b: any) => {
    if (b.overlay_match_id && b.tournaments?.name) {
      tournamentByMatch.set(b.overlay_match_id, b.tournaments.name);
    }
    if (b.overlay_match_id && b.tournament_id) {
      tournamentIdByMatch.set(b.overlay_match_id, b.tournament_id);
    }
  });

  const overlaySet = new Set<string>();
  (channelRows ?? []).forEach((c: any) => {
    if (Array.isArray(c.channels) && c.channels.length > 0) overlaySet.add(c.match_id);
  });
  (weatherRows ?? []).forEach((w: any) => {
    const coords = (w.coords ?? {}) as { lat?: number; lng?: number };
    if (typeof coords.lat === "number" && typeof coords.lng === "number") overlaySet.add(w.match_id);
  });

  return matches.map((m: any) => {
    const setup = (m.match_setup ?? {}) as Record<string, any>;
    const fallback = bracketFallbackByMatch.get(m.id);
    return {
      id: m.id,
      auctionId: m.auction_id ?? m.id,
      team1Name: setup.team1?.name || fallback?.team1Name || "Team 1",
      team2Name: setup.team2?.name || fallback?.team2Name || "Team 2",
      team1Logo: setup.team1?.logo || fallback?.team1Logo || null,
      team2Logo: setup.team2?.logo || fallback?.team2Logo || null,
      round: setup.round ?? "Friendly",
      createdAt: m.created_at,
      tournamentName: tournamentByMatch.get(m.id) ?? null,
      tournamentId: m.tournament_id ?? tournamentIdByMatch.get(m.id) ?? null,
      overlayConfigured: overlaySet.has(m.id),
      auctionLinked: Array.isArray(setup.squads) && setup.squads.length > 0,
      venue: setup.venue || null,
      date: setup.date || null,
      time: setup.time || null,
    };
  });
}




/** Tournament-linked matches only — the mirror of
 *  getStandaloneMatchesForOrg. A match can be linked to a tournament in
 *  TWO independent ways (matches.tournament_id, set at creation, and
 *  bracket_matches.tournament_id, set when the match is slotted into a
 *  bracket) and nothing in the schema keeps these two FKs in sync — so
 *  this now unions both sources instead of trusting matches.tournament_id
 *  alone. This is the same union getFriendlyMatchesForOrg already does
 *  via tournamentIdByMatch; this function was previously missing it,
 *  which is why a match could show correctly on the public Schedule tab
 *  (driven by bracket_matches.tournament_id) but be invisible in this
 *  tab's collapsible (driven by matches.tournament_id only). */
export async function getTournamentMatchesForOrg(orgId: string): Promise<FriendlyMatchSummary[]> {
  const { data: directMatches, error: directErr } = await supabase
    .from("matches")
    .select("id, auction_id, match_setup, created_at, tournament_id, tournaments(name)")
    .eq("org_id", orgId)
    .not("tournament_id", "is", null)
    .order("created_at", { ascending: false });

  if (directErr) {
    console.error("getTournamentMatchesForOrg(direct) failed:", directErr.message);
    return [];
  }

  const { data: bracketLinks, error: bracketErr } = await supabase
    .from("bracket_matches")
    .select("overlay_match_id, tournament_id, tournaments(name)")
    .not("overlay_match_id", "is", null);

  if (bracketErr) {
    console.error("getTournamentMatchesForOrg(bracket links) failed:", bracketErr.message);
  }

  const directIds = new Set((directMatches ?? []).map((m: any) => m.id));
  const tournamentIdByMatch = new Map<string, string>();
  const tournamentNameByMatch = new Map<string, string>();
  (bracketLinks ?? []).forEach((b: any) => {
    if (!b.overlay_match_id || !b.tournament_id) return;
    tournamentIdByMatch.set(b.overlay_match_id, b.tournament_id);
    if (b.tournaments?.name) tournamentNameByMatch.set(b.overlay_match_id, b.tournaments.name);
  });

  const bracketOnlyIds = [...tournamentIdByMatch.keys()].filter((id) => !directIds.has(id));

  let bracketOnlyMatches: any[] = [];
  if (bracketOnlyIds.length > 0) {
    const { data, error } = await supabase
      .from("matches")
      .select("id, auction_id, match_setup, created_at, tournament_id, tournaments(name)")
      .eq("org_id", orgId)
      .in("id", bracketOnlyIds);

    if (error) {
      console.error("getTournamentMatchesForOrg(bracket-only matches) failed:", error.message);
    } else {
      bracketOnlyMatches = data ?? [];
    }
  }

  const matches = [...(directMatches ?? []), ...bracketOnlyMatches];
  const matchIds = matches.map((m: any) => m.id);
  if (matchIds.length === 0) return [];

  // Team-identity fallback for EVERY match here (not just bracket-only
  // ones) — a bracket slot can be linked before real teams are filled
  // in, leaving match_setup.team1/team2 empty even for a match found via
  // the direct tournament_id path. Same fallback getFriendlyMatchesForOrg
  // already applies, via the same private backfillTeamsFromBracket().
  const [{ data: channelRows }, { data: weatherRows }, bracketTeamFallback] = await Promise.all([
    supabase.from("on_air_channels").select("match_id, channels").in("match_id", matchIds),
    supabase.from("weather_readings").select("match_id, coords").in("match_id", matchIds),
    backfillTeamsFromBracket(matchIds),
  ]);

  const overlaySet = new Set<string>();
  (channelRows ?? []).forEach((c: any) => {
    if (Array.isArray(c.channels) && c.channels.length > 0) overlaySet.add(c.match_id);
  });
  (weatherRows ?? []).forEach((w: any) => {
    const coords = (w.coords ?? {}) as { lat?: number; lng?: number };
    if (typeof coords.lat === "number" && typeof coords.lng === "number") overlaySet.add(w.match_id);
  });

  return matches.map((m: any) => {
    const setup = (m.match_setup ?? {}) as Record<string, any>;
    const fallback = bracketTeamFallback.get(m.id);
    return {
      id: m.id,
      auctionId: m.auction_id ?? m.id,
      team1Name: setup.team1?.name || fallback?.team1Name || "Team 1",
      team2Name: setup.team2?.name || fallback?.team2Name || "Team 2",
      team1Logo: setup.team1?.logo || fallback?.team1Logo || null,
      team2Logo: setup.team2?.logo || fallback?.team2Logo || null,
      round: setup.round ?? "Friendly",
      createdAt: m.created_at,
      tournamentName: m.tournaments?.name ?? tournamentNameByMatch.get(m.id) ?? null,
      tournamentId: m.tournament_id ?? tournamentIdByMatch.get(m.id) ?? null,
      overlayConfigured: overlaySet.has(m.id),
      auctionLinked: (Array.isArray(setup.squads) && setup.squads.length > 0) || !!fallback,
      venue: setup.venue || fallback?.venue || null,
      date: setup.date || fallback?.date || null,
      time: setup.time || fallback?.time || null,
    };
  });
}

export async function removeBankPlayerFromSquadBoardTeam(
  player: TeamRosterPlayer,
  team: AuctionTeamOption,
  board: SquadBoard
): Promise<AssignResult> {
  // player.id is a `players` row id (see getTeamRoster). Verify it still
  // actually belongs to this team/board before deleting — the id comes
  // from client state, which could be stale if it was removed elsewhere
  // in the meantime.
  const { data: playerRow, error: lookupErr } = await supabase
    .from("players")
    .select("id, sold_to_team_id, auction_id")
    .eq("id", player.id)
    .maybeSingle();

  if (lookupErr) {
    console.error("removeBankPlayerFromSquadBoardTeam(lookup) failed:", lookupErr.message);
    return { ok: false, error: "Couldn't verify this player — please try again." };
  }
  if (!playerRow || playerRow.sold_to_team_id !== team.id || playerRow.auction_id !== board.id) {
    return { ok: false, error: "This player is no longer on this team — refresh and try again." };
  }

  // player_bank_assignments first (nullable FK, but leaving it behind
  // would be a stale reference to a deleted players row — same cleanup
  // order as removeAssignedPlayersForBankPlayer above).
  const { error: deleteAssignErr } = await supabase
    .from("player_bank_assignments")
    .delete()
    .eq("players_row_id", player.id);
  if (deleteAssignErr) {
    console.error("removeBankPlayerFromSquadBoardTeam(delete assignment) failed:", deleteAssignErr.message);
  }

  const { error: deleteErr } = await supabase.from("players").delete().eq("id", player.id);
  if (deleteErr) {
    console.error("removeBankPlayerFromSquadBoardTeam(delete player) failed:", deleteErr.message);
    return { ok: false, error: "Couldn't remove this player from the team — please try again." };
  }

  return { ok: true };
}