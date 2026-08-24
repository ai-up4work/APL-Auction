// File: lib/tournament/customBracketSim.ts
import type { Round, MatchNode, TeamNode } from "@/components/tournament/TournamentBracket";

/* ------------------------------------------------------------------ */
/*  A DoubleElimData shape compatible with DoubleElimBoard's usage.   */
/*  If you already have this exported from lib/tournament/doubleElim, */
/*  delete this and import that one instead — the fields it actually  */
/*  reads (winners/losers/grandFinal/bracketReset) are the same.      */
/* ------------------------------------------------------------------ */
export interface DoubleElimData {
  winners: Round[];
  losers: Round[];
  grandFinal: MatchNode;
  bracketReset?: MatchNode | null;
}

/** Minimal team shape the generators need — matches what getDemoTeams()
 *  already returns (id, code, name, logo, color). */
export interface SimTeam {
  id: string;
  code: string;
  name: string;
  logo?: string;
  color: string;
}

export type SeedingMode = "RANKING" | "RANDOM";

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Standard bracket seeding order (1 vs N, protecting top seeds from
 *  meeting until as late as possible) — [1,2] -> [1,4,2,3] -> [1,8,4,5,2,7,3,6] ... */
function seedOrder(bracketSize: number): number[] {
  let order = [1, 2];
  while (order.length < bracketSize) {
    const size = order.length * 2;
    const next: number[] = [];
    for (const s of order) {
      next.push(s);
      next.push(size + 1 - s);
    }
    order = next;
  }
  return order.slice(0, bracketSize);
}

function roundName(matchesInRound: number): { name: string; shortName: string } {
  switch (matchesInRound) {
    case 1: return { name: "Final", shortName: "F" };
    case 2: return { name: "Semifinal", shortName: "SF" };
    case 4: return { name: "Quarterfinal", shortName: "QF" };
    case 8: return { name: "Round of 16", shortName: "R16" };
    case 16: return { name: "Round of 32", shortName: "R32" };
    case 32: return { name: "Round of 64", shortName: "R64" };
    default: return { name: `Round of ${matchesInRound * 2}`, shortName: `R${matchesInRound * 2}` };
  }
}

/** Winner always scores strictly higher than the loser — good enough
 *  for a visual sandbox, not meant to model any real sport's scoring. */
function randScore(isWinner: boolean): number {
  const base = Math.floor(Math.random() * 3);
  return isWinner ? base + 1 + Math.floor(Math.random() * 3) : base;
}

/** Strip a team down to identity-only fields when carrying it forward
 *  into a brand-new match, so a previous match's score/isWinner never
 *  leaks into the next round's display. */
function fresh(t: TeamNode): TeamNode {
  return { id: t.id, code: t.code, name: t.name, logo: t.logo, color: t.color };
}

function toTeamNode(t: SimTeam): TeamNode {
  return { id: t.id, code: t.code, name: t.name, logo: t.logo, color: t.color };
}

/** Null-aware match resolver shared by the winners and losers brackets
 *  so byes propagate the same way single elimination already does:
 *  - both sides real   -> normal random result, real winner + real loser
 *  - one side null      -> bye, the real side advances immediately with
 *                          no score, and produces NO loser (a bye never
 *                          drops anyone into the losers bracket)
 *  - both sides null    -> nothing to play yet; stays null until an
 *                          earlier bye/real match upstream resolves it */
