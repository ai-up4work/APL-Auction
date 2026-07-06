"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabse";
import type { MatchSetup, SquadPlayer, TeamInfo } from "@/lib/overlayBus";
import { ImageUploader } from "./ImageUploader";

// ── Roster source ────────────────────────────────────────────────────
// Roster = players that were actually SOLD in this auction.
// Reads straight from the `players` table (see schema) — there is no
// separate `auction_lots` table. Grouping key is `sold_to_team_id`, the
// real FK into `teams.id` — this avoids any drift between free-text
// `owner_team_code` values and the canonical `teams.code`.
interface RosterRow {
  id: string;                 // player.id
  name: string;                // player.name
  image_url: string | null;    // player.img
  role: string | null;         // player.role
  team_id: string | null;      // player.sold_to_team_id — grouping key
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
// Canonical team list for this auction — code, name, color, logo.
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

// ── DB team picker — fills name/code/color/logo (+ squad if available) ─
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
    return <p className="font-mono-geist text-[10px] text-white/30">Loading teams…</p>;
  }
  if (teamsState.status === "error") {
    return (
      <p className="font-mono-geist text-[10px] text-amber-400/70">
        Couldn&apos;t reach the teams table — fill in details manually.
      </p>
    );
  }
  if (teamsState.status === "empty") {
    return (
      <p className="font-mono-geist text-[10px] text-white/30">
        No teams found for this auction — fill in details manually.
      </p>
    );
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
          ...(squadPlayers.length
            ? { squadPlayers, squad: squadPlayers.map((p) => p.name) }
            : {}),
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
  const selectedIds = useMemo(
    () => new Set((team.squadPlayers ?? []).map((p) => p.id)),
    [team.squadPlayers]
  );

  // Re-pull the squad for the currently bound team (used by a manual
  // "reload" affordance if the roster loads in after the team was picked).
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

  const allRosterRows =
    roster.status === "ready" ? [...roster.byTeamId.values()].flat() : [];

  return (
    <div className="field-col">
      <div className="flex items-center justify-between">
        <span className="field-label">Squad ({(team.squadPlayers ?? []).length})</span>
        <div className="flex items-center gap-2">
          {team.teamId && roster.status === "ready" && (
            <button
              type="button"
              className="text-link-btn"
              onClick={reloadFromBoundTeam}
              title="Reload squad from roster for the bound team"
            >
              Reload
            </button>
          )}
          {(team.squadPlayers ?? []).length > 0 && (
            <button
              type="button"
              className="text-link-btn"
              onClick={clearSquad}
              title="Remove everyone from today's squad"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {roster.status === "loading" && (
        <p className="font-mono-geist text-[10px] text-white/30">Loading roster…</p>
      )}
      {roster.status === "error" && (
        <p className="font-mono-geist text-[10px] text-amber-400/70">
          Couldn&apos;t reach the roster table — add players manually below.
        </p>
      )}
      {roster.status === "empty" && (
        <p className="font-mono-geist text-[10px] text-white/30">
          No sold players found for this auction yet — add players manually below.
        </p>
      )}

      {(team.squadPlayers ?? []).length > 0 && (
        <div className="panel-scroll squad-list">
          {(team.squadPlayers ?? []).map((p) => {
            const isManual = p.id.startsWith("manual:");
            return (
              <div key={p.id} className="squad-chip">
                <span className="squad-avatar">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" />
                  ) : (
                    <span className="squad-avatar-fallback">{initials(p.name) || "?"}</span>
                  )}
                </span>
                <span className="squad-name">{p.name}</span>
                <button
                  type="button"
                  className="squad-remove"
                  onClick={() => (isManual ? removeManual(p.id) : togglePlayer(p))}
                  title="Remove from today's squad"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {roster.status === "ready" && (
        <details className="roster-browser">
          <summary className="font-mono-geist text-[9px] text-white/40 uppercase tracking-widest cursor-pointer">
            Browse all rostered players ▸
          </summary>
          <div className="panel-scroll squad-list mt-2">
            {allRosterRows.map((r) => {
              const checked = selectedIds.has(r.id);
              return (
                <label key={r.id} className={`squad-pick-row ${checked ? "is-checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      togglePlayer({ id: r.id, name: r.name, imageUrl: r.image_url ?? undefined })
                    }
                  />
                  <span className="squad-avatar squad-avatar-sm">
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image_url} alt="" />
                    ) : (
                      <span className="squad-avatar-fallback">{initials(r.name) || "?"}</span>
                    )}
                  </span>
                  <span className="squad-name">{r.name}</span>
                </label>
              );
            })}
          </div>
        </details>
      )}

      <div className="flex gap-2">
        <input
          className="text-input"
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addManual();
            }
          }}
          placeholder="Add a player by name…"
        />
        <button type="button" className="fx-btn fx-toggle-off" style={{ flexShrink: 0 }} onClick={addManual}>
          Add
        </button>
      </div>
    </div>
  );
}

// ── Logo uploader + remove control ───────────────────────────────────
function LogoField({
  label,
  auctionId,
  value,
  onChange,
}: {
  label: string;
  auctionId: string;
  value: string;
  onChange: (url: string) => void;
}) {
  return (
    <div className="field-col">
      <span className="field-label">{label}</span>
      <div className="logo-field-row">
        <ImageUploader auctionId={auctionId} kind="team" value={value} onChange={onChange} />
        {value && (
          <button
            type="button"
            className="icon-btn"
            title="Remove image"
            onClick={() => onChange("")}
          >
            ×
          </button>
        )}
      </div>
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
}: {
  auctionId: string;
  matchSetup: MatchSetup;
  setMatchSetup: React.Dispatch<React.SetStateAction<MatchSetup>>;
  onPush: () => void;
  pushLabel: string;
  completed: boolean;
}) {
  const roster = useAuctionRoster(auctionId);
  const teamsState = useAuctionTeams(auctionId);

  function updateTeam(team: "teamA" | "teamB", patch: Partial<TeamInfo>) {
    setMatchSetup((prev) => ({ ...prev, [team]: { ...prev[team], ...patch } }));
  }

  return (
    <details className="rack-panel p-5 drawer" open={!completed}>
      <summary>
        <div className="flex items-center gap-3">
          <div className="eyebrow">1 · Match Setup</div>
          <span className="font-mono-geist text-[9px] text-white/30 normal-case tracking-normal">
            teams &amp; session · set once, then push
          </span>
          {completed && <span className="done-dot" title="Pushed" />}
        </div>
        <span className="drawer-chevron">▸</span>
      </summary>

      <div className="drawer-body flex flex-col gap-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="field-col">
            <span className="field-label">Tournament</span>
            <input
              className="text-input"
              value={matchSetup.tournamentName}
              onChange={(e) => setMatchSetup((p) => ({ ...p, tournamentName: e.target.value }))}
              placeholder="e.g. Provincial T20 Cup"
            />
          </div>
          <div className="field-col">
            <span className="field-label">Season</span>
            <input
              className="text-input"
              value={matchSetup.season}
              onChange={(e) => setMatchSetup((p) => ({ ...p, season: e.target.value }))}
              placeholder="e.g. 2026"
            />
          </div>
          <LogoField
            label="Tournament Logo"
            auctionId={auctionId}
            value={matchSetup.tournamentLogoUrl}
            onChange={(url) => setMatchSetup((p) => ({ ...p, tournamentLogoUrl: url }))}
          />
          <div className="field-col">
            <span className="field-label">Venue</span>
            <input
              className="text-input"
              value={matchSetup.venue}
              onChange={(e) => setMatchSetup((p) => ({ ...p, venue: e.target.value }))}
              placeholder="Ground name"
            />
          </div>
          <div className="field-col">
            <span className="field-label">Format</span>
            <select
              className="select-input"
              value={matchSetup.format}
              onChange={(e) => setMatchSetup((p) => ({ ...p, format: e.target.value as MatchSetup["format"] }))}
            >
              <option value="T20">T20</option>
              <option value="ODI">ODI</option>
              <option value="Test">Test</option>
            </select>
          </div>
          <div className="field-col">
            <span className="field-label">Match Number</span>
            <input
              className="text-input"
              value={matchSetup.matchNumber}
              onChange={(e) => setMatchSetup((p) => ({ ...p, matchNumber: e.target.value }))}
              placeholder="e.g. Match 14"
            />
          </div>
          <div className="field-col" style={{ gridColumn: "span 2" }}>
            <span className="field-label">Match Title</span>
            <input
              className="text-input"
              value={matchSetup.matchTitle}
              onChange={(e) => setMatchSetup((p) => ({ ...p, matchTitle: e.target.value }))}
              placeholder="e.g. Semi-Final"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(["teamA", "teamB"] as const).map((teamKey) => {
            const team = matchSetup[teamKey];
            const otherKey = teamKey === "teamA" ? "teamB" : "teamA";
            return (
              <div key={teamKey} className="team-card" style={{ ["--team-color" as string]: team.color }}>
                {team.logoUrl && (
                  <div
                    className="team-card-watermark"
                    style={{ backgroundImage: `url(${team.logoUrl})` }}
                    aria-hidden="true"
                  />
                )}
                <div className="team-card-content">
                  <div className="eyebrow">{teamKey === "teamA" ? "Team A" : "Team B"}</div>

                  <TeamDbSelect
                    teamsState={teamsState}
                    roster={roster}
                    excludeTeamId={matchSetup[otherKey].teamId}
                    onApply={(patch) => updateTeam(teamKey, patch)}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="field-col">
                      <span className="field-label">Name</span>
                      <input
                        className="text-input"
                        value={team.name}
                        onChange={(e) => updateTeam(teamKey, { name: e.target.value, teamId: undefined })}
                        placeholder="Team name"
                      />
                    </div>
                    <div className="field-col">
                      <span className="field-label">Short Code</span>
                      <input
                        className="text-input"
                        value={team.shortCode}
                        onChange={(e) =>
                          updateTeam(teamKey, { shortCode: e.target.value.toUpperCase(), teamId: undefined })
                        }
                        placeholder="e.g. CSK"
                        maxLength={4}
                      />
                    </div>
                    <div className="field-col">
                      <span className="field-label">Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={team.color}
                          onChange={(e) => updateTeam(teamKey, { color: e.target.value })}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 6,
                            border: "1px solid rgba(255,255,255,0.1)",
                            background: "none",
                            padding: 0,
                          }}
                        />
                        <input
                          className="text-input"
                          value={team.color}
                          onChange={(e) => updateTeam(teamKey, { color: e.target.value })}
                        />
                      </div>
                    </div>
                    <LogoField
                      label="Logo"
                      auctionId={auctionId}
                      value={team.logoUrl}
                      onChange={(url) => updateTeam(teamKey, { logoUrl: url })}
                    />
                  </div>

                  <TeamRosterPicker team={team} roster={roster} onChange={(patch) => updateTeam(teamKey, patch)} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="field-col toss-field">
            <span className="field-label">Toss Winner</span>
            <select
              className="select-input"
              value={matchSetup.tossWinner}
              onChange={(e) => setMatchSetup((p) => ({ ...p, tossWinner: e.target.value as MatchSetup["tossWinner"] }))}
            >
              <option value="">—</option>
              <option value="A">{matchSetup.teamA.shortCode || "Team A"}</option>
              <option value="B">{matchSetup.teamB.shortCode || "Team B"}</option>
            </select>
          </div>
          <div className="field-col toss-field">
            <span className="field-label">Toss Decision</span>
            <select
              className="select-input"
              value={matchSetup.tossDecision}
              onChange={(e) => setMatchSetup((p) => ({ ...p, tossDecision: e.target.value as MatchSetup["tossDecision"] }))}
            >
              <option value="">—</option>
              <option value="bat">Elected to bat</option>
              <option value="bowl">Elected to bowl</option>
            </select>
          </div>
          <div className="flex-1" />
          <button onClick={onPush} className="talk-btn" style={{ minWidth: 200 }}>
            {pushLabel}
          </button>
        </div>
        {!completed && (
          <p className="font-mono-geist text-[9px] text-white/40 uppercase tracking-widest">
            Push once to unlock the preview link and live scoring below.
          </p>
        )}
      </div>
    </details>
  );
}