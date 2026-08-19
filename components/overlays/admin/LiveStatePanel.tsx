// application/components/overlays/admin/LiveStatePanel.tsx
"use client";

import React, { useEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import type { LiveState, MatchSetup, SquadPlayer } from "@/lib/overlayBus";
import { DrawerSection, Eyebrow, FieldLabel, SmallButton, PrimaryButton, SegmentedControl } from "./ui";
import {
  useLiveScoringEngine,
  EXTRA_OPTIONS,
  getValidDismissalOptions,
  isDismissalLockedToRunOutOnly,
  type ExtraType,
  type DismissalType,
  type PendingWicket,
  type Toast,
  type EngineSyncState,
} from "@/hooks/useLiveScoringEngine";
import { X, AlertTriangle, ArrowRight, UserX, Trophy, RotateCcw, Undo2 } from "lucide-react";
import Image from "next/image";

// Tracks whether we're under the 640px mobile breakpoint so the crew
// slots can swap the inline drag-carousel for a tap-to-open player
// picker overlay.
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return isMobile;
}

function initials(name: string) {
  return (
    name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?"
  );
}

function squadFor(matchSetup: MatchSetup | undefined, key: "teamA" | "teamB"): SquadPlayer[] {
  if (!matchSetup) return [];
  const team = matchSetup[key];
  if (team.squadPlayers && team.squadPlayers.length > 0) return team.squadPlayers;
  return (team.squad ?? []).map((name) => ({ id: `name:${name}`, name }));
}

function logoFor(matchSetup: MatchSetup | undefined, key: "teamA" | "teamB"): string | undefined {
  return matchSetup?.[key]?.logoUrl || undefined;
}

function ViewportPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

type PlayerRole = "striker" | "nonStriker" | "bowler";

