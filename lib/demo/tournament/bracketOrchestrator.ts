// File: lib/demo/tournament/bracketOrchestrator.ts
"use client";

import { bracketDemoModel, getBracketSnapshot, allDoubleElimMatches } from "./bracketDemoModel";
import type { MatchNode } from "@/components/demo/TournamentBracket";

const BOT_LABEL = "Auto-Sim";
const BOT_COLOR = "#c9971f";
const PANEL_SELECTOR = '[data-demo-panel="bracket"]';

// Must match BotCursor's CSS transition duration (page.tsx: "left 700ms
// cubic-bezier(...)") — nothing should touch a control until the dot has
// actually finished gliding there, or the score/click will visibly land
// before the cursor does.
const CURSOR_GLIDE_MS = 700;

const STEP_READ_MS = 500; // brief pause once the cursor settles, "reading" the matchup
const STEP_CHAR_MS = 220; // delay between each typed digit
const STEP_CLICK_MS = 550; // click pulse duration before the result lands
const STEP_SETTLE_MS = 1300; // narrator caption stays up before the next match

// Chance that a scripted match ends in a tie, forcing the tie-break
// chooser to appear instead of the normal Save button.
const TIE_PROBABILITY = 0.15;

function getPanel(): HTMLElement | null {
  return document.querySelector(PANEL_SELECTOR) as HTMLElement | null;
}

