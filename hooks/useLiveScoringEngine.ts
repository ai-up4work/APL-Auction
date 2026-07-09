import { useEffect, useRef, useState } from "react";
import type { LiveState, BatterState, BowlerState } from "@/lib/overlayBus";
import { appendBall, deleteLastBall } from "@/lib/matchPersistence"; // NEW

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

export interface AutoMatchResult {
  winningTeamName: string;
  margin: string;
  method: "batting" | "bowling" | "tie" | "runs" | "wickets";
}

function ballDisplayValue(runs: number, extraType: ExtraType): string {
  if (extraType === "wide") return "wd";
  if (extraType === "noBall") return "nb";
  if (runs === 0) return ".";
  return String(runs);
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
  isFreeHit: boolean;
  activeSlot: "striker" | "nonStriker" | "bowler";
  overRunsConceded: number;
  overJustCompleted: boolean;
  pendingWicket: PendingWicket | null;
  undoSnapshot: UndoSnapshot | null;
  // NEW — the ledger's per-innings delivery counter. Synced like every
  // other ephemeral field so a reload (or another device picking up the
  // scorer) continues the sequence correctly instead of restarting at 0
  // and colliding with the unique (match_id, innings_number, sequence)
  // constraint on the `balls` table.
  ballSequence: number;
  // NEW — "bench" of stats for players who've been taken out of a slot
  // (via Clear, or by picking someone else into their slot) but haven't
  // been given out. Keyed by player name. When that same player is
  // assigned back into a slot, their prior runs/balls/overs/wickets are
  // restored from here instead of being reset to zero — this is what
  // makes a bowler's second spell continue his earlier figures, and
  // what stops "oops, wrong batter" corrections from erasing a real
  // innings. Synced so it survives a page reload too.
  benchedBatters: Record<string, BatterState>;
  benchedBowlers: Record<string, BowlerState>;
  // NEW — signature (`winner|margin|method`) of the last match result
  // the "Match Won" graphic was fired for. This used to be a localStorage
  // flag (`overlay:{auctionId}:matchWonFiredSignature`) living outside
  // Supabase entirely, which is exactly the kind of second source of
  // truth that goes stale. It now rides in this already-synced bundle,
  // so a refresh (which restores liveState.matchComplete from Supabase)
  // doesn't re-fire the graphic, while a genuinely new result — e.g.
  // after Restart Match resets this to null — fires normally.
  matchWonFiredSignature: string | null;
}

function defaultEngineSyncState(): EngineSyncState {
  return {
    dismissedPlayers: [],
    extraType: "none",
    isFreeHit: false,
    activeSlot: "striker",
    overRunsConceded: 0,
    overJustCompleted: false,
    pendingWicket: null,
    undoSnapshot: null,
    ballSequence: 0, // NEW
    benchedBatters: {}, // NEW
    benchedBowlers: {}, // NEW
    matchWonFiredSignature: null, // NEW
  };
}

