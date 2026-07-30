"use client";
import React, { useEffect, useState, useCallback } from "react";
import MobileOnlyWrapper from "@/components/MobileOnlyWrapper";
import BottomNavBar from "@/components/BottomNavBar";
import Image from "next/image";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Matches --color-theme-orange in globals.css.
const ORANGE       = "#c9971f";
const ERROR        = "#ffb4ab";
const TEXT_WHITE   = "#e0e3e4";
const TEXT_DIM     = "#c6c6cd";
const TEXT_MUTED   = "rgba(198,198,205,0.6)";
const TEXT_BLUE    = "#dae2fd";
const TEXT_TERT    = "#d8e2ff";

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

interface TeamInfo {
  id:    string;
  name:  string;
  code:  string;
  color: string;
  logo:  string;
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

  const [team,          setTeam]          = useState<TeamInfo | null>(null);
  const [allEvents,     setAllEvents]     = useState<AuctionEvent[]>([]);
  const [totalBids,     setTotalBids]     = useState(0);
  const [successfulWins,setSuccessfulWins]= useState(0);
  const [visibleCount,  setVisibleCount]  = useState(PAGE_SIZE);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [bright,        setBright]        = useState(true);

  // blinking dot for "live" indicator (matches squad page)
  useEffect(() => {
    const id = setInterval(() => setBright((p) => !p), 1000);
    return () => clearInterval(id);
  }, []);

