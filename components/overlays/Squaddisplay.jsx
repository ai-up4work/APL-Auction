// components/overlays/SquadDisplay.jsx
"use client";

import { useState } from "react";
import Image from "next/image";

// RECONSTRUCTED FILE — built purely from the screenshot you shared (no
// original SquadDisplay code was provided), matched to this codebase's
// existing overlay conventions (dark surface, gold/accent-line header
// treatment) but keeping the screenshot's own red-card squad-grid look
// intact rather than restyling it to match BowlingFiguresPanel etc.
//
// KEY CHANGE vs the screenshot: every tile there falls back to the same
// generic swoosh badge because no photo was wired in yet. This version
// renders each player's actual photo when `imageUrl` is provided, and
// only falls back to the badge if the image is missing OR fails to load
// (via onError) — so a broken/renamed file never shows a blank tile.
//
// Usage:
//   <SquadDisplay
//     team={{ name: "GRG", logoUrl: "/Franchises/GRG.png" }}
//     squad={[
//       { jersey: 1, name: "Surbhi", imageUrl: "/players/surbhi.jpg" },
//       { jersey: 2, name: "Dropati", imageUrl: "/players/dropati.jpg" },
//       ...
//     ]}
//   />
//
// If a player has no imageUrl (or the file 404s), the tile shows the
// team's own crest badge in place of a photo — same fallback badge
// style as the screenshot, not a broken-image icon.

const ACCENT = "#3B8BD4"; // the blue gradient underline in the screenshot — swap per-brand via `accentColor` prop

export default function SquadDisplay({
  team, // { name, logoUrl }
  squad = [], // [{ jersey, name, imageUrl }]
  accentColor = ACCENT,
  title = "SQUAD",
  brandLabel, // e.g. "CRICKPRO" — top-left wordmark, optional
}) {
  return (
    <div
      className="relative w-full h-full flex flex-col items-center px-10 py-8"
      style={{ background: "linear-gradient(180deg, #0d1420 0%, #060a12 100%)" }}
    >
      {brandLabel && (
        <div
          className="absolute top-6 left-8 text-[13px] font-black uppercase tracking-[0.16em]"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          {brandLabel}
        </div>
      )}

      {/* Header: gradient rule, crest, team name, SQUAD label */}
      <div className="flex flex-col items-center gap-3 mt-2 mb-8">
        <div
          className="h-[3px] w-[220px] rounded-full"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${accentColor} 50%, transparent 100%)` }}
        />
        <div className="flex items-center gap-2.5 mt-1">
          <TeamCrest team={team} size={30} />
          <span className="text-[20px] font-black tracking-wide text-white">{team?.name}</span>
        </div>
        <span
          className="text-[12px] font-bold uppercase tracking-[0.35em]"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          {title}
        </span>
      </div>

      {/* Squad grid — 6 columns, wraps to as many rows as needed */}
      <div className="grid grid-cols-6 gap-4">
        {squad.map((player) => (
          <PlayerTile key={player.jersey ?? player.name} player={player} team={team} />
        ))}
      </div>
    </div>
  );
}

function PlayerTile({ player, team }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = !!player.imageUrl && !imgFailed;

  return (
    <div className="w-[104px] flex flex-col items-center">
      <div
        className="relative w-[104px] h-[104px] rounded-[10px] overflow-hidden"
        style={{
          background: "linear-gradient(155deg, #c23b3b 0%, #7a1f1f 60%, #5c1414 100%)",
          boxShadow: "0 8px 18px -6px rgba(0,0,0,0.6)",
        }}
      >
        {/* Jersey number badge, top-left */}
        <span
          className="absolute top-1.5 left-1.5 z-10 text-[10px] font-black text-white/90"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
        >
          {player.jersey}
        </span>

        {showPhoto ? (
          <Image
            src={player.imageUrl}
            alt={player.name}
            fill
            className="object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <TeamCrest team={team} size={48} muted />
          </div>
        )}

        {/* Name plate */}
        <div
          className="absolute bottom-0 left-0 right-0 px-1.5 py-1.5 text-center"
          style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.55) 0%, transparent 100%)" }}
        >
          <span
            className="text-[9px] font-black uppercase tracking-wide text-white leading-tight block truncate"
            title={player.name}
          >
            {player.name}
          </span>
        </div>
      </div>
    </div>
  );
}

function TeamCrest({ team, size = 32, muted = false }) {
  if (team?.logoUrl) {
    return (
      <div className="relative shrink-0" style={{ width: size, height: size, opacity: muted ? 0.55 : 1 }}>
        <Image src={team.logoUrl} alt={team.name || "Team"} fill className="object-contain" />
      </div>
    );
  }
  // Generic swoosh fallback badge, same idea as the screenshot's default
  // icon — used both as the header crest fallback and as the per-tile
  // fallback when a player has no photo.
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.15)",
        opacity: muted ? 0.55 : 1,
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 12c2-4 6-6 10-6s6 2 6 6-2 6-6 6-8-2-10-6z"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}