function getLocalOffset(el: HTMLElement, container: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== container) {
    x += node.offsetLeft || 0;
    y += node.offsetTop || 0;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

/** Moves the simulated cursor onto any element inside the bracket panel
 *  by id, scrolling it into view. Returns false (and hides the cursor)
 *  if the element isn't currently mounted — e.g. asking for the tie
 *  buttons on a match that turned out decisive. This only STARTS the
 *  glide (the actual motion is a CSS transition on `left`/`top`) — callers
 *  must wait CURSOR_GLIDE_MS before doing anything to the target. */
function moveCursorTo(targetId: string, label = BOT_LABEL): boolean {
  const container = getPanel();
  const el = container?.querySelector<HTMLElement>(`#${targetId}`) ?? null;
  if (!container || !el) {
    bracketDemoModel.setCursor({ visible: false });
    return false;
  }
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  const { x, y } = getLocalOffset(el, container);
  bracketDemoModel.setCursor({
    visible: true,
    x: x + el.offsetWidth / 2,
    y: y + el.offsetHeight / 2,
    label,
    color: BOT_COLOR,
    clicking: false,
  });
  return true;
}

function pulseClick() {
  bracketDemoModel.setCursor({ clicking: true });
  setTimeout(() => bracketDemoModel.setCursor({ clicking: false }), STEP_CLICK_MS);
}

/** Sets a native <input>'s value the way a real keystroke would, so
 *  React's onChange actually fires (plain el.value = x does not notify
 *  React's synthetic event system). */
function setNativeInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function getInput(targetId: string): HTMLInputElement | null {
  const container = getPanel();
  return container?.querySelector<HTMLInputElement>(`#${targetId}`) ?? null;
}

/** Fires a real click on a real control (Save button or tie-break
 *  button) so whatever onClick handler is wired up — submitDecisive,
 *  submitTieBreak — runs exactly as it would for a person, instead of
 *  the bot calling the model directly. */
function clickTarget(targetId: string): boolean {
  const container = getPanel();
  const el = container?.querySelector<HTMLElement>(`#${targetId}`) ?? null;
  if (!el) return false;
  el.click();
  return true;
}

/** Scripts a scoreline for a simulated match. Most of the time it's a
 *  normal decisive result (mix of close 1-goal games and blowouts);
 *  sometimes (TIE_PROBABILITY) it's a deliberate tie, to exercise the
 *  tie-break chooser UI. Returns the two values plus, if not a tie,
 *  which side actually wins. */
function scriptScoreline(): { scoreA: number; scoreB: number; winner: "A" | "B" | null } {
  if (Math.random() < TIE_PROBABILITY) {
    const tied = Math.floor(Math.random() * 3) + 1; // 1-3 apiece
    return { scoreA: tied, scoreB: tied, winner: null };
  }
  const winnerSide: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
  const blowout = Math.random() < 0.3;
  const winnerScore = blowout ? Math.floor(Math.random() * 3) + 4 : Math.floor(Math.random() * 2) + 2; // 4-6 or 2-3
  const loserScore = Math.max(0, winnerScore - (Math.floor(Math.random() * 3) + 1));
  return winnerSide === "A"
    ? { scoreA: winnerScore, scoreB: loserScore, winner: "A" }
    : { scoreA: loserScore, scoreB: winnerScore, winner: "B" };
}

/** Next match that's actually decidable right now — both slots filled,
 *  neither a bye, still scheduled. Byes and TBD slots resolve themselves
 *  via the generators, nothing to simulate there. */
function findNextMatch(): MatchNode | null {
  const snap = getBracketSnapshot();
  const matches =
    snap.format === "single_elimination"
      ? snap.singleRounds?.flatMap((r) => r.matches) ?? []
      : snap.doubleData
      ? allDoubleElimMatches(snap.doubleData)
      : [];
  return (
    matches.find(
      (m) => m.status === "scheduled" && m.teamA && m.teamB && m.teamA.code !== "BYE" && m.teamB.code !== "BYE"
    ) ?? null
  );
}

type Pending = { timer: ReturnType<typeof setTimeout>; fireAt: number; remaining?: number; run: () => void };

export class BracketOrchestrator {
  private timers: Pending[] = [];
  private running = false;
  private modelUnsub: (() => void) | null = null;
  // Flips true the instant the model reports "completed" (which can
  // happen mid-episode, the moment the winning result is recorded), so
  // any steps still scheduled for that episode's tail get cancelled
  // immediately instead of bleeding past the completion overlay.
  private wasCompleted = false;

  private schedule(run: () => void, delayMs: number) {
    const fireAt = Date.now() + delayMs;
    const timer = setTimeout(() => {
      this.timers = this.timers.filter((t) => t.timer !== timer);
      run();
    }, delayMs);
    this.timers.push({ timer, fireAt, run });
  }

  start() {
    if (this.running) return;
    this.running = true;
    bracketDemoModel.setMode("demo");
    if (bracketDemoModel.getSnapshot().status !== "completed") {
      bracketDemoModel.setStatus("live");
    }
    this.wasCompleted = getBracketSnapshot().status === "completed";

    this.modelUnsub = bracketDemoModel.subscribe(() => {
      if (!this.running) return;
      const isCompleted = getBracketSnapshot().status === "completed";
      if (isCompleted && !this.wasCompleted) {
        this.wasCompleted = true;
        this.timers.forEach((t) => clearTimeout(t.timer));
        this.timers = [];
        bracketDemoModel.setCursor({ visible: false });
      } else if (!isCompleted) {
        this.wasCompleted = false;
      }
    });

    this.schedule(() => this.runNext(), 300);
  }

  stop() {
    this.running = false;
    this.timers.forEach((t) => clearTimeout(t.timer));
    this.timers = [];
    this.modelUnsub?.();
    this.modelUnsub = null;
    bracketDemoModel.setCursor({ visible: false });
  }

  pause() {
    if (!this.running) return;
    const now = Date.now();
    this.timers = this.timers.map((t) => {
      clearTimeout(t.timer);
      return { ...t, remaining: Math.max(0, t.fireAt - now) };
    });
    bracketDemoModel.pause();
  }

  resume() {
    if (!this.running) return;
    const toResume = this.timers;
    this.timers = [];
    toResume.forEach((t) => this.schedule(t.run, t.remaining ?? 0));
    bracketDemoModel.resume();
  }

  private runNext() {
    if (!this.running) return;
    if (getBracketSnapshot().status === "completed") return;
    const match = findNextMatch();
    if (match) this.runMatchEpisode(match);
    // No decidable match and no champion yet only happens for an instant
    // mid-generation — the next model update (a new bracket, a fresh
    // cycle) re-triggers runNext() via its own scheduled steps.
  }

  /** Moves the cursor to `targetId`, waits out the full glide, then runs
   *  `after` — guaranteeing nothing happens to a control until the dot
   *  has visibly arrived on top of it. Returns the delay consumed so
   *  callers can chain further steps off of it. */
  private glideThenAct(atMs: number, targetId: string, after: () => void): number {
    this.schedule(() => moveCursorTo(targetId), atMs);
    this.schedule(() => after(), atMs + CURSOR_GLIDE_MS);
    return atMs + CURSOR_GLIDE_MS;
  }

  /** Types `value` into the input at `targetId` one character at a time,
   *  each on its own timer, starting at `atMs` (which should already be
   *  past the cursor's glide there). Returns the time the last character
   *  lands so callers can chain the next step after typing finishes. */
  private typeDigitsInto(atMs: number, targetId: string, value: string): number {
    let cursorTime = atMs;
    let soFar = "";
    for (const ch of value) {
      soFar += ch;
      const snapshot = soFar;
      this.schedule(() => {
        const el = getInput(targetId);
        if (el) setNativeInputValue(el, snapshot);
      }, cursorTime);
      cursorTime += STEP_CHAR_MS;
    }
    return cursorTime;
  }

  private runMatchEpisode(match: MatchNode) {
    const { scoreA, scoreB, winner } = scriptScoreline();
    const winnerTeam = winner === "A" ? match.teamA : winner === "B" ? match.teamB : null;

    // 1) Approach the card, glide fully in, then pause briefly as if
    //    "reading" the matchup before touching anything.
    this.schedule(() => {
      bracketDemoModel.setNarrator(`Simulating ${match.label}…`);
      moveCursorTo(`match-card-${match.id}`);
    }, 0);
    let t = CURSOR_GLIDE_MS + STEP_READ_MS;

    // 2) Glide to score input A, THEN start typing digit by digit —
    //    typing never starts mid-flight.
    this.schedule(() => moveCursorTo(`score-input-${match.id}-A`), t);
    t += CURSOR_GLIDE_MS;
    t = this.typeDigitsInto(t, `score-input-${match.id}-A`, String(scoreA));
    t += STEP_READ_MS;

    // 3) Same for score input B.
    this.schedule(() => moveCursorTo(`score-input-${match.id}-B`), t);
    t += CURSOR_GLIDE_MS;
    t = this.typeDigitsInto(t, `score-input-${match.id}-B`, String(scoreB));
    t += STEP_READ_MS;

    // 4) Glide to whichever control the UI actually rendered — the plain
    //    Save button for a decisive score, or the tie-break chooser if
    //    the scripted scoreline came out level — pulse, THEN click, once
    //    fully arrived.
    const primaryTieWinner: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
    const controlId = winner ? `save-btn-${match.id}` : `tie-btn-${match.id}-${primaryTieWinner}`;

    this.schedule(() => moveCursorTo(controlId), t);
    t += CURSOR_GLIDE_MS;
    this.schedule(() => pulseClick(), t);
    t += STEP_CLICK_MS;

    this.schedule(() => {
      clickTarget(controlId);
      if (getBracketSnapshot().status !== "completed") {
        const label = winnerTeam?.name ?? "Winner";
        bracketDemoModel.setNarrator(
          winner
            ? `${label} takes ${match.label}, ${scoreA}-${scoreB}`
            : `${match.label} finishes level ${scoreA}-${scoreB} — decided on the tiebreak`
        );
      }
    }, t);

    this.schedule(() => this.runNext(), t + STEP_SETTLE_MS);
  }

  /** Completion overlay's "Restart Demo" — fresh seeding + a clean
   *  bracket, scripted timeline picks back up right away. */
  restartAfterCompletion() {
    if (!this.running) return;
    this.wasCompleted = false;
    bracketDemoModel.startNewCycle();
    this.schedule(() => this.runNext(), 300);
  }
}

export const bracketOrchestrator = new BracketOrchestrator();