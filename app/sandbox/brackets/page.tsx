// File: app/sandbox/brackets/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { Shuffle, Sparkles, RotateCcw, Settings2, X } from "lucide-react";

import TournamentBracket from "@/components/demo/TournamentBracketEditable";
import type { Round, MatchNode } from "@/components/demo/TournamentBracket";
import DoubleElimBoard from "@/components/demo/DoubleElimBoard";
import FormatDescription from "@/components/tournament/FormatDescription";
import TournamentAdminPanel from "@/components/demo/TournamentAdminPanel";

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
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
};

const TEAM_COUNT_OPTIONS = [4, 8, 16, 32] as const;

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

/** Deep-clones every match object in a DoubleElimData tree. This matters
 *  because recordDoubleElimResult / advanceDoubleElim mutate match objects
 *  IN PLACE (target.teamA = {...}, match.status = "completed", etc). If we
 *  hand them a structure that still shares match-object references with
 *  the current React state (e.g. a naive `{ ...doubleData }` shallow copy),
 *  those mutations land on the exact objects already rendered, and a
 *  second click fired before the first render commits can read a stale
 *  `doubleData` closure while the underlying objects have already moved —
 *  producing exactly "click a winner, nothing updates, next click reveals
 *  two updates at once." Always clone before mutating. */
function cloneDoubleElimData(data: DoubleElimData): DoubleElimData {
  return {
    winners: cloneRounds(data.winners),
    losers: cloneRounds(data.losers),
    grandFinal: cloneMatch(data.grandFinal),
    bracketReset: data.bracketReset ? cloneMatch(data.bracketReset) : null,
  };
}

/** Winner always outscores the loser, kept in a small realistic range. */
function randomScore(): [winner: number, loser: number] {
  const winnerScore = Math.floor(Math.random() * 3) + 2; // 2-4
  const loserScore = Math.floor(Math.random() * winnerScore); // 0..winnerScore-1
  return [winnerScore, loserScore];
}

