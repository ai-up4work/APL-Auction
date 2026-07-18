"use client";

// Automatic ("demo") variant of the live scoring console. Wraps the
// real <LiveStatePanel> (unchanged engine/graphics) and layers a
// scripted driver on top of it that operates the REAL rendered
// controls via genuine DOM clicks — see hooks/useDemoCursor.ts.
//
// CURSOR COORDINATE SPACE FIX: useDemoCursor computes cursor.x/y as
// ABSOLUTE VIEWPORT pixels (getBoundingClientRect, matching DemoCursor's
// position:fixed portal to document.body). Previously this component
// passed <DemoCursor frameWidth={wrapRef.current?.clientWidth} .../> —
// the *local scoring panel's* own box size, not the viewport. That
// mismatch made the ghost cursor (and its flash) drift toward the
// center of that smaller local box instead of tracking the real
// on-screen position of whatever it had actually just clicked — the
// click itself was always correct (flashElement/.click() operate
// directly on the real element via getBoundingClientRect, independent
// of the cursor overlay), but the VISUAL cursor could look like it was
// clicking in empty space in the middle of the screen. Fixed by
// tracking window.innerWidth/innerHeight instead, since that's the
// space the coordinates are actually measured in.
//
// SWAP STRIKE FIX: "Swap Strike" is a MANUAL OVERRIDE for a scorer
// correcting a mistake — real strike rotation already happens
// automatically inside the engine (odd runs, end of over). The driver
// previously clicked "Swap Strike" unconditionally on every single
// match cycle, right after assigning openers and before any other
// scrolling had happened on the page — the one click in the whole
// script with no natural lead-in scroll, which is why it could show up
// looking oddly placed. It's now a rare, randomly-triggered demo of the
// override (SWAP_STRIKE_DEMO_CHANCE) rather than a guaranteed step, and
// it fires after the innings is already underway rather than as the
// very first action, so the page has already scrolled to the scoring
// area naturally by the time it happens.
//
// INNINGS LENGTH: previously each innings ran for a hardcoded random
// window of 14–22 deliveries (2–4 overs) and then FORCED "End
// Innings"/"End Match" regardless of what had actually happened. That
// meant the "match" never really completed on its own terms — it was
// always a short token sample, manually cut off every single cycle.
//
// Now each innings runs the real engine's actual stopping conditions:
//   - all out (h.noPartnerAvailable())
//   - overs complete (h.getLegalBallsBowled() >= h.getMaxLegalBalls(),
//     read straight from the real scoreboard + the match's real format
//     — T20 → 120 legal balls, ODI → 300, Test → unlimited)
//   - the engine itself flips matchComplete (e.g. target reached in the
//     second innings)
// A generous safety cap (maxLegalBalls, or a large fallback for
// Test-style unlimited overs) exists purely as a bug-guard against an
// infinite loop if some other state got stuck — it is NOT the intended
// stopping condition and should essentially never be hit in normal play.
// The actual number of deliveries bowled each cycle is now genuinely
// random, because it depends on how the random deliveries land (wickets
// falling early vs. batters surviving), exactly like a real innings.

import React, { useEffect, useRef, useState } from "react";
import { MonitorPlay, Pause, Play, LayoutPanelLeft } from "lucide-react";
import LiveStatePanel, { type LiveStatePanelHandle, type LiveStatePanelProps } from "./LiveStatePanel";
import DemoCursor from "@/components/demo/DemoCursor";
import { useDemoCursor } from "@/hooks/useDemoCursor";
import { EXTRA_OPTIONS } from "@/hooks/useLiveScoringEngine";
import type { SquadPlayer } from "@/lib/overlayBus";

const EXTRA_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  EXTRA_OPTIONS.map((o: { value: string; label: string }) => [o.value, o.label])
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

// Bug-guard only — NOT the intended stopping condition. Used when the
// format has no cap (e.g. Test) so the driver can't spin forever if
// some unrelated state gets stuck. Real T20/ODI matches stop from
// h.getMaxLegalBalls() long before this would ever matter.
const UNCAPPED_FORMAT_SAFETY_BALLS = 40 * 6;

// How often the driver calls out that strike rotated because of an
// odd-run delivery — narrated some of the time, not every single time,
// so it doesn't get repetitive.
const STRIKE_ROTATION_CALLOUT_CHANCE = 0.35;

// "Swap Strike" is a MANUAL OVERRIDE — a scorer fixing a mistake, or
// choosing to rotate strike outside the normal odd-run/end-of-over
// triggers. Real operators reach for it rarely. Previously the driver
// fired it unconditionally once per match; now it's an occasional demo
// beat, gated behind this chance AND only once real scoring is already
// underway (never as the very first action of a cycle).
const SWAP_STRIKE_DEMO_CHANCE = 0.2;

