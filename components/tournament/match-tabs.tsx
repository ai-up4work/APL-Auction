"use client"

import { Lock, Shield } from "lucide-react"
import type {
  MatchDetail,
  BattingRow,
  BowlingRow,
  FowEntry,
  MatchSquad,
  InningsComplete,
  DeliveryEntry,
} from "@/data/match-data"
import MatchGraphs, { type OverRow } from "./match-graphs"
import type { MatchDetail as GraphMatchDetail } from "@/data/tournament-data"

export type Tab = "info" | "scorecard" | "squads" | "overs" | "graphs"

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

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
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

function notOutBatters(rows: BattingRow[]): string {
  const names = rows.filter((b) => b.notOut).map((b) => b.name)
  return names.length > 0 ? `${names.join(" & ")} (not out)` : ""
}

// ─────────────────────────────────────────────────────────────
// Ball-by-ball chips (Overs tab)
// ─────────────────────────────────────────────────────────────
// `InningsComplete.deliveries` / `innings2Partial.deliveries` carry the
// raw per-ball log now (see the BALL-BY-BALL DELIVERIES note in
// data/match-data.ts). This turns each delivery into a small labelled
// chip — dot, run, boundary, extra, or wicket — instead of the old
// per-over display which only ever showed a bare "W" for any wicket
// that fell in the over. Both are additive: matches/innings that don't
// have `deliveries` populated yet (older rows, or a live-match hook that
// hasn't been updated to carry it) fall straight back to that original
// wicket-chip-only rendering, unchanged, in the Overs tab below.
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

function DeliveryChipView({ delivery }: { delivery: DeliveryEntry }) {
  const { label, kind } = deliveryChip(delivery)
  const title = delivery.isWicket
    ? "Wicket"
    : delivery.extraType
      ? delivery.extraType.replace("_", " ")
      : `${delivery.runs} run${delivery.runs === 1 ? "" : "s"}`
  return (
    <span
      title={title}
      className={`h-6 min-w-[1.5rem] px-1.5 rounded flex items-center justify-center text-[11px] font-bold shrink-0 ${chipStyles[kind]}`}
    >
      {label}
    </span>
  )
}

/** Groups an innings' raw delivery log by over number, sorted by ball
 *  within each over — the shape the Overs tab renders directly. */
function groupDeliveriesByOver(deliveries: DeliveryEntry[]): Map<number, DeliveryEntry[]> {
  const byOver = new Map<number, DeliveryEntry[]>()
  for (const d of deliveries) {
    if (!byOver.has(d.over)) byOver.set(d.over, [])
    byOver.get(d.over)!.push(d)
  }
  for (const list of byOver.values()) list.sort((a, b) => a.ball - b.ball)
  return byOver
}

interface MatchTabsProps {
  match: MatchDetail
  status: "not_started" | "live" | "completed"
  live: boolean
  completed: boolean
  hasBallData: boolean
  innings2Started: boolean
  /** Current (or final, once the innings is over) 2nd-innings totals. */
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
}

/** Tabs bar + all tab content (Info / Scorecard / Squads / Overs /
 *  Graphs). Assumes the match has actually started — the parent is
 *  responsible for only rendering this once `started` is true, since a
 *  not-started match shows a single "not started" notice instead of the
 *  full tab shell (every tab would just be locked anyway). */
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
}: MatchTabsProps) {
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

      {/* SQUADS TAB — degrades gracefully via LockedTabPanel when
          no squads have been added yet for this match. */}
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

            // Real ball-by-ball log for whichever innings is selected —
            // innings 1 always reads from the completed innings1 record;
            // innings 2 reads from the live partial while the chase is
            // in progress, else the completed innings2Final record. Both
            // are optional/additive (see data/match-data.ts), so this
            // is `undefined` for older matches or a live-match hook that
            // hasn't been updated to carry deliveries yet.
            const rawDeliveries: DeliveryEntry[] | undefined =
              innings === 1 ? match.innings1.deliveries : live ? match.innings2Partial.deliveries : match.innings2Final.deliveries
            const hasDeliveryData = !!rawDeliveries && rawDeliveries.length > 0
            const deliveriesByOver = hasDeliveryData ? groupDeliveriesByOver(rawDeliveries!) : null

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
                              return overBalls.map((d, ballIdx) => <DeliveryChipView key={ballIdx} delivery={d} />)
                            }
                            // Fallback: no real per-ball log for this over
                            // (or this innings) — original wicket-only
                            // chip display, unchanged.
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