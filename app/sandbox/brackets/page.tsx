// File: app/sandbox/brackets/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { Shuffle, Sparkles, RotateCcw, Settings2, Trophy, X, PartyPopper, ChevronDown, ChevronUp, ImagePlus } from "lucide-react";

import TournamentBracket from "@/components/demo/TournamentBracketEditable";
import type { Round, MatchNode } from "@/components/demo/TournamentBracket";
import DoubleElimBoard from "@/components/demo/DoubleElimBoard";

import type { AdminTeam } from "@/lib/tournament/seeding";
import { randomDraw } from "@/lib/tournament/seeding";
import { getDemoTeams } from "@/lib/tournament/demoTeams";
import { generateSingleElimination, recordSingleElimResult, championOf } from "@/lib/tournament/singleElim";
import {
  generateDoubleElimination,
  recordDoubleElimResult,
  championOfDoubleElim,
  DoubleElimData,
} from "@/lib/tournament/doubleElim";

type FormatType = "single_elimination" | "double_elimination";

const FORMAT_LABELS: Record<FormatType, string> = {
  single_elimination: "Single Elim",
  double_elimination: "Double Elim",
};

// Default watermark shown on the live board before anyone picks a custom
// one from the admin overlay. Kept as a named constant (rather than a
// literal passed at each call site) so the sandbox and the admin overlay
// agree on what "no override yet" looks like.
const DEFAULT_LOGO_SRC = "/moon-knight-logo.png";

// Same split as the admin panel: mono/uppercase/wide-tracking stays on
// labels, badges, and codes; anything meant to be read (team names) uses
// this instead. Falls back to the system UI stack if --font-body isn't
// defined in globals.css.
const FONT_BODY = "var(--font-body, 'Inter', ui-sans-serif, system-ui, sans-serif)";

// Presets are just shortcuts — the generators already accept ANY team
// count >= 2 (byes fill the rest to the next power of 2). Anything in
// between is reachable via the custom count input next to these.
const TEAM_COUNT_PRESETS = [4, 8, 16, 32] as const;
const MIN_TEAMS = 2;
const MAX_TEAMS = 64;

/* ------------------------------------------------------------------ */
/*  Local helpers — cloning + randomized result simulation. Kept in    */
/*  this file rather than the lib layer since "simulate everything     */
/*  instantly" is a sandbox-only concern, not something the real admin */
/*  flow needs.                                                        */
/* ------------------------------------------------------------------ */

function cloneMatch(m: MatchNode): MatchNode {
  return { ...m, teamA: m.teamA ? { ...m.teamA } : null, teamB: m.teamB ? { ...m.teamB } : null };
}

function cloneRounds(rounds: Round[]): Round[] {
  return rounds.map((r) => ({ ...r, matches: r.matches.map(cloneMatch) }));
}

/** Deep-clones every match object in a DoubleElimData tree — required
 *  because recordDoubleElimResult / advanceDoubleElim mutate match objects
 *  IN PLACE. Cloning first means those mutations never land on objects
 *  still referenced by the currently-rendered state. */
function cloneDoubleElimData(data: DoubleElimData): DoubleElimData {
  return {
    winners: cloneRounds(data.winners),
    losers: cloneRounds(data.losers),
    grandFinal: cloneMatch(data.grandFinal),
    bracketReset: data.bracketReset ? cloneMatch(data.bracketReset) : null,
  };
}

function randomScore(): [winner: number, loser: number] {
  const winnerScore = Math.floor(Math.random() * 3) + 2; // 2-4
  const loserScore = Math.floor(Math.random() * winnerScore); // 0..winnerScore-1
  return [winnerScore, loserScore];
}

function simulateSingleElim(rounds: Round[]): Round[] {
  const next = cloneRounds(rounds);
  for (const round of next) {
    for (const m of round.matches) {
      if (m.status === "scheduled" && m.teamA && m.teamB) {
        const winner: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
        const [wScore, lScore] = randomScore();
        recordSingleElimResult(next, m.id, winner, winner === "A" ? wScore : lScore, winner === "A" ? lScore : wScore);
      }
    }
  }
  return next;
}

function allDoubleElimMatches(data: DoubleElimData): MatchNode[] {
  return [
    ...data.winners.flatMap((r) => r.matches),
    ...data.losers.flatMap((r) => r.matches),
    data.grandFinal,
    ...(data.bracketReset ? [data.bracketReset] : []),
  ];
}