// UNDO DEMO FIX: previously every single match cycle scripted an exact
// "score 2, then immediately undo it" beat right at the start — always
// the same run value, always a run (never a wicket), and never
// skipped. That's not representative: Undo is a correction tool a
// scorer reaches for occasionally, for whatever the last delivery
// actually was (a run, an extra, or a wicket), not a guaranteed step
// every match. It's now a low-probability, at-most-once-per-innings
// beat that fires right after whatever delivery happens to occur next
// (playPlainRun / playExtra / takeAWicket), so most cycles won't show
// it at all, and when it does show up it's undoing something real
// rather than a delivery invented solely to be undone.
const UNDO_DEMO_CHANCE = 0.12;

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
const PLAIN_RUN_TABLE: Array<[PlainRun, number]> = [
  [0, 34],
  [1, 30],
  [2, 9],
  [3, 2],
  [4, 15],
  [6, 10],
];

type DeliveryKind = { type: "run"; value: PlainRun } | { type: "wicket" } | { type: "extra"; extra: string };

function pickDelivery(): DeliveryKind {
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
  return { type: "run", value: pickWeighted(PLAIN_RUN_TABLE) };
}

class ScriptedDriver {
  private handleGetter: () => LiveStatePanelHandle | null;
  private cursorCtl: ReturnType<typeof useDemoCursor>;
  private onLog: (s: string) => void;
  private running = false;
  private generation = 0;

  private paused = false;
  private pauseWaiters: Array<() => void> = [];

  // Legal deliveries bowled so far in the CURRENT over, tracked
  // separately from the engine's own over/ball display purely as the
  // driver's cue for "an over just finished, time to change bowlers."
  private legalBallsThisOver = 0;

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

