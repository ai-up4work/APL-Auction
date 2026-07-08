"use client";

import React, { useEffect, useRef, useState } from "react";
import { connectOverlayBus, type OverlayEvent, type MatchSetup, type LiveState, type SyncSnapshot, type WeatherData } from "@/lib/overlayBus";
import MatchSetupPanel from "@/components/overlays/admin/MatchSetupPanel";
import LiveStatePanel from "@/components/overlays/admin/LiveStatePanel";
import ProgramMonitor from "@/components/overlays/admin/ProgramMonitor";
import OnAirChannels, { type OnAirChannelsHandle } from "@/components/overlays/admin/OnAirChannels";
import { Section, StatusPill, ActionButton } from "@/components/overlays/admin/ui";
import { ChevronDown } from "lucide-react";

import WeatherPanel, { type WeatherPanelHandle } from "@/components/overlays/admin/WeatherPanel";
import { GeocodeMatch } from "@/lib/fetchVenueWeather";


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
  kickoffTime: "", // NEW
  teamB: emptyTeam(),
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
};

// ── Weather (last pushed) ───────────────────────────────────────────────
// NEW — tracked in state (+ ref, for the same reason matchSetup/liveState
// have refs: sendFullSnapshot is called from callbacks that shouldn't be
// stale-closed over the state value) so a full-sync snapshot can carry the
// actual last-fetched conditions instead of only a visibility boolean.
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

// shared shape for the auto-completion callback coming out of the
// scoring hook (via LiveStatePanel), used to fire the "match won" moment.
interface MatchCompletePayload {
  winningTeamName: string;
  margin: string;
  method: "batting" | "bowling" | "tie";
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
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all"
      style={{
        background: selected ? "rgba(201,151,31,0.12)" : "var(--color-surface-container-low)",
        border: `1px solid ${selected ? "rgba(201,151,31,0.45)" : "var(--color-border-overlay)"}`,
      }}
    >
      <span
        className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--color-surface-container-high)" }}
      >
        {batter.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={batter.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span
            className="text-[10px] font-bold"
            style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}
          >
            {(batter.name || label).slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      <span className="flex flex-col min-w-0">
        <span
          className="text-[11px] font-bold truncate"
          style={{ fontFamily: "var(--font-label-mono)", color: selected ? "var(--color-theme-orange)" : "var(--color-on-surface)" }}
        >
          {batter.name || label}
        </span>
        <span className="text-[9px] uppercase tracking-wide" style={{ color: "var(--color-outline)" }}>{label}</span>
      </span>
    </button>
  );
}



