"use client";

import { ChevronRight, ChevronDown, ChevronUp, Radio } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { GOLD_BEZEL, ambientGlow, teamBlockClip } from "@/lib/overlayTokens";
import { LIVE, VENUE, BALLS_PER_OVER, TOURNAMENT } from "@/lib/matchData";
import CricketBall from "@/components/overlays/shared/CricketBall";

const OVERS_LABEL = `${LIVE.oversDone}.${LIVE.ballsDone}`;

// Single shared timeline for the entrance: the bare logo appears big and
// holds in place (where the bar will be) for the first ~30%, then for the
// rest of the duration it shrinks + rises to its resting spot above the bar
// while the bar explodes outward from center underneath it. The pill
// chrome (background/border) and the tournament name only fade in once the
// logo is most of the way through its rise, so the logo visually leads and
// the label/pill "arrives" after it. Exit reverses the same beats, faster.
const ENTRANCE_MS = 900;
const EXIT_MS = 650;

// Cricket-ball styled chip: a small rendered sphere with a stitched seam
// (like an actual cricket ball) instead of a flat gradient circle.
// - Pops in with a little overshoot, staggered left-to-right so a fresh
//   over reads as a quick cascade rather than appearing all at once.
// - The most recently bowled ball gets a soft "live" pulse ring so the eye
//   knows where to look.
// - Boundaries get a slow diagonal shine sweep across the sphere.
//
// The sphere itself is now the shared CricketBall component — this used
// to hand-draw its own gradient circle + seam SVG locally, duplicating
// exactly what CricketBall already does (same gradient stops, same seam
// path, same box-shadow). CricketBall's own default fill matches the
// plain/dot gradient this used to hardcode, so that case now just omits
// `fill` and lets the component fall back to it.
function BallChip({ value, index = 0, isLatest = false }) {
  const isEmpty = value == null;
  const isWicket = value === "W";
  const isExtra = value === "wd" || value === "nb";
  const isBoundary = value === "4" || value === "6";
  const isDot = value === ".";

  const sphereFill = isWicket
    ? "radial-gradient(circle at 32% 26%, #f0a091 0%, #cf4a37 42%, #7c1d13 88%, #5c130c 100%)"
    : isBoundary
    ? "radial-gradient(circle at 32% 26%, #fff3d1 0%, #ffcf6b 30%, var(--color-theme-orange) 68%, #8a5c0d 100%)"
    : isExtra
    ? "radial-gradient(circle at 32% 26%, #f3f3f3 0%, #cfcfd2 45%, #8f8f95 85%, #6b6b70 100%)"
    : undefined; // use CricketBall's default "leather" fill — identical gradient to what was hardcoded here before

  const seamColor = isBoundary ? "rgba(58,37,4,0.55)" : "rgba(255,255,255,0.5)";
  const labelColor = isWicket ? "#fff" : isBoundary ? "#3a2504" : isExtra ? "#2b2b2e" : "rgba(255,255,255,0.6)";

  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0 rounded-full ball-chip"
      style={{
        width: 20,
        height: 20,
        animationDelay: isEmpty ? "0ms" : `${index * 70}ms`,
      }}
    >
      {/* Live pulse ring — only on the most recently bowled ball */}
      {isLatest && !isEmpty && (
        <span
          className="absolute -inset-[3px] rounded-full pointer-events-none ball-pulse"
          style={{ border: `1.5px solid ${isWicket ? "#e2685a" : isBoundary ? "var(--color-theme-orange)" : "rgba(255,255,255,0.55)"}` }}
        />
      )}

      {isEmpty ? (
        <span
          className="w-full h-full rounded-full"
          style={{ border: "1px dashed rgba(255,255,255,0.22)" }}
        />
      ) : (
        <CricketBall
          size={20}
          fill={sphereFill}
          seamColor={seamColor}
          seamWidth={0.9}
          className={isBoundary ? "ball-shine" : ""}
        >
          <span className="font-heading font-black uppercase" style={{ fontSize: 8.5, color: labelColor }}>
            {isDot ? "•" : value}
          </span>
        </CricketBall>
      )}
    </span>
  );
}

