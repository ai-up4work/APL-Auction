"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowLeft,
  ShieldCheck,
  Globe2,
  Coins,
  BarChart3,
  CalendarDays,
  MapPin,
  Trophy,
} from "lucide-react"
import { SiteHeader } from "@/components/landing/site-header"
import { TypeText } from "@/components/landing/type-text"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { pageStyles } from "@/data/site-data"
import { supabaseBrowser as supabase } from "@/lib/matches/supabase-browser"

import {
  getPlayerDetailForPublic,
  type PlayerDetail,
  type PlayerRole,
  type PlayerStatus,
} from "@/lib/players/players"

// ─────────────────────────────────────────────────────────────
// MATCH HISTORY
//
// Modeled on CrickPro's player profile pattern (see
// crickpro.com/player/<slug>/matches): a tab strip under the identity
// header, with "Matches" showing a chronological list of every match
// the player appears in and their personal line for that game.
//
// Source of truth: `balls`, filtered to rows where this player was
// striker_player_id OR bowler_player_id (populated by the simulator —
// see simulator-engine.ts / the simulate-match page). Grouped by
// match_id in JS, then each match's team/venue/date/result comes from
// `matches.match_setup` and the two team ids seen on this player's own
// ball rows (so it works whether the player batted, bowled, or both).
//
// Batting/bowling-credit rules used below are the standard cricket
// scoring conventions, not this codebase's invention:
//  - Wide:     doesn't count as a ball faced; the 1 run isn't credited
//              to the batter's runs.
//  - No-ball:  DOES count as a ball faced; any runs off the bat count,
//              but the +1 no-ball run itself isn't part of the batter's
//              tally (and isn't charged to a specific delivery count).
//  - Bye/leg-bye: counts as a ball faced, but the runs are NOT credited
//              to the batter, and are NOT charged to the bowler.
//  - Run-outs aren't credited as bowler wickets.
// ─────────────────────────────────────────────────────────────

interface PlayerMatchBallRow {
  match_id: string
  sequence: number
  runs: number
  extra_type: "wide" | "no_ball" | "bye" | "leg_bye" | null
  is_wicket: boolean
  dismissal_type: string | null
  striker_player_id: string | null
  bowler_player_id: string | null
  batting_team_id: string | null
  bowling_team_id: string | null
}

interface PlayerMatchBatting {
  runs: number
  balls: number
  fours: number
  sixes: number
  dismissed: boolean
  dismissalType: string | null
}

interface PlayerMatchBowling {
  legalBalls: number
  runsConceded: number
  wickets: number
}

type MatchOutcome = "won" | "lost" | "tied" | null

interface PlayerMatchSummary {
  matchId: string
  date: string | null
  venue: string | null
  format: string | null
  playerTeamName: string
  playerTeamColor: string | null
  opponentName: string
  opponentLogo: string | null
  opponentColor: string | null
  resultText: string | null
  outcome: MatchOutcome
  batting: PlayerMatchBatting | null
  bowling: PlayerMatchBowling | null
}

