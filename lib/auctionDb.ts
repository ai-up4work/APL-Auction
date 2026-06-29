// lib/auctionDb.ts
// ─────────────────────────────────────────────────────────────────────────────
// All Supabase reads / writes for the auction.  Nothing in this file knows
// about React — it's pure async functions called from AuctionContext.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "./supabse";
import type {
  AuctionState,
  AuctionStatus,
  Team,
  Player,
  AuctionRules,
  SessionConfig,
} from "@/types/auction";

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — turns a raw Supabase error object into a readable string
// ─────────────────────────────────────────────────────────────────────────────
function sbErr(error: any, context?: string): Error {
  const msg =
    error?.message ||
    error?.details ||
    error?.hint ||
    error?.code ||
    (typeof error === "string" ? error : JSON.stringify(error)) ||
    "Unknown Supabase error";
  const prefix = context ? `[${context}] ` : "";
  console.error(`${prefix}Supabase error:`, error);
  return new Error(`${prefix}${msg}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// AUCTION ROW
// ─────────────────────────────────────────────────────────────────────────────

export async function createAuction(name: string): Promise<string> {
  const { data, error } = await supabase
    .from("auctions")
    .insert({ name, status: "setup" })
    .select("id")
    .single();

  if (error) throw sbErr(error, "createAuction");
  return data.id as string;
}

export async function updateAuctionStatus(
  auctionId: string,
  status: AuctionStatus,
  extra?: { launched_at?: string; completed_at?: string }
): Promise<void> {
  const { error } = await supabase
    .from("auctions")
    .update({ status, ...extra })
    .eq("id", auctionId);

  if (error) throw sbErr(error, "updateAuctionStatus");
}

export async function loadAuction(auctionId: string): Promise<AuctionState | null> {
  const { data: auction, error: aErr } = await supabase
    .from("auctions")
    .select("*")
    .eq("id", auctionId)
    .single();

  if (aErr || !auction) return null;

  const [
    { data: teamsRaw },
    { data: playersRaw },
    { data: rulesRaw },
    { data: sessionRaw },
  ] = await Promise.all([
    supabase.from("teams").select("*").eq("auction_id", auctionId).order("created_at"),
    supabase
      .from("players")
      .select("*")
      .eq("auction_id", auctionId)
      .order("lot_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase.from("rules").select("*").eq("auction_id", auctionId).maybeSingle(),
    supabase.from("session_config").select("*").eq("auction_id", auctionId).maybeSingle(),
  ]);

  let _teamIdCounter = 1;
  const teams: Team[] = (teamsRaw ?? []).map((t: any) => ({
    id:         _teamIdCounter++,
    supabaseId: t.id,
    code:       t.code,
    name:       t.name,
    tier:       t.tier,
    owner:      t.owner,
    pin:        t.pin ?? "",
    color:      t.color,
    logo:       t.logo ?? "",
    roster:     t.roster ?? 0,
  }));

  let _playerIdCounter = 1;
  const players: Player[] = (playersRaw ?? []).map((p: any) => ({
    id:         _playerIdCounter++,
    supabaseId: p.id,
    name:       p.name,
    role:       p.role,
    origin:     p.origin,
    price:      p.price,
    capped:     p.capped,
    img:        p.img ?? "",
    country:    p.country ?? "",
    lotOrder:   p.lot_order ?? null,
  }));

  const rules: AuctionRules = rulesRaw
    ? {
        totalPoints:           rulesRaw.total_points,
        teamSize:              rulesRaw.team_size,
        basePrice:             rulesRaw.base_price,
        targetPlayerCount:     rulesRaw.target_player_count ?? DEFAULT_RULES.targetPlayerCount,
        ownerParticipation:    rulesRaw.owner_participation,
        ownerSelfPurchaseCost: rulesRaw.owner_self_purchase_cost,
        maxOverseasPlayers:    rulesRaw.max_overseas_players,
        reservePointsEnforced: rulesRaw.reserve_points_enforced,
        maxBidTimeSeconds:     rulesRaw.max_bid_time_seconds,
        unsoldReentryRounds:   rulesRaw.unsold_reentry_rounds,
        tiers:                 rulesRaw.tiers,
      }
    : DEFAULT_RULES;

  const session: SessionConfig = sessionRaw
    ? {
        auctionName:        sessionRaw.auction_name,
        auctioneer:         sessionRaw.auctioneer ?? "",
        auctionDate:        sessionRaw.auction_date ?? "",
        auctionTime:        sessionRaw.auction_time ?? "",
        venue:              sessionRaw.venue ?? "",
        timerSeconds:       sessionRaw.timer_seconds,
        accessMode:         sessionRaw.access_mode,
        spectatorLink:      sessionRaw.spectator_link ?? "",
        ownerParticipation: sessionRaw.owner_participation,
        unsoldReintroduce:  sessionRaw.unsold_reintroduce,
      }
    : DEFAULT_SESSION;

  return {
    auctionId,
    status: auction.status as AuctionStatus,
    teams,
    players,
    rules,
    session,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAMS
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertTeam(auctionId: string, team: Team): Promise<string> {
  if (team.supabaseId) {
    const { error } = await supabase
      .from("teams")
      .update({
        code:   team.code,
        name:   team.name,
        tier:   team.tier,
        owner:  team.owner,
        pin:    team.pin ?? "",
        color:  team.color,
        logo:   team.logo,
        roster: team.roster,
      })
      .eq("id", team.supabaseId);

    if (error) throw sbErr(error, `upsertTeam(update:${team.name})`);
    return team.supabaseId;
  } else {
    const { data, error } = await supabase
      .from("teams")
      .insert({
        auction_id: auctionId,
        code:       team.code,
        name:       team.name,
        tier:       team.tier,
        owner:      team.owner,
        pin:        team.pin ?? "",
        color:      team.color,
        logo:       team.logo,
        roster:     team.roster ?? 0,
      })
      .select("id")
      .single();

    if (error) throw sbErr(error, `upsertTeam(insert:${team.name})`);
    return data.id as string;
  }
}

export async function deleteTeamFromDb(supabaseId: string): Promise<void> {
  const { error } = await supabase.from("teams").delete().eq("id", supabaseId);
  if (error) throw sbErr(error, "deleteTeam");
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYERS
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertPlayer(auctionId: string, player: Player): Promise<string> {
  if (player.supabaseId) {
    const { error } = await supabase
      .from("players")
      .update({
        name:    player.name,
        role:    player.role,
        origin:  player.origin,
        price:   player.price,
        capped:  player.capped,
        img:     player.img,
        country: player.country,
      })
      .eq("id", player.supabaseId);

    if (error) throw sbErr(error, `upsertPlayer(update:${player.name})`);
    return player.supabaseId;
  } else {
    const { data, error } = await supabase
      .from("players")
      .insert({
        auction_id: auctionId,
        name:       player.name,
        role:       player.role,
        origin:     player.origin,
        price:      player.price,
        capped:     player.capped,
        img:        player.img,
        country:    player.country,
      })
      .select("id")
      .single();

    if (error) throw sbErr(error, `upsertPlayer(insert:${player.name})`);
    return data.id as string;
  }
}

export async function deletePlayerFromDb(supabaseId: string): Promise<void> {
  const { error } = await supabase.from("players").delete().eq("id", supabaseId);
  if (error) throw sbErr(error, "deletePlayer");
}

// ─────────────────────────────────────────────────────────────────────────────
// SHUFFLE
//
// Fisher-Yates on player IDs, persisted to lot_order column via RPC.
// Returns the exact order payload written to the DB so the caller can
// update React state directly — no read-back or retry loop needed.
// ─────────────────────────────────────────────────────────────────────────────

export async function shufflePlayerOrder(
  auctionId: string
): Promise<{ id: string; lot_order: number }[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id")
    .eq("auction_id", auctionId);

  if (error) throw sbErr(error, "shufflePlayerOrder(fetch)");
  if (!data || data.length === 0) return [];

  // Fisher-Yates in-place shuffle
  const ids = data.map((p: any) => p.id as string);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  const orderPayload = ids.map((id, index) => ({ id, lot_order: index }));

  // Try atomic RPC first
  const { error: rpcError } = await supabase.rpc("shuffle_player_order", {
    p_auction_id: auctionId,
    p_order:      orderPayload,
  });

  if (!rpcError) return orderPayload;

  // PGRST202 = function not found; any other error is real — rethrow
  if (rpcError.code !== "PGRST202") {
    throw sbErr(rpcError, "shufflePlayerOrder(rpc)");
  }

  console.warn(
    "[shufflePlayerOrder] shuffle_player_order RPC not found — " +
    "falling back to parallel updates. Add the RPC for atomic shuffles."
  );

  const results = await Promise.all(
    ids.map((id, index) =>
      supabase.from("players").update({ lot_order: index }).eq("id", id)
    )
  );
  for (const r of results) {
    if (r.error) throw sbErr(r.error, "shufflePlayerOrder(update)");
  }

  return orderPayload;
}

// ─────────────────────────────────────────────────────────────────────────────
// RULES
// ─────────────────────────────────────────────────────────────────────────────

export async function saveRules(auctionId: string, rules: AuctionRules): Promise<void> {
  const { error } = await supabase.from("rules").upsert(
    {
      auction_id:               auctionId,
      total_points:             rules.totalPoints,
      team_size:                rules.teamSize,
      base_price:               rules.basePrice,
      target_player_count:      rules.targetPlayerCount,
      owner_participation:      rules.ownerParticipation,
      owner_self_purchase_cost: rules.ownerSelfPurchaseCost,
      max_overseas_players:     rules.maxOverseasPlayers,
      reserve_points_enforced:  rules.reservePointsEnforced,
      max_bid_time_seconds:     rules.maxBidTimeSeconds,
      unsold_reentry_rounds:    rules.unsoldReentryRounds,
      tiers:                    rules.tiers,
    },
    { onConflict: "auction_id" }
  );

  if (error) throw sbErr(error, "saveRules");
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION CONFIG
// ─────────────────────────────────────────────────────────────────────────────

export async function saveSession(auctionId: string, session: SessionConfig): Promise<void> {
  const { error } = await supabase.from("session_config").upsert(
    {
      auction_id:          auctionId,
      auction_name:        session.auctionName,
      auctioneer:          session.auctioneer,
      auction_date:        session.auctionDate,
      auction_time:        session.auctionTime,
      venue:               session.venue,
      timer_seconds:       session.timerSeconds,
      access_mode:         session.accessMode,
      spectator_link:      session.spectatorLink,
      owner_participation: session.ownerParticipation,
      unsold_reintroduce:  session.unsoldReintroduce,
    },
    { onConflict: "auction_id" }
  );

  if (error) throw sbErr(error, "saveSession");
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL LAUNCH SAVE
// ─────────────────────────────────────────────────────────────────────────────

export async function saveFullAuctionAndLaunch(state: AuctionState): Promise<string> {
  let auctionId = state.auctionId;
  if (!auctionId) {
    auctionId = await createAuction(state.session.auctionName);
  }

  await Promise.all([
    saveRules(auctionId, state.rules),
    saveSession(auctionId, state.session),
  ]);

  await Promise.all([
    ...state.teams.map((t) => upsertTeam(auctionId!, t)),
    ...state.players.map((p) => upsertPlayer(auctionId!, p)),
  ]);

  // ← set remaining_purse = totalPoints for all teams at launch
  const { error: purseError } = await supabase
    .from("teams")
    .update({ remaining_purse: state.rules.totalPoints })
    .eq("auction_id", auctionId)
    .is("remaining_purse", null);

  if (purseError) throw sbErr(purseError, "saveFullAuctionAndLaunch(set purse)");

  await updateAuctionStatus(auctionId, "live", {
    launched_at: new Date().toISOString(),
  });

  return auctionId;
}
// ─────────────────────────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_RULES: AuctionRules = {
  totalPoints:           50000,
  teamSize:              16,
  basePrice:             500,
  targetPlayerCount:     26,
  ownerParticipation:    true,
  ownerSelfPurchaseCost: 3000,
  maxOverseasPlayers:    0,
  reservePointsEnforced: true,
  maxBidTimeSeconds:     300,
  unsoldReentryRounds:   1,
  tiers: [
    { from: 500,   to: 1000,  increment: 100  },
    { from: 1000,  to: 3000,  increment: 200  },
    { from: 3000,  to: 6000,  increment: 500  },
    { from: 6000,  to: 20000, increment: 1000 },
    { from: 20000, to: null,  increment: 2000 },
  ],
};

export const DEFAULT_SESSION: SessionConfig = {
  auctionName:        "APL Season 1 Auction",
  auctioneer:         "",
  auctionDate:        "",
  auctionTime:        "",
  venue:              "",
  timerSeconds:       15,
  accessMode:         "spectator",
  spectatorLink:      "apl-auction.live/watch/s1",
  ownerParticipation: true,
  unsoldReintroduce:  true,
};

// ─────────────────────────────────────────────────────────────────────────────
// LIST ALL AUCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface AuctionSummary {
  id:          string;
  name:        string;
  status:      AuctionStatus;
  createdAt:   string;
  launchedAt:  string | null;
  completedAt: string | null;
  teamCount:   number;
  playerCount: number;
}

export async function listAuctions(): Promise<AuctionSummary[]> {
  const { data, error } = await supabase
    .from("auctions")
    .select(`
      id, name, status, created_at, launched_at, completed_at,
      teams:teams(count),
      players:players(count)
    `)
    .order("created_at", { ascending: false });

  if (error) throw sbErr(error, "listAuctions");

  return (data ?? []).map((a: any) => ({
    id:          a.id,
    name:        a.name,
    status:      a.status as AuctionStatus,
    createdAt:   a.created_at,
    launchedAt:  a.launched_at  ?? null,
    completedAt: a.completed_at ?? null,
    teamCount:   a.teams[0]?.count   ?? 0,
    playerCount: a.players[0]?.count ?? 0,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// CLONE AUCTION
// ─────────────────────────────────────────────────────────────────────────────

export async function cloneAuction(sourceId: string, newName: string): Promise<string> {
  const newId  = await createAuction(newName);
  const source = await loadAuction(sourceId);
  if (!source) throw new Error("Source auction not found");

  await Promise.all([
    saveRules(newId, source.rules),
    saveSession(newId, { ...source.session, auctionName: newName }),
    ...source.teams.map((t)   => upsertTeam(newId,   { ...t,   supabaseId: undefined, roster: 0 })),
    // lotOrder cleared so the new auction requires a fresh shuffle
    ...source.players.map((p) => upsertPlayer(newId, { ...p,   supabaseId: undefined, lotOrder: undefined })),
  ]);

  return newId;
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE LINKS
// ─────────────────────────────────────────────────────────────────────────────

export interface AuctionLinks {
  admin:      string;
  spectator:  string;
  live:       string;
  ownerLinks: { teamCode: string; teamName: string; url: string; pin: string }[];
}

export function generateLinks(
  auctionId: string,
  teams: Team[],
  baseUrl: string = typeof window !== "undefined" ? window.location.origin : ""
): AuctionLinks {
  return {
    admin:      `${baseUrl}/admin?auction=${auctionId}`,
    spectator:  `${baseUrl}/watch/${auctionId}`,
    live:       `${baseUrl}/live/${auctionId}`,
    ownerLinks: teams.map((t) => ({
      teamCode: t.code,
      teamName: t.name,
      url:      `${baseUrl}/owner/${auctionId}/join`,
      pin:      t.pin ?? "—",
    })),
  };
}

export async function loadAuctionFromUrl(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("auction");
}