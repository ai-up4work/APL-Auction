// File: lib/demo/tournament/bracketInteractiveController.ts
"use client";

import { bracketDemoModel } from "./bracketDemoModel";

// Replaces bracketOrchestrator once a real person takes over. Real clicks
// on the real controls (reshuffle, format, team count, each match's
// "Save result" button) already call bracketDemoModel's methods directly
// — that's the whole point of routing every control through the model
// instead of local component state — so this controller has nothing to
// drive. It only owns the hand-off itself: flips the mode flag and
// clears out whatever bot cursor/narrator caption was left on screen.
class BracketInteractiveController {
  private running = false;

  start() {
    if (this.running) return;
    this.running = true;
    bracketDemoModel.setMode("interactive");
    if (bracketDemoModel.getSnapshot().status === "paused") {
      bracketDemoModel.resume();
    }
    bracketDemoModel.setCursor({ visible: false });
    bracketDemoModel.setNarrator("");
  }

  stop() {
    this.running = false;
  }
}

export const bracketInteractiveController = new BracketInteractiveController();