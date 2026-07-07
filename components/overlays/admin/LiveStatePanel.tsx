"use client";

import React, { useMemo, useState } from "react";
import type { LiveState, BowlerState, PointsRow, MatchSetup, SquadPlayer } from "@/lib/overlayBus";
import { DrawerSection, Eyebrow, FieldLabel, Input, Stepper, SmallButton, PrimaryButton, SegmentedControl, SubCard } from "./ui";
import {
  useLiveScoringEngine,
  EXTRA_OPTIONS,
  DISMISSAL_OPTIONS,
  FREE_HIT_DISMISSAL_OPTIONS,
  type ExtraType,
  type DismissalType,
  type PendingWicket,
  type Toast,
} from "@/hooks/useLiveScoringEngine";

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

const pointsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 0.55fr 0.55fr 0.55fr 0.65fr 0.55fr 28px",
  gap: 8,
  alignItems: "center",
};

function PlayerCarousel({
  players,
  onSelect,
  emptyLabel,
}: {
  players: SquadPlayer[];
  onSelect: (p: SquadPlayer) => void;
  emptyLabel?: string;
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
      {players.map((p) => (
        <button
          key={p.id}
          type="button"
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/player-id", p.id)}
          onClick={() => onSelect(p)}
          className="carousel-chip"
          title={p.name}
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
          <span className="carousel-chip-name">{p.name}</span>
        </button>
      ))}
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
  placeholder,
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
  placeholder: string;
}) {
  return (
    <div
      className={`crew-slot ${active ? "is-active" : ""}`}
      onClick={onActivate}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/player-id");
        const player = allPlayers.find((p) => p.id === id);
        if (player) onAssign(player);
      }}
    >
      <div className="crew-slot-header">
        <Eyebrow color={accentColor}>{title}</Eyebrow>
        {active && <span className="crew-slot-pick-hint">tap or drag a player below ▾</span>}
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
  const options = pending.wasFreeHit ? FREE_HIT_DISMISSAL_OPTIONS : DISMISSAL_OPTIONS;
  const [dismissalType, setDismissalType] = useState<DismissalType>(pending.wasFreeHit ? "runOut" : "bowled");
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

        {pending.wasFreeHit && (
          <div
            className="mb-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide"
            style={{ background: "rgba(96,165,250,0.14)", border: "1px solid rgba(96,165,250,0.4)", color: "#60A5FA", fontFamily: "var(--font-label-mono)" }}
          >
            🔓 {pending.extraType === "noBall" ? "No Ball" : "Free Hit"} — only Run Out is a valid dismissal
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
            disabled={pending.wasFreeHit}
            onChange={(e) => setDismissalType(e.target.value as DismissalType)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface)", opacity: pending.wasFreeHit ? 0.75 : 1 }}
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
}) {
  const engine = useLiveScoringEngine({ liveState, setLiveState, setLiveDirty, onBoundary, onMilestone, onWicketConfirm });

  const [battingTeamKey, setBattingTeamKey] = useState<"teamA" | "teamB">(() => {
    if (matchSetup?.tossWinner && matchSetup.tossDecision) {
      const winnerBats = matchSetup.tossDecision === "bat";
      const winnerIsA = matchSetup.tossWinner === "A";
      const aBats = winnerBats ? winnerIsA : !winnerIsA;
      return aBats ? "teamA" : "teamB";
    }
    return "teamA";
  });
  const bowlingTeamKey = battingTeamKey === "teamA" ? "teamB" : "teamA";

  const battingSquad = useMemo(() => squadFor(matchSetup, battingTeamKey), [matchSetup, battingTeamKey]);
  const bowlingSquad = useMemo(() => squadFor(matchSetup, bowlingTeamKey), [matchSetup, bowlingTeamKey]);
  const battingTeamLabel = matchSetup?.[battingTeamKey]?.shortCode || (battingTeamKey === "teamA" ? "Team A" : "Team B");
  const bowlingTeamLabel = matchSetup?.[bowlingTeamKey]?.shortCode || (bowlingTeamKey === "teamA" ? "Team A" : "Team B");

  const [advancedOpen, setAdvancedOpen] = useState(false);

  function patchBatter(who: "striker" | "nonStriker", patch: Partial<LiveState["striker"]>) {
    setLiveState((prev) => ({ ...prev, [who]: { ...prev[who], ...patch } }));
    setLiveDirty(true);
  }
  function patchBowler(patch: Partial<BowlerState>) {
    setLiveState((prev) => ({ ...prev, bowler: { ...prev.bowler, ...patch } }));
    setLiveDirty(true);
  }
  function addPointsRow() {
    setLiveState((prev) => ({ ...prev, pointsTable: [...prev.pointsTable, { team: "", played: 0, won: 0, lost: 0, nrr: "0.00", points: 0 }] }));
    setLiveDirty(true);
  }
  function patchPointsRow(index: number, patch: Partial<PointsRow>) {
    setLiveState((prev) => ({ ...prev, pointsTable: prev.pointsTable.map((row, i) => (i === index ? { ...row, ...patch } : row)) }));
    setLiveDirty(true);
  }
  function removePointsRow(index: number) {
    setLiveState((prev) => ({ ...prev, pointsTable: prev.pointsTable.filter((_, i) => i !== index) }));
    setLiveDirty(true);
  }

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
        .scorer-toast-stack { position: sticky; top: 4px; z-index: 5; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; pointer-events: none; margin-bottom: -4px; }
        .scorer-toast { font-family: var(--font-label-mono); font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 8px; animation: scorerToastIn 160ms ease-out; white-space: nowrap; }
        .scorer-dialog-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 50; animation: scorerBackdropIn 140ms ease-out; }
        .scorer-dialog { width: 340px; max-width: calc(100vw - 32px); background: var(--color-surface-container-low); border: 1px solid var(--color-border-overlay); border-radius: 14px; padding: 18px; box-shadow: 0 12px 40px rgba(0,0,0,0.4); animation: scorerDialogIn 160ms cubic-bezier(0.2, 0.8, 0.3, 1); }
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
      `}</style>

      <ToastStack toasts={engine.toasts} />
      {engine.pendingWicket && <WicketDetailDialog pending={engine.pendingWicket} onResolve={engine.resolveWicket} />}

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
        </div>
        <SmallButton onClick={() => setBattingTeamKey((k) => (k === "teamA" ? "teamB" : "teamA"))} style={{ marginLeft: "auto" }}>
          Swap Innings
        </SmallButton>
      </div>

      <div>
        <Eyebrow className="block mb-2">Who&apos;s Involved</Eyebrow>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            placeholder="Select striker"
          />
          <CrewSlot
            title="Non-Striker"
            active={engine.activeSlot === "nonStriker"}
            onActivate={() => engine.setActiveSlot("nonStriker")}
            displayName={liveState.nonStriker.name}
            imageUrl={liveState.nonStriker.imageUrl}
            statLine={liveState.nonStriker.name ? `${liveState.nonStriker.runs} (${liveState.nonStriker.balls})` : undefined}
            allPlayers={battingSquad}
            onAssign={(p) => engine.assignPlayer("nonStriker", p)}
            placeholder="Select non-striker"
          />
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
            emptyLabel="No squad loaded for this side yet — add one in Match Setup, or type names manually in Advanced below."
          />
        </div>

        <div className="flex items-center gap-2 mt-3">
          <SmallButton onClick={engine.swapStrike}>Swap Strike</SmallButton>
          <SmallButton onClick={engine.newPartnership}>New Partnership</SmallButton>
        </div>
      </div>

      <div>
        {/* CHANGED — Undo Last Ball and the Free Hit toggle now share this
            single header row (right-aligned together) instead of Undo
            living up here alone and Free Hit sitting in its own row below
            next to the extras selector. */}
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

        <div className="ball-pad">
          {[0, 1, 2, 3, 4, 6].map((r) => (
            <button key={r} type="button" className={`ball-btn ${r === 4 || r === 6 ? "ball-btn-boundary" : ""}`} onClick={() => engine.recordBall(r)}>
              {r}
            </button>
          ))}
          <button type="button" className="ball-btn ball-btn-wicket" onClick={engine.recordWicket}>
            OUT
          </button>
        </div>
        <p className="text-[9px] mt-2" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}>
          Pick an extra type first if this ball is a wide / no ball / bye / leg bye. Fours, sixes, and fifty/hundred milestones
          fire automatically. Tap OUT to record a wicket — you&apos;ll be asked who was out, the dismissal, and (for a run out)
          how many runs were completed.
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

      <details className="advanced-drawer" open={advancedOpen} onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer" style={{ fontFamily: "var(--font-label-mono)", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--color-outline)" }}>
          Advanced / Manual Correction ▸
        </summary>
        <div className="flex flex-col gap-5 pt-4">
          <div>
            <Eyebrow className="block mb-2">Score (manual override)</Eyebrow>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stepper label="Runs" value={liveState.score.runs} onChange={(v) => engine.patchLive({ score: { ...liveState.score, runs: v } })} />
              <Stepper label="Wickets" value={liveState.score.wickets} onChange={(v) => engine.patchLive({ score: { ...liveState.score, wickets: Math.min(10, v) } })} />
              <Stepper label="Overs" value={liveState.score.overs} onChange={(v) => engine.patchLive({ score: { ...liveState.score, overs: v } })} />
              <Stepper label="Balls" value={liveState.score.balls} onChange={(v) => engine.patchLive({ score: { ...liveState.score, balls: Math.min(5, v) } })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(["striker", "nonStriker"] as const).map((who) => (
              <SubCard key={who} title={who === "striker" ? "Striker *" : "Non-Striker"} accent={who === "striker" ? "#E8C468" : undefined}>
                <Input value={liveState[who].name} onChange={(v) => patchBatter(who, { name: v })} placeholder="Batter name" />
                <div className="grid grid-cols-4 gap-2">
                  <Stepper label="Runs" value={liveState[who].runs} onChange={(v) => patchBatter(who, { runs: v })} />
                  <Stepper label="Balls" value={liveState[who].balls} onChange={(v) => patchBatter(who, { balls: v })} />
                  <Stepper label="4s" value={liveState[who].fours} onChange={(v) => patchBatter(who, { fours: v })} />
                  <Stepper label="6s" value={liveState[who].sixes} onChange={(v) => patchBatter(who, { sixes: v })} />
                </div>
              </SubCard>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SubCard title="Bowler">
              <Input value={liveState.bowler.name} onChange={(v) => patchBowler({ name: v })} placeholder="Bowler name" />
              <div className="grid grid-cols-5 gap-2">
                <Stepper label="Overs" value={liveState.bowler.overs} onChange={(v) => patchBowler({ overs: v })} />
                <Stepper label="Balls" value={liveState.bowler.balls} onChange={(v) => patchBowler({ balls: Math.min(5, v) })} />
                <Stepper label="Maidens" value={liveState.bowler.maidens} onChange={(v) => patchBowler({ maidens: v })} />
                <Stepper label="Runs" value={liveState.bowler.runs} onChange={(v) => patchBowler({ runs: v })} />
                <Stepper label="Wkts" value={liveState.bowler.wickets} onChange={(v) => patchBowler({ wickets: v })} />
              </div>
            </SubCard>
            <SubCard title="Partnership">
              <div className="grid grid-cols-2 gap-2">
                <Stepper label="Runs" value={liveState.partnership.runs} onChange={(v) => engine.patchLive({ partnership: { ...liveState.partnership, runs: v } })} />
                <Stepper label="Balls" value={liveState.partnership.balls} onChange={(v) => engine.patchLive({ partnership: { ...liveState.partnership, balls: v } })} />
              </div>
            </SubCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SubCard title="Match Boundaries">
              <div className="grid grid-cols-2 gap-2">
                <Stepper label="4s" value={liveState.matchBoundaries.fours} onChange={(v) => engine.patchLive({ matchBoundaries: { ...liveState.matchBoundaries, fours: v } })} />
                <Stepper label="6s" value={liveState.matchBoundaries.sixes} onChange={(v) => engine.patchLive({ matchBoundaries: { ...liveState.matchBoundaries, sixes: v } })} />
              </div>
            </SubCard>
            <SubCard title="Tournament Boundaries">
              <div className="grid grid-cols-2 gap-2">
                <Stepper label="4s" value={liveState.tournamentBoundaries.fours} onChange={(v) => engine.patchLive({ tournamentBoundaries: { ...liveState.tournamentBoundaries, fours: v } })} />
                <Stepper label="6s" value={liveState.tournamentBoundaries.sixes} onChange={(v) => engine.patchLive({ tournamentBoundaries: { ...liveState.tournamentBoundaries, sixes: v } })} />
              </div>
            </SubCard>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Eyebrow>Points Table</Eyebrow>
              <SmallButton onClick={addPointsRow}>+ Add Row</SmallButton>
            </div>
            {liveState.pointsTable.length > 0 && (
              <div style={pointsGridStyle} className="mb-1.5">
                <FieldLabel>Team</FieldLabel>
                <FieldLabel>Pld</FieldLabel>
                <FieldLabel>Won</FieldLabel>
                <FieldLabel>Lost</FieldLabel>
                <FieldLabel>NRR</FieldLabel>
                <FieldLabel>Pts</FieldLabel>
                <span />
              </div>
            )}
            <div className="log-scroll flex flex-col gap-2" style={{ maxHeight: 240, paddingRight: 4 }}>
              {liveState.pointsTable.map((row, i) => (
                <div key={i} style={pointsGridStyle}>
                  <Input value={row.team} onChange={(v) => patchPointsRow(i, { team: v })} placeholder="Team" />
                  <Input type="number" value={row.played} onChange={(v) => patchPointsRow(i, { played: Number(v) || 0 })} />
                  <Input type="number" value={row.won} onChange={(v) => patchPointsRow(i, { won: Number(v) || 0 })} />
                  <Input type="number" value={row.lost} onChange={(v) => patchPointsRow(i, { lost: Number(v) || 0 })} />
                  <Input value={row.nrr} onChange={(v) => patchPointsRow(i, { nrr: v })} placeholder="0.00" mono />
                  <Input type="number" value={row.points} onChange={(v) => patchPointsRow(i, { points: Number(v) || 0 })} />
                  <button onClick={() => removePointsRow(i)} className="w-7 h-9 rounded-lg flex items-center justify-center" style={{ color: "var(--color-outline)", border: "1px solid var(--color-border-overlay)" }}>
                    ×
                  </button>
                </div>
              ))}
              {liveState.pointsTable.length === 0 && (
                <p className="text-[11px]" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}>
                  No rows yet — add a team to start the table.
                </p>
              )}
            </div>
          </div>
        </div>
      </details>

      <div className="flex justify-end">
        <PrimaryButton onClick={onPush} minWidth={180}>
          {pushLabel}
        </PrimaryButton>
      </div>
    </DrawerSection>
  );
}