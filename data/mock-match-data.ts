// data/mock-match-data.ts
//
// Hand-authored mock data for demoing the match-detail page WITHOUT
// touching Supabase. Represents a T20 match that's currently "half
// conducted": 1st innings complete, 2nd innings in progress (live).
//
// Shapes here mirror data/match-data.ts exactly (BattingRow, BowlingRow,
// FowEntry, MatchSquad, InningsComplete, MatchTeamRef, MatchDetail,
// MatchLookupResult) so this is a drop-in substitute for
// getMatchDetailById() in a demo route.
//
// EXTRA FIELD — `liveScript`:
//   components/tournament/match-graphs.tsx (WinProbabilityView) reads
//   `match.liveScript`, a ball-by-ball win-probability timeline:
//     { ball: string; wpA: number; wpB: number }[]
//   `ball` uses the same "overs.legalBallInOver" label the rest of the
//   codebase produces (e.g. "14.3"). This field lives on the
//   `tournament-data.ts` version of MatchDetail that match-graphs.tsx
//   imports from, not on data/match-data.ts's MatchDetail — so it's
//   added here as an extra property (see MockMatchDetail below) rather
//   than in the MatchDetail interface itself.
//
// USAGE (e.g. in a demo page):
//
//   import { getMockMatchDetail } from "@/data/mock-match-data"
//   import MatchDetailClient from "@/components/tournament/match-detail-client"
//
//   export default function DemoPage() {
//     const result = getMockMatchDetail()
//     if (!result.ok) return null // never happens for the mock
//     return <MatchDetailClient match={result.match} tournamentSlug={result.match.tournamentSlug} />
//   }

import type {
  BattingRow,
  BowlingRow,
  FowEntry,
  InningsComplete,
  MatchDetail,
  MatchLookupResult,
  MatchSquad,
  MatchTeamRef,
} from "@/data/match-data"

// ─────────────────────────────────────────────────────────────
// liveScript — win-probability timeline consumed by match-graphs.tsx
// ─────────────────────────────────────────────────────────────
export interface LiveScriptStep {
  /** "overs.legalBallInOver" label, e.g. "14.3" — same format as InningsComplete.overs */
  ball: string
  /** Team A's win probability at this ball (0-100) */
  wpA: number
  /** Team B's win probability at this ball (0-100) */
  wpB: number
}

/** MatchDetail plus the liveScript field match-graphs.tsx expects. */
export type MockMatchDetail = MatchDetail & { liveScript: LiveScriptStep[] }

/**
 * Builds a plausible ball-by-ball win-probability timeline for the
 * chasing team (team B), drifting from 50% at ball 1 toward
 * `finalWpB` at the last ball, with a dip at each ball listed in
 * `wicketBalls` (legal-ball count at which a wicket fell) to simulate
 * momentum swinging back to the bowling side.
 */
function buildLiveScript(totalLegalBalls: number, finalWpB: number, wicketBalls: number[] = []): LiveScriptStep[] {
  if (totalLegalBalls <= 0) return []

  const startWpB = 50
  const drift = finalWpB - startWpB
  const script: LiveScriptStep[] = []

  for (let legalBalls = 1; legalBalls <= totalLegalBalls; legalBalls++) {
    const progress = legalBalls / totalLegalBalls
    const wave = Math.sin(legalBalls / 5) * 3
    let wpB = startWpB + drift * progress + wave
    if (wicketBalls.includes(legalBalls)) wpB -= 9
    wpB = Math.max(5, Math.min(95, wpB))

    const overs = Math.floor(legalBalls / 6)
    const rem = legalBalls % 6
    script.push({ ball: `${overs}.${rem}`, wpB: Math.round(wpB), wpA: Math.round(100 - wpB) })
  }

  // Force the last reading to match the match's headline winProb exactly.
  const last = script[script.length - 1]
  script[script.length - 1] = { ball: last.ball, wpB: finalWpB, wpA: 100 - finalWpB }

  return script
}

// ─────────────────────────────────────────────────────────────
// TEAMS
// ─────────────────────────────────────────────────────────────
const teamA: MatchTeamRef = {
  id: "mock-team-kandy-warriors",
  name: "Kandy Warriors",
  short: "KAW",
  logo: undefined,
  color: "#F5A623",
}

const teamB: MatchTeamRef = {
  id: "mock-team-colombo-kings",
  name: "Colombo Kings",
  short: "COK",
  logo: undefined,
  color: "#DC2626",
}

