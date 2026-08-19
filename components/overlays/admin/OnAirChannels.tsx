"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ChannelVisibility, OverlayEvent } from "@/lib/overlayBus";
import { Section } from "./ui";
import { loadOnAirChannels, saveOnAirChannels } from "@/lib/matchPersistence"; // CHANGED — was localStorage

const AMBIENT_CHANNELS = [
  { key: "weather", label: "Weather" },
  { key: "liveScoreBar", label: "Live Score Bar" },
  { key: "tournamentLogo", label: "Tournament Logo" },
] as const;

const BOUNDARY_CHANNELS = [
  { key: "matchBoundaries", label: "Match Boundaries" },
  { key: "tournamentBoundaries", label: "Tournament Boundaries" },
] as const;

const FULLSCREEN_CHANNELS = [
  { key: "pointsTable", label: "Points Table" },
  { key: "matchScorecard", label: "Match Scorecard" },
  { key: "matchIntro", label: "Match Intro" },
] as const;

type AmbientKey = (typeof AMBIENT_CHANNELS)[number]["key"];
type BoundaryKey = (typeof BOUNDARY_CHANNELS)[number]["key"];
type FullscreenKey = (typeof FULLSCREEN_CHANNELS)[number]["key"];

type TestBgKey = "testBg";
type ChannelKey = AmbientKey | BoundaryKey | FullscreenKey | TestBgKey;

type SuppressibleKey = AmbientKey | BoundaryKey;

const ALL_CHANNELS = [
  ...AMBIENT_CHANNELS,
  ...BOUNDARY_CHANNELS,
  ...FULLSCREEN_CHANNELS,
  { key: "testBg" as const, label: "Test Background" },
];
const ALL_CHANNEL_KEYS: ChannelKey[] = ALL_CHANNELS.map((c) => c.key);
const SUPPRESSIBLE_KEYS: SuppressibleKey[] = [...AMBIENT_CHANNELS.map((c) => c.key), ...BOUNDARY_CHANNELS.map((c) => c.key)];

function initialOn(): Record<ChannelKey, boolean> {
  return {
    weather: true,
    liveScoreBar: true,
    tournamentLogo: true,
    matchBoundaries: false,
    tournamentBoundaries: false,
    pointsTable: false,
    matchScorecard: false,
    matchIntro: false,
    testBg: false,
  };
}

function allOff(): Record<ChannelKey, boolean> {
  return ALL_CHANNEL_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {} as Record<ChannelKey, boolean>);
}

// Rebuilds a full, valid `on` record from whatever Supabase returned.
// Starts from initialOn() so a missing/partial row still gives a sane
// default, and only copies over keys that are actually known
// ChannelKeys with boolean values, so a stale/partial row can't inject
// garbage into state.
function sanitizeOn(raw: any): Record<ChannelKey, boolean> {
  const base = initialOn();
  if (raw && typeof raw === "object") {
    ALL_CHANNEL_KEYS.forEach((k) => {
      if (typeof raw[k] === "boolean") base[k] = raw[k];
    });
  }
  return base;
}

function initialSuppressed(): Record<SuppressibleKey, boolean> {
  return {
    weather: false,
    liveScoreBar: false,
    tournamentLogo: false,
    matchBoundaries: false,
    tournamentBoundaries: false,
  };
}

function computeVisible(on: Record<ChannelKey, boolean>, suppressed: Record<SuppressibleKey, boolean>) {
  const visible = { ...on };
  SUPPRESSIBLE_KEYS.forEach((k) => {
    if (suppressed[k]) visible[k] = false;
  });
  return visible;
}

export type OnAirChannelsHandle = {
  notifyMomentFired: () => void;
  // match has ended: drop everything except the ambient channels
  // that should keep running post-match (weather + tournament logo).
  notifyMatchOver: () => void;
  getVisibleSnapshot: () => ChannelVisibility;
};

