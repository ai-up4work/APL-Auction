"use client";

import React, { useEffect, useRef, useState } from "react";
import { connectOverlayBus, type OverlayEvent, type MatchSetup, type LiveState, type SyncSnapshot } from "@/lib/overlayBus";
import MatchSetupPanel from "@/components/overlays/admin/MatchSetupPanel";
import LiveStatePanel from "@/components/overlays/admin/LiveStatePanel";
import ProgramMonitor from "@/components/overlays/admin/ProgramMonitor";
import OnAirChannels, { type OnAirChannelsHandle } from "@/components/overlays/admin/OnAirChannels";
import { Section, StatusPill, ActionButton } from "@/components/overlays/admin/ui";
import { ChevronDown } from "lucide-react";

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

// Shared shape for anything that wants to trigger a wicket moment —
// used by both the manual Moments-panel form AND the auto-fire dialog
// that now lives inside the Scorer (LiveStatePanel).
interface WicketMomentPayload {
  batsmanOut: "striker" | "nonStriker";
  batter: { name: string; runs: number; balls: number };
  dismissalType: WicketDraft["dismissalType"];
  fielder: string;
  bowlerName: string;
}

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
  const onAirRef = useRef<OnAirChannelsHandle>(null);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);

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
  const [showMoments, setShowMoments] = useState(false);

  const overlayUrl = typeof window !== "undefined" ? `${window.location.origin}/overlay/${auctionId}` : "";

  // refs mirroring the latest matchSetup/matchSetupCompleted/liveState.
  // The bus-connection effect below only runs once per auctionId, so its
  // closures would otherwise see stale values from the first render. These
  // refs are how sendFullSnapshot() always reads the CURRENT state, however
  // long the admin page has been open.
  const matchSetupRef = useRef(matchSetup);
  const matchSetupCompletedRef = useRef(matchSetupCompleted);
  const liveStateRef = useRef(liveState);

  useEffect(() => {
    matchSetupRef.current = matchSetup;
  }, [matchSetup]);

  useEffect(() => {
    matchSetupCompletedRef.current = matchSetupCompleted;
  }, [matchSetupCompleted]);

  useEffect(() => {
    liveStateRef.current = liveState;
  }, [liveState]);

  // NEW — if a requestSync arrives before OnAirChannels has mounted (ref
  // is still null), sendFullSnapshot() used to just `return` and silently
  // drop it — no reply, no retry, no memory that anything was asked for.
  // This is what caused "sometimes tournamentLogo/liveScoreBar/etc. just
  // don't show up" even with the overlay-side retry loop in place: if
  // every single retry attempt happened to land in the window before this
  // ref existed, none of them ever got answered.
  //
  // Now we remember that a request came in while unready, and flush it the
  // moment OnAirChannels actually mounts.
  const pendingSyncRequestRef = useRef(false);

  function fire(event: OverlayEvent, label: string) {
    busRef.current?.send(event);
    setLog((prev) => [`${new Date().toLocaleTimeString("en-GB", { hour12: false })}  ${label}`, ...prev].slice(0, 12));
  }

  // replies to a receiver's "requestSync" with everything it needs to
  // render the current picture in one shot: channel visibility, match setup
  // (if pushed), and the live scoreboard state.
  function sendFullSnapshot() {
    const channels = onAirRef.current?.getVisibleSnapshot();
    if (!channels) {
      // CHANGED — remember instead of dropping. OnAirChannels isn't
      // mounted yet; we'll answer as soon as it is (see the effect below).
      pendingSyncRequestRef.current = true;
      return;
    }
    const snapshot: SyncSnapshot = {
      channels,
      matchSetup: matchSetupRef.current,
      matchSetupCompleted: matchSetupCompletedRef.current,
      liveState: liveStateRef.current,
    };
    fire({ type: "syncSnapshot", data: snapshot }, "Sent full sync snapshot");
  }

  // NEW — flush any requestSync that arrived too early and got queued in
  // pendingSyncRequestRef, the moment OnAirChannels becomes available.
  // Cheap no-dep check on every render; only actually does anything on the
  // render right after onAirRef.current first becomes non-null while a
  // request is pending.
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

    // a receiver (overlay page / Program Monitor iframe) asks for a
    // snapshot the moment it connects or reconnects. This is the fix for
    // "black screen after refresh" — respond immediately with everything.
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

  // ── Match Setup + Live State persistence ────────────────────────────
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

  // Match Setup / Live State / wicket detail aren't in the OverlayEvent
  // union yet — lib/overlayBus.ts needs "matchSetup" | "liveState" | "wicket"
  // added to it. Cast through `any` here so the admin panel can be built
  // and wired up now; tighten this once that type is extended.
  function fireLoose(event: Record<string, unknown>, label: string) {
    fire(event as unknown as OverlayEvent, label);
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
  // CHANGED — now accepts an optional override so the Scorer (ball pad)
  // can drive this directly with the exact batter/runs/balls at the
  // instant the boundary was scored, instead of only ever reading
  // whatever liveState.striker happens to be when a button is clicked.
  function fireBoundaryMoment(moment: "four" | "six", override?: { name: string; runs: number; balls: number }) {
    const batter = override ?? liveState.striker;
    fireLoose(
      { type: "moment", moment, player: batter.name || "Striker", score: `${batter.runs}(${batter.balls})` },
      `Moment: ${moment.toUpperCase()} — ${batter.name || "Striker"} ${batter.runs}(${batter.balls})`
    );
    onAirRef.current?.notifyMomentFired();
  }

  // CHANGED — same idea: optional override lets the Scorer auto-fire a
  // fifty/hundred the instant the crossing ball is recorded.
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

  // NEW — single shared implementation for firing a wicket moment, used by
  // both the manual Moments-panel form (fireWicketMoment, below) and the
  // Scorer's own quick wicket-detail dialog (onWicketConfirm passed to
  // LiveStatePanel). Keeping one implementation means the overlay event
  // shape can't drift between the two entry points.
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

  function logInningsEnd(payload: { target: number; previousInningsRuns: number; inningsNumber: 1 | 2 }) {
    setLog((prev) => [
      `${new Date().toLocaleTimeString("en-GB", { hour12: false })}  Innings ended — target set to ${payload.target}`,
      ...prev,
    ].slice(0, 12));
  }

  function fireMilestoneMomentFromPanel(moment: "fifty" | "hundred") {
    fireMilestoneMoment(moment);
  }

  // add this function in page.tsx, near pushLiveState/pushMatchSetup
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
    }));
    setLiveDirty(true);
  }

  // manual Moments-panel wicket form — unchanged behavior, now just
  // delegates to the shared helper above.
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

          <div className="flex items-center gap-3 flex-wrap justify-center">
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
                onRestartMatch={restartMatch}   // ← this line is what's missing
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
                        manual/backup firing.
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

                      <p
                        className="text-[10px] pt-1"
                        style={{
                          color: "var(--color-outline)",
                          fontFamily: "var(--font-body-md)",
                        }}
                      >
                        Milestone and wicket graphics auto-hide after a few seconds — no need
                        to turn them off.
                      </p>
                    </>
                  )}
                </div>
              </Section>

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