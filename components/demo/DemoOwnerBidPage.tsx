"use client";

import React, { useSyncExternalStore } from "react";
import { demoModel, getDemoSnapshot, getNextBidAmount, fmtPts } from "@/lib/demo/demoModel";
import DemoCursor from "./DemoCursor";

const BID_COLOR = "#c9971f";

export default function DemoOwnerBidPage({ teamId, cursorKey }: { teamId: string; cursorKey: string }) {
  const snap = useSyncExternalStore(
    demoModel.subscribe.bind(demoModel),
    getDemoSnapshot,
    getDemoSnapshot
  );
  const { auction, currentLot, bidHistory, teamPurses, clockPct, isLocked } = snap;

  const team = auction.teams.find((t) => t.supabaseId === teamId)!;
  const purse = teamPurses[teamId];
  const isLeading = currentLot?.winningTeamId === teamId;
  const isSold = currentLot?.status === "sold";
  const isUnsold = currentLot?.status === "unsold";
  const isRevealing = currentLot?.status === "shuffling";
  const nextBid = currentLot ? getNextBidAmount(currentLot.currentBid, auction.rules.tiers) : 0;
  const purgePct = purse ? Math.min((purse.remaining / auction.rules.totalPoints) * 100, 100) : 0;

  const canBid = !!currentLot && currentLot.status === "pending" && !isLocked && nextBid <= (purse?.remaining ?? 0) && !isLeading;

  function handleBid() {
    if (!canBid) return;
    demoModel.placeBid(teamId);
  }

  const bidLabel = isRevealing ? "AWAITING REVEAL" : isSold ? "LOT CLOSED" : isUnsold ? "LOT UNSOLD" : isLocked ? "TIME'S UP" : isLeading ? "YOU'RE LEADING" : !currentLot ? "AWAITING LOT" : `PLACE BID — ${fmtPts(nextBid)}`;

  return (
    <div data-demo-panel={cursorKey} className="bg-background mb-8 text-white h-full flex flex-col overflow-hidden font-inter relative" style={{ background: "#0b0d0e" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,400;1,700&family=Geist+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        .f-display { font-family: 'Archivo Narrow', sans-serif; font-style: italic; font-weight: 700; text-transform: uppercase; letter-spacing: -0.02em; }
        .f-label { font-family: 'Geist Mono', monospace; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; }
        .f-label-sm { font-family: 'Geist Mono', monospace; font-weight: 500; text-transform: uppercase; letter-spacing: 0.12em; }
        .f-num { font-family: 'Archivo Narrow', sans-serif; font-weight: 700; letter-spacing: -0.02em; }
        .glass { background: rgba(16,20,21,0.70); backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.08); }
        .glass-hot { background: rgba(201,151,31,0.06); backdrop-filter: blur(24px); border: 1px solid rgba(201,151,31,0.22); }
      `}</style>

      <DemoCursor cursor={snap.cursors[cursorKey] as any} />

      <header className="shrink-0 h-14 flex items-center justify-between px-4 my-8 bg-black/40 border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: team.color }}>
            <span className="f-display text-[13px] text-white not-italic">{team.code}</span>
          </div>
          <div>
            <p className="f-display text-[15px] text-white leading-none tracking-[-0.01em]">{team.name}</p>
            <p className="f-label-sm text-[#a0aec0] text-[9px] leading-none mt-[3px]">{fmtPts(purse?.remaining)} Points REMAINING</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="f-label text-[9px] text-emerald-400">LIVE</span>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden pl-6 flex flex-col gap-3 h-full">
        {/* Player card — flex-1 so it absorbs whatever height is left over
            below the fixed-height cards, instead of leaving empty space
            under a hard-coded height. */}
        <section className="glass rounded-xl overflow-hidden relative flex-1 h-full">
          <div className="w-full h-full bg-white/[0.03] flex items-center justify-center relative">
            <span className="material-symbols-outlined text-white/10" style={{ fontSize: 90 }}>person</span>
            <div className="absolute top-3 left-3">
              <span className="f-label text-[9px] px-3 py-1 rounded-full" style={{ background: BID_COLOR, color: "#000" }}>
                {currentLot ? `LOT #${currentLot.lotNumber} • ${isRevealing ? "REVEALING" : isSold ? "SOLD" : isUnsold ? "UNSOLD" : "ON THE BLOCK"}` : "AWAITING LOT"}
              </span>
            </div>
            <div className="absolute bottom-2 left-3 right-3">
              <h1 className="f-display text-[26px] text-white leading-none mb-1">{isRevealing ? "???" : currentLot?.playerName ?? "—"}</h1>
              <p className="f-label-sm text-[9px] text-white/50">{isRevealing ? "—" : currentLot ? `${currentLot.playerRole} · ${currentLot.playerCountry}` : "Auctioneer hasn't started yet"}</p>
            </div>
          </div>
        </section>

        {/* Current bid card */}
        <div className="glass-hot rounded-2xl px-5 pt-5 pb-4 shrink-0">
          <p className="f-label text-[10px] text-[#5a6a74] mb-1">CURRENT HIGH BID</p>
          <div className="flex items-end gap-2 mb-2">
            <span className="f-display leading-none text-[56px]" style={{ color: isSold ? BID_COLOR : isUnsold ? "#6b7280" : BID_COLOR }}>
              {currentLot && !isRevealing ? fmtPts(currentLot.currentBid) : "—"}
            </span>
            <span className="f-label text-[11px] text-[#5a6a74] mb-2">Points</span>
          </div>
          <div className="w-full h-px mb-3" style={{ background: "linear-gradient(90deg,transparent,rgba(201,151,31,0.25),transparent)" }} />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(201,151,31,0.12)", border: "1px solid rgba(201,151,31,0.25)" }}>
                <span className="material-symbols-outlined text-[16px]" style={{ color: BID_COLOR }}>groups</span>
              </div>
              <div>
                <p className="f-label-sm text-[8px] text-[#5a6a74]">LEADER</p>
                <p className="f-display text-[16px] text-white leading-none not-italic">{isRevealing ? "—" : currentLot?.winningTeamCode ?? "—"}</p>
              </div>
            </div>
            {currentLot && !isSold && !isUnsold && !isRevealing && !isLocked && !isLeading && (
              <div className="text-right">
                <p className="f-label-sm text-[8px] text-[#5a6a74]">NEXT BID</p>
                <p className="f-num text-[16px]" style={{ color: BID_COLOR }}>{fmtPts(nextBid)} Points</p>
              </div>
            )}
          </div>
        </div>

        {/* Budget health */}
        <div className="glass rounded-xl px-4 pt-3 pb-4 shrink-0">
          <p className="f-label text-[10px] text-[#5a6a74] mb-2">BUDGET HEALTH</p>
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="f-label-sm text-[9px] text-[#7a8a94]">PURSE REMAINING</span>
            <span className="f-num text-[14px] text-white">{fmtPts(purse?.remaining)} <span className="text-[#5a6a74] text-[10px] font-normal">/ {fmtPts(auction.rules.totalPoints)}</span></span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden bg-white/[0.06]">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${purgePct}%`, background: purgePct < 25 ? "#ef4444" : BID_COLOR }} />
          </div>
        </div>

        {/* Bid button */}
        <button
          id="demo-bid-btn"
          onClick={handleBid}
          disabled={!canBid}
          className="shrink-0 w-full py-4 mb-4 rounded-xl flex items-center justify-center gap-3 disabled:opacity-40"
          style={{ background: isLeading ? "#0f1f0f" : canBid ? BID_COLOR : "#1a1e1f", border: isLeading ? "1px solid rgba(34,197,94,0.3)" : "none" }}
        >
          <span className="material-symbols-outlined text-[20px] text-white">gavel</span>
          <span className="f-display text-[15px] text-white not-italic tracking-[0.04em]">{bidLabel}</span>
        </button>
      </div>
    </div>
  );
}