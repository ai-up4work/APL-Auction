// File: components/tournament/TournamentAdminPanel.tsx
"use client";
import { useState } from "react";
import TournamentBracket from "@/components/tournament/TournamentBracket";
import type { Round } from "@/components/tournament/TournamentBracket";
import StandingsTable from "@/components/tournament/StandingsTable";
import DoubleElimBoard from "@/components/tournament/DoubleElimBoard";
import MatchResultCard from "@/components/tournament/MatchResultCard";
import FormatDescription from "@/components/tournament/FormatDescription";
import { AdminTeam, makeTeamId, randomDraw } from "@/lib/tournament/seeding";
import { getDemoTeams } from "@/lib/tournament/demoTeams";
import { generateSingleElimination, recordSingleElimResult, championOf } from "@/lib/tournament/singleElim";
import {
  generateDoubleElimination,
  recordDoubleElimResult,
  championOfDoubleElim,
  DoubleElimData,
} from "@/lib/tournament/doubleElim";
import { generateRoundRobin, recordRoundRobinResult, RoundRobinData } from "@/lib/tournament/roundRobin";
import {
  generateGroups,
  buildKnockoutFromGroups,
  allGroupMatchesComplete,
  GroupKnockoutData,
} from "@/lib/tournament/groupKnockout";

type FormatType = "single_elimination" | "double_elimination" | "round_robin" | "group_knockout";

const FORMAT_LABELS: Record<FormatType, string> = {
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  round_robin: "Round Robin",
  group_knockout: "Groups + Knockout",
};