function playMatch(
  id: string,
  teamA: TeamNode | null,
  teamB: TeamNode | null,
  aFrom: string | null,
  bFrom: string | null
): { match: MatchNode; winner: TeamNode | null; loser: TeamNode | null } {
  if (!teamA && !teamB) {
    return {
      match: { id, label: id, status: "scheduled", teamA: null, teamB: null, aFrom, bFrom },
      winner: null,
      loser: null,
    };
  }
  if (!teamA || !teamB) {
    const live = teamA ?? teamB!;
    const winnerNode: TeamNode = { ...fresh(live), isWinner: true };
    return {
      match: {
        id, label: id, status: "completed",
        teamA: teamA ? winnerNode : null,
        teamB: teamB ? winnerNode : null,
        aFrom, bFrom,
      },
      winner: fresh(winnerNode),
      loser: null,
    };
  }
  const aWins = Math.random() < 0.5;
  return {
    match: {
      id, label: id, status: "completed",
      teamA: { ...fresh(teamA), score: randScore(aWins), isWinner: aWins },
      teamB: { ...fresh(teamB), score: randScore(!aWins), isWinner: !aWins },
      aFrom, bFrom,
    },
    winner: { ...fresh(aWins ? teamA : teamB), isWinner: true },
    loser: { ...fresh(aWins ? teamB : teamA), isWinner: false },
  };
}

/* ------------------------------------------------------------------ */
/*  SINGLE_ELIMINATION                                                 */
/*  Works for ANY team count (7, 30, 100, whatever) — not just powers  */
/*  of two. The bracket is always sized up to the next power of two    */
/*  internally (nextPowerOfTwo), with the leftover slots as byes,      */
/*  seeded to the top seeds via standard bracket seeding order. The    */
/*  team count itself never determines round *shape* — only how many  */
/*  of round 0's slots are real matches vs. byes.                      */
/* ------------------------------------------------------------------ */

export interface SingleElimOptions {
  seeding?: SeedingMode;
  /** byeStrategy is effectively always TOP_SEEDS here: standard seed
   *  order naturally hands byes to the top seeds when n < bracket size. */
}

export function simulateSingleElimination(teamsIn: SimTeam[], opts: SingleElimOptions = {}): Round[] {
  const teams = opts.seeding === "RANDOM" ? shuffle(teamsIn) : teamsIn;
  const n = teams.length;
  const bracketSize = nextPowerOfTwo(n);
  const order = seedOrder(bracketSize);
  const bySeed: (SimTeam | null)[] = order.map((seed) => (seed <= n ? teams[seed - 1] : null));
  const numRounds = Math.log2(bracketSize);

  const rounds: Round[] = [];
  const matchesInRound0 = bracketSize / 2;
  const { name: r0name, shortName: r0short } = roundName(matchesInRound0);
  const round0Matches: MatchNode[] = [];
  let advancing: (TeamNode | null)[] = [];

  for (let i = 0; i < matchesInRound0; i++) {
    const tA = bySeed[i * 2];
    const tB = bySeed[i * 2 + 1];
    const id = `${r0short}-${i + 1}`;

    if (!tA || !tB) {
      const live = tA ?? tB!;
      const winnerNode: TeamNode = { ...toTeamNode(live), isWinner: true };
      round0Matches.push({
        id, label: id, status: "completed",
        teamA: tA ? winnerNode : null,
        teamB: tB ? winnerNode : null,
        aFrom: null, bFrom: null,
      });
      advancing.push(fresh(winnerNode));
    } else {
      const aWins = Math.random() < 0.5;
      round0Matches.push({
        id, label: id, status: "completed",
        teamA: { ...toTeamNode(tA), score: randScore(aWins), isWinner: aWins },
        teamB: { ...toTeamNode(tB), score: randScore(!aWins), isWinner: !aWins },
        aFrom: null, bFrom: null,
      });
      advancing.push({ ...fresh(toTeamNode(aWins ? tA : tB)), isWinner: true });
    }
  }
  rounds.push({ id: 0, name: r0name, shortName: r0short, matches: round0Matches });

  let prevIds = round0Matches.map((m) => m.id);
  for (let r = 1; r < numRounds; r++) {
    const matchesInRound = matchesInRound0 / Math.pow(2, r);
    const { name, shortName } = roundName(matchesInRound);
    const roundMatches: MatchNode[] = [];
    const nextAdvancing: (TeamNode | null)[] = [];

    for (let i = 0; i < matchesInRound; i++) {
      const feederAId = prevIds[i * 2];
      const feederBId = prevIds[i * 2 + 1];
      const teamA = advancing[i * 2];
      const teamB = advancing[i * 2 + 1];
      const id = `${shortName}-${i + 1}`;

      if (teamA && teamB) {
        const aWins = Math.random() < 0.5;
        roundMatches.push({
          id, label: id, status: "completed",
          teamA: { ...teamA, score: randScore(aWins), isWinner: aWins },
          teamB: { ...teamB, score: randScore(!aWins), isWinner: !aWins },
          aFrom: feederAId, bFrom: feederBId,
        });
        nextAdvancing.push({ ...fresh(aWins ? teamA : teamB), isWinner: true });
      } else {
        // One side is still a bye that hasn't met a real opponent yet.
        roundMatches.push({
          id, label: id, status: "scheduled",
          teamA: teamA ?? null, teamB: teamB ?? null,
          aFrom: feederAId, bFrom: feederBId,
        });
        nextAdvancing.push(teamA ?? teamB ?? null);
      }
    }
    rounds.push({ id: r, name, shortName, matches: roundMatches });
    prevIds = roundMatches.map((m) => m.id);
    advancing = nextAdvancing;
  }

  return rounds;
}

