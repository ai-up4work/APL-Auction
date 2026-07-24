// File: components/tournament/BracketPreviewPanel.tsx
"use client"

import { useLayoutEffect, useRef, useState } from "react"
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
import { hasMatchDetail } from "@/data/tournament-data"

/* ------------------------------------------------------------------ */
/*  This panel can render TWO kinds of data:                            */
/*                                                                       */
/*  1. REAL per-tournament bracket data, passed in via `bracketRounds`  */
/*     (single-elim) or `doubleElimData` (double-elim) — same shape the */
/*     full-page chart (TournamentBracket / DoubleElimBoard) consumes.  */
/*     Presence of the prop (even as an empty structure) means "this IS */
/*     the real tournament's bracket" — if it's empty, we show an empty */
/*     state rather than silently substituting demo data.               */
/*                                                                       */
/*  2. DEMO data (generated internally, 32-team bracket) — used ONLY    */
/*     when the real-data prop is omitted entirely (undefined). This is */
/*     what keeps older/showcase tournaments (that haven't been wired   */
/*     up with real bracket data yet) looking populated instead of      */
/*     empty.                                                            */
/*                                                                       */
/*  `format` says which chart TYPE to render; `slug` builds the "Full   */
/*  bracket" link AND the per-match "View match" links (only real,      */
/*  demo matches never link anywhere since hasMatchDetail() won't match */
/*  their synthetic ids).                                               */
/* ------------------------------------------------------------------ */

type BracketPreviewProps =
  | { format: "single"; slug: string; bracketRounds?: Round[] }
  | { format: "double"; slug: string; doubleElimData?: DoubleElimData }

function isDone(m: MatchNode) {
  return m.status === "completed"
}

/**
 * Picks the 2 rounds to preview out of a single progression (winners
 * array, losers array, or a single-elim `rounds` array): the current
 * "in progress" round and the one after it.
 *
 * "Current" = the first round that still has an unfinished match. If
 * every round is done (bracket fully resolved) OR the first unfinished
 * round IS the last round, there's no "next" round to pair it with —
 * in both of those cases we fall back to showing the LAST TWO rounds
 * instead (e.g. Semis + Final), so the preview never collapses down to
 * a single lonely card in an otherwise-empty two-column grid.
 *
 * Clamped generically (not hard-coded to "semis") so it also holds up
 * for a bracket with only 1-2 rounds total.
 */
function getPreviewRounds(rounds: Round[]): Round[] {
  if (rounds.length === 0) return []
  if (rounds.length <= 2) return rounds

  const idx = rounds.findIndex((r) => r.matches.some((m) => !isDone(m)))
  const curIdx = idx === -1 ? rounds.length - 1 : idx
  const startIdx = Math.min(curIdx, rounds.length - 2)
  return rounds.slice(startIdx, startIdx + 2)
}

/* ------------------------------------------------------------------ */
/*  Demo data generation — mirrors the singleElimination /              */
/*  doubleElimination full-chart pages exactly, so the preview is a    */
/*  slice of the same bracket shape (32 teams), not a separate one.    */
/*  Cached at module scope so re-renders of this panel (or multiple    */
/*  tabs on the same tournament page) don't regenerate/re-randomize.   */
/*  Only ever called when the caller passed NO real data at all.       */
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
/*  Connector geometry — same "elbow entering the target's top/bottom  */
/*  edge" shape TournamentBracket's non-final rounds use, copied       */
/*  locally since it isn't exported from that file.                    */
/* ------------------------------------------------------------------ */

