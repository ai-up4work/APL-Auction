"use client";

import { supabase } from "@/lib/supabse"; // double check this matches your actual file (was "@/lib/supabse")
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface WeatherData {
  venue: string;
  temp: number;
  unit: "C" | "F";
  condition: string;
  corner: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

// ── Match Setup (session-scoped, set once) ─────────────────────────────
// A squad player as pulled from the (reused) auction database — includes
// an image so the overlay/admin can render a face, not just a name.
export interface SquadPlayer {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface TeamInfo {
  name: string;
  shortCode: string;
  color: string;
  logoUrl: string;
  /** Plain name list — kept for backward compatibility with existing overlay renderers. */
  squad: string[];
  /** Richer version of `squad`, with player id + photo, when sourced from the DB. */
  squadPlayers?: SquadPlayer[];
  /** id of the `teams` row this side is bound to, if selected from the DB. */
  teamId?: string;
}

export interface MatchSetup {
  tournamentName: string;
  season: string;
  tournamentLogoUrl: string;
  venue: string;
  format: "T20" | "ODI" | "Test";
  matchNumber: string;
  matchTitle: string;
  teamA: TeamInfo;
  teamB: TeamInfo;
  tossWinner: "A" | "B" | "";
  tossDecision: "bat" | "bowl" | "";
}

// ── Live State (incremental, ticks ball-by-ball) ───────────────────────
export interface BatterState {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  imageUrl?: string; // NEW — used by the striker/non-striker photo buttons
}

export interface BowlerState {
  name: string;
  overs: number;
  balls: number;
  maidens: number;
  runs: number;
  wickets: number;
  imageUrl?: string; // NEW — carousel photo support
}

export interface PointsRow {
  team: string;
  played: number;
  won: number;
  lost: number;
  nrr: string;
  points: number;
}

export interface LiveState {
  score: { runs: number; wickets: number; overs: number; balls: number };
  striker: BatterState;
  nonStriker: BatterState;
  bowler: BowlerState;
  partnership: { runs: number; balls: number };
  matchBoundaries: { fours: number; sixes: number };
  tournamentBoundaries: { fours: number; sixes: number };
  pointsTable: PointsRow[];
}

// ── Moments (one-shot, event-based) ────────────────────────────────────
export type DismissalType = "bowled" | "caught" | "lbw" | "runOut" | "stumped" | "hitWicket";

export interface MomentPayload {
  moment: "four" | "six" | "wicket" | "fifty" | "hundred";
  player?: string;
  score?: string;
  // wicket-only fields:
  batsmanOut?: "striker" | "nonStriker";
  dismissalType?: DismissalType;
  bowler?: string;
  fielder?: string;
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
  | ({ type: "moment" } & MomentPayload)
  | { type: "matchSetup"; data: MatchSetup }
  | { type: "liveState"; data: LiveState }
  | { type: "testBg"; show: boolean }
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