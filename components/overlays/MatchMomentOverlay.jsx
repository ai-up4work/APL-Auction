"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import CricketBall from "./shared/CricketBall";

export const DEFAULT_MOMENTS = {
  four: {
    mode: "ball",
    label: "FOUR",
    subtitle: "+4 RUNS",
    accent: "#3B8BD4",
    accentSoft: "rgba(59,139,212,0.4)",
    gradient: "linear-gradient(180deg, #eaf4ff 0%, #9ecbf0 38%, #3b8bd4 74%, #1f5f95 100%)",
    glow: "rgba(80,160,230,0.7)",
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
    accent: "#C9971F",
    accentSoft: "rgba(201,151,31,0.45)",
    gradient: "linear-gradient(180deg, #fff6d8 0%, #ffd873 32%, #f2b33d 62%, #c9971f 84%, #8a5c0d 100%)",
    glow: "rgba(255,180,60,0.75)",
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
    accent: "#E2453A",
    accentSoft: "rgba(226,69,58,0.5)",
    gradient: "linear-gradient(180deg, #ffffff 0%, #ffd6d3 28%, #e2453a 68%, #6f1717 100%)",
    glow: "rgba(226,69,58,0.85)",
    particleCount: 16,
    particleDist: [70, 150],
    fireworks: 0,
    confetti: false,
    dropText: true,
    duration: 2600,
  },
  fifty: {
    mode: "ball",
    label: "FIFTY",
    subtitle: "50 RUNS",
    accent: "#C7CFDE",
    accentSoft: "rgba(199,207,222,0.4)",
    gradient: "linear-gradient(180deg, #ffffff 0%, #e7ecf5 35%, #c7cfde 68%, #7d8aa3 100%)",
    glow: "rgba(220,228,240,0.75)",
    particleCount: 26,
    particleDist: [120, 240],
    fireworks: 0,
    confetti: false,
    dropText: false,
    duration: 2400,
  },
  hundred: {
    mode: "ball",
    label: "CENTURY",
    subtitle: "100 RUNS",
    accent: "#C9971F",
    accentSoft: "rgba(201,151,31,0.45)",
    gradient: "linear-gradient(180deg, #fff6d8 0%, #e9c9ff 30%, #ffd873 55%, #c9971f 82%, #8a5c0d 100%)",
    glow: "rgba(255,200,120,0.8)",
    particleCount: 46,
    particleDist: [170, 340],
    fireworks: 8,
    confetti: true,
    dropText: false,
    duration: 3600,
  },
  // NEW — was being fired via onMaiden -> "moment" event, but had no entry
  // here, so trigger() silently no-op'd every single time. Fixed.
  maiden: {
    mode: "ball",
    label: "MAIDEN",
    subtitle: "OVER",
    accent: "#60A5FA",
    accentSoft: "rgba(96,165,250,0.4)",
    gradient: "linear-gradient(180deg, #eaf4ff 0%, #a8c8f0 38%, #4a7bc9 74%, #1f3f75 100%)",
    glow: "rgba(96,165,250,0.7)",
    particleCount: 20,
    particleDist: [90, 200],
    fireworks: 0,
    confetti: false,
    dropText: false,
    duration: 2400,
  },
  // NEW — base template for the match-won celebration. label/subtitle/
  // accent/gradient get overridden per-fire with the actual winning team's
  // name, margin, and brand color (see trigger() below).
  matchWon: {
    mode: "trophy",
    label: "WINNER",
    subtitle: "MATCH WON",
    accent: "#C9971F",
    accentSoft: "rgba(201,151,31,0.45)",
    gradient: "linear-gradient(180deg, #fff6d8 0%, #ffd873 30%, #f2b33d 60%, #c9971f 85%, #8a5c0d 100%)",
    glow: "rgba(255,200,120,0.85)",
    particleCount: 46,
    particleDist: [160, 340],
    fireworks: 10,
    confetti: true,
    dropText: false,
    duration: 5200,
  },
};

