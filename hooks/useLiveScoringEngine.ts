import { useEffect, useRef, useState } from "react";
import type { LiveState, BatterState, BowlerState } from "@/lib/overlayBus";
import { appendBall, deleteLastBall } from "@/lib/matchPersistence";

export type ExtraType = "none" | "wide" | "noBall" | "bye" | "legBye";

// NEW — only meaningful while extraType === "noBall". A No Ball can be
// combined with runs off the bat, OR with byes, OR with leg byes
// (Law 21 + Law 26 both apply to the same delivery). Wide can never
// combine with Bye/LegBye (wide runs always stay classified as wides),
// and plain Bye/LegBye are mutually exclusive with each other and with
// everything else — so this sub-selector is intentionally scoped to
// the No Ball case only.
export type NoBallRunOrigin = "bat" | "bye" | "legBye";

export const EXTRA_OPTIONS: { key: ExtraType; label: string }[] = [
  { key: "none", label: "Legal" },
  { key: "wide", label: "Wide" },
  { key: "noBall", label: "No Ball" },
  { key: "bye", label: "Bye" },
  { key: "legBye", label: "Leg Bye" },
];

export const NO_BALL_RUN_ORIGIN_OPTIONS: { key: NoBallRunOrigin; label: string }[] = [
  { key: "bat", label: "Off Bat" },
  { key: "legBye", label: "+ Leg Bye" },
  { key: "bye", label: "+ Bye" },
];

export type DismissalType =
  | "bowled"
  | "caught"
  | "lbw"
  | "runOut"
  | "stumped"
  | "hitWicket"
  | "obstructingField"
  | "retiredOut";

export const DISMISSAL_OPTIONS: { value: DismissalType; label: string }[] = [
  { value: "bowled", label: "Bowled" },
  { value: "caught", label: "Caught" },
  { value: "lbw", label: "LBW" },
  { value: "runOut", label: "Run Out" },
  { value: "stumped", label: "Stumped" },
  { value: "hitWicket", label: "Hit Wicket" },
  { value: "obstructingField", label: "Obstructing the Field" },
  { value: "retiredOut", label: "Retired Out" },
];

// FIX — added Obstructing the Field AND Retired Out. A Free Hit only
// nullifies the delivery-dependent dismissals (Bowled, Caught, LBW,
// Stumped, Hit Wicket per Law 21.20 / ICC playing conditions). Run Out,
// Obstructing the Field, and the administrative Retired Out are all
// still valid on a Free Hit and were wrongly excluded before (Retired
// Out isn't delivery-dependent at all; Obstructing the Field, like Run
// Out, doesn't depend on how the ball was bowled).
export const FREE_HIT_DISMISSAL_OPTIONS: { value: DismissalType; label: string }[] = [
  { value: "runOut", label: "Run Out" },
  { value: "obstructingField", label: "Obstructing the Field" },
  { value: "retiredOut", label: "Retired Out" },
];

// FIX — added Obstructing the Field (Law 22.9 permits it off a Wide)
// and Retired Out (administrative, not delivery-dependent — its
// absence here was inconsistent with it being present on the No Ball
// and Bye/Leg Bye lists below).
export const WIDE_DISMISSAL_OPTIONS: { value: DismissalType; label: string }[] = [
  { value: "runOut", label: "Run Out" },
  { value: "stumped", label: "Stumped" },
  { value: "hitWicket", label: "Hit Wicket" },
  { value: "obstructingField", label: "Obstructing the Field" },
  { value: "retiredOut", label: "Retired Out" },
];

// Law 21.9: a No Ball delivery can only end in Run Out, Obstructing the
// Field, Hit the Ball Twice (not modeled here), or the administrative
// Retired Out. This list is unaffected by NoBallRunOrigin (bat vs
// bye vs leg bye) — it's still the same delivery type either way.
export const NO_BALL_DISMISSAL_OPTIONS: { value: DismissalType; label: string }[] = [
  { value: "runOut", label: "Run Out" },
  { value: "obstructingField", label: "Obstructing the Field" },
  { value: "retiredOut", label: "Retired Out" },
];

// Wickets that CAN still occur off a bye/leg-bye: Run Out, Stumped, Hit
// Wicket, Obstructing the Field, Retired Out. Bowled/Caught/LBW are
// logical contradictions with a bye/leg-bye being called on this ball.
export const BYE_DISMISSAL_OPTIONS: { value: DismissalType; label: string }[] = [
  { value: "runOut", label: "Run Out" },
  { value: "stumped", label: "Stumped" },
  { value: "hitWicket", label: "Hit Wicket" },
  { value: "obstructingField", label: "Obstructing the Field" },
  { value: "retiredOut", label: "Retired Out" },
];

export function getValidDismissalOptions(extraType: ExtraType, isFreeHitActive: boolean) {
  if (extraType === "noBall") return NO_BALL_DISMISSAL_OPTIONS;
  if (isFreeHitActive) return FREE_HIT_DISMISSAL_OPTIONS;
  if (extraType === "wide") return WIDE_DISMISSAL_OPTIONS;
  if (extraType === "bye" || extraType === "legBye") return BYE_DISMISSAL_OPTIONS;
  return DISMISSAL_OPTIONS;
}

