// app/live/[auctionId]/page.tsx
"use client";

import React, { use, useCallback, useEffect, useRef, useState } from "react";
import { AuctionProvider, useAuction } from "@/context/AuctionContext";
import { AuctionStamp } from "@/components/AuctionStamp";
import DesktopOnlyWrapper from "@/components/DesktopOnlyWrapper";
import {
  loadLiveState,
  loadTeamPurses,
  startLot,
  placeBid,
  closeLotSold,
  closeLotUnsold,
  initTeamPurses,
  subscribeToLot,
  subscribeToBids,
  subscribeToTeamPurses,
  getNextBidAmount,
  type AuctionLot,
  type BidEntry,
  startRandomLot,
} from "@/lib/auctionLiveDb";
import type { Player, Team } from "@/types/auction";

type SoldState = "pending" | "sold" | "unsold";
type TeamPurse = { remaining: number; roster: number };

type Particle = {
  id: number;
  tx: number;
  ty: number;
  color: string;
  duration: number;
};

const PARTICLE_COLORS_SOLD   = ["#F5B400", "#C9920A", "#FDECC8", "#ffffff"];
const PARTICLE_COLORS_UNSOLD = ["#718096", "#A0AEC0", "#CBD5E0", "#E2E8F0"];

let particleIdCtr = 0;

