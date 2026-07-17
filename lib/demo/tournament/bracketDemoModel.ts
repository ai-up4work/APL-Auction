// File: lib/demo/tournament/bracketDemoModel.ts
"use client";

import type { Round, MatchNode } from "@/components/demo/TournamentBracket";
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

export type FormatType = "single_elimination" | "double_elimination";
export type BracketMode = "demo" | "interactive";
export type BracketStatus = "live" | "paused" | "completed";

export interface CursorState {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  color: string;
  clicking: boolean;
}

export interface BracketDemoState {
  mode: BracketMode;
  status: BracketStatus;
  teamCount: number;
  format: FormatType;
  baseTeams: AdminTeam[];
  seededTeams: AdminTeam[];
  singleRounds: Round[] | null;
  doubleData: DoubleElimData | null;
  logoSrc: string | null;
  narratorText: string;
  cursor: CursorState;
}

const DEFAULT_LOGO_SRC = "/valiant-league-logo.png";

/* ------------------------------------------------------------------ */
/*  Clone + sim helpers — shared between the model (real clicks) and   */
/*  the orchestrator (bot clicks). Moved here from page.tsx so both    */
/*  sides of the auto-pilot / take-over split can reuse the exact      */
/*  same logic instead of drifting into two copies.                   */
/* ------------------------------------------------------------------ */

export function cloneMatch(m: MatchNode): MatchNode {
  return { ...m, teamA: m.teamA ? { ...m.teamA } : null, teamB: m.teamB ? { ...m.teamB } : null };
}

export function cloneRounds(rounds: Round[]): Round[] {
  return rounds.map((r) => ({ ...r, matches: r.matches.map(cloneMatch) }));
}

export function cloneDoubleElimData(data: DoubleElimData): DoubleElimData {
  return {
    winners: cloneRounds(data.winners),
    losers: cloneRounds(data.losers),
    grandFinal: cloneMatch(data.grandFinal),
    bracketReset: data.bracketReset ? cloneMatch(data.bracketReset) : null,
  };
}

export function randomScore(): [winner: number, loser: number] {
  const winnerScore = Math.floor(Math.random() * 3) + 2; // 2-4
  const loserScore = Math.floor(Math.random() * winnerScore); // 0..winnerScore-1
  return [winnerScore, loserScore];
}

export function allDoubleElimMatches(data: DoubleElimData): MatchNode[] {
  return [
    ...data.winners.flatMap((r) => r.matches),
    ...data.losers.flatMap((r) => r.matches),
    data.grandFinal,
    ...(data.bracketReset ? [data.bracketReset] : []),
  ];
}

