import { supabase } from "@/lib/supabse";
import type {
  MatchSetup,
  LiveState,
  WeatherData,
  ChannelVisibility,
} from "@/lib/overlayBus";
import type { EngineSyncState } from "@/hooks/useLiveScoringEngine";

// ── matches ────────────────────────────────────────────────────────────
// Every read/write below is keyed by auctionId, not the internal uuid —
// callers never need to know the row id exists. getOrCreateMatch() is the
// one function that resolves auctionId -> uuid; everything else takes
// auctionId directly and resolves internally so callsites stay simple.

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
}

// Fire-and-forget by design — callers don't await this on the scoring
// hot path (recordBall/resolveWicket already committed local state and
// broadcast before this resolves). A failed insert here means a gap in
// the DB ledger, not a broken UI.
export async function appendBall(matchId: string, ball: BallInsert): Promise<boolean> {
  const { error } = await supabase.from("balls").insert({
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
  });

  if (error) {
    console.error("[matchPersistence] appendBall failed:", error);
    return false;
  }
  return true;
}

// Deletes exactly one row — the delivery undo() just reverted past.
// Keyed by (match_id, innings_number, sequence), matching the unique
// constraint on the table, so this can never accidentally delete more
// than one row.
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
    console.error("[matchPersistence] deleteLastBall failed:", error);
    return false;
  }
  return true;
}

// Wipes the entire ledger for a match — used on Restart Match, alongside
// clearEngineState(). Innings-scoped rows are covered too since this
// deletes by match_id only, not per-innings.
export async function deleteAllBalls(matchId: string): Promise<boolean> {
  const { error } = await supabase.from("balls").delete().eq("match_id", matchId);
  if (error) {
    console.error("[matchPersistence] deleteAllBalls failed:", error);
    return false;
  }
  return true;
}

export interface MatchRow {
  id: string;
  auction_id: string;
  match_setup: MatchSetup;
  match_setup_completed: boolean;
}

export async function getOrCreateMatch(auctionId: string): Promise<MatchRow | null> {
  const { data: existing, error: selectErr } = await supabase
    .from("matches")
    .select("id, auction_id, match_setup, match_setup_completed")
    .eq("auction_id", auctionId)
    .maybeSingle();

  if (selectErr) {
    console.error("[matchPersistence] getOrCreateMatch select failed:", selectErr);
    return null;
  }
  if (existing) return existing as MatchRow;

  const { data: created, error: insertErr } = await supabase
    .from("matches")
    .insert({ auction_id: auctionId, match_setup: EMPTY_MATCH_SETUP, match_setup_completed: false })
    .select("id, auction_id, match_setup, match_setup_completed")
    .single();

  if (insertErr) {
    console.error("[matchPersistence] getOrCreateMatch insert failed:", insertErr);
    return null;
  }
  return created as MatchRow;
}

// Mirrors emptyMatchSetup in page.tsx — duplicated here (not imported)
// because page.tsx's version isn't exported. Only used as the seed row
// for a brand-new auctionId; every subsequent read returns the real data.
const EMPTY_MATCH_SETUP: MatchSetup = {
  tournamentName: "",
  season: "",
  tournamentLogoUrl: "",
  venue: "",
  format: "T20",
  matchNumber: "",
  matchTitle: "",
  teamA: { name: "", shortCode: "", color: "#c9971f", logoUrl: "", squad: [], squadPlayers: [] },
  kickoffTime: "",
  teamB: { name: "", shortCode: "", color: "#c9971f", logoUrl: "", squad: [], squadPlayers: [] },
  matchMeta: "",
  tournament: "",
  tossWinner: "",
  tossDecision: "",
};

export async function saveMatchSetup(
  auctionId: string,
  matchSetup: MatchSetup,
  matchSetupCompleted: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from("matches")
    .update({
      match_setup: matchSetup,
      match_setup_completed: matchSetupCompleted,
      updated_at: new Date().toISOString(),
    })
    .eq("auction_id", auctionId);

  if (error) {
    console.error("[matchPersistence] saveMatchSetup failed:", error);
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
    console.error("[matchPersistence] loadLiveState failed:", error);
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
    console.error("[matchPersistence] saveLiveState failed:", error);
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
    console.error("[matchPersistence] loadEngineState failed:", error);
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
    console.error("[matchPersistence] saveEngineState failed:", error);
    return false;
  }
  return true;
}

export async function clearEngineState(matchId: string): Promise<boolean> {
  const { error } = await supabase.from("engine_state").delete().eq("match_id", matchId);
  if (error) {
    console.error("[matchPersistence] clearEngineState failed:", error);
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
    console.error("[matchPersistence] loadWeather failed:", error);
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
    console.error("[matchPersistence] saveWeather failed:", error);
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
    console.error("[matchPersistence] loadOnAirChannels failed:", error);
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
    console.error("[matchPersistence] saveOnAirChannels failed:", error);
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

export async function loadStandings(tournamentId: string): Promise<StandingRow[]> {
  const { data, error } = await supabase
    .from("tournament_standings")
    .select("team_short, team_name, played, won, lost, tied, no_result, points, nrr")
    .eq("tournament_id", tournamentId)
    .order("points", { ascending: false })
    .order("nrr", { ascending: false });

  if (error) {
    console.error("[matchPersistence] loadStandings failed:", error);
    return [];
  }
  return (data as StandingRow[]) ?? [];
}

export async function upsertStandingRow(
  tournamentId: string,
  row: StandingRow
): Promise<boolean> {
  const { error } = await supabase
    .from("tournament_standings")
    .upsert({ tournament_id: tournamentId, ...row }, { onConflict: "tournament_id,team_short" });

  if (error) {
    console.error("[matchPersistence] upsertStandingRow failed:", error);
    return false;
  }
  return true;
}