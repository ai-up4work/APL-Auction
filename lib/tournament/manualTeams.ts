// app/lib/tournament/manualTeams.ts
import { supabase } from "@/lib/supabase";

export interface ManualTeamInput {
  code: string;
  name: string;
  color?: string;
  logo?: string;
}

export interface ManualPlayerInput {
  name: string;
  role: "Batter" | "Bowler" | "All-rounder" | "WK-Batter" | "Batsman" | "Wicket Keeper";
  isCaptain?: boolean;
}

export interface ManualPlayer {
  id: string;
  name: string;
  role: string;
  isCaptain: boolean;
}

export interface ManualTeam {
  id: string;
  code: string;
  name: string;
  color: string;
  logo: string;
  auctionId: string;
  players: ManualPlayer[];
}

/**
 * Every team row requires a real auction_id (NOT NULL FK) — there's no way
 * around that in the schema. For tournaments that never run a live
 * bidding auction, we transparently create a lightweight "container"
 * auction the first time a team is added manually: tournament_opt_out
 * marks it as never having run real bidding, status is 'completed' since
 * there's nothing left to run. Nothing else in the app needs to know the
 * difference — getSquadsForTournament / generateBracketForTournament
 * already just look up "the auction linked to this tournament" and don't
 * care how its teams got there.
 */
async function getOrCreateManualAuction(
  tournamentId: string,
  orgId: string,
  tournamentName: string
): Promise<string | null> {
  const { data: existing, error: findErr } = await supabase
    .from("auctions")
    .select("id")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr) {
    console.error("getOrCreateManualAuction(find) failed:", findErr.message);
    return null;
  }
  if (existing) return existing.id;

  const { data: created, error: createErr } = await supabase
    .from("auctions")
    .insert({
      name: `${tournamentName} — Teams`,
      status: "completed",
      org_id: orgId,
      tournament_id: tournamentId,
      tournament_opt_out: true,
    })
    .select("id")
    .single();

  if (createErr || !created) {
    console.error("getOrCreateManualAuction(create) failed:", createErr?.message);
    return null;
  }
  return created.id;
}

/**
 * Fetches every team for a tournament (via its linked auction, manual or
 * real), each with its player roster. Returns [] if no auction/teams
 * exist yet — same "empty until generated" pattern as bracket data.
 */
export async function getTeamsWithPlayers(tournamentId: string): Promise<ManualTeam[]> {
  const { data: auction, error: auctionErr } = await supabase
    .from("auctions")
    .select("id")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (auctionErr) {
    console.error("getTeamsWithPlayers(auction) failed:", auctionErr.message);
    return [];
  }
  if (!auction) return [];

  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, code, name, color, logo")
    .eq("auction_id", auction.id)
    .order("created_at", { ascending: true });

  if (teamsErr) {
    console.error("getTeamsWithPlayers(teams) failed:", teamsErr.message);
    return [];
  }
  if (!teams || teams.length === 0) return [];

  const teamIds = teams.map((t) => t.id);
  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select("id, name, role, sold_to_team_id, owner_team_code")
    .in("sold_to_team_id", teamIds);

  if (playersErr) {
    console.error("getTeamsWithPlayers(players) failed:", playersErr.message);
  }

  return teams.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    color: t.color,
    logo: t.logo || "",
    auctionId: auction.id,
    players: (players ?? [])
      .filter((p) => p.sold_to_team_id === t.id)
      .map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        isCaptain: p.owner_team_code === t.code,
      })),
  }));
}

/** Creates the manual auction container if needed, then inserts a team. */
export async function addManualTeam(
  tournamentId: string,
  orgId: string,
  tournamentName: string,
  input: ManualTeamInput
): Promise<ManualTeam | null> {
  const auctionId = await getOrCreateManualAuction(tournamentId, orgId, tournamentName);
  if (!auctionId) return null;

  const { data, error } = await supabase
    .from("teams")
    .insert({
      auction_id: auctionId,
      code: input.code,
      name: input.name,
      color: input.color || "#3B8BD4",
      logo: input.logo || "",
      owner: "Manual Entry",
    })
    .select("id, code, name, color, logo")
    .single();

  if (error || !data) {
    console.error("addManualTeam failed:", error?.message);
    return null;
  }

  return { ...data, logo: data.logo || "", auctionId, players: [] };
}

export async function updateManualTeam(
  teamId: string,
  patch: Partial<ManualTeamInput>
): Promise<boolean> {
  const { error } = await supabase.from("teams").update(patch).eq("id", teamId);
  if (error) {
    console.error("updateManualTeam failed:", error.message);
    return false;
  }
  return true;
}

