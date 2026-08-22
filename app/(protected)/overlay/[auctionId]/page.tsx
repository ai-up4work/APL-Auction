// app/overlay/[auctionId]/page.tsx
"use client";

import React, { use, useEffect, useReducer, useRef } from "react";
import { connectOverlayBus, type OverlayEvent, type WeatherData, type MatchSetup, type LiveState, type ChannelVisibility } from "@/lib/overlayBus";
import {
  getOrCreateMatch,
  loadLiveState,
  loadWeather,
  loadOnAirChannels,
  type WeatherCoords,
  type TournamentIdentity,
} from "@/lib/matchPersistence";

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

const INITIAL_SYNC_DELAY_MS = 600;
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
  // Sourced ONLY from the `tournaments` table (via getOrCreateMatch),
  // never from matchSetup.tournamentName/tournamentLogoUrl. null means
  // either "no tournament attached" (a genuinely standalone match) or
  // "the tournament row has no logo uploaded yet" — either way,
  // TournamentLogoDisplay treats this as the single source of truth
  // for a tournament match's crest, with matchSetup only used as the
  // standalone-match fallback (its own self-set title/logo).
  tournament: TournamentIdentity | null;
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
  tournament: null,
};

interface DbHydrateAction {
  type: "dbHydrate";
  matchSetup: MatchSetup;
  matchSetupCompleted: boolean;
  tournament: TournamentIdentity | null;
}

interface DbHydrateExtrasAction {
  type: "dbHydrateExtras";
  liveState: LiveState | null;
  weather: { data: WeatherData; coords: WeatherCoords | null } | null;
  channels: ChannelVisibility | null;
}

type Action = OverlayEvent | DbHydrateAction | DbHydrateExtrasAction;

