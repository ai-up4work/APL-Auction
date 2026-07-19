// app/components/overlays/Partnershiptracker.jsx
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { STEEL_BEZEL, wedgeClip } from "@/lib/overlayTokens";

// Sibling wedge card to RunRatePanel/TournamentBoundaries — uses the
// steel bezel (same cool accent TournamentBoundaries defaults to) so a
// broadcast can dock several of these in the same corner stack and still
// tell them apart at a glance without re-deriving a new shape each time.

export const PARTNERSHIP_DEFAULTS = {
  bottom: "240px", // stacks above RunRatePanel's default slot
  right: "5vw",
};

const SLANT_PX = 30;

/**
 * PartnershipTracker — runs/balls added by the current pair since the
 * last wicket (or start of innings), with each batter's individual
 * contribution underneath. Disappears/re-triggers on every new wicket in
 * the parent's own logic (pass a fresh `closing` + remount, same pattern
 * as the moment overlays) — this component itself is stateless and just
 * renders whatever partnership is handed to it.
 */
export default function PartnershipTracker({
  runs = 0,
  balls = 0,
  batterA, // { name, runs }
  batterB, // { name, runs }
  closing = false,
  bottom = PARTNERSHIP_DEFAULTS.bottom,
  right = PARTNERSHIP_DEFAULTS.right,
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const clip = wedgeClip(SLANT_PX, 10);
  const clipInner = wedgeClip(SLANT_PX - 2, 9);
  const rr = balls > 0 ? ((runs / balls) * 6).toFixed(1) : "0.0";

  return createPortal(
    <div
      className={`pnt-wrap fixed z-[90] pointer-events-none ${closing ? "pnt-closing" : ""}`}
      style={{ bottom, right }}
    >
      <div
        className="relative p-[2px] sm:p-[2.5px]"
        style={{
          background: STEEL_BEZEL,
          boxShadow: "0 12px 26px -8px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.35)",
          clipPath: clip,
          WebkitClipPath: clip,
        }}
      >
        <div
          className="relative flex items-center gap-2.5 sm:gap-3.5 pl-5 pr-3 sm:pl-6 sm:pr-4 py-1.5 sm:py-2"
          style={{
            background: "linear-gradient(180deg, var(--color-surface, #0e1420) 0%, var(--color-surface-container-lowest, #080b12) 100%)",
            clipPath: clipInner,
            WebkitClipPath: clipInner,
          }}
        >
          <span
            className="pnt-eyebrow text-[7.5px] sm:text-[8.5px] font-bold uppercase tracking-[0.2em] whitespace-nowrap shrink-0"
            style={{ color: "var(--color-tertiary-container, #adc6ff)" }}
          >
            Partnership
          </span>

          <span
            className="pnt-hairline w-px h-4 sm:h-5 shrink-0"
            style={{ background: "linear-gradient(180deg, transparent, rgba(173,198,255,0.55), transparent)" }}
          />

          <span className="flex items-baseline gap-1.5 shrink-0">
            <span className="font-heading font-black text-sm sm:text-lg tabular-nums leading-none" style={{ color: "var(--color-on-surface, #eef0f4)" }}>
              {runs}
            </span>
            <span className="text-[9px] sm:text-[11px] font-semibold" style={{ color: "var(--color-outline, #7a8194)" }}>
              ({balls})
            </span>
            <span className="text-[8px] sm:text-[9.5px] font-bold" style={{ color: "var(--color-tertiary-container, #adc6ff)" }}>
              RR {rr}
            </span>
          </span>

          {(batterA || batterB) && (
            <>
              <span
                className="pnt-hairline w-px h-4 sm:h-5 shrink-0"
                style={{ background: "linear-gradient(180deg, transparent, rgba(173,198,255,0.55), transparent)" }}
              />
              <span className="flex flex-col leading-tight shrink-0">
                {batterA && (
                  <span className="text-[8px] sm:text-[10px] font-bold uppercase truncate max-w-[8rem]" style={{ color: "var(--color-on-surface-variant, #b8bdc9)" }}>
                    {batterA.name} <span style={{ color: "var(--color-outline, #7a8194)" }}>{batterA.runs}</span>
                  </span>
                )}
                {batterB && (
                  <span className="text-[8px] sm:text-[10px] font-bold uppercase truncate max-w-[8rem]" style={{ color: "var(--color-on-surface-variant, #b8bdc9)" }}>
                    {batterB.name} <span style={{ color: "var(--color-outline, #7a8194)" }}>{batterB.runs}</span>
                  </span>
                )}
              </span>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&display=swap");
        .font-heading { font-family: "Montserrat", sans-serif; }

        .pnt-wrap {
          transform-origin: right center;
          animation: pntWrapIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .pnt-wrap.pnt-closing {
          animation: pntWrapOut 0.28s cubic-bezier(0.4, 0, 1, 1) both;
        }
        @keyframes pntWrapIn {
          0% { opacity: 0; transform: translateX(40px) scale(0.9); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes pntWrapOut {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to { opacity: 0; transform: translateX(30px) scale(0.92); }
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