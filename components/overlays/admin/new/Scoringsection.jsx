// application/components/overlays/admin/new/ScoringSection.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CricketBall from "@/components/overlays/shared/CricketBall";
import {
  useLiveScoringEngine,
  EXTRA_OPTIONS,
  NO_BALL_RUN_ORIGIN_OPTIONS,
  getValidDismissalOptions,
  isDismissalRestricted,
} from "@/hooks/useLiveScoringEngine";

const GOLD_GRADIENT = "linear-gradient(135deg,#A87815,#E8C468)";

/* ───────────────────────── helpers ───────────────────────── */

function initials(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "—";
}

function Icon({ name, className = "", style }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}

const OVER_BALL_STYLES = {
  wicket: {
    fill: "radial-gradient(circle at 32% 26%, #f87171 0%, #dc2626 45%, #7f1d1d 85%, #450a0a 100%)",
    seamColor: "rgba(255,255,255,0.35)",
    textColor: "#fff",
  },
  boundary: {
    fill: "radial-gradient(circle at 32% 26%, #f3da8e 0%, #d4a52e 45%, #a8781a 85%, #6b4b0e 100%)",
    seamColor: "rgba(255,255,255,0.4)",
    textColor: "#3a2a04",
  },
  extra: {
    fill: "radial-gradient(circle at 32% 26%, #93c5fd 0%, #3b82f6 45%, #1e3a8a 85%, #0f1f42 100%)",
    seamColor: "rgba(255,255,255,0.4)",
    textColor: "#fff",
  },
  dot: {
    fill: "radial-gradient(circle at 32% 26%, #6b7280 0%, #454b54 45%, #24272c 85%, #17181b 100%)",
    seamColor: "rgba(255,255,255,0.3)",
    textColor: "#d1d5db",
  },
};

// FIX — now also recognizes the "nb+b" / "nb+lb" combo tokens produced
// by the engine for No Ball + Bye / No Ball + Leg Bye deliveries.
// Previously these strings would have fallen through to the generic
// Number(raw) branch, produced NaN, and rendered as a blank/garbled ball.
function normalizeOverEntry(raw) {
  if (raw == null) return null;
  if (raw === "W") return "W";
  if (raw === "wd" || raw === "Wd") return "Wd";
  if (raw === "nb" || raw === "Nb") return "Nb";
  if (raw === "nb+b") return "Nb+B";
  if (raw === "nb+lb") return "Nb+LB";
  if (raw === "b" || raw === "By" || raw === "bye") return "By";
  if (raw === "lb" || raw === "Lb" || raw === "legBye") return "Lb";
  if (raw === ".") return 0;
  const n = Number(raw);
  return Number.isNaN(n) ? raw : n;
}

function ballOutcome(entry) {
  if (entry === "W") return { kind: "wicket", label: "W" };
  if (entry === "Wd") return { kind: "extra", label: "wd" };
  if (entry === "Nb") return { kind: "extra", label: "nb" };
  if (entry === "Nb+B") return { kind: "extra", label: "nb+b" };
  if (entry === "Nb+LB") return { kind: "extra", label: "nb+lb" };
  if (entry === "Lb") return { kind: "extra", label: "lb" };
  if (entry === "By") return { kind: "extra", label: "b" };
  if (entry === 4 || entry === 6) return { kind: "boundary", label: String(entry) };
  if (entry === 0) return { kind: "dot", label: "0" };
  return { kind: "dot", label: String(entry ?? "") };
}

function OverBall({ entry }) {
  if (entry == null) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full shrink-0"
        style={{ width: 20, height: 20, border: "1px dashed rgba(255,255,255,0.15)" }}
      />
    );
  }
  const { kind, label } = ballOutcome(entry);
  const style = OVER_BALL_STYLES[kind];
  const isCombo = label.length > 3;
  return (
    <CricketBall size={20} fill={style.fill} seamColor={style.seamColor}>
      <span style={{ fontSize: isCombo ? 6.5 : 9, fontWeight: 700, color: style.textColor, lineHeight: 1 }}>{label}</span>
    </CricketBall>
  );
}

