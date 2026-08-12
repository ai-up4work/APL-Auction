"use client"

import { useState } from "react"
import { Lock, Shield } from "lucide-react"
import type {
  MatchDetail,
  BattingRow,
  BowlingRow,
  FowEntry,
  MatchSquad,
  InningsComplete,
  DeliveryEntry,
  PlayerStatRow,
  BowlingStatRow,
} from "@/data/match-data"
import MatchGraphs, { type OverRow } from "./match-graphs"
import type { MatchDetail as GraphMatchDetail } from "@/data/tournament-data"

export type Tab = "info" | "scorecard" | "squads" | "overs" | "commentary" | "graphs" | "stats"

const TABS: { key: Tab; label: string }[] = [
  { key: "info", label: "Info" },
  { key: "scorecard", label: "Scorecard" },
  { key: "squads", label: "Squads" },
  { key: "overs", label: "Overs" },
  { key: "commentary", label: "Commentary" },
  { key: "graphs", label: "Graphs" },
  { key: "stats", label: "Stats" },
]

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

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

function notOutBatters(rows: BattingRow[]): string {
  const names = rows.filter((b) => b.notOut).map((b) => b.name)
  return names.length > 0 ? `${names.join(" & ")} (not out)` : ""
}

type BattingStatKey = "runs" | "avg" | "sr" | "fours" | "sixes"

const BATTING_STAT_CATEGORIES: { key: BattingStatKey; label: string }[] = [
  { key: "runs", label: "Most Runs" },
  { key: "avg", label: "Best Batting Average" },
  { key: "sr", label: "Best Batting Strike Rate" },
  { key: "fours", label: "Most Fours" },
  { key: "sixes", label: "Most Sixes" },
]

type BowlingStatKey = "wkts" | "avg" | "econ"

const BOWLING_STAT_CATEGORIES: { key: BowlingStatKey; label: string }[] = [
  { key: "wkts", label: "Most Wickets" },
  { key: "avg", label: "Best Bowling Average" },
  { key: "econ", label: "Best Economy" },
]

const fmtStat = (v: number | null, decimals = 2) => (v === null || v === undefined ? "--" : v.toFixed(decimals))

type ChipKind = "dot" | "run" | "four" | "six" | "wicket" | "extra"

function deliveryChip(d: DeliveryEntry): { label: string; kind: ChipKind } {
  if (d.isWicket) return { label: "W", kind: "wicket" }
  if (d.extraType === "wide") return { label: d.runs > 1 ? `wd+${d.runs - 1}` : "wd", kind: "extra" }
  if (d.extraType === "no_ball") return { label: d.runs > 1 ? `nb+${d.runs - 1}` : "nb", kind: "extra" }
  if (d.extraType === "bye") return { label: `${d.runs}b`, kind: "extra" }
  if (d.extraType === "leg_bye") return { label: `${d.runs}lb`, kind: "extra" }
  if (d.runs === 6) return { label: "6", kind: "six" }
  if (d.runs === 4) return { label: "4", kind: "four" }
  if (d.runs === 0) return { label: "•", kind: "dot" }
  return { label: String(d.runs), kind: "run" }
}

const chipStyles: Record<ChipKind, string> = {
  dot: "bg-white/[0.03] text-gray-600 border border-white/5",
  run: "bg-white/5 text-gray-200 border border-gold/10",
  four: "bg-gold/15 text-gold border border-gold/30",
  six: "bg-gold text-black border border-gold shadow-sm shadow-gold/30",
  wicket: "bg-red-600 text-white shadow-sm shadow-red-900/50",
  extra: "bg-white/5 text-gray-400 border border-dashed border-gray-600 italic",
}

