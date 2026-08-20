"use client";

import { useState, useEffect, useRef } from "react";
import CricketBall from "@/components/overlays/shared/CricketBall"

const GOLD_GRADIENT = "linear-gradient(135deg,#A87815,#E8C468)";

function initials(name) {
  return (name || "").split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "—";
}
function Icon({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

/* ── This Over ball styling ────────────────────────────────────────
   Maps a single delivery's outcome to a CricketBall fill + label so
   the strip actually reads as "what happened this over" instead of
   six identical balls numbered 1–6. Extend the color map or
   ballOutcome() mapping if the real delivery-history shape differs. */
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

// entry: number (runs off the bat, 0–6) or short outcome string
// ("W" | "Wd" | "Nb" | "Lb" | "By"). This must match the codes
// actually pushed into `currentOverBalls` by the parent's record().
function ballOutcome(entry) {
  if (entry === "W" || entry === "Out") return { kind: "wicket", label: "W" };
  if (entry === "Wd") return { kind: "extra", label: "wd" };
  if (entry === "Nb") return { kind: "extra", label: "nb" };
  if (entry === "Lb") return { kind: "extra", label: "lb" };
  if (entry === "By") return { kind: "extra", label: "b" };
  if (entry === 4 || entry === 6) return { kind: "boundary", label: String(entry) };
  if (entry === 0) return { kind: "dot", label: "0" };
  return { kind: "dot", label: String(entry ?? "") };
}

// One slot in the This Over strip. `entry == null` means the ball
// hasn't been bowled yet — render a faint dashed placeholder instead
// of a real (misleadingly styled) ball.
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
  return (
    <CricketBall size={20} fill={style.fill} seamColor={style.seamColor}>
      <span style={{ fontSize: 9, fontWeight: 700, color: style.textColor, lineHeight: 1 }}>{label}</span>
    </CricketBall>
  );
}

/* ── mobile bottom sheet: tap a roster name to fill the active slot ── */
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
          <p className="font-mono-geist text-[10px] text-on-surface-variant text-center py-6">No squad loaded — set this team's squad in Match Setup.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {players.map((name) => {
              const isOut = !!dismissedNames?.has(name);
              const roleInfo = roleByName?.get(name);
              const isLocked = isOut || !!roleInfo;
              const roleLabel = roleInfo?.role === "striker" ? "On Strike" : roleInfo?.role === "nonStriker" ? "Non-Striker" : roleInfo?.role === "bowler" ? "Bowling" : undefined;
              return (
                <button
                  type="button"
                  key={name}
                  disabled={isLocked}
                  onClick={() => { if (isLocked) return; onSelect(name); onClose(); }}
                  className="flex flex-col items-center gap-1.5 px-1.5 py-3 rounded-xl border transition-colors"
                  style={
                    isOut
                      ? { opacity: 0.55, background: "rgba(239,68,68,0.07)", borderColor: "rgba(248,113,113,0.4)" }
                      : isLocked
                      ? { opacity: 0.7, background: "rgba(34,197,94,0.07)", borderColor: "rgba(74,222,128,0.4)" }
                      : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)" }
                  }
                >
                  <span className="w-11 h-11 rounded-full flex items-center justify-center font-mono-geist text-[12px] font-bold" style={{ border: "1px solid rgba(255,255,255,0.15)", color: isOut ? "#f87171" : isLocked ? "#4ade80" : "#e5e7eb" }}>
                    {initials(name)}
                  </span>
                  <span className="text-[9.5px] font-archivo font-bold text-center leading-tight break-words" style={{ color: isOut ? "#f87171" : isLocked ? "#4ade80" : "#e5e7eb" }}>
                    {name}{isOut ? " · OUT" : roleLabel ? ` · ${roleLabel}` : ""}
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

/* ── the slot itself: shows the current player, doubles as a drop target,
     opens the mobile picker (desktop dragging happens against this
     element via onDragOver/onDrop). `compact` shrinks it for the
     no-scroll mobile layout. ── */
function CrewSlot({
  title, accentColor, active, onActivate, displayName, statLine,
  onAssign, onClear, placeholder, dismissedNames, blockedName,
  noReplacement, avatarSize, compact,
}) {
  const size = avatarSize ?? (compact ? 32 : 44);
  const isEmpty = !displayName;

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
      onClick={onActivate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onActivate(); }}
      className={`rounded-xl cursor-pointer transition-all ${compact ? "p-2" : "p-3"}`}
      style={{
        border: `1px ${isEmpty ? "dashed" : "solid"} ${isEmpty ? "rgba(239,68,68,0.4)" : active ? "rgba(201,151,31,0.45)" : "rgba(255,255,255,0.1)"}`,
        background: isEmpty ? "rgba(239,68,68,0.08)" : active ? "rgba(201,151,31,0.08)" : "rgba(255,255,255,0.02)",
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const name = e.dataTransfer.getData("text/player-name");
        if (!name) return;
        if (dismissedNames?.has(name)) return;
        if (blockedName && name === blockedName) return;
        onAssign(name);
      }}
    >
      <div className={`flex items-center justify-between gap-2 ${compact ? "mb-1" : "mb-2"}`}>
        <span className="font-mono-geist text-[9px] uppercase tracking-[0.14em] font-bold truncate" style={{ color: isEmpty ? "#f87171" : accentColor || "rgba(255,255,255,0.4)" }}>
          {isEmpty ? "⚠ " : ""}{title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {active && <span className="font-mono-geist text-[8.5px] text-theme-orange/70 hidden lg:inline">drag or tap ▾</span>}
          {!isEmpty && onClear && (
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
        <span className="rounded-full flex items-center justify-center shrink-0 font-mono-geist font-bold" style={{ width: size, height: size, border: "1px solid rgba(255,255,255,0.15)", fontSize: Math.max(9, size * 0.26), color: isEmpty ? "#f87171" : "#e5e7eb" }}>
          {displayName ? initials(displayName) : "+"}
        </span>
        <div className="flex flex-col min-w-0">
          <span className={`font-archivo font-bold truncate text-on-surface ${compact ? "text-[11px]" : "text-[12px]"}`}>{displayName || placeholder}</span>
          {statLine && !compact && <span className="text-[10px] font-mono-geist text-on-surface-variant">{statLine}</span>}
        </div>
      </div>
    </div>
  );
}

/* ── admin/rare actions live behind this popover instead of sitting in
     the main pad at the same visual weight as scoring buttons.
     Each item now maps to a real handler instead of being funneled
     through handleRun(string) — that was the source of the
     teamRuns-becomes-a-string bug. "By" (not "Bye") matches the
     `extras` state key and ballOutcome() everywhere else. ── */
function MoreActionsMenu({ onExtra, onFreeHit, onAdminAction }) {
  const [open, setOpen] = useState(false);
  const items = [
    { key: "By", label: "Bye", color: "#93c5fd", action: () => onExtra("By") },
    { key: "FreeHit", label: "Free Hit", color: "#c4b5fd", action: onFreeHit },
    { key: "Bonus", label: "Bonus", color: "#86efac", action: () => onAdminAction("Bonus") },
    { key: "Injured", label: "Injured", color: "#fdba74", action: () => onAdminAction("Injured") },
    { key: "Abandon", label: "Abandon", color: "#fecaca", action: () => onAdminAction("Abandon") },
  ];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className="h-full w-full rounded-lg font-mono-geist font-bold uppercase tracking-[0.12em] transition-all hover:brightness-110 active:scale-95 border flex items-center justify-center gap-1"
        style={{ fontSize: "clamp(0.75rem, min(5cqh, 6cqi), 1.5rem)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.12)" }}
      >
        More <Icon name={open ? "expand_less" : "expand_more"} style={{ fontSize: "1.1em" }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[199]" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 mb-2 z-[200] w-40 rounded-xl border border-white/10 bg-surface-container-lowest p-1.5 shadow-xl">
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
        </>
      )}
    </div>
  );
}

