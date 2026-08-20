// lib/matchSetupAdapter.ts
//
// Bridges two independent representations of "match setup" that both
// ultimately describe the same match row (`matches.match_setup`):
//
//  1. DB shape — owned primarily by the Match Editor page
//     (app/(protected)/match/[matchId]/edit). Keys: team1/team2
//     ({name,short,logo,color}), squads (grouped array keyed by
//     teamId "team1"/"team2", each with captain + players
//     [{name,role,xi,playerId}]), date/time, tossWinner (the literal
//     team NAME string), tossDecision, toss (derived sentence), plus
//     round/officials/overs/matchMeta/rosterLocked, which the overlay
//     console never touches.
//
//  2. Overlay shape — `MatchSetup`/`TeamInfo` from lib/overlayBus,
//     owned by the live broadcast console (OverlayAdminConsole /
//     MatchSetupPanel). Keys: teamA/teamB ({name,shortCode,color,
//     logoUrl,squadPlayers,squad}), kickoffTime (single string),
//     tossWinner ("A"|"B" side literal), tossDecision.
//
// dbRowToOverlaySetup() reads a `matches` row into the overlay shape,
// so the console can hydrate from whatever the Match Editor last
// saved (or vice versa). overlaySetupToDbPatch() does the reverse for
// `patch_match_setup`, which does a SHALLOW top-level merge
// server-side — so this only returns the keys the overlay actually
// owns/edited, and for the one key both editors touch (`squads`) it
// carries forward captain/role/XI from the last DB load rather than
// defaulting them, since the overlay UI itself has no fields for any
// of those three and would otherwise blank them out on every push.

import type { MatchSetup, TeamInfo, SquadPlayer as OverlaySquadPlayer } from "@/lib/overlayBus"

type DbTeam = { name?: string; short?: string; logo?: string; color?: string }
type DbSquadPlayer = { name?: string; role?: string; xi?: boolean; playerId?: string }
type DbSquad = { teamId?: "team1" | "team2"; captain?: string; players?: DbSquadPlayer[] }

export interface DbMatchSetupRow {
  tournamentName?: string
  season?: string
  tournamentLogoUrl?: string
  venue?: string
  format?: "T20" | "ODI" | "Test"
  matchNumber?: string
  matchTitle?: string
  date?: string
  time?: string
  team1?: DbTeam
  team2?: DbTeam
  squads?: DbSquad[]
  tossWinner?: string // literal team NAME in the DB shape, not "A"/"B"
  tossDecision?: string
  [key: string]: unknown
}

const DEFAULT_TEAM_COLOR = "#c9971f"

function composeTossText(tossWinnerName: string, tossDecision: string): string {
  if (!tossWinnerName || !tossDecision) return ""
  return `${tossWinnerName} won the toss and elected to ${tossDecision === "bat" ? "bat" : "bowl"}`
}

// ─────────────────────────────────────────────────────────────
// DB → overlay
// ─────────────────────────────────────────────────────────────

function squadPlayersFromDb(squads: DbSquad[] | undefined, teamId: "team1" | "team2"): OverlaySquadPlayer[] {
  const squad = squads?.find((s) => s.teamId === teamId)
  if (!squad?.players) return []
  return squad.players
    .filter((p) => p.name && p.name.trim())
    .map((p) => ({
      // The overlay's roster chips key off `id`; reuse the real
      // players.id (playerId) when this player has been synced once,
      // otherwise fall back to the same "manual:" convention already
      // used elsewhere in MatchSetupPanel for unmatched entries.
      id: p.playerId && p.playerId.trim() ? p.playerId : `manual:${p.name}`,
      name: p.name!,
      imageUrl: undefined,
    }))
}

function overlayTeamFromDb(dbTeam: DbTeam | undefined, squads: DbSquad[] | undefined, teamId: "team1" | "team2"): TeamInfo {
  const squadPlayers = squadPlayersFromDb(squads, teamId)
  return {
    // Deliberately left undefined — MatchSetupPanel already resolves
    // this from name/shortCode against the `teams` table itself (see
    // its resolveTeamId effect), so the adapter doesn't need to guess.
    teamId: undefined,
    name: dbTeam?.name ?? "",
    shortCode: dbTeam?.short ?? "",
    color: dbTeam?.color ?? DEFAULT_TEAM_COLOR,
    logoUrl: dbTeam?.logo ?? undefined,
    squadPlayers,
    squad: squadPlayers.map((p) => p.name),
  }
}

