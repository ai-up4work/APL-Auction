"use client";

/**
 * TeamBadge — the circular team medallion: spinning shine-ring, optional
 * soft color glow behind it, a brushed-metal gradient frame, the team
 * photo on a black backing, a top-lit gloss highlight, and an inner
 * shadow for depth.
 *
 * This exact five-layer stack appeared three times with only the size and
 * frame thickness changed:
 *   - LiveScoreBar's TeamCrest        → w-9 h-9 sm:w-11 sm:h-11, p-[2px]
 *   - CricketScorecard's TeamInnings  → w-14 h-14 sm:w-16 sm:h-16, p-[2.5px]
 *   - CricketMatchIntro's VS section  → w-36 h-36 sm:w-48 sm:h-48, p-[3px]
 *
 * Sizing is passed as Tailwind class strings (not a single px number) so
 * every caller keeps its own responsive sm: breakpoint exactly as before.
 *
 * `variant` picks the shine-ring color (blue for the "left"/A side, green
 * for the "right"/B side) instead of inferring it by comparing against a
 * module-level TEAM_A constant, so this component has no hidden coupling
 * to which two teams are actually in the match.
 */
export default function TeamBadge({
  team,
  variant = "blue", // "blue" | "green"
  sizeClass = "w-11 h-11", // Tailwind w-*/h-* classes, include sm: as needed
  framePadding = "2px", // CSS padding value for the metal frame thickness
  glowInset = "-inset-2.5", // Tailwind inset-* class for the soft glow blur
  glow = true,
  className = "",
}) {
  return (
    <div className={`relative shrink-0 ${sizeClass} ${className}`}>
      {glow && <div className={`absolute ${glowInset} rounded-full blur-lg`} style={{ background: team.colorSoft }} />}

      <div className={`shine-ring ${variant === "blue" ? "shine-ring-blue" : "shine-ring-green"}`} />

      <div
        className="relative w-full h-full rounded-full shadow-xl"
        style={{
          padding: framePadding,
          background:
            "linear-gradient(145deg, var(--color-surface-container-high) 0%, var(--color-outline) 45%, var(--color-surface-container-lowest) 100%)",
        }}
      >
        <div className="relative w-full h-full rounded-full overflow-hidden bg-black">
          <img src={team.image} alt={team.name} className="w-full h-full object-cover" />
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 30%, transparent 55%)",
            }}
          />
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ boxShadow: "inset 0 -5px 9px rgba(0,0,0,0.45)" }}
          />
        </div>
      </div>
    </div>
  );
}