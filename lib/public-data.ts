import { supabase } from "@/lib/supabase"

export type PublicMatchLiveScore = {
  runs: number
  wkts: number
  overs: string
  /** Name/short-code of the batting side, when the live_state carries one. */
  battingTeam: string | null
}

export type PublicMatchWeather = {
  tempC: number | null
  condition: string | null
}

export type PublicMatch = {
  id: string
  /**
   * The id of the row in `matches` (the overlay/live-scoring match),
   * i.e. what /match/[id] actually expects. This is DIFFERENT from
   * `id` above, which is the bracket_matches fixture id.
   * Null when this fixture has no linked live-scoring match yet
   * (not started / not configured) — treat as non-clickable in the UI.
   */
  matchId: string | null
  round: number
  /** 'winners' | 'losers' | 'grand_final' | 'round_robin' — from bracket_matches.bracket_type */
  bracketType: string | null
  teamA: string
  teamB: string
  teamACode: string | null
  teamBCode: string | null
  teamAColor: string | null
  teamBColor: string | null
  teamALogo: string | null
  teamBLogo: string | null
  scoreA: number | null
  scoreB: number | null
  status: string
  scheduledAt: string | null
  venue: string | null
  tournamentName: string | null
  tournamentLogo: string | null
  /** Names of channels/streams currently broadcasting this match, if any have been added. */
  channels: string[]
  /** Only populated for status === 'live', when weather has been recorded for the match. */
  weather: PublicMatchWeather | null
  /** Only populated for status === 'live', when the scoring engine has a live_state snapshot. */
  live: PublicMatchLiveScore | null
}

export type PublicTeam = { id: string; name: string; code: string; logo: string | null; color: string | null }
export type PublicPlayer = { id: string; name: string; role: string; team: string }
export type PublicStanding = { team: string; played: number; won: number; lost: number; points: number; nrr: string }

// ─────────────────────────────────────────────────────────────
// Defensive jsonb parsers — on_air_channels.channels and
// match_state.live_state are untyped jsonb columns, so their exact
// shape isn't guaranteed by the schema. These try the most likely
// field names; if your live-scoring code (useLiveMatch/engine_state)
// uses different keys, update the lookups below to match.
// ─────────────────────────────────────────────────────────────

function parseChannels(raw: unknown): string[] {
  if (!raw || !Array.isArray(raw)) return []
  return raw
    .map((c) => {
      if (typeof c === "string") return c
      if (c && typeof c === "object") return (c as any).name ?? (c as any).channel ?? (c as any).label ?? null
      return null
    })
    .filter((c): c is string => !!c)
}

function parseWeather(raw: any): PublicMatchWeather | null {
  if (!raw || typeof raw !== "object") return null
  const tempC = raw.temp_c ?? raw.tempC ?? raw.temperature ?? null
  const condition = raw.condition ?? raw.summary ?? raw.description ?? null
  if (tempC == null && !condition) return null
  return { tempC: tempC ?? null, condition: condition ?? null }
}

function parseLiveState(raw: any): PublicMatchLiveScore | null {
  if (!raw || typeof raw !== "object") return null
  const runs = raw.runs ?? raw.totalRuns ?? raw.score ?? null
  const wkts = raw.wkts ?? raw.wickets ?? null
  const overs = raw.overs ?? raw.oversLabel ?? raw.over ?? null
  const battingTeam = raw.battingTeam ?? raw.battingTeamCode ?? raw.currentInnings ?? null
  if (runs == null && wkts == null && overs == null) return null
  return {
    runs: Number(runs ?? 0),
    wkts: Number(wkts ?? 0),
    overs: String(overs ?? "0.0"),
    battingTeam: battingTeam ?? null,
  }
}

function formatBracketStage(bracketType: string | null, round: number): string {
  if (bracketType === "grand_final") return "Grand Final"
  if (bracketType === "losers") return `Losers · Round ${round}`
  return `Round ${round}`
}

export async function getPublicMatches(): Promise<PublicMatch[]> {
  const { data, error } = await supabase
    .from("bracket_matches")
    .select(`
      id, round, status, score_a, score_b, scheduled_at, venue, bracket_type,
      team_a:teams!bracket_matches_team_a_id_fkey ( name, code, color, logo ),
      team_b:teams!bracket_matches_team_b_id_fkey ( name, code, color, logo ),
      tournament:tournaments!bracket_matches_tournament_id_fkey ( name, logo_url ),
      overlay:matches!bracket_matches_overlay_match_id_fkey (
        id,
        on_air_channels ( channels ),
        weather_readings ( data ),
        match_state ( live_state )
      )
    `)
    .order("round")
    .order("position")

  if (error) {
    console.error("[public] matches:", error.message)
    return []
  }

  return (data ?? []).map((row: any) => {
    const overlay = row.overlay
    const status = row.status ?? "upcoming"

    return {
      id: row.id,
      // The playable match id — this is what /match/[id] expects, and
      // is NOT the same as `id` above (that's the bracket fixture id).
      matchId: overlay?.id ?? null,
      round: row.round,
      bracketType: row.bracket_type ?? null,
      teamA: row.team_a?.name ?? "TBD",
      teamB: row.team_b?.name ?? "TBD",
      teamACode: row.team_a?.code ?? null,
      teamBCode: row.team_b?.code ?? null,
      teamAColor: row.team_a?.color ?? null,
      teamBColor: row.team_b?.color ?? null,
      teamALogo: row.team_a?.logo || null,
      teamBLogo: row.team_b?.logo || null,
      scoreA: row.score_a,
      scoreB: row.score_b,
      status,
      scheduledAt: row.scheduled_at ?? null,
      venue: row.venue ?? null,
      tournamentName: row.tournament?.name ?? null,
      tournamentLogo: row.tournament?.logo_url ?? null,
      channels: parseChannels(overlay?.on_air_channels?.channels),
      // Weather/live snapshots only matter (and only get fetched cheaply)
      // for matches actually in progress.
      weather: status === "live" ? parseWeather(overlay?.weather_readings?.data) : null,
      live: status === "live" ? parseLiveState(overlay?.match_state?.live_state) : null,
    }
  })
}

export { formatBracketStage }

export async function getPublicTeams(): Promise<PublicTeam[]> {
  const { data, error } = await supabase.from("teams").select("id, name, code, logo, color").order("name")
  if (error) {
    console.error("[public] teams:", error.message)
    return []
  }
  return (data ?? []).map((row: any) => ({ id: row.id, name: row.name, code: row.code ?? "", logo: row.logo, color: row.color }))
}

export async function getPublicPlayers(): Promise<PublicPlayer[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, role, team:teams!players_sold_to_team_id_fkey ( name )")
    .order("name")
  if (error) {
    console.error("[public] players:", error.message)
    return []
  }
  return (data ?? []).map((row: any) => ({ id: row.id, name: row.name, role: row.role ?? "Player", team: row.team?.name ?? "Unassigned" }))
}

export async function getPublicStandings(): Promise<PublicStanding[]> {
  const { data, error } = await supabase
    .from("standings")
    .select("played, won, lost, points, nrr, teams(name)")
    .order("points", { ascending: false })
    .order("nrr", { ascending: false })
  if (error) {
    console.error("[public] standings:", error.message)
    return []
  }
  return (data ?? []).map((row: any) => ({
    team: row.teams?.name ?? "Unknown team",
    played: row.played ?? 0,
    won: row.won ?? 0,
    lost: row.lost ?? 0,
    points: row.points ?? 0,
    nrr: Number(row.nrr ?? 0).toFixed(2),
  }))
}