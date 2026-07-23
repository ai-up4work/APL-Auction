// lib/auctionLiveDb.ts
// ─────────────────────────────────────────────────────────────────────────────
// All Supabase reads / writes for the live auction.
// Lot lifecycle: null → shuffling → pending → sold | unsold
//
// "shuffling" is a new two-phase status that lets the watch page play its
// reveal animation before the shot clock starts. The lot transitions to
// "pending" (with started_at = now()) only when the watch page calls
// transitionLotToPending() after the animation completes.
//
// A server-side fallback timeout (SHUFFLE_FALLBACK_MS) also calls
// transitionLotToPending() so the auction can't get stuck if the watch
// page is disconnected or slow.
//
// ── UNSOLD RE-ENTRY ROUNDS ──────────────────────────────────────────────────
// closeLotUnsold no longer just flags the lot — it also marks the player row
// `is_unsold = true` (sold_to_team_id stays null) so it can be picked up by
// a re-entry round later. The auctioneer triggers startReentryRound() when
// ready (always available once any unsold player exists). That function:
//   1. Reads rules.current_round vs rules.unsold_reentry_rounds
//   2. Checks whether ANY team can still afford the cheapest unsold player
//      AND has roster space left
//   3. If either check fails → marks all currently-unsold players
//      is_unsold_final = true and returns { started: false, reason }
//   4. Otherwise → increments rules.current_round, re-shuffles the unsold
//      players' lot_order to the back of the queue, bumps their
//      reentry_count, and returns { started: true, round, requeued }
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";
import type { AuctionRules } from "@/types/auction";

// How long the watch page shuffle animation takes (ms).
// The fallback fires after this + 2 s grace period.
const SHUFFLE_DURATION_MS  = 3100; // ~2200 spin + 900 reveal
const SHUFFLE_FALLBACK_MS  = SHUFFLE_DURATION_MS + 2000;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AuctionLot {
  id:              string;
  auctionId:       string;
  playerId:        string;
  playerName:      string;
  playerRole:      string;
  playerCountry:   string;
  playerImg:       string;
  basePrice:       number;
  currentBid:      number;
  winningTeamId:   string | null;
  winningTeamCode: string | null;
  /** null → shuffling → pending → sold | unsold */
  status:          "shuffling" | "pending" | "sold" | "unsold";
  lotNumber:       number;
  startedAt:       string | null; // null while shuffling, set on → pending
}

export interface BidEntry {
  id:        string;
  lotId:     string;
  teamId:    string;
  teamCode:  string;
  teamName:  string;
  teamColor: string;
  amount:    number;
  placedAt:  string;
}

