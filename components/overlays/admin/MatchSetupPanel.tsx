"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MatchSetup, SquadPlayer, TeamInfo } from "@/lib/overlayBus";
import { ImageUploader } from "./ImageUploader";
import { DrawerSection, Eyebrow, FieldLabel, Input, TextField, SelectField, ColorField, LinkBtn, SmallButton, PrimaryButton, StatusPill } from "./ui";

import { LocationAutocompleteInput } from "./LocationAutocomplete";
import type { GeocodeMatch } from "@/lib/fetchVenueWeather";

// ── Roster source ────────────────────────────────────────────────────
interface RosterRow {
  id: string;
  name: string;
  image_url: string | null;
  role: string | null;
  team_id: string | null;
}

type RosterState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "ready"; byTeamId: Map<string, RosterRow[]> };

// Guards against undefined / null / the literal string "null" — any of
// these reaching supabase.eq("auction_id", ...) blows up with
// `invalid input syntax for type uuid` since PostgREST sends it as text.
function isValidAuctionId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id !== "null" && id !== "undefined";
}

function useAuctionRoster(auctionId: string | null | undefined): RosterState {
  const [state, setState] = useState<RosterState>({ status: "loading" });

  useEffect(() => {
    if (!isValidAuctionId(auctionId)) {
      // Nothing to query yet (e.g. still hydrating upstream) — don't
      // fire a request that Postgres will reject.
      setState({ status: "empty" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    supabase
      .from("players")
      .select("id,name,img,role,sold_to_team_id,status")
      .eq("auction_id", auctionId)
      .eq("status", "sold")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          // eslint-disable-next-line no-console
          console.error("[useAuctionRoster] players query failed:", JSON.stringify(error, null, 2));
          setState({ status: "error" });
          return;
        }
        if (data.length === 0) {
          setState({ status: "empty" });
          return;
        }
        // console.log("[useAuctionRoster] got", JSON.stringify(data, null, 2));
        const byTeamId = new Map<string, RosterRow[]>();
        for (const row of data as any[]) {
          const key = row.sold_to_team_id ?? "unassigned";
          if (!byTeamId.has(key)) byTeamId.set(key, []);
          byTeamId.get(key)!.push({
            id: row.id,
            name: row.name ?? "Unnamed",
            image_url: row.img || null,
            role: row.role,
            team_id: row.sold_to_team_id,
          });        }
        setState({ status: "ready", byTeamId });
      });

    return () => {
      cancelled = true;
    };
  }, [auctionId]);

  return state;
}

// ── Teams source ─────────────────────────────────────────────────────
interface DbTeamRow {
  id: string;
  code: string;
  name: string;
  color: string;
  logo: string | null;
  tier: string;
  owner: string;
  remaining_purse: number | null;
}

type TeamsDbState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "ready"; teams: DbTeamRow[] };

