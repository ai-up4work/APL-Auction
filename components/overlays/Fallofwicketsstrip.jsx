// app/components/overlays/Fallofwicketsstrip.jsx
"use client";

import { GitCommitHorizontal } from "lucide-react";
import { createPortal } from "react-dom";
import { useOverlayPanel } from "@/hooks/useOverlayPanel";
import { GOLD_BEZEL, plaqueClip } from "@/lib/overlayTokens";

const EXIT_DURATION_MS = 350;
const PLAQUE_CLIP = plaqueClip(24);
const PLAQUE_CLIP_INNER = plaqueClip(21);

function WicketEntry({ w, closing, delay }) {
  return (
    <div
      className="fow-entry relative flex flex-col items-start shrink-0 pr-5 sm:pr-7"
      style={{
        animation: closing
          ? "fowOut 0.16s ease-in both"
          : `fowIn 0.4s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
      }}
    >
      <span className="font-heading font-black text-base sm:text-xl tabular-nums leading-none" style={{ color: "var(--color-theme-orange, #C9971F)" }}>
        {w.score}
        <span className="text-[10px] sm:text-xs font-bold" style={{ color: "var(--color-outline, #7a8194)" }}>-{w.wicketNumber}</span>
      </span>
      <span className="mt-1 text-[9px] sm:text-[11px] font-bold uppercase tracking-tight" style={{ color: "var(--color-on-surface, #eef0f4)" }}>
        {w.batter}
      </span>
      <span className="text-[7.5px] sm:text-[9px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-outline, #7a8194)" }}>
        {w.overs} ov · {w.howOut}
      </span>
    </div>
  );
}

/**
 * FallOfWicketsStrip — same trigger-button + modal pattern as PointsTable
 * and CricketScorecard (useOverlayPanel, GOLD_BEZEL plaque, remote `show`
 * prop). Renders the wicket-fall timeline for the current innings as a
 * horizontally scrolling row of entries: score-wicket, batter dismissed,
 * over it fell, and how out — the one match-detail view none of the
 * existing overlays cover.
 *
 * `wickets` is an ordered array of
 *   { wicketNumber, score, overs, batter, howOut }
 * Typically derived the same way buildInningsCard() derives its rows —
 * from the balls ledger for the active innings.
 */
export default function FallOfWicketsStrip({ wickets = [], inningsLabel = "1st Innings", show, hideTrigger = false }) {
  const { mounted, open, closing, toggle, closePanel } = useOverlayPanel(show, EXIT_DURATION_MS, {
    defaultOpen: false,
    escapeToClose: true,
  });

  return (
    <>
      {!hideTrigger && (
        <button
          onClick={toggle}
          className="relative flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
          style={{ color: "var(--color-on-surface-variant, #b8bdc9)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-theme-orange, #C9971F)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-on-surface-variant, #b8bdc9)")}
        >
          <GitCommitHorizontal className="w-5 h-5" />
          <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Fall of Wickets</span>
        </button>
      )}

      {mounted &&
        open &&
        createPortal(
          <div
            className="fixed inset-x-0 bottom-24 sm:bottom-28 z-[100] flex justify-center px-3 pointer-events-none"
            aria-live="polite"
          >
            <div
              className="pointer-events-auto relative w-full max-w-3xl"
              style={{
                animation: closing
                  ? "fowCardOut 0.28s cubic-bezier(0.4,0,1,1) both"
                  : "fowCardIn 0.5s cubic-bezier(0.22,1,0.36,1) both",
              }}
            >
              <div
                className="relative p-[2px] sm:p-[3px]"
                style={{
                  background: GOLD_BEZEL,
                  boxShadow: "0 20px 40px -10px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.35)",
                  clipPath: PLAQUE_CLIP,
                  WebkitClipPath: PLAQUE_CLIP,
                }}
              >
                <div
                  className="relative overflow-x-auto"
                  style={{
                    background: "linear-gradient(180deg, var(--color-surface, #0e1420) 0%, var(--color-surface-container-lowest, #080b12) 100%)",
                    clipPath: PLAQUE_CLIP_INNER,
                    WebkitClipPath: PLAQUE_CLIP_INNER,
                  }}
                >
                  <div className="flex items-center gap-4 px-5 sm:px-7 py-3 sm:py-4 min-w-max">
                    <span
                      className="text-[8px] sm:text-[9px] font-bold tracking-[0.25em] uppercase shrink-0"
                      style={{ color: "var(--color-theme-orange, #C9971F)" }}
                    >
                      Fall of Wickets · {inningsLabel}
                    </span>
                    <div className="h-8 w-px shrink-0" style={{ background: "var(--color-border-overlay, rgba(255,255,255,0.1))" }} />

                    {wickets.length === 0 ? (
                      <span className="text-[10px] italic" style={{ color: "var(--color-outline, #7a8194)" }}>
                        No wickets yet
                      </span>
                    ) : (
                      <div className="flex items-start gap-0">
                        {wickets.map((w, i) => (
                          <WicketEntry key={w.wicketNumber} w={w} closing={closing} delay={0.05 + i * 0.05} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&display=swap");
        .font-heading { font-family: "Montserrat", sans-serif; }

        @keyframes fowCardIn {
          from { opacity: 0; transform: translateY(18px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fowCardOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(14px) scale(0.97); }
        }
        @keyframes fowIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fowOut {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(-6px); }
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 1ms !important; animation-delay: 0ms !important; }
        }
      `}</style>
    </>
  );
}