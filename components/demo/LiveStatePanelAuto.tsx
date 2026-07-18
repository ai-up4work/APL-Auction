"use client";

import React, { useEffect, useRef, useState } from "react";
import { MonitorPlay, Pause, Play, LayoutPanelLeft } from "lucide-react";
import LiveStatePanel, { type LiveStatePanelHandle, type LiveStatePanelProps } from "./LiveStatePanel";
import DemoCursor from "@/components/demo/DemoCursor";
import { useDemoCursor } from "@/hooks/useDemoCursor";
import { EXTRA_OPTIONS } from "@/hooks/useLiveScoringEngine";
import type { SquadPlayer } from "@/lib/overlayBus";

const EXTRA_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  EXTRA_OPTIONS.map((o) => [o.key, o.label])
);
function extraLabel(value: string): string {
  return EXTRA_LABEL_BY_VALUE[value] ?? value;
}

const EXTRA_EXPLAINERS: Record<string, string> = {
  wide: "too wide for the batter to reasonably play — it adds a run and doesn't count as a legal delivery, so the over doesn't shorten.",
  noBall: "an illegal delivery, usually overstepping the crease — it adds a run, doesn't count as a legal ball, and gifts the batter a Free Hit next delivery.",
  bye: "the ball goes through to the keeper untouched but the batters still run — credited as extras, not added to the batter's own score.",
  legBye: "the ball strikes the batter's body rather than the bat and the batters run — also credited as extras, not to the batter.",
};

const DISMISSAL_EXPLAINERS: Record<string, string> = {
  bowled: "the ball has gone straight through and hit the stumps — the most clear-cut dismissal there is.",
  caught: "the batter hit the ball in the air and a fielder caught it before it touched the ground.",
  runOut: "the fielding side broke the stumps with the batters out of their ground mid-run — it doesn't go against the bowler's figures.",
  lbw: "leg before wicket — the ball would have gone on to hit the stumps but was blocked by the batter's body instead of the bat.",
  stumped: "the wicketkeeper broke the stumps while the batter had stepped out of their crease and missed the ball.",
  hitWicket: "the batter dislodged their own stumps with the bat or body while playing a shot.",
  caughtAndBowled: "the bowler caught their own delivery back off the bat before it hit the ground.",
  retired: "the batter has left the field and isn't continuing their innings right now.",
  obstructingField: "the batter illegally interfered with a fielder trying to make a play.",
  timedOut: "the incoming batter failed to reach the crease in time to take strike.",
};
function dismissalExplainer(type: string): string {
  return DISMISSAL_EXPLAINERS[type] ?? "a dismissal has been recorded for this batter.";
}

// Dismissal types where naming a specific fielder is meaningful.
const FIELDER_RELEVANT_DISMISSALS = new Set(["caught", "runOut", "stumped"]);

const RUN_COLOR = "#c9971f";
const WICKET_COLOR = "#e5484d";
const CREW_COLOR = "#60a5fa";
const FLOW_COLOR = "#3ddc84";
const UNDO_COLOR = "#f5a623";

const POLL_MS = 350;
const STEP_GAP_MS = 550;
const BALL_GAP_MS = 900;
const DIALOG_SETTLE_MS = 500;
const CYCLE_RESTART_GAP_MS = 2200;
const COMMENTARY_LEAD_MS = 350;
const POST_MOMENT_HOLD_MS = 2000;

const LEGAL_BALLS_PER_OVER = 6;

const UNCAPPED_FORMAT_SAFETY_BALLS = 40 * 6;

const STRIKE_ROTATION_CALLOUT_CHANCE = 0.35;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function pickWeighted<T>(table: Array<[T, number]>): T {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [val, w] of table) {
    if (r < w) return val;
    r -= w;
  }
  return table[table.length - 1][0];
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[randomInt(0, arr.length - 1)];
}

type PlainRun = 0 | 1 | 2 | 3 | 4 | 6;

// Two weighting tables for the *unscripted fallback* portion of an
// innings. AGGRESSIVE is used for a chase we want the batting side to
// win (more boundaries, fewer dots) so the target gets knocked off with
// wickets in hand. CONSERVATIVE is used when we want the innings to run
// out of overs instead (more dots/singles, fewer boundaries), so the
// defending side wins by runs. Alternating between the two across match
// cycles means both win conditions (method: "wickets" vs "runs") get
// demonstrated over time instead of always the same outcome.
const NEUTRAL_RUN_TABLE: Array<[PlainRun, number]> = [
  [0, 34],
  [1, 30],
  [2, 9],
  [3, 2],
  [4, 15],
  [6, 10],
];
const AGGRESSIVE_RUN_TABLE: Array<[PlainRun, number]> = [
  [0, 14],
  [1, 26],
  [2, 12],
  [3, 3],
  [4, 27],
  [6, 18],
];
const CONSERVATIVE_RUN_TABLE: Array<[PlainRun, number]> = [
  [0, 52],
  [1, 30],
  [2, 8],
  [3, 2],
  [4, 6],
  [6, 2],
];

type DeliveryKind = { type: "run"; value: PlainRun } | { type: "wicket" } | { type: "extra"; extra: string };

function pickDelivery(runTable: Array<[PlainRun, number]>): DeliveryKind {
  const roll = Math.random();
  if (roll < 0.045) return { type: "wicket" };
  if (roll < 0.095) {
    const extra = pickWeighted<string>([
      ["wide", 40],
      ["noBall", 25],
      ["bye", 20],
      ["legBye", 15],
    ]);
    return { type: "extra", extra };
  }
  return { type: "run", value: pickWeighted(runTable) };
}

