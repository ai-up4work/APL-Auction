"use client";
import DoubleElimBoard from "@/components/tournament/DoubleElimBoard";
import type { DoubleElimData } from "@/lib/tournament/doubleElim";

/**
 * Read-only wrapper for real tournament data — bracket_matches results
 * come from wherever match scoring happens (not this page), so
 * onRecordResult intentionally does nothing here yet. Wire this up to an
 * updateBracketMatchResult() call once there's a real scoring flow that
 * should write back to bracket_matches (score_a/score_b/winner_team_id).
 */
export default function DoubleElimBracketClient({
  data,
  title,
}: {
  data: DoubleElimData;
  title: string;
}) {
  return (
    <DoubleElimBoard
      data={data}
      title={title}
      onRecordResult={() => {
        console.warn("Recording results isn't wired up yet for real tournaments.");
      }}
    />
  );
}