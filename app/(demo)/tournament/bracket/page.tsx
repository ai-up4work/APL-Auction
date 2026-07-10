// app/(demo)/tournament/bracket/page.tsx
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Trophy, Tv, MapPin, CheckCircle2, Radio, ChevronLeft, ChevronRight } from "lucide-react";

interface TeamNode {
  id: string;
  code: string;
  name: string;
  logo?: string;
  color: string;
  score?: number;
  isWinner?: boolean;
}

interface MatchNode {
  id: string;
  label: string; // e.g. "R32-3" — used both as this match's own id and as the tag shown on whatever it feeds into
  status: "scheduled" | "live" | "completed";
  teamA: TeamNode | null;
  teamB: TeamNode | null;
  aFrom: string | null; // predecessor label for the teamA slot (null in round 1)
  bFrom: string | null;
  venue?: string;
  date?: string;
  time?: string;
}

interface Round {
  id: number;
  name: string;
  shortName: string;
  matches: MatchNode[];
}

// ── How many teams this bracket holds. Drop this to 8 or 4 and the page
// automatically falls back to the simple one-directional layout instead of
// the mirrored "two funnels into a Final" layout — see TEAM_COUNT usage below.
const TEAM_COUNT = 32;

const PALETTE = [
  "#3B8BD4", "#2A9D5C", "#E45D35", "#FFB000", "#7C3AED", "#EC4899", "#0F172A", "#DC2626",
  "#0EA5E9", "#059669", "#D97706", "#9333EA", "#DB2777", "#475569", "#65A30D", "#B91C1C",
];

const VENUES = ["Meridian Stadium", "Galle International", "R. Premadasa", "Pallekele Grounds"];

const TEAM_NAMES: { name: string; code: string }[] = [
  { name: "Coastal Sharks", code: "CS" }, { name: "Desert Falcons", code: "DF" },
  { name: "Moon Knights", code: "MK" }, { name: "Viper Titans", code: "VT" },
  { name: "Kandy Kings", code: "KK" }, { name: "Badulla Royals", code: "BR" },
  { name: "Jaffna Giants", code: "JG" }, { name: "Galle Challengers", code: "GC" },
  { name: "Northern Ospreys", code: "NO" }, { name: "Southern Cobras", code: "SC" },
  { name: "Highland Hawks", code: "HH" }, { name: "Island Panthers", code: "IP" },
  { name: "Royal Lions", code: "RL" }, { name: "Golden Eagles", code: "GE" },
  { name: "Silver Wolves", code: "SW" }, { name: "Crimson Tigers", code: "CT" },
  { name: "Emerald Dragons", code: "ED" }, { name: "Obsidian Ravens", code: "OR" },
  { name: "Storm Chasers", code: "SC2" }, { name: "Thunder Riders", code: "TR" },
  { name: "Blaze Strikers", code: "BS" }, { name: "Frost Giants", code: "FG" },
  { name: "Ember Phoenix", code: "EP" }, { name: "Ridge Rhinos", code: "RR2" },
  { name: "Bay Barracudas", code: "BB" }, { name: "Cliff Condors", code: "CC" },
  { name: "Valley Vultures", code: "VV" }, { name: "Summit Stallions", code: "SS" },
  { name: "Harbor Hammers", code: "HB" }, { name: "Delta Dragons", code: "DD" },
  { name: "Plains Panthers", code: "PP" }, { name: "Arena Adders", code: "AA" },
];

const LOGOS: Record<string, string> = {
  CS: "/Franchises/CSK.png", DF: "/Franchises/RCB.png", MK: "/Franchises/MI.png", VT: "/Franchises/SRH.png",
  KK: "/Franchises/KKR.png", BR: "/Franchises/RR.png", JG: "/Franchises/GT.png", GC: "/Franchises/DC.png",
};

function roundMeta(teamsEntering: number): { name: string; shortName: string } {
  switch (teamsEntering) {
    case 2: return { name: "Final", shortName: "F" };
    case 4: return { name: "Semifinal", shortName: "SF" };
    case 8: return { name: "Quarterfinal", shortName: "QF" };
    case 16: return { name: "Round of 16", shortName: "R16" };
    case 32: return { name: "Round of 32", shortName: "R32" };
    default: return { name: `Round of ${teamsEntering}`, shortName: `R${teamsEntering}` };
  }
}