function describeDelivery(d: DeliveryEntry): string {
  const overBall = `${d.over}.${d.ball}`
  if (d.isWicket) return `${overBall} · Wicket`
  if (d.extraType === "wide") {
    const extra = d.runs > 1 ? `, ${d.runs - 1} run${d.runs - 1 === 1 ? "" : "s"} through` : ""
    return `${overBall} · Wide${extra}`
  }
  if (d.extraType === "no_ball") {
    const extra = d.runs > 1 ? `, ${d.runs - 1} run${d.runs - 1 === 1 ? "" : "s"} off the bat` : ""
    return `${overBall} · No ball${extra}`
  }
  if (d.extraType === "bye") return `${overBall} · ${d.runs} bye${d.runs === 1 ? "" : "s"}`
  if (d.extraType === "leg_bye") return `${overBall} · ${d.runs} leg bye${d.runs === 1 ? "" : "s"}`
  if (d.runs === 0) return `${overBall} · Dot ball`
  if (d.runs === 4) return `${overBall} · Four`
  if (d.runs === 6) return `${overBall} · Six`
  return `${overBall} · ${d.runs} run${d.runs === 1 ? "" : "s"}`
}

function DeliveryChipView({ delivery, isLatest }: { delivery: DeliveryEntry; isLatest?: boolean }) {
  const { label, kind } = deliveryChip(delivery)
  const description = describeDelivery(delivery)
  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        aria-label={description}
        className={`h-6 min-w-[1.5rem] px-1.5 rounded flex items-center justify-center text-[11px] font-bold shrink-0 cursor-default transition-transform duration-150 group-hover:scale-110 group-focus-within:scale-110 ${
          chipStyles[kind]
        } ${isLatest ? "ring-2 ring-gold/60 animate-pulse" : ""}`}
      >
        {label}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-gold/20 bg-black px-2 py-1 text-[10px] font-medium text-gray-200 opacity-0 shadow-lg shadow-black/60 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {description}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-black" />
      </span>
    </span>
  )
}

function groupDeliveriesByOver(deliveries: DeliveryEntry[]): Map<number, DeliveryEntry[]> {
  const byOver = new Map<number, DeliveryEntry[]>()
  for (const d of deliveries) {
    if (!byOver.has(d.over)) byOver.set(d.over, [])
    byOver.get(d.over)!.push(d)
  }
  for (const list of byOver.values()) list.sort((a, b) => a.ball - b.ball)
  return byOver
}

// ─────────────────────────────────────────────────────────────
// AUTO-GENERATED COMMENTARY
// ─────────────────────────────────────────────────────────────
// Phrase banks per delivery outcome. A deterministic hash of the delivery
// (over/ball/runs/wicket) picks the phrase, so re-renders (and live
// polling refreshes) never make an already-shown line "flicker" to
// different wording — the same ball always reads the same way.

const DOT_PHRASES = [
  "Solid defense, no run there.",
  "Beaten on the outside edge, dot ball.",
  "Worked straight to the fielder, no run.",
  "Good, tight line — dot ball.",
  "Left alone outside off.",
  "Defended off the back foot, no run taken.",
]

const SINGLE_PHRASES = [
  "Nudged into the gap for a quick single.",
  "Pushed to mid-on, they cross for one.",
  "Worked away off the pads for a single.",
  "Driven softly, easy single.",
  "Tapped to point, one run taken.",
]

const TWO_PHRASES = [
  "Driven into the gap, they come back for two.",
  "Good running between the wickets — two runs.",
  "Pushed into the deep, a brisk two.",
  "Placed away nicely, two runs added.",
]

const THREE_PHRASES = [
  "Excellent running gets them three.",
  "Into the gap and they hare back for three.",
  "Good placement, three runs on hard-run legs.",
]

const FOUR_PHRASES = [
  "Cracked through the covers — that's four!",
  "Timed beautifully and races to the boundary!",
  "Finds the gap, four runs!",
  "Pierces the field — good shot, four!",
  "Eased away off the back foot, boundary!",
]

const SIX_PHRASES = [
  "Launched into the stands — maximum!",
  "Clean strike, that's gone all the way — six!",
  "Picked the length early and smashed it for six!",
  "Enormous hit — over the ropes for six!",
]

const WIDE_PHRASES = [
  "Strays down the leg side — called wide.",
  "Drifts wide of off stump, umpire signals wide.",
  "Wide called — width on offer there.",
]

const NO_BALL_PHRASES = [
  "Overstepped — no ball, free hit coming up.",
  "No ball called for overstepping the crease.",
  "Front foot no ball — extra run added.",
]

