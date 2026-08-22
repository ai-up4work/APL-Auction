// app/components/overlays/admin/new/ScoringSectionParts.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { createPortal } from "react-dom";
import CricketBall from "@/components/overlays/shared/CricketBall";
import {
  EXTRA_OPTIONS,
  NO_BALL_RUN_ORIGIN_OPTIONS,
  getValidDismissalOptions,
  isDismissalRestricted,
} from "@/hooks/useLiveScoringEngine";
import type { PendingWicket, DismissalType } from "@/hooks/useLiveScoringEngine";
import type { LiveState, SquadPlayer } from "@/lib/overlayBus";

export const GOLD_GRADIENT = "linear-gradient(135deg,#A87815,#E8C468)";

/* ───────────────────────── fielder requirement rules ───────────────────────── */
const FIELDER_REQUIRED_DISMISSALS = new Set<DismissalType>(["caught", "runOut", "stumped"]);
const FIELDER_OPTIONAL_DISMISSALS = new Set<DismissalType>(["obstructingField"]);

type FielderRequirement = "required" | "optional" | "none";

export function fielderRequirement(dismissalType: DismissalType): FielderRequirement {
  if (FIELDER_REQUIRED_DISMISSALS.has(dismissalType)) return "required";
  if (FIELDER_OPTIONAL_DISMISSALS.has(dismissalType)) return "optional";
  return "none";
}

/* ───────────────────────── shared small types ───────────────────────── */

export interface BatterLike {
  name: string;
  runs: number;
  balls: number;
}

export interface RoleInfo {
  role: "striker" | "nonStriker" | "bowler";
}

export interface LegacyMatchSetup {
  teamA: string;
  teamAColor: string;
  teamAlogo?: string;
  teamB: string;
  teamBColor: string;
  teamBlogo?: string;
  venue: string;
  format: string;
  matchTitle: string;
  tossWinner: string;
  tossElected: string;
  // Full (non-shortcode) team names, e.g. "Ratmalana Aviators" alongside
  // teamA/teamB which are shortcode-preferred display labels, e.g. "RAV".
  // Needed because liveState.matchResult.winningTeamName can come back
  // holding either form depending on how the result was produced (live
  // engine vs. an imported/simulated match record whose resultText embeds
  // the full name) — matching against only one form silently drops the
  // logo/name the moment the other form shows up. See resolveWinningTeamKey.
  teamAFullName?: string;
  teamBFullName?: string;
}

/* ───────────────────────── helpers ───────────────────────── */

export function initials(name?: string): string {
  return (
    (name || "")
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "—"
  );
}

