// app/tournament/[tournamentId]/page.tsx
"use client"

/**
 * TOURNAMENT PAGE — app/[tournamentId]/page.tsx
 *
 * Public-facing tournament microsite, built with the SAME design tokens and
 * utility classes already defined in your overlay-theme.css:
 *   - Color: var(--color-theme-orange) accent, var(--color-surface*) layers,
 *     var(--color-on-surface / on-surface-variant / outline) text
 *   - Type: font-headline-lg / font-headline-md (Archivo Narrow),
 *     font-body-md / font-body-lg (Inter), font-label-mono / font-label-xs (Geist Mono)
 *   - Components reused as-is: .glass-panel, .scoreboard-strip, .squad-list /
 *     .squad-chip / .squad-avatar, .crew-slot, .summary-tile, .pulse-live
 *
 * This is a MOCK page. It reads `tournamentId` from the route so the page
 * shell is wired correctly, but every field in the MOCK DATA block below is
 * placeholder — the same content renders for any tournamentId visited.
 *
 * To make it real:
 *   1. Replace MOCK DATA with a fetch keyed on `tournamentId`, hitting your
 *      own DB/API (this is your tournament's live data, not a third-party
 *      cricket API).
 *   2. Since that fetch is async, drop "use client", make the component
 *      `async`, and `await` the data — move the leaderboard tab `useState`
 *      into a small client child component.
 */

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Award,
  Calendar,
  ChevronRight,
  MapPin,
  Radio,
  Shield,
  Swords,
  Target,
  Trophy,
  Users,
} from "lucide-react"

/* ────────────────────────────────────────────────────────────────────────
   MOCK DATA — replace with a fetch keyed on tournamentId
   ──────────────────────────────────────────────────────────────────────── */

const tournament = {
  name: "Valiant Cup",
  season: "Season 3",
  format: "T20 · Group Stage + Playoffs",
  dates: "14 – 28 July 2026",
  venue: "Negombo Cricket Grounds",
  status: "LIVE" as const, // "LIVE" | "UPCOMING" | "COMPLETED"
}

const liveMatch = {
  isLive: true,
  teamA: { name: "Ironclad Royals", short: "ICR", score: "168/6" },
  teamB: { name: "Falcon Riders", short: "FR", score: "142/8", overs: "20.0" },
  status: "ICR need 0 runs from 8 balls · Match ends in a few minutes",
}

const pointsTable = [
  { pos: 1, team: "Ironclad Royals", p: 8, w: 6, l: 2, nrr: "+1.42", pts: 12 },
  { pos: 2, team: "Falcon Riders", p: 8, w: 5, l: 3, nrr: "+0.87", pts: 10 },
  { pos: 3, team: "Desert Hawks", p: 8, w: 5, l: 3, nrr: "+0.31", pts: 10 },
  { pos: 4, team: "Coastal Titans", p: 8, w: 4, l: 4, nrr: "-0.05", pts: 8 },
  { pos: 5, team: "Northside Knights", p: 8, w: 2, l: 6, nrr: "-0.71", pts: 4 },
  { pos: 6, team: "Storm Chargers", p: 8, w: 2, l: 6, nrr: "-1.68", pts: 4 },
]

const fixtures = [
  { id: 1, teamA: "Desert Hawks", teamB: "Coastal Titans", date: "16 Jul", time: "3:00 PM", venue: "Ground 1" },
  { id: 2, teamA: "Northside Knights", teamB: "Storm Chargers", date: "17 Jul", time: "3:00 PM", venue: "Ground 2" },
  { id: 3, teamA: "Ironclad Royals", teamB: "Desert Hawks", date: "19 Jul", time: "7:00 PM", venue: "Ground 1" },
  { id: 4, teamA: "Falcon Riders", teamB: "Northside Knights", date: "20 Jul", time: "3:00 PM", venue: "Ground 1" },
]

const runsLeaderboard = [
  { rank: 1, player: "R. Fernando", team: "Ironclad Royals", value: 412, meta: "SR 148.2" },
  { rank: 2, player: "K. Perera", team: "Falcon Riders", value: 389, meta: "SR 136.9" },
  { rank: 3, player: "D. Silva", team: "Desert Hawks", value: 351, meta: "SR 141.5" },
]

