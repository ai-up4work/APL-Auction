// components/overlays/CricketScorecard.jsx
"use client";

import { ListOrdered, Star } from "lucide-react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useOverlayPanel } from "@/hooks/useOverlayPanel";
import { useBallsLedger } from "@/hooks/useBallsLedger";
import { buildInningsCard } from "@/lib/scorecardAggregator";
import { GOLD_BEZEL, plaqueClip, ambientGlow } from "@/lib/overlayTokens";
import TearLine from "@/components/overlays/shared/TearLine";

const EXIT_DURATION_MS = 400;

const PLAQUE_CLIP = plaqueClip(30);
const PLAQUE_CLIP_INNER = plaqueClip(27);

// Custom team badge component that properly handles logoUrl
function TeamBadge({ team, variant, sizeClass = "w-14 h-14", glowInset = "-inset-2.5" }) {
  const logoUrl = team?.logoUrl || team?.logo;
  
  return (
    <div className={`relative ${sizeClass} shrink-0`}>
      {/* Glow ring */}
      <div 
        className={`absolute ${glowInset} rounded-full opacity-30`}
        style={{
          background: `radial-gradient(circle, ${team?.color || '#c9971f'}44 0%, transparent 70%)`,
        }}
      />
      
      {/* Frame */}
      <div 
        className="relative w-full h-full rounded-full overflow-hidden"
        style={{
          border: `2px solid ${team?.color || '#c9971f'}`,
          background: '#0e1420',
        }}
      >
        {logoUrl ? (
          <Image 
            src={logoUrl} 
            alt={team?.name || 'Team'} 
            fill
            className="object-cover"
          />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center text-white font-bold text-sm"
            style={{ background: team?.color || '#2a2a3a' }}
          >
            {team?.shortCode || team?.name?.charAt(0) || '?'}
          </div>
        )}
        
        {/* Gloss overlay */}
        <div 
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'linear-gradient(160deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.02) 30%, transparent 55%)',
          }}
        />
      </div>
    </div>
  );
}

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
        {top && <Star className="w-3 h-3 shrink-0" style={{ color: "var(--color-theme-orange)" }} fill="var(--color-theme-orange)" strokeWidth={0} />}
        <span
          className="text-[10.5px] sm:text-sm font-bold uppercase tracking-tight truncate"
          style={{ color: top ? "var(--color-on-surface)" : "var(--color-on-surface-variant)" }}
        >
          {label}
        </span>
      </span>
      <span className="flex items-baseline gap-2.5 sm:gap-3 shrink-0 tabular-nums">
        <span className="text-[10.5px] sm:text-sm font-black" style={{ color: top ? "var(--color-theme-orange)" : "var(--color-on-surface)" }}>
          {value1}
        </span>
        <span className="text-[9px] sm:text-xs font-semibold w-6 sm:w-7 text-right" style={{ color: "var(--color-outline)" }}>
          {value2}
        </span>
      </span>
    </div>
  );
}

