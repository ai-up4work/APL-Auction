import { useRef, useState } from "react";
import type { LiveState, BatterState, BowlerState } from "@/lib/overlayBus";

export type ExtraType = "none" | "wide" | "noBall" | "bye" | "legBye";

export const EXTRA_OPTIONS: { key: ExtraType; label: string }[] = [
  { key: "none", label: "Legal" },
  { key: "wide", label: "Wide" },
  { key: "noBall", label: "No Ball" },
  { key: "bye", label: "Bye" },
  { key: "legBye", label: "Leg Bye" },
];

export type DismissalType = "bowled" | "caught" | "lbw" | "runOut" | "stumped" | "hitWicket";

export const DISMISSAL_OPTIONS: { value: DismissalType; label: string }[] = [
  { value: "bowled", label: "Bowled" },
  { value: "caught", label: "Caught" },
  { value: "lbw", label: "LBW" },
  { value: "runOut", label: "Run Out" },
  { value: "stumped", label: "Stumped" },
  { value: "hitWicket", label: "Hit Wicket" },
];

// Free hit / no-ball wicket: only a run out is legal.
export const FREE_HIT_DISMISSAL_OPTIONS: { value: DismissalType; label: string }[] = [
  { value: "runOut", label: "Run Out" },
];

// NEW — a wide restricts dismissals differently: bowled/caught/lbw are
// impossible (the ball was never bowled within reach), but run out,
// stumped, and hit wicket are all still valid off a wide.
export const WIDE_DISMISSAL_OPTIONS: { value: DismissalType; label: string }[] = [
  { value: "runOut", label: "Run Out" },
  { value: "stumped", label: "Stumped" },
  { value: "hitWicket", label: "Hit Wicket" },
];

// single source of truth for which dismissals are legal on a given ball.
export function getValidDismissalOptions(extraType: ExtraType, isFreeHitActive: boolean) {
  if (isFreeHitActive || extraType === "noBall") return FREE_HIT_DISMISSAL_OPTIONS;
  if (extraType === "wide") return WIDE_DISMISSAL_OPTIONS;
  return DISMISSAL_OPTIONS;
}

export function isDismissalLockedToRunOutOnly(extraType: ExtraType, isFreeHitActive: boolean) {
  return isFreeHitActive || extraType === "noBall";
}

export function emptyBatterSlot(): BatterState {
  return { name: "", runs: 0, balls: 0, fours: 0, sixes: 0, imageUrl: undefined };
}

export interface PendingWicket {
  strikerBefore: { name: string; runs: number; balls: number };
  nonStrikerBefore: { name: string; runs: number; balls: number };
  bowlerName: string;
  overComplete: boolean;
  extraType: ExtraType;
  // was Free Hit armed for THIS ball (independent of extraType — a wide
  // can carry a free hit over, a no-ball forces the SAME restriction via
  // extraType alone, handled separately in getValidDismissalOptions).
  isFreeHitActive: boolean;
}

export type Toast = { id: number; text: string; tone: "boundary" | "milestone" | "wicket" };

function ballLegality(extraType: ExtraType) {
  const isWide = extraType === "wide";
  const isNoBall = extraType === "noBall";
  const isBye = extraType === "bye";
  const isLegBye = extraType === "legBye";
  return {
    isWide,
    isNoBall,
    isBye,
    isLegBye,
    countsAsLegalBall: !isWide && !isNoBall,
    extraPenaltyRun: isWide || isNoBall ? 1 : 0,
    batterCanScoreOffBat: extraType === "none" || isNoBall,
    bowlerConcedesRuns: !isBye && !isLegBye,
  };
}

function resolveBatterSlots(
  batsmanOut: "striker" | "nonStriker",
  strikerBefore: BatterState,
  nonStrikerBefore: BatterState,
  overComplete: boolean
): { striker: BatterState; nonStriker: BatterState } {
  let striker: BatterState = batsmanOut === "striker" ? emptyBatterSlot() : strikerBefore;
  let nonStriker: BatterState = batsmanOut === "nonStriker" ? emptyBatterSlot() : nonStrikerBefore;
  if (overComplete) {
    const tmp = striker;
    striker = nonStriker;
    nonStriker = tmp;
  }
  return { striker, nonStriker };
}

