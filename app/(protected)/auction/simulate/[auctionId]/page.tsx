// app/auction/simulate/[auctionId]/page.tsx
//
// Live-Writing Auction Simulator
// ───────────────────────────────────────────────────────────────────────────
// ⚠️ THIS SIMULATOR WRITES REAL ROWS TO SUPABASE — using the exact same DB
// functions the real live auctioneer console and owner bid rooms use
// (startRandomLot, completeLotReveal, placeBid, closeLotSold,
// closeLotUnsold, startReentryRound). It operates on the SAME auction_id as
// the real auction.
//
// Consequences:
//   • Running this actually sells players, spends real team purses, and
//     fills real rosters in the DB — exactly as if a real auctioneer and
//     real owners had run the auction.
//   • Because it writes to the same tables the owner bid page subscribes to
//     via Postgres Changes, any owner/spectator with that page open will see
//     these simulated bids arrive in realtime. There is no "silent" mode.
//   • A "Reset Auction" button wipes bid_history and auction_lots for this
//     auction, restores every non-captain/non-manual player to the unsold
//     pool, zeroes team purses/rosters, then re-runs captain assignment and
//     relaunches the auction — using the SAME resetAuctionInDb +
//     assignCaptains primitives the real setup/launch flow uses, so it
//     can't drift from what a real reset+relaunch does.
//   • A per-player price cap (editable in the header) hard-stops the
//     simulated bidding war once the next required bid would cross it — the
//     lot is hammered to whoever's leading (or marked unsold if nobody has
//     bid yet). This cap is enforced only in this simulator's own bidding
//     decisions; it does not change what a real owner can bid for on the
//     live/owner pages.
//   • Virtual bidding is purse-share-aware and "heavy hitter" aware (see
//     canTeamAfford / decideEagerness below) so that with N teams, a fixed
//     teamSize, and a fixed total purse, the simulation reliably makes it
//     through the *entire* player pool instead of a few teams blowing their
//     whole purse on the first handful of lots.
//
// This page acts as an autonomous "virtual auctioneer + virtual bidding
// teams" driver: it walks the real player queue, opens each lot for real via
// startRandomLot, reveals it via completeLotReveal, simulates competing
// teams deciding whether to raise the bid (calling the real placeBid for
// each virtual raise), and closes each lot via closeLotSold/closeLotUnsold —
// then repeats for re-entry rounds via startReentryRound. All state shown on
// screen comes from the same realtime subscriptions the real console uses,
// not from local scripted state.
// ───────────────────────────────────────────────────────────────────────────

"use client";

import React, { use, useCallback, useEffect, useRef, useState } from "react";
import { RoleGate } from "@/components/RoleGate";
import { getOrgIdForAuction } from "@/lib/organization/invites";
import { AuctionProvider, useAuction } from "@/context/AuctionContext";
import { ShotClockProvider, useShotClock } from "@/context/ShotClockContext";
import { supabase } from "@/lib/supabase";
import {
  loadLiveState,
  closeLotSold,
  closeLotUnsold,
  completeLotReveal,
  subscribeToLot,
  subscribeToBids,
  subscribeToTeamPurses,
  getNextBidAmount,
  startRandomLot,
  startReentryRound,
  countPendingUnsold,
  getCurrentRound,
  placeBid,
  type AuctionLot,
  type BidEntry,
} from "@/lib/auctionLiveDb";
import { resetAuctionInDb, updateAuctionStatus, assignCaptains } from "@/lib/auctionDb";
import { ensureTeamPurses, fmtPts, type TeamPurse } from "@/lib/auctionLiveUtils";
import type { Player } from "@/types/auction";
import Image from "next/image";

type Speed = "slow" | "normal" | "fast";
const SPEED_MULT: Record<Speed, number> = { slow: 1.8, normal: 1, fast: 0.4 };

// Fraction of the player pool that gets treated as "marquee" talent — these
// players are allowed to draw genuine bidding wars up toward the price cap.
// Everyone else is bid on with an eye toward each team's remaining fair
// share, so a fixed total purse actually stretches across the whole pool
// instead of running dry a few dozen lots in.
const HEAVY_HITTER_FRACTION = 0.1;

// Max number of consecutive driver ticks we'll spend calling handleShuffle()
// while shuffleReady stays false before we give up and surface an error
// instead of spinning forever on "Shuffling lot order…".
const MAX_SHUFFLE_ATTEMPTS = 4;

