"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabse";
import type { MatchSetup, SquadPlayer, TeamInfo } from "@/lib/overlayBus";
import { ImageUploader } from "./ImageUploader";

// ── Roster source ────────────────────────────────────────────────────
// Roster = players that were actually SOLD in this auction's lots.
// auction_lots carries a denormalized snapshot of the player at sale time
// (player_name, player_img, player_role) plus the winning_team_code.
// There is no team color/logo on this table — those stay manual per match.
interface RosterRow {
  id: string;               // player_id
  name: string;               // player_name
  image_url: string | null;   // player_img
  role: string | null;        // player_role
  team_code: string | null;   // winning_team_code — grouping key
}

type RosterState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "ready"; byTeam: Map<string, RosterRow[]> };

function useAuctionRoster(auctionId: string): RosterState {
  const [state, setState] = useState<RosterState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    supabase
      .from("auction_lots")
      .select("id,player_id,player_name,player_img,player_role,winning_team_code,status")
      .eq("auction_id", auctionId)
      .eq("status", "sold")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setState({ status: "error" });
          return;
        }
        if (data.length === 0) {
          setState({ status: "empty" });
          return;
        }
        const byTeam = new Map<string, RosterRow[]>();
        for (const row of data as any[]) {
          const key = row.winning_team_code?.trim() || "Unassigned";
          if (!byTeam.has(key)) byTeam.set(key, []);
          byTeam.get(key)!.push({
            id: row.player_id ?? row.id,
            name: row.player_name ?? "Unnamed",
            image_url: row.player_img,
            role: row.player_role,
            team_code: row.winning_team_code,
          });
        }
        setState({ status: "ready", byTeam });
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

  function applyRosterTeam(teamCode: string) {
    if (roster.status !== "ready") return;
    const rows = roster.byTeam.get(teamCode) ?? [];
    const players: SquadPlayer[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      imageUrl: r.image_url ?? undefined,
    }));
    onChange({
      name: team.name || teamCode,
      squadPlayers: players,
      squad: players.map((p) => p.name),
    });
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

  return (
    <div className="field-col">
      <div className="flex items-center justify-between">
        <span className="field-label">Squad ({(team.squadPlayers ?? []).length})</span>
        {roster.status === "ready" && (
          <select
            className="select-input"
            style={{ width: "auto", fontSize: 10, padding: "4px 8px" }}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) applyRosterTeam(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              Load from roster…
            </option>
            {[...roster.byTeam.keys()].map((teamCode) => (
              <option key={teamCode} value={teamCode}>
                {teamCode} ({roster.byTeam.get(teamCode)!.length})
              </option>
            ))}
          </select>
        )}
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
            {[...roster.byTeam.values()].flat().map((r) => {
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
                  <span className="font-mono-geist text-[9px] text-white/30">{r.team_code}</span>
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
          <div className="field-col">
            <span className="field-label">Tournament Logo</span>
            <ImageUploader
              auctionId={auctionId}
              kind="team"
              value={matchSetup.tournamentLogoUrl}
              onChange={(url) => setMatchSetup((p) => ({ ...p, tournamentLogoUrl: url }))}
            />
          </div>
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
            return (
              <div key={teamKey} className="team-card" style={{ ["--team-color" as string]: team.color }}>
                <div className="eyebrow">{teamKey === "teamA" ? "Team A" : "Team B"}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="field-col">
                    <span className="field-label">Name</span>
                    <input
                      className="text-input"
                      value={team.name}
                      onChange={(e) => updateTeam(teamKey, { name: e.target.value })}
                      placeholder="Team name"
                    />
                  </div>
                  <div className="field-col">
                    <span className="field-label">Short Code</span>
                    <input
                      className="text-input"
                      value={team.shortCode}
                      onChange={(e) => updateTeam(teamKey, { shortCode: e.target.value.toUpperCase() })}
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
                  <div className="field-col">
                    <span className="field-label">Logo</span>
                    <ImageUploader
                      auctionId={auctionId}
                      kind="team"
                      value={team.logoUrl}
                      onChange={(url) => updateTeam(teamKey, { logoUrl: url })}
                    />
                  </div>
                </div>

                <TeamRosterPicker team={team} roster={roster} onChange={(patch) => updateTeam(teamKey, patch)} />
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="field-col">
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
          <div className="field-col">
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