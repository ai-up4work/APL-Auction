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

  // Balls the DB says are either currently claimed (pending, by anyone)
  // or permanently failed. Either way: don't send them again. This is
  // the ENTIRE retry policy — once a key lands here via a 'failed'
  // status, it never leaves except on a fresh load()/new match.
  const [unavailableKeys, setUnavailableKeys] = useState<Set<string>>(new Set())

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
      setUnavailableKeys((prev) => {
        if (!prev.has(k)) return prev
        const next = new Set(prev)
        next.delete(k)
        return next
      })
    } else {
      // 'pending' or 'failed' — either way, stop trying it.
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
  // Sends candidate balls to /api/commentary/generate, which claims
  // them atomically server-side. One attempt per ball, ever — success
  // marks 'ready', any failure marks 'failed', and this hook never
  // reconsiders a ball once it's in unavailableKeys, short of a full
  // reload (new match/innings mount).
  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(async () => {
      if (requestInFlight.current) return
      const now = Date.now()
      if (now - lastFiredAt.current < MIN_INTERVAL_MS) return

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

      // Mark these unavailable immediately — win or lose, success or
      // failure, we don't touch them again from this hook.
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
        const json: { commentary?: CommentaryLine[]; error?: string; detail?: string } = await res.json()

        if (json.error) {
          // Server already wrote status:'failed' for these balls. We do
          // nothing further here — Realtime/poll confirms it, and since
          // it's already in unavailableKeys, the UI is already showing
          // the fallback. No retry, no backoff, no bookkeeping.
          console.error("[useBallCommentary] generate failed (permanent, no retry):", json.error, json.detail)
          return
        }

        for (const c of json.commentary ?? []) {
          mergeRow({ over: c.over, ball: c.ball, text: c.text, status: "ready" })
        }
      } catch (err) {
        // Couldn't even reach our own API route. The server-side claim
        // may or may not have happened — either way we don't retry from
        // here. If a claim row exists, the poll will pick up whatever
        // status it eventually settles at (most likely 'failed', since
        // the route fails its own requests closed). We just leave this
        // ball in unavailableKeys and move on.
        console.error("[useBallCommentary] request failed (permanent, no retry):", err)
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