// File: app/sandbox/overlay/lib/sandboxBus.ts
//
// Cross-document sync for the sandbox, using the browser's native
// BroadcastChannel API — every same-origin document (tab, window, OR
// iframe) that opens a channel with the same name can postMessage to
// every other one, no server round trip involved. This is what lets the
// admin page (controls + scoring) and the tiny <iframe> preview monitor
// it embeds (display only — see app/sandbox/overlay/preview/page.tsx)
// stay in sync, since they are genuinely separate documents with
// separate window objects.
//
// Why this exists again: overlay components like MatchMomentOverlay use
// createPortal(..., document.body), so they always portal to whichever
// document they're actually mounted in. A CSS-scaled <div> inside the
// admin page's own document can't contain that portal — the overlay
// just escapes to the admin page's real body. Giving the monitor its
// own iframe (its own document, its own document.body) fixes the
// portal problem, but means the iframe needs some way to find out what
// the admin page is currently showing — that's this bus.
//
// Not supported in some very old browsers, but fine for every modern
// evergreen browser this sandbox is meant to run in.
//
// SandboxInningsCards lives here (not in page.tsx) because it's part of
// the shared state contract: page.tsx builds it, sends it over the bus
// inside SandboxState, and preview/page.tsx reads it back off the bus
// to hand to its own <BroadcastSurface>. Both call sites import the
// same type from here instead of each declaring their own shape.

"use client";

import type { MatchSetup, LiveState, WeatherData, MomentPayload } from "@/lib/overlayBus";

export interface SandboxChannels {
  weather: boolean;
  liveScoreBar: boolean;
  matchBoundaries: boolean;
  tournamentBoundaries: boolean;
  matchIntro: boolean;
  tournamentLogo: boolean;
  matchScorecard: boolean;
}

// Accumulated scorecard data for one innings — see page.tsx's header
// comment for why this can't be derived from liveState alone (it only
// ever tracks the CURRENT striker/non-striker/bowler; anyone dismissed
// or rotated out vanishes from it unless something snapshots them
// first).
export interface CardBatterLine {
  name: string;
  runs: number;
  balls: number;
  out?: string;
}

export interface CardBowlerLine {
  name: string;
  overs: string;
  figures: string;
}

export interface InningsCardSnapshot {
  label: string;
  score: string;
  overs: string;
  batting: CardBatterLine[];
  bowling: CardBowlerLine[];
}

export type SandboxInningsCards = { 1?: InningsCardSnapshot; 2?: InningsCardSnapshot };

export interface SandboxState {
  matchSetup: MatchSetup;
  liveState: LiveState;
  weatherData: WeatherData;
  channels: SandboxChannels;
  inningsCards: SandboxInningsCards;
}

export type SandboxMessage =
  | { type: "state"; data: SandboxState }
  | { type: "moment"; moment: MomentPayload["moment"]; payload: MomentPayload }
  | { type: "requestState" }
  | { type: "ping" };

const CHANNEL_NAME = "cricket-overlay-sandbox";

export function connectSandboxBus() {
  const bc = new BroadcastChannel(CHANNEL_NAME);
  return {
    send(msg: SandboxMessage) {
      bc.postMessage(msg);
    },
    // Returns an unsubscribe function so callers can clean up a single
    // listener without necessarily closing the whole channel.
    on(handler: (msg: SandboxMessage) => void) {
      const listener = (e: MessageEvent<SandboxMessage>) => handler(e.data);
      bc.addEventListener("message", listener);
      return () => bc.removeEventListener("message", listener);
    },
    close() {
      bc.close();
    },
  };
}