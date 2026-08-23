"use client"

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react"
import { Lock, Shield, Sparkles, Database, Trophy } from "lucide-react"
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

// ─────────────────────────────────────────────────────────────
// INFINITE LOOP TAB STRIP
//
// The tab strip is rendered as several back-to-back copies of TABS
// (LOOPED_TABS below), and the scroll handler silently snaps the
// scroll position back by one copy-width whenever it nears either
// end — so however far the user scrolls, there are always tabs on
// both sides and it never bottoms out on empty space. Each copy
// carries a unique `extKey` (for React keys / per-element refs) while
// `key` stays the real Tab value the click handler and lock/active
// state key off.
// ─────────────────────────────────────────────────────────────

const LOOP_COPIES = 3

const LOOPED_TABS = Array.from({ length: LOOP_COPIES }).flatMap((_, copyIdx) =>
  TABS.map((t) => ({ ...t, extKey: `${t.key}__${copyIdx}` })),
)

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
// AUTO-GENERATED COMMENTARY (fallback phrase banks)
// ─────────────────────────────────────────────────────────────
// Used whenever an LLM-generated line for a given ball isn't available
// yet (still loading, or generation is disabled — e.g. non-live/older
// matches you haven't backfilled). Deterministic hash of the delivery
// (over/ball/runs/wicket) picks the phrase so it never flickers on
// re-render. This is the "Match Data" source: short, factual lines
// built directly off the delivery record (runs/extras/wicket) rather
// than freeform narration.

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

/** Turns a raw delivery into a fallback commentary-style sentence, used
 *  only when no LLM-generated text is available for this ball yet. */
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

/** Small pill identifying whether a commentary line is cinematic
 *  AI narration or the deterministic, data-derived fallback line. */
function CommentarySourceTag({ isAi }: { isAi: boolean }) {
  return isAi ? (
    <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-cinzel px-1.5 py-0.5 rounded-full bg-gradient-to-r from-gold/20 to-gold/5 border border-gold/30 text-gold">
      <Sparkles className="h-2.5 w-2.5" />
      AI Commentary
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-cinzel px-1.5 py-0.5 rounded-full bg-white/[0.03] border border-white/10 text-gray-500">
      <Database className="h-2.5 w-2.5" />
      Match Data
    </span>
  )
}

