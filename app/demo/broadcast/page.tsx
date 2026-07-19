"use client";

// ---------------------------------------------------------------------------
// /demo/broadcast
// ---------------------------------------------------------------------------
// A fully offline showcase of every overlay component, driven entirely by
// useDemoBroadcastData() — a ball-by-ball simulation that runs in memory.
// There's no admin panel, no Supabase, no auctionId/matchId wiring.
//
// Two things this version is deliberately careful about:
//
// 1. Not everything is on screen all the time. Only the tournament logo,
//    weather, and the live score bar are "always on" (as they would be on
//    a real broadcast). Boundaries / run-rate / partnership share ONE
//    bottom-right slot and take turns — one is visible for a few seconds,
//    fades out, then the next one fades in. That's what stops the corner
//    from turning into a stack of overlapping cards.
//
// 2. The celebration graphics (four/six/wicket/fifty/etc.) do NOT fire
//    automatically as the simulation plays — `celebrate` defaults to
//    false in the hook. The score updates silently in the background;
//    MatchMomentOverlay's own trigger buttons are the only thing that
//    pops a celebration up, so it only shows when you actually ask for
//    it. Flip "Auto celebrations" on in the control dock if you want the
//    sim to fire them for you instead.
// ---------------------------------------------------------------------------

import React, { useEffect, useRef, useState } from "react";
import { ChevronUp, Pause, Play, RotateCcw, Settings, SkipForward } from "lucide-react";

import { useDemoBroadcastData } from "./hooks/Usedemobroadcastdata";

import WeatherCard from "@/components/overlays/WeatherCard";
import MatchBoundaries from "@/components/overlays/MatchBoundaries";
import TournamentBoundaries from "@/components/overlays/TournamentBoundaries";
import LiveScoreBar from "@/components/overlays/LiveScoreBar";
import PointsTable from "@/components/overlays/PointsTable";
import CricketScorecard from "@/components/overlays/CricketScorecard";
import CricketMatchIntro from "@/components/overlays/CricketMatchIntro";
import MatchMomentOverlay from "@/components/overlays/MatchMomentOverlay";
import TournamentLogoDisplay from "@/components/overlays/TournamentLogoDisplay";
import TossGraphic from "@/components/overlays/Tossgraphic";
import RunRatePanel from "@/components/overlays/Runratepanel";
import PartnershipTracker from "@/components/overlays/Partnershiptracker";
import FallOfWicketsStrip from "@/components/overlays/Fallofwicketsstrip";

type BoundariesMode = "match" | "tournament";
type SlotItem = "boundaries" | "runrate" | "partnership";

const SLOT_ITEMS: SlotItem[] = ["boundaries", "runrate", "partnership"];
const SLOT_DWELL_MS = 6000; // how long each card stays up
const SLOT_GAP_MS = 1400; // how long the corner stays empty between cards
const SLOT_EXIT_MS = 300; // must match the component's own exit animation length

// ---------------------------------------------------------------------------
// useRotatingSlot — cycles through a list of keys, one visible at a time,
// with a proper fade-out (via the `closing` prop every overlay component
// already supports) before the next one fades in. This is what keeps the
// bottom-right corner to a single card instead of a stacked pile.
// ---------------------------------------------------------------------------
function useRotatingSlot(items: SlotItem[], dwellMs: number, gapMs: number, exitMs: number, paused: boolean) {
  const [activeItem, setActiveItem] = useState<SlotItem | null>(items[0] ?? null);
  const [closing, setClosing] = useState(false);
  const indexRef = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (items.length === 0 || paused) return;
    let cancelled = false;

    const clearAll = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    function scheduleNext() {
      const t1 = setTimeout(() => {
        if (cancelled) return;
        setClosing(true);
        const t2 = setTimeout(() => {
          if (cancelled) return;
          setActiveItem(null);
          setClosing(false);
          const t3 = setTimeout(() => {
            if (cancelled) return;
            indexRef.current = (indexRef.current + 1) % items.length;
            setActiveItem(items[indexRef.current]);
            scheduleNext();
          }, gapMs);
          timers.current.push(t3);
        }, exitMs);
        timers.current.push(t2);
      }, dwellMs);
      timers.current.push(t1);
    }

    setActiveItem(items[indexRef.current]);
    setClosing(false);
    scheduleNext();

    return () => {
      cancelled = true;
      clearAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, dwellMs, gapMs, exitMs, paused]);

  return { activeItem, closing };
}