// Circular medallion crest with the same shine-ring treatment used on the
// intro/scorecard cards. Takes an explicit `variant` ("blue" | "green")
// rather than comparing the team object's identity against a hardcoded
// constant, since team data now comes from lib/matchData instead of a
// local TEAM_A/TEAM_B pair this file used to own.
function TeamCrest({ team, variant }) {
  return (
    <div className="relative w-9 h-9 sm:w-11 sm:h-11 shrink-0">
      <div className={`shine-ring shine-ring-${variant}`} />
      <div
        className="relative w-full h-full rounded-full p-[2px] shadow-lg"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(120,120,120,0.55) 45%, rgba(0,0,0,0.4) 100%)",
        }}
      >
        <div className="relative w-full h-full rounded-full overflow-hidden bg-black">
          <img src={team.image} alt={team.name} className="w-full h-full object-cover" />
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.04) 30%, transparent 55%)",
            }}
          />
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ boxShadow: "inset 0 -5px 9px rgba(0,0,0,0.45)" }}
          />
        </div>
      </div>
    </div>
  );
}

// One consistent team block: crest anchored to the bar's outer edge, name +
// opponent label toward the center — used on both sides, just mirrored.
// The block is clipped into a one-sided rhombus/parallelogram: the outer
// edge (against the bar's rounded corner) stays vertical, the inner edge
// (facing the score/center) is cut on a diagonal so the two team panels
// read as angled wedges rather than flat rectangles.
const SLANT_PX = 22; // how far the inner edge leans, in px

function TeamBlock({ team, opponent, align, variant }) {
  const isRight = align === "right";

  // Diagonal cut on the edge facing the center of the bar — was a locally
  // hand-typed polygon() ternary that matched teamBlockClip()'s formula
  // exactly; now calls the shared helper instead of re-deriving the math.
  const clipPath = teamBlockClip(SLANT_PX, align);

  return (
    <div
      className={`relative z-10 flex items-center gap-2.5 sm:gap-3 py-2.5 sm:py-3 shrink-0 ${
        isRight
          ? "flex-row-reverse pr-3 sm:pr-4 pl-7 sm:pl-9"
          : "pl-3 sm:pl-4 pr-7 sm:pr-9"
      }`}
      style={{
        background: `linear-gradient(${isRight ? "225deg" : "135deg"}, ${team.color} 0%, ${team.color}cc 100%)`,
        clipPath,
      }}
    >
      <TeamCrest team={team} variant={variant} />
      <div className={`leading-tight ${isRight ? "text-right" : "text-left"}`}>
        <p className="font-heading text-sm sm:text-lg font-black uppercase tracking-wide text-white">
          {team.short}
        </p>
        <p className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wide text-white/65">
          v {opponent.short}
        </p>
      </div>
    </div>
  );
}

/**
 * LiveScoreBar — remote-controllable, same pattern as PointsTable:
 *   - `show` (boolean | undefined): when provided, drives the bar
 *     open/closed externally (e.g. from a bus event). When omitted
 *     (undefined), the component behaves exactly as before — it opens
 *     itself on mount and can be dismissed/reopened via its own controls.
 *   - `hideTrigger`: hides the on-screen "Show Score" reopen pill and the
 *     in-bar dismiss chevron, for use on the OBS-facing overlay page where
 *     there's no one to click them and no reason for on-stream controls.
 */