const BYE_PHRASES = ["Beaten and it runs through to the keeper — {n} bye(s).", "Missed everything, {n} bye(s) taken."]
const LEG_BYE_PHRASES = ["Off the pads and away — {n} leg bye(s).", "Deflects off the body, {n} leg bye(s) taken."]

const WICKET_PHRASES = [
  "That's out! Big moment in the innings.",
  "Gone! The bowler strikes at a crucial time.",
  "OUT! The batting side will feel that one.",
  "Wicket! A huge breakthrough for the fielding side.",
  "That's the end of that innings — wicket falls.",
]

function pick<T>(arr: T[], seed: number): T {
  const i = ((seed % arr.length) + arr.length) % arr.length
  return arr[i]
}

function commentarySeed(d: DeliveryEntry): number {
  return d.over * 131 + d.ball * 17 + d.runs * 7 + (d.isWicket ? 91 : 0)
}

/** Turns a raw delivery into an auto-generated, commentary-style sentence.
 *  Falls back to a plain description for run counts that don't have a
 *  dedicated phrase bank (e.g. 5 runs from overthrows). */
function generateCommentaryText(d: DeliveryEntry): string {
  const seed = commentarySeed(d)

  if (d.isWicket) return pick(WICKET_PHRASES, seed)

  if (d.extraType === "wide") {
    const base = pick(WIDE_PHRASES, seed)
    return d.runs > 1 ? `${base} ${d.runs - 1} extra run${d.runs - 1 === 1 ? "" : "s"} taken too.` : base
  }
  if (d.extraType === "no_ball") {
    const base = pick(NO_BALL_PHRASES, seed)
    return d.runs > 1 ? `${base} ${d.runs - 1} run${d.runs - 1 === 1 ? "" : "s"} off the bat as well.` : base
  }
  if (d.extraType === "bye") return pick(BYE_PHRASES, seed).replace("{n}", String(d.runs))
  if (d.extraType === "leg_bye") return pick(LEG_BYE_PHRASES, seed).replace("{n}", String(d.runs))

  if (d.runs === 0) return pick(DOT_PHRASES, seed)
  if (d.runs === 1) return pick(SINGLE_PHRASES, seed)
  if (d.runs === 2) return pick(TWO_PHRASES, seed)
  if (d.runs === 3) return pick(THREE_PHRASES, seed)
  if (d.runs === 4) return pick(FOUR_PHRASES, seed)
  if (d.runs === 6) return pick(SIX_PHRASES, seed)
  return `${d.runs} runs taken off that one.`
}

const commentaryBadgeStyles: Record<ChipKind, string> = {
  dot: "bg-white/5 text-gray-500 border border-white/10",
  run: "bg-white/5 text-gray-300 border border-gold/10",
  four: "bg-gold/15 text-gold border border-gold/30",
  six: "bg-gold text-black border border-gold",
  wicket: "bg-red-600 text-white",
  extra: "bg-white/5 text-gray-400 border border-dashed border-gray-600",
}

