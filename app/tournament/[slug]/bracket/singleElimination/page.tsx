// app/tournament/[slug]/bracket/singleElimination/page.tsx
"use client";
import TournamentBracket from "@/components/tournament/TournamentBracket";
import type { Round, MatchNode, TeamNode } from "@/components/tournament/TournamentBracket";
import { getDemoTeams } from "@/lib/tournament/demoTeams";
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
  ...getDemoTeams()
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
      logoSrc="/valiant-league-logo.png"
    />
  );
}