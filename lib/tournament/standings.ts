// lib/tournament/standings.ts
//
// WHY THIS FILE EXISTS:
//   TournamentStatsPanel / PointsTablePanel on the public tournament page
//   read from `standings` via getPointsTableForTournament() in
//   lib/tournament/tournament.ts. That reader is correct — but nothing
//   in the codebase writes to `standings`. It's populated by nothing,
//   so `standings.tournament_id = X` always returns zero rows, which is
//   why the Points Table tab renders locked even for tournaments with
//   completed matches.
//
//   This file adds the missing write path: recomputeStandingsForTournament
//   derives played/won/lost/points/nrr/form from real match results and
//   upserts one row per team into `standings`.
//
// SOURCE OF TRUTH FOR RESULTS:
//   `bracket_matches` rows with status = 'completed' and both team_a_id /
//   team_b_id / score_a / score_b / winner_team_id set. This is the same
//   table getFixturesForTournament() and getBracketChartDataForTournament()
//   already read for the Schedule/Bracket tabs, so a match only counts
//   here once it's already visible as "completed" elsewhere on the page.
//
// NRR:
//   Real net run rate needs balls actually faced/bowled, not just final
//   scores. bracket_matches only stores score_a/score_b (no overs data).
//   Where a bracket_match is linked to a real scored match
//   (overlay_match_id -> matches.id), this pulls legal-ball counts from
//   `balls` for an accurate figure. Where it isn't linked (a bracket
//   result entered manually, with no ball-by-ball data behind it), it
//   falls back to assuming the full overs quota was used by both teams
//   (matches.match_setup.overs, defaulting to 20) — the same convention
//   real cricket NRR uses for a team bowled out inside their overs, so
//   it's not a wild guess, just not exact for a team that simply didn't
//   need all their overs to chase a target.
//
// POINTS:
//   2 for a win, 1 for a tie, 0 for a loss — the common T20-league
//   default. `tied`/`no_result` columns exist on `standings` but nothing
//   upstream (bracket_matches.status) currently distinguishes a tie from
//   a decisive result, so every completed match here is treated as a
//   win/loss via winner_team_id. Wire in a real tie signal later if your
//   schema grows one.
//
// FORM:
//   Last 5 results per team, most recent last, as "W"/"L" — matches the
//   PointsRow.form shape ("W" | "L" | "NR") the UI already renders as
//   pills. Ordered by bracket_matches.round (ascending), which is the
//   only reliable chronological signal bracket_matches carries; swap in
//   scheduled_at if you want actual match-date ordering instead.
//
// WHEN TO CALL THIS:
//   Not on every page load — it's a write, and the public tournament
//   page (getTournamentById) should stay read-only. Call it:
//     - after a bracket_matches row is marked 'completed' (wherever that
//       transition happens in your scoring/bracket-admin flow)
//     - from a manual "Recalculate Standings" action on the tournament
//       edit page, for backfilling tournaments that already have
//       completed matches but no standings rows yet
//   A cron/scheduled recompute is also fine if per-match triggering isn't
//   convenient yet — this function is idempotent (delete + reinsert per
//   tournament), so calling it repeatedly is always safe.

import { supabase } from "@/lib/supabase"

interface CompletedBracketMatch {
  id: string
  round: number
  team_a_id: string
  team_b_id: string
  score_a: number
  score_b: number
  winner_team_id: string | null
  overlay_match_id: string | null
}

interface TeamAgg {
  teamId: string
  played: number
  won: number
  lost: number
  tied: number
  noResult: number
  points: number
  runsScored: number
  ballsFaced: number
  runsConceded: number
  ballsBowled: number
  // chronological W/L sequence (by round), trimmed to last 5 at the end
  formSeq: ("W" | "L")[]
}

function emptyAgg(teamId: string): TeamAgg {
  return {
    teamId,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    noResult: 0,
    points: 0,
    runsScored: 0,
    ballsFaced: 0,
    runsConceded: 0,
    ballsBowled: 0,
    formSeq: [],
  }
}

