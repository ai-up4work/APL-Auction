// components/Admin/AdminHeader.tsx
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import AuctionSwitcher from "@/components/Admin/AuctionSwitcher";


// ── Status → visual meta ───────────────────────────────────────────────────────
const STATUS_META = {
  setup:     { label: "SETUP MODE", color: "#9a9aa5", pulse: false },
  live:      { label: "LIVE",       color: "#e45d35", pulse: true  },
  paused:    { label: "PAUSED",     color: "#fbbf24", pulse: false },
  completed: { label: "COMPLETED",  color: "#f87171", pulse: false },
} as const;

// ── Confirmation copy for each control action ──────────────────────────────────
const ACTION_CONFIG = {
  pause: {
    title: "Pause the auction?",
    message:
      "Bidding freezes for every team immediately. The current player's countdown stops where it is. You can resume at any time.",
    confirmLabel: "Pause Auction",
    tone: "info",
  },
  resume: {
    title: "Resume the auction?",
    message:
      "Bidding continues immediately for all teams, picking up exactly where it was paused.",
    confirmLabel: "Resume Auction",
    tone: "info",
  },
  stop: {
    title: "Stop the auction?",
    message:
      "This ends bidding permanently and moves the league to the post-auction report. Any player not yet auctioned will remain unsold. This cannot be undone.",
    confirmLabel: "Stop Auction",
    tone: "danger",
  },
  reauction: {
    title: "Start a fresh auction?",
    message:
      "This clears the auction history — every sold player, bid, and lot — and resets every team's roster and purse back to full. Your teams and player list stay exactly as they are now, so you can relaunch immediately or tweak the config first. This cannot be undone.",
    confirmLabel: "Reset & Restart",
    tone: "danger",
    requireText: "RESET",
  },
} as const;

type ActionKey = keyof typeof ACTION_CONFIG;

