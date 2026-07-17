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
// iframe's document without a server round trip. This reintroduces the
// second route + cross-document channel an earlier version of this file
// deliberately removed — that tradeoff is intentional this time,
// specifically to keep the overlay components themselves untouched
// rather than special-casing them for scaled rendering.
//
// NOTE on the monitor iframe's lifecycle: LivePreviewMonitor only
// renders in the "control" branch below, so it (and its <iframe>) is
// destroyed and rebuilt every time you flip to Live and back. This page
// component itself does NOT unmount on that switch — it just swaps
// which JSX branch it returns — so liveState/channels/weatherData here
// stay intact the whole time. The freshly-remounted iframe re-requests
// a snapshot on mount (see /preview/page.tsx), and the "requestState"
// handler below MUST answer with a live-updating ref
// (stateSnapshotRef), not the plain closed-over state variables — a
// handler set up once in a mount-only effect would otherwise always
// answer with whatever those variables were at first mount, which is
// exactly the bug where the monitor comes back showing only the
// default-on channel (Score Bar) after a round trip through Live, even
// though every toggle you made is still sitting right there in this
// page's own state.
//
// On a moment firing, the monitor transitions into a clearly-different
// "On Air" state (glowing ring, pulsing dot, slight scale-up) with an
// eased CSS transition so the change reads as deliberate, not a snap.
// It then HOLDS that featured state for MOMENT_AUTO_REVERT_MS[moment] —
// matched to how long each celebration actually plays — before easing
// back down to the normal "Live Preview" state. Firing a new moment
// while one is already featured just resets the hold (see
// featurePreview()), so it can never get stuck mid-transition.

"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DismissalType } from "@/hooks/useLiveScoringEngine";
import type { MomentPayload } from "@/lib/overlayBus";

import LiveStatePanel from "@/components/overlays/admin/LiveStatePanel";
import BroadcastSurface from "@/components/demo/BroadcastSurface";
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
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
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
    // top-[190px] clears the console header (44px) + the control deck
    // below it (channel pills row + weather row + event feed strip,
    // ~140px combined) with a small buffer — it used to sit at top-16
    // (64px), which landed squarely on top of the "On Air Channels"
    // pill row and hid whichever channels happened to be underneath it.
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
/*  broadcast surface, embedded directly in the Control view. Backed    */
/*  by an <iframe> loading /sandbox/overlay/preview (its own document,  */
/*  so overlay portals land correctly instead of escaping a scaled div) */
/*  scaled down visually via a CSS transform on its wrapper. On a       */
/*  moment it transitions into a clearly distinct "On Air" state        */
/*  (glowing ring + pulsing dot + slight scale-up), holds there, then    */
/*  eases back — see featurePreview() in the page component for the     */
/*  enter/hold/revert timing.                                           */
/* ------------------------------------------------------------------ */

