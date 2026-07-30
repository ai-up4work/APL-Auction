"use client";

import { useEffect, useRef, useState } from 'react';
import { Player, Team } from '@/types/sankeytype';

interface FlowCanvasProps {
  players: Player[];
  teams?: Team[];
  playerListRef: React.RefObject<HTMLDivElement | null>;
  teamListRef: React.RefObject<HTMLDivElement | null>;
  activePlayer: string | null;
  activeTeam: string | null;
}

export function FlowCanvas({ players, teams, playerListRef, teamListRef, activePlayer, activeTeam }: FlowCanvasProps) {
  // `teams` is unused by the drawing logic (team DOM nodes are looked up via
  // p.teamShortCode instead). Kept optional so callers without team data
  // (e.g. the watch page) aren't forced to pass it.
  void teams;

  const svgRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<{ id: string; d: string; highlighted: boolean; dimmed: boolean }[]>([]);

  useEffect(() => {
    const updateFlowLines = () => {
      if (!svgRef.current || !playerListRef.current || !teamListRef.current) return;

      const svgRect = svgRef.current.getBoundingClientRect();
      const pContainer = playerListRef.current;
      const tContainer = teamListRef.current;

      const pContRect = pContainer.getBoundingClientRect();
      const tContRect = tContainer.getBoundingClientRect();

      const newPaths: typeof paths = [];
      const hasSelection = activePlayer !== null || activeTeam !== null;

      players.forEach(p => {
        if (p.status !== 'sold' && p.status !== 'unsold') return;

        if (p.status === 'unsold') return;

        const playerEl = document.getElementById(`player-${p.id}`);
        const teamEl = document.getElementById(`team-${p.teamShortCode}`);

        if (playerEl && teamEl) {
          const pRect = playerEl.getBoundingClientRect();
          const tRect = teamEl.getBoundingClientRect();

          const pVisible = pRect.top < pContRect.bottom && pRect.bottom > pContRect.top;
          const tVisible = tRect.top < tContRect.bottom && tRect.bottom > tContRect.top;

          if (pVisible || tVisible) {
            const startX = pRect.right - svgRect.left;
            const startY = pRect.top + pRect.height / 2 - svgRect.top;

            const endX = tRect.left - svgRect.left;
            const endY = tRect.top + tRect.height / 2 - svgRect.top;

            const isHighlighted = hasSelection
              ? (activePlayer !== null
                  ? activePlayer === String(p.id)
                  : activeTeam !== null && activeTeam === p.teamShortCode)
              : false;
            const isDimmed = hasSelection && !isHighlighted;

            newPaths.push({
              id: String(p.id),
              d: `M ${startX} ${startY} C ${startX + (endX - startX) * 0.4} ${startY}, ${startX + (endX - startX) * 0.6} ${endY}, ${endX} ${endY}`,
              highlighted: isHighlighted,
              dimmed: isDimmed
            });
          }
        }
      });

      setPaths(newPaths);
    };

    let animationFrameId: number;
    const loop = () => {
       updateFlowLines();
       animationFrameId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [players, playerListRef, teamListRef, activePlayer, activeTeam]);

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-visible">
      <svg
        ref={svgRef}
        className="w-full h-full overflow-visible pointer-events-none"
      >
        <defs>
          <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-bid-glow)" stopOpacity="0.3" />
            <stop offset="50%" stopColor="var(--color-bid-glow)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--color-bid-glow)" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="flow-gradient-dim" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-bid-glow)" stopOpacity="0.05" />
            <stop offset="50%" stopColor="var(--color-bid-glow)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--color-bid-glow)" stopOpacity="0.05" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {paths.map(path => (
          <g key={path.id}>
            <path
              className="transition-all duration-300"
              d={path.d}
              fill="none"
              stroke="url(#flow-gradient)"
              strokeWidth={path.highlighted ? 8 : 4}
              style={{
                opacity: path.dimmed ? 0.3 : (path.highlighted ? 1 : 0.6),
                filter: path.highlighted ? 'url(#glow)' : (path.dimmed ? 'blur(3px)' : 'none')
              }}
            />
            <path
              className="flow-dots transition-all duration-300"
              d={path.d}
              fill="none"
              stroke={path.highlighted ? "#fff" : "var(--color-bid-glow)"}
              strokeWidth={path.highlighted ? 3 : (path.dimmed ? 1 : 2)}
              strokeOpacity={path.highlighted ? 0.9 : (path.dimmed ? 0.2 : 0.4)}
              style={{
                filter: path.dimmed ? 'blur(1px)' : 'none'
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}