const wicketsLeaderboard = [
  { rank: 1, player: "M. Jayasuriya", team: "Coastal Titans", value: 18, meta: "Econ 6.8" },
  { rank: 2, player: "T. Rathnayake", team: "Ironclad Royals", value: 16, meta: "Econ 7.1" },
  { rank: 3, player: "S. Kumara", team: "Storm Chargers", value: 15, meta: "Econ 7.4" },
]

const squads = [
  { team: "Ironclad Royals", captain: "R. Fernando", players: 15 },
  { team: "Falcon Riders", captain: "K. Perera", players: 15 },
  { team: "Desert Hawks", captain: "D. Silva", players: 14 },
  { team: "Coastal Titans", captain: "M. Jayasuriya", players: 15 },
  { team: "Northside Knights", captain: "A. Wickramasinghe", players: 15 },
  { team: "Storm Chargers", captain: "N. Gunaratne", players: 14 },
]

const knockoutBracket = [
  { round: "Qualifier 1", matchup: "Ironclad Royals vs Falcon Riders", result: "Ironclad Royals won", done: true },
  { round: "Eliminator", matchup: "Desert Hawks vs Coastal Titans", result: "TBD", done: false },
  { round: "Qualifier 2", matchup: "Loser Q1 vs Winner Eliminator", result: "TBD", done: false },
  { round: "Final", matchup: "Winner Q1 vs Winner Q2", result: "TBD", done: false },
]

const awards = [
  { label: "Player of the Tournament (so far)", name: "R. Fernando", note: "412 runs · 3 fifties" },
  { label: "Best Bowling Figures", name: "M. Jayasuriya", note: "5/18 vs Storm Chargers" },
  { label: "Fastest Fifty", name: "K. Perera", note: "21 balls vs Northside Knights" },
]

/* ──────────────────────────────────────────────────────────────────────── */

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function StatusPill({ status }: { status: typeof tournament.status }) {
  if (status === "LIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-label-mono text-[10px] tracking-[0.12em] uppercase bg-status-live/15 border border-status-live/40 text-status-live">
        <span className="tally pulse-live bg-status-live" />
        Live now
      </span>
    )
  }
  if (status === "UPCOMING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-label-mono text-[10px] tracking-[0.12em] uppercase bg-theme-orange/15 border border-theme-orange/40 text-theme-orange">
        Upcoming
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-label-mono text-[10px] tracking-[0.12em] uppercase bg-outline/15 border border-outline/30 text-outline">
      Completed
    </span>
  )
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center mb-10">
      <span className="font-label-mono text-[10px] tracking-[0.2em] uppercase text-theme-orange/80">{eyebrow}</span>
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-2xl md:text-3xl font-bold text-on-background mt-2">
        {title}
      </h2>
    </div>
  )
}

interface PageProps {
  params: { tournamentId: string }
}

