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

// A wide restricts dismissals differently: bowled/caught/lbw are
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

export function emptyBowlerSlot(): BowlerState {
  return { name: "", overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 };
}

export interface PendingWicket {
  strikerBefore: { name: string; runs: number; balls: number };
  nonStrikerBefore: { name: string; runs: number; balls: number };
  bowlerName: string;
  overComplete: boolean;
  extraType: ExtraType;
  isFreeHitActive: boolean;
}

export type ToastTone = "boundary" | "milestone" | "wicket" | "maiden" | "warning" | "info";
export type Toast = { id: number; text: string; tone: ToastTone };

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
    // Byes/leg-byes are never charged to the bowler — this is also exactly
    // why they don't break a maiden over even though the team total moves.
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
  onMaiden,
  onInningsEnd,
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
  onMaiden?: (payload: { bowlerName: string; maidens: number }) => void;
  onInningsEnd?: (payload: { target: number; previousInningsRuns: number; inningsNumber: 1 | 2 }) => void;
}) {
  const [extraType, setExtraType] = useState<ExtraType>("none");
  const [isFreeHit, setIsFreeHit] = useState(false);
  const [activeSlot, setActiveSlot] = useState<"striker" | "nonStriker" | "bowler">("striker");

  const undoRef = useRef<LiveState | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const [pendingWicket, setPendingWicket] = useState<PendingWicket | null>(null);

  // Runs conceded by the CURRENT bowler in the over currently in progress.
  // Reset to 0 whenever that over completes, or a different bowler is
  // assigned into the slot (a fresh spell can't inherit a partial over's
  // concession count). This is what lets us detect a maiden the instant
  // the 6th legal ball of the over lands.
  const overRunsConcededRef = useRef(0);

  function pushToast(text: string, tone: ToastTone) {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1600);
  }

  function assignmentsMissing() {
    return !liveState.striker.name || !liveState.nonStriker.name || !liveState.bowler.name;
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
    // Best-effort only — we can't recover exactly how many runs the
    // current-bowler-over-in-progress had conceded before the undone
    // ball, so we just zero it. Worst case: one over's maiden detection
    // is slightly off immediately after an undo. Flagged as a known
    // limitation, same as undo being single-level.
    overRunsConcededRef.current = 0;
  }

  function patchLive(patch: Partial<LiveState>) {
    setLiveState((prev) => ({ ...prev, ...patch }));
    setLiveDirty(true);
  }

  function assignPlayer(slot: "striker" | "nonStriker" | "bowler", player: { name: string; imageUrl?: string }) {
    if (slot === "bowler") {
      const isNewBowler = liveState.bowler.name !== player.name;
      if (isNewBowler) overRunsConcededRef.current = 0;
      setLiveState((prev) => ({
        ...prev,
        bowler: isNewBowler
          ? { ...emptyBowlerSlot(), name: player.name, imageUrl: player.imageUrl }
          : { ...prev.bowler, name: player.name, imageUrl: player.imageUrl },
      }));
    } else {
      // FIX — assigning a genuinely different batter into this slot must
      // start that batter's runs/balls/4s/6s at 0. Previously ONLY the
      // bowler slot had this "new person -> reset stats" guard; a batter
      // slot just spread {...prev[slot], name, imageUrl}, which meant
      // swapping in a different batter (e.g. correcting a wrong pick, or
      // after using the new "clear slot" button below) silently handed
      // the new batter whatever runs/balls the OUTGOING batter already
      // had in that slot. Re-assigning the SAME name (e.g. re-picking
      // after a misfire) still preserves their figures, same as before.
      const isNewBatter = liveState[slot].name !== player.name;
      setLiveState((prev) => ({
        ...prev,
        [slot]: isNewBatter
          ? { ...emptyBatterSlot(), name: player.name, imageUrl: player.imageUrl }
          : { ...prev[slot], name: player.name, imageUrl: player.imageUrl },
      }));
    }
    setLiveDirty(true);
    if (slot === "striker") setActiveSlot("nonStriker");
    else if (slot === "nonStriker") setActiveSlot("bowler");
  }

  // NEW — clears a slot back to fully empty (name, image, and all stats)
  // instead of only ever being overwritable by assigning a different
  // player on top of it. Use case: wrong player picked and you want to
  // undo the assignment outright, not just swap in a replacement.
  function clearSlot(slot: "striker" | "nonStriker" | "bowler") {
    snapshotForUndo();
    if (slot === "bowler") {
      overRunsConcededRef.current = 0;
    }
    setLiveState((prev) => ({
      ...prev,
      [slot]: slot === "bowler" ? emptyBowlerSlot() : emptyBatterSlot(),
    }));
    setLiveDirty(true);
    setActiveSlot(slot);
    const label = slot === "striker" ? "Striker" : slot === "nonStriker" ? "Non-striker" : "Bowler";
    pushToast(`${label} cleared — pick a replacement`, "info");
  }

  function swapStrike() {
    snapshotForUndo();
    setLiveState((prev) => ({ ...prev, striker: prev.nonStriker, nonStriker: prev.striker }));
    setLiveDirty(true);
    pushToast("Strike swapped ↺", "info");
  }

  function newPartnership() {
    snapshotForUndo();
    setLiveState((prev) => ({ ...prev, partnership: { runs: 0, balls: 0 } }));
    setLiveDirty(true);
    pushToast("New partnership started ↺", "info");
  }

  function recordBall(runs: number) {
    if (assignmentsMissing()) {
      pushToast("⚠️ Set striker, non-striker & bowler before scoring", "warning");
      return;
    }

    snapshotForUndo();
    const legality = ballLegality(extraType);
    const wasFreeHitBall = isFreeHit;

    const strikerBefore = liveState.striker;
    const runsBefore = strikerBefore.runs;
    const newRuns = legality.batterCanScoreOffBat ? runsBefore + runs : runsBefore;
    const newBalls = legality.countsAsLegalBall ? strikerBefore.balls + 1 : strikerBefore.balls;

    // Maiden bookkeeping — computed against the CURRENT bowler state
    // (before this ball), so it's deterministic regardless of what the
    // state updater below does.
    const totalTeamRuns = runs + legality.extraPenaltyRun;
    const concededThisBall = legality.bowlerConcedesRuns ? totalTeamRuns : 0;
    const bowlerOverCompletesThisBall = legality.countsAsLegalBall && liveState.bowler.balls + 1 >= 6;
    const overRunsAfterThisBall = overRunsConcededRef.current + concededThisBall;
    const maidenFired = bowlerOverCompletesThisBall && overRunsAfterThisBall === 0;
    overRunsConcededRef.current = bowlerOverCompletesThisBall ? 0 : overRunsAfterThisBall;

    const bowlerNameForMoment = liveState.bowler.name;

    setLiveState((prev) => {
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
      if (maidenFired) bowler.maidens += 1;

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
    if (maidenFired) {
      onMaiden?.({ bowlerName: bowlerNameForMoment, maidens: liveState.bowler.maidens + 1 });
      pushToast(`🧤 MAIDEN OVER — ${bowlerNameForMoment || "Bowler"}`, "maiden");
    }
  }

  // step 1 — snapshot, don't touch score/wickets yet; resolveWicket does
  // all of that once we know the dismissal type and (for a run out) how
  // many runs were completed.
  function recordWicket() {
    if (assignmentsMissing()) {
      pushToast("⚠️ Set striker, non-striker & bowler before recording a wicket", "warning");
      return;
    }

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

    const creditsBowler = dismissalType !== "runOut";

    const strikerFinalRuns = legality.batterCanScoreOffBat ? strikerBefore.runs + completedRuns : strikerBefore.runs;
    const strikerFinalBalls = legality.countsAsLegalBall ? strikerBefore.balls + 1 : strikerBefore.balls;

    // Maiden bookkeeping — a wicket doesn't break a maiden; only runs
    // charged to the bowler do. Deferred to here (not recordWicket step 1)
    // because completedRuns depends on what's chosen in the dialog.
    const concededThisBall = legality.bowlerConcedesRuns ? totalTeamRuns : 0;
    const overRunsAfterThisBall = overRunsConcededRef.current + concededThisBall;
    const maidenFired = overComplete && overRunsAfterThisBall === 0;
    overRunsConcededRef.current = overComplete ? 0 : overRunsAfterThisBall;

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
      if (maidenFired) bowler.maidens += 1;

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
    if (maidenFired) {
      onMaiden?.({ bowlerName, maidens: liveState.bowler.maidens + 1 });
      pushToast(`🧤 MAIDEN OVER — ${bowlerName || "Bowler"}`, "maiden");
    }

    setActiveSlot(batsmanOut);
    setPendingWicket(null);
  }

  // Ends the current innings: snapshots a target (1st innings only),
  // resets score/partnership/striker/non-striker/bowler so the operator
  // MUST reassign everyone for the new innings (this doubles as the fix
  // for "players carrying over unset" at innings change), and carries
  // matchBoundaries/tournamentBoundaries forward since those are
  // whole-match / whole-tournament cumulative totals, not per-innings.
  // The caller (LiveStatePanel) is responsible for the confirmation
  // dialog — this function assumes confirmation already happened.
  function endInnings() {
    snapshotForUndo();
    overRunsConcededRef.current = 0;

    const currentInningsNumber = (liveState.inningsNumber ?? 1) as 1 | 2;

    if (currentInningsNumber >= 2) {
      // Ending the 2nd innings = match over. Lock further scoring rather
      // than silently resetting a match that's actually finished.
      setLiveState((prev) => ({ ...prev, matchComplete: true }));
      setLiveDirty(true);
      pushToast("🏁 Match marked complete", "info");
      return;
    }

    const previousInningsRuns = liveState.score.runs;
    const target = previousInningsRuns + 1;

    setLiveState((prev) => ({
      ...prev,
      target,
      inningsNumber: 2,
      score: { runs: 0, wickets: 0, overs: 0, balls: 0 },
      striker: emptyBatterSlot(),
      nonStriker: emptyBatterSlot(),
      bowler: emptyBowlerSlot(),
      partnership: { runs: 0, balls: 0 },
      // matchBoundaries / tournamentBoundaries intentionally NOT reset —
      // they're cumulative, per the naming.
    }));
    setLiveDirty(true);
    onInningsEnd?.({ target, previousInningsRuns, inningsNumber: 2 });
    pushToast(`🔁 Innings 1 closed — target set to ${target}`, "info");
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
    assignmentsMissing,
    patchLive,
    assignPlayer,
    clearSlot,
    swapStrike,
    newPartnership,
    recordBall,
    recordWicket,
    resolveWicket,
    endInnings,
  };
}