export interface ReentryRoundResult {
  started:   boolean;
  reason?:   "round_limit_reached" | "no_team_can_afford" | "no_unsold_players" | "all_squads_full";
  round?:    number;
  requeued?: number;
  finalized?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function mapLot(row: any): AuctionLot {
  return {
    id:              row.id,
    auctionId:       row.auction_id,
    playerId:        row.player_id,
    playerName:      row.player_name  ?? "",
    playerRole:      row.player_role  ?? "",
    playerCountry:   row.player_country ?? "",
    playerImg:       row.player_img   ?? "",
    basePrice:       row.base_price   ?? 0,
    currentBid:      row.current_bid  ?? row.base_price ?? 0,
    winningTeamId:   row.winning_team_id   ?? null,
    winningTeamCode: row.winning_team_code ?? null,
    status:          row.status,
    lotNumber:       row.lot_number   ?? 0,
    startedAt:       row.started_at   ?? null,
  };
}

function mapBid(row: any): BidEntry {
  return {
    id:        row.id,
    lotId:     row.lot_id,
    teamId:    row.team_id,
    teamCode:  row.team_code,
    teamName:  row.team_name,
    teamColor: row.team_color ?? "#888",
    amount:    row.amount,
    placedAt:  row.placed_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD LIVE STATE
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveState {
  currentLot:    AuctionLot | null;
  bidHistory:    BidEntry[];
  completedLots: AuctionLot[];
  lotNumber:     number;
  
}

export async function loadLiveState(auctionId: string): Promise<LiveState> {
  const [{ data: lotsRaw }, { data: bidsRaw }] = await Promise.all([
    supabase
      .from("auction_lots")
      .select("*")
      .eq("auction_id", auctionId)
      .order("lot_number", { ascending: true }),
    supabase
      .from("bid_history")
      .select("*")
      .eq("auction_id", auctionId)
      .order("placed_at", { ascending: false })
      .limit(30),
  ]);

  const lots = (lotsRaw ?? []).map(mapLot);

  const currentLot =
    lots.find((l) => l.status === "shuffling" || l.status === "pending") ?? null;

  const completedLots = lots.filter(
    (l) => l.status === "sold" || l.status === "unsold"
  );

  const bidHistory = currentLot
    ? (bidsRaw ?? [])
        .filter((b: any) => b.lot_id === currentLot.id)
        .map(mapBid)
    : [];

  return {
    currentLot,
    bidHistory,
    completedLots,
    lotNumber: currentLot?.lotNumber ?? lots.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// START LOT  —  writes "shuffling" (no started_at yet)
// ─────────────────────────────────────────────────────────────────────────────

async function _startLot(
  auctionId: string,
  playerId:  string,
  player: {
    name:    string;
    role:    string;
    country: string;
    img:     string;
    price:   number;
  },
  lotNumber: number
): Promise<AuctionLot> {
  const { data, error } = await supabase
    .from("auction_lots")
    .insert({
      auction_id:      auctionId,
      player_id:       playerId,
      player_name:     player.name,
      player_role:     player.role,
      player_country:  player.country,
      player_img:      player.img,
      base_price:      player.price,
      current_bid:     player.price,
      status:          "shuffling",   // ← two-phase: shuffle first
      lot_number:      lotNumber,
      started_at:      null,          // ← set later by transitionLotToPending
    })
    .select("*")
    .single();

  if (error) throw new Error(`startLot: ${error.message}`);

  const lot = mapLot(data);

  // Fallback: if the watch page never calls transitionLotToPending
  // (e.g. no one is watching), transition automatically after the
  // shuffle window + a grace period.
  setTimeout(async () => {
    try {
      await transitionLotToPending(lot.id);
    } catch {
      // already transitioned — safe to ignore
    }
  }, SHUFFLE_FALLBACK_MS);

  return lot;
}

export async function startLot(
  auctionId: string,
  playerId:  string,
  player: {
    name:    string;
    role:    string;
    country: string;
    img:     string;
    price:   number;
  }
): Promise<AuctionLot> {
  // Count existing lots to derive the next lot number
  const { count } = await supabase
    .from("auction_lots")
    .select("id", { count: "exact", head: true })
    .eq("auction_id", auctionId);

  return _startLot(auctionId, playerId, player, (count ?? 0) + 1);
}

export async function startRandomLot(auctionId: string): Promise<AuctionLot> {
  // Lots that should block a player from being called again: currently
  // active (shuffling/pending) or sold. A past "unsold" lot does NOT
  // block on its own — what matters is the player's current is_unsold
  // flag (cleared by a re-entry round), checked separately below.
  const { data: allLots } = await supabase
    .from("auction_lots")
    .select("player_id, lot_number, status")
    .eq("auction_id", auctionId)
    .order("lot_number", { ascending: false });

  const usedIds = new Set(
    (allLots ?? [])
      .filter((l: any) => l.status === "shuffling" || l.status === "pending" || l.status === "sold")
      .map((l: any) => l.player_id)
  );
  const nextNumber = ((allLots ?? [])[0]?.lot_number ?? 0) + 1;

  // Pick the next player by lot_order. Players already finalized as unsold
  // (is_unsold_final) or currently flagged is_unsold (awaiting a re-entry
  // round) are excluded, as are players added directly to a roster outside
  // the live auction (is_manual_entry) — those never had a real lot_order
  // and must never be drawn into a live lot regardless of what lot_order
  // they end up with.
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("auction_id", auctionId)
    .eq("is_unsold_final", false)
    .eq("is_unsold", false)
    .eq("is_manual_entry", false)
    .order("lot_order", { ascending: true });

  const remaining = (players ?? []).filter((p: any) => !usedIds.has(p.id));
  if (remaining.length === 0) throw new Error("No players remaining in pool");

  const next = remaining[0];
  return _startLot(
    auctionId,
    next.id,
    {
      name:    next.name,
      role:    next.role,
      country: next.country ?? "",
      img:     next.img     ?? "",
      price:   next.price,
    },
    nextNumber
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSITION TO PENDING  —  called by watch page after animation completes,
// or by the fallback timeout if the watch page isn't connected.
// Sets started_at = now() so the shot clock anchors to this exact moment.
// ─────────────────────────────────────────────────────────────────────────────

export async function transitionLotToPending(lotId: string): Promise<AuctionLot> {
  const { data, error } = await supabase
    .from("auction_lots")
    .update({
      status:     "pending",
      started_at: new Date().toISOString(),
    })
    .eq("id", lotId)
    .eq("status", "shuffling")    // idempotent: only transitions from shuffling
    .select("*")
    .single();

  if (error) throw new Error(`transitionLotToPending: ${error.message}`);
  return mapLot(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOSE LOT
// ─────────────────────────────────────────────────────────────────────────────

export async function closeLotSold(
  lotId:         string,
  auctionId:     string,
  playerId:      string,
  winningTeamId: string,
  finalBid:      number
): Promise<void> {
  const { error: lotErr } = await supabase
    .from("auction_lots")
    .update({ status: "sold" })
    .eq("id", lotId);
  if (lotErr) throw new Error(`closeLotSold(lot): ${lotErr.message}`);

  // Deduct from team purse and increment roster
  const { data: teamData } = await supabase
    .from("teams")
    .select("remaining_purse, roster")
    .eq("id", winningTeamId)
    .single();

  if (teamData) {
    const { error: purseErr } = await supabase
      .from("teams")
      .update({
        remaining_purse: (teamData.remaining_purse ?? 0) - finalBid,
        roster:          (teamData.roster ?? 0) + 1,
      })
      .eq("id", winningTeamId);
    if (purseErr) throw new Error(`closeLotSold(purse): ${purseErr.message}`);
  }

  // Record sale against the player. Clear any pending unsold flag since the
  // player is now definitively sold and can never re-enter.
  const { data: playerData, error: playerErr } = await supabase
    .from("players")
    .update({
      sold_to_team_id: winningTeamId,
      sold_price:      finalBid,
      is_unsold:       false,
    })
    .eq("id", playerId)
    .eq("auction_id", auctionId)
    .select();

  console.log("[closeLotSold] player update:", playerData, playerErr);
}

// Marks a lot unsold and flags the player as eligible for a future re-entry
// round (is_unsold = true). reentry_count is NOT bumped here — it's bumped
// only when a re-entry round actually starts and re-queues this player (see
// startReentryRound below), since what matters is how many rounds have
// happened, not how many times any single player has been called.
export async function closeLotUnsold(lotId: string, playerId: string): Promise<void> {
  const { error } = await supabase
    .from("auction_lots")
    .update({ status: "unsold" })
    .eq("id", lotId);
  if (error) throw new Error(`closeLotUnsold: ${error.message}`);

  await supabase
    .from("players")
    .update({ sold_to_team_id: null, sold_price: null, is_unsold: true })
    .eq("id", playerId);
}

// ─────────────────────────────────────────────────────────────────────────────
// UNSOLD RE-ENTRY ROUND
//
// Always callable by the auctioneer once any is_unsold player exists. Gates,
// checked in order:
//   1. current_round >= unsold_reentry_rounds   → finalize everyone, refuse
//   2. Every team's roster already == teamSize  → finalize everyone, refuse
//   3. No team can afford the cheapest unsold player's base price
//                                                → finalize everyone, refuse
// Otherwise: bumps current_round (global, not per-player), clears each
// unsold player's is_unsold flag so startRandomLot can pick it up again,
// re-shuffles the unsold batch and appends it to the back of the lot_order
// queue, and increments each requeued player's reentry_count by 1.
// ─────────────────────────────────────────────────────────────────────────────

export async function startReentryRound(
  auctionId: string,
  rules: Pick<AuctionRules, "unsoldReentryRounds" | "teamSize">
): Promise<ReentryRoundResult> {
  // 1. Load unsold players (not yet finalized)
  const { data: unsoldPlayers, error: playersErr } = await supabase
    .from("players")
    .select("id, price, reentry_count")
    .eq("auction_id", auctionId)
    .eq("is_unsold", true)
    .eq("is_unsold_final", false);

  if (playersErr) throw new Error(`startReentryRound(players): ${playersErr.message}`);

  if (!unsoldPlayers || unsoldPlayers.length === 0) {
    return { started: false, reason: "no_unsold_players" };
  }

  // 2. Load current_round from rules
  const { data: rulesRow, error: rulesErr } = await supabase
    .from("rules")
    .select("current_round")
    .eq("auction_id", auctionId)
    .single();

  if (rulesErr) throw new Error(`startReentryRound(rules): ${rulesErr.message}`);
  const currentRound = rulesRow?.current_round ?? 0;

  // 3. Load all teams' purses + rosters
  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, remaining_purse, roster")
    .eq("auction_id", auctionId);

  if (teamsErr) throw new Error(`startReentryRound(teams): ${teamsErr.message}`);

  const cheapestBase = Math.min(...unsoldPlayers.map((p: any) => p.price ?? 0));

  const anySquadSpace = (teams ?? []).some((t: any) => (t.roster ?? 0) < rules.teamSize);
  const anyCanAfford  = (teams ?? []).some((t: any) => (t.remaining_purse ?? 0) >= cheapestBase);

  // ── Gate checks — finalize instead of starting a new round ──────────────
  if (currentRound >= rules.unsoldReentryRounds) {
    await finalizeUnsoldPlayers(auctionId);
    return { started: false, reason: "round_limit_reached", finalized: unsoldPlayers.length };
  }
  if (!anySquadSpace) {
    await finalizeUnsoldPlayers(auctionId);
    return { started: false, reason: "all_squads_full", finalized: unsoldPlayers.length };
  }
  if (!anyCanAfford) {
    await finalizeUnsoldPlayers(auctionId);
    return { started: false, reason: "no_team_can_afford", finalized: unsoldPlayers.length };
  }

  // ── Proceed: bump round, requeue, reshuffle to the back ──────────────────
  const { data: maxLotRow } = await supabase
    .from("players")
    .select("lot_order")
    .eq("auction_id", auctionId)
    .order("lot_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextOrder = (maxLotRow?.lot_order ?? 0) + 1;

  // Fisher-Yates shuffle the unsold batch before appending to the back
  const ids = unsoldPlayers.map((p: any) => p.id as string);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  const reentryCountById = new Map(
    unsoldPlayers.map((p: any) => [p.id, p.reentry_count ?? 0])
  );

  const updates = ids.map((id) =>
    supabase
      .from("players")
      .update({
        lot_order:     nextOrder++,
        is_unsold:     false, // cleared so startRandomLot can pick it up again
        reentry_count: (reentryCountById.get(id) ?? 0) + 1,
      })
      .eq("id", id)
  );

  const results = await Promise.all(updates);
  for (const r of results) {
    if (r.error) throw new Error(`startReentryRound(requeue): ${r.error.message}`);
  }

  const newRound = currentRound + 1;
  const { error: roundErr } = await supabase
    .from("rules")
    .update({ current_round: newRound })
    .eq("auction_id", auctionId);

  if (roundErr) throw new Error(`startReentryRound(bump round): ${roundErr.message}`);

  return { started: true, round: newRound, requeued: ids.length };
}

async function finalizeUnsoldPlayers(auctionId: string): Promise<void> {
  const { error } = await supabase
    .from("players")
    .update({ is_unsold_final: true })
    .eq("auction_id", auctionId)
    .eq("is_unsold", true)
    .eq("is_unsold_final", false);

  if (error) throw new Error(`finalizeUnsoldPlayers: ${error.message}`);
}

export async function getCurrentRound(
  auctionId: string
): Promise<{ current: number; limit: number }> {
  const { data, error } = await supabase
    .from("rules")
    .select("current_round, unsold_reentry_rounds")
    .eq("auction_id", auctionId)
    .single();

  if (error) throw new Error(`getCurrentRound: ${error.message}`);
  return { current: data?.current_round ?? 0, limit: data?.unsold_reentry_rounds ?? 0 };
}

export async function countPendingUnsold(auctionId: string): Promise<number> {
  const { count, error } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("auction_id", auctionId)
    .eq("is_unsold", true)
    .eq("is_unsold_final", false);

  if (error) throw new Error(`countPendingUnsold: ${error.message}`);
  return count ?? 0;
}

export async function loadFinalUnsoldPlayers(auctionId: string) {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("auction_id", auctionId)
    .eq("is_unsold_final", true);

  if (error) throw new Error(`loadFinalUnsoldPlayers: ${error.message}`);
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// PLACE BID
// ─────────────────────────────────────────────────────────────────────────────

export async function placeBid(
  lotId:     string,
  auctionId: string,
  teamId:    string,
  teamCode:  string,
  teamName:  string,
  teamColor: string,
  amount:    number
): Promise<BidEntry> {
  const [{ data: lot }, { data: team }, { data: rulesRow }] = await Promise.all([
    supabase.from("auction_lots").select("status, current_bid").eq("id", lotId).single(),
    // roster here is the SAME column addManualPlayer must increment —
    // manual players and live-auction wins share one counter, so this
    // check naturally accounts for both without needing to know which
    // kind of player any given roster slot came from.
    supabase.from("teams").select("roster").eq("id", teamId).single(),
    supabase.from("rules").select("team_size").eq("auction_id", auctionId).single(),
  ]);

  // Bids only accepted on "pending" lots — not "shuffling"
  if (!lot || lot.status !== "pending") {
    throw new Error("Bidding is not open for this lot");
  }
  if (amount <= (lot.current_bid ?? 0)) {
    throw new Error("Bid must exceed current high bid");
  }

  // Squad-full check — counts manual entries + live wins together, since
  // both increment the same teams.roster column.
  const teamSize = rulesRow?.team_size ?? Infinity;
  if ((team?.roster ?? 0) >= teamSize) {
    throw new Error("This team's squad is already full");
  }

  const placedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("bid_history")
    .insert({
      lot_id:     lotId,
      auction_id: auctionId,
      team_id:    teamId,
      team_code:  teamCode,
      team_name:  teamName,
      team_color: teamColor,
      amount,
      placed_at:  placedAt,
    })
    .select("*")
    .single();

  if (error) throw new Error(`placeBid: ${error.message}`);

  // Update the lot's current bid and winning team
  await supabase
    .from("auction_lots")
    .update({
      current_bid:       amount,
      winning_team_id:   teamId,
      winning_team_code: teamCode,
    })
    .eq("id", lotId);

  return mapBid(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeToLot(
  auctionId:       string,
  onLot:           (lot: AuctionLot) => void,
  getCurrentLotId: () => string | null
) {
  const channel = supabase
    .channel(`lot:${auctionId}`)
    .on(
      "postgres_changes",
      {
        event:  "*",
        schema: "public",
        table:  "auction_lots",
        filter: `auction_id=eq.${auctionId}`,
      },
      (payload) => {
        const lot = mapLot(payload.new);

        // Orphan-close guard: ignore sold/unsold events for a lot that is no
        // longer the active one (can happen if events arrive out of order).
        if (
          (lot.status === "sold" || lot.status === "unsold") &&
          lot.id !== getCurrentLotId()
        ) {
          return;
        }

        onLot(lot);
      }
    )
    .subscribe();

  return channel;
}

export function subscribeToBids(
  auctionId: string,
  onBid:     (bid: BidEntry) => void
) {
  const channel = supabase
    .channel(`bids:${auctionId}`)
    .on(
      "postgres_changes",
      {
        event:  "INSERT",
        schema: "public",
        table:  "bid_history",
        filter: `auction_id=eq.${auctionId}`,
      },
      (payload) => onBid(mapBid(payload.new))
    )
    .subscribe();

  return channel;
}

export async function completeLotReveal(lotId: string): Promise<AuctionLot> {
  const { data, error } = await supabase
    .from("auction_lots")
    .update({
      status:     "pending",
      started_at: new Date().toISOString(),
    })
    .eq("id", lotId)
    .eq("status", "shuffling")    // only transitions from shuffling
    .select("*")
    .single();

  // PGRST116 = "no rows returned" — the lot was already transitioned
  // (fallback timeout or another tab beat us). Fetch the current state
  // and return it so the caller can still sync correctly.
  if (error?.code === "PGRST116") {
    const { data: existing, error: fetchErr } = await supabase
      .from("auction_lots")
      .select("*")
      .eq("id", lotId)
      .single();

    if (fetchErr) throw new Error(`completeLotReveal(fetch): ${fetchErr.message}`);
    return mapLot(existing);
  }

  if (error) throw new Error(`completeLotReveal: ${error.message}`);
  return mapLot(data);
}

export function subscribeToTeamPurses(
  auctionId: string,
  onUpdate:  (teamId: string, remaining: number, roster: number) => void
) {
  const channel = supabase
    .channel(`purses:${auctionId}`)
    .on(
      "postgres_changes",
      {
        event:  "UPDATE",
        schema: "public",
        table:  "teams",
        filter: `auction_id=eq.${auctionId}`,
      },
      (payload) => {
        const { id, remaining_purse, roster } = payload.new;
        onUpdate(id, remaining_purse ?? 0, roster ?? 0);
      }
    )
    .subscribe();

  return channel;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD TEAM PURSES
// ─────────────────────────────────────────────────────────────────────────────

export async function loadTeamPurses(
  auctionId: string
): Promise<Record<string, { remaining: number; roster: number }>> {
  const { data } = await supabase
    .from("teams")
    .select("id, remaining_purse, roster")
    .eq("auction_id", auctionId);

  const result: Record<string, { remaining: number; roster: number }> = {};
  for (const t of data ?? []) {
    result[t.id] = { remaining: t.remaining_purse ?? 0, roster: t.roster ?? 0 };
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// BID INCREMENT TIERS
// ─────────────────────────────────────────────────────────────────────────────

export function getNextBidAmount(
  currentBid: number,
  tiers: AuctionRules["tiers"]
): number {
  if (!tiers || tiers.length === 0) return currentBid + 100;

  for (const tier of tiers) {
    const from = tier.from ?? 0;
    const to   = tier.to   ?? Infinity;
    if (currentBid >= from && currentBid < to) {
      return currentBid + tier.increment;
    }
  }

  // Above all tiers — use the last tier's increment
  return currentBid + tiers[tiers.length - 1].increment;
}


export async function initTeamPurses(
  auctionId:   string,
  totalPoints: number
): Promise<void> {
  const { data: teams } = await supabase
    .from("teams")
    .select("id, remaining_purse")
    .eq("auction_id", auctionId);

  if (!teams) return;

  await Promise.all(
    teams
      .filter((t) => t.remaining_purse === null || t.remaining_purse === undefined)
      .map((t) =>
        supabase
          .from("teams")
          .update({ remaining_purse: totalPoints, roster: 0 })
          .eq("id", t.id)
      )
  );
}

export function subscribeToPlayers(
  auctionId: string,
  onUpdate: (player: {
    id:            string;
    isUnsold:      boolean;
    isUnsoldFinal: boolean;
    reentryCount:  number;
  }) => void
) {
  const channel = supabase
    .channel(`players:${auctionId}`)
    .on(
      "postgres_changes",
      {
        event:  "UPDATE",
        schema: "public",
        table:  "players",
        filter: `auction_id=eq.${auctionId}`,
      },
      (payload) => {
        const row = payload.new as any;
        onUpdate({
          id:            row.id,
          isUnsold:      !!row.is_unsold,
          isUnsoldFinal: !!row.is_unsold_final,
          reentryCount:  row.reentry_count ?? 0,
        });
      }
    )
    .subscribe();

  return channel;
}