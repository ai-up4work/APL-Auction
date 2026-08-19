// app/overlay/[auctionId]/admin/page.tsx
"use client";

import React, { use, useEffect, useRef, useState } from "react";
import { connectOverlayBus, type OverlayEvent, type MatchSetup, type LiveState, type SyncSnapshot, type WeatherData, type BatterState, type BowlerState } from "@/lib/overlayBus";
import MatchSetupPanel from "@/components/overlays/admin/MatchSetupPanel";
import LiveStatePanel from "@/components/overlays/admin/LiveStatePanel";
import ProgramMonitor from "@/components/overlays/admin/ProgramMonitor";
import OnAirChannels, { type OnAirChannelsHandle } from "@/components/overlays/admin/OnAirChannels";
import { Section, StatusPill, ActionButton } from "@/components/overlays/admin/ui";
import { ChevronDown, AlertTriangle, PenLine, Trophy as TrophyIcon } from "lucide-react";
import type { EngineSyncState } from "@/hooks/useLiveScoringEngine";
import { supabase } from "@/lib/supabase";
import {
  getOrCreateMatch,
  saveMatchSetup,
  loadLiveState,
  saveLiveState,
  loadEngineState,
  saveEngineState,
  clearEngineState,
  loadWeather,
  saveWeather,
  deleteAllBalls
} from "@/lib/matchPersistence";

import WeatherPanel, { type WeatherPanelHandle } from "@/components/overlays/admin/WeatherPanel";
import { GeocodeMatch } from "@/lib/fetchVenueWeather";
import { RoleGate } from "@/components/RoleGate";
import { getOrgIdForMatch } from "@/lib/organization/invites";


// ── Match Setup (SESSION) ──────────────────────────────────────────────
const emptyTeam = () => ({
  name: "",
  shortCode: "",
  color: "#c9971f",
  logoUrl: "",
  squad: [] as string[],
  squadPlayers: [] as { id: string; name: string; imageUrl?: string }[],
});

const emptyMatchSetup: MatchSetup = {
  tournamentName: "",
  season: "",
  tournamentLogoUrl: "",
  venue: "",
  format: "T20",
  matchNumber: "",
  matchTitle: "",
  teamA: emptyTeam(),
  kickoffTime: "",
  teamB: emptyTeam(),
  matchMeta: "",
  tournament: "",
  tossWinner: "",
  tossDecision: "",
};

// ── Live State (INCREMENTAL) ───────────────────────────────────────────
const emptyBatter = () => ({ name: "", runs: 0, balls: 0, fours: 0, sixes: 0, imageUrl: undefined as string | undefined });
const emptyBowler = () => ({ name: "", overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 });

const emptyLiveState: LiveState = {
  score: { runs: 0, wickets: 0, overs: 0, balls: 0 },
  striker: emptyBatter(),
  nonStriker: emptyBatter(),
  bowler: emptyBowler(),
  partnership: { runs: 0, balls: 0 },
  matchBoundaries: { fours: 0, sixes: 0 },
  tournamentBoundaries: { fours: 0, sixes: 0 },
  pointsTable: [],
  thisOver: [],
};

// ── Weather (last pushed) ───────────────────────────────────────────────
const defaultWeatherData: WeatherData = {
  venue: "INLAND CRICKET GROUND",
  temp: 28,
  unit: "C",
  condition: "sunny",
  corner: "top-right",
};

// ── Moments (EVENT) ─────────────────────────────────────────────────────
interface WicketDraft {
  batsmanOut: "striker" | "nonStriker";
  dismissalType: "bowled" | "caught" | "lbw" | "runOut" | "stumped" | "hitWicket";
  fielder: string;
}

const emptyWicketDraft: WicketDraft = { batsmanOut: "striker", dismissalType: "bowled", fielder: "" };

interface WicketMomentPayload {
  batsmanOut: "striker" | "nonStriker";
  batter: { name: string; runs: number; balls: number };
  dismissalType: WicketDraft["dismissalType"];
  fielder: string;
  bowlerName: string;
}

interface MatchCompletePayload {
  winningTeamName: string;
  margin: string;
  method: "batting" | "bowling" | "tie" | "runs" | "wickets" ;
}

function sanitizeBatter(b: any): BatterState {
  return {
    name: typeof b?.name === "string" ? b.name : "",
    runs: Number(b?.runs) || 0,
    balls: Number(b?.balls) || 0,
    fours: Number(b?.fours) || 0,
    sixes: Number(b?.sixes) || 0,
    imageUrl: typeof b?.imageUrl === "string" ? b.imageUrl : undefined,
  };
}

function sanitizeBowler(b: any): BowlerState {
  return {
    name: typeof b?.name === "string" ? b.name : "",
    overs: Number(b?.overs) || 0,
    balls: Number(b?.balls) || 0,
    maidens: Number(b?.maidens) || 0,
    runs: Number(b?.runs) || 0,
    wickets: Number(b?.wickets) || 0,
  };
}