// NEW — replaces the old isDismissalLockedToRunOutOnly, which claimed
// a Free Hit was "locked to run out only" — that's no longer true now
// that Obstructing the Field / Retired Out are valid too. This just
// tells the UI whether the delivery is under ANY dismissal
// restriction at all, so it knows whether to show an explanatory
// banner; the banner's actual wording is derived from extraType /
// isFreeHitActive directly rather than a single boolean.
export function isDismissalRestricted(extraType: ExtraType, isFreeHitActive: boolean) {
  return getValidDismissalOptions(extraType, isFreeHitActive).length < DISMISSAL_OPTIONS.length;
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
  noBallRunOrigin: NoBallRunOrigin;
  isFreeHitActive: boolean;
  // NEW — snapshot of everything recordWicket mutated before arming
  // the dialog, so cancelWicket can put it all back exactly as it was.
  priorExtraType: ExtraType;
  priorNoBallRunOrigin: NoBallRunOrigin;
  priorIsFreeHit: boolean;
  priorUndoSnapshot: LiveState | null;
  priorDismissedPlayersUndo: Set<string> | null;
  priorOverJustCompletedUndo: boolean;
  priorCanUndo: boolean;
}

export type ToastTone = "boundary" | "milestone" | "wicket" | "maiden" | "warning" | "info";
export type Toast = { id: number; text: string; tone: ToastTone };

export interface AutoMatchResult {
  winningTeamName: string;
  margin: string;
  method: "batting" | "bowling" | "tie" | "runs" | "wickets";
}

// FIX — now reflects the No Ball + Bye / No Ball + Leg Bye combos with
// a distinct display token ("nb+b" / "nb+lb") instead of collapsing
// them into a plain "nb", which used to make it look like every no
// ball's runs came off the bat.
function ballDisplayValue(runs: number, extraType: ExtraType, noBallRunOrigin: NoBallRunOrigin): string {
  if (extraType === "wide") return "wd";
  if (extraType === "noBall") {
    if (noBallRunOrigin === "bye") return "nb+b";
    if (noBallRunOrigin === "legBye") return "nb+lb";
    return "nb";
  }
  if (extraType === "bye") return "b";
  if (extraType === "legBye") return "lb";
  if (runs === 0) return ".";
  return String(runs);
}

// FIX — ballLegality now takes noBallRunOrigin so a No Ball's runs can
// be correctly classified as bat runs OR byes OR leg byes instead of
// always being treated as bat runs. This was a real scoring bug: any
// runs taken on a no ball (even ones the umpire signalled as byes or
// leg byes) were previously credited to the striker's personal tally
// and charged in full against the bowler's figures. Now:
//   - batterCanScoreOffBat is only true when the no ball's runs came
//     off the bat (or on a fully legal delivery).
//   - bowlerConcedesRuns governs only the RUN component (byes/leg byes
//     off a no ball don't count against the bowler beyond the
//     standard 1-run no-ball penalty, which is handled separately via
//     extraPenaltyRun and is always charged to the bowler regardless).
function ballLegality(extraType: ExtraType, noBallRunOrigin: NoBallRunOrigin) {
  const isWide = extraType === "wide";
  const isNoBall = extraType === "noBall";
  const isBye = extraType === "bye" || (isNoBall && noBallRunOrigin === "bye");
  const isLegBye = extraType === "legBye" || (isNoBall && noBallRunOrigin === "legBye");
  const batterCanScoreOffBat = extraType === "none" || (isNoBall && noBallRunOrigin === "bat");
  return {
    isWide,
    isNoBall,
    isBye,
    isLegBye,
    countsAsLegalBall: !isWide && !isNoBall,
    // The 1-run no-ball/wide penalty. Always charged to the bowler
    // separately from the run component below.
    extraPenaltyRun: isWide || isNoBall ? 1 : 0,
    batterCanScoreOffBat,
    // Whether the RUN component (excluding any no-ball/wide penalty
    // run) counts against the bowler's figures. False for byes/leg
    // byes in every form (standalone, or riding along on a no ball).
    bowlerConcedesRuns: !isBye && !isLegBye,
  };
}

// FIX — added a `crossed` parameter. Previously the surviving batter was
// always left in whatever slot (striker/non-striker) they occupied
// BEFORE the ball, regardless of how many runs were completed before
// the run-out. But if 1 (or 3) runs were completed, the batters have
// physically crossed and swapped ends before the run-out happened — the
// survivor is now standing at the opposite end from where they started
// this ball. `crossed` should be passed as (runsCompleted % 2 === 1) by
// the caller. Note: this is a reasonable simplification of full
// end-tracking (real scoring also needs to know which specific end the
// dismissal happened at to fully resolve incoming-batter placement in
// every edge case) but it correctly fixes the common case of "batter
// ends up facing from the wrong end after an odd-run run-out."
function resolveBatterSlots(
  batsmanOut: "striker" | "nonStriker",
  strikerBefore: BatterState,
  nonStrikerBefore: BatterState,
  overComplete: boolean,
  crossed: boolean
): { striker: BatterState; nonStriker: BatterState } {
  let striker: BatterState = batsmanOut === "striker" ? emptyBatterSlot() : strikerBefore;
  let nonStriker: BatterState = batsmanOut === "nonStriker" ? emptyBatterSlot() : nonStrikerBefore;

  if (crossed) {
    const tmp = striker;
    striker = nonStriker;
    nonStriker = tmp;
  }

  if (overComplete) {
    const tmp = striker;
    striker = nonStriker;
    nonStriker = tmp;
  }
  return { striker, nonStriker };
}

function computeInnings2Result(
  finalRuns: number,
  finalWickets: number,
  target: number
): { winningSide: "batting" | "bowling" | "tie" | "runs" | "wickets"; margin: string } {
  if (finalRuns >= target) {
    const wicketsInHand = Math.max(0, 10 - finalWickets);
    return { winningSide: "batting", margin: `won by ${wicketsInHand} wicket${wicketsInHand === 1 ? "" : "s"}` };
  }
  const marginRuns = target - 1 - finalRuns;
  if (marginRuns <= 0) return { winningSide: "tie", margin: "Match Tied" };
  return { winningSide: "bowling", margin: `won by ${marginRuns} run${marginRuns === 1 ? "" : "s"}` };
}

