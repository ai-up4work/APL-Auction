// hooks/use-live-match.ts
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { supabaseBrowser as supabase } from "@/lib/matches/supabase-browser"
import { aggregateInnings, parseMatchSetup, buildSquads, type BallRow } from "@/lib/matches/cricket-engine"
import { buildLiveScriptFromBalls } from "@/lib/matches/win-probability"
import type { MatchDetail, MatchStatus, MatchTeamRef } from "@/data/match-data"

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

export function useLiveMatch(matchId: string, initialMatch: MatchDetail) {
  const [match, setMatch] = useState<LiveMatchDetail>({ ...initialMatch, liveScript: [] })
  const [isSyncing, setIsSyncing] = useState(false)
  const [channelStatus, setChannelStatus] = useState<string>("connecting")
  const teamAFallback = useRef(initialMatch.teamA)
  const teamBFallback = useRef(initialMatch.teamB)

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

      // Explicit — mirrors the same logic used server-side in
      // getMatchDetailById, so the two never disagree about which
      // innings is in progress. If the row predates this field, fall
      // back to a best-effort guess rather than treating it as fact.
      const currentInnings: 1 | 2 = setup.currentInnings ?? (hasBallData ? 2 : 1)

      // If no balls have landed for innings 2 yet, don't reset it — this
      // clears fully once `handleClear` on the simulate page wipes the
      // `balls` table, at which point innings2Balls will legitimately be
      // empty and hasBallData will be false too.
      const liveScript = buildLiveScriptFromBalls(innings2Balls, target, oversLimit)
      const last = liveScript[liveScript.length - 1]
      const winProb = last ? { a: last.wpA, b: last.wpB } : undefined

      setMatch((prev) => ({
        ...prev,
        venue: setup.venue || bracketRow?.venue || prev.venue,
        target,
        teamA,
        teamB,
        innings1,
        innings2Final: innings2Agg,
        innings2Partial: {
          runsAtStart: 0,
          wktsAtStart: 0,
          overAtStart: "0.0",
          overRunsAtStart: [],
          over19ExtraRuns: 0,
          batting: innings2Agg.batting,
          bowling: innings2Agg.bowling,
          fow: innings2Agg.fow,
        },
        squads: setup.squads ? buildSquads(setup, teamA.name, teamB.name) : prev.squads,
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

  return { match, isSyncing, channelStatus }
}