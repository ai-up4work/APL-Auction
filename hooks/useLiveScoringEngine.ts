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

export const FREE_HIT_DISMISSAL_OPTIONS: { value: DismissalType; label: string }[] = [
  { value: "runOut", label: "Run Out" },
];

export const WIDE_DISMISSAL_OPTIONS: { value: DismissalType; label: string }[] = [
  { value: "runOut", label: "Run Out" },
  { value: "stumped", label: "Stumped" },
  { value: "hitWicket", label: "Hit Wicket" },
];

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

// NEW — result of a completed match, as computed by the auto-detection
// logic (or by the manual End Match button, which now uses the same
// computation instead of just flipping matchComplete with no data).
export interface AutoMatchResult {
  winningTeamName: string;
  margin: string;
  method: "batting" | "bowling" | "tie";
}

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

// NEW — shared math for deciding who won innings 2, given a final score
// state and the target. Used by both the automatic detector and the
// manual "End Match" button, so the two can never disagree.
function computeInnings2Result(
  finalRuns: number,
  finalWickets: number,
  target: number
): { winningSide: "batting" | "bowling" | "tie"; margin: string } {
  if (finalRuns >= target) {
    const wicketsInHand = Math.max(0, 10 - finalWickets);
    return { winningSide: "batting", margin: `won by ${wicketsInHand} wicket${wicketsInHand === 1 ? "" : "s"}` };
  }
  const marginRuns = target - 1 - finalRuns;
  if (marginRuns <= 0) return { winningSide: "tie", margin: "Match Tied" };
  return { winningSide: "bowling", margin: `won by ${marginRuns} run${marginRuns === 1 ? "" : "s"}` };
}

