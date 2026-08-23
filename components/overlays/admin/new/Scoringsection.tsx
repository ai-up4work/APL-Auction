// app/components/overlays/admin/new/Scoringsection.tsx
"use client";

import {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Dispatch, SetStateAction, CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  useLiveScoringEngine,
  EXTRA_OPTIONS,
  NO_BALL_RUN_ORIGIN_OPTIONS,
} from "@/hooks/useLiveScoringEngine";
import type {
  EngineSyncState,
  ExtraType,
  DismissalType,
} from "@/hooks/useLiveScoringEngine";
import type { LiveState, SquadPlayer } from "@/lib/overlayBus";
import {
  GOLD_GRADIENT,
  Icon,
  OverBall,
  normalizeOverEntry,
  PlayerPickerSheet,
  CrewSlot,
  MoreActionsMenu,
  CenteredOverlay,
  WicketDetailDialog,
  PenaltyDialog,
  MatchOverScreen,
  resolveWinningTeamKey,
  resolveWinningTeamKeyFromMethod,
  resolveWinningTeamKeyFromScore,
} from "./ScoringSectionParts";
import type { RoleInfo, LegacyMatchSetup } from "./ScoringSectionParts";

/* ───────────────────────── main component ───────────────────────── */

export interface ScoringSectionHandle {
  resetEngine: () => void;
}

export interface ScoringSectionProps {
  mobileTab: "overlay" | "scoring" | "setup";
  matchId?: string | null;
  matchSetup: LegacyMatchSetup;
  battingTeamKey: "teamA" | "teamB";
  bowlingTeamKey: "teamA" | "teamB";
  battingSquad: SquadPlayer[];
  bowlingSquad: SquadPlayer[];
  maxOvers?: number;
  liveState: LiveState;
  setLiveState: Dispatch<SetStateAction<LiveState>>;
  liveDirty: boolean;
  setLiveDirty: (v: boolean) => void;
  onPush: () => void;
  pushLabel: string;
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
  onMatchComplete?: (result: { winningTeamName: string; margin: string; method: string }) => void;
  onRestartMatch?: () => void;
  onEngineStateChange?: (state: EngineSyncState) => void;
  initialEngineState?: EngineSyncState | null;
  onAdminAction?: (label: string, meta?: Record<string, unknown>) => void;
  onDismissedPlayersChange?: (players: Set<string>) => void;
  // Resolved directly from the database (match_team_stats.is_winner),
  // computed by the parent (OverlayAdminConsole) which has access to
  // matchSetup.teamA.teamId/teamB.teamId. When present, this is the
  // authoritative winner and skips every local heuristic below —
  // those (score-derived / method-derived / name-matching) only run
  // as a fallback for a match with no match_team_stats row.
  winnerTeamKeyOverride?: "teamA" | "teamB" | null;
}

