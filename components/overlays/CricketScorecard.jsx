"use client";

import { ListOrdered, Star } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ---- Hardcoded match data ----
// Same two fictional sides, same tournament, as the match-intro overlay,
// so the two cards read as one system rather than two different apps.
const TEAM_A = {
  name: "COASTAL SHARKS",
  short: "CS",
  image: "/Franchises/CSK.png",
  color: "#3B8BD4", // aplBlue
  colorSoft: "rgba(59,139,212,0.22)",
};

const TEAM_B = {
  name: "DESERT FALCONS",
  short: "DF",
  image: "/Franchises/RCB.png",
  color: "#2A9D5C", // aplGreen
  colorSoft: "rgba(42,157,92,0.2)",
};

const TOURNAMENT = {
  name: "MOON KNIGHT CUP",
  edition: "SEASON 7 · T20",
  logo: "/moon-knight-logo.png",
};

// Team A batted first; Team B's bowlers are what's shown opposite Team A's
// batting, and vice versa — same convention as a broadcast summary card.
// `top: true` marks the standout performance in each column (gold treatment).
const INNINGS_A = {
  label: "1st Innings",
  overs: "20.0",
  score: "162-4",
  batting: [
    { name: "L. HAVILAND", runs: 58, balls: 42, top: true },
    { name: "R. OKONKWO", runs: 34, balls: 28 },
    { name: "D. MARSH", runs: 29, balls: 20 },
    { name: "K. SANTOS", runs: 18, balls: 15 },
  ],
  bowling: [
    { name: "F. VANCE", figures: "2-28", overs: "4.0", top: true },
    { name: "M. QUINLAN", figures: "1-31", overs: "4.0" },
    { name: "A. DUBOIS", figures: "1-24", overs: "4.0" },
    { name: "S. REYES", figures: "0-35", overs: "4.0" },
  ],
};

const INNINGS_B = {
  label: "2nd Innings",
  overs: "19.2",
  score: "163-5",
  batting: [
    { name: "F. VANCE", runs: 61, balls: 39, top: true },
    { name: "A. DUBOIS", runs: 45, balls: 30 },
    { name: "M. QUINLAN", runs: 22, balls: 18 },
    { name: "S. REYES", runs: 14, balls: 9 },
  ],
  bowling: [
    { name: "L. HAVILAND", figures: "2-30", overs: "4.0", top: true },
    { name: "D. MARSH", figures: "1-38", overs: "3.2" },
    { name: "R. OKONKWO", figures: "1-27", overs: "4.0" },
    { name: "K. SANTOS", figures: "0-40", overs: "4.0" },
  ],
};

const RESULT_LINE = "DESERT FALCONS WON BY 5 WICKETS";

const EXIT_DURATION_MS = 400;

// Cut-corner "plaque" outline — replaces a plain rounded rectangle with a
// shape that reads as a struck medallion/badge (angled corners instead of
// a uniform border-radius). Used on both the metallic bezel and the
// content layer so the bezel stays visible as a consistent ring all the
// way around.
const PLAQUE_CLIP =
  "polygon(30px 0, calc(100% - 30px) 0, 100% 30px, 100% calc(100% - 30px), calc(100% - 30px) 100%, 30px 100%, 0 calc(100% - 30px), 0 30px)";
const PLAQUE_CLIP_INNER =
  "polygon(27px 0, calc(100% - 27px) 0, 100% 27px, 100% calc(100% - 27px), calc(100% - 27px) 100%, 27px 100%, 0 calc(100% - 27px), 0 27px)";

function StatRow({ label, value1, value2, top, ringColor }) {
  return (
    <div
      className="relative flex items-center justify-between gap-2 px-3 sm:px-4 py-[7px] sm:py-2"
      style={{
        background: top ? "rgba(201,151,31,0.1)" : "transparent",
        borderLeft: top ? `2px solid ${ringColor}` : "2px solid transparent",
      }}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        {top && (
          <Star
            className="w-3 h-3 shrink-0"
            style={{ color: "var(--color-theme-orange)" }}
            fill="var(--color-theme-orange)"
            strokeWidth={0}
          />
        )}
        <span
          className="text-[10.5px] sm:text-sm font-bold uppercase tracking-tight truncate"
          style={{ color: top ? "var(--color-on-surface)" : "var(--color-on-surface-variant)" }}
        >
          {label}
        </span>
      </span>
      <span className="flex items-baseline gap-2.5 sm:gap-3 shrink-0 tabular-nums">
        <span
          className="text-[10.5px] sm:text-sm font-black"
          style={{ color: top ? "var(--color-theme-orange)" : "var(--color-on-surface)" }}
        >
          {value1}
        </span>
        <span
          className="text-[9px] sm:text-xs font-semibold w-6 sm:w-7 text-right"
          style={{ color: "var(--color-outline)" }}
        >
          {value2}
        </span>
      </span>
    </div>
  );
}

