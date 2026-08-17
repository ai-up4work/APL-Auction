// hooks/use-live-match.ts
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { supabaseBrowser as supabase } from "@/lib/matches/supabase-browser"
import { aggregateInnings, parseMatchSetup, buildSquads, type BallRow } from "@/lib/matches/cricket-engine"
import { buildFullMatchLiveScript } from "@/lib/matches/win-probability"
import { getSquadsByTeamIds } from "@/lib/tournament/tournament"
import type { Squad } from "@/data/tournament-data"
import type { MatchDetail, MatchStatus, MatchTeamRef, MatchSquad, DeliveryEntry } from "@/data/match-data"

export interface LiveScriptStep {
  ball: string
  wpA: number
  wpB: number
}

export type LiveMatchDetail = MatchDetail & { liveScript: LiveScriptStep[] }

interface BracketRow {
  id: string
  team_a_id: string | null
  team_b_id: string | null
  venue: string | null
  status: "upcoming" | "live" | "completed"
}

interface TeamRow {
  id: string
  name: string
  code: string
  logo: string | null
  color: string
}

/** Raw ball rows (already fetched for aggregation) -> the lightweight
 *  DeliveryEntry log the Overs/Commentary tabs render. Built locally
 *  here rather than inside `aggregateInnings` (from
 *  lib/matches/cricket-engine) so this stays additive without needing
 *  to touch that shared engine — every field it needs (over_number,
 *  ball_number, runs, extra_type, is_wicket, striker/non-striker/bowler
 *  names, dismissal detail) is already present on the BallRow[] this
 *  hook fetches. Carrying player names through is what lets the Groq
 *  commentary generator (hooks/use-ball-commentary.ts) say "Kumar
 *  strikes, castles Sharma" instead of just "a wicket fell". */
function toDeliveries(balls: BallRow[]): DeliveryEntry[] {
  return [...balls]
    .sort((a, b) => a.sequence - b.sequence)
    .map((b) => ({
      over: b.over_number,
      ball: b.ball_number,
      runs: b.runs,
      extraType: b.extra_type,
      isWicket: b.is_wicket,
      striker: b.striker_name,
      nonStriker: b.non_striker_name,
      bowler: b.bowler_name,
      dismissalType: b.dismissal_type,
      batsmanOut: b.batsman_out,
      fielder: b.fielder,
    }))
}

/**
 * Squad (tournament-detail shape, from getSquadsByTeamIds) -> MatchSquad
 * (this app's match-detail shape). Mirrors squadToMatchSquad in
 * data/match-data.ts exactly, so a bracket-linked match's squads look
 * identical whether they came from the initial server render
 * (getMatchDetailById) or from this hook's live refresh — see the
 * SQUAD RESOLUTION note in data/match-data.ts for why the two need to
 * agree. There's no playing-XI concept at the teams/players source
 * level, so every rostered player is marked xi: true, same as the
 * server-side conversion.
 */
function squadToMatchSquad(s: Squad): MatchSquad {
  return {
    team: s.team,
    captain: s.captain,
    players: (s.players ?? []).map((p) => ({
      name: p.name,
      role: p.role ?? "",
      xi: true,
      img: p.image,
    })),
  }
}

