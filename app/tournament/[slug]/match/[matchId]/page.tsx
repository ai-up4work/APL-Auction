// app/tournament/[slug]/match/[matchId]/page.tsx
"use client"

/**
 * MATCH CENTER PAGE — app/match/[matchId]/page.tsx
 *
 * Built with the SAME design tokens and utility classes as the tournament
 * microsite (overlay-theme.css):
 *   - Color: var(--color-theme-orange) accent, var(--color-surface*) layers,
 *     var(--color-on-surface / on-surface-variant / outline) text,
 *     var(--color-status-live) for the live indicator
 *   - Type: font-headline-lg / font-headline-md (Archivo Narrow),
 *     font-body-md / font-body-lg (Inter), font-label-mono / font-label-xs (Geist Mono)
 *   - Components reused as-is: .glass-panel, .scoreboard-strip, .scoreboard-main,
 *     .scoreboard-runs, .scoreboard-wkts, .scoreboard-meta, .squad-list / .squad-chip /
 *     .squad-avatar, .crew-slot, .summary-tile, .pulse-live, .tally
 *
 * This is a MOCK page. It reads `matchId` from the route so the page shell is
 * wired correctly, but every field in the MOCK DATA block is placeholder — the
 * same content renders for any matchId visited, and the "live" innings ticks
 * through a scripted final-over finish purely for demo purposes.
 *
 * To make it real:
 *   1. Replace MOCK DATA with a fetch keyed on `matchId`.
 *   2. Replace the scripted `useLiveSim` hook with a subscription to your own
 *      live-scoring feed (websocket / polling), keeping the same state shape.
 */

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  Award,
  Calendar,
  ChevronRight,
  Circle,
  MapPin,
  Radio,
  Shield,
  Swords,
  Target,
  Trophy,
  Users,
} from "lucide-react"
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

/* ────────────────────────────────────────────────────────────────────────
   MOCK DATA — replace with a fetch keyed on matchId
   ──────────────────────────────────────────────────────────────────────── */

const match = {
  round: "Final",
  tournament: "Valiant Cup, Season 3",
  venue: "Negombo Cricket Grounds, Negombo",
  date: "28 Jul 2026",
  time: "2:30 PM start (day match)",
  toss: "Falcon Riders won the toss, elected to field",
  teamA: { name: "Ironclad Royals", short: "ICR", accent: "var(--color-theme-orange)" },
  teamB: { name: "Falcon Riders", short: "FR", accent: "#3da9fc" },
  target: 169,
  officials: {
    umpires: "N. Weerasinghe, A. Rodrigo",
    thirdUmpire: "P. Costa",
    referee: "S. Amarasekera",
    format: "T20 · 20 overs a side",
  },
  pitch:
    "Dry, slow-turning surface expected to assist spin through the middle overs. Clear skies, light onshore breeze, 29°C at toss — outfield running fast after two dry days.",
  context:
    "Winner-takes-all final. Ironclad Royals finished 1st in the group stage (12 pts); Falcon Riders came through the Qualifier as 2nd-placed side.",
}

