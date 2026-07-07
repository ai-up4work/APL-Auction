"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import CricketBall from "./shared/CricketBall";

/* ============================================================
   MOON KNIGHT SUPER LEAGUE — official broadcast overlay
   Palette pulled straight from the crest:
     night-navy   #0A1220
     cloak-black  #05070C
     crest-gold   #D4AF37
     steel-silver #C7CFDE
     moon-glow    #EAF1FB
     blood-crimson #A32F2A

   ------------------------------------------------------------
   REDESIGN NOTES (v2)
   ------------------------------------------------------------
   The old version was a full-bleed color wipe that blanked out
   the whole screen. This version is a floating glass "broadcast
   card": a contained, rounded panel with a translucent tinted
   background and a real backdrop-blur, so the live feed stays
   visible behind it. Ambient FX (rings/particles/fireworks/
   confetti) still play across the full viewport since they don't
   obscure anything, but the readable graphic itself is a compact
   card, not a screen takeover.

   The crescent+helmet crest mark is replaced with the league's
   actual logo (/moon-knight-logo.png), used two ways: a crisp
   badge above the headline, and a large, slowly breathing
   low-opacity watermark behind the content inside the card.

   Animation has been layered up: a light-sweep "sheen" crosses
   the card on entry, the card border pulses gently in the event
   color, the logo has a soft glow pulse, and the card itself
   blurs/scales in rather than just fading.
   ============================================================ */

export const DEFAULT_MOMENTS = {
  four: {
    mode: "ball",
    label: "FOUR",
    subtitle: "+4 RUNS",
    accent: "#8FA6C9",
    accentSoft: "rgba(143,166,201,0.35)",
    gradient: "linear-gradient(180deg, #ffffff 0%, #dfe9f7 45%, #8fa6c9 100%)",
    glow: "rgba(143,166,201,0.6)",
    particleCount: 14,
    particleDist: [90, 180],
    fireworks: 0,
    confetti: false,
    dropText: false,
    duration: 1900,
  },
  six: {
    mode: "ball",
    label: "SIX",
    subtitle: "+6 RUNS",
    accent: "#D4AF37",
    accentSoft: "rgba(212,175,55,0.4)",
    gradient: "linear-gradient(180deg, #fff6d8 0%, #f0d27f 45%, #D4AF37 100%)",
    glow: "rgba(230,190,80,0.7)",
    particleCount: 22,
    particleDist: [110, 220],
    fireworks: 4,
    confetti: true,
    dropText: false,
    duration: 2600,
  },
  wicket: {
    mode: "stumps",
    label: "OUT",
    subtitle: "WICKET",
    accent: "#A32F2A",
    accentSoft: "rgba(163,47,42,0.45)",
    gradient: "linear-gradient(180deg, #ffffff 0%, #eab3ad 45%, #A32F2A 100%)",
    glow: "rgba(163,47,42,0.8)",
    particleCount: 10,
    particleDist: [60, 120],
    fireworks: 0,
    confetti: false,
    dropText: true,
    duration: 2100,
  },
  fifty: {
    mode: "milestone",
    label: "FIFTY",
    subtitle: "50 RUNS",
    accent: "#C7CFDE",
    accentSoft: "rgba(199,207,222,0.35)",
    gradient: "linear-gradient(180deg, #ffffff 0%, #e7ecf5 45%, #C7CFDE 100%)",
    glow: "rgba(220,228,240,0.7)",
    particleCount: 16,
    particleDist: [90, 180],
    fireworks: 0,
    confetti: false,
    dropText: false,
    duration: 2100,
  },
  hundred: {
    mode: "milestone",
    label: "CENTURY",
    subtitle: "100 RUNS",
    accent: "#D4AF37",
    accentSoft: "rgba(212,175,55,0.4)",
    gradient: "linear-gradient(180deg, #fff6d8 0%, #f0d27f 45%, #D4AF37 100%)",
    glow: "rgba(230,195,110,0.75)",
    particleCount: 28,
    particleDist: [120, 260],
    fireworks: 6,
    confetti: true,
    dropText: false,
    duration: 3000,
  },
  maiden: {
    mode: "shield",
    label: "MAIDEN",
    subtitle: "OVER",
    accent: "#6E8FC9",
    accentSoft: "rgba(110,143,201,0.35)",
    gradient: "linear-gradient(180deg, #eaf1ff 0%, #a8c0e8 45%, #6E8FC9 100%)",
    glow: "rgba(110,143,201,0.6)",
    particleCount: 12,
    particleDist: [70, 140],
    fireworks: 0,
    confetti: false,
    dropText: false,
    duration: 2100,
  },
  // base template for match-won; label/subtitle/accent/gradient get
  // overridden per-fire with the winning team's name, margin and color.
  matchWon: {
    mode: "trophy",
    label: "WINNER",
    subtitle: "MATCH WON",
    accent: "#D4AF37",
    accentSoft: "rgba(212,175,55,0.4)",
    gradient: "linear-gradient(180deg, #fff6d8 0%, #f0d27f 40%, #D4AF37 100%)",
    glow: "rgba(230,195,110,0.8)",
    particleCount: 30,
    particleDist: [120, 260],
    fireworks: 7,
    confetti: true,
    dropText: false,
    duration: 4200,
  },
};

