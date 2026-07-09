// app/(demo)/tournament/bracket/page.tsx
"use client";

import { useState } from "react";
import { Trophy, Tv, Calendar, MapPin, CheckCircle2 } from "lucide-react";

// Types matching your database structure and layout requirements
interface TeamNode {
  id: string;
  code: string;
  name: string;
  logo?: string;
  color: string;
  score?: number;
  isWinner?: boolean;
}

interface MatchNode {
  id: string;
  roundId: number;
  status: "scheduled" | "live" | "completed";
  teamA: TeamNode | null; // null represents "To Be Determined"
  teamB: TeamNode | null;
  venue?: string;
  date?: string;
  time?: string;
  streamUrl?: string;
}

interface Round {
  id: number;
  name: string;
  matches: MatchNode[];
}

// Mock Data structure mirroring your Supabase Team entries
const INITIAL_ROUNDS: Round[] = [
  {
    id: 1,
    name: "Quarter-Finals",
    matches: [
      {
        id: "qf1",
        roundId: 1,
        status: "completed",
        venue: "Meridian Stadium",
        date: "July 12",
        time: "15:30",
        teamA: { id: "t1", code: "CS", name: "Coastal Sharks", logo: "/Franchises/CSK.png", color: "#3B8BD4", score: 184, isWinner: true },
        teamB: { id: "t2", code: "DF", name: "Desert Falcons", logo: "/Franchises/RCB.png", color: "#2A9D5C", score: 162 }
      },
      {
        id: "qf2",
        roundId: 1,
        status: "completed",
        venue: "Galle International",
        date: "July 12",
        time: "19:30",
        teamA: { id: "t3", code: "MK", name: "Moon Knights", logo: "/Franchises/MI.png", color: "#E45D35", score: 145 },
        teamB: { id: "t4", code: "vv", name: "Viper Titans", logo: "/Franchises/SRH.png", color: "#FFB000", score: 148, isWinner: true }
      },
      {
        id: "qf3",
        roundId: 1,
        status: "live",
        venue: "Meridian Stadium",
        date: "July 13",
        time: "15:30",
        teamA: { id: "t5", code: "KK", name: "Kandy Kings", logo: "/Franchises/KKR.png", color: "#7C3AED", score: 92 },
        teamB: { id: "t6", code: "BR", name: "Badulla Royals", logo: "/Franchises/RR.png", color: "#EC4899", score: 88 }
      },
      {
        id: "qf4",
        roundId: 1,
        status: "scheduled",
        venue: "R. Premadasa",
        date: "July 13",
        time: "19:30",
        teamA: { id: "t7", code: "JG", name: "Jaffna Giants", logo: "/Franchises/GT.png", color: "#0F172A" },
        teamB: { id: "t8", code: "GC", name: "Galle Challengers", logo: "/Franchises/DC.png", color: "#DC2626" }
      }
    ]
  },
  {
    id: 2,
    name: "Semi-Finals",
    matches: [
      {
        id: "sf1",
        roundId: 2,
        status: "scheduled",
        venue: "Meridian Stadium",
        date: "July 15",
        time: "19:30",
        teamA: { id: "t1", code: "CS", name: "Coastal Sharks", logo: "/Franchises/CSK.png", color: "#3B8BD4" },
        teamB: { id: "t4", code: "vv", name: "Viper Titans", logo: "/Franchises/SRH.png", color: "#FFB000" }
      },
      {
        id: "sf2",
        roundId: 2,
        status: "scheduled",
        venue: "R. Premadasa",
        date: "July 16",
        time: "19:30",
        teamA: null, // Populated via progression rules dynamically
        teamB: null
      }
    ]
  },
  {
    id: 3,
    name: "Grand Finals",
    matches: [
      {
        id: "f1",
        roundId: 3,
        status: "scheduled",
        venue: "Meridian Stadium",
        date: "July 19",
        time: "20:00",
        teamA: null,
        teamB: null
      }
    ]
  }
];

