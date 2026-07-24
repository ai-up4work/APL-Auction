"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Trophy, Tv, MapPin, CheckCircle2, Radio, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Public types — every piece of chart data flows through these      */
/* ------------------------------------------------------------------ */

export interface TeamNode {
  id: string;
  code: string;
  name: string;
  logo?: string;
  color: string;
  score?: number;
  isWinner?: boolean;
}

export interface MatchNode {
  id: string;
  label: string;
  status: "scheduled" | "live" | "completed";
  teamA: TeamNode | null;
  teamB: TeamNode | null;
  aFrom: string | null;
  bFrom: string | null;
  venue?: string;
  date?: string;
  time?: string;
}

export interface Round {
  id: number;
  name: string;
  shortName: string;
  matches: MatchNode[];
}

/* ------------------------------------------------------------------ */
/*  Component props — this is the entire surface for consumers        */
/* ------------------------------------------------------------------ */

export interface TournamentBracketProps {
  /** Full bracket data. rounds.length === number of levels in the bracket
   *  (Round of 32 -> ... -> Final). rounds[0] is the first round, the
   *  last entry must contain exactly one match (the Final). */
  rounds: Round[];
  /** Main heading shown in the header. */
  title?: string;
  /** Small uppercase label above the title (e.g. "Knockout Stage"). */
  eyebrowLabel?: string;
  /** Helper copy shown next to the live-match legend on desktop. */
  helperText?: string;
  /** Label for the live-match legend dot. */
  liveLabel?: string;
  /** Optional watermark/logo rendered behind the Final match. */
  logoSrc?: string;
  /** Extra classes applied to the outer wrapper. */
  className?: string;
  /** Called whenever the highlighted/selected team changes. */
  onActiveTeamChange?: (teamCode: string | null) => void;
  /** Turns on inline score/winner editing on every match card whose
   *  teams are both known (not TBD). When true, clicking a team row
   *  selects it as the winner for that card's editor instead of pinning
   *  the hover-trace highlight, and a score + Save row replaces the
   *  venue/date footer on editable cards. A match that already has a
   *  recorded result stays fully editable — the Save button just
   *  relabels to "Update result" so admins can correct a mistake. */
  editable?: boolean;
  /** Called when an admin saves a result from a card's inline editor.
   *  May return a Promise (optionally resolving to { ok, error }) — the
   *  card awaits it to drive its saving/loading state and surface any
   *  error inline. */
  onRecordResult?: (
    matchId: string,
    winner: "A" | "B",
    scoreA: number,
    scoreB: number
  ) => void | Promise<void | { ok: boolean; error?: string }>;
}

const GROW_WEIGHT = {
  full: 2,
  semi: 1.2,
  quarter: 1.1,
  compact: 0.9,
};

/* ------------------------------------------------------------------ */
/*  Geometry helpers                                                   */
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
/*  Presentational pieces                                              */
/* ------------------------------------------------------------------ */

