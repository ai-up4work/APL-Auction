"use client";
import React, { useEffect, useState, useCallback } from "react";
import MobileOnlyWrapper from "@/components/MobileOnlyWrapper";
import BottomNavBar from "@/components/BottomNavBar";
import Image from "next/image";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabse";

// ── style tokens ─────────────────────────────────────────────────────────────
const BG           = "#101415";
const CARD_BG      = "rgba(16, 20, 21, 0.6)";
const CARD_BORDER  = "1px solid rgba(255, 255, 255, 0.1)";
const ORANGE       = "#e45d35";
const ERROR        = "#ffb4ab";
const TEXT_WHITE   = "#e0e3e4";
const TEXT_DIM     = "#c6c6cd";
const TEXT_MUTED   = "rgba(198,198,205,0.6)";
const TEXT_BLUE    = "#dae2fd";
const TEXT_TERT    = "#d8e2ff";
const SURFACE_HIGH = "#272b2c";
const OUTLINE_VAR  = "#45464d";

const PAGE_SIZE = 5;

// ── types ─────────────────────────────────────────────────────────────────────
type EventType = "BOUGHT" | "OUTBID" | "BIDDING WAR" | "WITHDRAWN";

interface AuctionEvent {
  id:        string;       // lot id — used as React key
  type:      EventType;
  name:      string;       // player name
  sub:       string;       // role · origin
  price:     string;       // formatted price string
  priceRaw:  number;
  time:      string;       // formatted timestamp
  img:       string;
  sortedAt:  string;       // ISO — used for chronological sort (desc)
}

