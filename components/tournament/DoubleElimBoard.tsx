// File: components/tournament/DoubleElimBoard.tsx
"use client";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Trophy, RotateCcw, Award } from "lucide-react";
import type { MatchNode, Round } from "@/components/tournament/TournamentBracket";
import type { DoubleElimData } from "@/lib/tournament/doubleElim";
import MatchResultCard from "./MatchResultCard";
import MatchResultCardStatic from "./MatchResultCardStatic";

type RecordFn = (matchId: string, winner: "A" | "B", scoreA: number, scoreB: number) => void | Promise<{ ok: boolean; error?: string } | void>;

export interface DoubleElimBoardProps {
  data: DoubleElimData;
  onRecordResult?: RecordFn;
  editable?: boolean;
  title?: string;
  eyebrowLabel?: string;
  helperText?: string;
  logoSrc?: string;
  className?: string;
  onActiveTeamChange?: (teamCode: string | null) => void;
}

/* ------------------------------------------------------------------ */
/*  Layout constants. COL_W / COL_GAP / CARD_GAP / LEFT_MARGIN / ROW_GAP */
/*  are all computed per-render inside the component now (not fixed    */
/*  module constants) because they need to scale down for mobile      */
/*  viewports — previously mobile got a totally separate, geometry-    */
/*  free rendering path (MobileSection) which is why no connector      */
/*  lines ever appeared there. Now mobile reuses the exact same        */
/*  measured canvas as desktop, just at smaller scale, inside the      */
/*  same horizontally-scrollable container.                            */
/* ------------------------------------------------------------------ */
const HEADER_H = 34;
const LABEL_H = 44;
const HEADER_RIGHT_PAD = 32;