function TeamInnings({ team, innings, closing, delay, variant }) {
  return (
    <div
      className="relative z-10 msc-block h-full flex flex-col"
      style={{ animation: closing ? "mscBlockOut 0.2s ease-in both" : `mscBlockIn 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}s both` }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 90% 100% at 50% 0%, ${team.color}33 0%, transparent 60%)` }}
      />

      <div className="relative z-10 flex items-center gap-3 px-5 sm:px-6 lg:px-6 pt-5 pb-3">
        <span className="text-[9px] font-bold tracking-[0.3em] uppercase shrink-0" style={{ color: "var(--color-theme-orange)" }}>
          {innings.label}
        </span>
        <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(201,151,31,0.45), transparent)" }} />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-4 px-5 sm:px-6 lg:px-6 pb-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <TeamBadge team={team} variant={variant} sizeClass="w-14 h-14 sm:w-16 sm:h-16" glowInset="-inset-2.5" />
          <span className="font-heading font-black text-sm sm:text-lg lg:text-xl uppercase tracking-wide leading-tight truncate" style={{ color: "var(--color-on-surface)" }}>
            {team.name}
          </span>
        </div>

        <div className="text-right shrink-0">
          <div className="font-heading font-black text-2xl sm:text-3xl lg:text-4xl tabular-nums leading-none" style={{ color: "var(--color-theme-orange)" }}>
            {innings.score}
          </div>
          <div className="text-[9px] sm:text-[11px] font-bold tracking-[0.2em] uppercase mt-1" style={{ color: "var(--color-outline)" }}>
            {innings.overs} overs
          </div>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-px px-5 sm:px-6 lg:px-6 pb-1">
        <div className="flex items-center justify-between pr-2">
          <span className="text-[8.5px] sm:text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: "var(--color-outline)" }}>Batting</span>
          <span className="flex gap-3 sm:gap-4 text-[8.5px] sm:text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: "var(--color-outline)" }}>
            <span>R</span>
            <span className="w-6 sm:w-7 text-right">B</span>
          </span>
        </div>
        <div className="flex items-center justify-between pl-4 sm:pl-5" style={{ borderLeft: "1px solid var(--color-border-overlay)" }}>
          <span className="text-[8.5px] sm:text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: "var(--color-outline)" }}>Bowling</span>
          <span className="flex gap-3 sm:gap-4 text-[8.5px] sm:text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: "var(--color-outline)" }}>
            <span>W-R</span>
            <span className="w-7 sm:w-8 text-right">O</span>
          </span>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-2 px-3 sm:px-4 lg:px-4 pb-5 flex-1">
        <div>
          {innings.batting.length === 0 && (
            <p className="px-1 py-2 text-[10px] italic" style={{ color: "var(--color-outline)" }}>No batters yet</p>
          )}
          {innings.batting.map((p) => (
            <StatRow
              key={p.name}
              label={p.out ? `${p.name} · ${p.out}` : `${p.name}${p.balls > 0 ? " · not out" : ""}`}
              value1={p.runs}
              value2={p.balls}
              top={p.top}
              ringColor={team.color}
            />
          ))}
        </div>
        <div style={{ borderLeft: "1px solid var(--color-border-overlay)" }}>
          {innings.bowling.length === 0 && (
            <p className="px-1 py-2 text-[10px] italic" style={{ color: "var(--color-outline)" }}>No bowlers yet</p>
          )}
          {innings.bowling.map((p) => (
            <StatRow key={p.name} label={p.name} value1={p.figures} value2={p.overs} top={p.top} ringColor={team.color} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CricketScorecard({ show, hideTrigger = false, matchId, matchSetup = {}, liveState = {}, sandboxInningsCards }) {
  const { mounted, open, closing, toggle, closePanel } = useOverlayPanel(show, EXIT_DURATION_MS, { defaultOpen: false, escapeToClose: true });

  // Skip the ledger fetch entirely once sandbox data is supplied — it'll
  // always come back empty for matchId=null anyway.
  const { balls } = useBallsLedger(matchId, mounted && !sandboxInningsCards);

  const { teamA, teamB, tournamentLogoUrl, tournamentName } = matchSetup;
  const { inningsNumber = 1, matchComplete = false, matchResult } = liveState;

  const innings1Label = inningsNumber === 2 || matchComplete ? "1st Innings" : "1st Innings (in progress)";
  const innings2Label = "2nd Innings";

  function fallback(snap, label) {
    return {
      label: snap?.label ?? label,
      score: snap?.score ?? "0/0",
      overs: snap?.overs ?? "0.0",
      batting: snap?.batting ?? [],
      bowling: snap?.bowling ?? [],
    };
  }

  const inningsA = sandboxInningsCards
    ? fallback(sandboxInningsCards[1], innings1Label)
    : buildInningsCard(balls, 1, innings1Label);
  const inningsB = sandboxInningsCards
    ? fallback(sandboxInningsCards[2], innings2Label)
    : buildInningsCard(balls, 2, innings2Label);

  const resultLine = matchComplete && matchResult
    ? `${matchResult.winningTeamName} ${matchResult.margin}`
    : "Match in progress";

  if (!teamA || !teamB) {
    console.warn('CricketScorecard: Missing team data');
    return null;
  }

  return (
    <>
      {!hideTrigger && (
        <button
          onClick={toggle}
          className="relative flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
          style={{ color: "var(--color-on-surface-variant)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-theme-orange)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-on-surface-variant)")}
        >
          <ListOrdered className="w-5 h-5" />
          <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Scorecard</span>
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
                animation: closing ? "mscFadeOut 0.32s ease-in 0.09s both" : "mscFadeIn 0.3s ease-out both",
              }}
              onClick={closePanel}
            />

            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
              <div
                className="pointer-events-auto w-full max-w-2xl lg:max-w-5xl relative"
                style={{
                  animation: closing
                    ? "mscCardExit 0.32s cubic-bezier(0.4,0,1,1) 0.06s both"
                    : "mscCardEnter 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.03s both",
                }}
              >
                <div className="absolute -inset-6 blur-3xl rounded-[40px]" style={{ background: ambientGlow(teamA, teamB) }} />

                <div
                  className="relative p-[3px] sm:p-[4px]"
                  style={{
                    background: GOLD_BEZEL,
                    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.5)",
                    clipPath: PLAQUE_CLIP,
                    WebkitClipPath: PLAQUE_CLIP,
                  }}
                >
                  <div
                    className="relative overflow-x-hidden overflow-y-auto"
                    style={{
                      background: "linear-gradient(180deg, var(--color-surface, #0e1420) 0%, var(--color-surface-container-lowest, #080b12) 100%)",
                      maxHeight: "calc(100vh - 3rem)",
                      clipPath: PLAQUE_CLIP_INNER,
                      WebkitClipPath: PLAQUE_CLIP_INNER,
                    }}
                  >
                    {tournamentLogoUrl && (
                      <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                        aria-hidden="true"
                        style={{ opacity: 0.16, mixBlendMode: "screen" }}
                      >
                        <div className="relative w-2/3 h-2/3">
                          <Image
                            src={tournamentLogoUrl}
                            alt=""
                            fill
                            className="object-contain"
                            style={{ filter: "grayscale(1) contrast(1.4) brightness(2)" }}
                          />
                        </div>
                      </div>
                    )}

                    <div
                      className="relative z-10 flex items-center justify-center gap-4 pt-7 pb-4 px-8 sm:px-12"
                      style={{
                        borderBottom: "1px solid var(--color-border-overlay)",
                        animation: closing ? "mscHeaderOut 0.2s ease-in 0.12s both" : "mscHeaderIn 0.45s cubic-bezier(0.22,1,0.36,1) 0.15s both",
                      }}
                    >
                      <div className="hidden sm:block h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(201,151,31,0.5))" }} />
                      <div className="leading-tight text-center shrink-0">
                        <p className="font-heading font-black text-sm sm:text-lg tracking-wide" style={{ color: "var(--color-on-surface)" }}>
                          Match Summary
                        </p>
                        {tournamentName && (
                          <p className="text-[9px] font-bold tracking-[0.3em] uppercase" style={{ color: "var(--color-theme-orange)" }}>
                            {tournamentName}
                          </p>
                        )}
                      </div>
                      <div className="hidden sm:block h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(201,151,31,0.5), transparent)" }} />
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-stretch">
                      <div className="lg:w-1/2 lg:flex lg:flex-col">
                        <TeamInnings team={teamA} innings={inningsA} closing={closing} delay={0.26} variant="blue" />
                      </div>

                      <div
                        className="relative z-10 mx-5 sm:mx-8 h-px lg:hidden"
                        style={{ background: "linear-gradient(90deg, transparent, rgba(201,151,31,0.4), transparent)" }}
                      />
                      <div
                        className="relative z-10 hidden lg:block w-px my-6"
                        style={{ background: "linear-gradient(180deg, transparent, rgba(201,151,31,0.55), transparent)" }}
                      />

                      <div className="lg:w-1/2 lg:flex lg:flex-col">
                        <TeamInnings team={teamB} innings={inningsB} closing={closing} delay={0.38} variant="green" />
                      </div>
                    </div>

                    <div
                      className="glass-panel relative z-10 flex items-center justify-center px-8 py-6 text-center"
                      style={{
                        borderLeft: "none",
                        borderRight: "none",
                        borderBottom: "none",
                        animation: closing ? "mscFooterOut 0.2s ease-in both" : "mscFooterIn 0.45s cubic-bezier(0.22,1,0.36,1) 0.52s both",
                      }}
                    >
                      <TearLine variant="inset" />
                      <p className="font-heading text-base sm:text-xl font-black uppercase tracking-tight" style={{ color: "var(--color-theme-orange)" }}>
                        {resultLine}
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
        @keyframes mscFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mscFadeOut { from { opacity: 1; } to { opacity: 0; } }

        @keyframes mscCardEnter {
          from { opacity: 0; transform: scale(0.86) translateY(-26px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes mscCardExit {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.92) translateY(12px); }
        }

        @keyframes mscHeaderIn { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes mscHeaderOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-10px); } }

        @keyframes mscBlockIn { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes mscBlockOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(14px); } }

        @keyframes mscFooterIn { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes mscFooterOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(20px); } }

        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 1ms !important; animation-delay: 0ms !important; }
        }
      `}</style>
    </>
  );
}