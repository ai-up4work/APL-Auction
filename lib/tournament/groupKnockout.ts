// File: lib/tournament/groupKnockout.ts
import type { Round } from "@/components/tournament/TournamentBracket";
import type { AdminTeam } from "./seeding";
import { generateRoundRobin, RoundRobinData } from "./roundRobin";
import { generateSingleElimination } from "./singleElim";

export interface GroupData {
  id: string;
  name: string;
  roundRobin: RoundRobinData;
}

export interface GroupKnockoutData {
  groups: GroupData[];
  qualifiersPerGroup: number;
  knockout: Round[] | null;
}

export function generateGroups(teams: AdminTeam[], groupCount: number, qualifiersPerGroup: number): GroupKnockoutData {
  const buckets: AdminTeam[][] = Array.from({ length: groupCount }, () => []);
  teams.forEach((team, i) => {
    const cycle = Math.floor(i / groupCount);
    const posInCycle = i % groupCount;
    const bucketIdx = cycle % 2 === 0 ? posInCycle : groupCount - 1 - posInCycle;
    buckets[bucketIdx].push(team);
  });

  const groups: GroupData[] = buckets
    .filter((b) => b.length > 0)
    .map((groupTeams, i) => ({
      id: `G${i + 1}`,
      name: `Group ${String.fromCharCode(65 + i)}`,
      roundRobin: generateRoundRobin(groupTeams),
    }));

  return { groups, qualifiersPerGroup, knockout: null };
}

export function allGroupMatchesComplete(data: GroupKnockoutData): boolean {
  return data.groups.every((g) => g.roundRobin.matches.every((m) => m.status === "completed"));
}

export function buildKnockoutFromGroups(data: GroupKnockoutData): Round[] {
  const qualifiers: AdminTeam[] = [];
  for (let place = 0; place < data.qualifiersPerGroup; place++) {
    for (const group of data.groups) {
      const row = group.roundRobin.standings[place];
      if (!row) continue;
      const team = group.roundRobin.teams.find((t) => t.code === row.code);
      if (team) qualifiers.push({ id: team.id, code: team.code, name: team.name, logo: team.logo, color: team.color });
    }
  }
  const knockout = generateSingleElimination(qualifiers);
  data.knockout = knockout;
  return knockout;
}