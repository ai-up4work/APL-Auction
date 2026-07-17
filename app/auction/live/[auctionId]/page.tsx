// app/auction/live/[auctionId]/page.tsx
"use client";

import React, { use, useCallback, useEffect, useRef, useState } from "react";
import { AuctionProvider, useAuction } from "@/context/AuctionContext";
import { ShotClockProvider, useShotClock } from "@/context/ShotClockContext";
import { AuctionStamp } from "@/components/AuctionStamp";
import { AuctionStatusGate } from "@/components/AuctionStatusGate";
import DesktopOnlyWrapper from "@/components/DesktopOnlyWrapper";
import {
  loadLiveState,
  closeLotSold,
  closeLotUnsold,
  subscribeToLot,
  subscribeToBids,
  subscribeToTeamPurses,
  getNextBidAmount,
  startRandomLot,
  startReentryRound,
  countPendingUnsold,
  getCurrentRound,
  type AuctionLot,
  type BidEntry,
} from "@/lib/auctionLiveDb";
import { ensureTeamPurses, fmtPts, type TeamPurse } from "@/lib/auctionLiveUtils";
import { supabase } from "@/lib/supabse";
import type { Player } from "@/types/auction";
import { FeedbackModal } from "@/components/FeedbackModal";

type SoldState = "pending" | "sold" | "unsold";

type Particle = {
  id:       number;
  tx:       number;
  ty:       number;
  color:    string;
  duration: number;
};

const PARTICLE_COLORS_SOLD   = ["#E8C468", "#A87815", "#FDECC8", "#ffffff"];
const PARTICLE_COLORS_UNSOLD = ["#718096", "#A0AEC0", "#CBD5E0", "#E2E8F0"];

