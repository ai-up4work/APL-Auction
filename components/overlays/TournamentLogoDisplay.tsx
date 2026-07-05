"use client";

import { Trophy } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

// Same fictional tournament identity used across the whole card family.
const TOURNAMENT = {
  name: "MOON KNIGHT CUP",
  edition: "SEASON 7 · T20",
  logo: "/moon-knight-logo.png",
};

const FLIP_DURATION_MS = 900;

/**
 * TournamentLogoDisplay — top-left readout that alternates between the
 * tournament's wordmark and its crest on a timer. No card chrome at all —
 * same treatment as WeatherCard: just text/icon sitting directly over the
 * footage with drop-shadows for contrast, docked permanently to the top
 * left. The change between wordmark and crest is a real 3D flip rather
 * than a cross-fade, with a brief light streak catching it edge-on and a
 * soft glow pulse right as the new face lands — the animation is the
 * point, since there's no box to otherwise signal "something happened."
 *
 * Position is hard-pinned top-left and not exposed as a prop, same
 * reasoning as the other overlays — this always lives in the same spot.
 * `intervalMs` and the tournament identity are the only knobs.
 */
export default function TournamentLogoDisplay({
  name = TOURNAMENT.name,
  edition = TOURNAMENT.edition,
  logo = TOURNAMENT.logo,
  intervalMs = 5000,
}) {
  const [mounted, setMounted] = useState(false);
  const [face, setFace] = useState("name"); // "name" | "logo"
  const [flipKey, setFlipKey] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const id = setInterval(() => {
      setFace((f) => (f === "name" ? "logo" : "name"));
      setFlipKey((k) => k + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  if (!mounted) return null;

  const flipped = face === "logo";

  return createPortal(
    <div
      className="tld-wrap fixed z-[90] flex flex-col items-start shrink-0 pointer-events-none"
      style={{ top: "24px", left: "16px" }}
    >
      {/* Eyebrow — trophy + label, hairline draws in underneath, same
          device as WeatherCard's pin + "Weather" label. */}
      <div className="tld-eyebrow relative z-10 flex items-center gap-1.5 mb-1.5">
        <Trophy className="w-3 h-3 shrink-0" style={{ color: "var(--color-theme-orange, #C9971F)" }} />
        <span
          className="text-[9px] sm:text-[9.5px] font-bold uppercase tracking-[0.22em]"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          Tournament
        </span>
      </div>
      <div
        className="tld-hairline h-px w-16 sm:w-20 mb-2 self-start"
        style={{
          background: "linear-gradient(90deg, rgba(201,151,31,0.7), transparent)",
          transformOrigin: "left",
        }}
      />

      {/* Flip stage — no background, no border. Fixed footprint so
          swapping faces doesn't jump the layout; each face is just text
          or an image with a drop-shadow for contrast against the footage. */}
      <div className="relative z-10 w-40 h-11 sm:w-48 sm:h-12" style={{ perspective: "900px" }}>
        <div
          className="tld-card absolute inset-0"
          style={{
            transformStyle: "preserve-3d",
            transition: `transform ${FLIP_DURATION_MS}ms cubic-bezier(0.34, 1.4, 0.44, 1)`,
            transform: `rotateY(${flipped ? 180 : 0}deg)`,
          }}
        >
          {/* Front — wordmark */}
          <div
            className="absolute inset-0 flex flex-col items-start justify-center"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p
              className="font-heading font-black text-base sm:text-lg uppercase tracking-wide leading-tight"
              style={{ color: "#ffffff", filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.85))" }}
            >
              {name}
            </p>
            <p
              className="text-[8px] sm:text-[8.5px] font-bold uppercase tracking-[0.2em] mt-0.5"
              style={{ color: "var(--color-theme-orange, #C9971F)", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.85))" }}
            >
              {edition}
            </p>
          </div>

          {/* Back — crest, pre-rotated 180deg so it reads right-side up
              once the parent has finished its own flip. Bare image, no
              medallion/ring chrome. */}
          <div
            className="absolute inset-0 flex items-center justify-start"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <img
              src={logo}
              alt={name}
              className="tld-logo h-10 sm:h-11 w-auto object-contain"
              style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.75)) drop-shadow(0 0 10px rgba(201,151,31,0.35))" }}
            />
          </div>
        </div>

        {/* Mid-flip flash — a brief light streak timed to the edge-on
            moment of the rotation. Restarts every cycle via key. */}
        <span key={flipKey} className="tld-flash absolute inset-0 pointer-events-none" />
      </div>

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&display=swap");

        .font-heading {
          font-family: "Montserrat", sans-serif;
        }

        .tld-wrap {
          animation: tldWrapIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes tldWrapIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .tld-eyebrow {
          animation: tldSlideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both;
        }
        .tld-hairline {
          animation: tldHairlineIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.16s both;
          transform: scaleX(0);
        }
        @keyframes tldSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tldHairlineIn {
          from { opacity: 0; transform: scaleX(0); }
          to { opacity: 1; transform: scaleX(1); }
        }

        .tld-logo {
          animation: tldLogoGlow 3.2s ease-in-out infinite;
        }
        @keyframes tldLogoGlow {
          0%, 100% { filter: drop-shadow(0 3px 8px rgba(0,0,0,0.75)) drop-shadow(0 0 8px rgba(201,151,31,0.3)); }
          50% { filter: drop-shadow(0 3px 8px rgba(0,0,0,0.75)) drop-shadow(0 0 14px rgba(201,151,31,0.5)); }
        }

        /* Mid-flip flash — no border, no box: just a soft diagonal streak
           of light passing through the stage exactly as the face turns
           edge-on, blended additively so it reads as a glint rather than
           a wipe. */
        .tld-flash {
          background: linear-gradient(
            100deg,
            transparent 0%,
            transparent 40%,
            rgba(255, 255, 255, 0.5) 50%,
            transparent 60%,
            transparent 100%
          );
          mix-blend-mode: screen;
          opacity: 0;
          animation-name: tldFlash;
          animation-duration: ${FLIP_DURATION_MS}ms;
          animation-timing-function: ease-in-out;
          animation-fill-mode: both;
        }
        @keyframes tldFlash {
          0% { opacity: 0; transform: translateX(-60%); }
          45% { opacity: 0; }
          50% { opacity: 1; transform: translateX(0%); }
          55% { opacity: 0; }
          100% { opacity: 0; transform: translateX(60%); }
        }

        @media (prefers-reduced-motion: reduce) {
          .tld-wrap, .tld-eyebrow, .tld-hairline, .tld-logo, .tld-flash {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
          .tld-card {
            transition-duration: 1ms !important;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}