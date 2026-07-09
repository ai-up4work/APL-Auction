"use client";

import { Award, Star } from "lucide-react";
import { createPortal } from "react-dom";
import { useOverlayPanel } from "@/hooks/useOverlayPanel";
import { usePointsTableLedger } from "@/hooks/usePointsTableLedger";
import { GOLD_BEZEL, plaqueClip } from "@/lib/overlayTokens";

// ---- Defaults for props that still don't come from a DB table (there's
// no `tournaments` table yet) — override via props same as before. ----
export const DEFAULT_TOURNAMENT = {
  name: "MOON KNIGHT CUP",
  edition: "SEASON 7 · WOMEN'S T20",
  logo: "/moon-knight-logo.png",
};

export const DEFAULT_QUALIFY_CUTOFF = 4; // top N advance — draws the cut line under this rank
export const DEFAULT_RESULT_LINE = "TOP 4 ADVANCE TO THE SEMI-FINALS";

const EXIT_DURATION_MS = 400;

// Same cut-corner "plaque" clip used on the scorecard.
const PLAQUE_CLIP = plaqueClip(30);
const PLAQUE_CLIP_INNER = plaqueClip(27);

function formatNrr(value) {
  if (value === 0) return "0.000";
  const fixed = Math.abs(value).toFixed(3);
  return value > 0 ? `+${fixed}` : `-${fixed}`;
}

// Circular medallion crest — same shine-ring / gloss / inset-shadow
// treatment as the team badges on the other cards.
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
          {team.image ? (
            <img src={team.image} alt={team.name} className="w-full h-full object-contain" />
          ) : (
            <span className="text-[10px] font-black text-white">{team.short}</span>
          )}
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
// the two stay pixel-aligned.
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

/**
 * PointsTable — now driven by a live `auctionId` instead of a static
 * `teams` prop. Standings (P/W/L/T/NR/Pts/NRR) come from the `standings`
 * table via usePointsTableLedger, joined with `teams` for name/logo/color.
 * Open/close panel state now uses the same useOverlayPanel hook as
 * CricketScorecard, for the same remote-control (`show` prop) behavior.
 *
 * `tournament`, `qualifyCutoff`, `resultLine` remain props since there's
 * no tournament table yet — set these per broadcast same as before.
 */
export default function PointsTable({
  auctionId,
  tournament = DEFAULT_TOURNAMENT,
  qualifyCutoff = DEFAULT_QUALIFY_CUTOFF,
  resultLine = DEFAULT_RESULT_LINE,
  show,
  hideTrigger = false,
}) {
  const { mounted, open, closing, toggle, closePanel } = useOverlayPanel(show, EXIT_DURATION_MS, {
    defaultOpen: false,
    escapeToClose: true,
  });

  const { teams, loading } = usePointsTableLedger(auctionId, mounted);

  const before = teams.filter((t) => t.rank <= qualifyCutoff);
  const after = teams.filter((t) => t.rank > qualifyCutoff);
  const hasTeams = teams.length > 0;

  return (
    <>
      {!hideTrigger && (
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
      )}

      {mounted &&
        open &&
        createPortal(
          <>
            <div
              className="fixed inset-0 backdrop-blur-md z-[100]"
              style={{
                background: "rgba(0,0,0,0.88)",
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
                <div
                  className="absolute -inset-6 blur-3xl rounded-[40px]"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(59,139,212,0.18), rgba(201,151,31,0.2), rgba(42,157,92,0.16))",
                  }}
                />

                <div
                  className="relative p-[3px] sm:p-[4px]"
                  style={{
                    background: GOLD_BEZEL,
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
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                      aria-hidden="true"
                      style={{ opacity: 0.12, mixBlendMode: "screen" }}
                    >
                      <img
                        src={tournament.logo}
                        alt=""
                        className="w-2/3 h-2/3 object-contain"
                        style={{ filter: "grayscale(1) contrast(1.4) brightness(2)" }}
                      />
                    </div>

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
                          {tournament.name} · {tournament.edition}
                        </p>
                      </div>
                      <div className="hidden sm:block h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(201,151,31,0.5), transparent)" }} />
                    </div>

                    {!hasTeams ? (
                      <div className="relative z-10 flex items-center justify-center py-14 px-8">
                        <p
                          className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-center"
                          style={{ color: "var(--color-outline, #7a8194)" }}
                        >
                          {loading ? "Loading standings…" : "Standings will appear once matches are recorded."}
                        </p>
                      </div>
                    ) : (
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
                    )}

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
                          {resultLine}
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