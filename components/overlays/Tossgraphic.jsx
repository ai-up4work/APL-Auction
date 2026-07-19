// app/components/overlays/Tossgraphic.jsx
"use client";

import { Coins } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ambientGlow } from "@/lib/overlayTokens";

const EXIT_DURATION_MS = 380;

/**
 * TossGraphic — the beat that's missing between CricketMatchIntro (teams
 * announced) and LiveScoreBar (play underway): who won the toss and what
 * they chose. Same trigger-button + portal-modal + `show`-remote pattern
 * as CricketMatchIntro, deliberately reusing its card frame (gold hairline
 * border, ambientGlow blend of both team colors, glass footer) so the two
 * read as one sequence rather than two different UI languages.
 *
 * `winner` is "A" | "B"; `decision` is "bat" | "bowl".
 */
export default function TossGraphic({ show, hideTrigger = false, teamA, teamB, winner = "A", decision = "bat" }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => {
    setMounted(true);
    return () => closeTimer.current && clearTimeout(closeTimer.current);
  }, []);

  const openPanel = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setClosing(false);
    setOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setClosing((already) => {
      if (already) return true;
      closeTimer.current = setTimeout(() => {
        setOpen(false);
        setClosing(false);
      }, EXIT_DURATION_MS);
      return true;
    });
  }, []);

  const toggle = useCallback(() => {
    if (open && !closing) closePanel();
    else if (!open) openPanel();
  }, [open, closing, openPanel, closePanel]);

  useEffect(() => {
    if (show === undefined) return;
    if (show) openPanel();
    else closePanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!teamA || !teamB) return null;

  const winningTeam = winner === "A" ? teamA : teamB;
  const decisionLabel = decision === "bat" ? "elected to bat" : "elected to bowl";

  return (
    <>
      {!hideTrigger && (
        <button
          onClick={toggle}
          className="relative flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
          style={{ color: "var(--color-on-surface-variant)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-theme-orange)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-on-surface-variant)")}
        >
          <Coins className="w-5 h-5" />
          <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Toss</span>
        </button>
      )}

      {mounted &&
        open &&
        createPortal(
          <>
            <div
              className="fixed inset-0 backdrop-blur-sm z-[100]"
              style={{
                background: "rgba(0,0,0,0.8)",
                animation: closing ? "tsFadeOut 0.3s ease-in 0.08s both" : "tsFadeIn 0.3s ease-out both",
              }}
              onClick={closePanel}
            />

            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
              <div
                className="pointer-events-auto w-full max-w-lg relative"
                style={{
                  animation: closing
                    ? "tsCardExit 0.3s cubic-bezier(0.4,0,1,1) 0.05s both"
                    : "tsCardEnter 0.55s cubic-bezier(0.34,1.56,0.64,1) both",
                }}
              >
                <div className="absolute -inset-6 blur-3xl rounded-[40px]" style={{ background: ambientGlow(teamA, teamB) }} />

                <div
                  className="relative p-[1.5px] rounded-[28px] shadow-2xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(201,151,31,0.4), var(--color-border-overlay), rgba(201,151,31,0.4))",
                  }}
                >
                  <div
                    className="relative rounded-[26px] overflow-hidden text-center px-8 py-10 sm:py-12"
                    style={{ background: "linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-container-lowest) 100%)" }}
                  >
                    <div
                      className="ts-coin mx-auto mb-5 flex items-center justify-center rounded-full"
                      style={{
                        width: 64,
                        height: 64,
                        background: "linear-gradient(160deg, #f0d27f 0%, var(--color-theme-orange, #C9971F) 60%, #8a5c0d 100%)",
                        boxShadow: "0 8px 20px -4px rgba(0,0,0,0.6), inset 0 2px 3px rgba(255,255,255,0.4)",
                      }}
                    >
                      <Coins className="w-7 h-7" style={{ color: "#3a2504" }} />
                    </div>

                    <p
                      className="ts-line1 text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em]"
                      style={{ color: "var(--color-outline)" }}
                    >
                      Toss Result
                    </p>

                    <p
                      className="ts-line2 font-heading font-black text-2xl sm:text-4xl uppercase tracking-tight mt-3"
                      style={{ color: winningTeam.color || "var(--color-theme-orange)" }}
                    >
                      {winningTeam.name}
                    </p>

                    <p className="ts-line3 text-sm sm:text-lg font-semibold uppercase tracking-wide mt-2" style={{ color: "var(--color-on-surface)" }}>
                      won the toss, {decisionLabel}
                    </p>

                    <div className="ts-line4 flex items-center justify-center gap-3 mt-6">
                      <span className="h-px w-10" style={{ background: "rgba(201,151,31,0.5)" }} />
                      <span className="text-[9px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--color-theme-orange)" }}>
                        {teamA.short || teamA.shortCode} v {teamB.short || teamB.shortCode}
                      </span>
                      <span className="h-px w-10" style={{ background: "rgba(201,151,31,0.5)" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&display=swap");
        .font-heading { font-family: "Montserrat", sans-serif; }

        @keyframes tsFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tsFadeOut { from { opacity: 1; } to { opacity: 0; } }

        @keyframes tsCardEnter {
          from { opacity: 0; transform: scale(0.86) translateY(-20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes tsCardExit {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.92) translateY(10px); }
        }

        .ts-coin {
          animation: tsCoinFlip 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s both, tsCoinGlow 2.4s ease-in-out 0.9s infinite;
        }
        @keyframes tsCoinFlip {
          0% { opacity: 0; transform: scale(0.4) rotateY(0deg); }
          60% { opacity: 1; transform: scale(1.1) rotateY(720deg); }
          100% { opacity: 1; transform: scale(1) rotateY(1080deg); }
        }
        @keyframes tsCoinGlow {
          0%, 100% { filter: drop-shadow(0 0 0px rgba(212,175,55,0)); }
          50% { filter: drop-shadow(0 0 14px rgba(212,175,55,0.55)); }
        }

        .ts-line1 { opacity: 0; animation: tsUp 0.4s ease-out 0.35s both; }
        .ts-line2 { opacity: 0; animation: tsUp 0.4s ease-out 0.45s both; }
        .ts-line3 { opacity: 0; animation: tsUp 0.4s ease-out 0.55s both; }
        .ts-line4 { opacity: 0; animation: tsUp 0.4s ease-out 0.68s both; }
        @keyframes tsUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 1ms !important; animation-delay: 0ms !important; }
        }
      `}</style>
    </>
  );
}