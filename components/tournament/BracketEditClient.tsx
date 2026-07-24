"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, RotateCcw, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/landing/site-header";
import { useScrollTop } from "@/hooks/use-scroll-top";
import { pageStyles } from "@/data/site-data";
import TournamentBracket from "@/components/tournament/TournamentBracket";
import type { Round, MatchNode } from "@/components/tournament/TournamentBracket";
import DoubleElimBoard from "@/components/tournament/DoubleElimBoard";
import type { DoubleElimData } from "@/lib/tournament/doubleElim";
import { useAuth } from "@/context/AuthContext";
import { getOrgIdForUser } from "@/lib/tournament/tournament";
import { updateBracketMatchResult } from "@/lib/tournament/bracketData";
import {
  generateBracketForTournament,
  deleteBracketForTournament,
  type SeedingMethod,
} from "@/lib/tournament/generateBracket";

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
  useScrollTop();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [gate, setGate] = useState<GateState>("checking");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [seedingMethod, setSeedingMethod] = useState<SeedingMethod>("random");

  const handleNavigation = (path: string) => {
    router.push(path);
    window.scrollTo(0, 0);
  };
  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`);
    setIsNavOpen(false);
  };

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
    const result = await generateBracketForTournament(tournamentId, seedingMethod);
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

    const del = await deleteBracketForTournament(tournamentId);
    if (!del.ok) {
      setIsGenerating(false);
      setGenerateError(del.error ?? "Couldn't clear the existing bracket.");
      return;
    }

    // Bracket rows are gone in the DB the moment the delete succeeds —
    // refresh now so the page reflects that immediately (an empty state
    // while generating) instead of showing now-deleted matches until the
    // whole regenerate cycle finishes.
    router.refresh();

    const result = await generateBracketForTournament(tournamentId, seedingMethod);
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
  ): Promise<void> => {
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

    setSaveError(null);
    router.refresh();
  };

  return (
    <main className="overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      <SiteHeader
        activeSection="tournament"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      <section className="pt-20 sm:pt-24 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        {/* Wide, explicitly centered container — bracket columns
            (Quarterfinal / Semifinal / Final) need real horizontal room.
            Tailwind's bare `container` class caps width per breakpoint
            but does NOT center itself unless `theme.container.center`
            is set in tailwind.config — without that it just sits flush
            left with dead space on the right, which is what was
            happening here. mx-auto + an explicit max-width fixes it. */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 relative z-10">
          {gate === "checking" && (
            <p className="text-center text-gray-400">Checking access…</p>
          )}

          {gate === "denied" && (
            <div className="bg-black/50 border border-gold/20 rounded-lg p-8 text-center mx-auto">
              <Lock className="h-6 w-6 text-gold mx-auto mb-3" />
              <h1 className="text-xl font-bold text-white font-cinzel mb-2">
                You can't edit this bracket
              </h1>
              <p className="text-gray-400 text-sm mb-6">
                This tournament belongs to a different organization than the one on your account.
              </p>
              <Link href={`/tournaments/${tournamentId}`}>
                <Button className="bg-gold hover:bg-gold/90 text-black font-bold">
                  Back to tournament
                </Button>
              </Link>
            </div>
          )}

          {gate === "allowed" && (
            <>
              {/* TOOLBAR — matches the Bracket section on the Tournament edit
                  page (same card, same copy, same button styling), sitting
                  directly above the board it controls. Only shown once a
                  bracket exists; the empty state below has its own inline
                  seeding control before the first generate. */}
              {hasBracket && (
                <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div className="mb-4 sm:mb-0">
                      <label className="text-gray-400 text-sm block mb-1">Reseed using</label>
                      <select
                        value={seedingMethod}
                        onChange={(e) => setSeedingMethod(e.target.value as SeedingMethod)}
                        className="w-full sm:w-64 bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
                      >
                        <option value="random">Random draw</option>
                        <option value="creation_order">Team creation order</option>
                      </select>
                    </div>
                    <Button
                      onClick={handleRegenerate}
                      disabled={isGenerating}
                      className="bg-red-600/80 hover:bg-red-600 text-white font-bold disabled:opacity-50"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {isGenerating ? "Regenerating…" : "Delete & Regenerate Bracket"}
                    </Button>
                  </div>
                  <p className="text-gray-500 text-xs mt-2">
                    This deletes all existing matches and results for this tournament and builds
                    a fresh bracket.
                  </p>
                  {generateError && (
                    <span className="flex items-center gap-1.5 text-red-500 text-sm mt-3">
                      <AlertCircle className="h-4 w-4" /> {generateError}
                    </span>
                  )}
                </div>
              )}

              {!hasBracket ? (
                <div className="bg-black/50 border border-gold/20 rounded-lg p-8 text-center mx-auto">
                  <Sparkles className="h-6 w-6 text-gold mx-auto mb-3" />
                  <p className="text-gray-300 text-sm mb-6">
                    No bracket yet — this needs a completed auction with at least 2 teams linked
                    to this tournament.
                  </p>
                  <div className="mb-4 text-left mx-auto">
                    <label className="text-gray-400 text-sm block mb-1">Seed teams using</label>
                    <select
                      value={seedingMethod}
                      onChange={(e) => setSeedingMethod(e.target.value as SeedingMethod)}
                      className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
                    >
                      <option value="random">Random draw</option>
                      <option value="creation_order">Team creation order</option>
                    </select>
                  </div>
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
                  >
                    {isGenerating ? "Generating…" : "Generate Bracket"}
                  </Button>
                  {generateError && (
                    <span className="flex items-center justify-center gap-1.5 text-red-500 text-sm mt-3">
                      <AlertCircle className="h-4 w-4" /> {generateError}
                    </span>
                  )}
                </div>
              ) : (
                <>
                  {format === "single_elimination" && initialSingleRounds && (
                    <TournamentBracket
                      rounds={initialSingleRounds}
                      title="Bracket"
                      editable
                      onRecordResult={recordResult}
                    />
                  )}

                  {format === "double_elimination" && initialDoubleData && (
                    <DoubleElimBoard data={initialDoubleData} editable onRecordResult={recordResult} />
                  )}
                </>
              )}

              {saveError && (
                <span className="flex items-center justify-center gap-1.5 text-red-500 text-sm mt-6">
                  <AlertCircle className="h-4 w-4" /> {saveError}
                </span>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}