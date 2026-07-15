// data/tournament-data.ts
// Cricket-specific tournament data. Base tournament info (title, image, tag,
// slug, description, format, prizes, socials) lives in `site-data.ts` as
// `showcaseSlides` — this file only adds the richer cricket data (live
// scores, points tables, fixtures, brackets, squads, leaderboards, awards)
// and merges it in by slug.

import { showcaseSlides, slugify, type ShowcaseSlide } from "@/data/site-data"

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export interface BallEvent {
  runs: number
  label: string
}

export interface LiveMatch {
  matchStatus: "live" | "upcoming" | "completed"
  team1: { name: string; short: string }
  team2: { name: string; short: string }
  inningsTeam: string
  score1: string
  overs1: string
  score2?: string
  overs2?: string
  target?: number
  crr: string
  rrr?: string
  batsmen: { name: string; runs: number; balls: number; onStrike: boolean }[]
  bowler: { name: string; overs: string; runs: number; wickets: number }
  recentBalls: BallEvent[]
  venue: string
  toss: string
  matchNote?: string
}

export interface PointsRow {
  team: string
  short: string
  played: number
  won: number
  lost: number
  nrr: string
  points: number
  form?: ("W" | "L" | "NR")[]
}

export interface Fixture {
  id: string
  team1: string
  team2: string
  date: string
  time: string
  venue: string
  status: "upcoming" | "live" | "completed"
  result?: string
}

export interface BracketTeam {
  name: string
  short: string
  score?: string
}

export interface BracketMatch {
  id: string
  label: string
  team1: BracketTeam
  team2: BracketTeam
  winner?: string
  date?: string
}

export interface SquadMember {
  name: string
  isCaptain?: boolean
}

export interface Squad {
  team: string
  captain: string
  players: SquadMember[]
}

export interface LeaderboardRow {
  rank: number
  player: string
  team: string
  value: number
  meta: string
}

export interface AwardEntry {
  label: string
  name: string
  note: string
}

// Extras layered onto a ShowcaseSlide to make the full tournament detail page.
export interface TournamentExtras {
  liveMatch?: LiveMatch
  pointsTable?: PointsRow[]
  fixtures?: Fixture[]
  bracket?: BracketMatch[]
  squads?: Squad[]
  runsLeaderboard?: LeaderboardRow[]
  wicketsLeaderboard?: LeaderboardRow[]
  awards?: AwardEntry[]
}

export type Tournament = ShowcaseSlide & TournamentExtras