/**
 * Center "Live State" scorer card — score header, target line, the
 * Striker/Non-Striker/Bowler crew slots (+ mobile picker sheet), strike
 * rotation / end-innings / undo controls, extras, the run pad, and the
 * partnership/boundary stat strip underneath.
 *
 * Scoring contract with the parent (IMPORTANT — this was the source of
 * the earlier bugs):
 *  - `handleRun(n)` is called ONLY with a number: 0, 1, 2, 3, 4, or 6
 *    (runs off the bat). Never a string.
 *  - `onExtra(code)` is called with one of "Wd" | "Nb" | "Lb" | "By" for
 *    the extras buttons and the Bye admin action.
 *  - `onUndo()` reverts the last ball using the parent's real history
 *    stack (NOT routed through handleRun).
 *  - `onFreeHit()` arms a free hit (parent owns the `freeHit` flag).
 *  - `onAdminAction(label)` is a catch-all for the low-frequency,
 *    not-yet-modeled admin events (Bonus / Injured / Abandon) — the
 *    parent currently just logs these.
 *
 * `currentOverBalls` (This Over strip):
 *  - Owned by the parent (`overBalls` state). Can legitimately contain
 *    MORE than 6 entries mid-over, because wides/no-balls are appended
 *    to it without counting as legal deliveries. The strip below
 *    therefore renders `Math.max(6, currentOverBalls.length)` slots —
 *    always at least 6 (with dashed placeholders for balls not yet
 *    bowled), but growing to show every extra once an over runs long.
 *    The parent is responsible for resetting the array only once 6
 *    legal deliveries have actually been bowled.
 *
 * Layout notes:
 * - Mobile (`mobileTab === "scoring"`) is a fixed-height, non-scrolling
 *   column: `h-full overflow-hidden`, compact crew slots, and the rare
 *   admin actions (Free Hit / Bonus / Injured / Abandon) collapsed into
 *   a "More" popover instead of stacked as extra button rows.
 * - Desktop keeps the fuller layout but the same "More" popover, so the
 *   primary run pad isn't diluted by low-frequency admin buttons sitting
 *   at the same visual weight as the run/out/undo controls.
 * - Button label font-size is driven by `min(cqh, cqi)` rather than cqh
 *   alone, so text scales with whichever dimension (button height OR
 *   width) is actually the tighter constraint.
 *
 * All scoring state and mutators live in the parent and are passed down;
 * this component owns only the mobile player-picker sheet's open/close.
 */
