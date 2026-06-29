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
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabse";
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
  // Load players that haven't been called yet
  const { data: allLots } = await supabase
    .from("auction_lots")
    .select("player_id, lot_number")
    .eq("auction_id", auctionId)
    .order("lot_number", { ascending: false });

  const usedIds   = new Set((allLots ?? []).map((l: any) => l.player_id));
  const nextNumber = ((allLots ?? [])[0]?.lot_number ?? 0) + 1;

  // Pick the next player by lot_order
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("auction_id", auctionId)
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

  // Record sale against the player
  const { data: playerData, error: playerErr } = await supabase
    .from("players")
    .update({ sold_to_team_id: winningTeamId, sold_price: finalBid })
    .eq("id", playerId)
    .eq("auction_id", auctionId)
    .select();

  console.log("[closeLotSold] player update:", playerData, playerErr);
}

export async function closeLotUnsold(lotId: string, playerId: string): Promise<void> {
  const { error } = await supabase
    .from("auction_lots")
    .update({ status: "unsold" })
    .eq("id", lotId);
  if (error) throw new Error(`closeLotUnsold: ${error.message}`);

  await supabase
    .from("players")
    .update({ sold_to_team_id: null, sold_price: null })
    .eq("id", playerId);
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
  const { data: lot } = await supabase
    .from("auction_lots")
    .select("status, current_bid")
    .eq("id", lotId)
    .single();

  // Bids only accepted on "pending" lots — not "shuffling"
  if (!lot || lot.status !== "pending") {
    throw new Error("Bidding is not open for this lot");
  }
  if (amount <= (lot.current_bid ?? 0)) {
    throw new Error("Bid must exceed current high bid");
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