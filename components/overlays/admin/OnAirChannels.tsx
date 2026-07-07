// components/overlays/admin/OnAirChannels.tsx
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

// CHANGED — testBg is now a tracked channel key alongside everything else,
// not a standalone useState. It's not Ambient/Boundary/Fullscreen — it's
// its own category: never suppressed, never part of the mutex groups, but
// still part of `on` so it flows through computeVisible()/getVisibleSnapshot()
// and therefore through syncSnapshot on reconnect.
type TestBgKey = "testBg";
type ChannelKey = AmbientKey | BoundaryKey | FullscreenKey | TestBgKey;

// the union of everything that can be suppressed by Fullscreen. Ambient and
// Boundary are both suppressible; Fullscreen and testBg are not.
type SuppressibleKey = AmbientKey | BoundaryKey;

const ALL_CHANNELS = [
  ...AMBIENT_CHANNELS,
  ...BOUNDARY_CHANNELS,
  ...FULLSCREEN_CHANNELS,
  { key: "testBg" as const, label: "Test Background" },
];
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

function initialSuppressed(): Record<SuppressibleKey, boolean> {
  return {
    weather: false,
    liveScoreBar: false,
    tournamentLogo: false,
    matchBoundaries: false,
    tournamentBoundaries: false,
  };
}

// zeroes out Ambient and Boundary keys when suppressed. testBg is
// deliberately excluded from SUPPRESSIBLE_KEYS, so it's untouched here —
// a Fullscreen graphic going up shouldn't yank the practice footage out
// from under a layout test.
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

const OnAirChannels = forwardRef<OnAirChannelsHandle, { fire: (event: OverlayEvent, label: string) => void }>(
  function OnAirChannels({ fire }, ref) {
    const [on, setOn] = useState<Record<ChannelKey, boolean>>(initialOn);
    const [suppressed, setSuppressed] = useState<Record<SuppressibleKey, boolean>>(initialSuppressed);

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

    useEffect(() => {
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
    }, [on, suppressed]);

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

    // CHANGED — testBg toggle now just flips `on.testBg` through the same
    // setOn path as everything else, instead of a separate setTestBgOn +
    // manual fire() call. The broadcast-on-change effect above now fires
    // the testBg event automatically, same as any other channel.
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
      // CHANGED — preserve testBg across clearAll, same rationale as
      // before: it's a dev/preview toggle, not a match overlay, so
      // "clear everything" shouldn't yank the background out from under
      // whoever's still testing layout. Previously this lived as a
      // separate `testBg: state.testBg` merge in the overlay page's
      // reducer; now that testBg lives in `on`, it has to be preserved
      // here at the source instead.
      setOn((prev) => ({ ...initialOn(), testBg: prev.testBg }));
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

          {/* CHANGED — reads/writes `on.testBg` now instead of a separate
              testBgOn useState. */}
          <ChannelRow label="Test Background" on={on.testBg} tone="blue" onToggle={toggleTestBg} />
          <p className="text-[10px]" style={{ color: "var(--color-outline)", fontFamily: "var(--font-body-md)" }}>
            Sample footage for layout testing — off before going live.
          </p>
        </div>
      </Section>
    );
  }
);

export default OnAirChannels;