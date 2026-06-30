"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabse";
import { subscribeToTeamPurses } from "@/lib/auctionLiveDb";
import BottomNavBar from "@/components/BottomNavBar";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface AuctionData {
  id:     string;
  name:   string;
  status: "setup" | "live" | "paused" | "completed";
}

interface TeamData {
  id:             string;
  name:           string;
  code:           string;
  color:          string;
  logo:           string | null;
  remainingPurse: number;
  roster:         number;
}

interface RulesData {
  teamSize:     number;
  totalPoints:  number;
  timerSeconds: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Geist+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .ms {
    font-family: 'Material Symbols Outlined';
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    font-style: normal; line-height: 1; display: inline-block; user-select: none;
  }
  .ms-fill { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
  .ms-300  { font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24; }

  @keyframes floatUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulseOrb {
    0%,100% { opacity: 0.6; transform: scale(1); }
    50%     { opacity: 1; transform: scale(1.08); }
  }
  @keyframes blink {
    0%,100% { opacity: 1; }
    50%     { opacity: 0.2; }
  }
  @keyframes amberPulse {
    0%,100% { opacity: 0.8; }
    50%     { opacity: 0.3; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes tickle {
    0%,100% { transform: scale(1); }
    50%     { transform: scale(1.06); }
  }
  @keyframes dotSeq {
    0%,66%,100% { opacity: 0.15; }
    33%         { opacity: 1; }
  }
  @keyframes barGrow {
    from { width: 0; }
  }

  .anim-up-1 { animation: floatUp 0.40s cubic-bezier(0.22,1,0.36,1) 0.00s both; }
  .anim-up-2 { animation: floatUp 0.40s cubic-bezier(0.22,1,0.36,1) 0.07s both; }
  .anim-up-3 { animation: floatUp 0.40s cubic-bezier(0.22,1,0.36,1) 0.14s both; }
  .anim-up-4 { animation: floatUp 0.40s cubic-bezier(0.22,1,0.36,1) 0.21s both; }
  .anim-up-5 { animation: floatUp 0.40s cubic-bezier(0.22,1,0.36,1) 0.28s both; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : String(n);
}

function getStatusTheme(status: string) {
  if (status === "paused") return {
    dotColor: "#f59e0b", dotAnim: "amberPulse 1.2s ease-in-out infinite",
    badgeBg: "rgba(245,158,11,0.10)", badgeBorder: "rgba(245,158,11,0.28)",
    badgeColor: "#fbbf24", label: "Paused",
  };
  if (status === "completed") return {
    dotColor: "#818cf8", dotAnim: "none",
    badgeBg: "rgba(99,102,241,0.10)", badgeBorder: "rgba(99,102,241,0.28)",
    badgeColor: "#818cf8", label: "Ended",
  };
  if (status === "live") return {
    dotColor: "#22c55e", dotAnim: "blink 1s ease-in-out infinite",
    badgeBg: "rgba(34,197,94,0.14)", badgeBorder: "rgba(34,197,94,0.30)",
    badgeColor: "#4ade80", label: "Live",
  };
  return {
    dotColor: "#3a4a54", dotAnim: "none",
    badgeBg: "rgba(255,255,255,0.04)", badgeBorder: "rgba(255,255,255,0.08)",
    badgeColor: "#5a6a74", label: "Waiting",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, pct, accentColor, delay }: {
  label: string; value: string; sub?: string; pct?: number; accentColor: string; delay: string;
}) {
  return (
    <div style={{
      animation: `floatUp 0.4s cubic-bezier(0.22,1,0.36,1) ${delay} both`,
      background: "rgba(11,15,16,0.55)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14, padding: "14px 16px",
    }}>
      <p style={{
        fontFamily: "'Geist Mono', monospace", fontSize: 8, letterSpacing: "0.16em",
        textTransform: "uppercase", color: "#3a4a54", marginBottom: 6,
      }}>{label}</p>
      <p style={{
        fontFamily: "'Archivo Narrow', sans-serif", fontSize: 24, fontWeight: 700,
        color: "#e8ecf0", lineHeight: 1, marginBottom: sub ? 2 : 8,
      }}>{value}</p>
      {sub && (
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 8, color: "#3a4a54", marginBottom: 8 }}>
          {sub}
        </p>
      )}
      {pct !== undefined && (
        <div style={{ height: 2, borderRadius: 99, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 99, width: `${pct}%`,
            background: pct < 25 ? "#ef4444" : accentColor,
            animation: "barGrow 0.8s ease both",
          }} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV CARD
// ─────────────────────────────────────────────────────────────────────────────
function NavCard({ href, icon, label, sub, accent, delay }: {
  href: string; icon: string; label: string; sub: string; accent: string; delay: string;
}) {
  return (
    <a
      href={href}
      style={{
        animation: `floatUp 0.4s cubic-bezier(0.22,1,0.36,1) ${delay} both`,
        display: "flex", alignItems: "center", gap: 14,
        background: "rgba(16,20,21,0.60)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16, padding: "16px 18px", cursor: "pointer",
        textDecoration: "none", color: "inherit", position: "relative",
        overflow: "hidden", WebkitTapHighlightColor: "transparent",
        transition: "transform 0.12s, background 0.12s",
      }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "scale(0.97)";
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
      }}
      onPointerUp={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLElement).style.background = "rgba(16,20,21,0.60)";
      }}
      onPointerLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLElement).style.background = "rgba(16,20,21,0.60)";
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 11, background: `${accent}10`,
        border: `1px solid ${accent}22`, display: "flex", alignItems: "center",
        justifyContent: "center", flexShrink: 0,
      }}>
        <span className="ms ms-fill" style={{ fontSize: 20, color: accent }}>{icon}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: "'Archivo Narrow', sans-serif", fontSize: 17, fontWeight: 700,
          color: "#e8ecf0", textTransform: "uppercase", letterSpacing: "-0.2px", lineHeight: 1.1,
        }}>{label}</p>
        <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: "#4a5a64", marginTop: 3 }}>
          {sub}
        </p>
      </div>
      <span className="ms ms-300" style={{ color: "#2a3a44", fontSize: 20, flexShrink: 0 }}>
        chevron_right
      </span>
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function OwnerIndexPage() {
  const router = useRouter();
  const params = useParams();
  const auctionId = params.auctionId as string;
  const teamCode  = params.teamCode  as string;

  const [auction, setAuction] = useState<AuctionData | null>(null);
  const [team,    setTeam]    = useState<TeamData | null>(null);
  const [rules,   setRules]   = useState<RulesData | null>(null);
  const [loading, setLoading] = useState(true);
  const teamIdRef = useRef<string | null>(null);

  // ── initial fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!auctionId || !teamCode) return;

    async function load() {
      const [{ data: auc }, { data: tm }, { data: r }, { data: sc }] =
        await Promise.all([
          supabase.from("auctions").select("id, name, status").eq("id", auctionId).single(),
          supabase.from("teams").select("id, name, code, color, logo, remaining_purse, roster")
            .eq("auction_id", auctionId).ilike("code", teamCode).single(),
          supabase.from("rules").select("team_size, total_points, tiers").eq("auction_id", auctionId).maybeSingle(),
          supabase.from("session_config").select("timer_seconds").eq("auction_id", auctionId).maybeSingle(),
        ]);

      if (auc) setAuction({ id: auc.id, name: auc.name, status: auc.status });

      if (tm) {
        teamIdRef.current = tm.id;
        setTeam({
          id: tm.id, name: tm.name, code: tm.code, color: tm.color,
          logo: tm.logo ?? null, remainingPurse: tm.remaining_purse ?? 0, roster: tm.roster ?? 0,
        });
      }

      if (r) {
        setRules({
          teamSize:     r.team_size    ?? 16,
          totalPoints:  r.total_points ?? 50000,
          timerSeconds: sc?.timer_seconds ?? 15,
        });
      }

      setLoading(false);
    }

    load().catch(console.error);
  }, [auctionId, teamCode]);

  // ── realtime: auction status ───────────────────────────────────────────────
  useEffect(() => {
    if (!auctionId) return;
    const sub = supabase
      .channel(`owner-auction-${auctionId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${auctionId}` },
        (payload) => setAuction((prev) => prev ? { ...prev, status: payload.new.status } : prev)
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [auctionId]);

  // ── realtime: purse / roster ───────────────────────────────────────────────
  useEffect(() => {
    if (!auctionId) return;
    const sub = subscribeToTeamPurses(auctionId, (teamId, remaining, roster) => {
      if (teamId === teamIdRef.current) {
        setTeam((prev) => prev ? { ...prev, remainingPurse: remaining, roster } : prev);
      }
    });
    return () => { supabase.removeChannel(sub); };
  }, [auctionId]);

  // ── derived ────────────────────────────────────────────────────────────────
  const status      = auction?.status ?? "setup";
  const isLive      = status === "live";
  const isPaused    = status === "paused";
  const isEnded     = status === "completed";
  // Falls back to the globals.css theme-orange variable instead of a
  // hardcoded hex, so the franchise accent re-themes along with the rest
  // of the app whenever a team has no custom color of its own.
  const accent      = team?.color || "var(--color-theme-orange)";
  const purse       = team?.remainingPurse ?? 0;
  const roster      = team?.roster         ?? 0;
  const totalSlots  = rules?.teamSize       ?? 16;
  const totalPoints = rules?.totalPoints    ?? 50000;
  const pursePct    = totalPoints > 0 ? (purse / totalPoints) * 100 : 0;
  const rosterPct   = totalSlots  > 0 ? (roster / totalSlots) * 100 : 0;
  const spent       = totalPoints - purse;
  const theme       = getStatusTheme(status);
  const base        = `/owner/${auctionId}/${teamCode}`;

  const NAV_ITEMS = [
    { segment: "squad",   icon: "groups",   label: "Squad",       sub: `${roster} of ${totalSlots} players` },
    { segment: "budget",  icon: "payments", label: "Budget",      sub: `${purse.toLocaleString()} PTS remaining` },
    { segment: "history", icon: "reorder",  label: "Bid History", sub: "Every transaction" },
  ];

  // ── loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <style>{STYLES}</style>
        <div style={{
          background: "var(--color-background)", height: "100dvh",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
        }}>
          <div style={{
            width: 36, height: 36, border: "2px solid color-mix(in srgb, var(--color-theme-orange) 12%, transparent)",
            borderTop: "2px solid var(--color-theme-orange)", borderRadius: "50%", animation: "spin 0.9s linear infinite",
          }} />
          <p style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 9, color: "var(--color-theme-orange)",
            textTransform: "uppercase", letterSpacing: "0.2em",
          }}>Loading…</p>
        </div>
      </>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>
      <div style={{
        background: "var(--color-background)", color: "var(--color-on-background)", minHeight: "100dvh",
        fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column",
        position: "relative", overflow: "hidden", paddingBottom: 68,
      }}>

        {/* Ambient orb */}
        <div style={{
          position: "fixed", top: -120, left: "50%", transform: "translateX(-50%)",
          width: 420, height: 420, borderRadius: "50%",
          background: `radial-gradient(circle, ${
            isPaused ? "rgba(245,158,11,0.11)" : isEnded ? "rgba(99,102,241,0.09)" : `${accent}12`
          } 0%, transparent 70%)`,
          filter: "blur(60px)", pointerEvents: "none",
          animation: "pulseOrb 7s ease-in-out infinite", zIndex: 0,
        }} />

        {/* ── Header ── */}
        <header style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "4px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(11,15,16,0.88)", backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)", flexShrink: 0,
            position: "sticky", top: 0, zIndex: 40,
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
            width: 50, height: 50, borderRadius: 8, overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
            <img
                src="/moon-knight-logo.png"
                alt="Auction logo"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            </div>
            <div>
            <p style={{
                fontFamily: "'Archivo Narrow', sans-serif", fontSize: 15, fontWeight: 700,
                fontStyle: "italic", textTransform: "uppercase", letterSpacing: "-0.2px",
                color: "#e8ecf0", lineHeight: 1.1,
            }}>{auction?.name ?? "APL Auction"}</p>
            <p style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 8, color: "#2a3a44",
                letterSpacing: "0.16em", textTransform: "uppercase",
            }}>Owner Portal</p>
            </div>
        </div>

        {/* Status badge */}
        <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: theme.badgeBg, border: `1px solid ${theme.badgeBorder}`,
            borderRadius: 99, padding: "5px 11px",
        }}>
            <span style={{
            width: 6, height: 6, borderRadius: "50%", background: theme.dotColor,
            display: "inline-block", animation: theme.dotAnim,
            }} />
            <span style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 8, fontWeight: 700,
            letterSpacing: "0.18em", textTransform: "uppercase", color: theme.badgeColor,
            }}>{theme.label}</span>
        </div>
        </header>

        {/* ── Body ── */}
        <main style={{
          flex: 1, overflowY: "auto", padding: "20px 18px 32px",
          display: "flex", flexDirection: "column", gap: 14, position: "relative", zIndex: 1,
        }}>

          {/* Team hero */}
          <div className="anim-up-1" style={{
            background: `${accent}0b`, border: `1px solid ${accent}28`,
            borderRadius: 22, padding: "20px 18px 18px", position: "relative", overflow: "hidden",
          }}>
            {/* Watermark */}
            <div style={{
              position: "absolute", right: -6, top: -14,
              fontFamily: "'Archivo Narrow', sans-serif", fontSize: 96, fontWeight: 800,
              fontStyle: "italic", color: `${accent}06`, textTransform: "uppercase",
              pointerEvents: "none", lineHeight: 1, userSelect: "none",
            }}>{team?.code}</div>

            {/* Logo + name */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 62, height: 62, borderRadius: 15, flexShrink: 0,
                background: `${accent}14`, border: `1.5px solid ${accent}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", boxShadow: `0 0 32px ${accent}22`,
              }}>
                {team?.logo ? (
                  <img src={team.logo} alt={team.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", padding: 0 }} />
                ) : (
                  <span style={{
                    fontFamily: "'Archivo Narrow', sans-serif", fontSize: 20, fontWeight: 800,
                    fontStyle: "italic", color: accent, textTransform: "uppercase",
                  }}>{team?.code?.slice(0, 3)}</span>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: "0.22em",
                  textTransform: "uppercase", color: accent, marginBottom: 4, opacity: 0.85,
                }}>Your Franchise</p>
                <h1 style={{
                  fontFamily: "'Archivo Narrow', sans-serif", fontSize: 28, fontWeight: 700,
                  fontStyle: "italic", textTransform: "uppercase", letterSpacing: "-0.3px",
                  lineHeight: 1, color: "#e8ecf0",
                }}>{team?.name ?? "—"}</h1>
              </div>
            </div>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatCard label="Purse Left" value={`${fmt(purse)} PTS`} pct={pursePct} accentColor={accent} delay="0.08s" />
              <StatCard label="Squad" value={`${roster}/${totalSlots}`} sub={`${totalSlots - roster} slots open`} pct={rosterPct} accentColor={accent} delay="0.12s" />
            </div>

            {/* Spent strip */}
            {(isLive || isPaused || isEnded) && spent > 0 && (
              <div style={{
                marginTop: 10, background: "rgba(11,15,16,0.40)", border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 12, padding: "10px 14px", display: "flex",
                alignItems: "center", justifyContent: "space-between",
              }}>
                <p style={{
                  fontFamily: "'Geist Mono', monospace", fontSize: 8, letterSpacing: "0.14em",
                  textTransform: "uppercase", color: "#3a4a54",
                }}>Total Invested</p>
                <p style={{ fontFamily: "'Archivo Narrow', sans-serif", fontSize: 16, fontWeight: 700, color: accent }}>
                  {fmt(spent)} PTS
                </p>
              </div>
            )}
          </div>

          {/* ── Status banner ── */}
          {isLive && (
            <div className="anim-up-2" style={{
              background: "color-mix(in srgb, var(--color-theme-orange) 6%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-theme-orange) 18%, transparent)",
              borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: "color-mix(in srgb, var(--color-theme-orange) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-theme-orange) 22%, transparent)",
                display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0,
              }}>
                <span className="ms ms-fill" style={{ fontSize: 18, color: "var(--color-theme-orange)" }}>sensors</span>
              </div>
              <div>
                <p style={{
                  fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 700, color: "var(--color-theme-orange)",
                  letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 3,
                }}>Auction is Live</p>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#5a6a74", lineHeight: 1.5 }}>
                  Bidding is open — enter the bid room to place bids in real time.
                </p>
              </div>
            </div>
          )}

          {isPaused && (
            <div className="anim-up-2 bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl px-4 py-3.5 flex items-start gap-3">
              <div className="w-[38px] h-[38px] rounded-[10px] bg-amber-500/10 border border-amber-500/[0.22] flex items-center justify-center shrink-0">
                <span className="ms ms-fill text-xl text-amber-500" style={{ animation: "amberPulse 1.6s ease-in-out infinite" }}>
                  pause_circle
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-mono-geist text-[9px] font-bold text-amber-500 tracking-[0.16em] uppercase">Short Break</p>
                  <div className="flex gap-1">
                    {[0, 0.3, 0.6].map((d, i) => (
                      <div key={i} className="w-1 h-1 rounded-full bg-amber-500" style={{ animation: `dotSeq 1.4s ease-in-out ${d}s infinite` }} />
                    ))}
                  </div>
                </div>
                <p className="font-inter text-xs text-outline leading-[1.5]">
                  The auctioneer has paused bidding. You can still browse your squad and budget below.
                </p>
              </div>
            </div>
          )}

          {isEnded && (
            <div className="anim-up-2 bg-indigo-500/[0.06] border border-indigo-500/20 rounded-2xl px-4 py-3.5 flex items-start gap-3">
              <div className="w-[38px] h-[38px] rounded-[10px] bg-indigo-500/10 border border-indigo-500/[0.22] flex items-center justify-center shrink-0">
                <span className="ms ms-fill text-xl text-indigo-400" style={{ animation: "tickle 2s ease-in-out infinite" }}>
                  check_circle
                </span>
              </div>
              <div className="flex-1">
                <p className="font-mono-geist text-[9px] font-bold text-indigo-400 tracking-[0.16em] uppercase mb-1">
                  Auction Complete
                </p>
                <p className="font-inter text-xs text-outline leading-[1.5]">
                  Bidding has ended. Your squad is locked — review your final roster and budget below.
                </p>
              </div>
            </div>
          )}

          {!isLive && !isPaused && !isEnded && (
            <div className="anim-up-2 bg-white/[0.02] border border-white/[0.06] rounded-2xl px-4 py-3 flex items-center gap-2.5">
              <span className="ms ms-300 text-[22px] text-outline-variant">hourglass_empty</span>
              <p className="font-inter text-xs text-[#4a5a64] leading-[1.5]">
                Auction hasn't started yet. Stand by — the bid room will open soon.
              </p>
            </div>
          )}

          {/* ── Primary action button ── */}
          <div className="anim-up-3">
            {isLive && (
              <button
                onClick={() => router.push(`${base}/bid`)}
                className="w-full h-16 rounded-2xl border-none flex items-center justify-center gap-2.5 cursor-pointer font-archivo text-xl font-bold italic uppercase tracking-[0.05em] text-background transition-transform duration-150 active:scale-[0.97]"
                style={{
                  background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
                  boxShadow: `0 8px 36px ${accent}45`,
                }}
              >
                <span className="ms ms-fill text-2xl">gavel</span>
                Enter Bid Room
                <span className="ms ms-300 text-lg opacity-70">arrow_forward</span>
              </button>
            )}

            {isPaused && (
              <button disabled className="w-full h-16 rounded-2xl border border-amber-500/[0.18] flex items-center justify-center gap-2.5 cursor-not-allowed font-archivo text-xl font-bold italic uppercase tracking-[0.05em] text-amber-500 bg-amber-500/[0.06] opacity-90">
                <span className="ms ms-fill text-[22px]" style={{ animation: "amberPulse 1.4s ease-in-out infinite" }}>
                  pause_circle
                </span>
                Bidding Paused
              </button>
            )}

            {isEnded && (
              <button disabled className="w-full h-16 rounded-2xl border border-indigo-500/[0.18] flex items-center justify-center gap-2.5 cursor-not-allowed font-archivo text-xl font-bold italic uppercase tracking-[0.05em] text-indigo-400 bg-indigo-500/[0.06]">
                <span className="ms ms-fill text-[22px]">check_circle</span>
                Bidding Closed
              </button>
            )}

            {!isLive && !isPaused && !isEnded && (
              <button disabled className="w-full h-16 rounded-2xl border border-white/[0.06] flex items-center justify-center gap-2.5 cursor-not-allowed font-archivo text-xl font-bold italic uppercase tracking-[0.05em] text-outline bg-white/[0.02]">
                <span className="ms ms-300 text-[22px]">hourglass_empty</span>
                Auction Not Started
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="anim-up-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/5" />
            <p className="font-mono-geist text-[8px] tracking-[0.18em] uppercase text-[#2a3a44]">Quick Access</p>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Nav cards */}
          <div className="flex flex-col gap-2">
            {NAV_ITEMS.map((item, i) => (
              <NavCard
                key={item.segment}
                href={`${base}/${item.segment}`}
                icon={item.icon}
                label={item.label}
                sub={item.sub}
                accent={accent}
                delay={`${0.21 + i * 0.07}s`}
              />
            ))}
          </div>

        </main>

        <BottomNavBar />
      </div>
    </>
  );
}