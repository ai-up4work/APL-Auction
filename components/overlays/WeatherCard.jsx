"use client";

import { MapPin, Sun, Cloud, CloudSun, CloudRain, CloudLightning, CloudSnow, CloudFog } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

// ---- Icon + tint per condition, so the glow and gradient always match
// what's actually being shown rather than a single fixed accent. Exported
// so a parent can spread extra/override conditions in via the
// `conditions` prop instead of editing this file. ----
export const DEFAULT_CONDITIONS = {
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
 * icon sitting directly over the footage with drop-shadows for contrast.
 *
 * All data (venue/temp/unit/condition) and layout (corner + offsets) are
 * props. `conditions` lets a parent add/override condition entries
 * without touching this file (merged over DEFAULT_CONDITIONS).
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
  conditions = {},
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const mergedConditions = { ...DEFAULT_CONDITIONS, ...conditions };
  const cond = mergedConditions[condition] ?? mergedConditions.sunny;
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
      {/* Reading — icon + temperature, now the first thing in the block so
          it sits flush with topPx, matching the logo display's top edge on
          the opposite corner instead of trailing a label underneath it. */}
      <div className="wc-reading relative z-10 flex items-center gap-2.5">
        <Icon
          className="wc-icon w-9 h-9 sm:w-10 sm:h-10 shrink-0"
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
        className="wc-condition relative z-10 mt-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide"
        style={{ color: "#ffffff", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.85))" }}
      >
        {cond.label}
      </p>

      {/* Venue — pin icon inline now that the separate "Weather" eyebrow is
          gone, so the location marker still reads clearly on its own line. */}
      <p
        className="wc-venue relative z-10 mt-1 flex items-center gap-1 text-[8px] sm:text-[8.5px] font-semibold uppercase tracking-[0.12em] max-w-[200px]"
        style={{ color: "rgba(255,255,255,0.6)", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.85))" }}
      >
        <MapPin className="w-2.5 h-2.5 shrink-0" style={{ color: "var(--color-theme-orange, #C9971F)" }} />
        <span className="truncate">{venue}</span>
      </p>

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Montserrat:wght@800;900&display=swap");

        .font-heading {
          font-family: "Montserrat", sans-serif;
        }

        .wc-icon {
          animation: wcIconIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0s both, wcIconGlow 3.2s ease-in-out 0.6s infinite;
        }
        .wc-reading {
          animation: wcSlideIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both;
        }
        .wc-condition {
          animation: wcSlideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.16s both;
        }
        .wc-venue {
          animation: wcSlideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.24s both;
        }

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
        @keyframes wcIconIn {
          0% { opacity: 0; transform: scale(0.4) rotate(-25deg); }
          65% { opacity: 1; transform: scale(1.12) rotate(4deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes wcIconGlow {
          0%, 100% { filter: drop-shadow(0 0 10px currentColor) drop-shadow(0 2px 4px rgba(0,0,0,0.6)); opacity: 1; }
          50% { filter: drop-shadow(0 0 16px currentColor) drop-shadow(0 2px 4px rgba(0,0,0,0.6)); opacity: 0.92; }
        }

        .wc-wrap.wc-closing {
          animation: wcWipeOut 0.28s cubic-bezier(0.4, 0, 1, 1) both;
        }
        @keyframes wcWipeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-10px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .wc-icon, .wc-reading, .wc-condition, .wc-venue, .wc-wrap.wc-closing {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}