"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * TournamentLogoDisplay — top-left readout showing the tournament crest and
 * name together, side by side, as one symmetric unit.
 *
 * FIXED: previously defaulted name/edition/logo to a hardcoded fictional
 * tournament ("MOON KNIGHT CUP" / "valiant-league-logo.png") whenever the
 * caller passed undefined — which meant a real match with no logo set
 * silently displayed an unrelated brand's crest as if it were correct,
 * indistinguishable from genuine data. There is no meaningful default for
 * "which tournament is this" — every value now comes from the caller
 * (ultimately: the `tournaments` table for a tournament match, or the
 * match's own matchSetup for a standalone match). If `name` isn't
 * provided, nothing renders. If `logo` isn't provided, an explicit "no
 * logo" placeholder renders instead of silently substituting a fake one.
 *
 * Position is hard-pinned top-left and not exposed as a prop — this
 * always lives in the same spot.
 */
export default function TournamentLogoDisplay({
  name,
  edition,
  logo,
}: {
  name?: string;
  edition?: string;
  logo?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => setMounted(true), []);
  // Reset the failed-image flag whenever the logo URL itself changes,
  // so a fresh (working) URL isn't stuck showing the placeholder from
  // a previous broken one.
  useEffect(() => setImgFailed(false), [logo]);

  if (!mounted || !name) return null;

  const showPhoto = !!logo && !imgFailed;

  return createPortal(
    <div
      className="tld-wrap fixed z-[90] flex items-center gap-3 sm:gap-4 shrink-0 pointer-events-none"
      style={{ top: "24px", left: "16px" }}
    >
      {showPhoto ? (
        <img
          src={logo}
          alt={name}
          onError={() => setImgFailed(true)}
          className="tld-logo h-14 w-14 sm:h-16 sm:w-16 object-contain shrink-0"
          style={{ filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.8)) drop-shadow(0 0 12px rgba(201,151,31,0.35))" }}
        />
      ) : (
        <div
          className="tld-logo h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-full bg-white/5 border border-white/15 flex items-center justify-center"
          style={{ filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.6))" }}
        >
          <span className="text-white/40 text-[9px] font-bold uppercase tracking-wide">No Logo</span>
        </div>
      )}

      <div className="tld-text flex flex-col items-start justify-center leading-tight">
        <p
          className="font-heading font-black text-lg sm:text-xl uppercase tracking-wide leading-tight"
          style={{ color: "#ffffff", filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.85))" }}
        >
          {name}
        </p>
        {edition && (
          <p
            className="text-[9px] sm:text-[9.5px] font-bold uppercase tracking-[0.2em] mt-1"
            style={{ color: "var(--color-theme-orange, #C9971F)", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.85))" }}
          >
            {edition}
          </p>
        )}
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