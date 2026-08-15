import { supabase } from "@/lib/supabase"

export type PublicMatchLiveScore = {
  runs: number
  wkts: number
  overs: string
  battingTeam: string | null
}

export type PublicMatchWeather = {
  tempC: number | null
  condition: string | null
}

export type PublicMatch = {
  id: string
  matchId: string | null
  round: number
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
  createdAt: string | null
  venue: string | null
  tournamentId: string | null
  tournamentName: string | null
  tournamentLogo: string | null
  channels: string[]
  weather: PublicMatchWeather | null
  live: PublicMatchLiveScore | null
}

export type PublicTeam = { id: string; name: string; code: string; logo: string | null; color: string | null }
export type PublicPlayer = { id: string; name: string; role: string; team: string }
export type PublicStanding = { team: string; played: number; won: number; lost: number; points: number; nrr: string }

export type MatchStatusFilter = "upcoming" | "live" | "completed"
/**
 * "friendly" = standalone matches with NO tournament_id at all.
 * "all" = no type restriction (a specific tournamentId, when given,
 * already scopes both bracket and friendly matches tagged to it).
 */
export type MatchTypeFilter = "all" | "friendly"

const DEFAULT_PAGE_SIZE = 12

// ─────────────────────────────────────────────────────────────
// jsonb parsers
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

/** Pulls the fields the match simulator (the /match/[matchId]/simulate
 *  page) writes directly into match_setup: `status` ("live" |
 *  "completed" | "error"), `currentInnings`, and each side's running
 *  score (scoreA/wktsA/oversA, scoreB/wktsB/oversB).
 *
 *  These fields are the ONLY place a standalone/friendly match's score
 *  and in-progress state live — a friendly match has no bracket_matches
 *  row, and match_team_stats is only ever written for matches linked to
 *  a bracket slot (see the simulator's handleStart — the stats upsert
 *  is inside `if (bracketRow) { ... }`). Overall status classification
 *  itself now comes from matches.derived_status (a Postgres generated
 *  column, see migration 001) rather than being re-derived here — see
 *  mapFriendlyRow — but scores/live-state still only exist in this
 *  jsonb blob.
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
    teamALogo: raw.team1?.logo ?? null,
    teamBLogo: raw.team2?.logo ?? null,
    venue: raw.venue ?? null,
    scheduledAt,
    matchComplete: !!raw.matchComplete,
    status: typeof raw.status === "string" ? raw.status : null,
    currentInnings: raw.currentInnings === 1 || raw.currentInnings === 2 ? raw.currentInnings : null,
    scoreA: typeof raw.scoreA === "number" ? raw.scoreA : null,
    wktsA: typeof raw.wktsA === "number" ? raw.wktsA : null,
    oversA: typeof raw.oversA === "string" ? raw.oversA : null,
    scoreB: typeof raw.scoreB === "number" ? raw.scoreB : null,
    wktsB: typeof raw.wktsB === "number" ? raw.wktsB : null,
    oversB: typeof raw.oversB === "string" ? raw.oversB : null,
  }
}

/** Case/whitespace-tolerant team-stat lookup — match_setup team names and
 *  the linked teams.name row come from two different entry paths. */
function findTeamStat(statRows: any[], name: string) {
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase()
  const target = norm(name)
  if (!target) return undefined
  return statRows.find((s) => norm(s.teams?.name) === target)
}

function resolveFriendlyScores(statRows: any[], teamAName: string, teamBName: string) {
  let scoreA = findTeamStat(statRows, teamAName)?.runs_scored ?? null
  let scoreB = findTeamStat(statRows, teamBName)?.runs_scored ?? null
  if (scoreA == null && scoreB == null && statRows.length === 2) {
    scoreA = statRows[0]?.runs_scored ?? null
    scoreB = statRows[1]?.runs_scored ?? null
  }
  return { scoreA, scoreB }
}

export function formatBracketStage(bracketType: string | null, round: number | null): string {
  if (!bracketType) return "Friendly"
  if (bracketType === "grand_final") return "Grand Final"
  if (bracketType === "losers") return `Losers · Round ${round}`
  return `Round ${round}`
}

