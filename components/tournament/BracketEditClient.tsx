"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Save,
  Settings2,
  ImageOff,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/landing/site-header";
import { useScrollTop } from "@/hooks/use-scroll-top";
import { pageStyles } from "@/data/site-data";
import TournamentBracket from "@/components/tournament/TournamentBracket";
import type { Round, MatchNode } from "@/components/tournament/TournamentBracket";
import DoubleElimBoard from "@/components/tournament/DoubleElimBoard";
import type { DoubleElimData } from "@/lib/tournament/doubleElim";
import { useAuth } from "@/context/AuthContext";
import { getOrgIdForUser, updateTournament } from "@/lib/tournament/tournament";
import { updateBracketMatchResult } from "@/lib/tournament/bracketData";
import {
  generateBracketForTournament,
  deleteBracketForTournament,
  type SeedingMethod,
} from "@/lib/tournament/generateBracket";

type GateState = "checking" | "denied" | "allowed";
type BracketFormat = "single_elimination" | "double_elimination";

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
  initialLogoUrl,
  hasBracketRows,
}: {
  tournamentId: string;
  tournamentOrgId: string | null;
  tournamentName: string;
  format: BracketFormat;
  initialSingleRounds: Round[] | null;
  initialDoubleData: DoubleElimData | null;
  initialLogoUrl?: string;
  hasBracketRows: boolean;
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

  const [formatValue, setFormatValue] = useState<BracketFormat>(format);
  const [isSavingFormat, setIsSavingFormat] = useState(false);
  const [formatSaveError, setFormatSaveError] = useState<string | null>(null);
  const [formatSavedAt, setFormatSavedAt] = useState<number | null>(null);
  const formatDirty = formatValue !== format;

  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
  const [logoBroken, setLogoBroken] = useState(false);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [logoSaveError, setLogoSaveError] = useState<string | null>(null);
  const [logoSavedAt, setLogoSavedAt] = useState<number | null>(null);
  const logoDirty = logoUrl !== (initialLogoUrl ?? "");

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

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

  useEffect(() => {
    setFormatValue(format);
  }, [format]);

  useEffect(() => {
    setLogoUrl(initialLogoUrl ?? "");
  }, [initialLogoUrl]);

  useEffect(() => {
    setLogoBroken(false);
  }, [logoUrl]);

  const hasBracket = hasBracketRows;

  const saveFormat = async () => {
    setIsSavingFormat(true);
    setFormatSaveError(null);

    if (hasBracket) {
      const del = await deleteBracketForTournament(tournamentId);
      if (!del.ok) {
        setIsSavingFormat(false);
        setFormatSaveError(del.error ?? "Couldn't clear the existing bracket.");
        return;
      }
    }

    const ok = await updateTournament(tournamentId, { format: formatValue });
    setIsSavingFormat(false);
    if (!ok) {
      setFormatSaveError("Couldn't save the format — please try again.");
      return;
    }
    setFormatSavedAt(Date.now());
    router.refresh();
  };

  const handleSaveFormat = () => {
    if (!formatDirty) return;

    if (hasBracket) {
      setConfirmDialog({
        title: "Change tournament format?",
        message: `This tournament already has a bracket built as ${
          format === "single_elimination" ? "Single Elimination" : "Double Elimination"
        }. Switching to "${
          formatValue === "single_elimination" ? "Single Elimination" : "Double Elimination"
        }" will permanently delete all existing matches and results — including any that are already decided — so the bracket can be rebuilt from scratch in the new format. This can't be undone.`,
        confirmLabel: "Delete matches & change format",
        destructive: true,
        onConfirm: saveFormat,
      });
      return;
    }

    saveFormat();
  };

  const handleSaveLogo = async () => {
    if (!logoDirty) return;
    setIsSavingLogo(true);
    setLogoSaveError(null);
    const ok = await updateTournament(tournamentId, { logoUrl });
    setIsSavingLogo(false);
    if (!ok) {
      setLogoSaveError("Couldn't save the logo — please try again.");
      return;
    }
    setLogoSavedAt(Date.now());
    router.refresh();
  };

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

  const regenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);

    const del = await deleteBracketForTournament(tournamentId);
    if (!del.ok) {
      setIsGenerating(false);
      setGenerateError(del.error ?? "Couldn't clear the existing bracket.");
      return;
    }

    router.refresh();

    const result = await generateBracketForTournament(tournamentId, seedingMethod);
    setIsGenerating(false);
    if (!result.ok) {
      setGenerateError(result.error ?? "Couldn't regenerate the bracket.");
      return;
    }
    router.refresh();
  };

  const handleRegenerate = () => {
    setConfirmDialog({
      title: "Delete & regenerate bracket?",
      message:
        "This will permanently delete all existing matches and results for this tournament and build a fresh bracket. This can't be undone.",
      confirmLabel: "Delete & regenerate",
      destructive: true,
      onConfirm: regenerate,
    });
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

      <section className="pt-20 sm:pt-24 pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 relative z-10">
          {gate === "checking" && (
            <div className="flex items-center justify-center py-24">
              <p className="flex items-center gap-2 text-gray-400 text-sm">
                <span className="h-3 w-3 rounded-full border-2 border-gold/40 border-t-gold animate-spin" />
                Checking access…
              </p>
            </div>
          )}

          {gate === "denied" && (
            <div className="bg-black/50 border border-gold/20 rounded-xl p-8 text-center mx-auto max-w-md">
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
              {/* PAGE HEADER */}
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="min-w-0">
                  <Link
                    href={`/tournaments/${tournamentId}/edit`}
                    className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-gold font-cinzel transition-colors"
                  >
                    ← Back to tournament settings
                  </Link>
                  <h1 className="text-2xl font-bold text-white font-cinzel truncate mt-1">
                    {tournamentName}
                  </h1>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-cinzel px-3 py-1.5 rounded-full border shrink-0 ${
                    hasBracket
                      ? "border-gold/30 text-gold bg-gold/[0.06]"
                      : "border-white/15 text-gray-400 bg-white/[0.02]"
                  }`}
                >
                  <Trophy className="h-3 w-3" />
                  {hasBracket ? "Bracket generated" : "No bracket yet"}
                </span>
              </div>

              {/* CONFIG STRIP — the ONLY settings UI on this page. One slim
                  bar: Format / Logo / Reseed+Regenerate as inline segments,
                  separated by dividers. No separate big cards duplicating
                  this below — that was the bug causing the doubled-up look. */}
              <div className="bg-black/50 border border-gold/15 rounded-lg mb-8 overflow-hidden">
                <div className="flex flex-wrap divide-y divide-gold/10 sm:divide-y-0">
                  {/* FORMAT */}
                  <div className="flex items-center gap-2.5 px-4 py-3 flex-1 min-w-[280px] sm:border-r sm:border-gold/10">
                    <Settings2 className="h-3.5 w-3.5 text-gold shrink-0" />
                    <span className="text-gray-500 text-xs shrink-0 hidden md:inline">Format</span>
                    <select
                      value={formatValue}
                      onChange={(e) => setFormatValue(e.target.value as BracketFormat)}
                      className="bg-black/40 border border-gold/20 rounded-md text-white text-xs px-2 py-1.5 flex-1 min-w-0"
                    >
                      <option value="single_elimination">Single Elimination</option>
                      <option value="double_elimination">Double Elimination</option>
                    </select>
                    <Button
                      onClick={handleSaveFormat}
                      disabled={!formatDirty || isSavingFormat}
                      size="sm"
                      className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-40 h-7 px-2.5 text-xs shrink-0"
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                    {formatSavedAt && !formatDirty && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    )}
                    {formatSaveError && (
                      <AlertCircle
                        className="h-3.5 w-3.5 text-red-500 shrink-0"
                        aria-label={formatSaveError}
                      >
                        <title>{formatSaveError}</title>
                      </AlertCircle>
                    )}
                  </div>

                  {/* LOGO */}
                  <div className="flex items-center gap-2.5 px-4 py-3 flex-1 min-w-[280px] sm:border-r sm:border-gold/10">
                    <div className="w-6 h-6 shrink-0 rounded-full border border-gold/20 bg-black/60 flex items-center justify-center overflow-hidden">
                      {logoUrl && !logoBroken ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={() => setLogoBroken(true)}
                        />
                      ) : (
                        <ImageOff className="h-3 w-3 text-gray-600" />
                      )}
                    </div>
                    <Input
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="Logo URL…"
                      className="bg-black/40 border-gold/20 text-white text-xs h-7 flex-1 min-w-0 px-2"
                    />
                    <Button
                      onClick={handleSaveLogo}
                      disabled={!logoDirty || isSavingLogo}
                      size="sm"
                      className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-40 h-7 px-2.5 text-xs shrink-0"
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                    {logoSavedAt && !logoDirty && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    )}
                    {logoSaveError && (
                      <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" aria-label={logoSaveError}>
                        <title>{logoSaveError}</title>
                      </AlertCircle>
                    )}
                  </div>

                  {/* REGENERATE — only once a bracket exists */}
                  {hasBracket && (
                    <div className="flex items-center gap-2.5 px-4 py-3 flex-1 min-w-[300px]">
                      <span className="text-gray-500 text-xs shrink-0 hidden md:inline">Reseed</span>
                      <select
                        value={seedingMethod}
                        onChange={(e) => setSeedingMethod(e.target.value as SeedingMethod)}
                        className="bg-black/40 border border-gold/20 rounded-md text-white text-xs px-2 py-1.5 shrink-0"
                      >
                        <option value="random">Random draw</option>
                        <option value="creation_order">Creation order</option>
                      </select>
                      <Button
                        onClick={handleRegenerate}
                        disabled={isGenerating}
                        size="sm"
                        className="bg-red-600/80 hover:bg-red-600 text-white font-bold disabled:opacity-50 h-7 px-2.5 text-xs flex-1 min-w-0"
                      >
                        <RotateCcw className="mr-1.5 h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {isGenerating ? "Regenerating…" : "Delete & Regenerate"}
                        </span>
                      </Button>
                      {generateError && (
                        <AlertCircle
                          className="h-3.5 w-3.5 text-red-500 shrink-0"
                          aria-label={generateError}
                        >
                          <title>{generateError}</title>
                        </AlertCircle>
                      )}
                    </div>
                  )}
                </div>

                {/* Overflow messages — only rendered when there's actually
                    something to say, so the bar stays thin the rest of the
                    time. */}
                {(formatDirty || formatSaveError || logoSaveError || generateError) && (
                  <div className="border-t border-gold/10 px-4 py-2 space-y-1 bg-white/[0.015]">
                    {formatDirty && (
                      <p className="text-gray-500 text-[11px] leading-relaxed">
                        {hasBracket
                          ? "Saving format will delete the existing bracket's matches and results."
                          : "Saving updates the format for when the bracket is generated."}
                      </p>
                    )}
                    {formatSaveError && <p className="text-red-500 text-[11px]">{formatSaveError}</p>}
                    {logoSaveError && <p className="text-red-500 text-[11px]">{logoSaveError}</p>}
                    {generateError && <p className="text-red-500 text-[11px]">{generateError}</p>}
                  </div>
                )}
              </div>

              {/* BOARD / EMPTY STATE */}
              {!hasBracket ? (
                <div className="relative bg-black/50 border border-gold/20 rounded-xl p-10 text-center mx-auto max-w-lg overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
                  <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-5 w-5 text-gold" />
                  </div>
                  <h3 className="text-white font-bold font-cinzel mb-2">No bracket yet</h3>
                  <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
                    This needs a completed auction with at least 2 teams linked to this tournament.
                  </p>
                  <div className="mb-5 text-left flex items-center gap-2">
                    <label className="text-gray-400 text-xs uppercase tracking-widest font-cinzel shrink-0">
                      Seed using
                    </label>
                    <select
                      value={seedingMethod}
                      onChange={(e) => setSeedingMethod(e.target.value as SeedingMethod)}
                      className="flex-1 bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
                    >
                      <option value="random">Random draw</option>
                      <option value="creation_order">Team creation order</option>
                    </select>
                  </div>
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50 px-8"
                  >
                    <Trophy className="mr-2 h-4 w-4" />
                    {isGenerating ? "Generating…" : "Generate Bracket"}
                  </Button>
                  {generateError && (
                    <p className="flex items-center justify-center gap-1.5 text-red-500 text-sm mt-3">
                      <AlertCircle className="h-4 w-4" /> {generateError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-black/30 border border-gold/10 rounded-xl py-4 sm:py-6">
                  {format === "single_elimination" && initialSingleRounds && (
                    <TournamentBracket
                      rounds={initialSingleRounds}
                      title="Bracket"
                      editable
                      onRecordResult={recordResult}
                      logoSrc={initialLogoUrl}
                    />
                  )}

                  {format === "double_elimination" && initialDoubleData && (
                    <DoubleElimBoard
                      data={initialDoubleData}
                      editable
                      onRecordResult={recordResult}
                      logoSrc={initialLogoUrl}
                    />
                  )}
                </div>
              )}

              {saveError && (
                <p className="flex items-center justify-center gap-1.5 text-red-500 text-sm mt-6">
                  <AlertCircle className="h-4 w-4" /> {saveError}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* CONFIRM MODAL */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={() => setConfirmDialog(null)}
        >
          <div
            className="bg-[#0a0a0a] border border-gold/30 rounded-lg p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className={`h-5 w-5 ${confirmDialog.destructive ? "text-red-500" : "text-gold"}`} />
              <h3 className="text-lg font-bold text-white font-cinzel">{confirmDialog.title}</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => setConfirmDialog(null)}
                className="bg-transparent hover:bg-white/5 text-gray-300 border border-white/20"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className={
                  confirmDialog.destructive
                    ? "bg-red-600/80 hover:bg-red-600 text-white font-bold"
                    : "bg-gold hover:bg-gold/90 text-black font-bold"
                }
              >
                {confirmDialog.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}