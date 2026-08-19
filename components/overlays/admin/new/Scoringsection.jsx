"use client";

import CricketBall from "@/components/overlays/shared/CricketBall"

const GOLD_GRADIENT = "linear-gradient(135deg,#A87815,#E8C468)";

function initials(name) {
  return (name || "").split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "—";
}
function Icon({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
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
          <button onClick={onClose} className="h-7 w-7 rounded-full flex items-center justify-center border border-white/10 text-on-surface-variant shrink-0">
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
     element via onDragOver/onDrop) ── */
function CrewSlot({
  title, accentColor, active, onActivate, displayName, statLine,
  onAssign, onClear, placeholder, dismissedNames, blockedName,
  noReplacement, avatarSize,
}) {
  const size = avatarSize ?? 44;
  const isEmpty = !displayName;

  if (noReplacement && isEmpty) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3">
        <p className="font-mono-geist text-[9px] uppercase tracking-[0.14em] font-bold text-on-surface-variant mb-2">{title}</p>
        <div className="flex items-center gap-2.5">
          <span className="rounded-full flex items-center justify-center opacity-50" style={{ width: size, height: size, border: "1px solid rgba(255,255,255,0.15)" }}>—</span>
          <span className="text-[10px] font-mono-geist font-bold text-on-surface-variant">No replacement left in the squad</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onActivate}
      className="rounded-xl p-3 cursor-pointer transition-all"
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
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-mono-geist text-[9px] uppercase tracking-[0.14em] font-bold" style={{ color: isEmpty ? "#f87171" : accentColor || "rgba(255,255,255,0.4)" }}>
          {isEmpty ? "⚠ " : ""}{title}
        </span>
        <div className="flex items-center gap-2">
          {active && <span className="font-mono-geist text-[8.5px] text-theme-orange/70 hidden sm:inline">drag or tap a player ▾</span>}
          {!isEmpty && onClear && (
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center text-on-surface-variant hover:text-red-400 shrink-0"
            >
              <Icon name="close" style={{ fontSize: 12 }} />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="rounded-full flex items-center justify-center shrink-0 font-mono-geist font-bold" style={{ width: size, height: size, border: "1px solid rgba(255,255,255,0.15)", fontSize: Math.max(9, size * 0.26), color: isEmpty ? "#f87171" : "#e5e7eb" }}>
          {displayName ? initials(displayName) : "+"}
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-[12px] font-archivo font-bold truncate text-on-surface">{displayName || placeholder}</span>
          {statLine && <span className="text-[10px] font-mono-geist text-on-surface-variant">{statLine}</span>}
        </div>
      </div>
    </div>
  );
}

const extraOptions = ["Wide", "No Ball", "Bye", "Leg Bye", "Free Hit"];
const extraKeyFor = (label) => ({ Wide: "Wd", "No Ball": "Nb", Bye: "By", "Leg Bye": "Lb" }[label]);

/**
 * Center "Live State" scorer card — score header, target line, the
 * Striker/Non-Striker/Bowler crew slots (+ mobile picker sheet), strike
 * rotation / end-innings / undo controls, extras, the run pad, and the
 * partnership/boundary stat strip underneath.
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
  extraMode, setExtraMode, freeHit, setFreeHit, extras,
  handleRun, handleOut, handleUndo, history,
  endInnings, pushLiveState, livePushed, liveDirty,
  statCards,
  battingRoleMap, bowlingRoleMap,
}) {
  return (
    <section className={`order-1 lg:order-2 flex-col lg:h-full p-3 lg:p-4 gap-4 lg:overflow-y-auto custom-scrollbar ${mobileTab === "scoring" ? "flex" : "hidden"} lg:flex`}>
      {/* mobile bottom-sheet picker for whichever slot is active */}
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

      <div className="relative overflow-hidden px-2 shrink-0">
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

        <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
          <div className="flex items-baseline gap-2 sm:gap-3 min-w-0 flex-1">
            <span className="font-archivo text-3xl sm:text-5xl font-bold tabular-nums shrink-0">{teamRuns}/{wkts}</span>
            <span className="font-mono-geist text-[9px] sm:text-[11px] text-on-surface-variant uppercase tracking-[0.1em] truncate">{overs} ov · RR {rr} · {matchSetup[battingTeam]} batting{inningsNumber === 2 ? " · Inns 2" : ""}</span>
          </div>
          <button
            onClick={pushLiveState}
            className="flex items-center gap-1.5 font-mono-geist text-[10px] font-bold uppercase tracking-[0.16em] px-3 sm:px-4 py-2 rounded transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 shrink-0"
            style={{ background: liveDirty ? GOLD_GRADIENT : "rgba(255,255,255,0.05)", color: liveDirty ? "#1a1304" : "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Icon name="cloud_upload" style={{ fontSize: 13 }} />
            <span className="hidden sm:inline">{livePushed ? "Pushed ✓" : "Push Live State"}</span>
            <span className="sm:hidden">{livePushed ? "✓" : "Push"}</span>
          </button>
        </div>

        {inningsNumber === 2 && target !== null && (
          <p className="font-mono-geist text-[10px] sm:text-[11px] text-theme-orange uppercase tracking-[0.1em] mb-3 relative z-10">
            Target {target} · Need {runsNeeded} off {ballsLeft ?? "—"} balls{requiredRate ? ` · RRR ${requiredRate}` : ""}
          </p>
        )}
        {inningsNumber === 1 && <div className="mb-3" />}

        {/* Striker / Non-Striker / Bowler — drag a name in (desktop roster rail),
           or tap to open the mobile picker sheet. */}
        <div className="mb-3 relative z-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <CrewSlot
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
            <div className="col-span-2 sm:col-span-1">
              <CrewSlot
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

        <div className="flex items-center gap-2 flex-wrap mb-5 pt-2 relative z-10">
          <button
            onClick={() => { const s = striker; setStriker(nonStriker); setNonStriker(s); }}
            className="flex items-center gap-1.5 font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded text-theme-orange border border-theme-orange/20"
          >
            <Icon name="swap_horiz" style={{ fontSize: 13 }} /> Rotate Strike
          </button>
          {inningsNumber === 1 && (
            <button
              onClick={endInnings}
              className="flex items-center gap-1.5 font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded text-theme-orange border border-theme-orange/20"
            >
              <Icon name="sports_score" style={{ fontSize: 13 }} /> End Innings
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mb-4 relative z-10">
        {/* Extras */}
        <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.14em]">
            Extras total — Wd {extras.Wd} · Nb {extras.Nb} · By {extras.By} · Lb {extras.Lb} · Free Hit {extras.FreeHit}
        </p>

        {/* Current Over */}
        <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.14em] font-bold">
            Current Over:
            </span>

            <div className="flex items-center gap-1.5">
            {Array.from({ length: 6 }, (_, i) => (
                <CricketBall key={i}>{i + 1}</CricketBall>
            ))}
            </div>
        </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 relative z-10">
        {/* Runs */}
        {[0, 1, 2, 3, 4, 6].map((n) => (
            <button
            key={n}
            onClick={() => handleRun(n)}
            className="min-h-14 rounded-lg py-3.5 sm:py-4 font-archivo text-lg sm:text-xl font-bold transition-all hover:brightness-110 active:scale-95 border border-white/10"
            style={
                n === 4 || n === 6
                ? {
                    background: GOLD_GRADIENT,
                    color: "#1a1304",
                    border: "1px solid rgba(255,255,255,0.1)",
                    }
                : {
                    background: "rgba(255,255,255,0.03)",
                    }
            }
            >
            {n}
            </button>
        ))}

        {/* Out */}
        <button
            onClick={handleOut}
            disabled={freeHit}
            className="min-h-14 rounded-lg py-3.5 sm:py-4 font-mono-geist text-sm sm:text-base font-bold uppercase tracking-[0.14em] transition-all hover:brightness-110 active:scale-95 bg-error-container text-on-error-container border border-white/10 disabled:opacity-30"
        >
            Out
        </button>

        {/* Undo */}
        <button
            onClick={() => handleRun("Undo")}
            className="min-h-14 rounded-lg py-3.5 sm:py-4 font-mono-geist text-sm sm:text-base font-bold uppercase tracking-[0.14em] transition-all hover:brightness-110 active:scale-95 border"
            style={{
            background: "rgba(156,163,175,0.12)",
            color: "#d1d5db",
            border: "1px solid rgba(156,163,175,0.25)",
            }}
        >
            Undo
        </button>

        {/* Extras */}
        {["Wide", "No Ball", "LB", "Bye"].map((n) => (
            <button
            key={n}
            onClick={() => handleRun(n)}
            className="min-h-14 rounded-lg py-3.5 sm:py-4 font-archivo text-sm sm:text-base font-bold transition-all hover:brightness-110 active:scale-95 border"
            style={
                n === "Wide" || n === "No Ball"
                ? {
                    background: "rgba(245,158,11,0.18)",
                    color: "#fbbf24",
                    border: "1px solid rgba(245,158,11,0.35)",
                    }
                : {
                    background: "rgba(59,130,246,0.15)",
                    color: "#93c5fd",
                    border: "1px solid rgba(59,130,246,0.35)",
                    }
            }
            >
            {n}
            </button>
        ))}

        {/* Free Hit */}
        <button
            onClick={() => handleRun("Free Hit")}
            className="min-h-14 rounded-lg py-3.5 sm:py-4 font-mono-geist text-sm sm:text-base font-bold uppercase tracking-[0.14em] transition-all hover:brightness-110 active:scale-95 border"
            style={{
            background: "rgba(139,92,246,0.18)",
            color: "#c4b5fd",
            border: "1px solid rgba(139,92,246,0.35)",
            }}
        >
            Free Hit
        </button>

        {/* Bonus */}
        <button
            onClick={() => handleRun("Bonus")}
            className="min-h-14 rounded-lg py-3.5 sm:py-4 font-mono-geist text-sm sm:text-base font-bold uppercase tracking-[0.14em] transition-all hover:brightness-110 active:scale-95 border"
            style={{
            background: "rgba(34,197,94,0.18)",
            color: "#86efac",
            border: "1px solid rgba(34,197,94,0.35)",
            }}
        >
            Bonus
        </button>

        {/* Injured */}
        <button
            onClick={() => handleRun("Injured")}
            className="min-h-14 rounded-lg py-3.5 sm:py-4 font-mono-geist text-sm sm:text-base font-bold uppercase tracking-[0.14em] transition-all hover:brightness-110 active:scale-95 border"
            style={{
            background: "rgba(249,115,22,0.18)",
            color: "#fdba74",
            border: "1px solid rgba(249,115,22,0.35)",
            }}
        >
            Injured
        </button>

        {/* Abandon */}
        <button
            onClick={() => handleRun("Abandon")}
            className="min-h-14 rounded-lg py-3.5 sm:py-4 font-mono-geist text-sm sm:text-base font-bold uppercase tracking-[0.14em] transition-all hover:brightness-110 active:scale-95 border"
            style={{
            background: "rgba(127,29,29,0.45)",
            color: "#fecaca",
            border: "1px solid rgba(239,68,68,0.35)",
            }}
        >
            Abandon
        </button>
        </div>
        
      </div>

      {/* Partnership / boundary stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 mb-2">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl px-4 py-3 glass-panel">
            <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.16em] font-bold mb-1">{s.label}</p>
            <p className="font-archivo text-lg font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}