function topEntryPath(x1: number, y1: number, x2: number, y2: number, radius = 10): string {
  if (Math.abs(x2 - x1) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`
  const dir = y2 > y1 ? 1 : -1
  const sign = x2 > x1 ? 1 : -1
  const r = Math.max(0, Math.min(radius, Math.abs(x2 - x1), Math.abs(y2 - y1)))
  return `M ${x1} ${y1} L ${x2 - r * sign} ${y1} Q ${x2} ${y1} ${x2} ${y1 + r * dir} L ${x2} ${y2}`
}

interface ConnectorPath {
  id: string
  d: string
}

/**
 * Drives a single left/right round pair: measures the LEFT column's
 * actual rendered card centers, positions each RIGHT column match at
 * the average of its feeders' centers (so a Final sits exactly at the
 * midpoint between its two Semifinal cards, not wherever normal flow
 * happens to place it), and derives the connector line between them.
 *
 * This mirrors computeRowCenters (DoubleElimBoard) / 
 * computeCentersFromLeaves (TournamentBracket) — just scoped to one
 * round pair instead of a whole bracket's worth of rounds.
 */
function useRoundPairLayout(leftRound: Round | undefined, rightRound: Round | undefined) {
  const containerRef = useRef<HTMLDivElement>(null)
  const leftColRef = useRef<HTMLDivElement>(null)
  const cardEls = useRef<Record<string, HTMLDivElement | null>>({})
  const refCache = useRef<Record<string, (el: HTMLDivElement | null) => void>>({})

  const [centerY, setCenterY] = useState<Record<string, number>>({})
  const [colHeight, setColHeight] = useState(0)
  const [paths, setPaths] = useState<ConnectorPath[]>([])
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 })

  function getCardRef(id: string) {
    if (!refCache.current[id]) {
      refCache.current[id] = (el: HTMLDivElement | null) => {
        cardEls.current[id] = el
      }
    }
    return refCache.current[id]
  }

  // Pass 1: measure the left column's cards, compute each right-column
  // match's center as the average of its feeders — same idea as
  // computeRowCenters, just for exactly one pair of rounds.
  useLayoutEffect(() => {
    function recompute() {
      const leftColEl = leftColRef.current
      if (!leftColEl || !leftRound) return
      const leftColRect = leftColEl.getBoundingClientRect()

      const leftCenters: Record<string, number> = {}
      for (const m of leftRound.matches) {
        const el = cardEls.current[m.id]
        if (!el) return
        const r = el.getBoundingClientRect()
        if (r.height === 0) return
        leftCenters[m.id] = r.top - leftColRect.top + r.height / 2
      }

      const nextCenterY: Record<string, number> = { ...leftCenters }
      if (rightRound) {
        for (const m of rightRound.matches) {
          const feederYs = [m.aFrom, m.bFrom]
            .filter((id): id is string => !!id && leftCenters[id] !== undefined)
            .map((id) => leftCenters[id])
          nextCenterY[m.id] = feederYs.length
            ? feederYs.reduce((a, b) => a + b, 0) / feederYs.length
            : leftColEl.scrollHeight / 2
        }
      }
      setCenterY(nextCenterY)
      if (Math.abs(leftColEl.scrollHeight - colHeight) > 1) setColHeight(leftColEl.scrollHeight)
    }
    recompute()
    const raf = requestAnimationFrame(recompute)
    const ro = new ResizeObserver(recompute)
    if (leftColRef.current) ro.observe(leftColRef.current)
    window.addEventListener("resize", recompute)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener("resize", recompute)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftRound, rightRound])

  // Pass 2: once the right column's cards are actually rendered at
  // those computed centers, measure real rects and draw the connector
  // between each feeder and its target.
  useLayoutEffect(() => {
    function recomputeConnectors() {
      const containerEl = containerRef.current
      if (!containerEl || !rightRound) {
        setPaths([])
        return
      }
      const containerRect = containerEl.getBoundingClientRect()
      if (containerRect.width === 0) return
      setSvgSize({ w: containerRect.width, h: containerRect.height })

      const next: ConnectorPath[] = []
      for (const match of rightRound.matches) {
        ;(["aFrom", "bFrom"] as const).forEach((key, slotIdx) => {
          const feederId = match[key]
          if (!feederId) return
          const sourceEl = cardEls.current[feederId]
          const targetEl = cardEls.current[match.id]
          if (!sourceEl || !targetEl) return
          const sRect = sourceEl.getBoundingClientRect()
          const tRect = targetEl.getBoundingClientRect()
          if (sRect.width === 0 || tRect.width === 0) return

          const startX = sRect.right - containerRect.left
          const startY = sRect.top + sRect.height / 2 - containerRect.top
          const endX = tRect.left - containerRect.left
          const endY = (slotIdx === 0 ? tRect.top : tRect.bottom) - containerRect.top

          next.push({ id: `${match.id}-${slotIdx === 0 ? "A" : "B"}`, d: topEntryPath(startX, startY, endX, endY) })
        })
      }
      setPaths(next)
    }
    recomputeConnectors()
    const raf = requestAnimationFrame(recomputeConnectors)
    const ro = new ResizeObserver(recomputeConnectors)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerY, colHeight])

  return { containerRef, leftColRef, getCardRef, centerY, colHeight, paths, svgSize }
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

/**
 * `slug` is optional and purely additive: when present AND the match
 * has a real MatchDetail entry (hasMatchDetail), the card becomes a
 * clickable link to the full match page — same behavior the legacy
 * flat BracketPanel had. Demo matches never match a real id, so they
 * naturally stay non-interactive without any extra checks.
 */
function MiniMatchCard({
  match,
  cardRef,
  slug,
}: {
  match: MatchNode
  cardRef?: (el: HTMLDivElement | null) => void
  slug?: string
}) {
  const linkable = !!slug && hasMatchDetail(match.id)

  const card = (
    <div
      ref={cardRef}
      className={`border border-gold/10 rounded-md p-3 bg-white/[0.02] transition-all ${
        linkable ? "hover:border-gold/60 hover:bg-white/[0.04] cursor-pointer" : ""
      }`}
    >
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
      {linkable && (
        <p className="text-gold text-[9px] uppercase tracking-widest font-cinzel mt-2 text-right">
          View match →
        </p>
      )}
    </div>
  )

  return linkable ? (
    <Link href={`/tournaments/${slug}/match/${match.id}`} className="block">
      {card}
    </Link>
  ) : (
    card
  )
}

/**
 * Renders one round on its own (used when there's only a single round
 * to preview — no feeder pairing/connectors needed).
 */
function SingleColumn({ round, slug }: { round: Round; slug?: string }) {
  return (
    <div>
      <p className="text-gray-400 text-[10px] uppercase tracking-widest font-cinzel mb-2">{round.name}</p>
      <div className="space-y-2">
        {round.matches.map((m) => (
          <MiniMatchCard key={m.id} match={m} slug={slug} />
        ))}
      </div>
    </div>
  )
}

/**
 * Renders a left/right round pair with the right column's matches
 * pinned to the true vertical midpoint of their feeders, connected by
 * real measured lines — the mini version of what DoubleElimBoard and
 * TournamentBracket do for a full bracket.
 */
function ConnectedRoundPair({ rounds, slug }: { rounds: Round[]; slug?: string }) {
  const leftRound = rounds[0]
  const rightRound = rounds[1]
  const { containerRef, leftColRef, getCardRef, centerY, colHeight, paths, svgSize } = useRoundPairLayout(
    leftRound,
    rightRound
  )

  if (!leftRound) return null
  if (!rightRound) return <SingleColumn round={leftRound} slug={slug} />

  return (
    <div
      ref={containerRef}
      className="relative grid grid-cols-1 sm:grid-cols-2 gap-10 min-w-[480px] sm:min-w-0"
    >
      {/* Left column — normal flow, this is the measurement baseline */}
      <div>
        <p className="text-gray-400 text-[10px] uppercase tracking-widest font-cinzel mb-2">{leftRound.name}</p>
        <div ref={leftColRef} className="flex flex-col gap-6">
          {leftRound.matches.map((m) => (
            <div key={m.id}>
              <MiniMatchCard match={m} cardRef={getCardRef(m.id)} slug={slug} />
            </div>
          ))}
        </div>
      </div>

      {/* Right column — each match absolutely positioned at the
          midpoint of its feeders' measured centers. The wrapper below
          the label is given the SAME height as the left column
          (colHeight), so its own top edge lines up with leftColRef's
          top edge — meaning centerY values (measured relative to
          leftColRef) land in the right place here too, with no extra
          offset math needed. */}
      <div>
        <p className="text-gray-400 text-[10px] uppercase tracking-widest font-cinzel mb-2">{rightRound.name}</p>
        <div className="relative" style={{ minHeight: colHeight || undefined }}>
          {rightRound.matches.map((m) => (
            <div
              key={m.id}
              ref={getCardRef(m.id)}
              className="absolute left-0 right-0"
              style={{ top: centerY[m.id] ?? 0, transform: "translateY(-50%)" }}
            >
              <MiniMatchCard match={m} slug={slug} />
            </div>
          ))}
        </div>
      </div>

      {/* Connector lines — brighter/thicker than a faint border color
          so they actually read against the dark card background, and
          sized to the container's real pixel dimensions (not "100%")
          so the path coordinates, which are computed in pixels, always
          line up with what's drawn. */}
      {svgSize.w > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none hidden sm:block"
          width={svgSize.w}
          height={svgSize.h}
          viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
        >
          {paths.map((p) => (
            <path
              key={p.id}
              d={p.d}
              fill="none"
              stroke="var(--color-theme-orange, #c9971f)"
              strokeWidth={2}
              strokeOpacity={0.55}
              strokeLinecap="round"
            />
          ))}
        </svg>
      )}
    </div>
  )
}

/**
 * Shown in place of the bracket preview when real per-tournament data
 * was explicitly provided (the prop wasn't omitted) but is currently
 * empty — e.g. a tournament with bracketFormat set but no matches
 * scheduled yet. Distinct from the demo fallback: an empty real
 * bracket should look empty, not get backfilled with fake teams.
 */
function EmptyBracketState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
      <div className="h-10 w-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
        <Network className="h-4 w-4 text-gold/50" />
      </div>
      <p className="text-gray-400 text-sm max-w-xs">
        The bracket hasn't been set up yet. Once matches are scheduled, they'll appear here.
      </p>
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
    // h-full + flex-col here, paired with `lg:items-stretch` on the row
    // that holds this panel + the sidebar (see TournamentDetailClient),
    // is what makes this card grow to match the sidebar's height instead
    // of shrinking down to hug just a couple of match cards. `flex-1` on
    // the content wrapper below then centers a short preview vertically
    // in whatever space is left, rather than leaving dead space at the
    // bottom.
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8 h-full flex flex-col overflow-x-auto">
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
      <div className="flex-1 flex flex-col justify-center">{children}</div>
    </div>
  )
}

export default function BracketPreviewPanel(props: BracketPreviewProps) {
  if (props.format === "single") {
    const { slug, bracketRounds } = props
    // Presence of the prop (not its length) decides real-vs-demo: an
    // explicitly-passed empty array means "this tournament really has
    // no bracket yet," which should render an empty state, NOT fall
    // back to random demo teams. Omitting the prop entirely is what
    // opts a tournament into the demo bracket.
    const isRealData = bracketRounds !== undefined
    const rounds = isRealData ? bracketRounds! : getSingleElimDemoRounds()
    const visible = getPreviewRounds(rounds)
    const fullBracketHref = `/tournaments/${slug}/bracket`

    return (
      <PanelShell fullBracketHref={fullBracketHref}>
        {visible.length > 0 ? <ConnectedRoundPair rounds={visible} slug={slug} /> : <EmptyBracketState />}
      </PanelShell>
    )
  }

  // Double elimination: winners and losers progress on independent
  // clocks, so each gets its own current+next pair via getPreviewRounds
  // rather than sharing one index, and its own independent
  // measurement/connector pass via ConnectedRoundPair. Grand Final
  // shows once it actually has both teams filled in — simpler and more
  // robust than inferring "reached the final" from WB/LB round indices,
  // and it naturally covers the fully-finished-tournament case too. It's
  // shown without a connector into it, since its real feeders (the
  // WB/LB finals) aren't necessarily the same matches currently visible
  // above.
  const { slug, doubleElimData } = props
  const isRealData = doubleElimData !== undefined
  const data = isRealData ? doubleElimData! : getDoubleElimDemoData()
  const wbVisible = getPreviewRounds(data.winners)
  const lbVisible = data.losers.length ? getPreviewRounds(data.losers) : []
  const gfReached = !!data.grandFinal.teamA && !!data.grandFinal.teamB
  const isEmpty = wbVisible.length === 0 && lbVisible.length === 0 && !gfReached

  return (
    <PanelShell fullBracketHref={`/tournaments/${slug}/bracket/`}>
      {isEmpty ? (
        <EmptyBracketState />
      ) : (
        <div className="space-y-6 min-w-[280px]">
          {wbVisible.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-widest font-cinzel mb-2">
                <Trophy className="h-3 w-3" /> Winners bracket
              </p>
              <ConnectedRoundPair rounds={wbVisible} slug={slug} />
            </div>
          )}
          {lbVisible.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-orange-400 text-[10px] font-bold uppercase tracking-widest font-cinzel mb-2">
                <RotateCcw className="h-3 w-3" /> Losers bracket
              </p>
              <ConnectedRoundPair rounds={lbVisible} slug={slug} />
            </div>
          )}
          {gfReached && (
            <div>
              <p className="flex items-center gap-1.5 text-gold text-[10px] font-bold uppercase tracking-widest font-cinzel mb-2">
                <Award className="h-3 w-3" /> Grand final
              </p>
              <MiniMatchCard match={data.grandFinal} slug={slug} />
            </div>
          )}
        </div>
      )}
    </PanelShell>
  )
}