const inn1 = {
  label: "ICR — 1st Innings",
  total: 168,
  wkts: 6,
  overs: "20.0",
  batting: [
    { name: "R. Fernando (c)", how: "c Peiris b Senanayake", runs: 58, balls: 39, fours: 6, sixes: 2 },
    { name: "A. Bandara", how: "b Jayasuriya", runs: 12, balls: 14, fours: 1, sixes: 0 },
    { name: "S. Wickrama", how: "c Fonseka b Kumara", runs: 34, balls: 26, fours: 3, sixes: 1 },
    { name: "N. Herath", how: "run out (Kumara/Peiris)", runs: 22, balls: 18, fours: 2, sixes: 0 },
    { name: "D. Chandimal", how: "c Perera b Senanayake", runs: 8, balls: 9, fours: 1, sixes: 0 },
    { name: "P. Kaushal", how: "b Jayasuriya", runs: 5, balls: 7, fours: 0, sixes: 0 },
    { name: "T. Ranatunga (wk)", how: "not out", runs: 21, balls: 16, fours: 2, sixes: 0, notOut: true },
    { name: "M. Jayawardene", how: "not out", runs: 4, balls: 3, fours: 0, sixes: 0, notOut: true },
  ],
  extras: 4,
  extrasNote: "b 1, lb 2, w 1",
  dnb: ["K. Dilshan", "H. Malinga", "C. Vaas"],
  fow: [
    ["1-24", "Bandara", "3.2"],
    ["2-88", "Wickrama", "10.5"],
    ["3-118", "Herath", "14.3"],
    ["4-131", "Chandimal", "16.2"],
    ["5-140", "Kaushal", "17.5"],
    ["6-158", "Fernando", "19.4"],
  ],
  bowling: [
    { name: "M. Jayasuriya", overs: 4, runs: 28, wkts: 2, econ: "7.00" },
    { name: "B. Senanayake", overs: 4, runs: 31, wkts: 2, econ: "7.75" },
    { name: "R. Ekanayake", overs: 4, runs: 35, wkts: 0, econ: "8.75" },
    { name: "S. Kumara", overs: 4, runs: 38, wkts: 1, econ: "9.50" },
    { name: "G. Ratnayake", overs: 4, runs: 32, wkts: 0, econ: "8.00" },
  ],
  overRuns: [6, 8, 4, 12, 7, 9, 5, 10, 6, 8, 7, 11, 9, 6, 13, 8, 10, 7, 9, 13],
}

const inn2PartialBatting = [
  { name: "K. Perera (c)", how: "c Ranatunga b Malinga", runs: 45, balls: 28, fours: 5, sixes: 2 },
  { name: "D. Gunawardena", how: "b Dilshan", runs: 18, balls: 16, fours: 2, sixes: 0 },
  { name: "M. Silva", how: "c Fernando b Herath", runs: 27, balls: 22, fours: 2, sixes: 1 },
  { name: "A. Wickramasinghe", how: "run out (Vaas/Ranatunga)", runs: 15, balls: 12, fours: 1, sixes: 0 },
  { name: "S. Kumara", how: "b Vaas", runs: 9, balls: 11, fours: 0, sixes: 0 },
  { name: "L. Peiris (wk)", how: "c Jayawardene b Kaushal", runs: 8, balls: 9, fours: 0, sixes: 0 },
]

const inn2PartialFow: [string, string, string][] = [
  ["1-38", "Gunawardena", "5.2"],
  ["2-95", "Perera", "11.4"],
  ["3-118", "Silva", "14.5"],
  ["4-128", "Wickramasinghe", "16.1"],
  ["5-138", "Kumara", "17.3"],
  ["6-142", "Peiris", "18.2"],
]

const inn2PartialBowling = [
  { name: "H. Malinga", overs: "3.2", runs: 24, wkts: 1, econ: "7.20" },
  { name: "C. Vaas", overs: "3.2", runs: 26, wkts: 1, econ: "7.80" },
  { name: "K. Dilshan", overs: 3, runs: 22, wkts: 1, econ: "7.33" },
  { name: "N. Herath", overs: 3, runs: 20, wkts: 1, econ: "6.66" },
  { name: "P. Kaushal", overs: "3.2", runs: 29, wkts: 1, econ: "8.70" },
]

const inn2Final = {
  total: 170,
  wkts: 7,
  overs: "20.0",
  batting: [
    ...inn2PartialBatting,
    { name: "J. Fonseka", how: "c Bandara b Malinga", runs: 16, balls: 10, fours: 1, sixes: 1 },
    { name: "M. Jayasuriya", how: "not out", runs: 24, balls: 9, fours: 2, sixes: 2, notOut: true },
    { name: "R. Ekanayake", how: "not out", runs: 6, balls: 4, fours: 1, sixes: 0, notOut: true },
  ],
  extras: 2,
  extrasNote: "lb 2",
  dnb: ["B. Senanayake", "G. Ratnayake"],
  fow: [...inn2PartialFow, ["7-155", "Fonseka", "20.2"]] as [string, string, string][],
  bowling: [
    { name: "H. Malinga", overs: 4, runs: 32, wkts: 2, econ: "8.00" },
    { name: "C. Vaas", overs: 4, runs: 33, wkts: 1, econ: "8.25" },
    { name: "K. Dilshan", overs: 4, runs: 30, wkts: 1, econ: "7.50" },
    { name: "N. Herath", overs: 4, runs: 27, wkts: 1, econ: "6.75" },
    { name: "P. Kaushal", overs: 4, runs: 46, wkts: 1, econ: "11.50" },
  ],
  overRuns: [4, 9, 5, 11, 6, 8, 7, 10, 5, 9, 6, 12, 7, 8, 6, 9, 10, 8, 13, 17],
  potm: { name: "M. Jayasuriya", note: "24* (9) with the bat, sealed the chase" },
}

