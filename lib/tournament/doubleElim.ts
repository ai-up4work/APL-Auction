// File: lib/tournament/doubleElim.ts
import type { Round, MatchNode, TeamNode } from "@/components/tournament/TournamentBracket";
import { AdminTeam, BYE_TEAM, nextPowerOfTwo, standardSeedOrder, roundMetaFor, toTeamNode } from "./seeding";
import { setResult } from "./singleElim";

export interface DoubleElimData {
  winners: Round[];
  losers: Round[];
  grandFinal: MatchNode;
  /** Only created if the losers-bracket champion wins the grand final —
   *  the winners-bracket champion just took their first loss, so it's a
   *  1-1 decider ("bracket reset"). */
  bracketReset: MatchNode | null;
}

/**
 * Builds a full double-elimination bracket for any team count (padded to
 * the next power of 2, top seeds get byes in the winners bracket exactly
 * like single elimination).
 *
 * BYES AND THE LOSERS BRACKET
 * ----------------------------
 * A bye produces no loser, so it can't feed a losers-bracket slot the way
 * a normal match does. Every losers-bracket "slot" that might end up with
 * zero or one real incoming team (because one or both of its WB feeders
 * were byes) is built using the same BYE_TEAM placeholder + immediate
 * resolution pattern already used for WB1 byes:
 *   - one real feeder + one permanently-empty (bye) feeder -> the slot
 *     stays open until the real feeder's match is played, then auto-
 *     resolves as a bye win for whoever that is (see resolveByeIfNeeded).
 *   - two permanently-empty (bye) feeders -> the slot resolves to a BYE
 *     "winner" immediately, at generation time, which then flows forward
 *     and gets transparently swapped out for whichever real team drops
 *     in during the next round.
 * advanceDoubleElim recurses whenever a slot auto-resolves this way, so
 * bye chains of any depth cascade correctly instead of stalling out.
 *
 * Internally every match's aFrom/bFrom is prefixed "W:" (winner of that
 * match feeds this slot) or "L:" (loser of that match feeds this slot) —
 * that's how advanceDoubleElim knows what to route where. These labels are
 * plumbing only; DoubleElimBoard renders its own labels, it doesn't reuse
 * TournamentBracket's "From {label}" text.
 */
