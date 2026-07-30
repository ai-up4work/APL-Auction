"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlowCanvas } from "@/components/FlowCanvas";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useParams } from "next/navigation";

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
  id: number;
  name: string;
  img: string;
  status: "sold" | "unsold" | "pending";
  teamShortCode?: string;
  price: number;
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
  const teamListInnerRef = useRef<HTMLDivElement>(null);

  const [squadBoard, setSquadBoard] = useState<SquadBoardData | null>(null);
  const [teams, setTeams] = useState<Record<string, TeamData>>({});
  const [members, setMembers] = useState<SquadMemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [activeTeam, setActiveTeam] = useState<string | null>(null);

  const [teamsOverflow, setTeamsOverflow] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (!teamListRef.current || !teamListInnerRef.current) return;
      const containerHeight = teamListRef.current.clientHeight;
      const contentHeight = teamListInnerRef.current.scrollHeight;
      setTeamsOverflow(contentHeight > containerHeight);
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  });

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
    const fp: FlowPlayer[] = members.map((m, idx) => ({
      id: idx,
      name: m.name,
      img: m.img,
      status: "sold" as const,
      teamShortCode: m.soldToTeamId ? teams[m.soldToTeamId]?.code : undefined,
      price: 0,
      role: m.role,
      origin: "",
      capped: false,
      country: "",
    }));

    const ft: FlowTeam[] = Object.values(teams).map((t) => ({
      id: t.id,
      name: t.name,
      shortCode: t.code,
      logoUrl: t.logo,
      purse: "0",
    }));

    return { flowPlayers: fp, flowTeams: ft };
  }, [members, teams]);

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
    <div className="font-inter bg-background text-on-background fixed inset-0 flex flex-col overflow-hidden select-none">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center gap-4 px-[30px] bg-[rgba(13,17,23,0.85)] header-blur border-b border-white/5">
        <Link href={`/squad-board/${squadBoardId}`} className="text-theme-orange hover:text-theme-orange/80 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="font-archivo text-[18px] font-bold tracking-[-0.01em] text-white uppercase">
            {squadBoard?.name ?? "Squad Board"}
          </div>
          <div className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] tracking-[0.12em] uppercase">
            Squad Board Results Flow
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 mt-14 flex overflow-hidden min-h-0 relative">
        <div className="w-full h-full relative z-10 grid grid-cols-12 gap-0 overflow-hidden">
          <FlowCanvas
            players={flowPlayers}
            teams={flowTeams}
            playerListRef={playerListRef}
            teamListRef={teamListRef}
            activePlayer={activePlayer}
            activeTeam={activeTeam}
          />

          {/* Members list */}
          <aside ref={playerListRef} className="col-span-3 h-full overflow-y-auto no-scrollbar px-6 py-6 z-10 border-r border-white/5">
            <div className="flex items-center justify-between mb-4 pt-2">
              <h3 className="font-archivo font-semibold text-lg tracking-tight uppercase text-white">
                Squad Members
              </h3>
              <span className="font-mono-geist text-[9px] text-[rgba(198,198,205,0.55)] uppercase tracking-widest">
                {flowPlayers.length}
              </span>
            </div>

            {flowPlayers.length === 0 ? (
              <p className="font-mono-geist text-[11px] text-outline uppercase tracking-widest">
                No players assigned to any team yet.
              </p>
            ) : (
              <div className="flex flex-col space-y-3 pb-20">
                {flowPlayers.map((p) => {
                  const isHighlighted = activePlayer
                    ? activePlayer === String(p.id)
                    : activeTeam !== null && activeTeam === p.teamShortCode;
                  const isDimmed = (activePlayer !== null || activeTeam !== null) && !isHighlighted;

                  return (
                    <div
                      key={p.id}
                      id={`player-${p.id}`}
                      onClick={() => setActivePlayer((prev) => (prev === String(p.id) ? null : String(p.id)))}
                      className={[
                        "glass-panel p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all duration-300",
                        isHighlighted
                          ? "ring-1 ring-theme-orange shadow-[0_0_15px_rgba(201,151,31,0.3)] bg-white/10"
                          : "border border-white/5 hover:border-theme-orange/40",
                        isDimmed ? "opacity-30" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container-highest flex-shrink-0">
                        {p.img && <img src={p.img} alt={p.name} className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-archivo font-semibold text-sm truncate text-white">{p.name}</p>
                        <p className="text-[10px] font-mono-geist text-on-surface-variant mt-0.5 uppercase">
                          {p.teamShortCode ?? "—"} • {p.role}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Canvas gap */}
          <section className="col-span-6 flex flex-col relative z-0 pointer-events-none" />

          {/* Teams list */}
          <aside
            ref={teamListRef}
            className={[
              "col-span-3 h-full flex flex-col px-6 py-6 z-10 border-l border-white/5",
              teamsOverflow ? "overflow-y-auto no-scrollbar justify-start" : "overflow-hidden justify-center",
            ].join(" ")}
          >
            <div className={teamsOverflow ? "mb-4 pt-2 flex items-center justify-between" : "flex items-center justify-between mb-4 absolute top-[72px] right-6"}>
              <h3 className="font-archivo font-semibold text-lg tracking-tight uppercase text-white">
                Teams
              </h3>
              <span className="font-mono-geist text-[9px] text-[rgba(198,198,205,0.55)] uppercase tracking-widest ml-3">
                {flowTeams.length}
              </span>
            </div>

            {flowTeams.length === 0 ? (
              <p className="font-mono-geist text-[11px] text-outline uppercase tracking-widest text-center">
                No teams assigned to this board yet.
              </p>
            ) : (
              <div
                ref={teamListInnerRef}
                className={["flex flex-col space-y-3", teamsOverflow ? "pb-20" : ""].join(" ")}
              >
                {flowTeams.map((t) => {
                  const isHighlighted = activeTeam === t.shortCode;
                  const isDimmed = activeTeam !== null && !isHighlighted;
                  const memberCount = flowPlayers.filter((p) => p.teamShortCode === t.shortCode).length;

                  return (
                    <div
                      key={t.id}
                      id={`team-${t.shortCode}`}
                      onClick={() => setActiveTeam((prev) => (prev === t.shortCode ? null : t.shortCode))}
                      className={[
                        "glass-panel p-3 rounded-xl flex items-center gap-4 cursor-pointer transition-all duration-300",
                        isHighlighted
                          ? "ring-1 ring-theme-orange shadow-[0_0_15px_rgba(201,151,31,0.3)] bg-white/10"
                          : "border border-white/5 hover:border-theme-orange/40",
                        isDimmed ? "opacity-30" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container flex-shrink-0">
                        {t.logoUrl && <img src={t.logoUrl} alt={t.name} className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-archivo font-bold text-xs truncate uppercase tracking-tight text-white">
                          {t.name}
                        </p>
                        <p className="text-[10px] font-mono-geist text-theme-orange mt-0.5 tracking-wider">
                          Members: {memberCount}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}