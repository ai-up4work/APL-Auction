"use client";

import { demoModel, fmtPts } from "./demoModel";

const AUCTIONEER = "auctioneer";
const OWNER_A = "ownerA";
const OWNER_B = "ownerB";
const WATCH = "watch";
const ALL_PANELS = [AUCTIONEER, OWNER_A, OWNER_B, WATCH];

type Step =
  | { at: number; type: "cursor"; actor: string; panel: string; targetId: string; label: string; color: string }
  | { at: number; type: "click"; actor: string }
  | { at: number; type: "hide"; actor: string }
  | { at: number; type: "shuffle" }
  | { at: number; type: "reveal" }
  | { at: number; type: "bid"; teamId: string }
  | { at: number; type: "sold" }
  // ── Director steps ──────────────────────────────────────────────────
  // `panels` supports zero, one, or several panel keys at once, so beats
  // can spotlight combos (e.g. Auctioneer + the bidding owner, 75/25)
  // instead of only ever a single panel.
  | { at: number; type: "focus"; panels: string[] }
  | { at: number; type: "sync"; panels: string[] }
  | { at: number; type: "narrator"; text: () => string };

/** Convenience so call sites can still write a single panel key inline. */
function focusStep(at: number, panels: string | string[]): Step {
  return { at, type: "focus", panels: Array.isArray(panels) ? panels : [panels] };
}

// Remembers the last real DOM element each actor's cursor was sent to,
// so `click()` can fire a genuine `el.click()` on it.
const lastTarget: Record<string, HTMLElement | null> = {};

// offsetLeft/offsetTop/offsetWidth/offsetHeight are pure LAYOUT values —
// never affected by an ancestor's CSS `transform: scale(...)` (which now
// includes the spotlight/dim wrapper too), so this stays exact regardless
// of how big or small a panel is currently rendered.
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

// Extra breathing room inserted between each *beat* of the episode (open →
// shuffle → reveal → bid → bid → bid → hammer → next lot) — not between
// every individual step within a beat, so a cursor-move-then-click still
// feels snappy, but the automation as a whole doesn't feel like it's
// racing through the auction. Bumping this one constant re-paces the
// entire script.
const EXTRA_PAUSE_MS = 2000;

// Original beat boundaries (in the un-paced timeline below) — every step
// whose original `at` falls in one of these bands gets that many extra
// pauses stacked on top of it, so beats later in the episode end up
// further apart than earlier ones, compounding correctly instead of
// everything shifting by one flat offset.
function paceStep(at: number): number {
  if (at < 1700) return at; // beat 0: open lot
  if (at < 3700) return at + EXTRA_PAUSE_MS * 1; // beat 1: shuffle
  if (at < 4400) return at + EXTRA_PAUSE_MS * 2; // beat 2: reveal
  if (at < 7400) return at + EXTRA_PAUSE_MS * 3; // beat 3: opening bid
  if (at < 10400) return at + EXTRA_PAUSE_MS * 4; // beat 4: counter bid
  if (at < 13400) return at + EXTRA_PAUSE_MS * 5; // beat 5: raise
  if (at < 16400) return at + EXTRA_PAUSE_MS * 6; // beat 6: hammer/sold
  return at + EXTRA_PAUSE_MS * 7; // beat 7: hide / prepare next lot
}