export default function TournamentBracketPage() {
  const [hoveredTeamCode, setHoveredTeamCode] = useState<string | null>(null);

  return (
    <div className="min-h-screen w-full bg-[#08080a] text-slate-100 p-4 md:p-8 overflow-x-auto selection:bg-orange-500/30">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-orange-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Page Header */}
      <div className="max-w-7xl mx-auto mb-12 relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-[0.3em] uppercase text-[var(--color-theme-orange,#e45d35)]">
            <Trophy className="w-4 h-4 animate-pulse" /> Knockout Stage
          </div>
          <h1 className="font-heading font-black text-3xl md:text-4xl uppercase tracking-tight mt-1">
            Championship <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-500">Bracket</span>
          </h1>
        </div>
        
        {/* Quick Stats/Legends Banner */}
        <div className="flex items-center gap-4 bg-zinc-900/50 backdrop-blur-md p-3 rounded-xl border border-white/5 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live Matches
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="text-zinc-400">
            Hover over a team card to trace their path through tournament phases.
          </div>
        </div>
      </div>

      {/* Main Bracket Canvas Container */}
      <div className="max-w-7xl mx-auto flex items-start gap-0 min-w-[1000px] pb-12">
        {INITIAL_ROUNDS.map((round, roundIdx) => (
          <div key={round.id} className="flex-1 flex flex-col items-center">
            
            {/* Round Column Header Title */}
            <div className="w-full text-center mb-8 relative">
              <div 
                className="inline-block px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase bg-zinc-950 border border-white/10 shadow-lg"
                style={{ boxShadow: "0 4px 20px -2px rgba(0,0,0,0.7)" }}
              >
                {round.name}
              </div>
              {/* Connecting baseline behind titles */}
              <div className="absolute left-0 right-0 top-1/2 -z-10 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </div>

            {/* Match Cards Placement Area wrapper */}
            <div className="w-full flex flex-col justify-around h-[640px] relative">
              {round.matches.map((match) => {
                return (
                  <div key={match.id} className="relative w-full px-4 flex items-center justify-center">
                    
                    {/* SVG Branch Connector Lines Overlay (Except Grand Finals Column) */}
                    {roundIdx < INITIAL_ROUNDS.length - 1 && (
                      <div className="absolute left-1/2 top-1/2 w-1/2 h-[160px] pointer-events-none -translate-y-1/2 z-0 hidden md:block">
                        <svg className="w-full h-full overflow-visible" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d={`M ${0} ${80} C ${25} ${80}, ${25} ${match.roundId === 1 && ["qf2", "qf4"].includes(match.id) ? 0 : 160}, ${55} ${match.roundId === 1 && ["qf2", "qf4"].includes(match.id) ? 0 : 160}`}
                            fill="none"
                            stroke="var(--color-border-overlay, rgba(255,255,255,0.06))"
                            strokeWidth="2"
                          />
                        </svg>
                      </div>
                    )}

                    {/* Individual Broadcast Match Node */}
                    <div 
                      className={`w-full max-w-sm rounded-2xl relative p-[1px] transition-all duration-300 z-10 group overflow-hidden ${
                        match.status === "live" 
                          ? "shadow-[0_0_25px_rgba(228,93,53,0.15)]" 
                          : "shadow-2xl"
                      }`}
                      style={{
                        background: match.status === "live"
                          ? "linear-gradient(135deg, #e45d35 0%, rgba(255,255,255,0.05) 50%, #e45d35 100%)"
                          : "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)"
                      }}
                    >
                      {/* Inner Container Surface */}
                      <div className="bg-[#0c0c0e] rounded-[15px] p-3.5 flex flex-col gap-2.5 relative overflow-hidden">
                        
                        {/* Dynamic Soft Glow for Live Matches */}
                        {match.status === "live" && (
                          <div className="absolute inset-0 bg-gradient-to-r from-orange-600/5 to-purple-600/5 pointer-events-none animate-pulse" />
                        )}

                        {/* Team Node Rows */}
                        {[match.teamA, match.teamB].map((team, idx) => {
                          const isTBD = !team;
                          const isHovered = team && hoveredTeamCode === team.code;
                          const isAnyHovered = hoveredTeamCode !== null;
                          
                          return (
                            <div
                              key={idx}
                              onMouseEnter={() => team && setHoveredTeamCode(team.code)}
                              onMouseLeave={() => setHoveredTeamCode(null)}
                              className={`flex items-center justify-between p-2 rounded-xl transition-all duration-200 relative ${
                                isTBD 
                                  ? "bg-zinc-950/40 border border-dashed border-white/5 text-zinc-600" 
                                  : "bg-zinc-900/40 border border-white/5"
                              } ${
                                isHovered 
                                  ? "scale-[1.02] bg-zinc-900 border-orange-500/30 shadow-[inset_0_0_12px_rgba(255,255,255,0.02)]" 
                                  : isAnyHovered && !isHovered ? "opacity-30 blur-[0.5px]" : ""
                              }`}
                            >
                              {/* Left Colored Ident Accent Tab */}
                              {!isTBD && (
                                <div 
                                  className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md transition-all"
                                  style={{ backgroundColor: team.color }}
                                />
                              )}

                              <div className="flex items-center gap-3 pl-2">
                                {/* Crest / Logo Emplace */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-heading font-black text-xs shrink-0 bg-black overflow-hidden relative ${isTBD ? "border border-dashed border-zinc-800" : ""}`}>
                                  {!isTBD ? (
                                    team.logo ? (
                                      <img src={team.logo} alt="" className="w-full h-full object-cover p-0.5" />
                                    ) : (
                                      <span style={{ color: team.color }}>{team.code}</span>
                                    )
                                  ) : (
                                    <span className="text-zinc-700 font-normal">?</span>
                                  )}
                                </div>

                                {/* Team Text Labels */}
                                <div className="leading-none">
                                  <p className={`font-heading font-bold text-xs uppercase tracking-wide ${isTBD ? "text-zinc-600 font-medium" : "text-zinc-200"}`}>
                                    {isTBD ? "To Be Determined" : team.name}
                                  </p>
                                  {!isTBD && (
                                    <span className="text-[9px] font-mono tracking-wider opacity-40 mt-0.5 block">
                                      Franchise short: {team.code}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Scores / Metrics Field */}
                              {!isTBD && match.status !== "scheduled" && (
                                <div className="flex items-center gap-2 font-mono font-black text-sm pr-1">
                                  {team.isWinner && <CheckCircle2 className="w-3.5 h-3.5 text-orange-500 stroke-[3]" />}
                                  <span className={team.isWinner ? "text-orange-400" : "text-zinc-500"}>
                                    {team.score}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Match Information Footer Meta Block */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-2.5 mt-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          <div className="flex items-center gap-1.5 max-w-[65%] truncate">
                            <MapPin className="w-3 h-3 text-zinc-600 shrink-0" />
                            <span className="truncate">{match.venue || "TBD"}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {match.status === "live" ? (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800/50 animate-pulse text-[9px] font-black tracking-widest">
                                <Tv className="w-2.5 h-2.5" /> Live
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 font-mono text-zinc-500">
                                <Calendar className="w-2.5 h-2.5 opacity-50" />
                                {match.date ? `${match.date} · ${match.time}` : "Date Pending"}
                              </span>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}