// ─────────────────────────────────────────────────────────────────────────
// Same queue-fetch helper as the real auctioneer console — queue is only
// ever players that are shuffled (lot_order assigned), not sold, not
// currently mid-lot, and not flagged unsold.
// ─────────────────────────────────────────────────────────────────────────
async function fetchPlayerQueue(auctionId: string): Promise<Player[]> {
  const { data: lotsRaw } = await supabase
    .from("auction_lots")
    .select("player_id, status")
    .eq("auction_id", auctionId);

  const { data: playersRaw } = await supabase
    .from("players")
    .select("*")
    .eq("auction_id", auctionId)
    .eq("is_unsold_final", false)
    .eq("is_manual_entry", false)
    .not("lot_order", "is", null)
    .order("lot_order", { ascending: true });

  const activeLotPlayerIds = new Set(
    (lotsRaw ?? [])
      .filter((l: any) => l.status === "shuffling" || l.status === "pending")
      .map((l: any) => l.player_id)
  );
  const soldPlayerIds = new Set(
    (lotsRaw ?? []).filter((l: any) => l.status === "sold").map((l: any) => l.player_id)
  );

  return (playersRaw ?? [])
    .filter((p: any) => !activeLotPlayerIds.has(p.id) && !soldPlayerIds.has(p.id) && !p.is_unsold)
    .map((p: any, i: number) => ({
      id: i + 1,
      supabaseId: p.id,
      name: p.name,
      role: p.role,
      origin: p.origin,
      price: p.price,
      capped: p.capped,
      img: p.img ?? "",
      country: p.country ?? "",
      lotOrder: p.lot_order ?? null,
      ownerTeamCode: p.owner_team_code ?? undefined,
      isCaptain: !!p.owner_team_code,
      reentryCount: p.reentry_count ?? 0,
      isUnsoldFinal: p.is_unsold_final ?? false,
    }));
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// ─────────────────────────────────────────────────────────────────────────
// Deterministic "is this player a marquee lot" check. Stable across
// re-renders and across the whole simulation for a given player id (no
// schema changes, no extra DB column — just a cheap string hash bucketed
// into HEAVY_HITTER_FRACTION of the space). Using the player's own id as
// the seed means the same player is always classified the same way for the
// life of this auction run, but which ~10% of players end up "marquee" is
// effectively random from run to run.
// ─────────────────────────────────────────────────────────────────────────
function hashPlayerId(id: string | number): number {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function isHeavyHitter(playerId: string | number): boolean {
  return hashPlayerId(playerId) % 100 < HEAVY_HITTER_FRACTION * 100;
}

// ─────────────────────────────────────────────────────────────────────────
// "Bid must exceed current high bid" (or equivalent) is an EXPECTED race,
// not a real failure: it means the DB's current_bid moved between when the
// driver decided to raise and when placeBid actually landed — almost
// always because a real owner (or, at high speed, another in-flight
// driver tick) placed a bid in that same window. The right response is to
// recompute against the fresh price on the next tick, not to stop the
// simulation.
// ─────────────────────────────────────────────────────────────────────────
function isStaleBidError(err: unknown): boolean {
  const msg = (err as any)?.message ? String((err as any).message) : String(err ?? "");
  return /exceed/i.test(msg) && /(current|high)\s*bid/i.test(msg);
}

// Owner "hesitation" — instead of reacting to every ask the instant it's
// computed, a team that wants to raise waits a short, randomized
// "thinking" period before the bid is actually written. The delay grows
// with how far the ask runs past that team's current fair share per
// remaining slot (a team stretching its budget hesitates longer than one
// bidding comfortably within it) and shrinks for marquee/heavy-hitter lots
// (everyone already knows they want in, so those move fast). Because the
// bid is only ever placed once the hesitation elapses — reading the
// freshest possible lot state at that moment — this also naturally
// absorbs races against real concurrent owner bids instead of stacking
// stale writes on top of each other.
function decideHesitationMs(
  team: VirtualTeamState,
  askAmount: number,
  heavyHitter: boolean,
  speedMult: number
): number {
  const slotsRemaining = Math.max(team.slots - team.roster, 1);
  const fairSharePerSlot = team.purse / slotsRemaining;
  const overspendRatio = askAmount / Math.max(fairSharePerSlot, 1);
  const base = 350 + Math.min(overspendRatio, 3) * 700;
  const marqueeDiscount = heavyHitter ? 0.55 : 1;
  const jitter = 0.55 + Math.random() * 0.9;
  return Math.round(base * marqueeDiscount * jitter * speedMult);
}

// ─────────────────────────────────────────────────────────────────────────
// Virtual team bidder — decides whether a given team raises the bid on the
// current lot. Mirrors the eagerness heuristic from the old scripted
// simulator, but now feeds a REAL placeBid call instead of a local event.
// ─────────────────────────────────────────────────────────────────────────
interface VirtualTeamState {
  id: string;
  code: string;
  name: string;
  color: string;
  purse: number;
  roster: number;
  slots: number;
}

// Eagerness now scales against each team's remaining "fair share per empty
// slot" instead of its raw total purse. A team with 12 empty slots and
// 40,000 pts left has ~3,300 pts/slot to play with; asking it to pay 10,000
// for one lot should read as reckless overspend even though it can
// technically "afford" it in isolation. Marquee (heavy-hitter) lots get a
// flat bonus that lets bidding wars push meaningfully past fair share, up
// to whatever the price cap allows — everything else settles near a sane
// multiple of fair share so the purse actually lasts the whole auction.
function decideEagerness(team: VirtualTeamState, askAmount: number, heavyHitter: boolean): number {
  const slotsRemaining = Math.max(team.slots - team.roster, 1);
  const fillRatio = team.roster / Math.max(team.slots, 1);
  const fairSharePerSlot = team.purse / slotsRemaining;
  const overspendRatio = askAmount / Math.max(fairSharePerSlot, 1);
  const heavyBonus = heavyHitter ? 0.9 : 0;
  return (
    (1 - fillRatio) * 0.75 -
    (overspendRatio - 1) * 1.1 +
    heavyBonus +
    (Math.random() - 0.35) * 0.6
  );
}

// A team may only raise if, after paying askAmount, what's left is still
// enough to cover its remaining slots at a sane reserve-per-slot — where
// "sane" is half of the team's current fair share per remaining slot,
// floored at the tier's bid increment. This is what actually stops a
// purse-rich team early in the auction from blowing 3-4x its sustainable
// per-player budget on a single lot and then being unable to fill its
// roster later.
function canTeamAfford(team: VirtualTeamState, askAmount: number, minStep: number): boolean {
  if (askAmount > team.purse) return false;

  const slotsRemainingBeforeThis = Math.max(team.slots - team.roster, 1); // includes this lot
  const slotsLeftAfter = slotsRemainingBeforeThis - 1;
  if (slotsLeftAfter <= 0) return true;

  const purseAfter = team.purse - askAmount;
  const fairSharePerSlot = team.purse / slotsRemainingBeforeThis;
  const reservePerSlot = Math.max(minStep, fairSharePerSlot * 0.5);
  return purseAfter >= slotsLeftAfter * reservePerSlot;
}

// ─────────────────────────────────────────────────────────────────────────
// Page content
// ─────────────────────────────────────────────────────────────────────────

function DriverContent({ auctionId }: { auctionId: string }) {
  const { auction, loadFromDb, handleStop, shuffleReady, handleShuffle } = useAuction();
  const { shotClock, isLocked, resetClock, freezeClock, pauseClock } = useShotClock();

  const [loading, setLoading] = useState(true);
  const [currentLot, setCurrentLot] = useState<AuctionLot | null>(null);
  const [bidHistory, setBidHistory] = useState<BidEntry[]>([]);
  const [completedLots, setCompletedLots] = useState<AuctionLot[]>([]);
  const [lotNumber, setLotNumber] = useState(0);
  const [teamPurses, setTeamPurses] = useState<Record<string, TeamPurse>>({});
  const [playerQueue, setPlayerQueue] = useState<Player[]>([]);
  const [pendingUnsoldCount, setPendingUnsoldCount] = useState(0);
  const [roundInfo, setRoundInfo] = useState<{ current: number; limit: number }>({ current: 0, limit: 0 });

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>("normal");
  const [driverStatus, setDriverStatus] = useState<string>("Idle");
  const [driverError, setDriverError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // ── Right panel flip ────────────────────────────────────────────────────
  // "teams" = live franchise purses/rosters (existing view).
  // "kpis"  = sold/unsold/pending totals + per-lot assignment breakdown,
  // computed straight from completedLots/playerQueue so it can never drift
  // from what the center feed and left queue already show.
  const [rightPanelView, setRightPanelView] = useState<"teams" | "kpis">("teams");
  const [isResetting, setIsResetting] = useState(false);

  // ── Per-player price cap ────────────────────────────────────────────────
  // Hard ceiling on how high the simulated bidding war can drive any single
  // lot. Seeded with a sensible default once the auction's rules are known,
  // but stays editable in the header at any time.
  const [maxBidCap, setMaxBidCap] = useState<number | null>(null);
  const maxBidCapRef = useRef<number | null>(null);
  useEffect(() => { maxBidCapRef.current = maxBidCap; }, [maxBidCap]);

  useEffect(() => {
    if (auction && maxBidCap === null) {
      const suggested = Math.max(
        auction.rules.basePrice * 10,
        Math.round(auction.rules.totalPoints * 0.2)
      );
      setMaxBidCap(suggested);
    }
  }, [auction, maxBidCap]);

  // Refs mirror state for use inside the async driver loop without stale
  // closures — same pattern the real live page uses.
  const currentLotRef = useRef(currentLot);
  const bidHistoryRef = useRef(bidHistory);
  const playerQueueRef = useRef(playerQueue);
  const teamPursesRef = useRef(teamPurses);
  const pendingUnsoldRef = useRef(pendingUnsoldCount);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const drivingRef = useRef(false); // true while a driver step is in flight

  // ── Shuffle-retry guard ─────────────────────────────────────────────────
  // Counts consecutive driver ticks spent trying to get shuffleReady to
  // flip to true. Without a cap here, a stale/never-updating shuffleReady
  // flag (e.g. because handleShuffle() doesn't refresh AuctionContext, or
  // silently no-ops) makes the driver call handleShuffle() again and again
  // every tick forever, with the UI stuck on "Shuffling lot order…" and no
  // error ever surfaced. Resets to 0 the instant shuffleReady is true.
  const shuffleAttemptsRef = useRef(0);

  // Tracks an in-progress owner "hesitation" — a lot we've already decided
  // to raise on but are deliberately waiting out before writing the bid.
  // Keyed by lot id so a new lot (or the lot closing) always starts fresh.
  const pendingBidDecisionRef = useRef<{ lotId: string; readyAt: number } | null>(null);

  useEffect(() => { currentLotRef.current = currentLot; }, [currentLot]);
  useEffect(() => { bidHistoryRef.current = bidHistory; }, [bidHistory]);
  useEffect(() => { playerQueueRef.current = playerQueue; }, [playerQueue]);
  useEffect(() => { teamPursesRef.current = teamPurses; }, [teamPurses]);
  useEffect(() => { pendingUnsoldRef.current = pendingUnsoldCount; }, [pendingUnsoldCount]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const getCurrentLotId = useCallback(() => currentLotRef.current?.id ?? null, []);

  const refreshReentryStatus = useCallback(async () => {
    try {
      const [pending, round] = await Promise.all([
        countPendingUnsold(auctionId),
        getCurrentRound(auctionId),
      ]);
      setPendingUnsoldCount(pending);
      setRoundInfo(round);
    } catch (err) {
      console.error("[simulate] failed to refresh reentry status:", err);
    }
  }, [auctionId]);

  // ── Hydrate context ────────────────────────────────────────────────────
  useEffect(() => {
    if (!auction?.auctionId || auction.auctionId !== auctionId) {
      loadFromDb(auctionId).catch(console.error);
    }
  }, [auctionId, auction?.auctionId, loadFromDb]);

  // ── Load live state — extracted so both initial mount AND a reset can
  // re-run exactly the same hydration logic. ─────────────────────────────
  const loadLiveData = useCallback(async () => {
    if (!auction?.auctionId) return;
    const purses = await ensureTeamPurses(auctionId, auction.teams, auction.rules.totalPoints);
    setTeamPurses(purses);

    const liveData = await loadLiveState(auctionId);
    setCurrentLot(liveData.currentLot);
    setBidHistory(liveData.bidHistory);
    setCompletedLots(liveData.completedLots);
    setLotNumber(liveData.lotNumber);

    if (liveData.currentLot?.status === "pending") {
      const anchor = liveData.bidHistory[0]?.placedAt ?? liveData.currentLot.startedAt;
      resetClock(anchor);
    } else {
      pauseClock();
    }

    const queue = await fetchPlayerQueue(auctionId);
    setPlayerQueue(queue);
    await refreshReentryStatus();
  }, [auction?.auctionId, auction?.teams, auction?.rules, auctionId, resetClock, pauseClock, refreshReentryStatus]);

  useEffect(() => {
    if (!auction?.auctionId) return;
    loadLiveData()
      .then(() => setLoading(false))
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auction?.auctionId]);

  // ── Realtime subscriptions — identical wiring to the real console, so
  // the UI reflects the true DB state as the driver writes to it. ─────────
  useEffect(() => {
    if (!auction?.auctionId) return;

    const lotSub = subscribeToLot(auctionId, (lot) => {
      const isNewLot = currentLotRef.current?.id !== lot.id;
      setCurrentLot(lot);

      if (lot.status === "shuffling") {
        if (isNewLot) {
          setPlayerQueue((prev) => prev.filter((p) => p.supabaseId !== lot.playerId));
          setBidHistory([]);
        }
        pauseClock();
        return;
      }

      if (lot.status === "pending") {
        if (isNewLot) {
          setPlayerQueue((prev) => prev.filter((p) => p.supabaseId !== lot.playerId));
          setBidHistory([]);
        }
        resetClock(lot.startedAt ?? undefined);
        return;
      }
      if (lot.status === "sold" || lot.status === "unsold") {
        freezeClock();
        setCompletedLots((prev) => (prev.some((l) => l.id === lot.id) ? prev : [lot, ...prev]));
        if (lot.status === "unsold") {
          refreshReentryStatus();
          fetchPlayerQueue(auctionId).then(setPlayerQueue).catch(console.error);
        }
      }
    }, getCurrentLotId);

    const bidSub = subscribeToBids(auctionId, (bid) => {
      if (bid.lotId !== currentLotRef.current?.id) return;
      setBidHistory((prev) => {
        // If the top of the feed is our own optimistic placeholder for this
        // exact bid (same team, same amount), replace it with the confirmed
        // real row instead of stacking a duplicate line.
        const top = prev[0];
        if (top && String(top.id).startsWith("optimistic-") && top.teamId === bid.teamId && top.amount === bid.amount) {
          return [bid, ...prev.slice(1)].slice(0, 30);
        }
        return [bid, ...prev].slice(0, 30);
      });
      setCurrentLot((prev) =>
        prev ? { ...prev, currentBid: bid.amount, winningTeamCode: bid.teamCode, winningTeamId: bid.teamId } : prev
      );
      resetClock(bid.placedAt, true);
    });

    const purseSub = subscribeToTeamPurses(auctionId, (teamId, remaining, roster) => {
      setTeamPurses((prev) => ({ ...prev, [teamId]: { remaining, roster } }));
    });

    return () => {
      lotSub.unsubscribe();
      bidSub.unsubscribe();
      purseSub.unsubscribe();
    };
  }, [auctionId, auction?.auctionId, getCurrentLotId, resetClock, freezeClock, pauseClock, refreshReentryStatus]);

  // ── Build the current list of virtual team states from live purses ─────
  function getVirtualTeams(): VirtualTeamState[] {
    if (!auction) return [];
    return auction.teams
      .filter((t) => !!t.supabaseId)
      .map((t) => {
        const purse = teamPursesRef.current[t.supabaseId!];
        return {
          id: t.supabaseId!,
          code: t.code,
          name: t.name,
          color: t.color || "#c9971f",
          purse: purse?.remaining ?? auction.rules.totalPoints,
          roster: purse?.roster ?? t.roster ?? 0,
          slots: auction.rules.teamSize,
        };
      });
  }

  // ── One atomic driver action. Called repeatedly by the play loop, or
  // once per click of "Step". Each call performs exactly ONE real DB
  // write (reveal a lot / open a lot / place one bid / close a lot / start
  // a re-entry round) so playback is inspectable and resumable. ───────────
  const driverStep = useCallback(async (): Promise<boolean> => {
    if (!auction || drivingRef.current) return false;
    drivingRef.current = true;
    try {
      const lot = currentLotRef.current;
      const tiers = auction.rules.tiers ?? [];
      const minStep = tiers?.[0]?.increment ?? Math.max(Math.round(auction.rules.totalPoints * 0.004), 100);

      // 1. No open lot — either open the next one, run a re-entry round,
      //    or finish.
      if (!lot || lot.status === "sold" || lot.status === "unsold") {
        // Check shuffle status FIRST, before concluding the queue is
        // empty. fetchPlayerQueue only returns players that already have a
        // lot_order assigned — right after a reset (or before the very
        // first shuffle), every eligible player has lot_order = null, so
        // the queue looks identical to "no players left" even though
        // there are plenty of players waiting to be shuffled in. Checking
        // shuffleReady first — and refetching the queue once the shuffle
        // completes — avoids mistaking "not shuffled yet" for "finished".
        if (!shuffleReady) {
          // Guard against spinning forever: if shuffleReady stays false
          // after several consecutive attempts to shuffle, stop driving
          // and surface an actionable error instead of leaving the UI
          // stuck on "Shuffling lot order…" indefinitely. This is almost
          // always because handleShuffle() writes lot_order to the DB but
          // AuctionContext's in-memory player list (which shuffleReady is
          // derived from) never gets refreshed to reflect it.
          if (shuffleAttemptsRef.current >= MAX_SHUFFLE_ATTEMPTS) {
            shuffleAttemptsRef.current = 0;
            setDriverError(
              "Shuffle isn't completing — lot_order never got picked up as ready. " +
              "Check that handleShuffle() refreshes AuctionContext (loadFromDb) after writing lot_order."
            );
            setDriverStatus("Stalled — shuffle never became ready.");
            setPlaying(false);
            return false;
          }

          shuffleAttemptsRef.current += 1;
          setDriverStatus(
            shuffleAttemptsRef.current === 1
              ? "Shuffling lot order…"
              : `Shuffling lot order… (retry ${shuffleAttemptsRef.current}/${MAX_SHUFFLE_ATTEMPTS})`
          );

          // handleShuffle() already writes lot_order via shufflePlayerOrder,
          // updates auction.players with the fresh values, AND explicitly
          // recomputes shuffleReady in-memory before it resolves (see
          // AuctionContext.handleShuffle) — no extra DB round-trip is
          // needed here. Do NOT call loadFromDb() after this: an extra
          // loadAuction() fetch immediately after the write can race the
          // write (replica lag / read-after-write) and come back with
          // stale lot_order data, overwriting the correct state
          // handleShuffle() just set and permanently un-flipping
          // shuffleReady back to false.
          await handleShuffle();

          const queue = await fetchPlayerQueue(auctionId);
          setPlayerQueue(queue);
          return true;
        }

        // shuffleReady is true — clear the retry counter for next time.
        shuffleAttemptsRef.current = 0;

        if (playerQueueRef.current.length === 0) {
          if (pendingUnsoldRef.current > 0) {
            setDriverStatus("Starting re-entry round…");
            const result = await startReentryRound(auctionId, {
              unsoldReentryRounds: auction.rules.unsoldReentryRounds,
              teamSize: auction.rules.teamSize,
            });
            const queue = await fetchPlayerQueue(auctionId);
            setPlayerQueue(queue);
            await refreshReentryStatus();
            if (!result.started) {
              setDriverStatus("No further re-entry possible — simulation complete.");
              setFinished(true);
              return false;
            }
            return true;
          }
          setDriverStatus("Queue empty — simulation complete.");
          setFinished(true);
          return false;
        }

        setDriverStatus("Opening next lot…");
        const newLot = await startRandomLot(auctionId);
        setLotNumber(newLot.lotNumber);
        return true;
      }

      // 1b. Lot is mid-reveal ("shuffling"). The real fallback timer inside
      //     _startLot would eventually flip this to "pending" on its own
      //     (~5s), but a driven simulation shouldn't sit through dead air
      //     on every single lot, so we transition it ourselves.
      //     completeLotReveal is idempotent (guarded on status="shuffling"
      //     with a safe fetch-back on PGRST116), so this can't double-fire
      //     even if the DB-side fallback wins the race.
      if (lot.status === "shuffling") {
        setDriverStatus("Revealing player on broadcast…");
        await completeLotReveal(lot.id);
        return true;
      }

      // 2. Lot is pending — decide the next virtual bid, or close it.
      if (lot.status === "pending") {
        const now = Date.now();
        const pending = pendingBidDecisionRef.current;

        // Still "thinking" from an earlier tick on this same lot — take no
        // action this tick. This is what actually fixes the stale-bid
        // race: we deliberately don't write anything until the hesitation
        // elapses, and then we act on whatever currentLotRef looks like
        // AT THAT MOMENT (updated live by the bid/lot subscriptions),
        // rather than on a price that was already a beat old when we first
        // decided to raise.
        if (pending && pending.lotId === lot.id && now < pending.readyAt) {
          return true;
        }
        const hesitationJustElapsed = !!(pending && pending.lotId === lot.id && now >= pending.readyAt);
        pendingBidDecisionRef.current = null;

        const teams = getVirtualTeams();
        const askAmount = getNextBidAmount(lot.currentBid, tiers);
        const heavyHitter = isHeavyHitter(lot.playerId);

        // Hard per-player price ceiling — once the next required bid would
        // cross it, no virtual team may raise any further, regardless of
        // purse/roster room.
        const cap = maxBidCapRef.current;
        const capReached = cap != null && askAmount > cap;

        const eligible = capReached
          ? []
          : teams.filter(
              (t) =>
                t.roster < t.slots &&
                t.id !== lot.winningTeamId &&
                canTeamAfford(t, askAmount, minStep)
            );

        if (eligible.length === 0) {
          // Closing the lot is the auctioneer's hammer, not an owner
          // decision — no hesitation needed here.
          if (lot.winningTeamId) {
            setDriverStatus(
              capReached
                ? `Price cap (${fmtPts(cap!)} pts) reached — hammering sold to ${lot.winningTeamCode}…`
                : `Hammering sold to ${lot.winningTeamCode}…`
            );
            await closeLotSold(lot.id, auctionId, lot.playerId, lot.winningTeamId, lot.currentBid);
          } else {
            setDriverStatus(
              capReached
                ? `Price cap (${fmtPts(cap!)} pts) reached before any bids — marking unsold…`
                : "No bids — marking unsold…"
            );
            await closeLotUnsold(lot.id, lot.playerId);
          }
          return true;
        }

        // Pick the most "eager" eligible team to place the next raise.
        let best: VirtualTeamState | null = null;
        let bestScore = -Infinity;
        for (const t of eligible) {
          const score = decideEagerness(t, askAmount, heavyHitter);
          if (score > bestScore) {
            bestScore = score;
            best = t;
          }
        }

        // Below-threshold: nobody wants to raise further → close the lot.
        if (!best || (lot.winningTeamId && bestScore <= 0.1)) {
          if (lot.winningTeamId) {
            setDriverStatus(`Hammering sold to ${lot.winningTeamCode}…`);
            await closeLotSold(lot.id, auctionId, lot.playerId, lot.winningTeamId, lot.currentBid);
          } else if (best) {
            // Nobody has bid yet — force the first bid through (still
            // subject to hesitation below) so the lot doesn't stall
            // forever.
          } else {
            setDriverStatus("No bids — marking unsold…");
            await closeLotUnsold(lot.id, lot.playerId);
            return true;
          }
        }

        const bidder = best!;

        if (!hesitationJustElapsed) {
          // First time we've landed on this exact decision — make the
          // owner think it over before committing, instead of firing the
          // bid the instant it's technically their turn.
          const hesitationMs = decideHesitationMs(bidder, askAmount, heavyHitter, SPEED_MULT[speedRef.current]);
          pendingBidDecisionRef.current = { lotId: lot.id, readyAt: now + hesitationMs };
          setDriverStatus(`${bidder.code} weighing ${fmtPts(askAmount)}…`);
          return true;
        }

        // Hesitation elapsed — commit for real, against the freshest state.
        setDriverStatus(`${bidder.code} bids ${fmtPts(askAmount)}…`);
        await placeBid(lot.id, auctionId, bidder.id, bidder.code, bidder.name, bidder.color, askAmount);
        return true;
      }

      return false;
    } catch (err: any) {
      pendingBidDecisionRef.current = null;

      if (isStaleBidError(err)) {
        // Expected race with a real concurrent bid — never pause the sim
        // for this. Drop the stale decision and let the next tick
        // re-evaluate against the (already-updated-via-subscription)
        // current price.
        setDriverStatus("Bid overtaken by a live owner — recalculating…");
        return true;
      }

      // Any other write error: surface it in the banner, but the
      // simulation should keep running rather than silently stopping —
      // pausing on every hiccup means someone has to notice and manually
      // hit Play again, which defeats the point of an unattended driver.
      // Resync from the DB first so the next tick works off ground-truth
      // state instead of repeating whatever produced the error.
      setDriverError(err?.message ?? "Driver step failed");
      setTimeout(() => setDriverError(null), 5000);
      try {
        const fresh = await loadLiveState(auctionId);
        currentLotRef.current = fresh.currentLot;
        setCurrentLot(fresh.currentLot);
        setBidHistory(fresh.bidHistory);
        setCompletedLots(fresh.completedLots);
        setLotNumber(fresh.lotNumber);
      } catch (resyncErr) {
        console.error("[simulate] resync after driver error failed:", resyncErr);
      }
      return true;
    } finally {
      drivingRef.current = false;
    }
  }, [auction, auctionId, shuffleReady, handleShuffle, refreshReentryStatus]);

  // ── Play loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;

    async function loop() {
      while (!cancelled && playingRef.current) {
        const cont = await driverStep();
        if (cancelled) return;
        if (!cont) {
          setPlaying(false);
          return;
        }
        await sleep(650 * SPEED_MULT[speedRef.current]);
      }
    }
    loop();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  async function handleStep() {
    if (playing) return;
    await driverStep();
  }

  async function handleEndSimulation() {
    setPlaying(false);
    await handleStop();
    setFinished(true);
  }

  // ── Wipe everything this simulator (or a real run) has written, and put
  // the auction back to a fresh, biddable state — reusing the exact same
  // primitives the real setup/launch flow uses (resetAuctionInDb +
  // assignCaptains) instead of hand-rolling the reset here. This also
  // avoids referencing columns (is_captain, status) that don't actually
  // exist on `players` — captains are identified purely by
  // owner_team_code, and there is no `status` column in this schema.
  // ─────────────────────────────────────────────────────────────────────
  async function resetAuctionData() {
    if (!auction) throw new Error("Auction not loaded — cannot reset");

    // 1. Atomic DB-side reset: wipes bid_history / auction_lots / feedback,
    //    restores players' sold/lot/unsold/reentry fields, zeroes team
    //    roster/remaining_purse, resets rules.current_round, and drops the
    //    auction back to "setup".
    await resetAuctionInDb(auctionId);

    // 2. Re-run captain auto-assignment exactly as saveFullAuctionAndLaunch
    //    does at first launch — captains get deducted from and rostered
    //    onto their own team again, since step 1 wiped that along with
    //    everything else.
    await assignCaptains(auctionId, auction.rules.ownerSelfPurchaseCost);

    // 3. Bring the auction back to "live" so this simulator (and any real
    //    owner/spectator tabs) can keep bidding immediately, without a trip
    //    back through the setup wizard.
    await updateAuctionStatus(auctionId, "live", {
      launched_at: new Date().toISOString(),
    });
  }

  async function handleConfirmReset() {
    setIsResetting(true);
    setDriverError(null);
    try {
      setPlaying(false);
      pendingBidDecisionRef.current = null;
      shuffleAttemptsRef.current = 0;
      await resetAuctionData();

      // Refresh the shared AuctionContext (teams/players/rules) — this is
      // what shuffleReady is derived from. Without this, the context keeps
      // showing pre-reset player data (old lot_order values still set), so
      // shuffleReady stays stuck on "true" even though the reset just
      // cleared every player's lot_order in the DB. That mismatch is what
      // made the driver think the queue was legitimately empty right after
      // a reset instead of just "not shuffled yet".
      await loadFromDb(auctionId);

      // Rehydrate everything from scratch, same as a fresh page load.
      setCurrentLot(null);
      setBidHistory([]);
      setCompletedLots([]);
      setLotNumber(0);
      setPendingUnsoldCount(0);
      setRoundInfo({ current: 0, limit: 0 });
      setFinished(false);
      setDriverStatus("Idle");
      pauseClock();

      await loadLiveData();
    } catch (err: any) {
      setDriverError(err?.message ?? "Reset failed — check the console for details");
      setTimeout(() => setDriverError(null), 6000);
    } finally {
      setIsResetting(false);
      setShowResetConfirm(false);
    }
  }

  if (!auction || loading) {
    return (
      <div className="h-screen bg-surface-container-lowest flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-theme-orange animate-spin block mb-4" style={{ fontSize: 48 }}>
            progress_activity
          </span>
          <p className="font-mono-geist text-[12px] uppercase tracking-[0.12em] text-on-surface-variant">
            Loading live auction data…
          </p>
        </div>
      </div>
    );
  }

  const isShuffling = currentLot?.status === "shuffling";
  const isPending = currentLot?.status === "pending";
  const isSold = currentLot?.status === "sold";
  const isUnsold = currentLot?.status === "unsold";
  const currentLotIsHeavyHitter = currentLot ? isHeavyHitter(currentLot.playerId) : false;

  return (
    <div className="bg-background text-on-background h-screen flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Inter:wght@400;500;700&family=Geist+Mono:wght@400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .font-archivo    { font-family: 'Archivo Narrow', sans-serif; }
        .font-mono-geist { font-family: 'Geist Mono', monospace; }
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          font-style: normal; line-height: 1; display: inline-block;
        }
        .glass-panel {
          background: var(--color-surface-glass, rgba(255,255,255,0.03));
          backdrop-filter: blur(20px);
          border: 1px solid var(--color-border-overlay, rgba(255,255,255,0.08));
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>


      {driverError && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold"
          style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171", fontFamily: "'Geist Mono', monospace", backdropFilter: "blur(12px)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
          {driverError}
        </div>
      )}

      {/* ══════════ TOP BAR ══════════ */}
      <header className="shrink-0 flex flex-wrap gap-4 justify-between items-center px-6 h-16 glass-panel border-b border-white/10">
        <div className="flex items-center gap-4">
          <h1 className="font-archivo text-2xl font-bold italic uppercase tracking-tight text-theme-orange">
            {auction.session.auctionName}
          </h1>
         
          {roundInfo.current > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-400/10 border border-indigo-400/20 rounded-full">
              <span className="material-symbols-outlined text-indigo-300 text-sm">autorenew</span>
              <span className="font-mono-geist text-[10px] text-indigo-300 uppercase font-bold tracking-[0.14em]">
                Re-entry Round {roundInfo.current}/{roundInfo.limit}
              </span>
            </div>
          )}
          <div className="font-mono-geist text-[10px] text-right">
            <div className="text-on-surface-variant uppercase tracking-[0.1em]">Lot</div>
            <div className="text-theme-orange font-bold">#{lotNumber} / {auction.players.length}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Max per-player price cap */}
          <div className="flex items-center gap-1.5 mr-2 px-3 py-1.5 rounded bg-red-500/[0.06] border border-red-500/20"
            title="Hard ceiling — no simulated bid will push a lot's price above this">
            <span className="material-symbols-outlined text-red-400" style={{ fontSize: 14 }}>vertical_align_top</span>
            <label className="font-mono-geist text-[9px] text-red-400 uppercase tracking-[0.1em]">Price Cap</label>
            <input
              type="number"
              min={auction.rules.basePrice}
              step={100}
              value={maxBidCap ?? ""}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setMaxBidCap(Number.isFinite(v) ? Math.max(v, auction.rules.basePrice) : null);
              }}
              className="w-20 bg-transparent font-mono-geist text-[11px] text-red-300 font-bold outline-none"
            />
            <span className="font-mono-geist text-[9px] text-red-400/70">pts</span>
          </div>

          <div className="flex items-center gap-1 mr-2">
            {(["slow", "normal", "fast"] as Speed[]).map((s) => (
              <button key={s} onClick={() => setSpeed(s)}
                className={`px-2.5 py-1.5 rounded font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] transition-all ${
                  speed === s ? "bg-theme-orange text-[#1a1304]" : "bg-white/5 text-on-surface-variant hover:bg-white/10"
                }`}>
                {s}
              </button>
            ))}
          </div>

          <button onClick={handleStep} disabled={playing || finished}
            className="flex items-center gap-1 px-4 py-2 rounded font-mono-geist text-[10px] font-bold uppercase tracking-[0.16em] bg-surface-variant text-on-surface-variant border border-white/10 hover:bg-white/10 disabled:opacity-40">
            <span className="material-symbols-outlined text-sm">skip_next</span>
            Step
          </button>

          <button onClick={() => setPlaying((p) => !p)} disabled={finished}
            className="flex items-center gap-2 px-5 py-2 rounded font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 shadow-lg"
            style={{ background: "linear-gradient(135deg,#A87815,#E8C468)", color: "#1a1304" }}>
            <span className="material-symbols-outlined text-sm">{playing ? "pause" : "play_arrow"}</span>
            {finished ? "Complete" : playing ? "Pause" : "Play"}
          </button>

          <button onClick={handleEndSimulation}
            className="flex items-center gap-1 px-4 py-2 rounded font-mono-geist text-[10px] font-bold uppercase tracking-[0.16em] bg-error-container text-on-error-container border border-white/10 hover:brightness-110">
            <span className="material-symbols-outlined text-sm">stop_circle</span>
            End Simulation
          </button>

          <button onClick={() => { setPlaying(false); setShowResetConfirm(true); }}
            className="flex items-center gap-1 px-4 py-2 rounded font-mono-geist text-[10px] font-bold uppercase tracking-[0.16em] bg-red-950/40 text-red-400 border border-red-500/30 hover:bg-red-900/40">
            <span className="material-symbols-outlined text-sm">delete_forever</span>
            Reset Auction
          </button>
        </div>
      </header>

      <div className="shrink-0 px-6 py-1.5 font-mono-geist text-[10px] text-on-surface-variant uppercase tracking-[0.1em] border-b border-white/5">
        {driverStatus}
      </div>

      <main className="flex-1 min-h-0 grid grid-cols-[20%_55%_25%]">
        {/* ══════════ LEFT: Queue ══════════ */}
        <aside className="hidden xl:flex flex-col h-full bg-surface-container-lowest border-r border-outline-variant shrink-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-outline-variant">
            <div className="flex justify-between items-center">
              <h3 className="font-mono-geist text-xs text-black/50 uppercase font-bold tracking-[0.2em]">Remaining Pool</h3>
              <span className="bg-surface-variant px-2 py-0.5 rounded font-mono-geist text-[10px] font-bold tracking-widest">
                {playerQueue.length} PENDING
              </span>
            </div>
            {pendingUnsoldCount > 0 && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <span className="material-symbols-outlined text-indigo-300 text-sm">hourglass_top</span>
                <span className="font-mono-geist text-[10px] text-indigo-300 uppercase tracking-[0.1em]">
                  {pendingUnsoldCount} awaiting re-entry
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
            {playerQueue.map((p) => (
              <div key={p.supabaseId ?? p.id} className="p-3 hover:bg-white/5 rounded transition-all flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-lg">person</span>
                <div className="flex-1">
                  <p className="font-archivo text-xs font-bold uppercase text-on-surface-variant">{p.name}</p>
                  <p className="font-mono-geist text-[9px] text-on-surface-variant">{p.role} | {p.country}</p>
                </div>
                {p.supabaseId != null && isHeavyHitter(p.supabaseId) && (
                  <span className="material-symbols-outlined text-theme-orange text-sm" title="Marquee player — expect a real bidding war">
                    local_fire_department
                  </span>
                )}
              </div>
            ))}
            {playerQueue.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-2">check_circle</span>
                <p className="font-mono-geist text-xs text-on-surface-variant uppercase tracking-widest">All players called</p>
              </div>
            )}
          </div>
        </aside>

        {/* ══════════ CENTER ══════════ */}
        <section className="flex flex-col h-full p-4 gap-4 overflow-hidden">
          <div className="glass-panel rounded-2xl flex flex-col md:flex-row relative overflow-hidden p-4 gap-4 items-start">
            <div className="relative">
              <div className="w-56 h-56 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl relative bg-surface-container">
                {currentLot?.playerImg && !isShuffling ? (
                  <Image alt={currentLot.playerName} src={currentLot.playerImg} width={224} height={224}
                    className="w-full h-full object-cover object-top grayscale-[0.2]" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className={`material-symbols-outlined text-outline-variant ${isShuffling ? "animate-spin" : ""}`} style={{ fontSize: 64 }}>
                      {isShuffling ? "autorenew" : "person"}
                    </span>
                  </div>
                )}
                {currentLot && (
                  <div className="absolute top-2 right-2 bg-white text-black px-2 py-1 rounded font-mono-geist text-[10px] font-bold tracking-[0.32em] shadow-lg">
                    LOT #{currentLot.lotNumber}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <span className="font-mono-geist text-xs tracking-[0.3em] uppercase font-bold block text-theme-orange">
                {!currentLot ? "Awaiting First Lot" : isShuffling ? "Revealing…" : isSold ? "Sold" : isUnsold ? "Marked Unsold" : "Currently on Block"}
              </span>
              <h2 className="font-archivo text-4xl text-white tracking-tight font-bold italic uppercase">
                {isShuffling ? "???" : (currentLot?.playerName ?? "—")}
              </h2>
              {currentLot && !isShuffling && (
                <div className="flex gap-3 items-center flex-wrap">
                  <span className="px-3 py-1 bg-white/10 rounded font-mono-geist text-[10px] uppercase tracking-[0.18em]">
                    {currentLot.playerRole} | {currentLot.playerCountry || "—"}
                  </span>
                  <span className="px-3 py-1 bg-white/10 rounded font-mono-geist text-[10px] uppercase tracking-[0.18em]">
                    Base: {fmtPts(currentLot.basePrice)} pts
                  </span>
                  {maxBidCap != null && (
                    <span className="px-3 py-1 bg-red-500/10 border border-red-500/25 rounded font-mono-geist text-[10px] uppercase tracking-[0.18em] text-red-400">
                      Cap: {fmtPts(maxBidCap)} pts
                    </span>
                  )}
                  {currentLotIsHeavyHitter && (
                    <span className="px-3 py-1 bg-theme-orange/15 border border-theme-orange/30 rounded font-mono-geist text-[10px] uppercase tracking-[0.18em] text-theme-orange flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>local_fire_department</span>
                      Marquee Player
                    </span>
                  )}
                </div>
              )}
              {currentLot && !isShuffling && (
                <div className="p-4 glass-panel rounded-xl mt-2">
                  <div className="flex items-end justify-between mb-1">
                    <div>
                      <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.18em] mb-1">Current Bid</p>
                      <p className="font-archivo text-3xl font-bold text-theme-orange">
                        {fmtPts(currentLot.currentBid)} <span className="text-sm opacity-50 ml-1">pts</span>
                      </p>
                    </div>
                    {currentLot.winningTeamCode && (
                      <div className="text-right">
                        <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.1em] mb-1">Leading</p>
                        <p className="font-archivo text-lg font-bold text-white">{currentLot.winningTeamCode}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bid feed */}
          <div className="flex-1 min-h-0 glass-panel rounded-2xl flex flex-col overflow-hidden bg-surface-container-lowest">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
              <h3 className="font-mono-geist text-xs text-on-surface uppercase flex items-center gap-3 font-bold tracking-[0.2em]">
                <span className="material-symbols-outlined text-theme-orange text-lg">monitoring</span>
                Live Bidding Feed
              </h3>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2">
              {bidHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <span className="material-symbols-outlined text-on-surface-variant text-3xl mb-2">history</span>
                  <p className="font-mono-geist text-[10px] text-on-surface-variant uppercase tracking-widest">No bids yet</p>
                </div>
              ) : (
                <table className="w-full text-left border-separate border-spacing-y-2">
                  <thead className="sticky top-0 bg-surface-container-lowest/80 backdrop-blur-sm font-mono-geist text-[10px] text-on-surface-variant uppercase font-bold tracking-[0.1em]">
                    <tr>
                      <th className="px-6 py-3">Franchise</th>
                      <th className="px-6 py-3">Bid Amount</th>
                      <th className="px-6 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono-geist text-xs">
                    {bidHistory.map((b, i) => (
                      <tr key={b.id} className="group hover:bg-white/5 transition-all text-on-surface-variant">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.teamColor || "#888" }} />
                            <span className="font-archivo font-semibold">{b.teamName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 font-archivo font-semibold text-theme-orange">{fmtPts(b.amount)} pts</td>
                        <td className="px-6 py-3 text-right opacity-40 italic font-inter text-[10px]">{i === 0 ? "Leading" : "Outbid"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>

        {/* ══════════ RIGHT: Teams ══════════ */}
        <aside className="hidden lg:flex flex-col h-full bg-surface-container-low border-l border-outline-variant shrink-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant">
            <h3 className="font-mono-geist text-xs text-on-surface-variant uppercase font-bold tracking-[0.2em]">Franchises (Live)</h3>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {auction.teams.map((team) => {
              const purse = team.supabaseId ? teamPurses[team.supabaseId] : null;
              const roster = purse?.roster ?? team.roster ?? 0;
              const remaining = purse?.remaining ?? auction.rules.totalPoints;
              const pctFilled = Math.round((remaining / Math.max(auction.rules.totalPoints, 1)) * 100);
              const isLeadingThisLot = currentLot?.winningTeamId === team.supabaseId && isPending;
              const slotsLeft = Math.max(auction.rules.teamSize - roster, 0);
              const fairSharePerSlot = slotsLeft > 0 ? Math.round(remaining / slotsLeft) : 0;

              return (
                <div key={team.supabaseId ?? team.id}
                  className={`p-4 glass-panel rounded-xl transition-all ${isLeadingThisLot ? "border-theme-orange/40" : ""}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold shadow-lg text-xs font-archivo overflow-hidden"
                        style={{ background: team.color || "#888", color: "#fff" }}>
                        {team.logo ? (
                          <Image src={team.logo} alt={team.code} className="w-full h-full object-cover" width={36} height={36} />
                        ) : team.code.slice(0, 2)}
                      </div>
                      <div>
                        <span className="block font-archivo text-sm font-bold text-on-surface uppercase leading-tight">{team.name}</span>
                        <span className="font-mono-geist text-[9px] text-on-surface-variant font-bold uppercase tracking-[0.1em]">
                          Squad {roster}/{auction.rules.teamSize}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between font-mono-geist text-[9px] uppercase tracking-[0.1em] font-bold mb-1.5">
                    <span className="text-on-surface-variant">Remaining</span>
                    <span className="font-archivo text-[12px] font-semibold text-on-surface">{fmtPts(remaining)} pts</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pctFilled}%`, background: "linear-gradient(90deg,#A87815,#E8C468)" }} />
                  </div>
                  {slotsLeft > 0 && (
                    <div className="flex justify-between font-mono-geist text-[8px] uppercase tracking-[0.1em] mt-1.5 text-on-surface-variant/70">
                      <span>Fair share / slot</span>
                      <span>{fmtPts(fairSharePerSlot)} pts</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </main>

      {/* Reset Auction Confirm Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !isResetting && setShowResetConfirm(false)} />
          <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl p-8 flex flex-col gap-6"
            style={{
              background: "var(--color-surface-container-lowest, #0f1210)",
              border: "1px solid rgba(239,68,68,0.3)",
              boxShadow: "0 0 80px rgba(239,68,68,0.15), 0 24px 64px rgba(0,0,0,0.6)",
            }}>
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <span className="material-symbols-outlined text-red-400" style={{ fontSize: 32 }}>delete_forever</span>
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="font-archivo text-2xl font-bold italic uppercase tracking-tight text-white">
                Reset This Auction?
              </h2>
              <p className="font-mono-geist text-[11px] text-on-surface-variant uppercase tracking-[0.12em] leading-relaxed">
                This permanently deletes ALL bids and lots, clears every team's<br />
                purse and roster, re-assigns captains, and returns every other<br />
                player to the unsold pool. This cannot be undone.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-center">
                <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.15em] mb-1">Lots To Wipe</p>
                <p className="font-archivo text-2xl font-bold text-white">{completedLots.length + (currentLot ? 1 : 0)}</p>
              </div>
              <div className="text-center">
                <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.15em] mb-1">Bids To Wipe</p>
                <p className="font-archivo text-2xl font-bold text-white">{bidHistory.length}+</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowResetConfirm(false)} disabled={isResetting}
                className="flex-1 py-3 rounded-xl font-mono-geist text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#a0aec0" }}>
                Cancel
              </button>
              <button onClick={handleConfirmReset} disabled={isResetting}
                className="flex-1 py-3 rounded-xl font-mono-geist text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #991b1b, #ef4444)", color: "#fff", boxShadow: "0 4px 24px rgba(239,68,68,0.3)" }}>
                {isResetting ? "Resetting…" : "Yes, Wipe It"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DriverWithClock({ auctionId }: { auctionId: string }) {
  const { auction } = useAuction();
  const timerSeconds = auction?.session?.timerSeconds ?? 15;
  return (
    <ShotClockProvider timerSeconds={timerSeconds}>
      <DriverContent auctionId={auctionId} />
    </ShotClockProvider>
  );
}

export default function SimulateAuctionPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = use(params);
  return (
    <RoleGate resolveOrgId={() => getOrgIdForAuction(auctionId)} allowedRoles={["auctioneer"]}>
      <AuctionProvider>
        <DriverWithClock auctionId={auctionId} />
      </AuctionProvider>
    </RoleGate>
  );
}