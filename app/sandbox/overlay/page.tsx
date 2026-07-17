// File: app/sandbox/overlay/page.tsx
//
// Cricket overlay sandbox — restyled to match the broadcast-console feel
// of the other two sandboxes (app/sandbox/brackets/page.tsx and the
// auction multiview sandbox): pulsing on-air badge, console header with
// a live score readout, a pill-based control deck, ambient scanline
// texture, and a floating chyron for on-air moments instead of a plain
// scrolling log. Same local-atom pattern (ControlCluster / Pill /
// ActionButton) those two define for themselves rather than reusing the
// old admin/ui Section/StatusPill card look, so all three sandboxes read
// as one product.
//
// Still one component, no BroadcastChannel, no separate /preview route
// (deleted — see the other two sandboxes' own admin-overlay patterns for
// why a second navigable URL is worth avoiding).
//
// View switching: "Flip to Live" swaps the whole page into the actual
// broadcast surface (video backdrop + the real portaled overlay
// components); "Back to Controls" swaps back. On top of that, firing an
// on-air moment (four/six/wicket/fifty/hundred/maiden/matchWon) now
// auto-flips to Live so the celebration plays on the real broadcast
// surface, then auto-reverts back to Controls once it would have
// finished (see MOMENT_AUTO_REVERT_MS) — this replaces an earlier
// version that kept MatchMomentOverlay mounted in both views, which just
// stacked the celebration graphic on top of the admin UI instead of
// showing it where it actually belongs. Any manual flip (the header
// button, or "Back to Controls") cancels a pending auto-revert so it can
// never yank the view out from under someone already navigating by hand.

"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DismissalType } from "@/hooks/useLiveScoringEngine";
import type { MomentPayload } from "@/lib/overlayBus";

import LiveStatePanel from "@/components/overlays/admin/LiveStatePanel";

import WeatherCard from "@/components/overlays/WeatherCard";
import MatchBoundaries from "@/components/overlays/MatchBoundaries";
import TournamentBoundaries from "@/components/overlays/TournamentBoundaries";
import LiveScoreBar from "@/components/overlays/LiveScoreBar";
import CricketMatchIntro from "@/components/overlays/CricketMatchIntro";
import MatchMomentOverlay from "@/components/overlays/MatchMomentOverlay";
import TournamentLogoDisplay from "@/components/overlays/TournamentLogoDisplay";
import CricketScorecard from "@/components/overlays/CricketScorecard";

import { HARDCODED_MATCH_SETUP, emptyLiveState, defaultWeather, emptyBatter, emptyBowler } from "./lib/sandboxData";

import { MonitorPlay, LayoutPanelLeft, CloudSun, RotateCcw, Zap, Target, Trophy, ShieldCheck, PartyPopper } from "lucide-react";

// ── Local channel-visibility shape ──────────────────────────────────
export interface SandboxChannels {
  weather: boolean;
  liveScoreBar: boolean;
  matchBoundaries: boolean;
  tournamentBoundaries: boolean;
  matchIntro: boolean;
  tournamentLogo: boolean;
  matchScorecard: boolean;
}

const DEFAULT_CHANNELS: SandboxChannels = {
  weather: false,
  liveScoreBar: true,
  matchBoundaries: false,
  tournamentBoundaries: false,
  matchIntro: false,
  tournamentLogo: false,
  matchScorecard: false,
};

const CHANNEL_LABELS: Record<keyof SandboxChannels, string> = {
  weather: "Weather",
  liveScoreBar: "Score Bar",
  matchBoundaries: "Match 4s/6s",
  tournamentBoundaries: "Tourn. 4s/6s",
  matchIntro: "Match Intro",
  tournamentLogo: "Tournament Logo",
  matchScorecard: "Scorecard",
};

const FONT_BODY = "var(--font-body, 'Inter', ui-sans-serif, system-ui, sans-serif)";

type ViewMode = "control" | "live";

// How long to hold on the Live view after a moment fires before auto-
// reverting to Controls — roughly matched to how long each celebration
// actually plays for. matchWon gets the longest hold since it's the
// most consequential graphic; everything else is a quick beat.
const MOMENT_AUTO_REVERT_MS: Record<MomentPayload["moment"], number> = {
  four: 3200,
  six: 3200,
  wicket: 4200,
  fifty: 4500,
  hundred: 4500,
  maiden: 3200,
  matchWon: 6000,
};