function mapBracketRow(row: any): PublicMatch {
  const overlay = row.overlay
  const status = row.status ?? "upcoming"
  // The real venue/date-time is usually entered when a match gets
  // configured for live scoring (stored on the overlay match's
  // match_setup), not on bracket_matches.venue/scheduled_at directly —
  // those columns are often left unset. Fall back to match_setup so the
  // card matches what FixtureCard shows elsewhere in the app.
  const overlaySetup = parseMatchSetup(overlay?.match_setup)
  return {
    id: row.id,
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
    scheduledAt: row.scheduled_at ?? overlaySetup?.scheduledAt ?? null,
    createdAt: row.created_at ?? null,
    venue: row.venue ?? overlaySetup?.venue ?? null,
    tournamentId: row.tournament_id ?? null,
    tournamentName: row.tournament?.name ?? null,
    tournamentLogo: row.tournament?.logo_url ?? null,
    channels: parseChannels(overlay?.on_air_channels?.channels),
    weather: status === "live" ? parseWeather(overlay?.weather_readings?.data) : null,
    live: status === "live" ? parseLiveState(overlay?.match_state?.live_state) : null,
  }
}

function mapFriendlyRow(row: any): PublicMatch {
  const setup = parseMatchSetup(row.match_setup)

  // Status now comes straight from matches.derived_status — a
  // Postgres generated column (see migration 001) that recomputes on
  // every write from match_setup->>'status' / matchComplete, including
  // the 'live' case. No JS-side derivation or fallback needed anymore.
  const status: MatchStatusFilter = (row.derived_status as MatchStatusFilter) ?? "upcoming"

  const statRows: any[] = row.match_team_stats ?? []
  const { scoreA: statsScoreA, scoreB: statsScoreB } = resolveFriendlyScores(
    statRows,
    setup?.teamAName ?? "",
    setup?.teamBName ?? "",
  )
  // match_setup's own scoreA/scoreB (written directly by the simulator,
  // live and at completion) take priority over match_team_stats.
  // match_team_stats is only ever populated for matches linked to a
  // bracket slot, so a standalone friendly match has no rows there at
  // all — this fallback only matters for older rows or edge cases.
  const scoreA = setup?.scoreA ?? statsScoreA
  const scoreB = setup?.scoreB ?? statsScoreB

  // Live score object built straight from match_setup, so a friendly
  // match shows a running score card while live. There's no match_state
  // row for these matches (nothing in the simulator writes to that
  // table), so this is the only source available.
  const live: PublicMatchLiveScore | null =
    status === "live" && setup
      ? setup.currentInnings === 2
        ? { runs: setup.scoreB ?? 0, wkts: setup.wktsB ?? 0, overs: setup.oversB ?? "0.0", battingTeam: setup.teamBName }
        : { runs: setup.scoreA ?? 0, wkts: setup.wktsA ?? 0, overs: setup.oversA ?? "0.0", battingTeam: setup.teamAName }
      : null

  return {
    id: row.id,
    matchId: row.id,
    round: 0,
    bracketType: null,
    teamA: setup?.teamAName ?? "TBD",
    teamB: setup?.teamBName ?? "TBD",
    teamACode: setup?.teamACode ?? null,
    teamBCode: setup?.teamBCode ?? null,
    teamAColor: null,
    teamBColor: null,
    teamALogo: setup?.teamALogo ?? null,
    teamBLogo: setup?.teamBLogo ?? null,
    scoreA,
    scoreB,
    status,
    scheduledAt: setup?.scheduledAt ?? null,
    createdAt: row.created_at ?? null,
    venue: setup?.venue ?? null,
    tournamentId: row.tournament_id ?? null,
    tournamentName: null,
    tournamentLogo: null,
    channels: parseChannels(row.on_air_channels?.channels),
    weather: status === "live" ? parseWeather(row.weather_readings?.data) : null,
    live,
  }
}

// created_at included so bracket rows can be ordered/merged with
// friendly rows by creation time (see getPublicMatchesPriorityFill).
const BRACKET_SELECT = `
  id, round, status, score_a, score_b, scheduled_at, venue, bracket_type, tournament_id, created_at,
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
`

// derived_status included so friendly-match status can be filtered and
// counted directly in Postgres (see migration 001) instead of being
// derived and filtered in JS. match_sim_control is still not joined —
// nothing in the simulator writes to that table.
const FRIENDLY_SELECT = `
  id, match_setup, created_at, tournament_id, derived_status,
  on_air_channels ( channels ),
  weather_readings ( data ),
  match_state ( live_state ),
  match_team_stats ( team_id, runs_scored, is_winner, teams ( name ) )
`

/** Resolves team ids whose name matches the search text, so bracket
 *  matches can be filtered by team name via a single .or() — postgrest
 *  can't OR-filter across an embedded relation directly. */