// ------------------------------------------------------------------
// THE COMPLETE MATCH SCRIPT
//
// Innings 1 is no longer purely random — it's a fixed, ordered beat
// sheet that guarantees every showcased capability appears, in this
// order, before the driver falls back to normal (weighted-random)
// scoring for whatever's left of the innings:
//
//   1. Dot ball                              6. Wide
//   2. Single                                 7. No ball -> Free Hit ->
//   3. Bye                                       appeal (locked to Run
//   4. Two                                       Out) -> free-hit ball
//   5. Leg bye                                   scored -> Free Hit
//                                                 cancelled
//   8. Four                                  9. Six
//  10. Manual "Swap Strike" demo            11. Boundary push to Fifty
//  12. Wicket — Bowled                      13. Wicket — Caught
//  14. Wicket — LBW                         15. Wicket — Stumped
//  16. Wicket — Hit Wicket                  17. Wicket — Caught & Bowled
//  18. Wicket — Run Out (2 runs completed)  19. Undo Last Ball demo
//  20. (fallback) normal random play, real bowler rotation, until the
//      innings genuinely ends — all out or overs complete. A maiden can
//      occur organically here.
//
// Innings 2 (the chase) isn't scripted ball-by-ball — the number of
// deliveries needed depends on what innings 1 actually scored — but its
// *bias* is scripted: even-numbered match cycles chase aggressively (the
// batting side wins by wickets), odd-numbered cycles chase
// conservatively (the bowling side defends and wins by runs). Over
// several loops of the demo, both win methods get shown.
//
// End of every match: Undo the result -> re-confirm End Match -> Restart
// Match -> loop back to a fresh Innings 1 script.
// ------------------------------------------------------------------

type ScriptBeat =
  | { kind: "run"; value: PlainRun }
  | { kind: "extra"; extra: string }
  | { kind: "wicket"; who: "striker" | "nonstriker"; forceDismissal?: string; runsCompleted?: number }
  | { kind: "swapStrike" }
  | { kind: "milestonePush" }
  | { kind: "undo" };

function buildInningsOneScript(): ScriptBeat[] {
  return [
    { kind: "run", value: 0 },
    { kind: "run", value: 1 },
    { kind: "extra", extra: "bye" },
    { kind: "run", value: 2 },
    { kind: "extra", extra: "legBye" },
    { kind: "run", value: 3 },
    { kind: "extra", extra: "wide" },
    { kind: "extra", extra: "noBall" }, // free-hit sequence fires automatically inside playExtra
    { kind: "run", value: 4 },
    { kind: "run", value: 6 },
    { kind: "swapStrike" },
    { kind: "milestonePush" },
    { kind: "wicket", who: "striker", forceDismissal: "bowled" },
    { kind: "wicket", who: "striker", forceDismissal: "caught" },
    { kind: "wicket", who: "striker", forceDismissal: "lbw" },
    { kind: "wicket", who: "striker", forceDismissal: "stumped" },
    { kind: "wicket", who: "striker", forceDismissal: "hitWicket" },
    { kind: "wicket", who: "striker", forceDismissal: "caughtAndBowled" },
    { kind: "wicket", who: "nonstriker", forceDismissal: "runOut", runsCompleted: 2 },
    { kind: "undo" },
  ];
}

class ScriptedDriver {
  private handleGetter: () => LiveStatePanelHandle | null;
  private cursorCtl: ReturnType<typeof useDemoCursor>;
  private onLog: (s: string) => void;
  private running = false;
  private generation = 0;

  private paused = false;
  private pauseWaiters: Array<() => void> = [];

  private legalBallsThisOver = 0;

  // Counts completed match cycles so innings-2 chase bias can alternate
  // between "batting side wins" and "bowling side wins" over time.
  private cycleCount = 0;

  constructor(
    handleGetter: () => LiveStatePanelHandle | null,
    cursorCtl: ReturnType<typeof useDemoCursor>,
    onLog: (s: string) => void
  ) {
    this.handleGetter = handleGetter;
    this.cursorCtl = cursorCtl;
    this.onLog = onLog;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.generation += 1;
    const gen = this.generation;
    this.runLoop(gen);
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.pauseWaiters.forEach((w) => w());
    this.pauseWaiters = [];
    this.generation += 1;
    this.cursorCtl.reset();
    this.cursorCtl.hide();
  }