/** Deletes a team's players first (no ON DELETE CASCADE on that FK), then the team. */
export async function deleteManualTeam(teamId: string): Promise<boolean> {
  const { error: playersErr } = await supabase.from("players").delete().eq("sold_to_team_id", teamId);
  if (playersErr) {
    console.error("deleteManualTeam(players) failed:", playersErr.message);
    return false;
  }
  const { error: teamErr } = await supabase.from("teams").delete().eq("id", teamId);
  if (teamErr) {
    console.error("deleteManualTeam(team) failed:", teamErr.message);
    return false;
  }
  return true;
}

/**
 * Adds a player directly onto a team's roster, bypassing bidding entirely
 * — sold_to_team_id is set immediately, sold_price stays null (nothing
 * was actually bid). owner_team_code is how getSquadsForTournament
 * determines the captain, so it's only set when isCaptain is true.
 */
export async function addManualPlayer(
  auctionId: string,
  teamId: string,
  teamCode: string,
  input: ManualPlayerInput
): Promise<ManualPlayer | null> {
  const { data, error } = await supabase
    .from("players")
    .insert({
      auction_id: auctionId,
      name: input.name,
      role: input.role,
      sold_to_team_id: teamId,
      owner_team_code: input.isCaptain ? teamCode : null,
      status: "sold",
    })
    .select("id, name, role, owner_team_code")
    .single();

  if (error || !data) {
    console.error("addManualPlayer failed:", error?.message);
    return null;
  }

  return { id: data.id, name: data.name, role: data.role, isCaptain: !!data.owner_team_code };
}

/**
 * Only one captain per team (getSquadsForTournament picks the first
 * match) — setting a new captain clears any existing one on that team
 * first, so there's never more than one owner_team_code set at once.
 */
export async function setManualCaptain(
  teamId: string,
  teamCode: string,
  playerId: string,
  isCaptain: boolean
): Promise<boolean> {
  if (isCaptain) {
    const { error: clearErr } = await supabase
      .from("players")
      .update({ owner_team_code: null })
      .eq("sold_to_team_id", teamId);
    if (clearErr) {
      console.error("setManualCaptain(clear) failed:", clearErr.message);
      return false;
    }
  }

  const { error } = await supabase
    .from("players")
    .update({ owner_team_code: isCaptain ? teamCode : null })
    .eq("id", playerId);

  if (error) {
    console.error("setManualCaptain failed:", error.message);
    return false;
  }
  return true;
}

export async function updateManualPlayerName(playerId: string, name: string): Promise<boolean> {
  const { error } = await supabase.from("players").update({ name }).eq("id", playerId);
  if (error) {
    console.error("updateManualPlayerName failed:", error.message);
    return false;
  }
  return true;
}

export async function deleteManualPlayer(playerId: string): Promise<boolean> {
  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) {
    console.error("deleteManualPlayer failed:", error.message);
    return false;
  }
  return true;
}

export interface LinkedAuctionInfo {
  id: string;
  name: string;
  status: string;
  isManual: boolean; // true if this was the auto-created manual container
}

/** Which auction (if any) is currently linked to this tournament, and whether it's a manual container or a real one. */
export async function getLinkedAuctionInfo(tournamentId: string): Promise<LinkedAuctionInfo | null> {
  const { data, error } = await supabase
    .from("auctions")
    .select("id, name, status, tournament_opt_out")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getLinkedAuctionInfo failed:", error.message);
    return null;
  }
  if (!data) return null;
  return { id: data.id, name: data.name, status: data.status, isManual: !!data.tournament_opt_out };
}

export interface LinkableAuction {
  id: string;
  name: string;
  status: string;
}

/** Real auctions in this org not yet linked to any tournament — candidates to attach here. */
export async function getLinkableAuctionsForOrg(orgId: string): Promise<LinkableAuction[]> {
  const { data, error } = await supabase
    .from("auctions")
    .select("id, name, status")
    .eq("org_id", orgId)
    .is("tournament_id", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getLinkableAuctionsForOrg failed:", error.message);
    return [];
  }
  return data ?? [];
}

export async function linkAuctionToTournament(auctionId: string, tournamentId: string): Promise<boolean> {
  const { error } = await supabase.from("auctions").update({ tournament_id: tournamentId }).eq("id", auctionId);
  if (error) {
    console.error("linkAuctionToTournament failed:", error.message);
    return false;
  }
  return true;
}

/** Detaches whichever auction is linked, without deleting any of its data — safe to re-link later. */
export async function unlinkAuctionFromTournament(auctionId: string): Promise<boolean> {
  const { error } = await supabase.from("auctions").update({ tournament_id: null }).eq("id", auctionId);
  if (error) {
    console.error("unlinkAuctionFromTournament failed:", error.message);
    return false;
  }
  return true;
}

export interface SwitchResult {
  ok: boolean;
  error?: string;
}

