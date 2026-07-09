"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ChannelVisibility, OverlayEvent } from "@/lib/overlayBus";
import { Section, ChannelRow } from "./ui";

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

// NEW — rebuilds a full, valid `on` record from whatever's in
// localStorage. Starts from initialOn() (not allOff()) so a missing or
// unreadable cache entry still gives a sane default, and only copies
// over keys that are actually known ChannelKeys with boolean values —
// so a stale/partial/corrupt cache entry can't inject garbage into
// state the way a raw JSON.parse() value would.
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
  getVisibleSnapshot: () => ChannelVisibility;
};

const OnAirChannels = forwardRef<
  OnAirChannelsHandle,
  { fire: (event: OverlayEvent, label: string) => void; auctionId: string } // CHANGED — added auctionId
>(function OnAirChannels({ fire, auctionId }, ref) {
  const [on, setOn] = useState<Record<ChannelKey, boolean>>(initialOn);
  const [suppressed, setSuppressed] = useState<Record<SuppressibleKey, boolean>>(initialSuppressed);

  // NEW — mirrors the hydrated/liveHydrated pattern used elsewhere in
  // page.tsx: true only once localStorage has actually been read, so
  // we don't fire/persist the default on-air state and stomp on
  // whatever was really live before the refresh.
  const [hydrated, setHydrated] = useState(false);

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

  // NEW — load persisted On Air state on mount. This was the missing
  // piece: every other piece of session state (matchSetup, liveState,
  // engineState, weather) is round-tripped through localStorage in
  // page.tsx, but `on` lived purely in this component's own useState
  // with nothing backing it, so a refresh always fell back to
  // initialOn() — the "always on" three, everything else off — no
  // matter what was actually live a second before.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`overlay:${auctionId}:onAir`);
      if (raw) setOn(sanitizeOn(JSON.parse(raw)));
    } catch {
      // ignore malformed cache
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  // NEW — persist every change, same shape as everything else in page.tsx.
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(`overlay:${auctionId}:onAir`, JSON.stringify(on));
  }, [on, auctionId, hydrated]);

  useEffect(() => {
    if (!hydrated) return; // NEW — wait for persisted state before syncing to the overlay
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

  return (
    <Section title="On Air" description="Toggle overlay channels live on the broadcast.">
      <div className="flex flex-col gap-2.5">
        <span className="text-[9px] font-bold uppercase tracking-widest" style={labelStyle}>
          Always On
        </span>
        <div className="grid grid-cols-2 gap-2">
          {AMBIENT_CHANNELS.map((c) => (
            <ChannelRow
              key={c.key}
              label={c.label}
              on={on[c.key] && !suppressed[c.key]}
              onToggle={() => toggleAmbient(c.key)}
            />
          ))}
        </div>

        <span className="text-[9px] font-bold uppercase tracking-widest mt-1" style={labelStyle}>
          Full-Screen · one at a time
        </span>
        <div className="grid grid-cols-2 gap-2">
          {FULLSCREEN_CHANNELS.map((c) => (
            <ChannelRow key={c.key} label={c.label} on={on[c.key]} onToggle={() => toggleFullscreen(c.key)} />
          ))}
        </div>

        <span className="text-[9px] font-bold uppercase tracking-widest mt-1" style={labelStyle}>
          Boundaries · manual, one at a time
        </span>
        <div className="grid grid-cols-2 gap-2">
          {BOUNDARY_CHANNELS.map((c) => (
            <ChannelRow
              key={c.key}
              label={c.label}
              on={on[c.key] && !suppressed[c.key]}
              onToggle={() => toggleBoundary(c.key)}
            />
          ))}
        </div>

        <button
          onClick={clearAll}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wide mt-1"
          style={{
            fontFamily: "var(--font-label-mono)",
            background: "var(--color-error-container)",
            border: "1px solid rgba(255,180,171,0.25)",
            color: "var(--color-error)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
            restart_alt
          </span>
          Clear Everything
        </button>

        <div className="h-px my-1" style={{ background: "var(--color-outline-variant)" }} />

        <ChannelRow label="Test Background" on={on.testBg} tone="blue" onToggle={toggleTestBg} />
        <p className="text-[10px]" style={{ color: "var(--color-outline)", fontFamily: "var(--font-body-md)" }}>
          Sample footage for layout testing — off before going live.
        </p>
      </div>
    </Section>
  );
});

export default OnAirChannels;