function simulateDoubleElim(data: DoubleElimData): DoubleElimData {
  const next: DoubleElimData = cloneDoubleElimData(data);
  let progressed = true;
  let guard = 0;
  while (progressed && guard < 200) {
    progressed = false;
    guard++;
    for (const m of allDoubleElimMatches(next)) {
      if (m.status === "scheduled" && m.teamA && m.teamB && m.teamA.code !== "BYE" && m.teamB.code !== "BYE") {
        const winner: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
        const [wScore, lScore] = randomScore();
        recordDoubleElimResult(next, m.id, winner, winner === "A" ? wScore : lScore, winner === "A" ? lScore : wScore);
        progressed = true;
      }
    }
  }
  return next;
}

function clampTeamCount(n: number): number {
  if (Number.isNaN(n)) return MIN_TEAMS;
  return Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, Math.round(n)));
}

/** Counts decided vs total matches across whichever format is active, for
 *  the header's progress readout — mirrors the auction sandbox's
 *  sold/unsold tally living in its MultiviewBar. A bye slot is generated
 *  already-completed, so it counts toward "decided" without needing a
 *  score entered. */
function countProgress(
  format: FormatType,
  singleRounds: Round[] | null,
  doubleData: DoubleElimData | null
): { completed: number; total: number } {
  const matches =
    format === "single_elimination" ? singleRounds?.flatMap((r) => r.matches) ?? [] : doubleData ? allDoubleElimMatches(doubleData) : [];
  return {
    completed: matches.filter((m) => m.status === "completed").length,
    total: matches.length,
  };
}

/* ------------------------------------------------------------------ */
/*  Shared control-cluster atoms, restyled to match the auction         */
/*  sandbox's glass/color-mix chip language instead of flat tailwind    */
/*  utility pills — same job (labeled group of controls), consistent    */
/*  material.                                                           */
/* ------------------------------------------------------------------ */