export default function TournamentAdminPanel() {
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [format, setFormat] = useState<FormatType>("single_elimination");
  const [groupCount, setGroupCount] = useState(4);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);

  const [singleRounds, setSingleRounds] = useState<Round[] | null>(null);
  const [doubleData, setDoubleData] = useState<DoubleElimData | null>(null);
  const [rrData, setRrData] = useState<RoundRobinData | null>(null);
  const [gkData, setGkData] = useState<GroupKnockoutData | null>(null);

  function addTeam() {
    if (!nameInput.trim() || !codeInput.trim()) return;
    setTeams((prev) => [
      ...prev,
      { id: makeTeamId(), name: nameInput.trim(), code: codeInput.trim().toUpperCase().slice(0, 4) },
    ]);
    setNameInput("");
    setCodeInput("");
  }

  function removeTeam(id: string) {
    setTeams((prev) => prev.filter((t) => t.id !== id));
  }

  function draw() {
    setTeams((prev) => randomDraw(prev));
  }

  function autofillDemoTeams() {
    setTeams(getDemoTeams());
  }

  function generate() {
    setSingleRounds(null);
    setDoubleData(null);
    setRrData(null);
    setGkData(null);
    if (teams.length < 2) return;
    if (format === "single_elimination") setSingleRounds(generateSingleElimination(teams));
    else if (format === "double_elimination") setDoubleData(generateDoubleElimination(teams));
    else if (format === "round_robin") setRrData(generateRoundRobin(teams));
    else if (format === "group_knockout") setGkData(generateGroups(teams, groupCount, qualifiersPerGroup));
  }

  function handleSingleResult(matchId: string, winner: "A" | "B", a: number, b: number) {
    if (!singleRounds) return;
    const next = singleRounds.map((r) => ({ ...r, matches: [...r.matches] }));
    recordSingleElimResult(next, matchId, winner, a, b);
    setSingleRounds(next);
  }

  function handleDoubleResult(matchId: string, winner: "A" | "B", a: number, b: number) {
    if (!doubleData) return;
    const next: DoubleElimData = { ...doubleData };
    recordDoubleElimResult(next, matchId, winner, a, b);
    setDoubleData({ ...next });
  }

  function handleRrResult(matchId: string, _winner: "A" | "B", a: number, b: number) {
    if (!rrData) return;
    const next = { ...rrData, matches: [...rrData.matches] };
    recordRoundRobinResult(next, matchId, a, b);
    setRrData(next);
  }

  function handleGroupResult(groupId: string, matchId: string, a: number, b: number) {
    if (!gkData) return;
    const next: GroupKnockoutData = {
      ...gkData,
      groups: gkData.groups.map((g) =>
        g.id === groupId ? { ...g, roundRobin: { ...g.roundRobin, matches: [...g.roundRobin.matches] } } : g
      ),
    };
    const group = next.groups.find((g) => g.id === groupId)!;
    recordRoundRobinResult(group.roundRobin, matchId, a, b);
    setGkData(next);
  }

  function generateKnockoutStage() {
    if (!gkData) return;
    const next = { ...gkData };
    buildKnockoutFromGroups(next);
    setGkData({ ...next });
  }

  function handleKnockoutResult(matchId: string, winner: "A" | "B", a: number, b: number) {
    if (!gkData?.knockout) return;
    const knockout = gkData.knockout.map((r) => ({ ...r, matches: [...r.matches] }));
    recordSingleElimResult(knockout, matchId, winner, a, b);
    setGkData({ ...gkData, knockout });
  }

  const champion =
    format === "single_elimination"
      ? singleRounds ? championOf(singleRounds) : null
      : format === "double_elimination"
      ? doubleData ? championOfDoubleElim(doubleData) : null
      : format === "group_knockout"
      ? gkData?.knockout ? championOf(gkData.knockout) : null
      : null;

  return (
    <div className="min-h-screen w-full bg-background text-on-surface p-6">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
        <header>
          <span className="font-label-mono text-[10px] font-black uppercase tracking-[0.3em] text-theme-orange">
            Tournament Admin
          </span>
          <h1 className="font-headline-lg font-bold text-3xl mt-1.5">Build &amp; run a tournament</h1>
        </header>

        {/* Format selector */}
        <section className="flex flex-wrap gap-2">
          {(Object.keys(FORMAT_LABELS) as FormatType[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`px-4 py-2 rounded-full text-[11px] font-label-mono font-black uppercase tracking-widest border transition-colors ${
                format === f
                  ? "bg-theme-orange border-theme-orange text-on-primary"
                  : "bg-surface-container-low border-border-overlay text-outline"
              }`}
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </section>

        <FormatDescription format={format} />

        {/* Team roster */}
        <section className="rounded-xl border border-border-overlay bg-surface-container-low p-4">
          <h2 className="font-label-mono text-[11px] font-black uppercase tracking-widest text-on-surface-variant mb-3">
            Teams ({teams.length})
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              placeholder="Team name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-background border border-border-overlay text-sm flex-1 min-w-[160px]"
            />
            <input
              placeholder="Code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-background border border-border-overlay text-sm w-24"
            />
<button
              type="button"
              onClick={draw}
              disabled={teams.length < 2}
              className="px-4 py-1.5 rounded-lg bg-theme-orange text-on-primary text-xs font-label-mono font-bold uppercase tracking-wide disabled:opacity-40"
            >
              Random draw
            </button>
            <button
              type="button"
              onClick={autofillDemoTeams}
              className="px-4 py-1.5 rounded-lg bg-surface-container border border-border-overlay text-xs font-label-mono font-bold uppercase tracking-wide text-outline hover:text-on-surface transition-colors"
            >
              Autofill demo teams (32)
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {teams.map((t, i) => (
              <span
                key={t.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container border border-border-overlay text-xs font-label-mono"
              >
                <span className="text-outline">#{i + 1}</span> {t.name}{" "}
                <span className="text-theme-orange font-bold">{t.code}</span>
                <button type="button" onClick={() => removeTeam(t.id)} className="text-outline hover:text-status-live ml-1">
                  ×
                </button>
              </span>
            ))}
          </div>
        </section>

        {/* Format-specific options */}
        {format === "group_knockout" && (
          <section className="flex gap-4 items-end">
            <label className="text-xs font-label-mono text-outline">
              Groups
              <input
                type="number"
                min={2}
                value={groupCount}
                onChange={(e) => setGroupCount(Number(e.target.value))}
                className="block mt-1 w-24 px-3 py-1.5 rounded-lg bg-background border border-border-overlay text-sm"
              />
            </label>
            <label className="text-xs font-label-mono text-outline">
              Qualifiers per group
              <input
                type="number"
                min={1}
                value={qualifiersPerGroup}
                onChange={(e) => setQualifiersPerGroup(Number(e.target.value))}
                className="block mt-1 w-24 px-3 py-1.5 rounded-lg bg-background border border-border-overlay text-sm"
              />
            </label>
          </section>
        )}

        <button
          type="button"
          onClick={generate}
          disabled={teams.length < 2}
          className="self-start px-6 py-2.5 rounded-lg bg-theme-orange text-on-primary text-xs font-label-mono font-black uppercase tracking-widest disabled:opacity-40"
        >
          Generate {FORMAT_LABELS[format]}
        </button>

        {champion && (
          <div className="rounded-xl border border-theme-orange/40 bg-theme-orange/10 px-4 py-3 font-label-mono text-sm">
            🏆 Champion: <span className="font-black text-theme-orange">{champion.name}</span>
          </div>
        )}

        {/* Single elimination */}
        {format === "single_elimination" && singleRounds && (
          <>
            <TournamentBracket rounds={singleRounds} title="Bracket Preview" />
            <ResultsGrid rounds={singleRounds} onRecordResult={handleSingleResult} />
          </>
        )}

        {/* Double elimination */}
        {format === "double_elimination" && doubleData && (
          <DoubleElimBoard data={doubleData} onRecordResult={handleDoubleResult} />
        )}

        {/* Round robin */}
        {format === "round_robin" && rrData && (
          <div className="grid md:grid-cols-2 gap-6">
            <StandingsTable title="Standings" rows={rrData.standings} qualifyCount={0} />
            <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
              {rrData.matches.map((m) => (
                <MatchResultCard key={m.id} match={m} onRecordResult={(id, w, a, b) => handleRrResult(id, w, a, b)} />
              ))}
            </div>
          </div>
        )}

        {/* Groups + knockout */}
        {format === "group_knockout" && gkData && (
          <div className="flex flex-col gap-8">
            <div className="grid md:grid-cols-2 gap-6">
              {gkData.groups.map((g) => (
                <div key={g.id} className="flex flex-col gap-3">
                  <StandingsTable title={g.name} rows={g.roundRobin.standings} qualifyCount={gkData.qualifiersPerGroup} />
                  <div className="flex flex-col gap-2">
                    {g.roundRobin.matches.map((m) => (
                      <MatchResultCard key={m.id} match={m} onRecordResult={(id, _w, a, b) => handleGroupResult(g.id, id, a, b)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {!gkData.knockout && (
              <button
                type="button"
                onClick={generateKnockoutStage}
                disabled={!allGroupMatchesComplete(gkData)}
                className="self-start px-6 py-2.5 rounded-lg bg-theme-orange text-on-primary text-xs font-label-mono font-black uppercase tracking-widest disabled:opacity-40"
              >
                Generate knockout stage
              </button>
            )}

            {gkData.knockout && (
              <>
                <TournamentBracket rounds={gkData.knockout} title="Knockout Stage" />
                <ResultsGrid rounds={gkData.knockout} onRecordResult={handleKnockoutResult} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultsGrid({
  rounds,
  onRecordResult,
}: {
  rounds: Round[];
  onRecordResult: (matchId: string, winner: "A" | "B", a: number, b: number) => void;
}) {
  return (
    <div>
      <h3 className="font-label-mono text-[11px] font-black uppercase tracking-widest text-on-surface-variant mb-3">
        Enter results
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {rounds.map((round) => (
          <div key={round.id} className="min-w-[220px] flex flex-col gap-3">
            <p className="font-label-mono text-[10px] font-bold uppercase tracking-widest text-outline text-center">
              {round.name}
            </p>
            {round.matches.map((m) => (
              <MatchResultCard key={m.id} match={m} onRecordResult={onRecordResult} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}