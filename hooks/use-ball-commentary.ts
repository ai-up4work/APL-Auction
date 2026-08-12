// app/hooks/use-ball-commentary.ts
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { supabaseBrowser as supabase } from "@/lib/matches/supabase-browser"
import type { DeliveryEntry } from "@/data/match-data"

export interface CommentaryLine {
  over: number
  ball: number
  text: string
}

interface UseBallCommentaryArgs {
  matchId: string
  inningsNumber: 1 | 2
  deliveries: DeliveryEntry[]
  teamBatting: string
  teamBowling: string
  target?: number
  scoreState: { total: number; wkts: number; oversLabel: string; crr: string; rrr: string | null }
  striker?: { name: string; runs: number; balls: number }
  nonStriker?: { name: string; runs: number; balls: number }
  bowlerFigures?: { name: string; overs: string; runs: number; wkts: number }
  enabled: boolean
}

const key = (over: number, ball: number) => `${over}.${ball}`

const TICK_MS = 5_000
const MIN_INTERVAL_MS = 45_000
const MAX_BATCH_SIZE = 6
const RECENT_CONTEXT_LINES = 5
const MAX_CLAIM_CANDIDATES_PER_TICK = MAX_BATCH_SIZE
const RECONCILE_POLL_MS = 20_000

type DbStatus = "pending" | "ready" | "failed"
interface CommentaryRow {
  over: number
  ball: number
  text: string | null
  status: DbStatus
}

