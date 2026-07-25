// lib/cricket-engine.ts
// Framework-agnostic scorecard math — used by BOTH the server-side
// getMatchDetailById() and the client-side useLiveMatch() hook, so the
// two never drift apart.

export interface BallRow {
  id: number
  match_id: string
  innings_number: number
  sequence: number
  over_number: number
  ball_number: number
  striker_name: string | null
  non_striker_name: string | null
  bowler_name: string | null
  runs: number
  extra_type: string | null
  is_wicket: boolean
  dismissal_type: string | null
  batsman_out: string | null
  fielder: string | null
}

export interface BattingRow {
  name: string
  runs: number
  balls: number
  fours: number
  sixes: number
  notOut: boolean
  how: string
}

export interface BowlingRow {
  name: string
  overs: string
  runs: number
  wkts: number
  econ: string
}

export type FowEntry = [string, string, string]

export interface InningsAggregate {
  batting: BattingRow[]
  bowling: BowlingRow[]
  fow: FowEntry[]
  extras: number
  extrasNote: string
  total: number
  wkts: number
  overs: string
  overRuns: number[]
}

export function formatOvers(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6)
  const rem = legalBalls % 6
  return `${overs}.${rem}`
}

export function aggregateInnings(balls: BallRow[]): InningsAggregate {
  const sorted = [...balls].sort((a, b) => a.sequence - b.sequence)

  type BatAcc = { runs: number; balls: number; fours: number; sixes: number; out: boolean; how: string; order: number }
  type BowlAcc = { legalBalls: number; runs: number; wkts: number; order: number }

  const batting = new Map<string, BatAcc>()
  const bowling = new Map<string, BowlAcc>()
  const fow: FowEntry[] = []
  const overRunsMap = new Map<number, number>()

  let battingOrder = 0
  let bowlingOrder = 0
  let extrasTotal = 0
  const extrasByType = { wd: 0, nb: 0, b: 0, lb: 0, p: 0 }
  let teamTotal = 0
  let teamWkts = 0
  let legalDeliveries = 0
  let lastOver = 0
  let lastBallInOver = 0

  for (const row of sorted) {
    const striker = row.striker_name ?? "Unknown"
    const bowler = row.bowler_name ?? "Unknown"
    const isWide = row.extra_type === "wide"
    const isNoBall = row.extra_type === "no_ball"
    const isBye = row.extra_type === "bye"
    const isLegBye = row.extra_type === "leg_bye"
    const isLegal = !isWide && !isNoBall

    teamTotal += row.runs
    if (row.extra_type) {
      extrasTotal += row.runs
      if (isWide) extrasByType.wd += row.runs
      else if (isNoBall) extrasByType.nb += row.runs
      else if (isBye) extrasByType.b += row.runs
      else if (isLegBye) extrasByType.lb += row.runs
      else extrasByType.p += row.runs
    }

    if (!batting.has(striker)) {
      batting.set(striker, { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, how: "", order: battingOrder++ })
    }
    const bat = batting.get(striker)!
    if (!isWide) bat.balls += 1
    if (!row.extra_type) {
      bat.runs += row.runs
      if (row.runs === 4) bat.fours += 1
      if (row.runs === 6) bat.sixes += 1
    }

    if (!bowling.has(bowler)) {
      bowling.set(bowler, { legalBalls: 0, runs: 0, wkts: 0, order: bowlingOrder++ })
    }
    const bowl = bowling.get(bowler)!
    if (isLegal) bowl.legalBalls += 1
    if (!isBye && !isLegBye) bowl.runs += row.runs

    if (row.is_wicket) {
      teamWkts += 1
      bat.out = true
      const dismissalText = row.dismissal_type
        ? `${row.dismissal_type}${row.fielder ? ` (${row.fielder})` : ""}`
        : "out"
      bat.how = dismissalText
      if (row.dismissal_type !== "run_out") bowl.wkts += 1
      fow.push([`${teamWkts}-${teamTotal}`, row.batsman_out ?? striker, formatOvers(legalDeliveries + (isLegal ? 1 : 0))])
    }

    if (isLegal) {
      legalDeliveries += 1
      lastOver = row.over_number
      lastBallInOver = row.ball_number
    }
    overRunsMap.set(row.over_number, (overRunsMap.get(row.over_number) ?? 0) + row.runs)
  }

  const battingRows: BattingRow[] = [...batting.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([name, b]) => ({ name, runs: b.runs, balls: b.balls, fours: b.fours, sixes: b.sixes, notOut: !b.out, how: b.how }))

  const bowlingRows: BowlingRow[] = [...bowling.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([name, b]) => {
      const oversFaced = b.legalBalls / 6
      return { name, overs: formatOvers(b.legalBalls), runs: b.runs, wkts: b.wkts, econ: oversFaced > 0 ? (b.runs / oversFaced).toFixed(2) : "0.00" }
    })

  const extrasNoteParts: string[] = []
  if (extrasByType.b) extrasNoteParts.push(`b ${extrasByType.b}`)
  if (extrasByType.lb) extrasNoteParts.push(`lb ${extrasByType.lb}`)
  if (extrasByType.wd) extrasNoteParts.push(`wd ${extrasByType.wd}`)
  if (extrasByType.nb) extrasNoteParts.push(`nb ${extrasByType.nb}`)
  if (extrasByType.p) extrasNoteParts.push(`p ${extrasByType.p}`)

  const maxOver = Math.max(0, ...[...overRunsMap.keys()])
  const overRuns: number[] = []
  for (let o = 1; o <= maxOver; o++) overRuns.push(overRunsMap.get(o) ?? 0)

  return {
    batting: battingRows,
    bowling: bowlingRows,
    fow,
    extras: extrasTotal,
    extrasNote: extrasNoteParts.join(", ") || "none",
    total: teamTotal,
    wkts: teamWkts,
    overs: legalDeliveries > 0 ? `${lastOver}.${lastBallInOver}` : "0.0",
    overRuns,
  }
}

