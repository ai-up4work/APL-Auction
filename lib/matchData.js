// lib/matchData.js
//
// Single source of truth for the fictional match/tournament identity used
// across the overlay system. Previously TEAM_A / TEAM_B / TOURNAMENT were
// redefined character-for-character in LiveScoreBar, CricketScorecard,
// CricketMatchIntro, and TournamentLogoDisplay — a rebrand meant editing
// four files and hoping you didn't miss one. Import from here instead.
//
// Note: PointsTable's tournament-standings roster (real IPL franchise
// names/logos) is a deliberately separate dataset from TEAM_A/TEAM_B (the
// two sides in tonight's specific match) — it's kept in PointsTable itself
// since it represents a different thing (the whole tournament table, not
// this match), but its default `tournament` prop now points back to the
// same TOURNAMENT identity below for consistency.
export const TOURNAMENT = {
  name: "MOON KNIGHT CUP",
  edition: "SEASON 7 · T20",
  logo: "/moon-knight-logo.png",
};
export const TEAM_A = {
  name: "COASTAL SHARKS",
  short: "CS",
  image: "/Franchises/CSK.png",
  color: "#3B8BD4", // aplBlue
  colorSoft: "rgba(59,139,212,0.22)",
};
export const TEAM_B = {
  name: "DESERT FALCONS",
  short: "DF",
  image: "/Franchises/RCB.png",
  color: "#2A9D5C", // aplGreen
  colorSoft: "rgba(42,157,92,0.2)",
};
export const VENUE = "MERIDIAN STADIUM";
export const MATCH_META = {
  venue: "Meridian Stadium",
  format: "20 OVERS",
  time: "19:30 LOCAL",
};
export const BALLS_PER_OVER = 6;
// "Live" second-innings state used by LiveScoreBar.
export const LIVE = {
  battingTeam: TEAM_A,
  fieldingTeam: TEAM_B,
  score: 41,
  wickets: 0,
  oversDone: 4,
  ballsDone: 2, // 4.2 overs
  oversLimit: 20,
  striker: { name: "L. HAVILAND", runs: 28, balls: 14 },
  nonStriker: { name: "R. OKONKWO", runs: 11, balls: 9 },
  bowler: { name: "S. REYES", wickets: 0, runsConceded: 22, overs: "4.0" },
  // Ball-by-ball for the current over, oldest to most recent.
  // '.' dot, a number = runs off the bat, 'W' wicket, 'wd' wide, 'nb' no-ball.
  thisOver: [".", ".", ".", "4"],
};
// Completed-match summary used by CricketScorecard. Team A batted first;
// Team B's bowlers are shown opposite Team A's batting, and vice versa.
export const INNINGS_A = {
  label: "1st Innings",
  overs: "20.0",
  score: "162-4",
  batting: [
    { name: "L. HAVILAND", runs: 58, balls: 42, top: true },
    { name: "R. OKONKWO", runs: 34, balls: 28 },
    { name: "D. MARSH", runs: 29, balls: 20 },
    { name: "K. SANTOS", runs: 18, balls: 15 },
  ],
  bowling: [
    { name: "F. VANCE", figures: "2-28", overs: "4.0", top: true },
    { name: "M. QUINLAN", figures: "1-31", overs: "4.0" },
    { name: "A. DUBOIS", figures: "1-24", overs: "4.0" },
    { name: "S. REYES", figures: "0-35", overs: "4.0" },
  ],
};
export const INNINGS_B = {
  label: "2nd Innings",
  overs: "19.2",
  score: "163-5",
  batting: [
    { name: "F. VANCE", runs: 61, balls: 39, top: true },
    { name: "A. DUBOIS", runs: 45, balls: 30 },
    { name: "M. QUINLAN", runs: 22, balls: 18 },
    { name: "S. REYES", runs: 14, balls: 9 },
  ],
  bowling: [
    { name: "L. HAVILAND", figures: "2-30", overs: "4.0", top: true },
    { name: "D. MARSH", figures: "1-38", overs: "3.2" },
    { name: "R. OKONKWO", figures: "1-27", overs: "4.0" },
    { name: "K. SANTOS", figures: "0-40", overs: "4.0" },
  ],
};
export const RESULT_LINE = "DESERT FALCONS WON BY 5 WICKETS";