"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Calendar,
  MapPin,
  Radio,
  Shield,
  CloudSun,
} from "lucide-react"
import { useScrollTop } from "@/hooks/use-scroll-top"
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
  LiveScriptStep,
} from "@/data/tournament-data"
import MatchGraphs, { type OverRow } from "./match-graphs"

interface MatchDetailClientProps {
  match: MatchDetail
  tournamentSlug: string
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

type Tab = "scorecard" | "info" | "squads" | "overs" | "graphs" | "stats"

const TABS: Tab[] = ["scorecard", "info", "squads", "overs", "graphs"]

const images = {
  bg: "https://www.hindustantimes.com/ht-img/img/2024/09/30/1600x900/Cricket_3_1727677442716_1727677564058.jpg",
  "team-a": "/Franchises/CSK.png",
  "team-b": "/Franchises/RCB.png",
  tournament: "/moon-knight-logo.png",
}

// Small helper so every logo slot (team A, team B, tournament) renders the
// same way: a real <Image> when a path is supplied, and a graceful
// "Image not available" placeholder otherwise. Keeping this in one place
// means the three logo slots can never drift out of sync again.
//
// NOTE: rounded-2xl (a soft square) is used instead of a full circle.
// Team crests are rarely perfectly square, so a circular mask + object-contain
// leaves visible gaps of background in the corners where the logo doesn't
// reach the edge of the circle. A rounded square is far more forgiving and
// is what most real scorecards (Cricbuzz, ESPN, ICC) use for this reason.
function LogoSlot({ src, alt }: { src?: string; alt: string }) {
  return (
    <div className="relative h-20 w-20 bg-gradient-to-b from-white/10 to-black/40 backdrop-blur-md rounded-2xl border border-gold/30 mb-3 flex items-center justify-center overflow-hidden shrink-0 shadow-[0_0_20px_rgba(245,166,35,0.15)]">
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

export default function MatchDetailClient({ match, tournamentSlug }: MatchDetailClientProps) {
  useScrollTop()
  const router = useRouter()
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("scorecard")
  const [innings, setInnings] = useState<1 | 2>(2)

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }
  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  // ── live sim state ──
  const [live, setLive] = useState(true)
  const [runs, setRuns] = useState(match.innings2Partial.runsAtStart)
  const [wkts, setWkts] = useState(match.innings2Partial.wktsAtStart)
  const [overLabel, setOverLabel] = useState(match.innings2Partial.overAtStart)
  const [stepIndex, setStepIndex] = useState(0)
  const [winProb, setWinProb] = useState({ a: 42, b: 58 })
  const [commentary, setCommentary] = useState<LiveScriptStep[]>([])
  const [overRunsB, setOverRunsB] = useState<number[]>(
    match.innings2Partial.overRunsAtStart.concat(match.innings2Partial.over19ExtraRuns)
  )
  const [partnership, setPartnership] = useState({ runs: 4, balls: 7 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(tick, 2600)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex])

  function tick() {
    if (stepIndex >= match.liveScript.length) return
    const step = match.liveScript[stepIndex]

    setRuns((r) => r + step.runs)
    setWkts((w) => (step.wkt ? w + 1 : w))
    setOverLabel(step.ball)
    setWinProb({ a: step.wpA, b: step.wpB })
    setCommentary((c) => [step, ...c])
    setPartnership((p) => (step.wkt ? { runs: 0, balls: 0 } : { runs: p.runs + step.runs, balls: p.balls + 1 }))

    if (step.ball === "19.6") {
      const tail = match.liveScript.filter((s) => s.over === 19).reduce((a, s) => a + s.runs, 0)
      setOverRunsB([...match.innings2Partial.overRunsAtStart, match.innings2Partial.over19ExtraRuns + tail])
    }
    if (step.ball === "20.6") {
      const over20 = match.liveScript.filter((s) => s.over === 20).reduce((a, s) => a + s.runs, 0)
      const tail = match.liveScript.filter((s) => s.over === 19).reduce((a, s) => a + s.runs, 0)
      setOverRunsB([
        ...match.innings2Partial.overRunsAtStart,
        match.innings2Partial.over19ExtraRuns + tail,
        over20,
      ])
      setLive(false)
    }

    setStepIndex((i) => i + 1)
  }

  const need = match.target - runs
  const ballsBowled = (() => {
    const [o, b] = overLabel.split(".").map(Number)
    return o * 6 + b
  })()
  const ballsLeft = 120 - ballsBowled
  const crr = (runs / (ballsBowled / 6)).toFixed(2)
  const rrr = live && ballsLeft > 0 ? (need > 0 ? (need / (ballsLeft / 6)).toFixed(2) : "0.00") : null

  // Generate over-by-over list data for a given innings. Accepts an explicit
  // innings arg (defaulting to the currently selected tab-innings) so callers
  // like MatchGraphs can request both innings regardless of what's on screen.
  const getOverByOverData = (inn: 1 | 2 = innings): OverRow[] => {
    if (inn === 1) {
      return [
        { num: 20, score: `${match.innings1.total}-${match.innings1.wkts}`, matchUp: "D. Fernando to K. Perera & D. de Silva", balls: ["1", "4", "W", "1", "6", "1"], totalRuns: 13 },
        { num: 19, score: "168-5", matchUp: "S. Jayasinghe to K. Perera & P. Nissanka", balls: ["•", "1", "4", "•", "1", "2"], totalRuns: 8 },
        { num: 18, score: "160-5", matchUp: "D. Fernando to P. Nissanka", balls: ["1", "W", "1", "•", "6", "1"], totalRuns: 9 },
        { num: 17, score: "151-4", matchUp: "M. Theekshana to K. Mendis & P. Nissanka", balls: ["1", "1", "1", "4", "1", "•"], totalRuns: 8 },
        { num: 16, score: "143-4", matchUp: "C. Asalanka to K. Mendis", balls: ["6", "1", "W", "•", "1", "1"], totalRuns: 9 },
      ]
    }

    // Compiled live list array generated out of the active live simulation arrays
    const list: OverRow[] = []
    const tempRuns = match.innings2Partial.runsAtStart
    const tempWkts = match.innings2Partial.wktsAtStart

    // Over 19 mapping logic loop
    const o19Steps = match.liveScript.filter((s) => s.over === 19)
    if (o19Steps.length > 0 && stepIndex > 0) {
      const o19F = o19Steps.filter((_, idx) => match.liveScript.indexOf(o19Steps[idx]) < stepIndex)
      if (o19F.length > 0) {
        const rScored = o19F.reduce((acc, s) => acc + s.runs, 0)
        const wTaken = o19F.filter((s) => s.wkt).length
        const currentTotalRuns = match.innings2Partial.runsAtStart + rScored
        const currentTotalWkts = match.innings2Partial.wktsAtStart + wTaken
        list.push({
          num: 19,
          score: `${currentTotalRuns}-${currentTotalWkts}`,
          matchUp: "B. Kumar to J. Fonseka & M. Jayasuriya",
          balls: o19F.map((s) => (s.wkt ? "W" : s.runs === 0 ? "•" : String(s.runs))),
          totalRuns: rScored,
        })
      }
    }

    // Preloaded complete historical overs sequence setup lists
    list.push(
      { num: 18, score: `${tempRuns}-${tempWkts}`, matchUp: "M. Siraj to J. Fonseka & R. Silva", balls: ["1", "•", "4", "1", "W", "1"], totalRuns: 7 },
      { num: 17, score: `${tempRuns - 7}-${tempWkts - 1}`, matchUp: "B. Kumar to R. Silva & K. Mendis", balls: ["6", "1", "6", "•", "1", "2"], totalRuns: 16 },
      { num: 16, score: `${tempRuns - 23}-${tempWkts - 1}`, matchUp: "A. Patel to K. Mendis", balls: ["1", "1", "•", "1", "W", "•"], totalRuns: 3 },
      { num: 15, score: `${tempRuns - 26}-${tempWkts}`, matchUp: "J. Bumrah to J. Fonseka & K. Mendis", balls: ["1", "•", "4", "1", "1", "1"], totalRuns: 8 }
    )
    return list
  }

  return (
    <main className="overflow-x-hidden max-w-full">
      <style
        dangerouslySetInnerHTML={{
          __html: `${pageStyles}
          html, body {
            overflow-x: hidden;
            max-width: 100%;
          }`,
        }}
      />

      <SiteHeader
        activeSection="tournament"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      {/* ═══════════════════════════════════════════
          HERO (FULL WIDTH ICC STYLE)
      ═══════════════════════════════════════════ */}
      <section className="relative w-full min-h-[450px] flex items-center justify-center pt-24 pb-12 overflow-hidden bg-black border-b border-gold/20">
        <div
            className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-30"
            style={{ backgroundImage: `url('${images.bg}')` }}
        >
            <span className="sr-only">Image not available</span>
        </div>

        <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black via-transparent to-transparent opacity-80" />

        <div className="container mx-auto px-4 relative z-10 text-center fade-in flex flex-col items-center mt-10 max-w-full">
          <div className="relative mb-6 h-30 w-30 rounded-full bg-black/60 border border-gold/40 flex items-center justify-center overflow-hidden backdrop-blur-sm shadow-[0_0_15px_rgba(245,166,35,0.2)] shrink-0">
            {images.tournament ? (
              <Image
                src={images.tournament}
                alt={`${match.tournamentName} logo`}
                fill
                className="object-contain p-2"
                sizes="80px"
              />
            ) : (
              <span className="text-[10px] text-gray-500 font-cinzel text-center leading-tight uppercase">
                Image<br />not<br />available
              </span>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 w-full max-w-4xl mx-auto">
              <div className="flex flex-col items-center flex-1 min-w-0 max-w-full">
                <LogoSlot src={images["team-a"]} alt={`${match.teamA.name} logo`} />
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
                <LogoSlot src={images["team-b"]} alt={`${match.teamB.name} logo`} />
                <h1 className="text-2xl md:text-3xl font-bold text-white font-cinzel tracking-wider drop-shadow-md text-center break-words max-w-full">
                  {match.teamB.name}
                </h1>
              </div>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3 mt-10 text-xs text-gray-200 font-cinzel uppercase tracking-widest bg-black/50 backdrop-blur-md px-6 py-3 rounded-full border border-gold/20 shadow-lg max-w-full">
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gold shrink-0" /> {match.venue}
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gold shrink-0" /> {match.date} · {match.time}
            </span>
            <span className="flex items-center gap-2 md:border-l border-gold/20 md:pl-6">
              <CloudSun className="h-4 w-4 text-gold shrink-0" /> {(match as any).weather || "29°C · Clear Sky"}
            </span>
          </div>

          <p className="text-gold mt-6 text-sm font-semibold tracking-wide bg-gold/10 px-5 py-2 rounded-full border border-gold/30 backdrop-blur-sm max-w-full text-center break-words">
              {match.toss}
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SCORE STRIP
      ═══════════════════════════════════════════ */}
      <section className="px-4 relative z-10 -mt-8">
        <div className="container mx-auto max-w-3xl">
          <div className="bg-black/80 backdrop-blur-xl border border-gold/30 rounded-lg p-6 mb-8 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
              {live ? (
                <span className="flex items-center gap-1.5 bg-red-600/90 text-white text-xs font-bold font-cinzel px-3 py-1.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.4)]">
                  <Radio className="h-3 w-3" />
                  LIVE
                </span>
              ) : (
                <Badge className="bg-gray-600 hover:bg-gray-700">Completed</Badge>
              )}
              <span className="text-gray-400 text-xs font-cinzel uppercase tracking-wide">
                {live ? "4,821 watching" : "5,940 watched"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg p-4 border border-gold/10 bg-white/[0.02] min-w-0">
                <span className="text-white font-bold font-cinzel">{match.teamA.short}</span>
                <p className="text-2xl font-bold text-white font-cinzel mt-1">
                  {match.innings1.total}/{match.innings1.wkts}
                  <span className="text-sm text-gray-400 font-normal ml-2">({match.innings1.overs} ov)</span>
                </p>
              </div>
              <div className={`rounded-lg p-4 border min-w-0 ${live ? "border-gold shadow-[0_0_15px_rgba(245,166,35,0.1)] bg-gold/5" : "border-gold/10 bg-white/[0.02]"}`}>
                <span className="text-white font-bold font-cinzel">{match.teamB.short}</span>
                <p className="text-2xl font-bold text-white font-cinzel mt-1">
                  {runs}/{wkts}
                  <span className="text-sm text-gray-400 font-normal ml-2">
                    ({live ? overLabel : match.innings2Final.overs} ov)
                  </span>
                </p>
              </div>
            </div>

            <p className="text-white font-semibold mb-3 border-l-2 border-gold pl-3 text-sm break-words">
              {live
                ? `${match.teamB.short} need ${need} runs from ${ballsLeft} ball${ballsLeft === 1 ? "" : "s"}`
                : match.resultNote}
            </p>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="bg-gold/10 border border-gold/20 rounded-md px-4 py-2">
                <span className="text-gray-400">CRR </span>
                <span className="text-gold font-bold font-cinzel">{crr}</span>
              </div>
              {rrr && (
                <div className="bg-gold/10 border border-gold/20 rounded-md px-4 py-2">
                  <span className="text-gray-400">RRR </span>
                  <span className="text-gold font-bold font-cinzel">{rrr}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          TABS NAVIGATION
      ═══════════════════════════════════════════ */}
      <section className="px-4 relative z-10">
        <div className="container mx-auto max-w-3xl">
          <div className="bg-black/50 border border-gold/20 p-1 rounded-lg w-full flex flex-wrap gap-1 mb-8">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`font-cinzel text-xs uppercase tracking-wide px-4 py-2 rounded-md transition-all duration-300 ${
                  tab === t ? "bg-gold text-black" : "text-gray-300 hover:text-gold"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* SCORECARD TAB */}
          {tab === "scorecard" && (
            <div className="mb-8">
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
                  className={`flex-1 text-xs font-cinzel uppercase px-3 py-2.5 rounded-md border transition-all break-words ${
                    innings === 2 ? "bg-gold/15 border-gold text-gold font-bold" : "border-gold/20 text-gray-300"
                  }`}
                >
                  {match.teamB.short} — 2nd Innings · {live ? `${runs}/${wkts}` : `${match.innings2Final.total}/${match.innings2Final.wkts}`}
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

              {innings === 2 && live && (
                <>
                  <BattingCard
                    title={`${match.teamB.short} Batting`}
                    rows={match.innings2Partial.batting}
                    extras={1}
                    extrasNote="lb 1"
                    total={runs}
                    wkts={wkts}
                    overs={overLabel}
                    live
                    creaseNote="J. Fonseka & M. Jayasuriya (not out)"
                  />
                  <FowList fow={match.innings2Partial.fow} />
                  <BowlingCard title={`${match.teamA.short} Bowling`} rows={match.innings2Partial.bowling} live />
                </>
              )}

              {innings === 2 && !live && (
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
            </div>
          )}

          {/* INFO TAB */}
          {tab === "info" && (
            <div className="space-y-4 mb-8">
              <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4 font-cinzel">MATCH INFO</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    ["Series", `${match.tournamentName} — ${match.round}`],
                    ["Venue", match.venue],
                    ["Date & Time", `${match.date} · ${match.time}`],
                    ["Weather", (match as any).weather || "29°C · Clear Sky"],
                    ["Toss", match.toss],
                    ["Umpires", match.officials.umpires],
                    ["Third Umpire", match.officials.thirdUmpire],
                    ["Match Referee", match.officials.referee],
                    ["Format", match.officials.format],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-white/[0.02] border border-gold/10 rounded-md p-3 min-w-0">
                      <p className="text-gray-500 text-[10px] uppercase tracking-widest font-cinzel">{label}</p>
                      <p className="text-gray-200 text-sm mt-1 break-words">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SQUADS TAB */}
          {tab === "squads" && (
            <div className="space-y-6 mb-8">
              {match.squads.map((s) => (
                <MatchSquadPanel key={s.team} squad={s} />
              ))}
            </div>
          )}

          {/* OVERS TAB (CRICBUZZ LAYOUT) */}
          {tab === "overs" && (() => {
            const overOverData = getOverByOverData(innings)
            return (
              <div className="mb-8 space-y-4 fade-in">
                {/* Inner Innings Selector System */}
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
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                      innings === 2
                        ? "bg-gold text-black shadow-md shadow-gold/20"
                        : "bg-white/5 border border-gold/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    {match.teamB.short} (2nd Inn)
                  </button>
                </div>

                {/* Over by Over Container Table Element */}
                <div className="border border-gold/20 rounded-xl overflow-hidden bg-black/40 backdrop-blur-md">
                  {/* Table Header Row Component */}
                  <div className="grid grid-cols-[4rem_1fr_3.5rem] sm:grid-cols-[5.5rem_1fr_4.5rem] bg-white/[0.03] border-b border-gold/10 p-3 text-[10px] uppercase font-bold tracking-widest text-gray-400 font-cinzel">
                    <div>Overs</div>
                    <div>Balls</div>
                    <div className="text-right">Runs</div>
                  </div>

                  {/* Over Record Map Loops */}
                  {overOverData.map((ov, index) => (
                    <div
                      key={ov.num}
                      className={`grid grid-cols-[4rem_1fr_3.5rem] sm:grid-cols-[5.5rem_1fr_4.5rem] items-center p-4 transition-colors hover:bg-white/[0.01] ${
                        index < overOverData.length - 1 ? "border-b border-gold/10" : ""
                      }`}
                    >
                      {/* Left Column Stack Info */}
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white font-cinzel">Ov {ov.num}</h4>
                        <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{ov.score}</p>
                      </div>

                      {/* Middle Column Data Stack */}
                      <div className="space-y-2 min-w-0">
                        <p className="text-xs font-medium text-gray-300 break-words">{ov.matchUp}</p>

                        {/* Ball pill block clusters */}
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {ov.balls.map((b: string, ballIdx: number) => {
                            const isWicket = b.toUpperCase() === "W"
                            const isSix = b === "6"
                            const isFour = b === "4"

                            return (
                              <span
                                key={ballIdx}
                                className={`h-6 min-w-[1.5rem] px-1 rounded flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                                  isWicket
                                    ? "bg-red-600 text-white shadow-sm shadow-red-900/50 scale-105"
                                    : isSix
                                    ? "bg-purple-600/30 border border-purple-500 text-purple-400"
                                    : isFour
                                    ? "bg-cyan-600/30 border border-cyan-500 text-cyan-400"
                                    : b === "•"
                                    ? "bg-white/5 text-gray-500 border border-white/5"
                                    : "bg-white/10 text-gray-300 border border-white/10"
                                }`}
                              >
                                {b}
                              </span>
                            )
                          })}
                        </div>
                      </div>

                      {/* Right Column Total Value Stack */}
                      <div className="text-right text-base font-bold text-white font-cinzel pr-1">
                        {ov.totalRuns}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* GRAPHS TAB */}
          {tab === "graphs" && (
            <MatchGraphs
              match={match}
              live={live}
              overRunsB={overRunsB}
              winProb={winProb}
              stepIndex={stepIndex}
              overs1={getOverByOverData(1)}
              overs2={getOverByOverData(2)}
            />
          )}

          {/* STATS TAB */}
          {tab === "stats" && (
            <div className="space-y-4 mb-8">
              <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
                <h2 className="text-lg font-bold text-white mb-3 font-cinzel">WIN PROBABILITY</h2>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-white/10">
                  <div className="transition-all duration-700 bg-gold" style={{ width: `${winProb.a}%` }} />
                  <div className="transition-all duration-700 bg-red-600" style={{ width: `${winProb.b}%` }} />
                </div>
                <div className="flex justify-between mt-2 text-xs font-cinzel">
                  <span className="text-gold">{match.teamA.short} {winProb.a}%</span>
                  <span className="text-red-500">{match.teamB.short} {winProb.b}%</span>
                </div>
              </div>
            </div>
          )}

          <div className="text-center mb-16">
            <Link href={`/tournament/${tournamentSlug}`}>
              <Button className="bg-gold hover:bg-gold/90 py-2 text-black font-bold">Back to Tournament</Button>
            </Link>
          </div>
        </div>
      </section>

      <SectionDivider />
    </main>
  )
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
    // overflow-x-auto keeps a too-narrow viewport from ever forcing the
    // whole page to scroll sideways — only this table scrolls internally,
    // and only if it truly has to.
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
        {rows.map((row, i) => (
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
        ))}
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
      {dnb && <p className="text-gray-500 text-[10px] mt-2 break-words">Did not bat: {dnb.join(", ")}</p>}
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
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-4">
      <p className="text-gold text-xs uppercase tracking-widest font-cinzel mb-3">Fall of Wickets</p>
      <div className="flex flex-wrap gap-2">
        {fow.map((f) => (
          <span key={f[0]} className="text-[10.5px] text-gray-300 bg-white/[0.02] border border-gold/10 rounded-lg px-2.5 py-1.5">
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
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center p-0.5 leading-none z-0">
                  <span className="text-[5.5px] font-sans font-semibold text-gray-500 tracking-tighter uppercase">
                    Image not available
                  </span>
                </div>
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-white/15 via-transparent to-transparent text-xs font-bold text-gold font-cinzel z-10">
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
        <p className="text-[11px] font-cinzel uppercase tracking-widest text-gold/70 font-semibold mb-2 px-1">
          Playing XI
        </p>
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

      {bench.length > 0 && (
        <div className="space-y-3">
          {renderPlayerGrid(bench)}
        </div>
      )}
    </div>
  )
}