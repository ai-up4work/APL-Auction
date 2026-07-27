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
}

export async function getTournamentsForOrg(orgId: string): Promise<TournamentSummary[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, format, status, category, created_at, image_url, logo_url")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getTournamentsForOrg failed:", error.message);
    return [];
  }
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    format: t.format,
    status: t.status,
    category: t.category,
    createdAt: t.created_at,
    imageUrl: t.image_url,
    logoUrl: t.logo_url,
  }));
}

export interface CreateTournamentInput {
  name: string;
  format: "single_elimination" | "double_elimination" | "round_robin";
  category?: "Auction" | "Bracket" | "Overlay" | "League";
}

/** Creates a bare tournament row — the resulting id is where the caller
 *  should route the user next (/tournaments/[id]/edit) to fill in the rest. */
export async function createTournament(
  orgId: string,
  userId: string,
  input: CreateTournamentInput
): Promise<string | null> {
  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      org_id: orgId,
      name: input.name,
      format: input.format,
      category: input.category ?? null,
      created_by: userId,
      status: "setup",
    })
    .select("id")
    .single();

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
  const { error } = await supabase.from("auctions").delete().eq("id", auctionId);
  if (error) {
    console.error("deleteAuction failed:", error.message);
    if (error.code === "23503") {
      return { ok: false, error: "This auction still has teams or players linked to it and can't be deleted yet." };
    }
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
  return (data ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    logo: t.logo ?? "",
  }));
}

/* ────────────────────────────────────────────────────────────────── */
/*  FRIENDLY MATCHES                                                   */
/* ────────────────────────────────────────────────────────────────── */