export default function BroadcastDemoPage() {
  const {
    playing,
    togglePlaying,
    step,
    reset,
    celebrate,
    toggleCelebrate,
    matchSetup,
    weather,
    liveState,
    battingTeam,
    runRate,
    wickets,
    scorecardInnings,
  } = useDemoBroadcastData({ autoPlay: true, tickMs: 1800, celebrate: false });

  const [showWeather, setShowWeather] = useState(true);
  const [showScoreBar, setShowScoreBar] = useState(true);
  const [boundariesMode, setBoundariesMode] = useState<BoundariesMode>("match");
  const [dockOpen, setDockOpen] = useState(false);
  const [momentsOpen, setMomentsOpen] = useState(false);

  const striker = liveState.striker;
  const nonStriker = liveState.nonStriker;
  const bowler = liveState.bowler;
  const hasPartnership = !!(striker?.name || nonStriker?.name);

  // Fires a celebration on demand, using whoever is actually at the
  // crease/bowling right now for a realistic payload — this is our own
  // trigger, wired to MatchMomentOverlay's global hook, so it can live
  // anywhere on the page instead of being stuck wherever that component
  // hardcodes its own demo buttons.
  function fireMoment(type: MomentType) {
    if (typeof window === "undefined" || !(window as any).triggerBoundaryCelebration) return;
    const batterName = striker?.name || "Batter";
    const batterLine = `${striker?.runs ?? 0}(${striker?.balls ?? 0})`;
    const payloads: Record<MomentType, Record<string, unknown>> = {
      four: { player: batterName, score: batterLine },
      six: { player: batterName, score: batterLine },
      wicket: { player: batterName, score: batterLine },
      fifty: { player: batterName, score: batterLine },
      hundred: { player: batterName, score: batterLine },
      maiden: { bowler: bowler?.name || "Bowler", maidens: (bowler?.maidens ?? 0) + 1 },
      matchWon: {
        player: battingTeam.name,
        score: "won by 4 wickets",
        teamColor: battingTeam.color,
        teamLogoUrl: battingTeam.logoUrl,
      },
    };
    (window as any).triggerBoundaryCelebration(type, payloads[type]);
  }

  // Skip "partnership" in the rotation until there's actually a pair at
  // the crease, so the corner doesn't fade in to an empty card.
  const activeItems = hasPartnership ? SLOT_ITEMS : (["boundaries", "runrate"] as SlotItem[]);
  const slot = useRotatingSlot(activeItems, SLOT_DWELL_MS, SLOT_GAP_MS, SLOT_EXIT_MS, false);

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "#05070C" }}>
      {/* Stand-in "broadcast feed" — a dark gradient instead of real match
          footage, just so the overlays have contrast to sit on. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(59,139,212,0.12) 0%, transparent 45%), radial-gradient(circle at 75% 75%, rgba(42,157,92,0.1) 0%, transparent 45%), linear-gradient(180deg, #0a1220 0%, #05070c 100%)",
        }}
      />

      {/* ---- Always-on overlays — logo, weather, score bar ---- */}
      <TournamentLogoDisplay
        name={matchSetup.tournamentName}
        edition={[matchSetup.season && `SEASON ${matchSetup.season}`, matchSetup.format].filter(Boolean).join(" · ")}
        logo={matchSetup.tournamentLogoUrl}
      />

      {showWeather && <WeatherCard {...weather} />}

      <LiveScoreBar show={showScoreBar} hideTrigger liveState={liveState} matchSetup={matchSetup} />

      {/* ---- One rotating bottom-right slot instead of three stacked
          cards. Only ever one of these is on screen at a time. ---- */}
      {slot.activeItem === "boundaries" &&
        (boundariesMode === "match" ? (
          <MatchBoundaries
            fours={liveState.matchBoundaries.fours}
            sixes={liveState.matchBoundaries.sixes}
            closing={slot.closing}
          />
        ) : (
          <TournamentBoundaries
            fours={liveState.tournamentBoundaries.fours}
            sixes={liveState.tournamentBoundaries.sixes}
            closing={slot.closing}
          />
        ))}

      {slot.activeItem === "runrate" && (
        <RunRatePanel
          crr={runRate.crr}
          target={runRate.target}
          runsNeeded={runRate.runsNeeded}
          ballsRemaining={runRate.ballsRemaining}
          closing={slot.closing}
        />
      )}

      {slot.activeItem === "partnership" && hasPartnership && (
        <PartnershipTracker
          runs={liveState.partnership.runs}
          balls={liveState.partnership.balls}
          batterA={striker?.name ? { name: striker.name, runs: striker.runs } : undefined}
          batterB={nonStriker?.name ? { name: nonStriker.name, runs: nonStriker.runs } : undefined}
          closing={slot.closing}
        />
      )}

      {/* Celebration queue — off by default (celebrate: false above), so
          nothing fires just from the sim ticking. hideDemoButtons is
          false, so its own trigger buttons (bottom-left) are how you
          pop a graphic up on demand. */}
      <MatchMomentOverlay logoSrc={matchSetup.tournamentLogoUrl} />

      {/* ---- Modal-style overlays — each ships its own trigger button. ---- */}
      <div
        className="fixed top-5 left-1/2 -translate-x-1/2 z-[95] flex items-center gap-1 rounded-xl px-2 py-1.5"
        style={{ background: "rgba(8,8,10,0.72)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(6px)" }}
      >
        <CricketMatchIntro matchSetup={matchSetup} />
        <TossGraphic
          teamA={matchSetup.teamA}
          teamB={matchSetup.teamB}
          winner={matchSetup.tossWinner}
          decision={matchSetup.tossDecision}
        />
        <CricketScorecard
          matchId={null}
          matchSetup={matchSetup}
          liveState={liveState}
          sandboxInningsCards={scorecardInnings}
        />
        <FallOfWicketsStrip
          wickets={wickets}
          inningsLabel={liveState.inningsNumber === 1 ? "1st Innings" : "2nd Innings"}
        />
        {/* PointsTable reads standings live via usePointsTableLedger(auctionId)
            from Supabase — there's no prop override for offline data, so in
            a fully backend-free demo it renders its own empty/loading state.
            Still wired up so the trigger sits with the rest of the toolbar. */}
        <PointsTable auctionId="demo-auction" />
      </div>

      {/* ---- Simulation control dock — collapsed by default, tucked in
          the one corner nothing else uses (bottom-left), so it never
          overlaps the broadcast furniture itself. ---- */}
      <div className="fixed bottom-4 left-4 z-[95] flex flex-col items-start gap-2">
        {dockOpen && (
          <div
            className="flex flex-col gap-2 rounded-xl p-3 w-64"
            style={{ background: "rgba(8,8,10,0.88)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(6px)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#C9971F" }}>
                Demo Sim
              </span>
              <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>
                {battingTeam.shortCode} batting · Inn {liveState.inningsNumber}
                {liveState.matchComplete ? " · Complete" : ""}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={togglePlaying}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold uppercase tracking-wide text-white"
                style={{ background: "rgba(201,151,31,0.18)", border: "1px solid rgba(201,151,31,0.4)" }}
              >
                {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {playing ? "Pause" : "Play"}
              </button>
              <button
                onClick={step}
                className="flex items-center justify-center rounded-lg p-2"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                aria-label="Bowl next ball"
                title="Bowl next ball"
              >
                <SkipForward className="w-3.5 h-3.5 text-white" />
              </button>
              <button
                onClick={reset}
                className="flex items-center justify-center rounded-lg p-2"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                aria-label="Restart match"
                title="Restart match"
              >
                <RotateCcw className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            <div className="h-px my-1" style={{ background: "rgba(255,255,255,0.08)" }} />

            <ToggleRow label="Weather" checked={showWeather} onChange={setShowWeather} />
            <ToggleRow label="Score bar" checked={showScoreBar} onChange={setShowScoreBar} />
            <ToggleRow
              label="Auto celebrations"
              checked={celebrate}
              onChange={toggleCelebrate}
              hint="off = trigger manually below"
            />

            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>
                Boundaries card
              </span>
              <div className="flex gap-1">
                {(["match", "tournament"] as BoundariesMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setBoundariesMode(m)}
                    className="px-2 py-1 rounded-md text-[9px] font-bold uppercase"
                    style={{
                      background: boundariesMode === m ? "rgba(201,151,31,0.3)" : "rgba(255,255,255,0.06)",
                      color: boundariesMode === m ? "#F2C766" : "rgba(255,255,255,0.6)",
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[9px] leading-relaxed mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
              Boundaries / run-rate / partnership share one corner and rotate automatically — that's intentional,
              not a bug you need to toggle.
            </p>
          </div>
        )}

        <button
          onClick={() => setDockOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-full px-3 py-2"
          style={{ background: "rgba(8,8,10,0.88)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {dockOpen ? <ChevronUp className="w-3.5 h-3.5 text-white" /> : <Settings className="w-3.5 h-3.5 text-white" />}
          <span className="text-[10px] font-bold uppercase tracking-wide text-white">Demo Controls</span>
        </button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center justify-between w-full text-left">
      <span className="flex flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>
          {label}
        </span>
        {hint && (
          <span className="text-[8.5px]" style={{ color: "rgba(255,255,255,0.35)" }}>
            {hint}
          </span>
        )}
      </span>
      <span
        className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0"
        style={{ background: checked ? "rgba(201,151,31,0.6)" : "rgba(255,255,255,0.15)" }}
      >
        <span
          className="inline-block h-3 w-3 transform rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(14px)" : "translateX(2px)" }}
        />
      </span>
    </button>
  );
}