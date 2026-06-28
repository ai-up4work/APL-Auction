"use client";

import React, { use, useEffect, useRef, useState, useCallback } from "react";
import MobileOnlyWrapper from "@/components/MobileOnlyWrapper";
import BottomNavBar from "@/components/BottomNavBar";
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
  @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Geist+Mono:wght@400;500;700&family=Inter:wght@400;500;600&display=swap');

  @keyframes pulse-glow {
    0%,100% { text-shadow: 0 0 10px rgba(228,93,53,0.2); transform: scale(1); }
    50%      { text-shadow: 0 0 30px rgba(228,93,53,0.7); transform: scale(1.02); }
  }
  @keyframes ping-ring {
    0%   { transform: scale(1); opacity: 0.75; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes bid-flash {
    0%   { background: rgba(228,93,53,0.12); }
    100% { background: transparent; }
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .animate-pulse-bid { animation: pulse-glow 2s infinite ease-in-out; }
  .animate-ping-ring { animation: ping-ring 1.2s infinite ease-out; }
  .animate-bid-flash { animation: bid-flash 0.5s ease-out forwards; }
  .animate-slide-up  { animation: slide-up 0.25s ease-out forwards; }

  .glass {
    background: rgba(16,20,21,0.65);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.09);
  }
  .ms { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; font-style:normal; line-height:1; display:inline-block; user-select:none; }
  .ms-fill { font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; }

  .snap-scroll { scroll-snap-type: y proximity; overflow-y: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .snap-scroll::-webkit-scrollbar { display: none; }
  .snap-target { scroll-snap-align: start; scroll-snap-stop: normal; }

  .ticker-scroll { overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(228,93,53,0.35) rgba(255,255,255,0.04); }
  .ticker-scroll::-webkit-scrollbar { width: 3px; }
  .ticker-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 99px; }
  .ticker-scroll::-webkit-scrollbar-thumb { background: rgba(228,93,53,0.4); border-radius: 99px; }

  .font-archivo { font-family: 'Archivo Narrow', sans-serif; }
  .font-mono    { font-family: 'Geist Mono', monospace; }
  .font-inter   { font-family: 'Inter', sans-serif; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
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

  const [team,         setTeam]         = useState<TeamInfo | null>(null);
  const [rules,        setRules]        = useState<AuctionRules | null>(null);
  const [currentLot,   setCurrentLot]   = useState<AuctionLot | null>(null);
  const [bidHistory,   setBidHistory]   = useState<BidEntry[]>([]);
  const [purse,        setPurse]        = useState(0);
  const [roster,       setRoster]       = useState(0);
  const [totalPoints,  setTotalPoints]  = useState(50000);
  const [teamSize,     setTeamSize]     = useState(16);

  const [isSold,       setIsSold]       = useState(false);
  const [isUnsold,     setIsUnsold]     = useState(false);
  const [isPlacing,    setIsPlacing]    = useState(false);
  const [bidError,     setBidError]     = useState("");
  const [bidSuccess,   setBidSuccess]   = useState(false);
  const [loading,      setLoading]      = useState(true);

  const currentLotRef = useRef(currentLot);
  const rulesRef      = useRef(rules);
  const teamRef       = useRef(team);
  useEffect(() => { currentLotRef.current = currentLot; }, [currentLot]);
  useEffect(() => { rulesRef.current      = rules;       }, [rules]);
  useEffect(() => { teamRef.current       = team;        }, [team]);

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

        // Find this team by code
        const found = auctionState.teams.find(
          (t) => t.code.toLowerCase() === teamCode.toLowerCase()
        );
        if (found) {
          const teamInfo: TeamInfo = {
            id:    found.supabaseId ?? "",
            name:  found.name,
            code:  found.code,
            color: found.color,
          };
          setTeam(teamInfo);

          const myPurse = found.supabaseId ? purses[found.supabaseId] : null;
          setPurse(myPurse?.remaining ?? auctionState.rules.totalPoints);
          setRoster(myPurse?.roster ?? found.roster ?? 0);
        }
      }

      setCurrentLot(liveData.currentLot);
      setBidHistory(liveData.bidHistory);
      if (liveData.currentLot?.status === "sold")   setIsSold(true);
      if (liveData.currentLot?.status === "unsold") setIsUnsold(true);

      setLoading(false);
    }
    init().catch(console.error);
  }, [auctionId, teamCode]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!team) return;

    const lotSub = subscribeToLot(auctionId, (lot) => {
      const cur = currentLotRef.current;
      if (cur && lot.id !== cur.id && (lot.status === "sold" || lot.status === "unsold")) return;

      if (lot.status === "pending" && cur?.id !== lot.id) {
        setCurrentLot(lot);
        setBidHistory([]);
        setIsSold(false);
        setIsUnsold(false);
        setBidError("");
        setBidSuccess(false);
        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      setCurrentLot(lot);
      if (lot.status === "sold")   { setIsSold(true);  setIsUnsold(false); }
      if (lot.status === "unsold") { setIsUnsold(true); setIsSold(false);  }
    });

    const bidSub = subscribeToBids(auctionId, (bid) => {
      setBidHistory((prev) => [bid, ...prev].slice(0, 50));
      setCurrentLot((prev) =>
        prev ? { ...prev, currentBid: bid.amount, winningTeamCode: bid.teamCode, winningTeamId: bid.teamId } : prev
      );
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
  }, [auctionId, team]);

  // ── Bid ───────────────────────────────────────────────────────────────────
  const handleBid = useCallback(async () => {
    const t = teamRef.current;
    if (!currentLotRef.current || isSold || isUnsold || isPlacing || !t) return;
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
      setBidSuccess(true);
      setTimeout(() => setBidSuccess(false), 1500);
    } catch (err: any) {
      setBidError(err?.message ?? "Bid failed. Try again.");
      setTimeout(() => setBidError(""), 3000);
    } finally {
      setIsPlacing(false);
    }
  }, [auctionId, isSold, isUnsold, isPlacing, purse]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const nextBid   = currentLot ? getNextBidAmount(currentLot.currentBid, rules?.tiers ?? []) : 0;
  const purgePct  = Math.min((purse / Math.max(totalPoints, 1)) * 100, 100);
  const isLeading = !!team && currentLot?.winningTeamId === team.id;
  const canBid    = !!currentLot && !isSold && !isUnsold && !isPlacing && nextBid <= purse;
  const fmtCR     = (n: number) => n.toLocaleString();

  if (loading) {
    return (
      <div className="h-[100dvh] bg-[#0d1011] flex items-center justify-center">
        <div className="text-center">
          <span className="ms text-[#e45d35] text-5xl animate-spin block mb-3">progress_activity</span>
          <p className="font-mono text-[#5a6a74] text-xs uppercase tracking-widest">Loading auction room…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1011] text-[#e0e3e5] h-[100dvh] flex flex-col overflow-hidden font-inter">
      {/* Flash overlay */}
      <div ref={flashRef} className="fixed inset-0 pointer-events-none z-[999]" />

      {/* ── Header ── */}
      <header className="shrink-0 z-50 h-14 flex items-center justify-between px-4
                         bg-[rgba(13,16,17,0.85)] backdrop-blur-xl border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
               style={{ backgroundColor: team?.color || BID_COLOR }}>
            <span className="font-archivo font-black text-[11px] text-white">
              {team?.code.slice(0, 2) ?? "—"}
            </span>
          </div>
          <div>
            <p className="font-archivo font-bold text-[13px] text-white leading-none">{team?.name ?? teamCode.toUpperCase()}</p>
            <p className="font-mono text-[8px] text-[#5a6a74] uppercase tracking-widest leading-none mt-0.5">
              {fmtCR(purse)} CR remaining
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLeading && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[9px] font-bold uppercase tracking-widest"
                 style={{ background: "rgba(228,93,53,0.15)", color: BID_COLOR, border: `1px solid ${BID_COLOR}40` }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BID_COLOR }} />
              Leading
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1e2527] rounded-full border border-white/[0.06]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[9px] text-[#c6c6cd] uppercase tracking-widest">Live</span>
          </div>
        </div>
      </header>

      {/* ── Snap scroll body ── */}
      <div ref={scrollRef} className="snap-scroll flex-1 min-h-0 pb-[72px]">

        {/* PAGE 1: Player card */}
        <div className="snap-target flex flex-col gap-3 p-3"
             style={{ height: "calc(100dvh - 56px - 72px)" }}>
          <PlayerCard lot={currentLot} isSold={isSold} isUnsold={isUnsold} />
          <button
            onClick={() => {
              if (!scrollRef.current || !bidCardRef.current) return;
              const top =
                bidCardRef.current.getBoundingClientRect().top -
                scrollRef.current.getBoundingClientRect().top +
                scrollRef.current.scrollTop;
              scrollRef.current.scrollTo({ top, behavior: "smooth" });
            }}
            className="shrink-0 flex flex-col items-center gap-0.5 py-1 opacity-40 w-full"
          >
            <span className="font-mono text-[9px] text-[#c6c6cd] uppercase tracking-widest">Place bid</span>
            <span className="ms text-[#c6c6cd] text-base">expand_more</span>
          </button>
        </div>

        {/* PAGE 2: Bid controls */}
        <div className="snap-target flex flex-col gap-3 p-3"
             style={{ height: "calc(100dvh - 56px - 72px)" }}>

          {/* Current bid */}
          <div ref={bidCardRef} className="glass rounded-xl p-5 shrink-0 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 opacity-[0.04] pointer-events-none">
              <span className="ms ms-fill text-white" style={{ fontSize: 180 }}>gavel</span>
            </div>
            <p className="font-mono text-[9px] text-[#5a6a74] uppercase tracking-[0.2em] mb-1">Current High Bid</p>
            <div className="flex items-end gap-3 mb-3">
              <span
                className={`font-archivo font-bold leading-none ${currentLot ? "animate-pulse-bid" : ""}`}
                style={{ fontSize: "clamp(42px,11vw,64px)", color: BID_COLOR }}
              >
                {currentLot ? fmtCR(currentLot.currentBid) : "—"}
              </span>
              <span className="font-mono text-[10px] text-[#5a6a74] mb-2">CR</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center"
                     style={{ background: "rgba(228,93,53,0.15)" }}>
                  <span className="ms ms-fill text-[14px]" style={{ color: BID_COLOR }}>groups</span>
                </div>
                <div>
                  <p className="font-mono text-[8px] text-[#5a6a74] uppercase tracking-widest">Leader</p>
                  <p className="font-archivo font-bold text-sm text-white">{currentLot?.winningTeamCode ?? "—"}</p>
                </div>
              </div>
              {currentLot && !isSold && !isUnsold && (
                <div className="text-right">
                  <p className="font-mono text-[8px] text-[#5a6a74] uppercase tracking-widest">Next bid</p>
                  <p className="font-archivo font-bold text-sm" style={{ color: BID_COLOR }}>{fmtCR(nextBid)} CR</p>
                </div>
              )}
              {isSold   && <span className="font-archivo font-black text-sm uppercase tracking-widest" style={{ color: BID_COLOR }}>SOLD</span>}
              {isUnsold && <span className="font-archivo font-black text-sm uppercase tracking-widest text-gray-400">UNSOLD</span>}
            </div>
          </div>

          {/* Budget health */}
          <div className="glass rounded-xl p-4 shrink-0 flex flex-col gap-3">
            <h3 className="font-mono text-[9px] text-[#5a6a74] uppercase tracking-[0.2em]">Budget Health</h3>
            <div>
              <div className="flex justify-between font-mono text-[10px] mb-1.5">
                <span className="text-[#c6c6cd]">Purse remaining</span>
                <span className="text-white">{fmtCR(purse)} <span className="text-[#5a6a74]">/ {fmtCR(totalPoints)}</span></span>
              </div>
              <div className="w-full h-1.5 bg-[#1e2527] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${purgePct}%`,
                    background: purgePct < 25 ? "#ef4444" : BID_COLOR,
                    boxShadow: `0 0 8px ${purgePct < 25 ? "#ef444480" : `${BID_COLOR}80`}`,
                  }}
                />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-[10px] text-[#c6c6cd]">Squad filled</span>
              <span className="font-archivo font-bold text-base text-white">
                {roster} <span className="text-[#5a6a74] text-sm font-normal">/ {teamSize}</span>
              </span>
            </div>
          </div>

          {/* Error */}
          {bidError && (
            <div className="shrink-0 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 animate-slide-up">
              <p className="font-mono text-[10px] text-red-400 uppercase tracking-widest">{bidError}</p>
            </div>
          )}

          {/* Bid button */}
          <button
            onClick={handleBid}
            disabled={!canBid}
            className="shrink-0 w-full py-4 rounded-xl font-archivo text-base font-bold uppercase
                       tracking-wide text-white flex items-center justify-center gap-3
                       active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: bidSuccess ? "#22c55e" : canBid ? BID_COLOR : "#1e2527",
              boxShadow: canBid ? `0 4px 24px ${BID_COLOR}40` : "none",
            }}
          >
            <span className="ms ms-fill text-[20px]">
              {bidSuccess ? "check_circle" : isPlacing ? "progress_activity" : "gavel"}
            </span>
            {bidSuccess  ? "Bid Placed!"
            : isPlacing  ? "Placing…"
            : !currentLot ? "Awaiting Lot"
            : isSold     ? "Lot Closed"
            : isUnsold   ? "Lot Unsold"
            : nextBid > purse ? "Insufficient Purse"
            : `Bid ${fmtCR(nextBid)} CR`}
          </button>

          {/* Bid history */}
          <div className="flex-1 min-h-0 glass rounded-xl overflow-hidden flex flex-col">
            <div className="shrink-0 px-4 py-2.5 border-b border-white/[0.06]
                            flex justify-between items-center bg-[#161a1b]/60">
              <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#c6c6cd]">Bid History</h3>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                <span className="font-mono text-[9px] text-[#c6c6cd] uppercase tracking-widest">Live</span>
              </div>
            </div>
            <div className="ticker-scroll flex-1 min-h-0 divide-y divide-white/[0.05]">
              {bidHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
                  <span className="ms text-[#2a3a44] text-3xl">gavel</span>
                  <p className="font-mono text-[9px] text-[#3a4a54] uppercase tracking-widest">No bids yet</p>
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
                        ${isMe ? "bg-[rgba(228,93,53,0.05)]" : "hover:bg-white/[0.02]"}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 font-archivo font-black text-[10px]"
                          style={{
                            background: isMe ? `${BID_COLOR}20` : "rgba(255,255,255,0.06)",
                            color:      isMe ? BID_COLOR : "#c6c6cd",
                            border:     isMe ? `1px solid ${BID_COLOR}40` : "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {bid.teamCode.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className={`font-inter text-xs truncate ${isMe ? "text-white font-semibold" : "text-[#c6c6cd]"}`}>
                            {bid.teamName}
                            {isMe && <span className="font-mono text-[8px] ml-1.5 opacity-60 uppercase">you</span>}
                          </p>
                          <p className="font-mono text-[8px] text-[#3a4a54] uppercase">
                            {new Date(bid.placedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <span
                        className="font-archivo font-bold text-sm tabular-nums shrink-0"
                        style={{ color: isTop ? BID_COLOR : isMe ? `${BID_COLOR}cc` : "#e0e3e5" }}
                      >
                        {fmtCR(bid.amount)}
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
function PlayerCard({ lot, isSold, isUnsold }: { lot: AuctionLot | null; isSold: boolean; isUnsold: boolean }) {
  if (!lot) {
    return (
      <section className="glass rounded-xl flex-1 min-h-0 flex flex-col items-center justify-center gap-3">
        <span className="ms text-[#2a3a44] text-5xl">hourglass_empty</span>
        <p className="font-archivo font-bold text-lg text-white uppercase italic">Awaiting Lot</p>
        <p className="font-mono text-[9px] text-[#3a4a54] uppercase tracking-widest">Auctioneer hasn't started yet</p>
      </section>
    );
  }

  return (
    <section className="glass rounded-xl overflow-hidden relative flex-1 min-h-0 flex flex-col">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {lot.playerImg ? (
          <img
            src={lot.playerImg}
            alt={lot.playerName}
            className="w-full h-full object-cover object-top"
            style={{ filter: (isSold || isUnsold) ? "grayscale(0.7) brightness(0.5)" : "grayscale(0.1) contrast(1.15)" }}
          />
        ) : (
          <div className="w-full h-full bg-[#1a1e1f] flex items-center justify-center">
            <span className="ms text-[#2a3a44] text-6xl">person</span>
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #0d1011 0%, transparent 55%)" }} />

        <div className="absolute top-3 left-3 z-10">
          <span className="font-mono text-[8px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full"
                style={{ background: BID_COLOR, color: "#0d1011" }}>
            LOT #{lot.lotNumber} • {isSold ? "SOLD" : isUnsold ? "UNSOLD" : "ON THE BLOCK"}
          </span>
        </div>

        {(isSold || isUnsold) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div
              className="border-[5px] rounded-xl px-5 py-1.5 -rotate-12"
              style={{
                borderColor: isSold ? BID_COLOR : "#6b7280",
                color:       isSold ? BID_COLOR : "#6b7280",
                background:  "rgba(13,16,17,0.3)",
              }}
            >
              <span className="font-archivo font-black text-4xl italic uppercase tracking-tighter">
                {isSold ? "SOLD" : "UNSOLD"}
              </span>
            </div>
          </div>
        )}

        <div className="absolute bottom-2 left-3 right-3 z-10">
          <h1 className="font-archivo text-3xl font-bold uppercase italic text-white leading-tight">
            {lot.playerName}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-inter text-xs font-semibold" style={{ color: BID_COLOR }}>
              {lot.playerRole.toUpperCase()}
            </span>
            <span className="w-1 h-1 rounded-full bg-[#3a4a54]" />
            <span className="font-inter text-xs text-[#c6c6cd]">{lot.playerCountry || "—"}</span>
          </div>
        </div>
      </div>

      <div className="shrink-0 grid grid-cols-3 gap-2 p-2.5">
        {[
          { label: "Base",    value: `${lot.basePrice.toLocaleString()} CR`, accent: true  },
          { label: "Country", value: lot.playerCountry || "—",              accent: false },
          { label: "Role",    value: lot.playerRole    || "—",              accent: false },
        ].map((s) => (
          <div key={s.label} className="p-2 bg-[#161a1b] rounded-lg border border-white/[0.06]">
            <p className="font-mono text-[8px] text-[#5a6a74] uppercase tracking-widest mb-0.5">{s.label}</p>
            <p className="font-archivo font-bold text-sm truncate" style={{ color: s.accent ? BID_COLOR : "#e0e3e5" }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </section>
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
      <BidRoom auctionId={auctionId} teamCode={teamCode} />
    </MobileOnlyWrapper>
  );
}