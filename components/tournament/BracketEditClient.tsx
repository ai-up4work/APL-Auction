"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, RotateCcw, Sparkles, CheckCircle2, AlertCircle, Save, Settings2, ImageOff } from "lucide-react";
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
}: {
  tournamentId: string;
  tournamentOrgId: string | null;
  tournamentName: string;
  format: BracketFormat;
  initialSingleRounds: Round[] | null;
  initialDoubleData: DoubleElimData | null;
  /** Current value of tournaments.logo_url, passed down from the server
   *  page so this panel can seed its own logo editor without a separate
   *  fetch. Same column the Tournament edit page's Details → "Tournament
   *  logo URL" field writes to — this is just a second place to set it,
   *  right above the board it's used on. */
  initialLogoUrl?: string;
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

  // ── Format — same field the Details section on the Tournament edit page
  // writes to. Changing it here only updates the `tournaments.format`
  // column; it does NOT reshape the matches that already exist. That's
  // why a change nudges the admin toward Regenerate rather than silently
  // rendering the old data against the new bracket type.
  const [formatValue, setFormatValue] = useState<BracketFormat>(format);
  const [isSavingFormat, setIsSavingFormat] = useState(false);
  const [formatSaveError, setFormatSaveError] = useState<string | null>(null);
  const [formatSavedAt, setFormatSavedAt] = useState<number | null>(null);
  const formatDirty = formatValue !== format;

  // ── Logo — tournaments.logo_url, the watermark shown behind the Final
  // on this same board. Kept as its own tiny save flow (like Format) so
  // it doesn't get tangled up with the destructive format-change path.
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

  // Keep local format state in sync if the server prop changes underneath
  // us (e.g. after router.refresh() following a save).
  useEffect(() => {
    setFormatValue(format);
  }, [format]);

  useEffect(() => {
    setLogoUrl(initialLogoUrl ?? "");
  }, [initialLogoUrl]);

  useEffect(() => {
    setLogoBroken(false);
  }, [logoUrl]);

  const hasBracket = format === "single_elimination" ? !!initialSingleRounds : !!initialDoubleData;

  const saveFormat = async () => {
    setIsSavingFormat(true);
    setFormatSaveError(null);

    // A format change makes the existing bracket structurally wrong (wrong
    // number of rounds, no losers bracket, etc). Rather than leave stale
    // matches sitting around mismatched with the new format, clear them as
    // part of the save — even mid-tournament. If the admin wants to keep a
    // record of what happened, that's on them to capture before confirming.
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

    // Changing format while a bracket already exists means clearing it out
    // (see saveFormat above) — confirm before doing something destructive,
    // especially mid-tournament.
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
              {/* FORMAT + LOGO + TOOLBAR — cards side by side on larger
                  screens so this header doesn't eat vertical space; they
                  stack on narrow/mobile widths where there isn't room for
                  all of them. */}
              <div
                className={`grid grid-cols-1 ${hasBracket ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-6 mb-6`}
              >
                {/* FORMAT — same field as Details → Format on the Tournament
                    edit page, surfaced here since it's the thing that most
                    directly affects this screen. Saving only updates the
                    tournaments.format column; it does not reshape existing
                    matches, so a change here is flagged until the admin
                    regenerates. */}
                <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-md bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
                      <Settings2 className="h-3.5 w-3.5 text-gold" />
                    </div>
                    <h2 className="text-lg font-bold text-white font-cinzel truncate">{tournamentName}</h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-gray-400 text-sm shrink-0">Format</span>
                    <select
                      value={formatValue}
                      onChange={(e) => setFormatValue(e.target.value as BracketFormat)}
                      className="flex-1 min-w-[10rem] bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
                    >
                      <option value="single_elimination">Single Elimination</option>
                      <option value="double_elimination">Double Elimination</option>
                    </select>
                    <Button
                      onClick={handleSaveFormat}
                      disabled={!formatDirty || isSavingFormat}
                      className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {isSavingFormat ? "Saving…" : "Save format"}
                    </Button>
                  </div>

                  {formatDirty && (
                    <p className="text-gray-500 text-xs mt-2">
                      {hasBracket
                        ? "Saving will delete the existing bracket's matches and results so it can be rebuilt in the new format."
                        : "Saving updates the tournament's format for when the bracket is generated."}
                    </p>
                  )}
                  {formatSavedAt && !formatDirty && (
                    <span className="flex items-center gap-1.5 text-green-500 text-sm mt-3">
                      <CheckCircle2 className="h-4 w-4" /> Saved
                    </span>
                  )}
                  {formatSaveError && (
                    <span className="flex items-center gap-1.5 text-red-500 text-sm mt-3">
                      <AlertCircle className="h-4 w-4" /> {formatSaveError}
                    </span>
                  )}
                </div>

                {/* LOGO — tournaments.logo_url, the watermark shown behind
                    the Final on the board below. Same column as the
                    Tournament edit page's "Tournament logo URL" field —
                    this is just a second, closer-to-the-result place to
                    set it. */}
                <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-md bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
                      <ImageOff className="h-3.5 w-3.5 text-gold" />
                    </div>
                    <h2 className="text-lg font-bold text-white font-cinzel">Bracket logo</h2>
                  </div>

                  <div className="flex items-center gap-3">
                    <Input
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://…"
                      className="bg-black/50 border-gold/30 text-white flex-1 min-w-0"
                    />
                    <div className="w-10 h-10 shrink-0 rounded-full border border-gold/20 bg-black/60 flex items-center justify-center overflow-hidden">
                      {logoUrl && !logoBroken ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={() => setLogoBroken(true)}
                        />
                      ) : (
                        <ImageOff className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-3">
                    <Button
                      onClick={handleSaveLogo}
                      disabled={!logoDirty || isSavingLogo}
                      className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {isSavingLogo ? "Saving…" : "Save logo"}
                    </Button>
                    {logoSavedAt && !logoDirty && (
                      <span className="flex items-center gap-1.5 text-green-500 text-sm">
                        <CheckCircle2 className="h-4 w-4" /> Saved
                      </span>
                    )}
                  </div>
                  {logoSaveError && (
                    <span className="flex items-center gap-1.5 text-red-500 text-sm mt-2">
                      <AlertCircle className="h-4 w-4" /> {logoSaveError}
                    </span>
                  )}
                  <p className="text-gray-500 text-xs mt-2">
                    Falls back to your org's logo if left blank.
                  </p>
                </div>

                {/* TOOLBAR — matches the Bracket section on the Tournament edit
                    page (same card, same copy, same button styling), sitting
                    directly above the board it controls. Only shown once a
                    bracket exists; the empty state below has its own inline
                    seeding control before the first generate. */}
                {hasBracket && (
                  <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
                    <div className="flex flex-col gap-3">
                      <span className="text-gray-400 text-sm">Reseed using</span>
                      <select
                        value={seedingMethod}
                        onChange={(e) => setSeedingMethod(e.target.value as SeedingMethod)}
                        className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
                      >
                        <option value="random">Random draw</option>
                        <option value="creation_order">Team creation order</option>
                      </select>
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
                      This deletes all existing matches and results for this tournament and
                      builds a fresh bracket.
                    </p>
                    {generateError && (
                      <span className="flex items-center gap-1.5 text-red-500 text-sm mt-3">
                        <AlertCircle className="h-4 w-4" /> {generateError}
                      </span>
                    )}
                  </div>
                )}
              </div>

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

      {/* CONFIRM MODAL — replaces window.confirm() so destructive/consequential
          actions (regenerate, format change over an existing bracket) match
          the rest of the UI instead of popping the browser's native dialog. */}
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