export function generateDoubleElimination(teamsBySeed: AdminTeam[]): DoubleElimData {
  if (teamsBySeed.length < 2) throw new Error("Need at least 2 teams");
  const n = nextPowerOfTwo(teamsBySeed.length);
  const seedOrder = standardSeedOrder(n);
  const slots: (TeamNode | null)[] = seedOrder.map((seed, idx) =>
    seed <= teamsBySeed.length ? toTeamNode(teamsBySeed[seed - 1], idx) : null
  );

  /* ---------------- Winners bracket ---------------- */
  const winners: Round[] = [];
  const wb1Meta = roundMetaFor(n);
  const wb1: MatchNode[] = [];
  for (let i = 0; i < n / 2; i++) {
    const a = slots[i * 2];
    const b = slots[i * 2 + 1];
    const id = `WB-${wb1Meta.shortName}-${i + 1}`;
    if (a && b) {
      wb1.push({ id, label: id, status: "scheduled", teamA: a, teamB: b, aFrom: null, bFrom: null });
    } else {
      const only = (a ?? b) as TeamNode;
      wb1.push({
        id, label: id, status: "completed",
        teamA: { ...only, isWinner: true }, teamB: { ...BYE_TEAM },
        aFrom: null, bFrom: null, venue: "Bye",
      });
    }
  }
  winners.push({ id: 1, name: `Winners — ${wb1Meta.name}`, shortName: `WB-${wb1Meta.shortName}`, matches: wb1 });

  let prev = wb1;
  let count = n / 2;
  let roundId = 2;
  while (count > 1) {
    const meta = roundMetaFor(count);
    const matches: MatchNode[] = [];
    for (let i = 0; i < count / 2; i++) {
      const fa = prev[i * 2], fb = prev[i * 2 + 1];
      const id = `WB-${meta.shortName}-${i + 1}`;
      matches.push({ id, label: id, status: "scheduled", teamA: null, teamB: null, aFrom: `W:${fa.id}`, bFrom: `W:${fb.id}` });
    }
    winners.push({ id: roundId, name: `Winners — ${meta.name}`, shortName: `WB-${meta.shortName}`, matches });
    prev = matches;
    count /= 2;
    roundId++;
  }

  /* ---------------- Losers bracket ----------------
   * Alternates "drop" rounds (losers-bracket survivors face fresh losers
   * dropping from the winners bracket) and "consolidation" rounds (losers-
   * bracket survivors play each other), halving the field every two rounds,
   * until the winners-bracket final's loser plays into the Losers Final. */
  const losers: Round[] = [];
  let lbCounter = 1;
  let lbPrev: MatchNode[] = [];

  if (wb1.length >= 2) {
    const matches: MatchNode[] = [];
    for (let i = 0; i < Math.floor(wb1.length / 2); i++) {
      const fa = wb1[i * 2], fb = wb1[i * 2 + 1];
      const id = `LB-${lbCounter}-${i + 1}`;

      // A bye WB1 match (fa/fb) produced no loser — that side of this
      // LB1 slot will never be filled by advanceDoubleElim, so treat it
      // as a permanent BYE placeholder instead of a live "L:" reference.
      const aIsByeMatch = fa.teamB?.code === "BYE";
      const bIsByeMatch = fb.teamB?.code === "BYE";

      const match: MatchNode = {
        id, label: id, status: "scheduled",
        teamA: aIsByeMatch ? { ...BYE_TEAM } : null,
        teamB: bIsByeMatch ? { ...BYE_TEAM } : null,
        aFrom: aIsByeMatch ? null : `L:${fa.id}`,
        bFrom: bIsByeMatch ? null : `L:${fb.id}`,
      };

      // Both feeders were byes -> no real contender at all for this slot.
      // Resolve it now so a (placeholder) "winner" can still flow forward
      // and later be swapped out for whichever real team drops in.
      if (aIsByeMatch && bIsByeMatch) {
        match.status = "completed";
        match.teamA = { ...BYE_TEAM, isWinner: true };
      }

      matches.push(match);
    }
    if (matches.length) {
      losers.push({ id: 100 + lbCounter, name: "Losers — Round 1", shortName: "LB1", matches });
      lbPrev = matches;
      lbCounter++;
    }
  }

  for (let wbIdx = 1; wbIdx < winners.length; wbIdx++) {
    const wbRound = winners[wbIdx];
    const isWbFinal = wbIdx === winners.length - 1;

    const dropMatches: MatchNode[] = [];
    for (let i = 0; i < wbRound.matches.length; i++) {
      const wbMatch = wbRound.matches[i];
      const survivor = lbPrev[i];
      if (!survivor) continue;
      const id = isWbFinal ? "LB-Final" : `LB-${lbCounter}-${i + 1}`;
      dropMatches.push({
        id, label: id, status: "scheduled", teamA: null, teamB: null,
        aFrom: `W:${survivor.id}`, bFrom: `L:${wbMatch.id}`,
      });
    }
    if (dropMatches.length) {
      losers.push({
        id: 100 + lbCounter,
        name: isWbFinal ? "Losers Final" : `Losers — Drop ${wbIdx + 1}`,
        shortName: isWbFinal ? "LBF" : `LB${lbCounter}D`,
        matches: dropMatches,
      });
      lbPrev = dropMatches;
      lbCounter++;
    }

    if (!isWbFinal && dropMatches.length > 1) {
      const consMatches: MatchNode[] = [];
      for (let i = 0; i < Math.floor(dropMatches.length / 2); i++) {
        const fa = dropMatches[i * 2], fb = dropMatches[i * 2 + 1];
        const id = `LB-${lbCounter}-${i + 1}`;
        consMatches.push({ id, label: id, status: "scheduled", teamA: null, teamB: null, aFrom: `W:${fa.id}`, bFrom: `W:${fb.id}` });
      }
      losers.push({ id: 100 + lbCounter, name: "Losers — Consolidation", shortName: `LB${lbCounter}C`, matches: consMatches });
      lbPrev = consMatches;
      lbCounter++;
    }
  }

  const wbFinalId = winners[winners.length - 1].matches[0].id;
  const lbFinalId = losers.length ? losers[losers.length - 1].matches[0].id : wbFinalId;
  const grandFinal: MatchNode = {
    id: "GF", label: "Grand Final", status: "scheduled", teamA: null, teamB: null,
    aFrom: `W:${wbFinalId}`, bFrom: `W:${lbFinalId}`,
  };

  const data: DoubleElimData = { winners, losers, grandFinal, bracketReset: null };

  // Propagate any bye already resolved at generation time — WB1 byes,
  // and any double-bye LB1 slots — through the whole structure.
  for (const m of allMatches(data)) {
    if (m.status === "completed") advanceDoubleElim(data, m);
  }

  return data;
}

