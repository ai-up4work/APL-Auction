"use client";

// Scripted "watch it run" driver for the cricket overlay sandbox —
// same shape as lib/demo/demoOrchestrator.ts in the auction sandbox
// (schedule/pause/resume/stop over a Pending timer list), but instead
// of driving a singleton store it's handed the page's own setters and
// moment handlers as callbacks, since liveState/channels live in local
// useState on page.tsx rather than an external model.

import type { LiveState, BatterState, BowlerState } from "@/lib/overlayBus";

type SetLiveState = React.Dispatch<React.SetStateAction<LiveState>>;

export type BallOutcome = 0 | 1 | 2 | 3 | "four" | "six" | "wicket";

// One over's worth of outcomes per script "beat" — deliberately varied
// so the demo shows off every moment type (four, six, wicket, milestone
// math) within a short loop rather than just dot balls.
const OVER_SCRIPT: BallOutcome[][] = [
  [1, "four", 0, 2, 1, 0],
  [0, "six", 1, "wicket", 1, 0],
  ["four", 1, 0, "six", 0, 1],
  [1, 1, "wicket", 0, "four", 1],
];

const BALL_INTERVAL_MS = 2200;
const OVER_GAP_MS = 900;
const INNINGS_GAP_MS = 3000;
const MATCH_WON_HOLD_MS = 6500;

const STRIKER_NAMES = ["Alaric Thorne", "Cedric Ashworth", "Tristan Blackwell", "Gareth Stormridge"];
const BOWLER_NAMES = ["Kael Nightshade", "Dorian Wraith", "Soren Blackmoor"];

type Pending = { timer: ReturnType<typeof setTimeout>; fireAt: number; remaining?: number; run: () => void };

export interface OrchestratorCallbacks {
  getLiveState: () => LiveState;
  setLiveState: SetLiveState;
  onBoundary: (moment: "four" | "six", batter: { name: string; runs: number; balls: number }) => void;
  onMilestone: (moment: "fifty" | "hundred", batter: { name: string; runs: number; balls: number; label?: string }) => void;
  onWicket: (payload: {
    batsmanOut: "striker" | "nonStriker";
    batter: { name: string; runs: number; balls: number };
    dismissalType: any;
    fielder: string;
    bowlerName: string;
  }) => void;
  onMatchWonAuto: (payload: { winningTeamName: string; margin: string; method: "runs" | "wickets" | "tie" }) => void;
  onInningsEnd: (payload: { target: number; previousInningsRuns: number; inningsNumber: 1 | 2 }) => void;
  restartMatch: () => void;
  logEvent: (label: string) => void;
  teamNames: { a: string; b: string };
}

function freshBatter(name: string): BatterState {
  return { name, runs: 0, balls: 0, fours: 0, sixes: 0, imageUrl: undefined };
}
function freshBowler(name: string): BowlerState {
  return { name, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 };
}

export class OverlayOrchestrator {
  private cb: OrchestratorCallbacks | null = null;
  private timers: Pending[] = [];
  private running = false;
  private paused = false;
  private ballCursor = 0; // flat index into the repeating OVER_SCRIPT
  private strikerIdx = 0;
  private bowlerIdx = 0;
  private inningsNumber: 1 | 2 = 1;
  private firstInningsRuns = 0;

  private schedule(run: () => void, delayMs: number) {
    const fireAt = Date.now() + delayMs;
    const timer = setTimeout(() => {
      this.timers = this.timers.filter((t) => t.timer !== timer);
      run();
    }, delayMs);
    this.timers.push({ timer, fireAt, run });
  }

