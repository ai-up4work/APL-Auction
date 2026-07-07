"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { LiveState, MatchSetup, SquadPlayer } from "@/lib/overlayBus";
import { DrawerSection, Eyebrow, FieldLabel, SmallButton, PrimaryButton, SegmentedControl } from "./ui";
import {
  useLiveScoringEngine,
  EXTRA_OPTIONS,
  getValidDismissalOptions,
  isDismissalLockedToRunOutOnly,
  type ExtraType,
  type DismissalType,
  type PendingWicket,
  type Toast,
} from "@/hooks/useLiveScoringEngine";
import ManualCorrectionPanel from "./ManualCorrectionPanel";
import { X } from "lucide-react";

function initials(name: string) {
  return (
    name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?"
  );
}

function squadFor(matchSetup: MatchSetup | undefined, key: "teamA" | "teamB"): SquadPlayer[] {
  if (!matchSetup) return [];
  const team = matchSetup[key];
  if (team.squadPlayers && team.squadPlayers.length > 0) return team.squadPlayers;
  return (team.squad ?? []).map((name) => ({ id: `name:${name}`, name }));
}

// Renders children into document.body instead of wherever this component
// happens to sit in the tree — sidesteps ancestor transform/filter/
// backdrop-filter creating a containing block for `position: fixed`.
function ViewportPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

function PlayerCarousel({
  players,
  onSelect,
  emptyLabel,
  dismissedNames,
}: {
  players: SquadPlayer[];
  onSelect: (p: SquadPlayer) => void;
  emptyLabel?: string;
  dismissedNames?: Set<string>;
}) {
  if (players.length === 0) {
    return (
      <p className="text-[10px] py-1" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}>
        {emptyLabel ?? "No squad loaded — set this team's squad in Match Setup."}
      </p>
    );
  }
  return (
    <div className="carousel-row">
      {players.map((p) => {
        const isOut = !!dismissedNames?.has(p.name);
        return (
          <button
            key={p.id}
            type="button"
            draggable={!isOut}
            disabled={isOut}
            onDragStart={(e) => {
              if (isOut) {
                e.preventDefault();
                return;
              }
              e.dataTransfer.setData("text/player-id", p.id);
            }}
            onClick={() => !isOut && onSelect(p)}
            className="carousel-chip"
            title={isOut ? `${p.name} — already out this innings` : p.name}
            style={isOut ? { opacity: 0.4, cursor: "not-allowed", filter: "grayscale(1)" } : undefined}
          >
            <span className="squad-avatar" style={{ width: 44, height: 44 }}>
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" />
              ) : (
                <span className="squad-avatar-fallback" style={{ fontSize: 13 }}>
                  {initials(p.name)}
                </span>
              )}
            </span>
            <span className="carousel-chip-name">{p.name}{isOut ? " · OUT" : ""}</span>
          </button>
        );
      })}
    </div>
  );
}

