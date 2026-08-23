// app/components/overlays/admin/new/OverlayAdminConsole.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import WeatherPanel from "@/components/overlays/admin/new/Weatherpanel";
import MatchSetupPanel from "@/components/overlays/admin/new/MatchInfopanel";
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
  // Resolves the same `tournaments` row the overlay display page resolves
  // (matches.tournament_id -> tournaments.name/logo_url), so the admin
  // header logo agrees with TournamentLogoDisplay instead of reading
  // matchSetup.tournamentLogoUrl, which can be empty/stale on a
  // genuinely tournament-attached match.
  loadTournamentIdentityForMatch,
  type TournamentIdentity,
} from "@/lib/matchPersistence";
import {
  GOLD_GRADIENT,
  PARTICLE_COLORS_BOUNDARY,
  PARTICLE_COLORS_WICKET,
  DEFAULT_LOGO_SRC,
  BOUNDARY_CHANNELS,
  DESKTOP_RIGHT_TABS,
  initials,
  Icon,
  useIsMobile,
  TogglePill,
  GroupLabel,
  MobileChannelRow,
  ChannelGroupCard,
  MomentButton,
  CenteredOverlay,
  BatterPickerButton,
  TeamAvatar,
  TeamPickerButton,
  defaultMatchSetup,
  initialLiveState,
  ROSTER_TEAM_A_FALLBACK,
  ROSTER_TEAM_B_FALLBACK,
  matchesTeamLabel,
} from "./OverlayAdminConsoleParts";
import ScoringSection, { type ScoringSectionHandle } from "@/components/overlays/admin/new/scoring-section";
// NEW — used to independently cross-check match_team_stats.is_winner
// against the live score before trusting it as the winner override. See
// the dbWinnerTeamKey effect below for the full rationale.
import { resolveWinningTeamKeyFromScore } from "@/components/overlays/admin/new/ScoringSectionParts";

