"use client";

import React, { useMemo, useRef, useState } from "react";
import type { LiveState, BatterState, BowlerState, PointsRow, MatchSetup, SquadPlayer } from "@/lib/overlayBus";
import { DrawerSection, Eyebrow, FieldLabel, Input, Stepper, SmallButton, PrimaryButton, SegmentedControl, SubCard } from "./ui";

// ── shared bits ─────────────────────────────────────────────────────
function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
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

// empty batter slot shape used when clearing a dismissed batter
function emptyBatterSlot(): BatterState {
  return { name: "", runs: 0, balls: 0, fours: 0, sixes: 0, imageUrl: undefined };
}

// ── Player carousel — tap OR drag a player onto a crew slot ──────────
function PlayerCarousel({
  players,
  selectedId,
  onSelect,
  emptyLabel,
}: {
  players: SquadPlayer[];
  selectedId?: string;
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
          className={`carousel-chip ${selectedId === p.id ? "is-selected" : ""}`}
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

// ── One "who's involved" slot (Striker / Non-Striker / Bowler) ───────
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

type ExtraType = "none" | "wide" | "noBall" | "bye" | "legBye";

const EXTRA_OPTIONS: { key: ExtraType; label: string }[] = [
  { key: "none", label: "Legal" },
  { key: "wide", label: "Wide" },
  { key: "noBall", label: "No Ball" },
  { key: "bye", label: "Bye" },
  { key: "legBye", label: "Leg Bye" },
];

// dismissal type used by the auto-fire Wicket Detail dialog.
type DismissalType = "bowled" | "caught" | "lbw" | "runOut" | "stumped" | "hitWicket";

const DISMISSAL_OPTIONS: { value: DismissalType; label: string }[] = [
  { value: "bowled", label: "Bowled" },
  { value: "caught", label: "Caught" },
  { value: "lbw", label: "LBW" },
  { value: "runOut", label: "Run Out" },
  { value: "stumped", label: "Stumped" },
  { value: "hitWicket", label: "Hit Wicket" },
];

// snapshot of both batters taken the instant OUT was tapped, before we
// know which of them actually got out — the dialog decides that next.
interface PendingWicket {
  strikerBefore: { name: string; runs: number; balls: number };
  nonStrikerBefore: { name: string; runs: number; balls: number };
  bowlerName: string;
  overComplete: boolean;
}

// works out the two batter slots once the admin has confirmed which end
// was dismissed. Mirrors the normal end-swap-on-over-completion logic
// from recordBall, just applied to whichever batter survived.
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

// NEW — small confirmation toast so the admin gets visual feedback when a
// moment auto-fires from the ball pad (no need to glance at the Event Log
// on the right to know it actually went out).
type Toast = { id: number; text: string; tone: "boundary" | "milestone" | "wicket" };

function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="scorer-toast-stack">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="scorer-toast"
          style={{
            background:
              t.tone === "wicket"
                ? "var(--color-error-container)"
                : t.tone === "milestone"
                ? "rgba(201,151,31,0.16)"
                : "rgba(201,151,31,0.1)",
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

// ── small batsman-out picker used inside the Wicket Detail dialog ────
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
      <span
        className="text-[12px] font-bold"
        style={{ fontFamily: "var(--font-label-mono)", color: selected ? "var(--color-error)" : "var(--color-on-surface)" }}
      >
        {name || label}
      </span>
      <span className="text-[10px]" style={{ color: "var(--color-outline)" }}>
        {runs}({balls})
      </span>
    </button>
  );
}

// ── quick dialog shown the instant OUT is tapped. Score/wicket count has
// already been recorded by then; this decides WHICH batter is actually out
// (striker or non-striker — important for run-outs) and what dismissal
// detail rides along on the wicket overlay graphic.
function WicketDetailDialog({
  pending,
  onResolve,
}: {
  pending: PendingWicket;
  onResolve: (batsmanOut: "striker" | "nonStriker", fire: boolean, dismissalType: DismissalType, fielder: string) => void;
}) {
  const [batsmanOut, setBatsmanOut] = useState<"striker" | "nonStriker">("striker");
  const [dismissalType, setDismissalType] = useState<DismissalType>("bowled");
  const [fielder, setFielder] = useState("");

  return (
    <div className="scorer-dialog-backdrop" onClick={() => onResolve(batsmanOut, false, dismissalType, fielder)}>
      <div className="scorer-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-error)" }}>
            Wicket Detail
          </span>
          <button
            type="button"
            onClick={() => onResolve(batsmanOut, false, dismissalType, fielder)}
            className="text-[11px]"
            style={{ color: "var(--color-outline)", fontFamily: "var(--font-label-mono)" }}
            title="Skip firing a wicket graphic (batter is still recorded as out)"
          >
            Skip ✕
          </button>
        </div>

        <div className="flex flex-col gap-1.5 mb-3">
          <FieldLabel>Batsman Out</FieldLabel>
          <div className="flex gap-2">
            <BatsmanOutOption
              label="Striker"
              name={pending.strikerBefore.name}
              runs={pending.strikerBefore.runs}
              balls={pending.strikerBefore.balls}
              selected={batsmanOut === "striker"}
              onClick={() => setBatsmanOut("striker")}
            />
            <BatsmanOutOption
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
            value={dismissalType}
            onChange={(e) => setDismissalType(e.target.value as DismissalType)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface)" }}
          >
            {DISMISSAL_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

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
          onClick={() => onResolve(batsmanOut, true, dismissalType, fielder)}
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
  // optional so this component still works standalone if a parent doesn't
  // wire these up. When provided, the ball pad drives the Moments overlay
  // automatically instead of requiring a separate manual click.
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
  // Which team is currently batting drives which squad the carousels show.
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

  // Which slot is "active" — tapping a carousel player fills this one.
  const [activeSlot, setActiveSlot] = useState<"striker" | "nonStriker" | "bowler">("striker");
  const [extraType, setExtraType] = useState<ExtraType>("none");
  const undoRef = useRef<LiveState | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // auto-fire plumbing: toast queue + pending wicket dialog state.
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const [pendingWicket, setPendingWicket] = useState<PendingWicket | null>(null);

  function pushToast(text: string, tone: Toast["tone"]) {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 1600);
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
  }

  function patchLive(patch: Partial<LiveState>) {
    setLiveState((prev) => ({ ...prev, ...patch }));
    setLiveDirty(true);
  }

  function assignPlayer(slot: "striker" | "nonStriker" | "bowler", player: SquadPlayer) {
    if (slot === "bowler") {
      setLiveState((prev) => ({
        ...prev,
        bowler: { ...prev.bowler, name: player.name, imageUrl: player.imageUrl },
      }));
    } else {
      setLiveState((prev) => ({
        ...prev,
        [slot]: { ...prev[slot], name: player.name, imageUrl: player.imageUrl },
      }));
    }
    setLiveDirty(true);
    // auto-advance focus so picking striker then non-striker then bowler feels like one flow
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

  // ── The core ball-by-ball engine ───────────────────────────────────
  function recordBall(runs: number) {
    snapshotForUndo();

    const isIllegal = extraType === "wide" || extraType === "noBall";
    const batterGetsRuns = extraType === "none" || extraType === "noBall";

    // capture the striker's pre-update identity/numbers so any auto-fired
    // moment below reflects the score at the instant this run actually
    // happened, not whatever liveState settles to after render.
    const strikerBefore = liveState.striker;
    const runsBefore = strikerBefore.runs;
    const newRuns = batterGetsRuns ? runsBefore + runs : runsBefore;
    const newBalls = !isIllegal ? strikerBefore.balls + 1 : strikerBefore.balls;

    setLiveState((prev) => {
      const isIllegalInner = extraType === "wide" || extraType === "noBall";
      const isByeType = extraType === "bye" || extraType === "legBye";
      const countsAsLegalBall = !isIllegalInner;
      const batterGetsRunsInner = extraType === "none" || extraType === "noBall";
      const bowlerConcedes = !isByeType; // byes/leg-byes don't count against the bowler
      const totalTeamRuns = runs + (isIllegalInner ? 1 : 0);

      // score / over progression
      let { overs, balls } = prev.score;
      let overComplete = false;
      if (countsAsLegalBall) {
        balls += 1;
        if (balls >= 6) {
          overs += 1;
          balls = 0;
          overComplete = true;
        }
      }

      // striker
      const striker: BatterState = { ...prev.striker };
      if (batterGetsRunsInner) {
        striker.runs += runs;
        if (runs === 4) striker.fours += 1;
        if (runs === 6) striker.sixes += 1;
      }
      if (countsAsLegalBall) striker.balls += 1;

      // bowler
      const bowler: BowlerState = { ...prev.bowler };
      if (bowlerConcedes) bowler.runs += totalTeamRuns;
      if (countsAsLegalBall) {
        bowler.balls += 1;
        if (bowler.balls >= 6) {
          bowler.overs += 1;
          bowler.balls = 0;
        }
      }

      // partnership — all runs while these two are together, incl. extras
      const partnership = {
        runs: prev.partnership.runs + totalTeamRuns,
        balls: prev.partnership.balls + (countsAsLegalBall ? 1 : 0),
      };

      // boundaries trackers only credit genuine batted fours/sixes
      const matchBoundaries = { ...prev.matchBoundaries };
      const tournamentBoundaries = { ...prev.tournamentBoundaries };
      if (batterGetsRunsInner && runs === 4) {
        matchBoundaries.fours += 1;
        tournamentBoundaries.fours += 1;
      }
      if (batterGetsRunsInner && runs === 6) {
        matchBoundaries.sixes += 1;
        tournamentBoundaries.sixes += 1;
      }

      // strike rotation — odd runs off a legal ball swap ends
      let finalStriker = striker;
      let finalNonStriker = prev.nonStriker;
      if (countsAsLegalBall && runs % 2 === 1) {
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
    setExtraType("none");

    // ── Auto-sync to Moments (four / six / fifty / hundred) ──────────
    if (batterGetsRuns && (runs === 4 || runs === 6)) {
      const moment = runs === 4 ? "four" : "six";
      onBoundary?.(moment, { name: strikerBefore.name, runs: newRuns, balls: newBalls });
      pushToast(`🔥 ${moment.toUpperCase()} fired — ${strikerBefore.name || "Striker"} ${newRuns}(${newBalls})`, "boundary");
    }
    if (batterGetsRuns && runsBefore < 50 && newRuns >= 50) {
      onMilestone?.("fifty", { name: strikerBefore.name, runs: newRuns, balls: newBalls, label: strikerBefore.name || "Striker" });
      pushToast(`🏏 FIFTY fired — ${strikerBefore.name || "Striker"}`, "milestone");
    }
    if (batterGetsRuns && runsBefore < 100 && newRuns >= 100) {
      onMilestone?.("hundred", { name: strikerBefore.name, runs: newRuns, balls: newBalls, label: strikerBefore.name || "Striker" });
      pushToast(`💯 HUNDRED fired — ${strikerBefore.name || "Striker"}`, "milestone");
    }
  }

  // CHANGED — no longer assumes the striker is the one out. The score,
  // over/ball progression, and bowler's wicket tally are recorded
  // immediately (those don't depend on which end was dismissed), but
  // clearing a batter slot is deferred until the Wicket Detail dialog
  // tells us whether it was the striker or non-striker.
  function recordWicket() {
    snapshotForUndo();

    const strikerBefore = { ...liveState.striker };
    const nonStrikerBefore = { ...liveState.nonStriker };
    const bowlerName = liveState.bowler.name;
    const overComplete = liveState.score.balls + 1 >= 6;

    setLiveState((prev) => {
      let { overs, balls } = prev.score;
      balls += 1;
      if (balls >= 6) {
        overs += 1;
        balls = 0;
      }
      const bowler = { ...prev.bowler, wickets: prev.bowler.wickets + 1, balls: prev.bowler.balls + 1 };
      if (bowler.balls >= 6) {
        bowler.overs += 1;
        bowler.balls = 0;
      }
      return {
        ...prev,
        score: { ...prev.score, wickets: Math.min(10, prev.score.wickets + 1), overs, balls },
        bowler,
        partnership: { runs: 0, balls: 0 },
        // striker/nonStriker deliberately left untouched here — resolved
        // once the dialog confirms who's actually out (see below).
      };
    });
    setLiveDirty(true);
    setExtraType("none");

    // ask which end was dismissed before touching either batter slot
    setPendingWicket({ strikerBefore, nonStrikerBefore, bowlerName, overComplete });
  }

  function handleWicketResolve(
    batsmanOut: "striker" | "nonStriker",
    fire: boolean,
    dismissalType: DismissalType,
    fielder: string
  ) {
    if (!pendingWicket) return;
    const { strikerBefore, nonStrikerBefore, bowlerName, overComplete } = pendingWicket;

    const resolved = resolveBatterSlots(batsmanOut, strikerBefore as BatterState, nonStrikerBefore as BatterState, overComplete);
    setLiveState((prev) => ({ ...prev, striker: resolved.striker, nonStriker: resolved.nonStriker }));
    setLiveDirty(true);
    // whichever slot is now empty needs a new batter picked next
    setActiveSlot(resolved.striker.name === "" ? "striker" : "nonStriker");

    if (fire) {
      const dismissedBatter = batsmanOut === "striker" ? strikerBefore : nonStrikerBefore;
      onWicketConfirm?.({
        batsmanOut,
        batter: dismissedBatter,
        dismissalType,
        fielder,
        bowlerName,
      });
      pushToast(`🎯 WICKET fired — ${dismissedBatter.name || (batsmanOut === "striker" ? "Striker" : "Non-striker")} ${dismissalType}`, "wicket");
    }

    setPendingWicket(null);
  }

  // ── Advanced (manual) helpers — unchanged behavior, tucked away ────
  function patchBatter(who: "striker" | "nonStriker", patch: Partial<BatterState>) {
    setLiveState((prev) => ({ ...prev, [who]: { ...prev[who], ...patch } }));
    setLiveDirty(true);
  }
  function patchBowler(patch: Partial<BowlerState>) {
    setLiveState((prev) => ({ ...prev, bowler: { ...prev.bowler, ...patch } }));
    setLiveDirty(true);
  }
  function addPointsRow() {
    setLiveState((prev) => ({
      ...prev,
      pointsTable: [...prev.pointsTable, { team: "", played: 0, won: 0, lost: 0, nrr: "0.00", points: 0 }],
    }));
    setLiveDirty(true);
  }
  function patchPointsRow(index: number, patch: Partial<PointsRow>) {
    setLiveState((prev) => ({
      ...prev,
      pointsTable: prev.pointsTable.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
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
      {/* small inline stylesheet for the toast + dialog entrance animations.
          Scoped to this component only; no global CSS touched. */}
      <style>{`
        @keyframes scorerToastIn {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scorerDialogIn {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes scorerBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .scorer-toast-stack {
          position: sticky;
          top: 4px;
          z-index: 5;
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: flex-end;
          pointer-events: none;
          margin-bottom: -4px;
        }
        .scorer-toast {
          font-family: var(--font-label-mono);
          font-size: 11px;
          font-weight: 700;
          padding: 6px 12px;
          border-radius: 8px;
          animation: scorerToastIn 160ms ease-out;
          white-space: nowrap;
        }
        .scorer-dialog-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          animation: scorerBackdropIn 140ms ease-out;
        }
        .scorer-dialog {
          width: 340px;
          max-width: calc(100vw - 32px);
          background: var(--color-surface-container-low);
          border: 1px solid var(--color-border-overlay);
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.4);
          animation: scorerDialogIn 160ms cubic-bezier(0.2, 0.8, 0.3, 1);
        }
      `}</style>

      <ToastStack toasts={toasts} />

      {pendingWicket && <WicketDetailDialog pending={pendingWicket} onResolve={handleWicketResolve} />}

      {/* ── Big scoreboard readout ──────────────────────────────────── */}
      <div className="scoreboard-strip">
        <div className="scoreboard-main">
          <span className="scoreboard-runs">{liveState.score.runs}</span>
          <span className="scoreboard-wkts">/{liveState.score.wickets}</span>
        </div>
        <div className="scoreboard-meta">
          <span>
            {liveState.score.overs}.{liveState.score.balls} ov
          </span>
          <span>·</span>
          <span>RR {runRate}</span>
          <span>·</span>
          <span>{battingTeamLabel} batting</span>
        </div>
        <SmallButton onClick={() => setBattingTeamKey((k) => (k === "teamA" ? "teamB" : "teamA"))} style={{ marginLeft: "auto" }}>
          Swap Innings
        </SmallButton>
      </div>

      {/* ── Who's involved ──────────────────────────────────────────── */}
      <div>
        <Eyebrow className="block mb-2">Who&apos;s Involved</Eyebrow>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CrewSlot
            title="Striker *"
            accentColor="#E8C468"
            active={activeSlot === "striker"}
            onActivate={() => setActiveSlot("striker")}
            displayName={liveState.striker.name}
            imageUrl={liveState.striker.imageUrl}
            statLine={liveState.striker.name ? `${liveState.striker.runs} (${liveState.striker.balls})` : undefined}
            allPlayers={battingSquad}
            onAssign={(p) => assignPlayer("striker", p)}
            placeholder="Select striker"
          />
          <CrewSlot
            title="Non-Striker"
            active={activeSlot === "nonStriker"}
            onActivate={() => setActiveSlot("nonStriker")}
            displayName={liveState.nonStriker.name}
            imageUrl={liveState.nonStriker.imageUrl}
            statLine={liveState.nonStriker.name ? `${liveState.nonStriker.runs} (${liveState.nonStriker.balls})` : undefined}
            allPlayers={battingSquad}
            onAssign={(p) => assignPlayer("nonStriker", p)}
            placeholder="Select non-striker"
          />
        </div>

        <div className="mt-3">
          <CrewSlot
            title={`Bowler (${bowlingTeamLabel})`}
            active={activeSlot === "bowler"}
            onActivate={() => setActiveSlot("bowler")}
            displayName={liveState.bowler.name}
            imageUrl={liveState.bowler.imageUrl}
            statLine={
              liveState.bowler.name
                ? `${liveState.bowler.overs}.${liveState.bowler.balls}-${liveState.bowler.maidens}-${liveState.bowler.runs}-${liveState.bowler.wickets}`
                : undefined
            }
            allPlayers={bowlingSquad}
            onAssign={(p) => assignPlayer("bowler", p)}
            placeholder="Select bowler"
          />
        </div>

        <div className="mt-3">
          <Eyebrow className="block mb-1">{activeSlot === "bowler" ? `Pick from ${bowlingTeamLabel}` : `Pick from ${battingTeamLabel}`}</Eyebrow>
          <PlayerCarousel
            players={activeSlot === "bowler" ? bowlingSquad : battingSquad}
            selectedId={undefined}
            onSelect={(p) => assignPlayer(activeSlot, p)}
            emptyLabel="No squad loaded for this side yet — add one in Match Setup, or type names manually in Advanced below."
          />
        </div>

        <div className="flex items-center gap-2 mt-3">
          <SmallButton onClick={swapStrike}>Swap Strike</SmallButton>
          <SmallButton onClick={newPartnership}>New Partnership</SmallButton>
        </div>
      </div>

      {/* ── Ball-by-ball entry pad ──────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Eyebrow>This Ball</Eyebrow>
          {canUndo && (
            <SmallButton onClick={undo} style={{ color: "var(--color-warning)" }}>
              ↶ Undo Last Ball
            </SmallButton>
          )}
        </div>

        <div className="mb-3">
          <SegmentedControl options={EXTRA_OPTIONS} value={extraType} onChange={(v) => setExtraType(v as ExtraType)} />
        </div>

        <div className="ball-pad">
          {[0, 1, 2, 3, 4, 6].map((r) => (
            <button key={r} type="button" className={`ball-btn ${r === 4 || r === 6 ? "ball-btn-boundary" : ""}`} onClick={() => recordBall(r)}>
              {r}
            </button>
          ))}
          <button type="button" className="ball-btn ball-btn-wicket" onClick={recordWicket}>
            OUT
          </button>
        </div>
        <p className="text-[9px] mt-2" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}>
          Pick an extra type above first if this ball is a wide / no ball / bye / leg bye, then tap the run scored. Fours, sixes, and
          fifty/hundred milestones fire their overlay graphic automatically. Tap OUT to record a wicket — you&apos;ll be asked whether
          the striker or non-striker was dismissed, plus dismissal detail, before the wicket graphic fires.
        </p>
      </div>

      {/* ── Live summary strip (read-only, auto-computed) ────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="summary-tile">
          <FieldLabel>Partnership</FieldLabel>
          <span className="summary-tile-value">
            {liveState.partnership.runs} ({liveState.partnership.balls})
          </span>
        </div>
        <div className="summary-tile">
          <FieldLabel>Match 4s / 6s</FieldLabel>
          <span className="summary-tile-value">
            {liveState.matchBoundaries.fours} / {liveState.matchBoundaries.sixes}
          </span>
        </div>
        <div className="summary-tile">
          <FieldLabel>Tourn. 4s / 6s</FieldLabel>
          <span className="summary-tile-value">
            {liveState.tournamentBoundaries.fours} / {liveState.tournamentBoundaries.sixes}
          </span>
        </div>
        <div className="summary-tile">
          <FieldLabel>Bowler Figures</FieldLabel>
          <span className="summary-tile-value">
            {liveState.bowler.overs}.{liveState.bowler.balls}-{liveState.bowler.maidens}-{liveState.bowler.runs}-{liveState.bowler.wickets}
          </span>
        </div>
      </div>

      {/* ── Advanced / manual correction (old controls, kept intact) ─ */}
      <details className="advanced-drawer" open={advancedOpen} onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}>
        <summary
          className="cursor-pointer"
          style={{ fontFamily: "var(--font-label-mono)", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--color-outline)" }}
        >
          Advanced / Manual Correction ▸
        </summary>
        <div className="flex flex-col gap-5 pt-4">
          <div>
            <Eyebrow className="block mb-2">Score (manual override)</Eyebrow>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stepper label="Runs" value={liveState.score.runs} onChange={(v) => patchLive({ score: { ...liveState.score, runs: v } })} />
              <Stepper
                label="Wickets"
                value={liveState.score.wickets}
                onChange={(v) => patchLive({ score: { ...liveState.score, wickets: Math.min(10, v) } })}
              />
              <Stepper label="Overs" value={liveState.score.overs} onChange={(v) => patchLive({ score: { ...liveState.score, overs: v } })} />
              <Stepper
                label="Balls"
                value={liveState.score.balls}
                onChange={(v) => patchLive({ score: { ...liveState.score, balls: Math.min(5, v) } })}
              />
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
                <Stepper
                  label="Runs"
                  value={liveState.partnership.runs}
                  onChange={(v) => patchLive({ partnership: { ...liveState.partnership, runs: v } })}
                />
                <Stepper
                  label="Balls"
                  value={liveState.partnership.balls}
                  onChange={(v) => patchLive({ partnership: { ...liveState.partnership, balls: v } })}
                />
              </div>
            </SubCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SubCard title="Match Boundaries">
              <div className="grid grid-cols-2 gap-2">
                <Stepper
                  label="4s"
                  value={liveState.matchBoundaries.fours}
                  onChange={(v) => patchLive({ matchBoundaries: { ...liveState.matchBoundaries, fours: v } })}
                />
                <Stepper
                  label="6s"
                  value={liveState.matchBoundaries.sixes}
                  onChange={(v) => patchLive({ matchBoundaries: { ...liveState.matchBoundaries, sixes: v } })}
                />
              </div>
            </SubCard>
            <SubCard title="Tournament Boundaries">
              <div className="grid grid-cols-2 gap-2">
                <Stepper
                  label="4s"
                  value={liveState.tournamentBoundaries.fours}
                  onChange={(v) => patchLive({ tournamentBoundaries: { ...liveState.tournamentBoundaries, fours: v } })}
                />
                <Stepper
                  label="6s"
                  value={liveState.tournamentBoundaries.sixes}
                  onChange={(v) => patchLive({ tournamentBoundaries: { ...liveState.tournamentBoundaries, sixes: v } })}
                />
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
                  <button
                    onClick={() => removePointsRow(i)}
                    className="w-7 h-9 rounded-lg flex items-center justify-center"
                    style={{ color: "var(--color-outline)", border: "1px solid var(--color-border-overlay)" }}
                  >
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