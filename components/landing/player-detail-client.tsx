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

import { derivePlayerBadges, type PlayerBadge } from "@/lib/players/player-badges"

// ─────────────────────────────────────────────────────────────
// IDENTITY RESOLUTION
//
// Every match a player appears in spins up its own synthetic auction
// (auctions.is_synthetic = true), which in turn creates a brand-new
// `players` row for that player (see is_synthetic on auctions and the
// match simulator). So a single real player can have many distinct
// ids — one per match they've ever played, plus one more from any
// genuine (non-synthetic) auction/pool entry.
//
// We treat "same name + same role" as one real player's identity —
// the same rule public_players_list_view / public_player_detail_view
// use — and resolve every sibling id up front so Matches/Badges/Teams
// can look across all of them instead of just the single id a card
// happened to link to.
// ─────────────────────────────────────────────────────────────

/**
 * Given one player row id, returns every id that represents the same
 * real player — grouped by name + role. Falls back to just [playerId]
 * if resolution fails or returns nothing, so callers never end up
 * querying with zero ids.
 */
async function resolveSiblingPlayerIds(playerId: string): Promise<string[]> {
  const { data: self, error: selfErr } = await supabase
    .from("public_players_view")
    .select("id, name, role")
    .eq("id", playerId)
    .maybeSingle()

  if (selfErr || !self) {
    console.error("[resolveSiblingPlayerIds] failed resolving self:", selfErr?.message)
    return [playerId]
  }

  const { data: siblings, error: sibErr } = await supabase
    .from("public_players_view")
    .select("id")
    .eq("name", self.name)
    .eq("role", self.role)

  if (sibErr || !siblings || siblings.length === 0) {
    console.error("[resolveSiblingPlayerIds] failed resolving siblings:", sibErr?.message)
    return [playerId]
  }

  return siblings.map((s) => s.id)
}

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
// Queries across every sibling id from resolveSiblingPlayerIds above,
// since each match this player has ever played was recorded under a
// different synthetic-auction id.
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

export interface PlayerMatchSummary {
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
  hatTrick: boolean
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
  if (t.includes("tied") || t.includes("draw") || t.includes("no result") || t.includes("abandoned")) return "tied"
  if (!t.includes("won") && !t.includes("win")) return null
  return t.includes(playerTeamName.toLowerCase()) ? "won" : "lost"
}

