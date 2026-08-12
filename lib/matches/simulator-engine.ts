// lib/matches/simulator-engine.ts
//
// Pure, framework-agnostic match simulator. Produces one delivery at a
// time in the exact shape `balls` rows need (see lib/matches/cricket-engine.ts
// BallRow), so output can be inserted directly and re-aggregated by the
// existing aggregateInnings()/buildLiveScriptFromBalls() pipeline without
// any changes to those files.
//
// This file has NO Supabase dependency — it's just state + randomness —
// so it can be unit tested or reused (e.g. server-side) independently of
// the admin page that drives it.

export type ExtraType = "wide" | "no_ball" | "bye" | "leg_bye" | null
export type DismissalType = "bowled" | "caught" | "lbw" | "run_out" | "stumped" | "hit_wicket"

/** Row shape ready to insert into `balls`, minus id/match_id (caller adds those). */
export interface SimBallRow {
  innings_number: number
  sequence: number
  over_number: number
  ball_number: number
  striker_name: string
  non_striker_name: string
  bowler_name: string
  runs: number
  extra_type: ExtraType
  is_wicket: boolean
  dismissal_type: DismissalType | null
  batsman_out: string | null
  fielder: string | null
}

export interface SimPlayerPool {
  teamName: string
  teamShort: string
  /** Batting order, index 0 bats first. */
  battingOrder: string[]
  /** Pool of bowlers available to this team when fielding. */
  bowlers: string[]
}

export interface InningsSimState {
  inningsNumber: 1 | 2
  battingTeam: SimPlayerPool
  bowlingTeam: SimPlayerPool
  oversLimit: number
  maxOversPerBowler: number
  target: number | null // set only for innings 2
  sequence: number

  nextBatterIdx: number
  strikerName: string
  nonStrikerName: string
  outBatters: Set<string>

  currentBowlerName: string | null
  lastOverBowlerName: string | null
  bowlerLegalBalls: Record<string, number>

  over: number // 1-indexed over currently in progress
  ballInOver: number // legal balls bowled this over, 0-5
  legalBalls: number
  runs: number
  wkts: number

  finished: boolean
  finishReason: "all_out" | "overs_complete" | "target_reached" | null
}

const DISMISSALS: { type: DismissalType; weight: number }[] = [
  { type: "bowled", weight: 30 },
  { type: "caught", weight: 40 },
  { type: "lbw", weight: 15 },
  { type: "run_out", weight: 8 },
  { type: "stumped", weight: 5 },
  { type: "hit_wicket", weight: 2 },
]

function weightedPick<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (const item of items) {
    if (r < item.weight) return item.value
    r -= item.weight
  }
  return items[items.length - 1].value
}

/** Generates fallback player names when a match has no real squads set up. */
export function generatePlaceholderPool(teamName: string, teamShort: string): SimPlayerPool {
  const names = Array.from({ length: 11 }, (_, i) => `${teamShort} Player ${i + 1}`)
  return { teamName, teamShort, battingOrder: names, bowlers: names.slice(0, 6) }
}

// ── Defensive fallbacks ──────────────────────────────────────────
// These two exported helpers (createInningsState / simulateNextDelivery)
// are pure functions with no dependency on how their inputs were built.
// In practice callers go through poolFromSetup(), which guarantees
// battingOrder.length >= 2 and bowlers.length >= 2 — but nothing in this
// file enforces that itself. A bad caller (a test, a future API route, a
// hand-built pool) with a too-small battingOrder or an empty bowlers
// array would otherwise silently produce `undefined` names that get
// written straight into the `balls` table and fail there with a
// confusing NOT NULL constraint error instead of a clear one here.
const FALLBACK_BATTER_NAME = "Player TBD"
const FALLBACK_BOWLER_NAME = "Bowler TBD"

function safeBattingOrder(order: string[]): string[] {
  if (order.length >= 2) return order
  // Pad up to 2 so strikerName/nonStrikerName are never undefined.
  const padded = [...order]
  while (padded.length < 2) padded.push(`${FALLBACK_BATTER_NAME} ${padded.length + 1}`)
  return padded
}

function safeBowlerPool(bowlers: string[]): string[] {
  return bowlers.length > 0 ? bowlers : [FALLBACK_BOWLER_NAME]
}

