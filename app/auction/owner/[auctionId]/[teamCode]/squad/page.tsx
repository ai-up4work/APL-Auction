// app/owner/[auctionId]/[teamCode]/squad/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import BottomNavBar from "@/components/BottomNavBar";
import { supabase } from "@/lib/supabse";
import { useOwner } from "@/context/OwnerContext";

// Matches --color-theme-orange in globals.css — fallback accent when a team
// has no color of its own.
const ORANGE = "#c9971f";

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

  // Single source of truth for auction/team/rules + their realtime
  // subscriptions, provided by the route layout. Do NOT subscribe to
  // `subscribeToTeamPurses` again here — Supabase dedupes channels by
  // topic string (`purses:${auctionId}`), and OwnerProvider already holds
  // that subscription open, so a second call throws "cannot add
  // postgres_changes callbacks ... after subscribe()". Instead we just
  // mirror the matching team's purse/roster from context.
  const { team: ownerTeam } = useOwner();

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

        // 3. Fetch all players sold to this team.
        // NOTE: closeLotSold() (lib/auctionLiveDb.ts) writes sold_to_team_id
        // and sold_price on a sale but never sets players.status — so we
        // must NOT filter on status here. sold_to_team_id is the reliable
        // signal that a player belongs to this team.
        const { data: playerRows } = await supabase
          .from("players")
          .select("id, name, role, origin, price, img, country, updated_at, sold_price")
          .eq("auction_id", auctionId)
          .eq("sold_to_team_id", teamRow.id)
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

  // ── purse/roster sync from OwnerContext ───────────────────────────────────
  // OwnerProvider owns the realtime subscription for this; we just mirror its
  // value here once it resolves to the matching team (matched by code, since
  // the local `team` row may resolve on a slightly different tick).
  useEffect(() => {
    if (ownerTeam && ownerTeam.code?.toUpperCase() === teamCode) {
      setPurse({ remaining: ownerTeam.remainingPurse, roster: ownerTeam.roster });
    }
  }, [ownerTeam, teamCode]);

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
        <div className="bg-background min-h-screen flex items-center justify-center">
          <div className="text-center text-[#9a9aa3]">
            <div className="w-10 h-10 rounded-[10px] border-2 border-transparent border-t-theme-orange animate-spin mx-auto mb-3" />
            <p className="text-[13px]">Loading squad…</p>
          </div>
        </div>
    );
  }

  if (error) {
    return (
        <div className="bg-background min-h-screen flex items-center justify-center p-6">
          <p className="text-theme-orange text-center text-sm">{error}</p>
        </div>
    );
  }

  return (
      <div className="bg-background text-on-background min-h-screen font-inter">

        {/* ── Top App Bar ── */}
        <header className="sticky top-0 z-50 bg-background border-b border-white/[0.07] flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-11 h-11 rounded-[10px] flex items-center justify-center overflow-hidden shrink-0"
              style={{
                background: team?.color ? `${team.color}22` : "#1e2324",
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
                {team?.name ?? teamCode} SQUAD
              </span>
            </div>
          </div>
          <div className="flex gap-[18px]">
            {["notifications", "settings"].map((icon) => (
              <span key={icon} className="material-symbols-outlined text-[#9a9aa3] text-2xl">{icon}</span>
            ))}
          </div>
        </header>

        {/* ── Scroll body ── */}
        <main className="px-3.5 pt-3.5 pb-[100px] flex flex-col gap-3.5">

          {/* ── Players Bought Card ── */}
          <div
            className="bg-[rgba(16,20,21,0.6)] rounded-2xl px-[18px] pt-[18px] pb-4"
            style={{
              borderTop: `1px solid ${ORANGE}`,
              borderRight: `1px solid ${ORANGE}`,
              borderBottom: `1px solid ${ORANGE}`,
              borderLeft: `4px solid ${ORANGE}`,
            }}
          >
            <p className="text-[11px] font-semibold tracking-[0.13em] uppercase text-[#9a9aa3] mb-1.5">
              Players Bought
            </p>

            <div className="flex items-end justify-between">
              <div>
                <span className="font-archivo text-[68px] font-bold text-[#dae2fd] leading-none">{playersBought}</span>
                <span className="font-archivo text-[28px] font-semibold text-[#6b6e7a]">/{totalSlots}</span>
              </div>

              {/* Remaining purse */}
              <div className="text-right">
                <p className="text-[10px] text-[#7a7d88] tracking-[0.1em] uppercase mb-0.5">
                  Purse Left
                </p>
                <span className="font-archivo text-[28px] font-bold text-[#dae2fd]">{formatPts(purse.remaining)}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3.5 bg-[#272b2c] rounded-full h-[5px] overflow-hidden">
              <div
                className="h-full rounded-full bg-theme-orange transition-[width] duration-500 ease-out"
                style={{ width: `${progressPct}%`, boxShadow: "0 0 8px rgba(201,151,31,0.5)" }}
              />
            </div>
          </div>

          {/* ── Composition grid — always shows all 4 role buckets ── */}
          <div className="grid grid-cols-2 gap-2.5">
            {composition.map(({ label, icon, value }) => (
              <div
                key={label}
                className={`bg-[rgba(16,20,21,0.6)] rounded-xl px-3.5 pt-3.5 pb-3 border ${value > 0 ? "border-theme-orange/20" : "border-white/[0.07]"}`}
              >
                <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#7a7d88] mb-2">{label}</p>
                <div className="flex items-center gap-[7px]">
                  <span className={`material-symbols-outlined text-[17px] ${value > 0 ? "text-theme-orange" : "text-[#3d4047]"}`}>{icon}</span>
                  <span className={`font-archivo text-[30px] font-bold leading-none ${value > 0 ? "text-[#e8ecf0]" : "text-[#3d4047]"}`}>{value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Section header ── */}
          <div className="flex items-center justify-between">
            <span className="font-archivo text-lg font-bold uppercase text-[#e8ecf0] tracking-[-0.2px]">
              Recent Acquisitions
            </span>
            <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[#9a9aa3] bg-[#242829] border border-white/[0.07] rounded-md px-2.5 py-1">
              Sort by: Latest
            </span>
          </div>

          {/* ── Player Cards ── */}
          <div className="flex flex-col gap-2">
            {soldPlayers.map(({ id, name, role, origin, price, img, country }) => (
              <div key={id} className="bg-[rgba(16,20,21,0.6)] border border-white/[0.07] rounded-xl overflow-hidden flex h-[108px]">
                {/* Photo — fixed-width thumbnail, NOT w-full (that bug was
                   collapsing the info column to zero width). */}
                <div className="w-[108px] h-full relative shrink-0 overflow-hidden bg-[#1e2324]">
                  {img ? (
                    <Image src={img} alt={name} fill
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#7a7d88] text-[60px]">person</span>
                    </div>
                  )}
                  {/* subtle fade into the card so the photo blends with the info column */}
                  <div
                    className="absolute inset-0"
                    style={{ backgroundImage: "linear-gradient(to right, transparent 55%, rgba(16,20,21,0.85) 100%)" }}
                  />
                  {country && (
                    <span className="absolute bottom-1.5 left-1.5 text-[8px] font-bold tracking-[0.08em] uppercase text-[#dae2fd] bg-black/55 backdrop-blur-sm rounded px-1.5 py-0.5">
                      {country}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 px-3.5 py-[13px] flex flex-col justify-between min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-archivo text-[19px] font-bold text-[#e8ecf0] leading-[1.1] uppercase whitespace-nowrap overflow-hidden text-ellipsis">
                        {name}
                      </div>
                      <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-theme-orange mt-[3px]">
                        {role}{origin ? ` · ${origin}` : ""}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-theme-orange shrink-0">verified</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-[0.09em] uppercase text-[#7a7d88]">Sold for</span>
                    <span className="font-archivo text-2xl font-bold text-[#dae2fd]">{formatPts(price)}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty / remaining slots */}
            <div className="border-[1.5px] border-dashed border-white/[0.15] rounded-2xl px-5 py-8 flex flex-col items-center text-center gap-2">
              <span className="material-symbols-outlined text-[38px] text-[#6b6e7a]">person_add</span>
              <p className="text-sm text-[#9a9aa3] leading-relaxed">
                {slotsRemaining > 0
                  ? <>{slotsRemaining} slot{slotsRemaining !== 1 ? "s" : ""} remaining in squad.<br />Waiting for the next pick…</>
                  : <>Squad is full!</>
                }
              </p>
            </div>
          </div>
        </main>

        <BottomNavBar />
      </div>
  );
}