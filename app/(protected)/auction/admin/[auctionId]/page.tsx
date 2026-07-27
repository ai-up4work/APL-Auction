"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminHeader from "@/components/Admin/AdminHeader";
import TeamsTab    from "@/components/Admin/TeamsTab";
import PlayersTab  from "@/components/Admin/PlayersTab";
import RulesTab    from "@/components/Admin/RulesTab";
import SessionTab  from "@/components/Admin/SessionTab";
import LaunchTab   from "@/components/Admin/LaunchTab";
import TournamentPromptModal from "@/components/Admin/TournamentPromptModal";
import { useAuction } from "@/context/AuctionContext";

const CONFIG_STEPS = ["teams", "players", "rules", "session"] as const;

export default function AdminAuctionPage() {
  const { auctionId: routeAuctionId } = useParams<{ auctionId: string }>();
  const router = useRouter();
  const [activeStep, setActiveStep] = useState("teams");

  const {
    auction,
    isSaving,
    saveError,
    shuffleReady,
    isHydrated,
    links,
    tournaments,
    isLoadingTournaments,
    tournamentPromptOpen,
    loadTournaments,
    linkTournament,
    createAndLinkTournament,
    skipTournamentLink,
    switchAuction, // <-- assumed to exist on the context; adjust name if different
    addTeam,
    editTeam,
    deleteTeam,
    addPlayer,
    editPlayer,
    deletePlayer,
    updateRules,
    updateSession,
    handleLaunch,
    handlePause,
    handleResume,
    handleStop,
    handleReauction,
    handleShuffle,
  } = useAuction();

  // Load the auction named by the URL into context as soon as we're
  // hydrated. If it's already the active one, switchAuction can just
  // no-op — that's up to the context implementation.
  useEffect(() => {
    if (isHydrated && routeAuctionId) {
      switchAuction(routeAuctionId);
    }
  }, [isHydrated, routeAuctionId, switchAuction]);

  const { auctionId, status: auctionStatus, teams, players, rules, session } = auction;
  const auctionLocked = auctionStatus === "live" || auctionStatus === "paused";

  function handleStepChange(step: string) {
    if (auctionLocked && CONFIG_STEPS.includes(step as any)) return;
    setActiveStep(step);
  }

  async function onLaunch() {
    await handleLaunch();
  }

  async function onStop() {
    await handleStop();
    setActiveStep("launch");
  }

  async function onReauction() {
    await handleReauction();
    setActiveStep("teams");
  }

  // Waiting on rehydration, or on context catching up to the id in the URL.
  if (!isHydrated || auctionId !== routeAuctionId) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: "var(--color-background)", color: "var(--color-outline)" }}
      >
        <span className="material-symbols-outlined animate-spin" style={{ fontSize: 28 }}>
          progress_activity
        </span>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col overflow-x-hidden selection:bg-orange-500/30"
      style={{
        background: "var(--color-background)",
        color: "var(--color-on-background)",
        fontFamily: "var(--font-body-md)",
        position: "relative",
        maxWidth: "100%",
      }}
    >
      {tournamentPromptOpen && (
        <TournamentPromptModal
          teamCount={teams.length}
          tournaments={tournaments}
          isLoadingTournaments={isLoadingTournaments}
          onLoadTournaments={loadTournaments}
          onLink={linkTournament}
          onCreateAndLink={createAndLinkTournament}
          onSkip={skipTournamentLink}
        />
      )}

      {isSaving && (
        <div
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold"
          style={{
            background: "var(--color-surface-container)",
            border: "1px solid rgba(201,151,31,0.3)",
            color: "var(--color-theme-orange)",
            fontFamily: "var(--font-label-mono)",
            backdropFilter: "blur(12px)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--color-theme-orange)" }} />
          Saving…
        </div>
      )}

      {saveError && (
        <div
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold"
          style={{
            background: "var(--color-error-container)",
            border: "1px solid rgba(255,180,171,0.4)",
            color: "var(--color-error)",
            fontFamily: "var(--font-label-mono)",
            backdropFilter: "blur(12px)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>error</span>
          Save failed: {saveError}
        </div>
      )}

      <AdminHeader
        activeStep={activeStep}
        onStepChange={handleStepChange}
        auctionStatus={auctionStatus}
        onPause={handlePause}
        onResume={handleResume}
        onStop={onStop}
        onReauction={onReauction}
        onAllAuctions={() => router.push("/auction/admin")}
      />

      <main
        className="flex-1 w-full min-w-0 max-w-screen-2xl mx-auto pt-36 pb-20 px-10"
        style={{ position: "relative", zIndex: 1 }}
      >
        {activeStep === "teams" && (
          <TeamsTab
            locked={auctionLocked}
            teams={teams}
            auctionId={auctionId!}
            onAddTeam={addTeam}
            onEditTeam={editTeam}
            onDeleteTeam={deleteTeam}
          />
        )}
        {activeStep === "players" && (
          <PlayersTab
            locked={auctionLocked}
            players={players}
            teams={teams}
            auctionId={auctionId!}
            onAddPlayer={addPlayer}
            onEditPlayer={editPlayer}
            onDeletePlayer={deletePlayer}
          />
        )}
        {activeStep === "rules" && (
          <RulesTab
            locked={auctionLocked}
            rules={rules}
            onRulesChange={updateRules}
          />
        )}
        {activeStep === "session" && (
          <SessionTab
            locked={auctionLocked}
            session={session}
            onSessionChange={updateSession}
            auctionId={auctionId!}
          />
        )}
        {activeStep === "launch" && (
          <LaunchTab
            auctionStatus={auctionStatus}
            onLaunch={onLaunch}
            teamCount={teams.length}
            playerCount={players.length}
            auctionName={session.auctionName}
            allPinsSet={teams.every((t) => !!t.pin)}
            targetPlayerCount={rules.targetPlayerCount}
            links={links}
            shuffleReady={shuffleReady}
            onShuffle={handleShuffle}
          />
        )}
      </main>

      <style>{`
        html, body {
          overflow-x: hidden;
          max-width: 100%;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        html::-webkit-scrollbar,
        body::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}