// ── helpers ───────────────────────────────────────────────────────────────────
function formatPts(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dotProps(type: EventType) {
  switch (type) {
    case "BOUGHT":      return { dot: TEXT_BLUE,                 dotGlow: "0 0 8px rgba(218,226,253,0.5)" };
    case "OUTBID":      return { dot: ORANGE,                    dotGlow: undefined };
    case "BIDDING WAR": return { dot: "rgba(218,226,253,0.4)",   dotGlow: undefined };
    case "WITHDRAWN":   return { dot: ERROR,                     dotGlow: undefined };
  }
}

// ── data fetcher ──────────────────────────────────────────────────────────────
async function fetchHistoryEvents(
  auctionId: string,
  teamId: string
): Promise<{ events: AuctionEvent[]; totalBids: number; successfulWins: number }> {

  // 1. All bids this team placed (for totalBids stat + OUTBID / BIDDING WAR logic)
  const { data: myBids } = await supabase
    .from("bid_history")
    .select("lot_id, amount, placed_at")
    .eq("auction_id", auctionId)
    .eq("team_id", teamId)
    .order("placed_at", { ascending: false });

  const totalBids = (myBids ?? []).length;

  // 2. All closed lots for this auction (to cross-reference outcomes)
  const { data: closedLots } = await supabase
    .from("auction_lots")
    .select(`
      id, status, current_bid, base_price, closed_at,
      winning_team_id, winning_team_code,
      player_id, player_name, player_role, player_country, player_img
    `)
    .eq("auction_id", auctionId)
    .in("status", ["sold", "unsold"])
    .order("closed_at", { ascending: false });

  const lots = closedLots ?? [];

  // Build a set of lot_ids this team bid on
  const myBidsByLot = (myBids ?? []).reduce<Record<string, { count: number; maxAmount: number; latestAt: string }>>(
    (acc, b) => {
      if (!acc[b.lot_id]) acc[b.lot_id] = { count: 0, maxAmount: 0, latestAt: b.placed_at };
      acc[b.lot_id].count++;
      if (b.amount > acc[b.lot_id].maxAmount) acc[b.lot_id].maxAmount = b.amount;
      if (b.placed_at > acc[b.lot_id].latestAt) acc[b.lot_id].latestAt = b.placed_at;
      return acc;
    },
    {}
  );

  const events: AuctionEvent[] = [];

  for (const lot of lots) {
    const sub      = [lot.player_role, lot.player_country].filter(Boolean).join(" · ");
    const closedAt = lot.closed_at ?? new Date().toISOString();
    const bidInfo  = myBidsByLot[lot.id];

    // ── BOUGHT: lot sold to THIS team ────────────────────────────────────────
    if (lot.status === "sold" && lot.winning_team_id === teamId) {
      events.push({
        id:       lot.id,
        type:     "BOUGHT",
        name:     lot.player_name,
        sub,
        price:    formatPts(lot.current_bid),
        priceRaw: lot.current_bid,
        time:     formatTime(closedAt),
        img:      lot.player_img ?? "",
        sortedAt: closedAt,
      });
      continue;
    }

    // Skip lots this team never bid on
    if (!bidInfo) continue;

    // ── WITHDRAWN: lot went UNSOLD but this team was the last (highest) bidder
    if (lot.status === "unsold" && bidInfo.maxAmount >= lot.current_bid) {
      events.push({
        id:       lot.id,
        type:     "WITHDRAWN",
        name:     lot.player_name,
        sub,
        price:    formatPts(bidInfo.maxAmount),
        priceRaw: bidInfo.maxAmount,
        time:     formatTime(closedAt),
        img:      lot.player_img ?? "",
        sortedAt: closedAt,
      });
      continue;
    }

    // ── BIDDING WAR: lot sold to another team but this team placed 2+ bids ──
    if (lot.status === "sold" && lot.winning_team_id !== teamId && bidInfo.count >= 2) {
      events.push({
        id:       lot.id,
        type:     "BIDDING WAR",
        name:     lot.player_name,
        sub,
        price:    formatPts(bidInfo.maxAmount),
        priceRaw: bidInfo.maxAmount,
        time:     formatTime(closedAt),
        img:      lot.player_img ?? "",
        sortedAt: closedAt,
      });
      continue;
    }

    // ── OUTBID: lot sold to another team, this team bid once ─────────────────
    if (lot.status === "sold" && lot.winning_team_id !== teamId) {
      events.push({
        id:       lot.id,
        type:     "OUTBID",
        name:     lot.player_name,
        sub,
        price:    formatPts(bidInfo.maxAmount),
        priceRaw: bidInfo.maxAmount,
        time:     formatTime(closedAt),
        img:      lot.player_img ?? "",
        sortedAt: closedAt,
      });
      continue;
    }

    // ── OUTBID (unsold): lot went unsold but another team held the highest bid
    // This team bid but was outbid before the auctioneer closed it unsold.
    if (lot.status === "unsold" && bidInfo.maxAmount < lot.current_bid) {
      events.push({
        id:       lot.id,
        type:     "OUTBID",
        name:     lot.player_name,
        sub,
        price:    formatPts(bidInfo.maxAmount),
        priceRaw: bidInfo.maxAmount,
        time:     formatTime(closedAt),
        img:      lot.player_img ?? "",
        sortedAt: closedAt,
      });
    }
  }

  // Sort newest first
  events.sort((a, b) => (a.sortedAt < b.sortedAt ? 1 : -1));

  const successfulWins = events.filter((e) => e.type === "BOUGHT").length;

  return { events, totalBids, successfulWins };
}

// ── component ─────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const params    = useParams();
  const auctionId = params?.auctionId as string;
  const teamCode  = (params?.teamCode as string)?.toUpperCase();

  const [teamId,        setTeamId]        = useState<string | null>(null);
  const [allEvents,     setAllEvents]     = useState<AuctionEvent[]>([]);
  const [totalBids,     setTotalBids]     = useState(0);
  const [successfulWins,setSuccessfulWins]= useState(0);
  const [visibleCount,  setVisibleCount]  = useState(PAGE_SIZE);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);

  // ── resolve team id once ──────────────────────────────────────────────────
  useEffect(() => {
    if (!auctionId || !teamCode) return;
    supabase
      .from("teams")
      .select("id")
      .eq("auction_id", auctionId)
      .eq("code", teamCode)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (e || !data) { setError("Team not found."); setLoading(false); return; }
        setTeamId(data.id);
      });
  }, [auctionId, teamCode]);

  // ── load history whenever team id is ready ────────────────────────────────
  const reload = useCallback(async () => {
    if (!auctionId || !teamId) return;
    try {
      const result = await fetchHistoryEvents(auctionId, teamId);
      setAllEvents(result.events);
      setTotalBids(result.totalBids);
      setSuccessfulWins(result.successfulWins);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }, [auctionId, teamId]);

  useEffect(() => { reload(); }, [reload]);

  // ── realtime: re-fetch whenever a lot closes or a new bid is placed ───────
  useEffect(() => {
    if (!auctionId || !teamId) return;

    const lotSub = supabase
      .channel(`history-lots-${auctionId}-${teamId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auction_lots", filter: `auction_id=eq.${auctionId}` },
        (payload) => {
          const lot = payload.new as any;
          if (lot.status === "sold" || lot.status === "unsold") reload();
        }
      )
      .subscribe();

    const bidSub = supabase
      .channel(`history-bids-${auctionId}-${teamId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bid_history", filter: `auction_id=eq.${auctionId}` },
        (payload) => {
          const bid = payload.new as any;
          // Only reload if the new bid belongs to this team
          if (bid.team_id === teamId) reload();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(lotSub);
      supabase.removeChannel(bidSub);
    };
  }, [auctionId, teamId, reload]);

  // ── derived ───────────────────────────────────────────────────────────────
  const visibleEvents = allEvents.slice(0, visibleCount);
  const hasMore       = visibleCount < allEvents.length;

  // ── loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <MobileOnlyWrapper>
        <div style={{
          background: BG, minHeight: "100vh",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ textAlign: "center", color: TEXT_DIM }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              border: "2px solid transparent", borderTopColor: ORANGE,
              animation: "spin 1s linear infinite", margin: "0 auto 12px",
            }} />
            <p style={{ fontSize: 13 }}>Loading history…</p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </MobileOnlyWrapper>
    );
  }

  if (error) {
    return (
      <MobileOnlyWrapper>
        <div style={{
          background: BG, minHeight: "100vh",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <p style={{ color: ORANGE, textAlign: "center", fontSize: 14 }}>{error}</p>
        </div>
      </MobileOnlyWrapper>
    );
  }

  return (
    <MobileOnlyWrapper>
      <div style={{
        background: BG, color: TEXT_WHITE, minHeight: "100vh",
        fontFamily: "'Inter', sans-serif",
        scrollbarWidth: "none",
      }}>
        <style>{`
          ::-webkit-scrollbar { display: none; }
          @keyframes pulseDot {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.8); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes pulseFade {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>

        {/* ── Top App Bar ── */}
        <header style={{
          position: "sticky", top: 0, zIndex: 50,
          background: BG,
          borderBottom: `1px solid ${OUTLINE_VAR}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px",
        }}>
          <span style={{
            fontFamily: "'Archivo Narrow', sans-serif",
            fontSize: 28, fontWeight: 700, color: TEXT_BLUE,
            letterSpacing: "-0.5px", textTransform: "uppercase",
          }}>APL AUCTION</span>
          <div style={{ display: "flex", gap: 16 }}>
            {["notifications", "settings"].map((icon) => (
              <span key={icon} className="material-symbols-outlined"
                style={{ color: TEXT_DIM, fontSize: 24, cursor: "pointer" }}>{icon}</span>
            ))}
          </div>
        </header>

        {/* ── Main ── */}
        <main style={{ padding: "24px 16px 100px", maxWidth: 512, margin: "0 auto" }}>

          {/* ── Screen Title ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <h1 style={{
                fontFamily: "'Archivo Narrow', sans-serif",
                fontSize: 24, fontWeight: 600, color: TEXT_WHITE,
                letterSpacing: "-0.2px", textTransform: "uppercase", margin: 0,
              }}>AUCTION HISTORY</h1>
              <p style={{
                fontSize: 10, fontWeight: 500, letterSpacing: "0.1em",
                textTransform: "uppercase", color: TEXT_DIM,
                marginTop: 4, marginBottom: 0,
              }}>Live Activity Log</p>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: SURFACE_HIGH, borderRadius: 99,
              padding: "4px 12px", border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: ORANGE, display: "inline-block",
                animation: "pulseDot 2s infinite",
              }} />
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", color: TEXT_WHITE,
              }}>Live</span>
            </div>
          </div>

          {/* ── Summary Stats ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
            <div style={{
              background: CARD_BG, border: CARD_BORDER,
              borderLeft: `2px solid ${ORANGE}`,
              borderRadius: 12, padding: 16,
              display: "flex", flexDirection: "column", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_DIM }}>
                Total Bids Placed
              </span>
              <span style={{
                fontFamily: "'Archivo Narrow', sans-serif",
                fontSize: 40, fontWeight: 700, color: TEXT_WHITE,
                lineHeight: 1, marginTop: 8,
              }}>{String(totalBids).padStart(2, "0")}</span>
            </div>
            <div style={{
              background: CARD_BG, border: CARD_BORDER,
              borderLeft: `2px solid ${TEXT_BLUE}`,
              borderRadius: 12, padding: 16,
              display: "flex", flexDirection: "column", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_DIM }}>
                Successful Wins
              </span>
              <span style={{
                fontFamily: "'Archivo Narrow', sans-serif",
                fontSize: 40, fontWeight: 700, color: TEXT_BLUE,
                lineHeight: 1, marginTop: 8,
              }}>{String(successfulWins).padStart(2, "0")}</span>
            </div>
          </div>

          {/* ── Timeline ── */}
          {allEvents.length === 0 ? (
            <div style={{
              border: "1.5px dashed rgba(255,255,255,0.1)",
              borderRadius: 14, padding: "40px 20px",
              display: "flex", flexDirection: "column",
              alignItems: "center", textAlign: "center", gap: 8,
            }}>
              <span className="material-symbols-outlined"
                style={{ fontSize: 38, color: "#3d4047" }}>history</span>
              <p style={{ fontSize: 14, color: TEXT_DIM, lineHeight: 1.6 }}>
                No activity yet.<br />Events will appear here as the auction progresses.
              </p>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute", left: 20, top: 0, bottom: 0,
                width: 1, background: "rgba(255,255,255,0.05)", zIndex: 0,
              }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {visibleEvents.map((ev) => {
                  const { dot, dotGlow } = dotProps(ev.type);
                  return (
                    <div key={ev.id} style={{ position: "relative", paddingLeft: 48 }}>
                      <div style={{
                        position: "absolute", left: 14, top: 8,
                        width: 12, height: 12, borderRadius: "50%",
                        background: dot,
                        border: `2px solid ${BG}`,
                        zIndex: 1,
                        boxShadow: dotGlow,
                      }} />
                      <EventCard ev={ev} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Load More / All Loaded ── */}
          {allEvents.length > 0 && (
            hasMore ? (
              <button
                onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, allEvents.length))}
                style={{
                  width: "100%", padding: "16px 0", marginTop: 32,
                  background: CARD_BG, border: CARD_BORDER,
                  borderRadius: 12, cursor: "pointer",
                  fontFamily: "'Geist', monospace",
                  fontSize: 14, fontWeight: 500, letterSpacing: "0.05em",
                  color: TEXT_DIM,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                LOAD OLDER EVENTS
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>expand_more</span>
              </button>
            ) : (
              <div style={{
                width: "100%", padding: "16px 0", marginTop: 32,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
                <span style={{
                  fontFamily: "'Geist', monospace", fontSize: 10,
                  letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_MUTED,
                }}>All events loaded</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
              </div>
            )
          )}
        </main>

        <BottomNavBar />
      </div>
    </MobileOnlyWrapper>
  );
}

// ── Event Card ────────────────────────────────────────────────────────────────
function EventCard({ ev }: { ev: AuctionEvent }) {
  if (ev.type === "BOUGHT") {
    return (
      <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)",
              background: "#313536", flexShrink: 0, position: "relative",
            }}>
              {ev.img && (
                <Image src={ev.img} alt={ev.name} fill
                  style={{ objectFit: "cover" }} referrerPolicy="no-referrer" />
              )}
            </div>
            <div>
              <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, color: TEXT_WHITE, margin: 0 }}>{ev.name}</h3>
              <p style={{ fontSize: 10, color: TEXT_DIM, margin: "2px 0 0", letterSpacing: "0.05em" }}>{ev.sub}</p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontFamily: "'Geist', monospace", fontSize: 14, fontWeight: 500, color: TEXT_BLUE, letterSpacing: "0.05em" }}>{ev.price}</span>
            <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", margin: "2px 0 0", letterSpacing: "0.05em" }}>{ev.time}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <span style={{
            padding: "4px 8px", borderRadius: 99,
            background: "rgba(218,226,253,0.1)", border: "1px solid rgba(218,226,253,0.2)",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: TEXT_BLUE,
          }}>BOUGHT</span>
          <span style={{
            padding: "4px 8px", borderRadius: 99,
            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
            fontSize: 10, fontWeight: 500, letterSpacing: "0.05em", color: "#4ade80",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            ACQUIRED
          </span>
        </div>
      </div>
    );
  }

  if (ev.type === "OUTBID") {
    return (
      <div style={{
        background: CARD_BG, border: CARD_BORDER,
        borderLeft: "4px solid rgba(228,93,53,0.5)",
        borderRadius: 12, padding: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: ORANGE }}>{ev.type}</span>
            <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, color: TEXT_WHITE, margin: "4px 0 0" }}>{ev.name}</h3>
            <p style={{ fontSize: 10, color: TEXT_DIM, margin: "2px 0 0", fontStyle: "italic" }}>{ev.sub}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontFamily: "'Geist', monospace", fontSize: 14, fontWeight: 500, color: TEXT_DIM, letterSpacing: "0.05em" }}>{ev.price}</span>
            <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", margin: "2px 0 0", letterSpacing: "0.05em" }}>{ev.time}</p>
          </div>
        </div>
      </div>
    );
  }

  if (ev.type === "BIDDING WAR") {
    return (
      <div style={{ background: "rgba(24,28,29,0.3)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_TERT }}>{ev.type}</span>
            <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, color: TEXT_WHITE, margin: "4px 0 0" }}>{ev.name}</h3>
            <p style={{ fontSize: 10, color: TEXT_DIM, margin: "2px 0 0", fontStyle: "italic" }}>{ev.sub}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{
              fontFamily: "'Geist', monospace", fontSize: 14, fontWeight: 500,
              color: TEXT_BLUE, letterSpacing: "0.05em",
              animation: "pulseFade 2s infinite", display: "inline-block",
            }}>{ev.price}</span>
            <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", margin: "2px 0 0", letterSpacing: "0.05em" }}>{ev.time}</p>
          </div>
        </div>
      </div>
    );
  }

  // WITHDRAWN (unsold while this team held highest bid)
  return (
    <div style={{
      background: CARD_BG, border: CARD_BORDER,
      borderLeft: "4px solid rgba(255,180,171,0.3)",
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: ERROR }}>{ev.type}</span>
          <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, color: TEXT_WHITE, margin: "4px 0 0" }}>{ev.name}</h3>
          <p style={{ fontSize: 10, color: TEXT_DIM, margin: "2px 0 0" }}>{ev.sub}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontFamily: "'Geist', monospace", fontSize: 14, fontWeight: 500, color: "rgba(255,180,171,0.6)", letterSpacing: "0.05em" }}>{ev.price}</span>
          <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", margin: "2px 0 0", letterSpacing: "0.05em" }}>{ev.time}</p>
        </div>
      </div>
    </div>
  );
}