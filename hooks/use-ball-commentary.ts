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
  /** Only fire generation while this is true — e.g. `live` from the match page. */
  enabled: boolean
}

const key = (over: number, ball: number) => `${over}.${ball}`

// ── Pacing / token-safety knobs ──────────────────────────────────
const TICK_MS = 5_000
const MIN_INTERVAL_MS = 45_000
const MAX_BATCH_SIZE = 6
const RECENT_CONTEXT_LINES = 5
const RATE_LIMIT_BACKOFF_MS = 10 * 60_000
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

  // Balls the DB says are permanently failed OR currently claimed by
  // *someone* (possibly this device, possibly another). Shared truth
  // read from the DB / Realtime / poll — never a local-only guess.
  const [unavailableKeys, setUnavailableKeys] = useState<Set<string>>(new Set())

  const requestInFlight = useRef(false)
  const lastFiredAt = useRef(0)
  const rateLimitedUntil = useRef(0)

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
      setUnavailableKeys((prev) => {
        if (!prev.has(k)) return prev
        const next = new Set(prev)
        next.delete(k)
        return next
      })
    } else {
      // 'pending' (claimed, by us or another request) or 'failed'
      // (permanently gave up) — either way, nobody should re-send it.
      setUnavailableKeys((prev) => (prev.has(k) ? prev : new Set(prev).add(k)))
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
    setUnavailableKeys((prev) => {
      if (!prev.has(k)) return prev
      const next = new Set(prev)
      next.delete(k)
      return next
    })
  }, [])

  // Load whatever's already cached/claimed/failed for this match/innings.
  // Read-only SELECT — the only kind of query the browser client is
  // allowed to run against this table.
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
      const unavailable = new Set<string>()
      for (const row of (data ?? []) as CommentaryRow[]) {
        const k = key(row.over, row.ball)
        if (row.status === "ready" && row.text) {
          ready.set(k, row.text)
          order.push(k)
        } else {
          unavailable.add(k)
        }
      }
      setByKey(ready)
      orderedKeys.current = order
      setUnavailableKeys(unavailable)
      lastFiredAt.current = 0
      rateLimitedUntil.current = 0
    }
    load()
    return () => {
      cancelled = true
    }
  }, [matchId, inningsNumber])

  // ── Realtime sync ──
  // Requires `ball_commentary` to be added to the `supabase_realtime`
  // publication and to have a SELECT policy Realtime can evaluate — see
  // the SQL block above. If devices ever show diverging "AI Commentary"
  // vs "Match Data" for the SAME ball again, check that first.
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

  // ── Reconciliation poll (belt-and-suspenders) ──
  // Self-heals a device that missed a Realtime event. Read-only, and
  // skips entirely when nothing is outstanding.
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
  // Sends CANDIDATE balls to /api/commentary/generate, which does the
  // atomic claim itself server-side (service role, bypasses RLS). This
  // client never writes to ball_commentary directly — no browser-role
  // write policy exists for this table, by design.
  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(async () => {
      if (requestInFlight.current) return
      if (Date.now() < rateLimitedUntil.current) return
      const now = Date.now()
      if (now - lastFiredAt.current < MIN_INTERVAL_MS) return

      // Candidates: balls we have delivery data for, that aren't ready
      // and aren't already known claimed/failed. Newest first, so a
      // device opening mid-match prioritizes the live edge over
      // backfilling historical balls in one burst.
      const candidates = [...deliveries]
        .filter((d) => {
          const k = key(d.over, d.ball)
          return !byKey.has(k) && !unavailableKeys.has(k)
        })
        .sort((a, b) => b.over - a.over || b.ball - a.ball)
        .slice(0, MAX_CLAIM_CANDIDATES_PER_TICK)

      if (candidates.length === 0) return

      lastFiredAt.current = now
      requestInFlight.current = true

      // Optimistically mark these as unavailable so this device's own
      // next tick doesn't re-send them while this request is in flight.
      // Realtime/the poll corrects this if the server ends up not
      // claiming some of them (lost a race to another device).
      setUnavailableKeys((prev) => {
        const next = new Set(prev)
        for (const d of candidates) next.add(key(d.over, d.ball))
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
        const json: { commentary?: CommentaryLine[]; error?: string; detail?: string; code?: string } = await res.json()

        if (json.error) {
          console.error("[useBallCommentary] generate failed:", json.error, json.detail)
          if (json.code === "rate_limit_exceeded") {
            rateLimitedUntil.current = Date.now() + RATE_LIMIT_BACKOFF_MS
          }
          // The server already wrote status:'failed' for any balls it
          // claimed but couldn't generate for. Realtime/the poll will
          // deliver that and every device converges on the fallback —
          // no local retry needed.
          return
        }

        // Merge whatever came back (belt-and-suspenders — Realtime
        // should also deliver these, but this avoids waiting on it).
        for (const c of json.commentary ?? []) {
          mergeRow({ over: c.over, ball: c.ball, text: c.text, status: "ready" })
        }
      } catch (err) {
        console.error("[useBallCommentary] request failed:", err)
        // Pure network failure — we don't know if the server's claim
        // step even ran. Don't hold these keys unavailable forever on
        // faith; let the reconciliation poll and next enqueue pass sort
        // out the true DB state shortly.
        setUnavailableKeys((prev) => {
          const next = new Set(prev)
          for (const d of candidates) next.delete(key(d.over, d.ball))
          return next
        })
      } finally {
        requestInFlight.current = false
      }
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [enabled, byKey, unavailableKeys, deliveries, mergeRow])

  return {
    getText: useCallback((over: number, ball: number) => byKey.get(key(over, ball)), [byKey]),
    isGeneratingOver: useCallback(
      (over: number) =>
        deliveries.some(
          (d) => d.over === over && unavailableKeys.has(key(d.over, d.ball)) && !byKey.has(key(d.over, d.ball)),
        ),
      [deliveries, unavailableKeys, byKey],
    ),
  }
}