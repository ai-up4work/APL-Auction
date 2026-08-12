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
const MIN_INTERVAL_MS = 45_000
const TICK_MS = 5_000
const MAX_BATCH_SIZE = 6
const RECENT_CONTEXT_LINES = 5
// After this many failed attempts on the same ball, stop retrying it
// and let the UI fall back to the deterministic "Match Data" phrase-bank
// text instead of showing "Writing commentary…" forever.
const MAX_ATTEMPTS_PER_BALL = 2
// How long to pause ALL generation after a rate-limit (esp. daily
// token-quota) error, instead of retrying every tick against a quota
// that's guaranteed to still be dead.
const RATE_LIMIT_BACKOFF_MS = 10 * 60_000

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

  const pendingQueue = useRef<Map<string, DeliveryEntry>>(new Map())
  const requestInFlight = useRef(false)
  const lastFiredAt = useRef(0)

  // Attempts per ball key — used to decide when to stop retrying and
  // fall back to phrase-bank text instead of "Writing commentary…"
  // forever. Cleared whenever a fresh load() runs (new match/innings).
  const attemptCounts = useRef<Map<string, number>>(new Map())
  // Keys we've given up on for now — excluded from both the pending
  // queue and isGeneratingOver, so MatchTabs treats them as "not
  // pending" and shows the deterministic fallback line.
  const [failedKeys, setFailedKeys] = useState<Set<string>>(new Set())

  // Set once a rate-limit error comes back; generation is paused
  // entirely until this time passes, rather than retrying every tick
  // against a quota that's still exhausted.
  const rateLimitedUntil = useRef(0)

  const contextRef = useRef({
    matchId,
    inningsNumber,
    teamBatting,
    teamBowling,
    target,
    scoreState,
    striker,
    nonStriker,
    bowlerFigures,
  })
  useEffect(() => {
    contextRef.current = {
      matchId,
      inningsNumber,
      teamBatting,
      teamBowling,
      target,
      scoreState,
      striker,
      nonStriker,
      bowlerFigures,
    }
  }, [matchId, inningsNumber, teamBatting, teamBowling, target, scoreState, striker, nonStriker, bowlerFigures])

  // Merges a row into local state exactly once, whether it came from the
  // initial load, a Realtime push echoing THIS device's own generate
  // call, or a Realtime push from a completely different device/tab.
  const mergeRow = useCallback((over: number, ball: number, text: string) => {
    const k = key(over, ball)
    setByKey((prev) => {
      if (prev.get(k) === text) return prev // no-op, avoids extra re-renders
      const next = new Map(prev)
      if (!next.has(k)) orderedKeys.current.push(k)
      next.set(k, text)
      return next
    })
    // If another device already generated this ball, drop it from our
    // own pending queue so we don't waste a request re-generating it.
    pendingQueue.current.delete(k)
    attemptCounts.current.delete(k)
    setFailedKeys((prev) => {
      if (!prev.has(k)) return prev
      const next = new Set(prev)
      next.delete(k)
      return next
    })
  }, [])

  // Removes a row locally — fired on a Realtime DELETE (e.g. the
  // Simulator's Reset/Clear wiping ball_commentary for this match).
  const removeRow = useCallback((over: number, ball: number) => {
    const k = key(over, ball)
    setByKey((prev) => {
      if (!prev.has(k)) return prev
      const next = new Map(prev)
      next.delete(k)
      return next
    })
    orderedKeys.current = orderedKeys.current.filter((existing) => existing !== k)
    pendingQueue.current.delete(k)
    attemptCounts.current.delete(k)
    setFailedKeys((prev) => {
      if (!prev.has(k)) return prev
      const next = new Set(prev)
      next.delete(k)
      return next
    })
  }, [])

  // Load whatever's already cached for this match/innings.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from("ball_commentary")
        .select("over, ball, text")
        .eq("match_id", matchId)
        .eq("innings_number", inningsNumber)
        .order("over", { ascending: true })
        .order("ball", { ascending: true })

      if (error) {
        console.error("[useBallCommentary] load failed:", error.message)
        return
      }
      if (cancelled) return
      const map = new Map<string, string>()
      const order: string[] = []
      for (const row of data ?? []) {
        map.set(key(row.over, row.ball), row.text)
        order.push(key(row.over, row.ball))
      }
      setByKey(map)
      orderedKeys.current = order
      pendingQueue.current.clear()
      attemptCounts.current.clear()
      setFailedKeys(new Set())
      lastFiredAt.current = 0
      rateLimitedUntil.current = 0
    }
    load()
    return () => {
      cancelled = true
    }
  }, [matchId, inningsNumber])

  // ── Realtime sync ─────────────────────────────────────────────
  useEffect(() => {
    if (!matchId) return

    const channel = supabase
      .channel(`ball_commentary:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT (first generation), UPDATE (correction/upsert), DELETE (Clear/Reset)
          schema: "public",
          table: "ball_commentary",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { innings_number?: number; over?: number; ball?: number } | null
            if (!old || old.innings_number !== inningsNumber || old.over == null || old.ball == null) return
            removeRow(old.over, old.ball)
            return
          }
          const row = payload.new as { innings_number: number; over: number; ball: number; text: string } | null
          if (!row || row.innings_number !== inningsNumber) return
          mergeRow(row.over, row.ball, row.text)
        },
      )
      .subscribe((status, err) => {
        console.log(`[useBallCommentary] channel status for match ${matchId} innings ${inningsNumber}:`, status, err ?? "")
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId, inningsNumber, mergeRow, removeRow])

  // Enqueue any delivery that doesn't have commentary yet, isn't already
  // queued, and hasn't already been given up on.
  useEffect(() => {
    if (!enabled) return
    for (const d of deliveries) {
      const k = key(d.over, d.ball)
      if (byKey.has(k)) continue
      if (pendingQueue.current.has(k)) continue
      if (failedKeys.has(k)) continue
      pendingQueue.current.set(k, d)
    }
  }, [deliveries, byKey, failedKeys, enabled])

  // Scheduler: fires at most one batched request per MIN_INTERVAL_MS.
  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(() => {
      if (requestInFlight.current) return
      if (pendingQueue.current.size === 0) return
      if (Date.now() < rateLimitedUntil.current) return // still in backoff from a prior rate-limit hit

      const now = Date.now()
      if (now - lastFiredAt.current < MIN_INTERVAL_MS) return

      const batch = [...pendingQueue.current.entries()]
        .sort(([, a], [, b]) => a.over - b.over || a.ball - b.ball)
        .slice(0, MAX_BATCH_SIZE)

      if (batch.length === 0) return

      for (const [k] of batch) pendingQueue.current.delete(k)

      requestInFlight.current = true
      lastFiredAt.current = now

      const ctx = contextRef.current
      const recentCommentary = orderedKeys.current
        .slice(-RECENT_CONTEXT_LINES)
        .map((k) => byKey.get(k))
        .filter((t): t is string => !!t)

      fetch("/api/commentary/generate", {
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
          deliveries: batch.map(([, d]) => ({
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
        .then((res) => res.json())
        .then((json: { commentary?: CommentaryLine[]; error?: string; detail?: string; code?: string }) => {
          if (json.error || !json.commentary) {
            console.error("[useBallCommentary] generate failed:", json.error, json.detail)

            if (json.code === "rate_limit_exceeded") {
              // Daily/burst quota is dead — pause ALL generation instead
              // of retrying every tick against a limit that's still hit.
              rateLimitedUntil.current = Date.now() + RATE_LIMIT_BACKOFF_MS
            }

            // Per-key retry accounting: after MAX_ATTEMPTS_PER_BALL
            // failures, give up on that ball for this session so the UI
            // falls back to phrase-bank text instead of showing
            // "Writing commentary…" indefinitely.
            const stillRetrying = new Set<string>()
            for (const [k, d] of batch) {
              const attempts = (attemptCounts.current.get(k) ?? 0) + 1
              attemptCounts.current.set(k, attempts)
              if (attempts < MAX_ATTEMPTS_PER_BALL) {
                pendingQueue.current.set(k, d)
                stillRetrying.add(k)
              }
            }
            const gaveUpOn = batch.map(([k]) => k).filter((k) => !stillRetrying.has(k))
            if (gaveUpOn.length > 0) {
              setFailedKeys((prev) => {
                const next = new Set(prev)
                for (const k of gaveUpOn) next.add(k)
                return next
              })
            }
            return
          }

          // Merge locally too (belt-and-suspenders) — Realtime should
          // also deliver this same write back a moment later, but this
          // means the device that generated it doesn't wait on the
          // round-trip through Realtime to show it.
          for (const c of json.commentary!) mergeRow(c.over, c.ball, c.text)
        })
        .catch((err) => {
          console.error("[useBallCommentary] request failed:", err)
          // Network-level failure — treat the same as a failed attempt
          // rather than an infinite retry.
          const stillRetrying = new Set<string>()
          for (const [k, d] of batch) {
            const attempts = (attemptCounts.current.get(k) ?? 0) + 1
            attemptCounts.current.set(k, attempts)
            if (attempts < MAX_ATTEMPTS_PER_BALL) {
              pendingQueue.current.set(k, d)
              stillRetrying.add(k)
            }
          }
          const gaveUpOn = batch.map(([k]) => k).filter((k) => !stillRetrying.has(k))
          if (gaveUpOn.length > 0) {
            setFailedKeys((prev) => {
              const next = new Set(prev)
              for (const k of gaveUpOn) next.add(k)
              return next
            })
          }
        })
        .finally(() => {
          requestInFlight.current = false
        })
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [enabled, byKey, mergeRow])

  return {
    getText: useCallback((over: number, ball: number) => byKey.get(key(over, ball)), [byKey]),
    // A ball only counts as "pending" (shows "Writing commentary…") if
    // it's actually queued or in flight — NOT if it's given up and
    // sitting in failedKeys. That's what lets MatchTabs fall back to
    // generateCommentaryText() for balls the LLM couldn't produce.
    isGeneratingOver: useCallback((over: number) => {
      const queuedForOver = [...pendingQueue.current.keys()].some((k) => k.startsWith(`${over}.`))
      return queuedForOver || requestInFlight.current
    }, [byKey]),
  }
}