export function useLiveScoringEngine({
  liveState,
  setLiveState,
  setLiveDirty,
  maxOvers,
  battingTeamName,
  bowlingTeamName,
  onBoundary,
  onMilestone,
  onWicketConfirm,
  onMaiden,
  onInningsEnd,
  onMatchComplete,
}: {
  liveState: LiveState;
  setLiveState: React.Dispatch<React.SetStateAction<LiveState>>;
  setLiveDirty: (v: boolean) => void;
  // NEW — undefined means no overs limit (Test cricket): only all-out ends
  // an innings automatically.
  maxOvers?: number;
  // NEW — names of the CURRENT batting/bowling side, for building match
  // result text. LiveStatePanel recomputes these each render based on
  // toss + inningsNumber, so they're always correct for "right now".
  battingTeamName: string;
  bowlingTeamName: string;
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
  // NEW — fired the moment a match auto-completes (or completes via the
  // manual End Match button with a determinable result).
  onMatchComplete?: (result: AutoMatchResult) => void;
}) {
  const [extraType, setExtraType] = useState<ExtraType>("none");
  const [isFreeHit, setIsFreeHit] = useState(false);
  const [activeSlot, setActiveSlot] = useState<"striker" | "nonStriker" | "bowler">("striker");

  const undoRef = useRef<LiveState | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const [pendingWicket, setPendingWicket] = useState<PendingWicket | null>(null);

  const [dismissedPlayers, setDismissedPlayers] = useState<Set<string>>(new Set());
  const dismissedPlayersUndoRef = useRef<Set<string> | null>(null);

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
    dismissedPlayersUndoRef.current = new Set(dismissedPlayers);
    setCanUndo(true);
  }

  function undo() {
    if (!undoRef.current) return;
    setLiveState(undoRef.current);
    setLiveDirty(true);
    setDismissedPlayers(dismissedPlayersUndoRef.current ?? new Set());
    undoRef.current = null;
    dismissedPlayersUndoRef.current = null;
    setCanUndo(false);
    setPendingWicket(null);
    overRunsConcededRef.current = 0;
  }

  function patchLive(patch: Partial<LiveState>) {
    setLiveState((prev) => ({ ...prev, ...patch }));
    setLiveDirty(true);
  }

  // ── Auto match/innings completion ────────────────────────────────────
  // NEW — flips innings 1 -> 2 with a target, exactly like the manual End
  // Innings button, but driven by a freshly-computed run total rather than
  // whatever's in `liveState` (which hasn't re-rendered yet this tick).
  function applyInningsOneComplete(finalRuns: number) {
    const target = finalRuns + 1;
    setLiveState((prev) => ({
      ...prev,
      target,
      inningsNumber: 2,
      score: { runs: 0, wickets: 0, overs: 0, balls: 0 },
      striker: emptyBatterSlot(),
      nonStriker: emptyBatterSlot(),
      bowler: emptyBowlerSlot(),
      partnership: { runs: 0, balls: 0 },
    }));
    setLiveDirty(true);
    setDismissedPlayers(new Set());
    overRunsConcededRef.current = 0;
    onInningsEnd?.({ target, previousInningsRuns: finalRuns, inningsNumber: 2 });
    pushToast(`🔁 Innings complete — target set to ${target}`, "info");
  }

  // NEW — marks the match complete with a real result (winner + margin),
  // and notifies the parent so it can fire the "match won" overlay moment.
  function applyMatchComplete(opts: { winningSide: "batting" | "bowling" | "tie"; margin: string }) {
    const winningTeamName =
      opts.winningSide === "batting" ? battingTeamName : opts.winningSide === "bowling" ? bowlingTeamName : "Tie";
    const method: "runs" | "wickets" | "tie" =
      opts.winningSide === "bowling" ? "runs" : opts.winningSide === "batting" ? "wickets" : "tie";

    setLiveState((prev) => ({
      ...prev,
      matchComplete: true,
      matchResult: { winningTeamName, margin: opts.margin, method },
    }));
    setLiveDirty(true);
    pushToast(`🏁 ${winningTeamName} ${opts.margin}`, "info");
    onMatchComplete?.({ winningTeamName, margin: opts.margin, method: opts.winningSide });
  }

  // NEW — call after every ball/wicket with the FRESHLY COMPUTED next
  // score, not `liveState` (which is stale until next render). Decides
  // whether the innings or the whole match should auto-complete.
  function checkAutoEndConditions(next: { runs: number; wickets: number; overs: number; balls: number }) {
    if (liveState.matchComplete) return;

    const inningsNum = (liveState.inningsNumber ?? 1) as 1 | 2;
    const ballsBowled = next.overs * 6 + next.balls;
    const oversDone = maxOvers !== undefined && ballsBowled >= maxOvers * 6;
    const allOut = next.wickets >= 10;

    if (inningsNum === 1) {
      if (allOut || oversDone) applyInningsOneComplete(next.runs);
      return;
    }

    const target = liveState.target;
    if (target === undefined) return; // shouldn't happen in innings 2, but stay safe

    if (next.runs >= target) {
      applyMatchComplete(computeInnings2Result(next.runs, next.wickets, target));
      return;
    }
    if (allOut || oversDone) {
      applyMatchComplete(computeInnings2Result(next.runs, next.wickets, target));
    }
  }

  function assignPlayer(slot: "striker" | "nonStriker" | "bowler", player: { name: string; imageUrl?: string }) {
    if (slot !== "bowler" && dismissedPlayers.has(player.name)) {
      pushToast(`⚠️ ${player.name} is already out this innings`, "warning");
      return;
    }

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

    const totalTeamRuns = runs + legality.extraPenaltyRun;
    const concededThisBall = legality.bowlerConcedesRuns ? totalTeamRuns : 0;
    const bowlerOverCompletesThisBall = legality.countsAsLegalBall && liveState.bowler.balls + 1 >= 6;
    const overRunsAfterThisBall = overRunsConcededRef.current + concededThisBall;
    const maidenFired = bowlerOverCompletesThisBall && overRunsAfterThisBall === 0;
    overRunsConcededRef.current = bowlerOverCompletesThisBall ? 0 : overRunsAfterThisBall;

    const bowlerNameForMoment = liveState.bowler.name;

    // NEW — compute what the TEAM score will be after this ball, so we
    // can check auto-completion conditions right after committing state.
    let nextOvers = liveState.score.overs;
    let nextBalls = liveState.score.balls;
    if (legality.countsAsLegalBall) {
      nextBalls += 1;
      if (nextBalls >= 6) {
        nextOvers += 1;
        nextBalls = 0;
      }
    }
    const nextRuns = liveState.score.runs + totalTeamRuns;

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

    // NEW — check auto-completion last, after the ball's own moments have
    // already been queued/toasted.
    checkAutoEndConditions({ runs: nextRuns, wickets: liveState.score.wickets, overs: nextOvers, balls: nextBalls });
  }

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

    const concededThisBall = legality.bowlerConcedesRuns ? totalTeamRuns : 0;
    const overRunsAfterThisBall = overRunsConcededRef.current + concededThisBall;
    const maidenFired = overComplete && overRunsAfterThisBall === 0;
    overRunsConcededRef.current = overComplete ? 0 : overRunsAfterThisBall;

    // NEW — compute the resulting team score/wickets/overs for auto-check.
    let nextOvers = liveState.score.overs;
    let nextBalls = liveState.score.balls;
    if (legality.countsAsLegalBall) {
      nextBalls += 1;
      if (nextBalls >= 6) {
        nextOvers += 1;
        nextBalls = 0;
      }
    }
    const nextWickets = Math.min(10, liveState.score.wickets + 1);
    const nextRuns = liveState.score.runs + totalTeamRuns;

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

    {
      const dismissedName = batsmanOut === "striker" ? strikerBefore.name : nonStrikerBefore.name;
      if (dismissedName) {
        setDismissedPlayers((prev) => {
          const next = new Set(prev);
          next.add(dismissedName);
          return next;
        });
      }
    }

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

    // NEW — check whether this wicket ends the innings / the match.
    checkAutoEndConditions({ runs: nextRuns, wickets: nextWickets, overs: nextOvers, balls: nextBalls });

    setActiveSlot(batsmanOut);
    setPendingWicket(null);
  }

  function endInnings() {
    snapshotForUndo();
    overRunsConcededRef.current = 0;
    setDismissedPlayers(new Set());

    const currentInningsNumber = (liveState.inningsNumber ?? 1) as 1 | 2;

    if (currentInningsNumber >= 2) {
      // CHANGED — manual "End Match" now computes a real result the same
      // way the auto-detector does, instead of just flagging complete
      // with no winner info.
      const target = liveState.target;
      const result = target !== undefined ? computeInnings2Result(liveState.score.runs, liveState.score.wickets, target) : null;
      if (result) {
        applyMatchComplete(result);
      } else {
        setLiveState((prev) => ({ ...prev, matchComplete: true }));
        setLiveDirty(true);
        pushToast("🏁 Match marked complete", "info");
      }
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
    dismissedPlayers,
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