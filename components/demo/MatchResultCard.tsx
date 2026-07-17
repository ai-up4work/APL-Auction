// File: components/demo/tournament/MatchResultCard.tsx
"use client";
import { useState } from "react";
import { CheckCircle2, Radio } from "lucide-react";
import type { MatchNode, TeamNode } from "@/components/tournament/TournamentBracket";

export default function MatchResultCard({
  match,
  onRecordResult,
  cardRef,
  hoveredTeamCode = null,
  onTeamHover,
  onTeamClick,
  pinnedTeamCode = null,
}: {
  match: MatchNode;
  onRecordResult: (matchId: string, winner: "A" | "B", scoreA: number, scoreB: number) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
  hoveredTeamCode?: string | null;
  onTeamHover?: (code: string | null) => void;
  onTeamClick?: (code: string) => void;
  pinnedTeamCode?: string | null;
}) {
  const [scoreA, setScoreA] = useState(match.teamA?.score?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match.teamB?.score?.toString() ?? "");

  const isBye = match.teamB?.code === "BYE" || match.teamA?.code === "BYE";
  const bothAssigned = !!match.teamA && !!match.teamB;
  const playable = bothAssigned && !isBye;
  const locked = match.status === "completed";

  // Nothing assigned yet at all — genuinely empty slot, nothing to show.
  if (!match.teamA && !match.teamB) {
    return (
      <div
        ref={cardRef}
        id={`match-card-${match.id}`}
        className="rounded-xl border border-dashed border-border-overlay bg-background/40 px-3 py-2.5"
      >
        <p className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline">{match.label}</p>
        <p className="mt-1 text-[11px] font-label-mono text-outline">Waiting for teams</p>
      </div>
    );
  }

  // One real feeder was a bye — auto-completed by the generator, just
  // show the bye result plainly, nothing to play or type in.
  if (isBye) {
    const realTeam = match.teamA?.code !== "BYE" ? match.teamA : match.teamB;
    return (
      <div
        ref={cardRef}
        id={`match-card-${match.id}`}
        className="rounded-xl border border-dashed border-border-overlay bg-background/40 px-3 py-2.5"
      >
        <p className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline">{match.label}</p>
        <p className="mt-1 text-[11px] font-label-mono text-outline">{realTeam?.name ?? "TBD"} — Bye</p>
      </div>
    );
  }

  const numA = Number(scoreA);
  const numB = Number(scoreB);
  const bothFilled = scoreA.trim() !== "" && scoreB.trim() !== "" && !Number.isNaN(numA) && !Number.isNaN(numB);
  const isTie = bothFilled && numA === numB;

  function submitDecisive() {
    if (!bothFilled || isTie) return;
    onRecordResult(match.id, numA > numB ? "A" : "B", numA, numB);
  }

  /** Explicit manual override for a tied scoreline — the person (or the
   *  bot, driving the same UI) picks who actually advances. Scores are
   *  recorded as-entered; the winner flag is what matters for bracket
   *  progression. */
  function submitTieBreak(winner: "A" | "B") {
    onRecordResult(match.id, winner, numA, numB);
  }

  return (
    <div
      ref={cardRef}
      id={`match-card-${match.id}`}
      className={`w-full rounded-xl relative overflow-hidden bg-surface-container-low border transition-colors duration-200 ${
        match.status === "live"
          ? "border-status-live/40 shadow-[0_0_24px_rgba(255,180,171,0.12)]"
          : "border-border-overlay shadow-2xl"
      }`}
    >
      {match.status === "live" && (
        <div className="absolute inset-0 bg-gradient-to-r from-status-live/5 to-theme-orange/5 pointer-events-none animate-pulse" />
      )}

      <div className="relative flex flex-col gap-1.5 p-2">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline">{match.label}</p>
          {match.status === "live" && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-status-live/10 text-status-live border border-status-live/30 text-[9px] font-black tracking-widest font-label-mono">
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              Live
            </span>
          )}
        </div>

        <TeamResultRow
          matchId={match.id}
          slot="A"
          team={match.teamA}
          score={scoreA}
          onScoreChange={setScoreA}
          locked={locked}
          playable={playable}
          hoveredTeamCode={hoveredTeamCode}
          onTeamHover={onTeamHover}
          onTeamClick={onTeamClick}
          pinnedTeamCode={pinnedTeamCode}
        />
        <TeamResultRow
          matchId={match.id}
          slot="B"
          team={match.teamB}
          score={scoreB}
          onScoreChange={setScoreB}
          locked={locked}
          playable={playable}
          hoveredTeamCode={hoveredTeamCode}
          onTeamHover={onTeamHover}
          onTeamClick={onTeamClick}
          pinnedTeamCode={pinnedTeamCode}
        />

        {/* Only one side has shown up so far — nothing to score yet, but
           we still show who's already through instead of hiding them
           behind a generic "waiting" message. */}
        {!playable && (
          <p className="text-center text-[9px] font-label-mono font-bold uppercase tracking-widest text-outline mt-0.5">
            Waiting for opponent
          </p>
        )}

        {playable && !locked && isTie && (
          <div className="mt-0.5 flex flex-col gap-1">
            <p className="text-center text-[9px] font-label-mono font-bold uppercase tracking-widest text-status-live">
              Scores tied — who won?
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                id={`tie-btn-${match.id}-A`}
                onClick={() => submitTieBreak("A")}
                className="flex-1 text-[10px] font-label-mono font-bold uppercase tracking-wider rounded-lg bg-surface-container-high border border-theme-orange/40 text-theme-orange py-1.5 hover:opacity-90 active:scale-[0.98] transition-all truncate"
              >
                {match.teamA?.code} wins
              </button>
              <button
                type="button"
                id={`tie-btn-${match.id}-B`}
                onClick={() => submitTieBreak("B")}
                className="flex-1 text-[10px] font-label-mono font-bold uppercase tracking-wider rounded-lg bg-surface-container-high border border-theme-orange/40 text-theme-orange py-1.5 hover:opacity-90 active:scale-[0.98] transition-all truncate"
              >
                {match.teamB?.code} wins
              </button>
            </div>
          </div>
        )}

        {playable && !locked && !isTie && (
          <button
            type="button"
            id={`save-btn-${match.id}`}
            onClick={submitDecisive}
            disabled={!bothFilled}
            className="mt-0.5 w-full text-[10px] font-label-mono font-bold uppercase tracking-wider rounded-lg bg-theme-orange text-on-primary py-1.5 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save result
          </button>
        )}
      </div>
    </div>
  );
}

