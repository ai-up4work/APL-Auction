// app/(protected)/overlay/[auctionId]/admin/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import WeatherPanel from "@/components/overlays/admin/new/Weatherpanel";
import MatchSetupPanel from "@/components/overlays/admin/new/MatchInfopanel";
import ScoringSection from "@/components/overlays/admin/new/Scoringsection";
import type { MatchSetup, TeamInfo } from "@/lib/overlayBus";
import type { GeocodeMatch } from "@/lib/fetchVenueWeather";
import { supabase } from "@/lib/supabase";
import { dbRowToOverlaySetup, overlaySetupToDbPatch, type DbMatchSetupRow } from "@/lib/matchSetupAdapter";

/* ─────────────────────────────────────────────────────────────
   Auction-console visual language. Striker / Non-Striker / Bowler
   are picked via the ScoringSection's crew slots (drag on desktop,
   bottom-sheet tap on mobile). Weather and Match Setup are their
   own cards. Everything else — moments, on-air toggles, roster
   rail, event feed — lives here in the shell.

   MATCH SETUP CONTRACT (this pass):
   - `matchSetup` on this page now matches the real `MatchSetup` /
     `TeamInfo` shape from `@/lib/overlayBus` (teamA/teamB are
     objects with name/shortCode/color/logoUrl/squadPlayers — not
     bare strings). MatchSetupPanel owns the full editing UI,
     roster lookups, and its own locked/editing state; this page
     just holds the source-of-truth state and reacts to
     `onPush` / `onEditingChange`.
   - ScoringSection (and the rest of this file's pre-existing
     display logic) was built against an older FLAT shape
     (`teamA: "JSH"`, `teamAColor`, ...). Rather than rewrite that
     component blind, `legacyMatchSetup` below derives that same
     flat shape from the real `matchSetup` state, so everything
     downstream keeps working off one source of truth.

   MATCH SETUP ↔ DB CONSISTENCY (this pass):
   - Previously this page's `matchSetup` was PURELY LOCAL — it
     initialized from `defaultMatchSetup()` and "Push Match Setup"
     only logged/toasted. It never read or wrote the same
     `matches.match_setup` row the Match Editor page
     (app/(protected)/match/[matchId]/edit) uses, and even if it
     had, the two used incompatible shapes (teamA/teamB+shortCode+
     logoUrl here vs team1/team2+short+logo+a separate squads array
     there). A match set up in one place was invisible in the
     other.
   - Fixed via `lib/matchSetupAdapter.ts`: on mount (when `matchId`
     is present) this page now loads `matches.match_setup` +
     `match_setup_completed` and hydrates `matchSetup` /
     `matchSetupCompleted` from it. `handleMatchSetupPush` now also
     writes back through the same `patch_match_setup` RPC the Match
     Editor uses (a shallow, top-level merge), so fields the overlay
     console doesn't manage — date, round, officials, overs,
     matchMeta, rosterLocked, and each squad's captain/role/XI — are
     left exactly as the Match Editor last set them. `dbSetupRef`
     tracks the last-loaded/saved raw row so the adapter has
     something to preserve those fields against.

   SCORING CONTRACT (fixed in an earlier pass):
   - record(runsAdded, opts) is the single source of truth for every
     ball. `runsAdded` is ALWAYS a number. Extras are tagged via
     opts.extra using the short codes "Wd" | "Nb" | "Lb" | "By" —
     the same codes the `extras` state object and ScoringSection's
     ballOutcome() expect. Nothing should ever call setTeamRuns with
     a non-numeric runsAdded — that was the bug where tapping Wide/
     No Ball/Bye/LB turned teamRuns into a string ("5Wide4...") and
     silently broke every downstream calculation (run rate, target,
     required rate).
   - Undo goes through the real handleUndo()/history stack, not
     through record()/handleRun().
   - currentOverBalls is tracked explicitly here (overBalls state)
     and passed down — ScoringSection has no way to derive it on
     its own.

   OVER-STRIP RESET FIX (this pass):
   - The "This Over" strip (overBalls) must only reset once 6 LEGAL
     deliveries have been bowled — not once the array hits 6 items.
     Wides/No Balls are appended to the strip but don't count as
     legal deliveries, so an over with extras in it has MORE than 6
     entries before it's actually complete. The previous check used
     `prev.length >= 6`, which counted extras too — so on an over
     containing e.g. 3 legal balls + 3 extras, the next legal ball
     saw length 6, wrongly reset the whole strip to just that one
     new entry, and silently ate everything that came before it
     (including the extras). Fixed below by counting only legal
     entries (excluding "Wd"/"Nb") when deciding whether to reset.

   TOURNAMENT LOGO FIX (this pass):
   - The header logo was hardcoded to always render DEFAULT_LOGO_SRC
     and never looked at `matchSetup.tournamentLogoUrl` at all — so
     a logo uploaded/pushed in Match Setup never showed up here. It
     now prefers `matchSetup.tournamentLogoUrl`, falling back to the
     league placeholder only when that's unset or fails to load.
     `logoFailed` is reset whenever the tournament logo URL itself
     changes, so a stale failure doesn't stick around after a valid
     logo is pushed.
   ───────────────────────────────────────────────────────────── */

