// app/(public)/auction/results/[auctionId]/page.tsx
"use client";

import React, { use, useEffect, useMemo, useRef, useState } from "react";
import { FlowCanvas } from "@/components/FlowCanvas";
import { FlowPlayerCard } from "@/components/FlowPlayerCard";
import { FlowTeamCard } from "@/components/FlowTeamCard";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";

interface AuctionData {
  id: string;
}

interface TeamData {
  id: string;
  name: string;
  code: string;
  logo: string;
}

interface PlayerData {
  id: string;
  name: string;
  img: string;
  soldToTeamId: string | null;
  soldPrice: number | null;
  status: string | null;
}

interface FlowPlayer {
  id: string;
  name: string;
  img: string;
  status: "sold" | "unsold" | "pending";
  teamShortCode?: string;
  price: string;
  role: string;
  origin: string;
  capped: boolean;
  country: string;
}

interface FlowTeam {
  id: string;
  name: string;
  shortCode: string;
  logoUrl: string;
  purse: string;
}

export default function AuctionResultsPage({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = use(params);
  const playerListRef = useRef<HTMLDivElement>(null);
  const teamListRef = useRef<HTMLDivElement>(null);

  const [auction, setAuction] = useState<AuctionData | null>(null);
  const [auctionName, setAuctionName] = useState<string>("Auction");
  const [auctionLogo, setAuctionLogo] = useState<string | null>(null);
  const [teams, setTeams] = useState<Record<string, TeamData>>({});
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [activeTeam, setActiveTeam] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: auctionData, error: auctionErr } = await supabase
          .from("auctions")
          .select("id")
          .eq("id", auctionId)
          .maybeSingle();

        if (auctionErr) console.error("Failed to load auction:", auctionErr.message);

        if (auctionData) {
          setAuction(auctionData);

          const { data: sessionData, error: sessionErr } = await supabase
            .from("session_config")
            .select("auction_name, auction_logo")
            .eq("auction_id", auctionId)
            .maybeSingle();

          if (sessionErr) console.error("Failed to load session config:", sessionErr.message);
          if (sessionData?.auction_name) setAuctionName(sessionData.auction_name);
          if (sessionData?.auction_logo) setAuctionLogo(sessionData.auction_logo);

          const { data: teamsData, error: teamsErr } = await supabase
            .from("teams")
            .select("id, name, code, logo")
            .eq("auction_id", auctionId);

          if (teamsErr) console.error("Failed to load teams:", teamsErr.message);
          console.log("[results] teams fetched:", teamsData?.length ?? 0, teamsData);

          const teamsMap = (teamsData ?? []).reduce((acc, t) => {
            acc[t.id] = { id: t.id, name: t.name, code: t.code, logo: t.logo || "" };
            return acc;
          }, {} as Record<string, TeamData>);

          setTeams(teamsMap);

          const { data: playersData, error: playersErr } = await supabase
            .from("players")
            .select("id, name, img, sold_to_team_id, sold_price, status")
            .eq("auction_id", auctionId);

          if (playersErr) console.error("Failed to load players:", playersErr.message);
          console.log("[results] players fetched:", playersData?.length ?? 0, playersData);

          setPlayers(
            (playersData ?? []).map((p: any) => ({
              id: p.id,
              name: p.name,
              img: p.img || "",
              soldToTeamId: p.sold_to_team_id,
              soldPrice: p.sold_price,
              status: p.status,
            }))
          );
        }
      } catch (error) {
        console.error("Failed to load auction data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [auctionId]);

  const { flowPlayers, flowTeams } = useMemo(() => {
    const fp: FlowPlayer[] = players.map((p) => ({
      id: p.id,
      name: p.name,
      img: p.img,
      status: p.soldToTeamId ? ("sold" as const) : ("unsold" as const),
      teamShortCode: p.soldToTeamId ? teams[p.soldToTeamId]?.code : undefined,
      price: p.soldToTeamId ? `${(p.soldPrice ?? 0).toLocaleString()} PTS` : "Unsold",
      role: "",
      origin: "",
      capped: false,
      country: "",
    }));

    const ft: FlowTeam[] = Object.values(teams).map((t) => {
      const roster = fp.filter((p) => p.teamShortCode === t.code).length;
      return {
        id: t.id,
        name: t.name,
        shortCode: t.code,
        logoUrl: t.logo,
        purse: `${roster} PLAYER${roster !== 1 ? "S" : ""}`,
      };
    });

    return { flowPlayers: fp, flowTeams: ft };
  }, [players, teams]);

  const togglePlayer = (p: FlowPlayer) => {
    if (activePlayer === p.id) {
      setActivePlayer(null);
      setActiveTeam(null);
    } else {
      setActivePlayer(p.id);
      setActiveTeam(p.teamShortCode || null);
    }
  };

  const toggleTeam = (t: FlowTeam) => {
    if (activeTeam === t.shortCode && !activePlayer) {
      setActiveTeam(null);
    } else {
      setActiveTeam(t.shortCode);
      setActivePlayer(null);
    }
  };

  const hasSelection = activePlayer !== null || activeTeam !== null;
  const soldCount = flowPlayers.filter((p) => p.status === "sold").length;

  if (loading) {
    return (
      <div className="h-screen bg-surface-container-lowest flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-theme-orange/15 border-t-theme-orange rounded-full animate-spin mx-auto mb-4" />
          <p className="font-mono-geist text-outline text-sm uppercase tracking-widest">Loading results…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Inter:wght@400;500;700&family=Geist+Mono:wght@400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

        .ms { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; font-style:normal; line-height:1; display:inline-block; text-transform:none; letter-spacing:normal; user-select:none; }
        .glass-panel { background:var(--color-surface-glass); backdrop-filter:blur(28px); -webkit-backdrop-filter:blur(28px); }
        .font-archivo { font-family:'Archivo Narrow',sans-serif; }
        .font-mono-geist { font-family:'Geist Mono',monospace; }
        .font-inter { font-family:'Inter',sans-serif; }
        .header-blur { backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); }

        /* Mobile: keep the 12-col grid (flow-view-grid stays untouched, it's
           Tailwind's grid grid-cols-12 from the JSX) — just narrow the
           three sections so player pool / canvas gutter / franchises sit
           side-by-side instead of stacking. This is the ONLY mobile rule
           block — do not add a second one, and do not touch .flow-view-grid
           here or you'll re-break the layout back to a flex column stack. */
        @media (max-width: 639px) {
          .flow-pool,
          .flow-franchises {
            grid-column: span 5 / span 5 !important;
            height: 100% !important;
            max-height: none !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
          }
          .flow-canvas-container {
            grid-column: span 2 / span 2 !important;
            display: block !important;
          }
        }
      `}</style>

      <div className="font-inter bg-background text-on-background fixed inset-0 flex flex-col overflow-hidden select-none">
        {/* HEADER — styled to match the watch page's broadcast header */}
        <header className="header-px fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between py-2px px-[20px] bg-[rgba(13,17,23,0.85)] header-blur border-b border-white/5">
          <div className="flex items-center gap-[13px]">
            <div className="w-12 h-12 overflow-hidden shrink-0 flex items-center justify-center">
              <Image
                src={auctionLogo || "/valiant-league-logo.png"}
                alt="Auction logo"
                className="w-full h-full object-cover"
                width={64}
                height={64}
              />
            </div>
            <div>
              <div className="header-logo-text font-archivo text-[18px] font-bold tracking-[-0.01em] text-white">
                {auctionName}
              </div>
              <div className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] tracking-[0.12em] uppercase">
                Broadcast Feed • {soldCount} of {flowPlayers.length} Sold
              </div>
            </div>
          </div>

          <div className="flex items-center gap-[16px] sm:gap-[30px]">
            <div className="live-badge flex items-center gap-[9px] bg-[rgba(0,80,30,0.30)] px-[17px] py-[6px] rounded-full border border-[rgba(34,197,94,0.30)]">
              <div className="w-[6px] h-[6px] rounded-full bg-green-500" style={{ boxShadow: "0 0 7px #22c55e" }} />
              <span className="live-badge-text font-mono-geist text-green-400 font-bold tracking-[0.18em] text-[9px]">
                COMPLETED
              </span>
            </div>
          </div>
        </header>

        {/* MAIN — flow view, matching the watch page's flow layout */}
        <main className="main-layout flex-1 mt-14 flex overflow-hidden min-h-0 relative">
          <div className="flow-view-grid w-full h-full relative z-10 grid grid-cols-12 gap-0 overflow-hidden">
            <FlowCanvas
              players={flowPlayers}
              teams={flowTeams}
              playerListRef={playerListRef}
              teamListRef={teamListRef}
              activePlayer={activePlayer}
              activeTeam={activeTeam}
            />

            {/* PLAYER POOL */}
            <aside
              ref={playerListRef}
              className="flow-pool col-span-3 h-full overflow-y-auto no-scrollbar px-6 py-6 z-10 border-r border-white/5"
            >
              {/* Title row stays outside the card grid so it always spans
                  the full width regardless of the grid below it. */}
              <div className="pt-6 pb-20 relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-archivo font-semibold text-lg tracking-tight uppercase text-white">
                    Player Pool
                  </h3>
                  <span className="font-mono-geist text-[9px] text-[rgba(198,198,205,0.55)] uppercase tracking-widest">
                    {flowPlayers.length}
                  </span>
                </div>

                {/* Mobile: tight 3-col grid of icon-only cards (deterministic
                    spacing, no leftover row space like flex-wrap left).
                    sm: and up falls back to the original single-column
                    stacked list with full name/status text. */}
                <div className="flex flex-col items-start sm:items-stretch gap-2 sm:gap-0 sm:space-y-3">
                  {flowPlayers.length === 0 ? (
                    <p className="font-mono-geist text-[11px] text-outline uppercase tracking-widest">
                      No players recorded yet.
                    </p>
                  ) : (
                    flowPlayers.map((p) => {
                      const isHighlighted = activePlayer
                        ? activePlayer === p.id
                        : activeTeam !== null && activeTeam === p.teamShortCode;
                      const isDimmed = hasSelection && !isHighlighted;

                      return (
                        <FlowPlayerCard
                          key={p.id}
                          id={p.id}
                          name={p.name}
                          img={p.img}
                          status={p.status}
                          price={p.price}
                          teamShortCode={p.teamShortCode}
                          isHighlighted={isHighlighted}
                          isDimmed={isDimmed}
                          onClick={() => togglePlayer(p)}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            </aside>

            {/* CANVAS GAP */}
            <section className="flow-canvas-container col-span-6 flex flex-col relative z-0 pointer-events-none" />

            {/* FRANCHISES */}
            <aside
              ref={teamListRef}
              className="flow-franchises col-span-3 h-full overflow-y-auto no-scrollbar px-6 py-6 z-10 border-l border-white/5"
            >
              <div className="pt-6 pb-20 relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-archivo font-semibold text-lg tracking-tight uppercase text-white">
                    Franchises
                  </h3>
                  <span className="font-mono-geist text-[9px] text-[rgba(198,198,205,0.55)] uppercase tracking-widest">
                    {flowTeams.length}
                  </span>
                </div>

                <div className="flex flex-col items-end sm:items-stretch gap-2 sm:gap-0 sm:space-y-3">
                  {flowTeams.length === 0 ? (
                    <p className="font-mono-geist text-[11px] text-outline uppercase tracking-widest">
                      No teams added yet.
                    </p>
                  ) : (
                    flowTeams.map((t) => {
                      const isHighlighted = activeTeam === t.shortCode;
                      const isDimmed = hasSelection && !isHighlighted;

                      return (
                        <FlowTeamCard
                          key={t.id}
                          id={t.id}
                          name={t.name}
                          shortCode={t.shortCode}
                          logoUrl={t.logoUrl}
                          purseLabel={t.purse}
                          isHighlighted={isHighlighted}
                          isDimmed={isDimmed}
                          onClick={() => toggleTeam(t)}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </>
  );
}