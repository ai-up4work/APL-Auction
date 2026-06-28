// app/owner/[auctionId]/[teamCode]/squad/page.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import MobileOnlyWrapper from "@/components/MobileOnlyWrapper";
import BottomNavBar from "@/components/BottomNavBar";
import { supabase } from "@/lib/supabse";
import {
  subscribeToLot,
  subscribeToBids,
  subscribeToTeamPurses,
  loadLiveState,
  loadTeamPurses,
  type AuctionLot,
  type BidEntry,
} from "@/lib/auctionLiveDb";

// ── style tokens ────────────────────────────────────────────────────────────
const CARD_BG       = "rgba(16, 20, 21, 0.6)";
const CARD_BORDER   = "1px solid rgba(255,255,255,0.07)";
const ORANGE        = "#e45d35";
const TEXT_DIM      = "#7a7d88";
const TEXT_MID      = "#9a9aa3";
const TEXT_WHITE    = "#e8ecf0";
const TEXT_BLUE     = "#dae2fd";

// ── types ────────────────────────────────────────────────────────────────────
interface SoldPlayer {
  id:         string;
  name:       string;
  role:       string;
  origin:     string;
  price:      number;
  img:        string;
  country:    string;
  closedAt:   string;
}

interface TeamPurse {
  remaining: number;
  roster:    number;
}

interface TeamRow {
  id:             string;
  name:           string;
  code:           string;
  color:          string;
  remaining_purse: number;
  roster:         number;
  logo:           string;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function formatPts(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
}

// ── Fixed role buckets matching Supabase players_role_check constraint ───────
// DB values: 'Batter' | 'Batsman' | 'Bowler' | 'All-rounder' | 'WK-Batter' | 'Wicket Keeper'
const ROLE_BUCKETS: {
  label:  string;
  icon:   string;
  match:  string[];   // exact DB values that belong to this bucket
}[] = [
  {
    label: "Batters",
    icon:  "sports_cricket",
    match: ["Batter", "Batsman"],
  },
  {
    label: "Bowlers",
    icon:  "sports_baseball",
    match: ["Bowler"],
  },
  {
    label: "All-rounders",
    icon:  "shuffle",
    match: ["All-rounder"],
  },
  {
    label: "Wicket Keepers",
    icon:  "back_hand",
    match: ["WK-Batter", "Wicket Keeper"],
  },
];

function compositionOf(players: SoldPlayer[]) {
  return ROLE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    icon:  bucket.icon,
    value: players.filter((p) => bucket.match.includes(p.role)).length,
  }));
}