function PlayerPickerSheet({ title, teamLabel, players, onSelect, onClose, dismissedNames, roleByName }) {
  return (
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:w-[520px] sm:max-w-[calc(100vw-64px)] max-h-[78vh] overflow-y-auto custom-scrollbar bg-surface-container-lowest border border-white/10 rounded-t-2xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex flex-col min-w-0">
            <span className="font-archivo text-sm font-bold uppercase italic">{title}</span>
            <span className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.1em] mt-0.5">{teamLabel}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player picker"
            className="h-7 w-7 rounded-full flex items-center justify-center border border-white/10 text-on-surface-variant shrink-0"
          >
            <Icon name="close" style={{ fontSize: 15 }} />
          </button>
        </div>

        {(!players || players.length === 0) ? (
          <p className="font-mono-geist text-[10px] text-on-surface-variant text-center py-6">
            No squad loaded — set this team&apos;s squad in Match Setup.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {players.map((p) => {
              const isOut = !!dismissedNames?.has(p.name);
              const roleInfo = roleByName?.get(p.name);
              const isLocked = isOut || !!roleInfo;
              const roleLabel =
                roleInfo?.role === "striker" ? "On Strike" : roleInfo?.role === "nonStriker" ? "Non-Striker" : roleInfo?.role === "bowler" ? "Bowling" : undefined;
              return (
                <button
                  type="button"
                  key={p.id}
                  disabled={isLocked}
                  onClick={() => { if (isLocked) return; onSelect(p); onClose(); }}
                  className="flex flex-col items-center gap-1.5 px-1.5 py-3 rounded-xl border transition-colors"
                  style={
                    isOut
                      ? { opacity: 0.55, background: "rgba(239,68,68,0.07)", borderColor: "rgba(248,113,113,0.4)" }
                      : isLocked
                      ? { opacity: 0.7, background: "rgba(34,197,94,0.07)", borderColor: "rgba(74,222,128,0.4)" }
                      : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)" }
                  }
                >
                  <span
                    className="w-11 h-11 rounded-full flex items-center justify-center font-mono-geist text-[12px] font-bold overflow-hidden"
                    style={{ border: "1px solid rgba(255,255,255,0.15)", color: isOut ? "#f87171" : isLocked ? "#4ade80" : "#e5e7eb" }}
                  >
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initials(p.name)
                    )}
                  </span>
                  <span className="text-[9.5px] font-archivo font-bold text-center leading-tight break-words" style={{ color: isOut ? "#f87171" : isLocked ? "#4ade80" : "#e5e7eb" }}>
                    {p.name}{isOut ? " · OUT" : roleLabel ? ` · ${roleLabel}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CrewSlot({
  title, accentColor, active, onActivate, displayName, imageUrl, statLine,
  allPlayers, onAssign, onClear, placeholder, dismissedNames, blockedName,
  noReplacement, avatarSize, compact, disabled,
}) {
  const size = avatarSize ?? (compact ? 32 : 44);
  const isEmpty = !displayName;
  const locked = !!disabled;

  if (noReplacement && isEmpty) {
    return (
      <div className={`rounded-xl border border-dashed border-white/15 bg-white/[0.02] ${compact ? "p-2" : "p-3"}`}>
        <p className="font-mono-geist text-[9px] uppercase tracking-[0.14em] font-bold text-on-surface-variant mb-1.5">{title}</p>
        <div className="flex items-center gap-2.5">
          <span className="rounded-full flex items-center justify-center opacity-50 shrink-0" style={{ width: size, height: size, border: "1px solid rgba(255,255,255,0.15)" }}>—</span>
          <span className="text-[10px] font-mono-geist font-bold text-on-surface-variant">No replacement left</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={locked ? undefined : onActivate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (!locked && (e.key === "Enter" || e.key === " ")) onActivate(); }}
      className={`rounded-xl transition-all ${compact ? "p-2" : "p-3"} ${locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      style={{
        border: `1px ${isEmpty ? "dashed" : "solid"} ${isEmpty ? "rgba(239,68,68,0.4)" : active ? "rgba(201,151,31,0.45)" : "rgba(255,255,255,0.1)"}`,
        background: isEmpty ? "rgba(239,68,68,0.08)" : active ? "rgba(201,151,31,0.08)" : "rgba(255,255,255,0.02)",
      }}
      onDragOver={(e) => !locked && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (locked) return;
        const id = e.dataTransfer.getData("text/player-id");
        const player = allPlayers.find((p) => p.id === id);
        if (!player) return;
        if (dismissedNames?.has(player.name)) return;
        if (blockedName && player.name === blockedName) return;
        onAssign(player);
      }}
    >
      <div className={`flex items-center justify-between gap-2 ${compact ? "mb-1" : "mb-2"}`}>
        <span className="font-mono-geist text-[9px] uppercase tracking-[0.14em] font-bold truncate" style={{ color: isEmpty ? "#f87171" : accentColor || "rgba(255,255,255,0.4)" }}>
          {isEmpty ? "⚠ " : ""}{title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {active && !locked && <span className="font-mono-geist text-[8.5px] text-theme-orange/70 hidden lg:inline">drag or tap ▾</span>}
          {!isEmpty && onClear && !locked && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              aria-label={`Clear ${title}`}
              className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center text-on-surface-variant hover:text-red-400 shrink-0"
            >
              <Icon name="close" style={{ fontSize: 12 }} />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="rounded-full flex items-center justify-center shrink-0 font-mono-geist font-bold overflow-hidden"
          style={{ width: size, height: size, border: "1px solid rgba(255,255,255,0.15)", fontSize: Math.max(9, size * 0.26), color: isEmpty ? "#f87171" : "#e5e7eb" }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : displayName ? initials(displayName) : "+"}
        </span>
        <div className="flex flex-col min-w-0">
          <span className={`font-archivo font-bold truncate text-on-surface ${compact ? "text-[11px]" : "text-[12px]"}`}>{displayName || placeholder}</span>
          {statLine && <span className={`font-mono-geist text-on-surface-variant truncate ${compact ? "text-[9px]" : "text-[10px]"}`}>{statLine}</span>}
        </div>
      </div>
    </div>
  );
}

function MoreActionsMenu({ onAdminAction, onPenaltyClick, disabled }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const buttonRef = useRef(null);

  const items = [
    { key: "Penalty", label: "Penalty +5", color: "#fca5a5", action: onPenaltyClick },
    { key: "Injured", label: "Injured", color: "#fdba74", action: () => onAdminAction("Injured") },
    { key: "Abandon", label: "Abandon", color: "#fecaca", action: () => onAdminAction("Abandon") },
  ];

  function reposition() {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setCoords({
      bottom: Math.max(8, window.innerHeight - rect.top + 8),
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }

  function toggleOpen() {
    if (disabled) return;
    if (!open) reposition();
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={open}
        className="h-full w-full rounded-lg font-mono-geist font-bold uppercase tracking-[0.12em] transition-all hover:brightness-110 active:scale-95 border flex items-center justify-center gap-1 disabled:opacity-35 disabled:cursor-not-allowed"
        style={{ fontSize: "clamp(0.75rem, min(5cqh, 6cqi), 1.5rem)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.12)" }}
      >
        More <Icon name={open ? "expand_less" : "expand_more"} style={{ fontSize: "1.1em" }} />
      </button>
      {open && !disabled && coords && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[199]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[200] w-40 rounded-xl border border-white/10 bg-surface-container-lowest p-1.5 shadow-xl"
            style={{ bottom: coords.bottom, right: coords.right }}
          >
            {items.map((it) => (
              <button
                type="button"
                key={it.key}
                onClick={() => { it.action(); setOpen(false); }}
                className="w-full text-left px-2.5 py-2 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.12em] hover:bg-white/5"
                style={{ color: it.color }}
              >
                {it.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function BatterPickerButton({ batter, label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all"
      style={{
        border: `1px solid ${selected ? "rgba(201,151,31,0.45)" : "rgba(255,255,255,0.08)"}`,
        background: selected ? "rgba(201,151,31,0.1)" : "rgba(255,255,255,0.02)",
      }}
    >
      <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-mono-geist text-[9px] font-bold" style={{ border: "1px solid rgba(255,255,255,0.15)", color: selected ? "#e8c468" : "#e5e7eb" }}>
        {initials(batter?.name || label)}
      </span>
      <span className="flex flex-col min-w-0">
        <span className={`text-[11px] font-archivo font-bold truncate ${selected ? "text-theme-orange" : "text-on-surface"}`}>{batter?.name || label}</span>
        <span className="text-[9px] uppercase tracking-wide font-mono-geist text-on-surface-variant">{label}</span>
      </span>
    </button>
  );
}

function CenteredOverlay({ open, onClose, title, icon, iconColor = "#e8c468", children }) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[380] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[440px] max-h-[85dvh] overflow-y-auto custom-scrollbar rounded-2xl glass-panel border border-white/10 p-4 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {icon && (
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${iconColor}24`, border: `1px solid ${iconColor}4d` }}>
                <Icon name={icon} style={{ fontSize: 16, color: iconColor }} />
              </span>
            )}
            <h3 className="truncate font-archivo text-sm font-bold uppercase text-on-surface">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors">
            <Icon name="close" style={{ fontSize: 16 }} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

// FIX — this dialog no longer resolves (records) a wicket on close.
// `onCancel` is now called from the CenteredOverlay's onClose (both the
// backdrop click and the X button), and it does nothing but discard the
// in-progress selection — no dismissal is recorded, no defaults are
// applied. Only the explicit "Fire Wicket Graphic" button below calls
// onResolve, and only once the scorer has actually made a choice.
//
// Banner logic also now derived directly from extraType/isFreeHitActive
// via isDismissalRestricted instead of a boolean that used to claim a
// Free Hit was "locked to Run Out only" (no longer true — Obstructing
// the Field and Retired Out are valid on a Free Hit too).
function WicketDetailDialog({ pending, onResolve, onCancel }) {
  const [batsmanOut, setBatsmanOut] = useState("striker");
  const options = getValidDismissalOptions(pending.extraType, pending.isFreeHitActive);
  const restricted = isDismissalRestricted(pending.extraType, pending.isFreeHitActive);
  const isByeType = pending.extraType === "bye" || pending.extraType === "legBye";
  const isNbCombo = pending.extraType === "noBall" && pending.noBallRunOrigin !== "bat";
  const [dismissalType, setDismissalType] = useState(options[0].value);
  const [fielder, setFielder] = useState("");
  const [runsCompleted, setRunsCompleted] = useState(0);

  const bannerText = pending.extraType === "noBall"
    ? "🔵 No Ball — Bowled, Caught, LBW, Stumped, and Hit Wicket aren't valid here"
    : pending.isFreeHitActive
    ? "🔓 Free Hit — Bowled, Caught, LBW, Stumped, and Hit Wicket aren't valid here"
    : pending.extraType === "wide"
    ? "🔵 Wide — Bowled, Caught, and LBW aren't valid here"
    : isByeType
    ? `🔵 ${pending.extraType === "bye" ? "Bye" : "Leg Bye"} — Bowled, Caught, and LBW aren't valid here`
    : null;

  return (
    <CenteredOverlay open onClose={onCancel} title="Wicket Detail" icon="sports_cricket" iconColor="#f87171">
      {restricted && bannerText && (
        <div className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide font-mono-geist" style={{ background: "rgba(96,165,250,0.14)", border: "1px solid rgba(96,165,250,0.4)", color: "#93c5fd" }}>
          {bannerText}
        </div>
      )}
      {isNbCombo && (
        <div className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide font-mono-geist" style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)", color: "#7dd3fc" }}>
          🔵 No Ball + {pending.noBallRunOrigin === "bye" ? "Bye" : "Leg Bye"} — completed runs count as extras, not off the bat
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Batsman Out</span>
        <div className="grid grid-cols-2 gap-2">
          <BatterPickerButton batter={pending.strikerBefore} label="Striker" selected={batsmanOut === "striker"} onClick={() => setBatsmanOut("striker")} />
          <BatterPickerButton batter={pending.nonStrikerBefore} label="Non-Striker" selected={batsmanOut === "nonStriker"} onClick={() => setBatsmanOut("nonStriker")} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Dismissal</span>
        <div className="grid grid-cols-2 gap-2">
          {options.map((d) => {
            const selected = dismissalType === d.value;
            const onlyOption = options.length === 1;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => !onlyOption && setDismissalType(d.value)}
                className="px-3 py-2.5 rounded-lg text-left text-[11.5px] font-archivo font-bold border transition-all"
                style={
                  selected
                    ? { background: "rgba(201,151,31,0.14)", borderColor: "rgba(201,151,31,0.5)", color: "#e8c468" }
                    : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.1)", color: "#e5e7eb", cursor: onlyOption ? "default" : "pointer" }
                }
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {dismissalType === "runOut" && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Runs Completed Before Run Out</span>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRunsCompleted(n)}
                className="flex-1 py-2 rounded-lg text-sm font-bold font-archivo border"
                style={runsCompleted === n ? { background: "rgba(239,68,68,0.14)", borderColor: "rgba(248,113,113,0.5)", color: "#f87171" } : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.1)", color: "#e5e7eb" }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Fielder (if any)</span>
        <input
          value={fielder}
          onChange={(e) => setFielder(e.target.value)}
          placeholder="Fielder name"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-white/10 text-on-surface placeholder:text-on-surface-variant"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-full font-mono-geist text-[11px] font-black uppercase tracking-wide bg-white/[0.02] border border-white/10 text-on-surface"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onResolve(batsmanOut, dismissalType, fielder, runsCompleted)}
          className="flex-1 py-2.5 rounded-full font-mono-geist text-[11px] font-black uppercase tracking-wide"
          style={{ background: "#ef4444", color: "#fff" }}
        >
          Fire Wicket Graphic
        </button>
      </div>
    </CenteredOverlay>
  );
}

function PenaltyDialog({ battingTeamLabel, bowlingTeamLabel, onConfirm, onClose }) {
  const [team, setTeam] = useState("batting");
  const [description, setDescription] = useState("");

  return (
    <CenteredOverlay open onClose={onClose} title="Add Penalty" icon="gavel" iconColor="#fca5a5">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Award +5 To</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTeam("batting")}
            className="px-3 py-2.5 rounded-lg text-left text-[11.5px] font-archivo font-bold border transition-all"
            style={
              team === "batting"
                ? { background: "rgba(201,151,31,0.14)", borderColor: "rgba(201,151,31,0.5)", color: "#e8c468" }
                : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.1)", color: "#e5e7eb" }
            }
          >
            {battingTeamLabel}
            <span className="block font-mono-geist text-[8.5px] font-normal uppercase tracking-wide opacity-70 mt-0.5">Batting</span>
          </button>
          <button
            type="button"
            onClick={() => setTeam("bowling")}
            className="px-3 py-2.5 rounded-lg text-left text-[11.5px] font-archivo font-bold border transition-all"
            style={
              team === "bowling"
                ? { background: "rgba(201,151,31,0.14)", borderColor: "rgba(201,151,31,0.5)", color: "#e8c468" }
                : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.1)", color: "#e5e7eb" }
            }
          >
            {bowlingTeamLabel}
            <span className="block font-mono-geist text-[8.5px] font-normal uppercase tracking-wide opacity-70 mt-0.5">Bowling</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Description (optional)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="e.g. Fielder encroached on the pitch"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-white/10 text-on-surface placeholder:text-on-surface-variant resize-none"
        />
      </div>

      <button
        type="button"
        onClick={() => onConfirm(team, description)}
        className="w-full py-2.5 rounded-full font-mono-geist text-[11px] font-black uppercase tracking-wide"
        style={{ background: "#ef4444", color: "#fff" }}
      >
        Add +5 Penalty
      </button>
    </CenteredOverlay>
  );
}

function MatchOverScreen({ winningTeamName, winningTeamLogo, margin, method, canUndo, onUndo, onRestart }) {
  const isTie = method === "tie";
  return (
    <div className="relative overflow-hidden flex w-full box-border flex-col items-center text-center gap-1 py-14 px-6 sm:px-12 rounded-[22px] border border-theme-orange/25" style={{ background: "radial-gradient(120% 100% at 50% 0%, rgba(201,151,31,0.14) 0%, rgba(201,151,31,0.03) 45%, transparent 70%)" }}>
      <span className="relative z-10 flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-[0.2em] font-mono-geist text-theme-orange mb-5">
        <Icon name="emoji_events" style={{ fontSize: 14 }} />
        Match Complete
      </span>
      <div className="relative z-10 w-24 h-24 sm:w-[104px] sm:h-[104px] rounded-full flex items-center justify-center bg-black/60 border-[3px] border-theme-orange/50 overflow-hidden mb-5">
        {winningTeamLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={winningTeamLogo} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="flex items-center justify-center text-theme-orange text-3xl">{isTie ? "🤝" : <Icon name="emoji_events" style={{ fontSize: 36 }} />}</span>
        )}
      </div>
      <h2 className="relative z-10 font-archivo text-[19px] sm:text-[26px] font-black uppercase text-white m-0">
        {isTie ? "It's a Tie" : winningTeamName ? `${winningTeamName} Win` : "Match Complete"}
      </h2>
      {!isTie && margin && (
        <p className="relative z-10 font-mono-geist text-[11px] sm:text-[12.5px] font-bold uppercase tracking-wide text-theme-orange mt-3.5 px-4 py-1.5 rounded-full bg-theme-orange/10 border border-theme-orange/30 inline-block">
          {margin}
        </p>
      )}
      <div className="relative z-10 flex gap-2.5 mt-6 flex-wrap justify-center">
        {canUndo && (
          <button type="button" onClick={onUndo} className="flex items-center gap-1.5 font-mono-geist text-[11px] font-black uppercase tracking-wide rounded-lg px-5 py-2.5 border border-red-400/35 bg-red-500/10 text-red-400 hover:bg-red-500/15 transition-all">
            <Icon name="undo" style={{ fontSize: 14 }} /> Undo &amp; Keep Scoring
          </button>
        )}
        {onRestart && (
          <button type="button" onClick={onRestart} className="flex items-center gap-1.5 font-mono-geist text-[11px] font-black uppercase tracking-wide rounded-lg px-5 py-2.5 bg-theme-orange text-black transition-all">
            <Icon name="restart_alt" style={{ fontSize: 14 }} /> Restart Match
          </button>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── main component ───────────────────────── */
export default function ScoringSection({
  mobileTab,
  matchId,
  matchSetup,
  battingTeamKey,
  bowlingTeamKey,
  battingSquad,
  bowlingSquad,
  maxOvers,
  liveState,
  setLiveState,
  liveDirty,
  setLiveDirty,
  onPush,
  pushLabel,
  onBoundary,
  onMilestone,
  onWicketConfirm,
  onMaiden,
  onInningsEnd,
  onMatchComplete,
  onRestartMatch,
  onEngineStateChange,
  initialEngineState,
  onAdminAction,
  onDismissedPlayersChange,
}) {
  const battingTeamLabel = matchSetup[battingTeamKey];
  const bowlingTeamLabel = matchSetup[bowlingTeamKey];

  const engine = useLiveScoringEngine({
    matchId,
    liveState,
    setLiveState,
    setLiveDirty,
    maxOvers,
    battingTeamName: battingTeamLabel,
    bowlingTeamName: bowlingTeamLabel,
    battingSquad,
    onBoundary,
    onMilestone,
    onWicketConfirm,
    onMaiden,
    onInningsEnd,
    onMatchComplete,
    onEngineStateChange,
    initialEngineState,
  });

  const [playerPicker, setPlayerPicker] = useState(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showBowlerChangePrompt, setShowBowlerChangePrompt] = useState(false);
  const [showPenaltyDialog, setShowPenaltyDialog] = useState(false);

  const prevOversRef = useRef(liveState.score.overs);
  useEffect(() => {
    const prevOvers = prevOversRef.current;
    if (
      prevOvers !== undefined &&
      liveState.score.overs > prevOvers &&
      liveState.score.balls === 0 &&
      !liveState.matchComplete
    ) {
      setShowBowlerChangePrompt(true);
    }
    prevOversRef.current = liveState.score.overs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveState.score.overs, liveState.score.balls]);

  useEffect(() => {
    onDismissedPlayersChange?.(engine.dismissedPlayers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.dismissedPlayers]);

  const battingRoleMap = useMemo(() => {
    const m = new Map();
    if (liveState.striker.name) m.set(liveState.striker.name, { role: "striker" });
    if (liveState.nonStriker.name) m.set(liveState.nonStriker.name, { role: "nonStriker" });
    return m;
  }, [liveState.striker.name, liveState.nonStriker.name]);
  const bowlingRoleMap = useMemo(() => {
    const m = new Map();
    if (liveState.bowler.name) m.set(liveState.bowler.name, { role: "bowler" });
    return m;
  }, [liveState.bowler.name]);

  const isSecondInnings = (liveState.inningsNumber ?? 1) === 2;
  const overs = `${liveState.score.overs}.${liveState.score.balls}`;
  const rr = liveState.score.overs + liveState.score.balls / 6 > 0
    ? (liveState.score.runs / (liveState.score.overs + liveState.score.balls / 6)).toFixed(2)
    : "0.00";
  const ballsBowled = liveState.score.overs * 6 + liveState.score.balls;
  const totalBalls = maxOvers !== undefined ? maxOvers * 6 : undefined;
  const ballsLeft = totalBalls !== undefined ? Math.max(0, totalBalls - ballsBowled) : undefined;
  const runsNeeded = liveState.target !== undefined ? Math.max(0, liveState.target - liveState.score.runs) : undefined;
  const requiredRate = runsNeeded !== undefined && ballsLeft ? ((runsNeeded / ballsLeft) * 6).toFixed(2) : undefined;

  const strikerNeedsReplacement = engine.noPartnerAvailable && !liveState.striker.name;
  const nonStrikerNeedsReplacement = engine.noPartnerAvailable && !liveState.nonStriker.name;

  const thisOverDisplay = liveState.thisOver ?? [];

  const controlsLocked = engine.assignmentsMissing();
  const [localToasts, setLocalToasts] = useState([]);
  const localToastTimers = useRef(new Map());
  useEffect(() => {
    const timers = localToastTimers.current;
    return () => { timers.forEach(clearTimeout); timers.clear(); };
  }, []);
  function pushLocalToast(text, tone = "info") {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setLocalToasts((prev) => [...prev, { id, text, tone }]);
    const timer = setTimeout(() => {
      setLocalToasts((prev) => prev.filter((t) => t.id !== id));
      localToastTimers.current.delete(id);
    }, 3200);
    localToastTimers.current.set(id, timer);
  }
  function showAssignmentToast() {
    pushLocalToast("Pick a Striker, Non-Striker & Bowler first", "wicket");
  }

  function handlePenaltyConfirm(team, description) {
    const teamLabel = team === "batting" ? battingTeamLabel : bowlingTeamLabel;
    if (team === "batting") {
      engine.patchLive({ score: { ...liveState.score, runs: liveState.score.runs + 5 } });
    }
    onAdminAction?.("Penalty", { runs: 5, team, teamLabel, description });
    pushLocalToast(`⚖️ +5 Penalty — ${teamLabel}${description ? ` (${description})` : ""}`, "warning");
    setShowPenaltyDialog(false);
  }
  function handleTapRun(n) {
    if (controlsLocked) return showAssignmentToast();
    engine.recordBall(n);
  }
  function handleTapWicket() {
    if (controlsLocked) return showAssignmentToast();
    engine.recordWicket();
  }

  const EXTRA_TILE_META = {
    wide: { abbr: "WD", icon: "open_in_full" },
    noBall: { abbr: "NB", icon: "front_hand" },
    legBye: { abbr: "LB", icon: "directions_run" },
    bye: { abbr: "BY", icon: "directions_walk" },
  };
  const EXTRA_TILE_ORDER = ["wide", "noBall", "legBye", "bye"];
  const extraGridTiles = EXTRA_TILE_ORDER
    .map((key) => EXTRA_OPTIONS.find((o) => o.key === key))
    .filter(Boolean);
  const armedExtra = engine.extraType && engine.extraType !== "none"
    ? EXTRA_OPTIONS.find((o) => o.key === engine.extraType)
    : null;

  // Any armed extra blocks switching to a different one; the armed
  // tile itself still toggles off normally (re-tap to cancel).
  const extraArmed = engine.extraType !== "none";
  const isNoBallArmed = engine.extraType === "noBall";

  function handleTapExtra(key) {
    if (controlsLocked) return showAssignmentToast();
    if (extraArmed && engine.extraType !== key) return;
    engine.setExtraType(engine.extraType === key ? "none" : key);
    if (key === "noBall") engine.setNoBallRunOrigin("bat");
  }

  const statCards = [
    { label: "Partnership", value: `${liveState.partnership.runs} (${liveState.partnership.balls})` },
    { label: "Match 4s / 6s", value: `${liveState.matchBoundaries.fours} / ${liveState.matchBoundaries.sixes}` },
    { label: "Overs", value: overs },
    { label: "Bowler Figures", value: `${liveState.bowler.overs}.${liveState.bowler.balls}-${liveState.bowler.maidens}-${liveState.bowler.runs}-${liveState.bowler.wickets}` },
  ];
  if (isSecondInnings && liveState.target !== undefined) {
    statCards.splice(2, 0, { label: "Target", value: `${liveState.target}` });
  }

  return (
    <section
      className={`order-1 lg:order-2 flex-col lg:h-full min-h-0 px-4 pt-4 sm:px-3 sm:pt-3 lg:p-4 gap-2.5 sm:gap-4
        ${mobileTab === "scoring" ? "flex fixed inset-0 overflow-hidden pb-[calc(80px+env(safe-area-inset-bottom))]" : "hidden"}
        lg:flex lg:static lg:h-full lg:overflow-hidden lg:pb-4`}
    >
      {typeof document !== "undefined" && createPortal(
        <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-[9999] flex flex-col-reverse gap-2 items-end pointer-events-none max-w-[calc(100vw-2rem)] sm:max-w-xs">
          {[...engine.toasts, ...localToasts].map((t) => (
            <div
              key={t.id}
              className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg font-mono-geist text-[10.5px] font-bold leading-relaxed max-w-full glass-panel"
              style={{
                borderColor: t.tone === "wicket" ? "rgba(248,113,113,0.35)" : t.tone === "milestone" ? "rgba(201,151,31,0.4)" : "rgba(255,255,255,0.12)",
                color: t.tone === "wicket" ? "#f87171" : t.tone === "milestone" ? "#e8c468" : "rgba(255,255,255,0.75)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}
            >
              <Icon name={t.tone === "wicket" ? "sports_cricket" : "bolt"} style={{ fontSize: 14, marginTop: 1 }} />
              <span className="min-w-0">{t.text}</span>
            </div>
          ))}
        </div>,
        document.body
      )}

      {engine.pendingWicket && (
        <WicketDetailDialog pending={engine.pendingWicket} onResolve={engine.resolveWicket} onCancel={engine.cancelWicket} />
      )}

      {playerPicker && (
        <PlayerPickerSheet
          title={playerPicker === "striker" ? "Select Striker" : playerPicker === "nonStriker" ? "Select Non-Striker" : "Select Bowler"}
          teamLabel={playerPicker === "bowler" ? bowlingTeamLabel : battingTeamLabel}
          players={playerPicker === "bowler" ? bowlingSquad : battingSquad}
          onSelect={(p) => engine.assignPlayer(playerPicker, p)}
          onClose={() => setPlayerPicker(null)}
          dismissedNames={playerPicker === "bowler" ? undefined : engine.dismissedPlayers}
          roleByName={playerPicker === "bowler" ? bowlingRoleMap : battingRoleMap}
        />
      )}

      <CenteredOverlay open={showEndConfirm} onClose={() => setShowEndConfirm(false)} title={isSecondInnings ? "End Match?" : "End Innings?"} icon="sports_score" iconColor="#f87171">
        <p className="text-[12px] text-on-surface">
          {isSecondInnings
            ? "This marks the match complete, computes the result, and locks scoring. You can still Undo afterwards."
            : `This sets the target to ${liveState.score.runs + 1} and resets the score/overs/crew for Innings 2. You can Undo afterwards.`}
        </p>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => setShowEndConfirm(false)} className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-mono-geist bg-white/[0.02] border border-white/10 text-on-surface">Cancel</button>
          <button type="button" onClick={() => { engine.endInnings(); setShowEndConfirm(false); }} className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-mono-geist bg-red-500 text-white">
            {isSecondInnings ? "End Match" : "End Innings"}
          </button>
        </div>
      </CenteredOverlay>

      {showPenaltyDialog && (
        <PenaltyDialog
          battingTeamLabel={battingTeamLabel}
          bowlingTeamLabel={bowlingTeamLabel}
          onConfirm={handlePenaltyConfirm}
          onClose={() => setShowPenaltyDialog(false)}
        />
      )}

      <CenteredOverlay open={showRestartConfirm} onClose={() => setShowRestartConfirm(false)} title="Restart Match?" icon="restart_alt" iconColor="#e8c468">
        <p className="text-[12px] text-on-surface">Starts a fresh match with the same teams/squads. Score, overs, crew, and result reset. This can&apos;t be undone.</p>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => setShowRestartConfirm(false)} className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-mono-geist bg-white/[0.02] border border-white/10 text-on-surface">Cancel</button>
          <button type="button" onClick={() => { engine.resetEngineState(); onRestartMatch?.(); setShowRestartConfirm(false); }} className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-mono-geist bg-theme-orange text-black">Restart Match</button>
        </div>
      </CenteredOverlay>

      <CenteredOverlay open={showBowlerChangePrompt} onClose={() => setShowBowlerChangePrompt(false)} title="Over Complete" icon="autorenew" iconColor="#818cf8">
        <p className="text-[12px] text-on-surface">
          {liveState.bowler.name ? `${liveState.bowler.name} has finished the over.` : "The over is complete."} Continue with the same bowler, or pick a new one for the next over.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => setShowBowlerChangePrompt(false)}
            className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-mono-geist bg-white/[0.02] border border-white/10 text-on-surface"
          >
            Continue{liveState.bowler.name ? ` ${liveState.bowler.name}` : ""}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowBowlerChangePrompt(false);
              engine.clearSlot("bowler");
              engine.setActiveSlot("bowler");
              setPlayerPicker("bowler");
            }}
            className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-mono-geist bg-theme-orange text-black"
          >
            Change Bowler
          </button>
        </div>
      </CenteredOverlay>

      {liveState.matchComplete ? (
        <MatchOverScreen
          winningTeamName={liveState.matchResult?.winningTeamName}
          winningTeamLogo={undefined}
          margin={liveState.matchResult?.margin}
          method={liveState.matchResult?.method}
          canUndo={engine.canUndo}
          onUndo={engine.undo}
          onRestart={onRestartMatch ? () => setShowRestartConfirm(true) : undefined}
        />
      ) : (
        <>
          {engine.noPartnerAvailable && (
            <div className="flex items-center gap-3 p-3 rounded-xl mb-1 shrink-0" style={{ background: "rgba(201,151,31,0.08)", border: "1px solid rgba(201,151,31,0.3)" }}>
              <Icon name="warning" style={{ fontSize: 18, color: "#e8c468" }} />
              <div className="flex-1 min-w-0">
                <p className="font-archivo text-[11px] font-bold uppercase text-on-surface">Last Man Batting</p>
                <p className="font-mono-geist text-[9.5px] text-on-surface-variant">No replacement left — wrap up whenever ready.</p>
              </div>
              <button type="button" onClick={() => setShowEndConfirm(true)} className="font-mono-geist text-[10px] font-black uppercase px-3 py-2 rounded-lg bg-theme-orange text-black shrink-0">
                {isSecondInnings ? "End Match" : "End Innings"}
              </button>
            </div>
          )}

          <div
            className="relative overflow-hidden shrink-0 rounded-2xl border border-white/10 bg-white/[0.035] px-3 sm:px-4 pt-3 sm:pt-4 pb-2.5 sm:pb-3 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
            style={{ containerType: "inline-size" }}
          >
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: GOLD_GRADIENT, opacity: 0.6 }} />
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-theme-orange/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2 relative z-10">
              <div className="flex items-baseline gap-2 sm:gap-3 min-w-0 flex-1">
                <span className="font-archivo text-6xl font-bold tabular-nums shrink-0">{liveState.score.runs}/{liveState.score.wickets}</span>
                <span className="font-mono-geist text-[8px] sm:text-[11px] text-on-surface-variant uppercase tracking-[0.1em] truncate">
                  {overs} overs · RR {rr} · {battingTeamLabel} batting{isSecondInnings ? " · Inns 2" : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={onPush}
                className="flex items-center gap-1.5 font-mono-geist text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded transition-all hover:brightness-110 active:scale-95 shrink-0"
                style={{ background: liveDirty ? GOLD_GRADIENT : "rgba(255,255,255,0.05)", color: liveDirty ? "#1a1304" : "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <Icon name="cloud_upload" style={{ fontSize: 13 }} />
                <span className="hidden sm:inline">{pushLabel}</span>
              </button>
            </div>

            {isSecondInnings && liveState.target !== undefined && (
              <p className="font-mono-geist text-[9px] sm:text-[11px] text-theme-orange uppercase tracking-[0.1em] mb-1.5 sm:mb-3 relative z-10">
                Target {liveState.target} · Need {runsNeeded} off {ballsLeft ?? "—"} balls{requiredRate ? ` · RRR ${requiredRate}` : ""}
              </p>
            )}

            <div className="mb-1.5 sm:mb-3 relative z-10">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                <CrewSlot
                  compact
                  title="Striker *"
                  accentColor="#e8c468"
                  active={engine.activeSlot === "striker"}
                  onActivate={() => { engine.setActiveSlot("striker"); setPlayerPicker("striker"); }}
                  displayName={liveState.striker.name}
                  imageUrl={liveState.striker.imageUrl}
                  statLine={liveState.striker.name ? `${liveState.striker.runs} (${liveState.striker.balls}) · 4s ${liveState.striker.fours} · 6s ${liveState.striker.sixes}` : undefined}
                  allPlayers={battingSquad}
                  onAssign={(p) => engine.assignPlayer("striker", p)}
                  onClear={() => engine.clearSlot("striker")}
                  placeholder="Select striker"
                  dismissedNames={engine.dismissedPlayers}
                  blockedName={liveState.nonStriker.name || undefined}
                  noReplacement={strikerNeedsReplacement}
                />
                <CrewSlot
                  compact
                  title="Non-Striker"
                  active={engine.activeSlot === "nonStriker"}
                  onActivate={() => { engine.setActiveSlot("nonStriker"); setPlayerPicker("nonStriker"); }}
                  displayName={liveState.nonStriker.name}
                  imageUrl={liveState.nonStriker.imageUrl}
                  statLine={liveState.nonStriker.name ? `${liveState.nonStriker.runs} (${liveState.nonStriker.balls}) · 4s ${liveState.nonStriker.fours} · 6s ${liveState.nonStriker.sixes}` : undefined}
                  allPlayers={battingSquad}
                  onAssign={(p) => engine.assignPlayer("nonStriker", p)}
                  onClear={() => engine.clearSlot("nonStriker")}
                  placeholder="Select non-striker"
                  dismissedNames={engine.dismissedPlayers}
                  blockedName={liveState.striker.name || undefined}
                  noReplacement={nonStrikerNeedsReplacement}
                />
                <div className="col-span-2 lg:col-span-1">
                  <CrewSlot
                    compact
                    title="Bowler"
                    accentColor="#818cf8"
                    active={engine.activeSlot === "bowler"}
                    onActivate={() => { engine.setActiveSlot("bowler"); setPlayerPicker("bowler"); }}
                    displayName={liveState.bowler.name}
                    imageUrl={liveState.bowler.imageUrl}
                    statLine={liveState.bowler.name ? `${liveState.bowler.overs}.${liveState.bowler.balls}-${liveState.bowler.maidens}-${liveState.bowler.runs}-${liveState.bowler.wickets}` : undefined}
                    allPlayers={bowlingSquad}
                    onAssign={(p) => engine.assignPlayer("bowler", p)}
                    placeholder="Pick from roster ◂"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap mb-1.5 sm:mb-5 relative z-10">
              <button type="button" onClick={engine.swapStrike} className="flex items-center gap-1.5 font-mono-geist text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-theme-orange border border-theme-orange/20">
                <Icon name="swap_horiz" style={{ fontSize: 13 }} /> Rotate Strike
              </button>
              <div className="flex flex-col gap-1.5 relative z-10">
                <button
                  type="button"
                  onClick={() => engine.setIsFreeHit((v) => !v)}
                  className="flex items-center gap-1.5 font-mono-geist text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded border transition-all"
                  style={
                    engine.isFreeHit
                      ? {
                          color: "#38bdf8",
                          borderColor: "rgba(56,189,248,0.4)",
                          background: "rgba(56,189,248,0.12)",
                        }
                      : {
                          color: "#c9971f",
                          borderColor: "rgba(201,151,31,0.2)",
                          background: "transparent",
                        }
                  }
                >
                  <Icon name="flash_on" style={{ fontSize: 13 }} />
                  Free Hit {engine.isFreeHit ? "· Active" : ""}
                </button>
              </div>
              {!engine.noPartnerAvailable && (
                <button type="button" onClick={() => setShowEndConfirm(true)} className="flex items-center gap-1.5 font-mono-geist text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-red-400 border border-red-400/25 ml-auto">
                  <Icon name="sports_score" style={{ fontSize: 13 }} /> {isSecondInnings ? "End Match" : "End Innings"}
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col gap-2 sm:gap-3 relative z-10 overflow-hidden">
            {armedExtra && (
              <div className="flex flex-col gap-2 shrink-0">
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(96,165,250,0.4)" }}>
                  <span className="font-mono-geist text-[9.5px] font-bold uppercase tracking-[0.12em] text-sky-300 flex items-center gap-1.5 min-w-0">
                    <Icon name="bolt" style={{ fontSize: 13 }} className="shrink-0" />
                    <span className="truncate">{armedExtra.label} armed — tap a run to record</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => { engine.setExtraType("none"); engine.setNoBallRunOrigin("bat"); }}
                    className="font-mono-geist text-[9px] font-bold uppercase px-2 py-1 rounded text-sky-300 border border-sky-400/30 hover:bg-sky-400/10 shrink-0"
                  >
                    Cancel
                  </button>
                </div>

                {/* NEW — No Ball can combine with runs off the bat, OR
                    with byes, OR with leg byes (Law 21 + Law 26 both
                    apply to the same delivery). This selector is only
                    shown while No Ball is armed; it resets to "Off Bat"
                    whenever No Ball is armed/disarmed or a ball is
                    recorded. */}
                {isNoBallArmed && (
                  <div className="flex items-center gap-1.5 px-1">
                    {NO_BALL_RUN_ORIGIN_OPTIONS.map((opt) => {
                      const active = engine.noBallRunOrigin === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => engine.setNoBallRunOrigin(opt.key)}
                          className="flex-1 py-1.5 rounded-lg font-mono-geist text-[9.5px] font-bold uppercase tracking-[0.08em] border transition-all"
                          style={
                            active
                              ? { background: "rgba(56,189,248,0.18)", borderColor: "rgba(56,189,248,0.5)", color: "#7dd3fc" }
                              : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.1)", color: "#93c5fd" }
                          }
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2 flex-1 min-h-0" style={{ gridAutoRows: "1fr", containerType: "size" }}>
              {[0, 1, 2, 3, 4, 6].map((n) => (
                <button
                  type="button"
                  key={`run-${n}`}
                  onClick={() => handleTapRun(n)}
                  className="h-full w-full rounded-lg font-archivo font-bold transition-all hover:brightness-110 active:scale-95 border border-white/10"
                  style={{ fontSize: "clamp(1.1rem, min(9cqh, 12cqi), 3rem)", ...(n === 4 || n === 6 ? { background: GOLD_GRADIENT, color: "#1a1304", border: "1px solid rgba(255,255,255,0.1)" } : { background: "rgba(255,255,255,0.03)" }) }}
                >
                  {n}
                </button>
              ))}

              {extraGridTiles.map((opt) => {
                const meta = EXTRA_TILE_META[opt.key];
                const active = engine.extraType === opt.key;
                const tileDisabled = extraArmed && !active;
                return (
                  <button
                    type="button"
                    key={`extra-${opt.key}`}
                    onClick={() => handleTapExtra(opt.key)}
                    disabled={tileDisabled}
                    className="h-full w-full rounded-lg font-archivo font-bold transition-all hover:brightness-110 active:scale-95 border flex flex-col items-center justify-center gap-0.5 disabled:opacity-35 disabled:cursor-not-allowed"
                    style={active
                      ? { background: "linear-gradient(135deg,#3b82f6,#1e3a8a)", borderColor: "rgba(147,197,253,0.6)", color: "#fff", boxShadow: "0 0 0 2px rgba(96,165,250,0.25) inset" }
                      : { background: "rgba(59,130,246,0.08)", borderColor: "rgba(96,165,250,0.25)", color: "#93c5fd" }}
                  >
                    <Icon name={meta.icon} style={{ fontSize: "clamp(0.9rem, min(6cqh, 7cqi), 1.6rem)" }} />
                    <span className="font-mono-geist" style={{ fontSize: "clamp(0.65rem, min(4cqh, 5cqi), 0.95rem)", letterSpacing: "0.06em" }}>{meta.abbr}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleTapWicket}
                className="h-full w-full rounded-lg font-mono-geist font-bold uppercase tracking-[0.12em] transition-all hover:brightness-110 active:scale-95 bg-error-container text-on-error-container border border-white/10 disabled:opacity-35 disabled:cursor-not-allowed"
                style={{ fontSize: "clamp(0.75rem, min(5cqh, 6cqi), 1.5rem)" }}
              >
                Out
              </button>

              <button
                type="button"
                onClick={() => engine.canUndo && engine.undo()}
                disabled={!engine.canUndo || extraArmed}
                className="h-full w-full rounded-lg font-mono-geist font-bold uppercase tracking-[0.1em] transition-all hover:brightness-110 active:scale-95 border disabled:opacity-35 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-0.5"
                style={{ color: "#fbbf24", borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.1)" }}
              >
                <Icon name="undo" style={{ fontSize: "clamp(0.9rem, min(6cqh, 7cqi), 1.6rem)" }} />
                <span style={{ fontSize: "clamp(0.6rem, min(3.6cqh, 4.5cqi), 0.85rem)" }}>Undo</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 sm:py-3 glass-panel shrink-0 min-w-0">
              <span className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.14em] font-bold shrink-0">This Over</span>
              <div className="flex items-center gap-1.5 overflow-x-auto min-w-0">
                {Array.from({ length: Math.max(6, thisOverDisplay.length) }, (_, i) => (
                  <OverBall key={i} entry={i < thisOverDisplay.length ? normalizeOverEntry(thisOverDisplay[i]) : null} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 sm:[grid-template-columns:repeat(auto-fit,minmax(120px,1fr))] gap-2 sm:gap-3 shrink-0">
              {statCards.map((s) => (
                <div key={s.label} className="rounded-xl px-2 sm:px-4 py-2 sm:py-3 glass-panel">
                  <p className="font-mono-geist text-[8.5px] sm:text-[9px] text-on-surface-variant uppercase tracking-[0.16em] font-bold mb-0.5 sm:mb-1">{s.label}</p>
                  <p className="font-archivo text-base sm:text-lg font-bold tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}