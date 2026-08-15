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
 * Every player visible on the public site — both players still sitting
 * in the org's pool (source: "pool") and players already pulled into
 * an auction (source: "auction", status sold/available/unsold).
 *
 * Backed by public.public_players_view, which does the union of
 * `player_bank` + `players` and the status derivation server-side (see
 * public_players_view.sql). This file no longer needs to know about
 * either table's internal columns or FK constraint names.
 *
 * NOTE: as with the previous table-based query, this still has no
 * org/tournament visibility scoping — see the SCOPING NOTE at the top
 * of public_players_view.sql if that needs to be added.
 */
export async function getPlayersForPublic(): Promise<PublicPlayer[]> {
  const { data, error } = await supabase
    .from("public_players_view")
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

  return (data ?? []).map(toPublicPlayer)
}

// ── Single-player detail (public_player_detail_view) ────────────────
// See public_player_detail_view.sql for how these numbers are derived
// from public.balls, and the assumptions baked into that derivation.
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
 */
export async function getPlayerDetailForPublic(id: string): Promise<PlayerDetail | null> {
  const { data, error } = await supabase
    .from("public_player_detail_view")
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
      created_at,
      matches_batted,
      runs_scored,
      balls_faced,
      dismissals,
      batting_average,
      strike_rate,
      matches_bowled,
      balls_bowled,
      runs_conceded,
      wickets,
      bowling_average,
      economy
    `
    )
    .eq("id", id)
    .maybeSingle()
    .returns<PlayerDetailRow>()

  if (error) {
    console.error("getPlayerDetailForPublic failed:", error.message)
    return null
  }
  if (!data) return null

  return toPlayerDetail(data)
}