function countAvailableBatters(
  squad: { name: string }[] | undefined,
  dismissedPlayers: Set<string>,
  striker: { name: string },
  nonStriker: { name: string }
): number | null {
  if (!squad || squad.length === 0) return null;
  return squad.filter(
    (p) =>
      !dismissedPlayers.has(p.name) &&
      p.name !== striker.name &&
      p.name !== nonStriker.name
  ).length;
}

export interface UndoSnapshot {
  liveState: LiveState;
  dismissedPlayers: string[];
  overJustCompleted: boolean;
}

export interface EngineSyncState {
  dismissedPlayers: string[];
  extraType: ExtraType;
  noBallRunOrigin: NoBallRunOrigin;
  isFreeHit: boolean;
  activeSlot: "striker" | "nonStriker" | "bowler";
  overRunsConceded: number;
  overJustCompleted: boolean;
  pendingWicket: PendingWicket | null;
  undoSnapshot: UndoSnapshot | null;
  ballSequence: number;
  benchedBatters: Record<string, BatterState>;
  benchedBowlers: Record<string, BowlerState>;
  matchWonFiredSignature: string | null;
}

function defaultEngineSyncState(): EngineSyncState {
  return {
    dismissedPlayers: [],
    extraType: "none",
    noBallRunOrigin: "bat",
    isFreeHit: false,
    activeSlot: "striker",
    overRunsConceded: 0,
    overJustCompleted: false,
    pendingWicket: null,
    undoSnapshot: null,
    ballSequence: 0,
    benchedBatters: {},
    benchedBowlers: {},
    matchWonFiredSignature: null,
  };
}