// `disabled` lets an automatic driver freeze the carousel without
// duplicating this component. Every existing lock reason (dismissed,
// already in a role) still applies on top of this.
function PlayerCarousel({
  players,
  onSelect,
  emptyLabel,
  dismissedNames,
  roleByName,
  disabled,
}: {
  players: SquadPlayer[];
  onSelect: (p: SquadPlayer) => void;
  emptyLabel?: string;
  dismissedNames?: Set<string>;
  roleByName?: Map<string, { role: PlayerRole; locked?: boolean }>;
  disabled?: boolean;
}) {
  if (players.length === 0) {
    return (
      <p className="text-[10px] py-1 font-cinzel text-gray-500">
        {emptyLabel ?? "No squad loaded — set this team's squad in Match Setup."}
      </p>
    );
  }

  const allUnavailable = players.every(
    (p) => dismissedNames?.has(p.name) || !!roleByName?.get(p.name)
  );

  if (allUnavailable) {
    return (
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/[0.02] border border-gold/10">
        <span className="w-8.5 h-8.5 w-[34px] h-[34px] rounded-lg flex items-center justify-center bg-white/[0.04] border border-gold/10 text-gray-500 flex-shrink-0">
          <UserX size={17} strokeWidth={2} />
        </span>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[11px] font-black uppercase tracking-wide font-cinzel text-gray-100">All out of batters</span>
          <span className="text-[10px] text-gray-500 mt-0.5 leading-snug">Every player is either out or already at the crease.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {players.map((p) => {
        const isOut = !!dismissedNames?.has(p.name);
        const roleInfo = roleByName?.get(p.name);
        const isAlreadySelected = !!roleInfo;
        const isLocked = isOut || isAlreadySelected || !!disabled;
        const roleLabel =
          roleInfo?.role === "striker"
            ? "On Strike"
            : roleInfo?.role === "nonStriker"
            ? "Non-Striker"
            : roleInfo?.role === "bowler"
            ? "Bowling"
            : undefined;

        return (
          <button
            key={p.id}
            type="button"
            draggable={!isLocked}
            disabled={isLocked}
            onDragStart={(e) => {
              if (isLocked) {
                e.preventDefault();
                return;
              }
              e.dataTransfer.setData("text/player-id", p.id);
            }}
            onClick={() => !isLocked && onSelect(p)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all ${
              isOut
                ? "opacity-55 cursor-not-allowed bg-red-500/[0.08] border-red-400/40"
                : isAlreadySelected
                ? "opacity-85 cursor-not-allowed bg-emerald-500/[0.08] border-emerald-400/45"
                : disabled
                ? "opacity-45 cursor-not-allowed bg-white/[0.02] border-gold/10"
                : "bg-white/[0.02] border-gold/10 hover:border-gold/30 hover:bg-white/[0.04]"
            }`}
            title={
              isOut
                ? `${p.name} — already out this innings`
                : isAlreadySelected
                ? `${p.name} — currently ${roleLabel}`
                : disabled
                ? `${p.name} — auto-demo is driving this match`
                : p.name
            }
          >
            <span className="rounded-full overflow-hidden bg-black/60 border border-gold/10 flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44 }}>
              {p.imageUrl ? (
                <Image src={p.imageUrl} alt="" width={44} height={44} />
              ) : (
                <span className="text-[13px] font-bold font-cinzel text-gray-400">{initials(p.name)}</span>
              )}
            </span>
            <span
              className={`text-[11px] font-bold font-cinzel max-w-[100px] truncate ${
                isOut ? "text-red-400" : isAlreadySelected ? "text-emerald-400" : "text-gray-200"
              }`}
            >
              {p.name}
              {isOut ? " · OUT" : roleLabel ? ` · ${roleLabel}` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Mobile-only replacement for the inline drag carousel. Tapping a crew
// slot on a narrow viewport opens this as a bottom sheet instead of
// scrolling a horizontal strip.
function PlayerPickerSheet({
  title,
  teamLabel,
  players,
  onSelect,
  onClose,
  dismissedNames,
  roleByName,
  emptyLabel,
}: {
  title: string;
  teamLabel: string;
  players: SquadPlayer[];
  onSelect: (p: SquadPlayer) => void;
  onClose: () => void;
  dismissedNames?: Set<string>;
  roleByName?: Map<string, { role: PlayerRole; locked?: boolean }>;
  emptyLabel?: string;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9000] p-4 sm:items-center items-end sm:p-4 p-0"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-w-[calc(100vw-64px)] sm:max-h-[76vh] max-h-[78vh] w-full sm:w-[560px] overflow-y-auto bg-black/80 backdrop-blur-xl border border-gold/20 sm:rounded-2xl rounded-t-2xl rounded-b-none sm:rounded-b-2xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-black uppercase tracking-wide font-cinzel text-white">{title}</span>
            <span className="text-[10px] font-cinzel text-gray-500 mt-0.5">{teamLabel}</span>
          </div>
          <button
            type="button"
            className="w-7 h-7 rounded-full border border-gold/10 bg-white/[0.02] text-gray-500 hover:text-gold flex items-center justify-center flex-shrink-0 transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>

        {players.length === 0 ? (
          <p className="text-[10px] font-cinzel text-gray-500 text-center py-5 px-2.5">
            {emptyLabel ?? "No squad loaded — set this team's squad in Match Setup."}
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2.5">
            {players.map((p) => {
              const isOut = !!dismissedNames?.has(p.name);
              const roleInfo = roleByName?.get(p.name);
              const isLocked = isOut || !!roleInfo;
              const roleLabel =
                roleInfo?.role === "striker"
                  ? "On Strike"
                  : roleInfo?.role === "nonStriker"
                  ? "Non-Striker"
                  : roleInfo?.role === "bowler"
                  ? "Bowling"
                  : undefined;

              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    if (isLocked) return;
                    onSelect(p);
                    onClose();
                  }}
                  className={`flex flex-col items-center gap-1.5 px-1.5 py-2.5 rounded-xl border transition-colors ${
                    isOut
                      ? "opacity-55 bg-red-500/[0.07] border-red-400/40"
                      : isLocked
                      ? "opacity-65 bg-emerald-500/[0.07] border-emerald-400/40"
                      : "bg-white/[0.03] border-gold/10 hover:border-gold/30"
                  }`}
                >
                  <span className="rounded-full overflow-hidden bg-black/60 border border-gold/10 flex items-center justify-center" style={{ width: 52, height: 52 }}>
                    {p.imageUrl ? (
                      <Image src={p.imageUrl} alt="" width={52} height={52} />
                    ) : (
                      <span className="text-[15px] font-bold font-cinzel text-gray-400">{initials(p.name)}</span>
                    )}
                  </span>
                  <span
                    className={`text-[9.5px] font-bold font-cinzel text-center leading-tight break-words ${
                      isOut ? "text-red-400" : isLocked ? "text-emerald-400" : "text-gray-200"
                    }`}
                  >
                    {p.name}
                    {isOut ? " · OUT" : roleLabel ? ` · ${roleLabel}` : ""}
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

// `readOnly` disables activation/assign/clear/drag-drop without
// touching any of the visual logic.
function CrewSlot({
  title,
  accentColor,
  active,
  onActivate,
  displayName,
  imageUrl,
  statLine,
  allPlayers,
  onAssign,
  onClear,
  placeholder,
  locked,
  dismissedNames,
  blockedName,
  noReplacement,
  readOnly,
  avatarSize,
}: {
  title: string;
  accentColor?: string;
  active: boolean;
  onActivate: () => void;
  displayName: string;
  imageUrl?: string;
  statLine?: string;
  allPlayers: SquadPlayer[];
  onAssign: (p: SquadPlayer) => void;
  onClear?: () => void;
  placeholder: string;
  locked?: boolean;
  dismissedNames?: Set<string>;
  blockedName?: string;
  noReplacement?: boolean;
  readOnly?: boolean;
  avatarSize?: number;
}) {
  const size = avatarSize ?? 48;
  const fallbackFontSize = Math.max(10, Math.round(size * 0.3));
  const isEmpty = !displayName;
  const effectivelyLocked = !!locked || !!readOnly;

  if (noReplacement && isEmpty) {
    return (
      <div className="rounded-xl border border-dashed border-gold/15 bg-white/[0.02] p-3">
        <Eyebrow color="#6b7280">{title}</Eyebrow>
        <div className="flex items-center gap-2.5 mt-2">
          <span
            className="rounded-full flex items-center justify-center opacity-50 bg-black/60 border border-gold/10"
            style={{ width: size, height: size }}
          >
            <span className="font-cinzel text-gray-500" style={{ fontSize: fallbackFontSize }}>
              —
            </span>
          </span>
          <span className="text-[10px] font-bold font-cinzel text-gray-500">No replacement left in the squad</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl p-3 transition-all border ${active ? "border-gold/50 bg-gold/[0.05]" : ""} ${
        effectivelyLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      } ${
        isEmpty
          ? "border-dashed border-red-400/45 bg-red-500/[0.05]"
          : !active
          ? "border-gold/10 bg-white/[0.02]"
          : ""
      }`}
      onClick={effectivelyLocked ? undefined : onActivate}
      onDragOver={(e) => !effectivelyLocked && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (effectivelyLocked) return;
        const id = e.dataTransfer.getData("text/player-id");
        const player = allPlayers.find((p) => p.id === id);
        if (!player) return;
        if (dismissedNames?.has(player.name)) return;
        if (blockedName && player.name === blockedName) return;
        onAssign(player);
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <Eyebrow color={isEmpty ? "#f87171" : accentColor}>
          {isEmpty ? "⚠ " : ""}
          {title}
        </Eyebrow>
        <div className="flex items-center gap-2">
          {active && !effectivelyLocked && (
            <span className="text-[9px] font-cinzel text-gold/70 whitespace-nowrap">tap or drag a player below ▾</span>
          )}
          {!isEmpty && onClear && !effectivelyLocked && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              title={`Clear ${title}`}
              aria-label={`Clear ${title}`}
              className="w-5 h-5 rounded-full border border-gold/10 bg-white/[0.02] text-gray-500 hover:text-red-400 hover:border-red-400/40 flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="rounded-full overflow-hidden bg-black/60 border border-gold/10 flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
          {imageUrl ? (
            <Image src={imageUrl} alt="" width={size} height={size} />
          ) : (
            <span className="font-bold font-cinzel text-gray-500" style={{ fontSize: fallbackFontSize }}>
              {displayName ? initials(displayName) : "＋"}
            </span>
          )}
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-bold font-cinzel truncate text-gray-100">{displayName || placeholder}</span>
          {statLine && <span className="text-[10.5px] font-cinzel tabular-nums text-gray-500">{statLine}</span>}
        </div>
      </div>
    </div>
  );
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 top-auto z-[9999] flex flex-col-reverse gap-1.5 items-end pointer-events-none max-w-[calc(100vw-24px)] scorer-toast-stack-mobile">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`font-cinzel text-[11px] font-bold px-3.5 py-2 rounded-lg whitespace-nowrap max-w-full overflow-hidden text-ellipsis shadow-[0_8px_24px_rgba(0,0,0,0.4)] border scorer-toast-in ${
            t.tone === "wicket"
              ? "bg-red-500/15 border-red-400/35 text-red-400"
              : t.tone === "milestone"
              ? "bg-gold/[0.16] border-gold/35 text-gold"
              : "bg-gold/10 border-gold/35 text-gold"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

function BatsmanOutOption({
  label,
  name,
  runs,
  balls,
  selected,
  onClick,
}: {
  label: string;
  name: string;
  runs: number;
  balls: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg text-left transition-all flex-1 border ${
        selected ? "bg-red-500/[0.14] border-red-400/50" : "bg-white/[0.02] border-gold/10"
      }`}
    >
      <span className="text-[9px] uppercase tracking-wide font-cinzel text-gray-500">{label}</span>
      <span className={`text-[12px] font-bold font-cinzel ${selected ? "text-red-400" : "text-gray-100"}`}>
        {name || label}
      </span>
      <span className="text-[10px] text-gray-500">
        {runs}({balls})
      </span>
    </button>
  );
}

function DialogShell({ onBackdropClick, children }: { onBackdropClick: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[9000] p-4 scorer-backdrop-in"
      onClick={onBackdropClick}
    >
      <div
        className="w-[340px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] overflow-y-auto bg-black/80 backdrop-blur-xl border border-gold/20 rounded-2xl p-[18px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] scorer-dialog-in"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function WicketDetailDialog({
  pending,
  onResolve,
}: {
  pending: PendingWicket;
  onResolve: (batsmanOut: "striker" | "nonStriker", fire: boolean, dismissalType: DismissalType, fielder: string, runsCompleted: number) => void;
}) {
  const [batsmanOut, setBatsmanOut] = useState<"striker" | "nonStriker">("striker");
  const options = getValidDismissalOptions(pending.extraType, pending.isFreeHitActive);
  const lockedToRunOutOnly = isDismissalLockedToRunOutOnly(pending.extraType, pending.isFreeHitActive);
  const [dismissalType, setDismissalType] = useState<DismissalType>(options[0].value);
  const [fielder, setFielder] = useState("");
  const [runsCompleted, setRunsCompleted] = useState(0);

  return (
    <DialogShell onBackdropClick={() => onResolve(batsmanOut, false, dismissalType, fielder, runsCompleted)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-black uppercase tracking-widest font-cinzel text-red-400">Wicket Detail</span>
        <button
          type="button"
          onClick={() => onResolve(batsmanOut, false, dismissalType, fielder, runsCompleted)}
          className="text-[11px] font-cinzel text-gray-500 hover:text-gray-300"
        >
          Skip ✕
        </button>
      </div>

      {lockedToRunOutOnly && (
        <div className="mb-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide font-cinzel bg-sky-400/[0.14] border border-sky-400/40 text-sky-400">
          🔓 {pending.extraType === "noBall" ? "No Ball" : "Free Hit"} — only Run Out is a valid dismissal
        </div>
      )}

      {!lockedToRunOutOnly && pending.extraType === "wide" && (
        <div className="mb-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide font-cinzel bg-sky-400/[0.14] border border-sky-400/40 text-sky-400">
          🔵 Wide — Bowled, Caught, and LBW aren&apos;t valid here
        </div>
      )}

      <div className="flex flex-col gap-1.5 mb-3">
        <FieldLabel>Batsman Out</FieldLabel>
        <div className="flex gap-2">
          <BatsmanOutOption label="Striker" name={pending.strikerBefore.name} runs={pending.strikerBefore.runs} balls={pending.strikerBefore.balls} selected={batsmanOut === "striker"} onClick={() => setBatsmanOut("striker")} />
          <BatsmanOutOption label="Non-Striker" name={pending.nonStrikerBefore.name} runs={pending.nonStrikerBefore.runs} balls={pending.nonStrikerBefore.balls} selected={batsmanOut === "nonStriker"} onClick={() => setBatsmanOut("nonStriker")} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 mb-3">
        <FieldLabel>Dismissal</FieldLabel>
        <select
          value={dismissalType}
          disabled={options.length === 1}
          onChange={(e) => setDismissalType(e.target.value as DismissalType)}
          className={`w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-gold/10 text-gray-100 ${options.length === 1 ? "opacity-75" : ""}`}
        >
          {options.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {dismissalType === "runOut" && (
        <div className="flex flex-col gap-1.5 mb-3">
          <FieldLabel>Runs Completed Before Run Out</FieldLabel>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRunsCompleted(n)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold font-cinzel border ${
                  runsCompleted === n ? "bg-red-500/[0.14] border-red-400/50 text-red-400" : "bg-white/[0.02] border-gold/10 text-gray-100"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 mb-4">
        <FieldLabel>Fielder (if any)</FieldLabel>
        <input
          value={fielder}
          onChange={(e) => setFielder(e.target.value)}
          placeholder="Fielder name"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-gold/10 text-gray-100 placeholder:text-gray-600"
        />
      </div>

      <button
        type="button"
        onClick={() => onResolve(batsmanOut, true, dismissalType, fielder, runsCompleted)}
        className="w-full py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-cinzel bg-red-500 text-white hover:bg-red-600 transition-colors"
      >
        Fire Wicket Graphic
      </button>
    </DialogShell>
  );
}

function EndInningsDialog({
  currentRuns,
  isSecondInnings,
  onConfirm,
  onCancel,
}: {
  currentRuns: number;
  isSecondInnings: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <DialogShell onBackdropClick={onCancel}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-black uppercase tracking-widest font-cinzel text-red-400">
          {isSecondInnings ? "End Match?" : "End Innings?"}
        </span>
      </div>
      {isSecondInnings ? (
        <p className="text-[12px] mb-4 text-gray-200">
          This is the 2nd innings — ending it marks the match complete, computes the result, fires
          the Match Won graphic immediately, and locks scoring. You can still undo this afterwards
          with the &quot;Undo&quot; button if it was a mistake.
        </p>
      ) : (
        <p className="text-[12px] mb-4 text-gray-200">
          This will set the target to <strong>{currentRuns + 1}</strong>, and reset the score, overs, striker,
          non-striker, and bowler for Innings 2 — you&apos;ll need to pick 3 new players before you can
          keep scoring. Match &amp; tournament boundary totals carry over. You can undo this
          afterwards if it was a mistake.
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-cinzel bg-white/[0.02] border border-gold/10 text-gray-200 hover:border-gold/30 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-cinzel bg-red-500 text-white hover:bg-red-600 transition-colors"
        >
          {isSecondInnings ? "End Match" : "End Innings"}
        </button>
      </div>
    </DialogShell>
  );
}

function RestartMatchDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <DialogShell onBackdropClick={onCancel}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-black uppercase tracking-widest font-cinzel text-gold">Restart Match?</span>
      </div>
      <p className="text-[12px] mb-4 text-gray-200">
        This starts a fresh match with the <strong>same teams and squads</strong> from Match Setup.
        Score, overs, striker, non-striker, bowler, target, and the previous result all reset. The
        points table and tournament boundary totals are kept, since those track the whole
        tournament, not just one match. This can&apos;t be undone.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-cinzel bg-white/[0.02] border border-gold/10 text-gray-200 hover:border-gold/30 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wide font-cinzel bg-gold text-black hover:bg-gold/90 transition-colors"
        >
          Restart Match
        </button>
      </div>
    </DialogShell>
  );
}

function MatchOverScreen({
  winningTeamName,
  winningTeamLogo,
  margin,
  method,
  canUndo,
  onUndo,
  onRestart,
}: {
  winningTeamName?: string;
  winningTeamLogo?: string;
  margin?: string;
  method?: "batting" | "bowling" | "tie" | "runs" | "wickets";
  canUndo: boolean;
  onUndo: () => void;
  onRestart?: () => void;
}) {
  const isTie = method === "tie";

  return (
    <div className="match-over-screen relative overflow-hidden flex w-full box-border flex-col items-center text-center gap-1 py-14 px-6 sm:px-12 rounded-[22px] border border-gold/25 bg-gradient-to-b from-black/60 to-black/60">
      <div className="match-over-glow absolute -top-20 left-1/2 w-80 h-80 rounded-full pointer-events-none z-0" aria-hidden />
      <div className="match-over-shine absolute -inset-y-[20%] -inset-x-[40%] pointer-events-none z-0" aria-hidden />

      <span className="match-over-fade relative z-10 flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-[0.2em] font-cinzel text-gold mb-5" style={{ animationDelay: "80ms" }}>
        <span className="w-5 h-px bg-gradient-to-r from-transparent to-gold/50" />
        <Trophy size={13} strokeWidth={2.4} />
        Match Complete
        <span className="w-5 h-px bg-gradient-to-l from-transparent to-gold/50" />
      </span>

      <div
        className="match-over-badge-in relative z-10 w-24 h-24 sm:w-[104px] sm:h-[104px] rounded-full flex items-center justify-center bg-black/60 border-[3px] border-gold/50 overflow-hidden mb-5"
        style={{ boxShadow: "0 0 0 8px rgba(245,166,35,0.08), 0 12px 32px rgba(0,0,0,0.35)" }}
      >
        {winningTeamLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={winningTeamLogo} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="flex items-center justify-center text-gold text-3xl">
            {isTie ? "🤝" : <Trophy size={36} strokeWidth={1.8} />}
          </span>
        )}
      </div>

      <h2 className="match-over-fade relative z-10 font-cinzel text-[19px] sm:text-[26px] font-black uppercase text-white m-0" style={{ animationDelay: "260ms" }}>
        {isTie ? "It's a Tie" : winningTeamName ? `${winningTeamName} Win` : "Match Complete"}
      </h2>
      {!isTie && margin && (
        <p
          className="match-over-fade relative z-10 font-cinzel text-[11px] sm:text-[12.5px] font-bold uppercase tracking-wide text-gold mt-3.5 px-4 py-1.5 rounded-full bg-gold/10 border border-gold/30 inline-block"
          style={{ animationDelay: "360ms" }}
        >
          {margin}
        </p>
      )}

      <div className="match-over-fade relative z-10 flex gap-2.5 mt-6 flex-wrap justify-center" style={{ animationDelay: "460ms" }}>
        {canUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="flex items-center gap-1.5 font-cinzel text-[11px] font-black uppercase tracking-wide rounded-lg px-5 py-2.5 border border-red-400/35 bg-red-500/10 text-red-400 hover:bg-red-500/15 hover:border-red-400/50 transition-all hover:-translate-y-0.5"
          >
            <Undo2 size={14} strokeWidth={2.4} />
            Undo &amp; Keep Scoring
          </button>
        )}
        {onRestart && (
          <button
            type="button"
            onClick={onRestart}
            className="flex items-center gap-1.5 font-cinzel text-[11px] font-black uppercase tracking-wide rounded-lg px-5 py-2.5 bg-gold text-black shadow-[0_4px_18px_rgba(245,166,35,0.4)] hover:shadow-[0_6px_26px_rgba(245,166,35,0.5)] transition-all hover:-translate-y-0.5"
          >
            <RotateCcw size={14} strokeWidth={2.4} />
            Restart Match
          </button>
        )}
      </div>
    </div>
  );
}

// Imperative handle so an external driver (LiveStatePanelAuto) can call
// the same engine functions the real UI buttons call, and can read
// current battingSquad/bowlingSquad without duplicating the toss/innings
// math that decides which team is which.
export interface LiveStatePanelHandle {
  recordBall: (runs: 0 | 1 | 2 | 3 | 4 | 6) => void;
  recordWicket: () => void;
  resolveWicket: (
    batsmanOut: "striker" | "nonStriker",
    fire: boolean,
    dismissalType: DismissalType,
    fielder: string,
    runsCompleted: number
  ) => void;
  assignPlayer: (slot: "striker" | "nonStriker" | "bowler", player: SquadPlayer) => void;
  endInnings: () => void;
  undo: () => void;
  canUndo: () => boolean;
  isControlsLocked: () => boolean;
  isMatchComplete: () => boolean;
  hasPendingWicket: () => boolean;
  getBattingSquad: () => SquadPlayer[];
  getBowlingSquad: () => SquadPlayer[];
}

export interface LiveStatePanelProps {
  auctionId?: string;
  matchId?: string | null;
  liveState: LiveState;
  setLiveState: React.Dispatch<React.SetStateAction<LiveState>>;
  setLiveDirty: (v: boolean) => void;
  liveDirty: boolean;
  onPush: () => void;
  pushLabel: string;
  matchSetup?: MatchSetup;
  onBoundary?: (moment: "four" | "six", batter: { name: string; runs: number; balls: number }) => void;
  onMilestone?: (moment: "fifty" | "hundred", batter: { name: string; runs: number; balls: number; label?: string }) => void;
  onWicketConfirm?: (payload: {
    batsmanOut: "striker" | "nonStriker";
    batter: { name: string; runs: number; balls: number };
    dismissalType: DismissalType;
    fielder: string;
    bowlerName: string;
  }) => void;
  onMaiden?: (payload: { bowlerName: string; maidens: number }) => void;
  onInningsEnd?: (payload: { target: number; previousInningsRuns: number; inningsNumber: 1 | 2 }) => void;
  onMatchComplete?: (result: { winningTeamName: string; margin: string; method: "batting" | "bowling" | "tie" | "runs" | "wickets" }) => void;
  onRestartMatch?: () => void;
  onFireMatchWonMoment?: (payload: {
    winningTeamName: string;
    margin: string;
    method: "runs" | "wickets" | "tie";
    teamColor?: string;
    teamLogoUrl?: string;
  }) => void;
  onEngineStateChange?: (state: EngineSyncState) => void;
  initialEngineState?: EngineSyncState | null;
  // When true, every manual control (ball pad, carousel, crew slots,
  // undo, end innings/match, restart, free-hit toggle) is disabled. The
  // engine itself keeps working — LiveStatePanelAuto drives it through
  // the ref below.
  readOnly?: boolean;
}

const LiveStatePanel = forwardRef<LiveStatePanelHandle, LiveStatePanelProps>(function LiveStatePanel(
  {
    auctionId,
    matchId,
    liveState,
    setLiveState,
    setLiveDirty,
    liveDirty,
    onPush,
    pushLabel,
    matchSetup,
    onBoundary,
    onMilestone,
    onWicketConfirm,
    onMaiden,
    onInningsEnd,
    onMatchComplete,
    onRestartMatch,
    onFireMatchWonMoment,
    onEngineStateChange,
    initialEngineState,
    readOnly,
  },
  ref
) {
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  // On mobile, tapping Striker/Non-Striker/Bowler opens a full overlay
  // picker (playerPicker) instead of relying on the inline horizontal
  // carousel, which stays for desktop only.
  const isMobile = useIsMobile();
  const [playerPicker, setPlayerPicker] = useState<null | "striker" | "nonStriker" | "bowler">(null);

  const battingTeamKey: "teamA" | "teamB" = useMemo(() => {
    const firstInningsTeamIsA = (() => {
      if (matchSetup?.tossWinner && matchSetup.tossDecision) {
        const winnerBats = matchSetup.tossDecision === "bat";
        const winnerIsA = matchSetup.tossWinner === "A";
        return winnerBats ? winnerIsA : !winnerIsA;
      }
      return true;
    })();
    const firstInningsTeam: "teamA" | "teamB" = firstInningsTeamIsA ? "teamA" : "teamB";
    const isSecondInningsNow = (liveState.inningsNumber ?? 1) === 2;
    if (!isSecondInningsNow) return firstInningsTeam;
    return firstInningsTeam === "teamA" ? "teamB" : "teamA";
  }, [matchSetup?.tossWinner, matchSetup?.tossDecision, liveState.inningsNumber]);
  const bowlingTeamKey = battingTeamKey === "teamA" ? "teamB" : "teamA";

  const battingSquad = useMemo(() => squadFor(matchSetup, battingTeamKey), [matchSetup, battingTeamKey]);
  const bowlingSquad = useMemo(() => squadFor(matchSetup, bowlingTeamKey), [matchSetup, bowlingTeamKey]);
  const battingTeamLabel = matchSetup?.[battingTeamKey]?.shortCode || (battingTeamKey === "teamA" ? "Team A" : "Team B");
  const bowlingTeamLabel = matchSetup?.[bowlingTeamKey]?.shortCode || (bowlingTeamKey === "teamA" ? "Team A" : "Team B");

  const battingTeamName = matchSetup?.[battingTeamKey]?.name || battingTeamLabel;
  const bowlingTeamName = matchSetup?.[bowlingTeamKey]?.name || bowlingTeamLabel;

  const teamALogo = logoFor(matchSetup, "teamA");
  const teamBLogo = logoFor(matchSetup, "teamB");
  const teamAName = matchSetup?.teamA?.name || matchSetup?.teamA?.shortCode || "Team A";
  const teamBName = matchSetup?.teamB?.name || matchSetup?.teamB?.shortCode || "Team B";

  const winningTeamKey = useMemo((): "teamA" | "teamB" | undefined => {
    const winName = liveState.matchResult?.winningTeamName;
    if (!winName) return undefined;
    if (winName === teamAName || winName === matchSetup?.teamA?.shortCode) return "teamA";
    if (winName === teamBName || winName === matchSetup?.teamB?.shortCode) return "teamB";
    return undefined;
  }, [liveState.matchResult?.winningTeamName, teamAName, teamBName, matchSetup]);

  const winningTeamLogo = winningTeamKey === "teamA" ? teamALogo : winningTeamKey === "teamB" ? teamBLogo : undefined;

  const maxOversByFormat: Record<string, number | undefined> = { T20: 20, ODI: 50, Test: undefined };
  const maxOvers = matchSetup?.format ? maxOversByFormat[matchSetup.format] : undefined;

  const engine = useLiveScoringEngine({
    matchId,
    liveState,
    setLiveState,
    setLiveDirty,
    maxOvers,
    battingTeamName,
    bowlingTeamName,
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

  // The imperative handle. Calls the exact same engine functions the
  // buttons below call, so an external driver can't put the engine in a
  // state the UI itself couldn't reach.
  useImperativeHandle(
    ref,
    () => ({
      recordBall: (runs) => engine.recordBall(runs),
      recordWicket: () => engine.recordWicket(),
      resolveWicket: (batsmanOut, fire, dismissalType, fielder, runsCompleted) =>
        engine.resolveWicket(batsmanOut, fire, dismissalType, fielder, runsCompleted),
      assignPlayer: (slot, player) => engine.assignPlayer(slot, player),
      endInnings: () => engine.endInnings(),
      undo: () => engine.undo(),
      canUndo: () => engine.canUndo,
      isControlsLocked: () => engine.assignmentsMissing(),
      isMatchComplete: () => liveState.matchComplete === true,
      hasPendingWicket: () => !!engine.pendingWicket,
      getBattingSquad: () => battingSquad,
      getBowlingSquad: () => bowlingSquad,
    }),
    [engine, liveState.matchComplete, battingSquad, bowlingSquad]
  );

  const [showEndInningsConfirm, setShowEndInningsConfirm] = useState(false);

  const isSecondInnings = (liveState.inningsNumber ?? 1) === 2;
  const ballsBowled = liveState.score.overs * 6 + liveState.score.balls;
  const totalBalls = maxOvers !== undefined ? maxOvers * 6 : undefined;
  const ballsRemaining = totalBalls !== undefined ? Math.max(0, totalBalls - ballsBowled) : undefined;
  const runsNeeded = liveState.target !== undefined ? Math.max(0, liveState.target - liveState.score.runs) : undefined;
  const requiredRunRate =
    runsNeeded !== undefined && ballsRemaining ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : undefined;

  const controlsLocked = engine.assignmentsMissing();

  // Replaces the old persistent "assignment needed" banner. Instead of
  // always occupying space above the scoreboard, this only appears — as
  // a bottom-right toast, same stack as the engine's own toasts — the
  // moment someone actually tries to score without a Striker,
  // Non-Striker, and Bowler assigned yet.
  const [localToasts, setLocalToasts] = useState<Toast[]>([]);
  const localToastTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = localToastTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const showAssignmentToast = () => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const toast = { id, text: "Pick a Striker, Non-Striker & Bowler before you can score", tone: "wicket" } as Toast;
    setLocalToasts((prev) => [...prev, toast]);
    const timer = setTimeout(() => {
      setLocalToasts((prev) => prev.filter((t) => t.id !== id));
      localToastTimers.current.delete(id);
    }, 3200);
    localToastTimers.current.set(id, timer);
  };

  const handleScoreBall = (runs: 0 | 1 | 2 | 3 | 4 | 6) => {
    if (readOnly) return;
    if (controlsLocked) {
      showAssignmentToast();
      return;
    }
    engine.recordBall(runs);
  };

  const handleRecordWicket = () => {
    if (readOnly) return;
    if (controlsLocked) {
      showAssignmentToast();
      return;
    }
    engine.recordWicket();
  };

  const strikerNeedsReplacement = engine.noPartnerAvailable && !liveState.striker.name;
  const nonStrikerNeedsReplacement = engine.noPartnerAvailable && !liveState.nonStriker.name;

  const battingRoleMap = useMemo(() => {
    const m = new Map<string, { role: "striker" | "nonStriker"; locked?: boolean }>();
    if (liveState.striker.name) {
      m.set(liveState.striker.name, { role: "striker", locked: engine.activeSlot === "nonStriker" });
    }
    if (liveState.nonStriker.name) {
      m.set(liveState.nonStriker.name, { role: "nonStriker", locked: engine.activeSlot === "striker" });
    }
    return m;
  }, [liveState.striker.name, liveState.nonStriker.name, engine.activeSlot]);

  const bowlingRoleMap = useMemo(() => {
    const m = new Map<string, { role: "bowler" }>();
    if (liveState.bowler.name) m.set(liveState.bowler.name, { role: "bowler" });
    return m;
  }, [liveState.bowler.name]);

  const runRate =
    liveState.score.overs + liveState.score.balls / 6 > 0
      ? (liveState.score.runs / (liveState.score.overs + liveState.score.balls / 6)).toFixed(2)
      : "0.00";

  return (
    <DrawerSection step="3" title="Scorer" description="Tap the ball, we do the maths" dirty={liveDirty} defaultOpen>
      <style>{`
        @keyframes scorerToastIn { from { opacity: 0; transform: translateY(6px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes scorerDialogIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        @keyframes scorerBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes freeHitPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(96,165,250,0.45); } 50% { box-shadow: 0 0 0 5px rgba(96,165,250,0); } }
        @keyframes inningsStatusGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,166,35,0.25); } 50% { box-shadow: 0 0 0 6px rgba(245,166,35,0); } }
        @keyframes matchOverGlowPulse { 0%, 100% { opacity: 0.5; transform: translateX(-50%) scale(1); } 50% { opacity: 0.85; transform: translateX(-50%) scale(1.06); } }
        @keyframes matchOverIn { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes matchOverShine { 0% { transform: translateX(-120%) rotate(8deg); } 100% { transform: translateX(220%) rotate(8deg); } }
        @keyframes matchOverBadgeIn { 0% { opacity: 0; transform: scale(0.6) rotate(-8deg); } 60% { transform: scale(1.08) rotate(2deg); } 100% { opacity: 1; transform: scale(1) rotate(0deg); } }
        @keyframes matchOverFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes matchOverBadgeRing { 0%, 100% { box-shadow: 0 0 0 8px rgba(245,166,35,0.08), 0 12px 32px rgba(0,0,0,0.35); } 50% { box-shadow: 0 0 0 12px rgba(245,166,35,0.14), 0 12px 32px rgba(0,0,0,0.35); } }

        .scorer-toast-in { animation: scorerToastIn 160ms ease-out; }
        .scorer-dialog-in { animation: scorerDialogIn 160ms cubic-bezier(0.2, 0.8, 0.3, 1); }
        .scorer-backdrop-in { animation: scorerBackdropIn 140ms ease-out; }
        .match-over-glow { background: radial-gradient(circle, rgba(245,166,35,0.32) 0%, rgba(245,166,35,0) 70%); animation: matchOverGlowPulse 3.4s ease-in-out infinite; }
        .match-over-shine { background: linear-gradient(100deg, transparent 42%, rgba(255,255,255,0.05) 48%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 52%, transparent 58%); animation: matchOverShine 3.2s ease-in-out infinite; animation-delay: 0.4s; }
        .match-over-badge-in { animation: matchOverBadgeIn 480ms cubic-bezier(0.2,0.8,0.3,1) 160ms forwards, matchOverBadgeRing 2.6s ease-in-out 700ms infinite; opacity: 0; }
        .match-over-fade { opacity: 0; animation: matchOverFadeUp 420ms ease-out forwards; }
        .match-over-screen { animation: matchOverIn 260ms cubic-bezier(0.2,0.8,0.3,1); background: radial-gradient(120% 100% at 50% 0%, rgba(245,166,35,0.14) 0%, rgba(245,166,35,0.03) 45%, transparent 70%); }

        .free-hit-toggle.is-active .free-hit-thumb { animation: freeHitPulse 1.6s ease-in-out infinite; }
        .innings-status-icon-badge { animation: inningsStatusGlow 2.4s ease-in-out infinite; }
        .innings-status-dot::after { content: ""; position: absolute; inset: -4px; border-radius: 999px; border: 1px solid #F5A623; animation: inningsStatusGlow 2.4s ease-in-out infinite; }

        @media (max-width: 640px) {
          .scorer-toast-stack-mobile { bottom: 12px; right: 12px; left: 12px; align-items: stretch; }
          .scorer-toast-stack-mobile > div { white-space: normal; text-align: center; }
        }
      `}</style>

      <ViewportPortal>
        <ToastStack toasts={[...engine.toasts, ...localToasts]} />
      </ViewportPortal>
      {engine.pendingWicket && (
        <ViewportPortal>
          <WicketDetailDialog pending={engine.pendingWicket} onResolve={readOnly ? () => {} : engine.resolveWicket} />
        </ViewportPortal>
      )}
      {playerPicker && !readOnly && (
        <ViewportPortal>
          <PlayerPickerSheet
            title={
              playerPicker === "striker"
                ? "Select Striker"
                : playerPicker === "nonStriker"
                ? "Select Non-Striker"
                : "Select Bowler"
            }
            teamLabel={playerPicker === "bowler" ? bowlingTeamLabel : battingTeamLabel}
            players={playerPicker === "bowler" ? bowlingSquad : battingSquad}
            onSelect={(p) => engine.assignPlayer(playerPicker, p)}
            onClose={() => setPlayerPicker(null)}
            dismissedNames={playerPicker === "bowler" ? undefined : engine.dismissedPlayers}
            roleByName={playerPicker === "bowler" ? bowlingRoleMap : battingRoleMap}
            emptyLabel="No squad loaded for this side yet — add one in Match Setup."
          />
        </ViewportPortal>
      )}
      {showEndInningsConfirm && (
        <ViewportPortal>
          <EndInningsDialog
            currentRuns={liveState.score.runs}
            isSecondInnings={isSecondInnings}
            onCancel={() => setShowEndInningsConfirm(false)}
            onConfirm={() => {
              if (readOnly) return;
              engine.endInnings();
              setShowEndInningsConfirm(false);
            }}
          />
        </ViewportPortal>
      )}
      {showRestartConfirm && (
        <ViewportPortal>
          <RestartMatchDialog
            onCancel={() => setShowRestartConfirm(false)}
            onConfirm={() => {
              if (readOnly) return;
              engine.resetEngineState();
              onRestartMatch?.();
              setShowRestartConfirm(false);
            }}
          />
        </ViewportPortal>
      )}

      {liveState.matchComplete ? (
        <MatchOverScreen
          winningTeamName={liveState.matchResult?.winningTeamName}
          winningTeamLogo={winningTeamLogo}
          margin={liveState.matchResult?.margin}
          method={liveState.matchResult?.method}
          canUndo={!readOnly && engine.canUndo}
          onUndo={engine.undo}
          onRestart={onRestartMatch && !readOnly ? () => setShowRestartConfirm(true) : undefined}
        />
      ) : (
        <>
          {engine.noPartnerAvailable && (
            <div className="relative overflow-hidden flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-gold/[0.09] to-gold/[0.03] backdrop-blur-xl border border-gold/25 mb-3">
              <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
              <span className="innings-status-icon-badge w-11 h-11 rounded-xl flex items-center justify-center bg-gold/[0.14] border border-gold/35 text-gold flex-shrink-0">
                <AlertTriangle size={20} strokeWidth={2.2} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="innings-status-dot relative w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] font-cinzel text-gold/85">Last Man Batting</span>
                </div>
                <div className="font-cinzel text-sm font-black uppercase text-gray-100 leading-tight">No replacement left in the squad</div>
                <div className="text-[10.5px] text-gray-500 mt-0.5 leading-snug">
                  Wrap up {isSecondInnings ? "the match" : "this innings"} whenever you&apos;re ready.
                </div>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  className="flex-shrink-0 w-full sm:w-auto flex items-center justify-center gap-1.5 font-cinzel text-[11px] font-black uppercase tracking-wide rounded-lg px-4 py-2.5 bg-gold text-black shadow-[0_4px_18px_rgba(245,166,35,0.4)] hover:-translate-y-0.5 transition-all"
                  onClick={() => setShowEndInningsConfirm(true)}
                >
                  {isSecondInnings ? "End Match" : "End Innings"}
                  <ArrowRight size={14} strokeWidth={2.5} />
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4">
            <div className="font-cinzel tabular-nums text-3xl font-black text-white leading-none">
              {liveState.score.runs}
              <span className="text-gold">/{liveState.score.wickets}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-gray-400 font-cinzel">
              <span>{liveState.score.overs}.{liveState.score.balls} ov</span>
              <span className="text-gray-700">·</span>
              <span>RR {runRate}</span>
              <span className="text-gray-700">·</span>
              <span>{battingTeamLabel} batting</span>
              {isSecondInnings && liveState.target !== undefined && (
                <>
                  <span className="text-gray-700">·</span>
                  <span>Target {liveState.target}</span>
                  {runsNeeded !== undefined && (
                    <>
                      <span className="text-gray-700">·</span>
                      <span>
                        Need {runsNeeded}
                        {ballsRemaining !== undefined ? ` off ${ballsRemaining}` : ""}
                      </span>
                    </>
                  )}
                  {requiredRunRate && (
                    <>
                      <span className="text-gray-700">·</span>
                      <span>RRR {requiredRunRate}</span>
                    </>
                  )}
                </>
              )}
            </div>
            {!engine.noPartnerAvailable && !readOnly && (
              <SmallButton onClick={() => setShowEndInningsConfirm(true)} style={{ marginLeft: "auto" }}>
                <span className="text-red-400">{isSecondInnings ? "End Match" : "End Innings"}</span>
              </SmallButton>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Eyebrow>Who&apos;s Involved</Eyebrow>
              {!readOnly && (
                <button
                  type="button"
                  onClick={engine.newPartnership}
                  className="flex items-center gap-1.5 font-cinzel text-[9.5px] font-black uppercase tracking-wide rounded-full px-2.5 py-1.5 bg-white/[0.02] border border-gold/10 text-gray-500 hover:text-gold hover:border-gold/40 hover:bg-gold/[0.06] transition-all"
                >
                  <RotateCcw size={11} strokeWidth={2.4} />
                  New Partnership
                </button>
              )}
            </div>

            {/* Striker + Non-Striker in their own tinted group ("Batting
               Pair"), Bowler in a separate group with a different accent
               below — keeps the crew visually grouped even when it stacks
               on mobile. */}
            <div className="rounded-2xl p-2.5 pb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-[0.12em] font-cinzel text-gray-500">Batting Pair</span>
              </div>
              <div className="flex flex-row items-stretch gap-2 sm:gap-3">
                <div className="flex-1 min-w-0">
                  <CrewSlot
                    title="Striker *"
                    accentColor="#E8C468"
                    active={engine.activeSlot === "striker"}
                    onActivate={() => {
                      engine.setActiveSlot("striker");
                      if (!readOnly) setPlayerPicker("striker");
                    }}
                    displayName={liveState.striker.name}
                    imageUrl={liveState.striker.imageUrl}
                    statLine={liveState.striker.name ? `${liveState.striker.runs} (${liveState.striker.balls})` : undefined}
                    allPlayers={battingSquad}
                    onAssign={(p) => engine.assignPlayer("striker", p)}
                    onClear={() => engine.clearSlot("striker")}
                    placeholder="Select striker"
                    dismissedNames={engine.dismissedPlayers}
                    blockedName={liveState.nonStriker.name || undefined}
                    noReplacement={strikerNeedsReplacement}
                    readOnly={readOnly}
                    avatarSize={isMobile ? 36 : 48}
                  />
                </div>

                <button
                  type="button"
                  onClick={readOnly ? undefined : engine.swapStrike}
                  disabled={readOnly}
                  className={`self-center flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9 mt-5 sm:mt-0 rounded-full border border-gold/10 bg-white/[0.02] text-gray-500 flex items-center justify-center text-sm sm:text-lg leading-none transition-all ${
                    readOnly ? "opacity-40 cursor-not-allowed" : "hover:text-gold hover:border-gold/40 hover:bg-gold/[0.06] hover:scale-110"
                  }`}
                  title="Swap Strike"
                  aria-label="Swap strike between batters"
                >
                  ⇄
                </button>

                <div className="flex-1 min-w-0">
                  <CrewSlot
                    title="Non-Striker"
                    active={engine.activeSlot === "nonStriker"}
                    onActivate={() => {
                      engine.setActiveSlot("nonStriker");
                      if (!readOnly) setPlayerPicker("nonStriker");
                    }}
                    displayName={liveState.nonStriker.name}
                    imageUrl={liveState.nonStriker.imageUrl}
                    statLine={liveState.nonStriker.name ? `${liveState.nonStriker.runs} (${liveState.nonStriker.balls})` : undefined}
                    allPlayers={battingSquad}
                    onAssign={(p) => engine.assignPlayer("nonStriker", p)}
                    onClear={() => engine.clearSlot("nonStriker")}
                    placeholder="Select non-striker"
                    dismissedNames={engine.dismissedPlayers}
                    blockedName={liveState.striker.name || undefined}
                    noReplacement={nonStrikerNeedsReplacement}
                    readOnly={readOnly}
                    avatarSize={isMobile ? 36 : 48}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-2.5 pb-3 mt-1">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-[0.12em] font-cinzel text-gray-500">Bowling</span>
              </div>
              <CrewSlot
                title={`Bowler (${bowlingTeamLabel})`}
                accentColor="#60A5FA"
                active={engine.activeSlot === "bowler"}
                onActivate={() => {
                  engine.setActiveSlot("bowler");
                  if (!readOnly) setPlayerPicker("bowler");
                }}
                displayName={liveState.bowler.name}
                imageUrl={liveState.bowler.imageUrl}
                statLine={liveState.bowler.name ? `${liveState.bowler.overs}.${liveState.bowler.balls}-${liveState.bowler.maidens}-${liveState.bowler.runs}-${liveState.bowler.wickets}` : undefined}
                allPlayers={bowlingSquad}
                onAssign={(p) => engine.assignPlayer("bowler", p)}
                placeholder="Select bowler"
                readOnly={readOnly}
              />
            </div>

            {/* Desktop-only inline carousel — hidden under 640px in favor
             of the tap-to-open overlay above. */}
            <div className="mt-3 hidden sm:block">
              <Eyebrow className="block mb-1.5">
                {engine.activeSlot === "bowler"
                  ? `Pick from ${bowlingTeamLabel}`
                  : `Pick from ${battingTeamLabel}`}
              </Eyebrow>

              <PlayerCarousel
                players={engine.activeSlot === "bowler" ? bowlingSquad : battingSquad}
                onSelect={(p) => engine.assignPlayer(engine.activeSlot, p)}
                emptyLabel="No squad loaded for this side yet — add one in Match Setup."
                dismissedNames={engine.activeSlot === "bowler" ? undefined : engine.dismissedPlayers}
                roleByName={engine.activeSlot === "bowler" ? bowlingRoleMap : battingRoleMap}
                disabled={readOnly}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Eyebrow>This Ball</Eyebrow>
            </div>

            <div className="flex flex-col gap-2.5 p-3 pb-3.5 rounded-2xl bg-white/[0.02] border border-gold/10 mb-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => !readOnly && engine.canUndo && engine.undo()}
                  disabled={readOnly || !engine.canUndo}
                  className="flex items-center gap-1.5 font-cinzel text-[10.5px] font-black uppercase tracking-wide rounded-full px-3.5 py-1.5 bg-amber-400/10 border border-amber-400/35 text-amber-400 hover:bg-amber-400/[0.18] hover:border-amber-400/55 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  title={engine.canUndo ? "Undo the last scored ball — reverses runs, extras, and wickets alike" : "Nothing to undo yet"}
                >
                  <Undo2 size={13} strokeWidth={2.4} />
                  Undo
                </button>

                <button
                  type="button"
                  onClick={() => !readOnly && engine.setIsFreeHit((v) => !v)}
                  disabled={readOnly}
                  className={`free-hit-toggle flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border transition-all flex-shrink-0 ${
                    engine.isFreeHit ? "is-active bg-sky-400/[0.14] border-sky-400/50" : "bg-white/[0.02] border-gold/10"
                  } ${readOnly ? "opacity-50 cursor-not-allowed" : ""}`}
                  title={engine.isFreeHit ? "Free Hit is active — tap to cancel" : "Tap to manually mark this ball a Free Hit"}
                >
                  <span className={`relative w-[30px] h-[18px] rounded-full flex-shrink-0 transition-colors ${engine.isFreeHit ? "bg-sky-400/35" : "bg-white/10"}`}>
                    <span
                      className={`free-hit-thumb absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full transition-transform ${engine.isFreeHit ? "translate-x-3 bg-sky-400 shadow-[0_0_6px_rgba(96,165,250,0.7)]" : "bg-gray-400"}`}
                    />
                  </span>
                  <span className="flex flex-col items-start leading-tight">
                    <span className={`font-cinzel text-[10px] font-black uppercase tracking-wide ${engine.isFreeHit ? "text-sky-400" : "text-gray-300"}`}>Free Hit</span>
                    <span className={`font-cinzel text-[9px] font-semibold ${engine.isFreeHit ? "text-sky-400" : "text-gray-500"}`}>{engine.isFreeHit ? "Active" : "Off"}</span>
                  </span>
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest font-cinzel text-gray-500">Extra</span>
                <SegmentedControl options={EXTRA_OPTIONS} value={engine.extraType} onChange={(v) => !readOnly && engine.setExtraType(v as ExtraType)} />
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2" style={readOnly ? { opacity: 0.5, pointerEvents: "none" } : undefined}>
              {[0, 1, 2, 3, 4, 6].map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={readOnly}
                  onClick={() => handleScoreBall(r as 0 | 1 | 2 | 3 | 4 | 6)}
                  className={`font-cinzel text-lg font-black rounded-xl py-3.5 border transition-all ${
                    r === 4 || r === 6
                      ? "bg-gold/[0.08] border-gold/35 text-gold hover:bg-gold/[0.16] hover:border-gold/60"
                      : "bg-white/[0.02] border-gold/10 text-gray-100 hover:border-gold/30 hover:bg-white/[0.05]"
                  }`}
                >
                  {r}
                </button>
              ))}
              <button
                type="button"
                disabled={readOnly}
                onClick={handleRecordWicket}
                className="col-span-2 sm:col-span-1 font-cinzel text-sm font-black uppercase tracking-wide rounded-xl py-3.5 border bg-red-500/[0.1] border-red-400/40 text-red-400 hover:bg-red-500/[0.18] hover:border-red-400/60 transition-all"
              >
                OUT
              </button>
            </div>
            <p className="text-[9px] mt-2 font-cinzel text-gray-500">
              {readOnly
                ? "Auto-demo is currently driving this match — switch to \"Try It Yourself\" to take over scoring."
                : <>Pick an extra type first if this ball is a wide / no ball / bye / leg bye. Fours, sixes, and fifty/hundred milestones
                fire automatically.</>}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl p-3 bg-white/[0.02] border border-gold/10">
              <FieldLabel>Partnership</FieldLabel>
              <span className="font-cinzel tabular-nums text-sm font-bold text-gray-100">{liveState.partnership.runs} ({liveState.partnership.balls})</span>
            </div>
            <div className="rounded-xl p-3 bg-white/[0.02] border border-gold/10">
              <FieldLabel>Match 4s / 6s</FieldLabel>
              <span className="font-cinzel tabular-nums text-sm font-bold text-gray-100">{liveState.matchBoundaries.fours} / {liveState.matchBoundaries.sixes}</span>
            </div>
            <div className="rounded-xl p-3 bg-white/[0.02] border border-gold/10">
              <FieldLabel>Tourn. 4s / 6s</FieldLabel>
              <span className="font-cinzel tabular-nums text-sm font-bold text-gray-100">{liveState.tournamentBoundaries.fours} / {liveState.tournamentBoundaries.sixes}</span>
            </div>
            <div className="rounded-xl p-3 bg-white/[0.02] border border-gold/10">
              <FieldLabel>Bowler Figures</FieldLabel>
              <span className="font-cinzel tabular-nums text-sm font-bold text-gray-100">{liveState.bowler.overs}.{liveState.bowler.balls}-{liveState.bowler.maidens}-{liveState.bowler.runs}-{liveState.bowler.wickets}</span>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <PrimaryButton onClick={onPush} minWidth={180} disabled={readOnly}>
          {pushLabel}
        </PrimaryButton>
      </div>
    </DrawerSection>
  );
});

export default LiveStatePanel;