// Builds every round from just the raw team list: round 1 is real fixtures,
// every later round is *derived* — a slot only fills in once its feeder
// match is marked "completed", otherwise it stays a labelled TBD. This is
// what makes the "winner flows into the next match" connection real instead
// of hand-authored per round.
function buildBracket(teamCount: number): Round[] {
  const rounds: Round[] = [];
  const round1Meta = roundMeta(teamCount);
  const round1Matches: MatchNode[] = [];

  for (let i = 0; i < teamCount / 2; i++) {
    const a = TEAM_NAMES[(i * 2) % TEAM_NAMES.length];
    const b = TEAM_NAMES[(i * 2 + 1) % TEAM_NAMES.length];
    const color = (idx: number) => PALETTE[idx % PALETTE.length];
    const pattern = i % 5;

    let status: MatchNode["status"] = "scheduled";
    let scoreA: number | undefined;
    let scoreB: number | undefined;
    let winnerSlot: 0 | 1 | null = null;

    if (pattern === 0) {
      status = "completed";
      scoreA = 140 + ((i * 7) % 50);
      scoreB = 110 + ((i * 5) % 45);
      winnerSlot = 0;
    } else if (pattern === 1) {
      status = "completed";
      scoreA = 118 + ((i * 3) % 30);
      scoreB = 152 + ((i * 4) % 35);
      winnerSlot = 1;
    } else if (pattern === 2) {
      status = "live";
      scoreA = 62 + ((i * 2) % 20);
      scoreB = 58 + ((i * 3) % 22);
    }

    round1Matches.push({
      id: `${round1Meta.shortName}-${i + 1}`,
      label: `${round1Meta.shortName}-${i + 1}`,
      status,
      teamA: { id: `t${i * 2}`, code: a.code, name: a.name, logo: LOGOS[a.code], color: color(i * 2), score: scoreA, isWinner: winnerSlot === 0 },
      teamB: { id: `t${i * 2 + 1}`, code: b.code, name: b.name, logo: LOGOS[b.code], color: color(i * 2 + 1), score: scoreB, isWinner: winnerSlot === 1 },
      aFrom: null,
      bFrom: null,
      venue: VENUES[i % VENUES.length],
      date: `Jul ${1 + (i % 10)}`,
      time: i % 2 === 0 ? "15:30" : "19:30",
    });
  }

  rounds.push({ id: 1, name: round1Meta.name, shortName: round1Meta.shortName, matches: round1Matches });

  let prev = round1Matches;
  let roundId = 2;
  while (prev.length >= 2) {
    const meta = roundMeta(prev.length);
    const matches: MatchNode[] = [];

    for (let i = 0; i < prev.length / 2; i++) {
      const mA = prev[i * 2];
      const mB = prev[i * 2 + 1];
      const winnerA = mA.status === "completed" ? (mA.teamA?.isWinner ? mA.teamA : mA.teamB) : null;
      const winnerB = mB.status === "completed" ? (mB.teamA?.isWinner ? mB.teamA : mB.teamB) : null;

      matches.push({
        id: `${meta.shortName}-${i + 1}`,
        label: `${meta.shortName}-${i + 1}`,
        status: "scheduled",
        teamA: winnerA ? { ...winnerA, score: undefined, isWinner: false } : null,
        teamB: winnerB ? { ...winnerB, score: undefined, isWinner: false } : null,
        aFrom: mA.label,
        bFrom: mB.label,
      });
    }

    rounds.push({ id: roundId, name: meta.name, shortName: meta.shortName, matches });
    prev = matches;
    roundId++;
  }

  return rounds;
}

const ROUNDS = buildBracket(TEAM_COUNT);
const USE_MIRRORED_LAYOUT = TEAM_COUNT >= 16; // below a Round of 16, one side is plenty

// Card positions are no longer guessed from fixed pixel constants — they're
// derived from the *real* rendered position of the leaf (Round-of-32) cards,
// measured from the DOM after mount (see recomputeLayout in the page
// component). Every later round's card is then just the midpoint of its two
// feeders' real measured centers, recursively — see computeCentersFromLeaves
// below — so positioning is correct regardless of actual card height,
// wrapped text, compact vs normal styling, logos, etc.

