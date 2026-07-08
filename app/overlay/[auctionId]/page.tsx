// app/overlay/[auctionId]/page.tsx
"use client";

import React, { use, useEffect, useReducer, useRef } from "react";
import { connectOverlayBus, type OverlayEvent, type WeatherData, type MatchSetup, type LiveState } from "@/lib/overlayBus";

import WeatherCard from "@/components/overlays/WeatherCard";
import MatchBoundaries from "@/components/overlays/MatchBoundaries";
import TournamentBoundaries from "@/components/overlays/TournamentBoundaries";
import LiveScoreBar from "@/components/overlays/LiveScoreBar";
import PointsTable from "@/components/overlays/PointsTable";
import CricketScorecard from "@/components/overlays/CricketScorecard";
import CricketMatchIntro from "@/components/overlays/CricketMatchIntro";
import MatchMomentOverlay from "@/components/overlays/MatchMomentOverlay";
import TournamentLogoDisplay from "@/components/overlays/TournamentLogoDisplay";

const DEFAULT_WEATHER: WeatherData = {
  venue: "INLAND CRICKET GROUND",
  temp: 28,
  unit: "C",
  condition: "sunny",
  corner: "top-right",
};

// NEW — grace period after the channel reports SUBSCRIBED before we send
// the first requestSync. Supabase Realtime broadcasts sent immediately on
// "SUBSCRIBED" can get dropped because the subscription hasn't fully
// propagated server-side yet — this gives both ends (this overlay AND the
// admin tab, if it's also just reconnecting) a moment to actually settle
// before anything gets fired.
const INITIAL_SYNC_DELAY_MS = 600;

// Retry tuning for requestSync (after the initial delay above). Keeps
// retrying until an actual syncSnapshot comes back, up to MAX_SYNC_ATTEMPTS,
// which also covers the admin's reply itself dropping.
const SYNC_RETRY_MS = 800;
const MAX_SYNC_ATTEMPTS = 6;

interface OverlayState {
  weather: { show: boolean; data: WeatherData };
  matchBoundaries: { show: boolean; fours: number; sixes: number };
  tournamentBoundaries: { show: boolean; fours: number; sixes: number };
  liveScoreBar: { show: boolean };
  pointsTable: { show: boolean };
  matchScorecard: { show: boolean };
  matchIntro: { show: boolean };
  tournamentLogo: { show: boolean };
  testBg: { show: boolean };
  matchSetup: MatchSetup | null;
  matchSetupCompleted: boolean;
  liveState: LiveState | null;
}

const initialState: OverlayState = {
  weather: { show: false, data: DEFAULT_WEATHER },
  matchBoundaries: { show: false, fours: 0, sixes: 0 },
  tournamentBoundaries: { show: false, fours: 0, sixes: 0 },
  liveScoreBar: { show: false },
  pointsTable: { show: false },
  matchScorecard: { show: false },
  matchIntro: { show: false },
  tournamentLogo: { show: false },
  testBg: { show: false },
  matchSetup: null,
  matchSetupCompleted: false,
  liveState: null,
};

function reducer(state: OverlayState, event: OverlayEvent): OverlayState {
  switch (event.type) {
    case "weather":
      return { ...state, weather: { show: event.show, data: { ...state.weather.data, ...event.data } } };
    case "matchBoundaries":
      return {
        ...state,
        matchBoundaries: {
          show: event.show,
          fours: event.fours ?? state.matchBoundaries.fours,
          sixes: event.sixes ?? state.matchBoundaries.sixes,
        },
        tournamentBoundaries: event.show ? { ...state.tournamentBoundaries, show: false } : state.tournamentBoundaries,
      };
    case "tournamentBoundaries":
      return {
        ...state,
        tournamentBoundaries: {
          show: event.show,
          fours: event.fours ?? state.tournamentBoundaries.fours,
          sixes: event.sixes ?? state.tournamentBoundaries.sixes,
        },
        matchBoundaries: event.show ? { ...state.matchBoundaries, show: false } : state.matchBoundaries,
      };
    case "liveScoreBar":
      return { ...state, liveScoreBar: { show: event.show } };
    case "pointsTable":
      return { ...state, pointsTable: { show: event.show } };
    case "matchScorecard":
      return { ...state, matchScorecard: { show: event.show } };
    case "matchIntro":
      return { ...state, matchIntro: { show: event.show } };
    case "tournamentLogo":
      return { ...state, tournamentLogo: { show: event.show } };
    case "testBg":
      return { ...state, testBg: { show: event.show } };
    case "matchSetup":
      return { ...state, matchSetup: event.data, matchSetupCompleted: true };
    case "liveState":
      return { ...state, liveState: event.data };
    case "syncSnapshot": {
      const c = event.data.channels;
      return {
        ...state,
        // CHANGED — previously this only restored `show` from the channel
        // visibility flags, leaving `data` (venue/temp/condition) frozen at
        // whatever it already was — which on a fresh page load is just the
        // hardcoded DEFAULT_WEATHER. Now the snapshot carries the actual
        // last-fetched weather too, so a reconnect shows real conditions
        // instead of resetting to 28°C/sunny.
        weather: { show: c.weather, data: event.data.weather ?? state.weather.data },
        matchBoundaries: { ...state.matchBoundaries, show: c.matchBoundaries },
        tournamentBoundaries: { ...state.tournamentBoundaries, show: c.tournamentBoundaries },
        liveScoreBar: { show: c.liveScoreBar },
        tournamentLogo: { show: c.tournamentLogo },
        pointsTable: { show: c.pointsTable },
        matchScorecard: { show: c.matchScorecard },
        matchIntro: { show: c.matchIntro },
        testBg: { show: c.testBg },
        matchSetup: event.data.matchSetupCompleted ? event.data.matchSetup : state.matchSetup,
        matchSetupCompleted: event.data.matchSetupCompleted,
        liveState: event.data.liveState,
      };
    }
    case "clearAll":
      return { ...initialState, testBg: state.testBg };
    default:
      return state;
  }
}

