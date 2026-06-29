"use client";

import React, { use, useEffect, useRef, useState, useCallback } from "react";
import MobileOnlyWrapper from "@/components/MobileOnlyWrapper";
import BottomNavBar from "@/components/BottomNavBar";
import { ShotClockProvider, useShotClock } from "@/context/ShotClockContext";
import {
  loadLiveState,
  loadTeamPurses,
  subscribeToLot,
  subscribeToBids,
  subscribeToTeamPurses,
  placeBid,
  getNextBidAmount,
  type AuctionLot,
  type BidEntry,
} from "@/lib/auctionLiveDb";
import { loadAuction } from "@/lib/auctionDb";
import type { AuctionRules } from "@/types/auction";

const BID_COLOR = "#e45d35";

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,400;1,700&family=Geist+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');

  @keyframes pulse-glow {
    0%,100% { text-shadow: 0 0 20px rgba(228,93,53,0.3); }
    50%      { text-shadow: 0 0 60px rgba(228,93,53,0.9), 0 0 120px rgba(228,93,53,0.4); }
  }
  @keyframes ping-ring {
    0%   { transform: scale(1); opacity: 0.75; }
    100% { transform: scale(2.5); opacity: 0; }
  }
  @keyframes bid-flash {
    0%   { background: rgba(228,93,53,0.18); }
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
    background: rgba(228,93,53,0.06);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(228,93,53,0.22);
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
    scrollbar-color: rgba(228,93,53,0.4) rgba(255,255,255,0.03);
  }
  .bid-history-scroll::-webkit-scrollbar { width: 3px; }
  .bid-history-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 99px; }
  .bid-history-scroll::-webkit-scrollbar-thumb { background: rgba(228,93,53,0.45); border-radius: 99px; }

  .f-display  { font-family: 'Archivo Narrow', sans-serif; font-style: italic; font-weight: 700; text-transform: uppercase; letter-spacing: -0.02em; }
  .f-label    { font-family: 'Geist Mono', monospace; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; }
  .f-label-sm { font-family: 'Geist Mono', monospace; font-weight: 500; text-transform: uppercase; letter-spacing: 0.12em; }
  .f-body     { font-family: 'Inter', sans-serif; }
  .f-num      { font-family: 'Archivo Narrow', sans-serif; font-weight: 700; letter-spacing: -0.02em; }
