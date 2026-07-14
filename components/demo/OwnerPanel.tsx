// components/demo/OwnerPanel.tsx
"use client";

import { useSyncExternalStore } from "react";
import { demoModel, getDemoSnapshot, getNextBidAmount, fmtPts } from "@/lib/demo/demoModel";
import DemoCursor from "./DemoCursor";

export default function OwnerPanel({ teamId, cursorKey, label }: { teamId: string; cursorKey: string; label: string }) {
  // demoOrchestrator drives demoModel exclusively (cursors, bids, clock,
  // shuffle, spotlight) — demoStore is a separate, unconnected store, so
  // this panel needs to read from demoModel to actually stay in sync with
  // the rest of the sandbox.
  const snap = useSyncExternalStore(
    demoModel.subscribe.bind(demoModel),
    getDemoSnapshot,
    getDemoSnapshot
  );

  const team = snap.auction.teams.find((t) => t.supabaseId === teamId);
  const purse = snap.teamPurses[teamId];
  const lot = snap.currentLot;
  const isLeading = !!team && lot?.winningTeamId === team.supabaseId;
  const totalPurse = snap.auction.rules.totalPoints;
  const purgePct = purse ? Math.min((purse.remaining / totalPurse) * 100, 100) : 0;
  const nextBid = lot ? getNextBidAmount(lot.currentBid, snap.auction.rules.tiers) : 0;

  const canBid = !!lot && lot.status === "pending" && !snap.isLocked && !isLeading && nextBid <= (purse?.remaining ?? 0);

  function handleBid() {
    if (!canBid) return;
    demoModel.placeBid(teamId);
  }

  return (
    <div
      data-demo-panel={cursorKey}
      className="relative rounded-2xl overflow-hidden border border-white/10 flex flex-col h-full"
      style={{ background: "linear-gradient(180deg,#101414,#0d1117)" }}
    >
      <DemoCursor cursor={snap.cursors[cursorKey]} />

      <header className="flex items-center gap-3 px-5 py-3 border-b border-white/10">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
          style={{ background: team?.color }}
        >
          {team?.code}
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">{team?.name}</p>
          <p className="font-mono text-[9px] text-white/40 mt-0.5">{label}</p>
        </div>
      </header>

      <div className="flex-1 p-5 flex flex-col gap-4">
        <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-center">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/40 mb-1">Current High Bid</p>
          <p className="text-4xl font-black" style={{ color: "#c9971f" }}>
            {lot ? fmtPts(lot.currentBid) : "—"}
          </p>
          <p className="font-mono text-[10px] text-white/40 mt-1">
            {lot?.winningTeamCode ? `Leading: ${lot.winningTeamCode}` : "No bids yet"}
          </p>
        </div>

        <div className="rounded-lg border border-white/10 p-3">
          <div className="flex justify-between text-[10px] font-mono text-white/50 mb-1.5">
            <span>PURSE REMAINING</span>
            <span>{fmtPts(purse?.remaining)} / {fmtPts(totalPurse)}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${purgePct}%`, background: "#c9971f" }} />
          </div>
        </div>

        <button
          id="demo-bid-btn"
          onClick={handleBid}
          disabled={!canBid}
          className="py-3.5 rounded-xl font-bold uppercase tracking-wide text-sm text-white disabled:opacity-40"
          style={{ background: isLeading ? "#14351f" : "#c9971f", border: isLeading ? "1px solid #22c55e55" : "none" }}
        >
          {isLeading ? "You're Leading" : lot && lot.status === "pending" ? `Bid ${fmtPts(nextBid)}` : "Awaiting Lot"}
        </button>
      </div>
    </div>
  );
}