export function createInningsState(params: {
  inningsNumber: 1 | 2
  battingTeam: SimPlayerPool
  bowlingTeam: SimPlayerPool
  oversLimit: number
  target?: number | null
  startSequence: number
}): InningsSimState {
  const { inningsNumber, battingTeam, bowlingTeam, target, startSequence } = params

  const battingOrder = safeBattingOrder(battingTeam.battingOrder)
  const bowlers = safeBowlerPool(bowlingTeam.bowlers)
  const safeBattingTeam: SimPlayerPool = { ...battingTeam, battingOrder }
  const safeBowlingTeam: SimPlayerPool = { ...bowlingTeam, bowlers }

  // Guard against a zero/negative/non-finite overs limit (e.g. a match
  // whose match_setup carries `overs: 0` — "??" alone wouldn't catch
  // that since 0 isn't null/undefined). Without this, oversUsedUp trips
  // almost immediately and the innings ends after ~1 ball.
  const oversLimit = Number.isFinite(params.oversLimit) && params.oversLimit > 0 ? params.oversLimit : 20

  return {
    inningsNumber,
    battingTeam: safeBattingTeam,
    bowlingTeam: safeBowlingTeam,
    oversLimit,
    maxOversPerBowler: Math.max(1, Math.ceil(oversLimit / 5)),
    target: target ?? null,
    sequence: startSequence,
    nextBatterIdx: 2,
    strikerName: battingOrder[0],
    nonStrikerName: battingOrder[1],
    outBatters: new Set(),
    currentBowlerName: null,
    lastOverBowlerName: null,
    bowlerLegalBalls: {},
    over: 1,
    ballInOver: 0,
    legalBalls: 0,
    runs: 0,
    wkts: 0,
    finished: false,
    finishReason: null,
  }
}

function pickBowler(state: InningsSimState): string {
  const pool = state.bowlingTeam.bowlers
  // pool is guaranteed non-empty by safeBowlerPool() in createInningsState,
  // but keep this fallback so pickBowler never returns undefined even if
  // called against a state built some other way.
  if (pool.length === 0) return FALLBACK_BOWLER_NAME

  const eligible = pool.filter((b) => {
    if (b === state.lastOverBowlerName) return false
    const bowled = state.bowlerLegalBalls[b] ?? 0
    return bowled < state.maxOversPerBowler * 6
  })
  const candidates = eligible.length > 0 ? eligible : pool.filter((b) => b !== state.lastOverBowlerName)
  const finalCandidates = candidates.length > 0 ? candidates : pool
  return finalCandidates[Math.floor(Math.random() * finalCandidates.length)] ?? pool[0]
}

function pickNextBatter(state: InningsSimState): string | null {
  const order = state.battingTeam.battingOrder
  while (state.nextBatterIdx < order.length) {
    const name = order[state.nextBatterIdx]
    state.nextBatterIdx += 1
    if (!state.outBatters.has(name)) return name
  }
  return null
}

/** Returns delivery-outcome weights, adjusted for chase pressure in innings 2. */
function outcomeWeights(state: InningsSimState) {
  const base = { dot: 36, one: 30, two: 7, three: 1, four: 11, six: 6, wide: 4, no_ball: 1, wicket: 4 }

  if (state.inningsNumber === 2 && state.target !== null) {
    const ballsLeft = Math.max(state.oversLimit * 6 - state.legalBalls, 1)
    const runsNeeded = state.target - state.runs
    const rrr = runsNeeded / (ballsLeft / 6)
    const crr = state.legalBalls > 0 ? (state.runs / state.legalBalls) * 6 : 0
    const pressure = Math.max(0, Math.min(rrr - crr, 8)) // clamp so it never goes absurd

    if (pressure > 1) {
      const boost = pressure * 1.8
      base.four += boost
      base.six += boost * 0.8
      base.dot = Math.max(10, base.dot - boost * 1.5)
      base.wicket += pressure * 0.6
    }
  }

  return base
}

/**
 * Advances the innings by exactly one delivery, mutating and returning a
 * new state object plus the row to insert and a short commentary string.
 * Returns `null` for the row when the innings is already finished.
 */
