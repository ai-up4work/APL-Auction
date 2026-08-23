// app/components/overlays/admin/new/OverlayAdminConsoleParts.tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { MatchSetup, TeamInfo, LiveState, SquadPlayer } from "@/lib/overlayBus";

export const GOLD_GRADIENT = "linear-gradient(135deg,#A87815,#E8C468)";
export const PARTICLE_COLORS_BOUNDARY = ["#E8C468", "#A87815", "#FDECC8", "#ffffff"];
export const PARTICLE_COLORS_WICKET = ["#718096", "#A0AEC0", "#CBD5E0", "#E2E8F0"];
export const DEFAULT_LOGO_SRC = "/valiant-league-logo.png";

export const BOUNDARY_CHANNELS = [
  { key: "matchBoundaries", label: "Match Boundaries" },
  { key: "tournamentBoundaries", label: "Tournament Boundaries" },
] as const;

export const DESKTOP_RIGHT_TABS = [
  { key: "setup" as const, label: "Match Info", icon: "tune" },
  { key: "overlay" as const, label: "Overlay", icon: "bolt" },
];


/* ───────────────────────── small helpers ───────────────────────── */

export function initials(name?: string) {
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
  style?: React.CSSProperties;
}) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}

export function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return isMobile;
}

/* ───────────────────────── toggle / layout primitives ───────────────────────── */

export function TogglePill({
  label,
  on,
  onClick,
  dotColor,
}: {
  label: string;
  on: boolean;
  onClick?: () => void;
  dotColor: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex items-center gap-1.5 font-mono-geist text-[10px] uppercase tracking-[0.12em] font-bold px-3 py-1.5 rounded transition-all shrink-0 disabled:cursor-default"
      style={{
        background: on ? `${dotColor}1a` : "rgba(255,255,255,0.03)",
        border: `1px solid ${on ? `${dotColor}40` : "rgba(255,255,255,0.08)"}`,
        color: on ? "#e5e7eb" : "rgba(255,255,255,0.4)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: on ? dotColor : "#4b5563" }} />
      {label}
    </button>
  );
}

export function GroupLabel({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <span
      className={`font-mono-geist text-[9px] text-theme-orange uppercase tracking-[0.2em] font-bold shrink-0 ${
        center ? "text-center" : "mr-1"
      }`}
    >
      {children}
    </span>
  );
}

export function MobileChannelRow({
  icon,
  label,
  sublabel,
  on,
  onClick,
  dotColor,
  disabled,
  grow,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  on: boolean;
  onClick: () => void;
  dotColor: string;
  disabled?: boolean;
  // NEW — when set, this row takes an equal flex share of its parent's
  // height (`flex-1 min-h-0`) instead of sizing to its own content, so
  // a card's rows evenly divide whatever space `growRows` on the
  // enclosing ChannelGroupCard gave that card. See
  // OverlayAdminConsole's MOBILE_NAV_CLEARANCE comment for why.
  grow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98] disabled:active:scale-100 ${
        grow ? "flex-1 min-h-0" : ""
      }`}
      style={{
        background: on ? `${dotColor}12` : "rgba(255,255,255,0.02)",
        border: `1px solid ${on ? `${dotColor}38` : "rgba(255,255,255,0.06)"}`,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        className="w-9 h-9 flex items-center justify-center shrink-0"
      >
        <Icon name={icon} style={{ fontSize: 17, color: on ? dotColor : "rgba(255,255,255,0.42)" }} />
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block font-archivo text-[13.5px] font-bold truncate" style={{ color: on ? "#f4f4f5" : "rgba(255,255,255,0.62)" }}>
          {label}
        </span>
        {sublabel && (
          <span className="block font-mono-geist text-[8.5px] font-bold uppercase tracking-[0.1em] truncate" style={{ color: on ? dotColor : "rgba(255,255,255,0.32)" }}>
            {sublabel}
          </span>
        )}
      </span>
      <span
        className="relative shrink-0 w-8 h-[18px] rounded-full transition-colors duration-200"
        style={{ background: on ? dotColor : "rgba(255,255,255,0.14)" }}
      >
        <span
          className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all duration-200"
          style={{ left: on ? "16px" : "2px", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
        />
      </span>
    </button>
  );
}

export function ChannelGroupCard({
  title,
  hint,
  children,
  className,
  growRows,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  // NEW — extra classes for the outer card, e.g. "flex-1 min-h-0" so
  // the card itself takes an equal share of the mobile Overlay tab's
  // fixed height alongside its sibling cards.
  className?: string;
  // NEW — when set, the row container becomes a flexed column
  // (`flex-1 min-h-0`) instead of a plain stack, so children passed
  // with `grow` on MobileChannelRow can actually divide the card's
  // available height instead of just sitting at their natural size.
  growRows?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-2.5 flex flex-col gap-2 ${className ?? ""}`}
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-baseline justify-between gap-2 px-1 shrink-0">
        <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.18em] text-theme-orange">{title}</span>
        {hint && <span className="font-mono-geist text-[8px] uppercase tracking-[0.1em] text-on-surface-variant shrink-0">{hint}</span>}
      </div>
      <div className={`flex flex-col gap-1.5 ${growRows ? "flex-1 min-h-0" : ""}`}>{children}</div>
    </div>
  );
}