function TeamRow({
  team,
  status,
  fromLabel,
  hoveredTeamCode,
  setHoveredTeamCode,
  onFromClick,
  onTeamClick,
  isPinned,
  rowRef,
  compact,
  scoreInput,
}: {
  team: TeamNode | null;
  status: MatchNode["status"];
  fromLabel: string | null;
  hoveredTeamCode: string | null;
  setHoveredTeamCode: (c: string | null) => void;
  onFromClick?: () => void;
  onTeamClick?: (code: string) => void;
  isPinned?: boolean;
  rowRef?: RefSetter;
  compact?: boolean;
  /** When present, renders an editable score box on this row instead of
   *  (or alongside, pre-completion) the read-only score/checkmark — used
   *  by MatchCard's inline editor. `value`/`onChange` drive a plain
   *  number input; `disabled` only reflects an in-flight save, never
   *  whether the match has already been completed — completed matches
   *  stay editable so a wrong score can be corrected. */
  scoreInput?: {
    value: string;
    onChange: (v: string) => void;
    disabled: boolean;
  };
}) {
  const isTBD = !team;
  const isHovered = team && hoveredTeamCode === team.code;
  const isAnyHovered = hoveredTeamCode !== null;
  return (
    <div
      ref={rowRef}
      onMouseEnter={() => team && setHoveredTeamCode(team.code)}
      onMouseLeave={() => setHoveredTeamCode(null)}
      onClick={() => team && onTeamClick?.(team.code)}
      className={`flex items-center justify-between gap-2 p-1 lg:p-1.5 rounded-lg relative transition-all duration-200 border ${
        isTBD ? "bg-background/40 border-dashed border-border-overlay text-outline" : "bg-surface-container border-border-overlay"
      } ${
        isHovered
          ? "scale-[1.02] border-theme-orange/40 bg-surface-container-high shadow-[0_0_20px_rgba(201,151,31,0.15)]"
          : isAnyHovered && !isHovered
          ? "opacity-30 blur-[0.5px]"
          : isPinned
          ? "border-theme-orange/50 bg-surface-container-high"
          : ""
      } ${!isTBD && onTeamClick ? "cursor-pointer" : ""}`}
    >
      {!isTBD && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md" style={{ backgroundColor: team.color }} />}
      <div className="flex items-center gap-2 lg:gap-3 pl-1.5 lg:pl-2 min-w-0">
        <span
          className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center shrink-0 bg-background overflow-hidden font-label-mono font-black text-[10px] lg:text-xs ${
            isTBD ? "border border-dashed border-outline/40" : ""
          }`}
        >
          {!isTBD ? (
            team.logo ? (
              <img src={team.logo} alt="" className="w-full h-full object-cover p-0.5" />
            ) : (
              <span style={{ color: team.color }}>{team.code}</span>
            )
          ) : (
            <span className="text-outline">?</span>
          )}
        </span>
        <div className="leading-none min-w-0">
          <p className={`font-label-mono font-bold text-xs uppercase tracking-wide truncate ${isTBD ? "text-outline font-medium" : "text-on-surface"}`}>
            {isTBD ? "To Be Determined" : team.name}
          </p>
          {!compact && (isTBD || fromLabel) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFromClick?.();
              }}
              disabled={!onFromClick}
              className="text-[9px] font-label-mono tracking-wider text-outline mt-0.5 flex items-center gap-1 disabled:cursor-default hover:text-theme-orange transition-colors"
            >
              {fromLabel ? (
                <>
                  <ChevronLeft className="w-2.5 h-2.5 text-theme-orange/70" />
                  {isTBD ? `Winner of ${fromLabel}` : `From ${fromLabel}`}
                </>
              ) : !isTBD ? (
                team.code
              ) : null}
            </button>
          )}
        </div>
      </div>
      {!isTBD && (
        <div className="flex items-center gap-1.5 pr-1 shrink-0">
          {isPinned && (
            <span className="hidden lg:inline-block text-[8px] font-label-mono font-black uppercase tracking-widest text-theme-orange border border-theme-orange/40 rounded px-1 py-0.5">
              Pinned
            </span>
          )}
          {scoreInput ? (
            <input
              type="number"
              min={0}
              value={scoreInput.value}
              disabled={scoreInput.disabled}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => scoreInput.onChange(e.target.value)}
              onKeyDown={(e) => {
                // Belt-and-suspenders alongside the clamp-on-change
                // upstream: block typing a minus sign outright so the
                // score can never even momentarily read negative.
                if (e.key === "-") e.preventDefault();
              }}
              className="w-12 shrink-0 text-center text-xs font-label-mono font-black rounded-md border border-border-overlay bg-background py-1 disabled:opacity-60"
            />
          ) : (
            status !== "scheduled" && (
              <div className="flex items-center gap-2 font-label-mono font-black text-sm">
                {team.isWinner && <CheckCircle2 className="w-3.5 h-3.5 text-theme-orange" strokeWidth={3} />}
                <span className={team.isWinner ? "text-theme-orange" : "text-outline"}>{team.score}</span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function MatchCard({
  match,
  hoveredTeamCode,
  setHoveredTeamCode,
  onFromClick,
  onTeamClick,
  pinnedTeamCode,
  getRef,
  compact,
  editable,
  onRecordResult,
}: {
  match: MatchNode;
  hoveredTeamCode: string | null;
  setHoveredTeamCode: (c: string | null) => void;
  onFromClick?: (label: string | null) => void;
  onTeamClick?: (code: string) => void;
  pinnedTeamCode?: string | null;
  getRef?: (key: string) => RefSetter;
  compact?: boolean;
  /** When true, and both teams are known (not TBD, not a bye), renders
   *  an editable score box directly in each team row — no separate
   *  winner-selection step. Winner is inferred from whichever score is
   *  higher; a tie shows explicit "X wins" buttons instead of a Save
   *  button, mirroring MatchResultCard's flow. Completed matches stay
   *  editable so a wrong result can be corrected later. */
  editable?: boolean;
  onRecordResult?: (
    matchId: string,
    winner: "A" | "B",
    scoreA: number,
    scoreB: number
  ) => void | Promise<void | { ok: boolean; error?: string }>;
}) {
  const isBye = match.teamA?.code === "BYE" || match.teamB?.code === "BYE";
  const bothAssigned = !!match.teamA && !!match.teamB;
  const playable = !!editable && bothAssigned && !isBye;
  // A completed match is no longer locked against edits — it just
  // changes the button copy ("Update result" instead of "Save result")
  // so admins know they're revising a saved score.
  const alreadyRecorded = match.status === "completed";

  const [scoreA, setScoreA] = useState(match.teamA?.score?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match.teamB?.score?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Re-sync local edit state whenever the underlying match result
  // changes (e.g. after a save round-trips through router.refresh()).
  useEffect(() => {
    setScoreA(match.teamA?.score?.toString() ?? "");
    setScoreB(match.teamB?.score?.toString() ?? "");
  }, [match.id, match.status, match.teamA?.score, match.teamB?.score]);

  // Scores can never go below 0 — clamp on every keystroke so the field
  // itself never shows a negative number, rather than only checking at
  // submit time.
  function clampNonNegative(v: string): string {
    if (v.trim() === "") return v;
    const n = Number(v);
    if (Number.isNaN(n)) return v;
    return n < 0 ? "0" : v;
  }

  function handleScoreAChange(v: string) {
    setScoreA(clampNonNegative(v));
  }

  function handleScoreBChange(v: string) {
    setScoreB(clampNonNegative(v));
  }

  const numA = Number(scoreA);
  const numB = Number(scoreB);
  const bothFilled = scoreA.trim() !== "" && scoreB.trim() !== "" && !Number.isNaN(numA) && !Number.isNaN(numB);
  const isTie = bothFilled && numA === numB;

  async function submitDecisive() {
    if (!bothFilled || isTie) return;
    if (numA < 0 || numB < 0) {
      setEditError("Scores can't be negative.");
      return;
    }
    setEditError(null);
    setSaving(true);
    try {
      const result = await onRecordResult?.(match.id, numA > numB ? "A" : "B", numA, numB);
      if (result && typeof result === "object" && "ok" in result && !result.ok) {
        setEditError(result.error ?? "Couldn't save the result.");
      }
    } catch {
      setEditError("Couldn't save the result. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function submitTieBreak(winner: "A" | "B") {
    setEditError(null);
    setSaving(true);
    try {
      const result = await onRecordResult?.(match.id, winner, numA, numB);
      if (result && typeof result === "object" && "ok" in result && !result.ok) {
        setEditError(result.error ?? "Couldn't save the result.");
      }
    } catch {
      setEditError("Couldn't save the result. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const showFooter = !compact && (match.teamA || match.teamB);

  return (
    <div
      ref={getRef ? getRef(match.id) : undefined}
      className={`w-full rounded-xl relative overflow-hidden bg-surface-container-low border transition-colors duration-200 ${
        match.status === "live" ? "border-status-live/40 shadow-[0_0_24px_rgba(255,180,171,0.12)]" : "border-border-overlay shadow-2xl"
      }`}
    >
      {match.status === "live" && (
        <div className="absolute inset-0 bg-gradient-to-r from-status-live/5 to-theme-orange/5 pointer-events-none animate-pulse" />
      )}
      {saving && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10 pointer-events-none">
          <Loader2 className="w-4 h-4 text-theme-orange animate-spin" />
        </div>
      )}
      <div className="relative flex flex-col gap-1 lg:gap-1.5 p-1.5 lg:p-2">
        <TeamRow
          team={match.teamA}
          status={match.status}
          fromLabel={match.aFrom}
          hoveredTeamCode={hoveredTeamCode}
          setHoveredTeamCode={setHoveredTeamCode}
          onFromClick={onFromClick ? () => onFromClick(match.aFrom) : undefined}
          onTeamClick={onTeamClick}
          isPinned={!!match.teamA && pinnedTeamCode === match.teamA.code}
          rowRef={getRef ? getRef(`${match.id}:A`) : undefined}
          compact={compact}
          scoreInput={playable ? { value: scoreA, onChange: handleScoreAChange, disabled: saving } : undefined}
        />
        <TeamRow
          team={match.teamB}
          status={match.status}
          fromLabel={match.bFrom}
          hoveredTeamCode={hoveredTeamCode}
          setHoveredTeamCode={setHoveredTeamCode}
          onFromClick={onFromClick ? () => onFromClick(match.bFrom) : undefined}
          onTeamClick={onTeamClick}
          isPinned={!!match.teamB && pinnedTeamCode === match.teamB.code}
          rowRef={getRef ? getRef(`${match.id}:B`) : undefined}
          compact={compact}
          scoreInput={playable ? { value: scoreB, onChange: handleScoreBChange, disabled: saving } : undefined}
        />

        {playable && isTie && (
          <div className="flex flex-col gap-1">
            <p className="text-center text-[9px] font-label-mono font-bold uppercase tracking-widest text-status-live">
              Scores tied — who won?
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => submitTieBreak("A")}
                disabled={saving}
                className="flex-1 text-[10px] font-label-mono font-bold uppercase tracking-wider rounded-lg bg-surface-container-high border border-theme-orange/40 text-theme-orange py-1.5 hover:opacity-90 active:scale-[0.98] transition-all truncate disabled:opacity-50"
              >
                {match.teamA?.code} wins
              </button>
              <button
                type="button"
                onClick={() => submitTieBreak("B")}
                disabled={saving}
                className="flex-1 text-[10px] font-label-mono font-bold uppercase tracking-wider rounded-lg bg-surface-container-high border border-theme-orange/40 text-theme-orange py-1.5 hover:opacity-90 active:scale-[0.98] transition-all truncate disabled:opacity-50"
              >
                {match.teamB?.code} wins
              </button>
            </div>
          </div>
        )}

        {playable && !isTie && (
          <button
            type="button"
            onClick={submitDecisive}
            disabled={!bothFilled || saving}
            className="w-full flex items-center justify-center gap-1.5 text-[10px] font-label-mono font-bold uppercase tracking-wider rounded-lg bg-theme-orange text-on-primary py-1.5 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving…
              </>
            ) : alreadyRecorded ? (
              "Update result"
            ) : (
              "Save result"
            )}
          </button>
        )}

        {playable && editError && (
          <p className="text-status-live text-[10px] font-label-mono px-0.5">{editError}</p>
        )}

        {showFooter && !playable && (
          <div className="flex items-center justify-between border-t border-border-overlay pt-1 lg:pt-1.5 mt-0 text-[9px] lg:text-[10px] font-label-mono font-bold uppercase tracking-wider text-outline">
            <span className="hidden lg:flex items-center gap-1.5 max-w-[65%] truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{match.venue || "TBD"}</span>
            </span>
            <span className="flex lg:hidden items-center gap-1 truncate">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{match.venue ? match.venue.split(" ")[0] : "TBD"}</span>
            </span>
            {match.status === "live" ? (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-status-live/10 text-status-live border border-status-live/30 text-[9px] font-black tracking-widest">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-outline">
                <Tv className="w-2.5 h-2.5 opacity-50 hidden lg:inline-block" />
                {match.date ? `${match.date}` : "TBD"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BracketColumn({
  roundName,
  matches,
  centerYByMatchId,
  getRef,
  hoveredTeamCode,
  setHoveredTeamCode,
  onFromClick,
  onTeamClick,
  pinnedTeamCode,
  compact,
  isLeaf,
  leafColumnRef,
  growWeight = 1,
  bleedLeft,
  bleedRight,
  innerBleedLeft,
  innerBleedRight,
  editable,
  onRecordResult,
}: {
  roundName: string;
  matches: MatchNode[];
  centerYByMatchId?: Record<string, number>;
  getRef: (key: string) => RefSetter;
  hoveredTeamCode: string | null;
  setHoveredTeamCode: (c: string | null) => void;
  onFromClick?: (label: string | null) => void;
  onTeamClick?: (code: string) => void;
  pinnedTeamCode?: string | null;
  compact?: boolean;
  isLeaf?: boolean;
  leafColumnRef?: RefSetter;
  growWeight?: number;
  bleedLeft?: string;
  bleedRight?: string;
  innerBleedLeft?: string;
  innerBleedRight?: string;
  editable?: boolean;
  onRecordResult?: (
    matchId: string,
    winner: "A" | "B",
    scoreA: number,
    scoreB: number
  ) => void | Promise<void | { ok: boolean; error?: string }>;
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
              <MatchCard
                match={match}
                hoveredTeamCode={hoveredTeamCode}
                setHoveredTeamCode={setHoveredTeamCode}
                onFromClick={onFromClick}
                onTeamClick={onTeamClick}
                pinnedTeamCode={pinnedTeamCode}
                getRef={getRef}
                compact={compact}
                editable={editable}
                onRecordResult={onRecordResult}
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
                  <MatchCard
                    match={match}
                    hoveredTeamCode={hoveredTeamCode}
                    setHoveredTeamCode={setHoveredTeamCode}
                    onFromClick={onFromClick}
                    onTeamClick={onTeamClick}
                    pinnedTeamCode={pinnedTeamCode}
                    getRef={(key) => (key === match.id ? () => {} : getRef(key))}
                    compact={compact}
                    editable={editable}
                    onRecordResult={onRecordResult}
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
  sourceCode?: string;
}

/* ------------------------------------------------------------------ */
/*  Main component — everything about the bracket comes from props    */
/* ------------------------------------------------------------------ */

export default function TournamentBracket({
  rounds,
  title = "Championship Bracket",
  eyebrowLabel = "Knockout Stage",
  helperText = "Hover or click a team to trace their path.",
  liveLabel = "Live Matches",
  logoSrc,
  className = "",
  onActiveTeamChange,
  editable,
  onRecordResult,
}: TournamentBracketProps) {
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

  // "Levels" of the bracket == rounds.length, derived directly from the
  // data that was passed in — no hard-coded team count anywhere.
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

  function roundIndexForLabel(label: string | null): number {
    if (!label) return -1;
    const shortName = label.split("-")[0];
    return rounds.findIndex((r) => r.shortName === shortName);
  }

  function getRoundGrowWeight(roundIndex: number, side: "left" | "right" | "final"): number {
    if (side === "final") return GROW_WEIGHT.full * 1.3;
    const totalRounds = nonFinalRounds.length;
    if (roundIndex <= 1) return GROW_WEIGHT.full;
    if (roundIndex === 2 && totalRounds >= 4) return GROW_WEIGHT.quarter * 0.85;
    if (roundIndex === totalRounds - 1) return GROW_WEIGHT.semi * 0.85;
    return GROW_WEIGHT.compact;
  }

  function shouldBeCompact(_roundIndex: number): boolean {
    return false;
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
            const targetRowEl = cardEls.current[`${match.id}:${slotIdx === 0 ? "A" : "B"}`] || targetEl;
            const trRect = targetRowEl.getBoundingClientRect();
            const endX = (flowsRight ? trRect.left : trRect.right) - containerRect.left;
            const endY = trRect.top + trRect.height / 2 - containerRect.top;
            next.push({
              id: `${match.id}-${slotIdx === 0 ? "A" : "B"}`,
              d: elbowPath(startX, startY, endX, endY),
              teamCode: teamCodeForConnector || undefined,
              sourceCode: teamCodeForConnector || undefined,
            });
            return;
          }
          const endX = tCenterX - containerRect.left;
          const endY = (slotIdx === 0 ? tRect.top : tRect.bottom) - containerRect.top;
          next.push({
            id: `${match.id}-${slotIdx === 0 ? "A" : "B"}`,
            d: topEntryPath(startX, startY, endX, endY),
            teamCode: teamCodeForConnector || undefined,
            sourceCode: teamCodeForConnector || undefined,
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

  function goToLabel(label: string | null) {
    const idx = roundIndexForLabel(label);
    if (idx >= 0) goToRound(idx);
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
                    className="w-[280px] md:w-[450px] lg:w-[600px] max-w-none h-auto object-contain opacity-15"
                  />
                </div>
              )}
              {nonFinalRounds.map((round, i) => {
                const isCompact = shouldBeCompact(i);
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
                    compact={isCompact}
                    isLeaf={i === 0}
                    leafColumnRef={i === 0 ? (el) => (leafColumnRef.current = el) : undefined}
                    growWeight={growWeight}
                    bleedLeft={bleedLeft}
                    innerBleedLeft={innerBleedLeft}
                    editable={editable}
                    onRecordResult={onRecordResult}
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
                growWeight={getRoundGrowWeight(nonFinalRounds.length, "final")}
                editable={editable}
                onRecordResult={onRecordResult}
              />
              {[...nonFinalRounds].reverse().map((round, revIdx) => {
                const i = nonFinalRounds.length - 1 - revIdx;
                const isCompact = shouldBeCompact(i);
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
                    compact={isCompact}
                    isLeaf={i === 0}
                    growWeight={growWeight}
                    bleedRight={bleedRight}
                    innerBleedRight={innerBleedRight}
                    editable={editable}
                    onRecordResult={onRecordResult}
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
                const isCompact = shouldBeCompact(i);
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
                    isLeaf={i === 0}
                    leafColumnRef={i === 0 ? (el) => (leafColumnRef.current = el) : undefined}
                    growWeight={growWeight}
                    compact={isCompact}
                    bleedLeft={bleedLeft}
                    innerBleedLeft={innerBleedLeft}
                    editable={editable}
                    onRecordResult={onRecordResult}
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
                      <MatchCard
                        match={match}
                        hoveredTeamCode={activeTeamCode}
                        setHoveredTeamCode={setHoveredTeamCode}
                        onFromClick={goToLabel}
                        onTeamClick={handleTeamClick}
                        pinnedTeamCode={selectedTeamCode}
                        editable={editable}
                        onRecordResult={onRecordResult}
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