function CommentaryEntry({ delivery, isLatest }: { delivery: DeliveryEntry; isLatest?: boolean }) {
  const { label, kind } = deliveryChip(delivery)
  const text = generateCommentaryText(delivery)
  return (
    <div
      className={`flex gap-3 p-3.5 transition-colors ${
        isLatest ? "bg-gold/[0.06]" : kind === "wicket" ? "bg-red-950/10" : "hover:bg-white/[0.01]"
      }`}
    >
      <div className="flex flex-col items-center gap-1.5 shrink-0 w-11">
        <span className="text-[10px] font-bold text-gray-500 font-cinzel tabular-nums">
          {delivery.over}.{delivery.ball}
        </span>
        <span
          className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
            commentaryBadgeStyles[kind]
          } ${isLatest ? "ring-2 ring-gold/60 animate-pulse" : ""}`}
        >
          {label}
        </span>
      </div>
      <p className={`text-sm leading-snug pt-1 ${kind === "wicket" ? "text-red-300 font-semibold" : "text-gray-300"}`}>
        {text}
        {isLatest && (
          <span className="ml-2 inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-gold/80 font-cinzel align-middle">
            <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" /> Live
          </span>
        )}
      </p>
    </div>
  )
}

/** Auto-generated live commentary feed: latest over on top, latest ball
 *  within each over on top — the way a live text-commentary widget reads. */
function CommentaryFeed({
  deliveries,
  overOverData,
  isLive,
}: {
  deliveries: DeliveryEntry[]
  overOverData: OverRow[]
  isLive: boolean
}) {
  const byOver = groupDeliveriesByOver(deliveries)
  const overNums = [...byOver.keys()].sort((a, b) => b - a)
  const latestDelivery = isLive && deliveries.length > 0 ? deliveries[deliveries.length - 1] : undefined
  const overMeta = new Map(overOverData.map((o) => [o.num, o]))

  return (
    <div className="space-y-5">
      {overNums.map((num) => {
        const balls = [...byOver.get(num)!].sort((a, b) => b.ball - a.ball)
        const meta = overMeta.get(num)
        return (
          <div key={num}>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-cinzel uppercase tracking-widest text-gold/70">Over {num}</p>
              {meta && (
                <p className="text-[11px] text-gray-500">
                  {meta.score} <span className="text-gray-700">·</span> {meta.totalRuns} runs
                </p>
              )}
            </div>
            <div className="border border-gold/10 rounded-lg divide-y divide-gold/5 bg-black/30 overflow-hidden">
              {balls.map((d, i) => (
                <CommentaryEntry
                  key={i}
                  delivery={d}
                  isLatest={!!latestDelivery && latestDelivery.over === d.over && latestDelivery.ball === d.ball}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface MatchTabsProps {
  match: MatchDetail
  status: "not_started" | "live" | "completed"
  live: boolean
  completed: boolean
  hasBallData: boolean
  innings2Started: boolean
  runs: number
  wkts: number
  overLabel: string
  winProb: { a: number; b: number } | undefined
  tab: Tab
  setTab: (t: Tab) => void
  innings: 1 | 2
  setInnings: (i: 1 | 2) => void
  getOverByOverData: (inn?: 1 | 2) => OverRow[]
  overRunsB: number[]
  liveScriptLength: number
  battingStats?: PlayerStatRow[]
  bowlingStats?: BowlingStatRow[]
  /** Name -> photo URL, built from match.squads. Optional since standalone
   *  stats views may not always have squads resolved; Stats tab falls back
   *  to initials avatars when a name isn't found here. */
  playerImageMap?: Record<string, string>
}

export default function MatchTabs({
  match,
  status,
  live,
  completed,
  hasBallData,
  innings2Started,
  runs,
  wkts,
  overLabel,
  winProb,
  tab,
  setTab,
  innings,
  setInnings,
  getOverByOverData,
  overRunsB,
  liveScriptLength,
  battingStats,
  bowlingStats,
  playerImageMap,
}: MatchTabsProps) {
  const isTabLocked = (t: Tab): boolean => {
    switch (t) {
      case "scorecard":
      case "overs":
      case "commentary":
      case "graphs":
        return !hasBallData
      case "squads":
        return match.squads.length === 0
      case "stats":
        return !battingStats?.length && !bowlingStats?.length
      case "info":
      default:
        return false
    }
  }

  return (
    <>
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

      {/* INFO TAB */}
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

            const rawDeliveries: DeliveryEntry[] | undefined =
              innings === 1 ? match.innings1.deliveries : live ? match.innings2Partial.deliveries : match.innings2Final.deliveries
            const hasDeliveryData = !!rawDeliveries && rawDeliveries.length > 0
            const deliveriesByOver = hasDeliveryData ? groupDeliveriesByOver(rawDeliveries!) : null
            const latestDelivery =
              hasDeliveryData && live ? rawDeliveries![rawDeliveries!.length - 1] : undefined

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
                      <div>{hasDeliveryData ? "Balls" : "Wickets"}</div>
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
                          {(() => {
                            const overBalls = deliveriesByOver?.get(ov.num)
                            if (overBalls && overBalls.length > 0) {
                              return overBalls.map((d, ballIdx) => (
                                <DeliveryChipView
                                  key={ballIdx}
                                  delivery={d}
                                  isLatest={
                                    !!latestDelivery && latestDelivery.over === d.over && latestDelivery.ball === d.ball
                                  }
                                />
                              ))
                            }
                            return ov.balls.length > 0 ? (
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
                            )
                          })()}
                        </div>

                        <div className="text-right text-base font-bold text-white font-cinzel pr-1">
                          {ov.totalRuns}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!hasDeliveryData && (
                  <p className="text-[10px] text-gray-600 text-center pt-2">
                    Ball-by-ball breakdown within each over isn't available yet — showing runs and wickets per over.
                  </p>
                )}
              </div>
            )
          })()
        ))}

      {/* COMMENTARY TAB */}
      {tab === "commentary" &&
        (!hasBallData ? (
          <div className="mb-8">
            <LockedTabPanel
              title="Commentary not available yet"
              hint="Ball-by-ball commentary is generated automatically from delivery data — it fills in once scoring begins."
            />
          </div>
        ) : (
          (() => {
            const overOverData = getOverByOverData(innings)
            const rawDeliveries: DeliveryEntry[] | undefined =
              innings === 1 ? match.innings1.deliveries : live ? match.innings2Partial.deliveries : match.innings2Final.deliveries
            const hasDeliveryData = !!rawDeliveries && rawDeliveries.length > 0

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
                  {live && (
                    <span className="ml-auto flex items-center gap-1.5 text-green-300 text-[10px] uppercase tracking-widest font-cinzel self-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" /> auto-updating
                    </span>
                  )}
                </div>

                {innings === 2 && !innings2Started ? (
                  <p className="text-gray-500 text-sm text-center py-8">2nd innings hasn't started yet.</p>
                ) : !hasDeliveryData ? (
                  <p className="text-gray-500 text-sm text-center py-8">
                    No ball-by-ball data recorded for this innings yet — commentary will appear once it starts.
                  </p>
                ) : (
                  <CommentaryFeed deliveries={rawDeliveries!} overOverData={overOverData} isLive={live} />
                )}
                <p className="text-[10px] text-gray-600 text-center pt-2">
                  Commentary is generated automatically from ball-by-ball data.
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
            overRunsB={overRunsB}
            winProb={winProb ?? { a: 50, b: 50 }}
            stepIndex={liveScriptLength}
            overs1={getOverByOverData(1)}
            overs2={getOverByOverData(2)}
            innings2Started={innings2Started}
            completed={completed}
          />
        ))}

      {/* STATS TAB */}
      {tab === "stats" &&
        (!battingStats?.length && !bowlingStats?.length ? (
          <div className="mb-8">
            <LockedTabPanel
              title="Stats not available yet"
              hint="Series leaderboards — most runs, best average, most wickets and more — will show up here once player stats are wired up."
            />
          </div>
        ) : (
          <StatsPanel battingStats={battingStats ?? []} bowlingStats={bowlingStats ?? []} playerImageMap={playerImageMap ?? {}} />
        ))}
    </>
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

// ─────────────────────────────────────────────────────────────
// STATS TAB — redesigned
// ─────────────────────────────────────────────────────────────

const RANK_STYLE: Record<number, { badge: string; glow: string }> = {
  0: { badge: "bg-gradient-to-b from-[#F5D583] to-[#C98A2E] text-black", glow: "shadow-[0_0_16px_rgba(245,166,35,0.35)]" },
  1: { badge: "bg-gradient-to-b from-[#E4E4E4] to-[#9B9B9B] text-black", glow: "" },
  2: { badge: "bg-gradient-to-b from-[#D8A06B] to-[#8B5A2B] text-white", glow: "" },
}

function initialsStats(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/** Real photo when one resolves from the squads data, initials otherwise.
 *  Tracks load failure in state (rather than the MatchSquadPanel's
 *  onError-toggles-a-sibling-class trick) since this needs to size
 *  differently per call site (spotlight vs. row) and state is simpler
 *  to keep correct across re-renders when `img` changes between players. */
function PlayerAvatar({ name, img, size = "md" }: { name: string; img?: string; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false)
  const dims = size === "md" ? "h-14 w-14 text-sm" : "h-8 w-8 text-[10px]"
  const showPhoto = !!img && !failed
  return (
    <div
      className={`relative ${dims} rounded-full overflow-hidden bg-black/60 border-2 border-gold/40 flex items-center justify-center shrink-0 ${
        size === "md" ? "shadow-[0_0_20px_rgba(245,166,35,0.25)]" : ""
      }`}
    >
      {showPhoto ? (
        <img src={img} alt={name} className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="font-bold text-gold font-cinzel">{initialsStats(name)}</span>
      )}
    </div>
  )
}

/** Spotlight card for whoever currently leads the selected category —
 *  gives the tab a hero moment instead of opening straight into a table. */
function LeaderSpotlight({
  name,
  img,
  value,
  unit,
  meta,
  accent,
}: {
  name: string
  img?: string
  value: string
  unit: string
  meta: string
  accent: string
}) {
  return (
    <div className="relative rounded-xl border border-gold/25 bg-gradient-to-br from-gold/[0.08] via-black/40 to-black/40 p-5 mb-5 overflow-hidden">
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      <div className="flex items-center gap-4">
        <PlayerAvatar name={name} img={img} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-gold/70 text-[10px] uppercase tracking-[0.2em] font-cinzel mb-0.5">Leading</p>
          <h4 className="text-lg font-bold text-white font-cinzel truncate">{name}</h4>
          <p className="text-gray-500 text-[11px] mt-0.5">{meta}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-3xl font-black font-cinzel tabular-nums leading-none ${accent}`}>{value}</p>
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">{unit}</p>
        </div>
      </div>
    </div>
  )
}