export interface FriendlyMatchSummary {
  id: string;
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

export async function getFriendlyMatchesForOrg(orgId: string): Promise<FriendlyMatchSummary[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("id, match_setup, created_at")
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
      .select("overlay_match_id, tournaments(name)")
      .in("overlay_match_id", matchIds),
    supabase.from("on_air_channels").select("match_id, channels").in("match_id", matchIds),
    supabase.from("weather_readings").select("match_id, coords").in("match_id", matchIds),
  ]);

  if (bracketsErr) {
    console.error("getFriendlyMatchesForOrg(brackets) failed:", bracketsErr.message);
  }

  const tournamentByMatch = new Map<string, string>();
  (brackets ?? []).forEach((b: any) => {
    if (b.overlay_match_id && b.tournaments?.name) {
      tournamentByMatch.set(b.overlay_match_id, b.tournaments.name);
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

  return matches.map((m) => {
    const setup = (m.match_setup ?? {}) as Record<string, any>;
    return {
      id: m.id,
      team1Name: setup.team1?.name ?? "Team 1",
      team2Name: setup.team2?.name ?? "Team 2",
      team1Logo: setup.team1?.logo || null,
      team2Logo: setup.team2?.logo || null,
      round: setup.round ?? "Friendly",
      createdAt: m.created_at,
      tournamentName: tournamentByMatch.get(m.id) ?? null,
      overlayConfigured: overlaySet.has(m.id),
      auctionLinked: Array.isArray(setup.squads) && setup.squads.length > 0,
      venue: setup.venue || null,
      date: setup.date || null,
      time: setup.time || null,
    };
  });
}

export type CreateFriendlyMatchInput =
  | { teamSource: "manual"; team1Name: string; team2Name: string; team1Logo?: string; team2Logo?: string; round?: string }
  | { teamSource: "auction"; auctionId: string; team1Id: string; team2Id: string; round?: string };

export async function createFriendlyMatch(
  orgId: string,
  input: CreateFriendlyMatchInput
): Promise<string | null> {
  const newId = crypto.randomUUID();

  let team1: { name: string; short: string; logo: string };
  let team2: { name: string; short: string; logo: string };
  let squads: { name: string; role: string; team: string }[] = [];

  if (input.teamSource === "manual") {
    team1 = { name: input.team1Name.trim(), short: shortCode(input.team1Name), logo: input.team1Logo?.trim() || "" };
    team2 = { name: input.team2Name.trim(), short: shortCode(input.team2Name), logo: input.team2Logo?.trim() || "" };
  } else {
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
      .select("name, role, sold_to_team_id")
      .in("sold_to_team_id", [input.team1Id, input.team2Id]);

    if (playersErr) {
      console.error("createFriendlyMatch(auction players) failed:", playersErr.message);
    }

    squads = (playerRows ?? []).map((p) => ({
      name: p.name,
      role: p.role,
      team: p.sold_to_team_id === input.team1Id ? team1.short : team2.short,
    }));
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
  };

  const { data, error } = await supabase
    .from("matches")
    .insert({
      id: newId,
      auction_id: newId,
      org_id: orgId,
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
/*                                                                       */
/*  Keeps the dashboard's Matches/Tournaments tabs in sync with changes  */
/*  made elsewhere (another tab, an admin panel, a teammate's session)   */
/*  without a manual refresh. Each subscribe function returns the raw    */
/*  Supabase channel — callers are responsible for calling               */
/*  supabase.removeChannel(channel) on unmount.                          */
/*                                                                       */
/*  NOTE: bracket_matches / on_air_channels / weather_readings have no   */
/*  org_id column, so these subscriptions can't be filtered server-side  */
/*  by org today — every org's dashboard will refetch on any org's       */
/*  change to those tables. Fine at small scale; worth adding an org_id  */
/*  column (denormalized via the parent match/tournament) if this ever  */
/*  shows up as real traffic.                                            */
/* ────────────────────────────────────────────────────────────────── */

/** Fires `onChange` any time a matches row for this org is inserted,
 *  updated, or deleted. The payload isn't shaped into a FriendlyMatchSummary
 *  here (that requires the bracket/overlay joins), so callers should treat
 *  this purely as a "something changed, go refetch" signal. */
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
      { event: "*", schema: "public", table: "bracket_matches" },
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

/** Fires `onChange` any time a tournaments row for this org changes. */
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
    .select("id, name, role, origin, country, img, capped, notes")
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

export async function updateBankPlayer(playerId: string, patch: Partial<BankPlayerInput>): Promise<boolean> {
  const { error } = await supabase.from("player_bank").update(patch).eq("id", playerId);
  if (error) {
    console.error("updateBankPlayer failed:", error.message);
    return false;
  }
  return true;
}

export async function deleteBankPlayer(playerId: string): Promise<boolean> {
  const { error } = await supabase.from("player_bank").delete().eq("id", playerId);
  if (error) {
    console.error("deleteBankPlayer failed:", error.message);
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

/** Teams a bank player can be assigned onto.
 *
 *  This intentionally does NOT list every `teams` row sitting under one of
 *  the org's auctions — that would include teams typed directly into an
 *  auction admin panel, which have nothing to do with the org's Team Pool.
 *  Instead it walks `team_pool_assignments`, so only teams that started
 *  life as a Team Pool entry (and were then assigned into a real auction
 *  via the Team Pool tab's "Assign" flow) show up here. The name/code shown
 *  is the pool team's own name/code, not whatever the copied `teams` row
 *  happens to currently say — this is what a person picking "which pool
 *  team" expects to see, even if the real team row was later renamed. */
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
}

/** Roster (i.e. current player list) for a single real team row, for
 *  display inside the Auctions tab / Squad Board team card. `isCaptain` is
 *  inferred the same way assignBankPlayerToTeam sets it: a non-null
 *  owner_team_code on the player row. */
export async function getTeamRoster(teamId: string): Promise<TeamRosterPlayer[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, role, owner_team_code")
    .eq("sold_to_team_id", teamId)
    .order("name", { ascending: true });

  if (error) {
    console.error("getTeamRoster failed:", error.message);
    return [];
  }
  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    isCaptain: !!p.owner_team_code,
  }));
}

/** Bank player ids already assigned to ANY team on this board — used to
 *  both (a) filter the dropdown so a person can't even pick an
 *  already-used player, and (b) as data for the backend guard below. */
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

/** Pool team ids already assigned to this board — same idea, for the
 *  "Assign a Team Pool Team" dropdown. */
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
  // Guard: is this bank player already assigned to ANY team within this
  // same auction/Squad Board? Different auctions/boards are always fine.
  //
  // NOTE: this checks `team_id` on player_bank_assignments directly against
  // every team_id that belongs to this board — not an embedded join through
  // `players`. The embedded-join version depended on Supabase auto-detecting
  // a FK relationship between player_bank_assignments and players, which is
  // fragile; querying team_id (a column we already write on every insert
  // below) is a flat, reliable check with no relationship guessing.
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
/*                                                                       */
/*  Org-scoped, reusable team templates — the team equivalent of the    */
/*  Player Bank above. A pool entry is not itself a playable team; it's */
/*  "assigned" into a specific auction, which copies it into a real     */
/*  `teams` row (mirrors how a bank player is copied into `players`).   */
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

/** Auctions in the org that a pool team can be dropped into. Reuses
 *  getAuctionsForOrg's shape (which already excludes synthetic Squad Board
 *  rows); "completed" auctions are excluded since adding a team there
 *  wouldn't do anything useful. */
export async function getAssignableAuctionsForOrg(orgId: string): Promise<AuctionSummary[]> {
  const auctions = await getAuctionsForOrg(orgId);
  return auctions.filter((a) => a.status !== "completed");
}

export async function assignPoolTeamToAuction(poolTeam: PoolTeam, auction: AuctionSummary): Promise<AssignResult> {
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

  return { ok: true };
}

/* ────────────────────────────────────────────────────────────────── */
/*  OVERLAYS                                                           */
/* ────────────────────────────────────────────────────────────────── */

export interface OverlayMatchOption {
  matchId: string;
  label: string;
}

export async function getMatchesForOverlayPicker(orgId: string): Promise<OverlayMatchOption[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("id, match_setup")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getMatchesForOverlayPicker failed:", error.message);
    return [];
  }

  return (data ?? []).map((m) => {
    const setup = (m.match_setup ?? {}) as Record<string, any>;
    return {
      matchId: m.id,
      label: `${setup.team1?.name ?? "Team 1"} vs ${setup.team2?.name ?? "Team 2"}`,
    };
  });
}

export interface OverlayConfig {
  channels: { label: string; url: string }[];
  weatherLat: number | null;
  weatherLng: number | null;
}

export async function getOverlayConfig(matchId: string): Promise<OverlayConfig> {
  const [{ data: channelsRow }, { data: weatherRow }] = await Promise.all([
    supabase.from("on_air_channels").select("channels").eq("match_id", matchId).maybeSingle(),
    supabase.from("weather_readings").select("coords").eq("match_id", matchId).maybeSingle(),
  ]);

  const channels = Array.isArray(channelsRow?.channels) ? channelsRow!.channels : [];
  const coords = (weatherRow?.coords ?? {}) as { lat?: number; lng?: number };

  return {
    channels,
    weatherLat: typeof coords.lat === "number" ? coords.lat : null,
    weatherLng: typeof coords.lng === "number" ? coords.lng : null,
  };
}

export async function saveOverlayChannels(
  matchId: string,
  channels: { label: string; url: string }[]
): Promise<boolean> {
  const { error } = await supabase
    .from("on_air_channels")
    .upsert({ match_id: matchId, channels, updated_at: new Date().toISOString() }, { onConflict: "match_id" });
  if (error) {
    console.error("saveOverlayChannels failed:", error.message);
    return false;
  }
  return true;
}

export async function saveOverlayWeatherCoords(matchId: string, lat: number, lng: number): Promise<boolean> {
  const { data: existing } = await supabase.from("weather_readings").select("data").eq("match_id", matchId).maybeSingle();

  const { error } = await supabase
    .from("weather_readings")
    .upsert(
      {
        match_id: matchId,
        coords: { lat, lng },
        data: existing?.data ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "match_id" }
    );
  if (error) {
    console.error("saveOverlayWeatherCoords failed:", error.message);
    return false;
  }
  return true;
}

/* ────────────────────────────────────────────────────────────────── */
/*  SQUAD BOARDS  (formerly "Rosters")                                  */
/*                                                                       */
/*  A Squad Board is a named container for many-to-many player/team      */
/*  assignments — the same Team Pool team can sit on several Squad         */
/*  Boards, and the same Player Bank player can be assigned onto teams      */
/*  on DIFFERENT Squad Boards (see the duplicate guard inside               */
/*  assignBankPlayerToTeam above, which blocks it only WITHIN the same      */
/*  board/auction). There's no dedicated schema for this: a Squad Board     */
/*  IS an `auctions` row with `is_synthetic = true` — a synthetic auction   */
/*  that's never shown as a real auction (see the `is_synthetic` filter     */
/*  in getAuctionsForOrg above). This lets a Squad Board reuse the exact    */
/*  same `teams` / `players` tables and the exact same                     */
/*  assignBankPlayerToTeam / assignPoolTeamToAuction insert logic as a      */
/*  real auction, with zero schema changes.                                */
/*                                                                          */
/*  IMPORTANT: `auctions.status` has a DB CHECK constraint that only        */
/*  allows 'setup' | 'live' | 'paused' | 'completed'. Squad Board rows      */
/*  must leave `status` at a normal value (default 'setup') and rely        */
/*  solely on `is_synthetic` to distinguish themselves from real auctions.  */
/*                                                                          */
/*  ALSO IMPORTANT: `auctions.created_by` has a FOREIGN KEY to              */
/*  `auth.users(id)`. Every create call below must be given the actual      */
/*  signed-in user's id — passing an org id (or any other non-user id)      */
/*  here will throw a 23503 foreign-key violation                           */
/*  ("auctions_created_by_fkey").                                           */
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

/** Creates a new Squad Board. `userId` MUST be a real `auth.users.id` (the
 *  signed-in user), not the org id — `created_by` has a foreign key to
 *  `auth.users`, so anything else throws a 23503. */
export async function createSquadBoard(orgId: string, userId: string, name: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("auctions")
    .insert({
      org_id: orgId,
      name: name.trim(),
      created_by: userId,
      is_synthetic: true,
      // status intentionally omitted — defaults to 'setup', a value the
      // CHECK constraint actually allows.
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createSquadBoard failed:", error?.message);
    return null;
  }
  return data.id;
}

/** Same FK caveat as deleteAuction — fails if teams/players are still
 *  attached, which for a Squad Board means "it still has teams or players
 *  on it," so the message is phrased for that case instead. */
export async function deleteSquadBoard(boardId: string): Promise<UpdateOrgResult> {
  const { error } = await supabase.from("auctions").delete().eq("id", boardId);
  if (error) {
    console.error("deleteSquadBoard failed:", error.message);
    if (error.code === "23503") {
      return { ok: false, error: "This Squad Board still has teams or players on it and can't be deleted yet." };
    }
    return { ok: false, error: "Couldn't delete that Squad Board — please try again." };
  }
  return { ok: true };
}

/** Thin wrapper around assignPoolTeamToAuction so callers in the Squad
 *  Board UI don't need to hand-build an AuctionSummary — a SquadBoard and
 *  an AuctionSummary share the one field (`id`) that insert actually uses.
 *  `status: "setup"` here is just a display placeholder to satisfy the
 *  AuctionSummary shape — assignPoolTeamToAuction never reads it, only
 *  `.id`. */
export async function assignPoolTeamToSquadBoard(poolTeam: PoolTeam, board: SquadBoard): Promise<AssignResult> {
  return assignPoolTeamToAuction(poolTeam, {
    id: board.id,
    name: board.name,
    status: "setup",
    tournamentName: null,
    createdAt: board.createdAt,
  });
}

/** Thin wrapper around assignBankPlayerToTeam for a team that lives on a
 *  specific Squad Board — `team` here is one of the AuctionTeamOption rows
 *  returned by getTeamsForAuction(board.id), which doesn't carry
 *  auctionId/auctionName/tournamentName, so this fills those in from the
 *  board itself before delegating to the same insert logic used
 *  everywhere else (including the same-board duplicate-player guard). */
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