export function useLiveMatch(matchId: string, initialMatch: MatchDetail) {
  const [match, setMatch] = useState<LiveMatchDetail>({ ...initialMatch, liveScript: [] })
  const [isSyncing, setIsSyncing] = useState(false)
  const [channelStatus, setChannelStatus] = useState<string>("connecting")
  const teamAFallback = useRef(initialMatch.teamA)
  const teamBFallback = useRef(initialMatch.teamB)

  // Map of player name -> img, built once from the server-fetched squads
  // (initialMatch.squads). The old match_setup-based buildSquads() below
  // doesn't carry player images, so this lookup is used to patch images
  // back in on that fallback path rather than losing them the moment any
  // live data comes in. Not needed on the getSquadsByTeamIds path, since
  // that source already carries real photos directly.
  const playerImgByName = useRef(
    new Map(
      initialMatch.squads.flatMap((s) => s.players.map((p) => [p.name, (p as any).img] as const))
    )
  )

  // ── MATCH-END NOTIFICATION ──
  // Tracks the previously-seen matchStatus so we can detect the exact
  // refresh() call where it flips into "completed" and fire the in-app
  // toast exactly once. Seeded from initialMatch.matchStatus (the
  // server-rendered value) rather than null, so a page load of a match
  // that was ALREADY completed before this visitor arrived does NOT
  // show the toast — only a live transition witnessed during this
  // session does.
  const prevStatusRef = useRef<MatchStatus | null>(initialMatch.matchStatus ?? null)
  const [justCompleted, setJustCompleted] = useState(false)

  const refresh = useCallback(async () => {
    setIsSyncing(true)
    try {
      const { data: matchRow, error: matchRowErr } = await supabase
        .from("matches")
        .select("match_setup")
        .eq("id", matchId)
        .maybeSingle()

      if (matchRowErr) {
        console.error("[useLiveMatch] matches select failed:", matchRowErr.message)
        return
      }
      if (!matchRow) {
        console.warn("[useLiveMatch] no matches row for id:", matchId, "— either wrong id or RLS is hiding it")
        return
      }

      const setup = parseMatchSetup(matchRow.match_setup)
      if (!setup) {
        console.warn("[useLiveMatch] match_setup failed to parse:", matchRow.match_setup)
        return
      }

      const { data: bracketRow, error: bracketErr } = await supabase
        .from("bracket_matches")
        .select("id, team_a_id, team_b_id, venue, status")
        .eq("overlay_match_id", matchId)
        .maybeSingle<BracketRow>()

      if (bracketErr) {
        console.error("[useLiveMatch] bracket_matches select failed:", bracketErr.message)
      }

      let teamA: MatchTeamRef = teamAFallback.current
      let teamB: MatchTeamRef = teamBFallback.current

      if (bracketRow?.team_a_id && bracketRow?.team_b_id) {
        const { data: teamRows, error: teamsErr } = await supabase
          .from("teams")
          .select("id, name, code, logo, color")
          .in("id", [bracketRow.team_a_id, bracketRow.team_b_id])

        if (teamsErr) {
          console.error("[useLiveMatch] teams select failed:", teamsErr.message)
        }

        const a = teamRows?.find((t) => t.id === bracketRow.team_a_id) as TeamRow | undefined
        const b = teamRows?.find((t) => t.id === bracketRow.team_b_id) as TeamRow | undefined
        if (a && b) {
          teamA = { id: a.id, name: a.name, short: a.code, logo: a.logo ?? undefined, color: a.color }
          teamB = { id: b.id, name: b.name, short: b.code, logo: b.logo ?? undefined, color: b.color }
        }
      }

      // ── squads: same shared source as getMatchDetailById (server) ──
      // See the SQUAD RESOLUTION note at the top of data/match-data.ts.
      // For a bracket-linked match (real teams.id UUIDs available via
      // bracketRow), pull squads from getSquadsByTeamIds — the EXACT
      // same teams -> players -> rules -> buildSquad pipeline the
      // tournament detail page and the server-rendered initial match
      // both use. This is resolved BEFORE calling setMatch below (it's
      // async), so the eventual state update is atomic — the page never
      // renders an intermediate "Unknown Team" state.
      //
      // Only falls through to the old match_setup.squads-based
      // buildSquads (from lib/matches/cricket-engine) — or, if that has
      // nothing either, to whatever squads were already in state — for
      // standalone matches (no bracket_matches row) or if the shared
      // source hasn't got anything for these teams yet.
      let resolvedSquads: MatchSquad[] | null = null
      if (bracketRow?.team_a_id && bracketRow?.team_b_id) {
        try {
          const tournamentSquads = await getSquadsByTeamIds([bracketRow.team_a_id, bracketRow.team_b_id])
          if (tournamentSquads.length > 0) {
            const squadByTeamName = new Map(tournamentSquads.map((s) => [s.team, s]))
            const teamASquad = squadByTeamName.get(teamA.name)
            const teamBSquad = squadByTeamName.get(teamB.name)
            resolvedSquads = [
              teamASquad ? squadToMatchSquad(teamASquad) : { team: teamA.name, captain: "", players: [] },
              teamBSquad ? squadToMatchSquad(teamBSquad) : { team: teamB.name, captain: "", players: [] },
            ]
          }
        } catch (err) {
          console.error(
            "[useLiveMatch] getSquadsByTeamIds failed:",
            err instanceof Error ? err.message : err
          )
        }
      }

      const { data: ballRows, error: ballsErr } = await supabase
        .from("balls")
        .select(
          "id, match_id, innings_number, sequence, over_number, ball_number, striker_name, non_striker_name, bowler_name, runs, extra_type, is_wicket, dismissal_type, batsman_out, fielder"
        )
        .eq("match_id", matchId)
        .order("sequence", { ascending: true })

      if (ballsErr) {
        console.error("[useLiveMatch] balls select failed:", ballsErr.message)
      }

      const allBalls = (ballRows ?? []) as BallRow[]
      const hasBallData = allBalls.length > 0

      if (allBalls.length === 0) {
        console.log("[useLiveMatch] refresh ran but got 0 ball rows for match:", matchId)
      } else {
        console.log(`[useLiveMatch] refresh got ${allBalls.length} ball rows`)
      }

      const innings1Balls = allBalls.filter((b) => b.innings_number === 1)
      const innings2Balls = allBalls.filter((b) => b.innings_number === 2)

      const innings1 = aggregateInnings(innings1Balls)
      const innings2Agg = aggregateInnings(innings2Balls)

      const target = setup.target ?? innings1.total + 1
      const oversLimit = setup.overs ?? 20
      const [o2, b2] = innings2Agg.overs.split(".").map(Number)
      const innings2LegalBalls = o2 * 6 + b2

      const arithmeticIsLive =
        hasBallData &&
        innings2LegalBalls < oversLimit * 6 &&
        innings2Agg.wkts < 10 &&
        !(innings2Agg.total >= target && target > 0)

      let matchStatus: MatchStatus
      if (bracketRow?.status) {
        matchStatus = bracketRow.status === "live" ? "live" : bracketRow.status === "completed" ? "completed" : "not_started"
      } else if (!hasBallData) {
        matchStatus = "not_started"
      } else {
        matchStatus = arithmeticIsLive ? "live" : "completed"
      }

      // Fires the toast exactly on the transition into "completed" —
      // never on first paint of an already-finished match (see the
      // prevStatusRef seeding comment above), and never more than once
      // per transition even though refresh() keeps firing on every
      // subsequent realtime event while status stays "completed".
      if (
        prevStatusRef.current !== null &&
        prevStatusRef.current !== "completed" &&
        matchStatus === "completed"
      ) {
        setJustCompleted(true)
      }
      prevStatusRef.current = matchStatus

      // Explicit — mirrors the same logic used server-side in
      // getMatchDetailById, so the two never disagree about which
      // innings is in progress.
      const currentInnings: 1 | 2 = setup.currentInnings ?? (hasBallData ? 2 : 1)

      // Full-match timeline: a flat 50/50 line through every legal ball
      // of innings 1 (there's no chase pressure yet, so 50/50 is correct
      // — not "no data"), followed by the real pressure-based curve once
      // innings 2 starts. This is what fixes the graph rendering a
      // single dot instead of a continuous line during the 1st innings.
      const liveScript = buildFullMatchLiveScript(innings1Balls, innings2Balls, target, oversLimit)
      const last = liveScript[liveScript.length - 1]
      const winProb = last ? { a: last.wpA, b: last.wpB } : hasBallData ? { a: 50, b: 50 } : undefined

      setMatch((prev) => ({
        ...prev,
        venue: setup.venue || bracketRow?.venue || prev.venue,
        target,
        teamA,
        teamB,
        resultNote: matchStatus === "completed" ? prev.resultNote || "Match completed" : prev.resultNote,
        innings1: { ...innings1, deliveries: toDeliveries(innings1Balls) },
        innings2Final: { ...innings2Agg, deliveries: toDeliveries(innings2Balls) },
        innings2Partial: {
          runsAtStart: 0,
          wktsAtStart: 0,
          overAtStart: "0.0",
          // Fixed: this used to be hardcoded to [], which meant the
          // Overs and Graphs tabs always saw an empty over-by-over
          // breakdown for a live 2nd innings no matter how many overs
          // had actually been bowled. It now carries the real, currently
          // aggregated per-over runs for innings 2.
          overRunsAtStart: innings2Agg.overRuns,
          over19ExtraRuns: 0,
          batting: innings2Agg.batting,
          bowling: innings2Agg.bowling,
          fow: innings2Agg.fow,
          // Live 2nd-innings ball-by-ball log — see toDeliveries above,
          // and the BALL-BY-BALL DELIVERIES note in data/match-data.ts.
          deliveries: toDeliveries(innings2Balls),
        },
        // See the SQUAD RESOLUTION note above / in data/match-data.ts:
        // resolvedSquads (from getSquadsByTeamIds) wins when it's
        // available for a bracket-linked match. Otherwise fall back to
        // the old match_setup.squads-based engine, patching in photos
        // from the server-rendered squads via playerImgByName — and if
        // there's no match_setup.squads at all, keep whatever squads
        // were already in state instead of clobbering them.
        squads:
          resolvedSquads ??
          (setup.squads
            ? buildSquads(setup, teamA.name, teamB.name).map((s) => ({
                ...s,
                players: s.players.map((p) => ({
                  ...p,
                  img: (p as any).img ?? playerImgByName.current.get(p.name),
                })),
              }))
            : prev.squads),
        matchStatus,
        isLive: matchStatus === "live",
        hasBallData,
        currentInnings,
        winProb,
        liveScript,
      }))
    } finally {
      setIsSyncing(false)
    }
  }, [matchId])

  useEffect(() => {
    refresh()

    const channel = supabase
      .channel(`match-live-${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "balls", filter: `match_id=eq.${matchId}` }, (payload) => {
        console.log("[useLiveMatch] realtime event on balls:", payload.eventType, payload)
        refresh()
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bracket_matches", filter: `overlay_match_id=eq.${matchId}` },
        (payload) => {
          console.log("[useLiveMatch] realtime event on bracket_matches:", payload.eventType, payload)
          refresh()
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, (payload) => {
        console.log("[useLiveMatch] realtime event on matches:", payload.eventType, payload)
        refresh()
      })
      .subscribe((status, err) => {
        console.log(`[useLiveMatch] channel status for match ${matchId}:`, status, err ?? "")
        setChannelStatus(status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId, refresh])

  return {
    match,
    isSyncing,
    channelStatus,
    /** True for the brief window right after this session witnessed the
     *  match flip into "completed". The match page renders <MatchEndToast
     *  show={justCompleted} .../> off this and calls clearJustCompleted
     *  once the toast has been dismissed/timed out. */
    justCompleted,
    clearJustCompleted: useCallback(() => setJustCompleted(false), []),
  }
}