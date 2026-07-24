// File: app/sandbox/overlay/page.tsx
//
// Cricket overlay sandbox — restyled to match the broadcast-console feel
// of the other two sandboxes (app/sandbox/brackets/page.tsx and the
// auction multiview sandbox): pulsing on-air badge, console header with
// a live score readout, a pill-based control deck, ambient scanline
// texture, and a floating chyron for on-air moments instead of a plain
// scrolling log. Same local-atom pattern (ControlCluster / Pill /
// ActionButton) those two define for themselves rather than reusing the
// old admin/ui Section/StatusPill card look, so all three sandboxes read
// as one product.
//
// View switching: "Flip to Live" swaps the whole page into the actual
// broadcast surface (video backdrop + the real overlay components,
// rendered via the shared <BroadcastSurface>); "Back to Controls" swaps
// back. This is a fully manual action — it is NOT auto-triggered by
// moments (an earlier version auto-flipped the whole tab on every
// four/six/wicket, which yanked the scorer away from the controls they
// were mid-tap on).
//
// Live Preview Monitor: a small, always-on replica of the actual
// broadcast surface sits in the corner of the Control view (see
// <LivePreviewMonitor> below), so the scorer gets a live glance at
// what's on air without ever leaving the control deck. It is backed by
// an <iframe src="/sandbox/overlay/preview">, NOT a CSS-scaled <div>
// around the overlay components directly — several of those components
// (MatchMomentOverlay in particular) portal straight to document.body,
// which escapes any scaled wrapper in THIS document and lands on the
// real admin page instead of inside the shrunk box. A separate route
// with its own document (loaded via iframe) is what keeps those portals
// contained, and app/sandbox/overlay/lib/sandboxBus.ts (a
// BroadcastChannel) is what re-syncs this page's live state into that
// iframe's document without a server round trip.
//
// Big Score Bar (CHANGED): previously this corner used a bespoke
// <ScoreCornerBar> readout — a plain fixed <div> re-deriving its own
// numbers from liveState. That's now replaced with the REAL
// <LiveScoreBar> overlay component (components/overlays/LiveScoreBar),
// mounted directly in this document — completely unmodified. It doesn't
// need the iframe trick LivePreviewMonitor needs, because LiveScoreBar
// itself only portals to document.body and takes liveState/matchSetup
// as plain props; it doesn't reach for any other window-scoped globals
// the way MatchMomentOverlay does. Since we're not allowed to touch
// LiveScoreBar.jsx itself, and its own layout hardcodes a full-width,
// centered "broadcast" position (`fixed inset-x-0 bottom-0`, `width:
// 90vw`, `items-center`), it's repositioned to the bottom-left corner
// and enlarged purely via a scoped global CSS override (see
// <BigScoreBarPositionOverride /> below) that targets its portaled
// wrapper by its `aria-live="polite"` attribute — the one identifying
// hook LiveScoreBar's markup already exposes on that wrapper. No
// component code was edited to make this work.
//
// FIX (Live view inherited the Control view's shrunk score bar): the
// override CSS above is a bare `div[aria-live="polite"] { ... }`
// selector, injected via a GLOBAL <style jsx global> tag. Global styles
// aren't scoped to their parent in the DOM — hiding the control view's
// wrapper with `display: none` does nothing to stop the rule itself
// from matching, and it matches ANY element with that attribute
// anywhere in the document. Since both the control view's own
// <LiveScoreBar> AND the Live view's copy (rendered inside
// <BroadcastSurface>) are literally the same component portaled to
// document.body, both expose that exact attribute as siblings under
// <body> — there's no DOM relationship distinguishing "the admin one"
// from "the broadcast one". So whenever both were mounted at once (the
// old code kept the control-view LiveScoreBar mounted at all times,
// just toggling its own `show` prop, and kept the override's <style>
// tag mounted unconditionally too), the broadcast surface's real,
// full-size bar got silently squashed down to the same small
// bottom-left override meant only for the corner readout in Controls.
//
// Fixed by fully UNMOUNTING both the override stylesheet and the
// control-view's LiveScoreBar instance when not on the control view,
// instead of just toggling a `show` prop on an always-mounted instance.
// Neither of them holds state that needs to survive a flip — they're
// both purely derived from liveState/channels, which live up in this
// component regardless — so conditional rendering is safe and removes
// the override CSS from the document entirely while Live is showing,
// letting BroadcastSurface's LiveScoreBar render at its own real,
// full "broadcast" size, same as it does on the actual overlay page.
//
// Scoring console: now rendered via <LiveStatePanelAuto>, which wraps
// the real <LiveStatePanel> (unchanged engine/graphics) with a scripted
// "watch it run" driver plus its own Pause Demo / Try It Yourself
// controls — see components/overlays/admin/LiveStatePanelAuto.tsx. The
// wrapper owns mode + pause state internally; this page just hands it
// the same callbacks it always passed to LiveStatePanel directly, plus
// onRestartMatch (required — the driver calls it once per demo cycle)
// and logEvent (so demo-driven completions show up in the Event Feed
// like everything else).
//
// FIX (channel pills need stable DOM ids): the ScriptedDriver drives
// real DOM elements by `id="demo-xxx"` lookup (see useDemoCursor.ts). It
// now scripts firing the Match Intro and Scorecard channels as part of
// the demo (see LiveStatePanelAuto.tsx's showMatchIntro/showScorecard),
// which requires those two specific Pill buttons to be individually
// addressable. Every other channel pill is left without an id since the
// script never needs to click them directly (matchBoundaries gets
// turned on programmatically via setChannels on the first boundary,
// same as before).
//
// FIX (chyron never cleared): <MomentChyron> used to render forever
// once a moment fired — there was a revert timer for the little Live
// Preview Monitor (<LivePreviewMonitor>) but nothing ever cleared
// `firedMoment` itself, so the last moment's chyron just sat on screen
// until the next moment overwrote it. It now reverts on the same
// per-moment timing table as the preview monitor.
//
// FIX (scorecard channel showed nothing): CricketScorecard needs a full
// innings card (every out batter's final line, every finished bowler's
// final figures), but liveState only ever tracks the CURRENT
// striker/non-striker/bowler — once someone's out or a bowler's spell
// ends, their numbers vanish from liveState with nothing snapshotting
// them first. battingCardRef/bowlingCardRef now accumulate those frozen
// lines as they happen (handleWicket pushes the dismissed batter;
// the bowler-change effect pushes the outgoing bowler's final figures),
// buildCurrentInningsSnapshot() merges the frozen lines with whoever's
// still live, and inningsCards gets populated at the two points a card
// is actually "final" — innings break (handleInningsEnd) and match end
// (handleMatchComplete) — then threaded through to BroadcastSurface and
// the sandbox bus so the Live Preview Monitor's iframe gets it too.
// restartMatch() clears all of this alongside the rest of liveState so
// a fresh match doesn't inherit the previous one's card.
//
// FIX (Flip to Live showed only the video): the live-view wrapper below
// used to be `fixed inset-0 z-[9500]`. Every real overlay component
// (WeatherCard, MatchBoundaries, TournamentBoundaries,
// MatchMomentOverlay, LiveScoreBar, CricketMatchIntro,
// TournamentLogoDisplay, CricketScorecard) portals straight to
// document.body via createPortal — none of them are actually DOM
// descendants of this wrapper div, so they don't inherit its stacking
// context. But `position: fixed` + an explicit `z-index: 9500` DOES
// create a new stacking context for this div and everything that IS a
// real child of it — which is just the <video> backdrop. That put the
// video's entire stacking context above every portaled overlay
// (whatever more modest z-index each of those defines internally),
// hiding all of them behind solid video. There was never a reason for
// this wrapper to out-rank anything — the control view underneath is
// hidden via `display: none`, which removes it from paint regardless of
// z-index — so the fix is simply to drop the z-index override here and
// let the overlay components' own natural stacking order (already
// correct on the real, non-sandbox broadcast page) do its job. Only the
// "Back to Controls" button and the "Sandbox Feed" badge keep an
// explicit z-index, since those two ARE real children here and need to
// stay above the video + portaled overlays.

