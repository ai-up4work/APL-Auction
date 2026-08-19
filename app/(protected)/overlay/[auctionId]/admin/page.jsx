"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/* ─────────────────────────────────────────────────────────────
   Same auction-console visual language as before, now with the
   Striker / Non-Striker / Bowler slots picked the way the old
   admin panel did it:

     • Desktop  — a slot is a drop target. A draggable roster
                   strip appears under whichever slot is active
                   (batting roster for Striker/Non-Striker, the
                   left-rail roster for Bowler) — drag a player
                   in, or just tap them.
     • Mobile   — tapping a slot opens a bottom-sheet picker
                   instead, since there's no drag surface worth
                   using on a phone.

   Everything else (moments, weather, on-air toggles, event log)
   is unchanged from the previous pass.
   ───────────────────────────────────────────────────────────── */

const GOLD_GRADIENT = "linear-gradient(135deg,#A87815,#E8C468)";
const PARTICLE_COLORS_BOUNDARY = ["#E8C468", "#A87815", "#FDECC8", "#ffffff"];
const PARTICLE_COLORS_WICKET   = ["#718096", "#A0AEC0", "#CBD5E0", "#E2E8F0"];
const DEFAULT_LOGO_SRC = "/valiant-league-logo.png";

const AMBIENT_CHANNELS = [
  { key: "weather", label: "Weather" },
  { key: "liveScoreBar", label: "Live Score Bar" },
  { key: "tournamentLogo", label: "Tournament Logo" },
];

const BOUNDARY_CHANNELS = [
  { key: "matchBoundaries", label: "Match Boundaries" },
  { key: "tournamentBoundaries", label: "Tournament Boundaries" },
];

const FULLSCREEN_CHANNELS = [
  { key: "pointsTable", label: "Points Table" },
  { key: "matchScorecard", label: "Match Scorecard" },
  { key: "matchIntro", label: "Match Intro" },
];


let idCtr = 0;

