"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import CricketBall from "./shared/CricketBall";

/* ============================================================
   MOON KNIGHT SUPER LEAGUE — celebration theme tokens
   Palette pulled straight from the crest:
     night-navy   #0A1220   deep sky / card body
     cloak-black  #05070C   shadow depth
     crest-gold   #D4AF37   trim, banner, six/century
     steel-silver #C7CFDE   armor, four/fifty
     moon-glow    #EAF1FB   crescent light, highlights
     blood-crimson #A32F2A  wicket ("blood moon")

   ------------------------------------------------------------
   REDESIGN NOTES (this pass)
   ------------------------------------------------------------
   1. The old design boxed everything into a small rounded glass
      card in the middle of the screen, and only THAT box blurred
      its own backdrop. That's gone.
   2. The whole broadcast frame now blurs — a single full-viewport
      "ScreenBlur" layer sits beneath everything, so the live feed
      itself goes soft the instant a moment fires, like the camera
      racked focus onto the celebration instead of a popup sitting
      on top of the picture.
   3. Text and iconography now float directly in open space, lit by
      glow/shadow rather than contained by a panel. To keep that
      from reading as "text just floating with nothing to say it's
      designed," a handful of crest-derived motifs do the framing
      work instead of a box:
        - a large soft crescent halo drifting behind everything
        - the crest sigil (crescent + knight helmet) enlarged and
          placed as a glowing mark directly behind the mode icon
        - a folded gold ribbon for the subtitle (echoes the
          "AKKARAIPATTU" ribbon on the actual crest artwork)
        - thin gold hairlines at the very top/bottom edges of the
          screen that shimmer once, like a broadcast frame waking up
        - faint crescent flourishes tucked into the four corners
   ============================================================ */

export const DEFAULT_MOMENTS = {
  four: {
    mode: "ball",
    label: "FOUR",
    subtitle: "+4 RUNS",
    accent: "#8FA6C9",
    accentSoft: "rgba(143,166,201,0.4)",
    gradient: "linear-gradient(180deg, #f4f8ff 0%, #cfe0f5 30%, #8fa6c9 62%, #3d5a82 100%)",
    glow: "rgba(143,166,201,0.7)",
    particleCount: 22,
    particleDist: [110, 230],
    fireworks: 0,
    confetti: false,
    dropText: false,
    duration: 2400,
  },
  six: {
    mode: "ball",
    label: "SIX",
    subtitle: "+6 RUNS",
    accent: "#D4AF37",
    accentSoft: "rgba(212,175,55,0.45)",
    gradient: "linear-gradient(180deg, #fff6d8 0%, #ecca6c 32%, #d4af37 62%, #8a6a1a 84%, #4d3a0d 100%)",
    glow: "rgba(230,190,80,0.75)",
    particleCount: 38,
    particleDist: [160, 320],
    fireworks: 5,
    confetti: true,
    dropText: false,
    duration: 3200,
  },
  wicket: {
    mode: "stumps",
    label: "OUT",
    subtitle: "WICKET!",
    accent: "#A32F2A",
    accentSoft: "rgba(163,47,42,0.5)",
    gradient: "linear-gradient(180deg, #ffffff 0%, #f0c9c5 26%, #a32f2a 66%, #380f0c 100%)",
    glow: "rgba(163,47,42,0.85)",
    particleCount: 16,
    particleDist: [70, 150],
    fireworks: 0,
    confetti: false,
    dropText: true,
    duration: 2600,
  },
  fifty: {
    mode: "milestone",
    label: "FIFTY",
    subtitle: "50 RUNS",
    accent: "#C7CFDE",
    accentSoft: "rgba(199,207,222,0.4)",
    gradient: "linear-gradient(180deg, #ffffff 0%, #e7ecf5 32%, #c7cfde 66%, #5c6a83 100%)",
    glow: "rgba(220,228,240,0.75)",
    particleCount: 26,
    particleDist: [120, 240],
    fireworks: 0,
    confetti: false,
    dropText: false,
    duration: 2600,
  },
  hundred: {
    mode: "milestone",
    label: "CENTURY",
    subtitle: "100 RUNS",
    accent: "#D4AF37",
    accentSoft: "rgba(212,175,55,0.45)",
    gradient: "linear-gradient(180deg, #fff6d8 0%, #f0e2ff 26%, #ecca6c 52%, #d4af37 80%, #4d3a0d 100%)",
    glow: "rgba(230,195,110,0.8)",
    particleCount: 46,
    particleDist: [170, 340],
    fireworks: 8,
    confetti: true,
    dropText: false,
    duration: 3800,
  },
  maiden: {
    mode: "shield",
    label: "MAIDEN",
    subtitle: "OVER",
    accent: "#6E8FC9",
    accentSoft: "rgba(110,143,201,0.4)",
    gradient: "linear-gradient(180deg, #eaf1ff 0%, #a8c0e8 38%, #5578b0 74%, #1c2c50 100%)",
    glow: "rgba(110,143,201,0.7)",
    particleCount: 20,
    particleDist: [90, 200],
    fireworks: 0,
    confetti: false,
    dropText: false,
    duration: 2600,
  },
  // base template for the match-won celebration. label/subtitle/accent/
  // gradient get overridden per-fire with the actual winning team's name,
  // margin, and brand color (see trigger() below).
  matchWon: {
    mode: "trophy",
    label: "WINNER",
    subtitle: "MATCH WON",
    accent: "#D4AF37",
    accentSoft: "rgba(212,175,55,0.45)",
    gradient: "linear-gradient(180deg, #fff6d8 0%, #ecca6c 30%, #d4af37 60%, #8a6a1a 85%, #4d3a0d 100%)",
    glow: "rgba(230,195,110,0.85)",
    particleCount: 46,
    particleDist: [160, 340],
    fireworks: 10,
    confetti: true,
    dropText: false,
    duration: 5200,
  },
};

