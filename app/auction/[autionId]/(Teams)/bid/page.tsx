"use client";

import React, { useRef, useEffect, useState } from "react";
import Image from "next/image";
import MobileOnlyWrapper from "@/components/MobileOnlyWrapper";
import BottomNavBar from "@/components/BottomNavBar";

const BID_COLOR = "#e45d35";

const TICKER_INITIAL = [
  { time: "14:21:02", team: "DC - Capitals",    amount: "6,500", highlight: false },
  { time: "14:20:44", team: "MI - Titans",      amount: "5,800", highlight: false },
  { time: "14:22:10", team: "CK - Super Kings", amount: "8,200", highlight: true  },
  { time: "14:21:45", team: "MI - Titans",      amount: "7,800", highlight: false },
  { time: "14:21:30", team: "CK - Super Kings", amount: "7,200", highlight: false },
];

export default function BidPage() {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const bidCardRef = useRef<HTMLDivElement>(null);
  const [ticker, setTicker] = useState(TICKER_INITIAL);

  useEffect(() => {
    const id = setInterval(() => {
      setTicker((prev) => {
        const next = [...prev];
        const last = next.pop()!;
        next.unshift(last);
        return next;
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const handleScrollToBid = () => {
    if (!scrollRef.current || !bidCardRef.current) return;
    const cardTop =
      bidCardRef.current.getBoundingClientRect().top -
      scrollRef.current.getBoundingClientRect().top +
      scrollRef.current.scrollTop;
    scrollRef.current.scrollTo({ top: cardTop, behavior: "smooth" });
  };

  return (
    <MobileOnlyWrapper>
      <style>{`
        @keyframes pulse-glow {
          0%   { text-shadow: 0 0 10px rgba(228,93,53,0.2); transform: scale(1); }
          50%  { text-shadow: 0 0 30px rgba(228,93,53,0.7); transform: scale(1.02); }
          100% { text-shadow: 0 0 10px rgba(228,93,53,0.2); transform: scale(1); }
        }
        @keyframes ping-ring {
          0%   { transform: scale(1); opacity: 0.75; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes ticker-fade {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-pulse-bid { animation: pulse-glow 2s infinite ease-in-out; }
        .animate-ping-ring { animation: ping-ring 1.2s infinite ease-out; }
        .ticker-row        { animation: ticker-fade 0.3s ease; }

        .glass-panel {
          background: rgba(16,20,21,0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.10);
        }
        .material-symbols-outlined {
          font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
        }

        /* Snap scroll */
        .snap-scroll {
          scroll-snap-type: y proximity;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .snap-scroll::-webkit-scrollbar { display: none; }
        .snap-target { scroll-snap-align: start; scroll-snap-stop: normal; }

        /* Ticker scrollbar — always visible, styled */
        .ticker-scroll {
          overflow-y: scroll;
          scrollbar-width: thin;
          scrollbar-color: rgba(228,93,53,0.4) rgba(255,255,255,0.05);
        }
        .ticker-scroll::-webkit-scrollbar {
          width: 3px;
        }
        .ticker-scroll::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.04);
          border-radius: 99px;
        }
        .ticker-scroll::-webkit-scrollbar-thumb {
          background: rgba(228,93,53,0.45);
          border-radius: 99px;
        }
        .ticker-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(228,93,53,0.7);
        }
      `}</style>

      <div className="bg-[#101415] text-[#e0e3e5] h-[100dvh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <header className="shrink-0 z-50 flex justify-between items-center
                           px-4 h-16
                           bg-[rgba(16,20,21,0.6)] backdrop-blur-xl border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#bec6e0]"
                  style={{ fontVariationSettings:"'FILL' 1" }}>sports_cricket</span>
            <span className="font-['Archivo_Narrow'] text-2xl font-bold tracking-tight text-[#bec6e0]">
              APL AUCTION
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-[#272a2c] rounded-full border border-white/5">
              <span className="w-2 h-2 rounded-full bg-[#adc6ff] animate-pulse" />
              <span className="font-['Geist'] text-sm text-[#c6c6cd]">RCB - 01</span>
            </div>
            <span className="material-symbols-outlined text-[#bec6e0]">sensors</span>
          </div>
        </header>

        {/* ── Snap scroll body ── */}
        <div
          ref={scrollRef}
          className="snap-scroll flex-1 min-h-0 pb-[72px]"
        >
          {/* ══ PAGE 1: Player card + scroll hint ══ */}
          <div
            className="snap-target flex flex-col gap-3 p-3"
            style={{ height: "calc(100dvh - 64px - 72px)" }}
          >
            <MobilePlayerCard />

            <button
              onClick={handleScrollToBid}
              className="shrink-0 flex flex-col items-center gap-0.5 py-1 opacity-40 w-full"
            >
              <span className="font-['Geist'] text-[9px] text-[#c6c6cd] uppercase tracking-widest">
                Scroll to bid
              </span>
              <span className="material-symbols-outlined text-[#c6c6cd] text-base">expand_more</span>
            </button>
          </div>

          {/* ══ PAGE 2: Shared bid card → Budget → Bid btn → Ticker fills rest ══ */}
          <div
            className="snap-target flex flex-col gap-3 p-3"
            style={{ height: "calc(100dvh - 64px - 72px)" }}
          >
            {/* Shared bid card */}
            <div ref={bidCardRef} className="shrink-0">
              <BidStatusCard />
            </div>

            {/* Budget Health */}
            <div className="glass-panel rounded-xl p-4 flex flex-col gap-3 shrink-0">
              <h3 className="font-['Geist'] text-xs text-[#c6c6cd] uppercase tracking-widest">
                Budget Health
              </h3>
              <div>
                <div className="flex justify-between text-xs font-['Geist'] mb-1.5">
                  <span className="text-[#c6c6cd]">Remaining Purse</span>
                  <span>41,800 / 50,000</span>
                </div>
                <div className="w-full h-1.5 bg-[#323537] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: "83.6%",
                    backgroundColor: BID_COLOR,
                    boxShadow: `0 0 8px ${BID_COLOR}80`,
                  }} />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-['Geist'] text-xs text-[#c6c6cd]">Squad Filled</span>
                <span className="font-['Archivo_Narrow'] text-base font-bold text-white">
                  4 <span className="text-[#909097] text-sm font-normal">/ 16</span>
                </span>
              </div>
            </div>

            {/* Bid button — directly after budget */}
            <button
              className="shrink-0 w-full font-['Archivo_Narrow'] text-base font-bold py-4
                         rounded-lg flex items-center justify-center gap-3 text-white
                         active:scale-95 transition-all"
              style={{ backgroundColor: BID_COLOR, boxShadow: `0 4px 20px ${BID_COLOR}4D` }}
            >
              <span className="material-symbols-outlined">payments</span>
              PLACE BID: 9,200
            </button>

            {/* Live Bid Ticker — flex-1 fills all remaining space, scrollbar always visible */}
            <div className="flex-1 min-h-0 glass-panel rounded-xl overflow-hidden flex flex-col">
              {/* Sticky header */}
              <div className="shrink-0 px-4 py-3 border-b border-white/10
                              flex justify-between items-center bg-[#272a2c]/60">
                <h3 className="font-['Geist'] text-xs uppercase tracking-widest text-[#bec6e0]">
                  Live Bid Ticker
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] text-[#c6c6cd] uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab] animate-ping" />
                  Live
                </div>
              </div>

              {/* Scrollable rows — scrollbar always on */}
              <div className="ticker-scroll flex-1 min-h-0 divide-y divide-white/5">
                {ticker.map((row, i) => (
                  <div
                    key={`${row.time}-${i}`}
                    className="ticker-row px-4 py-3 flex justify-between items-center hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-['Geist'] text-xs text-[#c6c6cd] tabular-nums">{row.time}</span>
                      <span
                        className="font-['Inter'] text-sm"
                        style={{ color: row.highlight ? "white" : "#c6c6cd", fontWeight: row.highlight ? 700 : 400 }}
                      >
                        {row.team}
                      </span>
                    </div>
                    <span
                      className="font-['Geist'] text-sm tabular-nums"
                      style={{ color: row.highlight ? BID_COLOR : "#e0e3e5" }}
                    >
                      {row.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Nav ── */}
          <BottomNavBar />
      </div>
    </MobileOnlyWrapper>
  );
}

/* ── Mobile player card ── */
function MobilePlayerCard() {
  return (
    <section className="glass-panel rounded-xl overflow-hidden relative flex-1 min-h-0 flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-[#bec6e0]/10 to-transparent pointer-events-none z-10" />
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <Image
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBegOzZvXh93A5hFYa41tRyDbZXEYAVZm25Z1qU0S3j-PVgShDrOweX1wSRKQqzQxWsZcD949iE-yVfPvpGODLvMKqdlAPd7thKOAKx3UOXS7py_95YLzTdLh718OMcM9Q-zAERXxlXYqlOprE_TiRsmc3W5mugWpzbrB4XQ87e4H1Z_yAkbOaJBslvzGPzhbOFK_kmi24N5atku9dDVNfli4c3jhZX9E5Naw0ZXCBgTffmkXgR4MwjaUNWRowAazltT6IGRa8hYR4"
          alt="Virat Kohli"
          fill
          className="object-cover object-top"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#101415] via-[#101415]/50 to-transparent z-10" />
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-2">
          <span className="bg-[#bec6e0] text-[#283044] px-3 py-0.5 rounded font-['Geist'] text-xs uppercase tracking-widest font-bold">
            In Ring
          </span>
          <span className="font-['Geist'] text-xs text-[#c6c6cd]">#APL-2024-VK</span>
        </div>
        <div className="absolute bottom-2.5 left-3 right-3 z-20">
          <h1 className="font-['Archivo_Narrow'] text-3xl font-bold uppercase text-white leading-tight">
            Virat Kohli
          </h1>
          <p className="font-['Inter'] text-sm text-[#bec6e0] flex items-center gap-2 mt-0.5">
            Batsman <span className="w-1 h-1 rounded-full bg-[#45464d]" /> India
          </p>
        </div>
      </div>
      <div className="relative z-10 grid grid-cols-3 gap-2 p-2.5 shrink-0">
        {[
          { label: "Base Price",  value: "500k",  accent: true  },
          { label: "Strike Rate", value: "138.4", accent: false },
          { label: "Avg",         value: "52.7",  accent: false },
        ].map((s) => (
          <div key={s.label} className="p-2 bg-[#191c1e] rounded border border-white/5">
            <p className="text-[9px] font-['Geist'] text-[#c6c6cd] uppercase tracking-widest">{s.label}</p>
            <p className="font-['Archivo_Narrow'] text-sm font-bold"
               style={{ color: s.accent ? "#e45d35" : "#e0e3e5" }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Shared bid status card ── */
function BidStatusCard() {
  return (
    <div className="glass-panel rounded-xl p-5 flex flex-col justify-center items-center text-center relative shrink-0">
      <div className="absolute top-3.5 right-3.5">
        <span className="material-symbols-outlined animate-pulse" style={{ color: "#e45d35" }}>gavel</span>
      </div>
      <p className="font-['Geist'] text-xs text-[#c6c6cd] uppercase tracking-widest mb-1">
        Current High Bid
      </p>
      <div
        className="font-['Archivo_Narrow'] font-bold animate-pulse-bid mb-2"
        style={{ fontSize: "clamp(48px,12vw,72px)", lineHeight: 1, letterSpacing: "-0.02em", color: "#e45d35" }}
      >
        8,200
      </div>
      <div className="flex items-center gap-3 px-4 py-1.5 bg-[#323537]/90 border border-white/10 rounded-full">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping-ring absolute inline-flex h-full w-full rounded-full bg-[#ffb4ab] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ffb4ab]" />
          </span>
          <span className="font-['Geist'] text-[10px] font-bold text-[#ffb4ab] uppercase tracking-widest">Live</span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <span className="font-['Geist'] text-xs text-[#e0e3e5] uppercase tracking-tight">Bidding Active</span>
      </div>
    </div>
  );
}