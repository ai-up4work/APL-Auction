"use client";

import { Award, Star } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ---- Same fictional tournament as the intro / scorecard / live-bar cards ----
const TOURNAMENT = {
  name: "MOON KNIGHT CUP",
  edition: "SEASON 7 · WOMEN'S T20",
  logo: "/moon-knight-logo.png",
};

// Eight -> ten real IPL-style franchises, pointing at the actual crest
// artwork already sitting in /public/Franchises. Colors are each side's
// well-known brand color, not derived from the image.
const TEAMS = [
  { rank: 1, short: "CSK", name: "CHENNAI SUPER KINGS", image: "/Franchises/CSK.png", color: "#FDB913", colorSoft: "rgba(253,185,19,0.22)", p: 7, w: 6, l: 1, t: 0, nr: 0, pts: 12, nrr: 1.512 },
  { rank: 2, short: "GT", name: "GUJARAT TITANS", image: "/Franchises/GT.png", color: "#1C1C84", colorSoft: "rgba(28,28,132,0.24)", p: 7, w: 5, l: 2, t: 0, nr: 0, pts: 10, nrr: 0.876 },
  { rank: 3, short: "MI", name: "MUMBAI INDIANS", image: "/Franchises/MI.png", color: "#004BA0", colorSoft: "rgba(0,75,160,0.22)", p: 7, w: 5, l: 2, t: 0, nr: 0, pts: 10, nrr: 0.421 },
  { rank: 4, short: "RCB", name: "ROYAL CHALLENGERS BENGALURU", image: "/Franchises/RCB.png", color: "#DA1818", colorSoft: "rgba(218,24,24,0.2)", p: 7, w: 4, l: 3, t: 0, nr: 0, pts: 8, nrr: 0.156 },
  { rank: 5, short: "KKR", name: "KOLKATA KNIGHT RIDERS", image: "/Franchises/KKR.jpg", color: "#3A225D", colorSoft: "rgba(58,34,93,0.24)", p: 7, w: 4, l: 3, t: 0, nr: 0, pts: 8, nrr: -0.042 },
  { rank: 6, short: "SRH", name: "SUNRISERS HYDERABAD", image: "/Franchises/SRH.webp", color: "#F26522", colorSoft: "rgba(242,101,34,0.22)", p: 7, w: 3, l: 4, t: 0, nr: 0, pts: 6, nrr: -0.183 },
  { rank: 7, short: "RR", name: "RAJASTHAN ROYALS", image: "/Franchises/RR.png", color: "#EA1E63", colorSoft: "rgba(234,30,99,0.2)", p: 7, w: 3, l: 4, t: 0, nr: 0, pts: 6, nrr: -0.298 },
  { rank: 8, short: "DC", name: "DELHI CAPITALS", image: "/Franchises/DLC.jpg", color: "#17479E", colorSoft: "rgba(23,71,158,0.22)", p: 7, w: 3, l: 4, t: 0, nr: 0, pts: 6, nrr: -0.415 },
];

const QUALIFY_CUTOFF = 4; // top N advance — draws the cut line under this rank
const RESULT_LINE = "TOP 4 ADVANCE TO THE SEMI-FINALS";

const EXIT_DURATION_MS = 400;

// Same cut-corner "plaque" clip used on the scorecard — reads as a struck
// medallion/plate rather than a plain rounded rectangle.
const PLAQUE_CLIP =
  "polygon(30px 0, calc(100% - 30px) 0, 100% 30px, 100% calc(100% - 30px), calc(100% - 30px) 100%, 30px 100%, 0 calc(100% - 30px), 0 30px)";
const PLAQUE_CLIP_INNER =
  "polygon(27px 0, calc(100% - 27px) 0, 100% 27px, 100% calc(100% - 27px), calc(100% - 27px) 100%, 27px 100%, 0 calc(100% - 27px), 0 27px)";

function formatNrr(value) {
  if (value === 0) return "0.000";
  const fixed = Math.abs(value).toFixed(3);
  return value > 0 ? `+${fixed}` : `-${fixed}`;
}

