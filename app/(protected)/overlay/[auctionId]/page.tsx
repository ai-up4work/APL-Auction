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
} from "@/lib/matchPersistence"; // NEW — extras added alongside getOrCreateMatch

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

// Grace period after the channel reports SUBSCRIBED before we send the
// first requestSync. Supabase Realtime broadcasts sent immediately on
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

// ─────────────────────────────────────────────────────────────
// NEW — a local, non-bus action for hydrating matchSetup straight from
// Postgres. Deliberately NOT part of the `OverlayEvent` union (that
// type is the wire format for the realtime bus) — it's a
// same-shaped-but-separate action the reducer also understands, fired
// once getOrCreateMatch() resolves on this page. Keeping it as its own
// variant (rather than reusing the bus's "matchSetup" event, which
// unconditionally sets matchSetupCompleted: true) lets a DRAFT
// (not-yet-pushed) row in the DB be loaded without falsely flipping
// the "live" flag — same gating rule the bus's syncSnapshot case
// already applies.
// ─────────────────────────────────────────────────────────────
interface DbHydrateAction {
  type: "dbHydrate";
  matchSetup: MatchSetup;
  matchSetupCompleted: boolean;
}

// ─────────────────────────────────────────────────────────────
// NEW — same idea as DbHydrateAction, extended to the other tables
// this page previously depended ENTIRELY on the realtime bus for:
// live score state, weather, and per-channel on-air visibility. All
// three of these only ever got populated by an admin tab's
// syncSnapshot reply to requestSync — if no admin tab was open, or the
// request/reply pair dropped (both of which the sync-retry logic
// below exists to work around, but can't fully eliminate), this page
// would silently sit on initialState for these fields forever, even
// though the real values were already sitting in Postgres in
// match_state / weather_readings / on_air_channels.
//
// Fields are optional/nullable here because any one of the three
// underlying reads can legitimately come back null (e.g. a fresh
// match with no weather ever set) — a null for a given field means
// "nothing persisted yet," not "hide this," so the reducer only
// applies a field when it actually has a value, leaving initialState
// (or whatever the bus has already delivered) untouched otherwise.
// ─────────────────────────────────────────────────────────────
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
        matchSetup: event.data.matchSetupCompleted ? event.data.matchSetup : state.matchSetup,
        matchSetupCompleted: event.data.matchSetupCompleted,
        liveState: event.data.liveState,
      };
    }
    // DB-sourced hydration for matchSetup. UNLIKE syncSnapshot, this
    // does NOT gate on matchSetupCompleted. That flag exists to stop
    // the BUS from showing an admin's in-progress, unsaved local draft
    // as if it were live — but anything read back out of
    // `matches.match_setup` is by definition already persisted, not a
    // draft, so it's always safe to display. Gating this the same way
    // as the bus was the bug: match_setup_completed can be false (e.g.
    // never flipped by the Match Editor, or the admin's "push" control
    // being missing) even though the team/venue/toss data itself is
    // real and correct in Postgres — which is exactly why teams were
    // stuck on "TBD" after a refresh even though the DB had good data
    // all along.
    //
    // This intentionally does NOT touch channel visibility (weather
    // show/hide, live score bar, etc) — those are handled by the
    // dbHydrateExtras case below, sourced from their own tables.
    case "dbHydrate":
      return {
        ...state,
        matchSetup: event.matchSetup,
        matchSetupCompleted: event.matchSetupCompleted || state.matchSetupCompleted,
      };
    // DB-sourced hydration for everything else this page used to wait
    // on the bus for. Same non-gated reasoning as dbHydrate above:
    // these are persisted rows, not drafts, so there's no "completed"
    // flag to check. Each field is only applied when the corresponding
    // read actually returned something, so a match with e.g. no
    // weather row yet doesn't clobber whatever the bus already set.
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

  // Resolved Supabase `matches.id` for this auctionId, independent of the
  // bus. Needed by CricketScorecard to subscribe to the `balls` ledger
  // directly, and now also used to drive the DB hydration below.
  const [matchId, setMatchId] = React.useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────
  // FIX — this page used to depend ENTIRELY on the realtime bus for
  // matchSetup, live score state, weather, and channel visibility: it
  // would sit on initialState (every placeholder/"TBD"/hidden overlay)
  // until an admin tab happened to be open, connected, and answered a
  // requestSync. If no admin tab was open — or the very first
  // requestSync/response pair dropped and every retry also missed —
  // the overlay just never got real data, even though it was sitting
  // right there in Postgres.
  //
  // getOrCreateMatch() already returns the fully normalized
  // `match_setup` (via normalizeMatchSetup, which also handles the
  // Match-Editor's team1/team2 shape) plus `match_setup_completed`.
  // loadLiveState / loadWeather / loadOnAirChannels cover the rest of
  // what the bus's syncSnapshot would otherwise be the only source
  // for. All four reads seed local state directly, so:
  //   - a hard refresh of THIS tab shows real data immediately, with
  //     no dependency on any admin tab being open at all;
  //   - the bus sync (below, unchanged) still runs and will overwrite
  //     this with a fresher snapshot the moment it succeeds, so live
  //     edits pushed after this initial load still propagate normally.
  //
  // The three extra reads run in parallel via Promise.all rather than
  // sequentially — they're independent tables, no reason to wait on
  // one before starting the next, and matchId is already known by the
  // time we get here since getOrCreateMatch has already resolved.
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    getOrCreateMatch(auctionId).then(async (row) => {
      if (cancelled || !row) return;
      setMatchId(row.id);
      dispatch({
        type: "dbHydrate",
        matchSetup: row.match_setup,
        matchSetupCompleted: !!row.match_setup_completed,
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


      {/* Fed matchId/matchSetup/liveState so it can derive the
          batting/bowling cards from the balls ledger. */}
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
        tournament={state.matchSetup?.tournament ?? undefined}
        matchMeta={state.matchSetup?.matchMeta ?? undefined}
      />

      {state.tournamentLogo.show && (() => {
        // A standalone match (no tournament attached) has a blank
        // `tournamentName` — the Match Editor only populates that
        // field when the match is created under a tournament. In
        // that case, showing an empty/placeholder tournament banner
        // is wrong; the useful thing to show instead is the match's
        // own title (e.g. "Semi Final 1", "Friendly") and its own
        // logo — both of which already exist on MatchSetup
        // (`matchTitle`, `tournamentLogoUrl`) regardless of whether
        // a tournament is attached, since the Match Editor lets a
        // standalone match set its own logo into that same field.
        const isStandalone = !state.matchSetup?.tournamentName?.trim();
        const name = isStandalone
          ? state.matchSetup?.matchTitle || undefined
          : state.matchSetup?.tournamentName || undefined;
        const edition = isStandalone
          ? state.matchSetup?.format || undefined
          : state.matchSetup
          ? [
              state.matchSetup.season && `SEASON ${state.matchSetup.season}`,
              state.matchSetup.format,
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          : undefined;
        return (
          <TournamentLogoDisplay
            name={state.matchSetup?.tournamentName || state.matchSetup?.matchTitle || undefined}
            edition={edition}
            logo={state.matchSetup?.tournamentLogoUrl || undefined}
          />
        );
      })()}
    </div>
  );
}