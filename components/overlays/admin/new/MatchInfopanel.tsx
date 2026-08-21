"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { MatchSetup, SquadPlayer, TeamInfo } from "@/lib/overlayBus";
import type { GeocodeMatch } from "@/lib/fetchVenueWeather";

/* ─────────────────────────────────────────────────────────────
   VIEW-ONLY PASS (this update)
   ─────────────────────────────────────────────────────────────
   Match Setup is no longer editable inline. This panel now only
   ever *displays* the current `matchSetup` — every field, both
   team cards, and each team's squad — as static read-only content.

   Editing now lives exclusively at `/match/{matchId}/edit`. The single
   "Edit" affordance in the header routes there via `router.push`
   instead of flipping any local "unlocked / drawer open" state
   into an editable form. There is no more locked-vs-editable split:
   there's just "collapsed summary" vs "expanded details", both
   always read-only.

   Height: the details section now computes its own height directly
   from the viewport (`100dvh` minus a chrome offset) on mobile.
   `h-full` is no longer forced on mobile — only `lg:h-full` — since
   forcing full height on the (already viewport-capped) mobile
   scroller was stretching the section past its content and leaving
   dead space below the card. Desktop still stretches to fill the
   shared right column via `lg:h-full`.

   SPACE PASS (this update) — the squad chip grid was the single
   biggest space cost inside each team card and the main reason
   content didn't fit in one screen on mobile. Squad is now
   mobile-only: on mobile, each team card shows a compact
   "View Squad (N)" trigger that opens a read-only, centered
   overlay (portal) listing the squad with no click/selection
   affordance at all (view only). On desktop the squad isn't shown
   in this panel at all — no inline list, no trigger — since
   desktop has other places to see it and the card stays compact.
   The two team cards are stacked vertically with a small gap
   between them (no grid) — with the squad moved out, each card is
   short enough that both plus the rest of the details fit in one
   viewport on mobile and desktop alike.
   ───────────────────────────────────────────────────────────── */

const GOLD_GRADIENT = "linear-gradient(135deg,#A87815,#E8C468)";

// Shared class fragment: scroll works, scrollbar never renders
// (Firefox via scrollbar-width, WebKit via the pseudo-element).
const HIDE_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// ════════════════════════════════════════════════════════════════
// Inlined UI primitives
// ════════════════════════════════════════════════════════════════

function Icon({ name, className = "", style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}

function Dot({ color, pulse, title }: { color: "orange" | "amber" | string; pulse?: boolean; title?: string }) {
  const bg = color === "orange" ? "#c9971f" : color === "amber" ? "#f59e0b" : color;
  return (
    <span
      title={title}
      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pulse ? "animate-pulse" : ""}`}
      style={{ background: bg, boxShadow: `0 0 6px ${bg}` }}
    />
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] mb-1.5 text-on-surface-variant">
      {children}
    </span>
  );
}

function Eyebrow({ children, color, className }: { children: React.ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={`font-mono-geist text-[9px] font-bold uppercase tracking-[0.2em] ${className ?? ""}`}
      style={{ color: color ?? "rgba(255,255,255,0.4)" }}
    >
      {children}
    </span>
  );
}

// Bordered chip — the app-wide baseline for every clickable control.
function SmallButton({
  children,
  onClick,
  icon,
  tone = "neutral",
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: string;
  tone?: "neutral" | "orange" | "danger";
  disabled?: boolean;
}) {
  const toneStyles: Record<string, { color: string; border: string; bg: string }> = {
    neutral: { color: "rgba(255,255,255,0.65)", border: "rgba(255,255,255,0.12)", bg: "rgba(255,255,255,0.02)" },
    orange: { color: "#e8c468", border: "rgba(201,151,31,0.4)", bg: "rgba(201,151,31,0.1)" },
    danger: { color: "#f87171", border: "rgba(239,68,68,0.35)", bg: "rgba(239,68,68,0.08)" },
  };
  const t = toneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ color: t.color, borderColor: t.border, background: t.bg }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] transition-all border flex-shrink-0 ${
        disabled ? "opacity-40 cursor-not-allowed" : "hover:brightness-125 active:scale-95"
      }`}
    >
      {icon && <Icon name={icon} style={{ fontSize: 12 }} />}
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  minWidth,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  minWidth?: number;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth,
        ...(disabled ? {} : { background: GOLD_GRADIENT, color: "#1a1304" }),
      }}
      className={`py-2 px-6 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em] transition-all hover:brightness-110 active:scale-95 ${
        disabled ? "bg-white/5 text-on-surface-variant cursor-not-allowed" : ""
      }`}
    >
      {children}
    </button>
  );
}

