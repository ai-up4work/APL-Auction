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
// How long to pause ALL generation after a rate-limit (esp. daily
// token-quota) error, instead of retrying every tick against a quota
// that's guaranteed to still be dead.
const RATE_LIMIT_BACKOFF_MS = 10 * 60_000
// How many balls this device is willing to try claiming/backfilling in
// a single pass. Keeps a device that opens mid-match with 40 unscored
// balls from queuing all 40 at once — it works through them a few at a
// time, newest first, across multiple ticks instead.
const MAX_CLAIM_CANDIDATES_PER_TICK = MAX_BATCH_SIZE

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
  // *someone* (possibly this device, possibly another). Either way, no
  // device should try to claim them again. This is shared truth read
  // from the DB / Realtime — not a local per-session guess, which is
  // exactly what was missing before: a failure now means "everyone
  // shows the fallback, forever," not "this one tab gives up twice and
  // every other tab/refresh retries from zero."
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
      // 'pending' (claimed, by us or another device) or 'failed'
      // (permanently gave up) — either way, nobody should re-claim it.
      // isPending vs isFailed distinction for the UI comes from
      // whether byKey has text; both render as "not ready yet".
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
      rateLimitedUntil.current = 0
    }
    load()
    return () => {
      cancelled = true
    }
  }, [matchId, inningsNumber])

  // ── Realtime sync — every device (this one included) hears about
  // every claim, success, and failure the instant it's written. ──
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

  // ── Scheduler: at most one attempt per MIN_INTERVAL_MS, and the
  // attempt itself atomically claims balls before ever calling Groq. ──
  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(async () => {
      if (requestInFlight.current) return
      if (Date.now() < rateLimitedUntil.current) return
      const now = Date.now()
      if (now - lastFiredAt.current < MIN_INTERVAL_MS) return

      // Candidates: balls we have real delivery data for, that aren't
      // already ready, and aren't already known claimed/failed. Newest
      // first, so a device opening mid-match prioritizes the live edge
      // over backfilling 40 historical balls in one burst.
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

      try {
        // ── ATOMIC CLAIM ──
        // INSERT ... ON CONFLICT DO NOTHING RETURNING *. If another
        // device already has a row (pending, ready, or failed) for a
        // ball, that row is skipped and NOT returned here — so `claimed`
        // is exactly the subset of candidates this device, and only
        // this device, is now responsible for. No Groq call is ever
        // made for a ball someone else is already handling.
        const placeholderRows = candidates.map((d) => ({
          match_id: matchId,
          innings_number: inningsNumber,
          over: d.over,
          ball: d.ball,
          status: "pending" as const,
          text: null,
        }))

        const { data: claimedRows, error: claimErr } = await supabase
          .from("ball_commentary")
          .upsert(placeholderRows, { onConflict: "match_id,innings_number,over,ball", ignoreDuplicates: true })
          .select("over, ball")

        if (claimErr) {
          console.error("[useBallCommentary] claim failed:", claimErr.message)
          return
        }

        const claimedKeys = new Set((claimedRows ?? []).map((r) => key(r.over, r.ball)))
        // Mark everything we tried as unavailable locally right away —
        // whether we won the claim (now pending-by-us) or lost it (now
        // pending/ready/failed-by-someone-else) — so this device's next
        // tick doesn't re-consider any of them.
        setUnavailableKeys((prev) => {
          const next = new Set(prev)
          for (const d of candidates) next.add(key(d.over, d.ball))
          return next
        })

        const batch = candidates.filter((d) => claimedKeys.has(key(d.over, d.ball)))
        if (batch.length === 0) {
          // Every candidate was already claimed by another device
          // between our read and our claim attempt — nothing to do,
          // Realtime will tell us the outcome.
          return
        }

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
            deliveries: batch.map((d) => ({
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

        if (json.error || !json.commentary) {
          console.error("[useBallCommentary] generate failed:", json.error, json.detail)
          if (json.code === "rate_limit_exceeded") {
            rateLimitedUntil.current = Date.now() + RATE_LIMIT_BACKOFF_MS
          }
          // The server already wrote status:'failed' for these rows on
          // any failure path (see markFailed in the route). We don't
          // need to retry locally — Realtime will deliver the 'failed'
          // update and every device (including this one) will fall back
          // to phrase-bank text for these balls permanently. No local
          // retry bookkeeping needed anymore.
          return
        }

        // Merge locally too (belt-and-suspenders) — Realtime should also
        // deliver this same write back a moment later, but this means
        // the device that generated it doesn't wait on the round-trip.
        for (const c of json.commentary) {
          mergeRow({ over: c.over, ball: c.ball, text: c.text, status: "ready" })
        }
      } catch (err) {
        console.error("[useBallCommentary] request failed:", err)
        // Network failure before we even reached the server: the claim
        // rows are still 'pending' in the DB with nobody coming to
        // resolve them. Best-effort clean that up so they don't stay
        // stuck forever and block every other device from retrying.
        const stuckRows = candidates.map((d) => ({
          match_id: matchId,
          innings_number: inningsNumber,
          over: d.over,
          ball: d.ball,
          status: "failed" as const,
          text: null,
        }))
        await supabase
          .from("ball_commentary")
          .upsert(stuckRows, { onConflict: "match_id,innings_number,over,ball" })
          .then(({ error }) => {
            if (error) console.error("[useBallCommentary] failed to resolve stuck claim:", error.message)
          })
      } finally {
        requestInFlight.current = false
      }
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [enabled, byKey, unavailableKeys, deliveries, matchId, inningsNumber, mergeRow])

  return {
    getText: useCallback((over: number, ball: number) => byKey.get(key(over, ball)), [byKey]),
    // A ball counts as "pending" only if it's claimed (by anyone) and
    // doesn't have ready text yet. Once the DB marks it 'failed', it's
    // no longer pending anywhere — every device shows the deterministic
    // fallback immediately instead of "Writing commentary…" forever.
    isGeneratingOver: useCallback(
      (over: number) => {
        return deliveries.some((d) => d.over === over && unavailableKeys.has(key(d.over, d.ball)) && !byKey.has(key(d.over, d.ball)))
      },
      [deliveries, unavailableKeys, byKey],
    ),
  }
}