async function getPlayerMatchHistory(playerId: string): Promise<PlayerMatchSummary[]> {
  const ids = await resolveSiblingPlayerIds(playerId)
  const idList = ids.join(",")

  const { data: ballRows, error: ballsErr } = await supabase
    .from("balls")
    .select(
      "match_id, sequence, runs, extra_type, is_wicket, dismissal_type, striker_player_id, bowler_player_id, batting_team_id, bowling_team_id"
    )
    .or(`striker_player_id.in.(${idList}),bowler_player_id.in.(${idList})`)
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
    // Membership check is against every sibling id, not just the one
    // id passed into this function — a match recorded under a
    // different synthetic-auction id for this same player still
    // counts as "theirs".
    const battingRows = rows.filter((r) => !!r.striker_player_id && ids.includes(r.striker_player_id))
    const bowlingRows = rows.filter((r) => !!r.bowler_player_id && ids.includes(r.bowler_player_id))

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
    let hatTrick = false
    if (bowlingRows.length > 0) {
      let legalBalls = 0
      let runsConceded = 0
      let wickets = 0
      let consecutiveWicketBalls = 0

      for (const r of bowlingRows) {
        const isLegal = r.extra_type !== "wide" && r.extra_type !== "no_ball"
        if (isLegal) legalBalls += 1
        if (r.extra_type !== "bye" && r.extra_type !== "leg_bye") runsConceded += r.runs
        if (r.is_wicket && r.dismissal_type !== "run_out") wickets += 1

        // Hat-trick: 3 wickets on 3 consecutive LEGAL deliveries by this
        // bowler. Wides/no-balls don't count as a "ball" for this and
        // don't break the streak; a non-wicket legal ball does.
        if (isLegal) {
          const takesWicket = r.is_wicket && r.dismissal_type !== "run_out"
          consecutiveWicketBalls = takesWicket ? consecutiveWicketBalls + 1 : 0
          if (consecutiveWicketBalls >= 3) hatTrick = true
        }
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

    // Fall back to match_setup's team1/team2 objects (name, logo, color
    // if the simulator wrote them) if the team ids on this match's
    // balls couldn't be resolved against the `teams` table — e.g. an
    // auction-less friendly match, a stale/deleted team id, or an
    // RLS-filtered row. Matching player-vs-opponent within match_setup
    // is done by name, same rule the old fallback used.
    const setupPlayerTeam =
      normLoose(setup?.team1?.name) === normLoose(playerTeam?.name ?? setup?.team1?.name)
        ? setup?.team1
        : setup?.team2
    const setupOpponentTeam = setupPlayerTeam === setup?.team1 ? setup?.team2 : setup?.team1

    const playerTeamName = playerTeam?.name ?? setupPlayerTeam?.name ?? "Unknown"
    const resultText = setup?.resultText ?? null

    summaries.push({
      matchId,
      date: setup?.date ?? null,
      venue: setup?.venue ?? null,
      format: setup?.officials?.format ?? null,
      playerTeamName,
      playerTeamColor: playerTeam?.color ?? setupPlayerTeam?.color ?? null,
      opponentName: opponentTeam?.name ?? setupOpponentTeam?.name ?? "Unknown",
      opponentLogo: opponentTeam?.logo ?? setupOpponentTeam?.logo ?? null,
      opponentColor: opponentTeam?.color ?? setupOpponentTeam?.color ?? null,
      resultText,
      outcome: deriveOutcome(resultText, playerTeamName),
      batting,
      bowling,
      hatTrick,
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

type ProfileTab = "stats" | "matches" | "awards" | "teams" | "badges"

const TAB_CONFIG: { key: ProfileTab; label: string }[] = [
  { key: "stats", label: "Stats" },
  { key: "matches", label: "Matches" },
  { key: "awards", label: "Awards" },
  { key: "teams", label: "Teams" },
  { key: "badges", label: "Badges" },
]

// ─────────────────────────────────────────────────────────────
// AWARDS — real data, matched against tournament_awards via the
// player_awards_view (see player-detail-views.sql). player_name on
// that table is free text with no FK, so matching is by normalized
// name rather than id — this already merges across every duplicate-id
// row for a given player automatically, so no sibling-id resolution
// is needed here.
// ─────────────────────────────────────────────────────────────

interface PlayerAward {
  id: string
  title: string
  context: string
  date: string | null
  icon: "trophy" | "medal" | "star"
}

function guessAwardIcon(label: string): PlayerAward["icon"] {
  const l = label.toLowerCase()
  if (l.includes("match")) return "star"
  if (l.includes("cap") || l.includes("wicket") || l.includes("bowling") || l.includes("economy")) return "medal"
  return "trophy"
}

async function getPlayerAwards(playerName: string): Promise<PlayerAward[]> {
  const normalized = playerName.trim().toLowerCase()
  if (!normalized) return []

  const { data, error } = await supabase
    .from("player_awards_view")
    .select("id, label, note, awarded_at, tournament_name")
    .eq("player_name_normalized", normalized)
    .order("awarded_at", { ascending: false })

  if (error) {
    console.error("[getPlayerAwards] failed:", error.message)
    return []
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.label,
    context: [row.tournament_name, row.note].filter(Boolean).join(" · "),
    date: row.awarded_at,
    icon: guessAwardIcon(row.label),
  }))
}

// ─────────────────────────────────────────────────────────────
// TEAMS — real data, via player_team_history (see
// player-detail-views.sql). That view only has rows for players whose
// auction was genuine (auctions.is_synthetic = false) — most of a
// player's sibling ids come from per-match synthetic auctions and
// have no row there at all, since is_synthetic auctions are excluded
// on purpose (they're simulator scaffolding, not real roster
// membership). So instead of looking up identity_key by the single
// playerId passed in, we resolve every sibling id for this player and
// find whichever one (if any) actually has a genuine-auction row.
// ─────────────────────────────────────────────────────────────

interface PlayerTeamStint {
  id: string
  teamName: string
  teamLogo: string | null
  teamColor: string | null
  season: string
  role: string
  price: number | null
}

async function getPlayerTeamHistory(playerId: string): Promise<PlayerTeamStint[]> {
  const ids = await resolveSiblingPlayerIds(playerId)

  const { data: selfRows, error: selfErr } = await supabase
    .from("player_team_history")
    .select("identity_key")
    .in("player_row_id", ids)
    .limit(1)

  if (selfErr) {
    console.error("[getPlayerTeamHistory] failed resolving identity:", selfErr.message)
    return []
  }
  // None of this player's sibling ids ever went through a genuine
  // (non-synthetic) auction — nothing genuine to show, not an error.
  if (!selfRows || selfRows.length === 0) return []

  const identityKey = selfRows[0].identity_key

  const { data, error } = await supabase
    .from("player_team_history")
    .select("player_row_id, season_name, season_started_at, team_id, team_name, team_logo, team_color, player_status, sold_price, base_price")
    .eq("identity_key", identityKey)
    .order("season_started_at", { ascending: false })

  if (error) {
    console.error("[getPlayerTeamHistory] failed loading stints:", error.message)
    return []
  }

  return (data ?? []).map((row: any) => ({
    id: row.player_row_id,
    teamName: row.team_name ?? "Unassigned",
    teamLogo: row.team_logo ?? null,
    teamColor: row.team_color ?? null,
    season: row.season_name,
    role: row.player_status === "sold" ? "Sold" : row.player_status === "available" ? "Available" : "Unsold",
    price: row.sold_price ?? row.base_price ?? null,
  }))
}

export default function PlayerDetailClient({ id }: { id: string }) {
  useScrollTop()
  const router = useRouter()

  const [isNavOpen, setIsNavOpen] = useState(false)
  const [player, setPlayer] = useState<PlayerDetail | null | undefined>(undefined) // undefined = loading, null = not found
  const [activeTab, setActiveTab] = useState<ProfileTab>("stats")

  const [matches, setMatches] = useState<PlayerMatchSummary[] | undefined>(undefined) // undefined = not yet loaded
  const [awards, setAwards] = useState<PlayerAward[] | undefined>(undefined)
  const [teamHistory, setTeamHistory] = useState<PlayerTeamStint[] | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setPlayer(undefined)
    setActiveTab("stats")
    setMatches(undefined)
    setAwards(undefined)
    setTeamHistory(undefined)
    getPlayerDetailForPublic(id).then((data) => {
      if (cancelled) return
      setPlayer(data)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  // Match history is fetched once the Matches OR Badges tab is opened
  // — Badges derives from the same data (hat-tricks, centuries, wins)
  // so it reuses this fetch rather than pulling balls twice. It's a
  // heavier query (all balls for this player, plus batch lookups) than
  // the summary stats getPlayerDetailForPublic already loads, and most
  // visitors landing on a player page will only ever look at Stats.
  useEffect(() => {
    if ((activeTab !== "matches" && activeTab !== "badges") || matches !== undefined || !player) return
    let cancelled = false
    getPlayerMatchHistory(id).then((data) => {
      if (cancelled) return
      setMatches(data)
    })
    return () => {
      cancelled = true
    }
  }, [activeTab, matches, player, id])

  useEffect(() => {
    if (activeTab !== "awards" || awards !== undefined || !player) return
    let cancelled = false
    getPlayerAwards(player.name).then((data) => {
      if (cancelled) return
      setAwards(data)
    })
    return () => {
      cancelled = true
    }
  }, [activeTab, awards, player])

  useEffect(() => {
    if (activeTab !== "teams" || teamHistory !== undefined || !player) return
    let cancelled = false
    getPlayerTeamHistory(id).then((data) => {
      if (cancelled) return
      setTeamHistory(data)
    })
    return () => {
      cancelled = true
    }
  }, [activeTab, teamHistory, player, id])

  const badges = useMemo(() => (matches ? derivePlayerBadges(player!, matches) : undefined), [matches, player])

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
            href="/all-players"
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
              <div
                className="relative rounded-2xl border overflow-hidden"
                style={{ borderColor: `${accent}55` }}
              >
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

                    <div className="flex items-center justify-center sm:justify-start gap-6 mt-3 pt-3 border-t border-white/10">
                      <QuickStat value={fmt(matchesPlayed)} label="Matches" muted />
                      <QuickStat value={fmt(player.runsScored)} label="Runs" accent={accent} />
                      <QuickStat value={fmt(player.wickets)} label="Wickets" accent={accent} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-gold/10 bg-black/50 p-1 w-fit mx-auto sm:mx-0 overflow-x-auto max-w-full">
                {TAB_CONFIG.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-lg text-xs font-cinzel uppercase tracking-widest transition-colors shrink-0 ${
                      activeTab === tab.key ? "bg-gold text-black font-bold" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "stats" && (
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

              {activeTab === "awards" && (
                <div className="space-y-3">
                  {awards === undefined && <MatchListSkeleton />}

                  {awards !== undefined && awards.length === 0 && (
                    <div className="text-center py-16 rounded-2xl border border-gold/10 bg-black/50">
                      <p className="text-sm text-gray-400">No awards recorded for this player yet.</p>
                    </div>
                  )}

                  {awards !== undefined &&
                    awards.length > 0 &&
                    awards.map((award, i) => <AwardRow key={award.id} award={award} index={i} />)}
                </div>
              )}

              {activeTab === "teams" && (
                <div className="space-y-3">
                  {teamHistory === undefined && <MatchListSkeleton />}

                  {teamHistory !== undefined && teamHistory.length === 0 && (
                    <div className="text-center py-16 rounded-2xl border border-gold/10 bg-black/50">
                      <p className="text-sm text-gray-400">No team history recorded for this player yet.</p>
                    </div>
                  )}

                  {teamHistory !== undefined &&
                    teamHistory.length > 0 &&
                    teamHistory.map((stint, i) => <TeamStintRow key={stint.id} stint={stint} index={i} />)}
                </div>
              )}

              {activeTab === "badges" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {badges === undefined
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-28 rounded-xl border border-gold/10 bg-black/50 animate-pulse" />
                      ))
                    : badges.map((badge, i) => <BadgeTile key={badge.id} badge={badge} index={i} />)}
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

const AWARD_ICONS: Record<PlayerAward["icon"], React.ComponentType<{ className?: string }>> = {
  trophy: Trophy,
  medal: ShieldCheck,
  star: BarChart3,
}

function AwardRow({ award, index }: { award: PlayerAward; index: number }) {
  const Icon = AWARD_ICONS[award.icon]
  return (
    <div
      className="flex items-center gap-4 rounded-xl border border-gold/10 bg-black/60 p-4 sm:p-5 fade-in-up"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="h-11 w-11 shrink-0 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
        <Icon className="h-5 w-5 text-gold" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-cinzel text-white truncate">{award.title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {award.context}
          {award.date && ` · ${formatMatchDate(award.date)}`}
        </p>
      </div>
    </div>
  )
}

function TeamStintRow({ stint, index }: { stint: PlayerTeamStint; index: number }) {
  const accent = stint.teamColor || DEFAULT_ACCENT
  return (
    <div
      className="flex items-center gap-4 rounded-xl border border-gold/10 bg-black/60 p-4 sm:p-5 fade-in-up overflow-hidden relative"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: accent }} />
      {stint.teamLogo ? (
        <div className="relative h-11 w-11 shrink-0 rounded-full overflow-hidden border" style={{ borderColor: accent }}>
          <Image src={stint.teamLogo} alt={stint.teamName} fill className="object-cover" />
        </div>
      ) : (
        <div
          className="h-11 w-11 shrink-0 rounded-full border flex items-center justify-center font-cinzel text-xs font-bold text-white"
          style={{ borderColor: accent, backgroundColor: `${accent}22` }}
        >
          {stint.teamName.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-cinzel text-white truncate">{stint.teamName}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">Season {stint.season}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xs font-cinzel uppercase tracking-widest ${stint.role === "Sold" ? "text-emerald-300" : "text-gray-500"}`}>
          {stint.role}
        </p>
        {stint.price != null && <p className="text-xs font-mono text-gold mt-0.5">{stint.price.toLocaleString()}</p>}
      </div>
    </div>
  )
}

function BadgeTile({ badge, index }: { badge: PlayerBadge; index: number }) {
  return (
    <div
      className={`flex flex-col items-center text-center gap-2 rounded-xl border p-4 fade-in-up ${
        badge.earned ? "border-gold/30 bg-gold/[0.04]" : "border-white/5 bg-black/40 opacity-50"
      }`}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      title={badge.description}
    >
      <div
        className={`h-12 w-12 rounded-full flex items-center justify-center border-2 ${
          badge.earned ? "border-gold" : "border-gray-700"
        }`}
      >
        <ShieldCheck className={`h-5 w-5 ${badge.earned ? "text-gold" : "text-gray-600"}`} />
      </div>
      <p className={`text-[11px] font-cinzel uppercase tracking-wide leading-tight ${badge.earned ? "text-white" : "text-gray-500"}`}>
        {badge.label}
      </p>
    </div>
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