"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DismissalType } from "@/hooks/useLiveScoringEngine";
import type { MomentPayload } from "@/lib/overlayBus";

import LiveStatePanelAuto from "@/components/demo/LiveStatePanelAuto";
import BroadcastSurface from "@/components/demo/BroadcastSurface";
import LiveScoreBar from "@/components/overlays/LiveScoreBar";
import { connectSandboxBus, type SandboxChannels } from "./lib/sandBoxBus";

import { HARDCODED_MATCH_SETUP, emptyLiveState, defaultWeather, emptyBatter, emptyBowler } from "./lib/sandboxData";

import { MonitorPlay, LayoutPanelLeft, CloudSun, RotateCcw, Zap, Target, Trophy, ShieldCheck, PartyPopper, ChevronDown } from "lucide-react";

const DEFAULT_CHANNELS: SandboxChannels = {
  weather: true,
  liveScoreBar: true,
  matchBoundaries: false,
  tournamentBoundaries: false,
  matchIntro: false,
  tournamentLogo: true,
  matchScorecard: false,
};

const CHANNEL_LABELS: Record<keyof SandboxChannels, string> = {
  weather: "Weather",
  liveScoreBar: "Score Bar",
  matchBoundaries: "Match 4s/6s",
  tournamentBoundaries: "Tourn. 4s/6s",
  matchIntro: "Match Intro",
  tournamentLogo: "Tournament Logo",
  matchScorecard: "Scorecard",
};

// DOM ids the ScriptedDriver clicks directly for the two channels it
// scripts (Match Intro at the start of a cycle, Scorecard at the
// innings break and at match end). Every other channel key maps to
// `undefined` and gets no id, since nothing ever needs to click them
// programmatically.
const CHANNEL_DEMO_IDS: Partial<Record<keyof SandboxChannels, string>> = {
  matchIntro: "demo-channel-matchIntro",
  matchScorecard: "demo-channel-matchScorecard",
};

const FONT_BODY = "var(--font-body, 'Inter', ui-sans-serif, system-ui, sans-serif)";

// Must match WeatherCard's DEFAULT_CONDITIONS keys exactly — anything
// else silently falls back to the sunny icon. Single source of truth
// for both the dropdown trigger's label lookup and its option list,
// used by <WeatherConditionSelect> below.
const WEATHER_CONDITIONS: { value: string; label: string }[] = [
  { value: "sunny", label: "Sunny" },
  { value: "clear", label: "Clear" },
  { value: "partly-cloudy", label: "Partly Cloudy" },
  { value: "cloudy", label: "Cloudy" },
  { value: "overcast", label: "Overcast" },
  { value: "rain", label: "Rain" },
  { value: "storm", label: "Stormy" },
  { value: "snow", label: "Snow" },
  { value: "fog", label: "Foggy" },
];

type ViewMode = "control" | "live";

// How long to hold the Live Preview Monitor in its featured "On Air"
// state after a moment fires before easing back to normal — roughly
// matched to how long each celebration actually plays for. matchWon
// gets the longest hold since it's the most consequential graphic;
// everything else is a quick beat.
const MOMENT_AUTO_REVERT_MS: Record<MomentPayload["moment"], number> = {
  four: 3200,
  six: 3200,
  wicket: 4200,
  fifty: 4500,
  hundred: 4500,
  maiden: 3200,
  matchWon: 6000,
};

// How long a channel stays on before auto-turning itself off, for
// channels that are timed graphics rather than persistent ones (Score
// Bar, Weather, etc. are NOT in here — those stay exactly as toggled).
// Match Intro is a one-shot animated sequence; Scorecard here is being
// used the same way — a graphic that's shown for a beat, not left up
// for the rest of the innings. Keep MATCH_INTRO_AUTO_OFF_MS in sync with
// however long the actual intro animation inside BroadcastSurface's
// MatchIntro overlay plays for.
const MATCH_INTRO_AUTO_OFF_MS = 6000;
const MATCH_SCORECARD_AUTO_OFF_MS = 10000;
const AUTO_OFF_CHANNEL_DURATIONS: Partial<Record<keyof SandboxChannels, number>> = {
  matchIntro: MATCH_INTRO_AUTO_OFF_MS,
  matchScorecard: MATCH_SCORECARD_AUTO_OFF_MS,
};

// Native size of the broadcast "stage" — the /preview route (and the
// real Live view) are authored against this frame. The monitor iframe
// is rendered at this exact size and then visually scaled down via a
// CSS transform on its wrapper, so its internal layout viewport never
// changes — only how big it looks on screen does.
const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

// Monitor's on-screen footprint in the Control view.
const MONITOR_WIDTH = 300;
const MONITOR_HEIGHT = Math.round((MONITOR_WIDTH / STAGE_WIDTH) * STAGE_HEIGHT);
const MONITOR_SCALE = MONITOR_WIDTH / STAGE_WIDTH;

// On-screen footprint for the real <LiveScoreBar> we now mount directly
// in this document, bottom-left. LiveScoreBar's own internal "broadcast"
// layout renders its bar at `width: 90vw`; the override CSS below
// forces its width instead, so it reads as a large, legible bar next to
// the (much smaller, scaled-down) preview monitor, without editing
// LiveScoreBar.jsx itself.
//
// Instead of a fixed pixel width, this now stretches responsively:
// from the 16px left-edge margin all the way up to just short of the
// Live Preview Monitor's left edge (monitor width + its own 16px right
// margin + a small gap so the two never touch). Expressed as a CSS
// calc() so it stays correct if the viewport is resized.
const SCORE_BAR_LEFT_MARGIN = 16;
const SCORE_BAR_GAP_TO_MONITOR = 24;
const BIG_SCORE_BAR_WIDTH_CSS = `calc(100vw - ${MONITOR_WIDTH + 16 /* monitor's own right margin */ + SCORE_BAR_GAP_TO_MONITOR + SCORE_BAR_LEFT_MARGIN}px)`;

