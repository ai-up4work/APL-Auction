// app/overlay/[auctionId]/page.tsx
"use client";

import React, { use, useEffect, useReducer, useRef } from "react";
import { connectOverlayBus, type OverlayEvent, type WeatherData } from "@/lib/overlayBus";

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
    case "clearAll":
      // Deliberately preserve testBg across clearAll — it's a dev/preview
      // toggle, not a match overlay, so "clear everything" shouldn't yank
      // the background out from under whoever's still testing layout.
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

    const off = bus.on((event) => {
      if (event.type === "moment") {
        (window as any).triggerBoundaryCelebration?.(event.moment);
        return;
      }
      dispatch(event);
    });

    return () => {
      off();
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
          fours={state.matchBoundaries.fours}
          sixes={state.matchBoundaries.sixes}
          closing={matchBoundariesVis.closing}
        />
      )}

      {tournamentBoundariesVis.mounted && (
        <TournamentBoundaries
          fours={state.tournamentBoundaries.fours}
          sixes={state.tournamentBoundaries.sixes}
          closing={tournamentBoundariesVis.closing}
        />
      )}

      <MatchMomentOverlay hideDemoButtons />
      <LiveScoreBar show={state.liveScoreBar.show} hideTrigger />
      <PointsTable show={state.pointsTable.show} hideTrigger />
      <CricketScorecard show={state.matchScorecard.show} hideTrigger />
      <CricketMatchIntro show={state.matchIntro.show} hideTrigger />
      {state.tournamentLogo.show && <TournamentLogoDisplay />}
    </div>
  );
}