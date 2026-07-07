// components/overlays/admin/OnAirChannels.tsx
"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { OverlayEvent } from "@/lib/overlayBus";
import { Section, ChannelRow } from "./ui";

// ── Channel groups — this is the single source of truth for the rules ──
// Ambient: always want visible, default ON, individually toggleable.
// Fullscreen: mutually exclusive, one at a time, suppresses Ambient while active.
// Boundary: existing independent mutex pair, untouched by the new rules.
const AMBIENT_CHANNELS = [
  { key: "weather", label: "Weather" },
  { key: "liveScoreBar", label: "Live Score Bar" },
  { key: "tournamentLogo", label: "Tournament Logo" },
] as const;

const FULLSCREEN_CHANNELS = [
  { key: "pointsTable", label: "Points Table" },
  { key: "matchScorecard", label: "Match Scorecard" },
  { key: "matchIntro", label: "Match Intro" },
] as const;

const BOUNDARY_CHANNELS = [
  { key: "matchBoundaries", label: "Match Boundaries" },
  { key: "tournamentBoundaries", label: "Tournament Boundaries" },
] as const;

type AmbientKey = (typeof AMBIENT_CHANNELS)[number]["key"];
type FullscreenKey = (typeof FULLSCREEN_CHANNELS)[number]["key"];
type BoundaryKey = (typeof BOUNDARY_CHANNELS)[number]["key"];
type ChannelKey = AmbientKey | FullscreenKey | BoundaryKey;

const ALL_CHANNELS = [...AMBIENT_CHANNELS, ...FULLSCREEN_CHANNELS, ...BOUNDARY_CHANNELS];

function initialOn(): Record<ChannelKey, boolean> {
  return {
    weather: true,
    liveScoreBar: true,
    tournamentLogo: true,
    pointsTable: false,
    matchScorecard: false,
    matchIntro: false,
    matchBoundaries: false,
    tournamentBoundaries: false,
  };
}

function computeVisible(on: Record<ChannelKey, boolean>, suppressed: Record<AmbientKey, boolean>) {
  const visible = { ...on };
  (["weather", "liveScoreBar", "tournamentLogo"] as AmbientKey[]).forEach((k) => {
    if (suppressed[k]) visible[k] = false;
  });
  return visible;
}

export type OnAirChannelsHandle = {
  /** Call this the instant a Moment (Four/Six/Wicket/Fifty/Hundred) fires. */
  notifyMomentFired: () => void;
};

const OnAirChannels = forwardRef<OnAirChannelsHandle, { fire: (event: OverlayEvent, label: string) => void }>(
  function OnAirChannels({ fire }, ref) {
    const [on, setOn] = useState<Record<ChannelKey, boolean>>(initialOn);
    const [suppressed, setSuppressed] = useState<Record<AmbientKey, boolean>>({
      weather: false,
      liveScoreBar: false,
      tournamentLogo: false,
    });
    const [testBgOn, setTestBgOn] = useState(false);

    // ── Emit bus events only when *effective visible* state actually changes ──
    const prevVisibleRef = useRef(computeVisible(initialOn(), { weather: false, liveScoreBar: false, tournamentLogo: false }));

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

    // ── Rule: any Fullscreen channel ON ⇒ suppress Ambient. All OFF ⇒ restore. ──
    useEffect(() => {
      const anyFullscreenOn = FULLSCREEN_CHANNELS.some((c) => on[c.key]);
      setSuppressed({
        weather: anyFullscreenOn,
        liveScoreBar: anyFullscreenOn,
        tournamentLogo: anyFullscreenOn,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [on.pointsTable, on.matchScorecard, on.matchIntro]);

    function toggleAmbient(key: AmbientKey) {
      if (suppressed[key]) return; // button is disabled in this state, but guard anyway
      setOn((prev) => ({ ...prev, [key]: !prev[key] }));
    }

    // ── Rule: Fullscreen channels are mutually exclusive ──
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

    function toggleBoundary(key: BoundaryKey) {
      setOn((prev) => {
        const turningOn = !prev[key];
        const other: BoundaryKey = key === "matchBoundaries" ? "tournamentBoundaries" : "matchBoundaries";
        return { ...prev, [key]: turningOn, [other]: turningOn ? false : prev[other] };
      });
    }

    // ── Rule: Moment fired ⇒ force Fullscreen group off, stays off until manual re-enable ──
    useImperativeHandle(ref, () => ({
      notifyMomentFired() {
        setOn((prev) => ({ ...prev, pointsTable: false, matchScorecard: false, matchIntro: false }));
      },
    }));

    function clearAll() {
      setOn(initialOn());
      fire({ type: "clearAll" } as OverlayEvent, "Cleared all overlays");
    }

    function toggleTestBg() {
      const next = !testBgOn;
      setTestBgOn(next);
      fire({ type: "testBg", show: next } as OverlayEvent, `Test background ${next ? "on" : "off"}`);
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

          <div className="grid grid-cols-2 gap-2 mt-1">
            {BOUNDARY_CHANNELS.map((c) => (
              <ChannelRow key={c.key} label={c.label} on={on[c.key]} onToggle={() => toggleBoundary(c.key)} />
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

          <ChannelRow label="Test Background" on={testBgOn} tone="blue" onToggle={toggleTestBg} />
          <p className="text-[10px]" style={{ color: "var(--color-outline)", fontFamily: "var(--font-body-md)" }}>
            Sample footage for layout testing — off before going live.
          </p>
        </div>
      </Section>
    );
  }
);

export default OnAirChannels;