async function resolveMatchingTeamIds(search: string): Promise<string[]> {
  if (!search) return []
  const { data, error } = await supabase.from("teams").select("id").ilike("name", `%${search}%`).limit(100)
  if (error) console.error("[public] team search:", error.message)
  return (data ?? []).map((t: any) => t.id)
}

function applyBracketSearch(query: any, search: string, matchingTeamIds: string[]) {
  if (!search) return query
  const orParts = [`venue.ilike.%${search}%`]
  if (matchingTeamIds.length > 0) {
    orParts.push(`team_a_id.in.(${matchingTeamIds.join(",")})`)
    orParts.push(`team_b_id.in.(${matchingTeamIds.join(",")})`)
  }
  return query.or(orParts.join(","))
}

function applyFriendlySearch(query: any, search: string) {
  if (!search) return query
  // Filtering directly on the match_setup jsonb path — this is a base
  // table column, not an embedded relation, so no !inner join needed.
  return query.or(
    `match_setup->>venue.ilike.%${search}%,match_setup->team1->>name.ilike.%${search}%,match_setup->team2->>name.ilike.%${search}%`,
  )
}

async function fetchBracketPage(opts: {
  status?: MatchStatusFilter
  tournamentId?: string | null
  matchingTeamIds: string[]
  search: string
  page: number
  pageSize: number
  ascending: boolean
}): Promise<{ rows: PublicMatch[]; hasMore: boolean }> {
  const from = opts.page * opts.pageSize
  const to = from + opts.pageSize // fetch one extra row to detect "more"

  let query = supabase
    .from("bracket_matches")
    .select(BRACKET_SELECT)
    .order("scheduled_at", { ascending: opts.ascending, nullsFirst: false })
    .range(from, to)

  if (opts.status) query = query.eq("status", opts.status)
  if (opts.tournamentId) query = query.eq("tournament_id", opts.tournamentId)
  query = applyBracketSearch(query, opts.search, opts.matchingTeamIds)

  const { data, error } = await query
  if (error) console.error("[public] bracket page:", error.message)
  const rows = data ?? []
  return { rows: rows.slice(0, opts.pageSize).map(mapBracketRow), hasMore: rows.length > opts.pageSize }
}

/** Friendly-match page fetch. Mirrors fetchBracketPage exactly now:
 *  status is a real, indexed column (matches.derived_status — see
 *  migration 001), so it's a normal .eq() filter with real range-based
 *  pagination and an accurate hasMore. No more overfetch-and-filter
 *  workaround. */
async function fetchFriendlyPage(opts: {
  status?: MatchStatusFilter
  tournamentId?: string | null
  search: string
  page: number
  pageSize: number
}): Promise<{ rows: PublicMatch[]; hasMore: boolean }> {
  const from = opts.page * opts.pageSize
  const to = from + opts.pageSize // fetch one extra row to detect "more"

  let query = supabase
    .from("matches")
    .select(FRIENDLY_SELECT)
    .is("bracket_match_id", null)
    .order("created_at", { ascending: false })
    .range(from, to)

  if (opts.status) query = query.eq("derived_status", opts.status)
  if (opts.tournamentId) query = query.eq("tournament_id", opts.tournamentId)
  query = applyFriendlySearch(query, opts.search)

  const { data, error } = await query
  if (error) console.error("[public] friendly page:", error.message)
  const rows = data ?? []
  return { rows: rows.slice(0, opts.pageSize).map(mapFriendlyRow), hasMore: rows.length > opts.pageSize }
}

export type MatchPageParams = {
  status: MatchStatusFilter
  tournamentId?: string | null
  type?: MatchTypeFilter
  search?: string
  page?: number
  pageSize?: number
}

export type MatchPageResult = { matches: PublicMatch[]; hasMore: boolean }

/** Fetches one page of a single status band (upcoming/live/completed),
 *  across bracket + friendly matches, filtered and paginated server-side. */
export async function getPublicMatchesPage(params: MatchPageParams): Promise<MatchPageResult> {
  const {
    status,
    tournamentId = null,
    type = "all",
    search = "",
    page = 0,
    pageSize = DEFAULT_PAGE_SIZE,
  } = params
  const q = search.trim()
  const ascending = status !== "completed" // soonest-first for live/upcoming, most-recent-first for completed

  const wantsBracket = type !== "friendly"
  const matchingTeamIds = wantsBracket ? await resolveMatchingTeamIds(q) : []

  const [bracketRes, friendlyRes] = await Promise.all([
    wantsBracket
      ? fetchBracketPage({ status, tournamentId, matchingTeamIds, search: q, page, pageSize, ascending })
      : Promise.resolve({ rows: [] as PublicMatch[], hasMore: false }),
    fetchFriendlyPage({ status, tournamentId, search: q, page, pageSize }),
  ])

  const matches = [...bracketRes.rows, ...friendlyRes.rows].sort((a, b) => {
    const at = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0
    const bt = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0
    return ascending ? at - bt : bt - at
  })

  return { matches, hasMore: bracketRes.hasMore || friendlyRes.hasMore }
}