function oversFromLegalBalls(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`
}

function strikeRate(runs: number, balls: number): string {
  return balls > 0 ? ((runs / balls) * 100).toFixed(1) : "—"
}

function economy(runsConceded: number, legalBalls: number): string {
  return legalBalls > 0 ? ((runsConceded / legalBalls) * 6).toFixed(2) : "—"
}

/** Heuristic outcome read from the free-text result ("CSK won by 5
 *  runs") — good enough for a small chip, not load-bearing anywhere. */
function deriveOutcome(resultText: string | null, playerTeamName: string): MatchOutcome {
  if (!resultText) return null
  const t = resultText.toLowerCase()
  if (t.includes("tied") || t.includes("draw") || t.includes("no result")) return "tied"
  if (!t.includes("won")) return null
  return t.includes(playerTeamName.toLowerCase()) ? "won" : "lost"
}

async function getPlayerMatchHistory(playerId: string): Promise<PlayerMatchSummary[]> {
  const { data: ballRows, error: ballsErr } = await supabase
    .from("balls")
    .select(
      "match_id, sequence, runs, extra_type, is_wicket, dismissal_type, striker_player_id, bowler_player_id, batting_team_id, bowling_team_id"
    )
    .or(`striker_player_id.eq.${playerId},bowler_player_id.eq.${playerId}`)
    .order("match_id", { ascending: true })
    .order("sequence", { ascending: true })

  if (ballsErr) {
    console.error("[getPlayerMatchHistory] failed loading balls:", ballsErr.message)
    return []
  }
  if (!ballRows || ballRows.length === 0) return []

  const byMatch = new Map<string, PlayerMatchBallRow[]>()
  for (const row of ballRows as PlayerMatchBallRow[]) {
    const list = byMatch.get(row.match_id) ?? []
    list.push(row)
    byMatch.set(row.match_id, list)
  }

  const matchIds = Array.from(byMatch.keys())

  const [{ data: matchRows, error: matchesErr }, teamIdSet] = await Promise.all([
    supabase.from("matches").select("id, match_setup").in("id", matchIds),
    Promise.resolve(
      new Set(
        ballRows.flatMap((r: PlayerMatchBallRow) => [r.batting_team_id, r.bowling_team_id]).filter((v): v is string => !!v)
      )
    ),
  ])

  if (matchesErr) {
    console.error("[getPlayerMatchHistory] failed loading matches:", matchesErr.message)
  }

  const { data: teamRows, error: teamsErr } = await supabase
    .from("teams")
    .select("id, name, logo, color")
    .in("id", Array.from(teamIdSet))

  if (teamsErr) {
    console.error("[getPlayerMatchHistory] failed loading teams:", teamsErr.message)
  }

  const teamById = new Map((teamRows ?? []).map((t) => [t.id, t]))
  const matchById = new Map((matchRows ?? []).map((m) => [m.id, m]))

  const summaries: PlayerMatchSummary[] = []

  for (const [matchId, rows] of byMatch.entries()) {
    const battingRows = rows.filter((r) => r.striker_player_id === playerId)
    const bowlingRows = rows.filter((r) => r.bowler_player_id === playerId)

    let batting: PlayerMatchBatting | null = null
    if (battingRows.length > 0) {
      let runs = 0
      let balls = 0
      let fours = 0
      let sixes = 0
      let dismissed = false
      let dismissalType: string | null = null

      for (const r of battingRows) {
        if (r.extra_type === "wide") continue // not a faced ball, no batter credit
        balls += 1
        if (r.extra_type !== "bye" && r.extra_type !== "leg_bye" && r.extra_type !== "no_ball") {
          runs += r.runs
          if (r.runs === 4) fours += 1
          if (r.runs === 6) sixes += 1
        }
        if (r.is_wicket) {
          dismissed = true
          dismissalType = r.dismissal_type
        }
      }
      batting = { runs, balls, fours, sixes, dismissed, dismissalType }
    }

    let bowling: PlayerMatchBowling | null = null
    if (bowlingRows.length > 0) {
      let legalBalls = 0
      let runsConceded = 0
      let wickets = 0

      for (const r of bowlingRows) {
        const isLegal = r.extra_type !== "wide" && r.extra_type !== "no_ball"
        if (isLegal) legalBalls += 1
        if (r.extra_type !== "bye" && r.extra_type !== "leg_bye") runsConceded += r.runs
        if (r.is_wicket && r.dismissal_type !== "run_out") wickets += 1
      }
      bowling = { legalBalls, runsConceded, wickets }
    }

    // Player's own team id: prefer the team they batted for, fall back
    // to the team they bowled for — either is fine since a player can
    // only genuinely belong to one side in a given match.
    const playerTeamId = battingRows[0]?.batting_team_id ?? bowlingRows[0]?.bowling_team_id ?? null
    const opponentTeamId = battingRows[0]?.bowling_team_id ?? bowlingRows[0]?.batting_team_id ?? null

    const playerTeam = playerTeamId ? teamById.get(playerTeamId) : null
    const opponentTeam = opponentTeamId ? teamById.get(opponentTeamId) : null

    const matchRow = matchById.get(matchId)
    const setup = (matchRow?.match_setup ?? {}) as Record<string, any>

    // Fall back to match_setup's team1/team2 names if the team ids
    // couldn't be resolved (e.g. an auction-less friendly match where
    // balls were written with null team ids).
    const fallbackOpponentName =
      normLoose(setup?.team1?.name) === normLoose(playerTeam?.name ?? setup?.team1?.name)
        ? setup?.team2?.name
        : setup?.team1?.name

    const playerTeamName = playerTeam?.name ?? setup?.team1?.name ?? "Unknown"
    const resultText = setup?.resultText ?? null

    summaries.push({
      matchId,
      date: setup?.date ?? null,
      venue: setup?.venue ?? null,
      format: setup?.officials?.format ?? null,
      playerTeamName,
      playerTeamColor: playerTeam?.color ?? null,
      opponentName: opponentTeam?.name ?? fallbackOpponentName ?? "Unknown",
      opponentLogo: opponentTeam?.logo ?? null,
      opponentColor: opponentTeam?.color ?? null,
      resultText,
      outcome: deriveOutcome(resultText, playerTeamName),
      batting,
      bowling,
    })
  }

  // Most recent first — falls back to string comparison if date is
  // missing on some rows, which still gives a stable (if imperfect)
  // order rather than throwing.
  summaries.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))

  return summaries
}

function normLoose(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase()
}

function formatMatchDate(date: string | null): string {
  if (!date) return "Date TBC"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
}

// ─────────────────────────────────────────────────────────────

function statusPillStyle(status: PlayerStatus) {
  if (status === "sold") {
    return { label: "Sold", badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40", dotClass: "bg-emerald-400" }
  }
  if (status === "available") {
    return { label: "Available", badgeClass: "bg-blue-500/10 text-blue-300 border-blue-400/40", dotClass: "bg-blue-400" }
  }
  if (status === "pool") {
    return { label: "In Pool", badgeClass: "bg-purple-500/10 text-purple-300 border-purple-400/40", dotClass: "bg-purple-400" }
  }
  return { label: "Unsold", badgeClass: "bg-white/5 text-gray-400 border-white/15", dotClass: "bg-gray-500" }
}

const ROLE_STYLES: Record<PlayerRole, string> = {
  Batter: "bg-sky-500/10 text-sky-300 border-sky-400/30",
  Batsman: "bg-cyan-500/10 text-cyan-300 border-cyan-400/30",
  Bowler: "bg-orange-500/10 text-orange-300 border-orange-400/30",
  "All-rounder": "bg-violet-500/10 text-violet-300 border-violet-400/30",
  "WK-Batter": "bg-teal-500/10 text-teal-300 border-teal-400/30",
  "Wicket Keeper": "bg-emerald-500/10 text-emerald-300 border-emerald-400/30",
}

const OUTCOME_STYLES: Record<NonNullable<MatchOutcome>, { label: string; className: string }> = {
  won: { label: "Won", className: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40" },
  lost: { label: "Lost", className: "bg-red-500/10 text-red-300 border-red-400/30" },
  tied: { label: "Tied", className: "bg-gray-500/15 text-gray-300 border-gray-400/30" },
}

const DEFAULT_ACCENT = "#D4AF37" // gold — used when a player has no team color yet (pool/unsold)

function fmt(n: number | null | undefined) {
  return n === null || n === undefined ? "—" : n.toLocaleString()
}

function fmtDecimal(n: number | null | undefined) {
  return n === null || n === undefined ? "—" : n.toFixed(2)
}

type ProfileTab = "overview" | "matches"

/** Tabs not wired up yet — shown same as CrickPro's real tab set
 *  (Stats · Matches · Awards · Teams · Badges) so the strip reads as
 *  complete, but disabled/locked until the underlying data exists. */
const LOCKED_TABS = ["Awards", "Teams", "Badges"] as const

export default function PlayerDetailClient({ id }: { id: string }) {
  useScrollTop()
  const router = useRouter()

  const [isNavOpen, setIsNavOpen] = useState(false)
  const [player, setPlayer] = useState<PlayerDetail | null | undefined>(undefined) // undefined = loading, null = not found
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview")

  const [matches, setMatches] = useState<PlayerMatchSummary[] | undefined>(undefined) // undefined = not yet loaded

  useEffect(() => {
    let cancelled = false
    setPlayer(undefined)
    setActiveTab("overview")
    setMatches(undefined)
    getPlayerDetailForPublic(id).then((data) => {
      if (cancelled) return
      setPlayer(data)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  // Match history is only fetched once the Matches tab is actually
  // opened — it's a heavier query (all balls for this player, plus
  // batch lookups) than the summary stats getPlayerDetailForPublic
  // already loads, and most visitors landing on a player page will
  // only ever look at Overview.
  useEffect(() => {
    if (activeTab !== "matches" || matches !== undefined || !player) return
    let cancelled = false
    getPlayerMatchHistory(id).then((data) => {
      if (cancelled) return
      setMatches(data)
    })
    return () => {
      cancelled = true
    }
  }, [activeTab, matches, player, id])

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }
  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  const matchesPlayed = useMemo(() => matches?.length ?? player?.matchesBatted ?? player?.matchesBowled ?? 0, [matches, player])
  const accent = (player?.source === "auction" ? player?.team?.color : null) || DEFAULT_ACCENT

  return (
    <main className="overflow-hidden min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      <SiteHeader
        activeSection="players"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      <section className="pt-24 pb-16 relative section-pattern min-h-screen">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 max-w-5xl">
          <Link
            href="/players"
            className="inline-flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-widest text-gray-400 hover:text-gold transition-colors mb-6 fade-in"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Players
          </Link>

          {player === undefined && <PlayerDetailSkeleton />}

          {player === null && (
            <div className="text-center py-24 fade-in">
              <p className="text-lg text-gray-300">This player couldn't be found.</p>
              <Link
                href="/players"
                className="inline-block mt-4 text-xs font-cinzel uppercase tracking-widest text-gold hover:underline"
              >
                Back to all players
              </Link>
            </div>
          )}

          {player && (
            <div className="space-y-6 fade-in-up">
              {/* ── Identity header — trading-card treatment ────────
                  A team-color foil wash behind the portrait (same
                  diagonal-split language as the match cards elsewhere
                  in the app), a price sticker for the auction value,
                  and a corner flourish for capped players. This is the
                  one deliberate flourish on the page; everything else
                  stays quiet. */}
              <div
                className="relative rounded-2xl border overflow-hidden"
                style={{ borderColor: `${accent}55` }}
              >
                {/* Foil wash */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(120deg, ${accent}33 0%, rgba(0,0,0,0.94) 55%, rgba(0,0,0,0.98) 100%)`,
                  }}
                />
                <div
                  className="absolute inset-x-0 top-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${accent}aa, transparent)` }}
                />

                <div className="relative flex flex-col sm:flex-row gap-6 p-5 sm:p-6">
                  <div className="relative shrink-0 mx-auto sm:mx-0">
                    <div
                      className="relative h-48 w-40 sm:h-56 sm:w-44 rounded-lg overflow-hidden border-2 bg-black/60"
                      style={{ borderColor: accent }}
                    >
                      <Image src={player.img || "/placeholder.svg"} alt={player.name} fill className="object-cover" />
                    </div>

                    {player.capped && (
                      <div
                        className="absolute -top-2 -right-2 flex items-center gap-1 text-[9px] font-cinzel uppercase tracking-widest px-2 py-1 rounded-full font-bold text-black shadow-lg"
                        style={{ backgroundColor: accent }}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        Capped
                      </div>
                    )}

                    {/* Price sticker — only meaningful once auctioned */}
                    {player.source === "auction" && (
                      <div
                        className="absolute -bottom-3 left-1/2 -translate-x-1/2 -rotate-2 flex items-center gap-1 bg-black border rounded-md px-2.5 py-1 shadow-lg"
                        style={{ borderColor: accent }}
                      >
                        <Coins className="h-3 w-3" style={{ color: accent }} />
                        <span className="text-xs font-mono font-bold text-white">
                          {player.status === "sold" ? fmt(player.soldPrice) : fmt(player.price)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-3 text-center sm:text-left pt-1 sm:pt-0">
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-white font-cinzel tracking-wide">
                        <TypeText text={player.name} speed={35} />
                      </h1>
                      {player.country && (
                        <p className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-gray-400 mt-1">
                          <Globe2 className="h-3.5 w-3.5" />
                          {player.country}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span
                        className={`text-[10px] font-cinzel uppercase tracking-widest px-2.5 py-1 rounded-full border ${ROLE_STYLES[player.role]}`}
                      >
                        {player.role}
                      </span>

                      {(() => {
                        const s = statusPillStyle(player.status)
                        return (
                          <span
                            className={`flex items-center gap-1 text-[10px] font-cinzel uppercase tracking-widest px-2.5 py-1 rounded-full border ${s.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dotClass}`} />
                            {s.label}
                          </span>
                        )
                      })()}
                    </div>

                    {player.source === "auction" && player.team ? (
                      <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                        {player.team.logo ? (
                          <div className="relative h-7 w-7 rounded-full overflow-hidden border border-gold/20 bg-black/60">
                            <Image src={player.team.logo} alt={player.team.name} fill className="object-cover" />
                          </div>
                        ) : (
                          <span className="h-7 w-7 rounded-full border border-gold/20" style={{ backgroundColor: accent }} />
                        )}
                        <span className="text-sm text-white font-cinzel">{player.team.name}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">Not yet entered into an auction.</p>
                    )}

                    {/* Quick stats — the "ledger" strip. Runs/Wickets get
                        the visual weight, since they're what a scout
                        actually scans for first. */}
                    <div className="flex items-center justify-center sm:justify-start gap-6 mt-3 pt-3 border-t border-white/10">
                      <QuickStat value={fmt(matchesPlayed)} label="Matches" muted />
                      <QuickStat value={fmt(player.runsScored)} label="Runs" accent={accent} />
                      <QuickStat value={fmt(player.wickets)} label="Wickets" accent={accent} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Tab strip ───────────────────────────────────── */}
              <div className="flex items-center gap-1 rounded-xl border border-gold/10 bg-black/50 p-1 w-fit mx-auto sm:mx-0">
                {(
                  [
                    { key: "overview", label: "Overview" },
                    { key: "matches", label: "Matches" },
                  ] as { key: ProfileTab; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-lg text-xs font-cinzel uppercase tracking-widest transition-colors ${
                      activeTab === tab.key ? "bg-gold text-black font-bold" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Overview tab ────────────────────────────────── */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <StatGroup
                      title="Batting"
                      headline={{ label: "Runs", value: fmt(player.runsScored) }}
                      stats={[
                        { label: "Matches", value: fmt(player.matchesBatted) },
                        { label: "Balls Faced", value: fmt(player.ballsFaced) },
                        { label: "Dismissals", value: fmt(player.dismissals) },
                        { label: "Average", value: fmtDecimal(player.battingAverage) },
                        { label: "Strike Rate", value: fmtDecimal(player.strikeRate) },
                      ]}
                    />
                    <StatGroup
                      title="Bowling"
                      headline={{ label: "Wickets", value: fmt(player.wickets) }}
                      stats={[
                        { label: "Matches", value: fmt(player.matchesBowled) },
                        { label: "Balls Bowled", value: fmt(player.ballsBowled) },
                        { label: "Runs Conceded", value: fmt(player.runsConceded) },
                        { label: "Average", value: fmtDecimal(player.bowlingAverage) },
                        { label: "Economy", value: fmtDecimal(player.economy) },
                      ]}
                    />
                  </div>

                  {player.matchesBatted === 0 && player.matchesBowled === 0 && (
                    <p className="text-center text-xs text-gray-500">No ball-by-ball data recorded for this player yet.</p>
                  )}
                </div>
              )}

              {/* ── Matches tab ─────────────────────────────────── */}
              {activeTab === "matches" && (
                <div className="space-y-3">
                  {matches === undefined && <MatchListSkeleton />}

                  {matches !== undefined && matches.length === 0 && (
                    <div className="text-center py-16 rounded-2xl border border-gold/10 bg-black/50">
                      <p className="text-sm text-gray-400">No matches found for this player yet.</p>
                    </div>
                  )}

                  {matches !== undefined && matches.length > 0 && (
                    <div className="space-y-3">
                      {matches.map((m, i) => (
                        <MatchHistoryRow key={m.matchId} match={m} index={i} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function QuickStat({ value, label, accent, muted }: { value: string; label: string; accent?: string; muted?: boolean }) {
  return (
    <div className="text-center sm:text-left">
      <div
        className="text-lg font-bold font-mono"
        style={{ color: muted ? "#e5e7eb" : accent ?? "#e5e7eb" }}
      >
        {value}
      </div>
      <div className="text-[9px] font-cinzel uppercase tracking-widest text-gray-500">{label}</div>
    </div>
  )
}

function MatchHistoryRow({ match, index }: { match: PlayerMatchSummary; index: number }) {
  const rail = match.playerTeamColor || DEFAULT_ACCENT
  const outcome = match.outcome ? OUTCOME_STYLES[match.outcome] : null

  return (
    <Link
      href={`/match/${match.matchId}`}
      className="group relative flex rounded-xl border border-gold/10 bg-black/60 hover:border-gold/30 hover:bg-black/70 transition-all overflow-hidden fade-in-up"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      {/* Team-color rail — a scorecard-ledger cue, not decoration: it's
          the same color as this player's side in the match. */}
      <span className="w-1 shrink-0" style={{ backgroundColor: rail }} />

      <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-cinzel text-white truncate">
              {match.playerTeamName} <span className="text-gray-500">vs</span> {match.opponentName}
            </span>
            {outcome && (
              <span className={`text-[9px] font-cinzel uppercase tracking-widest px-2 py-0.5 rounded-full border ${outcome.className}`}>
                {outcome.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatMatchDate(match.date)}
            </span>
            {match.venue && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {match.venue}
              </span>
            )}
            {match.format && <span className="text-gray-600">· {match.format}</span>}
          </div>
          {match.resultText && (
            <p className="flex items-center gap-1 text-xs text-gold/90 mt-1.5">
              <Trophy className="h-3 w-3" />
              {match.resultText}
            </p>
          )}
        </div>

        <div className="flex items-center gap-6 shrink-0 justify-center sm:justify-end">
          {match.batting && (
            <div className="text-center">
              <div className="text-base font-bold text-white font-mono">
                {match.batting.runs}
                {match.batting.dismissed ? "" : "*"}
                <span className="text-gray-500 text-xs font-normal"> ({match.batting.balls})</span>
              </div>
              <div className="text-[9px] font-cinzel uppercase tracking-widest text-gray-500">
                SR {strikeRate(match.batting.runs, match.batting.balls)}
              </div>
            </div>
          )}
          {match.bowling && (
            <div className="text-center">
              <div className="text-base font-bold text-white font-mono">
                {match.bowling.wickets}/{match.bowling.runsConceded}
                <span className="text-gray-500 text-xs font-normal"> ({oversFromLegalBalls(match.bowling.legalBalls)})</span>
              </div>
              <div className="text-[9px] font-cinzel uppercase tracking-widest text-gray-500">
                Econ {economy(match.bowling.runsConceded, match.bowling.legalBalls)}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function MatchListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl border border-gold/10 bg-black/50 animate-pulse" />
      ))}
    </div>
  )
}

function StatGroup({
  title,
  headline,
  stats,
}: {
  title: string
  headline: { label: string; value: string }
  stats: { label: string; value: string }[]
}) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-black/70 p-5">
      <h2 className="flex items-center gap-2 text-sm font-cinzel uppercase tracking-widest text-gold mb-4">
        <BarChart3 className="h-4 w-4" />
        {title}
      </h2>

      {/* Headline stat gets the visual weight — the number a scout
          actually looks for first, not buried in a uniform grid. */}
      <div className="flex items-baseline gap-2 mb-4 pb-4 border-b border-white/5">
        <span className="text-4xl font-bold text-white font-mono tabular-nums">{headline.value}</span>
        <span className="text-[10px] font-cinzel uppercase tracking-widest text-gray-500">{headline.label}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-base font-bold text-white font-mono">{s.value}</div>
            <div className="text-[9px] font-cinzel uppercase tracking-widest text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlayerDetailSkeleton() {
  return (
    <div className="space-y-8 fade-in">
      <div className="flex flex-col sm:flex-row gap-6 rounded-2xl border border-gold/10 bg-black/50 p-5 sm:p-6">
        <div className="h-48 w-40 sm:h-56 sm:w-44 mx-auto sm:mx-0 rounded-lg bg-black/60 animate-pulse" />
        <div className="flex-1 space-y-3">
          <div className="h-7 w-1/2 rounded bg-white/10 animate-pulse mx-auto sm:mx-0" />
          <div className="h-4 w-1/3 rounded bg-white/5 animate-pulse mx-auto sm:mx-0" />
          <div className="h-6 w-2/3 rounded-full bg-white/5 animate-pulse mx-auto sm:mx-0" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="h-48 rounded-2xl border border-gold/10 bg-black/50 animate-pulse" />
        <div className="h-48 rounded-2xl border border-gold/10 bg-black/50 animate-pulse" />
      </div>
    </div>
  )
}