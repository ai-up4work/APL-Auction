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

function buildEpisode(aWinsFinal: boolean): Step[] {
  const first = aWinsFinal ? OWNER_B : OWNER_A;
  const firstTeam = aWinsFinal ? "tB" : "tA";
  const second = aWinsFinal ? OWNER_A : OWNER_B;
  const secondTeam = aWinsFinal ? "tA" : "tB";
  const nameOf = (a: string) => (a === OWNER_A ? "Priya · CSK Owner" : "Rohan · MI Owner");
  const colorOf = (a: string) => (a === OWNER_A ? "#f5a623" : "#3b8bd4");

  return [
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
}

export class DemoOrchestrator {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private episode = 0;
  private running = false;

  start() {
    if (this.running) return;
    this.running = true;
    demoModel.reset();
    demoModel.setMode("demo");
    this.runNext();
  }
  stop() {
    this.running = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  private runNext() {
    if (!this.running) return;
    demoModel.refillIfEmpty();
    const steps = buildEpisode(this.episode % 2 === 0);
    this.episode += 1;
    steps.forEach((s) => this.timers.push(setTimeout(() => this.runStep(s), s.at)));
    const total = steps[steps.length - 1].at + 1500;
    this.timers.push(setTimeout(() => this.runNext(), total));
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