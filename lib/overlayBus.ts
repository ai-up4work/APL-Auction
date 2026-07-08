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

// ── Match Setup (session-scoped, set once) ─────────────────────────────
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
  kickoffTime: string; // NEW — e.g. "19:30" or "7:30 PM IST", free text
  teamA: TeamInfo;
  teamB: TeamInfo;
  matchMeta: string; // e.g. "Semi-Final", "Qualifier 2", free text
  tournament: string; // e.g. "Season 7", free text
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

// The outcome of a completed match. Lives on LiveState so it rides along
// automatically through persistence, sync snapshots, and pushes, same as
// everything else in LiveState.
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
export type DismissalType = "bowled" | "caught" | "lbw" | "runOut" | "stumped" | "hitWicket";

export interface MomentPayload {
  moment: "four" | "six" | "wicket" | "fifty" | "hundred" | "maiden" | "matchWon";
  player?: string; // also doubles as winning team name for "matchWon"
  score?: string; // also doubles as margin text for "matchWon"
  batsmanOut?: "striker" | "nonStriker";
  dismissalType?: DismissalType;
  bowler?: string;
  fielder?: string;
  maidens?: number; // bowler's maiden count at the moment this fired
  // for "matchWon", lets the overlay theme itself to the winning team
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
  // NEW — last known weather payload. Previously only `channels.weather`
  // (a visibility boolean) was included in the snapshot, so a reconnecting
  // overlay page correctly restored show/hide but always fell back to
  // DEFAULT_WEATHER for the actual venue/temp/condition, since that data
  // never rode along with anything persisted or resynced.
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