// app/components/overlays/Partnershiptracker.jsx
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

// Sibling card to RunRatePanel/TournamentBoundaries, but styled as its own
// broadcast "lower third" block: a dark card, gold accent, team + eyebrow
// on the left of the header row, live score on the right, and two batter
// columns underneath, each with a run-share bar so you can read at a
// glance who's carrying the partnership.

export const PARTNERSHIP_DEFAULTS = {
  bottom: "48px",
  right: "5vw",
};

const GOLD = "var(--color-tertiary-container, #d8b34a)";
const GOLD_DIM = "rgba(216, 179, 74, 0.28)";

/**
 * PartnershipTracker — runs/balls added by the current pair since the
 * last wicket (or start of innings), with each batter's individual
 * contribution and run-share underneath. Disappears/re-triggers on every
 * new wicket in the parent's own logic (pass a fresh `closing` + remount,
 * same pattern as the moment overlays) — this component itself is
 * stateless and just renders whatever partnership is handed to it.
 */
export default function PartnershipTracker({
  teamCode = "",
  runs = 0,
  balls = 0,
  batterA, // { name, runs, balls, onStrike? }
  batterB, // { name, runs, balls, onStrike? }
  closing = false,
  center = false, // true = same bottom offset as the score-bar dock, but horizontally centered instead of right-aligned
  bottom = PARTNERSHIP_DEFAULTS.bottom,
  right = PARTNERSHIP_DEFAULTS.right,
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const rr = balls > 0 ? ((runs / balls) * 6).toFixed(2) : "0.00";
  const total = Math.max(runs, 1);
  const shareA = batterA ? Math.min(100, Math.round((batterA.runs / total) * 100)) : 0;
  const shareB = batterB ? Math.min(100, Math.round((batterB.runs / total) * 100)) : 0;

  const wrapClassName = center
    ? `pnt-wrap pnt-dock-center fixed z-[90] pointer-events-none ${closing ? "pnt-closing" : ""}`
    : `pnt-wrap fixed z-[90] pointer-events-none ${closing ? "pnt-closing" : ""}`;
  // Centered mode still docks to `bottom` (same offset the score-bar dock
  // point uses) — only the horizontal axis changes, from right-aligned to
  // centered. left: 50% + the translateX(-50%) baked into the animation
  // keyframes below is what actually centers it, since animating a
  // transform and needing a static centering transform at the same time
  // don't mix on one property otherwise.
  const wrapStyle = center ? { bottom, left: "50%" } : { bottom, right };

  return createPortal(
    <div className={wrapClassName} style={wrapStyle}>
      <div
        className="pnt-card relative w-[min(90vw,560px)] rounded-[10px] overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, var(--color-surface, #141a24) 0%, var(--color-surface-container-lowest, #0a0d13) 100%)",
          boxShadow: "0 16px 32px -10px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_DIM} 65%, transparent 100%)` }}
        />

        {/* header row */}
        <div className="flex items-baseline justify-between gap-3 px-4 sm:px-5 pt-3 pb-2">
          <div className="flex items-baseline gap-2 min-w-0">
            {teamCode && (
              <span
                className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide shrink-0"
                style={{ color: "var(--color-on-surface, #eef0f4)" }}
              >
                {teamCode}
              </span>
            )}
            <span
              className="pnt-eyebrow text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] whitespace-nowrap"
              style={{ color: GOLD }}
            >
              Partnership
            </span>
          </div>

          <div className="flex items-baseline gap-1.5 shrink-0">
            <span
              className="font-heading font-black text-lg sm:text-xl tabular-nums leading-none"
              style={{ color: "var(--color-on-surface, #f3f4f7)" }}
            >
              {runs}
            </span>
            <span
              className="text-[11px] sm:text-[12px] font-semibold tabular-nums"
              style={{ color: "var(--color-outline, #8a90a0)" }}
            >
              ({balls})
            </span>
            <span
              className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide ml-1"
              style={{ color: GOLD }}
            >
              RR {rr}
            </span>
          </div>
        </div>

        <div className="h-px mx-4 sm:mx-5" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* batter columns */}
        <div className="grid grid-cols-2 gap-6 sm:gap-10 px-4 sm:px-5 pt-2.5 pb-3">
          {[
            { data: batterA, share: shareA },
            { data: batterB, share: shareB },
          ].map((col, i) => {
            const b = col.data;
            if (!b) return <div key={i} />;
            const isGold = b.onStrike ?? i === 0;
            return (
              <div key={i} className="min-w-0">
                <div
                  className="text-[10px] sm:text-[11.5px] font-extrabold uppercase tracking-wide truncate"
                  style={{ color: "var(--color-on-surface, #eef0f4)" }}
                >
                  {b.name}
                </div>
                <div
                  className="font-heading font-black text-xl sm:text-2xl tabular-nums leading-tight mt-0.5"
                  style={{ color: isGold ? GOLD : "var(--color-on-surface-variant, #d8dae2)" }}
                >
                  {b.runs}
                  <span
                    className="text-[11px] sm:text-[12px] font-semibold ml-1"
                    style={{ color: "var(--color-outline, #8a90a0)" }}
                  >
                    ({b.balls ?? 0})
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1.5">
                  <div
                    className="pnt-bar-track relative flex-1 h-[3px] rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${col.share}%`,
                        background: isGold
                          ? `linear-gradient(90deg, ${GOLD_DIM}, ${GOLD})`
                          : "rgba(255,255,255,0.35)",
                      }}
                    />
                  </div>
                  <span
                    className="text-[8.5px] sm:text-[9.5px] font-bold tabular-nums shrink-0"
                    style={{ color: "var(--color-outline, #8a90a0)" }}
                  >
                    {col.share}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&display=swap");
        .font-heading {
          font-family: "Montserrat", sans-serif;
        }

        .pnt-wrap {
          transform-origin: right center;
          animation: pntWrapIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .pnt-wrap.pnt-closing {
          animation: pntWrapOut 0.28s cubic-bezier(0.4, 0, 1, 1) both;
        }
        @keyframes pntWrapIn {
          0% {
            opacity: 0;
            transform: translateY(24px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes pntWrapOut {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(18px) scale(0.97);
          }
        }

        /* Centered dock variant: same slide-up-and-settle as the corner
           cards, but with translateX(-50%) baked into every step so the
           horizontal centering (from left: 50% above) holds throughout
           the animation instead of only at rest. */
        .pnt-wrap.pnt-dock-center {
          transform-origin: center center;
          animation: pntDockCenterIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .pnt-wrap.pnt-dock-center.pnt-closing {
          animation: pntDockCenterOut 0.28s cubic-bezier(0.4, 0, 1, 1) both;
        }
        @keyframes pntDockCenterIn {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(24px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }
        @keyframes pntDockCenterOut {
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
          .pnt-wrap {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}