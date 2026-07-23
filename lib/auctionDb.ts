// lib/auctionDb.ts
// ─────────────────────────────────────────────────────────────────────────────
// All Supabase reads / writes for the auction.  Nothing in this file knows
// about React — it's pure async functions called from AuctionContext.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "./supabase";
import type {
  AuctionState,
  AuctionStatus,
  Team,
  Player,
  AuctionRules,
  SessionConfig,
  Tournament,
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
// HELPER — current auth user + their current_org_id, in one call. Used by
// createAuction (and now createTournament/listTournaments) so every row is
// stamped with who owns it and (if they belong to an org) which org it
// belongs to. Throws if there's no authenticated user — an auction MUST
// have an owner; there is no legitimate anonymous-create path.
//
// NOTE: exported (not just module-local) because the Tournaments section
// below also needs org context to scope createTournament/listTournaments.
// ─────────────────────────────────────────────────────────────────────────────
export async function getCurrentUserAndOrg(): Promise<{ userId: string; orgId: string | null }> {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw sbErr(userErr, "getCurrentUserAndOrg(auth)");
  if (!user) throw new Error("Not signed in — cannot create or own an auction.");

  const { data: profile, error: profileErr } = await supabase
    .from("user_profiles")
    .select("current_org_id")
    .eq("id", user.id)
    .maybeSingle();

  // A missing/failed profile lookup shouldn't block auction creation — the
  // auction just falls back to a personal (org_id: null) auction, scoped
  // by created_by alone.
  if (profileErr) {
    console.warn("[getCurrentUserAndOrg] profile lookup failed, defaulting org_id to null:", profileErr);
    return { userId: user.id, orgId: null };
  }

  return { userId: user.id, orgId: profile?.current_org_id ?? null };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUCTION ROW
// ─────────────────────────────────────────────────────────────────────────────

export async function createAuction(name: string): Promise<string> {
  const { userId, orgId } = await getCurrentUserAndOrg();

  const { data, error } = await supabase
    .from("auctions")
    .insert({ name, status: "setup", created_by: userId, org_id: orgId })
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

  // NOTE: with RLS enabled on `auctions` (see rls_auction_scoping.sql),
  // this also silently returns null for auctions that exist but belong to
  // someone else — Postgres just won't return the row. That's the desired
  // behavior: a stale/guessed auction id in localStorage or the URL can no
  // longer leak another user's auction into the UI.
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
    id:            _playerIdCounter++,
    supabaseId:    p.id,
    name:          p.name,
    role:          p.role,
    origin:        p.origin,
    price:         p.price,
    capped:        p.capped,
    img:           p.img ?? "",
    country:       p.country ?? "",
    lotOrder:      p.lot_order ?? null,
    ownerTeamCode: p.owner_team_code ?? undefined,
    // Derived purely from owner_team_code — no separate is_captain column.
    isCaptain:     !!p.owner_team_code,
    reentryCount:  p.reentry_count ?? 0,
    isUnsoldFinal: p.is_unsold_final ?? false,
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
        auctionLogo:        sessionRaw.auction_logo ?? "",   // ← NEW
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
    // ← NEW: surfaces the tournament link (if any) and whether the user has
    // explicitly opted this auction out of ever prompting for one again.
    // Both columns already exist on `auctions` (tournament_id was there
    // from the old team-count trigger; tournament_opt_out was added in the
    // migration that neutralized that trigger).
    tournamentId:     auction.tournament_id ?? null,
    tournamentOptOut: auction.tournament_opt_out ?? false,
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
        name:            player.name,
        role:            player.role,
        origin:          player.origin,
        price:           player.price,
        capped:          player.capped,
        img:             player.img,
        country:         player.country,
        owner_team_code: player.ownerTeamCode ?? null,
      })
      .eq("id", player.supabaseId);

    if (error) throw sbErr(error, `upsertPlayer(update:${player.name})`);
    return player.supabaseId;
  } else {
    const { data, error } = await supabase
      .from("players")
      .insert({
        auction_id:      auctionId,
        name:            player.name,
        role:            player.role,
        origin:          player.origin,
        price:           player.price,
        capped:          player.capped,
        img:             player.img,
        country:         player.country,
        owner_team_code: player.ownerTeamCode ?? null,
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
//
// IMPORTANT: captains (owner_team_code is set) are excluded from the shuffle
// and from lot_order entirely — they never enter the live bid pool. They are
// auto-assigned to their own team at launch time (see assignCaptains below).
// ─────────────────────────────────────────────────────────────────────────────

export async function shufflePlayerOrder(
  auctionId: string
): Promise<{ id: string; lot_order: number }[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id")
    .eq("auction_id", auctionId)
    .is("owner_team_code", null);

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
// CAPTAIN AUTO-ASSIGNMENT
//
// Called once at launch (saveFullAuctionAndLaunch). Any player with
// owner_team_code set is treated as that team's captain and is:
//   1. Deducted ownerSelfPurchaseCost from their own team's purse
//   2. Marked sold_to_team_id = (their own team), sold_price = ownerSelfPurchaseCost
//   3. Given roster += 1 on their team
//   4. Never given a lot_order — shufflePlayerOrder already excludes them,
//      and startRandomLot only pulls from players with lot_order set.
//
// Idempotent: skips any captain that already has sold_to_team_id set, so
// re-running launch (e.g. retry after a partial failure) won't double-charge.
// ─────────────────────────────────────────────────────────────────────────────

export async function assignCaptains(
  auctionId: string,
  ownerSelfPurchaseCost: number
): Promise<void> {
  const { data: captains, error } = await supabase
    .from("players")
    .select("id, owner_team_code, sold_to_team_id")
    .eq("auction_id", auctionId)
    .not("owner_team_code", "is", null);

  if (error) throw sbErr(error, "assignCaptains(fetch players)");
  if (!captains || captains.length === 0) return;

  const pending = captains.filter((c: any) => !c.sold_to_team_id && c.owner_team_code);
  if (pending.length === 0) return;

  const codes = Array.from(new Set(pending.map((c: any) => c.owner_team_code)));
  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, code, remaining_purse, roster")
    .eq("auction_id", auctionId)
    .in("code", codes);

  if (teamsErr) throw sbErr(teamsErr, "assignCaptains(fetch teams)");

  const teamByCode = new Map((teams ?? []).map((t: any) => [t.code, t]));

  for (const captain of pending) {
    const team = teamByCode.get(captain.owner_team_code);
    if (!team) {
      console.warn(
        `[assignCaptains] no team found for code "${captain.owner_team_code}" — skipping captain ${captain.id}`
      );
      continue;
    }

    const { error: playerErr } = await supabase
      .from("players")
      .update({
        sold_to_team_id: team.id,
        sold_price:      ownerSelfPurchaseCost,
        price:           ownerSelfPurchaseCost,
      })
      .eq("id", captain.id);

    if (playerErr) throw sbErr(playerErr, `assignCaptains(player ${captain.id})`);

    const { error: teamErr } = await supabase
      .from("teams")
      .update({
        remaining_purse: (team.remaining_purse ?? 0) - ownerSelfPurchaseCost,
        roster:          (team.roster ?? 0) + 1,
      })
      .eq("id", team.id);

    if (teamErr) throw sbErr(teamErr, `assignCaptains(team ${team.id})`);

    // Keep local map in sync in case the same team has >1 captain (shouldn't
    // normally happen, but guards against double-counting in this loop).
    team.remaining_purse = (team.remaining_purse ?? 0) - ownerSelfPurchaseCost;
    team.roster          = (team.roster ?? 0) + 1;
  }
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

// FIX: previously this only wrote to session_config, so auctions.name
// (which createAuction() set once at creation and which listAuctions() /
// AuctionCard / AuctionSwitcher all read from) never got updated when a
// user renamed their auction from the Session tab — every other surface
// kept showing the original name forever. Now both rows are updated
// together so there's a single source of truth for "what is this auction
// called right now".
export async function saveSession(auctionId: string, session: SessionConfig): Promise<void> {
  const [sessionResult, auctionResult] = await Promise.all([
    supabase.from("session_config").upsert(
      {
        auction_id:          auctionId,
        auction_name:        session.auctionName,
        auctioneer:          session.auctioneer,
        auction_date:        session.auctionDate,
        auction_time:        session.auctionTime,
        venue:               session.venue,
        auction_logo:        session.auctionLogo,   // ← NEW
        timer_seconds:       session.timerSeconds,
        access_mode:         session.accessMode,
        spectator_link:      session.spectatorLink,
        owner_participation: session.ownerParticipation,
        unsold_reintroduce:  session.unsoldReintroduce,
      },
      { onConflict: "auction_id" }
    ),
    supabase.from("auctions").update({ name: session.auctionName }).eq("id", auctionId),
  ]);

  if (sessionResult.error) throw sbErr(sessionResult.error, "saveSession(session_config)");
  if (auctionResult.error) throw sbErr(auctionResult.error, "saveSession(auctions.name)");
}

// ─────────────────────────────────────────────────────────────────────────────
// TOURNAMENTS
//
// Backed by public.tournaments (org-scoped). Used by the TeamsTab
// tournament-link prompt: once an auction crosses 2 teams, the user can
// link it to an existing tournament, create a new one, or opt out (see
// setTournamentOptOut below and the tournament_opt_out column on auctions,
// added in the migration that neutralized the old check_auction_destination
// trigger).
// ─────────────────────────────────────────────────────────────────────────────

export async function listTournaments(): Promise<Tournament[]> {
  const { orgId } = await getCurrentUserAndOrg();
  if (!orgId) return []; // no org context — nothing shared to show

  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, format, status")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw sbErr(error, "listTournaments");
  return (data ?? []) as Tournament[];
}

export async function createTournament(
  name: string,
  format: "single_elimination" | "double_elimination"
): Promise<string> {
  const { userId, orgId } = await getCurrentUserAndOrg();
  if (!orgId) throw new Error("You must belong to an organization to create a tournament.");

  const { data, error } = await supabase
    .from("tournaments")
    .insert({ name, format, created_by: userId, org_id: orgId })
    .select("id")
    .single();

  if (error) throw sbErr(error, "createTournament");
  return data.id as string;
}

export async function linkAuctionTournament(auctionId: string, tournamentId: string): Promise<void> {
  const { error } = await supabase
    .from("auctions")
    .update({ tournament_id: tournamentId, tournament_opt_out: false })
    .eq("id", auctionId);

  if (error) throw sbErr(error, "linkAuctionTournament");
}

export async function setTournamentOptOut(auctionId: string, optOut: boolean): Promise<void> {
  const { error } = await supabase
    .from("auctions")
    .update({ tournament_opt_out: optOut })
    .eq("id", auctionId);

  if (error) throw sbErr(error, "setTournamentOptOut");
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

  // ← Auto-assign captains to their own teams BEFORE going live, so they
  // never enter the shuffled lot pool. Must run after purses are set and
  // after teams/players are upserted (needs real supabase IDs + codes).
  await assignCaptains(auctionId, state.rules.ownerSelfPurchaseCost);

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
  auctionLogo:        "",   // ← NEW
  timerSeconds:       15,
  accessMode:         "spectator",
  spectatorLink:      "apl-auction.live/watch/s1",
  ownerParticipation: true,
  unsoldReintroduce:  true,
};

// ─────────────────────────────────────────────────────────────────────────────
// LIST ALL AUCTIONS
//
// No explicit .eq("created_by", ...) filter here on purpose: RLS on the
// `auctions` table (see rls_auction_scoping.sql) is the source of truth for
// "which auctions can this user see" — it already restricts every select to
// rows the caller owns or shares an org with. Filtering here too would be
// redundant, and worse, would silently diverge from the RLS policy if one
// is ever changed without updating the other. If RLS is NOT yet applied to
// your database, this function will currently return every auction in the
// table — run the migration first.
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
  auctionLogo: string | null;
}

export async function listAuctions(): Promise<AuctionSummary[]> {
  const { data, error } = await supabase
    .from("auctions")
    .select(`
      id, name, status, created_at, launched_at, completed_at,
      teams:teams(count),
      players:players(count),
      session_config(auction_logo)
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
    auctionLogo: Array.isArray(a.session_config)
      ? (a.session_config[0]?.auction_logo ?? null)
      : (a.session_config?.auction_logo ?? null),
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
    // lotOrder cleared so the new auction requires a fresh shuffle.
    // reentryCount / isUnsoldFinal / captain-sold-state also reset since
    // this is a brand new auction instance.
    ...source.players.map((p) => upsertPlayer(newId, {
      ...p,
      supabaseId:    undefined,
      lotOrder:      undefined,
      reentryCount:  0,
      isUnsoldFinal: false,
    })),
  ]);

  return newId;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESET AUCTION (Re-auction)
//
// Resets an auction IN PLACE: deletes bid_history / auction_lots / feedback,
// resets players' sold/lot/unsold/reentry fields back to fresh, resets
// teams' roster/remaining_purse, resets rules.current_round, and sets
// auctions.status back to 'setup'. Teams, players (identity fields), rules
// (config), and session_config are all preserved — only auction *progress*
// is wiped. Implemented as a single Postgres RPC (see reset_auction.sql)
// so the whole operation is atomic on the DB side.
// ─────────────────────────────────────────────────────────────────────────────

export async function resetAuctionInDb(auctionId: string): Promise<void> {
  const { error } = await supabase.rpc("reset_auction", {
    p_auction_id: auctionId,
  });
  if (error) throw sbErr(error, "resetAuctionInDb");
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