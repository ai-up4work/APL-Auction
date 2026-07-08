"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabse";
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

function useAuctionRoster(auctionId: string): RosterState {
  const [state, setState] = useState<RosterState>({ status: "loading" });

  useEffect(() => {
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
          console.error("[useAuctionRoster] players query failed:", error);
          setState({ status: "error" });
          return;
        }
        if (data.length === 0) {
          setState({ status: "empty" });
          return;
        }
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
          });
        }
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

function useAuctionTeams(auctionId: string): TeamsDbState {
  const [state, setState] = useState<TeamsDbState>({ status: "loading" });

  useEffect(() => {
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
          console.error("[useAuctionTeams] teams query failed:", error);
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
function TeamRosterPicker({
  team,
  onChange,
  roster,
}: {
  team: TeamInfo;
  onChange: (patch: Partial<TeamInfo>) => void;
  roster: RosterState;
}) {
  const [manualName, setManualName] = useState("");
  const selectedIds = useMemo(() => new Set((team.squadPlayers ?? []).map((p) => p.id)), [team.squadPlayers]);

  // Only THIS team's roster rows — not every team's.
  const teamRosterRows = useMemo(() => {
    if (roster.status !== "ready" || !team.teamId) return [];
    return roster.byTeamId.get(team.teamId) ?? [];
  }, [roster, team.teamId]);

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

  function addManual() {
    const name = manualName.trim();
    if (!name) return;
    const player: SquadPlayer = { id: `manual:${name}`, name };
    const next = [...(team.squadPlayers ?? []), player];
    onChange({ squadPlayers: next, squad: next.map((p) => p.name) });
    setManualName("");
  }

  function removeManual(id: string) {
    const next = (team.squadPlayers ?? []).filter((p) => p.id !== id);
    onChange({ squadPlayers: next, squad: next.map((p) => p.name) });
  }

  function clearSquad() {
    onChange({ squadPlayers: [], squad: [] });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <FieldLabel>Squad ({selectedIds.size})</FieldLabel>
        <div className="flex items-center gap-3">
          {team.teamId && roster.status === "ready" && (
            <LinkBtn onClick={reloadFromBoundTeam} title="Reload full squad from roster for the bound team">
              Reload
            </LinkBtn>
          )}
          {selectedIds.size > 0 && (
            <LinkBtn danger onClick={clearSquad} title="Remove everyone from today's squad">
              Clear
            </LinkBtn>
          )}
        </div>
      </div>

      {roster.status === "loading" && <MutedNote>Loading roster…</MutedNote>}
      {roster.status === "error" && <MutedNote tone="warning">Couldn&apos;t reach the roster table — add players manually below.</MutedNote>}
      {roster.status === "ready" && !team.teamId && (
        <MutedNote>Select a team above to load its roster, or add players manually below.</MutedNote>
      )}
      {roster.status === "ready" && team.teamId && teamRosterRows.length === 0 && (
        <MutedNote>No sold players found for this team yet — add players manually below.</MutedNote>
      )}

      {/* ── Squad — single clickable carousel. Click a card to toggle it
           in/out of today's squad. IMPORTANT: this div must carry ONLY
           the "squad-list" class — see the globals.css comment for why. ── */}
      {(teamRosterRows.length > 0 || manualPlayers.length > 0) && (
        <div className="squad-list">
          {teamRosterRows.map((r) => {
            const checked = selectedIds.has(r.id);
            return (
              <button
                type="button"
                key={r.id}
                className={`squad-chip ${checked ? "is-selected" : "is-unselected"}`}
                onClick={() => togglePlayer({ id: r.id, name: r.name, imageUrl: r.image_url ?? undefined })}
                title={checked ? "Remove from today's squad" : "Add to today's squad"}
              >
                {checked && <span className="squad-check">✓</span>}
                <span className="squad-avatar">
                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt="" />
                  ) : (
                    <span className="squad-avatar-fallback">{initials(r.name) || "?"}</span>
                  )}
                </span>
                <span className="squad-name">{r.name}</span>
              </button>
            );
          })}

          {manualPlayers.map((p) => (
            <div key={p.id} className="squad-chip is-selected">
              <button type="button" className="squad-remove" onClick={() => removeManual(p.id)} title="Remove from today's squad">
                ×
              </button>
              <span className="squad-avatar">
                <span className="squad-avatar-fallback">{initials(p.name) || "?"}</span>
              </span>
              <span className="squad-name">{p.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={manualName}
          onChange={setManualName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addManual();
            }
          }}
          placeholder="Add a player by name…"
        />
        <SmallButton onClick={addManual}>Add</SmallButton>
      </div>
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
  auctionId: string;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster.status, locked]);

  if (locked) {
    return <LockedSummaryBar matchSetup={matchSetup} onEdit={handleEdit} />;
  }

  return (
      <DrawerSection
        step="1" title="Match Setup" description="Teams & session — set once, then push"
        done={completed} open={drawerOpen} onOpenChange={setDrawerOpen} >
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
          auctionId={auctionId}
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
        <TextField
          label="Match Title"
          span={2}
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
            <div key={teamKey} className="team-card" style={{ ["--team-color" as string]: team.color }}>
              {team.logoUrl && (
                <div className="team-card-watermark" style={{ backgroundImage: `url(${team.logoUrl})` }} aria-hidden="true" />
              )}
              <div
                className="team-card-content rounded-xl p-4"
                style={{
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
                  <ImageUploader auctionId={auctionId} kind="team" value={team.logoUrl} onChange={(url) => updateTeam(teamKey, { logoUrl: url })} label="Logo" />
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