// How much bottom padding the scrollable scoring console needs so its
// last row of content never sits underneath the fixed, bottom-anchored
// LiveScoreBar once the console is scrolled all the way down. Sized
// generously above the bar's own on-screen height (it's not a fixed
// height we control — see the note by <BigScoreBarPositionOverride> —
// so this errs on the taller side plus its own 16px bottom offset,
// rather than trying to measure it exactly) with a little extra
// breathing room on top of that.
const SCORE_BAR_BOTTOM_CLEARANCE = 200;

// Themed scrollbars — applied globally (not scoped to one container) so
// every scrollable region on the page picks it up: the scoring console's
// own overflow-auto area, and anything with internal scroll inside
// LiveStatePanel, without having to touch that component. Rendered once
// in each view branch below since the browser-default scrollbar would
// otherwise stick out against the dark broadcast-console look the rest
// of the page uses. Firefox gets the scrollbar-width/scrollbar-color
// shorthand; everything Chromium/WebKit-based gets the ::-webkit-*
// pseudo-elements, since neither alone covers all browsers.
function ScrollbarTheme() {
  return (
    <style jsx global>{`
      * {
        scrollbar-width: thin;
        scrollbar-color: var(--color-border-overlay, rgba(255, 255, 255, 0.16)) transparent;
      }
      *::-webkit-scrollbar {
        width: 9px;
        height: 9px;
      }
      *::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.22);
      }
      *::-webkit-scrollbar-thumb {
        background-color: var(--color-border-overlay, rgba(255, 255, 255, 0.16));
        border-radius: 5px;
        border: 2px solid transparent;
        background-clip: padding-box;
      }
      *::-webkit-scrollbar-thumb:hover {
        background-color: color-mix(in srgb, var(--color-theme-orange) 55%, var(--color-border-overlay, rgba(255, 255, 255, 0.16)));
      }
      *::-webkit-scrollbar-corner {
        background: transparent;
      }
    `}</style>
  );
}

