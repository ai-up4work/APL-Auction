import { supabase } from "@/lib/supabase"

// ── Types ─────────────────────────────────────────────────────────
export type PlayerRole = "Batter" | "Bowler" | "All-rounder" | "WK-Batter" | "Batsman" | "Wicket Keeper"
export type PlayerOrigin = "Local" | "local" | "Overseas" | "overseas"

// "pool" = sitting in the org's player bank, not yet pulled into an
// auction. The other three come from an in-progress or finished
// auction, same as before.
export type PlayerStatus = "sold" | "available" | "unsold" | "pool"
export type PlayerSource = "auction" | "pool"

export type PublicPlayer = {
  id: string
  source: PlayerSource
  name: string
  role: PlayerRole
  origin: PlayerOrigin
  country: string | null
  img: string | null
  capped: boolean
  price: number | null // null for pool players — no auction price yet
  soldPrice: number | null
  status: PlayerStatus
  team: { id: string; name: string; code: string; color: string; logo: string | null } | null
  createdAt: string | null
}

// Raw shape of a row as returned by public.public_players_view (see
// public_players_view.sql). The view already does the auction/pool
// union and status derivation server-side, so this file just maps the
// flat row shape into PublicPlayer.
type PlayerViewRow = {
  id: string
  source: PlayerSource
  name: string
  role: PlayerRole
  origin: PlayerOrigin
  country: string | null
  img: string | null
  capped: boolean | null
  price: number | null
  sold_price: number | null
  status: PlayerStatus
  team_id: string | null
  team_name: string | null
  team_code: string | null
  team_color: string | null
  team_logo: string | null
  created_at: string | null
}

function toPublicPlayer(row: PlayerViewRow): PublicPlayer {
  return {
    id: row.id,
    source: row.source,
    name: row.name,
    role: row.role,
    origin: row.origin,
    country: row.country,
    img: row.img || null,
    capped: !!row.capped,
    price: row.price,
    soldPrice: row.sold_price,
    status: row.status,
    team: row.team_id
      ? {
          id: row.team_id,
          name: row.team_name ?? "",
          code: row.team_code ?? "",
          color: row.team_color ?? "#e45d35",
          logo: row.team_logo || null,
        }
      : null,
    createdAt: row.created_at,
  }
}

/**
 * The public view can legitimately return more than one row for a player:
 * the same canonical player ID may exist in the organization pool and in one
 * or more auction projections. The ID, not the name, is the identity key.
 * Keep one display record, preferring:
 *   1. the auction row over the pool fallback row (current status/team/price)
 *   2. among rows of the same source, whichever one actually has a photo
 *
 * NOTE: this only merges rows that share the exact same `id` (the
 * pool-vs-auction projection of one canonical player row). It does NOT
 * catch distinct ids that represent the same real player (e.g. a player
 * re-imported or re-entered into a new auction with a fresh row). That
 * broader name+role collapsing happens server-side in
 * public_players_list_view, which getPlayersForPublic queries below —
 * this function stays as a second-pass safety net for the id-level case
 * it was originally written for.
 */
/**
 * The public view can legitimately return more than one row for a player:
 * the same canonical player ID may exist in the organization pool and in one
 * or more auction projections. The ID, not the name, is the identity key.
 * Keep one display record, preferring:
 *   1. whichever row actually has a photo — always wins, even over a
 *      more "current" auction row that lacks one
 *   2. among rows tied on that, the auction row over the pool fallback
 *
 * NOTE: this only merges rows that share the exact same `id` (the
 * pool-vs-auction projection of one canonical player row). It does NOT
 * catch distinct ids that represent the same real player (e.g. a player
 * re-imported or re-entered into a new auction with a fresh row). That
 * broader name+role collapsing happens server-side in
 * public_players_list_view, which getPlayersForPublic queries below —
 * this function stays as a second-pass safety net for the id-level case
 * it was originally written for.
 */
function dedupePlayerRows(rows: PlayerViewRow[]): PlayerViewRow[] {
  const byId = new Map<string, PlayerViewRow>()

  for (const row of rows) {
    const existing = byId.get(row.id)
    if (!existing) {
      byId.set(row.id, row)
      continue
    }

    const existingHasImg = !!existing.img
    const rowHasImg = !!row.img

    // A row with a photo always beats one without, regardless of
    // source — this is checked first, before the auction/pool rule.
    if (!existingHasImg && rowHasImg) {
      byId.set(row.id, row)
      continue
    }
    if (existingHasImg && !rowHasImg) {
      continue
    }

    // Both have an image, or neither does — fall back to preferring
    // the auction-sourced row over the pool fallback row.
    if (existing.source === "pool" && row.source === "auction") {
      byId.set(row.id, row)
    }
  }

  return Array.from(byId.values())
}

