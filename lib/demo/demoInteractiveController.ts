"use client";

import { demoModel } from "./demoModel";

// Replaces demoOrchestrator when a real person is controlling the panels.
// Deliberately does almost nothing: real clicks on the real buttons in
// DemoAuctioneerPage / DemoOwnerBidPage already call demoModel.startShuffle()
// / placeBid() / hammerSold() / markUnsold() directly — this controller just
// keeps the player pool from dead-ending and flags the model as
// "interactive" so the UI knows not to expect a simulated cursor.
class DemoInteractiveController {
  private unsub: (() => void) | null = null;
  private running = false;

  start() {
    if (this.running) return;
    this.running = true;
    demoModel.reset();
    demoModel.setMode("interactive");

    this.unsub = demoModel.subscribe(() => {
      demoModel.refillIfEmpty();
    });
  }

  stop() {
    this.running = false;
    this.unsub?.();
    this.unsub = null;
  }
}

export const demoInteractiveController = new DemoInteractiveController();