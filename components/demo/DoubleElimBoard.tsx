// File: components/tournament/DoubleElimBoard.tsx
"use client";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Trophy, RotateCcw, Award } from "lucide-react";
import type { MatchNode, Round } from "@/components/tournament/TournamentBracket";
import type { DoubleElimData } from "@/lib/tournament/doubleElim";
import MatchResultCard from "./MatchResultCard";

type RecordFn = (matchId: string, winner: "A" | "B", scoreA: number, scoreB: number) => void;

export interface DoubleElimBoardProps {
  data: DoubleElimData;
  onRecordResult: RecordFn;
  title?: string;
  eyebrowLabel?: string;
  helperText?: string;
  logoSrc?: string;
  className?: string;
  onActiveTeamChange?: (teamCode: string | null) => void;
  /** Skips the top eyebrow/title/helper-text block entirely. For embedding
   *  this board inside a page that already has its own compact toolbar
   *  covering the same info (e.g. the bracket sandbox) — avoids showing
   *  the same "Double Elimination" framing twice. Everything else
   *  (canvas, connectors, mobile view) renders unchanged. Defaults to
   *  false so every existing usage keeps its header exactly as before. */
  hideHeader?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Layout constants — same idea as TournamentBracket's geometry, just */
/*  fixed-width columns instead of flex-grow (double-elim's losers    */
/*  bracket has an irregular round count, so fixed columns + a        */
/*  horizontal scroll container is the simplest thing that stays      */
/*  correct for any bracket shape).                                   */
/* ------------------------------------------------------------------ */
const COL_W = 250;
const COL_GAP = 70;
const CARD_GAP = 28;
const HEADER_H = 34;
// Reserved vertical space for each bracket's section header (the
// "Winners bracket" / "Losers bracket" banner). Bumped up from the old
// thin-label height to fit the banner's padding comfortably.
const LABEL_H = 44;
const ROW_GAP = 56;
// How far the section-header banner stops short of the canvas's own
// right edge, so it never looks like it's touching/running into the
// border of the scroll area.
const HEADER_RIGHT_PAD = 32;

// Reserved strip on the left of the whole canvas so "drop into losers
// bracket" connectors — which travel a long way straight down, often
// through the same column x-range their own cards occupy — have an
// always-empty lane to travel through instead of cutting across cards.
// NOTE: kept at its original value on purpose — changing this shifts
// every column in the board, which is not what we want here.
const LEFT_MARGIN = 40;

function colX(i: number) {
  return LEFT_MARGIN + i * (COL_W + COL_GAP);
}

/** The x-coordinate of the empty gap immediately before column i. Always
 *  clear of cards, since cards only ever occupy [colX(i), colX(i)+COL_W]. */
function laneXBefore(i: number) {
  return colX(i) - COL_GAP / 2;
}

/** Connects two cards in different columns via a rounded elbow whose
 *  vertical run sits at the midpoint between the source's right edge and
 *  the target's left edge — i.e. always inside the gap between the two
 *  columns, never inside either card's own column span. */
function elbowPath(x1: number, y1: number, x2: number, y2: number, radius = 10): string {
  const midX = (x1 + x2) / 2;
  if (Math.abs(y2 - y1) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const dir = y2 > y1 ? 1 : -1;
  const r = Math.max(0, Math.min(radius, Math.abs(y2 - y1) / 2, Math.abs(midX - x1)));
  return `M ${x1} ${y1} L ${midX - r} ${y1} Q ${midX} ${y1} ${midX} ${y1 + r * dir} L ${midX} ${
    y2 - r * dir
  } Q ${midX} ${y2} ${midX + r} ${y2} L ${x2} ${y2}`;
}

/** Routes a connector out to a fixed vertical lane (always an empty gap)
 *  before dropping/rising to the target's row, then back in — used only
 *  for the "loser of this winners-bracket match drops here" links, which
 *  can span a huge vertical distance that would otherwise cut straight
 *  through every card stacked in between. */
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

/** Measures a row's leaf-round cards from the DOM, then computes every
 *  later round's vertical center as the average of its feeders' centers —
 *  looked up by match id rather than assumed index math, so it works
 *  regardless of how irregular the losers-bracket round shapes are. */
function computeRowCenters(
  rounds: Round[],
  rowEl: HTMLDivElement,
  cardEls: Record<string, HTMLDivElement | null>
): Record<string, number> {
  const rowRect = rowEl.getBoundingClientRect();
  const centers: Record<string, number> = {};
  if (!rounds.length) return centers;
  for (const m of rounds[0].matches) {
    const el = cardEls[m.id];
    if (!el) return centers;
    const r = el.getBoundingClientRect();
    if (r.height === 0) return centers;
    centers[m.id] = r.top - rowRect.top + r.height / 2;
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
    }
  }
  return centers;
}

interface Connector {
  id: string;
  d: string;
  teamCode?: string;
}

/** A section header for a bracket row: a tinted banner block with a
 *  colored left accent border, icon, and label — giving each section a
 *  clear, self-contained visual boundary instead of a thin floating
 *  label. Width is expected to already be padded in from the canvas's
 *  right edge by the caller (see HEADER_RIGHT_PAD) so the banner never
 *  looks like it's touching the edge of the scroll area. */
function SectionHeader({
  icon,
  label,
  textClass,
  bgClass,
  borderClass,
  accentBarClass,
  top,
  width,
}: {
  icon: ReactNode;
  label: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  accentBarClass: string;
  top: number;
  width: number;
}) {
  return (
    <div
      className={`absolute left-8 flex items-stretch rounded-lg border ${bgClass} ${borderClass} shadow-sm overflow-hidden`}
      style={{ top, width, height: 32 }}
    >
      <div className={`w-1 shrink-0 ${accentBarClass}`} />
      <span
        className={`flex items-center gap-2 px-4 text-[10px] font-black uppercase tracking-widest font-label-mono ${textClass}`}
      >
        {icon}
        {label}
      </span>
    </div>
  );
}

export default function DoubleElimBoard({
  data,
  onRecordResult,
  title = "Double Elimination Bracket",
  eyebrowLabel = "Knockout · Double Elimination",
  helperText = "Hover or click a team to trace their path.",
  logoSrc,
  className = "",
  onActiveTeamChange,
  hideHeader = false,
}: DoubleElimBoardProps) {
  const [hoveredTeamCode, setHoveredTeamCode] = useState<string | null>(null);
  const [selectedTeamCode, setSelectedTeamCode] = useState<string | null>(null);
  const activeTeamCode = hoveredTeamCode || selectedTeamCode;

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

  // Pass 1: measure leaf cards, compute every match's row-relative center.
  useLayoutEffect(() => {
    function recompute() {
      if (!wbRowRef.current || !lbRowRef.current) return;
      const wbCenters = computeRowCenters(data.winners, wbRowRef.current, cardEls.current);
      const lbCenters = computeRowCenters(data.losers, lbRowRef.current, cardEls.current);
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
  }, [data]);

  // Pass 2: once cards are actually positioned, measure real rects to place
  // the grand final (centered between both finals) and draw every connector.
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
        const gfEl = cardEls.current["GF"];
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
  }, [matchCenterY, wbLeafHeight, lbLeafHeight, data]);

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
              <MatchResultCard
                match={m}
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
                <MatchResultCard
                  match={m}
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
      {!hideHeader && (
        <div className="max-w-[1600px] mx-auto mt-2 md:my-4 flex flex-col px-8 md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-overlay pb-6">
          <div>
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] font-label-mono text-theme-orange">
              <Trophy className="w-3.5 h-3.5" />
              {eyebrowLabel}
            </span>
            <h1 className="font-headline-lg font-bold text-3xl md:text-4xl text-on-surface mt-1.5">{title}</h1>
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
      )}

      {/* Desktop: measured canvas with real connector lines */}
      <div className="hidden md:block max-w-[1600px] mx-auto relative">
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
                className="absolute pointer-events-none opacity-15 w-[300px] h-auto object-contain"
                style={{ left: gfX + COL_W / 2, top: gfCenterY, transform: "translate(-50%, -50%)" }}
              />
            )}

            <SectionHeader
              icon={<Trophy className="w-3.5 h-3.5" />}
              label="Winners bracket · still unbeaten"
              textClass="text-emerald-400"
              bgClass="bg-emerald-500/10"
              borderClass="border-emerald-500/25"
              accentBarClass="bg-emerald-400"
              top={0}
              width={Math.max(0, totalWidth - HEADER_RIGHT_PAD)}
            />
            {renderRow(data.winners, wbRowRef, wbLeafColRef, wbRowTop, wbRowHeight)}

            <SectionHeader
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              label="Losers bracket · one more loss and you're out"
              textClass="text-orange-400"
              bgClass="bg-orange-500/10"
              borderClass="border-orange-500/25"
              accentBarClass="bg-orange-400"
              top={lbLabelTop}
              width={Math.max(0, totalWidth - HEADER_RIGHT_PAD)}
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
                  <MatchResultCard
                    match={data.grandFinal}
                    onRecordResult={onRecordResult}
                    cardRef={getRef("GF")}
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
                    <MatchResultCard
                      match={data.bracketReset}
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
      </div>

      {/* Mobile: simple stacked sections, no absolute geometry */}
      <div className="md:hidden max-w-xl mx-auto flex flex-col gap-8 px-2">
        <MobileSection title="Winners bracket" rounds={data.winners} onRecordResult={onRecordResult} />
        <MobileSection title="Losers bracket" rounds={data.losers} onRecordResult={onRecordResult} />
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest font-label-mono text-theme-orange mb-3">
            Grand final
          </p>
          <div className="flex flex-col gap-4">
            <MatchResultCard match={data.grandFinal} onRecordResult={onRecordResult} />
            {data.bracketReset && (
              <>
                <p className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline text-center -mt-1">
                  Bracket reset
                </p>
                <MatchResultCard match={data.bracketReset} onRecordResult={onRecordResult} />
              </>
            )}
          </div>
        </div>
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

function MobileSection({ title, rounds, onRecordResult }: { title: string; rounds: Round[]; onRecordResult: RecordFn }) {
  if (!rounds.length) return null;
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest font-label-mono text-on-surface-variant mb-3">{title}</p>
      <div className="flex gap-4 overflow-x-auto db-scroll pb-3">
        {rounds.map((round) => (
          <div key={round.id} className="min-w-[240px] flex flex-col items-center gap-3">
            <span className="inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest font-label-mono bg-surface-container-low border border-border-overlay text-on-surface-variant">
              {round.name}
            </span>
            <div className="w-full flex flex-col gap-4">
              {round.matches.map((m) => (
                <MatchResultCard key={m.id} match={m} onRecordResult={onRecordResult} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}