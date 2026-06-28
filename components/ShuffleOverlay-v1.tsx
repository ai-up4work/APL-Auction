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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

interface PlayerCell {
  player: Player;
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
}

function buildGrid(players: Player[], W: number, H: number): PlayerCell[] {
  if (players.length === 0 || W === 0 || H === 0) return [];
  const n = players.length;
  const cols = Math.ceil(Math.sqrt(n * (W / H)));
  const rows = Math.ceil(n / cols);
  const cellW = W / cols;
  const cellH = H / rows;
  const pw = Math.max(28, Math.min(64, cellW - 4));
  const ph = Math.max(14, Math.min(28, cellH - 4));
  return players.map((player, i) => ({
    player,
    x: (i % cols) * cellW + cellW / 2,
    y: Math.floor(i / cols) * cellH + cellH / 2,
    w: pw,
    h: ph,
    scale: 1,
  }));
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  cells: PlayerCell[],
  winnerIdx: number | null,
  beamX: number,
  beamY: number,
  beamR: number,
  locked: boolean
) {
  cells.forEach((cell, i) => {
    const isWinner = i === winnerIdx && locked;
    const dx = cell.x - beamX;
    const dy = cell.y - beamY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const lit = beamR > 0 ? Math.max(0, 1 - dist / beamR) : 0;

    ctx.save();
    ctx.translate(cell.x, cell.y);
    if (isWinner) ctx.scale(cell.scale, cell.scale);

    const hw = cell.w / 2;
    const hh = cell.h / 2;
    const r = Math.min(3, hh * 0.4);

    let bg: string, stroke: string, textCol: string;
    if (isWinner) {
      bg = ACC; stroke = '#ff8855'; textCol = '#fff';
    } else if (lit > 0.05) {
      bg = `rgba(${30 + Math.round(lit * 80)},${18 + Math.round(lit * 20)},${14 + Math.round(lit * 10)},1)`;
      stroke = `rgba(228,93,53,${lit * 0.8})`;
      textCol = `rgba(${180 + Math.round(lit * 75)},${80 + Math.round(lit * 100)},${50 + Math.round(lit * 80)},${0.4 + lit * 0.6})`;
    } else {
      bg = '#101415'; stroke = '#1a2022'; textCol = '#334';
    }

    roundRect(ctx, -hw, -hh, cell.w, cell.h, r);
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = isWinner ? 1.5 : 0.8; ctx.stroke();

    const fsize = Math.max(7, Math.min(10, cell.h * 0.38));
    ctx.fillStyle = textCol;
    ctx.font = `700 ${fsize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const initials = cell.player.name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    ctx.fillText(initials, 0, 0);

    if (lit > 0.3 && !isWinner) {
      ctx.strokeStyle = `rgba(228,93,53,${lit * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  });
}

export function ShuffleOverlay({
  isShuffling,
  shuffleTarget,
  players,
}: ShuffleOverlayProps) {
  const availablePlayers = useMemo(
    () => players.filter((p) => p.status === 'locked'),
    [players]
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const stateRef = useRef({
    phase: 0,        // 0=sweep 1=homing 2=locked
    angle: 0,
    sweepSpeed: 0.16,
    beamX: 0,
    beamY: 0,
    beamR: 0,
    t: 0,
    pulseT: 0,
    locked: false,
    winnerIdx: -1,
    trailDots: [] as { x: number; y: number; alpha: number; vx: number; vy: number }[],
    cells: [] as PlayerCell[],
    W: 0,
    H: 0,
  });

  const [statusText, setStatusText] = useState('Scanning player pool…');
  const [pulseRings, setPulseRings] = useState<{ id: number; x: number; y: number; size: number }[]>([]);
  const pulseIdRef = useRef(0);

  // ── build / rebuild the grid ──────────────────────────────────────────────
  const rebuildGrid = useCallback(() => {
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
    s.cells = buildGrid(availablePlayers, W, H);
  }, [availablePlayers]);

  // ── start animation when shuffling begins ─────────────────────────────────
  useEffect(() => {
    if (!isShuffling && !shuffleTarget) return;
    if (!isShuffling && shuffleTarget) return; // already finished, handled below
    if (availablePlayers.length === 0) return;

    rebuildGrid();
    const s = stateRef.current;
    const cx = s.W / 2;
    const cy = s.H / 2;

    // pick winner
    const winnerPlayerIdx = Math.floor(Math.random() * availablePlayers.length);
    s.winnerIdx = winnerPlayerIdx;
    s.phase = 0;
    s.angle = 0;
    s.sweepSpeed = 0.16;
    s.beamX = cx;
    s.beamY = cy;
    s.beamR = Math.max(s.W, s.H) * 0.6;
    s.t = 0;
    s.pulseT = 0;
    s.locked = false;
    s.trailDots = [];

    const target = s.cells[winnerPlayerIdx];
    if (!target) return;
    const targetX = target.x;
    const targetY = target.y;
    const sweepR = Math.max(s.W, s.H) * 0.65;

    setStatusText('Scanning player pool…');

    if (animRef.current) cancelAnimationFrame(animRef.current);

    function frame() {
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext('2d')!;
      const { W, H, cells } = s;

      ctx.clearRect(0, 0, W, H);
      s.t++;

      if (s.phase === 0) {
        // rotating sweep from center
        s.angle += s.sweepSpeed;
        s.beamX = cx + Math.cos(s.angle) * sweepR * 0.6;
        s.beamY = cy + Math.sin(s.angle) * sweepR * 0.4;

        // sweep trail
        for (let a = 0; a < Math.PI * 0.65; a += 0.025) {
          const ta = s.angle - a;
          const ex = cx + Math.cos(ta) * sweepR * 0.8;
          const ey = cy + Math.sin(ta) * sweepR * 0.55;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey);
          ctx.strokeStyle = `rgba(228,93,53,${(0.65 - a / Math.PI * 0.65) * 0.13})`;
          ctx.lineWidth = 1.5; ctx.stroke();
        }
        // sweep arm
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(s.beamX * 1.25 - cx * 0.25, s.beamY * 1.25 - cy * 0.25);
        ctx.strokeStyle = 'rgba(228,93,53,0.45)'; ctx.lineWidth = 1; ctx.stroke();
        // center dot
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(228,93,53,0.6)'; ctx.fill();

        if (s.t > 70) s.sweepSpeed = Math.max(0.008, s.sweepSpeed * 0.974);
        if (s.sweepSpeed < 0.012) {
          s.phase = 1;
          setStatusText('Locking on…');
        }
      } else if (s.phase === 1) {
        const dx = targetX - s.beamX;
        const dy = targetY - s.beamY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        s.beamX += dx * 0.07;
        s.beamY += dy * 0.07;
        s.beamR = Math.max(55, s.beamR * 0.955);

        // fading arm
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(s.beamX, s.beamY);
        ctx.strokeStyle = 'rgba(228,93,53,0.2)'; ctx.lineWidth = 1; ctx.stroke();

        // heat sparks
        if (s.t % 3 === 0) {
          s.trailDots.push({
            x: s.beamX + (Math.random() - 0.5) * 28,
            y: s.beamY + (Math.random() - 0.5) * 28,
            alpha: 1,
            vx: (targetX - s.beamX) * 0.04,
            vy: (targetY - s.beamY) * 0.04,
          });
        }
        s.trailDots.forEach((d) => { d.x += d.vx; d.y += d.vy; d.alpha -= 0.045; });
        s.trailDots = s.trailDots.filter((d) => d.alpha > 0);

        if (dist < 4) {
          s.phase = 2;
          s.pulseT = 0;
          s.locked = true;
          s.beamX = targetX;
          s.beamY = targetY;
          setStatusText('Player selected!');
        }
      } else if (s.phase === 2) {
        s.pulseT++;
        // winner card breathes
        if (cells[s.winnerIdx]) {
          cells[s.winnerIdx].scale = 1 + Math.sin(s.pulseT * 0.15) * 0.07;
        }
        s.beamR = Math.max(18, s.beamR * 0.9);

        // spawn DOM pulse rings
        if (s.pulseT % 18 === 0 && s.pulseT < 90) {
          const wc = cells[s.winnerIdx];
          if (wc) {
            const id = pulseIdRef.current++;
            setPulseRings((prev) => [
              ...prev,
              { id, x: wc.x, y: wc.y, size: wc.w * 1.8 },
            ]);
            setTimeout(() => {
              setPulseRings((pr) => pr.filter((r) => r.id !== id));
            }, 900);
          }
        }
      }

      // draw trail dots
      s.trailDots.forEach((d) => {
        ctx.beginPath(); ctx.arc(d.x, d.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(228,93,53,${d.alpha * 0.6})`; ctx.fill();
      });

      drawGrid(ctx, cells, s.locked ? s.winnerIdx : -1, s.beamX, s.beamY, s.beamR, s.locked);

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShuffling]);

  // ── cleanup on close ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isShuffling && !shuffleTarget) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }
  }, [isShuffling, shuffleTarget]);

  if (!isShuffling && !shuffleTarget) return null;
  if (availablePlayers.length === 0) return null;

  const s = stateRef.current;
  const canvasW = s.W || 600;
  const canvasH = s.H || 340;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0b0f10]/96 backdrop-blur-md">

      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div
          className={`w-[700px] h-[700px] rounded-full blur-[140px] transition-all duration-1000 ease-out
            ${shuffleTarget
              ? 'bg-[#e45d35]/25 scale-150'
              : 'bg-[#e45d35]/08 scale-100 animate-pulse'
            }`}
        />
      </div>

      {/* Headline */}
      <h2
        className={`relative z-10 text-2xl md:text-3xl font-bold tracking-[0.22em] uppercase mb-6 transition-all duration-500 text-center font-mono
          ${shuffleTarget
            ? 'text-[#e45d35] drop-shadow-[0_0_14px_rgba(228,93,53,0.8)] scale-105'
            : 'text-white/60 animate-pulse'
          }`}
      >
        {shuffleTarget ? 'Player Selected' : statusText}
      </h2>

      {/* ── Canvas arena ── */}
      <div
        className="relative z-10 rounded-2xl overflow-hidden border border-[#e45d35]/20"
        style={{ width: 'min(92vw, 700px)', height: 'clamp(200px, 42vh, 380px)', background: '#080b0c' }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {/* Pulse rings rendered over canvas */}
        {pulseRings.map((ring) => (
          <div
            key={ring.id}
            className="absolute rounded-full border-2 border-[#e45d35] pointer-events-none animate-ping"
            style={{
              left: ring.x - ring.size / 2,
              top: ring.y - ring.size / 2,
              width: ring.size,
              height: ring.size,
              animationDuration: '0.8s',
              animationFillMode: 'forwards',
            }}
          />
        ))}

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{ boxShadow: 'inset 0 0 60px rgba(8,11,12,0.85)' }}
        />
      </div>

      {/* ── Winner reveal card (shown when shuffleTarget is set) ── */}
      {shuffleTarget && (
        <div
          className="relative z-10 mt-8 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          {/* glow border */}
          <div className="absolute -inset-1 bg-gradient-to-b from-[#e45d35] to-transparent rounded-[22px] blur-md opacity-50" />
          <div className="relative bg-[#101415] border border-[#e45d35]/40 rounded-[18px] px-8 py-5 flex items-center gap-5 shadow-2xl">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-xl bg-[#e45d35]/15 border border-[#e45d35]/30 flex items-center justify-center flex-shrink-0">
              <span className="font-mono font-black text-[#e45d35] text-base">
                {shuffleTarget.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
            {/* Info */}
            <div>
              <p className="font-bold text-xl text-white tracking-tight">{shuffleTarget.name}</p>
              <p className="font-mono text-xs text-[#e45d35]/70 tracking-widest uppercase mt-1">
                Base: {shuffleTarget.price}
              </p>
            </div>
            {/* Lot badge */}
            <div className="ml-4 px-3 py-1 rounded-full bg-[#e45d35] text-[#0b0f10] text-[10px] font-black tracking-widest uppercase">
              On the block
            </div>
          </div>
        </div>
      )}

      {/* Pool counter */}
      <p className="relative z-10 mt-5 font-mono text-[10px] text-white/25 tracking-widest uppercase">
        {availablePlayers.length} player{availablePlayers.length !== 1 ? 's' : ''} remaining in pool
      </p>
    </div>
  );
}