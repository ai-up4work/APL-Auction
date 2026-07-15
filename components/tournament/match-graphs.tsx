"use client"

import { useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { MatchDetail } from "@/data/tournament-data"

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

/** One row of the over-by-over ball breakdown, same shape the
 *  scorecard's "Overs" tab already builds via getOverByOverData(). */
export interface OverRow {
  num: number
  score: string
  matchUp: string
  balls: string[]
  totalRuns: number
}

interface MatchGraphsProps {
  match: MatchDetail
  live: boolean
  overRunsB: number[]
  winProb: { a: number; b: number }
  stepIndex: number
  /** Over-by-over ball data for innings 1 and 2 — pass the same arrays
   *  the Overs tab uses (getOverByOverData(1) / getOverByOverData(2)). */
  overs1: OverRow[]
  overs2: OverRow[]
}

type GraphTab = "ballmap" | "winprob" | "partnerships" | "overs" | "runrate" | "worm"

const GRAPH_TABS: { key: GraphTab; label: string }[] = [
  { key: "winprob", label: "Win Probability" },
  { key: "partnerships", label: "Partnerships" },
  { key: "overs", label: "Overs" },
  { key: "runrate", label: "Run Rate" },
  { key: "worm", label: "Worm" },
]

const GOLD = "#F5A623"
const RED = "#EF4444"

function ballTone(b: string) {
  const isWicket = b.toUpperCase() === "W"
  const isSix = b === "6"
  const isFour = b === "4"
  if (isWicket) return "bg-red-600 text-white shadow-sm shadow-red-900/50"
  if (isSix) return "bg-purple-600/30 border border-purple-500 text-purple-400"
  if (isFour) return "bg-cyan-600/30 border border-cyan-500 text-cyan-400"
  if (b === "•") return "bg-white/5 text-gray-500 border border-white/5"
  return "bg-white/10 text-gray-300 border border-white/10"
}

// ─────────────────────────────────────────────────────────────
// SHARED BITS
// ─────────────────────────────────────────────────────────────

function GraphTooltip({ active, payload, label, unit = "" }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-black/90 border border-gold/30 rounded-md px-3 py-2 text-xs font-cinzel">
      <p className="text-gray-400 mb-1">Over {label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-bold">
          {p.dataKey}: {p.value ?? "-"}
          {unit}
        </p>
      ))}
    </div>
  )
}