/** Leaderboard row with a background bar sized relative to the top value
 *  in the current category — so "second place" visually reads as close
 *  or distant, not just a number one row down. */
function LeaderboardRow({
  rank,
  name,
  img,
  primaryValue,
  primaryLabel,
  fraction,
  accent,
  secondary,
}: {
  rank: number
  name: string
  img?: string
  primaryValue: string
  primaryLabel: string
  fraction: number
  accent: string
  secondary: { label: string; value: string | number }[]
}) {
  const medal = RANK_STYLE[rank]
  return (
    <div className={`relative flex items-center gap-3 px-3 py-3 rounded-lg mb-1.5 overflow-hidden ${medal ? "bg-white/[0.02]" : ""}`}>
      <div
        className="absolute inset-y-0 left-0 bg-gold/[0.06] transition-all duration-500"
        style={{ width: `${Math.max(fraction, 2)}%` }}
      />
      <div
        className={`relative h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold font-cinzel shrink-0 ${
          medal ? `${medal.badge} ${medal.glow}` : "bg-white/5 text-gray-500 border border-white/10"
        }`}
      >
        {rank + 1}
      </div>
      <PlayerAvatar name={name} img={img} size="sm" />
      <p className="relative text-sm text-gray-100 font-medium truncate flex-1 min-w-0">{name}</p>
      <div className="relative hidden sm:flex items-center gap-3 shrink-0">
        {secondary.map((s) => (
          <span key={s.label} className="text-[10.5px] text-gray-500 tabular-nums">
            {s.value}
            <span className="text-gray-700 ml-1">{s.label}</span>
          </span>
        ))}
      </div>
      <div className="relative text-right shrink-0 min-w-[3.5rem]">
        <span className={`text-base font-bold font-cinzel tabular-nums ${accent}`}>{primaryValue}</span>
        <span className="hidden md:inline text-[9px] uppercase tracking-widest text-gray-600 ml-1.5">{primaryLabel}</span>
      </div>
    </div>
  )
}