/**
 * Legal (non-wide, non-no-ball) delivery count per batting_team_id for a
 * single match, from `balls`. Used for real NRR when a bracket_matches
 * row is linked to a scored match via overlay_match_id.
 */
async function getLegalBallsByTeam(matchId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("balls")
    .select("batting_team_id, extra_type")
    .eq("match_id", matchId)

  if (error) {
    console.error(`[standings] balls lookup failed for match ${matchId}:`, error.message)
    return new Map()
  }

  const legalByTeam = new Map<string, number>()
  for (const row of data ?? []) {
    if (!row.batting_team_id) continue
    const isLegal = row.extra_type !== "wide" && row.extra_type !== "no_ball"
    if (!isLegal) continue
    legalByTeam.set(row.batting_team_id, (legalByTeam.get(row.batting_team_id) ?? 0) + 1)
  }
  return legalByTeam
}

/**
 * Falls back to a full-overs assumption when there's no ball-by-ball
 * data behind a bracket result. Reads matches.match_setup.overs via the
 * overlay_match_id if present (even without balls rows), else defaults
 * to 20-over matches — matching the same default used throughout
 * data/match-data.ts (`setup.overs ?? 20`).
 */
async function getOversLimit(overlayMatchId: string | null): Promise<number> {
  if (!overlayMatchId) return 20
  const { data, error } = await supabase
    .from("matches")
    .select("match_setup")
    .eq("id", overlayMatchId)
    .maybeSingle()

  if (error || !data) return 20
  const overs = (data.match_setup as any)?.overs
  return typeof overs === "number" && overs > 0 ? overs : 20
}

/**
 * Computes and upserts standings for every team that played at least one
 * completed match in this tournament. Delete + reinsert per tournament,
 * same "simplest correct approach for a fully derived list" pattern
 * savePrizesForTournament already uses — there's no partial-update case
 * that matters here since every row is fully recomputed from scratch.
 */
