// components/FlowTeamCard.tsx
"use client";

import React from "react";

export interface FlowTeamCardProps {
  id: string;
  name: string;
  shortCode: string;
  logoUrl: string;

  /**
   * Freeform label shown under the team name.
   * Watch page passes something like "12,400 PTS".
   * Results page passes something like "Players: 6".
   */
  purseLabel: string;

  isHighlighted: boolean;
  isDimmed: boolean;
  onClick: () => void;
}

export function FlowTeamCard({
  id,
  name,
  shortCode,
  logoUrl,
  purseLabel,
  isHighlighted,
  isDimmed,
  onClick,
}: FlowTeamCardProps) {
  return (
    <div
      id={`team-${shortCode}`}
      onClick={onClick}
      className={[
        "glass-panel p-3 rounded-xl flex items-center gap-4 cursor-pointer transition-all duration-300",
        isHighlighted
          ? "ring-1 ring-theme-orange shadow-[0_0_15px_rgba(201,151,31,0.3)] bg-white/10"
          : "border border-white/5 hover:border-theme-orange",
        isDimmed ? "opacity-30" : "opacity-100",
      ].join(" ")}
    >
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container flex-shrink-0">
        {logoUrl && <img src={logoUrl} className="w-full h-full object-cover" alt="" />}
      </div>
      <div className="min-w-0">
        <p className="font-bold text-xs truncate uppercase tracking-tight font-archivo text-white">
          {name}
        </p>
        <p className="text-[10px] font-mono text-theme-orange mt-0.5 tracking-wider">
          {purseLabel}
        </p>
      </div>
    </div>
  );
}