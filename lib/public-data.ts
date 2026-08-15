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
   * `id` above, which is the bracket_matches fixture id (for bracket
   * matches) — for friendly matches, `id` and `matchId` are the same
   * since the `matches` row IS the fixture.
   * Null when this fixture has no linked live-scoring match yet
   * (not started / not configured) — treat as non-clickable in the UI.
   */
  matchId: string | null
  round: number
  /** 'winners' | 'losers' | 'grand_final' | 'round_robin' — from bracket_matches.bracket_type. Null for friendlies. */
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
  /** bracket_matches.tournament_id (or matches.tournament_id for friendlies) — used for the tournament filter dropdown. */
  tournamentId: string | null
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

/**
 * Parses the `match_setup` jsonb column — shared shape for BOTH friendly
 * matches (their only source of truth) and bracket matches' overlay row
 * (used as a fallback when bracket_matches.venue/scheduled_at are null).
 * Confirmed real shape (sample row):
 * {
 *   date, time, toss, overs, round,
 *   team1: { logo, name, short, color }, team2: { logo, name, short, color },
 *   venue, squads: [...], target, officials: {...},
 *   resultText, rosterLocked, matchComplete, currentInnings, tournamentName
 * }
 * team1.color / team2.color ARE present when set — used directly for
 * friendly-match banner colors.
 * There's no explicit numeric score in here — resultText is a
 * human-readable sentence, not a number, and matchComplete is the only
 * lifecycle flag. Score is derived separately, from `balls` /
 * `match_team_stats`, in getPublicMatches below — see
 * resolveFriendlyScores / fetchBallsAggregatedScores.
 */
function parseMatchSetup(raw: any) {
  if (!raw || typeof raw !== "object") return null

  const scheduledAt =
    raw.date && raw.time ? new Date(`${raw.date}T${raw.time}:00`).toISOString() : raw.date ?? null

  return {
    teamAName: raw.team1?.name ?? "TBD",
    teamBName: raw.team2?.name ?? "TBD",
    teamACode: raw.team1?.short ?? null,
    teamBCode: raw.team2?.short ?? null,
    teamAColor: raw.team1?.color || null,
    teamBColor: raw.team2?.color || null,
    teamALogo: raw.team1?.logo ?? null,
    teamBLogo: raw.team2?.logo ?? null,
    venue: raw.venue ?? null,
    scheduledAt,
    matchComplete: !!raw.matchComplete,
  }
}

/**
 * Matches a `match_team_stats` row to a team by name, tolerant of
 * casing/whitespace differences between match_setup.team1/2.name and
 * the linked teams.name — those come from two different data-entry
 * paths and won't always line up exactly.
 */
function findTeamStat(statRows: any[], name: string) {
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase()
  const target = norm(name)
  if (!target) return undefined
  return statRows.find((s) => norm(s.teams?.name) === target)
}

/**
 * Resolves scoreA/scoreB for a friendly match from its match_team_stats
 * rows. Tries a name match first; if that fails for both teams but
 * there are exactly two stat rows, falls back to positional order
 * (first row = team A, second = team B) rather than showing no score
 * at all. Returns { scoreA: null, scoreB: null } when statRows is
 * empty — the caller (getPublicMatches) then falls back further, to
 * aggregating the `balls` table directly (see
 * fetchBallsAggregatedScores below), which is the real source of truth
 * the match detail page itself uses.
 */
function resolveFriendlyScores(
  statRows: any[],
  teamAName: string,
  teamBName: string,
): { scoreA: number | null; scoreB: number | null } {
  let scoreA = findTeamStat(statRows, teamAName)?.runs_scored ?? null
  let scoreB = findTeamStat(statRows, teamBName)?.runs_scored ?? null

  if (scoreA == null && scoreB == null && statRows.length === 2) {
    scoreA = statRows[0]?.runs_scored ?? null
    scoreB = statRows[1]?.runs_scored ?? null
  }

  return { scoreA, scoreB }
}

