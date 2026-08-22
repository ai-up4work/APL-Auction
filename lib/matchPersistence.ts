import { supabase } from "@/lib/supabase";
import type {
  MatchSetup,
  LiveState,
  WeatherData,
  ChannelVisibility,
  SquadPlayer,
  TeamInfo,
} from "@/lib/overlayBus";
import type { EngineSyncState } from "@/hooks/useLiveScoringEngine";

// ── error logging helper ────────────────────────────────────────────
function logDbError(context: string, error: unknown) {
  try {
    const e = error as Record<string, unknown> | null;
    console.error(`[matchPersistence] ${context} failed — raw:`, error);
    console.error(`[matchPersistence] ${context} failed — typeof:`, typeof error);
    console.error(`[matchPersistence] ${context} failed — keys:`, error && typeof error === "object" ? Object.keys(error) : null);

    const seen = new WeakSet();
    let safeJson = "<unserializable>";
    try {
      safeJson = JSON.stringify(
        error,
        (_key, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) return "[Circular]";
            seen.add(value);
          }
          return value;
        },
        2
      );
    } catch (stringifyError) {
      safeJson = `<failed to stringify: ${(stringifyError as Error)?.message}>`;
    }
    console.error(`[matchPersistence] ${context} failed — JSON:`, safeJson);

    console.error(`[matchPersistence] ${context} failed — fields:`, {
      message: e?.message,
      details: e?.details,
      hint: e?.hint,
      code: e?.code,
      status: e?.status,
      name: e?.name,
    });
  } catch (loggingError) {
    console.error(`[matchPersistence] ${context} failed — and logging itself threw:`, loggingError, error);
  }
}

// ── balls (event log) ───────────────────────────────────────────────

export interface BallInsert {
  inningsNumber: number;
  sequence: number;
  overNumber: number;
  ballNumber: number;
  strikerName: string;
  nonStrikerName: string;
  bowlerName: string;
  runs: number;
  extraType: string;
  isWicket: boolean;
  dismissalType?: string;
  batsmanOut?: string;
  fielder?: string;
  isFreeHit: boolean;
  noBallRunOrigin?: string;
}

export async function appendBall(matchId: string, ball: BallInsert): Promise<boolean> {
  const { error } = await supabase.from("balls").upsert(
    {
      match_id: matchId,
      innings_number: ball.inningsNumber,
      sequence: ball.sequence,
      over_number: ball.overNumber,
      ball_number: ball.ballNumber,
      striker_name: ball.strikerName || null,
      non_striker_name: ball.nonStrikerName || null,
      bowler_name: ball.bowlerName || null,
      runs: ball.runs,
      extra_type: ball.extraType,
      is_wicket: ball.isWicket,
      dismissal_type: ball.dismissalType ?? null,
      batsman_out: ball.batsmanOut ?? null,
      fielder: ball.fielder ?? null,
      is_free_hit: ball.isFreeHit,
    },
    { onConflict: "match_id,innings_number,sequence" }
  );

  if (error) {
    logDbError("appendBall", error);
    return false;
  }
  return true;
}

export async function deleteLastBall(
  matchId: string,
  inningsNumber: number,
  sequence: number
): Promise<boolean> {
  const { error } = await supabase
    .from("balls")
    .delete()
    .eq("match_id", matchId)
    .eq("innings_number", inningsNumber)
    .eq("sequence", sequence);

  if (error) {
    logDbError("deleteLastBall", error);
    return false;
  }
  return true;
}

export async function deleteAllBalls(matchId: string): Promise<boolean> {
  const { error } = await supabase.from("balls").delete().eq("match_id", matchId);
  if (error) {
    logDbError("deleteAllBalls", error);
    return false;
  }
  return true;
}

// ── matches ────────────────────────────────────────────────────────────

export interface TournamentIdentity {
  tournamentId: string;
  name: string;
  logoUrl: string;
}

