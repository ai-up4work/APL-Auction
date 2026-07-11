import type { Round, MatchNode, TeamNode } from "@/components/tournament/TournamentBracket";

/**
 * Minimal shape needed to seed a bracket. Anything else (score, isWinner,
 * status, venue, date...) can be layered on afterwards or passed straight
 * into `rounds` if you already have real match results.
 */
export interface BracketTeamInput {
  code: string;
  name: string;
  logo?: string;
  color?: string;
}

export interface GenerateBracketOptions {
  /** Venue names cycled across round-1 matches. */
  venues?: string[];
  /** Fallback color palette used when a team has no `color`. */
  palette?: string[];
  /** Optional per-round name/shortName overrides, keyed by teams-entering-that-round (e.g. 8 -> "Quarterfinal"). */
  roundNameOverrides?: Record<number, { name: string; shortName: string }>;
}

const DEFAULT_PALETTE = [
  "#3B8BD4", "#2A9D5C", "#E45D35", "#FFB000", "#7C3AED", "#EC4899", "#0F172A", "#DC2626",
  "#0EA5E9", "#059669", "#D97706", "#9333EA", "#DB2777", "#475569", "#65A30D", "#B91C1C",
];

function defaultRoundMeta(teamsEntering: number): { name: string; shortName: string } {
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

/**
 * Builds the full round skeleton (Round 1 -> ... -> Final) for however many
 * teams you pass in. `teams.length` must be a power of 2 — that single
 * number is what determines how many "levels" the bracket ends up with
 * (8 teams -> 3 levels, 16 -> 4, 32 -> 5, 64 -> 6, ...).
 *
 * Round 1 matches are filled in with your real teams and left in
 * "scheduled" status. Every later round is generated as TBD placeholders
 * wired up via aFrom/bFrom labels, ready for you to fill in scores/winners
 * as results come in (just mutate the returned matches, or build your own
 * Round[] by hand and pass it directly to <TournamentBracket rounds={...} />).
 */
export function generateBracketRounds(
  teams: BracketTeamInput[],
  options: GenerateBracketOptions = {}
): Round[] {
  const teamCount = teams.length;
  if (teamCount < 2 || (teamCount & (teamCount - 1)) !== 0) {
    throw new Error(`generateBracketRounds: teams.length must be a power of 2 (>= 2), got ${teamCount}`);
  }

  const palette = options.palette ?? DEFAULT_PALETTE;
  const venues = options.venues ?? ["Main Stadium"];
  const roundMeta = (teamsEntering: number) =>
    options.roundNameOverrides?.[teamsEntering] ?? defaultRoundMeta(teamsEntering);

  const rounds: Round[] = [];

  // Round 1: real teams, scheduled matches.
  const round1Meta = roundMeta(teamCount);
  const round1Matches: MatchNode[] = [];
  for (let i = 0; i < teamCount / 2; i++) {
    const a = teams[i * 2];
    const b = teams[i * 2 + 1];
    const teamA: TeamNode = {
      id: `t${i * 2}`,
      code: a.code,
      name: a.name,
      logo: a.logo,
      color: a.color ?? palette[(i * 2) % palette.length],
    };
    const teamB: TeamNode = {
      id: `t${i * 2 + 1}`,
      code: b.code,
      name: b.name,
      logo: b.logo,
      color: b.color ?? palette[(i * 2 + 1) % palette.length],
    };
    round1Matches.push({
      id: `${round1Meta.shortName}-${i + 1}`,
      label: `${round1Meta.shortName}-${i + 1}`,
      status: "scheduled",
      teamA,
      teamB,
      aFrom: null,
      bFrom: null,
      venue: venues[i % venues.length],
    });
  }
  rounds.push({ id: 1, name: round1Meta.name, shortName: round1Meta.shortName, matches: round1Matches });

  // Every subsequent round: TBD placeholders wired to their feeder matches.
  let prevMatches = round1Matches;
  let currentTeamCount = teamCount / 2;
  let roundId = 2;
  while (currentTeamCount > 1) {
    const meta = roundMeta(currentTeamCount);
    const matches: MatchNode[] = [];
    for (let i = 0; i < currentTeamCount / 2; i++) {
      const feederA = prevMatches[i * 2];
      const feederB = prevMatches[i * 2 + 1];
      matches.push({
        id: `${meta.shortName}-${i + 1}`,
        label: `${meta.shortName}-${i + 1}`,
        status: "scheduled",
        teamA: null,
        teamB: null,
        aFrom: feederA.label,
        bFrom: feederB.label,
      });
    }
    rounds.push({ id: roundId, name: meta.name, shortName: meta.shortName, matches });
    prevMatches = matches;
    currentTeamCount /= 2;
    roundId++;
  }

  return rounds;
}