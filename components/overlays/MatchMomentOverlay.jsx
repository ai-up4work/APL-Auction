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
   REDESIGN NOTES (v2 – v4)
   ------------------------------------------------------------
   See earlier revisions: glass "broadcast card" instead of a
   full-bleed wipe, league logo watermark + badge, layered entry
   animation (sheen, border pulse, logo glow), trophy ring +
   bigger multi-word headlines, non-rotating watermark, natural
   word-wrap headline.

   ------------------------------------------------------------
   REDESIGN NOTES (v5)
   ------------------------------------------------------------
   - Moments now fire through a QUEUE instead of a single
     overwritable slot. Previously, firing a new moment while
     one was still on screen instantly replaced it — no exit
     animation, no chance to read it. Now every fire (`trigger`)
     enqueues; only one moment is ever shown at a time, and the
     next one in line waits until the current one has fully
     finished (duration + exit) PLUS a 1s breathing gap before
     it appears. Nothing gets clobbered anymore.
   - Match Won is decluttered: the old double-ring "trophy ring"
     treatment around the team crest has been removed entirely
     (no more accent-colored glow ring + white inner ring). The
     team logo is shown plain, cleanly cropped to a circle, no
     extra bling.
   - The background watermark for the Match Won moment now uses
     the WINNING TEAM'S logo instead of the league logo, so you
     no longer see two different logos (league watermark behind
     + team crest in front) at once. Every other moment (four,
     six, wicket, fifty, hundred, maiden) is untouched and still
     uses the league logo as its watermark.
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
    duration: 3800,
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
    duration: 5200,
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
    duration: 4200,
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
    duration: 4200,
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
    duration: 6000,
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
    duration: 4200,
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
    duration: 8400,
  },
};

const EXIT_DURATION_MS = 260;
// NEW — gap held between one moment finishing (fully exited/unmounted)
// and the next queued moment being allowed to start. This is what
// prevents back-to-back fires from feeling like a jump-cut.
const QUEUE_GAP_MS = 1000;
export const DEFAULT_CONFETTI_COLORS = ["#D4AF37", "#EAF1FB", "#C7CFDE", "#8FA6C9", "#ffffff"];
const LOGO_SRC = "/valiant-league-logo.png";

// Watermark size per moment mode. Ball (four/six) and shield (maiden)
// are bumped up noticeably from the old flat 300px so they actually
// read as a presence behind the content.
const WATERMARK_SIZE_BY_MODE = {
  trophy: 380,
  ball: 400,
  shield: 400,
  stumps: 340,
  milestone: 340,
};

// NEW — per-mode base opacity for the watermark. Match Won gets a
// noticeably stronger watermark (0.35 vs the usual 0.15) since it's now
// the ONLY branding element on that screen (no more foreground crest),
// so it needs to read as a real presence rather than a faint hint.
// Every other moment is untouched at the original 0.15.
const WATERMARK_OPACITY_BY_MODE = {
  trophy: 0.35,
  ball: 0.15,
  shield: 0.15,
  stumps: 0.15,
  milestone: 0.15,
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

function soloGradient(color) {
  return `linear-gradient(180deg, #ffffff 0%, ${color} 45%, ${color} 100%)`;
}

/* ------------------------------------------------------------
   LogoWatermark — large, faint, slowly breathing brand mark
   sitting behind the content inside the card. Sized per-moment
   via WATERMARK_SIZE_BY_MODE. It only breathes via opacity/scale
   (no rotation) so its center never drifts.

   CHANGED — now accepts a `src` prop instead of always hardcoding
   the league logo. The Match Won moment passes the winning team's
   logo here so the card shows ONE consistent logo (the team's),
   not the league logo behind + team crest in front. Every other
   moment still defaults to the league logo.
   ------------------------------------------------------------ */
function LogoWatermark({ size = 320, src = LOGO_SRC, opacity = 0.15 }) {
  // Derive the "dim" (resting) and "peak" (breathing-in) opacity values
  // from the single `opacity` prop so callers only ever set one number.
  const dim = Math.max(0, opacity - 0.02);
  const peak = Math.min(1, opacity + 0.05);
  return (
    <img
      src={src}
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
        "--mk-wm-base": opacity,
        "--mk-wm-dim": dim,
        "--mk-wm-peak": peak,
      }}
    />
  );
}

