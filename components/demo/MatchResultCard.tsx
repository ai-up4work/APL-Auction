// File: components/demo/MatchResultCard.tsx
"use client";
import { useState } from "react";
import { CheckCircle2, Radio } from "lucide-react";
import type { MatchNode, TeamNode } from "@/components/tournament/TournamentBracket";

function parseScore(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

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
  /** Lets a parent (e.g. a bracket canvas) measure this card's real DOM position
   *  so it can draw connector lines to/from it. */
  cardRef?: (el: HTMLDivElement | null) => void;
  /** Currently highlighted team code, for hover-to-trace-a-team highlighting. */
  hoveredTeamCode?: string | null;
  onTeamHover?: (code: string | null) => void;
  /** Click a team to pin the highlight on it, so it stays lit while you scroll. */
  onTeamClick?: (code: string) => void;
  /** The currently pinned team, if any — shown with a small pin marker. */
  pinnedTeamCode?: string | null;
}) {
  const [scoreA, setScoreA] = useState(match.teamA?.score?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match.teamB?.score?.toString() ?? "");

  // A bye slot (one side permanently BYE) never needs score entry — it's
  // already resolved by the generator. A "both empty" slot has nothing to
  // show at all yet. Anything else — including "only one side has
  // advanced so far" — should still render whichever team(s) are known.
  const isBye = match.teamA?.code === "BYE" || match.teamB?.code === "BYE";
  const bothKnown = !!match.teamA && !!match.teamB;
  const playable = bothKnown && !isBye;
  const hasAnyTeam = !!match.teamA || !!match.teamB;
  const locked = match.status === "completed";

  // Both fields must be non-negative integers before anything can submit.
  // Parsed once per render and reused by both the tie-check and the
  // enabled/disabled state of the Save button, so they can never disagree.
  const parsedA = parseScore(scoreA);
  const parsedB = parseScore(scoreB);
  const bothValid = parsedA !== null && parsedB !== null;
  const isTie = bothValid && parsedA === parsedB;

  function submitWithWinner(winner: "A" | "B") {
    if (parsedA === null || parsedB === null) return;
    onRecordResult(match.id, winner, parsedA, parsedB);
  }

  function submit() {
    // Normal path — only reachable when scores differ, so the higher
    // score unambiguously determines the winner.
    if (parsedA === null || parsedB === null || parsedA === parsedB) return;
    onRecordResult(match.id, parsedA > parsedB ? "A" : "B", parsedA, parsedB);
  }

  if (!hasAnyTeam) {
    return (
      <div
        ref={cardRef}
        className="rounded-xl border border-dashed border-border-overlay bg-background/40 px-3 py-2.5"
      >
        <p className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline">{match.label}</p>
        <p className="mt-1 text-[11px] font-label-mono text-outline">Waiting for teams</p>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
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
          {isBye && (
            <span className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline">
              Bye
            </span>
          )}
        </div>

        <TeamResultRow
          team={match.teamA}
          score={scoreA}
          onScoreChange={setScoreA}
          locked={locked}
          showScore={playable}
          hoveredTeamCode={hoveredTeamCode}
          onTeamHover={onTeamHover}
          onTeamClick={onTeamClick}
          pinnedTeamCode={pinnedTeamCode}
        />
        <TeamResultRow
          team={match.teamB}
          score={scoreB}
          onScoreChange={setScoreB}
          locked={locked}
          showScore={playable}
          hoveredTeamCode={hoveredTeamCode}
          onTeamHover={onTeamHover}
          onTeamClick={onTeamClick}
          pinnedTeamCode={pinnedTeamCode}
        />

        {playable && !locked && isTie && (
          <div className="mt-0.5 flex flex-col gap-1.5 rounded-lg border border-theme-orange/30 bg-theme-orange/5 p-2">
            <p className="text-[9px] font-label-mono font-bold uppercase tracking-wide text-theme-orange text-center">
              Scores are tied — who won?
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => submitWithWinner("A")}
                className="flex-1 text-[10px] font-label-mono font-bold uppercase tracking-wider rounded-lg bg-surface-container border border-border-overlay py-1.5 hover:border-theme-orange/50 active:scale-[0.98] transition-all truncate px-1"
              >
                {match.teamA?.code ?? "A"}
              </button>
              <button
                type="button"
                onClick={() => submitWithWinner("B")}
                className="flex-1 text-[10px] font-label-mono font-bold uppercase tracking-wider rounded-lg bg-surface-container border border-border-overlay py-1.5 hover:border-theme-orange/50 active:scale-[0.98] transition-all truncate px-1"
              >
                {match.teamB?.code ?? "B"}
              </button>
            </div>
          </div>
        )}

        {playable && !locked && !isTie && (
          <button
            type="button"
            onClick={submit}
            disabled={!bothValid}
            className="mt-0.5 w-full text-[10px] font-label-mono font-bold uppercase tracking-wider rounded-lg bg-theme-orange text-on-primary py-1.5 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:hover:opacity-40 disabled:cursor-not-allowed"
          >
            Save result
          </button>
        )}
      </div>
    </div>
  );
}

