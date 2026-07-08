"use client";

import { ChevronRight, ChevronDown, ChevronUp, Radio } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { GOLD_BEZEL, ambientGlow, teamBlockClip } from "@/lib/overlayTokens";
import CricketBall from "@/components/overlays/shared/CricketBall";
// NOTE: no `import type ... from "@/lib/overlayBus"` here — this file is
// plain .jsx, and `import type` is TS-only syntax. The shapes of
// `liveState` / `matchSetup` still come from overlayBus.ts at runtime,
// we just don't annotate them here. If you want compile-time type
// checking on this component, rename it to LiveScoreBar.tsx instead and
// re-add `import type { LiveState, MatchSetup, TeamInfo } from "@/lib/overlayBus";`

const ENTRANCE_MS = 900;
const EXIT_MS = 650;
const BALLS_PER_OVER = 6;

// Fallback team shape used before matchSetup has synced in, or if a slot
// is somehow missing — keeps TeamCrest/TeamBlock from crashing on
// undefined fields.
const FALLBACK_TEAM = {
  name: "Team",
  shortCode: "TBD",
  color: "#c9971f",
  logoUrl: "",
  squad: [],
};

const maxOversByFormat = { T20: 20, ODI: 50, Test: undefined };

// Softens a hex color into an rgba() glow — replaces the hardcoded
// `colorSoft` field the old local `LIVE` fixture used to carry. Team
// data now comes from MatchSetup, which only stores a single hex color,
// so we derive the soft/glow version here instead.
function softenColor(hex, alpha = 0.18) {
  const clean = (hex || "#c9971f").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Cricket-ball styled chip — unchanged from the original component,
// still driven purely by the string value passed in
// ("0".."6" | "." | "W" | "wd" | "nb"). Kept exactly as-is; no feature
// change needed here, this part was already correct.
function BallChip({ value, index = 0, isLatest = false }) {
  const isEmpty = value == null;
  const isWicket = value === "W";
  const isExtra = value === "wd" || value === "nb";
  const isBoundary = value === "4" || value === "6";
  const isDot = value === ".";

  const sphereFill = isWicket
    ? "radial-gradient(circle at 32% 26%, #f0a091 0%, #cf4a37 42%, #7c1d13 88%, #5c130c 100%)"
    : isBoundary
    ? "radial-gradient(circle at 32% 26%, #fff3d1 0%, #ffcf6b 30%, var(--color-theme-orange) 68%, #8a5c0d 100%)"
    : isExtra
    ? "radial-gradient(circle at 32% 26%, #f3f3f3 0%, #cfcfd2 45%, #8f8f95 85%, #6b6b70 100%)"
    : undefined; // falls back to CricketBall's default leather gradient

  const seamColor = isBoundary ? "rgba(58,37,4,0.55)" : "rgba(255,255,255,0.5)";
  const labelColor = isWicket ? "#fff" : isBoundary ? "#3a2504" : isExtra ? "#2b2b2e" : "rgba(255,255,255,0.6)";

  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0 rounded-full ball-chip"
      style={{
        width: 20,
        height: 20,
        animationDelay: isEmpty ? "0ms" : `${index * 70}ms`,
      }}
    >
      {/* Live pulse ring — only on the most recently bowled ball */}
      {isLatest && !isEmpty && (
        <span
          className="absolute -inset-[3px] rounded-full pointer-events-none ball-pulse"
          style={{ border: `1.5px solid ${isWicket ? "#e2685a" : isBoundary ? "var(--color-theme-orange)" : "rgba(255,255,255,0.55)"}` }}
        />
      )}

      {isEmpty ? (
        <span
          className="w-full h-full rounded-full"
          style={{ border: "1px dashed rgba(255,255,255,0.22)" }}
        />
      ) : (
        <CricketBall
          size={20}
          fill={sphereFill}
          seamColor={seamColor}
          seamWidth={0.9}
          className={isBoundary ? "ball-shine" : ""}
        >
          <span className="font-heading font-black uppercase" style={{ fontSize: 8.5, color: labelColor }}>
            {isDot ? "•" : value}
          </span>
        </CricketBall>
      )}
    </span>
  );
}

