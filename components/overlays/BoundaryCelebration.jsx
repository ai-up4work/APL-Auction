"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ---- Per-type styling. FOUR reads "along the ground" — cool blue, tighter
// burst, no fireworks. SIX reads "into the stands" — hot gold/fire, bigger
// burst, fireworks + falling confetti on top. ----
const CELEBRATIONS = {
  four: {
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
    duration: 2400,
  },
  six: {
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
    duration: 3200,
  },
};

const EXIT_DURATION_MS = 380;
const CONFETTI_COLORS = ["#ffd873", "#f2b33d", "#ffffff", "#e2685a", "#9ecbf0"];

function seededRand(seed) {
  // Deterministic per-triggerId pseudo-random so particle layout doesn't
  // reshuffle mid-animation on re-render, but still differs run to run.
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function tx_safe(v) {
  return Math.round(v);
}

// Small stitched-seam sphere — same cricket-ball motif used in the score
// bar's "this over" ticker, reused here at two sizes (the big flying ball,
// and the tiny particle sparks it explodes into).
function BallSphere({ size, accent, style }) {
  return (
    <span
      className="absolute rounded-full overflow-hidden"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 32% 26%, #fff3d1 0%, #ffcf6b 26%, ${accent} 62%, #3a2504 100%)`,
        border: "1px solid rgba(0,0,0,0.4)",
        boxShadow: "inset 0 -4px 6px rgba(0,0,0,0.45), inset 0 2px 3px rgba(255,255,255,0.3)",
        ...style,
      }}
    >
      <svg viewBox="0 0 20 20" className="absolute inset-0 w-full h-full" style={{ opacity: 0.75 }}>
        <path d="M3,2 Q9,10 3,18" stroke="rgba(58,37,4,0.55)" strokeWidth="1" strokeDasharray="1.1 1.3" fill="none" strokeLinecap="round" />
        <path d="M17,2 Q11,10 17,18" stroke="rgba(58,37,4,0.55)" strokeWidth="1" strokeDasharray="1.1 1.3" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Particles({ cfg, triggerId }) {
  const items = Array.from({ length: cfg.particleCount }, (_, i) => {
    const base = triggerId * 137 + i * 19;
    const angle = (i / cfg.particleCount) * Math.PI * 2 + (seededRand(base) - 0.5) * 0.5;
    const dist = cfg.particleDist[0] + seededRand(base + 1) * (cfg.particleDist[1] - cfg.particleDist[0]);
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist * 0.72; // flatten vertically, reads more like a burst than a sphere
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
            "--tx": `${tx_safe(p.tx)}px`,
            "--ty": `${tx_safe(p.ty)}px`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function Fireworks({ cfg, triggerId }) {
  const bursts = Array.from({ length: cfg.fireworks }, (_, i) => {
    const base = triggerId * 251 + i * 41;
    const left = 12 + seededRand(base) * 76; // vw
    const top = 8 + seededRand(base + 1) * 38; // vh
    const delay = 0.9 + seededRand(base + 2) * 1.6;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
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
        <span
          key={b.id}
          className="absolute"
          style={{ left: `${b.left}vw`, top: `${b.top}vh`, width: 0, height: 0 }}
        >
          {b.sparks.map((s) => (
            <span
              key={s.id}
              className="bc-firework-spark absolute rounded-full"
              style={{
                width: 5,
                height: 5,
                background: b.color,
                boxShadow: `0 0 8px ${b.color}`,
                "--tx": `${tx_safe(s.tx)}px`,
                "--ty": `${tx_safe(s.ty)}px`,
                animationDelay: `${b.delay}s`,
              }}
            />
          ))}
        </span>
      ))}
    </>
  );
}

function Confetti({ triggerId }) {
  const pieces = Array.from({ length: 26 }, (_, i) => {
    const base = triggerId * 71 + i * 13;
    const left = seededRand(base) * 100;
    const delay = seededRand(base + 1) * 1.4;
    const duration = 2.4 + seededRand(base + 2) * 1.6;
    const size = 6 + seededRand(base + 3) * 6;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
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

function BigText({ cfg }) {
  const letters = cfg.label.split("");
  return (
    <div className="bc-text-wrap relative z-10 flex flex-col items-center">
      <div className="flex" style={{ perspective: "800px" }}>
        {letters.map((ch, i) => (
          <span
            key={i}
            className="bc-letter font-heading font-black inline-block"
            style={{
              fontSize: "clamp(3.5rem, 14vw, 11rem)",
              lineHeight: 0.9,
              backgroundImage: cfg.gradient,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: `drop-shadow(0 0 30px ${cfg.glow}) drop-shadow(0 10px 22px rgba(0,0,0,0.65))`,
              animationDelay: `${0.52 + i * 0.055}s`,
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
    </div>
  );
}

/**
 * BoundaryCelebration — full-screen cinematic overlay for a FOUR or a SIX.
 * Mount once anywhere in the tree; it renders nothing until triggered.
 *
 * Trigger it two ways:
 *  1. From your scoring logic anywhere in the app:
 *       window.triggerBoundaryCelebration("four")
 *       window.triggerBoundaryCelebration("six")
 *  2. The small "TEST FOUR / TEST SIX" pill in the bottom-left corner,
 *     included for demoing this in isolation — delete that block (marked
 *     below) once you're wiring it up to real ball-by-ball events.
 *
 * Sequence: ball flies in from off-screen and "impacts" center → screen
 * shockwave rings + a quick shake → big gradient FOUR/SIX text pops in
 * letter by letter → particle burst (spark shower on FOUR, particles +
 * fireworks + falling confetti on SIX) → holds → wipes out.
 */
export default function BoundaryCelebration() {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(null); // "four" | "six" | null
  const [closing, setClosing] = useState(false);
  const [triggerId, setTriggerId] = useState(0);
  const timers = useRef([]);

  useEffect(() => setMounted(true), []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const trigger = useCallback((type) => {
    if (!CELEBRATIONS[type]) return;
    clearTimers();
    setClosing(false);
    setActive(type);
    setTriggerId((id) => id + 1);
    const cfg = CELEBRATIONS[type];
    timers.current.push(
      setTimeout(() => setClosing(true), cfg.duration),
      setTimeout(() => {
        setActive(null);
        setClosing(false);
      }, cfg.duration + EXIT_DURATION_MS)
    );
  }, []);

  useEffect(() => {
    window.triggerBoundaryCelebration = trigger;
    return () => {
      clearTimers();
      delete window.triggerBoundaryCelebration;
    };
  }, [trigger]);

  if (!mounted) return null;

  const cfg = active ? CELEBRATIONS[active] : null;

  return (
    <>
      {/* ---- DEMO TRIGGERS — delete this block once wired to real events ---- */}
      <div className="fixed bottom-4 left-4 z-[210] flex gap-2 pointer-events-auto">
        <button
          onClick={() => trigger("four")}
          className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider text-white transition-transform active:scale-95"
          style={{ background: "rgba(59,139,212,0.85)", border: "1px solid rgba(255,255,255,0.25)" }}
        >
          Test Four
        </button>
        <button
          onClick={() => trigger("six")}
          className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider text-white transition-transform active:scale-95"
          style={{ background: "rgba(201,151,31,0.9)", border: "1px solid rgba(255,255,255,0.25)" }}
        >
          Test Six
        </button>
      </div>
      {/* ---- end demo triggers ---- */}

      {mounted &&
        active &&
        createPortal(
          <div
            className={`bc-wrap fixed inset-0 z-[200] flex items-center justify-center overflow-hidden pointer-events-none ${closing ? "bc-closing" : ""}`}
          >
            {/* Full-screen flash */}
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 50% 55%, ${cfg.accentSoft} 0%, transparent 62%)`,
                animation: "bcFlash 0.6s ease-out both",
              }}
            />

            {/* Shockwave rings, staggered */}
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

            {/* Flying cricket ball */}
            <BallSphere
              size={64}
              accent={cfg.accent}
              style={{ animation: "bcBallFly 0.9s cubic-bezier(0.3,0.1,0.3,1) both" }}
            />

            {/* Particle burst */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Particles cfg={cfg} triggerId={triggerId} />
            </div>

            {/* Fireworks — six only */}
            {cfg.fireworks > 0 && (
              <div className="absolute inset-0">
                <Fireworks cfg={cfg} triggerId={triggerId} />
              </div>
            )}

            {/* Falling confetti — six only */}
            {cfg.confetti && (
              <div className="absolute inset-0">
                <Confetti triggerId={triggerId} />
              </div>
            )}

            {/* Big text */}
            <BigText cfg={cfg} />
          </div>,
          document.body
        )}

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&display=swap");

        .font-heading {
          font-family: "Montserrat", sans-serif;
        }

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

        .bc-letter {
          animation: bcLetterIn 0.65s cubic-bezier(0.2, 1.6, 0.4, 1) both;
        }
        @keyframes bcLetterIn {
          0% { opacity: 0; transform: translateY(60px) rotateX(70deg) scale(0.6); }
          60% { opacity: 1; transform: translateY(-8px) rotateX(-8deg) scale(1.08); }
          100% { opacity: 1; transform: translateY(0) rotateX(0deg) scale(1); }
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
          .bc-wrap,
          .bc-letter,
          .bc-subtitle,
          .bc-particle,
          .bc-firework-spark,
          .bc-confetti {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </>
  );
}