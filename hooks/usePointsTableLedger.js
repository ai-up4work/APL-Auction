// hooks/usePointsTableLedger.js
//
// Mirrors useBallsLedger's role for CricketScorecard: fetches the raw
// rows and keeps them live via Supabase realtime, so PointsTable just
// consumes `teams` and re-renders whenever standings change.
//
// ASSUMPTION: your Supabase client is exported as `supabase` from
// "@/lib/supabaseClient". Adjust the import below if your project uses a
// different path/export name.

"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildPointsTable } from "@/lib/pointsTableAggregator";

/**
 * @param {string} auctionId - the tournament/auction to load standings for
 * @param {boolean} mounted - gate fetching/subscribing until the panel has
 *   actually mounted (same pattern useBallsLedger uses with the panel's
 *   `mounted` state), so a closed overlay doesn't hold an open channel.
 */
export function usePointsTableLedger(auctionId, mounted) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!auctionId) return;
    setLoading(true);

    const [{ data: teamRows, error: teamErr }, { data: standingsRows, error: standingsErr }] =
      await Promise.all([
        supabase.from("teams").select("id, code, name, color, logo").eq("auction_id", auctionId),
        supabase.from("standings").select("*").eq("auction_id", auctionId),
      ]);

    if (teamErr) console.error("usePointsTableLedger: failed to load teams", teamErr);
    if (standingsErr) console.error("usePointsTableLedger: failed to load standings", standingsErr);

    const standingsByTeamId = new Map((standingsRows || []).map((row) => [row.team_id, row]));
    setTeams(buildPointsTable(teamRows || [], standingsByTeamId));
    setLoading(false);
  }, [auctionId]);

  useEffect(() => {
    if (!mounted || !auctionId) return;

    fetchAll();

    // Any change to this tournament's standings, or its team roster
    // (new team added, color/logo updated), triggers a full refetch.
    // Refetching rather than patching in place keeps the sort/rank
    // logic in one place (buildPointsTable) instead of duplicating it
    // inside a realtime event handler.
    const channel = supabase
      .channel(`standings-${auctionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "standings", filter: `auction_id=eq.${auctionId}` },
        fetchAll
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams", filter: `auction_id=eq.${auctionId}` },
        fetchAll
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mounted, auctionId, fetchAll]);

  return { teams, loading };
}