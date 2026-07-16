"use client";

import { demoModel, getDemoSnapshot } from "./demoModel";

// Replaces demoOrchestrator when a real person is controlling the panels.
// Real clicks on the real buttons in DemoAuctioneerPage / DemoOwnerBidPage
// already call demoModel.startShuffle() / placeBid() / hammerSold() /
// markUnsold() directly, so this controller doesn't need to drive those.
//
// It DOES need to own one thing end-to-end: the "director's cut" jump to
// the Watch panel while the shuffle reel is spinning, and the jump back
// to wherever focus was before once the reveal settles. demoModel's own
// forceFocus() calls inside startShuffle()/revealLot() are a one-shot
// write at the instant those functions run — if a click handler in the
// auctioneer/owner UI does anything else to activePanels in the same
// tick (a chip toggle, a manual pin, etc.) it can stomp that write right
// back out. Watching the snapshot here instead means the rule is
// re-asserted continuously for as long as the lot is actually shuffling,
// so it can't be raced or overridden by unrelated focus changes.
//
// Deliberately does NOT call demoModel.reset() here — switching modes is a
// hand-off, not a restart. Whatever lot/purses/history exist when the
// person flips from "Watch demo" to "Try it yourself" (or back) carry
// straight over; setMode() only flips the mode flag (and re-enables
// auto-focus) without touching any auction data.
class DemoInteractiveController {
  private unsub: (() => void) | null = null;
  private running = false;

  // Tracks the lot status we last reacted to, so the shuffle->watch jump
  // (and the jump back) each fire exactly once per transition instead of
  // re-running on every unrelated snapshot update (bids, cursor moves,
  // pulse timers, etc. all also go through this same subscribe callback).
  private lastLotId: string | null = null;
  private lastStatus: string | null = null;

  // Whatever the spotlight was showing right before a shuffle started —
  // restored once the reveal settles, if the person had auto-focus turned
  // off (i.e. they'd manually pinned a panel). If auto-focus is on we
  // don't need this: resumeAutoFocus()/revealLot()'s own forceFocus
  // already puts the right owner back up.
  private preShufflePanels: string[] | null = null;

  start() {
    if (this.running) return;
    this.running = true;
    demoModel.setMode("interactive");

    // Seed from current state so we don't misfire a transition on the
    // very first callback after switching into interactive mode.
    const snap = getDemoSnapshot();
    this.lastLotId = snap.currentLot?.id ?? null;
    this.lastStatus = snap.currentLot?.status ?? null;
    this.preShufflePanels = null;

    this.unsub = demoModel.subscribe(() => {
      demoModel.refillIfEmpty();
      this.reactToLotStatus();
    });
  }

  stop() {
    this.running = false;
    this.unsub?.();
    this.unsub = null;
    this.lastLotId = null;
    this.lastStatus = null;
    this.preShufflePanels = null;
  }

  private reactToLotStatus() {
    const snap = getDemoSnapshot();
    if (snap.mode !== "interactive") return;

    const lot = snap.currentLot;
    const lotId = lot?.id ?? null;
    const status = lot?.status ?? null;

    // Nothing changed since the last time we looked — ignore. (Most
    // subscribe firings are unrelated updates: bids, cursor moves, etc.)
    if (lotId === this.lastLotId && status === this.lastStatus) return;

    const enteringShuffle = status === "shuffling" && this.lastStatus !== "shuffling";
    const leavingShuffle = this.lastStatus === "shuffling" && status !== "shuffling";

    if (enteringShuffle) {
      // Remember what was up before we hijack the spotlight, so we can
      // put it back afterward if the person isn't on auto-focus.
      this.preShufflePanels = snap.activePanels;
      demoModel.setActivePanel(["auctioneer", "watch"]);
    } else if (leavingShuffle) {
      if (snap.autoFocusEnabled) {
        // Let the model's own logic decide (lands on the auctioneer +
        // whichever owner was last focused, or the neutral grid if the
        // lot resolved instantly for some reason).
        demoModel.resumeAutoFocus();
      } else if (this.preShufflePanels) {
        demoModel.setActivePanel(this.preShufflePanels);
      }
      this.preShufflePanels = null;
    }

    this.lastLotId = lotId;
    this.lastStatus = status;
  }
}

export const demoInteractiveController = new DemoInteractiveController();