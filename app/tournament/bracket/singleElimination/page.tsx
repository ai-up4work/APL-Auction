// app/tournament/bracket/singleElimination/page.tsx
"use client";
import TournamentBracket from "@/components/tournament/TournamentBracket";
import type { Round, MatchNode, TeamNode } from "@/components/tournament/TournamentBracket";
import { generateBracketRounds } from "@/lib/tournament/generateBracketRounds";

/* ------------------------------------------------------------------ */
/*  Bracket resolution helpers                                         */
/* ------------------------------------------------------------------ */

/** Marks a match as completed with a winner + scores. */
function setResult(match: MatchNode, winner: "A" | "B", scoreA: number, scoreB: number) {
  match.status = "completed";
  if (match.teamA) {
    match.teamA.score = scoreA;
    match.teamA.isWinner = winner === "A";
  }
  if (match.teamB) {
    match.teamB.score = scoreB;
    match.teamB.isWinner = winner === "B";
  }
}

/** Pushes the winner of `match` into the correct slot of the next-round match. */
function advanceWinner(match: MatchNode, nextMatches: MatchNode[]) {
  const winner = match.teamA?.isWinner ? match.teamA : match.teamB?.isWinner ? match.teamB : null;
  if (!winner) return;

  // find the next match that lists this match's id as a feeder
  const next = nextMatches.find((m) => m.aFrom === match.id || m.bFrom === match.id);
  if (!next) return;

  const slot: TeamNode = { ...winner, score: undefined, isWinner: undefined };
  if (next.aFrom === match.id) next.teamA = slot;
  else next.teamB = slot;
}

/** Walks the whole bracket, calling `decide` for every playable match, and advances winners. */
function resolveBracket(
  rounds: Round[],
  decide: (match: MatchNode, roundIndex: number) => { winner: "A" | "B"; scoreA: number; scoreB: number }
) {
  for (let r = 0; r < rounds.length; r++) {
    const round = rounds[r];
    for (const match of round.matches) {
      if (match.teamA && match.teamB && match.status !== "completed") {
        const { winner, scoreA, scoreB } = decide(match, r);
        setResult(match, winner, scoreA, scoreB);
      }
    }
    const next = rounds[r + 1];
    if (next) {
      for (const match of round.matches) advanceWinner(match, next.matches);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Data                                                                */
/* ------------------------------------------------------------------ */

// 1) Give it just your teams — the number of teams (a power of 2) is all
//    that decides how many rounds/"levels" the bracket has.
//    32 teams -> Round of 32, R16, Quarterfinal, Semifinal, Final (5 levels).
const rounds = generateBracketRounds([
  { name: "Coastal Sharks", code: "CS", logo: "/coastal-sharks-logo.png" }, { name: "Desert Falcons", code: "DF", logo: "/desert-falcons-logo.png" },
  { name: "Moon Knights", code: "MK", logo: "/moon-knights-logo.png" }, { name: "Viper Titans", code: "VT", logo: "/viper-titans-logo.png" },
  { name: "Kandy Kings", code: "KK", logo: "/kandy-kings-logo.png" }, { name: "Badulla Royals", code: "BR", logo: "/badulla-royals-logo.png" },
  { name: "Jaffna Giants", code: "JG", logo: "/jaffna-giants-logo.png" }, { name: "Galle Challengers", code: "GC", logo: "/galle-challengers-logo.png" },
  { name: "Northern Ospreys", code: "NO", logo: "/northern-ospreys-logo.png" }, { name: "Southern Cobras", code: "SC", logo: "/southern-cobras-logo.png" },
  { name: "Highland Hawks", code: "HH", logo: "/highland-hawks-logo.png" }, { name: "Island Panthers", code: "IP", logo: "/island-panthers-logo.png" },
  { name: "Royal Lions", code: "RL", logo: "/royal-lions-logo.png" }, { name: "Golden Eagles", code: "GE", logo: "/golden-eagles-logo.png" },
  { name: "Silver Wolves", code: "SW", logo: "/silver-wolves-logo.png" }, { name: "Crimson Tigers", code: "CT", logo: "/crimson-tigers-logo.png" },
  { name: "Emerald Dragons", code: "ED", logo: "/emerald-dragons-logo.png" }, { name: "Obsidian Ravens", code: "OR", logo: "/obsidian-ravens-logo.png" },
  { name: "Storm Chasers", code: "SC2", logo: "/storm-chasers-logo.png" }, { name: "Thunder Riders", code: "TR", logo: "/thunder-riders-logo.png" },
  { name: "Blaze Strikers", code: "BS", logo: "/blaze-strikers-logo.png" }, { name: "Frost Giants", code: "FG", logo: "/frost-giants-logo.png" },
  { name: "Ember Phoenix", code: "EP", logo: "/ember-phoenix-logo.png" }, { name: "Ridge Rhinos", code: "RR2", logo: "/ridge-rhinos-logo.png" },
  { name: "Bay Barracudas", code: "BB", logo: "/bay-barracudas-logo.png" }, { name: "Cliff Condors", code: "CC", logo: "/cliff-condors-logo.png" },
  { name: "Valley Vultures", code: "VV", logo: "/valley-vultures-logo.png" }, { name: "Summit Stallions", code: "SS", logo: "/summit-stallions-logo.png" },
  { name: "Harbor Hammers", code: "HB", logo: "/harbor-hammers-logo.png" }, { name: "Delta Dragons", code: "DD", logo: "/delta-dragons-logo.png" },
  { name: "Plains Panthers", code: "PP", logo: "/plains-panthers-logo.png" }, { name: "Arena Adders", code: "AA", logo: "/arena-adders-logo.png" },
]);

// 2) Resolve every match, round by round, all the way to the champion.
//    Swap the random logic below for real scores whenever you have them —
//    just return { winner: "A" | "B", scoreA, scoreB } for each match.
resolveBracket(rounds, () => {
  const scoreA = 60 + Math.floor(Math.random() * 60);
  const scoreB = 60 + Math.floor(Math.random() * 60);
  return { winner: scoreA >= scoreB ? "A" : "B", scoreA, scoreB };
});

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function BracketDemo() {
  return (
    <TournamentBracket
      rounds={rounds}
      title="Championship Bracket"
      eyebrowLabel="Knockout Stage"
      helperText="Hover or click a team to trace their path."
      logoSrc="/moon-knight-logo.png"
    />
  );
}