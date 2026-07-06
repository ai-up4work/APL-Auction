// lib/overlayBus.ts
"use client";

import { supabase } from "@/lib/supabse";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface WeatherData {
  venue: string;
  temp: number;
  unit: "C" | "F";
  condition: string;
  corner: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

export type OverlayEvent =
  | { type: "tournamentLogo"; show: boolean }
  | { type: "weather"; show: boolean; data?: Partial<WeatherData> }
  | { type: "matchBoundaries"; show: boolean; fours?: number; sixes?: number }
  | { type: "tournamentBoundaries"; show: boolean; fours?: number; sixes?: number }
  | { type: "liveScoreBar"; show: boolean }
  | { type: "pointsTable"; show: boolean }
  | { type: "matchScorecard"; show: boolean }
  | { type: "matchIntro"; show: boolean }
  | { type: "moment"; moment: "four" | "six" | "wicket" | "fifty" | "hundred" }
  | { type: "testBg"; show: boolean }   // ← NEW: admin-toggled preview background
  | { type: "clearAll" };

type Handler = (event: OverlayEvent) => void;

const BROADCAST_EVENT_NAME = "overlay-event";

export function connectOverlayBus(auctionId: string) {
  let ready = false;
  const handlers = new Set<Handler>();
  const readyWaiters = new Set<() => void>();
  const queue: OverlayEvent[] = [];

  const channel: RealtimeChannel = supabase.channel(`overlay:${auctionId}`, {
    config: { broadcast: { self: false } },
  });

  channel.on("broadcast", { event: BROADCAST_EVENT_NAME }, (msg) => {
    const event = msg.payload as OverlayEvent;
    handlers.forEach((h) => h(event));
  });

  channel.subscribe((status) => {
    ready = status === "SUBSCRIBED";
    if (ready) {
      if (queue.length) {
        queue.splice(0).forEach((event) =>
          channel.send({ type: "broadcast", event: BROADCAST_EVENT_NAME, payload: event })
        );
      }
      readyWaiters.forEach((fn) => fn());
      readyWaiters.clear();
    }
  });

  return {
    get isReady() {
      return ready;
    },
    onReady(fn: () => void) {
      if (ready) fn();
      else readyWaiters.add(fn);
    },
    send(event: OverlayEvent) {
      if (!ready) {
        queue.push(event);
        return;
      }
      channel.send({ type: "broadcast", event: BROADCAST_EVENT_NAME, payload: event });
    },
    on(handler: Handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    disconnect() {
      handlers.clear();
      readyWaiters.clear();
      supabase.removeChannel(channel);
    },
  };
}