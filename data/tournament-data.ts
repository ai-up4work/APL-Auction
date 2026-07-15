// ─────────────────────────────────────────────────────────────
// ADD to your existing @/data/tournament-data.ts
// These extend ShowcaseSlide with cricket-specific fields and
// provide one fully-populated mock tournament as an example.
// Merge the interface fields into your existing ShowcaseSlide type,
// and merge `cricketMockTournament` into your showcaseSlides array
// (or use it standalone via getTournamentBySlug for testing).
// ─────────────────────────────────────────────────────────────

export interface BallEvent {
  runs: number // 0-6, or -1 for wicket, -2 for wide/no-ball
  label: string // "4", "6", "W", "•", "wd"
}

export interface LiveMatch {
  matchStatus: "live" | "upcoming" | "completed"
  team1: { name: string; short: string; logo?: string }
  team2: { name: string; short: string; logo?: string }
  inningsTeam: string // which team is currently batting (short name)
  score1: string // "184/6"
  overs1: string // "18.4"
  score2?: string
  overs2?: string
  target?: number
  crr: string // current run rate e.g. "9.85"
  rrr?: string // required run rate if chasing
  batsmen: { name: string; runs: number; balls: number; onStrike: boolean }[]
  bowler: { name: string; overs: string; runs: number; wickets: number }
  recentBalls: BallEvent[]
  venue: string
  toss: string // "Wardens FC won the toss, elected to bowl"
  matchNote?: string // "2nd Innings" / "Match ends in a Super Over" etc
}

export interface PointsRow {
  team: string
  short: string
  played: number
  won: number
  lost: number
  nrr: string // "+1.245"
  points: number
  form?: ("W" | "L" | "NR")[] // last 5 results, most recent last
}

export interface Fixture {
  id: string
  team1: string
  team2: string
  date: string // "12 Aug 2026"
  time: string // "7:00 PM IST"
  venue: string
  status: "upcoming" | "live" | "completed"
  result?: string // "Wardens FC won by 24 runs"
}

export interface BracketTeam {
  name: string
  short: string
  score?: string // filled in once the match is played
}

export interface BracketMatch {
  id: string
  label: string // "Qualifier 1", "Eliminator", "Qualifier 2", "Final"
  team1: BracketTeam
  team2: BracketTeam
  winner?: string // short name of winner, undefined if not yet played
  date?: string
}

// Add these optional fields onto your existing ShowcaseSlide interface:
//
// export interface ShowcaseSlide {
//   ...existing fields...
//   liveMatch?: LiveMatch
//   pointsTable?: PointsRow[]
//   fixtures?: Fixture[]
//   bracket?: BracketMatch[]
// }

