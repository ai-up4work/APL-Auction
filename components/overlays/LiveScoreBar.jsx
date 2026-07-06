"use client";

import { ChevronRight, ChevronDown, ChevronUp, Radio } from "lucide-react";
import { createPortal } from "react-dom";

import { useOverlayPanel } from "@/hooks/useOverlayPanel";
import { teamBlockClip, ambientGlow } from "@/lib/overlayTokens";
import { LIVE, VENUE, BALLS_PER_OVER, TOURNAMENT } from "@/lib/matchData";
import TeamBadge from "@/components/overlays/shared/TeamBadge";
import CricketBall from "@/components/overlays/shared/CricketBall";

// Tournament identity — appears on its own above the bar, not watermarked
// inside it.
const ENTRANCE_MS = 900;
const EXIT_MS = 650;
const SLANT_PX = 22; // how far the TeamBlock's inner edge leans, in px

// Cricket-ball styled chip: a small rendered sphere with a stitched seam
// (like an actual cricket ball) instead of a flat gradient circle.
// - Pops in with a little overshoot, staggered left-to-right so a fresh
//   over reads as a quick cascade rather than appearing all at once.
// - The most recently bowled ball gets a soft "live" pulse ring so the eye
//   knows where to look.
// - Boundaries get a slow diagonal shine sweep across the sphere.
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
    : undefined; // use CricketBall's default "leather" fill

  const seamColor = isBoundary ? "rgba(58,37,4,0.55)" : "rgba(255,255,255,0.5)";
  const labelColor = isWicket ? "#fff" : isBoundary ? "#3a2504" : isExtra ? "#2b2b2e" : "rgba(255,255,255,0.6)";

  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0 rounded-full ball-chip"
      style={{ width: 20, height: 20, animationDelay: isEmpty ? "0ms" : `${index * 70}ms` }}
    >
      {/* Live pulse ring — only on the most recently bowled ball */}
      {isLatest && !isEmpty && (
        <span
          className="absolute -inset-[3px] rounded-full pointer-events-none ball-pulse"
          style={{ border: `1.5px solid ${isWicket ? "#e2685a" : isBoundary ? "var(--color-theme-orange)" : "rgba(255,255,255,0.55)"}` }}
        />
      )}

      {isEmpty ? (
        <span className="w-full h-full rounded-full" style={{ border: "1px dashed rgba(255,255,255,0.22)" }} />
      ) : (
        <CricketBall
          size={20}
          fill={sphereFill}
          seamColor={seamColor}
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

// One consistent team block: crest anchored to the bar's outer edge, name +
// opponent label toward the center — used on both sides, just mirrored.
// Clipped into a one-sided rhombus/parallelogram: the outer edge (against
// the bar's rounded corner) stays vertical, the inner edge (facing the
// score/center) is cut on a diagonal.
function TeamBlock({ team, opponent, align, variant }) {
  const isRight = align === "right";

  return (
    <div
      className={`relative z-10 flex items-center gap-2.5 sm:gap-3 py-2.5 sm:py-3 shrink-0 ${
        isRight ? "flex-row-reverse pr-3 sm:pr-4 pl-7 sm:pl-9" : "pl-3 sm:pl-4 pr-7 sm:pr-9"
      }`}
      style={{
        background: `linear-gradient(${isRight ? "225deg" : "135deg"}, ${team.color} 0%, ${team.color}cc 100%)`,
        clipPath: teamBlockClip(SLANT_PX, align),
      }}
    >
      <TeamBadge team={team} variant={variant} sizeClass="w-9 h-9 sm:w-11 sm:h-11" framePadding="2px" />
      <div className={`leading-tight ${isRight ? "text-right" : "text-left"}`}>
        <p className="font-heading text-sm sm:text-lg font-black uppercase tracking-wide text-white">{team.short}</p>
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
  const { mounted, open, closing, toggle } = useOverlayPanel(show, EXIT_MS, { defaultOpen: true });

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
            <div
              className="lsb-wrap origin-center pointer-events-auto relative"
              style={{
                width: "90vw",
                animation: closing
                  ? `lsbBarOut ${EXIT_MS}ms cubic-bezier(0.4,0,0.8,1) both`
                  : `lsbBarIn ${ENTRANCE_MS}ms cubic-bezier(0.22,1,0.36,1) both`,
              }}
            >
              {/* Logo badge — holds big and low for the first ~30% of the
                  timeline, then shrinks and rises to sit on the bar's top
                  seam. */}
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

              <div
                className="absolute -inset-4 sm:-inset-5 blur-2xl rounded-[28px] pointer-events-none"
                style={{ background: ambientGlow(LIVE.battingTeam, LIVE.fieldingTeam) }}
              />

              <div
                className="relative p-[2px] sm:p-[3px] rounded-2xl sm:rounded-[22px]"
                style={{
                  background:
                    "linear-gradient(135deg, #f1efe9 0%, #b8ad93 14%, #6b6455 28%, #c9971f 42%, #4a453a 56%, #b8ad93 72%, #f1efe9 86%, #8a8272 100%)",
                  boxShadow:
                    "0 25px 50px -12px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.5)",
                }}
              >
                <div
                  className="relative rounded-[15px] sm:rounded-[19px] overflow-hidden shadow-2xl"
                  style={{
                    background: "linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-container-lowest) 100%)",
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at 6% 50%, ${LIVE.battingTeam.colorSoft} 0%, transparent 40%), radial-gradient(circle at 98% 50%, ${LIVE.fieldingTeam.colorSoft} 0%, transparent 32%)`,
                    }}
                  />

                  <div className="relative flex items-stretch">
                    <TeamBlock team={LIVE.battingTeam} opponent={LIVE.fieldingTeam} align="left" variant="blue" />

                    <div className="relative z-10 flex items-center px-2 sm:px-4 shrink-0">
                      <span
                        className="font-heading font-black text-xl sm:text-3xl tabular-nums leading-none"
                        style={{ color: "var(--color-on-surface)" }}
                      >
                        {LIVE.score}
                        <span style={{ color: "var(--color-outline)" }}>-{LIVE.wickets}</span>
                      </span>
                    </div>

                    <div className="relative z-10 flex items-center pr-2 sm:pr-4 shrink-0">
                      <div
                        className="flex flex-col items-center justify-center rounded-md px-1.5 sm:px-2.5 py-0.5 sm:py-1"
                        style={{ background: "rgba(59,139,212,0.18)", border: "1px solid rgba(59,139,212,0.4)" }}
                      >
                        <span className="text-[6px] sm:text-[7px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-outline)" }}>
                          Overs
                        </span>
                        <span className="font-heading font-black text-[10px] sm:text-xs tabular-nums leading-none" style={{ color: "var(--color-on-surface)" }}>
                          {LIVE.oversDone}.{LIVE.ballsDone}
                          <span style={{ color: "var(--color-outline)" }}>({LIVE.oversLimit})</span>
                        </span>
                      </div>
                    </div>

                    <div className="relative z-10 w-px my-2.5 shrink-0" style={{ background: "var(--color-border-overlay)" }} />

                    <div className="relative z-10 flex-1 flex items-center justify-center sm:justify-between gap-2 sm:gap-3 px-2 sm:px-5 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" style={{ color: "var(--color-theme-orange)" }} />
                        <span className="text-[11px] sm:text-base font-bold uppercase truncate" style={{ color: "var(--color-on-surface)" }}>
                          {LIVE.striker.name}
                        </span>
                        <span className="text-[11px] sm:text-base font-black tabular-nums shrink-0" style={{ color: "var(--color-theme-orange)" }}>
                          {LIVE.striker.runs}
                          <span className="text-[9px] sm:text-sm font-semibold" style={{ color: "var(--color-outline)" }}>
                            ({LIVE.striker.balls})
                          </span>
                        </span>
                      </div>

                      <div className="hidden sm:flex items-center gap-2.5 min-w-0">
                        <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--color-outline)" }} />
                        <span className="text-base font-bold uppercase truncate" style={{ color: "var(--color-on-surface-variant)" }}>
                          {LIVE.nonStriker.name}
                        </span>
                        <span className="text-base font-black tabular-nums shrink-0" style={{ color: "var(--color-on-surface)" }}>
                          {LIVE.nonStriker.runs}
                          <span className="text-sm font-semibold" style={{ color: "var(--color-outline)" }}>
                            ({LIVE.nonStriker.balls})
                          </span>
                        </span>
                      </div>
                    </div>

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

                    <TeamBlock team={LIVE.fieldingTeam} opponent={LIVE.battingTeam} align="right" variant="green" />
                  </div>

                  {/* Tear-seam */}
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
                        backgroundImage: "repeating-linear-gradient(90deg, var(--color-outline) 0 5px, transparent 5px 11px)",
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
                      <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-outline)" }}>
                        This Over
                      </span>
                      <div className="flex items-center gap-1">
                        {overChips.map((b, i) => (
                          <BallChip key={i} value={b} index={i} isLatest={i === latestBallIndex} />
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 text-center hidden sm:block">
                      <span className="text-[9px] font-bold tracking-[0.2em] uppercase truncate" style={{ color: "var(--color-on-surface-variant)" }}>
                        Live from{" "}
                        <span className="font-bold" style={{ color: "var(--color-theme-orange)" }}>
                          {VENUE}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto sm:ml-0">
                      <span className="text-[10px] sm:text-xs font-bold uppercase truncate" style={{ color: "var(--color-on-surface)" }}>
                        {LIVE.bowler.name}
                      </span>
                      <span className="text-[10px] sm:text-xs font-black tabular-nums shrink-0" style={{ color: "var(--color-theme-orange)" }}>
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

      {/* Component-specific animations only — font import, .font-heading,
          .shine-ring, and .ball-chip/.ball-pulse/.ball-shine live in
          lib/overlay-shared.css, imported once from app/globals.css. */}
      <style jsx>{`
        .origin-center {
          transform-origin: center;
        }

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

        @media (prefers-reduced-motion: reduce) {
          .lsb-wrap,
          .lsb-log-badge {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </>
  );
}