export default function LiveScoreBar({ show, hideTrigger = false }) {
  const [mounted, setMounted] = useState(false);
  // Self-contained default (no `show` prop passed) keeps its old
  // behavior of appearing immediately; once `show` is provided it takes
  // over via the effect below.
  const [open, setOpen] = useState(show ?? true);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const openBar = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setClosing(false);
    setOpen(true);
  }, []);

  const closeBar = useCallback(() => {
    setClosing((alreadyClosing) => {
      if (alreadyClosing) return true;
      closeTimer.current = setTimeout(() => {
        setOpen(false);
        setClosing(false);
      }, EXIT_MS);
      return true;
    });
  }, []);

  const toggle = useCallback(() => {
    if (open && !closing) closeBar();
    else if (!open) openBar();
  }, [open, closing, openBar, closeBar]);

  // External control — only takes effect when `show` is actually passed.
  useEffect(() => {
    if (show === undefined) return;
    if (show) openBar();
    else closeBar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // Pad the current over out to a full 6 balls with hollow placeholders.
  const overChips = [
    ...LIVE.thisOver,
    ...Array(Math.max(0, BALLS_PER_OVER - LIVE.thisOver.length)).fill(null),
  ];
  const latestBallIndex = LIVE.thisOver.length - 1;

  return (
    <>
      {!hideTrigger && mounted && !open && !closing && (
        <button
          onClick={toggle}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[101] flex items-center gap-2 px-4 py-2 rounded-full shadow-xl"
          style={{
            background: "var(--color-surface-container-lowest)",
            border: "1px solid var(--color-border-overlay)",
            color: "var(--color-on-surface-variant)",
          }}
        >
          <Radio className="w-4 h-4" style={{ color: "var(--color-theme-orange)" }} />
          <span className="text-xs font-bold uppercase tracking-wider">Show Score</span>
          <ChevronUp className="w-4 h-4" />
        </button>
      )}

      {mounted &&
        open &&
        createPortal(
          <div
            className="fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center px-2 pb-3 sm:pb-5 pointer-events-none"
            aria-live="polite"
          >
            {/* The bar — stays collapsed to a sliver while the logo holds
                big, then explodes outward from its own horizontal center
                once the logo starts rising. Sized to a true 90% of the
                viewport width (vw), not 90% of an already-padded parent. */}
            <div
              className="lsb-wrap origin-center pointer-events-auto relative"
              style={{
                width: "90vw",
                animation: closing
                  ? `lsbBarOut ${EXIT_MS}ms cubic-bezier(0.4,0,0.8,1) both`
                  : `lsbBarIn ${ENTRANCE_MS}ms cubic-bezier(0.22,1,0.36,1) both`,
              }}
            >
              {/* Logo badge — just the logo, no name, no pill. It holds
                  big (~15% of the viewport height) and low (roughly the
                  bar's own center) for the first ~30% of the timeline, then
                  shrinks and rises so it ends up sitting dead-center on the
                  bar's top seam, half over the bezel and half above it —
                  popping out of the middle of the card rather than floating
                  separately above it. Size is animated directly (not via
                  transform: scale) so the big entrance state can be pinned
                  to a viewport-relative size independent of the resting
                  badge size. */}
              <div className="absolute left-1/2 top-0 z-20">
                <div
                  className="lsb-log-badge [--badge-rest:56px] sm:[--badge-rest:76px] rounded-full overflow-hidden flex items-center justify-center"
                  style={{
                    padding: "12%",
                    background: "rgba(12,16,26,0.85)",
                    border: "1px solid rgba(201,151,31,0.5)",
                    boxShadow: "0 10px 24px -8px rgba(0,0,0,0.6)",
                    animation: closing
                      ? `lsbLogOut ${EXIT_MS}ms cubic-bezier(0.4,0,0.8,1) both`
                      : `lsbLogIn ${ENTRANCE_MS}ms cubic-bezier(0.22,1,0.36,1) both`,
                  }}
                >
                  <img
                    src={TOURNAMENT.logo}
                    alt={TOURNAMENT.name}
                    className="w-full h-full object-contain"
                    style={{ filter: "grayscale(1) contrast(1.3) brightness(1.7)" }}
                  />
                </div>
              </div>

              {/* Ambient glow — same gold-led, team-tinted treatment as the
                  intro/scorecard cards. Now sourced from the shared
                  overlayTokens ambientGlow() helper instead of a locally
                  hand-typed duplicate of the same gradient. */}
              <div
                className="absolute -inset-4 sm:-inset-5 blur-2xl rounded-[28px] pointer-events-none"
                style={{
                  background: ambientGlow(LIVE.battingTeam, LIVE.fieldingTeam),
                }}
              />

              {/* Metallic bezel — the same brushed-steel/gold frame used on
                  the scorecard's plaque, wrapped around the whole bar. Now
                  sourced from the shared overlayTokens GOLD_BEZEL instead
                  of a locally hand-typed duplicate. */}
              <div
                className="relative p-[2px] sm:p-[3px] rounded-2xl sm:rounded-[22px]"
                style={{
                  background: GOLD_BEZEL,
                  boxShadow:
                    "0 25px 50px -12px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.5)",
                }}
              >
                <div
                  className="relative rounded-[15px] sm:rounded-[19px] overflow-hidden shadow-2xl"
                  style={{
                    background:
                      "linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-container-lowest) 100%)",
                  }}
                >
                  {/* Soft localized team glows only */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at 6% 50%, ${LIVE.battingTeam.colorSoft} 0%, transparent 40%), radial-gradient(circle at 98% 50%, ${LIVE.fieldingTeam.colorSoft} 0%, transparent 32%)`,
                    }}
                  />

                  {/* Main row */}
                  <div className="relative flex items-stretch">
                    {/* Batting team block */}
                    <TeamBlock team={LIVE.battingTeam} opponent={LIVE.fieldingTeam} align="left" />

                    {/* Score */}
                    <div className="relative z-10 flex items-center px-2 sm:px-4 shrink-0">
                      <span
                        className="font-heading font-black text-xl sm:text-3xl tabular-nums leading-none"
                        style={{ color: "var(--color-on-surface)" }}
                      >
                        {LIVE.score}
                        <span style={{ color: "var(--color-outline)" }}>-{LIVE.wickets}</span>
                      </span>
                    </div>

                    {/* Overs pill */}
                    <div className="relative z-10 flex items-center pr-2 sm:pr-4 shrink-0">
                      <div
                        className="flex flex-col items-center justify-center rounded-lg px-2 sm:px-3 py-1 sm:py-1.5"
                        style={{
                          background: "linear-gradient(160deg, rgba(201,151,31,0.16) 0%, rgba(201,151,31,0.05) 100%)",
                          border: "1px solid rgba(201,151,31,0.35)",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                        }}
                      >
                        <span
                          className="text-[6px] sm:text-[7px] font-bold uppercase tracking-[0.18em]"
                          style={{ color: "var(--color-theme-orange)", opacity: 0.85 }}
                        >
                          Overs
                        </span>
                        <span
                          className="font-heading font-black text-[11px] sm:text-sm tabular-nums leading-none"
                          style={{ color: "var(--color-on-surface)" }}
                        >
                          {OVERS_LABEL}
                          <span
                            className="text-[9px] sm:text-[11px] font-semibold"
                            style={{ color: "var(--color-outline)" }}
                          >
                            /{LIVE.oversLimit}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="relative z-10 w-px my-2.5 shrink-0" style={{ background: "var(--color-border-overlay)" }} />

                    {/* Batters — split into two groups pushed toward the
                        outer edges of this section (justify-between) so
                        the true center stays clear underneath the popped-
                        out logo badge above the bar. On mobile, only the
                        striker group is shown, centered as before. */}
                    <div className="relative z-10 flex-1 flex items-center justify-center sm:justify-between gap-2 sm:gap-3 px-2 sm:px-5 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" style={{ color: "var(--color-theme-orange)" }} />
                        <span
                          className="text-[11px] sm:text-base font-bold uppercase truncate"
                          style={{ color: "var(--color-on-surface)" }}
                        >
                          {LIVE.striker.name}
                        </span>
                        <span
                          className="text-[11px] sm:text-base font-black tabular-nums shrink-0"
                          style={{ color: "var(--color-theme-orange)" }}
                        >
                          {LIVE.striker.runs}
                          <span className="text-[9px] sm:text-sm font-semibold" style={{ color: "var(--color-outline)" }}>
                            ({LIVE.striker.balls})
                          </span>
                        </span>
                      </div>

                      <div className="hidden sm:flex items-center gap-2.5 min-w-0">
                        <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--color-outline)" }} />
                        <span
                          className="text-base font-bold uppercase truncate"
                          style={{ color: "var(--color-on-surface-variant)" }}
                        >
                          {LIVE.nonStriker.name}
                        </span>
                        <span
                          className="text-base font-black tabular-nums shrink-0"
                          style={{ color: "var(--color-on-surface)" }}
                        >
                          {LIVE.nonStriker.runs}
                          <span className="text-sm font-semibold" style={{ color: "var(--color-outline)" }}>
                            ({LIVE.nonStriker.balls})
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Dismiss control — hidden on the OBS-facing overlay
                        page (hideTrigger) since there's no one to click it
                        and it shouldn't render as an on-stream control. */}
                    {!hideTrigger && (
                      <button
                        onClick={toggle}
                        className="relative z-10 flex items-center justify-center px-2 sm:px-2.5 shrink-0 transition-colors"
                        style={{ color: "var(--color-outline)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-theme-orange)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-outline)")}
                        aria-label="Hide score bar"
                      >
                        <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    )}

                    {/* Fielding team block — identical treatment, mirrored */}
                    <TeamBlock team={LIVE.fieldingTeam} opponent={LIVE.battingTeam} align="right" />
                  </div>

                  {/* Tear-seam — bite-notch circles + dashed perforation,
                      same "ticket stub" device used on the scorecard and
                      intro footers */}
                  <div className="relative">
                    <div
                      className="absolute -left-[9px] top-0 w-[18px] h-[18px] rounded-full -translate-y-1/2"
                      style={{ background: "rgba(8,8,10,0.94)", boxShadow: "inset -2px 0 4px rgba(0,0,0,0.5)" }}
                    />
                    <div
                      className="absolute -right-[9px] top-0 w-[18px] h-[18px] rounded-full -translate-y-1/2"
                      style={{ background: "rgba(8,8,10,0.94)", boxShadow: "inset 2px 0 4px rgba(0,0,0,0.5)" }}
                    />
                    <div
                      className="h-px w-full"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(90deg, var(--color-outline) 0 5px, transparent 5px 11px)",
                        opacity: 0.5,
                      }}
                    />
                  </div>

                  {/* Ticker row */}
                  <div
                    className="relative flex items-center gap-2.5 sm:gap-5 px-3 sm:px-5 py-1.5 sm:py-2"
                    style={{ background: "var(--color-surface-container-lowest)" }}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <span
                        className="text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.18em]"
                        style={{ color: "var(--color-outline)" }}
                      >
                        This Over
                      </span>
                      <div className="flex items-center gap-1">
                        {overChips.map((b, i) => (
                          <BallChip key={i} value={b} index={i} isLatest={i === latestBallIndex} />
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 text-center hidden sm:block">
                      <span
                        className="text-[9px] font-bold tracking-[0.2em] uppercase truncate"
                        style={{ color: "var(--color-on-surface-variant)" }}
                      >
                        Live from <span className="font-bold" style={{ color: "var(--color-theme-orange)" }}>
                          {VENUE}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto sm:ml-0">
                      <span
                        className="text-[10px] sm:text-xs font-bold uppercase truncate"
                        style={{ color: "var(--color-on-surface)" }}
                      >
                        {LIVE.bowler.name}
                      </span>
                      <span
                        className="text-[10px] sm:text-xs font-black tabular-nums shrink-0"
                        style={{ color: "var(--color-theme-orange)" }}
                      >
                        {LIVE.bowler.wickets}-{LIVE.bowler.runsConceded}
                        <span className="text-[9px] sm:text-[11px] font-semibold" style={{ color: "var(--color-outline)" }}>
                          {" "}
                          ({LIVE.bowler.overs})
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Montserrat:wght@800;900&display=swap");

        .font-heading {
          font-family: "Montserrat", sans-serif;
        }

        .origin-center {
          transform-origin: center;
        }

        /* Logo badge: pops out of the middle of the card. It starts big
           (~15% of the viewport height) and centered roughly in the middle
           of the bar's own footprint (translateY pulls it down into that
           space), holds there through the first third of the timeline,
           then shrinks down to the resting badge size (--badge-rest) and
           rises to sit dead-center on the bar's top seam. Width/height are
           animated directly rather than via transform: scale so the big
           state can be pinned to an absolute, viewport-relative size. The
           translate(-50%, -50%) is baked into every step so the badge
           always stays centered on its anchor point at the horizontal
           middle of the bar. */
        @keyframes lsbLogIn {
          0% { opacity: 0; width: 15vh; height: 15vh; transform: translate(-50%, -50%) translateY(40px); }
          32% { opacity: 1; width: 15vh; height: 15vh; transform: translate(-50%, -50%) translateY(40px); }
          100% { opacity: 1; width: var(--badge-rest, 64px); height: var(--badge-rest, 64px); transform: translate(-50%, -50%) translateY(0); }
        }
        @keyframes lsbLogOut {
          0% { opacity: 1; width: var(--badge-rest, 64px); height: var(--badge-rest, 64px); transform: translate(-50%, -50%) translateY(0); }
          55% { opacity: 1; width: 15vh; height: 15vh; transform: translate(-50%, -50%) translateY(40px); }
          100% { opacity: 0; width: 15vh; height: 15vh; transform: translate(-50%, -50%) translateY(40px); }
        }

        /* Bar: stays collapsed to nothing while the logo holds big, then
           explodes outward from center once the logo starts rising. */
        @keyframes lsbBarIn {
          0% { opacity: 0; transform: scaleX(0); }
          32% { opacity: 0; transform: scaleX(0); }
          100% { opacity: 1; transform: scaleX(1); }
        }
        @keyframes lsbBarOut {
          0% { opacity: 1; transform: scaleX(1); }
          55% { opacity: 1; transform: scaleX(0); }
          100% { opacity: 0; transform: scaleX(0); }
        }

        /* Shine ring — rotating conic-gradient arc masked to a thin ring,
           same device used around the team badges on the intro/scorecard
           cards. */
        .shine-ring {
          position: absolute;
          inset: -5px;
          border-radius: 9999px;
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
          animation: lsbSpin 3.5s linear infinite;
        }
        .shine-ring-blue {
          background: conic-gradient(
            from 0deg,
            transparent 0%,
            transparent 78%,
            rgba(59, 139, 212, 0.9) 92%,
            #9ecbf0 98%,
            transparent 100%
          );
        }
        .shine-ring-green {
          background: conic-gradient(
            from 180deg,
            transparent 0%,
            transparent 78%,
            rgba(42, 157, 92, 0.9) 92%,
            #8fe0b0 98%,
            transparent 100%
          );
        }
        @keyframes lsbSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Ball chips ("this over" row) */
        .ball-chip {
          animation: ballPopIn 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes ballPopIn {
          0% { opacity: 0; transform: scale(0.3) rotate(-25deg); }
          65% { opacity: 1; transform: scale(1.15) rotate(4deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        .ball-pulse {
          animation: ballPulse 1.6s ease-out infinite;
        }
        @keyframes ballPulse {
          0% { opacity: 0.9; transform: scale(0.85); }
          70% { opacity: 0; transform: scale(1.35); }
          100% { opacity: 0; transform: scale(1.35); }
        }
        .ball-shine::before {
          content: "";
          position: absolute;
          top: -60%;
          left: -60%;
          width: 60%;
          height: 220%;
          background: linear-gradient(
            100deg,
            transparent 0%,
            rgba(255, 255, 255, 0.75) 45%,
            transparent 90%
          );
          transform: rotate(20deg);
          animation: ballShineSweep 2.6s ease-in-out infinite;
        }
        @keyframes ballShineSweep {
          0% { left: -60%; }
          45% { left: 130%; }
          100% { left: 130%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ball-chip,
          .ball-pulse,
          .ball-shine::before {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
            animation-iteration-count: 1 !important;
          }
          .lsb-wrap,
          .lsb-log-badge {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
          .shine-ring {
            animation-duration: 1ms !important;
          }
        }
      `}</style>
    </>
  );
}