export type MatchOverviewParams = {
  tournamentId?: string | null
  type?: MatchTypeFilter
  search?: string
  completedPage?: number
  pageSize?: number
}

export type MatchOverviewResult = {
  live: PublicMatch[]
  upcoming: PublicMatch[]
  completed: PublicMatch[]
  completedHasMore: boolean
}

/**
 * Fetch for the "All" status tab. Live and Upcoming are bounded — there's
 * only ever a handful in play or on the calendar — so they're fetched in
 * full (capped generously). Completed is the one list that grows without
 * bound over a season, so it's paginated with its own "Load more".
 */
export async function getPublicMatchesOverview(opts: MatchOverviewParams): Promise<MatchOverviewResult> {
  const { tournamentId = null, type = "all", search = "", completedPage = 0, pageSize = DEFAULT_PAGE_SIZE } = opts

  const [liveRes, upcomingRes, completedRes] = await Promise.all([
    getPublicMatchesPage({ status: "live", tournamentId, type, search, page: 0, pageSize: 50 }),
    getPublicMatchesPage({ status: "upcoming", tournamentId, type, search, page: 0, pageSize: 50 }),
    getPublicMatchesPage({ status: "completed", tournamentId, type, search, page: completedPage, pageSize }),
  ])

  return {
    live: liveRes.matches,
    upcoming: upcomingRes.matches,
    completed: completedRes.matches,
    completedHasMore: completedRes.hasMore,
  }
}

export type MatchCounts = { all: number; upcoming: number; live: number; completed: number }

/** Cheap counts for the status filter pills — head-only queries for
 *  both bracket matches (real status column) and friendly matches
 *  (matches.derived_status, see migration 001). No row-by-row JS
 *  aggregation anymore on either side. */
export async function getPublicMatchesCounts(opts: {
  tournamentId?: string | null
  type?: MatchTypeFilter
  search?: string
}): Promise<MatchCounts> {
  const { tournamentId = null, type = "all", search = "" } = opts
  const q = search.trim()
  const wantsBracket = type !== "friendly"

  const matchingTeamIds = wantsBracket ? await resolveMatchingTeamIds(q) : []

  const bracketCount = async (status?: MatchStatusFilter): Promise<number> => {
    if (!wantsBracket) return 0
    let query = supabase.from("bracket_matches").select("id", { count: "exact", head: true })
    if (status) query = query.eq("status", status)
    if (tournamentId) query = query.eq("tournament_id", tournamentId)
    query = applyBracketSearch(query, q, matchingTeamIds)
    const { count, error } = await query
    if (error) console.error("[public] bracket count:", error.message)
    return count ?? 0
  }

  const friendlyCount = async (status?: MatchStatusFilter): Promise<number> => {
    let query = supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .is("bracket_match_id", null)
    if (status) query = query.eq("derived_status", status)
    if (tournamentId) query = query.eq("tournament_id", tournamentId)
    query = applyFriendlySearch(query, q)
    const { count, error } = await query
    if (error) console.error("[public] friendly count:", error.message)
    return count ?? 0
  }

  const [bAll, bUpcoming, bLive, bCompleted, fAll, fUpcoming, fLive, fCompleted] = await Promise.all([
    bracketCount(),
    bracketCount("upcoming"),
    bracketCount("live"),
    bracketCount("completed"),
    friendlyCount(),
    friendlyCount("upcoming"),
    friendlyCount("live"),
    friendlyCount("completed"),
  ])

  return {
    all: bAll + fAll,
    upcoming: bUpcoming + fUpcoming,
    live: bLive + fLive,
    completed: bCompleted + fCompleted,
  }
}

// ─────────────────────────────────────────────────────────────
// Priority-fill fetch: live -> upcoming -> completed, capped at a
// total limit, ordered by creation time within each band.
// ─────────────────────────────────────────────────────────────

type PriorityFillOpts = {
  tournamentId?: string | null
  type?: MatchTypeFilter
  search?: string
  limit?: number // total across all three statuses, default 50
}