export function countProgress(
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

function buildBracket(format: FormatType, teams: AdminTeam[]): Pick<BracketDemoState, "singleRounds" | "doubleData"> {
  if (teams.length < 2) return { singleRounds: null, doubleData: null };
  if (format === "single_elimination") {
    return { singleRounds: generateSingleElimination(teams), doubleData: null };
  }
  return { singleRounds: null, doubleData: generateDoubleElimination(teams) };
}

/* ------------------------------------------------------------------ */
/*  The store                                                          */
/* ------------------------------------------------------------------ */

class BracketDemoModel {
  private state: BracketDemoState;
  private listeners = new Set<() => void>();

  constructor() {
    const teamCount = 16;
    const format: FormatType = "single_elimination";
    const baseTeams = getDemoTeams(teamCount);
    const seededTeams = randomDraw(baseTeams);
    this.state = {
      mode: "demo",
      status: "live",
      teamCount,
      format,
      baseTeams,
      seededTeams,
      ...buildBracket(format, seededTeams),
      logoSrc: DEFAULT_LOGO_SRC,
      narratorText: "",
      cursor: { visible: false, x: 0, y: 0, label: "", color: "#c9971f", clicking: false },
    };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): BracketDemoState => this.state;

  private set(patch: Partial<BracketDemoState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Fires whenever a result is recorded, from EITHER the bot or a real
   *  click — the moment the bracket has a decided champion, the model
   *  flips itself to "completed" regardless of who made the winning
   *  click. This is what lets a person finish the bracket by hand and
   *  still get the same completion overlay the bot gets. */
  private maybeComplete() {
    const champ = this.getChampionName();
    if (champ && this.state.status !== "completed") {
      this.set({
        status: "completed",
        narratorText: `🏆 ${champ} wins the tournament!`,
        cursor: { ...this.state.cursor, visible: false },
      });
    }
  }

  setMode(mode: BracketMode) {
    this.set({ mode });
  }

  setStatus(status: BracketStatus) {
    this.set({ status });
  }

  pause() {
    if (this.state.status === "live") this.set({ status: "paused" });
  }

  resume() {
    if (this.state.status === "paused") this.set({ status: "live" });
  }

  setNarrator(text: string) {
    this.set({ narratorText: text });
  }

  setCursor(patch: Partial<CursorState>) {
    this.set({ cursor: { ...this.state.cursor, ...patch } });
  }

  setLogoSrc(src: string | null) {
    this.set({ logoSrc: src });
  }

  setTeamCount(n: number) {
    const baseTeams = getDemoTeams(n);
    const seededTeams = randomDraw(baseTeams);
    this.set({
      teamCount: n,
      baseTeams,
      seededTeams,
      ...buildBracket(this.state.format, seededTeams),
      status: "live",
      narratorText: "",
    });
  }

  setFormat(format: FormatType) {
    this.set({
      format,
      ...buildBracket(format, this.state.seededTeams),
      status: "live",
      narratorText: "",
    });
  }

  reshuffleSeeding() {
    const seededTeams = randomDraw(this.state.baseTeams);
    this.set({
      seededTeams,
      ...buildBracket(this.state.format, seededTeams),
      status: "live",
      narratorText: "",
    });
  }

  resetResults() {
    this.set({ ...buildBracket(this.state.format, this.state.seededTeams), status: "live", narratorText: "" });
  }

  recordResult(matchId: string, winner: "A" | "B", scoreA: number, scoreB: number) {
    if (this.state.format === "single_elimination" && this.state.singleRounds) {
      const next = cloneRounds(this.state.singleRounds);
      recordSingleElimResult(next, matchId, winner, scoreA, scoreB);
      this.set({ singleRounds: next });
    } else if (this.state.format === "double_elimination" && this.state.doubleData) {
      const next = cloneDoubleElimData(this.state.doubleData);
      recordDoubleElimResult(next, matchId, winner, scoreA, scoreB);
      this.set({ doubleData: next });
    }
    this.maybeComplete();
  }

  simulateAll() {
    if (this.state.format === "single_elimination" && this.state.singleRounds) {
      const next = cloneRounds(this.state.singleRounds);
      for (const round of next) {
        for (const m of round.matches) {
          if (m.status === "scheduled" && m.teamA && m.teamB) {
            const winner: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
            const [w, l] = randomScore();
            recordSingleElimResult(next, m.id, winner, winner === "A" ? w : l, winner === "A" ? l : w);
          }
        }
      }
      this.set({ singleRounds: next });
    } else if (this.state.format === "double_elimination" && this.state.doubleData) {
      const next = cloneDoubleElimData(this.state.doubleData);
      let progressed = true;
      let guard = 0;
      while (progressed && guard < 200) {
        progressed = false;
        guard++;
        for (const m of allDoubleElimMatches(next)) {
          if (m.status === "scheduled" && m.teamA && m.teamB && m.teamA.code !== "BYE" && m.teamB.code !== "BYE") {
            const winner: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
            const [w, l] = randomScore();
            recordDoubleElimResult(next, m.id, winner, winner === "A" ? w : l, winner === "A" ? l : w);
            progressed = true;
          }
        }
      }
      this.set({ doubleData: next });
    }
    this.maybeComplete();
  }

  /** Completion overlay's "Restart" — fresh seeding + a clean, unresolved
   *  bracket, same team count/format as before. */
  startNewCycle() {
    const seededTeams = randomDraw(this.state.baseTeams);
    this.set({
      seededTeams,
      ...buildBracket(this.state.format, seededTeams),
      status: "live",
      narratorText: "",
      cursor: { ...this.state.cursor, visible: false },
    });
  }

  getChampionName(): string | null {
    if (this.state.format === "single_elimination" && this.state.singleRounds) {
      return championOf(this.state.singleRounds)?.name ?? null;
    }
    if (this.state.format === "double_elimination" && this.state.doubleData) {
      return championOfDoubleElim(this.state.doubleData)?.name ?? null;
    }
    return null;
  }
}

export const bracketDemoModel = new BracketDemoModel();
export const getBracketSnapshot = () => bracketDemoModel.getSnapshot();