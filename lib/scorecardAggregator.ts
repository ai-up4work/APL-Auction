import type { BallRow } from "@/hooks/useBallsLedger";

export interface BattingRow {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: string | null; // formatted dismissal, or null if not out / didn't bat yet
  order: number;
  top: boolean; // highest scorer flag, computed after aggregation
}

export interface BowlingRow {
  name: string;
  overs: string; // "3.2"
  runs: number;
  wickets: number;
  maidens: number;
  figures: string; // "W-R" e.g. "2-24", matches StatRow's value1 usage
  order: number;
  top: boolean; // best bowling figures flag
}

export interface InningsCard {
  label: string; // "1st Innings" / "2nd Innings"
  score: string; // "156/4"
  overs: string; // "18.3"
  batting: BattingRow[];
  bowling: BowlingRow[];
}

function ballLegalityLite(extraType: string | null) {
  const isWide = extraType === "wide";
  const isNoBall = extraType === "noBall";
  const isBye = extraType === "bye";
  const isLegBye = extraType === "legBye";
  return {
    countsAsLegalBall: !isWide && !isNoBall,
    extraPenaltyRun: isWide || isNoBall ? 1 : 0,
    batterCanScoreOffBat: extraType === "none" || extraType === null || isNoBall,
    bowlerConcedesRuns: !isBye && !isLegBye,
  };
}

function formatOvers(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

function describeDismissal(
  dismissalType: string | null,
  bowlerName: string | null,
  fielder: string | null
): string {
  switch (dismissalType) {
    case "bowled":
      return `b ${bowlerName || "—"}`;
    case "caught":
      return fielder ? `c ${fielder} b ${bowlerName || "—"}` : `c & b ${bowlerName || "—"}`;
    case "lbw":
      return `lbw b ${bowlerName || "—"}`;
    case "stumped":
      return `st ${fielder || "—"} b ${bowlerName || "—"}`;
    case "hitWicket":
      return `hit wicket b ${bowlerName || "—"}`;
    case "runOut":
      return fielder ? `run out (${fielder})` : "run out";
    default:
      return "out";
  }
}

/**
 * Builds a full batting + bowling card for one innings from the raw ball
 * ledger. Pure function — no live engine state involved, so it can never
 * drift from what actually happened; it's a replay of the ledger.
 */
export function buildInningsCard(
  balls: BallRow[],
  inningsNumber: 1 | 2,
  label: string
): InningsCard {
  const rows = balls
    .filter((b) => b.innings_number === inningsNumber)
    .sort((a, b) => a.sequence - b.sequence);

  const batting = new Map<string, BattingRow>();
  const bowling = new Map<string, BowlingRow & { legalBalls: number }>();
  // over_number -> { bowlerName, concededThisOver, legalBallsThisOver }
  const overTracker = new Map<string, { bowler: string; conceded: number; legalBalls: number }>();

  let order = 0;
  let totalRuns = 0;
  let totalWickets = 0;
  let totalLegalBalls = 0;

  for (const b of rows) {
    const legality = ballLegalityLite(b.extra_type);
    const totalTeamRuns = b.runs + legality.extraPenaltyRun;

    totalRuns += totalTeamRuns;
    if (legality.countsAsLegalBall) totalLegalBalls++;
    if (b.is_wicket) totalWickets++;

    // batting
    if (b.striker_name) {
      const e =
        batting.get(b.striker_name) ??
        { name: b.striker_name, runs: 0, balls: 0, fours: 0, sixes: 0, out: null, order: order++, top: false };
      if (legality.batterCanScoreOffBat) {
        e.runs += b.runs;
        if (b.runs === 4) e.fours += 1;
        if (b.runs === 6) e.sixes += 1;
      }
      if (legality.countsAsLegalBall) e.balls += 1;
      batting.set(b.striker_name, e);
    }
    if (b.non_striker_name && !batting.has(b.non_striker_name)) {
      batting.set(b.non_striker_name, {
        name: b.non_striker_name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: null,
        order: order++,
        top: false,
      });
    }
    if (b.is_wicket && b.batsman_out) {
      const dismissedName = b.batsman_out === "striker" ? b.striker_name : b.non_striker_name;
      if (dismissedName) {
        const e = batting.get(dismissedName);
        if (e) e.out = describeDismissal(b.dismissal_type, b.bowler_name, b.fielder);
      }
    }

    // bowling
    if (b.bowler_name) {
      const e =
        bowling.get(b.bowler_name) ??
        { name: b.bowler_name, overs: "0.0", runs: 0, wickets: 0, maidens: 0, figures: "0-0", order: order++, top: false, legalBalls: 0 };
      if (legality.bowlerConcedesRuns) e.runs += totalTeamRuns;
      if (legality.countsAsLegalBall) e.legalBalls += 1;
      if (b.is_wicket && b.dismissal_type !== "runOut") e.wickets += 1;
      bowling.set(b.bowler_name, e);

      // maiden tracking, grouped by (bowler, over_number)
      const overKey = `${b.bowler_name}:${b.over_number}`;
      const ot = overTracker.get(overKey) ?? { bowler: b.bowler_name, conceded: 0, legalBalls: 0 };
      if (legality.bowlerConcedesRuns) ot.conceded += totalTeamRuns;
      if (legality.countsAsLegalBall) ot.legalBalls += 1;
      overTracker.set(overKey, ot);
    }
  }

  // finalize maidens: any tracked over with 6 legal balls and 0 conceded
  for (const ot of overTracker.values()) {
    if (ot.legalBalls >= 6 && ot.conceded === 0) {
      const e = bowling.get(ot.bowler);
      if (e) e.maidens += 1;
    }
  }

  // finalize display strings
  const battingRows = Array.from(batting.values()).sort((a, b) => a.order - b.order);
  const bowlingRows = Array.from(bowling.values())
    .sort((a, b) => a.order - b.order)
    .map((e) => ({
      ...e,
      overs: formatOvers(e.legalBalls),
      figures: `${e.wickets}-${e.runs}`,
    }));

  // mark top performers
  if (battingRows.length) {
    const maxRuns = Math.max(...battingRows.map((r) => r.runs));
    if (maxRuns > 0) {
      const top = battingRows.find((r) => r.runs === maxRuns);
      if (top) top.top = true;
    }
  }
  if (bowlingRows.length) {
    const best = bowlingRows.reduce((acc, r) =>
      r.wickets > acc.wickets || (r.wickets === acc.wickets && r.runs < acc.runs) ? r : acc
    );
    if (best.wickets > 0) best.top = true;
  }

  return {
    label,
    score: `${totalRuns}/${totalWickets}`,
    overs: formatOvers(totalLegalBalls),
    batting: battingRows,
    bowling: bowlingRows.map(({ legalBalls, ...rest }) => rest),
  };
}