function sanitizeLiveState(raw: any): LiveState {
  return {
    score: {
      runs: Number(raw?.score?.runs) || 0,
      wickets: Number(raw?.score?.wickets) || 0,
      overs: Number(raw?.score?.overs) || 0,
      balls: Number(raw?.score?.balls) || 0,
    },
    striker: sanitizeBatter(raw?.striker),
    nonStriker: sanitizeBatter(raw?.nonStriker),
    bowler: sanitizeBowler(raw?.bowler),
    partnership: {
      runs: Number(raw?.partnership?.runs) || 0,
      balls: Number(raw?.partnership?.balls) || 0,
    },
    matchBoundaries: {
      fours: Number(raw?.matchBoundaries?.fours) || 0,
      sixes: Number(raw?.matchBoundaries?.sixes) || 0,
    },
    tournamentBoundaries: {
      fours: Number(raw?.tournamentBoundaries?.fours) || 0,
      sixes: Number(raw?.tournamentBoundaries?.sixes) || 0,
    },
    pointsTable: Array.isArray(raw?.pointsTable) ? raw.pointsTable : [],
    thisOver: Array.isArray(raw?.thisOver) ? raw.thisOver : [],
    target: raw?.target !== undefined && raw?.target !== null ? Number(raw.target) : undefined,
    inningsNumber: raw?.inningsNumber === 2 ? 2 : raw?.inningsNumber === 1 ? 1 : undefined,
    matchComplete: !!raw?.matchComplete,
    matchResult:
      raw?.matchResult && typeof raw.matchResult.winningTeamName === "string"
        ? {
            winningTeamName: raw.matchResult.winningTeamName,
            margin: typeof raw.matchResult.margin === "string" ? raw.matchResult.margin : "",
            method: raw.matchResult.method === "runs" || raw.matchResult.method === "tie" ? raw.matchResult.method : "wickets",
          }
        : undefined,
  };
}

function sanitizeEngineState(raw: any): EngineSyncState | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    dismissedPlayers: Array.isArray(raw.dismissedPlayers) ? raw.dismissedPlayers.filter((x: unknown) => typeof x === "string") : [],
    extraType: ["none", "wide", "noBall", "bye", "legBye"].includes(raw.extraType) ? raw.extraType : "none",
    isFreeHit: !!raw.isFreeHit,
    activeSlot: ["striker", "nonStriker", "bowler"].includes(raw.activeSlot) ? raw.activeSlot : "striker",
    overRunsConceded: Number(raw.overRunsConceded) || 0,
    overJustCompleted: !!raw.overJustCompleted,
    pendingWicket: raw.pendingWicket && typeof raw.pendingWicket === "object" ? raw.pendingWicket : null,
    undoSnapshot: raw.undoSnapshot && typeof raw.undoSnapshot === "object" ? raw.undoSnapshot : null,
    ballSequence: Number(raw.ballSequence) || 0,
    benchedBatters: raw.benchedBatters && typeof raw.benchedBatters === "object" ? raw.benchedBatters : {},
    benchedBowlers: raw.benchedBowlers && typeof raw.benchedBowlers === "object" ? raw.benchedBowlers : {},
    matchWonFiredSignature: typeof raw.matchWonFiredSignature === "string" ? raw.matchWonFiredSignature : null,
  };
}

