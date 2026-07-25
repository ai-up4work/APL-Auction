"use client"

import { useState, useEffect } from "react"
import { Lock } from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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
  /** Explicit — mirrors MatchDetailClient's `innings2Started`
   *  (match.currentInnings === 2). Drives locking of the 2nd-innings
   *  toggle on every per-innings sub-view (Ball Map, Partnerships) so
   *  they can't show empty/fake 2nd-innings data before the chase has
   *  actually begun. */
  innings2Started: boolean
  /** True once the match is finished. Used by WinProbabilityView to
   *  append a final, resolved data point (100/0, or 50/50 on a tie)
   *  instead of letting the chart trail off at whatever the last live
   *  reading happened to be. `winProb` itself is expected to already be
   *  the final snapped value in this case — MatchDetailClient computes
   *  it once and passes the same value to both the score strip and here,
   *  so the two never disagree. */
  completed: boolean
}

type GraphTab = "ballmap" | "winprob" | "partnerships" | "runrate" | "worm"

const GRAPH_TABS: { key: GraphTab; label: string }[] = [
  { key: "winprob", label: "Win Probability" },
  { key: "partnerships", label: "Partnerships" },
  { key: "runrate", label: "Run Rate" },
  { key: "worm", label: "Worm" },
]

const GOLD = "#F5A623"
const RED = "#EF4444"
const GREY = "#6b7280"

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

function GraphTooltip({ active, payload, label, unit = "", labelFormatter }: any) {
  if (!active || !payload?.length) return null
  // When a custom labelFormatter is supplied it already produces the
  // full heading (e.g. "Inn 1 (EMB) · Over 4.2"), so don't also prefix
  // "Over " in front of it — only do that for the plain-numeric-over
  // charts that don't pass one.
  const displayLabel = labelFormatter ? labelFormatter(label) : `Over ${label}`
  // Series that are intentionally null (e.g. team lines during the
  // pre-chase portion of the win-probability graph, or the grey "flat"
  // series once the chase has started) shouldn't render as a
  // meaningless "-" row in the tooltip.
  const visiblePayload = payload.filter((p: any) => p.value !== null && p.value !== undefined)
  if (!visiblePayload.length) return null
  return (
    <div className="bg-black/90 border border-gold/30 rounded-md px-3 py-2 text-xs font-cinzel">
      <p className="text-gray-400 mb-1">{displayLabel}</p>
      {visiblePayload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-bold">
          {p.name ?? p.dataKey}: {p.value}
          {unit}
        </p>
      ))}
    </div>
  )
}

/** Shown in place of a per-innings sub-view when the 2nd innings is
 *  selected but hasn't actually started yet. Keeps the "locked" message
 *  consistent with LockedTabPanel in the main match page instead of each
 *  view inventing its own empty-state text. */
function Innings2LockedPanel({ teamB }: { teamB: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 border border-dashed border-gold/20 rounded-lg bg-white/[0.02]">
      <div className="h-12 w-12 rounded-full bg-white/5 border border-gold/20 flex items-center justify-center mb-4">
        <Lock className="h-5 w-5 text-gray-500" />
      </div>
      <p className="text-gray-200 font-semibold font-cinzel uppercase tracking-wide text-sm mb-2">
        2nd innings not started
      </p>
      <p className="text-gray-500 text-sm max-w-sm">
        {teamB} haven't come out to bat yet — this fills in the moment the chase begins.
      </p>
    </div>
  )
}

