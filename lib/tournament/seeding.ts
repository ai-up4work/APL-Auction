// File: lib/tournament/seeding.ts
import type { TeamNode } from "@/components/tournament/TournamentBracket";

export interface AdminTeam {
  id: string;
  code: string;
  name: string;
  logo?: string;
  color?: string;
}

export const DEFAULT_PALETTE = [
  "#3B8BD4", "#2A9D5C", "#E45D35", "#FFB000", "#7C3AED", "#EC4899", "#0F172A", "#DC2626",
  "#0EA5E9", "#059669", "#D97706", "#9333EA", "#DB2777", "#475569", "#65A30D", "#B91C1C",
];

/** Placeholder opponent for a bye — the real team is auto-advanced. */
export const BYE_TEAM: TeamNode = { id: "__bye__", code: "BYE", name: "Bye", color: "#475569" };

export function nextPowerOfTwo(n: number): number {
  return n <= 1 ? 1 : 2 ** Math.ceil(Math.log2(n));
}

/**
 * Standard "1 vs N" tournament seed order for `size` slots (power of 2).
 * E.g. size=8 -> [1,8,4,5,2,7,3,6]: match1 = seed1 vs seed8, match2 = seed4
 * vs seed5, etc. Guarantees seed1/seed2 can only meet in the Final, seeds
 * 1-4 can only meet from the Semis on, and so on.
 */
export function standardSeedOrder(size: number): number[] {
  if (size < 2 || (size & (size - 1)) !== 0) {
    throw new Error(`standardSeedOrder: size must be a power of 2, got ${size}`);
  }
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2 + 1;
    const next: number[] = [];
    for (const seed of order) next.push(seed, n - seed);
    order = next;
  }
  return order;
}

/** Fisher-Yates shuffle — used to turn "team entry order" into "seed order"
 *  for a random draw (seed 1 = arr[0], seed 2 = arr[1], ...). */
export function randomDraw<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function roundMetaFor(teamsEntering: number): { name: string; shortName: string } {
  switch (teamsEntering) {
    case 2: return { name: "Final", shortName: "F" };
    case 4: return { name: "Semifinal", shortName: "SF" };
    case 8: return { name: "Quarterfinal", shortName: "QF" };
    case 16: return { name: "Round of 16", shortName: "R16" };
    case 32: return { name: "Round of 32", shortName: "R32" };
    case 64: return { name: "Round of 64", shortName: "R64" };
    default: return { name: `Round of ${teamsEntering}`, shortName: `R${teamsEntering}` };
  }
}

export function toTeamNode(team: AdminTeam, paletteIdx: number): TeamNode {
  return {
    id: team.id,
    code: team.code,
    name: team.name,
    logo: team.logo,
    color: team.color ?? DEFAULT_PALETTE[paletteIdx % DEFAULT_PALETTE.length],
  };
}

export function makeTeamId(): string {
  return `team_${Math.random().toString(36).slice(2, 9)}`;
}