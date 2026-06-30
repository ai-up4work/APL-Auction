// app/admin/page.tsx
"use client";

import { useState } from "react";
import AdminHeader   from "@/components/Admin/AdminHeader";
import AuctionPicker from "@/components/Admin/AuctionPicker";
import TeamsTab      from "@/components/Admin/TeamsTab";
import PlayersTab    from "@/components/Admin/PlayersTab";
import RulesTab      from "@/components/Admin/RulesTab";
import SessionTab    from "@/components/Admin/SessionTab";
import LaunchTab     from "@/components/Admin/LaunchTab";
import { useAuction } from "@/context/AuctionContext";

const CONFIG_STEPS = ["teams", "players", "rules", "session"] as const;

export default function AdminPage() {
  const [activeStep, setActiveStep] = useState("teams");

  // The admin page always opens on the picker. There is no auto-skip based
  // on a restored auctionId — the user explicitly chooses (or creates) an
  // auction every time they land on /admin. This is intentional: it's what
  // prevents the "always shows the last/default auction" behavior. Once
  // they pick something, `entered` flips true for the rest of this visit.
  const [entered, setEntered] = useState(false);

  const {
    auction,
    isSaving,
    saveError,
    shuffleReady,
    isHydrated,
    links,
    createNew,
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

  const { auctionId, status: auctionStatus, teams, players, rules, session } = auction;
  const auctionLocked = auctionStatus === "live" || auctionStatus === "paused";

  function handleCreateNew(name?: string) {
    createNew(name);
    setEntered(true);
  }

  // Fired by AuctionPicker after switchAuction() resolves successfully —
  // i.e. an existing auction was loaded into context and it's safe to
  // leave the picker and render the dashboard for it.
  function handleSelectAuction(_id: string) {
    setEntered(true);
  }

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

  // ── Waiting on rehydration (so localStorage / DB state is settled
  // before we decide what to render) ──────────────────────────────────────
  if (!isHydrated) {
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

  // ── No auction chosen yet this visit — always show the picker first ─────
  if (!entered) {
    return (
      <AuctionPicker
        onCreateNew={handleCreateNew}
        onSelectAuction={handleSelectAuction}
      />
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
      {/* Background gradients */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at 50% -20%, rgba(200,205,216,0.15) 0%, transparent 70%),
            radial-gradient(circle at 0% 100%, rgba(201,151,31,0.05) 0%, transparent 50%),
            radial-gradient(circle at 100% 100%, rgba(200,205,216,0.05) 0%, transparent 50%)
          `,
          zIndex: 0,
        }}
      />

      {/* Back to picker */}
      <button
        onClick={() => setEntered(false)}
        className="fixed top-3 left-3 z-[200] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{
          background: "var(--color-surface-container)",
          border: "1px solid var(--color-border-overlay)",
          color: "var(--color-on-surface-variant)",
          fontFamily: "var(--font-label-mono)",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
        All Auctions
      </button>

      {/* Saving indicator */}
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

      {/* Save error banner */}
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