function CommentaryEntry({
  delivery,
  isLatest,
  llmText,
  isPending,
}: {
  delivery: DeliveryEntry
  isLatest?: boolean
  /** LLM-generated line for this exact ball, if it's been generated yet. */
  llmText?: string
  /** True while this ball's over is still being generated — shows a
   *  quiet "writing..." placeholder instead of the phrase-bank fallback,
   *  so it's visually obvious real commentary is on the way. */
  isPending?: boolean
}) {
  const { label, kind } = deliveryChip(delivery)
  // Whether this line is the cinematic, LLM-generated one vs. the
  // deterministic "Match Data" fallback. Fallback logic is unchanged —
  // this only affects the badge shown next to the text.
  const isAiGenerated = !!llmText
  const text = llmText ?? (isPending ? undefined : generateCommentaryText(delivery))

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
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug pt-1 ${kind === "wicket" ? "text-red-300 font-semibold" : "text-gray-300"}`}>
          {text ?? <span className="text-gray-600 italic">Writing commentary…</span>}
          {isLatest && (
            <span className="ml-2 inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-gold/80 font-cinzel align-middle">
              <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" /> Live
            </span>
          )}
        </p>
        {text && (
          <div className="mt-1.5">
            <CommentarySourceTag isAi={isAiGenerated} />
          </div>
        )}
      </div>
    </div>
  )
}

/** Live commentary feed: latest over on top, latest ball within each
 *  over on top — the way a live text-commentary widget reads.
 *  `getLlmText`/`isOverPending` are optional so this component still
 *  works (falling back to the phrase banks) for any caller that hasn't
 *  wired up useBallCommentary. */
function CommentaryFeed({
  deliveries,
  overOverData,
  isLive,
  getLlmText,
  isOverPending,
}: {
  deliveries: DeliveryEntry[]
  overOverData: OverRow[]
  isLive: boolean
  getLlmText?: (over: number, ball: number) => string | undefined
  isOverPending?: (over: number) => boolean
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
        const pending = isOverPending?.(num) ?? false
        return (
          <div key={num}>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-cinzel uppercase tracking-widest text-gold/70">Over {num}</p>
              <div className="flex items-center gap-2">
                {pending && (
                  <span className="flex items-center gap-1 text-[10px] text-gray-500">
                    <span className="h-1 w-1 rounded-full bg-gray-500 animate-pulse" /> writing
                  </span>
                )}
                {meta && (
                  <p className="text-[11px] text-gray-500">
                    {meta.score} <span className="text-gray-700">·</span> {meta.totalRuns} runs
                  </p>
                )}
              </div>
            </div>
            <div className="border border-gold/10 rounded-lg divide-y divide-gold/5 bg-black/30 overflow-hidden">
              {balls.map((d, i) => (
                <CommentaryEntry
                  key={i}
                  delivery={d}
                  isLatest={!!latestDelivery && latestDelivery.over === d.over && latestDelivery.ball === d.ball}
                  llmText={getLlmText?.(d.over, d.ball)}
                  isPending={pending && !getLlmText?.(d.over, d.ball)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CURVED CAROUSEL TAB BAR — math + config
//
// The tab strip scrolls horizontally; the tab nearest the visual
// center lifts up and scales up, tabs further away sink down and
// shrink/fade — an arc/carousel read (all inline in this file, wired
// up inside MatchTabs below via refs + scroll listener).
// ─────────────────────────────────────────────────────────────

const ARC_RANGE = 260 // px from center before a tab is "fully off-arc"
const ARC_LIFT = 14 // px max upward lift for the centered tab
const ARC_SCALE_MAX = 1.08
const ARC_SCALE_MIN = 0.86
const ARC_OPACITY_MAX = 1
const ARC_OPACITY_MIN = 0.45

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

// Smoothstep falloff: 0 at dead center, 1 at/after ARC_RANGE.
function arcFalloff(distance: number) {
  const t = clamp(Math.abs(distance) / ARC_RANGE, 0, 1)
  return t * t * (3 - 2 * t)
}

// ─────────────────────────────────────────────────────────────
// SEGMENTED TABS — shared sliding-pill control for every secondary /
// tertiary tab level under the main curved carousel (innings toggle
// in Scorecard/Overs/Commentary, stat-category chips in Stats). One
// component, one visual language: a capsule track with a gold pill
// that glides to whichever segment is active, sized to that segment's
// real rendered width via offsetLeft/offsetWidth (scroll-safe, so it
// still works when the track itself scrolls horizontally on mobile
// with many segments, e.g. the 5-wide batting stat row).
// ─────────────────────────────────────────────────────────────

interface SegmentedTabOption<T extends string | number> {
  value: T
  label: ReactNode
  disabled?: boolean
  disabledHint?: string
}

function SegmentedTabs<T extends string | number>({
  options,
  active,
  onChange,
  size = "md",
  scrollable = false,
  accent = "gold",
}: {
  options: SegmentedTabOption<T>[]
  active: T
  onChange: (v: T) => void
  /** "md" = taller pills used for the innings toggle, "sm" = compact
   *  chips used for stat categories. */
  size?: "md" | "sm"
  /** Lets the track scroll horizontally instead of wrapping — used
   *  for the stat-category row, which can have 5+ segments. */
  scrollable?: boolean
  /** Indicator color — defaults to gold (used everywhere except the
   *  bowling stat-category row, which is tinted emerald to match the
   *  rest of the bowling side of the Stats panel). */
  accent?: "gold" | "emerald"
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const segRefs = useRef<Map<T, HTMLButtonElement>>(new Map())
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  const updateIndicator = useCallback(() => {
    const el = segRefs.current.get(active)
    if (!el) return
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [active])

  useEffect(() => {
    updateIndicator()
    window.addEventListener("resize", updateIndicator)
    return () => window.removeEventListener("resize", updateIndicator)
  }, [updateIndicator, options.length])

  // Keep the active segment in view when the track scrolls horizontally.
  useEffect(() => {
    if (!scrollable) return
    const el = segRefs.current.get(active)
    const track = trackRef.current
    if (!el || !track) return
    const trackRect = track.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    if (elRect.left < trackRect.left || elRect.right > trackRect.right) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, scrollable])

  return (
    <div
      ref={trackRef}
      className={`relative flex gap-1 rounded-full border border-gold/15 bg-black/40 p-1 ${
        scrollable ? "overflow-x-auto scrollbar-none flex-nowrap" : "flex-wrap"
      }`}
    >
      {indicator && (
        <span
          className={`absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-out pointer-events-none ${
            accent === "emerald"
              ? "bg-emerald-400 shadow-[0_2px_14px_rgba(52,211,153,0.35)]"
              : "bg-gold shadow-[0_2px_14px_rgba(245,166,35,0.35)]"
          }`}
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
      {options.map((opt) => {
        const isActive = opt.value === active
        return (
          <button
            key={opt.value}
            ref={(el) => {
              if (el) segRefs.current.set(opt.value, el)
              else segRefs.current.delete(opt.value)
            }}
            onClick={() => !opt.disabled && onChange(opt.value)}
            disabled={opt.disabled}
            title={opt.disabled ? opt.disabledHint : undefined}
            className={`relative z-10 shrink-0 ${scrollable ? "" : "flex-1"} flex items-center justify-center gap-1.5
              font-cinzel uppercase tracking-wide whitespace-nowrap rounded-full transition-colors duration-300
              disabled:cursor-not-allowed ${
                size === "sm" ? "text-[11px] px-3.5 py-2" : "text-xs px-4 py-2.5"
              } ${
                isActive
                  ? "text-black font-bold"
                  : opt.disabled
                    ? "text-gray-600"
                    : accent === "emerald"
                      ? "text-gray-300 hover:text-emerald-300"
                      : "text-gray-300 hover:text-gold"
              }`}
          >
            {opt.label}
          </button>
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
  /** Groq-generated commentary lookup — see hooks/use-ball-commentary.ts.
   *  Optional: when omitted, the Commentary tab falls back entirely to
   *  the deterministic phrase-bank text. */
  getCommentaryText?: (over: number, ball: number) => string | undefined
  isCommentaryOverPending?: (over: number) => boolean
  /** Resolved, guaranteed-distinct team colors computed once in
   *  MatchDetailClient (lib/team-colors.ts) — passed straight through to
   *  the Graphs tab so every chart there agrees with the score-strip
   *  colors instead of MatchGraphs recomputing its own, undistinct pair. */
  teamAColor: string
  teamBColor: string
  /** Physical team that actually batted in innings1 / innings2 —
   *  resolved via match.inningsOneBattingTeam in MatchDetailClient.
   *  Every innings-order label in this file (Scorecard toggle buttons,
   *  BattingCard/BowlingCard titles, Overs tab pills, Commentary tab
   *  pills) MUST key off these two instead of match.teamA/match.teamB
   *  directly — the innings data (innings1 / innings2Partial /
   *  innings2Final) is keyed by bowling order, not team identity, so a
   *  hardcoded teamA-batted-first assumption silently mislabels every
   *  match where the team batting second won the toss. */
  firstInningsTeam: MatchDetail["teamA"]
  secondInningsTeam: MatchDetail["teamA"]
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
  getCommentaryText,
  isCommentaryOverPending,
  teamAColor,
  teamBColor,
  firstInningsTeam,
  secondInningsTeam,
}: MatchTabsProps) {
  // Squad name -> team logo, sourced from match.teamA/teamB (the actual
  // logo data lives there, not on MatchSquad itself — a squad's `team`
  // field is just the team's display name). Falls back to whatever the
  // squad object carries directly in case it's ever populated upstream.
  const teamLogoByName = new Map<string, string | undefined>([
    [match.teamA.name, match.teamA.logo],
    [match.teamB.name, match.teamB.logo],
  ])

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

  // ── infinite-loop curved carousel: refs + scroll-driven transform math ──
  const tabScrollerRef = useRef<HTMLDivElement>(null)
  const tabItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [tabReducedMotion, setTabReducedMotion] = useState(false)
  const tabRafId = useRef<number | null>(null)
  // Width (px) of one full copy of TABS inside the looped strip — used
  // to silently snap scrollLeft back by one copy whenever the user
  // nears either end, so the strip never runs out of tabs to scroll
  // into. Measured after layout, re-measured on resize.
  const tabSetWidth = useRef(0)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setTabReducedMotion(mq.matches)
    const handler = () => setTabReducedMotion(mq.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const applyTabCurve = useCallback(() => {
    const scroller = tabScrollerRef.current
    if (!scroller || tabReducedMotion) return

    const scrollerRect = scroller.getBoundingClientRect()
    const centerX = scrollerRect.left + scrollerRect.width / 2

    tabItemRefs.current.forEach((el) => {
      const r = el.getBoundingClientRect()
      const itemCenter = r.left + r.width / 2
      const distance = itemCenter - centerX
      const f = arcFalloff(distance) // 0 = centered, 1 = far
      const lift = -ARC_LIFT * (1 - f)
      const scale = ARC_SCALE_MAX - (ARC_SCALE_MAX - ARC_SCALE_MIN) * f
      const opacity = ARC_OPACITY_MAX - (ARC_OPACITY_MAX - ARC_OPACITY_MIN) * f

      el.style.transform = `translateY(${lift}px) scale(${scale})`
      el.style.opacity = String(opacity)
    })
  }, [tabReducedMotion])

  // Re-measures one copy-width and, on first run, parks the scroll
  // position in the middle copy so there's a full copy's worth of
  // tabs to scroll into on both sides right from the start.
  const measureAndCenterLoop = useCallback((recenter: boolean) => {
    const scroller = tabScrollerRef.current
    if (!scroller) return
    const width = scroller.scrollWidth / LOOP_COPIES
    tabSetWidth.current = width
    if (recenter && width > 0) {
      scroller.scrollLeft = width // start in the middle copy
    }
  }, [])

  useEffect(() => {
    // Layout needs a tick to settle before scrollWidth is reliable.
    const raf = requestAnimationFrame(() => {
      measureAndCenterLoop(true)
      applyTabCurve()
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll handler: updates the curve every frame, and silently wraps
  // scrollLeft back by one copy-width whenever it drifts near either
  // end of the looped strip — imperceptible since adjacent copies are
  // pixel-identical, so the strip always looks full of tabs.
  const onTabScroll = useCallback(() => {
    if (tabRafId.current) cancelAnimationFrame(tabRafId.current)
    tabRafId.current = requestAnimationFrame(() => {
      applyTabCurve()
      const scroller = tabScrollerRef.current
      const setWidth = tabSetWidth.current
      if (!scroller || setWidth <= 0) return
      if (scroller.scrollLeft < setWidth * 0.4) {
        scroller.scrollLeft += setWidth
      } else if (scroller.scrollLeft > setWidth * (LOOP_COPIES - 1.4)) {
        scroller.scrollLeft -= setWidth
      }
    })
  }, [applyTabCurve])

  useEffect(() => {
    const handleResize = () => {
      measureAndCenterLoop(false)
      applyTabCurve()
    }
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      if (tabRafId.current) cancelAnimationFrame(tabRafId.current)
    }
  }, [measureAndCenterLoop, applyTabCurve])

  // Center the active tab whenever it changes (tap or programmatic) —
  // picks whichever looped copy of that tab is nearest the current
  // scroll position, so the jump is always small.
  useEffect(() => {
    const scroller = tabScrollerRef.current
    if (!scroller) return
    const scrollerRect = scroller.getBoundingClientRect()
    const centerX = scrollerRect.left + scrollerRect.width / 2

    let closestEl: HTMLButtonElement | null = null
    let closestDist = Infinity
    tabItemRefs.current.forEach((el, extKey) => {
      if (extKey.split("__")[0] !== tab) return
      const r = el.getBoundingClientRect()
      const dist = Math.abs(r.left + r.width / 2 - centerX)
      if (dist < closestDist) {
        closestDist = dist
        closestEl = el
      }
    })
    if (!closestEl) return
    const elRect = (closestEl as HTMLButtonElement).getBoundingClientRect()
    const offset = elRect.left - scrollerRect.left - scrollerRect.width / 2 + elRect.width / 2
    scroller.scrollBy({ left: offset, behavior: "smooth" })
    const t = setTimeout(applyTabCurve, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  return (
    <>
      {/* CURVED CAROUSEL TAB BAR — infinite loop */}
      <div className="relative mb-8">
        {/* subtle arc backdrop so the curve reads even before scrolling */}
        <svg
          className="pointer-events-none absolute left-0 right-0 -top-1 h-6 w-full opacity-20"
          viewBox="0 0 100 10"
          preserveAspectRatio="none"
        >
          <path d="M0,10 Q50,0 100,10" stroke="#f5a623" strokeWidth="0.5" fill="none" />
        </svg>

        <div
          ref={tabScrollerRef}
          onScroll={onTabScroll}
          className="flex flex-nowrap items-end gap-1.5 overflow-x-auto snap-x snap-mandatory
                     scrollbar-none bg-black/50 border border-gold/20 px-3 py-3 rounded-full w-full"
        >
          {LOOPED_TABS.map(({ key, label, extKey }) => {
            const locked = isTabLocked(key)
            const active = tab === key
            return (
              <button
                key={extKey}
                ref={(el) => {
                  if (el) tabItemRefs.current.set(extKey, el)
                  else tabItemRefs.current.delete(extKey)
                }}
                onClick={() => setTab(key)}
                title={locked ? `${label} — no data yet` : undefined}
                className={`snap-center shrink-0 flex items-center gap-1.5 font-cinzel text-xs uppercase
                  tracking-wide px-4 py-2 rounded-full whitespace-nowrap origin-bottom
                  transition-[background-color,color,border-color] duration-300 ${
                  tabReducedMotion ? "" : "transition-transform will-change-transform"
                } ${
                  active
                    ? "bg-gold text-black shadow-[0_4px_18px_rgba(245,166,35,0.35)] border border-gold"
                    : locked
                      ? "bg-white/[0.02] text-gray-600 border border-white/5 hover:text-gray-400"
                      : "bg-white/[0.03] text-gray-300 border border-gold/10 hover:text-gold hover:border-gold/30"
                }`}
              >
                {label}
                {locked && <Lock className="h-2.5 w-2.5" />}
              </button>
            )
          })}
        </div>

        {/* edge fades — purely decorative now, since the loop means the
            strip is never actually empty past these edges */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 rounded-l-full bg-gradient-to-r from-black/70 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 rounded-r-full bg-gradient-to-l from-black/70 to-transparent" />
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
              <div className="mb-6">
                <SegmentedTabs
                  active={innings}
                  onChange={(i) => setInnings(i)}
                  options={[
                    {
                      value: 1 as const,
                      label: (
                        <span className="break-words">
                          {firstInningsTeam.short} — 1st Innings · {match.innings1.total}/{match.innings1.wkts}
                        </span>
                      ),
                    },
                    {
                      value: 2 as const,
                      disabled: !innings2Started,
                      disabledHint: "2nd innings — locked until it starts",
                      label: innings2Started ? (
                        <span className="break-words">
                          {secondInningsTeam.short} — 2nd Innings · {runs}/{wkts}
                        </span>
                      ) : (
                        <>
                          <Lock className="h-3 w-3 shrink-0" />
                          {secondInningsTeam.short} — yet to bat
                        </>
                      ),
                    },
                  ]}
                />
              </div>

              {innings === 1 && (
                <>
                  <BattingCard
                    title={`${firstInningsTeam.short} Batting`}
                    rows={match.innings1.batting}
                    extras={match.innings1.extras}
                    extrasNote={match.innings1.extrasNote}
                    total={match.innings1.total}
                    wkts={match.innings1.wkts}
                    overs={match.innings1.overs}
                    dnb={match.innings1.dnb}
                  />
                  <FowList fow={match.innings1.fow} />
                  <BowlingCard title={`${secondInningsTeam.short} Bowling`} rows={match.innings1.bowling} />
                </>
              )}

              {innings === 2 && !innings2Started && (
                <LockedTabPanel
                  title="2nd innings not started"
                  hint={`${secondInningsTeam.short} haven't come out to bat yet — this fills in the moment the chase begins.`}
                />
              )}

              {innings === 2 && innings2Started && live && (
                <>
                  <BattingCard
                    title={`${secondInningsTeam.short} Batting`}
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
                  <BowlingCard title={`${firstInningsTeam.short} Bowling`} rows={match.innings2Partial.bowling} live />
                </>
              )}

              {innings === 2 && innings2Started && !live && (
                <>
                  <BattingCard
                    title={`${secondInningsTeam.short} Batting`}
                    rows={match.innings2Final.batting}
                    extras={match.innings2Final.extras}
                    extrasNote={match.innings2Final.extrasNote}
                    total={match.innings2Final.total}
                    wkts={match.innings2Final.wkts}
                    overs={match.innings2Final.overs}
                    dnb={match.innings2Final.dnb}
                  />
                  <FowList fow={match.innings2Final.fow} />
                  <BowlingCard title={`${firstInningsTeam.short} Bowling`} rows={match.innings2Final.bowling} />
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
            match.squads.map((s) => (
              <MatchSquadPanel
                key={s.team}
                squad={s}
                logo={teamLogoByName.get(s.team)}
              />
            ))
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
                <div className="mb-4 max-w-xs">
                  <SegmentedTabs
                    size="sm"
                    active={innings}
                    onChange={(i) => setInnings(i)}
                    options={[
                      { value: 1 as const, label: `${firstInningsTeam.short} (1st Inn)` },
                      {
                        value: 2 as const,
                        disabled: !innings2Started,
                        disabledHint: "2nd innings — locked until it starts",
                        label: (
                          <>
                            {!innings2Started && <Lock className="h-2.5 w-2.5" />}
                            {secondInningsTeam.short} (2nd Inn)
                          </>
                        ),
                      },
                    ]}
                  />
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
                <div className="flex flex-wrap gap-2 mb-4 items-center">
                  <div className="max-w-xs w-full sm:w-auto">
                    <SegmentedTabs
                      size="sm"
                      active={innings}
                      onChange={(i) => setInnings(i)}
                      options={[
                        { value: 1 as const, label: `${firstInningsTeam.short} (1st Inn)` },
                        {
                          value: 2 as const,
                          disabled: !innings2Started,
                          disabledHint: "2nd innings — locked until it starts",
                          label: (
                            <>
                              {!innings2Started && <Lock className="h-2.5 w-2.5" />}
                              {secondInningsTeam.short} (2nd Inn)
                            </>
                          ),
                        },
                      ]}
                    />
                  </div>
                  {live && (
                    <span className="ml-auto flex items-center gap-1.5 text-green-300 text-[10px] uppercase tracking-widest font-cinzel self-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" /> auto-updating
                    </span>
                  )}
                </div>

                {/* Legend explaining the two commentary sources */}
                {hasDeliveryData && (
                  <div className="flex flex-wrap items-center gap-3 px-1 pb-1">
                    <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <CommentarySourceTag isAi={true} />
                      cinematic, narrated ball-by-ball text
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <CommentarySourceTag isAi={false} />
                      plain text derived straight from delivery data
                    </span>
                  </div>
                )}

                {innings === 2 && !innings2Started ? (
                  <p className="text-gray-500 text-sm text-center py-8">2nd innings hasn't started yet.</p>
                ) : !hasDeliveryData ? (
                  <p className="text-gray-500 text-sm text-center py-8">
                    No ball-by-ball data recorded for this innings yet — commentary will appear once it starts.
                  </p>
                ) : (
                  <CommentaryFeed
                    deliveries={rawDeliveries!}
                    overOverData={overOverData}
                    isLive={live}
                    getLlmText={getCommentaryText}
                    isOverPending={isCommentaryOverPending}
                  />
                )}
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
            teamAColor={teamAColor}
            teamBColor={teamBColor}
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
// SCORECARD — batting / bowling / fall-of-wickets cards
//
// REDESIGNED: previously a plain header-row + data-grid table (same
// bare layout for every card). Rows are now avatar-led — same visual
// language as the live CurrentPlayStrip/partnership rows on the match
// header — with the top scorer/wicket-taker picked out by a subtle
// gold highlight + trophy mark, and bowling economy colour-coded
// (green/gold/red) the same way econTone already does on the header
// strip, so a completed scorecard reads at a glance instead of being
// a flat list of numbers.
// ─────────────────────────────────────────────────────────────

/** Colours a bowling economy figure — green when tidy, red when
 *  expensive, gold in between. Mirrors the same thresholds used for
 *  the live current-bowler strip on the match header. */
function econTone(econ: string | number): string {
  const value = typeof econ === "number" ? econ : parseFloat(econ)
  if (Number.isNaN(value)) return "text-gold"
  if (value < 6) return "text-emerald-400"
  if (value > 9) return "text-red-400"
  return "text-gold"
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
  const topScore = rows.length ? Math.max(...rows.map((b) => b.runs)) : 0

  return (
    <div className="relative rounded-xl border border-gold/15 bg-gradient-to-b from-white/[0.03] to-transparent p-5 mb-4 overflow-hidden">
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="flex items-center justify-between mb-3">
        <p className="text-gold text-xs uppercase tracking-widest font-cinzel font-semibold">{title}</p>
        {live && (
          <span className="flex items-center gap-1.5 text-green-300 text-[10px] uppercase tracking-widest font-cinzel">
            <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" /> live
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-600 text-xs text-center py-6">No data yet.</p>
      ) : (
        <div className="divide-y divide-gold/5">
          {rows.map((b) => {
            const sr = b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0"
            const isTop = topScore > 0 && b.runs === topScore
            return (
              <div
                key={b.name}
                className={`flex items-center gap-3 py-2.5 px-1 -mx-1 rounded-lg transition-colors ${
                  isTop ? "bg-gold/[0.06]" : ""
                }`}
              >
                <div className="relative h-9 w-9 rounded-full bg-black/60 border border-gold/20 flex items-center justify-center shrink-0">
                  <span className="text-[10.5px] font-bold text-gold font-cinzel">{initials(b.name)}</span>
                  {b.notOut && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-black" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-gray-100 text-sm font-medium truncate flex items-center gap-1.5">
                    {b.name}
                    {isTop && <Trophy className="h-3 w-3 text-gold shrink-0" />}
                  </p>
                  <p className={`text-[10.5px] mt-0.5 truncate ${b.notOut ? "text-green-500" : "text-gray-500"}`}>
                    {b.notOut ? "not out" : b.how}
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  <span className="text-[9.5px] text-gray-500 tabular-nums bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                    {b.fours}×4
                  </span>
                  <span className="text-[9.5px] text-gray-500 tabular-nums bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                    {b.sixes}×6
                  </span>
                </div>

                <div className="text-right shrink-0 w-16">
                  <p className="text-sm font-bold font-cinzel text-white tabular-nums">
                    {b.runs}
                    <span className="text-gray-500 font-normal">({b.balls})</span>
                  </p>
                  <p className="text-[9px] text-gray-600 tabular-nums">SR {sr}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {creaseNote && (
        <p className="text-gray-400 text-[11px] mt-3 pt-3 border-t border-gold/10 break-words">
          At the crease: {creaseNote}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-gold/10">
        <span className="text-[11px] text-gray-400">
          Extras <span className="text-gray-200 font-medium">{extras}</span>{" "}
          <span className="text-gray-600">({extrasNote})</span>
        </span>
        <span className="text-sm font-bold font-cinzel text-white bg-gold/10 border border-gold/20 rounded-md px-3 py-1">
          {total}/{wkts} <span className="text-gray-400 font-normal text-xs">({overs} ov)</span>
        </span>
      </div>

      {dnb && dnb.length > 0 && (
        <p className="text-gray-500 text-[10px] mt-2.5 break-words">Did not bat: {dnb.join(", ")}</p>
      )}
    </div>
  )
}

function BowlingCard({ title, rows, live }: { title: string; rows: BowlingRow[]; live?: boolean }) {
  const topWkts = rows.length ? Math.max(...rows.map((b) => b.wkts)) : 0

  return (
    <div className="relative rounded-xl border border-gold/15 bg-gradient-to-b from-white/[0.03] to-transparent p-5 mb-4 overflow-hidden">
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="flex items-center justify-between mb-3">
        <p className="text-gold text-xs uppercase tracking-widest font-cinzel font-semibold">{title}</p>
        {live && <span className="text-gray-500 text-[10px] uppercase tracking-widest font-cinzel">so far</span>}
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-600 text-xs text-center py-6">No data yet.</p>
      ) : (
        <div className="divide-y divide-gold/5">
          {rows.map((b) => {
            const isTop = topWkts > 0 && b.wkts === topWkts
            return (
              <div
                key={b.name}
                className={`flex items-center gap-3 py-2.5 px-1 -mx-1 rounded-lg transition-colors ${
                  isTop ? "bg-gold/[0.06]" : ""
                }`}
              >
                <div className="h-9 w-9 rounded-full bg-black/60 border border-gold/20 flex items-center justify-center shrink-0">
                  <span className="text-[10.5px] font-bold text-gold font-cinzel">{initials(b.name)}</span>
                </div>

                <p className="text-gray-100 text-sm font-medium truncate flex-1 min-w-0 flex items-center gap-1.5">
                  {b.name}
                  {isTop && <Trophy className="h-3 w-3 text-gold shrink-0" />}
                </p>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="hidden sm:block text-center w-9">
                    <p className="text-sm font-semibold text-white tabular-nums">{b.overs}</p>
                    <p className="text-[8.5px] uppercase tracking-widest text-gray-600">Ov</p>
                  </div>
                  <div className="hidden sm:block text-center w-9">
                    <p className="text-sm font-semibold text-white tabular-nums">{b.runs}</p>
                    <p className="text-[8.5px] uppercase tracking-widest text-gray-600">R</p>
                  </div>
                  <div className="text-center w-7">
                    <p className="text-base font-bold font-cinzel text-white tabular-nums">{b.wkts}</p>
                    <p className="text-[8.5px] uppercase tracking-widest text-gray-600">W</p>
                  </div>
                  <div className="text-center w-11">
                    <p className={`text-sm font-bold font-cinzel tabular-nums ${econTone(b.econ)}`}>{b.econ}</p>
                    <p className="text-[8.5px] uppercase tracking-widest text-gray-600">Econ</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FowList({ fow }: { fow: FowEntry[] }) {
  if (fow.length === 0) return null
  return (
    <div className="relative rounded-xl border border-gold/15 bg-gradient-to-b from-white/[0.03] to-transparent p-5 mb-4 overflow-hidden">
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <p className="text-gold text-xs uppercase tracking-widest font-cinzel font-semibold mb-3">Fall of Wickets</p>
      <div className="flex flex-wrap gap-2">
        {fow.map((f, i) => (
          <span
            key={`${f[0]}-${i}`}
            className="flex items-center gap-1.5 text-[10.5px] text-gray-300 bg-white/[0.03] border border-gold/10 rounded-lg pl-1.5 pr-2.5 py-1"
          >
            <span className="h-4 w-4 rounded-full bg-red-600/80 text-white text-[8.5px] font-bold flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <b className="text-white">{f[0]}</b>-{f[1]}
            <span className="text-gray-500">({f[2]} ov)</span>
          </span>
        ))}
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

      <div className="mb-5">
        {mode === "batting" ? (
          <SegmentedTabs
            size="sm"
            scrollable
            active={battingKey}
            onChange={setBattingKey}
            options={BATTING_STAT_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
          />
        ) : (
          <SegmentedTabs
            size="sm"
            scrollable
            accent="emerald"
            active={bowlingKey}
            onChange={setBowlingKey}
            options={BOWLING_STAT_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
          />
        )}
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

/** Team badge next to a squad's name — the actual team logo when
 *  `squad.logo` is set (and loads successfully), falling back to the
 *  generic Shield icon only when there's no logo or it 404s. Squads
 *  previously always showed the Shield placeholder even when a real
 *  logo was available on the team, because MatchSquadPanel's header
 *  never read squad.logo at all. */
function SquadLogo({ name, logo }: { name: string; logo?: string }) {
  const [failed, setFailed] = useState(false)
  const showLogo = !!logo && !failed
  return showLogo ? (
    <div className="relative h-9 w-9 rounded-full overflow-hidden border border-gold/30 bg-black/40 shrink-0">
      <img
        src={logo}
        alt={`${name} logo`}
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  ) : (
    <span className="h-9 w-9 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
      <Shield className="h-4 w-4 text-gold drop-shadow-[0_0_6px_rgba(245,166,35,0.4)]" />
    </span>
  )
}

function MatchSquadPanel({ squad, logo }: { squad: MatchSquad; logo?: string }) {
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
          {/* Logo is resolved by MatchTabs from match.teamA/teamB (see
              teamLogoByName) and passed in as `logo` — MatchSquad
              itself doesn't carry a logo field. */}
          <SquadLogo name={squad.team} logo={logo} />
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