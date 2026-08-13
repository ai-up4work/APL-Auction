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
//   It also exports getMatchNrrBreakdownForTournament, which returns the
//   same per-match runs/overs inputs used to build the aggregate NRR, but
//   kept as one row per match instead of summed — so the public page's
//   "how was this calculated" overlay can show match-by-match figures
//   instead of just the final number.
//
// SOURCE OF TRUTH FOR RESULTS:
//   `bracket_matches` rows with status = 'completed' and both team_a_id /
//   team_b_id / score_a / score_b / winner_team_id set. This is the same
//   table getFixturesForTournament() and getBracketChartDataForTournament()
//   already read for the Schedule/Bracket tabs, so a match only counts
//   here once it's already visible as "completed" elsewhere on the page.
//
// NRR — exact ICC rule:
//   NRR = (runs scored / overs faced) − (runs conceded / overs bowled),
//   summed across every match, one subtraction at the end (not averaged
//   per match). "Overs faced" for a given team's innings is resolved
//   PER TEAM, PER INNINGS, independently, as:
//     - ALL OUT (10 wickets down) before using the full overs quota ->
//       overs faced = the FULL quota (e.g. 20.0 in a T20), not the actual
//       balls it took to lose the 10th wicket. This is the real ICC rule
//       — it exists specifically so a team can't inflate its own NRR by
//       batting slowly, and a fast collapse doesn't get double-punished
//       beyond the runs already conceded.
//     - NOT all out (overs completed normally, or the innings ended early
//       because a successful chase reached its target) -> overs faced =
//       the ACTUAL legal balls faced. A team finishing a chase in fewer
//       overs is correctly rewarded with a better NRR.
//   One team can be bowled out while the other chases successfully in the
//   SAME match — resolveOversForNrr() below is evaluated independently
//   per team for exactly this reason, never as one shared match-level
//   decision.
//
//   This needs real ball-by-ball data (`balls.is_wicket` count, plus
//   legal-delivery count) to know which case applies. Where a
//   bracket_match is linked to a real scored match (overlay_match_id ->
//   matches.id), getMatchBallsSummary() pulls that from `balls`. Where
//   it isn't linked (a bracket result entered manually, with no
//   ball-by-ball data behind it), there's no way to know whether either
//   team was bowled out, so it falls back to assuming the full overs
//   quota for both sides (matches.match_setup.overs, defaulting to 20) —
//   the same number the all-out rule would produce anyway, just applied
//   without being able to verify it, so it undercounts NRR for any team
//   that actually finished a chase early without ball data to prove it.
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
// WHEN TO CALL recomputeStandingsForTournament:
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
//
// getMatchNrrBreakdownForTournament, by contrast, IS read-only and safe
// to call on every page load — it's a plain SELECT + in-memory grouping,
// no writes, called from getPointsTableForTournament() in tournament.ts.

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

interface TeamBallsSummary {
  legalBalls: number
  wickets: number
}

/**
 * Per-team legal (non-wide, non-no-ball) delivery count AND wicket count
 * for a single match, from `balls`. Both are needed to apply the real ICC
 * NRR rule correctly — see resolveOversForNrr below, which is where
 * legalBalls vs. wickets actually gets turned into "overs faced for NRR
 * purposes."
 *
 * Exported so getMatchNrrBreakdownForTournament (below) can reuse the
 * exact same per-match numbers the aggregate standings computation uses,
 * rather than re-deriving them differently.
 */
