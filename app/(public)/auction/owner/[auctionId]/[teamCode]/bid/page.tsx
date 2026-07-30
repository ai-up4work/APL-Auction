// app/owner/[auctionId]/[teamCode]/(protected)/bid/page.tsx
"use client";

import React, { use, useEffect, useRef, useState, useCallback } from "react";
import BottomNavBar from "@/components/BottomNavBar";
import { ShotClockProvider, useShotClock } from "@/context/ShotClockContext";
import { useOwner } from "@/context/OwnerContext";
import {
  AuctionStatusOverlay,
  type AuctionStatus,
} from "@/components/OwnerAuctionStatusOverlay";
import {
  loadLiveState,
  subscribeToLot,
  subscribeToBids,
  placeBid,
  getNextBidAmount,
  type AuctionLot,
  type BidEntry,
} from "@/lib/auctionLiveDb";
import { loadAuction } from "@/lib/auctionDb";
import Image from "next/image";

// Matches --color-theme-orange in globals.css. Used as the fallback accent
// whenever a team has no color of its own.
const BID_COLOR = "#c9971f";

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,400;1,700&family=Geist+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');

  @keyframes pulse-glow {
    0%,100% { text-shadow: 0 0 20px rgba(201,151,31,0.3); }
    50%      { text-shadow: 0 0 60px rgba(201,151,31,0.9), 0 0 120px rgba(201,151,31,0.4); }
  }
  @keyframes ping-ring {
    0%   { transform: scale(1); opacity: 0.75; }
    100% { transform: scale(2.5); opacity: 0; }
  }
  @keyframes bid-flash {
    0%   { background: rgba(201,151,31,0.18); }
    100% { background: transparent; }
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes timer-pulse {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.3; }
  }
  @keyframes stamp-in {
    0%   { transform: scale(2.5) rotate(-12deg); opacity: 0; }
    60%  { transform: scale(0.9) rotate(-12deg); opacity: 1; }
    100% { transform: scale(1) rotate(-12deg); opacity: 1; }
  }

  .animate-pulse-bid   { animation: pulse-glow 1.8s infinite ease-in-out; }
  .animate-ping-ring   { animation: ping-ring 1.2s infinite ease-out; }
  .animate-bid-flash   { animation: bid-flash 0.5s ease-out forwards; }
  .animate-slide-up    { animation: slide-up 0.2s ease-out forwards; }
  .animate-timer-pulse { animation: timer-pulse 0.7s ease-in-out infinite; }
  .animate-stamp       { animation: stamp-in 0.35s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }

  .glass {
    background: rgba(16,20,21,0.70);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,0.08);
  }
  .glass-hot {
    background: rgba(201,151,31,0.06);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(201,151,31,0.22);
  }

  .ms {
    font-family: 'Material Symbols Outlined';
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    font-style: normal;
    line-height: 1;
    display: inline-block;
    user-select: none;
  }
  .ms-fill { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
  .ms-bold { font-variation-settings: 'FILL' 0, 'wght' 700, 'GRAD' 0, 'opsz' 24; }

  .snap-scroll {
    scroll-snap-type: y proximity;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .snap-scroll::-webkit-scrollbar { display: none; }
  .snap-target { scroll-snap-align: start; scroll-snap-stop: normal; }

  .bid-history-scroll {
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(201,151,31,0.4) rgba(255,255,255,0.03);
  }
  .bid-history-scroll::-webkit-scrollbar { width: 3px; }
  .bid-history-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 99px; }
  .bid-history-scroll::-webkit-scrollbar-thumb { background: rgba(201,151,31,0.45); border-radius: 99px; }

  .f-display  { font-family: 'Archivo Narrow', sans-serif; font-style: italic; font-weight: 700; text-transform: uppercase; letter-spacing: -0.02em; }
  .f-label    { font-family: 'Geist Mono', monospace; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; }
  .f-label-sm { font-family: 'Geist Mono', monospace; font-weight: 500; text-transform: uppercase; letter-spacing: 0.12em; }
  .f-body     { font-family: 'Inter', sans-serif; }
  .f-num      { font-family: 'Archivo Narrow', sans-serif; font-weight: 700; letter-spacing: -0.02em; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// BID ROOM
// ─────────────────────────────────────────────────────────────────────────────
function BidRoom({ auctionId, teamCode }: { auctionId: string; teamCode: string }) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const bidCardRef = useRef<HTMLDivElement>(null);
  const flashRef   = useRef<HTMLDivElement>(null);

  const { shotClock, isLocked, resetClock, freezeClock, pauseClock } = useShotClock();

  // Team / rules / purse / roster / auction status all come from the shared
  // OwnerProvider (set up in the (protected) layout) — no duplicate fetch or
  // duplicate realtime subscription here. teamLogos is derived locally from
  // a one-off Supabase read since OwnerContext only tracks the current team.
  const { auction, team, rules, loading: ownerLoading } = useOwner();

  const [teamLogos,     setTeamLogos]     = useState<Record<string, string>>({});
  const [currentLot,    setCurrentLot]    = useState<AuctionLot | null>(null);
  const [bidHistory,    setBidHistory]    = useState<BidEntry[]>([]);
  const [completedLots, setCompletedLots] = useState<AuctionLot[]>([]);
  const [auctionStatus, setAuctionStatus] = useState<AuctionStatus>("live");

  const [isSold,     setIsSold]     = useState(false);
  const [isUnsold,   setIsUnsold]   = useState(false);
  const [isPlacing,  setIsPlacing]  = useState(false);
  const [bidError,   setBidError]   = useState("");
  const [bidSuccess, setBidSuccess] = useState(false);
  const [loading,    setLoading]    = useState(true);

  const purse       = team?.remainingPurse ?? 0;
  const roster      = team?.roster ?? 0;
  const totalPoints = rules?.totalPoints ?? 50000;
  const teamSize    = rules?.teamSize ?? 16;

  const currentLotRef    = useRef(currentLot);
  const rulesRef         = useRef(rules);
  const teamRef          = useRef(team);
  const purseRef         = useRef(purse);
  const isLockedRef      = useRef(isLocked);
  const isPlacingRef     = useRef(isPlacing);
  const auctionStatusRef = useRef(auctionStatus);

  useEffect(() => { currentLotRef.current    = currentLot;    }, [currentLot]);
  useEffect(() => { rulesRef.current         = rules;         }, [rules]);
  useEffect(() => { teamRef.current          = team;          }, [team]);
  useEffect(() => { purseRef.current         = purse;         }, [purse]);
  useEffect(() => { isLockedRef.current      = isLocked;      }, [isLocked]);
  useEffect(() => { isPlacingRef.current     = isPlacing;     }, [isPlacing]);
  useEffect(() => { auctionStatusRef.current = auctionStatus; }, [auctionStatus]);

  // Keep local auctionStatus in sync with the context once it's loaded.
  useEffect(() => {
    if (auction?.status) setAuctionStatus(auction.status as AuctionStatus);
  }, [auction?.status]);

  // ── Load lot/bid state + team logos (lot/bid data is NOT in OwnerContext) ──
  useEffect(() => {
    async function init() {
      const [liveData, auctionState] = await Promise.all([
        loadLiveState(auctionId),
        loadAuction(auctionId),
      ]);

      if (auctionState) {
        const logoMap: Record<string, string> = {};
        auctionState.teams.forEach((t) => {
          const logo = (t as any).logo;
          if (logo) logoMap[t.code.toLowerCase()] = logo;
        });
        setTeamLogos(logoMap);
      }

      setCurrentLot(liveData.currentLot);
      setBidHistory(liveData.bidHistory);
      setCompletedLots(liveData.completedLots);

      if (liveData.currentLot?.status === "sold") {
        setIsSold(true);
        freezeClock();
      } else if (liveData.currentLot?.status === "unsold") {
        setIsUnsold(true);
        freezeClock();
      } else if (liveData.currentLot?.status === "shuffling") {
        pauseClock();
      } else if (liveData.currentLot?.startedAt) {
        resetClock(liveData.currentLot.startedAt);
      } else {
        pauseClock();
      }

      setLoading(false);
    }
    init().catch(console.error);
  }, [auctionId, teamCode, resetClock, freezeClock, pauseClock]);

  // ── Realtime subscriptions: lot + bids only. Purse/roster/status realtime
  // is already handled inside OwnerProvider — subscribing again here would
  // hit the same "cannot add postgres_changes callbacks after subscribe()"
  // channel-topic collision. ─────────────────────────────────────────────────
  useEffect(() => {
    const lotSub = subscribeToLot(auctionId, (lot) => {
      const cur = currentLotRef.current;
      if (cur && lot.id !== cur.id && (lot.status === "sold" || lot.status === "unsold")) return;

      if (lot.status === "shuffling" && cur?.id !== lot.id) {
        setCurrentLot(lot);
        setBidHistory([]);
        setIsSold(false);
        setIsUnsold(false);
        setBidError("");
        setBidSuccess(false);
        pauseClock();
        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (lot.status === "pending") {
        const isNewLot = cur?.id !== lot.id;
        setCurrentLot(lot);
        if (isNewLot) {
          setBidHistory([]);
        }
        setIsSold(false);
        setIsUnsold(false);
        setBidError("");
        setBidSuccess(false);
        resetClock(lot.startedAt!);
        return;
      }

      setCurrentLot(lot);
      if (lot.status === "sold") {
        setIsSold(true);
        setIsUnsold(false);
        freezeClock();
        setCompletedLots((prev) => (prev.some((l) => l.id === lot.id) ? prev : [lot, ...prev]));
      }
      if (lot.status === "unsold") {
        setIsUnsold(true);
        setIsSold(false);
        freezeClock();
        setCompletedLots((prev) => (prev.some((l) => l.id === lot.id) ? prev : [lot, ...prev]));
      }
    }, () => currentLotRef.current?.id ?? null);

    const bidSub = subscribeToBids(auctionId, (bid) => {
      if (bid.lotId !== currentLotRef.current?.id) return;
      setBidHistory((prev) => [bid, ...prev].slice(0, 50));
      setCurrentLot((prev) =>
        prev
          ? { ...prev, currentBid: bid.amount, winningTeamCode: bid.teamCode, winningTeamId: bid.teamId }
          : prev
      );
      resetClock(bid.placedAt, true);
      if (flashRef.current) {
        flashRef.current.classList.remove("animate-bid-flash");
        void flashRef.current.offsetWidth;
        flashRef.current.classList.add("animate-bid-flash");
      }
    });

    return () => {
      lotSub.unsubscribe();
      bidSub.unsubscribe();
    };
  }, [auctionId, resetClock, freezeClock, pauseClock]);

  // ── Bid ───────────────────────────────────────────────────────────────────
  const handleBid = useCallback(async () => {
    const t = teamRef.current;
    if (!currentLotRef.current || currentLotRef.current.status !== "pending" || isPlacingRef.current || !t) return;

    if (auctionStatusRef.current !== "live") {
      setBidError(
        auctionStatusRef.current === "paused"
          ? "Bidding is paused by the auctioneer."
          : "This auction has ended."
      );
      setTimeout(() => setBidError(""), 3000);
      return;
    }

    if (isLockedRef.current) {
      setBidError("Time's up — awaiting auctioneer decision.");
      setTimeout(() => setBidError(""), 3000);
      return;
    }
    if (currentLotRef.current.winningTeamId === t.id) {
      setBidError("You're already the highest bidder.");
      setTimeout(() => setBidError(""), 3000);
      return;
    }

    // ── NEW: squad-full check ──
    const teamSizeLimit = rulesRef.current?.teamSize ?? 16;
    if ((t.roster ?? 0) >= teamSizeLimit) {
      setBidError("Your squad is already full — you can't bid on more players.");
      setTimeout(() => setBidError(""), 3000);
      return;
    }

    const amount = getNextBidAmount(currentLotRef.current.currentBid, rulesRef.current?.tiers ?? []);
    if (amount > purseRef.current) {
      setBidError("Insufficient purse for this bid.");
      setTimeout(() => setBidError(""), 3000);
      return;
    }
    setIsPlacing(true);
    setBidError("");
    try {
      await placeBid(currentLotRef.current.id, auctionId, t.id, t.code, t.name, t.color, amount);
      resetClock(Date.now(), true);
      setBidSuccess(true);
      setTimeout(() => setBidSuccess(false), 1500);
    } catch (err: any) {
      setBidError(err?.message ?? "Bid failed. Try again.");
      setTimeout(() => setBidError(""), 3000);
    } finally {
      setIsPlacing(false);
    }
  }, [auctionId, resetClock]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const nextBid     = currentLot ? getNextBidAmount(currentLot.currentBid, rules?.tiers ?? []) : 0;
  const purgePct    = Math.min((purse / Math.max(totalPoints, 1)) * 100, 100);
  const isLeading   = !!team && currentLot?.winningTeamId === team.id;
  const isRevealing = currentLot?.status === "shuffling";
  const isPaused    = auctionStatus === "paused";
  const isEnded     = auctionStatus === "completed";

  // Bidding is only allowed when auction is live
  const canBid =
    !!currentLot && currentLot.status === "pending" &&
    auctionStatus === "live" &&
    !isPlacing && !isLocked && nextBid <= purse &&
    roster < teamSize &&                          // ← new
    currentLot.winningTeamId !== team?.id;

  const fmt = (n: number) => n.toLocaleString();

  const bidLabel =
    isPaused          ? "AUCTION PAUSED"
    : isEnded         ? "AUCTION ENDED"
    : bidSuccess      ? "BID PLACED!"
    : isPlacing       ? "PLACING…"
    : !currentLot     ? "AWAITING LOT"
    : isRevealing     ? "AWAITING REVEAL"
    : isSold          ? "LOT CLOSED"
    : isUnsold        ? "LOT UNSOLD"
    : isLocked        ? "TIME'S UP"
    : isLeading       ? "YOU'RE LEADING"
    : roster >= teamSize ? "SQUAD FULL"           // ← new
    : nextBid > purse ? "INSUFFICIENT PURSE"
    : `PLACE BID — ${fmt(nextBid)}`;

  const bidIcon =
    isPaused || isEnded ? "pause_circle"
    : bidSuccess        ? "check_circle"
    : isPlacing         ? "progress_activity"
    : isRevealing       ? "visibility_off"
    : isLeading         ? "emoji_events"
    : isLocked          ? "timer_off"
    : "gavel";

  if (loading || ownerLoading) {
    return (
      <div className="h-dvh bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-theme-orange/15 border-t-theme-orange rounded-full animate-spin mx-auto mb-4" />
          <p className="f-label text-[#5a6a74] text-[10px]">Loading Auction Room</p>
        </div>
      </div>
    );
  }

  // ── KEY CHANGE: paused / completed renders inline in place of bid content.
  // The outer shell (header + BottomNavBar) always stays visible.
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-background text-on-background h-dvh flex flex-col overflow-hidden font-inter">
      <div ref={flashRef} className="fixed inset-0 pointer-events-none z-[999]" />

      {/* ── HEADER ── always visible */}
      <header className="shrink-0 z-50 h-14 flex items-center justify-between px-4
                         bg-background/[0.92] backdrop-blur-xl border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
            style={{ backgroundColor: team?.logo ? "transparent" : (team?.color || BID_COLOR) }}
          >
            {team?.logo ? (
              <Image
                src={team.logo}
                alt={team.name}
                width={32}
                height={32}
                className="object-cover w-full h-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="f-display text-[13px] text-white not-italic">
                {team?.code.slice(0, 2) ?? "—"}
              </span>
            )}
          </div>
          <div>
            <p className="f-display text-[15px] text-white leading-none tracking-[-0.01em]">
              {team?.name ?? teamCode.toUpperCase()}
            </p>
            <p className="f-label-sm text-[#a0aec0] text-[9px] leading-none mt-[3px]">
              {fmt(purse)} Points REMAINING
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLeading && !isSold && !isUnsold && auctionStatus === "live" && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-orange/15 border border-theme-orange/50">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-theme-orange" />
              <span className="f-label text-[9px] text-theme-orange">LEADING</span>
            </div>
          )}

          {/* Status pill reflects real auction status */}
          <div
            className={[
              "flex items-center gap-1.5 px-3 py-1 rounded-full border",
              isPaused ? "bg-amber-500/[0.12] border-amber-500/30"
                : isEnded ? "bg-gray-500/[0.12] border-gray-500/30"
                : "bg-emerald-500/[0.08] border-emerald-500/20",
            ].join(" ")}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${auctionStatus === "live" ? "bg-emerald-400 animate-pulse" : isPaused ? "bg-amber-400" : "bg-gray-400"}`}
            />
            <span className={`f-label text-[9px] ${isPaused ? "text-amber-400" : isEnded ? "text-gray-400" : "text-emerald-400"}`}>
              {auctionStatus.toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      {/* ── CONTENT AREA — switches between bid room and status block ── */}
      {/* BottomNavBar pb spacer is always present below */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden pb-[68px]">

        {/* PAUSED or COMPLETED: render inline status block, hide bid content */}
        {(isPaused || isEnded) ? (
          <AuctionStatusOverlay
            auctionId={auctionId}
            initialStatus={auctionStatus}
            onStatusChange={setAuctionStatus}
            accentColor={team?.color ?? BID_COLOR}
            purse={purse}
            roster={roster}
            teamSize={teamSize}
            totalPoints={totalPoints}
          />
        ) : (
          /* LIVE: normal bid room content */
          <>
            {/* We still need the overlay subscribed for status changes even
                when live, but we render null — the hook inside runs */}
            <AuctionStatusOverlay
              auctionId={auctionId}
              initialStatus={auctionStatus}
              onStatusChange={setAuctionStatus}
            />

            <div ref={scrollRef} className="snap-scroll flex-1 min-h-0">

              {/* ══ PAGE 1: Player card ══ */}
              <div className="snap-target flex flex-col gap-3 p-3 h-[calc(100dvh-56px-68px)]">
                <PlayerCard
                  lot={currentLot}
                  isSold={isSold}
                  isUnsold={isUnsold}
                  isRevealing={isRevealing}
                  completedCount={completedLots.length}
                />
                <button
                  onClick={() => {
                    if (!scrollRef.current || !bidCardRef.current) return;
                    const top =
                      bidCardRef.current.getBoundingClientRect().top -
                      scrollRef.current.getBoundingClientRect().top +
                      scrollRef.current.scrollTop;
                    scrollRef.current.scrollTo({ top, behavior: "smooth" });
                  }}
                  className="shrink-0 flex flex-col items-center gap-0.5 py-1 w-full opacity-40"
                >
                  <span className="f-label text-[#c6c6cd] text-[12px]">PLACE BID</span>
                  <span className="ms text-[#c6c6cd] text-lg">expand_more</span>
                </button>
              </div>

              {/* ══ PAGE 2: Bid controls ══ */}
              <div className="snap-target flex flex-col gap-3 p-3 h-[calc(100dvh-56px-68px)]">

                {/* ── Current bid card ── */}
                <div
                  ref={bidCardRef}
                  className="glass-hot rounded-2xl px-5 pt-5 pb-4 shrink-0 relative overflow-hidden"
                >
                  <div className="absolute -bottom-4 -right-4 pointer-events-none opacity-[0.04]">
                    <span className="ms ms-fill text-white" style={{ fontSize: 160 }}>gavel</span>
                  </div>

                  <p className="f-label text-[10px] text-[#5a6a74] mb-1">CURRENT HIGH BID</p>

                  <div className="flex items-end gap-2 mb-1">
                    <span
                      className={`f-display leading-none text-[clamp(72px,18vw,96px)] ${currentLot && !isLocked && !isSold && !isUnsold && !isRevealing ? "animate-pulse-bid" : ""}`}
                      style={{
                        color: isSold ? BID_COLOR : isUnsold ? "#6b7280" : isLocked || isRevealing ? "#374151" : BID_COLOR,
                      }}
                    >
                      {currentLot && !isRevealing ? fmt(currentLot.currentBid) : "—"}
                    </span>
                    <span className="f-label text-[11px] text-[#5a6a74] mb-3">Points</span>
                  </div>

                  {isRevealing && (
                    <p className="f-label text-[10px] text-theme-orange animate-timer-pulse mb-3">
                      AWAITING REVEAL ON BROADCAST SCREEN…
                    </p>
                  )}

                  {isLocked && !isRevealing && !isSold && !isUnsold && (
                    <p className="f-label text-[10px] text-red-400 animate-timer-pulse mb-3">
                      TIME'S UP — AWAITING AUCTIONEER DECISION
                    </p>
                  )}

                  <div className="w-full h-px mb-3 bg-gradient-to-r from-transparent via-theme-orange/25 to-transparent" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-theme-orange/[0.12] border border-theme-orange/25">
                        <span className="ms ms-fill text-[16px] text-theme-orange">groups</span>
                      </div>
                      <div>
                        <p className="f-label-sm text-[8px] text-[#5a6a74]">LEADER</p>
                        <p className="f-display text-[18px] text-white leading-none not-italic">
                          {isRevealing ? "—" : (currentLot?.winningTeamCode ?? "—")}
                        </p>
                      </div>
                    </div>

                    {currentLot && !isSold && !isUnsold && !isRevealing && !isLocked && !isLeading && (
                      <div className="text-right">
                        <p className="f-label-sm text-[8px] text-[#5a6a74]">NEXT BID</p>
                        <p className="f-num text-[18px] text-theme-orange">{fmt(nextBid)} Points</p>
                      </div>
                    )}
                    {isLeading && !isSold && !isUnsold && !isRevealing && !isLocked && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-orange/10 border border-theme-orange/25">
                        <span className="ms ms-fill text-[14px] text-theme-orange">emoji_events</span>
                        <span className="f-label text-[9px] text-theme-orange">YOU'RE LEADING</span>
                      </div>
                    )}
                    {isSold && <span className="f-display text-[18px] text-theme-orange">SOLD</span>}
                    {isUnsold && <span className="f-display text-[18px] text-gray-400">UNSOLD</span>}
                    {isRevealing && (
                      <div className="flex items-center gap-1.5 text-theme-orange">
                        <span className="ms ms-fill text-[18px] animate-spin">autorenew</span>
                        <span className="f-label text-[10px]">REVEALING</span>
                      </div>
                    )}
                    {isLocked && !isSold && !isUnsold && !isRevealing && (
                      <div className="flex items-center gap-1.5 text-red-400">
                        <span className="ms ms-bold text-[18px]">timer_off</span>
                        <span className="f-label text-[10px]">LOCKED</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Budget Health ── */}
                <div className="glass rounded-xl px-4 pt-3 pb-4 shrink-0">
                  <p className="f-label text-[10px] text-[#5a6a74] mb-3">BUDGET HEALTH</p>
                  <div className="mb-3">
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="f-label-sm text-[9px] text-[#7a8a94]">PURSE REMAINING</span>
                      <span className="f-num text-[15px] text-white">
                        {fmt(purse)} <span className="text-[#5a6a74] text-[11px] font-normal">/ {fmt(totalPoints)}</span>
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden bg-white/[0.06]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${purgePct}%`,
                          background: purgePct < 25 ? "#ef4444" : BID_COLOR,
                          boxShadow: `0 0 10px ${purgePct < 25 ? "#ef444460" : `${BID_COLOR}60`}`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="f-label-sm text-[9px] text-[#7a8a94]">SQUAD FILLED</span>
                    <span className="f-num text-[20px] text-white">
                      {roster} <span className="text-[#5a6a74] text-[14px] font-normal">/ {teamSize}</span>
                    </span>
                  </div>
                </div>

                {/* ── Error ── */}
                {bidError && (
                  <div className="shrink-0 px-4 py-3 rounded-xl animate-slide-up bg-red-500/[0.08] border border-red-500/20">
                    <p className="f-label text-[10px] text-red-400">{bidError}</p>
                  </div>
                )}

                {/* ── BID BUTTON ── */}
                <button
                  onClick={handleBid}
                  disabled={!canBid}
                  className={[
                    "shrink-0 w-full py-[18px] rounded-xl flex items-center justify-center gap-3",
                    "active:scale-[0.97] transition-all duration-150",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    isLeading ? "border border-theme-orange/30" : isLocked || isRevealing ? "border border-red-500/30" : "border-none",
                  ].join(" ")}
                  style={{
                    background:
                      bidSuccess  ? "#22c55e"
                      : isLeading ? "#0f1f0f"
                      : isLocked || isRevealing ? "#1a0a08"
                      : canBid    ? BID_COLOR
                      : "#1a1e1f",
                    boxShadow:
                      canBid && !isLocked && !isLeading && !isRevealing
                        ? `0 6px 32px ${BID_COLOR}50`
                        : "none",
                  }}
                >
                  <span className={`ms ms-fill text-[22px] text-white ${isPlacing ? "animate-spin" : isLocked || isRevealing ? "animate-timer-pulse" : ""}`}>
                    {bidIcon}
                  </span>
                  <span className="f-display text-[17px] text-white not-italic tracking-[0.04em]">
                    {bidLabel}
                  </span>
                </button>

                {/* ── Bid History ── */}
                <div className="flex-1 min-h-0 glass rounded-xl overflow-hidden flex flex-col">
                  <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] flex justify-between items-center bg-[rgba(16,20,21,0.60)]">
                    <p className="f-label text-[10px] text-[#c6c6cd]">BID HISTORY</p>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      </span>
                      <span className="f-label text-[9px] text-[#c6c6cd]">LIVE</span>
                    </div>
                  </div>

                  <div className="bid-history-scroll flex-1 min-h-0 divide-y divide-white/[0.04]">
                    {bidHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
                        <span className="ms text-[#2a3a44] text-4xl">gavel</span>
                        <p className="f-label text-[9px] text-[#3a4a54]">NO BIDS YET</p>
                      </div>
                    ) : (
                      bidHistory.map((bid, i) => {
                        const isMe  = bid.teamId === team?.id;
                        const isTop = i === 0;
                        return (
                          <div
                            key={bid.id}
                            className={`px-4 py-3 flex items-center justify-between transition-colors ${isTop ? "animate-slide-up" : ""} ${isMe ? "bg-theme-orange/5" : ""}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={[
                                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
                                  teamLogos[bid.teamCode.toLowerCase()] ? "bg-transparent" : isMe ? "bg-theme-orange/[0.10]" : "bg-white/5",
                                  isMe ? "border border-theme-orange/35" : "border border-white/[0.07]",
                                ].join(" ")}
                              >
                                {teamLogos[bid.teamCode.toLowerCase()] ? (
                                  <Image
                                    src={teamLogos[bid.teamCode.toLowerCase()]}
                                    alt={bid.teamName}
                                    width={28}
                                    height={28}
                                    className="object-contain w-full h-full p-0"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <span className={`f-display text-[11px] not-italic ${isMe ? "text-theme-orange" : "text-[#c6c6cd]"}`}>
                                    {bid.teamCode.slice(0, 2)}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`f-body text-[13px] font-semibold truncate ${isMe ? "text-white" : "text-[#c6c6cd]"}`}>
                                    {bid.teamName}
                                  </p>
                                  {isMe && (
                                    <span className="f-label text-[8px] px-1.5 py-0.5 rounded shrink-0 bg-theme-orange/[0.18] text-theme-orange border border-theme-orange/30">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <p className="f-label-sm text-[8px] text-[#3a4a54] mt-0.5">
                                  {new Date(bid.placedAt).toLocaleTimeString([], {
                                    hour: "2-digit", minute: "2-digit", second: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                            <span className={`f-num text-[16px] shrink-0 tabular-nums ${isTop ? "text-theme-orange" : isMe ? "text-theme-orange/75" : "text-[#e0e3e4]"}`}>
                              {fmt(bid.amount)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── BOTTOM NAV — always visible regardless of auction status ── */}
      <BottomNavBar />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER CARD
// ─────────────────────────────────────────────────────────────────────────────
function PlayerCard({
  lot, isSold, isUnsold, isRevealing, completedCount,
}: {
  lot: AuctionLot | null;
  isSold: boolean;
  isUnsold: boolean;
  isRevealing: boolean;
  completedCount: number;
}) {
  if (!lot) {
    const hasStarted = completedCount > 0;
    return (
      <section className="glass rounded-xl flex-1 min-h-0 flex flex-col items-center justify-center gap-4">
        <span className="ms text-[#2a3a44]" style={{ fontSize: 90 }}>
          {hasStarted ? "pending" : "hourglass_empty"}
        </span>
        <div className="text-center">
          <p className="f-display text-[45px] text-white mb-1">
            {hasStarted ? "NEXT LOT SOON" : "AWAITING LOT"}
          </p>
          <p className="f-label text-[12px] text-[#3a4a54]">
            {hasStarted
              ? `${completedCount} LOT${completedCount !== 1 ? "S" : ""} COMPLETED — STAY READY`
              : "AUCTIONEER HASN'T STARTED YET"}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="glass rounded-xl overflow-hidden relative flex-1 min-h-0 flex flex-col">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {lot.playerImg ? (
          <img
            src={lot.playerImg}
            alt={isRevealing ? "Player on the block" : lot.playerName}
            className="w-full h-full object-cover object-top"
            style={{
              filter: isRevealing
                ? "blur(18px) grayscale(0.6) brightness(0.7)"
                : isSold || isUnsold
                ? "grayscale(0.7) brightness(0.4)"
                : "grayscale(0.1) contrast(1.15)",
            }}
          />
        ) : (
          <div className="w-full h-full bg-[#1a1e1f] flex items-center justify-center">
            <span className="ms text-[#2a3a44]" style={{ fontSize: 96 }}>person</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

        <div className="absolute top-3 left-3 z-10">
          <span className="f-label text-[9px] px-3 py-1 rounded-full bg-theme-orange text-background">
            LOT #{lot.lotNumber} • {isRevealing ? "REVEALING" : isSold ? "SOLD" : isUnsold ? "UNSOLD" : "ON THE BLOCK"}
          </span>
        </div>

        {(isSold || isUnsold) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div
              className={[
                "animate-stamp border-[5px] rounded-xl px-5 py-2 bg-background/35 -rotate-12",
                isSold ? "border-theme-orange text-theme-orange" : "border-gray-500 text-gray-500",
              ].join(" ")}
            >
              <span className="f-display text-[40px]">{isSold ? "SOLD" : "UNSOLD"}</span>
            </div>
          </div>
        )}

        {isRevealing && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <span className="ms ms-fill text-theme-orange animate-spin" style={{ fontSize: 40 }}>autorenew</span>
            <p className="f-label text-[10px] text-theme-orange">REVEALING ON BROADCAST…</p>
          </div>
        )}

        <div className="absolute bottom-2 left-3 right-3 z-10">
          <h1 className="f-display text-[32px] text-white leading-none mb-1">
            {isRevealing ? "???" : lot.playerName}
          </h1>
          <div className="flex items-center gap-2">
            <span className="f-label text-[10px] text-theme-orange">
              {isRevealing ? "—" : lot.playerRole.toUpperCase()}
            </span>
            <span className="w-1 h-1 rounded-full bg-[#3a4a54]" />
            <span className="f-label-sm text-[9px] text-[#c6c6cd]">
              {isRevealing ? "—" : (lot.playerCountry || "—")}
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 grid grid-cols-3 gap-2 p-2.5">
        {[
          { label: "BASE",    value: isRevealing ? "—" : `${lot.basePrice.toLocaleString()} Points`, accent: true  },
          { label: "COUNTRY", value: isRevealing ? "—" : (lot.playerCountry || "—"),              accent: false },
          { label: "ROLE",    value: isRevealing ? "—" : (lot.playerRole    || "—"),              accent: false },
        ].map((s) => (
          <div key={s.label} className="p-2.5 rounded-lg bg-[#141818] border border-white/[0.06]">
            <p className="f-label-sm text-[8px] text-[#5a6a74] mb-1">{s.label}</p>
            <p className={`f-num text-[14px] truncate ${s.accent ? "text-theme-orange" : "text-[#e0e3e4]"}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOCK WRAPPER
// ─────────────────────────────────────────────────────────────────────────────
function BidRoomWithClock({ auctionId, teamCode }: { auctionId: string; teamCode: string }) {
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);

  useEffect(() => {
    loadAuction(auctionId)
      .then((state) => setTimerSeconds(state?.session?.timerSeconds ?? 15))
      .catch(() => setTimerSeconds(15));
  }, [auctionId]);

  if (timerSeconds === null) return null;

  return (
    <ShotClockProvider timerSeconds={timerSeconds}>
      <BidRoom auctionId={auctionId} teamCode={teamCode} />
    </ShotClockProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function OwnerPage({
  params,
}: {
  params: Promise<{ auctionId: string; teamCode: string }>;
}) {
  const { auctionId, teamCode } = use(params);
  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <BidRoomWithClock auctionId={auctionId} teamCode={teamCode} />
    </>
  );
}