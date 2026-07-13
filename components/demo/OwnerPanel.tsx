// components/demo/OwnerPanel.tsx
"use client";

import { useSyncExternalStore } from "react";
import { demoStore, nextBidAmount } from "@/lib/demo/demoStore";
import DemoCursor from "./DemoCursor";

export default function OwnerPanel({ teamId, cursorKey, label }: { teamId: string; cursorKey: string; label: string }) {
  const state = useSyncExternalStore(demoStore.subscribe.bind(demoStore), demoStore.getState.bind(demoStore));
  const team = state.teams.find((t) => t.id === teamId);
  const lot = state.currentLot;
  const isLeading = !!team && lot?.winningTeamId === team.id;
  const purgePct = team ? Math.min((team.remaining / team.totalPurse) * 100, 100) : 0;
  const nextBid = lot ? nextBidAmount(lot.currentBid) : 0;

  const canBid = !!lot && lot.status === "pending" && !state.isLocked && !isLeading && nextBid <= (team?.remaining ?? 0);

  function handleBid() {
    if (!canBid) return;
    demoStore.placeBid(teamId);
  }

  return (
    <div
      data-demo-panel={cursorKey}
      className="relative rounded-2xl overflow-hidden border border-white/10 flex flex-col h-full"
      style={{ background: "linear-gradient(180deg,#101414,#0d1117)" }}
    >
      <DemoCursor cursor={state.cursors[cursorKey]} />

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
            {lot ? lot.currentBid.toLocaleString() : "—"}
          </p>
          <p className="font-mono text-[10px] text-white/40 mt-1">
            {lot?.winningTeamCode ? `Leading: ${lot.winningTeamCode}` : "No bids yet"}
          </p>
        </div>

        <div className="rounded-lg border border-white/10 p-3">
          <div className="flex justify-between text-[10px] font-mono text-white/50 mb-1.5">
            <span>PURSE REMAINING</span>
            <span>{team?.remaining.toLocaleString()} / {team?.totalPurse.toLocaleString()}</span>
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
          {isLeading ? "You're Leading" : lot && lot.status === "pending" ? `Bid ${nextBid.toLocaleString()}` : "Awaiting Lot"}
        </button>
      </div>
    </div>
  );
}