const EXIT_DURATION_MS = 380;
export const DEFAULT_CONFETTI_COLORS = ["#ffd873", "#f2b33d", "#ffffff", "#e2685a", "#9ecbf0"];

function seededRand(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
function px(v) {
  return Math.round(v);
}

function flightFill(accent) {
  return `radial-gradient(circle at 32% 26%, #fff3d1 0%, #ffcf6b 26%, ${accent} 62%, #3a2504 100%)`;
}

// NEW — a one-color gradient built from the winning team's brand color,
// so "matchWon" doesn't always look gold regardless of who won.
function soloGradient(color) {
  return `linear-gradient(180deg, #ffffff 0%, ${color} 45%, ${color} 78%, #1a1a1a 120%)`;
}

function StumpsShatter() {
  const pieces = [
    { id: "s1", w: 9, h: 64, x: -16, y: 10, rot: -35, tx: -50, ty: 110, delay: 0.02 },
    { id: "s2", w: 9, h: 64, x: 0, y: 10, rot: 20, tx: 14, ty: 130, delay: 0.06 },
    { id: "s3", w: 9, h: 64, x: 16, y: 10, rot: 55, tx: 70, ty: 100, delay: 0.1 },
    { id: "b1", w: 24, h: 6, x: -8, y: -22, rot: -80, tx: -80, ty: 30, delay: 0 },
    { id: "b2", w: 24, h: 6, x: 8, y: -22, rot: 95, tx: 80, ty: 30, delay: 0 },
  ];
  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="bc-stump absolute rounded-sm"
          style={{
            width: p.w,
            height: p.h,
            left: `calc(50% + ${p.x}px)`,
            top: `calc(50% + ${p.y}px)`,
            marginLeft: -p.w / 2,
            marginTop: -p.h / 2,
            background: "linear-gradient(180deg, #f6ecd2 0%, #d1ab68 55%, #8a6a34 100%)",
            boxShadow: "inset -2px 0 3px rgba(0,0,0,0.3), 0 3px 6px rgba(0,0,0,0.5)",
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

// NEW — trophy rise-in for the "matchWon" moment. Shows the winning
// team's logo if provided, otherwise a trophy glyph in the team's color.
function TrophyRise({ cfg, logoUrl }) {
  return (
    <div className="bc-trophy-wrap absolute flex flex-col items-center">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="rounded-full object-cover"
          style={{ width: 88, height: 88, border: `3px solid ${cfg.accent}`, boxShadow: `0 0 26px ${cfg.glow}` }}
        />
      ) : (
        <span style={{ fontSize: 88, filter: `drop-shadow(0 0 26px ${cfg.glow})` }}>🏆</span>
      )}
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
          className="bc-particle absolute left-1/2 top-1/2 rounded-full"
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
              className="bc-firework-spark absolute rounded-full"
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
          className="bc-confetti absolute top-0"
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

function BigText({ cfg, footer }) {
  const letters = cfg.label.split("");
  const letterClass = cfg.dropText ? "bc-letter-drop" : "bc-letter";
  return (
    <div className="bc-text-wrap relative z-10 flex flex-col items-center">
      <div className="flex" style={{ perspective: "800px" }}>
        {letters.map((ch, i) => (
          <span
            key={i}
            className={`${letterClass} font-heading font-black inline-block`}
            style={{
              fontSize: cfg.label.length > 6 ? "clamp(2.6rem, 10vw, 7.5rem)" : "clamp(3.5rem, 14vw, 11rem)",
              lineHeight: 0.9,
              backgroundImage: cfg.gradient,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: `drop-shadow(0 0 30px ${cfg.glow}) drop-shadow(0 10px 22px rgba(0,0,0,0.65))`,
              animationDelay: `${0.52 + i * 0.045}s`,
            }}
          >
            {ch}
          </span>
        ))}
      </div>
      <p
        className="bc-subtitle mt-1 sm:mt-2 font-heading font-black uppercase tracking-[0.35em] text-sm sm:text-lg"
        style={{ color: "#ffffff", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.85))" }}
      >
        {cfg.subtitle}
      </p>
      {/* NEW — optional third line, used for the bowler's name on a
          maiden-over graphic. */}
      {footer && (
        <p
          className="bc-subtitle mt-1 font-heading font-bold uppercase tracking-[0.2em] text-xs sm:text-sm opacity-80"
          style={{ color: "#ffffff", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.85))" }}
        >
          {footer}
        </p>
      )}
    </div>
  );
}

export default function MatchMomentOverlay({
  moments = {},
  confettiColors = DEFAULT_CONFETTI_COLORS,
  hideDemoButtons = false,
}) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(null);
  const [activeCfg, setActiveCfg] = useState(null); // NEW — resolved cfg (may differ from mergedMoments[active] for matchWon/maiden)
  const [payload, setPayload] = useState(null); // NEW — raw event data (player/bowler/teamLogoUrl/etc.)
  const [closing, setClosing] = useState(false);
  const [triggerId, setTriggerId] = useState(0);
  const timers = useRef([]);

  const mergedMoments = { ...DEFAULT_MOMENTS, ...moments };

  useEffect(() => setMounted(true), []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // CHANGED — trigger now accepts an optional payload (the full moment
  // event) so matchWon/maiden can carry dynamic text instead of always
  // showing static copy.
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
      } else if (type === "maiden" && evt?.bowler) {
        cfg = { ...baseCfg };
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
  const footer = active === "maiden" && payload?.bowler ? payload.bowler.toUpperCase() : null;

  return (
    <>
      {!hideDemoButtons && (
        <div className="fixed bottom-4 left-4 z-[210] flex flex-wrap gap-2 pointer-events-auto max-w-xs">
          {[
            { key: "four", label: "Test Four", bg: "rgba(59,139,212,0.85)" },
            { key: "six", label: "Test Six", bg: "rgba(201,151,31,0.9)" },
            { key: "wicket", label: "Test Out", bg: "rgba(226,69,58,0.9)" },
            { key: "fifty", label: "Test Fifty", bg: "rgba(160,170,190,0.9)" },
            { key: "hundred", label: "Test Century", bg: "rgba(154,110,201,0.9)" },
            { key: "maiden", label: "Test Maiden", bg: "rgba(96,165,250,0.9)", payload: { bowler: "Sample Bowler" } },
            {
              key: "matchWon",
              label: "Test Match Won",
              bg: "rgba(201,151,31,0.9)",
              payload: { player: "Sample XI", score: "won by 24 runs", teamColor: "#3B8BD4" },
            },
          ].map((b) => (
            <button
              key={b.key}
              onClick={() => trigger(b.key, b.payload)}
              className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider text-white transition-transform active:scale-95"
              style={{ background: b.bg, border: "1px solid rgba(255,255,255,0.25)" }}
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
            className={`bc-wrap fixed inset-0 z-[200] flex items-center justify-center overflow-hidden pointer-events-none ${closing ? "bc-closing" : ""}`}
          >
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 50% 55%, ${cfg.accentSoft} 0%, transparent 62%)`,
                animation: "bcFlash 0.6s ease-out both",
              }}
            />

            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 40,
                  height: 40,
                  border: `2px solid ${cfg.accent}`,
                  animation: `bcRing 1s cubic-bezier(0.16,1,0.3,1) ${0.5 + i * 0.14}s both`,
                }}
              />
            ))}

            {cfg.mode === "ball" ? (
              <CricketBall
                size={64}
                fill={flightFill(cfg.accent)}
                seamColor="rgba(58,37,4,0.55)"
                seamWidth={1}
                className="absolute"
                style={{ animation: "bcBallFly 0.9s cubic-bezier(0.3,0.1,0.3,1) both" }}
              />
            ) : cfg.mode === "stumps" ? (
              <StumpsShatter />
            ) : cfg.mode === "trophy" ? (
              <TrophyRise cfg={cfg} logoUrl={payload?.teamLogoUrl} />
            ) : null}

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

            <BigText cfg={cfg} footer={footer} />
          </div>,
          document.body
        )}

      <style jsx global>{`
        .bc-wrap {
          animation: bcShake 0.4s ease-out 0.5s both;
        }
        .bc-wrap.bc-closing {
          animation: bcWipeOut 0.38s cubic-bezier(0.4, 0, 1, 1) both !important;
        }
        @keyframes bcWipeOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(1.06); }
        }
        @keyframes bcShake {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-6px, 3px); }
          40% { transform: translate(5px, -4px); }
          60% { transform: translate(-4px, -2px); }
          80% { transform: translate(3px, 3px); }
        }
        @keyframes bcFlash {
          0% { opacity: 0; }
          25% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes bcRing {
          0% { opacity: 0.9; transform: scale(1); }
          100% { opacity: 0; transform: scale(14); }
        }
        @keyframes bcBallFly {
          0% { opacity: 0; transform: translate(-58vw, 32vh) scale(0.55) rotate(0deg); }
          14% { opacity: 1; }
          55% { opacity: 1; transform: translate(0, 0) scale(1.15) rotate(560deg); }
          70% { opacity: 1; transform: translate(0, 0) scale(1.35) rotate(620deg); }
          100% { opacity: 0; transform: translate(0, 0) scale(0.15) rotate(660deg); }
        }
        .bc-stump {
          opacity: 0;
          animation: bcStumpFly 1s cubic-bezier(0.25, 0.6, 0.3, 1) 0.5s both;
        }
        @keyframes bcStumpFly {
          0% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
          8% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) rotate(var(--rot)); }
        }
        /* NEW — trophy rise-in */
        .bc-trophy-wrap {
          opacity: 0;
          animation: bcTrophyRise 1s cubic-bezier(0.2, 0.8, 0.3, 1) 0.3s both;
        }
        @keyframes bcTrophyRise {
          0% { opacity: 0; transform: translateY(80px) scale(0.6) rotate(-8deg); }
          60% { opacity: 1; transform: translateY(-12px) scale(1.1) rotate(3deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
        }
        .bc-letter {
          animation: bcLetterIn 0.65s cubic-bezier(0.2, 1.6, 0.4, 1) both;
        }
        @keyframes bcLetterIn {
          0% { opacity: 0; transform: translateY(60px) rotateX(70deg) scale(0.6); }
          60% { opacity: 1; transform: translateY(-8px) rotateX(-8deg) scale(1.08); }
          100% { opacity: 1; transform: translateY(0) rotateX(0deg) scale(1); }
        }
        .bc-letter-drop {
          animation: bcLetterDrop 0.6s cubic-bezier(0.36, 0, 0.66, 1.4) both;
        }
        @keyframes bcLetterDrop {
          0% { opacity: 0; transform: translateY(-140px) scale(1.15) rotate(-4deg); }
          55% { opacity: 1; transform: translateY(10px) scale(1.06) rotate(2deg); }
          80% { transform: translateY(-4px) scale(0.99) rotate(-1deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
        }
        .bc-subtitle {
          opacity: 0;
          animation: bcSubtitleIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) 1.05s both;
        }
        @keyframes bcSubtitleIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .bc-particle {
          opacity: 0;
          animation: bcParticleOut 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes bcParticleOut {
          0% { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.3); }
        }
        .bc-firework-spark {
          opacity: 0;
          animation: bcSparkOut 0.8s ease-out both;
        }
        @keyframes bcSparkOut {
          0% { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.2); }
        }
        .bc-confetti {
          opacity: 0;
          animation-name: bcConfettiFall;
          animation-timing-function: ease-in;
          animation-fill-mode: both;
        }
        @keyframes bcConfettiFall {
          0% { opacity: 0; transform: translate(0, -10vh) rotate(0deg); }
          10% { opacity: 1; }
          100% { opacity: 0.9; transform: translate(var(--drift), 110vh) rotate(var(--spin)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bc-wrap, .bc-letter, .bc-letter-drop, .bc-subtitle, .bc-particle, .bc-firework-spark, .bc-confetti, .bc-stump, .bc-trophy-wrap {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </>
  );
}