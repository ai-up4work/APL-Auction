"use client";

import React, { useEffect, useState, useRef } from "react";

export default function ScreenPage() {
  const [currentBid, setCurrentBid] = useState(12500);
  const [bidPulse, setBidPulse] = useState(true);
  const [flashOverlay, setFlashOverlay] = useState(false);
  const [countdown, setCountdown] = useState(17 * 3600 + 48 * 60 + 11);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setCountdown((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function scheduleBid() {
      timeoutRef.current = setTimeout(() => {
        if (Math.random() > 0.85) {
          setCurrentBid((p) => p + 250);
          setBidPulse(false);
          requestAnimationFrame(() => requestAnimationFrame(() => setBidPulse(true)));
          setFlashOverlay(true);
          setTimeout(() => setFlashOverlay(false), 200);
        }
        scheduleBid();
      }, 5000 + Math.random() * 8000);
    }
    scheduleBid();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const ticker = [
    { name: "Rohit Sharma",    price: "16,250", team: "TITANS XI" },
    { name: "Kane Williamson", price: "9,500",  team: "MAVERICKS" },
    { name: "Ben Stokes",      price: "18,750", team: "ROYALS"    },
    { name: "MS Dhoni",        price: "14,000", team: "STRIKERS"  },
    { name: "Jasprit Bumrah",  price: "11,200", team: "FALCONS"   },
  ];

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
            flex-direction: column !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            padding: 0 16px !important;
            gap: 12px !important;
          }
          .aside-panel {
            width: 100% !important;
            flex-direction: row !important;
            padding: 0 0 12px 0 !important;
            gap: 10px !important;
            min-height: unset !important;
          }
          .bid-card {
            flex: 1 !important;
            min-height: 160px !important;
            padding: 16px !important;
          }
          .team-card {
            flex: 1 !important;
            padding: 12px !important;
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
        }

        /* ── Tablet layout (iPad): 640px–1023px uses desktop-style side-by-side ── */
        @media (min-width: 640px) and (max-width: 1023px) {
          .main-layout {
            flex-direction: row !important;
            overflow: hidden !important;
            gap: 10px !important;
            padding: 0 16px !important;
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

      <div className="font-inter bg-[#0b0f10] text-[#e0e3e4] h-screen w-screen flex flex-col overflow-hidden relative select-none">

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
        <main className="main-layout flex-1 mt-14 mb-[40px] px-[30px] flex gap-[14px] overflow-hidden min-h-0">

          {/* ── CENTER: Hero ── */}
          <section className="hero-section flex-1 flex flex-col items-center justify-center px-[34px] sm:px-[20px] py-[10px] relative min-w-0">

            {/* Player image */}
            <div className="relative">
              <div
                className="player-image-wrap relative z-10 w-[280px] h-[325px] rounded-xl overflow-hidden mb-[23px] shrink-0 border border-white/[0.08]"
                style={{ boxShadow: "0 0 70px rgba(0,0,0,0.8)" }}
              >
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAH3YsJAfo8TbaRj-mQVD1aaJeJS4NZbMLmGZoXwZq6b-8qdYJiG4yhUAO5qA2h84DtDViP0uoklStDd1ecScF5TiVz0xwZ_hKdC3wHcfavCBkIGxDzrRyP5IUfRLwDg0mI5dI6_wGOxwo4G4ScIau4tjN9we3cxjv7SzguyDEPXwYEDcWbAdyjXaFqXdJlXcxVxK3AFhv4lkTrRReAXYvDfMnQbR4KYwgtG6tFwmtD7oaNtVFJKUIUoltCFP95TT4pdzawlOpWm7Q"
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
                Virat Kohli
              </h2>
              <div className="flex items-center justify-center gap-3 sm:gap-5 flex-wrap">
                <span className="font-archivo text-[14px] sm:text-[17px] font-bold text-[#e45d35] tracking-[0.18em]">ALL-ROUNDER</span>
                <div className="w-[5px] h-[5px] rounded-full bg-[rgba(228,93,53,0.45)]" />
                <span className="font-archivo text-[14px] sm:text-[17px] font-semibold text-white/80 tracking-[0.08em]">
                  BASE: 2,000 <span className="text-[10px] opacity-60">CR</span>
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
                  {i < arr.length - 1 && <div className="w-px h-8 bg-white/10" />}
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
                  className={`font-archivo text-fluid-bid leading-none font-medium tracking-[0.01em] text-[#e45d35] mb-[30px] tabular-nums ${bidPulse ? "bid-animate" : ""}`}
                >
                  {currentBid.toLocaleString()}
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
        </main>
      </div>
    </>
  );
}