`;

interface TeamInfo {
  id:    string;
  name:  string;
  code:  string;
  color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BID ROOM
// ─────────────────────────────────────────────────────────────────────────────
function BidRoom({ auctionId, teamCode }: { auctionId: string; teamCode: string }) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const bidCardRef = useRef<HTMLDivElement>(null);
  const flashRef   = useRef<HTMLDivElement>(null);

  const { shotClock, isLocked, resetClock, freezeClock, pauseClock } = useShotClock();

  const [team,        setTeam]        = useState<TeamInfo | null>(null);
  const [rules,       setRules]       = useState<AuctionRules | null>(null);
  const [currentLot,  setCurrentLot]  = useState<AuctionLot | null>(null);
  const [bidHistory,  setBidHistory]  = useState<BidEntry[]>([]);
  const [purse,       setPurse]       = useState(0);
  const [roster,      setRoster]      = useState(0);
  const [totalPoints, setTotalPoints] = useState(50000);
  const [teamSize,    setTeamSize]    = useState(16);

  const [isSold,     setIsSold]     = useState(false);
  const [isUnsold,   setIsUnsold]   = useState(false);
  const [isPlacing,  setIsPlacing]  = useState(false);
  const [bidError,   setBidError]   = useState("");
  const [bidSuccess, setBidSuccess] = useState(false);
  const [loading,    setLoading]    = useState(true);

  const currentLotRef = useRef(currentLot);
  const rulesRef      = useRef(rules);
  const teamRef       = useRef(team);
  const isLockedRef   = useRef(isLocked);   // ← NEW
  const isPlacingRef  = useRef(isPlacing);  // ← NEW

  useEffect(() => { currentLotRef.current = currentLot; }, [currentLot]);
  useEffect(() => { rulesRef.current      = rules;      }, [rules]);
  useEffect(() => { teamRef.current       = team;       }, [team]);
  useEffect(() => { isLockedRef.current   = isLocked;   }, [isLocked]);   // ← NEW
  useEffect(() => { isPlacingRef.current  = isPlacing;  }, [isPlacing]);  // ← NEW

  // ── Load initial state ────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const [liveData, auctionState, purses] = await Promise.all([
        loadLiveState(auctionId),
        loadAuction(auctionId),
        loadTeamPurses(auctionId),
      ]);

      if (auctionState) {
        setRules(auctionState.rules);
        setTotalPoints(auctionState.rules.totalPoints);
        setTeamSize(auctionState.rules.teamSize);

        const found = auctionState.teams.find(
          (t) => t.code.toLowerCase() === teamCode.toLowerCase()
        );
        if (found) {
          setTeam({
            id:    found.supabaseId ?? "",
            name:  found.name,
            code:  found.code,
            color: found.color,
          });
          const myPurse = found.supabaseId ? purses[found.supabaseId] : null;
          setPurse(myPurse?.remaining ?? auctionState.rules.totalPoints);
          setRoster(myPurse?.roster ?? found.roster ?? 0);
        }
      }

      setCurrentLot(liveData.currentLot);
      setBidHistory(liveData.bidHistory);

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

  // ── Realtime subscriptions ────────────────────────────────────────────────
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
        setCurrentLot(lot);
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
      }
      if (lot.status === "unsold") {
        setIsUnsold(true);
        setIsSold(false);
        freezeClock();
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
        resetClock(bid.placedAt, true);   // ← force=true
        if (flashRef.current) {
          flashRef.current.classList.remove("animate-bid-flash");
          void flashRef.current.offsetWidth;
          flashRef.current.classList.add("animate-bid-flash");
        }
      });

    const purseSub = subscribeToTeamPurses(auctionId, (teamId, remaining, newRoster) => {
      if (teamId === teamRef.current?.id) {
        setPurse(remaining);
        setRoster(newRoster);
      }
    });

    return () => {
      lotSub.unsubscribe();
      bidSub.unsubscribe();
      purseSub.unsubscribe();
    };
  }, [auctionId, resetClock, freezeClock, pauseClock]);

  // ── Bid ───────────────────────────────────────────────────────────────────
  const handleBid = useCallback(async () => {
    const t = teamRef.current;
    // Read from refs — never stale closures
    if (!currentLotRef.current || currentLotRef.current.status !== "pending" || isPlacingRef.current || !t) return;
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
    const amount = getNextBidAmount(currentLotRef.current.currentBid, rulesRef.current?.tiers ?? []);
    if (amount > purse) {
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
  }, [auctionId, purse, resetClock]);  // ← isLocked and isPlacing removed, now read via refs

  // ── Derived ───────────────────────────────────────────────────────────────
  const nextBid     = currentLot ? getNextBidAmount(currentLot.currentBid, rules?.tiers ?? []) : 0;
  const purgePct    = Math.min((purse / Math.max(totalPoints, 1)) * 100, 100);
  const isLeading   = !!team && currentLot?.winningTeamId === team.id;
  const isRevealing = currentLot?.status === "shuffling";
  const canBid      =
    !!currentLot && currentLot.status === "pending" &&
    !isPlacing && !isLocked && nextBid <= purse &&
    currentLot.winningTeamId !== team?.id;

  const fmt = (n: number) => n.toLocaleString();

  const bidLabel =
    bidSuccess        ? "BID PLACED!"
    : isPlacing       ? "PLACING…"
    : !currentLot     ? "AWAITING LOT"
    : isRevealing     ? "AWAITING REVEAL"
    : isSold          ? "LOT CLOSED"
    : isUnsold        ? "LOT UNSOLD"
    : isLocked        ? "TIME'S UP"
    : isLeading       ? "YOU'RE LEADING"
    : nextBid > purse ? "INSUFFICIENT PURSE"
    : `PLACE BID — ${fmt(nextBid)} CR`;

  const bidIcon =
    bidSuccess    ? "check_circle"
    : isPlacing   ? "progress_activity"
    : isRevealing ? "visibility_off"
    : isLeading   ? "emoji_events"
    : isLocked    ? "timer_off"
    : "gavel";

  if (loading) {
    return (
      <div className="h-[100dvh] bg-[#0b0f10] flex items-center justify-center">
        <div className="text-center">
          <span className="ms ms-fill text-[#e45d35] text-5xl animate-spin block mb-4">progress_activity</span>
          <p className="f-label text-[#5a6a74] text-[10px]">Loading Auction Room</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0b0f10] text-[#e0e3e4] h-[100dvh] flex flex-col overflow-hidden"
         style={{ fontFamily: "'Inter', sans-serif" }}>

      <div ref={flashRef} className="fixed inset-0 pointer-events-none z-[999]" />

      {/* ── HEADER ── */}
      <header className="shrink-0 z-50 h-[56px] flex items-center justify-between px-4
                         bg-[rgba(11,15,16,0.92)] backdrop-blur-xl border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: team?.color || BID_COLOR }}
          >
            <span className="f-display text-[13px] text-white" style={{ fontStyle: "normal" }}>
              {team?.code.slice(0, 2) ?? "—"}
            </span>
          </div>
          <div>
            <p className="f-display text-[15px] text-white leading-none" style={{ letterSpacing: "-0.01em" }}>
              {team?.name ?? teamCode.toUpperCase()}
            </p>
            <p className="f-label-sm text-[#5a6a74] text-[9px] leading-none mt-[3px]">
              {fmt(purse)} CR REMAINING
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLeading && !isSold && !isUnsold && (
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: "rgba(228,93,53,0.15)", border: `1px solid ${BID_COLOR}50` }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BID_COLOR }} />
              <span className="f-label text-[9px]" style={{ color: BID_COLOR }}>LEADING</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
               style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="f-label text-[9px] text-[#c6c6cd]">LIVE</span>
          </div>
        </div>
      </header>

      {/* ── SNAP SCROLL BODY ── */}
      <div ref={scrollRef} className="snap-scroll flex-1 min-h-0 pb-[72px]">

        {/* ══ PAGE 1: Player card ══ */}
        <div className="snap-target flex flex-col gap-3 p-3"
             style={{ height: "calc(100dvh - 56px - 72px)" }}>
          <PlayerCard lot={currentLot} isSold={isSold} isUnsold={isUnsold} isRevealing={isRevealing} />
          <button
            onClick={() => {
              if (!scrollRef.current || !bidCardRef.current) return;
              const top =
                bidCardRef.current.getBoundingClientRect().top -
                scrollRef.current.getBoundingClientRect().top +
                scrollRef.current.scrollTop;
              scrollRef.current.scrollTo({ top, behavior: "smooth" });
            }}
            className="shrink-0 flex flex-col items-center gap-0.5 py-1 w-full"
            style={{ opacity: 0.4 }}
          >
            <span className="f-label text-[#c6c6cd] text-[9px]">PLACE BID</span>
            <span className="ms text-[#c6c6cd] text-lg">expand_more</span>
          </button>
        </div>

        {/* ══ PAGE 2: Bid controls ══ */}
        <div className="snap-target flex flex-col gap-3 p-3"
             style={{ height: "calc(100dvh - 56px - 72px)" }}>

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
                className={`f-display leading-none ${currentLot && !isLocked && !isSold && !isUnsold && !isRevealing ? "animate-pulse-bid" : ""}`}
                style={{
                  fontSize: "clamp(72px, 18vw, 96px)",
                  color: isSold ? BID_COLOR : isUnsold ? "#6b7280" : (isLocked || isRevealing) ? "#374151" : BID_COLOR,
                }}
              >
                {currentLot && !isRevealing ? fmt(currentLot.currentBid) : "—"}
              </span>
              <span className="f-label text-[11px] text-[#5a6a74] mb-3">CR</span>
            </div>

            {isRevealing && (
              <p className="f-label text-[10px] text-[#e45d35] animate-timer-pulse mb-3">
                AWAITING REVEAL ON BROADCAST SCREEN…
              </p>
            )}

            {isLocked && !isRevealing && !isSold && !isUnsold && (
              <p className="f-label text-[10px] text-red-400 animate-timer-pulse mb-3">
                TIME'S UP — AWAITING AUCTIONEER DECISION
              </p>
            )}

            <div className="w-full h-px mb-3"
                 style={{ background: "linear-gradient(to right, transparent, rgba(228,93,53,0.25), transparent)" }} />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                     style={{ background: "rgba(228,93,53,0.12)", border: `1px solid ${BID_COLOR}25` }}>
                  <span className="ms ms-fill text-[16px]" style={{ color: BID_COLOR }}>groups</span>
                </div>
                <div>
                  <p className="f-label-sm text-[8px] text-[#5a6a74]">LEADER</p>
                  <p className="f-display text-[18px] text-white leading-none" style={{ fontStyle: "normal" }}>
                    {isRevealing ? "—" : (currentLot?.winningTeamCode ?? "—")}
                  </p>
                </div>
              </div>

              {currentLot && !isSold && !isUnsold && !isRevealing && !isLocked && !isLeading && (
                <div className="text-right">
                  <p className="f-label-sm text-[8px] text-[#5a6a74]">NEXT BID</p>
                  <p className="f-num text-[18px]" style={{ color: BID_COLOR }}>{fmt(nextBid)} CR</p>
                </div>
              )}
              {isLeading && !isSold && !isUnsold && !isRevealing && !isLocked && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                     style={{ background: "rgba(228,93,53,0.10)", border: `1px solid ${BID_COLOR}25` }}>
                  <span className="ms ms-fill text-[14px]" style={{ color: BID_COLOR }}>emoji_events</span>
                  <span className="f-label text-[9px]" style={{ color: BID_COLOR }}>YOU'RE LEADING</span>
                </div>
              )}
              {isSold && <span className="f-display text-[18px]" style={{ color: BID_COLOR }}>SOLD</span>}
              {isUnsold && <span className="f-display text-[18px] text-gray-400">UNSOLD</span>}
              {isRevealing && (
                <div className="flex items-center gap-1.5 text-[#e45d35]">
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
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
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
            <div className="shrink-0 px-4 py-3 rounded-xl animate-slide-up"
                 style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <p className="f-label text-[10px] text-red-400">{bidError}</p>
            </div>
          )}

          {/* ── BID BUTTON ── */}
          <button
            onClick={handleBid}
            disabled={!canBid}
            className="shrink-0 w-full py-[18px] rounded-xl flex items-center justify-center gap-3
                       active:scale-[0.97] transition-all duration-150
                       disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background:
                bidSuccess    ? "#22c55e"
                : isLeading   ? "#0f1f0f"
                : (isLocked || isRevealing) ? "#1a0a08"
                : canBid      ? BID_COLOR
                : "#1a1e1f",
              boxShadow:
                canBid && !isLocked && !isLeading && !isRevealing
                  ? `0 6px 32px ${BID_COLOR}50`
                  : "none",
              border:
                isLeading             ? `1px solid ${BID_COLOR}30`
                : (isLocked || isRevealing) ? "1px solid rgba(239,68,68,0.3)"
                : "none",
            }}
          >
            <span className={`ms ms-fill text-[22px] text-white ${isPlacing ? "animate-spin" : (isLocked || isRevealing) ? "animate-timer-pulse" : ""}`}>
              {bidIcon}
            </span>
            <span className="f-display text-[17px] text-white" style={{ fontStyle: "normal", letterSpacing: "0.04em" }}>
              {bidLabel}
            </span>
          </button>

          {/* ── Bid History ── */}
          <div className="flex-1 min-h-0 glass rounded-xl overflow-hidden flex flex-col">
            <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] flex justify-between items-center"
                 style={{ background: "rgba(16,20,21,0.60)" }}>
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
                      className={`px-4 py-3 flex items-center justify-between transition-colors
                        ${isTop ? "animate-slide-up" : ""}
                        ${isMe ? "" : "hover:bg-white/[0.02]"}`}
                      style={isMe ? { background: "rgba(228,93,53,0.05)" } : {}}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background: isMe ? `${BID_COLOR}18` : "rgba(255,255,255,0.05)",
                            border: isMe ? `1px solid ${BID_COLOR}35` : "1px solid rgba(255,255,255,0.07)",
                          }}
                        >
                          <span className="f-display text-[11px]"
                                style={{ color: isMe ? BID_COLOR : "#c6c6cd", fontStyle: "normal" }}>
                            {bid.teamCode.slice(0, 2)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`f-body text-[13px] font-semibold truncate ${isMe ? "text-white" : "text-[#c6c6cd]"}`}>
                              {bid.teamName}
                            </p>
                            {isMe && (
                              <span className="f-label text-[8px] px-1.5 py-0.5 rounded shrink-0"
                                    style={{ background: `${BID_COLOR}18`, color: BID_COLOR, border: `1px solid ${BID_COLOR}30` }}>
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
                      <span
                        className="f-num text-[16px] shrink-0 tabular-nums"
                        style={{ color: isTop ? BID_COLOR : isMe ? `${BID_COLOR}bb` : "#e0e3e4" }}
                      >
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

      <BottomNavBar />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER CARD
// ─────────────────────────────────────────────────────────────────────────────
function PlayerCard({
  lot, isSold, isUnsold, isRevealing,
}: {
  lot: AuctionLot | null; isSold: boolean; isUnsold: boolean; isRevealing: boolean;
}) {
  if (!lot) {
    return (
      <section className="glass rounded-xl flex-1 min-h-0 flex flex-col items-center justify-center gap-4">
        <span className="ms text-[#2a3a44]" style={{ fontSize: 56 }}>hourglass_empty</span>
        <div className="text-center">
          <p className="f-display text-[22px] text-white mb-1">AWAITING LOT</p>
          <p className="f-label text-[9px] text-[#3a4a54]">AUCTIONEER HASN'T STARTED YET</p>
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

        <div className="absolute inset-0"
             style={{ background: "linear-gradient(to top, #0b0f10 0%, rgba(11,15,16,0.3) 50%, transparent 100%)" }} />

        <div className="absolute top-3 left-3 z-10">
          <span
            className="f-label text-[9px] px-3 py-1 rounded-full"
            style={{ background: BID_COLOR, color: "#0b0f10" }}
          >
            LOT #{lot.lotNumber} • {isRevealing ? "REVEALING" : isSold ? "SOLD" : isUnsold ? "UNSOLD" : "ON THE BLOCK"}
          </span>
        </div>

        {(isSold || isUnsold) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div
              className="animate-stamp border-[5px] rounded-xl px-5 py-2"
              style={{
                borderColor: isSold ? BID_COLOR : "#6b7280",
                color:       isSold ? BID_COLOR : "#6b7280",
                background:  "rgba(11,15,16,0.35)",
                transform:   "rotate(-12deg)",
              }}
            >
              <span className="f-display text-[40px]">{isSold ? "SOLD" : "UNSOLD"}</span>
            </div>
          </div>
        )}

        {isRevealing && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <span className="ms ms-fill text-[#e45d35] animate-spin" style={{ fontSize: 40 }}>autorenew</span>
            <p className="f-label text-[10px] text-[#e45d35]">REVEALING ON BROADCAST…</p>
          </div>
        )}

        <div className="absolute bottom-2 left-3 right-3 z-10">
          <h1 className="f-display text-[32px] text-white leading-none mb-1">
            {isRevealing ? "???" : lot.playerName}
          </h1>
          <div className="flex items-center gap-2">
            <span className="f-label text-[10px]" style={{ color: BID_COLOR }}>
              {isRevealing ? "—" : lot.playerRole.toUpperCase()}
            </span>
            <span className="w-[4px] h-[4px] rounded-full bg-[#3a4a54]" />
            <span className="f-label-sm text-[9px] text-[#c6c6cd]">
              {isRevealing ? "—" : (lot.playerCountry || "—")}
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 grid grid-cols-3 gap-2 p-2.5">
        {[
          { label: "BASE",    value: isRevealing ? "—" : `${lot.basePrice.toLocaleString()} CR`, accent: true  },
          { label: "COUNTRY", value: isRevealing ? "—" : (lot.playerCountry || "—"),              accent: false },
          { label: "ROLE",    value: isRevealing ? "—" : (lot.playerRole    || "—"),              accent: false },
        ].map((s) => (
          <div key={s.label} className="p-2.5 rounded-lg"
               style={{ background: "#141818", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="f-label-sm text-[8px] text-[#5a6a74] mb-1">{s.label}</p>
            <p className="f-num text-[14px] truncate" style={{ color: s.accent ? BID_COLOR : "#e0e3e4" }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOCK WRAPPER — loads timerSeconds before mounting ShotClockProvider
// ─────────────────────────────────────────────────────────────────────────────
function BidRoomWithClock({ auctionId, teamCode }: { auctionId: string; teamCode: string }) {
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);

  useEffect(() => {
    loadAuction(auctionId)
      .then((state) => setTimerSeconds(state?.session?.timerSeconds ?? 15))
      .catch(() => setTimerSeconds(15));
  }, [auctionId]);

  if (timerSeconds === null) return null;   // ← wait before mounting

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
    <MobileOnlyWrapper>
      <style>{GLOBAL_STYLES}</style>
      <BidRoomWithClock auctionId={auctionId} teamCode={teamCode} />
    </MobileOnlyWrapper>
  );
}