"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Radio, Shield, Lock, Clock3, RefreshCw, Users, CircleDot } from "lucide-react"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { useLiveMatch } from "@/hooks/use-live-match"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"
import SectionDivider from "@/components/section-divider"
import { pageStyles } from "@/data/site-data"
import type {
  MatchDetail,
  BattingRow,
  BowlingRow,
  MatchSquad,
  InningsComplete,
} from "@/data/match-data"
import type { OverRow } from "./match-graphs"
import MatchTabs from "./match-tabs"

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

/** Rough economy-rate read so the bowler card can give a quiet colour
 *  cue (going for runs vs. keeping it tight) without a legend — under 6
 *  reads as controlled, 6–9 as par, above 9 as expensive. Falls back to
 *  the neutral gold tone if the figure can't be parsed. */
function econTone(econ: string | number): string {
  const value = typeof econ === "number" ? econ : parseFloat(econ)
  if (Number.isNaN(value)) return "text-gold"
  if (value < 6) return "text-emerald-400"
  if (value > 9) return "text-red-400"
  return "text-gold"
}

// Small helper so every logo slot (team A, team B, tournament) renders the
// same way: a real <Image> when a path is supplied, and a graceful
// "Image not available" placeholder otherwise.
function LogoSlot({ src, alt }: { src?: string; alt: string }) {
  return (
    <div className="relative h-32 w-32 bg-gradient-to-b from-white/10 to-black/40 backdrop-blur-md rounded-2xl border border-gold/30 mb-3 flex items-center justify-center overflow-hidden shrink-0 shadow-[0_0_20px_rgba(245,166,35,0.15)]">
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

/** A field that may not have been filled in yet by whoever set up the
 *  match. Rather than hiding it entirely (which hides the fact that it's
 *  missing), we always render the label and show an explicit "Not set"
 *  placeholder in its place, styled distinctly (dashed border, muted
 *  text) so it reads as "this needs attention" rather than as real data. */
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

/** Who actually won, based on final totals — independent of whatever the
 *  live win-probability model last happened to output. Used once the
 *  match is completed to snap the probability display to a clean,
 *  resolved state rather than showing a stale mid-chase percentage. */
function determineWinner(match: MatchDetail): "a" | "b" | "tie" {
  const totalA = match.innings1.total
  const totalB = match.innings2Final.total
  if (totalA === totalB) return "tie"
  return totalB > totalA ? "b" : "a"
}

/** Basic hex-color sanity check — mirrors the one in match-graphs.tsx,
 *  so an empty string or malformed color in match_setup falls back to
 *  the original gold/red defaults instead of breaking the bar. */
function safeColor(value: string | undefined, fallback: string): string {
  if (value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())) return value.trim()
  return fallback
}

/** Aggregates the batters currently not-out into a single "current
 *  partnership" figure — runs, balls, and boundary counts summed
 *  across both. Each BattingRow's own stats already only cover the
 *  time that particular batter has been at the crease (they start
 *  fresh at 0 when a new batter comes in), so summing the not-out
 *  rows is a solid proxy for the partnership total without needing a
 *  separate partnership field in the data model. Returns null once
 *  there are no not-out batters to show (innings not live, or the
 *  moment right after a wicket before the new batter's row exists). */
function currentPartnership(
  rows: BattingRow[],
): { runs: number; balls: number; fours: number; sixes: number; batters: BattingRow[] } | null {
  const notOut = rows.filter((b) => b.notOut)
  if (notOut.length === 0) return null
  return {
    runs: notOut.reduce((s, b) => s + b.runs, 0),
    balls: notOut.reduce((s, b) => s + b.balls, 0),
    fours: notOut.reduce((s, b) => s + b.fours, 0),
    sixes: notOut.reduce((s, b) => s + b.sixes, 0),
    batters: notOut,
  }
}

/** The bowler currently on — assumed to be the last entry in the
 *  innings' bowling array, since bowlers are appended to that list as
 *  they come on to bowl. If the data model ever adds an explicit
 *  "current bowler" flag (e.g. from match_state), swap this out for
 *  that instead of relying on array order. */
function currentBowler(rows: BowlingRow[]): BowlingRow | null {
  return rows.length > 0 ? rows[rows.length - 1] : null
}

/** Compact win-probability bar, now shown inline in the score strip
 *  instead of behind its own Stats tab. Renders nothing if winProb isn't
 *  available yet (e.g. before the live match engine has published a
 *  reading), so the score strip degrades gracefully rather than showing
 *  an empty bar. Once the match is completed, `winProb` is expected to
 *  already be the snapped final value (100/0, or 50/50 on a tie) — this
 *  component just adjusts the label from "Win Probability" to "Final".
 *
 *  Colors: teamAColor/teamBColor come from match.teamA.color /
 *  match.teamB.color (see data/match-data.ts) so this bar matches
 *  whatever team colors were set in the Match Editor, instead of the
 *  previous fixed gold/red. Falls back to gold/red when a team has no
 *  color set. */
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

/** Single not-out batter row inside the partnership card: initials
 *  avatar (mirrors the squad-panel treatment elsewhere on the page),
 *  name, and runs(balls) with strike rate as a quiet trailing figure. */
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

/** Current-play strip: the live partnership and the bowler currently on,
 *  presented as two matching cards rather than plain text blocks — a
 *  gold hairline accent, small icon-led eyebrow, and initials avatars
 *  echo the squad/scorecard treatment used elsewhere so this reads as
 *  part of the same system instead of a bolted-on summary. Sits inline
 *  in the score strip, right under the score boxes and above the status
 *  line, and only renders anything while the innings in question is
 *  actually live. Either card can render on its own if the other has no
 *  data yet (e.g. bowler recorded but no partial batting rows). */
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
  const [tab, setTab] = useState<"info" | "scorecard" | "squads" | "overs" | "graphs">("info")
  // Default to innings 1 — this gets kept in sync with whichever innings
  // is actually in progress by the effect below, so opening Scorecard /
  // Overs / Graphs mid-1st-innings shows the live 1st innings instead of
  // an empty "2nd innings not started" panel.
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
  // Replaces the old 8s setInterval poll of /api/match/[id]/live. This
  // hook does an initial fetch + aggregation, then subscribes to
  // Supabase Realtime on `balls` / `bracket_matches` / `matches` for
  // this match id, recomputing scorecards + win probability from fresh
  // ball-by-ball data the instant anything changes — no fixed delay,
  // and it stays subscribed even if the match starts out "not_started"
  // (fixing the old bug where a tab left open before the match went
  // live would never start polling). It also reacts instantly when the
  // simulate page's "Clear" wipes `balls`/`match_state`/`match_setup` —
  // hasBallData flips back to false and every tab falls back to its
  // locked/empty state automatically.
  const { match, isSyncing } = useLiveMatch(initialMatch.id, initialMatch)

  const status = match.matchStatus // "not_started" | "live" | "completed"
  const live = status === "live"
  const completed = status === "completed"
  const started = status !== "not_started" // true for "live" or "completed"
  const hasBallData = match.hasBallData

  // Explicit — read from match_setup.currentInnings (see data/match-data.ts)
  // rather than inferred from target/ball counts. This is what stops the
  // score strip from showing a phantom "Team B need X runs" while team a
  // is still batting in the 1st innings.
  //
  // Fallback: also treat the 2nd innings as started if there's already
  // real ball data for it (batting rows recorded), in case the explicit
  // `currentInnings` flag lags behind the actual live scoring feed —
  // otherwise tabs/toggles that depend on this (Scorecard, Overs, and
  // the Graphs sub-tabs) can stay incorrectly locked even while the
  // chase is visibly in progress elsewhere on the page (e.g. the win
  // probability bar).
  const innings2Started = match.currentInnings === 2 || match.innings2Partial.batting.length > 0

  // Keep the innings selector pinned to whichever innings is actually in
  // progress: re-sync whenever the visitor switches tabs, and whenever
  // the match itself flips from 1st to 2nd innings while a tab is open.
  // Without this, `innings` could stay stuck on its initial/previous
  // value and a freshly-opened Scorecard/Overs tab would show the wrong
  // (or locked) innings instead of the live one.
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
  const oversLimitBalls = 120 // T20; adjust if match-data.ts starts carrying a per-match overs limit
  const ballsLeft = oversLimitBalls - ballsBowled
  const crr = ballsBowled > 0 ? (runs / (ballsBowled / 6)).toFixed(2) : "0.00"
  const rrr = innings2Started && live && ballsLeft > 0 && need !== null && need > 0 ? (need / (ballsLeft / 6)).toFixed(2) : null

  // Win probability — once the match is completed, this is snapped to a
  // clean, resolved value (100/0 for the winner, or 50/50 on a tie)
  // based on the actual final totals, rather than whatever the live
  // probability model last happened to output. That snapped value is
  // the single source of truth passed to BOTH the score-strip bar and
  // the Graphs tab's Win Probability chart, so they can never disagree.
  const winner = completed ? determineWinner(match) : null
  const winProb = winner
    ? winner === "tie"
      ? { a: 50, b: 50 }
      : winner === "a"
        ? { a: 100, b: 0 }
        : { a: 0, b: 100 }
    : match.winProb

  // Current partnership / current bowler — only meaningful while a
  // match is actually live. Sourced from whichever innings is
  // currently batting: 1st-innings data (match.innings1) is kept
  // live-updated in place by useLiveMatch while it's in progress, and
  // the 2nd innings uses the dedicated live partial slice
  // (innings2Partial) once the chase has started.
  const activeBattingRows = live ? (innings2Started ? match.innings2Partial.batting : match.innings1.batting) : []
  const activeBowlingRows = live ? (innings2Started ? match.innings2Partial.bowling : match.innings1.bowling) : []
  const partnership = live ? currentPartnership(activeBattingRows) : null
  const bowlerNow = live ? currentBowler(activeBowlingRows) : null

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

      {/* ═══════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════ */}
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

          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 w-full max-w-4xl mx-auto">
            <div className="flex flex-col items-center flex-1 min-w-0 max-w-full">
              <LogoSlot src={match.teamA.logo} alt={`${match.teamA.name} logo`} />
              <h1 className="text-2xl md:text-3xl font-bold text-white font-cinzel tracking-wider drop-shadow-md text-center break-words max-w-full">
                {match.teamA.name}
              </h1>
            </div>

            <div className="flex flex-col items-center justify-center shrink-0">
              <span className="text-gold font-cinzel text-2xl md:text-4xl font-black drop-shadow-[0_0_8px_rgba(245,166,35,0.5)]">
                VS
              </span>
            </div>

            <div className="flex flex-col items-center flex-1 min-w-0 max-w-full">
              <LogoSlot src={match.teamB.logo} alt={`${match.teamB.name} logo`} />
              <h1 className="text-2xl md:text-3xl font-bold text-white font-cinzel tracking-wider drop-shadow-md text-center break-words max-w-full">
                {match.teamB.name}
              </h1>
            </div>
          </div>

          {/* Venue/date are ALWAYS shown, even when blank — an empty
              field is shown as an explicit "Not set" pill rather than
              disappearing, so whoever manages this match knows it still
              needs filling in. */}
          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3 mt-10 text-xs text-gray-200 font-cinzel uppercase tracking-widest bg-black/50 backdrop-blur-md px-6 py-3 rounded-full border border-gold/20 shadow-lg max-w-full">
            <SetupField icon={<MapPin className="h-4 w-4 text-gold shrink-0" />} value={match.venue} fallback="Venue not set" />
            <SetupField
              icon={<Calendar className="h-4 w-4 text-gold shrink-0" />}
              value={[match.date, match.time].filter(Boolean).join(" · ")}
              fallback="Date & time not set"
            />
          </div>

          {/* Toss used to be hidden entirely when empty — now always
              shown with an explicit placeholder for the same reason. */}
          <div className="mt-6">
            <SetupField
              value={match.toss}
              fallback="Toss not recorded"
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SCORE STRIP — now also carries the win
          probability bar, current partnership, and
          current bowler inline (see WinProbabilityBar
          and CurrentPlayStrip), replacing the old
          standalone Stats tab.

          Previously this whole section was wrapped in
          `status === "live" &&`, which made the
          "not_started" / "completed" branches inside
          it dead code — a not-started or completed
          match never showed this strip at all. Now it
          renders for every status; its own internal
          branches already handle each case correctly.
      ═══════════════════════════════════════════ */}
      <section className="px-4 relative z-10 -mt-24">
        <div className="container mx-auto max-w-3xl">
          <div className="bg-black/80 backdrop-blur-xl border border-gold/30 rounded-lg p-6 mb-8 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
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

              {/* Subtle realtime-sync indicator — shows briefly whenever
                  the hook is re-fetching after a Supabase Realtime event.
                  Not an error state, just a "data just updated" cue. */}
              {isSyncing && (
                <span className="flex items-center gap-1.5 text-gray-500 text-[10px] uppercase tracking-widest font-cinzel">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Syncing
                </span>
              )}
            </div>

            {status === "not_started" ? (
              // No balls recorded at all — showing "0/0" with CRR/RRR and
              // a fabricated "need X runs" line here would look like a
              // real live match. Instead, say plainly that there's
              // nothing to show yet, and surface the scheduled date/time
              // (or an explicit "not set" note) so visitors know when to
              // check back.
              <div className="text-center py-6">
                <p className="text-gray-300 font-semibold mb-1">This match hasn't started yet.</p>
                <p className="text-gray-500 text-sm mb-4">
                  Scorecards, overs, and live stats will appear here once ball-by-ball data starts coming in.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="rounded-lg p-4 border border-gold/10 bg-white/[0.02] min-w-0">
                    <span className="text-white font-bold font-cinzel">{match.teamA.short}</span>
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
                    <span className="text-white font-bold font-cinzel">{match.teamB.short}</span>
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

                {/* Current partnership + current bowler — only shown
                    while play is actually live (see CurrentPlayStrip),
                    sitting right under the score boxes and above the
                    status line so it's the first thing visible near the
                    banner. */}
                {live && <CurrentPlayStrip partnership={partnership} bowler={bowlerNow} />}

                {/* Status line — only ever describes the innings that's
                    actually in progress, using the explicit
                    currentInnings flag rather than guessed arithmetic. */}
                <p className="text-white font-semibold mb-3 border-l-2 border-gold pl-3 text-sm break-words">
                  {status === "completed"
                    ? match.resultNote || "Match completed."
                    : !innings2Started
                      ? `${match.teamA.short} batting — 1st innings in progress.`
                      : `${match.teamB.short} need ${need} run${need === 1 ? "" : "s"} from ${ballsLeft} ball${ballsLeft === 1 ? "" : "s"}`}
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

                {/* Win probability — folded in here instead of behind a
                    separate Stats tab. Renders nothing if winProb isn't
                    available yet, so it never shows an empty/fake bar.
                    Once completed, `winProb` is already the snapped
                    final value and the bar labels itself "Final". */}
                <WinProbabilityBar
                  winProb={winProb}
                  teamAShort={match.teamA.short}
                  teamBShort={match.teamB.short}
                  teamAColor={safeColor(match.teamA.color, "#F5A623")}
                  teamBColor={safeColor(match.teamB.color, "#EF4444")}
                  completed={completed}
                />
              </>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          TABS + TAB CONTENT — delegated to
          <MatchTabs>. Only shown once the match has
          actually started (live or completed). A
          not-started match shows a single "not
          started" notice instead of the full tab
          shell, since every tab would just be locked
          anyway and there's nothing meaningful to
          browse yet.
      ═══════════════════════════════════════════ */}
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
            />
          )}
        </div>
      </section>
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