function AuctioneerContent({ auctionId }: { auctionId: string }) {
  const { auction, loadFromDb, handleStop, shuffleReady, handleShuffle } = useAuction();

  const [loading,         setLoading]         = useState(true);
  const [currentLot,      setCurrentLot]      = useState<AuctionLot | null>(null);
  const [bidHistory,      setBidHistory]       = useState<BidEntry[]>([]);
  const [completedLots,   setCompletedLots]   = useState<AuctionLot[]>([]);
  const [lotNumber,       setLotNumber]        = useState(0);
  const [teamPurses,      setTeamPurses]       = useState<Record<string, TeamPurse>>({});
  const [playerQueue,     setPlayerQueue]      = useState<Player[]>([]);

  const [soldState,       setSoldState]        = useState<SoldState>("pending");
  const [flashActive,     setFlashActive]      = useState(false);
  const [glowActive,      setGlowActive]       = useState(false);
  const [particles,       setParticles]        = useState<Particle[]>([]);
  const [actionError,     setActionError]      = useState<string | null>(null);
  const [isBusy,          setIsBusy]           = useState(false);
  const [isShufflingPool, setIsShufflingPool]  = useState(false);

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

  // ── Step 2: load live state once context is ready ─────────────────────────
    useEffect(() => {
    if (!auction?.auctionId) return;

    async function init() {
        // Load purses FIRST before any init
        const dbPurses = await loadTeamPurses(auctionId);
        
        const purses: Record<string, TeamPurse> = {};
        for (const t of auction.teams) {
        if (t.supabaseId) {
            purses[t.supabaseId] = dbPurses[t.supabaseId] ?? {
            remaining: auction.rules.totalPoints,
            roster:    t.roster,
            };
        }
        }
        setTeamPurses(purses); // ← set real DB values first

        // Only init purses for teams that have never been initialized (remaining_purse is null)
        const hasUninitializedTeams = Object.keys(dbPurses).length < auction.teams.length ||
        auction.teams.some(t => t.supabaseId && !dbPurses[t.supabaseId]);
        
        if (hasUninitializedTeams) {
        await initTeamPurses(auctionId, auction.rules.totalPoints).catch(() => {});
        // Re-fetch after init
        const freshPurses = await loadTeamPurses(auctionId);
        const freshMap: Record<string, TeamPurse> = {};
        for (const t of auction.teams) {
            if (t.supabaseId) {
            freshMap[t.supabaseId] = freshPurses[t.supabaseId] ?? {
                remaining: auction.rules.totalPoints,
                roster:    t.roster,
            };
            }
        }
        setTeamPurses(freshMap);
        }

        const liveData = await loadLiveState(auctionId);
        setCurrentLot(liveData.currentLot);
        setBidHistory(liveData.bidHistory);
        setCompletedLots(liveData.completedLots);
        setLotNumber(liveData.lotNumber);

        if (liveData.currentLot?.status === "sold")   setSoldState("sold");
        if (liveData.currentLot?.status === "unsold") setSoldState("unsold");

        const usedIds = new Set(liveData.completedLots.map((l) => l.playerId));
        if (liveData.currentLot) usedIds.add(liveData.currentLot.playerId);
        setPlayerQueue(auction.players.filter((p) => !usedIds.has(p.supabaseId ?? "")));

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

        if (lot.status === "pending") {
        if (isNewLot) {
            setPlayerQueue((prev) => prev.filter((p) => p.supabaseId !== lot.playerId));
            setBidHistory([]);
        }
        setSoldState("pending");
        setGlowActive(false);
        }

        if (lot.status === "sold") {
        setSoldState("sold");
        setGlowActive(true);
        setCompletedLots((prev) =>
            prev.some((l) => l.id === lot.id) ? prev : [lot, ...prev]
        );
        }

        if (lot.status === "unsold") {
        setSoldState("unsold");
        setCompletedLots((prev) =>
            prev.some((l) => l.id === lot.id) ? prev : [lot, ...prev]
        );
        }
    }, getCurrentLotId);

    const bidSub = subscribeToBids(auctionId, (bid) => {
        setBidHistory((prev) => [bid, ...prev].slice(0, 30));
        setCurrentLot((prev) =>
        prev
            ? { ...prev, currentBid: bid.amount, winningTeamCode: bid.teamCode, winningTeamId: bid.teamId }
            : prev
        );
    });

    console.log("[realtime] setting up purse subscription for auction", auctionId);

    const purseSub = subscribeToTeamPurses(
        auctionId,
        (teamId, remaining, roster) => {
        console.log("[purse change fired]", { teamId, remaining, roster });
        setTeamPurses((prev) => ({ ...prev, [teamId]: { remaining, roster } }));
        }
    );

    console.log("[purseSub channel]", purseSub);

    return () => {
        lotSub.unsubscribe();
        bidSub.unsubscribe();
        purseSub.unsubscribe();
    };
  }, [auctionId, auction?.auctionId, getCurrentLotId]);

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

  // ── Fix the pool (re-shuffle) without leaving this page ───────────────────
  async function handleFixShuffle() {
    if (isShufflingPool) return;
    setIsShufflingPool(true);
    setActionError(null);
    try {
      await handleShuffle();
    } catch (err: any) {
      setActionError(err?.message ?? "Shuffle failed — please try again");
    } finally {
      setIsShufflingPool(false);
    }
  }

  // ── Auctioneer actions ────────────────────────────────────────────────────
  async function handleStartNextPlayer() {
    if (isBusy || playerQueue.length === 0 || !shuffleReady) return;
    setIsBusy(true);
    setActionError(null);
    try {
      const newLot = await startRandomLot(auctionId);
      setCurrentLot(newLot);
      setLotNumber(newLot.lotNumber);
      setSoldState("pending");
      setGlowActive(false);
      setBidHistory([]);
      setPlayerQueue((prev) => prev.filter((p) => p.supabaseId !== newLot.playerId));
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to start next player");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleHammerSold() {
    if (isBusy || soldState !== "pending" || !currentLot) return;
    if (!currentLot.winningTeamId) {
      setActionError("No bid placed — mark unsold instead");
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
      spawnParticles(PARTICLE_COLORS_SOLD);
      flashTimeout.current = setTimeout(() => setFlashActive(false), 100);
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to close lot as sold");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleMarkUnsold() {
    if (isBusy || soldState !== "pending" || !currentLot) return;
    setIsBusy(true);
    setActionError(null);
    try {
      await closeLotUnsold(currentLot.id, currentLot.playerId);
      setSoldState("unsold");
      spawnParticles(PARTICLE_COLORS_UNSOLD);
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to mark unsold");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleEndSession() {
    if (!confirm("End the auction session? This cannot be undone.")) return;
    await handleStop();
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
    soldState === "sold"
      ? "Auction Finalized"
      : soldState === "unsold"
      ? "Marked Unsold"
      : currentLot
      ? "Currently on Block"
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

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!auction || loading) {
    return (
      <div className="h-screen bg-[#0b0f10] flex items-center justify-center">
        <div className="text-center">
          <span
            className="material-symbols-outlined text-[#e45d35] animate-spin block mb-4"
            style={{ fontSize: 48 }}
          >
            progress_activity
          </span>
          <p
            style={{
              fontFamily: "'Geist Mono', monospace",
              color: "#5a6a74",
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
    <div
      className="bg-background text-on-background selection:bg-secondary-container selection:text-on-secondary-container overflow-hidden h-screen flex flex-col relative"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Inter:wght@400;500;700&family=Geist+Mono:wght@400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

        .font-archivo    { font-family: 'Archivo Narrow', sans-serif; }
        .font-mono-geist { font-family: 'Geist', monospace; }
        .font-inter      { font-family: 'Inter', sans-serif; }

        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          font-style: normal; line-height: 1; display: inline-block;
          text-transform: none; letter-spacing: normal; user-select: none;
        }

        .glass-panel {
          background: rgba(16, 20, 21, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.08);
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
          border: 4px solid #C9920A; border-radius: 4px;
          overflow: hidden; background: rgba(197,134,10,0.07);
        }
        .sold-inner-ring {
          position: absolute; inset: 5px;
          border: 1px solid rgba(201,146,10,0.32); border-radius: 2px;
          pointer-events: none; z-index: 1;
        }
        .sold-hatch-layer {
          position: absolute; inset: 0;
          background: repeating-linear-gradient(
            108deg,
            transparent 0px, transparent 13px,
            rgba(245,180,0,0.07) 13px, rgba(245,180,0,0.07) 14px
          );
          pointer-events: none;
        }
        .sold-word {
          font-family: 'Archivo Narrow', sans-serif;
          font-size: 76px; font-weight: 700; font-style: italic;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: #F5B400; line-height: 1; display: block;
          position: relative; z-index: 2;
          text-shadow: 0 0 60px rgba(245,180,0,0.25);
        }
        .sold-dots {
          display: flex; gap: 6px; justify-content: center;
          margin-top: 8px; position: relative; z-index: 2;
        }
        .sold-dot {
          display: block; width: 5px; height: 5px; border-radius: 50%;
          background: rgba(245,180,0,0.45);
        }
        .sold-sub {
          display: block; text-align: center;
          font-family: 'Geist', monospace;
          font-size: 9px; font-weight: 500;
          letter-spacing: 0.42em; text-transform: uppercase;
          color: rgba(245,180,0,0.6);
          margin-top: 8px; position: relative; z-index: 2;
        }
        .sold-bar {
          position: absolute; left: 0; right: 0; bottom: 0;
          height: 6px; background: #C9920A;
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
          font-family: 'Geist', monospace;
          font-size: 9px; font-weight: 500;
          letter-spacing: 0.35em; text-transform: uppercase;
          color: rgba(160,174,192,0.55);
          margin-top: 8px; position: relative; z-index: 2;
        }
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
            ? "bg-amber-400/10"
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
                ? "rgba(245,180,0,0.18)"
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

      {/* Shuffle-required banner */}
      {!shuffleReady && (
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
          <span className="material-symbols-outlined text-amber-400 text-3xl">sports_cricket</span>
          <h1 className="font-archivo text-2xl font-bold tracking-tighter text-on-background">
            APL <span className="text-amber-400">AUCTION</span>
          </h1>
          <div className="ml-8 flex items-center gap-3 px-4 py-1.5 bg-amber-400/10 border border-amber-400/20 rounded-full">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-mono-geist text-xs text-amber-400 uppercase font-bold tracking-[0.18em]">
              Live: {auction.session.auctionName}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 text-on-surface-variant font-mono-geist text-[10px] uppercase tracking-[0.12em]">
            <span className="material-symbols-outlined text-sm">lock</span>
            Secure Admin Node
          </div>
          <div className="font-mono-geist text-[10px] text-right">
            <div className="text-on-surface-variant uppercase tracking-[0.1em]">Lot</div>
            <div className="text-amber-400 font-bold">
              #{lotNumber} / {auction.players.length}
            </div>
          </div>
          <button
            onClick={handleEndSession}
            className="bg-error-container text-on-error-container px-6 py-2 rounded font-mono-geist font-bold hover:brightness-110 transition-all active:scale-95 border border-white/10 uppercase tracking-[0.2em] text-xs"
          >
            End Session
          </button>
        </div>
      </header>

      <main className="mt-16 h-[calc(100vh-4rem)] overflow-hidden grid grid-cols-[20%_55%_25%]">

        {/* ══════════ LEFT: Queue ══════════ */}
        <aside className="hidden xl:flex flex-col h-full bg-surface-container-lowest border-r border-outline-variant shrink-0 overflow-hidden">
          <div className="px-8 pt-8 pb-6 border-b border-outline-variant">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-400 text-xl">manage_accounts</span>
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
                  <p className="font-archivo text-sm font-bold uppercase text-on-surface-variant group-hover:text-on-surface">
                    {p.name}
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
              </div>
            )}
          </div>
        </aside>

        {/* ══════════ CENTER ══════════ */}
        <section className="flex flex-col h-full p-4 gap-4 overflow-hidden">

          {/* Player card */}
          <div
            className={`glass-panel rounded-2xl flex flex-col md:flex-row relative overflow-hidden group items-start transition-all duration-700 p-4 gap-4 ${
              soldState === "sold"
                ? "scale-[1.01] shadow-[0_0_80px_rgba(245,180,0,0.12)]"
                : soldState === "unsold"
                ? "scale-[1.01] shadow-[0_0_60px_rgba(113,128,150,0.1)]"
                : ""
            }`}
          >
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-amber-400/5 blur-[100px] rounded-full" />

            {soldState === "sold"   && <AuctionStamp state="sold"   />}
            {soldState === "unsold" && <AuctionStamp state="unsold" />}

            <div className="flex-1 flex flex-col md:flex-row gap-6 relative z-10 w-full items-start">
              {/* Photo + primary controls */}
              <div className="relative group/img">
                <div className="w-64 h-64 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl relative">
                  {currentLot?.playerImg ? (
                    <img
                      alt={currentLot.playerName}
                      className="w-full h-full object-cover object-top grayscale-[0.2] group-hover/img:grayscale-0 transition-all duration-500"
                      src={currentLot.playerImg}
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1c2021] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#2a3a44]" style={{ fontSize: 64 }}>
                        person
                      </span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 z-20 bg-white text-black px-2 py-1 rounded font-mono-geist text-[10px] font-bold tracking-[0.32em] shadow-lg">
                    LOT #{currentLot?.lotNumber ?? "—"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 w-full mt-3">
                  {soldState === "pending" && currentLot && (
                    <>
                      <button
                        onClick={handleHammerSold}
                        disabled={isBusy || !currentLot.winningTeamId}
                        className="flex items-center justify-center gap-1 py-3 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] hover:brightness-110 transition-all active:scale-95 shadow-lg border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: "linear-gradient(135deg,#C9920A,#F5B400)",
                          color: "#1a0e00",
                        }}
                        title={!currentLot.winningTeamId ? "No bids yet" : "Hammer sold"}
                      >
                        <span className="material-symbols-outlined text-sm">gavel</span>
                        Hammer Sold
                      </button>
                      <button
                        onClick={handleMarkUnsold}
                        disabled={isBusy}
                        className="flex items-center justify-center gap-1 bg-surface-variant text-on-surface-variant py-3 rounded-lg font-mono-geist text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 transition-all active:scale-95 border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                        Mark Unsold
                      </button>
                    </>
                  )}

                  {soldState !== "pending" && (
                    shuffleReady ? (
                      <button
                        onClick={handleStartNextPlayer}
                        disabled={isBusy || playerQueue.length === 0}
                        className="col-span-2 flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] hover:brightness-110 transition-all active:scale-95 shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
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
                        className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] hover:brightness-110 transition-all active:scale-95 shadow-xl disabled:opacity-40 border border-amber-400/30 bg-amber-400/10 text-amber-400"
                      >
                        <span className={`material-symbols-outlined text-sm ${isShufflingPool ? "animate-spin" : ""}`}>
                          {isShufflingPool ? "refresh" : "shuffle"}
                        </span>
                        {isShufflingPool ? "Shuffling…" : "Shuffle Lot Order First"}
                      </button>
                    )
                  )}

                  {!currentLot && soldState === "pending" && playerQueue.length > 0 && (
                    shuffleReady ? (
                      <button
                        onClick={handleStartNextPlayer}
                        disabled={isBusy}
                        className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] hover:brightness-110 transition-all active:scale-95 shadow-xl disabled:opacity-40"
                        style={{ background: "linear-gradient(135deg,#C9920A,#F5B400)", color: "#1a0e00" }}
                      >
                        <span className="material-symbols-outlined text-sm">play_arrow</span>
                        Start First Player
                      </button>
                    ) : (
                      <button
                        onClick={handleFixShuffle}
                        disabled={isShufflingPool}
                        className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.2em] hover:brightness-110 transition-all active:scale-95 shadow-xl disabled:opacity-40 border border-amber-400/30 bg-amber-400/10 text-amber-400"
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

              {/* Player info + bidding controls */}
              <div className="flex-1 space-y-4">
                <div className="space-y-1">
                  <span
                    className="font-mono-geist text-xs tracking-[0.3em] uppercase font-bold"
                    style={{
                      color:
                        soldState === "sold"
                          ? "#F5B400"
                          : soldState === "unsold"
                          ? "#718096"
                          : "#e45d35",
                    }}
                  >
                    {blockLabel}
                  </span>
                  <h2 className="font-archivo text-5xl text-white tracking-tight font-bold italic uppercase">
                    {currentLot?.playerName ?? "—"}
                  </h2>
                  <div className="flex gap-3 items-center flex-wrap">
                    <span className="px-3 py-1 bg-white/10 rounded font-mono-geist text-[10px] uppercase tracking-[0.18em]">
                      {currentLot?.playerRole ?? "—"} | {currentLot?.playerCountry ?? "—"}
                    </span>
                    <span className="px-3 py-1 bg-white/10 rounded font-mono-geist text-[10px] uppercase tracking-[0.18em]">
                      Base: {(currentLot?.basePrice ?? 0).toLocaleString()} pts
                    </span>
                    {currentPlayer?.capped && (
                      <span className="px-3 py-1 bg-amber-400/10 border border-amber-400/20 rounded font-mono-geist text-[10px] uppercase tracking-[0.18em] text-amber-400">
                        Capped
                      </span>
                    )}
                  </div>
                </div>

                {/* Current bid display */}
                {currentLot && (
                  <div className="p-4 glass-panel rounded-xl">
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <p className="font-['Geist'] text-[9px] text-on-surface-variant uppercase tracking-[0.18em] mb-1">
                          Current High Bid
                        </p>
                        <p className="font-archivo text-4xl font-bold text-amber-400">
                          {currentLot.currentBid.toLocaleString()}
                          <span className="text-sm opacity-50 ml-1">pts</span>
                        </p>
                      </div>
                      {winningTeam && (
                        <div className="text-right">
                          <p className="font-['Geist'] text-[9px] text-on-surface-variant uppercase tracking-[0.1em] mb-1">
                            Leading
                          </p>
                          <p className="font-archivo text-xl font-bold text-white">{winningTeam.code}</p>
                        </div>
                      )}
                    </div>
                    {soldState === "pending" && (
                      <p className="font-['Geist'] text-[10px] text-on-surface-variant">
                        Next bid: <span className="text-amber-400 font-bold">{nextBidAmount.toLocaleString()} pts</span>
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
                <span className="material-symbols-outlined text-amber-400 text-lg">monitoring</span>
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
                    No bids yet
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
                        <td className="px-6 py-4 font-archivo font-semibold text-amber-400">
                          {b.amount.toLocaleString()} pts
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
                  {avgPurse.toLocaleString()}
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
              const purse     = team.supabaseId ? teamPurses[team.supabaseId] : null;
              const roster    = purse?.roster    ?? team.roster ?? 0;
              const remaining = purse?.remaining ?? auction.rules.totalPoints;
              const totalPoints = auction.rules.totalPoints;
              const pctFilled = Math.round((remaining / Math.max(totalPoints, 1)) * 100);
              const isFull = roster >= auction.rules.teamSize;

              return (
                <div
                  key={team.supabaseId ?? team.id}
                  className={`p-5 glass-panel rounded-xl transition-all relative overflow-hidden group ${
                    isFull
                      ? "opacity-50 grayscale cursor-not-allowed"
                      : "hover:border-amber-400/40 cursor-pointer"
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
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-amber-400 transition-colors">
                      {isFull ? "lock" : "info"}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between font-mono-geist text-[10px] uppercase tracking-[0.1em] font-bold">
                      <span className="text-on-surface-variant">Remaining Budget</span>
                      <span className="font-archivo text-[13px] font-semibold text-on-surface">
                        {remaining.toLocaleString()} pts
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-1000"
                        style={{
                          width: `${pctFilled}%`,
                          background: isFull ? "rgba(255,255,255,0.2)" : "linear-gradient(90deg,#C9920A,#F5B400)",
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
    </div>
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
      <DesktopOnlyWrapper>
        <AuctioneerContent auctionId={auctionId} />
      </DesktopOnlyWrapper>
    </AuctionProvider>
  );
}