function reducer(state: OverlayState, event: Action): OverlayState {
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
      const incoming = event.data.matchSetup;

      // Defensive merge — don't let a stale/incomplete admin-side
      // snapshot stomp fields we already resolved via dbHydrate. Only
      // take a field from the incoming snapshot when it actually has a
      // value; otherwise keep whatever we already have.
      const mergedMatchSetup: MatchSetup | null = event.data.matchSetupCompleted
        ? state.matchSetup
          ? {
              ...incoming,
              tournamentName: incoming.tournamentName?.trim() || state.matchSetup.tournamentName,
              tournamentLogoUrl: incoming.tournamentLogoUrl?.trim() || state.matchSetup.tournamentLogoUrl,
              teamA: {
                ...incoming.teamA,
                name: incoming.teamA?.name?.trim() || state.matchSetup.teamA.name,
                logoUrl: incoming.teamA?.logoUrl?.trim() || state.matchSetup.teamA.logoUrl,
              },
              teamB: {
                ...incoming.teamB,
                name: incoming.teamB?.name?.trim() || state.matchSetup.teamB.name,
                logoUrl: incoming.teamB?.logoUrl?.trim() || state.matchSetup.teamB.logoUrl,
              },
            }
          : incoming
        : state.matchSetup;

      return {
        ...state,
        weather: { show: c.weather, data: event.data.weather ?? state.weather.data },
        matchBoundaries: { ...state.matchBoundaries, show: c.matchBoundaries },
        tournamentBoundaries: { ...state.tournamentBoundaries, show: c.tournamentBoundaries },
        liveScoreBar: { show: c.liveScoreBar },
        tournamentLogo: { show: c.tournamentLogo },
        pointsTable: { show: c.pointsTable },
        matchScorecard: { show: c.matchScorecard },
        matchIntro: { show: c.matchIntro },
        testBg: { show: c.testBg },
        matchSetup: mergedMatchSetup,
        matchSetupCompleted: event.data.matchSetupCompleted,
        liveState: event.data.liveState,
        // NOTE: tournament identity is intentionally NOT touched by
        // syncSnapshot — it only ever comes from dbHydrate (the direct
        // `tournaments` table read). The bus doesn't carry it, so
        // there's nothing to merge/overwrite here.
      };
    }
    case "dbHydrate":
      return {
        ...state,
        matchSetup: event.matchSetup,
        matchSetupCompleted: event.matchSetupCompleted || state.matchSetupCompleted,
        tournament: event.tournament,
      };
    case "dbHydrateExtras": {
      const c = event.channels;
      return {
        ...state,
        weather: c
          ? { show: c.weather, data: event.weather ? { ...state.weather.data, ...event.weather.data } : state.weather.data }
          : state.weather,
        matchBoundaries: c ? { ...state.matchBoundaries, show: c.matchBoundaries } : state.matchBoundaries,
        tournamentBoundaries: c
          ? { ...state.tournamentBoundaries, show: c.tournamentBoundaries }
          : state.tournamentBoundaries,
        liveScoreBar: c ? { show: c.liveScoreBar } : state.liveScoreBar,
        pointsTable: c ? { show: c.pointsTable } : state.pointsTable,
        matchScorecard: c ? { show: c.matchScorecard } : state.matchScorecard,
        matchIntro: c ? { show: c.matchIntro } : state.matchIntro,
        tournamentLogo: c ? { show: c.tournamentLogo } : state.tournamentLogo,
        testBg: c ? { show: c.testBg } : state.testBg,
        liveState: event.liveState ?? state.liveState,
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

  const [matchId, setMatchId] = React.useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOrCreateMatch(auctionId).then(async (row) => {
      if (cancelled || !row) return;
      setMatchId(row.id);
      dispatch({
        type: "dbHydrate",
        matchSetup: row.match_setup,
        matchSetupCompleted: !!row.match_setup_completed,
        tournament: row.tournament,
      });

      const [liveState, weather, channels] = await Promise.all([
        loadLiveState(row.id),
        loadWeather(row.id),
        loadOnAirChannels(row.id),
      ]);
      if (cancelled) return;
      dispatch({ type: "dbHydrateExtras", liveState, weather, channels });
    });
    return () => {
      cancelled = true;
    };
  }, [auctionId]);

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

      <MatchMomentOverlay hideDemoButtons logoSrc={state.matchSetup?.tournamentLogoUrl} />

      <LiveScoreBar
        show={state.liveScoreBar.show}
        hideTrigger
        liveState={state.liveState ?? undefined}
        matchSetup={state.matchSetup ?? undefined}
      />

      <PointsTable show={state.pointsTable.show} hideTrigger auctionId={auctionId}/>

      <CricketScorecard
        show={state.matchScorecard.show}
        hideTrigger
        matchId={matchId}
        matchSetup={state.matchSetup ?? undefined}
        liveState={state.liveState ?? undefined}
        sandboxInningsCards={undefined}
      />

      <CricketMatchIntro
        show={state.matchIntro.show}
        hideTrigger
        matchSetup={state.matchSetup ?? undefined}
        // FIX — was `state.matchSetup?.tournament`, a plain string field that
        // doesn't match the { name, edition, logo } shape this prop expects
        // (silently spread as garbage before, effectively a no-op that let the
        // component fall through to its old fictional defaults). Now passes
        // the real tournament identity resolved from the `tournaments` table
        // — same source TournamentLogoDisplay below uses — so both overlays
        // agree on the actual crest/name instead of one of them substituting
        // a fake brand.
        tournament={
          state.tournament
            ? {
                name: state.tournament.name,
                edition:
                  [state.matchSetup?.season && `SEASON ${state.matchSetup.season}`, state.matchSetup?.format]
                    .filter(Boolean)
                    .join(" · ") || undefined,
                logo: state.tournament.logoUrl || undefined,
              }
            : undefined
        }
        matchMeta={state.matchSetup?.matchMeta ?? undefined}
      />

      {state.tournamentLogo.show && (() => {
        // Standalone = no tournament attached at all (state.tournament
        // is null). A tournament match's name/logo now comes ONLY from
        // `tournaments` (state.tournament) — matchSetup.tournamentName/
        // tournamentLogoUrl are no longer read for that case, since
        // those fields can be empty/stale even on a genuinely
        // tournament-attached match (that ambiguity was the reason for
        // this change). matchSetup is still used, unchanged, for a
        // standalone match's own self-set title/logo.
        const isStandalone = !state.tournament;

        const name = isStandalone
          ? state.matchSetup?.matchTitle || undefined
          : state.tournament!.name || undefined;

        const edition = isStandalone
          ? state.matchSetup?.format || undefined
          : [
              state.matchSetup?.season && `SEASON ${state.matchSetup.season}`,
              state.matchSetup?.format,
            ]
              .filter(Boolean)
              .join(" · ") || undefined;

        const logo = isStandalone
          ? state.matchSetup?.tournamentLogoUrl || undefined
          : state.tournament!.logoUrl || undefined;

        return <TournamentLogoDisplay name={name} edition={edition} logo={logo} />;
      })()}
    </div>
  );
}