// Circular medallion crest — same shine-ring / gloss / inset-shadow
// treatment as the team badges on the other cards, now showing the real
// franchise crest artwork on a team-colored backdrop (object-contain, not
// object-cover, since these are badge/logo art rather than square photos
// and shouldn't get cropped).
function TeamCrest({ team }) {
  return (
    <div className="relative w-6 h-6 sm:w-8 sm:h-8 shrink-0">
      <div
        className="absolute -inset-[5px] rounded-full shine-ring"
        style={{
          background: `conic-gradient(from 0deg, transparent 0%, transparent 78%, ${team.color}e6 92%, #ffffff 98%, transparent 100%)`,
        }}
      />
      <div
        className="relative w-full h-full rounded-full p-[2px] shadow-lg"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(120,120,120,0.5) 45%, rgba(0,0,0,0.4) 100%)",
        }}
      >
        <div
          className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center p-[2px]"
          style={{ background: team.color }}
        >
          <img src={team.image} alt={team.name} className="w-full h-full object-contain" />
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 30%, transparent 55%)",
            }}
          />
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ boxShadow: "inset 0 -4px 7px rgba(0,0,0,0.45)" }}
          />
        </div>
      </div>
    </div>
  );
}

// Column grid shared by the header row and every data row in a column, so
// the two stay pixel-aligned. Narrower than a single full-width layout
// since each column only spans half the card in the landscape split below.
const ROW_GRID =
  "grid-cols-[1.35rem_1fr_repeat(6,1.5rem)_2.9rem] sm:grid-cols-[1.6rem_1fr_repeat(6,1.7rem)_3.2rem]";

function ColumnHeader() {
  return (
    <div className={`relative z-10 grid ${ROW_GRID} items-center gap-1 sm:gap-1.5 px-3 sm:px-5 pb-1.5`}>
      <span className="text-[7px] sm:text-[8.5px] font-bold tracking-[0.15em]" style={{ color: "var(--color-outline, #7a8194)" }}>#</span>
      <span className="text-[7px] sm:text-[8.5px] font-bold tracking-[0.15em]" style={{ color: "var(--color-outline, #7a8194)" }}>TEAM</span>
      {["P", "W", "L", "T", "NR", "PTS"].map((h) => (
        <span key={h} className="text-center text-[7px] sm:text-[8.5px] font-bold tracking-[0.15em]" style={{ color: "var(--color-outline, #7a8194)" }}>
          {h}
        </span>
      ))}
      <span className="text-right text-[7px] sm:text-[8.5px] font-bold tracking-[0.15em]" style={{ color: "var(--color-outline, #7a8194)" }}>NRR</span>
    </div>
  );
}

