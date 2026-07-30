"use client";

import React, { use, useEffect, useMemo, useRef, useState } from "react";
import { FlowCanvas } from "@/components/FlowCanvas";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface AuctionData {
  id: string;
  name: string;
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
  const teamListInnerRef = useRef<HTMLDivElement>(null);

  const [auction, setAuction] = useState<AuctionData | null>(null);
  const [teams, setTeams] = useState<Record<string, TeamData>>({});
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [activeTeam, setActiveTeam] = useState<string | null>(null);

  // ── Team list fit detection ────────────────────────────────────────────
  // When all teams fit within the viewport, we center them + lock scroll
  // (matches the squad-board look). When they don't fit, we switch to a
  // normal top-aligned, scrollable list so nothing gets clipped.
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
      try {
        const { data: auctionData, error: auctionErr } = await supabase
          .from("auctions")
          .select("id, name")
          .eq("id", auctionId)
          .maybeSingle();

        if (auctionErr) console.error("Failed to load auction:", auctionErr.message);

        if (auctionData) {
          setAuction(auctionData);

          const { data: teamsData, error: teamsErr } = await supabase
            .from("teams")
            .select("id, name, code, logo")
            .eq("auction_id", auctionId);

          if (teamsErr) console.error("Failed to load teams:", teamsErr.message);

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

    const ft: FlowTeam[] = Object.values(teams).map((t) => ({
      id: t.id,
      name: t.name,
      shortCode: t.code,
      logoUrl: t.logo,
      purse: "0",
    }));

    return { flowPlayers: fp, flowTeams: ft };
  }, [players, teams]);

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-theme-orange/15 border-t-theme-orange rounded-full animate-spin mx-auto mb-4" />
          <p className="font-mono-geist text-outline text-sm uppercase tracking-widest">Loading results…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-inter bg-background text-on-background fixed inset-0 flex flex-col overflow-hidden select-none">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center gap-4 px-[30px] bg-[rgba(13,17,23,0.85)] header-blur border-b border-white/5">
        <Link href={`/auction/owner/${auctionId}`} className="text-theme-orange hover:text-theme-orange/80 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="font-archivo text-[18px] font-bold tracking-[-0.01em] text-white">
            {auction?.name ?? "Auction"}
          </div>
          <div className="font-mono-geist text-[8px] text-[rgba(198,198,205,0.55)] tracking-[0.12em] uppercase">
            Auction Results Flow
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

          {/* Player list */}
          <aside ref={playerListRef} className="col-span-3 h-full overflow-y-auto no-scrollbar px-6 py-6 z-10 border-r border-white/5">
            <div className="flex items-center justify-between mb-4 pt-2">
              <h3 className="font-archivo font-semibold text-lg tracking-tight uppercase text-white">
                Players
              </h3>
              <span className="font-mono-geist text-[9px] text-[rgba(198,198,205,0.55)] uppercase tracking-widest">
                {flowPlayers.length}
              </span>
            </div>

            {flowPlayers.length === 0 ? (
              <p className="font-mono-geist text-[11px] text-outline uppercase tracking-widest">
                No players recorded yet.
              </p>
            ) : (
              <div className="flex flex-col space-y-3 pb-20">
                {flowPlayers.map((p) => {
                  const isSoldP = p.status === "sold";
                  const isHighlighted = activePlayer
                    ? activePlayer === p.id
                    : activeTeam !== null && activeTeam === p.teamShortCode;
                  const isDimmed = (activePlayer !== null || activeTeam !== null) && !isHighlighted;

                  return (
                    <div
                      key={p.id}
                      id={`player-${p.id}`}
                      onClick={() => setActivePlayer((prev) => (prev === p.id ? null : p.id))}
                      className={[
                        "glass-panel p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all duration-300",
                        isHighlighted
                          ? "ring-1 ring-theme-orange shadow-[0_0_15px_rgba(201,151,31,0.3)] bg-white/10"
                          : "border border-white/5 hover:border-theme-orange/40",
                        isDimmed ? "opacity-30" : "",
                        isSoldP && !isHighlighted ? "border-r-2 border-r-green-500/50" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container-highest flex-shrink-0">
                        {p.img && <img src={p.img} alt={p.name} className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-archivo font-semibold text-sm truncate text-white">{p.name}</p>
                        <p
                          className={`text-[10px] font-mono-geist font-medium mt-0.5 uppercase ${
                            isSoldP ? "text-green-400" : "text-amber-400"
                          }`}
                        >
                          {isSoldP ? `SOLD • ${p.teamShortCode}` : "UNSOLD"} • {p.price}
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

          {/* Team list */}
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
                No teams added yet.
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
                          Players: {memberCount}
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