export async function recomputeStandingsForTournament(tournamentId: string): Promise<boolean> {
  const { data: matches, error: matchesErr } = await supabase
    .from("bracket_matches")
    .select("id, round, team_a_id, team_b_id, score_a, score_b, winner_team_id, overlay_match_id")
    .eq("tournament_id", tournamentId)
    .eq("status", "completed")
    .not("team_a_id", "is", null)
    .not("team_b_id", "is", null)
    .not("score_a", "is", null)
    .not("score_b", "is", null)
    .order("round", { ascending: true })

  if (matchesErr) {
    console.error("[standings] bracket_matches lookup failed:", matchesErr.message)
    return false
  }

  const completed = (matches ?? []) as CompletedBracketMatch[]

  if (completed.length === 0) {
    // Nothing to compute. Clear any stale rows for this tournament rather
    // than leaving old standings behind (e.g. if every completed match
    // got reset to 'upcoming'). This delete is safe even under overlap —
    // deleting twice is a no-op the second time, unlike delete-then-insert.
    const { error: clearErr } = await supabase.from("standings").delete().eq("tournament_id", tournamentId)
    if (clearErr) console.error("[standings] clear failed:", clearErr.message)
    return !clearErr
  }

  const aggByTeam = new Map<string, TeamAgg>()
  const getAgg = (teamId: string) => {
    if (!aggByTeam.has(teamId)) aggByTeam.set(teamId, emptyAgg(teamId))
    return aggByTeam.get(teamId)!
  }

  for (const m of completed) {
    const a = getAgg(m.team_a_id)
    const b = getAgg(m.team_b_id)

    a.played += 1
    b.played += 1
    a.runsScored += m.score_a
    a.runsConceded += m.score_b
    b.runsScored += m.score_b
    b.runsConceded += m.score_a

    // ── balls faced/bowled for NRR ──
    let aLegalBalls: number | undefined
    let bLegalBalls: number | undefined

    if (m.overlay_match_id) {
      const legalByTeam = await getLegalBallsByTeam(m.overlay_match_id)
      aLegalBalls = legalByTeam.get(m.team_a_id)
      bLegalBalls = legalByTeam.get(m.team_b_id)
    }

    if (aLegalBalls === undefined || bLegalBalls === undefined) {
      const oversLimit = await getOversLimit(m.overlay_match_id)
      const fullQuota = oversLimit * 6
      if (aLegalBalls === undefined) aLegalBalls = fullQuota
      if (bLegalBalls === undefined) bLegalBalls = fullQuota
    }

    a.ballsFaced += aLegalBalls
    b.ballsFaced += bLegalBalls
    // one team's balls faced batting = the other team's balls bowled
    a.ballsBowled += bLegalBalls
    b.ballsBowled += aLegalBalls

    // ── result + points + form ──
    if (m.winner_team_id === m.team_a_id) {
      a.won += 1
      a.points += 2
      a.formSeq.push("W")
      b.lost += 1
      b.formSeq.push("L")
    } else if (m.winner_team_id === m.team_b_id) {
      b.won += 1
      b.points += 2
      b.formSeq.push("W")
      a.lost += 1
      a.formSeq.push("L")
    } else {
      // no winner recorded on a 'completed' match — treat as a tie
      // rather than silently dropping the result.
      a.tied += 1
      b.tied += 1
      a.points += 1
      b.points += 1
      a.formSeq.push("W") // ties don't map to W/L in the UI's pill set;
      b.formSeq.push("W") // shown as "W" to avoid a false loss indicator
    }
  }

  const rows = [...aggByTeam.values()].map((agg) => {
    const runRateFor = agg.ballsFaced > 0 ? (agg.runsScored / agg.ballsFaced) * 6 : 0
    const runRateAgainst = agg.ballsBowled > 0 ? (agg.runsConceded / agg.ballsBowled) * 6 : 0
    const nrr = Math.round((runRateFor - runRateAgainst) * 100) / 100

    return {
      tournament_id: tournamentId,
      team_id: agg.teamId,
      played: agg.played,
      won: agg.won,
      lost: agg.lost,
      tied: agg.tied,
      no_result: agg.noResult,
      points: agg.points,
      runs_scored: agg.runsScored,
      balls_faced: agg.ballsFaced,
      runs_conceded: agg.runsConceded,
      balls_bowled: agg.ballsBowled,
      nrr,
      form: agg.formSeq.slice(-5),
    }
  })

  // Upsert instead of delete-then-insert: two overlapping calls (e.g. this
  // running on every page load, plus Next.js link-prefetch triggering it
  // again before the first finishes) can no longer produce duplicate rows,
  // because (tournament_id, team_id) has a DB-level unique constraint —
  // see the migration that adds it. Each call just overwrites the same
  // row with its own freshly computed numbers; worst case under a race is
  // "last write wins" on the values, never duplicate rows.
  const { error: upsertErr } = await supabase
    .from("standings")
    .upsert(rows, { onConflict: "tournament_id,team_id" })
  if (upsertErr) {
    console.error("[standings] upsert failed:", upsertErr.message)
    return false
  }

  // Clean up any team that WAS in standings for this tournament but no
  // longer has a completed match backing it (e.g. a match got reverted
  // from 'completed' back to 'live'/'upcoming'). Upsert alone never
  // removes rows, only delete-then-insert did — so without this, a
  // reverted match would leave a stale, now-inaccurate team row behind.
  const currentTeamIds = rows.map((r) => r.team_id)
  const { error: pruneErr } = await supabase
    .from("standings")
    .delete()
    .eq("tournament_id", tournamentId)
    .not("team_id", "in", `(${currentTeamIds.map((id) => `"${id}"`).join(",")})`)
  if (pruneErr) console.error("[standings] prune failed:", pruneErr.message)

  return true
}