  // ── resolve team identity once ────────────────────────────────────────────
  useEffect(() => {
    if (!auctionId || !teamCode) return;
    supabase
      .from("teams")
      .select("id, name, code, color, logo")
      .eq("auction_id", auctionId)
      .eq("code", teamCode)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (e || !data) { setError("Team not found."); setLoading(false); return; }
        setTeam({
          id:    data.id,
          name:  data.name,
          code:  data.code,
          color: data.color,
          logo:  data.logo ?? "",
        });
      });
  }, [auctionId, teamCode]);

  // ── load history whenever team id is ready ────────────────────────────────
  const reload = useCallback(async () => {
    if (!auctionId || !team?.id) return;
    try {
      const result = await fetchHistoryEvents(auctionId, team.id);
      setAllEvents(result.events);
      setTotalBids(result.totalBids);
      setSuccessfulWins(result.successfulWins);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }, [auctionId, team?.id]);

  useEffect(() => { reload(); }, [reload]);

  // ── realtime: re-fetch whenever a lot closes or a new bid is placed ───────
  useEffect(() => {
    if (!auctionId || !team?.id) return;
    const teamId = team.id;

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
  }, [auctionId, team?.id, reload]);

  // ── derived ───────────────────────────────────────────────────────────────
  const visibleEvents = allEvents.slice(0, visibleCount);
  const hasMore       = visibleCount < allEvents.length;

  // ── loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <MobileOnlyWrapper>
        <div className="bg-background min-h-screen flex items-center justify-center">
          <div className="text-center text-[#c6c6cd]">
            <div className="w-8 h-8 rounded-lg border-2 border-transparent border-t-theme-orange animate-spin mx-auto mb-3" />
            <p className="text-[13px]">Loading history…</p>
          </div>
        </div>
      </MobileOnlyWrapper>
    );
  }

  if (error) {
    return (
      <MobileOnlyWrapper>
        <div className="bg-background min-h-screen flex items-center justify-center p-6">
          <p className="text-theme-orange text-center text-sm">{error}</p>
        </div>
      </MobileOnlyWrapper>
    );
  }

  return (
    <MobileOnlyWrapper>
      <div className="bg-background text-on-background min-h-screen font-inter [scrollbar-width:none]">
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
        `}</style>

        {/* ── Top App Bar — team identity header (matches squad/bid pages) ── */}
        <header className="sticky top-0 z-50 bg-background border-b border-outline-variant flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-11 h-11 rounded-[10px] flex items-center justify-center overflow-hidden shrink-0"
              style={{
                backgroundColor: team?.logo ? "transparent" : (team?.color ? `${team.color}22` : "#1e2324"),
                boxShadow: `0 0 18px ${team?.color ?? ORANGE}33`,
                border: `1px solid ${team?.color ?? ORANGE}44`,
              }}
            >
              {team?.logo ? (
                <Image
                  src={team.logo}
                  alt={team.name}
                  width={44}
                  height={44}
                  className="object-contain w-full h-full p-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span
                  className="font-archivo text-[13px] font-extrabold tracking-[-0.5px] uppercase"
                  style={{ color: team?.color ?? ORANGE }}
                >
                  {(team?.code ?? teamCode).slice(0, 3)}
                </span>
              )}
            </div>
            <div>
              <span className="font-archivo text-[22px] font-bold text-[#dae2fd] tracking-[-0.5px] uppercase block">
                {team?.name ?? teamCode} HISTORY
              </span>
            </div>
          </div>
          <div className="flex gap-[18px]">
            {["notifications", "settings"].map((icon) => (
              <span key={icon} className="material-symbols-outlined text-[#c6c6cd] text-2xl cursor-pointer">{icon}</span>
            ))}
          </div>
        </header>

        {/* ── Main ── */}
        <main className="px-4 pt-6 pb-[100px] max-w-[512px] mx-auto">

          {/* ── Screen Title ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-archivo text-2xl font-semibold text-[#e0e3e4] tracking-[-0.2px] uppercase m-0">
                AUCTION HISTORY
              </h1>
              <p className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#c6c6cd] mt-1 mb-0">
                Live Activity Log
              </p>
            </div>
            <div className="flex items-center gap-2 bg-surface-container-high rounded-full px-3 py-1 border border-white/5">
              <span className="w-2 h-2 rounded-full bg-theme-orange inline-block" style={{ animation: "pulseDot 2s infinite" }} />
              <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#e0e3e4]">Live</span>
            </div>
          </div>

          {/* ── Summary Stats ── */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="bg-[rgba(16,20,21,0.6)] border border-white/10 rounded-xl p-4 flex flex-col justify-between border-l-2"
                 style={{ borderLeftColor: ORANGE }}>
              <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#c6c6cd]">
                Total Bids Placed
              </span>
              <span className="font-archivo text-[40px] font-bold text-[#e0e3e4] leading-none mt-2">
                {String(totalBids).padStart(2, "0")}
              </span>
            </div>
            <div className="bg-[rgba(16,20,21,0.6)] border border-white/10 rounded-xl p-4 flex flex-col justify-between border-l-2 border-l-[#dae2fd]">
              <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#c6c6cd]">
                Successful Wins
              </span>
              <span className="font-archivo text-[40px] font-bold text-[#dae2fd] leading-none mt-2">
                {String(successfulWins).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* ── Timeline ── */}
          {allEvents.length === 0 ? (
            <div className="border-[1.5px] border-dashed border-white/10 rounded-2xl px-5 py-10 flex flex-col items-center text-center gap-2">
              <span className="material-symbols-outlined text-[38px] text-[#3d4047]">history</span>
              <p className="text-sm text-[#c6c6cd] leading-relaxed">
                No activity yet.<br />Events will appear here as the auction progresses.
              </p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-white/5 z-0" />
              <div className="flex flex-col gap-6">
                {visibleEvents.map((ev) => {
                  const { dot, dotGlow } = dotProps(ev.type);
                  return (
                    <div key={ev.id} className="relative pl-12">
                      <div
                        className="absolute left-3.5 top-2 w-3 h-3 rounded-full z-[1] border-2 border-background"
                        style={{ background: dot, boxShadow: dotGlow }}
                      />
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
                className="w-full py-4 mt-8 bg-[rgba(16,20,21,0.6)] border border-white/10 rounded-xl cursor-pointer font-mono-geist text-sm font-medium tracking-wide text-[#c6c6cd] flex items-center justify-center gap-2"
              >
                LOAD OLDER EVENTS
                <span className="material-symbols-outlined text-lg">expand_more</span>
              </button>
            ) : (
              <div className="w-full py-4 mt-8 flex items-center justify-center gap-2">
                <div className="flex-1 h-px bg-white/5" />
                <span className="font-mono-geist text-[10px] tracking-[0.1em] uppercase text-[#c6c6cd]/60">
                  All events loaded
                </span>
                <div className="flex-1 h-px bg-white/5" />
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
      <div className="bg-[rgba(16,20,21,0.6)] border border-white/10 rounded-xl p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 bg-[#313536] shrink-0 relative">
              {ev.img && (
                <Image src={ev.img} alt={ev.name} fill
                  className="object-cover" referrerPolicy="no-referrer" />
              )}
            </div>
            <div>
              <h3 className="font-inter text-lg font-bold text-[#e0e3e4] m-0">{ev.name}</h3>
              <p className="text-[10px] text-[#c6c6cd] mt-0.5 mb-0 tracking-wide">{ev.sub}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="font-mono-geist text-sm font-medium text-[#dae2fd] tracking-wide">{ev.price}</span>
            <p className="text-[10px] text-[#c6c6cd]/60 uppercase mt-0.5 mb-0 tracking-wide">{ev.time}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <span className="px-2 py-1 rounded-full bg-[#dae2fd]/10 border border-[#dae2fd]/20 text-[10px] font-bold tracking-[0.1em] text-[#dae2fd]">
            BOUGHT
          </span>
          <span className="px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-medium tracking-wide text-green-400 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs [font-variation-settings:'FILL'_1]">check_circle</span>
            ACQUIRED
          </span>
        </div>
      </div>
    );
  }

  if (ev.type === "OUTBID") {
    return (
      <div className="bg-[rgba(16,20,21,0.6)] border border-white/10 border-l-4 border-l-theme-orange/50 rounded-xl p-4">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-theme-orange">{ev.type}</span>
            <h3 className="font-inter text-lg font-bold text-[#e0e3e4] mt-1 mb-0">{ev.name}</h3>
            <p className="text-[10px] text-[#c6c6cd] mt-0.5 mb-0 italic">{ev.sub}</p>
          </div>
          <div className="text-right">
            <span className="font-mono-geist text-sm font-medium text-[#c6c6cd] tracking-wide">{ev.price}</span>
            <p className="text-[10px] text-[#c6c6cd]/60 uppercase mt-0.5 mb-0 tracking-wide">{ev.time}</p>
          </div>
        </div>
      </div>
    );
  }

  if (ev.type === "BIDDING WAR") {
    return (
      <div className="bg-[rgba(24,28,29,0.3)] border border-white/5 rounded-xl p-4">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#d8e2ff]">{ev.type}</span>
            <h3 className="font-inter text-lg font-bold text-[#e0e3e4] mt-1 mb-0">{ev.name}</h3>
            <p className="text-[10px] text-[#c6c6cd] mt-0.5 mb-0 italic">{ev.sub}</p>
          </div>
          <div className="text-right">
            <span
              className="font-mono-geist text-sm font-medium text-[#dae2fd] tracking-wide inline-block"
              style={{ animation: "pulseFade 2s infinite" }}
            >{ev.price}</span>
            <p className="text-[10px] text-[#c6c6cd]/60 uppercase mt-0.5 mb-0 tracking-wide">{ev.time}</p>
          </div>
        </div>
      </div>
    );
  }

  // WITHDRAWN (unsold while this team held highest bid)
  return (
    <div className="bg-[rgba(16,20,21,0.6)] border border-white/10 border-l-4 border-l-[#ffb4ab]/30 rounded-xl p-4">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-error">{ev.type}</span>
          <h3 className="font-inter text-lg font-bold text-[#e0e3e4] mt-1 mb-0">{ev.name}</h3>
          <p className="text-[10px] text-[#c6c6cd] mt-0.5 mb-0">{ev.sub}</p>
        </div>
        <div className="text-right">
          <span className="font-mono-geist text-sm font-medium text-[#ffb4ab]/60 tracking-wide">{ev.price}</span>
          <p className="text-[10px] text-[#c6c6cd]/60 uppercase mt-0.5 mb-0 tracking-wide">{ev.time}</p>
        </div>
      </div>
    </div>
  );
}