export default function ScoringSection({
  mobileTab,
  teamRuns, wkts, overs, rr, matchSetup, battingTeam, inningsNumber,
  target, runsNeeded, ballsLeft, requiredRate,
  stamp,
  striker, nonStriker, bowler,
  setStriker, setNonStriker,
  activeSlot, setActiveSlot,
  playerPicker, setPlayerPicker,
  dismissedPlayers,
  battingRoster, bowlingRoster, bowlingTeam,
  assignBatter, assignBowler,
  freeHit, extras,
  handleRun, onExtra, onFreeHit, onAdminAction,
  handleOut, onUndo,
  endInnings, pushLiveState, livePushed, liveDirty,
  statCards,
  battingRoleMap, bowlingRoleMap,
  currentOverBalls,
}) {
  // ── Dynamic mobile height ────────────────────────────────────────
  const sectionRef = useRef(null);
  const [mobileHeight, setMobileHeight] = useState(null);

  const BOTTOM_NAV_PX = 72;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const recalc = () => {
      const isMobile = window.innerWidth < 1024; // matches Tailwind's `lg` breakpoint
      if (!isMobile) {
        setMobileHeight(null);
        return;
      }
      const el = sectionRef.current;
      if (!el) return;
      const viewportH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const top = el.getBoundingClientRect().top;
      const available = Math.max(360, viewportH - top - BOTTOM_NAV_PX);
      setMobileHeight(available);
    };
    recalc();
    window.addEventListener("resize", recalc);
    window.addEventListener("orientationchange", recalc);
    window.visualViewport?.addEventListener("resize", recalc);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("orientationchange", recalc);
      window.visualViewport?.removeEventListener("resize", recalc);
    };
  }, [mobileTab]);

  // Always show at least 6 slots (with dashed placeholders for balls
  // not yet bowled); grow past 6 when the array itself has more
  // entries — which happens whenever wides/no-balls are recorded
  // mid-over, since those don't count toward the 6 legal deliveries
  // that end an over.
  const overSlotCount = Math.max(6, currentOverBalls?.length ?? 0);

  return (
    <section
      ref={sectionRef}
      style={mobileHeight ? { height: `${mobileHeight}px` } : undefined}
      className={`order-1 lg:order-2 flex-col lg:h-full min-h-0 p-4 sm:p-3 lg:p-4 gap-2.5 sm:gap-4 custom-scrollbar
        ${mobileTab === "scoring" ? "flex overflow-hidden" : "hidden"}
        lg:flex lg:overflow-y-auto`}
    >
      {playerPicker && (
        <PlayerPickerSheet
          title={playerPicker === "striker" ? "Select Striker" : playerPicker === "nonStriker" ? "Select Non-Striker" : "Select Bowler"}
          teamLabel={playerPicker === "bowler" ? matchSetup[bowlingTeam] : matchSetup[battingTeam]}
          players={playerPicker === "bowler" ? bowlingRoster : battingRoster}
          onSelect={(name) => (playerPicker === "bowler" ? assignBowler(name) : assignBatter(playerPicker, name))}
          onClose={() => setPlayerPicker(null)}
          dismissedNames={playerPicker === "bowler" ? undefined : dismissedPlayers}
          roleByName={playerPicker === "bowler" ? bowlingRoleMap : battingRoleMap}
        />
      )}

      <div className="relative overflow-hidden shrink-0 rounded-2xl border border-white/10 bg-white/[0.035] px-3 sm:px-4 pt-3 sm:pt-4 pb-2.5 sm:pb-3 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: GOLD_GRADIENT, opacity: 0.6 }} />
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-theme-orange/5 blur-[100px] rounded-full pointer-events-none" />
        {stamp && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none px-4">
            {stamp.kind === "boundary" ? (
              <div className="cr-boundary-stamp"><div className="cr-stamp-face-gold"><span className="cr-stamp-word-gold">{stamp.label}</span><span className="cr-stamp-sub" style={{ color: "rgba(232,196,104,0.6)" }}>Moment Fired</span></div></div>
            ) : (
              <div className="cr-wicket-stamp"><div className="cr-stamp-face-grey"><span className="cr-stamp-word-grey">{stamp.label}</span><span className="cr-stamp-sub" style={{ color: "rgba(160,174,192,0.55)" }}>Wicket Falls</span></div></div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2 relative z-10">
          <div className="flex items-baseline gap-2 sm:gap-3 min-w-0 flex-1">
            <span className="font-archivo text-2xl sm:text-3xl lg:text-5xl font-bold tabular-nums shrink-0">{teamRuns}/{wkts}</span>
            <span className="font-mono-geist text-[8.5px] sm:text-[11px] text-on-surface-variant uppercase tracking-[0.1em] truncate">{overs} ov · RR {rr} · {matchSetup[battingTeam]} batting{inningsNumber === 2 ? " · Inns 2" : ""}</span>
          </div>
          <button
            type="button"
            onClick={pushLiveState}
            className="flex items-center gap-1.5 font-mono-geist text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 shrink-0"
            style={{ background: liveDirty ? GOLD_GRADIENT : "rgba(255,255,255,0.05)", color: liveDirty ? "#1a1304" : "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Icon name="cloud_upload" style={{ fontSize: 13 }} />
            <span className="hidden sm:inline">{livePushed ? "Pushed ✓" : "Push Live State"}</span>
            <span className="sm:hidden">{livePushed ? "✓" : "Push"}</span>
          </button>
        </div>

        {inningsNumber === 2 && target !== null && (
          <p className="font-mono-geist text-[9px] sm:text-[11px] text-theme-orange uppercase tracking-[0.1em] mb-1.5 sm:mb-3 relative z-10">
            Target {target} · Need {runsNeeded} off {ballsLeft ?? "—"} balls{requiredRate ? ` · RRR ${requiredRate}` : ""}
          </p>
        )}
        {inningsNumber === 1 && <div className="mb-1.5 sm:mb-3" />}

        <div className="mb-1.5 sm:mb-3 relative z-10">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            <CrewSlot
              compact
              title="Striker *"
              accentColor="#e8c468"
              active={activeSlot === "striker"}
              onActivate={() => { setActiveSlot("striker"); setPlayerPicker("striker"); }}
              displayName={striker.name}
              statLine={striker.name ? `${striker.runs} (${striker.balls}) · ${striker.fours}x4 ${striker.sixes}x6` : undefined}
              onAssign={(name) => assignBatter("striker", name)}
              onClear={() => setStriker((s) => ({ name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }))}
              placeholder="Select striker"
              dismissedNames={dismissedPlayers}
              blockedName={nonStriker.name || undefined}
            />
            <CrewSlot
              compact
              title="Non-Striker"
              active={activeSlot === "nonStriker"}
              onActivate={() => { setActiveSlot("nonStriker"); setPlayerPicker("nonStriker"); }}
              displayName={nonStriker.name}
              statLine={nonStriker.name ? `${nonStriker.runs} (${nonStriker.balls})` : undefined}
              onAssign={(name) => assignBatter("nonStriker", name)}
              onClear={() => setNonStriker((s) => ({ name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }))}
              placeholder="Select non-striker"
              dismissedNames={dismissedPlayers}
              blockedName={striker.name || undefined}
            />
            <div className="col-span-2 lg:col-span-1">
              <CrewSlot
                compact
                title="Bowler"
                accentColor="#818cf8"
                active={activeSlot === "bowler"}
                onActivate={() => { setActiveSlot("bowler"); setPlayerPicker("bowler"); }}
                displayName={bowler.name}
                statLine={bowler.name ? `${bowler.overs}.${bowler.balls}-${bowler.runs}-${bowler.wickets}` : undefined}
                onAssign={(name) => assignBowler(name)}
                placeholder="Pick from roster ◂"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-1.5 sm:mb-5 relative z-10">
          <button
            type="button"
            onClick={() => { const s = striker; setStriker(nonStriker); setNonStriker(s); }}
            className="flex items-center gap-1.5 font-mono-geist text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-theme-orange border border-theme-orange/20"
          >
            <Icon name="swap_horiz" style={{ fontSize: 13 }} /> Rotate Strike
          </button>
          {inningsNumber === 1 && (
            <button
              type="button"
              onClick={endInnings}
              className="flex items-center gap-1.5 font-mono-geist text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-theme-orange border border-theme-orange/20"
            >
              <Icon name="sports_score" style={{ fontSize: 13 }} /> End Innings
            </button>
          )}
        </div>

        <p className="font-mono-geist text-[8.5px] sm:text-[9px] text-on-surface-variant uppercase tracking-[0.14em] truncate mb-1.5 sm:mb-4 relative z-10">
          Extras — Wd {extras.Wd} · Nb {extras.Nb} · By {extras.By} · Lb {extras.Lb} · FH {extras.FreeHit ?? 0}
        </p>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-2 sm:gap-3 relative z-10">
        <div
          className="grid grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2 flex-1 min-h-0"
          style={{ gridAutoRows: "1fr", containerType: "size" }}
        >
          {[0, 1, 2, 3, 4, 6].map((n) => (
            <button
              type="button"
              key={`run-${n}`}
              onClick={() => handleRun(n)}
              className="h-full w-full rounded-lg font-archivo font-bold transition-all hover:brightness-110 active:scale-95 border border-white/10"
              style={{
                fontSize: "clamp(1.1rem, min(9cqh, 12cqi), 3rem)",
                ...(n === 4 || n === 6
                  ? { background: GOLD_GRADIENT, color: "#1a1304", border: "1px solid rgba(255,255,255,0.1)" }
                  : { background: "rgba(255,255,255,0.03)" }),
              }}
            >
              {n}
            </button>
          ))}

          <button
            type="button"
            onClick={handleOut}
            disabled={freeHit}
            className="h-full w-full rounded-lg font-mono-geist font-bold uppercase tracking-[0.12em] transition-all hover:brightness-110 active:scale-95 bg-error-container text-on-error-container border border-white/10 disabled:opacity-30"
            style={{ fontSize: "clamp(0.75rem, min(5cqh, 6cqi), 1.5rem)" }}
          >
            Out
          </button>
          <button
            type="button"
            onClick={onUndo}
            className="h-full w-full rounded-lg font-mono-geist font-bold uppercase tracking-[0.12em] transition-all hover:brightness-110 active:scale-95 border"
            style={{
              fontSize: "clamp(0.75rem, min(5cqh, 6cqi), 1.5rem)",
              background: "rgba(156,163,175,0.12)", color: "#d1d5db", border: "1px solid rgba(156,163,175,0.25)",
            }}
          >
            Undo
          </button>

          {[
            { label: "Wide", code: "Wd" },
            { label: "No Ball", code: "Nb" },
            { label: "LB", code: "Lb" },
          ].map(({ label, code }) => (
            <button
              type="button"
              key={code}
              onClick={() => onExtra(code)}
              className="h-full w-full rounded-lg font-archivo font-bold transition-all hover:brightness-110 active:scale-95 border"
              style={{
                fontSize: "clamp(0.75rem, min(5cqh, 6cqi), 1.5rem)",
                ...(code === "Wd" || code === "Nb"
                  ? { background: "rgba(245,158,11,0.18)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.35)" }
                  : { background: "rgba(59,130,246,0.15)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.35)" }),
              }}
            >
              {label}
            </button>
          ))}

          <MoreActionsMenu onExtra={onExtra} onFreeHit={onFreeHit} onAdminAction={onAdminAction} />
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 sm:py-3 glass-panel shrink-0 min-w-0">
          <span className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.14em] font-bold shrink-0">
            This Over
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto min-w-0">
            {Array.from({ length: overSlotCount }, (_, i) => (
              <OverBall key={i} entry={currentOverBalls?.[i]} />
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
    </section>
  );
}