import { useEffect, useRef, useState } from "react";
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

// ─────────────────────────────────────────────────────────────────────────
// PERSISTENCE — everything below this line is new. The engine used to
// carry `dismissedPlayers`, undo history, the mid-over refs, extraType,
// isFreeHit, activeSlot, and any open wicket dialog purely in React
// state/refs. None of that survived a page refresh, even though
// `liveState` itself did (persisted one level up in page.tsx). This
// section mirrors that same localStorage pattern for the engine's own
// state so a refresh mid-over restores EXACTLY where you left off.
//
// NOTE: `persistKey` is optional (string | undefined) because the
// caller's `auctionId` prop is itself optional — a match can be scored
// before it has ever been saved/named. When no key is available,
// persistence is simply skipped (load returns null, saves are no-ops)
// rather than forcing every caller to invent a placeholder key that
// could collide across unrelated sessions.
// ─────────────────────────────────────────────────────────────────────────

interface UndoSnapshot {
  liveState: LiveState;
  dismissedPlayers: string[];
  overJustCompleted: boolean;
}

interface PersistedEngineState {
  dismissedPlayers: string[];
  extraType: ExtraType;
  isFreeHit: boolean;
  activeSlot: "striker" | "nonStriker" | "bowler";
  overRunsConceded: number;
  overJustCompleted: boolean;
  pendingWicket: PendingWicket | null;
  undoSnapshot: UndoSnapshot | null;
}

function engineStorageKey(persistKey: string) {
  return `overlay:${persistKey}:engineState`;
}

