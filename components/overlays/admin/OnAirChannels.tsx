"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ChannelVisibility, OverlayEvent } from "@/lib/overlayBus";
import { Section, ChannelRow } from "./ui";
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
  // NEW — match has ended: drop everything except the ambient channels
  // that should keep running post-match (weather + tournament logo).
  notifyMatchOver: () => void;
  getVisibleSnapshot: () => ChannelVisibility;
};

const OnAirChannels = forwardRef<
  OnAirChannelsHandle,
  // CHANGED — auctionId swapped for matchId. matchId is the Supabase
  // row id, resolved asynchronously by page.tsx's getOrCreateMatch();
  // it's `null` until that resolves, so every effect below waits for
  // it before touching the DB.
  { fire: (event: OverlayEvent, label: string) => void; matchId: string | null }
>(function OnAirChannels({ fire, matchId }, ref) {
  const [on, setOn] = useState<Record<ChannelKey, boolean>>(initialOn);
  const [suppressed, setSuppressed] = useState<Record<SuppressibleKey, boolean>>(initialSuppressed);

  // True only once we've actually attempted a Supabase read (or
  // confirmed there's no matchId yet to read with) — same purpose as
  // the localStorage version's hydrated flag: don't fire/persist the
  // default on-air state and stomp on whatever was really live.
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

  // CHANGED — load persisted On Air state from Supabase instead of
  // localStorage. Waits for matchId to resolve (it starts as null
  // while page.tsx's getOrCreateMatch() is still in flight). This is
  // what makes On Air state shared across devices/tabs instead of
  // being stuck per-browser the way localStorage was.
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

  // CHANGED — persist every change to Supabase instead of localStorage.
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
    // NEW — match has ended: drop everything except the two ambient
    // channels that should keep running post-match (weather +
    // tournament logo). Everything else (score bar, boundaries,
    // fullscreen panels, test bg) goes off. This is a one-shot reset,
    // not a lock — the regular toggle* functions above still work
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