const inn2OverRunsBase18 = [4, 9, 5, 11, 6, 8, 7, 10, 5, 9, 6, 12, 7, 8, 6, 9, 10, 8]

const squads = [
  {
    team: "Ironclad Royals",
    captain: "R. Fernando",
    players: [
      { name: "R. Fernando", role: "Captain, Top-order", xi: true },
      { name: "A. Bandara", role: "Opening bat", xi: true },
      { name: "S. Wickrama", role: "Top-order", xi: true },
      { name: "N. Herath", role: "All-rounder, spin", xi: true },
      { name: "D. Chandimal", role: "Middle-order", xi: true },
      { name: "P. Kaushal", role: "All-rounder", xi: true },
      { name: "T. Ranatunga", role: "Wicketkeeper", xi: true },
      { name: "M. Jayawardene", role: "All-rounder", xi: true },
      { name: "K. Dilshan", role: "Spin bowler", xi: true },
      { name: "H. Malinga", role: "Fast bowler", xi: true },
      { name: "C. Vaas", role: "Fast bowler", xi: true },
      { name: "L. Fernando", role: "Reserve batter", xi: false },
      { name: "D. Perera", role: "Reserve keeper", xi: false },
      { name: "R. Silva", role: "Reserve seamer", xi: false },
      { name: "K. Rajapaksa", role: "Reserve spinner", xi: false },
    ],
  },
  {
    team: "Falcon Riders",
    captain: "K. Perera",
    players: [
      { name: "K. Perera", role: "Captain, Opener", xi: true },
      { name: "D. Gunawardena", role: "Opening bat", xi: true },
      { name: "M. Silva", role: "Top-order", xi: true },
      { name: "A. Wickramasinghe", role: "Middle-order", xi: true },
      { name: "S. Kumara", role: "All-rounder", xi: true },
      { name: "L. Peiris", role: "Wicketkeeper", xi: true },
      { name: "J. Fonseka", role: "All-rounder", xi: true },
      { name: "M. Jayasuriya", role: "All-rounder, spin", xi: true },
      { name: "R. Ekanayake", role: "Fast bowler", xi: true },
      { name: "B. Senanayake", role: "Fast bowler", xi: true },
      { name: "G. Ratnayake", role: "Spin bowler", xi: true },
      { name: "T. Alwis", role: "Reserve batter", xi: false },
      { name: "N. Cooray", role: "Reserve seamer", xi: false },
      { name: "H. Dias", role: "Reserve all-rounder", xi: false },
    ],
  },
]

// scripted final 10 balls, purely to demo the live -> completed transition
const liveScript = [
  { ball: "19.3", over: 19, runs: 1, wkt: false, text: "Single tucked to the leg side.", wpA: 40, wpB: 60 },
  { ball: "19.4", over: 19, runs: 4, wkt: false, text: "FOUR — driven through the covers.", wpA: 32, wpB: 68 },
  { ball: "19.5", over: 19, runs: 0, wkt: false, text: "Dot ball — full and straight.", wpA: 35, wpB: 65 },
  { ball: "19.6", over: 19, runs: 6, wkt: false, text: "SIX! Slog-swept over deep midwicket.", wpA: 22, wpB: 78 },
  { ball: "20.1", over: 20, runs: 2, wkt: false, text: "Two runs, quick single turned into a second.", wpA: 18, wpB: 82 },
  { ball: "20.2", over: 20, runs: 0, wkt: true, text: "WICKET! Fonseka holes out, c Bandara b Malinga.", wpA: 28, wpB: 72 },
  { ball: "20.3", over: 20, runs: 1, wkt: false, text: "Single rotated to keep the strike moving.", wpA: 24, wpB: 76 },
  { ball: "20.4", over: 20, runs: 6, wkt: false, text: "SIX! Massive hit down the ground.", wpA: 10, wpB: 90 },
  { ball: "20.5", over: 20, runs: 4, wkt: false, text: "FOUR — races away to the fence.", wpA: 4, wpB: 96 },
  { ball: "20.6", over: 20, runs: 4, wkt: false, text: "FOUR! Falcon Riders win it!", wpA: 0, wpB: 100 },
]

