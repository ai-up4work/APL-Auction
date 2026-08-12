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
// MIN_INTERVAL_MS: minimum gap between generation requests. This is
// what actually gives you "one batch per minute" — deliveries that
// arrive faster than this just queue up instead of firing immediately.
const MIN_INTERVAL_MS = 45_000
// How often the scheduler checks the queue. Doesn't need to match
// MIN_INTERVAL_MS exactly — this just controls responsiveness of the
// check, the real pacing is enforced by lastFiredAt below.
const TICK_MS = 5_000
// Cap on deliveries sent in a single request. Even if the queue backs
// up (e.g. client was offline and multiple overs arrive at once), we
// never send more than this many balls in one prompt — keeps every
// request's token footprint small and consistent regardless of how
// bursty the incoming deliveries are.
const MAX_BATCH_SIZE = 6
// How many previous commentary lines to include as style/continuity
// context. Kept small on purpose — this is the main thing that would
// otherwise grow unbounded over a 120-ball innings if you weren't
// careful.
const RECENT_CONTEXT_LINES = 5

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

  // Deliveries waiting to be sent, keyed so we never queue the same
  // ball twice even if the effect below re-runs before the queue drains.
  const pendingQueue = useRef<Map<string, DeliveryEntry>>(new Map())
  // True while a generation request is in flight — the scheduler won't
  // start a new one until this clears, so requests never overlap.
  const requestInFlight = useRef(false)
  const lastFiredAt = useRef(0)

  // Keep latest non-delivery context in a ref so the scheduler (which
  // runs on its own interval, not on every prop change) always reads
  // the freshest score/striker/bowler state without needing to be in
  // the interval's dependency array.
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
      // Fresh innings/match — drop any stale queue/timing from before.
      pendingQueue.current.clear()
      lastFiredAt.current = 0
    }
    load()
    return () => {
      cancelled = true
    }
  }, [matchId, inningsNumber])

  // Enqueue any delivery that doesn't have commentary yet and isn't
  // already queued. This just collects work — it does NOT fire a
  // request. Firing is entirely the scheduler's job below, so bursts
  // of new deliveries never translate into bursts of requests.
  useEffect(() => {
    if (!enabled) return
    for (const d of deliveries) {
      const k = key(d.over, d.ball)
      if (byKey.has(k)) continue
      if (pendingQueue.current.has(k)) continue
      pendingQueue.current.set(k, d)
    }
  }, [deliveries, byKey, enabled])

  // Single scheduler: every TICK_MS, check whether enough time has
  // passed since the last request AND there's something queued. If so,
  // drain up to MAX_BATCH_SIZE deliveries (oldest first) and fire one
  // request. This is what enforces "at most one batch per minute"
  // regardless of how fast balls are actually being scored.
  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(() => {
      if (requestInFlight.current) return
      if (pendingQueue.current.size === 0) return

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
        .then((json: { commentary?: CommentaryLine[]; error?: string }) => {
          if (json.error || !json.commentary) {
            console.error("[useBallCommentary] generate failed:", json.error)
            // Put the batch back so it gets retried on a later tick
            // instead of silently losing that over's commentary.
            for (const [k, d] of batch) pendingQueue.current.set(k, d)
            return
          }
          setByKey((prev) => {
            const next = new Map(prev)
            for (const c of json.commentary!) {
              const k = key(c.over, c.ball)
              if (!next.has(k)) orderedKeys.current.push(k)
              next.set(k, c.text)
            }
            return next
          })
        })
        .catch((err) => {
          console.error("[useBallCommentary] request failed:", err)
          for (const [k, d] of batch) pendingQueue.current.set(k, d)
        })
        .finally(() => {
          requestInFlight.current = false
        })
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [enabled, byKey])

  return {
    getText: useCallback((over: number, ball: number) => byKey.get(key(over, ball)), [byKey]),
    isGeneratingOver: useCallback(
      (over: number) => {
        // Pending (queued but not yet sent) OR currently mid-request.
        const queuedForOver = [...pendingQueue.current.keys()].some((k) => k.startsWith(`${over}.`))
        return queuedForOver || requestInFlight.current
      },
      [byKey],
    ),
  }
}