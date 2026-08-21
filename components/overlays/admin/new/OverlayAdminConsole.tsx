// app/(protected)/overlay/[auctionId]/admin/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import WeatherPanel from "@/components/overlays/admin/new/Weatherpanel";
import MatchSetupPanel from "@/components/overlays/admin/new/MatchInfopanel";
import ScoringSection from "@/components/overlays/admin/new/Scoringsection";
import {
  connectOverlayBus,
  type MatchSetup,
  type TeamInfo,
  type LiveState,
  type SquadPlayer,
  type OverlayEvent,
  type SyncSnapshot,
  type ChannelVisibility,
  type WeatherData,
  type DismissalType as BusDismissalType,
} from "@/lib/overlayBus";
import type { GeocodeMatch } from "@/lib/fetchVenueWeather";
import type { EngineSyncState } from "@/hooks/useLiveScoringEngine";
import { supabase } from "@/lib/supabase";
import {
  dbRowToOverlaySetup,
  overlaySetupToDbPatch,
  type DbMatchSetupRow,
} from "@/lib/matchSetupAdapter";
import {
  loadLiveState,
  saveLiveState,
  loadEngineState,
  saveEngineState,
  clearEngineState,
  deleteAllBalls,
} from "@/lib/matchPersistence";

const GOLD_GRADIENT = "linear-gradient(135deg,#A87815,#E8C468)";
const PARTICLE_COLORS_BOUNDARY = ["#E8C468", "#A87815", "#FDECC8", "#ffffff"];
const PARTICLE_COLORS_WICKET = ["#718096", "#A0AEC0", "#CBD5E0", "#E2E8F0"];
const DEFAULT_LOGO_SRC = "/valiant-league-logo.png";

const BOUNDARY_CHANNELS = [
  { key: "matchBoundaries", label: "Match Boundaries" },
  { key: "tournamentBoundaries", label: "Tournament Boundaries" },
] as const;

const DESKTOP_RIGHT_TABS = [
  { key: "setup" as const, label: "Match Info", icon: "tune" },
  { key: "overlay" as const, label: "Overlay", icon: "bolt" },
];

let idCtr = 0;

function initials(name?: string) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "—";
}

