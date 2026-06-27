"use client";

import { useState } from "react";

type AuctionStatus = "setup" | "live" | "paused" | "completed";

// ── Props ─────────────────────────────────────────────────────────────────────
interface LaunchTabProps {
  auctionStatus: AuctionStatus;
  onLaunch: () => void;
  // These would come from real app state in production.
  // Passed as props so the checklist reflects actual data rather than being hardcoded.
  teamCount?: number;
  allPinsSet?: boolean;
  playerCount?: number;
  allPhotosUploaded?: boolean;
  auctionName?: string;
  shuffleReady?: boolean;
}

// ── Session summary reads from props too ──────────────────────────────────────
function buildSessionSummary(props: LaunchTabProps) {
  return [
    { icon: "badge",          label: "Auction Name", value: props.auctionName ?? "APL Season 1" },
    { icon: "calendar_today", label: "Date",         value: "12 Jul 2025"                        },
    { icon: "schedule",       label: "Start Time",   value: "10:00 AM"                           },
    { icon: "timer",          label: "Bid Timer",    value: "15s per bid"                        },
    { icon: "group",          label: "Teams",        value: `${props.teamCount ?? 8} franchises` },
    { icon: "person",         label: "Players",      value: `${props.playerCount ?? 0} in pool`  },
  ];
}

