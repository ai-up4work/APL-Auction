// File: components/tournament/BracketPreviewPanel.tsx
"use client"

import Link from "next/link"
import { ArrowRight, Network, Trophy, RotateCcw, Award, Radio } from "lucide-react"
import type { MatchNode, Round, TeamNode } from "@/components/tournament/TournamentBracket"
import { generateBracketRounds } from "@/lib/tournament/generateBracketRounds"
import { getDemoTeams } from "@/lib/tournament/demoTeams"
import {
  generateDoubleElimination,
  recordDoubleElimResult,
  type DoubleElimData,
} from "@/lib/tournament/doubleElim"

/* ------------------------------------------------------------------ */
/*  This panel generates its own full 32-team demo bracket — the same  */
/*  shape the full-page chart (TournamentBracket / DoubleElimBoard)    */
/*  renders — and previews a slice of it. It intentionally does NOT    */
/*  read per-tournament data from tournament-data: that data is much   */
/*  smaller/differently-shaped than a real bracket, which made the     */
/*  preview look like a thin, half-empty stub. The `format` prop only  */
/*  says which chart TYPE to preview; `slug` is only used to build the */
/*  "Full bracket" link.                                                */
/* ------------------------------------------------------------------ */

type BracketPreviewProps =
  | { format: "single"; slug: string }
  | { format: "double"; slug: string }

function isDone(m: MatchNode) {
  return m.status === "completed"
}

/** First round with any not-yet-completed match, else the last round. */
function findCurrentRoundIndex(rounds: Round[]): number {
  if (!rounds.length) return -1
  const idx = rounds.findIndex((r) => r.matches.some((m) => !isDone(m)))
  return idx === -1 ? rounds.length - 1 : idx
}

/* ------------------------------------------------------------------ */
/*  Demo data generation — mirrors the singleElimination /              */
/*  doubleElimination full-chart pages exactly, so the preview is a    */
/*  slice of the same bracket shape (32 teams), not a separate one.    */
/*  Cached at module scope so re-renders of this panel (or multiple    */
/*  tabs on the same tournament page) don't regenerate/re-randomize.   */
/* ------------------------------------------------------------------ */

function setResult(match: MatchNode, winner: "A" | "B", scoreA: number, scoreB: number) {
  match.status = "completed"
  if (match.teamA) {
    match.teamA.score = scoreA
    match.teamA.isWinner = winner === "A"
  }
  if (match.teamB) {
    match.teamB.score = scoreB
    match.teamB.isWinner = winner === "B"
  }
}

function advanceWinner(match: MatchNode, nextMatches: MatchNode[]) {
  const winner = match.teamA?.isWinner ? match.teamA : match.teamB?.isWinner ? match.teamB : null
  if (!winner) return
  const next = nextMatches.find((m) => m.aFrom === match.id || m.bFrom === match.id)
  if (!next) return
  const slot: TeamNode = { ...winner, score: undefined, isWinner: undefined }
  if (next.aFrom === match.id) next.teamA = slot
  else next.teamB = slot
}

function resolveSingleElim(rounds: Round[]) {
  for (let r = 0; r < rounds.length; r++) {
    const round = rounds[r]
    for (const match of round.matches) {
      if (match.teamA && match.teamB && match.status !== "completed") {
        const scoreA = 60 + Math.floor(Math.random() * 60)
        const scoreB = 60 + Math.floor(Math.random() * 60)
        setResult(match, scoreA >= scoreB ? "A" : "B", scoreA, scoreB)
      }
    }
    const next = rounds[r + 1]
    if (next) {
      for (const match of round.matches) advanceWinner(match, next.matches)
    }
  }
}

function resolveDoubleElim(data: DoubleElimData) {
  let changed = true
  while (changed) {
    changed = false
    const all = [
      ...data.winners.flatMap((r) => r.matches),
      ...data.losers.flatMap((r) => r.matches),
      data.grandFinal,
      ...(data.bracketReset ? [data.bracketReset] : []),
    ]
    for (const match of all) {
      const playable =
        match.teamA && match.teamB && match.teamB.code !== "BYE" && match.status !== "completed"
      if (!playable) continue
      let scoreA = 60 + Math.floor(Math.random() * 60)
      let scoreB = 60 + Math.floor(Math.random() * 60)
      if (scoreA === scoreB) scoreB += 1
      recordDoubleElimResult(data, match.id, scoreA > scoreB ? "A" : "B", scoreA, scoreB)
      changed = true
    }
  }
}

let cachedSingleElimRounds: Round[] | null = null
let cachedDoubleElimData: DoubleElimData | null = null

function getSingleElimDemoRounds(): Round[] {
  if (cachedSingleElimRounds) return cachedSingleElimRounds
  const teams = getDemoTeams(32)
  const rounds = generateBracketRounds(teams)
  resolveSingleElim(rounds)
  cachedSingleElimRounds = rounds
  return rounds
}

function getDoubleElimDemoData(): DoubleElimData {
  if (cachedDoubleElimData) return cachedDoubleElimData
  const teams = getDemoTeams(32)
  const data = generateDoubleElimination(teams)
  resolveDoubleElim(data)
  cachedDoubleElimData = data
  return data
}

/* ------------------------------------------------------------------ */
/*  Presentation                                                        */
/* ------------------------------------------------------------------ */

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
  fullBracketHref,
  children,
}: {
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
    const { slug } = props
    const rounds = getSingleElimDemoRounds()
    const curIdx = findCurrentRoundIndex(rounds)
    const visible = curIdx === -1 ? [] : rounds.slice(curIdx, curIdx + 2)
    const fullBracketHref = `/tournament/${slug}/bracket/singleElimination`

    return (
      <PanelShell fullBracketHref={fullBracketHref}>
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
  const { slug } = props
  const data = getDoubleElimDemoData()
  const wbIdx = findCurrentRoundIndex(data.winners)
  const lbIdx = data.losers.length ? findCurrentRoundIndex(data.losers) : -1
  const wbAtFinal = wbIdx === data.winners.length - 1
  const lbAtFinal = lbIdx === -1 || lbIdx === data.losers.length - 1
  const gfReached = wbAtFinal && lbAtFinal && isDone(data.winners[wbIdx]?.matches[0])

  return (
    <PanelShell fullBracketHref={`/tournament/${slug}/bracket/doubleElimination`}>
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