export async function getMatchBallsSummary(matchId: string): Promise<Map<string, TeamBallsSummary>> {
  const { data, error } = await supabase
    .from("balls")
    .select("batting_team_id, extra_type, is_wicket")
    .eq("match_id", matchId)

  if (error) {
    console.error(`[standings] balls lookup failed for match ${matchId}:`, error.message)
    return new Map()
  }

  const summaryByTeam = new Map<string, TeamBallsSummary>()
  for (const row of data ?? []) {
    if (!row.batting_team_id) continue
    if (!summaryByTeam.has(row.batting_team_id)) {
      summaryByTeam.set(row.batting_team_id, { legalBalls: 0, wickets: 0 })
    }
    const s = summaryByTeam.get(row.batting_team_id)!

    const isLegal = row.extra_type !== "wide" && row.extra_type !== "no_ball"
    if (isLegal) s.legalBalls += 1

    // Every dismissal counts toward "all out," including run-outs — a
    // team is bowled out at 10 wickets down regardless of dismissal type.
    if (row.is_wicket) s.wickets += 1
  }
  return summaryByTeam
}

/**
 * THE ICC NRR RULE, applied exactly:
 *   - If the team was all out (10 wickets down) before using their full
 *     overs quota, their overs-faced for NRR purposes is the FULL quota
 *     (e.g. 20.0 overs in a T20), not the actual balls it took to lose
 *     the 10th wicket. This stops a team boosting its own NRR by batting
 *     slowly, and stops a fast collapse from unfairly tanking NRR further
 *     than the runs conceded already do.
 *   - Otherwise (overs completed normally, or the innings ended early
 *     because a chase was completed / target reached), overs-faced is the
 *     ACTUAL legal balls faced. A team finishing a chase in fewer overs
 *     is correctly rewarded with a better NRR for doing so.
 *
 * This must be evaluated per team per innings, independently — one team
 * can be bowled out while the other successfully chases, in the same
 * match, and each side's overs-for-NRR is resolved by its own outcome,
 * not a shared match-level flag.
 *
 * Exported for reuse by getMatchNrrBreakdownForTournament.
 */
export function resolveOversForNrr(summary: TeamBallsSummary | undefined, oversLimitBalls: number): number {
  if (!summary) return oversLimitBalls // no ball data at all — full-quota fallback
  if (summary.wickets >= 10) return oversLimitBalls // all out -> full quota, per ICC rule
  return summary.legalBalls // otherwise -> actual balls faced (chase completed, or overs played out)
}

/**
 * Falls back to a full-overs assumption when there's no ball-by-ball
 * data behind a bracket result. Reads matches.match_setup.overs via the
 * overlay_match_id if present (even without balls rows), else defaults
 * to 20-over matches — matching the same default used throughout
 * data/match-data.ts (`setup.overs ?? 20`).
 *
 * Exported for reuse by getMatchNrrBreakdownForTournament.
 */