// ── Big Score Bar positioning override ──────────────────────────────
// LiveScoreBar.jsx is intentionally left untouched. Its "broadcast"
// layout hardcodes:
//   - a portaled wrapper: `fixed inset-x-0 bottom-0 ... flex-col
//     items-center ...` with `aria-live="polite"` on it
//   - an inner `.lsb-wrap` sized to `width: 90vw`, centered via
//     `origin-center`
// aria-live="polite" is the one identifying hook that wrapper exposes.
// IMPORTANT: this is a global, unscoped selector — it matches ANY
// aria-live="polite" element in the document, including the Live
// view's own LiveScoreBar (rendered inside BroadcastSurface). It is
// only safe to have this mounted while the control-view's LiveScoreBar
// is the ONLY one on screen — which is why both this component and the
// control-view LiveScoreBar below are now conditionally rendered
// together (`{view === "control" && (...)}`) rather than always
// mounted. Do not mount this while the Live view is showing.
function BigScoreBarPositionOverride() {
  return (
    <style jsx global>{`
      div[aria-live="polite"] {
        left: 16px !important;
        right: auto !important;
        bottom: 16px !important;
        align-items: flex-start !important;
        padding: 0 !important;
      }
      div[aria-live="polite"] .lsb-wrap {
        width: ${BIG_SCORE_BAR_WIDTH_CSS} !important;
        transform-origin: bottom left !important;
      }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/*  Local console atoms — same family as brackets/page.tsx's           */
/*  ControlCluster/Pill/ActionButton, so both sandboxes read as one    */
/*  product instead of two different UI kits.                          */
/* ------------------------------------------------------------------ */

function ControlCluster({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[9px] font-semibold uppercase"
        style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.13em", color: "var(--color-outline)" }}
      >
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Pill({
  id,
  active,
  onClick,
  children,
  title,
}: {
  id?: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      title={title}
      className="px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase whitespace-nowrap transition-colors"
      style={{
        fontFamily: "var(--font-label-mono)",
        letterSpacing: "0.09em",
        background: active ? "color-mix(in srgb, var(--color-theme-orange) 16%, transparent)" : "rgba(255,255,255,0.03)",
        boxShadow: active
          ? "inset 0 0 0 1px color-mix(in srgb, var(--color-theme-orange) 50%, transparent)"
          : "inset 0 0 0 1px var(--color-border-overlay)",
        color: active ? "var(--color-theme-orange)" : "var(--color-outline)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ConsoleActionButton({
  onClick,
  disabled,
  solid,
  icon,
  children,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  solid?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        fontFamily: "var(--font-label-mono)",
        letterSpacing: "0.08em",
        background: solid ? "linear-gradient(135deg,#A87815,#E8C468)" : "rgba(255,255,255,0.03)",
        boxShadow: solid ? "none" : "inset 0 0 0 1px var(--color-border-overlay)",
        color: solid ? "#1a1304" : "var(--color-on-surface)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

// ── Moment chyron — floating, non-blocking, keyed to replay its entrance
// on every new moment. Same visual family as the auction sandbox's
// CommentaryOverlay / the brackets sandbox's ChampionChyron: left accent
// rule doubling as the event's color key, mono event tag, italic
// headline text. Classified by moment type directly (not string-sniffed)
// since fireMoment already knows exactly what kind of event this is.
type FiredMoment = { id: number; moment: MomentPayload["moment"]; text: string };

const MOMENT_META: Record<MomentPayload["moment"], { accent: string; tag: string; icon: React.ReactNode }> = {
  four: { accent: "var(--color-theme-orange)", tag: "FOUR", icon: <Zap size={14} /> },
  six: { accent: "var(--color-theme-orange)", tag: "SIX", icon: <Zap size={14} /> },
  wicket: { accent: "#e5484d", tag: "WICKET", icon: <Target size={14} /> },
  fifty: { accent: "#4fd1c5", tag: "FIFTY", icon: <Trophy size={14} /> },
  hundred: { accent: "#4fd1c5", tag: "HUNDRED", icon: <Trophy size={14} /> },
  maiden: { accent: "#8b8bf5", tag: "MAIDEN", icon: <ShieldCheck size={14} /> },
  matchWon: { accent: "#3ddc84", tag: "MATCH WON", icon: <PartyPopper size={14} /> },
};

function MomentChyron({ fired }: { fired: FiredMoment | null }) {
  if (!fired) return null;
  const meta = MOMENT_META[fired.moment];
  return (
    <div className="pointer-events-none fixed top-[190px] left-1/2 -translate-x-1/2 z-40 flex flex-col items-center max-w-[560px] w-[92%]">
      <div
        key={fired.id}
        className="chyron-in flex items-stretch overflow-hidden rounded-[3px]"
        style={{
          background: "rgba(8,8,8,0.88)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 12px 30px -10px rgba(0,0,0,0.6)",
        }}
      >
        <span className="shrink-0" style={{ width: 3, background: meta.accent }} />
        <div className="flex items-center gap-3 pl-3.5 pr-4 py-2.5">
          <span style={{ color: meta.accent }}>{meta.icon}</span>
          <span
            className="shrink-0 text-[10px] uppercase font-semibold"
            style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.11em", color: meta.accent }}
          >
            {meta.tag}
          </span>
          <span className="w-px self-stretch bg-white/10" />
          <span
            className="text-[13px] leading-snug"
            style={{
              fontFamily: "var(--font-headline-lg)",
              fontStyle: "italic",
              fontWeight: 700,
              color: "var(--color-on-surface)",
            }}
          >
            {fired.text}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Live Preview Monitor — the small, always-on replica of the real    */
/*  broadcast surface, embedded directly in the Control view.          */
/* ------------------------------------------------------------------ */

function LivePreviewMonitor({ featuredMoment }: { featuredMoment: MomentPayload["moment"] | null }) {
  const onAir = !!featuredMoment;
  const meta = featuredMoment ? MOMENT_META[featuredMoment] : null;

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-1.5 pointer-events-none">
      <div
        className="relative overflow-hidden rounded-md transition-all duration-500 ease-out"
        style={{
          width: MONITOR_WIDTH,
          height: MONITOR_HEIGHT,
          transform: onAir ? "scale(1.06)" : "scale(1)",
          boxShadow: onAir
            ? `0 0 0 2px ${meta!.accent}, 0 20px 45px -14px color-mix(in srgb, ${meta!.accent} 55%, transparent)`
            : "0 0 0 1px var(--color-border-overlay), 0 16px 40px rgba(0,0,0,0.5)",
          background: "#000",
        }}
      >
        <div
          style={{
            width: STAGE_WIDTH,
            height: STAGE_HEIGHT,
            transform: `scale(${MONITOR_SCALE})`,
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          <iframe
            src="/sandbox/overlay/preview"
            title="Live preview monitor"
            scrolling="no"
            style={{
              width: STAGE_WIDTH,
              height: STAGE_HEIGHT,
              border: "none",
              display: "block",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Weather condition dropdown — a themed replacement for the native
// <select>.
function WeatherConditionSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const current = WEATHER_CONDITIONS.find((c) => c.value === value) ?? WEATHER_CONDITIONS[0];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase transition-colors focus:outline-none"
        style={{
          fontFamily: "var(--font-label-mono)",
          letterSpacing: "0.06em",
          background: open ? "color-mix(in srgb, var(--color-theme-orange) 12%, transparent)" : "rgba(255,255,255,0.03)",
          boxShadow: open
            ? "inset 0 0 0 1px color-mix(in srgb, var(--color-theme-orange) 45%, transparent)"
            : "inset 0 0 0 1px var(--color-border-overlay)",
          color: open ? "var(--color-theme-orange)" : "var(--color-on-surface)",
        }}
      >
        {current.label}
        <ChevronDown className="w-3 h-3 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-40 rounded-lg overflow-hidden py-1"
          style={{
            background: "rgba(12,12,12,0.97)",
            backdropFilter: "blur(10px)",
            border: "1px solid var(--color-border-overlay)",
            boxShadow: "0 20px 45px -8px rgba(0,0,0,0.6)",
          }}
        >
          {WEATHER_CONDITIONS.map((c) => {
            const active = c.value === value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  onChange(c.value);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-[10px] font-semibold uppercase transition-colors hover:bg-white/5"
                style={{
                  fontFamily: "var(--font-label-mono)",
                  letterSpacing: "0.06em",
                  background: active ? "color-mix(in srgb, var(--color-theme-orange) 16%, transparent)" : "transparent",
                  color: active ? "var(--color-theme-orange)" : "var(--color-on-surface)",
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scorecard accumulation types — see the header comment above for    */
/*  why this can't just read straight off liveState.                  */
/* ------------------------------------------------------------------ */

interface CardBatterLine { name: string; runs: number; balls: number; out?: string; }
interface CardBowlerLine { name: string; overs: string; figures: string; }
interface InningsCardSnapshot {
  label: string;
  score: string;
  overs: string;
  batting: CardBatterLine[];
  bowling: CardBowlerLine[];
}
type SandboxInningsCards = { 1?: InningsCardSnapshot; 2?: InningsCardSnapshot };

const DISMISSAL_SHORT: Record<string, string> = {
  bowled: "b", caught: "c", lbw: "lbw", runOut: "run out", stumped: "st",
  hitWicket: "hit wkt", caughtAndBowled: "c & b", retired: "retired",
  obstructingField: "obstructed", timedOut: "timed out",
};

export default function OverlaySandboxPage() {
  const matchSetup = HARDCODED_MATCH_SETUP;

  const [view, setView] = useState<ViewMode>("control");

  const [liveState, setLiveState] = useState(emptyLiveState);
  const [liveDirty, setLiveDirty] = useState(false);
  const [pushed, setPushed] = useState(false);
  const [engineSyncState, setEngineSyncState] = useState<any>(null);

  const [weatherData, setWeatherData] = useState(defaultWeather);
  const [channels, setChannels] = useState<SandboxChannels>(DEFAULT_CHANNELS);
  const [log, setLog] = useState<string[]>([]);
  const [firedMoment, setFiredMoment] = useState<FiredMoment | null>(null);
  const momentIdRef = useRef(0);

  // FIX: revert timer for the big floating chyron — previously only
  // the small Live Preview Monitor had one (previewRevertTimerRef
  // below); the chyron itself never cleared, so it just sat there
  // until the next moment overwrote it.
  const firedRevertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [featuredMoment, setFeaturedMoment] = useState<MomentPayload["moment"] | null>(null);
  const previewRevertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const busRef = useRef<ReturnType<typeof connectSandboxBus> | null>(null);

  const autoOffTimersRef = useRef<Partial<Record<keyof SandboxChannels, ReturnType<typeof setTimeout>>>>({});

  const matchBoundariesAutoEnabledRef = useRef(false);

  // ── Scorecard accumulation state/refs ─────────────────────────────
  const battingCardRef = useRef<Record<1 | 2, CardBatterLine[]>>({ 1: [], 2: [] });
  const bowlingCardRef = useRef<Record<1 | 2, CardBowlerLine[]>>({ 1: [], 2: [] });
  const prevBowlerRef = useRef<typeof liveState.bowler | null>(null);
  const prevBowlerInningsRef = useRef<1 | 2>(1);
  const [inningsCards, setInningsCards] = useState<SandboxInningsCards>({});

  const currentInnings = ((liveState.inningsNumber ?? 1) as 1 | 2);

  const stateSnapshotRef = useRef({ matchSetup, liveState, weatherData, channels, inningsCards });

  function clearPreviewRevert() {
    if (previewRevertTimerRef.current) {
      clearTimeout(previewRevertTimerRef.current);
      previewRevertTimerRef.current = null;
    }
  }

  function clearFiredRevert() {
    if (firedRevertTimerRef.current) {
      clearTimeout(firedRevertTimerRef.current);
      firedRevertTimerRef.current = null;
    }
  }

  function featurePreview(moment: MomentPayload["moment"]) {
    clearPreviewRevert();
    setFeaturedMoment(moment);
    previewRevertTimerRef.current = setTimeout(() => {
      previewRevertTimerRef.current = null;
      setFeaturedMoment(null);
    }, MOMENT_AUTO_REVERT_MS[moment] ?? 3500);
  }

  useEffect(() => clearPreviewRevert, []);
  useEffect(() => clearFiredRevert, []);

  useEffect(
    () => () => {
      Object.values(autoOffTimersRef.current).forEach((t) => clearTimeout(t));
    },
    []
  );

  useEffect(() => {
    const bus = connectSandboxBus();
    busRef.current = bus;

    const off = bus.on((msg) => {
      if (msg.type === "requestState") {
        bus.send({ type: "state", data: stateSnapshotRef.current });
      }
    });

    bus.send({ type: "state", data: stateSnapshotRef.current });

    return () => {
      off();
      bus.close();
      busRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    stateSnapshotRef.current = { matchSetup, liveState, weatherData, channels, inningsCards };
    busRef.current?.send({ type: "state", data: stateSnapshotRef.current });
  }, [matchSetup, liveState, weatherData, channels, inningsCards]);

  // Freezes a bowler's figures into the card the instant the bowler slot
  // changes to someone else — liveState only ever holds ONE bowler at a
  // time, so this is the only point their final figures can be captured
  // before they're overwritten.
  useEffect(() => {
    const prev = prevBowlerRef.current;
    const bowledAnything = !!prev && (prev.overs > 0 || prev.balls > 0);
    if (prev && bowledAnything && prev.name && prev.name !== liveState.bowler.name) {
      bowlingCardRef.current[prevBowlerInningsRef.current].push({
        name: prev.name,
        overs: `${prev.overs}.${prev.balls}`,
        figures: `${prev.wickets}-${prev.runs}`,
      });
    }
    prevBowlerRef.current = liveState.bowler;
    prevBowlerInningsRef.current = currentInnings;
  }, [liveState.bowler, currentInnings]);

  function buildCurrentInningsSnapshot(inn: 1 | 2, label: string): InningsCardSnapshot {
    const batting = [...battingCardRef.current[inn]];
    const bowling = [...bowlingCardRef.current[inn]];
    if (currentInnings === inn) {
      if (liveState.striker.name) batting.push({ name: liveState.striker.name, runs: liveState.striker.runs, balls: liveState.striker.balls });
      if (liveState.nonStriker.name) batting.push({ name: liveState.nonStriker.name, runs: liveState.nonStriker.runs, balls: liveState.nonStriker.balls });
      if (liveState.bowler.name) bowling.push({ name: liveState.bowler.name, overs: `${liveState.bowler.overs}.${liveState.bowler.balls}`, figures: `${liveState.bowler.wickets}-${liveState.bowler.runs}` });
    }
    return {
      label,
      score: `${liveState.score.runs}/${liveState.score.wickets}`,
      overs: `${liveState.score.overs}.${liveState.score.balls}`,
      batting,
      bowling,
    };
  }

  function goLive() {
    if (typeof window !== "undefined") {
      window.history.pushState({ sandboxOverlayLive: true }, "");
    }
    setView("live");
  }

  function backToControls() {
    if (typeof window !== "undefined" && (window.history.state as any)?.sandboxOverlayLive) {
      window.history.back();
    } else {
      setView("control");
    }
  }

  useEffect(() => {
    function onPopState() {
      setView("control");
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function logEvent(label: string) {
    setLog((prev) => [`${new Date().toLocaleTimeString("en-GB", { hour12: false })}  ${label}`, ...prev].slice(0, 14));
  }

  useEffect(() => {
    document.body.style.background = view === "live" ? "#000" : "";
    return () => {
      document.body.style.background = "";
    };
  }, [view]);

  function fireMoment(payload: MomentPayload) {
    const text = `${payload.player ? payload.player : ""}${payload.score ? ` ${payload.score}` : ""}`.trim() || payload.moment;
    momentIdRef.current += 1;
    setFiredMoment({ id: momentIdRef.current, moment: payload.moment, text });
    logEvent(`Moment: ${payload.moment.toUpperCase()}${payload.player ? ` — ${payload.player}` : ""}`);

    // FIX: the chyron used to have no revert of its own — it relied on
    // the *next* moment's setFiredMoment() call to overwrite it, so
    // between moments it just sat on screen indefinitely. Give it the
    // same auto-revert treatment as the Live Preview Monitor below,
    // using the same per-moment-type timing table so both go away in
    // sync.
    clearFiredRevert();
    firedRevertTimerRef.current = setTimeout(() => {
      firedRevertTimerRef.current = null;
      setFiredMoment(null);
    }, MOMENT_AUTO_REVERT_MS[payload.moment] ?? 3500);

    featurePreview(payload.moment);

    (window as any).triggerBoundaryCelebration?.(payload.moment, payload);
    busRef.current?.send({ type: "moment", moment: payload.moment, payload });
  }

  function teamVisualsByName(name: string): { color?: string; logoUrl?: string } {
    if (matchSetup.teamA.name === name) return { color: matchSetup.teamA.color, logoUrl: matchSetup.teamA.logoUrl };
    if (matchSetup.teamB.name === name) return { color: matchSetup.teamB.color, logoUrl: matchSetup.teamB.logoUrl };
    return {};
  }

  function handleBoundary(moment: "four" | "six", batter: { name: string; runs: number; balls: number }) {
    if (!matchBoundariesAutoEnabledRef.current) {
      matchBoundariesAutoEnabledRef.current = true;
      if (!channels.matchBoundaries) {
        setChannels((prev) => ({ ...prev, matchBoundaries: true }));
        logEvent(`${CHANNEL_LABELS.matchBoundaries} auto-shown — first boundary`);
      }
    }
    fireMoment({ moment, player: batter.name || "Striker", score: `${batter.runs}(${batter.balls})` });
  }

  function handleMilestone(moment: "fifty" | "hundred", batter: { name: string; runs: number; balls: number; label?: string }) {
    fireMoment({ moment, player: batter.label ?? batter.name ?? "Batter", score: `${batter.runs}(${batter.balls})` });
  }

  // FIX: this used to only fire the chyron/moment — the dismissed
  // batter's final line never made it into battingCardRef, so they'd
  // silently disappear from the scorecard the instant the next batter
  // walked in and overwrote liveState.striker/nonStriker.
  function handleWicket(payload: {
    batsmanOut: "striker" | "nonStriker";
    batter: { name: string; runs: number; balls: number };
    dismissalType: DismissalType;
    fielder: string;
    bowlerName: string;
  }) {
    battingCardRef.current[currentInnings].push({
      name: payload.batter.name || (payload.batsmanOut === "striker" ? "Striker" : "Non-striker"),
      runs: payload.batter.runs,
      balls: payload.batter.balls,
      out: DISMISSAL_SHORT[payload.dismissalType] ?? payload.dismissalType,
    });

    fireMoment({
      moment: "wicket",
      batsmanOut: payload.batsmanOut,
      player: payload.batter.name || (payload.batsmanOut === "striker" ? "Striker" : "Non-striker"),
      score: `${payload.batter.runs}(${payload.batter.balls})`,
      dismissalType: payload.dismissalType,
      bowler: payload.bowlerName,
      fielder: payload.fielder,
    });
  }

  function handleMaiden(payload: { bowlerName: string; maidens: number }) {
    fireMoment({ moment: "maiden", bowler: payload.bowlerName, maidens: payload.maidens });
  }

  function handleMatchWonAuto(payload: {
    winningTeamName: string;
    margin: string;
    method: "runs" | "wickets" | "tie";
    teamColor?: string;
    teamLogoUrl?: string;
  }) {
    const visuals = teamVisualsByName(payload.winningTeamName);
    fireMoment({
      moment: "matchWon",
      player: payload.winningTeamName,
      score: payload.margin,
      method: payload.method,
      teamColor: payload.teamColor ?? visuals.color,
      teamLogoUrl: payload.teamLogoUrl ?? visuals.logoUrl,
    });
  }

  // FIX: now freezes the 1st innings card into inningsCards and resets
  // the 2nd innings ledger so the chase starts from a clean slate.
  function handleInningsEnd(payload: { target: number; previousInningsRuns: number; inningsNumber: 1 | 2 }) {
    matchBoundariesAutoEnabledRef.current = false;
    setInningsCards((prev) => ({ ...prev, 1: buildCurrentInningsSnapshot(1, "1st Innings") }));
    battingCardRef.current[2] = [];
    bowlingCardRef.current[2] = [];
    prevBowlerRef.current = null;
    logEvent(`Innings ended — target set to ${payload.target}`);
  }

  // FIX: now freezes the 2nd innings card into inningsCards so the
  // Scorecard channel has both innings once the match is over.
  function handleMatchComplete(result: { winningTeamName: string; margin: string; method: "batting" | "bowling" | "tie" | "runs" | "wickets" }) {
    setInningsCards((prev) => ({ ...prev, 2: buildCurrentInningsSnapshot(2, "2nd Innings") }));
    logEvent(`Match complete — ${result.winningTeamName} ${result.margin}`);
  }

  // FIX: clears the scorecard accumulation (refs + inningsCards state)
  // alongside the rest of liveState, so a restarted match doesn't carry
  // over the previous match's batting/bowling cards.
  function restartMatch() {
    setLiveState((prev) => ({
      score: { runs: 0, wickets: 0, overs: 0, balls: 0 },
      striker: emptyBatter(),
      nonStriker: emptyBatter(),
      bowler: emptyBowler(),
      partnership: { runs: 0, balls: 0 },
      matchBoundaries: { fours: 0, sixes: 0 },
      tournamentBoundaries: prev.tournamentBoundaries,
      pointsTable: prev.pointsTable,
      target: undefined,
      inningsNumber: undefined,
      matchComplete: false,
      matchResult: undefined,
      thisOver: [],
    }));
    battingCardRef.current = { 1: [], 2: [] };
    bowlingCardRef.current = { 1: [], 2: [] };
    prevBowlerRef.current = null;
    setInningsCards({});
    setLiveDirty(true);
    setEngineSyncState(null);
    matchBoundariesAutoEnabledRef.current = false;
    logEvent("Match restarted — same teams & squads");
  }

  function handlePush() {
    setPushed(true);
    setLiveDirty(false);
    logEvent("Live State pushed");
    setTimeout(() => setPushed(false), 1200);
  }

  function pushWeather() {
    setChannels((prev) => ({ ...prev, weather: true }));
    logEvent(`Weather pushed — ${weatherData.venue}: ${weatherData.temp}°${weatherData.unit}, ${weatherData.condition}`);
  }

  function toggleChannel(key: keyof SandboxChannels) {
    const turningOn = !channels[key];
    setChannels((prev) => ({ ...prev, [key]: !prev[key] }));
    logEvent(`${CHANNEL_LABELS[key]} ${turningOn ? "shown" : "hidden"}`);

    const autoOffMs = AUTO_OFF_CHANNEL_DURATIONS[key];
    if (autoOffMs !== undefined) {
      const existing = autoOffTimersRef.current[key];
      if (existing) {
        clearTimeout(existing);
        delete autoOffTimersRef.current[key];
      }
      if (turningOn) {
        autoOffTimersRef.current[key] = setTimeout(() => {
          delete autoOffTimersRef.current[key];
          setChannels((prev) => ({ ...prev, [key]: false }));
          logEvent(`${CHANNEL_LABELS[key]} auto-hidden`);
        }, autoOffMs);
      }
    }
  }

  // ── CONTROL VIEW ─────────────────────────────────────────────────────
  //
  // CHANGED: the Live view used to be an entirely separate early
  // `return`, which meant flipping to Live UNMOUNTED this whole tree —
  // including <LiveStatePanelAuto> and, with it, the ScriptedDriver
  // instance living inside it (see the driverRef useEffect cleanup in
  // LiveStatePanelAuto.tsx, which calls driver.stop() on unmount). Every
  // "Flip to Live" silently paused the auto-demo, and every "Back to
  // Controls" remounted a brand new driver, which is NOT the same thing
  // as "the match kept playing in the background."
  //
  // Now there's a single `return` below that always renders BOTH the
  // control layout and the live broadcast layer — whichever one isn't
  // current is hidden with `display: none` rather than unmounted, so
  // React state updates (and the driver's own setTimeout-based loop)
  // keep running underneath exactly as before, regardless of which one
  // is currently visible on screen. The live broadcast layer is still
  // conditionally rendered (`{view === "live" && (...)}`) since
  // BroadcastSurface holds no state that needs to survive being hidden —
  // it's fully driven by props (liveState/channels/etc.) that live up
  // here in this component either way.
  //
  // The control-view LiveScoreBar + its position override CSS are ALSO
  // now conditionally rendered (`{view === "control" && (...)}`) rather
  // than always-mounted — see the FIX comment on
  // <BigScoreBarPositionOverride /> above for why: unlike the scoring
  // panel, neither of these holds state that needs to survive a flip,
  // and leaving them mounted let their global CSS override silently
  // squash the Live view's own LiveScoreBar down to the same small
  // corner size.
  //
  // One caveat: WicketDetailDialog / EndInningsDialog / RestartMatchDialog
  // inside LiveStatePanel portal straight to document.body (same reason
  // LiveScoreBar does), so `display: none` on their control-view ancestor
  // doesn't hide them. In the rare case one of those is open at the exact
  // moment "Flip to Live" is clicked, it'll still show up floating over
  // the broadcast surface until it's dismissed. Not worth solving for
  // here — it resolves itself the moment that dialog is closed.
  const scoreReadout = `${liveState.score.runs}/${liveState.score.wickets} (${liveState.score.overs}.${liveState.score.balls})`;
  const inningsLabel = liveState.matchComplete
    ? "Match Complete"
    : liveState.target !== undefined
    ? `Innings ${liveState.inningsNumber ?? 2} · Chasing ${liveState.target}`
    : `Innings ${liveState.inningsNumber ?? 1}`;

  return (
    <>
    <div
      className="h-screen w-screen overflow-hidden relative flex flex-col"
      style={{
        background: "var(--color-background)",
        color: "var(--color-on-background)",
        // Hidden (not unmounted) while the Live view is showing — see
        // the big comment above for why this matters.
        display: view === "live" ? "none" : "flex",
      }}
    >
      <ScrollbarTheme />
      <style jsx global>{`
        @keyframes sandboxFeedPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @keyframes chyronIn {
          0% { opacity: 0; transform: translateY(-16px) scale(0.97); }
          55% { opacity: 1; transform: translateY(2px) scale(1.005); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .chyron-in {
          animation: chyronIn 380ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .overlay-sandbox-scanlines {
          background-image: repeating-linear-gradient(
            0deg,
            rgba(255, 255, 255, 0.012) 0px,
            rgba(255, 255, 255, 0.012) 1px,
            transparent 1px,
            transparent 3px
          );
        }
      `}</style>

      <div
        className="pointer-events-none absolute inset-0 z-0 overlay-sandbox-scanlines"
        style={{
          background:
            "radial-gradient(900px 380px at 50% 0%, color-mix(in srgb, var(--color-theme-orange) 7%, transparent), transparent 65%), " +
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "auto, 48px 48px, 48px 48px",
        }}
      />

      {/* ── Console header ────────────────────────────────────────── */}
      <div
        className="shrink-0 h-11 flex items-center justify-between px-4 relative z-20"
        style={{
          background: "linear-gradient(180deg, var(--color-surface-container-low), var(--color-surface-dim))",
          borderBottom: "1px solid var(--color-border-overlay)",
          boxShadow: "0 1px 0 rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-[3px] shrink-0"
            style={{
              background: "color-mix(in srgb, var(--color-theme-orange) 14%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-theme-orange) 45%, transparent)",
            }}
          >
            <span
              className="w-[7px] h-[7px] rounded-full"
              style={{
                background: "var(--color-theme-orange)",
                animation: "sandboxFeedPulse 1.6s ease-in-out infinite",
                boxShadow: "0 0 6px 1px color-mix(in srgb, var(--color-theme-orange) 60%, transparent)",
              }}
            />
            <span
              className="text-[10px] font-semibold uppercase"
              style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.11em", color: "var(--color-theme-orange)" }}
            >
              Sandbox
            </span>
          </div>

          <span className="w-px h-5 shrink-0" style={{ background: "var(--color-border-overlay)" }} />

          <span
            className="text-[12px] shrink-0"
            style={{ color: "var(--color-outline)", fontFamily: "var(--font-label-mono)" }}
          >
            {matchSetup.teamA.shortCode} vs {matchSetup.teamB.shortCode}
          </span>

          <span
            className="text-[12px] tabular-nums px-1.5 py-0.5 rounded-[2px] shrink-0"
            style={{
              fontFamily: "var(--font-headline-lg)",
              fontStyle: "italic",
              fontWeight: 700,
              color: "var(--color-theme-orange)",
              letterSpacing: "0.03em",
              background: "rgba(0,0,0,0.35)",
              border: "1px solid var(--color-border-overlay)",
            }}
          >
            {scoreReadout}
          </span>

          <div
            className="hidden md:flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-[3px] shrink-0"
            style={{ background: "rgba(0,0,0,0.22)", border: "1px solid var(--color-border-overlay)" }}
          >
            <span
              className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-[2px]"
              style={{
                fontFamily: "var(--font-label-mono)",
                letterSpacing: "0.06em",
                color: liveState.matchComplete ? "#08110c" : "var(--color-on-surface)",
                background: liveState.matchComplete ? "#3ddc84" : "transparent",
              }}
            >
              {inningsLabel}
            </span>
          </div>

          <span
            className="hidden lg:inline text-[10px] truncate"
            style={{ color: "var(--color-outline)", fontFamily: "var(--font-label-mono)" }}
          >
            hardcoded squads · no backend
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ConsoleActionButton onClick={restartMatch} icon={<RotateCcw className="w-2.5 h-2.5" />}>
            Restart
          </ConsoleActionButton>
          <ConsoleActionButton
            onClick={goLive}
            solid
            icon={<MonitorPlay className="w-2.5 h-2.5" />}
            title="Switch this tab into the actual broadcast surface"
          >
            Flip to Live
          </ConsoleActionButton>
        </div>
      </div>

      {/* ── Control deck ─────────────────────────────────────────── */}
      <div
        className="shrink-0 relative z-20"
        style={{ background: "rgba(10,10,10,0.35)", borderBottom: "1px solid var(--color-border-overlay)" }}
      >
        <div className="flex flex-wrap items-start gap-x-8 gap-y-4 px-5 py-4">
          <ControlCluster label="On Air Channels">
            {(Object.keys(CHANNEL_LABELS) as (keyof SandboxChannels)[]).map((key) => (
              <Pill key={key} id={CHANNEL_DEMO_IDS[key]} active={channels[key]} onClick={() => toggleChannel(key)}>
                {CHANNEL_LABELS[key]}
              </Pill>
            ))}
          </ControlCluster>

          <ControlCluster label="Weather">
            <input
              type="number"
              value={weatherData.temp}
              onChange={(e) => setWeatherData((p) => ({ ...p, temp: Number(e.target.value) || 0 }))}
              className="w-16 px-2 py-1.5 rounded-full text-[10px] font-bold text-center focus:outline-none"
              style={{
                fontFamily: "var(--font-label-mono)",
                background: "rgba(255,255,255,0.03)",
                boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                color: "var(--color-on-surface)",
              }}
            />
            <WeatherConditionSelect
              value={weatherData.condition}
              onChange={(condition) => setWeatherData((p) => ({ ...p, condition }))}
            />
            <ConsoleActionButton onClick={pushWeather} icon={<CloudSun className="w-2.5 h-2.5" />}>
              Push Weather
            </ConsoleActionButton>
          </ControlCluster>
        </div>

        <div
          className="flex items-start gap-3 px-5 py-2.5"
          style={{ background: "rgba(0,0,0,0.22)", borderTop: "1px solid var(--color-border-overlay)" }}
        >
          <span
            className="text-[9px] font-semibold uppercase shrink-0 pt-0.5"
            style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.1em", color: "var(--color-outline)" }}
          >
            Event Feed
          </span>
          <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
            {log.length === 0 ? (
              <span
                className="text-[10px]"
                style={{ fontFamily: FONT_BODY, color: "var(--color-outline)" }}
              >
                Nothing fired yet — tap the ball pad to start scoring.
              </span>
            ) : (
              log.slice(0, 6).map((l, i) => (
                <span
                  key={i}
                  className="text-[10px] truncate max-w-[280px]"
                  style={{ fontFamily: "var(--font-label-mono)", color: i === 0 ? "var(--color-on-surface)" : "var(--color-outline)" }}
                >
                  {l}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <MomentChyron fired={firedMoment} />

      {/* ── Scoring console — now backed by LiveStatePanelAuto, which
            owns the demo/interactive toggle and pause/resume itself and
            renders LiveStatePanel underneath with the same props this
            page always passed it. ── */}
      {/* pb is intentionally larger than the top/side padding — the real
          LiveScoreBar is fixed-positioned at the bottom of the viewport
          (see <LiveScoreBar> render below), so without this the console's
          last row (Partnership / Match 4s-6s / Tourn. 4s-6s / Bowler
          Figures tiles) sits directly underneath it once scrolled all
          the way down. SCORE_BAR_BOTTOM_CLEARANCE keeps that last row
          fully visible above the bar instead of tucking behind it. */}
      <div
        className="flex-1 min-h-0 overflow-auto relative z-10 px-5 pt-5"
        style={{ paddingBottom: SCORE_BAR_BOTTOM_CLEARANCE }}
      >
        <div
          className="rounded-xl p-5"
          style={{
            background: "rgba(10,10,10,0.35)",
            border: "1px solid var(--color-border-overlay)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          <LiveStatePanelAuto
            matchId={null}
            liveState={liveState}
            setLiveState={setLiveState}
            setLiveDirty={setLiveDirty}
            liveDirty={liveDirty}
            onPush={handlePush}
            pushLabel={pushed ? "Pushed ✓" : "Push Live State"}
            matchSetup={matchSetup}
            onBoundary={handleBoundary}
            onMilestone={handleMilestone}
            onWicketConfirm={handleWicket}
            onMaiden={handleMaiden}
            onInningsEnd={handleInningsEnd}
            onMatchComplete={handleMatchComplete}
            onFireMatchWonMoment={handleMatchWonAuto}
            onRestartMatch={restartMatch}
            initialEngineState={engineSyncState}
            onEngineStateChange={setEngineSyncState}
            logEvent={logEvent}
            defaultMode="demo"
          />
        </div>
      </div>

      <LivePreviewMonitor featuredMoment={featuredMoment} />

      {/* FIX: BigScoreBarPositionOverride + the control-view's
          LiveScoreBar are now fully unmounted (not just toggled via
          `show`) whenever we're not on the control view. Both are pure,
          derived-only-from-props/state — nothing here needs to survive
          a flip to Live — and mounting the override's global <style>
          tag at the same time as the Live view's own LiveScoreBar (from
          BroadcastSurface) let its unscoped `div[aria-live="polite"]`
          selector squash THAT bar down to this corner's small size too,
          since both bars share the same portaled-to-body attribute with
          no DOM relationship distinguishing them. Conditionally
          rendering removes the override CSS from the document entirely
          while Live is showing, so BroadcastSurface's LiveScoreBar
          renders at its real, full broadcast size. */}
      {view === "control" && (
        <>
          <BigScoreBarPositionOverride />
          <LiveScoreBar
            show={channels.liveScoreBar}
            hideTrigger
            liveState={liveState}
            matchSetup={matchSetup}
          />
        </>
      )}
    </div>

    {/* ── LIVE VIEW ──────────────────────────────────────────────────
          Conditionally rendered (not just hidden) — unlike the control
          view above, nothing here needs to survive being unmounted:
          BroadcastSurface is fully driven by the same liveState/
          channels/etc. props that live in this component regardless of
          which layer is on screen, so remounting it on every flip just
          re-plays its entrance animations, which is the correct,
          expected behavior for a "go live" cut.

          FIX: this wrapper used to be `fixed inset-0 z-[9500]`. The
          overlay components rendered by <BroadcastSurface> all portal
          straight to document.body, so they are NOT descendants of
          this div and don't inherit its stacking context — only the
          <video> backdrop actually is. But `position: fixed` plus an
          explicit z-index still creates a real stacking context for
          this div, and z-[9500] put that context (video included)
          above every one of those portaled overlays' own, much lower
          z-indices — hiding all of them behind solid video, which is
          exactly the "only the video is showing" symptom. There was
          never a reason for this wrapper itself to out-rank anything:
          the control view is already kept out of the way via
          `display: none` above, regardless of z-index. Dropping the
          z-index here lets the overlay components stack correctly
          above the video again, same as they do on the real broadcast
          page. Only the two controls that ARE real children of this
          div — "Back to Controls" and the "Sandbox Feed" badge — keep
          their own z-[9999] so they stay above the video and the
          portaled overlays alike. ── */}
    {view === "live" && (
      <div className="fixed inset-0" style={{ background: "#000" }}>
        <BroadcastSurface
          channels={channels}
          liveState={liveState}
          weatherData={weatherData}
          matchSetup={matchSetup}
          inningsCards={inningsCards}
        />

        <button
          type="button"
          onClick={backToControls}
          className="fixed top-1/2 left-3 -translate-y-1/2 z-[9999] flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all opacity-70 hover:opacity-100 hover:brightness-110"
          style={{
            fontFamily: "var(--font-label-mono)",
            background: "rgba(13,17,23,0.9)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "var(--color-on-surface)",
            backdropFilter: "blur(6px)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          }}
        >
          <LayoutPanelLeft className="w-3 h-3" />
          Back to Controls
        </button>

        <div
          className="fixed top-1/2 right-3 -translate-y-1/2 z-[9999] flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-[3px] opacity-70 hover:opacity-100 transition-opacity"
          style={{
            background: "color-mix(in srgb, #e5484d 16%, transparent)",
            border: "1px solid color-mix(in srgb, #e5484d 45%, transparent)",
            backdropFilter: "blur(6px)",
          }}
        >
          <span
            className="w-[7px] h-[7px] rounded-full bg-[#e5484d]"
            style={{ animation: "sandboxFeedPulse 1.6s ease-in-out infinite", boxShadow: "0 0 6px 1px rgba(229,72,77,0.6)" }}
          />
          <span
            className="text-[9px] font-bold uppercase"
            style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.16em", color: "#e5484d" }}
          >
            Sandbox Feed
          </span>
        </div>
      </div>
    )}
    </>
  );
}