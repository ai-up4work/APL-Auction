import { supabase } from "@/lib/supabase";
import type {
  MatchSetup,
  LiveState,
  WeatherData,
  ChannelVisibility,
  SquadPlayer,
} from "@/lib/overlayBus";
import type { EngineSyncState } from "@/hooks/useLiveScoringEngine";

// ── error logging helper ────────────────────────────────────────────
// PostgrestError instances often print as `{}` when passed as a second
// console.error argument (Next's dev overlay can't serialize the class
// instance's non-plain-enumerable shape in every case). Destructuring
// the fields we care about guarantees we always see something useful —
// message, details, hint, and the Postgres error code (e.g. 42501 =
// insufficient_privilege, which is the classic "forgot to GRANT after
// creating tables via the SQL editor" error).
function logDbError(context: string, error: unknown) {
  try {
    const e = error as Record<string, unknown> | null;
    console.error(`[matchPersistence] ${context} failed — raw:`, error);
    console.error(`[matchPersistence] ${context} failed — typeof:`, typeof error);
    console.error(`[matchPersistence] ${context} failed — keys:`, error && typeof error === "object" ? Object.keys(error) : null);

    // Circular-safe stringify — the old plain JSON.stringify threw when the
    // error object had a circular `cause`/`response` chain (common in fetch
    // and some Postgrest errors), which crashed BEFORE the `fields:` log
    // below ever ran — so you never actually saw message/code/hint.
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
    logDbError("appendBall", error);
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
    logDbError("deleteLastBall", error);
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
    logDbError("deleteAllBalls", error);
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

// Mirrors emptyMatchSetup in page.tsx — duplicated here (not imported)
// because page.tsx's version isn't exported. Only used as the seed row
// for a brand-new auctionId; every subsequent read returns the real data.
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
//   1. The Match Editor / createFriendlyMatch flow
//      (app/(protected)/match/[matchId]/edit/page.tsx, and
//      lib/organization/organization.ts), which writes
//      { team1, team2, round, venue, date, time, toss, overs, officials,
//        squads, rosterLocked, matchTitle, matchNumber, matchMeta,
//        tossWinner, tossDecision, tournament, tournamentLogoUrl, ... }.
//      `tossWinner` there is a TEAM NAME string, and `squads` can be
//      either the flat auction-import shape or the grouped
//      { teamId, captain, players } shape the editor itself saves.
//   2. This overlay admin flow, which reads/writes the real MatchSetup
//      shape: { teamA, teamB, tossWinner: "A"|"B"|"", tournamentName, ... }.
// A friendly match's `id` doubles as its `auction_id` (see
// createFriendlyMatch), so visiting /overlay/{friendlyMatchId} resolves
// straight to that row via getOrCreateMatch — but its match_setup is
// still team1/team2-shaped at that point. Without normalizing here,
// every consumer of MatchRow (OverlayAdminPage first among them) would
// read `matchSetup.teamA.name` off an object that only has `team1`, and
// crash.
//
// IMPORTANT: this must map EVERY field the Match Editor can set, not
// just a handful — a previous version of this function only carried
// over venue/round/team-names, silently dropping colors, logos,
// squads, match number/meta, toss winner/decision, tournament ref, and
// kickoff time on every read. That made it look like the Match Editor
// "wasn't saving" those fields, when really the save was fine and only
// this projection was incomplete.
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
//   - GROUPED (what the editor saves): [{ teamId: "team1"|"team2", captain, players: [{name, role, xi, playerId}] }]
//   - FLAT (what createFriendlyMatch writes pre-edit): [{ name, role, team: "<short code>", captain? }]
// Extracts just the named players for one side as overlay SquadPlayers.
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

  // Flat shape — bucket by short code the same way the editor does,
  // defaulting anything that doesn't clearly match team2 into team1.
  const otherShort = (teamKey === "team1" ? raw.team2?.short : raw.team1?.short) ?? "";
  const wantTeam2 = teamKey === "team2";
  return rawSquads
    .filter((p) => p && typeof p?.name === "string" && p.name.trim())
    .filter((p) => {
      const code = (p.team ?? "").toString().toUpperCase();
      const isTeam2 = !!code && code === (raw.team2?.short ?? "").toString().toUpperCase() && code !== (raw.team1?.short ?? "").toString().toUpperCase();
      return wantTeam2 ? isTeam2 : !isTeam2;
    })
    .map((p) => ({ id: `manual:${p.name}`, name: p.name as string }));
}

// The editor's overs number doesn't map onto anything overlay-side —
// overlay wants an explicit T20/ODI/Test enum. Best-effort guess so the
// overlay's format-dependent UI (e.g. total-overs display) isn't stuck
// on the T20 default for every ODI/Test friendly match.
function guessFormatFromOvers(overs: unknown): MatchSetup["format"] {
  const n = typeof overs === "number" ? overs : Number(overs);
  if (!Number.isFinite(n) || n <= 0) return "T20";
  if (n <= 20) return "T20";
  if (n <= 50) return "ODI";
  return "Test";
}

// `tossWinner` on a friendly match is a team NAME string (e.g.
// "Emberfall Paladins"), but overlay's MatchSetup.tossWinner is the
// letter "A" | "B" | "". Resolve by comparing against team1/team2 name.
function resolveTossWinnerLetter(raw: Record<string, any>): MatchSetup["tossWinner"] {
  const winner = typeof raw.tossWinner === "string" ? raw.tossWinner.trim() : "";
  if (!winner) return "";
  if (winner === (raw.team1?.name ?? "").toString().trim()) return "A";
  if (winner === (raw.team2?.name ?? "").toString().trim()) return "B";
  return "";
}

// Combines the editor's separate date/time fields into overlay's single
// free-text kickoffTime, e.g. "2026-08-14 19:30". Falls back to
// whichever of the two is actually present.
function combineKickoffTime(raw: Record<string, any>): string {
  const date = typeof raw.date === "string" ? raw.date.trim() : "";
  const time = typeof raw.time === "string" ? raw.time.trim() : "";
  if (date && time) return `${date} ${time}`;
  return date || time || "";
}

export function normalizeMatchSetup(raw: unknown): MatchSetup {
  if (isFriendlyMatchShape(raw)) {
    const r = raw as Record<string, any>;
    const squads = Array.isArray(r.squads) ? r.squads : [];
    const team1Short = r.team1?.short ?? "";
    const team2Short = r.team2?.short ?? "";

    const squadPlayersFor = (teamShort: string) =>
      squads
        .filter((p: any) => p.team === teamShort)
        .map((p: any, i: number) => ({
          id: `${teamShort}-${i}`,
          name: p.name,
          imageUrl: p.imageUrl || undefined,
        }));

    const teamAPlayers = squadPlayersFor(team1Short);
    const teamBPlayers = squadPlayersFor(team2Short);

    return {
      ...EMPTY_MATCH_SETUP,
      venue: typeof r.venue === "string" ? r.venue : "",
      matchTitle: typeof r.round === "string" ? r.round : "",
      teamA: {
        ...emptyOverlayTeam(),
        name: r.team1?.name ?? "",
        shortCode: team1Short,
        logoUrl: r.team1?.logo ?? "",
        squadPlayers: teamAPlayers,
        squad: teamAPlayers.map((p) => p.name),
      },
      teamB: {
        ...emptyOverlayTeam(),
        name: r.team2?.name ?? "",
        shortCode: team2Short,
        logoUrl: r.team2?.logo ?? "",
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
// REVERSE MERGE — overlay MatchSetup (teamA/teamB) → whatever raw shape
// currently lives on the row, preserving everything the Match Editor
// owns (squads, officials, rosterLocked, round, playerId links, etc).
//
// This is the inverse of normalizeMatchSetup's friendly-shape branch,
// and it's the actual fix for the "editor data disappears" bug: the
// old saveMatchSetup did a blind `match_setup: matchSetup` upsert,
// which replaced the ENTIRE column with the overlay's much smaller
// teamA/teamB shape the moment anything here saved — including on
// initial hydration (see the hydration-guard fix in the admin page).
//
// Only the fields the overlay page actually edits are written back;
// everything else on the existing row passes through untouched via the
// initial spread of `base`.
// ─────────────────────────────────────────────────────────────

// kickoffTime is combineKickoffTime's output: "<date> <time>", or just
// one of the two, or arbitrary free text typed directly into the
// overlay's Kickoff Time field. Only split back into date/time when it
// matches that exact ISO pattern — if the operator typed something
// free-form ("Starts after lunch break"), we must NOT shove that into
// the editor's <input type="date">/<input type="time"> fields, since
// those inputs will silently reject/clear invalid values and we'd lose
// data on the next Match Editor load. In that case kickoffTime is still
// carried through as its own additive key so nothing is lost.
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

// tossWinner on the overlay side is "A" | "B" | ""; on the friendly
// side it's the actual team name string. Convert using whatever team
// names are currently on the raw row (falling back to the overlay's
// own team names if the raw row has none yet, e.g. a match created
// directly from the overlay admin page with no Match Editor row).
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
    // Preserve everything not explicitly handled below: squads,
    // officials, rosterLocked, round, date/time (unless overridden
    // just below), playerId links, org-specific keys, etc.
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

    // Only overwrite date/time if kickoffTime actually parsed as one of
    // them — otherwise leave whatever the editor already had untouched.
    ...(date ? { date } : {}),
    ...(time ? { time } : {}),
    // Always carry the raw kickoffTime string through too, additively,
    // so free-text entries aren't lost even when they don't parse.
    kickoffTime: overlaySetup.kickoffTime,

    // toss — same de-duplication pattern the Match Editor itself uses:
    // tossWinner/tossDecision are the source of truth, `toss` is derived.
    tossWinner: winnerName,
    tossDecision: overlaySetup.tossDecision,
    toss:
      overlaySetup.tossWinner && overlaySetup.tossDecision
        ? `${winnerName} won the toss and elected to ${overlaySetup.tossDecision === "bat" ? "bat" : "bowl"}`
        : base.toss ?? "",

    // Merge team fields — preserve any existing team1/team2 keys this
    // function doesn't know about, rather than replacing the objects
    // outright.
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

    // NOTE: overlaySetup.teamA/teamB.squadPlayers are deliberately NOT
    // merged into `squads` here. The editor's `squads` carries playerId
    // links, xi/roles, and captain — merging the overlay's simpler
    // {id,name,imageUrl} list back in would need its own reconciliation
    // pass (matching by playerId vs "manual:" ids) to avoid duplicating
    // or dropping data, same as TeamRosterPicker already has to do on
    // read. Leaving `squads` untouched here means the Match Editor
    // stays the source of truth for roster edits; the overlay's own
    // squadPlayers selection still round-trips fine because it's read
    // fresh from `players`/`teams` via useAuctionRoster, not from this
    // merged blob.
  };
}

export async function getOrCreateMatch(auctionId: string): Promise<MatchRow | null> {
  const { data: existing, error: selectErr } = await supabase
    .from("matches")
    .select("id, auction_id, match_setup, match_setup_completed")
    .eq("auction_id", auctionId)
    .maybeSingle();

  if (selectErr) {
    logDbError("getOrCreateMatch select", selectErr);
    return null;
  }
  if (existing) {
    return { ...existing, match_setup: normalizeMatchSetup(existing.match_setup) } as MatchRow;
  }

  const { data: created, error: insertErr } = await supabase
    .from("matches")
    .insert({ auction_id: auctionId, match_setup: EMPTY_MATCH_SETUP, match_setup_completed: false })
    .select("id, auction_id, match_setup, match_setup_completed")
    .single();

  if (insertErr) {
    logDbError("getOrCreateMatch insert", insertErr);
    return null;
  }
  return { ...created, match_setup: normalizeMatchSetup(created.match_setup) } as MatchRow;
}

// ── CHANGED — was a blind overwrite of the whole match_setup column
// with whatever shape the caller passed in (always the overlay's
// teamA/teamB shape). That silently destroyed Match Editor data
// (team1/team2, squads, officials, rosterLocked, matchMeta, round,
// playerId links, ...) the first time this ran against a friendly
// match's row — including on initial page hydration, before the user
// had touched anything.
//
// Now: read whatever is currently on the row, and if it's in the
// friendly-match (team1/team2) shape, merge the overlay's edits back
// into that shape via mergeOverlaySetupIntoRaw instead of replacing it
// wholesale. If the row is already in the overlay's own shape (or
// doesn't exist yet), write matchSetup through as-is — nothing to
// preserve in that case.
//
// This still always writes the real overlay teamA/teamB VIEW into the
// in-memory object the admin page holds (that part is unchanged and
// lives in normalizeMatchSetup on read) — this function only changes
// what actually gets persisted to Postgres.
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
    // Log and fall through with no merge base rather than aborting the
    // whole save — better to write matchSetup as-is than to drop the
    // user's edit entirely because of a transient read failure.
    logDbError("saveMatchSetup select (pre-merge)", selectErr);
  }

  const rawExisting = (existingRow?.match_setup as Record<string, any> | undefined) ?? null;

  const toPersist = isFriendlyMatchShape(rawExisting)
    ? mergeOverlaySetupIntoRaw(rawExisting, matchSetup)
    : matchSetup;

  // upsert on the unique auction_id column recreates the row if it's
  // somehow missing instead of no-op'ing, same reasoning as before:
  // a plain .update() against a missing row succeeds with 0 rows
  // affected and NO error, which would make saves silently vanish.
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