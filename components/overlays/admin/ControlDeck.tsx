// components/overlays/admin/ControlDeck.tsx
"use client";

import React from "react";
import type { LiveState, BatterState, BowlerState, PointsRow } from "@/lib/overlayBus";

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

export default function LiveStatePanel({
  liveState,
  setLiveState,
  setLiveDirty,
  liveDirty,
  onPush,
  pushLabel,
}: {
  liveState: LiveState;
  setLiveState: React.Dispatch<React.SetStateAction<LiveState>>;
  setLiveDirty: (v: boolean) => void;
  liveDirty: boolean;
  onPush: () => void;
  pushLabel: string;
}) {
  function patchLive(patch: Partial<LiveState>) {
    setLiveState((prev) => ({ ...prev, ...patch }));
    setLiveDirty(true);
  }

  function patchBatter(who: "striker" | "nonStriker", patch: Partial<BatterState>) {
    setLiveState((prev) => ({ ...prev, [who]: { ...prev[who], ...patch } }));
    setLiveDirty(true);
  }

  function patchBowler(patch: Partial<BowlerState>) {
    setLiveState((prev) => ({ ...prev, bowler: { ...prev.bowler, ...patch } }));
    setLiveDirty(true);
  }

  function swapStrike() {
    setLiveState((prev) => ({ ...prev, striker: prev.nonStriker, nonStriker: prev.striker }));
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

  return (
    <details className="rack-panel p-5 drawer" open>
      <summary>
        <div className="flex items-center gap-3">
          <div className="eyebrow">3 · Live State</div>
          <span className="font-mono-geist text-[9px] text-white/30 normal-case tracking-normal">updates ball by ball</span>
          {liveDirty && <span className="dirty-dot" title="Unpushed changes" />}
        </div>
        <span className="drawer-chevron">▸</span>
      </summary>

      <div className="drawer-body flex flex-col gap-6">
        {/* Score */}
        <div>
          <div className="eyebrow mb-2">Score</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <NumberStepper label="Runs" value={liveState.score.runs} onChange={(v) => patchLive({ score: { ...liveState.score, runs: v } })} />
            <NumberStepper
              label="Wickets"
              value={liveState.score.wickets}
              min={0}
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

        {/* Batters */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="eyebrow">Batters at the Crease</div>
            <button onClick={swapStrike} className="fx-btn fx-toggle-off">
              Swap Strike
            </button>
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
        </div>

        {/* Bowler + partnership */}
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

        {/* Boundaries */}
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

        {/* Points table */}
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

        <div className="flex justify-end">
          <button onClick={onPush} className="talk-btn" style={{ minWidth: 180 }}>
            {pushLabel}
          </button>
        </div>
      </div>
    </details>
  );
}