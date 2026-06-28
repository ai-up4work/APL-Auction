'use client';

import { Player } from '@/types/sankeytype';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';

interface ShuffleOverlayProps {
  isShuffling: boolean;
  shuffleTarget: Player | null;
  players: Player[];
  shuffleIndex: number;
}

const ACC = '#e45d35';
const ACC_RGB = '228,93,53';

// ── place dots in concentric rings on the radar ──────────────────────────────
interface RadarDot {
  player: Player;
  x: number;       // relative to radar center
  y: number;
  baseX: number;
  baseY: number;
  angle: number;   // radians from center
  dist: number;    // 0..1 (normalized ring distance)
  radius: number;  // current rendered radius (grows on selection)
  targetRadius: number;
  alpha: number;   // 0..1 (fades out when disabled)
  active: boolean; // still in pool
  selected: boolean; // this was the pick — grows + shows avatar
  flipT: number;   // 0..1 card-flip progress (after selection)
  jitter: number;  // small random offset for organic feel
  jitterAngle: number;
  blip: number;    // ping animation timer
}

function buildDots(players: Player[], W: number, H: number): RadarDot[] {
  const R = Math.min(W, H) * 0.44; // radar usable radius
  const active = players.filter((p) => p.status === 'locked');
  const inactive = players.filter((p) => p.status !== 'locked');
  const all = [...active, ...inactive];
  const n = all.length;
  if (n === 0) return [];

  // distribute across 3 rings
  const rings = [
    { count: Math.ceil(n * 0.25), r: 0.32 },
    { count: Math.ceil(n * 0.4),  r: 0.62 },
    { count: n,                    r: 0.88 }, // outer catches remainder
  ];

  const dots: RadarDot[] = [];
  let placed = 0;
  for (const ring of rings) {
    const inRing = Math.min(ring.count, n - placed);
    if (inRing <= 0) break;
    for (let i = 0; i < inRing; i++) {
      const player = all[placed + i];
      const angle = ((2 * Math.PI) / inRing) * i - Math.PI / 2 + (ring.r * 0.3);
      const d = ring.r * R;
      const isActive = player.status === 'locked';
      dots.push({
        player,
        x: Math.cos(angle) * d,
        y: Math.sin(angle) * d,
        baseX: Math.cos(angle) * d,
        baseY: Math.sin(angle) * d,
        angle,
        dist: ring.r,
        radius: isActive ? 5 : 3,
        targetRadius: isActive ? 5 : 3,
        alpha: isActive ? 1 : 0.18,
        active: isActive,
        selected: false,
        flipT: 0,
        jitter: Math.random() * 2 - 1,
        jitterAngle: Math.random() * Math.PI * 2,
        blip: Math.random() * 60,
      });
    }
    placed += inRing;
    if (placed >= n) break;
  }
  return dots;
}

