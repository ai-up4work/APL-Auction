"use client";

import { supabase } from "@/lib/supabse";

// ─────────────────────────────────────────────────────────────────────────────
// Overlay FX bus
//
// OBS's Browser Source runs its own embedded Chromium process — it does NOT
// share localStorage / BroadcastChannel with your normal browser tab. So the
// admin control panel and the overlay page can't talk to each other directly
// in-browser. Instead we route "fire this animation" events through a
// Supabase Realtime *broadcast* channel (ephemeral — nothing is written to a
// table, it's just a pub/sub pipe scoped to one auctionId).
// ─────────────────────────────────────────────────────────────────────────────

export type StampState = "sold" | "unsold";

export type SoldBoardEntry = {
  id: string;
  team: string;
  player: string;
  price: string;
};

export type OverlayEvent =
  | { type: "stamp"; state: StampState }
  | { type: "confetti"; colors?: string[] }
  | { type: "flash"; color?: string }
  | { type: "lowerThird"; show: boolean; tag?: string; title?: string; subtitle?: string }
  | { type: "scoreboard"; show: boolean; label?: string; value?: string; sub?: string }
  | { type: "ticker"; message: string }
  | { type: "replayBadge"; show: boolean }
  // New: running "sold board" mini scorecard — a short list of recent
  // purchases (team / player / price) rendered as a stacked panel, distinct
  // from the single-line scrolling ticker.
  | { type: "soldBoard"; show: boolean; entry?: SoldBoardEntry; clear?: boolean }
  | { type: "clearAll" };

export function overlayChannelName(auctionId: string) {
  return `overlay-fx:${auctionId}`;
}

/**
 * Connect to the overlay bus for a given auction.
 * Pass `onEvent` on the OVERLAY page to receive triggers.
 * Call `.send()` from the ADMIN page to fire them.
 * Always call `.disconnect()` on unmount.
 */
export function connectOverlayBus(
  auctionId: string,
  onEvent?: (event: OverlayEvent) => void
) {
  const channel = supabase.channel(overlayChannelName(auctionId), {
    config: { broadcast: { self: false } },
  });

  if (onEvent) {
    channel.on("broadcast", { event: "fx" }, (payload: any) => {
      onEvent(payload.payload as OverlayEvent);
    });
  }

  let ready = false;
  channel.subscribe((status: string) => {
    ready = status === "SUBSCRIBED";
  });

  return {
    get isReady() {
      return ready;
    },
    send(event: OverlayEvent) {
      channel.send({ type: "broadcast", event: "fx", payload: event });
    },
    disconnect() {
      supabase.removeChannel(channel);
    },
  };
}

export type Batsman = { name: string; runs: number; balls: number; onStrike?: boolean };
 
export type BowlerFigures = { name: string; overs: string; maidens: number; runs: number; wickets: number };
 
export type StandingRow = { team: string; played: number; won: number; nrr: string; pts: number };
 