// ── match_setup jsonb parsing / squad building ──
export interface MatchSetupTeam { name: string; short: string }
export interface MatchSetupSquadPlayer { playerId?: string; name: string; role: string; xi: boolean }
export interface MatchSetupSquad { teamId: string; captain: string; players: MatchSetupSquadPlayer[] }
export interface MatchSetup {
  team1: MatchSetupTeam
  team2: MatchSetupTeam
  date?: string
  time?: string
  toss?: string | null
  overs?: number
  venue?: string
  tournamentId?: string
  round?: string
  pitch?: string
  context?: string
  target?: number
  resultNote?: string
  officials?: { umpires?: string; thirdUmpire?: string; referee?: string; format?: string }
  squads?: MatchSetupSquad[]
  /**
   * Explicit source of truth for which innings is currently in progress.
   * Set by the simulator (and any future manual scoring UI) at the exact
   * moment each innings starts — never inferred from ball counts, so the
   * "who's batting / who needs what" UI can never show a phantom target
   * for an innings that hasn't started yet.
   */
  currentInnings?: 1 | 2
}

function isMatchSetupTeam(v: unknown): v is MatchSetupTeam {
  return !!v && typeof v === "object" && typeof (v as any).name === "string" && typeof (v as any).short === "string"
}

export function parseMatchSetup(raw: unknown): MatchSetup | null {
  if (!raw || typeof raw !== "object") return null
  const setup = raw as Partial<MatchSetup>
  if (!isMatchSetupTeam(setup.team1) || !isMatchSetupTeam(setup.team2)) return null
  return setup as MatchSetup
}

export interface MatchSquad { team: string; captain: string; players: { name: string; role: string; xi: boolean }[] }

export function buildSquads(setup: MatchSetup, teamAName: string, teamBName: string): MatchSquad[] {
  if (!setup.squads || setup.squads.length === 0) return []
  return setup.squads.map((s) => {
    const tag = s.teamId?.toLowerCase?.() ?? ""
    const isTeamA = tag === "team1" || tag === setup.team1.short.toLowerCase() || tag === teamAName.toLowerCase()
    const isTeamB = tag === "team2" || tag === setup.team2.short.toLowerCase() || tag === teamBName.toLowerCase()
    const teamName = isTeamA ? teamAName : isTeamB ? teamBName : "Unknown Team"
    return { team: teamName, captain: s.captain, players: s.players.map((p) => ({ name: p.name, role: p.role, xi: p.xi })) }
  })
}