// ─────────────────────────────────────────────────────────────
// INNINGS 1 — Kandy Warriors, complete: 172/6 in 20 overs
// ─────────────────────────────────────────────────────────────
const innings1Batting: BattingRow[] = [
  { name: "Kasun Perera", runs: 45, balls: 32, fours: 5, sixes: 2, notOut: false, how: "c Chandimal b Rathnayake" },
  { name: "Nuwan Dias", runs: 12, balls: 18, fours: 1, sixes: 0, notOut: false, how: "b Kumara" },
  { name: "Dimuth Chandra", runs: 58, balls: 40, fours: 6, sixes: 3, notOut: false, how: "c Silva b Wickrama" },
  { name: "Sachin Gomez", runs: 22, balls: 19, fours: 2, sixes: 0, notOut: false, how: "run out (Priyanjan)" },
  { name: "Ravindu Silva", runs: 15, balls: 14, fours: 1, sixes: 0, notOut: false, how: "c Peris b Rathnayake" },
  { name: "Malinda Fernando", runs: 8, balls: 9, fours: 0, sixes: 0, notOut: false, how: "st Chandimal b Silva" },
  { name: "Roshan Bandara", runs: 6, balls: 5, fours: 1, sixes: 0, notOut: true, how: "" },
]

const innings1Bowling: BowlingRow[] = [
  { name: "Tharindu Kumara", overs: "4.0", runs: 32, wkts: 2, econ: "8.00" },
  { name: "Chamara Silva", overs: "4.0", runs: 28, wkts: 1, econ: "7.00" },
  { name: "Asela Rathnayake", overs: "4.0", runs: 35, wkts: 2, econ: "8.75" },
  { name: "Buddhika Wickrama", overs: "4.0", runs: 30, wkts: 1, econ: "7.50" },
  { name: "Nipun Herath", overs: "4.0", runs: 41, wkts: 0, econ: "10.25" },
]

const innings1Fow: FowEntry[] = [
  ["1-28", "Nuwan Dias", "4.2"],
  ["2-95", "Kasun Perera", "11.4"],
  ["3-131", "Sachin Gomez", "15.1"],
  ["4-152", "Ravindu Silva", "17.3"],
  ["5-163", "Malinda Fernando", "19.1"],
  ["6-172", "Dimuth Chandra", "19.6"],
]

const innings1: InningsComplete = {
  batting: innings1Batting,
  bowling: innings1Bowling,
  fow: innings1Fow,
  extras: 6,
  extrasNote: "b 2, lb 1, wd 3",
  total: 172,
  wkts: 6,
  overs: "20.0",
  overRuns: [6, 8, 4, 10, 7, 12, 9, 5, 11, 8, 6, 14, 7, 9, 10, 8, 12, 6, 9, 11],
  dnb: ["Isuru Madushanka", "Chaminda Rajapaksa", "Lahiru Weerasinghe", "Danushka Amarasena"],
  potm: undefined,
}

// ─────────────────────────────────────────────────────────────
// INNINGS 2 — Colombo Kings, chasing 173, LIVE at 130/4 (14.3 ov)
// ─────────────────────────────────────────────────────────────
const innings2BattingSoFar: BattingRow[] = [
  { name: "Ishan Fernando", runs: 34, balls: 22, fours: 4, sixes: 2, notOut: false, how: "run out (Bandara)" },
  { name: "Dinesh Chandimal", runs: 8, balls: 10, fours: 0, sixes: 0, notOut: false, how: "c Perera b Kumara" },
  { name: "Kavindu Silva", runs: 52, balls: 38, fours: 6, sixes: 1, notOut: true, how: "" },
  { name: "Ashan Priyanjan", runs: 20, balls: 15, fours: 2, sixes: 0, notOut: false, how: "c Dias b Rathnayake" },
  { name: "Ruwan Peris", runs: 5, balls: 8, fours: 0, sixes: 0, notOut: false, how: "b Wickrama" },
  { name: "Nirmal Jayasuriya", runs: 11, balls: 9, fours: 1, sixes: 0, notOut: true, how: "" },
]

