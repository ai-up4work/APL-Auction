// app/components/overlays/Runratepanel.jsx
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { GOLD_BEZEL, wedgeClip } from "@/lib/overlayTokens";

export const RUN_RATE_DEFAULTS = {
  bottom: "196px",
  right: "5vw",
};

const SLANT_PX = 30;

/**
 * @param {{
 *   label: string,
 *   value: string | number,
 *   accent: string,
 *   delay: number,
 *   closing: boolean
 * }} props
 */
function RateStat({ label, value, accent, delay, closing }) {
  return (
    <span className="rrp-stat relative flex flex-col items-center shrink-0 px-2 sm:px-3">
      <span
        className="font-heading font-black text-sm sm:text-lg tabular-nums leading-none"
        style={{
          color: accent,
          animation: closing
            ? "rrpFadeOut 0.14s ease-in both"
            : `rrpStatIn 0.4s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
        }}
      >
        {value}
      </span>

      <span
        className="text-[6.5px] sm:text-[7.5px] font-bold uppercase tracking-[0.16em] mt-0.5"
        style={{
          color: "var(--color-outline, #7a8194)",
        }}
      >
        {label}
      </span>
    </span>
  );
}

/**
 * RunRatePanel
 *
 * @param {{
 *   crr?: number,
 *   target?: number | null,
 *   runsNeeded?: number,
 *   ballsRemaining?: number,
 *   closing?: boolean,
 *   bottom?: string,
 *   right?: string
 * }} props
 */
export default function RunRatePanel({
  crr = 0,
  target = null,
  runsNeeded = 0,
  ballsRemaining = 0,
  closing = false,
  bottom = RUN_RATE_DEFAULTS.bottom,
  right = RUN_RATE_DEFAULTS.right,
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const chasing = target !== null && target !== undefined;

  const rrr =
    chasing && ballsRemaining > 0
      ? runsNeeded / (ballsRemaining / 6)
      : null;

  const urgent = rrr !== null && rrr - crr >= 1.5;

  const clip = wedgeClip(SLANT_PX, 10);
  const clipInner = wedgeClip(SLANT_PX - 2, 9);

  return createPortal(
    <div
      className={`rrp-wrap fixed z-[90] pointer-events-none ${
        closing ? "rrp-closing" : ""
      }`}
      style={{ bottom, right }}
    >
      <div
        className="relative p-[2px] sm:p-[2.5px]"
        style={{
          background: GOLD_BEZEL,
          boxShadow:
            "0 12px 26px -8px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.35)",
          clipPath: clip,
          WebkitClipPath: clip,
        }}
      >
        <div
          className="relative flex items-center gap-1 sm:gap-1.5 pl-5 pr-3 sm:pl-6 sm:pr-4 py-1.5 sm:py-2"
          style={{
            background:
              "linear-gradient(180deg, var(--color-surface, #0e1420) 0%, var(--color-surface-container-lowest, #080b12) 100%)",
            clipPath: clipInner,
            WebkitClipPath: clipInner,
          }}
        >
          <RateStat
            label="CRR"
            value={crr.toFixed(2)}
            accent="var(--color-on-surface, #eef0f4)"
            delay={0.1}
            closing={closing}
          />

          {chasing && (
            <>
              <span
                className="rrp-hairline w-px h-4 sm:h-5 shrink-0"
                style={{
                  background:
                    "linear-gradient(180deg, transparent, rgba(255,255,255,0.25), transparent)",
                }}
              />

              <RateStat
                label="RRR"
                value={rrr !== null ? rrr.toFixed(2) : "—"}
                accent={
                  urgent
                    ? "#e2685a"
                    : "var(--color-theme-orange, #C9971F)"
                }
                delay={0.2}
                closing={closing}
              />

              <span
                className="rrp-hairline w-px h-4 sm:h-5 shrink-0"
                style={{
                  background:
                    "linear-gradient(180deg, transparent, rgba(255,255,255,0.25), transparent)",
                }}
              />

              <RateStat
                label={`NEED / ${ballsRemaining}B`}
                value={runsNeeded}
                accent="var(--color-on-surface, #eef0f4)"
                delay={0.3}
                closing={closing}
              />
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&display=swap");

        .font-heading {
          font-family: "Montserrat", sans-serif;
        }

        .rrp-wrap {
          transform-origin: right center;
          animation: rrpWrapIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .rrp-wrap.rrp-closing {
          animation: rrpWrapOut 0.28s cubic-bezier(0.4, 0, 1, 1) both;
        }

        @keyframes rrpWrapIn {
          0% {
            opacity: 0;
            transform: translateX(40px) scale(0.9);
          }

          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @keyframes rrpWrapOut {
          from {
            opacity: 1;
            transform: translateX(0) scale(1);
          }

          to {
            opacity: 0;
            transform: translateX(30px) scale(0.92);
          }
        }

        @keyframes rrpStatIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes rrpFadeOut {
          from {
            opacity: 1;
          }

          to {
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .rrp-wrap,
          .rrp-stat {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}