function useAuctionTeams(auctionId: string | null | undefined): TeamsDbState {
  const [state, setState] = useState<TeamsDbState>({ status: "loading" });

  useEffect(() => {
    if (!isValidAuctionId(auctionId)) {
      setState({ status: "empty" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    supabase
      .from("teams")
      .select("id,code,name,color,logo,tier,owner,remaining_purse")
      .eq("auction_id", auctionId)
      .order("code")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          // eslint-disable-next-line no-console
          console.error("[useAuctionTeams] teams query failed:", JSON.stringify(error, null, 2));
          setState({ status: "error" });
          return;
        }
        if (data.length === 0) {
          setState({ status: "empty" });
          return;
        }
        setState({ status: "ready", teams: data as DbTeamRow[] });
      });

    return () => {
      cancelled = true;
    };
  }, [auctionId]);

  return state;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function rosterPlayersForTeamId(roster: RosterState, teamId: string): SquadPlayer[] {
  if (roster.status !== "ready") return [];
  const rows = roster.byTeamId.get(teamId) ?? [];
  return rows.map((r) => ({ id: r.id, name: r.name, imageUrl: r.image_url ?? undefined }));
}

// ── resolve a missing teamId from name/shortCode ────────────────
// Older/pre-existing matches can have `matchSetup.teamA/B.name` and
// `.shortCode` saved (e.g. typed manually, or saved before `teamId` was
// part of the shape) but no `teamId` at all. Without a bound teamId,
// nothing can ever look up that team's roster automatically — the user
// would be stuck re-picking the team from the dropdown on every single
// admin page load, even though the DB unambiguously has a matching team
// row already. This does a best-effort match against the auction's own
// teams table (already scoped by auction_id via useAuctionTeams) so we
// only need `code` and/or `name` to line up, not a stored id.
function resolveTeamId(team: TeamInfo, teamsState: TeamsDbState): string | undefined {
  if (team.teamId) return team.teamId;
  if (teamsState.status !== "ready") return undefined;
  if (!team.shortCode && !team.name) return undefined;

  const match = teamsState.teams.find(
    (t) =>
      (team.shortCode && t.code === team.shortCode) ||
      (team.name && t.name === team.name)
  );
  return match?.id;
}

function MutedNote({ tone = "neutral", children }: { tone?: "neutral" | "warning"; children: React.ReactNode }) {
  return (
    <p
      className="text-[10px]"
      style={{ fontFamily: "var(--font-label-mono)", color: tone === "warning" ? "var(--color-warning)" : "var(--color-outline)" }}
    >
      {children}
    </p>
  );
}

// ── DB team picker ────────────────────────────────────────────────────
function TeamDbSelect({
  teamsState,
  roster,
  excludeTeamId,
  onApply,
}: {
  teamsState: TeamsDbState;
  roster: RosterState;
  excludeTeamId?: string;
  onApply: (patch: Partial<TeamInfo>) => void;
}) {
  if (teamsState.status === "loading") {
    return <MutedNote>Loading teams…</MutedNote>;
  }
  if (teamsState.status === "error") {
    return <MutedNote tone="warning">Couldn&apos;t reach the teams table — fill in details manually.</MutedNote>;
  }
  if (teamsState.status === "empty") {
    return <MutedNote>No teams found for this auction — fill in details manually.</MutedNote>;
  }

  const options = teamsState.teams.filter((t) => t.id !== excludeTeamId);

  return (
    <select
      className="select-input select-input-compact"
      defaultValue=""
        onChange={(e) => {
          const team = teamsState.teams.find((t) => t.id === e.target.value);
          if (!team) return;

          // DEBUG — remove after diagnosing
          console.log("[team select] picked team.id =", team.id,
            "roster status =", roster.status,
            "roster keys =", roster.status === "ready" ? Array.from(roster.byTeamId.keys()) : "n/a");

          const squadPlayers = rosterPlayersForTeamId(roster, team.id);
          onApply({
          teamId: team.id,
          name: team.name,
          shortCode: team.code,
          color: team.color,
          logoUrl: team.logo ?? "",
          ...(squadPlayers.length ? { squadPlayers, squad: squadPlayers.map((p) => p.name) } : {}),
        });
        e.target.value = "";
      }}
    >
      <option value="" disabled>
        Load team from database…
      </option>
      {options.map((t) => (
        <option key={t.id} value={t.id}>
          {t.code} — {t.name}
        </option>
      ))}
    </select>
  );
}

// ── One team's roster picker ─────────────────────────────────────────
//
// CHANGES from the original version:
//
// 1. Manual player entry REMOVED from this panel entirely. Squads here
//    are meant to be picked from players who already exist in the
//    `players` table for this auction/team — typing a brand-new name
//    in here used to create an ad-hoc "manual:<name>" entry with no
//    backing DB row, which is exactly the kind of record the Match
//    Editor's sync path (syncSquadsToPlayers) and the Auctions tab
//    already own. Adding players now only happens from those two
//    places; this panel just SELECTS from what's already there, plus a
//    short note telling the user where to go if the player they want
//    isn't listed yet.
//
//    Pre-existing "manual:" entries (already in team.squadPlayers from
//    before this change, or reconciled in from an older friendly-match
//    import) still render and can still be toggled OUT of today's
//    squad — that's just excluding them from selection, not deleting
//    the underlying record, so it stays allowed. What's gone is the
//    ability to CREATE a new one from this screen.
//
// 2. Chip styling — was relying entirely on external `squad-list` /
//    `squad-chip` / `is-selected` / `is-unselected` classes from
//    globals.css, which were washing unselected chips out to
//    near-invisibility. Replaced with explicit inline styles using the
//    same CSS variable tokens the rest of this file already uses.
//
// 3. Reload/Clear controls — were using the shared <LinkBtn> from
//    ./ui, whose default styling also rendered near-invisible on this
//    panel. Replaced with plain inline-styled buttons scoped to just
//    this component, so this fix can't affect other LinkBtn usages
//    elsewhere that may rely on its current look.
function TeamRosterPicker({
  team,
  onChange,
  roster,
}: {
  team: TeamInfo;
  onChange: (patch: Partial<TeamInfo>) => void;
  roster: RosterState;
}) {
  const selectedIds = useMemo(() => new Set((team.squadPlayers ?? []).map((p) => p.id)), [team.squadPlayers]);

  // Only THIS team's roster rows — not every team's.
  const teamRosterRows = useMemo(() => {
    if (roster.status !== "ready" || !team.teamId) return [];
    return roster.byTeamId.get(team.teamId) ?? [];
  }, [roster, team.teamId]);

  // ── Reconcile stale "manual:Name" squad entries against the real
  // roster once it loads. This happens for squads that came from the
  // Match Editor's friendly-match shape before that player's row had
  // been synced into the `players` table (or before that sync's
  // `playerId` made it back into match_setup) — normalizeMatchSetup
  // has no way to know the real id at that point, so it falls back to
  // a `manual:` placeholder. Left alone, that placeholder can never
  // match the real roster row that shows up here once the roster
  // query resolves, so the same person renders TWICE: once as an
  // unselected/grayed real roster chip, and once as a separate
  // "manual" chip with a remove (×) button — which is exactly what
  // looked like "12 players, 6 selected, 6 not" for a 6-person squad.
  // This swaps the placeholder id for the real one by matching name
  // (case-insensitive), so the roster chip renders as properly
  // selected instead, and de-dupes if both ever ended up present.
  useEffect(() => {
    if (roster.status !== "ready" || !team.teamId) return;
    const rows = roster.byTeamId.get(team.teamId) ?? [];
    if (rows.length === 0) return;

    const current = team.squadPlayers ?? [];
    let changed = false;

    const reconciled = current.map((p) => {
      if (!p.id.startsWith("manual:")) return p;
      const match = rows.find((r) => r.name.trim().toLowerCase() === p.name.trim().toLowerCase());
      if (!match) return p;
      changed = true;
      return { id: match.id, name: match.name, imageUrl: match.image_url ?? undefined };
    });

    if (!changed) return;

    // De-dupe — a real roster chip and a reconciled manual entry could
    // now both point at the same id if the player was somehow present
    // twice already.
    const seen = new Set<string>();
    const deduped = reconciled.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    onChange({ squadPlayers: deduped, squad: deduped.map((p) => p.name) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster.status, team.teamId]);

  const manualPlayers = (team.squadPlayers ?? []).filter((p) => p.id.startsWith("manual:"));

  function reloadFromBoundTeam() {
    if (!team.teamId) return;
    const players = rosterPlayersForTeamId(roster, team.teamId);
    if (!players.length) return;
    onChange({ squadPlayers: players, squad: players.map((p) => p.name) });
  }

  function togglePlayer(player: SquadPlayer) {
    const current = team.squadPlayers ?? [];
    const isIn = current.some((p) => p.id === player.id);
    const next = isIn ? current.filter((p) => p.id !== player.id) : [...current, player];
    onChange({ squadPlayers: next, squad: next.map((p) => p.name) });
  }

  // Still allowed — this removes a pre-existing manual entry from
  // TODAY'S squad (deselects it), it doesn't delete any record. What's
  // removed is the ability to CREATE a new manual entry from here.
  function removeManual(id: string) {
    const next = (team.squadPlayers ?? []).filter((p) => p.id !== id);
    onChange({ squadPlayers: next, squad: next.map((p) => p.name) });
  }

  function clearSquad() {
    onChange({ squadPlayers: [], squad: [] });
  }

  const hasAnyChips = teamRosterRows.length > 0 || manualPlayers.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <FieldLabel>Squad ({selectedIds.size})</FieldLabel>
        <div className="flex items-center gap-4">
          {/* Inline-styled instead of <LinkBtn> — see comment block
              above the component for why. */}
          {team.teamId && roster.status === "ready" && (
            <button
              type="button"
              onClick={reloadFromBoundTeam}
              title="Reload full squad from roster for the bound team"
              style={{
                fontFamily: "var(--font-label-mono)",
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--color-theme-orange)",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                opacity: 1,
              }}
            >
              Reload
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={clearSquad}
              title="Remove everyone from today's squad"
              style={{
                fontFamily: "var(--font-label-mono)",
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--color-error)",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                opacity: 1,
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {roster.status === "loading" && <MutedNote>Loading roster…</MutedNote>}
      {roster.status === "error" && (
        <MutedNote tone="warning">Couldn&apos;t reach the roster table — try again shortly.</MutedNote>
      )}
      {roster.status === "ready" && !team.teamId && (
        <MutedNote>Select a team above to load its roster.</MutedNote>
      )}
      {roster.status === "ready" && team.teamId && teamRosterRows.length === 0 && manualPlayers.length === 0 && (
        <MutedNote>
          No sold players found for this team yet — add players from the{" "}
          <span style={{ color: "var(--color-theme-orange)" }}>Match Editor</span> or the{" "}
          <span style={{ color: "var(--color-theme-orange)" }}>Auctions</span> tab.
        </MutedNote>
      )}

      {/* ── Squad picker — click a card to toggle it in/out of today's
           squad. Inline-styled (not dependent on external squad-list /
           squad-chip classes) so this can't wash out again if those
           classes ever change elsewhere. ── */}
      {hasAnyChips && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            padding: "10px",
            borderRadius: "10px",
            background: "var(--color-surface-container-low)",
            border: "1px solid var(--color-border-overlay)",
          }}
        >
          {teamRosterRows.map((r) => {
            const checked = selectedIds.has(r.id);
            return (
              <button
                type="button"
                key={r.id}
                onClick={() => togglePlayer({ id: r.id, name: r.name, imageUrl: r.image_url ?? undefined })}
                title={checked ? "Remove from today's squad" : "Add to today's squad"}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 10px 6px 6px",
                  borderRadius: "999px",
                  background: checked ? "rgba(201,151,31,0.14)" : "var(--color-surface-container-high)",
                  border: `1px solid ${checked ? "rgba(201,151,31,0.55)" : "var(--color-border-overlay)"}`,
                  opacity: 1,
                  cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s",
                }}
              >
                {checked && (
                  <span
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "var(--color-theme-orange)",
                      color: "#1a1206",
                      fontSize: 10,
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1,
                    }}
                  >
                    ✓
                  </span>
                )}
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    overflow: "hidden",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--color-surface-container-low)",
                  }}
                >
                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        fontFamily: "var(--font-label-mono)",
                        color: "var(--color-outline)",
                      }}
                    >
                      {initials(r.name) || "?"}
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "var(--font-label-mono)",
                    color: checked ? "var(--color-theme-orange)" : "var(--color-on-surface)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.name}
                </span>
              </button>
            );
          })}

          {manualPlayers.map((p) => (
            <div
              key={p.id}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 26px 6px 6px",
                borderRadius: "999px",
                background: "rgba(201,151,31,0.14)",
                border: "1px solid rgba(201,151,31,0.55)",
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--color-surface-container-low)",
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    fontFamily: "var(--font-label-mono)",
                    color: "var(--color-outline)",
                  }}
                >
                  {initials(p.name) || "?"}
                </span>
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "var(--font-label-mono)",
                  color: "var(--color-theme-orange)",
                  whiteSpace: "nowrap",
                }}
              >
                {p.name}
              </span>
              <button
                type="button"
                onClick={() => removeManual(p.id)}
                title="Remove from today's squad"
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: "none",
                  background: "var(--color-error)",
                  color: "var(--color-on-primary)",
                  fontSize: 11,
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  opacity: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <p
        className="text-[9px]"
        style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}
      >
        Need to add a new player? Do that from the Match Editor or the Auctions tab — this panel only picks
        today&apos;s XI from players already on record.
      </p>
    </div>
  );
}