/* ------------------------------------------------------------
   LogoBadge — crisp small logo above the headline. Currently
   unused in the render tree (kept in case it's wired back in),
   left untouched.
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

// REMOVED — the foreground circular team-logo badge (TrophyRise) is
// gone entirely per feedback: showing a small crest AND a big
// watermark at once read as two competing logos. The match-won
// moment now shows ONLY the watermark behind the headline — no icon
// in the icon slot at all. See the `icon` ternary further down,
// which no longer has a "trophy" case.

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
  // Multi-word labels (team names on the match-won screen are almost
  // always this case) get noticeably bigger clamps so they read
  // clearly instead of shrinking away.
  if (longest <= 6) return "clamp(2.4rem, 7.6vw, 4.8rem)";
  if (longest <= 9) return "clamp(2rem, 6.4vw, 4rem)";
  if (longest <= 13) return "clamp(1.6rem, 5.4vw, 3.2rem)";
  return "clamp(1.3rem, 4.2vw, 2.4rem)";
}

// Flat, clean broadcast-style headline. Words wrap naturally in a
// centered row (instead of being forced one-word-per-line), with
// tighter tracking, a thin dark stroke, and a two-layer drop shadow
// for depth.
function BigText({ cfg, footer }) {
  const words = cfg.label.split(" ").filter(Boolean);
  const wordClass = cfg.dropText ? "mk-word-drop" : "mk-word";
  const fontSize = computeHeadlineFontSize(cfg.label);
  return (
    <div className="mk-text-wrap relative z-10 flex flex-col items-center" style={{ width: "100%", boxSizing: "border-box" }}>
      <div
        className="flex flex-wrap items-center justify-center"
        style={{ width: "100%", minWidth: 0, rowGap: "0.08em", columnGap: "0.32em" }}
      >
        {words.map((word, wi) => (
          <span
            key={wi}
            className={`${wordClass} font-heading font-black uppercase`}
            style={{
              fontSize,
              lineHeight: 1,
              letterSpacing: "-0.01em",
              backgroundImage: cfg.gradient,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              WebkitTextStroke: "1.5px rgba(5,7,12,0.35)",
              filter: "drop-shadow(0 2px 0 rgba(0,0,0,0.5)) drop-shadow(0 10px 20px rgba(0,0,0,0.4))",
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
  trophy: 220,
  milestone: 150,
  shield: 130,
};

export default function MatchMomentOverlay({
  moments = {},
  confettiColors = DEFAULT_CONFETTI_COLORS,
  hideDemoButtons = false,
  logoSrc = LOGO_SRC,
}) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(null);
  const [activeCfg, setActiveCfg] = useState(null);
  const [payload, setPayload] = useState(null);
  const [closing, setClosing] = useState(false);
  const [triggerId, setTriggerId] = useState(0);
  const timers = useRef([]);

  // NEW — queue plumbing. `queueRef` holds pending { type, evt } fires
  // that haven't been shown yet. `busyRef` is true whenever a moment is
  // either on screen OR sitting in its post-exit QUEUE_GAP_MS cooldown —
  // i.e. true for the whole window during which nothing new should start.
  const queueRef = useRef([]);
  const busyRef = useRef(false);

  // Keep a live ref to the merged moments config so timers/queue
  // callbacks (which can fire well after a render) always see the
  // latest `moments` prop instead of a stale closure.
  const mergedMoments = { ...DEFAULT_MOMENTS, ...moments };
  const mergedMomentsRef = useRef(mergedMoments);
  useEffect(() => {
    mergedMomentsRef.current = mergedMoments;
  });

  useEffect(() => setMounted(true), []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // Pops the next queued moment (if any) and displays it. No-ops if
  // something is already showing/cooling down, or the queue is empty.
  const processQueue = useCallback(() => {
    if (busyRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    busyRef.current = true;
    showMoment(next.type, next.evt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actually renders a single moment and schedules its own lifecycle:
  // display for cfg.duration -> play exit for EXIT_DURATION_MS -> unmount
  // -> wait QUEUE_GAP_MS -> release busyRef -> let the next queued moment
  // (if any) start. This is what guarantees a full 1s breathing gap
  // between any two moments, so a rapid-fire burst always plays out
  // moment-by-moment instead of overwriting itself.
  const showMoment = useCallback((type, evt) => {
    const currentMoments = mergedMomentsRef.current;
    if (!currentMoments[type]) {
      busyRef.current = false;
      processQueue();
      return;
    }

    clearTimers();
    setClosing(false);
    setActive(type);
    setPayload(evt || null);

    const baseCfg = currentMoments[type];
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

        // Hold here for QUEUE_GAP_MS before allowing the next moment to
        // start — this is the actual "one second after one second" gap.
        timers.current.push(
          setTimeout(() => {
            busyRef.current = false;
            processQueue();
          }, QUEUE_GAP_MS)
        );
      }, cfg.duration + EXIT_DURATION_MS)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processQueue]);

  // Public entry point — what window.triggerBoundaryCelebration calls.
  // Always enqueues rather than showing immediately, so a burst of fires
  // (four, then six, then a wicket, all within the same second) plays
  // out fully instead of only the last one landing.
  const trigger = useCallback(
    (type, evt) => {
      if (!mergedMomentsRef.current[type]) return;
      queueRef.current.push({ type, evt });
      processQueue();
    },
    [processQueue]
  );

  useEffect(() => {
    window.triggerBoundaryCelebration = trigger;
    return () => {
      clearTimers();
      queueRef.current = [];
      busyRef.current = false;
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
    ) : null;
    // NOTE — trophy (match-won) intentionally has no icon case here
    // anymore. IconSlot returns null when it has no children, so this
    // just skips rendering the icon row entirely for that moment,
    // leaving only the watermark + headline + pill.

  // CHANGED — the watermark now shows the winning team's own logo for
  // the trophy (match-won) moment, instead of always defaulting to the
  // league logo. Every other moment is untouched.
  const watermarkSrc = cfg?.mode === "trophy" && payload?.teamLogoUrl ? payload.teamLogoUrl : LOGO_SRC;

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
            {
              key: "queueTest",
              label: "Test Queue (fires 4 at once)",
              bg: "rgba(255,255,255,0.15)",
              payload: null,
            },
          ].map((b) =>
            b.key === "queueTest" ? (
              <button
                key={b.key}
                onClick={() => {
                  trigger("four", { player: "Batter A", score: "18(12)" });
                  trigger("six", { player: "Batter A", score: "24(14)" });
                  trigger("wicket", { player: "Batter B", score: "31(22)" });
                  trigger("fifty", { player: "Batter C", score: "54(41)" });
                }}
                className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider text-white transition-transform active:scale-95"
                style={{ background: b.bg, border: "1px solid rgba(234,241,251,0.3)" }}
              >
                {b.label}
              </button>
            ) : (
              <button
                key={b.key}
                onClick={() => trigger(b.key, b.payload)}
                className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider text-white transition-transform active:scale-95"
                style={{ background: b.bg, border: "1px solid rgba(234,241,251,0.3)" }}
              >
                {b.label}
              </button>
            )
          )}
        </div>
      )}

      {mounted &&
        active &&
        cfg &&
        createPortal(
          <div
            key={triggerId}
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
              <LogoWatermark
                size={WATERMARK_SIZE_BY_MODE[cfg.mode] ?? 320}
                src={watermarkSrc}
                opacity={WATERMARK_OPACITY_BY_MODE[cfg.mode] ?? 0.15}
              />

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

        /* ---------------- logo watermark ----------------
           Center-anchored only via translate(-50%,-50%); the
           breathing animation only touches opacity/scale so the
           watermark can never drift off its center point. */
        .mk-watermark {
          opacity: var(--mk-wm-base, 0.15);
          filter: grayscale(0.15) brightness(1.5);
          transform: translate(-50%, -50%) scale(0.9);
          animation: mkWatermarkIn 0.6s ease-out 0.05s both, mkWatermarkFloat 6s ease-in-out 0.6s infinite;
        }
        @keyframes mkWatermarkIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.75); }
          to { opacity: var(--mk-wm-base, 0.15); transform: translate(-50%, -50%) scale(0.9); }
        }
        @keyframes mkWatermarkFloat {
          0%, 100% { transform: translate(-50%, -50%) scale(0.9); opacity: var(--mk-wm-dim, 0.13); }
          50% { transform: translate(-50%, -50%) scale(0.96); opacity: var(--mk-wm-peak, 0.2); }
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
          padding: 0.48em 1.6em;
          border-radius: 999px;
          background: rgba(5, 7, 12, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.5);
          color: #ffffff;
          font-size: clamp(0.74rem, 1.5vw, 1rem);
          letter-spacing: 0.28em;
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
          .mk-wrap, .mk-panel, .mk-panel-sheen, .mk-watermark, .mk-word, .mk-word-drop, .mk-pill-slot, .mk-footer-line, .mk-particle, .mk-firework-spark, .mk-confetti, .mk-stump, .mk-milestone-wrap, .mk-shield-wrap, .mk-logo-slot, .mk-logo-badge {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </>
  );
}