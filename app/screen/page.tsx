"use client";

import React, { useEffect, useState, useRef } from "react";
import { FlowCanvas } from "@/components/FlowCanvas";
import { AUCTION_CONFIG } from "@/app/sankey/data";
import { ShuffleOverlay } from "@/components/ShuffleOverlay";

export default function ScreenPage() {
  const [currentBid, setCurrentBid] = useState(12500);
  const [bidPulse, setBidPulse] = useState(true);
  const [flashOverlay, setFlashOverlay] = useState(false);
  const [countdown, setCountdown] = useState(17 * 3600 + 48 * 60 + 11);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New states for added features
  const [isSold, setIsSold] = useState(false);
  const [isUnsold, setIsUnsold] = useState(false);
  const [shotClock, setShotClock] = useState(100); // percentage 100 to 0
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const shotClockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Toggle state between 'live' and 'flow' views
  const [activeView, setActiveView] = useState<'live' | 'flow'>('live');
  
  // For FlowCanvas
  const playerListRef = useRef<HTMLDivElement>(null);
  const teamListRef = useRef<HTMLDivElement>(null);
  const [players, setPlayers] = useState(AUCTION_CONFIG.players);
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [activeTeam, setActiveTeam] = useState<string | null>(null);
  const [flowActivePlayer, setFlowActivePlayer] = useState<string | null>(null);
  const [flowActiveTeam, setFlowActiveTeam] = useState<string | null>(null);

  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleTarget, setShuffleTarget] = useState<typeof players[0] | null>(null);
  const [shuffleIndex, setShuffleIndex] = useState(0);

  const togglePlayer = (p: typeof players[0]) => {
    if (flowActivePlayer === p.id) {
      setFlowActivePlayer(null);
      setFlowActiveTeam(null);
    } else {
      setFlowActivePlayer(p.id);
      setFlowActiveTeam(p.teamShortCode || null);
    }
  };

  const toggleTeam = (t: typeof AUCTION_CONFIG.teams[0]) => {
    if (flowActiveTeam === t.shortCode && !flowActivePlayer) {
      setFlowActiveTeam(null);
    } else {
      setFlowActiveTeam(t.shortCode);
      setFlowActivePlayer(null);
    }
  };

  const hasSelection = flowActivePlayer !== null || flowActiveTeam !== null;

  const activePlayerObj = players.find(p => p.id === activePlayer) || players.find(p => p.status === 'pending') || players[0];

  const handleShuffle = () => {
    const lockedPlayers = players.filter(p => p.status === 'locked');
    if (lockedPlayers.length === 0) return;

    setIsShuffling(true);
    setIsSold(false);
    setIsUnsold(false);
    setShuffleTarget(null);
    setActivePlayer(null);
    setActiveTeam(null);
    
    const randomIndex = Math.floor(Math.random() * lockedPlayers.length);
    const winner = lockedPlayers[randomIndex];
    
    let currentDelay = 30; // Start very fast
    const maxDelay = 400; // Slow down to this delay
    const slowdownFactor = 1.1; // Multiplier per tick
    let currentIndex = Math.floor(Math.random() * lockedPlayers.length);
    
    const spin = () => {
      currentIndex = (currentIndex + 1) % lockedPlayers.length;
      setShuffleIndex(currentIndex);
      
      if (activeView === 'live' && currentDelay < maxDelay) {
        currentDelay *= slowdownFactor;
        setTimeout(spin, currentDelay);
      } else {
        // Final selection
        setShuffleTarget(winner);
        
        setTimeout(() => {
          setPlayers(current => current.map(p => p.id === winner.id ? { ...p, status: 'pending' } : p));
          setIsShuffling(false);
          setShuffleTarget(null);
          setActivePlayer(winner.id);
          setActiveTeam(null);
          
          const parsed = parseFloat(winner.price.replace(/[^0-9.]/g, ''));
          let initialBid = isNaN(parsed) ? 200 : (winner.price.includes('M') ? parsed * 1000 : parsed);
          setCurrentBid(initialBid);
          setShotClock(100);
          setIsSold(false);
          setIsUnsold(false);
        }, activeView === 'live' ? 2500 : 100); 
      }
    };
    
    spin();
  };

  const markSold = () => {
    setIsSold(true);
    setIsUnsold(false);
    setShotClock(0);
    // In a real app we'd also assign the player to a team here
    if (activePlayerObj) {
      setPlayers(current => current.map(p => p.id === activePlayerObj.id ? { ...p, status: 'sold', teamShortCode: 'MI' } : p));
    }
  };

  const markUnsold = () => {
    setIsUnsold(true);
    setIsSold(false);
    setShotClock(0);
  };

  useEffect(() => {
    if (activePlayer) {
      const el = document.getElementById(`player-${activePlayer}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activePlayer]);

  useEffect(() => {
    if (activeTeam) {
      const el = document.getElementById(`team-${activeTeam}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeTeam]);

  useEffect(() => {
    const interval = setInterval(() => setCountdown((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function scheduleBid() {
      timeoutRef.current = setTimeout(() => {
        // Only simulate bids if not sold, unsold, and not shuffling
        if (!isSold && !isUnsold && !isShuffling && activePlayerObj && Math.random() > 0.85) {
          // New bid comes in, reset shot clock
          setCurrentBid((p) => p + 250);
          setBidPulse(false);
          requestAnimationFrame(() => requestAnimationFrame(() => setBidPulse(true)));
          setFlashOverlay(true);
          setTimeout(() => setFlashOverlay(false), 200);
          setShotClock(100);
          setIsSold(false);
          setIsUnsold(false);
        }
        scheduleBid();
      }, 5000 + Math.random() * 8000);
    }
    scheduleBid();
    
    // Simulate shot clock draining
    shotClockIntervalRef.current = setInterval(() => {
      setShotClock((prev) => {
        if (isSold || isUnsold || isShuffling || !activePlayerObj) return 100;

        if (prev <= 0) {
           // Simulate sold when clock hits 0
           if (!isSold && !isUnsold) setIsSold(true);
           return 0;
        }
        return prev - 2; // drain speed
      });
    }, 100);

    return () => { 
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (shotClockIntervalRef.current) clearInterval(shotClockIntervalRef.current);
    };
  }, [isSold, isUnsold, isShuffling, activePlayerObj]);

  // Randomly show leaderboard occasionally
  useEffect(() => {
    const leaderboardInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        setShowLeaderboard(true);
        setTimeout(() => setShowLeaderboard(false), 8000); // hide after 8s
      }
    }, 25000);
    return () => clearInterval(leaderboardInterval);
  }, []);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Inter:wght@400;500;700&family=Geist+Mono:wght@400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

        .ms {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          font-style: normal; line-height: 1; display: inline-block;
          text-transform: none; letter-spacing: normal; user-select: none;
        }
        .ms-fill { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }

        @keyframes pulse-bid {
          0%,100% { filter: drop-shadow(0 0 7px rgba(228,93,53,0.45)); }
          50%      { filter: drop-shadow(0 0 19px rgba(228,93,53,0.85)); }
        }
        .bid-animate { animation: pulse-bid 2s infinite ease-in-out; }

        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track { animation: ticker-scroll 30s linear infinite; }

        @keyframes stamp-sold {
          0% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
          70% { transform: translate(-50%, -50%) scale(1.1); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        .animate-stamp { animation: stamp-sold 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

        @keyframes screen-shake {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-2px, -2px); }
          20% { transform: translate(-3px, 0px); }
          30% { transform: translate(3px, 2px); }
          40% { transform: translate(1px, -1px); }
          50% { transform: translate(-1px, 2px); }
          60% { transform: translate(-3px, 1px); }
          70% { transform: translate(3px, 1px); }
          80% { transform: translate(-1px, -1px); }
          90% { transform: translate(1px, 2px); }
        }
        .animate-shake { animation: screen-shake 0.5s cubic-bezier(.36,.07,.19,.97); }

        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in-right 0.5s ease-out forwards; }
        
        @keyframes slide-out-right {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        .animate-slide-out { animation: slide-out-right 0.5s ease-in forwards; }

        @keyframes dot-pulse {
          0%,100% { opacity: 1; } 50% { opacity: 0.4; }
        }
        .dot-pulse { animation: dot-pulse 1.5s ease-in-out infinite; }

        .glass-panel {
          background: rgba(16,20,21,0.50);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
        }

        .flare {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(228,93,53,0.13) 0%, transparent 70%);
          filter: blur(70px);
          pointer-events: none;
        }

        .font-archivo { font-family: 'Archivo Narrow', sans-serif; }
        .font-mono-geist { font-family: 'Geist Mono', monospace; }
        .font-inter { font-family: 'Inter', sans-serif; }

        /* Fluid hero text */
        .text-fluid-hero { font-size: clamp(28px, 5vw, 80px); }
        .text-fluid-bid  { font-size: clamp(36px, 5.5vw, 84px); }

        .header-blur {
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .footer-blur {
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        /* ── Mobile only layout (< 640px) ── */
        @media (max-width: 639px) {
          .main-layout {
            overflow-y: auto !important;
            overflow-x: hidden !important;
            padding: 0 !important;
          }
          .live-view-inner {
            padding: 0 16px 20px 16px !important;
            gap: 16px !important;
          }
          .aside-panel {
            width: 100% !important;
            flex-direction: column !important;
            padding: 0 !important;
            gap: 16px !important;
            min-height: unset !important;
          }
          .bid-card {
            flex: none !important;
            min-height: 160px !important;
            padding: 16px !important;
            width: 100% !important;
          }
          .team-card {
            flex: none !important;
            padding: 12px !important;
            width: 100% !important;
          }
          .hero-section {
            padding: 8px 0 0 !important;
            min-height: unset !important;
          }
          .player-image-wrap {
            width: 220px !important;
            height: 265px !important;
            margin-bottom: 14px !important;
          }
          .stats-row {
            gap: 24px !important;
            padding: 10px 20px !important;
            margin-top: 16px !important;
            width: 100% !important;
            justify-content: space-between !important;
          }
          .stats-row .stat-value { font-size: 18px !important; }
          .header-logo-text { font-size: 14px !important; }
          .header-purse { display: none; }
          .header-px { padding-left: 14px !important; padding-right: 14px !important; }
          .live-badge-text { display: none; }
          .live-badge { padding: 6px 10px !important; }
          .team-stats-grid { gap: 6px !important; }
          .team-top-buy { display: none; }
          .bid-label { font-size: 8px !important; margin-bottom: 10px !important; }
          .bid-leading-icon { width: 40px !important; height: 40px !important; }
          .bid-leading-name { font-size: 16px !important; }
          .bid-divider { margin-bottom: 14px !important; }
          .footer-countdown-label { display: none; }
          
          /* Flow View Mobile */
          .flow-view-grid {
            display: flex !important;
            flex-direction: column !important;
            overflow-y: auto !important;
          }
          .flow-pool, .flow-franchises {
            width: 100% !important;
            border: none !important;
            height: auto !important;
            max-height: 400px !important;
          }
          .flow-canvas-container {
            display: none !important;
          }
        }

        /* ── Tablet layout (iPad): 640px–1023px uses desktop-style side-by-side ── */
        @media (min-width: 640px) and (max-width: 1023px) {
          .main-layout {
            padding: 0 !important;
          }
          .live-view-inner {
            padding: 0 16px !important;
            gap: 12px !important;
          }
          .aside-panel {
            width: 36% !important;
            flex-direction: column !important;
            padding: 12px 0 !important;
            gap: 10px !important;
          }
          .bid-card {
            flex: 1 !important;
            padding: 20px !important;
          }
          .hero-section {
            padding: 10px 12px !important;
          }
          .player-image-wrap {
            width: 240px !important;
            height: 290px !important;
            margin-bottom: 16px !important;
          }
          .stats-row {
            gap: 20px !important;
            padding: 10px 16px !important;
            margin-top: 20px !important;
          }
          .stats-row .stat-value { font-size: 20px !important; }
          .text-fluid-hero { font-size: clamp(26px, 4.5vw, 56px) !important; }
          .text-fluid-bid  { font-size: clamp(32px, 5vw, 60px) !important; }
          .header-px {
            padding-left: 18px !important;
            padding-right: 18px !important;
          }
          .bid-leading-name { font-size: 18px !important; }
          .bid-leading-icon { width: 44px !important; height: 44px !important; }
        }
      `}</style>

      {/* Flash overlay */}
      {flashOverlay && (
        <div className="fixed inset-0 pointer-events-none z-[200]" style={{ background: "rgba(228,93,53,0.05)" }} />
      )}
      
      {/* Shuffle Overlay */}
      {activeView === 'live' && (
        <ShuffleOverlay 
          isShuffling={isShuffling}
          shuffleTarget={shuffleTarget}
          players={players}
          shuffleIndex={shuffleIndex}
        />
      )}

      <div className="font-inter bg-[#0b0f10] text-[#e0e3e4] fixed inset-0 flex flex-col overflow-hidden select-none">

        {/* Atmospheric flares */}
        <div className="flare w-[430px] h-[430px]" style={{ top: -140, left: -140 }} />
        <div className="flare w-[430px] h-[430px]" style={{ bottom: -140, right: -140 }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at center, rgba(228,93,53,0.10) 0%, transparent 70%)" }} />

        {/* ══════════ HEADER ══════════ */}
        <header className="header-px fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-[30px] bg-[rgba(11,15,16,0.85)] header-blur border-b border-white/5">
          {/* Logo */}
          <div className="flex items-center gap-[13px]">
            <div className="w-9 h-9 rounded-[7px] bg-[#e45d35] flex items-center justify-center shrink-0">
              <span className="ms ms-fill text-[20px] text-[#0b0f10]">sports_cricket</span>
            </div>
            <div>
              <div className="header-logo-text font-archivo text-[18px] font-bold tracking-[-0.01em] text-white">APL AUCTION</div>
              <div className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] tracking-[0.12em] uppercase">Broadcast Feed Live • 2024 Season</div>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-[16px] sm:gap-[30px]">
            {/* Toggle Button */}
            <button 
              onClick={() => setActiveView(v => v === 'live' ? 'flow' : 'live')}
              className="text-[10px] font-mono-geist px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-md border border-white/10 transition-colors uppercase tracking-widest text-[#e45d35]"
            >
              {activeView === 'live' ? 'View Full Board' : 'View Live Bid'}
            </button>
            <div className="header-purse text-right hidden sm:block">
              <div className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.6)] uppercase tracking-[0.1em]">Total Purse Cap</div>
              <div className="font-archivo text-[18px] font-bold text-white">50,000 <span className="text-[9px] opacity-50">CR</span></div>
            </div>
            <div className="w-px h-7 bg-white/10 hidden sm:block" />
            <div className="live-badge flex items-center gap-[9px] bg-[rgba(127,29,29,0.30)] px-[17px] py-[6px] rounded-full border border-[rgba(239,68,68,0.30)]">
              <div className="dot-pulse w-[6px] h-[6px] rounded-full bg-red-500" style={{ boxShadow: "0 0 7px #ef4444" }} />
              <span className="live-badge-text font-mono-geist text-red-400 font-bold tracking-[0.18em] text-[9px]">LIVE BROADCAST</span>
            </div>
          </div>
        </header>

        {/* ══════════ MAIN ══════════ */}
        <main className={`main-layout flex-1 mt-14 mb-[40px] flex overflow-hidden min-h-0 relative ${isSold && activeView === 'live' ? 'animate-shake' : ''}`}>
          
          {/* Leaderboard Interrupt (Live View Only) */}
          {activeView === 'live' && showLeaderboard && (
            <div className="absolute left-8 top-8 z-40 animate-slide-in">
              <div className="glass-panel p-5 rounded-2xl border border-[#e45d35]/30 w-72" style={{ background: "rgba(11,15,16,0.85)" }}>
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
                  <span className="ms ms-fill text-[#e45d35]">leaderboard</span>
                  <span className="font-mono-geist text-[10px] text-white uppercase tracking-[0.2em] font-bold">Top Buys</span>
                </div>
                <div className="space-y-3">
                  {[
                    { name: 'Rohit Sharma', team: 'TITANS XI', price: '16,250' },
                    { name: 'Ben Stokes', team: 'ROYALS', price: '18,750' },
                    { name: 'MS Dhoni', team: 'STRIKERS', price: '14,000' },
                  ].map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <div className="font-archivo font-bold text-white text-sm">{p.name}</div>
                        <div className="font-mono-geist text-[8px] text-white/50 uppercase">{p.team}</div>
                      </div>
                      <div className="font-archivo text-[#e45d35] font-bold">{p.price}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeView === 'live' && (
            <div className="absolute bottom-6 right-6 z-[100] flex gap-2">
              <button onClick={markSold} className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/50 rounded text-xs font-mono font-bold hover:bg-green-500/40 transition-colors uppercase tracking-widest">Mark Sold</button>
              <button onClick={markUnsold} className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/50 rounded text-xs font-mono font-bold hover:bg-red-500/40 transition-colors uppercase tracking-widest">Mark Unsold</button>
              <button onClick={handleShuffle} disabled={isShuffling || players.filter(p => p.status === 'locked').length === 0} className="px-3 py-1 bg-[#e45d35]/20 text-[#e45d35] border border-[#e45d35]/50 rounded text-xs font-mono font-bold hover:bg-[#e45d35]/40 transition-colors uppercase tracking-widest disabled:opacity-50">Next Player</button>
            </div>
          )}

          {activeView === 'live' ? (
            <div className="live-view-inner w-full h-full flex flex-col sm:flex-row gap-[14px] px-0 sm:px-[30px] pt-4 pb-12">
              {/* ── CENTER: Hero ── */}
              <section className="hero-section flex-1 flex flex-col items-center justify-center px-[34px] sm:px-[20px] py-[10px] relative min-w-0">

                {/* Player image */}
                <div className="relative">
                  {/* SOLD / UNSOLD STAMP */}
                  {(isSold || isUnsold) && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-stamp pointer-events-none">
                      <div className={`border-[6px] ${isSold ? 'border-[#e45d35] text-[#e45d35]' : 'border-gray-400 text-gray-400'} rounded-xl px-6 py-2 transform -rotate-12 backdrop-blur-sm bg-black/20`} style={{ boxShadow: `0 0 40px ${isSold ? 'rgba(228,93,53,0.5)' : 'rgba(156,163,175,0.5)'}, inset 0 0 20px ${isSold ? 'rgba(228,93,53,0.5)' : 'rgba(156,163,175,0.5)'}` }}>
                        <span className="font-archivo text-6xl font-black italic tracking-tighter uppercase" style={{ textShadow: `0 0 20px ${isSold ? 'rgba(228,93,53,0.8)' : 'rgba(156,163,175,0.8)'}` }}>
                          {isSold ? 'SOLD' : 'UNSOLD'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div
                    className={`player-image-wrap relative z-10 w-[280px] h-[325px] rounded-xl overflow-hidden mb-[23px] shrink-0 border border-white/[0.08] transition-all duration-300 ${(isSold || isUnsold) ? 'grayscale brightness-50' : ''}`}
                    style={{ boxShadow: "0 0 70px rgba(0,0,0,0.8)" }}
                  >
                    <img
                      src={activePlayerObj?.img || "https://lh3.googleusercontent.com/aida-public/AB6AXuAH3YsJAfo8TbaRj-mQVD1aaJeJS4NZbMLmGZoXwZq6b-8qdYJiG4yhUAO5qA2h84DtDViP0uoklStDd1ecScF5TiVz0xwZ_hKdC3wHcfavCBkIGxDzrRyP5IUfRLwDg0mI5dI6_wGOxwo4G4ScIau4tjN9we3cxjv7SzguyDEPXwYEDcWbAdyjXaFqXdJlXcxVxK3AFhv4lkTrRReAXYvDfMnQbR4KYwgtG6tFwmtD7oaNtVFJKUIUoltCFP95TT4pdzawlOpWm7Q"}
                      alt="Player Portrait"
                      className="w-full h-full object-cover object-top"
                      style={{ filter: "grayscale(0.15) contrast(1.2)" }}
                    />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #0b0f10 0%, transparent 55%)" }} />
                  </div>

                  {/* LOT pill */}
                  <div
                    className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-5 py-1 bg-[#e45d35] text-[#0b0f10] font-mono-geist text-[8px] font-bold tracking-[0.32em] uppercase rounded-full whitespace-nowrap"
                    style={{ boxShadow: "0 4px 16px rgba(228,93,53,0.45)" }}
                  >
                    LOT #42 • ON THE BLOCK
                  </div>
                </div>

                {/* Player name */}
                <div className="text-center z-20 -mt-[30px]">
                  <h2 className="font-archivo text-fluid-hero leading-none font-bold uppercase tracking-[-0.025em] text-white italic mb-[9px]" style={{ textShadow: "0 4px 24px rgba(0,0,0,0.8)" }}>
                    {activePlayerObj?.name}
                  </h2>
                  <div className="flex items-center justify-center gap-3 sm:gap-5 flex-wrap">
                    <span className="font-archivo text-[14px] sm:text-[17px] font-bold text-[#e45d35] tracking-[0.18em]">ALL-ROUNDER</span>
                    <div className="w-[5px] h-[5px] rounded-full bg-[rgba(228,93,53,0.45)]" />
                    <span className="font-archivo text-[14px] sm:text-[17px] font-semibold text-white/80 tracking-[0.08em]">
                      BASE: {activePlayerObj?.price} <span className="text-[10px] opacity-60">CR</span>
                    </span>
                  </div>
                </div>

                {/* Stats row */}
                <div
                  className="stats-row flex items-center gap-16 mt-[32px] px-11 py-3 rounded-[17px] border border-white/[0.08]"
                  style={{
                    background: "rgba(11,15,16,0.42)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    boxShadow: "0 8px 42px rgba(0,0,0,0.55)",
                  }}
                >
                  {[
                    { label: "Matches",     value: "245"   },
                    { label: "Strike Rate", value: "138.4" },
                    { label: "Average",     value: "42.1"  },
                  ].map((s, i, arr) => (
                    <React.Fragment key={s.label}>
                      <div className="text-center">
                        <p className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] uppercase tracking-[0.18em] mb-[5px]">{s.label}</p>
                        <p className="stat-value font-archivo text-[24px] font-bold text-white">{s.value}</p>
                      </div>
                      {i < arr.length - 1 && <div className="w-px h-8 bg-white/10" /> }
                    </React.Fragment>
                  ))}
                </div>
              </section>

              {/* ── RIGHT: Bid + Team ── */}
              <aside className="aside-panel w-[26%] shrink-0 flex flex-col py-12 gap-3 min-h-0">

                {/* Bid card */}
                <div
                  className="bid-card glass-panel flex-1 min-h-0 rounded-[20px] p-7 pb-6 flex flex-col items-center justify-center relative overflow-hidden border border-[rgba(228,93,53,0.18)]"
                  style={{ background: "linear-gradient(135deg, rgba(39,43,44,0.45) 0%, rgba(11,15,16,0.82) 100%)" }}
                >
                  {/* Gavel emboss */}
                  <div className="absolute -top-8 -right-8 opacity-[0.05] pointer-events-none">
                    <span className="ms ms-fill text-white" style={{ fontSize: 220 }}>gavel</span>
                  </div>
                  <div className="absolute -top-6 -right-6 w-[100px] h-[100px] bg-white/[0.03] rotate-45 rounded-xl pointer-events-none" />

                  <div className="text-center w-full relative z-10">
                    <span className="bid-label font-mono-geist text-[#e45d35] text-[10px] uppercase tracking-[0.35em] block mb-5 font-bold">
                      Current High Bid
                    </span>

                    <div
                      className={`font-archivo text-fluid-bid leading-none font-medium tracking-[0.01em] text-[#e45d35] mb-[15px] tabular-nums ${bidPulse ? "bid-animate" : ""}`}
                    >
                      {currentBid.toLocaleString()}
                    </div>
                    
                    {/* SHOT CLOCK / TENSION BAR */}
                    <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden mb-[15px] max-w-[200px] mx-auto relative">
                      <div 
                        className={`absolute top-0 bottom-0 left-0 transition-all duration-100 ease-linear rounded-full ${shotClock < 25 ? 'bg-red-500 animate-pulse' : 'bg-[#e45d35]'}`}
                        style={{ width: `${shotClock}%` }}
                      />
                    </div>

                    <div className="bid-divider w-full h-px mb-[30px]" style={{ background: "linear-gradient(to right, transparent, rgba(228,93,53,0.30), transparent)" }} />

                    <div className="flex items-center justify-center gap-3 sm:gap-4">
                      <div className="bid-leading-icon w-[58px] h-[58px] rounded-xl bg-[rgba(228,93,53,0.10)] border border-[rgba(228,93,53,0.20)] flex items-center justify-center">
                        <span className="ms ms-fill text-[28px] text-[#e45d35]">groups</span>
                      </div>
                      <div>
                        <div className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] uppercase tracking-[0.18em] mb-1 font-bold">
                          Leading Team
                        </div>
                        <div className="bid-leading-name font-archivo text-[24px] font-light text-white tracking-[-0.01em]">STRIKERS</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Team stats card */}
                <div
                  className="glass-panel shrink-0 rounded-2xl px-[18px] pt-4 pb-[14px] border border-white/[0.06] relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 100%)" }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] uppercase tracking-[0.12em]">Team Statistics</span>
                    <div className="flex gap-[5px]">
                      <div className="w-4 h-[3px] bg-[#e45d35] rounded-full" />
                      <div className="w-[6px] h-[3px] bg-white/10 rounded-full" />
                      <div className="w-[6px] h-[3px] bg-white/10 rounded-full" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-archivo text-[16px] sm:text-[20px] font-bold text-white uppercase tracking-[0.02em]">Titans XI</h3>
                    <div className="px-[10px] py-[3px] bg-[rgba(228,93,53,0.10)] rounded-[6px] border border-[rgba(228,93,53,0.22)]">
                      <span className="font-mono-geist text-[#e45d35] text-[8px] font-bold tracking-[0.12em]">ACTIVE</span>
                    </div>
                  </div>

                  <div className="team-stats-grid grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <span className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] uppercase tracking-[0.1em] block mb-[6px]">Squad Filled</span>
                      <div className="flex items-center gap-[10px]">
                        <span className="font-archivo text-[15px] sm:text-[18px] font-semibold text-white">
                          14 <span className="text-[10px] opacity-40">/ 18</span>
                        </span>
                        <div className="flex-1 h-[5px] bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full w-[77%] bg-[#e45d35] rounded-full" />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] uppercase tracking-[0.1em] mb-1">Remaining Purse</span>
                      <span className="font-archivo text-[15px] sm:text-[18px] font-semibold text-[#e45d35]">
                        12,450 <span className="text-[9px] opacity-50">CR</span>
                      </span>
                    </div>
                  </div>

                  {/* Top buy */}
                  <div className="team-top-buy flex items-center justify-between px-3 py-2 bg-white/[0.04] rounded-[10px] border border-white/[0.05]">
                    <div className="flex items-center gap-[10px]">
                      <span className="ms ms-fill text-[13px] text-[#e45d35]">star</span>
                      <span className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.6)] uppercase tracking-[0.08em]">Top Buy</span>
                    </div>
                    <span className="font-mono-geist text-[10px] text-white">Rohit Sharma — 16,250 CR</span>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.04]">
                    <div className="h-full w-1/3 bg-[rgba(228,93,53,0.35)]" />
                  </div>
                  <div className="absolute -bottom-8 -right-8 w-[100px] h-[100px] rounded-full pointer-events-none" style={{ background: "rgba(228,93,53,0.05)", filter: "blur(24px)" }} />
                </div>
              </aside>
            </div>
          ) : (
            <div className="flow-view-grid w-full h-full relative z-10 grid grid-cols-12 gap-0 overflow-hidden">
              <FlowCanvas 
                players={players} 
                playerListRef={playerListRef}
                teamListRef={teamListRef}
                activePlayer={flowActivePlayer}
                activeTeam={flowActiveTeam}
              />
              {/* Left Column: Player Pool */}
              <aside 
                ref={playerListRef}
                className="flow-pool col-span-3 h-full overflow-y-auto no-scrollbar px-6 py-6 z-10 border-r border-white/5"
              >
                <div className="flex flex-col space-y-3 pt-6 pb-20 relative">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-archivo font-semibold text-lg tracking-tight uppercase text-white">Player Pool</h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleShuffle}
                        disabled={isShuffling || players.filter(p => p.status === 'locked').length === 0}
                        className="text-xs font-mono px-3 py-1 bg-[#e45d35]/20 text-[#e45d35] hover:bg-[#e45d35]/40 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-[#e45d35]/50 transition-colors uppercase tracking-widest"
                      >
                        SHUFFLE
                      </button>
                    </div>
                  </div>
                  {players.map(p => {
                    const isLocked = p.status === 'locked';
                    const isHighlighted = hasSelection && !isLocked ? (flowActivePlayer ? flowActivePlayer === p.id : flowActiveTeam === p.teamShortCode) : false;
                    const isDimmed = hasSelection && !isHighlighted && !isLocked;
                    
                    return (
                      <div 
                        key={p.id} 
                        id={`player-${p.id}`} 
                        onClick={() => !isLocked && togglePlayer(p)}
                        className={`glass-panel p-3 rounded-xl flex items-center gap-4 transition-all duration-300
                          ${!isLocked ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed grayscale'}
                          ${isHighlighted ? 'ring-1 ring-[#e45d35] shadow-[0_0_15px_rgba(228,93,53,0.3)] bg-white/10' : 'border border-white/5'}
                          ${isDimmed ? 'opacity-30' : ''}
                          ${p.status === 'sold' && !isHighlighted ? 'border-r-2 border-r-green-500/50' : ''}
                        `}
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#313536] flex-shrink-0">
                          {p.img && <img src={p.img} className="w-full h-full object-cover" alt="" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate font-archivo text-white">{p.name}</p>
                          <p className={`text-[10px] font-mono font-medium mt-0.5 ${p.status === 'sold' ? 'text-green-400' : 'text-[#c6c6cd]'} uppercase`}>
                            {p.status === 'sold' ? `SOLD • ${p.teamShortCode}` : `BASE: ${p.price}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </aside>

              {/* Middle Column */}
              <section className="flow-canvas-container col-span-6 flex flex-col relative z-0 pointer-events-none" />

              {/* Right Column: Franchises */}
              <aside 
                ref={teamListRef}
                className="flow-franchises col-span-3 h-full overflow-y-auto no-scrollbar px-6 py-6 z-10 border-l border-white/5"
              >
                <div className="flex flex-col space-y-3 pt-6 pb-20 relative">
                  <h3 className="font-archivo font-semibold text-lg tracking-tight uppercase text-white mb-4">Franchises</h3>
                  {AUCTION_CONFIG.teams.map(t => {
                    const isHighlighted = hasSelection ? flowActiveTeam === t.shortCode : false;
                    const isDimmed = hasSelection && !isHighlighted;
                    
                    return (
                      <div 
                        key={t.id} 
                        id={`team-${t.shortCode}`} 
                        onClick={() => toggleTeam(t)}
                        className={`glass-panel p-3 rounded-xl flex items-center gap-4 cursor-pointer transition-all duration-300
                          ${isHighlighted ? 'ring-1 ring-[#e45d35] shadow-[0_0_15px_rgba(228,93,53,0.3)] bg-white/10' : 'border border-white/5 hover:border-[#e45d35]'}
                          ${isDimmed ? 'opacity-30' : 'opacity-100'}
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
        {/* ══════════ TICKER ══════════ */}
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-[#e45d35] z-50 flex items-center overflow-hidden border-t border-[#e45d35]/50">
          <div className="bg-[#0b0f10] text-[#e45d35] h-full px-4 flex items-center shrink-0 z-10 border-r border-[#e45d35]/30">
            <span className="font-mono-geist text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#e45d35] animate-pulse" />
              LIVE NEWS
            </span>
          </div>
          <div className="flex-1 overflow-hidden h-full flex items-center">
            <div className="ticker-track flex whitespace-nowrap text-[#0b0f10] font-archivo font-bold text-sm uppercase tracking-wide">
              {/* Duplicate for infinite scroll */}
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center">
                  <span className="px-6 flex items-center gap-2">
                    <span className="w-1 h-1 bg-[#0b0f10]/50 rounded-full" />
                    Rohit Sharma sold to TITANS XI for 16,250 CR!
                  </span>
                  <span className="px-6 flex items-center gap-2">
                    <span className="w-1 h-1 bg-[#0b0f10]/50 rounded-full" />
                    Ben Stokes base price set at 2,000 CR
                  </span>
                  <span className="px-6 flex items-center gap-2">
                    <span className="w-1 h-1 bg-[#0b0f10]/50 rounded-full" />
                    MS Dhoni retains STRIKERS captaincy
                  </span>
                  <span className="px-6 flex items-center gap-2">
                    <span className="w-1 h-1 bg-[#0b0f10]/50 rounded-full" />
                    Jasprit Bumrah heading to FALCONS for 11,200 CR
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
