"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

// Same fictional tournament identity used across the whole card family.
const TOURNAMENT = {
  name: "MOON KNIGHT CUP",
  edition: "SEASON 7 · T20",
  logo: "/moon-knight-logo.png",
};

/**
 * TournamentLogoDisplay — top-left readout showing the tournament crest and
 * name together, side by side, as one symmetric unit. No flip animation, no
 * "Tournament" eyebrow label — just a bigger logo and the wordmark sitting
 * on the same vertical center, docked permanently top-left over the footage.
 *
 * Position is hard-pinned top-left and not exposed as a prop, same
 * reasoning as the other overlays — this always lives in the same spot.
 */
export default function TournamentLogoDisplay({
  name = TOURNAMENT.name,
  edition = TOURNAMENT.edition,
  logo = TOURNAMENT.logo,
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="tld-wrap fixed z-[90] flex items-center gap-3 sm:gap-4 shrink-0 pointer-events-none"
      style={{ top: "24px", left: "16px" }}
    >
      {/* Logo — bare crest, no medallion ring, just sized up and given a
          drop-shadow for contrast against the footage, same treatment as
          the other unboxed overlays (WeatherCard, LiveScoreBar ticker). */}
      <img
        src={logo}
        alt={name}
        className="tld-logo h-14 w-14 sm:h-16 sm:w-16 object-contain shrink-0"
        style={{ filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.8)) drop-shadow(0 0 12px rgba(201,151,31,0.35))" }}
      />

      {/* Name — vertically centered against the logo so the two read as
          one symmetric lockup rather than a stacked label. */}
      <div className="tld-text flex flex-col items-start justify-center leading-tight">
        <p
          className="font-heading font-black text-lg sm:text-xl uppercase tracking-wide leading-tight"
          style={{ color: "#ffffff", filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.85))" }}
        >
          {name}
        </p>
        <p
          className="text-[9px] sm:text-[9.5px] font-bold uppercase tracking-[0.2em] mt-1"
          style={{ color: "var(--color-theme-orange, #C9971F)", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.85))" }}
        >
          {edition}
        </p>
      </div>

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&display=swap");

        .font-heading {
          font-family: "Montserrat", sans-serif;
        }

        .tld-wrap {
          animation: tldWrapIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes tldWrapIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .tld-logo {
          animation: tldLogoIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s both, tldLogoGlow 3.2s ease-in-out 0.7s infinite;
        }
        @keyframes tldLogoIn {
          0% { opacity: 0; transform: scale(0.5) rotate(-15deg); }
          65% { opacity: 1; transform: scale(1.08) rotate(3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes tldLogoGlow {
          0%, 100% { filter: drop-shadow(0 3px 10px rgba(0,0,0,0.8)) drop-shadow(0 0 10px rgba(201,151,31,0.3)); }
          50% { filter: drop-shadow(0 3px 10px rgba(0,0,0,0.8)) drop-shadow(0 0 16px rgba(201,151,31,0.5)); }
        }

        .tld-text {
          animation: tldTextIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.18s both;
        }
        @keyframes tldTextIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .tld-wrap, .tld-logo, .tld-text {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}