export default function OverlayAdminPage({ params }: { params: Promise<{ auctionId: string }> }) {
  // const { auctionId } = use(params);
  // NOTE: hardcoded for now — restore the line above (and the params prop)
  // before running multiple concurrent auctions/matches.
  const auctionId = "2c5915d0-6b31-47cb-9597-0bd721afe2a9";

  const busRef = useRef<ReturnType<typeof connectOverlayBus> | null>(null);
  const onAirRef = useRef<OnAirChannelsHandle>(null);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const weatherPanelRef = useRef<WeatherPanelHandle>(null);


  // ── Match Setup state (session) ─────────────────────────────────────
  const [matchSetup, setMatchSetup] = useState<MatchSetup>(emptyMatchSetup);
  const [setupPushed, setSetupPushed] = useState(false);
  const [matchSetupCompleted, setMatchSetupCompleted] = useState(false);
  const [setupHydrated, setSetupHydrated] = useState(false);

  // ── Live State (incremental) ────────────────────────────────────────
  const [liveState, setLiveState] = useState<LiveState>(emptyLiveState);
  const [liveDirty, setLiveDirty] = useState(false);
  const [livePushed, setLivePushed] = useState(false);
  const [liveHydrated, setLiveHydrated] = useState(false);

  // ── Weather (last pushed, so full-sync snapshots can include it) ────
  const [weatherData, setWeatherData] = useState<WeatherData>(defaultWeatherData);

  // ── Moments (event) ─────────────────────────────────────────────────
  const [wicketDraft, setWicketDraft] = useState<WicketDraft>(emptyWicketDraft);
  const [showWicketForm, setShowWicketForm] = useState(false);
  const [milestoneBatter, setMilestoneBatter] = useState<"striker" | "nonStriker">("striker");
  const [showMoments, setShowMoments] = useState(false);

  const [setupPushCount, setSetupPushCount] = useState(0);


  // NEW — manual "Match Won" draft. Match Won used to only be fireable
  // once liveState.matchResult existed (i.e. after auto-detection or
  // "End Match"), which meant nothing fired if that hadn't happened yet.
  // This lets you pick the winner / margin / method by hand and fire
  // regardless of whether a result has been computed.
  const [showMatchWonForm, setShowMatchWonForm] = useState(false);
  const [matchWonDraft, setMatchWonDraft] = useState<{
    winner: "teamA" | "teamB" | "custom";
    customName: string;
    margin: string;
    method: "batting" | "bowling" | "tie";
  }>({ winner: "teamA", customName: "", margin: "", method: "batting" });

  const overlayUrl = typeof window !== "undefined" ? `${window.location.origin}/overlay/${auctionId}` : "";

  const matchSetupRef = useRef(matchSetup);
  const matchSetupCompletedRef = useRef(matchSetupCompleted);
  const liveStateRef = useRef(liveState);
  const weatherRef = useRef(weatherData); // NEW

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
      weather: weatherRef.current, // NEW — carries last-fetched conditions through reconnects
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

  // ── Match Setup + Live State + Weather persistence ──────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawSetup = window.localStorage.getItem(`overlay:${auctionId}:matchSetup`);
      if (rawSetup) setMatchSetup(JSON.parse(rawSetup));
    } catch {
      // ignore malformed cache
    }
    try {
      const rawLive = window.localStorage.getItem(`overlay:${auctionId}:liveState`);
      if (rawLive) setLiveState(JSON.parse(rawLive));
    } catch {
      // ignore malformed cache
    }
    try {
      // matchSetupCompleted is persisted alongside matchSetup/liveState so a
      // refresh mid-match doesn't hide the whole Scorer panel.
      const rawCompleted = window.localStorage.getItem(`overlay:${auctionId}:matchSetupCompleted`);
      if (rawCompleted) setMatchSetupCompleted(JSON.parse(rawCompleted));
    } catch {
      // ignore malformed cache
    }
    try {
      // NEW — same treatment for weather: without this, an admin-page
      // refresh loses the last-fetched conditions just like the overlay
      // page did before the snapshot fix below.
      const rawWeather = window.localStorage.getItem(`overlay:${auctionId}:weather`);
      if (rawWeather) setWeatherData(JSON.parse(rawWeather));
    } catch {
      // ignore malformed cache
    }
    setSetupHydrated(true);
    setLiveHydrated(true);
  }, [auctionId]);

  useEffect(() => {
    if (!setupHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(`overlay:${auctionId}:matchSetup`, JSON.stringify(matchSetup));
  }, [matchSetup, auctionId, setupHydrated]);

  useEffect(() => {
    if (!setupHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(`overlay:${auctionId}:matchSetupCompleted`, JSON.stringify(matchSetupCompleted));
  }, [matchSetupCompleted, auctionId, setupHydrated]);

  useEffect(() => {
    if (!liveHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(`overlay:${auctionId}:liveState`, JSON.stringify(liveState));
  }, [liveState, auctionId, liveHydrated]);

  useEffect(() => {
    // NEW — persist weather the same way matchSetup does, gated on the
    // same hydration flag so we don't clobber the cached value with the
    // default before it's had a chance to load.
    if (!setupHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(`overlay:${auctionId}:weather`, JSON.stringify(weatherData));
  }, [weatherData, auctionId, setupHydrated]);

  function fireLoose(event: Record<string, unknown>, label: string) {
    fire(event as unknown as OverlayEvent, label);
  }

  function pushFetchedWeather(wx: { venue: string; temp: number; unit: "C"; condition: string }) {
    // CHANGED — build the full WeatherData payload once, store it in state
    // (so it becomes part of what sendFullSnapshot() sends on reconnect),
    // and broadcast the same object. Previously the fetched data was only
    // ever broadcast as a one-off event and never retained anywhere the
    // sync snapshot could see it, so a reconnecting overlay page fell back
    // to DEFAULT_WEATHER even though the visibility flag was preserved.
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

  // ── Match Setup helpers ──────────────────────────────────────────────
  function pushMatchSetup() {
    fireLoose({ type: "matchSetup", data: matchSetup }, "Match Setup pushed to overlay");
    setSetupPushed(true);
    setMatchSetupCompleted(true);
    setSetupPushCount((n) => n + 1); // NEW — triggers WeatherPanel's auto-fetch
    setTimeout(() => setSetupPushed(false), 1500);
  }

  // ── Live State helpers ───────────────────────────────────────────────
  function pushLiveState() {
    fireLoose({ type: "liveState", data: liveState }, "Live State pushed to overlay");
    setLiveDirty(false);
    setLivePushed(true);
    setTimeout(() => setLivePushed(false), 1500);
  }

  // ── Moments helpers ──────────────────────────────────────────────────
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

  // NEW — manual "Maiden" button in the Moments panel. Fires using
  // whichever bowler is currently set in Live State, rather than only
  // ever firing automatically after the 6th ball of a maiden over.
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

  // look up a team's brand color/logo by name, so the "match won" overlay
  // can theme itself to whichever side actually won.
  function teamVisualsByName(name: string): { color?: string; logoUrl?: string } {
    if (matchSetup.teamA.name === name) return { color: matchSetup.teamA.color, logoUrl: matchSetup.teamA.logoUrl };
    if (matchSetup.teamB.name === name) return { color: matchSetup.teamB.color, logoUrl: matchSetup.teamB.logoUrl };
    return {};
  }

  // fires the celebratory "match won" graphic. Called automatically by
  // the auto-completion logic in the scoring hook (via LiveStatePanel's
  // onMatchComplete), and also manually — see fireMatchWonMomentFromPanel
  // below and the manual End Match button.
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

  // NEW — opens the manual Match Won form. If a result already exists
  // (match ended normally) the form is pre-filled from it so you can just
  // hit Fire; if not, it starts blank so you can pick the winner, type a
  // margin, and fire without waiting for auto-detection or "End Match".
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

  // NEW — fires Match Won from whatever is currently in the manual draft.
  // Works whether or not liveState.matchResult has been computed yet, so
  // this is the button to use if the auto-detector hasn't fired (e.g. you
  // want to fire it early, or the match ended in an unusual way it didn't
  // catch).
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

  function fireMilestoneMomentFromPanel(moment: "fifty" | "hundred") {
    fireMilestoneMoment(moment);
  }

  // restartMatch also clears the previous matchResult so a stale
  // "Team X won by 12 runs" banner can't linger into a fresh match.
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
    }));
    setLiveDirty(true);
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
    <div className="min-h-screen w-full" style={{ background: "var(--color-background)", color: "var(--color-on-background)" }}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at 50% -20%, rgba(200,205,216,0.12) 0%, transparent 70%),
            radial-gradient(circle at 0% 100%, rgba(201,151,31,0.05) 0%, transparent 50%)
          `,
          zIndex: 0,
        }}
      />

      <div className="relative z-10 max-w-[1600px] mx-auto px-6 lg:px-10 py-8">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center gap-5 mb-10 pb-8" style={{ borderBottom: "1px solid var(--color-border-overlay)" }}>
          <span
            className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.3em]"
            style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}
          >
            <span
              className="tally"
              style={{
                background: connected
                  ? "radial-gradient(circle at 35% 30%, #7ee8a8, var(--color-success-green, #4caf50) 60%)"
                  : "radial-gradient(circle at 35% 30%, #ff9d94, var(--color-error, #d9534f) 65%)",
                boxShadow: connected
                  ? "0 0 6px 1px var(--color-success-green, #4caf50)"
                  : "0 0 6px 1px rgba(217,83,79,0.55)",
                animation: connected ? undefined : "connPulse 1.4s ease-in-out infinite",
              }}
            />
            On Air Control
            <span
              className="tally"
              style={{
                background: connected
                  ? "radial-gradient(circle at 35% 30%, #7ee8a8, var(--color-success-green, #4caf50) 60%)"
                  : "radial-gradient(circle at 35% 30%, #ff9d94, var(--color-error, #d9534f) 65%)",
                boxShadow: connected
                  ? "0 0 6px 1px var(--color-success-green, #4caf50)"
                  : "0 0 6px 1px rgba(217,83,79,0.55)",
                animation: connected ? undefined : "connPulse 1.4s ease-in-out infinite",
              }}
            />
          </span>

          <h2
            style={{
              fontFamily: "var(--font-headline-lg)",
              fontSize: "38px",
              lineHeight: "44px",
              fontWeight: 700,
              letterSpacing: "0.01em",
              color: "var(--color-on-surface)",
            }}
          >
            Overlay Control Room
          </h2>

          <div
            className="w-10 h-[3px] rounded-full"
            style={{ background: "linear-gradient(90deg, transparent, var(--color-theme-orange), transparent)" }}
          /> 
        </div>

        {/* ── Desk — scoring flow left, monitor + fast-fire right ────── */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 min-w-0 flex flex-col gap-6">
            <MatchSetupPanel
              auctionId={auctionId}
              matchSetup={matchSetup}
              setMatchSetup={setMatchSetup}
              onPush={pushMatchSetup}
              pushLabel={setupPushed ? "Pushed ✓" : "Push Match Setup"}
              completed={matchSetupCompleted}
              onVenueSelect={(match: GeocodeMatch, displayName: string | undefined) => weatherPanelRef.current?.scheduleFetch(match, displayName)}
            />

            {matchSetupCompleted ? (
              <LiveStatePanel
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
                onMatchComplete={fireMatchWonMoment}
                onRestartMatch={restartMatch}
              />
            ) : (
              <div
                className="rounded-xl p-6 text-center"
                style={{
                  background: "var(--color-surface-glass)",
                  backdropFilter: "blur(24px)",
                  border: "1px dashed var(--color-border-overlay)",
                }}
              >
                <span
                  className="material-symbols-outlined block mx-auto mb-2"
                  style={{ fontSize: 22, color: "var(--color-outline)" }}
                >
                  scoreboard
                </span>
                <p
                  className="text-[11px] uppercase tracking-widest"
                  style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}
                >
                  Push Match Setup above to unlock live scoring
                </p>
              </div>
            )}
          </div>

          <aside className="w-full lg:w-[380px] flex-shrink-0 flex flex-col gap-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1 log-scroll">
            <ProgramMonitor overlayUrl={overlayUrl} />

              <Section
                title="Moments"
                description="Fire the graphic the instant it happens on the ball."
              >
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => setShowMoments((v) => !v)}
                    className="flex items-center justify-between w-full rounded-lg px-3 py-2 transition-colors"
                    style={{
                      background: "var(--color-surface-container-low)",
                      border: "1px solid var(--color-border-overlay)",
                    }}
                  >
                    <span
                      className="text-[11px] font-black uppercase tracking-widest"
                      style={{ fontFamily: "var(--font-label-mono)" }}
                    >
                      Show Moments Controls
                    </span>

                    <ChevronDown
                      size={18}
                      className={`transition-transform duration-200 ${
                        showMoments ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {showMoments && (
                    <>
                      <p
                        className="text-[10px] leading-snug"
                        style={{
                          color: "var(--color-outline)",
                          fontFamily: "var(--font-body-md)",
                        }}
                      >
                        Four, Six, Fifty and Hundred now also fire automatically from the
                        ball pad in the Scorer panel — these buttons are still here for
                        manual/backup firing. Maiden overs fire automatically too, and the
                        Maiden button re-fires using whoever's set as bowler right now. Match
                        Won can fire automatically when a match completes, or opens a form
                        below for firing it manually at any time.
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
                        <span
                          className="text-[9px] font-bold uppercase tracking-widest"
                          style={{
                            fontFamily: "var(--font-label-mono)",
                            color: "var(--color-outline)",
                          }}
                        >
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
                        <div
                          className="flex flex-col gap-3 p-4 rounded-lg mt-1"
                          style={{
                            background: "var(--color-error-container)",
                            border: "1px solid rgba(255,180,171,0.25)",
                          }}
                        >
                          <span
                            className="text-[10px] font-black uppercase tracking-widest"
                            style={{
                              fontFamily: "var(--font-label-mono)",
                              color: "var(--color-error)",
                            }}
                          >
                            Wicket Detail
                          </span>

                          <div className="flex flex-col gap-1.5">
                            <span
                              className="text-[9px] font-bold uppercase tracking-widest"
                              style={{
                                fontFamily: "var(--font-label-mono)",
                                color: "var(--color-on-surface-variant)",
                              }}
                            >
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
                            <span
                              className="text-[9px] font-bold uppercase tracking-widest"
                              style={{
                                fontFamily: "var(--font-label-mono)",
                                color: "var(--color-on-surface-variant)",
                              }}
                            >
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
                              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                              style={{
                                background: "var(--color-surface-container-low)",
                                border: "1px solid var(--color-border-overlay)",
                                color: "var(--color-on-surface)",
                              }}
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
                            <span
                              className="text-[9px] font-bold uppercase tracking-widest"
                              style={{
                                fontFamily: "var(--font-label-mono)",
                                color: "var(--color-on-surface-variant)",
                              }}
                            >
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
                              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                              style={{
                                background: "var(--color-surface-container-low)",
                                border: "1px solid var(--color-border-overlay)",
                                color: "var(--color-on-surface)",
                              }}
                            />
                          </div>

                          <p
                            className="text-[10px]"
                            style={{ color: "var(--color-outline)" }}
                          >
                            Bowler pulled automatically from Live State:{" "}
                            {liveState.bowler.name || "—"}
                          </p>

                          <button
                            onClick={fireWicketMoment}
                            className="w-full py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wide"
                            style={{
                              fontFamily: "var(--font-label-mono)",
                              background: "var(--color-error)",
                              color: "var(--color-on-primary)",
                            }}
                          >
                            Fire Wicket
                          </button>
                        </div>
                      )}

                      {showMatchWonForm && (
                        <div
                          className="flex flex-col gap-3 p-4 rounded-lg mt-1"
                          style={{
                            background: "rgba(201,151,31,0.08)",
                            border: "1px solid rgba(201,151,31,0.3)",
                          }}
                        >
                          <span
                            className="text-[10px] font-black uppercase tracking-widest"
                            style={{
                              fontFamily: "var(--font-label-mono)",
                              color: "var(--color-theme-orange)",
                            }}
                          >
                            Match Won Detail
                          </span>

                          <div className="flex flex-col gap-1.5">
                            <span
                              className="text-[9px] font-bold uppercase tracking-widest"
                              style={{
                                fontFamily: "var(--font-label-mono)",
                                color: "var(--color-on-surface-variant)",
                              }}
                            >
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
                                  className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-center transition-all"
                                  style={{
                                    background:
                                      matchWonDraft.winner === opt.key
                                        ? "rgba(201,151,31,0.16)"
                                        : "var(--color-surface-container-low)",
                                    border: `1px solid ${
                                      matchWonDraft.winner === opt.key
                                        ? "rgba(201,151,31,0.5)"
                                        : "var(--color-border-overlay)"
                                    }`,
                                  }}
                                >
                                  <span
                                    className="text-[11px] font-bold truncate max-w-full"
                                    style={{
                                      fontFamily: "var(--font-label-mono)",
                                      color:
                                        matchWonDraft.winner === opt.key
                                          ? "var(--color-theme-orange)"
                                          : "var(--color-on-surface)",
                                    }}
                                  >
                                    {opt.label}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {matchWonDraft.winner === "custom" && (
                            <div className="flex flex-col gap-1.5">
                              <span
                                className="text-[9px] font-bold uppercase tracking-widest"
                                style={{
                                  fontFamily: "var(--font-label-mono)",
                                  color: "var(--color-on-surface-variant)",
                                }}
                              >
                                Team Name
                              </span>
                              <input
                                value={matchWonDraft.customName}
                                onChange={(e) =>
                                  setMatchWonDraft((p) => ({ ...p, customName: e.target.value }))
                                }
                                placeholder="Winning team name"
                                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                                style={{
                                  background: "var(--color-surface-container-low)",
                                  border: "1px solid var(--color-border-overlay)",
                                  color: "var(--color-on-surface)",
                                }}
                              />
                            </div>
                          )}

                          <div className="flex flex-col gap-1.5">
                            <span
                              className="text-[9px] font-bold uppercase tracking-widest"
                              style={{
                                fontFamily: "var(--font-label-mono)",
                                color: "var(--color-on-surface-variant)",
                              }}
                            >
                              Margin / Result Text
                            </span>
                            <input
                              value={matchWonDraft.margin}
                              onChange={(e) => setMatchWonDraft((p) => ({ ...p, margin: e.target.value }))}
                              placeholder="e.g. won by 4 wickets"
                              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                              style={{
                                background: "var(--color-surface-container-low)",
                                border: "1px solid var(--color-border-overlay)",
                                color: "var(--color-on-surface)",
                              }}
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <span
                              className="text-[9px] font-bold uppercase tracking-widest"
                              style={{
                                fontFamily: "var(--font-label-mono)",
                                color: "var(--color-on-surface-variant)",
                              }}
                            >
                              Method
                            </span>
                            <select
                              value={matchWonDraft.method}
                              onChange={(e) =>
                                setMatchWonDraft((p) => ({
                                  ...p,
                                  method: e.target.value as "batting" | "bowling" | "tie",
                                }))
                              }
                              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                              style={{
                                background: "var(--color-surface-container-low)",
                                border: "1px solid var(--color-border-overlay)",
                                color: "var(--color-on-surface)",
                              }}
                            >
                              <option value="batting">Chasing side won (by wickets)</option>
                              <option value="bowling">Defending side won (by runs)</option>
                              <option value="tie">Tie</option>
                            </select>
                          </div>

                          <p className="text-[10px]" style={{ color: "var(--color-outline)" }}>
                            {liveState.matchResult
                              ? "Pre-filled from the last computed result — edit anything before firing."
                              : "No result on record yet — fill this in by hand to fire early."}
                          </p>

                          <button
                            onClick={fireMatchWonMomentFromForm}
                            className="w-full py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wide"
                            style={{
                              fontFamily: "var(--font-label-mono)",
                              background: "var(--color-theme-orange)",
                              color: "var(--color-on-primary)",
                            }}
                          >
                            Fire Match Won
                          </button>
                        </div>
                      )}

                      <p
                        className="text-[10px] pt-1"
                        style={{
                          color: "var(--color-outline)",
                          fontFamily: "var(--font-body-md)",
                        }}
                      >
                        Milestone and wicket graphics auto-hide after a few seconds — no need
                        to turn them off. Maiden pulls the bowler currently set in Live
                        State. Match Won opens a small form — pick the winning team, type the
                        margin, and fire whenever you like, whether or not a result has been
                        computed automatically yet.
                      </p>
                    </>
                  )}
                </div>
              </Section>

              <WeatherPanel
                defaultVenue={matchSetup.venue}
                onFetched={(wx) => {  }}
                autoFetchKey={setupPushCount}
              />
              <OnAirChannels ref={onAirRef} fire={fire} />

            <Section title="Event Log">
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                {log.length === 0 ? (
                  <p className="text-[11px]" style={{ color: "var(--color-outline)", fontFamily: "var(--font-body-md)" }}>
                    Nothing fired yet.
                  </p>
                ) : (
                  log.map((l, i) => (
                    <div key={i} className="text-[11px]" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
                      {l}
                    </div>
                  ))
                )}
              </div>
            </Section>
          </aside>
        </div>
      </div>
    </div>
  );
}