// ── Checklist derives status from real counts ─────────────────────────────────
function buildChecklist(props: LaunchTabProps, shuffled: boolean) {
  const {
    teamCount = 0,
    allPinsSet = false,
    playerCount = 0,
    allPhotosUploaded = false,
    auctionName = "",
  } = props;

  return [
    {
      id: "teams",
      label: "8 Teams Created",
      status: teamCount >= 8 ? "complete" : "action",
      meta:   teamCount >= 8 ? "ALL SEATED" : `${teamCount}/8 CREATED`,
    },
    {
      id: "pins",
      label: "All 8 Team PINs Set",
      status: allPinsSet ? "complete" : "action",
      meta:   allPinsSet ? "SECURED" : "REQUIRES ACTION",
    },
    {
      id: "players",
      label: "140 Players Added",
      status: playerCount >= 140 ? "complete" : "action",
      meta:   playerCount >= 140 ? "POOL READY" : `${playerCount}/140 ADDED`,
    },
    {
      id: "photos",
      label: "All Player Photos Uploaded",
      status: allPhotosUploaded ? "complete" : "action",
      meta:   allPhotosUploaded ? "OPTIMIZED" : "REQUIRES ACTION",
    },
    {
      id: "name",
      label: "Auction Name Set",
      status: auctionName.trim() ? "complete" : "action",
      meta:   auctionName.trim() ? auctionName.toUpperCase() : "REQUIRES ACTION",
    },
    {
      id: "shuffle",
      label: "Shuffle Order Generated",
      status: shuffled ? "complete" : "action",
      meta:   shuffled ? "SEQUENCE LOCKED" : "REQUIRES ACTION",
    },
  ] as const;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LaunchTab(props: LaunchTabProps) {
  const {
    auctionStatus,
    onLaunch,
    // Defaults simulate a nearly-ready state; in production wire up real values
    teamCount       = 8,
    allPinsSet      = true,
    playerCount     = 140,
    allPhotosUploaded = true,
    auctionName     = "APL Season 1",
  } = props;

  const [shuffled, setShuffling_] = useState(false);
  const [shuffling, setShuffling] = useState(false);

  const isLive      = auctionStatus === "live";
  const isPaused    = auctionStatus === "paused";
  const isCompleted = auctionStatus === "completed";

  const checklist = buildChecklist(
    { ...props, teamCount, allPinsSet, playerCount, allPhotosUploaded, auctionName },
    shuffled,
  );

  const passCount = checklist.filter((c) => c.status !== "action").length;
  const total     = checklist.length;
  const allReady  = checklist.every((c) => c.status !== "action");

  const sessionSummary = buildSessionSummary(
    { ...props, teamCount, playerCount, auctionName, auctionStatus, onLaunch },
  );

  function handleShuffle() {
    if (shuffled || shuffling) return;
    setShuffling(true);
    setTimeout(() => { setShuffling(false); setShuffling_(true); }, 2000);
  }

  function handleLaunch() {
    if (!allReady || isLive || isPaused || isCompleted) return;
    onLaunch();
  }

  // Determine launch button label based on current status
  const launchLabel = isLive
    ? "Auction Live"
    : isPaused
    ? "Auction Paused"
    : isCompleted
    ? "Auction Completed"
    : "Start Auction";

  const launchDisabled = !allReady || isLive || isPaused || isCompleted;

  return (
    <div className="flex flex-col items-center" style={{ minHeight: "70vh" }}>

      {/* ── Eyebrow ── */}
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 border"
        style={{ background: "rgba(228,93,53,0.08)", borderColor: "rgba(228,93,53,0.2)" }}>
        <span className="material-symbols-outlined text-sm" style={{ color: "#e45d35" }}>security</span>
        <span className="text-[10px] font-black uppercase tracking-[0.2em]"
          style={{ fontFamily: "'Geist', monospace", color: "#e45d35" }}>
          Mission Critical Protocol
        </span>
      </div>

      {/* ── Hero heading ── */}
      <h2 className="text-center font-bold mb-4"
        style={{ fontFamily: "'Archivo Narrow', sans-serif", fontSize: "clamp(40px,6vw,64px)", lineHeight: 1.05, letterSpacing: "-0.01em", color: "#e0e3e4" }}>
        Launch Preparation
      </h2>
      <p className="text-center max-w-lg mb-14 text-sm leading-6"
        style={{ fontFamily: "'Inter', sans-serif", color: "#9a9aa5" }}>
        Validate all core datasets before{" "}
        <span className="italic" style={{ color: "#e45d35" }}>initializing</span>{" "}
        the live auction environment.{" "}
        <span style={{ color: "rgba(228,93,53,0.8)" }}>Commencement locks all configurations.</span>
      </p>

      {/* ── Main grid ── */}
      <div className="w-full grid gap-6" style={{ maxWidth: "860px", gridTemplateColumns: "1fr 300px" }}>

        {/* ── Left: Checklist ── */}
        <div className="rounded-2xl overflow-hidden relative"
          style={{ background: "rgba(16,20,21,0.6)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(24px)" }}>
          <div className="absolute pointer-events-none select-none -right-5 -bottom-5 opacity-[0.03]">
            <span className="material-symbols-outlined" style={{ fontSize: "260px", color: "#e45d35" }}>fact_check</span>
          </div>

          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <p className="text-lg font-bold mb-0.5" style={{ fontFamily: "'Archivo Narrow', sans-serif", color: "#e45d35" }}>
                Pre-flight Checklist
              </p>
              <p className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ fontFamily: "'Geist', monospace", color: "#45464d" }}>
                Verification Status
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold leading-none mb-0.5"
                style={{ fontFamily: "'Archivo Narrow', sans-serif", fontSize: "36px", color: "#e0e3e4" }}>
                {passCount}/{total}
              </p>
              <p className="text-[9px] uppercase tracking-[0.12em]" style={{ fontFamily: "'Geist', monospace", color: "#45464d" }}>
                Checks Complete
              </p>
            </div>
          </div>

          <div className="flex flex-col relative z-10">
            {checklist.map((item, i) => {
              const isAction = item.status === "action";
              return (
                <div key={item.id}
                  className="flex items-center justify-between px-6 py-4"
                  style={{
                    background: isAction ? "rgba(228,93,53,0.04)" : "rgba(255,255,255,0.02)",
                    borderBottom: i < checklist.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    borderLeft: `2px solid ${isAction ? "rgba(248,113,113,0.4)" : "rgba(228,93,53,0.2)"}`,
                  }}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-lg"
                      style={{ color: isAction ? "#45464d" : "#e45d35", fontVariationSettings: isAction ? "'FILL' 0" : "'FILL' 1" }}>
                      {isAction ? "radio_button_unchecked" : "check_circle"}
                    </span>
                    <span className="text-sm"
                      style={{ fontFamily: "'Inter', sans-serif", fontWeight: isAction ? 700 : 500, color: isAction ? "#e45d35" : "#c6c6cd" }}>
                      {item.label}
                    </span>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.15em]"
                    style={{ fontFamily: "'Geist', monospace", color: isAction ? "#f87171" : "rgba(228,93,53,0.6)" }}>
                    {item.meta}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: Command center ── */}
        <div className="flex flex-col gap-4">

          {/* Randomisation card */}
          <div className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: "rgba(16,20,21,0.6)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(24px)" }}>
            <div className="absolute pointer-events-none -right-2 -top-2 transition-opacity duration-500"
              style={{ opacity: shuffled ? 0.18 : 0.08 }}>
              <span className="material-symbols-outlined rotate-12 mt-5 mr-4" style={{ fontSize: "90px", color: "#e45d35" }}>
                casino
              </span>
            </div>

            <p className="text-base font-bold mb-1.5 relative z-10"
              style={{ fontFamily: "'Archivo Narrow', sans-serif", color: "#e0e3e4" }}>
              Randomisation
            </p>
            <p className="text-[11px] leading-[18px] mb-4 relative z-10"
              style={{ fontFamily: "'Inter', sans-serif", color: "#9a9aa5" }}>
              Engage the cryptographic shuffle engine to determine the definitive player sequence for the session.
            </p>

            <button onClick={handleShuffle} disabled={shuffled || shuffling}
              className="relative z-10 w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-black uppercase tracking-[0.18em] transition-all duration-300"
              style={{
                fontFamily: "'Geist', monospace",
                background: shuffled ? "rgba(228,93,53,0.1)" : shuffling ? "rgba(255,255,255,0.04)" : "#e0e3e4",
                border: shuffled ? "1px solid rgba(228,93,53,0.35)" : "1px solid rgba(255,255,255,0.1)",
                color: shuffled ? "#e45d35" : shuffling ? "#9a9aa5" : "#101415",
                cursor: shuffled || shuffling ? "default" : "pointer",
              }}>
              {/* Use Tailwind's built-in animate-spin instead of inline @keyframes */}
              <span className={`material-symbols-outlined text-[15px] ${shuffling ? "animate-spin" : ""}`}>
                {shuffled ? "verified" : shuffling ? "refresh" : "shuffle"}
              </span>
              {shuffled ? "Sequence Locked" : shuffling ? "Calculating Entropy..." : "Generate Sequence"}
            </button>
          </div>

          {/* Final initialisation card */}
          <div className="rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden transition-all duration-500"
            style={{
              background: allReady ? "rgba(228,93,53,0.06)" : "rgba(39,43,44,0.5)",
              border: allReady ? "2px solid rgba(228,93,53,0.3)" : "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(24px)",
            }}>
            {allReady && (
              <div className="absolute top-0 left-0 w-full h-px pointer-events-none"
                style={{ background: "linear-gradient(90deg, transparent, rgba(228,93,53,0.6), transparent)" }} />
            )}

            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full"
                  style={{ background: "#e45d35", boxShadow: allReady ? "0 0 8px rgba(228,93,53,0.8)" : "none" }} />
                <p className="text-[10px] font-black uppercase tracking-[0.15em]"
                  style={{ fontFamily: "'Geist', monospace", color: "#e45d35" }}>
                  Final Initialization
                </p>
              </div>
              <p className="text-[11px] leading-[18px]"
                style={{ fontFamily: "'Inter', sans-serif", color: "#9a9aa5" }}>
                {isLive
                  ? "The auction is currently live. Use the header controls to pause or stop."
                  : isPaused
                  ? "The auction is paused. Resume from the header."
                  : isCompleted
                  ? "This auction has ended. Use Re-auction to start fresh."
                  : <>
                      Executing the launch command transitions the environment to{" "}
                      <span className="italic font-semibold" style={{ color: "#e45d35" }}>Live Mode</span>.
                      Database schemas will be locked.
                    </>
                }
              </p>
            </div>

            <button
              onClick={handleLaunch}
              disabled={launchDisabled}
              className="w-full py-6 rounded-xl font-bold italic uppercase transition-all duration-500"
              style={{
                fontFamily: "'Archivo Narrow', sans-serif",
                fontSize: allReady ? "22px" : "20px",
                letterSpacing: "0.04em",
                background: isLive || isPaused || isCompleted
                  ? "rgba(255,255,255,0.04)"
                  : allReady
                  ? "#e45d35"
                  : "repeating-linear-gradient(45deg, rgba(228,93,53,0.05), rgba(228,93,53,0.05) 10px, rgba(228,93,53,0.1) 10px, rgba(228,93,53,0.1) 20px)",
                border: allReady && !launchDisabled
                  ? "1px solid rgba(228,93,53,0.6)"
                  : "1px solid rgba(255,255,255,0.06)",
                color: allReady && !launchDisabled ? "#fff" : "rgba(228,93,53,0.35)",
                cursor: launchDisabled ? "not-allowed" : "pointer",
                boxShadow: allReady && !launchDisabled ? "0 0 40px rgba(228,93,53,0.3)" : "none",
              }}>
              {launchLabel}
              {!allReady && !isLive && !isPaused && !isCompleted && (
                <div className="text-[9px] font-black not-italic uppercase tracking-[0.3em] mt-1.5"
                  style={{ fontFamily: "'Geist', monospace", color: "rgba(228,93,53,0.35)" }}>
                  Lock Sequence Pending
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Session Summary ── */}
      <div className="w-full mt-6 rounded-2xl p-5 flex items-center gap-6"
        style={{ maxWidth: "860px", background: "rgba(16,20,21,0.6)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(24px)" }}>
        <div className="shrink-0">
          <p className="text-sm font-bold whitespace-nowrap"
            style={{ fontFamily: "'Archivo Narrow', sans-serif", color: "#e0e3e4" }}>
            Session Summary
          </p>
          <span className="text-[9px] font-black uppercase tracking-[0.15em] mt-1 inline-block px-2 py-0.5 rounded-full border"
            style={{ fontFamily: "'Geist', monospace", color: "#e45d35", background: "rgba(228,93,53,0.08)", borderColor: "rgba(228,93,53,0.25)" }}>
            Configured
          </span>
        </div>
        <div className="w-px self-stretch shrink-0" style={{ background: "rgba(255,255,255,0.07)" }} />
        <div className="flex items-center gap-0 flex-1 min-w-0">
          {sessionSummary.map((row, i) => (
            <div key={row.label} className="flex flex-col gap-1 flex-1 px-4"
              style={{ borderRight: i < sessionSummary.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: "12px", color: "#45464d" }}>{row.icon}</span>
                <span className="text-[8px] uppercase tracking-[0.1em]"
                  style={{ fontFamily: "'Geist', monospace", color: "#9a9aa5" }}>{row.label}</span>
              </div>
              <span className="text-[11px] font-black" style={{ fontFamily: "'Geist', monospace", color: "#e0e3e4" }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── ALP-01 Footer ── */}
      <div className="w-full mt-8 rounded-2xl p-6 flex items-start gap-5"
        style={{ maxWidth: "860px", background: "rgba(228,93,53,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderLeft: "6px solid #e45d35", backdropFilter: "blur(24px)" }}>
        <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(228,93,53,0.12)" }}>
          <span className="material-symbols-outlined text-[22px]" style={{ color: "#e45d35" }}>verified_user</span>
        </div>
        <div>
          <p className="text-base font-bold mb-1.5"
            style={{ fontFamily: "'Archivo Narrow', sans-serif", color: "#e0e3e4" }}>
            Administrative Lock Protocol (ALP-01)
          </p>
          <p className="text-xs leading-5" style={{ fontFamily: "'Inter', sans-serif", color: "#9a9aa5" }}>
            Upon initiation, the system enforces a strict immutable state on team rosters, base valuations,
            and tournament structures. Any data discrepancies post-launch will require a catastrophic session
            reset and hardware re-authentication. Verification is absolute.
          </p>
        </div>
      </div>
    </div>
  );
}