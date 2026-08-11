"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlowCanvas } from "@/components/FlowCanvas";
import { FlowPlayerCard } from "@/components/FlowPlayerCard";
import { FlowTeamCard } from "@/components/FlowTeamCard";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Image from "next/image";

interface SquadBoardData {
  id: string;
  name: string;
}

interface TeamData {
  id: string;
  name: string;
  code: string;
  logo: string;
}

interface SquadMemberData {
  id: string;
  name: string;
  img: string;
  role: string;
  soldToTeamId: string | null;
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

export default function SquadBoardResultsPage() {
  const params = useParams();
  const squadBoardId = params?.squadBoardId as string;
  const playerListRef = useRef<HTMLDivElement>(null);
  const teamListRef = useRef<HTMLDivElement>(null);

  const [squadBoard, setSquadBoard] = useState<SquadBoardData | null>(null);
  const [teams, setTeams] = useState<Record<string, TeamData>>({});
  const [members, setMembers] = useState<SquadMemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [activeTeam, setActiveTeam] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!squadBoardId) return;
      try {
        const { data: sbData, error: sbErr } = await supabase
          .from("auctions")
          .select("id, name, is_synthetic")
          .eq("id", squadBoardId)
          .eq("is_synthetic", true)
          .maybeSingle();

        if (sbErr) console.error("Failed to load squad board:", sbErr.message);

        if (sbData) {
          setSquadBoard({ id: sbData.id, name: sbData.name });

          const { data: teamsData, error: teamsErr } = await supabase
            .from("teams")
            .select("id, name, code, logo")
            .eq("auction_id", squadBoardId);

          if (teamsErr) console.error("Failed to load teams:", teamsErr.message);

          const teamsMap = (teamsData ?? []).reduce((acc, t) => {
            acc[t.id] = { id: t.id, name: t.name, code: t.code, logo: t.logo || "" };
            return acc;
          }, {} as Record<string, TeamData>);

          setTeams(teamsMap);

          const teamIds = Object.keys(teamsMap);
          if (teamIds.length > 0) {
            const { data: playersData, error: playersErr } = await supabase
              .from("players")
              .select("id, name, img, role, sold_to_team_id")
              .in("sold_to_team_id", teamIds);

            if (playersErr) console.error("Failed to load squad members:", playersErr.message);

            setMembers(
              (playersData ?? []).map((p: any) => ({
                id: p.id,
                name: p.name,
                img: p.img || "",
                role: p.role,
                soldToTeamId: p.sold_to_team_id,
              }))
            );
          } else {
            setMembers([]);
          }
        }
      } catch (error) {
        console.error("Failed to load squad board data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [squadBoardId]);

  const { flowPlayers, flowTeams } = useMemo(() => {
    const fp: FlowPlayer[] = members.map((m) => ({
      id: m.id,
      name: m.name,
      img: m.img,
      status: "sold" as const,
      teamShortCode: m.soldToTeamId ? teams[m.soldToTeamId]?.code : undefined,
      price: m.role || "—",
      role: m.role,
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
        purse: `Members: ${roster}`,
      };
    });

    return { flowPlayers: fp, flowTeams: ft };
  }, [members, teams]);

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

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-theme-orange/15 border-t-theme-orange rounded-full animate-spin mx-auto mb-4" />
          <p className="font-mono-geist text-outline text-sm uppercase tracking-widest">Loading squad board…</p>
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
           three sections so the member list / canvas gutter / team list
           sit side-by-side instead of stacking. This is the ONLY mobile
           rule block — do not add a second one, and do not touch
           .flow-view-grid here or you'll re-break the layout back to a
           flex column stack. */
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
        <header className="header-px fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-[30px] bg-[rgba(13,17,23,0.85)] header-blur border-b border-white/5">
          <div className="flex items-center gap-[13px]">
            <div className="w-13 h-13 overflow-hidden shrink-0 flex items-center justify-center">
              <Image
                src="/valiant-league-logo.png"
                alt="Valiant League Logo"
                width={52}
                height={52}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="header-logo-text font-archivo text-[18px] font-bold tracking-[-0.01em] text-white uppercase">
                {squadBoard?.name ?? "Squad Board"}
              </div>
              <div className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] tracking-[0.12em] uppercase">
                Squad Board • {flowPlayers.length} Members
              </div>
            </div>
          </div>

          <div className="flex items-center gap-[16px] sm:gap-[30px]">
            <div className="live-badge flex items-center gap-[9px] bg-[rgba(120,85,0,0.30)] px-[17px] py-[6px] rounded-full border border-[rgba(245,158,11,0.30)]">
              <div className="w-[6px] h-[6px] rounded-full bg-amber-400" style={{ boxShadow: "0 0 7px #f59e0b" }} />
              <span className="live-badge-text font-mono-geist text-amber-400 font-bold tracking-[0.18em] text-[9px]">
                SQUAD BOARD
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

            {/* SQUAD MEMBERS */}
            <aside
              ref={playerListRef}
              className="flow-pool col-span-3 h-full overflow-y-auto no-scrollbar px-6 py-6 z-10 border-r border-white/5"
            >
              {/* Title row stays outside the card list so it always spans
                  the full width regardless of the icon-only compact cards
                  below it on mobile. */}
              <div className="pt-6 pb-20 relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-archivo font-semibold text-lg tracking-tight uppercase text-white">
                    Squad Members
                  </h3>
                  <span className="font-mono-geist text-[9px] text-[rgba(198,198,205,0.55)] uppercase tracking-widest">
                    {flowPlayers.length}
                  </span>
                </div>

                {/* items-end on mobile: icon-only cards shrink to content
                    width (instead of stretching full column width via the
                    flex-col default align-items:stretch) and hug the right
                    edge of this column, closest to the canvas gutter, so
                    connector lines stay as short as possible. sm: and up
                    falls back to the original full-width stacked list. */}
                <div className="flex flex-col items-start sm:items-stretch gap-2 sm:gap-0 sm:space-y-3">
                  {flowPlayers.length === 0 ? (
                    <p className="font-mono-geist text-[11px] text-outline uppercase tracking-widest">
                      No players assigned to any team yet.
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

            {/* TEAMS */}
            <aside
              ref={teamListRef}
              className="flow-franchises col-span-3 h-full overflow-y-auto no-scrollbar px-6 py-6 z-10 border-l border-white/5"
            >
              <div className="pt-6 pb-20 relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-archivo font-semibold text-lg tracking-tight uppercase text-white">
                    Teams
                  </h3>
                  <span className="font-mono-geist text-[9px] text-[rgba(198,198,205,0.55)] uppercase tracking-widest">
                    {flowTeams.length}
                  </span>
                </div>

                {/* items-end on mobile: pushes team icons to the outer/right
                    edge of the screen (away from the canvas gutter), same
                    treatment used on the auction results page, so the lines
                    get the full middle width to fan out into. */}
                <div className="flex flex-col items-end sm:items-stretch gap-2 sm:gap-0 sm:space-y-3">
                  {flowTeams.length === 0 ? (
                    <p className="font-mono-geist text-[11px] text-outline uppercase tracking-widest">
                      No teams assigned to this board yet.
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