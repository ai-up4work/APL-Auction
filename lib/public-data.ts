import { supabase } from "@/lib/supabase"

export type PublicMatch = {
  id: string
  round: number
  teamA: string
  teamB: string
  teamACode: string | null
  teamBCode: string | null
  teamAColor: string | null
  teamBColor: string | null
  scoreA: number | null
  scoreB: number | null
  status: string
  scheduledAt: string | null
  venue: string | null
}

export type PublicTeam = { id: string; name: string; code: string; logo: string | null; color: string | null }
export type PublicPlayer = { id: string; name: string; role: string; team: string }
export type PublicStanding = { team: string; played: number; won: number; lost: number; points: number; nrr: string }

export async function getPublicMatches(): Promise<PublicMatch[]> {
  const { data, error } = await supabase
    .from("bracket_matches")
    .select(`
      id, round, status, score_a, score_b, scheduled_at, venue,
      team_a:teams!bracket_matches_team_a_id_fkey ( name, code, color ),
      team_b:teams!bracket_matches_team_b_id_fkey ( name, code, color )
    `)
    .order("round")
    .order("position")

  if (error) {
    console.error("[public] matches:", error.message)
    return []
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    round: row.round,
    teamA: row.team_a?.name ?? "TBD",
    teamB: row.team_b?.name ?? "TBD",
    teamACode: row.team_a?.code ?? null,
    teamBCode: row.team_b?.code ?? null,
    teamAColor: row.team_a?.color ?? null,
    teamBColor: row.team_b?.color ?? null,
    scoreA: row.score_a,
    scoreB: row.score_b,
    status: row.status ?? "upcoming",
    scheduledAt: row.scheduled_at ?? null,
    venue: row.venue ?? null,
  }))
}

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