function TeamRow({ team, closing, delay }) {
  const isLeader = team.rank === 1;
  const nrrColor =
    team.nrr > 0 ? "#4fbf7a" : team.nrr < 0 ? "#e2685a" : "var(--color-outline, #7a8194)";

  return (
    <div
      className={`relative z-10 grid ${ROW_GRID} items-center gap-1 sm:gap-1.5 px-3 sm:px-5 py-1.5 sm:py-2 ptr-row`}
      style={{
        background: isLeader ? "rgba(201,151,31,0.1)" : "transparent",
        borderLeft: isLeader ? "2px solid var(--color-theme-orange, #C9971F)" : "2px solid transparent",
        animation: closing
          ? "ptRowOut 0.18s ease-in both"
          : `ptRowIn 0.4s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
      }}
    >
      <span
        className="flex items-center gap-0.5 font-heading font-black text-[10px] sm:text-[13px] tabular-nums"
        style={{ color: isLeader ? "var(--color-theme-orange, #C9971F)" : "var(--color-on-surface-variant, #b8bdc9)" }}
      >
        {isLeader && (
          <Star className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0" fill="var(--color-theme-orange, #C9971F)" strokeWidth={0} />
        )}
        {team.rank}
      </span>

      <span className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <TeamCrest team={team} />
        <span
          className="font-heading font-extrabold text-[9px] sm:text-[12.5px] uppercase tracking-tight truncate"
          style={{ color: "var(--color-on-surface, #eef0f4)" }}
        >
          {team.name}
        </span>
      </span>

      <span className="text-center text-[9px] sm:text-[12.5px] tabular-nums" style={{ color: "var(--color-on-surface-variant, #b8bdc9)" }}>{team.p}</span>
      <span className="text-center text-[9px] sm:text-[12.5px] tabular-nums" style={{ color: "var(--color-on-surface-variant, #b8bdc9)" }}>{team.w}</span>
      <span className="text-center text-[9px] sm:text-[12.5px] tabular-nums" style={{ color: "var(--color-on-surface-variant, #b8bdc9)" }}>{team.l}</span>
      <span className="text-center text-[9px] sm:text-[12.5px] tabular-nums" style={{ color: "var(--color-on-surface-variant, #b8bdc9)" }}>{team.t}</span>
      <span className="text-center text-[9px] sm:text-[12.5px] tabular-nums" style={{ color: "var(--color-on-surface-variant, #b8bdc9)" }}>{team.nr}</span>
      <span
        className="text-center font-heading font-black text-[10px] sm:text-sm tabular-nums"
        style={{ color: isLeader ? "var(--color-theme-orange, #C9971F)" : "var(--color-on-surface, #eef0f4)" }}
      >
        {team.pts}
      </span>
      <span className="text-right font-bold text-[9px] sm:text-[12px] tabular-nums" style={{ color: nrrColor }}>
        {formatNrr(team.nrr)}
      </span>
    </div>
  );
}

export default function PointsTable() {
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

  const before = TEAMS.filter((t) => t.rank <= QUALIFY_CUTOFF);
  const after = TEAMS.filter((t) => t.rank > QUALIFY_CUTOFF);

  return (
    <>
      <button
        onClick={toggle}
        className="relative flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        style={{ color: "var(--color-on-surface-variant, #b8bdc9)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-theme-orange, #C9971F)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-on-surface-variant, #b8bdc9)")}
      >
        <Award className="w-5 h-5" />
        <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Standings</span>
      </button>

      {mounted &&
        open &&
        createPortal(
          <>
            <div
              className="fixed inset-0 backdrop-blur-sm z-[100]"
              style={{
                background: "rgba(0,0,0,0.8)",
                animation: closing ? "ptFadeOut 0.32s ease-in 0.09s both" : "ptFadeIn 0.3s ease-out both",
              }}
              onClick={closePanel}
            />

            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
              <div
                className="pointer-events-auto w-full max-w-3xl lg:max-w-5xl relative"
                style={{
                  animation: closing
                    ? "ptCardExit 0.32s cubic-bezier(0.4,0,1,1) 0.06s both"
                    : "ptCardEnter 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.03s both",
                }}
              >
                {/* Ambient glow — gold-led, faint blue/green nod to the two
                    lead teams so it ties back to the same visual family */}
                <div
                  className="absolute -inset-6 blur-3xl rounded-[40px]"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(59,139,212,0.18), rgba(201,151,31,0.2), rgba(42,157,92,0.16))",
                  }}
                />

                {/* Metallic bezel — same brushed-steel/gold plaque frame */}
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
                  <div
                    className="relative overflow-hidden"
                    style={{
                      background:
                        "linear-gradient(180deg, var(--color-surface, #0e1420) 0%, var(--color-surface-container-lowest, #080b12) 100%)",
                      maxHeight: "calc(100vh - 3rem)",
                      clipPath: PLAQUE_CLIP_INNER,
                      WebkitClipPath: PLAQUE_CLIP_INNER,
                    }}
                  >
                    {/* Tournament emblem watermark */}
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                      aria-hidden="true"
                      style={{ opacity: 0.12, mixBlendMode: "screen" }}
                    >
                      <img
                        src={TOURNAMENT.logo}
                        alt=""
                        className="w-2/3 h-2/3 object-contain"
                        style={{ filter: "grayscale(1) contrast(1.4) brightness(2)" }}
                      />
                    </div>

                    {/* Header — tournament identity, same crest-banner device */}
                    <div
                      className="relative z-10 flex items-center justify-center gap-4 pt-5 pb-3 px-8 sm:px-12"
                      style={{
                        borderBottom: "1px solid var(--color-border-overlay, rgba(255,255,255,0.08))",
                        animation: closing
                          ? "ptHeaderOut 0.2s ease-in 0.12s both"
                          : "ptHeaderIn 0.45s cubic-bezier(0.22,1,0.36,1) 0.15s both",
                      }}
                    >
                      <div className="hidden sm:block h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(201,151,31,0.5))" }} />
                      <div className="leading-tight text-center shrink-0">
                        <p className="font-heading font-black text-sm sm:text-lg tracking-wide" style={{ color: "var(--color-on-surface, #eef0f4)" }}>
                          Points Table
                        </p>
                        <p className="text-[9px] font-bold tracking-[0.3em] uppercase" style={{ color: "var(--color-theme-orange, #C9971F)" }}>
                          {TOURNAMENT.name} · {TOURNAMENT.edition}
                        </p>
                      </div>
                      <div className="hidden sm:block h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(201,151,31,0.5), transparent)" }} />
                    </div>

                    {/* Two-column landscape split: ranks 1-4 on the left,
                        5-8 on the right, so the whole table sits inside one
                        wide, short card instead of a tall scrolling list. */}
                    <div
                      className="relative z-10 flex items-stretch pt-4 pb-3"
                      style={{
                        animation: closing
                          ? "ptHeaderOut 0.2s ease-in 0.1s both"
                          : "ptHeaderIn 0.4s cubic-bezier(0.22,1,0.36,1) 0.22s both",
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <ColumnHeader />
                        {before.map((team, i) => (
                          <TeamRow key={team.short} team={team} closing={closing} delay={0.26 + i * 0.04} />
                        ))}
                      </div>

                      {/* Divider — same vertical-line-with-gold-dot device as
                          the VS divider, carrying the qualification label
                          along the seam instead of a horizontal banner */}
                      <div className="relative w-px mx-3 sm:mx-5 shrink-0 self-stretch flex items-center justify-center">
                        <div
                          className="w-px h-full"
                          style={{
                            background:
                              "linear-gradient(180deg, transparent 0%, var(--color-border-overlay, rgba(255,255,255,0.12)) 15%, rgba(201,151,31,0.55) 50%, var(--color-border-overlay, rgba(255,255,255,0.12)) 85%, transparent 100%)",
                          }}
                        />
                        <span
                          className="absolute px-1.5 py-3 whitespace-nowrap font-bold uppercase text-[7px] sm:text-[8px] tracking-[0.25em]"
                          style={{
                            color: "var(--color-theme-orange, #C9971F)",
                            writingMode: "vertical-rl",
                            background: "var(--color-surface, #0e1420)",
                          }}
                        >
                          Qualify for Semis
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <ColumnHeader />
                        {after.map((team, i) => (
                          <TeamRow key={team.short} team={team} closing={closing} delay={0.34 + i * 0.04} />
                        ))}
                      </div>
                    </div>

                    {/* Footer — ticket stub, same tear-seam device as the
                        other cards in this family */}
                    <div
                      className="relative z-10 flex flex-col sm:flex-row"
                      style={{
                        borderTop: "1px solid var(--color-border-overlay, rgba(255,255,255,0.08))",
                        animation: closing
                          ? "ptFooterOut 0.2s ease-in both"
                          : "ptFooterIn 0.45s cubic-bezier(0.22,1,0.36,1) 0.68s both",
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
                          backgroundImage: "repeating-linear-gradient(90deg, var(--color-outline, #7a8194) 0 5px, transparent 5px 11px)",
                          opacity: 0.5,
                        }}
                      />

                      <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-3 text-center">
                        <p className="font-heading text-xs sm:text-base font-black uppercase tracking-tight" style={{ color: "var(--color-theme-orange, #C9971F)" }}>
                          {RESULT_LINE}
                        </p>
                      </div>
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

        @keyframes ptFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ptFadeOut { from { opacity: 1; } to { opacity: 0; } }

        @keyframes ptCardEnter {
          from { opacity: 0; transform: scale(0.86) translateY(-26px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes ptCardExit {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.92) translateY(12px); }
        }

        @keyframes ptHeaderIn {
          from { opacity: 0; transform: translateY(-14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ptHeaderOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-8px); }
        }

        @keyframes ptRowIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes ptRowOut {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(-8px); }
        }

        @keyframes ptFooterIn {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ptFooterOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(16px); }
        }

        .shine-ring {
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
          animation: ptSpin 3.5s linear infinite;
        }
        @keyframes ptSpin {
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