function InningsToggle({
  value,
  onChange,
  teamA,
  teamB,
}: {
  value: 1 | 2
  onChange: (v: 1 | 2) => void
  teamA: string
  teamB: string
}) {
  return (
    <div className="flex gap-2 mb-5">
      {[
        [1, `${teamA} (1st Inn)`],
        [2, `${teamB} (2nd Inn)`],
      ].map(([v, label]) => (
        <button
          key={v as number}
          onClick={() => onChange(v as 1 | 2)}
          className={`px-4 py-1.5 rounded-full text-xs font-bold font-cinzel transition-all ${
            value === v
              ? "bg-gold text-black shadow-md shadow-gold/20"
              : "bg-white/5 border border-gold/10 text-gray-400 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SUB-VIEWS
// ─────────────────────────────────────────────────────────────

function BallMapView({ match, overs1, overs2 }: { match: MatchDetail; overs1: OverRow[]; overs2: OverRow[] }) {
  const [inn, setInn] = useState<1 | 2>(2)
  const rows = inn === 1 ? overs1 : overs2
  const team = inn === 1 ? match.teamA : match.teamB
  const header = rows[0]?.score ?? "0-0"

  return (
    <div className="fade-in">
      <InningsToggle value={inn} onChange={setInn} teamA={match.teamA.short} teamB={match.teamB.short} />

      <div className="border border-gold/20 rounded-xl overflow-hidden bg-black/40 backdrop-blur-md">
        <div className="flex items-center justify-between p-4 border-b border-gold/10 bg-white/[0.03]">
          <span className="text-white font-bold font-cinzel">{team.short}</span>
          <span className="text-gray-400 text-sm font-cinzel">{header}</span>
        </div>

        <div className="divide-y divide-gold/10">
          {[...rows].reverse().map((ov) => (
            <div key={ov.num} className="flex items-center gap-4 p-4">
              <span className="text-xs text-gray-500 font-cinzel w-6 shrink-0">{ov.num}</span>
              <div className="flex flex-wrap gap-1.5">
                {ov.balls.map((b, i) => (
                  <span
                    key={i}
                    className={`h-7 min-w-[1.75rem] px-1 rounded flex items-center justify-center text-xs font-bold ${ballTone(b)}`}
                  >
                    {b}
                  </span>
                ))}
              </div>
              <span className="ml-auto text-sm font-bold text-white font-cinzel shrink-0">{ov.totalRuns}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-gray-500 mt-3">Tap an over to see who bowled it. Boundaries and wickets are highlighted.</p>
    </div>
  )
}

function WinProbabilityView({ match, winProb, stepIndex }: { match: MatchDetail; winProb: { a: number; b: number }; stepIndex: number }) {
  const played = match.liveScript.slice(0, stepIndex)
  const startWpB = match.liveScript[0]?.wpB ?? 50
  const data = [
    { ball: match.innings2Partial.overAtStart, [match.teamA.short]: 100 - startWpB, [match.teamB.short]: startWpB },
    ...played.map((s) => ({ ball: s.ball, [match.teamA.short]: s.wpA, [match.teamB.short]: s.wpB })),
  ]


  return (
    <div className="fade-in">
      <p className="text-gray-400 text-xs mb-4">
        Live win probability, ball by ball, based on the current state of the chase.
      </p>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="wpA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity={0.5} />
                <stop offset="100%" stopColor={GOLD} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="wpB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={RED} stopOpacity={0.5} />
                <stop offset="100%" stopColor={RED} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="ball" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={{ stroke: "#ffffff20" }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={{ stroke: "#ffffff20" }} />
            <Tooltip content={<GraphTooltip unit="%" />} />
            <Area type="monotone" dataKey={match.teamA.short} stroke={GOLD} fill="url(#wpA)" strokeWidth={2} />
            <Area type="monotone" dataKey={match.teamB.short} stroke={RED} fill="url(#wpB)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between mt-4 text-xs font-cinzel px-2">
        <span className="text-gold font-bold">
          {match.teamA.short} {winProb.a}%
        </span>
        <span className="text-red-500 font-bold">
          {match.teamB.short} {winProb.b}%
        </span>
      </div>
    </div>
  )
}

function PartnershipsView({ match }: { match: MatchDetail }) {
  const [inn, setInn] = useState<1 | 2>(1)
  const fow = inn === 1 ? match.innings1.fow : match.innings2Partial.fow

  if (!fow?.length) {
    return <p className="text-gray-500 text-sm py-8 text-center">No partnership data available for this innings yet.</p>
  }

  const partnerships = fow.map((f, i) => {
    const prevRuns = i === 0 ? 0 : Number(fow[i - 1][1])
    const prevOver = i === 0 ? 0 : Number(fow[i - 1][2])
    return {
      wkt: i + 1,
      runs: Number(f[1]) - prevRuns,
      overs: (Number(f[2]) - prevOver).toFixed(1),
      fallScore: f[1],
      fallOver: f[2],
    }
  })

  const maxRuns = Math.max(...partnerships.map((p) => p.runs), 1)

  return (
    <div className="fade-in">
      <InningsToggle value={inn} onChange={setInn} teamA={match.teamA.short} teamB={match.teamB.short} />
      <div className="space-y-3">
        {partnerships.map((p) => (
          <div key={p.wkt} className="bg-white/[0.02] border border-gold/10 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 font-cinzel uppercase tracking-widest">
                Wkt {p.wkt} partnership
              </span>
              <span className="text-white font-bold font-cinzel">
                {p.runs} <span className="text-gray-500 font-normal">({p.overs} ov)</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gold rounded-full transition-all"
                style={{ width: `${(p.runs / maxRuns) * 100}%` }}
              />
            </div>
            <p className="text-[10.5px] text-gray-500 mt-2">
              Fell at {p.fallScore} ({p.fallOver} ov)
            </p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-500 mt-4">
        Runs added between wickets, derived from the fall-of-wickets timeline. Add named batter pairs to the data
        model to show individual contributions like a full partnerships breakdown.
      </p>
    </div>
  )
}

function OversBarView({ match, oversChartData }: { match: MatchDetail; oversChartData: Record<string, any>[] }) {
  return (
    <div className="fade-in">
      <p className="text-gray-400 text-xs mb-4">Runs scored per over across both innings.</p>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={oversChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="over" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={{ stroke: "#ffffff20" }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={{ stroke: "#ffffff20" }} />
            <Tooltip content={<GraphTooltip />} />
            <Bar dataKey={match.teamA.short} fill={RED} radius={[3, 3, 0, 0]} />
            <Bar dataKey={match.teamB.short} fill={GOLD} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-6 mt-3 text-xs font-cinzel justify-center">
        <span className="flex items-center gap-1.5 text-gray-400">
          <span className="h-2 w-2 rounded-full" style={{ background: RED }} /> {match.teamA.short}
        </span>
        <span className="flex items-center gap-1.5 text-gray-400">
          <span className="h-2 w-2 rounded-full" style={{ background: GOLD }} /> {match.teamB.short}
        </span>
      </div>
    </div>
  )
}

function RunRateView({ match, runRateChartData }: { match: MatchDetail; runRateChartData: Record<string, any>[] }) {
  return (
    <div className="fade-in">
      <p className="text-gray-400 text-xs mb-4">Cumulative run rate over the course of each innings.</p>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={runRateChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="over" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={{ stroke: "#ffffff20" }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={{ stroke: "#ffffff20" }} />
            <Tooltip content={<GraphTooltip />} />
            <Line type="monotone" dataKey={match.teamA.short} stroke={RED} strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey={match.teamB.short} stroke={GOLD} strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function WormView({ match, wormChartData }: { match: MatchDetail; wormChartData: Record<string, any>[] }) {
  return (
    <div className="fade-in">
      <p className="text-gray-400 text-xs mb-4">Score progression, over by over.</p>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={wormChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="over" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={{ stroke: "#ffffff20" }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={{ stroke: "#ffffff20" }} />
            <Tooltip content={<GraphTooltip />} />
            <Line type="monotone" dataKey={match.teamA.short} stroke={RED} strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey={match.teamB.short} stroke={GOLD} strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function MatchGraphs({ match, live, overRunsB, winProb, stepIndex, overs1, overs2 }: MatchGraphsProps) {
  const [graphTab, setGraphTab] = useState<GraphTab>("ballmap")

  const teamAOverRuns = match.innings1.overRuns
  const teamBOverRuns = live ? overRunsB : match.innings2Final.overRuns

  const oversChartData = teamAOverRuns.map((v, i) => ({
    over: i + 1,
    [match.teamA.short]: v,
    [match.teamB.short]: teamBOverRuns[i] ?? null,
  }))

  const wormChartData = (() => {
    let a = 0
    let b = 0
    return teamAOverRuns.map((v, i) => {
      a += v
      const bOver = teamBOverRuns[i]
      const hasB = bOver !== undefined
      if (hasB) b += bOver
      return { over: i + 1, [match.teamA.short]: a, [match.teamB.short]: hasB ? b : null }
    })
  })()

  const runRateChartData = (() => {
    let a = 0
    let b = 0
    return teamAOverRuns.map((v, i) => {
      a += v
      const bOver = teamBOverRuns[i]
      const hasB = bOver !== undefined
      if (hasB) b += bOver
      return {
        over: i + 1,
        [match.teamA.short]: Number((a / (i + 1)).toFixed(2)),
        [match.teamB.short]: hasB ? Number((b / (i + 1)).toFixed(2)) : null,
      }
    })
  })()

  return (
    <div className="mb-8 fade-in">
      <div className="bg-black/50 border border-gold/20 p-1 rounded-lg w-full flex flex-wrap gap-1 mb-6">
        {GRAPH_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setGraphTab(t.key)}
            className={`font-cinzel text-[11px] uppercase tracking-wide px-3.5 py-2 rounded-md transition-all duration-300 ${
              graphTab === t.key ? "bg-gold text-black" : "text-gray-300 hover:text-gold"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
        {graphTab === "ballmap" && <BallMapView match={match} overs1={overs1} overs2={overs2} />}
        {graphTab === "winprob" && <WinProbabilityView match={match} winProb={winProb} stepIndex={stepIndex} />}
        {graphTab === "partnerships" && <PartnershipsView match={match} />}
        {graphTab === "overs" && <OversBarView match={match} oversChartData={oversChartData} />}
        {graphTab === "runrate" && <RunRateView match={match} runRateChartData={runRateChartData} />}
        {graphTab === "worm" && <WormView match={match} wormChartData={wormChartData} />}
      </div>
    </div>
  )
}