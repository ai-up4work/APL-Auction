"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Calendar,
  MapPin,
  Radio,
  Shield,
  Swords,
  Target,
  Trophy,
  Users,
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

type Tab = "scorecard" | "info" | "squads" | "stats"

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
  const [overRunsB, setOverRunsB] = useState<number[]>(match.innings2Partial.overRunsAtStart.concat(match.innings2Partial.over19ExtraRuns))
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

  const manhattanData = match.innings1.overRuns.map((v, i) => ({
    over: i + 1,
    [match.teamA.short]: v,
    [match.teamB.short]: (live ? overRunsB : match.innings2Final.overRuns)[i] ?? null,
  }))
  const wormData = (() => {
    let a = 0
    let b = 0
    return match.innings1.overRuns.map((v, i) => {
      a += v
      const bOver = (live ? overRunsB : match.innings2Final.overRuns)[i]
      b += bOver ?? 0
      return {
        over: i + 1,
        [match.teamA.short]: a,
        [match.teamB.short]: bOver !== undefined ? b : null,
      }
    })
  })()

  return (
    <main className="overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      <SiteHeader
        activeSection="tournament"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      {/* ═══════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════ */}
      <section className="pt-32 sm:pt-40 pb-10 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 text-center fade-in">
          <Badge className="bg-gold text-black hover:bg-gold/90 font-cinzel mb-3">
            {match.round} · {match.tournamentName}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-white font-cinzel">
            {match.teamA.name} <span className="text-gold">vs</span> {match.teamB.name}
          </h1>
          <div className="flex flex-wrap justify-center gap-6 mt-5 text-xs text-gray-400 font-cinzel uppercase tracking-wide">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-gold" /> {match.venue}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-gold" /> {match.date} · {match.time}
            </span>
          </div>
          <p className="text-gray-300 mt-4 text-sm">{match.toss}</p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SCORE STRIP
      ═══════════════════════════════════════════ */}
      <section className="px-4 relative z-10">
        <div className="container mx-auto max-w-3xl">
          <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8 glow-effect">
            <div className="flex justify-between items-center mb-4">
              {live ? (
                <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold font-cinzel px-3 py-1.5 rounded-full animate-pulse">
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
              <div className="rounded-lg p-4 border border-gold/10 bg-white/[0.02]">
                <span className="text-white font-bold font-cinzel">{match.teamA.short}</span>
                <p className="text-2xl font-bold text-white font-cinzel mt-1">
                  {match.innings1.total}/{match.innings1.wkts}
                  <span className="text-sm text-gray-400 font-normal ml-2">({match.innings1.overs} ov)</span>
                </p>
              </div>
              <div className={`rounded-lg p-4 border ${live ? "border-gold bg-gold/5" : "border-gold/10 bg-white/[0.02]"}`}>
                <span className="text-white font-bold font-cinzel">{match.teamB.short}</span>
                <p className="text-2xl font-bold text-white font-cinzel mt-1">
                  {runs}/{wkts}
                  <span className="text-sm text-gray-400 font-normal ml-2">
                    ({live ? overLabel : match.innings2Final.overs} ov)
                  </span>
                </p>
              </div>
            </div>

            <p className="text-white font-semibold mb-3 border-l-2 border-gold pl-3 text-sm">
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

            {!live && (
                <div className="mt-5 rounded-lg border border-green-600/40 bg-green-600/10 p-4 text-center">
                    <p className="text-green-500 font-semibold text-sm">
                    🏆 {match.resultNote}, chasing down {match.target} in 20 overs.
                    </p>
                    {match.innings2Final.potm && (
                    <p className="text-gray-400 text-xs mt-2">
                        Player of the Match: <b className="text-gold">{match.innings2Final.potm.name}</b> ({match.teamB.short}) —{" "}
                        {match.innings2Final.potm.note}
                    </p>
                    )}
                </div>
                )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          TABS
      ═══════════════════════════════════════════ */}
      <section className="px-4 relative z-10">
        <div className="container mx-auto max-w-3xl">
          <div className="bg-black/50 border border-gold/20 p-1 rounded-lg w-full flex flex-wrap gap-1 mb-8">
            {(["scorecard", "info", "squads", "stats"] as const).map((t) => (
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

          {/* SCORECARD */}
          {tab === "scorecard" && (
            <div className="mb-8">
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setInnings(1)}
                  className={`flex-1 text-xs font-cinzel uppercase px-3 py-2.5 rounded-md border transition-all ${
                    innings === 1 ? "bg-gold/15 border-gold text-gold font-bold" : "border-gold/20 text-gray-300"
                  }`}
                >
                  {match.teamA.short} — 1st Innings · {match.innings1.total}/{match.innings1.wkts}
                </button>
                <button
                  onClick={() => setInnings(2)}
                  className={`flex-1 text-xs font-cinzel uppercase px-3 py-2.5 rounded-md border transition-all ${
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

          {/* INFO */}
          {tab === "info" && (
            <div className="space-y-4 mb-8">
              <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4 font-cinzel">MATCH INFO</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    ["Series", `${match.tournamentName} — ${match.round}`],
                    ["Venue", match.venue],
                    ["Date & Time", `${match.date} · ${match.time}`],
                    ["Toss", match.toss],
                    ["Umpires", match.officials.umpires],
                    ["Third Umpire", match.officials.thirdUmpire],
                    ["Match Referee", match.officials.referee],
                    ["Format", match.officials.format],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-white/[0.02] border border-gold/10 rounded-md p-3">
                      <p className="text-gray-500 text-[10px] uppercase tracking-widest font-cinzel">{label}</p>
                      <p className="text-gray-200 text-sm mt-1">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-3 font-cinzel">PITCH & CONDITIONS</h2>
                <p className="text-gray-300 text-sm leading-relaxed">{match.pitch}</p>
              </div>

              <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-3 font-cinzel">SERIES CONTEXT</h2>
                <p className="text-gray-300 text-sm leading-relaxed">{match.context}</p>
              </div>
            </div>
          )}

          {/* SQUADS */}
          {tab === "squads" && (
            <div className="space-y-4 mb-8">
              <p className="text-gray-500 text-xs flex items-center gap-1.5 font-cinzel uppercase tracking-wide">
                <span className="h-2 w-2 rounded-full bg-gold inline-block" /> Highlighted = Playing XI for this match
              </p>
              {match.squads.map((s) => (
                <MatchSquadPanel key={s.team} squad={s} />
              ))}
            </div>
          )}

          {/* STATS */}
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

              <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
                <h2 className="text-lg font-bold text-white mb-3 font-cinzel">CURRENT PARTNERSHIP</h2>
                <div className="flex items-center justify-between border border-gold/10 rounded-md p-3 bg-white/[0.02]">
                  <p className="text-white text-sm">J. Fonseka &amp; M. Jayasuriya</p>
                  <p className="text-gold font-bold font-cinzel">
                    {partnership.runs} ({partnership.balls})
                  </p>
                </div>
                <div className="flex items-center justify-between border border-gold/10 rounded-md p-3 bg-white/[0.02] mt-2 opacity-60">
                  <p className="text-white text-sm">Best this innings — Perera &amp; Gunawardena</p>
                  <p className="text-gray-300 font-cinzel">57 (38)</p>
                </div>
              </div>

              <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
                <h2 className="text-lg font-bold text-white mb-3 font-cinzel">
                  OVER-BY-OVER SUMMARY — {match.teamB.short} INNINGS
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {(live ? overRunsB : match.innings2Final.overRuns).map((r, i) => (
                    <span
                      key={i}
                      className={`text-[11px] font-cinzel rounded-md px-2 py-1 border min-w-[2.2rem] text-center ${
                        r >= 12 ? "border-gold text-gold font-bold" : "border-gold/10 text-gray-300"
                      }`}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
                <h2 className="text-lg font-bold text-white mb-3 font-cinzel">MANHATTAN — RUNS PER OVER</h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={manhattanData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,166,35,0.1)" />
                      <XAxis dataKey="over" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                      <Tooltip contentStyle={{ background: "#000", border: "1px solid rgba(245,166,35,0.3)" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey={match.teamA.short} fill="#f5a623" radius={[3, 3, 0, 0]} />
                      <Bar dataKey={match.teamB.short} fill="#dc2626" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
                <h2 className="text-lg font-bold text-white mb-3 font-cinzel">WORM — CUMULATIVE SCORE</h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={wormData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,166,35,0.1)" />
                      <XAxis dataKey="over" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                      <Tooltip contentStyle={{ background: "#000", border: "1px solid rgba(245,166,35,0.3)" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey={match.teamA.short} stroke="#f5a623" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey={match.teamB.short} stroke="#dc2626" strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
                <h2 className="text-lg font-bold text-white mb-3 font-cinzel flex items-center gap-1.5">
                  <Radio className="h-4 w-4 text-gold" /> LIVE COMMENTARY FEED
                </h2>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {commentary.length === 0 && (
                    <p className="text-gray-500 text-xs">Commentary will appear here as the over unfolds.</p>
                  )}
                  {commentary.map((c, i) => (
                    <div
                      key={i}
                      className={`text-sm rounded-md px-3 py-2 border-l-2 bg-white/[0.02] ${
                        c.wkt ? "border-red-600 text-red-500" : "border-gold/20 text-gray-200"
                      }`}
                    >
                      <span className="text-gray-500 text-xs mr-2">{c.ball}</span>
                      {c.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="text-center mb-16">
            <Link href={`/tournament/${tournamentSlug}`}>
              <Button className="bg-gold hover:bg-gold/90 text-black font-bold">Back to Tournament</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 text-center border-t border-gold/10 relative z-10">
        <Trophy className="h-6 w-6 text-gold mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2 font-cinzel">
          Follow every ball of the <span className="text-gold">{match.round}</span>
        </h3>
        <p className="text-gray-400 text-sm mb-6">
          Live scores, scorecards, and stats update automatically as the match unfolds.
        </p>
        <button className="inline-flex items-center gap-2 rounded-lg bg-gold hover:bg-gold/90 transition-colors px-5 py-3 text-xs font-cinzel tracking-widest uppercase text-black font-bold">
          <Target className="h-4 w-4" />
          Follow Live Scores
        </button>
      </section>

      <SectionDivider />
      <SiteFooter scrollToSection={scrollToSection} handleNavigation={handleNavigation} />
    </main>
  )
}

// ─────────────────────────────────────────────────────────────
// SHARED "TABLE" GRID
// ─────────────────────────────────────────────────────────────
function DataGrid({
  columns,
  rows,
}: {
  columns: { key: string; label: string; align?: "left" | "right"; grow?: boolean }[]
  rows: Record<string, React.ReactNode>[]
}) {
  const template = columns.map((c) => (c.grow ? "1fr" : "3.2rem")).join(" ")
  return (
    <div className="border border-gold/10 rounded-md overflow-hidden">
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
  )
}

// ─────────────────────────────────────────────────────────────
// BATTING CARD
// ─────────────────────────────────────────────────────────────
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
      <div>
        <p className="text-gray-100 font-medium">{b.name}</p>
        <p className={`text-[10.5px] mt-0.5 ${b.notOut ? "text-green-500" : "text-gray-500"}`}>
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
      {creaseNote && <p className="text-gray-400 text-[11px] mt-3">At the crease: {creaseNote}</p>}
      <div className="flex items-center justify-between mt-3 text-[11px] text-gray-400">
        <span>
          Extras {extras} <span className="text-gray-600">({extrasNote})</span>
        </span>
        <span className="text-white font-bold">
          Total {total}/{wkts} <span className="text-gray-500 font-normal">({overs} ov)</span>
        </span>
      </div>
      {dnb && <p className="text-gray-500 text-[10px] mt-2">Did not bat: {dnb.join(", ")}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// BOWLING CARD
// ─────────────────────────────────────────────────────────────
function BowlingCard({ title, rows, live }: { title: string; rows: BowlingRow[]; live?: boolean }) {
  const columns = [
    { key: "name", label: "Bowler", grow: true },
    { key: "o", label: "O", align: "right" as const },
    { key: "r", label: "R", align: "right" as const },
    { key: "w", label: "W", align: "right" as const },
    { key: "econ", label: "Econ", align: "right" as const },
  ]
  const rowData = rows.map((b) => ({
    name: <p className="text-gray-100 font-medium">{b.name}</p>,
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

// ─────────────────────────────────────────────────────────────
// FALL OF WICKETS
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// MATCH SQUAD PANEL
// ─────────────────────────────────────────────────────────────
function MatchSquadPanel({ squad }: { squad: MatchSquad }) {
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-gold" />
          <p className="text-white font-bold font-cinzel">{squad.team}</p>
        </div>
        <p className="text-gray-400 text-xs flex items-center gap-1.5">
          <Users className="h-3 w-3" /> {squad.players.length} players · Capt. {squad.captain}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {squad.players.map((p) => (
          <div
            key={p.name}
            className={`flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border ${
              p.xi ? "bg-gold/10 border-gold/40" : "bg-white/[0.02] border-gold/10"
            }`}
          >
            <span
              className={`h-6 w-6 rounded-full text-[10px] font-bold flex items-center justify-center font-cinzel ${
                p.xi ? "bg-gold/25 text-gold" : "bg-white/10 text-gray-400"
              }`}
            >
              {initials(p.name)}
            </span>
            <div>
              <p className={`text-xs ${p.xi ? "text-white" : "text-gray-400"}`}>{p.name}</p>
              <p className="text-gray-500 text-[9px]">{p.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}