const EXIT_DURATION_MS = 260;
export const DEFAULT_CONFETTI_COLORS = ["#D4AF37", "#EAF1FB", "#C7CFDE", "#8FA6C9", "#ffffff"];
const LOGO_SRC = "/moon-knight-logo.png";

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

function soloGradient(color) {
  return `linear-gradient(180deg, #ffffff 0%, ${color} 45%, ${color} 100%)`;
}

/* ------------------------------------------------------------
   LogoWatermark — large, faint, slowly breathing brand mark
   sitting behind the content inside the card. This is the
   "watermark" use of the logo.
   ------------------------------------------------------------ */
function LogoWatermark({ size = 260 }) {
  return (
    <img
      src={LOGO_SRC}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="mk-watermark absolute pointer-events-none select-none"
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        top: "50%",
        left: "50%",
      }}
    />
  );
}

/* ------------------------------------------------------------
   LogoBadge — crisp small logo above the headline. This is the
   one signature branded touch, replacing the old crescent+helmet
   crest mark.
   ------------------------------------------------------------ */
function LogoBadge({ size = 60 }) {
  return (
    <img
      src={LOGO_SRC}
      alt="Moon Knight Super League"
      draggable={false}
      className="mk-logo-badge"
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}

function IconSlot({ children, minHeight }) {
  if (!children) return null;
  return (
    <div className="relative flex items-center justify-center" style={{ minHeight, width: "100%" }}>
      {children}
    </div>
  );
}

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

// trophy pop-in. Just the trophy/logo and a simple pulsing ring —
// no ray burst, no crescent arc behind it.
function TrophyRise({ cfg, logoUrl }) {
  return (
    <div className="mk-trophy-wrap relative flex flex-col items-center">
      <span className="mk-trophy-ring" style={{ borderColor: "#ffffff", boxShadow: `0 0 26px ${cfg.glow}` }} />
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="rounded-full object-cover relative z-10"
          style={{ width: 132, height: 132, border: "3px solid #ffffff", boxShadow: `0 0 24px ${cfg.glow}` }}
        />
      ) : (
        <span className="relative z-10" style={{ fontSize: 108 }}>
          🏆
        </span>
      )}
    </div>
  );
}

// milestone medallion — a plain flat disc with the number, a thin
// ring, no laurel/crescent flanks.
function MilestoneBadge({ cfg }) {
  const isCentury = cfg.label === "CENTURY";
  const number = isCentury ? "100" : "50";
  return (
    <div className="mk-milestone-wrap relative flex items-center justify-center">
      <svg width="152" height="152" viewBox="0 0 136 136">
        <circle cx="68" cy="68" r="60" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.85" />
        <circle cx="68" cy="68" r="51" fill="#05070C" opacity="0.35" />
        <text
          x="68"
          y="80"
          textAnchor="middle"
          fontSize="38"
          fontWeight="900"
          fill="#ffffff"
          fontFamily="var(--font-heading, sans-serif)"
        >
          {number}
        </text>
      </svg>
    </div>
  );
}