function LivePreviewMonitor({ featuredMoment }: { featuredMoment: MomentPayload["moment"] | null }) {
  const onAir = !!featuredMoment;
  const meta = featuredMoment ? MOMENT_META[featuredMoment] : null;

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-1.5 pointer-events-none">
      {/* The monitor frame. The scale-up + glow transition is the "clear
          transition" the enter/hold/revert cycle hinges on — 500ms
          eased both ways so entering and leaving read as deliberate
          rather than a snap-cut. Duration of the hold in between is
          controlled entirely by the caller via featuredMoment's
          lifetime (see featurePreview()). */}
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
        {/* Fixed-size wrapper at native broadcast resolution, scaled
            down to the monitor's footprint. The iframe's OWN width/
            height stay at STAGE_WIDTH/STAGE_HEIGHT — the transform only
            changes how big it looks, not its internal layout viewport —
            so /preview's "fixed inset-0" content lays out exactly like
            the real Live view, just shrunk on screen. */}
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
// <select>. Native selects can only be styled up to the closed trigger;
// the OPEN option list is rendered by the browser/OS itself and ignores
// app CSS entirely, which is exactly why it was showing up as a plain
// white system list against this dark console. This rebuilds it as a
// regular button + absolutely-positioned panel so every pixel of it —
// trigger and open list both — follows the same dark/mono/gold language
// as the rest of the control deck (Pill's active-state treatment, same
// glass-panel look as the monitor frame). Closes on outside click,
// Escape, or picking an option.
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

  // Which moment (if any) the Live Preview Monitor should currently be
  // "featuring" — i.e. showing its glowing On Air state for. Separate
  // from firedMoment (which only drives the chyron + event log) so the
  // monitor's enter/hold/revert cycle can be reasoned about on its own.
  const [featuredMoment, setFeaturedMoment] = useState<MomentPayload["moment"] | null>(null);
  const previewRevertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bus connection to the monitor iframe's separate document. Kept in a
  // ref (not state) since it's an imperative handle, not something that
  // should trigger a re-render.
  const busRef = useRef<ReturnType<typeof connectSandboxBus> | null>(null);

  // Timers for auto-off channels — see AUTO_OFF_CHANNEL_DURATIONS. Keyed
  // per-channel so Match Intro and Scorecard (or any future timed
  // channel) can each hold their own independent timer without
  // stepping on each other.
  const autoOffTimersRef = useRef<Partial<Record<keyof SandboxChannels, ReturnType<typeof setTimeout>>>>({});

  // Whether the Match 4s/6s channel has already been auto-enabled for
  // the CURRENT innings. Fires exactly once — on the first four or six
  // of an innings, matchBoundaries gets turned on automatically (if it
  // isn't already). After that, this flag stops it from re-forcing the
  // channel back on, so the operator's own manual toggle is respected
  // for the rest of the innings — it behaves like a default that only
  // applies once. Reset to false on a new innings / restart so the next
  // innings gets its own "first boundary" moment.
  const matchBoundariesAutoEnabledRef = useRef(false);

  // Always-current snapshot of everything the monitor iframe needs to
  // render. This exists specifically so the "requestState" responder in
  // the mount-only effect below never answers from a stale closure.
  // That effect runs exactly once (empty deps) and sets up a message
  // handler; without this ref, that handler would forever close over
  // matchSetup/liveState/weatherData/channels as they were at the very
  // first render, and would keep answering every future requestState
  // with those original values. That's the exact bug where flipping to
  // Live and back destroys + remounts the monitor's iframe (see
  // LivePreviewMonitor — it isn't rendered in the "live" branch), the
  // iframe re-asks "what's current?" on mount, and it used to get told
  // "the initial defaults" instead of whatever channels/liveState this
  // page's own state currently holds — so the monitor came back showing
  // only the Score Bar (the one channel that's on by default) even
  // though the real page still had everything else toggled on.
  const stateSnapshotRef = useRef({ matchSetup, liveState, weatherData, channels });

  function clearPreviewRevert() {
    if (previewRevertTimerRef.current) {
      clearTimeout(previewRevertTimerRef.current);
      previewRevertTimerRef.current = null;
    }
  }

  // Enter → hold → revert. Entering is instant (the CSS transition on
  // the monitor itself is what makes it *look* smooth); the hold length
  // is however long that moment's celebration actually plays for; the
  // revert is the same CSS transition easing back down. A new moment
  // firing mid-hold just resets the timer to the new moment, so back-to-
  // back boundaries never get cut short awkwardly.
  function featurePreview(moment: MomentPayload["moment"]) {
    clearPreviewRevert();
    setFeaturedMoment(moment);
    previewRevertTimerRef.current = setTimeout(() => {
      previewRevertTimerRef.current = null;
      setFeaturedMoment(null);
    }, MOMENT_AUTO_REVERT_MS[moment] ?? 3500);
  }

  useEffect(() => clearPreviewRevert, []);

  useEffect(
    () => () => {
      Object.values(autoOffTimersRef.current).forEach((t) => clearTimeout(t));
    },
    []
  );

  // Set up the bus once on mount: respond to the monitor iframe's
  // initial "requestState" with a fresh snapshot, and send one
  // proactively right away too, in case the iframe's own requestState
  // message beats this listener into existence (unlikely, but free to
  // guard against).
  //
  // IMPORTANT: the requestState responder reads stateSnapshotRef.current
  // — NOT the matchSetup/liveState/weatherData/channels variables in
  // this closure directly. Those variables are only ever what they were
  // at the moment this effect ran (mount), because the effect has an
  // empty dependency array and is deliberately not re-created on every
  // state change (that's the job of the second effect below). Reading
  // them directly here would mean every "requestState" — including the
  // one the monitor iframe sends every time it remounts after a Flip to
  // Live → Back to Controls round trip — gets answered with whatever
  // state existed on the very first render, not the current state.
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
    // Intentionally only on mount — the effect below keeps the ref (and
    // the iframe) in sync on every subsequent change instead of
    // re-subscribing here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync the monitor iframe's document any time state it needs to
  // render changes — it has no other way to find out, since it's a
  // separate document/window from this page. This is also the ONLY
  // place stateSnapshotRef gets updated, which is what keeps the
  // requestState responder above answering with live data instead of
  // mount-time data.
  useEffect(() => {
    stateSnapshotRef.current = { matchSetup, liveState, weatherData, channels };
    busRef.current?.send({ type: "state", data: stateSnapshotRef.current });
  }, [matchSetup, liveState, weatherData, channels]);

  function goLive() {
    // Push a history entry marking "we're in Live view" BEFORE switching
    // state. Without this, Live/Control is pure React state — the
    // browser is still sitting on whatever history entry it was on when
    // /sandbox/overlay first loaded. On mobile especially, a single
    // back-swipe from Live would then skip straight past this page
    // entirely (to a different site, or close the tab if there's no
    // prior entry) instead of just backing out of the broadcast view.
    // Pushing this marker gives the back button something of ours to
    // consume first.
    if (typeof window !== "undefined") {
      window.history.pushState({ sandboxOverlayLive: true }, "");
    }
    setView("live");
  }

  function backToControls() {
    // If we're on the history entry goLive() pushed, go back through it
    // rather than calling setView directly — that pops the marker AND
    // fires the popstate listener below (which does the actual
    // setView("control")), so there's exactly one code path for "how do
    // we get back to Controls," whether it's triggered by this button
    // or the browser's own back button. Falls back to a plain setView
    // for the rare case there's no pushed marker to unwind (e.g. this
    // got called without goLive ever having run).
    if (typeof window !== "undefined" && (window.history.state as any)?.sandboxOverlayLive) {
      window.history.back();
    } else {
      setView("control");
    }
  }

  // Catches the browser/phone back button (or trackpad back-gesture)
  // while in Live view and routes it to Controls instead of letting it
  // fall through to whatever the browser would otherwise show — the
  // page before this one in history, or closing the tab if there isn't
  // one. Also fires (harmlessly) if popstate happens for some other
  // reason while already in Controls, since landing on Controls is a
  // no-op there.
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

  // Body background: normal app background in "control" view. In "live"
  // view the video backdrop covers the frame, so this is just a safe
  // fallback color while it buffers.
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

    // No auto-flipping the whole tab to Live — the scorer stays on the
    // control deck. The Live Preview Monitor picks up the moment
    // instead, transitioning into its On Air state.
    featurePreview(payload.moment);

    // Trigger the celebration in THIS window (covers the full-screen
    // Live view, which renders <BroadcastSurface> directly in this same
    // document) AND broadcast it over the bus so the monitor iframe's
    // separate window/document triggers its own copy too — a window-
    // scoped global function call in this document never reaches a
    // different document's window on its own.
    (window as any).triggerBoundaryCelebration?.(payload.moment, payload);
    busRef.current?.send({ type: "moment", moment: payload.moment, payload });
  }

  function teamVisualsByName(name: string): { color?: string; logoUrl?: string } {
    if (matchSetup.teamA.name === name) return { color: matchSetup.teamA.color, logoUrl: matchSetup.teamA.logoUrl };
    if (matchSetup.teamB.name === name) return { color: matchSetup.teamB.color, logoUrl: matchSetup.teamB.logoUrl };
    return {};
  }

  function handleBoundary(moment: "four" | "six", batter: { name: string; runs: number; balls: number }) {
    // First boundary of the innings: turn Match 4s/6s on automatically
    // if it isn't already, then leave it alone for the rest of the
    // innings — the operator's own toggling takes over from here.
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

  function handleWicket(payload: {
    batsmanOut: "striker" | "nonStriker";
    batter: { name: string; runs: number; balls: number };
    dismissalType: DismissalType;
    fielder: string;
    bowlerName: string;
  }) {
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

  function handleInningsEnd(payload: { target: number; previousInningsRuns: number; inningsNumber: 1 | 2 }) {
    matchBoundariesAutoEnabledRef.current = false;
    logEvent(`Innings ended — target set to ${payload.target}`);
  }

  function handleMatchComplete(result: { winningTeamName: string; margin: string; method: "batting" | "bowling" | "tie" | "runs" | "wickets" }) {
    logEvent(`Match complete — ${result.winningTeamName} ${result.margin}`);
  }

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

    // Channels listed in AUTO_OFF_CHANNEL_DURATIONS are timed graphics
    // (Match Intro, Scorecard) rather than persistent ones — turning
    // one on also arms a timer that flips it back off once its display
    // window is up. Toggling it off manually (or back on again) before
    // that clears/resets the timer, same idea as featurePreview() above
    // for the monitor's on-air hold. Every channel NOT in that map
    // (Score Bar included) is purely manual: no timer, ever.
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

  // ── LIVE VIEW — the actual broadcast surface, same tab, same document
  //     (so its overlay portals land on this real page directly — no
  //     iframe needed here, only the small Control-view monitor needs
  //     one). ────────────────────────────────────────────────────────
  if (view === "live") {
    return (
      <div className="fixed inset-0" style={{ background: "#000" }}>
        <ScrollbarTheme />

        <BroadcastSurface channels={channels} liveState={liveState} weatherData={weatherData} matchSetup={matchSetup} />

        {/* Positioned at the vertical center of the left edge rather
            than the top-left corner — the top-left corner is where the
            Tournament Logo channel renders, and this button was sitting
            directly on top of it. Center-left is clear of that overlay
            (and of the score bar at the bottom) no matter how tall the
            logo happens to render. Kept compact and low-contrast by
            default, brightening only on hover, so it doesn't compete
            with the broadcast graphics for attention. */}
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

        {/* Same reasoning mirrored on the right edge, vertically
            centered opposite the Back to Controls tab — the top-right
            corner is where the Weather channel renders. */}
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
    );
  }

  // ── CONTROL VIEW — broadcast-console styled scorer + control deck ───
  const scoreReadout = `${liveState.score.runs}/${liveState.score.wickets} (${liveState.score.overs}.${liveState.score.balls})`;
  const inningsLabel = liveState.matchComplete
    ? "Match Complete"
    : liveState.target !== undefined
    ? `Innings ${liveState.inningsNumber ?? 2} · Chasing ${liveState.target}`
    : `Innings ${liveState.inningsNumber ?? 1}`;

  return (
    <div className="h-screen w-screen overflow-hidden relative flex flex-col" style={{ background: "var(--color-background)", color: "var(--color-on-background)" }}>
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

      {/* Ambient scanline + top radial glow texture — same treatment as
          the other two sandboxes, so all three read as one console. */}
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
      {/* z-20, not z-10: the Scoring Console below is also position:
          relative with its own z-index (see "Scoring console" comment
          further down). Two sibling stacking contexts tied on z-index
          paint in DOM order — later wins — so at z-10/z-10 the console
          (later in the markup) was painting over anything from this
          deck that extended past its own edge, including the open
          weather dropdown despite that dropdown's own z-50 (which only
          wins comparisons *inside* this deck's stacking context, not
          against a sibling one). Bumping the deck itself to z-20 settles
          that tie so the whole deck — dropdown included — stays on top,
          regardless of DOM order. */}
      <div
        className="shrink-0 relative z-20"
        style={{ background: "rgba(10,10,10,0.35)", borderBottom: "1px solid var(--color-border-overlay)" }}
      >
        <div className="flex flex-wrap items-start gap-x-8 gap-y-4 px-5 py-4">
          <ControlCluster label="On Air Channels">
            {(Object.keys(CHANNEL_LABELS) as (keyof SandboxChannels)[]).map((key) => (
              <Pill key={key} active={channels[key]} onClick={() => toggleChannel(key)}>
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

        {/* Event feed — same compact glass-strip treatment as the
            brackets sandbox's roster strip, swapped for a scrolling
            mono event log instead of team chips. */}
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

      {/* ── Scoring console — fills remaining space, scrolls
            independently under the fixed header/control deck. Stays at
            z-10, one below the Control Deck's z-20 above — see the
            comment on that deck for why the relative order between
            these two matters (it's not just visual layering, it's
            which one wins DOM-order ties for anything that pops out of
            its own box, like the weather dropdown). ── */}
      <div className="flex-1 min-h-0 overflow-auto relative z-10 px-5 py-5">
        <div
          className="rounded-xl p-5"
          style={{
            background: "rgba(10,10,10,0.35)",
            border: "1px solid var(--color-border-overlay)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          <LiveStatePanel
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
          />
        </div>
      </div>

      {/* Always-on iframe-backed monitor, scaled down to a corner box —
          see LivePreviewMonitor above for the enter/hold/revert timing
          on moments. */}
      <LivePreviewMonitor featuredMoment={featuredMoment} />
    </div>
  );
}