export function useLiveScoringEngine({
  matchId, // NEW — Supabase row id; null until page.tsx's getOrCreateMatch() resolves
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
  matchId?: string | null; // NEW
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

  // NEW — the ledger's per-innings delivery counter, seeded from
  // whatever was synced in. Incremented once per actual delivery
  // (recordBall or resolveWicket), reset to 0 whenever the innings
  // number changes, since `balls.sequence` is only unique per
  // (match_id, innings_number).
  const ballSequenceRef = useRef(initial.ballSequence);

  // NEW — bench of stats for players pulled out of a slot but not given
  // out, keyed by player name. See EngineSyncState comment above.
  const benchedBattersRef = useRef<Record<string, BatterState>>(initial.benchedBatters ?? {});
  const benchedBowlersRef = useRef<Record<string, BowlerState>>(initial.benchedBowlers ?? {});

  // NEW — see EngineSyncState comment. Replaces the old localStorage
  // "already fired" flag.
  const matchWonFiredSignatureRef = useRef<string | null>(initial.matchWonFiredSignature ?? null);

  // Keeps matchId reachable inside closures without pulling it into
  // every effect's dependency array.
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
  const isFreeHitLive = useRef(isFreeHit);
  const activeSlotLive = useRef(activeSlot);
  const pendingWicketLive = useRef(pendingWicket);

  function notifyEngineStateChange() {
    if (suppressNotifyRef.current) return;
    const state: EngineSyncState = {
      dismissedPlayers: Array.from(dismissedPlayersLive.current),
      extraType: extraTypeLive.current,
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
      ballSequence: ballSequenceRef.current, // NEW
      benchedBatters: benchedBattersRef.current, // NEW
      benchedBowlers: benchedBowlersRef.current, // NEW
      matchWonFiredSignature: matchWonFiredSignatureRef.current, // NEW
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
    setIsFreeHit(remote.isFreeHit);
    setActiveSlot(remote.activeSlot);
    setPendingWicket(remote.pendingWicket);

    overRunsConcededRef.current = remote.overRunsConceded;
    overJustCompletedRef.current = remote.overJustCompleted;
    ballSequenceRef.current = remote.ballSequence ?? 0; // NEW
    benchedBattersRef.current = remote.benchedBatters ?? {}; // NEW
    benchedBowlersRef.current = remote.benchedBowlers ?? {}; // NEW
    matchWonFiredSignatureRef.current = remote.matchWonFiredSignature ?? null; // NEW

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

  // NEW — save a player's current figures to the bench before they
  // leave a slot (whether via Clear or via being swapped out for
  // someone else). No-op for an empty slot (nothing to preserve).
  function benchBatter(state: BatterState) {
    if (!state.name) return;
    benchedBattersRef.current = { ...benchedBattersRef.current, [state.name]: state };
  }
  function benchBowler(state: BowlerState) {
    if (!state.name) return;
    benchedBowlersRef.current = { ...benchedBowlersRef.current, [state.name]: state };
  }

  // NEW — records that the Match Won moment has fired for this result
  // signature, and pushes it through the same persistence pipeline as
  // everything else (Supabase `engine_state`), so a refresh doesn't
  // cause a duplicate fire.
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

    // NEW — the ball we're about to revert past is whatever the counter
    // currently points at, for the innings we're still in. Captured
    // before any state changes below. If a delivery genuinely wasn't
    // logged (e.g. matchId was null at the time it was recorded), the
    // delete below is a harmless no-op — nothing to clean up.
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
    ballSequenceRef.current = 0; // NEW — sequence restarts per innings
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
        // NEW — preserve the outgoing bowler's figures on the bench
        // before overwriting, then check whether the incoming bowler
        // has prior figures of their own to resume (a second spell).
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
        // NEW — same idea for batters: bench the outgoing occupant's
        // figures, then recall the incoming player's own figures if
        // they'd batted (and been swapped out) earlier in this innings.
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
      // NEW — preserve figures on the bench before clearing, so picking
      // this bowler again later (or accidentally clearing then
      // re-picking the same one) resumes rather than restarts them.
      benchBowler(current as BowlerState);
      overRunsConcededRef.current = 0;
    } else {
      benchBatter(current as BatterState);
    }
    setLiveState((prev) => ({
      ...prev,
      [slot]: slot === "bowler" ? emptyBowlerSlot() : emptyBatterSlot(),
    }));
    setLiveDirty(true);
    setActiveSlot(slot);
    const label = slot === "striker" ? "Striker" : slot === "nonStriker" ? "Non-striker" : "Bowler";
    pushToast(`${label} cleared — pick a replacement`, "info");
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
    const legality = ballLegality(extraType);
    const wasFreeHitBall = isFreeHit;
    const ballValue = ballDisplayValue(runs, extraType);
    const currentExtraType = extraType; // NEW — captured before it gets reset below, for the ledger row

    const strikerBefore = liveState.striker;
    const nonStrikerBefore = liveState.nonStriker; // NEW — for the ledger row
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

    // NEW — the delivery's position before this ball is applied, and
    // the innings it belongs to. Captured here (not after setLiveState)
    // since setLiveState's updater runs against a snapshot too.
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
      const bothPresent = !!prev.striker.name && !!prev.nonStriker.name;
      const rotatesOnOdd = extraType !== "wide" && bothPresent;
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

    // NEW — log this delivery to the ledger. One row per actual ball
    // bowled, whether legal or not (a wide is still a delivery). Fire-
    // and-forget: doesn't block or gate anything above.
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
    notifyEngineStateChange();
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

    const creditsBowler = dismissalType !== "runOut";

    const strikerFinalRuns = legality.batterCanScoreOffBat ? strikerBefore.runs + completedRuns : strikerBefore.runs;
    const strikerFinalBalls = legality.countsAsLegalBall ? strikerBefore.balls + 1 : strikerBefore.balls;

    const concededThisBall = legality.bowlerConcedesRuns ? totalTeamRuns : 0;
    const overRunsAfterThisBall = overRunsConcededRef.current + concededThisBall;
    const maidenFired = overComplete && overRunsAfterThisBall === 0;
    overRunsConcededRef.current = overComplete ? 0 : overRunsAfterThisBall;

    // NEW — ledger position, captured before liveState mutates.
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
      let resolved = resolveBatterSlots(batsmanOut, strikerFacing, { ...prev.nonStriker }, overComplete);

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
        // NEW — a player who's given out is gone for the innings, not
        // "benched" for return. Make sure a stale bench entry (e.g. from
        // an earlier clear-slot) can't resurrect their old figures if
        // their name is ever mistakenly reused.
        const { [dismissedName]: _dropped, ...restBenched } = benchedBattersRef.current;
        benchedBattersRef.current = restBenched;
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

    checkAutoEndConditions({ runs: nextRuns, wickets: nextWickets, overs: nextOvers, balls: nextBalls });

    setActiveSlot(batsmanOut);
    setPendingWicket(null);

    // NEW — log the delivery regardless of `fire`: the ball physically
    // happened either way, `fire` only controls whether the on-air
    // graphic fires.
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
    // NEW — bench doesn't carry across innings (batters/bowlers restart
    // fresh figures next innings), so clear it here alongside the other
    // per-innings ephemeral state.
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

    ballSequenceRef.current = 0; // NEW — new innings, sequence restarts

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

  // Resets ALL ephemeral engine state to defaults in memory. The parent
  // (page.tsx's restartMatch) is responsible for also clearing/
  // overwriting the durable row (DB) — including the balls ledger via
  // deleteAllBalls(matchId) — and broadcasting the reset. This function
  // only touches in-memory React state.
  function resetEngineState() {
    setDismissedPlayers(new Set());
    setPendingWicket(null);
    setCanUndo(false);
    undoRef.current = null;
    dismissedPlayersUndoRef.current = null;
    overRunsConcededRef.current = 0;
    overJustCompletedRef.current = false;
    ballSequenceRef.current = 0; // NEW
    benchedBattersRef.current = {}; // NEW
    benchedBowlersRef.current = {}; // NEW
    matchWonFiredSignatureRef.current = null; // NEW
    setExtraType("none");
    setIsFreeHit(false);
    setActiveSlot("striker");
    notifyEngineStateChange();
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
    endInnings,
    applyRemoteEngineState,
    resetEngineState,
    matchWonFiredSignature: matchWonFiredSignatureRef.current, // NEW
    markMatchWonFired, // NEW
  };
}