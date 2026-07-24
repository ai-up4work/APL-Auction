"use client";
import { CheckCircle2, Radio } from "lucide-react";
import type { MatchNode, TeamNode } from "@/components/tournament/TournamentBracket";

/**
 * Read-only counterpart to MatchResultCard, for surfaces where nobody
 * should be able to enter or change a result — the public tournament
 * bracket page, spectator views, etc. Same visual structure and design
 * tokens as MatchResultCard (and TournamentBracket's own MatchCard) so a
 * public page doesn't look visually inconsistent with the admin one, but
 * there is no score input, no Save button, and no tie-break UI anywhere
 * in this component. If a match hasn't been played yet it just says so;
 * if it's completed it shows the recorded score and a winner checkmark.
 */
export default function MatchResultCardStatic({
  match,
  cardRef,
  hoveredTeamCode = null,
  onTeamHover,
  onTeamClick,
  pinnedTeamCode = null,
}: {
  match: MatchNode;
  cardRef?: (el: HTMLDivElement | null) => void;
  hoveredTeamCode?: string | null;
  onTeamHover?: (code: string | null) => void;
  onTeamClick?: (code: string) => void;
  pinnedTeamCode?: string | null;
}) {
  const isBye = match.teamB?.code === "BYE" || match.teamA?.code === "BYE";

  // Nothing assigned yet — empty slot.
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

  // One side was a bye — show plainly, nothing to score.
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

  const bothAssigned = !!match.teamA && !!match.teamB;

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

        <StaticTeamRow
          team={match.teamA}
          status={match.status}
          hoveredTeamCode={hoveredTeamCode}
          onTeamHover={onTeamHover}
          onTeamClick={onTeamClick}
          pinnedTeamCode={pinnedTeamCode}
        />
        <StaticTeamRow
          team={match.teamB}
          status={match.status}
          hoveredTeamCode={hoveredTeamCode}
          onTeamHover={onTeamHover}
          onTeamClick={onTeamClick}
          pinnedTeamCode={pinnedTeamCode}
        />

        {!bothAssigned && (
          <p className="text-center text-[9px] font-label-mono font-bold uppercase tracking-widest text-outline mt-0.5">
            Waiting for opponent
          </p>
        )}
      </div>
    </div>
  );
}

function StaticTeamRow({
  team,
  status,
  hoveredTeamCode,
  onTeamHover,
  onTeamClick,
  pinnedTeamCode,
}: {
  team: TeamNode | null;
  status: MatchNode["status"];
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
      {!isTBD && status !== "scheduled" && (
        <span className={`shrink-0 text-xs font-label-mono font-black ${team.isWinner ? "text-theme-orange" : "text-outline"}`}>
          {team.score}
        </span>
      )}
    </div>
  );
}