function teamFromResult(match: MatchNode, wantLoser: boolean): TeamNode | null {
  const winner = match.teamA?.isWinner ? match.teamA : match.teamB?.isWinner ? match.teamB : null;
  if (!winner) return null;
  if (!wantLoser) return winner;
  const loser = match.teamA?.isWinner ? match.teamB : match.teamB?.isWinner ? match.teamA : null;
  if (!loser || loser.code === "BYE") return null; // nobody drops from a bye
  return loser;
}

function allMatches(data: DoubleElimData): MatchNode[] {
  return [
    ...data.winners.flatMap((r) => r.matches),
    ...data.losers.flatMap((r) => r.matches),
    data.grandFinal,
    ...(data.bracketReset ? [data.bracketReset] : []),
  ];
}

/** If a match has one permanent BYE placeholder side and a real (non-BYE)
 *  team now sitting in the other side, it's effectively already decided —
 *  complete it as a bye win, same as a WB1 bye. Returns true if it just
 *  resolved a match (so the caller knows to cascade the result onward). */
function resolveByeIfNeeded(match: MatchNode): boolean {
  if (match.status === "completed") return false;
  const aIsBye = match.teamA?.code === "BYE";
  const bIsBye = match.teamB?.code === "BYE";
  if (aIsBye && match.teamB && match.teamB.code !== "BYE") {
    match.status = "completed";
    match.teamB = { ...match.teamB, isWinner: true };
    return true;
  }
  if (bIsBye && match.teamA && match.teamA.code !== "BYE") {
    match.status = "completed";
    match.teamA = { ...match.teamA, isWinner: true };
    return true;
  }
  return false;
}

/** Scans every match for an aFrom/bFrom that references `sourceMatch` (as
 *  a winner-feed "W:id" or loser-feed "L:id") and fills that slot in.
 *  If filling a slot completes a bye (see resolveByeIfNeeded), recurses
 *  so the auto-resolved result keeps propagating forward too. */
export function advanceDoubleElim(data: DoubleElimData, sourceMatch: MatchNode) {
  for (const target of allMatches(data)) {
    let touched = false;
    if (target.aFrom === `W:${sourceMatch.id}` || target.aFrom === `L:${sourceMatch.id}`) {
      const team = teamFromResult(sourceMatch, target.aFrom.startsWith("L:"));
      if (team) {
        target.teamA = { ...team, score: undefined, isWinner: undefined };
        touched = true;
      }
    }
    if (target.bFrom === `W:${sourceMatch.id}` || target.bFrom === `L:${sourceMatch.id}`) {
      const team = teamFromResult(sourceMatch, target.bFrom.startsWith("L:"));
      if (team) {
        target.teamB = { ...team, score: undefined, isWinner: undefined };
        touched = true;
      }
    }
    if (touched && resolveByeIfNeeded(target)) {
      advanceDoubleElim(data, target);
    }
  }
}

export function recordDoubleElimResult(
  data: DoubleElimData,
  matchId: string,
  winner: "A" | "B",
  scoreA: number,
  scoreB: number
) {
  const match = allMatches(data).find((m) => m.id === matchId);
  if (!match) return;
  setResult(match, winner, scoreA, scoreB);
  advanceDoubleElim(data, match);

  // grand-final reset: losers-bracket side just beat the previously-
  // unbeaten winners-bracket champion — that's their first loss, replay.
  if (match.id === "GF" && winner === "B" && !data.bracketReset) {
    data.bracketReset = {
      id: "GF-Reset", label: "Grand Final (Reset)", status: "scheduled",
      teamA: match.teamA ? { ...match.teamA, score: undefined, isWinner: undefined } : null,
      teamB: match.teamB ? { ...match.teamB, score: undefined, isWinner: undefined } : null,
      aFrom: null, bFrom: null,
    };
  }
}

export function championOfDoubleElim(data: DoubleElimData): TeamNode | null {
  const decider = data.bracketReset ?? data.grandFinal;
  if (decider.teamA?.isWinner) return decider.teamA;
  if (decider.teamB?.isWinner) return decider.teamB;
  return null;
}