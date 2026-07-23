// components/Admin/LaunchTab.tsx
"use client";

import { useState, useEffect } from "react";
import type { AuctionLinks } from "@/lib/auctionDb";

type AuctionStatus = "setup" | "live" | "paused" | "completed";

interface LaunchTabProps {
  auctionStatus:      AuctionStatus;
  onLaunch:           () => void;
  onShuffle:          () => Promise<void>;
  teamCount?:         number;
  allPinsSet?:        boolean;
  playerCount?:       number;
  auctionName?:       string;
  shuffleReady?:      boolean;
  targetPlayerCount?: number;
  links?:             AuctionLinks | null;
}

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

function buildChecklist(props: LaunchTabProps, shuffled: boolean) {
  const {
    teamCount         = 0,
    allPinsSet        = false,
    playerCount       = 0,
    auctionName       = "",
    targetPlayerCount = 140,
  } = props;

  return [
    {
      id:     "teams",
      label:  "Teams Created",
      status: teamCount >= 8 ? "complete" : "action",
      meta:   teamCount >= 8 ? "ALL SEATED" : `${teamCount}/8 CREATED`,
    },
    {
      id:     "pins",
      label:  "All Team PINs Set",
      status: allPinsSet ? "complete" : "action",
      meta:   allPinsSet ? "SECURED" : "REQUIRES ACTION",
    },
    {
      id:     "players",
      label:  `${targetPlayerCount} Players Added`,
      status: playerCount >= targetPlayerCount ? "complete" : "action",
      meta:   playerCount >= targetPlayerCount
                ? "POOL READY"
                : `${playerCount}/${targetPlayerCount} ADDED`,
    },
    {
      id:     "photos",
      label:  "Player Photos Uploaded",
      status: playerCount >= targetPlayerCount ? "complete" : "warning",
      meta:   "OPTIONAL",
    },
    {
      id:     "name",
      label:  "Auction Name Set",
      status: auctionName.trim() ? "complete" : "action",
      meta:   auctionName.trim() ? auctionName.toUpperCase() : "REQUIRES ACTION",
    },
    {
      id:     "shuffle",
      label:  "Shuffle Order Generated",
      status: shuffled ? "complete" : "action",
      meta:   shuffled ? "SEQUENCE LOCKED" : "REQUIRES ACTION",
    },
  ] as const;
}