const GOLD_GRADIENT = "linear-gradient(135deg,#A87815,#E8C468)";
const PARTICLE_COLORS_BOUNDARY = ["#E8C468", "#A87815", "#FDECC8", "#ffffff"];
const PARTICLE_COLORS_WICKET = ["#718096", "#A0AEC0", "#CBD5E0", "#E2E8F0"];
const DEFAULT_LOGO_SRC = "/valiant-league-logo.png";

const BOUNDARY_CHANNELS = [
  { key: "matchBoundaries", label: "Match Boundaries" },
  { key: "tournamentBoundaries", label: "Tournament Boundaries" },
] as const;

// Human-readable labels for extras, keyed by the same short codes
// used everywhere else (extras state, ballOutcome, record()).
const EXTRA_LABELS: Record<"Wd" | "Nb" | "By" | "Lb", string> = { Wd: "Wide", Nb: "No Ball", By: "Bye", Lb: "Leg Bye" };

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
function TogglePill({
  label,
  on,
  onClick,
  dotColor,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  dotColor: string;
}) {
  return (
    <button
      type="button"
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

interface Batter {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
}
interface Bowler {
  name: string;
  overs: number;
  balls: number;
  runs: number;
  wickets: number;
}

function BatterPickerButton({
  batter,
  label,
  selected,
  onClick,
}: {
  batter: Batter;
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

const emptyBatter = (): Batter => ({ name: "", runs: 0, balls: 0, fours: 0, sixes: 0 });
const emptyBowler = (): Bowler => ({ name: "", overs: 0, balls: 0, runs: 0, wickets: 0 });

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

export default function OverlayAdminConsole({
  auctionId = null,
  matchId = null,
}: {
  /** The auction whose sold-players roster backs the Match Setup team pickers. */
  auctionId?: string | null;
  /** Used to build the "Match Editor" link inside the Match Setup roster panel, and to load/save the shared matches.match_setup row. */
  matchId?: string | null;
} = {}) {
  /* ── On Air channel toggles ── */
  const [alwaysOn, setAlwaysOn] = useState({ weather: true, liveScoreBar: true, tournamentLogo: true });
  const [fullScreen, setFullScreen] = useState({ pointsTable: false, matchScorecard: false, matchIntro: false });
  const [boundaryChannels, setBoundaryChannels] = useState({ matchBoundaries: false, tournamentBoundaries: false });

  /* ── Match Setup ──
     Real MatchSetup/TeamInfo shape (from @/lib/overlayBus). MatchSetupPanel
     owns the editing UI and its own locked/editing toggle; this page just
     holds the state and reacts to onPush / onEditingChange. */
  const [matchSetup, setMatchSetup] = useState<MatchSetup>(defaultMatchSetup());
  const [matchSetupEditing, setMatchSetupEditing] = useState(false);
  const [matchSetupCompleted, setMatchSetupCompleted] = useState(false);

  // Last-loaded/saved raw `matches.match_setup` row, in the DB's own
  // shape (team1/team2/squads/...). Used purely so overlaySetupToDbPatch
  // can carry forward fields the overlay UI has no controls for —
  // date, round, officials, overs, matchMeta, rosterLocked, and each
  // squad's captain/role/XI — instead of blanking them on every push.
  const dbSetupRef = useRef<DbMatchSetupRow | null>(null);

  // ── Load the shared match_setup row on mount ──
  // Previously `matchSetup` was purely local/ephemeral here — a match
  // set up in the Match Editor page was invisible in this console, and
  // vice versa. This hydrates from the same row the Editor reads/writes,
  // via the adapter in lib/matchSetupAdapter.ts (see the MATCH SETUP ↔
  // DB CONSISTENCY note near the top of this file).
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

  // Flat legacy view of matchSetup for the pre-existing display logic below
  // (header, aside labels, ScoringSection, moment strings) that was built
  // against the older `{ teamA: "JSH", teamAColor, ... }` shape. Derived
  // from the single real `matchSetup` state so there's one source of truth.
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

  // Pushes to the overlay bus (unchanged, local/log-based) AND now also
  // persists to the same `matches.match_setup` row the Match Editor
  // reads/writes, via patch_match_setup's shallow top-level merge — so
  // fields this console doesn't manage are left exactly as the Editor
  // last set them. Failure to save is reported but doesn't undo the
  // overlay push, since the live graphics update is the more
  // time-sensitive half of this action.
  async function handleMatchSetupPush() {
    pushLog(`Match Setup pushed — ${legacyMatchSetup.teamA} vs ${legacyMatchSetup.teamB}, ${matchSetup.venue}`);
    fireToast("Match Setup pushed to overlay");
    setMatchSetupCompleted(true);

    if (!matchId) return; // no DB row to persist to — overlay-only / preview mode

    const patch = overlaySetupToDbPatch(matchSetup, dbSetupRef.current);
    const { error: patchErr } = await supabase.rpc("patch_match_setup", { p_match_id: matchId, p_patch: patch });
    if (patchErr) {
      console.error("[OverlayAdminConsole] failed to save match setup to DB:", patchErr.message);
      fireToast("Pushed to overlay, but saving to the match record failed — check console");
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
  }

  /* ── Which side is currently at the crease ── */
  const [battingTeam, setBattingTeam] = useState<"teamA" | "teamB">("teamA");
  const bowlingTeam = battingTeam === "teamA" ? "teamB" : "teamA";

  /* ── Live scoring state ── */
  const [striker, setStriker] = useState<Batter>(emptyBatter());
  const [nonStriker, setNonStriker] = useState<Batter>(emptyBatter());
  const [bowler, setBowler] = useState<Bowler>(emptyBowler());
  const [wkts, setWkts] = useState(0);
  const [legalBalls, setLegalBalls] = useState(0);
  const [freeHit, setFreeHit] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [partnership, setPartnership] = useState({ runs: 0, balls: 0 });
  const [matchBoundaries, setMatchBoundaries] = useState({ fours: 0, sixes: 0 });
  const [extras, setExtras] = useState<Record<"Wd" | "Nb" | "By" | "Lb", number>>({ Wd: 0, Nb: 0, By: 0, Lb: 0 });
  const [teamRuns, setTeamRuns] = useState(0);
  const [livePushed, setLivePushed] = useState(false);
  const [liveDirty, setLiveDirty] = useState(false);

  /* ── This-over ball-by-ball strip, e.g. [0, 4, "Wd", "W", 1] ──
     Cleared at the start of a new over, and on innings/match reset.
     This drives ScoringSection's "This Over" strip — it previously
     had nothing feeding it and always showed empty placeholders.

     IMPORTANT: this array can legitimately hold MORE than 6 entries
     mid-over, because "Wd"/"Nb" extras are appended here but don't
     count toward the 6 legal deliveries that end an over. It only
     gets cleared once 6 legal deliveries have actually been bowled
     — see the legalCount check inside record() below. */
  const [overBalls, setOverBalls] = useState<(number | string)[]>([]);

  /* ── who's out this innings, and which slot is "active" for picking ── */
  const [dismissedPlayers, setDismissedPlayers] = useState<Set<string>>(() => new Set());
  const [activeSlot, setActiveSlot] = useState<"striker" | "nonStriker" | "bowler">("striker");
  const [playerPicker, setPlayerPicker] = useState<null | "striker" | "nonStriker" | "bowler">(null);
  useIsMobile();

  // Header logo failure flag. Reset whenever the tournament logo URL
  // itself changes — see the TOURNAMENT LOGO FIX note near the top of
  // this file — so a stale failure from a previous (or missing) logo
  // doesn't keep the fallback icon stuck after a valid one is pushed.
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    setLogoFailed(false);
  }, [matchSetup.tournamentLogoUrl]);

  /* ── Mobile-only bottom-nav tabs: Scoring / Overlay / Setup. ── */
  const [mobileTab, setMobileTab] = useState<"overlay" | "scoring" | "setup">("scoring");

  /* ── Innings / target tracking ── */
  const [inningsNumber, setInningsNumber] = useState(1);
  const [firstInnings, setFirstInnings] = useState<{ runs: number; wkts: number; overs: string; team: string } | null>(null);

  const rosterTeamAFallback = [
    "Ravindu Bandara",
    "Chamika Silva",
    "Isuru Weerasekara",
    "Nadun Karunaratne",
    "Lakindu Peris",
    "Tharindu Costa",
    "Ashen Gunaratne",
    "Binura Jayasuriya",
  ];
  const rosterTeamBFallback = [
    "Hasitha Perera",
    "Niroshan Jay",
    "Kavindu Silva",
    "Danushka Mendis",
    "Sahan Fernando",
    "Kaveen Mendis",
    "Yohan Raj",
    "Kusal Fernando",
  ];
  // Prefer the real squad picked in Match Setup once it has players;
  // fall back to placeholder rosters so scoring stays usable before
  // a squad's been assembled.
  const rosterTeamA = matchSetup.teamA.squad?.length ? matchSetup.teamA.squad : rosterTeamAFallback;
  const rosterTeamB = matchSetup.teamB.squad?.length ? matchSetup.teamB.squad : rosterTeamBFallback;
  const battingRoster = battingTeam === "teamA" ? rosterTeamA : rosterTeamB;
  const bowlingRoster = bowlingTeam === "teamA" ? rosterTeamA : rosterTeamB;

  const battingRoleMap = (() => {
    const m = new Map<string, { role: string }>();
    if (striker.name) m.set(striker.name, { role: "striker" });
    if (nonStriker.name) m.set(nonStriker.name, { role: "nonStriker" });
    return m;
  })();
  const bowlingRoleMap = (() => {
    const m = new Map<string, { role: string }>();
    if (bowler.name) m.set(bowler.name, { role: "bowler" });
    return m;
  })();

  function assignBatter(slot: "striker" | "nonStriker", name: string) {
    if (dismissedPlayers.has(name)) return;
    const blocked = slot === "striker" ? nonStriker.name : striker.name;
    if (name === blocked) return;
    const fresh = { ...emptyBatter(), name };
    if (slot === "striker") setStriker(fresh);
    else setNonStriker(fresh);
    pushLog(`${slot === "striker" ? "Striker" : "Non-Striker"} set — ${name}`);
  }
  function assignBowler(name: string) {
    setBowler((b) => (b.name === name ? emptyBowler() : { ...emptyBowler(), name }));
    pushLog(`Bowler set — ${name}`);
  }

  // The left rail is the *only* pick/drop list on desktop — it swaps
  // between the batting squad and the bowling squad depending on which
  // crew slot is currently active.
  const isBattingSlotActive = activeSlot === "striker" || activeSlot === "nonStriker";
  const asideTeamKey: "teamA" | "teamB" = isBattingSlotActive ? battingTeam : bowlingTeam;
  const asideRoster = isBattingSlotActive ? battingRoster : bowlingRoster;
  const asideDismissed = isBattingSlotActive ? dismissedPlayers : undefined;
  const asideRoleMap = isBattingSlotActive ? battingRoleMap : bowlingRoleMap;
  function assignFromAsideList(name: string) {
    if (isBattingSlotActive) assignBatter(activeSlot as "striker" | "nonStriker", name);
    else assignBowler(name);
  }

  /* ── Moments panel ── */
  const [showMoments, setShowMoments] = useState(true);
  const [showWicketForm, setShowWicketForm] = useState(false);
  const [wicketDraft, setWicketDraft] = useState({ batsmanOut: "striker" as "striker" | "nonStriker", dismissalType: "bowled", fielder: "" });
  const [milestoneBatter, setMilestoneBatter] = useState<"striker" | "nonStriker">("striker");
  const [showMatchWonForm, setShowMatchWonForm] = useState(false);
  const [matchWonDraft, setMatchWonDraft] = useState({
    winner: "teamA" as "teamA" | "teamB" | "custom",
    customName: "",
    margin: "",
    method: "batting",
  });

  /* ── Weather ── */
  const [weather, setWeather] = useState({ venue: "GALLE FORT", temp: 28, condition: "partly-cloudy" });
  const [weatherEditing, setWeatherEditing] = useState(false);

  /* ── Event feed — bottom-right stacked cards ── */
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

  const overs = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
  const oversLimit = matchSetup.format === "T20" ? 20 : matchSetup.format === "ODI" ? 50 : null;
  const rr = legalBalls > 0 ? (teamRuns / (legalBalls / 6)).toFixed(2) : "0.00";

  const target = firstInnings ? firstInnings.runs + 1 : null;
  const runsNeeded = target !== null ? Math.max(target - teamRuns, 0) : null;
  const ballsLeft = oversLimit !== null ? Math.max(oversLimit * 6 - legalBalls, 0) : null;
  const requiredRate = target !== null && ballsLeft ? (runsNeeded! / (ballsLeft / 6)).toFixed(2) : null;

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

  /* ── push actions (simulated overlay bus) ── */
  function pushLiveState() {
    setLivePushed(true);
    setLiveDirty(false);
    pushLog("Live State pushed to overlay");
    setTimeout(() => setLivePushed(false), 1500);
  }

  /* ── scoring ──
     record() is the ONLY place that mutates teamRuns/wkts/legalBalls/etc.
     `runsAdded` must always be a number. `extra`, when present, must be
     one of the short codes "Wd" | "Nb" | "Lb" | "By" — matching the keys
     in `extras` state and ScoringSection's ballOutcome(). */
  function snapshot() {
    return { striker, nonStriker, bowler, wkts, legalBalls, partnership, matchBoundaries, extras, teamRuns, overBalls };
  }

  function record(runsAdded: number, { wicket = false, extra = null as null | "Wd" | "Nb" | "By" | "Lb" } = {}) {
    setHistory((h) => [...h, snapshot()]);
    const isLegal = !["Wd", "Nb"].includes(extra as string);

    setStriker((s) => ({
      ...s,
      runs: s.runs + (extra ? 0 : runsAdded),
      balls: s.balls + (isLegal ? 1 : 0),
      fours: runsAdded === 4 && !extra ? s.fours + 1 : s.fours,
      sixes: runsAdded === 6 && !extra ? s.sixes + 1 : s.sixes,
    }));
    if (wicket) setWkts((w) => w + 1);
    if (isLegal) setLegalBalls((b) => b + 1);
    setTeamRuns((r) => r + runsAdded);
    setPartnership((p) => (wicket ? { runs: 0, balls: 0 } : { runs: p.runs + runsAdded, balls: p.balls + (isLegal ? 1 : 0) }));
    if (extra) setExtras((ex) => ({ ...ex, [extra]: ex[extra] + 1 }));
    if (runsAdded === 4 && !extra) setMatchBoundaries((m) => ({ ...m, fours: m.fours + 1 }));
    if (runsAdded === 6 && !extra) setMatchBoundaries((m) => ({ ...m, sixes: m.sixes + 1 }));
    setBowler((f) => {
      const balls = f.balls + (isLegal ? 1 : 0);
      return { ...f, overs: Math.floor(balls / 6), balls: balls % 6, runs: f.runs + runsAdded, wickets: f.wickets + (wicket ? 1 : 0) };
    });
    setLiveDirty(true);

    // This-over strip: entry is "W" for a wicket, the extra code, or the
    // numeric runs off the bat.
    //
    // Reset rule: only clear the strip when a LEGAL ball arrives AND the
    // strip already contains 6 legal deliveries. We deliberately do NOT
    // use the raw array length here — Wd/Nb entries inflate the array
    // without being legal deliveries, so counting raw length caused the
    // strip to reset a delivery early (and silently drop whatever ball
    // was tapped right at the reset boundary, plus everything before it).
    const entry: number | string = wicket ? "W" : extra ? extra : runsAdded;
    setOverBalls((prev) => {
      const legalCount = prev.filter((e) => e !== "Wd" && e !== "Nb").length;
      const base = isLegal && legalCount >= 6 ? [] : prev;
      return [...base, entry];
    });

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
      pushLog(`Ball — ${extra ? EXTRA_LABELS[extra] : runsAdded === 0 ? "Dot ball" : `${runsAdded} run${runsAdded === 1 ? "" : "s"}`}`);
    }
    const newRuns = striker.runs + (extra ? 0 : runsAdded);
    if (!extra && !wicket && (newRuns === 50 || newRuns === 100)) {
      fireMilestoneMoment(newRuns === 50 ? "fifty" : "hundred", "striker");
    }
    setFreeHit(false);
  }

  // Run-pad buttons (0/1/2/3/4/6) — ONLY ever called with a number.
  function handleRun(n: number) {
    return record(n);
  }
  // Extras — Wide / No Ball / Leg Bye / Bye. Awards 1 run of the given
  // extra type. (Runs taken off a wide/no-ball beyond the automatic 1
  // aren't modeled here — extend this if you need that.)
  function onExtra(code: "Wd" | "Nb" | "By" | "Lb") {
    return record(1, { extra: code });
  }
  function handleOut() {
    if (freeHit) return;
    record(0, { wicket: true });
  }
  function onFreeHit() {
    setFreeHit(true);
    pushLog("Free Hit armed for next ball");
    fireToast("Free Hit armed");
  }
  // Low-frequency admin events with no dedicated game-state model yet —
  // logged to the event feed. Wire these up to real state if/when the
  // product defines what Bonus/Injured/Abandon should actually do.
  function onAdminAction(label: string) {
    pushLog(`Admin — ${label}`);
    fireToast(label);
  }

  function handleUndo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setStriker(prev.striker);
    setNonStriker(prev.nonStriker);
    setBowler(prev.bowler);
    setWkts(prev.wkts);
    setLegalBalls(prev.legalBalls);
    setPartnership(prev.partnership);
    setMatchBoundaries(prev.matchBoundaries);
    setExtras(prev.extras);
    setTeamRuns(prev.teamRuns);
    setOverBalls(prev.overBalls ?? []);
    setHistory((h) => h.slice(0, -1));
    fireToast("Last ball undone");
  }
  function handleClear() {
    setStriker(emptyBatter());
    setNonStriker(emptyBatter());
    setBowler(emptyBowler());
    setWkts(0);
    setLegalBalls(0);
    setHistory([]);
    setPartnership({ runs: 0, balls: 0 });
    setMatchBoundaries({ fours: 0, sixes: 0 });
    setExtras({ Wd: 0, Nb: 0, By: 0, Lb: 0 });
    setTeamRuns(0);
    setOverBalls([]);
    setInningsNumber(1);
    setFirstInnings(null);
    setBattingTeam("teamA");
    setFreeHit(false);
    setShowClearConfirm(false);
    setDismissedPlayers(new Set());
    setActiveSlot("striker");
    setPlayerPicker(null);
    pushLog("Innings cleared / match restarted");
    fireToast("Innings cleared");
  }
  function endInnings() {
    setFirstInnings({ runs: teamRuns, wkts, overs, team: legacyMatchSetup[battingTeam] });
    pushLog(`Innings break — ${legacyMatchSetup[battingTeam]} finished ${teamRuns}/${wkts} (${overs} ov)`);
    fireToast(`${legacyMatchSetup[battingTeam]} innings closed at ${teamRuns}/${wkts}`);
    setBattingTeam((t) => (t === "teamA" ? "teamB" : "teamA"));
    setStriker(emptyBatter());
    setNonStriker(emptyBatter());
    setBowler(emptyBowler());
    setWkts(0);
    setLegalBalls(0);
    setHistory([]);
    setPartnership({ runs: 0, balls: 0 });
    setExtras({ Wd: 0, Nb: 0, By: 0, Lb: 0 });
    setTeamRuns(0);
    setOverBalls([]);
    setInningsNumber(2);
    setDismissedPlayers(new Set());
    setActiveSlot("striker");
    setPlayerPicker(null);
  }

  /* ── Moments: manual fires ── */
  function fireBoundaryMoment(kind: string) {
    fireStamp("boundary", kind.toUpperCase());
    spawnParticles(PARTICLE_COLORS_BOUNDARY);
    pushLog(`Moment: ${kind.toUpperCase()} (manual) — ${striker.name || "Striker"} ${striker.runs}(${striker.balls})`);
  }
  function fireMilestoneMoment(kind: "fifty" | "hundred", who: "striker" | "nonStriker" = milestoneBatter) {
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
    pushLog(
      `Moment: WICKET — ${batter.name || "Batter"} ${wicketDraft.dismissalType}${bowler.name ? ` b ${bowler.name}` : ""}${
        wicketDraft.fielder ? ` c ${wicketDraft.fielder}` : ""
      }`
    );
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
    const name =
      matchWonDraft.winner === "teamA"
        ? legacyMatchSetup.teamA
        : matchWonDraft.winner === "teamB"
        ? legacyMatchSetup.teamB
        : matchWonDraft.customName || "Winner";
    const margin = matchWonDraft.margin || "Match Won";
    fireStamp("boundary", "WON");
    spawnParticles(PARTICLE_COLORS_BOUNDARY);
    pushLog(`Moment: MATCH WON — ${name} ${margin}`);
    setShowMatchWonForm(false);
  }

  const statCards: { label: string; value: string }[] = [
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
            <span style={{ color: legacyMatchSetup.teamAColor }}>{legacyMatchSetup.teamA}</span> vs{" "}
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

      {/* ── On Air channels — desktop only; mobile gets a purpose-built card
           inside the Overlay tab. ── */}
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
        <aside className="order-2 lg:order-1 hidden lg:flex lg:flex-col lg:h-full bg-surface-container-lowest border-t lg:border-t-0 lg:border-r border-outline-variant shrink-0 lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-4 px-4 gap-4">
          <div className="hidden lg:flex lg:flex-1 lg:min-h-0 flex-col lg:overflow-hidden">
            <div className="flex items-center justify-between mb-1 shrink-0 gap-2 flex-wrap">
              <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.18em] font-bold">
                Pick From {legacyMatchSetup[asideTeamKey]}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                <TogglePill label={legacyMatchSetup.teamA} on={battingTeam === "teamA"} dotColor="#c9971f" onClick={() => setBattingTeam("teamA")} />
                <TogglePill label={legacyMatchSetup.teamB} on={battingTeam === "teamB"} dotColor="#c9971f" onClick={() => setBattingTeam("teamB")} />
              </div>
            </div>

            <div className="flex items-center justify-between mb-3 shrink-0 gap-2">
              <span className="font-mono-geist text-[9px] text-on-surface-variant shrink-0">{asideRoster.length} players</span>
            </div>

            <div className="max-h-72 lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-2">
              {asideRoster.map((name) => {
                const isOut = !!asideDismissed?.has(name);
                const roleInfo = asideRoleMap.get(name);
                const isLocked = isOut || !!roleInfo;
                const roleLabel =
                  roleInfo?.role === "striker" ? "On Strike" : roleInfo?.role === "nonStriker" ? "Non-Striker" : roleInfo?.role === "bowler" ? "Bowling" : undefined;

                return (
                  <button
                    type="button"
                    key={name}
                    draggable={!isLocked}
                    disabled={isLocked}
                    onDragStart={(e) => {
                      if (isLocked) {
                        e.preventDefault();
                        return;
                      }
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
                    <span
                      className="h-9 w-9 rounded-full flex items-center justify-center font-mono-geist text-[11px] font-bold shrink-0"
                      style={{ border: "1px solid rgba(255,255,255,0.15)", color: isOut ? "#f87171" : roleInfo ? "#4ade80" : "#e5e7eb" }}
                    >
                      {initials(name)}
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="font-archivo text-sm font-bold truncate" style={{ color: isOut ? "#f87171" : roleInfo ? "#4ade80" : "var(--color-on-surface)" }}>
                        {name}
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

        {/* ══════════ CENTER: Live State scorer (default on mobile) ══════════ */}
        <ScoringSection
          mobileTab={mobileTab}
          teamRuns={teamRuns}
          wkts={wkts}
          overs={overs}
          rr={rr}
          matchSetup={legacyMatchSetup}
          battingTeam={battingTeam}
          inningsNumber={inningsNumber}
          target={target}
          runsNeeded={runsNeeded}
          ballsLeft={ballsLeft}
          requiredRate={requiredRate}
          stamp={stamp}
          striker={striker}
          nonStriker={nonStriker}
          bowler={bowler}
          setStriker={setStriker}
          setNonStriker={setNonStriker}
          activeSlot={activeSlot}
          setActiveSlot={setActiveSlot}
          playerPicker={playerPicker}
          setPlayerPicker={setPlayerPicker}
          dismissedPlayers={dismissedPlayers}
          battingRoster={battingRoster}
          bowlingRoster={bowlingRoster}
          bowlingTeam={bowlingTeam}
          assignBatter={assignBatter}
          assignBowler={assignBowler}
          freeHit={freeHit}
          extras={extras}
          handleRun={handleRun}
          onExtra={onExtra}
          onFreeHit={onFreeHit}
          onAdminAction={onAdminAction}
          handleOut={handleOut}
          onUndo={handleUndo}
          endInnings={endInnings}
          pushLiveState={pushLiveState}
          livePushed={livePushed}
          liveDirty={liveDirty}
          statCards={statCards}
          battingRoleMap={battingRoleMap}
          bowlingRoleMap={bowlingRoleMap}
          currentOverBalls={overBalls}
        />

        {/* ══════════ RIGHT: Match Setup + Moments + Weather (3rd on mobile) ══════════ */}
        <aside className="order-3 border-l border-outline-variant flex mb-0 flex-col min-h-0 lg:h-full shrink-0 lg:overflow-y-auto custom-scrollbar gap-4">            
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

          {/* Broadcast Channels — mobile-only replacement for the desktop sticky pill bar. */}
          <div className={`p-4 shrink-0 lg:hidden flex-col gap-2.5 ${mobileTab === "overlay" ? "flex" : "hidden"}`}>
            <div>
              <h3 className="font-archivo text-sm font-bold italic uppercase mb-0.5">Broadcast Channels</h3>
              <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.06em] leading-tight">Toggle what's live on the overlay.</p>
            </div>

            <div>
              <span className="font-mono-geist text-[8px] font-bold uppercase tracking-[0.16em] text-theme-orange">On Air</span>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                <MobileChannelRow icon="partly_cloudy_day" label="Weather" on={alwaysOn.weather} dotColor="#22c55e" onClick={() => setAlwaysOn((a) => ({ ...a, weather: !a.weather }))} />
                <MobileChannelRow icon="scoreboard" label="Live Score Bar" on={alwaysOn.liveScoreBar} dotColor="#22c55e" onClick={() => setAlwaysOn((a) => ({ ...a, liveScoreBar: !a.liveScoreBar }))} />
                <MobileChannelRow icon="military_tech" label="Tournament Logo" on={alwaysOn.tournamentLogo} dotColor="#22c55e" onClick={() => setAlwaysOn((a) => ({ ...a, tournamentLogo: !a.tournamentLogo }))} />
              </div>
            </div>

            <div>
              <span className="font-mono-geist text-[8px] font-bold uppercase tracking-[0.16em] text-theme-orange">Full-Screen</span>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                <MobileChannelRow icon="leaderboard" label="Points Table" on={fullScreen.pointsTable} dotColor="#c9971f" onClick={() => setFullScreen((f) => ({ ...f, pointsTable: !f.pointsTable }))} />
                <MobileChannelRow icon="receipt_long" label="Match Scorecard" on={fullScreen.matchScorecard} dotColor="#c9971f" onClick={() => setFullScreen((f) => ({ ...f, matchScorecard: !f.matchScorecard }))} />
                <MobileChannelRow icon="theaters" label="Match Intro" on={fullScreen.matchIntro} dotColor="#c9971f" onClick={() => setFullScreen((f) => ({ ...f, matchIntro: !f.matchIntro }))} />
              </div>
            </div>

            <div>
              <span className="font-mono-geist text-[8px] font-bold uppercase tracking-[0.16em] text-theme-orange">Moments</span>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                <MobileChannelRow icon="stadium" label="Match Boundaries" on={boundaryChannels.matchBoundaries} dotColor="#e8c468" onClick={() => setBoundaryChannels((b) => ({ ...b, matchBoundaries: !b.matchBoundaries }))} />
                <MobileChannelRow icon="emoji_events" label="Tournament Boundaries" on={boundaryChannels.tournamentBoundaries} dotColor="#e8c468" onClick={() => setBoundaryChannels((b) => ({ ...b, tournamentBoundaries: !b.tournamentBoundaries }))} />
              </div>
            </div>
          </div>

          {/* Moments — hidden on desktop while Match Setup is being edited,
             so the setup card can take over the whole right column. */}
          <div className={`px-4 shrink-0 flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden ${mobileTab === "overlay" ? "flex" : "hidden"} ${matchSetupEditing ? "lg:hidden" : "lg:flex"}`}>
            <button type="button" onClick={() => setShowMoments((v) => !v)} className="w-full flex items-center justify-between gap-3 mb-1 shrink-0">
              <h3 className="font-archivo text-base font-bold italic uppercase">Moments</h3>
            </button>
            {showMoments && (
              <div className="flex flex-col gap-3 lg:overflow-y-auto custom-scrollbar lg:min-h-0">
                <div className="grid grid-cols-3 gap-2.5">
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
                    <span className="font-mono-geist text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#f87171" }}>
                      Wicket Detail
                    </span>
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono-geist text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Batsman Out</span>
                      <div className="grid grid-cols-2 gap-2">
                        <BatterPickerButton batter={striker} label="Striker" selected={wicketDraft.batsmanOut === "striker"} onClick={() => setWicketDraft((p) => ({ ...p, batsmanOut: "striker" }))} />
                        <BatterPickerButton batter={nonStriker} label="Non-Striker" selected={wicketDraft.batsmanOut === "nonStriker"} onClick={() => setWicketDraft((p) => ({ ...p, batsmanOut: "nonStriker" }))} />
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
                    <p className="font-mono-geist text-[10px] text-on-surface-variant">Bowler from Live State: {bowler.name || "—"}</p>
                    <button
                      type="button"
                      onClick={fireWicketMoment}
                      className="w-full py-2.5 rounded-full font-mono-geist text-[11px] font-black uppercase tracking-wide"
                      style={{ background: "#ef4444", color: "#fff" }}
                    >
                      Fire Wicket
                    </button>
                  </div>
                )}

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
            <div className={`px-4 lg:mb-4 shrink-0 ${mobileTab === "overlay" ? "block" : "hidden"} lg:block`}>
            <WeatherPanel
                weather={weather}
                setWeather={setWeather}
                weatherEditing={weatherEditing}
                setWeatherEditing={setWeatherEditing}
                pushLog={pushLog}
                fireToast={fireToast}
                mobileTab={mobileTab}
                desktopVisible={!matchSetupEditing}
            />
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
                  {teamRuns}/{wkts}
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
                onClick={handleClear}
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