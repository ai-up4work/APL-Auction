"use client";

import { demoModel, getDemoSnapshot, fmtPts } from "./demoModel";

const AUCTIONEER = "auctioneer";
const OWNER_A = "ownerA";
const OWNER_B = "ownerB";
const WATCH = "watch";
const ALL_PANELS = [AUCTIONEER, OWNER_A, OWNER_B, WATCH];

type EpisodeOutcome = "sold" | "unsold";

type Step =
  | { at: number; type: "cursor"; actor: string; panel: string; targetId: string; label: string; color: string }
  | { at: number; type: "click"; actor: string }
  | { at: number; type: "hide"; actor: string }
  | { at: number; type: "shuffle" }
  | { at: number; type: "reveal" }
  | { at: number; type: "bid"; teamId: string }
  | { at: number; type: "sold" }
  | { at: number; type: "focus"; panels: string[] }
  | { at: number; type: "sync"; panels: string[] }
  | { at: number; type: "narrator"; text: () => string };

function focusStep(at: number, panels: string | string[]): Step {
  return { at, type: "focus", panels: Array.isArray(panels) ? panels : [panels] };
}

const lastTarget: Record<string, HTMLElement | null> = {};

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

function moveCursor(actor: string, panel: string, targetId: string, label: string, color: string) {
  const container = document.querySelector(`[data-demo-panel="${panel}"]`) as HTMLElement | null;
  const el = container?.querySelector<HTMLElement>(`#${targetId}`) ?? null;
  if (!container || !el) {
    lastTarget[actor] = null;
    return;
  }

  lastTarget[actor] = el;

  const { x, y } = getLocalOffset(el, container);
  demoModel.setCursor(actor, {
    panel,
    x: x + el.offsetWidth / 2,
    y: y + el.offsetHeight / 2,
    visible: true,
    clicking: false,
    label,
    color,
  });
}

function click(actor: string) {
  demoModel.setCursor(actor, { clicking: true });
  const el = lastTarget[actor];
  if (el && !(el as HTMLButtonElement).disabled) {
    el.click();
  }
  setTimeout(() => demoModel.setCursor(actor, { clicking: false }), 700);
}

function teamNameFor(teamId: string) {
  return demoModel.getSnapshot().auction.teams.find((t) => t.supabaseId === teamId)?.name ?? teamId;
}

const EXTRA_PAUSE_MS = 2000;

function paceStep(at: number): number {
  if (at < 1700) return at;
  if (at < 3700) return at + EXTRA_PAUSE_MS * 1;
  if (at < 4400) return at + EXTRA_PAUSE_MS * 2;
  if (at < 7400) return at + EXTRA_PAUSE_MS * 3;
  if (at < 10400) return at + EXTRA_PAUSE_MS * 4;
  if (at < 13400) return at + EXTRA_PAUSE_MS * 5;
  if (at < 16400) return at + EXTRA_PAUSE_MS * 6;
  return at + EXTRA_PAUSE_MS * 7;
}

