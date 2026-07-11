// File: components/admin/MatchResultCard.tsx
"use client";
import { useState } from "react";
import type { MatchNode } from "@/components/tournament/TournamentBracket";

export default function MatchResultCard({
  match,
  onRecordResult,
}: {
  match: MatchNode;
  onRecordResult: (matchId: string, winner: "A" | "B", scoreA: number, scoreB: number) => void;
}) {
  const [scoreA, setScoreA] = useState(match.teamA?.score?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match.teamB?.score?.toString() ?? "");
  const playable = !!match.teamA && !!match.teamB && match.teamB.code !== "BYE";
  const locked = match.status === "completed";

  if (!playable) {
    return (
      <div className="rounded-lg border border-dashed border-border-overlay bg-background/40 px-3 py-2.5 text-[11px] font-label-mono text-outline">
        <p className="font-bold uppercase tracking-wide">{match.label}</p>
        <p className="mt-0.5">
          {match.teamB?.code === "BYE" ? `${match.teamA?.name} — Bye` : "Waiting for teams"}
        </p>
      </div>
    );
  }

  function submit() {
    const a = Number(scoreA), b = Number(scoreB);
    if (Number.isNaN(a) || Number.isNaN(b) || a === b) return;
    onRecordResult(match.id, a > b ? "A" : "B", a, b);
  }

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${locked ? "border-theme-orange/30 bg-theme-orange/5" : "border-border-overlay bg-surface-container"}`}>
      <p className="text-[10px] font-label-mono font-bold uppercase tracking-wide text-outline mb-1.5">{match.label}</p>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`text-xs font-label-mono truncate ${match.teamA?.isWinner ? "text-theme-orange font-bold" : "text-on-surface"}`}>
          {match.teamA?.name}
        </span>
        <input
          type="number"
          value={scoreA}
          disabled={locked}
          onChange={(e) => setScoreA(e.target.value)}
          className="w-12 text-center text-xs rounded border border-border-overlay bg-background py-0.5 disabled:opacity-60"
        />
      </div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-xs font-label-mono truncate ${match.teamB?.isWinner ? "text-theme-orange font-bold" : "text-on-surface"}`}>
          {match.teamB?.name}
        </span>
        <input
          type="number"
          value={scoreB}
          disabled={locked}
          onChange={(e) => setScoreB(e.target.value)}
          className="w-12 text-center text-xs rounded border border-border-overlay bg-background py-0.5 disabled:opacity-60"
        />
      </div>
      {!locked && (
        <button
          type="button"
          onClick={submit}
          className="w-full text-[10px] font-label-mono font-bold uppercase tracking-wider rounded bg-theme-orange text-on-primary py-1 hover:opacity-90 transition-opacity"
        >
          Save result
        </button>
      )}
    </div>
  );
}