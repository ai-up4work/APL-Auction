// components/AuctionStatusOverlay.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Inline status block — replaces only the bid content area so BottomNavBar
// stays fully accessible during paused / completed states.
//
// PAUSED    → renders an in-place "Short Break" panel inside the bid page
// COMPLETED → renders an in-place "That's a Wrap" panel inside the bid page
// Both:     → nav bar remains visible and tappable
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
  // bid-page specific props so the block can show team context
  accentColor?:    string;
  purse?:          number;
  roster?:         number;
  teamSize?:       number;
  totalPoints?:    number;
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
  @keyframes aso-fade-in {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes aso-pulse-ring {
    0%,100% { box-shadow: 0 0 0 0 rgba(228,93,53,0.50); }
    60%     { box-shadow: 0 0 0 16px rgba(228,93,53,0); }
  }
  @keyframes aso-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes aso-tick {
    0%,100% { transform: scale(1); }
    50%     { transform: scale(1.08); }
  }
  @keyframes aso-dot-seq {
    0%,66%,100% { opacity: 0.2; }
    33%         { opacity: 1; }
  }
  @keyframes aso-amber-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.5); }
    60%     { box-shadow: 0 0 0 14px rgba(245,158,11,0); }
  }
  @keyframes aso-glow-amber {
    0%,100% { opacity: 0.55; }
    50%     { opacity: 1; }
  }
  @keyframes aso-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes aso-check-pop {
    0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
    70%  { transform: scale(1.15) rotate(5deg); opacity: 1; }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }

  .aso-fade-in      { animation: aso-fade-in 0.45s cubic-bezier(0.22,1,0.36,1) both; }
  .aso-pulse-ring   { animation: aso-pulse-ring 2s ease-in-out infinite; }
  .aso-amber-ring   { animation: aso-amber-pulse 2s ease-in-out infinite; }
  .aso-tick         { animation: aso-tick 2s ease-in-out infinite; }
  .aso-glow-amber   { animation: aso-glow-amber 1.5s ease-in-out infinite; }
  .aso-spin         { animation: aso-spin 1s linear infinite; }
  .aso-check-pop    { animation: aso-check-pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both; }

  .aso-shimmer-text {
    background: linear-gradient(90deg, #e45d35 0%, #f7c59f 40%, #e45d35 60%, #f7c59f 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: aso-shimmer 3s linear infinite;
  }
  .aso-shimmer-amber {
    background: linear-gradient(90deg, #f59e0b 0%, #fde68a 40%, #f59e0b 60%, #fde68a 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: aso-shimmer 2.5s linear infinite;
  }

  .aso-ms {
    font-family: 'Material Symbols Outlined';
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    font-style: normal; line-height: 1;
    display: inline-block; user-select: none;
  }
  .aso-ms-fill { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// PAUSED BLOCK — inline, takes the bid page's content area
// ─────────────────────────────────────────────────────────────────────────────
function PausedBlock({ accentColor = "#e45d35", purse = 0, roster = 0, teamSize = 16, totalPoints = 50000 }: {
  accentColor?: string;
  purse?: number;
  roster?: number;
  teamSize?: number;
  totalPoints?: number;
}) {
  const pursePct = Math.min((purse / Math.max(totalPoints, 1)) * 100, 100);
  const fmt      = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : String(n);

  return (
    <>
      <style>{STATUS_CSS}</style>
      <div
        className="aso-fade-in"
        style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          padding:        "32px 24px",
          position:       "relative",
          overflow:       "hidden",
          minHeight:      0,
        }}
      >
        {/* Ambient glow */}
        <div style={{
          position:   "absolute",
          top:        "30%",
          left:       "50%",
          transform:  "translate(-50%, -50%)",
          width:      280,
          height:     280,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245,158,11,0.10) 0%, transparent 70%)",
          filter:     "blur(40px)",
          pointerEvents: "none",
        }} />

        {/* Icon ring */}
        <div
          className="aso-amber-ring"
          style={{
            width:          88,
            height:         88,
            borderRadius:   "50%",
            background:     "rgba(245,158,11,0.08)",
            border:         "1.5px solid rgba(245,158,11,0.30)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            marginBottom:   28,
          }}
        >
          <span className="aso-ms aso-ms-fill" style={{ fontSize: 42, color: "#f59e0b" }}>pause_circle</span>
        </div>

        {/* Label */}
        <p style={{
          fontFamily:    "'Geist Mono', monospace",
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: "0.34em",
          textTransform: "uppercase",
          color:         "#f59e0b",
          marginBottom:  10,
        }}>
          Auction Paused
        </p>

        {/* Headline */}
        <h2
          className="aso-shimmer-amber"
          style={{
            fontFamily:    "'Archivo Narrow', sans-serif",
            fontSize:      40,
            fontWeight:    800,
            fontStyle:     "italic",
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            lineHeight:    1,
            marginBottom:  12,
          }}
        >
          Short Break
        </h2>

        <p style={{
          fontFamily:  "'Inter', sans-serif",
          fontSize:    13,
          color:       "rgba(198,198,205,0.55)",
          textAlign:   "center",
          lineHeight:  1.6,
          maxWidth:    260,
          marginBottom: 32,
        }}>
          The auctioneer has paused bidding. Browse your squad and budget while you wait.
        </p>

        {/* Animated dots */}
        <div style={{ display: "flex", gap: 8, marginBottom: 36 }}>
          {[0, 0.33, 0.66].map((delay, i) => (
            <div key={i} style={{
              width:        8,
              height:       8,
              borderRadius: "50%",
              background:   "#f59e0b",
              animation:    `aso-dot-seq 1.5s ease-in-out ${delay}s infinite`,
            }} />
          ))}
        </div>

        {/* Compact stat strip */}
        <div style={{
          width:        "100%",
          maxWidth:     320,
          background:   "rgba(16,20,21,0.65)",
          border:       "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          padding:      "16px 20px",
          display:      "grid",
          gridTemplateColumns: "1fr 1fr",
          gap:          16,
        }}>
          <div>
            <p style={{
              fontFamily:    "'Geist Mono', monospace",
              fontSize:      8,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color:         "#3a4a54",
              marginBottom:  6,
            }}>Purse Left</p>
            <p style={{
              fontFamily: "'Archivo Narrow', sans-serif",
              fontSize:   22,
              fontWeight: 700,
              color:      "#e0e3e4",
              lineHeight: 1,
            }}>
              {fmt(purse)}<span style={{ fontSize: 10, color: "#3a4a54", marginLeft: 3 }}>PTS</span>
            </p>
            <div style={{ marginTop: 6, height: 2, borderRadius: 99, background: "rgba(255,255,255,0.05)" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                width:  `${pursePct}%`,
                background: pursePct < 25 ? "#ef4444" : accentColor,
              }} />
            </div>
          </div>
          <div>
            <p style={{
              fontFamily:    "'Geist Mono', monospace",
              fontSize:      8,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color:         "#3a4a54",
              marginBottom:  6,
            }}>Squad</p>
            <p style={{
              fontFamily: "'Archivo Narrow', sans-serif",
              fontSize:   22,
              fontWeight: 700,
              color:      "#e0e3e4",
              lineHeight: 1,
            }}>
              {roster}<span style={{ fontSize: 12, color: "#3a4a54" }}>/{teamSize}</span>
            </p>
            <div style={{ marginTop: 6, height: 2, borderRadius: 99, background: "rgba(255,255,255,0.05)" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                width:  teamSize > 0 ? `${(roster / teamSize) * 100}%` : "0%",
                background: accentColor,
              }} />
            </div>
          </div>
        </div>

        {/* Nav hint */}
        <p style={{
          fontFamily:    "'Geist Mono', monospace",
          fontSize:      9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color:         "#2a3a44",
          marginTop:     20,
          textAlign:     "center",
        }}>
          Use the tabs below to explore your squad
        </p>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETED BLOCK — inline, takes the bid page's content area
// ─────────────────────────────────────────────────────────────────────────────
function CompletedBlock({ accentColor = "#e45d35", purse = 0, roster = 0, teamSize = 16, totalPoints = 50000 }: {
  accentColor?: string;
  purse?: number;
  roster?: number;
  teamSize?: number;
  totalPoints?: number;
}) {
  const pursePct = Math.min((purse / Math.max(totalPoints, 1)) * 100, 100);
  const spent    = totalPoints - purse;
  const fmt      = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : String(n);

  return (
    <>
      <style>{STATUS_CSS}</style>
      <div
        className="aso-fade-in"
        style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          padding:        "32px 24px",
          position:       "relative",
          overflow:       "hidden",
          minHeight:      0,
        }}
      >
        {/* Ambient glow */}
        <div style={{
          position:   "absolute",
          top:        "30%",
          left:       "50%",
          transform:  "translate(-50%, -50%)",
          width:      300,
          height:     300,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}12 0%, transparent 70%)`,
          filter:     "blur(50px)",
          pointerEvents: "none",
        }} />

        {/* Gavel icon ring */}
        <div
          className="aso-pulse-ring"
          style={{
            width:          88,
            height:         88,
            borderRadius:   "50%",
            background:     `${accentColor}10`,
            border:         `1.5px solid ${accentColor}30`,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            marginBottom:   28,
          }}
        >
          <span className="aso-ms aso-ms-fill aso-tick" style={{ fontSize: 42, color: accentColor }}>gavel</span>
        </div>

        {/* Label */}
        <p style={{
          fontFamily:    "'Geist Mono', monospace",
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: "0.34em",
          textTransform: "uppercase",
          color:         accentColor,
          marginBottom:  10,
        }}>
          Auction Complete
        </p>

        {/* Headline */}
        <h2
          className="aso-shimmer-text"
          style={{
            fontFamily:    "'Archivo Narrow', sans-serif",
            fontSize:      40,
            fontWeight:    800,
            fontStyle:     "italic",
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            lineHeight:    1,
            marginBottom:  12,
          }}
        >
          That's a Wrap
        </h2>

        <p style={{
          fontFamily:  "'Inter', sans-serif",
          fontSize:    13,
          color:       "rgba(198,198,205,0.55)",
          textAlign:   "center",
          lineHeight:  1.6,
          maxWidth:    260,
          marginBottom: 32,
        }}>
          All squads are locked. Check your final roster and budget below.
        </p>

        {/* Final stat card */}
        <div style={{
          width:        "100%",
          maxWidth:     320,
          background:   "rgba(16,20,21,0.65)",
          border:       `1px solid ${accentColor}20`,
          borderRadius: 16,
          padding:      "18px 20px",
        }}>
          {/* Spent / purse row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <p style={{
                fontFamily:    "'Geist Mono', monospace",
                fontSize:      8,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color:         "#3a4a54",
                marginBottom:  4,
              }}>Total Spent</p>
              <p style={{
                fontFamily: "'Archivo Narrow', sans-serif",
                fontSize:   24,
                fontWeight: 700,
                color:      accentColor,
                lineHeight: 1,
              }}>
                {fmt(spent)}<span style={{ fontSize: 10, color: "#3a4a54", marginLeft: 3 }}>PTS</span>
              </p>
            </div>
            <div>
              <p style={{
                fontFamily:    "'Geist Mono', monospace",
                fontSize:      8,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color:         "#3a4a54",
                marginBottom:  4,
              }}>Purse Left</p>
              <p style={{
                fontFamily: "'Archivo Narrow', sans-serif",
                fontSize:   24,
                fontWeight: 700,
                color:      "#e0e3e4",
                lineHeight: 1,
              }}>
                {fmt(purse)}<span style={{ fontSize: 10, color: "#3a4a54", marginLeft: 3 }}>PTS</span>
              </p>
            </div>
          </div>

          {/* Spend bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 8, color: "#3a4a54", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Budget Used
              </span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 8, color: accentColor }}>
                {(100 - pursePct).toFixed(0)}%
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,0.05)" }}>
              <div style={{
                height:     "100%",
                borderRadius: 99,
                width:      `${100 - pursePct}%`,
                background: accentColor,
                boxShadow:  `0 0 8px ${accentColor}60`,
                transition: "width 0.8s ease",
              }} />
            </div>
          </div>

          {/* Squad */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{
              fontFamily:    "'Geist Mono', monospace",
              fontSize:      8,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color:         "#3a4a54",
            }}>Final Squad</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <span style={{
                fontFamily: "'Archivo Narrow', sans-serif",
                fontSize:   20,
                fontWeight: 700,
                color:      "#e0e3e4",
              }}>{roster}</span>
              <span style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize:   10,
                color:      "#3a4a54",
              }}>/{teamSize} players</span>
            </div>
          </div>
        </div>

        {/* Check badge */}
        <div
          className="aso-check-pop"
          style={{
            display:        "flex",
            alignItems:     "center",
            gap:            6,
            marginTop:      20,
            padding:        "6px 14px",
            borderRadius:   99,
            background:     "rgba(34,197,94,0.08)",
            border:         "1px solid rgba(34,197,94,0.20)",
          }}
        >
          <span className="aso-ms aso-ms-fill" style={{ fontSize: 14, color: "#22c55e" }}>check_circle</span>
          <span style={{
            fontFamily:    "'Geist Mono', monospace",
            fontSize:      9,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color:         "#22c55e",
          }}>Squad Locked</span>
        </div>

        {/* Nav hint */}
        <p style={{
          fontFamily:    "'Geist Mono', monospace",
          fontSize:      9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color:         "#2a3a44",
          marginTop:     16,
          textAlign:     "center",
        }}>
          View full squad and history below
        </p>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// Renders INLINE inside the bid page's content area — not fixed/full-screen.
// Returns null when live (bid room renders normally).
// ─────────────────────────────────────────────────────────────────────────────
export function AuctionStatusOverlay({
  auctionId,
  initialStatus,
  onStatusChange,
  accentColor,
  purse,
  roster,
  teamSize,
  totalPoints,
}: OverlayProps) {
  const status = useAuctionStatus(auctionId, initialStatus, onStatusChange);

  if (status === "paused") {
    return (
      <PausedBlock
        accentColor={accentColor}
        purse={purse}
        roster={roster}
        teamSize={teamSize}
        totalPoints={totalPoints}
      />
    );
  }

  if (status === "completed") {
    return (
      <CompletedBlock
        accentColor={accentColor}
        purse={purse}
        roster={roster}
        teamSize={teamSize}
        totalPoints={totalPoints}
      />
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CompletedContent — kept for watch-page compatibility
// ─────────────────────────────────────────────────────────────────────────────
export function CompletedContent({ stats }: { stats?: AuctionStats }) {
  return (
    <>
      <style>{STATUS_CSS}</style>
      <div className="w-full h-full flex flex-col sm:flex-row gap-0 overflow-hidden aso-fade-in">
        <div className="flex-1 flex flex-col items-center justify-center px-10 py-8 relative min-w-0">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(circle at 50% 40%,rgba(228,93,53,0.09) 0%,transparent 65%)" }} />
          <div className="relative z-10 flex flex-col items-center text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-[rgba(228,93,53,0.10)] border border-[rgba(228,93,53,0.28)] flex items-center justify-center mb-6"
              style={{ boxShadow: "0 0 48px rgba(228,93,53,0.18)" }}>
              <span className="aso-ms aso-ms-fill aso-tick" style={{ fontSize: 40, color: "#e45d35" }}>gavel</span>
            </div>
            <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: "#e45d35", letterSpacing: "0.38em", textTransform: "uppercase", marginBottom: 12 }}>
              Auction Complete
            </p>
            <h2 className="aso-shimmer-text" style={{ fontFamily: "'Archivo Narrow',sans-serif", fontSize: "clamp(32px,4.5vw,64px)", fontWeight: 800, fontStyle: "italic", textTransform: "uppercase", letterSpacing: "-0.025em", lineHeight: 1, marginBottom: 8 }}>
              That's a Wrap!
            </h2>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "rgba(198,198,205,0.50)", marginBottom: 28, lineHeight: 1.6 }}>
              All squads are locked. Switch to Full Board to see the final Sankey chart.
            </p>
            {stats && (
              <>
                <div style={{ width: "100%", height: 1, background: "linear-gradient(to right,transparent,rgba(228,93,53,0.30),transparent)", marginBottom: 24 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, width: "100%", marginBottom: 24 }}>
                  {[
                    { label: "Total Lots",  value: stats.totalLots   },
                    { label: "Sold",        value: stats.soldCount,  accent: true },
                    { label: "Unsold",      value: stats.unsoldCount },
                  ].map((s) => (
                    <div key={s.label} style={{ textAlign: "center" }}>
                      <p style={{ fontFamily: "'Archivo Narrow',sans-serif", fontSize: "clamp(24px,3.5vw,38px)", fontWeight: 800, color: s.accent ? "#e45d35" : "#fff", lineHeight: 1, marginBottom: 4 }}>{s.value}</p>
                      <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 8, color: "rgba(198,198,205,0.45)", textTransform: "uppercase", letterSpacing: "0.18em" }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 99, border: "1px solid rgba(228,93,53,0.20)", background: "rgba(228,93,53,0.06)" }}>
              <span className="aso-ms" style={{ color: "#e45d35", fontSize: 14 }}>grid_view</span>
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: "rgba(198,198,205,0.55)", textTransform: "uppercase", letterSpacing: "0.18em" }}>
                View Full Board → Sankey chart
              </span>
            </div>
          </div>
        </div>

        {stats && (
          <div style={{ width: "100%", maxWidth: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, padding: "24px 16px", overflowY: "auto" }}>
            {stats.topBuys.length > 0 && (
              <div style={{ background: "rgba(16,20,21,0.65)", backdropFilter: "blur(28px)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span className="aso-ms aso-ms-fill" style={{ fontSize: 16, color: "#e45d35" }}>leaderboard</span>
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: "rgba(198,198,205,0.55)", textTransform: "uppercase", letterSpacing: "0.2em" }}>Top Buys</span>
                </div>
                {stats.topBuys.slice(0, 5).map((buy, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: i < 4 ? 12 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, fontWeight: 700, width: 20, textAlign: "right", color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c32" : "rgba(198,198,205,0.4)" }}>#{i+1}</span>
                      <div>
                        <p style={{ fontFamily: "'Archivo Narrow',sans-serif", fontWeight: 700, color: "#fff", fontSize: 13, lineHeight: 1, marginBottom: 2 }}>{buy.playerName}</p>
                        <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 8, color: "rgba(198,198,205,0.50)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{buy.teamCode}</p>
                      </div>
                    </div>
                    <p style={{ fontFamily: "'Archivo Narrow',sans-serif", color: "#e45d35", fontWeight: 700, fontSize: 13 }}>{buy.amount.toLocaleString()} <span style={{ fontSize: 9, opacity: 0.5 }}>PTS</span></p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}