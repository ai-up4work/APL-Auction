"use client";

import React, { useMemo, useRef, useState } from "react";
import type { LiveState, BatterState, BowlerState, PointsRow, MatchSetup, SquadPlayer } from "@/lib/overlayBus";

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

function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="field-col">
      <span className="field-label">{label}</span>
      <div className="stepper">
        <button type="button" className="stepper-btn" onClick={() => onChange(Math.max(min, value - step))}>
          −
        </button>
        <input
          type="number"
          className="stepper-input"
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        />
        <button type="button" className="stepper-btn" onClick={() => onChange(value + step)}>
          +
        </button>
      </div>
    </div>
  );
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
      <p className="font-mono-geist text-[10px] text-white/30 py-1">
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
        <span className="field-label" style={accentColor ? { color: accentColor } : undefined}>
          {title}
        </span>
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

export default function LiveStatePanel({
  liveState,
  setLiveState,
  setLiveDirty,
  liveDirty,
  onPush,
  pushLabel,
  matchSetup,
}: {
  liveState: LiveState;
  setLiveState: React.Dispatch<React.SetStateAction<LiveState>>;
  setLiveDirty: (v: boolean) => void;
  liveDirty: boolean;
  onPush: () => void;
  pushLabel: string;
  matchSetup?: MatchSetup;
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

    setLiveState((prev) => {
      const isIllegal = extraType === "wide" || extraType === "noBall";
      const isByeType = extraType === "bye" || extraType === "legBye";
      const countsAsLegalBall = !isIllegal;
      const batterGetsRuns = extraType === "none" || extraType === "noBall";
      const bowlerConcedes = !isByeType; // byes/leg-byes don't count against the bowler
      const totalTeamRuns = runs + (isIllegal ? 1 : 0);

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
      if (batterGetsRuns) {
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
      if (batterGetsRuns && runs === 4) {
        matchBoundaries.fours += 1;
        tournamentBoundaries.fours += 1;
      }
      if (batterGetsRuns && runs === 6) {
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
  }

  function recordWicket() {
    snapshotForUndo();
    setLiveState((prev) => {
      let { overs, balls } = prev.score;
      balls += 1;
      let overComplete = false;
      if (balls >= 6) {
        overs += 1;
        balls = 0;
        overComplete = true;
      }
      const bowler = { ...prev.bowler, wickets: prev.bowler.wickets + 1, balls: prev.bowler.balls + 1 };
      if (bowler.balls >= 6) {
        bowler.overs += 1;
        bowler.balls = 0;
      }
      let nonStriker = prev.nonStriker;
      if (overComplete) nonStriker = prev.striker; // outgoing slot is empty either way
      return {
        ...prev,
        score: { ...prev.score, wickets: Math.min(10, prev.score.wickets + 1), overs, balls },
        striker: { name: "", runs: 0, balls: 0, fours: 0, sixes: 0, imageUrl: undefined },
        nonStriker,
        bowler,
        partnership: { runs: 0, balls: 0 },
      };
    });
    setLiveDirty(true);
    setExtraType("none");
    setActiveSlot("striker"); // prompt admin straight to pick the new batter
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
    <details className="rack-panel p-5 drawer" open>
      <summary>
        <div className="flex items-center gap-3">
          <div className="eyebrow">3 · Scorer</div>
          <span className="font-mono-geist text-[9px] text-white/30 normal-case tracking-normal">tap the ball, we do the maths</span>
          {liveDirty && <span className="dirty-dot" title="Unpushed changes" />}
        </div>
        <span className="drawer-chevron">▸</span>
      </summary>

      <div className="drawer-body flex flex-col gap-6">
        {/* ── Big scoreboard readout ──────────────────────────────────── */}
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
          <button
            type="button"
            className="fx-btn fx-toggle-off"
            onClick={() => setBattingTeamKey((k) => (k === "teamA" ? "teamB" : "teamA"))}
            title="Flip which team is currently batting (use at the change of innings)"
          >
            Swap Innings
          </button>
        </div>

        {/* ── Who's involved ──────────────────────────────────────────── */}
        <div>
          <div className="eyebrow mb-2">Who's Involved</div>
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
            <span className="font-mono-geist text-[9px] text-white/40 uppercase tracking-widest">
              {activeSlot === "bowler" ? `Pick from ${bowlingTeamLabel}` : `Pick from ${battingTeamLabel}`}
            </span>
            <PlayerCarousel
              players={activeSlot === "bowler" ? bowlingSquad : battingSquad}
              selectedId={undefined}
              onSelect={(p) => assignPlayer(activeSlot, p)}
              emptyLabel="No squad loaded for this side yet — add one in Match Setup, or type names manually in Advanced below."
            />
          </div>

          <div className="flex items-center gap-2 mt-2">
            <button onClick={swapStrike} className="fx-btn fx-toggle-off">
              Swap Strike
            </button>
            <button onClick={newPartnership} className="fx-btn fx-toggle-off">
              New Partnership
            </button>
          </div>
        </div>

        {/* ── Ball-by-ball entry pad ──────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="eyebrow">This Ball</div>
            {canUndo && (
              <button onClick={undo} className="fx-btn fx-toggle-off" style={{ color: "#f0b429" }}>
                ↶ Undo Last Ball
              </button>
            )}
          </div>

          <div className="segment-group mb-2">
            {(["none", "wide", "noBall", "bye", "legBye"] as ExtraType[]).map((ex) => (
              <button
                key={ex}
                type="button"
                className={`segment-btn ${extraType === ex ? "is-active" : ""}`}
                onClick={() => setExtraType(ex)}
              >
                {ex === "none" ? "Legal" : ex === "noBall" ? "No Ball" : ex === "legBye" ? "Leg Bye" : ex === "wide" ? "Wide" : "Bye"}
              </button>
            ))}
          </div>

          <div className="ball-pad">
            {[0, 1, 2, 3, 4, 6].map((r) => (
              <button
                key={r}
                type="button"
                className={`ball-btn ${r === 4 || r === 6 ? "ball-btn-boundary" : ""}`}
                onClick={() => recordBall(r)}
              >
                {r}
              </button>
            ))}
            <button type="button" className="ball-btn ball-btn-wicket" onClick={recordWicket}>
              OUT
            </button>
          </div>
          <p className="font-mono-geist text-[9px] text-white/30 mt-2">
            Pick an extra type above first if this ball is a wide / no ball / bye / leg bye, then tap the run scored. Tap
            OUT to record a wicket — you'll be prompted to pick the new batter above. For the animated wicket graphic
            with dismissal type and fielder, use the WICKET button in Moments below.
          </p>
        </div>

        {/* ── Live summary strip (read-only, auto-computed) ──────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="summary-tile">
            <span className="field-label">Partnership</span>
            <span className="summary-tile-value">
              {liveState.partnership.runs} ({liveState.partnership.balls})
            </span>
          </div>
          <div className="summary-tile">
            <span className="field-label">Match 4s / 6s</span>
            <span className="summary-tile-value">
              {liveState.matchBoundaries.fours} / {liveState.matchBoundaries.sixes}
            </span>
          </div>
          <div className="summary-tile">
            <span className="field-label">Tourn. 4s / 6s</span>
            <span className="summary-tile-value">
              {liveState.tournamentBoundaries.fours} / {liveState.tournamentBoundaries.sixes}
            </span>
          </div>
          <div className="summary-tile">
            <span className="field-label">Bowler Figures</span>
            <span className="summary-tile-value">
              {liveState.bowler.overs}.{liveState.bowler.balls}-{liveState.bowler.maidens}-{liveState.bowler.runs}-
              {liveState.bowler.wickets}
            </span>
          </div>
        </div>

        {/* ── Advanced / manual correction (old controls, kept intact) ─ */}
        <details className="advanced-drawer" open={advancedOpen} onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="font-mono-geist text-[9px] text-white/40 uppercase tracking-widest cursor-pointer">
            Advanced / Manual Correction ▸
          </summary>
          <div className="flex flex-col gap-6 pt-4">
            <div>
              <div className="eyebrow mb-2">Score (manual override)</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <NumberStepper label="Runs" value={liveState.score.runs} onChange={(v) => patchLive({ score: { ...liveState.score, runs: v } })} />
                <NumberStepper
                  label="Wickets"
                  value={liveState.score.wickets}
                  onChange={(v) => patchLive({ score: { ...liveState.score, wickets: Math.min(10, v) } })}
                />
                <NumberStepper label="Overs" value={liveState.score.overs} onChange={(v) => patchLive({ score: { ...liveState.score, overs: v } })} />
                <NumberStepper
                  label="Balls"
                  value={liveState.score.balls}
                  onChange={(v) => patchLive({ score: { ...liveState.score, balls: Math.min(5, v) } })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(["striker", "nonStriker"] as const).map((who) => (
                <div key={who} className="batter-card">
                  <div className="eyebrow" style={{ color: who === "striker" ? "#E8C468" : undefined }}>
                    {who === "striker" ? "Striker *" : "Non-Striker"}
                  </div>
                  <input
                    className="text-input"
                    value={liveState[who].name}
                    onChange={(e) => patchBatter(who, { name: e.target.value })}
                    placeholder="Batter name"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    <NumberStepper label="Runs" value={liveState[who].runs} onChange={(v) => patchBatter(who, { runs: v })} />
                    <NumberStepper label="Balls" value={liveState[who].balls} onChange={(v) => patchBatter(who, { balls: v })} />
                    <NumberStepper label="4s" value={liveState[who].fours} onChange={(v) => patchBatter(who, { fours: v })} />
                    <NumberStepper label="6s" value={liveState[who].sixes} onChange={(v) => patchBatter(who, { sixes: v })} />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bowler-card">
                <div className="eyebrow">Bowler</div>
                <input
                  className="text-input"
                  value={liveState.bowler.name}
                  onChange={(e) => patchBowler({ name: e.target.value })}
                  placeholder="Bowler name"
                />
                <div className="grid grid-cols-5 gap-2">
                  <NumberStepper label="Overs" value={liveState.bowler.overs} onChange={(v) => patchBowler({ overs: v })} />
                  <NumberStepper label="Balls" value={liveState.bowler.balls} onChange={(v) => patchBowler({ balls: Math.min(5, v) })} />
                  <NumberStepper label="Maidens" value={liveState.bowler.maidens} onChange={(v) => patchBowler({ maidens: v })} />
                  <NumberStepper label="Runs" value={liveState.bowler.runs} onChange={(v) => patchBowler({ runs: v })} />
                  <NumberStepper label="Wkts" value={liveState.bowler.wickets} onChange={(v) => patchBowler({ wickets: v })} />
                </div>
              </div>
              <div className="bowler-card">
                <div className="eyebrow">Partnership</div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberStepper
                    label="Runs"
                    value={liveState.partnership.runs}
                    onChange={(v) => patchLive({ partnership: { ...liveState.partnership, runs: v } })}
                  />
                  <NumberStepper
                    label="Balls"
                    value={liveState.partnership.balls}
                    onChange={(v) => patchLive({ partnership: { ...liveState.partnership, balls: v } })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bowler-card">
                <div className="eyebrow">Match Boundaries</div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberStepper
                    label="4s"
                    value={liveState.matchBoundaries.fours}
                    onChange={(v) => patchLive({ matchBoundaries: { ...liveState.matchBoundaries, fours: v } })}
                  />
                  <NumberStepper
                    label="6s"
                    value={liveState.matchBoundaries.sixes}
                    onChange={(v) => patchLive({ matchBoundaries: { ...liveState.matchBoundaries, sixes: v } })}
                  />
                </div>
              </div>
              <div className="bowler-card">
                <div className="eyebrow">Tournament Boundaries</div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberStepper
                    label="4s"
                    value={liveState.tournamentBoundaries.fours}
                    onChange={(v) => patchLive({ tournamentBoundaries: { ...liveState.tournamentBoundaries, fours: v } })}
                  />
                  <NumberStepper
                    label="6s"
                    value={liveState.tournamentBoundaries.sixes}
                    onChange={(v) => patchLive({ tournamentBoundaries: { ...liveState.tournamentBoundaries, sixes: v } })}
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="eyebrow">Points Table</div>
                <button onClick={addPointsRow} className="fx-btn fx-toggle-off">
                  + Add Row
                </button>
              </div>
              {liveState.pointsTable.length > 0 && (
                <div className="points-row-grid mb-1.5">
                  <span className="field-label">Team</span>
                  <span className="field-label">Pld</span>
                  <span className="field-label">Won</span>
                  <span className="field-label">Lost</span>
                  <span className="field-label">NRR</span>
                  <span className="field-label">Pts</span>
                  <span />
                </div>
              )}
              <div className="panel-scroll points-scroll flex flex-col gap-2">
                {liveState.pointsTable.map((row, i) => (
                  <div key={i} className="points-row-grid">
                    <input className="text-input" value={row.team} onChange={(e) => patchPointsRow(i, { team: e.target.value })} placeholder="Team" />
                    <input
                      className="text-input"
                      type="number"
                      value={row.played}
                      onChange={(e) => patchPointsRow(i, { played: Number(e.target.value) || 0 })}
                    />
                    <input
                      className="text-input"
                      type="number"
                      value={row.won}
                      onChange={(e) => patchPointsRow(i, { won: Number(e.target.value) || 0 })}
                    />
                    <input
                      className="text-input"
                      type="number"
                      value={row.lost}
                      onChange={(e) => patchPointsRow(i, { lost: Number(e.target.value) || 0 })}
                    />
                    <input className="text-input" value={row.nrr} onChange={(e) => patchPointsRow(i, { nrr: e.target.value })} placeholder="0.00" />
                    <input
                      className="text-input"
                      type="number"
                      value={row.points}
                      onChange={(e) => patchPointsRow(i, { points: Number(e.target.value) || 0 })}
                    />
                    <button onClick={() => removePointsRow(i)} className="icon-btn">
                      ×
                    </button>
                  </div>
                ))}
                {liveState.pointsTable.length === 0 && (
                  <p className="font-mono-geist text-[11px] text-white/30">No rows yet — add a team to start the table.</p>
                )}
              </div>
            </div>
          </div>
        </details>

        <div className="flex justify-end">
          <button onClick={onPush} className="talk-btn" style={{ minWidth: 180 }}>
            {pushLabel}
          </button>
        </div>
      </div>
    </details>
  );
}