export function Icon({
  name,
  className = "",
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}

// ───────────────────────── team-name resolution helpers ─────────────────────────
//
// UPDATED — this used to be the ONLY way the winning team's logo/color/name
// were resolved, by matching liveState.matchResult.winningTeamName against
// the two teams' labels. The problem: winningTeamName can legitimately
// arrive empty/undefined depending on how the engine (or an imported/
// simulated match record) populated matchResult — when that happens,
// normalizeTeamName(winningTeamName) is "" and this function correctly
// bails out to null immediately. No amount of smarter string matching
// fixes a name that never arrives.
//
// This is now used ONLY as a fallback. The primary resolution path is
// resolveWinningTeamKeyFromMethod / resolveWinningTeamKeyFromScore below,
// which don't depend on winningTeamName at all — and ScoringSection now
// derives the DISPLAYED winner name from that same resolved key instead
// of reading liveState.matchResult?.winningTeamName directly, which is
// what was causing the win banner to show "Match Complete" with no team
// name even though the logo/color resolved correctly.

export function normalizeTeamName(s?: string): string {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function resolveWinningTeamKey(
  winningTeamName: string | undefined,
  teamALabels: { shortLabel: string; fullName?: string },
  teamBLabels: { shortLabel: string; fullName?: string }
): "teamA" | "teamB" | null {
  const name = normalizeTeamName(winningTeamName);
  if (!name) return null;

  const aCandidates = [teamALabels.shortLabel, teamALabels.fullName]
    .map(normalizeTeamName)
    .filter((s) => s.length > 0);
  const bCandidates = [teamBLabels.shortLabel, teamBLabels.fullName]
    .map(normalizeTeamName)
    .filter((s) => s.length > 0);

  // Pass 1 — exact match against any candidate label.
  if (aCandidates.some((c) => c === name)) return "teamA";
  if (bCandidates.some((c) => c === name)) return "teamB";

  // Pass 2 — substring match either direction, against any candidate.
  const aMatch = aCandidates.some((c) => name.includes(c) || c.includes(name));
  const bMatch = bCandidates.some((c) => name.includes(c) || c.includes(name));

  if (aMatch && !bMatch) return "teamA";
  if (bMatch && !aMatch) return "teamB";

  // Ambiguous (matched both, or neither) — don't guess wrong, just
  // fall back to no logo/color/name and leave a trace in dev.
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(
      "[ScoringSection] Could not resolve winningTeamName to a team:",
      { winningTeamName, teamALabels, teamBLabels }
    );
  }
  return null;
}

// Primary, robust winner resolution that doesn't depend on
// winningTeamName being present or spelled consistently at all. It uses
// the match's own reported result *method* ("runs" | "wickets" | "tie")
// together with battingTeamKey / bowlingTeamKey, which are authoritative
// (computed by the parent from toss + innings number). A match completes
// during the second innings, so at the moment it ends:
//   - battingTeamKey is always the chasing side
//   - bowlingTeamKey is always the side that batted first (defending)
// "Won by wickets" always means the chasing side won -> battingTeamKey.
// "Won by runs" always means the defending side won -> bowlingTeamKey.
// "Tie" has no winner, so this returns null and the tie UI (🤝) is used.
export function resolveWinningTeamKeyFromMethod(
  method: string | undefined,
  battingTeamKey: "teamA" | "teamB",
  bowlingTeamKey: "teamA" | "teamB"
): "teamA" | "teamB" | null {
  if (method === "wickets") return battingTeamKey;
  if (method === "runs") return bowlingTeamKey;
  return null;
}

// The most robust layer of all. Some matches reach matchComplete=true
// WITHOUT ever going through the live engine's own endInnings()/
// setMatchResult flow — e.g. a match imported or simulated from an
// external record (score/target/resultText fields, no matchResult object
// at all). For those, liveState.matchResult can be entirely undefined,
// which means BOTH resolveWinningTeamKeyFromMethod (no `method`) and
// resolveWinningTeamKey (no `winningTeamName`) return null.
//
// This function sidesteps matchResult completely and derives the winner
// from the raw scoring state ScoringSection already has as props/state:
//   - second-innings (chasing) score >= target -> chasing team won
//     (battingTeamKey, since the chasing side is always the one
//     batting in the 2nd innings)
//   - innings over (10 wickets down, or overs/balls used up per
//     maxOvers) and short of target by more than 1 run -> defending
//     team won (bowlingTeamKey)
//   - exactly 1 short when the innings ends -> tie (no winner)
//   - anything else (2nd innings still in progress, or no target set)
//     -> can't determine yet, return null
export function resolveWinningTeamKeyFromScore(
  liveState: LiveState,
  isSecondInnings: boolean,
  maxOvers: number | undefined,
  battingTeamKey: "teamA" | "teamB",
  bowlingTeamKey: "teamA" | "teamB"
): "teamA" | "teamB" | null {
  if (!isSecondInnings || liveState.target === undefined) return null;

  const runs = liveState.score.runs;
  const target = liveState.target;
  if (runs >= target) return battingTeamKey;

  const wickets = liveState.score.wickets;
  const ballsBowled = liveState.score.overs * 6 + liveState.score.balls;
  const totalBalls = maxOvers !== undefined ? maxOvers * 6 : undefined;
  const inningsOver = wickets >= 10 || (totalBalls !== undefined && ballsBowled >= totalBalls);
  if (!inningsOver) return null;

  if (runs === target - 1) return null; // tie — no winner
  return bowlingTeamKey;
}

export const OVER_BALL_STYLES: Record<
  "wicket" | "boundary" | "extra" | "dot",
  { fill: string; seamColor: string; textColor: string }
> = {
  wicket: {
    fill: "radial-gradient(circle at 32% 26%, #f87171 0%, #dc2626 45%, #7f1d1d 85%, #450a0a 100%)",
    seamColor: "rgba(255,255,255,0.35)",
    textColor: "#fff",
  },
  boundary: {
    fill: "radial-gradient(circle at 32% 26%, #f3da8e 0%, #d4a52e 45%, #a8781a 85%, #6b4b0e 100%)",
    seamColor: "rgba(255,255,255,0.4)",
    textColor: "#3a2a04",
  },
  extra: {
    fill: "radial-gradient(circle at 32% 26%, #93c5fd 0%, #3b82f6 45%, #1e3a8a 85%, #0f1f42 100%)",
    seamColor: "rgba(255,255,255,0.4)",
    textColor: "#fff",
  },
  dot: {
    fill: "radial-gradient(circle at 32% 26%, #6b7280 0%, #454b54 45%, #24272c 85%, #17181b 100%)",
    seamColor: "rgba(255,255,255,0.3)",
    textColor: "#d1d5db",
  },
};

export type OverEntry = string | number | null;

export function normalizeOverEntry(raw: unknown): OverEntry {
  if (raw == null) return null;
  if (raw === "W") return "W";
  if (raw === "wd" || raw === "Wd") return "Wd";
  if (raw === "nb" || raw === "Nb") return "Nb";
  if (raw === "nb+b") return "Nb+B";
  if (raw === "nb+lb") return "Nb+LB";
  if (raw === "b" || raw === "By" || raw === "bye") return "By";
  if (raw === "lb" || raw === "Lb" || raw === "legBye") return "Lb";
  if (raw === ".") return 0;
  const n = Number(raw);
  return Number.isNaN(n) ? String(raw) : n;
}

export function ballOutcome(entry: OverEntry): { kind: "wicket" | "extra" | "boundary" | "dot"; label: string } {
  if (entry === "W") return { kind: "wicket", label: "W" };
  if (entry === "Wd") return { kind: "extra", label: "wd" };
  if (entry === "Nb") return { kind: "extra", label: "nb" };
  if (entry === "Nb+B") return { kind: "extra", label: "nb+b" };
  if (entry === "Nb+LB") return { kind: "extra", label: "nb+lb" };
  if (entry === "Lb") return { kind: "extra", label: "lb" };
  if (entry === "By") return { kind: "extra", label: "b" };
  if (entry === 4 || entry === 6) return { kind: "boundary", label: String(entry) };
  if (entry === 0) return { kind: "dot", label: "0" };
  return { kind: "dot", label: String(entry ?? "") };
}

export function OverBall({ entry }: { entry: OverEntry }) {
  if (entry == null) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full shrink-0"
        style={{ width: 20, height: 20, border: "1px dashed rgba(255,255,255,0.15)" }}
      />
    );
  }
  const { kind, label } = ballOutcome(entry);
  const style = OVER_BALL_STYLES[kind];
  const isCombo = label.length > 3;
  return (
    <CricketBall size={20} fill={style.fill} seamColor={style.seamColor}>
      <span style={{ fontSize: isCombo ? 6.5 : 9, fontWeight: 700, color: style.textColor, lineHeight: 1 }}>{label}</span>
    </CricketBall>
  );
}