const innings2BowlingSoFar: BowlingRow[] = [
  { name: "Tharindu Kumara", overs: "4.0", runs: 28, wkts: 1, econ: "7.00" },
  { name: "Chamara Silva", overs: "3.3", runs: 30, wkts: 1, econ: "8.57" },
  { name: "Asela Rathnayake", overs: "4.0", runs: 35, wkts: 1, econ: "8.75" },
  { name: "Buddhika Wickrama", overs: "3.0", runs: 37, wkts: 1, econ: "12.33" },
]

const innings2FowSoFar: FowEntry[] = [
  ["1-28", "Ishan Fernando", "4.5"],
  ["2-58", "Dinesh Chandimal", "8.2"],
  ["3-102", "Ashan Priyanjan", "11.4"],
  ["4-119", "Ruwan Peris", "13.2"],
]

// "Final" shape, kept in sync with the partial snapshot below. The UI
// only reads this when matchStatus !== "live", but the type still
// requires a well-formed InningsComplete here.
const innings2Final: InningsComplete = {
  batting: innings2BattingSoFar,
  bowling: innings2BowlingSoFar,
  fow: innings2FowSoFar,
  extras: 0,
  extrasNote: "none",
  total: 130,
  wkts: 4,
  overs: "14.3",
  overRuns: [8, 10, 6, 12, 9, 7, 11, 8, 6, 14, 7, 9, 10, 5, 8],
  dnb: ["Suranga Bandara", "Chathura Weerakkody", "Lasith Munaweera", "Hasitha Wickramasinghe"],
  potm: undefined,
}

const innings2Partial = {
  runsAtStart: 122,
  wktsAtStart: 3,
  overAtStart: "14.0",
  overRunsAtStart: [8, 10, 6, 12, 9, 7, 11, 8, 6, 14, 7, 9, 10, 5],
  over19ExtraRuns: 0,
  batting: innings2BattingSoFar,
  bowling: innings2BowlingSoFar,
  fow: innings2FowSoFar,
}