// ── Link row ──────────────────────────────────────────────────────────────────
function LinkRow({
  icon, label, note, url, copied, onCopy,
}: {
  icon: string; label: string; note: string; url: string; copied: boolean; onCopy: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl"
      style={{ background: "var(--color-surface-container-low)", border: "1px solid var(--color-border-overlay)" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--color-theme-orange)", flexShrink: 0 }}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold mb-0.5" style={{ color: "var(--color-on-surface)", fontFamily: "var(--font-body-md)" }}>
            {label}
          </p>
          <p className="text-[10px] truncate" style={{ color: "var(--color-surface-variant)", fontFamily: "var(--font-label-mono)" }}>
            {url}
          </p>
          <p className="text-[10px]" style={{ color: "var(--color-outline)" }}>{note}</p>
        </div>
      </div>
      <button
        onClick={onCopy}
        style={{
          flexShrink: 0,
          padding: "5px 12px",
          borderRadius: 6,
          border: "1px solid var(--color-border-overlay)",
          background: "transparent",
          color: copied ? "var(--color-success)" : "var(--color-on-surface-variant)",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "var(--font-label-mono)",
          transition: "color 0.2s",
        }}
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}

// ── Post-launch links panel ───────────────────────────────────────────────────
function PostLaunchLinks({ links }: { links: AuctionLinks }) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  function copyAllOwnerLinks() {
    const text = links.ownerLinks
      .map((o) => `${o.teamName} (${o.teamCode})\n${o.url}\nPIN: ${o.pin}`)
      .join("\n\n");
    copy(text, "all-owners");
  }

  return (
    <div
      className="w-full mt-6 rounded-2xl overflow-hidden"
      style={{
        maxWidth: "860px",
        background: "var(--color-surface-glass)",
        border: "1px solid rgba(201,151,31,0.25)",
        backdropFilter: "blur(24px)",
      }}
    >
      <div
        className="flex items-center gap-3 px-6 py-4"
        style={{ borderBottom: "1px solid var(--color-outline-variant)", background: "rgba(201,151,31,0.05)" }}
      >
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: "var(--color-success)", boxShadow: "0 0 8px rgba(52,211,153,0.8)", flexShrink: 0 }}
        />
        <p className="font-bold" style={{ fontFamily: "var(--font-headline-md)", fontSize: "18px", color: "var(--color-on-surface)" }}>
          Auction is Live — Share Access Links
        </p>
        <span
          className="ml-auto text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full"
          style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-success)", background: "var(--color-success-container)", border: "1px solid rgba(52,211,153,0.25)" }}
        >
          Live
        </span>
      </div>

      <div className="p-6 flex flex-col gap-6">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.15em] mb-3" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}>
            Global Access
          </p>
          <div className="flex flex-col gap-2">
            <LinkRow
              icon="admin_panel_settings" label="Admin Panel" note="Share only with admins"
              url={links.admin} copied={copied === "admin"} onCopy={() => copy(links.admin, "admin")}
            />
            <LinkRow
              icon="visibility" label="Spectator View" note="Public read-only view"
              url={links.spectator} copied={copied === "spectator"} onCopy={() => copy(links.spectator, "spectator")}
            />
            <LinkRow
              icon="gavel" label="Live Bid Screen" note="Real-time bidding screen"
              url={links.live} copied={copied === "live"} onCopy={() => copy(links.live, "live")}
            />
          </div>
        </div>

        <div style={{ height: 1, background: "var(--color-outline-variant)" }} />

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}>
              Team Owner Links
            </p>
            <button
              onClick={copyAllOwnerLinks}
              style={{
                padding: "4px 12px", borderRadius: 6,
                border: "1px solid rgba(201,151,31,0.25)",
                background: "rgba(201,151,31,0.06)",
                color: copied === "all-owners" ? "var(--color-success)" : "var(--color-theme-orange)",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
                fontFamily: "var(--font-label-mono)",
              }}
            >
              {copied === "all-owners" ? "✓ Copied All" : "Copy All"}
            </button>
          </div>

          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {links.ownerLinks.map(({ teamCode, teamName, url, pin }) => (
              <div
                key={teamCode}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                style={{ background: "var(--color-surface-container)", border: "1px solid var(--color-border-overlay)" }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)", background: "rgba(201,151,31,0.1)" }}>
                      {teamCode}
                    </span>
                    <span className="text-xs font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>{teamName}</span>
                  </div>
                  <p className="text-[10px] truncate mb-0.5" style={{ color: "var(--color-surface-variant)", fontFamily: "var(--font-label-mono)" }}>{url}</p>
                  <p className="text-[11px]" style={{ color: "var(--color-outline)" }}>
                    PIN: <span style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)", fontWeight: 700 }}>{pin}</span>
                  </p>
                </div>
                <button
                  onClick={() => copy(`${url}\nPIN: ${pin}`, `owner-${teamCode}`)}
                  style={{
                    flexShrink: 0, padding: "5px 10px", borderRadius: 6,
                    border: "1px solid var(--color-border-overlay)",
                    background: "transparent",
                    color: copied === `owner-${teamCode}` ? "var(--color-success)" : "var(--color-on-surface-variant)",
                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                    fontFamily: "var(--font-label-mono)",
                  }}
                >
                  {copied === `owner-${teamCode}` ? "✓" : "Copy"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LaunchTab(props: LaunchTabProps) {
  const {
    auctionStatus,
    onLaunch,
    onShuffle,
    teamCount         = 8,
    allPinsSet        = true,
    playerCount       = 0,
    auctionName       = "APL Season 1",
    targetPlayerCount = 140,
    shuffleReady      = false,
    links,
  } = props;

  const [shuffling,  setShuffling]  = useState(false);
  const [shuffleErr, setShuffleErr] = useState<string | null>(null);

  // ── Local optimistic shuffle completion ──────────────────────────────────
  // `shuffleReady` is fully controlled by the parent. If the parent doesn't
  // (or can't, e.g. waiting on a realtime/DB round-trip) flip that prop the
  // instant onShuffle() resolves, this component would get stuck showing
  // "REQUIRES ACTION" on the shuffle checklist item forever — even though
  // the shuffle actually succeeded — which permanently blocks Launch.
  //
  // We track completion locally as soon as onShuffle() resolves without
  // throwing, and treat shuffle as done if EITHER the parent prop says so
  // OR our local optimistic flag says so. The parent prop can still "win"
  // later (e.g. on a fresh page load) — it just isn't the only source of
  // truth for unlocking the button in this session.
  const [localShuffleDone, setLocalShuffleDone] = useState(false);
  const isShuffled = shuffleReady || localShuffleDone;

  // If auction moves back to "setup" from a prior session (e.g. after a
  // re-auction reset the schedule) and the incoming shuffleReady prop is
  // false, drop our stale local flag too so a fresh shuffle is required.
  useEffect(() => {
    if (auctionStatus === "setup" && !shuffleReady) {
      setLocalShuffleDone(false);
    }
  }, [auctionStatus, shuffleReady]);

  const isLive      = auctionStatus === "live";
  const isPaused    = auctionStatus === "paused";
  const isCompleted = auctionStatus === "completed";

  const checklist = buildChecklist(
    { ...props, teamCount, allPinsSet, playerCount, auctionName, targetPlayerCount },
    isShuffled,
  );

  const passCount = checklist.filter((c) => c.status !== "action").length;
  const total     = checklist.length;
  const allReady  = checklist.every((c) => c.status !== "action");

  const sessionSummary = buildSessionSummary(
    { ...props, teamCount, playerCount, auctionName, auctionStatus, onLaunch, onShuffle },
  );

  async function handleShuffle() {
    if (isShuffled || shuffling) return;
    setShuffling(true);
    setShuffleErr(null);
    try {
      await onShuffle();
      // Mark done immediately — don't wait on the parent to re-render with
      // an updated shuffleReady prop before unlocking Launch.
      setLocalShuffleDone(true);
    } catch (err: any) {
      setShuffleErr(err?.message ?? "Shuffle failed");
    } finally {
      setShuffling(false);
    }
  }

  function handleLaunch() {
    if (!allReady || isLive || isPaused || isCompleted) return;
    onLaunch();
  }

  const launchLabel = isLive
    ? "Auction Live"
    : isPaused
    ? "Auction Paused"
    : isCompleted
    ? "Auction Completed"
    : "Start Auction";

  const launchDisabled = !allReady || isLive || isPaused || isCompleted;

  const statusStyles = {
    complete: {
      bg:          "var(--color-surface-container-lowest)",
      borderLeft:  "rgba(201,151,31,0.2)",
      iconName:    "check_circle",
      iconFill:    "'FILL' 1",
      iconColor:   "var(--color-theme-orange)",
      labelWeight: 500,
      labelColor:  "var(--color-on-surface-variant)",
      metaColor:   "rgba(201,151,31,0.6)",
    },
    warning: {
      bg:          "var(--color-warning-container)",
      borderLeft:  "rgba(251,191,36,0.45)",
      iconName:    "warning",
      iconFill:    "'FILL' 1",
      iconColor:   "var(--color-warning)",
      labelWeight: 600,
      labelColor:  "var(--color-warning)",
      metaColor:   "var(--color-warning)",
    },
    action: {
      bg:          "rgba(201,151,31,0.04)",
      borderLeft:  "rgba(255,180,171,0.4)",
      iconName:    "radio_button_unchecked",
      iconFill:    "'FILL' 0",
      iconColor:   "var(--color-surface-variant)",
      labelWeight: 700,
      labelColor:  "var(--color-theme-orange)",
      metaColor:   "var(--color-error)",
    },
  } as const;

  return (
    <div className="flex flex-col items-center" style={{ minHeight: "70vh" }}>

      {/* Eyebrow */}
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 border"
        style={{ background: "rgba(201,151,31,0.08)", borderColor: "rgba(201,151,31,0.2)" }}>
        <span className="material-symbols-outlined text-sm" style={{ color: "var(--color-theme-orange)" }}>security</span>
        <span className="text-[10px] font-black uppercase tracking-[0.2em]"
          style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}>
          Mission Critical Protocol
        </span>
      </div>

      {/* Hero heading */}
      <h2 className="text-center font-bold mb-4"
        style={{ fontFamily: "var(--font-headline-lg)", fontSize: "clamp(40px,6vw,64px)", lineHeight: 1.05, letterSpacing: "-0.01em", color: "var(--color-on-surface)" }}>
        Launch Preparation
      </h2>
      <p className="text-center max-w-lg mb-14 text-sm leading-6"
        style={{ fontFamily: "var(--font-body-md)", color: "var(--color-outline)" }}>
        Validate all core datasets before{" "}
        <span className="italic" style={{ color: "var(--color-theme-orange)" }}>initializing</span>{" "}
        the live auction environment.{" "}
        <span style={{ color: "rgba(201,151,31,0.8)" }}>Commencement locks all configurations.</span>
      </p>

      {/* Main grid */}
      <div className="w-full grid gap-6" style={{ maxWidth: "860px", gridTemplateColumns: "1fr 300px" }}>

        {/* Left: Checklist */}
        <div className="rounded-2xl overflow-hidden relative"
          style={{ background: "var(--color-surface-glass)", border: "1px solid var(--color-border-overlay)", backdropFilter: "blur(24px)" }}>
          <div className="absolute pointer-events-none select-none -right-5 -bottom-5 opacity-[0.03]">
            <span className="material-symbols-outlined" style={{ fontSize: "260px", color: "var(--color-theme-orange)" }}>fact_check</span>
          </div>

          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--color-outline-variant)" }}>
            <div>
              <p className="text-lg font-bold mb-0.5" style={{ fontFamily: "var(--font-headline-md)", color: "var(--color-theme-orange)" }}>
                Pre-flight Checklist
              </p>
              <p className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-surface-variant)" }}>
                Verification Status
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold leading-none mb-0.5"
                style={{ fontFamily: "var(--font-headline-md)", fontSize: "36px", color: "var(--color-on-surface)" }}>
                {passCount}/{total}
              </p>
              <p className="text-[9px] uppercase tracking-[0.12em]" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-surface-variant)" }}>
                Checks Complete
              </p>
            </div>
          </div>

          <div className="flex flex-col relative z-10">
            {checklist.map((item, i) => {
              const s = statusStyles[item.status];
              return (
                <div key={item.id}
                  className="flex items-center justify-between px-6 py-4"
                  style={{
                    background:   s.bg,
                    borderBottom: i < checklist.length - 1 ? "1px solid var(--color-outline-variant)" : "none",
                    borderLeft:   `2px solid ${s.borderLeft}`,
                  }}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-lg"
                      style={{ color: s.iconColor, fontVariationSettings: s.iconFill }}>
                      {s.iconName}
                    </span>
                    <div>
                      <span className="text-sm"
                        style={{ fontFamily: "var(--font-body-md)", fontWeight: s.labelWeight, color: s.labelColor }}>
                        {item.label}
                      </span>
                      {item.status === "warning" && (
                        <p className="text-[9px] mt-0.5" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}>
                          Auction can proceed without photos
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.15em]"
                    style={{ fontFamily: "var(--font-label-mono)", color: s.metaColor }}>
                    {item.meta}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Command center */}
        <div className="flex flex-col gap-4">

          {/* Randomisation card */}
          <div className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: "var(--color-surface-glass)", border: "1px solid var(--color-border-overlay)", backdropFilter: "blur(24px)" }}>
            <div className="absolute pointer-events-none -right-2 -top-2 transition-opacity duration-500"
              style={{ opacity: isShuffled ? 0.18 : 0.08 }}>
              <span className="material-symbols-outlined rotate-12 mt-5 mr-4" style={{ fontSize: "90px", color: "var(--color-theme-orange)" }}>
                casino
              </span>
            </div>

            <p className="text-base font-bold mb-1.5 relative z-10"
              style={{ fontFamily: "var(--font-headline-md)", color: "var(--color-on-surface)" }}>
              Randomisation
            </p>
            <p className="text-[11px] leading-[18px] mb-4 relative z-10"
              style={{ fontFamily: "var(--font-body-md)", color: "var(--color-outline)" }}>
              Fisher-Yates shuffle — cryptographically determines the definitive player sequence and saves it to the database.
            </p>

            {shuffleErr && (
              <p className="text-[10px] mb-3 px-3 py-1.5 rounded-lg relative z-10"
                style={{ background: "var(--color-error-container)", color: "var(--color-error)", border: "1px solid var(--color-error)", fontFamily: "var(--font-label-mono)" }}>
                {shuffleErr}
              </p>
            )}

            <button
              onClick={handleShuffle}
              disabled={isShuffled || shuffling}
              className="relative z-10 w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[10px] font-black uppercase tracking-[0.18em] transition-all duration-300"
              style={{
                fontFamily: "var(--font-label-mono)",
                background: isShuffled
                  ? "rgba(201,151,31,0.1)"
                  : shuffling
                  ? "var(--color-surface-container-low)"
                  : "var(--color-on-surface)",
                border: isShuffled
                  ? "1px solid rgba(201,151,31,0.35)"
                  : "1px solid var(--color-border-overlay)",
                color: isShuffled
                  ? "var(--color-theme-orange)"
                  : shuffling
                  ? "var(--color-outline)"
                  : "var(--color-surface)",
                cursor: isShuffled || shuffling ? "default" : "pointer",
              }}
            >
              <span className={`material-symbols-outlined text-[15px] ${shuffling ? "animate-spin" : ""}`}>
                {isShuffled ? "verified" : shuffling ? "refresh" : "shuffle"}
              </span>
              {isShuffled
                ? "Sequence Locked"
                : shuffling
                ? "Shuffling Players…"
                : "Generate Sequence"}
            </button>

            {isShuffled && (
              <p className="text-[9px] mt-2 text-center relative z-10"
                style={{ fontFamily: "var(--font-label-mono)", color: "rgba(201,151,31,0.5)" }}>
                Order saved to database
              </p>
            )}
          </div>

          {/* Final initialisation card */}
          <div className="rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden transition-all duration-500"
            style={{
              background:     allReady ? "rgba(201,151,31,0.06)" : "var(--color-surface-container)",
              border:         allReady ? "2px solid rgba(201,151,31,0.3)" : "1px solid var(--color-outline-variant)",
              backdropFilter: "blur(24px)",
            }}>
            {allReady && (
              <div className="absolute top-0 left-0 w-full h-px pointer-events-none"
                style={{ background: "linear-gradient(90deg, transparent, rgba(201,151,31,0.6), transparent)" }} />
            )}

            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full"
                  style={{ background: "var(--color-theme-orange)", boxShadow: allReady ? "0 0 8px rgba(201,151,31,0.8)" : "none" }} />
                <p className="text-[10px] font-black uppercase tracking-[0.15em]"
                  style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)" }}>
                  Final Initialization
                </p>
              </div>
              <p className="text-[11px] leading-[18px]"
                style={{ fontFamily: "var(--font-body-md)", color: "var(--color-outline)" }}>
                {isLive
                  ? "The auction is live. Share the links below with teams and spectators."
                  : isPaused
                  ? "The auction is paused. Resume from the header."
                  : isCompleted
                  ? "This auction has ended. Use Re-auction to start fresh."
                  : <>
                      Executing the launch command transitions the environment to{" "}
                      <span className="italic font-semibold" style={{ color: "var(--color-theme-orange)" }}>Live Mode</span>.
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
                fontFamily:    "var(--font-headline-lg)",
                fontSize:      allReady ? "22px" : "20px",
                letterSpacing: "0.04em",
                background: isLive || isPaused || isCompleted
                  ? "var(--color-surface-container-low)"
                  : allReady
                  ? "var(--color-theme-orange)"
                  : "repeating-linear-gradient(45deg, rgba(201,151,31,0.05), rgba(201,151,31,0.05) 10px, rgba(201,151,31,0.1) 10px, rgba(201,151,31,0.1) 20px)",
                border: allReady && !launchDisabled
                  ? "1px solid rgba(201,151,31,0.6)"
                  : "1px solid var(--color-outline-variant)",
                color:     allReady && !launchDisabled ? "var(--color-on-primary)" : "rgba(201,151,31,0.35)",
                cursor:    launchDisabled ? "not-allowed" : "pointer",
                boxShadow: allReady && !launchDisabled ? "0 0 40px rgba(201,151,31,0.3)" : "none",
              }}>
              {launchLabel}
              {!allReady && !isLive && !isPaused && !isCompleted && (
                <div className="text-[9px] font-black not-italic uppercase tracking-[0.3em] mt-1.5"
                  style={{ fontFamily: "var(--font-label-mono)", color: "rgba(201,151,31,0.35)" }}>
                  Lock Sequence Pending
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Post-launch links panel */}
      {isLive && links && <PostLaunchLinks links={links} />}

      {/* Session Summary */}
      <div className="w-full mt-6 rounded-2xl p-5 flex items-center gap-6"
        style={{ maxWidth: "860px", background: "var(--color-surface-glass)", border: "1px solid var(--color-border-overlay)", backdropFilter: "blur(24px)" }}>
        <div className="shrink-0">
          <p className="text-sm font-bold whitespace-nowrap"
            style={{ fontFamily: "var(--font-headline-md)", color: "var(--color-on-surface)" }}>
            Session Summary
          </p>
          <span className="text-[9px] font-black uppercase tracking-[0.15em] mt-1 inline-block px-2 py-0.5 rounded-full border"
            style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-theme-orange)", background: "rgba(201,151,31,0.08)", borderColor: "rgba(201,151,31,0.25)" }}>
            Configured
          </span>
        </div>
        <div className="w-px self-stretch shrink-0" style={{ background: "var(--color-outline-variant)" }} />
        <div className="flex items-center gap-0 flex-1 min-w-0">
          {sessionSummary.map((row, i) => (
            <div key={row.label} className="flex flex-col gap-1 flex-1 px-4"
              style={{ borderRight: i < sessionSummary.length - 1 ? "1px solid var(--color-outline-variant)" : "none" }}>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: "12px", color: "var(--color-surface-variant)" }}>{row.icon}</span>
                <span className="text-[8px] uppercase tracking-[0.1em]"
                  style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface-variant)" }}>{row.label}</span>
              </div>
              <span className="text-[11px] font-black" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface)" }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ALP-01 Footer */}
      <div className="w-full mt-8 rounded-2xl p-6 flex items-start gap-5"
        style={{ maxWidth: "860px", background: "rgba(201,151,31,0.04)", border: "1px solid var(--color-outline-variant)", borderLeft: "6px solid var(--color-theme-orange)", backdropFilter: "blur(24px)" }}>
        <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(201,151,31,0.12)" }}>
          <span className="material-symbols-outlined text-[22px]" style={{ color: "var(--color-theme-orange)" }}>verified_user</span>
        </div>
        <div>
          <p className="text-base font-bold mb-1.5"
            style={{ fontFamily: "var(--font-headline-md)", color: "var(--color-on-surface)" }}>
            Administrative Lock Protocol (ALP-01)
          </p>
          <p className="text-xs leading-5" style={{ fontFamily: "var(--font-body-md)", color: "var(--color-outline)" }}>
            Upon initiation, the system enforces a strict immutable state on team rosters, base valuations,
            and tournament structures. Any data discrepancies post-launch will require a catastrophic session
            reset and hardware re-authentication. Verification is absolute.
          </p>
        </div>
      </div>
    </div>
  );
}