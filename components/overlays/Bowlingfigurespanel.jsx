// components/overlays/Bowlingfigurespanel.jsx
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

// Sibling to RunRatePanel / MatchBoundaries — a corner-docked card, NOT a
// full-screen modal like CricketScorecard. Shows the CURRENT bowler's
// live figures (overs / maidens / runs / wickets / economy), plus which
// team they're bowling for and the batting side's live score — economy
// rate is the one stat CricketScorecard's modal doesn't carry (its
// `figures` column only has W-R, no ECO), and bowling figures generally
// are the one thing LiveScoreBar/PartnershipTracker don't show at all
// (they're both about batters).
//
// Deliberately does NOT show the full bowling attack — just whoever's
// bowling the current over, since that's the only bowler whose figures
// are actually changing ball-to-ball live. A full attack table already
// exists in the scorecard modal; this isn't trying to replace that.

export const BOWLING_FIGURES_DEFAULTS = {
  bottom: "48px",
  right: "5vw",
};

const GOLD = "var(--color-theme-orange, #c9971f)";

function economyOf(runs, overs, balls) {
  const ballsBowled = (overs || 0) * 6 + (balls || 0);
  if (ballsBowled <= 0) return "0.00";
  return ((runs / ballsBowled) * 6).toFixed(2);
}

/**
 * BowlingFiguresPanel — same stateless-card pattern as RunRatePanel /
 * MatchBoundaries: the parent hands it fresh numbers every ball, it just
 * renders them. Dock position follows the same bottom/right (or
 * `center`) convention as the rest of the corner-card family, so it can
 * slot into the same rotating dock point as Boundaries/Run Rate, or dock
 * centered like Partnership — parent's choice.
 */