function BatterPickerButton({
  batter,
  label,
  selected,
  onClick,
}: {
  batter: { name: string; imageUrl?: string };
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all border ${
        selected ? "bg-gold/[0.12] border-gold/45" : "bg-white/[0.02] border-gold/10 hover:border-gold/25"
      }`}
    >
      <span className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-black/60 border border-gold/10">
        {batter.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={batter.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] font-bold font-cinzel text-gray-500">
            {(batter.name || label).slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      <span className="flex flex-col min-w-0">
        <span className={`text-[11px] font-bold font-cinzel truncate ${selected ? "text-gold" : "text-gray-100"}`}>
          {batter.name || label}
        </span>
        <span className="text-[9px] uppercase tracking-wide font-cinzel text-gray-500">{label}</span>
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// hydration UI: skeleton shown while the Supabase load is in flight, and an
// error banner shown if it failed.
// ─────────────────────────────────────────────────────────────────────────────

function HydrationSkeleton() {
  return (
    <div className="rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center bg-black/50 backdrop-blur-xl border border-dashed border-gold/20 min-h-[220px]">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{
          background: "radial-gradient(circle at 35% 30%, #ffe08a, #F5A623 65%)",
          boxShadow: "0 0 8px 1px rgba(245,166,35,0.5)",
          animation: "connPulse 1.2s ease-in-out infinite",
        }}
      />
      <style>{`@keyframes connPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }`}</style>
      <p className="text-[11px] uppercase tracking-widest font-cinzel text-gray-500">Loading match data…</p>
    </div>
  );
}

function HydrationErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-3 bg-red-500/[0.06] border border-red-400/30">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-400" />
        <span className="text-[11px] font-black uppercase tracking-widest font-cinzel text-red-400">
          Couldn&apos;t load match data
        </span>
      </div>
      <p className="text-[12px] leading-snug text-gray-300">
        The saved setup, live state, or weather for this match failed to load from the database.
        Editing now risks overwriting existing data with blank defaults — retry before making changes.
        Check the browser console for details.
      </p>
      <button
        onClick={onRetry}
        className="self-start px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wide font-cinzel bg-red-500 text-white hover:bg-red-600 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE — auth gate wraps the real content component below
// ─────────────────────────────────────────────────────────────────────────────

export default function OverlayAdminPage({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = use(params);

  return (
    <RoleGate resolveOrgId={() => getOrgIdForMatch(auctionId)} allowedRoles={["scorer"]}>
      <OverlayAdminPageContent auctionId={auctionId} />
    </RoleGate>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT — everything that used to be the page body lives here, unchanged
// ─────────────────────────────────────────────────────────────────────────────

function OverlayAdminPageContent({ auctionId }: { auctionId: string }) {
  const busRef = useRef<ReturnType<typeof connectOverlayBus> | null>(null);
  const matchIdRef = useRef<string | null>(null);


  const onAirRef = useRef<OnAirChannelsHandle>(null);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const weatherPanelRef = useRef<WeatherPanelHandle>(null);
  const [matchId, setMatchId] = useState<string | null>(null);

  // ── Match Setup state (session) ─────────────────────────────────────
  const [matchSetup, setMatchSetup] = useState<MatchSetup>(emptyMatchSetup);
  const [setupPushed, setSetupPushed] = useState(false);
  const [matchSetupCompleted, setMatchSetupCompleted] = useState(false);

  // NEW — mirrors MatchSetupPanel's own locked/unlocked state. True
  // whenever the operator has the full Match Setup form open (editing
  // teams, squads, toss, etc). Drives hiding LiveStatePanel below while
  // an edit is in progress, and — the other direction — MatchSetupPanel
  // already collapses itself to the compact LockedSummaryBar once
  // matchSetupCompleted flips true and it's not being edited, so the
  // two panels never fight for the same screen space either way.
  const [matchSetupEditing, setMatchSetupEditing] = useState(false);

  // Single source-of-truth hydration flag. True only once the Supabase
  // load (success OR failure) has resolved. Nothing writes to Supabase
  // before this flips, so we can never clobber a real DB row with the
  // empty initial state during the fetch window.
  const [hydrated, setHydrated] = useState(false);

  // NEW — distinguishes "load succeeded, this really is a fresh match"
  // from "load failed, we're showing defaults we shouldn't trust yet."
  // Previously these were indistinguishable once `hydrated` flipped
  // true, which meant a transient network blip during the initial
  // fetch looked exactly like a brand-new match and an operator could
  // start reconfiguring real data on top of it, or push blank state
  // over Supabase once the save effects unlock.
  const [hydrationError, setHydrationError] = useState(false);

  // NEW — bumping this re-runs the hydration effect, used by the retry
  // button on the error banner.
  const [hydrationAttempt, setHydrationAttempt] = useState(0);

  // FIX — guards the very first save-effect run that fires as a side
  // effect of hydration itself. `setMatchSetup(match.match_setup)` and
  // `setHydrated(true)` land in the same hydration pass, so the
  // save-on-change effect below used to fire immediately on page load —
  // before the user had touched anything — and persist whatever shape
  // the in-memory matchSetup happened to be in at that moment. Combined
  // with the old non-merging saveMatchSetup, this is what wiped Match
  // Editor data (team1/team2, squads, officials, rosterLocked, ...) the
  // first time this admin page was opened for a friendly match. This
  // ref suppresses exactly that one post-hydration save; every save
  // after it reflects a genuine user edit.
  const justHydratedRef = useRef(false);

  // ── Live State (incremental) ────────────────────────────────────────
  const [liveState, setLiveState] = useState<LiveState>(emptyLiveState);
  const [liveDirty, setLiveDirty] = useState(false);
  const [livePushed, setLivePushed] = useState(false);

  const [engineSyncState, setEngineSyncState] = useState<EngineSyncState | null>(null);

  const [weatherData, setWeatherData] = useState<WeatherData>(defaultWeatherData);

  const [wicketDraft, setWicketDraft] = useState<WicketDraft>(emptyWicketDraft);
  const [showWicketForm, setShowWicketForm] = useState(false);
  const [milestoneBatter, setMilestoneBatter] = useState<"striker" | "nonStriker">("striker");
  const [showMoments, setShowMoments] = useState(false);

  const [setupPushCount, setSetupPushCount] = useState(0);
  const [sourceAuctionId, setSourceAuctionId] = useState<string | null>(null);

  const [showMatchWonForm, setShowMatchWonForm] = useState(false);
  const [matchWonDraft, setMatchWonDraft] = useState<{
    winner: "teamA" | "teamB" | "custom";
    customName: string;
    margin: string;
    method: "batting" | "bowling" | "tie" | "runs" | "wickets";
  }>({ winner: "teamA", customName: "", margin: "", method: "batting" });

  const overlayUrl = typeof window !== "undefined" ? `${window.location.origin}/overlay/${auctionId}` : "";

  const matchSetupRef = useRef(matchSetup);
  const matchSetupCompletedRef = useRef(matchSetupCompleted);
  const liveStateRef = useRef(liveState);
  const weatherRef = useRef(weatherData);

  useEffect(() => {
    matchSetupRef.current = matchSetup;
  }, [matchSetup]);

  useEffect(() => {
    matchSetupCompletedRef.current = matchSetupCompleted;
  }, [matchSetupCompleted]);

  useEffect(() => {
    liveStateRef.current = liveState;
  }, [liveState]);

  useEffect(() => {
    weatherRef.current = weatherData;
  }, [weatherData]);

  // ── SOLE hydration path — Supabase only. ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    // NEW — reset error state on every (re)hydration attempt, including
    // retries, so a failed retry can flip the banner back on rather than
    // getting stuck on stale "it worked" state.
    setHydrationError(false);

    (async () => {
      const match = await getOrCreateMatch(auctionId);
      if (!match || cancelled) {
        if (!cancelled) {
          // NEW — getOrCreateMatch already logs the underlying Postgrest
          // error via logDbError; here we just surface that a failure
          // happened, without stomping on whatever state is currently
          // in memory (e.g. from a previous successful load, or a
          // half-finished edit — see justHydratedRef comment above for
          // why we never want to overwrite blindly on this path).
          setHydrationError(true);
          setHydrated(true);
        }
        return;
      }
      matchIdRef.current = match.id;

      const [live, engine, weather] = await Promise.all([
        loadLiveState(match.id),
        loadEngineState(match.id),
        loadWeather(match.id),
      ]);

      if (cancelled) return;

      // Set everything together, in one go, so LiveStatePanel doesn't
      // mount (via matchSetupCompleted flipping true) until the engine
      // state has actually arrived. The hook only seeds its internal
      // state (dismissedPlayers, undo, activeSlot, etc.) from
      // `initialEngineState` on its VERY FIRST render — if it mounts
      // before this data is ready, it locks in empty defaults and never
      // re-reads a later-arriving prop update. Setting matchSetupCompleted
      // last, alongside the rest, guarantees the first mount already has
      // the real data.
      //
      // FIX — mark this as a hydration-driven update BEFORE flipping
      // hydrated, so the save effect below can tell this particular
      // matchSetup change apart from a real user edit and skip saving it.
      justHydratedRef.current = true;

      setMatchId(match.id);
      setSourceAuctionId(match.auction_id);
      setMatchSetup(match.match_setup); // already normalized by getOrCreateMatch
      setLiveState(live ? sanitizeLiveState(live) : emptyLiveState);
      setEngineSyncState(engine ? sanitizeEngineState(engine) : null);
      setWeatherData(weather ? weather.data : defaultWeatherData);
      setMatchSetupCompleted(match.match_setup_completed);

      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [auctionId, hydrationAttempt]); // NEW — hydrationAttempt lets the retry button re-run this

  // ── Save-to-Supabase effects — all gated on `hydrated` + a real matchId,
  // so nothing writes back before the initial load has actually resolved.
  // ALSO now gated on !hydrationError — see below. ──────────────────────
  useEffect(() => {
    // CHANGED — previously only checked `hydrated`. If the initial load
    // failed, `hydrated` still flips true (see above) but matchIdRef
    // will be null in the getOrCreateMatch-failure case, which already
    // blocked writes. The remaining gap: if getOrCreateMatch SUCCEEDED
    // but one of the three parallel loads failed, matchIdRef.current is
    // still set, and this effect would happily save right over the
    // fields that failed to load. Blocking on hydrationError closes
    // that gap explicitly rather than relying on matchIdRef as a proxy.
    if (!hydrated || !matchIdRef.current || hydrationError) return;

    // FIX — skip the one save that would otherwise fire as a direct
    // side effect of hydration setting matchSetup + hydrated together.
    // Without this, opening this page for a match that was set up via
    // the Match Editor immediately re-persisted the overlay's narrower
    // teamA/teamB view back over the row. (saveMatchSetup itself now
    // also merges rather than overwrites — see matchPersistence.ts —
    // so this guard and that fix both close the same hole, belt and
    // braces.)
    if (justHydratedRef.current) {
      justHydratedRef.current = false;
      return;
    }

    saveMatchSetup(auctionId, matchSetup, matchSetupCompleted);
  }, [matchSetup, matchSetupCompleted, auctionId, hydrated, hydrationError]);

  useEffect(() => {
    if (!hydrated || !matchIdRef.current || hydrationError) return;
    saveLiveState(matchIdRef.current, liveState);
  }, [liveState, hydrated, hydrationError]);

  useEffect(() => {
    if (!hydrated || !matchIdRef.current || hydrationError) return;
    saveWeather(matchIdRef.current, weatherData);
  }, [weatherData, hydrated, hydrationError]);

  const pendingSyncRequestRef = useRef(false);

  function fire(event: OverlayEvent, label: string) {
    busRef.current?.send(event);
    setLog((prev) => [`${new Date().toLocaleTimeString("en-GB", { hour12: false })}  ${label}`, ...prev].slice(0, 12));
  }

  function sendFullSnapshot() {
    const channels = onAirRef.current?.getVisibleSnapshot();
    if (!channels) {
      pendingSyncRequestRef.current = true;
      return;
    }
    const snapshot: SyncSnapshot = {
      channels,
      matchSetup: matchSetupRef.current,
      matchSetupCompleted: matchSetupCompletedRef.current,
      liveState: liveStateRef.current,
      weather: weatherRef.current,
    };
    fire({ type: "syncSnapshot", data: snapshot }, "Sent full sync snapshot");
  }

  useEffect(() => {
    if (onAirRef.current && pendingSyncRequestRef.current) {
      pendingSyncRequestRef.current = false;
      sendFullSnapshot();
    }
  });

  useEffect(() => {
    const bus = connectOverlayBus(auctionId);
    busRef.current = bus;
    bus.onReady(() => setConnected(true));

    const unsubscribe = bus.on((event) => {
      if (event.type === "requestSync") {
        sendFullSnapshot();
      }
    });

    return () => {
      unsubscribe();
      bus.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  function handleEngineStateChange(state: EngineSyncState) {
    setEngineSyncState(state);
    if (!matchIdRef.current) return;
    saveEngineState(matchIdRef.current, state);
  }

  const autoPushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (!liveDirty) return;

    if (autoPushTimerRef.current) clearTimeout(autoPushTimerRef.current);
    autoPushTimerRef.current = setTimeout(() => {
      pushLiveState();
    }, 150);

    return () => {
      if (autoPushTimerRef.current) clearTimeout(autoPushTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveDirty, liveState, hydrated]);

  function fireLoose(event: Record<string, unknown>, label: string) {
    fire(event as unknown as OverlayEvent, label);
  }

  function pushFetchedWeather(wx: { venue: string; temp: number; unit: "C"; condition: string }) {
    const weatherPayload: WeatherData = {
      venue: wx.venue.toUpperCase(),
      temp: wx.temp,
      unit: wx.unit,
      condition: wx.condition,
      corner: weatherRef.current.corner,
    };
    setWeatherData(weatherPayload);
    fireLoose(
      { type: "weather", show: true, data: weatherPayload },
      `Weather fetched — ${wx.venue}: ${wx.temp}°C, ${wx.condition}`
    );
  }

  function pushMatchSetup() {
    fireLoose({ type: "matchSetup", data: matchSetup }, "Match Setup pushed to overlay");
    setSetupPushed(true);
    setMatchSetupCompleted(true);
    setSetupPushCount((n) => n + 1);
    setTimeout(() => setSetupPushed(false), 1500);
  }

  function pushLiveState() {
    fireLoose({ type: "liveState", data: liveStateRef.current }, "Live State pushed to overlay");
    setLiveDirty(false);
    setLivePushed(true);
    setTimeout(() => setLivePushed(false), 1500);
  }

  function fireBoundaryMoment(moment: "four" | "six", override?: { name: string; runs: number; balls: number }) {
    const batter = override ?? liveState.striker;
    fireLoose(
      { type: "moment", moment, player: batter.name || "Striker", score: `${batter.runs}(${batter.balls})` },
      `Moment: ${moment.toUpperCase()} — ${batter.name || "Striker"} ${batter.runs}(${batter.balls})`
    );
    onAirRef.current?.notifyMomentFired();
  }

  function fireMilestoneMoment(
    moment: "fifty" | "hundred",
    override?: { name: string; runs: number; balls: number; label?: string }
  ) {
    const batter = override ?? liveState[milestoneBatter];
    const label = override?.label ?? batter.name ?? (milestoneBatter === "striker" ? "Striker" : "Non-striker");
    fireLoose(
      { type: "moment", moment, player: label, score: `${batter.runs}(${batter.balls})` },
      `Moment: ${moment.toUpperCase()} — ${label} ${batter.runs}(${batter.balls})`
    );
    onAirRef.current?.notifyMomentFired();
  }

  function fireWicketMomentFrom(payload: WicketMomentPayload) {
    const { batsmanOut, batter, dismissalType, fielder, bowlerName } = payload;
    const batterLabel = batter.name || (batsmanOut === "striker" ? "Striker" : "Non-striker");
    fireLoose(
      {
        type: "moment",
        moment: "wicket",
        batsmanOut,
        player: batterLabel,
        score: `${batter.runs}(${batter.balls})`,
        dismissalType,
        bowler: bowlerName,
        fielder,
      },
      `Moment: WICKET — ${batterLabel} ${dismissalType}${bowlerName ? ` b ${bowlerName}` : ""}${fielder ? ` c ${fielder}` : ""}`
    );
    onAirRef.current?.notifyMomentFired();
  }

  function fireBoundaryMomentFromPanel(moment: "four" | "six") {
    fireBoundaryMoment(moment);
  }

  function fireMaidenMoment(payload: { bowlerName: string; maidens: number }) {
    fireLoose(
      { type: "moment", moment: "maiden", bowler: payload.bowlerName, maidens: payload.maidens },
      `Moment: MAIDEN OVER — ${payload.bowlerName || "Bowler"} (${payload.maidens})`
    );
    onAirRef.current?.notifyMomentFired();
  }

  function fireMaidenMomentFromPanel() {
    if (!liveState.bowler.name) {
      setLog((prev) => [
        `${new Date().toLocaleTimeString("en-GB", { hour12: false })}  Maiden — set a bowler in Live State first`,
        ...prev,
      ].slice(0, 12));
      return;
    }
    fireMaidenMoment({ bowlerName: liveState.bowler.name, maidens: liveState.bowler.maidens });
  }

  function teamVisualsByName(name: string): { color?: string; logoUrl?: string } {
    if (matchSetup.teamA.name === name) return { color: matchSetup.teamA.color, logoUrl: matchSetup.teamA.logoUrl };
    if (matchSetup.teamB.name === name) return { color: matchSetup.teamB.color, logoUrl: matchSetup.teamB.logoUrl };
    return {};
  }

  function fireMatchWonMoment(payload: MatchCompletePayload) {
    const visuals = teamVisualsByName(payload.winningTeamName);
    fireLoose(
      {
        type: "moment",
        moment: "matchWon",
        player: payload.winningTeamName,
        score: payload.margin,
        method: payload.method === "tie" ? "tie" : payload.method === "bowling" ? "runs" : "wickets",
        teamColor: visuals.color,
        teamLogoUrl: visuals.logoUrl,
      },
      `Moment: MATCH WON — ${payload.winningTeamName} ${payload.margin}`
    );
    onAirRef.current?.notifyMomentFired();
  }

  function fireMatchWonMomentAuto(payload: {
    winningTeamName: string;
    margin: string;
    method: "runs" | "wickets" | "tie";
    teamColor?: string;
    teamLogoUrl?: string;
  }) {
    fireLoose(
      {
        type: "moment",
        moment: "matchWon",
        player: payload.winningTeamName,
        score: payload.margin,
        method: payload.method,
        teamColor: payload.teamColor,
        teamLogoUrl: payload.teamLogoUrl,
      },
      `Moment: MATCH WON (auto) — ${payload.winningTeamName} ${payload.margin}`
    );
    onAirRef.current?.notifyMomentFired();
  }

  function openMatchWonForm() {
    if (liveState.matchResult) {
      const { winningTeamName, margin, method } = liveState.matchResult;
      const winner: "teamA" | "teamB" | "custom" =
        winningTeamName === matchSetup.teamA.name
          ? "teamA"
          : winningTeamName === matchSetup.teamB.name
          ? "teamB"
          : "custom";
      setMatchWonDraft({
        winner,
        customName: winner === "custom" ? winningTeamName : "",
        margin,
        method: method === "tie" ? "tie" : method === "runs" ? "bowling" : "batting",
      });
    }
    setShowMatchWonForm((v) => !v);
  }

  function fireMatchWonMomentFromForm() {
    const winningTeamName =
      matchWonDraft.winner === "teamA"
        ? matchSetup.teamA.name || "Team A"
        : matchWonDraft.winner === "teamB"
        ? matchSetup.teamB.name || "Team B"
        : matchWonDraft.customName.trim() || "Winner";
    const margin = matchWonDraft.margin.trim() || "Match Won";
    fireMatchWonMoment({ winningTeamName, margin, method: matchWonDraft.method });
    setShowMatchWonForm(false);
  }

  function logInningsEnd(payload: { target: number; previousInningsRuns: number; inningsNumber: 1 | 2 }) {
    setLog((prev) => [
      `${new Date().toLocaleTimeString("en-GB", { hour12: false })}  Innings ended — target set to ${payload.target}`,
      ...prev,
    ].slice(0, 12));
  }

  function handleAutoMatchComplete(result: MatchCompletePayload) {
    const winner: "teamA" | "teamB" | "custom" =
      result.winningTeamName === matchSetup.teamA.name
        ? "teamA"
        : result.winningTeamName === matchSetup.teamB.name
        ? "teamB"
        : "custom";
    setMatchWonDraft({
      winner,
      customName: winner === "custom" ? result.winningTeamName : "",
      margin: result.margin,
      method: result.method,
    });
    setShowMoments(true);
    setShowMatchWonForm(true);
    setLog((prev) => [
      `${new Date().toLocaleTimeString("en-GB", { hour12: false })}  Match complete detected — ${result.winningTeamName} ${result.margin}. Graphic fired automatically; form pre-filled if you need to re-fire.`,
      ...prev,
    ].slice(0, 12));
  }

  function fireMilestoneMomentFromPanel(moment: "fifty" | "hundred") {
    fireMilestoneMoment(moment);
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

    // Both DB calls gated on matchIdRef — no localStorage cleanup needed
    // anymore, Supabase is the only place this state lives.
    if (matchIdRef.current) {
      deleteAllBalls(matchIdRef.current);
      clearEngineState(matchIdRef.current);
    }

    setEngineSyncState(null);
  }

  function fireWicketMoment() {
    const batter = liveState[wicketDraft.batsmanOut];
    fireWicketMomentFrom({
      batsmanOut: wicketDraft.batsmanOut,
      batter: { name: batter.name, runs: batter.runs, balls: batter.balls },
      dismissalType: wicketDraft.dismissalType,
      fielder: wicketDraft.fielder,
      bowlerName: liveState.bowler.name,
    });
    setWicketDraft(emptyWicketDraft);
    setShowWicketForm(false);
  }

  const runRate =
    liveState.score.overs + liveState.score.balls / 6 > 0
      ? (liveState.score.runs / (liveState.score.overs + liveState.score.balls / 6)).toFixed(2)
      : "0.00";
  const scoreIsLive =
    liveState.score.runs > 0 || liveState.score.wickets > 0 || liveState.score.overs > 0 || liveState.score.balls > 0;

  return (
    <div className="min-h-screen w-full bg-black text-white">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(245,166,35,0.06),_transparent_55%)]" style={{ zIndex: 0 }} />

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 py-6 mb-0 lg:mb-6 flex flex-col gap-6 sm:gap-8">
        {/* ── Header — now IS the On Air panel. On desktop it's the full
            styled row inline; on mobile OnAirChannels renders a compact
            trigger pill instead that opens a bottom-sheet overlay, so it
            never has to be manually collapsed/expanded here. ── */}
        <div>
          <OnAirChannels ref={onAirRef} fire={fire} matchId={matchId} />
        </div>

        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 items-start">
          <div className="w-full lg:flex-1 lg:min-w-0 flex flex-col gap-5 sm:gap-6">
            {/* Gate the entire editable column on hydration state.
                Previously MatchSetupPanel rendered fully interactive
                immediately on mount, using the empty in-memory defaults,
                while the Supabase fetch was still in flight. If an
                operator started typing during that window, the fetch
                would resolve moments later and setMatchSetup(match.match_setup)
                would silently stomp their edits. LiveStatePanel was
                already implicitly protected by the matchSetupCompleted
                gate, but MatchSetupPanel had no equivalent guard. */}
            {!hydrated ? (
              <HydrationSkeleton />
            ) : hydrationError ? (
              <HydrationErrorBanner onRetry={() => setHydrationAttempt((n) => n + 1)} />
            ) : (
              <>
                <MatchSetupPanel
                  auctionId={sourceAuctionId}
                  matchId={matchId}                 // enables the Match Editor link
                  auctionAdminHref={undefined}      // set this to your real Auctions tab route
                  matchSetup={matchSetup}
                  setMatchSetup={setMatchSetup}
                  onPush={pushMatchSetup}
                  pushLabel={setupPushed ? "Pushed ✓" : "Push Match Setup"}
                  completed={matchSetupCompleted}
                  onEditingChange={setMatchSetupEditing}
                  onVenueSelect={async (match, displayName) => {
                    try {
                      // your geocode/weather logic here, using `match` (GeocodeMatch)
                    } catch (err) {
                      console.error("[v0] Geocoding failed:", err);
                    }
                  }}
                />

                {/* NEW — the two panels now hide each other instead of
                    both being on screen at once. While Match Setup is
                    open for editing (matchSetupEditing), Live State is
                    swapped out for a short "come back when you're done"
                    placeholder — editing teams/squads mid-innings is
                    exactly the scenario that used to let a Match Setup
                    save silently pull the rug out from under an active
                    scoring session. The reverse direction is already
                    handled by MatchSetupPanel itself: once completed and
                    not being edited, it collapses to the compact
                    LockedSummaryBar, so it never competes for space with
                    Live State either. */}
                {matchSetupEditing ? (
                  <div className="rounded-xl p-6 text-center bg-black/50 backdrop-blur-xl border border-dashed border-gold/20">
                    <PenLine className="h-5 w-5 mx-auto mb-2 text-gray-500" />
                    <p className="text-[11px] uppercase tracking-widest font-cinzel text-gray-500">
                      Live scoring is hidden while Match Setup is open — push or close it above to come back
                    </p>
                  </div>
                ) : matchSetupCompleted ? (
                  <LiveStatePanel
                    auctionId={auctionId}
                    matchId={matchId}
                    liveState={liveState}
                    setLiveState={setLiveState}
                    setLiveDirty={setLiveDirty}
                    liveDirty={liveDirty}
                    onPush={pushLiveState}
                    pushLabel={livePushed ? "Pushed ✓" : "Push Live State"}
                    matchSetup={matchSetup}
                    onBoundary={fireBoundaryMoment}
                    onMilestone={fireMilestoneMoment}
                    onWicketConfirm={fireWicketMomentFrom}
                    onMaiden={fireMaidenMoment}
                    onInningsEnd={logInningsEnd}
                    onMatchComplete={handleAutoMatchComplete}
                    onFireMatchWonMoment={fireMatchWonMomentAuto}
                    onRestartMatch={restartMatch}
                    initialEngineState={engineSyncState}
                    onEngineStateChange={handleEngineStateChange}
                  />
                ) : (
                  <div className="rounded-xl p-6 text-center bg-black/50 backdrop-blur-xl border border-dashed border-gold/20">
                    <TrophyIcon className="h-5 w-5 mx-auto mb-2 text-gray-500" />
                    <p className="text-[11px] uppercase tracking-widest font-cinzel text-gray-500">
                      Push Match Setup above to unlock live scoring
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <aside className="w-full lg:w-[380px] flex-shrink-0 flex flex-col gap-5 sm:gap-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh_+_3rem)] lg:overflow-y-auto lg:pr-1">
              <div className="hidden md:block">
                <ProgramMonitor overlayUrl={overlayUrl} />
              </div>
              <Section
                title="Moments"
                description="Fire the graphic the instant it happens on the ball."
              >
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => setShowMoments((v) => !v)}
                    className="flex items-center justify-between w-full rounded-lg px-3 py-2.5 sm:py-2 transition-colors bg-white/[0.02] border border-gold/10 hover:border-gold/30"
                  >
                    <span className="text-[11px] font-black uppercase tracking-widest font-cinzel text-gray-300">
                      Show Moments Controls
                    </span>

                    <ChevronDown
                      size={18}
                      className={`text-gray-500 transition-transform duration-200 ${showMoments ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showMoments && (
                    <>
                      <p className="text-[10px] leading-snug text-gray-500">
                        Four, Six, Fifty and Hundred now also fire automatically from the
                        ball pad in the Scorer panel — these buttons are still here for
                        manual/backup firing. Maiden overs fire automatically too, and the
                        Maiden button re-fires using whoever's set as bowler right now. Match
                        Won now fires automatically the instant a match completes — this
                        form opens pre-filled so you can review the winner/margin and
                        re-fire if anything needs a tweak.
                      </p>

                      <div className="grid grid-cols-2 gap-2.5">
                        <ActionButton
                          label="Four"
                          onClick={() => fireBoundaryMomentFromPanel("four")}
                        />

                        <ActionButton
                          label="Six"
                          onClick={() => fireBoundaryMomentFromPanel("six")}
                        />

                        <ActionButton
                          label="Wicket"
                          danger
                          active={showWicketForm}
                          onClick={() => setShowWicketForm((v) => !v)}
                        />

                        <ActionButton
                          label="Fifty"
                          onClick={() => fireMilestoneMomentFromPanel("fifty")}
                        />

                        <ActionButton
                          label="Maiden"
                          onClick={fireMaidenMomentFromPanel}
                        />

                        <ActionButton
                          label="Match Won"
                          active={showMatchWonForm}
                          onClick={openMatchWonForm}
                        />
                      </div>

                      <ActionButton
                        full
                        label="Hundred"
                        onClick={() => fireMilestoneMomentFromPanel("hundred")}
                      />

                      <div className="flex flex-col gap-2 pt-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest font-cinzel text-gray-500">
                          Fifty / Hundred for
                        </span>

                        <div className="grid grid-cols-2 gap-2">
                          <BatterPickerButton
                            batter={liveState.striker}
                            label="Striker"
                            selected={milestoneBatter === "striker"}
                            onClick={() => setMilestoneBatter("striker")}
                          />

                          <BatterPickerButton
                            batter={liveState.nonStriker}
                            label="Non-Striker"
                            selected={milestoneBatter === "nonStriker"}
                            onClick={() => setMilestoneBatter("nonStriker")}
                          />
                        </div>
                      </div>

                      {showWicketForm && (
                        <div className="flex flex-col gap-3 p-4 rounded-lg mt-1 bg-red-500/[0.06] border border-red-400/25">
                          <span className="text-[10px] font-black uppercase tracking-widest font-cinzel text-red-400">
                            Wicket Detail
                          </span>

                          <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-widest font-cinzel text-gray-400">
                              Batsman Out
                            </span>

                            <div className="grid grid-cols-2 gap-2">
                              <BatterPickerButton
                                batter={liveState.striker}
                                label="Striker"
                                selected={wicketDraft.batsmanOut === "striker"}
                                onClick={() =>
                                  setWicketDraft((p) => ({
                                    ...p,
                                    batsmanOut: "striker",
                                  }))
                                }
                              />

                              <BatterPickerButton
                                batter={liveState.nonStriker}
                                label="Non-Striker"
                                selected={wicketDraft.batsmanOut === "nonStriker"}
                                onClick={() =>
                                  setWicketDraft((p) => ({
                                    ...p,
                                    batsmanOut: "nonStriker",
                                  }))
                                }
                              />
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-widest font-cinzel text-gray-400">
                              Dismissal
                            </span>

                            <select
                              value={wicketDraft.dismissalType}
                              onChange={(e) =>
                                setWicketDraft((p) => ({
                                  ...p,
                                  dismissalType:
                                    e.target.value as WicketDraft["dismissalType"],
                                }))
                              }
                              className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-gold/10 text-gray-100"
                            >
                              <option value="bowled">Bowled</option>
                              <option value="caught">Caught</option>
                              <option value="lbw">LBW</option>
                              <option value="runOut">Run Out</option>
                              <option value="stumped">Stumped</option>
                              <option value="hitWicket">Hit Wicket</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-widest font-cinzel text-gray-400">
                              Fielder (if any)
                            </span>

                            <input
                              value={wicketDraft.fielder}
                              onChange={(e) =>
                                setWicketDraft((p) => ({
                                  ...p,
                                  fielder: e.target.value,
                                }))
                              }
                              placeholder="Fielder name"
                              className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-gold/10 text-gray-100 placeholder:text-gray-600"
                            />
                          </div>

                          <p className="text-[10px] text-gray-500">
                            Bowler pulled automatically from Live State:{" "}
                            {liveState.bowler.name || "—"}
                          </p>

                          <button
                            onClick={fireWicketMoment}
                            className="w-full py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-cinzel bg-red-500 text-white hover:bg-red-600 transition-colors"
                          >
                            Fire Wicket
                          </button>
                        </div>
                      )}

                      {showMatchWonForm && (
                        <div className="flex flex-col gap-3 p-4 rounded-lg mt-1 bg-gold/[0.06] border border-gold/25">
                          <span className="text-[10px] font-black uppercase tracking-widest font-cinzel text-gold">
                            Match Won Detail
                          </span>

                          <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-widest font-cinzel text-gray-400">
                              Winning Team
                            </span>

                            <div className="grid grid-cols-3 gap-2">
                              {(
                                [
                                  { key: "teamA" as const, label: matchSetup.teamA.name || "Team A" },
                                  { key: "teamB" as const, label: matchSetup.teamB.name || "Team B" },
                                  { key: "custom" as const, label: "Other" },
                                ]
                              ).map((opt) => (
                                <button
                                  key={opt.key}
                                  type="button"
                                  onClick={() => setMatchWonDraft((p) => ({ ...p, winner: opt.key }))}
                                  className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-center transition-all border ${
                                    matchWonDraft.winner === opt.key
                                      ? "bg-gold/[0.16] border-gold/50"
                                      : "bg-white/[0.02] border-gold/10 hover:border-gold/25"
                                  }`}
                                >
                                  <span
                                    className={`text-[11px] font-bold font-cinzel truncate max-w-full ${
                                      matchWonDraft.winner === opt.key ? "text-gold" : "text-gray-100"
                                    }`}
                                  >
                                    {opt.label}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {matchWonDraft.winner === "custom" && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[9px] font-bold uppercase tracking-widest font-cinzel text-gray-400">
                                Team Name
                              </span>
                              <input
                                value={matchWonDraft.customName}
                                onChange={(e) =>
                                  setMatchWonDraft((p) => ({ ...p, customName: e.target.value }))
                                }
                                placeholder="Winning team name"
                                className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-gold/10 text-gray-100 placeholder:text-gray-600"
                              />
                            </div>
                          )}

                          <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-widest font-cinzel text-gray-400">
                              Margin / Result Text
                            </span>
                            <input
                              value={matchWonDraft.margin}
                              onChange={(e) => setMatchWonDraft((p) => ({ ...p, margin: e.target.value }))}
                              placeholder="e.g. won by 4 wickets"
                              className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-gold/10 text-gray-100 placeholder:text-gray-600"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-widest font-cinzel text-gray-400">
                              Method
                            </span>
                            <select
                              value={matchWonDraft.method}
                              onChange={(e) =>
                                setMatchWonDraft((p) => ({
                                  ...p,
                                  method: e.target.value as "batting" | "bowling" | "tie" | "runs" | "wickets",
                                }))
                              }
                              className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-gold/10 text-gray-100"
                            >
                              <option value="batting">Chasing side won (by wickets)</option>
                              <option value="bowling">Defending side won (by runs)</option>
                              <option value="tie">Tie</option>
                            </select>
                          </div>

                          <p className="text-[10px] text-gray-500">
                            {liveState.matchResult
                              ? "Pre-filled from the last computed result — the graphic already fired automatically. Edit and re-fire if it needs a correction."
                              : "No result on record yet — fill this in by hand to fire early."}
                          </p>

                          <button
                            onClick={fireMatchWonMomentFromForm}
                            className="w-full py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-cinzel bg-gold text-black hover:bg-gold/90 transition-colors"
                          >
                            Fire Match Won
                          </button>
                        </div>
                      )}

                      <p className="text-[10px] pt-1 text-gray-500">
                        Milestone and wicket graphics auto-hide after a few seconds — no need
                        to turn them off. Maiden pulls the bowler currently set in Live
                        State. Match Won fires automatically the instant the match is
                        detected complete — this form is here if you need to review or
                        re-fire it with corrected wording.
                      </p>
                    </>
                  )}
                </div>
              </Section>

              <WeatherPanel ref={weatherPanelRef} matchId={matchId} defaultVenue={matchSetup.venue} onFetched={pushFetchedWeather} autoFetchKey={setupPushCount} />

            <div className="hidden md:block">
              <Section title="Event Log">
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {log.length === 0 ? (
                    <p className="text-[11px] text-gray-500">Nothing fired yet.</p>
                  ) : (
                    log.map((l, i) => (
                      <div key={i} className="text-[11px] font-cinzel text-gray-400">
                        {l}
                      </div>
                    ))
                  )}
                </div>
              </Section>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}