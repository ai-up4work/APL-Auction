"use client";

import { MapPin, Sun, Cloud, CloudSun, CloudRain, CloudLightning, CloudSnow, CloudFog } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

// ---- Icon + tint per condition, so the glow and gradient always match
// what's actually being shown rather than a single fixed accent. ----
const CONDITIONS = {
  sunny: { icon: Sun, color: "#F2B33D", label: "Sunny" },
  clear: { icon: Sun, color: "#F2B33D", label: "Clear" },
  "partly-cloudy": { icon: CloudSun, color: "#9FC6E8", label: "Partly Cloudy" },
  cloudy: { icon: Cloud, color: "#8A93A6", label: "Cloudy" },
  overcast: { icon: Cloud, color: "#6B7280", label: "Overcast" },
  rain: { icon: CloudRain, color: "#4C8BD9", label: "Rain" },
  storm: { icon: CloudLightning, color: "#C9971F", label: "Stormy" },
  snow: { icon: CloudSnow, color: "#CFE6F2", label: "Snow" },
  fog: { icon: CloudFog, color: "#9AA3B0", label: "Foggy" },
};

// Anchor offsets per corner. Top-right is the default: it stays clear of
// the ticker + Standings/Scorecard trigger cluster living bottom-left, and
// mirrors the usual broadcast convention of a channel bug top-left paired
// with secondary info (weather, time) top-right.
const CORNER_STYLE = {
  "top-right": (t, r) => ({ top: t, right: r, alignItems: "flex-end" }),
  "top-left": (t, _r, _b, l) => ({ top: t, left: l, alignItems: "flex-start" }),
  "bottom-right": (_t, r, b) => ({ bottom: b, right: r, alignItems: "flex-end" }),
  "bottom-left": (_t, _r, b, l) => ({ bottom: b, left: l, alignItems: "flex-start" }),
};

/**
 * WeatherCard — compact venue-conditions readout, permanently docked to a
 * screen corner (top-right by default) via a body portal, the same fixed-
 * positioning pattern LiveScoreBar uses. No card chrome — just text and an
 * icon sitting directly over the footage with drop-shadows for contrast —
 * with each element cascading in on its own beat rather than the whole
 * block fading in at once.
 */
