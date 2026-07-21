// lib/overlayData.ts
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface PointsRow {
  team_name: string;
  team_short: string | null;
  logo_url: string | null;
  played: number;
  won: number;
  lost: number;
  tied: number;
  no_result: number;
  points: number;
  net_run_rate: number;
  position: number | null;
}

export interface LiveScoreRow {
  team_batting: string | null;
  team_bowling: string | null;
  score: number;
  wickets: number;
  overs: number;
  target: number | null;
  current_run_rate: number | null;
  required_run_rate: number | null;
  striker_name: string | null;
  striker_runs: number;
  striker_balls: number;
  non_striker_name: string | null;
  non_striker_runs: number;
  non_striker_balls: number;
  bowler_name: string | null;
  bowler_overs: number;
  bowler_runs: number;
  bowler_wickets: number;
}

/** Live points table for an auction — refetches on any row change. */
export function usePointsTable(auctionId: string) {
  const [rows, setRows] = useState<PointsRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("tournament_points")
        .select("*")
        .eq("auction_id", auctionId)
        .order("position", { ascending: true, nullsFirst: false });
      if (!cancelled && data) setRows(data as PointsRow[]);
    }

    load();

    const channel = supabase
      .channel(`points:${auctionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_points", filter: `auction_id=eq.${auctionId}` },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [auctionId]);

  return rows;
}

/** Live current-match score for an auction. */
export function useLiveScore(auctionId: string) {
  const [row, setRow] = useState<LiveScoreRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("live_score")
        .select("*")
        .eq("auction_id", auctionId)
        .maybeSingle();
      if (!cancelled) setRow(data as LiveScoreRow | null);
    }

    load();

    const channel = supabase
      .channel(`live_score:${auctionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_score", filter: `auction_id=eq.${auctionId}` },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [auctionId]);

  return row;
}