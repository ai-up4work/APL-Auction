// File: app/sandbox/overlay/lib/sandboxBus.ts
//
// Cross-window sync for the sandbox, using the browser's native
// BroadcastChannel API — every same-origin tab/window that opens a
// channel with the same name can postMessage to every other one, no
// server round trip involved. This is what lets the admin window
// (controls only) and the preview window (display only, opened
// separately so the display components' `createPortal(..., document.
// body)` calls take over THAT window instead of bleeding onto the
// admin UI) stay in sync without touching Supabase.
//
// Not supported in some very old browsers, but fine for every modern
// evergreen browser this sandbox is meant to run in.

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

export interface SandboxState {
  matchSetup: MatchSetup;
  liveState: LiveState;
  weatherData: WeatherData;
  channels: SandboxChannels;
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