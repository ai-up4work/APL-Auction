"use client";

import { supabase } from "@/lib/supabase"; 
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface WeatherData {
  venue: string;
  temp: number;
  unit: "C" | "F";
  condition: string;
  corner: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

// ── Match Setup (session-scoped, set once) ─────────────────────────────
export interface SquadPlayer {
  id: string;
  name: string;
  imageUrl?: string;
  color?: string;
  tier?: string;
}

export interface TeamInfo {
  name: string;
  shortCode: string;
  color: string;
  logoUrl: string;
  squad: string[];
  squadPlayers?: SquadPlayer[];
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
  kickoffTime: string;
  teamA: TeamInfo;
  teamB: TeamInfo;
  matchMeta: string;
  tournament: string;
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
  imageUrl?: string;
}

export interface BowlerState {
  name: string;
  overs: number;
  balls: number;
  maidens: number;
  runs: number;
  wickets: number;
  imageUrl?: string;
}

export interface PointsRow {
  team: string;
  played: number;
  won: number;
  lost: number;
  nrr: string;
  points: number;
}

export interface MatchResult {
  winningTeamName: string;
  margin: string;
  method: "runs" | "wickets" | "tie";
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
  target?: number;
  inningsNumber?: 1 | 2;
  matchComplete?: boolean;
  matchResult?: MatchResult;
  thisOver?: string[];
}

// ── Moments (one-shot, event-based) ────────────────────────────────────
export type DismissalType =
  | "bowled"
  | "caught"
  | "lbw"
  | "runOut"
  | "stumped"
  | "hitWicket"
  | "obstructingField"
  | "retiredOut";

export interface MomentPayload {
  moment: "four" | "six" | "wicket" | "fifty" | "hundred" | "maiden" | "matchWon";
  player?: string;
  score?: string;
  batsmanOut?: "striker" | "nonStriker";
  dismissalType?: DismissalType;
  bowler?: string;
  fielder?: string;
  maidens?: number;
  teamColor?: string;
  teamLogoUrl?: string;
  method?: "runs" | "wickets" | "tie";
}

// ── On Air channel visibility snapshot ──────────────────────────────────
export interface ChannelVisibility {
  weather: boolean;
  liveScoreBar: boolean;
  tournamentLogo: boolean;
  pointsTable: boolean;
  matchScorecard: boolean;
  matchIntro: boolean;
  matchBoundaries: boolean;
  tournamentBoundaries: boolean;
  testBg: boolean;
}

// ── Full state snapshot, sent in reply to a requestSync ───────────────
export interface SyncSnapshot {
  channels: ChannelVisibility;
  matchSetup: MatchSetup;
  matchSetupCompleted: boolean;
  liveState: LiveState;
  weather: WeatherData;
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
  | { type: "clearAll" }
  | { type: "requestSync" }
  | { type: "syncSnapshot"; data: SyncSnapshot };

type Handler = (event: OverlayEvent) => void;

const BROADCAST_EVENT_NAME = "overlay-event";

// Max number of send retries for a single event before giving up and
// just logging. Keeps a single flaky send from silently retrying forever.
const MAX_SEND_RETRIES = 2;

// FIX — connectOverlayBus previously required a truthy `channelKey` to
// be called at all in a meaningful way (page.tsx used to gate this
// entirely on `auctionId`, which is null for matches with no auction —
// e.g. friendly matches). That's fixed on the caller side (page.tsx now
// falls back to `matchId` when `auctionId` is missing), but the
// parameter here is renamed to make it clear this just needs to be
// *some* stable, unique key — it does not have to be an auction id.
export function connectOverlayBus(channelKey: string) {
  let ready = false;
  const handlers = new Set<Handler>();
  const readyWaiters = new Set<() => void>();
  const queue: OverlayEvent[] = [];

  const channel: RealtimeChannel = supabase.channel(`overlay:${channelKey}`, {
    config: { broadcast: { self: false } },
  });

  channel.on("broadcast", { event: BROADCAST_EVENT_NAME }, (msg) => {
    const event = msg.payload as OverlayEvent;
    handlers.forEach((h) => h(event));
  });

  // FIX — channel.send() returns a Promise<"ok" | "timed out" | "error" |
  // "rate_limited"> that was previously never awaited or inspected. That
  // meant a dropped/rate-limited/timed-out broadcast failed completely
  // silently — no console output, no retry, nothing — which made "the
  // overlay just didn't update" reports impossible to diagnose. This
  // wraps every actual channel.send() call, logs non-"ok" results, and
  // retries a couple of times before giving up loudly.
  function sendWithRetry(event: OverlayEvent, attempt = 1) {
    channel
      .send({ type: "broadcast", event: BROADCAST_EVENT_NAME, payload: event })
      .then((resp) => {
        if (resp !== "ok") {
          if (attempt <= MAX_SEND_RETRIES) {
            console.warn(
              "[overlayBus] send returned",
              resp,
              "— retrying",
              `(${attempt}/${MAX_SEND_RETRIES})`,
              "event:",
              event.type,
              "channel:",
              `overlay:${channelKey}`
            );
            sendWithRetry(event, attempt + 1);
          } else {
            console.warn(
              "[overlayBus] send failed after retries:",
              resp,
              "event:",
              event.type,
              "channel:",
              `overlay:${channelKey}`
            );
          }
        }
      })
      .catch((err) => {
        console.warn("[overlayBus] send threw:", err, "event:", event.type);
      });
  }

  channel.subscribe((status) => {
    // FIX — removed two `console.log` debug lines ("[overlayBus]
    // received ..." on every single event, and "[overlayBus] status:"
    // on every status change) that were left in from development and
    // were spamming the console in production on every ball bowled.
    // Kept a single, intentional warning for genuine failure states —
    // silently swallowing CHANNEL_ERROR/TIMED_OUT/CLOSED made connection
    // drops invisible, which made "sync stopped working" reports much
    // harder to diagnose than a one-line console.warn.
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      console.warn("[overlayBus] connection issue:", status, "channel:", `overlay:${channelKey}`);
    }

    ready = status === "SUBSCRIBED";
    if (ready) {
      if (queue.length) {
        queue.splice(0).forEach((event) => sendWithRetry(event));
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
      sendWithRetry(event);
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