function TeamResultRow({
  team,
  score,
  onScoreChange,
  locked,
  showScore,
  hoveredTeamCode,
  onTeamHover,
  onTeamClick,
  pinnedTeamCode,
}: {
  team: TeamNode | null;
  score: string;
  onScoreChange: (v: string) => void;
  locked: boolean;
  /** Only render the editable score box once both sides are real teams
   *  (i.e. the match is actually playable) — a lone advanced team with a
   *  still-TBD opponent has nothing to score yet. */
  showScore: boolean;
  hoveredTeamCode?: string | null;
  onTeamHover?: (code: string | null) => void;
  onTeamClick?: (code: string) => void;
  pinnedTeamCode?: string | null;
}) {
  // Empty slot — the other side of this match hasn't been decided yet.
  if (!team) {
    return (
      <div className="flex items-center gap-2 p-1 lg:p-1.5 rounded-lg relative bg-background/40 border border-dashed border-border-overlay">
        <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-background border border-dashed border-outline/40 font-label-mono font-black text-[10px] text-outline">
          ?
        </span>
        <span className="font-label-mono font-bold text-xs uppercase tracking-wide text-outline">
          To Be Determined
        </span>
      </div>
    );
  }

  const isBye = team.code === "BYE";
  const isHovered = !isBye && hoveredTeamCode === team.code;
  const isAnyHovered = !!hoveredTeamCode;
  const isPinned = !isBye && pinnedTeamCode === team.code;

  return (
    <div
      onMouseEnter={() => !isBye && onTeamHover?.(team.code)}
      onMouseLeave={() => !isBye && onTeamHover?.(null)}
      onClick={() => !isBye && onTeamClick?.(team.code)}
      className={`flex items-center justify-between gap-2 p-1 lg:p-1.5 rounded-lg relative bg-surface-container border transition-all duration-200 ${
        !isBye && onTeamClick ? "cursor-pointer" : ""
      } ${
        isHovered
          ? "scale-[1.02] border-theme-orange/40 bg-surface-container-high shadow-[0_0_20px_rgba(201,151,31,0.15)]"
          : isAnyHovered
          ? "opacity-30 blur-[0.5px] border-border-overlay"
          : isPinned
          ? "border-theme-orange/50 bg-surface-container-high"
          : "border-border-overlay"
      }`}
    >
      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md" style={{ backgroundColor: team.color }} />
      <div className="flex items-center gap-2 pl-1.5 min-w-0">
        <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-background overflow-hidden font-label-mono font-black text-[10px]">
          {team.logo ? (
            <img src={team.logo} alt="" className="w-full h-full object-cover p-0.5" />
          ) : (
            <span style={{ color: team.color }}>{team.code}</span>
          )}
        </span>
        <span
          className={`font-label-mono font-bold text-xs uppercase tracking-wide truncate ${
            team.isWinner ? "text-theme-orange" : "text-on-surface"
          }`}
        >
          {team.name}
        </span>
        {team.isWinner && <CheckCircle2 className="w-3.5 h-3.5 text-theme-orange shrink-0" strokeWidth={3} />}
        {isPinned && (
          <span className="text-[8px] font-label-mono font-black uppercase tracking-widest text-theme-orange border border-theme-orange/40 rounded px-1 py-0.5 shrink-0">
            Pinned
          </span>
        )}
      </div>
      {showScore && (
        <input
          type="number"
          min={0}
          step={1}
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