  private runCommentary(striker: string, r: PlainRun): { before: string; after: string } {
    switch (r) {
      case 0:
        return { before: `Bowled to ${striker} — clicking "0" to record a dot ball.`, after: `Dot ball. ${striker} defends it, no run taken.` };
      case 4:
        return {
          before: `${striker} shapes up to go big — clicking "4" to send this one racing to the boundary.`,
          after: `FOUR! ${striker} finds the gap in the field for a boundary.`,
        };
      case 6:
        return { before: `${striker} clears the front leg — clicking "6" for the maximum.`, after: `SIX! ${striker} clears the ropes with a big strike.` };
      default:
        return {
          before: `${striker} looks to rotate the strike — clicking "${r}" to record ${r} run${r > 1 ? "s" : ""}.`,
          after: `${striker} works it away and the batters cross for ${r} run${r > 1 ? "s" : ""}.`,
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
      const h = this.h();
      if (!h.isControlsLocked()) return true;

      const batting = h.getBattingSquad();
      const bowling = h.getBowlingSquad();
      const dismissed = h.getDismissedNames();

      if (!h.getStrikerName()) {
        const exclude = new Set<string>([h.getNonStrikerName()].filter(Boolean));
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

      if (!h.getNonStrikerName()) {
        const exclude = new Set<string>([h.getStrikerName()].filter(Boolean));
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

      if (!h.getBowlerName()) {
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

  // Rotates the bowler at the end of every over — real matches never
  // let the same bowler bowl consecutive overs, so this cycles through
  // the bowling squad rather than leaving one bowler in all innings.
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

  // Call after every delivery that actually counts as legal (not a
  // wide or no-ball). When it completes an over, triggers the real
  // bowler-change flow above.
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

  private pickRandomAvailableDismissal(): string | null {
    const select = document.getElementById("demo-wicket-dismissal-select") as HTMLSelectElement | null;
    if (!select) return null;
    const values = Array.from(select.options).map((o) => o.value);
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

  private async takeAWicket(gen: number, batsman: "striker" | "nonstriker", forcedRunOut: boolean, runsCompleted?: number) {
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
      const chosen = this.pickRandomAvailableDismissal();
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

  private async demonstrateFreeHitConstraint(gen: number) {
    await this.announcedClick(
      gen,
      "demo-ball-out",
      "Appeal (Free Hit)",
      "Appealing anyway, just to show what happens when you try to get a wicket on a Free Hit —",
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
      "The batter middled it — closing the dialog without recording a dismissal.",
      "Dialog closed, no wicket recorded.",
      WICKET_COLOR
    );
    await this.beat(gen, STEP_GAP_MS);
  }

  private async playExtra(gen: number, extraValue: string) {
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

    // Wides and no-balls don't count as legal deliveries — the over
    // doesn't advance, so no bowler-change check for those.
    const isLegalDelivery = extraValue === "bye" || extraValue === "legBye";

    if (extraValue === "noBall") {
      await this.beat(gen, STEP_GAP_MS);
      if (!this.isCurrent(gen)) return;
      await this.announcedClick(
        gen,
        "demo-free-hit-toggle",
        "Mark Free Hit",
        "That no-ball earns a Free Hit — marking it active for the very next delivery.",
        "Free Hit is now active.",
        RUN_COLOR
      );
      await this.beat(gen, STEP_GAP_MS);
      if (!this.isCurrent(gen)) return;
      await this.demonstrateFreeHitConstraint(gen);
      if (!this.isCurrent(gen)) return;
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
      await this.announcedClick(
        gen,
        "demo-free-hit-toggle",
        "Cancel Free Hit",
        "Clearing the Free Hit flag — normal dismissal rules apply again from the next delivery.",
        "Free Hit cleared.",
        RUN_COLOR
      );
      // The free-hit ball itself IS a legal delivery.
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

  // Rare, generic "undo" demonstration — fires (at most once per
  // innings, low probability) right after whatever delivery just
  // actually happened, whether that was a run, an extra, or a wicket.
  // This replaces the old behavior of always forcing a scripted
  // "score 2" specifically so it could be undone.
  private async maybeDemoUndo(gen: number, kindLabel: string): Promise<boolean> {
    if (!this.isCurrent(gen)) return false;
    const h = this.handleGetter();
    if (!h || !h.canUndo()) return false;
    if (Math.random() >= UNDO_DEMO_CHANCE) return false;
    await this.announcedClick(
      gen,
      "demo-undo-ball",
      "Undo last ball",
      `Just to show recovery works on any delivery, not only runs — undoing that last ${kindLabel}.`,
      "Last ball undone — score, striker stats, and bowler figures rolled back exactly one delivery.",
      UNDO_COLOR
    );
    await this.beat(gen, STEP_GAP_MS);
    return true;
  }

  // Runs deliveries until the innings genuinely ends — all out, overs
  // complete, or the engine itself flags matchComplete (e.g. target
  // reached mid-over in the chase) — rather than a fixed ball count.
  // Showcase coverage (each run value, each extra, a bowled wicket, a
  // run-out) is force-served as the innings gets close to its natural
  // end, but no longer DEFINES how long the innings runs.
  //
  // A random, rare "manual swap strike" demo beat is also allowed to
  // fire mid-innings (never as the very first action of a cycle, since
  // by this point the page has already scrolled to the scoring area
  // naturally via ensureAssignments' clicks).
  private async playInnings(gen: number, allowRunOutShowcase: boolean) {
    const coverage = {
      runs: new Set<PlainRun>(),
      extras: new Set<string>(),
      wicket: false,
      runOut: false,
    };

    let safetyBallsBowled = 0;
    let swapStrikeDemoDone = false;
    let undoDemoDone = false;

    while (this.isCurrent(gen)) {
      const h = this.handleGetter();
      if (!h) break;
      if (h.isMatchComplete()) break;
      if (h.noPartnerAvailable()) break;

      const maxLegalBalls = h.getMaxLegalBalls();
      const legalBallsBowled = h.getLegalBallsBowled();
      if (maxLegalBalls !== undefined && legalBallsBowled >= maxLegalBalls) break;

      // Bug-guard: stop even an uncapped (Test-style) innings after a
      // very generous number of deliveries, so a stuck state can never
      // spin the driver forever. This should not be reached in normal
      // T20/ODI play, where getMaxLegalBalls() ends things long before.
      const safetyCap = maxLegalBalls !== undefined ? maxLegalBalls + LEGAL_BALLS_PER_OVER * 2 : UNCAPPED_FORMAT_SAFETY_BALLS;
      if (safetyBallsBowled >= safetyCap) break;

      if (!(await this.readyToScore(gen))) return this.handlePausedFlow(gen);

      // Manual "Swap Strike" override — rare, and only after a few
      // legal deliveries have already been bowled this innings so it
      // never fires as the very first click of the cycle.
      if (!swapStrikeDemoDone && safetyBallsBowled >= 3 && Math.random() < SWAP_STRIKE_DEMO_CHANCE) {
        swapStrikeDemoDone = true;
        await this.announcedClick(
          gen,
          "demo-swap-strike",
          "Swap strike (manual)",
          "Strike already rotates automatically on odd runs and at the end of an over — this is the manual override for the rare case a scorer needs to correct or force it.",
          "Strike swapped manually — the other batter is now facing.",
          RUN_COLOR
        );
        await this.beat(gen, STEP_GAP_MS);
        if (!this.isCurrent(gen)) continue;
      }

      const ballsRemainingInFormat = maxLegalBalls !== undefined ? maxLegalBalls - legalBallsBowled : undefined;
      const nearEnd = ballsRemainingInFormat !== undefined && ballsRemainingInFormat <= 8;

      const needsRunCoverage = ([0, 1, 2, 3, 4, 6] as PlainRun[]).find((r) => !coverage.runs.has(r));
      const needsExtraCoverage = ["wide", "noBall", "bye", "legBye"].find((e) => !coverage.extras.has(e));

      if (nearEnd && !coverage.wicket) {
        await this.takeAWicket(gen, "striker", false);
        coverage.wicket = true;
        safetyBallsBowled += 1;
        if (!undoDemoDone) undoDemoDone = await this.maybeDemoUndo(gen, "wicket");
        if (!(await this.ensureAssignments(gen))) return;
        continue;
      }
      if (allowRunOutShowcase && nearEnd && !coverage.runOut) {
        await this.takeAWicket(gen, "nonstriker", true);
        coverage.runOut = true;
        safetyBallsBowled += 1;
        if (!(await this.ensureAssignments(gen))) return;
        continue;
      }
      if (ballsRemainingInFormat !== undefined && ballsRemainingInFormat <= 16 && needsExtraCoverage) {
        await this.playExtra(gen, needsExtraCoverage);
        coverage.extras.add(needsExtraCoverage);
        safetyBallsBowled += 1;
        if (!undoDemoDone) undoDemoDone = await this.maybeDemoUndo(gen, "extra");
        continue;
      }
      if (ballsRemainingInFormat !== undefined && ballsRemainingInFormat <= 22 && needsRunCoverage !== undefined) {
        await this.playPlainRun(gen, needsRunCoverage);
        coverage.runs.add(needsRunCoverage);
        safetyBallsBowled += 1;
        if (!undoDemoDone) undoDemoDone = await this.maybeDemoUndo(gen, "run");
        continue;
      }

      const delivery = pickDelivery();
      if (delivery.type === "wicket" && !coverage.wicket) {
        await this.takeAWicket(gen, "striker", false);
        coverage.wicket = true;
        safetyBallsBowled += 1;
        if (!undoDemoDone) undoDemoDone = await this.maybeDemoUndo(gen, "wicket");
        if (!(await this.ensureAssignments(gen))) return;
      } else if (delivery.type === "wicket") {
        // Genuinely allow further wickets once the showcase one has
        // already happened — a real innings can lose more than one
        // batter. Random dismissal type each time via takeAWicket.
        await this.takeAWicket(gen, "striker", false);
        safetyBallsBowled += 1;
        if (!undoDemoDone) undoDemoDone = await this.maybeDemoUndo(gen, "wicket");
        if (!(await this.ensureAssignments(gen))) return;
      } else if (delivery.type === "extra") {
        await this.playExtra(gen, delivery.extra);
        coverage.extras.add(delivery.extra);
        safetyBallsBowled += 1;
        if (!undoDemoDone) undoDemoDone = await this.maybeDemoUndo(gen, "extra");
      } else {
        await this.playPlainRun(gen, delivery.value);
        coverage.runs.add(delivery.value);
        safetyBallsBowled += 1;
        if (!undoDemoDone) undoDemoDone = await this.maybeDemoUndo(gen, "run");
      }
    }
  }

  private async runOneMatchCycle(gen: number) {
    this.legalBallsThisOver = 0;
    this.onLog("Auto-demo: assigning openers");
    if (!(await this.ensureAssignments(gen))) return;

    // Note: the manual "Swap Strike" demo no longer runs here. It now
    // fires (rarely) from inside playInnings, once real scoring is
    // already underway — see SWAP_STRIKE_DEMO_CHANCE above.

    if (!(await this.readyToScore(gen))) return this.handlePausedFlow(gen);

    // Note: the old guaranteed "score 2, then immediately undo it" beat
    // is gone. Undo is now demonstrated rarely and generically — see
    // maybeDemoUndo, called from inside playInnings after whatever
    // delivery actually happens (run, extra, or wicket) — so most
    // cycles show no undo at all, and the ones that do show it undoing
    // something real rather than a delivery invented just to be undone.

    // Innings 1 — runs until it genuinely ends (all out or overs
    // complete), not a fixed ball count.
    await this.playInnings(gen, true);
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

      // Innings 2 — same real stopping conditions: all out, overs
      // complete, OR target reached (the engine flips matchComplete on
      // its own the instant the winning run lands, and playInnings
      // checks isMatchComplete() every loop, so the chase stops the
      // moment it's actually won rather than playing on past that).
      await this.playInnings(gen, false);
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

  // FIX: cursor.x/y from useDemoCursor are absolute VIEWPORT pixels
  // (getBoundingClientRect, matched to DemoCursor's position:fixed
  // portal to document.body). DemoCursor's frameWidth/frameHeight must
  // therefore describe the real viewport — not this wrapper div's own
  // clientWidth/clientHeight, which is a much smaller local box. Using
  // the wrong (smaller) frame size previously made the ghost cursor
  // drift toward the center of that local box instead of tracking the
  // element it had actually just clicked.
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