/* ------------------------------------------------------------------ */
/*  3RD PLACE MATCH                                                    */
/*  Keys off bracket ROUND STRUCTURE, not team count — the semifinal   */
/*  is always rounds[rounds.length - 2] with exactly 2 matches,        */
/*  regardless of whether the tournament started with 7, 8, 30, 32,    */
/*  or 100 teams. The only way this can't produce a real 3rd-place     */
/*  match is if a bye survives all the way into the semifinal (only    */
/*  possible with very few teams relative to bracket size, e.g. 3      */
/*  teams in a 4-slot bracket) — that case is reported explicitly       */
/*  via skippedReason rather than silently disappearing.               */
/* ------------------------------------------------------------------ */

export interface ThirdPlaceResult {
  match: MatchNode | null;
  /** Present only when match is null — lets the UI explain *why*
   *  instead of just omitting the card with no context. */
  skippedReason?: "NO_SEMIFINAL_ROUND" | "BYE_REACHED_SEMIFINAL";
}

export function simulateThirdPlaceMatch(rounds: Round[]): ThirdPlaceResult {
  const semiRound = rounds[rounds.length - 2];
  if (!semiRound || semiRound.matches.length !== 2) {
    // Bracket too small to even have a distinct semifinal round (e.g.
    // a 2-team bracket: round 0 IS the final, there's no semifinal).
    return { match: null, skippedReason: "NO_SEMIFINAL_ROUND" };
  }

  const [sf1, sf2] = semiRound.matches;
  const loserOf = (m: MatchNode): TeamNode | null => {
    if (!m.teamA || !m.teamB) return null; // bye — no real loser to extract
    return fresh(m.teamA.isWinner ? m.teamB : m.teamA);
  };

  const teamA = loserOf(sf1);
  const teamB = loserOf(sf2);
  if (!teamA || !teamB) {
    return { match: null, skippedReason: "BYE_REACHED_SEMIFINAL" };
  }

  const aWins = Math.random() < 0.5;
  return {
    match: {
      id: "3RD",
      label: "3RD",
      status: "completed",
      teamA: { ...teamA, score: randScore(aWins), isWinner: aWins },
      teamB: { ...teamB, score: randScore(!aWins), isWinner: !aWins },
      aFrom: sf1.id,
      bFrom: sf2.id,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  DOUBLE_ELIMINATION — any team count (n >= 2), byes included.       */
/*                                                                      */
/*  Same trick as simulateSingleElimination: bracket is sized up to    */
/*  nextPowerOfTwo(n) and missing seed slots become null "byes",       */
/*  seeded to the top real seeds via standard seed order. The winners  */
/*  and losers brackets both stay fixed-size (powers of two) through-  */
/*  out — a null slot just means "no real loser was ever produced      */
/*  here", which plays out as an automatic bye wherever it's paired    */
/*  against a real team, exactly like round 0 of single elimination.   */
/*  A bye NEVER produces a loser, so it never seeds anyone into the    */
/*  losers bracket — that's the one rule that makes byes and the       */
/*  losers bracket compose correctly.                                  */
/*                                                                      */
/*  Note: with a lot of byes relative to bracket size (e.g. 3 teams    */
/*  in an 8-slot bracket), you can get transient "both sides null"     */
/*  losers-bracket matches early on — these render as an empty/TBD     */
/*  slot and resolve themselves as real losers arrive in later rounds. */
/* ------------------------------------------------------------------ */

export interface DoubleElimOptions {
  seeding?: SeedingMode;
  grandFinalReset?: boolean;
}

export function simulateDoubleElimination(teamsIn: SimTeam[], opts: DoubleElimOptions = {}): DoubleElimData {
  const teams = opts.seeding === "RANDOM" ? shuffle(teamsIn) : teamsIn;
  const n = teams.length;
  if (n < 2) {
    throw new Error("Double elimination needs at least 2 teams.");
  }
  const bracketSize = nextPowerOfTwo(n);
  const order = seedOrder(bracketSize);
  const bySeed: (SimTeam | null)[] = order.map((seed) => (seed <= n ? teams[seed - 1] : null));
  const k = Math.log2(bracketSize);

  // ---- winners bracket ----
  const winners: Round[] = [];
  let wPrevIds: string[] = [];
  let wAdvancing: (TeamNode | null)[] = [];
  const losersOfWR: (TeamNode | null)[][] = [];

  for (let r = 0; r < k; r++) {
    const matchesCount = bracketSize / Math.pow(2, r + 1);
    const { name, shortName } = roundName(matchesCount);
    const prefix = `WR${r + 1}`;
    const roundMatches: MatchNode[] = [];
    const nextAdvancing: (TeamNode | null)[] = [];
    const roundLosers: (TeamNode | null)[] = [];

    for (let i = 0; i < matchesCount; i++) {
      const id = `${prefix}-${i + 1}`;
      const teamA: TeamNode | null =
        r === 0 ? (bySeed[i * 2] ? toTeamNode(bySeed[i * 2]!) : null) : wAdvancing[i * 2];
      const teamB: TeamNode | null =
        r === 0 ? (bySeed[i * 2 + 1] ? toTeamNode(bySeed[i * 2 + 1]!) : null) : wAdvancing[i * 2 + 1];
      const aFrom = r === 0 ? null : wPrevIds[i * 2];
      const bFrom = r === 0 ? null : wPrevIds[i * 2 + 1];

      const { match, winner, loser } = playMatch(id, teamA, teamB, aFrom, bFrom);
      roundMatches.push(match);
      nextAdvancing.push(winner);
      roundLosers.push(loser);
    }

    winners.push({ id: r, name, shortName, matches: roundMatches });
    losersOfWR.push(roundLosers);
    wPrevIds = roundMatches.map((m) => m.id);
    wAdvancing = nextAdvancing;
  }
  const wbChampion = wAdvancing[0];
  if (!wbChampion) {
    // Should be unreachable for n >= 2 — real teams always funnel into
    // a real winner eventually — but fail loudly rather than silently
    // rendering a broken grand final if bracket math is ever changed.
    throw new Error("Double elimination: winners bracket produced no champion.");
  }

  // ---- losers bracket ----
  // Pattern (validated against n=4/8/16, and against bye-padded n=3/5/6/7
  // sized up to 4/8/8): for j = 1..k-1, a consolidation round K_j pairs
  // up the previous drop round's winners among themselves, then a drop
  // round D_j pairs K_j's winners against the losers freshly dropping in
  // from WR_{j+1}. Anything crossing from the winners bracket into the
  // losers bracket is tagged "L:" so DoubleElimBoard routes it through
  // the long vertical lane instead of a short elbow.
  const losers: Round[] = [];
  let prevDropWinners: (TeamNode | null)[] = losersOfWR[0];
  let prevDropIds: string[] = winners[0].matches.map((m) => m.id);
  let prevIsFromWinners = true; // WR1 losers feed K_1 directly

  for (let j = 1; j <= k - 1; j++) {
    // Consolidation round K_j
    const kShort = `LK${j}`;
    const kCount = prevDropWinners.length / 2;
    const kMatches: MatchNode[] = [];
    const kWinners: (TeamNode | null)[] = [];
    const kIds: string[] = [];
    for (let i = 0; i < kCount; i++) {
      const teamA = prevDropWinners[i * 2];
      const teamB = prevDropWinners[i * 2 + 1];
      const id = `${kShort}-${i + 1}`;
      const tag = (matchId: string) => (prevIsFromWinners ? `L:${matchId}` : matchId);
      const { match, winner } = playMatch(id, teamA, teamB, tag(prevDropIds[i * 2]), tag(prevDropIds[i * 2 + 1]));
      kMatches.push(match);
      kWinners.push(winner);
      kIds.push(id);
    }
    losers.push({ id: losers.length, name: `Losers Round ${losers.length + 1}`, shortName: kShort, matches: kMatches });

    // Drop round D_j: K_j winners vs losers of WR_{j+1}
    const dShort = `LD${j}`;
    const dropLosers = losersOfWR[j];
    const wrIds = winners[j].matches.map((m) => m.id);
    const dMatches: MatchNode[] = [];
    const dWinners: (TeamNode | null)[] = [];
    const dIds: string[] = [];
    for (let i = 0; i < kWinners.length; i++) {
      const teamA = kWinners[i];
      const teamB = dropLosers[i];
      const id = `${dShort}-${i + 1}`;
      const { match, winner } = playMatch(id, teamA, teamB, kIds[i], `L:${wrIds[i]}`);
      dMatches.push(match);
      dWinners.push(winner);
      dIds.push(id);
    }
    losers.push({ id: losers.length, name: `Losers Round ${losers.length + 1}`, shortName: dShort, matches: dMatches });

    prevDropWinners = dWinners;
    prevDropIds = dIds;
    prevIsFromWinners = false; // from here on, K rounds pull from the losers bracket itself
  }

  const lbChampion: TeamNode | null = k === 1 ? losersOfWR[0][0] : prevDropWinners[0];
  if (!lbChampion) {
    throw new Error("Double elimination: losers bracket produced no champion.");
  }

  // ---- grand final (+ optional reset) ----
  const gfAWins = Math.random() < 0.5;
  const grandFinal: MatchNode = {
    id: "GF", label: "Grand Final", status: "completed",
    teamA: { ...fresh(wbChampion), score: randScore(gfAWins), isWinner: gfAWins },
    teamB: { ...fresh(lbChampion), score: randScore(!gfAWins), isWinner: !gfAWins },
    aFrom: winners[winners.length - 1].matches[0].id,
    bFrom: k === 1 ? winners[0].matches[0].id : losers[losers.length - 1].matches[0].id,
  };

  let bracketReset: MatchNode | null = null;
  if (!gfAWins && opts.grandFinalReset) {
    const resetAWins = Math.random() < 0.5;
    bracketReset = {
      id: "GF-RESET", label: "Bracket Reset", status: "completed",
      teamA: { ...fresh(wbChampion), score: randScore(resetAWins), isWinner: resetAWins },
      teamB: { ...fresh(lbChampion), score: randScore(!resetAWins), isWinner: !resetAWins },
      aFrom: "GF", bFrom: "GF",
    };
  }

  return { winners, losers, grandFinal, bracketReset };
}

/* ------------------------------------------------------------------ */
/*  ROUND_ROBIN                                                        */
/* ------------------------------------------------------------------ */

export interface RRMatch {
  id: string;
  teamA: SimTeam;
  teamB: SimTeam;
  scoreA?: number;
  scoreB?: number;
  winner?: "A" | "B" | "DRAW";
}

export interface RRStanding {
  team: SimTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
}

const BYE_TEAM: SimTeam = { id: "__BYE__", code: "BYE", name: "Bye", color: "#333333" };

/** Circle method round-robin scheduler. Works for ANY team count,
 *  even/odd (odd counts get a rotating bye automatically).
 *  matchesPerPair: 1 = single, 2 = double. */
export function generateRoundRobinSchedule(teamsIn: SimTeam[], matchesPerPair: 1 | 2 = 1): RRMatch[] {
  const list = [...teamsIn];
  if (list.length % 2 !== 0) list.push(BYE_TEAM);
  const n = list.length;
  const fixed = list[0];
  let rest = list.slice(1);
  const rounds: RRMatch[] = [];

  for (let r = 0; r < n - 1; r++) {
    const roundTeams = [fixed, ...rest];
    for (let i = 0; i < n / 2; i++) {
      const a = roundTeams[i];
      const b = roundTeams[n - 1 - i];
      if (a.id !== BYE_TEAM.id && b.id !== BYE_TEAM.id) {
        rounds.push({ id: `RR-${r + 1}-${i + 1}`, teamA: a, teamB: b });
      }
    }
    rest.unshift(rest.pop()!);
  }

  if (matchesPerPair === 2) {
    return [...rounds, ...rounds.map((m) => ({ ...m, id: `${m.id}-2`, teamA: m.teamB, teamB: m.teamA }))];
  }
  return rounds;
}

export function simulateRoundRobinResults(matches: RRMatch[], allowDraw = false): RRMatch[] {
  return matches.map((m) => {
    if (allowDraw && Math.random() < 0.25) {
      const s = Math.floor(Math.random() * 3);
      return { ...m, scoreA: s, scoreB: s, winner: "DRAW" as const };
    }
    const aWins = Math.random() < 0.5;
    return { ...m, scoreA: randScore(aWins), scoreB: randScore(!aWins), winner: aWins ? "A" : "B" };
  });
}

export function computeStandings(
  teams: SimTeam[],
  matches: RRMatch[],
  points = { win: 2, draw: 1, loss: 0 }
): RRStanding[] {
  const map = new Map<string, RRStanding>();
  teams.forEach((t) => map.set(t.id, { team: t, played: 0, won: 0, drawn: 0, lost: 0, points: 0 }));

  for (const m of matches) {
    const sa = map.get(m.teamA.id);
    const sb = map.get(m.teamB.id);
    if (!sa || !sb || m.winner === undefined) continue;
    sa.played++; sb.played++;
    if (m.winner === "DRAW") {
      sa.drawn++; sb.drawn++;
      sa.points += points.draw; sb.points += points.draw;
    } else if (m.winner === "A") {
      sa.won++; sb.lost++;
      sa.points += points.win; sb.points += points.loss;
    } else {
      sb.won++; sa.lost++;
      sb.points += points.win; sa.points += points.loss;
    }
  }
  return [...map.values()].sort((x, y) => y.points - x.points);
}

/* ------------------------------------------------------------------ */
/*  GROUP_AND_SINGLE_ELIMINATION (composed example)                    */
/* ------------------------------------------------------------------ */

export interface GroupResult {
  name: string;
  teams: SimTeam[];
  matches: RRMatch[];
  standings: RRStanding[];
}

export function simulateGroupStage(
  teams: SimTeam[],
  groupCount: number,
  qualifiersPerGroup = 2
): { groupResults: GroupResult[]; qualifiers: SimTeam[] } {
  const groups: SimTeam[][] = Array.from({ length: groupCount }, () => []);
  teams.forEach((t, i) => groups[i % groupCount].push(t));

  const groupResults = groups.map((g, gi) => {
    const schedule = generateRoundRobinSchedule(g, 1);
    const played = simulateRoundRobinResults(schedule);
    const standings = computeStandings(g, played);
    return { name: `Group ${String.fromCharCode(65 + gi)}`, teams: g, matches: played, standings };
  });

  const qualifiers = groupResults.flatMap((gr) => gr.standings.slice(0, qualifiersPerGroup).map((s) => s.team));
  return { groupResults, qualifiers };
}