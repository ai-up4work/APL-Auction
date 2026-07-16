// components/demo/DemoWatchPage.tsx
"use client";

import React, { useSyncExternalStore, useState, useEffect } from "react";
import { demoModel, getDemoSnapshot, getNextBidAmount, fmtPts, type DemoPlayer } from "@/lib/demo/demoModel";
import { ShuffleOverlay } from "@/components/ShuffleOverlay";
import Image from "next/image";

// ShuffleOverlay (shared with the real /watch page) expects FlowPlayer-shaped
// objects — id, name, img, price as a formatted string, status. The demo
// model tracks its own lighter DemoPlayer shape, so translate here rather
// than reshaping demoModel just to satisfy this one overlay.
function toReelPlayer(p: DemoPlayer) {
  return {
    id: p.supabaseId,
    name: p.name,
    img: p.img,
    price: `${p.price.toLocaleString()} PTS`,
    status: "locked",
  } as any;
}

export default function DemoWatchPage() {
  const snap = useSyncExternalStore(
    demoModel.subscribe.bind(demoModel),
    getDemoSnapshot,
    getDemoSnapshot
  );
  const { auction, currentLot, completedLots, teamPurses, lotNumber, clockPct, isLocked, shuffle } = snap;

  const isSold = currentLot?.status === "sold";
  const isUnsold = currentLot?.status === "unsold";
  const isShuffling = currentLot?.status === "shuffling";
  const winningTeam = currentLot?.winningTeamId ? auction.teams.find((t) => t.supabaseId === currentLot.winningTeamId) : null;
  const winningPurse = winningTeam ? teamPurses[winningTeam.supabaseId] : null;
  const nextBid = currentLot ? getNextBidAmount(currentLot.currentBid, auction.rules.tiers) : 0;
  const shotClockColor = clockPct < 25 ? "#ef4444" : clockPct < 50 ? "#f59e0b" : "#c9971f";

  // Tracks whether the current lot's player image loaded okay. Reset
  // whenever the lot changes so a broken image on lot N doesn't leave
  // lot N+1 permanently stuck on the icon fallback. Mirrors the same
  // pattern used on the auctioneer page.
  const [imgOk, setImgOk] = useState(true);
  useEffect(() => setImgOk(true), [currentLot?.id]);

  // Whether we should actually attempt to render the player's photo:
  // there has to be a lot, it can't still be shuffling (player is a
  // secret until reveal), the URL has to be set, and it can't have
  // already failed to load for this lot.
  const showPlayerImg = !!currentLot?.playerImg && !isShuffling && imgOk;

  const tickerMessages = completedLots.length === 0
    ? [`Welcome to ${auction.session.auctionName}`, "Bidding will begin shortly — stay tuned"]
    : completedLots.slice(0, 8).map((l) => l.status === "sold" ? `${l.playerName} sold to ${l.winningTeamCode ?? "—"} for ${fmtPts(l.currentBid)} PTS!` : `${l.playerName} went unsold`);

  return (
    <div className="font-inter bg-background text-white h-full flex flex-col overflow-hidden relative" style={{ background: "#08090b" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Inter:wght@400;500;700&family=Geist+Mono:wght@400;500;700&display=swap');
        .font-archivo { font-family: 'Archivo Narrow', sans-serif; }
        .font-mono-geist { font-family: 'Geist Mono', monospace; }
        .glass-panel { background: rgba(255,255,255,0.03); backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.08); }
        @keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .ticker-track { animation: ticker-scroll 22s linear infinite; }
        @keyframes stamp-in { 0% { transform: translate(-50%,-50%) scale(3); opacity:0; } 50% { transform: translate(-50%,-50%) scale(0.8); opacity:1; } 100% { transform: translate(-50%,-50%) scale(1); opacity:1; } }
        .animate-stamp { animation: stamp-in 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
        @keyframes dot-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        .dot-pulse { animation: dot-pulse 1.5s ease-in-out infinite; }
      `}</style>

      <ShuffleOverlay
        isShuffling={shuffle.active}
        shuffleTarget={shuffle.target ? toReelPlayer(shuffle.target) : null}
        players={shuffle.pool.map(toReelPlayer)}
        shuffleIndex={shuffle.index}
      />

      <header className="shrink-0 h-14 flex items-center justify-between px-6 bg-black/40 border-b border-white/5">
        <div>
          <div className="font-archivo text-[16px] font-bold tracking-[-0.01em] text-white">{auction.session.auctionName}</div>
          <div className="font-mono-geist text-[8px] text-white/40 tracking-[0.12em] uppercase">
            Broadcast Feed • Lot #{currentLot?.lotNumber ?? lotNumber} of {auction.players.length + completedLots.length}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {currentLot && !isSold && !isUnsold && (
            <div className="flex items-center gap-2">
              <span className="font-mono-geist text-[9px] uppercase tracking-[0.1em]" style={{ color: shotClockColor }}>{isLocked ? "Locked" : "Clock"}</span>
              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-100" style={{ width: `${clockPct}%`, background: shotClockColor }} /></div>
            </div>
          )}
          <div className="text-right hidden sm:block">
            <div className="font-mono-geist text-[8px] text-white/40 uppercase tracking-[0.1em]">Total Purse Cap</div>
            <div className="font-archivo text-[15px] font-bold text-white">{fmtPts(auction.rules.totalPoints)} <span className="text-[8px] opacity-50">PTS</span></div>
          </div>
          <div className="flex items-center gap-2 bg-red-950/40 px-3 py-1 rounded-full border border-red-500/25">
            <div className="dot-pulse w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="font-mono-geist text-red-400 font-bold tracking-[0.18em] text-[8px]">LIVE</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex px-6 py-4 gap-4 overflow-hidden min-h-0">
        <section className="flex-1 flex flex-col items-center justify-center relative min-w-0">
          {isShuffling ? (
            <div className="text-center">
              <span className="material-symbols-outlined text-white/20 text-5xl block mb-3">casino</span>
              <h2 className="font-archivo text-2xl font-bold uppercase italic text-white">Revealing Next Lot…</h2>
            </div>
          ) : currentLot ? (
            <>
              <div className="relative">
                {(isSold || isUnsold) && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-stamp pointer-events-none">
                    <div className={`border-[5px] ${isSold ? "border-theme-orange text-theme-orange" : "border-gray-400 text-gray-400"} rounded-xl px-5 py-1.5 transform -rotate-12 backdrop-blur-sm bg-black/20`} style={{ borderColor: isSold ? "#c9971f" : "#9ca3af", color: isSold ? "#c9971f" : "#9ca3af" }}>
                      <span className="font-archivo text-4xl font-black italic tracking-tighter uppercase">{isSold ? "SOLD" : "UNSOLD"}</span>
                    </div>
                  </div>
                )}
                <div className={`relative z-10 w-[200px] h-[230px] rounded-xl overflow-hidden mb-4 border border-white/[0.08] flex items-center justify-center bg-white/5 ${(isSold || isUnsold) ? "grayscale brightness-50" : ""}`}>
                  {showPlayerImg ? (
                    <Image
                      src={currentLot.playerImg}
                      alt={currentLot.playerName}
                      fill
                      sizes="200px"
                      className="object-cover object-top"
                      onError={() => setImgOk(false)}
                    />
                  ) : (
                    <span className="material-symbols-outlined text-white/10" style={{ fontSize: 72 }}>person</span>
                  )}
                  {!isSold && !isUnsold && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 z-20"><div className="h-full transition-all duration-100" style={{ width: `${clockPct}%`, background: shotClockColor }} /></div>
                  )}
                </div>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-4 py-1 font-mono-geist text-[8px] font-bold tracking-[0.32em] uppercase rounded-full whitespace-nowrap" style={{ background: "#c9971f", color: "#000" }}>
                  LOT #{currentLot.lotNumber} • {isSold ? "SOLD" : isUnsold ? "UNSOLD" : isLocked ? "LOCKED" : "ON THE BLOCK"}
                </div>
              </div>
              <div className="text-center z-20 -mt-2">
                <h2 className="font-archivo text-3xl leading-none font-bold uppercase tracking-[-0.025em] text-white italic mb-2">{currentLot.playerName}</h2>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <span className="font-archivo text-[13px] font-bold tracking-[0.18em]" style={{ color: "#c9971f" }}>{currentLot.playerRole.toUpperCase()}</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="font-archivo text-[13px] font-semibold text-white/70 tracking-[0.08em]">BASE: {fmtPts(currentLot.basePrice)} PTS</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center">
              <span className="material-symbols-outlined text-white/15 text-6xl block mb-4">hourglass_empty</span>
              <h2 className="font-archivo text-2xl font-bold uppercase italic text-white mb-2">Awaiting First Lot</h2>
            </div>
          )}
        </section>

        <aside className="w-[30%] shrink-0 flex flex-col gap-3 min-h-0">
          <div className="glass-panel flex-1 min-h-0 rounded-2xl p-5 flex flex-col items-center justify-center relative">
            <span className="font-mono-geist text-theme-orange text-[9px] uppercase tracking-[0.35em] block mb-3 font-bold" style={{ color: "#c9971f" }}>Current High Bid</span>
            <div className="font-archivo text-4xl leading-none font-medium tracking-[0.01em] mb-3" style={{ color: "#c9971f" }}>{fmtPts(currentLot?.currentBid)}</div>
            {currentLot && !isSold && !isUnsold && !isLocked && <p className="font-mono-geist text-[8px] text-white/40 uppercase tracking-widest mb-3">Next bid: {fmtPts(nextBid)} PTS</p>}
            <div className="w-full h-px mb-4" style={{ background: "linear-gradient(90deg,transparent,rgba(201,151,31,0.3),transparent)" }} />
            <div className="flex items-center justify-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(201,151,31,0.1)", border: "1px solid rgba(201,151,31,0.2)" }}>
                <span className="material-symbols-outlined text-[22px]" style={{ color: "#c9971f" }}>groups</span>
              </div>
              <div>
                <div className="font-mono-geist text-[8px] text-white/40 uppercase tracking-[0.18em] mb-1 font-bold">Leading Team</div>
                <div className="font-archivo text-lg font-light text-white tracking-[-0.01em]">{winningTeam?.code ?? "—"}</div>
              </div>
            </div>
          </div>

          <div className="glass-panel shrink-0 rounded-2xl px-4 pt-3 pb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-archivo text-[15px] font-bold text-white uppercase tracking-[0.02em]">{winningTeam?.name ?? "No Leader Yet"}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="font-mono-geist text-[8px] text-white/40 uppercase tracking-[0.1em] block mb-1">Squad Filled</span>
                <span className="font-archivo text-[14px] font-semibold text-white">{winningPurse?.roster ?? 0} <span className="text-[9px] opacity-40">/ {auction.rules.teamSize}</span></span>
              </div>
              <div className="text-right">
                <span className="font-mono-geist text-[8px] text-white/40 uppercase tracking-[0.1em] block mb-1">Remaining Purse</span>
                <span className="font-archivo text-[14px] font-semibold" style={{ color: "#c9971f" }}>{fmtPts(winningPurse?.remaining ?? auction.rules.totalPoints)} PTS</span>
              </div>
            </div>
          </div>
        </aside>
      </main>

      <div className="shrink-0 h-9 bg-theme-orange flex items-center overflow-hidden border-t" style={{ background: "#c9971f", borderColor: "#c9971f80" }}>
        <div className="bg-black h-full px-3 flex items-center shrink-0" style={{ color: "#c9971f" }}>
          <span className="font-mono-geist text-[9px] uppercase font-bold tracking-widest">LIVE NEWS</span>
        </div>
        <div className="flex-1 overflow-hidden h-full flex items-center">
          <div className="ticker-track flex whitespace-nowrap font-archivo font-bold text-[13px] uppercase tracking-wide" style={{ color: "#000" }}>
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center">
                {tickerMessages.map((msg, j) => <span key={j} className="px-5">{msg}</span>)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}