const ScoringSection = forwardRef<ScoringSectionHandle, ScoringSectionProps>(function ScoringSection(
  {
    mobileTab,
    matchId,
    matchSetup,
    battingTeamKey,
    bowlingTeamKey,
    battingSquad,
    bowlingSquad,
    maxOvers,
    liveState,
    setLiveState,
    liveDirty,
    setLiveDirty,
    onPush,
    pushLabel,
    onBoundary,
    onMilestone,
    onWicketConfirm,
    onMaiden,
    onInningsEnd,
    onMatchComplete,
    onRestartMatch,
    onEngineStateChange,
    initialEngineState,
    onAdminAction,
    onDismissedPlayersChange,
    winnerTeamKeyOverride,
  },
  ref
) {
  const battingTeamLabel = matchSetup[battingTeamKey];
  const bowlingTeamLabel = matchSetup[bowlingTeamKey];

  const engine = useLiveScoringEngine({
    matchId,
    liveState,
    setLiveState,
    setLiveDirty,
    maxOvers,
    battingTeamName: battingTeamLabel,
    bowlingTeamName: bowlingTeamLabel,
    battingSquad,
    onBoundary,
    onMilestone,
    onWicketConfirm,
    onMaiden,
    onInningsEnd,
    onMatchComplete,
    onEngineStateChange,
    initialEngineState,
  });

  useImperativeHandle(ref, () => ({
    resetEngine: () => engine.resetEngineState(),
  }));

  const [playerPicker, setPlayerPicker] = useState<"striker" | "nonStriker" | "bowler" | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showBowlerChangePrompt, setShowBowlerChangePrompt] = useState(false);
  const [showPenaltyDialog, setShowPenaltyDialog] = useState(false);

  const prevOversRef = useRef(liveState.score.overs);
  const hasCheckedOversRef = useRef(false);
  useEffect(() => {
    const prevOvers = prevOversRef.current;
    if (
      hasCheckedOversRef.current &&
      prevOvers !== undefined &&
      liveState.score.overs > prevOvers &&
      liveState.score.balls === 0 &&
      !liveState.matchComplete
    ) {
      setShowBowlerChangePrompt(true);
    }
    hasCheckedOversRef.current = true;
    prevOversRef.current = liveState.score.overs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveState.score.overs, liveState.score.balls]);

  useEffect(() => {
    onDismissedPlayersChange?.(engine.dismissedPlayers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.dismissedPlayers]);

  const battingRoleMap = useMemo(() => {
    const m = new Map<string, RoleInfo>();
    if (liveState.striker.name) m.set(liveState.striker.name, { role: "striker" });
    if (liveState.nonStriker.name) m.set(liveState.nonStriker.name, { role: "nonStriker" });
    return m;
  }, [liveState.striker.name, liveState.nonStriker.name]);
  const bowlingRoleMap = useMemo(() => {
    const m = new Map<string, RoleInfo>();
    if (liveState.bowler.name) m.set(liveState.bowler.name, { role: "bowler" });
    return m;
  }, [liveState.bowler.name]);

  const isSecondInnings = (liveState.inningsNumber ?? 1) === 2;
  const overs = `${liveState.score.overs}.${liveState.score.balls}`;
  const rr =
    liveState.score.overs + liveState.score.balls / 6 > 0
      ? (liveState.score.runs / (liveState.score.overs + liveState.score.balls / 6)).toFixed(2)
      : "0.00";
  const ballsBowled = liveState.score.overs * 6 + liveState.score.balls;
  const totalBalls = maxOvers !== undefined ? maxOvers * 6 : undefined;
  const ballsLeft = totalBalls !== undefined ? Math.max(0, totalBalls - ballsBowled) : undefined;
  const runsNeeded = liveState.target !== undefined ? Math.max(0, liveState.target - liveState.score.runs) : undefined;
  const requiredRate = runsNeeded !== undefined && ballsLeft ? ((runsNeeded / ballsLeft) * 6).toFixed(2) : undefined;

  const strikerNeedsReplacement = engine.noPartnerAvailable && !liveState.striker.name;
  const nonStrikerNeedsReplacement = engine.noPartnerAvailable && !liveState.nonStriker.name;

  const thisOverDisplay = liveState.thisOver ?? [];

  const controlsLocked = engine.assignmentsMissing();
  const [localToasts, setLocalToasts] = useState<{ id: number; text: string; tone: string }[]>([]);
  const localToastTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const timers = localToastTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);
  function pushLocalToast(text: string, tone = "info") {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setLocalToasts((prev) => [...prev, { id, text, tone }]);
    const timer = setTimeout(() => {
      setLocalToasts((prev) => prev.filter((t) => t.id !== id));
      localToastTimers.current.delete(id);
    }, 3200);
    localToastTimers.current.set(id, timer);
  }
  function showAssignmentToast() {
    pushLocalToast("Pick a Striker, Non-Striker & Bowler first", "wicket");
  }

  function handlePenaltyConfirm(team: "batting" | "bowling", description: string) {
    const teamLabel = team === "batting" ? battingTeamLabel : bowlingTeamLabel;
    engine.patchLive({ score: { ...liveState.score, runs: liveState.score.runs + 5 } });
    onAdminAction?.("Penalty", { runs: 5, team, teamLabel, description });
    pushLocalToast(`⚖️ +5 Penalty — ${teamLabel}${description ? ` (${description})` : ""}`, "warning");
    setShowPenaltyDialog(false);
  }
  function handleTapRun(n: number) {
    if (controlsLocked) return showAssignmentToast();
    engine.recordBall(n);
  }
  function handleTapWicket() {
    if (controlsLocked) return showAssignmentToast();
    engine.recordWicket();
  }

  const EXTRA_TILE_META: Record<string, { abbr: string; icon: string }> = {
    wide: { abbr: "WD", icon: "open_in_full" },
    noBall: { abbr: "NB", icon: "front_hand" },
    legBye: { abbr: "LB", icon: "directions_run" },
    bye: { abbr: "BY", icon: "directions_walk" },
  };
  const EXTRA_TILE_ORDER: ExtraType[] = ["wide", "noBall", "legBye", "bye"];
  const extraGridTiles = EXTRA_TILE_ORDER.map((key) => EXTRA_OPTIONS.find((o) => o.key === key)).filter(
    (o): o is (typeof EXTRA_OPTIONS)[number] => !!o
  );
  const armedExtra = engine.extraType && engine.extraType !== "none" ? EXTRA_OPTIONS.find((o) => o.key === engine.extraType) : null;

  const extraArmed = engine.extraType !== "none";
  const isNoBallArmed = engine.extraType === "noBall";

  function handleTapExtra(key: ExtraType) {
    if (controlsLocked) return showAssignmentToast();
    if (extraArmed && engine.extraType !== key) return;
    engine.setExtraType(engine.extraType === key ? "none" : key);
    if (key === "noBall") engine.setNoBallRunOrigin("bat");
  }

  const statCards: { label: string; value: string }[] = [
    { label: "Partnership", value: `${liveState.partnership.runs} (${liveState.partnership.balls})` },
    { label: "Match 4s / 6s", value: `${liveState.matchBoundaries.fours} / ${liveState.matchBoundaries.sixes}` },
    { label: "Overs", value: overs },
    { label: "Bowler Figures", value: `${liveState.bowler.overs}.${liveState.bowler.balls}-${liveState.bowler.maidens}-${liveState.bowler.runs}-${liveState.bowler.wickets}` },
  ];
  if (isSecondInnings && liveState.target !== undefined) {
    statCards.splice(2, 0, { label: "Target", value: `${liveState.target}` });
  }

  // winningTeamKey — resolved with a layered strategy, most authoritative
  // first:
  //   1. winnerTeamKeyOverride — from the DB's own match_team_stats.is_winner
  //   2. resolveWinningTeamKeyFromScore — derived from the raw score/target
  //   3. resolveWinningTeamKeyFromMethod — derived from matchResult.method
  //      + battingTeamKey/bowlingTeamKey (doesn't need winningTeamName)
  //   4. resolveWinningTeamKey — last-resort name matching against
  //      matchResult.winningTeamName
  const winningTeamKey = useMemo(
    () =>
      winnerTeamKeyOverride ??
      resolveWinningTeamKeyFromScore(liveState, isSecondInnings, maxOvers, battingTeamKey, bowlingTeamKey) ??
      resolveWinningTeamKeyFromMethod(liveState.matchResult?.method, battingTeamKey, bowlingTeamKey) ??
      resolveWinningTeamKey(
        liveState.matchResult?.winningTeamName,
        { shortLabel: matchSetup.teamA, fullName: matchSetup.teamAFullName },
        { shortLabel: matchSetup.teamB, fullName: matchSetup.teamBFullName }
      ),
    [
      winnerTeamKeyOverride,
      liveState,
      isSecondInnings,
      maxOvers,
      liveState.matchResult?.method,
      liveState.matchResult?.winningTeamName,
      battingTeamKey,
      bowlingTeamKey,
      matchSetup.teamA,
      matchSetup.teamAFullName,
      matchSetup.teamB,
      matchSetup.teamBFullName,
    ]
  );

  const matchResultLogo = useMemo(() => {
    if (winningTeamKey === "teamA") return matchSetup.teamAlogo;
    if (winningTeamKey === "teamB") return matchSetup.teamBlogo;
    return undefined;
  }, [winningTeamKey, matchSetup.teamAlogo, matchSetup.teamBlogo]);

  const matchResultColor = useMemo(() => {
    if (winningTeamKey === "teamA") return matchSetup.teamAColor;
    if (winningTeamKey === "teamB") return matchSetup.teamBColor;
    return undefined;
  }, [winningTeamKey, matchSetup.teamAColor, matchSetup.teamBColor]);

  // FIX — the winner banner previously read liveState.matchResult?.winningTeamName
  // directly, which is exactly the field that's frequently empty/inconsistent
  // (see resolveWinningTeamKey comments in ScoringSectionParts). The logo/color
  // above are already derived from the properly-resolved winningTeamKey, so the
  // displayed name now goes through the same resolution instead of a separate,
  // less reliable source — that's what was causing "Match Complete" to show with
  // no team name even when the logo appeared correctly.
  const matchResultWinningTeamName = useMemo(() => {
    if (winningTeamKey === "teamA") return matchSetup.teamAFullName || matchSetup.teamA;
    if (winningTeamKey === "teamB") return matchSetup.teamBFullName || matchSetup.teamB;
    return liveState.matchResult?.winningTeamName;
  }, [
    winningTeamKey,
    matchSetup.teamA,
    matchSetup.teamAFullName,
    matchSetup.teamB,
    matchSetup.teamBFullName,
    liveState.matchResult?.winningTeamName,
  ]);

  const matchResultFinalScoreLabel = `${liveState.score.runs}/${liveState.score.wickets} (${overs} ov) BY ${matchResultWinningTeamName}`;
  const matchResultTargetLabel =
    isSecondInnings && liveState.target !== undefined ? `Target ${liveState.target} ` : undefined;

  return (
    <section
      className={`order-1 lg:order-2 flex-col lg:h-full min-h-0 px-4 pt-4 sm:px-3 sm:pt-3 lg:p-4 gap-2.5 sm:gap-4
        ${mobileTab === "scoring" ? "flex fixed inset-0 overflow-hidden pb-[calc(80px+env(safe-area-inset-bottom))]" : "hidden"}
        lg:flex lg:static lg:h-full lg:overflow-hidden lg:pb-4`}
    >
      {typeof document !== "undefined" &&
        createPortal(
          <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-[9999] flex flex-col-reverse gap-2 items-end pointer-events-none max-w-[calc(100vw-2rem)] sm:max-w-xs">
            {[...engine.toasts, ...localToasts].map((t) => (
              <div
                key={t.id}
                className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg font-mono-geist text-[10.5px] font-bold leading-relaxed max-w-full glass-panel"
                style={{
                  borderColor: t.tone === "wicket" ? "rgba(248,113,113,0.35)" : t.tone === "milestone" ? "rgba(201,151,31,0.4)" : "rgba(255,255,255,0.12)",
                  color: t.tone === "wicket" ? "#f87171" : t.tone === "milestone" ? "#e8c468" : "rgba(255,255,255,0.75)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                }}
              >
                <Icon name={t.tone === "wicket" ? "sports_cricket" : "bolt"} style={{ fontSize: 14, marginTop: 1 }} />
                <span className="min-w-0">{t.text}</span>
              </div>
            ))}
          </div>,
          document.body
        )}

      {engine.pendingWicket && (
        <WicketDetailDialog pending={engine.pendingWicket} onResolve={engine.resolveWicket} onCancel={engine.cancelWicket} fieldingSquad={bowlingSquad} />
      )}

      {playerPicker && (
        <PlayerPickerSheet
          title={playerPicker === "striker" ? "Select Striker" : playerPicker === "nonStriker" ? "Select Non-Striker" : "Select Bowler"}
          teamLabel={playerPicker === "bowler" ? bowlingTeamLabel : battingTeamLabel}
          players={playerPicker === "bowler" ? bowlingSquad : battingSquad}
          onSelect={(p) => engine.assignPlayer(playerPicker, p)}
          onClose={() => setPlayerPicker(null)}
          dismissedNames={playerPicker === "bowler" ? undefined : engine.dismissedPlayers}
          roleByName={playerPicker === "bowler" ? bowlingRoleMap : battingRoleMap}
        />
      )}

      <CenteredOverlay open={showEndConfirm} onClose={() => setShowEndConfirm(false)} title={isSecondInnings ? "End Match?" : "End Innings?"} icon="sports_score" iconColor="#f87171">
        <p className="text-[12px] text-on-surface">
          {isSecondInnings
            ? "This marks the match complete, computes the result, and locks scoring. You can still Undo afterwards."
            : `This sets the target to ${liveState.score.runs + 1} and resets the score/overs/crew for Innings 2. You can Undo afterwards.`}
        </p>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => setShowEndConfirm(false)} className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-mono-geist bg-white/[0.02] border border-white/10 text-on-surface">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              engine.endInnings();
              setShowEndConfirm(false);
            }}
            className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-mono-geist bg-red-500 text-white"
          >
            {isSecondInnings ? "End Match" : "End Innings"}
          </button>
        </div>
      </CenteredOverlay>

      {showPenaltyDialog && (
        <PenaltyDialog battingTeamLabel={battingTeamLabel} bowlingTeamLabel={bowlingTeamLabel} onConfirm={handlePenaltyConfirm} onClose={() => setShowPenaltyDialog(false)} />
      )}

      <CenteredOverlay open={showRestartConfirm} onClose={() => setShowRestartConfirm(false)} title="Restart Match?" icon="restart_alt" iconColor="#e8c468">
        <p className="text-[12px] text-on-surface">Starts a fresh match with the same teams/squads. Score, overs, crew, and result reset. This can&apos;t be undone.</p>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => setShowRestartConfirm(false)} className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-mono-geist bg-white/[0.02] border border-white/10 text-on-surface">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              engine.resetEngineState();
              onRestartMatch?.();
              setShowRestartConfirm(false);
            }}
            className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-mono-geist bg-theme-orange text-black"
          >
            Restart Match
          </button>
        </div>
      </CenteredOverlay>

      <CenteredOverlay open={showBowlerChangePrompt} onClose={() => setShowBowlerChangePrompt(false)} title="Over Complete" icon="autorenew" iconColor="#818cf8">
        <p className="text-[12px] text-on-surface">
          {liveState.bowler.name ? `${liveState.bowler.name} has finished the over.` : "The over is complete."} Continue with the same bowler, or pick a new one for the next over.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => setShowBowlerChangePrompt(false)}
            className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-mono-geist bg-white/[0.02] border border-white/10 text-on-surface"
          >
            Continue{liveState.bowler.name ? ` ${liveState.bowler.name}` : ""}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowBowlerChangePrompt(false);
              engine.clearSlot("bowler");
              engine.setActiveSlot("bowler");
              setPlayerPicker("bowler");
            }}
            className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-mono-geist bg-theme-orange text-black"
          >
            Change Bowler
          </button>
        </div>
      </CenteredOverlay>

      {liveState.matchComplete ? (
        <MatchOverScreen
          winningTeamName={matchResultWinningTeamName}
          winningTeamLogo={matchResultLogo}
          winningTeamColor={matchResultColor}
          margin={liveState.matchResult?.margin}
          method={liveState.matchResult?.method}
          finalScoreLabel={matchResultFinalScoreLabel}
          targetLabel={matchResultTargetLabel}
          canUndo={engine.canUndo}
          onUndo={engine.undo}
          onRestart={onRestartMatch ? () => setShowRestartConfirm(true) : undefined}
        />
      ) : (
        <>
          {engine.noPartnerAvailable && (
            <div className="flex items-center gap-3 p-3 rounded-xl mb-1 shrink-0" style={{ background: "rgba(201,151,31,0.08)", border: "1px solid rgba(201,151,31,0.3)" }}>
              <Icon name="warning" style={{ fontSize: 18, color: "#e8c468" }} />
              <div className="flex-1 min-w-0">
                <p className="font-archivo text-[11px] font-bold uppercase text-on-surface">Last Man Batting</p>
                <p className="font-mono-geist text-[9.5px] text-on-surface-variant">No replacement left — wrap up whenever ready.</p>
              </div>
              <button type="button" onClick={() => setShowEndConfirm(true)} className="font-mono-geist text-[10px] font-black uppercase px-3 py-2 rounded-lg bg-theme-orange text-black shrink-0">
                {isSecondInnings ? "End Match" : "End Innings"}
              </button>
            </div>
          )}

          <div className="relative overflow-hidden shrink-0 rounded-2xl border border-white/10 bg-white/[0.035] px-3 sm:px-4 pt-3 sm:pt-4 pb-2.5 sm:pb-3 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]" style={{ containerType: "inline-size" }}>
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: GOLD_GRADIENT, opacity: 0.6 }} />
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-theme-orange/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2 relative z-10">
              <div className="flex items-baseline gap-2 sm:gap-3 min-w-0 flex-1">
                <span className="font-archivo text-6xl font-bold tabular-nums shrink-0">
                  {liveState.score.runs}/{liveState.score.wickets}
                </span>
                <span className="font-mono-geist text-[8px] sm:text-[11px] text-on-surface-variant uppercase tracking-[0.1em] truncate">
                  {overs} ov · RR {rr} · {battingTeamLabel} batting{isSecondInnings ? " · Inns 2" : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={onPush}
                className="flex items-center gap-1.5 font-mono-geist text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded transition-all hover:brightness-110 active:scale-95 shrink-0"
                style={{ background: liveDirty ? GOLD_GRADIENT : "rgba(255,255,255,0.05)", color: liveDirty ? "#1a1304" : "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <Icon name="cloud_upload" style={{ fontSize: 13 }} />
                <span className="hidden sm:inline">{pushLabel}</span>
              </button>
            </div>

            {isSecondInnings && liveState.target !== undefined && (
              <p className="font-mono-geist text-[9px] sm:text-[11px] text-theme-orange uppercase tracking-[0.1em] mb-1.5 sm:mb-3 relative z-10">
                Target {liveState.target} · Need {runsNeeded} off {ballsLeft ?? "—"} balls{requiredRate ? ` · RRR ${requiredRate}` : ""}
              </p>
            )}

            <div className="mb-1.5 sm:mb-3 relative z-10">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                <CrewSlot
                  compact
                  title="Striker *"
                  accentColor="#e8c468"
                  active={engine.activeSlot === "striker"}
                  onActivate={() => {
                    engine.setActiveSlot("striker");
                    setPlayerPicker("striker");
                  }}
                  displayName={liveState.striker.name}
                  imageUrl={liveState.striker.imageUrl}
                  statLine={liveState.striker.name ? `${liveState.striker.runs} (${liveState.striker.balls}) · 4s ${liveState.striker.fours} · 6s ${liveState.striker.sixes}` : undefined}
                  allPlayers={battingSquad}
                  onAssign={(p) => engine.assignPlayer("striker", p)}
                  onClear={() => engine.clearSlot("striker")}
                  placeholder="Select striker"
                  dismissedNames={engine.dismissedPlayers}
                  blockedName={liveState.nonStriker.name || undefined}
                  noReplacement={strikerNeedsReplacement}
                />
                <CrewSlot
                  compact
                  title="Non-Striker"
                  active={engine.activeSlot === "nonStriker"}
                  onActivate={() => {
                    engine.setActiveSlot("nonStriker");
                    setPlayerPicker("nonStriker");
                  }}
                  displayName={liveState.nonStriker.name}
                  imageUrl={liveState.nonStriker.imageUrl}
                  statLine={liveState.nonStriker.name ? `${liveState.nonStriker.runs} (${liveState.nonStriker.balls}) · 4s ${liveState.nonStriker.fours} · 6s ${liveState.nonStriker.sixes}` : undefined}
                  allPlayers={battingSquad}
                  onAssign={(p) => engine.assignPlayer("nonStriker", p)}
                  onClear={() => engine.clearSlot("nonStriker")}
                  placeholder="Select non-striker"
                  dismissedNames={engine.dismissedPlayers}
                  blockedName={liveState.striker.name || undefined}
                  noReplacement={nonStrikerNeedsReplacement}
                />
                <div className="col-span-2 lg:col-span-1">
                  <CrewSlot
                    compact
                    title="Bowler"
                    accentColor="#818cf8"
                    active={engine.activeSlot === "bowler"}
                    onActivate={() => {
                      engine.setActiveSlot("bowler");
                      setPlayerPicker("bowler");
                    }}
                    displayName={liveState.bowler.name}
                    imageUrl={liveState.bowler.imageUrl}
                    statLine={liveState.bowler.name ? `${liveState.bowler.overs}.${liveState.bowler.balls}-${liveState.bowler.maidens}-${liveState.bowler.runs}-${liveState.bowler.wickets}` : undefined}
                    allPlayers={bowlingSquad}
                    onAssign={(p) => engine.assignPlayer("bowler", p)}
                    placeholder="Pick from roster ◂"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap mb-1.5 sm:mb-5 relative z-10">
              <button type="button" onClick={engine.swapStrike} className="flex items-center gap-1.5 font-mono-geist text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-theme-orange border border-theme-orange/20">
                <Icon name="swap_horiz" style={{ fontSize: 13 }} /> Rotate Strike
              </button>
              <div className="flex flex-col gap-1.5 relative z-10">
                <button
                  type="button"
                  onClick={() => engine.setIsFreeHit((v) => !v)}
                  className="flex items-center gap-1.5 font-mono-geist text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded border transition-all"
                  style={
                    engine.isFreeHit
                      ? {
                          color: "#38bdf8",
                          borderColor: "rgba(56,189,248,0.4)",
                          background: "rgba(56,189,248,0.12)",
                        }
                      : {
                          color: "#c9971f",
                          borderColor: "rgba(201,151,31,0.2)",
                          background: "transparent",
                        }
                  }
                >
                  <Icon name="flash_on" style={{ fontSize: 13 }} />
                  Free Hit {engine.isFreeHit ? "· Active" : ""}
                </button>
              </div>
              {!engine.noPartnerAvailable && (
                <button type="button" onClick={() => setShowEndConfirm(true)} className="flex items-center gap-1.5 font-mono-geist text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-red-400 border border-red-400/25 ml-auto">
                  <Icon name="sports_score" style={{ fontSize: 13 }} /> {isSecondInnings ? "End Match" : "End Innings"}
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col gap-2 sm:gap-3 relative z-10 overflow-hidden">
            {armedExtra && (
              <div className="flex flex-col gap-2 shrink-0">
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(96,165,250,0.4)" }}>
                  <span className="font-mono-geist text-[9.5px] font-bold uppercase tracking-[0.12em] text-sky-300 flex items-center gap-1.5 min-w-0">
                    <Icon name="bolt" style={{ fontSize: 13 }} className="shrink-0" />
                    <span className="truncate">{armedExtra.label} armed — tap a run to record</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      engine.setExtraType("none");
                      engine.setNoBallRunOrigin("bat");
                    }}
                    className="font-mono-geist text-[9px] font-bold uppercase px-2 py-1 rounded text-sky-300 border border-sky-400/30 hover:bg-sky-400/10 shrink-0"
                  >
                    Cancel
                  </button>
                </div>

                {isNoBallArmed && (
                  <div className="flex items-center gap-1.5 px-1">
                    {NO_BALL_RUN_ORIGIN_OPTIONS.map((opt) => {
                      const active = engine.noBallRunOrigin === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => engine.setNoBallRunOrigin(opt.key)}
                          className="flex-1 py-1.5 rounded-lg font-mono-geist text-[9.5px] font-bold uppercase tracking-[0.08em] border transition-all"
                          style={
                            active
                              ? { background: "rgba(56,189,248,0.18)", borderColor: "rgba(56,189,248,0.5)", color: "#7dd3fc" }
                              : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.1)", color: "#93c5fd" }
                          }
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2 flex-1 min-h-0" style={{ gridAutoRows: "1fr", containerType: "size" } as CSSProperties}>
              {[0, 1, 2, 3, 4, 6].map((n) => (
                <button
                  type="button"
                  key={`run-${n}`}
                  onClick={() => handleTapRun(n)}
                  className="h-full w-full rounded-lg font-archivo font-bold transition-all hover:brightness-110 active:scale-95 border border-white/10"
                  style={{ fontSize: "clamp(1.1rem, min(9cqh, 12cqi), 3rem)", ...(n === 4 || n === 6 ? { background: GOLD_GRADIENT, color: "#1a1304", border: "1px solid rgba(255,255,255,0.1)" } : { background: "rgba(255,255,255,0.03)" }) }}
                >
                  {n}
                </button>
              ))}

              {extraGridTiles.map((opt) => {
                const meta = EXTRA_TILE_META[opt.key];
                const active = engine.extraType === opt.key;
                const tileDisabled = extraArmed && !active;
                return (
                  <button
                    type="button"
                    key={`extra-${opt.key}`}
                    onClick={() => handleTapExtra(opt.key)}
                    disabled={tileDisabled}
                    className="h-full w-full rounded-lg font-archivo font-bold transition-all hover:brightness-110 active:scale-95 border flex flex-col items-center justify-center gap-0.5 disabled:opacity-35 disabled:cursor-not-allowed"
                    style={
                      active
                        ? { background: "linear-gradient(135deg,#3b82f6,#1e3a8a)", borderColor: "rgba(147,197,253,0.6)", color: "#fff", boxShadow: "0 0 0 2px rgba(96,165,250,0.25) inset" }
                        : { background: "rgba(59,130,246,0.08)", borderColor: "rgba(96,165,250,0.25)", color: "#93c5fd" }
                    }
                  >
                    <Icon name={meta.icon} style={{ fontSize: "clamp(0.9rem, min(6cqh, 7cqi), 1.6rem)" }} />
                    <span className="font-mono-geist" style={{ fontSize: "clamp(0.65rem, min(4cqh, 5cqi), 0.95rem)", letterSpacing: "0.06em" }}>
                      {meta.abbr}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleTapWicket}
                className="h-full w-full rounded-lg font-mono-geist font-bold uppercase tracking-[0.12em] transition-all hover:brightness-110 active:scale-95 bg-error-container text-on-error-container border border-white/10 disabled:opacity-35 disabled:cursor-not-allowed"
                style={{ fontSize: "clamp(0.75rem, min(5cqh, 6cqi), 1.5rem)" }}
              >
                Out
              </button>

              <button
                type="button"
                onClick={() => engine.canUndo && engine.undo()}
                disabled={!engine.canUndo || extraArmed}
                className="h-full w-full rounded-lg font-mono-geist font-bold uppercase tracking-[0.1em] transition-all hover:brightness-110 active:scale-95 border disabled:opacity-35 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-0.5"
                style={{ color: "#fbbf24", borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.1)" }}
              >
                <Icon name="undo" style={{ fontSize: "clamp(0.9rem, min(6cqh, 7cqi), 1.6rem)" }} />
                <span style={{ fontSize: "clamp(0.6rem, min(3.6cqh, 4.5cqi), 0.85rem)" }}>Undo</span>
              </button>

              <MoreActionsMenu
                onAdminAction={(label) => onAdminAction?.(label)}
                onPenaltyClick={() => setShowPenaltyDialog(true)}
                disabled={controlsLocked}
              />
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 sm:py-3 glass-panel shrink-0 min-w-0">
              <span className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.14em] font-bold shrink-0">This Over</span>
              <div className="flex items-center gap-1.5 overflow-x-auto min-w-0">
                {Array.from({ length: Math.max(6, thisOverDisplay.length) }, (_, i) => (
                  <OverBall key={i} entry={i < thisOverDisplay.length ? normalizeOverEntry(thisOverDisplay[i]) : null} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 sm:[grid-template-columns:repeat(auto-fit,minmax(120px,1fr))] gap-2 sm:gap-3 shrink-0">
              {statCards.map((s) => (
                <div key={s.label} className="rounded-xl px-2 sm:px-4 py-2 sm:py-3 glass-panel">
                  <p className="font-mono-geist text-[8.5px] sm:text-[9px] text-on-surface-variant uppercase tracking-[0.16em] font-bold mb-0.5 sm:mb-1">{s.label}</p>
                  <p className="font-archivo text-base sm:text-lg font-bold tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
});

export default ScoringSection;