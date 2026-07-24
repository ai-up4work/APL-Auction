"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DoubleElimBoard from "@/components/tournament/DoubleElimBoard";
import type { DoubleElimData } from "@/lib/tournament/doubleElim";
import type { MatchNode } from "@/components/tournament/TournamentBracket";
import { useAuth } from "@/context/AuthContext";
import { getOrgIdForUser } from "@/lib/tournament/tournament";
import { updateBracketMatchResult } from "@/lib/tournament/bracketData";

/** Finds a match anywhere in the double-elim structure by id — winners
 *  rounds, losers rounds, the grand final, or the bracket reset — so we
 *  can look up teamA/teamB to resolve a winner slot ("A"/"B") into an
 *  actual team id before saving. */
function findMatch(data: DoubleElimData, matchId: string): MatchNode | null {
  for (const round of data.winners) {
    const m = round.matches.find((mm) => mm.id === matchId);
    if (m) return m;
  }
  for (const round of data.losers) {
    const m = round.matches.find((mm) => mm.id === matchId);
    if (m) return m;
  }
  if (data.grandFinal.id === matchId) return data.grandFinal;
  if (data.bracketReset && data.bracketReset.id === matchId) return data.bracketReset;
  return null;
}

export default function DoubleElimBracketClient({
  data,
  title,
  tournamentOrgId,
}: {
  data: DoubleElimData;
  title: string;
  tournamentOrgId: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getOrgIdForUser(user.id).then((orgId) => {
      if (!cancelled) setIsAdmin(!!orgId && orgId === tournamentOrgId);
    });
    return () => {
      cancelled = true;
    };
  }, [user, tournamentOrgId]);

  const handleRecordResult = async (
    matchId: string,
    winner: "A" | "B",
    scoreA: number,
    scoreB: number
  ) => {
    if (!isAdmin) return;
    setSaveError(null);

    const match = findMatch(data, matchId);
    const winnerTeamId = winner === "A" ? match?.teamA?.id : match?.teamB?.id;
    if (!winnerTeamId) {
      setSaveError("Couldn't determine the winning team for this match.");
      return;
    }

    const res = await updateBracketMatchResult(matchId, {
      scoreA,
      scoreB,
      winnerTeamId,
      status: "completed",
    });

    if (!res.ok) {
      setSaveError(res.error ?? "Couldn't save the result.");
      return;
    }

    // data is server-fetched props, not local state, so refresh to pull
    // the updated bracket_matches rows and re-render with the new result.
    router.refresh();
  };

  return (
    <>
      <DoubleElimBoard
        data={data}
        title={title}
        onRecordResult={
          isAdmin
            ? handleRecordResult
            : () => {
                console.warn("Only tournament admins can record results.");
              }
        }
      />
      {saveError && (
        <p className="text-red-500 text-sm text-center mt-2">{saveError}</p>
      )}
    </>
  );
}