// File: lib/tournament/roundRobin.ts
import type { MatchNode, TeamNode } from "@/components/tournament/TournamentBracket";
import { AdminTeam, toTeamNode } from "./seeding";

export interface StandingsRow {
  teamId: string;
  code: string;
  name: string;
  color: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  points: number;
}

export interface RoundRobinData {
  teams: TeamNode[];
  matches: MatchNode[];
  standings: StandingsRow[];
}

export interface RoundRobinOptions {
  venues?: string[];
  pointsPerWin?: number;
  pointsPerDraw?: number;
}

export function generateRoundRobin(teamsInput: AdminTeam[], options: RoundRobinOptions = {}): RoundRobinData {
  const venues = options.venues ?? ["Main Stadium"];
  const teams = teamsInput.map((t, i) => toTeamNode(t, i));
  const hasBye = teams.length % 2 !== 0;
  const list: (TeamNode | null)[] = hasBye ? [...teams, null] : [...teams];
  const n = list.length;
  const rounds = n - 1;
  const half = n / 2;
  const arr = [...list];
  const matches: MatchNode[] = [];
  let matchCounter = 1;

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (!a || !b) continue;
      const id = `RR-${matchCounter}`;
      matches.push({
        id, label: `Round ${round + 1}`, status: "scheduled",
        teamA: { ...a }, teamB: { ...b }, aFrom: null, bFrom: null,
        venue: venues[matchCounter % venues.length], date: `Round ${round + 1}`,
      });
      matchCounter++;
    }
    arr.splice(1, 0, arr.pop()!);
  }

  return { teams, matches, standings: computeStandings(teams, matches, options) };
}

export function computeStandings(
  teams: TeamNode[],
  matches: MatchNode[],
  options: RoundRobinOptions = {}
): StandingsRow[] {
  const win = options.pointsPerWin ?? 3;
  const draw = options.pointsPerDraw ?? 1;
  const rows = new Map<string, StandingsRow>();
  for (const t of teams) {
    rows.set(t.code, {
      teamId: t.id, code: t.code, name: t.name, color: t.color,
      played: 0, wins: 0, draws: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, points: 0,
    });
  }

  for (const m of matches) {
    if (m.status !== "completed" || !m.teamA || !m.teamB) continue;
    const a = rows.get(m.teamA.code), b = rows.get(m.teamB.code);
    if (!a || !b) continue;
    const sa = m.teamA.score ?? 0, sb = m.teamB.score ?? 0;
    a.played++; b.played++;
    a.pointsFor += sa; a.pointsAgainst += sb;
    b.pointsFor += sb; b.pointsAgainst += sa;
    if (sa > sb) { a.wins++; b.losses++; a.points += win; }
    else if (sb > sa) { b.wins++; a.losses++; b.points += win; }
    else { a.draws++; b.draws++; a.points += draw; b.points += draw; }
  }

  return [...rows.values()].sort(
    (x, y) =>
      y.points - x.points ||
      (y.pointsFor - y.pointsAgainst) - (x.pointsFor - x.pointsAgainst) ||
      y.pointsFor - x.pointsFor
  );
}

export function recordRoundRobinResult(data: RoundRobinData, matchId: string, scoreA: number, scoreB: number) {
  const match = data.matches.find((m) => m.id === matchId);
  if (!match || !match.teamA || !match.teamB) return;
  match.status = "completed";
  match.teamA.score = scoreA;
  match.teamB.score = scoreB;
  match.teamA.isWinner = scoreA > scoreB;
  match.teamB.isWinner = scoreB > scoreA;
  data.standings = computeStandings(data.teams, data.matches);
}