export interface MatchRow {
  id: string;
  auction_id: string;
  match_setup: MatchSetup;
  match_setup_completed: boolean;
  // Tournament identity, read straight from `tournaments` and kept
  // entirely separate from match_setup. `tournaments.name`/`logo_url`
  // is the single source of truth for a tournament match's crest — it
  // is NOT merged into matchSetup.tournamentName/tournamentLogoUrl, so
  // there's never ambiguity about which of two places "won." This is
  // null for a standalone match (no tournament_id on the row) or if
  // the tournament itself has no logo uploaded yet.
  tournament: TournamentIdentity | null;
}

const emptyOverlayTeam = () => ({
  name: "",
  shortCode: "",
  color: "#c9971f",
  logoUrl: "",
  squad: [] as string[],
  squadPlayers: [] as { id: string; name: string; imageUrl?: string }[],
});

const EMPTY_MATCH_SETUP: MatchSetup = {
  tournamentName: "",
  season: "",
  tournamentLogoUrl: "",
  venue: "",
  format: "T20",
  matchNumber: "",
  matchTitle: "",
  teamA: emptyOverlayTeam(),
  kickoffTime: "",
  teamB: emptyOverlayTeam(),
  matchMeta: "",
  tournament: "",
  tossWinner: "",
  tossDecision: "",
};

// ── shape normalization ──────────────────────────────────────────────
// `matches.match_setup` is a bare jsonb column with no DB-level schema —
// two very different producers write into it:
//   1. The Match Editor / createFriendlyMatch flow, which writes
//      { team1, team2, round, venue, date, time, toss, overs, officials,
//        squads, rosterLocked, matchTitle, matchNumber, matchMeta,
//        tossWinner, tossDecision, tournament, tournamentLogoUrl, ... }.
//   2. This overlay admin flow, which reads/writes the real MatchSetup
//      shape: { teamA, teamB, tossWinner: "A"|"B"|"", tournamentName, ... }.
export function isFriendlyMatchShape(raw: unknown): raw is Record<string, any> {
  return (
    !!raw &&
    typeof raw === "object" &&
    ("team1" in (raw as object) || "team2" in (raw as object)) &&
    !("teamA" in (raw as object))
  );
}

// Squads on a friendly-match row can be in either shape the editor
// itself already has to handle:
//   - GROUPED: [{ teamId: "team1"|"team2", captain, players: [{name, role, xi, playerId}] }]
//   - FLAT: [{ name, role, team: "<short code>", captain? }]
function extractFriendlySquadPlayers(
  raw: Record<string, any>,
  teamKey: "team1" | "team2",
  teamShort: string
): SquadPlayer[] {
  const rawSquads: any[] = Array.isArray(raw.squads) ? raw.squads : [];
  if (rawSquads.length === 0) return [];

  const isGrouped = rawSquads.some((s) => s && typeof s === "object" && "teamId" in s);

  if (isGrouped) {
    const found = rawSquads.find((s) => s?.teamId === teamKey);
    const players: any[] = Array.isArray(found?.players) ? found.players : [];
    return players
      .filter((p) => typeof p?.name === "string" && p.name.trim())
      .map((p) => ({
        id: typeof p.playerId === "string" && p.playerId.trim() ? p.playerId : `manual:${p.name}`,
        name: p.name as string,
      }));
  }

  const wantTeam2 = teamKey === "team2";
  return rawSquads
    .filter((p) => p && typeof p?.name === "string" && p.name.trim())
    .filter((p) => {
      const code = (p.team ?? "").toString().toUpperCase();
      const isTeam2 =
        !!code &&
        code === (raw.team2?.short ?? "").toString().toUpperCase() &&
        code !== (raw.team1?.short ?? "").toString().toUpperCase();
      return wantTeam2 ? isTeam2 : !isTeam2;
    })
    .map((p) => ({ id: `manual:${p.name}`, name: p.name as string }));
}

function guessFormatFromOvers(overs: unknown): MatchSetup["format"] {
  const n = typeof overs === "number" ? overs : Number(overs);
  if (!Number.isFinite(n) || n <= 0) return "T20";
  if (n <= 20) return "T20";
  if (n <= 50) return "ODI";
  return "Test";
}

