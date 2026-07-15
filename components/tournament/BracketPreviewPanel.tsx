// File: components/tournament/BracketPreviewPanel.tsx
"use client"

import Link from "next/link"
import { ArrowRight, Network, Trophy, RotateCcw, Award, Radio } from "lucide-react"
import type { MatchNode, Round } from "@/components/tournament/TournamentBracket"
import type { DoubleElimData } from "@/lib/tournament/doubleElim"

/* ------------------------------------------------------------------ */
/*  This panel is intentionally NOT a shrunk-down TournamentBracket / */
/*  DoubleElimBoard. Those two are built around measured DOM geometry */
/*  across many columns — that only works with real width. This panel */
/*  renders plain static mini-cards for just the "current" round(s),  */
/*  and links out to the full interactive chart page.                 */
/* ------------------------------------------------------------------ */

type BracketPreviewProps =
  | { format: "single"; rounds: Round[]; slug: string }
  | { format: "double"; data: DoubleElimData; slug: string }

function isDone(m: MatchNode) {
  return m.status === "completed"
}

/** First round with any not-yet-completed match, else the last round. */
function findCurrentRoundIndex(rounds: Round[]): number {
  if (!rounds.length) return -1
  const idx = rounds.findIndex((r) => r.matches.some((m) => !isDone(m)))
  return idx === -1 ? rounds.length - 1 : idx
}

function MiniTeamRow({ team, isWinner }: { team: MatchNode["teamA"]; isWinner: boolean }) {
  const tbd = !team
  return (
    <div className={`flex items-center justify-between py-1.5 px-2 rounded ${isWinner ? "bg-gold/10 border border-gold/30" : ""}`}>
      <span className={`text-xs truncate ${tbd ? "text-gray-500 italic" : isWinner ? "text-white font-semibold" : "text-gray-300"}`}>
        {tbd ? "TBD" : team.name}
      </span>
      {!tbd && team.score !== undefined && <span className="text-gray-400 text-xs ml-2">{team.score}</span>}
    </div>
  )
}

function MiniMatchCard({ match }: { match: MatchNode }) {
  return (
    <div className="border border-gold/10 rounded-md p-3 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gold text-[10px] font-bold font-cinzel uppercase tracking-wide">{match.label}</span>
        {match.status === "live" ? (
          <span className="flex items-center gap-1 text-red-500 text-[10px] font-bold">
            <Radio className="h-2.5 w-2.5 animate-pulse" /> LIVE
          </span>
        ) : match.date ? (
          <span className="text-gray-500 text-[10px]">{match.date}</span>
        ) : null}
      </div>
      <MiniTeamRow team={match.teamA} isWinner={!!match.teamA?.isWinner} />
      <MiniTeamRow team={match.teamB} isWinner={!!match.teamB?.isWinner} />
    </div>
  )
}

function MiniColumn({ round }: { round: Round }) {
  return (
    <div>
      <p className="text-gray-400 text-[10px] uppercase tracking-widest font-cinzel mb-2">{round.name}</p>
      <div className="space-y-2">
        {round.matches.map((m) => (
          <MiniMatchCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  )
}

function PanelShell({
  slug,
  fullBracketHref,
  children,
}: {
  slug: string
  fullBracketHref: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8 overflow-x-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-white font-cinzel flex items-center gap-2">
          <Network className="h-5 w-5 text-gold" />
          PLAYOFF BRACKET
        </h2>
        <Link
          href={fullBracketHref}
          className="flex items-center gap-1.5 text-gold text-xs font-bold font-cinzel uppercase tracking-wide hover:text-gold/80 transition-colors"
        >
          Full bracket
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {children}
    </div>
  )
}

export default function BracketPreviewPanel(props: BracketPreviewProps) {
  if (props.format === "single") {
    const { rounds, slug } = props
    const curIdx = findCurrentRoundIndex(rounds)
    const visible = curIdx === -1 ? [] : rounds.slice(curIdx, curIdx + 2)

    return (
      <PanelShell slug={slug} fullBracketHref={`/tournament/bracket/singleElimination?slug=${slug}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-[440px] sm:min-w-0">
          {visible.map((round) => (
            <MiniColumn key={round.id} round={round} />
          ))}
        </div>
      </PanelShell>
    )
  }

  // Double elimination: show current WB round + current LB round in
  // parallel (they progress independently), and the Grand Final once
  // both finals have been reached.
  const { data, slug } = props
  const wbIdx = findCurrentRoundIndex(data.winners)
  const lbIdx = data.losers.length ? findCurrentRoundIndex(data.losers) : -1
  const wbAtFinal = wbIdx === data.winners.length - 1
  const lbAtFinal = lbIdx === -1 || lbIdx === data.losers.length - 1
  const gfReached = wbAtFinal && lbAtFinal && isDone(data.winners[wbIdx]?.matches[0]) 

  return (
    <PanelShell slug={slug} fullBracketHref={`/tournament/bracket/doubleElimination?slug=${slug}`}>
      <div className="space-y-6 min-w-[280px]">
        {wbIdx !== -1 && (
          <div>
            <p className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-widest font-cinzel mb-2">
              <Trophy className="h-3 w-3" /> Winners bracket
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MiniColumn round={data.winners[wbIdx]} />
            </div>
          </div>
        )}
        {lbIdx !== -1 && (
          <div>
            <p className="flex items-center gap-1.5 text-orange-400 text-[10px] font-bold uppercase tracking-widest font-cinzel mb-2">
              <RotateCcw className="h-3 w-3" /> Losers bracket
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MiniColumn round={data.losers[lbIdx]} />
            </div>
          </div>
        )}
        {gfReached && (
          <div>
            <p className="flex items-center gap-1.5 text-gold text-[10px] font-bold uppercase tracking-widest font-cinzel mb-2">
              <Award className="h-3 w-3" /> Grand final
            </p>
            <MiniMatchCard match={data.grandFinal} />
          </div>
        )}
      </div>
    </PanelShell>
  )
}