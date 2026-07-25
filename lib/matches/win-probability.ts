// lib/win-probability.ts
// Deterministic, heuristic win-probability model — NOT an ML model.
// Rewards the chasing team for beating the required run rate with
// wickets in hand; no persistence, recomputed from `balls` every time.

import { aggregateInnings, formatOvers, type BallRow } from "@/lib/matches/cricket-engine"

export interface WinProbState {
  target: number
  oversLimit: number
  runs: number
  wkts: number
  legalBalls: number
}

export interface WinProb {
  a: number
  b: number
}

export function calcWinProb(state: WinProbState): WinProb {
  const { target, oversLimit, runs, wkts, legalBalls } = state
  const totalBalls = oversLimit * 6
  const ballsLeft = Math.max(totalBalls - legalBalls, 0)
  const runsNeeded = target - runs

  if (runsNeeded <= 0) return { a: 0, b: 100 } // chase completed
  if (wkts >= 10) return { a: 100, b: 0 } // all out, short
  if (ballsLeft <= 0) return { a: 100, b: 0 } // overs used up, short

  const oversLeft = ballsLeft / 6
  const rrr = runsNeeded / oversLeft
  const crr = legalBalls > 0 ? (runs / legalBalls) * 6 : 0
  const wicketsInHand = 10 - wkts

  // Positive pressure favors the chasing team (B).
  const rateWeight = (crr - rrr) * 1.15
  const wicketWeight = (wicketsInHand / 10) * 6
  const pressure = rateWeight + wicketWeight - 3 // -3 baseline keeps an on-par chase near 50/50

  const wpB = 100 / (1 + Math.exp(-0.55 * pressure))
  return { a: Math.round(100 - wpB), b: Math.round(wpB) }
}

/**
 * Replays innings-2 deliveries in order and returns a win-probability
 * reading after every LEGAL ball. Kept for any existing callers that only
 * ever cared about the chase itself. Prefer `buildFullMatchLiveScript`
 * for anything that renders a continuous timeline across both innings.
 */
export function buildLiveScriptFromBalls(
  innings2Balls: BallRow[],
  target: number,
  oversLimit: number
): { ball: string; wpA: number; wpB: number }[] {
  const sorted = [...innings2Balls].sort((a, b) => a.sequence - b.sequence)
  const script: { ball: string; wpA: number; wpB: number }[] = []

  let runs = 0
  let wkts = 0
  let legalBalls = 0

  for (const row of sorted) {
    const isLegal = row.extra_type !== "wide" && row.extra_type !== "no_ball"
    runs += row.runs
    if (row.is_wicket) wkts += 1
    if (isLegal) legalBalls += 1

    if (isLegal) {
      const { a, b } = calcWinProb({ target, oversLimit, runs, wkts, legalBalls })
      script.push({ ball: formatOvers(legalBalls), wpA: a, wpB: b })
    }
  }

  return script
}

/**
 * Builds the win-probability timeline across the WHOLE match, not just
 * the chase. There's no meaningful "pressure" calculation during innings
 * 1 — nobody is chasing anything yet — so instead of leaving that span
 * empty (which made the graph render a single dot once innings 2
 * finally produced one data point), this emits an explicit flat 50/50
 * reading after every legal ball of innings 1. That gives the chart a
 * real, continuous line for the whole match: flat through the 1st
 * innings, then the real pressure-based curve once the chase starts.
 */
export function buildFullMatchLiveScript(
  innings1Balls: BallRow[],
  innings2Balls: BallRow[],
  target: number,
  oversLimit: number
): { ball: string; wpA: number; wpB: number }[] {
  const script: { ball: string; wpA: number; wpB: number }[] = []

  const sorted1 = [...innings1Balls].sort((a, b) => a.sequence - b.sequence)
  let legalBalls1 = 0
  for (const row of sorted1) {
    const isLegal = row.extra_type !== "wide" && row.extra_type !== "no_ball"
    if (isLegal) {
      legalBalls1 += 1
      script.push({ ball: formatOvers(legalBalls1), wpA: 50, wpB: 50 })
    }
  }

  const sorted2 = [...innings2Balls].sort((a, b) => a.sequence - b.sequence)
  let runs = 0
  let wkts = 0
  let legalBalls2 = 0
  for (const row of sorted2) {
    const isLegal = row.extra_type !== "wide" && row.extra_type !== "no_ball"
    runs += row.runs
    if (row.is_wicket) wkts += 1
    if (isLegal) legalBalls2 += 1

    if (isLegal) {
      const { a, b } = calcWinProb({ target, oversLimit, runs, wkts, legalBalls: legalBalls2 })
      script.push({ ball: formatOvers(legalBalls2), wpA: a, wpB: b })
    }
  }

  return script
}