// Stepped "elbow" connector: out → straight down/up in the middle → in,
// with rounded corners, instead of a diagonal bezier swoop. This is what
// gives the line visible breathing room against the card text on either
// side, matching how reference bracket UIs draw their connectors.
function elbowPath(x1: number, y1: number, x2: number, y2: number, radius = 12): string {
  const midX = (x1 + x2) / 2;
  if (Math.abs(y2 - y1) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const dir = y2 > y1 ? 1 : -1;
  const r = Math.max(0, Math.min(radius, Math.abs(y2 - y1) / 2, Math.abs(midX - x1)));
  return `M ${x1} ${y1} L ${midX - r} ${y1} Q ${midX} ${y1} ${midX} ${y1 + r * dir} L ${midX} ${
    y2 - r * dir
  } Q ${midX} ${y2} ${midX + r} ${y2} L ${x2} ${y2}`;
}

// Given the REAL measured Y-center (px, relative to the container) of every
// leaf-round match, and how many matches each subsequent round has, computes
// every later round's Y-center purely by averaging its two feeders' centers.
// Because the leaf values are real DOM measurements (not assumed spacing),
// every later round lands exactly between its two real feeder cards no
// matter how tall any card actually rendered.
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

function roundIndexForLabel(label: string | null): number {
  if (!label) return -1;
  const shortName = label.split("-")[0];
  return ROUNDS.findIndex((r) => r.shortName === shortName);
}

function findMatchByLabel(label: string): MatchNode | undefined {
  for (const round of ROUNDS) {
    const found = round.matches.find((m) => m.id === label);
    if (found) return found;
  }
  return undefined;
}

type RefSetter = (el: HTMLDivElement | null) => void;

function TeamRow({
  team,
  status,
  fromLabel,
  hoveredTeamCode,
  setHoveredTeamCode,
  onFromClick,
  rowRef,
  compact,
}: {
  team: TeamNode | null;
  status: MatchNode["status"];
  fromLabel: string | null;
  hoveredTeamCode: string | null;
  setHoveredTeamCode: (c: string | null) => void;
  onFromClick?: () => void;
  rowRef?: RefSetter;
  compact?: boolean;
}) {
  const isTBD = !team;
  const isHovered = team && hoveredTeamCode === team.code;
  const isAnyHovered = hoveredTeamCode !== null;

  return (
    <div
      ref={rowRef}
      onMouseEnter={() => team && setHoveredTeamCode(team.code)}
      onMouseLeave={() => setHoveredTeamCode(null)}
      className={`flex items-center justify-between p-1.5 lg:p-2 rounded-lg relative transition-all duration-200 border ${
        isTBD ? "bg-background/40 border-dashed border-border-overlay text-outline" : "bg-surface-container border-border-overlay"
      } ${
        isHovered
          ? "scale-[1.02] border-theme-orange/40 bg-surface-container-high"
          : isAnyHovered && !isHovered
          ? "opacity-30 blur-[0.5px]"
          : ""
      }`}
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
              onClick={onFromClick}
              disabled={!onFromClick}
              className="text-[9px] font-label-mono tracking-wider text-outline mt-0.5 flex items-center gap-1 disabled:cursor-default"
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

      {!isTBD && status !== "scheduled" && (
        <div className="flex items-center gap-2 font-label-mono font-black text-sm pr-1 shrink-0">
          {team.isWinner && <CheckCircle2 className="w-3.5 h-3.5 text-theme-orange" strokeWidth={3} />}
          <span className={team.isWinner ? "text-theme-orange" : "text-outline"}>{team.score}</span>
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
  getRef,
  compact,
}: {
  match: MatchNode;
  hoveredTeamCode: string | null;
  setHoveredTeamCode: (c: string | null) => void;
  onFromClick?: (label: string | null) => void;
  getRef?: (key: string) => RefSetter;
  compact?: boolean;
}) {
  // Cards with no teams decided yet (both slots still TBD) have nothing
  // useful to say in a footer, so we drop the venue/date row for them and
  // for any card once the column has been squeezed below a comfortable
  // width. This mirrors how reference bracket UIs collapse mid-round cards
  // to just the two team rows once space gets tight.
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

      <div className="relative flex flex-col gap-1.5 lg:gap-2 p-2 lg:p-3.5">
        <TeamRow
          team={match.teamA}
          status={match.status}
          fromLabel={match.aFrom}
          hoveredTeamCode={hoveredTeamCode}
          setHoveredTeamCode={setHoveredTeamCode}
          onFromClick={onFromClick ? () => onFromClick(match.aFrom) : undefined}
          rowRef={getRef ? getRef(`${match.id}:A`) : undefined}
          compact={compact}
        />
        <TeamRow
          team={match.teamB}
          status={match.status}
          fromLabel={match.bFrom}
          hoveredTeamCode={hoveredTeamCode}
          setHoveredTeamCode={setHoveredTeamCode}
          onFromClick={onFromClick ? () => onFromClick(match.bFrom) : undefined}
          rowRef={getRef ? getRef(`${match.id}:B`) : undefined}
          compact={compact}
        />

        {showFooter && (
          <div className="flex items-center justify-between border-t border-border-overlay pt-1.5 lg:pt-2.5 mt-0.5 text-[9px] lg:text-[10px] font-label-mono font-bold uppercase tracking-wider text-outline">
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

// One column of stacked match cards. Every column across the whole bracket
// shares the same fixed `columnHeight` and uses `justify-around`, so no
// matter how many matches a round has — 8 down to a single Final card — the
// stack is centered on the exact same vertical axis. The actual connector
// lines are drawn once, globally, in TournamentBracketPage (see
// `<svg>` overlay) by measuring real card positions, so they always land on
// the right slot regardless of how the cards happen to be spaced.
//
// NOTE on width: this column has NO min-width floor (`min-w-0`). It is a
// true flex-1 fraction of the container, so with e.g. 9 columns in view
// each one just gets ~1/9th of the viewport — the whole bracket fits one
// screen width with no horizontal scrolling, the same way reference score
// sites (ESPN/Bing/FIFA) lay theirs out. Cards shrink to fit their column;
// `compact` (passed down when a round sits in the visually-denser middle
// section) drops the secondary "From R32-3" caption line and the venue/date
// footer so text doesn't wrap awkwardly in a narrow column.
function BracketColumn({
  roundName,
  matches,
  centerYByMatchId,
  columnHeight,
  getRef,
  hoveredTeamCode,
  setHoveredTeamCode,
  onFromClick,
  compact,
  isLeaf,
  leafColumnRef,
}: {
  roundName: string;
  matches: MatchNode[];
  centerYByMatchId?: Record<string, number>; // required when !isLeaf
  columnHeight: number;
  getRef: (key: string) => RefSetter;
  hoveredTeamCode: string | null;
  setHoveredTeamCode: (c: string | null) => void;
  onFromClick?: (label: string | null) => void;
  compact?: boolean;
  isLeaf?: boolean;
  leafColumnRef?: RefSetter;
}) {
  return (
    <div className="flex-1 flex flex-col items-center min-w-0">
      <div className="w-full text-center mb-4 md:mb-5 lg:mb-8 relative">
        <span className="inline-block px-2.5 py-1 lg:px-4 lg:py-1.5 rounded-full text-[9px] lg:text-[10px] font-black uppercase tracking-widest font-label-mono bg-surface-container-low border border-border-overlay text-on-surface-variant shadow-lg truncate max-w-full">
          {roundName}
        </span>
        <div className="absolute left-0 right-0 top-1/2 -z-10 h-px bg-gradient-to-r from-transparent via-border-overlay to-transparent" />
      </div>

      {isLeaf ? (
        // Leaf (Round-of-32) round: plain document flow with a real gap. This
        // is the ground truth every later round's position is measured from —
        // no assumptions here, just whatever height the browser actually gives
        // these cards.
        <div ref={leafColumnRef} className="w-full flex flex-col gap-6 lg:gap-7 items-stretch">
          {matches.map((match) => (
            <div key={match.id} className="w-full px-1 lg:px-2">
              <MatchCard
                match={match}
                hoveredTeamCode={hoveredTeamCode}
                setHoveredTeamCode={setHoveredTeamCode}
                onFromClick={onFromClick}
                getRef={getRef}
                compact={compact}
              />
            </div>
          ))}
        </div>
      ) : (
        // Every later round: absolutely positioned at the REAL measured
        // midpoint of its two feeders, vertically centered on that point via
        // translateY(-50%) — so no card-height guess is needed at all, the
        // card just centers on whatever pixel value was actually measured.
        <div className="w-full relative" style={{ height: columnHeight }}>
          {matches.map((match) => {
            const centerY = centerYByMatchId?.[match.id] ?? columnHeight / 2;
            return (
              <div
                key={match.id}
                className="absolute left-0 right-0 px-1 lg:px-2"
                style={{ top: centerY, transform: "translateY(-50%)" }}
              >
                <MatchCard
                  match={match}
                  hoveredTeamCode={hoveredTeamCode}
                  setHoveredTeamCode={setHoveredTeamCode}
                  onFromClick={onFromClick}
                  getRef={getRef}
                  compact={compact}
                />
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

export default function TournamentBracketPage() {
  const [hoveredTeamCode, setHoveredTeamCode] = useState<string | null>(null);
  const [mobileRound, setMobileRound] = useState(0);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  // ── connector + layout plumbing ──────────────────────────────────────
  const desktopContainerRef = useRef<HTMLDivElement>(null);
  const leafColumnRef = useRef<HTMLDivElement | null>(null);
  const cardEls = useRef<Record<string, HTMLDivElement | null>>({});
  const refCache = useRef<Record<string, RefSetter>>({});
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [matchCenterY, setMatchCenterY] = useState<Record<string, number>>({});
  const [columnHeight, setColumnHeight] = useState(1200);

  function getRef(key: string): RefSetter {
    if (!refCache.current[key]) {
      refCache.current[key] = (el: HTMLDivElement | null) => {
        cardEls.current[key] = el;
      };
    }
    return refCache.current[key];
  }

  const finalRound = ROUNDS[ROUNDS.length - 1];
  const nonFinalRounds = ROUNDS.slice(0, -1);
  const leftSideMatches = USE_MIRRORED_LAYOUT ? nonFinalRounds.map((r) => r.matches.slice(0, r.matches.length / 2)) : [];
  const rightSideMatches = USE_MIRRORED_LAYOUT ? nonFinalRounds.map((r) => r.matches.slice(r.matches.length / 2)) : [];

  // Step 1: measure the REAL rendered center of every leaf (Round-of-32)
  // card, then derive every later round's center purely from those real
  // numbers (see computeCentersFromLeaves). This replaces guessed pixel
  // constants entirely — a Quarterfinal card lands exactly between its two
  // real Round-of-16 cards no matter how tall those cards actually rendered.
  function recomputeLayout() {
    const containerEl = desktopContainerRef.current;
    if (!containerEl) return;
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

    if (USE_MIRRORED_LAYOUT) {
      const leftLeafY = leftSideMatches[0].map((m) => measuredCenter(m.id));
      const rightLeafY = rightSideMatches[0].map((m) => measuredCenter(m.id));
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
      const leafMatches = ROUNDS[0].matches;
      const leafY = leafMatches.map((m) => measuredCenter(m.id));
      if (leafY.some((v) => v === null)) return;
      const counts = ROUNDS.map((r) => r.matches.length);
      const pix = computeCentersFromLeaves(leafY as number[], counts);
      ROUNDS.forEach((round, r) => {
        round.matches.forEach((m, i) => {
          nextCenters[m.id] = pix[r][i];
        });
      });
    }

    setMatchCenterY(nextCenters);

    const leafH = leafColumnRef.current?.scrollHeight;
    if (leafH && Math.abs(leafH - columnHeight) > 1) setColumnHeight(leafH);
  }

  function recomputeConnectors() {
    const containerEl = desktopContainerRef.current;
    if (!containerEl) return;
    const containerRect = containerEl.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;

    const next: Connector[] = [];

    for (const round of ROUNDS) {
      for (const match of round.matches) {
        (["aFrom", "bFrom"] as const).forEach((key, slotIdx) => {
          const feederLabel = match[key];
          if (!feederLabel) return;

          const feederMatch = findMatchByLabel(feederLabel);
          // Anchor the line to the exact team row that advanced, once known;
          // otherwise anchor to the whole (still undecided) feeder card.
          let sourceKey = feederLabel;
          if (feederMatch?.status === "completed") {
            sourceKey = feederMatch.teamA?.isWinner ? `${feederLabel}:A` : `${feederLabel}:B`;
          }

          const sourceEl = cardEls.current[sourceKey] || cardEls.current[feederLabel];
          const targetEl = cardEls.current[`${match.id}:${slotIdx === 0 ? "A" : "B"}`];
          if (!sourceEl || !targetEl) return;

          const sRect = sourceEl.getBoundingClientRect();
          const tRect = targetEl.getBoundingClientRect();
          if (sRect.width === 0 || tRect.width === 0) return;

          const sCenterX = sRect.left + sRect.width / 2;
          const tCenterX = tRect.left + tRect.width / 2;
          const flowsRight = sCenterX < tCenterX;

          const startX = (flowsRight ? sRect.right : sRect.left) - containerRect.left;
          const startY = sRect.top + sRect.height / 2 - containerRect.top;
          const endX = (flowsRight ? tRect.left : tRect.right) - containerRect.left;
          const endY = tRect.top + tRect.height / 2 - containerRect.top;

          const teamCode = slotIdx === 0 ? match.teamA?.code : match.teamB?.code;

          next.push({
            id: `${match.id}-${slotIdx === 0 ? "A" : "B"}`,
            d: elbowPath(startX, startY, endX, endY),
            teamCode,
          });
        });
      }
    }

    setConnectors(next);
  }

  // Stage 1: measure the real leaf cards and derive every later round's
  // position from them, on mount / resize.
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
  }, []);

  // Stage 2: once the DOM has actually reflected the positions computed in
  // stage 1 (matchCenterY/columnHeight changed → re-render happened), the
  // cards are in their real final spots — only now do we measure them again
  // to draw the connector lines, so lines never lag a frame behind the cards
  // they're supposed to be touching.
  useLayoutEffect(() => {
    recomputeConnectors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchCenterY, columnHeight]);

  function goToRound(idx: number) {
    const clamped = Math.max(0, Math.min(ROUNDS.length - 1, idx));
    setMobileRound(clamped);
    const el = mobileScrollRef.current;
    if (el) el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  }

  function goToLabel(label: string | null) {
    const idx = roundIndexForLabel(label);
    if (idx >= 0) goToRound(idx);
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

  // Middle rounds (everything except the outermost Round of 32 on each side)
  // get the compact card treatment once we're past a certain total column
  // count, since those are the columns squeezed hardest when everything
  // has to fit in one viewport width.
  const totalColumns = USE_MIRRORED_LAYOUT ? nonFinalRounds.length * 2 + 1 : ROUNDS.length;
  const compactMiddle = totalColumns > 5;

  return (
    <div className="min-h-screen w-full bg-background text-on-surface p-4 md:p-8">
      {/* ── Header ── */}
      <div className="max-w-[1600px] mx-auto mb-8 md:mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-overlay pb-6">
        <div>
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] font-label-mono text-theme-orange">
            <Trophy className="w-3.5 h-3.5" />
            Knockout Stage
          </span>
          <h1 className="font-headline-lg font-bold text-3xl md:text-4xl text-on-surface mt-1.5">Championship Bracket</h1>
        </div>

        <div className="flex items-center gap-4 bg-surface-container-low/70 backdrop-blur-xl px-4 py-2.5 rounded-xl border border-border-overlay">
          <div className="flex items-center gap-2">
            <span className="tally bg-[radial-gradient(circle_at_35%_30%,#ff9d94,var(--color-status-live)_65%)] shadow-[0_0_6px_1px_rgba(255,180,171,0.55)] animate-[connPulse_1.4s_ease-in-out_infinite]" />
            <span className="font-label-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Live Matches</span>
          </div>
          <div className="w-px h-4 bg-border-overlay hidden md:block" />
          <p className="font-body-md text-[11px] text-outline hidden md:block">Hover a team to trace their path.</p>
        </div>
      </div>

      {/* ══════════════════ DESKTOP / TABLET ══════════════════
          Every column is a true flex-1 slice of the viewport with no
          min-width floor, so the whole bracket — Round of 32 through Final
          and back out — renders in exactly one viewport width, no
          horizontal scrolling or paging required. Middle rounds switch to
          `compact` cards (no "From X" caption, no venue/date footer) once
          there are enough columns that space gets tight, the same way
          reference bracket UIs (ESPN/Bing/FIFA) condense their center
          columns. */}
      <div className="hidden md:block max-w-[1600px] mx-auto relative">
        <div className="w-full overflow-x-hidden">
          {USE_MIRRORED_LAYOUT ? (
            <div ref={desktopContainerRef} className="relative flex items-start gap-0 w-full pb-12">
              {nonFinalRounds.map((round, i) => (
                <BracketColumn
                  key={`L-${round.id}`}
                  roundName={round.name}
                  matches={leftSideMatches[i]}
                  centerYByMatchId={matchCenterY}
                  columnHeight={columnHeight}
                  getRef={getRef}
                  hoveredTeamCode={hoveredTeamCode}
                  setHoveredTeamCode={setHoveredTeamCode}
                  compact={compactMiddle && i > 0}
                  isLeaf={i === 0}
                  leafColumnRef={i === 0 ? (el) => (leafColumnRef.current = el) : undefined}
                />
              ))}

              <BracketColumn
                roundName={finalRound.name}
                matches={finalRound.matches}
                centerYByMatchId={matchCenterY}
                columnHeight={columnHeight}
                getRef={getRef}
                hoveredTeamCode={hoveredTeamCode}
                setHoveredTeamCode={setHoveredTeamCode}
              />

              {[...nonFinalRounds].reverse().map((round, revIdx) => {
                const i = nonFinalRounds.length - 1 - revIdx;
                return (
                  <BracketColumn
                    key={`R-${round.id}`}
                    roundName={round.name}
                    matches={rightSideMatches[i]}
                    centerYByMatchId={matchCenterY}
                    columnHeight={columnHeight}
                    getRef={getRef}
                    hoveredTeamCode={hoveredTeamCode}
                    setHoveredTeamCode={setHoveredTeamCode}
                    compact={compactMiddle && i < nonFinalRounds.length - 1}
                    isLeaf={i === 0}
                  />
                );
              })}

              <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
                {connectors.map((c) => {
                  const active = c.teamCode && c.teamCode === hoveredTeamCode;
                  return (
                    <path
                      key={c.id}
                      d={c.d}
                      fill="none"
                      stroke={active ? "var(--color-theme-orange)" : "var(--color-border-overlay)"}
                      strokeWidth={active ? 2.5 : 2}
                      style={{ transition: "stroke 0.2s, stroke-width 0.2s" }}
                    />
                  );
                })}
              </svg>
            </div>
          ) : (
            <div ref={desktopContainerRef} className="relative flex items-start gap-0 w-full pb-12">
              {ROUNDS.map((round, i) => (
                <BracketColumn
                  key={round.id}
                  roundName={round.name}
                  items={buildItems(round.matches, flatCenters[i], false)}
                  columnHeight={COLUMN_HEIGHT}
                  getRef={getRef}
                  hoveredTeamCode={hoveredTeamCode}
                  setHoveredTeamCode={setHoveredTeamCode}
                />
              ))}

              <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
                {connectors.map((c) => {
                  const active = c.teamCode && c.teamCode === hoveredTeamCode;
                  return (
                    <path
                      key={c.id}
                      d={c.d}
                      fill="none"
                      stroke={active ? "var(--color-theme-orange)" : "var(--color-border-overlay)"}
                      strokeWidth={active ? 2.5 : 2}
                      style={{ transition: "stroke 0.2s, stroke-width 0.2s" }}
                    />
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════ MOBILE: one stage at a time, swipe/tap to swap ══════════════════ */}
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

          <div className="flex-1 flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar">
            {ROUNDS.map((round, i) => (
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
            disabled={mobileRound === ROUNDS.length - 1}
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-surface-container-low border border-border-overlay text-outline disabled:opacity-30 active:scale-95 transition-all"
            aria-label="Next stage"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Swipeable stage pages — horizontal swipe only, scrollbar hidden */}
        <div
          ref={mobileScrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4"
          style={{ touchAction: "pan-x" }}
        >
          {ROUNDS.map((round) => (
            <div key={round.id} className="w-full flex-shrink-0 snap-start">
              <h2 className="font-label-mono text-[11px] font-black uppercase tracking-widest text-on-surface-variant text-center mb-3">
                {round.name}
              </h2>

              {/* Vertical match list — fixed height so short stages (Final, Semis)
                 center their cards instead of collapsing, and long stages
                 (Round of 32) scroll. Scrollbar hidden, vertical swipe still works. */}
              <div
                className="h-[65vh] overflow-y-auto no-scrollbar"
                style={{ touchAction: "pan-y", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
              >
                <div className="min-h-full flex flex-col justify-center gap-3 py-2">
                  {round.matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      hoveredTeamCode={hoveredTeamCode}
                      setHoveredTeamCode={setHoveredTeamCode}
                      onFromClick={goToLabel}
                    />
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