function Icon({ name, className = "", style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}

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

function TogglePill({
  label,
  on,
  onClick,
  dotColor,
}: {
  label: string;
  on: boolean;
  onClick?: () => void;
  dotColor: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex items-center gap-1.5 font-mono-geist text-[10px] uppercase tracking-[0.12em] font-bold px-3 py-1.5 rounded transition-all shrink-0 disabled:cursor-default"
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
function GroupLabel({ children, center }: { children: React.ReactNode; center?: boolean }) {
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
function MobileChannelRow({
  icon,
  label,
  on,
  onClick,
  dotColor,
}: {
  icon: string;
  label: string;
  on: boolean;
  onClick: () => void;
  dotColor: string;
}) {
  return (
    <button
      type="button"
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
    </button>
  );
}
function MomentButton({
  label,
  onClick,
  active,
  danger,
  full,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em] px-3 py-3 rounded-lg transition-all hover:brightness-110 active:scale-95 ${
        full ? "col-span-2" : ""
      }`}
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

function CenteredOverlay({
  open,
  onClose,
  title,
  icon,
  iconColor = "#e8c468",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  iconColor?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[380] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] max-h-[85dvh] overflow-y-auto custom-scrollbar rounded-2xl glass-panel border border-white/10 p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {icon && (
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${iconColor}24`, border: `1px solid ${iconColor}4d` }}
              >
                <Icon name={icon} style={{ fontSize: 16, color: iconColor }} />
              </span>
            )}
            <h3 className="truncate font-archivo text-sm font-bold uppercase text-on-surface">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors"
          >
            <Icon name="close" style={{ fontSize: 16 }} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

interface BatterLike {
  name: string;
  runs: number;
  balls: number;
}

function BatterPickerButton({
  batter,
  label,
  selected,
  onClick,
}: {
  batter: BatterLike;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
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
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-mono-geist text-[9px] font-bold"
        style={{ border: "1px solid rgba(255,255,255,0.15)", color: selected ? "#e8c468" : "#e5e7eb" }}
      >
        {initials(batter?.name || label)}
      </span>
      <span className="flex flex-col min-w-0">
        <span className={`text-[11px] font-archivo font-bold truncate ${selected ? "text-theme-orange" : "text-on-surface"}`}>
          {batter?.name || label}
        </span>
        <span className="text-[9px] uppercase tracking-wide font-mono-geist text-on-surface-variant">{label}</span>
      </span>
    </button>
  );
}

const emptyTeam = (name: string, shortCode: string, color: string, logoUrl?: string): TeamInfo => ({
  teamId: undefined,
  name,
  shortCode,
  color,
  logoUrl: logoUrl ?? "",
  squadPlayers: [],
  squad: [],
});

const defaultMatchSetup = (): MatchSetup => ({
  tournamentName: "",
  season: "",
  tournamentLogoUrl: "/valiant-league-logo.png",
  venue: "Galle Fort",
  format: "T20",
  matchNumber: "",
  kickoffTime: "",
  matchTitle: "Semi Final 1",
  matchMeta: "Semi Final 1",
  tournament: "Valiant League",
  teamA: emptyTeam("Jaffna Sharks", "JSH", "#bd932d", "/logos/jsh.png"),
  teamB: emptyTeam("Mount Warriors", "MWR", "#3d9dd8", "/logos/mwr.png"),
  tossWinner: "A",
  tossDecision: "bat",
});

function initialLiveState(): LiveState {
  return {
    inningsNumber: 1,
    target: undefined,
    score: { runs: 0, wickets: 0, overs: 0, balls: 0 },
    striker: { name: "", runs: 0, balls: 0, fours: 0, sixes: 0, imageUrl: undefined },
    nonStriker: { name: "", runs: 0, balls: 0, fours: 0, sixes: 0, imageUrl: undefined },
    bowler: { name: "", overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0, imageUrl: undefined },
    partnership: { runs: 0, balls: 0 },
    matchBoundaries: { fours: 0, sixes: 0 },
    tournamentBoundaries: { fours: 0, sixes: 0 },
    thisOver: [],
    pointsTable: [],
    matchComplete: false,
    matchResult: undefined,
  } as LiveState;
}

function fallbackSquad(names: string[]): SquadPlayer[] {
  return names.map((name) => ({ id: `manual:${name}`, name }));
}
const ROSTER_TEAM_A_FALLBACK = fallbackSquad([
  "Ravindu Bandara",
  "Chamika Silva",
  "Isuru Weerasekara",
  "Nadun Karunaratne",
  "Lakindu Peris",
  "Tharindu Costa",
  "Ashen Gunaratne",
  "Binura Jayasuriya",
]);
const ROSTER_TEAM_B_FALLBACK = fallbackSquad([
  "Hasitha Perera",
  "Niroshan Jay",
  "Kavindu Silva",
  "Danushka Mendis",
  "Sahan Fernando",
  "Kaveen Mendis",
  "Yohan Raj",
  "Kusal Fernando",
]);

// NEW — imperative handle shape exposed by ScoringSection via forwardRef.
interface ScoringSectionHandle {
  resetEngine: () => void;
}

export default function OverlayAdminConsole({
  auctionId = null,
  matchId = null,
}: {
  auctionId?: string | null;
  matchId?: string | null;
} = {}) {
  const [alwaysOn, setAlwaysOn] = useState({ weather: true, liveScoreBar: true, tournamentLogo: true });
  const [fullScreen, setFullScreen] = useState({ pointsTable: false, matchScorecard: false, matchIntro: false });
  const [boundaryChannels, setBoundaryChannels] = useState({ matchBoundaries: false, tournamentBoundaries: false });

  const [matchSetup, setMatchSetup] = useState<MatchSetup>(defaultMatchSetup());
  const [matchSetupEditing, setMatchSetupEditing] = useState(false);
  const [matchSetupCompleted, setMatchSetupCompleted] = useState(false);

  const [desktopRightTab, setDesktopRightTab] = useState<"setup" | "overlay">("overlay");

  const dbSetupRef = useRef<DbMatchSetupRow | null>(null);

  // ═══════════════════ NEW: Overlay bus connection ═══════════════════
  // This is what actually makes the admin console talk to the on-air
  // overlay page. Previously overlayBus.ts existed but nothing in this
  // file ever called connectOverlayBus — every toggle/moment/push only
  // updated local React state (and, separately, Supabase), so the
  // broadcast overlay never received any of it in real time.
  const busRef = useRef<ReturnType<typeof connectOverlayBus> | null>(null);
  const scoringSectionRef = useRef<ScoringSectionHandle | null>(null);

  // Refs mirroring the latest values needed to answer a "requestSync"
  // from a (re)connecting overlay page. Kept as refs (updated via
  // effects below) rather than closed-over state, so the single
  // long-lived bus.on() handler never sees stale data.
  const channelsRef = useRef<ChannelVisibility>({
    weather: true,
    liveScoreBar: true,
    tournamentLogo: true,
    pointsTable: false,
    matchScorecard: false,
    matchIntro: false,
    matchBoundaries: false,
    tournamentBoundaries: false,
    testBg: false,
  });
  const matchSetupRef = useRef<MatchSetup>(matchSetup);
  const matchSetupCompletedRef = useRef(matchSetupCompleted);
  const liveStateRef = useRef<LiveState>(initialLiveState());
  const weatherRef = useRef({ venue: "GALLE FORT", temp: 28, condition: "partly-cloudy" });

  function sendBus(event: OverlayEvent) {
    busRef.current?.send(event);
  }

  function buildSyncSnapshot(): SyncSnapshot {
    const w = weatherRef.current;
    const weatherData: WeatherData = {
      venue: w.venue,
      temp: w.temp,
      unit: "C",
      condition: w.condition,
      corner: "top-right",
    };
    return {
      channels: channelsRef.current,
      matchSetup: matchSetupRef.current,
      matchSetupCompleted: matchSetupCompletedRef.current,
      liveState: liveStateRef.current,
      weather: weatherData,
    };
  }

  useEffect(() => {
    if (!auctionId) return;
    const bus = connectOverlayBus(auctionId);
    busRef.current = bus;

    const unsubscribe = bus.on((event) => {
      if (event.type === "requestSync") {
        // The admin console is the single source of truth — answer any
        // sync request (e.g. from an overlay page that just loaded or
        // reconnected) with the current full snapshot.
        sendBus({ type: "syncSnapshot", data: buildSyncSnapshot() });
      }
      // Other inbound event types are intentionally ignored here: this
      // console never accepts remote state mutations, only broadcasts.
    });

    return () => {
      unsubscribe();
      bus.disconnect();
      busRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  useEffect(() => {
    channelsRef.current = {
      weather: alwaysOn.weather,
      liveScoreBar: alwaysOn.liveScoreBar,
      tournamentLogo: alwaysOn.tournamentLogo,
      pointsTable: fullScreen.pointsTable,
      matchScorecard: fullScreen.matchScorecard,
      matchIntro: fullScreen.matchIntro,
      matchBoundaries: boundaryChannels.matchBoundaries,
      tournamentBoundaries: boundaryChannels.tournamentBoundaries,
      testBg: false,
    };
  }, [alwaysOn, fullScreen, boundaryChannels]);

  useEffect(() => {
    matchSetupRef.current = matchSetup;
  }, [matchSetup]);

  useEffect(() => {
    matchSetupCompletedRef.current = matchSetupCompleted;
  }, [matchSetupCompleted]);

  function toggleAlwaysOn(key: "weather" | "liveScoreBar" | "tournamentLogo") {
    setAlwaysOn((prev) => {
      const value = !prev[key];
      if (key === "weather") {
        sendBus({ type: "weather", show: value, data: weatherRef.current });
      } else if (key === "liveScoreBar") {
        sendBus({ type: "liveScoreBar", show: value });
      } else {
        sendBus({ type: "tournamentLogo", show: value });
      }
      return { ...prev, [key]: value };
    });
  }

  function toggleFullScreen(key: "pointsTable" | "matchScorecard" | "matchIntro") {
    setFullScreen((prev) => {
      const value = !prev[key];
      sendBus({ type: key, show: value });
      return { ...prev, [key]: value };
    });
  }

  function toggleBoundaryChannel(key: "matchBoundaries" | "tournamentBoundaries") {
    setBoundaryChannels((prev) => {
      const value = !prev[key];
      const counts = key === "matchBoundaries" ? liveStateRef.current.matchBoundaries : liveStateRef.current.tournamentBoundaries;
      sendBus({ type: key, show: value, fours: counts.fours, sixes: counts.sixes });
      return { ...prev, [key]: value };
    });
  }
  // ══════════════════ END overlay bus connection ══════════════════

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("match_setup, match_setup_completed")
        .eq("id", matchId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("[OverlayAdminConsole] failed to load match_setup:", error.message);
        return;
      }
      if (!data) return;

      const raw = (data.match_setup as DbMatchSetupRow) ?? null;
      dbSetupRef.current = raw;
      setMatchSetup((prev) => dbRowToOverlaySetup(raw, prev));
      setMatchSetupCompleted(!!data.match_setup_completed);
    })();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const legacyMatchSetup = useMemo(
    () => ({
      teamA: matchSetup.teamA.shortCode || matchSetup.teamA.name || "Team A",
      teamAColor: matchSetup.teamA.color || "#c9971f",
      teamAlogo: matchSetup.teamA.logoUrl,
      teamB: matchSetup.teamB.shortCode || matchSetup.teamB.name || "Team B",
      teamBColor: matchSetup.teamB.color || "#3d9dd8",
      teamBlogo: matchSetup.teamB.logoUrl,
      venue: matchSetup.venue,
      format: matchSetup.format,
      matchTitle: matchSetup.matchTitle,
      tossWinner: matchSetup.tossWinner === "A" ? "teamA" : matchSetup.tossWinner === "B" ? "teamB" : "",
      tossElected: matchSetup.tossDecision,
    }),
    [matchSetup]
  );

  async function handleMatchSetupPush() {
    pushLog(`Match Setup pushed — ${legacyMatchSetup.teamA} vs ${legacyMatchSetup.teamB}, ${matchSetup.venue}`);
    fireToast("Match Setup pushed to overlay");

    // FIX — snapshot the previous value so it can be rolled back if the
    // DB write below fails; previously this flipped to true optimistically
    // and never reverted on failure, leaving the UI claiming "pushed" even
    // though the match record wasn't actually updated.
    const previousCompleted = matchSetupCompleted;
    setMatchSetupCompleted(true);
    sendBus({ type: "matchSetup", data: matchSetup });

    if (!matchId) return;

    const patch = overlaySetupToDbPatch(matchSetup, dbSetupRef.current);
    const { error: patchErr } = await supabase.rpc("patch_match_setup", { p_match_id: matchId, p_patch: patch });
    if (patchErr) {
      console.error("[OverlayAdminConsole] failed to save match setup to DB:", patchErr.message);
      fireToast("Pushed to overlay, but saving to the match record failed — check console");
      setMatchSetupCompleted(previousCompleted);
      return;
    }
    dbSetupRef.current = { ...(dbSetupRef.current ?? {}), ...patch };

    const { error: completedErr } = await supabase.from("matches").update({ match_setup_completed: true }).eq("id", matchId);
    if (completedErr) {
      console.error("[OverlayAdminConsole] failed to mark match_setup_completed:", completedErr.message);
    }
  }

  function handleVenueSelect(match: GeocodeMatch, displayName?: string) {
    const name = (displayName || (match as any)?.name || matchSetup.venue || "").toString();
    setWeather((w) => ({ ...w, venue: name.toUpperCase() }));
    // FIX — previously only the local weather-widget venue string was
    // updated, so picking a venue from the weather search never synced
    // back into Match Setup's own venue field.
    setMatchSetup((prev) => ({ ...prev, venue: name }));
  }

  const [liveState, setLiveState] = useState<LiveState>(initialLiveState());
  const [livePushed, setLivePushed] = useState(false);
  const [liveDirty, setLiveDirty] = useState(false);
  const [initialEngineState, setInitialEngineState] = useState<EngineSyncState | null>(null);

  const [dismissedPlayers, setDismissedPlayers] = useState<Set<string>>(new Set());

  useEffect(() => {
    liveStateRef.current = liveState;
  }, [liveState]);

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    (async () => {
      const [ls, es] = await Promise.all([loadLiveState(matchId), loadEngineState(matchId)]);
      if (cancelled) return;
      if (ls) setLiveState(ls);
      setInitialEngineState(es);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const inningsOneBattingTeam: "teamA" | "teamB" = useMemo(() => {
    if (matchSetup.tossWinner === "A") return matchSetup.tossDecision === "bat" ? "teamA" : "teamB";
    if (matchSetup.tossWinner === "B") return matchSetup.tossDecision === "bat" ? "teamB" : "teamA";
    return "teamA";
  }, [matchSetup.tossWinner, matchSetup.tossDecision]);

  const battingTeamKey: "teamA" | "teamB" =
    (liveState.inningsNumber ?? 1) === 1
      ? inningsOneBattingTeam
      : inningsOneBattingTeam === "teamA"
      ? "teamB"
      : "teamA";
  const bowlingTeamKey: "teamA" | "teamB" = battingTeamKey === "teamA" ? "teamB" : "teamA";

  const battingSquad: SquadPlayer[] =
    matchSetup[battingTeamKey].squadPlayers?.length
      ? matchSetup[battingTeamKey].squadPlayers
      : battingTeamKey === "teamA"
      ? ROSTER_TEAM_A_FALLBACK
      : ROSTER_TEAM_B_FALLBACK;
  const bowlingSquad: SquadPlayer[] =
    matchSetup[bowlingTeamKey].squadPlayers?.length
      ? matchSetup[bowlingTeamKey].squadPlayers
      : bowlingTeamKey === "teamA"
      ? ROSTER_TEAM_A_FALLBACK
      : ROSTER_TEAM_B_FALLBACK;

  const maxOvers = matchSetup.format === "T20" ? 20 : matchSetup.format === "ODI" ? 50 : undefined;

  useIsMobile();

  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    setLogoFailed(false);
  }, [matchSetup.tournamentLogoUrl]);

  const [mobileTab, setMobileTab] = useState<"overlay" | "scoring" | "setup">("scoring");

  const battingRoleMap = useMemo(() => {
    const m = new Map<string, { role: string }>();
    if (liveState.striker.name) m.set(liveState.striker.name, { role: "striker" });
    if (liveState.nonStriker.name) m.set(liveState.nonStriker.name, { role: "nonStriker" });
    return m;
  }, [liveState.striker.name, liveState.nonStriker.name]);
  const bowlingRoleMap = useMemo(() => {
    const m = new Map<string, { role: string }>();
    if (liveState.bowler.name) m.set(liveState.bowler.name, { role: "bowler" });
    return m;
  }, [liveState.bowler.name]);

  const [rosterView, setRosterView] = useState<"batting" | "bowling">("batting");
  const asideTeamKey: "teamA" | "teamB" = rosterView === "batting" ? battingTeamKey : bowlingTeamKey;
  const asideRoster: SquadPlayer[] = rosterView === "batting" ? battingSquad : bowlingSquad;
  const asideRoleMap = rosterView === "batting" ? battingRoleMap : bowlingRoleMap;

  const [showMoments, setShowMoments] = useState(true);
  const [showWicketForm, setShowWicketForm] = useState(false);
  const [wicketDraft, setWicketDraft] = useState({ batsmanOut: "striker" as "striker" | "nonStriker", dismissalType: "bowled", fielder: "" });
  const [milestoneBatter, setMilestoneBatter] = useState<"striker" | "nonStriker">("striker");
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [milestoneKind, setMilestoneKind] = useState<"fifty" | "hundred">("fifty");
  const [showMatchWonForm, setShowMatchWonForm] = useState(false);
  const [matchWonDraft, setMatchWonDraft] = useState({
    winner: "teamA" as "teamA" | "teamB" | "custom",
    customName: "",
    margin: "",
    method: "batting",
  });

  const [weather, setWeather] = useState({ venue: "GALLE FORT", temp: 28, condition: "partly-cloudy" });
  const [weatherEditing, setWeatherEditing] = useState(false);
  const [weatherOverlayOpen, setWeatherOverlayOpen] = useState(false);

  useEffect(() => {
    weatherRef.current = weather;
  }, [weather]);

  // NEW — broadcast weather changes to the overlay. Skips the initial
  // mount so we don't fire a spurious event before the bus is even
  // connected / before any real change has happened.
  const weatherMountedRef = useRef(false);
  useEffect(() => {
    if (!weatherMountedRef.current) {
      weatherMountedRef.current = true;
      return;
    }
    sendBus({
      type: "weather",
      show: alwaysOn.weather,
      data: { venue: weather.venue, temp: weather.temp, condition: weather.condition },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather]);

  const [toasts, setToasts] = useState<{ id: number; text: string; tone: "wicket" | "boundary" | "info" }[]>([]);
  const toastTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);
  const [particles, setParticles] = useState<{ id: number; tx: number; ty: number; duration: number; color: string }[]>([]);
  const [stamp, setStamp] = useState<{ kind: "boundary" | "wicket"; label: string } | null>(null);
  const [glowActive, setGlowActive] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const stampTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(stampTimeout.current);
      clearTimeout(flashTimeout.current);
    },
    []
  );

  function pushLog(label: string) {
    const id = idCtr++;
    const tone: "wicket" | "boundary" | "info" = /wicket/i.test(label) ? "wicket" : /FOUR|SIX|FIFTY|HUNDRED|WON/.test(label) ? "boundary" : "info";
    setToasts((prev) => [...prev, { id, text: label, tone }].slice(-5));
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      toastTimers.current.delete(id);
    }, 4000);
    toastTimers.current.set(id, timer);
  }
  function fireToast(msg: string) {
    pushLog(msg);
  }
  function spawnParticles(colors: string[]) {
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
  function fireStamp(kind: "boundary" | "wicket", label: string) {
    clearTimeout(stampTimeout.current);
    setStamp({ kind, label });
    setGlowActive(true);
    setFlashActive(true);
    flashTimeout.current = setTimeout(() => setFlashActive(false), 100);
    stampTimeout.current = setTimeout(() => {
      setStamp(null);
      setGlowActive(false);
    }, 1400);
  }

  function onAdminAction(label: string) {
    pushLog(`Admin — ${label}`);
    fireToast(label);
  }

  // ── callbacks handed to ScoringSection — fire the visual moment AND
  // now also broadcast it as an OverlayEvent to the on-air overlay. ──
  function handleBoundaryMoment(moment: "four" | "six", batter: { name: string; runs: number; balls: number }) {
    fireStamp("boundary", moment.toUpperCase());
    spawnParticles(PARTICLE_COLORS_BOUNDARY);
    pushLog(`Moment: ${moment.toUpperCase()} — ${batter.name || "Striker"} ${batter.runs}(${batter.balls})`);
    sendBus({ type: "moment", moment, player: batter.name || "Striker", score: `${batter.runs}(${batter.balls})` });
  }
  function handleMilestoneMoment(
    moment: "fifty" | "hundred",
    batter: { name: string; runs: number; balls: number; label?: string }
  ) {
    fireStamp("boundary", moment === "fifty" ? "FIFTY" : "HUNDRED");
    spawnParticles(PARTICLE_COLORS_BOUNDARY);
    pushLog(`Moment: ${moment.toUpperCase()} — ${batter.label || batter.name || "Batter"} ${batter.runs}(${batter.balls})`);
    sendBus({ type: "moment", moment, player: batter.label || batter.name || "Batter", score: `${batter.runs}(${batter.balls})` });
  }
  function handleWicketConfirm(payload: {
    batsmanOut: "striker" | "nonStriker";
    batter: { name: string; runs: number; balls: number };
    dismissalType: string;
    fielder: string;
    bowlerName: string;
  }) {
    fireStamp("wicket", "OUT");
    spawnParticles(PARTICLE_COLORS_WICKET);
    pushLog(
      `Moment: WICKET — ${payload.batter.name || "Batter"} ${payload.dismissalType}${
        payload.bowlerName ? ` b ${payload.bowlerName}` : ""
      }${payload.fielder ? ` c ${payload.fielder}` : ""}`
    );
    sendBus({
      type: "moment",
      moment: "wicket",
      player: payload.batter.name || "Batter",
      score: `${payload.batter.runs}(${payload.batter.balls})`,
      batsmanOut: payload.batsmanOut,
      dismissalType: payload.dismissalType as BusDismissalType,
      bowler: payload.bowlerName,
      fielder: payload.fielder,
    });
  }
  function fireMaidenMoment(payload: { bowlerName: string; maidens: number }) {
    if (!payload?.bowlerName) {
      fireToast("Set a bowler in Live State first");
      return;
    }
    pushLog(`Moment: MAIDEN OVER — ${payload.bowlerName}`);
    fireToast(`Maiden fired for ${payload.bowlerName}`);
    sendBus({ type: "moment", moment: "maiden", player: payload.bowlerName, maidens: payload.maidens });
  }
  function handleInningsEnd(payload: { target: number; previousInningsRuns: number; inningsNumber: 1 | 2 }) {
    pushLog(`Innings break — target set to ${payload.target}`);
    fireToast(`Target set: ${payload.target}`);
  }
  function handleMatchComplete(result: { winningTeamName: string; margin: string; method: string }) {
    fireStamp("boundary", "WON");
    spawnParticles(PARTICLE_COLORS_BOUNDARY);
    pushLog(`Moment: MATCH WON — ${result.winningTeamName} ${result.margin}`);
    sendBus({
      type: "moment",
      moment: "matchWon",
      player: result.winningTeamName,
      score: result.margin,
      method: result.method as "runs" | "wickets" | "tie",
    });
  }

  function pushLiveState() {
    setLivePushed(true);
    setLiveDirty(false);
    pushLog("Live State pushed to overlay");
    sendBus({ type: "liveState", data: liveState });
    if (matchId) saveLiveState(matchId, liveState);
    setTimeout(() => setLivePushed(false), 1500);
  }

  function handleEngineStateChange(state: EngineSyncState) {
    if (matchId) saveEngineState(matchId, state);
  }

  async function restartMatchAndEngine() {
    // FIX (restart desync bug) — force the scoring engine's own internal
    // state to reset too, regardless of whether this was triggered from
    // the header/top-bar button or ScoringSection's own restart dialog
    // (which already calls engine.resetEngineState() itself — calling it
    // again here is a harmless no-op in that case). Previously only
    // liveState/dismissedPlayers were reset here, leaving extraType,
    // pendingWicket, the undo snapshot, and ballSequence stale whenever
    // the header button was used.
    scoringSectionRef.current?.resetEngine();

    const fresh = initialLiveState();
    setLiveState(fresh);
    setLiveDirty(false);
    setDismissedPlayers(new Set());
    setShowClearConfirm(false);
    pushLog("Innings cleared / match restarted");
    fireToast("Match restarted");
    sendBus({ type: "liveState", data: fresh });

    if (matchId) {
      await saveLiveState(matchId, fresh);
      await clearEngineState(matchId);
      await deleteAllBalls(matchId);
    }
  }

  const overs = `${liveState.score.overs}.${liveState.score.balls}`;
  const isSecondInnings = (liveState.inningsNumber ?? 1) === 2;

  function fireBoundaryMoment(kind: string) {
    fireStamp("boundary", kind.toUpperCase());
    spawnParticles(PARTICLE_COLORS_BOUNDARY);
    pushLog(`Moment: ${kind.toUpperCase()} (manual) — ${liveState.striker.name || "Striker"} ${liveState.striker.runs}(${liveState.striker.balls})`);
    sendBus({
      type: "moment",
      moment: kind as "four" | "six",
      player: liveState.striker.name || "Striker",
      score: `${liveState.striker.runs}(${liveState.striker.balls})`,
    });
  }
  function fireMilestoneMoment(kind: "fifty" | "hundred", who: "striker" | "nonStriker" = milestoneBatter) {
    const batter = who === "striker" ? liveState.striker : liveState.nonStriker;
    const label = batter.name || (who === "striker" ? "Striker" : "Non-Striker");
    fireStamp("boundary", kind === "fifty" ? "FIFTY" : "HUNDRED");
    spawnParticles(PARTICLE_COLORS_BOUNDARY);
    pushLog(`Moment: ${kind.toUpperCase()} (manual) — ${label} ${batter.runs}(${batter.balls})`);
    sendBus({ type: "moment", moment: kind, player: label, score: `${batter.runs}(${batter.balls})` });
  }
  function fireWicketMoment() {
    const batter = wicketDraft.batsmanOut === "striker" ? liveState.striker : liveState.nonStriker;
    fireStamp("wicket", "OUT");
    spawnParticles(PARTICLE_COLORS_WICKET);
    pushLog(
      `Moment: WICKET (manual) — ${batter.name || "Batter"} ${wicketDraft.dismissalType}${
        liveState.bowler.name ? ` b ${liveState.bowler.name}` : ""
      }${wicketDraft.fielder ? ` c ${wicketDraft.fielder}` : ""}`
    );
    sendBus({
      type: "moment",
      moment: "wicket",
      player: batter.name || "Batter",
      score: `${batter.runs}(${batter.balls})`,
      batsmanOut: wicketDraft.batsmanOut,
      dismissalType: wicketDraft.dismissalType as BusDismissalType,
      bowler: liveState.bowler.name,
      fielder: wicketDraft.fielder,
    });
    setWicketDraft({ batsmanOut: "striker", dismissalType: "bowled", fielder: "" });
    setShowWicketForm(false);
  }
  function fireMatchWonMoment() {
    const name =
      matchWonDraft.winner === "teamA"
        ? legacyMatchSetup.teamA
        : matchWonDraft.winner === "teamB"
        ? legacyMatchSetup.teamB
        : matchWonDraft.customName || "Winner";
    const margin = matchWonDraft.margin || "Match Won";
    fireStamp("boundary", "WON");
    spawnParticles(PARTICLE_COLORS_BOUNDARY);
    pushLog(`Moment: MATCH WON (manual) — ${name} ${margin}`);
    sendBus({
      type: "moment",
      moment: "matchWon",
      player: name,
      score: margin,
      teamColor: matchWonDraft.winner === "teamA" ? legacyMatchSetup.teamAColor : matchWonDraft.winner === "teamB" ? legacyMatchSetup.teamBColor : undefined,
      method: matchWonDraft.method === "batting" ? "wickets" : matchWonDraft.method === "bowling" ? "runs" : "tie",
    });
    setShowMatchWonForm(false);
  }

  return (
    <div className="bg-background text-on-background min-h-screen lg:h-screen lg:overflow-hidden flex flex-col relative" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
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
      `,
        }}
      />

      {particles.map((p) => (
        <span
          key={p.id}
          className="cr-particle"
          style={
            {
              left: "50%",
              top: "38%",
              backgroundColor: p.color,
              "--tx": `${p.tx}px`,
              "--ty": `${p.ty}px`,
              animationDuration: `${p.duration}s`,
            } as React.CSSProperties
          }
        />
      ))}
      <div
        className={`fixed inset-0 pointer-events-none z-[60] transition-opacity duration-75 ${
          stamp?.kind === "boundary" ? "bg-theme-orange/10" : stamp?.kind === "wicket" ? "bg-slate-400/5" : "bg-white/0"
        } ${flashActive ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`fixed inset-0 pointer-events-none z-[55] flex items-center justify-center transition-opacity duration-500 ${
          glowActive ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="w-[280px] h-[280px] sm:w-[460px] sm:h-[460px] rounded-full blur-[90px] sm:blur-[120px]"
          style={{ background: stamp?.kind === "boundary" ? "rgba(201,151,31,0.18)" : "rgba(113,128,150,0.12)" }}
        />
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
            <Icon name={t.tone === "wicket" ? "sports_cricket" : t.tone === "boundary" ? "bolt" : "info"} style={{ fontSize: 14, marginTop: 1 }} />
            <span className="min-w-0">{t.text}</span>
          </div>
        ))}
      </div>

      {/* ══════════ HEADER ══════════ */}
      <header className="hidden sm:flex sticky top-0 shrink-0 z-50 justify-between items-center px-3 sm:px-4 h-16 glass-panel border-b border-white/10 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="w-16 h-16 flex items-center justify-center shrink-0 overflow-hidden">
            {!logoFailed ? (
              <Image
                src={matchSetup.tournamentLogoUrl || DEFAULT_LOGO_SRC}
                alt="Tournament logo"
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
            <span style={{ color: legacyMatchSetup.teamAColor }}>{legacyMatchSetup.teamA}</span> 
              vs{" "}
            <span style={{ color: legacyMatchSetup.teamBColor }}>{legacyMatchSetup.teamB}</span>
          </h1>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full shrink-0" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full" style={{ background: "#22c55e", opacity: 0.5 }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "#22c55e" }} />
            </span>
            <span className="font-mono-geist text-[10px] uppercase tracking-[0.16em] font-bold" style={{ color: "#22c55e" }}>
              Broadcasting
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden xl:flex items-center gap-2 text-on-surface-variant font-mono-geist text-[10px] uppercase tracking-[0.12em]">
            <Icon name="lock" style={{ fontSize: 14 }} />
            Secure Admin Node
          </div>
          <div className="hidden md:block font-mono-geist text-[10px] text-right">
            <div className="text-on-surface-variant uppercase tracking-[0.1em]">Match</div>
            <div className="text-theme-orange font-bold">
              {legacyMatchSetup.teamA} vs {legacyMatchSetup.teamB}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1.5 bg-error-container text-on-error-container px-3 sm:px-6 py-2 rounded font-mono-geist font-bold hover:brightness-110 transition-all active:scale-95 border border-white/10 uppercase tracking-[0.2em] text-xs shrink-0"
          >
            <Icon name="restart_alt" style={{ fontSize: 14 }} /> <span className="hidden sm:inline">Restart Match</span>
          </button>
        </div>
      </header>

      {/* ── On Air channels — desktop only ── */}
      <div className="hidden lg:flex sticky top-16 w-full z-40 px-3 sm:px-6 py-1.5 sm:py-3 items-start gap-4 flex-wrap border-b border-white/5 bg-surface-container-lowest">
        <div className="flex flex-col items-center gap-1.5">
          <GroupLabel center>On Air</GroupLabel>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <TogglePill label="Weather" on={alwaysOn.weather} dotColor="#22c55e" onClick={() => toggleAlwaysOn("weather")} />
            <TogglePill label="Live Score Bar" on={alwaysOn.liveScoreBar} dotColor="#22c55e" onClick={() => toggleAlwaysOn("liveScoreBar")} />
            <TogglePill label="Tournament Logo" on={alwaysOn.tournamentLogo} dotColor="#22c55e" onClick={() => toggleAlwaysOn("tournamentLogo")} />
          </div>
        </div>
        <span className="hidden sm:block w-px self-stretch bg-white/10" />
        <div className="flex flex-col items-center gap-1.5">
          <GroupLabel center>Full-Screen</GroupLabel>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <TogglePill label="Points Table" on={fullScreen.pointsTable} dotColor="#c9971f" onClick={() => toggleFullScreen("pointsTable")} />
            <TogglePill label="Match Scorecard" on={fullScreen.matchScorecard} dotColor="#c9971f" onClick={() => toggleFullScreen("matchScorecard")} />
            <TogglePill label="Match Intro" on={fullScreen.matchIntro} dotColor="#c9971f" onClick={() => toggleFullScreen("matchIntro")} />
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
                onClick={() => toggleBoundaryChannel(c.key)}
              />
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 flex flex-col pb-8 lg:pb-0 lg:grid lg:grid-cols-[20%_55%_25%] lg:h-[calc(100vh-8rem)] lg:overflow-hidden">
        {/* ══════════ LEFT: Roster (2nd on mobile) ══════════ */}
        <aside className="order-2 lg:order-1 hidden lg:flex lg:flex-col lg:h-full bg-surface-container-lowest border-t lg:border-t-0 lg:border-r border-outline-variant shrink-0 lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-4 px-4 gap-4">
          <div className="hidden lg:flex lg:flex-1 lg:min-h-0 flex-col lg:overflow-hidden">
            <div className="flex items-center justify-between mb-1 shrink-0 gap-2 flex-wrap">
              <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.18em] font-bold">
                Roster — {legacyMatchSetup[asideTeamKey]}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                <TogglePill label="Batting" on={rosterView === "batting"} dotColor="#c9971f" onClick={() => setRosterView("batting")} />
                <TogglePill label="Bowling" on={rosterView === "bowling"} dotColor="#c9971f" onClick={() => setRosterView("bowling")} />
              </div>
            </div>

            <div className="flex items-center justify-between mb-3 shrink-0 gap-2">
              <span className="font-mono-geist text-[9px] text-on-surface-variant shrink-0">{asideRoster.length} players</span>
            </div>

            <div className="max-h-72 lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-2">
              {asideRoster.map((player) => {
                const isOut = dismissedPlayers.has(player.name);
                const roleInfo = asideRoleMap.get(player.name);
                const isLocked = isOut || !!roleInfo;
                const roleLabel =
                  roleInfo?.role === "striker" ? "On Strike" : roleInfo?.role === "nonStriker" ? "Non-Striker" : roleInfo?.role === "bowler" ? "Bowling" : undefined;

                return (
                  <button
                    type="button"
                    key={player.id}
                    draggable={!isLocked}
                    disabled={isLocked}
                    onDragStart={(e) => {
                      if (isLocked) {
                        e.preventDefault();
                        return;
                      }
                      e.dataTransfer.setData("text/player-id", player.id);
                    }}
                    className="w-full flex items-center gap-3 rounded-lg pl-2.5 pr-3 py-3 text-left transition-all"
                    style={
                      isOut
                        ? { opacity: 0.55, cursor: "not-allowed", border: "1px solid rgba(248,113,113,0.4)", background: "rgba(239,68,68,0.08)" }
                        : roleInfo
                        ? { opacity: 0.85, cursor: "not-allowed", border: "1px solid rgba(74,222,128,0.4)", background: "rgba(34,197,94,0.08)" }
                        : { border: "1px solid rgba(255,255,255,0.08)", background: "transparent" }
                    }
                  >
                    <span
                      className="h-9 w-9 rounded-full flex items-center justify-center font-mono-geist text-[11px] font-bold shrink-0 overflow-hidden"
                      style={{ border: "1px solid rgba(255,255,255,0.15)", color: isOut ? "#f87171" : roleInfo ? "#4ade80" : "#e5e7eb" }}
                    >
                      {player.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={player.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        initials(player.name)
                      )}
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="font-archivo text-sm font-bold truncate" style={{ color: isOut ? "#f87171" : roleInfo ? "#4ade80" : "var(--color-on-surface)" }}>
                        {player.name}
                      </span>
                      <span className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.08em]">
                        {legacyMatchSetup[asideTeamKey]}
                        {isOut ? " · OUT" : roleLabel ? ` · ${roleLabel}` : ""}
                      </span>
                    </span>
                    {roleInfo && (
                      <Icon name={roleInfo.role === "bowler" ? "sports_cricket" : "sports_baseball"} className="ml-auto" style={{ fontSize: 16, color: "#4ade80" }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ══════════ CENTER: Live scoring (ScoringSection owns the engine) ══════════ */}
        <ScoringSection
          ref={scoringSectionRef}
          mobileTab={mobileTab}
          matchId={matchId}
          matchSetup={legacyMatchSetup}
          battingTeamKey={battingTeamKey}
          bowlingTeamKey={bowlingTeamKey}
          battingSquad={battingSquad}
          bowlingSquad={bowlingSquad}
          maxOvers={maxOvers}
          liveState={liveState}
          setLiveState={setLiveState}
          liveDirty={liveDirty}
          setLiveDirty={setLiveDirty}
          onPush={pushLiveState}
          pushLabel={livePushed ? "Pushed ✓" : "Push Live State"}
          onBoundary={handleBoundaryMoment}
          onMilestone={handleMilestoneMoment}
          onWicketConfirm={handleWicketConfirm}
          onMaiden={fireMaidenMoment}
          onInningsEnd={handleInningsEnd}
          onMatchComplete={handleMatchComplete}
          onRestartMatch={restartMatchAndEngine}
          onEngineStateChange={handleEngineStateChange}
          initialEngineState={initialEngineState}
          onAdminAction={onAdminAction}
          onDismissedPlayersChange={setDismissedPlayers}
        />

        {/* ══════════ RIGHT: Match Setup + Moments + Weather (3rd on mobile) ══════════ */}
        <aside className="order-3 border-l border-outline-variant flex mb-0 flex-col min-h-0 lg:h-full shrink-0 lg:overflow-y-auto custom-scrollbar gap-4">

          <div className="hidden lg:flex items-center gap-1.5 px-3 pt-3 shrink-0">
            {DESKTOP_RIGHT_TABS.map((tab) => {
              const active = desktopRightTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDesktopRightTab(tab.key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-mono-geist text-[10px] font-bold uppercase tracking-[0.14em] transition-all hover:brightness-110"
                  style={{
                    background: active ? "rgba(201,151,31,0.12)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${active ? "rgba(201,151,31,0.35)" : "rgba(255,255,255,0.08)"}`,
                    color: active ? "#e8c468" : "rgba(255,255,255,0.45)",
                  }}
                >
                  <Icon name={tab.icon} style={{ fontSize: 14 }} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── Setup (desktop tab: "setup") ── */}
          <div className={desktopRightTab === "setup" ? "lg:flex lg:flex-col lg:flex-1 lg:min-h-0" : "lg:hidden"}>
            <MatchSetupPanel
              auctionId={auctionId}
              matchSetup={matchSetup}
              setMatchSetup={setMatchSetup}
              onPush={handleMatchSetupPush}
              pushLabel={matchSetupCompleted ? "Update & Push Match Setup" : "Push Match Setup"}
              completed={matchSetupCompleted}
              onVenueSelect={handleVenueSelect}
              matchId={matchId}
              onEditingChange={setMatchSetupEditing}
              mobileTab={mobileTab}
            />
          </div>

          <div
            className={`flex-col min-h-0 max-h-[calc(100dvh-6rem)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:max-h-none lg:overflow-visible lg:contents ${
              mobileTab === "overlay" ? "flex" : "hidden"
            }`}
          >
            {/* Broadcast Channels */}
            <div className="p-4 shrink-0 lg:hidden flex flex-col gap-2.5">
              <div>
                <h3 className="font-archivo text-sm font-bold italic uppercase mb-0.5">Broadcast Channels</h3>
                <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.06em] leading-tight">Toggle what's live on the overlay.</p>
              </div>

              <div>
                <span className="font-mono-geist text-[8px] font-bold uppercase tracking-[0.16em] text-theme-orange">On Air</span>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  <MobileChannelRow icon="partly_cloudy_day" label="Weather" on={alwaysOn.weather} dotColor="#22c55e" onClick={() => toggleAlwaysOn("weather")} />
                  <MobileChannelRow icon="scoreboard" label="Live Score Bar" on={alwaysOn.liveScoreBar} dotColor="#22c55e" onClick={() => toggleAlwaysOn("liveScoreBar")} />
                  <MobileChannelRow icon="military_tech" label="Tournament Logo" on={alwaysOn.tournamentLogo} dotColor="#22c55e" onClick={() => toggleAlwaysOn("tournamentLogo")} />
                </div>
              </div>

              <div>
                <span className="font-mono-geist text-[8px] font-bold uppercase tracking-[0.16em] text-theme-orange">Full-Screen</span>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  <MobileChannelRow icon="leaderboard" label="Points Table" on={fullScreen.pointsTable} dotColor="#c9971f" onClick={() => toggleFullScreen("pointsTable")} />
                  <MobileChannelRow icon="receipt_long" label="Match Scorecard" on={fullScreen.matchScorecard} dotColor="#c9971f" onClick={() => toggleFullScreen("matchScorecard")} />
                  <MobileChannelRow icon="theaters" label="Match Intro" on={fullScreen.matchIntro} dotColor="#c9971f" onClick={() => toggleFullScreen("matchIntro")} />
                </div>
              </div>

              <div>
                <span className="font-mono-geist text-[8px] font-bold uppercase tracking-[0.16em] text-theme-orange">Moments</span>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  <MobileChannelRow icon="stadium" label="Match Boundaries" on={boundaryChannels.matchBoundaries} dotColor="#e8c468" onClick={() => toggleBoundaryChannel("matchBoundaries")} />
                  <MobileChannelRow icon="emoji_events" label="Tournament Boundaries" on={boundaryChannels.tournamentBoundaries} dotColor="#e8c468" onClick={() => toggleBoundaryChannel("tournamentBoundaries")} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 pb-4 lg:contents lg:pb-0">
              <div className={`shrink-0 pt-4 px-4 ${desktopRightTab === "overlay" ? "lg:block" : "lg:hidden"}`}>
                <h3 className="font-archivo text-sm font-bold italic uppercase mb-0.5">Overlay Advanced</h3>
                <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.06em] leading-tight">
                  Moments &amp; live weather, together in one view.
                </p>
              </div>

              <div className="px-4 shrink-0 lg:hidden">
                <button
                  type="button"
                  onClick={() => setWeatherOverlayOpen(true)}
                  className="w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] active:scale-[0.98] transition-all"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.3)" }}
                    >
                      <Icon name="partly_cloudy_day" style={{ fontSize: 16, color: "#22c55e" }} />
                    </span>
                    <span className="flex flex-col items-start min-w-0">
                      <span className="font-archivo text-sm font-bold text-on-surface truncate">Weather</span>
                      <span className="font-mono-geist text-[9px] uppercase tracking-[0.1em] text-on-surface-variant truncate">
                        {weather.venue} · {weather.temp}°
                      </span>
                    </span>
                  </span>
                  <Icon name="chevron_right" className="text-on-surface-variant shrink-0" style={{ fontSize: 16 }} />
                </button>
              </div>

              <CenteredOverlay
                open={weatherOverlayOpen}
                onClose={() => setWeatherOverlayOpen(false)}
                title="Weather"
                icon="partly_cloudy_day"
                iconColor="#22c55e"
              >
                <WeatherPanel
                  weather={weather}
                  setWeather={setWeather}
                  weatherEditing={true}
                  setWeatherEditing={setWeatherEditing}
                  pushLog={pushLog}
                  fireToast={fireToast}
                  mobileTab={mobileTab}
                  desktopVisible={desktopRightTab === "overlay"}
                />
              </CenteredOverlay>

              {/* ── Moments — all fields now read from liveState ── */}
              <div className={`px-4 shrink-0 flex flex-col lg:min-h-0 lg:overflow-hidden ${desktopRightTab === "overlay" ? "lg:flex lg:flex-1" : "lg:hidden"}`}>
                <button type="button" onClick={() => setShowMoments((v) => !v)} className="w-full flex items-center justify-between gap-3 mb-1 shrink-0">
                  <h3 className="font-archivo text-base font-bold italic uppercase">Moments</h3>
                </button>
                {showMoments && (
                  <div className="flex flex-col gap-3 lg:overflow-y-auto custom-scrollbar lg:min-h-0">
                    <div className="grid grid-cols-3 gap-2.5">
                      <MomentButton label="Four" onClick={() => fireBoundaryMoment("four")} />
                      <MomentButton label="Six" onClick={() => fireBoundaryMoment("six")} />
                      <MomentButton label="Wicket" danger active={showWicketForm} onClick={() => setShowWicketForm((v) => !v)} />
                      <MomentButton
                        label="Fifty"
                        active={showMilestoneForm && milestoneKind === "fifty"}
                        onClick={() => {
                          setMilestoneKind("fifty");
                          setShowMilestoneForm(true);
                        }}
                      />
                      <MomentButton label="Maiden" onClick={() => fireMaidenMoment({ bowlerName: liveState.bowler.name, maidens: liveState.bowler.maidens })} />
                      <MomentButton label="Match Won" active={showMatchWonForm} onClick={() => setShowMatchWonForm((v) => !v)} />
                    </div>
                    <MomentButton
                      label="Hundred"
                      full
                      active={showMilestoneForm && milestoneKind === "hundred"}
                      onClick={() => {
                        setMilestoneKind("hundred");
                        setShowMilestoneForm(true);
                      }}
                    />

                    <CenteredOverlay
                      open={showWicketForm}
                      onClose={() => setShowWicketForm(false)}
                      title="Wicket Detail"
                      icon="sports_cricket"
                      iconColor="#f87171"
                    >
                      <div className="flex flex-col gap-3">
                        <p className="font-mono-geist text-[9.5px] text-on-surface-variant uppercase tracking-[0.08em]">
                          Manual graphic only — doesn&apos;t record a real dismissal. Use the Out button in Scoring for that.
                        </p>
                        <div className="flex flex-col gap-1.5">
                          <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Batsman Out</span>
                          <div className="grid grid-cols-2 gap-2">
                            <BatterPickerButton batter={liveState.striker} label="Striker" selected={wicketDraft.batsmanOut === "striker"} onClick={() => setWicketDraft((p) => ({ ...p, batsmanOut: "striker" }))} />
                            <BatterPickerButton batter={liveState.nonStriker} label="Non-Striker" selected={wicketDraft.batsmanOut === "nonStriker"} onClick={() => setWicketDraft((p) => ({ ...p, batsmanOut: "nonStriker" }))} />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Dismissal</span>
                          <select
                            value={wicketDraft.dismissalType}
                            onChange={(e) => setWicketDraft((p) => ({ ...p, dismissalType: e.target.value }))}
                            className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-white/10 text-on-surface"
                          >
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
                          <input
                            value={wicketDraft.fielder}
                            onChange={(e) => setWicketDraft((p) => ({ ...p, fielder: e.target.value }))}
                            placeholder="Fielder name"
                            className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-white/10 text-on-surface placeholder:text-on-surface-variant"
                          />
                        </div>
                        <p className="font-mono-geist text-[10px] text-on-surface-variant">Bowler from Live State: {liveState.bowler.name || "—"}</p>
                        <button
                          type="button"
                          onClick={fireWicketMoment}
                          className="w-full py-2.5 rounded-full font-mono-geist text-[11px] font-black uppercase tracking-wide"
                          style={{ background: "#ef4444", color: "#fff" }}
                        >
                          Fire Wicket
                        </button>
                      </div>
                    </CenteredOverlay>

                    <CenteredOverlay
                      open={showMilestoneForm}
                      onClose={() => setShowMilestoneForm(false)}
                      title={milestoneKind === "fifty" ? "Fifty For" : "Hundred For"}
                      icon="military_tech"
                      iconColor="#e8c468"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Batter</span>
                          <div className="grid grid-cols-2 gap-2">
                            <BatterPickerButton
                              batter={liveState.striker}
                              label="Striker"
                              selected={milestoneBatter === "striker"}
                              onClick={() => setMilestoneBatter("striker")}
                            />
                            <BatterPickerButton
                              batter={liveState.nonStriker}
                              label="Non-Striker"
                              selected={milestoneBatter === "nonStriker"}
                              onClick={() => setMilestoneBatter("nonStriker")}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            fireMilestoneMoment(milestoneKind, milestoneBatter);
                            setShowMilestoneForm(false);
                          }}
                          className="w-full py-2.5 rounded-full font-mono-geist text-[11px] font-black uppercase tracking-wide"
                          style={{ background: GOLD_GRADIENT, color: "#1a1304" }}
                        >
                          Fire {milestoneKind === "fifty" ? "Fifty" : "Hundred"}
                        </button>
                      </div>
                    </CenteredOverlay>

                    {showMatchWonForm && (
                      <div className="flex flex-col gap-3 p-4 rounded-lg mt-1 bg-theme-orange/10 border border-theme-orange/25">
                        <span className="font-mono-geist text-[10px] font-bold uppercase tracking-[0.18em] text-theme-orange">Match Won Detail</span>
                        <div className="flex flex-col gap-1.5">
                          <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Winning Team</span>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { key: "teamA" as const, label: legacyMatchSetup.teamA },
                              { key: "teamB" as const, label: legacyMatchSetup.teamB },
                              { key: "custom" as const, label: "Other" },
                            ].map((opt) => (
                              <button
                                type="button"
                                key={opt.key}
                                onClick={() => setMatchWonDraft((p) => ({ ...p, winner: opt.key }))}
                                className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-center transition-all"
                                style={{
                                  border: `1px solid ${matchWonDraft.winner === opt.key ? "rgba(201,151,31,0.5)" : "rgba(255,255,255,0.08)"}`,
                                  background: matchWonDraft.winner === opt.key ? "rgba(201,151,31,0.14)" : "rgba(255,255,255,0.02)",
                                }}
                              >
                                <span className={`text-[11px] font-archivo font-bold truncate max-w-full ${matchWonDraft.winner === opt.key ? "text-theme-orange" : "text-on-surface"}`}>
                                  {opt.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                        {matchWonDraft.winner === "custom" && (
                          <input
                            value={matchWonDraft.customName}
                            onChange={(e) => setMatchWonDraft((p) => ({ ...p, customName: e.target.value }))}
                            placeholder="Winning team name"
                            className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-white/10 text-on-surface placeholder:text-on-surface-variant"
                          />
                        )}
                        <input
                          value={matchWonDraft.margin}
                          onChange={(e) => setMatchWonDraft((p) => ({ ...p, margin: e.target.value }))}
                          placeholder="e.g. won by 4 wickets"
                          className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-white/10 text-on-surface placeholder:text-on-surface-variant"
                        />
                        <select
                          value={matchWonDraft.method}
                          onChange={(e) => setMatchWonDraft((p) => ({ ...p, method: e.target.value }))}
                          className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-white/[0.03] border border-white/10 text-on-surface"
                        >
                          <option value="batting">Chasing side won (by wickets)</option>
                          <option value="bowling">Defending side won (by runs)</option>
                          <option value="tie">Tie</option>
                        </select>
                        <button
                          type="button"
                          onClick={fireMatchWonMoment}
                          className="w-full py-2.5 rounded-full font-mono-geist text-[11px] font-black uppercase tracking-wide"
                          style={{ background: GOLD_GRADIENT, color: "#1a1304" }}
                        >
                          Fire Match Won
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={`hidden px-4 lg:mb-4 shrink-0 ${desktopRightTab === "overlay" ? "lg:block" : "lg:hidden"}`}>
                <WeatherPanel
                  weather={weather}
                  setWeather={setWeather}
                  weatherEditing={true}
                  setWeatherEditing={setWeatherEditing}
                  pushLog={pushLog}
                  fireToast={fireToast}
                  mobileTab={mobileTab}
                  desktopVisible={desktopRightTab === "overlay"}
                />
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* ══════════ MOBILE BOTTOM TAB BAR ══════════ */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-[350] flex items-stretch glass-panel border-t border-white/10" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {[
          { key: "overlay" as const, label: "Overlay", icon: "tv" },
          { key: "scoring" as const, label: "Scoring", icon: "sports_cricket" },
          { key: "setup" as const, label: "Setup", icon: "tune" },
        ].map((tab) => {
          const active = mobileTab === tab.key;
          return (
            <button type="button" key={tab.key} onClick={() => setMobileTab(tab.key)} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors">
              <Icon name={tab.icon} style={{ fontSize: 21 }} className={active ? "text-theme-orange" : "text-on-surface-variant"} />
              <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: active ? "#e8c468" : "rgba(255,255,255,0.4)" }}>
                {tab.label}
              </span>
              <span className="h-0.5 w-6 rounded-full transition-opacity" style={{ background: "#e8c468", opacity: active ? 1 : 0 }} />
            </button>
          );
        })}
      </nav>

      {/* Restart confirm */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowClearConfirm(false)} />
          <div
            className="relative z-10 w-full max-w-md mx-4 rounded-2xl p-6 sm:p-8 flex flex-col gap-5 sm:gap-6 bg-surface-container-lowest max-h-[90vh] overflow-y-auto custom-scrollbar"
            style={{ border: "1px solid rgba(248,113,113,0.2)", boxShadow: "0 0 80px rgba(239,68,68,0.12), 0 24px 64px rgba(0,0,0,0.6)" }}
          >
            <div className="flex items-center justify-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <Icon name="restart_alt" style={{ fontSize: 28, color: "#f87171" }} />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="font-archivo text-xl sm:text-2xl font-bold italic uppercase tracking-tight text-white">Restart the Match?</h2>
              <p className="font-mono-geist text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-[0.12em] leading-relaxed">
                Score, batters, bowler figures, and ball history all reset to zero.
                <br />
                This cannot be undone.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-center">
                <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.15em] mb-1">Current Score</p>
                <p className="font-archivo text-xl sm:text-2xl font-bold text-white">
                  {liveState.score.runs}/{liveState.score.wickets}
                </p>
              </div>
              <div className="text-center">
                <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.15em] mb-1">Overs</p>
                <p className="font-archivo text-xl sm:text-2xl font-bold text-white">{overs}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 rounded-xl font-mono-geist text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110 active:scale-95"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#a0aec0" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={restartMatchAndEngine}
                className="flex-1 py-3 rounded-xl font-mono-geist text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110 active:scale-95"
                style={{ background: "linear-gradient(135deg, #991b1b, #ef4444)", color: "#fff", boxShadow: "0 4px 24px rgba(239,68,68,0.3)" }}
              >
                Restart Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}