function resolveTossWinnerLetter(raw: Record<string, any>): MatchSetup["tossWinner"] {
  const winner = typeof raw.tossWinner === "string" ? raw.tossWinner.trim() : "";
  if (!winner) return "";
  if (winner === (raw.team1?.name ?? "").toString().trim()) return "A";
  if (winner === (raw.team2?.name ?? "").toString().trim()) return "B";
  return "";
}

function combineKickoffTime(raw: Record<string, any>): string {
  const date = typeof raw.date === "string" ? raw.date.trim() : "";
  const time = typeof raw.time === "string" ? raw.time.trim() : "";
  if (date && time) return `${date} ${time}`;
  return date || time || "";
}

export function normalizeMatchSetup(raw: unknown): MatchSetup {
  if (isFriendlyMatchShape(raw)) {
    const r = raw as Record<string, any>;
    const team1Short = r.team1?.short ?? "";
    const team2Short = r.team2?.short ?? "";

    const teamAPlayers = extractFriendlySquadPlayers(r, "team1", team1Short);
    const teamBPlayers = extractFriendlySquadPlayers(r, "team2", team2Short);

    return {
      ...EMPTY_MATCH_SETUP,
      tournamentName: typeof r.tournamentName === "string" ? r.tournamentName : "",
      season: typeof r.season === "string" ? r.season : "",
      tournamentLogoUrl: typeof r.tournamentLogoUrl === "string" ? r.tournamentLogoUrl : "",
      venue: typeof r.venue === "string" ? r.venue : "",
      format:
        r.format === "T20" || r.format === "ODI" || r.format === "Test"
          ? r.format
          : guessFormatFromOvers(r.overs),
      matchNumber: typeof r.matchNumber === "string" ? r.matchNumber : "",
      matchTitle:
        typeof r.matchTitle === "string" && r.matchTitle.trim()
          ? r.matchTitle
          : typeof r.round === "string"
          ? r.round
          : "",
      kickoffTime: combineKickoffTime(r),
      matchMeta: typeof r.matchMeta === "string" ? r.matchMeta : "",
      tournament: typeof r.tournament === "string" ? r.tournament : "",
      tossWinner: resolveTossWinnerLetter(r),
      tossDecision: r.tossDecision === "bat" || r.tossDecision === "bowl" ? r.tossDecision : "",
      teamA: {
        ...emptyOverlayTeam(),
        name: r.team1?.name ?? "",
        shortCode: team1Short,
        logoUrl: r.team1?.logo ?? "",
        color: typeof r.team1?.color === "string" && r.team1.color ? r.team1.color : emptyOverlayTeam().color,
        squadPlayers: teamAPlayers,
        squad: teamAPlayers.map((p) => p.name),
      },
      teamB: {
        ...emptyOverlayTeam(),
        name: r.team2?.name ?? "",
        shortCode: team2Short,
        logoUrl: r.team2?.logo ?? "",
        color: typeof r.team2?.color === "string" && r.team2.color ? r.team2.color : emptyOverlayTeam().color,
        squadPlayers: teamBPlayers,
        squad: teamBPlayers.map((p) => p.name),
      },
    };
  }

  if (!raw || typeof raw !== "object") return EMPTY_MATCH_SETUP;

  const r = raw as Record<string, any>;
  return {
    ...EMPTY_MATCH_SETUP,
    ...r,
    teamA: { ...emptyOverlayTeam(), ...(r.teamA ?? {}) },
    teamB: { ...emptyOverlayTeam(), ...(r.teamB ?? {}) },
  };
}

// ─────────────────────────────────────────────────────────────
// TOURNAMENT IDENTITY — read directly from `tournaments`, kept fully
// separate from match_setup. This is the ONLY source consumers should
// use for a tournament match's display name/logo — match_setup's own
// tournamentName/tournamentLogoUrl fields are left alone (still usable
// for a STANDALONE match's own self-set title/logo) but are no longer
// treated as authoritative for anything actually attached to a real
// tournament row.
// ─────────────────────────────────────────────────────────────
export async function loadTournamentIdentity(tournamentId: string): Promise<TournamentIdentity | null> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, logo_url")
    .eq("id", tournamentId)
    .maybeSingle();

  if (error) {
    logDbError("loadTournamentIdentity", error);
    return null;
  }
  if (!data) return null;

  return {
    tournamentId: data.id,
    name: data.name ?? "",
    logoUrl: data.logo_url ?? "",
  };
}

