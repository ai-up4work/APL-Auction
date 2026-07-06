// app/overlay/[auctionId]/admin/page.tsx
"use client";

import React, { use, useEffect, useRef, useState } from "react";
import { connectOverlayBus, type OverlayEvent } from "@/lib/overlayBus";

interface OverlayToggle {
  key: string;
  label: string;
  on: boolean;
  set: (v: boolean) => void;
  event: OverlayEvent["type"];
  exclusiveWith?: string;
}

// ── Match Setup (SESSION) ──────────────────────────────────────────────
// Filled in once before/at the start of a match. Doesn't change ball to
// ball — persisted for the whole session and referenced by later events
// rather than re-sent every time.
interface TeamInfo {
  name: string;
  shortCode: string;
  color: string;
  logoUrl: string;
  squad: string[];
}

interface MatchSetup {
  tournamentName: string;
  season: string;
  tournamentLogoUrl: string;
  venue: string;
  format: "T20" | "ODI" | "Test";
  matchNumber: string;
  matchTitle: string;
  teamA: TeamInfo;
  teamB: TeamInfo;
  tossWinner: "A" | "B" | "";
  tossDecision: "bat" | "bowl" | "";
}

const emptyTeam = (): TeamInfo => ({ name: "", shortCode: "", color: "#c9971f", logoUrl: "", squad: [] });

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
// Ticks continuously through the match — score, current batters, current
// bowler, boundary tallies, points table. Edited as a running total, not
// fired as one-shot events.
interface BatterState {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
}

interface BowlerState {
  name: string;
  overs: number;
  balls: number;
  maidens: number;
  runs: number;
  wickets: number;
}

interface PointsRow {
  team: string;
  played: number;
  won: number;
  lost: number;
  nrr: string;
  points: number;
}

interface LiveState {
  score: { runs: number; wickets: number; overs: number; balls: number };
  striker: BatterState;
  nonStriker: BatterState;
  bowler: BowlerState;
  partnership: { runs: number; balls: number };
  matchBoundaries: { fours: number; sixes: number };
  tournamentBoundaries: { fours: number; sixes: number };
  pointsTable: PointsRow[];
}

const emptyBatter = (): BatterState => ({ name: "", runs: 0, balls: 0, fours: 0, sixes: 0 });
const emptyBowler = (): BowlerState => ({ name: "", overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 });

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
// One-shot triggers. Wicket needs a little extra detail captured at the
// instant it fires (who's out, how, who fielded) rather than stored state.
interface WicketDraft {
  batsmanOut: "striker" | "nonStriker";
  dismissalType: "bowled" | "caught" | "lbw" | "runOut" | "stumped" | "hitWicket";
  fielder: string;
}

const emptyWicketDraft: WicketDraft = { batsmanOut: "striker", dismissalType: "bowled", fielder: "" };

// Small shared number-stepper control used across the Live State panel.
function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="field-col">
      <span className="field-label">{label}</span>
      <div className="stepper">
        <button type="button" className="stepper-btn" onClick={() => onChange(Math.max(min, value - step))}>
          −
        </button>
        <input
          type="number"
          className="stepper-input"
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        />
        <button type="button" className="stepper-btn" onClick={() => onChange(value + step)}>
          +
        </button>
      </div>
    </div>
  );
}

