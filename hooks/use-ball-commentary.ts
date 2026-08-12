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
      lastFiredAt.current = 0
    }
    load()
    return () => {
      cancelled = true
    }
  }, [matchId, inningsNumber])

  // ── Realtime sync ─────────────────────────────────────────────
  // Subscribes to inserts/updates on ball_commentary for this match.
  // This is what makes commentary appear live on every open device —
  // without it, each device only ever saw whatever was cached at its
  // own page-load. Filtered by match_id at the subscription level
  // (Supabase Realtime filters cleanly support one column); innings is
  // checked in the callback since a match can have rows for both
  // innings flowing through the same channel.
  useEffect(() => {
    if (!matchId) return

    const channel = supabase
      .channel(`ball_commentary:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT (first generation) and UPDATE (e.g. a later correction/upsert)
          schema: "public",
          table: "ball_commentary",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new as { innings_number: number; over: number; ball: number; text: string } | null
          if (!row || row.innings_number !== inningsNumber) return
          mergeRow(row.over, row.ball, row.text)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId, inningsNumber, mergeRow])

  // Enqueue any delivery that doesn't have commentary yet and isn't
  // already queued.
  useEffect(() => {
    if (!enabled) return
    for (const d of deliveries) {
      const k = key(d.over, d.ball)
      if (byKey.has(k)) continue
      if (pendingQueue.current.has(k)) continue
      pendingQueue.current.set(k, d)
    }
  }, [deliveries, byKey, enabled])

  // Scheduler: fires at most one batched request per MIN_INTERVAL_MS.
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
            for (const [k, d] of batch) pendingQueue.current.set(k, d)
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
          for (const [k, d] of batch) pendingQueue.current.set(k, d)
        })
        .finally(() => {
          requestInFlight.current = false
        })
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [enabled, byKey, mergeRow])

  return {
    getText: useCallback((over: number, ball: number) => byKey.get(key(over, ball)), [byKey]),
    isGeneratingOver: useCallback((over: number) => {
      const queuedForOver = [...pendingQueue.current.keys()].some((k) => k.startsWith(`${over}.`))
      return queuedForOver || requestInFlight.current
    }, [byKey]),
  }
}