export async function getOversLimit(overlayMatchId: string | null): Promise<number> {
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

    // ── balls faced/bowled for NRR, per the exact ICC all-out rule ──
    const oversLimitBalls = (await getOversLimit(m.overlay_match_id)) * 6

    let aSummary: TeamBallsSummary | undefined
    let bSummary: TeamBallsSummary | undefined
    if (m.overlay_match_id) {
      const summaryByTeam = await getMatchBallsSummary(m.overlay_match_id)
      aSummary = summaryByTeam.get(m.team_a_id)
      bSummary = summaryByTeam.get(m.team_b_id)
    }

    // Each team's overs-for-NRR is resolved independently — one side can
    // be bowled out (-> full quota) while the other chased successfully
    // (-> actual balls), in the very same match.
    const aOversForNrr = resolveOversForNrr(aSummary, oversLimitBalls)
    const bOversForNrr = resolveOversForNrr(bSummary, oversLimitBalls)

    a.ballsFaced += aOversForNrr
    b.ballsFaced += bOversForNrr
    // one team's balls faced batting = the other team's balls bowled
    a.ballsBowled += bOversForNrr
    b.ballsBowled += aOversForNrr

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
      form: agg.formSeq,
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

// ─────────────────────────────────────────────────────────────
// PER-MATCH NRR BREAKDOWN — read-only, safe to call on every page load.
// Returns the exact runs/overs inputs each team's aggregate NRR was
// built from, one row per completed match, so the public page's
// "how was this calculated" overlay can show match-by-match figures
// instead of just the final summed number.
// ─────────────────────────────────────────────────────────────

export interface MatchNrrBreakdownRow {
  matchId: string
  opponent: string
  result: "W" | "L" | "T"
  runsScored: number
  oversFaced: number // decimal overs, e.g. 18.4 — for display only
  runsConceded: number
  oversBowled: number // decimal overs, e.g. 20.0 — for display only
}

/**
 * Per-match NRR inputs for every team in a tournament, keyed by team_id.
 * Mirrors the aggregation loop in recomputeStandingsForTournament exactly
 * (same getOversLimit / getMatchBallsSummary / resolveOversForNrr calls),
 * but keeps one row per match instead of summing.
 *
 * IMPORTANT: this does NOT compute a "per-match NRR." The real ICC NRR is
 * (sum of runs scored / sum of overs faced) − (sum of runs conceded / sum
 * of overs bowled), taken once across ALL matches — a per-match rate
 * doesn't compose into that total the way people expect, and would be
 * misleading to show as if it were "this match's NRR contribution." What
 * this returns instead is the raw runs/overs each match contributed to
 * those two sums, so a reader can verify the final total themselves.
 */
export async function getMatchNrrBreakdownForTournament(
  tournamentId: string
): Promise<Map<string, MatchNrrBreakdownRow[]>> {
  const { data: matches, error } = await supabase
    .from("bracket_matches")
    .select(
      `
      id, round, team_a_id, team_b_id, score_a, score_b, winner_team_id, overlay_match_id,
      team_a:team_a_id ( name ),
      team_b:team_b_id ( name )
      `
    )
    .eq("tournament_id", tournamentId)
    .eq("status", "completed")
    .not("team_a_id", "is", null)
    .not("team_b_id", "is", null)
    .not("score_a", "is", null)
    .not("score_b", "is", null)
    .order("round", { ascending: true })

  if (error) {
    console.error("[standings] breakdown bracket_matches lookup failed:", error.message)
    return new Map()
  }

  const breakdown = new Map<string, MatchNrrBreakdownRow[]>()
  const push = (teamId: string, row: MatchNrrBreakdownRow) => {
    if (!breakdown.has(teamId)) breakdown.set(teamId, [])
    breakdown.get(teamId)!.push(row)
  }

  const toOvers = (balls: number) => Math.round((balls / 6) * 10) / 10

  for (const m of (matches ?? []) as any[]) {
    const teamA = Array.isArray(m.team_a) ? m.team_a[0] : m.team_a
    const teamB = Array.isArray(m.team_b) ? m.team_b[0] : m.team_b

    const oversLimitBalls = (await getOversLimit(m.overlay_match_id)) * 6

    let aSummary: TeamBallsSummary | undefined
    let bSummary: TeamBallsSummary | undefined
    if (m.overlay_match_id) {
      const summaryByTeam = await getMatchBallsSummary(m.overlay_match_id)
      aSummary = summaryByTeam.get(m.team_a_id)
      bSummary = summaryByTeam.get(m.team_b_id)
    }

    const aBalls = resolveOversForNrr(aSummary, oversLimitBalls)
    const bBalls = resolveOversForNrr(bSummary, oversLimitBalls)

    const resultFor = (teamId: string): "W" | "L" | "T" =>
      !m.winner_team_id ? "T" : m.winner_team_id === teamId ? "W" : "L"

    push(m.team_a_id, {
      matchId: m.id,
      opponent: teamB?.name ?? "Unknown",
      result: resultFor(m.team_a_id),
      runsScored: m.score_a,
      oversFaced: toOvers(aBalls),
      runsConceded: m.score_b,
      oversBowled: toOvers(bBalls),
    })
    push(m.team_b_id, {
      matchId: m.id,
      opponent: teamA?.name ?? "Unknown",
      result: resultFor(m.team_b_id),
      runsScored: m.score_b,
      oversFaced: toOvers(bBalls),
      runsConceded: m.score_a,
      oversBowled: toOvers(aBalls),
    })
  }

  return breakdown
}