function StatusPill({
  label,
  tone = "neutral",
  pulse,
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "error" | "orange";
  pulse?: boolean;
}) {
  const toneColor: Record<string, string> = {
    neutral: "#9ca3af",
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#f87171",
    orange: "#c9971f",
  };
  const c = toneColor[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono-geist text-[9px] font-bold uppercase tracking-[0.16em] px-3 py-1.5 rounded-full border"
      style={{ color: c, background: `${c}1a`, borderColor: `${c}40` }}
    >
      {pulse && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />}
      {label}
    </span>
  );
}

function MutedNote({ tone = "neutral", children }: { tone?: "neutral" | "warning"; children: React.ReactNode }) {
  return (
    <p className="font-mono-geist text-[10px]" style={{ color: tone === "warning" ? "#f59e0b" : "rgba(255,255,255,0.4)" }}>
      {children}
    </p>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// Collapsible glass panel — tight padding/gap since this always renders
// inside a narrow rail, not a full-width form.
//
// `mobileAlwaysOpen` — when true, the section's content always renders
// visible on mobile (regardless of `open`/`onOpenChange`), and the
// chevron toggle affordance is hidden on mobile too. Desktop behavior
// is unchanged either way.
function DrawerSection({
  step,
  title,
  description,
  done,
  dirty,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  headerExtra,
  mobileAlwaysOpen = false,
  children,
}: {
  step?: string;
  title: string;
  description?: string;
  done?: boolean;
  dirty?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  headerExtra?: React.ReactNode;
  mobileAlwaysOpen?: boolean;
  children: React.ReactNode;
}) {
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const contentVisibilityClass = mobileAlwaysOpen
    ? open
      ? "flex lg:flex"
      : "flex lg:hidden"
    : open
    ? "flex"
    : "hidden";

  const showBottomBorderMobile = mobileAlwaysOpen ? true : open;

  return (
    // NOTE: `h-full` is intentionally `lg:h-full` only. On mobile this
    // section lives in a viewport-capped scroller and should size to
    // its own content; forcing full height here was the source of the
    // dead gap below the card on mobile. Desktop still wants to fill
    // the shared right column, so it keeps `lg:h-full`.
    <div className="flex flex-col min-h-0 lg:h-full overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 lg:py-1.5 text-left border-b flex-shrink-0 ${
          showBottomBorderMobile ? "border-white/10" : "border-transparent"
        } ${open ? "lg:border-white/10" : "lg:border-transparent"}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {step && (
            <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] px-2 py-1 rounded-md flex-shrink-0 text-theme-orange bg-theme-orange/10 border border-theme-orange/20">
              {step}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="truncate font-archivo text-sm font-bold italic uppercase text-on-surface">{title}</h3>
            {description && (
              <p className="truncate font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.08em] mt-0.5">{description}</p>
            )}
          </div>
          {done && <Dot color="orange" title="Pushed" />}
          {dirty && <Dot color="amber" pulse title="Unpushed changes" />}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {headerExtra}
        </div>
      </button>
      <div className={`flex-col p-4 gap-3 lg:gap-2.5 min-h-0 lg:flex-1 overflow-y-auto ${HIDE_SCROLLBAR} ${contentVisibilityClass}`}>
        {children}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Read-only detail primitives
// ════════════════════════════════════════════════════════════════

function DetailField({ label, value, mono, span }: { label: string; value?: string | null; mono?: boolean; span?: 1 | 2 }) {
  return (
    <div className={span === 2 ? "col-span-2" : undefined}>
      <FieldLabel>{label}</FieldLabel>
      <p className={`text-sm font-bold text-on-surface truncate ${mono ? "font-mono-geist tabular-nums" : "font-archivo"}`}>
        {value && value.length > 0 ? value : "—"}
      </p>
    </div>
  );
}

function SquadChipsReadOnly({ players }: { players: SquadPlayer[] }) {
  if (!players || players.length === 0) {
    return <MutedNote>No squad set for this team yet.</MutedNote>;
  }
  return (
    <div className={`flex flex-wrap gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/10`}>
      {players.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1.5 rounded-full border border-white/10 bg-white/[0.03]"
        >
          <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-white/[0.03]">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="font-mono-geist text-[9px] font-bold text-on-surface-variant">{initials(p.name) || "?"}</span>
            )}
          </span>
          <span className="font-archivo text-[11px] font-bold whitespace-nowrap text-on-surface">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

// Read-only squad overlay — portal so it escapes the card's own
// stacking/overflow context. Full-screen bottom sheet on mobile,
// centered modal on desktop. No selection affordance whatsoever;
// this is purely for glancing at who's in the squad.
function SquadOverlay({
  open,
  onClose,
  teamLabel,
  teamName,
  players,
}: {
  open: boolean;
  onClose: () => void;
  teamLabel: string;
  teamName?: string | null;
  players: SquadPlayer[];
}) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-[420px] max-h-[80dvh] overflow-y-auto ${HIDE_SCROLLBAR} rounded-2xl glass-panel border border-white/10 p-4 flex flex-col gap-3`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 flex-shrink-0">
          <div className="min-w-0">
            <Eyebrow color="#c9971f">{teamLabel} · Squad</Eyebrow>
            <h3 className="truncate font-archivo text-sm font-bold uppercase text-on-surface mt-0.5">{teamName || "—"}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors"
          >
            <Icon name="close" style={{ fontSize: 16 }} />
          </button>
        </div>
        <SquadChipsReadOnly players={players} />
      </div>
    </div>,
    document.body
  );
}

function TeamSummaryCard({ team, label }: { team: TeamInfo; label: string }) {
  const [squadOpen, setSquadOpen] = useState(false);
  const squad = team.squadPlayers ?? [];

  return (
    <div className="relative isolate rounded-xl overflow-hidden">
      {team.logoUrl && (
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `url(${team.logoUrl})`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right center",
            opacity: 0.1,
          }}
          aria-hidden="true"
        />
      )}
      <div className="relative z-10 p-3 lg:p-3 bg-white/[0.02] border border-white/10 rounded-xl flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow color="#c9971f">{label}</Eyebrow>
          <div
            className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0"
            style={{ background: team.color || "transparent" }}
            title={team.color || undefined}
          />
        </div>

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-white/[0.03] border border-white/10">
            {team.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logoUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="font-mono-geist text-[10px] font-bold text-on-surface-variant">
                {initials(team.name || team.shortCode || "?") || "?"}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-archivo text-sm font-bold text-on-surface">{team.name || "—"}</p>
            <p className="font-mono-geist text-[10px] uppercase tracking-[0.1em] text-on-surface-variant">
              {team.shortCode || "—"}
            </p>
          </div>
        </div>

        {/* Squad is mobile-only. Desktop doesn't show it here at all —
            not inline, not as a trigger — to keep the card compact.
            Mobile shows a compact trigger that opens a read-only,
            centered overlay (no selection affordance either way). */}
        <button
          type="button"
          onClick={() => setSquadOpen(true)}
          className="lg:hidden w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] active:scale-[0.98] transition-all"
        >
          <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            Squad ({squad.length})
          </span>
          <Icon name="chevron_right" className="text-on-surface-variant" style={{ fontSize: 14 }} />
        </button>
      </div>

      <SquadOverlay
        open={squadOpen}
        onClose={() => setSquadOpen(false)}
        teamLabel={label}
        teamName={team.name}
        players={squad}
      />
    </div>
  );
}

// Full read-only rundown of the current matchSetup — no inputs, no
// handlers that mutate state. This is the entire body of the "Match
// Setup" drawer now.
function MatchDetailsView({ matchSetup }: { matchSetup: MatchSetup }) {
  const tossWinnerLabel =
    matchSetup.tossWinner === "A"
      ? matchSetup.teamA.shortCode || matchSetup.teamA.name || "Team A"
      : matchSetup.tossWinner === "B"
      ? matchSetup.teamB.shortCode || matchSetup.teamB.name || "Team B"
      : null;

  const tossDecisionLabel =
    matchSetup.tossDecision === "bat" ? "Elected to bat" : matchSetup.tossDecision === "bowl" ? "Elected to bowl" : null;

  return (
    <div className="flex flex-col gap-3 lg:gap-2.5">
      <div className="grid grid-cols-2 gap-3 lg:gap-2.5">
        <DetailField label="Tournament" value={matchSetup.tournamentName} />
        <DetailField label="Season" value={matchSetup.season} />
        <DetailField label="Format" value={matchSetup.format} />
        <DetailField label="Match Number" value={matchSetup.matchNumber} />

        {matchSetup.venue && <DetailField label="Venue" value={matchSetup.venue} span={2} />}
      </div>

        <DetailField label="Kickoff Time" value={matchSetup.kickoffTime} mono />

        <DetailField label="Match Title" value={matchSetup.matchTitle} />

      {matchSetup.tournamentLogoUrl && (
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-white/[0.03] border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={matchSetup.tournamentLogoUrl} alt="" className="w-full h-full object-contain" />
          </span>
          <FieldLabel>Tournament Logo</FieldLabel>
        </div>
      )}

      {/* Team cards stacked vertically with a small gap between them —
          no grid. With the squad list moved to an overlay on mobile,
          each card is short enough that stacking both still fits in
          one viewport on mobile and desktop alike. */}
      <div className="flex flex-col gap-2.5">
        <TeamSummaryCard team={matchSetup.teamA} label="Team A" />
        <TeamSummaryCard team={matchSetup.teamB} label="Team B" />
      </div>

      <div className="grid grid-cols-2 mt-4 lg:mt-0 gap-3 lg:gap-2.5">        
        <DetailField label="Toss Winner" value={tossWinnerLabel} />
        <DetailField label="Toss Decision" value={tossDecisionLabel} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Main panel
// ════════════════════════════════════════════════════════════════

export interface MatchSetupPanelProps {
  auctionId: string | null | undefined;
  matchSetup: MatchSetup;
  setMatchSetup: React.Dispatch<React.SetStateAction<MatchSetup>>;
  onPush: () => void;
  pushLabel: string;
  completed: boolean;
  onVenueSelect?: (match: GeocodeMatch, displayName?: string) => void;
  /** Match id used to build the redirect target `/match/{matchId}/edit` when
      the operator wants to actually edit setup — editing no longer
      happens inline in this panel. */
  matchId?: string | null;
  /** Full URL/path to the Auctions admin tab. Kept for interface
      compatibility with callers; unused now that this panel is
      view-only. */
  auctionAdminHref?: string;
  /** Fires whenever the details section flips between collapsed and
      expanded, so the parent can hide sibling panels (weather,
      moments, overlay toggles) while this section is taking up the
      full column on desktop. */
  onEditingChange?: (expanded: boolean) => void;
  /** Current mobile bottom-nav tab, e.g. 'scoring' | 'overlay' | 'setup'.
      When provided, this panel is only shown on mobile while
      `mobileTab === "setup"`, and fills that tab's viewport. Omit to
      keep the panel always visible (e.g. on a full-width, non-tabbed
      page). */
  mobileTab?: string;
  /** Optional Weather panel rendered by the parent, shown inside this
      Setup drawer on mobile only (`lg:hidden`). Desktop layout is
      untouched — don't pass this for the desktop column. */
  mobileWeatherSlot?: React.ReactNode;
  tournamentLogoUrl?: string;
  /** Height (in px) of whatever mobile chrome surrounds this panel's
      own tab body — top bar + bottom tab nav, safe-area insets, etc.
      The panel is capped to `100dvh` minus this value so it never
      exceeds the actual visible viewport on mobile. Ignored on
      desktop, where height instead tracks the right column via
      `onEditingChange` + the parent's layout. Defaults to 96px. */
  mobileChromeOffsetPx?: number;
}

export default function MatchSetupPanel({
  matchSetup,
  onPush,
  pushLabel,
  completed,
  matchId,
  onEditingChange,
  mobileTab,
  mobileWeatherSlot,
  mobileChromeOffsetPx = 96,
}: MatchSetupPanelProps) {
  const router = useRouter();

  // Whether the details section is open. Mobile ignores this for
  // *content* visibility (mobileAlwaysOpen keeps it always rendered,
  // since mobile has its own dedicated tab) but desktop uses it to
  // decide whether to expand to fill the column.
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Tell the parent whenever the section opens/closes, so it can hide
  // LiveStatePanel / Weather / Moments only while this section is
  // genuinely taking over the full column height on desktop.
  useEffect(() => {
    onEditingChange?.(drawerOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  function goToEdit() {
    if (!matchId) return;
    router.push(`/match/${matchId}/edit`);
  }

  // ── Layout wrapper ────────────────────────────────────────────────
  // - Mobile: this panel lives in its own dedicated "Setup" tab, so
  //   the wrapper is unconditionally capped to `100dvh -
  //   mobileChromeOffsetPx` with its own `overflow-y-auto` as a
  //   safety net. It sizes to its actual content now (no forced
  //   `h-full` inside DrawerSection), so there's no leftover gap
  //   below the card when content is shorter than the viewport cap.
  // - Desktop: the right column is shared with Weather/Moments below
  //   it. While the details section is CLOSED, the panel sits at its
  //   normal compact header-row size. The moment it's OPENED
  //   (`drawerOpen`), the wrapper grows to fill the available column
  //   height (`lg:flex-1 lg:h-full lg:max-h-full`) with its own
  //   internal scroller.
  const mobileHeightStyle = {
    ["--msp-mobile-offset" as any]: `${mobileChromeOffsetPx}px`,
  } as React.CSSProperties;

  const mobileHeightClasses = `max-h-[calc(100dvh-var(--msp-mobile-offset))] overflow-y-auto ${HIDE_SCROLLBAR} lg:max-h-none lg:overflow-visible`;

  const outerClassName = mobileTab
    ? [
        "flex flex-col min-h-0",
        "pt-0 px-0",
        mobileTab === "setup" ? "flex" : "hidden",
        mobileHeightClasses,
        "lg:flex lg:flex-col lg:min-h-0",
        drawerOpen ? `lg:flex-1 lg:h-full lg:max-h-full lg:overflow-y-auto ${HIDE_SCROLLBAR}` : "",
      ]
        .filter(Boolean)
        .join(" ")
    : [
        "flex flex-col min-h-0",
        "p-4 lg:p-0",
        mobileHeightClasses,
        "lg:min-h-0",
        drawerOpen ? `lg:flex-1 lg:h-full lg:max-h-full lg:overflow-y-auto ${HIDE_SCROLLBAR}` : "",
      ]
        .filter(Boolean)
        .join(" ");

  return (
    <div className={outerClassName}>
      <div className="flex flex-col min-h-0 lg:flex-1 lg:h-full overflow-hidden">
          <DrawerSection
          step="1"
          title="Match Setup"
          description={completed ? "Teams & session · pushed" : "Teams & session · view only"}
          done={completed}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          // Mobile has its own dedicated tab for this panel, so it
          // always renders its content open there. Desktop keeps the
          // normal collapse/expand behavior since it shares the column
          // with Weather/Moments.
          mobileAlwaysOpen
          headerExtra={
            <>
              {completed && <StatusPill label="Locked" tone="orange" />}
              <SmallButton icon="edit" tone="orange" onClick={goToEdit} disabled={!matchId}>
                Edit
              </SmallButton>
            </>
          }
        >
          <MatchDetailsView matchSetup={matchSetup} />

          {!matchId && (
            <MutedNote tone="warning">No match id available yet — editing will be enabled once this match is saved.</MutedNote>
          )}


          {!completed && (
            <p className="font-mono-geist text-[9px] uppercase tracking-[0.12em] text-on-surface-variant">
              Push to broadcast the current match setup live. To change any details, tap Edit.
            </p>
          )}

          {/* Weather, mobile-only: on small screens this Setup tab is
              where Weather lives (instead of a separate Overlay tab).
              Desktop is untouched. */}
          {mobileWeatherSlot && <div className="lg:hidden">{mobileWeatherSlot}</div>}
        </DrawerSection>
      </div>
    </div>
  );
}