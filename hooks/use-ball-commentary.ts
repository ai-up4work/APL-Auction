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

// Compares two "over.ball" keys chronologically (over first, then ball)
// rather than lexicographically — "10.1" must sort after "9.2", which
// plain string comparison would get wrong.
function compareKeys(a: string, b: string): number {
  const [aOver, aBall] = a.split(".").map(Number)
  const [bOver, bBall] = b.split(".").map(Number)
  return aOver - bOver || aBall - bBall
}

// ── Pacing knobs ──────────────────────────────────────────────────
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

/** Pulls a short, human-readable reason out of whatever the generate
 *  route sent back, instead of logging the raw Groq error JSON blob.
 *  Purely cosmetic — doesn't change any control flow. */
function summarizeFailure(error?: string, detail?: string): string {
  if (!detail) return error ?? "unknown error"
  try {
    const parsed = JSON.parse(detail)
    const msg: string | undefined = parsed?.error?.message
    const code: string | undefined = parsed?.error?.code
    if (code === "rate_limit_exceeded") return "Groq daily token quota reached — falling back to phrase-bank text"
    if (msg) return msg
  } catch {
    // detail wasn't JSON — fall through to the raw string
  }
  return `${error ?? "generate failed"}: ${detail}`
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
  // Always kept sorted chronologically (over, then ball) — NOT arrival
  // order. Realtime events and the reconciliation poll's DB query can
  // both deliver rows out of over/ball sequence when multiple devices
  // are generating concurrently for the same live match (each ball is
  // claimed by whichever device's request lands first server-side, and
  // network timing across devices doesn't respect ball order). Since
  // recentCommentary below does `.slice(-RECENT_CONTEXT_LINES)` and
  // relies on the tail being the true most-recent balls, insertion
  // order here would silently corrupt the "last 5 lines" continuity
  // context sent to the model.
  const orderedKeys = useRef<string[]>([])

  // Status per ball key, for every ball that ISN'T ready-with-text.
  // 'pending' = claimed, generation in flight — UI shows "Writing
  // commentary…". 'failed' = permanently gave up (quota, network,
  // model error, whatever) — UI falls straight through to the
  // deterministic phrase-bank fallback, forever, no retry. Keeping
  // these as two distinct states (instead of one flat "unavailable"
  // set) is what lets isGeneratingOver correctly stop reporting a
  // failed ball as "still generating".
  const [statusByKey, setStatusByKey] = useState<Map<string, "pending" | "failed">>(new Map())

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

  // Inserts a key into orderedKeys at its correct chronological
  // position (rather than pushing to the end) if it isn't already
  // present. O(n) per insert, but n is at most ~130 balls for a T20
  // innings — negligible.
  const insertOrdered = (k: string) => {
    if (orderedKeys.current.includes(k)) return
    const idx = orderedKeys.current.findIndex((existing) => compareKeys(existing, k) > 0)
    if (idx === -1) orderedKeys.current.push(k)
    else orderedKeys.current.splice(idx, 0, k)
  }

  // Merges a row into local state exactly once, whether it came from
  // the initial load, a Realtime push, or the reconciliation poll.
  const mergeRow = useCallback((row: CommentaryRow) => {
    const k = key(row.over, row.ball)
    if (row.status === "ready" && row.text) {
      setByKey((prev) => {
        if (prev.get(k) === row.text) return prev // no-op, avoids extra re-renders
        const next = new Map(prev)
        insertOrdered(k)
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
      setStatusByKey((prev) => {
        if (prev.get(k) === row.status) return prev
        const next = new Map(prev)
        next.set(k, row.status as "pending" | "failed")
        return next
      })
    }
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
      // Query is already sorted over/ball ascending, so a plain push
      // here is fine — this is the one place arrival order and
      // chronological order coincide by construction.
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
  // Requires `ball_commentary` to be in the `supabase_realtime`
  // publication and to have a SELECT policy Realtime can evaluate. If
  // devices ever show diverging AI/Match-Data badges for the SAME
  // ball, check that first before assuming this hook is wrong.
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
        console.log(
          `[useBallCommentary] channel status for match ${matchId} innings ${inningsNumber}:`,
          status,
          err ?? "",
        )
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId, inningsNumber, mergeRow, removeRow])

  // ── Reconciliation poll (belt-and-suspenders) ──
  // Self-heals a device that missed a Realtime event (dead socket,
  // backgrounded tab, misconfigured publication/RLS, etc). Read-only,
  // and skips entirely when nothing is outstanding.
  useEffect(() => {
    if (!matchId) return

    const reconcile = async () => {
      const outstandingOvers = [
        ...new Set(deliveries.filter((d) => !byKey.has(key(d.over, d.ball))).map((d) => d.over)),
      ]
      if (outstandingOvers.length === 0) return

      // No .order() here — Postgres/PostgREST give no ordering
      // guarantee for an .in() filter, so results can (and do) arrive
      // in a different sequence than over/ball order. mergeRow's
      // insertOrdered() is what keeps orderedKeys correct regardless.
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
  // Sends candidate balls to /api/commentary/generate, which atomically
  // claims them server-side (service role, bypasses RLS) so exactly one
  // device ever generates a given ball. Policy: ONE attempt per ball,
  // ever. Success -> 'ready', shown as AI Commentary everywhere. Any
  // failure (quota, network, model error) -> 'failed', permanently,
  // shown as the Match Data fallback everywhere. No retry, no backoff.
  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(async () => {
      if (requestInFlight.current) return
      const now = Date.now()
      if (now - lastFiredAt.current < MIN_INTERVAL_MS) return

      // Candidates: balls we have delivery data for, that aren't ready
      // and aren't already known pending/failed. Newest first, so a
      // device opening mid-match prioritizes the live edge over
      // backfilling historical balls in one burst.
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

      // Optimistically mark 'pending' locally so this device's own next
      // tick doesn't re-send them while this request is in flight.
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
          // Expected outcome under the "one attempt, then permanent
          // fallback" policy — not a crash. console.warn (not .error)
          // so the dev overlay doesn't render it as a red exception,
          // and a short summarized reason instead of the raw nested
          // Groq error JSON.
          console.warn(
            `[useBallCommentary] ${candidates.length} ball(s) permanently failed — showing fallback text:`,
            summarizeFailure(json.error, json.detail),
          )
          // The server already wrote status:'failed' to the DB for
          // these balls. Flip them locally too, right away — this is
          // what actually stops "Writing commentary…" from sticking:
          // without this, these keys would stay at 'pending' in local
          // state until Realtime/poll eventually corrects it.
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

        // Anything in this batch the server didn't return text for
        // (its own `missing` — model silently skipped a line) also
        // needs to flip to failed locally; Realtime/poll will confirm
        // shortly, but don't leave it reporting 'pending' meanwhile.
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
        console.warn(
          `[useBallCommentary] ${candidates.length} ball(s) permanently failed (network) — showing fallback text:`,
          err instanceof Error ? err.message : String(err),
        )
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
    // Only 'pending' balls count as generating — 'failed' balls are NOT
    // pending, so MatchTabs falls straight through to
    // generateCommentaryText() for them and shows "Match Data" instead
    // of hanging on "Writing commentary…" forever.
    isGeneratingOver: useCallback(
      (over: number) => deliveries.some((d) => d.over === over && statusByKey.get(key(d.over, d.ball)) === "pending"),
      [deliveries, statusByKey],
    ),
  }
}