const ALL_STAT_CATEGORIES = [
  ...BATTING_STAT_CATEGORIES.map((c) => ({ ...c, mode: "batting" as const })),
  ...BOWLING_STAT_CATEGORIES.map((c) => ({ ...c, mode: "bowling" as const })),
]

/** Mode switcher, reimagined as two content-bearing cards instead of a
 *  plain segmented toggle. Each card always shows a live preview — the
 *  current leader for whatever category that mode last had selected —
 *  so picking a mode is also the first useful thing you see, not just
 *  flipping a switch before the real content loads in below it. */
function ModeCard({
  label,
  active,
  disabled,
  leaderName,
  leaderImg,
  statValue,
  statLabel,
  accent,
  dot,
  onClick,
}: {
  label: string
  active: boolean
  disabled: boolean
  leaderName?: string
  leaderImg?: string
  statValue?: string
  statLabel?: string
  accent: string
  dot: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative text-left rounded-xl border p-4 transition-all overflow-hidden disabled:opacity-30 disabled:cursor-not-allowed ${
        active
          ? "border-gold/40 bg-gradient-to-br from-white/[0.04] to-transparent shadow-[0_0_20px_rgba(245,166,35,0.08)]"
          : "border-white/10 bg-white/[0.01] hover:border-white/20"
      }`}
    >
      {active && <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />}
      <div className="flex items-center gap-1.5 mb-3">
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
        <p className={`text-[10px] uppercase tracking-[0.2em] font-cinzel ${active ? "text-gray-300" : "text-gray-600"}`}>
          {label}
        </p>
      </div>
      {leaderName ? (
        <div className="flex items-center gap-2.5">
          <PlayerAvatar name={leaderName} img={leaderImg} size="sm" />
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold truncate ${active ? "text-white" : "text-gray-400"}`}>{leaderName}</p>
            <p className="text-[10px] text-gray-600 truncate">{statLabel}</p>
          </div>
          <p className={`text-xl font-black font-cinzel tabular-nums shrink-0 ${active ? accent : "text-gray-500"}`}>
            {statValue}
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-600 py-2">No data yet</p>
      )}
    </button>
  )
}