export function ShuffleOverlay({
  isShuffling,
  shuffleTarget,
  players,
}: ShuffleOverlayProps) {
  const pickablePlayers = useMemo(() => players.filter((p) => p.status === 'locked'), [players]);
  const allVisiblePlayers = useMemo(() => players.filter(
    (p) => p.status === 'locked' || p.status === 'sold' || p.status === 'pending'
  ), [players]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  const stateRef = useRef({
    phase: 0 as 0 | 1 | 2, // 0=sweeping 1=homing 2=locked
    sweepAngle: 0,
    sweepSpeed: 0.025,
    t: 0,
    dots: [] as RadarDot[],
    winnerIdx: -1,
    W: 0,
    H: 0,
    cx: 0,
    cy: 0,
    R: 0,
    trailDots: [] as { x: number; y: number; a: number }[],
    homingT: 0,
  });

  const [statusText, setStatusText] = useState('Scanning player pool…');

  const rebuild = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const W = cv.clientWidth;
    const H = cv.clientHeight;
    cv.width = W * 2;
    cv.height = H * 2;
    const ctx = cv.getContext('2d')!;
    ctx.scale(2, 2);
    const s = stateRef.current;
    s.W = W; s.H = H;
    s.cx = W / 2; s.cy = H / 2;
    s.R = Math.min(W, H) * 0.44;
    s.dots = buildDots(allVisiblePlayers, W, H);
  }, [allVisiblePlayers]);

  useEffect(() => {
    if (!isShuffling) return;
    if (pickablePlayers.length === 0) return;

    rebuild();
    const s = stateRef.current;
    s.phase = 0;
    s.sweepAngle = -Math.PI / 2;
    s.sweepSpeed = 0.025;
    s.t = 0;
    s.trailDots = [];
    s.homingT = 0;

    // pick winner
    const winnerPlayer = pickablePlayers[Math.floor(Math.random() * pickablePlayers.length)];
    s.winnerIdx = s.dots.findIndex((d) => d.player === winnerPlayer);

    setStatusText('Scanning player pool…');

    if (animRef.current) cancelAnimationFrame(animRef.current);

    const TRAIL_ARC = Math.PI * 0.55; // how much of the sweep trail to show

    function frame() {
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext('2d')!;
      const { W, H, cx, cy, R, dots } = s;

      ctx.clearRect(0, 0, W, H);
      s.t++;

      // ── draw radar rings ──────────────────────────────────────────────────
      [0.32, 0.62, 0.88, 1.0].forEach((rf, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, rf * R, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${ACC_RGB},${0.06 + i * 0.03})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      });

      // crosshairs
      ctx.strokeStyle = `rgba(${ACC_RGB},0.08)`;
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      // diagonal guides
      [45, 135].forEach((deg) => {
        const rad = deg * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(rad) * R, cy + Math.sin(rad) * R);
        ctx.lineTo(cx - Math.cos(rad) * R, cy - Math.sin(rad) * R);
        ctx.stroke();
      });

      // ── sweep arm ────────────────────────────────────────────────────────
      if (s.phase === 0 || s.phase === 1) {
        // gradient trail
        for (let a = 0; a < TRAIL_ARC; a += 0.018) {
          const ta = s.sweepAngle - a;
          const fade = Math.pow(1 - a / TRAIL_ARC, 1.6);
          // fill sector slice
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, R * 1.01, ta, ta + 0.022);
          ctx.closePath();
          ctx.fillStyle = `rgba(${ACC_RGB},${fade * 0.18})`;
          ctx.fill();
        }
        // bright leading edge line
        const ex = cx + Math.cos(s.sweepAngle) * R;
        const ey = cy + Math.sin(s.sweepAngle) * R;
        const grad = ctx.createLinearGradient(cx, cy, ex, ey);
        grad.addColorStop(0, `rgba(${ACC_RGB},0)`);
        grad.addColorStop(0.6, `rgba(${ACC_RGB},0.3)`);
        grad.addColorStop(1, `rgba(${ACC_RGB},0.9)`);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey);
        ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.stroke();

        // center pulse dot
        ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = ACC; ctx.fill();
      }

      // ── dots ─────────────────────────────────────────────────────────────
      dots.forEach((dot, i) => {
        const px = cx + dot.x;
        const py = cy + dot.y;

        // blip: light up when sweep passes over
        const dotAngle = Math.atan2(dot.y, dot.x);
        let sweepDelta = ((s.sweepAngle - dotAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (sweepDelta > Math.PI) sweepDelta = 0;
        const blipAlpha = dot.active ? Math.max(0, 1 - sweepDelta / (Math.PI * 0.6)) * 0.6 : 0;

        // grow/shrink radius smoothly
        dot.radius += (dot.targetRadius - dot.radius) * 0.12;

        if (dot.selected && dot.flipT < 1) {
          dot.flipT = Math.min(1, dot.flipT + 0.025);
        }

        const isWinner = i === s.winnerIdx;
        const r = dot.radius;

        ctx.save();
        ctx.translate(px, py);
        ctx.globalAlpha = dot.alpha;

        if (dot.selected) {
          // ── selected: grow into avatar circle ────────────────────────────
          const progress = dot.flipT;

          // outer glow ring
          ctx.beginPath();
          ctx.arc(0, 0, r + 4 + Math.sin(s.t * 0.1) * 2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${ACC_RGB},${0.3 * progress})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // second ring
          ctx.beginPath();
          ctx.arc(0, 0, r + 10 + Math.sin(s.t * 0.07) * 3, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${ACC_RGB},${0.15 * progress})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();

          // filled avatar circle
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = ACC;
          ctx.fill();

          // initials inside
          if (progress > 0.4) {
            const fsize = Math.max(8, r * 0.5);
            ctx.fillStyle = `rgba(255,255,255,${(progress - 0.4) / 0.6})`;
            ctx.font = `900 ${fsize}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const initials = dot.player.name
              .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            ctx.fillText(initials, 0, 0);
          }

          // name label below
          if (progress > 0.6) {
            const labelAlpha = (progress - 0.6) / 0.4;
            ctx.fillStyle = `rgba(${ACC_RGB},${labelAlpha})`;
            ctx.font = `700 ${Math.max(7, r * 0.28)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(dot.player.name.split(' ')[0].toUpperCase(), 0, r + 6);
          }

        } else if (dot.active) {
          // ── active dot: glowing blip ──────────────────────────────────────
          // blip ring when sweep passes
          if (blipAlpha > 0.01) {
            ctx.beginPath();
            ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${ACC_RGB},${blipAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // core dot
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          grd.addColorStop(0, `rgba(255,160,100,1)`);
          grd.addColorStop(1, `rgba(${ACC_RGB},0.7)`);
          ctx.fillStyle = grd;
          ctx.fill();

          // dim ring
          ctx.beginPath();
          ctx.arc(0, 0, r + 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${ACC_RGB},0.4)`;
          ctx.lineWidth = 0.8;
          ctx.stroke();

        } else {
          // ── inactive / used dot: faded ghost ─────────────────────────────
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(30,40,42,1)`;
          ctx.fill();
          ctx.strokeStyle = `rgba(${ACC_RGB},0.12)`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }

        ctx.restore();
      });

      // ── homing beam to winner ─────────────────────────────────────────────
      if (s.phase === 1) {
        const winner = dots[s.winnerIdx];
        if (winner) {
          const wx = cx + winner.x;
          const wy = cy + winner.y;
          s.homingT = Math.min(1, s.homingT + 0.04);
          const beamAlpha = s.homingT * 0.6;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(wx, wy);
          ctx.strokeStyle = `rgba(${ACC_RGB},${beamAlpha})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // converging rings
          const ringR = (1 - s.homingT) * 30 + 8;
          ctx.beginPath();
          ctx.arc(wx, wy, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${ACC_RGB},${s.homingT * 0.7})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          if (s.homingT >= 1) {
            s.phase = 2;
            winner.selected = true;
            winner.targetRadius = 28;
            setStatusText('Player selected!');
          }
        }
      }

      // ── phase transitions ─────────────────────────────────────────────────
      if (s.phase === 0) {
        s.sweepAngle += s.sweepSpeed;

        // slow down after enough rotations
        if (s.t > 160) s.sweepSpeed = Math.max(0.004, s.sweepSpeed * 0.987);

        // check if sweep line is close to winner
        if (s.sweepSpeed < 0.007) {
          const winner = dots[s.winnerIdx];
          if (winner) {
            const winAngle = Math.atan2(winner.y, winner.x);
            let delta = ((s.sweepAngle - winAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            if (delta > Math.PI) delta = Math.PI * 2 - delta;
            // snap when line crosses winner
            if (delta < 0.08) {
              s.phase = 1;
              s.homingT = 0;
              setStatusText('Locking on…');
            }
          }
        }
      }

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShuffling]);

  useEffect(() => {
    if (!isShuffling && !shuffleTarget) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }
  }, [isShuffling, shuffleTarget]);

  if (!isShuffling && !shuffleTarget) return null;
  if (pickablePlayers.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#06080a]/97 backdrop-blur-md">

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div className={`w-[600px] h-[600px] rounded-full blur-[160px] transition-all duration-1000
          ${shuffleTarget ? 'bg-[#e45d35]/20 scale-125' : 'bg-[#e45d35]/06 animate-pulse'}`} />
      </div>

      {/* Headline */}
      <h2 className={`relative z-10 text-2xl md:text-3xl font-bold tracking-[0.22em] uppercase mb-5
        transition-all duration-500 text-center font-mono
        ${shuffleTarget
          ? 'text-[#e45d35] drop-shadow-[0_0_18px_rgba(228,93,53,0.9)] scale-105'
          : 'text-white/50 animate-pulse'}`}>
        {shuffleTarget ? 'Player Selected' : statusText}
      </h2>

      {/* Radar canvas */}
      <div
        className="relative z-10 rounded-full overflow-hidden border border-[#e45d35]/15"
        style={{
          width: 'min(88vw, 520px)',
          height: 'min(88vw, 520px)',
          background: 'radial-gradient(circle, #0c1012 60%, #080b0c 100%)',
          boxShadow: '0 0 60px rgba(228,93,53,0.06), inset 0 0 40px rgba(0,0,0,0.6)',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>

      {/* Winner card */}
      {shuffleTarget && (
        <div className="relative z-10 mt-7 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="absolute -inset-1 bg-gradient-to-b from-[#e45d35] to-transparent rounded-[22px] blur-md opacity-40" />
          <div className="relative bg-[#101415] border border-[#e45d35]/40 rounded-[18px] px-8 py-4
            flex items-center gap-5 shadow-2xl">
            <div className="w-11 h-11 rounded-full bg-[#e45d35] flex items-center justify-center flex-shrink-0">
              <span className="font-mono font-black text-[#0b0f10] text-sm">
                {shuffleTarget.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-bold text-xl text-white tracking-tight">{shuffleTarget.name}</p>
              <p className="font-mono text-xs text-[#e45d35]/70 tracking-widest uppercase mt-0.5">
                Base: {shuffleTarget.price}
              </p>
            </div>
            <div className="ml-3 px-3 py-1 rounded-full bg-[#e45d35] text-[#0b0f10] text-[10px]
              font-black tracking-widest uppercase">
              On the block
            </div>
          </div>
        </div>
      )}

      {/* Pool counter */}
      <p className="relative z-10 mt-4 font-mono text-[10px] text-white/20 tracking-widest uppercase">
        {pickablePlayers.length} player{pickablePlayers.length !== 1 ? 's' : ''} remaining in pool
      </p>
    </div>
  );
}