// ─────────────────────────────────────────────────────────────
// EXTRAS — keyed by the `slug` field already on each ShowcaseSlide
// ─────────────────────────────────────────────────────────────
const tournamentExtras: Record<string, TournamentExtras> = {
  // ───────────────────────────── Auction ─────────────────────
  "iron-knights-season-opener": {
    squads: [
      {
        team: "Iron Knights CC",
        captain: "R. Fernando",
        players: [
          { name: "R. Fernando", isCaptain: true },
          { name: "T. Rathnayake" },
          { name: "N. Silva" },
          { name: "P. Jayawardena" },
        ],
      },
      {
        team: "Silver Hawks",
        captain: "D. Silva",
        players: [
          { name: "D. Silva", isCaptain: true },
          { name: "M. Gunasekara" },
          { name: "R. Kariyawasam" },
        ],
      },
      {
        team: "Golden Lions",
        captain: "K. Perera",
        players: [
          { name: "K. Perera", isCaptain: true },
          { name: "A. Wickramasinghe" },
          { name: "D. Mendis" },
        ],
      },
    ],
    fixtures: [
      { id: "opener-1", team1: "Iron Knights CC", team2: "Silver Hawks", date: "18 Jul", time: "3:00 PM", venue: "Ground 1", status: "upcoming" },
      { id: "opener-2", team1: "Golden Lions", team2: "Iron Knights CC", date: "20 Jul", time: "7:00 PM", venue: "Ground 2", status: "upcoming" },
    ],
    awards: [
      { label: "Highest Bid", name: "T. Rathnayake", note: "LKR 85,000 to Iron Knights CC" },
      { label: "Most Players Bought", name: "Iron Knights CC", note: "14 players secured" },
    ],
  },

  // ───────────────────────────── Bracket ─────────────────────
  "silver-cup-knockout": {
    bracket: [
      { id: "r16-1", label: "Round of 16", team1: { name: "Royal Strikers", short: "RS", score: "156/7" }, team2: { name: "Iron Wolves", short: "IW", score: "142/9" }, winner: "RS", date: "10 Jul" },
      { id: "r16-2", label: "Round of 16", team1: { name: "Crimson Blades", short: "CB", score: "178/4" }, team2: { name: "Silver Hawks", short: "SH", score: "160/6" }, winner: "CB", date: "10 Jul" },
      { id: "qf-1", label: "Quarterfinal", team1: { name: "Royal Strikers", short: "RS", score: "165/5" }, team2: { name: "Crimson Blades", short: "CB", score: "150/8" }, winner: "RS", date: "13 Jul" },
      { id: "qf-2", label: "Quarterfinal", team1: { name: "TBD", short: "TBD" }, team2: { name: "TBD", short: "TBD" }, date: "13 Jul" },
      { id: "sf-1", label: "Semifinal", team1: { name: "Royal Strikers", short: "RS" }, team2: { name: "TBD", short: "TBD" }, date: "17 Jul" },
      { id: "final", label: "Final", team1: { name: "TBD", short: "TBD" }, team2: { name: "TBD", short: "TBD" }, date: "20 Jul" },
    ],
    fixtures: [
      { id: "qf-2-fx", team1: "Northside Knights", team2: "Storm Chargers", date: "13 Jul", time: "4:00 PM", venue: "Ground 1", status: "upcoming" },
      { id: "sf-1-fx", team1: "Royal Strikers", team2: "Winner QF2", date: "17 Jul", time: "6:00 PM", venue: "Ground 1", status: "upcoming" },
    ],
    squads: [
      { team: "Royal Strikers", captain: "M. Jayasuriya", players: [{ name: "M. Jayasuriya", isCaptain: true }, { name: "L. Fonseka" }, { name: "H. de Silva" }] },
      { team: "Crimson Blades", captain: "S. Bandara", players: [{ name: "S. Bandara", isCaptain: true }, { name: "N. Gunaratne" }] },
    ],
    awards: [
      { label: "Best Bowling Figures (so far)", name: "M. Jayasuriya", note: "5/18 vs Iron Wolves" },
    ],
  },

  // ───────────────────────────── Overlay (live stream) ────────
  "golden-lions-broadcast": {
    liveMatch: {
      matchStatus: "live",
      team1: { name: "Golden Lions", short: "GL" },
      team2: { name: "Falcon Riders", short: "FR" },
      inningsTeam: "FR",
      score1: "184/5",
      overs1: "20.0",
      score2: "151/4",
      overs2: "17.4",
      target: 185,
      crr: "8.55",
      rrr: "14.35",
      batsmen: [
        { name: "K. Perera", runs: 64, balls: 38, onStrike: true },
        { name: "A. Wickramasinghe", runs: 29, balls: 19, onStrike: false },
      ],
      bowler: { name: "T. Rathnayake", overs: "2.4", runs: 24, wickets: 1 },
      recentBalls: [
        { runs: 4, label: "4" },
        { runs: 1, label: "1" },
        { runs: 6, label: "6" },
        { runs: 0, label: "W" },
        { runs: 2, label: "2" },
        { runs: 0, label: "0" },
      ],
      venue: "Negombo Cricket Grounds",
      toss: "Falcon Riders won the toss, elected to bowl",
      matchNote: "FR need 34 runs from 14 balls",
    },
    awards: [
      { label: "Peak Concurrent Viewers", name: "12,000", note: "Reached during the 16th over" },
    ],
  },

  // ───────────────────────────── League (flagship) ────────────
  "crimson-cup-full-season": {
    liveMatch: {
      matchStatus: "live",
      team1: { name: "Valiant Originals", short: "VO" },
      team2: { name: "Desert Hawks", short: "DH" },
      inningsTeam: "DH",
      score1: "168/6",
      overs1: "20.0",
      score2: "142/6",
      overs2: "18.2",
      target: 169,
      crr: "7.74",
      rrr: "16.20",
      batsmen: [
        { name: "D. Silva", runs: 58, balls: 34, onStrike: true },
        { name: "M. Gunasekara", runs: 21, balls: 14, onStrike: false },
      ],
      bowler: { name: "N. Silva", overs: "3.2", runs: 28, wickets: 2 },
      recentBalls: [
        { runs: 1, label: "1" },
        { runs: 4, label: "4" },
        { runs: 0, label: "W" },
        { runs: 6, label: "6" },
        { runs: 2, label: "2" },
        { runs: 0, label: "0" },
      ],
      venue: "Negombo Cricket Grounds",
      toss: "Desert Hawks won the toss, elected to bowl",
      matchNote: "DH need 27 runs from 10 balls · Final",
    },
    pointsTable: [
      { team: "Valiant Originals", short: "VO", played: 8, won: 6, lost: 2, nrr: "+1.42", points: 12, form: ["W", "W", "L", "W", "W"] },
      { team: "Desert Hawks", short: "DH", played: 8, won: 5, lost: 3, nrr: "+0.87", points: 10, form: ["W", "L", "W", "W", "L"] },
      { team: "Coastal Titans", short: "CT", played: 8, won: 5, lost: 3, nrr: "+0.31", points: 10, form: ["L", "W", "W", "L", "W"] },
      { team: "Northside Knights", short: "NK", played: 8, won: 4, lost: 4, nrr: "-0.05", points: 8, form: ["W", "L", "L", "W", "L"] },
      { team: "Storm Chargers", short: "SC", played: 8, won: 2, lost: 6, nrr: "-0.71", points: 4, form: ["L", "L", "W", "L", "L"] },
      { team: "Bronze Trophy Alliance", short: "BTA", played: 8, won: 2, lost: 6, nrr: "-1.68", points: 4, form: ["L", "L", "L", "W", "L"] },
    ],
    fixtures: [
      { id: "sf1-hawks-titans", team1: "Desert Hawks", team2: "Coastal Titans", date: "16 Jul", time: "3:00 PM", venue: "Ground 1", status: "upcoming" },
      { id: "sf1-knights-chargers", team1: "Northside Knights", team2: "Storm Chargers", date: "17 Jul", time: "3:00 PM", venue: "Ground 2", status: "upcoming" },
      { id: "grp-originals-hawks", team1: "Valiant Originals", team2: "Desert Hawks", date: "19 Jul", time: "7:00 PM", venue: "Ground 1", status: "upcoming" },
    ],
    bracket: [
      { id: "q1", label: "Qualifier 1", team1: { name: "Valiant Originals", short: "VO", score: "168/6" }, team2: { name: "Desert Hawks", short: "DH", score: "142/6" }, winner: "VO", date: "12 Jul" },
      { id: "elim", label: "Eliminator", team1: { name: "Coastal Titans", short: "CT" }, team2: { name: "Northside Knights", short: "NK" }, date: "16 Jul" },
      { id: "final", label: "Final", team1: { name: "Valiant Originals", short: "VO" }, team2: { name: "TBD", short: "TBD" }, date: "28 Jul" },
    ],
    squads: [
      { team: "Valiant Originals", captain: "R. Fernando", players: [{ name: "R. Fernando", isCaptain: true }, { name: "T. Rathnayake" }, { name: "N. Silva" }] },
      { team: "Desert Hawks", captain: "D. Silva", players: [{ name: "D. Silva", isCaptain: true }, { name: "M. Gunasekara" }, { name: "R. Kariyawasam" }] },
    ],
    runsLeaderboard: [
      { rank: 1, player: "R. Fernando", team: "Valiant Originals", value: 412, meta: "SR 148.2" },
      { rank: 2, player: "D. Silva", team: "Desert Hawks", value: 389, meta: "SR 136.9" },
      { rank: 3, player: "M. Gunasekara", team: "Desert Hawks", value: 351, meta: "SR 141.5" },
    ],
    wicketsLeaderboard: [
      { rank: 1, player: "N. Silva", team: "Valiant Originals", value: 18, meta: "Econ 6.8" },
      { rank: 2, player: "T. Rathnayake", team: "Valiant Originals", value: 16, meta: "Econ 7.1" },
      { rank: 3, player: "S. Kumara", team: "Storm Chargers", value: 15, meta: "Econ 7.4" },
    ],
    awards: [
      { label: "Player of the Tournament (so far)", name: "R. Fernando", note: "412 runs · 3 fifties" },
      { label: "Best Bowling Figures", name: "N. Silva", note: "5/18 vs Storm Chargers" },
      { label: "Fastest Fifty", name: "D. Silva", note: "21 balls vs Northside Knights" },
    ],
  },

  // ───────────────────────────── League (round robin) ────────
  "bronze-trophy-series": {
    pointsTable: [
      { team: "Bronze Trophy Alliance", short: "BTA", played: 4, won: 4, lost: 0, nrr: "+1.85", points: 8, form: ["W", "W", "W", "W"] },
      { team: "Silver Hawks", short: "SH", played: 4, won: 3, lost: 1, nrr: "+0.62", points: 6, form: ["W", "W", "L", "W"] },
      { team: "Iron Wolves", short: "IW", played: 4, won: 2, lost: 2, nrr: "-0.11", points: 4, form: ["L", "W", "W", "L"] },
      { team: "Crimson Blades", short: "CB", played: 4, won: 1, lost: 3, nrr: "-0.74", points: 2, form: ["L", "L", "W", "L"] },
      { team: "Northside Knights", short: "NK", played: 4, won: 0, lost: 4, nrr: "-1.52", points: 0, form: ["L", "L", "L", "L"] },
    ],
    fixtures: [
      { id: "bts-1", team1: "Silver Hawks", team2: "Iron Wolves", date: "16 Jul", time: "2:00 PM", venue: "Ground 3", status: "upcoming" },
      { id: "bts-2", team1: "Bronze Trophy Alliance", team2: "Crimson Blades", date: "17 Jul", time: "2:00 PM", venue: "Ground 3", status: "upcoming" },
      { id: "bts-3", team1: "Northside Knights", team2: "Silver Hawks", date: "18 Jul", time: "5:00 PM", venue: "Ground 3", status: "upcoming", result: "" },
    ],
    awards: [
      { label: "Unbeaten Run", name: "Bronze Trophy Alliance", note: "4 wins from 4 matches" },
    ],
  },

  // ───────────────────────────── Auction (winter sale) ────────
  "wardens-winter-sale": {
    squads: [
      {
        team: "The Wardens CC",
        captain: "K. Perera",
        players: [
          { name: "K. Perera", isCaptain: true },
          { name: "A. Wickramasinghe" },
          { name: "D. Mendis" },
          { name: "S. Bandara" },
          { name: "N. Gunaratne" },
        ],
      },
      {
        team: "Golden Lions",
        captain: "R. Fernando",
        players: [
          { name: "R. Fernando", isCaptain: true },
          { name: "T. Rathnayake" },
          { name: "N. Silva" },
        ],
      },
    ],
    awards: [
      { label: "Highest Bid of the Night", name: "K. Perera", note: "LKR 120,000 to The Wardens CC" },
      { label: "Players Moved", name: "64", note: "Across one auction session" },
    ],
  },
}

// ─────────────────────────────────────────────────────────────
// DERIVED LIST — merges showcaseSlides (base info) with the extras above
// ─────────────────────────────────────────────────────────────
export const tournaments: Tournament[] = showcaseSlides.map((base) => ({
  ...base,
  ...(tournamentExtras[base.slug] || {}),
}))

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
export { slugify }

export function getTournamentBySlug(slug: string): Tournament | undefined {
  return tournaments.find((t) => slugify(t.slug) === slug)
}