export function MomentButton({
  label,
  onClick,
  active,
  danger,
  full,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em] px-3 py-3 rounded-lg transition-all hover:brightness-110 active:scale-95 ${
        full ? "col-span-2" : ""
      }`}
      style={
        danger
          ? { background: active ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" }
          : active
          ? { background: "rgba(201,151,31,0.16)", border: "1px solid rgba(201,151,31,0.4)", color: "#e8c468" }
          : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }
      }
    >
      {label}
    </button>
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
  children: React.ReactNode;
}) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[380] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] max-h-[85dvh] overflow-y-auto custom-scrollbar rounded-2xl glass-panel border border-white/10 p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {icon && (
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${iconColor}24`, border: `1px solid ${iconColor}4d` }}
              >
                <Icon name={icon} style={{ fontSize: 16, color: iconColor }} />
              </span>
            )}
            <h3 className="truncate font-archivo text-sm font-bold uppercase text-on-surface">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors"
          >
            <Icon name="close" style={{ fontSize: 16 }} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/* ───────────────────────── batter / team picker widgets ───────────────────────── */

export interface BatterLike {
  name: string;
  runs: number;
  balls: number;
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
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-mono-geist text-[9px] font-bold"
        style={{ border: "1px solid rgba(255,255,255,0.15)", color: selected ? "#e8c468" : "#e5e7eb" }}
      >
        {initials(batter?.name || label)}
      </span>
      <span className="flex flex-col min-w-0">
        <span className={`text-[11px] font-archivo font-bold truncate ${selected ? "text-theme-orange" : "text-on-surface"}`}>
          {batter?.name || label}
        </span>
        <span className="text-[9px] uppercase tracking-wide font-mono-geist text-on-surface-variant">{label}</span>
      </span>
    </button>
  );
}

export function TeamAvatar({
  name,
  logoUrl,
  color,
  size = 32,
}: {
  name: string;
  logoUrl?: string;
  color: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showLogo = !!logoUrl && !failed;
  return (
    <span
      className="rounded-full flex items-center justify-center shrink-0 overflow-hidden font-mono-geist font-bold"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.32),
        background: showLogo ? "rgba(255,255,255,0.06)" : `${color}22`,
        border: `1px solid ${color}55`,
        color,
      }}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="w-full h-full object-contain p-0.5" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function TeamPickerButton({
  name,
  logoUrl,
  color,
  selected,
  onClick,
}: {
  name: string;
  logoUrl?: string;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all"
      style={{
        border: `1px solid ${selected ? `${color}80` : "rgba(255,255,255,0.08)"}`,
        background: selected ? `${color}1a` : "rgba(255,255,255,0.02)",
      }}
    >
      <TeamAvatar name={name} logoUrl={logoUrl} color={color} size={34} />
      <span
        className="text-[12px] font-archivo font-bold truncate min-w-0"
        style={{ color: selected ? color : "var(--color-on-surface)" }}
      >
        {name}
      </span>
    </button>
  );
}