function buildEpisode(aWinsFinal: boolean, outcome: EpisodeOutcome): Step[] {
  const first = aWinsFinal ? OWNER_B : OWNER_A;
  const firstTeam = aWinsFinal ? "tB" : "tA";
  const second = aWinsFinal ? OWNER_A : OWNER_B;
  const secondTeam = aWinsFinal ? "tA" : "tB";
  const nameOf = (a: string) => (a === OWNER_A ? "Priya · CSK Owner" : "Rohan · MI Owner");
  const colorOf = (a: string) => (a === OWNER_A ? "#f5a623" : "#3b8bd4");

  const openBeats: Step[] = [
    { at: 0, type: "narrator", text: () => "Auctioneer opens the next lot" },
    focusStep(0, AUCTIONEER),
    { at: 0, type: "cursor", actor: AUCTIONEER, panel: "auctioneer", targetId: "demo-start-btn", label: "Auctioneer", color: "#c9971f" },
    { at: 1600, type: "click", actor: AUCTIONEER },

    { at: 1700, type: "shuffle" },
    focusStep(1700, [AUCTIONEER, WATCH]),
    { at: 1720, type: "narrator", text: () => "Shuffling the pool — revealing next player…" },
    { at: 1720, type: "sync", panels: ALL_PANELS },

    { at: 3700, type: "reveal" },
    { at: 3720, type: "narrator", text: () => `${demoModel.getSnapshot().currentLot?.playerName ?? "Player"} steps up — bidding is open` },
    { at: 3720, type: "sync", panels: ALL_PANELS },
  ];

  const soldBeats: Step[] = [
    focusStep(4400, [AUCTIONEER, first]),
    { at: 4400, type: "cursor", actor: first, panel: first, targetId: "demo-bid-btn", label: nameOf(first), color: colorOf(first) },
    { at: 4400, type: "narrator", text: () => `${nameOf(first)} places the opening bid` },
    { at: 5800, type: "click", actor: first },
    { at: 5850, type: "bid", teamId: firstTeam },
    { at: 5870, type: "sync", panels: ALL_PANELS },
    { at: 5870, type: "narrator", text: () => {
      const lot = demoModel.getSnapshot().currentLot;
      return lot ? `${teamNameFor(firstTeam)} bids ${fmtPts(lot.currentBid)} pts — live on every screen` : "";
    } },

    focusStep(7400, [AUCTIONEER, second]),
    { at: 7400, type: "cursor", actor: second, panel: second, targetId: "demo-bid-btn", label: nameOf(second), color: colorOf(second) },
    { at: 7400, type: "narrator", text: () => `${nameOf(second)} counters instantly` },
    { at: 8800, type: "click", actor: second },
    { at: 8850, type: "bid", teamId: secondTeam },
    { at: 8870, type: "sync", panels: ALL_PANELS },
    { at: 8870, type: "narrator", text: () => {
      const lot = demoModel.getSnapshot().currentLot;
      return lot ? `${teamNameFor(secondTeam)} counters with ${fmtPts(lot.currentBid)} pts` : "";
    } },

    focusStep(10400, [AUCTIONEER, first]),
    { at: 10400, type: "cursor", actor: first, panel: first, targetId: "demo-bid-btn", label: nameOf(first), color: colorOf(first) },
    { at: 10400, type: "narrator", text: () => `${nameOf(first)} raises again` },
    { at: 11800, type: "click", actor: first },
    { at: 11850, type: "bid", teamId: firstTeam },
    { at: 11870, type: "sync", panels: ALL_PANELS },
    { at: 11870, type: "narrator", text: () => {
      const lot = demoModel.getSnapshot().currentLot;
      return lot ? `${teamNameFor(firstTeam)} pushes to ${fmtPts(lot.currentBid)} pts` : "";
    } },

    focusStep(13400, AUCTIONEER),
    { at: 13400, type: "cursor", actor: AUCTIONEER, panel: "auctioneer", targetId: "demo-hammer-btn", label: "Auctioneer", color: "#c9971f" },
    { at: 13400, type: "narrator", text: () => "Auctioneer calls it — going once, going twice…" },
    { at: 14800, type: "click", actor: AUCTIONEER },
    { at: 14850, type: "sold" },
    { at: 14870, type: "sync", panels: ALL_PANELS },
    { at: 14870, type: "narrator", text: () => {
      const lot = demoModel.getSnapshot().currentLot;
      return lot ? `SOLD — ${lot.playerName} to ${lot.winningTeamCode} for ${fmtPts(lot.currentBid)} pts!` : "Sold!";
    } },
  ];

  const unsoldBeats: Step[] = [
    { at: 4400, type: "narrator", text: () => "No bids coming in — the clock's the only thing moving" },
    focusStep(4400, [AUCTIONEER, WATCH]),
  ];

  const closingBeats: Step[] = [
    focusStep(16400, []),
    { at: 16400, type: "hide", actor: AUCTIONEER },
    { at: 16400, type: "hide", actor: OWNER_A },
    { at: 16400, type: "hide", actor: OWNER_B },
    { at: 16400, type: "narrator", text: () => "Preparing the next lot…" },
  ];

  const rawSteps: Step[] = [
    ...openBeats,
    ...(outcome === "sold" ? soldBeats : unsoldBeats),
    ...closingBeats,
  ];

  return rawSteps.map((s) => ({ ...s, at: paceStep(s.at) }));
}

type Pending = { timer: ReturnType<typeof setTimeout>; fireAt: number; remaining?: number; run: () => void };

export class DemoOrchestrator {
  private timers: Pending[] = [];
  private episode = 0;
  private running = false;
  private paused = false;
  private modelUnsub: (() => void) | null = null;
  // Transition-tracking flag (not a one-shot latch) — flips true the
  // instant the model reports "completed", flips back false the moment
  // it reports anything else (a fresh cycle via startNewCycle(), or a
  // successful re-entry round). This is what lets the watcher below fire
  // exactly once per genuine completion, rather than re-firing on every
  // single unrelated snapshot emission (cursor moves, pulses, etc. all
  // go through the same subscribe callback) while status stays completed.
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
    this.paused = false;
    this.wasCompleted = getDemoSnapshot().auction.status === "completed";
    demoModel.setMode("demo");