/**
 * Every player visible on the public site — both players still sitting
 * in the org's pool (source: "pool") and players already pulled into
 * an auction (source: "auction", status sold/available/unsold).
 *
 * Backed by public.public_players_list_view, which sits on top of
 * public_players_view and collapses duplicate rows for the same real
 * player (same name + role, e.g. from a re-run auction or re-import)
 * down to one representative row — preferring the auction-sourced row,
 * then a row that has a photo, then the newest (see
 * public_players_list_view.sql). This is what keeps the /all-players
 * grid from showing duplicate cards, and from picking an imageless
 * duplicate over one that actually has a photo.
 *
 * Deliberately NOT backed by public_player_detail_view — that view
 * keeps every id (including duplicates) so the detail page can resolve
 * any id a card links to; collapsing happens here instead, once, for
 * display purposes only.
 *
 * NOTE: as with the previous table-based query, this still has no
 * org/tournament visibility scoping — see the SCOPING NOTE at the top
 * of public_players_view.sql if that needs to be added.
 */
export async function getPlayersForPublic(): Promise<PublicPlayer[]> {
  const { data, error } = await supabase
    .from("public_players_list_view")
    .select(
      `
      id,
      source,
      name,
      role,
      origin,
      country,
      img,
      capped,
      price,
      sold_price,
      status,
      team_id,
      team_name,
      team_code,
      team_color,
      team_logo,
      created_at
    `
    )
    .order("created_at", { ascending: false })
    .returns<PlayerViewRow[]>()

  if (error) {
    console.error("getPlayersForPublic failed:", error.message)
    return []
  }

  return dedupePlayerRows(data ?? []).map(toPublicPlayer)
}

// ── Single-player detail (public_player_detail_view) ────────────────
// See public_player_detail_view.sql for how these numbers are derived
// from public.balls, and the assumptions baked into that derivation.
// This view intentionally keeps one row per id (no collapsing) so that
// any id surfaced anywhere — including a non-representative duplicate
// row that lost out in public_players_list_view — still resolves here.
export type PlayerDetail = PublicPlayer & {
  matchesBatted: number
  runsScored: number
  ballsFaced: number
  dismissals: number
  battingAverage: number | null
  strikeRate: number | null
  matchesBowled: number
  ballsBowled: number
  runsConceded: number
  wickets: number
  bowlingAverage: number | null
  economy: number | null
}

type PlayerDetailRow = PlayerViewRow & {
  matches_batted: number
  runs_scored: number
  balls_faced: number
  dismissals: number
  batting_average: number | null
  strike_rate: number | null
  matches_bowled: number
  balls_bowled: number
  runs_conceded: number
  wickets: number
  bowling_average: number | null
  economy: number | null
}

function toPlayerDetail(row: PlayerDetailRow): PlayerDetail {
  return {
    ...toPublicPlayer(row),
    matchesBatted: row.matches_batted,
    runsScored: row.runs_scored,
    ballsFaced: row.balls_faced,
    dismissals: row.dismissals,
    battingAverage: row.batting_average,
    strikeRate: row.strike_rate,
    matchesBowled: row.matches_bowled,
    ballsBowled: row.balls_bowled,
    runsConceded: row.runs_conceded,
    wickets: row.wickets,
    bowlingAverage: row.bowling_average,
    economy: row.economy,
  }
}

/**
 * Full public detail for a single player: identity/status/team (same
 * as getPlayersForPublic) plus career batting/bowling stats derived
 * from public.balls. Returns null if the id doesn't exist — the
 * caller should render a "player not found" state, not throw.
 *
 * Backed by the public_player_detail(uuid) function rather than the
 * old public_player_detail_view — the view aggregated stats for every
 * player in the org before filtering down to one id, which is why it
 * started timing out as data grew. The function resolves this
 * player's siblings first (same name+role+team_code) and only
 * aggregates `balls` for that small set. See the migration that
 * introduced public_player_detail() for details.
 */
export async function getPlayerDetailForPublic(id: string): Promise<PlayerDetail | null> {
  const { data, error } = await supabase
    .rpc("public_player_detail", { p_id: id })
    .maybeSingle()
    .returns<PlayerDetailRow>()

  if (error) {
    console.error("getPlayerDetailForPublic failed:", error.message)
    return null
  }
  if (!data) return null

  return toPlayerDetail(data)
}