export function useLiveScoringEngine({
  liveState,
  setLiveState,
  setLiveDirty,
  onBoundary,
  onMilestone,
  onWicketConfirm,
}: {
  liveState: LiveState;
  setLiveState: React.Dispatch<React.SetStateAction<LiveState>>;
  setLiveDirty: (v: boolean) => void;
  onBoundary?: (moment: "four" | "six", batter: { name: string; runs: number; balls: number }) => void;
  onMilestone?: (moment: "fifty" | "hundred", batter: { name: string; runs: number; balls: number; label?: string }) => void;
  onWicketConfirm?: (payload: {
    batsmanOut: "striker" | "nonStriker";
    batter: { name: string; runs: number; balls: number };
    dismissalType: DismissalType;
    fielder: string;
    bowlerName: string;
  }) => void;
}) {
  const [extraType, setExtraType] = useState<ExtraType>("none");
  const [isFreeHit, setIsFreeHit] = useState(false);
  const [activeSlot, setActiveSlot] = useState<"striker" | "nonStriker" | "bowler">("striker");

  const undoRef = useRef<LiveState | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const [pendingWicket, setPendingWicket] = useState<PendingWicket | null>(null);

  function pushToast(text: string, tone: Toast["tone"]) {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1600);
  }

  function snapshotForUndo() {
    undoRef.current = liveState;
    setCanUndo(true);
  }

  function undo() {
    if (!undoRef.current) return;
    setLiveState(undoRef.current);
    setLiveDirty(true);
    undoRef.current = null;
    setCanUndo(false);
    setPendingWicket(null);
  }

  function patchLive(patch: Partial<LiveState>) {
    setLiveState((prev) => ({ ...prev, ...patch }));
    setLiveDirty(true);
  }

  function assignPlayer(slot: "striker" | "nonStriker" | "bowler", player: { name: string; imageUrl?: string }) {
    if (slot === "bowler") {
      setLiveState((prev) => ({ ...prev, bowler: { ...prev.bowler, name: player.name, imageUrl: player.imageUrl } }));
    } else {
      setLiveState((prev) => ({ ...prev, [slot]: { ...prev[slot], name: player.name, imageUrl: player.imageUrl } }));
    }
    setLiveDirty(true);
    if (slot === "striker") setActiveSlot("nonStriker");
    else if (slot === "nonStriker") setActiveSlot("bowler");
  }

  function swapStrike() {
    snapshotForUndo();
    setLiveState((prev) => ({ ...prev, striker: prev.nonStriker, nonStriker: prev.striker }));
    setLiveDirty(true);
  }

  function newPartnership() {
    setLiveState((prev) => ({ ...prev, partnership: { runs: 0, balls: 0 } }));
    setLiveDirty(true);
  }

  function recordBall(runs: number) {
    snapshotForUndo();
    const legality = ballLegality(extraType);
    const wasFreeHitBall = isFreeHit;

    const strikerBefore = liveState.striker;
    const runsBefore = strikerBefore.runs;
    const newRuns = legality.batterCanScoreOffBat ? runsBefore + runs : runsBefore;
    const newBalls = legality.countsAsLegalBall ? strikerBefore.balls + 1 : strikerBefore.balls;

    setLiveState((prev) => {
      const totalTeamRuns = runs + legality.extraPenaltyRun;

      let { overs, balls } = prev.score;
      let overComplete = false;
      if (legality.countsAsLegalBall) {
        balls += 1;
        if (balls >= 6) {
          overs += 1;
          balls = 0;
          overComplete = true;
        }
      }

      const striker: BatterState = { ...prev.striker };
      if (legality.batterCanScoreOffBat) {
        striker.runs += runs;
        if (runs === 4) striker.fours += 1;
        if (runs === 6) striker.sixes += 1;
      }
      if (legality.countsAsLegalBall) striker.balls += 1;

      const bowler: BowlerState = { ...prev.bowler };
      if (legality.bowlerConcedesRuns) bowler.runs += totalTeamRuns;
      if (legality.countsAsLegalBall) {
        bowler.balls += 1;
        if (bowler.balls >= 6) {
          bowler.overs += 1;
          bowler.balls = 0;
        }
      }

      const partnership = {
        runs: prev.partnership.runs + totalTeamRuns,
        balls: prev.partnership.balls + (legality.countsAsLegalBall ? 1 : 0),
      };

      const matchBoundaries = { ...prev.matchBoundaries };
      const tournamentBoundaries = { ...prev.tournamentBoundaries };
      if (legality.batterCanScoreOffBat && runs === 4) {
        matchBoundaries.fours += 1;
        tournamentBoundaries.fours += 1;
      }
      if (legality.batterCanScoreOffBat && runs === 6) {
        matchBoundaries.sixes += 1;
        tournamentBoundaries.sixes += 1;
      }

      let finalStriker = striker;
      let finalNonStriker = prev.nonStriker;
      const rotatesOnOdd = extraType !== "wide";
      if (rotatesOnOdd && runs % 2 === 1) {
        finalStriker = prev.nonStriker;
        finalNonStriker = striker;
      }
      if (overComplete) {
        const tmp = finalStriker;
        finalStriker = finalNonStriker;
        finalNonStriker = tmp;
      }

      return {
        ...prev,
        score: { ...prev.score, runs: prev.score.runs + totalTeamRuns, overs, balls },
        striker: finalStriker,
        nonStriker: finalNonStriker,
        bowler,
        partnership,
        matchBoundaries,
        tournamentBoundaries,
      };
    });

    setLiveDirty(true);

    if (extraType === "noBall") setIsFreeHit(true);
    else if (extraType === "wide") {
      /* carries over */
    } else setIsFreeHit(false);
    setExtraType("none");

    if (legality.batterCanScoreOffBat && (runs === 4 || runs === 6)) {
      const moment = runs === 4 ? "four" : "six";
      onBoundary?.(moment, { name: strikerBefore.name, runs: newRuns, balls: newBalls });
      pushToast(
        `${wasFreeHitBall ? "🔓 " : "🔥 "}${moment.toUpperCase()}${wasFreeHitBall ? " (Free Hit)" : ""} fired — ${strikerBefore.name || "Striker"} ${newRuns}(${newBalls})`,
        "boundary"
      );
    }
    if (legality.batterCanScoreOffBat && runsBefore < 50 && newRuns >= 50) {
      onMilestone?.("fifty", { name: strikerBefore.name, runs: newRuns, balls: newBalls, label: strikerBefore.name || "Striker" });
      pushToast(`🏏 FIFTY fired — ${strikerBefore.name || "Striker"}`, "milestone");
    }
    if (legality.batterCanScoreOffBat && runsBefore < 100 && newRuns >= 100) {
      onMilestone?.("hundred", { name: strikerBefore.name, runs: newRuns, balls: newBalls, label: strikerBefore.name || "Striker" });
      pushToast(`💯 HUNDRED fired — ${strikerBefore.name || "Striker"}`, "milestone");
    }
  }

  // step 1 — snapshot, don't touch score/wickets yet; resolveWicket does
  // all of that once we know the dismissal type and (for a run out) how
  // many runs were completed.
  function recordWicket() {
    snapshotForUndo();

    const strikerBefore = { ...liveState.striker };
    const nonStrikerBefore = { ...liveState.nonStriker };
    const bowlerName = liveState.bowler.name;
    const currentExtraType = extraType;
    const legality = ballLegality(currentExtraType);
    const overComplete = legality.countsAsLegalBall && liveState.score.balls + 1 >= 6;

    setPendingWicket({
      strikerBefore,
      nonStrikerBefore,
      bowlerName,
      overComplete,
      extraType: currentExtraType,
      isFreeHitActive: isFreeHit,
    });

    if (currentExtraType === "noBall") setIsFreeHit(true);
    else if (currentExtraType === "wide") {
      /* carries over */
    } else setIsFreeHit(false);
    setExtraType("none");
  }

  // step 2 — dialog has resolved who/how/runs completed.
  function resolveWicket(
    batsmanOut: "striker" | "nonStriker",
    fire: boolean,
    dismissalType: DismissalType,
    fielder: string,
    runsCompleted: number
  ) {
    if (!pendingWicket) return;
    const { strikerBefore, nonStrikerBefore, bowlerName, extraType: ballExtraType, overComplete } = pendingWicket;
    const legality = ballLegality(ballExtraType);

    const completedRuns = dismissalType === "runOut" ? Math.max(0, runsCompleted) : 0;
    const totalTeamRuns = completedRuns + legality.extraPenaltyRun;

    // FIX — a run out is a fielding dismissal; it must NOT count toward
    // the bowler's personal wicket tally, only the team's total.
    const creditsBowler = dismissalType !== "runOut";

    // FIX — the striker is always the one who faced the ball, so they
    // get credit for any completed runs + the ball faced regardless of
    // which end is actually given out. This is the score the fired
    // wicket graphic/toast must show.
    const strikerFinalRuns = legality.batterCanScoreOffBat ? strikerBefore.runs + completedRuns : strikerBefore.runs;
    const strikerFinalBalls = legality.countsAsLegalBall ? strikerBefore.balls + 1 : strikerBefore.balls;

    setLiveState((prev) => {
      let { overs, balls } = prev.score;
      if (legality.countsAsLegalBall) {
        balls += 1;
        if (balls >= 6) {
          overs += 1;
          balls = 0;
        }
      }

      const bowler = { ...prev.bowler, wickets: creditsBowler ? prev.bowler.wickets + 1 : prev.bowler.wickets };
      if (legality.bowlerConcedesRuns) bowler.runs += totalTeamRuns;
      if (legality.countsAsLegalBall) {
        bowler.balls += 1;
        if (bowler.balls >= 6) {
          bowler.overs += 1;
          bowler.balls = 0;
        }
      }

      const strikerFacing: BatterState = { ...prev.striker, runs: strikerFinalRuns, balls: strikerFinalBalls };
      const resolved = resolveBatterSlots(batsmanOut, strikerFacing, { ...prev.nonStriker }, overComplete);

      return {
        ...prev,
        score: {
          ...prev.score,
          runs: prev.score.runs + totalTeamRuns,
          wickets: Math.min(10, prev.score.wickets + 1),
          overs,
          balls,
        },
        bowler,
        striker: resolved.striker,
        nonStriker: resolved.nonStriker,
        partnership: { runs: 0, balls: 0 },
      };
    });
    setLiveDirty(true);

    if (fire) {
      const dismissedBatter =
        batsmanOut === "striker"
          ? { name: strikerBefore.name, runs: strikerFinalRuns, balls: strikerFinalBalls }
          : nonStrikerBefore;
      onWicketConfirm?.({ batsmanOut, batter: dismissedBatter, dismissalType, fielder, bowlerName });
      const lockedToRunOutOnly = isDismissalLockedToRunOutOnly(pendingWicket.extraType, pendingWicket.isFreeHitActive);
      pushToast(
        `${lockedToRunOutOnly ? "🔓 " : "🎯 "}WICKET fired — ${dismissedBatter.name || (batsmanOut === "striker" ? "Striker" : "Non-striker")} ${dismissalType}`,
        "wicket"
      );
    }

    setActiveSlot(batsmanOut);
    setPendingWicket(null);
  }

  return {
    extraType,
    setExtraType,
    isFreeHit,
    setIsFreeHit,
    activeSlot,
    setActiveSlot,
    canUndo,
    undo,
    toasts,
    pendingWicket,
    patchLive,
    assignPlayer,
    swapStrike,
    newPartnership,
    recordBall,
    recordWicket,
    resolveWicket,
  };
}