export function useBallCommentary({
  matchId,
  inningsNumber,
  deliveries,
  teamBatting,
  teamBowling,
  target,
  scoreState,
  striker,
  nonStriker,
  bowlerFigures,
  enabled,
}: UseBallCommentaryArgs) {
  const [byKey, setByKey] = useState<Map<string, string>>(new Map())
  const orderedKeys = useRef<string[]>([])

  // Status per ball key, for every ball that ISN'T ready-with-text.
  // This is the fix: 'pending' (claimed, generation in flight — show
  // "Writing commentary…") and 'failed' (permanently gave up — show
  // the phrase-bank fallback immediately) used to be lumped into one
  // flat "unavailable" set, which made isGeneratingOver report `true`
  // for failed balls forever, so the UI never fell through to the
  // fallback text. Splitting them by actual status fixes that.
  const [statusByKey, setStatusByKey] = useState<Map<string, "pending" | "failed">>(new Map())

  const requestInFlight = useRef(false)
  const lastFiredAt = useRef(0)

  const contextRef = useRef({
    matchId, inningsNumber, teamBatting, teamBowling, target, scoreState, striker, nonStriker, bowlerFigures,
  })
  useEffect(() => {
    contextRef.current = {
      matchId, inningsNumber, teamBatting, teamBowling, target, scoreState, striker, nonStriker, bowlerFigures,
    }
  }, [matchId, inningsNumber, teamBatting, teamBowling, target, scoreState, striker, nonStriker, bowlerFigures])

  const mergeRow = useCallback((row: CommentaryRow) => {
    const k = key(row.over, row.ball)
    if (row.status === "ready" && row.text) {
      setByKey((prev) => {
        if (prev.get(k) === row.text) return prev
        const next = new Map(prev)
        if (!next.has(k)) orderedKeys.current.push(k)
        next.set(k, row.text!)
        return next
      })
      setStatusByKey((prev) => {
        if (!prev.has(k)) return prev
        const next = new Map(prev)
        next.delete(k)
        return next
      })
    } else {
      // 'pending' or 'failed' — record which, so isGeneratingOver can
      // tell them apart.
      setStatusByKey((prev) => {
        if (prev.get(k) === row.status) return prev
        const next = new Map(prev)
        next.set(k, row.status as "pending" | "failed")
        return next
      })
    }
  }, [])

  const removeRow = useCallback((over: number, ball: number) => {
    const k = key(over, ball)
    setByKey((prev) => {
      if (!prev.has(k)) return prev
      const next = new Map(prev)
      next.delete(k)
      return next
    })
    orderedKeys.current = orderedKeys.current.filter((existing) => existing !== k)
    setStatusByKey((prev) => {
      if (!prev.has(k)) return prev
      const next = new Map(prev)
      next.delete(k)
      return next
    })
  }, [])

  // Load whatever's already cached/claimed/failed for this match/innings.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from("ball_commentary")
        .select("over, ball, text, status")
        .eq("match_id", matchId)
        .eq("innings_number", inningsNumber)
        .order("over", { ascending: true })
        .order("ball", { ascending: true })

      if (error) {
        console.error("[useBallCommentary] load failed:", error.message)
        return
      }
      if (cancelled) return

      const ready = new Map<string, string>()
      const order: string[] = []
      const status = new Map<string, "pending" | "failed">()
      for (const row of (data ?? []) as CommentaryRow[]) {
        const k = key(row.over, row.ball)
        if (row.status === "ready" && row.text) {
          ready.set(k, row.text)
          order.push(k)
        } else {
          status.set(k, row.status as "pending" | "failed")
        }
      }
      setByKey(ready)
      orderedKeys.current = order
      setStatusByKey(status)
      lastFiredAt.current = 0
    }
    load()
    return () => {
      cancelled = true
    }
  }, [matchId, inningsNumber])

  // ── Realtime sync ──
  useEffect(() => {
    if (!matchId) return

    const channel = supabase
      .channel(`ball_commentary:${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ball_commentary", filter: `match_id=eq.${matchId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { innings_number?: number; over?: number; ball?: number } | null
            if (!old || old.innings_number !== inningsNumber || old.over == null || old.ball == null) return
            removeRow(old.over, old.ball)
            return
          }
          const row = payload.new as (CommentaryRow & { innings_number: number }) | null
          if (!row || row.innings_number !== inningsNumber) return
          mergeRow(row)
        },
      )
      .subscribe((status, err) => {
        console.log(`[useBallCommentary] channel status for match ${matchId} innings ${inningsNumber}:`, status, err ?? "")
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId, inningsNumber, mergeRow, removeRow])

  // ── Reconciliation poll (belt-and-suspenders for missed Realtime events) ──
  useEffect(() => {
    if (!matchId) return

    const reconcile = async () => {
      const outstandingOvers = [
        ...new Set(deliveries.filter((d) => !byKey.has(key(d.over, d.ball))).map((d) => d.over)),
      ]
      if (outstandingOvers.length === 0) return

      const { data, error } = await supabase
        .from("ball_commentary")
        .select("over, ball, text, status")
        .eq("match_id", matchId)
        .eq("innings_number", inningsNumber)
        .in("over", outstandingOvers)

      if (error) {
        console.error("[useBallCommentary] reconcile poll failed:", error.message)
        return
      }
      for (const row of (data ?? []) as CommentaryRow[]) mergeRow(row)
    }

    const pollInterval = setInterval(reconcile, RECONCILE_POLL_MS)
    return () => clearInterval(pollInterval)
  }, [matchId, inningsNumber, deliveries, byKey, mergeRow])

  // ── Scheduler ──
  // One attempt per ball, ever. Success -> 'ready'. Any failure ->
  // 'failed', permanently, no retry. See generate route for the
  // markFailed policy.
  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(async () => {
      if (requestInFlight.current) return
      const now = Date.now()
      if (now - lastFiredAt.current < MIN_INTERVAL_MS) return

      const candidates = [...deliveries]
        .filter((d) => {
          const k = key(d.over, d.ball)
          return !byKey.has(k) && !statusByKey.has(k)
        })
        .sort((a, b) => b.over - a.over || b.ball - a.ball)
        .slice(0, MAX_CLAIM_CANDIDATES_PER_TICK)

      if (candidates.length === 0) return

      lastFiredAt.current = now
      requestInFlight.current = true

      // Optimistically mark these 'pending' locally so this device's
      // own next tick doesn't re-send them while in flight.
      setStatusByKey((prev) => {
        const next = new Map(prev)
        for (const d of candidates) next.set(key(d.over, d.ball), "pending")
        return next
      })

      try {
        const ctx = contextRef.current
        const recentCommentary = orderedKeys.current
          .slice(-RECENT_CONTEXT_LINES)
          .map((k) => byKey.get(k))
          .filter((t): t is string => !!t)

        const res = await fetch("/api/commentary/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId: ctx.matchId,
            inningsNumber: ctx.inningsNumber,
            teamBatting: ctx.teamBatting,
            teamBowling: ctx.teamBowling,
            target: ctx.target,
            scoreState: ctx.scoreState,
            striker: ctx.striker,
            nonStriker: ctx.nonStriker,
            bowlerFigures: ctx.bowlerFigures,
            recentCommentary,
            deliveries: candidates.map((d) => ({
              over: d.over,
              ball: d.ball,
              runs: d.runs,
              extraType: d.extraType,
              isWicket: d.isWicket,
              striker: d.striker,
              nonStriker: d.nonStriker,
              bowler: d.bowler,
              dismissalType: d.dismissalType,
              batsmanOut: d.batsmanOut,
              fielder: d.fielder,
            })),
          }),
        })
        const json: { commentary?: CommentaryLine[]; error?: string; detail?: string } = await res.json()

        if (json.error) {
          console.error("[useBallCommentary] generate failed (permanent, no retry):", json.error, json.detail)
          // The server already wrote status:'failed' to the DB for
          // these balls. Mark them failed locally right away too,
          // instead of waiting on Realtime/poll — this is the actual
          // fix for "Writing commentary…" sticking forever: these keys
          // must flip from 'pending' to 'failed' so isGeneratingOver
          // stops reporting them as in-progress.
          setStatusByKey((prev) => {
            const next = new Map(prev)
            for (const d of candidates) next.set(key(d.over, d.ball), "failed")
            return next
          })
          return
        }

        for (const c of json.commentary ?? []) {
          mergeRow({ over: c.over, ball: c.ball, text: c.text, status: "ready" })
        }
        // Anything in this batch NOT present in the response (server's
        // `missing` — model skipped it) also needs to flip to failed
        // locally; Realtime/poll will confirm shortly, but don't leave
        // it reporting 'pending' in the meantime.
        const returnedKeys = new Set((json.commentary ?? []).map((c) => key(c.over, c.ball)))
        const unresolved = candidates.filter((d) => !returnedKeys.has(key(d.over, d.ball)))
        if (unresolved.length > 0) {
          setStatusByKey((prev) => {
            const next = new Map(prev)
            for (const d of unresolved) next.set(key(d.over, d.ball), "failed")
            return next
          })
        }
      } catch (err) {
        console.error("[useBallCommentary] request failed (permanent, no retry):", err)
        // Same reasoning — flip locally to failed so the UI stops
        // showing "Writing commentary…" for these even though we don't
        // know for certain the server-side claim resolved cleanly.
        setStatusByKey((prev) => {
          const next = new Map(prev)
          for (const d of candidates) next.set(key(d.over, d.ball), "failed")
          return next
        })
      } finally {
        requestInFlight.current = false
      }
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [enabled, byKey, statusByKey, deliveries, mergeRow])

  return {
    getText: useCallback((over: number, ball: number) => byKey.get(key(over, ball)), [byKey]),
    // Only 'pending' balls count as generating. 'failed' balls are NOT
    // pending — MatchTabs should immediately fall through to
    // generateCommentaryText() for them, showing "Match Data" instead
    // of hanging on "Writing commentary…" indefinitely.
    isGeneratingOver: useCallback(
      (over: number) => deliveries.some((d) => d.over === over && statusByKey.get(key(d.over, d.ball)) === "pending"),
      [deliveries, statusByKey],
    ),
  }
}