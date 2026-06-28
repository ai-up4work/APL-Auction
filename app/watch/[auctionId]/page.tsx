// app/watch/[auctionId]/page.tsx
"use client";

import React, { use, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { FlowCanvas } from "@/components/FlowCanvas";
import { AUCTION_CONFIG } from "@/app/sankey/data";
import { ShuffleOverlay } from "@/components/ShuffleOverlay";
import { AuctionProvider, useAuction } from "@/context/AuctionContext";
import {
  loadLiveState,
  loadTeamPurses,
  subscribeToLot,
  subscribeToBids,
  subscribeToTeamPurses,
  getNextBidAmount,
  type AuctionLot,
  type BidEntry,
} from "@/lib/auctionLiveDb";
import type { Player } from "@/types/auction";

type TeamPurse  = { remaining: number; roster: number };
type FlowPlayer = (typeof AUCTION_CONFIG.players)[number];
type FlowTeam   = (typeof AUCTION_CONFIG.teams)[number];

function buildFlowPlayer(overrides: {
  id: string; name: string; img: string; price: string;
  status: FlowPlayer["status"]; teamShortCode?: string | null;
}): FlowPlayer {
  return { ...AUCTION_CONFIG.players[0], ...overrides } as FlowPlayer;
}

function buildFlowTeam(overrides: {
  id: string; name: string; shortCode: string; logoUrl: string; purse: string;
}): FlowTeam {
  return { ...AUCTION_CONFIG.teams[0], ...overrides } as FlowTeam;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ScreenContent({ auctionId }: { auctionId: string }) {
  const { auction, loadFromDb } = useAuction();

  const [loadingLive, setLoadingLive]           = useState(true);
  const [teamPurses, setTeamPurses]             = useState<Record<string, TeamPurse>>({});
  const [currentLot, setCurrentLot]             = useState<AuctionLot | null>(null);
  const [bidHistory, setBidHistory]             = useState<BidEntry[]>([]);
  const [completedLots, setCompletedLots]       = useState<AuctionLot[]>([]);
  const [lotNumber, setLotNumber]               = useState(0);
  const [remainingPlayers, setRemainingPlayers] = useState<Player[]>([]);

  const [isSold, setIsSold]                     = useState(false);
  const [isUnsold, setIsUnsold]                 = useState(false);
  const [bidPulse, setBidPulse]                 = useState(true);
  const [flashOverlay, setFlashOverlay]         = useState(false);
  const [shotClock, setShotClock]               = useState(100);
  const [showLeaderboard, setShowLeaderboard]   = useState(false);

  const [isShuffling, setIsShuffling]           = useState(false);
  const [shuffleTarget, setShuffleTarget]       = useState<FlowPlayer | null>(null);
  const [shuffleIndex, setShuffleIndex]         = useState(0);
  const [shufflePool, setShufflePool]           = useState<FlowPlayer[]>([]);

  const [activeView, setActiveView]             = useState<"live" | "flow">("live");

  // Flow view selection — COMPLETELY INDEPENDENT of live auction state
  const [flowActivePlayer, setFlowActivePlayer] = useState<string | null>(null);
  const [flowActiveTeam, setFlowActiveTeam]     = useState<string | null>(null);

  const playerListRef = useRef<HTMLDivElement>(null);
  const teamListRef   = useRef<HTMLDivElement>(null);

  const shotClockTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const leaderboardTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimeout     = useRef<ReturnType<typeof setTimeout>  | null>(null);

  const auctionRef       = useRef(auction);
  const remainingRef     = useRef(remainingPlayers);
  const currentLotRef    = useRef(currentLot);
  const completedLotsRef = useRef(completedLots);
  useEffect(() => { auctionRef.current       = auction;          }, [auction]);
  useEffect(() => { remainingRef.current     = remainingPlayers; }, [remainingPlayers]);
  useEffect(() => { currentLotRef.current    = currentLot;       }, [currentLot]);
  useEffect(() => { completedLotsRef.current = completedLots;    }, [completedLots]);

  // Hydrate context
  useEffect(() => {
    if (!auction?.auctionId || auction.auctionId !== auctionId) {
      loadFromDb(auctionId).catch(console.error);
    }
  }, [auctionId, auction?.auctionId, loadFromDb]);

  // Load live state once context ready
  useEffect(() => {
    if (!auction?.auctionId) return;

    async function init() {
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
      setTeamPurses(purses);

      const liveData = await loadLiveState(auctionId);
      setCurrentLot(liveData.currentLot);
      setBidHistory(liveData.bidHistory);
      setCompletedLots(liveData.completedLots);
      setLotNumber(liveData.lotNumber);

      const usedIds = new Set(liveData.completedLots.map((l) => l.playerId));
      if (liveData.currentLot) usedIds.add(liveData.currentLot.playerId);
      setRemainingPlayers(auction.players.filter((p) => !usedIds.has(p.supabaseId ?? "")));

      if (liveData.currentLot?.status === "sold")   setIsSold(true);
      if (liveData.currentLot?.status === "unsold") setIsUnsold(true);

      setLoadingLive(false);
    }

    init().catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auction?.auctionId]);

  // Purse realtime
  useEffect(() => {
    if (!auction?.auctionId) return;
    const sub = subscribeToTeamPurses(auctionId, (teamId, remaining, roster) => {
      setTeamPurses((prev) => ({ ...prev, [teamId]: { remaining, roster } }));
    });
    return () => { sub.unsubscribe(); };
  }, [auctionId, auction?.auctionId]);

  // Shuffle animation
  const triggerShuffleAndReveal = useCallback((lot: AuctionLot) => {
    setIsShuffling(true);
    setIsSold(false);
    setIsUnsold(false);
    setBidHistory([]);
    setShuffleTarget(null);

    const candidates = remainingRef.current;

    const rawPool: FlowPlayer[] = candidates.map((p) =>
      buildFlowPlayer({
        id:     p.supabaseId ?? String(p.id),
        name:   p.name,
        img:    p.img,
        price:  `${p.price.toLocaleString()} CR`,
        status: "locked",
      })
    );

    const targetFlow = buildFlowPlayer({
      id:     lot.playerId,
      name:   lot.playerName,
      img:    lot.playerImg,
      price:  `${lot.basePrice.toLocaleString()} CR`,
      status: "pending",
    });

    const poolWithoutTarget = rawPool.filter((p) => p.id !== targetFlow.id);
    const shuffledPool      = shuffleArray(poolWithoutTarget);
    const targetIndex       = Math.floor(Math.random() * (shuffledPool.length + 1));
    shuffledPool.splice(targetIndex, 0, targetFlow);

    const finalPool = shuffledPool.length > 0 ? shuffledPool : [targetFlow];
    setShufflePool(finalPool);

    let delay      = 30;
    const maxDelay = 380;
    let idx        = Math.floor(Math.random() * finalPool.length);
    let elapsed    = 0;
    const SPIN_DURATION = 2200;

    function spin() {
      idx = (idx + 1) % finalPool.length;
      setShuffleIndex(idx);
      elapsed += delay;
      if (elapsed < SPIN_DURATION) {
        delay = Math.min(delay * 1.12, maxDelay);
        setTimeout(spin, delay);
      } else {
        setShuffleIndex(targetIndex);
        setShuffleTarget(targetFlow);
        setTimeout(() => {
          setIsShuffling(false);
          setShuffleTarget(null);
          setCurrentLot(lot);
          setLotNumber(lot.lotNumber);
          setRemainingPlayers((prev) =>
            prev.filter((p) => (p.supabaseId ?? "") !== lot.playerId)
          );
          setShotClock(100);
        }, 900);
      }
    }
    spin();
  }, []);

  // Realtime: lot + bid changes
  useEffect(() => {
    if (!auction?.auctionId) return;

    const lotSub = subscribeToLot(auctionId, (lot) => {
      const isNewLot = currentLotRef.current?.id !== lot.id;

      if (
        currentLotRef.current &&
        lot.id !== currentLotRef.current.id &&
        (lot.status === "unsold" || lot.status === "sold")
      ) {
        return;
      }

      if (lot.status === "pending" && isNewLot) {
        triggerShuffleAndReveal(lot);
        return;
      }

      setCurrentLot(lot);

      if (lot.status === "sold") {
        setIsSold(true);
        setIsUnsold(false);
        setShotClock(0);
        setCompletedLots((prev) =>
          prev.some((l) => l.id === lot.id) ? prev : [lot, ...prev]
        );
      }
      if (lot.status === "unsold") {
        setIsUnsold(true);
        setIsSold(false);
        setShotClock(0);
        setCompletedLots((prev) =>
          prev.some((l) => l.id === lot.id) ? prev : [lot, ...prev]
        );
      }
    });

    const bidSub = subscribeToBids(auctionId, (bid) => {
      setBidHistory((prev) => [bid, ...prev].slice(0, 30));
      setCurrentLot((prev) =>
        prev
          ? { ...prev, currentBid: bid.amount, winningTeamCode: bid.teamCode, winningTeamId: bid.teamId }
          : prev
      );
      setBidPulse(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setBidPulse(true)));
      setFlashOverlay(true);
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
      flashTimeout.current = setTimeout(() => setFlashOverlay(false), 200);
      setShotClock(100);
    });

    return () => {
      lotSub.unsubscribe();
      bidSub.unsubscribe();
    };
  }, [auctionId, auction?.auctionId, triggerShuffleAndReveal]);

  // Shot clock
  useEffect(() => {
    if (shotClockTimer.current) clearInterval(shotClockTimer.current);
    shotClockTimer.current = setInterval(() => {
      setShotClock((prev) => {
        if (isSold || isUnsold || isShuffling || !currentLotRef.current) return prev;
        if (prev <= 0) return 0;
        const seconds = auctionRef.current?.session.timerSeconds || 15;
        const drainPerTick = 100 / (seconds * 10);
        return Math.max(0, prev - drainPerTick);
      });
    }, 100);
    return () => { if (shotClockTimer.current) clearInterval(shotClockTimer.current); };
  }, [isSold, isUnsold, isShuffling]);

  // Leaderboard interrupt
  useEffect(() => {
    leaderboardTimer.current = setInterval(() => {
      if (completedLotsRef.current.some((l) => l.status === "sold")) {
        setShowLeaderboard(true);
        setTimeout(() => setShowLeaderboard(false), 8000);
      }
    }, 25000);
    return () => { if (leaderboardTimer.current) clearInterval(leaderboardTimer.current); };
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (flashTimeout.current)     clearTimeout(flashTimeout.current);
      if (shotClockTimer.current)   clearInterval(shotClockTimer.current);
      if (leaderboardTimer.current) clearInterval(leaderboardTimer.current);
    };
  }, []);

  // Scroll active into view
  useEffect(() => {
    if (flowActivePlayer) {
      document.getElementById(`player-${flowActivePlayer}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [flowActivePlayer]);

  useEffect(() => {
    if (flowActiveTeam) {
      document.getElementById(`team-${flowActiveTeam}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [flowActiveTeam]);

  // Derived
  const winningTeam  = currentLot?.winningTeamId
    ? auction?.teams.find((t) => t.supabaseId === currentLot.winningTeamId) ?? null
    : null;
  const winningPurse = winningTeam?.supabaseId ? teamPurses[winningTeam.supabaseId] : null;

  const leaderTopBuy = winningTeam
    ? [...completedLots]
        .filter((l) => l.status === "sold" && l.winningTeamId === winningTeam.supabaseId)
        .sort((a, b) => b.currentBid - a.currentBid)[0]
    : null;

  const blockPlayer = currentLot
    ? auction?.players.find((p) => p.supabaseId === currentLot.playerId)
    : null;

  const nextBid = currentLot
    ? getNextBidAmount(currentLot.currentBid, auction?.rules.tiers ?? [])
    : 0;

  const topBuys = useMemo(
    () =>
      [...completedLots]
        .filter((l) => l.status === "sold")
        .sort((a, b) => b.currentBid - a.currentBid)
        .slice(0, 3),
    [completedLots]
  );

  const tickerMessages = useMemo(() => {
    if (completedLots.length === 0) {
      return [
        `Welcome to ${auction?.session.auctionName ?? "the auction"}`,
        "Bidding will begin shortly — stay tuned",
      ];
    }
    return completedLots.slice(0, 8).map((l) =>
      l.status === "sold"
        ? `${l.playerName} sold to ${l.winningTeamCode ?? "—"} for ${l.currentBid.toLocaleString()} CR!`
        : `${l.playerName} went unsold`
    );
  }, [completedLots, auction?.session.auctionName]);

  // ── flowPlayers: unsold gets its own status (not "locked") ───────────────
  const flowPlayers: FlowPlayer[] = useMemo(() => {
    if (!auction) return [];
    return auction.players.map((p) => {
      const supId = p.supabaseId ?? "";
      if (currentLot && currentLot.playerId === supId) {
        return buildFlowPlayer({
          id: supId, name: p.name, img: p.img,
          price: `${p.price.toLocaleString()} CR`,
          status: "pending",
          teamShortCode: currentLot.winningTeamCode,
        });
      }
      const closedLot = completedLots.find((l) => l.playerId === supId);
      if (closedLot) {
        return buildFlowPlayer({
          id: supId, name: p.name, img: p.img,
          price: `${p.price.toLocaleString()} CR`,
          // ── KEY FIX: unsold gets "unsold" status, not "locked" ──
          status: closedLot.status === "sold" ? "sold" : "unsold" as any,
          teamShortCode: closedLot.status === "sold" ? closedLot.winningTeamCode : null,
        });
      }
      return buildFlowPlayer({
        id: supId, name: p.name, img: p.img,
        price: `${p.price.toLocaleString()} CR`,
        status: "locked",
      });
    });
  }, [auction, currentLot, completedLots]);

  const flowTeams: FlowTeam[] = useMemo(() => {
    if (!auction) return [];
    return auction.teams.map((t) =>
      buildFlowTeam({
        id:        t.supabaseId ?? String(t.id),
        name:      t.name,
        shortCode: t.code,
        logoUrl:   t.logo || "",
        purse:     `${(t.supabaseId ? teamPurses[t.supabaseId]?.remaining : undefined) ?? auction.rules.totalPoints} CR`,
      })
    );
  }, [auction, teamPurses]);

  // Flow view handlers
  const togglePlayer = (p: FlowPlayer) => {
    if (flowActivePlayer === p.id) {
      setFlowActivePlayer(null);
      setFlowActiveTeam(null);
    } else {
      setFlowActivePlayer(p.id);
      setFlowActiveTeam((p as any).teamShortCode || null);
    }
  };

  const toggleTeam = (t: FlowTeam) => {
    if (flowActiveTeam === t.shortCode && !flowActivePlayer) {
      setFlowActiveTeam(null);
    } else {
      setFlowActiveTeam(t.shortCode);
      setFlowActivePlayer(null);
    }
  };

  const clearFlowSelection = () => {
    setFlowActivePlayer(null);
    setFlowActiveTeam(null);
  };

  const hasSelection = flowActivePlayer !== null || flowActiveTeam !== null;
  const fmtCR = (n: number | undefined | null) => (n ?? 0).toLocaleString();

  if (!auction || loadingLive) {
    return (
      <div className="h-screen bg-[#0b0f10] flex items-center justify-center">
        <div className="text-center">
          <span className="ms text-[#e45d35] text-5xl animate-spin block mb-4">progress_activity</span>
          <p className="font-mono-geist text-[#5a6a74] text-sm uppercase tracking-widest">Loading broadcast…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Inter:wght@400;500;700&family=Geist+Mono:wght@400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

        .ms { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; font-style:normal; line-height:1; display:inline-block; text-transform:none; letter-spacing:normal; user-select:none; }
        .ms-fill { font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; }

        @keyframes pulse-bid { 0%,100%{filter:drop-shadow(0 0 7px rgba(228,93,53,0.45))} 50%{filter:drop-shadow(0 0 19px rgba(228,93,53,0.85))} }
        .bid-animate { animation:pulse-bid 2s infinite ease-in-out; }

        @keyframes ticker-scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .ticker-track { animation:ticker-scroll 30s linear infinite; }

        @keyframes stamp-sold { 0%{transform:translate(-50%,-50%) scale(3);opacity:0} 50%{transform:translate(-50%,-50%) scale(0.8);opacity:1} 70%{transform:translate(-50%,-50%) scale(1.1)} 100%{transform:translate(-50%,-50%) scale(1);opacity:1} }
        .animate-stamp { animation:stamp-sold 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }

        @keyframes screen-shake { 0%,100%{transform:translate(0,0)} 10%{transform:translate(-2px,-2px)} 20%{transform:translate(-3px,0px)} 30%{transform:translate(3px,2px)} 40%{transform:translate(1px,-1px)} 50%{transform:translate(-1px,2px)} 60%{transform:translate(-3px,1px)} 70%{transform:translate(3px,1px)} 80%{transform:translate(-1px,-1px)} 90%{transform:translate(1px,2px)} }
        .animate-shake { animation:screen-shake 0.5s cubic-bezier(.36,.07,.19,.97); }

        @keyframes slide-in-right { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
        .animate-slide-in { animation:slide-in-right 0.5s ease-out forwards; }

        @keyframes dot-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .dot-pulse { animation:dot-pulse 1.5s ease-in-out infinite; }

        .glass-panel { background:rgba(16,20,21,0.50); backdrop-filter:blur(28px); -webkit-backdrop-filter:blur(28px); }
        .flare { position:absolute; border-radius:50%; background:radial-gradient(circle,rgba(228,93,53,0.13) 0%,transparent 70%); filter:blur(70px); pointer-events:none; }
        .font-archivo { font-family:'Archivo Narrow',sans-serif; }
        .font-mono-geist { font-family:'Geist Mono',monospace; }
        .font-inter { font-family:'Inter',sans-serif; }
        .text-fluid-hero { font-size:clamp(28px,5vw,80px); }
        .text-fluid-bid  { font-size:clamp(36px,5.5vw,84px); }
        .header-blur { backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); }

        @media (max-width:639px) {
          .main-layout{overflow-y:auto!important;overflow-x:hidden!important;padding:0!important}
          .live-view-inner{padding:0 16px 20px 16px!important;gap:16px!important}
          .aside-panel{width:100%!important;flex-direction:column!important;padding:0!important;gap:16px!important;min-height:unset!important}
          .bid-card{flex:none!important;min-height:160px!important;padding:16px!important;width:100%!important}
          .hero-section{padding:8px 0 0!important;min-height:unset!important}
          .player-image-wrap{width:220px!important;height:265px!important;margin-bottom:14px!important}
          .stats-row{gap:24px!important;padding:10px 20px!important;margin-top:16px!important;width:100%!important;justify-content:space-between!important}
          .stats-row .stat-value{font-size:18px!important}
          .header-logo-text{font-size:14px!important}
          .header-purse{display:none}
          .header-px{padding-left:14px!important;padding-right:14px!important}
          .live-badge-text{display:none}
          .live-badge{padding:6px 10px!important}
          .team-stats-grid{gap:6px!important}
          .team-top-buy{display:none}
          .bid-label{font-size:8px!important;margin-bottom:10px!important}
          .bid-leading-icon{width:40px!important;height:40px!important}
          .bid-leading-name{font-size:16px!important}
          .bid-divider{margin-bottom:14px!important}
          .flow-view-grid{display:flex!important;flex-direction:column!important;overflow-y:auto!important}
          .flow-pool,.flow-franchises{width:100%!important;border:none!important;height:auto!important;max-height:400px!important}
          .flow-canvas-container{display:none!important}
        }
        @media (min-width:640px) and (max-width:1023px) {
          .main-layout{padding:0!important}
          .live-view-inner{padding:0 16px!important;gap:12px!important}
          .aside-panel{width:36%!important;flex-direction:column!important;padding:12px 0!important;gap:10px!important}
          .bid-card{flex:1!important;padding:20px!important}
          .hero-section{padding:10px 12px!important}
          .player-image-wrap{width:240px!important;height:290px!important;margin-bottom:16px!important}
          .stats-row{gap:20px!important;padding:10px 16px!important;margin-top:20px!important}
          .stats-row .stat-value{font-size:20px!important}
          .text-fluid-hero{font-size:clamp(26px,4.5vw,56px)!important}
          .text-fluid-bid{font-size:clamp(32px,5vw,60px)!important}
          .header-px{padding-left:18px!important;padding-right:18px!important}
          .bid-leading-name{font-size:18px!important}
          .bid-leading-icon{width:44px!important;height:44px!important}
        }
      `}</style>

      {flashOverlay && (
        <div className="fixed inset-0 pointer-events-none z-[200]" style={{ background: "rgba(228,93,53,0.05)" }} />
      )}

      {activeView === "live" && (
        <ShuffleOverlay
          isShuffling={isShuffling}
          shuffleTarget={shuffleTarget}
          players={shufflePool}
          shuffleIndex={shuffleIndex}
        />
      )}

      <div className="font-inter bg-[#0b0f10] text-[#e0e3e4] fixed inset-0 flex flex-col overflow-hidden select-none">
        <div className="flare w-[430px] h-[430px]" style={{ top: -140, left: -140 }} />
        <div className="flare w-[430px] h-[430px]" style={{ bottom: -140, right: -140 }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at center,rgba(228,93,53,0.10) 0%,transparent 70%)" }} />

        {/* HEADER */}
        <header className="header-px fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-[30px] bg-[rgba(11,15,16,0.85)] header-blur border-b border-white/5">
          <div className="flex items-center gap-[13px]">
            <div className="w-9 h-9 rounded-[7px] bg-[#e45d35] flex items-center justify-center shrink-0">
              <span className="ms ms-fill text-[20px] text-[#0b0f10]">sports_cricket</span>
            </div>
            <div>
              <div className="header-logo-text font-archivo text-[18px] font-bold tracking-[-0.01em] text-white">
                {auction.session.auctionName}
              </div>
              <div className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] tracking-[0.12em] uppercase">
                Broadcast Feed • Lot #{currentLot?.lotNumber ?? lotNumber} of {auction.players.length}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-[16px] sm:gap-[30px]">
            <button
              onClick={() => {
                setActiveView((v) => (v === "live" ? "flow" : "live"));
                clearFlowSelection();
              }}
              className="text-[10px] font-mono-geist px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-md border border-white/10 transition-colors uppercase tracking-widest text-[#e45d35]"
            >
              {activeView === "live" ? "View Full Board" : "View Live Bid"}
            </button>
            <div className="header-purse text-right hidden sm:block">
              <div className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.6)] uppercase tracking-[0.1em]">Total Purse Cap</div>
              <div className="font-archivo text-[18px] font-bold text-white">
                {fmtCR(auction.rules.totalPoints)} <span className="text-[9px] opacity-50">CR</span>
              </div>
            </div>
            <div className="w-px h-7 bg-white/10 hidden sm:block" />
            <div className="live-badge flex items-center gap-[9px] bg-[rgba(127,29,29,0.30)] px-[17px] py-[6px] rounded-full border border-[rgba(239,68,68,0.30)]">
              <div className="dot-pulse w-[6px] h-[6px] rounded-full bg-red-500" style={{ boxShadow: "0 0 7px #ef4444" }} />
              <span className="live-badge-text font-mono-geist text-red-400 font-bold tracking-[0.18em] text-[9px]">LIVE BROADCAST</span>
            </div>
          </div>
        </header>

        {/* MAIN */}
        <main className={`main-layout flex-1 mt-14 mb-[40px] flex overflow-hidden min-h-0 relative ${isSold && activeView === "live" ? "animate-shake" : ""}`}>

          {activeView === "live" && showLeaderboard && topBuys.length > 0 && (
            <div className="absolute left-8 top-8 z-40 animate-slide-in">
              <div className="glass-panel p-5 rounded-2xl border border-[#e45d35]/30 w-72" style={{ background: "rgba(11,15,16,0.85)" }}>
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
                  <span className="ms ms-fill text-[#e45d35]">leaderboard</span>
                  <span className="font-mono-geist text-[10px] text-white uppercase tracking-[0.2em] font-bold">Top Buys</span>
                </div>
                <div className="space-y-3">
                  {topBuys.map((lot) => (
                    <div key={lot.id} className="flex items-center justify-between">
                      <div>
                        <div className="font-archivo font-bold text-white text-sm">{lot.playerName}</div>
                        <div className="font-mono-geist text-[8px] text-white/50 uppercase">{lot.winningTeamCode ?? "—"}</div>
                      </div>
                      <div className="font-archivo text-[#e45d35] font-bold">{lot.currentBid.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeView === "live" ? (
            <div className="live-view-inner w-full h-full flex flex-col sm:flex-row gap-[14px] px-0 sm:px-[30px] pt-4 pb-12">
              {/* CENTER: Hero */}
              <section className="hero-section flex-1 flex flex-col items-center justify-center px-[34px] sm:px-[20px] py-[10px] relative min-w-0">
                {!currentLot && !isShuffling ? (
                  <div className="text-center max-w-md">
                    <span className="ms text-[#2a3a44] text-6xl block mb-4">hourglass_empty</span>
                    <h2 className="font-archivo text-3xl font-bold uppercase italic text-white mb-2">Awaiting First Lot</h2>
                    <p className="font-mono-geist text-xs text-[#5a6a74] uppercase tracking-widest">
                      The auctioneer hasn't started the auction yet
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      {(isSold || isUnsold) && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-stamp pointer-events-none">
                          <div
                            className={`border-[6px] ${isSold ? "border-[#e45d35] text-[#e45d35]" : "border-gray-400 text-gray-400"} rounded-xl px-6 py-2 transform -rotate-12 backdrop-blur-sm bg-black/20`}
                            style={{ boxShadow: `0 0 40px ${isSold ? "rgba(228,93,53,0.5)" : "rgba(156,163,175,0.5)"}, inset 0 0 20px ${isSold ? "rgba(228,93,53,0.5)" : "rgba(156,163,175,0.5)"}` }}
                          >
                            <span className="font-archivo text-6xl font-black italic tracking-tighter uppercase" style={{ textShadow: `0 0 20px ${isSold ? "rgba(228,93,53,0.8)" : "rgba(156,163,175,0.8)"}` }}>
                              {isSold ? "SOLD" : "UNSOLD"}
                            </span>
                          </div>
                        </div>
                      )}

                      <div
                        className={`player-image-wrap relative z-10 w-[280px] h-[325px] rounded-xl overflow-hidden mb-[23px] shrink-0 border border-white/[0.08] transition-all duration-300 ${(isSold || isUnsold) ? "grayscale brightness-50" : ""}`}
                        style={{ boxShadow: "0 0 70px rgba(0,0,0,0.8)" }}
                      >
                        {currentLot?.playerImg ? (
                          <img src={currentLot.playerImg} alt={currentLot.playerName} className="w-full h-full object-cover object-top" style={{ filter: "grayscale(0.15) contrast(1.2)" }} />
                        ) : (
                          <div className="w-full h-full bg-[#1c2021] flex items-center justify-center">
                            <span className="ms text-[#2a3a44] text-6xl">person</span>
                          </div>
                        )}
                        <div className="absolute inset-0" style={{ background: "linear-gradient(to top,#0b0f10 0%,transparent 55%)" }} />
                      </div>

                      <div
                        className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-5 py-1 bg-[#e45d35] text-[#0b0f10] font-mono-geist text-[8px] font-bold tracking-[0.32em] uppercase rounded-full whitespace-nowrap"
                        style={{ boxShadow: "0 4px 16px rgba(228,93,53,0.45)" }}
                      >
                        LOT #{currentLot?.lotNumber ?? lotNumber} • {isSold ? "SOLD" : isUnsold ? "UNSOLD" : "ON THE BLOCK"}
                      </div>
                    </div>

                    <div className="text-center z-20 -mt-[30px]">
                      <h2 className="font-archivo text-fluid-hero leading-none font-bold uppercase tracking-[-0.025em] text-white italic mb-[9px]" style={{ textShadow: "0 4px 24px rgba(0,0,0,0.8)" }}>
                        {currentLot?.playerName ?? "—"}
                      </h2>
                      <div className="flex items-center justify-center gap-3 sm:gap-5 flex-wrap">
                        <span className="font-archivo text-[14px] sm:text-[17px] font-bold text-[#e45d35] tracking-[0.18em]">
                          {(currentLot?.playerRole ?? "—").toUpperCase()}
                        </span>
                        <div className="w-[5px] h-[5px] rounded-full bg-[rgba(228,93,53,0.45)]" />
                        <span className="font-archivo text-[14px] sm:text-[17px] font-semibold text-white/80 tracking-[0.08em]">
                          BASE: {fmtCR(currentLot?.basePrice)} <span className="text-[10px] opacity-60">CR</span>
                        </span>
                      </div>
                    </div>

                    <div
                      className="stats-row flex items-center gap-16 mt-[32px] px-11 py-3 rounded-[17px] border border-white/[0.08]"
                      style={{ background: "rgba(11,15,16,0.42)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 8px 42px rgba(0,0,0,0.55)" }}
                    >
                      {[
                        { label: "Country", value: currentLot?.playerCountry || "—" },
                        { label: "Role",    value: currentLot?.playerRole    || "—" },
                        { label: "Status",  value: blockPlayer ? (blockPlayer.capped ? "Capped" : "Uncapped") : "—" },
                      ].map((s, i, arr) => (
                        <React.Fragment key={s.label}>
                          <div className="text-center">
                            <p className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] uppercase tracking-[0.18em] mb-[5px]">{s.label}</p>
                            <p className="stat-value font-archivo text-[24px] font-bold text-white">{s.value}</p>
                          </div>
                          {i < arr.length - 1 && <div className="w-px h-8 bg-white/10" />}
                        </React.Fragment>
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* RIGHT: Bid + Team */}
              <aside className="aside-panel w-[26%] shrink-0 flex flex-col py-4 gap-3 min-h-0">
                <div
                  className="bid-card glass-panel flex-1 min-h-0 rounded-[20px] p-7 pb-6 flex flex-col items-center justify-center relative overflow-hidden border border-[rgba(228,93,53,0.18)]"
                  style={{ background: "linear-gradient(135deg,rgba(39,43,44,0.45) 0%,rgba(11,15,16,0.82) 100%)" }}
                >
                  <div className="absolute -top-8 -right-8 opacity-[0.05] pointer-events-none">
                    <span className="ms ms-fill text-white" style={{ fontSize: 220 }}>gavel</span>
                  </div>
                  <div className="absolute -top-6 -right-6 w-[100px] h-[100px] bg-white/[0.03] rotate-45 rounded-xl pointer-events-none" />

                  <div className="text-center w-full relative z-10">
                    <span className="bid-label font-mono-geist text-[#e45d35] text-[10px] uppercase tracking-[0.35em] block mb-5 font-bold">
                      Current High Bid
                    </span>
                    <div className={`font-archivo text-fluid-bid leading-none font-medium tracking-[0.01em] text-[#e45d35] mb-[15px] tabular-nums ${bidPulse ? "bid-animate" : ""}`}>
                      {fmtCR(currentLot?.currentBid)}
                    </div>
                    <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden mb-[15px] max-w-[200px] mx-auto relative">
                      <div
                        className={`absolute top-0 bottom-0 left-0 transition-all duration-100 ease-linear rounded-full ${shotClock < 25 ? "bg-red-500 animate-pulse" : "bg-[#e45d35]"}`}
                        style={{ width: `${shotClock}%` }}
                      />
                    </div>
                    {currentLot && !isSold && !isUnsold && (
                      <p className="font-mono-geist text-[9px] text-[#5a6a74] uppercase tracking-widest mb-[15px]">
                        Next bid: {fmtCR(nextBid)} CR
                      </p>
                    )}
                    <div className="bid-divider w-full h-px mb-[30px]" style={{ background: "linear-gradient(to right,transparent,rgba(228,93,53,0.30),transparent)" }} />
                    <div className="flex items-center justify-center gap-3 sm:gap-4">
                      <div className="bid-leading-icon w-[58px] h-[58px] rounded-xl bg-[rgba(228,93,53,0.10)] border border-[rgba(228,93,53,0.20)] flex items-center justify-center">
                        <span className="ms ms-fill text-[28px] text-[#e45d35]">groups</span>
                      </div>
                      <div>
                        <div className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] uppercase tracking-[0.18em] mb-1 font-bold">Leading Team</div>
                        <div className="bid-leading-name font-archivo text-[24px] font-light text-white tracking-[-0.01em]">
                          {winningTeam?.code ?? "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="glass-panel shrink-0 rounded-2xl px-[18px] pt-4 pb-[14px] border border-white/[0.06] relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,transparent 100%)" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] uppercase tracking-[0.12em]">Team Statistics</span>
                    <div className="flex gap-[5px]">
                      <div className="w-4 h-[3px] bg-[#e45d35] rounded-full" />
                      <div className="w-[6px] h-[3px] bg-white/10 rounded-full" />
                      <div className="w-[6px] h-[3px] bg-white/10 rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-archivo text-[16px] sm:text-[20px] font-bold text-white uppercase tracking-[0.02em]">
                      {winningTeam?.name ?? "No Leader Yet"}
                    </h3>
                    {winningTeam && (
                      <div className="px-[10px] py-[3px] bg-[rgba(228,93,53,0.10)] rounded-[6px] border border-[rgba(228,93,53,0.22)]">
                        <span className="font-mono-geist text-[#e45d35] text-[8px] font-bold tracking-[0.12em]">LEADING</span>
                      </div>
                    )}
                  </div>
                  <div className="team-stats-grid grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <span className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] uppercase tracking-[0.1em] block mb-[6px]">Squad Filled</span>
                      <div className="flex items-center gap-[10px]">
                        <span className="font-archivo text-[15px] sm:text-[18px] font-semibold text-white">
                          {winningPurse?.roster ?? 0} <span className="text-[10px] opacity-40">/ {auction.rules.teamSize}</span>
                        </span>
                        <div className="flex-1 h-[5px] bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#e45d35] rounded-full"
                            style={{ width: `${Math.min(((winningPurse?.roster ?? 0) / Math.max(auction.rules.teamSize, 1)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] uppercase tracking-[0.1em] mb-1">Remaining Purse</span>
                      <span className="font-archivo text-[15px] sm:text-[18px] font-semibold text-[#e45d35]">
                        {fmtCR(winningPurse?.remaining ?? auction.rules.totalPoints)} <span className="text-[9px] opacity-50">CR</span>
                      </span>
                    </div>
                  </div>
                  <div className="team-top-buy flex items-center justify-between px-3 py-2 bg-white/[0.04] rounded-[10px] border border-white/[0.05]">
                    <div className="flex items-center gap-[10px]">
                      <span className="ms ms-fill text-[13px] text-[#e45d35]">star</span>
                      <span className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.6)] uppercase tracking-[0.08em]">Top Buy</span>
                    </div>
                    <span className="font-mono-geist text-[10px] text-white">
                      {leaderTopBuy ? `${leaderTopBuy.playerName} — ${leaderTopBuy.currentBid.toLocaleString()} CR` : "—"}
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.04]">
                    <div className="h-full w-1/3 bg-[rgba(228,93,53,0.35)]" />
                  </div>
                  <div className="absolute -bottom-8 -right-8 w-[100px] h-[100px] rounded-full pointer-events-none" style={{ background: "rgba(228,93,53,0.05)", filter: "blur(24px)" }} />
                </div>
              </aside>
            </div>
          ) : (
            // ── FLOW VIEW ─────────────────────────────────────────────────
            <div className="flow-view-grid w-full h-full relative z-10 grid grid-cols-12 gap-0 overflow-hidden">
              <FlowCanvas
                players={flowPlayers}
                playerListRef={playerListRef}
                teamListRef={teamListRef}
                activePlayer={flowActivePlayer}
                activeTeam={flowActiveTeam}
              />

              {/* Player pool */}
              <aside ref={playerListRef} className="flow-pool col-span-3 h-full overflow-y-auto no-scrollbar px-6 py-6 z-10 border-r border-white/5">
                <div className="flex flex-col space-y-3 pt-6 pb-20 relative">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-archivo font-semibold text-lg tracking-tight uppercase text-white">Player Pool</h3>
                    {hasSelection && (
                      <button
                        onClick={clearFlowSelection}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-mono-geist uppercase tracking-widest text-[#e45d35] border border-[#e45d35]/30 hover:bg-[#e45d35]/10 transition-colors"
                      >
                        <span className="ms text-[11px]">close</span>
                        Clear
                      </button>
                    )}
                  </div>

                  {flowPlayers.map((p) => {
                    const pAny      = p as any;
                    const status    = pAny.status as string;
                    const isLocked  = status === "locked";
                    const isUnsoldP = status === "unsold";
                    const isSoldP   = status === "sold";
                    const isPending = status === "pending";

                    const isHighlighted = hasSelection && !isLocked && !isUnsoldP
                      ? (flowActivePlayer ? flowActivePlayer === p.id : flowActiveTeam === pAny.teamShortCode)
                      : false;
                    const isDimmed = hasSelection && !isHighlighted && !isLocked;

                    return (
                      <div
                        key={p.id}
                        id={`player-${p.id}`}
                        onClick={() => !isLocked && togglePlayer(p)}
                        className={[
                          "glass-panel p-3 rounded-xl flex items-center gap-3 transition-all duration-300 relative overflow-hidden",
                          isLocked    ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                          isHighlighted
                            ? "ring-1 ring-[#e45d35] shadow-[0_0_15px_rgba(228,93,53,0.3)] bg-white/10"
                            : "border border-white/5",
                          isDimmed    ? "opacity-30" : "",
                          // unsold: subtle red-crossed left border
                          isUnsoldP && !isHighlighted ? "border-l-2 border-l-red-900/60" : "",
                          // sold: green right border
                          isSoldP   && !isHighlighted ? "border-r-2 border-r-green-500/50" : "",
                          // pending: orange glow border
                          isPending && !isHighlighted ? "border border-[#e45d35]/40" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        {/* Player image */}
                        <div className={[
                          "w-10 h-10 rounded-lg overflow-hidden flex-shrink-0",
                          isUnsoldP ? "grayscale opacity-40" : "bg-[#313536]",
                        ].join(" ")}>
                          {p.img
                            ? <img src={p.img} className="w-full h-full object-cover" alt="" />
                            : <div className="w-full h-full bg-[#313536]" />
                          }
                        </div>

                        {/* Text */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={[
                              "font-semibold text-sm truncate font-archivo",
                              isUnsoldP ? "text-white/30 line-through decoration-red-900/60" : "text-white",
                            ].join(" ")}>
                              {p.name}
                            </p>
                            {/* Unsold badge */}
                            {isUnsoldP && (
                              <span className="shrink-0 font-mono-geist text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-red-950/60 text-red-500/70 border border-red-900/40">
                                UNSOLD
                              </span>
                            )}
                            {/* On block badge */}
                            {isPending && (
                              <span className="shrink-0 font-mono-geist text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#e45d35]/15 text-[#e45d35] border border-[#e45d35]/30 animate-pulse">
                                LIVE
                              </span>
                            )}
                          </div>
                          <p className={[
                            "text-[10px] font-mono font-medium mt-0.5 uppercase",
                            isSoldP   ? "text-green-400"  :
                            isUnsoldP ? "text-red-900/80" :
                            isPending ? "text-[#e45d35]"  :
                            "text-[#c6c6cd]",
                          ].join(" ")}>
                            {isSoldP   ? `SOLD • ${pAny.teamShortCode}` :
                             isUnsoldP ? `BASE: ${p.price}`             :
                             isPending ? "ON THE BLOCK"                 :
                             `BASE: ${p.price}`}
                          </p>
                        </div>

                        {/* Unsold X overlay — subtle diagonal slash */}
                        {isUnsoldP && (
                          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl opacity-20">
                            <div className="absolute top-0 left-0 w-full h-full"
                              style={{ background: "repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(180,0,0,0.15) 6px, rgba(180,0,0,0.15) 7px)" }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </aside>

              <section className="flow-canvas-container col-span-6 flex flex-col relative z-0 pointer-events-none" />

              {/* Franchises */}
              <aside ref={teamListRef} className="flow-franchises col-span-3 h-full overflow-y-auto no-scrollbar px-6 py-6 z-10 border-l border-white/5">
                <div className="flex flex-col space-y-3 pt-6 pb-20 relative">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-archivo font-semibold text-lg tracking-tight uppercase text-white">Franchises</h3>
                    {hasSelection && (
                      <button
                        onClick={clearFlowSelection}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-mono-geist uppercase tracking-widest text-[#e45d35] border border-[#e45d35]/30 hover:bg-[#e45d35]/10 transition-colors"
                      >
                        <span className="ms text-[11px]">close</span>
                        Clear
                      </button>
                    )}
                  </div>
                  {flowTeams.map((t) => {
                    const isHighlighted = hasSelection ? flowActiveTeam === t.shortCode : false;
                    const isDimmed = hasSelection && !isHighlighted;
                    return (
                      <div
                        key={t.id}
                        id={`team-${t.shortCode}`}
                        onClick={() => toggleTeam(t)}
                        className={`glass-panel p-3 rounded-xl flex items-center gap-4 cursor-pointer transition-all duration-300
                          ${isHighlighted ? "ring-1 ring-[#e45d35] shadow-[0_0_15px_rgba(228,93,53,0.3)] bg-white/10" : "border border-white/5 hover:border-[#e45d35]"}
                          ${isDimmed ? "opacity-30" : "opacity-100"}
                        `}
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#1c2021] flex-shrink-0">
                          {t.logoUrl && <img src={t.logoUrl} className="w-full h-full object-cover" alt="" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate uppercase tracking-tight font-archivo text-white">{t.name}</p>
                          <p className="text-[10px] font-mono text-[#e45d35] mt-0.5 tracking-wider">{t.purse}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </aside>
            </div>
          )}
        </main>

        {/* TICKER */}
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-[#e45d35] z-50 flex items-center overflow-hidden border-t border-[#e45d35]/50">
          <div className="bg-[#0b0f10] text-[#e45d35] h-full px-4 flex items-center shrink-0 z-10 border-r border-[#e45d35]/30">
            <span className="font-mono-geist text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#e45d35] animate-pulse" />
              LIVE NEWS
            </span>
          </div>
          <div className="flex-1 overflow-hidden h-full flex items-center">
            <div className="ticker-track flex whitespace-nowrap text-[#0b0f10] font-archivo font-bold text-sm uppercase tracking-wide">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center">
                  {tickerMessages.map((msg, j) => (
                    <span key={j} className="px-6 flex items-center gap-2">
                      <span className="w-1 h-1 bg-[#0b0f10]/50 rounded-full" />
                      {msg}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function WatchPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = use(params);
  return (
    <AuctionProvider>
      <ScreenContent auctionId={auctionId} />
    </AuctionProvider>
  );
}