function StatsPanel({
  battingStats,
  bowlingStats,
  playerImageMap = {},
}: {
  battingStats: PlayerStatRow[]
  bowlingStats: BowlingStatRow[]
  playerImageMap?: Record<string, string>
}) {
  const [mode, setMode] = useState<"batting" | "bowling">(battingStats.length ? "batting" : "bowling")
  const [battingKey, setBattingKey] = useState<BattingStatKey>("runs")
  const [bowlingKey, setBowlingKey] = useState<BowlingStatKey>("wkts")

  const sortedBatting = [...battingStats].sort((a, b) => (b[battingKey] ?? -Infinity) - (a[battingKey] ?? -Infinity))
  const sortedBowling = [...bowlingStats].sort((a, b) => {
    if (bowlingKey === "avg" || bowlingKey === "econ") return (a[bowlingKey] ?? Infinity) - (b[bowlingKey] ?? Infinity)
    return b[bowlingKey] - a[bowlingKey]
  })

  const activeRows = mode === "batting" ? sortedBatting : sortedBowling
  const leader = activeRows[0]
  const accent = mode === "batting" ? "text-gold" : "text-emerald-400"

  const lowerIsBetter = mode === "bowling" && (bowlingKey === "avg" || bowlingKey === "econ")

  const battingValue = (r: PlayerStatRow) =>
    battingKey === "avg" ? fmtStat(r.avg) : battingKey === "sr" ? r.sr.toFixed(2) : String(r[battingKey])
  const bowlingValue = (r: BowlingStatRow) =>
    bowlingKey === "avg" ? fmtStat(r.avg) : bowlingKey === "econ" ? r.econ.toFixed(2) : String(r[bowlingKey])

  const battingNumeric = (r: PlayerStatRow) => (battingKey === "avg" ? r.avg ?? 0 : battingKey === "sr" ? r.sr : r[battingKey])
  const bowlingNumeric = (r: BowlingStatRow) => (bowlingKey === "avg" ? r.avg ?? 0 : bowlingKey === "econ" ? r.econ : r[bowlingKey])

  const maxNumeric = Math.max(
    ...(mode === "batting" ? sortedBatting.map(battingNumeric) : sortedBowling.map(bowlingNumeric)),
    1,
  )

  const fractionFor = (numeric: number) => (lowerIsBetter ? 100 - (numeric / maxNumeric) * 100 : (numeric / maxNumeric) * 100)

  const battingCategoryLabel = BATTING_STAT_CATEGORIES.find((c) => c.key === battingKey)?.label
  const bowlingCategoryLabel = BOWLING_STAT_CATEGORIES.find((c) => c.key === bowlingKey)?.label

  return (
    <div className="mb-8">
      {/* Mode selector — two preview cards instead of a plain toggle */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <ModeCard
          label="Batting"
          active={mode === "batting"}
          disabled={battingStats.length === 0}
          leaderName={sortedBatting[0]?.player}
          leaderImg={sortedBatting[0] ? playerImageMap[sortedBatting[0].player] : undefined}
          statValue={sortedBatting[0] ? battingValue(sortedBatting[0]) : undefined}
          statLabel={battingCategoryLabel}
          accent="text-gold"
          dot="bg-gold"
          onClick={() => setMode("batting")}
        />
        <ModeCard
          label="Bowling"
          active={mode === "bowling"}
          disabled={bowlingStats.length === 0}
          leaderName={sortedBowling[0]?.player}
          leaderImg={sortedBowling[0] ? playerImageMap[sortedBowling[0].player] : undefined}
          statValue={sortedBowling[0] ? bowlingValue(sortedBowling[0]) : undefined}
          statLabel={bowlingCategoryLabel}
          accent="text-emerald-400"
          dot="bg-emerald-400"
          onClick={() => setMode("bowling")}
        />
      </div>

      {/* Category chips — scoped to whichever mode is active */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-none">
        {(mode === "batting" ? BATTING_STAT_CATEGORIES : BOWLING_STAT_CATEGORIES).map((c) => {
          const active = mode === "batting" ? battingKey === c.key : bowlingKey === c.key
          const activeStyle = mode === "batting" ? "bg-gold/15 border-gold text-gold" : "bg-emerald-400/10 border-emerald-400 text-emerald-300"
          return (
            <button
              key={c.key}
              onClick={() => (mode === "batting" ? setBattingKey(c.key as BattingStatKey) : setBowlingKey(c.key as BowlingStatKey))}
              className={`shrink-0 text-[11px] font-cinzel uppercase tracking-wide px-3.5 py-2 rounded-full border transition-all whitespace-nowrap ${
                active ? `${activeStyle} font-bold` : "border-white/10 text-gray-400 hover:text-white hover:border-white/25"
              }`}
            >
              {c.label}
            </button>
          )
        })}
      </div>

      {activeRows.length === 0 ? (
        <p className="text-gray-600 text-xs text-center py-10 border border-dashed border-gold/15 rounded-lg">
          No {mode} stats yet.
        </p>
      ) : (
        <div className="bg-black/50 border border-gold/20 rounded-lg p-5">
          {mode === "batting" ? (
            <>
              <LeaderSpotlight
                name={leader.player}
                img={playerImageMap[leader.player]}
                value={battingValue(leader as PlayerStatRow)}
                unit={battingKey}
                meta={`${leader.matches} match${leader.matches === 1 ? "" : "es"} · ${leader.inns} inns`}
                accent={accent}
              />
              {sortedBatting.map((r, i) => (
                <LeaderboardRow
                  key={r.player}
                  rank={i}
                  name={r.player}
                  img={playerImageMap[r.player]}
                  primaryValue={battingValue(r)}
                  primaryLabel={battingKey}
                  fraction={fractionFor(battingNumeric(r))}
                  accent={accent}
                  secondary={[
                    { label: "4s", value: r.fours },
                    { label: "6s", value: r.sixes },
                  ]}
                />
              ))}
            </>
          ) : (
            <>
              <LeaderSpotlight
                name={leader.player}
                img={playerImageMap[leader.player]}
                value={bowlingValue(leader as BowlingStatRow)}
                unit={bowlingKey}
                meta={`${(leader as BowlingStatRow).best} best · ${leader.matches} match${leader.matches === 1 ? "" : "es"}`}
                accent={accent}
              />
              {sortedBowling.map((r, i) => (
                <LeaderboardRow
                  key={r.player}
                  rank={i}
                  name={r.player}
                  img={playerImageMap[r.player]}
                  primaryValue={bowlingValue(r)}
                  primaryLabel={bowlingKey}
                  fraction={fractionFor(bowlingNumeric(r))}
                  accent={accent}
                  secondary={[{ label: "best", value: r.best }]}
                />
              ))}
            </>
          )}
        </div>
      )}
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
          <span className="flex items-center gap-1.5 text-green-300 text-[10px] uppercase tracking-widest font-cinzel">
            <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" /> live
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