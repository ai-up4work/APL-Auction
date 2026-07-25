// app/lib/organization/organization.ts
import { supabase } from "@/lib/supabase";

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

/** Deletes a tournament outright. Unlike a friendly match, a tournament
 *  typically has real dependents — auctions, teams, bracket matches,
 *  players sold into those teams, etc. This only issues a delete on the
 *  `tournaments` row itself; whether those dependents disappear with it
 *  depends entirely on your schema's FK constraints:
 *  - If the relevant FKs (auctions.tournament_id, bracket_matches.*,
 *    teams.auction_id, etc.) are set to ON DELETE CASCADE, this cleans
 *    up everything automatically.
 *  - If they're NOT NULL / RESTRICT instead, this call will fail with a
 *    foreign-key-violation error (surfaced below as a friendly message)
 *    rather than silently leaving orphaned or broken data.
 *  Confirm which behavior your schema has before relying on this in
 *  production — if it's RESTRICT, you'll want an explicit cascading
 *  delete here instead (auctions -> teams -> players -> bracket_matches
 *  -> tournament, in that order) before this will succeed. */
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

/* ────────────────────────────────────────────────────────────────── */
/*  AUCTIONS (lookup only — auction creation/editing lives elsewhere)  */
/*                                                                      */
/*  Used by the Matches tab's "team source: from an auction" flow, so   */
/*  a friendly/standalone match can pull its two teams (and their sold  */
/*  players) from an auction that's already been run for this org,      */
/*  instead of typing team names in by hand.                            */
/* ────────────────────────────────────────────────────────────────── */

export interface AuctionOption {
  id: string;
  name: string;
}

export async function getAuctionsForOrg(orgId: string): Promise<AuctionOption[]> {
  const { data, error } = await supabase
    .from("auctions")
    .select("id, name")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAuctionsForOrg failed:", error.message);
    return [];
  }
  return data ?? [];
}

export interface AuctionTeamOption {
  id: string;
  name: string;
  code: string;
}

/** Teams that belong to one specific auction — populates the "Team 1" /
 *  "Team 2" pickers once the org has chosen which auction to pull from.
 *  An auction can have many teams, so picking the auction alone isn't
 *  enough to know which two are playing this match. */
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
/*                                                                      */
/*  Reuses the exact same `matches` table and match_setup shape the     */
/*  standalone match editor/simulator already read/write — "friendly    */
/*  match" here is just a label, not a different data model.            */
/*                                                                      */
/*  A match has no direct FK to tournaments (see schema notes elsewhere */
/*  in this codebase) — the only path from a match to a tournament is   */
/*  bracket_matches.overlay_match_id -> matches.id, bracket_matches.     */
/*  tournament_id -> tournaments.id. So "is this match part of a        */
/*  tournament" is a lookup against bracket_matches, not a column on    */
/*  matches itself.                                                     */
/* ────────────────────────────────────────────────────────────────── */

export interface FriendlyMatchSummary {
  id: string;
  team1Name: string;
  team2Name: string;
  round: string;
  createdAt: string;
  /** Non-null only if a bracket_matches row's overlay_match_id points at
   *  this match — i.e. it's connected to a tournament bracket slot. Set
   *  from /tournaments/[id]/edit, not from this file. */
  tournamentName: string | null;
  /** True if there's an on_air_channels row with at least one channel,
   *  or a weather_readings row with coords set, for this match. */
  overlayConfigured: boolean;
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
    // Non-fatal — matches just show as "Standalone" until this resolves.
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
    };
  });
}

export type CreateFriendlyMatchInput =
  | { teamSource: "manual"; team1Name: string; team2Name: string; round?: string }
  | { teamSource: "auction"; auctionId: string; team1Id: string; team2Id: string; round?: string };

/** Creates a minimal matches row with just enough match_setup to satisfy
 *  parseMatchSetup downstream (see simulate/page.tsx), then hands the
 *  new match's id back so the caller can route straight into the
 *  existing /match/[id]/edit flow to fill in venue, squads, etc.
 *
 *  matches.auction_id is a plain NOT NULL UNIQUE text column (no FK) —
 *  it's set to the match's own id here as a placeholder, matching the
 *  same self-referential trick edit/page.tsx's resolveAuctionId() uses
 *  once squads actually need a real `auctions` row to sync into.
 *
 *  teamSource: "auction" pulls the two chosen teams' name/code straight
 *  from `teams`, plus every player already sold to either team, and
 *  pre-fills match_setup.squads with them — the org doesn't retype a
 *  roster that already exists from running the auction. */
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
      // Non-fatal — the match still gets created with an empty squad
      // list; the org can add players manually on the edit page.
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

/** Deletes a friendly match outright. Friendly matches live in the same
 *  `matches` table as tournament matches, but (unlike a tournament) a
 *  friendly match has no bracket/auction rows depending on it, so this
 *  is a plain single-row delete rather than a cascading cleanup.
 *  `on_air_channels` / `weather_readings` rows for this match_id are
 *  left behind as orphans unless your schema has ON DELETE CASCADE set
 *  on their match_id FK — add that constraint (or delete them here
 *  explicitly) if you want overlay config cleaned up automatically.
 *
 *  Callers should check `tournamentName` on the summary first and block
 *  the delete in the UI if it's set — a bracket-linked match should be
 *  disconnected from its bracket slot before being deleted here. */
export async function deleteFriendlyMatch(matchId: string): Promise<boolean> {
  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) {
    console.error("deleteFriendlyMatch failed:", error.message);
    return false;
  }
  return true;
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

/** Every team across every auction in this org — this is the picker list
 *  for "assign this bank player to a team". Relies on PostgREST's FK
 *  embedding (teams.auction_id -> auctions.id, auctions.tournament_id ->
 *  tournaments.id); adjust the embed alias if your supabase-js/PostgREST
 *  relationship names differ from the raw FK constraint names. */
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

/** Copies a bank player onto a team's real roster — inserts a new
 *  `players` row (auction_id + sold_to_team_id set, is_manual_entry:
 *  true so it's excluded from any live-auction draw pool), and logs the
 *  assignment for history. The bank row itself is untouched, so the
 *  same player can be assigned again elsewhere later. */
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
    // Only one captain per team — clear any existing one first.
    await supabase.from("players").update({ owner_team_code: null }).eq("sold_to_team_id", team.teamId).neq("id", inserted.id);
  }

  const { error: logErr } = await supabase.from("player_bank_assignments").insert({
    bank_player_id: bankPlayer.id,
    players_row_id: inserted.id,
    team_id: team.teamId,
  });
  if (logErr) {
    // Non-fatal — the player is already on the team roster; only the
    // history log failed to write.
    console.error("assignBankPlayerToTeam(log) failed:", logErr.message);
  }

  return { ok: true };
}

/* ────────────────────────────────────────────────────────────────── */
/*  OVERLAYS                                                           */
/*                                                                      */
/*  Wraps the existing on_air_channels / weather_readings tables, both  */
/*  1:1 on match_id already — this just gives them an editable surface. */
/*  getMatchesForOverlayPicker is kept for now in case anything else    */
/*  still calls it, but the Matches tab no longer needs it: it opens    */
/*  the overlay editor directly with a matchId it already has, instead  */
/*  of asking the org to re-pick a match from a second dropdown.        */
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
  // `data` is NOT NULL on weather_readings — since this editor only ever
  // manages coords (the live weather reading itself is presumably
  // populated by a separate fetch job), write an empty object as a
  // placeholder if there's no existing row rather than leaving `data`
  // unset and violating the NOT NULL constraint.
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