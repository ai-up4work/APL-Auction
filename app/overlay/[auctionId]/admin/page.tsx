"use client";

import React, { use, useEffect, useRef, useState } from "react";
import { connectOverlayBus, type OverlayEvent, type MatchSetup, type LiveState } from "@/lib/overlayBus";
import MatchSetupPanel from "@/components/overlays/admin/MatchSetupPanel";
import LiveStatePanel from "@/components/overlays/admin/LiveStatePanel";
import ProgramMonitor from "@/components/overlays/admin/ProgramMonitor";

interface OverlayToggle {
  key: string;
  label: string;
  on: boolean;
  set: (v: boolean) => void;
  event: OverlayEvent["type"];
  exclusiveWith?: string;
}

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

// ── Moments (EVENT) ─────────────────────────────────────────────────────
interface WicketDraft {
  batsmanOut: "striker" | "nonStriker";
  dismissalType: "bowled" | "caught" | "lbw" | "runOut" | "stumped" | "hitWicket";
  fielder: string;
}

const emptyWicketDraft: WicketDraft = { batsmanOut: "striker", dismissalType: "bowled", fielder: "" };

// ── Batter picker button — used in place of native <select> for choosing
// which batter (striker / non-striker) an action applies to. Shows the
// full player photo so admins can confirm at a glance mid-match. ────────
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
      className={`strip-btn ${selected ? "is-live" : ""}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: "8px 12px" }}
    >
      <span className="squad-avatar" style={{ width: 40, height: 40 }}>
        {batter.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={batter.imageUrl} alt="" />
        ) : (
          <span className="squad-avatar-fallback" style={{ fontSize: 12 }}>
            {(batter.name || label).slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      <span className="flex flex-col items-start">
        <span className="strip-label">{batter.name || label}</span>
        <span className="strip-state">{label}</span>
      </span>
    </button>
  );
}

export default function OverlayAdminPage({ params }: { params: Promise<{ auctionId: string }> }) {
  // const { auctionId } = use(params);
  const auctionId = "2c5915d0-6b31-47cb-9597-0bd721afe2a9"

  const busRef = useRef<ReturnType<typeof connectOverlayBus> | null>(null);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const [weatherOn, setWeatherOn] = useState(false);
  const [matchBoundariesOn, setMatchBoundariesOn] = useState(false);
  const [tournamentBoundariesOn, setTournamentBoundariesOn] = useState(false);
  const [liveScoreBarOn, setLiveScoreBarOn] = useState(false);
  const [pointsTableOn, setPointsTableOn] = useState(false);
  const [matchScorecardOn, setMatchScorecardOn] = useState(false);
  const [matchIntroOn, setMatchIntroOn] = useState(false);
  const [tournamentLogoOn, setTournamentLogoOn] = useState(false);
  const [testBgOn, setTestBgOn] = useState(false);

  // ── Match Setup state (session) ─────────────────────────────────────
  const [matchSetup, setMatchSetup] = useState<MatchSetup>(emptyMatchSetup);
  const [setupPushed, setSetupPushed] = useState(false);
  const [matchSetupCompleted, setMatchSetupCompleted] = useState(false); // true once pushed at least once
  const [setupHydrated, setSetupHydrated] = useState(false);

  // ── Live State (incremental) ────────────────────────────────────────
  const [liveState, setLiveState] = useState<LiveState>(emptyLiveState);
  const [liveDirty, setLiveDirty] = useState(false);
  const [livePushed, setLivePushed] = useState(false);
  const [liveHydrated, setLiveHydrated] = useState(false);

  // ── Moments (event) ─────────────────────────────────────────────────
  const [wicketDraft, setWicketDraft] = useState<WicketDraft>(emptyWicketDraft);
  const [showWicketForm, setShowWicketForm] = useState(false);
  const [milestoneBatter, setMilestoneBatter] = useState<"striker" | "nonStriker">("striker");

  const overlayUrl = typeof window !== "undefined" ? `${window.location.origin}/overlay/${auctionId}` : "";

  useEffect(() => {
    const bus = connectOverlayBus(auctionId);
    busRef.current = bus;
    bus.onReady(() => setConnected(true));
    return () => {
      bus.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  // ── Match Setup + Live State persistence ────────────────────────────
  // Keyed by auctionId so a page refresh mid-match doesn't lose anything.
  // TODO: once there's a backend row per auction, swap these for a real
  // save/load call instead of localStorage.
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
    setSetupHydrated(true);
    setLiveHydrated(true);
  }, [auctionId]);

  useEffect(() => {
    if (!setupHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(`overlay:${auctionId}:matchSetup`, JSON.stringify(matchSetup));
  }, [matchSetup, auctionId, setupHydrated]);

  useEffect(() => {
    if (!liveHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(`overlay:${auctionId}:liveState`, JSON.stringify(liveState));
  }, [liveState, auctionId, liveHydrated]);

  function fire(event: OverlayEvent, label: string) {
    busRef.current?.send(event);
    setLog((prev) => [`${new Date().toLocaleTimeString("en-GB", { hour12: false })}  ${label}`, ...prev].slice(0, 12));
  }

  // Match Setup / Live State / wicket detail aren't in the OverlayEvent
  // union yet — lib/overlayBus.ts needs "matchSetup" | "liveState" | "wicket"
  // added to it. Cast through `any` here so the admin panel can be built
  // and wired up now; tighten this once that type is extended.
  function fireLoose(event: Record<string, unknown>, label: string) {
    fire(event as unknown as OverlayEvent, label);
  }

  const channels: OverlayToggle[] = [
    { key: "weather", label: "Weather", on: weatherOn, set: setWeatherOn, event: "weather" },
    { key: "matchBoundaries", label: "Match Boundaries", on: matchBoundariesOn, set: setMatchBoundariesOn, event: "matchBoundaries" },
    { key: "tournamentBoundaries", label: "Tournament Boundaries", on: tournamentBoundariesOn, set: setTournamentBoundariesOn, event: "tournamentBoundaries" },
    { key: "liveScoreBar", label: "Live Score Bar", on: liveScoreBarOn, set: setLiveScoreBarOn, event: "liveScoreBar" },
    { key: "pointsTable", label: "Points Table", on: pointsTableOn, set: setPointsTableOn, event: "pointsTable" },
    { key: "matchScorecard", label: "Match Scorecard", on: matchScorecardOn, set: setMatchScorecardOn, event: "matchScorecard" },
    { key: "matchIntro", label: "Match Intro", on: matchIntroOn, set: setMatchIntroOn, event: "matchIntro" },
    { key: "tournamentLogo", label: "Tournament Logo", on: tournamentLogoOn, set: setTournamentLogoOn, event: "tournamentLogo" },
  ];

  function toggleChannel(ch: OverlayToggle) {
    const next = !ch.on;
    ch.set(next);
    if (ch.key === "matchBoundaries" && next) setTournamentBoundariesOn(false);
    if (ch.key === "tournamentBoundaries" && next) setMatchBoundariesOn(false);
    fire({ type: ch.event, show: next } as OverlayEvent, `${ch.label} ${next ? "on" : "off"}`);
  }

  // ── Match Setup helpers ──────────────────────────────────────────────
  function pushMatchSetup() {
    fireLoose({ type: "matchSetup", data: matchSetup }, "Match Setup pushed to overlay");
    setSetupPushed(true);
    setMatchSetupCompleted(true);
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
  function fireBoundaryMoment(moment: "four" | "six") {
    const batter = liveState.striker;
    fireLoose(
      { type: "moment", moment, player: batter.name || "Striker", score: `${batter.runs}(${batter.balls})` },
      `Moment: ${moment.toUpperCase()} — ${batter.name || "Striker"} ${batter.runs}(${batter.balls})`
    );
  }

  function fireMilestoneMoment(moment: "fifty" | "hundred") {
    const batter = liveState[milestoneBatter];
    const label = batter.name || (milestoneBatter === "striker" ? "Striker" : "Non-striker");
    fireLoose(
      { type: "moment", moment, player: label, score: `${batter.runs}(${batter.balls})` },
      `Moment: ${moment.toUpperCase()} — ${label} ${batter.runs}(${batter.balls})`
    );
  }

  function fireWicketMoment() {
    const batter = liveState[wicketDraft.batsmanOut];
    const batterLabel = batter.name || (wicketDraft.batsmanOut === "striker" ? "Striker" : "Non-striker");
    fireLoose(
      {
        type: "moment",
        moment: "wicket",
        batsmanOut: wicketDraft.batsmanOut,
        player: batterLabel,
        score: `${batter.runs}(${batter.balls})`,
        dismissalType: wicketDraft.dismissalType,
        bowler: liveState.bowler.name,
        fielder: wicketDraft.fielder,
      },
      `Moment: WICKET — ${batterLabel} ${wicketDraft.dismissalType}${liveState.bowler.name ? ` b ${liveState.bowler.name}` : ""}${
        wicketDraft.fielder ? ` c ${wicketDraft.fielder}` : ""
      }`
    );
    setWicketDraft(emptyWicketDraft);
    setShowWicketForm(false);
  }

  return (
    <div
      className="console-frame min-h-screen w-full flex flex-col"
      style={{ background: "var(--color-background, #0d1117)", color: "var(--color-on-background, #fff)", fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Inter:wght@400;500;700&family=Geist+Mono:wght@400;500;700&display=swap');

        .font-archivo    { font-family: 'Archivo Narrow', sans-serif; }
        .font-mono-geist { font-family: 'Geist Mono', monospace; }

        .console-frame {
          background-image:
            radial-gradient(ellipse 120% 60% at 50% -10%, rgba(201,151,31,0.06), transparent 60%),
            var(--color-background, #0d1117);
        }

        .rack-panel {
          position: relative;
          background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015) 40%, rgba(255,255,255,0.02));
          border: 1px solid var(--color-border-overlay, rgba(255,255,255,0.1));
          border-radius: 14px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.4);
        }
        .rack-panel::before, .rack-panel::after,
        .rack-panel .rivet-l, .rack-panel .rivet-r {
          content: "";
          position: absolute;
          width: 5px; height: 5px;
          border-radius: 50%;
          top: 9px;
          background: radial-gradient(circle at 35% 30%, #9a9fae, #3a3f4d 70%);
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.4), 0 1px 1px rgba(255,255,255,0.05);
        }
        .rack-panel::before { left: 9px; }
        .rack-panel::after  { right: 9px; }

        .eyebrow {
          font-family: 'Geist Mono', monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-outline, #8c92a3);
        }

        .tally {
          width: 8px; height: 8px; border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #4a4f5e, #23262f 70%);
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.5);
          transition: background 0.2s ease, box-shadow 0.2s ease;
          flex-shrink: 0;
        }
        .tally.live {
          background: radial-gradient(circle at 35% 30%, #ff9d92, var(--color-status-live, #ffb4ab) 60%);
          box-shadow: 0 0 6px 1px var(--color-status-live, #ffb4ab), inset 0 0 0 1px rgba(0,0,0,0.2);
        }

        .strip-btn {
          position: relative;
          display: flex; flex-direction: column; gap: 8px;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid var(--color-border-overlay, rgba(255,255,255,0.1));
          background: rgba(255,255,255,0.02);
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
          text-align: left;
        }
        .strip-btn:active { transform: scale(0.98); }
        .strip-btn.is-live {
          border-color: rgba(201,151,31,0.45);
          background: linear-gradient(180deg, rgba(201,151,31,0.1), rgba(201,151,31,0.03));
        }
        .strip-label {
          font-family: 'Geist Mono', monospace;
          font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-on-surface, #e3e6ef);
        }
        .strip-state {
          font-family: 'Geist Mono', monospace;
          font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--color-outline, #8c92a3);
        }
        .strip-btn.is-live .strip-state { color: var(--color-status-live, #ffb4ab); }

        .talk-btn {
          font-family: 'Geist Mono', monospace; font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.14em; padding: 12px 14px;
          border-radius: 10px; transition: all 0.15s ease;
          background: rgba(201,151,31,0.1); color: #E8C468;
          border: 1px solid rgba(201,151,31,0.25);
        }
        .talk-btn:active { transform: scale(0.96); }
        .talk-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        .fx-btn {
          font-family: 'Geist Mono', monospace; font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.14em; padding: 12px 14px;
          border-radius: 10px; transition: all 0.15s ease; border: 1px solid rgba(255,255,255,0.08);
        }
        .fx-btn:active { transform: scale(0.97); }
        .fx-toggle-on { background: linear-gradient(135deg,#A87815,#E8C468); color: #1a1304; border: none; }
        .fx-toggle-off { background: rgba(255,255,255,0.05); color: #a0aec0; }

        .monitor-frame {
          position: relative;
          padding: 10px;
          border-radius: 14px;
          background: linear-gradient(155deg, var(--color-surface-container-high, #1f2433), var(--color-surface-container-lowest, #07090d));
          border: 1px solid var(--color-border-overlay, rgba(255,255,255,0.1));
        }
        .monitor-screen {
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          background: #000;
          aspect-ratio: 16 / 9;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .monitor-corner {
          position: absolute;
          width: 18px; height: 18px;
          border-color: rgba(201,151,31,0.55);
          z-index: 2; pointer-events: none;
        }
        .monitor-corner.tl { top: 6px; left: 6px; border-top: 2px solid; border-left: 2px solid; border-top-left-radius: 4px; }
        .monitor-corner.tr { top: 6px; right: 6px; border-top: 2px solid; border-right: 2px solid; border-top-right-radius: 4px; }
        .monitor-corner.bl { bottom: 6px; left: 6px; border-bottom: 2px solid; border-left: 2px solid; border-bottom-left-radius: 4px; }
        .monitor-corner.br { bottom: 6px; right: 6px; border-bottom: 2px solid; border-right: 2px solid; border-bottom-right-radius: 4px; }
        .pgm-plate {
          position: absolute; top: 14px; left: 14px; z-index: 2;
          display: flex; align-items: center; gap: 6px;
          padding: 4px 8px; border-radius: 5px;
          background: rgba(7,9,13,0.75); backdrop-filter: blur(4px);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .log-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--color-theme-orange) var(--color-surface-container-high);
          overflow-y: scroll;
        }
        .log-scroll::-webkit-scrollbar { width: 8px; }
        .log-scroll::-webkit-scrollbar-track { background: var(--color-surface-container-high, #1f2433); border-radius: 8px; }
        .log-scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--color-theme-orange) 55%, transparent); border-radius: 8px; }
        .log-scroll::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--color-theme-orange) 75%, transparent); }

        @keyframes connPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }

        .drawer > summary {
          cursor: pointer;
          list-style: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .drawer > summary::-webkit-details-marker,
        .drawer > summary::marker { display: none; content: ""; }
        .drawer-chevron {
          display: inline-block;
          transition: transform 0.15s ease;
          color: var(--color-outline, #8c92a3);
        }
        .drawer[open] .drawer-chevron { transform: rotate(90deg); }
        .drawer-body { padding-top: 18px; }

        .text-input, .select-input, .textarea-input {
          width: 100%;
          background: rgba(0,0,0,0.25);
          border: 1px solid var(--color-border-overlay, rgba(255,255,255,0.1));
          border-radius: 8px;
          padding: 8px 10px;
          font-family: 'Geist Mono', monospace;
          font-size: 12px;
          color: var(--color-on-surface, #e3e6ef);
        }
        .text-input::placeholder, .textarea-input::placeholder { color: rgba(255,255,255,0.25); }
        .text-input:focus, .select-input:focus, .textarea-input:focus {
          outline: none; border-color: rgba(201,151,31,0.5);
        }
        .textarea-input { resize: vertical; min-height: 64px; line-height: 1.5; }
        .select-input { appearance: none; cursor: pointer; }

        .field-col { display: flex; flex-direction: column; gap: 6px; }
        .field-label {
          font-family: 'Geist Mono', monospace;
          font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--color-outline, #8c92a3);
        }

        .stepper { display: flex; align-items: center; gap: 6px; }
        .stepper-btn {
          width: 26px; height: 26px; border-radius: 6px; flex-shrink: 0;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          color: #e3e6ef; font-size: 14px; line-height: 1;
        }
        .stepper-btn:active { background: rgba(201,151,31,0.2); }
        .stepper-input {
          width: 100%; min-width: 0;
          background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px; padding: 5px 6px; text-align: center;
          font-family: 'Geist Mono', monospace; font-size: 12px; color: #e3e6ef;
        }
        .stepper-input:focus { outline: none; border-color: rgba(201,151,31,0.5); }

        .team-card {
          border-radius: 10px;
          border: 1px solid var(--color-border-overlay, rgba(255,255,255,0.1));
          background: rgba(255,255,255,0.015);
          padding: 14px;
          border-top: 3px solid var(--team-color, #c9971f);
          display: flex; flex-direction: column; gap: 10px;
        }

        .batter-card, .bowler-card {
          border-radius: 10px;
          border: 1px solid var(--color-border-overlay, rgba(255,255,255,0.1));
          background: rgba(255,255,255,0.015);
          padding: 14px;
          display: flex; flex-direction: column; gap: 10px;
        }

        .points-row-grid {
          display: grid;
          grid-template-columns: 1.6fr 0.7fr 0.7fr 0.7fr 0.9fr 0.8fr 32px;
          gap: 6px;
          align-items: center;
        }

        .icon-btn {
          width: 26px; height: 26px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25);
          color: #f87171; font-size: 14px; line-height: 1;
        }
        .icon-btn:active { transform: scale(0.94); }

        .segment-group { display: flex; gap: 6px; }
        .segment-btn {
          flex: 1;
          font-family: 'Geist Mono', monospace; font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.1em;
          padding: 8px 10px; border-radius: 8px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
          color: #a0aec0;
        }
        .segment-btn.is-active {
          background: linear-gradient(135deg,#A87815,#E8C468); color: #1a1304; border: none;
        }

        .dirty-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--color-status-live, #ffb4ab);
          box-shadow: 0 0 5px 1px var(--color-status-live, #ffb4ab);
          display: inline-block;
        }

        .done-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--color-success-green, #4caf50);
          box-shadow: 0 0 5px 1px var(--color-success-green, #4caf50);
          display: inline-block;
        }

        .panel-scroll {
          max-height: 220px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--color-theme-orange) var(--color-surface-container-high);
        }
        .panel-scroll::-webkit-scrollbar { width: 6px; }
        .panel-scroll::-webkit-scrollbar-track { background: var(--color-surface-container-high, #1f2433); border-radius: 8px; }
        .panel-scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--color-theme-orange) 55%, transparent); border-radius: 8px; }

        .squad-list { display: flex; flex-direction: column; gap: 4px; }

        .squad-chip {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 8px;
          border-radius: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .squad-name {
          flex: 1;
          font-family: 'Geist Mono', monospace;
          font-size: 11px;
          color: var(--color-on-surface, #e3e6ef);
        }
        .squad-remove {
          width: 18px; height: 18px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.25);
          color: #f87171; font-size: 12px; line-height: 1; flex-shrink: 0;
        }

        .squad-avatar {
          width: 22px; height: 22px; border-radius: 50%; overflow: hidden;
          flex-shrink: 0; background: rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: center;
        }
        .squad-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .squad-avatar-sm { width: 18px; height: 18px; }
        .squad-avatar-fallback {
          font-family: 'Geist Mono', monospace;
          font-size: 9px; font-weight: 700;
          color: var(--color-outline, #8c92a3);
        }

        .roster-browser { margin-top: 4px; }
        .squad-pick-row {
          display: flex; align-items: center; gap: 8px;
          padding: 5px 8px; border-radius: 6px;
          cursor: pointer;
        }
        .squad-pick-row:hover { background: rgba(255,255,255,0.03); }
        .squad-pick-row.is-checked { background: rgba(201,151,31,0.08); }
        .squad-pick-row input[type="checkbox"] { accent-color: var(--color-theme-orange, #c9971f); }

        .points-scroll { max-height: 260px; overflow-y: auto; }
      `}</style>

      <header className="flex items-center justify-between px-8 h-16 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-theme-orange" style={{ fontSize: 22 }}>stream</span>
          <h1 className="font-archivo text-xl font-bold italic uppercase tracking-tight text-theme-orange">Overlay Control Room</h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="tally"
            style={{
              background: connected
                ? "radial-gradient(circle at 35% 30%, #7ee8a8, var(--color-success-green, #4caf50) 60%)"
                : undefined,
              boxShadow: connected ? "0 0 6px 1px var(--color-success-green, #4caf50)" : undefined,
              animation: connected ? undefined : "connPulse 1.4s ease-in-out infinite",
            }}
          />
          <span className="font-mono-geist text-[10px] uppercase tracking-widest text-white/60">
            {connected ? "Bus connected" : "Connecting…"}
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-8 py-8 flex flex-col gap-6">

        {/* ── Match Setup (session) ────────────────────────────────────── */}
        <MatchSetupPanel
          auctionId={auctionId}
          matchSetup={matchSetup}
          setMatchSetup={setMatchSetup}
          onPush={pushMatchSetup}
          pushLabel={setupPushed ? "Pushed ✓" : "Push Match Setup"}
          completed={matchSetupCompleted}
        />

        {/* ── OBS source + Program monitor ─────────────────────────────── */}
        <ProgramMonitor overlayUrl={overlayUrl} />

        {/* ── Live State (incremental) ─────────────────────────────────── */}
        <LiveStatePanel
          liveState={liveState}
          setLiveState={setLiveState}
          setLiveDirty={setLiveDirty}
          liveDirty={liveDirty}
          onPush={pushLiveState}
          pushLabel={livePushed ? "Pushed ✓" : "Push Live State"}
        />

        {/* ── Preview tools ─────────────────────────────────────────────── */}
        <div className="rack-panel p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="eyebrow mb-1.5" style={{ color: "var(--color-secondary, #c8cdd8)" }}>Preview Tools</div>
            <p className="font-mono-geist text-[9px] text-white/40 uppercase tracking-widest">
              Sample footage behind overlays — layout testing only, off before going live
            </p>
          </div>
          <button
            onClick={() => {
              const next = !testBgOn;
              setTestBgOn(next);
              fire({ type: "testBg", show: next }, `Test background ${next ? "on" : "off"}`);
            }}
            className="strip-btn"
            style={{ minWidth: 140 }}
          >
            <span className="flex items-center gap-2">
              <span className={`tally ${testBgOn ? "live" : ""}`} style={testBgOn ? { background: "radial-gradient(circle at 35% 30%, #93c5fd, #3b82f6 60%)", boxShadow: "0 0 6px 1px #3b82f6" } : undefined} />
              <span className="strip-label">Test Background</span>
            </span>
            <span className="strip-state" style={testBgOn ? { color: "#93c5fd" } : undefined}>{testBgOn ? "Live" : "Off"}</span>
          </button>
        </div>

        {/* ── Channel strips ───────────────────────────────────────────── */}
        <div className="rack-panel p-5 flex flex-col gap-3">
          <div className="eyebrow mb-1">Cricket Match Overlays</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {channels.map((ch) => (
              <button key={ch.key} onClick={() => toggleChannel(ch)} className={`strip-btn ${ch.on ? "is-live" : ""}`}>
                <span className="flex items-center gap-2">
                  <span className={`tally ${ch.on ? "live" : ""}`} />
                  <span className="strip-label">{ch.label}</span>
                </span>
                <span className="strip-state">{ch.on ? "On Air" : "Standby"}</span>
              </button>
            ))}

            <button
              onClick={() => {
                channels.forEach((ch) => ch.set(false));
                fire({ type: "clearAll" }, "Cleared all overlays");
              }}
              className="strip-btn"
              style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)" }}
            >
              <span className="flex items-center gap-2">
                <span className="tally" style={{ background: "radial-gradient(circle at 35% 30%, #ff9d9d, #ef4444 60%)" }} />
                <span className="strip-label" style={{ color: "#f87171" }}>Clear Everything</span>
              </span>
              <span className="strip-state" style={{ color: "#f87171" }}>Reset all</span>
            </button>
          </div>

          <div className="eyebrow mt-3 mb-1">Moments (auto-hide)</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <button onClick={() => fireBoundaryMoment("four")} className="talk-btn">FOUR</button>
            <button onClick={() => fireBoundaryMoment("six")} className="talk-btn">SIX</button>
            <button onClick={() => setShowWicketForm((v) => !v)} className="talk-btn" style={showWicketForm ? { background: "rgba(239,68,68,0.15)", color: "#f87171", borderColor: "rgba(239,68,68,0.3)" } : undefined}>
              WICKET
            </button>
            <button onClick={() => fireMilestoneMoment("fifty")} className="talk-btn">FIFTY</button>
            <button onClick={() => fireMilestoneMoment("hundred")} className="talk-btn">HUNDRED</button>
          </div>

          <div className="flex items-center gap-3 mt-1">
            <span className="font-mono-geist text-[9px] text-white/40 uppercase tracking-widest">Fifty / Hundred for:</span>
            <div className="grid grid-cols-2 gap-3" style={{ maxWidth: 560 }}>
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
            <div className="bowler-card mt-2">
              <div className="eyebrow" style={{ color: "#f87171" }}>Wicket Detail</div>

              <div className="field-col">
                <span className="field-label">Batsman Out</span>
                <div className="grid grid-cols-2 gap-3">
                  <BatterPickerButton
                    batter={liveState.striker}
                    label="Striker"
                    selected={wicketDraft.batsmanOut === "striker"}
                    onClick={() => setWicketDraft((p) => ({ ...p, batsmanOut: "striker" }))}
                  />
                  <BatterPickerButton
                    batter={liveState.nonStriker}
                    label="Non-Striker"
                    selected={wicketDraft.batsmanOut === "nonStriker"}
                    onClick={() => setWicketDraft((p) => ({ ...p, batsmanOut: "nonStriker" }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="field-col">
                  <span className="field-label">Dismissal</span>
                  <select
                    className="select-input"
                    value={wicketDraft.dismissalType}
                    onChange={(e) => setWicketDraft((p) => ({ ...p, dismissalType: e.target.value as WicketDraft["dismissalType"] }))}
                  >
                    <option value="bowled">Bowled</option>
                    <option value="caught">Caught</option>
                    <option value="lbw">LBW</option>
                    <option value="runOut">Run Out</option>
                    <option value="stumped">Stumped</option>
                    <option value="hitWicket">Hit Wicket</option>
                  </select>
                </div>
                <div className="field-col">
                  <span className="field-label">Fielder (if any)</span>
                  <input
                    className="text-input"
                    value={wicketDraft.fielder}
                    onChange={(e) => setWicketDraft((p) => ({ ...p, fielder: e.target.value }))}
                    placeholder="Fielder name"
                  />
                </div>
              </div>

              <p className="font-mono-geist text-[9px] text-white/30">
                Bowler pulled automatically from Live State: {liveState.bowler.name || "—"}
              </p>
              <div className="flex justify-end">
                <button
                  onClick={fireWicketMoment}
                  className="talk-btn"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", borderColor: "rgba(239,68,68,0.3)" }}
                >
                  Fire Wicket
                </button>
              </div>
            </div>
          )}

          <p className="font-mono-geist text-[9px] text-white/40 uppercase tracking-widest mt-1">
            Milestone and wicket graphics auto-hide after a few seconds — no need to turn them off.
          </p>
        </div>

        {/* ── Event log ─────────────────────────────────────────────────── */}
        <div className="rack-panel p-5">
          <div className="eyebrow mb-3">Event Log</div>
          <div className="log-scroll space-y-1.5 h-40 pr-1">
            {log.length === 0 ? (
              <p className="font-mono-geist text-[11px] text-white/30">Nothing fired yet.</p>
            ) : (
              log.map((l, i) => <div key={i} className="font-mono-geist text-[11px] text-white/50">{l}</div>)
            )}
          </div>
        </div>
      </main>
    </div>
  );
}