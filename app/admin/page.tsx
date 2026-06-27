"use client";
import { useState } from "react";
import AdminHeader from "@/components/Admin/AdminHeader";
import TeamsTab from "@/components/Admin/TeamsTab";
import PlayersTab from "@/components/Admin/PlayersTab";
import RulesTab from "@/components/Admin/RulesTab";
import SessionTab from "@/components/Admin/SessionTab";
import LaunchTab from "@/components/Admin/LaunchTab";

// Single source of truth for which steps are config-only (locked during live/paused)
export const CONFIG_STEPS = ["teams", "players", "rules", "session"] as const;

export type AuctionStatus = "setup" | "live" | "paused" | "completed";

export default function AdminPage() {
  const [activeStep, setActiveStep] = useState("teams");
  const [auctionStatus, setAuctionStatus] = useState<AuctionStatus>("setup");

  const auctionLocked = auctionStatus === "live" || auctionStatus === "paused";

  function handleStepChange(step: string) {
    if (auctionLocked && CONFIG_STEPS.includes(step as any)) return;
    setActiveStep(step);
  }

  function handleLaunch() {
    setAuctionStatus("live");
    // Stay on launch tab so admin can see live controls
  }

  function handleStop() {
    setAuctionStatus("completed");
    setActiveStep("launch");
  }

  function handleReauction() {
    setAuctionStatus("setup");
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
      {/* Radial background glows */}
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

      <AdminHeader
        activeStep={activeStep}
        onStepChange={handleStepChange}
        auctionStatus={auctionStatus}
        onPause={() => setAuctionStatus("paused")}
        onResume={() => setAuctionStatus("live")}
        onStop={handleStop}
        onReauction={handleReauction}
      />

      {/*
        pt-36 covers the two-row header (utility bar ~48px + stepper ~80px = ~128px).
        If header height changes, update this single value.
      */}
      <main
        className="flex-1 w-full min-w-0 max-w-screen-2xl mx-auto pt-36 pb-20 px-10"
        style={{ position: "relative", zIndex: 1 }}
      >
        {activeStep === "teams"   && <TeamsTab   locked={auctionLocked} />}
        {activeStep === "players" && <PlayersTab locked={auctionLocked} />}
        {activeStep === "rules"   && <RulesTab   locked={auctionLocked} />}
        {activeStep === "session" && <SessionTab locked={auctionLocked} />}
        {activeStep === "launch"  && (
          <LaunchTab
            auctionStatus={auctionStatus}
            onLaunch={handleLaunch}
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
        body::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}