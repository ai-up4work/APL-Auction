"use client";

import React, { useState } from "react";
import type { LiveState, BowlerState, PointsRow } from "@/lib/overlayBus";
import { Eyebrow, FieldLabel, Input, Stepper, SmallButton } from "./ui";

const pointsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 0.55fr 0.55fr 0.55fr 0.65fr 0.55fr 28px",
  gap: 8,
  alignItems: "center",
};

// A tiny labeled wrapper so every field in this panel explains itself in
// plain English — this whole component is meant to be usable by someone
// who has never scored a cricket match, so "what does NRR mean" etc.
// shouldn't block them from fixing a typo.
function FieldGroup({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)" }}
    >
      <span
        className="block text-[11px] font-black uppercase tracking-widest mb-1"
        style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface)" }}
      >
        {title}
      </span>
      {hint && (
        <p className="text-[11px] mb-3 leading-snug" style={{ color: "var(--color-outline)" }}>
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

export default function ManualCorrectionPanel({
  liveState,
  setLiveState,
  setLiveDirty,
  patchLive,
}: {
  liveState: LiveState;
  setLiveState: React.Dispatch<React.SetStateAction<LiveState>>;
  setLiveDirty: (v: boolean) => void;
  patchLive: (patch: Partial<LiveState>) => void;
}) {
  const [open, setOpen] = useState(false);

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

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--color-border-overlay)", background: "var(--color-surface-glass)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex flex-col">
          <span
            className="text-[12px] font-black uppercase tracking-widest"
            style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface)" }}
          >
            🛠 Fix a Mistake / Set Up Manually
          </span>
          <span className="text-[11px] mt-0.5" style={{ color: "var(--color-outline)" }}>
            You normally don&apos;t need this — the ball pad above updates everything for you.
          </span>
        </span>
        <span
          className="text-[11px] font-bold flex-shrink-0 ml-3"
          style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}
        >
          {open ? "Hide ▴" : "Open ▾"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-4 px-4 pb-5">
          <p className="text-[11px] leading-snug" style={{ color: "var(--color-outline)" }}>
            Only come in here if something looks wrong on screen — like a score that&apos;s off, a
            misspelled name, or you need to type a player in by hand because their squad list is
            empty. Every box below directly edits what the overlay shows.
          </p>

          <FieldGroup
            title="Total Score"
            hint="Runs and wickets for the batting team right now, and how far into the innings they are."
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stepper label="Runs Scored" value={liveState.score.runs} onChange={(v) => patchLive({ score: { ...liveState.score, runs: v } })} />
              <Stepper label="Wickets Fallen" value={liveState.score.wickets} onChange={(v) => patchLive({ score: { ...liveState.score, wickets: Math.min(10, v) } })} />
              <Stepper label="Overs Completed" value={liveState.score.overs} onChange={(v) => patchLive({ score: { ...liveState.score, overs: v } })} />
              <Stepper label="Balls This Over" value={liveState.score.balls} onChange={(v) => patchLive({ score: { ...liveState.score, balls: Math.min(5, v) } })} />
            </div>
          </FieldGroup>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup title="Striker" hint="The batter currently facing the bowler.">
              <div className="flex flex-col gap-2">
                <Input value={liveState.striker.name} onChange={(v) => patchBatter("striker", { name: v })} placeholder="Batter name" />
                <div className="grid grid-cols-4 gap-2">
                  <Stepper label="Runs" value={liveState.striker.runs} onChange={(v) => patchBatter("striker", { runs: v })} />
                  <Stepper label="Balls Faced" value={liveState.striker.balls} onChange={(v) => patchBatter("striker", { balls: v })} />
                  <Stepper label="4s" value={liveState.striker.fours} onChange={(v) => patchBatter("striker", { fours: v })} />
                  <Stepper label="6s" value={liveState.striker.sixes} onChange={(v) => patchBatter("striker", { sixes: v })} />
                </div>
              </div>
            </FieldGroup>
            <FieldGroup title="Non-Striker" hint="The batter waiting at the other end.">
              <div className="flex flex-col gap-2">
                <Input value={liveState.nonStriker.name} onChange={(v) => patchBatter("nonStriker", { name: v })} placeholder="Batter name" />
                <div className="grid grid-cols-4 gap-2">
                  <Stepper label="Runs" value={liveState.nonStriker.runs} onChange={(v) => patchBatter("nonStriker", { runs: v })} />
                  <Stepper label="Balls Faced" value={liveState.nonStriker.balls} onChange={(v) => patchBatter("nonStriker", { balls: v })} />
                  <Stepper label="4s" value={liveState.nonStriker.fours} onChange={(v) => patchBatter("nonStriker", { fours: v })} />
                  <Stepper label="6s" value={liveState.nonStriker.sixes} onChange={(v) => patchBatter("nonStriker", { sixes: v })} />
                </div>
              </div>
            </FieldGroup>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup title="Bowler" hint="Overs-Maidens-Runs-Wickets, the standard bowling figures line.">
              <div className="flex flex-col gap-2">
                <Input value={liveState.bowler.name} onChange={(v) => patchBowler({ name: v })} placeholder="Bowler name" />
                <div className="grid grid-cols-5 gap-2">
                  <Stepper label="Overs" value={liveState.bowler.overs} onChange={(v) => patchBowler({ overs: v })} />
                  <Stepper label="Balls" value={liveState.bowler.balls} onChange={(v) => patchBowler({ balls: Math.min(5, v) })} />
                  <Stepper label="Maidens" value={liveState.bowler.maidens} onChange={(v) => patchBowler({ maidens: v })} />
                  <Stepper label="Runs Given" value={liveState.bowler.runs} onChange={(v) => patchBowler({ runs: v })} />
                  <Stepper label="Wickets" value={liveState.bowler.wickets} onChange={(v) => patchBowler({ wickets: v })} />
                </div>
              </div>
            </FieldGroup>
            <FieldGroup title="Partnership" hint="Runs added together by the current pair of batters.">
              <div className="grid grid-cols-2 gap-2">
                <Stepper label="Runs" value={liveState.partnership.runs} onChange={(v) => patchLive({ partnership: { ...liveState.partnership, runs: v } })} />
                <Stepper label="Balls" value={liveState.partnership.balls} onChange={(v) => patchLive({ partnership: { ...liveState.partnership, balls: v } })} />
              </div>
            </FieldGroup>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup title="Boundaries This Match">
              <div className="grid grid-cols-2 gap-2">
                <Stepper label="4s" value={liveState.matchBoundaries.fours} onChange={(v) => patchLive({ matchBoundaries: { ...liveState.matchBoundaries, fours: v } })} />
                <Stepper label="6s" value={liveState.matchBoundaries.sixes} onChange={(v) => patchLive({ matchBoundaries: { ...liveState.matchBoundaries, sixes: v } })} />
              </div>
            </FieldGroup>
            <FieldGroup title="Boundaries This Tournament">
              <div className="grid grid-cols-2 gap-2">
                <Stepper label="4s" value={liveState.tournamentBoundaries.fours} onChange={(v) => patchLive({ tournamentBoundaries: { ...liveState.tournamentBoundaries, fours: v } })} />
                <Stepper label="6s" value={liveState.tournamentBoundaries.sixes} onChange={(v) => patchLive({ tournamentBoundaries: { ...liveState.tournamentBoundaries, sixes: v } })} />
              </div>
            </FieldGroup>
          </div>

          <FieldGroup title="Points Table" hint="One row per team. NRR = Net Run Rate, a tie-breaker stat — leave it as 0.00 if you're not tracking it.">
            <div className="flex items-center justify-end mb-2">
              <SmallButton onClick={addPointsRow}>+ Add Team Row</SmallButton>
            </div>
            {liveState.pointsTable.length > 0 && (
              <div style={pointsGridStyle} className="mb-1.5">
                <FieldLabel>Team</FieldLabel>
                <FieldLabel>Played</FieldLabel>
                <FieldLabel>Won</FieldLabel>
                <FieldLabel>Lost</FieldLabel>
                <FieldLabel>NRR</FieldLabel>
                <FieldLabel>Points</FieldLabel>
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
          </FieldGroup>
        </div>
      )}
    </div>
  );
}