export default function BowlingFiguresPanel({
  bowler, // { name, overs, balls, maidens, runs, wickets }
  team, // bowling side — { name, shortCode, color, logoUrl }
  opponent, // batting side — { shortCode }
  battingScore, // { runs, wickets } — the batting team's live total
  closing = false,
  center = false, // true = same bottom offset, horizontally centered instead of right-aligned (same convention as PartnershipTracker)
  bottom = BOWLING_FIGURES_DEFAULTS.bottom,
  right = BOWLING_FIGURES_DEFAULTS.right,
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !bowler) return null;

  const oversLabel = `${bowler.overs ?? 0}.${bowler.balls ?? 0}`;
  const eco = economyOf(bowler.runs ?? 0, bowler.overs ?? 0, bowler.balls ?? 0);
  const scoreLabel = battingScore ? `${battingScore.runs}-${battingScore.wickets}` : "0-0";

  const wrapClassName = center
    ? `bfp-wrap bfp-dock-center fixed z-[90] pointer-events-none ${closing ? "bfp-closing" : ""}`
    : `bfp-wrap fixed z-[90] pointer-events-none ${closing ? "bfp-closing" : ""}`;
  // Same reasoning as PartnershipTracker's wrapStyle: centered mode still
  // docks to `bottom`, only the horizontal axis changes (right -> 50%),
  // with translateX(-50%) baked into the keyframes below rather than set
  // statically, since a static transform and an animated one don't mix
  // cleanly on the same property otherwise.
  const wrapStyle = center ? { bottom, left: "50%" } : { bottom, right };

  return createPortal(
    <div className={wrapClassName} style={wrapStyle}>
      <div className="flex items-stretch gap-2.5 sm:gap-3">
        {/* Figures table */}
        <div
          className="bfp-card relative w-[min(84vw,400px)] rounded-[10px] overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, var(--color-surface, #141a24) 0%, var(--color-surface-container-lowest, #0a0d13) 100%)",
            boxShadow: "0 16px 32px -10px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* top accent line — same treatment as PartnershipTracker */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: `linear-gradient(90deg, ${GOLD} 0%, rgba(201,151,31,0.28) 65%, transparent 100%)` }}
          />

          {/* header row */}
          <div className="grid grid-cols-[1fr_repeat(5,minmax(24px,auto))] gap-x-2.5 sm:gap-x-3.5 px-4 sm:px-5 pt-3 pb-2">
            <span
              className="text-[8.5px] sm:text-[9.5px] font-bold uppercase tracking-[0.14em]"
              style={{ color: "var(--color-outline, #8a90a0)" }}
            >
              Bowler
            </span>
            {["O", "M", "R", "W", "Eco"].map((h) => (
              <span
                key={h}
                className="text-[8.5px] sm:text-[9.5px] font-bold uppercase tracking-[0.14em] text-right"
                style={{ color: "var(--color-outline, #8a90a0)" }}
              >
                {h}
              </span>
            ))}
          </div>

          <div className="h-px mx-4 sm:mx-5" style={{ background: "rgba(255,255,255,0.08)" }} />

          {/* bowler row */}
          <div className="grid grid-cols-[1fr_repeat(5,minmax(24px,auto))] items-baseline gap-x-2.5 sm:gap-x-3.5 px-4 sm:px-5 py-3">
            <span
              className="text-[11px] sm:text-[13px] font-extrabold uppercase tracking-wide truncate"
              style={{ color: "var(--color-on-surface, #eef0f4)" }}
            >
              {bowler.name}
            </span>
            <span
              className="font-heading font-black text-[12.5px] sm:text-[14.5px] tabular-nums text-right"
              style={{ color: "var(--color-on-surface, #eef0f4)" }}
            >
              {oversLabel}
            </span>
            <span
              className="font-heading font-black text-[12.5px] sm:text-[14.5px] tabular-nums text-right"
              style={{ color: "var(--color-on-surface-variant, #d8dae2)" }}
            >
              {bowler.maidens ?? 0}
            </span>
            <span
              className="font-heading font-black text-[12.5px] sm:text-[14.5px] tabular-nums text-right"
              style={{ color: "var(--color-on-surface-variant, #d8dae2)" }}
            >
              {bowler.runs ?? 0}
            </span>
            <span className="font-heading font-black text-[14.5px] sm:text-[16.5px] tabular-nums text-right" style={{ color: GOLD }}>
              {bowler.wickets ?? 0}
            </span>
            <span
              className="font-heading font-black text-[12.5px] sm:text-[14.5px] tabular-nums text-right"
              style={{ color: "var(--color-on-surface-variant, #d8dae2)" }}
            >
              {eco}
            </span>
          </div>

          <div className="h-px mx-4 sm:mx-5" style={{ background: "rgba(255,255,255,0.08)" }} />

          {/* footer — overs + live team total, same footer-row idiom as
              PartnershipTracker's header (label left, tabular-nums right) */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-2.5">
            <span
              className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ color: "var(--color-outline, #8a90a0)" }}
            >
              Overs <span style={{ color: GOLD }}>{oversLabel}</span>
            </span>
            <span
              className="font-heading font-black text-[13px] sm:text-[15px] tabular-nums"
              style={{ color: "var(--color-on-surface, #eef0f4)" }}
            >
              {scoreLabel}
            </span>
          </div>
        </div>

        {/* Team rail — crest + shortcode + "Bowling vs X" + overs pill */}
        {team && (
          <div
            className="bfp-team relative w-[80px] sm:w-[92px] rounded-[10px] flex flex-col items-center justify-center gap-2 py-4 shrink-0"
            style={{
              background:
                "linear-gradient(180deg, var(--color-surface, #141a24) 0%, var(--color-surface-container-lowest, #0a0d13) 100%)",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 16px 32px -10px rgba(0,0,0,0.65)",
            }}
          >
            <div className="relative w-10 h-10 sm:w-12 sm:h-12 shrink-0">
              <div
                className="absolute -inset-1.5 rounded-full opacity-40"
                style={{ background: `radial-gradient(circle, ${team.color || GOLD}55 0%, transparent 70%)` }}
              />
              <div className="relative w-full h-full rounded-full overflow-hidden" style={{ border: `1.5px solid ${team.color || GOLD}` }}>
                {team.logoUrl ? (
                  <Image src={team.logoUrl} alt={team.name || "Team"} fill className="object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-white font-heading font-black text-[10.5px]"
                    style={{ background: team.color || "#2a2a3a" }}
                  >
                    {team.shortCode || "?"}
                  </div>
                )}
              </div>
            </div>

            <span
              className="font-heading font-black text-[12.5px] sm:text-sm uppercase tracking-wide"
              style={{ color: "var(--color-on-surface, #eef0f4)" }}
            >
              {team.shortCode}
            </span>

            {opponent?.shortCode && (
              <span
                className="text-[7.5px] sm:text-[8px] font-bold uppercase tracking-[0.14em] text-center leading-tight"
                style={{ color: "var(--color-outline, #8a90a0)" }}
              >
                Bowling vs {opponent.shortCode}
              </span>
            )}

            <span
              className="text-[8.5px] sm:text-[9.5px] font-bold tabular-nums uppercase tracking-wide px-2 py-0.5 rounded-full mt-0.5"
              style={{ color: GOLD, background: "rgba(201,151,31,0.14)", border: "1px solid rgba(201,151,31,0.3)" }}
            >
              {oversLabel} ov
            </span>
          </div>
        )}
      </div>

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&display=swap");
        .font-heading {
          font-family: "Montserrat", sans-serif;
        }

        .bfp-wrap {
          transform-origin: right center;
          animation: bfpWrapIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .bfp-wrap.bfp-closing {
          animation: bfpWrapOut 0.28s cubic-bezier(0.4, 0, 1, 1) both;
        }
        @keyframes bfpWrapIn {
          0% {
            opacity: 0;
            transform: translateY(24px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes bfpWrapOut {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(18px) scale(0.97);
          }
        }

        /* Centered dock variant — same idea as PartnershipTracker's:
           translateX(-50%) baked into every keyframe step so the
           horizontal centering (from left: 50% above) holds throughout
           the animation, not just at rest. */
        .bfp-wrap.bfp-dock-center {
          transform-origin: center center;
          animation: bfpDockCenterIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .bfp-wrap.bfp-dock-center.bfp-closing {
          animation: bfpDockCenterOut 0.28s cubic-bezier(0.4, 0, 1, 1) both;
        }
        @keyframes bfpDockCenterIn {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(24px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }
        @keyframes bfpDockCenterOut {
          from {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateX(-50%) translateY(18px) scale(0.97);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .bfp-wrap {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}