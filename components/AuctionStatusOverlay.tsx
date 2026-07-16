// components/AuctionStatusOverlay.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Status-aware content wrapper for the watch page.
//
// PAUSED    → full-screen dimming overlay (content hidden behind it)
// COMPLETED → NO overlay; exposes <CompletedContent> that the watch page
//             renders IN PLACE of the live bid view, so the "View Full Board"
//             toggle (Sankey) still works normally via the header button.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabse";

export type AuctionStatus = "setup" | "live" | "paused" | "completed";

export interface AuctionStats {
  totalLots:   number;
  soldCount:   number;
  unsoldCount: number;
  topBuys: { playerName: string; teamCode: string; amount: number }[];
  teamSummaries?: { name: string; code: string; spent: number; roster: number; purseLeft: number }[];
}

interface OverlayProps {
  auctionId:       string;
  initialStatus:   AuctionStatus;
  onStatusChange?: (status: AuctionStatus) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook — subscribes to realtime auction status changes
// ─────────────────────────────────────────────────────────────────────────────
export function useAuctionStatus(
  auctionId:       string,
  initialStatus:   AuctionStatus,
  onStatusChange?: (status: AuctionStatus) => void
): AuctionStatus {
  const [status, setStatus] = useState<AuctionStatus>(initialStatus);
  const cbRef = useRef(onStatusChange);
  useEffect(() => { cbRef.current = onStatusChange; }, [onStatusChange]);

  useEffect(() => { setStatus(initialStatus); }, [initialStatus]);

  useEffect(() => {
    if (!auctionId) return;

    // Cast to `any` to avoid TypeScript overload-resolution errors with
    // Supabase's `.on("postgres_changes", ...)` generic chain.
    const channel = (supabase.channel(`auction-status:${auctionId}`) as any)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${auctionId}` },
        (payload: any) => {
          const next = payload?.new?.status as AuctionStatus | undefined;
          if (next) {
            setStatus(next);
            cbRef.current?.(next);
          }
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [auctionId]);

  return status;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared CSS
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CSS = `
  @keyframes aso-fade-in    { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes aso-pulse-ring { 0%,100%{ box-shadow:0 0 0 0 rgba(201,151,31,0.55); } 60%{ box-shadow:0 0 0 18px rgba(201,151,31,0); } }
  @keyframes aso-shimmer    { 0%{ background-position:-200% center; } 100%{ background-position:200% center; } }
  @keyframes aso-tick       { 0%,100%{ transform:scale(1); } 50%{ transform:scale(1.07); } }
  @keyframes aso-dot-seq    { 0%,66%,100%{ opacity:0.25; } 33%{ opacity:1; } }

  .aso-fade-in    { animation: aso-fade-in 0.5s cubic-bezier(0.22,1,0.36,1) both; }
  .aso-pulse-ring { animation: aso-pulse-ring 2s ease-in-out infinite; }
  .aso-tick       { animation: aso-tick 1.8s ease-in-out infinite; }

  .aso-shimmer-text {
    background: linear-gradient(90deg,#c9971f 0%,#f3e3bf 40%,#c9971f 60%,#f3e3bf 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: aso-shimmer 3s linear infinite;
  }
  .aso-glass {
    background: rgba(13,17,23,0.6);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
  }
  .aso-divider { background: linear-gradient(to right,transparent,rgba(201,151,31,0.30),transparent); }

  .aso-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(201,151,31,0.35) transparent;
  }
  .aso-scroll::-webkit-scrollbar { width: 4px; }
  .aso-scroll::-webkit-scrollbar-track { background: transparent; }
  .aso-scroll::-webkit-scrollbar-thumb {
    background: rgba(201,151,31,0.35);
    border-radius: 4px;
  }
  .aso-scroll::-webkit-scrollbar-thumb:hover { background: rgba(201,151,31,0.55); }
`;

// ─────────────────────────────────────────────────────────────────────────────
// PAUSED — full-screen dimming overlay
// ─────────────────────────────────────────────────────────────────────────────
function PausedOverlay() {
  return (
    <>
      <style>{STATUS_CSS}</style>
      <div
        className="fixed inset-0 z-[150] flex flex-col items-center justify-center"
        style={{ background: "rgba(13,17,23,0.94)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      >
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(circle at 50% 46%,rgba(201,151,31,0.07) 0%,transparent 65%)" }} />

        <div className="relative z-10 flex flex-col items-center text-center px-6 aso-fade-in">
          <div className="aso-pulse-ring w-24 h-24 rounded-full bg-[rgba(201,151,31,0.08)] border border-[rgba(201,151,31,0.25)] flex items-center justify-center mb-8">
            <span className="ms ms-fill text-[#c9971f]" style={{ fontSize: 44 }}>pause_circle</span>
          </div>

          <p className="font-mono-geist text-[10px] text-[#c9971f] uppercase tracking-[0.38em] mb-3 font-bold">
            Auction Paused
          </p>
          <h2 className="font-archivo text-[clamp(32px,5vw,64px)] font-black uppercase italic leading-none tracking-[-0.02em] text-white mb-4"
            style={{ textShadow: "0 4px 32px rgba(0,0,0,0.9)" }}>
            Short Break
          </h2>
          <p className="font-inter text-[15px] text-[rgba(194,198,212,0.60)] max-w-xs leading-relaxed">
            The auctioneer has temporarily paused bidding. We'll be right back — stay tuned.
          </p>

          <div className="flex items-center gap-2 mt-8">
            {[0, 0.33, 0.66].map((delay, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#c9971f]"
                style={{ animation: `aso-dot-seq 1.5s ease-in-out ${delay}s infinite` }} />
            ))}
          </div>
        </div>

        <div className="absolute bottom-12 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400" style={{ boxShadow: "0 0 8px #f59e0b" }} />
          <span className="font-mono-geist text-[9px] uppercase tracking-[0.28em] text-[rgba(194,198,212,0.40)]">
            Bidding on hold
          </span>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETED — rendered IN PLACE of the live bid hero (no overlay).
// The watch page swaps this in as the centre content so the "View Full Board"
// button in the header still switches to the Sankey/flow view as normal.
// ─────────────────────────────────────────────────────────────────────────────
export function CompletedContent({ stats }: { stats?: AuctionStats }) {
  return (
    <>
      <style>{STATUS_CSS}</style>

      <div className="w-full h-full flex flex-col sm:flex-row gap-0 overflow-hidden aso-fade-in">

        {/* LEFT — headline + aggregate stats + hint */}
        <div className="flex-1 flex flex-col items-center justify-center px-10 py-8 relative min-w-0">
          <div className="absolute inset-0 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-[rgba(201,151,31,0.10)] border border-[rgba(201,151,31,0.28)] flex items-center justify-center mb-6"
              style={{ boxShadow: "0 0 48px rgba(201,151,31,0.18)" }}>
              <span className="ms ms-fill text-[#c9971f] aso-tick" style={{ fontSize: 40 }}>gavel</span>
            </div>

            <p className="font-mono-geist text-[10px] text-[#c9971f] uppercase tracking-[0.38em] mb-3 font-bold">
              Auction Complete
            </p>
            <h2 className="aso-shimmer-text font-archivo text-[clamp(32px,4.5vw,64px)] font-black uppercase italic leading-none tracking-[-0.025em] mb-2">
              That's a Wrap!
            </h2>
            <p className="font-inter text-[13px] text-[rgba(194,198,212,0.50)] mb-7 leading-relaxed">
              All squads are locked. Switch to Full Board to see the final Sankey chart.
            </p>

            {stats && (
              <>
                <div className="aso-divider w-full h-px mb-6" />
                <div className="grid grid-cols-3 gap-4 w-full mb-6">
                  {[
                    { label: "Total Lots",  value: stats.totalLots  },
                    { label: "Sold",        value: stats.soldCount,  accent: true },
                    { label: "Unsold",      value: stats.unsoldCount },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className={`font-archivo text-[clamp(24px,3.5vw,38px)] font-black leading-none mb-1 ${s.accent ? "text-[#c9971f]" : "text-white"}`}>
                        {s.value}
                      </p>
                      <p className="font-mono-geist text-[8px] text-[rgba(194,198,212,0.45)] uppercase tracking-[0.18em]">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT — top buys + team spend summary */}
        <div className="aso-scroll w-full sm:w-[300px] shrink-0 flex flex-col gap-3 py-6 px-4 sm:pr-6 sm:pl-2 overflow-y-auto"> 

          {stats && stats.topBuys.length > 0 && (
            <div className="aso-glass rounded-2xl border border-white/[0.07] p-5 shrink-0">
              <div className="flex items-center gap-2 mb-4">
                <span className="ms ms-fill text-[#c9971f] text-[16px]">leaderboard</span>
                <span className="font-mono-geist text-[9px] text-[rgba(194,198,212,0.55)] uppercase tracking-[0.2em]">
                  Top Buys
                </span>
              </div>
              <div className="space-y-3">
                {stats.topBuys.slice(0, 5).map((buy, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono-geist text-[10px] font-bold w-5 text-right shrink-0"
                        style={{ color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c32" : "rgba(194,198,212,0.4)" }}>
                        #{i + 1}
                      </span>
                      <div>
                        <p className="font-archivo font-bold text-white text-[13px] leading-none mb-0.5">{buy.playerName}</p>
                        <p className="font-mono-geist text-[8px] text-[rgba(194,198,212,0.50)] uppercase tracking-wider">{buy.teamCode}</p>
                      </div>
                    </div>
                    <p className="font-archivo text-[#c9971f] font-bold text-[13px] shrink-0">
                      {buy.amount.toLocaleString()} <span className="text-[9px] opacity-50">CR</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team spend bars */}
          {stats?.teamSummaries && stats.teamSummaries.length > 0 && (
            <div className="aso-glass rounded-2xl border border-white/[0.07] p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="ms ms-fill text-[#c9971f] text-[16px]">groups</span>
                <span className="font-mono-geist text-[9px] text-[rgba(194,198,212,0.55)] uppercase tracking-[0.2em]">
                  Final Squads
                </span>
              </div>
              <div className="space-y-3">
                {[...stats.teamSummaries]
                  .sort((a, b) => b.spent - a.spent)
                  .map((t) => (
                    <div key={t.code}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-archivo font-bold text-white text-[12px] shrink-0">{t.code}</span>
                          <span className="font-mono-geist text-[8px] text-[rgba(194,198,212,0.40)] truncate">{t.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <span className="font-mono-geist text-[9px] text-[rgba(194,198,212,0.50)]">{t.roster}P</span>
                          <span className="font-archivo font-bold text-[#c9971f] text-[12px]">{t.spent.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
                        <div className="h-full bg-[#c9971f] rounded-full"
                          style={{ width: `${Math.min((t.spent / (t.spent + t.purseLeft || 1)) * 100, 100)}%`, opacity: 0.65 }} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — only handles the PAUSED overlay now.
// For completed state, the watch page renders <CompletedContent> directly
// inside its normal live-view area so the header toggle still works.
// ─────────────────────────────────────────────────────────────────────────────
export function AuctionStatusOverlay({ auctionId, initialStatus, onStatusChange }: OverlayProps) {
  const status = useAuctionStatus(auctionId, initialStatus, onStatusChange);
  if (status !== "paused") return null;
  return <PausedOverlay />;
}