function CrewSlot({
  title,
  accentColor,
  active,
  onActivate,
  displayName,
  imageUrl,
  statLine,
  allPlayers,
  onAssign,
  onClear,
  placeholder,
  locked,
  dismissedNames,
}: {
  title: string;
  accentColor?: string;
  active: boolean;
  onActivate: () => void;
  displayName: string;
  imageUrl?: string;
  statLine?: string;
  allPlayers: SquadPlayer[];
  onAssign: (p: SquadPlayer) => void;
  onClear?: () => void;
  placeholder: string;
  locked?: boolean;
  dismissedNames?: Set<string>;
}) {
  const isEmpty = !displayName;
  return (
    <div
      className={`crew-slot ${active ? "is-active" : ""}`}
      onClick={locked ? undefined : onActivate}
      onDragOver={(e) => !locked && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (locked) return;
        const id = e.dataTransfer.getData("text/player-id");
        const player = allPlayers.find((p) => p.id === id);
        if (player && !dismissedNames?.has(player.name)) onAssign(player);
      }}
      style={{
        opacity: locked ? 0.6 : 1,
        cursor: locked ? "not-allowed" : "pointer",
        border: isEmpty ? "1px dashed rgba(217,83,79,0.45)" : undefined,
        background: isEmpty ? "rgba(217,83,79,0.05)" : undefined,
      }}
    >
      <div className="crew-slot-header">
        <Eyebrow color={isEmpty ? "#D9534F" : accentColor}>
          {isEmpty ? "⚠ " : ""}
          {title}
        </Eyebrow>
        <div className="flex items-center gap-2">
          {active && !locked && <span className="crew-slot-pick-hint">tap or drag a player below ▾</span>}
          {!isEmpty && onClear && !locked && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              title={`Clear ${title}`}
              aria-label={`Clear ${title}`}
              className="crew-slot-clear-btn"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
      <div className="crew-slot-body">
        <span className="squad-avatar" style={{ width: 48, height: 48 }}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" />
          ) : (
            <span className="squad-avatar-fallback" style={{ fontSize: 14 }}>
              {displayName ? initials(displayName) : "＋"}
            </span>
          )}
        </span>
        <div className="flex flex-col">
          <span className="crew-slot-name">{displayName || placeholder}</span>
          {statLine && <span className="crew-slot-stat">{statLine}</span>}
        </div>
      </div>
    </div>
  );
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="scorer-toast-stack">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="scorer-toast"
          style={{
            background: t.tone === "wicket" ? "var(--color-error-container)" : t.tone === "milestone" ? "rgba(201,151,31,0.16)" : "rgba(201,151,31,0.1)",
            border: `1px solid ${t.tone === "wicket" ? "rgba(255,180,171,0.35)" : "rgba(201,151,31,0.35)"}`,
            color: t.tone === "wicket" ? "var(--color-error)" : "var(--color-theme-orange)",
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

function BatsmanOutOption({
  label,
  name,
  runs,
  balls,
  selected,
  onClick,
}: {
  label: string;
  name: string;
  runs: number;
  balls: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg text-left transition-all flex-1"
      style={{
        background: selected ? "rgba(217,83,79,0.14)" : "var(--color-surface-container-low)",
        border: `1px solid ${selected ? "rgba(217,83,79,0.5)" : "var(--color-border-overlay)"}`,
      }}
    >
      <span className="text-[9px] uppercase tracking-wide" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}>
        {label}
      </span>
      <span className="text-[12px] font-bold" style={{ fontFamily: "var(--font-label-mono)", color: selected ? "var(--color-error)" : "var(--color-on-surface)" }}>
        {name || label}
      </span>
      <span className="text-[10px]" style={{ color: "var(--color-outline)" }}>
        {runs}({balls})
      </span>
    </button>
  );
}

function WicketDetailDialog({
  pending,
  onResolve,
}: {
  pending: PendingWicket;
  onResolve: (batsmanOut: "striker" | "nonStriker", fire: boolean, dismissalType: DismissalType, fielder: string, runsCompleted: number) => void;
}) {
  const [batsmanOut, setBatsmanOut] = useState<"striker" | "nonStriker">("striker");
  const options = getValidDismissalOptions(pending.extraType, pending.isFreeHitActive);
  const lockedToRunOutOnly = isDismissalLockedToRunOutOnly(pending.extraType, pending.isFreeHitActive);
  const [dismissalType, setDismissalType] = useState<DismissalType>(options[0].value);
  const [fielder, setFielder] = useState("");
  const [runsCompleted, setRunsCompleted] = useState(0);

  return (
    <div className="scorer-dialog-backdrop" onClick={() => onResolve(batsmanOut, false, dismissalType, fielder, runsCompleted)}>
      <div className="scorer-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-error)" }}>
            Wicket Detail
          </span>
          <button
            type="button"
            onClick={() => onResolve(batsmanOut, false, dismissalType, fielder, runsCompleted)}
            className="text-[11px]"
            style={{ color: "var(--color-outline)", fontFamily: "var(--font-label-mono)" }}
          >
            Skip ✕
          </button>
        </div>

        {lockedToRunOutOnly && (
          <div
            className="mb-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide"
            style={{ background: "rgba(96,165,250,0.14)", border: "1px solid rgba(96,165,250,0.4)", color: "#60A5FA", fontFamily: "var(--font-label-mono)" }}
          >
            🔓 {pending.extraType === "noBall" ? "No Ball" : "Free Hit"} — only Run Out is a valid dismissal
          </div>
        )}

        {!lockedToRunOutOnly && pending.extraType === "wide" && (
          <div
            className="mb-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide"
            style={{ background: "rgba(96,165,250,0.14)", border: "1px solid rgba(96,165,250,0.4)", color: "#60A5FA", fontFamily: "var(--font-label-mono)" }}
          >
            🔵 Wide — Bowled, Caught, and LBW aren&apos;t valid here
          </div>
        )}

        <div className="flex flex-col gap-1.5 mb-3">
          <FieldLabel>Batsman Out</FieldLabel>
          <div className="flex gap-2">
            <BatsmanOutOption label="Striker" name={pending.strikerBefore.name} runs={pending.strikerBefore.runs} balls={pending.strikerBefore.balls} selected={batsmanOut === "striker"} onClick={() => setBatsmanOut("striker")} />
            <BatsmanOutOption label="Non-Striker" name={pending.nonStrikerBefore.name} runs={pending.nonStrikerBefore.runs} balls={pending.nonStrikerBefore.balls} selected={batsmanOut === "nonStriker"} onClick={() => setBatsmanOut("nonStriker")} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mb-3">
          <FieldLabel>Dismissal</FieldLabel>
          <select
            value={dismissalType}
            disabled={options.length === 1}
            onChange={(e) => setDismissalType(e.target.value as DismissalType)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface)", opacity: options.length === 1 ? 0.75 : 1 }}
          >
            {options.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {dismissalType === "runOut" && (
          <div className="flex flex-col gap-1.5 mb-3">
            <FieldLabel>Runs Completed Before Run Out</FieldLabel>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRunsCompleted(n)}
                  className="flex-1 py-2 rounded-lg text-sm font-bold"
                  style={{
                    background: runsCompleted === n ? "rgba(217,83,79,0.14)" : "var(--color-surface-container-low)",
                    border: `1px solid ${runsCompleted === n ? "rgba(217,83,79,0.5)" : "var(--color-border-overlay)"}`,
                    color: runsCompleted === n ? "var(--color-error)" : "var(--color-on-surface)",
                    fontFamily: "var(--font-label-mono)",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5 mb-4">
          <FieldLabel>Fielder (if any)</FieldLabel>
          <input
            value={fielder}
            onChange={(e) => setFielder(e.target.value)}
            placeholder="Fielder name"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface)" }}
          />
        </div>

        <button
          type="button"
          onClick={() => onResolve(batsmanOut, true, dismissalType, fielder, runsCompleted)}
          className="w-full py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wide"
          style={{ fontFamily: "var(--font-label-mono)", background: "var(--color-error)", color: "var(--color-on-primary)" }}
        >
          Fire Wicket Graphic
        </button>
      </div>
    </div>
  );
}

function EndInningsDialog({
  currentRuns,
  isSecondInnings,
  onConfirm,
  onCancel,
}: {
  currentRuns: number;
  isSecondInnings: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="scorer-dialog-backdrop" onClick={onCancel}>
      <div className="scorer-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-error)" }}>
            {isSecondInnings ? "End Match?" : "End Innings?"}
          </span>
        </div>
        {isSecondInnings ? (
          <p className="text-[12px] mb-4" style={{ color: "var(--color-on-surface)" }}>
            This is the 2nd innings — ending it marks the match complete, computes the result, and
            locks scoring. You can still undo this afterwards with the &quot;Undo&quot; button if it
            was a mistake.
          </p>
        ) : (
          <p className="text-[12px] mb-4" style={{ color: "var(--color-on-surface)" }}>
            This will set the target to <strong>{currentRuns + 1}</strong>, and reset the score, overs, striker,
            non-striker, and bowler for Innings 2 — you&apos;ll need to pick 3 new players before you can
            keep scoring. Match &amp; tournament boundary totals carry over. You can undo this
            afterwards if it was a mistake.
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wide"
            style={{
              fontFamily: "var(--font-label-mono)",
              background: "var(--color-surface-container-low)",
              border: "1px solid var(--color-border-overlay)",
              color: "var(--color-on-surface)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wide"
            style={{ fontFamily: "var(--font-label-mono)", background: "var(--color-error)", color: "var(--color-on-primary)" }}
          >
            {isSecondInnings ? "End Match" : "End Innings"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RestartMatchDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="scorer-dialog-backdrop" onClick={onCancel}>
      <div className="scorer-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[11px] font-black uppercase tracking-widest"
            style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}
          >
            Restart Match?
          </span>
        </div>
        <p className="text-[12px] mb-4" style={{ color: "var(--color-on-surface)" }}>
          This starts a fresh match with the <strong>same teams and squads</strong> from Match Setup.
          Score, overs, striker, non-striker, bowler, target, and the previous result all reset. The
          points table and tournament boundary totals are kept, since those track the whole
          tournament, not just one match. This can&apos;t be undone.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wide"
            style={{
              fontFamily: "var(--font-label-mono)",
              background: "var(--color-surface-container-low)",
              border: "1px solid var(--color-border-overlay)",
              color: "var(--color-on-surface)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wide"
            style={{ fontFamily: "var(--font-label-mono)", background: "var(--color-theme-orange)", color: "var(--color-on-primary)" }}
          >
            Restart Match
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LiveStatePanel({
  liveState,
  setLiveState,
  setLiveDirty,
  liveDirty,
  onPush,
  pushLabel,
  matchSetup,
  onBoundary,
  onMilestone,
  onWicketConfirm,
  onMaiden,
  onInningsEnd,
  onMatchComplete,
  onRestartMatch,
}: {
  liveState: LiveState;
  setLiveState: React.Dispatch<React.SetStateAction<LiveState>>;
  setLiveDirty: (v: boolean) => void;
  liveDirty: boolean;
  onPush: () => void;
  pushLabel: string;
  matchSetup?: MatchSetup;
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
  onMatchComplete?: (result: { winningTeamName: string; margin: string; method: "batting" | "bowling" | "tie" }) => void;
  onRestartMatch?: () => void;
}) {
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const battingTeamKey: "teamA" | "teamB" = useMemo(() => {
    const firstInningsTeamIsA = (() => {
      if (matchSetup?.tossWinner && matchSetup.tossDecision) {
        const winnerBats = matchSetup.tossDecision === "bat";
        const winnerIsA = matchSetup.tossWinner === "A";
        return winnerBats ? winnerIsA : !winnerIsA;
      }
      return true;
    })();
    const firstInningsTeam: "teamA" | "teamB" = firstInningsTeamIsA ? "teamA" : "teamB";
    const isSecondInningsNow = (liveState.inningsNumber ?? 1) === 2;
    if (!isSecondInningsNow) return firstInningsTeam;
    return firstInningsTeam === "teamA" ? "teamB" : "teamA";
  }, [matchSetup?.tossWinner, matchSetup?.tossDecision, liveState.inningsNumber]);
  const bowlingTeamKey = battingTeamKey === "teamA" ? "teamB" : "teamA";

  const battingSquad = useMemo(() => squadFor(matchSetup, battingTeamKey), [matchSetup, battingTeamKey]);
  const bowlingSquad = useMemo(() => squadFor(matchSetup, bowlingTeamKey), [matchSetup, bowlingTeamKey]);
  const battingTeamLabel = matchSetup?.[battingTeamKey]?.shortCode || (battingTeamKey === "teamA" ? "Team A" : "Team B");
  const bowlingTeamLabel = matchSetup?.[bowlingTeamKey]?.shortCode || (bowlingTeamKey === "teamA" ? "Team A" : "Team B");

  // Full team names for match-result text (falls back to the
  // shortCode-based label if a full name isn't set).
  const battingTeamName = matchSetup?.[battingTeamKey]?.name || battingTeamLabel;
  const bowlingTeamName = matchSetup?.[bowlingTeamKey]?.name || bowlingTeamLabel;

  const maxOversByFormat: Record<string, number | undefined> = { T20: 20, ODI: 50, Test: undefined };
  const maxOvers = matchSetup?.format ? maxOversByFormat[matchSetup.format] : undefined;

  const engine = useLiveScoringEngine({
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
  });

  const [showEndInningsConfirm, setShowEndInningsConfirm] = useState(false);

  const isSecondInnings = (liveState.inningsNumber ?? 1) === 2;
  const ballsBowled = liveState.score.overs * 6 + liveState.score.balls;
  const totalBalls = maxOvers !== undefined ? maxOvers * 6 : undefined;
  const ballsRemaining = totalBalls !== undefined ? Math.max(0, totalBalls - ballsBowled) : undefined;
  const runsNeeded = liveState.target !== undefined ? Math.max(0, liveState.target - liveState.score.runs) : undefined;
  const requiredRunRate =
    runsNeeded !== undefined && ballsRemaining ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : undefined;

  const controlsLocked = engine.assignmentsMissing();

  const runRate =
    liveState.score.overs + liveState.score.balls / 6 > 0
      ? (liveState.score.runs / (liveState.score.overs + liveState.score.balls / 6)).toFixed(2)
      : "0.00";

  return (
    <DrawerSection step="3" title="Scorer" description="Tap the ball, we do the maths" dirty={liveDirty} defaultOpen>
      <style>{`
        @keyframes scorerToastIn { from { opacity: 0; transform: translateY(6px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes scorerDialogIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        @keyframes scorerBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes freeHitPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(96,165,250,0.45); } 50% { box-shadow: 0 0 0 5px rgba(96,165,250,0); } }
        .scorer-toast-stack { position: fixed; bottom: 20px; right: 20px; top: auto; z-index: 9999; display: flex; flex-direction: column-reverse; gap: 6px; align-items: flex-end; pointer-events: none; }
        .scorer-toast { font-family: var(--font-label-mono); font-size: 11px; font-weight: 700; padding: 8px 14px; border-radius: 8px; animation: scorerToastIn 160ms ease-out; white-space: nowrap; box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
        .scorer-dialog-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 9000; animation: scorerBackdropIn 140ms ease-out; padding: 16px; }
        .scorer-dialog { width: 340px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow-y: auto; background: var(--color-surface-container-low); border: 1px solid var(--color-border-overlay); border-radius: 14px; padding: 18px; box-shadow: 0 12px 40px rgba(0,0,0,0.4); animation: scorerDialogIn 160ms cubic-bezier(0.2, 0.8, 0.3, 1); }
        .ball-controls-row { margin-bottom: 12px; }
        .ball-controls-extras { display: flex; flex-direction: column; gap: 4px; }
        .ball-controls-label { font-family: var(--font-label-mono); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--color-outline); }
        .free-hit-toggle { display: flex; align-items: center; gap: 6px; padding: 4px 10px 4px 5px; border-radius: 999px; border: 1px solid var(--color-border-overlay); background: var(--color-surface-container-low); transition: all 160ms ease; flex-shrink: 0; }
        .free-hit-toggle-track { position: relative; width: 30px; height: 18px; border-radius: 999px; background: var(--color-surface-container-high); transition: background 160ms ease; flex-shrink: 0; }
        .free-hit-toggle-thumb { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--color-outline); transition: transform 160ms ease, background 160ms ease; }
        .free-hit-toggle-label { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.15; }
        .free-hit-toggle-title { font-family: var(--font-label-mono); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-on-surface-variant); }
        .free-hit-toggle-state { font-family: var(--font-label-mono); font-size: 9px; font-weight: 600; color: var(--color-outline); }
        .free-hit-toggle.is-active { background: rgba(96, 165, 250, 0.14); border-color: rgba(96, 165, 250, 0.5); }
        .free-hit-toggle.is-active .free-hit-toggle-track { background: rgba(96, 165, 250, 0.35); }
        .free-hit-toggle.is-active .free-hit-toggle-thumb { transform: translateX(12px); background: #60a5fa; box-shadow: 0 0 6px rgba(96, 165, 250, 0.7); animation: freeHitPulse 1.6s ease-in-out infinite; }
        .free-hit-toggle.is-active .free-hit-toggle-title { color: #60a5fa; }
        .free-hit-toggle.is-active .free-hit-toggle-state { color: #60a5fa; }
        .swap-strike-btn {
          align-self: center;
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: 999px;
          border: 1px solid var(--color-border-overlay);
          background: var(--color-surface-container-low);
          color: var(--color-outline);
          font-size: 17px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 160ms ease, color 160ms ease, border-color 160ms ease, background 160ms ease;
          transform: rotate(90deg);
        }
        .swap-strike-btn:hover {
          color: var(--color-theme-orange);
          border-color: rgba(201,151,31,0.5);
          background: rgba(201,151,31,0.08);
          transform: rotate(90deg) scale(1.1);
        }
        @media (min-width: 768px) {
          .swap-strike-btn { transform: rotate(0deg); }
          .swap-strike-btn:hover { transform: scale(1.1); }
        }
        .crew-slot-clear-btn {
          width: 20px;
          height: 20px;
          border-radius: 999px;
          border: 1px solid var(--color-border-overlay);
          background: var(--color-surface-container-low);
          color: var(--color-outline);
          font-size: 13px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 140ms ease;
        }
        .crew-slot-clear-btn:hover {
          color: var(--color-error);
          border-color: rgba(217,83,79,0.5);
          background: rgba(217,83,79,0.1);
        }
        .assignment-needed-banner {
          font-family: var(--font-label-mono);
          font-size: 11px;
          font-weight: 700;
          padding: 10px 14px;
          border-radius: 10px;
          background: rgba(217,83,79,0.08);
          border: 1px dashed rgba(217,83,79,0.4);
          color: var(--color-error);
          margin-bottom: 12px;
        }
        .match-complete-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-family: var(--font-label-mono);
          font-size: 11px;
          font-weight: 700;
          padding: 12px 16px;
          border-radius: 10px;
          background: rgba(217,83,79,0.08);
          border: 1px solid rgba(217,83,79,0.35);
          color: var(--color-error);
          margin-bottom: 12px;
        }
      `}</style>

      <ViewportPortal>
        <ToastStack toasts={engine.toasts} />
      </ViewportPortal>
      {engine.pendingWicket && (
        <ViewportPortal>
          <WicketDetailDialog pending={engine.pendingWicket} onResolve={engine.resolveWicket} />
        </ViewportPortal>
      )}
      {showEndInningsConfirm && (
        <ViewportPortal>
          <EndInningsDialog
            currentRuns={liveState.score.runs}
            isSecondInnings={isSecondInnings}
            onCancel={() => setShowEndInningsConfirm(false)}
            onConfirm={() => {
              engine.endInnings();
              setShowEndInningsConfirm(false);
            }}
          />
        </ViewportPortal>
      )}
      {showRestartConfirm && (
        <ViewportPortal>
          <RestartMatchDialog
            onCancel={() => setShowRestartConfirm(false)}
            onConfirm={() => {
              onRestartMatch?.();
              setShowRestartConfirm(false);
            }}
          />
        </ViewportPortal>
      )}

      {liveState.matchComplete && (
        <div className="match-complete-banner">
          <span>
            🏁{" "}
            {liveState.matchResult
              ? `${liveState.matchResult.winningTeamName} ${liveState.matchResult.margin}`
              : "Match marked complete"}{" "}
            — scoring is locked.
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {engine.canUndo && (
              <SmallButton onClick={engine.undo} style={{ color: "var(--color-error)" }}>
                ↶ Undo &amp; keep scoring
              </SmallButton>
            )}
            {onRestartMatch && (
              <SmallButton onClick={() => setShowRestartConfirm(true)} style={{ color: "var(--color-theme-orange)" }}>
                ⇋ Restart Match (Same Teams)
              </SmallButton>
            )}
          </div>
        </div>
      )}

      {!liveState.matchComplete && controlsLocked && (
        <div className="assignment-needed-banner">
          ⚠ Pick a Striker, Non-Striker, and Bowler below before you can score. This is expected right
          after starting a new innings.
        </div>
      )}

      <div className="scoreboard-strip">
        <div className="scoreboard-main">
          <span className="scoreboard-runs">{liveState.score.runs}</span>
          <span className="scoreboard-wkts">/{liveState.score.wickets}</span>
        </div>
        <div className="scoreboard-meta">
          <span>{liveState.score.overs}.{liveState.score.balls} ov</span>
          <span>·</span>
          <span>RR {runRate}</span>
          <span>·</span>
          <span>{battingTeamLabel} batting</span>
          {isSecondInnings && liveState.target !== undefined && (
            <>
              <span>·</span>
              <span>Target {liveState.target}</span>
              {runsNeeded !== undefined && (
                <>
                  <span>·</span>
                  <span>
                    Need {runsNeeded}
                    {ballsRemaining !== undefined ? ` off ${ballsRemaining}` : ""}
                  </span>
                </>
              )}
              {requiredRunRate && (
                <>
                  <span>·</span>
                  <span>RRR {requiredRunRate}</span>
                </>
              )}
            </>
          )}
        </div>
        {!liveState.matchComplete && (
          <SmallButton
            onClick={() => setShowEndInningsConfirm(true)}
            style={{ marginLeft: "auto", color: "var(--color-error)" }}
          >
            {isSecondInnings ? "End Match" : "End Innings"}
          </SmallButton>
        )}
      </div>

      <div>
        <Eyebrow className="block mb-2">Who&apos;s Involved</Eyebrow>
        <div className="flex flex-col md:flex-row items-stretch gap-3">
          <div className="flex-1 min-w-0">
            <CrewSlot
              title="Striker *"
              accentColor="#E8C468"
              active={engine.activeSlot === "striker"}
              onActivate={() => engine.setActiveSlot("striker")}
              displayName={liveState.striker.name}
              imageUrl={liveState.striker.imageUrl}
              statLine={liveState.striker.name ? `${liveState.striker.runs} (${liveState.striker.balls})` : undefined}
              allPlayers={battingSquad}
              onAssign={(p) => engine.assignPlayer("striker", p)}
              onClear={() => engine.clearSlot("striker")}
              placeholder="Select striker"
              dismissedNames={engine.dismissedPlayers}
            />
          </div>

          <button
            type="button"
            onClick={engine.swapStrike}
            className="swap-strike-btn"
            title="Swap Strike"
            aria-label="Swap strike between batters"
          >
            ⇄
          </button>

          <div className="flex-1 min-w-0">
            <CrewSlot
              title="Non-Striker"
              active={engine.activeSlot === "nonStriker"}
              onActivate={() => engine.setActiveSlot("nonStriker")}
              displayName={liveState.nonStriker.name}
              imageUrl={liveState.nonStriker.imageUrl}
              statLine={liveState.nonStriker.name ? `${liveState.nonStriker.runs} (${liveState.nonStriker.balls})` : undefined}
              allPlayers={battingSquad}
              onAssign={(p) => engine.assignPlayer("nonStriker", p)}
              onClear={() => engine.clearSlot("nonStriker")}
              placeholder="Select non-striker"
              dismissedNames={engine.dismissedPlayers}
            />
          </div>
        </div>

        <div className="mt-3">
          <CrewSlot
            title={`Bowler (${bowlingTeamLabel})`}
            active={engine.activeSlot === "bowler"}
            onActivate={() => engine.setActiveSlot("bowler")}
            displayName={liveState.bowler.name}
            imageUrl={liveState.bowler.imageUrl}
            statLine={liveState.bowler.name ? `${liveState.bowler.overs}.${liveState.bowler.balls}-${liveState.bowler.maidens}-${liveState.bowler.runs}-${liveState.bowler.wickets}` : undefined}
            allPlayers={bowlingSquad}
            onAssign={(p) => engine.assignPlayer("bowler", p)}
            placeholder="Select bowler"
          />
        </div>

        <div className="mt-3">
          <Eyebrow className="block mb-1">{engine.activeSlot === "bowler" ? `Pick from ${bowlingTeamLabel}` : `Pick from ${battingTeamLabel}`}</Eyebrow>
          <PlayerCarousel
            players={engine.activeSlot === "bowler" ? bowlingSquad : battingSquad}
            onSelect={(p) => engine.assignPlayer(engine.activeSlot, p)}
            emptyLabel="No squad loaded for this side yet — add one in Match Setup, or type names manually in the Fix a Mistake section below."
            dismissedNames={engine.activeSlot === "bowler" ? undefined : engine.dismissedPlayers}
          />
        </div>

        <div className="flex items-center gap-2 mt-3">
          <SmallButton onClick={engine.newPartnership}>New Partnership</SmallButton>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Eyebrow>This Ball</Eyebrow>
          <div className="flex items-center gap-2">
            {engine.canUndo && (
              <SmallButton onClick={engine.undo} style={{ color: "var(--color-warning)" }}>
                ↶ Undo Last Ball
              </SmallButton>
            )}
            <button
              type="button"
              onClick={() => engine.setIsFreeHit((v) => !v)}
              className={`free-hit-toggle ${engine.isFreeHit ? "is-active" : "is-inactive"}`}
              title={engine.isFreeHit ? "Free Hit is active — tap to cancel" : "Tap to manually mark this ball a Free Hit"}
            >
              <span className="free-hit-toggle-track">
                <span className="free-hit-toggle-thumb" />
              </span>
              <span className="free-hit-toggle-label">
                <span className="free-hit-toggle-title">Free Hit</span>
                <span className="free-hit-toggle-state">{engine.isFreeHit ? "Active" : "Off"}</span>
              </span>
            </button>
          </div>
        </div>

        <div className="ball-controls-row">
          <div className="ball-controls-extras">
            <span className="ball-controls-label">Extra</span>
            <SegmentedControl options={EXTRA_OPTIONS} value={engine.extraType} onChange={(v) => engine.setExtraType(v as ExtraType)} />
          </div>
        </div>

        <div className="ball-pad" style={liveState.matchComplete ? { opacity: 0.4, pointerEvents: "none" } : undefined}>
          {[0, 1, 2, 3, 4, 6].map((r) => (
            <button
              key={r}
              type="button"
              className={`ball-btn ${r === 4 || r === 6 ? "ball-btn-boundary" : ""}`}
              onClick={() => engine.recordBall(r)}
              disabled={liveState.matchComplete}
            >
              {r}
            </button>
          ))}
          <button type="button" className="ball-btn ball-btn-wicket" onClick={engine.recordWicket} disabled={liveState.matchComplete}>
            OUT
          </button>
        </div>
        <p className="text-[9px] mt-2" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}>
          Pick an extra type first if this ball is a wide / no ball / bye / leg bye. Fours, sixes, and fifty/hundred milestones
          fire automatically. Tap OUT to record a wicket — you&apos;ll be asked who was out, the dismissal, and (for a run out)
          how many runs were completed. Innings/match completion (all out, overs up, or target reached) is now detected
          automatically.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="summary-tile">
          <FieldLabel>Partnership</FieldLabel>
          <span className="summary-tile-value">{liveState.partnership.runs} ({liveState.partnership.balls})</span>
        </div>
        <div className="summary-tile">
          <FieldLabel>Match 4s / 6s</FieldLabel>
          <span className="summary-tile-value">{liveState.matchBoundaries.fours} / {liveState.matchBoundaries.sixes}</span>
        </div>
        <div className="summary-tile">
          <FieldLabel>Tourn. 4s / 6s</FieldLabel>
          <span className="summary-tile-value">{liveState.tournamentBoundaries.fours} / {liveState.tournamentBoundaries.sixes}</span>
        </div>
        <div className="summary-tile">
          <FieldLabel>Bowler Figures</FieldLabel>
          <span className="summary-tile-value">{liveState.bowler.overs}.{liveState.bowler.balls}-{liveState.bowler.maidens}-{liveState.bowler.runs}-{liveState.bowler.wickets}</span>
        </div>
      </div>

      <ManualCorrectionPanel
        liveState={liveState}
        setLiveState={setLiveState}
        setLiveDirty={setLiveDirty}
        patchLive={engine.patchLive}
      />

      <div className="flex justify-end">
        <PrimaryButton onClick={onPush} minWidth={180}>
          {pushLabel}
        </PrimaryButton>
      </div>
    </DrawerSection>
  );
}