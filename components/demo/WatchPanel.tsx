// components/demo/WatchPanel.tsx
"use client";

import { useSyncExternalStore } from "react";
import { demoStore } from "@/lib/demo/demoStore";

export default function WatchPanel() {
  const state = useSyncExternalStore(demoStore.subscribe.bind(demoStore), demoStore.getState.bind(demoStore));
  const lot = state.currentLot;
  const shotColor = state.clockPct < 25 ? "#ef4444" : state.clockPct < 50 ? "#f59e0b" : "#c9971f";

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 flex flex-col h-full" style={{ background: "#08090b" }}>
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">Public Broadcast</span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="font-mono text-[9px] text-red-400 font-bold">LIVE</span>
        </span>
      </header>

      <div className="flex-1 flex items-center justify-center p-6 text-center">
        {lot?.status === "shuffling" ? (
          <div>
            <p className="text-5xl mb-3 animate-pulse">🎲</p>
            <p className="font-bold italic uppercase text-white/70">Shuffling next lot…</p>
          </div>
        ) : lot ? (
          <div>
            <h2 className="font-black italic text-4xl uppercase text-white mb-2">{lot.playerName}</h2>
            <p className="font-mono text-xs uppercase tracking-widest text-theme-orange mb-4" style={{ color: "#c9971f" }}>
              {lot.playerRole} · {lot.playerCountry}
            </p>
            {lot.status === "pending" && (
              <>
                <p className="text-6xl font-black mb-2" style={{ color: "#c9971f" }}>
                  {lot.currentBid.toLocaleString()}
                </p>
                <p className="font-mono text-xs text-white/50 mb-4">
                  {lot.winningTeamCode ? `${lot.winningTeamCode} leading` : "No bids yet"}
                </p>
                <div className="w-64 h-1.5 rounded-full bg-white/10 overflow-hidden mx-auto">
                  <div className="h-full rounded-full transition-all" style={{ width: `${state.clockPct}%`, background: shotColor }} />
                </div>
              </>
            )}
            {(lot.status === "sold" || lot.status === "unsold") && (
              <span
                className="inline-block px-6 py-2 rounded-xl border-4 font-black uppercase italic text-3xl -rotate-6"
                style={{ color: lot.status === "sold" ? "#c9971f" : "#94a3b8", borderColor: lot.status === "sold" ? "#c9971f" : "#94a3b8" }}
              >
                {lot.status}
              </span>
            )}
          </div>
        ) : (
          <p className="font-mono text-xs uppercase text-white/40">Awaiting first lot</p>
        )}
      </div>

      <div className="border-t border-white/10 px-5 py-3 flex gap-6 overflow-x-auto">
        {state.teams.map((t) => (
          <div key={t.id} className="shrink-0 flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-white" style={{ background: t.color }}>
              {t.code}
            </div>
            <span className="font-mono text-[10px] text-white/60">{t.remaining.toLocaleString()} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}