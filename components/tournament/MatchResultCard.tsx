// File: components/tournament/MatchResultCard.tsx
"use client";
import { useState } from "react";
import { CheckCircle2, Radio, Loader2, Pencil } from "lucide-react";
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
  /** May return a Promise — the card awaits it so the Save button can
   *  show a loading state and re-enable itself once the write settles
   *  (whether it succeeds or throws). */
  onRecordResult: (
    matchId: string,
    winner: "A" | "B",
    scoreA: number,
    scoreB: number
  ) => void | Promise<void | { ok: boolean; error?: string }>;
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
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const playable = !!match.teamA && !!match.teamB && match.teamB.code !== "BYE";
  // A completed match is no longer "locked" against edits — admins can
  // still change a wrong score/winner later. `alreadyRecorded` just
  // changes the button copy and adds a small "editing a saved result"
  // hint, it doesn't disable anything.
  const alreadyRecorded = match.status === "completed";

  if (!playable) {
    return (
      <div
        ref={cardRef}
        className="rounded-xl border border-dashed border-border-overlay bg-background/40 px-3 py-2.5"
      >
        <p className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline">{match.label}</p>
        <p className="mt-1 text-[11px] font-label-mono text-outline">
          {match.teamB?.code === "BYE" ? `${match.teamA?.name} — Bye` : "Waiting for teams"}
        </p>
      </div>
    );
  }

  // Scores can never go below 0 — clamp on every keystroke rather than
  // only checking at submit time, so the field itself never shows a
  // negative number.
  function clampNonNegative(v: string): string {
    if (v.trim() === "") return v;
    const n = Number(v);
    if (Number.isNaN(n)) return v;
    return n < 0 ? "0" : v;
  }

  function handleScoreAChange(v: string) {
    setScoreA(clampNonNegative(v));
  }

  function handleScoreBChange(v: string) {
    setScoreB(clampNonNegative(v));
  }

  async function submit() {
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (Number.isNaN(a) || Number.isNaN(b)) {
      setSubmitError("Enter a score for both teams.");
      return;
    }
    if (a < 0 || b < 0) {
      setSubmitError("Scores can't be negative.");
      return;
    }
    if (a === b) {
      setSubmitError("Scores can't be tied — there must be a winner.");
      return;
    }
    setSubmitError(null);
    setSaving(true);
    try {
      const result = await onRecordResult(match.id, a > b ? "A" : "B", a, b);
      if (result && typeof result === "object" && "ok" in result && !result.ok) {
        setSubmitError(result.error ?? "Couldn't save the result.");
      }
    } catch {
      setSubmitError("Couldn't save the result. Please try again.");
    } finally {
      setSaving(false);
    }
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
      {saving && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10 pointer-events-none">
          <Loader2 className="w-4 h-4 text-theme-orange animate-spin" />
        </div>
      )}

      <div className="relative flex flex-col gap-1.5 p-2">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline">{match.label}</p>
          <div className="flex items-center gap-1.5">
            {alreadyRecorded && !saving && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container-high text-outline border border-border-overlay text-[9px] font-black tracking-widest font-label-mono">
                <Pencil className="w-2.5 h-2.5" />
                Editable
              </span>
            )}
            {match.status === "live" && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-status-live/10 text-status-live border border-status-live/30 text-[9px] font-black tracking-widest font-label-mono">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                Live
              </span>
            )}
          </div>
        </div>

        <TeamResultRow
          team={match.teamA}
          score={scoreA}
          onScoreChange={handleScoreAChange}
          disabled={saving}
          hoveredTeamCode={hoveredTeamCode}
          onTeamHover={onTeamHover}
          onTeamClick={onTeamClick}
          pinnedTeamCode={pinnedTeamCode}
        />
        <TeamResultRow
          team={match.teamB}
          score={scoreB}
          onScoreChange={handleScoreBChange}
          disabled={saving}
          hoveredTeamCode={hoveredTeamCode}
          onTeamHover={onTeamHover}
          onTeamClick={onTeamClick}
          pinnedTeamCode={pinnedTeamCode}
        />

        {submitError && (
          <p className="text-status-live text-[10px] font-label-mono px-0.5">{submitError}</p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="mt-0.5 w-full flex items-center justify-center gap-1.5 text-[10px] font-label-mono font-bold uppercase tracking-wider rounded-lg bg-theme-orange text-on-primary py-1.5 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {saving ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving…
            </>
          ) : alreadyRecorded ? (
            "Update result"
          ) : (
            "Save result"
          )}
        </button>
      </div>
    </div>
  );
}

function TeamResultRow({
  team,
  score,
  onScoreChange,
  disabled,
  hoveredTeamCode,
  onTeamHover,
  onTeamClick,
  pinnedTeamCode,
}: {
  team: TeamNode | null;
  score: string;
  onScoreChange: (v: string) => void;
  disabled: boolean;
  hoveredTeamCode?: string | null;
  onTeamHover?: (code: string | null) => void;
  onTeamClick?: (code: string) => void;
  pinnedTeamCode?: string | null;
}) {
  if (!team) return null;
  const isHovered = hoveredTeamCode === team.code;
  const isAnyHovered = !!hoveredTeamCode;
  const isPinned = pinnedTeamCode === team.code;
  return (
    <div
      onMouseEnter={() => onTeamHover?.(team.code)}
      onMouseLeave={() => onTeamHover?.(null)}
      onClick={() => onTeamClick?.(team.code)}
      className={`flex items-center justify-between gap-2 p-1 lg:p-1.5 rounded-lg relative bg-surface-container border transition-all duration-200 ${
        onTeamClick ? "cursor-pointer" : ""
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
      <input
        type="number"
        min={0}
        value={score}
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onScoreChange(e.target.value)}
        onKeyDown={(e) => {
          // Belt-and-suspenders: block typing a minus sign at all,
          // in addition to the clamp-on-change in the parent.
          if (e.key === "-") e.preventDefault();
        }}
        className="w-10 shrink-0 text-center text-xs font-label-mono font-black rounded-md border border-border-overlay bg-background py-0.5 disabled:opacity-60"
      />
    </div>
  );
}