// ── component ────────────────────────────────────────────────────────────────
export default function SquadPage() {
  const params    = useParams();
  const auctionId = params?.auctionId as string;
  const teamCode  = (params?.teamCode as string)?.toUpperCase();

  const [team,        setTeam]        = useState<TeamRow | null>(null);
  const [purse,       setPurse]       = useState<TeamPurse>({ remaining: 0, roster: 0 });
  const [soldPlayers, setSoldPlayers] = useState<SoldPlayer[]>([]);
  const [totalSlots,  setTotalSlots]  = useState<number>(16);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [bright,      setBright]      = useState(true);

  // blinking dot for "live" indicator
  useEffect(() => {
    const id = setInterval(() => setBright((p) => !p), 1000);
    return () => clearInterval(id);
  }, []);

  // ── initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!auctionId || !teamCode) return;

    async function boot() {
      try {
        // 1. Resolve team row
        const { data: teamRow, error: tErr } = await supabase
          .from("teams")
          .select("id, name, code, color, remaining_purse, roster, logo")
          .eq("auction_id", auctionId)
          .eq("code", teamCode)
          .maybeSingle();

        if (tErr || !teamRow) {
          setError("Team not found.");
          return;
        }
        setTeam(teamRow);
        setPurse({ remaining: teamRow.remaining_purse ?? 0, roster: teamRow.roster ?? 0 });

        // 2. Fetch rules for totalSlots
        const { data: rulesRow } = await supabase
          .from("rules")
          .select("team_size")
          .eq("auction_id", auctionId)
          .maybeSingle();
        if (rulesRow?.team_size) setTotalSlots(rulesRow.team_size);

        // 3. Fetch all players sold to this team
        const { data: playerRows } = await supabase
          .from("players")
          .select("id, name, role, origin, price, img, country, updated_at, sold_price")
          .eq("auction_id", auctionId)
          .eq("sold_to_team_id", teamRow.id)
          .eq("status", "sold")
          .order("updated_at", { ascending: false });

        const mapped: SoldPlayer[] = (playerRows ?? []).map((p: any) => ({
          id:       p.id,
          name:     p.name,
          role:     p.role     ?? "",
          origin:   p.origin   ?? "",
          price:    p.sold_price ?? p.price,
          img:      p.img      ?? "",
          country:  p.country  ?? "",
          closedAt: p.updated_at,
        }));
        setSoldPlayers(mapped);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load squad.");
      } finally {
        setLoading(false);
      }
    }

    boot();
  }, [auctionId, teamCode]);

  // ── realtime: purse changes ───────────────────────────────────────────────
  useEffect(() => {
    if (!auctionId || !team) return;

    const sub = subscribeToTeamPurses(auctionId, (tId, remaining, roster) => {
      if (tId === team.id) {
        setPurse({ remaining, roster });
      }
    });

    return () => { supabase.removeChannel(sub); };
  }, [auctionId, team]);

  // ── realtime: new sold players ────────────────────────────────────────────
  // We listen to lot closures; when a lot is sold to our team, fetch the
  // updated player row and prepend it to the list.
  useEffect(() => {
    if (!auctionId || !team) return;

    const lotSub = supabase
      .channel(`squad-lots-${auctionId}-${team.id}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "auction_lots",
          filter: `auction_id=eq.${auctionId}`,
        },
        async (payload) => {
          const lot = payload.new as any;
          if (lot.status !== "sold" || lot.winning_team_id !== team.id) return;

          // Fetch the player row that was just sold
          const { data: p } = await supabase
            .from("players")
            .select("id, name, role, origin, price, img, country, updated_at, sold_price")
            .eq("id", lot.player_id)
            .maybeSingle();

          if (!p) return;

          const newPlayer: SoldPlayer = {
            id:       p.id,
            name:     p.name,
            role:     p.role     ?? "",
            origin:   p.origin   ?? "",
            price:    p.sold_price ?? lot.current_bid ?? p.price,
            img:      p.img      ?? "",
            country:  p.country  ?? "",
            closedAt: lot.closed_at ?? new Date().toISOString(),
          };

          // Prepend, deduplicate
          setSoldPlayers((prev) => {
            if (prev.some((sp) => sp.id === newPlayer.id)) return prev;
            return [newPlayer, ...prev];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(lotSub); };
  }, [auctionId, team]);

  // ── derived values ────────────────────────────────────────────────────────
  const playersBought  = purse.roster;
  const slotsRemaining = totalSlots - playersBought;
  const progressPct    = totalSlots > 0 ? (playersBought / totalSlots) * 100 : 0;
  const composition    = compositionOf(soldPlayers);

  // ── render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <MobileOnlyWrapper>
        <div style={{
          background: "#101415", minHeight: "100vh",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ textAlign: "center", color: TEXT_MID }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              border: "2px solid transparent", borderTopColor: ORANGE,
              animation: "squadSpin 1s linear infinite",
              margin: "0 auto 12px",
            }} />
            <p style={{ fontSize: 13 }}>Loading squad…</p>
          </div>
          <style>{`@keyframes squadSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </MobileOnlyWrapper>
    );
  }

  if (error) {
    return (
      <MobileOnlyWrapper>
        <div style={{
          background: "#101415", minHeight: "100vh",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}>
          <p style={{ color: ORANGE, textAlign: "center", fontSize: 14 }}>{error}</p>
        </div>
      </MobileOnlyWrapper>
    );
  }

  return (
    <MobileOnlyWrapper>
      <div style={{ background: "#101415", color: "#e0e3e4", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>

        {/* ── Top App Bar ── */}
        <header style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "#101415",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: team?.color ? `${team.color}22` : "#1e2324",
              boxShadow: `0 0 18px ${team?.color ?? ORANGE}33`,
              border: `1px solid ${team?.color ?? ORANGE}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", flexShrink: 0,
            }}>
              {team?.logo ? (
                <Image
                  src={team.logo}
                  alt={team.name}
                  width={44}
                  height={44}
                  style={{ objectFit: "contain", width: "100%", height: "100%", padding: 4 }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span style={{
                  fontFamily: "'Archivo Narrow', sans-serif",
                  fontSize: 13, fontWeight: 800,
                  color: team?.color ?? ORANGE,
                  letterSpacing: "-0.5px",
                  textTransform: "uppercase",
                }}>
                  {(team?.code ?? teamCode).slice(0, 3)}
                </span>
              )}
            </div>
            <div>
              <span style={{
                fontFamily: "'Archivo Narrow', sans-serif",
                fontSize: 22, fontWeight: 700, color: TEXT_BLUE,
                letterSpacing: "-0.5px", textTransform: "uppercase",
                display: "block",
              }}>{team?.name ?? teamCode} SQUAD</span>
              {/* live indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: ORANGE,
                  opacity: bright ? 1 : 0.3,
                  transition: "opacity 0.3s",
                }} />
                <span style={{ fontSize: 10, color: TEXT_DIM, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Live
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {["notifications", "settings"].map((icon) => (
              <span key={icon} className="material-symbols-outlined"
                style={{ color: TEXT_MID, fontSize: 24 }}>{icon}</span>
            ))}
          </div>
        </header>

        {/* ── Scroll body ── */}
        <main style={{ padding: "14px 14px 100px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* ── Players Bought Card ── */}
          <div style={{
            background: "rgba(16, 20, 21, 0.6)",
            borderTop:    `1px solid ${ORANGE}`,
            borderRight:  `1px solid ${ORANGE}`,
            borderBottom: `1px solid ${ORANGE}`,
            borderLeft:   `4px solid ${ORANGE}`,
            borderRadius: 14,
            padding: "18px 18px 16px",
          }}>
            <p style={{
              fontSize: 11, fontWeight: 600,
              letterSpacing: "0.13em", textTransform: "uppercase",
              color: TEXT_MID, marginBottom: 6,
            }}>Players Bought</p>

            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                <span style={{
                  fontFamily: "'Archivo Narrow', sans-serif",
                  fontSize: 68, fontWeight: 700, color: TEXT_BLUE, lineHeight: 1,
                }}>{playersBought}</span>
                <span style={{
                  fontFamily: "'Archivo Narrow', sans-serif",
                  fontSize: 28, fontWeight: 600, color: "#6b6e7a",
                }}>/{totalSlots}</span>
              </div>

              {/* Remaining purse */}
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 10, color: TEXT_DIM, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
                  Purse Left
                </p>
                <span style={{
                  fontFamily: "'Archivo Narrow', sans-serif",
                  fontSize: 28, fontWeight: 700, color: TEXT_BLUE,
                }}>{formatPts(purse.remaining)}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{
              marginTop: 14, background: "#272b2c",
              borderRadius: 99, height: 5, overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: 99, background: ORANGE,
                width: `${progressPct}%`,
                boxShadow: "0 0 8px rgba(228,93,53,0.5)",
                transition: "width 0.6s ease",
              }} />
            </div>
          </div>

          {/* ── Composition grid — always shows all 4 role buckets ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {composition.map(({ label, icon, value }) => (
              <div key={label} style={{
                background: CARD_BG,
                border: value > 0 ? `1px solid rgba(228,93,53,0.2)` : CARD_BORDER,
                borderRadius: 12, padding: "14px 14px 12px",
              }}>
                <p style={{
                  fontSize: 10, fontWeight: 600,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  color: TEXT_DIM, marginBottom: 8,
                }}>{label}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span className="material-symbols-outlined"
                    style={{ color: value > 0 ? ORANGE : "#3d4047", fontSize: 17 }}>{icon}</span>
                  <span style={{
                    fontFamily: "'Archivo Narrow', sans-serif",
                    fontSize: 30, fontWeight: 700,
                    color: value > 0 ? TEXT_WHITE : "#3d4047",
                    lineHeight: 1,
                  }}>{value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Section header ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{
              fontFamily: "'Archivo Narrow', sans-serif",
              fontSize: 18, fontWeight: 700, textTransform: "uppercase",
              color: TEXT_WHITE, letterSpacing: "-0.2px",
            }}>Recent Acquisitions</span>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: "0.1em",
              textTransform: "uppercase", color: TEXT_MID,
              background: "#242829", border: CARD_BORDER,
              borderRadius: 6, padding: "4px 9px",
            }}>Sort by: Latest</span>
          </div>

          {/* ── Player Cards ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {soldPlayers.map(({ id, name, role, origin, price, img }) => (
              <div key={id} style={{
                background: CARD_BG, border: CARD_BORDER,
                borderRadius: 12, overflow: "hidden",
                display: "flex", height: 108,
              }}>
                {/* Photo */}
                <div style={{ width: 90, height: "100%", position: "relative", flexShrink: 0, overflow: "hidden" }}>
                  {img ? (
                    <Image src={img} alt={name} fill
                      style={{ objectFit: "cover", objectPosition: "top center" }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div style={{
                      width: "100%", height: "100%",
                      background: "#1e2324",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span className="material-symbols-outlined"
                        style={{ color: TEXT_DIM, fontSize: 32 }}>person</span>
                    </div>
                  )}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to right, transparent 40%, #161b1c 100%)",
                  }} />
                </div>

                {/* Info */}
                <div style={{
                  flex: 1, padding: "13px 14px",
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                  minWidth: 0,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Archivo Narrow', sans-serif",
                        fontSize: 19, fontWeight: 700, color: TEXT_WHITE,
                        lineHeight: 1.1, textTransform: "uppercase",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{name}</div>
                      <div style={{
                        fontSize: 10, fontWeight: 600,
                        letterSpacing: "0.1em", textTransform: "uppercase",
                        color: ORANGE, marginTop: 3,
                      }}>{role}{origin ? ` · ${origin}` : ""}</div>
                    </div>
                    <span className="material-symbols-outlined"
                      style={{ fontSize: 18, color: "#3d4047", flexShrink: 0 }}>verified</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, letterSpacing: "0.09em",
                      textTransform: "uppercase", color: TEXT_DIM,
                    }}>Sold for</span>
                    <span style={{
                      fontFamily: "'Archivo Narrow', sans-serif",
                      fontSize: 24, fontWeight: 700, color: TEXT_BLUE,
                    }}>{formatPts(price)}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty / remaining slots */}
            <div style={{
              border: "1.5px dashed rgba(255,255,255,0.15)",
              borderRadius: 14, padding: "32px 20px",
              display: "flex", flexDirection: "column",
              alignItems: "center", textAlign: "center", gap: 8,
            }}>
              <span className="material-symbols-outlined"
                style={{ fontSize: 38, color: "#6b6e7a" }}>person_add</span>
              <p style={{ fontSize: 14, color: TEXT_MID, lineHeight: 1.6 }}>
                {slotsRemaining > 0
                  ? <>{slotsRemaining} slot{slotsRemaining !== 1 ? "s" : ""} remaining in squad.<br />Waiting for the next pick…</>
                  : <>Squad is full!</>
                }
              </p>
            </div>
          </div>
        </main>

        <style>{`@keyframes squadSpin { to { transform: rotate(360deg); } }`}</style>

        <BottomNavBar />
      </div>
    </MobileOnlyWrapper>
  );
}