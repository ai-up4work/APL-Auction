"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Radio, Shield, Lock, Clock3, RefreshCw } from "lucide-react"
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
  FowEntry,
  MatchSquad,
  InningsComplete,
} from "@/data/match-data"
import MatchGraphs, { type OverRow } from "./match-graphs"
import type { MatchDetail as GraphMatchDetail } from "@/data/tournament-data"

interface MatchDetailClientProps {
  match: MatchDetail
  /** Undefined for standalone/friendly matches with no tournament link. */
  tournamentSlug?: string
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

// "stats" removed as a standalone tab — win probability now lives inline
// in the score strip instead (see WinProbabilityBar below).
type Tab = "info" | "scorecard" | "squads" | "overs" | "graphs"

// All tabs are always rendered — never hidden based on data
// availability. Tabs without underlying data are shown locked (see
// isTabLocked) instead, so the visitor knows the feature exists and needs
// to be set up, rather than wondering why a tab silently disappeared.
const TABS: { key: Tab; label: string }[] = [
  { key: "info", label: "Info" },
  { key: "scorecard", label: "Scorecard" },
  { key: "squads", label: "Squads" },
  { key: "overs", label: "Overs" },
  { key: "graphs", label: "Graphs" },
]

const images = {
  bg: "https://www.hindustantimes.com/ht-img/img/2024/09/30/1600x900/Cricket_3_1727677442716_1727677564058.jpg",
  tournament: "/valiant-league-logo.png",
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

/** Shown in place of a tab's real content when that tab has no underlying
 *  data yet. Used for locked tabs so the message is consistent everywhere
 *  instead of each tab inventing its own "no data" text. */
function LockedTabPanel({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 border border-dashed border-gold/20 rounded-lg bg-white/[0.02] mb-8">
      <div className="h-12 w-12 rounded-full bg-white/5 border border-gold/20 flex items-center justify-center mb-4">
        <Lock className="h-5 w-5 text-gray-500" />
      </div>
      <p className="text-gray-200 font-semibold font-cinzel uppercase tracking-wide text-sm mb-2">{title}</p>
      <p className="text-gray-500 text-sm max-w-sm">{hint}</p>
    </div>
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

/** Compact win-probability bar, now shown inline in the score strip
 *  instead of behind its own Stats tab. Renders nothing if winProb isn't
 *  available yet (e.g. before the live match engine has published a
 *  reading), so the score strip degrades gracefully rather than showing
 *  an empty bar. Once the match is completed, `winProb` is expected to
 *  already be the snapped final value (100/0, or 50/50 on a tie) — this
 *  component just adjusts the label from "Win Probability" to "Final". */
function WinProbabilityBar({
  winProb,
  teamAShort,
  teamBShort,
  completed,
}: {
  winProb: { a: number; b: number } | undefined
  teamAShort: string
  teamBShort: string
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
        <div className="transition-all duration-700 bg-gold" style={{ width: `${winProb.a}%` }} />
        <div className="transition-all duration-700 bg-red-600" style={{ width: `${winProb.b}%` }} />
      </div>
      <div className="flex justify-between mt-2 text-xs font-cinzel">
        <span className="text-gold font-bold">
          {teamAShort} {winProb.a}%
        </span>
        <span className="text-red-500 font-bold">
          {teamBShort} {winProb.b}%
        </span>
      </div>
      {tied && <p className="text-gray-500 text-[10.5px] text-center mt-2 font-cinzel">Match Tied</p>}
    </div>
  )
}

export default function MatchDetailClient({ match: initialMatch, tournamentSlug }: MatchDetailClientProps) {
  useScrollTop()
  const router = useRouter()
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("info")
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

  console.log("MatchDetailClient: initial match detail for matchId", initialMatch.id, ":", initialMatch.squads[0].players)

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
  const hasBallData = match.hasBallData

  // Explicit — read from match_setup.currentInnings (see data/match-data.ts)
  // rather than inferred from target/ball counts. This is what stops the
  // score strip from showing a phantom "Team B need X runs" while team A
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

  const inn2 = live ? match.innings2Partial : match.innings2Final
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

  // Tab lock state — never hide a tab, just mark it locked when the
  // underlying data doesn't exist yet.
  const isTabLocked = (t: Tab): boolean => {
    switch (t) {
      case "scorecard":
      case "overs":
      case "graphs":
        return !hasBallData
      case "squads":
        return match.squads.length === 0
      case "info":
      default:
        return false
    }
  }

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
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-80"
          style={{ backgroundImage: `url('${images.bg}')` }}
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
          probability bar inline (see
          WinProbabilityBar), replacing the old
          standalone Stats tab.
      ═══════════════════════════════════════════ */}
      <section className="px-4 relative z-10 -mt-24">
        <div className="container mx-auto max-w-3xl">
          <div className="bg-black/80 backdrop-blur-xl border border-gold/30 rounded-lg p-6 mb-8 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
              <div className="flex items-center gap-2">
                {status === "live" && (
                  <span className="flex items-center gap-1.5 bg-red-600/90 text-white text-xs font-bold font-cinzel px-3 py-1.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.4)]">
                    <Radio className="h-3 w-3" />
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
              // nothing to show yet.
              <div className="text-center py-6">
                <p className="text-gray-300 font-semibold mb-1">This match hasn't started yet.</p>
                <p className="text-gray-500 text-sm">
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
                  completed={completed}
                />
              </>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          TABS NAVIGATION — all tabs always visible;
          locked ones are dimmed with a lock icon
          rather than hidden.
      ═══════════════════════════════════════════ */}
      <section className="px-4 relative z-10">
        <div className="container mx-auto max-w-3xl">
          <div className="bg-black/50 border border-gold/20 p-1 rounded-lg w-full flex flex-wrap gap-1 mb-8">
            {TABS.map(({ key, label }) => {
              const locked = isTabLocked(key)
              const active = tab === key
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex items-center gap-1.5 font-cinzel text-xs uppercase tracking-wide px-4 py-2 rounded-md transition-all duration-300 ${
                    active ? "bg-gold text-black" : locked ? "text-gray-600 hover:text-gray-400" : "text-gray-300 hover:text-gold"
                  }`}
                  title={locked ? `${label} — no data yet` : undefined}
                >
                  {label}
                  {locked && <Lock className="h-2.5 w-2.5" />}
                </button>
              )
            })}
          </div>

          {/* SCORECARD TAB */}
          {tab === "scorecard" && (
            <div className="mb-8">
              {!hasBallData ? (
                <LockedTabPanel
                  title="Scorecard not available yet"
                  hint="No deliveries have been recorded for this match. The batting and bowling cards will populate automatically once ball-by-ball scoring begins."
                />
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-2 mb-6">
                    <button
                      onClick={() => setInnings(1)}
                      className={`flex-1 text-xs font-cinzel uppercase px-3 py-2.5 rounded-md border transition-all break-words ${
                        innings === 1 ? "bg-gold/15 border-gold text-gold font-bold" : "border-gold/20 text-gray-300"
                      }`}
                    >
                      {match.teamA.short} — 1st Innings · {match.innings1.total}/{match.innings1.wkts}
                    </button>
                    <button
                      onClick={() => setInnings(2)}
                      disabled={!innings2Started}
                      title={!innings2Started ? "2nd innings — locked until it starts" : undefined}
                      className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-cinzel uppercase px-3 py-2.5 rounded-md border transition-all break-words disabled:cursor-not-allowed ${
                        innings === 2
                          ? "bg-gold/15 border-gold text-gold font-bold"
                          : !innings2Started
                            ? "border-dashed border-gray-700 text-gray-600"
                            : "border-gold/20 text-gray-300"
                      }`}
                    >
                      {innings2Started ? (
                        `${match.teamB.short} — 2nd Innings · ${runs}/${wkts}`
                      ) : (
                        <>
                          <Lock className="h-3 w-3 shrink-0" />
                          {match.teamB.short} — yet to bat
                        </>
                      )}
                    </button>
                  </div>

                  {innings === 1 && (
                    <>
                      <BattingCard
                        title={`${match.teamA.short} Batting`}
                        rows={match.innings1.batting}
                        extras={match.innings1.extras}
                        extrasNote={match.innings1.extrasNote}
                        total={match.innings1.total}
                        wkts={match.innings1.wkts}
                        overs={match.innings1.overs}
                        dnb={match.innings1.dnb}
                      />
                      <FowList fow={match.innings1.fow} />
                      <BowlingCard title={`${match.teamB.short} Bowling`} rows={match.innings1.bowling} />
                    </>
                  )}

                  {innings === 2 && !innings2Started && (
                    <LockedTabPanel
                      title="2nd innings not started"
                      hint={`${match.teamB.short} haven't come out to bat yet — this fills in the moment the chase begins.`}
                    />
                  )}

                  {innings === 2 && innings2Started && live && (
                    <>
                      <BattingCard
                        title={`${match.teamB.short} Batting`}
                        rows={match.innings2Partial.batting}
                        extras={0}
                        extrasNote="—"
                        total={runs}
                        wkts={wkts}
                        overs={overLabel}
                        live
                        creaseNote={notOutBatters(match.innings2Partial.batting)}
                      />
                      <FowList fow={match.innings2Partial.fow} />
                      <BowlingCard title={`${match.teamA.short} Bowling`} rows={match.innings2Partial.bowling} live />
                    </>
                  )}

                  {innings === 2 && innings2Started && !live && (
                    <>
                      <BattingCard
                        title={`${match.teamB.short} Batting`}
                        rows={match.innings2Final.batting}
                        extras={match.innings2Final.extras}
                        extrasNote={match.innings2Final.extrasNote}
                        total={match.innings2Final.total}
                        wkts={match.innings2Final.wkts}
                        overs={match.innings2Final.overs}
                        dnb={match.innings2Final.dnb}
                      />
                      <FowList fow={match.innings2Final.fow} />
                      <BowlingCard title={`${match.teamA.short} Bowling`} rows={match.innings2Final.bowling} />
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* INFO TAB — never locked; every field shows a "Not set"
              placeholder instead of being omitted when blank */}
          {tab === "info" && (
            <div className="space-y-4 mb-8">
              <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4 font-cinzel">MATCH INFO</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    ["Series", match.tournamentName ? `${match.tournamentName} — ${match.round}` : match.round],
                    ["Venue", match.venue],
                    ["Date & Time", [match.date, match.time].filter(Boolean).join(" · ")],
                    ["Toss", match.toss],
                    ["Umpires", match.officials.umpires],
                    ["Third Umpire", match.officials.thirdUmpire],
                    ["Match Referee", match.officials.referee],
                    ["Format", match.officials.format],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-white/[0.02] border border-gold/10 rounded-md p-3 min-w-0">
                      <p className="text-gray-500 text-[10px] uppercase tracking-widest font-cinzel">{label}</p>
                      <p className={`text-sm mt-1 break-words ${value ? "text-gray-200" : "text-gray-600 italic"}`}>
                        {value || "Not set"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SQUADS TAB */}
          {tab === "squads" && (
            <div className="space-y-6 mb-8">
              {match.squads.length === 0 ? (
                <LockedTabPanel
                  title="Squads not announced yet"
                  hint="Playing XI and bench lists will show up here once squads are added for this match."
                />
              ) : (
                match.squads.map((s) => <MatchSquadPanel key={s.team} squad={s} />)
              )}
            </div>
          )}

          {/* OVERS TAB */}
          {tab === "overs" &&
            (!hasBallData ? (
              <div className="mb-8">
                <LockedTabPanel
                  title="Over-by-over data not available yet"
                  hint="This breaks down runs and wickets per over — it fills in automatically once deliveries are recorded."
                />
              </div>
            ) : (
              (() => {
                const overOverData = getOverByOverData(innings)
                return (
                  <div className="mb-8 space-y-4 fade-in">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        onClick={() => setInnings(1)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                          innings === 1
                            ? "bg-gold text-black shadow-md shadow-gold/20"
                            : "bg-white/5 border border-gold/10 text-gray-400 hover:text-white"
                        }`}
                      >
                        {match.teamA.short} (1st Inn)
                      </button>
                      <button
                        onClick={() => setInnings(2)}
                        disabled={!innings2Started}
                        title={!innings2Started ? "2nd innings — locked until it starts" : undefined}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all disabled:cursor-not-allowed ${
                          innings === 2
                            ? "bg-gold text-black shadow-md shadow-gold/20"
                            : !innings2Started
                              ? "bg-white/[0.02] border border-dashed border-gray-700 text-gray-600"
                              : "bg-white/5 border border-gold/10 text-gray-400 hover:text-white"
                        }`}
                      >
                        {!innings2Started && <Lock className="h-2.5 w-2.5" />}
                        {match.teamB.short} (2nd Inn)
                      </button>
                    </div>

                    {innings === 2 && !innings2Started ? (
                      <p className="text-gray-500 text-sm text-center py-8">2nd innings hasn't started yet.</p>
                    ) : overOverData.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-8">No overs bowled in this innings yet.</p>
                    ) : (
                      <div className="border border-gold/20 rounded-xl overflow-hidden bg-black/40 backdrop-blur-md">
                        <div className="grid grid-cols-[4rem_1fr_3.5rem] sm:grid-cols-[5.5rem_1fr_4.5rem] bg-white/[0.03] border-b border-gold/10 p-3 text-[10px] uppercase font-bold tracking-widest text-gray-400 font-cinzel">
                          <div>Over</div>
                          <div>Wickets</div>
                          <div className="text-right">Runs</div>
                        </div>

                        {[...overOverData].reverse().map((ov, index) => (
                          <div
                            key={ov.num}
                            className={`grid grid-cols-[4rem_1fr_3.5rem] sm:grid-cols-[5.5rem_1fr_4.5rem] items-center p-4 transition-colors hover:bg-white/[0.01] ${
                              index < overOverData.length - 1 ? "border-b border-gold/10" : ""
                            }`}
                          >
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-white font-cinzel">Ov {ov.num}</h4>
                              <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{ov.score}</p>
                            </div>

                            <div className="flex flex-wrap gap-1.5 items-center min-w-0">
                              {ov.balls.length > 0 ? (
                                ov.balls.map((b, ballIdx) => (
                                  <span
                                    key={ballIdx}
                                    className="h-6 min-w-[1.5rem] px-1 rounded flex items-center justify-center text-xs font-bold bg-red-600 text-white shadow-sm shadow-red-900/50"
                                  >
                                    {b}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-600 text-xs">—</span>
                              )}
                            </div>

                            <div className="text-right text-base font-bold text-white font-cinzel pr-1">
                              {ov.totalRuns}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-gray-600 text-center pt-2">
                      Ball-by-ball breakdown within each over isn't available yet — showing runs and wickets per over.
                    </p>
                  </div>
                )
              })()
            ))}

          {/* GRAPHS TAB */}
          {tab === "graphs" &&
            (!hasBallData ? (
              <div className="mb-8">
                <LockedTabPanel
                  title="Graphs not available yet"
                  hint="Run-rate and win-probability charts need at least some ball-by-ball data to draw — check back once the match is underway."
                />
              </div>
            ) : (
              <MatchGraphs
                match={match as unknown as GraphMatchDetail}
                live={live}
                overRunsB={live ? partialOverRuns(match.innings2Partial) : match.innings2Final.overRuns}
                winProb={winProb ?? { a: 50, b: 50 }}
                stepIndex={match.liveScript.length}
                overs1={getOverByOverData(1)}
                overs2={getOverByOverData(2)}
                innings2Started={innings2Started}
                completed={completed}
              />
            ))}

          <div className="text-center mb-16">
            {tournamentSlug ? (
              <Link href={`/tournaments/${tournamentSlug}`}>
                <Button className="bg-gold hover:bg-gold/90 py-2 text-black font-bold">Back to Tournament</Button>
              </Link>
            ) : (
              <Link href="/">
                <Button className="bg-gold hover:bg-gold/90 py-2 text-black font-bold">Back Home</Button>
              </Link>
            )}
          </div>
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
function notOutBatters(rows: BattingRow[]): string {
  const names = rows.filter((b) => b.notOut).map((b) => b.name)
  return names.length > 0 ? `${names.join(" & ")} (not out)` : ""
}

// ─────────────────────────────────────────────────────────────
// DATA COMPONENTS
// ─────────────────────────────────────────────────────────────
function DataGrid({
  columns,
  rows,
}: {
  columns: { key: string; label: string; align?: "left" | "right"; grow?: boolean }[]
  rows: Record<string, React.ReactNode>[]
}) {
  const template = columns.map((c) => (c.grow ? "minmax(6rem,1fr)" : "3.2rem")).join(" ")
  return (
    <div className="border border-gold/10 rounded-md overflow-x-auto">
      <div className="min-w-[22rem]">
        <div className="grid border-b border-gold/10 bg-white/[0.02]" style={{ gridTemplateColumns: template }}>
          {columns.map((c) => (
            <div
              key={c.key}
              className={`p-2.5 text-[9.5px] tracking-widest uppercase text-gray-500 font-cinzel ${
                c.align === "right" ? "text-right" : "text-left"
              }`}
            >
              {c.label}
            </div>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-6">No data yet.</p>
        ) : (
          rows.map((row, i) => (
            <div
              key={i}
              className={`grid items-start text-xs md:text-sm ${i < rows.length - 1 ? "border-b border-gold/5" : ""}`}
              style={{ gridTemplateColumns: template }}
            >
              {columns.map((c) => (
                <div key={c.key} className={`p-2.5 ${c.align === "right" ? "text-right text-gray-200" : "text-left"}`}>
                  {row[c.key]}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function BattingCard({
  title,
  rows,
  extras,
  extrasNote,
  total,
  wkts,
  overs,
  dnb,
  creaseNote,
  live,
}: {
  title: string
  rows: BattingRow[]
  extras: number
  extrasNote: string
  total: number
  wkts: number
  overs: string
  dnb?: string[]
  creaseNote?: string
  live?: boolean
}) {
  const columns = [
    { key: "name", label: "Batter", grow: true },
    { key: "r", label: "R", align: "right" as const },
    { key: "b", label: "B", align: "right" as const },
    { key: "4s", label: "4s", align: "right" as const },
    { key: "6s", label: "6s", align: "right" as const },
    { key: "sr", label: "SR", align: "right" as const },
  ]
  const rowData = rows.map((b) => ({
    name: (
      <div className="min-w-0">
        <p className="text-gray-100 font-medium truncate">{b.name}</p>
        <p className={`text-[10.5px] mt-0.5 truncate ${b.notOut ? "text-green-500" : "text-gray-500"}`}>
          {b.notOut ? "not out" : b.how}
        </p>
      </div>
    ),
    r: b.runs,
    b: b.balls,
    "4s": b.fours,
    "6s": b.sixes,
    sr: b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0",
  }))

  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-gold text-xs uppercase tracking-widest font-cinzel">{title}</p>
        {live && (
          <span className="flex items-center gap-1.5 text-red-500 text-[10px] uppercase tracking-widest font-cinzel">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> live
          </span>
        )}
      </div>
      <DataGrid columns={columns} rows={rowData} />
      {creaseNote && <p className="text-gray-400 text-[11px] mt-3 break-words">At the crease: {creaseNote}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-[11px] text-gray-400">
        <span>
          Extras {extras} <span className="text-gray-600">({extrasNote})</span>
        </span>
        <span className="text-white font-bold">
          Total {total}/{wkts} <span className="text-gray-500 font-normal">({overs} ov)</span>
        </span>
      </div>
      {dnb && dnb.length > 0 && <p className="text-gray-500 text-[10px] mt-2 break-words">Did not bat: {dnb.join(", ")}</p>}
    </div>
  )
}

function BowlingCard({ title, rows, live }: { title: string; rows: BowlingRow[]; live?: boolean }) {
  const columns = [
    { key: "name", label: "Bowler", grow: true },
    { key: "o", label: "O", align: "right" as const },
    { key: "r", label: "R", align: "right" as const },
    { key: "w", label: "W", align: "right" as const },
    { key: "econ", label: "Econ", align: "right" as const },
  ]
  const rowData = rows.map((b) => ({
    name: <p className="text-gray-100 font-medium truncate">{b.name}</p>,
    o: b.overs,
    r: b.runs,
    w: b.wkts,
    econ: b.econ,
  }))
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-gold text-xs uppercase tracking-widest font-cinzel">{title}</p>
        {live && <span className="text-gray-500 text-[10px] uppercase tracking-widest font-cinzel">so far</span>}
      </div>
      <DataGrid columns={columns} rows={rowData} />
    </div>
  )
}

function FowList({ fow }: { fow: FowEntry[] }) {
  if (fow.length === 0) return null
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-4">
      <p className="text-gold text-xs uppercase tracking-widest font-cinzel mb-3">Fall of Wickets</p>
      <div className="flex flex-wrap gap-2">
        {fow.map((f, i) => (
          <span key={`${f[0]}-${i}`} className="text-[10.5px] text-gray-300 bg-white/[0.02] border border-gold/10 rounded-lg px-2.5 py-1.5">
            <b className="text-white">{f[0]}</b> {f[1]} ({f[2]} ov)
          </span>
        ))}
      </div>
    </div>
  )
}

function MatchSquadPanel({ squad }: { squad: MatchSquad }) {
  const playingXI = squad.players.filter((p) => p.xi)
  const bench = squad.players.filter((p) => !p.xi)

  const renderPlayerGrid = (playersList: typeof squad.players) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 border border-gold/10 rounded-lg overflow-hidden bg-white/[0.01]">
        {playersList.map((p, idx) => {
          const isEven = idx % 2 === 0
          const isLastTwo = idx >= playersList.length - (playersList.length % 2 === 0 ? 2 : 1)

          return (
            <div
              key={p.name}
              className={`flex items-center gap-4 p-3.5 transition-colors hover:bg-white/[0.02] min-w-0 ${
                !isLastTwo ? "border-b border-gold/10" : ""
              } ${isEven ? "md:border-r border-gold/10" : ""}`}
            >
              <div className="relative h-12 w-12 rounded-full overflow-hidden bg-black/60 border border-gold/20 flex items-center justify-center shrink-0 shadow-[inner_0_2px_4px_rgba(0,0,0,0.6)]">
                {p.img ? (
                  <img
                    src={p.img}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                      e.currentTarget.nextElementSibling?.classList.remove("hidden")
                    }}
                  />
                ) : null}
                <div
                  className={`w-full h-full flex items-center justify-center bg-gradient-to-b from-white/15 via-transparent to-transparent text-xs font-bold text-gold font-cinzel ${
                    p.img ? "hidden" : ""
                  }`}
                >
                  {initials(p.name)}
                </div>
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white tracking-wide truncate">{p.name}</h4>
                <p className="text-xs text-gray-400 mt-0.5 font-medium truncate">{p.role}</p>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="bg-black/50 border border-gold/20 rounded-xl p-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6 border-b border-gold/10 pb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Shield className="h-5 w-5 text-gold drop-shadow-[0_0_6px_rgba(245,166,35,0.4)] shrink-0" />
          <h3 className="text-lg font-bold text-white font-cinzel tracking-wider truncate">{squad.team}</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 font-cinzel uppercase tracking-wider">
            Captain: <span className="text-gold font-bold">{squad.captain}</span>
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-cinzel uppercase tracking-widest text-gold/70 font-semibold mb-2 px-1">Playing XI</p>
        {renderPlayerGrid(playingXI)}
      </div>

      {bench.length > 0 && (
        <div className="my-8 relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gold/10" />
          </div>
          <span className="relative px-6 py-1.5 bg-black border border-gold/25 rounded-full text-xs font-bold font-cinzel tracking-widest text-gray-400 uppercase shadow-md z-10">
            Bench
          </span>
        </div>
      )}

      {bench.length > 0 && <div className="space-y-3">{renderPlayerGrid(bench)}</div>}
    </div>
  )
}