// ── Confirm Dialog ──────────────────────────────────────────────────────────────
function ConfirmDialog({
  action,
  onConfirm,
  onCancel,
}: {
  action: ActionKey;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cfg = ACTION_CONFIG[action];
  const [typed, setTyped] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!cfg || !mounted) return null;

  const danger = cfg.tone === "danger";
  const accent = danger ? "#f87171" : "#e45d35";
  const requireText = "requireText" in cfg ? cfg.requireText : undefined;
  const locked = requireText != null && typed.trim().toUpperCase() !== requireText;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 9999 }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{
          background: "#181c1d",
          border: `1px solid ${danger ? "rgba(248,113,113,0.3)" : "rgba(228,93,53,0.25)"}`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: danger ? "rgba(248,113,113,0.12)" : "rgba(228,93,53,0.12)" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: accent }}>
              {danger ? "warning" : "info"}
            </span>
          </div>
          <h3
            style={{
              fontFamily: "'Archivo Narrow', sans-serif",
              fontSize: "17px",
              fontWeight: 700,
              color: "#e0e3e4",
            }}
          >
            {cfg.title}
          </h3>
        </div>

        <p className="text-[13px] leading-[20px]" style={{ color: "#9a9aa5", fontFamily: "'Inter', sans-serif" }}>
          {cfg.message}
        </p>

        {requireText && (
          <div>
            <label
              className="block text-[9px] font-bold uppercase tracking-widest mb-1.5"
              style={{ fontFamily: "'Geist', monospace", color: "#c6c6cd" }}
            >
              Type {requireText} to confirm
            </label>
            <input
              autoFocus
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireText}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(248,113,113,0.25)",
                color: "#e0e3e4",
                fontFamily: "'Geist', monospace",
                letterSpacing: "0.05em",
              }}
            />
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#c6c6cd",
              fontFamily: "'Geist', monospace",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!!locked}
            className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all"
            style={{
              background: locked ? "rgba(255,255,255,0.06)" : danger ? "#f87171" : "#e45d35",
              color: locked ? "#45464d" : "#fff",
              fontFamily: "'Geist', monospace",
              cursor: locked ? "not-allowed" : "pointer",
              boxShadow: locked ? "none" : `0 0 18px ${danger ? "rgba(248,113,113,0.3)" : "rgba(228,93,53,0.25)"}`,
            }}
          >
            {cfg.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Small header action button ──────────────────────────────────────────────────
function HeaderActionButton({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-1.5 h-[34px] px-3 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-colors"
      style={{
        fontFamily: "'Geist', monospace",
        borderColor: danger ? "rgba(248,113,113,0.3)" : "rgba(228,93,53,0.3)",
        background: hovered
          ? danger ? "rgba(248,113,113,0.14)" : "rgba(228,93,53,0.14)"
          : danger ? "rgba(248,113,113,0.06)" : "rgba(228,93,53,0.06)",
        color: danger ? "#f87171" : "#e45d35",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>{icon}</span>
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { key: "teams",   label: "Teams",   icon: "group"         },
  { key: "players", label: "Players", icon: "person"        },
  { key: "rules",   label: "Rules",   icon: "gavel"         },
  { key: "session", label: "Session", icon: "event"         },
  { key: "launch",  label: "Launch",  icon: "rocket_launch" },
] as const;

const CONFIG_STEP_KEYS = STEPS.slice(0, -1).map((s) => s.key) as string[];

type AuctionStatus = "setup" | "live" | "paused" | "completed";

interface AdminHeaderProps {
  activeStep?: string;
  onStepChange?: (step: string) => void;
  auctionStatus?: AuctionStatus;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onReauction?: () => void | Promise<void>;
}

export default function AdminHeader({
  activeStep = "teams",
  onStepChange,
  auctionStatus = "setup",
  onPause,
  onResume,
  onStop,
  onReauction,
}: AdminHeaderProps) {
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null);
  const [isConfirming,  setIsConfirming]  = useState(false);

  const status = STATUS_META[auctionStatus] ?? STATUS_META.setup;
  const auctionLocked = auctionStatus === "live" || auctionStatus === "paused";

  async function handleConfirm() {
    setIsConfirming(true);
    try {
      if (pendingAction === "pause")     await onPause?.();
      if (pendingAction === "resume")    await onResume?.();
      if (pendingAction === "stop")      await onStop?.();
      if (pendingAction === "reauction") await onReauction?.();
      setPendingAction(null);
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: "rgba(11,15,16,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {pendingAction && (
        <ConfirmDialog
          action={pendingAction}
          onConfirm={handleConfirm}
          onCancel={() => !isConfirming && setPendingAction(null)}
        />
      )}

      {/* ── Utility Bar ── */}
      <div className="h-12 px-4 md:px-6 lg:px-10 flex items-center justify-between border-b border-white/5">
        {/* Left: brand + status badge + auction switcher */}
        <div className="flex items-center gap-2 md:gap-4 min-w-0 shrink-0">
          <span
            className="font-black tracking-tighter uppercase text-sm md:text-base whitespace-nowrap"
            style={{ fontFamily: "'Archivo Narrow', sans-serif", color: "#e45d35" }}
          >
            War Room Admin
          </span>
          <div className="hidden sm:block h-4 w-px bg-white/10" />
          <div
            className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full border"
            style={{ background: `${status.color}1a`, borderColor: `${status.color}4d` }}
          >
            <span
              className={status.pulse ? "w-1.5 h-1.5 rounded-full animate-pulse" : "w-1.5 h-1.5 rounded-full"}
              style={{ background: status.color }}
            />
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ fontFamily: "'Geist', monospace", color: status.color }}
            >
              {status.label}
            </span>
          </div>

          {/* ── Auction switcher ── */}
          <div className="hidden sm:block h-4 w-px bg-white/10" />
          <AuctionSwitcher />
        </div>

        {/* Right: auction controls + notifications + profile */}
        <div className="flex items-center gap-2">
          {auctionStatus !== "setup" && (
            <>
              <div className="flex items-center gap-2">
                {auctionStatus === "live" && (
                  <HeaderActionButton icon="pause" label="Pause" onClick={() => setPendingAction("pause")} />
                )}
                {auctionStatus === "paused" && (
                  <HeaderActionButton icon="play_arrow" label="Resume" onClick={() => setPendingAction("resume")} />
                )}
                {(auctionStatus === "live" || auctionStatus === "paused") && (
                  <HeaderActionButton icon="stop_circle" label="Stop" danger onClick={() => setPendingAction("stop")} />
                )}
                {auctionStatus === "completed" && (
                  <HeaderActionButton icon="restart_alt" label="Re-auction" danger onClick={() => setPendingAction("reauction")} />
                )}
              </div>
              <div className="w-px h-5 bg-white/[0.08]" />
            </>
          )}

          <NotificationButton />
          <div className="w-px h-5 bg-white/[0.08]" />
          <ProfileChip />
        </div>
      </div>

      {/* ── Stepper Nav ── */}
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {STEPS.map((step, i) => {
            const isActive = activeStep === step.key;
            const isDisabled = auctionLocked && CONFIG_STEP_KEYS.includes(step.key);

            return (
              <div
                key={step.key}
                className="flex items-center"
                style={{ flex: i < STEPS.length - 1 ? "1 1 0%" : "0 0 auto" }}
              >
                <StepButton
                  step={step}
                  isActive={isActive}
                  isDisabled={isDisabled}
                  onClick={() => !isDisabled && onStepChange?.(step.key)}
                />

                {i < STEPS.length - 1 && (
                  <div
                    className="flex-1 h-px mx-2 sm:mx-4"
                    style={{ background: "rgba(255,255,255,0.07)", marginTop: "-14px" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepButton({
  step,
  isActive,
  isDisabled,
  onClick,
}: {
  step: { key: string; label: string; icon: string };
  isActive: boolean;
  isDisabled: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative z-10 flex flex-col items-center focus:outline-none"
      aria-current={isActive ? "step" : undefined}
      title={isDisabled ? "Locked while auction is live" : undefined}
      style={{ cursor: isDisabled ? "not-allowed" : "pointer", opacity: isDisabled ? 0.4 : 1 }}
    >
      <div
        className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-1 sm:mb-2 transition-all"
        style={
          isActive
            ? { background: "#e45d35", color: "#fff" }
            : hovered && !isDisabled
            ? { background: "rgba(228,93,53,0.15)", border: "1px solid rgba(228,93,53,0.3)", color: "#e45d35" }
            : { background: "#272b2c", border: "1px solid #3a3d42", color: "#9a9aa5" }
        }
      >
        <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
          {isDisabled ? "lock" : step.icon}
        </span>
      </div>
      <span
        className="hidden sm:block text-[9px] font-bold uppercase tracking-widest whitespace-nowrap"
        style={{ fontFamily: "'Geist', monospace", color: isActive ? "#e45d35" : "#9a9aa5" }}
      >
        {step.label}
      </span>
      {isActive && (
        <div
          className="absolute -bottom-3 sm:-bottom-4 w-1 h-1 rounded-full"
          style={{ background: "#e45d35" }}
        />
      )}
    </button>
  );
}

function NotificationButton() {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      className="relative w-[34px] h-[34px] rounded-lg flex items-center justify-center transition-colors"
      style={{
        color: hovered ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)",
        background: hovered ? "rgba(255,255,255,0.07)" : "transparent",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Notifications"
    >
      <span className="material-symbols-outlined text-xl">notifications</span>
      <span
        className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full"
        style={{ background: "#e45d35", border: "1.5px solid #0b0f10" }}
      />
    </button>
  );
}

function ProfileChip() {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      className="flex items-center gap-2 h-[34px] pl-1.5 pr-2.5 rounded-lg border transition-colors"
      style={{
        borderColor: hovered ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
        background: hovered ? "rgba(255,255,255,0.06)" : "transparent",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Admin account"
    >
      <div
        className="w-6 h-6 rounded-[6px] flex items-center justify-center text-[9px] font-bold text-white shrink-0"
        style={{ background: "#e45d35" }}
      >
        AC
      </div>
      <div className="hidden sm:flex flex-col items-start leading-none">
        <span className="text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'Inter', sans-serif" }}>
          Admin
        </span>
        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Inter', sans-serif" }}>
          Console
        </span>
      </div>
      <span className="material-symbols-outlined hidden sm:block" style={{ fontSize: "14px", color: "rgba(255,255,255,0.25)" }}>
        expand_more
      </span>
    </button>
  );
}