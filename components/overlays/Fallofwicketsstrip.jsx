// app/components/overlays/Fallofwicketsstrip.jsx
"use client";

import { GitCommitHorizontal } from "lucide-react";
import { createPortal } from "react-dom";
import { useOverlayPanel } from "@/hooks/useOverlayPanel";
import { GOLD_BEZEL, plaqueClip } from "@/lib/overlayTokens";
import CricketBall from "@/components/overlays/shared/CricketBall";

const EXIT_DURATION_MS = 350;
const PLAQUE_CLIP = plaqueClip(24);
const PLAQUE_CLIP_INNER = plaqueClip(21);

// Same red "dismissal ball" gradient LiveScoreBar's BallChip uses for a
// wicket in the this-over ticker — reusing it here (instead of a plain
// gold bezel) ties "a wicket fell" to the same color language across
// both components, rather than inventing a second visual vocabulary for
// the same event.
const WICKET_BALL_GRADIENT =
  "radial-gradient(circle at 32% 26%, #f0a091 0%, #cf4a37 42%, #7c1d13 88%, #5c130c 100%)";
const WICKET_SEAM_COLOR = "rgba(255,255,255,0.5)";
const WICKET_RING_COLOR = "#e2685a";

// Each fallen wicket reads as a bead strung on a gold timeline rail — the
// wicket number now sits inside the shared CricketBall sphere (the same
// stitched-seam component MatchBoundaries and LiveScoreBar's ticker use),
// tinted with the wicket-red gradient, instead of a hand-drawn bezel
// circle duplicating what CricketBall already does. The most recently
// fallen wicket gets the same live-pulse ring LiveScoreBar puts around
// the latest ball in "This Over", so the strip's newest entry reads as
// current rather than just another row in a table.
function WicketEntry({ w, closing, delay, isLatest }) {
  return (
    <div
      className="fow-entry relative z-10 flex flex-col items-center shrink-0 px-4 sm:px-5"
      style={{
        animation: closing
          ? "fowOut 0.16s ease-in both"
          : `fowIn 0.4s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
      }}
    >
      <span className="relative inline-flex items-center justify-center">
        {isLatest && !closing && (
          <span
            className="absolute -inset-[3px] rounded-full pointer-events-none fow-pulse"
            style={{ border: `1.5px solid ${WICKET_RING_COLOR}` }}
          />
        )}
        <CricketBall
          size={28}
          fill={WICKET_BALL_GRADIENT}
          seamColor={WICKET_SEAM_COLOR}
          seamWidth={1}
          className="fow-badge"
          style={{
            animation: closing
              ? "fowBadgeOut 0.14s ease-in both"
              : `fowBadgeIn 0.4s cubic-bezier(0.34,1.56,0.64,1) ${delay}s both`,
          }}
        >
          <span className="font-heading font-black text-[10px] sm:text-xs leading-none" style={{ color: "#fff" }}>
            {w.wicketNumber}
          </span>
        </CricketBall>
      </span>

      <span
        className="mt-1.5 font-heading font-black text-sm sm:text-lg tabular-nums leading-none"
        style={{ color: "var(--color-theme-orange, #C9971F)" }}
      >
        {w.score}
      </span>
      <span
        className="mt-1 text-[9px] sm:text-[11px] font-bold uppercase tracking-tight text-center whitespace-nowrap"
        style={{ color: "var(--color-on-surface, #eef0f4)" }}
      >
        {w.batter}
      </span>
      <span
        className="text-[7.5px] sm:text-[9px] font-semibold uppercase tracking-wide text-center whitespace-nowrap"
        style={{ color: "var(--color-outline, #7a8194)" }}
      >
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
 * Visually now shares the broadcast system's full grammar: a soft gold
 * ambient glow behind the plaque, a one-time diagonal sheen sweep as it
 * lands (same "unveiling" trick TossGraphic uses), a bezeled icon chip
 * for the label instead of a bare icon+text pair, and a gold connector
 * rail strung with wicket-red CricketBall beads (the same shared sphere
 * MatchBoundaries and LiveScoreBar's "This Over" ticker use) instead of
 * plain superscript numbers — with the most recent wicket carrying a
 * live pulse ring, mirroring LiveScoreBar's "latest ball" treatment.
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
              {/* Ambient glow — same soft blurred wash CricketMatchIntro
                  and TossGraphic sit behind their own cards, tinted a
                  neutral gold here since this strip has no team colors
                  of its own to draw from. */}
              <div
                className="absolute -inset-4 blur-2xl rounded-[32px] pointer-events-none"
                style={{ background: "radial-gradient(ellipse at center, rgba(201,151,31,0.28) 0%, transparent 70%)" }}
              />

              <div
                className="relative p-[2px] sm:p-[3px] overflow-hidden"
                style={{
                  background: GOLD_BEZEL,
                  boxShadow: "0 20px 40px -10px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.35)",
                  clipPath: PLAQUE_CLIP,
                  WebkitClipPath: PLAQUE_CLIP,
                }}
              >
                {/* One-time diagonal light sweep as the plaque lands —
                    the same "unveiling" flourish used on TossGraphic's
                    card. Doesn't repeat, doesn't loop. */}
                {!closing && <span className="fow-sheen absolute inset-0 pointer-events-none z-20" aria-hidden="true" />}

                <div
                  className="relative overflow-x-auto"
                  style={{
                    background: "linear-gradient(180deg, var(--color-surface, #0e1420) 0%, var(--color-surface-container-lowest, #080b12) 100%)",
                    clipPath: PLAQUE_CLIP_INNER,
                    WebkitClipPath: PLAQUE_CLIP_INNER,
                  }}
                >
                  <div className="flex items-center gap-5 px-5 sm:px-7 py-3 sm:py-4 min-w-max">
                    {/* Label — a small metal-bezel icon chip paired with a
                        two-line eyebrow/innings stack, the same "bezeled
                        badge + text stack" shape as the header identity
                        block in CricketMatchIntro/TossGraphic, instead of
                        a bare icon sitting next to plain text. */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div
                        className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full p-[2px] shadow-lg shrink-0"
                        style={{ background: GOLD_BEZEL }}
                      >
                        <div
                          className="w-full h-full rounded-full flex items-center justify-center"
                          style={{ background: "var(--color-surface-container-lowest, #080b12)" }}
                        >
                          <GitCommitHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: "var(--color-theme-orange, #C9971F)" }} />
                        </div>
                      </div>
                      <div className="leading-tight">
                        <span
                          className="block text-[8px] sm:text-[9px] font-bold tracking-[0.25em] uppercase"
                          style={{ color: "var(--color-theme-orange, #C9971F)" }}
                        >
                          Fall of Wickets
                        </span>
                        <span
                          className="block text-[8px] sm:text-[9px] font-semibold uppercase tracking-wide"
                          style={{ color: "var(--color-outline, #7a8194)" }}
                        >
                          {inningsLabel}
                        </span>
                      </div>
                    </div>

                    {/* Hairline divider — gradient fade instead of a flat
                        color bar, matching the hairline treatment used
                        everywhere else in the broadcast system. */}
                    <div
                      className="h-9 w-px shrink-0"
                      style={{ background: "linear-gradient(180deg, transparent, rgba(201,151,31,0.5), transparent)" }}
                    />

                    {wickets.length === 0 ? (
                      <span className="text-[10px] italic" style={{ color: "var(--color-outline, #7a8194)" }}>
                        No wickets yet
                      </span>
                    ) : (
                      <div className="relative flex items-start">
                        {/* Connector rail — a thin gold gradient line the
                            wicket beads sit on, running the full width of
                            the entries so the strip reads as one
                            progression rather than separate stat blocks. */}
                        <div
                          className="absolute left-4 right-4 pointer-events-none"
                          style={{
                            top: "14px",
                            height: "1px",
                            background:
                              "linear-gradient(90deg, transparent, rgba(201,151,31,0.45) 8%, rgba(201,151,31,0.45) 92%, transparent)",
                          }}
                        />
                        {wickets.map((w, i) => (
                          <WicketEntry
                            key={w.wicketNumber}
                            w={w}
                            closing={closing}
                            delay={0.05 + i * 0.06}
                            isLatest={i === wickets.length - 1}
                          />
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

        .fow-sheen {
          background: linear-gradient(
            100deg,
            transparent 30%,
            rgba(255, 255, 255, 0.14) 45%,
            rgba(255, 255, 255, 0.28) 50%,
            rgba(255, 255, 255, 0.14) 55%,
            transparent 70%
          );
          transform: translateX(-140%) rotate(4deg);
          animation: fowSheenSweep 0.9s cubic-bezier(0.4, 0, 0.2, 1) 0.15s both;
        }
        @keyframes fowSheenSweep {
          0% { transform: translateX(-140%) rotate(4deg); }
          100% { transform: translateX(140%) rotate(4deg); }
        }

        .fow-badge {
          animation-fill-mode: both;
        }
        @keyframes fowBadgeIn {
          0% { opacity: 0; transform: scale(0.4) rotate(-25deg); }
          65% { opacity: 1; transform: scale(1.12) rotate(4deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes fowBadgeOut {
          from { opacity: 1; transform: scale(1) rotate(0deg); }
          to { opacity: 0; transform: scale(0.6) rotate(-12deg); }
        }

        .fow-pulse {
          animation: fowPulse 1.6s ease-out infinite;
        }
        @keyframes fowPulse {
          0% { opacity: 0.9; transform: scale(0.85); }
          70% { opacity: 0; transform: scale(1.4); }
          100% { opacity: 0; transform: scale(1.4); }
        }

        @keyframes fowIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fowOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-4px); }
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 1ms !important; animation-delay: 0ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </>
  );
}