// maiden shield — same heraldic silhouette, flat fill, no extra ring.
function MaidenShield() {
  return (
    <div className="mk-shield-wrap relative flex items-center justify-center">
      <svg width="120" height="134" viewBox="0 0 112 126">
        <path
          d="M56 4 L104 20 V60 C104 92 84 111 56 122 C28 111 8 92 8 60 V20 Z"
          fill="rgba(5,7,12,0.35)"
          stroke="#ffffff"
          strokeWidth="2.5"
        />
        <text x="56" y="76" textAnchor="middle" fontSize="42" fontWeight="900" fill="#ffffff" fontFamily="var(--font-heading, sans-serif)">
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
    const size = 5 + seededRand(base + 2) * 6;
    const delay = 0.32 + seededRand(base + 3) * 0.1;
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
            background: "#ffffff",
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
    const left = 14 + seededRand(base) * 72;
    const top = 10 + seededRand(base + 1) * 34;
    const delay = 0.5 + seededRand(base + 2) * 1.1;
    const color = confettiColors[i % confettiColors.length];
    const sparks = Array.from({ length: 12 }, (_, j) => {
      const b2 = base + j * 7;
      const angle = (j / 12) * Math.PI * 2 + seededRand(b2) * 0.4;
      const dist = 34 + seededRand(b2 + 1) * 38;
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
  const pieces = Array.from({ length: 20 }, (_, i) => {
    const base = triggerId * 71 + i * 13;
    const left = seededRand(base) * 100;
    const delay = seededRand(base + 1) * 1.1;
    const duration = 2 + seededRand(base + 2) * 1.3;
    const size = 6 + seededRand(base + 3) * 5;
    const color = confettiColors[i % confettiColors.length];
    const drift = (seededRand(base + 4) - 0.5) * 100;
    const spin = 180 + seededRand(base + 5) * 480;
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

function computeHeadlineFontSize(label) {
  const words = label.split(" ").filter(Boolean);
  const longest = words.reduce((m, w) => Math.max(m, w.length), 1);
  const isMultiWord = words.length > 1;

  if (!isMultiWord) {
    if (longest <= 6) return "clamp(2.6rem, 9vw, 6.4rem)";
    if (longest <= 9) return "clamp(2rem, 7vw, 4.6rem)";
    if (longest <= 13) return "clamp(1.5rem, 5.2vw, 3.4rem)";
    return "clamp(1.1rem, 4vw, 2.4rem)";
  }
  if (longest <= 6) return "clamp(1.7rem, 5.6vw, 3.6rem)";
  if (longest <= 9) return "clamp(1.4rem, 4.4vw, 2.8rem)";
  if (longest <= 13) return "clamp(1.05rem, 3.4vw, 2.1rem)";
  return "clamp(0.85rem, 2.6vw, 1.6rem)";
}

// Flat, clean broadcast-style headline: one word per line, a single
// crisp drop shadow for legibility against the card, whole-word
// slide/scale-in instead of letter-by-letter theatrics.
function BigText({ cfg, footer }) {
  const words = cfg.label.split(" ").filter(Boolean);
  const wordClass = cfg.dropText ? "mk-word-drop" : "mk-word";
  const fontSize = computeHeadlineFontSize(cfg.label);
  return (
    <div className="mk-text-wrap relative z-10 flex flex-col items-center" style={{ width: "100%", boxSizing: "border-box" }}>
      <div className="flex flex-col items-center" style={{ width: "100%", minWidth: 0, rowGap: "0.03em" }}>
        {words.map((word, wi) => (
          <span
            key={wi}
            className={`${wordClass} font-heading font-black uppercase`}
            style={{
              fontSize,
              lineHeight: 0.95,
              backgroundImage: cfg.gradient,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.5))",
              animationDelay: `${0.22 + wi * 0.06}s`,
            }}
          >
            {word}
          </span>
        ))}
      </div>

      <div className="mk-pill-slot mt-3 sm:mt-4">
        <span className="mk-pill font-heading font-bold uppercase tracking-[0.28em]">{cfg.subtitle}</span>
      </div>

      {footer && (
        <p
          className="mk-subtitle mk-footer-line mt-2 font-heading font-bold uppercase tracking-[0.18em] text-xs sm:text-sm"
          style={{ color: "#ffffff" }}
        >
          {footer}
        </p>
      )}
    </div>
  );
}

const ICON_SLOT_HEIGHT = {
  ball: 96,
  stumps: 120,
  trophy: 160,
  milestone: 150,
  shield: 130,
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
        size={60}
        fill={flightFill(cfg.accent)}
        seamColor="rgba(30,18,4,0.55)"
        seamWidth={1}
        className="absolute"
        style={{ animation: "mkBallFly 0.7s cubic-bezier(0.3,0.1,0.3,1) both" }}
      />
    ) : cfg?.mode === "stumps" ? (
      <StumpsShatter />
    ) : cfg?.mode === "trophy" ? (
      <TrophyRise cfg={cfg} logoUrl={payload?.teamLogoUrl} />
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
            {/* ambient FX plays across the full frame, but nothing here
               paints an opaque background — the feed stays visible */}
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

            {/* the actual readable graphic — a contained glass card,
               not a full-screen wipe */}
            <div
              className="mk-panel relative z-10 flex flex-col items-center justify-center"
              style={{
                "--mk-accent": cfg.accent,
                "--mk-accent-soft": cfg.accentSoft,
                "--mk-glow": cfg.glow,
                gap: 6,
                padding: "clamp(22px, 3.4vw, 36px) clamp(24px, 5vw, 44px)",
              }}
            >
              <span className="mk-panel-sheen" aria-hidden="true" />
              <LogoWatermark size={cfg.mode === "trophy" ? 300 : 240} />

              <div className="mk-content relative z-10 flex flex-col items-center justify-center" style={{ gap: 6 }}>
                <IconSlot minHeight={ICON_SLOT_HEIGHT[cfg.mode]}>{icon}</IconSlot>
                <BigText cfg={cfg} footer={footer} />
              </div>
            </div>
          </div>,
          document.body
        )}

      <style jsx global>{`
        .mk-wrap {
          animation: mkShake 0.3s ease-out 0.24s both;
        }
        .mk-wrap.mk-closing {
          animation: mkWipeOut 0.26s cubic-bezier(0.4, 0, 1, 1) both !important;
        }

        /* ---------------- glass card ---------------- */
        .mk-panel {
          position: fixed; /* or absolute if inside a fullscreen parent */
          inset: 0;        /* top:0; right:0; bottom:0; left:0; */

          width: 100vw;
          height: 100vh;
          max-width: none;

          border-radius: 0;

          overflow: hidden;
          isolation: isolate;

          background: linear-gradient(
            165deg,
            rgba(5, 7, 12, 0.62) 0%,
            rgba(10, 18, 32, 0.5) 55%,
            color-mix(in srgb, var(--mk-accent) 22%, transparent) 140%
          );

          backdrop-filter: blur(10px) saturate(150%);
          -webkit-backdrop-filter: blur(10px) saturate(150%);

          border: none; /* optional */
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.08),
            0 0 60px var(--mk-glow);

          opacity: 0;
          animation: mkPanelIn 0.46s cubic-bezier(0.2, 0.9, 0.3, 1) 0.04s both;
        }

        .mk-panel::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 0;
          box-shadow: 0 0 0 1.5px var(--mk-accent-soft);
          animation: mkBorderPulse 2.4s ease-in-out 0.5s infinite;
          pointer-events: none;
        }
        @keyframes mkPanelIn {
          0% {
            opacity: 0;
            transform: scale(0.86) translateY(16px);
            filter: blur(6px);
          }
          65% {
            opacity: 1;
            transform: scale(1.015) translateY(-2px);
            filter: blur(0px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
            filter: blur(0px);
          }
        }
        @keyframes mkBorderPulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        .mk-panel-sheen {
          position: absolute;
          inset: -50% -70%;
          background: linear-gradient(
            100deg,
            transparent 32%,
            rgba(255, 255, 255, 0.16) 45%,
            rgba(255, 255, 255, 0.32) 50%,
            rgba(255, 255, 255, 0.16) 55%,
            transparent 68%
          );
          transform: translateX(-130%) rotate(8deg);
          animation: mkSheenSweep 1.5s cubic-bezier(0.4, 0, 0.2, 1) 0.32s both;
          pointer-events: none;
        }
        @keyframes mkSheenSweep {
          0% { transform: translateX(-130%) rotate(8deg); }
          100% { transform: translateX(130%) rotate(8deg); }
        }

        /* ---------------- logo watermark ---------------- */
        .mk-watermark {
          opacity: 0.13;
          filter: grayscale(0.15) brightness(1.5);
          transform: translate(-50%, -50%) scale(0.9) rotate(-4deg);
          animation: mkWatermarkIn 0.6s ease-out 0.05s both, mkWatermarkFloat 6s ease-in-out 0.6s infinite;
        }
        @keyframes mkWatermarkIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.75) rotate(-4deg); }
          to { opacity: 0.13; transform: translate(-50%, -50%) scale(0.9) rotate(-4deg); }
        }
        @keyframes mkWatermarkFloat {
          0%, 100% { transform: translate(-50%, -50%) scale(0.9) rotate(-4deg); opacity: 0.11; }
          50% { transform: translate(-50%, -50%) scale(0.96) rotate(2deg); opacity: 0.18; }
        }

        /* ---------------- logo badge ---------------- */
        .mk-logo-slot {
          opacity: 0;
          margin-bottom: 2px;
          animation: mkCrestIn 0.4s ease-out 0.1s both;
        }
        @keyframes mkCrestIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.85); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .mk-logo-badge {
          display: block;
          animation: mkLogoGlow 2.4s ease-in-out 0.5s infinite;
        }
        @keyframes mkLogoGlow {
          0%, 100% { filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 0px rgba(255, 255, 255, 0)); }
          50% { filter: drop-shadow(0 3px 10px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 16px var(--mk-glow)); }
        }

        @keyframes mkWipeOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(1.04); }
        }
        @keyframes mkShake {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-4px, 2px); }
          50% { transform: translate(3px, -2px); }
          75% { transform: translate(-2px, 1px); }
        }
        @keyframes mkBallFly {
          0% { opacity: 0; transform: translate(-52vw, 26vh) scale(0.6) rotate(0deg); }
          16% { opacity: 1; }
          58% { opacity: 1; transform: translate(0, 0) scale(1.1) rotate(480deg); }
          72% { opacity: 1; transform: translate(0, 0) scale(1.25) rotate(520deg); }
          100% { opacity: 0; transform: translate(0, 0) scale(0.2) rotate(550deg); }
        }
        .mk-stump {
          opacity: 0;
          animation: mkStumpFly 0.8s cubic-bezier(0.25, 0.6, 0.3, 1) 0.24s both;
        }
        @keyframes mkStumpFly {
          0% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
          10% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) rotate(var(--rot)); }
        }
        .mk-trophy-wrap {
          opacity: 0;
          animation: mkTrophyRise 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) 0.12s both;
        }
        @keyframes mkTrophyRise {
          0% { opacity: 0; transform: translateY(24px) scale(0.7); }
          70% { opacity: 1; transform: translateY(-3px) scale(1.05); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .mk-trophy-ring {
          position: absolute;
          width: 158px;
          height: 158px;
          border-radius: 999px;
          border: 2px solid;
          opacity: 0.55;
          animation: mkTrophyRingPulse 1.8s ease-in-out infinite;
        }
        @keyframes mkTrophyRingPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.06); opacity: 0.7; }
        }
        .mk-milestone-wrap {
          opacity: 0;
          animation: mkMilestoneRise 0.4s cubic-bezier(0.2, 1.2, 0.3, 1) 0.14s both;
        }
        @keyframes mkMilestoneRise {
          0% { opacity: 0; transform: scale(0.6); }
          70% { opacity: 1; transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
        .mk-shield-wrap {
          opacity: 0;
          animation: mkShieldPop 0.4s cubic-bezier(0.34, 1.4, 0.64, 1) 0.14s both;
        }
        @keyframes mkShieldPop {
          0% { opacity: 0; transform: scale(0.6) translateY(12px); }
          70% { opacity: 1; transform: scale(1.05) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .mk-word {
          display: inline-block;
          opacity: 0;
          animation: mkWordIn 0.34s cubic-bezier(0.2, 0.9, 0.3, 1) both;
        }
        @keyframes mkWordIn {
          0% { opacity: 0; transform: translateY(18px) scale(0.92); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .mk-word-drop {
          display: inline-block;
          opacity: 0;
          animation: mkWordDrop 0.36s cubic-bezier(0.36, 0, 0.66, 1.3) both;
        }
        @keyframes mkWordDrop {
          0% { opacity: 0; transform: translateY(-60px) scale(1.08); }
          70% { opacity: 1; transform: translateY(4px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .mk-pill-slot {
          opacity: 0;
          animation: mkPillIn 0.3s ease-out 0.46s both;
        }
        @keyframes mkPillIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .mk-pill {
          display: inline-block;
          padding: 0.42em 1.4em;
          border-radius: 999px;
          background: rgba(5, 7, 12, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.5);
          color: #ffffff;
          font-size: clamp(0.66rem, 1.3vw, 0.88rem);
        }
        .mk-footer-line {
          opacity: 0;
          animation: mkPillIn 0.3s ease-out 0.58s both;
        }
        .mk-particle {
          opacity: 0;
          animation: mkParticleOut 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes mkParticleOut {
          0% { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.3); }
        }
        .mk-firework-spark {
          opacity: 0;
          animation: mkSparkOut 0.7s ease-out both;
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
          .mk-wrap, .mk-panel, .mk-panel-sheen, .mk-watermark, .mk-word, .mk-word-drop, .mk-pill-slot, .mk-footer-line, .mk-particle, .mk-firework-spark, .mk-confetti, .mk-stump, .mk-trophy-wrap, .mk-trophy-ring, .mk-milestone-wrap, .mk-shield-wrap, .mk-logo-slot, .mk-logo-badge {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </>
  );
}