"use client";

// ---------------------------------------------------------------------------
// /demo/broadcast
// ---------------------------------------------------------------------------
// A fully offline showcase of every overlay component, driven entirely by
// useDemoBroadcastData() — a ball-by-ball simulation that runs in memory.
// There's no admin panel, no Supabase, no auctionId/matchId wiring (except
// PointsTable, see its own note below).
//
// Layout notes:
//
// 1. Not everything is on screen all the time. Only the tournament logo
//    is "always on" (as it would be on a real broadcast). Weather, the
//    live score bar, and the rotating dock (boundaries / run-rate /
//    partnership / bowling figures) are each independently toggleable
//    from the header now — see "Header trigger buttons" below.
//
// 2. Boundaries and run-rate dock FLUSH against the live score bar's
//    right edge (SCORE_BAR_DOCK_BOTTOM / SCORE_BAR_DOCK_RIGHT below)
//    instead of each component's own default offset — reads as one
//    piece of broadcast furniture rather than a card floating loose
//    above it. Bowling figures docks at the same point (it's a
//    right-aligned corner card, same family as Boundaries/Run Rate —
//    unlike Partnership, it doesn't need the score-bar-hides staging).
//    Partnership instead lines up with the score bar's own BOTTOM edge
//    (SCORE_BAR_BOTTOM_EDGE) and is horizontally CENTERED (`center`
//    prop) rather than right-docked — it reads as its own centered
//    moment, not a corner card. Because it sits at the same height as
//    the score bar, the two are never shown at once: the score bar
//    hides and Partnership takes over, staged as a proper crossfade
//    (see "LiveScoreBar <-> Partnership crossfade staging" below)
//    rather than both firing their animations at the same instant —
//    which used to look like the two colliding mid-transition. Still
//    respects the manual "Score bar" toggle — turning that off keeps
//    it off regardless of what's active.
//
//    NOTE: SCORE_BAR_BOTTOM_EDGE and SCORE_BAR_DOCK_BOTTOM are two
//    different offsets for two different jobs — the former is
//    LiveScoreBar's own bottom padding (for Partnership to match its
//    bottom edge), the latter is the bar's rendered height + a margin
//    (for Boundaries/Run Rate/Bowling to dock above its top edge).
//    Don't conflate them when tuning.
//
//    NOTE: SCORE_BAR_DOCK_BOTTOM is tuned by eye against LiveScoreBar's
//    current rendered height. If that component's height ever changes
//    (extra row, bigger font, etc.), bump this constant to match — it's
//    a plain px value because LiveScoreBar doesn't expose its own height
//    as a prop/CSS var to dock against.
//
// 3. The celebration graphics (four/six/wicket/fifty/etc.) do NOT fire
//    automatically as the simulation plays — `celebrate` defaults to
//    false in the hook. The header toolbar's Moments dropdown is the
//    only thing that pops a celebration up on demand (besides the
//    "Auto celebrations" toggle in Demo Controls).
//
// 4. Demo Controls (play/pause/step/reset/boundaries-card-mode/auto-
//    celebrations) lives in its own dropdown off a gear icon, since
//    those aren't "overlays" so much as simulation controls. Every
//    actual OVERLAY component now has its own direct trigger button in
//    the header row — see "Header trigger buttons" below — instead of
//    some being reachable only through a buried Preview list.
//
// 5. Header trigger buttons — every overlay gets a same-row button now:
//      - CricketMatchIntro, TossGraphic, CricketScorecard,
//        FallOfWicketsStrip, PointsTable: unchanged, each opens its own
//        modal/graphic via its own click handler (as before).
//      - Weather, Score bar: simple on/off toggle buttons (these are
//        "always could be on" pieces of broadcast furniture, not
//        one-shot moments), highlighted gold when active.
//      - Boundaries, Run Rate, Partnership, Bowling: these still share
//        the ONE rotating dock point (see note 2) since showing two
//        corner cards at once was never the intent — clicking one of
//        these buttons pins it into the dock (pausing auto-rotation),
//        same mechanism the old buried "Preview" row used, just now
//        surfaced as first-class header buttons instead of hidden in
//        the Demo dropdown. Clicking the same one again releases the
//        pin back to Auto. Partnership/Bowling stay disabled until
//        hasPartnership/hasBowler are true, same gating as before.
//
// 6. Bowling figures — data comes straight from useDemoBroadcastData's
//    liveState.bowler (the sim already tracks overs/maidens/runs/
//    wickets ball-by-ball, see advanceOneBall in the hook). No backend
//    involved: fieldingTeam is derived locally by elimination against
//    battingTeam/matchSetup, exactly the same way it's already done for
//    the "Bowling vs X" label. Gated behind hasBowler the same way
//    Partnership is gated behind hasPartnership, so the dock never
//    fades in to an empty card before the sim has picked a bowler.
//
// 7. PointsTable is the one overlay that ISN'T backed by the demo sim —
//    it reads live from Supabase via usePointsTableLedger("demo-auction"),
//    which has no real corresponding row, so it's expected to render its
//    own empty/loading state (or surface a Supabase error if e.g. RLS
//    denies the anon role — a separate, already-flagged concern). Left
//    wired up and untouched per earlier instruction not to modify
//    PointsTable.jsx itself.
// ---------------------------------------------------------------------------