  // Pausing simply stops the internal clock: every scripted step is a
  // single `await this.beat(...)` (or an await inside cursorCtl), and
  // `waitIfPaused` blocks right there until resume() wakes it back up.
  // Nothing about "where we are in the script" is lost — resuming
  // continues from literally the next line of code that was about to
  // run, whether that's mid-innings-1-script, mid-chase, or mid-dialog.
  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.cursorCtl.hide();
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    const waiters = this.pauseWaiters;
    this.pauseWaiters = [];
    waiters.forEach((w) => w());
  }

  isPaused() {
    return this.paused;
  }

  private isCurrent(gen: number) {
    return this.running && gen === this.generation;
  }

  private async waitIfPaused(gen: number) {
    while (this.isCurrent(gen) && this.paused) {
      await new Promise<void>((resolve) => this.pauseWaiters.push(resolve));
    }
  }

  private async beat(gen: number, ms: number) {
    await this.waitIfPaused(gen);
    if (!this.isCurrent(gen)) return;
    await sleep(ms);
    await this.waitIfPaused(gen);
  }

  private async runLoop(gen: number) {
    while (this.isCurrent(gen)) {
      try {
        await this.runOneMatchCycle(gen);
      } catch {
        // A bad element lookup or unexpected state shouldn't crash the
        // driver — just wait a beat and try the cycle again.
      }
      if (!this.isCurrent(gen)) return;
      this.cycleCount += 1;
      await this.beat(gen, CYCLE_RESTART_GAP_MS);
    }
  }

  private h(): LiveStatePanelHandle {
    const handle = this.handleGetter();
    if (!handle) throw new Error("panel not mounted");
    return handle;
  }

  private async waitForHandle(gen: number) {
    while (this.isCurrent(gen) && !this.handleGetter()) {
      await this.beat(gen, POLL_MS);
    }
  }

  private async announcedClick(gen: number, id: string, cursorLabel: string, before: string, after: string, color: string) {
    await this.waitIfPaused(gen);
    if (!this.isCurrent(gen)) return false;
    this.onLog(before);
    await this.beat(gen, COMMENTARY_LEAD_MS);
    if (!this.isCurrent(gen)) return false;
    const ok = await this.cursorCtl.click(id, cursorLabel, color);
    if (!this.isCurrent(gen)) return false;
    if (ok) this.onLog(after);
    return ok;
  }

  private async announcedClickByText(gen: number, containerId: string, text: string, cursorLabel: string, before: string, after: string, color: string) {
    await this.waitIfPaused(gen);
    if (!this.isCurrent(gen)) return false;
    this.onLog(before);
    await this.beat(gen, COMMENTARY_LEAD_MS);
    if (!this.isCurrent(gen)) return false;
    const ok = await this.cursorCtl.clickByText(containerId, text, cursorLabel, color);
    if (!this.isCurrent(gen)) return false;
    if (ok) this.onLog(after);
    return ok;
  }

  private async announcedType(gen: number, id: string, text: string, cursorLabel: string, before: string, after: string, color: string) {
    await this.waitIfPaused(gen);
    if (!this.isCurrent(gen)) return false;
    this.onLog(before);
    await this.beat(gen, COMMENTARY_LEAD_MS);
    if (!this.isCurrent(gen)) return false;
    const ok = await this.cursorCtl.typeText(id, text, cursorLabel, color);
    if (!this.isCurrent(gen)) return false;
    if (ok) this.onLog(after);
    return ok;
  }

  // Commentary for a plain (non-extra, non-wicket) run value. Only runs
  // that genuinely rotate the strike (odd values: 1 and 3) claim to be
  // "rotating the strike" in the pre-ball line — 2 leaves the batters
  // where they started, so it gets its own neutral wording instead of
  // reusing the rotation language a viewer could catch as wrong.
  private runCommentary(striker: string, r: PlainRun): { before: string; after: string } {
    switch (r) {
      case 0:
        return { before: `Bowled to ${striker} — clicking "0" to record a dot ball.`, after: `Dot ball. ${striker} defends it, no run taken.` };
      case 1:
        return {
          before: `${striker} looks to rotate the strike — clicking "1" to record a single.`,
          after: `${striker} works it away and the batters cross for a single.`,
        };
      case 3:
        return {
          before: `${striker} pushes for three — clicking "3" to record the run, rotating the strike in the process.`,
          after: `${striker} and the non-striker sprint hard for the third — strike rotates.`,
        };
      case 2:
        return {
          before: `${striker} finds a gap — clicking "2" to record two runs.`,
          after: `${striker} and the non-striker cross twice — strike stays put.`,
        };
      case 4:
        return {
          before: `${striker} shapes up to go big — clicking "4" to send this one racing to the boundary.`,
          after: `FOUR! ${striker} finds the gap in the field for a boundary.`,
        };
      case 6:
        return { before: `${striker} clears the front leg — clicking "6" for the maximum.`, after: `SIX! ${striker} clears the ropes with a big strike.` };
      default:
        return {
          before: `${striker} faces up — clicking "${r}" to record ${r} run${r > 1 ? "s" : ""}.`,
          after: `${striker} gets ${r} run${r > 1 ? "s" : ""} away.`,
        };
    }
  }

  private pickAvailable(squad: SquadPlayer[], dismissed: Set<string>, exclude: Set<string>): SquadPlayer | undefined {
    return squad.find((p) => !dismissed.has(p.name) && !exclude.has(p.name));
  }

  private async ensureAssignments(gen: number): Promise<boolean> {
    while (this.isCurrent(gen)) {
        await this.waitForHandle(gen);
        if (!this.isCurrent(gen)) return false;
        if (!this.h().isControlsLocked()) return true;

        const batting = this.h().getBattingSquad();
        const bowling = this.h().getBowlingSquad();
        const dismissed = this.h().getDismissedNames();

        if (!this.h().getStrikerName()) {
        const exclude = new Set<string>([this.h().getNonStrikerName()].filter(Boolean));
        const pick = this.pickAvailable(batting, dismissed, exclude);
        if (pick) {
            await this.announcedClick(
            gen,
            "demo-slot-striker",
            "Open striker slot",
            "Need a striker at the crease — opening the striker slot to bring in the next available batter.",
            `Striker slot opened — ${pick.name} is next in, since earlier batters are either out or already batting.`,
            CREW_COLOR
            );
            if (!this.isCurrent(gen)) return false;
            await this.announcedClick(
            gen,
            `demo-player-${pick.id}`,
            `Pick ${pick.name}`,
            `Selecting ${pick.name} — they haven't been dismissed and aren't already occupying another slot.`,
            `${pick.name} is on strike.`,
            CREW_COLOR
            );
        }
        }
        if (!this.isCurrent(gen)) return false;

        // Fresh read — reflects the striker assignment that may have just
        // happened above, instead of the stale value from loop-top.
        if (!this.h().getNonStrikerName()) {
        const exclude = new Set<string>([this.h().getStrikerName()].filter(Boolean));
        const pick = this.pickAvailable(batting, dismissed, exclude);
        if (pick) {
            await this.announcedClick(
            gen,
            "demo-slot-nonStriker",
            "Open non-striker slot",
            "Now filling the non-striker slot with the next eligible batter.",
            `Non-striker slot opened — ${pick.name} is next in line.`,
            CREW_COLOR
            );
            if (!this.isCurrent(gen)) return false;
            await this.announcedClick(
            gen,
            `demo-player-${pick.id}`,
            `Pick ${pick.name}`,
            `Selecting ${pick.name} for the non-striker's end.`,
            `${pick.name} is at the non-striker's end.`,
            CREW_COLOR
            );
        }
        }
        if (!this.isCurrent(gen)) return false;

        // Fresh read again for the same reason.
        if (!this.h().getBowlerName()) {
        const pick = this.pickAvailable(bowling, new Set(), new Set());
        if (pick) {
            await this.announcedClick(
            gen,
            "demo-slot-bowler",
            "Open bowler slot",
            "Picking who's got the ball this over.",
            `Bowler slot opened — ${pick.name} will bowl.`,
            CREW_COLOR
            );
            if (!this.isCurrent(gen)) return false;
            await this.announcedClick(
            gen,
            `demo-player-${pick.id}`,
            `Pick ${pick.name}`,
            `Selecting ${pick.name} to bowl this over.`,
            `${pick.name} is up to bowl.`,
            CREW_COLOR
            );
        }
        }
        this.legalBallsThisOver = 0;
        await this.beat(gen, STEP_GAP_MS);
    }
    return false;
    }

  private async changeBowler(gen: number) {
    if (!this.isCurrent(gen)) return;
    const h = this.handleGetter();
    if (!h) return;
    const bowling = h.getBowlingSquad();
    if (bowling.length === 0) return;

    const currentName = h.getBowlerName();
    const currentIdx = bowling.findIndex((p) => p.name === currentName);
    let nextIdx = (currentIdx + 1) % bowling.length;
    if (bowling.length > 1 && nextIdx === currentIdx) nextIdx = (nextIdx + 1) % bowling.length;
    const next = bowling[nextIdx];

    await this.announcedClick(
      gen,
      "demo-slot-bowler",
      "Over complete — new bowler",
      `Over's done — ${currentName || "the bowler"} hands the ball over. Opening the bowler slot to bring on a fresh bowler for the new over.`,
      "Bowler slot open — picking who's up next.",
      CREW_COLOR
    );
    if (!this.isCurrent(gen)) return;
    await this.announcedClick(
      gen,
      `demo-player-${next.id}`,
      `Pick ${next.name}`,
      `Bringing on ${next.name} to bowl this new over — rotating the attack rather than running one bowler's spell too long.`,
      `${next.name} has the ball. New over, new bowler — that's a real bowling change, not just a label swap.`,
      CREW_COLOR
    );
    this.legalBallsThisOver = 0;
    await this.beat(gen, STEP_GAP_MS);
  }

  private async registerLegalBallAndMaybeChangeBowler(gen: number, isLegal: boolean) {
    if (!isLegal) return;
    this.legalBallsThisOver += 1;
    if (this.legalBallsThisOver >= LEGAL_BALLS_PER_OVER) {
      this.legalBallsThisOver = 0;
      if (!(await this.readyToScore(gen))) return;
      await this.changeBowler(gen);
    }
  }

  private async readyToScore(gen: number): Promise<boolean> {
    while (this.isCurrent(gen)) {
      await this.waitForHandle(gen);
      if (!this.isCurrent(gen)) return false;
      const h = this.h();
      if (h.isMatchComplete()) return false;
      if (h.noPartnerAvailable()) return false;
      if (h.hasPendingWicket()) {
        await this.beat(gen, POLL_MS);
        continue;
      }
      if (h.isControlsLocked()) {
        const ok = await this.ensureAssignments(gen);
        if (!ok) return false;
        continue;
      }
      return true;
    }
    return false;
  }

  private async endCurrentInningsOrMatch(gen: number, label: string) {
    if (!this.isCurrent(gen)) return;
    const isMatchEnd = label.toLowerCase().includes("match");
    await this.announcedClick(
      gen,
      "demo-open-end-innings",
      label,
      isMatchEnd
        ? "Innings is done — opening the confirmation to end the match and compute the result."
        : "Overs are up — opening the confirmation to close out this innings and set a target.",
      "Confirmation dialog open — reviewing the details before committing.",
      FLOW_COLOR
    );
    await this.beat(gen, DIALOG_SETTLE_MS);
    if (!this.isCurrent(gen)) return;
    await this.announcedClick(
      gen,
      "demo-confirm-end-innings",
      `Confirm — ${label.toLowerCase()}`,
      isMatchEnd
        ? "Confirming — this locks scoring, computes the result, and fires the Match Won graphic."
        : "Confirming — this resets the score for Innings 2 and sets the target one run above what was just scored.",
      isMatchEnd ? "Match ended and the result graphic has fired." : "Innings closed — target is set, ready for the chase.",
      FLOW_COLOR
    );
    await this.beat(gen, isMatchEnd ? STEP_GAP_MS + POST_MOMENT_HOLD_MS : STEP_GAP_MS);
  }

  private availableDismissalOptions(): string[] {
    const select = document.getElementById("demo-wicket-dismissal-select") as HTMLSelectElement | null;
    if (!select) return [];
    return Array.from(select.options).map((o) => o.value);
  }

  private pickRandomAvailableDismissal(): string | null {
    const values = this.availableDismissalOptions();
    if (values.length === 0) return null;
    return values[randomInt(0, values.length - 1)];
  }

  private async fillFielderIfNeeded(gen: number, dismissalType: string) {
    if (!this.isCurrent(gen)) return;
    if (!FIELDER_RELEVANT_DISMISSALS.has(dismissalType)) return;
    const bowling = this.handleGetter()?.getBowlingSquad() ?? [];
    const fielder = randomFrom(bowling);
    if (!fielder) return;
    const roleWord = dismissalType === "stumped" ? "the keeper" : dismissalType === "runOut" ? "the fielder who ran it in" : "the catcher";
    await this.announcedType(
      gen,
      "demo-wicket-fielder-input",
      fielder.name,
      `Credit ${fielder.name}`,
      `Naming ${roleWord} for the scorecard — typing ${fielder.name} into the Fielder field.`,
      `${fielder.name} credited with the dismissal.`,
      WICKET_COLOR
    );
  }

  // `forceDismissal` drives the scripted showcase (bowled / caught / lbw
  // / stumped / hitWicket / caughtAndBowled / runOut, one at a time). If
  // the forced type isn't actually a valid option in the dialog right
  // now (e.g. the context restricts it), it's silently skipped in favor
  // of whatever the dialog's default/random pick is — the showcase never
  // gets stuck trying to select something that isn't there.
  private async takeAWicket(
    gen: number,
    batsman: "striker" | "nonstriker",
    forcedRunOut: boolean,
    runsCompleted?: number,
    forceDismissal?: string
  ) {
    if (!this.isCurrent(gen)) return;
    await this.announcedClick(
      gen,
      "demo-ball-out",
      "Appeal!",
      "Something's happened out there — clicking OUT to open the wicket dialog and log the dismissal.",
      "Appeal upheld — now filling in who's out and how.",
      WICKET_COLOR
    );
    await this.beat(gen, DIALOG_SETTLE_MS);
    if (!this.isCurrent(gen)) return;

    const who = batsman === "striker" ? "Striker is out" : "Non-striker is out";
    await this.announcedClick(
      gen,
      batsman === "striker" ? "demo-wicket-pick-striker" : "demo-wicket-pick-nonstriker",
      who,
      `Marking which batter is out — this time it's the ${batsman === "striker" ? "striker" : "non-striker"}.`,
      `${who} confirmed.`,
      WICKET_COLOR
    );
    if (!this.isCurrent(gen)) return;

    let finalDismissal = "bowled";
    if (forcedRunOut) {
      finalDismissal = "runOut";
      this.onLog(`Setting the dismissal to Run Out — ${dismissalExplainer("runOut")}`);
      await this.cursorCtl.selectOption("demo-wicket-dismissal-select", "runOut", "Mark run out", WICKET_COLOR);
      if (!this.isCurrent(gen)) return;
      const runs = typeof runsCompleted === "number" ? runsCompleted : randomInt(0, 3);
      await this.announcedClick(
        gen,
        `demo-runs-completed-${runs}`,
        `${runs} runs completed`,
        `Run outs need to know how many runs the batters had already crossed before the stumps went down — marking ${runs}.`,
        `${runs} run${runs === 1 ? "" : "s"} completed before the run out — the rest won't be credited.`,
        WICKET_COLOR
      );
    } else {
      const available = this.availableDismissalOptions();
      const chosen = forceDismissal && available.includes(forceDismissal) ? forceDismissal : this.pickRandomAvailableDismissal();
      if (chosen && chosen !== "bowled") {
        finalDismissal = chosen;
        this.onLog(`Setting the dismissal to ${chosen[0].toUpperCase() + chosen.slice(1)} — ${dismissalExplainer(chosen)}`);
        await this.cursorCtl.selectOption("demo-wicket-dismissal-select", chosen, "Set dismissal", WICKET_COLOR);
      } else {
        this.onLog(`Leaving the dismissal as Bowled (the dialog's default) — ${dismissalExplainer("bowled")}`);
      }
    }
    if (!this.isCurrent(gen)) return;

    await this.fillFielderIfNeeded(gen, finalDismissal);
    if (!this.isCurrent(gen)) return;

    await this.announcedClick(
      gen,
      "demo-wicket-fire",
      "Confirm wicket",
      "Everything's filled in — clicking to fire the wicket graphic and lock in the dismissal.",
      "Wicket confirmed and the graphic has fired.",
      WICKET_COLOR
    );
    await this.beat(gen, STEP_GAP_MS + POST_MOMENT_HOLD_MS);
  }

  // Called on a currently-active Free Hit — the dialog is opened,
  // callout that Run Out is the only valid option here, and then closed
  // without recording anything. Deliberately called BEFORE the free-hit
  // ball itself is bowled/scored (see playExtra) since that's the one
  // legal delivery the free hit actually protects — appealing after
  // that delivery has already been recorded would be appealing on an
  // unprotected ball, which would make the "Run Out only" messaging
  // false.
  private async demonstrateFreeHitConstraint(gen: number) {
    await this.announcedClick(
      gen,
      "demo-ball-out",
      "Appeal (Free Hit)",
      "Just to show what an appeal looks like on a Free Hit delivery —",
      "Dialog open — notice everything except Run Out is disabled.",
      WICKET_COLOR
    );
    await this.beat(gen, DIALOG_SETTLE_MS);
    if (!this.isCurrent(gen)) return;
    this.onLog("On a Free Hit, Run Out is the ONLY dismissal the dialog will let you pick — every other option is grayed out, by design.");
    await this.announcedClick(
      gen,
      "demo-wicket-skip",
      "Skip",
      "No dismissal to record here — closing the dialog and getting on with the free-hit ball itself.",
      "Dialog closed, no wicket recorded.",
      WICKET_COLOR
    );
    await this.beat(gen, STEP_GAP_MS);
  }

  private async playExtra(gen: number, extraValue: string, isShowcaseNoBall = false) {
    const label = extraLabel(extraValue);
    await this.announcedClickByText(
      gen,
      "demo-extras-row",
      label,
      `Mark ${label}`,
      `Marking this delivery as a ${label} — ${EXTRA_EXPLAINERS[extraValue] ?? "it's scored as an extra rather than off the bat."}`,
      `${label} selected — now bowling the delivery for real.`,
      RUN_COLOR
    );
    if (!this.isCurrent(gen)) return;
    const runOnExtra = pickWeighted<0 | 1>([[1, 85], [0, 15]]);
    await this.announcedClick(
      gen,
      `demo-ball-${runOnExtra}`,
      "Bowl it",
      `Recording the delivery itself — ${runOnExtra} run${runOnExtra === 1 ? "" : "s"} plus the ${label} extra.`,
      `${label} bowled and recorded.`,
      RUN_COLOR
    );
    if (!this.isCurrent(gen)) return;

    const isLegalDelivery = extraValue === "bye" || extraValue === "legBye";

    if (extraValue === "noBall") {
      await this.beat(gen, STEP_GAP_MS);
      if (!this.isCurrent(gen)) return;

      // 1. Arm the Free Hit for the NEXT delivery — but only if it
      // isn't already active. The engine auto-sets isFreeHit the moment
      // a no-ball delivery is recorded (which already happened above,
      // via the "Bowl it" click), so by the time we get here Free Hit
      // is usually already ON. demo-free-hit-toggle is a toggle, not a
      // "turn on" button — clicking it while already active would
      // silently flip it back OFF.
      if (!this.handleGetter()?.isFreeHitActive()) {
        await this.announcedClick(
          gen,
          "demo-free-hit-toggle",
          "Mark Free Hit",
          "That no-ball earns a Free Hit — marking it active for the very next delivery.",
          "Free Hit is now active.",
          RUN_COLOR
        );
      } else {
        this.onLog("Free Hit was armed automatically the instant that no-ball was recorded — no toggle needed.");
      }
      await this.beat(gen, STEP_GAP_MS);
      if (!this.isCurrent(gen)) return;

      // 2. Whether an appeal happens on the free-hit ball at all. The
      // scripted innings-1 no-ball ALWAYS shows it (guaranteed showcase
      // — never left to chance). Every other no-ball in the innings
      // only shows it about half the time, so the demo also shows the
      // far more common case: a free-hit ball that's just played out
      // normally with no appeal at all.
      //
      // This MUST happen before the free-hit ball is scored, not after
      // — the free hit only protects the ONE legal delivery that
      // follows the no-ball. Once that delivery is recorded, isFreeHit
      // clears and any appeal after that point is on an unprotected
      // ball, which would make the "Run Out is the ONLY dismissal"
      // messaging false.
      const showAppeal = isShowcaseNoBall || Math.random() < 0.5;
      if (showAppeal) {
        await this.demonstrateFreeHitConstraint(gen);
        if (!this.isCurrent(gen)) return;
      } else {
        this.onLog("No appeal on this one — the fielding side just plays on to the free-hit ball.");
        await this.beat(gen, STEP_GAP_MS);
        if (!this.isCurrent(gen)) return;
      }

      // 3. NOW bowl and SCORE the free-hit delivery for real — this is
      // the one legal ball the free hit actually protects. The engine
      // reads whatever ball value is clicked here exactly like any
      // other delivery.
      const strikerName = this.handleGetter()?.getStrikerName() || "The batter";
      const shot = pickWeighted<4 | 6>([[4, 60], [6, 40]]);
      await this.announcedClick(
        gen,
        `demo-ball-${shot}`,
        "Free-hit shot",
        `${strikerName} takes advantage of the Free Hit and goes big — clicking "${shot}".`,
        shot === 6 ? `SIX! No risk of most dismissals paid off for ${strikerName}.` : `FOUR! ${strikerName} cashes in on the free swing.`,
        RUN_COLOR
      );
      await this.beat(gen, STEP_GAP_MS + POST_MOMENT_HOLD_MS);
      if (!this.isCurrent(gen)) return;

      // 4. Only click "cancel" if the flag is actually still on. Most
      // engines auto-clear isFreeHit the moment a legal delivery is
      // recorded (step 3 above already was one) — blindly toggling
      // again here would just re-arm a brand-new Free Hit instead of
      // canceling the old one, which is the bug this fixes.
      if (this.handleGetter()?.isFreeHitActive()) {
        await this.announcedClick(
          gen,
          "demo-free-hit-toggle",
          "Cancel Free Hit",
          "Clearing the Free Hit flag — normal dismissal rules apply again from the next delivery.",
          "Free Hit cleared.",
          RUN_COLOR
        );
      } else {
        this.onLog("Free Hit auto-cleared the moment that delivery was recorded — no extra toggle needed.");
      }

      await this.registerLegalBallAndMaybeChangeBowler(gen, true);
    } else {
      await this.registerLegalBallAndMaybeChangeBowler(gen, isLegalDelivery);
    }

    await this.beat(gen, STEP_GAP_MS);
    if (!this.isCurrent(gen)) return;
    await this.announcedClickByText(
      gen,
      "demo-extras-row",
      extraLabel("none"),
      "Clear extra",
      "Clearing the extra flag so the next ball is scored normally.",
      "Extra cleared — back to a standard delivery.",
      RUN_COLOR
    );
    await this.beat(gen, STEP_GAP_MS);
  }

  private async playPlainRun(gen: number, r: PlainRun) {
    const strikerBefore = this.handleGetter()?.getStrikerName() || "The batter";
    const { before, after } = this.runCommentary(strikerBefore, r);
    await this.announcedClick(gen, `demo-ball-${r}`, `Score ${r}`, before, after, RUN_COLOR);
    await this.beat(gen, r === 4 || r === 6 ? BALL_GAP_MS + POST_MOMENT_HOLD_MS : BALL_GAP_MS);
    if (!this.isCurrent(gen)) return;

    if ((r === 1 || r === 3) && Math.random() < STRIKE_ROTATION_CALLOUT_CHANCE) {
      const strikerAfter = this.handleGetter()?.getStrikerName() || "";
      if (strikerAfter) {
        this.onLog(`Odd number of runs — strike rotates automatically. ${strikerAfter} is now facing.`);
        await this.beat(gen, STEP_GAP_MS);
      }
    }

    await this.registerLegalBallAndMaybeChangeBowler(gen, true);
  }

  private async doUndoDemo(gen: number, kindLabel: string): Promise<boolean> {
    if (!this.isCurrent(gen)) return false;
    const h = this.handleGetter();
    if (!h || !h.canUndo()) return false;
    await this.announcedClick(
      gen,
      "demo-undo-ball",
      "Undo last ball",
      `Just to show recovery works, not only on runs — undoing that last ${kindLabel}.`,
      "Last ball undone — score, striker stats, and bowler figures rolled back exactly one delivery.",
      UNDO_COLOR
    );
    await this.beat(gen, STEP_GAP_MS);
    return true;
  }

  // Plays boundaries (biased hard toward 4s/6s) until the current
  // striker's runs cross 50, so the Fifty milestone fires as a genuine,
  // scripted beat rather than something we just hope happens.
  private async playMilestonePush(gen: number) {
    let guard = 0;
    while (this.isCurrent(gen) && guard < 40) {
      guard += 1;
      if (!(await this.readyToScore(gen))) return;
      const h = this.handleGetter();
      if (!h) return;
      if ((h.getMaxLegalBalls?.() ?? undefined) !== undefined) {
        const remaining = (h.getMaxLegalBalls() as number) - h.getLegalBallsBowled();
        if (remaining <= 10) return; // don't blow the whole innings chasing this
      }
      const shot = pickWeighted<PlainRun>([[4, 55], [6, 40], [1, 5]]);
      await this.playPlainRun(gen, shot);
      if (!this.isCurrent(gen)) return;
      // Milestone firing is detected by the real engine (onMilestone),
      // which the page wires straight to the moment chyron — the driver
      // doesn't need to check the number itself, just keep feeding
      // boundaries for a bounded number of balls and then move on.
      if (guard >= 6) return;
    }
  }

  private async runScriptBeat(gen: number, beat: ScriptBeat) {
    switch (beat.kind) {
      case "run":
        await this.playPlainRun(gen, beat.value);
        return;
      case "extra":
        await this.playExtra(gen, beat.extra, beat.extra === "noBall");
        return;
      case "swapStrike":
        await this.announcedClick(
          gen,
          "demo-swap-strike",
          "Swap strike (manual)",
          "Strike already rotates automatically on odd runs and at the end of an over — this is the manual override for the rare case a scorer needs to correct or force it.",
          "Strike swapped manually — the other batter is now facing.",
          RUN_COLOR
        );
        await this.beat(gen, STEP_GAP_MS);
        return;
      case "milestonePush":
        await this.playMilestonePush(gen);
        return;
      case "wicket":
        await this.takeAWicket(gen, beat.who, beat.forceDismissal === "runOut", beat.runsCompleted, beat.forceDismissal);
        if (!this.isCurrent(gen)) return;
        await this.ensureAssignments(gen);
        return;
      case "undo":
        await this.doUndoDemo(gen, "delivery");
        return;
      default:
        return;
    }
  }

  // Runs deliveries until the innings genuinely ends — all out, overs
  // complete, or the engine itself flags matchComplete — never a fixed
  // ball count. `script`, when provided, is consumed in order first
  // (one beat per loop iteration); once it's empty, the driver falls
  // back to normal weighted-random play using `runTable` for the rest
  // of the innings.
  private async playInnings(gen: number, script: ScriptBeat[] | null, runTable: Array<[PlainRun, number]>) {
    const queue = script ? [...script] : [];
    let safetyBallsBowled = 0;
    let inningsEndAnnounced = false;

    while (this.isCurrent(gen)) {
      const h = this.handleGetter();
      if (!h) break;
      if (h.isMatchComplete()) break;
      if (h.noPartnerAvailable()) break;

      const maxLegalBalls = h.getMaxLegalBalls();
      const legalBallsBowled = h.getLegalBallsBowled();
      if (maxLegalBalls !== undefined && legalBallsBowled >= maxLegalBalls) {
        // The innings just finished purely on overs — call that out
        // explicitly as its own beat, rather than letting the upcoming
        // "End Innings" / "End Match" click seem to appear out of
        // nowhere with no context for why it's happening now.
        if (!inningsEndAnnounced) {
          inningsEndAnnounced = true;
          this.onLog(
            h.isSecondInnings()
              ? "Overs complete — the chase is over here, wrapping up the match."
              : "Overs complete — this innings has ended, time to set a target for the chase."
          );
          await this.beat(gen, STEP_GAP_MS);
        }
        break;
      }

      const safetyCap = maxLegalBalls !== undefined ? maxLegalBalls + LEGAL_BALLS_PER_OVER * 2 : UNCAPPED_FORMAT_SAFETY_BALLS;
      if (safetyBallsBowled >= safetyCap) break;

      if (!(await this.readyToScore(gen))) return this.handlePausedFlow(gen);

      if (queue.length > 0) {
        const beat = queue.shift()!;
        await this.runScriptBeat(gen, beat);
        safetyBallsBowled += 1;
        continue;
      }

      // Script exhausted — fall back to normal random play for the
      // rest of the innings, biased by `runTable` (neutral for innings
      // 1's tail, aggressive/conservative for the innings-2 chase).
      const delivery = pickDelivery(runTable);
      if (delivery.type === "wicket") {
        await this.takeAWicket(gen, "striker", false);
        safetyBallsBowled += 1;
        if (!(await this.ensureAssignments(gen))) return;
      } else if (delivery.type === "extra") {
        await this.playExtra(gen, delivery.extra);
        safetyBallsBowled += 1;
      } else {
        await this.playPlainRun(gen, delivery.value);
        safetyBallsBowled += 1;
      }
    }
  }

  private async runOneMatchCycle(gen: number) {
    this.legalBallsThisOver = 0;
    this.onLog("Auto-demo: assigning openers");
    if (!(await this.ensureAssignments(gen))) return;

    if (!(await this.readyToScore(gen))) return this.handlePausedFlow(gen);

    // Innings 1 — the full scripted showcase, then real random play
    // until the innings genuinely ends.
    await this.playInnings(gen, buildInningsOneScript(), NEUTRAL_RUN_TABLE);
    if (!this.isCurrent(gen)) return;

    await this.announcedClick(
      gen,
      "demo-new-partnership",
      "Mark new partnership",
      "Resetting the partnership counter — a fresh pair is at the crease, so the joint runs/balls tally starts again from zero.",
      "New partnership marked.",
      FLOW_COLOR
    );
    await this.beat(gen, STEP_GAP_MS);

    if (!this.isCurrent(gen)) return;
    if (this.handleGetter()?.isSecondInnings()) {
      await this.endCurrentInningsOrMatch(gen, "End the match");
    } else {
      await this.endCurrentInningsOrMatch(gen, "End this innings");

      this.legalBallsThisOver = 0;
      this.onLog("Auto-demo: innings 2 — assigning the chasing openers");
      if (!(await this.ensureAssignments(gen))) return;

      // Innings 2 — bias alternates by cycle so both win methods (by
      // wickets vs by runs) get demonstrated across repeated loops of
      // the demo, rather than the chase always going the same way.
      const chaseAggressively = this.cycleCount % 2 === 0;
      this.onLog(
        chaseAggressively
          ? "This chase is being played aggressively — expect the batting side to get there with wickets in hand."
          : "This chase is being played conservatively — expect the overs to run out and the defending side to win on runs."
      );
      await this.playInnings(gen, null, chaseAggressively ? AGGRESSIVE_RUN_TABLE : CONSERVATIVE_RUN_TABLE);
      if (!this.isCurrent(gen)) return;

      if (!this.handleGetter()?.isMatchComplete()) {
        await this.endCurrentInningsOrMatch(gen, "End the match");
      }
    }

    await this.waitForMatchComplete(gen);
    if (!this.isCurrent(gen)) return;
    await this.announcedClick(
      gen,
      "demo-match-over-undo",
      "Undo the result",
      "Demonstrating recovery from a mistaken finish — undoing the result puts the match straight back into live scoring.",
      "Result undone — back to live scoring.",
      WICKET_COLOR
    );
    await this.beat(gen, STEP_GAP_MS);

    if (!this.isCurrent(gen)) return;
    if (!this.handleGetter()?.isMatchComplete()) {
      await this.endCurrentInningsOrMatch(gen, "End the match");
      await this.waitForMatchComplete(gen);
    }

    if (!this.isCurrent(gen)) return;
    await this.announcedClick(
      gen,
      "demo-match-over-restart",
      "Restart the match",
      "Cycle's done — opening the restart confirmation to start a fresh match with the same two squads.",
      "Restart dialog open.",
      RUN_COLOR
    );
    await this.beat(gen, DIALOG_SETTLE_MS);
    if (!this.isCurrent(gen)) return;
    await this.announcedClick(
      gen,
      "demo-confirm-restart",
      "Confirm restart",
      "Confirming — score, overs, and results reset; the points table and tournament boundary totals carry over.",
      "Match restarted — looping back to the start.",
      RUN_COLOR
    );
  }

  private async handlePausedFlow(gen: number) {
    if (!this.isCurrent(gen)) return;
    const h = this.handleGetter();
    if (!h) return;
    if (h.isMatchComplete()) {
      await this.waitForMatchComplete(gen);
      if (!this.isCurrent(gen)) return;
      await this.announcedClick(
        gen,
        "demo-match-over-restart",
        "Restart the match",
        "Match wrapped up early this cycle — opening the restart confirmation.",
        "Restart dialog open.",
        RUN_COLOR
      );
      await this.beat(gen, DIALOG_SETTLE_MS);
      if (!this.isCurrent(gen)) return;
      await this.announcedClick(gen, "demo-confirm-restart", "Confirm restart", "Confirming the restart.", "Match restarted.", RUN_COLOR);
      return;
    }
    if (h.noPartnerAvailable()) {
      await this.endCurrentInningsOrMatch(gen, h.isSecondInnings() ? "End the match" : "End this innings");
    }
  }

  private async waitForMatchComplete(gen: number) {
    while (this.isCurrent(gen)) {
      const h = this.handleGetter();
      if (h?.isMatchComplete()) return;
      await this.beat(gen, POLL_MS);
    }
  }
}