function simulateSingleElim(rounds: Round[]): Round[] {
  const next = cloneRounds(rounds);
  // Rounds are processed in order, so by the time we reach round N every
  // match that could have advanced a winner into it already has.
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

  // Winners/losers rounds don't resolve in a single top-to-bottom sweep —
  // a losers-bracket slot can depend on a winners-bracket round that's
  // still a couple of iterations away, and a bracket reset only gets
  // created *after* the grand final is decided. Keep sweeping until a
  // full pass makes no further progress.
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

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function BracketSandboxPage() {
  const [teamCount, setTeamCount] = useState<(typeof TEAM_COUNT_OPTIONS)[number]>(8);
  const [format, setFormat] = useState<FormatType>("single_elimination");
  const [showAdminOverlay, setShowAdminOverlay] = useState(false);

  // Locked pool for the current size — same 32-team roster every time,
  // just sliced differently. New ids each time teamCount changes so a
  // fresh bracket doesn't collide with a stale one.
  const baseTeams = useMemo(() => getDemoTeams(teamCount), [teamCount]);
  const [seededTeams, setSeededTeams] = useState<AdminTeam[]>(baseTeams);

  useEffect(() => {
    setSeededTeams(baseTeams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseTeams]);

  const [singleRounds, setSingleRounds] = useState<Round[] | null>(null);
  const [doubleData, setDoubleData] = useState<DoubleElimData | null>(null);

  // Auto-generate whenever the seeded roster or format changes — this is
  // a sandbox, so there's no reason to make someone click "Generate"
  // before they can see anything.
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
    // Functional update: always operate on the freshest committed state,
    // never a closure that might be stale if clicks fire in quick
    // succession. Deep-clone before mutating (see cloneDoubleElimData) so
    // recordDoubleElimResult never mutates objects still referenced by
    // the currently-rendered props.
    setDoubleData((prev) => {
      if (!prev) return prev;
      const next = cloneDoubleElimData(prev);
      recordDoubleElimResult(next, matchId, winner, a, b);
      return next;
    });
  }

  const champion =
    format === "single_elimination"
      ? singleRounds
        ? championOf(singleRounds)
        : null
      : doubleData
      ? championOfDoubleElim(doubleData)
      : null;

  const hasResults =
    format === "single_elimination"
      ? !!singleRounds?.some((r) => r.matches.some((m) => m.status === "completed"))
      : !!doubleData && allDoubleElimMatches(doubleData).some((m) => m.status === "completed");

  return (
    <div className="min-h-screen w-full bg-background text-on-surface p-6">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="font-label-mono text-[10px] font-black uppercase tracking-[0.3em] text-theme-orange">
              Bracket Sandbox
            </span>
            <h1 className="font-headline-lg font-bold text-3xl mt-1.5">Try out bracket generation</h1>
            <p className="font-body-md text-sm text-outline mt-1.5 max-w-xl">
              Teams are preset — pick a bracket size and format, then play through results yourself or let the
              sandbox simulate the whole thing instantly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdminOverlay(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-low border border-border-overlay text-xs font-label-mono font-bold uppercase tracking-wide text-outline hover:text-on-surface hover:border-theme-orange/40 transition-colors shrink-0"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Open full Admin Panel
          </button>
        </header>

        {/* Team size selector */}
        <section className="flex flex-wrap items-center gap-2">
          <span className="font-label-mono text-[10px] font-black uppercase tracking-widest text-on-surface-variant mr-1">
            Bracket size
          </span>
          {TEAM_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setTeamCount(count)}
              className={`px-4 py-2 rounded-full text-[11px] font-label-mono font-black uppercase tracking-widest border transition-colors ${
                teamCount === count
                  ? "bg-theme-orange border-theme-orange text-on-primary"
                  : "bg-surface-container-low border-border-overlay text-outline"
              }`}
            >
              {count} teams
            </button>
          ))}
        </section>

        {/* Format selector */}
        <section className="flex flex-wrap gap-2">
          {(Object.keys(FORMAT_LABELS) as FormatType[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`px-4 py-2 rounded-full text-[11px] font-label-mono font-black uppercase tracking-widest border transition-colors ${
                format === f
                  ? "bg-theme-orange border-theme-orange text-on-primary"
                  : "bg-surface-container-low border-border-overlay text-outline"
              }`}
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </section>

        <FormatDescription format={format} />

        {/* Locked roster preview */}
        <section className="rounded-xl border border-border-overlay bg-surface-container-low p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="font-label-mono text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
              Teams ({seededTeams.length}) <span className="text-outline normal-case font-medium">· locked roster</span>
            </h2>
            <button
              type="button"
              onClick={reshuffleSeeding}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container border border-border-overlay text-[11px] font-label-mono font-bold uppercase tracking-wide text-outline hover:text-on-surface transition-colors"
            >
              <Shuffle className="w-3 h-3" />
              Reshuffle seeding
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {seededTeams.map((t, i) => (
              <span
                key={t.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container border border-border-overlay text-xs font-label-mono"
              >
                <span className="text-outline">#{i + 1}</span> {t.name}{" "}
                <span className="text-theme-orange font-bold">{t.code}</span>
              </span>
            ))}
          </div>
        </section>

        {/* Actions */}
        <section className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={simulateAll}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-theme-orange text-on-primary text-xs font-label-mono font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Simulate random results
          </button>
          <button
            type="button"
            onClick={resetResults}
            disabled={!hasResults}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-surface-container-low border border-border-overlay text-xs font-label-mono font-black uppercase tracking-widest text-outline hover:text-on-surface transition-colors disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset results
          </button>
        </section>

        {champion && (
          <div className="rounded-xl border border-theme-orange/40 bg-theme-orange/10 px-4 py-3 font-label-mono text-sm">
            🏆 Champion: <span className="font-black text-theme-orange">{champion.name}</span>
          </div>
        )}

        {/* Single elimination — score entry happens right inside each
            match card (MatchResultCard, via TournamentBracketEditable),
            exactly like the double-elim board below. No separate
            results grid needed. */}
        {format === "single_elimination" && singleRounds && (
          <TournamentBracket
            rounds={singleRounds}
            title="Bracket Preview"
            onRecordResult={handleSingleResult}
          />
        )}

        {/* Double elimination */}
        {format === "double_elimination" && doubleData && (
          <DoubleElimBoard data={doubleData} onRecordResult={handleDoubleResult} />
        )}
      </div>

      {/* Full admin panel, available in-page as an overlay rather than a
          separate route — same page, just a different mode. */}
      {showAdminOverlay && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <button
            type="button"
            onClick={() => setShowAdminOverlay(false)}
            className="fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container border border-border-overlay text-xs font-label-mono font-bold uppercase tracking-wide text-outline hover:text-on-surface shadow-xl transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Close admin panel
          </button>
          <TournamentAdminPanel />
        </div>
      )}
    </div>
  );
}