/* ──────────────────────────────────────────────────────────────────────── */

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
}

function StatusPill({ live }: { live: boolean }) {
  if (live) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-label-mono text-[10px] tracking-[0.12em] uppercase bg-status-live/15 border border-status-live/40 text-status-live">
        <span className="tally pulse-live bg-status-live" />
        Live
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-label-mono text-[10px] tracking-[0.12em] uppercase bg-[#33d17a]/15 border border-[#33d17a]/40 text-[#33d17a]">
      <Circle className="h-2 w-2 fill-current" />
      Completed
    </span>
  )
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <span className="font-label-mono text-[10px] tracking-[0.2em] uppercase text-theme-orange/80">{eyebrow}</span>
      <h2 className="font-headline-md text-xl md:text-2xl font-bold text-on-background mt-1">{title}</h2>
    </div>
  )
}

/** div-grid "table" — mirrors the pattern used for the tournament points table */
function DataGrid({
  columns,
  rows,
}: {
  columns: { key: string; label: string; align?: "left" | "right"; grow?: boolean }[]
  rows: Record<string, React.ReactNode>[]
}) {
  const template = columns.map((c) => (c.grow ? "1fr" : "3.5rem")).join(" ")
  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="grid border-b border-border-overlay" style={{ gridTemplateColumns: template }}>
        {columns.map((c) => (
          <div
            key={c.key}
            className={cn(
              "p-2.5 font-label-mono text-[9.5px] tracking-widest uppercase text-outline",
              c.align === "right" ? "text-right" : "text-left"
            )}
          >
            {c.label}
          </div>
        ))}
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className={cn(
            "grid items-start text-xs md:text-sm",
            i < rows.length - 1 ? "border-b border-border-overlay" : ""
          )}
          style={{ gridTemplateColumns: template }}
        >
          {columns.map((c) => (
            <div key={c.key} className={cn("p-2.5", c.align === "right" ? "text-right font-label-mono" : "text-left")}>
              {row[c.key]}
            </div>
          ))}
        </div>
      ))}
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
  rows: { name: string; how: string; runs: number; balls: number; fours: number; sixes: number; notOut?: boolean }[]
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
        <p className="font-body-md text-on-surface font-medium">{b.name}</p>
        <p className={cn("font-label-mono text-[10.5px] mt-0.5", b.notOut ? "text-[#33d17a]" : "text-outline")}>
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
    <div className="glass-panel rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-label-mono text-[10px] tracking-widest uppercase text-theme-orange">{title}</p>
        {live && (
          <span className="inline-flex items-center gap-1.5 font-label-mono text-[9.5px] uppercase tracking-widest text-status-live">
            <span className="tally pulse-live bg-status-live" /> live
          </span>
        )}
      </div>
      <DataGrid columns={columns} rows={rowData} />
      {creaseNote && (
        <p className="font-label-mono text-[10.5px] text-on-surface-variant mt-3">At the crease: {creaseNote}</p>
      )}
      <div className="flex items-center justify-between mt-3 font-label-mono text-[11px] text-on-surface-variant">
        <span>
          Extras {extras} <span className="text-outline">({extrasNote})</span>
        </span>
        <span className="text-on-surface font-bold">
          Total {total}/{wkts} <span className="text-outline font-normal">({overs} ov)</span>
        </span>
      </div>
      {dnb && <p className="font-label-mono text-[10px] text-outline mt-2">Did not bat: {dnb.join(", ")}</p>}
    </div>
  )
}