const OnAirChannels = forwardRef<
  OnAirChannelsHandle,
  // matchId is the Supabase row id, resolved asynchronously by
  // page.tsx's getOrCreateMatch(); it's `null` until that resolves, so
  // every effect below waits for it before touching the DB.
  { fire: (event: OverlayEvent, label: string) => void; matchId: string | null }
>(function OnAirChannels({ fire, matchId }, ref) {
  const [on, setOn] = useState<Record<ChannelKey, boolean>>(initialOn);
  const [suppressed, setSuppressed] = useState<Record<SuppressibleKey, boolean>>(initialSuppressed);

  // True only once we've actually attempted a Supabase read (or
  // confirmed there's no matchId yet to read with) — same purpose as
  // the localStorage version's hydrated flag: don't fire/persist the
  // default on-air state and stomp on whatever was really live.
  const [hydrated, setHydrated] = useState(false);

  // Mobile-only: whether the bottom-sheet overlay is open. Desktop
  // never reads this — the full row is always inline there.
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // NEW — the whole On Air header (desktop chip row AND mobile trigger
  // pill) is now `position: fixed` to the top of the viewport, not
  // `sticky`. `sticky` only stays pinned while its own parent container
  // is still scrolling through the viewport; the div this component
  // renders into (page.tsx's thin header wrapper) is barely taller than
  // the bar itself, so on either breakpoint a sticky bar unsticks and
  // scrolls away again after a few pixels. Fixed positioning pins it to
  // the viewport instead, but that also takes it out of normal document
  // flow, so we measure its real rendered height here (whichever
  // variant — desktop row or mobile pill — is actually visible) and
  // render an equal-height spacer in its place so the rest of the page
  // doesn't jump up underneath it.
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);

  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setBarHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const prevVisibleRef = useRef<Record<ChannelKey, boolean>>({
    weather: false,
    liveScoreBar: false,
    tournamentLogo: false,
    matchBoundaries: false,
    tournamentBoundaries: false,
    pointsTable: false,
    matchScorecard: false,
    matchIntro: false,
    testBg: false,
  });

  // Load persisted On Air state from Supabase instead of localStorage.
  // Waits for matchId to resolve (it starts as null while page.tsx's
  // getOrCreateMatch() is still in flight). This is what makes On Air
  // state shared across devices/tabs instead of being stuck per-browser
  // the way localStorage was.
  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    (async () => {
      const channels = await loadOnAirChannels(matchId);
      if (cancelled) return;
      if (channels) setOn(sanitizeOn(channels));
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  // Persist every change to Supabase instead of localStorage.
  useEffect(() => {
    if (!hydrated || !matchId) return;
    saveOnAirChannels(matchId, on);
  }, [on, matchId, hydrated]);

  useEffect(() => {
    if (!hydrated) return; // wait for persisted state before syncing to the overlay
    const visible = computeVisible(on, suppressed);
    const prev = prevVisibleRef.current;
    (Object.keys(visible) as ChannelKey[]).forEach((k) => {
      if (visible[k] !== prev[k]) {
        const label = ALL_CHANNELS.find((c) => c.key === k)?.label ?? k;
        fire({ type: k, show: visible[k] } as OverlayEvent, `${label} ${visible[k] ? "on" : "off"}`);
      }
    });
    prevVisibleRef.current = visible;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, suppressed, hydrated]);

  useEffect(() => {
    const anyFullscreenOn = FULLSCREEN_CHANNELS.some((c) => on[c.key]);
    setSuppressed({
      weather: anyFullscreenOn,
      liveScoreBar: anyFullscreenOn,
      tournamentLogo: anyFullscreenOn,
      matchBoundaries: anyFullscreenOn,
      tournamentBoundaries: anyFullscreenOn,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on.pointsTable, on.matchScorecard, on.matchIntro]);

  function toggleAmbient(key: AmbientKey) {
    if (suppressed[key]) return;
    setOn((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleBoundary(key: BoundaryKey) {
    if (suppressed[key]) return;
    setOn((prev) => {
      const turningOn = !prev[key];
      const other: BoundaryKey = key === "matchBoundaries" ? "tournamentBoundaries" : "matchBoundaries";
      return { ...prev, [key]: turningOn, [other]: turningOn ? false : prev[other] };
    });
  }

  function toggleFullscreen(key: FullscreenKey) {
    setOn((prev) => {
      const turningOn = !prev[key];
      const next = { ...prev };
      FULLSCREEN_CHANNELS.forEach((c) => {
        next[c.key] = c.key === key ? turningOn : false;
      });
      return next;
    });
  }

  function toggleTestBg() {
    setOn((prev) => ({ ...prev, testBg: !prev.testBg }));
  }

  useImperativeHandle(ref, () => ({
    notifyMomentFired() {
      setOn((prev) => ({ ...prev, pointsTable: false, matchScorecard: false, matchIntro: false }));
    },
    // match has ended: drop everything except the two ambient channels
    // that should keep running post-match (weather + tournament logo).
    // Everything else (score bar, boundaries, fullscreen panels, test
    // bg) goes off. One-shot reset, not a lock — toggle* still works
    // normally afterward, so anyone can manually flip a channel back
    // on from the panel.
    notifyMatchOver() {
      setOn(() => ({
        ...allOff(),
        weather: true,
        tournamentLogo: true,
      }));
    },
    getVisibleSnapshot() {
      return computeVisible(on, suppressed) as ChannelVisibility;
    },
  }));

  function clearAll() {
    setOn(allOff());
    fire({ type: "clearAll" } as OverlayEvent, "Cleared all overlays");
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-label-mono)",
    color: "var(--color-outline)",
  };

  // Local pill/chip — used for both the inline desktop row and the
  // mobile bottom sheet, so this view doesn't depend on ChannelRow's
  // (unknown-to-us) prop shape at all.
  function StatusChip({
    label,
    on: chipOn,
    onToggle,
    tone = "green",
  }: {
    label: string;
    on: boolean;
    onToggle: () => void;
    tone?: "green" | "blue";
  }) {
    const activeColor = tone === "blue" ? "#60a5fa" : "var(--color-success-green, #4caf50)";
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors"
        style={{
          fontFamily: "var(--font-label-mono)",
          background: chipOn ? `${activeColor}24` : "var(--color-surface-container-low)",
          border: `1px solid ${chipOn ? `${activeColor}66` : "var(--color-border-overlay)"}`,
          color: chipOn ? activeColor : "var(--color-outline)",
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "999px",
            background: chipOn ? activeColor : "var(--color-outline)",
            flexShrink: 0,
          }}
        />
        {label}
      </button>
    );
  }

  // Standalone Clear button — pulled out of the chip-groups row so it
  // can sit above the "On Air" header, right-aligned, instead of at the
  // end of the wrapped chip row.
  function ClearButton() {
    return (
      <button
        onClick={clearAll}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide flex-shrink-0"
        style={{
          fontFamily: "var(--font-label-mono)",
          background: "var(--color-error-container)",
          border: "1px solid rgba(255,180,171,0.25)",
          color: "var(--color-error)",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
          restart_alt
        </span>
        Clear
      </button>
    );
  }

  const liveCount =
    Number(on.weather && !suppressed.weather) +
    Number(on.liveScoreBar && !suppressed.liveScoreBar) +
    Number(on.tournamentLogo && !suppressed.tournamentLogo) +
    Number(on.pointsTable) +
    Number(on.matchScorecard) +
    Number(on.matchIntro) +
    Number(on.matchBoundaries && !suppressed.matchBoundaries) +
    Number(on.tournamentBoundaries && !suppressed.tournamentBoundaries) +
    Number(on.testBg);

  function renderChipGroups() {
    return (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={labelStyle}>
            Always On
          </span>
          {AMBIENT_CHANNELS.map((c) => (
            <StatusChip
              key={c.key}
              label={c.label}
              on={on[c.key] && !suppressed[c.key]}
              onToggle={() => toggleAmbient(c.key)}
            />
          ))}
        </div>

        <div className="h-4 w-px hidden sm:block" style={{ background: "var(--color-border-overlay)" }} />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={labelStyle}>
            Full-Screen
          </span>
          {FULLSCREEN_CHANNELS.map((c) => (
            <StatusChip key={c.key} label={c.label} on={on[c.key]} onToggle={() => toggleFullscreen(c.key)} />
          ))}
        </div>

        <div className="h-4 w-px hidden sm:block" style={{ background: "var(--color-border-overlay)" }} />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={labelStyle}>
            Boundaries
          </span>
          {BOUNDARY_CHANNELS.map((c) => (
            <StatusChip
              key={c.key}
              label={c.label}
              on={on[c.key] && !suppressed[c.key]}
              onToggle={() => toggleBoundary(c.key)}
            />
          ))}
        </div>

        <div className="h-4 w-px hidden sm:block" style={{ background: "var(--color-border-overlay)" }} />

        <StatusChip label="Test BG" on={on.testBg} onToggle={toggleTestBg} tone="blue" />
      </div>
    );
  }

  return (
    <>
      {/* Spacer — reserves the fixed bar's real measured height in
          normal document flow so the rest of the page doesn't jump up
          underneath it once the bar is pulled out of flow below. */}
      <div aria-hidden="true" style={{ height: barHeight || undefined }} />

      {/* The On Air header itself, pinned to the top of the viewport on
          every breakpoint. Inner wrapper mirrors page.tsx's own
          max-w-[1600px] + responsive px- container so the bar's content
          lines up with the rest of the page even though, being fixed,
          it's no longer nested inside that container for layout
          purposes. */}
      <div
        ref={barRef}
        className="fixed top-0 left-0 right-0 z-30"
        style={{
          background: "var(--color-background)",
          borderBottom: "1px solid var(--color-border-overlay)",
        }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-2 sm:py-3">
          {/* Desktop / tablet — Clear sits on the same row/level as the
              "On Air" title itself (top-right corner of the Section
              card), not stacked above it. Positioned absolutely over
              the Section so it doesn't depend on Section's internal
              title layout — adjust the top/right offsets below if it
              doesn't land exactly on the title's baseline once you
              see it against Section's real padding. */}
          <div className="hidden sm:block relative">
            <div className="absolute top-5 right-5 sm:top-6 sm:right-6 z-10">
              <ClearButton />
            </div>
            <Section title="On Air">
              {renderChipGroups()}
            </Section>
          </div>

          {/* Mobile — Clear sits inline, same row as the trigger pill,
              rather than stacked above it. */}
          <div className="sm:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileSheetOpen(true)}
              className="flex-1 flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg"
              style={{
                background: "var(--color-surface-container-low)",
                border: "1px solid var(--color-border-overlay)",
              }}
            >
              <span className="flex items-center gap-2">
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "999px",
                    background: liveCount > 0 ? "var(--color-success-green, #4caf50)" : "var(--color-outline)",
                    flexShrink: 0,
                  }}
                />
                <span
                  className="text-[11px] font-black uppercase tracking-widest"
                  style={{ fontFamily: "var(--font-label-mono)" }}
                >
                  On Air
                </span>
                <span className="text-[10px]" style={{ color: "var(--color-outline)" }}>
                  {liveCount} live
                </span>
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-wide"
                style={{ color: "var(--color-theme-orange)" }}
              >
                Manage
              </span>
            </button>
          </div>
        </div>
      </div>

      {mobileSheetOpen && (
        <>
        <ClearButton />
          <div
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[75vh] overflow-y-auto"
            style={{
              background: "var(--color-surface-container-low)",
              borderTop: "1px solid var(--color-border-overlay)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <span
                className="text-[12px] font-black uppercase tracking-widest"
                style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}
              >
                On Air
              </span>
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                className="text-[11px] font-bold uppercase tracking-wide"
                style={{ color: "var(--color-outline)" }}
              >
                Done
              </button>
            </div>
            <div className="flex flex-col gap-4">{renderChipGroups()}</div>
          </div>
        </>
      )}
    </>
  );
});

export default OnAirChannels;