// Circular medallion crest. `team` now comes from MatchSetup.teamA/teamB
// (real logoUrl / shortCode fields) instead of the old local TEAM_A/
// TEAM_B fixture, so we render team.logoUrl with a shortCode fallback
// (initials-style badge) when no logo has been set yet.
function TeamCrest({ team, variant }) {
  return (
    <div className="relative w-9 h-9 sm:w-11 sm:h-11 shrink-0">
      <div className={`shine-ring shine-ring-${variant}`} />
      <div
        className="relative w-full h-full rounded-full p-[2px] shadow-lg"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(120,120,120,0.55) 45%, rgba(0,0,0,0.4) 100%)",
        }}
      >
        <div className="relative w-full h-full rounded-full overflow-hidden bg-black">
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center font-heading font-black text-white/80"
              style={{ fontSize: 12 }}
            >
              {team.shortCode || "?"}
            </div>
          )}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.04) 30%, transparent 55%)",
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

// One consistent team block: crest anchored to the bar's outer edge, name
// + opponent label toward the center. Uses team.shortCode (from
// MatchSetup) instead of the old fixture's team.short.
const SLANT_PX = 22;

function TeamBlock({ team, opponent, align, variant }) {
  const isRight = align === "right";
  const clipPath = teamBlockClip(SLANT_PX, align);

  return (
    <div
      className={`relative z-10 flex items-center gap-2.5 sm:gap-3 py-2.5 sm:py-3 shrink-0 ${
        isRight
          ? "flex-row-reverse pr-3 sm:pr-4 pl-7 sm:pl-9"
          : "pl-3 sm:pl-4 pr-7 sm:pr-9"
      }`}
      style={{
        background: `linear-gradient(${isRight ? "225deg" : "135deg"}, ${team.color} 0%, ${team.color}cc 100%)`,
        clipPath,
      }}
    >
      <TeamCrest team={team} variant={variant} />
      <div className={`leading-tight ${isRight ? "text-right" : "text-left"}`}>
        <p className="font-heading text-sm sm:text-lg font-black uppercase tracking-wide text-white">
          {team.shortCode}
        </p>
        <p className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wide text-white/65">
          v {opponent.shortCode}
        </p>
      </div>
    </div>
  );
}

/**
 * LiveScoreBar — CHANGED: now fully driven by `liveState` / `matchSetup`
 * props, which come straight off the overlayBus (matchSetup + liveState
 * events are already real-time-synced there via the existing Supabase
 * channel — no second channel needed). Falls back to safe placeholders
 * if either prop hasn't arrived yet, so the bar doesn't crash before the
 * first sync lands.
 *
 * `show`/`hideTrigger` behavior is unchanged from the original —
 * remote-controllable the same way PointsTable is, with the same
 * self-contained-vs-externally-driven `show` prop pattern.
 */