function InningsToggle({
  value,
  onChange,
  teamA,
  teamB,
  locked2,
}: {
  value: 1 | 2
  onChange: (v: 1 | 2) => void
  teamA: string
  teamB: string
  /** When true, the 2nd-innings button is disabled and shown dashed +
   *  with a lock icon, mirroring the Scorecard/Overs tabs' innings
   *  toggle so the whole page treats an unstarted 2nd innings the same
   *  way everywhere. */
  locked2?: boolean
}) {
  return (
    <div className="flex gap-2 mb-5">
      <button
        onClick={() => onChange(1)}
        className={`px-4 py-1.5 rounded-full text-xs font-bold font-cinzel transition-all ${
          value === 1
            ? "bg-gold text-black shadow-md shadow-gold/20"
            : "bg-white/5 border border-gold/10 text-gray-400 hover:text-white"
        }`}
      >
        {teamA} (1st Inn)
      </button>
      <button
        onClick={() => onChange(2)}
        disabled={locked2}
        title={locked2 ? "2nd innings — locked until it starts" : undefined}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold font-cinzel transition-all disabled:cursor-not-allowed ${
          value === 2
            ? "bg-gold text-black shadow-md shadow-gold/20"
            : locked2
              ? "bg-white/[0.02] border border-dashed border-gray-700 text-gray-600"
              : "bg-white/5 border border-gold/10 text-gray-400 hover:text-white"
        }`}
      >
        {locked2 && <Lock className="h-2.5 w-2.5" />}
        {teamB} (2nd Inn)
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SUB-VIEWS
// ─────────────────────────────────────────────────────────────

function BallMapView({
  match,
  overs1,
  overs2,
  innings2Started,
}: {
  match: MatchDetail
  overs1: OverRow[]
  overs2: OverRow[]
  innings2Started: boolean
}) {
  // Default to whichever innings is actually live/available — 2nd
  // innings once it's started, otherwise pin to the 1st so we never
  // default-select a locked, empty innings.
  const [inn, setInn] = useState<1 | 2>(innings2Started ? 2 : 1)

  // Initial state above only covers first mount. If this view is opened
  // while the 1st innings is still in progress and the 2nd innings then
  // starts while it's still on screen, re-sync here too — otherwise the
  // toggle stays stuck on the 1st innings until the visitor manually
  // clicks over, mirroring the resync effect on the main match page.
  useEffect(() => {
    setInn(innings2Started ? 2 : 1)
  }, [innings2Started])

  const showLocked = inn === 2 && !innings2Started
  const rows = inn === 1 ? overs1 : overs2
  const team = inn === 1 ? match.teamA : match.teamB
  const header = rows[0]?.score ?? "0-0"

  return (
    <div className="fade-in">
      <InningsToggle
        value={inn}
        onChange={setInn}
        teamA={match.teamA.short}
        teamB={match.teamB.short}
        locked2={!innings2Started}
      />

      {showLocked ? (
        <Innings2LockedPanel teamB={match.teamB.short} />
      ) : (
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
      )}
      {!showLocked && (
        <p className="text-[11px] text-gray-500 mt-3">
          Tap an over to see who bowled it. Boundaries and wickets are highlighted.
        </p>
      )}
    </div>
  )
}

/** Parses an "overs.balls" string like "4.2" into total legal balls (26),
 *  so consecutive points can be compared numerically regardless of the
 *  6-balls-per-over rollover. */
function ballsBowled(overStr: string) {
  const [o, b] = overStr.split(".").map(Number)
  return (o || 0) * 6 + (b || 0)
}

function WinProbabilityView({
  match,
  winProb,
  stepIndex,
  completed,
}: {
  match: MatchDetail
  winProb: { a: number; b: number }
  stepIndex: number
  completed: boolean
}) {
  const played = match.liveScript.slice(0, stepIndex)
  const startWpB = match.liveScript[0]?.wpB ?? 50

  // `idx` is a strictly unique, monotonic key used for positioning on the
  // x-axis. `ball` (over.ball string) is NOT unique across the two
  // innings — innings 1 (flat 50/50) and innings 2 (real curve) both
  // start their over/ball labels back at "0.1", "0.2", etc.
  const raw = [
    {
      idx: 0,
      ball: match.innings2Partial.overAtStart,
      [match.teamA.short]: 100 - startWpB,
      [match.teamB.short]: startWpB,
    },
    ...played.map((s, i) => ({
      idx: i + 1,
      ball: s.ball,
      [match.teamA.short]: s.wpA,
      [match.teamB.short]: s.wpB,
    })),
  ]

  // Detect exactly where the 2nd innings begins: the ball-label counter
  // resets from something like "19.6" back down to "0.1". That reset is
  // the innings boundary — everything before it is the flat, no-chase-yet
  // 1st innings; everything from it onward is the real chase.
  const transitionIdx = (() => {
    for (let i = 1; i < raw.length; i++) {
      if (ballsBowled(raw[i].ball) < ballsBowled(raw[i - 1].ball)) return i
    }
    return null
  })()

  // Split into two visual layers so the graph itself communicates the
  // innings change, not just a tooltip: a muted grey "flat" line covers
  // the 1st-innings stretch (there's no chase pressure yet, so 50/50 is
  // correct — not missing data), and the real gold/red team lines only
  // populate from the moment the chase actually starts. The point at
  // transitionIdx is included in both series so the two segments join
  // up with no visual gap.
  const data = raw.map((d, i) => {
    const chaseStarted = transitionIdx !== null && i >= transitionIdx
    const isBoundary = transitionIdx !== null && i === transitionIdx
    return {
      ...d,
      flat: transitionIdx === null || i <= transitionIdx ? 50 : null,
      [match.teamA.short]: chaseStarted || isBoundary ? d[match.teamA.short] : null,
      [match.teamB.short]: chaseStarted || isBoundary ? d[match.teamB.short] : null,
    }
  })

  // Once the match is decided, append one final resolved point (100/0,
  // or 50/50 on a tie — whatever `winProb` was snapped to by the parent)
  // so the chart visibly settles on the result instead of just stopping
  // wherever the last live ball happened to leave it.
  const chartData = completed && data.length > 0
    ? [
        ...data,
        {
          idx: data.length,
          ball: "Final",
          flat: null,
          [match.teamA.short]: winProb.a,
          [match.teamB.short]: winProb.b,
        },
      ]
    : data
  const resultIdx = completed && data.length > 0 ? chartData.length - 1 : null

  const pointAt = (idx: number) => chartData[Math.round(idx)]
  const tickLabelAt = (idx: number) => pointAt(idx)?.ball ?? idx
  const tooltipLabelAt = (idx: number) => {
    const point = pointAt(idx)
    if (!point) return idx
    if (resultIdx !== null && Math.round(idx) === resultIdx) return "Final result"
    const inChase = transitionIdx !== null && Math.round(idx) >= transitionIdx
    const battingTeam = inChase ? match.teamB.short : match.teamA.short
    const inningsLabel = inChase ? "2nd innings" : "1st innings"
    return `${inningsLabel} (${battingTeam}) · Over ${point.ball}`
  }

  return (
    <div className="fade-in">
      <p className="text-gray-400 text-xs mb-1">
        Live win probability, ball by ball, based on the current state of the chase.
      </p>
      {transitionIdx !== null ? (
        <p className="text-gray-500 text-[11px] mb-4">
          <span className="inline-block h-1.5 w-3 rounded-full bg-gray-500 mr-1.5 align-middle" />
          Grey = 1st innings (no chase pressure yet)
          <span className="mx-2 text-gray-700">|</span>
          <span className="inline-block h-1.5 w-3 rounded-full bg-gold mr-1.5 align-middle" />
          Colour = the chase, from the moment it began
        </p>
      ) : (
        <p className="text-gray-500 text-[11px] mb-4 italic">
          Still in the 1st innings — the chase hasn't started, so probability sits flat at 50/50.
        </p>
      )}
      {completed && (
        <p className="text-gray-300 text-xs font-cinzel mb-4">
          <span className="text-gold font-bold">Final: </span>
          {winProb.a === winProb.b
            ? "Match tied"
            : winProb.a > winProb.b
              ? `${match.teamA.short} won`
              : `${match.teamB.short} won`}
        </p>
      )}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="wpA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity={0.5} />
                <stop offset="100%" stopColor={GOLD} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="wpB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={RED} stopOpacity={0.5} />
                <stop offset="100%" stopColor={RED} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="wpFlat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GREY} stopOpacity={0.35} />
                <stop offset="100%" stopColor={GREY} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis
              dataKey="idx"
              type="number"
              domain={[0, chartData.length - 1]}
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              axisLine={{ stroke: "#ffffff20" }}
              tickFormatter={tickLabelAt}
            />
            <YAxis domain={[0, 100]} tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={{ stroke: "#ffffff20" }} />
            <Tooltip content={<GraphTooltip unit="%" labelFormatter={tooltipLabelAt} />} />

            {/* Pre-chase, 1st-innings stretch: flat, muted, informational. */}
            <Area
              type="monotone"
              dataKey="flat"
              name="Pre-chase (1st innings)"
              stroke={GREY}
              strokeDasharray="4 3"
              fill="url(#wpFlat)"
              strokeWidth={1.5}
              connectNulls={false}
            />

            {/* Real chase, from the moment innings 2 begins. */}
            <Area
              type="monotone"
              dataKey={match.teamA.short}
              stroke={GOLD}
              fill="url(#wpA)"
              strokeWidth={2}
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey={match.teamB.short}
              stroke={RED}
              fill="url(#wpB)"
              strokeWidth={2}
              connectNulls={false}
            />

            {transitionIdx !== null && (
              <ReferenceLine
                x={transitionIdx}
                stroke="#ffffff60"
                strokeDasharray="3 3"
                label={{
                  value: "Chase begins",
                  position: "top",
                  fill: "#e5e7eb",
                  fontSize: 10,
                }}
              />
            )}
            {resultIdx !== null && (
              <ReferenceLine
                x={resultIdx}
                stroke={GOLD}
                strokeDasharray="2 2"
                label={{
                  value: "Result",
                  position: "top",
                  fill: GOLD,
                  fontSize: 10,
                }}
              />
            )}
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

function PartnershipsView({ match, innings2Started }: { match: MatchDetail; innings2Started: boolean }) {
  // Same reasoning as BallMapView: default to whichever innings is
  // actually current, and re-sync if that changes while this view is
  // already open (e.g. the chase starts while a visitor is looking at
  // the 1st-innings partnerships).
  const [inn, setInn] = useState<1 | 2>(innings2Started ? 2 : 1)
  useEffect(() => {
    setInn(innings2Started ? 2 : 1)
  }, [innings2Started])
  const showLocked = inn === 2 && !innings2Started
  const fow = inn === 1 ? match.innings1.fow : match.innings2Partial.fow

  // FowEntry is ["wkt-score", "batterName", "over"], e.g. ["1-28", "Nuwan Dias", "4.2"].
  // The score lives in the part after the dash in index 0 — NOT index 1 (that's the name).
  const scoreAtFall = (entry: (typeof fow)[number]) => Number(entry[0].split("-")[1] ?? entry[0])

  const partnerships = fow.map((f, i) => {
    const prevRuns = i === 0 ? 0 : scoreAtFall(fow[i - 1])
    const prevOver = i === 0 ? 0 : Number(fow[i - 1][2])
    return {
      wkt: i + 1,
      runs: scoreAtFall(f) - prevRuns,
      overs: (Number(f[2]) - prevOver).toFixed(1),
      fallScore: f[1],
      fallOver: f[2],
    }
  })

  const maxRuns = Math.max(...partnerships.map((p) => p.runs), 1)

  return (
    <div className="fade-in">
      <InningsToggle
        value={inn}
        onChange={setInn}
        teamA={match.teamA.short}
        teamB={match.teamB.short}
        locked2={!innings2Started}
      />

      {showLocked ? (
        <Innings2LockedPanel teamB={match.teamB.short} />
      ) : !fow?.length ? (
        <p className="text-gray-500 text-sm py-8 text-center">No partnership data available for this innings yet.</p>
      ) : (
        <>
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
        </>
      )}
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

export default function MatchGraphs({
  match,
  live,
  overRunsB,
  winProb,
  stepIndex,
  overs1,
  overs2,
  innings2Started,
  completed,
}: MatchGraphsProps) {
  const [graphTab, setGraphTab] = useState<GraphTab>("winprob")

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
        {graphTab === "ballmap" && (
          <BallMapView match={match} overs1={overs1} overs2={overs2} innings2Started={innings2Started} />
        )}
        {graphTab === "winprob" && (
          <WinProbabilityView match={match} winProb={winProb} stepIndex={stepIndex} completed={completed} />
        )}
        {graphTab === "partnerships" && <PartnershipsView match={match} innings2Started={innings2Started} />}
        {graphTab === "runrate" && <RunRateView match={match} runRateChartData={runRateChartData} />}
        {graphTab === "worm" && <WormView match={match} wormChartData={wormChartData} />}
      </div>
    </div>
  )
}