    // Watches for the auction flipping to "completed" mid-episode — e.g.
    // the last player selling (hammerSold) or going unsold via the
    // model's own auto-resolve timer, either of which can land partway
    // through a scripted episode. Without this, whatever steps were
    // already scheduled for that episode's tail end (cursor hides, the
    // "preparing next lot" narrator line) keep firing for several
    // seconds afterward — bleeding through the completion overlay's
    // translucent backdrop and reading as "it's already starting again"
    // even though nothing structural changed. Reacting here cancels
    // everything still pending and jumps straight to the completion beat
    // the instant the model itself says it's actually done.
    this.modelUnsub = demoModel.subscribe(() => {
      if (!this.running) return;
      const isCompleted = getDemoSnapshot().auction.status === "completed";
      if (isCompleted && !this.wasCompleted) {
        this.wasCompleted = true;
        this.timers.forEach((t) => clearTimeout(t.timer));
        this.timers = [];
        this.runCompletionEpisode();
      } else if (!isCompleted) {
        this.wasCompleted = false;
      }
    });

    this.runNext();
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.timers.forEach((t) => clearTimeout(t.timer));
    this.timers = [];
    this.modelUnsub?.();
    this.modelUnsub = null;
  }

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    const now = Date.now();
    this.timers = this.timers.map((t) => {
      clearTimeout(t.timer);
      return { ...t, remaining: Math.max(0, t.fireAt - now) };
    });
    demoModel.pause();
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    const toResume = this.timers;
    this.timers = [];
    toResume.forEach((t) => this.schedule(t.run, t.remaining ?? 0));
    demoModel.resume();
  }

  isPaused() {
    return this.paused;
  }

  private runNext() {
    if (!this.running) return;
    const snap = getDemoSnapshot();

    if (snap.auction.players.length > 0) {
      this.runLotEpisode();
      return;
    }
    if (snap.unsoldPlayers.length > 0 && snap.roundInfo.current < snap.roundInfo.limit) {
      this.runReentryEpisode();
      return;
    }
    this.runCompletionEpisode();
  }

  private runLotEpisode() {
    const outcome: EpisodeOutcome = this.episode % 3 === 2 ? "unsold" : "sold";
    const steps = buildEpisode(this.episode % 2 === 0, outcome);
    this.episode += 1;
    steps.forEach((s) => this.schedule(() => this.runStep(s), s.at));
    const total = steps[steps.length - 1].at + 1500;
    this.schedule(() => this.runNext(), total);
  }

  private runReentryEpisode() {
    const count = getDemoSnapshot().unsoldPlayers.length;
    this.schedule(() => {
      demoModel.setActivePanel(["auctioneer", "watch"]);
      demoModel.setNarrator(`Queue's empty — ${count} unsold player${count === 1 ? "" : "s"} eligible for re-entry`);
    }, 0);
    this.schedule(
      () => moveCursor(AUCTIONEER, "auctioneer", "demo-reentry-btn", "Auctioneer", "#c9971f"),
      500
    );
    this.schedule(() => click(AUCTIONEER), 2000);
    this.schedule(() => demoModel.setCursor(AUCTIONEER, { visible: false }), 2900);
    this.schedule(() => this.runNext(), 3800);
  }

  /** Nothing left to call and no re-entry passes remain. Plays the
   * completion beat once and then deliberately schedules nothing
   * further — waits for the person to click either "Try It Yourself" or
   * "Restart" on the completion overlay. May be invoked either from
   * runNext() (the auction ran dry naturally at the top of a fresh
   * decision point) or from the mid-episode watcher in start() (the
   * auction completed partway through a beat that was still playing
   * out) — both paths converge here, and the watcher above guarantees
   * whichever fires first wins and nothing stale is left running. */
  private runCompletionEpisode() {
    this.schedule(() => {
      demoModel.setActivePanel(["auctioneer", "watch"]);
      demoModel.setNarrator("Auction complete — every lot called");
      demoModel.pulsePanels(ALL_PANELS);
    }, 0);
  }

  /** Called by the completion overlay's "Restart Demo" action. Gives the
   * model a fresh player pool/purses/round counters and picks the
   * scripted timeline back up. No-ops if start() was never called or
   * stop() has since torn things down (e.g. the person flipped to
   * interactive mode before clicking Restart). */
  restartAfterCompletion() {
    if (!this.running) return;
    this.wasCompleted = false;
    demoModel.startNewCycle();
    this.runNext();
  }

  private runStep(step: Step) {
    if (!this.running) return;
    switch (step.type) {
      case "cursor": moveCursor(step.actor, step.panel, step.targetId, step.label, step.color); break;
      case "click": click(step.actor); break;
      case "hide": demoModel.setCursor(step.actor, { visible: false }); break;
      case "shuffle": demoModel.startShuffle(); break;
      case "reveal": demoModel.revealLot(); break;
      case "bid": demoModel.placeBid(step.teamId); break;
      case "sold": demoModel.hammerSold(); break;
      case "focus": demoModel.setActivePanel(step.panels); break;
      case "sync": demoModel.pulsePanels(step.panels); break;
      case "narrator": demoModel.setNarrator(step.text()); break;
    }
  }
}

export const demoOrchestrator = new DemoOrchestrator();