// ─────────────────────────────────────────────────────────────
// SQUADS
// ─────────────────────────────────────────────────────────────
const squads: MatchSquad[] = [
  {
    team: teamA.name,
    captain: "Dimuth Chandra",
    players: [
      { name: "Kasun Perera", role: "Opening Batter", xi: true },
      { name: "Nuwan Dias", role: "Opening Batter", xi: true },
      { name: "Dimuth Chandra", role: "Batter (c)", xi: true },
      { name: "Sachin Gomez", role: "Middle-order Batter", xi: true },
      { name: "Ravindu Silva", role: "All-rounder", xi: true },
      { name: "Malinda Fernando", role: "Wicketkeeper", xi: true },
      { name: "Roshan Bandara", role: "All-rounder", xi: true },
      { name: "Isuru Madushanka", role: "Fast Bowler", xi: true },
      { name: "Chaminda Rajapaksa", role: "Spin Bowler", xi: true },
      { name: "Lahiru Weerasinghe", role: "Fast Bowler", xi: true },
      { name: "Danushka Amarasena", role: "Spin Bowler", xi: true },
      { name: "Kavishka Rodrigo", role: "Batter", xi: false },
      { name: "Sahan Wickrama", role: "Fast Bowler", xi: false },
    ],
  },
  {
    team: teamB.name,
    captain: "Dinesh Chandimal",
    players: [
      { name: "Ishan Fernando", role: "Opening Batter", xi: true },
      { name: "Dinesh Chandimal", role: "Wicketkeeper (c)", xi: true },
      { name: "Kavindu Silva", role: "Middle-order Batter", xi: true },
      { name: "Ashan Priyanjan", role: "Middle-order Batter", xi: true },
      { name: "Ruwan Peris", role: "All-rounder", xi: true },
      { name: "Nirmal Jayasuriya", role: "All-rounder", xi: true },
      { name: "Suranga Bandara", role: "Fast Bowler", xi: true },
      { name: "Chathura Weerakkody", role: "Spin Bowler", xi: true },
      { name: "Tharindu Kumara", role: "Fast Bowler", xi: true },
      { name: "Chamara Silva", role: "Spin Bowler", xi: true },
      { name: "Asela Rathnayake", role: "Fast Bowler", xi: true },
      { name: "Buddhika Wickrama", role: "Fast Bowler", xi: true },
      { name: "Lasith Munaweera", role: "Batter", xi: false },
      { name: "Hasitha Wickramasinghe", role: "Spin Bowler", xi: false },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// FULL MATCH DETAIL
// ─────────────────────────────────────────────────────────────
export const mockLiveMatch: MockMatchDetail = {
  id: "mock-match-live-001",
  tournamentSlug: "valiant-premier-league",
  tournamentName: "Valiant Premier League 2026",
  round: "Qualifier 1",
  venue: "Pallekele International Cricket Stadium",
  date: "July 25, 2026",
  time: "7:00 PM",
  toss: "Colombo Kings won the toss and chose to field",
  target: 173,
  resultNote: "",
  pitch: "Dry surface, expected to assist spinners as the match progresses",
  context: "Both sides unbeaten so far this season — the winner tops the points table.",
  officials: {
    umpires: "R. Silva & K. Perera",
    thirdUmpire: "N. Fernando",
    referee: "A. Jayasekara",
    format: "T20 · 20 overs per side",
  },
  teamA,
  teamB,
  innings1,
  innings2Final,
  innings2Partial,
  squads,
  currentInnings: 2 as MatchDetail["currentInnings"],
  matchStatus: "live",
  isLive: true,
  hasBallData: true,
  winProb: { a: 38, b: 62 },
  // 14.3 overs = 87 legal balls; wickets fell at legal-ball counts 29, 50,
  // 70, 80 (matching innings2FowSoFar's "4.5", "8.2", "11.4", "13.2").
  liveScript: buildLiveScript(87, 62, [29, 50, 70, 80]),
}

/**
 * Wraps mockLiveMatch in the same MatchLookupResult shape that
 * getMatchDetailById returns, so it can be swapped in 1-for-1 wherever
 * the real fetcher is used (e.g. a /demo/match page).
 */
export function getMockMatchDetail(): MatchLookupResult {
  return { ok: true, match: mockLiveMatch }
}

// ─────────────────────────────────────────────────────────────
// Extra variants — handy if the demo should also show a match that
// hasn't started, or one that's already finished.
// ─────────────────────────────────────────────────────────────
export const mockNotStartedMatch: MockMatchDetail = {
  ...mockLiveMatch,
  id: "mock-match-not-started-001",
  matchStatus: "not_started",
  isLive: false,
  hasBallData: false,
  toss: "",
  resultNote: "",
  winProb: undefined,
  liveScript: [],
  innings1: {
    batting: [],
    bowling: [],
    fow: [],
    extras: 0,
    extrasNote: "none",
    total: 0,
    wkts: 0,
    overs: "0.0",
    overRuns: [],
  },
  innings2Final: {
    batting: [],
    bowling: [],
    fow: [],
    extras: 0,
    extrasNote: "none",
    total: 0,
    wkts: 0,
    overs: "0.0",
    overRuns: [],
  },
  innings2Partial: {
    runsAtStart: 0,
    wktsAtStart: 0,
    overAtStart: "0.0",
    overRunsAtStart: [],
    over19ExtraRuns: 0,
    batting: [],
    bowling: [],
    fow: [],
  },
}

export const mockCompletedMatch: MockMatchDetail = {
  ...mockLiveMatch,
  id: "mock-match-completed-001",
  matchStatus: "completed",
  isLive: false,
  resultNote: "Colombo Kings won by 6 wickets (8 balls remaining)",
  // 18.4 overs = 112 legal balls; same early wickets as the live snapshot,
  // trending to 100% once the winning runs are hit.
  liveScript: buildLiveScript(112, 100, [29, 50, 70, 80]),
  innings2Final: {
    batting: [
      ...innings2BattingSoFar.slice(0, -1),
      { name: "Nirmal Jayasuriya", runs: 30, balls: 20, fours: 3, sixes: 1, notOut: true, how: "" },
    ],
    bowling: innings2BowlingSoFar,
    fow: innings2FowSoFar,
    extras: 5,
    extrasNote: "b 1, lb 2, wd 2",
    total: 176,
    wkts: 4,
    overs: "18.4",
    overRuns: [8, 10, 6, 12, 9, 7, 11, 8, 6, 14, 7, 9, 10, 5, 8, 12, 9, 15, 10],
  },
  innings2Partial: innings2Partial, // unused once completed, kept for type shape
}

export function getMockMatchDetailByStatus(
  status: "not_started" | "live" | "completed"
): MatchLookupResult {
  const match =
    status === "not_started" ? mockNotStartedMatch : status === "completed" ? mockCompletedMatch : mockLiveMatch
  return { ok: true, match }
}