export function useLiveScoringEngine({
  matchId,
  liveState,
  setLiveState,
  setLiveDirty,
  maxOvers,
  battingTeamName,
  bowlingTeamName,
  battingSquad,
  onBoundary,
  onMilestone,
  onWicketConfirm,
  onMaiden,
  onInningsEnd,
  onMatchComplete,
  onEngineStateChange,
  initialEngineState,
}: {
  matchId?: string | null;
  liveState: LiveState;
  setLiveState: React.Dispatch<React.SetStateAction<LiveState>>;
  setLiveDirty: (v: boolean) => void;
  maxOvers?: number;
  battingTeamName: string;
  bowlingTeamName: string;
  battingSquad?: { name: string }[];
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
  onMatchComplete?: (result: AutoMatchResult) => void;
  onEngineStateChange?: (state: EngineSyncState) => void;
  initialEngineState?: EngineSyncState | null;
}) {
  const initialRef = useRef<EngineSyncState | null>(null);
  if (initialRef.current === null) {
    initialRef.current = initialEngineState ?? defaultEngineSyncState();
  }
  const initial = initialRef.current;

  const [extraType, setExtraType] = useState<ExtraType>(initial.extraType);
  const [noBallRunOrigin, setNoBallRunOrigin] = useState<NoBallRunOrigin>(initial.noBallRunOrigin ?? "bat");
  const [isFreeHit, setIsFreeHit] = useState(initial.isFreeHit);
  const [activeSlot, setActiveSlot] = useState<"striker" | "nonStriker" | "bowler">(initial.activeSlot);

  const undoRef = useRef<LiveState | null>(initial.undoSnapshot?.liveState ?? null);
  const [canUndo, setCanUndo] = useState(!!initial.undoSnapshot);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const [pendingWicket, setPendingWicket] = useState<PendingWicket | null>(initial.pendingWicket);

  const [dismissedPlayers, setDismissedPlayers] = useState<Set<string>>(new Set(initial.dismissedPlayers));
  const dismissedPlayersUndoRef = useRef<Set<string> | null>(
    initial.undoSnapshot ? new Set(initial.undoSnapshot.dismissedPlayers) : null
  );

  const overRunsConcededRef = useRef(initial.overRunsConceded);
  const overJustCompletedRef = useRef(initial.overJustCompleted);
  const overJustCompletedUndoRef = useRef(initial.undoSnapshot?.overJustCompleted ?? false);

  const ballSequenceRef = useRef(initial.ballSequence);

  const benchedBattersRef = useRef<Record<string, BatterState>>(initial.benchedBatters ?? {});
  const benchedBowlersRef = useRef<Record<string, BowlerState>>(initial.benchedBowlers ?? {});

  const matchWonFiredSignatureRef = useRef<string | null>(initial.matchWonFiredSignature ?? null);

  const matchIdRef = useRef(matchId ?? null);
  useEffect(() => {
    matchIdRef.current = matchId ?? null;
  }, [matchId]);

  const suppressNotifyRef = useRef(false);

  const onEngineStateChangeRef = useRef(onEngineStateChange);
  useEffect(() => {
    onEngineStateChangeRef.current = onEngineStateChange;
  }, [onEngineStateChange]);

  const dismissedPlayersLive = useRef(dismissedPlayers);
  const extraTypeLive = useRef(extraType);
  const noBallRunOriginLive = useRef(noBallRunOrigin);
  const isFreeHitLive = useRef(isFreeHit);
  const activeSlotLive = useRef(activeSlot);
  const pendingWicketLive = useRef(pendingWicket);

  function notifyEngineStateChange() {
    if (suppressNotifyRef.current) return;
    const state: EngineSyncState = {
      dismissedPlayers: Array.from(dismissedPlayersLive.current),
      extraType: extraTypeLive.current,
      noBallRunOrigin: noBallRunOriginLive.current,
      isFreeHit: isFreeHitLive.current,
      activeSlot: activeSlotLive.current,
      overRunsConceded: overRunsConcededRef.current,
      overJustCompleted: overJustCompletedRef.current,
      pendingWicket: pendingWicketLive.current,
      undoSnapshot: undoRef.current
        ? {
            liveState: undoRef.current,
            dismissedPlayers: Array.from(dismissedPlayersUndoRef.current ?? new Set()),
            overJustCompleted: overJustCompletedUndoRef.current,
          }
        : null,
      ballSequence: ballSequenceRef.current,
      benchedBatters: benchedBattersRef.current,
      benchedBowlers: benchedBowlersRef.current,
      matchWonFiredSignature: matchWonFiredSignatureRef.current,
    };
    onEngineStateChangeRef.current?.(state);
  }

  useEffect(() => {
    dismissedPlayersLive.current = dismissedPlayers;
    notifyEngineStateChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissedPlayers]);
  useEffect(() => {
    extraTypeLive.current = extraType;
    notifyEngineStateChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraType]);
  useEffect(() => {
    noBallRunOriginLive.current = noBallRunOrigin;
    notifyEngineStateChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noBallRunOrigin]);
  useEffect(() => {
    isFreeHitLive.current = isFreeHit;
    notifyEngineStateChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFreeHit]);
  useEffect(() => {
    activeSlotLive.current = activeSlot;
    notifyEngineStateChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlot]);
  useEffect(() => {
    pendingWicketLive.current = pendingWicket;
    notifyEngineStateChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingWicket]);
  useEffect(() => {
    notifyEngineStateChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUndo]);

  function applyRemoteEngineState(remote: EngineSyncState) {
    suppressNotifyRef.current = true;

    setDismissedPlayers(new Set(remote.dismissedPlayers));
    setExtraType(remote.extraType);
    setNoBallRunOrigin(remote.noBallRunOrigin ?? "bat");
    setIsFreeHit(remote.isFreeHit);
    setActiveSlot(remote.activeSlot);
    setPendingWicket(remote.pendingWicket);

    overRunsConcededRef.current = remote.overRunsConceded;
    overJustCompletedRef.current = remote.overJustCompleted;
    ballSequenceRef.current = remote.ballSequence ?? 0;
    benchedBattersRef.current = remote.benchedBatters ?? {};
    benchedBowlersRef.current = remote.benchedBowlers ?? {};
    matchWonFiredSignatureRef.current = remote.matchWonFiredSignature ?? null;

    if (remote.undoSnapshot) {
      undoRef.current = remote.undoSnapshot.liveState;
      dismissedPlayersUndoRef.current = new Set(remote.undoSnapshot.dismissedPlayers);
      overJustCompletedUndoRef.current = remote.undoSnapshot.overJustCompleted;
      setCanUndo(true);
    } else {
      undoRef.current = null;
      dismissedPlayersUndoRef.current = null;
      overJustCompletedUndoRef.current = false;
      setCanUndo(false);
    }

    setTimeout(() => {
      suppressNotifyRef.current = false;
    }, 0);
  }

  function benchBatter(state: BatterState) {
    if (!state.name) return;
    benchedBattersRef.current = { ...benchedBattersRef.current, [state.name]: state };
  }
  function benchBowler(state: BowlerState) {
    if (!state.name) return;
    benchedBowlersRef.current = { ...benchedBowlersRef.current, [state.name]: state };
  }

  function markMatchWonFired(signature: string) {
    matchWonFiredSignatureRef.current = signature;
    notifyEngineStateChange();
  }

  const availableBattersCount = countAvailableBatters(
    battingSquad,
    dismissedPlayers,
    liveState.striker,
    liveState.nonStriker
  );

  const noPartnerAvailable =
    availableBattersCount !== null &&
    availableBattersCount === 0 &&
    (!liveState.striker.name || !liveState.nonStriker.name);

  function pushToast(text: string, tone: ToastTone) {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1600);
  }

  function assignmentsMissing() {
    if (noPartnerAvailable) {
      return !liveState.striker.name || !liveState.bowler.name;
    }
    return !liveState.striker.name || !liveState.nonStriker.name || !liveState.bowler.name;
  }

  function snapshotForUndo() {
    undoRef.current = liveState;
    dismissedPlayersUndoRef.current = new Set(dismissedPlayers);
    overJustCompletedUndoRef.current = overJustCompletedRef.current;
    setCanUndo(true);
    notifyEngineStateChange();
  }

  function undo() {
    if (!undoRef.current) return;

    const inningsForDelete = (liveState.inningsNumber ?? 1) as 1 | 2;
    const sequenceToDelete = ballSequenceRef.current;

    setLiveState(undoRef.current);
    setLiveDirty(true);
    setDismissedPlayers(dismissedPlayersUndoRef.current ?? new Set());
    overJustCompletedRef.current = overJustCompletedUndoRef.current;
    undoRef.current = null;
    dismissedPlayersUndoRef.current = null;
    setCanUndo(false);
    setPendingWicket(null);
    overRunsConcededRef.current = 0;

    if (sequenceToDelete > 0) {
      ballSequenceRef.current = sequenceToDelete - 1;
      const id = matchIdRef.current;
      if (id) {
        deleteLastBall(id, inningsForDelete, sequenceToDelete);
      }
    }

    notifyEngineStateChange();
  }

  function patchLive(patch: Partial<LiveState>) {
    setLiveState((prev) => ({ ...prev, ...patch }));
    setLiveDirty(true);
  }

  function applyInningsOneComplete(finalRuns: number) {
    const target = finalRuns + 1;
    overJustCompletedRef.current = false;
    ballSequenceRef.current = 0;
    setLiveState((prev) => ({
      ...prev,
      target,
      inningsNumber: 2,
      score: { runs: 0, wickets: 0, overs: 0, balls: 0 },
      striker: emptyBatterSlot(),
      nonStriker: emptyBatterSlot(),
      bowler: emptyBowlerSlot(),
      partnership: { runs: 0, balls: 0 },
      thisOver: [],
    }));
    setLiveDirty(true);
    setDismissedPlayers(new Set());
    overRunsConcededRef.current = 0;
    // FIX (missing) — mirror endInnings()'s bench reset. This auto-
    // completion path (all out / overs done) previously left
    // benchedBattersRef/benchedBowlersRef holding Innings 1 data, while
    // the manual "End Innings" button already cleared them — an
    // inconsistency that could let a stale Innings 1 batter/bowler
    // record get "recalled" (with wrong stats) if the same name is
    // ever reused during Innings 2.
    benchedBattersRef.current = {};
    benchedBowlersRef.current = {};
    onInningsEnd?.({ target, previousInningsRuns: finalRuns, inningsNumber: 2 });
    pushToast(`🔁 Innings complete — target set to ${target}`, "info");
    notifyEngineStateChange();
  }

  function applyMatchComplete(opts: { winningSide: "batting" | "bowling" | "tie" | "runs" | "wickets"; margin: string }) {
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
    if (target === undefined) return;

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
    if (slot === "striker" && liveState.nonStriker.name === player.name) {
      pushToast(`⚠️ ${player.name} is already at the non-striker's end`, "warning");
      return;
    }
    if (slot === "nonStriker" && liveState.striker.name === player.name) {
      pushToast(`⚠️ ${player.name} is already on strike`, "warning");
      return;
    }

    if (slot === "bowler") {
      const isNewBowler = liveState.bowler.name !== player.name;
      if (isNewBowler) {
        if (liveState.bowler.name) benchBowler(liveState.bowler);
        const recalled = benchedBowlersRef.current[player.name];
        overRunsConcededRef.current = 0;
        setLiveState((prev) => ({
          ...prev,
          bowler: recalled
            ? { ...recalled, imageUrl: player.imageUrl }
            : { ...emptyBowlerSlot(), name: player.name, imageUrl: player.imageUrl },
        }));
      } else {
        setLiveState((prev) => ({
          ...prev,
          bowler: { ...prev.bowler, name: player.name, imageUrl: player.imageUrl },
        }));
      }
    } else {
      const isNewBatter = liveState[slot].name !== player.name;
      if (isNewBatter) {
        if (liveState[slot].name) benchBatter(liveState[slot]);
        const recalled = benchedBattersRef.current[player.name];
        setLiveState((prev) => ({
          ...prev,
          [slot]: recalled
            ? { ...recalled, imageUrl: player.imageUrl }
            : { ...emptyBatterSlot(), name: player.name, imageUrl: player.imageUrl },
        }));
      } else {
        setLiveState((prev) => ({
          ...prev,
          [slot]: { ...prev[slot], name: player.name, imageUrl: player.imageUrl },
        }));
      }
    }
    setLiveDirty(true);
    if (slot === "striker") setActiveSlot("nonStriker");
    else if (slot === "nonStriker") setActiveSlot("bowler");
    notifyEngineStateChange();
  }

  function clearSlot(slot: "striker" | "nonStriker" | "bowler") {
    snapshotForUndo();
    const current = liveState[slot];
    if (slot === "bowler") {
      benchBowler(current as BowlerState);
      overRunsConcededRef.current = 0;
    } else {
      benchBatter(current as BatterState);
    }
    setLiveState((prev) => ({
      ...prev,
      [slot]: slot === "bowler" ? emptyBowlerSlot() : emptyBatterSlot(),
      ...(slot !== "bowler" ? { partnership: { runs: 0, balls: 0 } } : {}),
    }));
    setLiveDirty(true);
    setActiveSlot(slot);
    const label = slot === "striker" ? "Striker" : slot === "nonStriker" ? "Non-striker" : "Bowler";
    pushToast(
      slot === "bowler" ? `${label} cleared — pick a replacement` : `${label} cleared — new partnership started`,
      "info"
    );
    notifyEngineStateChange();
  }

  function swapStrike() {
    if (!liveState.striker.name || !liveState.nonStriker.name) {
      pushToast("⚠️ Need a player on both ends to swap", "warning");
      return;
    }
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
    const legality = ballLegality(extraType, noBallRunOrigin);
    const wasFreeHitBall = isFreeHit;
    const ballValue = ballDisplayValue(runs, extraType, noBallRunOrigin);
    const currentExtraType = extraType;
    const currentNoBallRunOrigin = noBallRunOrigin;

    const strikerBefore = liveState.striker;
    const nonStrikerBefore = liveState.nonStriker;
    const runsBefore = strikerBefore.runs;
    const newRuns = legality.batterCanScoreOffBat ? runsBefore + runs : runsBefore;
    const newBalls = legality.countsAsLegalBall ? strikerBefore.balls + 1 : strikerBefore.balls;

    const totalTeamRuns = runs + legality.extraPenaltyRun;
    // FIX — the no-ball/wide penalty run and the run component are now
    // conceded to the bowler independently. Previously `concededThisBall`
    // was all-or-nothing (`legality.bowlerConcedesRuns ? totalTeamRuns : 0`),
    // so a No Ball + Bye/Leg Bye either wrongly charged the bowler for
    // the bye runs too, or (with the old boolean) would have wrongly
    // dropped the 1-run no-ball penalty as well. Now the penalty run is
    // always charged, and the run component is charged only when it's
    // off the bat or a wide (never for byes/leg byes, incl. NB+BY/NB+LB).
    const concededThisBall = legality.extraPenaltyRun + (legality.bowlerConcedesRuns ? runs : 0);
    const bowlerOverCompletesThisBall = legality.countsAsLegalBall && liveState.bowler.balls + 1 >= 6;
    // FIX — maiden tracking must use TOTAL runs added to the team score
    // this ball (totalTeamRuns), not just the runs charged against the
    // bowler's own figures (concededThisBall). Law 17.4: an over is only
    // a maiden if NO runs were scored at all — byes and leg byes still
    // break a maiden even though they're correctly excluded from the
    // bowler's conceded-runs tally elsewhere. Using concededThisBall here
    // was wrongly letting byes/leg-byes slip through as "maiden over"
    // deliveries.
    const overRunsAfterThisBall = overRunsConcededRef.current + totalTeamRuns;
    const maidenFired = bowlerOverCompletesThisBall && overRunsAfterThisBall === 0;
    overRunsConcededRef.current = bowlerOverCompletesThisBall ? 0 : overRunsAfterThisBall;

    const bowlerNameForMoment = liveState.bowler.name;

    const overNumberForLedger = liveState.score.overs;
    const ballNumberForLedger = liveState.score.balls;
    const inningsForLedger = (liveState.inningsNumber ?? 1) as 1 | 2;

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

    const startFreshRow = overJustCompletedRef.current;
    overJustCompletedRef.current = false;

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
      if (concededThisBall > 0) bowler.runs += concededThisBall;
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
      const bothPresent = !!prev.striker.name && !!prev.nonStriker.name;
      const rotatesOnOdd = bothPresent;
      if (rotatesOnOdd && runs % 2 === 1) {
        finalStriker = prev.nonStriker;
        finalNonStriker = striker;
      }
      if (overComplete && bothPresent) {
        const tmp = finalStriker;
        finalStriker = finalNonStriker;
        finalNonStriker = tmp;
      }

      const baseRow = startFreshRow ? [] : prev.thisOver ?? [];
      const thisOver = [...baseRow, ballValue];

      return {
        ...prev,
        score: { ...prev.score, runs: prev.score.runs + totalTeamRuns, overs, balls },
        striker: finalStriker,
        nonStriker: finalNonStriker,
        bowler,
        partnership,
        matchBoundaries,
        tournamentBoundaries,
        thisOver,
      };
    });

    if (legality.countsAsLegalBall && liveState.score.balls + 1 >= 6) {
      overJustCompletedRef.current = true;
    }

    setLiveDirty(true);

    if (extraType === "noBall") setIsFreeHit(true);
    else if (extraType === "wide") {
      /* carries over */
    } else setIsFreeHit(false);
    setExtraType("none");
    setNoBallRunOrigin("bat"); // NEW — reset the sub-selector alongside extraType

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

    checkAutoEndConditions({ runs: nextRuns, wickets: liveState.score.wickets, overs: nextOvers, balls: nextBalls });

    const ballSeq = ++ballSequenceRef.current;
    const idForBall = matchIdRef.current;
    if (idForBall) {
      appendBall(idForBall, {
        inningsNumber: inningsForLedger,
        sequence: ballSeq,
        overNumber: overNumberForLedger,
        ballNumber: ballNumberForLedger,
        strikerName: strikerBefore.name,
        nonStrikerName: nonStrikerBefore.name,
        bowlerName: bowlerNameForMoment,
        runs,
        extraType: currentExtraType,
        noBallRunOrigin: currentExtraType === "noBall" ? currentNoBallRunOrigin : undefined,
        isWicket: false,
        isFreeHit: wasFreeHitBall,
      });
    }

    notifyEngineStateChange();
  }

  function recordWicket() {
    if (assignmentsMissing()) {
      pushToast("⚠️ Set striker, non-striker & bowler before recording a wicket", "warning");
      return;
    }

    // NEW — capture everything about to be mutated so cancelWicket()
    // can put it all back exactly as it was if the dialog is dismissed
    // without a selection.
    const priorExtraType = extraType;
    const priorNoBallRunOrigin = noBallRunOrigin;
    const priorIsFreeHit = isFreeHit;
    const priorUndoSnapshot = undoRef.current;
    const priorDismissedPlayersUndo = dismissedPlayersUndoRef.current;
    const priorOverJustCompletedUndo = overJustCompletedUndoRef.current;
    const priorCanUndo = canUndo;

    snapshotForUndo();

    const strikerBefore = { ...liveState.striker };
    const nonStrikerBefore = { ...liveState.nonStriker };
    const bowlerName = liveState.bowler.name;
    const currentExtraType = extraType;
    const legality = ballLegality(currentExtraType, noBallRunOrigin);
    const overComplete = legality.countsAsLegalBall && liveState.score.balls + 1 >= 6;

    setPendingWicket({
      strikerBefore,
      nonStrikerBefore,
      bowlerName,
      overComplete,
      extraType: currentExtraType,
      noBallRunOrigin,
      isFreeHitActive: isFreeHit,
      priorExtraType,
      priorNoBallRunOrigin,
      priorIsFreeHit,
      priorUndoSnapshot,
      priorDismissedPlayersUndo,
      priorOverJustCompletedUndo,
      priorCanUndo,
    });

    if (currentExtraType === "noBall") setIsFreeHit(true);
    else if (currentExtraType === "wide") {
      /* carries over */
    } else setIsFreeHit(false);
    setExtraType("none");
    setNoBallRunOrigin("bat");
    notifyEngineStateChange();
  }

  // FIX — this is the actual bug fix. Closing the Wicket Detail dialog
  // (backdrop click or the X button) used to call resolveWicket with
  // fire=false, but resolveWicket applied every state mutation
  // (score, dismissed-players set, ball ledger, auto-end checks)
  // UNCONDITIONALLY — the `fire` flag only gated the toast/callback,
  // not the actual dismissal. That meant cancelling silently recorded
  // a wicket against the default batsman/dismissal/0-runs values.
  // cancelWicket() now does the only thing "cancel" should do: put
  // everything recordWicket touched back the way it was, and record
  // nothing. resolveWicket (below) is only ever reached via the
  // explicit "Fire Wicket Graphic" button now.
  function cancelWicket() {
    if (!pendingWicket) return;

    setExtraType(pendingWicket.priorExtraType);
    setNoBallRunOrigin(pendingWicket.priorNoBallRunOrigin);
    setIsFreeHit(pendingWicket.priorIsFreeHit);
    setPendingWicket(null);

    undoRef.current = pendingWicket.priorUndoSnapshot;
    dismissedPlayersUndoRef.current = pendingWicket.priorDismissedPlayersUndo;
    overJustCompletedUndoRef.current = pendingWicket.priorOverJustCompletedUndo;
    setCanUndo(pendingWicket.priorCanUndo);

    notifyEngineStateChange();
  }

  function resolveWicket(
    batsmanOut: "striker" | "nonStriker",
    dismissalType: DismissalType,
    fielder: string,
    runsCompleted: number
  ) {
    if (!pendingWicket) return;
    const {
      strikerBefore,
      nonStrikerBefore,
      bowlerName,
      extraType: ballExtraType,
      noBallRunOrigin: ballNoBallRunOrigin,
      overComplete,
    } = pendingWicket;
    const legality = ballLegality(ballExtraType, ballNoBallRunOrigin);

    const dismissedNameForThisWicket = batsmanOut === "striker" ? strikerBefore.name : nonStrikerBefore.name;
    const survivorName = batsmanOut === "striker" ? nonStrikerBefore.name : strikerBefore.name;
    const projectedDismissed = new Set(dismissedPlayers);
    if (dismissedNameForThisWicket) projectedDismissed.add(dismissedNameForThisWicket);
    const availableAfterThisWicket = countAvailableBatters(
      battingSquad,
      projectedDismissed,
      { name: survivorName },
      { name: "" }
    );
    const noPartnerAfterThisWicket = availableAfterThisWicket !== null && availableAfterThisWicket === 0;

    const completedRuns = dismissalType === "runOut" ? Math.max(0, runsCompleted) : 0;
    const totalTeamRuns = completedRuns + legality.extraPenaltyRun;

    // Batters cross ends once for every completed run before a run-out;
    // net physical position depends only on the parity of runsCompleted.
    const crossed = completedRuns % 2 === 1;

    const creditsBowler = dismissalType !== "runOut";

    const strikerFinalRuns = legality.batterCanScoreOffBat ? strikerBefore.runs + completedRuns : strikerBefore.runs;
    const strikerFinalBalls = legality.countsAsLegalBall ? strikerBefore.balls + 1 : strikerBefore.balls;

    // FIX — same penalty-vs-run-component split as recordBall, so a
    // run out completed on a No Ball + Bye/Leg Bye doesn't wrongly
    // charge the bye runs against the bowler.
    const concededThisBall = legality.extraPenaltyRun + (legality.bowlerConcedesRuns ? completedRuns : 0);
    // FIX — same maiden-tracking correction as recordBall: use
    // totalTeamRuns (every run added to the score this ball, including
    // byes/leg-byes completed on a run out) rather than concededThisBall,
    // since byes/leg-byes still break a maiden over even though they
    // don't count against the bowler's own figures.
    const overRunsAfterThisBall = overRunsConcededRef.current + totalTeamRuns;
    const maidenFired = overComplete && overRunsAfterThisBall === 0;
    overRunsConcededRef.current = overComplete ? 0 : overRunsAfterThisBall;

    const overNumberForLedger = liveState.score.overs;
    const ballNumberForLedger = liveState.score.balls;
    const inningsForLedger = (liveState.inningsNumber ?? 1) as 1 | 2;

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

    const wicketBallValue = "W";

    const startFreshRow = overJustCompletedRef.current;
    overJustCompletedRef.current = false;

    const closedPartnership = {
      runs: liveState.partnership.runs + totalTeamRuns,
      balls: liveState.partnership.balls + (legality.countsAsLegalBall ? 1 : 0),
    };

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
      if (concededThisBall > 0) bowler.runs += concededThisBall;
      if (legality.countsAsLegalBall) {
        bowler.balls += 1;
        if (bowler.balls >= 6) {
          bowler.overs += 1;
          bowler.balls = 0;
        }
      }
      if (maidenFired) bowler.maidens += 1;

      const strikerFacing: BatterState = { ...prev.striker, runs: strikerFinalRuns, balls: strikerFinalBalls };
      let resolved = resolveBatterSlots(batsmanOut, strikerFacing, { ...prev.nonStriker }, overComplete, crossed);

      if (noPartnerAfterThisWicket && !resolved.striker.name && resolved.nonStriker.name) {
        resolved = { striker: resolved.nonStriker, nonStriker: resolved.striker };
      }

      const baseRow = startFreshRow ? [] : prev.thisOver ?? [];
      const thisOver = [...baseRow, wicketBallValue];

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
        thisOver,
      };
    });

    if (overComplete) {
      overJustCompletedRef.current = true;
    }

    setLiveDirty(true);

    {
      const dismissedName = batsmanOut === "striker" ? strikerBefore.name : nonStrikerBefore.name;
      if (dismissedName) {
        setDismissedPlayers((prev) => {
          const next = new Set(prev);
          next.add(dismissedName);
          return next;
        });
        const { [dismissedName]: _dropped, ...restBenched } = benchedBattersRef.current;
        benchedBattersRef.current = restBenched;
      }
    }

    const dismissedBatter =
      batsmanOut === "striker"
        ? { name: strikerBefore.name, runs: strikerFinalRuns, balls: strikerFinalBalls }
        : nonStrikerBefore;
    onWicketConfirm?.({ batsmanOut, batter: dismissedBatter, dismissalType, fielder, bowlerName });
    pushToast(
      `🎯 WICKET fired — ${dismissedBatter.name || (batsmanOut === "striker" ? "Striker" : "Non-striker")} ${dismissalType} · Partnership ends ${closedPartnership.runs} (${closedPartnership.balls})`,
      "wicket"
    );

    if (maidenFired) {
      onMaiden?.({ bowlerName, maidens: liveState.bowler.maidens + 1 });
      pushToast(`🧤 MAIDEN OVER — ${bowlerName || "Bowler"}`, "maiden");
    }

    checkAutoEndConditions({ runs: nextRuns, wickets: nextWickets, overs: nextOvers, balls: nextBalls });

    setActiveSlot(batsmanOut);
    setPendingWicket(null);

    const ballSeq = ++ballSequenceRef.current;
    const idForBall = matchIdRef.current;
    if (idForBall) {
      appendBall(idForBall, {
        inningsNumber: inningsForLedger,
        sequence: ballSeq,
        overNumber: overNumberForLedger,
        ballNumber: ballNumberForLedger,
        strikerName: strikerBefore.name,
        nonStrikerName: nonStrikerBefore.name,
        bowlerName,
        runs: completedRuns,
        extraType: ballExtraType,
        noBallRunOrigin: ballExtraType === "noBall" ? ballNoBallRunOrigin : undefined,
        isWicket: true,
        dismissalType,
        batsmanOut,
        fielder,
        isFreeHit: pendingWicket.isFreeHitActive,
      });
    }

    notifyEngineStateChange();
  }

  function endInnings() {
    snapshotForUndo();
    overRunsConcededRef.current = 0;
    overJustCompletedRef.current = false;
    setDismissedPlayers(new Set());
    benchedBattersRef.current = {};
    benchedBowlersRef.current = {};

    const currentInningsNumber = (liveState.inningsNumber ?? 1) as 1 | 2;

    if (currentInningsNumber >= 2) {
      const target = liveState.target;
      const result = target !== undefined ? computeInnings2Result(liveState.score.runs, liveState.score.wickets, target) : null;
      if (result) {
        applyMatchComplete(result);
      } else {
        setLiveState((prev) => ({ ...prev, matchComplete: true }));
        setLiveDirty(true);
        pushToast("🏁 Match marked complete", "info");
      }
      notifyEngineStateChange();
      return;
    }

    const previousInningsRuns = liveState.score.runs;
    const target = previousInningsRuns + 1;

    ballSequenceRef.current = 0;

    setLiveState((prev) => ({
      ...prev,
      target,
      inningsNumber: 2,
      score: { runs: 0, wickets: 0, overs: 0, balls: 0 },
      striker: emptyBatterSlot(),
      nonStriker: emptyBatterSlot(),
      bowler: emptyBowlerSlot(),
      partnership: { runs: 0, balls: 0 },
      thisOver: [],
    }));
    setLiveDirty(true);
    onInningsEnd?.({ target, previousInningsRuns, inningsNumber: 2 });
    pushToast(`🔁 Innings 1 closed — target set to ${target}`, "info");
    notifyEngineStateChange();
  }

  function resetEngineState() {
    setDismissedPlayers(new Set());
    dismissedPlayersLive.current = new Set();

    setPendingWicket(null);
    pendingWicketLive.current = null;

    setCanUndo(false);
    undoRef.current = null;
    dismissedPlayersUndoRef.current = null;
    overRunsConcededRef.current = 0;
    overJustCompletedRef.current = false;
    ballSequenceRef.current = 0;
    benchedBattersRef.current = {};
    benchedBowlersRef.current = {};
    matchWonFiredSignatureRef.current = null;

    setExtraType("none");
    extraTypeLive.current = "none";

    setNoBallRunOrigin("bat");
    noBallRunOriginLive.current = "bat";

    setIsFreeHit(false);
    isFreeHitLive.current = false;

    setActiveSlot("striker");
    activeSlotLive.current = "striker";

    notifyEngineStateChange();
  }

  return {
    extraType,
    setExtraType,
    noBallRunOrigin,
    setNoBallRunOrigin,
    isFreeHit,
    setIsFreeHit,
    activeSlot,
    setActiveSlot,
    canUndo,
    undo,
    toasts,
    pendingWicket,
    dismissedPlayers,
    noPartnerAvailable,
    assignmentsMissing,
    patchLive,
    assignPlayer,
    clearSlot,
    swapStrike,
    newPartnership,
    recordBall,
    recordWicket,
    resolveWicket,
    cancelWicket,
    endInnings,
    applyRemoteEngineState,
    resetEngineState,
    matchWonFiredSignature: matchWonFiredSignatureRef.current,
    markMatchWonFired,
  };
}