function elbowPath(x1: number, y1: number, x2: number, y2: number, radius = 10): string {
  const midX = (x1 + x2) / 2;
  if (Math.abs(y2 - y1) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const dir = y2 > y1 ? 1 : -1;
  const r = Math.max(0, Math.min(radius, Math.abs(y2 - y1) / 2, Math.abs(midX - x1)));
  return `M ${x1} ${y1} L ${midX - r} ${y1} Q ${midX} ${y1} ${midX} ${y1 + r * dir} L ${midX} ${
    y2 - r * dir
  } Q ${midX} ${y2} ${midX + r} ${y2} L ${x2} ${y2}`;
}

function lanePath(x1: number, y1: number, x2: number, y2: number, laneX: number, radius = 10): string {
  const dir1 = laneX >= x1 ? 1 : -1;
  const vdir = y2 >= y1 ? 1 : -1;
  const dir2 = x2 >= laneX ? 1 : -1;
  return `M ${x1} ${y1} L ${laneX - radius * dir1} ${y1} Q ${laneX} ${y1} ${laneX} ${
    y1 + radius * vdir
  } L ${laneX} ${y2 - radius * vdir} Q ${laneX} ${y2} ${laneX + radius * dir2} ${y2} L ${x2} ${y2}`;
}

function topEntryPath(x1: number, y1: number, x2: number, y2: number, radius = 10): string {
  if (Math.abs(x2 - x1) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const dir = y2 > y1 ? 1 : -1;
  const sign = x2 > x1 ? 1 : -1;
  const r = Math.max(0, Math.min(radius, Math.abs(x2 - x1), Math.abs(y2 - y1)));
  return `M ${x1} ${y1} L ${x2 - r * sign} ${y1} Q ${x2} ${y1} ${x2} ${y1 + r * dir} L ${x2} ${y2}`;
}

function stripPrefix(label: string | null): string | null {
  return label ? label.replace(/^[WL]:/, "") : null;
}

function computeRowCenters(
  rounds: Round[],
  rowEl: HTMLDivElement,
  cardEls: Record<string, HTMLDivElement | null>,
  gap: number
): Record<string, number> {
  const rowRect = rowEl.getBoundingClientRect();
  const centers: Record<string, number> = {};
  const heights: Record<string, number> = {};
  if (!rounds.length) return centers;

  let fallbackHeight = 90;
  for (const m of rounds[0].matches) {
    const el = cardEls[m.id];
    if (!el) return centers;
    const r = el.getBoundingClientRect();
    if (r.height === 0) return centers;
    centers[m.id] = r.top - rowRect.top + r.height / 2;
    heights[m.id] = r.height;
    fallbackHeight = r.height;
  }

  for (let ri = 1; ri < rounds.length; ri++) {
    for (const m of rounds[ri].matches) {
      const feederYs = [m.aFrom, m.bFrom]
        .map(stripPrefix)
        .filter((id): id is string => !!id && centers[id] !== undefined)
        .map((id) => centers[id]);
      centers[m.id] = feederYs.length
        ? feederYs.reduce((a, b) => a + b, 0) / feederYs.length
        : centers[rounds[ri - 1].matches[0]?.id] ?? 0;

      const el = cardEls[m.id];
      const h = el?.getBoundingClientRect().height;
      heights[m.id] = h && h > 0 ? h : fallbackHeight;
    }

    // Averaging feeder centers can pull two matches in the SAME round
    // closer together than their card heights allow — walk the round
    // top-to-bottom and push any overlapping card down just enough to
    // clear the one above it.
    const ordered = rounds[ri].matches;
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const cur = ordered[i];
      const minGap = heights[prev.id] / 2 + heights[cur.id] / 2 + gap;
      if (centers[cur.id] - centers[prev.id] < minGap) {
        centers[cur.id] = centers[prev.id] + minGap;
      }
    }
  }
  return centers;
}

interface Connector {
  id: string;
  d: string;
  teamCode?: string;
}

function SectionHeader({
  icon,
  label,
  textClass,
  bgClass,
  borderClass,
  accentBarClass,
  top,
  width,
  leftInset,
}: {
  icon: ReactNode;
  label: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  accentBarClass: string;
  top: number;
  width: number;
  leftInset: number;
}) {
  return (
    <div
      className={`absolute flex items-stretch rounded-lg border ${bgClass} ${borderClass} shadow-sm overflow-hidden`}
      style={{ top, left: leftInset, width, height: 32 }}
    >
      <div className={`w-1 shrink-0 ${accentBarClass}`} />
      <span
        className={`flex items-center gap-2 px-4 text-[10px] font-black uppercase tracking-widest font-label-mono whitespace-nowrap ${textClass}`}
      >
        {icon}
        {label}
      </span>
    </div>
  );
}

function MatchCardFor({
  editable,
  onRecordResult,
  ...rest
}: {
  match: MatchNode;
  editable?: boolean;
  onRecordResult?: RecordFn;
  cardRef?: (el: HTMLDivElement | null) => void;
  hoveredTeamCode?: string | null;
  onTeamHover?: (code: string | null) => void;
  onTeamClick?: (code: string) => void;
  pinnedTeamCode?: string | null;
}) {
  if (editable) {
    return <MatchResultCard {...rest} onRecordResult={onRecordResult as (matchId: string, winner: "A" | "B", scoreA: number, scoreB: number) => void} />;
  }
  return <MatchResultCardStatic {...rest} />;
}

export default function DoubleElimBoard({
  data,
  onRecordResult,
  editable = false,
  title = "Double Elimination Bracket",
  eyebrowLabel = "Knockout · Double Elimination",
  helperText = "Hover or click a team to trace their path.",
  logoSrc,
  className = "",
  onActiveTeamChange,
}: DoubleElimBoardProps) {
  const [hoveredTeamCode, setHoveredTeamCode] = useState<string | null>(null);
  const [selectedTeamCode, setSelectedTeamCode] = useState<string | null>(null);
  const activeTeamCode = hoveredTeamCode || selectedTeamCode;

  // Track viewport size so the SAME measured canvas can scale down for
  // mobile instead of falling back to a geometry-free stacked list.
  // This is what makes connector lines actually show up on phones.
  const [isMobile, setIsMobile] = useState(false);
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const totalCols = Math.max(data.winners.length, data.losers.length) + 1;
  const spacious = totalCols <= 3;

  const COL_W = isMobile ? (spacious ? 210 : 175) : spacious ? 340 : 250;
  const COL_GAP = isMobile ? (spacious ? 60 : 36) : spacious ? 160 : 70;
  const CARD_GAP = isMobile ? (spacious ? 20 : 14) : spacious ? 40 : 50; // was 28
  const LEFT_MARGIN = isMobile ? 20 : 40;
  const ROW_GAP = isMobile ? 80 : 160;

  function colX(i: number) {
    return LEFT_MARGIN + i * (COL_W + COL_GAP);
  }

  function laneXBefore(i: number) {
    return colX(i) - COL_GAP / 2;
  }

  function handleTeamClick(code: string) {
    setSelectedTeamCode((prev) => (prev === code ? null : code));
  }

  const masterRef = useRef<HTMLDivElement>(null);
  const wbRowRef = useRef<HTMLDivElement>(null);
  const lbRowRef = useRef<HTMLDivElement>(null);
  const wbLeafColRef = useRef<HTMLDivElement>(null);
  const lbLeafColRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef<Record<string, HTMLDivElement | null>>({});
  const refCache = useRef<Record<string, (el: HTMLDivElement | null) => void>>({});

  const [matchCenterY, setMatchCenterY] = useState<Record<string, number>>({});
  const [wbLeafHeight, setWbLeafHeight] = useState(400);
  const [lbLeafHeight, setLbLeafHeight] = useState(400);
  const [gfCenterY, setGfCenterY] = useState<number | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);

  function getRef(id: string) {
    if (!refCache.current[id]) {
      refCache.current[id] = (el) => {
        cardEls.current[id] = el;
      };
    }
    return refCache.current[id];
  }

  useLayoutEffect(() => {
    function recompute() {
      if (!wbRowRef.current || !lbRowRef.current) return;
      const wbCenters = computeRowCenters(data.winners, wbRowRef.current, cardEls.current, CARD_GAP);
      const lbCenters = computeRowCenters(data.losers, lbRowRef.current, cardEls.current, CARD_GAP);
      setMatchCenterY({ ...wbCenters, ...lbCenters });

      const wbH = wbLeafColRef.current?.scrollHeight;
      if (wbH && Math.abs(wbH - wbLeafHeight) > 1) setWbLeafHeight(wbH);
      const lbH = lbLeafColRef.current?.scrollHeight;
      if (lbH && Math.abs(lbH - lbLeafHeight) > 1) setLbLeafHeight(lbH);
    }
    recompute();
    const raf = requestAnimationFrame(recompute);
    const ro = new ResizeObserver(recompute);
    if (wbRowRef.current) ro.observe(wbRowRef.current);
    if (lbRowRef.current) ro.observe(lbRowRef.current);
    window.addEventListener("resize", recompute);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isMobile]);

  useLayoutEffect(() => {
    function recomputeFinal() {
      const masterEl = masterRef.current;
      if (!masterEl) return;
      const masterRect = masterEl.getBoundingClientRect();

      const wbFinalId = data.winners[data.winners.length - 1]?.matches[0]?.id;
      const lbFinalId = data.losers.length ? data.losers[data.losers.length - 1].matches[0].id : wbFinalId;
      const wbFinalEl = wbFinalId ? cardEls.current[wbFinalId] : null;
      const lbFinalEl = lbFinalId ? cardEls.current[lbFinalId] : null;
      if (!wbFinalEl) return;

      const wbR = wbFinalEl.getBoundingClientRect();
      const wbY = wbR.top + wbR.height / 2 - masterRect.top;
      let lbY = wbY;
      if (lbFinalEl && lbFinalId !== wbFinalId) {
        const lbR = lbFinalEl.getBoundingClientRect();
        lbY = lbR.top + lbR.height / 2 - masterRect.top;
      }
      setGfCenterY((wbY + lbY) / 2);

      const next: Connector[] = [];
      function addConnector(sourceId: string | null, target: MatchNode, slot: "A" | "B", laneX: number | null) {
        if (!sourceId) return;
        const sEl = cardEls.current[sourceId];
        const tEl = cardEls.current[target.id];
        if (!sEl || !tEl) return;
        const sR = sEl.getBoundingClientRect();
        const tR = tEl.getBoundingClientRect();
        if (sR.width === 0 || tR.width === 0) return;
        const team = slot === "A" ? target.teamA : target.teamB;

        if (laneX != null) {
          const sX = sR.left - masterRect.left;
          const sY = sR.top - masterRect.top + sR.height * 0.7;
          const tX = tR.left - masterRect.left;
          const tY = (slot === "A" ? tR.top + tR.height * 0.3 : tR.bottom - tR.height * 0.3) - masterRect.top;
          next.push({ id: `${target.id}-${slot}`, d: lanePath(sX, sY, tX, tY, laneX), teamCode: team?.code });
          return;
        }

        const sX = sR.right - masterRect.left;
        const sY = sR.top + sR.height / 2 - masterRect.top;
        const tX = tR.left - masterRect.left;
        const tY = (slot === "A" ? tR.top + tR.height * 0.3 : tR.bottom - tR.height * 0.3) - masterRect.top;
        next.push({ id: `${target.id}-${slot}`, d: elbowPath(sX, sY, tX, tY), teamCode: team?.code });
      }

      data.winners.forEach((round) => {
        for (const m of round.matches) {
          addConnector(stripPrefix(m.aFrom), m, "A", null);
          addConnector(stripPrefix(m.bFrom), m, "B", null);
        }
      });
      data.losers.forEach((round, ri) => {
        for (const m of round.matches) {
          const aIsDrop = m.aFrom?.startsWith("L:") ?? false;
          const bIsDrop = m.bFrom?.startsWith("L:") ?? false;
          addConnector(stripPrefix(m.aFrom), m, "A", aIsDrop ? laneXBefore(ri) : null);
          addConnector(stripPrefix(m.bFrom), m, "B", bIsDrop ? laneXBefore(ri) : null);
        }
      });
      addConnector(wbFinalId ?? null, data.grandFinal, "A", null);
      addConnector(lbFinalId ?? null, data.grandFinal, "B", null);

      if (data.bracketReset) {
        const gfEl = cardEls.current[data.grandFinal.id];
        const rEl = cardEls.current[data.bracketReset.id];
        if (gfEl && rEl) {
          const gR = gfEl.getBoundingClientRect();
          const rR = rEl.getBoundingClientRect();
          next.push({
            id: "reset-link",
            d: topEntryPath(
              gR.left + gR.width / 2 - masterRect.left,
              gR.bottom - masterRect.top,
              rR.left + rR.width / 2 - masterRect.left,
              rR.top - masterRect.top
            ),
          });
        }
      }
      setConnectors(next);
    }
    recomputeFinal();
    const raf = requestAnimationFrame(recomputeFinal);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchCenterY, wbLeafHeight, lbLeafHeight, data, isMobile]);

  useLayoutEffect(() => {
    onActiveTeamChange?.(activeTeamCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeamCode]);

  const wbRowHeight = HEADER_H + wbLeafHeight;
  const lbRowHeight = HEADER_H + lbLeafHeight;
  const wbRowTop = LABEL_H + 8;
  const lbLabelTop = wbRowTop + wbRowHeight + ROW_GAP;
  const lbRowTop = lbLabelTop + LABEL_H + 8;
  const totalHeight = lbRowTop + lbRowHeight + 60;
  const gfX = colX(Math.max(data.winners.length, data.losers.length));
  const totalWidth = gfX + COL_W + 60;

  function renderRow(
    rounds: Round[],
    rowRef: RefObject<HTMLDivElement | null>,
    leafRef: RefObject<HTMLDivElement | null>,
    top: number,
    rowHeight: number
  ) {
    return (
      <div ref={rowRef} className="absolute left-0 right-0" style={{ top, height: rowHeight }}>
        {rounds.map((round, i) => (
          <div key={`h-${round.id}`} className="absolute text-center" style={{ left: colX(i), top: 0, width: COL_W }}>
            <span className="inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest font-label-mono bg-surface-container-low border border-border-overlay text-on-surface-variant shadow-lg truncate max-w-full">
              {round.name}
            </span>
          </div>
        ))}
        <div
          ref={leafRef}
          className="absolute flex flex-col"
          style={{ left: colX(0), top: HEADER_H, width: COL_W, gap: CARD_GAP }}
        >
          {rounds[0]?.matches.map((m) => (
            <div key={m.id} className="w-full">
              <MatchCardFor
                match={m}
                editable={editable}
                onRecordResult={onRecordResult}
                cardRef={getRef(m.id)}
                hoveredTeamCode={activeTeamCode}
                onTeamHover={setHoveredTeamCode}
                onTeamClick={handleTeamClick}
                pinnedTeamCode={selectedTeamCode}
              />
            </div>
          ))}
        </div>
        {rounds.slice(1).flatMap((round, ri) =>
          round.matches.map((m) => {
            const style: CSSProperties = {
              left: colX(ri + 1),
              top: matchCenterY[m.id] ?? 0,
              width: COL_W,
              transform: "translateY(-50%)",
            };
            return (
              <div key={m.id} className="absolute" style={style}>
                <MatchCardFor
                  match={m}
                  editable={editable}
                  onRecordResult={onRecordResult}
                  cardRef={getRef(m.id)}
                  hoveredTeamCode={activeTeamCode}
                  onTeamHover={setHoveredTeamCode}
                  onTeamClick={handleTeamClick}
                  pinnedTeamCode={selectedTeamCode}
                />
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full bg-background text-on-surface p-2 md:p-2 ${className}`}>
      <div className="max-w-[1600px] mx-auto mt-2 md:my-4 flex flex-col px-4 md:px-8 md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-overlay pb-6">
        <div>
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] font-label-mono text-theme-orange">
            <Trophy className="w-3.5 h-3.5" />
            {eyebrowLabel}
          </span>
          <h1 className="font-headline-lg font-bold text-2xl md:text-4xl text-on-surface mt-1.5">{title}</h1>
        </div>
        <div className="flex items-center gap-4 bg-surface-container-low/70 backdrop-blur-xl px-4 py-2.5 rounded-xl border border-border-overlay">
          {selectedTeamCode ? (
            <button
              type="button"
              onClick={() => setSelectedTeamCode(null)}
              className="font-label-mono text-[11px] font-bold uppercase tracking-wide text-theme-orange hover:opacity-80"
            >
              Tracing {selectedTeamCode} · click to release
            </button>
          ) : (
            <p className="font-body-md text-[11px] text-outline">{helperText}</p>
          )}
        </div>
      </div>

      {/* Single measured canvas for both desktop and mobile. Mobile just
          gets smaller COL_W/COL_GAP/CARD_GAP/LEFT_MARGIN/ROW_GAP values
          (computed above via isMobile) and relies on the same
          overflow-x-auto horizontal scroll to move between rounds. This
          is what makes connector lines show up on phones — there's now
          only one code path that draws them. */}
      <div className="max-w-[1600px] mx-auto relative px-2 md:px-0">
        <div className="db-scroll overflow-x-auto pb-6">
          <div ref={masterRef} className="relative" style={{ width: totalWidth, height: totalHeight, minWidth: "100%" }}>
            <svg className="absolute inset-0 pointer-events-none" width={totalWidth} height={totalHeight}>
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
                    strokeDasharray={c.id === "reset-link" ? "4 4" : undefined}
                    style={{
                      transition: "stroke 0.3s ease-in-out, stroke-width 0.3s ease-in-out, stroke-opacity 0.3s ease-in-out",
                      filter: active ? "drop-shadow(0 0 8px rgba(201, 151, 31, 0.6))" : "none",
                    }}
                  />
                );
              })}
            </svg>

            {gfCenterY != null && logoSrc && (
              <img
                src={logoSrc}
                alt=""
                className="absolute pointer-events-none opacity-30 w-[180px] md:w-[300px] h-auto object-contain"
                style={{ left: gfX + COL_W / 2, top: gfCenterY, transform: "translate(-50%, -50%)" }}
              />
            )}

            <SectionHeader
              icon={<Trophy className="w-3.5 h-3.5" />}
              label={isMobile ? "Winners bracket" : "Winners bracket · still unbeaten"}
              textClass="text-emerald-400"
              bgClass="bg-emerald-500/10"
              borderClass="border-emerald-500/25"
              accentBarClass="bg-emerald-400"
              top={0}
              leftInset={LEFT_MARGIN - (isMobile ? 12 : 32)}
              width={Math.max(0, totalWidth - HEADER_RIGHT_PAD - (LEFT_MARGIN - (isMobile ? 12 : 32)))}
            />
            {renderRow(data.winners, wbRowRef, wbLeafColRef, wbRowTop, wbRowHeight)}

            <SectionHeader
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              label={isMobile ? "Losers bracket" : "Losers bracket · one more loss and you're out"}
              textClass="text-orange-400"
              bgClass="bg-orange-500/10"
              borderClass="border-orange-500/25"
              accentBarClass="bg-orange-400"
              top={lbLabelTop}
              leftInset={LEFT_MARGIN - (isMobile ? 12 : 32)}
              width={Math.max(0, totalWidth - HEADER_RIGHT_PAD - (LEFT_MARGIN - (isMobile ? 12 : 32)))}
            />
            {renderRow(data.losers, lbRowRef, lbLeafColRef, lbRowTop, lbRowHeight)}

            {gfCenterY != null && (
              <div
                className="absolute flex flex-col gap-6"
                style={{ left: gfX, top: gfCenterY, width: COL_W, transform: "translateY(-50%)" }}
              >
                <div>
                  <p className="text-[9px] font-label-mono font-black uppercase tracking-widest text-theme-orange mb-2 text-center flex items-center justify-center gap-1.5">
                    <Award className="w-3 h-3" />
                    Grand final
                  </p>
                  <MatchCardFor
                    match={data.grandFinal}
                    editable={editable}
                    onRecordResult={onRecordResult}
                    cardRef={getRef(data.grandFinal.id)}
                    hoveredTeamCode={activeTeamCode}
                    onTeamHover={setHoveredTeamCode}
                    onTeamClick={handleTeamClick}
                    pinnedTeamCode={selectedTeamCode}
                  />
                </div>
                {data.bracketReset && (
                  <div>
                    <p className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline mb-2 text-center">
                      Bracket reset · decider
                    </p>
                    <MatchCardFor
                      match={data.bracketReset}
                      editable={editable}
                      onRecordResult={onRecordResult}
                      cardRef={getRef(data.bracketReset.id)}
                      hoveredTeamCode={activeTeamCode}
                      onTeamHover={setHoveredTeamCode}
                      onTeamClick={handleTeamClick}
                      pinnedTeamCode={selectedTeamCode}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {isMobile && (
          <p className="text-center text-[10px] font-label-mono uppercase tracking-widest text-outline mt-1">
            ← scroll to see all rounds →
          </p>
        )}
      </div>

      <style jsx global>{`
        html {
          scrollbar-width: thin;
          scrollbar-color: var(--color-border-overlay) transparent;
        }
        html::-webkit-scrollbar {
          width: 8px;
        }
        html::-webkit-scrollbar-track {
          background: transparent;
        }
        html::-webkit-scrollbar-thumb {
          background-color: var(--color-border-overlay);
          border-radius: 9999px;
        }
        html::-webkit-scrollbar-thumb:hover {
          background-color: var(--color-outline);
        }

        .db-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--color-border-overlay) transparent;
        }
        .db-scroll::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        .db-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .db-scroll::-webkit-scrollbar-thumb {
          background-color: var(--color-border-overlay);
          border-radius: 9999px;
        }
        .db-scroll::-webkit-scrollbar-thumb:hover {
          background-color: var(--color-outline);
        }
      `}</style>
    </div>
  );
}