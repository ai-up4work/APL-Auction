// app/components/tournament/match-detail-client.tsx
"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Radio, Shield, Lock, Clock3, RefreshCw, Users, CircleDot, Trophy } from "lucide-react"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { useLiveMatch } from "@/hooks/use-live-match"
import { useBallCommentary } from "@/hooks/use-ball-commentary"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"
import SectionDivider from "@/components/section-divider"
import { pageStyles } from "@/data/site-data"
import { MatchEndToast } from "@/components/tournament/match-end-toast"
import { safeColor, ensureDistinctColors } from "@/lib/team-colors"
import type {
  MatchDetail,
  BattingRow,
  BowlingRow,
  MatchSquad,
  InningsComplete,
  PlayerStatRow,
  BowlingStatRow,
} from "@/data/match-data"
import type { OverRow } from "./match-graphs"
import MatchTabs, { type Tab } from "./match-tabs"

interface MatchDetailClientProps {
  match: MatchDetail
  /** Undefined for standalone/friendly matches with no tournament link. */
  tournamentSlug?: string
}

const images = {
  bg: "https://www.hindustantimes.com/ht-img/img/2024/09/30/1600x900/Cricket_3_1727677442716_1727677564058.jpg",
  tournament: "/valiant-league-logo.png",
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function econTone(econ: string | number): string {
  const value = typeof econ === "number" ? econ : parseFloat(econ)
  if (Number.isNaN(value)) return "text-gold"
  if (value < 6) return "text-emerald-400"
  if (value > 9) return "text-red-400"
  return "text-gold"
}

function LogoSlot({ src, alt }: { src?: string; alt: string }) {
  return (
    <div className="relative h-32 w-32 rounded-2xl mb-3 flex items-center justify-center overflow-hidden shrink-0">
      {src ? (
        <Image src={src} alt={alt} fill className="object-cover" sizes="96px" />
      ) : (
        <span className="text-[9px] text-gray-500 font-cinzel uppercase text-center px-2">
          Image
          <br />
          not available
        </span>
      )}
    </div>
  )
}

function SetupField({
  icon,
  value,
  fallback = "Not set",
}: {
  icon?: React.ReactNode
  value: string
  fallback?: string
}) {
  const isSet = value.trim().length > 0
  return (
    <span
      className={`flex items-center gap-2 ${
        isSet ? "" : "border border-dashed border-gray-600 rounded-full px-3 py-1 text-gray-500 italic"
      }`}
    >
      {icon}
      {isSet ? value : fallback}
    </span>
  )
}

// FIXED — previously assumed "innings1 always belongs to teamA, innings2
// always belongs to teamB", which only holds when teamA wins the toss
// and bats first. `innings1`/`innings2Final` are keyed purely by which
// innings was bowled first, not by team identity — see the INNINGS →
// PHYSICAL TEAM MAPPING note in data/match-data.ts and the doc comment
// on MatchDetail.inningsOneBattingTeam. This is exactly what was
// causing this page and the overlay admin console (which always
// derived batting order from the toss) to compute two different
// winners for the same match. Now resolves the physical team ("a" =
// teamA, "b" = teamB) via match.inningsOneBattingTeam instead of
// assuming innings order === team order.
function determineWinner(match: MatchDetail): "a" | "b" | "tie" {
  const totalFirst = match.innings1.total
  const totalSecond = match.innings2Final.total
  if (totalFirst === totalSecond) return "tie"

  const secondInningsWon = totalSecond > totalFirst
  const firstInningsIsTeamA = match.inningsOneBattingTeam === "teamA"

  if (secondInningsWon) return firstInningsIsTeamA ? "b" : "a"
  return firstInningsIsTeamA ? "a" : "b"
}

function currentPartnership(
  rows: BattingRow[],
): { runs: number; balls: number; fours: number; sixes: number; batters: BattingRow[] } | null {
  const notOut = rows.filter((b) => b.notOut)
  if (notOut.length === 0) return null

  // Only the two most recent not-out entries are actually at the crease —
  // a retired-hurt batter earlier in the innings can also carry
  // notOut: true without currently batting, so don't include everyone
  // flagged not-out, just the latest pair.
  const current = notOut.slice(-2)

  return {
    runs: current.reduce((s, b) => s + b.runs, 0),
    balls: current.reduce((s, b) => s + b.balls, 0),
    fours: current.reduce((s, b) => s + b.fours, 0),
    sixes: current.reduce((s, b) => s + b.sixes, 0),
    batters: current,
  }
}

function currentBowler(rows: BowlingRow[]): BowlingRow | null {
  return rows.length > 0 ? rows[rows.length - 1] : null
}

function buildMatchStats(
  match: MatchDetail,
  live: boolean,
): { battingStats: PlayerStatRow[]; bowlingStats: BowlingStatRow[] } {
  const innings2Batting = live ? match.innings2Partial.batting : match.innings2Final.batting
  const innings2Bowling = live ? match.innings2Partial.bowling : match.innings2Final.bowling

  const allBatting: BattingRow[] = [...match.innings1.batting, ...innings2Batting]
  const allBowling: BowlingRow[] = [...match.innings1.bowling, ...innings2Bowling]

  const battingStats: PlayerStatRow[] = allBatting.map((b) => ({
    player: b.name,
    matches: 1,
    inns: 1,
    runs: b.runs,
    avg: b.notOut ? null : b.runs,
    sr: b.balls > 0 ? (b.runs / b.balls) * 100 : 0,
    fours: b.fours,
    sixes: b.sixes,
  }))

  const bowlingStats: BowlingStatRow[] = allBowling.map((b) => {
    const [oversWhole, ballsPart] = b.overs.split(".").map(Number)
    const oversFaced = (oversWhole || 0) + (ballsPart || 0) / 6
    const econVal = parseFloat(b.econ)
    return {
      player: b.name,
      matches: 1,
      inns: 1,
      wkts: b.wkts,
      avg: b.wkts > 0 ? b.runs / b.wkts : null,
      econ: Number.isFinite(econVal) ? econVal : oversFaced > 0 ? b.runs / oversFaced : 0,
      best: `${b.wkts}/${b.runs}`,
    }
  })

  return { battingStats, bowlingStats }
}

function buildPlayerImageMap(match: MatchDetail): Record<string, string> {
  const map: Record<string, string> = {}
  for (const squad of match.squads) {
    for (const p of squad.players) {
      if (p.img) map[p.name] = p.img
    }
  }
  return map
}

function WinProbabilityBar({
  winProb,
  teamAShort,
  teamBShort,
  teamAColor,
  teamBColor,
  completed,
}: {
  winProb: { a: number; b: number } | undefined
  teamAShort: string
  teamBShort: string
  teamAColor: string
  teamBColor: string
  completed?: boolean
}) {
  if (!winProb) return null
  const tied = completed && winProb.a === winProb.b
  return (
    <div className="mt-4 pt-4 border-t border-gold/10">
      <p className="text-gray-500 text-[10px] uppercase tracking-widest font-cinzel mb-2">
        {completed ? "Final" : "Win Probability"}
      </p>
      <div className="flex h-2 rounded-full overflow-hidden bg-white/10">
        <div
          className="transition-all duration-700"
          style={{ width: `${winProb.a}%`, background: teamAColor }}
        />
        <div
          className="transition-all duration-700"
          style={{ width: `${winProb.b}%`, background: teamBColor }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs font-cinzel">
        <span className="font-bold" style={{ color: teamAColor }}>
          {teamAShort} {winProb.a}%
        </span>
        <span className="font-bold" style={{ color: teamBColor }}>
          {teamBShort} {winProb.b}%
        </span>
      </div>
      {tied && <p className="text-gray-500 text-[10.5px] text-center mt-2 font-cinzel">Match Tied</p>}
    </div>
  )
}

// ── Match-complete hero banner — shown at the top of the match card once
// status === "completed", REPLACING the innings score grid, CRR/RRR row,
// and the WinProbabilityBar entirely (rather than sitting above them) —
// once a match is done, "DEL 171/3" / "RAV 172/2" / "CRR 8.82" / a
// 0%-100% win-probability split are all redundant with (or actively
// confusing next to) a clear winner banner, so none of that renders for
// completed matches anymore. The compact final-score line inside this
// banner is the only score summary shown. Surfaces the winning team's
// logo in a glowing gradient ring (same broadcast-overlay language used
// on the admin scoring console's MatchOverScreen), the winner headline,
// and the result note as a pill badge.
function MatchCompleteBanner({
  match,
  winner,
  teamAColor,
  teamBColor,
}: {
  match: MatchDetail
  winner: "a" | "b" | "tie" | null
  teamAColor: string
  teamBColor: string
}) {
  if (!winner) return null
  const isTie = winner === "tie"
  const winningTeam = winner === "a" ? match.teamA : winner === "b" ? match.teamB : null
  const accent = isTie ? "#F5A623" : winner === "a" ? teamAColor : teamBColor

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 sm:p-8 text-center"
      style={
        {
          containerType: "inline-size",
          background: `radial-gradient(120% 100% at 50% 0%, ${accent}22 0%, ${accent}08 45%, transparent 70%)`,
        } as React.CSSProperties
      }
    >
      <span
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}80, transparent)` }}
      />

      <div className="flex items-center justify-center gap-2 mb-4 sm:mb-5">
        <Trophy className="h-3.5 w-3.5" style={{ color: accent }} />
        <span
          className="text-[10px] uppercase tracking-[0.3em] font-cinzel font-bold"
          style={{ color: accent }}
        >
          Match Complete
        </span>
      </div>

      {/* Winner badge — logo in a gradient ring with a soft glow behind
          it, matching the broadcast-overlay treatment used elsewhere
          (see MatchOverScreen on the admin scoring console). */}
      <div
        className="relative mx-auto mb-4 sm:mb-5 flex items-center justify-center"
        style={{ width: "clamp(96px, 24cqi, 132px)", height: "clamp(96px, 24cqi, 132px)" }}
      >
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: "clamp(150px, 38cqi, 210px)",
            height: "clamp(150px, 38cqi, 210px)",
            background: `radial-gradient(circle, ${accent}35 0%, ${accent}10 45%, transparent 72%)`,
            filter: "blur(2px)",
          }}
        />
        <div
          className="relative h-full w-full rounded-full"
          style={{
            padding: "clamp(2px, 0.6cqi, 4px)",
            background: `linear-gradient(135deg, ${accent}, ${accent}55 45%, ${accent}CC)`,
            boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px ${accent}30`,
          }}
        >
          <div className="h-full w-full rounded-full bg-black/80 border border-white/10 flex items-center justify-center overflow-hidden">
            {winningTeam?.logo ? (
              <div className="relative h-full w-full">
                <Image
                  src={winningTeam.logo}
                  alt={`${winningTeam.name} logo`}
                  fill
                  className="object-contain p-2.5"
                  sizes="132px"
                />
              </div>
            ) : isTie ? (
              <span style={{ fontSize: "clamp(28px, 7cqi, 40px)" }}>🤝</span>
            ) : (
              <Trophy style={{ color: accent, width: "clamp(32px, 8cqi, 44px)", height: "clamp(32px, 8cqi, 44px)" }} />
            )}
          </div>
        </div>
      </div>

      <h3 className="font-cinzel font-bold text-white mb-1" style={{ fontSize: "clamp(18px, 4.4cqi, 26px)" }}>
        {isTie ? "It's a Tie" : winningTeam ? `${winningTeam.name} Win` : "Match Complete"}
      </h3>

      {!isTie && match.resultNote && (
        <p
          className="inline-block text-xs font-bold font-cinzel uppercase tracking-wide rounded-full px-4 py-1.5 mt-1"
          style={{ background: `${accent}1a`, border: `1px solid ${accent}4d`, color: accent }}
        >
          {match.resultNote}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-5 pt-4 border-t border-white/10 text-xs font-cinzel uppercase tracking-widest text-gray-400">
        <span>
          {match.teamA.short} {match.innings1.total}/{match.innings1.wkts}
          <span className="opacity-60"> ({match.innings1.overs})</span>
        </span>
        <span className="opacity-30 hidden sm:inline">·</span>
        <span>
          {match.teamB.short} {match.innings2Final.total}/{match.innings2Final.wkts}
          <span className="opacity-60"> ({match.innings2Final.overs})</span>
        </span>
      </div>
    </div>
  )
}

