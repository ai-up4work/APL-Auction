'use client';

import { Player } from '@/types/sankeytype';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';

interface ShuffleOverlayProps {
  isShuffling: boolean;
  shuffleTarget: Player | null;
  players: Player[];
  shuffleIndex: number;
}

// Pulled from globals.css --color-theme-orange at runtime so this canvas
// never drifts from the rest of the app's accent color again.
// (Fallback values match --color-theme-orange's current value in globals.css.)
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

// ── grid sizing: find rows x cols >= n, as close to a square as possible ────
// e.g. 26 -> 5x6 (30 cells), not 13x2 or 9x3.
function bestGridShape(n: number): { rows: number; cols: number } {
  if (n <= 0) return { rows: 1, cols: 1 };
  let best = { rows: 1, cols: n, score: Infinity };
  const maxDim = Math.ceil(Math.sqrt(n)) + 6; // search window around sqrt(n)
  for (let rows = 1; rows <= maxDim; rows++) {
    const cols = Math.ceil(n / rows);
    if (rows * cols < n) continue;
    const overshoot = rows * cols - n;
    const aspectRatio = Math.max(rows, cols) / Math.min(rows, cols);
    // squareness (aspect ratio) dominates the choice; overshoot only breaks
    // ties among shapes that are similarly square-ish.
    const score = aspectRatio * 10 + overshoot * 0.3;
    if (score < best.score) {
      best = { rows, cols, score };
    }
  }
  return { rows: best.rows, cols: best.cols };
}

interface GridCell {
  player: Player | null; // null = empty/disabled padding cell
  active: boolean;       // still pickable
  row: number;
  col: number;
  cx: number;            // center x (relative to canvas)
  cy: number;
  size: number;
  // animation state
  lit: number;            // 0..1 current brightness from blinking
  selected: boolean;
  flipT: number;
  pulsePhase: number;
}

function buildGrid(
  players: Player[],
  W: number,
  H: number
): { cells: GridCell[]; rows: number; cols: number } {
  const pickable = players.filter((p) => p.status === 'locked');
  const n = pickable.length;
  if (n === 0) return { cells: [], rows: 0, cols: 0 };

  const { rows, cols } = bestGridShape(n);
  const totalSlots = rows * cols;

  // randomly choose which slots are "disabled" padding (totalSlots - n of them)
  const slotIsPlayer: boolean[] = Array.from({ length: totalSlots }, (_, i) => i < n);
  // Fisher-Yates shuffle of slot assignment so padding isn't all at the end
  for (let i = slotIsPlayer.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slotIsPlayer[i], slotIsPlayer[j]] = [slotIsPlayer[j], slotIsPlayer[i]];
  }

  // shuffle player order so it's not deterministic by original array order
  const shuffledPlayers = [...pickable];
  for (let i = shuffledPlayers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
  }

  const pad = 28;
  const gw = W - pad * 2;
  const gh = H - pad * 2;
  const cellW = gw / cols;
  const cellH = gh / rows;
  const size = Math.min(cellW, cellH) * 0.74;

  const cells: GridCell[] = [];
  let playerCursor = 0;
  for (let i = 0; i < totalSlots; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const cx = pad + cellW * col + cellW / 2;
    const cy = pad + cellH * row + cellH / 2;
    const isPlayer = slotIsPlayer[i];
    const player = isPlayer ? shuffledPlayers[playerCursor++] : null;
    cells.push({
      player,
      active: isPlayer,
      row,
      col,
      cx,
      cy,
      size,
      lit: 0,
      selected: false,
      flipT: 0,
      pulsePhase: Math.random() * Math.PI * 2,
    });
  }

  return { cells, rows, cols };
}

