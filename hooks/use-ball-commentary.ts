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
  const inFlight = useRef<Set<string>>(new Set())
  const orderedKeys = useRef<string[]>([])

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
    }
    load()
    return () => {
      cancelled = true
    }
  }, [matchId, inningsNumber])

  // Generate for any delivery missing commentary, batched per over.
  useEffect(() => {
    if (!enabled || deliveries.length === 0) return

    const missing = deliveries.filter((d) => !byKey.has(key(d.over, d.ball)))
    if (missing.length === 0) return

    const byOver = new Map<number, DeliveryEntry[]>()
    for (const d of missing) {
      if (!byOver.has(d.over)) byOver.set(d.over, [])
      byOver.get(d.over)!.push(d)
    }

    for (const [over, overDeliveries] of byOver) {
      const flightKey = `${inningsNumber}-${over}`
      if (inFlight.current.has(flightKey)) continue
      inFlight.current.add(flightKey)

      const recentCommentary = orderedKeys.current
        .slice(-5)
        .map((k) => byKey.get(k))
        .filter((t): t is string => !!t)

      fetch("/api/commentary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          inningsNumber,
          teamBatting,
          teamBowling,
          target,
          scoreState,
          striker,
          nonStriker,
          bowlerFigures,
          recentCommentary,
          deliveries: overDeliveries.map((d) => ({
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
        .catch((err) => console.error("[useBallCommentary] request failed:", err))
        .finally(() => {
          inFlight.current.delete(flightKey)
        })
    }
  }, [
    deliveries,
    byKey,
    enabled,
    matchId,
    inningsNumber,
    teamBatting,
    teamBowling,
    target,
    scoreState,
    striker,
    nonStriker,
    bowlerFigures,
  ])

  return {
    getText: useCallback((over: number, ball: number) => byKey.get(key(over, ball)), [byKey]),
    isGeneratingOver: useCallback(
      (over: number) => inFlight.current.has(`${inningsNumber}-${over}`),
      [inningsNumber]
    ),
  }
}