// NEW — matchId-keyed variant for callers (like OverlayAdminConsole)
// that only have matchId in hand, not tournamentId directly. Mirrors
// exactly what getOrCreateMatch already does internally for the
// overlay display page: read matches.tournament_id, then resolve the
// real tournament row. Returns null for a standalone match (no
// tournament_id on the row) — same "null means standalone" contract
// TournamentIdentity already documents.
export async function loadTournamentIdentityForMatch(matchId: string): Promise<TournamentIdentity | null> {
  const { data, error } = await supabase
    .from("matches")
    .select("tournament_id")
    .eq("id", matchId)
    .maybeSingle();

  if (error) {
    logDbError("loadTournamentIdentityForMatch select", error);
    return null;
  }
  if (!data?.tournament_id) return null;

  return loadTournamentIdentity(data.tournament_id);
}

// ─────────────────────────────────────────────────────────────
// Bracket team fallback for tournament matches whose real team
// assignment lives on bracket_matches.team_a_id/team_b_id -> teams
// rather than in match_setup. Bracket data wins whenever it has a
// named team for a side; match_setup's own teamA/teamB (admin-entered
// extras: custom colors, squads, logo overrides) only fills in a side
// the bracket lookup doesn't have. Friendly matches have no
// bracket_match_id, so this is a guaranteed no-op for them.
// ─────────────────────────────────────────────────────────────

interface BracketTeamFallback {
  teamA: Partial<TeamInfo>;
  teamB: Partial<TeamInfo>;
  venue?: string;
}

async function loadBracketTeamFallback(bracketMatchId: string): Promise<BracketTeamFallback | null> {
  const { data: bracketRow, error } = await supabase
    .from("bracket_matches")
    .select("team_a_id, team_b_id, venue")
    .eq("id", bracketMatchId)
    .maybeSingle();

  if (error) {
    logDbError("loadBracketTeamFallback bracket_matches", error);
    return null;
  }
  if (!bracketRow) return null;

  const teamIds = [bracketRow.team_a_id, bracketRow.team_b_id].filter(Boolean) as string[];
  if (teamIds.length === 0) return null;

  const { data: teamRows, error: teamsErr } = await supabase
    .from("teams")
    .select("id, name, code, color, logo")
    .in("id", teamIds);

  if (teamsErr) {
    logDbError("loadBracketTeamFallback teams", teamsErr);
    return null;
  }

  const byId = new Map((teamRows ?? []).map((t) => [t.id, t]));
  const a = bracketRow.team_a_id ? byId.get(bracketRow.team_a_id) : undefined;
  const b = bracketRow.team_b_id ? byId.get(bracketRow.team_b_id) : undefined;

  if (!a && !b) return null;

  return {
    teamA: a ? { name: a.name, shortCode: a.code, color: a.color, logoUrl: a.logo ?? "" } : {},
    teamB: b ? { name: b.name, shortCode: b.code, color: b.color, logoUrl: b.logo ?? "" } : {},
    venue: bracketRow.venue ?? undefined,
  };
}

async function applyBracketTeamFallback(
  matchSetup: MatchSetup,
  bracketMatchId: string | null
): Promise<MatchSetup> {
  if (!bracketMatchId) return matchSetup;

  const fallback = await loadBracketTeamFallback(bracketMatchId);
  if (!fallback) return matchSetup;

  const bracketHasA = !!fallback.teamA?.name?.trim();
  const bracketHasB = !!fallback.teamB?.name?.trim();

  return {
    ...matchSetup,
    teamA: bracketHasA ? { ...matchSetup.teamA, ...fallback.teamA } : matchSetup.teamA,
    teamB: bracketHasB ? { ...matchSetup.teamB, ...fallback.teamB } : matchSetup.teamB,
    venue: fallback.venue?.trim() ? fallback.venue : matchSetup.venue,
  };
}

