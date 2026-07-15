"use client"

import Link from "next/link"
import { Network } from "lucide-react"
import {
  hasMatchDetail,
  type BracketMatch,
  type BracketTeam,
} from "@/data/tournament-data"

// ─────────────────────────────────────────────────────────────
// BRACKET PANEL (playoff stage)
// ─────────────────────────────────────────────────────────────
export function BracketPanel({ matches, slug }: { matches: BracketMatch[]; slug: string }) {
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8 overflow-x-auto">
      <h2 className="text-2xl font-bold text-white mb-6 font-cinzel flex items-center gap-2">
        <Network className="h-5 w-5 text-gold" />
        PLAYOFF BRACKET
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-[520px] sm:min-w-0">
        {matches.map((m) => {
          const playable = hasMatchDetail(m.id)
          const card = (
            <div
              className={`border border-gold/10 rounded-md p-4 bg-white/[0.02] transition-all ${
                playable ? "hover:border-gold/60 hover:bg-white/[0.04] cursor-pointer" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-gold text-xs font-bold font-cinzel uppercase tracking-wide">{m.label}</span>
                {m.date && <span className="text-gray-500 text-xs">{m.date}</span>}
              </div>
              <BracketTeamRow team={m.team1} isWinner={m.winner === m.team1.short} />
              <BracketTeamRow team={m.team2} isWinner={m.winner === m.team2.short} />
              {playable && (
                <p className="text-gold text-[10px] uppercase tracking-widest font-cinzel mt-3 text-right">
                  View match →
                </p>
              )}
            </div>
          )

          return playable ? (
            <Link key={m.id} href={`/tournament/${slug}/match/${m.id}`}>
              {card}
            </Link>
          ) : (
            <div key={m.id}>{card}</div>
          )
        })}
      </div>
    </div>
  )
}

function BracketTeamRow({ team, isWinner }: { team: BracketTeam; isWinner: boolean }) {
  const tbd = team.short === "TBD"
  return (
    <div
      className={`flex items-center justify-between py-2 px-2 rounded ${
        isWinner ? "bg-gold/10 border border-gold/30" : ""
      }`}
    >
      <span className={`text-sm ${tbd ? "text-gray-500 italic" : isWinner ? "text-white font-semibold" : "text-gray-300"}`}>
        {team.name}
      </span>
      {team.score && <span className="text-gray-400 text-xs">{team.score}</span>}
    </div>
  )
}