const EXIT_DURATION_MS = 380;
export const DEFAULT_CONFETTI_COLORS = ["#D4AF37", "#EAF1FB", "#C7CFDE", "#8FA6C9", "#ffffff"];

// how strongly the whole broadcast frame blurs when a moment fires.
// wicket/matchWon get a slightly heavier rack-focus than a routine four.
const SCREEN_BLUR_PX = {
  ball: 10,
  stumps: 13,
  trophy: 16,
  milestone: 12,
  shield: 11,
};

function seededRand(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
function px(v) {
  return Math.round(v);
}

function flightFill(accent) {
  return `radial-gradient(circle at 32% 26%, #fdf6e3 0%, #e9d18f 26%, ${accent} 62%, #1c1204 100%)`;
}

// a one-color gradient built from the winning team's brand color, so
// "matchWon" doesn't always look gold regardless of who won.
function soloGradient(color) {
  return `linear-gradient(180deg, #ffffff 0%, ${color} 45%, ${color} 78%, #05070c 120%)`;
}

/* ------------------------------------------------------------
   ScreenBlur — the actual fix the whole redesign hangs on.

   One fixed, full-viewport layer that backdrop-blurs whatever is
   behind this overlay (the live broadcast picture), plus a soft
   navy scrim so the blur reads as "night has fallen on the ground"
   rather than a generic frosted-glass panel. It fades in on its
   own (not tied to the card, because there is no card anymore),
   so the rack-focus feels like the very first thing that happens.
   ------------------------------------------------------------ */
function ScreenBlur({ blurPx, accentSoft }) {
  return (
    <>
      <div
        className="mk-screen-blur absolute inset-0"
        style={{
          backdropFilter: `blur(${blurPx}px) saturate(1.08)`,
          WebkitBackdropFilter: `blur(${blurPx}px) saturate(1.08)`,
          background:
            "linear-gradient(180deg, rgba(5,7,12,0.38) 0%, rgba(5,7,12,0.5) 55%, rgba(5,7,12,0.62) 100%)",
        }}
      />
      <div
        className="mk-screen-tint absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 120% 90% at 50% 48%, ${accentSoft} 0%, rgba(5,7,12,0.15) 55%, rgba(5,7,12,0.35) 100%)`,
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------
   CrescentHalo — the huge, slow-drifting crescent that used to
   live faintly inside the card. Now it's scaled to the room the
   whole screen gives it: a soft light source the rest of the
   moment appears to be lit by, always upper-frame, never blocking
   the headline.
   ------------------------------------------------------------ */
function CrescentHalo({ accent, glow }) {
  return (
    <svg
      className="mk-crescent-halo absolute pointer-events-none"
      style={{ top: "-14vh", left: "50%", transform: "translateX(-50%)" }}
      width="1400"
      height="900"
      viewBox="0 0 1400 900"
    >
      <defs>
        <radialGradient id="mkHaloGlow" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor={glow} stopOpacity="0.55" />
          <stop offset="55%" stopColor={accent} stopOpacity="0.16" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mkHaloCrescent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EAF1FB" />
          <stop offset="100%" stopColor="#8FA6C9" />
        </linearGradient>
      </defs>
      <ellipse cx="700" cy="260" rx="620" ry="420" fill="url(#mkHaloGlow)" />
      <path
        d="M840 40 C700 66 596 190 596 330 C596 470 700 594 840 620 C740 604 664 486 664 330 C664 174 740 56 840 40 Z"
        fill="url(#mkHaloCrescent)"
        opacity="0.5"
      />
    </svg>
  );
}

/* ------------------------------------------------------------
   Crest sigil — crescent + knight helmet, the same emblem that
   sits above the wordmark on the actual crest artwork. This now
   glows directly behind the mode icon instead of being a flat
   watermark, so the icon reads as "sitting inside the crest" the
   same way the cricket ball/trophy/shield sits inside the badge
   on the real logo.
   ------------------------------------------------------------ */
function CrestSigil({ accent, glow, size = 380 }) {
  return (
    <svg
      className="mk-crest-mark absolute pointer-events-none"
      width={size}
      height={size}
      viewBox="0 0 380 380"
      style={{ opacity: 0.4, filter: `drop-shadow(0 0 34px ${glow})` }}
    >
      {/* crescent */}
      <path
        d="M235 60 C170 70 122 128 122 195 C122 262 170 320 235 330 C185 322 148 264 148 195 C148 126 185 68 235 60 Z"
        fill="url(#mkCrescentGrad)"
      />
      {/* helmet silhouette, simplified */}
      <path
        d="M190 150 C160 150 140 175 138 205 L138 250 C138 258 144 264 152 264 L160 264 L160 280 L220 280 L220 264 L228 264 C236 264 242 258 242 250 L242 205 C240 175 220 150 190 150 Z M182 205 L182 255 M198 205 L198 255"
        fill="none"
        stroke="url(#mkHelmGrad)"
        strokeWidth="4"
      />
      <defs>
        <linearGradient id="mkCrescentGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EAF1FB" />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
        <linearGradient id="mkHelmGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EAF1FB" />
          <stop offset="100%" stopColor="#C7CFDE" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// twinkling starfield — same night-sky ambience as the crest artwork,
// present behind every celebration mode, now spread across the whole
// blurred screen rather than a small card.
function Starfield({ triggerId }) {
  const stars = Array.from({ length: 60 }, (_, i) => {
    const base = triggerId * 97 + i * 23;
    const left = seededRand(base) * 100;
    const top = seededRand(base + 1) * 78; // keep the lower stage clear-ish for the scoreboard
    const size = 1 + seededRand(base + 2) * 2.4;
    const delay = seededRand(base + 3) * 3;
    const duration = 1.8 + seededRand(base + 4) * 2.4;
    return { id: i, left, top, size, delay, duration };
  });
  return (
    <div className="absolute inset-0 overflow-hidden">
      {stars.map((s) => (
        <span
          key={s.id}
          className="mk-star absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: "#EAF1FB",
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------
   CornerFlourish — a small crescent tucked into each corner of
   the viewport, very low opacity. This is the "frame" a card used
   to provide, done as four quiet accents instead of a box.
   ------------------------------------------------------------ */
function CornerFlourish({ corner, accent }) {
  const flips = {
    tl: { transform: "scaleX(1) scaleY(1)", style: { top: 22, left: 22 } },
    tr: { transform: "scaleX(-1) scaleY(1)", style: { top: 22, right: 22 } },
    bl: { transform: "scaleX(1) scaleY(-1)", style: { bottom: 22, left: 22 } },
    br: { transform: "scaleX(-1) scaleY(-1)", style: { bottom: 22, right: 22 } },
  };
  const f = flips[corner];
  return (
    <svg
      className="mk-corner-flourish absolute pointer-events-none"
      width="72"
      height="72"
      viewBox="0 0 72 72"
      style={{ ...f.style, transform: f.transform }}
    >
      <path
        d="M54 6 C34 10 20 26 20 44 C20 58 28 68 38 70 C28 65 22 55 22 43 C22 27 34 12 54 6 Z"
        fill="none"
        stroke={accent}
        strokeWidth="1.4"
        opacity="0.55"
      />
      <circle cx="18" cy="14" r="1.6" fill={accent} opacity="0.75" />
    </svg>
  );
}

/* ------------------------------------------------------------
   TopBottomHairline — thin gold lines at the very top and bottom
   edge of the screen that shimmer once when a moment fires. Reads
   as a broadcast frame waking up, not a box around the content.
   ------------------------------------------------------------ */
function EdgeHairlines({ accent }) {
  return (
    <>
      <div
        className="mk-edge-line mk-edge-top absolute top-0 left-0 right-0"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
      <div
        className="mk-edge-line mk-edge-bottom absolute bottom-0 left-0 right-0"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
    </>
  );
}

/* ------------------------------------------------------------
   RibbonBanner — a folded gold ribbon for the subtitle, the same
   device the real crest uses under the wordmark. Pure CSS: a
   clipped bar plus two small folded tails.
   ------------------------------------------------------------ */
function RibbonBanner({ text, accent }) {
  return (
    <div className="mk-ribbon-wrap relative flex items-center justify-center">
      <span className="mk-ribbon-tail mk-ribbon-tail-l" style={{ background: accent }} />
      <span className="mk-ribbon-tail mk-ribbon-tail-r" style={{ background: accent }} />
      <div
        className="mk-ribbon-bar relative"
        style={{
          background: `linear-gradient(160deg, #fff6d8 0%, ${accent} 45%, #5c4410 100%)`,
        }}
      >
        <span className="mk-ribbon-text font-heading font-black uppercase tracking-[0.32em]">
          {text}
        </span>
      </div>
    </div>
  );
}

// Holds whichever mode-graphic is active (ball / stumps / trophy /
// milestone badge / shield) in its own slot ABOVE the headline, instead
// of layered directly on top of it.
function IconSlot({ children, minHeight }) {
  if (!children) return null;
  return (
    <div className="relative flex items-center justify-center" style={{ minHeight, width: "100%" }}>
      {children}
    </div>
  );
}

// stumps now snap apart as steel-and-gold bails, matching the armor
// palette instead of generic wood tones.
function StumpsShatter() {
  const pieces = [
    { id: "s1", w: 11, h: 78, x: -20, y: 12, rot: -35, tx: -60, ty: 130, delay: 0.02 },
    { id: "s2", w: 11, h: 78, x: 0, y: 12, rot: 20, tx: 16, ty: 154, delay: 0.06 },
    { id: "s3", w: 11, h: 78, x: 20, y: 12, rot: 55, tx: 84, ty: 118, delay: 0.1 },
    { id: "b1", w: 30, h: 7, x: -10, y: -26, rot: -80, tx: -96, ty: 36, delay: 0 },
    { id: "b2", w: 30, h: 7, x: 10, y: -26, rot: 95, tx: 96, ty: 36, delay: 0 },
  ];
  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="mk-stump absolute rounded-sm"
          style={{
            width: p.w,
            height: p.h,
            left: `calc(50% + ${p.x}px)`,
            top: `calc(50% + ${p.y}px)`,
            marginLeft: -p.w / 2,
            marginTop: -p.h / 2,
            background: "linear-gradient(180deg, #f0e6c9 0%, #C7CFDE 45%, #5c6a83 75%, #1c2233 100%)",
            boxShadow: "inset -2px 0 3px rgba(0,0,0,0.35), 0 3px 6px rgba(0,0,0,0.55)",
            "--rot": `${p.rot}deg`,
            "--tx": `${p.tx}px`,
            "--ty": `${p.ty}px`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </>
  );
}

// trophy rise-in for the "matchWon" moment. A crescent moon halo now
// arcs behind the trophy/logo instead of a generic ray burst, and the
// dais carries a thin gold crest line to echo the banner in the logo.
function TrophyRise({ cfg, logoUrl }) {
  return (
    <div className="mk-trophy-wrap relative flex flex-col items-center">
      <svg className="mk-trophy-crescent absolute" width="260" height="260" viewBox="0 0 220 220" style={{ opacity: 0.55 }}>
        <path
          d="M150 20 C100 28 62 68 62 112 C62 156 100 196 150 204 C112 198 84 158 84 112 C84 66 112 26 150 20 Z"
          fill={cfg.accent}
          opacity="0.6"
        />
      </svg>
      <span className="mk-trophy-rays" style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${cfg.glow} 12deg, transparent 24deg)` }} />
      <span className="mk-trophy-ring" style={{ borderColor: cfg.accent, boxShadow: `0 0 32px ${cfg.glow}` }} />
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="rounded-full object-cover relative z-10"
          style={{ width: 140, height: 140, border: `3px solid ${cfg.accent}`, boxShadow: `0 0 34px ${cfg.glow}` }}
        />
      ) : (
        <span className="relative z-10" style={{ fontSize: 120, filter: `drop-shadow(0 0 30px ${cfg.glow})` }}>
          🏆
        </span>
      )}
      <span className="mk-trophy-dais" style={{ background: `linear-gradient(180deg, ${cfg.accent} 0%, transparent 100%)` }} />
    </div>
  );
}

// milestone medallion used by Fifty and Century. Laurel leaves are
// replaced with a crescent-and-star flank so the badge reads as part
// of the same crest family rather than a generic sports medal.
function MilestoneBadge({ cfg }) {
  const isCentury = cfg.label === "CENTURY";
  const number = isCentury ? "100" : "50";
  return (
    <div className="mk-milestone-wrap relative flex items-center justify-center">
      <span className="mk-milestone-rays" style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${cfg.glow} 10deg, transparent 20deg)` }} />
      <svg width="168" height="168" viewBox="0 0 136 136" style={{ filter: `drop-shadow(0 0 26px ${cfg.glow})` }}>
        <circle cx="68" cy="68" r="60" fill="none" stroke={cfg.accent} strokeWidth="3" opacity="0.65" />
        <circle cx="68" cy="68" r="51" fill={`url(#mkMedal-${isCentury ? "gold" : "silver"})`} />
        <defs>
          <radialGradient id="mkMedal-gold" cx="35%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#fff8df" />
            <stop offset="45%" stopColor="#ecca6c" />
            <stop offset="100%" stopColor="#5c4410" />
          </radialGradient>
          <radialGradient id="mkMedal-silver" cx="35%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#dbe2ee" />
            <stop offset="100%" stopColor="#4c5872" />
          </radialGradient>
        </defs>
        <text
          x="68"
          y="80"
          textAnchor="middle"
          fontSize="38"
          fontWeight="900"
          fill={isCentury ? "#3a2a06" : "#232c3d"}
          fontFamily="var(--font-heading, sans-serif)"
        >
          {number}
        </text>
      </svg>
      {/* crescent + star flanks, in place of laurel leaves */}
      <svg className="mk-flank mk-flank-left" width="38" height="38" viewBox="0 0 34 34">
        <path d="M24 4 C14 6 7 14 7 22 C7 28 11 33 16 34 C11 31 8 25 8 19 C8 12 14 6 24 4 Z" fill={cfg.accent} />
      </svg>
      <svg className="mk-flank mk-flank-right" width="20" height="20" viewBox="0 0 18 18">
        <path d="M9 0 L11 6 L17 8 L11 10 L9 17 L7 10 L1 8 L7 6 Z" fill={cfg.accent} />
      </svg>
    </div>
  );
}

// shield for a Maiden Over, reshaped to the crest's own pointed heraldic
// silhouette rather than a generic rounded shield, with a crescent+drop
// standing in for the "0".
function MaidenShield({ cfg }) {
  return (
    <div className="mk-shield-wrap relative flex items-center justify-center">
      <svg width="136" height="152" viewBox="0 0 112 126" style={{ filter: `drop-shadow(0 0 24px ${cfg.glow})` }}>
        <path
          d="M56 4 L104 20 V60 C104 92 84 111 56 122 C28 111 8 92 8 60 V20 Z"
          fill="url(#mkShieldGrad)"
          stroke={cfg.accent}
          strokeWidth="2.5"
        />
        <path
          d="M56 14 L96 27 V58 C96 84 80 100 56 110 C32 100 16 84 16 58 V27 Z"
          fill="none"
          stroke={cfg.accent}
          strokeWidth="1"
          opacity="0.5"
        />
        <defs>
          <linearGradient id="mkShieldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eaf1ff" />
            <stop offset="55%" stopColor="#8fa8d6" />
            <stop offset="100%" stopColor={cfg.accent} />
          </linearGradient>
        </defs>
        <text x="56" y="76" textAnchor="middle" fontSize="42" fontWeight="900" fill="#0d1a33" fontFamily="var(--font-heading, sans-serif)">
          0
        </text>
      </svg>
    </div>
  );
}

function Particles({ cfg, triggerId }) {
  const items = Array.from({ length: cfg.particleCount }, (_, i) => {
    const base = triggerId * 137 + i * 19;
    const angle = (i / cfg.particleCount) * Math.PI * 2 + (seededRand(base) - 0.5) * 0.5;
    const dist = cfg.particleDist[0] + seededRand(base + 1) * (cfg.particleDist[1] - cfg.particleDist[0]);
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist * 0.72;
    const size = 6 + seededRand(base + 2) * 8;
    const delay = 0.5 + seededRand(base + 3) * 0.12;
    return { id: i, tx, ty, size, delay };
  });
  return (
    <>
      {items.map((p) => (
        <span
          key={p.id}
          className="mk-particle absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: p.size,
            height: p.size,
            marginLeft: -p.size / 2,
            marginTop: -p.size / 2,
            background: cfg.accent,
            boxShadow: `0 0 6px ${cfg.glow}`,
            "--tx": `${px(p.tx)}px`,
            "--ty": `${px(p.ty)}px`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function Fireworks({ cfg, triggerId, confettiColors }) {
  const bursts = Array.from({ length: cfg.fireworks }, (_, i) => {
    const base = triggerId * 251 + i * 41;
    const left = 12 + seededRand(base) * 76;
    const top = 8 + seededRand(base + 1) * 38;
    const delay = 0.9 + seededRand(base + 2) * 1.6;
    const color = confettiColors[i % confettiColors.length];
    const sparks = Array.from({ length: 14 }, (_, j) => {
      const b2 = base + j * 7;
      const angle = (j / 14) * Math.PI * 2 + seededRand(b2) * 0.4;
      const dist = 40 + seededRand(b2 + 1) * 46;
      return { tx: Math.cos(angle) * dist, ty: Math.sin(angle) * dist, id: j };
    });
    return { id: i, left, top, delay, color, sparks };
  });
  return (
    <>
      {bursts.map((b) => (
        <span key={b.id} className="absolute" style={{ left: `${b.left}vw`, top: `${b.top}vh`, width: 0, height: 0 }}>
          {b.sparks.map((s) => (
            <span
              key={s.id}
              className="mk-firework-spark absolute rounded-full"
              style={{
                width: 5,
                height: 5,
                background: b.color,
                boxShadow: `0 0 8px ${b.color}`,
                "--tx": `${px(s.tx)}px`,
                "--ty": `${px(s.ty)}px`,
                animationDelay: `${b.delay}s`,
              }}
            />
          ))}
        </span>
      ))}
    </>
  );
}

function Confetti({ triggerId, confettiColors }) {
  const pieces = Array.from({ length: 26 }, (_, i) => {
    const base = triggerId * 71 + i * 13;
    const left = seededRand(base) * 100;
    const delay = seededRand(base + 1) * 1.4;
    const duration = 2.4 + seededRand(base + 2) * 1.6;
    const size = 6 + seededRand(base + 3) * 6;
    const color = confettiColors[i % confettiColors.length];
    const drift = (seededRand(base + 4) - 0.5) * 120;
    const spin = 180 + seededRand(base + 5) * 540;
    return { id: i, left, delay, duration, size, color, drift, spin };
  });
  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="mk-confetti absolute top-0"
          style={{
            left: `${p.left}vw`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            "--drift": `${p.drift}px`,
            "--spin": `${p.spin}deg`,
          }}
        />
      ))}
    </>
  );
}

// Sizes the headline off the longest single WORD, since words are stacked
// one-per-line (see BigText).
function computeHeadlineFontSize(label) {
  const words = label.split(" ").filter(Boolean);
  const longest = words.reduce((m, w) => Math.max(m, w.length), 1);
  const isMultiWord = words.length > 1;

  if (!isMultiWord) {
    if (longest <= 6) return "clamp(3.4rem, 14vw, 10.5rem)";
    if (longest <= 9) return "clamp(2.4rem, 10vw, 7rem)";
    if (longest <= 13) return "clamp(1.8rem, 7.4vw, 4.8rem)";
    return "clamp(1.3rem, 5.3vw, 3.2rem)";
  }
  if (longest <= 6) return "clamp(2.1rem, 8.4vw, 5.4rem)";
  if (longest <= 9) return "clamp(1.7rem, 6.6vw, 4.2rem)";
  if (longest <= 13) return "clamp(1.3rem, 4.9vw, 3.1rem)";
  return "clamp(1rem, 3.8vw, 2.3rem)";
}

// Engraved-metal text: a metallic gradient fill plus a layered
// text-shadow that reads as struck/embossed into steel or gold, echoing
// the beveled lettering on the crest itself instead of a flat gradient.
// Drop-shadows are heavier than before since there's no card behind the
// text anymore to darken the live picture for us.
function BigText({ cfg, footer }) {
  const words = cfg.label.split(" ").filter(Boolean);
  const letterClass = cfg.dropText ? "mk-letter-drop" : "mk-letter";
  const fontSize = computeHeadlineFontSize(cfg.label);
  let letterIndex = 0;
  return (
    <div className="mk-text-wrap relative z-10 flex flex-col items-center" style={{ width: "100%", boxSizing: "border-box" }}>
      <div
        className="flex flex-col items-center"
        style={{ perspective: "800px", width: "100%", minWidth: 0, rowGap: "0.03em" }}
      >
        {words.map((word, wi) => (
          <div
            key={wi}
            className="flex items-center justify-center flex-wrap"
            style={{ width: "100%", minWidth: 0 }}
          >
            {word.split("").map((ch, i) => {
              const idx = letterIndex++;
              return (
                <span
                  key={i}
                  className={`${letterClass} font-heading font-black inline-block`}
                  style={{
                    fontSize,
                    lineHeight: 0.95,
                    backgroundImage: cfg.gradient,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    filter: `drop-shadow(0 0 30px ${cfg.glow}) drop-shadow(0 10px 26px rgba(0,0,0,0.75)) drop-shadow(0 -1px 0 rgba(255,255,255,0.35)) drop-shadow(0 2px 0 rgba(0,0,0,0.55))`,
                    animationDelay: `${0.52 + idx * 0.03}s`,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mk-ribbon-slot mt-3 sm:mt-4">
        <RibbonBanner text={cfg.subtitle} accent={cfg.accent} />
      </div>

      {footer && (
        <p
          className="mk-subtitle mk-footer-line mt-3 font-heading font-bold uppercase tracking-[0.2em] text-xs sm:text-sm"
          style={{ color: "#ffffff", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.95))" }}
        >
          {footer}
        </p>
      )}
    </div>
  );
}

// slot heights per mode — enlarged now that there's no card width/height
// budget to share with a background panel.
const ICON_SLOT_HEIGHT = {
  ball: 120,
  stumps: 150,
  trophy: 210,
  milestone: 190,
  shield: 170,
};

// how large the glowing crest sigil sits behind each icon type.
const SIGIL_SIZE = {
  ball: 320,
  stumps: 360,
  trophy: 460,
  milestone: 420,
  shield: 380,
};

export default function MatchMomentOverlay({
  moments = {},
  confettiColors = DEFAULT_CONFETTI_COLORS,
  hideDemoButtons = false,
}) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(null);
  const [activeCfg, setActiveCfg] = useState(null);
  const [payload, setPayload] = useState(null);
  const [closing, setClosing] = useState(false);
  const [triggerId, setTriggerId] = useState(0);
  const timers = useRef([]);

  const mergedMoments = { ...DEFAULT_MOMENTS, ...moments };

  useEffect(() => setMounted(true), []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const trigger = useCallback(
    (type, evt) => {
      if (!mergedMoments[type]) return;
      clearTimers();
      setClosing(false);
      setActive(type);
      setPayload(evt || null);

      const baseCfg = mergedMoments[type];
      let cfg = baseCfg;

      if (type === "matchWon") {
        const teamName = (evt?.player || "WINNER").toUpperCase();
        const margin = evt?.score || "MATCH WON";
        const accent = evt?.teamColor || baseCfg.accent;
        cfg = {
          ...baseCfg,
          label: teamName,
          subtitle: margin,
          accent,
          glow: evt?.teamColor ? `${evt.teamColor}CC` : baseCfg.glow,
          gradient: evt?.teamColor ? soloGradient(evt.teamColor) : baseCfg.gradient,
        };
      }

      setActiveCfg(cfg);
      setTriggerId((id) => id + 1);
      timers.current.push(
        setTimeout(() => setClosing(true), cfg.duration),
        setTimeout(() => {
          setActive(null);
          setActiveCfg(null);
          setPayload(null);
          setClosing(false);
        }, cfg.duration + EXIT_DURATION_MS)
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(moments)]
  );

  useEffect(() => {
    window.triggerBoundaryCelebration = trigger;
    return () => {
      clearTimers();
      delete window.triggerBoundaryCelebration;
    };
  }, [trigger]);

  if (!mounted) return null;

  const cfg = activeCfg;

  const footer =
    active === "maiden" && payload?.bowler
      ? `${payload.bowler.toUpperCase()}${payload?.maidens ? ` · ${payload.maidens} MAIDEN${payload.maidens === 1 ? "" : "S"}` : ""}`
      : (active === "fifty" || active === "hundred") && payload?.player
      ? `${payload.player.toUpperCase()}${payload?.score ? ` · ${payload.score}` : ""}`
      : null;

  const icon =
    cfg?.mode === "ball" ? (
      <CricketBall
        size={72}
        fill={flightFill(cfg.accent)}
        seamColor="rgba(30,18,4,0.55)"
        seamWidth={1}
        className="absolute"
        style={{ animation: "mkBallFly 0.9s cubic-bezier(0.3,0.1,0.3,1) both" }}
      />
    ) : cfg?.mode === "stumps" ? (
      <StumpsShatter />
    ) : cfg?.mode === "trophy" ? (
      <TrophyRise cfg={cfg} logoUrl={payload?.teamLogoUrl} />
    ) : cfg?.mode === "milestone" ? (
      <MilestoneBadge cfg={cfg} />
    ) : cfg?.mode === "shield" ? (
      <MaidenShield cfg={cfg} />
    ) : null;

  return (
    <>
      {!hideDemoButtons && (
        <div className="fixed bottom-4 left-4 z-[210] flex flex-wrap gap-2 pointer-events-auto max-w-xs">
          {[
            { key: "four", label: "Test Four", bg: "rgba(143,166,201,0.85)", payload: { player: "Sample Batter", score: "18(12)" } },
            { key: "six", label: "Test Six", bg: "rgba(212,175,55,0.9)", payload: { player: "Sample Batter", score: "24(14)" } },
            { key: "wicket", label: "Test Out", bg: "rgba(163,47,42,0.9)", payload: { player: "Sample Batter", score: "31(22)" } },
            { key: "fifty", label: "Test Fifty", bg: "rgba(160,170,190,0.9)", payload: { player: "Sample Batter", score: "54(41)" } },
            { key: "hundred", label: "Test Century", bg: "rgba(212,175,55,0.9)", payload: { player: "Sample Batter", score: "104(78)" } },
            { key: "maiden", label: "Test Maiden", bg: "rgba(110,143,201,0.9)", payload: { bowler: "Sample Bowler", maidens: 2 } },
            {
              key: "matchWon",
              label: "Test Match Won",
              bg: "rgba(212,175,55,0.9)",
              payload: { player: "Moon Knight Super League", score: "won by 2 runs", teamColor: "#8FA6C9" },
            },
          ].map((b) => (
            <button
              key={b.key}
              onClick={() => trigger(b.key, b.payload)}
              className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider text-white transition-transform active:scale-95"
              style={{ background: b.bg, border: "1px solid rgba(234,241,251,0.3)" }}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      {mounted &&
        active &&
        cfg &&
        createPortal(
          <div
            className={`mk-wrap fixed inset-0 z-[200] flex items-center justify-center overflow-hidden pointer-events-none ${closing ? "mk-closing" : ""}`}
          >
            {/* the whole picture goes soft — this replaces the old boxed
                glass card entirely. nothing else in this tree draws a
                panel behind the content anymore. */}
            <ScreenBlur blurPx={SCREEN_BLUR_PX[cfg.mode] ?? 12} accentSoft={cfg.accentSoft} />

            {/* flash + focused glow wash, kept from before but now it's
                the only "vignette" doing contrast work for the text */}
            <div
              className="absolute inset-0"
              style={{
                background: "radial-gradient(circle at 50% 42%, rgba(10,18,32,0.3) 0%, rgba(5,7,12,0.5) 70%)",
                animation: "mkFlash 0.6s ease-out both",
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 50% 56%, ${cfg.accentSoft} 0%, transparent 62%)`,
                animation: "mkFlash 0.6s ease-out both",
              }}
            />

            <EdgeHairlines accent={cfg.accent} />
            <CrescentHalo accent={cfg.accent} glow={cfg.glow} />
            <Starfield triggerId={triggerId} />

            <CornerFlourish corner="tl" accent={cfg.accent} />
            <CornerFlourish corner="tr" accent={cfg.accent} />
            <CornerFlourish corner="bl" accent={cfg.accent} />
            <CornerFlourish corner="br" accent={cfg.accent} />

            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 40,
                  height: 40,
                  border: `2px solid ${cfg.accent}`,
                  animation: `mkRing 1s cubic-bezier(0.16,1,0.3,1) ${0.5 + i * 0.14}s both`,
                }}
              />
            ))}

            <div className="absolute inset-0 flex items-center justify-center">
              <Particles cfg={cfg} triggerId={triggerId} />
            </div>

            {cfg.fireworks > 0 && (
              <div className="absolute inset-0">
                <Fireworks cfg={cfg} triggerId={triggerId} confettiColors={confettiColors} />
              </div>
            )}

            {cfg.confetti && (
              <div className="absolute inset-0">
                <Confetti triggerId={triggerId} confettiColors={confettiColors} />
              </div>
            )}

            {/* content — no background, no border, no card. floats
                directly in the blurred, star-lit frame. */}
            <div
              className="mk-content relative z-10 flex flex-col items-center justify-center"
              style={{
                gap: 6,
                padding: "clamp(20px, 4vw, 40px) clamp(16px, 6vw, 48px)",
                maxWidth: "94vw",
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <CrestSigil accent={cfg.accent} glow={cfg.glow} size={SIGIL_SIZE[cfg.mode] ?? 380} />
              </div>
              <IconSlot minHeight={ICON_SLOT_HEIGHT[cfg.mode]}>{icon}</IconSlot>
              <BigText cfg={cfg} footer={footer} />
            </div>
          </div>,
          document.body
        )}

      <style jsx global>{`
        .mk-wrap {
          animation: mkShake 0.4s ease-out 0.5s both;
        }
        .mk-wrap.mk-closing {
          animation: mkWipeOut 0.38s cubic-bezier(0.4, 0, 1, 1) both !important;
        }
        .mk-screen-blur {
          opacity: 0;
          animation: mkBlurIn 0.55s ease-out 0.02s both;
        }
        .mk-screen-tint {
          opacity: 0;
          animation: mkBlurIn 0.7s ease-out 0.1s both;
        }
        @keyframes mkBlurIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .mk-content {
          opacity: 0;
          animation: mkContentIn 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) 0.12s both;
        }
        @keyframes mkContentIn {
          from { opacity: 0; transform: scale(0.94) translateY(14px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes mkWipeOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(1.06); }
        }
        @keyframes mkShake {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-6px, 3px); }
          40% { transform: translate(5px, -4px); }
          60% { transform: translate(-4px, -2px); }
          80% { transform: translate(3px, 3px); }
        }
        @keyframes mkFlash {
          0% { opacity: 0; }
          25% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes mkRing {
          0% { opacity: 0.9; transform: scale(1); }
          100% { opacity: 0; transform: scale(14); }
        }
        .mk-star {
          animation: mkTwinkle ease-in-out infinite;
        }
        @keyframes mkTwinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50% { opacity: 0.9; transform: scale(1.3); }
        }
        .mk-crest-mark {
          animation: mkCrestDrift 8s ease-in-out infinite;
        }
        @keyframes mkCrestDrift {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-6px) scale(1.02); }
        }
        .mk-crescent-halo {
          opacity: 0;
          animation: mkHaloIn 1.4s ease-out 0.05s both, mkHaloDrift 12s ease-in-out 1.4s infinite;
        }
        @keyframes mkHaloIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-24px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes mkHaloDrift {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-16px); }
        }
        .mk-corner-flourish {
          opacity: 0;
          animation: mkCornerIn 1s ease-out 0.3s both;
        }
        @keyframes mkCornerIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .mk-edge-line {
          height: 2px;
          opacity: 0;
          background-size: 200% 100%;
          animation: mkEdgeFade 2.4s ease-out 0.1s both, mkEdgeShimmer 2.4s ease-out 0.1s both;
        }
        @keyframes mkEdgeFade {
          0% { opacity: 0; }
          15% { opacity: 0.9; }
          70% { opacity: 0.55; }
          100% { opacity: 0.35; }
        }
        @keyframes mkEdgeShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes mkBallFly {
          0% { opacity: 0; transform: translate(-58vw, 32vh) scale(0.55) rotate(0deg); }
          14% { opacity: 1; }
          55% { opacity: 1; transform: translate(0, 0) scale(1.15) rotate(560deg); }
          70% { opacity: 1; transform: translate(0, 0) scale(1.35) rotate(620deg); }
          100% { opacity: 0; transform: translate(0, 0) scale(0.15) rotate(660deg); }
        }
        .mk-stump {
          opacity: 0;
          animation: mkStumpFly 1s cubic-bezier(0.25, 0.6, 0.3, 1) 0.5s both;
        }
        @keyframes mkStumpFly {
          0% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
          8% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) rotate(var(--rot)); }
        }
        /* trophy rise-in */
        .mk-trophy-wrap {
          opacity: 0;
          animation: mkTrophyRise 1s cubic-bezier(0.2, 0.8, 0.3, 1) 0.3s both;
        }
        @keyframes mkTrophyRise {
          0% { opacity: 0; transform: translateY(40px) scale(0.6) rotate(-8deg); }
          60% { opacity: 1; transform: translateY(-6px) scale(1.1) rotate(3deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
        }
        .mk-trophy-crescent {
          animation: mkRaysSpin 14s linear infinite;
        }
        .mk-trophy-rays {
          position: absolute;
          width: 260px;
          height: 260px;
          border-radius: 999px;
          animation: mkRaysSpin 6s linear infinite;
          opacity: 0.8;
        }
        @keyframes mkRaysSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .mk-trophy-ring {
          position: absolute;
          width: 172px;
          height: 172px;
          border-radius: 999px;
          border: 2px solid;
          opacity: 0.5;
          animation: mkTrophyRingPulse 2.2s ease-in-out infinite;
        }
        @keyframes mkTrophyRingPulse {
          0%, 100% { transform: scale(1); opacity: 0.45; }
          50% { transform: scale(1.08); opacity: 0.75; }
        }
        .mk-trophy-dais {
          position: absolute;
          bottom: -10px;
          width: 170px;
          height: 10px;
          border-radius: 999px;
          filter: blur(3px);
          opacity: 0.6;
        }
        /* milestone badge (fifty / hundred) */
        .mk-milestone-wrap {
          opacity: 0;
          animation: mkMilestoneRise 0.75s cubic-bezier(0.2, 1.4, 0.3, 1) 0.35s both;
        }
        @keyframes mkMilestoneRise {
          0% { opacity: 0; transform: scale(0.4) rotate(-16deg); }
          60% { opacity: 1; transform: scale(1.15) rotate(4deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        .mk-milestone-rays {
          position: absolute;
          width: 224px;
          height: 224px;
          border-radius: 999px;
          animation: mkRaysSpin 8s linear infinite;
          opacity: 0.7;
        }
        .mk-flank {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6));
        }
        .mk-flank-left { left: -34px; }
        .mk-flank-right { right: -22px; top: 34%; }
        /* maiden shield */
        .mk-shield-wrap {
          opacity: 0;
          animation: mkShieldPop 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) 0.35s both;
        }
        @keyframes mkShieldPop {
          0% { opacity: 0; transform: scale(0.5) translateY(20px); }
          70% { opacity: 1; transform: scale(1.08) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .mk-letter {
          animation: mkLetterIn 0.65s cubic-bezier(0.2, 1.6, 0.4, 1) both;
        }
        @keyframes mkLetterIn {
          0% { opacity: 0; transform: translateY(60px) rotateX(70deg) scale(0.6); }
          60% { opacity: 1; transform: translateY(-8px) rotateX(-8deg) scale(1.08); }
          100% { opacity: 1; transform: translateY(0) rotateX(0deg) scale(1); }
        }
        .mk-letter-drop {
          animation: mkLetterDrop 0.6s cubic-bezier(0.36, 0, 0.66, 1.4) both;
        }
        @keyframes mkLetterDrop {
          0% { opacity: 0; transform: translateY(-140px) scale(1.15) rotate(-4deg); }
          55% { opacity: 1; transform: translateY(10px) scale(1.06) rotate(2deg); }
          80% { transform: translateY(-4px) scale(0.99) rotate(-1deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
        }
        .mk-subtitle {
          opacity: 0;
          animation: mkSubtitleIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) 1.05s both;
        }
        @keyframes mkSubtitleIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .mk-footer-line {
          opacity: 0;
          animation: mkSubtitleIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) 1.3s both;
          color: #ecd394 !important;
          letter-spacing: 0.16em !important;
        }
        /* ribbon banner (subtitle) */
        .mk-ribbon-slot {
          opacity: 0;
          animation: mkRibbonIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) 1.02s both;
        }
        @keyframes mkRibbonIn {
          from { opacity: 0; transform: translateY(10px) scaleX(0.85); }
          to { opacity: 1; transform: translateY(0) scaleX(1); }
        }
        .mk-ribbon-wrap {
          filter: drop-shadow(0 6px 14px rgba(0,0,0,0.6));
        }
        .mk-ribbon-bar {
          position: relative;
          padding: 0.4em 1.6em;
          clip-path: polygon(2.5% 0%, 97.5% 0%, 100% 50%, 97.5% 100%, 2.5% 100%, 0% 50%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -3px 8px rgba(0,0,0,0.3);
        }
        .mk-ribbon-text {
          position: relative;
          z-index: 1;
          font-size: clamp(0.72rem, 1.6vw, 1.05rem);
          color: #2a1d05;
          text-shadow: 0 1px 0 rgba(255,255,255,0.4);
        }
        .mk-ribbon-tail {
          position: absolute;
          top: 50%;
          width: 14px;
          height: 60%;
          transform: translateY(-50%);
          opacity: 0.7;
        }
        .mk-ribbon-tail-l {
          left: -8px;
          clip-path: polygon(0 0, 100% 20%, 100% 80%, 0 100%);
        }
        .mk-ribbon-tail-r {
          right: -8px;
          clip-path: polygon(0 20%, 100% 0, 100% 100%, 0 80%);
        }
        .mk-particle {
          opacity: 0;
          animation: mkParticleOut 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes mkParticleOut {
          0% { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.3); }
        }
        .mk-firework-spark {
          opacity: 0;
          animation: mkSparkOut 0.8s ease-out both;
        }
        @keyframes mkSparkOut {
          0% { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.2); }
        }
        .mk-confetti {
          opacity: 0;
          animation-name: mkConfettiFall;
          animation-timing-function: ease-in;
          animation-fill-mode: both;
        }
        @keyframes mkConfettiFall {
          0% { opacity: 0; transform: translate(0, -10vh) rotate(0deg); }
          10% { opacity: 1; }
          100% { opacity: 0.9; transform: translate(var(--drift), 110vh) rotate(var(--spin)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .mk-wrap, .mk-content, .mk-screen-blur, .mk-screen-tint, .mk-letter, .mk-letter-drop, .mk-subtitle, .mk-footer-line, .mk-ribbon-slot, .mk-particle, .mk-firework-spark, .mk-confetti, .mk-stump, .mk-trophy-wrap, .mk-trophy-rays, .mk-trophy-ring, .mk-trophy-crescent, .mk-milestone-wrap, .mk-milestone-rays, .mk-shield-wrap, .mk-star, .mk-crest-mark, .mk-crescent-halo, .mk-corner-flourish, .mk-edge-line {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </>
  );
}