type PriorityFillResult = {
  matches: PublicMatch[]
  breakdown: { live: number; upcoming: number; completed: number }
}

/** Fetches up to `limit` rows of a single status band (bracket + friendly
 *  combined), ordered by creation time descending (newest first). Both
 *  sides now filter status as a real column (bracket_matches.status,
 *  matches.derived_status), so no overfetch-and-filter is needed on
 *  either side. */
async function fetchStatusBandByCreation(opts: {
  status: MatchStatusFilter
  tournamentId: string | null
  type: MatchTypeFilter
  matchingTeamIds: string[]
  search: string
  limit: number
}): Promise<PublicMatch[]> {
  const { status, tournamentId, type, matchingTeamIds, search, limit } = opts
  const wantsBracket = type !== "friendly"

  const bracketPromise = wantsBracket
    ? (async () => {
        let query = supabase
          .from("bracket_matches")
          .select(BRACKET_SELECT)
          .eq("status", status)
          .order("created_at", { ascending: false })
          .limit(limit)
        if (tournamentId) query = query.eq("tournament_id", tournamentId)
        query = applyBracketSearch(query, search, matchingTeamIds)
        const { data, error } = await query
        if (error) console.error("[public] priority-fill bracket:", error.message)
        return (data ?? []).map(mapBracketRow)
      })()
    : Promise.resolve([] as PublicMatch[])

  const friendlyPromise = (async () => {
    let query = supabase
      .from("matches")
      .select(FRIENDLY_SELECT)
      .is("bracket_match_id", null)
      .eq("derived_status", status)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (tournamentId) query = query.eq("tournament_id", tournamentId)
    query = applyFriendlySearch(query, search)
    const { data, error } = await query
    if (error) console.error("[public] priority-fill friendly:", error.message)
    return (data ?? []).map(mapFriendlyRow)
  })()

  const [bracketRows, friendlyRows] = await Promise.all([bracketPromise, friendlyPromise])

  // Merge the two sources and re-sort by creation time before truncating,
  // so neither source is unfairly favored just because it resolved first.
  const merged = [...bracketRows, ...friendlyRows].sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return bt - at // newest first
  })

  return merged.slice(0, limit)
}

/** Priority-fill fetch: live first, then upcoming, then completed,
 *  stopping once `limit` total matches have been collected. Each band
 *  is ordered by creation time (newest first). This is a one-shot top-N
 *  fetch, not a paginated feed — there's no "load more" cursor here. */
export async function getPublicMatchesPriorityFill(
  opts: PriorityFillOpts,
): Promise<PriorityFillResult> {
  const { tournamentId = null, type = "all", search = "", limit = 50 } = opts
  const q = search.trim()

  const wantsBracket = type !== "friendly"
  const matchingTeamIds = wantsBracket ? await resolveMatchingTeamIds(q) : []

  const order: MatchStatusFilter[] = ["live", "upcoming", "completed"]
  const collected: PublicMatch[] = []
  const breakdown = { live: 0, upcoming: 0, completed: 0 }
  let remaining = limit

  for (const status of order) {
    if (remaining <= 0) break

    const rows = await fetchStatusBandByCreation({
      status,
      tournamentId,
      type,
      matchingTeamIds,
      search: q,
      limit: remaining,
    })

    collected.push(...rows)
    breakdown[status] = rows.length
    remaining -= rows.length
  }

  return { matches: collected, breakdown }
}

/** Flat, one-shot match list for simple directory-style listings
 *  (e.g. PublicDirectoryClient) that just want "the matches", not the
 *  live/upcoming/completed breakdown. Backed by the same priority-fill
 *  fetch used elsewhere, capped at 50 by default. */
export async function getPublicMatches(): Promise<PublicMatch[]> {
  const { matches } = await getPublicMatchesPriorityFill({})
  return matches
}

/** Tournament dropdown options — fetched directly from `tournaments`
 *  rather than derived from a fully-loaded match list. */
export async function getTournamentOptions(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from("tournaments").select("id, name").order("name")
  if (error) {
    console.error("[public] tournament options:", error.message)
    return []
  }
  return data ?? []
}

/** Cheap existence check for the "Friendly" filter chip — only shown
 *  when there's at least one standalone match. */
export async function getFriendlyMatchCount(): Promise<number> {
  const { count, error } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .is("bracket_match_id", null)
  if (error) {
    console.error("[public] friendly count:", error.message)
    return 0
  }
  return count ?? 0
}

// ─────────────────────────────────────────────────────────────
// Unrelated public reads — unchanged
// ─────────────────────────────────────────────────────────────

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