function TeamInnings({ team, innings, closing, delay }) {
  return (
    <div
      className="relative z-10 msc-block h-full flex flex-col"
      style={{
        animation: closing
          ? "mscBlockOut 0.2s ease-in both"
          : `mscBlockIn 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
      }}
    >
      {/* Localized team-color glow behind the block */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 90% 100% at 50% 0%, ${team.colorSoft} 0%, transparent 60%)`,
        }}
      />

      {/* Eyebrow — innings label flanked by hairlines, same device as the intro header */}
      <div className="relative z-10 flex items-center gap-3 px-5 sm:px-6 lg:px-6 pt-5 pb-3">
        <span
          className="text-[9px] font-bold tracking-[0.3em] uppercase shrink-0"
          style={{ color: "var(--color-theme-orange)" }}
        >
          {innings.label}
        </span>
        <div
          className="h-px flex-1"
          style={{ background: "linear-gradient(90deg, rgba(201,151,31,0.45), transparent)" }}
        />
      </div>

      {/* Team identity + hero score */}
      <div className="relative z-10 flex items-center justify-between gap-4 px-5 sm:px-6 lg:px-6 pb-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="relative shrink-0">
            <div
              className="absolute -inset-2.5 rounded-full blur-lg"
              style={{ background: team.colorSoft }}
            />
            <div className={`shine-ring ${team === TEAM_A ? "shine-ring-blue" : "shine-ring-green"}`} />
            <div
              className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full p-[2.5px] shadow-xl"
              style={{
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
          <span
            className="font-heading font-black text-sm sm:text-lg lg:text-xl uppercase tracking-wide leading-tight truncate"
            style={{ color: "var(--color-on-surface)" }}
          >
            {team.name}
          </span>
        </div>

        <div className="text-right shrink-0">
          <div
            className="font-heading font-black text-2xl sm:text-3xl lg:text-4xl tabular-nums leading-none"
            style={{ color: "var(--color-theme-orange)" }}
          >
            {innings.score}
          </div>
          <div
            className="text-[9px] sm:text-[11px] font-bold tracking-[0.2em] uppercase mt-1"
            style={{ color: "var(--color-outline)" }}
          >
            {innings.overs} overs
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="relative z-10 grid grid-cols-2 gap-px px-5 sm:px-6 lg:px-6 pb-1">
        <div className="flex items-center justify-between pr-2">
          <span
            className="text-[8.5px] sm:text-[10px] font-bold tracking-[0.2em] uppercase"
            style={{ color: "var(--color-outline)" }}
          >
            Batting
          </span>
          <span
            className="flex gap-3 sm:gap-4 text-[8.5px] sm:text-[10px] font-bold tracking-[0.15em] uppercase"
            style={{ color: "var(--color-outline)" }}
          >
            <span>R</span>
            <span className="w-6 sm:w-7 text-right">B</span>
          </span>
        </div>
        <div
          className="flex items-center justify-between pl-4 sm:pl-5"
          style={{ borderLeft: "1px solid var(--color-border-overlay)" }}
        >
          <span
            className="text-[8.5px] sm:text-[10px] font-bold tracking-[0.2em] uppercase"
            style={{ color: "var(--color-outline)" }}
          >
            Bowling
          </span>
          <span
            className="flex gap-3 sm:gap-4 text-[8.5px] sm:text-[10px] font-bold tracking-[0.15em] uppercase"
            style={{ color: "var(--color-outline)" }}
          >
            <span>W-R</span>
            <span className="w-7 sm:w-8 text-right">O</span>
          </span>
        </div>
      </div>

      {/* Stat rows */}
      <div className="relative z-10 grid grid-cols-2 px-3 sm:px-4 lg:px-4 pb-5 flex-1">
        <div>
          {innings.batting.map((p) => (
            <StatRow
              key={p.name}
              label={p.name}
              value1={p.runs}
              value2={p.balls}
              top={p.top}
              ringColor={team.color}
            />
          ))}
        </div>
        <div style={{ borderLeft: "1px solid var(--color-border-overlay)" }}>
          {innings.bowling.map((p) => (
            <StatRow
              key={p.name}
              label={p.name}
              value1={p.figures}
              value2={p.overs}
              top={p.top}
              ringColor={team.color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CricketScorecard() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const openPanel = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setClosing(false);
    setOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setClosing((alreadyClosing) => {
      if (alreadyClosing) return true;
      closeTimer.current = setTimeout(() => {
        setOpen(false);
        setClosing(false);
      }, EXIT_DURATION_MS);
      return true;
    });
  }, []);

  const toggle = useCallback(() => {
    if (open && !closing) closePanel();
    else if (!open) openPanel();
  }, [open, closing, openPanel, closePanel]);

  useEffect(() => {
    if (!open || closing) return;
    const onKey = (e) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closing, closePanel]);

  return (
    <>
      <button
        onClick={toggle}
        className="relative flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        style={{ color: "var(--color-on-surface-variant)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-theme-orange)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-on-surface-variant)")}
      >
        <ListOrdered className="w-5 h-5" />
        <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">
          Scorecard
        </span>
      </button>

      {mounted &&
        open &&
        createPortal(
          <>
            <div
              className="fixed inset-0 backdrop-blur-sm z-[100]"
              style={{
                background: "rgba(0,0,0,0.8)",
                animation: closing
                  ? "mscFadeOut 0.32s ease-in 0.09s both"
                  : "mscFadeIn 0.3s ease-out both",
              }}
              onClick={closePanel}
            />

            {/* Panel container — wider max-width on large screens so the two
                innings can sit side by side (landscape) instead of stacked
                (portrait). p-4/p-6 keeps breathing room from the viewport
                edge so nothing touches the browser chrome. */}
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
              <div
                className="pointer-events-auto w-full max-w-2xl lg:max-w-5xl relative"
                style={{
                  animation: closing
                    ? "mscCardExit 0.32s cubic-bezier(0.4,0,1,1) 0.06s both"
                    : "mscCardEnter 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.03s both",
                }}
              >
                {/* Ambient glow — same gold-led treatment as the intro card */}
                <div
                  className="absolute -inset-6 blur-3xl rounded-[40px]"
                  style={{
                    background: `linear-gradient(90deg, ${TEAM_A.colorSoft}, rgba(201,151,31,0.16), ${TEAM_B.colorSoft})`,
                  }}
                />

                {/* Metallic bezel — brushed-steel gradient with a gold mid-tone,
                    clipped to a cut-corner plaque outline instead of a plain
                    rounded rectangle, so the whole card reads as a struck
                    medallion or engraved plate rather than a flat UI panel. */}
                <div
                  className="relative p-[3px] sm:p-[4px]"
                  style={{
                    background:
                      "linear-gradient(135deg, #f1efe9 0%, #b8ad93 14%, #6b6455 28%, #c9971f 42%, #4a453a 56%, #b8ad93 72%, #f1efe9 86%, #8a8272 100%)",
                    boxShadow:
                      "0 25px 50px -12px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.5)",
                    clipPath: PLAQUE_CLIP,
                    WebkitClipPath: PLAQUE_CLIP,
                  }}
                >
                  {/* Content layer — capped to the viewport height and scrollable
                      internally so the table can never be clipped; clip-path
                      matches the bezel, inset by the bezel's own thickness. */}
                  <div
                    className="relative overflow-x-hidden overflow-y-auto"
                    style={{
                      background:
                        "linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-container-lowest) 100%)",
                      maxHeight: "calc(100vh - 3rem)",
                      clipPath: PLAQUE_CLIP_INNER,
                      WebkitClipPath: PLAQUE_CLIP_INNER,
                    }}
                  >
                    {/* Tournament emblem watermark — raised opacity and a
                        lighten-style blend so the crest reads as background
                        texture instead of disappearing into the dark surface. */}
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                      aria-hidden="true"
                      style={{ opacity: 0.16, mixBlendMode: "screen" }}
                    >
                      <img
                        src={TOURNAMENT.logo}
                        alt=""
                        className="w-2/3 h-2/3 object-contain"
                        style={{ filter: "grayscale(1) contrast(1.4) brightness(2)" }}
                      />
                    </div>

                    {/* Header — tournament identity, same crest-banner device as the intro */}
                    <div
                      className="relative z-10 flex items-center justify-center gap-4 pt-7 pb-4 px-8 sm:px-12"
                      style={{
                        borderBottom: "1px solid var(--color-border-overlay)",
                        animation: closing
                          ? "mscHeaderOut 0.2s ease-in 0.12s both"
                          : "mscHeaderIn 0.45s cubic-bezier(0.22,1,0.36,1) 0.15s both",
                      }}
                    >
                      <div
                        className="hidden sm:block h-px flex-1"
                        style={{ background: "linear-gradient(90deg, transparent, rgba(201,151,31,0.5))" }}
                      />
                      <div className="leading-tight text-center shrink-0">
                        <p
                          className="font-heading font-black text-sm sm:text-lg tracking-wide"
                          style={{ color: "var(--color-on-surface)" }}
                        >
                          Match Summary
                        </p>
                        <p
                          className="text-[9px] font-bold tracking-[0.3em] uppercase"
                          style={{ color: "var(--color-theme-orange)" }}
                        >
                          {TOURNAMENT.name}
                        </p>
                      </div>
                      <div
                        className="hidden sm:block h-px flex-1"
                        style={{ background: "linear-gradient(90deg, rgba(201,151,31,0.5), transparent)" }}
                      />
                    </div>

                    {/* Innings blocks — stacked (portrait) on mobile/tablet,
                        side by side (landscape) from lg up. The divider swaps
                        from a horizontal hairline to a vertical one so it
                        always sits between the two blocks correctly. */}
                    <div className="flex flex-col lg:flex-row lg:items-stretch">
                      <div className="lg:w-1/2 lg:flex lg:flex-col">
                        <TeamInnings team={TEAM_A} innings={INNINGS_A} closing={closing} delay={0.26} />
                      </div>

                      {/* Horizontal divider — mobile/tablet only */}
                      <div
                        className="relative z-10 mx-5 sm:mx-8 h-px lg:hidden"
                        style={{
                          background:
                            "linear-gradient(90deg, transparent, rgba(201,151,31,0.4), transparent)",
                        }}
                      />
                      {/* Vertical divider — desktop landscape layout only */}
                      <div
                        className="relative z-10 hidden lg:block w-px my-6"
                        style={{
                          background:
                            "linear-gradient(180deg, transparent, rgba(201,151,31,0.55), transparent)",
                        }}
                      />

                      <div className="lg:w-1/2 lg:flex lg:flex-col">
                        <TeamInnings team={TEAM_B} innings={INNINGS_B} closing={closing} delay={0.38} />
                      </div>
                    </div>

                    {/* Footer — just the win message, centered. The tear-line
                        notches stay as the one physical "ticket" detail; the
                        stamp/barcode compartment is gone entirely. */}
                    <div
                      className="glass-panel relative z-10 flex items-center justify-center px-8 py-6 text-center"
                      style={{
                        borderLeft: "none",
                        borderRight: "none",
                        borderBottom: "none",
                        animation: closing
                          ? "mscFooterOut 0.2s ease-in both"
                          : "mscFooterIn 0.45s cubic-bezier(0.22,1,0.36,1) 0.52s both",
                      }}
                    >
                      <div
                        className="absolute -left-[9px] top-0 w-[18px] h-[18px] rounded-full -translate-y-1/2"
                        style={{ background: "rgba(8,8,10,0.94)", boxShadow: "inset -2px 0 4px rgba(0,0,0,0.5)" }}
                      />
                      <div
                        className="absolute -right-[9px] top-0 w-[18px] h-[18px] rounded-full -translate-y-1/2"
                        style={{ background: "rgba(8,8,10,0.94)", boxShadow: "inset 2px 0 4px rgba(0,0,0,0.5)" }}
                      />
                      <div
                        className="absolute left-3 right-3 top-0 h-px -translate-y-1/2"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(90deg, var(--color-outline) 0 5px, transparent 5px 11px)",
                          opacity: 0.5,
                        }}
                      />

                      <p
                        className="font-heading text-base sm:text-xl font-black uppercase tracking-tight"
                        style={{ color: "var(--color-theme-orange)" }}
                      >
                        {RESULT_LINE}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Montserrat:wght@800;900&display=swap");

        .font-heading {
          font-family: "Montserrat", sans-serif;
        }

        @keyframes mscFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes mscFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        @keyframes mscCardEnter {
          from { opacity: 0; transform: scale(0.86) translateY(-26px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes mscCardExit {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.92) translateY(12px); }
        }

        @keyframes mscHeaderIn {
          from { opacity: 0; transform: translateY(-16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mscHeaderOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-10px); }
        }

        @keyframes mscBlockIn {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mscBlockOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(14px); }
        }

        @keyframes mscFooterIn {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mscFooterOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(20px); }
        }

        /* Shine ring — rotating conic-gradient arc masked to a thin ring,
           same device used around the team badges on the intro card. */
        .shine-ring {
          position: absolute;
          inset: -5px;
          border-radius: 9999px;
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
          animation: mscSpin 3.5s linear infinite;
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
        @keyframes mscSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>
    </>
  );
}