import React, { useEffect, useRef, useState } from "react";
import {
  Award,
  ChevronUp,
  CircleDot,
  CloudSun,
  Gauge,
  PanelBottom,
  Pause,
  Play,
  PartyPopper,
  RotateCcw,
  Settings,
  ShieldCheck,
  SkipForward,
  Target,
  Trophy,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

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
import BowlingFiguresPanel from "@/components/overlays/Bowlingfigurespanel";
import FallOfWicketsStrip from "@/components/overlays/Fallofwicketsstrip";

type BoundariesMode = "match" | "tournament";
type SlotItem = "boundaries" | "runrate" | "partnership" | "bowling";
type MomentType = "four" | "six" | "wicket" | "fifty" | "hundred" | "maiden" | "matchWon";

const SLOT_ITEMS: SlotItem[] = ["boundaries", "runrate", "partnership", "bowling"];
const SLOT_DWELL_MS = 6000; // how long each card stays up
const SLOT_GAP_MS = 1400; // how long the corner stays empty between cards
const SLOT_EXIT_MS = 300; // must match the component's own exit animation length

// Partnership renders centered at the score bar's own vertical level, so
// unlike Boundaries/Run Rate/Bowling (which just dock a fresh card next to
// an always-visible score bar), swapping to/from Partnership means the
// score bar itself has to get out of the way first. Firing both animations
// at once looked like the two overlays colliding mid-transition, so instead
// we stage them: fully exit one, THEN enter the other, with a small
// breathing gap in between rather than a hard cut.
//
// These must match each component's own internal exit-animation length —
// LiveScoreBar's EXIT_MS (in LiveScoreBar.jsx) and PartnershipTracker's
// `.pnt-wrap.pnt-closing` / `.pnt-dock-center.pnt-closing` CSS duration
// (0.28s) respectively. If either component's animation timing changes,
// these need to be updated to match or the stagger will drift out of sync.
const LIVESCORE_EXIT_MS = 650;
const PARTNERSHIP_EXIT_MS = 280;
const CROSSFADE_GAP_MS = 120; // brief pause of "nothing" so the swap doesn't feel like a hard cut

// Header trigger buttons for the four dock items that share the one
// rotating slot. Kept as data so the header JSX stays a .map() instead
// of four near-identical buttons — same idiom MOMENT_BUTTONS already
// uses below.
const DOCK_TRIGGER_BUTTONS: { value: SlotItem; label: string; icon: typeof Target }[] = [
  { value: "boundaries", label: "Boundaries", icon: Target },
  { value: "runrate", label: "Run Rate", icon: Gauge },
  { value: "partnership", label: "Partnership", icon: Users },
  { value: "bowling", label: "Bowling", icon: CircleDot },
];

// Shared dock point for the rotating slot, sitting just above the live
// score bar. Fixed px, not vw/%, so the two stay pixel-aligned regardless
// of viewport width instead of drifting apart the way two independently
// vw-based offsets would.
const SCORE_BAR_HEIGHT = "132px"; // = LiveScoreBar's rendered height, by eye — adjust if that changes
const SCORE_BAR_DOCK_MARGIN = "16px"; // visible gap between the dock and the score bar's top edge
const SCORE_BAR_DOCK_BOTTOM = `calc(${SCORE_BAR_HEIGHT} + ${SCORE_BAR_DOCK_MARGIN})`;
const SCORE_BAR_BOTTOM_EDGE = "20px";
const SCORE_BAR_DOCK_RIGHT = "5vw";

// Header toolbar buttons for every celebration MatchMomentOverlay knows how
// to fire. Kept as plain data so the header JSX below stays a simple .map()
// instead of seven near-identical <button> blocks.
const MOMENT_BUTTONS: { type: MomentType; label: string; icon: typeof Zap; accent: string }[] = [
  { type: "four", label: "4", icon: Zap, accent: "#8ec9ff" },
  { type: "six", label: "6", icon: Zap, accent: "#F2C766" },
  { type: "wicket", label: "Out", icon: XCircle, accent: "#e15b5b" },
  { type: "fifty", label: "50", icon: Award, accent: "#F2C766" },
  { type: "hundred", label: "100", icon: Trophy, accent: "#F2C766" },
  { type: "maiden", label: "Maiden", icon: ShieldCheck, accent: "#8ec9ff" },
  { type: "matchWon", label: "Match Won", icon: PartyPopper, accent: "#F2C766" },
];

// ---------------------------------------------------------------------------
// useRotatingSlot — cycles through a list of keys, one visible at a time,
// with a proper fade-out (via the `closing` prop every overlay component
// already supports) before the next one fades in. This is what keeps the
// dock point to a single card instead of a stacked pile.
//
// `paused` freezes the rotation entirely — used when a manual trigger
// override is active (see manualSlot state in the page component) so the
// auto-rotate timers don't fire underneath a pinned item and yank it away
// mid-preview.
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
    standings,
    liveState,
    battingTeam,
    runRate,
    wickets,
    scorecardInnings,
  } = useDemoBroadcastData({ autoPlay: true, tickMs: 1800, celebrate: false });

  const [showWeather, setShowWeather] = useState(true);
  const [showScoreBar, setShowScoreBar] = useState(true);
  const [showPartnership, setShowPartnership] = useState(true);
  const [boundariesMode, setBoundariesMode] = useState<BoundariesMode>("match");
  const [dockOpen, setDockOpen] = useState(false);
  const [momentsOpen, setMomentsOpen] = useState(false);

  // Manual override for the rotating dock slot. "auto" defers entirely to
  // useRotatingSlot's own timer; picking a specific SlotItem pins that item
  // on screen (rotation paused) until the same header button is pressed
  // again (toggles back to "auto") or the item is gated off elsewhere
  // (e.g. Partnership toggle / no pair at crease, or Bowling with no
  // bowler set yet).
  const [manualSlot, setManualSlot] = useState<SlotItem | "auto">("auto");

  // Auto-reveal the toss result once, shortly after the toss is known, then
  // hand control back to TossGraphic's own trigger button by setting `show`
  // back to undefined — so it still opens/closes on click afterward, exactly
  // like every other modal-style overlay in this toolbar.
  const [showToss, setShowToss] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (!matchSetup?.tossWinner) return;
    const revealDelayMs = 900;
    const dwellMs = 4500;
    const t1 = setTimeout(() => setShowToss(true), revealDelayMs);
    const t2 = setTimeout(() => setShowToss(false), revealDelayMs + dwellMs);
    const t3 = setTimeout(() => setShowToss(undefined), revealDelayMs + dwellMs + 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [matchSetup?.tossWinner]);

  const striker = liveState.striker;
  const nonStriker = liveState.nonStriker;
  const bowler = liveState.bowler;
  const hasPartnership = !!(striker?.name || nonStriker?.name);
  // Bowling figures need an actual bowler in the middle of an over — same
  // "don't dock an empty card" reasoning as hasPartnership above.
  const hasBowler = !!bowler?.name;
  // BowlingFiguresPanel needs the FIELDING side, not the batting one — the
  // hook only hands back `battingTeam`, so derive the other one from
  // matchSetup by elimination (whichever of teamA/teamB isn't currently
  // batting).
  const fieldingTeam =
    matchSetup?.teamA?.shortCode === battingTeam?.shortCode ? matchSetup?.teamB : matchSetup?.teamA;

  // If a manual Partnership/Bowling pin is active but the condition that
  // gates it stops being true (e.g. a wicket falls mid-preview), fall
  // back to Auto instead of silently rendering nothing.
  useEffect(() => {
    if (manualSlot === "partnership" && !hasPartnership) {
      setManualSlot("auto");
    }
    if (manualSlot === "bowling" && !hasBowler) {
      setManualSlot("auto");
    }
  }, [manualSlot, hasPartnership, hasBowler]);

  // Fires a celebration on demand, using whoever is actually at the
  // crease/bowling right now for a realistic payload.
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

  // Clicking a dock trigger button pins that item (pausing rotation);
  // clicking the SAME one again releases back to Auto, same toggle
  // behavior as the toolbar's other on/off buttons.
  function handleDockTriggerClick(value: SlotItem) {
    setManualSlot((prev) => (prev === value ? "auto" : value));
  }

  // Which items are eligible for the rotation right now. Boundaries/
  // Run Rate are always eligible. Partnership only joins once there's a
  // pair at the crease AND the manual toggle allows it. Bowling only
  // joins once the sim has actually assigned a bowler.
  const activeItems: SlotItem[] = [
    "boundaries",
    "runrate",
    ...(hasPartnership && showPartnership ? (["partnership"] as SlotItem[]) : []),
    ...(hasBowler ? (["bowling"] as SlotItem[]) : []),
  ];
  const slot = useRotatingSlot(activeItems, SLOT_DWELL_MS, SLOT_GAP_MS, SLOT_EXIT_MS, manualSlot !== "auto");

  // Effective dock item/closing state: a manual pin wins over whatever the
  // auto-rotation last landed on, and never reports "closing" since a
  // pinned item isn't mid-exit-animation.
  const effectiveActiveItem = manualSlot === "auto" ? slot.activeItem : manualSlot;
  const effectiveClosing = manualSlot === "auto" ? slot.closing : false;

  // ---- LiveScoreBar <-> Partnership crossfade staging ----------------
  // See note 2 at the top of the file for the full reasoning. Bowling
  // doesn't need this staging — it docks in the same corner as
  // Boundaries/Run Rate, above an always-visible score bar, so it can
  // render/unmount directly off effectiveActiveItem.
  const wantsPartnership = effectiveActiveItem === "partnership";
  const [scoreBarShown, setScoreBarShown] = useState(!wantsPartnership);
  const [partnershipShown, setPartnershipShown] = useState(wantsPartnership);
  const [partnershipClosing, setPartnershipClosing] = useState(false);
  const partnershipShownRef = useRef(partnershipShown);
  partnershipShownRef.current = partnershipShown;

  useEffect(() => {
    let enterTimer: ReturnType<typeof setTimeout> | undefined;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    let returnTimer: ReturnType<typeof setTimeout> | undefined;

    if (wantsPartnership) {
      setScoreBarShown(false);
      enterTimer = setTimeout(() => {
        setPartnershipClosing(false);
        setPartnershipShown(true);
      }, LIVESCORE_EXIT_MS + CROSSFADE_GAP_MS);
    } else if (partnershipShownRef.current) {
      setPartnershipClosing(true);
      exitTimer = setTimeout(() => {
        setPartnershipShown(false);
        returnTimer = setTimeout(() => setScoreBarShown(true), CROSSFADE_GAP_MS);
      }, PARTNERSHIP_EXIT_MS);
    } else {
      setScoreBarShown(true);
    }

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(returnTimer);
    };
  }, [wantsPartnership]);

  return (
      <div className="fixed inset-0" style={{ background: "transparent" }}>
        <video
          autoPlay
          loop
          muted
          playsInline
          className="fixed inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
          src="/sample-match-footage.mp4"
        />

      {/* ---- Always-on overlay — tournament logo ---- */}
      <TournamentLogoDisplay
        name={matchSetup.tournamentName}
        edition={[matchSetup.season && `SEASON ${matchSetup.season}`, matchSetup.format].filter(Boolean).join(" · ")}
        logo={matchSetup.tournamentLogoUrl}
      />

      {showWeather && <WeatherCard {...weather} />}

      <LiveScoreBar
        show={showScoreBar && scoreBarShown}
        hideTrigger
        liveState={liveState}
        matchSetup={matchSetup}
      />

      {/* ---- One rotating dock point instead of four stacked cards,
          locked flush against the live score bar's top-right edge. Only
          ever one of these is on screen at a time. Driven by
          effectiveActiveItem/effectiveClosing so a header trigger
          override overrides the auto rotation. ---- */}
      {effectiveActiveItem === "boundaries" &&
        (boundariesMode === "match" ? (
          <MatchBoundaries
            fours={liveState.matchBoundaries.fours}
            sixes={liveState.matchBoundaries.sixes}
            closing={effectiveClosing}
            bottom={SCORE_BAR_DOCK_BOTTOM}
            right={SCORE_BAR_DOCK_RIGHT}
          />
        ) : (
          <TournamentBoundaries
            fours={liveState.tournamentBoundaries.fours}
            sixes={liveState.tournamentBoundaries.sixes}
            closing={effectiveClosing}
            bottom={SCORE_BAR_DOCK_BOTTOM}
            right={SCORE_BAR_DOCK_RIGHT}
          />
        ))}

      {effectiveActiveItem === "runrate" && (
        <RunRatePanel
          crr={runRate.crr}
          target={runRate.target}
          runsNeeded={runRate.runsNeeded}
          ballsRemaining={runRate.ballsRemaining}
          closing={effectiveClosing}
          bottom={SCORE_BAR_DOCK_BOTTOM}
          right={SCORE_BAR_DOCK_RIGHT}
        />
      )}

      {/* Bowling figures — data pulled straight from
          useDemoBroadcastData's liveState.bowler/score, no fetch. */}
      {effectiveActiveItem === "bowling" && hasBowler && (
        <BowlingFiguresPanel
          bowler={bowler}
          team={fieldingTeam}
          opponent={{ shortCode: battingTeam?.shortCode }}
          battingScore={liveState.score}
          closing={effectiveClosing}
          bottom={SCORE_BAR_DOCK_BOTTOM}
          right={SCORE_BAR_DOCK_RIGHT}
        />
      )}

      {partnershipShown && hasPartnership && (
        <PartnershipTracker
          runs={liveState.partnership.runs}
          balls={liveState.partnership.balls}
          batterA={striker?.name ? { name: striker.name, runs: striker.runs } : undefined}
          batterB={nonStriker?.name ? { name: nonStriker.name, runs: nonStriker.runs } : undefined}
          closing={partnershipClosing}
          bottom={SCORE_BAR_BOTTOM_EDGE}
          center
        />
      )}

      {/* Celebration queue — off by default (celebrate: false above), so
          nothing fires just from the sim ticking. The header's Moments
          dropdown is the intended trigger surface. */}
      <MatchMomentOverlay logoSrc={matchSetup.tournamentLogoUrl} hideDemoButtons />

      {/* ---- Header toolbar — every overlay component gets its own
          trigger button here now, grouped by kind:
            1. Modal/graphic overlays (own click-to-open, unchanged)
            2. Furniture toggles (Weather, Score bar — plain on/off)
            3. Dock triggers (Boundaries/Run Rate/Partnership/Bowling —
               pin into the shared rotating slot, click again to release)
            4. Moments dropdown (celebration one-shots)
            5. Demo Controls dropdown (sim play/pause/step/reset + misc) ---- */}
      <div
        className="fixed top-5 left-1/2 -translate-x-1/2 z-[95] flex items-center gap-1 rounded-xl px-2 py-1.5 flex-wrap justify-center max-w-[92vw]"
        style={{ background: "rgba(8,8,10,0.72)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(6px)" }}
      >
        {/* ---- Modal / graphic overlays ---- */}
        <CricketMatchIntro matchSetup={matchSetup} />
        <TossGraphic
          show={showToss}
          teamA={matchSetup.teamA}
          teamB={matchSetup.teamB}
          winner={matchSetup.tossWinner}
          decision={matchSetup.tossDecision}
          tournamentName={matchSetup.tournamentName}
          tournamentLogoUrl={matchSetup.tournamentLogoUrl}
        />
        <CricketScorecard
          matchId={null}
          matchSetup={matchSetup}
          liveState={liveState}
          sandboxInningsCards={scorecardInnings}
        />
        {/* <FallOfWicketsStrip
          wickets={wickets}
          inningsLabel={liveState.inningsNumber === 1 ? "1st Innings" : "2nd Innings"}
        /> */}
        {/* PointsTable — untouched (see note 7 above); still reads live
            from Supabase for "demo-auction" rather than the sim's own
            `standings`/DEMO_STANDINGS data. */}
        {/* <PointsTable auctionId="demo-auction" /> */}

        <div className="w-px h-5 mx-1 shrink-0" style={{ background: "rgba(255,255,255,0.15)" }} />

        {/* ---- Furniture toggles — Weather / Score bar ---- */}
        <ToolbarToggleButton
          label="Weather"
          icon={CloudSun}
          active={showWeather}
          onClick={() => setShowWeather((v) => !v)}
        />
        <ToolbarToggleButton
          label="Score Bar"
          icon={PanelBottom}
          active={showScoreBar}
          onClick={() => setShowScoreBar((v) => !v)}
        />

        <div className="w-px h-5 mx-1 shrink-0" style={{ background: "rgba(255,255,255,0.15)" }} />

        {/* ---- Dock triggers — Boundaries / Run Rate / Partnership /
            Bowling. These share one dock point (see note 2), so clicking
            one pins it (pausing auto-rotation) and clicking the same one
            again releases back to Auto — same pattern as the furniture
            toggles above, just gated by hasPartnership/hasBowler where
            relevant. ---- */}
        {DOCK_TRIGGER_BUTTONS.map(({ value, label, icon }) => {
          const disabled = (value === "partnership" && !hasPartnership) || (value === "bowling" && !hasBowler);
          return (
            <ToolbarToggleButton
              key={value}
              label={label}
              icon={icon}
              active={manualSlot === value}
              disabled={disabled}
              title={
                value === "partnership" && disabled
                  ? "Needs a pair at the crease"
                  : value === "bowling" && disabled
                  ? "Needs an assigned bowler"
                  : undefined
              }
              onClick={() => handleDockTriggerClick(value)}
            />
          );
        })}

        <div className="w-px h-5 mx-1 shrink-0" style={{ background: "rgba(255,255,255,0.15)" }} />

        {/* ---- Moments — the 7 celebration triggers live inside one
            dropdown instead of as 7 separate boxed buttons in the nav. ---- */}
        <div className="relative shrink-0">
          <button
            onClick={() => setMomentsOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/5"
          >
            <PartyPopper className="w-3.5 h-3.5" style={{ color: "#F2C766" }} />
            <span className="text-[11px] font-bold uppercase tracking-wide text-white">Moments</span>
          </button>

          {momentsOpen && (
            <div
              className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 grid grid-cols-4 gap-1.5 rounded-xl p-2.5 w-72 z-[96]"
              style={{ background: "rgba(8,8,10,0.92)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(6px)" }}
            >
              {MOMENT_BUTTONS.map(({ type, label, icon, accent }) => (
                <MomentButton
                  key={type}
                  label={label}
                  icon={icon}
                  accent={accent}
                  onClick={() => {
                    fireMoment(type);
                    setMomentsOpen(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-5 mx-1 shrink-0" style={{ background: "rgba(255,255,255,0.15)" }} />

        {/* ---- Demo Controls — simulation controls only now (play/pause/
            step/reset, boundaries-card mode, partnership on/off, auto
            celebrations) — the dock-item previews that used to live here
            have moved up to first-class header buttons above. ---- */}
        <div className="relative shrink-0">
          <button
            onClick={() => setDockOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/5"
          >
            {dockOpen ? <ChevronUp className="w-3.5 h-3.5 text-white" /> : <Settings className="w-3.5 h-3.5 text-white" />}
            <span className="text-[11px] font-bold uppercase tracking-wide text-white">Demo</span>
          </button>

          {dockOpen && (
            <div
              className="absolute top-[calc(100%+8px)] right-0 flex flex-col gap-2 rounded-xl p-3 w-64 z-[96]"
              style={{ background: "rgba(8,8,10,0.92)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(6px)" }}
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

              <ToggleRow
                label="Partnership"
                checked={showPartnership}
                onChange={setShowPartnership}
                hint="also needs a pair at the crease"
              />
              <ToggleRow
                label="Auto celebrations"
                checked={celebrate}
                onChange={toggleCelebrate}
                hint="off = trigger manually via Moments"
              />

              <div className="h-px my-1" style={{ background: "rgba(255,255,255,0.08)" }} />

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
                Boundaries / run-rate / partnership / bowling share one dock point — use their header
                buttons to pin one, click again to go back to Auto rotation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Shared toolbar button for the furniture toggles (Weather, Score Bar)
// and the dock triggers (Boundaries, Run Rate, Partnership, Bowling) —
// same visual language (icon + label, gold when active) whether it's a
// persistent on/off toggle or a "pin into the dock" trigger.
function ToolbarToggleButton({
  label,
  icon: Icon,
  active,
  disabled = false,
  title,
  onClick,
}: {
  label: string;
  icon: typeof Zap;
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={() => !disabled && onClick()}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
      style={{
        background: active ? "rgba(201,151,31,0.22)" : "transparent",
        border: active ? "1px solid rgba(201,151,31,0.4)" : "1px solid transparent",
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color: active ? "#F2C766" : "rgba(255,255,255,0.75)" }} />
      <span
        className="text-[11px] font-bold uppercase tracking-wide"
        style={{ color: active ? "#F2C766" : "white" }}
      >
        {label}
      </span>
    </button>
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

// Small pill button used for the header's celebration triggers (four, six,
// wicket, fifty, hundred, maiden, match won). Kept separate from
// ToolbarToggleButton/ToggleRow since these are one-shot actions, not
// persistent on/off state.
function MomentButton({
  label,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string;
  icon: typeof Zap;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={`Trigger ${label}`}
      className="flex flex-col items-center justify-center gap-1 rounded-lg py-2 px-1"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <Icon className="w-4 h-4" style={{ color: accent }} />
      <span className="text-[9px] font-bold uppercase tracking-wide text-white leading-none">{label}</span>
    </button>
  );
}