export function simulateNextDelivery(prev: InningsSimState): {
  state: InningsSimState
  row: SimBallRow | null
  commentary: string
} {
  if (prev.finished) return { state: prev, row: null, commentary: "" }

  const state: InningsSimState = { ...prev, outBatters: new Set(prev.outBatters), bowlerLegalBalls: { ...prev.bowlerLegalBalls } }

  if (state.ballInOver === 0) {
    state.currentBowlerName = pickBowler(state)
  }
  const bowler = state.currentBowlerName!

  const weights = outcomeWeights(state)
  const outcome = weightedPick([
    { value: "dot", weight: weights.dot },
    { value: "one", weight: weights.one },
    { value: "two", weight: weights.two },
    { value: "three", weight: weights.three },
    { value: "four", weight: weights.four },
    { value: "six", weight: weights.six },
    { value: "wide", weight: weights.wide },
    { value: "no_ball", weight: weights.no_ball },
    { value: "wicket", weight: weights.wicket },
  ] as { value: string; weight: number }[])

  state.sequence += 1
  const seq = state.sequence
  const strikerName = state.strikerName
  const nonStrikerName = state.nonStrikerName

  let row: SimBallRow
  let commentary: string
  let rotateStrike = false
  let isLegal = true
  let wicketFell = false

  const overForRow = state.over
  const ballNumberForRow = state.ballInOver + 1

  switch (outcome) {
    case "wide": {
      isLegal = false
      row = {
        innings_number: state.inningsNumber,
        sequence: seq,
        over_number: overForRow,
        ball_number: ballNumberForRow,
        striker_name: strikerName,
        non_striker_name: nonStrikerName,
        bowler_name: bowler,
        runs: 1,
        extra_type: "wide",
        is_wicket: false,
        dismissal_type: null,
        batsman_out: null,
        fielder: null,
      }
      state.runs += 1
      commentary = `Wide, ${bowler} to ${strikerName}.`
      break
    }
    case "no_ball": {
      isLegal = false
      row = {
        innings_number: state.inningsNumber,
        sequence: seq,
        over_number: overForRow,
        ball_number: ballNumberForRow,
        striker_name: strikerName,
        non_striker_name: nonStrikerName,
        bowler_name: bowler,
        runs: 1,
        extra_type: "no_ball",
        is_wicket: false,
        dismissal_type: null,
        batsman_out: null,
        fielder: null,
      }
      state.runs += 1
      commentary = `No ball, ${bowler} to ${strikerName}.`
      break
    }
    case "wicket": {
      const dismissal = weightedPick(DISMISSALS.map((d) => ({ value: d.type, weight: d.weight })))
      const fielder =
        dismissal === "caught" || dismissal === "stumped" || dismissal === "run_out"
          ? state.bowlingTeam.bowlers[Math.floor(Math.random() * state.bowlingTeam.bowlers.length)]
          : null
      row = {
        innings_number: state.inningsNumber,
        sequence: seq,
        over_number: overForRow,
        ball_number: ballNumberForRow,
        striker_name: strikerName,
        non_striker_name: nonStrikerName,
        bowler_name: bowler,
        runs: 0,
        extra_type: null,
        is_wicket: true,
        dismissal_type: dismissal,
        batsman_out: strikerName,
        fielder,
      }
      state.outBatters.add(strikerName)
      state.wkts += 1
      wicketFell = true
      commentary = `WICKET! ${strikerName} ${dismissal.replace("_", " ")}${fielder ? ` (${fielder})` : ""}, off ${bowler}.`
      break
    }
    default: {
      const runsMap: Record<string, number> = { dot: 0, one: 1, two: 2, three: 3, four: 4, six: 6 }
      const runs = runsMap[outcome]
      const isBoundary = runs === 4 || runs === 6
      // occasionally route non-boundary runs through byes/leg-byes for realism
      const isExtraRuns = !isBoundary && runs > 0 && Math.random() < 0.06
      const extraType: ExtraType = isExtraRuns ? (Math.random() < 0.5 ? "bye" : "leg_bye") : null

      row = {
        innings_number: state.inningsNumber,
        sequence: seq,
        over_number: overForRow,
        ball_number: ballNumberForRow,
        striker_name: strikerName,
        non_striker_name: nonStrikerName,
        bowler_name: bowler,
        runs,
        extra_type: extraType,
        is_wicket: false,
        dismissal_type: null,
        batsman_out: null,
        fielder: null,
      }
      state.runs += runs
      rotateStrike = runs % 2 === 1
      commentary =
        runs === 0
          ? `${bowler} to ${strikerName}, no run.`
          : `${bowler} to ${strikerName}, ${runs}${isBoundary ? (runs === 4 ? " runs, FOUR!" : " runs, SIX!") : runs === 1 ? " run" : " runs"}.`
      break
    }
  }

  if (isLegal) {
    state.legalBalls += 1
    state.ballInOver += 1
    state.bowlerLegalBalls[bowler] = (state.bowlerLegalBalls[bowler] ?? 0) + 1
  }

  if (wicketFell) {
    const next = pickNextBatter(state)
    // If there's genuinely no next batter (last-man-standing edge case),
    // strikerName is left pointing at the just-dismissed batter — but
    // the allOut check below fires in this same call before another
    // delivery can ever be simulated against that stale name, so no
    // further ball gets attributed to a batter who's already out.
    if (next) {
      state.strikerName = next
    }
  } else if (rotateStrike) {
    const tmp = state.strikerName
    state.strikerName = state.nonStrikerName
    state.nonStrikerName = tmp
  }

  const overComplete = state.ballInOver >= 6
  if (overComplete) {
    state.lastOverBowlerName = bowler
    state.ballInOver = 0
    state.over += 1
    // swap ends between overs
    const tmp = state.strikerName
    state.strikerName = state.nonStrikerName
    state.nonStrikerName = tmp
  }

  const battersRemaining = state.outBatters.size < state.battingTeam.battingOrder.length - 1
  const oversUsedUp = state.legalBalls >= state.oversLimit * 6
  const allOut = state.wkts >= 10 || !battersRemaining
  const targetReached = state.target !== null && state.runs >= state.target

  if (targetReached) {
    state.finished = true
    state.finishReason = "target_reached"
  } else if (allOut) {
    state.finished = true
    state.finishReason = "all_out"
  } else if (oversUsedUp) {
    state.finished = true
    state.finishReason = "overs_complete"
  }

  return { state, row, commentary }
}