// Reads a `matches` row's jsonb into the overlay console's shape.
// Falls back to `fallback` (the console's current/default state) for
// anything the DB row doesn't have yet, so a brand-new match still
// opens with sane defaults instead of blank fields.
export function dbRowToOverlaySetup(raw: DbMatchSetupRow | null | undefined, fallback: MatchSetup): MatchSetup {
  if (!raw) return fallback

  const team1Name = raw.team1?.name ?? ""
  const team2Name = raw.team2?.name ?? ""
  const tossWinnerSide: "A" | "B" | "" =
    raw.tossWinner && raw.tossWinner === team1Name ? "A" : raw.tossWinner && raw.tossWinner === team2Name ? "B" : ""

  // DB keeps date/time separate; overlay only has one free-text
  // kickoff field. Combine for display — this is lossy on the way
  // back out (see the `time`-only note in overlaySetupToDbPatch).
  const kickoffTime = [raw.date, raw.time].filter(Boolean).join(" ").trim()

  return {
    tournamentName: raw.tournamentName ?? fallback.tournamentName,
    season: raw.season ?? fallback.season,
    tournamentLogoUrl: raw.tournamentLogoUrl ?? fallback.tournamentLogoUrl,
    venue: raw.venue ?? fallback.venue,
    format: (raw.format as MatchSetup["format"]) ?? fallback.format,
    matchNumber: raw.matchNumber ?? fallback.matchNumber,
    kickoffTime: kickoffTime || fallback.kickoffTime,
    matchTitle: raw.matchTitle ?? fallback.matchTitle,
    teamA: overlayTeamFromDb(raw.team1, raw.squads, "team1"),
    teamB: overlayTeamFromDb(raw.team2, raw.squads, "team2"),
    tossWinner: tossWinnerSide || fallback.tossWinner,
    tossDecision: (raw.tossDecision as MatchSetup["tossDecision"]) ?? fallback.tossDecision,
  }
}

// ─────────────────────────────────────────────────────────────
// overlay → DB patch
// ─────────────────────────────────────────────────────────────

function existingSquad(existingRaw: DbMatchSetupRow | null | undefined, teamId: "team1" | "team2"): DbSquad | undefined {
  return existingRaw?.squads?.find((s) => s.teamId === teamId)
}

function existingPlayerMeta(squad: DbSquad | undefined, playerId: string, name: string): { role: string; xi: boolean } {
  const match = squad?.players?.find((p) => (p.playerId && p.playerId === playerId) || (p.name ?? "").trim().toLowerCase() === name.trim().toLowerCase())
  return { role: match?.role ?? "Batter", xi: !!match?.xi }
}

function buildSquadPatch(team: TeamInfo, existingRaw: DbMatchSetupRow | null | undefined, teamId: "team1" | "team2"): DbSquad {
  const prevSquad = existingSquad(existingRaw, teamId)
  return {
    teamId,
    // The overlay UI has no captain field — always carry forward
    // whatever the Match Editor's Squads tab last set.
    captain: prevSquad?.captain ?? "",
    players: team.squadPlayers.map((p) => {
      const playerId = p.id.startsWith("manual:") ? undefined : p.id
      // Same reasoning as captain: role/XI are Match-Editor-owned
      // fields the overlay UI can't set, so preserve them for any
      // player that already existed rather than resetting to
      // defaults on every push. Genuinely new roster additions (not
      // in the last DB load) fall back to Batter / not-in-XI, same
      // default the Match Editor itself uses for a freshly added row.
      const meta = existingPlayerMeta(prevSquad, playerId ?? "", p.name)
      return { name: p.name, role: meta.role, xi: meta.xi, playerId }
    }),
  }
}

// Builds ONLY the keys the overlay console owns, for patch_match_setup
// (a shallow top-level merge — see note at top of file). Pass the last
// DB row loaded (or null for a brand-new match) so squads/captain/
// role/XI aren't clobbered — see buildSquadPatch above.
export function overlaySetupToDbPatch(matchSetup: MatchSetup, existingRaw: DbMatchSetupRow | null | undefined): Record<string, any> {
  const tossWinnerName =
    matchSetup.tossWinner === "A" ? matchSetup.teamA.name : matchSetup.tossWinner === "B" ? matchSetup.teamB.name : ""

  return {
    tournamentName: matchSetup.tournamentName,
    season: matchSetup.season,
    tournamentLogoUrl: matchSetup.tournamentLogoUrl,
    venue: matchSetup.venue,
    format: matchSetup.format,
    matchNumber: matchSetup.matchNumber,
    matchTitle: matchSetup.matchTitle,
    // `date` is intentionally omitted — the overlay console has no
    // date field, only a single kickoff string, and the shallow merge
    // leaves whatever `date` the Match Editor already saved untouched.
    time: matchSetup.kickoffTime,
    team1: { name: matchSetup.teamA.name, short: matchSetup.teamA.shortCode, logo: matchSetup.teamA.logoUrl ?? "", color: matchSetup.teamA.color },
    team2: { name: matchSetup.teamB.name, short: matchSetup.teamB.shortCode, logo: matchSetup.teamB.logoUrl ?? "", color: matchSetup.teamB.color },
    squads: [buildSquadPatch(matchSetup.teamA, existingRaw, "team1"), buildSquadPatch(matchSetup.teamB, existingRaw, "team2")],
    tossWinner: tossWinnerName,
    tossDecision: matchSetup.tossDecision,
    // Written directly rather than left for the Match Editor to
    // recompute on next open, so anything reading plain `toss` text
    // (simulator, scorecards) sees a consistent value immediately.
    toss: composeTossText(tossWinnerName, matchSetup.tossDecision),
  }
}