let idCtr = 0;

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

  // Mirrors OnAirChannels.tsx's suppression rule: while any fullscreen
  // channel is live, the "Always On" ambient channels and the boundary
  // channels are forced invisible on the overlay. Their own on/off
  // toggle state is left untouched here (see the refs + effect further
  // down) so they come back exactly as they were the moment every
  // fullscreen channel goes off again — this is a suppression, not a
  // toggle-off.
  const anyFullscreenOn = fullScreen.pointsTable || fullScreen.matchScorecard || fullScreen.matchIntro;

  const [matchSetup, setMatchSetup] = useState<MatchSetup>(defaultMatchSetup());
  const [matchSetupEditing, setMatchSetupEditing] = useState(false);
  const [matchSetupCompleted, setMatchSetupCompleted] = useState(false);

  const [desktopRightTab, setDesktopRightTab] = useState<"setup" | "overlay">("overlay");

  const dbSetupRef = useRef<DbMatchSetupRow | null>(null);

  // ═══════════════════ Overlay bus connection ═══════════════════
  const busRef = useRef<ReturnType<typeof connectOverlayBus> | null>(null);
  const scoringSectionRef = useRef<ScoringSectionHandle | null>(null);

  // FIX — connectOverlayBus's own docstring says "page.tsx now falls
  // back to `matchId` when `auctionId` is missing" (referring to the
  // overlay display page), but this admin console never got that same
  // fix: it still gated the whole bus connection on `if (!auctionId)
  // return`. Any match created without an auction (friendly matches,
  // per the same file's comments) silently never connected the admin
  // console to the bus at all — every toggle/moment/push looked like
  // it worked (local state updated, toasts fired) but nothing ever
  // reached the overlay. `busChannelKey` mirrors what the overlay page
  // already does.
  const busChannelKey = auctionId ?? matchId ?? null;

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
    if (!busChannelKey) return;
    const bus = connectOverlayBus(busChannelKey);
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
  }, [busChannelKey]);

  useEffect(() => {
    // Snapshot reflects actual overlay visibility, not raw toggle state
    // — a suppressed channel is still "on" locally but must answer a
    // requestSync as invisible, or a reconnecting overlay page would
    // briefly show something that's supposed to be hidden behind the
    // active fullscreen channel.
    channelsRef.current = {
      weather: alwaysOn.weather && !anyFullscreenOn,
      liveScoreBar: alwaysOn.liveScoreBar && !anyFullscreenOn,
      tournamentLogo: alwaysOn.tournamentLogo && !anyFullscreenOn,
      pointsTable: fullScreen.pointsTable,
      matchScorecard: fullScreen.matchScorecard,
      matchIntro: fullScreen.matchIntro,
      matchBoundaries: boundaryChannels.matchBoundaries && !anyFullscreenOn,
      tournamentBoundaries: boundaryChannels.tournamentBoundaries && !anyFullscreenOn,
      testBg: false,
    };
  }, [alwaysOn, fullScreen, boundaryChannels, anyFullscreenOn]);

  useEffect(() => {
    matchSetupRef.current = matchSetup;
  }, [matchSetup]);

  useEffect(() => {
    matchSetupCompletedRef.current = matchSetupCompleted;
  }, [matchSetupCompleted]);

  // FIX — these three toggle functions used to call sendBus(...) from
  // *inside* the setState updater function passed to setAlwaysOn /
  // setFullScreen / setBoundaryChannels. Updater functions are meant to
  // be pure: React (Strict Mode in dev, and potentially future
  // concurrent-rendering paths) can and does invoke them more than once
  // to detect side effects, which meant a single toggle click could
  // fire two broadcasts, possibly landing out of order on the overlay
  // and causing a toggle to visually "flicker" or revert. Each handler
  // now computes the next value first, fires the bus event exactly
  // once, then calls setState with a plain value.
  // NEW — while a fullscreen channel is on-air, ambient channels are
  // suppressed (see `anyFullscreenOn` above): the overlay is already
  // showing them as hidden, so a toggle here only needs to flip local
  // state for when suppression lifts, and must NOT send a bus event —
  // sending one would incorrectly reveal the channel through/over the
  // fullscreen graphic that's currently live. Restoration happens in
  // the dedicated suppression effect below once fullscreen clears.
  function toggleAlwaysOn(key: "weather" | "liveScoreBar" | "tournamentLogo") {
    const value = !alwaysOn[key];
    if (!anyFullscreenOn) {
      if (key === "weather") {
        sendBus({ type: "weather", show: value, data: weatherRef.current });
      } else if (key === "liveScoreBar") {
        sendBus({ type: "liveScoreBar", show: value });
      } else {
        sendBus({ type: "tournamentLogo", show: value });
      }
    }
    setAlwaysOn((prev) => ({ ...prev, [key]: value }));
  }

  // NEW — fullscreen channels are mutually exclusive, mirroring
  // OnAirChannels.tsx's toggleFullscreen: turning one on turns every
  // other fullscreen channel off. Bus events are sent for every key
  // whose value actually changes (the newly-on one, and any that got
  // knocked off), computed up front so each fires exactly once.
  function toggleFullScreen(key: "pointsTable" | "matchScorecard" | "matchIntro") {
    const turningOn = !fullScreen[key];
    const next = { pointsTable: false, matchScorecard: false, matchIntro: false, [key]: turningOn } as typeof fullScreen;
    (Object.keys(fullScreen) as (keyof typeof fullScreen)[]).forEach((k) => {
      if (fullScreen[k] !== next[k]) sendBus({ type: k, show: next[k] });
    });
    setFullScreen(next);
  }

  // NEW — boundary channels are mutually exclusive with each other
  // (mirrors OnAirChannels.tsx's toggleBoundary), and are suppressed
  // (no bus event) while a fullscreen channel is on-air, same as
  // toggleAlwaysOn above.
  function toggleBoundaryChannel(key: "matchBoundaries" | "tournamentBoundaries") {
    const turningOn = !boundaryChannels[key];
    const other: "matchBoundaries" | "tournamentBoundaries" = key === "matchBoundaries" ? "tournamentBoundaries" : "matchBoundaries";
    const next = { ...boundaryChannels, [key]: turningOn, [other]: turningOn ? false : boundaryChannels[other] };
    if (!anyFullscreenOn) {
      (["matchBoundaries", "tournamentBoundaries"] as const).forEach((k) => {
        if (boundaryChannels[k] !== next[k]) {
          const counts = k === "matchBoundaries" ? liveStateRef.current.matchBoundaries : liveStateRef.current.tournamentBoundaries;
          sendBus({ type: k, show: next[k], fours: counts.fours, sixes: counts.sixes });
        }
      });
    }
    setBoundaryChannels(next);
  }

  // NEW — the actual suppress/restore broadcast. Fires only on the
  // true/false edge of `anyFullscreenOn` (a ref guards against
  // re-running for unrelated re-renders), and for each ambient/boundary
  // channel that's currently toggled on locally, sends the matching
  // hide (entering fullscreen) or show (leaving fullscreen) event.
  // Reads alwaysOn/boundaryChannels via refs rather than closing over
  // the state values directly, so this doesn't need to re-subscribe
  // (and doesn't risk acting on stale values) every time someone
  // flips an ambient/boundary toggle while fullscreen is already on.
  const alwaysOnRef = useRef(alwaysOn);
  useEffect(() => {
    alwaysOnRef.current = alwaysOn;
  }, [alwaysOn]);
  const boundaryChannelsRef = useRef(boundaryChannels);
  useEffect(() => {
    boundaryChannelsRef.current = boundaryChannels;
  }, [boundaryChannels]);
  const prevAnyFullscreenOnRef = useRef(anyFullscreenOn);
  useEffect(() => {
    if (anyFullscreenOn === prevAnyFullscreenOnRef.current) return;
    prevAnyFullscreenOnRef.current = anyFullscreenOn;
    const show = !anyFullscreenOn;
    const on = alwaysOnRef.current;
    const boundaries = boundaryChannelsRef.current;
    if (on.weather) sendBus({ type: "weather", show, data: weatherRef.current });
    if (on.liveScoreBar) sendBus({ type: "liveScoreBar", show });
    if (on.tournamentLogo) sendBus({ type: "tournamentLogo", show });
    if (boundaries.matchBoundaries) {
      const counts = liveStateRef.current.matchBoundaries;
      sendBus({ type: "matchBoundaries", show, fours: counts.fours, sixes: counts.sixes });
    }
    if (boundaries.tournamentBoundaries) {
      const counts = liveStateRef.current.tournamentBoundaries;
      sendBus({ type: "tournamentBoundaries", show, fours: counts.fours, sixes: counts.sixes });
    }
  }, [anyFullscreenOn]);
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

  // NEW — tournament identity, resolved the exact same way
  // OverlayDisplayPage/getOrCreateMatch resolve it:
  // matches.tournament_id -> tournaments.name/logo_url. This is kept
  // entirely separate from matchSetup — matchSetup.tournamentName/
  // tournamentLogoUrl can be empty or stale even on a genuinely
  // tournament-attached match, which is exactly why the admin header
  // logo was blank while the overlay page's TournamentLogoDisplay
  // (which reads from this same `tournaments` source) showed it fine.
  // null means either "standalone match, no tournament_id" or "the
  // tournament row has no logo uploaded yet" — either way the header
  // falls back to the match's own self-set logo below.
  const [tournament, setTournament] = useState<TournamentIdentity | null>(null);

  useEffect(() => {
    if (!matchId) {
      setTournament(null);
      return;
    }
    let cancelled = false;
    loadTournamentIdentityForMatch(matchId).then((t) => {
      if (!cancelled) setTournament(t);
    });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  // NEW — mirrors OverlayDisplayPage's isStandalone branch exactly: no
  // tournament attached (tournament is null) -> fall back to the
  // match's own self-set logo (matchSetup.tournamentLogoUrl); otherwise
  // the tournament's crest always wins, since matchSetup's field is not
  // treated as authoritative once a real tournament_id is attached.
  const isStandaloneMatch = !tournament;
  const headerLogoSrc = isStandaloneMatch
    ? matchSetup.tournamentLogoUrl || DEFAULT_LOGO_SRC
    : tournament!.logoUrl || DEFAULT_LOGO_SRC;

  // UPDATED — legacyMatchSetup now also carries teamAFullName/
  // teamBFullName (matchSetup.teamA.name / matchSetup.teamB.name)
  // alongside the existing shortcode-preferred teamA/teamB fields.
  // These extra fields are NOT used for display anywhere (teamA/teamB
  // still drive every label/header in the UI exactly as before) — they
  // exist solely so ScoringSection's winning-team resolution can match
  // liveState.matchResult.winningTeamName against either a shortcode
  // ("RAV") or a full name ("Ratmalana Aviators"), as a fallback for
  // matches with no match_team_stats row (see dbWinnerTeamKey below,
  // which is now cross-checked against the score rather than blindly
  // trusted — see that effect's comment for why).
  const legacyMatchSetup = useMemo(
    () => ({
      teamA: matchSetup.teamA.shortCode || matchSetup.teamA.name || "Team A",
      teamAFullName: matchSetup.teamA.name || undefined,
      teamAColor: matchSetup.teamA.color || "#c9971f",
      teamAlogo: matchSetup.teamA.logoUrl,
      teamB: matchSetup.teamB.shortCode || matchSetup.teamB.name || "Team B",
      teamBFullName: matchSetup.teamB.name || undefined,
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
    pushLog(`Match Setup pushed — ${legacyMatchSetup.teamA}  vs  ${legacyMatchSetup.teamB}, ${matchSetup.venue}`);
    fireToast("Match Setup pushed to overlay");

    // Snapshot the previous value so it can be rolled back if the DB
    // write below fails; previously this flipped to true optimistically
    // and never reverted on failure, leaving the UI claiming "pushed"
    // even though the match record wasn't actually updated.
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

  const maxOvers = matchSetup.format === "T20" ? 20 : matchSetup.format === "ODI" ? 50 : undefined;

  // ═══════════ NEW — winning team, fetched from the DB, cross-validated against the score ═══════════
  // The winning team's logo on the match-complete screen used to be
  // resolved entirely from liveState.matchResult.winningTeamName, which
  // can arrive empty/missing depending on how the match was completed
  // (live engine vs. an imported/simulated match record). match_team_stats
  // .is_winner exists specifically to answer "which team won this match"
  // and is normally the best source — BUT it's an independent write path
  // (set by whatever process finalizes stats) that can disagree with the
  // live scoring state if, e.g., its team_id got attached to the wrong
  // physical team during import/simulation. That's exactly what caused
  // one team to be shown as the winner in this console while the
  // match-detail page (which derives the winner purely from innings
  // totals + toss, never touching match_team_stats) correctly showed the
  // other — same underlying score, two different "winner" answers.
  //
  // Fix: before trusting the DB value, independently derive the winner
  // from the live score/target using the exact same logic ScoringSection's
  // local fallback uses (resolveWinningTeamKeyFromScore, which is
  // toss/innings-order aware via battingTeamKey/bowlingTeamKey — the same
  // values that already agree with match-detail-client's determineWinner()).
  // If the DB value and the score-derived value disagree, the score-derived
  // value wins and a warning is logged — the live score is ground truth we
  // can verify from this page's own state; a mismatched foreign key in
  // match_team_stats is exactly the kind of bad data that shouldn't
  // silently override it.
  //
  // If the score can't yet determine a winner (e.g. match was marked
  // complete via a manual "Match Won" moment with no target set, or an
  // abandoned/DLS match), the DB value is used as-is with no cross-check
  // possible, and ScoringSection's remaining local fallbacks (method-
  // derived, then name-matching) only get a turn if there's no DB value
  // either.
  const [dbWinnerTeamKey, setDbWinnerTeamKey] = useState<"teamA" | "teamB" | null>(null);

  useEffect(() => {
    if (!matchId || !liveState.matchComplete) {
      setDbWinnerTeamKey(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("match_team_stats")
        .select("team_id, is_winner")
        .eq("match_id", matchId);
      if (cancelled) return;
      if (error) {
        console.error("[OverlayAdminConsole] failed to load match_team_stats:", error.message);
        setDbWinnerTeamKey(null);
        return;
      }
      const winnerRow = (data ?? []).find((r) => r.is_winner === true);

      let dbKey: "teamA" | "teamB" | null = null;
      if (winnerRow?.team_id) {
        if (winnerRow.team_id === matchSetup.teamA.teamId) dbKey = "teamA";
        else if (winnerRow.team_id === matchSetup.teamB.teamId) dbKey = "teamB";
      }

      // Independently derive the winner from the live score/target, using
      // the same toss-aware battingTeamKey/bowlingTeamKey this console
      // already computes for scoring purposes.
      const isSecondInnings = (liveState.inningsNumber ?? 1) === 2;
      const scoreKey = resolveWinningTeamKeyFromScore(
        liveState,
        isSecondInnings,
        maxOvers,
        battingTeamKey,
        bowlingTeamKey
      );

      if (scoreKey && dbKey && scoreKey !== dbKey) {
        console.warn(
          "[OverlayAdminConsole] match_team_stats winner disagrees with live score — trusting score. " +
            "This usually means match_team_stats.team_id is mismatched against matchSetup.teamA/teamB.teamId " +
            "for this match; that row should be corrected.",
          {
            matchId,
            winnerRow,
            dbKeyResolved: dbKey,
            scoreKeyResolved: scoreKey,
            teamAId: matchSetup.teamA.teamId,
            teamBId: matchSetup.teamB.teamId,
          }
        );
        setDbWinnerTeamKey(scoreKey);
        return;
      }

      if (dbKey) {
        setDbWinnerTeamKey(dbKey);
        return;
      }

      if (winnerRow && !dbKey && process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(
          "[OverlayAdminConsole] match_team_stats winner team_id didn't match teamA/teamB.teamId:",
          { winnerRow, teamAId: matchSetup.teamA.teamId, teamBId: matchSetup.teamB.teamId }
        );
      }

      // No usable DB winner — fall back to the score-derived key if we
      // have one, otherwise let ScoringSection's own local fallback chain
      // (method-derived, then name-matching) take over.
      setDbWinnerTeamKey(scoreKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, liveState, matchSetup.teamA.teamId, matchSetup.teamB.teamId, battingTeamKey, bowlingTeamKey, maxOvers]);
  // ═══════════ END winning team fetch ═══════════

  // ═══════════ NEW — Realtime sync from other writers ═══════════
  // Mirrors the subscription in app/overlay/[auctionId]/page.tsx. That
  // page already reflects DB writes made by the match simulator's
  // patch_match_setup RPC (or any other live-scoring writer) in real
  // time — this console previously did not: it only ever loaded
  // match_setup/live_state once on mount, and after that only updated
  // its own local state from its own UI actions or from bus events it
  // sent itself. Run the simulator in one tab with this console open in
  // another and the console would sit there showing stale data
  // (score/venue/toss/etc.) until a hard refresh, even though the
  // overlay display page was updating live the whole time.
  //
  // Placed after the liveState/liveDirty declarations above (rather
  // than up near the first matchId-load effect) so the dependency
  // array below doesn't reference those consts before they're
  // initialized in this component's execution order.
  //
  // FIX — the `matches` handler previously bailed out while
  // `matchSetupEditing` was true, on the assumption that flag meant
  // "someone is actively typing in MatchSetupPanel, don't stomp them."
  // MatchSetupPanel is now a VIEW-ONLY summary (see its own header
  // comment: "Match Setup is no longer editable inline... Editing now
  // lives exclusively at /match/{matchId}/edit") — it has no editable
  // fields to protect anymore. Its `onEditingChange` callback actually
  // reports whether the details drawer is expanded/collapsed (for
  // desktop layout purposes), and that drawer defaults to OPEN
  // (`useState(true)`) and stays open for essentially the entire time
  // anyone has this panel visible. So the old guard was discarding
  // *every* incoming match_setup Realtime update almost all the time —
  // this was the actual reason simulator writes never appeared here.
  // There's nothing left in this component for an incoming row to
  // clobber, so the guard is simply removed.
  //
  // match_state/live_state keeps its liveDirty guard: ScoringSection's
  // fields ARE genuinely locally editable (tapping runs/wickets before
  // a push), so an unsaved manual scoring edit should still not be
  // stomped by an unrelated echo landing back from Realtime.
  //
  // Requires `matches` and `match_state` to be added to the Supabase
  // Realtime publication (Database → Replication) with RLS SELECT
  // policies that permit whatever role this page runs as — same
  // requirement already documented on the overlay page's subscription.
  //
  // Keyed on matchId, same as the load effect above and the bus
  // connection — every table involved here is keyed by match_id.
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`admin-db:${matchId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        (payload) => {
          const row = payload.new as { match_setup: DbMatchSetupRow; match_setup_completed: boolean };
          dbSetupRef.current = row.match_setup ?? null;
          setMatchSetup((prev) => dbRowToOverlaySetup(row.match_setup ?? null, prev));
          setMatchSetupCompleted(!!row.match_setup_completed);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_state", filter: `match_id=eq.${matchId}` },
        (payload) => {
          if (liveDirty) return;
          const row = payload.new as { live_state?: LiveState } | undefined;
          if (row?.live_state) setLiveState(row.live_state);
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn("[OverlayAdminConsole] db realtime connection issue:", status, "matchId:", matchId);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, liveDirty]);
  // ═══════════ END Realtime sync from other writers ═══════════

  // FIX — this was the core "not syncing in real time" complaint. Every
  // ball, wicket, or crew change flowed only into local `liveState` (and,
  // separately, into Supabase persistence elsewhere) — the overlay only
  // ever received it when someone clicked "Push Live State". Mirrors the
  // existing weather auto-broadcast effect below: skips the very first
  // mount (so we don't fire before the bus is connected / before any
  // real change happened), then sends the full liveState on every
  // change after that. The manual push button is left in place — it
  // still exists to explicitly persist to Supabase via saveLiveState —
  // but the overlay no longer has to wait for it to see new state.
  const liveStateMountedRef = useRef(false);
  useEffect(() => {
    if (!liveStateMountedRef.current) {
      liveStateMountedRef.current = true;
      return;
    }
    sendBus({ type: "liveState", data: liveState });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useIsMobile();

  // NEW — dependency changed from matchSetup.tournamentLogoUrl to the
  // resolved headerLogoSrc, so a fallback-vs-real-logo swap correctly
  // clears any previous load failure state.
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    setLogoFailed(false);
  }, [headerLogoSrc]);

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

  // Broadcast weather changes to the overlay. Skips the initial mount
  // so we don't fire a spurious event before the bus is even connected
  // / before any real change has happened.
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
  // broadcast it as an OverlayEvent to the on-air overlay. ──
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
    // UPDATED — was a strict `===` compare against legacyMatchSetup.teamA/
    // teamB (i.e. shortcode only). Now uses matchesTeamLabel, which
    // checks both the shortcode and the full team name, so a result
    // string holding the full name ("Ratmalana Aviators") still
    // correctly resolves back to the right team's color/logo even
    // though legacyMatchSetup.teamB itself is the shortcode ("RAV").
    const isTeamA = matchesTeamLabel(result.winningTeamName, legacyMatchSetup.teamA, legacyMatchSetup.teamAFullName);
    const isTeamB = !isTeamA && matchesTeamLabel(result.winningTeamName, legacyMatchSetup.teamB, legacyMatchSetup.teamBFullName);
    sendBus({
      type: "moment",
      moment: "matchWon",
      player: result.winningTeamName,
      score: result.margin,
      teamColor: isTeamA ? legacyMatchSetup.teamAColor : isTeamB ? legacyMatchSetup.teamBColor : undefined,
      teamLogo: isTeamA ? legacyMatchSetup.teamAlogo : isTeamB ? legacyMatchSetup.teamBlogo : undefined,
      method: result.method as "runs" | "wickets" | "tie",
    } as OverlayEvent);
  }

  function pushLiveState() {
    setLivePushed(true);
    setLiveDirty(false);
    pushLog("Live State pushed to overlay");
    // Kept — the auto-broadcast effect above already sent this state
    // the moment it changed, so this call is now effectively a no-op
    // resend. Left in place because it's harmless (idempotent) and the
    // button still serves its other job below: explicitly persisting
    // the current liveState to Supabase on demand rather than waiting
    // for the engine's own incremental saves.
    sendBus({ type: "liveState", data: liveState });
    if (matchId) saveLiveState(matchId, liveState);
    setTimeout(() => setLivePushed(false), 1500);
  }

  function handleEngineStateChange(state: EngineSyncState) {
    if (matchId) saveEngineState(matchId, state);
  }

  async function restartMatchAndEngine() {
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
      teamLogo: matchWonDraft.winner === "teamA" ? legacyMatchSetup.teamAlogo : matchWonDraft.winner === "teamB" ? legacyMatchSetup.teamBlogo : undefined,
      method: matchWonDraft.method === "batting" ? "wickets" : matchWonDraft.method === "bowling" ? "runs" : "tie",
    } as OverlayEvent);
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
                src={headerLogoSrc}
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
              {"  "}vs{"  "}
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
          <GroupLabel center>On Air{anyFullscreenOn ? " (suppressed)" : ""}</GroupLabel>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <TogglePill label="Weather" on={alwaysOn.weather && !anyFullscreenOn} dotColor="#22c55e" onClick={() => toggleAlwaysOn("weather")} />
            <TogglePill label="Live Score Bar" on={alwaysOn.liveScoreBar && !anyFullscreenOn} dotColor="#22c55e" onClick={() => toggleAlwaysOn("liveScoreBar")} />
            <TogglePill label="Tournament Logo" on={alwaysOn.tournamentLogo && !anyFullscreenOn} dotColor="#22c55e" onClick={() => toggleAlwaysOn("tournamentLogo")} />
          </div>
        </div>
        <span className="hidden sm:block w-px self-stretch bg-white/10" />
        <div className="flex flex-col items-center gap-1.5">
          <GroupLabel center>Full-Screen (exclusive)</GroupLabel>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <TogglePill label="Points Table" on={fullScreen.pointsTable} dotColor="#c9971f" onClick={() => toggleFullScreen("pointsTable")} />
            <TogglePill label="Match Scorecard" on={fullScreen.matchScorecard} dotColor="#c9971f" onClick={() => toggleFullScreen("matchScorecard")} />
            <TogglePill label="Match Intro" on={fullScreen.matchIntro} dotColor="#c9971f" onClick={() => toggleFullScreen("matchIntro")} />
          </div>
        </div>
        <span className="hidden sm:block w-px self-stretch bg-white/10" />
        <div className="flex flex-col items-center gap-1.5">
          <GroupLabel center>Moments{anyFullscreenOn ? " (suppressed)" : ""}</GroupLabel>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {BOUNDARY_CHANNELS.map((c) => (
              <TogglePill
                key={c.key}
                label={c.label}
                on={boundaryChannels[c.key] && !anyFullscreenOn}
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
          winnerTeamKeyOverride={dbWinnerTeamKey}
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
            <div className="p-4 shrink-0 lg:hidden flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-archivo text-sm font-bold italic uppercase mb-0.5">Broadcast Channels</h3>
                  <p className="font-mono-geist text-[9px] text-on-surface-variant uppercase tracking-[0.06em] leading-tight">
                    Toggle what&apos;s live on the overlay
                  </p>
                </div>
                {anyFullscreenOn && (
                  <span
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full font-mono-geist text-[8px] font-bold uppercase tracking-[0.12em]"
                    style={{ background: "rgba(201,151,31,0.14)", border: "1px solid rgba(201,151,31,0.35)", color: "#e8c468" }}
                  >
                    <Icon name="visibility_off" style={{ fontSize: 11 }} />
                    On-air hidden
                  </span>
                )}
              </div>

              <ChannelGroupCard title="On Air" hint={anyFullscreenOn ? "suppressed" : undefined}>
                <MobileChannelRow
                  icon="partly_cloudy_day"
                  label="Weather"
                  sublabel={alwaysOn.weather && !anyFullscreenOn ? "Live" : undefined}
                  on={alwaysOn.weather && !anyFullscreenOn}
                  dotColor="#22c55e"
                  onClick={() => toggleAlwaysOn("weather")}
                />
                <MobileChannelRow
                  icon="scoreboard"
                  label="Live Score Bar"
                  sublabel={alwaysOn.liveScoreBar && !anyFullscreenOn ? "Live" : undefined}
                  on={alwaysOn.liveScoreBar && !anyFullscreenOn}
                  dotColor="#22c55e"
                  onClick={() => toggleAlwaysOn("liveScoreBar")}
                />
                <MobileChannelRow
                  icon="military_tech"
                  label="Tournament Logo"
                  sublabel={alwaysOn.tournamentLogo && !anyFullscreenOn ? "Live" : undefined}
                  on={alwaysOn.tournamentLogo && !anyFullscreenOn}
                  dotColor="#22c55e"
                  onClick={() => toggleAlwaysOn("tournamentLogo")}
                />
              </ChannelGroupCard>

              <ChannelGroupCard title="Full-Screen" hint="pick one">
                <MobileChannelRow icon="leaderboard" label="Points Table" sublabel={fullScreen.pointsTable ? "On air" : undefined} on={fullScreen.pointsTable} dotColor="#c9971f" onClick={() => toggleFullScreen("pointsTable")} />
                <MobileChannelRow icon="receipt_long" label="Match Scorecard" sublabel={fullScreen.matchScorecard ? "On air" : undefined} on={fullScreen.matchScorecard} dotColor="#c9971f" onClick={() => toggleFullScreen("matchScorecard")} />
                <MobileChannelRow icon="theaters" label="Match Intro" sublabel={fullScreen.matchIntro ? "On air" : undefined} on={fullScreen.matchIntro} dotColor="#c9971f" onClick={() => toggleFullScreen("matchIntro")} />
              </ChannelGroupCard>

              <ChannelGroupCard title="Moments" hint={anyFullscreenOn ? "suppressed" : "pick one"}>
                <MobileChannelRow
                  icon="stadium"
                  label="Match Boundaries"
                  sublabel={boundaryChannels.matchBoundaries && !anyFullscreenOn ? "Live" : undefined}
                  on={boundaryChannels.matchBoundaries && !anyFullscreenOn}
                  dotColor="#e8c468"
                  onClick={() => toggleBoundaryChannel("matchBoundaries")}
                />
                <MobileChannelRow
                  icon="emoji_events"
                  label="Tournament Boundaries"
                  sublabel={boundaryChannels.tournamentBoundaries && !anyFullscreenOn ? "Live" : undefined}
                  on={boundaryChannels.tournamentBoundaries && !anyFullscreenOn}
                  dotColor="#e8c468"
                  onClick={() => toggleBoundaryChannel("tournamentBoundaries")}
                />
              </ChannelGroupCard>
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
                          <div className="grid grid-cols-2 gap-2">
                            <TeamPickerButton
                              name={legacyMatchSetup.teamA}
                              logoUrl={legacyMatchSetup.teamAlogo}
                              color={legacyMatchSetup.teamAColor}
                              selected={matchWonDraft.winner === "teamA"}
                              onClick={() => setMatchWonDraft((p) => ({ ...p, winner: "teamA" }))}
                            />
                            <TeamPickerButton
                              name={legacyMatchSetup.teamB}
                              logoUrl={legacyMatchSetup.teamBlogo}
                              color={legacyMatchSetup.teamBColor}
                              selected={matchWonDraft.winner === "teamB"}
                              onClick={() => setMatchWonDraft((p) => ({ ...p, winner: "teamB" }))}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setMatchWonDraft((p) => ({ ...p, winner: "custom" }))}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-center transition-all"
                            style={{
                              border: `1px solid ${matchWonDraft.winner === "custom" ? "rgba(201,151,31,0.5)" : "rgba(255,255,255,0.08)"}`,
                              background: matchWonDraft.winner === "custom" ? "rgba(201,151,31,0.14)" : "rgba(255,255,255,0.02)",
                            }}
                          >
                            <Icon name="edit" style={{ fontSize: 13, color: matchWonDraft.winner === "custom" ? "#e8c468" : "rgba(255,255,255,0.45)" }} />
                            <span className={`text-[11px] font-archivo font-bold ${matchWonDraft.winner === "custom" ? "text-theme-orange" : "text-on-surface-variant"}`}>
                              Other / Custom Name
                            </span>
                          </button>
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

                        {/* Live preview of the graphic about to be fired */}
                        {(() => {
                          const previewName =
                            matchWonDraft.winner === "teamA"
                              ? legacyMatchSetup.teamA
                              : matchWonDraft.winner === "teamB"
                              ? legacyMatchSetup.teamB
                              : matchWonDraft.customName || "Winner";
                          const previewLogo =
                            matchWonDraft.winner === "teamA"
                              ? legacyMatchSetup.teamAlogo
                              : matchWonDraft.winner === "teamB"
                              ? legacyMatchSetup.teamBlogo
                              : undefined;
                          const previewColor =
                            matchWonDraft.winner === "teamA"
                              ? legacyMatchSetup.teamAColor
                              : matchWonDraft.winner === "teamB"
                              ? legacyMatchSetup.teamBColor
                              : "#c9971f";
                          return (
                            <div
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                              style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${previewColor}40` }}
                            >
                              <TeamAvatar name={previewName} logoUrl={previewLogo} color={previewColor} size={36} />
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="font-archivo text-sm font-bold truncate" style={{ color: previewColor }}>
                                  {previewName}
                                </span>
                                <span className="font-mono-geist text-[9px] uppercase tracking-[0.1em] text-on-surface-variant truncate">
                                  {matchWonDraft.margin || "Match Won"}
                                  {" · "}
                                  {matchWonDraft.method === "batting" ? "By wickets" : matchWonDraft.method === "bowling" ? "By runs" : "Tie"}
                                </span>
                              </div>
                              <Icon name="emoji_events" style={{ fontSize: 20, color: previewColor }} />
                            </div>
                          );
                        })()}

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