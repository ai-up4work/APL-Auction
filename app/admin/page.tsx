// app/admin/page.tsx
"use client";

import { useState } from "react";
import AdminHeader  from "@/components/Admin/AdminHeader";
import TeamsTab     from "@/components/Admin/TeamsTab";
import PlayersTab   from "@/components/Admin/PlayersTab";
import RulesTab     from "@/components/Admin/RulesTab";
import SessionTab   from "@/components/Admin/SessionTab";
import LaunchTab    from "@/components/Admin/LaunchTab";
import { useAuction } from "@/context/AuctionContext";

const CONFIG_STEPS = ["teams", "players", "rules", "session"] as const;

export default function AdminPage() {
  const [activeStep, setActiveStep] = useState("teams");

  const {
    auction,
    isSaving,
    saveError,
    shuffleReady,   // ← added
    links,
    addTeam,
    editTeam,
    deleteTeam,
    addPlayer,
    deletePlayer,
    updateRules,
    updateSession,
    handleLaunch,
    handlePause,
    handleResume,
    handleStop,
    handleReauction,
    handleShuffle,  // ← added
  } = useAuction();

  const { status: auctionStatus, teams, players, rules, session } = auction;
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

  function onReauction() {
    handleReauction();
    setActiveStep("teams");
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col overflow-x-hidden selection:bg-orange-500/30"
      style={{
        background: "#101415",
        color: "#e0e3e4",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
        maxWidth: "100%",
      }}
    >
      {/* Background gradients */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at 50% -20%, rgba(190,198,224,0.15) 0%, transparent 70%),
            radial-gradient(circle at 0% 100%, rgba(228,93,53,0.05) 0%, transparent 50%),
            radial-gradient(circle at 100% 100%, rgba(190,198,224,0.05) 0%, transparent 50%)
          `,
          zIndex: 0,
        }}
      />

      {/* Saving indicator */}
      {isSaving && (
        <div
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold"
          style={{
            background: "rgba(16,20,21,0.9)",
            border: "1px solid rgba(228,93,53,0.3)",
            color: "#e45d35",
            fontFamily: "'Geist', monospace",
            backdropFilter: "blur(12px)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          Saving…
        </div>
      )}

      {/* Save error banner */}
      {saveError && (
        <div
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold"
          style={{
            background: "rgba(248,113,113,0.12)",
            border: "1px solid rgba(248,113,113,0.4)",
            color: "#f87171",
            fontFamily: "'Geist', monospace",
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
            onAddTeam={addTeam}
            onEditTeam={editTeam}
            onDeleteTeam={deleteTeam}
          />
        )}
        {activeStep === "players" && (
          <PlayersTab
            locked={auctionLocked}
            players={players}
            onAddPlayer={addPlayer}
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