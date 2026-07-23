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