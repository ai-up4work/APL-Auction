'use client';

import { Player } from '@/types/sankeytype';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

interface ShuffleOverlayProps {
  isShuffling: boolean;
  shuffleTarget: Player | null;
  players: Player[];
  shuffleIndex: number;
}

// Synced from --color-theme-orange at runtime so every glow/rgba effect here
// always matches the live app accent instead of a baked-in hex value.
let ACC = '#c9971f';
let ACC_RGB = '201,151,31';

function syncThemeColor() {
  if (typeof window === 'undefined') return;
  const hex = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-theme-orange')
    .trim();
  if (!hex) return;
  ACC = hex;
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
    ACC_RGB = `${r},${g},${b}`;
  }
}

function initials(name: string) {
  return (name || '')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const SPIN_PHRASES = [
  'Spinning the reels…',
  'Scanning the player pool…',
  'Building suspense…',
  'Almost there…',
];

// ── one card inside a reel column ────────────────────────────────────────
function ReelCard({
  player,
  size,
  dim,
  glow,
}: {
  player: Player | null;
  size: number;
  dim: boolean;
  glow: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);
  useEffect(() => setImgOk(true), [player?.id]);

  if (!player) {
    return <div style={{ width: size, height: size * 1.2 }} />;
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden border-2 shrink-0"
      style={{
        width: size,
        height: size * 1.2,
        borderColor: glow ? ACC : 'rgba(255,255,255,0.10)',
        background: '#0d1113',
        opacity: dim ? 0.35 : 1,
        boxShadow: glow
          ? `0 0 26px rgba(${ACC_RGB},0.75), 0 0 54px rgba(${ACC_RGB},0.35)`
          : '0 4px 14px rgba(0,0,0,0.5)',
        transition: 'opacity 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
      }}
    >
      {player.img && imgOk ? (
        <img
          src={player.img}
          alt={player.name}
          className="w-full h-full object-cover object-top"
          onError={() => setImgOk(false)}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, rgba(${ACC_RGB},0.28), rgba(0,0,0,0.5))` }}
        >
          <span className="font-mono font-black text-white/85" style={{ fontSize: size * 0.26 }}>
            {initials(player.name)}
          </span>
        </div>
      )}
      {glow && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(to top, rgba(${ACC_RGB},0.38), transparent 55%)` }}
        />
      )}
    </div>
  );
}

// ── a single spinning reel column (only rendered while NOT locked) ───────
function ReelColumn({
  pool,
  centerIndex,
  offset,
  cardSize,
  transitionMs,
  blurPx,
}: {
  pool: Player[];
  centerIndex: number;
  offset: number;
  cardSize: number;
  transitionMs: number;
  blurPx: number;
}) {
  const half = 1; // 3 visible rows: one above, center, one below
  const n = pool.length;

  const items: (Player | null)[] = [];
  for (let d = -half; d <= half; d++) {
    if (n === 0) {
      items.push(null);
      continue;
    }
    const idx = (((centerIndex + offset + d) % n) + n) % n;
    items.push(pool[idx]);
  }

  return (
    <div
      key={centerIndex}
      className="flex flex-col items-center"
      style={{
        gap: 8,
        animation: `reel-tick ${transitionMs}ms linear both`,
        filter: `blur(${blurPx}px)`,
      }}
    >
      {items.map((p, i) => (
        <ReelCard
          key={p ? `${p.id ?? p.name}-${i}` : `empty-${i}`}
          player={p}
          size={cardSize}
          dim={i !== half}
          glow={false}
        />
      ))}
    </div>
  );
}