function loadPersistedEngineState(persistKey: string | undefined): PersistedEngineState | null {
  if (typeof window === "undefined" || !persistKey) return null;
  try {
    const raw = window.localStorage.getItem(engineStorageKey(persistKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const validSlot =
      parsed?.activeSlot === "nonStriker" || parsed?.activeSlot === "bowler" ? parsed.activeSlot : "striker";
    const validExtra: ExtraType = ["none", "wide", "noBall", "bye", "legBye"].includes(parsed?.extraType)
      ? parsed.extraType
      : "none";
    return {
      dismissedPlayers: Array.isArray(parsed?.dismissedPlayers)
        ? parsed.dismissedPlayers.filter((x: unknown) => typeof x === "string")
        : [],
      extraType: validExtra,
      isFreeHit: !!parsed?.isFreeHit,
      activeSlot: validSlot,
      overRunsConceded: Number(parsed?.overRunsConceded) || 0,
      overJustCompleted: !!parsed?.overJustCompleted,
      pendingWicket: parsed?.pendingWicket ?? null,
      undoSnapshot:
        parsed?.undoSnapshot && parsed.undoSnapshot.liveState
          ? {
              liveState: parsed.undoSnapshot.liveState,
              dismissedPlayers: Array.isArray(parsed.undoSnapshot.dismissedPlayers)
                ? parsed.undoSnapshot.dismissedPlayers
                : [],
              overJustCompleted: !!parsed.undoSnapshot.overJustCompleted,
            }
          : null,
    };
  } catch {
    return null;
  }
}

export function useLiveScoringEngine({
  persistKey,
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
}: {
  // A stable key (pass your auctionId) used to namespace this engine's
  // persisted ephemeral state in localStorage, same pattern as
  // matchSetup/liveState use one level up. Optional — when undefined,
  // persistence is skipped entirely (see notes above).
  persistKey: string | undefined;
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
}) {
  // Loaded once, synchronously, on first render — avoids a hydration
  // flash where the panel briefly shows empty/default state before an
  // effect kicks in. Safe under SSR since loadPersistedEngineState
  // guards on `typeof window`, and safe with no persistKey since it
  // guards on that too.
  const initialRef = useRef<PersistedEngineState | null>(null);
  if (initialRef.current === null) {
    initialRef.current = loadPersistedEngineState(persistKey) ?? {
      dismissedPlayers: [],
      extraType: "none",
      isFreeHit: false,
      activeSlot: "striker",
      overRunsConceded: 0,
      overJustCompleted: false,
      pendingWicket: null,
      undoSnapshot: null,
    };
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

  // Writes the full ephemeral bundle to localStorage. Called explicitly
  // at the end of every mutating function (not just from a useEffect)
  // because overRunsConcededRef/overJustCompletedRef are refs and
  // mutating a ref doesn't trigger re-renders or effects. No-ops
  // whenever persistKey is undefined.
  function persistEngineState() {
    if (typeof window === "undefined" || !persistKey) return;
    const payload: PersistedEngineState = {
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
    };
    try {
      window.localStorage.setItem(engineStorageKey(persistKey), JSON.stringify(payload));
    } catch {
      // storage full/unavailable — non-fatal, just means this particular
      // save is lost, next mutation will try again
    }
  }

  // "Live" mirrors of state that persistEngineState needs to read
  // synchronously right after a setState call, before React has
  // re-rendered. Kept in sync via the effects below.
  const dismissedPlayersLive = useRef(dismissedPlayers);
  const extraTypeLive = useRef(extraType);
  const isFreeHitLive = useRef(isFreeHit);
  const activeSlotLive = useRef(activeSlot);
  const pendingWicketLive = useRef(pendingWicket);

  useEffect(() => {
    dismissedPlayersLive.current = dismissedPlayers;
    persistEngineState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissedPlayers]);
  useEffect(() => {
    extraTypeLive.current = extraType;
    persistEngineState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraType]);
  useEffect(() => {
    isFreeHitLive.current = isFreeHit;
    persistEngineState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFreeHit]);
  useEffect(() => {
    activeSlotLive.current = activeSlot;
    persistEngineState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlot]);
  useEffect(() => {
    pendingWicketLive.current = pendingWicket;
    persistEngineState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingWicket]);
  useEffect(() => {
    persistEngineState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUndo]);

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
    persistEngineState();
  }

  function undo() {
    if (!undoRef.current) return;
    setLiveState(undoRef.current);
    setLiveDirty(true);
    setDismissedPlayers(dismissedPlayersUndoRef.current ?? new Set());
    overJustCompletedRef.current = overJustCompletedUndoRef.current;
    undoRef.current = null;
    dismissedPlayersUndoRef.current = null;
    setCanUndo(false);
    setPendingWicket(null);
    overRunsConcededRef.current = 0;
    persistEngineState();
  }

  function patchLive(patch: Partial<LiveState>) {
    setLiveState((prev) => ({ ...prev, ...patch }));
    setLiveDirty(true);
  }

  function applyInningsOneComplete(finalRuns: number) {
    const target = finalRuns + 1;
    overJustCompletedRef.current = false;
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
    persistEngineState();
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
    persistEngineState();
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
    persistEngineState();
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
    persistEngineState();
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
    persistEngineState();
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
    persistEngineState();
  }

  function endInnings() {
    snapshotForUndo();
    overRunsConcededRef.current = 0;
    overJustCompletedRef.current = false;
    setDismissedPlayers(new Set());

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
      persistEngineState();
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
      thisOver: [],
    }));
    setLiveDirty(true);
    onInningsEnd?.({ target, previousInningsRuns, inningsNumber: 2 });
    pushToast(`🔁 Innings 1 closed — target set to ${target}`, "info");
    persistEngineState();
  }

  // Clears ALL persisted engine state for this key. Call this from the
  // page's restartMatch() so a fresh match doesn't inherit stale
  // dismissed players / undo history / pending wickets from the last
  // one. No-op (aside from resetting in-memory state) when there's no
  // persistKey to clear.
  function clearPersistedEngineState() {
    setDismissedPlayers(new Set());
    setPendingWicket(null);
    setCanUndo(false);
    undoRef.current = null;
    dismissedPlayersUndoRef.current = null;
    overRunsConcededRef.current = 0;
    overJustCompletedRef.current = false;
    setExtraType("none");
    setIsFreeHit(false);
    setActiveSlot("striker");
    if (typeof window !== "undefined" && persistKey) {
      try {
        window.localStorage.removeItem(engineStorageKey(persistKey));
      } catch {
        // ignore
      }
    }
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
    clearPersistedEngineState, // wire to restartMatch
  };
}