export default function TournamentPage({ params }: PageProps) {
  const { tournamentId } = params
  const [tab, setTab] = useState<"runs" | "wickets">("runs")
  const activeBoard = tab === "runs" ? runsLeaderboard : wicketsLeaderboard

  return (
    <main className="bg-background text-on-background min-h-screen">
      {/* ═══════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════ */}
      <section className="border-b border-border-overlay px-4 py-16 md:py-20 text-center">
        <div className="flex justify-center mb-5">
          <StatusPill status={tournament.status} />
        </div>
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-3xl md:text-5xl font-bold tracking-wide">
          {tournament.name} <span className="text-theme-orange">{tournament.season}</span>
        </h1>
        <p className="font-body-md text-on-surface-variant mt-3 max-w-xl mx-auto text-sm">{tournament.format}</p>

        <div className="flex flex-wrap justify-center gap-6 mt-6 font-label-mono text-xs text-outline">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-theme-orange" /> {tournament.dates}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-theme-orange" /> {tournament.venue}
          </span>
        </div>

        {/* Dev-only indicator that the dynamic route param is wired up.
            Remove once real data is fetched by tournamentId. */}
        <p className="mt-6 font-label-mono text-[9px] text-outline/60 tracking-widest">
          MOCK DATA · route param tournamentId = &quot;{tournamentId}&quot;
        </p>
      </section>

      {/* ═══════════════════════════════════════════
          LIVE MATCH — reuses .scoreboard-strip as-is
      ═══════════════════════════════════════════ */}
      {liveMatch.isLive && (
        <section className="px-4 py-6">
          <div className="max-w-3xl mx-auto scoreboard-strip">
            <span className="tally pulse-live bg-status-live" />
            <div className="scoreboard-main flex items-baseline gap-2">
              <span className="scoreboard-runs">{liveMatch.teamA.score}</span>
              <span className="font-label-mono text-xs text-outline uppercase">{liveMatch.teamA.short}</span>
            </div>
            <Swords className="h-4 w-4 text-outline shrink-0" />
            <div className="scoreboard-main flex items-baseline gap-2">
              <span className="scoreboard-wkts">{liveMatch.teamB.score}</span>
              <span className="font-label-mono text-xs text-outline uppercase">
                {liveMatch.teamB.short} ({liveMatch.teamB.overs})
              </span>
            </div>
            <span className="scoreboard-meta ml-auto">{liveMatch.status}</span>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════
          POINTS TABLE
      ═══════════════════════════════════════════ */}
      <section className="px-4 py-14">
        <SectionHeading eyebrow="Standings" title="Points Table" />

        <div className="max-w-3xl mx-auto glass-panel rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2rem_1fr_repeat(5,2.75rem)] md:grid-cols-[2.5rem_1fr_repeat(5,3.5rem)] border-b border-border-overlay">
            {["#", "Team", "P", "W", "L", "NRR", "Pts"].map((h) => (
              <div key={h} className="p-3 text-center font-label-mono text-[10px] tracking-widest uppercase text-outline first:text-left">
                {h}
              </div>
            ))}
          </div>
          {pointsTable.map((row, i) => (
            <div
              key={row.team}
              className={cn(
                "grid grid-cols-[2rem_1fr_repeat(5,2.75rem)] md:grid-cols-[2.5rem_1fr_repeat(5,3.5rem)] items-center text-xs md:text-sm border-l-2",
                i < pointsTable.length - 1 ? "border-b border-border-overlay" : "",
                i < 4 ? "border-l-theme-orange bg-theme-orange/[0.03]" : "border-l-transparent"
              )}
            >
              <div className="p-3 text-center text-outline font-label-mono">{row.pos}</div>
              <div className="p-3 font-body-md text-on-surface font-medium">{row.team}</div>
              <div className="p-3 text-center text-on-surface-variant">{row.p}</div>
              <div className="p-3 text-center text-on-surface-variant">{row.w}</div>
              <div className="p-3 text-center text-on-surface-variant">{row.l}</div>
              <div className="p-3 text-center text-on-surface-variant">{row.nrr}</div>
              <div className="p-3 text-center text-theme-orange font-bold font-label-mono">{row.pts}</div>
            </div>
          ))}
        </div>
        <p className="text-center font-label-mono text-[10px] text-outline mt-4">
          Top 4 (orange edge) advance to the playoffs.
        </p>
      </section>

      {/* ═══════════════════════════════════════════
          FIXTURES — reuses .crew-slot
      ═══════════════════════════════════════════ */}
      <section className="px-4 py-14">
        <SectionHeading eyebrow="Schedule" title="Upcoming Fixtures" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
          {fixtures.map((f) => (
            <div key={f.id} className="crew-slot flex items-center justify-between">
              <div>
                <p className="crew-slot-name">
                  {f.teamA} <span className="text-theme-orange">vs</span> {f.teamB}
                </p>
                <p className="crew-slot-stat mt-1">
                  {f.date} · {f.time} · {f.venue}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-theme-orange/60 shrink-0" />
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          KNOCKOUT BRACKET PREVIEW
      ═══════════════════════════════════════════ */}
      <section className="px-4 py-14">
        <SectionHeading eyebrow="Playoffs" title="Knockout Bracket" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
          {knockoutBracket.map((stage) => (
            <div
              key={stage.round}
              className={cn("crew-slot", stage.done && "is-active")}
            >
              <p className="font-label-mono text-[10px] tracking-widest uppercase text-theme-orange mb-2">{stage.round}</p>
              <p className="font-body-md text-sm text-on-surface mb-2">{stage.matchup}</p>
              <p className={cn("font-label-mono text-[11px]", stage.done ? "text-on-surface-variant" : "text-outline italic")}>
                {stage.result}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-theme-orange/40 bg-theme-orange/10 hover:bg-theme-orange/20 transition-colors px-4 py-2 font-label-mono text-[11px] tracking-widest uppercase text-theme-orange">
            View Full Bracket
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          LEADERBOARD
      ═══════════════════════════════════════════ */}
      <section className="px-4 py-14">
        <SectionHeading eyebrow="Player Stats" title="Tournament Leaderboard" />

        <div className="flex justify-center gap-2 mb-8">
          <button
            onClick={() => setTab("runs")}
            className={cn(
              "font-label-mono text-[10px] tracking-widest uppercase px-4 py-2 rounded-lg border transition-all",
              tab === "runs"
                ? "bg-theme-orange text-on-primary border-theme-orange"
                : "border-border-overlay text-on-surface-variant hover:border-theme-orange/40"
            )}
          >
            Most Runs
          </button>
          <button
            onClick={() => setTab("wickets")}
            className={cn(
              "font-label-mono text-[10px] tracking-widest uppercase px-4 py-2 rounded-lg border transition-all",
              tab === "wickets"
                ? "bg-theme-orange text-on-primary border-theme-orange"
                : "border-border-overlay text-on-surface-variant hover:border-theme-orange/40"
            )}
          >
            Most Wickets
          </button>
        </div>

        <div className="max-w-xl mx-auto space-y-2.5">
          {activeBoard.map((row) => (
            <div key={row.player} className="crew-slot flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-label-mono text-theme-orange font-bold w-5 text-center">{row.rank}</span>
                <div className="squad-avatar">
                  <span className="squad-avatar-fallback">{initials(row.player)}</span>
                </div>
                <div>
                  <p className="crew-slot-name">{row.player}</p>
                  <p className="crew-slot-stat">{row.team}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-label-mono text-lg font-bold text-theme-orange leading-none">{row.value}</p>
                <p className="crew-slot-stat mt-1">{row.meta}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SQUADS — reuses .squad-list / .squad-chip
      ═══════════════════════════════════════════ */}
      <section className="px-4 py-14">
        <SectionHeading eyebrow="Teams" title="Squad Overview" />

        <div className="max-w-4xl mx-auto space-y-6">
          {squads.map((s) => (
            <div key={s.team} className="glass-panel rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-theme-orange" />
                  <p className="font-headline-md text-sm font-bold text-on-surface">{s.team}</p>
                </div>
                <p className="font-label-mono text-[10px] text-outline flex items-center gap-1.5">
                  <Users className="h-3 w-3" /> {s.players} players · Capt. {s.captain}
                </p>
              </div>
              <div className="squad-list">
                {Array.from({ length: s.players }).map((_, i) => (
                  <div key={i} className="squad-chip">
                    <div className="squad-avatar">
                      <span className="squad-avatar-fallback">{initials(i === 0 ? s.captain : `Player ${i + 1}`)}</span>
                    </div>
                    <span className="squad-name">{i === 0 ? s.captain : `Player ${i + 1}`}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          AWARDS — reuses .summary-tile
      ═══════════════════════════════════════════ */}
      <section className="px-4 py-14">
        <SectionHeading eyebrow="Recognition" title="Awards & Milestones" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {awards.map((a) => (
            <div key={a.label} className="summary-tile items-center text-center py-6">
              <Award className="h-5 w-5 text-theme-orange mx-auto mb-3" />
              <p className="font-label-mono text-[9px] uppercase tracking-widest text-outline mb-2">{a.label}</p>
              <p className="summary-tile-value text-base">{a.name}</p>
              <p className="font-label-mono text-[10px] text-outline mt-1">{a.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          CTA
      ═══════════════════════════════════════════ */}
      <section className="px-4 py-16 text-center border-t border-border-overlay">
        <Trophy className="h-6 w-6 text-theme-orange mx-auto mb-4" />
        <h3 className="font-headline-md text-xl font-bold text-on-background mb-2">
          Follow every ball of <span className="text-theme-orange">{tournament.name}</span>
        </h3>
        <p className="font-body-md text-sm text-on-surface-variant mb-6">
          Live scores, standings, and stats update automatically as matches finish.
        </p>
        <button className="inline-flex items-center gap-2 rounded-lg bg-theme-orange hover:bg-theme-orange/90 transition-colors px-5 py-3 font-label-mono text-xs tracking-widest uppercase text-on-primary font-bold">
          <Target className="h-4 w-4" />
          Follow Live Scores
        </button>
      </section>
    </main>
  )
}