// app/components/demo/LiveStatePanel.tsx
"use client";

import React, { useEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle } from "react";
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
  type EngineSyncState,
} from "@/hooks/useLiveScoringEngine";
import ManualCorrectionPanel from "./ManualCorrectionPanel";
import { X, AlertTriangle, ArrowRight, UserX, Trophy, RotateCcw, Undo2 } from "lucide-react";

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

function logoFor(matchSetup: MatchSetup | undefined, key: "teamA" | "teamB"): string | undefined {
  return matchSetup?.[key]?.logoUrl || undefined;
}

function ViewportPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

type PlayerRole = "striker" | "nonStriker" | "bowler";

function PlayerCarousel({
  players,
  onSelect,
  emptyLabel,
  dismissedNames,
  roleByName,
  demoDim,
}: {
  players: SquadPlayer[];
  onSelect: (p: SquadPlayer) => void;
  emptyLabel?: string;
  dismissedNames?: Set<string>;
  roleByName?: Map<string, { role: PlayerRole; locked?: boolean }>;
  demoDim?: boolean;
}) {
  if (players.length === 0) {
    return (
      <p className="text-[10px] py-1" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}>
        {emptyLabel ?? "No squad loaded — set this team's squad in Match Setup."}
      </p>
    );
  }

  const allUnavailable = players.every(
    (p) => dismissedNames?.has(p.name) || !!roleByName?.get(p.name)
  );

  if (allUnavailable) {
    return (
      <div className="carousel-exhausted">
        <span className="carousel-exhausted-icon">
          <UserX size={17} strokeWidth={2} />
        </span>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="carousel-exhausted-title">All out of batters</span>
          <span className="carousel-exhausted-sub">Every player is either out or already at the crease.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="carousel-row" id="demo-player-carousel">
      {players.map((p) => {
        const isOut = !!dismissedNames?.has(p.name);
        const roleInfo = roleByName?.get(p.name);
        const isAlreadySelected = !!roleInfo;
        const isLocked = isOut || isAlreadySelected;
        const roleLabel =
          roleInfo?.role === "striker"
            ? "On Strike"
            : roleInfo?.role === "nonStriker"
            ? "Non-Striker"
            : roleInfo?.role === "bowler"
            ? "Bowling"
            : undefined;

        return (
          <button
            key={p.id}
            id={`demo-player-${p.id}`}
            type="button"
            draggable={!isLocked}
            disabled={isLocked}
            onDragStart={(e) => {
              if (isLocked) {
                e.preventDefault();
                return;
              }
              e.dataTransfer.setData("text/player-id", p.id);
            }}
            onClick={() => !isLocked && onSelect(p)}
            className="carousel-chip"
            title={
              isOut
                ? `${p.name} — already out this innings`
                : isAlreadySelected
                ? `${p.name} — currently ${roleLabel}`
                : p.name
            }
            style={
              isOut
                ? {
                    opacity: 0.55,
                    cursor: "not-allowed",
                    outline: "2px solid rgba(217,83,79,0.6)",
                    outlineOffset: 2,
                    borderRadius: 10,
                    background: "rgba(217,83,79,0.08)",
                  }
                : isAlreadySelected
                ? {
                    opacity: 0.85,
                    cursor: "not-allowed",
                    outline: "2px solid rgba(76,175,80,0.65)",
                    outlineOffset: 2,
                    borderRadius: 10,
                    background: "rgba(76,175,80,0.08)",
                  }
                : demoDim
                ? { opacity: 0.75 }
                : undefined
            }
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
            <span
              className="carousel-chip-name"
              style={
                isOut
                  ? { color: "var(--color-error)" }
                  : isAlreadySelected
                  ? { color: "#4CAF50" }
                  : undefined
              }
            >
              {p.name}
              {isOut ? " · OUT" : roleLabel ? ` · ${roleLabel}` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CrewSlot({
  id,
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
  blockedName,
  noReplacement,
  demoDim,
}: {
  id?: string;
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
  blockedName?: string;
  noReplacement?: boolean;
  demoDim?: boolean;
}) {
  const isEmpty = !displayName;
  const effectivelyLocked = !!locked;

  if (noReplacement && isEmpty) {
    return (
      <div id={id} className="crew-slot crew-slot-no-replacement">
        <div className="crew-slot-header">
          <Eyebrow color="var(--color-outline)">{title}</Eyebrow>
        </div>
        <div className="crew-slot-body crew-slot-no-replacement-body">
          <span className="squad-avatar" style={{ width: 48, height: 48, opacity: 0.5 }}>
            <span className="squad-avatar-fallback" style={{ fontSize: 14 }}>
              —
            </span>
          </span>
          <span className="crew-slot-no-replacement-text">No replacement left in the squad</span>
        </div>
      </div>
    );
  }

  return (
    <div
      id={id}
      className={`crew-slot ${active ? "is-active" : ""}`}
      onClick={effectivelyLocked ? undefined : onActivate}
      onDragOver={(e) => !effectivelyLocked && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (effectivelyLocked) return;
        const id = e.dataTransfer.getData("text/player-id");
        const player = allPlayers.find((p) => p.id === id);
        if (!player) return;
        if (dismissedNames?.has(player.name)) return;
        if (blockedName && player.name === blockedName) return;
        onAssign(player);
      }}
      style={{
        opacity: effectivelyLocked ? 0.6 : demoDim ? 0.85 : 1,
        cursor: effectivelyLocked ? "not-allowed" : "pointer",
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
          {active && !effectivelyLocked && <span className="crew-slot-pick-hint">tap or drag a player below ▾</span>}
          {!isEmpty && onClear && !effectivelyLocked && (
            <button
              type="button"
              id={id ? `${id}-clear` : undefined}
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

function BatsmanOutOption({
  id,
  label,
  name,
  runs,
  balls,
  selected,
  onClick,
}: {
  id?: string;
  label: string;
  name: string;
  runs: number;
  balls: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
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
  readOnly,
}: {
  pending: PendingWicket;
  onResolve: (batsmanOut: "striker" | "nonStriker", fire: boolean, dismissalType: DismissalType, fielder: string, runsCompleted: number) => void;
  readOnly?: boolean;
}) {
  const [batsmanOut, setBatsmanOut] = useState<"striker" | "nonStriker">("striker");
  const options = getValidDismissalOptions(pending.extraType, pending.isFreeHitActive);
  const lockedToRunOutOnly = isDismissalLockedToRunOutOnly(pending.extraType, pending.isFreeHitActive);
  const [dismissalType, setDismissalType] = useState<DismissalType>(options[0].value);
  const [fielder, setFielder] = useState("");
  const [runsCompleted, setRunsCompleted] = useState(0);

  return (
    <div
      className="scorer-dialog-backdrop"
      style={{ pointerEvents: readOnly ? "none" : undefined }}
      onClick={() => onResolve(batsmanOut, false, dismissalType, fielder, runsCompleted)}
    >
      <div className="scorer-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-error)" }}>
            Wicket Detail
          </span>
          <button
            id="demo-wicket-skip"
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
            <BatsmanOutOption
              id="demo-wicket-pick-striker"
              label="Striker"
              name={pending.strikerBefore.name}
              runs={pending.strikerBefore.runs}
              balls={pending.strikerBefore.balls}
              selected={batsmanOut === "striker"}
              onClick={() => setBatsmanOut("striker")}
            />
            <BatsmanOutOption
              id="demo-wicket-pick-nonstriker"
              label="Non-Striker"
              name={pending.nonStrikerBefore.name}
              runs={pending.nonStrikerBefore.runs}
              balls={pending.nonStrikerBefore.balls}
              selected={batsmanOut === "nonStriker"}
              onClick={() => setBatsmanOut("nonStriker")}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mb-3">
          <FieldLabel>Dismissal</FieldLabel>
          <select
            id="demo-wicket-dismissal-select"
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
                  id={`demo-runs-completed-${n}`}
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
            id="demo-wicket-fielder-input"
            value={fielder}
            onChange={(e) => setFielder(e.target.value)}
            placeholder="Fielder name"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface)" }}
          />
        </div>

        <button
          id="demo-wicket-fire"
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
  readOnly,
}: {
  currentRuns: number;
  isSecondInnings: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className="scorer-dialog-backdrop" style={{ pointerEvents: readOnly ? "none" : undefined }} onClick={onCancel}>
      <div className="scorer-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-error)" }}>
            {isSecondInnings ? "End Match?" : "End Innings?"}
          </span>
        </div>
        {isSecondInnings ? (
          <p className="text-[12px] mb-4" style={{ color: "var(--color-on-surface)" }}>
            This is the 2nd innings — ending it marks the match complete, computes the result, fires
            the Match Won graphic immediately, and locks scoring. You can still undo this afterwards
            with the &quot;Undo&quot; button if it was a mistake.
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
            id="demo-cancel-end-innings"
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
            id="demo-confirm-end-innings"
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

function RestartMatchDialog({ onConfirm, onCancel, readOnly }: { onConfirm: () => void; onCancel: () => void; readOnly?: boolean }) {
  return (
    <div className="scorer-dialog-backdrop" style={{ pointerEvents: readOnly ? "none" : undefined }} onClick={onCancel}>
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
            id="demo-cancel-restart"
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
            id="demo-confirm-restart"
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

function MatchOverScreen({
  winningTeamName,
  winningTeamLogo,
  margin,
  method,
  canUndo,
  onUndo,
  onRestart,
}: {
  winningTeamName?: string;
  winningTeamLogo?: string;
  margin?: string;
  method?: "batting" | "bowling" | "tie" | "runs" | "wickets";
  canUndo: boolean;
  onUndo: () => void;
  onRestart?: () => void;
}) {
  const isTie = method === "tie";

  return (
    <div className="match-over-screen">
      <div className="match-over-glow" aria-hidden />
      <div className="match-over-shine" aria-hidden />

      <span className="match-over-eyebrow">
        <span className="match-over-eyebrow-icon">
          <Trophy size={13} strokeWidth={2.4} />
        </span>
        Match Complete
      </span>

      <div className="match-over-badge">
        {winningTeamLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={winningTeamLogo} alt="" className="match-over-logo-img" />
        ) : (
          <span className="match-over-logo-fallback">
            {isTie ? "🤝" : <Trophy size={36} strokeWidth={1.8} />}
          </span>
        )}
      </div>

      <h2 className="match-over-title">
        {isTie ? "It's a Tie" : winningTeamName ? `${winningTeamName} Win` : "Match Complete"}
      </h2>
      {!isTie && margin && <p className="match-over-margin">{margin}</p>}

      <div className="match-over-actions">
        {canUndo && (
          <button id="demo-match-over-undo" type="button" className="match-over-btn match-over-btn-undo" onClick={onUndo}>
            <Undo2 size={14} strokeWidth={2.4} />
            Undo &amp; Keep Scoring
          </button>
        )}
        {onRestart && (
          <button id="demo-match-over-restart" type="button" className="match-over-btn match-over-btn-restart" onClick={onRestart}>
            <RotateCcw size={14} strokeWidth={2.4} />
            Restart Match
          </button>
        )}
      </div>
    </div>
  );
}

export interface LiveStatePanelHandle {
  isControlsLocked: () => boolean;
  isMatchComplete: () => boolean;
  hasPendingWicket: () => boolean;
  noPartnerAvailable: () => boolean;
  isSecondInnings: () => boolean;
  canUndo: () => boolean;
  isFreeHitActive: () => boolean;
  getBattingSquad: () => SquadPlayer[];
  getBowlingSquad: () => SquadPlayer[];
  getDismissedNames: () => Set<string>;
  getStrikerName: () => string;
  getNonStrikerName: () => string;
  getBowlerName: () => string;
  getMaxLegalBalls: () => number | undefined;
  getLegalBallsBowled: () => number;
}

export interface LiveStatePanelProps {
  auctionId?: string;
  matchId?: string | null;
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
  onMatchComplete?: (result: { winningTeamName: string; margin: string; method: "batting" | "bowling" | "tie" | "runs" | "wickets" }) => void;
  onRestartMatch?: () => void;
  onFireMatchWonMoment?: (payload: {
    winningTeamName: string;
    margin: string;
    method: "runs" | "wickets" | "tie";
    teamColor?: string;
    teamLogoUrl?: string;
  }) => void;
  onEngineStateChange?: (state: EngineSyncState) => void;
  initialEngineState?: EngineSyncState | null;
  readOnly?: boolean;
}

const LiveStatePanel = forwardRef<LiveStatePanelHandle, LiveStatePanelProps>(function LiveStatePanel(
  {
    auctionId,
    matchId,
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
    onFireMatchWonMoment,
    onEngineStateChange,
    initialEngineState,
    readOnly,
  },
  ref
) {
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  // FIX (locked-controls UX): a small, self-dismissing error toast shown
  // whenever a real (non-demo) user tries to score a ball or appeal a
  // wicket while striker/non-striker/bowler assignments are still
  // missing. Previously the ball pad and OUT button just silently did
  // nothing in that state — nothing told the scorer WHY their tap didn't
  // register.
  const [lockedNotice, setLockedNotice] = useState(false);
  const lockedNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashLockedNotice() {
    setLockedNotice(true);
    if (lockedNoticeTimerRef.current) clearTimeout(lockedNoticeTimerRef.current);
    lockedNoticeTimerRef.current = setTimeout(() => setLockedNotice(false), 2200);
  }

  useEffect(
    () => () => {
      if (lockedNoticeTimerRef.current) clearTimeout(lockedNoticeTimerRef.current);
    },
    []
  );

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

  const battingTeamName = matchSetup?.[battingTeamKey]?.name || battingTeamLabel;
  const bowlingTeamName = matchSetup?.[bowlingTeamKey]?.name || bowlingTeamLabel;

  const teamALogo = logoFor(matchSetup, "teamA");
  const teamBLogo = logoFor(matchSetup, "teamB");
  const teamAName = matchSetup?.teamA?.name || matchSetup?.teamA?.shortCode || "Team A";
  const teamBName = matchSetup?.teamB?.name || matchSetup?.teamB?.shortCode || "Team B";

  const winningTeamKey = useMemo((): "teamA" | "teamB" | undefined => {
    const winName = liveState.matchResult?.winningTeamName;
    if (!winName) return undefined;
    if (winName === teamAName || winName === matchSetup?.teamA?.shortCode) return "teamA";
    if (winName === teamBName || winName === matchSetup?.teamB?.shortCode) return "teamB";
    return undefined;
  }, [liveState.matchResult?.winningTeamName, teamAName, teamBName, matchSetup]);

  const winningTeamLogo = winningTeamKey === "teamA" ? teamALogo : winningTeamKey === "teamB" ? teamBLogo : undefined;

  const maxOversByFormat: Record<string, number | undefined> = { T20: 20, ODI: 50, Test: undefined };
  const maxOvers = matchSetup?.format ? maxOversByFormat[matchSetup.format] : undefined;

  const engine = useLiveScoringEngine({
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
  });

  useImperativeHandle(
    ref,
    () => ({
      isControlsLocked: () => engine.assignmentsMissing(),
      isMatchComplete: () => liveState.matchComplete === true,
      hasPendingWicket: () => !!engine.pendingWicket,
      noPartnerAvailable: () => !!engine.noPartnerAvailable,
      isSecondInnings: () => (liveState.inningsNumber ?? 1) === 2,
      canUndo: () => engine.canUndo,
      isFreeHitActive: () => engine.isFreeHit,
      getBattingSquad: () => battingSquad,
      getBowlingSquad: () => bowlingSquad,
      getDismissedNames: () => engine.dismissedPlayers,
      getStrikerName: () => liveState.striker.name,
      getNonStrikerName: () => liveState.nonStriker.name,
      getBowlerName: () => liveState.bowler.name,
      getMaxLegalBalls: () => (maxOvers !== undefined ? maxOvers * 6 : undefined),
      getLegalBallsBowled: () => liveState.score.overs * 6 + liveState.score.balls,
    }),
    [
      engine,
      liveState.matchComplete,
      liveState.inningsNumber,
      liveState.striker.name,
      liveState.nonStriker.name,
      liveState.bowler.name,
      liveState.score.overs,
      liveState.score.balls,
      maxOvers,
      battingSquad,
      bowlingSquad,
    ]
  );

  const [showEndInningsConfirm, setShowEndInningsConfirm] = useState(false);

  const isSecondInnings = (liveState.inningsNumber ?? 1) === 2;
  const ballsBowled = liveState.score.overs * 6 + liveState.score.balls;
  const totalBalls = maxOvers !== undefined ? maxOvers * 6 : undefined;
  const ballsRemaining = totalBalls !== undefined ? Math.max(0, totalBalls - ballsBowled) : undefined;
  const runsNeeded = liveState.target !== undefined ? Math.max(0, liveState.target - liveState.score.runs) : undefined;
  const requiredRunRate =
    runsNeeded !== undefined && ballsRemaining ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : undefined;

  const controlsLocked = engine.assignmentsMissing();

  // FIX (locked-controls UX): route every scoring action (a run, an
  // extra, or an appeal) through this guard instead of calling the
  // engine directly. While `readOnly` (auto-demo mode) is active, the
  // whole scoring console already sits behind `pointer-events: none` —
  // see `#demo-panel-root` below — so this guard only matters for a
  // real, interactive user.
  function guardedBallAction(action: () => void) {
    if (controlsLocked) {
      flashLockedNotice();
      return;
    }
    action();
  }

  const strikerNeedsReplacement = engine.noPartnerAvailable && !liveState.striker.name;
  const nonStrikerNeedsReplacement = engine.noPartnerAvailable && !liveState.nonStriker.name;

  const battingRoleMap = useMemo(() => {
    const m = new Map<string, { role: "striker" | "nonStriker"; locked?: boolean }>();
    if (liveState.striker.name) {
      m.set(liveState.striker.name, { role: "striker", locked: engine.activeSlot === "nonStriker" });
    }
    if (liveState.nonStriker.name) {
      m.set(liveState.nonStriker.name, { role: "nonStriker", locked: engine.activeSlot === "striker" });
    }
    return m;
  }, [liveState.striker.name, liveState.nonStriker.name, engine.activeSlot]);

  const bowlingRoleMap = useMemo(() => {
    const m = new Map<string, { role: "bowler" }>();
    if (liveState.bowler.name) m.set(liveState.bowler.name, { role: "bowler" });
    return m;
  }, [liveState.bowler.name]);

  const runRate =
    liveState.score.overs + liveState.score.balls / 6 > 0
      ? (liveState.score.runs / (liveState.score.overs + liveState.score.balls / 6)).toFixed(2)
      : "0.00";

  return (
    <DrawerSection step="3" title="Scorer" description="Tap the ball, we do the maths" dirty={liveDirty} defaultOpen>
      <style>{`
        @keyframes scorerDialogIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        @keyframes scorerBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes freeHitPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(96,165,250,0.45); } 50% { box-shadow: 0 0 0 5px rgba(96,165,250,0); } }
        @keyframes inningsStatusGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(201,151,31,0.25); } 50% { box-shadow: 0 0 0 6px rgba(201,151,31,0); } }
        @keyframes matchOverGlowPulse { 0%, 100% { opacity: 0.5; transform: translateX(-50%) scale(1); } 50% { opacity: 0.85; transform: translateX(-50%) scale(1.06); } }
        @keyframes matchOverIn { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes matchOverWatermarkFloat {
          0%, 100% { transform: translate(-50%, -50%) scale(0.94); opacity: 0.08; }
          50% { transform: translate(-50%, -50%) scale(1); opacity: 0.14; }
        }
        @keyframes matchOverShine {
          0% { transform: translateX(-120%) rotate(8deg); }
          100% { transform: translateX(220%) rotate(8deg); }
        }
        @keyframes matchOverBadgeIn {
          0% { opacity: 0; transform: scale(0.6) rotate(-8deg); }
          60% { transform: scale(1.08) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes matchOverFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes matchOverBadgeRing {
          0%, 100% { box-shadow: 0 0 0 8px rgba(201,151,31,0.08), 0 12px 32px rgba(0,0,0,0.35); }
          50% { box-shadow: 0 0 0 12px rgba(201,151,31,0.14), 0 12px 32px rgba(0,0,0,0.35); }
        }
        @keyframes lockedNoticeIn {
          from { opacity: 0; transform: translate(-50%, 8px) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }

        .scorer-dialog-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 9000; animation: scorerBackdropIn 140ms ease-out; padding: 16px; }
        .scorer-dialog { width: 340px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow-y: auto; background: var(--color-surface-container-low); border: 1px solid var(--color-border-overlay); border-radius: 14px; padding: 18px; box-shadow: 0 12px 40px rgba(0,0,0,0.4); animation: scorerDialogIn 160ms cubic-bezier(0.2, 0.8, 0.3, 1); }
        .locked-notice-toast {
          position: fixed;
          left: 50%;
          bottom: 32px;
          transform: translateX(-50%);
          z-index: 9500;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 10px;
          font-family: var(--font-label-mono);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--color-error);
          background: rgba(217,83,79,0.16);
          border: 1px solid rgba(217,83,79,0.5);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          box-shadow: 0 10px 28px rgba(0,0,0,0.35);
          animation: lockedNoticeIn 160ms cubic-bezier(0.2, 0.8, 0.3, 1);
          pointer-events: none;
        }
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
        .crew-slot-no-replacement {
          border: 1px dashed var(--color-border-overlay);
          background: var(--color-surface-container-low);
          border-radius: 12px;
          padding: 12px;
        }
        .crew-slot-no-replacement-body {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 6px;
        }
        .crew-slot-no-replacement-text {
          font-family: var(--font-label-mono);
          font-size: 10px;
          font-weight: 700;
          color: var(--color-outline);
        }
        .carousel-exhausted {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 16px;
          border-radius: 12px;
          background: var(--color-surface-container-low);
          border: 1px solid var(--color-border-overlay);
        }
        .carousel-exhausted-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--color-border-overlay);
          color: var(--color-outline);
          flex-shrink: 0;
        }
        .carousel-exhausted-title {
          font-family: var(--font-label-mono);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-on-surface);
        }
        .carousel-exhausted-sub {
          font-family: var(--font-label-mono);
          font-size: 10px;
          color: var(--color-outline);
          margin-top: 2px;
          line-height: 1.4;
        }
        .innings-status-card {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 18px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(201,151,31,0.09) 0%, rgba(201,151,31,0.03) 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(201,151,31,0.28);
          margin-bottom: 12px;
        }
        .innings-status-card::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(201,151,31,0.7), transparent);
        }
        .innings-status-icon-badge {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(201,151,31,0.14);
          border: 1px solid rgba(201,151,31,0.35);
          flex-shrink: 0;
          color: var(--color-theme-orange);
          animation: inningsStatusGlow 2.4s ease-in-out infinite;
        }
        .innings-status-text { flex: 1; min-width: 0; }
        .innings-status-eyebrow { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
        .innings-status-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--color-theme-orange); flex-shrink: 0; position: relative; }
        .innings-status-dot::after {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 999px;
          border: 1px solid var(--color-theme-orange);
          animation: inningsStatusGlow 2.4s ease-in-out infinite;
        }
        .innings-status-eyebrow-label {
          font-family: var(--font-label-mono);
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--color-theme-orange);
          opacity: 0.85;
        }
        .innings-status-title {
          font-family: var(--font-label-mono);
          font-size: 14px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          color: var(--color-on-surface);
          line-height: 1.25;
        }
        .innings-status-sub {
          font-family: var(--font-label-mono);
          font-size: 10.5px;
          color: var(--color-outline);
          margin-top: 3px;
          line-height: 1.4;
        }
        .innings-status-btn {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-label-mono);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-on-primary);
          background: var(--color-theme-orange);
          border: none;
          border-radius: 10px;
          padding: 11px 16px;
          cursor: pointer;
          box-shadow: 0 4px 18px rgba(201,151,31,0.4);
          transition: transform 130ms ease, box-shadow 130ms ease, filter 130ms ease;
        }
        .innings-status-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(201,151,31,0.5);
          filter: brightness(1.05);
        }
        .innings-status-btn:active { transform: translateY(0); }
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
        .match-over-screen {
          position: relative;
          overflow: hidden;
          display: flex;
          width: 100%;
          box-sizing: border-box;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 4px;
          padding: 56px 48px 44px;
          border-radius: 22px;
          background:
            radial-gradient(120% 100% at 50% 0%, rgba(201,151,31,0.14) 0%, rgba(201,151,31,0.03) 45%, transparent 70%),
            linear-gradient(180deg, var(--color-surface-container-low) 0%, var(--color-surface-container-low) 100%);
          border: 1px solid rgba(201,151,31,0.24);
          animation: matchOverIn 260ms cubic-bezier(0.2,0.8,0.3,1);
        }
        .match-over-glow {
          position: absolute;
          top: -80px;
          left: 50%;
          width: 320px;
          height: 320px;
          transform: translateX(-50%);
          border-radius: 999px;
          background: radial-gradient(circle, rgba(201,151,31,0.32) 0%, rgba(201,151,31,0) 70%);
          animation: matchOverGlowPulse 3.4s ease-in-out infinite;
          pointer-events: none;
          z-index: 0;
        }
        .match-over-shine {
          position: absolute;
          inset: -20% -40%;
          background: linear-gradient(100deg, transparent 42%, rgba(255,255,255,0.05) 48%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 52%, transparent 58%);
          animation: matchOverShine 3.2s ease-in-out infinite;
          animation-delay: 0.4s;
          pointer-events: none;
          z-index: 0;
        }
        .match-over-eyebrow {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 7px;
          font-family: var(--font-label-mono);
          font-size: 10.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: var(--color-theme-orange);
          margin-bottom: 22px;
          opacity: 0;
          animation: matchOverFadeUp 420ms ease-out 80ms forwards;
        }
        .match-over-eyebrow::before,
        .match-over-eyebrow::after {
          content: "";
          width: 20px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(201,151,31,0.5));
        }
        .match-over-eyebrow::after { transform: scaleX(-1); }
        .match-over-eyebrow-icon { display: flex; align-items: center; opacity: 0.9; }
        .match-over-badge {
          position: relative;
          z-index: 1;
          width: 104px;
          height: 104px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-surface-container-low);
          border: 3px solid rgba(201,151,31,0.5);
          box-shadow: 0 0 0 8px rgba(201,151,31,0.08), 0 12px 32px rgba(0,0,0,0.35);
          overflow: hidden;
          margin-bottom: 20px;
          opacity: 0;
          animation:
            matchOverBadgeIn 480ms cubic-bezier(0.2,0.8,0.3,1) 160ms forwards,
            matchOverBadgeRing 2.6s ease-in-out 700ms infinite;
        }
        .match-over-logo-img { width: 100%; height: 100%; object-fit: cover; }
        .match-over-logo-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 30px;
          color: var(--color-theme-orange);
        }
        .match-over-title {
          position: relative;
          z-index: 1;
          font-family: var(--font-label-mono);
          font-size: 26px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.015em;
          color: var(--color-on-surface);
          margin: 0;
          opacity: 0;
          animation: matchOverFadeUp 420ms ease-out 260ms forwards;
        }
        .match-over-margin {
          position: relative;
          z-index: 1;
          font-family: var(--font-label-mono);
          font-size: 12.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-theme-orange);
          margin: 14px 0 0;
          padding: 6px 16px;
          border-radius: 999px;
          background: rgba(201,151,31,0.1);
          border: 1px solid rgba(201,151,31,0.32);
          display: inline-block;
          opacity: 0;
          animation: matchOverFadeUp 420ms ease-out 360ms forwards;
        }
        .match-over-actions {
          position: relative;
          z-index: 1;
          display: flex;
          gap: 10px;
          margin-top: 30px;
          flex-wrap: wrap;
          justify-content: center;
          opacity: 0;
          animation: matchOverFadeUp 420ms ease-out 460ms forwards;
        }
        .match-over-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          font-family: var(--font-label-mono);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-radius: 10px;
          padding: 11px 20px;
          cursor: pointer;
          border: none;
          transition: transform 130ms ease, box-shadow 130ms ease, filter 130ms ease;
        }
        .match-over-btn:hover { transform: translateY(-1px); }
        .match-over-btn-undo {
          color: var(--color-error);
          background: rgba(217,83,79,0.1);
          border: 1px solid rgba(217,83,79,0.32);
        }
        .match-over-btn-undo:hover {
          background: rgba(217,83,79,0.16);
          border-color: rgba(217,83,79,0.5);
        }
        .match-over-btn-restart {
          color: var(--color-on-primary);
          background: linear-gradient(135deg, var(--color-theme-orange), #b8860b);
          box-shadow: 0 4px 18px rgba(201,151,31,0.4);
        }
        .match-over-btn-restart:hover {
          box-shadow: 0 6px 26px rgba(201,151,31,0.5);
          filter: brightness(1.06);
        }
      `}</style>

      {engine.pendingWicket && (
        <ViewportPortal>
          <WicketDetailDialog pending={engine.pendingWicket} onResolve={engine.resolveWicket} readOnly={readOnly} />
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
            readOnly={readOnly}
          />
        </ViewportPortal>
      )}
      {showRestartConfirm && (
        <ViewportPortal>
          <RestartMatchDialog
            onCancel={() => setShowRestartConfirm(false)}
            onConfirm={() => {
              engine.resetEngineState();
              onRestartMatch?.();
              setShowRestartConfirm(false);
            }}
            readOnly={readOnly}
          />
        </ViewportPortal>
      )}

      {lockedNotice && (
        <ViewportPortal>
          <div className="locked-notice-toast" role="status">
            <AlertTriangle size={14} strokeWidth={2.4} />
            Assign striker, non-striker &amp; bowler before scoring
          </div>
        </ViewportPortal>
      )}

      <div id="demo-panel-root" style={{ pointerEvents: readOnly ? "none" : undefined }}>
        {liveState.matchComplete ? (
          <MatchOverScreen
            winningTeamName={liveState.matchResult?.winningTeamName}
            winningTeamLogo={winningTeamLogo}
            margin={liveState.matchResult?.margin}
            method={liveState.matchResult?.method}
            canUndo={engine.canUndo}
            onUndo={engine.undo}
            onRestart={onRestartMatch ? () => setShowRestartConfirm(true) : undefined}
          />
        ) : (
          <>


            {engine.noPartnerAvailable && (
              <div className="innings-status-card">
                <span className="innings-status-icon-badge">
                  <AlertTriangle size={20} strokeWidth={2.2} />
                </span>
                <div className="innings-status-text">
                  <div className="innings-status-eyebrow">
                    <span className="innings-status-dot" />
                    <span className="innings-status-eyebrow-label">Last Man Batting</span>
                  </div>
                  <div className="innings-status-title">No replacement left in the squad</div>
                  <div className="innings-status-sub">Wrap up {isSecondInnings ? "the match" : "this innings"} whenever you're ready.</div>
                </div>
                <button
                  id="demo-open-end-innings"
                  type="button"
                  className="innings-status-btn"
                  onClick={() => setShowEndInningsConfirm(true)}
                >
                  {isSecondInnings ? "End Match" : "End Innings"}
                  <ArrowRight size={14} strokeWidth={2.5} />
                </button>
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
              {!engine.noPartnerAvailable && (
                <SmallButton
                  id="demo-open-end-innings"
                  onClick={() => setShowEndInningsConfirm(true)}
                  style={{ marginLeft: "auto", color: "var(--color-error)" }}
                >
                  {isSecondInnings ? "End Match" : "End Innings"}
                </SmallButton>
              )}
            </div>

            <div>
              <Eyebrow className="block mt-2 mb-2">Who&apos;s Involved</Eyebrow>

              <div className="flex flex-col md:flex-row items-stretch gap-3">
                <div className="flex-1 min-w-0">
                  <CrewSlot
                    id="demo-slot-striker"
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
                    blockedName={liveState.nonStriker.name || undefined}
                    noReplacement={strikerNeedsReplacement}
                    demoDim={readOnly}
                  />
                </div>

                <button
                  type="button"
                  id="demo-swap-strike"
                  onClick={engine.swapStrike}
                  className="swap-strike-btn"
                  title="Swap Strike"
                  aria-label="Swap strike between batters"
                  style={readOnly ? { opacity: 0.75 } : undefined}
                >
                  ⇄
                </button>

                <div className="flex-1 min-w-0">
                  <CrewSlot
                    id="demo-slot-nonStriker"
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
                    blockedName={liveState.striker.name || undefined}
                    noReplacement={nonStrikerNeedsReplacement}
                    demoDim={readOnly}
                  />
                </div>
              </div>

              <div className="mt-3">
                <CrewSlot
                  id="demo-slot-bowler"
                  title={`Bowler (${bowlingTeamLabel})`}
                  active={engine.activeSlot === "bowler"}
                  onActivate={() => engine.setActiveSlot("bowler")}
                  displayName={liveState.bowler.name}
                  imageUrl={liveState.bowler.imageUrl}
                  statLine={liveState.bowler.name ? `${liveState.bowler.overs}.${liveState.bowler.balls}-${liveState.bowler.maidens}-${liveState.bowler.runs}-${liveState.bowler.wickets}` : undefined}
                  allPlayers={bowlingSquad}
                  onAssign={(p) => engine.assignPlayer("bowler", p)}
                  placeholder="Select bowler"
                  demoDim={readOnly}
                />
              </div>

              <div className="mt-3">
                <Eyebrow className="block mb-1">{engine.activeSlot === "bowler" ? `Pick from ${bowlingTeamLabel}` : `Pick from ${battingTeamLabel}`}</Eyebrow>
                <PlayerCarousel
                  players={engine.activeSlot === "bowler" ? bowlingSquad : battingSquad}
                  onSelect={(p) => engine.assignPlayer(engine.activeSlot, p)}
                  emptyLabel="No squad loaded for this side yet — add one in Match Setup, or type names manually in the Fix a Mistake section below."
                  dismissedNames={engine.activeSlot === "bowler" ? undefined : engine.dismissedPlayers}
                  roleByName={engine.activeSlot === "bowler" ? bowlingRoleMap : battingRoleMap}
                  demoDim={readOnly}
                />
              </div>

              <div className="flex items-center gap-2 mt-3">
                <SmallButton id="demo-new-partnership" onClick={engine.newPartnership}>
                  New Partnership
                </SmallButton>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Eyebrow>This Ball</Eyebrow>
                <div className="flex items-center gap-2">
                  {engine.canUndo && (
                    <SmallButton id="demo-undo-ball" onClick={engine.undo} style={{ color: "var(--color-warning)" }}>
                      ↶ Undo Last Ball
                    </SmallButton>
                  )}
                  <button
                    type="button"
                    id="demo-free-hit-toggle"
                    onClick={() => engine.setIsFreeHit((v) => !v)}
                    className={`free-hit-toggle ${engine.isFreeHit ? "is-active" : "is-inactive"}`}
                    title={engine.isFreeHit ? "Free Hit is active — tap to cancel" : "Tap to manually mark this ball a Free Hit"}
                    style={readOnly ? { opacity: 0.85 } : undefined}
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
                  <div id="demo-extras-row">
                    <SegmentedControl options={EXTRA_OPTIONS} value={engine.extraType} onChange={(v) => engine.setExtraType(v as ExtraType)} />
                  </div>
                </div>
              </div>

              <div className="ball-pad" style={readOnly ? { opacity: 0.7 } : undefined}>
                {[0, 1, 2, 3, 4, 6].map((r) => (
                  <button
                    key={r}
                    type="button"
                    id={`demo-ball-${r}`}
                    className={`ball-btn ${r === 4 || r === 6 ? "ball-btn-boundary" : ""}`}
                    onClick={() => guardedBallAction(() => engine.recordBall(r as 0 | 1 | 2 | 3 | 4 | 6))}
                  >
                    {r}
                  </button>
                ))}
                <button
                  type="button"
                  id="demo-ball-out"
                  className="ball-btn ball-btn-wicket"
                  onClick={() => guardedBallAction(engine.recordWicket)}
                >
                  OUT
                </button>
              </div>
              <p className="text-[9px] mt-2 mb-2" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}>
                {readOnly
                  ? "Auto-demo is currently driving this match — switch to \"Try It Yourself\" to take over scoring."
                  : <>Pick an extra type first if this ball is a wide / no ball / bye / leg bye. Fours, sixes, and fifty/hundred milestones
                  fire automatically. Tap OUT to record a wicket — you&apos;ll be asked who was out, the dismissal, and (for a run out)
                  how many runs were completed. Innings/match completion (all out, overs up, or target reached) is now detected
                  automatically, and the Match Won graphic fires the instant the match completes.</>}
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

            {!readOnly && (
              <ManualCorrectionPanel
                liveState={liveState}
                setLiveState={setLiveState}
                setLiveDirty={setLiveDirty}
                patchLive={engine.patchLive}
              />
            )}
          </>
        )}
      </div>
    </DrawerSection>
  );
});

export default LiveStatePanel;