/**
 * Fallback score source for friendly matches whose match_team_stats is
 * empty (the common case — that table isn't reliably populated when a
 * match completes). This mirrors what the match detail page itself does
 * in data/match-data.ts's aggregateInnings(): sum `balls.runs` grouped
 * by innings_number. Per that file's own convention, team1/teamA is
 * ALWAYS shown against innings_number 1's total and team2/teamB against
 * innings_number 2's total — regardless of who actually won the toss —
 * so the same fixed mapping is used here for consistency with the
 * detail page.
 *
 * Only called for the specific match ids that need it (empty
 * match_team_stats), not for every friendly match, to avoid pulling
 * full ball-by-ball data on every /matches list load.
 */
async function fetchBallsAggregatedScores(
  matchIds: string[],
): Promise<Map<string, { scoreA: number | null; scoreB: number | null }>> {
  const result = new Map<string, { scoreA: number | null; scoreB: number | null }>()
  if (matchIds.length === 0) return result

  const { data, error } = await supabase
    .from("balls")
    .select("match_id, innings_number, runs")
    .in("match_id", matchIds)

  if (error) {
    console.error("[public] balls aggregation for friendly scores:", error.message)
    return result
  }

  const totals = new Map<string, { innings1: number; innings2: number; hasInnings1: boolean; hasInnings2: boolean }>()
  ;(data ?? []).forEach((row: any) => {
    const entry = totals.get(row.match_id) ?? { innings1: 0, innings2: 0, hasInnings1: false, hasInnings2: false }
    if (row.innings_number === 1) {
      entry.innings1 += row.runs ?? 0
      entry.hasInnings1 = true
    } else if (row.innings_number === 2) {
      entry.innings2 += row.runs ?? 0
      entry.hasInnings2 = true
    }
    totals.set(row.match_id, entry)
  })

  totals.forEach((entry, matchId) => {
    result.set(matchId, {
      // hasInnings1/2 distinguishes "0 runs actually recorded" from "no
      // rows at all for this innings" — genuinely no ball data yet
      // should stay null, not render as a 0.
      scoreA: entry.hasInnings1 ? entry.innings1 : null,
      scoreB: entry.hasInnings2 ? entry.innings2 : null,
    })
  })

  return result
}

function formatBracketStage(bracketType: string | null, round: number | null): string {
  if (!bracketType) return "Friendly"
  if (bracketType === "grand_final") return "Grand Final"
  if (bracketType === "losers") return `Losers · Round ${round}`
  return `Round ${round}`
}