function BatterRow({ batter }: { batter: BattingRow }) {
  const sr = batter.balls ? ((batter.runs / batter.balls) * 100).toFixed(0) : "0"
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-7 w-7 rounded-full bg-black/60 border border-gold/20 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-gold font-cinzel">{initials(batter.name)}</span>
        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-black" />
      </div>
      <p className="text-sm text-gray-100 font-medium truncate flex-1 min-w-0">{batter.name}</p>
      <p className="text-sm font-bold font-cinzel text-white shrink-0 tabular-nums">
        {batter.runs}
        <span className="text-gray-500 font-normal">({batter.balls})</span>
      </p>
      <p className="text-[10px] text-gray-600 shrink-0 tabular-nums w-8 text-right">{sr}</p>
    </div>
  )
}

function CurrentPlayStrip({
  partnership,
  bowler,
}: {
  partnership: ReturnType<typeof currentPartnership>
  bowler: BowlingRow | null
}) {
  if (!partnership && !bowler) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      {partnership && (
        <div className="relative rounded-xl border border-gold/15 bg-gradient-to-b from-white/[0.03] to-transparent p-4 min-w-0 overflow-hidden">
          <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          <div className="flex items-center gap-1.5 mb-3">
            <Users className="h-3 w-3 text-gold/60 shrink-0" />
            <p className="text-gold/60 text-[10px] uppercase tracking-[0.2em] font-cinzel">Partnership</p>
          </div>
          <div className="flex items-baseline gap-2 mb-3.5">
            <span className="text-2xl font-bold text-white font-cinzel tabular-nums">{partnership.runs}</span>
            <span className="text-gray-500 text-xs">({partnership.balls} balls)</span>
            <span className="ml-auto text-[10.5px] text-gray-500 tracking-wide">
              {partnership.fours}×4 · {partnership.sixes}×6
            </span>
          </div>
          <div className="space-y-2 pt-3 border-t border-gold/10">
            {partnership.batters.map((b) => (
              <BatterRow key={b.name} batter={b} />
            ))}
          </div>
        </div>
      )}
      {bowler && (
        <div className="relative rounded-xl border border-gold/15 bg-gradient-to-b from-white/[0.03] to-transparent p-4 min-w-0 overflow-hidden">
          <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          <div className="flex items-center gap-1.5 mb-3">
            <CircleDot className="h-3 w-3 text-gold/60 shrink-0" />
            <p className="text-gold/60 text-[10px] uppercase tracking-[0.2em] font-cinzel">Bowling</p>
          </div>
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="h-9 w-9 rounded-full bg-black/60 border border-gold/20 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-gold font-cinzel">{initials(bowler.name)}</span>
            </div>
            <p className="text-sm text-gray-100 font-semibold truncate min-w-0">{bowler.name}</p>
          </div>
          <div className="flex items-center pt-3 border-t border-gold/10 divide-x divide-gold/10">
            <div className="flex-1 text-center">
              <p className="text-base font-bold text-white font-cinzel tabular-nums">{bowler.overs}</p>
              <p className="text-[9px] uppercase tracking-widest text-gray-600 mt-0.5">Overs</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-base font-bold text-white font-cinzel tabular-nums">{bowler.runs}</p>
              <p className="text-[9px] uppercase tracking-widest text-gray-600 mt-0.5">Runs</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-base font-bold text-white font-cinzel tabular-nums">{bowler.wkts}</p>
              <p className="text-[9px] uppercase tracking-widest text-gray-600 mt-0.5">Wkts</p>
            </div>
            <div className="flex-1 text-center">
              <p className={`text-base font-bold font-cinzel tabular-nums ${econTone(bowler.econ)}`}>{bowler.econ}</p>
              <p className="text-[9px] uppercase tracking-widest text-gray-600 mt-0.5">Econ</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MatchDetailClient({ match: initialMatch, tournamentSlug }: MatchDetailClientProps) {
  useScrollTop()
  const router = useRouter()
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("info")
  const [innings, setInnings] = useState<1 | 2>(1)

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }
  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  // ── live state ──
  const { match, isSyncing, justCompleted, clearJustCompleted } = useLiveMatch(initialMatch.id, initialMatch)

  const status = match.matchStatus
  const live = status === "live"
  const completed = status === "completed"
  const started = status !== "not_started"
  const hasBallData = match.hasBallData

  const innings2Started = match.currentInnings === 2 || match.innings2Partial.batting.length > 0

  useEffect(() => {
    setInnings(innings2Started ? 2 : 1)
  }, [tab, innings2Started])

  const runs = live ? currentTotal(match.innings2Partial) : match.innings2Final.total
  const wkts = live ? currentWkts(match.innings2Partial) : match.innings2Final.wkts
  const overLabel = live ? currentOvers(match.innings2Partial) : match.innings2Final.overs

  const need = innings2Started ? match.target - runs : null
  const ballsBowled = (() => {
    const [o, b] = overLabel.split(".").map(Number)
    return (o || 0) * 6 + (b || 0)
  })()
  const oversLimitBalls = 120
  const ballsLeft = oversLimitBalls - ballsBowled
  const crr = ballsBowled > 0 ? (runs / (ballsBowled / 6)).toFixed(2) : "0.00"
  const rrr = innings2Started && live && ballsLeft > 0 && need !== null && need > 0 ? (need / (ballsLeft / 6)).toFixed(2) : null

  const winner = completed ? determineWinner(match) : null
  const winProb = winner
    ? winner === "tie"
      ? { a: 50, b: 50 }
      : winner === "a"
        ? { a: 100, b: 0 }
        : { a: 0, b: 100 }
    : match.winProb

  // NEW — which physical team actually batted in innings1/innings2Final,
  // resolved via match.inningsOneBattingTeam (see data/match-data.ts).
  // Every place below that used to say "match.teamA" for the first
  // innings and "match.teamB" for the second now goes through these
  // instead, so the scoreboard labels always match whichever team
  // genuinely batted in that innings — not a hardcoded assumption.
  const firstInningsTeam = match.inningsOneBattingTeam === "teamB" ? match.teamB : match.teamA
  const secondInningsTeam = match.inningsOneBattingTeam === "teamB" ? match.teamA : match.teamB

  const activeBattingRows = live ? (innings2Started ? match.innings2Partial.batting : match.innings1.batting) : []
  const activeBowlingRows = live ? (innings2Started ? match.innings2Partial.bowling : match.innings1.bowling) : []
  const partnership = live ? currentPartnership(activeBattingRows) : null
  const bowlerNow = live ? currentBowler(activeBowlingRows) : null

  const { battingStats, bowlingStats } = useMemo(() => buildMatchStats(match, live), [match, live])

  const playerImageMap = useMemo(() => buildPlayerImageMap(match), [match.squads])

  // Resolved, guaranteed-distinct team colors — validated by safeColor()
  // then passed through ensureDistinctColors() (both from lib/team-colors)
  // so a same/near-same color collision (from either match_setup or the
  // teams table) never renders as two indistinguishable swatches. Computed
  // once here and passed down through MatchTabs -> MatchGraphs so every
  // chart on the page (win-prob strip, worm, run-rate, partnerships,
  // win-probability graph) agrees on the same resolved pair.
  const [teamAColor, teamBColor] = useMemo(
    () =>
      ensureDistinctColors(
        safeColor(match.teamA.color, "#F5A623"),
        safeColor(match.teamB.color, "#EF4444"),
      ),
    [match.teamA.color, match.teamB.color],
  )

  // NEW — the outer match-summary card's border/glow now reflects the
  // winning team's color once the match is completed, instead of the
  // fixed gold/30 outline used for live/not-started matches. Falls back
  // to the tie gold accent for a tied match. `winner` is now physical
  // team-aware (see determineWinner fix above), so this always lights
  // up the correct team's color.
  const cardAccent = completed ? (winner === "tie" ? "#F5A623" : winner === "a" ? teamAColor : teamBColor) : null

  // ── Groq-generated commentary for the tab currently being viewed. ──
  // Innings + team direction mirror the same logic the Commentary/Overs
  // tabs already use internally: innings 1 = teamA batting / teamB
  // bowling, innings 2 = the reverse. `enabled: live` means generation
  // only fires for the innings actually in progress — completed/older
  // matches just show the phrase-bank fallback via MatchTabs unless you
  // later add a backfill job.
  const commentaryDeliveries =
    innings === 1
      ? match.innings1.deliveries ?? []
      : live
        ? match.innings2Partial.deliveries ?? []
        : match.innings2Final.deliveries ?? []

  const commentaryStriker = partnership?.batters[0]
    ? { name: partnership.batters[0].name, runs: partnership.batters[0].runs, balls: partnership.batters[0].balls }
    : undefined
  const commentaryNonStriker = partnership?.batters[1]
    ? { name: partnership.batters[1].name, runs: partnership.batters[1].runs, balls: partnership.batters[1].balls }
    : undefined
  const commentaryBowler = bowlerNow
    ? { name: bowlerNow.name, overs: bowlerNow.overs, runs: bowlerNow.runs, wkts: bowlerNow.wkts }
    : undefined

  const { getText: getCommentaryText, isGeneratingOver: isCommentaryOverPending } = useBallCommentary({
    matchId: match.id,
    inningsNumber: innings,
    deliveries: commentaryDeliveries,
    teamBatting: innings === 1 ? firstInningsTeam.name : secondInningsTeam.name,
    teamBowling: innings === 1 ? secondInningsTeam.name : firstInningsTeam.name,
    target: match.target,
    scoreState: {
      total: innings === 1 ? match.innings1.total : runs,
      wkts: innings === 1 ? match.innings1.wkts : wkts,
      oversLabel: innings === 1 ? match.innings1.overs : overLabel,
      crr,
      rrr,
    },
    striker: innings === (innings2Started ? 2 : 1) ? commentaryStriker : undefined,
    nonStriker: innings === (innings2Started ? 2 : 1) ? commentaryNonStriker : undefined,
    bowlerFigures: innings === (innings2Started ? 2 : 1) ? commentaryBowler : undefined,
    enabled: live && tab === "commentary",
  })

  const getOverByOverData = (inn: 1 | 2 = innings): OverRow[] => {
    const source: InningsComplete = inn === 1 ? match.innings1 : match.innings2Final
    const liveOverRuns = inn === 2 && live ? partialOverRuns(match.innings2Partial) : null
    const overRuns = liveOverRuns ?? source.overRuns

    const fow = inn === 1 ? match.innings1.fow : inn === 2 && live ? match.innings2Partial.fow : match.innings2Final.fow

    let runningTotal = 0
    let runningWkts = 0
    return overRuns.map((r, idx) => {
      const overNum = idx + 1
      runningTotal += r
      const wicketsThisOver = fow.filter((f) => {
        const [, , oversStr] = f
        const overOfWicket = Math.floor(Number(oversStr))
        return overOfWicket === overNum
      })
      runningWkts += wicketsThisOver.length
      return {
        num: overNum,
        score: `${runningTotal}-${runningWkts}`,
        matchUp: "",
        balls: wicketsThisOver.length > 0 ? Array(wicketsThisOver.length).fill("W") : [],
        totalRuns: r,
      }
    })
  }

  return (
    <main className="overflow-x-hidden max-w-full">
      <style
        dangerouslySetInnerHTML={{
          __html: `${pageStyles}
          body {
            overflow-x: hidden;
            max-width: 100%;
          }`,
        }}
      />


      <SiteHeader
        activeSection={`${match.teamA.name} vs ${match.teamB.name}`}
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      { /* Hero Section */ }
      <section className="relative w-full min-h-[450px] flex items-center justify-center pt-24 pb-12 overflow-hidden bg-black border-b border-gold/20">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-40"
          style={{
            backgroundImage: `url('${match.tournamentLogoUrl || images.bg}')`,
          }}
        >
          <span className="sr-only">Image not available</span>
        </div>

        <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black via-transparent to-transparent opacity-80" />

        <div className="container mx-auto px-4 relative z-10 text-center fade-in flex flex-col items-center mt-10 max-w-full mb-20">

          <div className="flex flex-row items-center justify-center gap-4 md:gap-12 w-full max-w-4xl mx-auto">
            <div className="flex flex-col items-center flex-1 min-w-0 max-w-full">
              <LogoSlot
                src={match.teamA.logo}
                alt={`${match.teamA.name} logo`}
              />
              <h1 className="text-xl md:text-3xl font-bold text-white font-cinzel tracking-wider drop-shadow-md text-center break-words max-w-full">
                {match.teamA.name}
              </h1>
            </div>

            <div className="flex flex-col items-center justify-center shrink-0">
              <span className="text-gold font-cinzel text-xl md:text-4xl font-black drop-shadow-[0_0_8px_rgba(245,166,35,0.5)]">
                VS
              </span>
            </div>

            <div className="flex flex-col items-center flex-1 min-w-0 max-w-full">
              <LogoSlot
                src={match.teamB.logo}
                alt={`${match.teamB.name} logo`}
              />
              <h1 className="text-xl md:text-3xl font-bold text-white font-cinzel tracking-wider drop-shadow-md text-center break-words max-w-full">
                {match.teamB.name}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3 mt-10 text-xs text-gray-200 font-cinzel uppercase tracking-widest bg-black/50 backdrop-blur-md px-6 py-3 rounded-full border border-gold/20 shadow-lg max-w-full">
            <SetupField icon={<MapPin className="h-4 w-4 text-gold shrink-0" />} value={match.venue} fallback="Venue not set" />
            <SetupField
              icon={<Calendar className="h-4 w-4 text-gold shrink-0" />}
              value={[match.date, match.time].filter(Boolean).join(" · ")}
              fallback="Date & time not set"
            />
          </div>

          <div className="mt-6">
            <SetupField
              value={match.toss}
              fallback="Toss not recorded"
            />
          </div>
        </div>
      </section>

      <section className="px-4 relative z-10 -mt-24 md:-mt-24">
        <div className="container mx-auto max-w-3xl">
          <div
            className="bg-black/80 backdrop-blur-xl rounded-lg p-6 mb-8 border"
            style={
              cardAccent
                ? {
                    borderColor: `${cardAccent}55`,
                    boxShadow: `0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px ${cardAccent}20 inset`,
                  }
                : {
                    borderColor: "rgba(245,166,35,0.3)",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                  }
            }
          >
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
              <div className="flex items-center gap-2">
                {status === "live" && (
                  <span className="relative flex items-center gap-1.5 bg-gold text-black text-xs font-bold font-cinzel px-3 py-1.5 rounded-full shadow-[0_0_12px_rgba(245,166,35,0.5)]">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black/40" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-black" />
                    </span>
                    LIVE
                  </span>
                )}
                {status === "completed" && <Badge className="bg-gray-600 hover:bg-gray-700">Completed</Badge>}
                {status === "not_started" && (
                  <span className="flex items-center gap-1.5 bg-amber-500/15 text-amber-400 text-xs font-bold font-cinzel px-3 py-1.5 rounded-full border border-amber-500/30">
                    <Clock3 className="h-3 w-3" />
                    Not Started
                  </span>
                )}
              </div>

              {isSyncing && (
                <span className="flex items-center gap-1.5 text-gray-500 text-[10px] uppercase tracking-widest font-cinzel">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Syncing
                </span>
              )}
            </div>

            {status === "not_started" ? (
              <div className="text-center py-6">
                <p className="text-gray-300 font-semibold mb-1">This match hasn't started yet.</p>
                <p className="text-gray-500 text-sm mb-4">
                  Scorecards, overs, and live stats will appear here once ball-by-ball data starts coming in.
                </p>
              </div>
            ) : completed ? (
              // Completed matches show ONLY the banner — the innings
              // score grid, CRR/RRR row, and WinProbabilityBar (which
              // read like "DEL 171/3", "CRR 8.82", "DEL 0% / RAV 100%")
              // are redundant once there's a clear winner and are no
              // longer rendered here at all.
              <MatchCompleteBanner
                match={match}
                winner={winner}
                teamAColor={teamAColor}
                teamBColor={teamBColor}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="rounded-lg p-4 border border-gold/10 bg-white/[0.02] min-w-0">
                    <span className="text-white font-bold font-cinzel">{firstInningsTeam.short}</span>
                    <p className="text-2xl font-bold text-white font-cinzel mt-1">
                      {match.innings1.total}/{match.innings1.wkts}
                      <span className="text-sm text-gray-400 font-normal ml-2">({match.innings1.overs} ov)</span>
                    </p>
                  </div>
                  <div
                    className={`rounded-lg p-4 border min-w-0 ${
                      innings2Started && live
                        ? "border-gold shadow-[0_0_15px_rgba(245,166,35,0.1)] bg-gold/5"
                        : "border-gold/10 bg-white/[0.02]"
                    }`}
                  >
                    <span className="text-white font-bold font-cinzel">{secondInningsTeam.short}</span>
                    {innings2Started ? (
                      <p className="text-2xl font-bold text-white font-cinzel mt-1">
                        {runs}/{wkts}
                        <span className="text-sm text-gray-400 font-normal ml-2">({overLabel} ov)</span>
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 italic mt-2">Yet to bat</p>
                    )}
                  </div>
                </div>

                {live && <CurrentPlayStrip partnership={partnership} bowler={bowlerNow} />}

                <p className="text-white font-semibold mb-3 border-l-2 border-gold pl-3 text-sm break-words">
                  {!innings2Started
                    ? `${firstInningsTeam.short} batting — 1st innings in progress.`
                    : `${secondInningsTeam.short} need ${need} run${need === 1 ? "" : "s"} from ${ballsLeft} ball${ballsLeft === 1 ? "" : "s"}`}
                </p>

                <div className="flex flex-wrap gap-4 text-sm">
                  {innings2Started && (
                    <div className="bg-gold/10 border border-gold/20 rounded-md px-4 py-2">
                      <span className="text-gray-400">CRR </span>
                      <span className="text-gold font-bold font-cinzel">{crr}</span>
                    </div>
                  )}
                  {rrr && (
                    <div className="bg-gold/10 border border-gold/20 rounded-md px-4 py-2">
                      <span className="text-gray-400">RRR </span>
                      <span className="text-gold font-bold font-cinzel">{rrr}</span>
                    </div>
                  )}
                </div>

                <WinProbabilityBar
                  winProb={winProb}
                  teamAShort={match.teamA.short}
                  teamBShort={match.teamB.short}
                  teamAColor={teamAColor}
                  teamBColor={teamBColor}
                  completed={completed}
                />
              </>
            )}
          </div>
        </div>
      </section>

      <section className="px-4 relative z-10">
        <div className="container mx-auto max-w-3xl">
          {!started ? (
            <div></div>
          ) : (
            <MatchTabs
              match={match}
              status={status}
              live={live}
              completed={completed}
              hasBallData={hasBallData}
              innings2Started={innings2Started}
              runs={runs}
              wkts={wkts}
              overLabel={overLabel}
              winProb={winProb}
              tab={tab}
              setTab={setTab}
              innings={innings}
              setInnings={setInnings}
              getOverByOverData={getOverByOverData}
              overRunsB={live ? partialOverRuns(match.innings2Partial) : match.innings2Final.overRuns}
              liveScriptLength={match.liveScript.length}
              battingStats={battingStats}
              bowlingStats={bowlingStats}
              playerImageMap={playerImageMap}
              getCommentaryText={getCommentaryText}
              isCommentaryOverPending={isCommentaryOverPending}
              teamAColor={teamAColor}
              teamBColor={teamBColor}
              firstInningsTeam={firstInningsTeam}
              secondInningsTeam={secondInningsTeam}
            />
          )}
        </div>
      </section>

      <MatchEndToast
        show={justCompleted}
        onDismiss={clearJustCompleted}
        teamAName={match.teamA.name}
        teamBName={match.teamB.name}
        resultNote={match.resultNote}
      />
    </main>
  )
}

// ─────────────────────────────────────────────────────────────
// Live-partial helpers
// ─────────────────────────────────────────────────────────────
function currentTotal(partial: MatchDetail["innings2Partial"]): number {
  return partial.batting.reduce((sum, b) => sum + b.runs, 0)
}
function currentWkts(partial: MatchDetail["innings2Partial"]): number {
  return partial.fow.length
}
function currentOvers(partial: MatchDetail["innings2Partial"]): string {
  const legalBalls = partial.bowling.reduce((sum, b) => {
    const [o, ball] = b.overs.split(".").map(Number)
    return sum + o * 6 + ball
  }, 0)
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`
}
function partialOverRuns(partial: MatchDetail["innings2Partial"]): number[] {
  return partial.overRunsAtStart
}