export interface LiveStatePanelAutoProps extends Omit<LiveStatePanelProps, "readOnly" | "onRestartMatch"> {
  onRestartMatch: () => void;
  onModeChange?: (mode: "demo" | "interactive") => void;
  logEvent?: (label: string) => void;
  defaultMode?: "demo" | "interactive";
}

export default function LiveStatePanelAuto({
  onRestartMatch,
  onModeChange,
  logEvent,
  defaultMode = "demo",
  ...panelProps
}: LiveStatePanelAutoProps) {
  const handleRef = useRef<LiveStatePanelHandle>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const driverRef = useRef<ScriptedDriver | null>(null);
  const [mode, setMode] = useState<"demo" | "interactive">(defaultMode);
  const [paused, setPaused] = useState(false);

  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  }));

  useEffect(() => {
    function onResize() {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const cursorCtl = useDemoCursor(wrapRef);

  useEffect(() => {
    driverRef.current = new ScriptedDriver(
      () => handleRef.current,
      cursorCtl,
      (s) => logEvent?.(s)
    );
    return () => driverRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === "demo") {
      onRestartMatch();
      driverRef.current?.start();
    } else {
      driverRef.current?.stop();
    }
    setPaused(false);
    onModeChange?.(mode);
    return () => {
      if (mode === "demo") driverRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function toggleMode() {
    setMode((m) => (m === "demo" ? "interactive" : "demo"));
  }

  function togglePause() {
    if (mode !== "demo") return;
    const d = driverRef.current;
    if (!d) return;
    if (paused) {
      d.resume();
      setPaused(false);
    } else {
      d.pause();
      setPaused(true);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <DemoCursor cursor={cursorCtl.cursor} frameWidth={viewport.width} frameHeight={viewport.height} />

      <div className="flex items-center justify-end gap-2 mb-2">
        {mode === "demo" && (
          <button
            type="button"
            onClick={togglePause}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase transition-colors"
            style={{
              fontFamily: "var(--font-label-mono)",
              letterSpacing: "0.08em",
              background: paused ? "color-mix(in srgb, var(--color-theme-orange) 15%, transparent)" : "rgba(255,255,255,0.03)",
              boxShadow: `inset 0 0 0 1px ${paused ? "color-mix(in srgb, var(--color-theme-orange) 45%, transparent)" : "var(--color-border-overlay)"}`,
              color: paused ? "var(--color-theme-orange)" : "var(--color-on-surface)",
              cursor: "pointer",
            }}
          >
            {paused ? <Play className="w-2.5 h-2.5" /> : <Pause className="w-2.5 h-2.5" />}
            {paused ? "Resume Demo" : "Pause Demo"}
          </button>
        )}
        <button
          type="button"
          onClick={toggleMode}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase transition-colors"
          style={{
            fontFamily: "var(--font-label-mono)",
            letterSpacing: "0.08em",
            background: mode === "demo" ? "color-mix(in srgb, var(--color-theme-orange) 14%, transparent)" : "rgba(255,255,255,0.03)",
            boxShadow: `inset 0 0 0 1px ${mode === "demo" ? "color-mix(in srgb, var(--color-theme-orange) 45%, transparent)" : "var(--color-border-overlay)"}`,
            color: mode === "demo" ? "var(--color-theme-orange)" : "var(--color-on-surface)",
            cursor: "pointer",
          }}
        >
          {mode === "demo" ? <MonitorPlay className="w-2.5 h-2.5" /> : <LayoutPanelLeft className="w-2.5 h-2.5" />}
          {mode === "demo" ? "Try It Yourself" : "Watch Demo"}
        </button>
      </div>

      <LiveStatePanel ref={handleRef} {...panelProps} onRestartMatch={onRestartMatch} readOnly={mode === "demo"} />
    </div>
  );
}