function buildEpisode(aWinsFinal: boolean): Step[] {
  const first = aWinsFinal ? OWNER_B : OWNER_A;
  const firstTeam = aWinsFinal ? "tB" : "tA";
  const second = aWinsFinal ? OWNER_A : OWNER_B;
  const secondTeam = aWinsFinal ? "tA" : "tB";
  const nameOf = (a: string) => (a === OWNER_A ? "Priya · CSK Owner" : "Rohan · MI Owner");
  const colorOf = (a: string) => (a === OWNER_A ? "#f5a623" : "#3b8bd4");

  const rawSteps: Step[] = [
    { at: 0, type: "narrator", text: () => "Auctioneer opens the next lot" },
    focusStep(0, AUCTIONEER),
    { at: 0, type: "cursor", actor: AUCTIONEER, panel: "auctioneer", targetId: "demo-start-btn", label: "Auctioneer", color: "#c9971f" },
    { at: 1600, type: "click", actor: AUCTIONEER },

    { at: 1700, type: "shuffle" },
    // Shuffle/reveal only ever renders on the Watch broadcast screen (the
    // reel lives in DemoWatchPage). Spotlight both desktop feeds
    // (Auctioneer + Watch) together for this whole beat so computeLayout
    // resolves to a clean 50/50 two-desktop split instead of pairing a
    // single desktop panel with an owner's phone (which pulls a mobile
    // panel on screen even though no bidder has anything to show yet).
    focusStep(1700, [AUCTIONEER, WATCH]),
    { at: 1720, type: "narrator", text: () => "Shuffling the pool — revealing next player…" },
    { at: 1720, type: "sync", panels: ALL_PANELS },

    { at: 3700, type: "reveal" },
    { at: 3720, type: "narrator", text: () => `${demoModel.getSnapshot().currentLot?.playerName ?? "Player"} steps up — bidding is open` },
    { at: 3720, type: "sync", panels: ALL_PANELS },

    // Spotlight the bidding owner together with the Auctioneer console
    // (75/25) so the bid and the console reacting to it are visible at
    // once, instead of falling back to the owner+Watch combo.
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

    focusStep(16400, []),
    { at: 16400, type: "hide", actor: AUCTIONEER },
    { at: 16400, type: "hide", actor: OWNER_A },
    { at: 16400, type: "hide", actor: OWNER_B },
    { at: 16400, type: "narrator", text: () => "Preparing the next lot…" },
  ];

  return rawSteps.map((s) => ({ ...s, at: paceStep(s.at) }));
}

// A pending timer, tracked with its wall-clock fire time so pause() can
// compute exactly how much longer it had left, and resume() can put it
// back exactly where it was — rather than pause just meaning "restart
// the episode from scratch" or, worse, the timers silently continuing to
// fire in the background while the UI looks frozen.
type Pending = { timer: ReturnType<typeof setTimeout>; fireAt: number; remaining?: number; run: () => void };

export class DemoOrchestrator {
  private timers: Pending[] = [];
  private episode = 0;
  private running = false;
  private paused = false;

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
    // Deliberately no demoModel.reset() here — mode toggling is a
    // hand-off between drivers, not a restart. Whatever purses, completed
    // lots, and remaining player pool exist carry straight over; setMode()
    // only flips the mode flag. Note: if a lot was mid-bid in manual mode
    // when this fires, the next scripted episode starts a fresh shuffle
    // rather than resuming that exact lot — the pool/purses/history are
    // preserved, but an in-flight lot at the hand-off moment isn't resolved.
    demoModel.setMode("demo");
    this.runNext();
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.timers.forEach((t) => clearTimeout(t.timer));
    this.timers = [];
  }

  /** Freezes the running script exactly where it is — every pending
   * cursor move, click, bid, and the "next episode" timer all remember
   * how much longer they had left, instead of losing their place or (if
   * we'd merely cleared them without saving state) skipping steps on
   * resume. Also freezes the model's bidding clock so a lot mid-countdown
   * doesn't keep ticking down behind the paused UI. */
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

  /** Reschedules every frozen timer with exactly the remaining delay it
   * had at pause() time, and un-freezes the bidding clock. */
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
    demoModel.refillIfEmpty();
    const steps = buildEpisode(this.episode % 2 === 0);
    this.episode += 1;
    steps.forEach((s) => this.schedule(() => this.runStep(s), s.at));
    const total = steps[steps.length - 1].at + 1500;
    this.schedule(() => this.runNext(), total);
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