// File: components/demo/TournamentBracketEditable.tsx
"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import type { Round, MatchNode } from "@/components/tournament/TournamentBracket";
import MatchResultCard from "./MatchResultCard";

/* ------------------------------------------------------------------ */
/*  Editable counterpart to TournamentBracket.                         */
/*                                                                       */
/*  TournamentBracket itself is left untouched — this is a parallel     */
/*  component for screens (like the sandbox) that want in-place score   */
/*  entry, mirroring what DoubleElimBoard already does with             */
/*  MatchResultCard. It reuses the same mirrored-layout / connector-    */
/*  geometry approach as TournamentBracket so the visual result matches,*/
/*  but every match renders as an editable MatchResultCard instead of   */
/*  the read-only card, and onRecordResult is required (not optional)   */
/*  since there's no point using this component without it — for a     */
/*  purely read-only bracket, use TournamentBracket instead.            */
/*                                                                       */
/*  Trade-offs vs TournamentBracket, since MatchResultCard doesn't       */
/*  support everything the read-only MatchCard did:                     */
/*   - No "From {round}" tap-through on TBD slots (MatchResultCard has   */
/*     no onFromClick). Mobile still has the round-pager buttons at the  */
/*     top, so navigation between rounds isn't lost, just that one       */
/*     shortcut.                                                         */
/*   - MatchResultCard exposes a single ref for the whole card, not a    */
/*     per-team-row ref. The Final's connector lines fall back to        */
/*     anchoring at the card's vertical center instead of the exact      */
/*     team row — cosmetic only.                                        */
/* ------------------------------------------------------------------ */

export interface TournamentBracketEditableProps {
  rounds: Round[];
  onRecordResult: (matchId: string, winner: "A" | "B", scoreA: number, scoreB: number) => void;
  title?: string;
  eyebrowLabel?: string;
  helperText?: string;
  liveLabel?: string;
  logoSrc?: string;
  className?: string;
  onActiveTeamChange?: (teamCode: string | null) => void;
}

const GROW_WEIGHT = {
  full: 2,
  semi: 1.2,
  quarter: 1.1,
  compact: 0.9,
};

/* ------------------------------------------------------------------ */
/*  Geometry helpers — identical to TournamentBracket's                */
/* ------------------------------------------------------------------ */