export default function LiveScoreBar({ show, hideTrigger = false, liveState, matchSetup }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(show ?? true);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const openBar = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setClosing(false);
    setOpen(true);
  }, []);

  const closeBar = useCallback(() => {
    setClosing((alreadyClosing) => {
      if (alreadyClosing) return true;
      closeTimer.current = setTimeout(() => {
        setOpen(false);
        setClosing(false);
      }, EXIT_MS);
      return true;
    });
  }, []);

  const toggle = useCallback(() => {
    if (open && !closing) closeBar();
    else if (!open) openBar();
  }, [open, closing, openBar, closeBar]);

  // External control — only takes effect when `show` is actually passed.
  useEffect(() => {
    if (show === undefined) return;
    if (show) openBar();
    else closeBar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // ── Derive display data from the synced liveState/matchSetup ───────
  // Same "who's batting right now" logic LiveStatePanel.tsx already
  // uses (toss winner/decision + current innings number), duplicated
  // here so the overlay can compute it independently of the admin page.
  const battingTeamKey = useMemo(() => {
    const firstInningsTeamIsA = (() => {
      if (matchSetup?.tossWinner && matchSetup.tossDecision) {
        const winnerBats = matchSetup.tossDecision === "bat";
        const winnerIsA = matchSetup.tossWinner === "A";
        return winnerBats ? winnerIsA : !winnerIsA;
      }
      return true;
    })();
    const firstInningsTeam = firstInningsTeamIsA ? "teamA" : "teamB";
    const isSecondInningsNow = (liveState?.inningsNumber ?? 1) === 2;
    if (!isSecondInningsNow) return firstInningsTeam;
    return firstInningsTeam === "teamA" ? "teamB" : "teamA";
  }, [matchSetup?.tossWinner, matchSetup?.tossDecision, liveState?.inningsNumber]);
  const bowlingTeamKey = battingTeamKey === "teamA" ? "teamB" : "teamA";

  const battingTeam = matchSetup?.[battingTeamKey] ?? FALLBACK_TEAM;
  const fieldingTeam = matchSetup?.[bowlingTeamKey] ?? FALLBACK_TEAM;
  const battingColorSoft = softenColor(battingTeam.color);
  const fieldingColorSoft = softenColor(fieldingTeam.color);

  const score = liveState?.score ?? { runs: 0, wickets: 0, overs: 0, balls: 0 };
  const striker = liveState?.striker ?? { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 };
  const nonStriker = liveState?.nonStriker ?? { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 };
  const bowler = liveState?.bowler ?? { name: "", overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 };

  const oversLimit = matchSetup?.format ? maxOversByFormat[matchSetup.format] : undefined;
  const oversLabel = `${score.overs}.${score.balls}`;
  const venue = matchSetup?.venue || "";
  const tournamentName = matchSetup?.tournamentName || "";
  const tournamentLogo = matchSetup?.tournamentLogoUrl || "";

  // Pad the current over out to a full 6 balls with hollow placeholders,
  // sourced from liveState.thisOver (synced via the bus) instead of the
  // old hardcoded LIVE.thisOver fixture.
  const overChips = useMemo(() => {
    const balls = liveState?.thisOver ?? [];
    return [...balls, ...Array(Math.max(0, BALLS_PER_OVER - balls.length)).fill(null)];
  }, [liveState?.thisOver]);
  const latestBallIndex = (liveState?.thisOver?.length ?? 0) - 1;

  return (
    <>
      {!hideTrigger && mounted && !open && !closing && (
        <button
          onClick={toggle}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[101] flex items-center gap-2 px-4 py-2 rounded-full shadow-xl"
          style={{
            background: "var(--color-surface-container-lowest)",
            border: "1px solid var(--color-border-overlay)",
            color: "var(--color-on-surface-variant)",
          }}
        >
          <Radio className="w-4 h-4" style={{ color: "var(--color-theme-orange)" }} />
          <span className="text-xs font-bold uppercase tracking-wider">Show Score</span>
          <ChevronUp className="w-4 h-4" />
        </button>
      )}

      {mounted &&
        open &&
        createPortal(
          <div
            className="fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center px-2 pb-3 sm:pb-5 pointer-events-none"
            aria-live="polite"
          >
            <div
              className="lsb-wrap origin-center pointer-events-auto relative"
              style={{
                width: "90vw",
                animation: closing
                  ? `lsbBarOut ${EXIT_MS}ms cubic-bezier(0.4,0,0.8,1) both`
                  : `lsbBarIn ${ENTRANCE_MS}ms cubic-bezier(0.22,1,0.36,1) both`,
              }}
            >
              {/* Logo badge — only render if a tournament logo has
                  actually been set in Match Setup; the old version
                  always rendered TOURNAMENT.logo from the hardcoded
                  fixture, which doesn't exist anymore. */}
              {tournamentLogo && (
                <div className="absolute left-1/2 top-0 z-20">
                  <div
                    className="lsb-log-badge [--badge-rest:56px] sm:[--badge-rest:76px] rounded-full overflow-hidden flex items-center justify-center"
                    style={{
                      padding: "12%",
                      background: "rgba(12,16,26,0.85)",
                      border: "1px solid rgba(201,151,31,0.5)",
                      boxShadow: "0 10px 24px -8px rgba(0,0,0,0.6)",
                      animation: closing
                        ? `lsbLogOut ${EXIT_MS}ms cubic-bezier(0.4,0,0.8,1) both`
                        : `lsbLogIn ${ENTRANCE_MS}ms cubic-bezier(0.22,1,0.36,1) both`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tournamentLogo}
                      alt={tournamentName}
                      className="w-full h-full object-contain"
                      style={{ filter: "grayscale(1) contrast(1.3) brightness(1.7)" }}
                    />
                  </div>
                </div>
              )}

              {/* Ambient glow — team-tinted, sourced from softenColor()
                  instead of the fixture's hardcoded colorSoft field. */}
              <div
                className="absolute -inset-4 sm:-inset-5 blur-2xl rounded-[28px] pointer-events-none"
                style={{
                  background: ambientGlow(
                    { ...battingTeam, colorSoft: battingColorSoft },
                    { ...fieldingTeam, colorSoft: fieldingColorSoft }
                  ),
                }}
              />

              {/* Metallic bezel — unchanged, still from shared overlayTokens */}
              <div
                className="relative p-[2px] sm:p-[3px] rounded-2xl sm:rounded-[22px]"
                style={{
                  background: GOLD_BEZEL,
                  boxShadow:
                    "0 25px 50px -12px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.5)",
                }}
              >
                <div
                  className="relative rounded-[15px] sm:rounded-[19px] overflow-hidden shadow-2xl"
                  style={{
                    background:
                      "linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-container-lowest) 100%)",
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at 6% 50%, ${battingColorSoft} 0%, transparent 40%), radial-gradient(circle at 98% 50%, ${fieldingColorSoft} 0%, transparent 32%)`,
                    }}
                  />

                  <div className="relative flex items-stretch">
                    <TeamBlock team={battingTeam} opponent={fieldingTeam} align="left" variant="blue" />

                    <div className="relative z-10 flex items-center px-2 sm:px-4 shrink-0">
                      <span
                        className="font-heading font-black text-xl sm:text-3xl tabular-nums leading-none"
                        style={{ color: "var(--color-on-surface)" }}
                      >
                        {score.runs}
                        <span style={{ color: "var(--color-outline)" }}>-{score.wickets}</span>
                      </span>
                    </div>

                    <div className="relative z-10 flex items-center pr-2 sm:pr-4 shrink-0">
                      <div
                        className="flex flex-col items-center justify-center rounded-lg px-2 sm:px-3 py-1 sm:py-1.5"
                        style={{
                          background: "linear-gradient(160deg, rgba(201,151,31,0.16) 0%, rgba(201,151,31,0.05) 100%)",
                          border: "1px solid rgba(201,151,31,0.35)",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                        }}
                      >
                        <span
                          className="text-[6px] sm:text-[7px] font-bold uppercase tracking-[0.18em]"
                          style={{ color: "var(--color-theme-orange)", opacity: 0.85 }}
                        >
                          Overs
                        </span>
                        <span
                          className="font-heading font-black text-[11px] sm:text-sm tabular-nums leading-none"
                          style={{ color: "var(--color-on-surface)" }}
                        >
                          {oversLabel}
                          {oversLimit !== undefined && (
                            <span
                              className="text-[9px] sm:text-[11px] font-semibold"
                              style={{ color: "var(--color-outline)" }}
                            >
                              /{oversLimit}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="relative z-10 w-px my-2.5 shrink-0" style={{ background: "var(--color-border-overlay)" }} />

                    <div className="relative z-10 flex-1 flex items-center justify-center sm:justify-between gap-2 sm:gap-3 px-2 sm:px-5 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" style={{ color: "var(--color-theme-orange)" }} />
                        <span
                          className="text-[11px] sm:text-base font-bold uppercase truncate"
                          style={{ color: "var(--color-on-surface)" }}
                        >
                          {striker.name}
                        </span>
                        <span
                          className="text-[11px] sm:text-base font-black tabular-nums shrink-0"
                          style={{ color: "var(--color-theme-orange)" }}
                        >
                          {striker.runs}
                          <span className="text-[9px] sm:text-sm font-semibold" style={{ color: "var(--color-outline)" }}>
                            ({striker.balls})
                          </span>
                        </span>
                      </div>

                      <div className="hidden sm:flex items-center gap-2.5 min-w-0">
                        <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--color-outline)" }} />
                        <span
                          className="text-base font-bold uppercase truncate"
                          style={{ color: "var(--color-on-surface-variant)" }}
                        >
                          {nonStriker.name}
                        </span>
                        <span
                          className="text-base font-black tabular-nums shrink-0"
                          style={{ color: "var(--color-on-surface)" }}
                        >
                          {nonStriker.runs}
                          <span className="text-sm font-semibold" style={{ color: "var(--color-outline)" }}>
                            ({nonStriker.balls})
                          </span>
                        </span>
                      </div>
                    </div>

                    {!hideTrigger && (
                      <button
                        onClick={toggle}
                        className="relative z-10 flex items-center justify-center px-2 sm:px-2.5 shrink-0 transition-colors"
                        style={{ color: "var(--color-outline)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-theme-orange)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-outline)")}
                        aria-label="Hide score bar"
                      >
                        <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    )}

                    <TeamBlock team={fieldingTeam} opponent={battingTeam} align="right" variant="green" />
                  </div>

                  <div className="relative">
                    <div
                      className="absolute -left-[9px] top-0 w-[18px] h-[18px] rounded-full -translate-y-1/2"
                      style={{ background: "rgba(8,8,10,0.94)", boxShadow: "inset -2px 0 4px rgba(0,0,0,0.5)" }}
                    />
                    <div
                      className="absolute -right-[9px] top-0 w-[18px] h-[18px] rounded-full -translate-y-1/2"
                      style={{ background: "rgba(8,8,10,0.94)", boxShadow: "inset 2px 0 4px rgba(0,0,0,0.5)" }}
                    />
                    <div
                      className="h-px w-full"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(90deg, var(--color-outline) 0 5px, transparent 5px 11px)",
                        opacity: 0.5,
                      }}
                    />
                  </div>

                  <div
                    className="relative flex items-center gap-2.5 sm:gap-5 px-3 sm:px-5 py-1.5 sm:py-2"
                    style={{ background: "var(--color-surface-container-lowest)" }}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <span
                        className="text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.18em]"
                        style={{ color: "var(--color-outline)" }}
                      >
                        This Over
                      </span>
                      <div className="flex items-center gap-1">
                        {overChips.map((b, i) => (
                          <BallChip key={i} value={b} index={i} isLatest={i === latestBallIndex} />
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 text-center hidden sm:block">
                      <span
                        className="text-[9px] font-bold tracking-[0.2em] uppercase truncate"
                        style={{ color: "var(--color-on-surface-variant)" }}
                      >
                        Live from <span className="font-bold" style={{ color: "var(--color-theme-orange)" }}>
                          {venue}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto sm:ml-0">
                      <span
                        className="text-[10px] sm:text-xs font-bold uppercase truncate"
                        style={{ color: "var(--color-on-surface)" }}
                      >
                        {bowler.name}
                      </span>
                      <span
                        className="text-[10px] sm:text-xs font-black tabular-nums shrink-0"
                        style={{ color: "var(--color-theme-orange)" }}
                      >
                        {bowler.wickets}-{bowler.runs}
                        <span className="text-[9px] sm:text-[11px] font-semibold" style={{ color: "var(--color-outline)" }}>
                          {" "}
                          ({bowler.overs}.{bowler.balls})
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Montserrat:wght@800;900&display=swap");

        .font-heading {
          font-family: "Montserrat", sans-serif;
        }

        .origin-center {
          transform-origin: center;
        }

        @keyframes lsbLogIn {
          0% { opacity: 0; width: 15vh; height: 15vh; transform: translate(-50%, -50%) translateY(40px); }
          32% { opacity: 1; width: 15vh; height: 15vh; transform: translate(-50%, -50%) translateY(40px); }
          100% { opacity: 1; width: var(--badge-rest, 64px); height: var(--badge-rest, 64px); transform: translate(-50%, -50%) translateY(0); }
        }
        @keyframes lsbLogOut {
          0% { opacity: 1; width: var(--badge-rest, 64px); height: var(--badge-rest, 64px); transform: translate(-50%, -50%) translateY(0); }
          55% { opacity: 1; width: 15vh; height: 15vh; transform: translate(-50%, -50%) translateY(40px); }
          100% { opacity: 0; width: 15vh; height: 15vh; transform: translate(-50%, -50%) translateY(40px); }
        }

        @keyframes lsbBarIn {
          0% { opacity: 0; transform: scaleX(0); }
          32% { opacity: 0; transform: scaleX(0); }
          100% { opacity: 1; transform: scaleX(1); }
        }
        @keyframes lsbBarOut {
          0% { opacity: 1; transform: scaleX(1); }
          55% { opacity: 1; transform: scaleX(0); }
          100% { opacity: 0; transform: scaleX(0); }
        }

        .shine-ring {
          position: absolute;
          inset: -5px;
          border-radius: 9999px;
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
          animation: lsbSpin 3.5s linear infinite;
        }
        .shine-ring-blue {
          background: conic-gradient(
            from 0deg,
            transparent 0%,
            transparent 78%,
            rgba(59, 139, 212, 0.9) 92%,
            #9ecbf0 98%,
            transparent 100%
          );
        }
        .shine-ring-green {
          background: conic-gradient(
            from 180deg,
            transparent 0%,
            transparent 78%,
            rgba(42, 157, 92, 0.9) 92%,
            #8fe0b0 98%,
            transparent 100%
          );
        }
        @keyframes lsbSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .ball-chip {
          animation: ballPopIn 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes ballPopIn {
          0% { opacity: 0; transform: scale(0.3) rotate(-25deg); }
          65% { opacity: 1; transform: scale(1.15) rotate(4deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        .ball-pulse {
          animation: ballPulse 1.6s ease-out infinite;
        }
        @keyframes ballPulse {
          0% { opacity: 0.9; transform: scale(0.85); }
          70% { opacity: 0; transform: scale(1.35); }
          100% { opacity: 0; transform: scale(1.35); }
        }
        .ball-shine::before {
          content: "";
          position: absolute;
          top: -60%;
          left: -60%;
          width: 60%;
          height: 220%;
          background: linear-gradient(
            100deg,
            transparent 0%,
            rgba(255, 255, 255, 0.75) 45%,
            transparent 90%
          );
          transform: rotate(20deg);
          animation: ballShineSweep 2.6s ease-in-out infinite;
        }
        @keyframes ballShineSweep {
          0% { left: -60%; }
          45% { left: 130%; }
          100% { left: 130%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ball-chip,
          .ball-pulse,
          .ball-shine::before {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
            animation-iteration-count: 1 !important;
          }
          .lsb-wrap,
          .lsb-log-badge {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
          .shine-ring {
            animation-duration: 1ms !important;
          }
        }
      `}</style>
    </>
  );
}