// Same fade-out-before-unmount helper the real overlay display page uses.
function useOverlayVisibility(show: boolean, exitMs: number) {
  const [mounted, setMounted] = useState(show);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (show) {
      if (timer.current) clearTimeout(timer.current);
      setClosing(false);
      setMounted(true);
    } else if (mounted) {
      setClosing(true);
      timer.current = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, exitMs);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  return { mounted, closing };
}

/* ------------------------------------------------------------------ */
/*  Local console atoms — same family as brackets/page.tsx's           */
/*  ControlCluster/Pill/ActionButton, so both sandboxes read as one    */
/*  product instead of two different UI kits.                          */
/* ------------------------------------------------------------------ */

function ControlCluster({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[9px] font-semibold uppercase"
        style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.13em", color: "var(--color-outline)" }}
      >
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase whitespace-nowrap transition-colors"
      style={{
        fontFamily: "var(--font-label-mono)",
        letterSpacing: "0.09em",
        background: active ? "color-mix(in srgb, var(--color-theme-orange) 16%, transparent)" : "rgba(255,255,255,0.03)",
        boxShadow: active
          ? "inset 0 0 0 1px color-mix(in srgb, var(--color-theme-orange) 50%, transparent)"
          : "inset 0 0 0 1px var(--color-border-overlay)",
        color: active ? "var(--color-theme-orange)" : "var(--color-outline)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ConsoleActionButton({
  onClick,
  disabled,
  solid,
  icon,
  children,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  solid?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        fontFamily: "var(--font-label-mono)",
        letterSpacing: "0.08em",
        background: solid ? "linear-gradient(135deg,#A87815,#E8C468)" : "rgba(255,255,255,0.03)",
        boxShadow: solid ? "none" : "inset 0 0 0 1px var(--color-border-overlay)",
        color: solid ? "#1a1304" : "var(--color-on-surface)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

// ── Moment chyron — floating, non-blocking, keyed to replay its entrance
// on every new moment. Same visual family as the auction sandbox's
// CommentaryOverlay / the brackets sandbox's ChampionChyron: left accent
// rule doubling as the event's color key, mono event tag, italic
// headline text. Classified by moment type directly (not string-sniffed)
// since fireMoment already knows exactly what kind of event this is.
type FiredMoment = { id: number; moment: MomentPayload["moment"]; text: string };

const MOMENT_META: Record<MomentPayload["moment"], { accent: string; tag: string; icon: React.ReactNode }> = {
  four: { accent: "var(--color-theme-orange)", tag: "FOUR", icon: <Zap size={14} /> },
  six: { accent: "var(--color-theme-orange)", tag: "SIX", icon: <Zap size={14} /> },
  wicket: { accent: "#e5484d", tag: "WICKET", icon: <Target size={14} /> },
  fifty: { accent: "#4fd1c5", tag: "FIFTY", icon: <Trophy size={14} /> },
  hundred: { accent: "#4fd1c5", tag: "HUNDRED", icon: <Trophy size={14} /> },
  maiden: { accent: "#8b8bf5", tag: "MAIDEN", icon: <ShieldCheck size={14} /> },
  matchWon: { accent: "#3ddc84", tag: "MATCH WON", icon: <PartyPopper size={14} /> },
};

function MomentChyron({ fired }: { fired: FiredMoment | null }) {
  if (!fired) return null;
  const meta = MOMENT_META[fired.moment];
  return (
    <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center max-w-[560px] w-[92%]">
      <div
        key={fired.id}
        className="chyron-in flex items-stretch overflow-hidden rounded-[3px]"
        style={{
          background: "rgba(8,8,8,0.88)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 12px 30px -10px rgba(0,0,0,0.6)",
        }}
      >
        <span className="shrink-0" style={{ width: 3, background: meta.accent }} />
        <div className="flex items-center gap-3 pl-3.5 pr-4 py-2.5">
          <span style={{ color: meta.accent }}>{meta.icon}</span>
          <span
            className="shrink-0 text-[10px] uppercase font-semibold"
            style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.11em", color: meta.accent }}
          >
            {meta.tag}
          </span>
          <span className="w-px self-stretch bg-white/10" />
          <span
            className="text-[13px] leading-snug"
            style={{
              fontFamily: "var(--font-headline-lg)",
              fontStyle: "italic",
              fontWeight: 700,
              color: "var(--color-on-surface)",
            }}
          >
            {fired.text}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function OverlaySandboxPage() {
  const matchSetup = HARDCODED_MATCH_SETUP;

  const [view, setView] = useState<ViewMode>("control");

  const [liveState, setLiveState] = useState(emptyLiveState);
  const [liveDirty, setLiveDirty] = useState(false);
  const [pushed, setPushed] = useState(false);
  const [engineSyncState, setEngineSyncState] = useState<any>(null);

  const [weatherData, setWeatherData] = useState(defaultWeather);
  const [channels, setChannels] = useState<SandboxChannels>(DEFAULT_CHANNELS);
  const [log, setLog] = useState<string[]>([]);
  const [firedMoment, setFiredMoment] = useState<FiredMoment | null>(null);
  const momentIdRef = useRef(0);

  // Pending "auto-revert to Controls" timeout set by fireMoment. Any
  // manual view switch (the header's Flip/Back buttons) cancels this so
  // a leftover timer from an earlier moment can never yank the view back
  // out from under someone who's already navigating on their own.
  const autoRevertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearAutoRevert() {
    if (autoRevertTimerRef.current) {
      clearTimeout(autoRevertTimerRef.current);
      autoRevertTimerRef.current = null;
    }
  }

  function goLive() {
    clearAutoRevert();
    setView("live");
  }

  function backToControls() {
    clearAutoRevert();
    setView("control");
  }

  useEffect(() => clearAutoRevert, []);

  function logEvent(label: string) {
    setLog((prev) => [`${new Date().toLocaleTimeString("en-GB", { hour12: false })}  ${label}`, ...prev].slice(0, 14));
  }

  // Body background: normal app background in "control" view. In "live"
  // view the video backdrop covers the frame, so this is just a safe
  // fallback color while it buffers.
  useEffect(() => {
    document.body.style.background = view === "live" ? "#000" : "";
    return () => {
      document.body.style.background = "";
    };
  }, [view]);

  function fireMoment(payload: MomentPayload) {
    const text = `${payload.player ? payload.player : ""}${payload.score ? ` ${payload.score}` : ""}`.trim() || payload.moment;
    momentIdRef.current += 1;
    setFiredMoment({ id: momentIdRef.current, moment: payload.moment, text });
    logEvent(`Moment: ${payload.moment.toUpperCase()}${payload.player ? ` — ${payload.player}` : ""}`);

    // Auto-flip to Live so the celebration plays on the actual broadcast
    // surface instead of stacking on top of the admin UI, then auto-
    // revert back to Controls once it would have finished. A fresh
    // moment firing while already on Live (or while a previous auto-
    // revert is still pending) just resets the hold — clearAutoRevert()
    // inside goLive() handles that.
    goLive();
    (window as any).triggerBoundaryCelebration?.(payload.moment, payload);
    autoRevertTimerRef.current = setTimeout(() => {
      autoRevertTimerRef.current = null;
      setView("control");
    }, MOMENT_AUTO_REVERT_MS[payload.moment] ?? 3500);
  }

  function teamVisualsByName(name: string): { color?: string; logoUrl?: string } {
    if (matchSetup.teamA.name === name) return { color: matchSetup.teamA.color, logoUrl: matchSetup.teamA.logoUrl };
    if (matchSetup.teamB.name === name) return { color: matchSetup.teamB.color, logoUrl: matchSetup.teamB.logoUrl };
    return {};
  }

  function handleBoundary(moment: "four" | "six", batter: { name: string; runs: number; balls: number }) {
    fireMoment({ moment, player: batter.name || "Striker", score: `${batter.runs}(${batter.balls})` });
  }

  function handleMilestone(moment: "fifty" | "hundred", batter: { name: string; runs: number; balls: number; label?: string }) {
    fireMoment({ moment, player: batter.label ?? batter.name ?? "Batter", score: `${batter.runs}(${batter.balls})` });
  }

  function handleWicket(payload: {
    batsmanOut: "striker" | "nonStriker";
    batter: { name: string; runs: number; balls: number };
    dismissalType: DismissalType;
    fielder: string;
    bowlerName: string;
  }) {
    fireMoment({
      moment: "wicket",
      batsmanOut: payload.batsmanOut,
      player: payload.batter.name || (payload.batsmanOut === "striker" ? "Striker" : "Non-striker"),
      score: `${payload.batter.runs}(${payload.batter.balls})`,
      dismissalType: payload.dismissalType,
      bowler: payload.bowlerName,
      fielder: payload.fielder,
    });
  }

  function handleMaiden(payload: { bowlerName: string; maidens: number }) {
    fireMoment({ moment: "maiden", bowler: payload.bowlerName, maidens: payload.maidens });
  }

  function handleMatchWonAuto(payload: {
    winningTeamName: string;
    margin: string;
    method: "runs" | "wickets" | "tie";
    teamColor?: string;
    teamLogoUrl?: string;
  }) {
    const visuals = teamVisualsByName(payload.winningTeamName);
    fireMoment({
      moment: "matchWon",
      player: payload.winningTeamName,
      score: payload.margin,
      method: payload.method,
      teamColor: payload.teamColor ?? visuals.color,
      teamLogoUrl: payload.teamLogoUrl ?? visuals.logoUrl,
    });
  }

  function handleInningsEnd(payload: { target: number; previousInningsRuns: number; inningsNumber: 1 | 2 }) {
    logEvent(`Innings ended — target set to ${payload.target}`);
  }

  function handleMatchComplete(result: { winningTeamName: string; margin: string; method: "batting" | "bowling" | "tie" | "runs" | "wickets" }) {
    logEvent(`Match complete — ${result.winningTeamName} ${result.margin}`);
  }

  function restartMatch() {
    setLiveState((prev) => ({
      score: { runs: 0, wickets: 0, overs: 0, balls: 0 },
      striker: emptyBatter(),
      nonStriker: emptyBatter(),
      bowler: emptyBowler(),
      partnership: { runs: 0, balls: 0 },
      matchBoundaries: { fours: 0, sixes: 0 },
      tournamentBoundaries: prev.tournamentBoundaries,
      pointsTable: prev.pointsTable,
      target: undefined,
      inningsNumber: undefined,
      matchComplete: false,
      matchResult: undefined,
      thisOver: [],
    }));
    setLiveDirty(true);
    setEngineSyncState(null);
    logEvent("Match restarted — same teams & squads");
  }

  function handlePush() {
    setPushed(true);
    setLiveDirty(false);
    logEvent("Live State pushed");
    setTimeout(() => setPushed(false), 1200);
  }

  function pushWeather() {
    setChannels((prev) => ({ ...prev, weather: true }));
    logEvent(`Weather pushed — ${weatherData.venue}: ${weatherData.temp}°${weatherData.unit}, ${weatherData.condition}`);
  }

  function toggleChannel(key: keyof SandboxChannels) {
    setChannels((prev) => ({ ...prev, [key]: !prev[key] }));
    logEvent(`${CHANNEL_LABELS[key]} ${channels[key] ? "hidden" : "shown"}`);
  }

  const weatherVis = useOverlayVisibility(channels.weather, 280);
  const matchBoundariesVis = useOverlayVisibility(channels.matchBoundaries, 300);
  const tournamentBoundariesVis = useOverlayVisibility(channels.tournamentBoundaries, 300);

  // ── LIVE VIEW — the actual broadcast surface, same tab ──────────────
  if (view === "live") {
    return (
      <div className="fixed inset-0" style={{ background: "#000" }}>
        {/* Hardcoded backdrop — stands in for real match video so the
            overlays preview correctly against footage instead of empty
            space. muted+autoPlay+loop is required for autoplay without a
            user gesture; playsInline stops iOS forcing fullscreen. */}
        <video
          className="fixed inset-0 w-full h-full object-cover"
          src="/sample-match-footage.mp4"
          autoPlay
          loop
          muted
          playsInline
        />

        <button
          type="button"
          onClick={backToControls}
          className="fixed top-4 left-4 z-[9999] flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors hover:brightness-110"
          style={{
            fontFamily: "var(--font-label-mono)",
            background: "rgba(13,17,23,0.96)",
            border: "1px solid var(--color-border-overlay)",
            color: "var(--color-on-surface)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}
        >
          <LayoutPanelLeft className="w-3.5 h-3.5" />
          Back to Controls
        </button>

        {/* Small on-air style badge, top-right — same visual language as
            the console header's "Sandbox" pill, so it's unmistakable
            even here that this is the sandbox feed, not a real one. */}
        <div
          className="fixed top-4 right-4 z-[9999] flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-[3px]"
          style={{
            background: "color-mix(in srgb, #e5484d 16%, transparent)",
            border: "1px solid color-mix(in srgb, #e5484d 45%, transparent)",
            backdropFilter: "blur(6px)",
          }}
        >
          <span
            className="w-[7px] h-[7px] rounded-full bg-[#e5484d]"
            style={{ animation: "sandboxFeedPulse 1.6s ease-in-out infinite", boxShadow: "0 0 6px 1px rgba(229,72,77,0.6)" }}
          />
          <span
            className="text-[9px] font-bold uppercase"
            style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.16em", color: "#e5484d" }}
          >
            Sandbox Feed
          </span>
        </div>

        {weatherVis.mounted && <WeatherCard {...weatherData} closing={weatherVis.closing} />}

        {matchBoundariesVis.mounted && (
          <MatchBoundaries fours={liveState.matchBoundaries.fours} sixes={liveState.matchBoundaries.sixes} closing={matchBoundariesVis.closing} />
        )}

        {tournamentBoundariesVis.mounted && (
          <TournamentBoundaries
            fours={liveState.tournamentBoundaries.fours}
            sixes={liveState.tournamentBoundaries.sixes}
            closing={tournamentBoundariesVis.closing}
          />
        )}

        <MatchMomentOverlay hideDemoButtons />

        <LiveScoreBar show={channels.liveScoreBar} hideTrigger liveState={liveState} matchSetup={matchSetup} />

        <CricketMatchIntro show={channels.matchIntro} hideTrigger matchSetup={matchSetup} tournament={matchSetup.tournament} matchMeta={matchSetup.matchMeta} />

        {channels.tournamentLogo && (
          <TournamentLogoDisplay
            name={matchSetup.tournamentName || undefined}
            edition={[matchSetup.season && `SEASON ${matchSetup.season}`, matchSetup.format].filter(Boolean).join(" · ") || undefined}
            logo={matchSetup.tournamentLogoUrl || undefined}
          />
        )}

        {/* matchId={null} — no real balls ledger in the sandbox, so this
            shows team names/score with empty batting/bowling lists rather
            than real ball-by-ball figures. */}
        <CricketScorecard show={channels.matchScorecard} hideTrigger matchId={null} matchSetup={matchSetup} liveState={liveState} />
      </div>
    );
  }

  // ── CONTROL VIEW — broadcast-console styled scorer + control deck ───
  const scoreReadout = `${liveState.score.runs}/${liveState.score.wickets} (${liveState.score.overs}.${liveState.score.balls})`;
  const inningsLabel = liveState.matchComplete
    ? "Match Complete"
    : liveState.target !== undefined
    ? `Innings ${liveState.inningsNumber ?? 2} · Chasing ${liveState.target}`
    : `Innings ${liveState.inningsNumber ?? 1}`;

  return (
    <div className="h-screen w-screen overflow-hidden relative flex flex-col" style={{ background: "var(--color-background)", color: "var(--color-on-background)" }}>
      <style jsx global>{`
        @keyframes sandboxFeedPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @keyframes chyronIn {
          0% { opacity: 0; transform: translateY(-16px) scale(0.97); }
          55% { opacity: 1; transform: translateY(2px) scale(1.005); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .chyron-in {
          animation: chyronIn 380ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .overlay-sandbox-scanlines {
          background-image: repeating-linear-gradient(
            0deg,
            rgba(255, 255, 255, 0.012) 0px,
            rgba(255, 255, 255, 0.012) 1px,
            transparent 1px,
            transparent 3px
          );
        }
      `}</style>

      {/* Ambient scanline + top radial glow texture — same treatment as
          the other two sandboxes, so all three read as one console. */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overlay-sandbox-scanlines"
        style={{
          background:
            "radial-gradient(900px 380px at 50% 0%, color-mix(in srgb, var(--color-theme-orange) 7%, transparent), transparent 65%), " +
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "auto, 48px 48px, 48px 48px",
        }}
      />

      {/* ── Console header ────────────────────────────────────────── */}
      <div
        className="shrink-0 h-11 flex items-center justify-between px-4 relative z-20"
        style={{
          background: "linear-gradient(180deg, var(--color-surface-container-low), var(--color-surface-dim))",
          borderBottom: "1px solid var(--color-border-overlay)",
          boxShadow: "0 1px 0 rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-[3px] shrink-0"
            style={{
              background: "color-mix(in srgb, var(--color-theme-orange) 14%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-theme-orange) 45%, transparent)",
            }}
          >
            <span
              className="w-[7px] h-[7px] rounded-full"
              style={{
                background: "var(--color-theme-orange)",
                animation: "sandboxFeedPulse 1.6s ease-in-out infinite",
                boxShadow: "0 0 6px 1px color-mix(in srgb, var(--color-theme-orange) 60%, transparent)",
              }}
            />
            <span
              className="text-[10px] font-semibold uppercase"
              style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.11em", color: "var(--color-theme-orange)" }}
            >
              Sandbox
            </span>
          </div>

          <span className="w-px h-5 shrink-0" style={{ background: "var(--color-border-overlay)" }} />

          <span
            className="text-[12px] shrink-0"
            style={{ color: "var(--color-outline)", fontFamily: "var(--font-label-mono)" }}
          >
            {matchSetup.teamA.shortCode} vs {matchSetup.teamB.shortCode}
          </span>

          <span
            className="text-[12px] tabular-nums px-1.5 py-0.5 rounded-[2px] shrink-0"
            style={{
              fontFamily: "var(--font-headline-lg)",
              fontStyle: "italic",
              fontWeight: 700,
              color: "var(--color-theme-orange)",
              letterSpacing: "0.03em",
              background: "rgba(0,0,0,0.35)",
              border: "1px solid var(--color-border-overlay)",
            }}
          >
            {scoreReadout}
          </span>

          <div
            className="hidden md:flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-[3px] shrink-0"
            style={{ background: "rgba(0,0,0,0.22)", border: "1px solid var(--color-border-overlay)" }}
          >
            <span
              className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-[2px]"
              style={{
                fontFamily: "var(--font-label-mono)",
                letterSpacing: "0.06em",
                color: liveState.matchComplete ? "#08110c" : "var(--color-on-surface)",
                background: liveState.matchComplete ? "#3ddc84" : "transparent",
              }}
            >
              {inningsLabel}
            </span>
          </div>

          <span
            className="hidden lg:inline text-[10px] truncate"
            style={{ color: "var(--color-outline)", fontFamily: "var(--font-label-mono)" }}
          >
            hardcoded squads · no backend
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ConsoleActionButton onClick={restartMatch} icon={<RotateCcw className="w-2.5 h-2.5" />}>
            Restart
          </ConsoleActionButton>
          <ConsoleActionButton
            onClick={goLive}
            solid
            icon={<MonitorPlay className="w-2.5 h-2.5" />}
            title="Switch this tab into the actual broadcast surface"
          >
            Flip to Live
          </ConsoleActionButton>
        </div>
      </div>

      {/* ── Control deck ─────────────────────────────────────────── */}
      <div
        className="shrink-0 relative z-10"
        style={{ background: "rgba(10,10,10,0.35)", borderBottom: "1px solid var(--color-border-overlay)" }}
      >
        <div className="flex flex-wrap items-start gap-x-8 gap-y-4 px-5 py-4">
          <ControlCluster label="On Air Channels">
            {(Object.keys(CHANNEL_LABELS) as (keyof SandboxChannels)[]).map((key) => (
              <Pill key={key} active={channels[key]} onClick={() => toggleChannel(key)}>
                {CHANNEL_LABELS[key]}
              </Pill>
            ))}
          </ControlCluster>

          <ControlCluster label="Weather">
            <input
              type="number"
              value={weatherData.temp}
              onChange={(e) => setWeatherData((p) => ({ ...p, temp: Number(e.target.value) || 0 }))}
              className="w-16 px-2 py-1.5 rounded-full text-[10px] font-bold text-center focus:outline-none"
              style={{
                fontFamily: "var(--font-label-mono)",
                background: "rgba(255,255,255,0.03)",
                boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                color: "var(--color-on-surface)",
              }}
            />
            <select
              value={weatherData.condition}
              onChange={(e) => setWeatherData((p) => ({ ...p, condition: e.target.value }))}
              className="px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase focus:outline-none"
              style={{
                fontFamily: "var(--font-label-mono)",
                letterSpacing: "0.06em",
                background: "rgba(255,255,255,0.03)",
                boxShadow: "inset 0 0 0 1px var(--color-border-overlay)",
                color: "var(--color-on-surface)",
              }}
            >
              {/* Must match WeatherCard's DEFAULT_CONDITIONS keys exactly
                  — anything else silently falls back to the sunny icon. */}
              <option value="sunny">Sunny</option>
              <option value="clear">Clear</option>
              <option value="partly-cloudy">Partly Cloudy</option>
              <option value="cloudy">Cloudy</option>
              <option value="overcast">Overcast</option>
              <option value="rain">Rain</option>
              <option value="storm">Stormy</option>
              <option value="snow">Snow</option>
              <option value="fog">Foggy</option>
            </select>
            <ConsoleActionButton onClick={pushWeather} icon={<CloudSun className="w-2.5 h-2.5" />}>
              Push Weather
            </ConsoleActionButton>
          </ControlCluster>
        </div>

        {/* Event feed — same compact glass-strip treatment as the
            brackets sandbox's roster strip, swapped for a scrolling
            mono event log instead of team chips. */}
        <div
          className="flex items-start gap-3 px-5 py-2.5"
          style={{ background: "rgba(0,0,0,0.22)", borderTop: "1px solid var(--color-border-overlay)" }}
        >
          <span
            className="text-[9px] font-semibold uppercase shrink-0 pt-0.5"
            style={{ fontFamily: "var(--font-label-mono)", letterSpacing: "0.1em", color: "var(--color-outline)" }}
          >
            Event Feed
          </span>
          <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
            {log.length === 0 ? (
              <span
                className="text-[10px]"
                style={{ fontFamily: FONT_BODY, color: "var(--color-outline)" }}
              >
                Nothing fired yet — tap the ball pad to start scoring.
              </span>
            ) : (
              log.slice(0, 6).map((l, i) => (
                <span
                  key={i}
                  className="text-[10px] truncate max-w-[280px]"
                  style={{ fontFamily: "var(--font-label-mono)", color: i === 0 ? "var(--color-on-surface)" : "var(--color-outline)" }}
                >
                  {l}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <MomentChyron fired={firedMoment} />

      {/* ── Scoring console — fills remaining space, scrolls
            independently under the fixed header/control deck. ── */}
      <div className="flex-1 min-h-0 overflow-auto relative z-10 px-5 py-5">
        <div
          className="rounded-xl p-5"
          style={{
            background: "rgba(10,10,10,0.35)",
            border: "1px solid var(--color-border-overlay)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          <LiveStatePanel
            matchId={null}
            liveState={liveState}
            setLiveState={setLiveState}
            setLiveDirty={setLiveDirty}
            liveDirty={liveDirty}
            onPush={handlePush}
            pushLabel={pushed ? "Pushed ✓" : "Push Live State"}
            matchSetup={matchSetup}
            onBoundary={handleBoundary}
            onMilestone={handleMilestone}
            onWicketConfirm={handleWicket}
            onMaiden={handleMaiden}
            onInningsEnd={handleInningsEnd}
            onMatchComplete={handleMatchComplete}
            onFireMatchWonMoment={handleMatchWonAuto}
            onRestartMatch={restartMatch}
            initialEngineState={engineSyncState}
            onEngineStateChange={setEngineSyncState}
          />
        </div>
      </div>
    </div>
  );
}