function TeamResultRow({
  matchId,
  slot,
  team,
  score,
  onScoreChange,
  locked,
  playable,
  hoveredTeamCode,
  onTeamHover,
  onTeamClick,
  pinnedTeamCode,
}: {
  matchId: string;
  slot: "A" | "B";
  team: TeamNode | null;
  score: string;
  onScoreChange: (v: string) => void;
  locked: boolean;
  playable: boolean;
  hoveredTeamCode?: string | null;
  onTeamHover?: (code: string | null) => void;
  onTeamClick?: (code: string) => void;
  pinnedTeamCode?: string | null;
}) {
  const isTBD = !team;
  const isHovered = !!team && hoveredTeamCode === team.code;
  const isAnyHovered = !!hoveredTeamCode;
  const isPinned = !!team && pinnedTeamCode === team.code;

  return (
    <div
      onMouseEnter={() => team && onTeamHover?.(team.code)}
      onMouseLeave={() => onTeamHover?.(null)}
      onClick={() => team && onTeamClick?.(team.code)}
      className={`flex items-center justify-between gap-2 p-1 lg:p-1.5 rounded-lg relative border transition-all duration-200 ${
        isTBD ? "bg-background/40 border-dashed border-border-overlay text-outline" : "bg-surface-container border-border-overlay"
      } ${!isTBD && onTeamClick ? "cursor-pointer" : ""} ${
        isHovered
          ? "scale-[1.02] border-theme-orange/40 bg-surface-container-high shadow-[0_0_20px_rgba(201,151,31,0.15)]"
          : isAnyHovered && !isTBD
          ? "opacity-30 blur-[0.5px] border-border-overlay"
          : isPinned
          ? "border-theme-orange/50 bg-surface-container-high"
          : ""
      }`}
    >
      {!isTBD && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md" style={{ backgroundColor: team.color }} />}
      <div className="flex items-center gap-2 pl-1.5 min-w-0">
        {!isTBD ? (
          <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-background overflow-hidden font-label-mono font-black text-[10px]">
            {team.logo ? (
              <img src={team.logo} alt="" className="w-full h-full object-cover p-0.5" />
            ) : (
              <span style={{ color: team.color }}>{team.code}</span>
            )}
          </span>
        ) : (
          <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-background border border-dashed border-outline/40 font-label-mono font-black text-[10px] text-outline">
            ?
          </span>
        )}
        <span
          className={`font-label-mono font-bold text-xs uppercase tracking-wide truncate ${
            isTBD ? "text-outline font-medium" : team.isWinner ? "text-theme-orange" : "text-on-surface"
          }`}
        >
          {isTBD ? "To Be Determined" : team.name}
        </span>
        {!isTBD && team.isWinner && <CheckCircle2 className="w-3.5 h-3.5 text-theme-orange shrink-0" strokeWidth={3} />}
        {isPinned && (
          <span className="text-[8px] font-label-mono font-black uppercase tracking-widest text-theme-orange border border-theme-orange/40 rounded px-1 py-0.5 shrink-0">
            Pinned
          </span>
        )}
      </div>
      {/* Score box only makes sense once both sides are real teams —
         showing an editable "0" box next to a TBD row implied you could
         score a match that isn't playable yet. */}
      {playable && (
        <input
          id={`score-input-${matchId}-${slot}`}
          type="number"
          value={score}
          disabled={locked}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onScoreChange(e.target.value)}
          className="w-10 shrink-0 text-center text-xs font-label-mono font-black rounded-md border border-border-overlay bg-background py-0.5 disabled:opacity-60"
        />
      )}
    </div>
  );
}