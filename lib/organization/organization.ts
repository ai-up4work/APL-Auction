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
}

export async function getTournamentsForOrg(orgId: string): Promise<TournamentSummary[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, format, status, category, created_at")
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

export async function getAuctionsForOrg(orgId: string): Promise<AuctionSummary[]> {
  const { data, error } = await supabase
    .from("auctions")
    .select("id, name, status, created_at, tournaments(name)")
    .eq("org_id", orgId)
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
}

export async function getTeamsForAuction(auctionId: string): Promise<AuctionTeamOption[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, code")
    .eq("auction_id", auctionId)
    .order("name", { ascending: true });

  if (error) {
    console.error("getTeamsForAuction failed:", error.message);
    return [];
  }
  return data ?? [];
}

/* ────────────────────────────────────────────────────────────────── */
/*  FRIENDLY MATCHES                                                   */
/* ────────────────────────────────────────────────────────────────── */

export interface FriendlyMatchSummary {
  id: string;
  team1Name: string;
  team2Name: string;
  round: string;
  createdAt: string;
  tournamentName: string | null;
  overlayConfigured: boolean;
  /** True if this match's teams were pulled from an auction (i.e. it has
   *  a non-empty squads array in match_setup) rather than typed manually.
   *  Used purely for the "linked to auction" status badge — there is no
   *  separate FK for this, so it's inferred from the presence of squads. */
  auctionLinked: boolean;
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
      round: setup.round ?? "Friendly",
      createdAt: m.created_at,
      tournamentName: tournamentByMatch.get(m.id) ?? null,
      overlayConfigured: overlaySet.has(m.id),
      auctionLinked: Array.isArray(setup.squads) && setup.squads.length > 0,
    };
  });
}

export type CreateFriendlyMatchInput =
  | { teamSource: "manual"; team1Name: string; team2Name: string; round?: string }
  | { teamSource: "auction"; auctionId: string; team1Id: string; team2Id: string; round?: string };

export async function createFriendlyMatch(
  orgId: string,
  input: CreateFriendlyMatchInput
): Promise<string | null> {
  const newId = crypto.randomUUID();

  let team1: { name: string; short: string };
  let team2: { name: string; short: string };
  let squads: { name: string; role: string; team: string }[] = [];

  if (input.teamSource === "manual") {
    team1 = { name: input.team1Name.trim(), short: shortCode(input.team1Name) };
    team2 = { name: input.team2Name.trim(), short: shortCode(input.team2Name) };
  } else {
    const { data: teamRows, error: teamErr } = await supabase
      .from("teams")
      .select("id, name, code")
      .in("id", [input.team1Id, input.team2Id]);

    if (teamErr || !teamRows || teamRows.length !== 2) {
      console.error("createFriendlyMatch(auction teams) failed:", teamErr?.message);
      return null;
    }
    const t1 = teamRows.find((t) => t.id === input.team1Id)!;
    const t2 = teamRows.find((t) => t.id === input.team2Id)!;
    team1 = { name: t1.name, short: t1.code };
    team2 = { name: t2.name, short: t2.code };

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

export async function deleteFriendlyMatch(matchId: string): Promise<boolean> {
  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) {
    console.error("deleteFriendlyMatch failed:", error.message);
    return false;
  }
  return true;
}

/** Bulk delete for the Matches tab's multi-select. Callers should filter
 *  out tournament-linked matches before calling this (same rule as the
 *  single-match delete: disconnect from the bracket first). Returns which
 *  ids succeeded so the UI can drop only those from local state and report
 *  the rest as failures. */
export async function deleteFriendlyMatches(matchIds: string[]): Promise<{ okIds: string[]; failedIds: string[] }> {
  if (matchIds.length === 0) return { okIds: [], failedIds: [] };
  const { error } = await supabase.from("matches").delete().in("id", matchIds);
  if (error) {
    console.error("deleteFriendlyMatches failed:", error.message);
    return { okIds: [], failedIds: matchIds };
  }
  return { okIds: matchIds, failedIds: [] };
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

export async function getAssignableTeamsForOrg(orgId: string): Promise<AssignableTeam[]> {
  const { data, error } = await supabase
    .from("teams")
    .select(
      "id, name, code, auction_id, auctions!inner(id, name, org_id, tournament_id, tournaments(name))"
    )
    .eq("auctions.org_id", orgId)
    .order("name", { ascending: true });

  if (error) {
    console.error("getAssignableTeamsForOrg failed:", error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    teamId: row.id,
    teamName: row.name,
    teamCode: row.code,
    auctionId: row.auction_id,
    auctionName: row.auctions?.name ?? "Auction",
    tournamentName: row.auctions?.tournaments?.name ?? null,
  }));
}

export interface AssignResult {
  ok: boolean;
  error?: string;
}

export async function assignBankPlayerToTeam(
  bankPlayer: BankPlayer,
  team: AssignableTeam,
  isCaptain: boolean
): Promise<AssignResult> {
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