  start(cb: OrchestratorCallbacks) {
    if (this.running) return;
    this.cb = cb;
    this.running = true;
    this.paused = false;
    cb.restartMatch();
    this.inningsNumber = 1;
    this.firstInningsRuns = 0;
    this.ballCursor = 0;
    this.strikerIdx = 0;
    this.bowlerIdx = 0;
    this.schedule(() => this.runNextBall(), 800);
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.timers.forEach((t) => clearTimeout(t.timer));
    this.timers = [];
    this.cb = null;
  }

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    const now = Date.now();
    this.timers = this.timers.map((t) => {
      clearTimeout(t.timer);
      return { ...t, remaining: Math.max(0, t.fireAt - now) };
    });
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    const toResume = this.timers;
    this.timers = [];
    toResume.forEach((t) => this.schedule(t.run, t.remaining ?? 0));
  }

  isPaused() {
    return this.paused;
  }

  private runNextBall() {
    if (!this.running || !this.cb) return;
    const over = OVER_SCRIPT[Math.floor(this.ballCursor / 6) % OVER_SCRIPT.length];
    const ballInOver = this.ballCursor % 6;
    const outcome = over[ballInOver];

    this.applyBall(outcome);
    this.ballCursor += 1;

    const overJustEnded = ballInOver === 5;
    const delay = overJustEnded ? BALL_INTERVAL_MS + OVER_GAP_MS : BALL_INTERVAL_MS;

    // End innings every 4 overs (24 balls) for pacing — swap in a
    // second-innings chase, then call it a match after that.
    if (overJustEnded && (this.ballCursor / 6) % 4 === 0) {
      this.schedule(() => this.endInningsOrMatch(), delay);
    } else {
      this.schedule(() => this.runNextBall(), delay);
    }
  }

  private applyBall(outcome: BallOutcome) {
    const cb = this.cb!;
    const snap = cb.getLiveState();
    const strikerName = STRIKER_NAMES[this.strikerIdx % STRIKER_NAMES.length];
    const bowlerName = BOWLER_NAMES[this.bowlerIdx % BOWLER_NAMES.length];

    const striker: BatterState = snap.striker.name === strikerName ? snap.striker : freshBatter(strikerName);
    const bowler: BowlerState = snap.bowler.name === bowlerName ? snap.bowler : freshBowler(bowlerName);

    let runsAdded = 0;
    let isWicket = false;
    let nextStriker = striker;

    if (outcome === "wicket") {
      isWicket = true;
      this.strikerIdx += 1;
      nextStriker = freshBatter(STRIKER_NAMES[this.strikerIdx % STRIKER_NAMES.length]);
    } else {
      runsAdded = outcome === "four" ? 4 : outcome === "six" ? 6 : (outcome as number);
      nextStriker = {
        ...striker,
        runs: striker.runs + runsAdded,
        balls: striker.balls + 1,
        fours: striker.fours + (outcome === "four" ? 1 : 0),
        sixes: striker.sixes + (outcome === "six" ? 1 : 0),
      };
    }

    const balls = (snap.score.balls + 1) % 6;
    const overs = snap.score.overs + (balls === 0 ? 1 : 0);

    cb.setLiveState((prev: LiveState) => ({
      ...prev,
      score: { runs: prev.score.runs + runsAdded, wickets: prev.score.wickets + (isWicket ? 1 : 0), overs, balls },
      striker: nextStriker,
      bowler: { ...bowler, runs: bowler.runs + runsAdded, balls: bowler.balls + 1, wickets: bowler.wickets + (isWicket ? 1 : 0) },
      matchBoundaries: {
        fours: prev.matchBoundaries.fours + (outcome === "four" ? 1 : 0),
        sixes: prev.matchBoundaries.sixes + (outcome === "six" ? 1 : 0),
      },
      thisOver: [...(prev.thisOver ?? []).slice(-5), isWicket ? "W" : String(outcome)],
    }));

    if (outcome === "four" || outcome === "six") {
      cb.onBoundary(outcome, { name: striker.name, runs: nextStriker.runs, balls: nextStriker.balls });
    } else if (isWicket) {
      cb.onWicket({
        batsmanOut: "striker",
        batter: { name: striker.name, runs: striker.runs, balls: striker.balls },
        dismissalType: "bowled",
        fielder: "—",
        bowlerName: bowler.name,
      });
    }

    // Milestone check on the *updated* total.
    if (!isWicket && striker.runs < 50 && nextStriker.runs >= 50) {
      cb.onMilestone("fifty", { name: nextStriker.name, runs: nextStriker.runs, balls: nextStriker.balls });
    } else if (!isWicket && striker.runs < 100 && nextStriker.runs >= 100) {
      cb.onMilestone("hundred", { name: nextStriker.name, runs: nextStriker.runs, balls: nextStriker.balls });
    }
  }

  private endInningsOrMatch() {
    const cb = this.cb!;
    if (!this.running) return;
    const snap = cb.getLiveState();

    if (this.inningsNumber === 1) {
      this.firstInningsRuns = snap.score.runs;
      const target = snap.score.runs + 1;
      cb.onInningsEnd({ target, previousInningsRuns: snap.score.runs, inningsNumber: 1 });
      cb.setLiveState((prev: LiveState) => ({
        ...prev,
        score: { runs: 0, wickets: 0, overs: 0, balls: 0 },
        striker: freshBatter(STRIKER_NAMES[0]),
        nonStriker: freshBatter(STRIKER_NAMES[1]),
        bowler: freshBowler(BOWLER_NAMES[0]),
        target,
        inningsNumber: 2,
      }));
      this.inningsNumber = 2;
      this.strikerIdx = 0;
      this.bowlerIdx = 0;
      this.schedule(() => this.runNextBall(), INNINGS_GAP_MS);
    } else {
      const finalRuns = snap.score.runs;
      const wonBattingSide = finalRuns >= this.firstInningsRuns + 1;
      cb.onMatchWonAuto({
        winningTeamName: wonBattingSide ? cb.teamNames.b : cb.teamNames.a,
        margin: wonBattingSide ? `${10 - snap.score.wickets} wickets` : `${this.firstInningsRuns - finalRuns} runs`,
        method: wonBattingSide ? "wickets" : "runs",
      });
      cb.setLiveState((prev: LiveState) => ({ ...prev, matchComplete: true }));
      cb.logEvent("Auto-demo: match complete — looping to a fresh match");
      this.schedule(() => this.start(cb), MATCH_WON_HOLD_MS);
    }
  }
}

export const overlayOrchestrator = new OverlayOrchestrator();