"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import TournamentBracket from "@/components/tournament/TournamentBracket";
import type { Round, MatchNode } from "@/components/tournament/TournamentBracket";
import DoubleElimBoard from "@/components/tournament/DoubleElimBoard";
import type { DoubleElimData } from "@/lib/tournament/doubleElim";
import { useAuth } from "@/context/AuthContext";
import { getOrgIdForUser } from "@/lib/tournament/tournament";
import {
  updateBracketMatchResult,
  generateBracketForTournament,
} from "@/lib/tournament/bracketData";
import { supabase } from "@/lib/supabase";

type GateState = "checking" | "denied" | "allowed";

function findInRounds(rounds: Round[], matchId: string): MatchNode | null {
  for (const r of rounds) {
    const m = r.matches.find((mm) => mm.id === matchId);
    if (m) return m;
  }
  return null;
}

function findInDouble(data: DoubleElimData, matchId: string): MatchNode | null {
  for (const r of data.winners) {
    const m = r.matches.find((mm) => mm.id === matchId);
    if (m) return m;
  }
  for (const r of data.losers) {
    const m = r.matches.find((mm) => mm.id === matchId);
    if (m) return m;
  }
  if (data.grandFinal.id === matchId) return data.grandFinal;
  if (data.bracketReset && data.bracketReset.id === matchId) return data.bracketReset;
  return null;
}

export default function BracketEditClient({
  tournamentId,
  tournamentOrgId,
  tournamentName,
  format,
  initialSingleRounds,
  initialDoubleData,
}: {
  tournamentId: string;
  tournamentOrgId: string | null;
  tournamentName: string;
  format: "single_elimination" | "double_elimination";
  initialSingleRounds: Round[] | null;
  initialDoubleData: DoubleElimData | null;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [gate, setGate] = useState<GateState>("checking");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setGate("denied");
      return;
    }
    let cancelled = false;
    getOrgIdForUser(user.id).then((orgId) => {
      if (cancelled) return;
      setGate(!!orgId && orgId === tournamentOrgId ? "allowed" : "denied");
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, tournamentOrgId]);

  const hasBracket = format === "single_elimination" ? !!initialSingleRounds : !!initialDoubleData;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    const result = await generateBracketForTournament(tournamentId);
    setIsGenerating(false);
    if (!result.ok) {
      setGenerateError(result.error ?? "Couldn't generate the bracket.");
      return;
    }
    router.refresh();
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    const { error: delErr } = await supabase
      .from("bracket_matches")
      .delete()
      .eq("tournament_id", tournamentId);
    if (delErr) {
      setIsGenerating(false);
      setGenerateError(delErr.message);
      return;
    }
    const result = await generateBracketForTournament(tournamentId);
    setIsGenerating(false);
    if (!result.ok) {
      setGenerateError(result.error ?? "Couldn't regenerate the bracket.");
      return;
    }
    router.refresh();
  };

  const recordResult = async (
    matchId: string,
    winner: "A" | "B",
    scoreA: number,
    scoreB: number
  ) => {
    setSaveError(null);
    const match =
      format === "single_elimination"
        ? initialSingleRounds && findInRounds(initialSingleRounds, matchId)
        : initialDoubleData && findInDouble(initialDoubleData, matchId);

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
    router.refresh();
  };

  if (gate === "checking") {
    return <p className="text-center text-gray-400 py-16">Checking access…</p>;
  }

  if (gate === "denied") {
    return (
      <div className="max-w-md mx-auto mt-16 bg-black/50 border border-gold/20 rounded-lg p-8 text-center">
        <Lock className="h-6 w-6 text-gold mx-auto mb-3" />
        <h1 className="text-xl font-bold text-white font-cinzel mb-2">
          You can't edit this bracket
        </h1>
        <p className="text-gray-400 text-sm">
          This tournament belongs to a different organization than the one on your account.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-white font-cinzel mb-6">{tournamentName} — Bracket</h1>

      {!hasBracket ? (
        <div className="bg-black/50 border border-gold/20 rounded-lg p-6 text-center">
          <p className="text-gray-300 text-sm mb-4">
            No bracket exists yet for this tournament. Generating one requires a completed
            auction with at least 2 teams linked to it.
          </p>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
          >
            {isGenerating ? "Generating…" : "Generate Bracket"}
          </Button>
          {generateError && <p className="text-red-500 text-sm mt-3">{generateError}</p>}
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <Button
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="bg-red-600/80 hover:bg-red-600 text-white font-bold disabled:opacity-50"
            >
              {isGenerating ? "Regenerating…" : "Delete & Regenerate Bracket"}
            </Button>
          </div>

          {format === "single_elimination" && initialSingleRounds && (
            <TournamentBracket
              rounds={initialSingleRounds}
              title="Bracket"
              editable
              onRecordResult={recordResult}
            />
          )}

          {format === "double_elimination" && initialDoubleData && (
            <DoubleElimBoard data={initialDoubleData} onRecordResult={recordResult} />
          )}

          {generateError && <p className="text-red-500 text-sm mt-3">{generateError}</p>}
        </>
      )}

      {saveError && <p className="text-red-500 text-sm text-center mt-4">{saveError}</p>}
    </div>
  );
}