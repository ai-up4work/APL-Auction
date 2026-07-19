"use client";

// ---------------------------------------------------------------------------
// /demo/broadcast
// ---------------------------------------------------------------------------
// A fully offline showcase of every overlay component, driven entirely by
// useDemoBroadcastData() — a ball-by-ball simulation that runs in memory.
// There's no admin panel, no Supabase, no auctionId/matchId wiring.
//
// Layout notes:
//
// 1. Not everything is on screen all the time. Only the tournament logo,
//    weather, and the live score bar are "always on" (as they would be on
//    a real broadcast). Boundaries / run-rate / partnership share ONE
//    slot and take turns — one is visible for a few seconds, fades out,
//    then the next fades in. That's what stops the corner from turning
//    into a stack of overlapping cards.
//
// 2. Boundaries and run-rate dock FLUSH against the live score bar's
//    right edge (SCORE_BAR_DOCK_BOTTOM / SCORE_BAR_DOCK_RIGHT below)
//    instead of each component's own default offset — reads as one
//    piece of broadcast furniture rather than a card floating loose
//    above it. Partnership instead lines up with the score bar's own
//    BOTTOM edge (SCORE_BAR_BOTTOM_EDGE) and is horizontally CENTERED
//    (`center` prop) rather than right-docked — it reads as its own
//    centered moment, not a corner card. Because it sits at the same
//    height as the score bar, the two are never shown at once: the
//    score bar hides and Partnership takes over, staged as a proper
//    crossfade (see "LiveScoreBar <-> Partnership crossfade staging"
//    below) rather than both firing their animations at the same
//    instant — which used to look like the two colliding mid-transition.
//    Still respects the manual "Score bar" toggle in Demo Controls —
//    turning that off keeps it off regardless of what's active.
//
//    NOTE: SCORE_BAR_BOTTOM_EDGE and SCORE_BAR_DOCK_BOTTOM are two
//    different offsets for two different jobs — the former is
//    LiveScoreBar's own bottom padding (for Partnership to match its
//    bottom edge), the latter is the bar's rendered height + a margin
//    (for Boundaries/Run Rate to dock above its top edge). Don't
//    conflate them when tuning.
//
//    NOTE: SCORE_BAR_DOCK_BOTTOM is tuned by eye against LiveScoreBar's
//    current rendered height. If that component's height ever changes
//    (extra row, bigger font, etc.), bump this constant to match — it's
//    a plain px value because LiveScoreBar doesn't expose its own height
//    as a prop/CSS var to dock against.
//
// 3. The celebration graphics (four/six/wicket/fifty/etc.) do NOT fire
//    automatically as the simulation plays — `celebrate` defaults to
//    false in the hook. The header toolbar's moment buttons are the only
//    thing that pops a celebration up on demand.
//
// 4. Demo Controls used to live at fixed bottom-left, which put it right
//    on top of the live score bar. It's now a dropdown hanging off a
//    gear icon at the end of the top header toolbar, so nothing floats
//    over the score bar anymore.
//
// 5. Boundaries / run-rate / partnership previously had NO manual trigger
//    at all — every other overlay in the toolbar (Toss, Scorecard, Fall
//    of Wickets, Points Table, Match Intro) ships its own click-to-open
//    button, but these three could only be seen by waiting for the
//    rotation to land on them, and Partnership couldn't be previewed at
//    all until there was an actual pair at the crease. The "Preview"
//    row in Demo Controls below lets you force any one of the three into
//    the dock (pausing rotation) or go back to "Auto".
// ---------------------------------------------------------------------------