// ─────────────────────────────────────────────────────────────
// REVERSE MERGE — overlay MatchSetup (teamA/teamB) → whatever raw shape
// currently lives on the row, preserving everything the Match Editor
// owns (squads, officials, rosterLocked, round, playerId links, etc).
// ─────────────────────────────────────────────────────────────

function splitKickoffTime(kickoffTime: string): { date?: string; time?: string } {
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const isoTime = /^\d{2}:\d{2}(:\d{2})?$/;
  const parts = kickoffTime.trim().split(/\s+/);
  if (parts.length === 2 && isoDate.test(parts[0]) && isoTime.test(parts[1])) {
    return { date: parts[0], time: parts[1] };
  }
  if (parts.length === 1 && isoDate.test(parts[0])) {
    return { date: parts[0] };
  }
  if (parts.length === 1 && isoTime.test(parts[0])) {
    return { time: parts[0] };
  }
  return {};
}

function tossWinnerLetterToName(
  letter: MatchSetup["tossWinner"],
  base: Record<string, any>,
  overlaySetup: MatchSetup
): string {
  if (letter === "A") return base.team1?.name || overlaySetup.teamA.name || "";
  if (letter === "B") return base.team2?.name || overlaySetup.teamB.name || "";
  return "";
}

export function mergeOverlaySetupIntoRaw(
  raw: Record<string, any> | null,
  overlaySetup: MatchSetup
): Record<string, any> {
  const base = raw ?? {};
  const { date, time } = splitKickoffTime(overlaySetup.kickoffTime || "");
  const winnerName = tossWinnerLetterToName(overlaySetup.tossWinner, base, overlaySetup);

  return {
    ...base,

    tournamentName: overlaySetup.tournamentName,
    season: overlaySetup.season,
    tournamentLogoUrl: overlaySetup.tournamentLogoUrl,
    venue: overlaySetup.venue,
    format: overlaySetup.format,
    matchNumber: overlaySetup.matchNumber,
    matchTitle: overlaySetup.matchTitle,
    matchMeta: overlaySetup.matchMeta,
    tournament: overlaySetup.tournament,

    ...(date ? { date } : {}),
    ...(time ? { time } : {}),
    kickoffTime: overlaySetup.kickoffTime,

    tossWinner: winnerName,
    tossDecision: overlaySetup.tossDecision,
    toss:
      overlaySetup.tossWinner && overlaySetup.tossDecision
        ? `${winnerName} won the toss and elected to ${overlaySetup.tossDecision === "bat" ? "bat" : "bowl"}`
        : base.toss ?? "",

    team1: {
      ...(base.team1 ?? {}),
      name: overlaySetup.teamA.name,
      short: overlaySetup.teamA.shortCode,
      logo: overlaySetup.teamA.logoUrl,
      color: overlaySetup.teamA.color,
    },
    team2: {
      ...(base.team2 ?? {}),
      name: overlaySetup.teamB.name,
      short: overlaySetup.teamB.shortCode,
      logo: overlaySetup.teamB.logoUrl,
      color: overlaySetup.teamB.color,
    },

    // NOTE: overlaySetup.teamA/teamB.squadPlayers deliberately NOT
    // merged into `squads` here — see prior notes on reconciliation
    // needing playerId-vs-"manual:" matching, same as TeamRosterPicker.
  };
}

// ── getOrCreateMatch result — now distinguishes "no match, no error"
// from "a query actually failed," so callers can show something
// truthful instead of quietly rendering default placeholder state
// forever. `error` carries the raw Postgres/Supabase error fields for
// display/logging by the caller.
export interface GetOrCreateMatchResult {
  match: MatchRow | null;
  error: { context: string; message: string; code?: string; hint?: string } | null;
}