// ── Locked summary strip — replaces the full form once pushed ────────
function LockedSummaryBar({
  matchSetup,
  onEdit,
}: {
  matchSetup: MatchSetup;
  onEdit: () => void;
}) {
  const tossLine =
    matchSetup.tossWinner && matchSetup.tossDecision
      ? `${matchSetup.tossWinner === "A" ? matchSetup.teamA.shortCode || "Team A" : matchSetup.teamB.shortCode || "Team B"} won the toss, elected to ${
          matchSetup.tossDecision === "bat" ? "bat" : "bowl"
        }`
      : null;

  return (
    <div
      className="rounded-xl px-5 py-3.5 flex items-center justify-between gap-4"
      style={{
        background: "var(--color-surface-glass)",
        backdropFilter: "blur(24px)",
        border: "1px solid var(--color-border-overlay)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <StatusPill label="Match Setup · Locked" tone="orange" />
        <span
          className="text-[12px] font-bold truncate"
          style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-on-surface)" }}
        >
          {matchSetup.teamA.shortCode || matchSetup.teamA.name || "Team A"} vs {matchSetup.teamB.shortCode || matchSetup.teamB.name || "Team B"}
        </span>
        {matchSetup.venue && (
          <span className="text-[11px] truncate hidden md:inline" style={{ color: "var(--color-on-surface-variant)" }}>
            · {matchSetup.venue}
          </span>
        )}
        {matchSetup.kickoffTime && (
          <span className="text-[11px] truncate hidden md:inline" style={{ color: "var(--color-on-surface-variant)" }}>
            · {matchSetup.kickoffTime}
          </span>
        )}
        {tossLine && (
          <span className="text-[11px] truncate hidden lg:inline" style={{ color: "var(--color-outline)" }}>
            · {tossLine}
          </span>
        )}
      </div>
      <SmallButton onClick={onEdit}>Edit</SmallButton>
    </div>
  );
}

export default function MatchSetupPanel({
  auctionId,
  matchSetup,
  setMatchSetup,
  onPush,
  pushLabel,
  completed,
  onVenueSelect,
}: {
  auctionId: string | null | undefined;
  matchSetup: MatchSetup;
  setMatchSetup: React.Dispatch<React.SetStateAction<MatchSetup>>;
  onPush: () => void;
  pushLabel: string;
  completed: boolean;
  onVenueSelect?: (match: GeocodeMatch, displayName?: string) => void;
}) {
  const roster = useAuctionRoster(auctionId);
  const teamsState = useAuctionTeams(auctionId);

  const [locked, setLocked] = useState(completed);
  useEffect(() => {
    if (completed) setLocked(true);
  }, [completed]);

  const [drawerOpen, setDrawerOpen] = useState(true);

  function handlePush() {
    onPush();
    setLocked(true);
  }

  function handleEdit() {
    setLocked(false);
    setDrawerOpen(true);
  }

  function updateTeam(team: "teamA" | "teamB", patch: Partial<TeamInfo>) {
    setMatchSetup((prev) => ({ ...prev, [team]: { ...prev[team], ...patch } }));
  }

  // ── backfill a missing teamId from name/shortCode ─────────────
  // Runs whenever the teams list becomes ready, or the team's own
  // name/shortCode changes. Older/persisted setups that predate `teamId`
  // being part of the saved shape (or that were typed in manually) will
  // have name/shortCode but no teamId — without this, the roster picker
  // below has nothing to key off of and silently shows nothing, forever,
  // until someone manually re-picks the team from the dropdown. This
  // only ever *sets* teamId when it's currently missing; it never
  // overwrites an existing one, so a manual pick always wins.
  useEffect(() => {
    if (teamsState.status !== "ready") return;

    (["teamA", "teamB"] as const).forEach((teamKey) => {
      const team = matchSetup[teamKey];
      if (team.teamId) return; // already bound — nothing to resolve

      const resolved = resolveTeamId(team, teamsState);
      if (!resolved) return;

      setMatchSetup((prev) => ({
        ...prev,
        [teamKey]: { ...prev[teamKey], teamId: resolved },
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    teamsState.status,
    matchSetup.teamA.name,
    matchSetup.teamA.shortCode,
    matchSetup.teamB.name,
    matchSetup.teamB.shortCode,
  ]);

  useEffect(() => {
    if (roster.status !== "ready") return;
    if (locked) return;

    (["teamA", "teamB"] as const).forEach((teamKey) => {
      const team = matchSetup[teamKey];
      if (!team.teamId) return;
      if ((team.squadPlayers ?? []).length > 0) return;

      const players = rosterPlayersForTeamId(roster, team.teamId);
      if (players.length === 0) return;

      setMatchSetup((prev) => ({
        ...prev,
        [teamKey]: {
          ...prev[teamKey],
          squadPlayers: players,
          squad: players.map((p) => p.name),
        },
      }));
    });
    // CHANGED — added the team ids here. teamId can now arrive
    // asynchronously via the resolver effect above (not just via the
    // dropdown's synchronous onApply), so this needs to react to that
    // too, not just to roster.status/locked transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster.status, locked, matchSetup.teamA.teamId, matchSetup.teamB.teamId]);

  if (locked) {
    return <LockedSummaryBar matchSetup={matchSetup} onEdit={handleEdit} />;
  }

  return (
      <DrawerSection
        step="1" title="Match Setup" description="Teams & session — set once, then push"
        done={completed} open={drawerOpen} onOpenChange={setDrawerOpen} >
        {!isValidAuctionId(auctionId) && (
          <p
            className="text-[10px] uppercase tracking-widest"
            style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-warning)" }}
          >
            No auction linked yet — team/roster lookups are disabled until this match has a valid auction_id.
          </p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TextField
          label="Tournament"
          value={matchSetup.tournamentName}
          onChange={(v) => setMatchSetup((p) => ({ ...p, tournamentName: v }))}
          placeholder="e.g. Provincial T20 Cup"
        />
        <TextField
          label="Season"
          value={matchSetup.season}
          onChange={(v) => setMatchSetup((p) => ({ ...p, season: v }))}
          placeholder="e.g. 2026"
        />
        <ImageUploader
          auctionId={auctionId ?? ""}
          kind="team"
          value={matchSetup.tournamentLogoUrl}
          onChange={(url) => setMatchSetup((p) => ({ ...p, tournamentLogoUrl: url }))}
          label="Tournament Logo"
        />

        {/* Free text — deliberately NOT autocomplete-backed. This is a
            display label only ("Akkaraipattu Public Ground", etc.) and
            has no bearing on weather lookups; those are handled entirely
            inside WeatherPanel via its own autocomplete search field.
            Decoupling these two means a venue that isn't in OSM's
            database (small/local grounds) can still be typed here
            freely without needing to resolve anywhere. */}
        <TextField
          label="Venue"
          value={matchSetup.venue}
          onChange={(v) => setMatchSetup((p) => ({ ...p, venue: v }))}
          placeholder="Ground name"
        />

        <SelectField label="Format" value={matchSetup.format} onChange={(v) => setMatchSetup((p) => ({ ...p, format: v as MatchSetup["format"] }))}>
          <option value="T20">T20</option>
          <option value="ODI">ODI</option>
          <option value="Test">Test</option>
        </SelectField>
        <TextField
          label="Match Number"
          value={matchSetup.matchNumber}
          onChange={(v) => setMatchSetup((p) => ({ ...p, matchNumber: v }))}
          placeholder="e.g. Match 14"
        />
        {/* Free text so any local format works ("19:30", "7:30 PM
            IST", "Starts after lunch break", etc.) rather than forcing a
            single timezone-aware time picker. Feeds CricketMatchIntro's
            Kickoff line, which only renders when this is non-empty. */}
        <TextField
          label="Kickoff Time"
          value={matchSetup.kickoffTime}
          onChange={(v) => setMatchSetup((p) => ({ ...p, kickoffTime: v }))}
          placeholder="e.g. 19:30 LOCAL"
        />
        <TextField
          label="Match Title"
          span={1}
          value={matchSetup.matchTitle}
          onChange={(v) => setMatchSetup((p) => ({ ...p, matchTitle: v }))}
          placeholder="e.g. Semi-Final"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(["teamA", "teamB"] as const).map((teamKey) => {
          const team = matchSetup[teamKey];
          const otherKey = teamKey === "teamA" ? "teamB" : "teamA";
          return (
            <div
              key={teamKey}
              className="team-card"
              style={{ ["--team-color" as string]: team.color, position: "relative", isolation: "isolate" }}
            >
              {team.logoUrl && (
                // CHANGED — pinned to position:absolute + z-index:0 +
                // pointer-events:none explicitly. Previously this relied
                // on plain DOM order (watermark rendered before content)
                // to stay behind the content div, which only holds if no
                // CSS rule anywhere gives .team-card-watermark a z-index
                // or its own stacking context. If it does (or .team-card
                // resolves stacking differently than expected), the
                // watermark renders ON TOP of the card, fogging out the
                // buttons/text inside it — which is what was reported.
                // Explicit z-index here plus `isolation: isolate` on the
                // parent guarantees correct stacking regardless of what
                // the external CSS does.
                <div
                  className="team-card-watermark"
                  style={{
                    backgroundImage: `url(${team.logoUrl})`,
                    position: "absolute",
                    inset: 0,
                    zIndex: 0,
                    pointerEvents: "none",
                  }}
                  aria-hidden="true"
                />
              )}
              <div
                className="team-card-content rounded-xl p-4"
                style={{
                  position: "relative",
                  zIndex: 1,
                  background: "var(--color-surface-container-low)",
                  border: "1px solid var(--color-border-overlay)",
                  WebkitMaskImage: "linear-gradient(to right, black 55%, transparent 100%)",
                  maskImage: "linear-gradient(to right, black 55%, transparent 100%)",
                }}
              >
                <Eyebrow color="var(--color-theme-orange)">{teamKey === "teamA" ? "Team A" : "Team B"}</Eyebrow>

                <TeamDbSelect teamsState={teamsState} roster={roster} excludeTeamId={matchSetup[otherKey].teamId} onApply={(patch) => updateTeam(teamKey, patch)} />

                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Name" value={team.name} onChange={(v) => updateTeam(teamKey, { name: v })} placeholder="Team name" />
                  <TextField
                    label="Short Code"
                    mono
                    maxLength={4}
                    value={team.shortCode}
                    onChange={(v) => updateTeam(teamKey, { shortCode: v.toUpperCase() })}
                    placeholder="e.g. CSK"
                  />
                  <ColorField label="Color" value={team.color} onChange={(v) => updateTeam(teamKey, { color: v })} />
                  <ImageUploader auctionId={auctionId ?? ""} kind="team" value={team.logoUrl} onChange={(url) => updateTeam(teamKey, { logoUrl: url })} label="Logo" />
                </div>

                <TeamRosterPicker team={team} roster={roster} onChange={(patch) => updateTeam(teamKey, patch)} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <SelectField
          label="Toss Winner"
          wrapperClassName="toss-field"
          value={matchSetup.tossWinner}
          onChange={(v) => setMatchSetup((p) => ({ ...p, tossWinner: v as MatchSetup["tossWinner"] }))}
        >
          <option value="">—</option>
          <option value="A">{matchSetup.teamA.shortCode || "Team A"}</option>
          <option value="B">{matchSetup.teamB.shortCode || "Team B"}</option>
        </SelectField>
        <SelectField
          label="Toss Decision"
          wrapperClassName="toss-field"
          value={matchSetup.tossDecision}
          onChange={(v) => setMatchSetup((p) => ({ ...p, tossDecision: v as MatchSetup["tossDecision"] }))}
        >
          <option value="">—</option>
          <option value="bat">Elected to bat</option>
          <option value="bowl">Elected to bowl</option>
        </SelectField>
        <div className="flex-1" />
        <PrimaryButton onClick={handlePush} minWidth={200}>
          {pushLabel}
        </PrimaryButton>
      </div>

      {!completed && (
        <p className="text-[9px] uppercase tracking-widest" style={{ fontFamily: "var(--font-label-mono)", color: "var(--color-outline)" }}>
          Push once to unlock the preview link and live scoring below.
        </p>
      )}
    </DrawerSection>
  );
}