export default function OverlayAdminPage({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = use(params);

  const busRef = useRef<ReturnType<typeof connectOverlayBus> | null>(null);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

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

  // ── Preview scaling ────────────────────────────────────────────────
  // Measure the actual clipping box (.monitor-screen), not its padded
  // parent, and fit the 1920x1080 iframe into it on BOTH axes so it can
  // never overflow the box regardless of the box's real aspect ratio.
  const monitorScreenRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    function updateScale() {
      const el = monitorScreenRef.current;
      if (!el) return;
      const scaleX = el.clientWidth / 1920;
      const scaleY = el.clientHeight / 1080;
      setPreviewScale(Math.min(scaleX, scaleY));
    }

    updateScale();

    const ro = new ResizeObserver(updateScale);
    if (monitorScreenRef.current) ro.observe(monitorScreenRef.current);

    window.addEventListener("resize", updateScale);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

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

  function copyUrl() {
    navigator.clipboard?.writeText(overlayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
  function updateTeam(team: "teamA" | "teamB", patch: Partial<TeamInfo>) {
    setMatchSetup((prev) => ({ ...prev, [team]: { ...prev[team], ...patch } }));
  }

  function updateSquad(team: "teamA" | "teamB", raw: string) {
    const squad = raw
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean);
    updateTeam(team, { squad });
  }

  function pushMatchSetup() {
    fireLoose({ type: "matchSetup", data: matchSetup }, "Match Setup pushed to overlay");
    setSetupPushed(true);
    setTimeout(() => setSetupPushed(false), 1500);
  }

  // ── Live State helpers ───────────────────────────────────────────────
  function patchLive(patch: Partial<LiveState>) {
    setLiveState((prev) => ({ ...prev, ...patch }));
    setLiveDirty(true);
  }

  function patchBatter(who: "striker" | "nonStriker", patch: Partial<BatterState>) {
    setLiveState((prev) => ({ ...prev, [who]: { ...prev[who], ...patch } }));
    setLiveDirty(true);
  }

  function patchBowler(patch: Partial<BowlerState>) {
    setLiveState((prev) => ({ ...prev, bowler: { ...prev.bowler, ...patch } }));
    setLiveDirty(true);
  }

  function swapStrike() {
    setLiveState((prev) => ({ ...prev, striker: prev.nonStriker, nonStriker: prev.striker }));
    setLiveDirty(true);
  }

  function addPointsRow() {
    setLiveState((prev) => ({
      ...prev,
      pointsTable: [...prev.pointsTable, { team: "", played: 0, won: 0, lost: 0, nrr: "0.00", points: 0 }],
    }));
    setLiveDirty(true);
  }

  function patchPointsRow(index: number, patch: Partial<PointsRow>) {
    setLiveState((prev) => ({
      ...prev,
      pointsTable: prev.pointsTable.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
    setLiveDirty(true);
  }

  function removePointsRow(index: number) {
    setLiveState((prev) => ({ ...prev, pointsTable: prev.pointsTable.filter((_, i) => i !== index) }));
    setLiveDirty(true);
  }

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

        /* ── Console frame — faint vignette + hairline grid texture, so the
           whole page reads as a dim gallery/control-room, not a flat
           dashboard. Very subtle; restraint over decoration. ─────────── */
        .console-frame {
          background-image:
            radial-gradient(ellipse 120% 60% at 50% -10%, rgba(201,151,31,0.06), transparent 60%),
            var(--color-background, #0d1117);
        }

        /* ── Rack panel — brushed-metal top highlight + four corner rivets,
           standing in for the screws on a physical rack-mounted unit. This
           is the page's one recurring skeuomorphic motif. ──────────────── */
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

        /* ── Tally lamp — the signature element. Dim steel when off; glows
           broadcast-red when live, exactly like a studio gallery's on-air
           indicator. ──────────────────────────────────────────────────── */
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

        /* ── Channel strip — replaces the plain toggle button. Tally lamp +
           label + micro state readout, like a switcher's input strip. ─── */
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

        /* ── Program monitor bezel — corner brackets like a broadcast
           preview/program monitor, with a rec-tally + PGM plate. ───────── */
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
          /* Centers the scaled iframe inside the box so if the box's real
             aspect ratio ever drifts from 16:9, the content stays centered
             with letterboxing rather than pinned/clipped to one corner. */
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

        /* ── Themed scrollbar for the event log ─────────────────────────── */
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

        /* ── Drawer — collapsible rack panel used for Match Setup / Live
           State, which are dense enough to want to be tucked away once
           configured. Native <details> keeps it keyboard/aXe-friendly. ── */
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

        /* ── Form controls — dark inset fields matching the stepper's look
           already used in the Live State panel. ───────────────────────── */
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

        {/* ── Source plate ─────────────────────────────────────────────── */}
        <div className="rack-panel p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="eyebrow mb-1.5">OBS Browser Source</div>
            <code className="font-mono-geist text-xs text-theme-orange break-all">{overlayUrl || "…"}</code>
          </div>
          <div className="flex items-center gap-3">
            <span className="eyebrow">1920×1080 · transparent bg</span>
            <button onClick={copyUrl} className="talk-btn">{copied ? "Copied ✓" : "Copy URL"}</button>
          </div>
        </div>

        {/* ── Program monitor ──────────────────────────────────────────── */}
        <div className="rack-panel p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Program Monitor</div>
            <span className="eyebrow">scaled preview</span>
          </div>
          <div className="monitor-frame">
            <div className="monitor-screen" ref={monitorScreenRef}>
              <div className="monitor-corner tl" />
              <div className="monitor-corner tr" />
              <div className="monitor-corner bl" />
              <div className="monitor-corner br" />
              {/* <div className="pgm-plate">
                <span className="tally live" style={{ animation: "connPulse 1.8s ease-in-out infinite" }} />
                <span className="font-mono-geist text-[9px] font-bold tracking-[0.2em] text-white/80">PGM OUT</span>
              </div> */}
              {overlayUrl && (
                  <iframe
                    src={overlayUrl}
                    title="Overlay preview"
                    style={{
                      width: "1920px",
                      height: "1080px",
                      border: "none",
                      transform: `scale(${previewScale})`,
                      transformOrigin: "center center",
                      flexShrink: 0,
                    }}
                  />
                )}
            </div>
          </div>
        </div>

        {/* ── Match Setup (session) ────────────────────────────────────── */}
        <details className="rack-panel p-5 drawer">
          <summary>
            <div className="flex items-center gap-3">
              <div className="eyebrow">Match Setup</div>
              <span className="font-mono-geist text-[9px] text-white/30 normal-case tracking-normal">session · set once</span>
            </div>
            <span className="drawer-chevron">▸</span>
          </summary>

          <div className="drawer-body flex flex-col gap-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="field-col">
                <span className="field-label">Tournament</span>
                <input className="text-input" value={matchSetup.tournamentName}
                  onChange={(e) => setMatchSetup((p) => ({ ...p, tournamentName: e.target.value }))}
                  placeholder="e.g. Provincial T20 Cup" />
              </div>
              <div className="field-col">
                <span className="field-label">Season</span>
                <input className="text-input" value={matchSetup.season}
                  onChange={(e) => setMatchSetup((p) => ({ ...p, season: e.target.value }))}
                  placeholder="e.g. 2026" />
              </div>
              <div className="field-col">
                <span className="field-label">Tournament Logo URL</span>
                <input className="text-input" value={matchSetup.tournamentLogoUrl}
                  onChange={(e) => setMatchSetup((p) => ({ ...p, tournamentLogoUrl: e.target.value }))}
                  placeholder="https://…" />
              </div>
              <div className="field-col">
                <span className="field-label">Venue</span>
                <input className="text-input" value={matchSetup.venue}
                  onChange={(e) => setMatchSetup((p) => ({ ...p, venue: e.target.value }))}
                  placeholder="Ground name" />
              </div>
              <div className="field-col">
                <span className="field-label">Format</span>
                <select className="select-input" value={matchSetup.format}
                  onChange={(e) => setMatchSetup((p) => ({ ...p, format: e.target.value as MatchSetup["format"] }))}>
                  <option value="T20">T20</option>
                  <option value="ODI">ODI</option>
                  <option value="Test">Test</option>
                </select>
              </div>
              <div className="field-col">
                <span className="field-label">Match Number</span>
                <input className="text-input" value={matchSetup.matchNumber}
                  onChange={(e) => setMatchSetup((p) => ({ ...p, matchNumber: e.target.value }))}
                  placeholder="e.g. Match 14" />
              </div>
              <div className="field-col" style={{ gridColumn: "span 2" }}>
                <span className="field-label">Match Title</span>
                <input className="text-input" value={matchSetup.matchTitle}
                  onChange={(e) => setMatchSetup((p) => ({ ...p, matchTitle: e.target.value }))}
                  placeholder="e.g. Semi-Final" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(["teamA", "teamB"] as const).map((teamKey) => {
                const team = matchSetup[teamKey];
                return (
                  <div key={teamKey} className="team-card" style={{ ["--team-color" as string]: team.color }}>
                    <div className="eyebrow">{teamKey === "teamA" ? "Team A" : "Team B"}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="field-col">
                        <span className="field-label">Name</span>
                        <input className="text-input" value={team.name}
                          onChange={(e) => updateTeam(teamKey, { name: e.target.value })} placeholder="Team name" />
                      </div>
                      <div className="field-col">
                        <span className="field-label">Short Code</span>
                        <input className="text-input" value={team.shortCode}
                          onChange={(e) => updateTeam(teamKey, { shortCode: e.target.value.toUpperCase() })}
                          placeholder="e.g. CSK" maxLength={4} />
                      </div>
                      <div className="field-col">
                        <span className="field-label">Color</span>
                        <div className="flex items-center gap-2">
                          <input type="color" value={team.color}
                            onChange={(e) => updateTeam(teamKey, { color: e.target.value })}
                            style={{ width: 34, height: 34, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "none", padding: 0 }} />
                          <input className="text-input" value={team.color}
                            onChange={(e) => updateTeam(teamKey, { color: e.target.value })} />
                        </div>
                      </div>
                      <div className="field-col">
                        <span className="field-label">Logo URL</span>
                        <input className="text-input" value={team.logoUrl}
                          onChange={(e) => updateTeam(teamKey, { logoUrl: e.target.value })} placeholder="https://…" />
                      </div>
                    </div>
                    <div className="field-col">
                      <span className="field-label">Squad ({team.squad.length}) · one name per line</span>
                      <textarea className="textarea-input" value={team.squad.join("\n")}
                        onChange={(e) => updateSquad(teamKey, e.target.value)}
                        placeholder={"Player One\nPlayer Two\nPlayer Three"} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="field-col">
                <span className="field-label">Toss Winner</span>
                <select className="select-input" value={matchSetup.tossWinner}
                  onChange={(e) => setMatchSetup((p) => ({ ...p, tossWinner: e.target.value as MatchSetup["tossWinner"] }))}>
                  <option value="">—</option>
                  <option value="A">{matchSetup.teamA.shortCode || "Team A"}</option>
                  <option value="B">{matchSetup.teamB.shortCode || "Team B"}</option>
                </select>
              </div>
              <div className="field-col">
                <span className="field-label">Toss Decision</span>
                <select className="select-input" value={matchSetup.tossDecision}
                  onChange={(e) => setMatchSetup((p) => ({ ...p, tossDecision: e.target.value as MatchSetup["tossDecision"] }))}>
                  <option value="">—</option>
                  <option value="bat">Elected to bat</option>
                  <option value="bowl">Elected to bowl</option>
                </select>
              </div>
              <div className="flex-1" />
              <button onClick={pushMatchSetup} className="talk-btn" style={{ minWidth: 180 }}>
                {setupPushed ? "Pushed ✓" : "Push Match Setup"}
              </button>
            </div>
          </div>
        </details>

        {/* ── Live State (incremental) ─────────────────────────────────── */}
        <details className="rack-panel p-5 drawer" open>
          <summary>
            <div className="flex items-center gap-3">
              <div className="eyebrow">Live State</div>
              <span className="font-mono-geist text-[9px] text-white/30 normal-case tracking-normal">updates ball by ball</span>
              {liveDirty && <span className="dirty-dot" title="Unpushed changes" />}
            </div>
            <span className="drawer-chevron">▸</span>
          </summary>

          <div className="drawer-body flex flex-col gap-6">
            {/* Score */}
            <div>
              <div className="eyebrow mb-2">Score</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <NumberStepper label="Runs" value={liveState.score.runs}
                  onChange={(v) => patchLive({ score: { ...liveState.score, runs: v } })} />
                <NumberStepper label="Wickets" value={liveState.score.wickets} min={0}
                  onChange={(v) => patchLive({ score: { ...liveState.score, wickets: Math.min(10, v) } })} />
                <NumberStepper label="Overs" value={liveState.score.overs}
                  onChange={(v) => patchLive({ score: { ...liveState.score, overs: v } })} />
                <NumberStepper label="Balls" value={liveState.score.balls}
                  onChange={(v) => patchLive({ score: { ...liveState.score, balls: Math.min(5, v) } })} />
              </div>
            </div>

            {/* Batters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="eyebrow">Batters at the Crease</div>
                <button onClick={swapStrike} className="fx-btn fx-toggle-off">Swap Strike</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(["striker", "nonStriker"] as const).map((who) => (
                  <div key={who} className="batter-card">
                    <div className="eyebrow" style={{ color: who === "striker" ? "#E8C468" : undefined }}>
                      {who === "striker" ? "Striker *" : "Non-Striker"}
                    </div>
                    <input className="text-input" value={liveState[who].name}
                      onChange={(e) => patchBatter(who, { name: e.target.value })} placeholder="Batter name" />
                    <div className="grid grid-cols-4 gap-2">
                      <NumberStepper label="Runs" value={liveState[who].runs} onChange={(v) => patchBatter(who, { runs: v })} />
                      <NumberStepper label="Balls" value={liveState[who].balls} onChange={(v) => patchBatter(who, { balls: v })} />
                      <NumberStepper label="4s" value={liveState[who].fours} onChange={(v) => patchBatter(who, { fours: v })} />
                      <NumberStepper label="6s" value={liveState[who].sixes} onChange={(v) => patchBatter(who, { sixes: v })} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bowler + partnership */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bowler-card">
                <div className="eyebrow">Bowler</div>
                <input className="text-input" value={liveState.bowler.name}
                  onChange={(e) => patchBowler({ name: e.target.value })} placeholder="Bowler name" />
                <div className="grid grid-cols-5 gap-2">
                  <NumberStepper label="Overs" value={liveState.bowler.overs} onChange={(v) => patchBowler({ overs: v })} />
                  <NumberStepper label="Balls" value={liveState.bowler.balls} onChange={(v) => patchBowler({ balls: Math.min(5, v) })} />
                  <NumberStepper label="Maidens" value={liveState.bowler.maidens} onChange={(v) => patchBowler({ maidens: v })} />
                  <NumberStepper label="Runs" value={liveState.bowler.runs} onChange={(v) => patchBowler({ runs: v })} />
                  <NumberStepper label="Wkts" value={liveState.bowler.wickets} onChange={(v) => patchBowler({ wickets: v })} />
                </div>
              </div>
              <div className="bowler-card">
                <div className="eyebrow">Partnership</div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberStepper label="Runs" value={liveState.partnership.runs}
                    onChange={(v) => patchLive({ partnership: { ...liveState.partnership, runs: v } })} />
                  <NumberStepper label="Balls" value={liveState.partnership.balls}
                    onChange={(v) => patchLive({ partnership: { ...liveState.partnership, balls: v } })} />
                </div>
              </div>
            </div>

            {/* Boundaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bowler-card">
                <div className="eyebrow">Match Boundaries</div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberStepper label="4s" value={liveState.matchBoundaries.fours}
                    onChange={(v) => patchLive({ matchBoundaries: { ...liveState.matchBoundaries, fours: v } })} />
                  <NumberStepper label="6s" value={liveState.matchBoundaries.sixes}
                    onChange={(v) => patchLive({ matchBoundaries: { ...liveState.matchBoundaries, sixes: v } })} />
                </div>
              </div>
              <div className="bowler-card">
                <div className="eyebrow">Tournament Boundaries</div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberStepper label="4s" value={liveState.tournamentBoundaries.fours}
                    onChange={(v) => patchLive({ tournamentBoundaries: { ...liveState.tournamentBoundaries, fours: v } })} />
                  <NumberStepper label="6s" value={liveState.tournamentBoundaries.sixes}
                    onChange={(v) => patchLive({ tournamentBoundaries: { ...liveState.tournamentBoundaries, sixes: v } })} />
                </div>
              </div>
            </div>

            {/* Points table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="eyebrow">Points Table</div>
                <button onClick={addPointsRow} className="fx-btn fx-toggle-off">+ Add Row</button>
              </div>
              {liveState.pointsTable.length > 0 && (
                <div className="points-row-grid mb-1.5">
                  <span className="field-label">Team</span>
                  <span className="field-label">Pld</span>
                  <span className="field-label">Won</span>
                  <span className="field-label">Lost</span>
                  <span className="field-label">NRR</span>
                  <span className="field-label">Pts</span>
                  <span />
                </div>
              )}
              <div className="flex flex-col gap-2">
                {liveState.pointsTable.map((row, i) => (
                  <div key={i} className="points-row-grid">
                    <input className="text-input" value={row.team} onChange={(e) => patchPointsRow(i, { team: e.target.value })} placeholder="Team" />
                    <input className="text-input" type="number" value={row.played} onChange={(e) => patchPointsRow(i, { played: Number(e.target.value) || 0 })} />
                    <input className="text-input" type="number" value={row.won} onChange={(e) => patchPointsRow(i, { won: Number(e.target.value) || 0 })} />
                    <input className="text-input" type="number" value={row.lost} onChange={(e) => patchPointsRow(i, { lost: Number(e.target.value) || 0 })} />
                    <input className="text-input" value={row.nrr} onChange={(e) => patchPointsRow(i, { nrr: e.target.value })} placeholder="0.00" />
                    <input className="text-input" type="number" value={row.points} onChange={(e) => patchPointsRow(i, { points: Number(e.target.value) || 0 })} />
                    <button onClick={() => removePointsRow(i)} className="icon-btn">×</button>
                  </div>
                ))}
                {liveState.pointsTable.length === 0 && (
                  <p className="font-mono-geist text-[11px] text-white/30">No rows yet — add a team to start the table.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={pushLiveState} className="talk-btn" style={{ minWidth: 180 }}>
                {livePushed ? "Pushed ✓" : "Push Live State"}
              </button>
            </div>
          </div>
        </details>

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
            <div className="segment-group" style={{ maxWidth: 400 }}>
              <button className={`segment-btn ${milestoneBatter === "striker" ? "is-active" : ""}`} onClick={() => setMilestoneBatter("striker")}>
                {liveState.striker.name || "Striker"}
              </button>
              <button className={`segment-btn ${milestoneBatter === "nonStriker" ? "is-active" : ""}`} onClick={() => setMilestoneBatter("nonStriker")}>
                {liveState.nonStriker.name || "Non-Striker"}
              </button>
            </div>
          </div>

          {showWicketForm && (
            <div className="bowler-card mt-2">
              <div className="eyebrow" style={{ color: "#f87171" }}>Wicket Detail</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="field-col">
                  <span className="field-label">Batsman Out</span>
                  <select className="select-input" value={wicketDraft.batsmanOut}
                    onChange={(e) => setWicketDraft((p) => ({ ...p, batsmanOut: e.target.value as WicketDraft["batsmanOut"] }))}>
                    <option value="striker">{liveState.striker.name || "Striker"}</option>
                    <option value="nonStriker">{liveState.nonStriker.name || "Non-Striker"}</option>
                  </select>
                </div>
                <div className="field-col">
                  <span className="field-label">Dismissal</span>
                  <select className="select-input" value={wicketDraft.dismissalType}
                    onChange={(e) => setWicketDraft((p) => ({ ...p, dismissalType: e.target.value as WicketDraft["dismissalType"] }))}>
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
                  <input className="text-input" value={wicketDraft.fielder}
                    onChange={(e) => setWicketDraft((p) => ({ ...p, fielder: e.target.value }))} placeholder="Fielder name" />
                </div>
              </div>
              <p className="font-mono-geist text-[9px] text-white/30">
                Bowler pulled automatically from Live State: {liveState.bowler.name || "—"}
              </p>
              <div className="flex justify-end">
                <button onClick={fireWicketMoment} className="talk-btn" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", borderColor: "rgba(239,68,68,0.3)" }}>
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