/* ───────────────────────── default-state builders ───────────────────────── */

export const emptyTeam = (name: string, shortCode: string, color: string, logoUrl?: string): TeamInfo => ({
  teamId: undefined,
  name,
  shortCode,
  color,
  logoUrl: logoUrl ?? "",
  squadPlayers: [],
  squad: [],
});

export const defaultMatchSetup = (): MatchSetup => ({
  tournamentName: "",
  season: "",
  tournamentLogoUrl: "/valiant-league-logo.png",
  venue: "Galle Fort",
  format: "T20",
  matchNumber: "",
  kickoffTime: "",
  matchTitle: "Semi Final 1",
  matchMeta: "Semi Final 1",
  tournament: "Valiant League",
  teamA: emptyTeam("Jaffna Sharks", "JSH", "#bd932d", "/logos/jsh.png"),
  teamB: emptyTeam("Mount Warriors", "MWR", "#3d9dd8", "/logos/mwr.png"),
  tossWinner: "A",
  tossDecision: "bat",
});

export function initialLiveState(): LiveState {
  return {
    inningsNumber: 1,
    target: undefined,
    score: { runs: 0, wickets: 0, overs: 0, balls: 0 },
    striker: { name: "", runs: 0, balls: 0, fours: 0, sixes: 0, imageUrl: undefined },
    nonStriker: { name: "", runs: 0, balls: 0, fours: 0, sixes: 0, imageUrl: undefined },
    bowler: { name: "", overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0, imageUrl: undefined },
    partnership: { runs: 0, balls: 0 },
    matchBoundaries: { fours: 0, sixes: 0 },
    tournamentBoundaries: { fours: 0, sixes: 0 },
    thisOver: [],
    pointsTable: [],
    matchComplete: false,
    matchResult: undefined,
  } as LiveState;
}

export function fallbackSquad(names: string[]): SquadPlayer[] {
  return names.map((name) => ({ id: `manual:${name}`, name }));
}

export const ROSTER_TEAM_A_FALLBACK = fallbackSquad([
  "Ravindu Bandara",
  "Chamika Silva",
  "Isuru Weerasekara",
  "Nadun Karunaratne",
  "Lakindu Peris",
  "Tharindu Costa",
  "Ashen Gunaratne",
  "Binura Jayasuriya",
]);
export const ROSTER_TEAM_B_FALLBACK = fallbackSquad([
  "Hasitha Perera",
  "Niroshan Jay",
  "Kavindu Silva",
  "Danushka Mendis",
  "Sahan Fernando",
  "Kaveen Mendis",
  "Yohan Raj",
  "Kusal Fernando",
]);

/* ───────────────────────── team-name matching (manual moment dispatch) ───────────────────────── */

// Mirrors OnAirChannels.tsx's / ScoringSectionParts' team-name matching
// problem: liveState.matchResult.winningTeamName (or, for the manual
// "Fire Match Won" form / handleMatchComplete path) needs to be compared
// against whichever label the winner ended up recorded under. A team can
// be legitimately referred to by either its shortcode ("RAV") or its
// full name ("Ratmalana Aviators") depending on where the string came
// from (live engine vs. an imported match's resultText). Comparing
// against only one form is fragile — see the matching
// resolveWinningTeamKey helper in ScoringSectionParts.tsx for the full
// rationale; this version is used for the moment-graphic dispatch in
// handleMatchComplete, which needs the same resilience for the exact
// same reason.
export function normalizeTeamNameForMatch(s?: string): string {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function matchesTeamLabel(candidate: string, shortLabel: string, fullName?: string): boolean {
  const name = normalizeTeamNameForMatch(candidate);
  if (!name) return false;
  const labels = [shortLabel, fullName].map(normalizeTeamNameForMatch).filter((s) => s.length > 0);
  return labels.some((l) => l === name || name.includes(l) || l.includes(name));
}