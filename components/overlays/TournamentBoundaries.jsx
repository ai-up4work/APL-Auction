"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

// Boundary stat — the same stitched-seam gold sphere from LiveScoreBar's
// "this over" ticker, paired with a number-over-caption stack so it reads
// as a proper stat, while staying short enough to fit one thin row. Each
// stat pops its sphere in with a little overshoot, then its number/label
// settle in right after — a smaller echo of the ball-chip cascade in the
// "this over" ticker.
function BoundaryStat({ label, value, delay, closing }) {
  return (
    <span className="tb-stat relative flex items-center gap-1.5 sm:gap-2 shrink-0">
      <span
        className="tb-sphere relative w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden shrink-0"
        style={{
          background:
            "radial-gradient(circle at 32% 26%, #ffffff 0%, var(--color-tertiary, #dce4ff) 30%, var(--color-tertiary-container, #adc6ff) 68%, var(--color-on-primary-fixed-variant, #3a4156) 100%)",
          border: "1px solid rgba(0,0,0,0.35)",
          boxShadow: "inset 0 -2px 3px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.3)",
          animation: closing
            ? "tbSphereOut 0.16s ease-in both"
            : `tbSphereIn 0.45s cubic-bezier(0.34,1.56,0.64,1) ${delay}s both`,
        }}
      >
        <svg viewBox="0 0 20 20" className="absolute inset-0 w-full h-full" style={{ opacity: 0.75 }}>
          <path d="M3,2 Q9,10 3,18" stroke="rgba(42,52,74,0.55)" strokeWidth="1" strokeDasharray="1.1 1.3" fill="none" strokeLinecap="round" />
          <path d="M17,2 Q11,10 17,18" stroke="rgba(42,52,74,0.55)" strokeWidth="1" strokeDasharray="1.1 1.3" fill="none" strokeLinecap="round" />
        </svg>
      </span>
      <span
        className="leading-none"
        style={{
          animation: closing
            ? "tbFadeOut 0.14s ease-in both"
            : `tbTextIn 0.4s cubic-bezier(0.22,1,0.36,1) ${delay + 0.08}s both`,
        }}
      >
        <span
          className="font-heading font-black text-sm sm:text-lg tabular-nums leading-none block"
          style={{ color: "var(--color-on-surface, #eef0f4)" }}
        >
          {value}
        </span>
        <span
          className="text-[6.5px] sm:text-[7.5px] font-bold uppercase tracking-[0.16em] block mt-0.5"
          style={{ color: "var(--color-outline, #7a8194)" }}
        >
          {label}
        </span>
      </span>
    </span>
  );
}

// How far the left edge leans, in px — same "wedge" idea as LiveScoreBar's
// TeamBlock diagonal cut, and identical to MatchBoundaries' own edge so
// the two read as the same object in two states, not two different cards.
const SLANT_PX = 30;

/**
 * TournamentBoundaries — the season-long sibling of MatchBoundaries. Same
 * shape, same size, same entrance/exit choreography, same dock point
 * (bottom-right, just above the live score bar) — the eyebrow reads
 * "Tournament" instead of "Match Boundaries", the numbers behind it are
 * the competition-wide totals rather than this match's, and the accent
 * swaps from the match card's warm gold to a cool steel-blue pulled from
 * the theme's existing secondary/tertiary tokens (var(--color-tertiary),
 * var(--color-tertiary-container), var(--color-on-primary-fixed-variant))
 * so the two are distinguishable at a glance even in the same corner.
 *
 * These two are meant to occupy the same slot, not sit side by side —
 * swap one out (closing) as the other swaps in when the broadcast wants
 * to flip from match-level to tournament-level context.
 */