function ControlCluster({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[9px] font-semibold uppercase"
        style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.13em", color: "var(--color-outline)" }}
      >
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase whitespace-nowrap transition-colors"
      style={{
        fontFamily: "var(--font-label-mono)",
        letterSpacing: "0.09em",
        background: active ? "color-mix(in srgb, var(--color-theme-orange) 16%, transparent)" : "rgba(255,255,255,0.03)",
        boxShadow: active
          ? "inset 0 0 0 1px color-mix(in srgb, var(--color-theme-orange) 50%, transparent)"
          : "inset 0 0 0 1px var(--color-border-overlay)",
        color: active ? "var(--color-theme-orange)" : "var(--color-outline)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ActionButton({
  onClick,
  disabled,
  solid,
  icon,
  children,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  solid?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        fontFamily: "var(--font-label-mono)",
        letterSpacing: "0.08em",
        background: solid ? "linear-gradient(135deg,#A87815,#E8C468)" : "rgba(255,255,255,0.03)",
        boxShadow: solid ? "none" : "inset 0 0 0 1px var(--color-border-overlay)",
        color: solid ? "#1a1304" : "var(--color-on-surface)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

// Floating chyron celebrating a decided champion — same job and same
// visual family as the auction sandbox's CommentaryOverlay: pinned,
// centered, non-blocking, keyed so it replays its entrance whenever a
// new champion is crowned (e.g. after a reshuffle + re-simulate).
function ChampionChyron({ name }: { name: string | null }) {
  if (!name) return null;
  return (
    <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center max-w-[560px] w-[92%]">
      <div
        key={name}
        className="chyron-in flex items-stretch overflow-hidden rounded-[3px]"
        style={{
          background: "rgba(8,8,8,0.88)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 12px 30px -10px rgba(0,0,0,0.6)",
        }}
      >
        <span className="shrink-0" style={{ width: 3, background: "var(--color-theme-orange)" }} />
        <div className="flex items-center gap-3 pl-3.5 pr-4 py-2.5">
          <PartyPopper size={14} color="var(--color-theme-orange)" />
          <span
            className="shrink-0 text-[10px] uppercase font-semibold"
            style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.11em", color: "var(--color-theme-orange)" }}
          >
            Champion
          </span>
          <span className="w-px self-stretch bg-white/10" />
          <span
            className="text-[13px] leading-snug"
            style={{
              fontFamily: "var(--font-headline-lg)",
              fontStyle: "italic",
              fontWeight: 700,
              color: "var(--color-on-surface)",
            }}
          >
            {name}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function BracketSandboxPage() {
  const [teamCount, setTeamCount] = useState<number>(8);
  const [customCountInput, setCustomCountInput] = useState<string>("");
  const [format, setFormat] = useState<FormatType>("single_elimination");
  const [showAdminOverlay, setShowAdminOverlay] = useState(false);

  // Lifted up from the admin panel so a watermark picked in the overlay
  // is the same one rendered on the live board underneath it — the two
  // consoles share one piece of state instead of drifting independently.
  const [logoSrc, setLogoSrc] = useState<string | null>(DEFAULT_LOGO_SRC);

  // Roster starts collapsed to one row — with up to 64 teams the wrapped
  // list can otherwise push the board itself below the fold before you've
  // even generated a bracket.
  const [rosterExpanded, setRosterExpanded] = useState(false);

  const baseTeams = useMemo(() => getDemoTeams(teamCount), [teamCount]);
  const [seededTeams, setSeededTeams] = useState<AdminTeam[]>(baseTeams);

  useEffect(() => {
    setSeededTeams(baseTeams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseTeams]);

  const [singleRounds, setSingleRounds] = useState<Round[] | null>(null);
  const [doubleData, setDoubleData] = useState<DoubleElimData | null>(null);

  useEffect(() => {
    if (seededTeams.length < 2) return;
    if (format === "single_elimination") {
      setSingleRounds(generateSingleElimination(seededTeams));
      setDoubleData(null);
    } else {
      setDoubleData(generateDoubleElimination(seededTeams));
      setSingleRounds(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seededTeams, format]);

  function reshuffleSeeding() {
    setSeededTeams(randomDraw(baseTeams));
  }

  function resetResults() {
    if (format === "single_elimination") setSingleRounds(generateSingleElimination(seededTeams));
    else setDoubleData(generateDoubleElimination(seededTeams));
  }

  function simulateAll() {
    if (format === "single_elimination" && singleRounds) setSingleRounds(simulateSingleElim(singleRounds));
    else if (format === "double_elimination" && doubleData) setDoubleData(simulateDoubleElim(doubleData));
  }

  function handleSingleResult(matchId: string, winner: "A" | "B", a: number, b: number) {
    if (!singleRounds) return;
    const next = cloneRounds(singleRounds);
    recordSingleElimResult(next, matchId, winner, a, b);
    setSingleRounds(next);
  }

  function handleDoubleResult(matchId: string, winner: "A" | "B", a: number, b: number) {
    setDoubleData((prev) => {
      if (!prev) return prev;
      const next = cloneDoubleElimData(prev);
      recordDoubleElimResult(next, matchId, winner, a, b);
      return next;
    });
  }

  function applyCustomCount() {
    if (customCountInput.trim() === "") return;
    const parsed = clampTeamCount(Number(customCountInput));
    setTeamCount(parsed);
    setCustomCountInput(parsed.toString());
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-selecting the same file later
  }

  const champion =
    format === "single_elimination"
      ? singleRounds
        ? championOf(singleRounds)
        : null
      : doubleData
      ? championOfDoubleElim(doubleData)
      : null;

  const { completed, total } = countProgress(format, singleRounds, doubleData);
  const hasResults = completed > 0;

  return (
    <div className="h-screen w-screen overflow-hidden relative flex flex-col">
      <style jsx global>{`
        @keyframes bracketFeedPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @keyframes chyronIn {
          0% { opacity: 0; transform: translateY(-16px) scale(0.97); }
          55% { opacity: 1; transform: translateY(2px) scale(1.005); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .chyron-in {
          animation: chyronIn 380ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .bracket-scanlines {
          background-image: repeating-linear-gradient(
            0deg,
            rgba(255, 255, 255, 0.012) 0px,
            rgba(255, 255, 255, 0.012) 1px,
            transparent 1px,
            transparent 3px
          );
        }
      `}</style>

      {/* Ambient texture — same scanline + top radial glow treatment as
          the auction sandbox, so the two sandboxes read as one product. */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bracket-scanlines"
        style={{
          background:
            "radial-gradient(900px 380px at 50% 0%, color-mix(in srgb, var(--color-theme-orange) 7%, transparent), transparent 65%), " +
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "auto, 48px 48px, 48px 48px",
        }}
      />

      {/* ── Console header — mirrors the auction sandbox's MultiviewBar: */}
      {/*    on-air-style status badge, a big italic readout, a progress  */}
      {/*    tally, and the panel-tally-style admin toggle on the right.  */}
      <div
        className="shrink-0 h-11 flex items-center justify-between px-4 relative z-20"
        style={{
          background: "linear-gradient(180deg, var(--color-surface-container-low), var(--color-surface-dim))",
          borderBottom: "1px solid var(--color-border-overlay)",
          boxShadow: "0 1px 0 rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-[3px]"
            style={{
              background: "color-mix(in srgb, var(--color-theme-orange) 14%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-theme-orange) 45%, transparent)",
            }}
          >
            <span
              className="w-[7px] h-[7px] rounded-full"
              style={{
                background: "var(--color-theme-orange)",
                animation: "bracketFeedPulse 1.6s ease-in-out infinite",
                boxShadow: "0 0 6px 1px color-mix(in srgb, var(--color-theme-orange) 60%, transparent)",
              }}
            />
            <span
              className="text-[10px] font-semibold uppercase"
              style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.11em", color: "var(--color-theme-orange)" }}
            >
              Sandbox
            </span>
          </div>

          <span className="w-px h-5" style={{ background: "var(--color-border-overlay)" }} />

          <div className="flex items-center gap-2">
            <Trophy className="w-3 h-3" style={{ color: "var(--color-outline)" }} />
            <span
              className="text-[12px] px-1.5 py-0.5 rounded-[2px]"
              style={{
                fontFamily: "var(--font-headline-lg)",
                fontStyle: "italic",
                fontWeight: 700,
                color: "var(--color-theme-orange)",
                letterSpacing: "0.03em",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid var(--color-border-overlay)",
              }}
            >
              {FORMAT_LABELS[format]}
            </span>
          </div>

          {total > 0 && (
            <div
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-[3px]"
              style={{
                background: "rgba(0,0,0,0.22)",
                border: `1px solid color-mix(in srgb, ${
                  completed === total ? "#3ddc84" : "var(--color-border-overlay)"
                } 45%, var(--color-border-overlay))`,
              }}
            >
              <span
                className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-[2px]"
                style={{
                  fontFamily: "var(--font-label-mono)",
                  letterSpacing: "0.06em",
                  color: completed === total ? "#08110c" : "var(--color-on-surface)",
                  background: completed === total ? "#3ddc84" : "transparent",
                }}
              >
                {completed === total ? "Decided" : "In Progress"}
              </span>
              <span
                className="text-[11px] tabular-nums"
                style={{ fontFamily: FONT_BODY, color: "var(--color-outline)" }}
              >
                {completed}/{total} matches
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Control deck — glass panel of labeled clusters, same border/  */}
      {/*    background material as the rest of the console.              */}
      <div
        className="shrink-0 relative z-10"
        style={{ background: "rgba(10,10,10,0.35)", borderBottom: "1px solid var(--color-border-overlay)" }}
      >
        <div className="flex flex-wrap items-start gap-x-8 gap-y-4 px-5 py-4">
          <ControlCluster label="Bracket size">
            {TEAM_COUNT_PRESETS.map((count) => (
              <Pill
                key={count}
                active={teamCount === count && customCountInput === ""}
                onClick={() => {
                  setTeamCount(count);
                  setCustomCountInput("");
                }}
              >
                {count}
              </Pill>
            ))}
            <input
              type="number"
              min={MIN_TEAMS}
              max={MAX_TEAMS}
              placeholder="Custom"
              value={customCountInput}
              onChange={(e) => setCustomCountInput(e.target.value)}
              onBlur={applyCustomCount}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyCustomCount();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-16 px-2 py-1.5 rounded-full text-[10px] font-bold text-center focus:outline-none"
              style={{
                fontFamily: "var(--font-label-mono)",
                background: "rgba(255,255,255,0.03)",
                boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                color: "var(--color-on-surface)",
              }}
            />
          </ControlCluster>

          <ControlCluster label="Format">
            {(Object.keys(FORMAT_LABELS) as FormatType[]).map((f) => (
              <Pill key={f} active={format === f} onClick={() => setFormat(f)}>
                {FORMAT_LABELS[f]}
              </Pill>
            ))}
          </ControlCluster>

          <ControlCluster label="Actions">
            <ActionButton onClick={reshuffleSeeding} title="Reshuffle seeding" icon={<Shuffle className="w-2.5 h-2.5" />}>
              Reshuffle
            </ActionButton>
            <ActionButton onClick={simulateAll} solid icon={<Sparkles className="w-2.5 h-2.5" />}>
              Simulate all
            </ActionButton>
            <ActionButton onClick={resetResults} disabled={!hasResults} icon={<RotateCcw className="w-2.5 h-2.5" />}>
              Reset
            </ActionButton>
          </ControlCluster>

          <ControlCluster label="Watermark">
            <input
              placeholder="Image URL"
              value={logoSrc && !logoSrc.startsWith("data:") ? logoSrc : ""}
              onChange={(e) => setLogoSrc(e.target.value || null)}
              className="px-2.5 py-1.5 rounded-full text-[11px] w-40 focus:outline-none"
              style={{
                fontFamily: FONT_BODY,
                background: "rgba(255,255,255,0.03)",
                boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                color: "var(--color-on-surface)",
              }}
            />
            <label
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase transition-all hover:brightness-110 active:scale-95 cursor-pointer"
              style={{
                fontFamily: "var(--font-label-mono)",
                letterSpacing: "0.08em",
                background: "rgba(255,255,255,0.03)",
                boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                color: "var(--color-on-surface)",
              }}
            >
              <ImagePlus className="w-2.5 h-2.5" />
              Upload
              <input type="file" accept="image/*" onChange={handleLogoFile} className="hidden" />
            </label>
            {logoSrc && logoSrc !== DEFAULT_LOGO_SRC && (
              <ActionButton onClick={() => setLogoSrc(DEFAULT_LOGO_SRC)} title="Reset to default watermark" icon={<RotateCcw className="w-2.5 h-2.5" />}>
                Reset
              </ActionButton>
            )}
            {logoSrc && (
              <ActionButton onClick={() => setLogoSrc(null)} title="Remove watermark" icon={<X className="w-2.5 h-2.5" />}>
                Clear
              </ActionButton>
            )}
          </ControlCluster>
        </div>

        {/* Roster — glass strip, same rgba(0,0,0,0.22) material used for
            the auction sandbox's compact readouts. */}
        <div
          className="flex items-start gap-3 px-5 py-2.5"
          style={{ background: "rgba(0,0,0,0.22)", borderTop: "1px solid var(--color-border-overlay)" }}
        >
          <span
            className="text-[9px] font-semibold uppercase shrink-0 pt-1.5"
            style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.1em", color: "var(--color-outline)" }}
          >
            Teams ({seededTeams.length})
          </span>
          <div
            className="flex-1 flex flex-wrap items-center gap-1.5 overflow-hidden transition-[max-height] duration-200 ease-out"
            style={{ maxHeight: rosterExpanded ? 999 : 30 }}
          >
            {seededTeams.map((t, i) => (
              <span
                key={t.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px]"
                style={{
                  fontFamily: FONT_BODY,
                  background: "rgba(255,255,255,0.03)",
                  boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                  color: "var(--color-on-surface)",
                }}
              >
                <span
                  className="text-[10px] tabular-nums"
                  style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}
                >
                  #{i + 1}
                </span>
                {t.name}
                <span
                  className="text-[10px] font-bold"
                  style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}
                >
                  {t.code}
                </span>
              </span>
            ))}
          </div>
          {seededTeams.length > 0 && (
            <button
              type="button"
              onClick={() => setRosterExpanded((v) => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-semibold uppercase shrink-0 transition-colors hover:brightness-125"
              style={{
                fontFamily: "var(--font-label-mono)",
                letterSpacing: "0.06em",
                color: "var(--color-outline)",
              }}
            >
              {rosterExpanded ? (
                <>
                  Collapse <ChevronUp className="w-2.5 h-2.5" />
                </>
              ) : (
                <>
                  Show all <ChevronDown className="w-2.5 h-2.5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <ChampionChyron name={champion?.name ?? null} />

      {/* ── Bracket board — scrolls independently under the fixed      */}
      {/*    console. hideHeader + !min-h-0 stop the board's own big    */}
      {/*    header/height from duplicating the console above. logoSrc  */}
      {/*    is the same lifted state the admin overlay writes to, so a */}
      {/*    watermark picked there shows here without a page reload.   */}
      <div className="flex-1 min-h-0 overflow-auto relative z-10">
        {format === "single_elimination" && singleRounds && (
          <TournamentBracket
            rounds={singleRounds}
            onRecordResult={handleSingleResult}
            hideHeader
            className="!min-h-0"
            logoSrc={logoSrc ?? undefined}
          />
        )}

        {format === "double_elimination" && doubleData && (
          <DoubleElimBoard
            data={doubleData}
            onRecordResult={handleDoubleResult}
            hideHeader
            className="!min-h-0"
            logoSrc={logoSrc ?? undefined}
          />
        )}
      </div>

      {showAdminOverlay && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <button
            type="button"
            onClick={() => setShowAdminOverlay(false)}
            className="fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors hover:brightness-110"
            style={{
              fontFamily: "var(--font-label-mono)",
              background: "rgba(13,17,23,0.96)",
              border: "1px solid var(--color-border-overlay)",
              color: "var(--color-on-surface)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            }}
          >
            <X className="w-3.5 h-3.5" />
            Close admin panel
          </button>
        </div>
      )}
    </div>
  );
}