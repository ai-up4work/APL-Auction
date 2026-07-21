"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface BallRow {
  id: number;
  match_id: string;
  innings_number: number;
  sequence: number;
  over_number: number;
  ball_number: number;
  striker_name: string | null;
  non_striker_name: string | null;
  bowler_name: string | null;
  runs: number;
  extra_type: string | null;
  is_wicket: boolean | null;
  dismissal_type: string | null;
  batsman_out: string | null;
  fielder: string | null;
  is_free_hit: boolean | null;
  created_at: string;
}

/**
 * Loads the full ball-by-ball ledger for a match and keeps it live via
 * Realtime while `active` is true. Deliberately dumb: any change event
 * (insert from scoring, delete from undo) triggers a full refetch rather
 * than patching state locally — ball counts per match are small (a few
 * hundred rows at most), so this stays cheap and avoids a whole class of
 * "local reducer drifted from DB" bugs.
 *
 * Intended to be gated on the scorecard modal's own `active`/`mounted`
 * flag — no reason to hold a channel open and refetch on every ball
 * while nobody's looking at the modal.
 */
export function useBallsLedger(matchId: string | null | undefined, active: boolean) {
  const [balls, setBalls] = useState<BallRow[]>([]);
  const [loading, setLoading] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!matchId || !active) return;

    cancelledRef.current = false;

    async function fetchAll() {
      setLoading(true);
      const { data, error } = await supabase
        .from("balls")
        .select("*")
        .eq("match_id", matchId)
        .order("innings_number", { ascending: true })
        .order("sequence", { ascending: true });

      if (cancelledRef.current) return;
      if (error) {
        console.error("[useBallsLedger] fetch failed:", error);
      } else {
        setBalls((data ?? []) as BallRow[]);
      }
      setLoading(false);
    }

    fetchAll();

    const channel = supabase
      .channel(`balls-ledger:${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "balls", filter: `match_id=eq.${matchId}` },
        () => {
          fetchAll();
        }
      )
      .subscribe();

    return () => {
      cancelledRef.current = true;
      supabase.removeChannel(channel);
    };
  }, [matchId, active]);

  return { balls, loading };
}