export default function TournamentBoundaries({ fours = 0, sixes = 0, closing = false }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  // Left edge cut on a steep diagonal (echoing LiveScoreBar's team-block
  // wedges); right side keeps the small cut-corner "plaque" treatment
  // used on the Scorecard/Points Table bezels.
  const clip = `polygon(${SLANT_PX}px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)`;
  const clipInner = `polygon(${SLANT_PX - 2}px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%)`;

  return createPortal(
    <div
      className={`tb-wrap fixed z-[90] pointer-events-none ${closing ? "tb-closing" : ""}`}
      // Hard-pinned bottom-right, clearing the live score bar's own
      // height — identical dock point to MatchBoundaries, on purpose.
      style={{ bottom: "152px", right: "5vw" }}
    >
      {/* Metallic bezel — same brushed-steel/gold plaque frame as the
          Scorecard and Points Table cards, shrunk to strip scale, with a
          steep diagonal cut on the left edge instead of a square corner. */}
      <div
        className="relative p-[2px] sm:p-[2.5px]"
        style={{
          background:
            "linear-gradient(135deg, #eef1f6 0%, #b9c3d9 14%, #5f6b85 28%, #6f86c9 42%, #333a4d 56%, #b9c3d9 72%, #eef1f6 86%, #7c879e 100%)",
          boxShadow: "0 12px 26px -8px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.35)",
          clipPath: clip,
          WebkitClipPath: clip,
        }}
      >
        <div
          className="relative flex items-center gap-2.5 sm:gap-3.5 pl-5 pr-3 sm:pl-6 sm:pr-4 py-1.5 sm:py-2 overflow-hidden"
          style={{
            background: "linear-gradient(180deg, var(--color-surface, #0e1420) 0%, var(--color-surface-container-lowest, #080b12) 100%)",
            clipPath: clipInner,
            WebkitClipPath: clipInner,
          }}
        >
          {/* One-shot glint — a soft diagonal highlight that sweeps across
              the bezel once, right as the card finishes landing, like
              light catching brushed metal. Skipped on exit. */}
          {!closing && <span className="tb-glint absolute inset-0 pointer-events-none" />}

          <span
            className="tb-eyebrow text-[7.5px] sm:text-[8.5px] font-bold uppercase tracking-[0.2em] whitespace-nowrap shrink-0"
            style={{
              color: "var(--color-tertiary-container, #adc6ff)",
              animation: closing
                ? "tbFadeOut 0.14s ease-in both"
                : "tbEyebrowIn 0.4s cubic-bezier(0.22,1,0.36,1) 0.05s both",
            }}
          >
            Tournament
          </span>

          <span
            className="tb-hairline w-px h-4 sm:h-5 shrink-0"
            style={{
              background: "linear-gradient(180deg, transparent, rgba(173,198,255,0.55), transparent)",
              animation: closing
                ? "tbFadeOut 0.12s ease-in both"
                : "tbHairlineIn 0.35s cubic-bezier(0.22,1,0.36,1) 0.16s both",
            }}
          />

          <BoundaryStat label="Fours" value={fours} delay={0.24} closing={closing} />
          <BoundaryStat label="Sixes" value={sixes} delay={0.34} closing={closing} />
        </div>
      </div>

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&display=swap");

        .font-heading {
          font-family: "Montserrat", sans-serif;
        }

        /* Wrap: wipes in from the right along its own diagonal — a slight
           rotate + scale settling into place, echoing the slanted left
           edge rather than a plain straight-line slide. Exit reverses the
           motion about twice as fast, wiping back out the same way. */
        .tb-wrap {
          transform-origin: right center;
          animation: tbWrapIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .tb-wrap.tb-closing {
          animation: tbWrapOut 0.3s cubic-bezier(0.4, 0, 1, 1) both;
        }
        @keyframes tbWrapIn {
          0% { opacity: 0; transform: translateX(46px) scale(0.88) rotate(3deg); }
          65% { opacity: 1; transform: translateX(-4px) scale(1.015) rotate(-0.4deg); }
          100% { opacity: 1; transform: translateX(0) scale(1) rotate(0deg); }
        }
        @keyframes tbWrapOut {
          from { opacity: 1; transform: translateX(0) scale(1) rotate(0deg); }
          to { opacity: 0; transform: translateX(34px) scale(0.9) rotate(2.5deg); }
        }

        @keyframes tbEyebrowIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tbHairlineIn {
          from { opacity: 0; transform: scaleY(0); }
          to { opacity: 1; transform: scaleY(1); }
        }
        @keyframes tbSphereIn {
          0% { opacity: 0; transform: scale(0.35) rotate(-30deg); }
          65% { opacity: 1; transform: scale(1.15) rotate(5deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes tbSphereOut {
          from { opacity: 1; transform: scale(1) rotate(0deg); }
          to { opacity: 0; transform: scale(0.7) rotate(-10deg); }
        }
        @keyframes tbTextIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tbFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        /* Glint — a single diagonal light sweep across the bezel, timed to
           arrive just as the card finishes settling into place. */
        .tb-glint {
          background: linear-gradient(
            100deg,
            transparent 0%,
            transparent 42%,
            rgba(255, 255, 255, 0.16) 50%,
            transparent 58%,
            transparent 100%
          );
          transform: translateX(-120%);
          animation: tbGlintSweep 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.35s both;
        }
        @keyframes tbGlintSweep {
          from { transform: translateX(-120%); }
          to { transform: translateX(120%); }
        }

        @media (prefers-reduced-motion: reduce) {
          .tb-wrap,
          .tb-eyebrow,
          .tb-hairline,
          .tb-stat,
          .tb-sphere,
          .tb-glint {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}