export function ShuffleOverlay({
  isShuffling,
  shuffleTarget,
  players,
}: ShuffleOverlayProps) {
  const pickablePlayers = useMemo(() => players.filter((p) => p.status === 'locked'), [players]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  const stateRef = useRef({
    phase: 0 as 0 | 1 | 2, // 0=random blinking 1=narrowing down 2=locked on winner
    t: 0,
    cells: [] as GridCell[],
    rows: 0,
    cols: 0,
    W: 0,
    H: 0,
    winnerIdx: -1,
    blinkTimer: 0,
    blinkInterval: 4,     // frames between blink waves (speeds up via reduce)
    blinkCount: 0,        // how many cells lit per wave (reduces over time)
    activeBlinkSet: [] as number[], // indices currently lit this wave
    narrowPool: [] as number[],     // shrinking candidate pool that always includes winner
    settleStarted: false,
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
    const { cells, rows, cols } = buildGrid(pickablePlayers, W, H);
    s.cells = cells;
    s.rows = rows;
    s.cols = cols;
  }, [pickablePlayers]);

  useEffect(() => {
    if (!isShuffling) return;
    if (pickablePlayers.length === 0) return;

    // Make sure the canvas always paints with whatever --color-theme-orange
    // currently resolves to, instead of a baked-in hex value.
    syncThemeColor();

    rebuild();
    const s = stateRef.current;
    s.phase = 0;
    s.t = 0;
    s.blinkTimer = 0;
    s.blinkInterval = 4;
    s.settleStarted = false;

    // pick winner among active (player-bearing) cells
    const activeIndices = s.cells
      .map((c, i) => (c.active ? i : -1))
      .filter((i) => i >= 0);
    s.winnerIdx = activeIndices[Math.floor(Math.random() * activeIndices.length)];
    s.narrowPool = [...activeIndices];

    // initial blink wave size: a healthy chunk of the active cells
    s.blinkCount = Math.max(4, Math.round(activeIndices.length * 0.4));
    s.activeBlinkSet = [];

    setStatusText('Scanning player pool…');

    if (animRef.current) cancelAnimationFrame(animRef.current);

    const TOTAL_DURATION = 220; // frames before we force-settle, matches prior ~2.2s+ feel
    const SETTLE_AT = 190;      // frame at which we begin the final lock-on

    function pickBlinkWave() {
      // Always keep the winner eligible to appear in waves so the final
      // reveal feels like it "found" the winner rather than teleporting.
      const pool = s.narrowPool.length > 0 ? s.narrowPool : [s.winnerIdx];
      const count = Math.min(s.blinkCount, pool.length);
      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      // ensure winner is included once we're narrowing down (phase progressing)
      let picked = shuffled.slice(0, count);
      if (s.t > 60 && !picked.includes(s.winnerIdx)) {
        picked[picked.length - 1] = s.winnerIdx;
      }
      s.activeBlinkSet = picked;
    }

    function frame() {
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext('2d')!;
      const { W, H, cells, rows, cols } = s;

      ctx.clearRect(0, 0, W, H);
      s.t++;

      // ── background grid lines (subtle) ─────────────────────────────────
      ctx.strokeStyle = `rgba(${ACC_RGB},0.05)`;
      ctx.lineWidth = 0.5;
      if (cells.length > 0) {
        const pad = 28;
        const cellW = (W - pad * 2) / cols;
        const cellH = (H - pad * 2) / rows;
        for (let c = 0; c <= cols; c++) {
          const x = pad + c * cellW;
          ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke();
        }
        for (let r = 0; r <= rows; r++) {
          const y = pad + r * cellH;
          ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
        }
      }

      // ── manage blink waves (phase 0/1) ──────────────────────────────────
      if (s.phase === 0 || s.phase === 1) {
        s.blinkTimer++;
        if (s.blinkTimer >= s.blinkInterval) {
          s.blinkTimer = 0;
          pickBlinkWave();

          // progressively narrow the candidate pool and speed up / shrink wave size
          if (s.t > 40) {
            // shrink pool toward winner over time
            const shrinkTo = Math.max(
              1,
              Math.round(s.narrowPool.length * 0.78)
            );
            if (shrinkTo < s.narrowPool.length) {
              const shuffledPool = [...s.narrowPool];
              for (let i = shuffledPool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]];
              }
              const keep = new Set(shuffledPool.slice(0, shrinkTo));
              keep.add(s.winnerIdx);
              s.narrowPool = s.narrowPool.filter((i) => keep.has(i));
            }
            s.blinkCount = Math.max(1, Math.round(s.blinkCount * 0.9));
            s.blinkInterval = Math.min(14, s.blinkInterval + 0.6);
            s.phase = 1;
            setStatusText('Narrowing down…');
          }
        }
      }

      // ── settle into final winner ────────────────────────────────────────
      if (s.t >= SETTLE_AT && !s.settleStarted) {
        s.settleStarted = true;
        s.phase = 2;
        s.activeBlinkSet = [s.winnerIdx];
        setStatusText('Locking on…');
      }

      // update lit values toward target (smooth blink decay/attack)
      cells.forEach((cell, i) => {
        const isLitTarget =
          s.phase === 2 ? i === s.winnerIdx : s.activeBlinkSet.includes(i);
        const target = !cell.active ? 0 : isLitTarget ? 1 : 0;
        cell.lit += (target - cell.lit) * (s.phase === 2 ? 0.08 : 0.35);
      });

      if (s.phase === 2 && s.t > SETTLE_AT + 18) {
        const winnerCell = cells[s.winnerIdx];
        if (winnerCell && !winnerCell.selected) {
          winnerCell.selected = true;
        }
      }

      // ── draw cells ───────────────────────────────────────────────────────
      cells.forEach((cell, i) => {
        const { cx, cy, size } = cell;
        ctx.save();
        ctx.translate(cx, cy);

        if (!cell.active) {
          // disabled / padding cell — faint ghost square
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = `rgba(40,48,50,1)`;
          roundRect(ctx, -size / 2, -size / 2, size, size, 5);
          ctx.fill();
          ctx.restore();
          return;
        }

        if (cell.selected) {
          const progress = cell.flipT = Math.min(1, cell.flipT + 0.05);
          const r = size / 2 + progress * 6;

          // glow rings
          ctx.beginPath();
          ctx.arc(0, 0, r + 6 + Math.sin(s.t * 0.1) * 2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${ACC_RGB},${0.35 * progress})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.globalAlpha = 1;
          roundRect(ctx, -r, -r, r * 2, r * 2, 8);
          ctx.fillStyle = ACC;
          ctx.fill();

          if (progress > 0.4) {
            const fsize = Math.max(9, r * 0.7);
            ctx.fillStyle = `rgba(255,255,255,${(progress - 0.4) / 0.6})`;
            ctx.font = `900 ${fsize}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const initials = (cell.player!.name || '')
              .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            ctx.fillText(initials, 0, 0);
          }
        } else {
          // active blinking square — always clearly visible at rest, brighter when lit
          const lit = cell.lit;

          ctx.globalAlpha = 1;
          if (lit > 0.05) {
            // glow behind lit cell
            ctx.save();
            ctx.shadowColor = `rgba(${ACC_RGB},${lit * 0.8})`;
            ctx.shadowBlur = 14 * lit;
            ctx.fillStyle = `rgba(${ACC_RGB},${0.18 + lit * 0.62})`;
            roundRect(ctx, -size / 2, -size / 2, size, size, 5);
            ctx.fill();
            ctx.restore();
          } else {
            // resting state — still a clearly visible filled square, not near-invisible
            ctx.fillStyle = `rgba(${ACC_RGB},0.16)`;
            roundRect(ctx, -size / 2, -size / 2, size, size, 5);
            ctx.fill();
          }

          ctx.strokeStyle = `rgba(${ACC_RGB},${0.45 + lit * 0.5})`;
          ctx.lineWidth = 1.4;
          roundRect(ctx, -size / 2, -size / 2, size, size, 5);
          ctx.stroke();
        }

        ctx.restore();
      });

      if (s.phase === 2 && cells[s.winnerIdx]?.flipT >= 1) {
        // hold on final frame; the parent will swap shuffleTarget in shortly
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
          ${shuffleTarget ? 'bg-theme-orange/20 scale-125' : 'bg-theme-orange/[0.06] animate-pulse'}`} />
      </div>

      {/* Headline */}
      <h2 className={`relative z-10 text-2xl md:text-3xl font-bold tracking-[0.22em] uppercase mb-5
        transition-all duration-500 text-center font-mono
        ${shuffleTarget
          ? 'text-theme-orange drop-shadow-[0_0_18px_rgba(201,151,31,0.9)] scale-105'
          : 'text-white/50 animate-pulse'}`}>
        {shuffleTarget ? 'Player Selected' : statusText}
      </h2>

      {/* Heatmap canvas */}
      <div
        className="relative z-10 rounded-2xl overflow-hidden border border-theme-orange/15"
        style={{
          width: 'min(92vw, 620px)',
          height: 'min(92vw, 460px)',
          background: 'radial-gradient(circle, #0c1012 60%, #080b0c 100%)',
          boxShadow: '0 0 60px rgba(201,151,31,0.06), inset 0 0 40px rgba(0,0,0,0.6)',
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
          <div className="absolute -inset-1 bg-gradient-to-b from-theme-orange to-transparent rounded-[22px] blur-md opacity-40" />
          <div className="relative bg-[#101415] border border-theme-orange/40 rounded-[18px] px-8 py-4
            flex items-center gap-5 shadow-2xl">
            <div className="w-11 h-11 rounded-full bg-theme-orange flex items-center justify-center flex-shrink-0">
              <span className="font-mono font-black text-[#0b0f10] text-sm">
                {shuffleTarget.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-bold text-xl text-white tracking-tight">{shuffleTarget.name}</p>
              <p className="font-mono text-xs text-theme-orange/70 tracking-widest uppercase mt-0.5">
                Base: {shuffleTarget.price}
              </p>
            </div>
            <div className="ml-3 px-3 py-1 rounded-full bg-theme-orange text-[#0b0f10] text-[10px]
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

// ── helper: rounded rect path ────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}