let particleIdCtr = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Helper — re-fetch the live player queue from the DB.
// "Queue" = players not finalized as unsold, not currently flagged is_unsold
// (i.e. either never called, or already re-queued by a re-entry round), and
// not already sold or mid-lot.
// ─────────────────────────────────────────────────────────────────────────────
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
    .not("lot_order", "is", null)
    .order("lot_order", { ascending: true });

  const activeLotPlayerIds = new Set(
    (lotsRaw ?? [])
      .filter((l: any) => l.status === "shuffling" || l.status === "pending")
      .map((l: any) => l.player_id)
  );

  const soldPlayerIds = new Set(
    (lotsRaw ?? [])
      .filter((l: any) => l.status === "sold")
      .map((l: any) => l.player_id)
  );

  return (playersRaw ?? [])
    .filter(
      (p: any) =>
        !activeLotPlayerIds.has(p.id) &&
        !soldPlayerIds.has(p.id) &&
        !p.is_unsold
    )
    .map((p: any, i: number) => ({
      id:            i + 1,
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
      isCaptain:     !!p.owner_team_code,
      reentryCount:  p.reentry_count ?? 0,
      isUnsoldFinal: p.is_unsold_final ?? false,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER CONTENT
// ─────────────────────────────────────────────────────────────────────────────

function AuctioneerContent({ auctionId }: { auctionId: string }) {
  const {
    auction,
    loadFromDb,
    handleStop,
    handlePause,
    handleResume,
    shuffleReady,
    handleShuffle,
  } = useAuction();
  const { shotClock, isLocked, resetClock, freezeClock, pauseClock } = useShotClock();

  const [loading,         setLoading]         = useState(true);
  const [currentLot,      setCurrentLot]      = useState<AuctionLot | null>(null);
  const [bidHistory,      setBidHistory]      = useState<BidEntry[]>([]);
  const [completedLots,   setCompletedLots]   = useState<AuctionLot[]>([]);
  const [lotNumber,       setLotNumber]       = useState(0);
  const [teamPurses,      setTeamPurses]      = useState<Record<string, TeamPurse>>({});
  const [playerQueue,     setPlayerQueue]     = useState<Player[]>([]);

  const [soldState,       setSoldState]       = useState<SoldState>("pending");
  const [isShuffling,     setIsShuffling]     = useState(false);
  const [flashActive,     setFlashActive]     = useState(false);
  const [glowActive,      setGlowActive]      = useState(false);
  const [particles,       setParticles]       = useState<Particle[]>([]);
  const [actionError,     setActionError]     = useState<string | null>(null);
  const [isBusy,          setIsBusy]          = useState(false);
  const [isShufflingPool, setIsShufflingPool] = useState(false);
  const [showFeedback,    setShowFeedback]    = useState(false);
  const [feedbackTrigger, setFeedbackTrigger] = useState<"paused" | "completed">("completed");
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // ── Re-entry round state ──────────────────────────────────────────────────
  const [pendingUnsoldCount, setPendingUnsoldCount] = useState(0);
  const [roundInfo,          setRoundInfo]          = useState<{ current: number; limit: number }>({ current: 0, limit: 0 });
  const [isStartingRound,    setIsStartingRound]    = useState(false);
  const [roundToast,         setRoundToast]         = useState<string | null>(null);
  const [showReentryConfirm, setShowReentryConfirm] = useState(false);

  const flashTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentLotRef = useRef(currentLot);
  const auctionRef    = useRef(auction);
  useEffect(() => { currentLotRef.current = currentLot; }, [currentLot]);
  useEffect(() => { auctionRef.current    = auction;    }, [auction]);

  const getCurrentLotId = useCallback(
    () => currentLotRef.current?.id ?? null,
    []
  );

  // ── Step 1: hydrate context ───────────────────────────────────────────────
  useEffect(() => {
    if (!auction?.auctionId || auction.auctionId !== auctionId) {
      loadFromDb(auctionId).catch(console.error);
    }
  }, [auctionId, auction?.auctionId, loadFromDb]);

  // ── Refresh pending-unsold count + round info ────────────────────────────
  const refreshReentryStatus = useCallback(async () => {
    try {
      const [pending, round] = await Promise.all([
        countPendingUnsold(auctionId),
        getCurrentRound(auctionId),
      ]);
      setPendingUnsoldCount(pending);
      setRoundInfo(round);
    } catch (err) {
      console.error("[live] failed to refresh reentry status:", err);
    }
  }, [auctionId]);

  // ── Step 2: load live state once context is ready ─────────────────────────
  useEffect(() => {
    if (!auction?.auctionId) return;

    async function init() {
      const purses = await ensureTeamPurses(
        auctionId,
        auction.teams,
        auction.rules.totalPoints
      );
      setTeamPurses(purses);

      const liveData = await loadLiveState(auctionId);
      setCurrentLot(liveData.currentLot);
      setBidHistory(liveData.bidHistory);
      setCompletedLots(liveData.completedLots);
      setLotNumber(liveData.lotNumber);

      if (liveData.currentLot?.status === "shuffling") {
        setIsShuffling(true);
        pauseClock();
      } else if (liveData.currentLot?.status === "sold") {
        setSoldState("sold");
        freezeClock();
      } else if (liveData.currentLot?.status === "unsold") {
        setSoldState("unsold");
        freezeClock();
      } else if (liveData.currentLot) {
        const anchor = liveData.bidHistory[0]?.placedAt ?? liveData.currentLot.startedAt;
        resetClock(anchor);
      } else {
        pauseClock();
      }

      const queue = await fetchPlayerQueue(auctionId);
      setPlayerQueue(queue);

      await refreshReentryStatus();

      setLoading(false);
    }

    init().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auction?.auctionId]);

  // ── Realtime subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    if (!auction?.auctionId) return;

    const lotSub = subscribeToLot(auctionId, (lot) => {
      const isNewLot = currentLotRef.current?.id !== lot.id;
      setCurrentLot(lot);

      if (lot.status === "shuffling") {
        if (isNewLot) {
          setPlayerQueue((prev) => prev.filter((p) => p.supabaseId !== lot.playerId));
          setBidHistory([]);
          setSoldState("pending");
          setGlowActive(false);
        }
        setIsShuffling(true);
        pauseClock();
        return;
      }

      if (lot.status === "pending") {
        setIsShuffling(false);
        if (isNewLot || currentLotRef.current?.status === "shuffling") {
          resetClock(lot.startedAt ?? undefined);
        }
        setSoldState("pending");
        setGlowActive(false);
        return;
      }

      if (lot.status === "sold") {
        setIsShuffling(false);
        setSoldState("sold");
        setGlowActive(true);
        freezeClock();
        setCompletedLots((prev) =>
          prev.some((l) => l.id === lot.id) ? prev : [lot, ...prev]
        );
      }

      if (lot.status === "unsold") {
        setIsShuffling(false);
        setSoldState("unsold");
        freezeClock();
        setCompletedLots((prev) =>
          prev.some((l) => l.id === lot.id) ? prev : [lot, ...prev]
        );
        // Refresh the pending-unsold counter so the "Re-entry Round" button
        // appears as soon as this lot's player becomes eligible.
        refreshReentryStatus();
        // Also refresh the queue itself so showReentryButton's
        // playerQueue.length check reflects the true current state.
        fetchPlayerQueue(auctionId).then(setPlayerQueue).catch(console.error);
      }
    }, getCurrentLotId);

    const bidSub = subscribeToBids(auctionId, (bid) => {
      if (bid.lotId !== currentLotRef.current?.id) return;
      setBidHistory((prev) => [bid, ...prev].slice(0, 30));
      setCurrentLot((prev) =>
        prev
          ? { ...prev, currentBid: bid.amount, winningTeamCode: bid.teamCode, winningTeamId: bid.teamId }
          : prev
      );
      resetClock(bid.placedAt, true);
    });

    const purseSub = subscribeToTeamPurses(
      auctionId,
      (teamId, remaining, roster) => {
        setTeamPurses((prev) => ({ ...prev, [teamId]: { remaining, roster } }));
      }
    );

    return () => {
      lotSub.unsubscribe();
      bidSub.unsubscribe();
      purseSub.unsubscribe();
    };
  }, [auctionId, auction?.auctionId, getCurrentLotId, resetClock, freezeClock, pauseClock, refreshReentryStatus]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { if (flashTimeout.current) clearTimeout(flashTimeout.current); };
  }, []);

  // ── Particles ─────────────────────────────────────────────────────────────
  function spawnParticles(colors: string[]) {
    const created: Particle[] = Array.from({ length: 50 }, () => {
      const id       = particleIdCtr++;
      const tx       = (Math.random() - 0.5) * 1000;
      const ty       = (Math.random() - 0.5) * 1000;
      const duration = 1 + Math.random() * 1.5;
      const color    = colors[Math.floor(Math.random() * colors.length)];
      return { id, tx, ty, color, duration };
    });
    setParticles((prev) => [...prev, ...created]);
    created.forEach((p) => {
      setTimeout(
        () => setParticles((prev) => prev.filter((x) => x.id !== p.id)),
        p.duration * 1000
      );
    });
  }

  // ── Fix the pool ──────────────────────────────────────────────────────────
  async function handleFixShuffle() {
      if (isShufflingPool) return;
      setIsShufflingPool(true);
      setActionError(null);
      try {
        await handleShuffle();
      } catch (err: any) {
        setActionError(err?.message ?? "Shuffle failed — please try again");
        setTimeout(() => setActionError(null), 5000);
      } finally {
        setIsShufflingPool(false);
      }
    }

  // ── Unsold Re-entry Round ─────────────────────────────────────────────────
  function reasonToMessage(reason?: string, finalized?: number): string {
    const n = finalized ?? 0;
    switch (reason) {
      case "round_limit_reached":
        return `Re-entry round limit reached — ${n} player${n === 1 ? "" : "s"} marked Unsold (Final).`;
      case "all_squads_full":
        return `Every team's squad is full — ${n} player${n === 1 ? "" : "s"} marked Unsold (Final).`;
      case "no_team_can_afford":
        return `No team can afford the cheapest unsold player — ${n} player${n === 1 ? "" : "s"} marked Unsold (Final).`;
      case "no_unsold_players":
        return "No unsold players to re-enter.";
      default:
        return "Re-entry round could not be started.";
    }
  }

  async function confirmStartReentryRound() {
      if (isStartingRound) return;
      setIsStartingRound(true);
      setActionError(null);
      setShowReentryConfirm(false);
      try {
        const result = await startReentryRound(auctionId, {
          unsoldReentryRounds: auction.rules.unsoldReentryRounds,
          teamSize:            auction.rules.teamSize,
        });

        if (!result.started) {
          setRoundToast(reasonToMessage(result.reason, result.finalized));
          setTimeout(() => setRoundToast(null), 5000);
        } else {
          setRoundToast(
            `Re-entry Round ${result.round} started — ${result.requeued} player${result.requeued === 1 ? "" : "s"} shuffled back into the pool.`
          );
          setTimeout(() => setRoundToast(null), 5000);
        }

        // Refresh queue + round status regardless of outcome
        const queue = await fetchPlayerQueue(auctionId);
        setPlayerQueue(queue);
        await refreshReentryStatus();
      } catch (err: any) {
        setActionError(err?.message ?? "Failed to start re-entry round");
        setTimeout(() => setActionError(null), 5000);
      } finally {
        setIsStartingRound(false);
      }
    }

  // ── Auctioneer actions ────────────────────────────────────────────────────
  async function handleStartNextPlayer() {
    if (isBusy || playerQueue.length === 0 || !shuffleReady || isShuffling) return;
    setIsBusy(true);
    setActionError(null);
    try {
      const newLot = await startRandomLot(auctionId);
      setLotNumber(newLot.lotNumber);
      setSoldState("pending");
      setGlowActive(false);
      setBidHistory([]);
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to start next player");
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleHammerSold() {
    if (isBusy || soldState !== "pending" || !currentLot || isShuffling) return;
    if (!currentLot.winningTeamId) {
      setActionError("No bid placed — mark unsold instead");
      setTimeout(() => setActionError(null), 5000);
      return;
    }
    setIsBusy(true);
    setActionError(null);
    try {
      await closeLotSold(
        currentLot.id,
        auctionId,
        currentLot.playerId,
        currentLot.winningTeamId,
        currentLot.currentBid
      );
      setSoldState("sold");
      setFlashActive(true);
      setGlowActive(true);
      freezeClock();
      spawnParticles(PARTICLE_COLORS_SOLD);
      flashTimeout.current = setTimeout(() => setFlashActive(false), 100);
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to close lot as sold");
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleMarkUnsold() {
    if (isBusy || soldState !== "pending" || !currentLot || isShuffling) return;
    setIsBusy(true);
    setActionError(null);
    try {
      await closeLotUnsold(currentLot.id, currentLot.playerId);
      setSoldState("unsold");
      freezeClock();
      spawnParticles(PARTICLE_COLORS_UNSOLD);
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to mark unsold");
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePauseWithFeedback() {
    await handlePause();
    setFeedbackTrigger("paused");
    setShowFeedback(true);
  }

  async function handleEndSession() {
    await handleStop();
    setFeedbackTrigger("completed");
    setShowFeedback(true);
    setShowEndConfirm(false);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentPlayer = currentLot
    ? auction.players.find((p) => p.supabaseId === currentLot.playerId) ?? null
    : null;

  const winningTeam = currentLot?.winningTeamId
    ? auction.teams.find((t) => t.supabaseId === currentLot.winningTeamId) ?? null
    : null;

  const nextBidAmount = currentLot
    ? getNextBidAmount(currentLot.currentBid, auction.rules.tiers ?? [])
    : 0;

  const blockLabel =
    isShuffling
      ? "Revealing Player…"
      : soldState === "sold"
      ? "Auction Finalized"
      : soldState === "unsold"
      ? "Marked Unsold"
      : currentLot
      ? isLocked
        ? "Bidding Locked — Make Decision"
        : "Currently on Block"
      : "Awaiting First Lot";

  const totalSlotsLeft = auction.teams.reduce((sum, t) => {
    const purse = t.supabaseId ? teamPurses[t.supabaseId] : null;
    const used  = purse?.roster ?? t.roster ?? 0;
    return sum + Math.max(0, auction.rules.teamSize - used);
  }, 0);

  const avgPurse =
    auction.teams.length > 0
      ? Math.round(
          auction.teams.reduce((sum, t) => {
            const p = t.supabaseId ? teamPurses[t.supabaseId]?.remaining : undefined;
            return sum + (p ?? auction.rules.totalPoints);
          }, 0) / auction.teams.length
        )
      : 0;

  const shotClockColor =
    shotClock < 25 ? "#ef4444" : shotClock < 50 ? "#f59e0b" : "#c9971f";

  const showReentryButton = pendingUnsoldCount > 0 && playerQueue.length === 0;
  
  // ── Loading ───────────────────────────────────────────────────────────────
  if (!auction || loading) {
    return (
      <div className="h-screen bg-surface-container-lowest flex items-center justify-center">
        <div className="text-center">
          <span
            className="material-symbols-outlined text-theme-orange animate-spin block mb-4"
            style={{ fontSize: 48 }}
          >
            progress_activity
          </span>
          <p
            style={{
              fontFamily: "'Geist Mono', monospace",
              color: "var(--color-outline)",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            Loading auctioneer console…
          </p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AuctionStatusGate
      auctionId={auctionId}
      initialStatus={auction.status ?? "live"}
      onResume={handleResume}
    >
      <div
        className="bg-background text-on-background selection:bg-secondary-container selection:text-on-secondary-container overflow-hidden h-screen flex flex-col relative"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Inter:wght@400;500;700&family=Geist+Mono:wght@400;500;700&display=swap');
          @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

          .font-archivo    { font-family: 'Archivo Narrow', sans-serif; }
          .font-mono-geist { font-family: 'Geist Mono', monospace; }
          .font-inter      { font-family: 'Inter', sans-serif; }

          .material-symbols-outlined {
            font-family: 'Material Symbols Outlined';
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            font-style: normal; line-height: 1; display: inline-block;
            text-transform: none; letter-spacing: normal; user-select: none;
          }

          .glass-panel {
            background: var(--color-surface-glass);
            backdrop-filter: blur(20px);
            border: 1px solid var(--color-border-overlay);
          }

          .custom-scrollbar::-webkit-scrollbar       { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

          .auction-particle {
            position: fixed; pointer-events: none; z-index: 100;
            border-radius: 50%; width: 8px; height: 8px;
            animation-name: particle-fly;
            animation-timing-function: cubic-bezier(0.1, 0.8, 0.3, 1);
            animation-fill-mode: forwards;
          }
          @keyframes particle-fly {
            0%   { transform: translate(0,0) scale(1); opacity: 1; }
            100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
          }

          .auction-sold-stamp {
            transform: rotate(-13deg);
            animation: sold-land 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          @keyframes sold-land {
            0%   { opacity: 0; transform: rotate(-13deg) scale(2.2); filter: blur(14px); }
            55%  { opacity: 1; filter: blur(0); }
            70%  { transform: rotate(-13deg) scale(0.96); }
            85%  { transform: rotate(-13deg) scale(1.02); }
            100% { transform: rotate(-13deg) scale(1); }
          }
          .sold-stamp-face {
            position: relative; padding: 20px 52px 18px;
            border: 4px solid #A87815; border-radius: 4px;
            overflow: hidden; background: rgba(201,151,31,0.07);
          }
          .sold-inner-ring {
            position: absolute; inset: 5px;
            border: 1px solid rgba(201,151,31,0.32); border-radius: 2px;
            pointer-events: none; z-index: 1;
          }
          .sold-hatch-layer {
            position: absolute; inset: 0;
            background: repeating-linear-gradient(
              108deg,
              transparent 0px, transparent 13px,
              rgba(232,196,104,0.07) 13px, rgba(232,196,104,0.07) 14px
            );
            pointer-events: none;
          }
          .sold-word {
            font-family: 'Archivo Narrow', sans-serif;
            font-size: 76px; font-weight: 700; font-style: italic;
            letter-spacing: 0.14em; text-transform: uppercase;
            color: #E8C468; line-height: 1; display: block;
            position: relative; z-index: 2;
            text-shadow: 0 0 60px rgba(232,196,104,0.25);
          }
          .sold-dots {
            display: flex; gap: 6px; justify-content: center;
            margin-top: 8px; position: relative; z-index: 2;
          }
          .sold-dot {
            display: block; width: 5px; height: 5px; border-radius: 50%;
            background: rgba(232,196,104,0.45);
          }
          .sold-sub {
            display: block; text-align: center;
            font-family: 'Geist Mono', monospace;
            font-size: 9px; font-weight: 500;
            letter-spacing: 0.42em; text-transform: uppercase;
            color: rgba(232,196,104,0.6);
            margin-top: 8px; position: relative; z-index: 2;
          }
          .sold-bar {
            position: absolute; left: 0; right: 0; bottom: 0;
            height: 6px; background: #A87815;
          }

          .auction-unsold-stamp {
            transform: rotate(13deg);
            animation: unsold-land 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both;
          }
          @keyframes unsold-land {
            0%   { opacity: 0; transform: rotate(13deg) scale(2.2); filter: blur(14px); }
            55%  { opacity: 1; filter: blur(0); }
            70%  { transform: rotate(13deg) scale(0.96); }
            85%  { transform: rotate(13deg) scale(1.02); }
            100% { transform: rotate(13deg) scale(1); }
          }
          .unsold-stamp-face {
            position: relative; padding: 20px 38px 18px;
            border: 4px solid #718096; border-radius: 4px;
            overflow: hidden; background: rgba(74,85,104,0.08);
          }
          .unsold-inner-ring {
            position: absolute; inset: 5px;
            border: 1px solid rgba(113,128,150,0.30); border-radius: 2px;
            pointer-events: none; z-index: 1;
          }
          .unsold-hatch-layer {
            position: absolute; inset: 0;
            background:
              repeating-linear-gradient(-45deg, transparent 0px, transparent 6px, rgba(113,128,150,0.08) 6px, rgba(113,128,150,0.08) 7px),
              repeating-linear-gradient( 45deg, transparent 0px, transparent 6px, rgba(113,128,150,0.05) 6px, rgba(113,128,150,0.05) 7px);
            pointer-events: none;
          }
          .cross-mark { position: absolute; width: 16px; height: 16px; z-index: 3; }
          .cross-h, .cross-v { position: absolute; background: rgba(113,128,150,0.65); border-radius: 1px; }
          .cross-h { width: 100%; height: 2px; top: 50%; transform: translateY(-50%); }
          .cross-v { height: 100%; width: 2px; left: 50%; transform: translateX(-50%); }
          .corner-tl { top: 8px;    left: 8px;    }
          .corner-tr { top: 8px;    right: 8px;   }
          .corner-bl { bottom: 8px; left: 8px;    }
          .corner-br { bottom: 8px; right: 8px;   }
          .unsold-word {
            font-family: 'Archivo Narrow', sans-serif;
            font-size: 58px; font-weight: 700; font-style: italic;
            letter-spacing: 0.12em; text-transform: uppercase;
            color: #A0AEC0; line-height: 1; display: block;
            position: relative; z-index: 2;
          }
          .unsold-sub {
            display: block; text-align: center;
            font-family: 'Geist Mono', monospace;
            font-size: 9px; font-weight: 500;
            letter-spacing: 0.35em; text-transform: uppercase;
            color: rgba(160,174,192,0.55);
            margin-top: 8px; position: relative; z-index: 2;
          }

          @keyframes locked-pulse {
            0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
            50%     { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
          }
          .locked-pulse { animation: locked-pulse 1.2s ease-in-out infinite; }

          @keyframes revealing-pulse {
            0%,100% { opacity: 1; }
            50%     { opacity: 0.5; }
          }
          .revealing-pulse { animation: revealing-pulse 1s ease-in-out infinite; }

          @keyframes reentry-glow {
            0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.35); }
            50%     { box-shadow: 0 0 0 6px rgba(99,102,241,0); }
          }
          .reentry-glow { animation: reentry-glow 1.6s ease-in-out infinite; }
        `}</style>

        {/* Particles */}
        {particles.map((p) => (
          <span
            key={p.id}
            className="auction-particle"
            style={{
              left: "50%",
              top: "50%",
              backgroundColor: p.color,
              "--tx": `${p.tx}px`,
              "--ty": `${p.ty}px`,
              animationDuration: `${p.duration}s`,
            } as React.CSSProperties}
          />
        ))}

        {/* Flash overlay */}
        <div
          className={`fixed inset-0 pointer-events-none z-[60] transition-opacity duration-75 ${
            soldState === "sold"
              ? "bg-theme-orange/10"
              : soldState === "unsold"
              ? "bg-slate-400/5"
              : "bg-white/0"
          } ${flashActive ? "opacity-100" : "opacity-0"}`}
        />

        {/* Glow overlay */}
        <div
          className={`fixed inset-0 pointer-events-none z-[55] flex items-center justify-center transition-opacity duration-500 ${
            glowActive ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className="w-[500px] h-[500px] rounded-full blur-[120px]"
            style={{
              background:
                soldState === "sold"
                  ? "rgba(201,151,31,0.18)"
                  : "rgba(113,128,150,0.12)",
            }}
          />
        </div>

        {/* Error toast */}
        {actionError && (
          <div
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold"
            style={{
              background: "rgba(248,113,113,0.12)",
              border: "1px solid rgba(248,113,113,0.4)",
              color: "#f87171",
              fontFamily: "'Geist Mono', monospace",
              backdropFilter: "blur(12px)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
            {actionError}
            <button onClick={() => setActionError(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Re-entry round toast */}
        {roundToast && (
          <div
            className="fixed top-32 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold max-w-xl text-center"
            style={{
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.4)",
              color: "#a5b4fc",
              fontFamily: "'Geist Mono', monospace",
              backdropFilter: "blur(12px)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>autorenew</span>
            {roundToast}
            <button onClick={() => setRoundToast(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Bidding locked banner */}
        {isLocked && soldState === "pending" && currentLot && !isShuffling && (
          <div
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[295] flex items-center gap-3 px-5 py-2 rounded-full text-xs font-bold locked-pulse"
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.5)",
              color: "#ef4444",
              fontFamily: "'Geist Mono', monospace",
              backdropFilter: "blur(12px)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>timer_off</span>
            Bidding locked — hammer sold or mark unsold
          </div>
        )}

        {/* Shuffle-required banner */}
        {!shuffleReady && !isShuffling && (
          <div
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[290] flex items-center gap-3 px-4 py-2 rounded-full text-xs font-bold"
            style={{
              background: "rgba(234,179,8,0.10)",
              border: "1px solid rgba(234,179,8,0.4)",
              color: "#eab308",
              fontFamily: "'Geist Mono', monospace",
              backdropFilter: "blur(12px)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
            Lot order isn't fully shuffled — at least one player is missing a draw position.
            <button
              onClick={handleFixShuffle}
              disabled={isShufflingPool}
              className="ml-1 flex items-center gap-1 px-3 py-1 rounded-full font-bold uppercase tracking-[0.1em] text-[10px]"
              style={{
                background: "#eab308",
                color: "#1a0e00",
                opacity: isShufflingPool ? 0.6 : 1,
              }}
            >
              <span className={`material-symbols-outlined text-[12px] ${isShufflingPool ? "animate-spin" : ""}`}>
                {isShufflingPool ? "refresh" : "shuffle"}
              </span>
              {isShufflingPool ? "Shuffling…" : "Shuffle Now"}
            </button>
          </div>
        )}

        {/* ══════════ TOP BAR ══════════ */}
        <header className="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-16 glass-panel border-b border-white/10">
          <div className="flex items-center gap-4">
            <img
              src={auction.session.auctionLogo || "/valiant-league-logo.png"}
              alt="Auction logo"
              className="w-15 h-15 object-contain"
            />
            <h1 className="font-archivo text-2xl font-bold italic tracking-tighter text-theme-orange uppercase">
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
          </div>
          <div className="flex items-center gap-4">
            {currentLot && soldState === "pending" && !isShuffling && (
              <div className="flex items-center gap-3">
                <span
                  className="font-mono-geist text-[10px] uppercase tracking-[0.1em]"
                  style={{ color: shotClockColor }}
                >
                  {isLocked ? "Locked" : "Clock"}
                </span>
                <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-100"
                    style={{ width: `${shotClock}%`, background: shotClockColor }}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-on-surface-variant font-mono-geist text-[10px] uppercase tracking-[0.12em]">
              <span className="material-symbols-outlined text-sm">lock</span>
              Secure Admin Node
            </div>
            <div className="font-mono-geist text-[10px] text-right">
              <div className="text-on-surface-variant uppercase tracking-[0.1em]">Lot</div>
              <div className="text-theme-orange font-bold">
                #{lotNumber} / {auction.players.length}
              </div>
            </div>

            {/* ── Re-entry Round — always visible once unsold players exist ── */}
            {showReentryButton && (
              <button
                onClick={() => setShowReentryConfirm(true)}
                disabled={isStartingRound}
                className="reentry-glow flex items-center gap-1.5 bg-indigo-500/15 text-indigo-300 px-5 py-2 rounded font-mono-geist font-bold hover:bg-indigo-500/25 transition-all active:scale-95 border border-indigo-400/30 uppercase tracking-[0.16em] text-xs disabled:opacity-50"
                title={`${pendingUnsoldCount} player${pendingUnsoldCount === 1 ? "" : "s"} unsold and eligible for re-entry`}
              >
                <span className={`material-symbols-outlined text-sm ${isStartingRound ? "animate-spin" : ""}`}>
                  {isStartingRound ? "refresh" : "restart_alt"}
                </span>
                Re-entry Round
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-400/20 text-[9px]">{pendingUnsoldCount}</span>
              </button>
            )}

            <button
              onClick={handlePauseWithFeedback}
              className="bg-surface-variant text-on-surface-variant px-6 py-2 rounded font-mono-geist font-bold hover:brightness-110 transition-all active:scale-95 border border-white/10 uppercase tracking-[0.2em] text-xs"
            >
              Pause
            </button>
            <button
              onClick={() => setShowEndConfirm(true)}
              className="bg-error-container text-on-error-container px-6 py-2 rounded font-mono-geist font-bold hover:brightness-110 transition-all active:scale-95 border border-white/10 uppercase tracking-[0.2em] text-xs"
            >
              Complete Auction
            </button>
          </div>
        </header>

        <main className="mt-16 h-[calc(100vh-4rem)] overflow-hidden grid grid-cols-[20%_55%_25%]">

          {/* ══════════ LEFT: Queue ══════════ */}
          <aside className="hidden xl:flex flex-col h-full bg-surface-container-lowest border-r border-outline-variant shrink-0 overflow-hidden">
            <div className="px-8 pt-8 pb-6 border-b border-outline-variant">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-theme-orange/10 border border-theme-orange/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-theme-orange text-xl">manage_accounts</span>
                </div>
                <div>
                  <p className="font-inter text-on-surface font-bold text-sm">Chief Auctioneer</p>
                  <p className="font-mono-geist text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
                    Admin Privileges
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <h3 className="font-mono-geist text-xs text-on-surface-variant uppercase font-bold tracking-[0.2em]">
                  Remaining Pool
                </h3>
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

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {playerQueue.map((p) => (
                <div
                  key={p.supabaseId ?? p.id}
                  className="p-4 hover:bg-white/5 rounded transition-all group flex items-center gap-4"
                >
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-on-surface transition-colors">
                    person
                  </span>
                  <div>
                    <p className="font-archivo text-sm font-bold uppercase text-on-surface-variant group-hover:text-on-surface flex items-center gap-2">
                      {p.name}
                      {(p.reentryCount ?? 0) > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold normal-case" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                          R{p.reentryCount}
                        </span>
                      )}
                    </p>
                    <p className="font-mono-geist text-[10px] text-on-surface-variant">
                      {p.role} | {p.country}
                    </p>
                  </div>
                </div>
              ))}

              {playerQueue.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-2">
                    check_circle
                  </span>
                  <p className="font-mono-geist text-xs text-on-surface-variant uppercase tracking-widest">
                    All players called
                  </p>
                  {pendingUnsoldCount > 0 && (
                    <p className="font-mono-geist text-[10px] text-indigo-300 uppercase tracking-widest mt-2">
                      {pendingUnsoldCount} unsold — start a re-entry round above
                    </p>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* ══════════ CENTER ══════════ */}
          <section className="flex flex-col h-full p-4 gap-4 overflow-hidden">
            <div
              className={`glass-panel rounded-2xl flex flex-col md:flex-row relative overflow-hidden group items-start transition-all duration-700 p-4 gap-4 ${
                isShuffling
                  ? "opacity-60"
                  : soldState === "sold"
                  ? "scale-[1.01] shadow-[0_0_80px_rgba(201,151,31,0.12)]"
                  : soldState === "unsold"
                  ? "scale-[1.01] shadow-[0_0_60px_rgba(113,128,150,0.1)]"
                  : isLocked
                  ? "shadow-[0_0_40px_rgba(239,68,68,0.08)]"
                  : ""
              }`}
            >
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-theme-orange/5 blur-[100px] rounded-full" />

              {soldState === "sold"   && !isShuffling && <AuctionStamp state="sold"   />}
              {soldState === "unsold" && !isShuffling && <AuctionStamp state="unsold" />}

              <div className="flex-1 flex flex-col md:flex-row gap-6 relative z-10 w-full items-start">
                <div className="relative group/img">
                  <div className="w-64 h-64 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl relative">
                    {currentLot?.playerImg ? (
                      <img
                        alt={currentLot.playerName}
                        className={`w-full h-full object-cover object-top transition-all duration-500 ${isShuffling ? "blur-md grayscale" : "grayscale-[0.2] group-hover/img:grayscale-0"}`}
                        src={currentLot.playerImg}
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-container flex items-center justify-center">
                        <span className="material-symbols-outlined text-outline-variant" style={{ fontSize: 64 }}>
                          {isShuffling ? "animated_images" : "person"}
                        </span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 z-20 bg-white text-black px-2 py-1 rounded font-mono-geist text-[10px] font-bold tracking-[0.32em] shadow-lg">
                      LOT #{currentLot?.lotNumber ?? "—"}
                    </div>
                    {currentLot && soldState === "pending" && !isShuffling && (
                      <div className="absolute bottom-0 left-0 right-0 h-1">
                        <div
                          className="h-full transition-all duration-100"
                          style={{
                            width: `${shotClock}%`,
                            background: shotClockColor,
                            boxShadow: `0 0 6px ${shotClockColor}`,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 w-full mt-3">
                    {isShuffling && (
                      <div
                        className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-lg font-mono-geist text-[10px] uppercase tracking-[0.2em]"
                        style={{
                          background: "rgba(201,151,31,0.06)",
                          border: "1px solid rgba(201,151,31,0.2)",
                          color: "#c9971f",
                        }}
                      >
                        <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                        Revealing on broadcast…
                      </div>
                    )}

                    {!isShuffling && soldState === "pending" && currentLot && (
                      <>
                        <button
                          onClick={handleHammerSold}
                          disabled={isBusy || !currentLot.winningTeamId}
                          className="flex items-center justify-center gap-1 py-3 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] hover:brightness-110 transition-all active:scale-95 shadow-lg border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            background: "linear-gradient(135deg,#A87815,#E8C468)",
                            color: "#1a1304",
                          }}
                          title={!currentLot.winningTeamId ? "No bids yet" : "Hammer sold"}
                        >
                          <span className="material-symbols-outlined text-sm">gavel</span>
                          Hammer Sold
                        </button>
                        <button
                          onClick={handleMarkUnsold}
                          disabled={isBusy}
                          className="flex items-center justify-center gap-1 bg-surface-bright text-on-surface-variant py-3 rounded-lg font-mono-geist text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 transition-all active:scale-95 border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                          Mark Unsold
                        </button>
                      </>
                    )}

                    {!isShuffling && soldState !== "pending" && (
                      shuffleReady ? (
                        <button
                          onClick={handleStartNextPlayer}
                          disabled={isBusy || playerQueue.length === 0}
                          className="col-span-2 flex items-center justify-center gap-2 bg-primary text-on-background py-3 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] hover:brightness-110 transition-all active:scale-95 shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {playerQueue.length === 0 ? "No more players" : "Next Player"}
                          {playerQueue.length > 0 && (
                            <span className="material-symbols-outlined text-sm">arrow_forward</span>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={handleFixShuffle}
                          disabled={isShufflingPool}
                          className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] hover:brightness-110 transition-all active:scale-95 shadow-xl disabled:opacity-40 border border-theme-orange/30 bg-theme-orange/10 text-theme-orange"
                        >
                          <span className={`material-symbols-outlined text-sm ${isShufflingPool ? "animate-spin" : ""}`}>
                            {isShufflingPool ? "refresh" : "shuffle"}
                          </span>
                          {isShufflingPool ? "Shuffling…" : "Shuffle Lot Order First"}
                        </button>
                      )
                    )}

                    {!isShuffling && !currentLot && soldState === "pending" && playerQueue.length > 0 && (
                      shuffleReady ? (
                        <button
                          onClick={handleStartNextPlayer}
                          disabled={isBusy}
                          className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] hover:brightness-110 transition-all active:scale-95 shadow-xl disabled:opacity-40"
                          style={{ background: "linear-gradient(135deg,#A87815,#E8C468)", color: "#1a1304" }}
                        >
                          <span className="material-symbols-outlined text-sm">play_arrow</span>
                          {playerQueue.length === 0 ? "No more players" : "Start Next Player"}
                        </button>
                      ) : (
                        <button
                          onClick={handleFixShuffle}
                          disabled={isShufflingPool}
                          className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] hover:brightness-110 transition-all active:scale-95 shadow-xl disabled:opacity-40 border border-theme-orange/30 bg-theme-orange/10 text-theme-orange"
                        >
                          <span className={`material-symbols-outlined text-sm ${isShufflingPool ? "animate-spin" : ""}`}>
                            {isShufflingPool ? "refresh" : "shuffle"}
                          </span>
                          {isShufflingPool ? "Shuffling…" : "Shuffle Lot Order First"}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="space-y-1">
                    <span
                      className="font-mono-geist text-xs tracking-[0.3em] uppercase font-bold"
                      style={{
                        color:
                          isShuffling
                            ? "#c9971f"
                            : soldState === "sold"
                            ? "#c9971f"
                            : soldState === "unsold"
                            ? "#718096"
                            : isLocked
                            ? "#ef4444"
                            : "#c9971f",
                      }}
                    >
                      {blockLabel}
                    </span>
                    <h2 className="font-archivo text-5xl text-white tracking-tight font-bold italic uppercase">
                      {isShuffling ? "???" : (currentLot?.playerName ?? "—")}
                    </h2>
                    {!isShuffling && (
                      <div className="flex gap-3 items-center flex-wrap">
                        <span className="px-3 py-1 bg-white/10 rounded font-mono-geist text-[10px] uppercase tracking-[0.18em]">
                          {currentLot?.playerRole ?? "—"} | {currentLot?.playerCountry ?? "—"}
                        </span>
                        <span className="px-3 py-1 bg-white/10 rounded font-mono-geist text-[10px] uppercase tracking-[0.18em]">
                          Base: {fmtPts(currentLot?.basePrice)} pts
                        </span>
                        {currentPlayer?.capped && (
                          <span className="px-3 py-1 bg-theme-orange/10 border border-theme-orange/20 rounded font-mono-geist text-[10px] uppercase tracking-[0.18em] text-theme-orange">
                            Capped
                          </span>
                        )}
                        {(currentPlayer?.reentryCount ?? 0) > 0 && (
                          <span className="px-3 py-1 bg-indigo-400/10 border border-indigo-400/20 rounded font-mono-geist text-[10px] uppercase tracking-[0.18em] text-indigo-300">
                            Re-entry Round {currentPlayer?.reentryCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {currentLot && !isShuffling && (
                    <div
                      className={`p-4 glass-panel rounded-xl ${isLocked && soldState === "pending" ? "border-red-500/30" : ""}`}
                      style={isLocked && soldState === "pending" ? { borderColor: "rgba(239,68,68,0.3)" } : {}}
                    >
                      <div className="flex items-end justify-between mb-2">
                        <div>
                          <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.18em] mb-1">
                            Current High Bid
                          </p>
                          <p className="font-archivo text-4xl font-bold text-theme-orange">
                            {fmtPts(currentLot.currentBid)}
                            <span className="text-sm opacity-50 ml-1">pts</span>
                          </p>
                        </div>
                        {winningTeam && (
                          <div className="text-right">
                            <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.1em] mb-1">
                              Leading
                            </p>
                            <p className="font-archivo text-xl font-bold text-white">{winningTeam.code}</p>
                          </div>
                        )}
                      </div>
                      {soldState === "pending" && !isLocked && (
                        <p className="font-mono-geist text-[10px] text-on-surface-variant">
                          Next bid: <span className="text-theme-orange font-bold">{fmtPts(nextBidAmount)} pts</span>
                        </p>
                      )}
                      {isLocked && soldState === "pending" && (
                        <p className="font-mono-geist text-[10px]" style={{ color: "#ef4444" }}>
                          Time expired — no further bids accepted
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bid Log */}
            <div className="flex-1 min-h-0 glass-panel rounded-2xl flex flex-col overflow-hidden bg-surface-container-lowest">
              <div className="px-8 py-5 border-b border-white/10 flex justify-between items-center bg-white/5">
                <h3 className="font-mono-geist text-xs text-on-surface uppercase flex items-center gap-3 font-bold tracking-[0.2em]">
                  <span className="material-symbols-outlined text-theme-orange text-lg">monitoring</span>
                  Live Bidding Feed
                </h3>
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                  <span className="font-mono-geist text-[10px] text-on-surface-variant uppercase tracking-[0.12em] font-bold">
                    Synchronized
                  </span>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2">
                {bidHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <span className="material-symbols-outlined text-on-surface-variant text-3xl mb-2">
                      history
                    </span>
                    <p className="font-mono-geist text-[10px] text-on-surface-variant uppercase tracking-widest">
                      {isShuffling ? "Awaiting player reveal" : "No bids yet"}
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-separate border-spacing-y-2">
                    <thead className="sticky top-0 bg-surface-container-lowest/80 backdrop-blur-sm font-mono-geist text-[10px] text-on-surface-variant uppercase font-bold tracking-[0.1em]">
                      <tr>
                        <th className="px-6 py-4">Timeline</th>
                        <th className="px-6 py-4">Franchise</th>
                        <th className="px-6 py-4">Bid Amount</th>
                        <th className="px-6 py-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono-geist text-xs">
                      {bidHistory.map((b, i) => (
                        <tr
                          key={b.id}
                          className="group hover:bg-white/5 transition-all text-on-surface-variant"
                        >
                          <td className="px-6 py-4 opacity-40">
                            {new Date(b.placedAt).toLocaleTimeString("en-GB", { hour12: false })}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: b.teamColor || "#888" }}
                              />
                              <span className="font-archivo font-semibold">{b.teamName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-archivo font-semibold text-theme-orange">
                            {fmtPts(b.amount)} pts
                          </td>
                          <td className="px-6 py-4 text-right opacity-40 italic font-inter text-[10px]">
                            {i === 0 ? "Leading" : "Outbid"}
                          </td>
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
            <div className="px-8 py-4 border-b border-outline-variant">
              <h3 className="font-mono-geist text-xs text-on-surface-variant uppercase font-bold tracking-[0.2em] mb-4">
                Financial Dashboard
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 glass-panel rounded-lg flex flex-col gap-1">
                  <span className="font-mono-geist text-[10px] text-on-surface-variant uppercase tracking-[0.1em]">
                    Avg Purse
                  </span>
                  <span className="font-archivo text-lg font-bold text-on-surface leading-none">
                    {fmtPts(avgPurse)}
                    <span className="text-xs opacity-50 ml-1">pts</span>
                  </span>
                </div>
                <div className="p-4 glass-panel rounded-lg flex flex-col gap-1">
                  <span className="font-mono-geist text-[10px] text-on-surface-variant uppercase tracking-[0.1em]">
                    Slots Left
                  </span>
                  <span className="font-archivo text-lg font-bold text-on-surface leading-none">
                    {totalSlotsLeft}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-4">
              {auction.teams.map((team) => {
                const purse       = team.supabaseId ? teamPurses[team.supabaseId] : null;
                const roster      = purse?.roster    ?? team.roster ?? 0;
                const remaining   = purse?.remaining ?? auction.rules.totalPoints;
                const totalPoints = auction.rules.totalPoints;
                const pctFilled   = Math.round((remaining / Math.max(totalPoints, 1)) * 100);
                const isFull      = roster >= auction.rules.teamSize;

                return (
                  <div
                    key={team.supabaseId ?? team.id}
                    className={`p-5 glass-panel rounded-xl transition-all relative overflow-hidden group ${
                      isFull
                        ? "opacity-50 grayscale cursor-not-allowed"
                        : "hover:border-theme-orange/40 cursor-pointer"
                    }`}
                  >
                    {isFull && <div className="absolute inset-0 bg-black/20 z-10" />}
                    {isFull && (
                      <div className="absolute top-2 right-2 z-20 bg-error-container text-on-error-container px-2 py-0.5 rounded font-mono-geist text-[8px] font-bold tracking-[0.12em] uppercase">
                        Squad Full
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center font-bold shadow-lg text-sm font-archivo overflow-hidden"
                          style={{ background: team.color || "#888", color: "#fff" }}
                        >
                          {team.logo ? (
                            <img src={team.logo} alt={team.code} className="w-full h-full object-cover" />
                          ) : (
                            team.code.slice(0, 2)
                          )}
                        </div>
                        <div>
                          <span className="block font-archivo text-sm font-bold text-on-surface uppercase leading-tight">
                            {team.name}
                          </span>
                          <span className="font-mono-geist text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.1em]">
                            Squad: {roster}/{auction.rules.teamSize}
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant group-hover:text-theme-orange transition-colors">
                        {isFull ? "lock" : "info"}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between font-mono-geist text-[10px] uppercase tracking-[0.1em] font-bold">
                        <span className="text-on-surface-variant">Remaining Budget</span>
                        <span className="font-archivo text-[13px] font-semibold text-on-surface">
                          {fmtPts(remaining)} pts
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-1000"
                          style={{
                            width: `${pctFilled}%`,
                            background: isFull ? "rgba(255,255,255,0.2)" : "linear-gradient(90deg,#A87815,#E8C468)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </main>

        {/* Feedback Modal */}
        {showFeedback && (
          <FeedbackModal
            auctionId={auctionId}
            role="auctioneer"
            trigger={feedbackTrigger}
            onClose={() => setShowFeedback(false)}
          />
        )}

        {/* Re-entry Round Confirm Modal */}
        {showReentryConfirm && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowReentryConfirm(false)}
            />
            <div
              className="relative z-10 w-full max-w-md mx-4 rounded-2xl p-8 flex flex-col gap-6"
              style={{
                background: "var(--color-surface-container-lowest)",
                border: "1px solid rgba(99,102,241,0.25)",
                boxShadow: "0 0 80px rgba(99,102,241,0.12), 0 24px 64px rgba(0,0,0,0.6)",
              }}
            >
              <div className="flex items-center justify-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.25)" }}
                >
                  <span className="material-symbols-outlined text-indigo-300" style={{ fontSize: 32 }}>
                    restart_alt
                  </span>
                </div>
              </div>

              <div className="text-center space-y-2">
                <h2 className="font-archivo text-2xl font-bold italic uppercase tracking-tight text-white">
                  Start Re-entry Round?
                </h2>
                <p className="font-mono-geist text-[11px] text-on-surface-variant uppercase tracking-[0.12em] leading-relaxed">
                  {pendingUnsoldCount} unsold player{pendingUnsoldCount === 1 ? "" : "s"} will be reshuffled<br />
                  and added back to the end of the pool.
                </p>
              </div>

              <div
                className="grid grid-cols-2 gap-3 p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="text-center">
                  <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.15em] mb-1">
                    Current Round
                  </p>
                  <p className="font-archivo text-2xl font-bold text-white">
                    {roundInfo.current} / {roundInfo.limit}
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.15em] mb-1">
                    Unsold Players
                  </p>
                  <p className="font-archivo text-2xl font-bold text-white">
                    {pendingUnsoldCount}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowReentryConfirm(false)}
                  className="flex-1 py-3 rounded-xl font-mono-geist text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110 active:scale-95"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#a0aec0",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStartReentryRound}
                  disabled={isStartingRound}
                  className="flex-1 py-3 rounded-xl font-mono-geist text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #4338ca, #6366f1)",
                    color: "#fff",
                    boxShadow: "0 4px 24px rgba(99,102,241,0.3)",
                  }}
                >
                  {isStartingRound ? "Starting…" : "Start Round"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* End Session Confirm Modal */}
        {showEndConfirm && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowEndConfirm(false)}
            />

            {/* Dialog */}
            <div
              className="relative z-10 w-full max-w-md mx-4 rounded-2xl p-8 flex flex-col gap-6"
              style={{
                background: "var(--color-surface-container-lowest)",
                border: "1px solid rgba(248,113,113,0.2)",
                boxShadow: "0 0 80px rgba(239,68,68,0.12), 0 24px 64px rgba(0,0,0,0.6)",
              }}
            >
              {/* Icon */}
              <div className="flex items-center justify-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)" }}
                >
                  <span className="material-symbols-outlined text-red-400" style={{ fontSize: 32 }}>
                    gavel
                  </span>
                </div>
              </div>

              {/* Text */}
              <div className="text-center space-y-2">
                <h2
                  className="font-archivo text-2xl font-bold italic uppercase tracking-tight text-white"
                >
                  End the Auction?
                </h2>
                <p className="font-mono-geist text-[11px] text-on-surface-variant uppercase tracking-[0.12em] leading-relaxed">
                  This will close the session for all participants.<br />
                  This action cannot be undone.
                </p>
              </div>

              {/* Stats summary */}
              <div
                className="grid grid-cols-2 gap-3 p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="text-center">
                  <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.15em] mb-1">
                    Lots Completed
                  </p>
                  <p className="font-archivo text-2xl font-bold text-white">
                    {completedLots.length}
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.15em] mb-1">
                    Players Remaining
                  </p>
                  <p className="font-archivo text-2xl font-bold text-white">
                    {playerQueue.length}
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEndConfirm(false)}
                  className="flex-1 py-3 rounded-xl font-mono-geist text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110 active:scale-95"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#a0aec0",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEndSession}
                  disabled={isBusy}
                  className="flex-1 py-3 rounded-xl font-mono-geist text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #991b1b, #ef4444)",
                    color: "#fff",
                    boxShadow: "0 4px 24px rgba(239,68,68,0.3)",
                  }}
                >
                  End Auction
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuctionStatusGate>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function AuctioneerWithClock({ auctionId }: { auctionId: string }) {
  const { auction } = useAuction();
  const timerSeconds = auction?.session?.timerSeconds ?? 15;

  return (
    <ShotClockProvider timerSeconds={timerSeconds}>
      <AuctioneerContent auctionId={auctionId} />
    </ShotClockProvider>
  );
}

export default function LiveAuctioneerPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = use(params);
  return (
    <AuctionProvider>
      <AuctionNameAwareWrapper auctionId={auctionId} />
    </AuctionProvider>
  );
}

function AuctionNameAwareWrapper({ auctionId }: { auctionId: string }) {
  const { auction } = useAuction();
  return (
    <DesktopOnlyWrapper auctionName={auction?.session?.auctionName}>
      <AuctioneerWithClock auctionId={auctionId} />
    </DesktopOnlyWrapper>
  );
}