function initials(name) {
  return (name || "").split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "—";
}
function timeNow() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}
function Icon({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

/* Tracks whether we're under the 640px mobile breakpoint so the crew
   slots can swap the inline drag strip for a tap-to-open bottom sheet. */
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

/* ── small shared pieces ─────────────────────────────────────── */
function TogglePill({ label, on, onClick, dotColor }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 font-mono-geist text-[10px] uppercase tracking-[0.12em] font-bold px-3 py-1.5 rounded transition-all shrink-0"
      style={{
        background: on ? `${dotColor}1a` : "rgba(255,255,255,0.03)",
        border: `1px solid ${on ? `${dotColor}40` : "rgba(255,255,255,0.08)"}`,
        color: on ? "#e5e7eb" : "rgba(255,255,255,0.4)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: on ? dotColor : "#4b5563" }} />
      {label}
    </button>
  );
}
/* `center` renders the label centered with no trailing margin, for use
   as a heading sitting above a row of toggle pills rather than inline
   before them. */
function GroupLabel({ children, center }) {
  return (
    <span
      className={`font-mono-geist text-[9px] text-theme-orange uppercase tracking-[0.2em] font-bold shrink-0 ${
        center ? "text-center" : "mr-1"
      }`}
    >
      {children}
    </span>
  );
}
/* Mobile-only channel row: bigger tap target than the desktop pill,
   with an icon chip + full-width label + a proper switch on the right. */
function MobileChannelRow({ icon, label, on, onClick, dotColor }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all active:scale-[0.98]"
      style={{
        background: on ? `${dotColor}14` : "rgba(255,255,255,0.02)",
        border: `1px solid ${on ? `${dotColor}40` : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <span
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: on ? `${dotColor}22` : "rgba(255,255,255,0.04)",
          border: `1px solid ${on ? `${dotColor}40` : "rgba(255,255,255,0.08)"}`,
        }}
      >
        <Icon name={icon} style={{ fontSize: 18, color: on ? dotColor : "rgba(255,255,255,0.4)" }} />
      </span>
      <span className="flex-1 text-left font-archivo text-sm font-bold" style={{ color: on ? "#e5e7eb" : "rgba(255,255,255,0.55)" }}>
        {label}
      </span>
      <span className="relative h-6 w-10 rounded-full shrink-0 transition-colors" style={{ background: on ? dotColor : "rgba(255,255,255,0.15)" }}>
        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-black transition-all" style={{ left: on ? "18px" : "2px" }} />
      </span>
    </button>
  );
}
function MomentButton({ label, onClick, active, danger, full }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em] px-3 py-3 rounded-lg transition-all hover:brightness-110 active:scale-95 ${full ? "col-span-2" : ""}`}
      style={
        danger
          ? { background: active ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" }
          : active
          ? { background: "rgba(201,151,31,0.16)", border: "1px solid rgba(201,151,31,0.4)", color: "#e8c468" }
          : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }
      }
    >
      {label}
    </button>
  );
}
function BatterPickerButton({ batter, label, selected, onClick }) {
  return (
    <button
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

/* ── roster strip: draggable + clickable, used under the active slot ── */
function PlayerCarousel({ players, onSelect, teamLabel, dismissedNames, roleByName, disabled }) {
  if (!players || players.length === 0) {
    return <p className="font-mono-geist text-[10px] text-on-surface-variant py-1">No squad loaded for {teamLabel}.</p>;
  }
  const allUnavailable = players.every((name) => dismissedNames?.has(name) || !!roleByName?.get(name));
  if (allUnavailable) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10">
        <Icon name="person_off" className="text-on-surface-variant shrink-0" style={{ fontSize: 18 }} />
        <div className="flex flex-col">
          <span className="font-archivo text-xs font-bold uppercase">All out of batters</span>
          <span className="font-mono-geist text-[9px] text-on-surface-variant">Every player is out or already at the crease.</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {players.map((name) => {
        const isOut = !!dismissedNames?.has(name);
        const roleInfo = roleByName?.get(name);
        const isLocked = isOut || !!roleInfo || !!disabled;
        const roleLabel = roleInfo?.role === "striker" ? "On Strike" : roleInfo?.role === "nonStriker" ? "Non-Striker" : roleInfo?.role === "bowler" ? "Bowling" : undefined;
        return (
          <button
            key={name}
            type="button"
            draggable={!isLocked}
            disabled={isLocked}
            onDragStart={(e) => {
              if (isLocked) { e.preventDefault(); return; }
              e.dataTransfer.setData("text/player-name", name);
            }}
            onClick={() => !isLocked && onSelect(name)}
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all"
            style={
              isOut
                ? { opacity: 0.55, cursor: "not-allowed", background: "rgba(239,68,68,0.08)", borderColor: "rgba(248,113,113,0.4)" }
                : roleInfo
                ? { opacity: 0.85, cursor: "not-allowed", background: "rgba(34,197,94,0.08)", borderColor: "rgba(74,222,128,0.4)" }
                : disabled
                ? { opacity: 0.45, cursor: "not-allowed", background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }
                : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }
            }
            title={isOut ? `${name} — already out this innings` : roleInfo ? `${name} — currently ${roleLabel}` : name}
          >
            <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-mono-geist text-[9px] font-bold" style={{ border: "1px solid rgba(255,255,255,0.15)", color: isOut ? "#f87171" : roleInfo ? "#4ade80" : "#e5e7eb" }}>
              {initials(name)}
            </span>
            <span className="text-[11px] font-archivo font-bold max-w-[110px] truncate" style={{ color: isOut ? "#f87171" : roleInfo ? "#4ade80" : "#e5e7eb" }}>
              {name}{isOut ? " · OUT" : roleLabel ? ` · ${roleLabel}` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── mobile bottom sheet: same roster, tap to pick ── */
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
     opens the picker (sheet on mobile, inline strip below on desktop) ── */
function CrewSlot({
  title, accentColor, active, onActivate, displayName, statLine,
  allNames, onAssign, onClear, placeholder, dismissedNames, blockedName,
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

const emptyBatter = () => ({ name: "", runs: 0, balls: 0, fours: 0, sixes: 0 });
const emptyBowler = () => ({ name: "", overs: 0, balls: 0, runs: 0, wickets: 0 });

export default function OverlayAdminConsole() {
  /* ── On Air channel toggles ── */
  const [alwaysOn, setAlwaysOn] = useState({ weather: true, liveScoreBar: true, tournamentLogo: true });
  const [fullScreen, setFullScreen] = useState({ pointsTable: false, matchScorecard: false, matchIntro: false });
  /* ── Moments/boundary broadcast toggles (Match Boundaries, Tournament
     Boundaries) — shown in both the desktop sticky bar and the mobile
     Broadcast Channels card. ── */
  const [boundaryChannels, setBoundaryChannels] = useState({ matchBoundaries: false, tournamentBoundaries: false });

  /* ── Match Setup ── */
  const [matchSetup] = useState({
    teamA: "JSH", teamAColor: "#bd932d", teamAlogo: "/logos/jsh.png",  
    teamB: "MWR", teamBColor: "#3d9dd8", teamBlogo: "/logos/mwr.png",   
    venue: "Galle Fort", format: "T20", matchTitle: "Semi Final 1",
    tossWinner: "teamA", tossElected: "bat",
  });
  const [setupEditing, setSetupEditing] = useState(false);
  const [setupPushed, setSetupPushed] = useState(false);

  /* ── Which side is currently at the crease ── */
  const [battingTeam, setBattingTeam] = useState("teamA");
  const bowlingTeam = battingTeam === "teamA" ? "teamB" : "teamA";

  /* ── Live scoring state ── */
  const [striker, setStriker] = useState(emptyBatter());
  const [nonStriker, setNonStriker] = useState(emptyBatter());
  const [bowler, setBowler] = useState(emptyBowler());
  const [wkts, setWkts] = useState(0);
  const [legalBalls, setLegalBalls] = useState(0);
  const [freeHit, setFreeHit] = useState(false);
  const [extraMode, setExtraMode] = useState(null);
  const [history, setHistory] = useState([]);
  const [partnership, setPartnership] = useState({ runs: 0, balls: 0 });
  const [matchBoundaries, setMatchBoundaries] = useState({ fours: 0, sixes: 0 });
  const [extras, setExtras] = useState({ Wd: 0, Nb: 0, By: 0, Lb: 0 });
  const [teamRuns, setTeamRuns] = useState(0);
  const [livePushed, setLivePushed] = useState(false);
  const [liveDirty, setLiveDirty] = useState(false);

  /* ── who's out this innings, and which slot is "active" for picking ── */
  const [dismissedPlayers, setDismissedPlayers] = useState(() => new Set());
  const [activeSlot, setActiveSlot] = useState("striker");
  const [playerPicker, setPlayerPicker] = useState(null); // mobile sheet: null | 'striker' | 'nonStriker' | 'bowler'
  const isMobile = useIsMobile();
  const [logoFailed, setLogoFailed] = useState(false);

  /* ── Mobile-only bottom-nav tabs: Scoring / Overlay / Setup.
     Desktop (lg+) always shows everything and ignores this — every
     gated block below uses `hidden ... lg:flex|block` so the `hidden`
     only ever applies under the lg breakpoint. ── */
  const [mobileTab, setMobileTab] = useState("scoring"); // 'scoring' | 'overlay' | 'setup'

  /* ── Innings / target tracking ── */
  const [inningsNumber, setInningsNumber] = useState(1);
  const [firstInnings, setFirstInnings] = useState(null); // { runs, wkts, overs, team }

  const rosterTeamA = ["Ravindu Bandara", "Chamika Silva", "Isuru Weerasekara", "Nadun Karunaratne", "Lakindu Peris", "Tharindu Costa", "Ashen Gunaratne", "Binura Jayasuriya"];
  const rosterTeamB = ["Hasitha Perera", "Niroshan Jay", "Kavindu Silva", "Danushka Mendis", "Sahan Fernando", "Kaveen Mendis", "Yohan Raj", "Kusal Fernando"];
  const battingRoster = battingTeam === "teamA" ? rosterTeamA : rosterTeamB;
  const bowlingRoster = bowlingTeam === "teamA" ? rosterTeamA : rosterTeamB;

  const battingRoleMap = (() => {
    const m = new Map();
    if (striker.name) m.set(striker.name, { role: "striker" });
    if (nonStriker.name) m.set(nonStriker.name, { role: "nonStriker" });
    return m;
  })();
  const bowlingRoleMap = (() => {
    const m = new Map();
    if (bowler.name) m.set(bowler.name, { role: "bowler" });
    return m;
  })();

  function assignBatter(slot, name) {
    if (dismissedPlayers.has(name)) return;
    const blocked = slot === "striker" ? nonStriker.name : striker.name;
    if (name === blocked) return;
    const fresh = { ...emptyBatter(), name };
    if (slot === "striker") setStriker(fresh); else setNonStriker(fresh);
    pushLog(`${slot === "striker" ? "Striker" : "Non-Striker"} set — ${name}`);
  }
  function assignBowler(name) {
    setBowler((b) => (b.name === name ? emptyBowler() : { ...emptyBowler(), name }));
    pushLog(`Bowler set — ${name}`);
  }

  // The left rail is the *only* pick/drop list on desktop — it swaps
  // between the batting squad and the bowling squad depending on which
  // crew slot is currently active, instead of duplicating a second list
  // under the scorer card.
  const isBattingSlotActive = activeSlot === "striker" || activeSlot === "nonStriker";
  const asideTeamKey = isBattingSlotActive ? battingTeam : bowlingTeam;
  const asideRoster = isBattingSlotActive ? battingRoster : bowlingRoster;
  const asideDismissed = isBattingSlotActive ? dismissedPlayers : undefined;
  const asideRoleMap = isBattingSlotActive ? battingRoleMap : bowlingRoleMap;
  function assignFromAsideList(name) {
    if (isBattingSlotActive) assignBatter(activeSlot, name);
    else assignBowler(name);
  }

  /* ── Moments panel ── */
  const [showMoments, setShowMoments] = useState(true);
  const [showWicketForm, setShowWicketForm] = useState(false);
  const [wicketDraft, setWicketDraft] = useState({ batsmanOut: "striker", dismissalType: "bowled", fielder: "" });
  const [milestoneBatter, setMilestoneBatter] = useState("striker");
  const [showMatchWonForm, setShowMatchWonForm] = useState(false);
  const [matchWonDraft, setMatchWonDraft] = useState({ winner: "teamA", customName: "", margin: "", method: "batting" });

  /* ── Weather ── */
  const [weather, setWeather] = useState({ venue: "GALLE FORT", temp: 28, condition: "partly-cloudy" });
  const [weatherEditing, setWeatherEditing] = useState(false);

  /* ── Event feed — bottom-right stacked cards, one per ball/action.
     Replaces the old top-center single toast + separate Event Log list. */
  const [toasts, setToasts] = useState([]);
  const toastTimers = useRef(new Map());
  useEffect(() => {
    const timers = toastTimers.current;
    return () => { timers.forEach((t) => clearTimeout(t)); timers.clear(); };
  }, []);
  const [particles, setParticles] = useState([]);
  const [stamp, setStamp] = useState(null);
  const [glowActive, setGlowActive] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const stampTimeout = useRef(null);
  const flashTimeout = useRef(null);
  useEffect(() => () => { clearTimeout(stampTimeout.current); clearTimeout(flashTimeout.current); }, []);

  const overs = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
  const oversLimit = matchSetup.format === "T20" ? 20 : matchSetup.format === "ODI" ? 50 : null;
  const rr = legalBalls > 0 ? (teamRuns / (legalBalls / 6)).toFixed(2) : "0.00";

  /* ── second-innings chase numbers ── */
  const target = firstInnings ? firstInnings.runs + 1 : null;
  const runsNeeded = target !== null ? Math.max(target - teamRuns, 0) : null;
  const ballsLeft = oversLimit !== null ? Math.max(oversLimit * 6 - legalBalls, 0) : null;
  const requiredRate = target !== null && ballsLeft ? (runsNeeded / (ballsLeft / 6)).toFixed(2) : null;

  function pushLog(label) {
    const id = idCtr++;
    const tone = /wicket/i.test(label) ? "wicket" : /FOUR|SIX|FIFTY|HUNDRED|WON/.test(label) ? "boundary" : "info";
    setToasts((prev) => [...prev, { id, text: label, tone }].slice(-5));
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      toastTimers.current.delete(id);
    }, 4000);
    toastTimers.current.set(id, timer);
  }
  function fireToast(msg) {
    pushLog(msg);
  }
  function spawnParticles(colors) {
    const created = Array.from({ length: 40 }, () => ({
      id: idCtr++,
      tx: (Math.random() - 0.5) * 900,
      ty: (Math.random() - 0.5) * 900,
      duration: 1 + Math.random() * 1.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setParticles((prev) => [...prev, ...created]);
    created.forEach((p) => setTimeout(() => setParticles((prev) => prev.filter((x) => x.id !== p.id)), p.duration * 1000));
  }
  function fireStamp(kind, label) {
    clearTimeout(stampTimeout.current);
    setStamp({ kind, label });
    setGlowActive(true);
    setFlashActive(true);
    flashTimeout.current = setTimeout(() => setFlashActive(false), 100);
    stampTimeout.current = setTimeout(() => { setStamp(null); setGlowActive(false); }, 1400);
  }

  /* ── push actions (simulated overlay bus) ── */
  function pushMatchSetup() {
    setSetupEditing(false);
    setSetupPushed(true);
    pushLog(`Match Setup pushed — ${matchSetup.teamA} vs ${matchSetup.teamB}, ${matchSetup.venue}`);
    setTimeout(() => setSetupPushed(false), 1500);
  }
  function pushLiveState() {
    setLivePushed(true);
    setLiveDirty(false);
    pushLog("Live State pushed to overlay");
    setTimeout(() => setLivePushed(false), 1500);
  }

  /* ── scoring ── */
  function snapshot() {
    return { striker, nonStriker, bowler, wkts, legalBalls, partnership, matchBoundaries, extras, teamRuns };
  }
  function record(runsAdded, { wicket = false, extra = null } = {}) {
    setHistory((h) => [...h, snapshot()]);
    const isLegal = !["Wd", "Nb"].includes(extra);

    setStriker((s) => ({ ...s, runs: s.runs + (extra ? 0 : runsAdded), balls: s.balls + (isLegal ? 1 : 0), fours: runsAdded === 4 && !extra ? s.fours + 1 : s.fours, sixes: runsAdded === 6 && !extra ? s.sixes + 1 : s.sixes }));
    if (wicket) setWkts((w) => w + 1);
    if (isLegal) setLegalBalls((b) => b + 1);
    setTeamRuns((r) => r + runsAdded);
    // Partnership tracks the CURRENT pair only — it resets when a wicket falls,
    // separate from the team's running total which never resets.
    setPartnership((p) => (wicket ? { runs: 0, balls: 0 } : { runs: p.runs + runsAdded, balls: p.balls + (isLegal ? 1 : 0) }));
    if (extra) setExtras((ex) => ({ ...ex, [extra]: ex[extra] + 1 }));
    if (runsAdded === 4 && !extra) setMatchBoundaries((m) => ({ ...m, fours: m.fours + 1 }));
    if (runsAdded === 6 && !extra) setMatchBoundaries((m) => ({ ...m, sixes: m.sixes + 1 }));
    setBowler((f) => {
      const balls = f.balls + (isLegal ? 1 : 0);
      return { ...f, overs: Math.floor(balls / 6), balls: balls % 6, runs: f.runs + runsAdded, wickets: f.wickets + (wicket ? 1 : 0) };
    });
    setLiveDirty(true);

    if (wicket) {
      fireStamp("wicket", "OUT");
      spawnParticles(PARTICLE_COLORS_WICKET);
      pushLog(`Ball — Wicket! ${striker.name || "Striker"} b ${bowler.name || "bowler"}`);
      setShowWicketForm(true);
    } else if (runsAdded === 4 && !extra) {
      fireStamp("boundary", "FOUR");
      spawnParticles(PARTICLE_COLORS_BOUNDARY);
      pushLog(`Moment: FOUR — ${striker.name || "Striker"} ${striker.runs + 4}(${striker.balls + 1})`);
    } else if (runsAdded === 6 && !extra) {
      fireStamp("boundary", "SIX");
      spawnParticles(PARTICLE_COLORS_BOUNDARY);
      pushLog(`Moment: SIX — ${striker.name || "Striker"} ${striker.runs + 6}(${striker.balls + 1})`);
    } else {
      pushLog(`Ball — ${extra ? { Wd: "Wide", Nb: "No Ball", By: "Bye", Lb: "Leg Bye" }[extra] : runsAdded === 0 ? "Dot ball" : `${runsAdded} run${runsAdded === 1 ? "" : "s"}`}`);
    }
    const newRuns = striker.runs + (extra ? 0 : runsAdded);
    if (!extra && !wicket && (newRuns === 50 || newRuns === 100)) {
      fireMilestoneMoment(newRuns === 50 ? "fifty" : "hundred", "striker");
    }
    setExtraMode(null);
    setFreeHit(false);
  }
  function handleRun(n) {
    if (extraMode === "Wd" || extraMode === "Nb") return record(n + 1, { extra: extraMode });
    return record(n);
  }
  function handleOut() {
    if (freeHit) return;
    record(0, { wicket: true });
  }
  function handleUndo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setStriker(prev.striker); setNonStriker(prev.nonStriker); setBowler(prev.bowler);
    setWkts(prev.wkts); setLegalBalls(prev.legalBalls); setPartnership(prev.partnership); setMatchBoundaries(prev.matchBoundaries);
    setExtras(prev.extras); setTeamRuns(prev.teamRuns);
    setHistory((h) => h.slice(0, -1));
    fireToast("Last ball undone");
  }
  function handleClear() {
    setStriker(emptyBatter()); setNonStriker(emptyBatter()); setBowler(emptyBowler());
    setWkts(0); setLegalBalls(0); setHistory([]);
    setPartnership({ runs: 0, balls: 0 }); setMatchBoundaries({ fours: 0, sixes: 0 });
    setExtras({ Wd: 0, Nb: 0, By: 0, Lb: 0 }); setTeamRuns(0);
    setInningsNumber(1); setFirstInnings(null); setBattingTeam("teamA");
    setFreeHit(false); setExtraMode(null); setShowClearConfirm(false);
    setDismissedPlayers(new Set()); setActiveSlot("striker"); setPlayerPicker(null);
    pushLog("Innings cleared / match restarted");
    fireToast("Innings cleared");
  }
  function endInnings() {
    setFirstInnings({ runs: teamRuns, wkts, overs, team: matchSetup[battingTeam] });
    pushLog(`Innings break — ${matchSetup[battingTeam]} finished ${teamRuns}/${wkts} (${overs} ov)`);
    fireToast(`${matchSetup[battingTeam]} innings closed at ${teamRuns}/${wkts}`);
    setBattingTeam((t) => (t === "teamA" ? "teamB" : "teamA"));
    setStriker(emptyBatter()); setNonStriker(emptyBatter()); setBowler(emptyBowler());
    setWkts(0); setLegalBalls(0); setHistory([]);
    setPartnership({ runs: 0, balls: 0 }); setExtras({ Wd: 0, Nb: 0, By: 0, Lb: 0 });
    setTeamRuns(0);
    setInningsNumber(2);
    setDismissedPlayers(new Set()); setActiveSlot("striker"); setPlayerPicker(null);
  }

  /* ── Moments: manual fires ── */
  function fireBoundaryMoment(kind) {
    fireStamp("boundary", kind.toUpperCase());
    spawnParticles(PARTICLE_COLORS_BOUNDARY);
    pushLog(`Moment: ${kind.toUpperCase()} (manual) — ${striker.name || "Striker"} ${striker.runs}(${striker.balls})`);
  }
  function fireMilestoneMoment(kind, who = milestoneBatter) {
    const batter = who === "striker" ? striker : nonStriker;
    const label = batter.name || (who === "striker" ? "Striker" : "Non-Striker");
    fireStamp("boundary", kind === "fifty" ? "FIFTY" : "HUNDRED");
    spawnParticles(PARTICLE_COLORS_BOUNDARY);
    pushLog(`Moment: ${kind.toUpperCase()} — ${label} ${batter.runs}(${batter.balls})`);
  }
  function fireMaidenMoment() {
    if (!bowler.name) return fireToast("Set a bowler in Live State first");
    pushLog(`Moment: MAIDEN OVER — ${bowler.name}`);
    fireToast(`Maiden fired for ${bowler.name}`);
  }
  function fireWicketMoment() {
    const batter = wicketDraft.batsmanOut === "striker" ? striker : nonStriker;
    pushLog(`Moment: WICKET — ${batter.name || "Batter"} ${wicketDraft.dismissalType}${bowler.name ? ` b ${bowler.name}` : ""}${wicketDraft.fielder ? ` c ${wicketDraft.fielder}` : ""}`);
    // Mark the dismissed batter as out and clear their slot so the next
    // pick has to come from the remaining squad — same rule the roster
    // strip/sheet enforce visually.
    if (batter.name) {
      setDismissedPlayers((prev) => new Set(prev).add(batter.name));
      if (wicketDraft.batsmanOut === "striker") setStriker(emptyBatter());
      else setNonStriker(emptyBatter());
      setActiveSlot(wicketDraft.batsmanOut);
    }
    setWicketDraft({ batsmanOut: "striker", dismissalType: "bowled", fielder: "" });
    setShowWicketForm(false);
  }
  function fireMatchWonMoment() {
    const name = matchWonDraft.winner === "teamA" ? matchSetup.teamA : matchWonDraft.winner === "teamB" ? matchSetup.teamB : matchWonDraft.customName || "Winner";
    const margin = matchWonDraft.margin || "Match Won";
    fireStamp("boundary", "WON");
    spawnParticles(PARTICLE_COLORS_BOUNDARY);
    pushLog(`Moment: MATCH WON — ${name} ${margin}`);
    setShowMatchWonForm(false);
  }

  const extraOptions = [ "Wide", "No Ball", "Bye", "Leg Bye", "Free Hit" ];   
  const extraKeyFor = (label) => ({ Wide: "Wd", "No Ball": "Nb", Bye: "By", "Leg Bye": "Lb" }[label]);

  const statCards = [
    { label: "Partnership", value: `${partnership.runs} (${partnership.balls})` },
    { label: "Match 4s / 6s", value: `${matchBoundaries.fours} / ${matchBoundaries.sixes}` },
    { label: "Overs", value: overs },
    { label: "Extras", value: `${extras.Wd + extras.Nb + extras.By + extras.Lb}` },
  ];
  if (inningsNumber === 2 && target !== null) {
    statCards.push({ label: "Target", value: `${target}` });
  }

  return (
    <div className="bg-background text-on-background min-h-screen lg:h-screen lg:overflow-hidden flex flex-col relative" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Geist+Mono:wght@400;500;700&family=Inter:wght@400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

        :root {
          --color-background: #050505;
          --color-on-background: #ffffff;
          --color-surface-container-lowest: #050505;
          --color-surface-container-low: #0b0b0b;
          --color-surface-variant: rgba(255,255,255,0.05);
          --color-on-surface: #ffffff;
          --color-on-surface-variant: rgba(255,255,255,0.45);
          --color-outline-variant: rgba(255,255,255,0.08);
          --color-surface-glass: rgba(255,255,255,0.035);
          --color-border-overlay: rgba(255,255,255,0.08);
          --color-error-container: rgba(239,68,68,0.14);
          --color-on-error-container: #ef4444;
          --color-theme-orange: #c9971f;
        }
        * { -webkit-tap-highlight-color: transparent; }
        .font-archivo { font-family: 'Archivo Narrow', sans-serif; }
        .font-mono-geist { font-family: 'Geist Mono', monospace; }
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          font-style: normal; line-height: 1; display: inline-block;
          text-transform: none; letter-spacing: normal; user-select: none;
        }
        .bg-background { background: var(--color-background); }
        .text-on-background { color: var(--color-on-background); }
        .bg-surface-container-lowest { background: var(--color-surface-container-lowest); }
        .bg-surface-container-low { background: var(--color-surface-container-low); }
        .bg-surface-variant { background: var(--color-surface-variant); }
        .text-on-surface { color: var(--color-on-surface); }
        .text-on-surface-variant { color: var(--color-on-surface-variant); }
        .border-outline-variant { border-color: var(--color-outline-variant); }
        .bg-error-container { background: var(--color-error-container); }
        .text-on-error-container { color: var(--color-on-error-container); }
        .text-theme-orange { color: var(--color-theme-orange); }
        .bg-theme-orange { background: var(--color-theme-orange); }
        .bg-theme-orange\\/10 { background: rgba(201,151,31,0.1); }
        .border-theme-orange\\/20 { border-color: rgba(201,151,31,0.2); }
        .glass-panel { background: var(--color-surface-glass); backdrop-filter: blur(20px); border: 1px solid var(--color-border-overlay); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .cr-particle { position: fixed; pointer-events: none; z-index: 100; border-radius: 50%; width: 8px; height: 8px; animation-name: cr-fly; animation-timing-function: cubic-bezier(0.1,0.8,0.3,1); animation-fill-mode: forwards; }
        @keyframes cr-fly { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; } }
        .cr-boundary-stamp { transform: rotate(-13deg); animation: cr-land 0.55s cubic-bezier(0.22,1,0.36,1) both; }
        .cr-wicket-stamp { transform: rotate(13deg); animation: cr-land-r 0.55s cubic-bezier(0.22,1,0.36,1) 0.05s both; }
        @keyframes cr-land { 0% { opacity:0; transform: rotate(-13deg) scale(2.2); filter: blur(14px);} 55%{opacity:1;filter:blur(0);} 70%{transform:rotate(-13deg) scale(0.96);} 85%{transform:rotate(-13deg) scale(1.02);} 100%{transform:rotate(-13deg) scale(1);} }
        @keyframes cr-land-r { 0% { opacity:0; transform: rotate(13deg) scale(2.2); filter: blur(14px);} 55%{opacity:1;filter:blur(0);} 70%{transform:rotate(13deg) scale(0.96);} 85%{transform:rotate(13deg) scale(1.02);} 100%{transform:rotate(13deg) scale(1);} }
        .cr-stamp-face-gold { position: relative; padding: 14px 26px 12px; border: 4px solid #A87815; border-radius: 4px; overflow: hidden; background: rgba(201,151,31,0.07); }
        .cr-stamp-face-grey { position: relative; padding: 14px 22px 12px; border: 4px solid #718096; border-radius: 4px; overflow: hidden; background: rgba(74,85,104,0.08); }
        .cr-stamp-word-gold { font-family:'Archivo Narrow',sans-serif; font-size: 36px; font-weight: 700; font-style: italic; letter-spacing: 0.08em; text-transform: uppercase; color: #E8C468; line-height: 1; display: block; text-shadow: 0 0 60px rgba(232,196,104,0.25); }
        .cr-stamp-word-grey { font-family:'Archivo Narrow',sans-serif; font-size: 30px; font-weight: 700; font-style: italic; letter-spacing: 0.08em; text-transform: uppercase; color: #A0AEC0; line-height: 1; display: block; }
        @media (min-width: 640px) {
          .cr-stamp-face-gold { padding: 18px 44px 16px; }
          .cr-stamp-face-grey { padding: 18px 34px 16px; }
          .cr-stamp-word-gold { font-size: 54px; }
          .cr-stamp-word-grey { font-size: 44px; }
        }
        .cr-stamp-sub { display:block; text-align:center; font-family:'Geist Mono',monospace; font-size: 9px; font-weight: 500; letter-spacing: 0.3em; text-transform: uppercase; margin-top: 6px; }
        @keyframes cr-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(201,151,31,0.35);} 50% { box-shadow: 0 0 0 6px rgba(201,151,31,0);} }
        .cr-freehit-glow { animation: cr-glow 1.6s ease-in-out infinite; }
      `}} />

      {particles.map((p) => (
        <span key={p.id} className="cr-particle" style={{ left: "50%", top: "38%", backgroundColor: p.color, "--tx": `${p.tx}px`, "--ty": `${p.ty}px`, animationDuration: `${p.duration}s` }} />
      ))}
      <div className={`fixed inset-0 pointer-events-none z-[60] transition-opacity duration-75 ${stamp?.kind === "boundary" ? "bg-theme-orange/10" : stamp?.kind === "wicket" ? "bg-slate-400/5" : "bg-white/0"} ${flashActive ? "opacity-100" : "opacity-0"}`} />
      <div className={`fixed inset-0 pointer-events-none z-[55] flex items-center justify-center transition-opacity duration-500 ${glowActive ? "opacity-100" : "opacity-0"}`}>
        <div className="w-[280px] h-[280px] sm:w-[460px] sm:h-[460px] rounded-full blur-[90px] sm:blur-[120px]" style={{ background: stamp?.kind === "boundary" ? "rgba(201,151,31,0.18)" : "rgba(113,128,150,0.12)" }} />
      </div>

      <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-[300] flex flex-col-reverse gap-2 items-end pointer-events-none max-w-[calc(100vw-2rem)] sm:max-w-xs">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg font-mono-geist text-[10.5px] font-bold leading-relaxed max-w-full glass-panel"
            style={{
              borderColor: t.tone === "wicket" ? "rgba(248,113,113,0.35)" : t.tone === "boundary" ? "rgba(201,151,31,0.4)" : "rgba(255,255,255,0.12)",
              color: t.tone === "wicket" ? "#f87171" : t.tone === "boundary" ? "#e8c468" : "rgba(255,255,255,0.75)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            <Icon
              name={t.tone === "wicket" ? "sports_cricket" : t.tone === "boundary" ? "bolt" : "info"}
              style={{ fontSize: 14, marginTop: 1 }}
            />
            <span className="min-w-0">{t.text}</span>
          </div>
        ))}
      </div>
      {freeHit && (
        <div className="fixed top-24 sm:top-20 left-1/2 -translate-x-1/2 z-[295] cr-freehit-glow flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2 rounded-full text-[11px] sm:text-xs font-bold max-w-[calc(100vw-2rem)] text-center" style={{ background: "rgba(201,151,31,0.12)", border: "1px solid rgba(201,151,31,0.4)", color: "#e8c468", fontFamily: "'Geist Mono', monospace", backdropFilter: "blur(12px)" }}>
          <Icon name="bolt" style={{ fontSize: 14 }} /><span className="truncate">Free Hit — no wicket on this ball</span>
        </div>
      )}

      {/* mobile bottom-sheet picker — shared by all three slots */}
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

      {/* ══════════ HEADER ══════════ */}
      <header className="sticky top-0 shrink-0 z-50 flex justify-between items-center px-3 sm:px-4 h-16 glass-panel border-b border-white/10 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="w-16 h-16 flex items-center justify-center shrink-0 overflow-hidden">
            {!logoFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <Image
                src={DEFAULT_LOGO_SRC}
                alt="League logo"
                width={80}
                height={80}
                className="w-full h-full object-contain p-1"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <Icon name="tv" className="text-theme-orange" style={{ fontSize: 20 }} />
            )}
          </div>
            <h1 className="font-archivo text-lg sm:text-2xl font-bold italic tracking-tighter uppercase shrink-0">
              <span style={{ color: matchSetup.teamAColor }}>{matchSetup.teamA}</span>
              {" "}vs{" "}
              <span style={{ color: matchSetup.teamBColor }}>{matchSetup.teamB}</span>
            </h1>    
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full shrink-0" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full" style={{ background: "#22c55e", opacity: 0.5 }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "#22c55e" }} />
            </span>
            <span className="font-mono-geist text-[10px] uppercase tracking-[0.16em] font-bold" style={{ color: "#22c55e" }}>Broadcasting</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden xl:flex items-center gap-2 text-on-surface-variant font-mono-geist text-[10px] uppercase tracking-[0.12em]">
            <Icon name="lock" style={{ fontSize: 14 }} />Secure Admin Node
          </div>
          <div className="hidden md:block font-mono-geist text-[10px] text-right">
            <div className="text-on-surface-variant uppercase tracking-[0.1em]">Match</div>
            <div className="text-theme-orange font-bold">{matchSetup.teamA} vs {matchSetup.teamB}</div>
          </div>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1.5 bg-error-container text-on-error-container px-3 sm:px-6 py-2 rounded font-mono-geist font-bold hover:brightness-110 transition-all active:scale-95 border border-white/10 uppercase tracking-[0.2em] text-xs shrink-0"
          >
            <Icon name="restart_alt" style={{ fontSize: 14 }} /> <span className="hidden sm:inline">Restart Match</span>
          </button>
        </div>
      </header>

      {/* ── On Air channels — desktop only now; mobile gets a purpose-built
           card version inside the Overlay tab (see below). Each group's
           label sits centered above its row of toggle pills instead of
           inline before them. ── */}
      <div className="hidden lg:flex sticky top-16 w-full z-40 px-3 sm:px-6 py-1.5 sm:py-3 items-start gap-4 flex-wrap border-b border-white/5 bg-surface-container-lowest">
        <div className="flex flex-col items-center gap-1.5">
          <GroupLabel center>On Air</GroupLabel>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <TogglePill label="Weather" on={alwaysOn.weather} dotColor="#22c55e" onClick={() => setAlwaysOn((a) => ({ ...a, weather: !a.weather }))} />
            <TogglePill label="Live Score Bar" on={alwaysOn.liveScoreBar} dotColor="#22c55e" onClick={() => setAlwaysOn((a) => ({ ...a, liveScoreBar: !a.liveScoreBar }))} />
            <TogglePill label="Tournament Logo" on={alwaysOn.tournamentLogo} dotColor="#22c55e" onClick={() => setAlwaysOn((a) => ({ ...a, tournamentLogo: !a.tournamentLogo }))} />
          </div>
        </div>
        <span className="hidden sm:block w-px self-stretch bg-white/10" />
        <div className="flex flex-col items-center gap-1.5">
          <GroupLabel center>Full-Screen</GroupLabel>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <TogglePill label="Points Table" on={fullScreen.pointsTable} dotColor="#c9971f" onClick={() => setFullScreen((f) => ({ ...f, pointsTable: !f.pointsTable }))} />
            <TogglePill label="Match Scorecard" on={fullScreen.matchScorecard} dotColor="#c9971f" onClick={() => setFullScreen((f) => ({ ...f, matchScorecard: !f.matchScorecard }))} />
            <TogglePill label="Match Intro" on={fullScreen.matchIntro} dotColor="#c9971f" onClick={() => setFullScreen((f) => ({ ...f, matchIntro: !f.matchIntro }))} />
          </div>
        </div>
        <span className="hidden sm:block w-px self-stretch bg-white/10" />
        <div className="flex flex-col items-center gap-1.5">
          <GroupLabel center>Moments</GroupLabel>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {BOUNDARY_CHANNELS.map((c) => (
              <TogglePill
                key={c.key}
                label={c.label}
                on={boundaryChannels[c.key]}
                dotColor="#e8c468"
                onClick={() => setBoundaryChannels((b) => ({ ...b, [c.key]: !b[c.key] }))}
              />
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 flex flex-col pb-8 lg:pb-0 lg:grid lg:grid-cols-[20%_55%_25%] lg:h-[calc(100vh-8rem)] lg:overflow-hidden">
        {/* ══════════ LEFT: Roster (2nd on mobile) ══════════ */}
        <aside className="order-2 lg:order-1 hidden lg:flex lg:flex-col lg:h-full bg-surface-container-lowest border-t lg:border-t-0 lg:border-r border-outline-variant shrink-0 lg:overflow-y-auto custom-scrollbar py-4 px-4 gap-4">          {/* Roster — the ONLY pick/drop list on desktop. It follows whichever
             crew slot is active: batting squad for Striker/Non-Striker,
             bowling squad for Bowler. Drag a name onto the active slot up
             in the scorer card, or just tap it here to assign directly. */}
          <div className="hidden lg:flex glass-panel rounded-2xl p-4 lg:flex-1 lg:min-h-0 flex-col lg:overflow-hidden">
            <div className="flex items-center justify-between mb-1 shrink-0 gap-2 flex-wrap">
              <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.18em] font-bold">Pick From {matchSetup[asideTeamKey]}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                <TogglePill label={matchSetup.teamA} on={battingTeam === "teamA"} dotColor="#c9971f" onClick={() => setBattingTeam("teamA")} />
                <TogglePill label={matchSetup.teamB} on={battingTeam === "teamB"} dotColor="#c9971f" onClick={() => setBattingTeam("teamB")} />
              </div>
            </div>
            <div className="flex items-center justify-between mb-3 shrink-0 gap-2">
              <span className="font-mono-geist text-[9px] text-on-surface-variant shrink-0">{asideRoster.length} players</span>
            </div>
            <div className="max-h-72 lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto custom-scrollbar space-y-2">
              {asideRoster.map((name) => {
                const isOut = !!asideDismissed?.has(name);
                const roleInfo = asideRoleMap.get(name);
                const isLocked = isOut || !!roleInfo;
                const roleLabel = roleInfo?.role === "striker" ? "On Strike" : roleInfo?.role === "nonStriker" ? "Non-Striker" : roleInfo?.role === "bowler" ? "Bowling" : undefined;
                return (
                  <button
                    key={name}
                    draggable={!isLocked}
                    disabled={isLocked}
                    onDragStart={(e) => {
                      if (isLocked) { e.preventDefault(); return; }
                      e.dataTransfer.setData("text/player-name", name);
                    }}
                    onClick={() => !isLocked && assignFromAsideList(name)}
                    className="w-full flex items-center gap-3 rounded-lg pl-2.5 pr-3 py-3 text-left transition-all"
                    style={
                      isOut
                        ? { opacity: 0.55, cursor: "not-allowed", border: "1px solid rgba(248,113,113,0.4)", background: "rgba(239,68,68,0.08)" }
                        : roleInfo
                        ? { opacity: 0.85, cursor: "not-allowed", border: "1px solid rgba(74,222,128,0.4)", background: "rgba(34,197,94,0.08)" }
                        : { border: "1px solid rgba(255,255,255,0.08)", background: "transparent" }
                    }
                  >
                    <span className="h-9 w-9 rounded-full flex items-center justify-center font-mono-geist text-[11px] font-bold shrink-0" style={{ border: "1px solid rgba(255,255,255,0.15)", color: isOut ? "#f87171" : roleInfo ? "#4ade80" : "#e5e7eb" }}>
                      {initials(name)}
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="font-archivo text-sm font-bold truncate" style={{ color: isOut ? "#f87171" : roleInfo ? "#4ade80" : "var(--color-on-surface)" }}>{name}</span>
                      <span className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.08em]">
                        {matchSetup[asideTeamKey]}{isOut ? " · OUT" : roleLabel ? ` · ${roleLabel}` : ""}
                      </span>
                    </span>
                    {roleInfo && <Icon name={roleInfo.role === "bowler" ? "sports_cricket" : "sports_baseball"} className="ml-auto" style={{ fontSize: 16, color: "#4ade80" }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ══════════ CENTER: Live State scorer (1st on mobile) ══════════ */}
        <section className={`order-1 lg:order-2 flex-col lg:h-full p-3 lg:p-4 gap-4 lg:overflow-y-auto custom-scrollbar ${mobileTab === "scoring" ? "flex" : "hidden"} lg:flex`}>          <div className="glass-panel rounded-2xl relative overflow-hidden p-4 sm:p-6 shrink-0">
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

            {/* Striker / Non-Striker / Bowler — drag a name in, or tap to open the picker.
               Mobile: Striker + Non-Striker sit side by side (2-up), Bowler spans full
               width beneath. Desktop (sm+): unchanged 3-across row. */}
            <div className="mb-3 relative z-10">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <CrewSlot
                  title="Striker *"
                  accentColor="#e8c468"
                  active={activeSlot === "striker"}
                  onActivate={() => { setActiveSlot("striker"); setPlayerPicker("striker"); }}
                  displayName={striker.name}
                  statLine={striker.name ? `${striker.runs} (${striker.balls}) · ${striker.fours}x4 ${striker.sixes}x6` : undefined}
                  allNames={battingRoster}
                  onAssign={(name) => assignBatter("striker", name)}
                  onClear={() => setStriker(emptyBatter())}
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
                  allNames={battingRoster}
                  onAssign={(name) => assignBatter("nonStriker", name)}
                  onClear={() => setNonStriker(emptyBatter())}
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
                    allNames={bowlingRoster}
                    onAssign={(name) => assignBowler(name)}
                    placeholder="Pick from roster ◂"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap mb-5 relative z-10">
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

            {/* This ball */}
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3 relative z-10">
              <span className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.18em] font-bold">This Ball</span>
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={handleUndo} disabled={history.length === 0} className="flex items-center gap-1.5 font-mono-geist text-[10px] font-bold uppercase tracking-[0.16em] px-4 py-2 rounded transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 bg-theme-orange/10 border border-theme-orange/20 text-theme-orange">
                  <Icon name="undo" style={{ fontSize: 14 }} /> Undo
                </button>
                <button onClick={() => setFreeHit((v) => !v)} className="flex items-center gap-2.5">
                  <span className="relative h-5 w-9 rounded-full transition-colors" style={{ background: freeHit ? "#c9971f" : "rgba(255,255,255,0.15)" }}>
                    <span className="absolute top-0.5 h-4 w-4 rounded-full bg-black transition-all" style={{ left: freeHit ? "18px" : "2px" }} />
                  </span>
                  <span className="font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em]">Free Hit</span>
                </button>
              </div>
            </div>

            <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.18em] font-bold mb-2.5 relative z-10">Extra</p>
            <div className="flex items-center gap-2 mb-2 flex-wrap relative z-10">
              {extraOptions.map((label) => {
                const key = extraKeyFor(label);
                const active = extraMode === key;
                return (
                  <button key={label} onClick={() => setExtraMode(active ? null : key)} className="font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em] px-3.5 py-1.5 rounded transition-all"
                    style={{ border: `1px solid ${active ? "rgba(201,151,31,0.3)" : "rgba(255,255,255,0.1)"}`, background: active ? "rgba(201,151,31,0.08)" : "rgba(255,255,255,0.02)", color: active ? "#c9971f" : "rgba(255,255,255,0.5)" }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.14em] mb-4 relative z-10">
              Extras total — Wd {extras.Wd} · Nb {extras.Nb} · By {extras.By} · Lb {extras.Lb}
            </p>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 relative z-10">
              {[0, 1, 2, 3, 4, 6].map((n) => (
                <button key={n} onClick={() => handleRun(n)} className="rounded-lg py-3.5 sm:py-4 font-archivo text-lg sm:text-xl font-bold transition-all hover:brightness-110 active:scale-95 border border-white/10"
                  style={n === 4 || n === 6 ? { background: GOLD_GRADIENT, color: "#1a1304", border: "1px solid rgba(255,255,255,0.1)" } : { background: "rgba(255,255,255,0.03)" }}>
                  {n}
                </button>
              ))}
              <button onClick={handleOut} disabled={freeHit} className="rounded-lg py-3.5 sm:py-4 font-mono-geist text-xs sm:text-sm font-bold uppercase tracking-[0.14em] transition-all hover:brightness-110 active:scale-95 bg-error-container text-on-error-container border border-white/10 disabled:opacity-30">
                Out
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

        {/* ══════════ RIGHT: Match Setup + Moments + Weather (3rd on mobile) ══════════ */}
        <aside className="order-3 flex mb-0 p-3 lg:p-0 lg:pt-4 lg:pb-4 lg:px-4 flex-col lg:h-full bg-surface-container-low border-t lg:border-t-0 lg:border-l border-outline-variant shrink-0 lg:overflow-y-auto custom-scrollbar gap-4">          {/* Match Setup — locked summary bar / edit. Moved here (top-right)
             so the left rail can give its full height to the roster picker,
             which balances the three columns within one viewport. */}
          <div className={`glass-panel rounded-2xl p-4 shrink-0 ${mobileTab === "setup" ? "" : "hidden"} lg:block`}>
            {!setupEditing ? (
              <>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded bg-theme-orange/10 border border-theme-orange/20 text-theme-orange">Match Setup · Locked</span>
                  <button onClick={() => setSetupEditing(true)} className="h-7 w-7 rounded-lg flex items-center justify-center border border-white/10 shrink-0">
                    <Icon name="edit" className="text-on-surface-variant" style={{ fontSize: 13 }} />
                  </button>
                </div>
                <p className="font-archivo text-sm font-bold uppercase italic">{matchSetup.teamA} <span className="text-on-surface-variant not-italic font-normal">vs</span> {matchSetup.teamB}</p>
                <p className="font-mono-geist text-[10px] text-on-surface-variant uppercase tracking-[0.08em] mt-1">{matchSetup.matchTitle} · {matchSetup.venue} · {matchSetup.format}</p>
                {/* Mobile-only: the desktop Batting toggle lives next to the
                   roster panel, which is hidden below lg, so it needs a
                   stand-in here on mobile. */}
                <div className="flex items-center gap-2 mt-3 lg:hidden">
                  <GroupLabel>Batting</GroupLabel>
                  <TogglePill label={matchSetup.teamA} on={battingTeam === "teamA"} dotColor="#c9971f" onClick={() => setBattingTeam("teamA")} />
                  <TogglePill label={matchSetup.teamB} on={battingTeam === "teamB"} dotColor="#c9971f" onClick={() => setBattingTeam("teamB")} />
                </div>
              </>
            ) : (
              <>
                <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.18em] font-bold mb-3">Editing Match Setup</p>
                <p className="font-mono-geist text-[10px] text-on-surface-variant leading-relaxed mb-3">
                  Team names, squads, toss and venue live in the full Match Editor. This is a locked summary — push again once you're done there.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setSetupEditing(false)} className="flex-1 py-2 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em] border border-white/10 text-on-surface-variant">Cancel</button>
                  <button onClick={pushMatchSetup} className="flex-1 py-2 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em]" style={{ background: GOLD_GRADIENT, color: "#1a1304" }}>
                    {setupPushed ? "Pushed ✓" : "Push Setup"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Broadcast Channels — mobile-only replacement for the desktop
             sticky pill bar. Bigger tap targets, grouped, proper switches.
             Includes On Air, Full-Screen, and Moments (Match/Tournament
             Boundaries) — matching the groups shown on desktop. */}
          <div className={`glass-panel rounded-2xl p-4 shrink-0 lg:hidden flex-col gap-4 ${mobileTab === "overlay" ? "flex" : "hidden"}`}>
            <div>
              <h3 className="font-archivo text-base font-bold italic uppercase mb-1">Broadcast Channels</h3>
              <p className="font-mono-geist text-[10px] text-on-surface-variant uppercase tracking-[0.08em] leading-relaxed">Toggle what's live on the overlay right now.</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.18em] text-theme-orange">On Air</span>
              <MobileChannelRow icon="partly_cloudy_day" label="Weather" on={alwaysOn.weather} dotColor="#22c55e" onClick={() => setAlwaysOn((a) => ({ ...a, weather: !a.weather }))} />
              <MobileChannelRow icon="scoreboard" label="Live Score Bar" on={alwaysOn.liveScoreBar} dotColor="#22c55e" onClick={() => setAlwaysOn((a) => ({ ...a, liveScoreBar: !a.liveScoreBar }))} />
              <MobileChannelRow icon="military_tech" label="Tournament Logo" on={alwaysOn.tournamentLogo} dotColor="#22c55e" onClick={() => setAlwaysOn((a) => ({ ...a, tournamentLogo: !a.tournamentLogo }))} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.18em] text-theme-orange">Full-Screen</span>
              <MobileChannelRow icon="leaderboard" label="Points Table" on={fullScreen.pointsTable} dotColor="#c9971f" onClick={() => setFullScreen((f) => ({ ...f, pointsTable: !f.pointsTable }))} />
              <MobileChannelRow icon="receipt_long" label="Match Scorecard" on={fullScreen.matchScorecard} dotColor="#c9971f" onClick={() => setFullScreen((f) => ({ ...f, matchScorecard: !f.matchScorecard }))} />
              <MobileChannelRow icon="theaters" label="Match Intro" on={fullScreen.matchIntro} dotColor="#c9971f" onClick={() => setFullScreen((f) => ({ ...f, matchIntro: !f.matchIntro }))} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.18em] text-theme-orange">Moments</span>
              <MobileChannelRow icon="stadium" label="Match Boundaries" on={boundaryChannels.matchBoundaries} dotColor="#e8c468" onClick={() => setBoundaryChannels((b) => ({ ...b, matchBoundaries: !b.matchBoundaries }))} />
              <MobileChannelRow icon="emoji_events" label="Tournament Boundaries" on={boundaryChannels.tournamentBoundaries} dotColor="#e8c468" onClick={() => setBoundaryChannels((b) => ({ ...b, tournamentBoundaries: !b.tournamentBoundaries }))} />
            </div>
          </div>

          {/* Moments — grows to fill the remaining column height on desktop,
             pushing Weather down to the bottom of the aside. Its own content
             scrolls internally so the aside itself never needs to scroll. */}
          <div className={`glass-panel rounded-2xl p-4 shrink-0 flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden ${mobileTab === "overlay" ? "flex" : "hidden"} lg:flex`}>            <button onClick={() => setShowMoments((v) => !v)} className="w-full flex items-center justify-between gap-3 mb-1 shrink-0">
              <h3 className="font-archivo text-base font-bold italic uppercase">Moments</h3>
              <Icon name={showMoments ? "expand_less" : "expand_more"} className="text-on-surface-variant" style={{ fontSize: 18 }} />
            </button>
            <p className="font-mono-geist text-[10px] text-on-surface-variant uppercase tracking-[0.08em] mb-3 leading-relaxed shrink-0">
              Fours, sixes, fifties and wickets fire automatically from the ball pad — these are manual/backup triggers.
            </p>

            {showMoments && (
             <div className="flex flex-col gap-3 lg:overflow-y-auto custom-scrollbar lg:min-h-0">
                <div className="grid grid-cols-2 gap-2.5">
                  <MomentButton label="Four" onClick={() => fireBoundaryMoment("four")} />
                  <MomentButton label="Six" onClick={() => fireBoundaryMoment("six")} />
                  <MomentButton label="Wicket" danger active={showWicketForm} onClick={() => setShowWicketForm((v) => !v)} />
                  <MomentButton label="Fifty" onClick={() => fireMilestoneMoment("fifty")} />
                  <MomentButton label="Maiden" onClick={fireMaidenMoment} />
                  <MomentButton label="Match Won" active={showMatchWonForm} onClick={() => setShowMatchWonForm((v) => !v)} />
                </div>
                <MomentButton label="Hundred" full onClick={() => fireMilestoneMoment("hundred")} />

                <div className="flex flex-col gap-2 pt-1">
                  <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Fifty / Hundred For</span>
                  <div className="grid grid-cols-2 gap-2">
                    <BatterPickerButton batter={striker} label="Striker" selected={milestoneBatter === "striker"} onClick={() => setMilestoneBatter("striker")} />
                    <BatterPickerButton batter={nonStriker} label="Non-Striker" selected={milestoneBatter === "nonStriker"} onClick={() => setMilestoneBatter("nonStriker")} />
                  </div>
                </div>

                {showWicketForm && (
                  <div className="flex flex-col gap-3 p-4 rounded-lg mt-1" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                    <span className="font-mono-geist text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#f87171" }}>Wicket Detail</span>
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Batsman Out</span>
                      <div className="grid grid-cols-2 gap-2">
                        <BatterPickerButton batter={striker} label="Striker" selected={wicketDraft.batsmanOut === "striker"} onClick={() => setWicketDraft((p) => ({ ...p, batsmanOut: "striker" }))} />
                        <BatterPickerButton batter={nonStriker} label="Non-Striker" selected={wicketDraft.batsmanOut === "nonStriker"} onClick={() => setWicketDraft((p) => ({ ...p, batsmanOut: "nonStriker" }))} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Dismissal</span>
                      <select value={wicketDraft.dismissalType} onChange={(e) => setWicketDraft((p) => ({ ...p, dismissalType: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-white/10 text-on-surface">
                        <option value="bowled">Bowled</option>
                        <option value="caught">Caught</option>
                        <option value="lbw">LBW</option>
                        <option value="runOut">Run Out</option>
                        <option value="stumped">Stumped</option>
                        <option value="hitWicket">Hit Wicket</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Fielder (if any)</span>
                      <input value={wicketDraft.fielder} onChange={(e) => setWicketDraft((p) => ({ ...p, fielder: e.target.value }))} placeholder="Fielder name" className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-white/10 text-on-surface placeholder:text-on-surface-variant" />
                    </div>
                    <p className="font-mono-geist text-[10px] text-on-surface-variant">Bowler from Live State: {bowler.name || "—"}</p>
                    <button onClick={fireWicketMoment} className="w-full py-2.5 rounded-full font-mono-geist text-[11px] font-black uppercase tracking-wide" style={{ background: "#ef4444", color: "#fff" }}>Fire Wicket</button>
                  </div>
                )}

                {showMatchWonForm && (
                  <div className="flex flex-col gap-3 p-4 rounded-lg mt-1 bg-theme-orange/10 border border-theme-orange/25">
                    <span className="font-mono-geist text-[10px] font-bold uppercase tracking-[0.18em] text-theme-orange">Match Won Detail</span>
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Winning Team</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[{ key: "teamA", label: matchSetup.teamA }, { key: "teamB", label: matchSetup.teamB }, { key: "custom", label: "Other" }].map((opt) => (
                          <button key={opt.key} onClick={() => setMatchWonDraft((p) => ({ ...p, winner: opt.key }))} className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-center transition-all"
                            style={{ border: `1px solid ${matchWonDraft.winner === opt.key ? "rgba(201,151,31,0.5)" : "rgba(255,255,255,0.08)"}`, background: matchWonDraft.winner === opt.key ? "rgba(201,151,31,0.14)" : "rgba(255,255,255,0.02)" }}>
                            <span className={`text-[11px] font-archivo font-bold truncate max-w-full ${matchWonDraft.winner === opt.key ? "text-theme-orange" : "text-on-surface"}`}>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {matchWonDraft.winner === "custom" && (
                      <input value={matchWonDraft.customName} onChange={(e) => setMatchWonDraft((p) => ({ ...p, customName: e.target.value }))} placeholder="Winning team name" className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-white/10 text-on-surface placeholder:text-on-surface-variant" />
                    )}
                    <input value={matchWonDraft.margin} onChange={(e) => setMatchWonDraft((p) => ({ ...p, margin: e.target.value }))} placeholder="e.g. won by 4 wickets" className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-white/10 text-on-surface placeholder:text-on-surface-variant" />
                    <select value={matchWonDraft.method} onChange={(e) => setMatchWonDraft((p) => ({ ...p, method: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-white/10 text-on-surface">
                      <option value="batting">Chasing side won (by wickets)</option>
                      <option value="bowling">Defending side won (by runs)</option>
                      <option value="tie">Tie</option>
                    </select>
                    <button onClick={fireMatchWonMoment} className="w-full py-2.5 rounded-full font-mono-geist text-[11px] font-black uppercase tracking-wide" style={{ background: GOLD_GRADIENT, color: "#1a1304" }}>Fire Match Won</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Weather */}
            <div className={`glass-panel rounded-2xl p-4 mb-8 lg:mb-0 shrink-0 ${mobileTab === "overlay" ? "" : "hidden"} lg:block`}>            <div className="flex items-center justify-between mb-2 gap-2">
              <h3 className="font-archivo text-sm font-bold italic uppercase">Weather</h3>
              <button onClick={() => setWeatherEditing((v) => !v)} className="h-7 w-7 rounded-lg flex items-center justify-center border border-white/10 shrink-0">
                <Icon name="edit" className="text-on-surface-variant" style={{ fontSize: 13 }} />
              </button>
            </div>
            {!weatherEditing ? (
              <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-white/[0.02] border border-white/10">
                <Icon name="partly_cloudy_day" className="text-theme-orange shrink-0" style={{ fontSize: 22 }} />
                <div className="min-w-0">
                  <p className="font-archivo text-sm font-bold truncate">{weather.venue} — {weather.temp}°C, {weather.condition}</p>
                  <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.1em] mt-0.5">Pushed with Match Setup</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <input value={weather.venue} onChange={(e) => setWeather((w) => ({ ...w, venue: e.target.value.toUpperCase() }))} className="w-full rounded-lg px-3 py-2 text-xs font-mono-geist bg-white/[0.03] border border-white/10 text-on-surface" placeholder="Venue" />
                <div className="flex gap-2">
                  <input type="number" value={weather.temp} onChange={(e) => setWeather((w) => ({ ...w, temp: Number(e.target.value) }))} className="w-1/2 rounded-lg px-3 py-2 text-xs font-mono-geist bg-white/[0.03] border border-white/10 text-on-surface" placeholder="°C" />
                  <input value={weather.condition} onChange={(e) => setWeather((w) => ({ ...w, condition: e.target.value }))} className="w-1/2 rounded-lg px-3 py-2 text-xs font-mono-geist bg-white/[0.03] border border-white/10 text-on-surface" placeholder="condition" />
                </div>
                <button
                  onClick={() => { setWeatherEditing(false); pushLog(`Weather set — ${weather.venue}: ${weather.temp}°C, ${weather.condition}`); fireToast("Weather pushed"); }}
                  className="w-full py-2 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em]" style={{ background: GOLD_GRADIENT, color: "#1a1304" }}
                >
                  Push Weather
                </button>
              </div>
            )}
          </div>

        </aside>
      </main>

      {/* ══════════ MOBILE BOTTOM TAB BAR — Scoring / Overlay / Setup ══════════
          Desktop is untouched: this bar is lg:hidden, and every section it
          controls falls back to always-visible at the lg breakpoint. */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-[350] flex items-stretch glass-panel border-t border-white/10"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {[
          { key: "overlay", label: "Overlay", icon: "tv" },
          { key: "scoring", label: "Scoring", icon: "sports_cricket" },
          { key: "setup", label: "Setup", icon: "tune" },
        ].map((tab) => {
          const active = mobileTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setMobileTab(tab.key)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors"
            >
              <Icon name={tab.icon} style={{ fontSize: 21 }} className={active ? "text-theme-orange" : "text-on-surface-variant"} />
              <span
                className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.12em]"
                style={{ color: active ? "#e8c468" : "rgba(255,255,255,0.4)" }}
              >
                {tab.label}
              </span>
              <span
                className="h-0.5 w-6 rounded-full transition-opacity"
                style={{ background: "#e8c468", opacity: active ? 1 : 0 }}
              />
            </button>
          );
        })}
      </nav>

      {/* Restart confirm */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowClearConfirm(false)} />
          <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl p-6 sm:p-8 flex flex-col gap-5 sm:gap-6 bg-surface-container-lowest max-h-[90vh] overflow-y-auto custom-scrollbar" style={{ border: "1px solid rgba(248,113,113,0.2)", boxShadow: "0 0 80px rgba(239,68,68,0.12), 0 24px 64px rgba(0,0,0,0.6)" }}>
            <div className="flex items-center justify-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <Icon name="restart_alt" style={{ fontSize: 28, color: "#f87171" }} />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="font-archivo text-xl sm:text-2xl font-bold italic uppercase tracking-tight text-white">Restart the Match?</h2>
              <p className="font-mono-geist text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-[0.12em] leading-relaxed">Score, batters, bowler figures, and ball history all reset to zero.<br />This cannot be undone.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-center">
                <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.15em] mb-1">Current Score</p>
                <p className="font-archivo text-xl sm:text-2xl font-bold text-white">{teamRuns}/{wkts}</p>
              </div>
              <div className="text-center">
                <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.15em] mb-1">Overs</p>
                <p className="font-archivo text-xl sm:text-2xl font-bold text-white">{overs}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-3 rounded-xl font-mono-geist text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110 active:scale-95" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#a0aec0" }}>Cancel</button>
              <button onClick={handleClear} className="flex-1 py-3 rounded-xl font-mono-geist text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110 active:scale-95" style={{ background: "linear-gradient(135deg, #991b1b, #ef4444)", color: "#fff", boxShadow: "0 4px 24px rgba(239,68,68,0.3)" }}>Restart Match</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}