/**
 * Copies every manual team + player into a real auction's tables — as new
 * rows, `status: 'sold'`, captain flag preserved — exactly what a live
 * auction win would have written. Then re-links the tournament to the real
 * auction and removes the now-empty manual container.
 *
 * Copies first, deletes only after every copy succeeds, so a failure
 * partway through never destroys the manual data before it's safely
 * duplicated.
 */
export async function switchManualToRealAuction(
  tournamentId: string,
  manualAuctionId: string,
  targetAuctionId: string
): Promise<SwitchResult> {
  const { data: manualTeams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, code, name, color, logo, tier, owner")
    .eq("auction_id", manualAuctionId);

  if (teamsErr) {
    console.error("switchManualToRealAuction(load teams) failed:", teamsErr.message);
    return { ok: false, error: "Couldn't read the manual teams." };
  }

  const teamIds = (manualTeams ?? []).map((t) => t.id);
  const { data: manualPlayers, error: playersErr } = teamIds.length
    ? await supabase
        .from("players")
        .select("id, name, role, sold_to_team_id, owner_team_code")
        .in("sold_to_team_id", teamIds)
    : { data: [] as any[], error: null };

  if (playersErr) {
    console.error("switchManualToRealAuction(load players) failed:", playersErr.message);
    return { ok: false, error: "Couldn't read the manual players." };
  }

  // Copy teams, remembering old-id -> {newId, code} so players can be re-pointed.
  const teamMap: Record<string, { newId: string; code: string }> = {};
  for (const t of manualTeams ?? []) {
    const { data: newTeam, error: insertErr } = await supabase
      .from("teams")
      .insert({
        auction_id: targetAuctionId,
        code: t.code,
        name: t.name,
        color: t.color,
        logo: t.logo,
        tier: t.tier || "Pro",
        owner: t.owner || "Manual Entry",
      })
      .select("id")
      .single();

    if (insertErr || !newTeam) {
      console.error("switchManualToRealAuction(insert team) failed:", insertErr?.message);
      return { ok: false, error: `Couldn't copy team "${t.name}" — nothing was deleted, safe to retry.` };
    }
    teamMap[t.id] = { newId: newTeam.id, code: t.code };
  }

  // Copy players, pointed at the copied teams, marked sold.
  for (const p of manualPlayers ?? []) {
    const mapped = teamMap[p.sold_to_team_id as string];
    if (!mapped) continue;
    const isCaptain = p.owner_team_code === mapped.code;

    const { error: insertPlayerErr } = await supabase.from("players").insert({
      auction_id: targetAuctionId,
      name: p.name,
      role: p.role,
      sold_to_team_id: mapped.newId,
      status: "sold",
      owner_team_code: isCaptain ? mapped.code : null,
    });

    if (insertPlayerErr) {
      console.error("switchManualToRealAuction(insert player) failed:", insertPlayerErr.message);
      return { ok: false, error: `Couldn't copy player "${p.name}" — nothing was deleted, safe to retry.` };
    }
  }

  // Everything copied successfully — now link the real auction and clear out the manual one.
  const { error: linkErr } = await supabase
    .from("auctions")
    .update({ tournament_id: tournamentId })
    .eq("id", targetAuctionId);
  if (linkErr) {
    console.error("switchManualToRealAuction(link) failed:", linkErr.message);
    return { ok: false, error: "Copied everything, but couldn't link the new auction — please try linking it manually." };
  }

  if (teamIds.length) {
    const { error: delPlayersErr } = await supabase.from("players").delete().in("sold_to_team_id", teamIds);
    if (delPlayersErr) console.error("switchManualToRealAuction(cleanup players) failed:", delPlayersErr.message);
    const { error: delTeamsErr } = await supabase.from("teams").delete().in("id", teamIds);
    if (delTeamsErr) console.error("switchManualToRealAuction(cleanup teams) failed:", delTeamsErr.message);
  }

  const { error: delAuctionErr } = await supabase.from("auctions").delete().eq("id", manualAuctionId);
  if (delAuctionErr) console.error("switchManualToRealAuction(cleanup auction) failed:", delAuctionErr.message);

  return { ok: true };
}

/**
 * Every auction currently linked to this tournament — normally exactly one
 * or zero, but nothing in the schema actually enforces that (tournament_id
 * on `auctions` isn't unique), so more than one is a real possibility if
 * two people link separately. Callers should treat length > 1 as "ask the
 * user which one to keep" rather than silently picking one.
 */
export async function getAllLinkedAuctions(tournamentId: string): Promise<LinkedAuctionInfo[]> {
  const { data, error } = await supabase
    .from("auctions")
    .select("id, name, status, tournament_opt_out")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAllLinkedAuctions failed:", error.message);
    return [];
  }
  return (data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    isManual: !!a.tournament_opt_out,
  }));
}