function toResultError(context: string, error: unknown): GetOrCreateMatchResult["error"] {
  const e = error as Record<string, unknown> | null;
  return {
    context,
    message: (e?.message as string) ?? "Unknown error",
    code: e?.code as string | undefined,
    hint: e?.hint as string | undefined,
  };
}

export async function getOrCreateMatch(auctionId: string): Promise<GetOrCreateMatchResult> {
  const { data: existing, error: selectErr } = await supabase
    .from("matches")
    .select("id, auction_id, match_setup, match_setup_completed, bracket_match_id, tournament_id")
    .eq("auction_id", auctionId)
    .maybeSingle();

  if (selectErr) {
    logDbError("getOrCreateMatch select", selectErr);
    return { match: null, error: toResultError("select", selectErr) };
  }

  if (existing) {
    const normalized = normalizeMatchSetup(existing.match_setup);
    const resolved = await applyBracketTeamFallback(normalized, existing.bracket_match_id ?? null);
    const tournament = existing.tournament_id
      ? await loadTournamentIdentity(existing.tournament_id)
      : null;
    return { match: { ...existing, match_setup: resolved, tournament } as MatchRow, error: null };
  }

  const { data: created, error: insertErr } = await supabase
    .from("matches")
    .insert({ auction_id: auctionId, match_setup: EMPTY_MATCH_SETUP, match_setup_completed: false })
    .select("id, auction_id, match_setup, match_setup_completed")
    .single();

  if (insertErr) {
    // FIX — unique_violation (23505) on auction_id means a concurrent
    // request already inserted the row between our select and our
    // insert (two tabs/renders racing getOrCreateMatch for the same
    // auction). That's not a real failure — re-select and return the
    // row that now exists instead of reporting an error.
    if ((insertErr as unknown as Record<string, unknown>).code === "23505") {
      const { data: raced, error: raceSelectErr } = await supabase
        .from("matches")
        .select("id, auction_id, match_setup, match_setup_completed, bracket_match_id, tournament_id")
        .eq("auction_id", auctionId)
        .maybeSingle();

      if (raceSelectErr || !raced) {
        logDbError("getOrCreateMatch insert-race re-select", raceSelectErr ?? "no row found after 23505");
        return { match: null, error: toResultError("insert-race", raceSelectErr ?? insertErr) };
      }

      const normalized = normalizeMatchSetup(raced.match_setup);
      const resolved = await applyBracketTeamFallback(normalized, raced.bracket_match_id ?? null);
      const tournament = raced.tournament_id ? await loadTournamentIdentity(raced.tournament_id) : null;
      return { match: { ...raced, match_setup: resolved, tournament } as MatchRow, error: null };
    }

    logDbError("getOrCreateMatch insert", insertErr);
    return { match: null, error: toResultError("insert", insertErr) };
  }

  return {
    match: { ...created, match_setup: normalizeMatchSetup(created.match_setup), tournament: null } as MatchRow,
    error: null,
  };
}

// ── saveMatchSetup — reads whatever is currently on the row, and if
// it's in the friendly-match (team1/team2) shape, merges the overlay's
// edits back into that shape via mergeOverlaySetupIntoRaw instead of
// replacing it wholesale. Prevents a blind overwrite from destroying
// Match Editor data (squads, officials, rosterLocked, etc).
export async function saveMatchSetup(
  auctionId: string,
  matchSetup: MatchSetup,
  matchSetupCompleted: boolean
): Promise<boolean> {
  const { data: existingRow, error: selectErr } = await supabase
    .from("matches")
    .select("match_setup")
    .eq("auction_id", auctionId)
    .maybeSingle();

  if (selectErr) {
    logDbError("saveMatchSetup select (pre-merge)", selectErr);
  }

  const rawExisting = (existingRow?.match_setup as Record<string, any> | undefined) ?? null;

  const toPersist = isFriendlyMatchShape(rawExisting)
    ? mergeOverlaySetupIntoRaw(rawExisting, matchSetup)
    : matchSetup;

  const { error } = await supabase
    .from("matches")
    .upsert(
      {
        auction_id: auctionId,
        match_setup: toPersist,
        match_setup_completed: matchSetupCompleted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "auction_id" }
    );

  if (error) {
    logDbError("saveMatchSetup", error);
    return false;
  }
  return true;
}

