// File: app/sandbox/overlay/lib/sandboxData.ts
//
// Hardcoded match data shared by both sandbox routes (admin + preview),
// so both windows start from the same teams/squads before the first
// BroadcastChannel sync lands.
//
// Themed for the Valiant Premier League's ancient-royal-knight identity —
// venue, team names, squad names, and squad photography all lean into
// that instead of generic sandbox placeholders.

import type { MatchSetup, TeamInfo, SquadPlayer, LiveState, WeatherData, BatterState, BowlerState } from "@/lib/overlayBus";

// Knight portrait pool used as squad player photos — sourced from
// public/images/knights/knight-1.png .. knight-100.png. Giving every
// player a distinct knight portrait keeps squad cards on-theme instead of
// falling back to a blank/generic avatar.
//
// NOTE: this assumes SquadPlayer has an optional `imageUrl?: string`
// field. If it doesn't yet, add that to the SquadPlayer interface in
// @/lib/overlayBus — otherwise the object literals below won't type-check.
function knightImage(n: number): string {
  return `/images/knights/knight-${n}.png`;
}

function squad(prefix: string, names: string[], startImageIndex: number): SquadPlayer[] {
  return names.map((name, i) => ({
    id: `${prefix}-${i + 1}`,
    name,
    imageUrl: knightImage(startImageIndex + i),
  }));
}

// Crownguard Strikers — the crown's own order, noble/heraldic surnames.
const CROWNGUARD_XI = [
  "Alaric Thorne",
  "Cedric Ashworth",
  "Tristan Blackwell",
  "Gareth Stormridge",
  "Edmund Vale",
  "Rowan Ashford",
  "Baldric Kane",
  "Osric Fenwick",
  "Aldous Ravenscroft",
  "Merrick Hollowell",
  "Corwin Drake",
];

// Ravenhold Riders — a darker, faster order out of the northern holds.
const RAVENHOLD_XI = [
  "Kael Nightshade",
  "Dorian Wraith",
  "Soren Blackmoor",
  "Ronan Duskwood",
  "Ivar Thistledown",
  "Bram Ashgrave",
  "Faelan Grimshaw",
  "Torin Hollowmere",
  "Alden Cross",
  "Marek Stonewell",
  "Emeric Voss",
];

const teamA: TeamInfo = {
  name: "Crownguard Strikers",
  shortCode: "CGS",
  color: "#c9971f",
  logoUrl: "",
  squad: CROWNGUARD_XI,
  // knight-1..knight-11
  squadPlayers: squad("cgs", CROWNGUARD_XI, 1),
};

const teamB: TeamInfo = {
  name: "Ravenhold Riders",
  shortCode: "RHR",
  color: "#2f6fed",
  logoUrl: "",
  squad: RAVENHOLD_XI,
  // knight-12..knight-22
  squadPlayers: squad("rhr", RAVENHOLD_XI, 12),
};

export const HARDCODED_MATCH_SETUP: MatchSetup = {
  tournamentName: "Valiant Premier League",
  season: "2026",
  tournamentLogoUrl: "",
  venue: "Camelot Colosseum",
  format: "T20",
  matchNumber: "Match 14",
  matchTitle: "Semi-Final",
  kickoffTime: "19:30 LOCAL",
  teamA,
  teamB,
  matchMeta: "Semi-Final",
  tournament: "Season 7",
  tossWinner: "A",
  tossDecision: "bat",
};

export const emptyBatter = (): BatterState => ({ name: "", runs: 0, balls: 0, fours: 0, sixes: 0, imageUrl: undefined });
export const emptyBowler = (): BowlerState => ({ name: "", overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 });

export const emptyLiveState: LiveState = {
  score: { runs: 0, wickets: 0, overs: 0, balls: 0 },
  striker: emptyBatter(),
  nonStriker: emptyBatter(),
  bowler: emptyBowler(),
  partnership: { runs: 0, balls: 0 },
  matchBoundaries: { fours: 0, sixes: 0 },
  tournamentBoundaries: { fours: 0, sixes: 0 },
  pointsTable: [],
  thisOver: [],
};

export const defaultWeather: WeatherData = {
  venue: "CAMELOT COLOSSEUM",
  temp: 28,
  unit: "C",
  condition: "sunny",
  corner: "top-right",
};