export function PlayerPickerSheet({
  title,
  teamLabel,
  players,
  onSelect,
  onClose,
  dismissedNames,
  roleByName,
}: {
  title: string;
  teamLabel: string;
  players: SquadPlayer[] | undefined;
  onSelect: (p: SquadPlayer) => void;
  onClose: () => void;
  dismissedNames?: Set<string>;
  roleByName?: Map<string, RoleInfo>;
}) {
  return (
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:w-[520px] sm:max-w-[calc(100vw-64px)] max-h-[78vh] overflow-y-auto custom-scrollbar bg-surface-container-lowest border border-white/10 rounded-t-2xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex flex-col min-w-0">
            <span className="font-archivo text-sm font-bold uppercase italic">{title}</span>
            <span className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.1em] mt-0.5">{teamLabel}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player picker"
            className="h-7 w-7 rounded-full flex items-center justify-center border border-white/10 text-on-surface-variant shrink-0"
          >
            <Icon name="close" style={{ fontSize: 15 }} />
          </button>
        </div>

        {!players || players.length === 0 ? (
          <p className="font-mono-geist text-[10px] text-on-surface-variant text-center py-6">
            No squad loaded — set this team&apos;s squad in Match Setup.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {players.map((p) => {
              const isOut = !!dismissedNames?.has(p.name);
              const roleInfo = roleByName?.get(p.name);
              const isLocked = isOut || !!roleInfo;
              const roleLabel =
                roleInfo?.role === "striker"
                  ? "On Strike"
                  : roleInfo?.role === "nonStriker"
                  ? "Non-Striker"
                  : roleInfo?.role === "bowler"
                  ? "Bowling"
                  : undefined;
              return (
                <button
                  type="button"
                  key={p.id}
                  disabled={isLocked}
                  onClick={() => {
                    if (isLocked) return;
                    onSelect(p);
                    onClose();
                  }}
                  className="flex flex-col items-center gap-1.5 px-1.5 py-3 rounded-xl border transition-colors"
                  style={
                    isOut
                      ? { opacity: 0.55, background: "rgba(239,68,68,0.07)", borderColor: "rgba(248,113,113,0.4)" }
                      : isLocked
                      ? { opacity: 0.7, background: "rgba(34,197,94,0.07)", borderColor: "rgba(74,222,128,0.4)" }
                      : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)" }
                  }
                >
                  <span
                    className="w-11 h-11 rounded-full flex items-center justify-center font-mono-geist text-[12px] font-bold overflow-hidden"
                    style={{ border: "1px solid rgba(255,255,255,0.15)", color: isOut ? "#f87171" : isLocked ? "#4ade80" : "#e5e7eb" }}
                  >
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initials(p.name)
                    )}
                  </span>
                  <span
                    className="text-[9.5px] font-archivo font-bold text-center leading-tight break-words"
                    style={{ color: isOut ? "#f87171" : isLocked ? "#4ade80" : "#e5e7eb" }}
                  >
                    {p.name}
                    {isOut ? " · OUT" : roleLabel ? ` · ${roleLabel}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export interface CrewSlotProps {
  title: string;
  accentColor?: string;
  active: boolean;
  onActivate: () => void;
  displayName?: string;
  imageUrl?: string;
  statLine?: string;
  allPlayers: SquadPlayer[];
  onAssign: (p: SquadPlayer) => void;
  onClear?: () => void;
  placeholder: string;
  dismissedNames?: Set<string>;
  blockedName?: string;
  noReplacement?: boolean;
  avatarSize?: number;
  compact?: boolean;
  disabled?: boolean;
}

export function CrewSlot({
  title,
  accentColor,
  active,
  onActivate,
  displayName,
  imageUrl,
  statLine,
  allPlayers,
  onAssign,
  onClear,
  placeholder,
  dismissedNames,
  blockedName,
  noReplacement,
  avatarSize,
  compact,
  disabled,
}: CrewSlotProps) {
  const size = avatarSize ?? (compact ? 32 : 44);
  const isEmpty = !displayName;
  const locked = !!disabled;

  if (noReplacement && isEmpty) {
    return (
      <div className={`rounded-xl border border-dashed border-white/15 bg-white/[0.02] ${compact ? "p-2" : "p-3"}`}>
        <p className="font-mono-geist text-[9px] uppercase tracking-[0.14em] font-bold text-on-surface-variant mb-1.5">{title}</p>
        <div className="flex items-center gap-2.5">
          <span
            className="rounded-full flex items-center justify-center opacity-50 shrink-0"
            style={{ width: size, height: size, border: "1px solid rgba(255,255,255,0.15)" }}
          >
            —
          </span>
          <span className="text-[10px] font-mono-geist font-bold text-on-surface-variant">No replacement left</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={locked ? undefined : onActivate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!locked && (e.key === "Enter" || e.key === " ")) onActivate();
      }}
      className={`rounded-xl transition-all ${compact ? "p-2" : "p-3"} ${locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      style={{
        border: `1px ${isEmpty ? "dashed" : "solid"} ${isEmpty ? "rgba(239,68,68,0.4)" : active ? "rgba(201,151,31,0.45)" : "rgba(255,255,255,0.1)"}`,
        background: isEmpty ? "rgba(239,68,68,0.08)" : active ? "rgba(201,151,31,0.08)" : "rgba(255,255,255,0.02)",
      }}
      onDragOver={(e) => !locked && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (locked) return;
        const id = e.dataTransfer.getData("text/player-id");
        const player = allPlayers.find((p) => p.id === id);
        if (!player) return;
        if (dismissedNames?.has(player.name)) return;
        if (blockedName && player.name === blockedName) return;
        onAssign(player);
      }}
    >
      <div className={`flex items-center justify-between gap-2 ${compact ? "mb-1" : "mb-2"}`}>
        <span
          className="font-mono-geist text-[9px] uppercase tracking-[0.14em] font-bold truncate"
          style={{ color: isEmpty ? "#f87171" : accentColor || "rgba(255,255,255,0.4)" }}
        >
          {isEmpty ? "⚠ " : ""}
          {title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {active && !locked && <span className="font-mono-geist text-[8.5px] text-theme-orange/70 hidden lg:inline">drag or tap ▾</span>}
          {!isEmpty && onClear && !locked && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              aria-label={`Clear ${title}`}
              className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center text-on-surface-variant hover:text-red-400 shrink-0"
            >
              <Icon name="close" style={{ fontSize: 12 }} />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="rounded-full flex items-center justify-center shrink-0 font-mono-geist font-bold overflow-hidden"
          style={{ width: size, height: size, border: "1px solid rgba(255,255,255,0.15)", fontSize: Math.max(9, size * 0.26), color: isEmpty ? "#f87171" : "#e5e7eb" }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : displayName ? (
            initials(displayName)
          ) : (
            "+"
          )}
        </span>
        <div className="flex flex-col min-w-0">
          <span className={`font-archivo font-bold truncate text-on-surface ${compact ? "text-[11px]" : "text-[12px]"}`}>{displayName || placeholder}</span>
          {statLine && <span className={`font-mono-geist text-on-surface-variant truncate ${compact ? "text-[9px]" : "text-[10px]"}`}>{statLine}</span>}
        </div>
      </div>
    </div>
  );
}

export function MoreActionsMenu({
  onAdminAction,
  onPenaltyClick,
  disabled,
}: {
  onAdminAction: (label: string) => void;
  onPenaltyClick: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ bottom: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const items = [
    { key: "Penalty", label: "Penalty +5", color: "#fca5a5", action: onPenaltyClick },
    { key: "Injured", label: "Injured", color: "#fdba74", action: () => onAdminAction("Injured") },
    { key: "Abandon", label: "Abandon", color: "#fecaca", action: () => onAdminAction("Abandon") },
  ];

  function reposition() {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setCoords({
      bottom: Math.max(8, window.innerHeight - rect.top + 8),
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }

  function toggleOpen() {
    if (disabled) return;
    if (!open) reposition();
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={open}
        className="h-full w-full rounded-lg font-mono-geist font-bold uppercase tracking-[0.12em] transition-all hover:brightness-110 active:scale-95 border flex items-center justify-center gap-1 disabled:opacity-35 disabled:cursor-not-allowed"
        style={{ fontSize: "clamp(0.75rem, min(5cqh, 6cqi), 1.5rem)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.12)" }}
      >
        More <Icon name={open ? "expand_less" : "expand_more"} style={{ fontSize: "1.1em" }} />
      </button>
      {open &&
        !disabled &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[199]" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[200] w-40 rounded-xl border border-white/10 bg-surface-container-lowest p-1.5 shadow-xl"
              style={{ bottom: coords.bottom, right: coords.right }}
            >
              {items.map((it) => (
                <button
                  type="button"
                  key={it.key}
                  onClick={() => {
                    it.action();
                    setOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.12em] hover:bg-white/5"
                  style={{ color: it.color }}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

export function BatterPickerButton({
  batter,
  label,
  selected,
  onClick,
}: {
  batter: BatterLike;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all"
      style={{
        border: `1px solid ${selected ? "rgba(201,151,31,0.45)" : "rgba(255,255,255,0.08)"}`,
        background: selected ? "rgba(201,151,31,0.1)" : "rgba(255,255,255,0.02)",
      }}
    >
      <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-mono-geist text-[9px] font-bold" style={{ border: "1px solid rgba(255,255,255,0.15)", color: selected ? "#e8c468" : "#e5e7eb" }}>
        {initials(batter?.name || label)}
      </span>
      <span className="flex flex-col min-w-0">
        <span className={`text-[11px] font-archivo font-bold truncate ${selected ? "text-theme-orange" : "text-on-surface"}`}>{batter?.name || label}</span>
        <span className="text-[9px] uppercase tracking-wide font-mono-geist text-on-surface-variant">{label}</span>
      </span>
    </button>
  );
}

export function FielderOptionButton({
  player,
  selected,
  onClick,
}: {
  player: SquadPlayer;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-1.5 py-2.5 rounded-xl border transition-all"
      style={
        selected
          ? { background: "rgba(201,151,31,0.14)", borderColor: "rgba(201,151,31,0.5)" }
          : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.1)" }
      }
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center font-mono-geist text-[10px] font-bold overflow-hidden shrink-0"
        style={{ border: "1px solid rgba(255,255,255,0.15)", color: selected ? "#e8c468" : "#e5e7eb" }}
      >
        {player.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          initials(player.name)
        )}
      </span>
      <span
        className="text-[9px] font-archivo font-bold text-center leading-tight break-words line-clamp-2"
        style={{ color: selected ? "#e8c468" : "#e5e7eb" }}
      >
        {player.name}
      </span>
    </button>
  );
}

export function FielderPickerField({
  dismissalType,
  fieldingSquad,
  fielder,
  onSelect,
}: {
  dismissalType: DismissalType;
  fieldingSquad?: SquadPlayer[];
  fielder: SquadPlayer | null;
  onSelect: (p: SquadPlayer | null) => void;
}) {
  const requirement = fielderRequirement(dismissalType);
  if (requirement === "none") return null;

  const requiredLabelWord =
    dismissalType === "runOut" ? "who ran the batsman out" : dismissalType === "stumped" ? "the wicketkeeper" : "the catcher";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant flex items-center gap-1.5">
        Fielder
        {requirement === "required" ? (
          <span style={{ color: "#f87171" }}>*</span>
        ) : (
          <span className="normal-case font-normal opacity-60">(optional)</span>
        )}
      </span>

      {!fieldingSquad || fieldingSquad.length === 0 ? (
        <p className="font-mono-geist text-[10px] text-on-surface-variant py-1.5">
          No squad loaded for the fielding side — set it in Match Setup.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2 max-h-[210px] overflow-y-auto custom-scrollbar pr-0.5">
          {fieldingSquad.map((p) => (
            <FielderOptionButton
              key={p.id}
              player={p}
              selected={fielder?.name === p.name}
              onClick={() => onSelect(fielder?.name === p.name ? null : p)}
            />
          ))}
        </div>
      )}

      {requirement === "required" && !fielder && (
        <span className="font-mono-geist text-[9px] text-red-400">Select {requiredLabelWord} to continue.</span>
      )}
    </div>
  );
}

export function CenteredOverlay({
  open,
  onClose,
  title,
  icon,
  iconColor = "#e8c468",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  iconColor?: string;
  children: ReactNode;
}) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[380] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[440px] max-h-[85dvh] overflow-y-auto custom-scrollbar rounded-2xl glass-panel border border-white/10 p-4 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {icon && (
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${iconColor}24`, border: `1px solid ${iconColor}4d` }}>
                <Icon name={icon} style={{ fontSize: 16, color: iconColor }} />
              </span>
            )}
            <h3 className="truncate font-archivo text-sm font-bold uppercase text-on-surface">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors">
            <Icon name="close" style={{ fontSize: 16 }} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function WicketDetailDialog({
  pending,
  onResolve,
  onCancel,
  fieldingSquad,
}: {
  pending: PendingWicket;
  onResolve: (
    batsmanOut: "striker" | "nonStriker",
    dismissalType: DismissalType,
    fielder: string,
    runsCompleted: number
  ) => void;
  onCancel: () => void;
  fieldingSquad?: SquadPlayer[];
}) {
  const [batsmanOut, setBatsmanOut] = useState<"striker" | "nonStriker">("striker");
  const options = getValidDismissalOptions(pending.extraType, pending.isFreeHitActive);
  const restricted = isDismissalRestricted(pending.extraType, pending.isFreeHitActive);
  const isByeType = pending.extraType === "bye" || pending.extraType === "legBye";
  const isNbCombo = pending.extraType === "noBall" && pending.noBallRunOrigin !== "bat";
  const [dismissalType, setDismissalType] = useState<DismissalType>(options[0].value);
  const [fielder, setFielder] = useState<SquadPlayer | null>(null);
  const [runsCompleted, setRunsCompleted] = useState(0);

  useEffect(() => {
    if (fielderRequirement(dismissalType) === "none") {
      setFielder(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissalType]);

  const requirement = fielderRequirement(dismissalType);
  const fielderMissing = requirement === "required" && !fielder;

  const bannerText =
    pending.extraType === "noBall"
      ? "🔵 No Ball — Bowled, Caught, LBW, Stumped, and Hit Wicket aren't valid here"
      : pending.isFreeHitActive
      ? "🔓 Free Hit — Bowled, Caught, LBW, Stumped, and Hit Wicket aren't valid here"
      : pending.extraType === "wide"
      ? "🔵 Wide — Bowled, Caught, and LBW aren't valid here"
      : isByeType
      ? `🔵 ${pending.extraType === "bye" ? "Bye" : "Leg Bye"} — Bowled, Caught, and LBW aren't valid here`
      : null;

  function handleFire() {
    if (fielderMissing) return;
    onResolve(batsmanOut, dismissalType, fielder?.name || "", runsCompleted);
  }

  return (
    <CenteredOverlay open onClose={onCancel} title="Wicket Detail" icon="sports_cricket" iconColor="#f87171">
      {restricted && bannerText && (
        <div className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide font-mono-geist" style={{ background: "rgba(96,165,250,0.14)", border: "1px solid rgba(96,165,250,0.4)", color: "#93c5fd" }}>
          {bannerText}
        </div>
      )}
      {isNbCombo && (
        <div className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide font-mono-geist" style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)", color: "#7dd3fc" }}>
          🔵 No Ball + {pending.noBallRunOrigin === "bye" ? "Bye" : "Leg Bye"} — completed runs count as extras, not off the bat
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Batsman Out</span>
        <div className="grid grid-cols-2 gap-2">
          <BatterPickerButton batter={pending.strikerBefore} label="Striker" selected={batsmanOut === "striker"} onClick={() => setBatsmanOut("striker")} />
          <BatterPickerButton batter={pending.nonStrikerBefore} label="Non-Striker" selected={batsmanOut === "nonStriker"} onClick={() => setBatsmanOut("nonStriker")} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Dismissal</span>
        <div className="grid grid-cols-2 gap-2">
          {options.map((d) => {
            const selected = dismissalType === d.value;
            const onlyOption = options.length === 1;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => !onlyOption && setDismissalType(d.value)}
                className="px-3 py-2.5 rounded-lg text-left text-[11.5px] font-archivo font-bold border transition-all"
                style={
                  selected
                    ? { background: "rgba(201,151,31,0.14)", borderColor: "rgba(201,151,31,0.5)", color: "#e8c468" }
                    : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.1)", color: "#e5e7eb", cursor: onlyOption ? "default" : "pointer" }
                }
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {dismissalType === "runOut" && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Runs Completed Before Run Out</span>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRunsCompleted(n)}
                className="flex-1 py-2 rounded-lg text-sm font-bold font-archivo border"
                style={runsCompleted === n ? { background: "rgba(239,68,68,0.14)", borderColor: "rgba(248,113,113,0.5)", color: "#f87171" } : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.1)", color: "#e5e7eb" }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <FielderPickerField dismissalType={dismissalType} fieldingSquad={fieldingSquad} fielder={fielder} onSelect={setFielder} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-full font-mono-geist text-[11px] font-black uppercase tracking-wide bg-white/[0.02] border border-white/10 text-on-surface"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleFire}
          disabled={fielderMissing}
          className="flex-1 py-2.5 rounded-full font-mono-geist text-[11px] font-black uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "#ef4444", color: "#fff" }}
        >
          Fire Wicket Graphic
        </button>
      </div>
    </CenteredOverlay>
  );
}

export function PenaltyDialog({
  battingTeamLabel,
  bowlingTeamLabel,
  onConfirm,
  onClose,
}: {
  battingTeamLabel: string;
  bowlingTeamLabel: string;
  onConfirm: (team: "batting" | "bowling", description: string) => void;
  onClose: () => void;
}) {
  const [team, setTeam] = useState<"batting" | "bowling">("batting");
  const [description, setDescription] = useState("");

  return (
    <CenteredOverlay open onClose={onClose} title="Add Penalty" icon="gavel" iconColor="#fca5a5">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Award +5 To</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTeam("batting")}
            className="px-3 py-2.5 rounded-lg text-left text-[11.5px] font-archivo font-bold border transition-all"
            style={
              team === "batting"
                ? { background: "rgba(201,151,31,0.14)", borderColor: "rgba(201,151,31,0.5)", color: "#e8c468" }
                : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.1)", color: "#e5e7eb" }
            }
          >
            {battingTeamLabel}
            <span className="block font-mono-geist text-[8.5px] font-normal uppercase tracking-wide opacity-70 mt-0.5">Batting</span>
          </button>
          <button
            type="button"
            onClick={() => setTeam("bowling")}
            className="px-3 py-2.5 rounded-lg text-left text-[11.5px] font-archivo font-bold border transition-all"
            style={
              team === "bowling"
                ? { background: "rgba(201,151,31,0.14)", borderColor: "rgba(201,151,31,0.5)", color: "#e8c468" }
                : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.1)", color: "#e5e7eb" }
            }
          >
            {bowlingTeamLabel}
            <span className="block font-mono-geist text-[8.5px] font-normal uppercase tracking-wide opacity-70 mt-0.5">Bowling</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Description (optional)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="e.g. Fielder encroached on the pitch"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-white/10 text-on-surface placeholder:text-on-surface-variant resize-none"
        />
      </div>

      <button
        type="button"
        onClick={() => onConfirm(team, description)}
        className="w-full py-2.5 rounded-full font-mono-geist text-[11px] font-black uppercase tracking-wide"
        style={{ background: "#ef4444", color: "#fff" }}
      >
        Add +5 Penalty
      </button>
    </CenteredOverlay>
  );
}

// MatchOverScreen — now fully container-query driven (containerType:
// "inline-size" on the outer wrapper) so the logo, heading, badges and
// buttons scale fluidly with whatever width the panel actually has,
// instead of jumping at a couple of "sm:" breakpoints. It also fills
// the full height/width of its parent (flex-1, w-full, h-full) the
// same way the live score card above it spans the whole panel.
//
// UPDATED — winner logo/icon badge enlarged ~60% across the board
// (clamp min/preferred/max all scaled up together), with an extra bump
// to the mobile floor specifically (since `cqi` barely contributes on
// narrow screens, the clamp minimum is what actually governs size
// there) so it reads as the hero element of the graphic on every
// device. Also added a soft glow ring and gradient border behind it
// for a more "broadcast trophy" feel instead of a flat bordered circle.
//
// winningTeamName is now expected to already be resolved by the caller
// (from the same winningTeamKey used for the logo/color) rather than
// being read straight off liveState.matchResult?.winningTeamName —
// that field is frequently empty/inconsistent (see resolveWinningTeamKey
// comments above), which is why the win banner used to show a bare
// "Match Complete" instead of "<Team> Win" even when the logo appeared.
// MatchOverScreen — container-query driven (containerType: "inline-size" on
// the outer wrapper) so the logo, heading, badges and buttons scale fluidly
// with whatever width the panel actually has. Sized to match the original
// admin console proportions (larger hero logo/heading than the read-only
// match-detail page's version, since this panel is the primary focal point
// of the whole scoring console once a match ends) — with two additions
// borrowed from the match-detail page's MatchCompleteBanner: the top
// accent hairline for a "framed" look, and a border-t divider above the
// final-score line instead of it floating on its own.
//
// winningTeamName is expected to already be resolved by the caller (from
// the same winningTeamKey used for the logo/color) rather than being read
// straight off liveState.matchResult?.winningTeamName — that field is
// frequently empty/inconsistent (see resolveWinningTeamKey comments above),
// which is why the win banner used to show a bare "Match Complete" instead
// of "<Team> Win" even when the logo appeared.
export function MatchOverScreen({
  winningTeamName,
  winningTeamLogo,
  winningTeamColor,
  margin,
  method,
  finalScoreLabel,
  targetLabel,
  canUndo,
  onUndo,
  onRestart,
}: {
  winningTeamName?: string;
  winningTeamLogo?: string;
  winningTeamColor?: string;
  margin?: string;
  method?: string;
  finalScoreLabel?: string;
  targetLabel?: string;
  canUndo: boolean;
  onUndo: () => void;
  onRestart?: () => void;
}) {
  const isTie = method === "tie";
  const accent = isTie ? "#c9971f" : winningTeamColor || "#c9971f";
  const methodLabel = method === "wickets" ? "Won by wickets" : method === "runs" ? "Won by runs" : undefined;
  const resultPill = margin || methodLabel ? [margin, methodLabel].filter(Boolean).join(" · ") : undefined;
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    setLogoFailed(false);
  }, [winningTeamLogo]);

  return (
    <div
      className="relative overflow-hidden flex w-full h-full flex-1 box-border flex-col items-center justify-center text-center border"
      style={
        {
          containerType: "inline-size",
          borderColor: `${accent}40`,
          background: `radial-gradient(120% 100% at 50% 0%, ${accent}24 0%, ${accent}08 45%, transparent 70%)`,
          borderRadius: "clamp(14px, 3cqi, 22px)",
          padding: "clamp(20px, 8cqi, 64px) clamp(16px, 6cqi, 56px)",
        } as CSSProperties
      }
    >
      {/* Top accent hairline — matches the "framed" look of the
          match-detail page's MatchCompleteBanner. */}
      <span
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}80, transparent)` }}
      />

      <span
        className="relative z-10 flex items-center font-black uppercase font-mono-geist"
        style={{
          gap: "clamp(4px, 0.8cqi, 8px)",
          fontSize: "clamp(9px, 2cqi, 13px)",
          letterSpacing: "0.2em",
          color: accent,
          marginBottom: "clamp(14px, 3.4cqi, 26px)",
        }}
      >
        <Icon name="emoji_events" style={{ fontSize: "clamp(12px, 2.4cqi, 18px)" }} />
        Match Complete
      </span>

      {/* Soft ambient glow sitting behind the logo — purely decorative,
          gives the badge some depth instead of sitting flat on the
          background gradient. */}
      <div
        className="relative flex items-center justify-center"
        style={{
          marginBottom: "clamp(14px, 3.4cqi, 26px)",
        }}
      >
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: "clamp(240px, 42cqi, 420px)",
            height: "clamp(240px, 42cqi, 420px)",
            background: `radial-gradient(circle, ${accent}35 0%, ${accent}10 45%, transparent 72%)`,
            filter: "blur(2px)",
          }}
        />

        {/* Gradient ring wrapper — the hero element of the graphic,
            sized larger than the read-only match page's version since
            this is the focal point of the whole admin scoring panel. */}
        <div
          className="relative rounded-full"
          style={{
            width: "clamp(196px, 35cqi, 352px)",
            height: "clamp(196px, 35cqi, 352px)",
            padding: "clamp(3px, 0.7cqi, 5px)",
            background: `linear-gradient(135deg, ${accent}, ${accent}55 45%, ${accent}CC)`,
            boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 clamp(8px,2cqi,20px) clamp(20px,5cqi,48px) ${accent}30`,
          }}
        >
          <div
            className="w-full h-full rounded-full flex items-center justify-center bg-black/70 overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {winningTeamLogo && !logoFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={winningTeamLogo}
                alt=""
                className="w-full h-full object-contain"
                style={{ padding: "clamp(8px, 2.2cqi, 18px)" }}
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span className="flex items-center justify-center" style={{ color: accent, fontSize: "clamp(56px, 11cqi, 77px)" }}>
                {isTie ? "🤝" : <Icon name="emoji_events" style={{ fontSize: "clamp(56px, 10cqi, 64px)" }} />}
              </span>
            )}
          </div>
        </div>
      </div>

      <h2
        className="relative z-10 font-archivo font-black uppercase text-white m-0"
        style={{ fontSize: "clamp(18px, 4.4cqi, 34px)", lineHeight: 1.15 }}
      >
        {isTie ? "It's a Tie" : winningTeamName ? `${winningTeamName} Win` : "Match Complete"}
      </h2>

      {!isTie && resultPill && (
        <p
          className="relative z-10 font-mono-geist font-bold uppercase tracking-wide inline-block"
          style={{
            fontSize: "clamp(10px, 1.8cqi, 13px)",
            color: accent,
            background: `${accent}1a`,
            border: `1px solid ${accent}4d`,
            borderRadius: 999,
            padding: "clamp(5px, 1cqi, 7px) clamp(12px, 2.4cqi, 18px)",
            marginTop: "clamp(10px, 2cqi, 16px)",
          }}
        >
          {resultPill}
        </p>
      )}

      {(finalScoreLabel || targetLabel) && (
        <div
          className="relative z-10 flex items-center flex-wrap justify-center font-mono-geist text-on-surface-variant uppercase border-t border-white/10"
          style={{
            gap: "clamp(6px, 1.2cqi, 10px)",
            fontSize: "clamp(9px, 1.6cqi, 12px)",
            letterSpacing: "0.12em",
            marginTop: "clamp(16px, 3.2cqi, 26px)",
            paddingTop: "clamp(12px, 2.4cqi, 18px)",
          }}
        >
          {finalScoreLabel && <span>{finalScoreLabel}</span>}
          {finalScoreLabel && targetLabel && <span className="opacity-40">·</span>}
          {targetLabel && <span>{targetLabel}</span>}
        </div>
      )}

      <div
        className="relative z-10 flex flex-wrap justify-center"
        style={{ gap: "clamp(8px, 1.6cqi, 12px)", marginTop: "clamp(16px, 3.2cqi, 28px)" }}
      >
        {canUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="flex items-center font-mono-geist font-black uppercase tracking-wide rounded-lg border border-red-400/35 bg-red-500/10 text-red-400 hover:bg-red-500/15 transition-all"
            style={{
              gap: "clamp(4px, 0.8cqi, 6px)",
              fontSize: "clamp(10px, 1.8cqi, 13px)",
              padding: "clamp(9px, 1.8cqi, 12px) clamp(16px, 3.2cqi, 22px)",
            }}
          >
            <Icon name="undo" style={{ fontSize: "clamp(12px, 2cqi, 16px)" }} /> Undo &amp; Keep Scoring
          </button>
        )}
        {onRestart && null}
      </div>
    </div>
  );
}