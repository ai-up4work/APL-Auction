"use client";

import React, { useEffect, useRef, useState } from "react";
import { connectOverlayBus, type OverlayEvent, type MatchSetup, type LiveState } from "@/lib/overlayBus";
import MatchSetupPanel from "@/components/overlays/admin/MatchSetupPanel";
import LiveStatePanel from "@/components/overlays/admin/LiveStatePanel";
import ProgramMonitor from "@/components/overlays/admin/ProgramMonitor";
import { Section, StatusPill, ActionButton, ChannelRow } from "@/components/overlays/admin/ui";

interface OverlayToggle {
  key: string;
  label: string;
  on: boolean;
  set: (v: boolean) => void;
  event: OverlayEvent["type"];
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

// ── Batter picker — shows the player photo so admins confirm at a glance ─
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
  const auctionId = "2c5915d0-6b31-47cb-9597-0bd721afe2a9";

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
  const [matchSetupCompleted, setMatchSetupCompleted] = useState(false);
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

  const runRate =
    liveState.score.overs + liveState.score.balls / 6 > 0
      ? (liveState.score.runs / (liveState.score.overs + liveState.score.balls / 6)).toFixed(2)
      : "0.00";
  const scoreIsLive =
    liveState.score.runs > 0 || liveState.score.wickets > 0 || liveState.score.overs > 0 || liveState.score.balls > 0;

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--color-background)", color: "var(--color-on-background)" }}>
      {/* Background wash — consistent with the rest of the admin shell */}
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
        <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
          <div>
            <span
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] mb-2"
              style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>stream</span>
              Broadcast Control
            </span>
            <h2
              style={{
                fontFamily: "var(--font-headline-lg)",
                fontSize: "32px",
                lineHeight: "40px",
                fontWeight: 700,
                letterSpacing: "0.01em",
                color: "var(--color-on-surface)",
              }}
            >
              Overlay Control Room
            </h2>
            <p className="mt-1.5 max-w-xl" style={{ fontFamily: "var(--font-body-md)", fontSize: "14px", lineHeight: "22px", color: "var(--color-on-surface-variant)" }}>
              Set the match once, then run the scoreboard ball by ball — the program monitor and quick-fire graphics stay docked alongside you.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {scoreIsLive && (
              <div
                className="flex items-baseline gap-2.5 px-4 py-2 rounded-xl"
                style={{ background: "rgba(201,151,31,0.06)", border: "1px solid rgba(201,151,31,0.2)" }}
              >
                <span style={{ fontFamily: "var(--font-label-mono)", fontWeight: 700, fontSize: "18px", color: "var(--color-theme-orange)" }}>
                  {liveState.score.runs}
                  <span style={{ opacity: 0.6, fontSize: "14px" }}>/{liveState.score.wickets}</span>
                </span>
                <span
                  className="text-[10px] uppercase tracking-wide whitespace-nowrap"
                  style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}
                >
                  {liveState.score.overs}.{liveState.score.balls} ov · RR {runRate}
                </span>
              </div>
            )}
            <div className="flex items-center gap-0.5">
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
              <StatusPill label={connected ? "Bus Connected" : "Connecting…"} tone={connected ? "success" : "warning"} pulse={!connected} />
            </div>
          </div>
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
            />

            {/* Scorer / Live State only appears once Match Setup has been
                pushed and locked — before that, this slot shows a nudge
                instead so the page doesn't imply live scoring is ready. */}
            {matchSetupCompleted ? (
              <LiveStatePanel
                liveState={liveState}
                setLiveState={setLiveState}
                setLiveDirty={setLiveDirty}
                liveDirty={liveDirty}
                onPush={pushLiveState}
                pushLabel={livePushed ? "Pushed ✓" : "Push Live State"}
                matchSetup={matchSetup}
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

          <aside className="w-full lg:w-[380px] flex-shrink-0 flex flex-col gap-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1 log-scroll">            <ProgramMonitor overlayUrl={overlayUrl} />

            {/* ── Moments — the buttons an operator reaches for the
                 instant a ball happens, docked next to the picture ── */}
            <Section title="Moments" description="Fire the graphic the instant it happens on the ball.">
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <ActionButton label="Four" onClick={() => fireBoundaryMoment("four")} />
                  <ActionButton label="Six" onClick={() => fireBoundaryMoment("six")} />
                  <ActionButton
                    label="Wicket"
                    danger
                    active={showWicketForm}
                    onClick={() => setShowWicketForm((v) => !v)}
                  />
                  <ActionButton label="Fifty" onClick={() => fireMilestoneMoment("fifty")} />
                </div>
                <ActionButton full label="Hundred" onClick={() => fireMilestoneMoment("hundred")} />

                <div className="flex flex-col gap-2 pt-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}>
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
                    style={{ background: "var(--color-error-container)", border: "1px solid rgba(255,180,171,0.25)" }}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-error)" }}>
                      Wicket Detail
                    </span>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
                        Batsman Out
                      </span>
                      <div className="grid grid-cols-2 gap-2">
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

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
                        Dismissal
                      </span>
                      <select
                        value={wicketDraft.dismissalType}
                        onChange={(e) => setWicketDraft((p) => ({ ...p, dismissalType: e.target.value as WicketDraft["dismissalType"] }))}
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                        style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface)" }}
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
                      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>
                        Fielder (if any)
                      </span>
                      <input
                        value={wicketDraft.fielder}
                        onChange={(e) => setWicketDraft((p) => ({ ...p, fielder: e.target.value }))}
                        placeholder="Fielder name"
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                        style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)", color: "var(--color-on-surface)" }}
                      />
                    </div>

                    <p className="text-[10px]" style={{ color: "var(--color-outline)" }}>
                      Bowler pulled automatically from Live State: {liveState.bowler.name || "—"}
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

                <p className="text-[10px] pt-1" style={{ color: "var(--color-outline)", fontFamily: "var(--font-body-md)" }}>
                  Milestone and wicket graphics auto-hide after a few seconds — no need to turn them off.
                </p>
              </div>
            </Section>

            {/* ── On Air — overlay channel toggles ──────────────────── */}
            <Section title="On Air" description="Toggle overlay channels live on the broadcast.">
              <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2">
                  {channels.map((ch) => (
                    <ChannelRow key={ch.key} label={ch.label} on={ch.on} onToggle={() => toggleChannel(ch)} />
                  ))}
                </div>

                <button
                  onClick={() => {
                    channels.forEach((ch) => ch.set(false));
                    fire({ type: "clearAll" }, "Cleared all overlays");
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wide mt-1"
                  style={{
                    fontFamily: "var(--font-label-mono)",
                    background: "var(--color-error-container)",
                    border: "1px solid rgba(255,180,171,0.25)",
                    color: "var(--color-error)",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>restart_alt</span>
                  Clear Everything
                </button>

                <div className="h-px my-1" style={{ background: "var(--color-outline-variant)" }} />

                <ChannelRow label="Test Background" on={testBgOn} tone="blue" onToggle={() => {
                  const next = !testBgOn;
                  setTestBgOn(next);
                  fire({ type: "testBg", show: next }, `Test background ${next ? "on" : "off"}`);
                }} />
                <p className="text-[10px]" style={{ color: "var(--color-outline)", fontFamily: "var(--font-body-md)" }}>
                  Sample footage for layout testing — off before going live.
                </p>
              </div>
            </Section>

            {/* ── Event Log ──────────────────────────────────────────── */}
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