function useOverlayVisibility(show: boolean, exitMs: number) {
  const [mounted, setMounted] = React.useState(show);
  const [closing, setClosing] = React.useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (show) {
      if (timer.current) clearTimeout(timer.current);
      setClosing(false);
      setMounted(true);
    } else if (mounted) {
      setClosing(true);
      timer.current = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, exitMs);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  return { mounted, closing };
}

export default function OverlayDisplayPage({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = use(params);
  const [state, dispatch] = useReducer(reducer, initialState);
  const busRef = useRef<ReturnType<typeof connectOverlayBus> | null>(null);

  useEffect(() => {
    document.body.style.background = "transparent";
    const bus = connectOverlayBus(auctionId);
    busRef.current = bus;

    let synced = false;
    let attempts = 0;
    let startupTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    function stopRetrying() {
      if (startupTimer) {
        clearTimeout(startupTimer);
        startupTimer = null;
      }
      if (retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
    }

    function attemptSync() {
      if (synced || attempts >= MAX_SYNC_ATTEMPTS) {
        stopRetrying();
        return;
      }
      attempts += 1;
      bus.send({ type: "requestSync" });
    }

    bus.onReady(() => {
      // CHANGED — instead of firing the first requestSync the instant
      // "ready" flips true, wait INITIAL_SYNC_DELAY_MS first. This is the
      // actual fix for the Supabase "broadcast right after SUBSCRIBED can
      // get silently dropped" race, rather than just relying on retries to
      // eventually land. The retry loop still starts after this delay, as
      // a safety net for anything that drops afterward (e.g. the admin's
      // reply, or the admin tab itself still connecting).
      startupTimer = setTimeout(() => {
        attemptSync();
        retryTimer = setInterval(attemptSync, SYNC_RETRY_MS);
      }, INITIAL_SYNC_DELAY_MS);
    });

    const off = bus.on((event) => {
      if (event.type === "syncSnapshot") {
        synced = true;
        stopRetrying();
      }
      if (event.type === "moment") {
        // CHANGED — pass the full event through so matchWon (team name/color/
        // logo/margin) and maiden (bowler name) can render dynamic text instead
        // of always showing static copy.
        (window as any).triggerBoundaryCelebration?.(event.moment, event);
        return;
      }
      dispatch(event);
    });

    return () => {
      off();
      stopRetrying();
      bus.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  const weatherVis = useOverlayVisibility(state.weather.show, 280);
  const matchBoundariesVis = useOverlayVisibility(state.matchBoundaries.show, 300);
  const tournamentBoundariesVis = useOverlayVisibility(state.tournamentBoundaries.show, 300);

  return (
    <div className="fixed inset-0" style={{ background: "transparent" }}>
      {state.testBg.show && (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="fixed inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
          src="/sample-match-footage.mp4"
        />
      )}

      {weatherVis.mounted && <WeatherCard {...state.weather.data} closing={weatherVis.closing} />}

      {matchBoundariesVis.mounted && (
        <MatchBoundaries
          fours={state.liveState?.matchBoundaries.fours ?? state.matchBoundaries.fours}
          sixes={state.liveState?.matchBoundaries.sixes ?? state.matchBoundaries.sixes}
          closing={matchBoundariesVis.closing}
        />
      )}

      {tournamentBoundariesVis.mounted && (
        <TournamentBoundaries
          fours={state.liveState?.tournamentBoundaries.fours ?? state.tournamentBoundaries.fours}
          sixes={state.liveState?.tournamentBoundaries.sixes ?? state.tournamentBoundaries.sixes}
          closing={tournamentBoundariesVis.closing}
        />
      )}

      <MatchMomentOverlay hideDemoButtons />
      
      <LiveScoreBar
        show={state.liveScoreBar.show}
        hideTrigger
        liveState={state.liveState ?? undefined}
        matchSetup={state.matchSetup ?? undefined}
      />
      
      <PointsTable show={state.pointsTable.show} hideTrigger />
      
      <CricketScorecard show={state.matchScorecard.show} hideTrigger />
      
      <CricketMatchIntro
        show={state.matchIntro.show}
        hideTrigger
        matchSetup={state.matchSetup ?? undefined}
        tournament={state.matchSetup?.tournament ?? undefined}
        matchMeta={state.matchSetup?.matchMeta ?? undefined}
      />

      {state.tournamentLogo.show && (
        <TournamentLogoDisplay
          name={state.matchSetup?.tournamentName || undefined}
          edition={
            state.matchSetup
              ? [
                  state.matchSetup.season && `SEASON ${state.matchSetup.season}`,
                  state.matchSetup.format,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              : undefined
          }
          logo={state.matchSetup?.tournamentLogoUrl || undefined}
        />
      )}
    </div>
  );
}