function BowlingCard({ title, rows, live }: { title: string; rows: { name: string; overs: number | string; runs: number; wkts: number; econ: string }[]; live?: boolean }) {
  const columns = [
    { key: "name", label: "Bowler", grow: true },
    { key: "o", label: "O", align: "right" as const },
    { key: "r", label: "R", align: "right" as const },
    { key: "w", label: "W", align: "right" as const },
    { key: "econ", label: "Econ", align: "right" as const },
  ]
  const rowData = rows.map((b) => ({
    name: <p className="font-body-md text-on-surface font-medium">{b.name}</p>,
    o: b.overs,
    r: b.runs,
    w: b.wkts,
    econ: b.econ,
  }))
  return (
    <div className="glass-panel rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-label-mono text-[10px] tracking-widest uppercase text-theme-orange">{title}</p>
        {live && <span className="font-label-mono text-[9.5px] uppercase tracking-widest text-outline">so far</span>}
      </div>
      <DataGrid columns={columns} rows={rowData} />
    </div>
  )
}

function FowList({ fow }: { fow: [string, string, string][] }) {
  return (
    <div className="glass-panel rounded-xl p-4 mb-4">
      <p className="font-label-mono text-[10px] tracking-widest uppercase text-theme-orange mb-3">Fall of Wickets</p>
      <div className="flex flex-wrap gap-2">
        {fow.map((f) => (
          <span
            key={f[0]}
            className="font-label-mono text-[10.5px] text-on-surface-variant bg-surface-2 border border-border-overlay rounded-lg px-2.5 py-1.5"
          >
            <b className="text-on-surface">{f[0]}</b> {f[1]} ({f[2]} ov)
          </span>
        ))}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

export default function MatchPage({ params }: { params: { matchId: string } }) {
  const matchId = params?.matchId ?? "demo"

  const [tab, setTab] = useState<"scorecard" | "info" | "squads" | "stats">("scorecard")
  const [innings, setInnings] = useState<1 | 2>(2)

  // live sim state
  const [live, setLive] = useState(true)
  const [runs, setRuns] = useState(142)
  const [wkts, setWkts] = useState(6)
  const [overLabel, setOverLabel] = useState("18.2")
  const [stepIndex, setStepIndex] = useState(0)
  const [winProb, setWinProb] = useState({ a: 42, b: 58 })
  const [commentary, setCommentary] = useState<typeof liveScript>([])
  const [overRunsFR, setOverRunsFR] = useState<number[]>(inn2OverRunsBase18.concat(2))
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
    if (stepIndex >= liveScript.length) return
    const step = liveScript[stepIndex]

    setRuns((r) => r + step.runs)
    setWkts((w) => (step.wkt ? w + 1 : w))
    setOverLabel(step.ball)
    setWinProb({ a: step.wpA, b: step.wpB })
    setCommentary((c) => [step, ...c])
    setPartnership((p) => (step.wkt ? { runs: 0, balls: 0 } : { runs: p.runs + step.runs, balls: p.balls + 1 }))

    if (step.ball === "19.6") {
      const tail = liveScript.filter((s) => s.over === 19).reduce((a, s) => a + s.runs, 0)
      setOverRunsFR([...inn2OverRunsBase18, 2 + tail])
    }
    if (step.ball === "20.6") {
      const over20 = liveScript.filter((s) => s.over === 20).reduce((a, s) => a + s.runs, 0)
      const tail = liveScript.filter((s) => s.over === 19).reduce((a, s) => a + s.runs, 0)
      setOverRunsFR([...inn2OverRunsBase18, 2 + tail, over20])
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

  const manhattanData = inn1.overRuns.map((v, i) => ({
    over: i + 1,
    ICR: v,
    FR: (live ? overRunsFR : inn2Final.overRuns)[i] ?? null,
  }))
  const wormData = (() => {
    let a = 0
    let b = 0
    return inn1.overRuns.map((v, i) => {
      a += v
      const frOver = (live ? overRunsFR : inn2Final.overRuns)[i]
      b += frOver ?? 0
      return { over: i + 1, ICR: a, FR: frOver !== undefined ? b : null }
    })
  })()

  return (
    <main className="bg-background text-on-background min-h-screen">
      {/* ═══════════════════════════════════════════
          HERO / HEADER INFO
      ═══════════════════════════════════════════ */}
      <section className="border-b border-border-overlay px-4 py-12 text-center">
        <span className="font-label-mono text-[10px] tracking-[0.2em] uppercase text-theme-orange/80">
          {match.round} · {match.tournament}
        </span>
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-2xl md:text-4xl font-bold tracking-wide mt-2">
          {match.teamA.name} <span className="text-theme-orange">vs</span> {match.teamB.name}
        </h1>
        <div className="flex flex-wrap justify-center gap-6 mt-5 font-label-mono text-xs text-outline">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-theme-orange" /> {match.venue}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-theme-orange" /> {match.date} · {match.time}
          </span>
        </div>
        <p className="font-body-md text-on-surface-variant mt-4 text-sm">{match.toss}</p>
        <p className="mt-6 font-label-mono text-[9px] text-outline/60 tracking-widest">
          MOCK DATA · route param matchId = &quot;{matchId}&quot;
        </p>
      </section>

      {/* ═══════════════════════════════════════════
          SCORE STRIP — live sync
      ═══════════════════════════════════════════ */}
      <section className="px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-3">
            <StatusPill live={live} />
            <span className="font-label-mono text-[10px] text-outline">
              {live ? "4,821 watching" : "5,940 watched"}
            </span>
          </div>
          <div className="scoreboard-strip">
            <div className="scoreboard-main flex items-baseline gap-2">
              <span className="scoreboard-runs">{inn1.total}/{inn1.wkts}</span>
              <span className="font-label-mono text-xs text-outline uppercase">
                {match.teamA.short} ({inn1.overs})
              </span>
            </div>
            <Swords className="h-4 w-4 text-outline shrink-0" />
            <div className="scoreboard-main flex items-baseline gap-2">
              <span className="scoreboard-wkts">
                {runs}/{wkts}
              </span>
              <span className="font-label-mono text-xs text-outline uppercase">
                {match.teamB.short} ({live ? overLabel : inn2Final.overs})
              </span>
            </div>
            <span className="scoreboard-meta ml-auto">
              {live
                ? `${match.teamB.short} need ${need} runs from ${ballsLeft} ball${ballsLeft === 1 ? "" : "s"}`
                : "Falcon Riders won by 3 wickets"}
            </span>
          </div>
          <div className="flex justify-between mt-2 font-label-mono text-[11px] text-on-surface-variant">
            <span>CRR {crr}</span>
            {rrr && <span>RRR {rrr}</span>}
          </div>

          {!live && (
            <div className="mt-4 rounded-xl border border-[#33d17a]/30 bg-[#33d17a]/10 p-4 text-center">
              <p className="font-body-md text-sm text-[#33d17a] font-semibold">
                🏆 Falcon Riders won by 3 wickets, chasing down {match.target} in 20 overs.
              </p>
              <p className="font-label-mono text-[10.5px] text-on-surface-variant mt-2">
                Player of the Match: <b className="text-theme-orange">{inn2Final.potm.name}</b> ({match.teamB.short}) —{" "}
                {inn2Final.potm.note}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          TABS
      ═══════════════════════════════════════════ */}
      <section className="px-4">
        <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto pb-2">
          {(["scorecard", "info", "squads", "stats"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "font-label-mono text-[10px] tracking-widest uppercase px-4 py-2 rounded-lg border transition-all whitespace-nowrap",
                tab === t
                  ? "bg-theme-orange text-on-primary border-theme-orange"
                  : "border-border-overlay text-on-surface-variant hover:border-theme-orange/40"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SCORECARD TAB
      ═══════════════════════════════════════════ */}
      {tab === "scorecard" && (
        <section className="px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setInnings(1)}
                className={cn(
                  "flex-1 font-label-mono text-[10.5px] px-3 py-2.5 rounded-lg border transition-all",
                  innings === 1
                    ? "bg-theme-orange/15 border-theme-orange text-theme-orange font-bold"
                    : "border-border-overlay text-on-surface-variant"
                )}
              >
                ICR — 1st Innings · {inn1.total}/{inn1.wkts}
              </button>
              <button
                onClick={() => setInnings(2)}
                className={cn(
                  "flex-1 font-label-mono text-[10.5px] px-3 py-2.5 rounded-lg border transition-all",
                  innings === 2
                    ? "bg-theme-orange/15 border-theme-orange text-theme-orange font-bold"
                    : "border-border-overlay text-on-surface-variant"
                )}
              >
                FR — 2nd Innings · {live ? `${runs}/${wkts}` : `${inn2Final.total}/${inn2Final.wkts}`}
              </button>
            </div>

            {innings === 1 && (
              <>
                <BattingCard
                  title="ICR Batting"
                  rows={inn1.batting}
                  extras={inn1.extras}
                  extrasNote={inn1.extrasNote}
                  total={inn1.total}
                  wkts={inn1.wkts}
                  overs={inn1.overs}
                  dnb={inn1.dnb}
                />
                <FowList fow={inn1.fow as [string, string, string][]} />
                <BowlingCard title="FR Bowling" rows={inn1.bowling} />
              </>
            )}

            {innings === 2 && live && (
              <>
                <BattingCard
                  title="FR Batting"
                  rows={inn2PartialBatting}
                  extras={1}
                  extrasNote="lb 1"
                  total={runs}
                  wkts={wkts}
                  overs={overLabel}
                  live
                  creaseNote="J. Fonseka & M. Jayasuriya (not out)"
                />
                <FowList fow={inn2PartialFow} />
                <BowlingCard title="ICR Bowling" rows={inn2PartialBowling} live />
              </>
            )}

            {innings === 2 && !live && (
              <>
                <BattingCard
                  title="FR Batting"
                  rows={inn2Final.batting}
                  extras={inn2Final.extras}
                  extrasNote={inn2Final.extrasNote}
                  total={inn2Final.total}
                  wkts={inn2Final.wkts}
                  overs={inn2Final.overs}
                  dnb={inn2Final.dnb}
                />
                <FowList fow={inn2Final.fow} />
                <BowlingCard title="ICR Bowling" rows={inn2Final.bowling} />
              </>
            )}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════
          INFO TAB
      ═══════════════════════════════════════════ */}
      {tab === "info" && (
        <section className="px-4 py-8">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="glass-panel rounded-xl p-4">
              <p className="font-label-mono text-[10px] tracking-widest uppercase text-theme-orange mb-3">Match Info</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  ["Series", match.tournament + " — " + match.round],
                  ["Venue", match.venue],
                  ["Date & Time", `${match.date} · ${match.time}`],
                  ["Toss", match.toss],
                  ["Umpires", match.officials.umpires],
                  ["Third Umpire", match.officials.thirdUmpire],
                  ["Match Referee", match.officials.referee],
                  ["Format", match.officials.format],
                ].map(([label, value]) => (
                  <div key={label} className="bg-surface-2 border border-border-overlay rounded-lg p-3">
                    <p className="font-label-mono text-[9px] tracking-widest uppercase text-outline">{label}</p>
                    <p className="font-body-md text-sm text-on-surface mt-1">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <p className="font-label-mono text-[10px] tracking-widest uppercase text-theme-orange mb-2">
                Pitch &amp; Conditions
              </p>
              <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">{match.pitch}</p>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <p className="font-label-mono text-[10px] tracking-widest uppercase text-theme-orange mb-2">
                Series Context
              </p>
              <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">{match.context}</p>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════
          SQUADS TAB — reuses .squad-list / .squad-chip
      ═══════════════════════════════════════════ */}
      {tab === "squads" && (
        <section className="px-4 py-8">
          <div className="max-w-3xl mx-auto space-y-6">
            <p className="font-label-mono text-[10px] text-outline flex items-center gap-1.5">
              <span className="tally bg-theme-orange" /> Highlighted chip = Playing XI for this match
            </p>
            {squads.map((s) => (
              <div key={s.team} className="glass-panel rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-theme-orange" />
                    <p className="font-headline-md text-sm font-bold text-on-surface">{s.team}</p>
                  </div>
                  <p className="font-label-mono text-[10px] text-outline flex items-center gap-1.5">
                    <Users className="h-3 w-3" /> {s.players.length} players · Capt. {s.captain}
                  </p>
                </div>
                <div className="squad-list">
                  {s.players.map((p) => (
                    <div key={p.name} className={cn("squad-chip", p.xi && "is-active")}>
                      <div className="squad-avatar">
                        <span className="squad-avatar-fallback">{initials(p.name)}</span>
                      </div>
                      <div>
                        <p className="squad-name">{p.name}</p>
                        <p className="font-label-mono text-[9px] text-outline">{p.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════
          STATS TAB — win prob, partnerships, over summary, charts
      ═══════════════════════════════════════════ */}
      {tab === "stats" && (
        <section className="px-4 py-8">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="glass-panel rounded-xl p-4">
              <p className="font-label-mono text-[10px] tracking-widest uppercase text-theme-orange mb-3">
                Win Probability
              </p>
              <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-2">
                <div
                  className="transition-all duration-700"
                  style={{ width: `${winProb.a}%`, background: match.teamA.accent }}
                />
                <div
                  className="transition-all duration-700"
                  style={{ width: `${winProb.b}%`, background: match.teamB.accent }}
                />
              </div>
              <div className="flex justify-between mt-2 font-label-mono text-[11px]">
                <span style={{ color: match.teamA.accent }}>ICR {winProb.a}%</span>
                <span style={{ color: match.teamB.accent }}>FR {winProb.b}%</span>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <p className="font-label-mono text-[10px] tracking-widest uppercase text-theme-orange mb-3">
                Current Partnership
              </p>
              <div className="crew-slot flex items-center justify-between">
                <p className="crew-slot-name">J. Fonseka &amp; M. Jayasuriya</p>
                <p className="font-label-mono text-theme-orange font-bold">
                  {partnership.runs} ({partnership.balls})
                </p>
              </div>
              <div className="crew-slot flex items-center justify-between mt-2 opacity-60">
                <p className="crew-slot-name">Best this innings — Perera &amp; Gunawardena</p>
                <p className="font-label-mono">57 (38)</p>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <p className="font-label-mono text-[10px] tracking-widest uppercase text-theme-orange mb-3">
                Over-by-Over Summary — FR Innings
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(live ? overRunsFR : inn2Final.overRuns).map((r, i) => (
                  <span
                    key={i}
                    className={cn(
                      "font-label-mono text-[10px] rounded-md px-2 py-1 border min-w-[2.2rem] text-center",
                      r >= 12
                        ? "border-theme-orange text-theme-orange font-bold"
                        : "border-border-overlay text-on-surface-variant"
                    )}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <p className="font-label-mono text-[10px] tracking-widest uppercase text-theme-orange mb-3">
                Manhattan — Runs per Over
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={manhattanData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-overlay)" />
                    <XAxis dataKey="over" tick={{ fontSize: 10, fill: "var(--color-outline)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-outline)" }} />
                    <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border-overlay)" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="ICR" fill={match.teamA.accent} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="FR" fill={match.teamB.accent} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <p className="font-label-mono text-[10px] tracking-widest uppercase text-theme-orange mb-3">
                Worm — Cumulative Score
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={wormData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-overlay)" />
                    <XAxis dataKey="over" tick={{ fontSize: 10, fill: "var(--color-outline)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-outline)" }} />
                    <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border-overlay)" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="ICR" stroke={match.teamA.accent} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="FR" stroke={match.teamB.accent} strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <p className="font-label-mono text-[10px] tracking-widest uppercase text-theme-orange mb-3 flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5" /> Live Commentary Feed
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {commentary.length === 0 && (
                  <p className="font-label-mono text-[11px] text-outline">Commentary will appear here as the over unfolds.</p>
                )}
                {commentary.map((c, i) => (
                  <div
                    key={i}
                    className={cn(
                      "font-body-md text-[12.5px] rounded-lg px-3 py-2 border-l-2 bg-surface-2",
                      c.wkt ? "border-status-live text-status-live" : "border-border-overlay text-on-surface"
                    )}
                  >
                    <span className="font-label-mono text-[10px] text-outline mr-2">{c.ball}</span>
                    {c.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════
          CTA
      ═══════════════════════════════════════════ */}
      <section className="px-4 py-16 text-center border-t border-border-overlay">
        <Trophy className="h-6 w-6 text-theme-orange mx-auto mb-4" />
        <h3 className="font-headline-md text-xl font-bold text-on-background mb-2">
          Follow every ball of the <span className="text-theme-orange">{match.round}</span>
        </h3>
        <p className="font-body-md text-sm text-on-surface-variant mb-6">
          Live scores, scorecards, and stats update automatically as the match unfolds.
        </p>
        <button className="inline-flex items-center gap-2 rounded-lg bg-theme-orange hover:bg-theme-orange/90 transition-colors px-5 py-3 font-label-mono text-xs tracking-widest uppercase text-on-primary font-bold">
          <Target className="h-4 w-4" />
          Follow Live Scores
        </button>
      </section>
    </main>
  )
}