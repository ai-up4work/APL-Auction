// app/components/overlays/Tossgraphic.jsx
"use client";

import { Coins } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ambientGlow } from "@/lib/overlayTokens";

const EXIT_DURATION_MS = 420;

// Same default CricketMatchIntro falls back to when no tournament logo is
// supplied, so a bare TossGraphic (no `tournamentLogoUrl` prop) still shows
// a watermark instead of empty space behind the coin.
const TOURNAMENT_LOGO_DEFAULT = "/valiant-league-logo.png";

// Same hex -> soft rgba glow helper CricketMatchIntro uses behind its
// crests. Duplicated locally (rather than imported) since it's a tiny
// pure function and TossGraphic previously had no dependency on it —
// keeps this file a self-contained drop-in like the others.
function softGlowFromHex(hex) {
  const fallback = "rgba(201,151,31,0.18)";
  if (!hex) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r},${g},${b},0.22)`;
}

/**
 * TossGraphic — the beat that's missing between CricketMatchIntro (teams
 * announced) and LiveScoreBar (play underway): who won the toss and what
 * they chose. Same trigger-button + portal-modal + `show`-remote pattern
 * as CricketMatchIntro, and shares its visual grammar too:
 *   - a centered header banner (flanked hairlines) instead of a bare
 *     eyebrow label
 *   - dual localized team-color glows behind the content, echoing the
 *     "18%/82%" crest glows in CricketMatchIntro's VS section
 *   - a faded, grayscale tournament-logo watermark sitting behind the
 *     coin, the same emblem treatment CricketMatchIntro washes behind
 *     its team crests, so this card doesn't read as "blank" compared
 *     to the intro panel it follows
 *
 * The coin still spins as a plain, teamless gold coin while it's
 * actually in the air, then becomes the winning team's crest badge
 * (metal bezel, shine ring) once it settles — the generic coin fades
 * out right as the winner's badge fades in behind it, so the reveal
 * reads as "the coin turned into the badge" rather than telegraphing
 * the result mid-flip. Teams without a `logoUrl` fall back to a
 * monogram badge in their own team color so the reveal never renders
 * empty.
 *
 * `winner` is "A" | "B"; `decision` is "bat" | "bowl". `tournamentName`
 * and `tournamentLogoUrl` are passed straight from matchSetup by the
 * caller (same fields CricketMatchIntro reads off matchSetup), and are
 * optional — omit either and the relevant piece just falls back to its
 * default.
 */
export default function TossGraphic({
  show,
  hideTrigger = false,
  teamA,
  teamB,
  winner = "A",
  decision = "bat",
  tournamentName,
  tournamentLogoUrl,
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [flipKey, setFlipKey] = useState(0); // bump to replay the flip animation each time the card opens
  const closeTimer = useRef(null);

  useEffect(() => {
    setMounted(true);
    return () => closeTimer.current && clearTimeout(closeTimer.current);
  }, []);

  const openPanel = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setClosing(false);
    setOpen(true);
    setFlipKey((k) => k + 1);
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

  // Escape closes it too, since there's no dedicated close button — same
  // convenience CricketMatchIntro offers on its own panel.
  useEffect(() => {
    if (!open || closing) return;
    const onKey = (e) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closing, closePanel]);

  if (!teamA || !teamB) return null;

  const winningTeam = winner === "A" ? teamA : teamB;
  const decisionLabel = decision === "bat" ? "elected to bat" : "elected to bowl";
  const teamAShort = teamA.short || teamA.shortCode || "A";
  const teamBShort = teamB.short || teamB.shortCode || "B";
  const teamAGlow = softGlowFromHex(teamA.color);
  const teamBGlow = softGlowFromHex(teamB.color);
  const logoSrc = tournamentLogoUrl || TOURNAMENT_LOGO_DEFAULT;

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
              className="fixed inset-0 z-[100]"
              style={{
                background: "rgba(0,0,0,0.8)",
                animation: closing ? "tsBackdropOut 0.4s ease-in both" : "tsBackdropIn 0.42s ease-out both",
              }}
              onClick={closePanel}
            />

            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
              <div
                className="pointer-events-auto w-full max-w-lg relative"
                style={{
                  animation: closing
                    ? "tsCardExit 0.34s cubic-bezier(0.4,0,0.7,1) 0.06s both"
                    : "tsCardEnter 0.62s cubic-bezier(0.22,1,0.36,1) both",
                }}
              >
                <div
                  className="absolute -inset-6 blur-3xl rounded-[40px]"
                  style={{ background: ambientGlow(teamA, teamB) }}
                />

                {!closing && (
                  <span
                    className="ts-border-pulse absolute inset-0 rounded-[28px] pointer-events-none z-10"
                    aria-hidden="true"
                  />
                )}

                <div
                  className="relative p-[1.5px] rounded-[28px] shadow-2xl overflow-hidden"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(201,151,31,0.4), var(--color-border-overlay), rgba(201,151,31,0.4))",
                  }}
                >
                  {/* One-time diagonal light sweep across the whole card
                      as it lands — the same "unveiling" trick used on
                      MatchMomentOverlay's panel, scaled down for this
                      smaller card. Doesn't repeat, doesn't loop. */}
                  {!closing && <span className="ts-card-sheen absolute inset-0 pointer-events-none z-20" aria-hidden="true" />}

                  <div
                    className="relative rounded-[26px] overflow-hidden"
                    style={{
                      background:
                        "linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-container-lowest) 100%)",
                    }}
                  >
                    {/* Localized glows behind each team side — same
                        18%/82% radial pair CricketMatchIntro washes
                        behind its VS section, so this card reads as part
                        of the same sequence rather than a bare dialog. */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at 18% 30%, ${teamAGlow} 0%, transparent 38%), radial-gradient(circle at 82% 30%, ${teamBGlow} 0%, transparent 38%)`,
                      }}
                    />

                    {/* Header — a centered matchup banner flanked by
                        hairlines, the same shape as CricketMatchIntro's
                        tournament-identity header, just carrying the
                        fixture and "Toss Result" instead of the
                        tournament name/edition. */}
                    <div
                      className="ts-line1 relative z-10 flex items-center justify-center gap-4 pt-6 pb-4 px-6 sm:px-10"
                      style={{ borderBottom: "1px solid var(--color-border-overlay)" }}
                    >
                      <div
                        className="hidden sm:block h-px flex-1"
                        style={{ background: "linear-gradient(90deg, transparent, rgba(201,151,31,0.5))" }}
                      />
                      <div className="leading-tight text-center shrink-0">
                        <p
                          className="font-heading font-black text-sm sm:text-lg tracking-wide uppercase"
                          style={{ color: "var(--color-on-surface)" }}
                        >
                          {teamAShort} <span style={{ color: "var(--color-outline)" }}>v</span> {teamBShort}
                        </p>
                        <p
                          className="text-[9px] font-bold tracking-[0.3em] uppercase mt-0.5"
                          style={{ color: "var(--color-theme-orange)" }}
                        >
                          Toss Result
                        </p>
                      </div>
                      <div
                        className="hidden sm:block h-px flex-1"
                        style={{ background: "linear-gradient(90deg, rgba(201,151,31,0.5), transparent)" }}
                      />
                    </div>

                    {/* Coin + result */}
                    <div className="relative min-h-[260px] sm:min-h-[300px] flex flex-col items-center justify-center text-center px-8 py-8">
                      {/* Emblem watermark — the same grayscale, soft-light
                          crest CricketMatchIntro sits behind its team
                          badges, sized to fill this section and centered
                          behind the coin so the card doesn't read as bare
                          compared to the panel it follows. Purely
                          decorative, so it never intercepts clicks and
                          never blocks the backdrop's own close-on-click. */}
                      <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                        aria-hidden="true"
                        style={{
                          animation: closing
                            ? "tsFadeOut 0.22s ease-in both"
                            : "tsFadeIn 0.6s ease-out 0.3s both",
                        }}
                      >
                        <img
                          src={logoSrc}
                          alt=""
                          className="w-3/4 h-3/4 object-contain"
                          style={{
                            opacity: 0.2,
                            mixBlendMode: "soft-light",
                            filter: "grayscale(1) contrast(1.3) brightness(1.6)",
                          }}
                        />
                      </div>

                      {/* ---- The coin: tossed up and caught, not spun flat
                          in place — the wrapper (.ts-coin-arc) carries the
                          vertical rise/fall + a slight scale-down at the
                          peak (further from the viewer), while the disc
                          inside it (.ts-coin-spin) just handles the actual
                          rotation + fade. A ground shadow shrinks and
                          fades as the coin gets higher, then a small
                          impact flash + bounce mark the catch right as it
                          becomes the winner's crest. ---- */}
                      <div
                        key={flipKey}
                        className="ts-coin-wrap relative z-10 mx-auto mb-6"
                        style={{ width: 96, height: 96, perspective: 700 }}
                      >
                        <div
                          className="ts-coin-glow absolute -inset-3 rounded-full"
                          style={{ background: `radial-gradient(circle, ${winningTeam.color || "#C9971F"}55 0%, transparent 70%)` }}
                        />

                        <div className="ts-coin-shadow absolute left-1/2 rounded-full" />

                        <div className="ts-coin-arc absolute inset-0">
                          <div
                            className="ts-coin-spin absolute inset-0 rounded-full flex items-center justify-center"
                            style={{
                              background: "linear-gradient(160deg, #f0d27f 0%, #C9971F 60%, #8a5c0d 100%)",
                              border: "2px solid rgba(255,255,255,0.35)",
                              boxShadow:
                                "inset 0 2px 3px rgba(255,255,255,0.45), inset 0 -3px 6px rgba(0,0,0,0.25), 0 8px 20px -4px rgba(0,0,0,0.55)",
                            }}
                          >
                            <Coins className="w-8 h-8" style={{ color: "#3a2504" }} />
                          </div>
                        </div>

                        <div className="ts-impact-ring absolute inset-0 rounded-full pointer-events-none" style={{ border: `1.5px solid ${winningTeam.color || "#C9971F"}` }} />

                        <div className="ts-coin-reveal absolute inset-0">
                          <CoinFace team={winningTeam} />
                        </div>
                      </div>

                      <p
                        className="ts-line2 relative z-10 font-heading font-black text-2xl sm:text-4xl uppercase tracking-tight"
                        style={{ color: winningTeam.color || "var(--color-theme-orange)" }}
                      >
                        {winningTeam.name}
                      </p>

                      <p
                        className="ts-line3 relative z-10 text-sm sm:text-lg font-semibold uppercase tracking-wide mt-2"
                        style={{ color: "var(--color-on-surface)" }}
                      >
                        won the toss, {decisionLabel}
                      </p>
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

        @keyframes tsBackdropIn {
          from { opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
        }
        @keyframes tsBackdropOut {
          from { opacity: 1; backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
          to { opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
        }

        /* Card lands like it's being dealt onto the table: a slight
           forward 3D tilt easing flat, a soft blur-in as it resolves
           into focus, and a gentle overshoot on scale rather than a
           flat pop. Exit reverses the tilt and lifts the card away
           instead of just shrinking it, so dismissal reads as "pulled
           back up" rather than "sinking through the floor". */
        @keyframes tsCardEnter {
          0% { opacity: 0; transform: perspective(900px) rotateX(10deg) translateY(-30px) scale(0.9); filter: blur(5px); }
          55% { opacity: 1; filter: blur(0px); }
          100% { opacity: 1; transform: perspective(900px) rotateX(0deg) translateY(0) scale(1); filter: blur(0px); }
        }
        @keyframes tsCardExit {
          0% { opacity: 1; transform: perspective(900px) rotateX(0deg) translateY(0) scale(1); filter: blur(0px); }
          100% { opacity: 0; transform: perspective(900px) rotateX(-8deg) translateY(-16px) scale(0.94); filter: blur(4px); }
        }

        .ts-card-sheen {
          background: linear-gradient(
            100deg,
            transparent 30%,
            rgba(255, 255, 255, 0.14) 45%,
            rgba(255, 255, 255, 0.3) 50%,
            rgba(255, 255, 255, 0.14) 55%,
            transparent 70%
          );
          transform: translateX(-140%) rotate(6deg);
          animation: tsSheenSweep 1.05s cubic-bezier(0.4, 0, 0.2, 1) 0.3s both;
        }
        @keyframes tsSheenSweep {
          0% { transform: translateX(-140%) rotate(6deg); }
          100% { transform: translateX(140%) rotate(6deg); }
        }

        .ts-border-pulse {
          opacity: 0;
          box-shadow: 0 0 0 1.5px rgba(201, 151, 31, 0.5);
          animation: tsBorderPulseIn 0.3s ease-out 0.6s forwards, tsBorderPulse 2.6s ease-in-out 0.9s infinite;
        }
        @keyframes tsBorderPulseIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tsBorderPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .ts-coin-wrap {
          animation: tsWrapBounce 0.35s ease-out 1.15s both;
        }
        @keyframes tsWrapBounce {
          0% { transform: translateY(0); }
          35% { transform: translateY(-7px); }
          70% { transform: translateY(1px); }
          100% { transform: translateY(0); }
        }

        .ts-coin-glow {
          opacity: 0;
          animation: tsGlowIn 0.6s ease-out 1.15s both, tsGlowPulse 2.6s ease-in-out 1.75s infinite;
        }
        @keyframes tsGlowIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tsGlowPulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }

        .ts-coin-shadow {
          bottom: -9px;
          width: 52px;
          height: 12px;
          margin-left: -26px;
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 55%, transparent 75%);
          opacity: 0;
          animation: tsShadowPulse 1.15s cubic-bezier(0.36, 0.07, 0.19, 0.97) 0.15s forwards;
        }
        @keyframes tsShadowPulse {
          0% { opacity: 0.55; transform: scale(1); }
          45% { opacity: 0.16; transform: scale(0.5); animation-timing-function: cubic-bezier(0.6, 0, 0.67, 1); }
          100% { opacity: 0.55; transform: scale(1); }
        }

        .ts-coin-arc {
          animation: tsCoinArc 1.15s cubic-bezier(0.36, 0.07, 0.19, 0.97) 0.15s both;
        }
        @keyframes tsCoinArc {
          0% { transform: translateY(0) scale(1); }
          45% { transform: translateY(-46px) scale(0.9); animation-timing-function: cubic-bezier(0.6, 0, 0.67, 1); }
          100% { transform: translateY(0) scale(1); }
        }

        .ts-coin-spin {
          animation: tsCoinSpin 1.15s linear 0.15s both;
        }
        @keyframes tsCoinSpin {
          0% { opacity: 0; transform: rotateY(0deg); }
          8% { opacity: 1; transform: rotateY(0deg); }
          88% { opacity: 1; transform: rotateY(1440deg); }
          100% { opacity: 0; transform: rotateY(1620deg); }
        }

        .ts-impact-ring {
          opacity: 0;
          animation: tsImpactRing 0.55s cubic-bezier(0.2, 0.7, 0.3, 1) 1.28s forwards;
        }
        @keyframes tsImpactRing {
          0% { opacity: 0.75; transform: scale(0.7); }
          100% { opacity: 0; transform: scale(1.7); }
        }

        .ts-coin-reveal {
          opacity: 0;
          animation: tsCoinReveal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 1.2s both;
        }
        @keyframes tsCoinReveal {
          0% { opacity: 0; transform: scale(0.7); }
          60% { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }

        .ts-shine-ring {
          position: absolute;
          inset: -6px;
          border-radius: 9999px;
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
          background: conic-gradient(
            from 0deg,
            transparent 0%,
            transparent 78%,
            var(--ts-ring-color) 92%,
            #ffffff 98%,
            transparent 100%
          );
          animation: tsRingSpin 3.5s linear infinite;
        }
        @keyframes tsRingSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .ts-line1 { opacity: 0; animation: tsUp 0.4s ease-out 0.35s both; }
        .ts-line2 { opacity: 0; animation: tsUp 0.4s ease-out 1.7s both; }
        .ts-line3 { opacity: 0; animation: tsUp 0.4s ease-out 1.85s both; }
        @keyframes tsUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes tsFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tsFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 1ms !important; animation-delay: 0ms !important; }
        }
      `}</style>
    </>
  );
}

// The winner's reveal badge — what the coin becomes once it settles.
// Not a flipping face anymore (there's only ever one team to show, the
// winner), just a static crest badge built from the same layers as
// every other crest in the broadcast system.
function CoinFace({ team }) {
  const initials = (team.short || team.shortCode || team.name || "?").slice(0, 3).toUpperCase();
  const baseColor = team.color || "#C9971F";

  return (
    <div className="absolute inset-0 rounded-full">
      {/* Rotating conic-gradient arc, masked to a thin ring — identical
          treatment to the shine-ring around team crests in
          CricketMatchIntro and LiveScoreBar's TeamCrest, just tinted to
          this team's own color instead of a fixed blue/green pair. */}
      <div className="ts-shine-ring" style={{ "--ts-ring-color": baseColor }} />

      {/* Metal bezel — brushed-gradient ring around the face, same
          three-stop gradient used on every other crest badge in the
          broadcast system, so the coin reads as struck from the same
          metal as the rest of the UI. */}
      <div
        className="relative w-full h-full rounded-full p-[3px] shadow-2xl"
        style={{
          background:
            "linear-gradient(145deg, var(--color-surface-container-high) 0%, var(--color-outline) 45%, var(--color-surface-container-lowest) 100%)",
        }}
      >
        <div
          className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center"
          style={{
            background: team.logoUrl
              ? "#000000"
              : `linear-gradient(160deg, ${baseColor}dd 0%, ${baseColor} 60%, ${baseColor}99 100%)`,
          }}
        >
          {team.logoUrl ? (
            <img
              src={team.logoUrl}
              alt={`${team.name} crest`}
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <span
              className="font-heading font-black text-lg tracking-tight"
              style={{ color: "#3a2504", fontFamily: "Montserrat, sans-serif" }}
            >
              {initials}
            </span>
          )}

          {/* Gloss highlight + inset shadow — same two layers used on
              every crest badge elsewhere, so the coin's finish matches
              instead of looking like a plain cropped photo. */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 30%, transparent 55%)",
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