// ── match_state (LiveState) ──────────────────────────────────────────
export async function loadLiveState(matchId: string): Promise<LiveState | null> {
  const { data, error } = await supabase
    .from("match_state")
    .select("live_state")
    .eq("match_id", matchId)
    .maybeSingle();

  if (error) {
    logDbError("loadLiveState", error);
    return null;
  }
  return (data?.live_state as LiveState) ?? null;
}

export async function saveLiveState(matchId: string, liveState: LiveState): Promise<boolean> {
  const { error } = await supabase
    .from("match_state")
    .upsert(
      { match_id: matchId, live_state: liveState, updated_at: new Date().toISOString() },
      { onConflict: "match_id" }
    );

  if (error) {
    logDbError("saveLiveState", error);
    return false;
  }
  return true;
}

// ── engine_state (EngineSyncState) ───────────────────────────────────

export async function loadEngineState(matchId: string): Promise<EngineSyncState | null> {
  const { data, error } = await supabase
    .from("engine_state")
    .select("state")
    .eq("match_id", matchId)
    .maybeSingle();

  if (error) {
    logDbError("loadEngineState", error);
    return null;
  }
  return (data?.state as EngineSyncState) ?? null;
}

export async function saveEngineState(matchId: string, state: EngineSyncState): Promise<boolean> {
  const { error } = await supabase
    .from("engine_state")
    .upsert(
      { match_id: matchId, state, updated_at: new Date().toISOString() },
      { onConflict: "match_id" }
    );

  if (error) {
    logDbError("saveEngineState", error);
    return false;
  }
  return true;
}

export async function clearEngineState(matchId: string): Promise<boolean> {
  const { error } = await supabase.from("engine_state").delete().eq("match_id", matchId);
  if (error) {
    logDbError("clearEngineState", error);
    return false;
  }
  return true;
}

// ── weather_readings ──────────────────────────────────────────────────

export interface WeatherCoords {
  latitude: number;
  longitude: number;
}

export async function loadWeather(
  matchId: string
): Promise<{ data: WeatherData; coords: WeatherCoords | null } | null> {
  const { data, error } = await supabase
    .from("weather_readings")
    .select("data, coords")
    .eq("match_id", matchId)
    .maybeSingle();

  if (error) {
    logDbError("loadWeather", error);
    return null;
  }
  if (!data) return null;
  return { data: data.data as WeatherData, coords: (data.coords as WeatherCoords) ?? null };
}

export async function saveWeather(
  matchId: string,
  weather: WeatherData,
  coords?: WeatherCoords
): Promise<boolean> {
  const { error } = await supabase
    .from("weather_readings")
    .upsert(
      {
        match_id: matchId,
        data: weather,
        coords: coords ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "match_id" }
    );

  if (error) {
    logDbError("saveWeather", error);
    return false;
  }
  return true;
}

// ── on_air_channels ───────────────────────────────────────────────────

export async function loadOnAirChannels(matchId: string): Promise<ChannelVisibility | null> {
  const { data, error } = await supabase
    .from("on_air_channels")
    .select("channels")
    .eq("match_id", matchId)
    .maybeSingle();

  if (error) {
    logDbError("loadOnAirChannels", error);
    return null;
  }
  return (data?.channels as ChannelVisibility) ?? null;
}

export async function saveOnAirChannels(matchId: string, channels: Record<string, boolean>): Promise<boolean> {
  const { error } = await supabase
    .from("on_air_channels")
    .upsert(
      { match_id: matchId, channels, updated_at: new Date().toISOString() },
      { onConflict: "match_id" }
    );

  if (error) {
    logDbError("saveOnAirChannels", error);
    return false;
  }
  return true;
}

// ── tournament_standings ────────────────────────────────────────────

export interface StandingRow {
  team_short: string;
  team_name: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  no_result: number;
  points: number;
  nrr: number;
}

