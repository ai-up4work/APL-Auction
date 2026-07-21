"use client";

import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { LiveState } from "@/lib/overlayBus";
import type { EngineSyncState } from "@/hooks/useLiveScoringEngine";

// ─────────────────────────────────────────────────────────────────────────
// Durable state: a single row per match holding both LiveState (score,
// crease, bowler, etc.) and the scoring engine's own ephemeral state
// (dismissed players, undo snapshot, active slot, extra type, pending
// wicket). This replaces localStorage as the thing a fresh admin panel
// hydrates from — a brand new device/tab has never written to
// localStorage, but it HAS access to this row the moment it loads.
// ─────────────────────────────────────────────────────────────────────────

export interface MatchStateBundle {
  liveState: LiveState;
  engineState: EngineSyncState;
}

const TABLE = "match_live_state";
const BROADCAST_EVENT = "match-state-sync";

export async function loadMatchStateFromDb(auctionId: string): Promise<MatchStateBundle | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("live_state, engine_state")
    .eq("auction_id", auctionId)
    .maybeSingle();

  if (error) {
    console.error("[matchStateSync] load failed", error);
    return null;
  }
  if (!data) return null;

  return {
    liveState: data.live_state as LiveState,
    engineState: data.engine_state as EngineSyncState,
  };
}

export async function saveMatchStateToDb(auctionId: string, bundle: MatchStateBundle): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(
    {
      auction_id: auctionId,
      live_state: bundle.liveState,
      engine_state: bundle.engineState,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "auction_id" }
  );

  if (error) {
    console.error("[matchStateSync] save failed", error);
  }
}

export async function deleteMatchStateFromDb(auctionId: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("auction_id", auctionId);
  if (error) {
    console.error("[matchStateSync] delete failed", error);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Real-time broadcast — same broadcast-channel pattern as
// connectOverlayBus, but on its own channel name (`match-sync:{id}`) so
// this traffic is never mixed up with, or accidentally handled by, the
// on-air overlay display page, which only understands `OverlayEvent`.
// `self: false` means a sender never receives its own broadcast, so no
// extra echo-guarding is needed at the transport layer.
// ─────────────────────────────────────────────────────────────────────────

export interface MatchStateChannel {
  readonly clientId: string;
  broadcast(bundle: MatchStateBundle): void;
  onRemoteUpdate(handler: (bundle: MatchStateBundle, senderId: string) => void): () => void;
  disconnect(): void;
}

function makeClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function connectMatchStateChannel(auctionId: string): MatchStateChannel {
  const clientId = makeClientId();
  const handlers = new Set<(bundle: MatchStateBundle, senderId: string) => void>();

  const channel: RealtimeChannel = supabase.channel(`match-sync:${auctionId}`, {
    config: { broadcast: { self: false } },
  });

  channel.on("broadcast", { event: BROADCAST_EVENT }, (msg) => {
    const payload = msg.payload as { bundle: MatchStateBundle; senderId: string };
    handlers.forEach((h) => h(payload.bundle, payload.senderId));
  });

  channel.subscribe();

  return {
    clientId,
    broadcast(bundle) {
      channel.send({
        type: "broadcast",
        event: BROADCAST_EVENT,
        payload: { bundle, senderId: clientId },
      });
    },
    onRemoteUpdate(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    disconnect() {
      handlers.clear();
      supabase.removeChannel(channel);
    },
  };
}