export function ShuffleOverlay({
  isShuffling,
  shuffleTarget,
  players,
  shuffleIndex,
}: ShuffleOverlayProps) {
  // `players` is already the pool built by the caller for this shuffle
  // (candidates + the target spliced in) — use it directly rather than
  // re-deriving a subset, so the reel always matches the real pool.
  const pool = useMemo(() => players, [players]);

  const [phrase, setPhrase] = useState(SPIN_PHRASES[0]);
  const [transitionMs, setTransitionMs] = useState(90);
  const [blurPx, setBlurPx] = useState(5);
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    syncThemeColor();
  }, []);

  // cycle flavour text while spinning
  useEffect(() => {
    if (!isShuffling || shuffleTarget) return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % SPIN_PHRASES.length;
      setPhrase(SPIN_PHRASES[i]);
    }, 750);
    return () => clearInterval(id);
  }, [isShuffling, shuffleTarget]);

  // Infer real spin speed from the actual time between shuffleIndex ticks
  // (the caller already decelerates this over time), so the reel's motion
  // blur and tick duration track the true spin curve instead of a guess.
  useEffect(() => {
    const now = Date.now();
    const dt = now - lastTickRef.current;
    lastTickRef.current = now;
    if (dt <= 0 || dt > 2000) return;
    const dur = Math.min(Math.max(dt * 0.9, 40), 260);
    setTransitionMs(dur);
    setBlurPx(dt < 90 ? 6 : dt < 160 ? 3.5 : dt < 260 ? 1.5 : 0);
  }, [shuffleIndex]);

  const locked = !!shuffleTarget;

  if (!isShuffling && !locked) return null;
  if (pool.length === 0) return null;

  const n = pool.length;
  const offsetB = Math.floor(n / 3) || 1;
  const offsetC = Math.floor((n * 2) / 3) || 2;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#06080a]/97 backdrop-blur-md overflow-hidden">
      <style>{`
        @keyframes reel-tick {
          from { transform: translateY(-22px); opacity: 0.5; }
          to   { transform: translateY(0);      opacity: 1;   }
        }
        @keyframes reel-zoom-lock {
          0%   { transform: scale(0.5);  opacity: 0.25; }
          60%  { transform: scale(1.08); opacity: 1;    }
          100% { transform: scale(1);    opacity: 1;    }
        }
        @keyframes bulb-blink {
          0%, 100% { opacity: 0.25; }
          50%      { opacity: 1;    }
        }
        @keyframes confetti-burst {
          0%   { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0.3); opacity: 0; }
        }
      `}</style>

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div
          className="rounded-full blur-[160px] transition-all duration-1000"
          style={{
            width: 620,
            height: 620,
            background: locked ? `rgba(${ACC_RGB},0.22)` : `rgba(${ACC_RGB},0.06)`,
            transform: locked ? 'scale(1.25)' : 'scale(1)',
          }}
        />
      </div>

      {/* Headline */}
      <h2
        className="relative z-10 text-2xl md:text-3xl font-bold tracking-[0.22em] uppercase mb-6 text-center font-mono transition-all duration-500"
        style={{
          color: locked ? ACC : 'rgba(255,255,255,0.55)',
          textShadow: locked ? `0 0 18px rgba(${ACC_RGB},0.9)` : 'none',
          transform: locked ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        {locked ? '🎉 Player Selected!' : phrase}
      </h2>

      {/* Cabinet */}
      <div
        className="relative z-10 rounded-[28px] p-5 md:p-7"
        style={{
          background: 'linear-gradient(180deg, #171011 0%, #0c0908 100%)',
          border: `3px solid rgba(${ACC_RGB},0.45)`,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.6), 0 30px 70px rgba(0,0,0,0.7), inset 0 0 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* marquee bulbs */}
        <div className="flex justify-between px-2 mb-4">
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: 6,
                height: 6,
                background: ACC,
                animation: 'bulb-blink 1.1s ease-in-out infinite',
                animationDelay: `${(i % 7) * 0.12}s`,
                boxShadow: `0 0 6px rgba(${ACC_RGB},0.9)`,
              }}
            />
          ))}
        </div>

        {/* reel window */}
        <div
          className={`relative flex items-center justify-center gap-3 md:gap-5 rounded-2xl overflow-hidden ${
            locked ? 'p-0' : 'px-0 md:px-0 py-0'
          }`}
          style={{
            minHeight: locked ? 320 : undefined,
            background: 'radial-gradient(circle, #14181a 55%, #0a0d0e 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            className="absolute inset-x-0 top-0 h-10 z-20 pointer-events-none"
            style={{ background: 'linear-gradient(#0a0d0e, transparent)' }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-10 z-20 pointer-events-none"
            style={{ background: 'linear-gradient(transparent, #0a0d0e)' }}
          />
          <div
            className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-px z-20 pointer-events-none"
            style={{ background: `rgba(${ACC_RGB},${locked ? 0.5 : 0.18})` }}
          />

          {locked ? (
            // Locked: one single, larger image zooms in — no repeated tiles.
            <div
              key={shuffleTarget?.id ?? 'locked-card'}
              style={{ animation: 'reel-zoom-lock 480ms cubic-bezier(0.18,0.9,0.32,1.2) both' }}
            >
              <ReelCard player={shuffleTarget} size={240} dim={false} glow={true} />
            </div>
          ) : (
            <>
              <ReelColumn
                pool={pool}
                centerIndex={shuffleIndex}
                offset={0}
                cardSize={62}
                transitionMs={transitionMs}
                blurPx={Math.max(0, blurPx - 1.5)}
              />
              <ReelColumn
                pool={pool}
                centerIndex={shuffleIndex}
                offset={offsetB}
                cardSize={92}
                transitionMs={transitionMs}
                blurPx={blurPx}
              />
              <ReelColumn
                pool={pool}
                centerIndex={shuffleIndex}
                offset={offsetC}
                cardSize={62}
                transitionMs={transitionMs}
                blurPx={Math.max(0, blurPx - 1.5)}
              />
            </>
          )}
        </div>

        {/* confetti burst on win */}
        {locked && (
          <div
            key={shuffleTarget?.id ?? 'win'}
            className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center"
          >
            {Array.from({ length: 26 }).map((_, i) => {
              const angle = (i / 26) * Math.PI * 2;
              const dist = 90 + Math.random() * 60;
              const tx = Math.cos(angle) * dist;
              const ty = Math.sin(angle) * dist;
              return (
                <span
                  key={i}
                  className="absolute rounded-full"
                  style={
                    {
                      width: 5,
                      height: 5,
                      background: i % 2 === 0 ? ACC : '#ffffff',
                      '--tx': `${tx}px`,
                      '--ty': `${ty}px`,
                      animation: `confetti-burst ${0.7 + Math.random() * 0.5}s ease-out forwards`,
                    } as CSSProperties
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Winner card */}
      {shuffleTarget && (
        <div className="relative z-10 mt-7 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div
            className="absolute -inset-1 rounded-[22px] blur-md opacity-40"
            style={{ background: `linear-gradient(to bottom, ${ACC}, transparent)` }}
          />
          <div
            className="relative bg-[#101415] rounded-[18px] px-8 py-4 flex items-center gap-5 shadow-2xl"
            style={{ border: `1px solid rgba(${ACC_RGB},0.4)` }}
          >
            <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: ACC }}>
              <span className="font-mono font-black text-[#0b0f10] text-sm">
                {initials(shuffleTarget.name)}
              </span>
            </div>
            <div>
              <p className="font-bold text-xl text-white tracking-tight">{shuffleTarget.name}</p>
              <p className="font-mono text-xs tracking-widest uppercase mt-0.5" style={{ color: `rgba(${ACC_RGB},0.75)` }}>
                Base: {shuffleTarget.price}
              </p>
            </div>
            <div
              className="ml-3 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase"
              style={{ background: ACC, color: '#0b0f10' }}
            >
              On the block
            </div>
          </div>
        </div>
      )}

      {/* Pool counter */}
      <p className="relative z-10 mt-4 font-mono text-[10px] text-white/20 tracking-widest uppercase">
        {pool.length} player{pool.length !== 1 ? 's' : ''} remaining in pool
      </p>
    </div>
  );
}