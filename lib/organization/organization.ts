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

/** Deletes a tournament outright. See original notes on FK/cascade
 *  behavior — this only issues a delete on the `tournaments` row. */
export async function deleteTournament(tournamentId: string): Promise<UpdateOrgResult> {
  const { error } = await supabase.from("tournaments").delete().eq("id", tournamentId);
  if (error) {
    console.error("deleteTournament failed:", error.message);
    if (error.code === "23503") {
      return {
        ok: false,
        error: "This tournament still has auctions, teams, or matches linked to it and can't be deleted yet.",
      };
    }
    return { ok: false, error: "Couldn't delete that tournament — please try again." };
  }
  return { ok: true };
}

/** Bulk delete — same FK caveats as the single-row version apply per id. */
export async function deleteTournaments(tournamentIds: string[]): Promise<{ okIds: string[]; failedIds: string[] }> {
  const okIds: string[] = [];
  const failedIds: string[] = [];
  for (const id of tournamentIds) {
    const result = await deleteTournament(id);
    if (result.ok) okIds.push(id);
    else failedIds.push(id);
  }
  return { okIds, failedIds };
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
 *  marker. */
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
  return (data ?? []).map((a: any) => ({
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

export async function deleteAuction(auctionId: string): Promise<UpdateOrgResult> {
  // First, unlink all teams from this auction by setting auction_id to NULL
  const { error: unlinkTeamsError } = await supabase
    .from("auction_teams")
    .update({ auction_id: null })
    .eq("auction_id", auctionId);

  if (unlinkTeamsError) {
    console.error("Failed to unlink teams from auction:", unlinkTeamsError.message);
    return { ok: false, error: "Couldn't unlink teams from this auction — please try again." };
  }

  // Then, unlink all players from this auction by setting auction_id to NULL
  const { error: unlinkPlayersError } = await supabase
    .from("auction_roster_players")
    .update({ auction_id: null })
    .eq("auction_id", auctionId);

  if (unlinkPlayersError) {
    console.error("Failed to unlink players from auction:", unlinkPlayersError.message);
    return { ok: false, error: "Couldn't unlink players from this auction — please try again." };
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
/* ───────────────────────────────────────────────────────��────────── */

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

    squads = (playerRows ?? []).map((p) => ({
      name: p.name,
      role: p.role,
      team: p.sold_to_team_id === input.team1Id ? team1.short : team2.short,
      captain: !!p.owner_team_code,
      imageUrl: p.img || undefined,
    }));

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

  const [{ data: channelRows }, { data: weatherRows }] = await Promise.all([
    supabase.from("on_air_channels").select("match_id, channels").in("match_id", matchIds),
    supabase.from("weather_readings").select("match_id, coords").in("match_id", matchIds),
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
    return {
      id: m.id,
      auctionId: m.id,
      team1Name: setup.team1?.name ?? "Team 1",
      team2Name: setup.team2?.name ?? "Team 2",
      team1Logo: setup.team1?.logo || null,
      team2Logo: setup.team2?.logo || null,
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
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, createdAt: r.created_at }));
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

export async function deleteSquadBoard(boardId: string): Promise<UpdateOrgResult> {
  // First, unlink all teams from this board by setting auction_id to NULL
  const { error: unlinkTeamsError } = await supabase
    .from("auction_teams")
    .update({ auction_id: null })
    .eq("auction_id", boardId);

  if (unlinkTeamsError) {
    console.error("Failed to unlink teams from squad board:", unlinkTeamsError.message);
    return { ok: false, error: "Couldn't unlink teams from this board — please try again." };
  }

  // Then, unlink all players from this board by setting auction_id to NULL
  const { error: unlinkPlayersError } = await supabase
    .from("auction_roster_players")
    .update({ auction_id: null })
    .eq("auction_id", boardId);

  if (unlinkPlayersError) {
    console.error("Failed to unlink players from squad board:", unlinkPlayersError.message);
    return { ok: false, error: "Couldn't unlink players from this board — please try again." };
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

  const [{ data: brackets, error: bracketsErr }, { data: channelRows }, { data: weatherRows }] = await Promise.all([
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
    return {
      id: m.id,
      auctionId: m.auction_id ?? m.id,
      team1Name: setup.team1?.name ?? "Team 1",
      team2Name: setup.team2?.name ?? "Team 2",
      team1Logo: setup.team1?.logo || null,
      team2Logo: setup.team2?.logo || null,
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
 *  getStandaloneMatchesForOrg. Filtered directly via
 *  `tournament_id is not null`, and resolves tournamentName straight off
 *  the `tournaments` table (not just the bracket_matches join), so a
 *  match shows the right tournament name even before it's been dropped
 *  into an actual bracket slot. */
export async function getTournamentMatchesForOrg(orgId: string): Promise<FriendlyMatchSummary[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("id, auction_id, match_setup, created_at, tournament_id, tournaments(name)")
    .eq("org_id", orgId)
    .not("tournament_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getTournamentMatchesForOrg failed:", error.message);
    return [];
  }

  const matches = data ?? [];
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length === 0) return [];

  const [{ data: channelRows }, { data: weatherRows }] = await Promise.all([
    supabase.from("on_air_channels").select("match_id, channels").in("match_id", matchIds),
    supabase.from("weather_readings").select("match_id, coords").in("match_id", matchIds),
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
    return {
      id: m.id,
      auctionId: m.auction_id ?? m.id,
      team1Name: setup.team1?.name ?? "Team 1",
      team2Name: setup.team2?.name ?? "Team 2",
      team1Logo: setup.team1?.logo || null,
      team2Logo: setup.team2?.logo || null,
      round: setup.round ?? "Friendly",
      createdAt: m.created_at,
      tournamentName: m.tournaments?.name ?? null,
      tournamentId: m.tournament_id ?? null,
      overlayConfigured: overlaySet.has(m.id),
      auctionLinked: Array.isArray(setup.squads) && setup.squads.length > 0,
      venue: setup.venue || null,
      date: setup.date || null,
      time: setup.time || null,
    };
  });
}