export default function WeatherCard({
  venue = "INLAND CRICKET GROUND",
  temp = 28,
  unit = "C",
  condition = "sunny",
  closing = false,
  corner = "top-right",
  topPx = 24,
  rightPx = 24,
  bottomPx = 108,
  leftPx = 16,
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cond = CONDITIONS[condition] ?? CONDITIONS.sunny;
  const Icon = cond.icon;
  const align = (CORNER_STYLE[corner] ?? CORNER_STYLE["top-right"])(topPx, rightPx, bottomPx, leftPx);
  const alignText = align.alignItems === "flex-end" ? "items-end text-right" : "items-start text-left";

  if (!mounted) return null;

  return createPortal(
    <div
      className={`wc-wrap fixed z-[90] flex flex-col ${alignText} shrink-0 pointer-events-none ${closing ? "wc-closing" : ""}`}
      data-closing={closing ? "true" : "false"}
      style={align}
    >
      {/* Eyebrow — pin + label, with a hairline that draws itself in
          underneath, echoing the eyebrow-flanked-by-hairlines device used
          on the other cards, just single-sided since there's no card edge
          to anchor a second line to. */}
      <div className="wc-eyebrow relative z-10 flex items-center gap-1.5 mb-1.5">
        <MapPin className="w-3 h-3 shrink-0" style={{ color: "var(--color-theme-orange, #C9971F)" }} />
        <span className="text-[9px] sm:text-[9.5px] font-bold uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.85)" }}>
          Weather
        </span>
      </div>
      <div
        className={`wc-hairline h-px w-16 sm:w-20 mb-2 ${align.alignItems === "flex-end" ? "self-end" : "self-start"}`}
        style={{
          background:
            align.alignItems === "flex-end"
              ? "linear-gradient(90deg, transparent, rgba(201,151,31,0.7))"
              : "linear-gradient(90deg, rgba(201,151,31,0.7), transparent)",
          transformOrigin: align.alignItems === "flex-end" ? "right" : "left",
        }}
      />

      {/* Reading — icon + temperature, anchored to the same baseline */}
      <div className="wc-reading relative z-10 flex items-center gap-2.5">
        <Icon
          className="wc-icon w-8 h-8 sm:w-9 sm:h-9 shrink-0"
          style={{ color: cond.color, filter: `drop-shadow(0 0 10px ${cond.color}99) drop-shadow(0 2px 4px rgba(0,0,0,0.6))` }}
          strokeWidth={1.75}
        />
        <span
          className="font-heading font-black text-3xl sm:text-4xl leading-none tabular-nums"
          style={{ color: "#ffffff", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.85))" }}
        >
          {temp}
          <span className="text-lg sm:text-xl font-bold align-top" style={{ color: "rgba(255,255,255,0.75)" }}>
            °{unit}
          </span>
        </span>
      </div>

      {/* Condition label */}
      <p
        className="wc-condition relative z-10 mt-1 text-[11px] sm:text-xs font-bold uppercase tracking-wide"
        style={{ color: "#ffffff", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.85))" }}
      >
        {cond.label}
      </p>

      {/* Venue — quietest line, arrives last */}
      <p
        className="wc-venue relative z-10 mt-0.5 text-[8px] sm:text-[8.5px] font-semibold uppercase tracking-[0.12em] max-w-[180px] truncate"
        style={{ color: "rgba(255,255,255,0.6)", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.85))" }}
      >
        {venue}
      </p>

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Montserrat:wght@800;900&display=swap");

        .font-heading {
          font-family: "Montserrat", sans-serif;
        }

        /* Entrance — each line arrives on its own beat, icon leading with
           a little overshoot spin-in, hairline drawing itself under the
           label, then temperature/condition/venue cascading down after.
           Exit reverses the order (venue first, icon last) about twice as
           fast, like the readout is being wiped away top-to-bottom. */

        .wc-eyebrow {
          animation: wcSlideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both;
        }
        .wc-hairline {
          animation: wcHairlineIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.16s both;
        }
        .wc-icon {
          animation: wcIconIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0s both, wcIconGlow 3.2s ease-in-out 0.6s infinite;
        }
        .wc-reading {
          animation: wcSlideIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both;
        }
        .wc-condition {
          animation: wcSlideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both;
        }
        .wc-venue {
          animation: wcSlideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.38s both;
        }

        .wc-wrap.wc-closing .wc-eyebrow,
        .wc-wrap.wc-closing .wc-hairline,
        .wc-wrap.wc-closing .wc-icon,
        .wc-wrap.wc-closing .wc-reading,
        .wc-wrap.wc-closing .wc-condition,
        .wc-wrap.wc-closing .wc-venue {
          animation: none;
        }

        @keyframes wcSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wcHairlineIn {
          from { opacity: 0; transform: scaleX(0); }
          to { opacity: 1; transform: scaleX(1); }
        }
        @keyframes wcIconIn {
          0% { opacity: 0; transform: scale(0.4) rotate(-25deg); }
          65% { opacity: 1; transform: scale(1.12) rotate(4deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes wcIconGlow {
          0%, 100% { filter: drop-shadow(0 0 10px currentColor) drop-shadow(0 2px 4px rgba(0,0,0,0.6)); opacity: 1; }
          50% { filter: drop-shadow(0 0 16px currentColor) drop-shadow(0 2px 4px rgba(0,0,0,0.6)); opacity: 0.92; }
        }

        /* Exit choreography — applied via the wcOut wrapper animation on
           the whole block for a fast, unified wipe rather than staggering
           the same five delays in reverse (which would take too long for
           an exit). */
        .wc-wrap.wc-closing {
          animation: wcWipeOut 0.28s cubic-bezier(0.4, 0, 1, 1) both;
        }
        @keyframes wcWipeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-10px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .wc-eyebrow, .wc-hairline, .wc-icon, .wc-reading, .wc-condition, .wc-venue, .wc-wrap.wc-closing {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}