function elbowPath(x1: number, y1: number, x2: number, y2: number, radius = 12): string {
  const midX = (x1 + x2) / 2;
  if (Math.abs(y2 - y1) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const dir = y2 > y1 ? 1 : -1;
  const r = Math.max(0, Math.min(radius, Math.abs(y2 - y1) / 2, Math.abs(midX - x1)));
  return `M ${x1} ${y1} L ${midX - r} ${y1} Q ${midX} ${y1} ${midX} ${y1 + r * dir} L ${midX} ${
    y2 - r * dir
  } Q ${midX} ${y2} ${midX + r} ${y2} L ${x2} ${y2}`;
}

function topEntryPath(x1: number, y1: number, x2: number, y2: number, radius = 10): string {
  if (Math.abs(x2 - x1) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const dir = y2 > y1 ? 1 : -1;
  const sign = x2 > x1 ? 1 : -1;
  const r = Math.max(0, Math.min(radius, Math.abs(x2 - x1), Math.abs(y2 - y1)));
  return `M ${x1} ${y1} L ${x2 - r * sign} ${y1} Q ${x2} ${y1} ${x2} ${y1 + r * dir} L ${x2} ${y2}`;
}

function computeCentersFromLeaves(leafCentersPx: number[], matchCountsPerRound: number[]): number[][] {
  const centers: number[][] = [leafCentersPx];
  for (let r = 1; r < matchCountsPerRound.length; r++) {
    const prev = centers[r - 1];
    const count = matchCountsPerRound[r];
    const next: number[] = [];
    for (let i = 0; i < count; i++) next.push((prev[i * 2] + prev[i * 2 + 1]) / 2);
    centers.push(next);
  }
  return centers;
}

type RefSetter = (el: HTMLDivElement | null) => void;

/* ------------------------------------------------------------------ */
/*  Column renderer — same slot/positioning logic as TournamentBracket's */
/*  BracketColumn, but always renders MatchResultCard.                  */
/* ------------------------------------------------------------------ */

function BracketColumn({
  roundName,
  matches,
  centerYByMatchId,
  getRef,
  hoveredTeamCode,
  setHoveredTeamCode,
  onTeamClick,
  pinnedTeamCode,
  onRecordResult,
  isLeaf,
  leafColumnRef,
  growWeight = 1,
  bleedLeft,
  bleedRight,
  innerBleedLeft,
  innerBleedRight,
}: {
  roundName: string;
  matches: MatchNode[];
  centerYByMatchId?: Record<string, number>;
  getRef: (key: string) => RefSetter;
  hoveredTeamCode: string | null;
  setHoveredTeamCode: (c: string | null) => void;
  onTeamClick?: (code: string) => void;
  pinnedTeamCode?: string | null;
  onRecordResult: TournamentBracketEditableProps["onRecordResult"];
  isLeaf?: boolean;
  leafColumnRef?: RefSetter;
  growWeight?: number;
  bleedLeft?: string;
  bleedRight?: string;
  innerBleedLeft?: string;
  innerBleedRight?: string;
}) {
  return (
    <div
      className="flex flex-col items-center min-w-0 relative h-full"
      style={{ flexGrow: growWeight, flexShrink: 1, flexBasis: 0 }}
    >
      <div className="w-full text-center mb-2 md:mb-3 lg:mb-4 relative z-10">
        <span className="inline-block px-2.5 py-1 lg:px-4 lg:py-1.5 rounded-full text-[9px] lg:text-[10px] font-black uppercase tracking-widest font-label-mono bg-surface-container-low border border-border-overlay text-on-surface-variant shadow-lg truncate max-w-full">
          {roundName}
        </span>
        <div className="absolute left-0 right-0 top-1/2 -z-10 h-px bg-gradient-to-r from-transparent via-border-overlay to-transparent" />
      </div>
      {isLeaf ? (
        <div ref={leafColumnRef} className="w-full flex flex-col gap-8 lg:gap-10 items-stretch">
          {matches.map((match) => (
            <div key={match.id} className="w-full px-2">
              <MatchResultCard
                match={match}
                onRecordResult={onRecordResult}
                cardRef={getRef(match.id)}
                hoveredTeamCode={hoveredTeamCode}
                onTeamHover={setHoveredTeamCode}
                onTeamClick={onTeamClick}
                pinnedTeamCode={pinnedTeamCode}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="absolute inset-0 pointer-events-none z-10">
          {matches.map((match) => {
            const centerY = centerYByMatchId?.[match.id] ?? 0;
            return (
              <div
                key={match.id}
                ref={getRef(match.id)}
                className="absolute px-0.5 lg:px-1 pointer-events-auto"
                style={{
                  top: centerY,
                  transform: "translateY(-50%)",
                  left: bleedLeft || "0",
                  right: bleedRight || "0",
                }}
              >
                <div style={{ marginLeft: innerBleedLeft, marginRight: innerBleedRight }}>
                  <MatchResultCard
                    match={match}
                    onRecordResult={onRecordResult}
                    hoveredTeamCode={hoveredTeamCode}
                    onTeamHover={setHoveredTeamCode}
                    onTeamClick={onTeamClick}
                    pinnedTeamCode={pinnedTeamCode}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Connector {
  id: string;
  d: string;
  teamCode?: string;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function TournamentBracketEditable({
  rounds,
  onRecordResult,
  title = "Championship Bracket",
  eyebrowLabel = "Knockout Stage",
  helperText = "Hover or click a team to trace their path.",
  liveLabel = "Live Matches",
  logoSrc,
  className = "",
  onActiveTeamChange,
}: TournamentBracketEditableProps) {
  const [hoveredTeamCode, setHoveredTeamCode] = useState<string | null>(null);
  const [selectedTeamCode, setSelectedTeamCode] = useState<string | null>(null);
  const [mobileRound, setMobileRound] = useState(0);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const desktopContainerRef = useRef<HTMLDivElement>(null);
  const leafColumnRef = useRef<HTMLDivElement | null>(null);
  const cardEls = useRef<Record<string, HTMLDivElement | null>>({});
  const refCache = useRef<Record<string, RefSetter>>({});
  const mobileVerticalRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [connectors, setConnectors] = useState<Connector[]>([]);

  const [matchCenterY, setMatchCenterY] = useState<Record<string, number>>({});
  const [finalCenter, setFinalCenter] = useState<{ x: number; y: number } | null>(null);
  const [columnHeight, setColumnHeight] = useState(1200);

  const teamCount = rounds.length > 0 ? rounds[0].matches.length * 2 : 0;
  const useMirroredLayout = teamCount >= 16;

  function getRef(key: string): RefSetter {
    if (!refCache.current[key]) {
      refCache.current[key] = (el: HTMLDivElement | null) => {
        cardEls.current[key] = el;
      };
    }
    return refCache.current[key];
  }

  const finalRound = rounds[rounds.length - 1];
  const nonFinalRounds = rounds.slice(0, -1);
  const leftSideMatches = useMirroredLayout ? nonFinalRounds.map((r) => r.matches.slice(0, r.matches.length / 2)) : [];
  const rightSideMatches = useMirroredLayout ? nonFinalRounds.map((r) => r.matches.slice(r.matches.length / 2)) : [];

  function getRoundGrowWeight(roundIndex: number, side: "left" | "right" | "final"): number {
    if (side === "final") return GROW_WEIGHT.full * 1.3;
    const totalRounds = nonFinalRounds.length;
    if (roundIndex <= 1) return GROW_WEIGHT.full;
    if (roundIndex === 2 && totalRounds >= 4) return GROW_WEIGHT.quarter * 0.85;
    if (roundIndex === totalRounds - 1) return GROW_WEIGHT.semi * 0.85;
    return GROW_WEIGHT.compact;
  }

  function recomputeLayout() {
    const containerEl = desktopContainerRef.current;
    if (!containerEl || !finalRound) return;
    const containerRect = containerEl.getBoundingClientRect();
    if (containerRect.width === 0) return;

    function measuredCenter(matchId: string): number | null {
      const el = cardEls.current[matchId];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.height === 0) return null;
      return r.top + r.height / 2 - containerRect.top;
    }

    const nextCenters: Record<string, number> = {};
    if (useMirroredLayout) {
      const leftLeafY = leftSideMatches[0]?.map((m) => measuredCenter(m.id)) ?? [];
      const rightLeafY = rightSideMatches[0]?.map((m) => measuredCenter(m.id)) ?? [];
      if (leftLeafY.length === 0 || rightLeafY.length === 0) return;
      if (leftLeafY.some((v) => v === null) || rightLeafY.some((v) => v === null)) return;
      const leftCounts = leftSideMatches.map((r) => r.length);
      const rightCounts = rightSideMatches.map((r) => r.length);
      const leftPix = computeCentersFromLeaves(leftLeafY as number[], leftCounts);
      const rightPix = computeCentersFromLeaves(rightLeafY as number[], rightCounts);
      nonFinalRounds.forEach((_, r) => {
        leftSideMatches[r].forEach((m, i) => {
          nextCenters[m.id] = leftPix[r][i];
        });
        rightSideMatches[r].forEach((m, i) => {
          nextCenters[m.id] = rightPix[r][i];
        });
      });
      const lastLeft = leftPix[leftPix.length - 1][0];
      const lastRight = rightPix[rightPix.length - 1][0];
      nextCenters[finalRound.matches[0].id] = (lastLeft + lastRight) / 2;
    } else {
      const leafMatches = rounds[0]?.matches ?? [];
      const leafY = leafMatches.map((m) => measuredCenter(m.id));
      if (leafY.length === 0 || leafY.some((v) => v === null)) return;
      const counts = rounds.map((r) => r.matches.length);
      const pix = computeCentersFromLeaves(leafY as number[], counts);
      rounds.forEach((round, r) => {
        round.matches.forEach((m, i) => {
          nextCenters[m.id] = pix[r][i];
        });
      });
    }
    setMatchCenterY(nextCenters);
    const leafH = leafColumnRef.current?.scrollHeight;
    if (leafH && Math.abs(leafH - columnHeight) > 1) setColumnHeight(leafH);

    const finalCardEl = cardEls.current[finalRound.matches[0].id];
    if (finalCardEl) {
      const rect = finalCardEl.getBoundingClientRect();
      const x = rect.left + rect.width / 2 - containerRect.left;
      setFinalCenter({ x, y: nextCenters[finalRound.matches[0].id] });
    }
  }

  function recomputeConnectors() {
    const containerEl = desktopContainerRef.current;
    if (!containerEl || !finalRound) return;
    const containerRect = containerEl.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;
    const next: Connector[] = [];
    for (const round of rounds) {
      const isFinal = round.id === finalRound.id;
      for (const match of round.matches) {
        (["aFrom", "bFrom"] as const).forEach((key, slotIdx) => {
          const feederLabel = match[key];
          if (!feederLabel) return;
          const sourceEl = cardEls.current[feederLabel];
          const targetEl = cardEls.current[match.id];
          if (!sourceEl || !targetEl) return;
          const sRect = sourceEl.getBoundingClientRect();
          const tRect = targetEl.getBoundingClientRect();
          if (sRect.width === 0 || tRect.width === 0) return;
          const sCenterX = sRect.left + sRect.width / 2;
          const tCenterX = tRect.left + tRect.width / 2;
          const flowsRight = sCenterX < tCenterX;
          const startX = (flowsRight ? sRect.right : sRect.left) - containerRect.left;
          const startY = sRect.top + sRect.height / 2 - containerRect.top;

          const team = slotIdx === 0 ? match.teamA : match.teamB;
          const teamCodeForConnector = team?.code || null;

          if (isFinal) {
            // MatchResultCard only exposes a single ref for the whole
            // card (no per-team-row ref like the read-only MatchCard),
            // so this always falls back to the card's own rect — the
            // connector anchors at the card's vertical center rather
            // than the exact team row. Cosmetic only.
            const trRect = tRect;
            const endX = (flowsRight ? trRect.left : trRect.right) - containerRect.left;
            const endY = trRect.top + trRect.height / 2 - containerRect.top;
            next.push({
              id: `${match.id}-${slotIdx === 0 ? "A" : "B"}`,
              d: elbowPath(startX, startY, endX, endY),
              teamCode: teamCodeForConnector || undefined,
            });
            return;
          }
          const endX = tCenterX - containerRect.left;
          const endY = (slotIdx === 0 ? tRect.top : tRect.bottom) - containerRect.top;
          next.push({
            id: `${match.id}-${slotIdx === 0 ? "A" : "B"}`,
            d: topEntryPath(startX, startY, endX, endY),
            teamCode: teamCodeForConnector || undefined,
          });
        });
      }
    }
    setConnectors(next);
  }

  useLayoutEffect(() => {
    recomputeLayout();
    const raf = requestAnimationFrame(recomputeLayout);
    const ro = new ResizeObserver(() => recomputeLayout());
    if (desktopContainerRef.current) ro.observe(desktopContainerRef.current);
    window.addEventListener("resize", recomputeLayout);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", recomputeLayout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds]);

  useLayoutEffect(() => {
    recomputeConnectors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchCenterY, columnHeight]);

  function goToRound(idx: number) {
    const clamped = Math.max(0, Math.min(rounds.length - 1, idx));
    setMobileRound(clamped);
    const el = mobileScrollRef.current;
    if (el) el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  }

  function handleTeamClick(teamCode: string) {
    setSelectedTeamCode((prev) => (prev === teamCode ? null : teamCode));
  }

  useEffect(() => {
    const el = mobileScrollRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      setMobileRound(Math.round(el.scrollLeft / el.clientWidth));
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const roundId = rounds[mobileRound]?.id;
    const el = roundId !== undefined ? mobileVerticalRefs.current[roundId] : null;
    if (el) el.scrollTop = 0;
  }, [mobileRound, rounds]);

  const activeTeamCode = hoveredTeamCode || selectedTeamCode;

  useEffect(() => {
    onActiveTeamChange?.(activeTeamCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeamCode]);

  if (!rounds || rounds.length === 0 || !finalRound) {
    return (
      <div className="min-h-[200px] w-full flex items-center justify-center text-outline font-label-mono text-sm">
        No bracket data provided.
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full bg-background text-on-surface p-2 md:p-2 ${className}`}>
      <style>{`
        html {
          scrollbar-width: thin;
          scrollbar-color: var(--color-border-overlay) transparent;
        }
        html::-webkit-scrollbar { width: 8px; height: 8px; }
        html::-webkit-scrollbar-track { background: transparent; }
        html::-webkit-scrollbar-thumb {
          background: var(--color-border-overlay);
          border-radius: 9999px;
          border: 2px solid var(--color-background);
          background-clip: padding-box;
        }
        html::-webkit-scrollbar-thumb:hover { background: var(--color-theme-orange); }
        .bracket-scrollbar-hidden::-webkit-scrollbar { display: none; }
        .bracket-scrollbar-hidden { scrollbar-width: none; -ms-overflow-style: none; }
        .bracket-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .bracket-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .bracket-scrollbar::-webkit-scrollbar-thumb {
          background: var(--color-border-overlay);
          border-radius: 9999px;
          border: 1px solid transparent;
          background-clip: padding-box;
        }
        .bracket-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--color-theme-orange); }
        .bracket-scrollbar { scrollbar-width: thin; scrollbar-color: var(--color-border-overlay) transparent; }
      `}</style>

      <div className="max-w-[1600px] mx-auto mt-2 md:my-4 flex flex-col px-8 md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-overlay pb-6">
        <div>
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] font-label-mono text-theme-orange">
            <Trophy className="w-3.5 h-3.5" />
            {eyebrowLabel}
          </span>
          <h1 className="font-headline-lg font-bold text-3xl md:text-4xl text-on-surface mt-1.5">{title}</h1>
        </div>
        <div className="flex items-center gap-4 bg-surface-container-low/70 backdrop-blur-xl px-4 py-2.5 rounded-xl border border-border-overlay">
          <div className="flex items-center gap-2">
            <span className="tally bg-[radial-gradient(circle_at_35%_30%,#ff9d94,var(--color-status-live)_65%)] shadow-[0_0_6px_1px_rgba(255,180,171,0.55)] animate-[connPulse_1.4s_ease-in-out_infinite]" />
            <span className="font-label-mono text-[10px] uppercase tracking-widest text-on-surface-variant">{liveLabel}</span>
          </div>
          <div className="w-px h-4 bg-border-overlay hidden md:block" />
          {selectedTeamCode ? (
            <button
              type="button"
              onClick={() => setSelectedTeamCode(null)}
              className="font-label-mono text-[11px] font-bold uppercase tracking-wide text-theme-orange hover:opacity-80 hidden md:block"
            >
              Tracing {selectedTeamCode} · click to release
            </button>
          ) : (
            <p className="font-body-md text-[11px] text-outline hidden md:block">{helperText}</p>
          )}
        </div>
      </div>

      <div className="hidden md:block max-w-[1600px] mx-auto relative">
        <div className="w-full overflow-x-hidden">
          {useMirroredLayout ? (
            <div ref={desktopContainerRef} className="relative flex items-start gap-0 w-full pb-6">
              {finalCenter && logoSrc && (
                <div
                  className="absolute pointer-events-none z-0 flex justify-center items-center"
                  style={{
                    left: finalCenter.x,
                    top: finalCenter.y,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <img
                    src={logoSrc}
                    alt=""
                    className="w-[280px] md:w-[450px] lg:w-[600px] max-w-none h-auto object-contain opacity-30"
                  />
                </div>
              )}
              {nonFinalRounds.map((round, i) => {
                const growWeight = getRoundGrowWeight(i, "left");
                const bleedLeft = i === 2 ? "-85%" : i === 3 ? "-85%" : undefined;
                const innerBleedLeft = i === 2 ? "-60%" : i === 3 ? "-60%" : undefined;

                return (
                  <BracketColumn
                    key={`L-${round.id}`}
                    roundName={round.name}
                    matches={leftSideMatches[i]}
                    centerYByMatchId={matchCenterY}
                    getRef={getRef}
                    hoveredTeamCode={activeTeamCode}
                    setHoveredTeamCode={setHoveredTeamCode}
                    onTeamClick={handleTeamClick}
                    pinnedTeamCode={selectedTeamCode}
                    onRecordResult={onRecordResult}
                    isLeaf={i === 0}
                    leafColumnRef={i === 0 ? (el) => (leafColumnRef.current = el) : undefined}
                    growWeight={growWeight}
                    bleedLeft={bleedLeft}
                    innerBleedLeft={innerBleedLeft}
                  />
                );
              })}
              <BracketColumn
                roundName={finalRound.name}
                matches={finalRound.matches}
                centerYByMatchId={matchCenterY}
                getRef={getRef}
                hoveredTeamCode={activeTeamCode}
                setHoveredTeamCode={setHoveredTeamCode}
                onTeamClick={handleTeamClick}
                pinnedTeamCode={selectedTeamCode}
                onRecordResult={onRecordResult}
                growWeight={getRoundGrowWeight(nonFinalRounds.length, "final")}
              />
              {[...nonFinalRounds].reverse().map((round, revIdx) => {
                const i = nonFinalRounds.length - 1 - revIdx;
                const growWeight = getRoundGrowWeight(i, "right");
                const bleedRight = i === 2 ? "-85%" : i === 3 ? "-85%" : undefined;
                const innerBleedRight = i === 2 ? "-60%" : i === 3 ? "-60%" : undefined;

                return (
                  <BracketColumn
                    key={`R-${round.id}`}
                    roundName={round.name}
                    matches={rightSideMatches[i]}
                    centerYByMatchId={matchCenterY}
                    getRef={getRef}
                    hoveredTeamCode={activeTeamCode}
                    setHoveredTeamCode={setHoveredTeamCode}
                    onTeamClick={handleTeamClick}
                    pinnedTeamCode={selectedTeamCode}
                    onRecordResult={onRecordResult}
                    isLeaf={i === 0}
                    growWeight={growWeight}
                    bleedRight={bleedRight}
                    innerBleedRight={innerBleedRight}
                  />
                );
              })}
              <svg className="absolute inset-0 pointer-events-none z-0" width="100%" height="100%">
                {connectors.map((c) => {
                  const active = c.teamCode && c.teamCode === activeTeamCode;
                  return (
                    <path
                      key={c.id}
                      d={c.d}
                      fill="none"
                      stroke={active ? "var(--color-theme-orange)" : "var(--color-border-overlay)"}
                      strokeWidth={active ? 3 : 1.5}
                      strokeOpacity={active ? 1 : 0.6}
                      style={{
                        transition: "stroke 0.3s ease-in-out, stroke-width 0.3s ease-in-out, stroke-opacity 0.3s ease-in-out",
                        filter: active ? "drop-shadow(0 0 8px rgba(201, 151, 31, 0.6))" : "none",
                      }}
                    />
                  );
                })}
              </svg>
            </div>
          ) : (
            <div ref={desktopContainerRef} className="relative flex items-start gap-0 w-full pb-6">
              {finalCenter && logoSrc && (
                <div
                  className="absolute pointer-events-none z-0 flex justify-center items-center"
                  style={{
                    left: finalCenter.x,
                    top: finalCenter.y,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <img
                    src={logoSrc}
                    alt=""
                    className="w-[280px] md:w-[450px] lg:w-[600px] max-w-none h-auto object-contain opacity-10"
                  />
                </div>
              )}
              {rounds.map((round, i) => {
                const growWeight = getRoundGrowWeight(i, "left");
                const bleedLeft = i === 2 ? "-85%" : i === 3 ? "-65%" : undefined;
                const innerBleedLeft = i === 2 ? "-20%" : i === 3 ? "-20%" : undefined;

                return (
                  <BracketColumn
                    key={round.id}
                    roundName={round.name}
                    matches={round.matches}
                    centerYByMatchId={matchCenterY}
                    getRef={getRef}
                    hoveredTeamCode={activeTeamCode}
                    setHoveredTeamCode={setHoveredTeamCode}
                    onTeamClick={handleTeamClick}
                    pinnedTeamCode={selectedTeamCode}
                    onRecordResult={onRecordResult}
                    isLeaf={i === 0}
                    leafColumnRef={i === 0 ? (el) => (leafColumnRef.current = el) : undefined}
                    growWeight={growWeight}
                    bleedLeft={bleedLeft}
                    innerBleedLeft={innerBleedLeft}
                  />
                );
              })}
              <svg className="absolute inset-0 pointer-events-none z-0" width="100%" height="100%">
                {connectors.map((c) => {
                  const active = c.teamCode && c.teamCode === activeTeamCode;
                  return (
                    <path
                      key={c.id}
                      d={c.d}
                      fill="none"
                      stroke={active ? "var(--color-theme-orange)" : "var(--color-border-overlay)"}
                      strokeWidth={active ? 3 : 1.5}
                      strokeOpacity={active ? 1 : 0.6}
                      style={{
                        transition: "stroke 0.3s ease-in-out, stroke-width 0.3s ease-in-out, stroke-opacity 0.3s ease-in-out",
                        filter: active ? "drop-shadow(0 0 8px rgba(201, 151, 31, 0.6))" : "none",
                      }}
                    />
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </div>

      <div className="md:hidden max-w-xl mx-auto flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToRound(mobileRound - 1)}
            disabled={mobileRound === 0}
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-surface-container-low border border-border-overlay text-outline disabled:opacity-30 active:scale-95 transition-all"
            aria-label="Previous stage"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 flex items-center justify-center gap-1.5 overflow-x-auto bracket-scrollbar-hidden">
            {rounds.map((round, i) => (
              <button
                key={round.id}
                type="button"
                onClick={() => goToRound(i)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest font-label-mono border transition-colors ${
                  i === mobileRound
                    ? "bg-theme-orange border-theme-orange text-on-primary"
                    : "bg-surface-container-low border-border-overlay text-outline"
                }`}
              >
                {round.shortName}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => goToRound(mobileRound + 1)}
            disabled={mobileRound === rounds.length - 1}
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-surface-container-low border border-border-overlay text-outline disabled:opacity-30 active:scale-95 transition-all"
            aria-label="Next stage"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {selectedTeamCode && (
          <button
            type="button"
            onClick={() => setSelectedTeamCode(null)}
            className="self-center font-label-mono text-[10px] font-bold uppercase tracking-wide text-theme-orange hover:opacity-80"
          >
            Tracing {selectedTeamCode} · tap to release
          </button>
        )}
        <div
          ref={mobileScrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory bracket-scrollbar-hidden"
          style={{ touchAction: "pan-x" }}
        >
          {rounds.map((round) => (
            <div key={round.id} className="w-full flex-shrink-0 snap-start">
              <h2 className="font-label-mono text-[11px] font-black uppercase tracking-widest text-on-surface-variant text-center mb-3">
                {round.name}
              </h2>
              <div
                ref={(el) => {
                  mobileVerticalRefs.current[round.id] = el;
                }}
                className="h-[65vh] overflow-y-auto bracket-scrollbar"
                style={{ touchAction: "pan-y", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
              >
                <div className="min-h-full flex flex-col justify-center gap-3 py-2 px-1">
                  {round.matches.map((match) => (
                    <div key={match.id} className="w-full relative">
                      {round.id === finalRound.id && logoSrc && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none -z-10 w-full flex justify-center items-center">
                          <img
                            src={logoSrc}
                            alt=""
                            className="w-[250px] md:w-[350px] max-w-none h-auto object-contain opacity-10"
                          />
                        </div>
                      )}
                      <MatchResultCard
                        match={match}
                        onRecordResult={onRecordResult}
                        hoveredTeamCode={activeTeamCode}
                        onTeamHover={setHoveredTeamCode}
                        onTeamClick={handleTeamClick}
                        pinnedTeamCode={selectedTeamCode}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}