import React, { useEffect, useRef, useState } from "react";
import {
  Award,
  ChevronUp,
  Pause,
  Play,
  PartyPopper,
  RotateCcw,
  Settings,
  ShieldCheck,
  SkipForward,
  Trophy,
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
import FallOfWicketsStrip from "@/components/overlays/Fallofwicketsstrip";

type BoundariesMode = "match" | "tournament";
type SlotItem = "boundaries" | "runrate" | "partnership";
// Was referenced by fireMoment() below (as a parameter type and as the key
// type of the payloads Record) but never actually declared anywhere in this
// file — TypeScript would fail on "Cannot find name 'MomentType'" at both
// usages, and once that error hits, the type-checker's state is already
// broken for the rest of the file, which is why unrelated JSX below (the
// TossGraphic/CricketMatchIntro/etc. calls) can start showing spurious
// "doesn't accept these props" errors too. The union here just has to match
// the keys actually used in the `payloads` object further down.
type MomentType = "four" | "six" | "wicket" | "fifty" | "hundred" | "maiden" | "matchWon";

const SLOT_ITEMS: SlotItem[] = ["boundaries", "runrate", "partnership"];
const SLOT_DWELL_MS = 6000; // how long each card stays up
const SLOT_GAP_MS = 1400; // how long the corner stays empty between cards
const SLOT_EXIT_MS = 300; // must match the component's own exit animation length

// Partnership renders centered at the score bar's own vertical level, so
// unlike Boundaries/Run Rate (which just dock a fresh card next to an
// always-visible score bar), swapping to/from Partnership means the score
// bar itself has to get out of the way first. Firing both animations at
// once looked like the two overlays colliding mid-transition, so instead
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

// Data-driven list backing the "Preview" row in Demo Controls — lets you
// force any one dock item into view without waiting for the rotation.
// "auto" isn't in here; it's rendered as its own separate button since it
// resets to the live rotation instead of pinning a specific item.
const SLOT_PREVIEW_ITEMS: { value: SlotItem; label: string }[] = [
  { value: "boundaries", label: "Boundaries" },
  { value: "runrate", label: "Run Rate" },
  { value: "partnership", label: "Partnership" },
];

// Shared dock point for the rotating slot, sitting just above the live
// score bar. Fixed px, not vw/%, so the two stay pixel-aligned regardless
// of viewport width instead of drifting apart the way two independently
// vw-based offsets would.
//
// SCORE_BAR_DOCK_BOTTOM has a small gap built in (score bar height + a
// margin) rather than sitting flush — flush read as the two overlapping/
// touching, which looked like a layout bug rather than intentional
// docking. Bump the margin below if it still looks too tight.
// SCORE_BAR_DOCK_RIGHT is also passed to LiveScoreBar itself (assuming it
// accepts a `right` inset prop) so the score bar's own right edge lines
// up with the boundaries/run-rate card sitting above it, instead of each
// picking its own default width/inset independently.
const SCORE_BAR_HEIGHT = "132px"; // = LiveScoreBar's rendered height, by eye — adjust if that changes
const SCORE_BAR_DOCK_MARGIN = "16px"; // visible gap between the dock and the score bar's top edge
const SCORE_BAR_DOCK_BOTTOM = `calc(${SCORE_BAR_HEIGHT} + ${SCORE_BAR_DOCK_MARGIN})`;
// LiveScoreBar's own bottom edge — separate from SCORE_BAR_DOCK_BOTTOM
// above, which docks Boundaries/Run Rate ABOVE the bar (flush with its
// TOP edge). Partnership instead needs to line up with the bar's BOTTOM
// edge, which sits inside LiveScoreBar's own `pb-3 sm:pb-5` container
// padding (12px mobile / 20px sm+) rather than at SCORE_BAR_DOCK_BOTTOM's
// height. Using the sm+ value here since this is a desktop broadcast
// layout; if LiveScoreBar's own bottom padding changes, update this to
// match.
const SCORE_BAR_BOTTOM_EDGE = "20px";
// LiveScoreBar doesn't take a right/left prop — it's `fixed inset-x-0`
// with `items-center`, and the bar itself is a plain `width: 90vw` div,
// so it's always horizontally CENTERED on screen, never right-anchored.
// A 90vw-wide centered element has a 5vw margin on each side, so its
// right edge sits 5vw in from the viewport's right edge. Matching that
// here (instead of a guessed px value like 24px) is what actually lines
// the dock up with the score bar's real edge, without touching
// LiveScoreBar itself. If LiveScoreBar's own width/centering ever
// changes, this needs to be recalculated the same way.
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
// `paused` freezes the rotation entirely — used when a manual preview
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
  // on screen (rotation paused) until "Auto" is pressed again or the item
  // is toggled off elsewhere (e.g. Partnership toggle / no pair at crease).
  const [manualSlot, setManualSlot] = useState<SlotItem | "auto">("auto");

  // Auto-reveal the toss result once, shortly after the toss is known, then
  // hand control back to TossGraphic's own trigger button by setting `show`
  // back to undefined — so it still opens/closes on click afterward, exactly
  // like every other modal-style overlay in this toolbar. Previously this
  // page never passed `show` to TossGraphic at all, so the auto-reveal path
  // the component supports was dead code from this integration's side.
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

  // If a manual Partnership preview is pinned but the pair-at-crease
  // condition that would normally gate it stops being true (e.g. a wicket
  // falls while you're previewing it), fall back to Auto instead of
  // silently rendering nothing.
  useEffect(() => {
    if (manualSlot === "partnership" && !hasPartnership) {
      setManualSlot("auto");
    }
  }, [manualSlot, hasPartnership]);

  // Fires a celebration on demand, using whoever is actually at the
  // crease/bowling right now for a realistic payload — this is our own
  // trigger, wired to MatchMomentOverlay's global hook, so it can live
  // anywhere on the page (the header toolbar) instead of being stuck
  // wherever that component hardcodes its own demo buttons.
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
  // the crease, so the dock point doesn't fade in to an empty card — and
  // also respect the manual "Partnership" toggle in Demo Controls, for
  // whenever you want to preview boundaries/run-rate on their own.
  const activeItems =
    hasPartnership && showPartnership ? SLOT_ITEMS : (["boundaries", "runrate"] as SlotItem[]);
  const slot = useRotatingSlot(activeItems, SLOT_DWELL_MS, SLOT_GAP_MS, SLOT_EXIT_MS, manualSlot !== "auto");

  // Effective dock item/closing state: a manual pin wins over whatever the
  // auto-rotation last landed on, and never reports "closing" since a
  // pinned item isn't mid-exit-animation.
  const effectiveActiveItem = manualSlot === "auto" ? slot.activeItem : manualSlot;
  const effectiveClosing = manualSlot === "auto" ? slot.closing : false;

  // ---- LiveScoreBar <-> Partnership crossfade staging ----------------
  // Rather than flipping LiveScoreBar's `show` and rendering
  // PartnershipTracker off the same `effectiveActiveItem` flag (which
  // fires both components' animations at the exact same instant), this
  // drives two independent, staggered states:
  //   scoreBarShown       — what's actually passed to LiveScoreBar's `show`
  //   partnershipShown     — whether PartnershipTracker is rendered at all
  //   partnershipClosing   — the `closing` prop passed to it
  // wantsPartnership flipping true hides the score bar immediately, then
  // waits out LiveScoreBar's own exit animation (+ a small gap) before
  // revealing Partnership. Flipping false plays Partnership's own exit
  // animation first, then waits out that (+ a small gap) before bringing
  // the score bar back. Works the same whether the swap came from the
  // auto-rotation or a manual Preview click, since both just change
  // effectiveActiveItem.
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
      // Step 1: score bar exits now (LiveScoreBar plays its own ~650ms
      // fade/scale-out). Step 2: only once that's had time to fully
      // clear, reveal Partnership — so it never pops in over a score bar
      // that's still mid-exit.
      setScoreBarShown(false);
      enterTimer = setTimeout(() => {
        setPartnershipClosing(false);
        setPartnershipShown(true);
      }, LIVESCORE_EXIT_MS + CROSSFADE_GAP_MS);
    } else if (partnershipShownRef.current) {
      // Leaving Partnership: play ITS exit animation first (280ms), THEN
      // unmount it and, after the same short breathing gap, bring the
      // score bar back — instead of yanking Partnership away and
      // snapping the score bar in at the same moment.
      setPartnershipClosing(true);
      exitTimer = setTimeout(() => {
        setPartnershipShown(false);
        returnTimer = setTimeout(() => setScoreBarShown(true), CROSSFADE_GAP_MS);
      }, PARTNERSHIP_EXIT_MS);
    } else {
      // Neither on screen nor mid-exit — just make sure the score bar is
      // showing (covers first mount / rapid re-toggles before either
      // timer above fired).
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

      {/* ---- Always-on overlays — logo, weather, score bar ---- */}
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

      {/* ---- One rotating dock point instead of three stacked cards,
          locked flush against the live score bar's top-right edge (see
          SCORE_BAR_DOCK_BOTTOM/RIGHT above) so it reads as one piece of
          furniture with the score bar instead of a card floating loose
          in the video. Only ever one of these is on screen at a time.
          Driven by effectiveActiveItem/effectiveClosing so a manual
          Preview selection (Demo Controls) overrides the auto rotation. ---- */}
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
          nothing fires just from the sim ticking. Its own demo buttons are
          meant to be hidden via hideDemoButtons since the header toolbar's
          moment buttons are the single intended trigger surface — but if
          you're still seeing "TEST FOUR / TEST SIX / ..." pills floating
          bottom-left, that prop isn't wired up on this component yet and
          it needs a look. */}
      <MatchMomentOverlay logoSrc={matchSetup.tournamentLogoUrl} hideDemoButtons />

      {/* ---- Modal-style overlays + celebration triggers + demo controls,
          all in one header toolbar. Each overlay ships its own trigger
          button; the moment buttons call fireMoment() directly; the gear
          icon at the end opens the sim controls as a dropdown instead of
          a separate fixed panel — nothing here floats over the score bar. ---- */}
      <div
        className="fixed top-5 left-1/2 -translate-x-1/2 z-[95] flex items-center gap-1 rounded-xl px-2 py-1.5 flex-wrap justify-center max-w-[92vw]"
        style={{ background: "rgba(8,8,10,0.72)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(6px)" }}
      >
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
        <FallOfWicketsStrip
          wickets={wickets}
          inningsLabel={liveState.inningsNumber === 1 ? "1st Innings" : "2nd Innings"}
        />
        {/* PointsTable reads standings live via usePointsTableLedger(auctionId)
            from Supabase — there's no prop override for offline data, so in
            a fully backend-free demo it renders its own empty/loading state.
            Still wired up so the trigger sits with the rest of the toolbar. */}
        <PointsTable auctionId="demo-auction" />

        <div className="w-px h-5 mx-1 shrink-0" style={{ background: "rgba(255,255,255,0.15)" }} />

        {/* ---- Moments — the 7 celebration triggers live inside one
            dropdown instead of as 7 separate boxed buttons in the nav.
            Trigger itself is flat/plain to match the other nav items
            (Match Center, Toss, ...); only the open panel gets chip
            styling, same as Demo below. ---- */}
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

        {/* ---- Demo Controls — a dropdown off the header instead of a
            fixed bottom-left panel, so it never sits over the score bar.
            Trigger is flat/plain, same reasoning as Moments above. ---- */}
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

              <ToggleRow label="Weather" checked={showWeather} onChange={setShowWeather} />
              <ToggleRow label="Score bar" checked={showScoreBar} onChange={setShowScoreBar} />
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
                hint="off = trigger manually above"
              />

              <div className="h-px my-1" style={{ background: "rgba(255,255,255,0.08)" }} />

              {/* ---- Preview — manually pin one dock item into view so
                  Boundaries / Run Rate / Partnership can be inspected on
                  demand, same as every other overlay's own trigger button,
                  instead of waiting on the rotation. Selecting a pinned
                  item also pauses useRotatingSlot's timers (see `paused`
                  above) so it doesn't get yanked away mid-preview. ---- */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Preview
                </span>
                <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                  pins the dock item
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setManualSlot("auto")}
                  className="px-2 py-1 rounded-md text-[9px] font-bold uppercase"
                  style={{
                    background: manualSlot === "auto" ? "rgba(201,151,31,0.3)" : "rgba(255,255,255,0.06)",
                    color: manualSlot === "auto" ? "#F2C766" : "rgba(255,255,255,0.6)",
                  }}
                >
                  Auto
                </button>
                {SLOT_PREVIEW_ITEMS.map(({ value, label }) => {
                  const disabled = value === "partnership" && !hasPartnership;
                  return (
                    <button
                      key={value}
                      onClick={() => !disabled && setManualSlot(value)}
                      disabled={disabled}
                      title={disabled ? "Needs a pair at the crease" : undefined}
                      className="px-2 py-1 rounded-md text-[9px] font-bold uppercase"
                      style={{
                        background: manualSlot === value ? "rgba(201,151,31,0.3)" : "rgba(255,255,255,0.06)",
                        color: disabled
                          ? "rgba(255,255,255,0.25)"
                          : manualSlot === value
                          ? "#F2C766"
                          : "rgba(255,255,255,0.6)",
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

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
                Boundaries / run-rate / partnership share one dock point and rotate automatically — use
                Preview above to pin one, or Auto to go back to rotation.
              </p>
            </div>
          )}
        </div>
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

// Small pill button used for the header's celebration triggers (four, six,
// wicket, fifty, hundred, maiden, match won). Kept separate from ToggleRow
// since these are one-shot actions, not persistent on/off state.
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