// components/demo/AuctioneerPanel.tsx
"use client";

import { useSyncExternalStore, useRef } from "react";
import { demoStore, DemoPlayer } from "@/lib/demo/demoStore";
import DemoCursor from "./DemoCursor";

const AUCTIONEER_KEY = "auctioneer";

export default function AuctioneerPanel() {
  const state = useSyncExternalStore(demoStore.subscribe.bind(demoStore), demoStore.getState.bind(demoStore));
  const lot = state.currentLot;
  const shotColor = state.clockPct < 25 ? "#ef4444" : state.clockPct < 50 ? "#f59e0b" : "#c9971f";
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleStartNext() {
    // Only allow starting a new lot when nothing is in progress
    if (lot && lot.status !== "sold" && lot.status !== "unsold") return;

    demoStore.refillPoolIfEmpty();
    const pool = demoStore.getState().players;
    if (pool.length === 0) return;

    const player: DemoPlayer = pool[0];
    demoStore.startShuffle(player);

    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => demoStore.revealLot(), 1400);
  }

  function handleHammerSold() {
    if (!lot || lot.status !== "pending" || !lot.winningTeamId) return;
    demoStore.hammerSold();
  }

  const canHammer = !!lot && lot.status === "pending" && !!lot.winningTeamId;
  const canStart = !lot || lot.status === "sold" || lot.status === "unsold";

  return (
    <div
      data-demo-panel="auctioneer"
      className="relative rounded-2xl overflow-hidden border border-white/10 flex flex-col h-full"
      style={{ background: "linear-gradient(180deg,#0d1117,#12161c)" }}
    >
      <DemoCursor cursor={state.cursors[AUCTIONEER_KEY]} />

      <header className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">Auctioneer Console</span>
        <span className="font-mono text-[10px] text-theme-orange" style={{ color: "#c9971f" }}>
          LOT #{lot?.lotNumber ?? state.lotNumber}
        </span>
      </header>

      <div className="flex-1 p-5 flex flex-col gap-4">
        <div className="flex-1 rounded-xl border border-white/10 bg-black/30 flex flex-col items-center justify-center gap-3 p-6 relative overflow-hidden">
          {lot?.status === "shuffling" ? (
            <>
              <span className="text-4xl animate-spin">🔀</span>
              <p className="font-mono text-xs uppercase tracking-widest text-white/60">Revealing player…</p>
            </>
          ) : lot ? (
            <>
              <div className="w-24 h-24 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
                🏏
              </div>
              <h3 className="font-bold italic text-2xl uppercase text-white text-center">{lot.playerName}</h3>
              <div className="flex gap-2 text-[10px] font-mono uppercase text-white/50">
                <span>{lot.playerRole}</span><span>·</span><span>{lot.playerCountry}</span>
              </div>
              {lot.status === "pending" && (
                <>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
                    <div className="h-full rounded-full transition-all" style={{ width: `${state.clockPct}%`, background: shotColor }} />
                  </div>
                  <div className="text-center mt-1">
                    <p className="font-mono text-[9px] uppercase text-white/40">Current Bid</p>
                    <p className="font-bold text-2xl" style={{ color: "#c9971f" }}>{lot.currentBid.toLocaleString()} pts</p>
                    <p className="font-mono text-[10px] text-white/50">{lot.winningTeamCode ?? "No bids yet"}</p>
                  </div>
                </>
              )}
              {(lot.status === "sold" || lot.status === "unsold") && (
                <span
                  className="mt-2 px-4 py-1 rounded-full border-2 font-black uppercase italic text-lg"
                  style={{ color: lot.status === "sold" ? "#c9971f" : "#94a3b8", borderColor: lot.status === "sold" ? "#c9971f" : "#94a3b8" }}
                >
                  {lot.status}
                </span>
              )}
            </>
          ) : (
            <p className="font-mono text-xs uppercase text-white/40">Awaiting first lot</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            id="demo-start-btn"
            onClick={handleStartNext}
            disabled={!canStart}
            className="py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wide disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#A87815,#E8C468)", color: "#1a1304" }}
          >
            Start Next Player
          </button>
          <button
            id="demo-hammer-btn"
            onClick={handleHammerSold}
            disabled={!canHammer}
            className="py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wide border border-white/15 text-white/80 disabled:opacity-40"
          >
            Hammer Sold
          </button>
        </div>

        <div className="rounded-lg border border-white/10 p-2 max-h-24 overflow-y-auto">
          {state.bidHistory.length === 0 ? (
            <p className="font-mono text-[10px] text-white/30 text-center py-2">No bids yet</p>
          ) : (
            state.bidHistory.map((b) => (
              <div key={b.id} className="flex justify-between text-[10px] font-mono py-1 text-white/60">
                <span style={{ color: b.teamColor }}>{b.teamCode}</span>
                <span>{b.amount.toLocaleString()} pts</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}