export const cricketMockTournament = {
  title: "Valiant Premier League 2026",
  slug: "valiant-premier-league-2026",
  tag: "T20 Cricket",
  by: "Valiant League Cricket",
  status: "Live",
  startDate: "01 Aug 2026",
  image: "/placeholder.svg",
  description:
    "An 8-team T20 franchise tournament run entirely on Valiant League — live auctions to build every squad, automatic league-stage scheduling, and a broadcast-grade scoring console feeding real-time scorecards straight to this page.",
  format:
    "Round-robin league stage (8 teams, 14 matches), followed by a 4-team playoff stage (Qualifier 1, Eliminator, Qualifier 2, Final).",
  prizePool: "LKR 5,000,000",
  prizes: [
    { place: "Champions", reward: "LKR 2,500,000 + Trophy" },
    { place: "Runners-up", reward: "LKR 1,200,000" },
    { place: "Most Valuable Player", reward: "LKR 300,000" },
    { place: "Best Bowler", reward: "LKR 200,000" },
  ],
  rules: [
    "Each team fields 11 players from a 15-player auctioned squad",
    "Standard T20 rules — 20 overs per innings, DLS method applies for rain-affected matches",
    "Maximum 4 overseas players in a starting XI",
    "Points: 2 for a win, 1 for a no-result, 0 for a loss — ties decided by Super Over",
    "Net Run Rate (NRR) used as the primary tiebreaker for league-stage standings",
  ],
  website: "https://valiantleague.example.com",
  twitter: "https://twitter.com/thewardensgc",
  discord: "https://discord.gg/example",

  liveMatch: {
    matchStatus: "live",
    team1: { name: "Colombo Kings", short: "CK" },
    team2: { name: "Kandy Warriors", short: "KW" },
    inningsTeam: "KW",
    score1: "186/5",
    overs1: "20.0",
    score2: "142/4",
    overs2: "16.2",
    target: 187,
    crr: "8.69",
    rrr: "12.16",
    batsmen: [
      { name: "D. Fernando", runs: 58, balls: 34, onStrike: true },
      { name: "R. Jayasuriya", runs: 41, balls: 28, onStrike: false },
    ],
    bowler: { name: "M. Perera", overs: "3.2", runs: 29, wickets: 2 },
    recentBalls: [
      { runs: 1, label: "1" },
      { runs: 4, label: "4" },
      { runs: 0, label: "•" },
      { runs: 6, label: "6" },
      { runs: -1, label: "W" },
      { runs: 2, label: "2" },
    ],
    venue: "R. Premadasa Stadium, Colombo",
    toss: "Kandy Warriors won the toss, elected to field",
    matchNote: "2nd Innings — KW need 45 runs off 22 balls",
  } as LiveMatch,

  pointsTable: [
    { team: "Colombo Kings", short: "CK", played: 9, won: 7, lost: 2, nrr: "+1.245", points: 14, form: ["W", "W", "L", "W", "W"] },
    { team: "Galle Gladiators", short: "GG", played: 9, won: 6, lost: 3, nrr: "+0.812", points: 12, form: ["L", "W", "W", "W", "L"] },
    { team: "Kandy Warriors", short: "KW", played: 9, won: 5, lost: 4, nrr: "+0.203", points: 10, form: ["W", "L", "W", "L", "W"] },
    { team: "Jaffna Stallions", short: "JS", played: 9, won: 5, lost: 4, nrr: "-0.058", points: 10, form: ["L", "L", "W", "W", "W"] },
    { team: "Negombo Titans", short: "NT", played: 9, won: 4, lost: 5, nrr: "-0.312", points: 8, form: ["W", "L", "L", "W", "L"] },
    { team: "Matara Marauders", short: "MM", played: 9, won: 3, lost: 6, nrr: "-0.541", points: 6, form: ["L", "L", "W", "L", "L"] },
    { team: "Kurunegala Royals", short: "KR", played: 9, won: 2, lost: 7, nrr: "-0.890", points: 4, form: ["L", "L", "L", "W", "L"] },
    { team: "Trinco Blasters", short: "TB", played: 9, won: 2, lost: 7, nrr: "-1.104", points: 4, form: ["L", "L", "L", "L", "W"] },
  ] as PointsRow[],

  fixtures: [
    {
      id: "m10",
      team1: "Colombo Kings",
      team2: "Kandy Warriors",
      date: "15 Aug 2026",
      time: "7:00 PM IST",
      venue: "R. Premadasa Stadium, Colombo",
      status: "live",
    },
    {
      id: "m11",
      team1: "Galle Gladiators",
      team2: "Jaffna Stallions",
      date: "16 Aug 2026",
      time: "7:00 PM IST",
      venue: "Galle International Stadium",
      status: "upcoming",
    },
    {
      id: "m12",
      team1: "Negombo Titans",
      team2: "Matara Marauders",
      date: "17 Aug 2026",
      time: "3:30 PM IST",
      venue: "Negombo Cricket Ground",
      status: "upcoming",
    },
    {
      id: "m9",
      team1: "Kurunegala Royals",
      team2: "Trinco Blasters",
      date: "13 Aug 2026",
      time: "7:00 PM IST",
      venue: "Kurunegala Stadium",
      status: "completed",
      result: "Kurunegala Royals won by 24 runs",
    },
    {
      id: "m8",
      team1: "Colombo Kings",
      team2: "Galle Gladiators",
      date: "11 Aug 2026",
      time: "7:00 PM IST",
      venue: "R. Premadasa Stadium, Colombo",
      status: "completed",
      result: "Colombo Kings won by 6 wickets",
    },
  ] as Fixture[],

  bracket: [
    {
      id: "q1",
      label: "Qualifier 1",
      team1: { name: "Colombo Kings", short: "CK" },
      team2: { name: "Galle Gladiators", short: "GG" },
      date: "20 Aug 2026",
    },
    {
      id: "elim",
      label: "Eliminator",
      team1: { name: "Kandy Warriors", short: "KW" },
      team2: { name: "Jaffna Stallions", short: "JS" },
      date: "21 Aug 2026",
    },
    {
      id: "q2",
      label: "Qualifier 2",
      team1: { name: "TBD", short: "TBD" },
      team2: { name: "TBD", short: "TBD" },
      date: "23 Aug 2026",
    },
    {
      id: "final",
      label: "Final",
      team1: { name: "TBD", short: "TBD" },
      team2: { name: "TBD", short: "TBD" },
      date: "26 Aug 2026",
    },
  ] as BracketMatch[],
}