// File: lib/tournament/singleElim.ts
import type { Round, MatchNode, TeamNode } from "@/components/tournament/TournamentBracket";
import { AdminTeam, BYE_TEAM, nextPowerOfTwo, standardSeedOrder, roundMetaFor, toTeamNode } from "./seeding";

export interface GenerateSingleElimOptions {
  venues?: string[];
}

/**
 * Builds Round 1 -> Final for however many teams you pass in (any count,
 * not just powers of 2). `teamsBySeed[0]` is seed 1 (best), etc. The field
 * is padded to the next power of 2 and the weakest slots automatically
 * become byes for the top seeds — e.g. 15 teams -> 1 bye (seed 1 skips
 * Round 1), 50 teams -> 14 byes (seeds 1-14 skip Round 1).
 */
export function generateSingleElimination(
  teamsBySeed: AdminTeam[],
  options: GenerateSingleElimOptions = {}
): Round[] {
  if (teamsBySeed.length < 2) throw new Error("Need at least 2 teams");
  const bracketSize = nextPowerOfTwo(teamsBySeed.length);
  const seedOrder = standardSeedOrder(bracketSize);
  const venues = options.venues ?? ["Main Stadium"];

  const slots: (TeamNode | null)[] = seedOrder.map((seed, idx) =>
    seed <= teamsBySeed.length ? toTeamNode(teamsBySeed[seed - 1], idx) : null
  );

  const round1Meta = roundMetaFor(bracketSize);
  const round1Matches: MatchNode[] = [];
  for (let i = 0; i < bracketSize / 2; i++) {
    const a = slots[i * 2];
    const b = slots[i * 2 + 1];
    const id = `${round1Meta.shortName}-${i + 1}`;
    if (a && b) {
      round1Matches.push({
        id, label: id, status: "scheduled", teamA: a, teamB: b,
        aFrom: null, bFrom: null, venue: venues[i % venues.length],
      });
    } else {
      const only = (a ?? b) as TeamNode;
      round1Matches.push({
        id, label: id, status: "completed",
        teamA: { ...only, isWinner: true }, teamB: { ...BYE_TEAM },
        aFrom: null, bFrom: null, venue: "Bye",
      });
    }
  }

  const rounds: Round[] = [{ id: 1, name: round1Meta.name, shortName: round1Meta.shortName, matches: round1Matches }];

  let prevMatches = round1Matches;
  let currentTeamCount = bracketSize / 2;
  let roundId = 2;
  while (currentTeamCount > 1) {
    const meta = roundMetaFor(currentTeamCount);
    const matches: MatchNode[] = [];
    for (let i = 0; i < currentTeamCount / 2; i++) {
      const feederA = prevMatches[i * 2];
      const feederB = prevMatches[i * 2 + 1];
      matches.push({
        id: `${meta.shortName}-${i + 1}`, label: `${meta.shortName}-${i + 1}`, status: "scheduled",
        teamA: null, teamB: null, aFrom: feederA.label, bFrom: feederB.label,
      });
    }
    rounds.push({ id: roundId, name: meta.name, shortName: meta.shortName, matches });
    prevMatches = matches;
    currentTeamCount /= 2;
    roundId++;
  }

  for (let r = 0; r < rounds.length - 1; r++) {
    for (const match of rounds[r].matches) {
      if (match.status === "completed") advanceWinner(match, rounds[r + 1].matches);
    }
  }

  return rounds;
}

export function setResult(match: MatchNode, winner: "A" | "B", scoreA: number, scoreB: number) {
  match.status = "completed";
  if (match.teamA) { match.teamA.score = scoreA; match.teamA.isWinner = winner === "A"; }
  if (match.teamB) { match.teamB.score = scoreB; match.teamB.isWinner = winner === "B"; }
}

export function advanceWinner(match: MatchNode, nextMatches: MatchNode[]) {
  const winner = match.teamA?.isWinner ? match.teamA : match.teamB?.isWinner ? match.teamB : null;
  if (!winner) return;
  const next = nextMatches.find((m) => m.aFrom === match.id || m.bFrom === match.id);
  if (!next) return;
  const slot: TeamNode = { ...winner, score: undefined, isWinner: undefined };
  if (next.aFrom === match.id) next.teamA = slot;
  else next.teamB = slot;
}

export function recordSingleElimResult(
  rounds: Round[],
  matchId: string,
  winner: "A" | "B",
  scoreA: number,
  scoreB: number
) {
  for (let r = 0; r < rounds.length; r++) {
    const match = rounds[r].matches.find((m) => m.id === matchId);
    if (!match) continue;
    setResult(match, winner, scoreA, scoreB);
    if (rounds[r + 1]) advanceWinner(match, rounds[r + 1].matches);
    return;
  }
}

export function championOf(rounds: Round[]): TeamNode | null {
  const final = rounds[rounds.length - 1]?.matches[0];
  if (!final) return null;
  if (final.teamA?.isWinner) return final.teamA;
  if (final.teamB?.isWinner) return final.teamB;
  return null;
}