export async function getPublicMatches(): Promise<PublicMatch[]> {
  const [bracketRes, friendlyRes] = await Promise.all([
    supabase
      .from("bracket_matches")
      .select(`
        id, round, status, score_a, score_b, scheduled_at, venue, bracket_type, tournament_id,
        team_a:teams!bracket_matches_team_a_id_fkey ( name, code, color, logo ),
        team_b:teams!bracket_matches_team_b_id_fkey ( name, code, color, logo ),
        tournament:tournaments!bracket_matches_tournament_id_fkey ( name, logo_url ),
        overlay:matches!bracket_matches_overlay_match_id_fkey (
          id,
          match_setup,
          on_air_channels ( channels ),
          weather_readings ( data ),
          match_state ( live_state )
        )
      `)
      .order("round")
      .order("position"),
    // Standalone / friendly matches: rows in `matches` with no bracket link at all.
    supabase
      .from("matches")
      .select(`
        id, match_setup, created_at, tournament_id,
        on_air_channels ( channels ),
        weather_readings ( data ),
        match_state ( live_state ),
        match_sim_control ( status ),
        match_team_stats ( team_id, runs_scored, is_winner, teams ( name ) )
      `)
      .is("bracket_match_id", null)
      .order("created_at", { ascending: false }),
  ])

  if (bracketRes.error) console.error("[public] bracket matches:", bracketRes.error.message)
  if (friendlyRes.error) console.error("[public] friendly matches:", friendlyRes.error.message)

  const bracketMatches: PublicMatch[] = (bracketRes.data ?? []).map((row: any) => {
    const overlay = row.overlay
    const status = row.status ?? "upcoming"

    // Fallback source: bracket_matches.venue/scheduled_at are frequently
    // left null even for completed matches, because venue/date/time often
    // only ever get entered through the match's own setup/edit flow —
    // which writes to the overlay `matches` row's match_setup, not back
    // to this bracket fixture row. Parse that JSON the same way friendly
    // matches do, and fall back to it whenever the bracket columns
    // themselves are empty.
    const overlaySetup = parseMatchSetup(overlay?.match_setup)

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
      // bracket_matches column first, overlay match_setup as fallback.
      scheduledAt: row.scheduled_at ?? overlaySetup?.scheduledAt ?? null,
      venue: row.venue ?? overlaySetup?.venue ?? null,
      tournamentId: row.tournament_id ?? null,
      tournamentName: row.tournament?.name ?? null,
      tournamentLogo: row.tournament?.logo_url ?? null,
      channels: parseChannels(overlay?.on_air_channels?.channels),
      // Weather/live snapshots only matter (and only get fetched cheaply)
      // for matches actually in progress.
      weather: status === "live" ? parseWeather(overlay?.weather_readings?.data) : null,
      live: status === "live" ? parseLiveState(overlay?.match_state?.live_state) : null,
    }
  })

  // ── Friendly matches: two-pass so we know, before building the final
  // objects, which matches need the `balls`-aggregation fallback (empty
  // match_team_stats) — avoids querying `balls` for every friendly match
  // on every /matches load, only for the ones that actually need it. ──
  const friendlyRows = friendlyRes.data ?? []

  const parsedFriendlies = friendlyRows.map((row: any) => {
    const setup = parseMatchSetup(row.match_setup)
    const statRows: any[] = row.match_team_stats ?? []
    const { scoreA, scoreB } = resolveFriendlyScores(statRows, setup?.teamAName ?? "", setup?.teamBName ?? "")
    return { row, setup, statRows, scoreA, scoreB }
  })

  const idsNeedingBallsFallback = parsedFriendlies
    .filter((m) => m.scoreA == null && m.scoreB == null)
    .map((m) => m.row.id as string)

  const ballsScoreByMatch = await fetchBallsAggregatedScores(idsNeedingBallsFallback)

  const friendlyMatches: PublicMatch[] = parsedFriendlies.map(({ row, setup, scoreA, scoreB }) => {
    const ballsFallback = ballsScoreByMatch.get(row.id)
    const finalScoreA = scoreA ?? ballsFallback?.scoreA ?? null
    const finalScoreB = scoreB ?? ballsFallback?.scoreB ?? null

    // Derive status: matchComplete flag wins; otherwise fall back to the
    // sim-engine control row (running/paused = live), else upcoming.
    const simStatus = row.match_sim_control?.status
    const status = setup?.matchComplete
      ? "completed"
      : simStatus === "running" || simStatus === "paused"
        ? "live"
        : "upcoming"

    return {
      id: row.id,
      matchId: row.id, // friendlies ARE their own overlay/live-scoring match
      round: 0,
      bracketType: null, // -> formatBracketStage renders "Friendly"
      teamA: setup?.teamAName ?? "TBD",
      teamB: setup?.teamBName ?? "TBD",
      teamACode: setup?.teamACode ?? null,
      teamBCode: setup?.teamBCode ?? null,
      teamAColor: setup?.teamAColor ?? null,
      teamBColor: setup?.teamBColor ?? null,
      teamALogo: setup?.teamALogo ?? null,
      teamBLogo: setup?.teamBLogo ?? null,
      scoreA: finalScoreA,
      scoreB: finalScoreB,
      status,
      scheduledAt: setup?.scheduledAt ?? null,
      venue: setup?.venue ?? null,
      tournamentId: row.tournament_id ?? null,
      tournamentName: null,
      tournamentLogo: null,
      channels: parseChannels(row.on_air_channels?.channels),
      weather: status === "live" ? parseWeather(row.weather_readings?.data) : null,
      live: status === "live" ? parseLiveState(row.match_state?.live_state) : null,
    }
  })

  return [...bracketMatches, ...friendlyMatches]
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