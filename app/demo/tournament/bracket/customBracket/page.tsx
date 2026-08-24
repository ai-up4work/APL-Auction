// File: app/tournament/[slug]/bracket/customBracket/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Trophy, Shuffle, RotateCw, Info } from "lucide-react";
import TournamentBracket from "@/components/tournament/TournamentBracket";
import DoubleElimBoard from "@/components/tournament/DoubleElimBoard";
import MatchResultCard from "@/components/tournament/MatchResultCard";
import { getDemoTeams } from "@/lib/tournament/demoTeams"; // adjust path if yours differs
import {
  simulateSingleElimination,
  simulateThirdPlaceMatch,
  simulateDoubleElimination,
  generateRoundRobinSchedule,
  simulateRoundRobinResults,
  computeStandings,
  simulateGroupStage,
  type SimTeam,
  type SeedingMode,
} from "@/lib/tournament/customBracketSim"; // adjust path if yours differs

type FormatOption = "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION" | "ROUND_ROBIN" | "GROUP_AND_SINGLE_ELIMINATION";

const TEAM_COUNT_OPTIONS = [4, 8, 16, 32, 64];

export default function CustomBracketSandboxPage() {
  const params = useParams<{ slug: string }>();

  const [format, setFormat] = useState<FormatOption>("SINGLE_ELIMINATION");
  const [teamCount, setTeamCount] = useState(16);
  const [seeding, setSeeding] = useState<SeedingMode>("RANKING");
  const [thirdPlaceMatch, setThirdPlaceMatch] = useState(true);
  const [grandFinalReset, setGrandFinalReset] = useState(true);
  const [groupCount, setGroupCount] = useState(4);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);
  const [seed, setSeed] = useState(0); // bump to force a fresh random simulation

  const isDoubleElim = format === "DOUBLE_ELIMINATION";
  const isPowerOfTwo = (teamCount & (teamCount - 1)) === 0;

  const teams: SimTeam[] = useMemo(
    () => getDemoTeams(teamCount).map((t) => ({ id: t.id, code: t.code, name: t.name, logo: t.logo, color: (t as any).color })),
    [teamCount]
  );

  const singleElimResult = useMemo(() => {
    if (format !== "SINGLE_ELIMINATION") return null;
    const rounds = simulateSingleElimination(teams, { seeding });
    const thirdPlace = thirdPlaceMatch ? simulateThirdPlaceMatch(rounds) : null;
    return { rounds, thirdPlace };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, teams, seeding, thirdPlaceMatch, seed]);

  const doubleElimResult = useMemo(() => {
    if (format !== "DOUBLE_ELIMINATION" || !isPowerOfTwo) return null;
    try {
      return simulateDoubleElimination(teams, { seeding, grandFinalReset });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, teams, seeding, grandFinalReset, isPowerOfTwo, seed]);

  const roundRobinResult = useMemo(() => {
    if (format !== "ROUND_ROBIN") return null;
    const schedule = generateRoundRobinSchedule(teams, 1);
    const played = simulateRoundRobinResults(schedule);
    const standings = computeStandings(teams, played);
    return { played, standings };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, teams, seed]);

  const groupResult = useMemo(() => {
    if (format !== "GROUP_AND_SINGLE_ELIMINATION") return null;
    const { groupResults, qualifiers } = simulateGroupStage(teams, groupCount, qualifiersPerGroup);
    const knockout = simulateSingleElimination(qualifiers, { seeding: "RANKING" });
    return { groupResults, knockout };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, teams, groupCount, qualifiersPerGroup, seed]);

  return (
    <div className="min-h-screen w-full bg-background text-on-surface">
      {/* Sandbox control bar — mirrors the eyebrow/title header pattern
          used by TournamentBracket / DoubleElimBoard, so switching
          formats below doesn't feel like a different app. */}
      <div className="max-w-[1600px] mx-auto px-8 pt-6 pb-4 border-b border-border-overlay">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] font-label-mono text-theme-orange">
              <Trophy className="w-3.5 h-3.5" />
              Bracket Sandbox · {params?.slug}
            </span>
            <h1 className="font-headline-lg font-bold text-3xl text-on-surface mt-1.5">Custom Format Simulator</h1>
          </div>
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-theme-orange text-on-primary font-label-mono text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Re-simulate
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Field label="Format">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as FormatOption)}
              className="sandbox-select"
            >
              <option value="SINGLE_ELIMINATION">Single Elimination</option>
              <option value="DOUBLE_ELIMINATION">Double Elimination</option>
              <option value="ROUND_ROBIN">Round Robin</option>
              <option value="GROUP_AND_SINGLE_ELIMINATION">Groups + Single Elimination</option>
            </select>
          </Field>

          <Field label="Teams">
            <select value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))} className="sandbox-select">
              {TEAM_COUNT_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          <Field label="Seeding">
            <select value={seeding} onChange={(e) => setSeeding(e.target.value as SeedingMode)} className="sandbox-select">
              <option value="RANKING">Ranking order</option>
              <option value="RANDOM">Random</option>
            </select>
          </Field>

          {format === "SINGLE_ELIMINATION" && (
            <ToggleField label="3rd place match" checked={thirdPlaceMatch} onChange={setThirdPlaceMatch} />
          )}

          {format === "DOUBLE_ELIMINATION" && (
            <ToggleField label="Grand final reset" checked={grandFinalReset} onChange={setGrandFinalReset} />
          )}

          {format === "GROUP_AND_SINGLE_ELIMINATION" && (
            <>
              <Field label="Groups">
                <select value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value))} className="sandbox-select">
                  {[2, 4, 8].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Qualify / group">
                <select value={qualifiersPerGroup} onChange={(e) => setQualifiersPerGroup(Number(e.target.value))} className="sandbox-select">
                  {[1, 2, 3].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </div>

        {format === "DOUBLE_ELIMINATION" && !isPowerOfTwo && (
          <p className="mt-3 flex items-center gap-2 text-[11px] font-label-mono text-status-live">
            <Info className="w-3.5 h-3.5" />
            Double elimination here needs a power-of-two team count (byes + losers bracket don't compose cleanly) — pick 4/8/16/32/64.
          </p>
        )}
      </div>

      {/* --- Single Elimination --- */}
      {format === "SINGLE_ELIMINATION" && singleElimResult && (
        <>
          <TournamentBracket
            rounds={singleElimResult.rounds}
            title="Custom Knockout Sandbox"
            eyebrowLabel="Sandbox · Single Elimination"
            helperText="Randomly simulated results — hit Re-simulate for a new run."
          />
          {singleElimResult.thirdPlace && (
            <div className="max-w-xl mx-auto px-8 pb-12 -mt-4">
              <p className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline text-center mb-3">
                3rd Place Match
              </p>
              <MatchResultCard match={singleElimResult.thirdPlace} onRecordResult={() => {}} />
            </div>
          )}
        </>
      )}

      {/* --- Double Elimination --- */}
      {format === "DOUBLE_ELIMINATION" && doubleElimResult && (
        <DoubleElimBoard
          data={{ ...doubleElimResult, bracketReset: doubleElimResult.bracketReset ?? null }}
          title="Custom Knockout Sandbox"
          eyebrowLabel="Sandbox · Double Elimination"
          helperText="Randomly simulated results — hit Re-simulate for a new run."
          onRecordResult={() => {}}
        />
      )}

      {/* --- Round Robin --- */}
      {format === "ROUND_ROBIN" && roundRobinResult && (
        <div className="max-w-[1000px] mx-auto px-8 py-8">
          <StandingsTable standings={roundRobinResult.standings} />
          <FixtureList matches={roundRobinResult.played} />
        </div>
      )}

      {/* --- Groups + Single Elimination --- */}
      {format === "GROUP_AND_SINGLE_ELIMINATION" && groupResult && (
        <>
          <div className="max-w-[1400px] mx-auto px-8 py-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {groupResult.groupResults.map((gr) => (
              <div key={gr.name} className="bg-surface-container-low border border-border-overlay rounded-xl p-4">
                <p className="text-[10px] font-label-mono font-black uppercase tracking-widest text-theme-orange mb-3">
                  {gr.name}
                </p>
                <StandingsTable standings={gr.standings} compact />
              </div>
            ))}
          </div>
          <TournamentBracket
            rounds={groupResult.knockout}
            title="Knockout Stage"
            eyebrowLabel="Sandbox · Post-Group Knockout"
            helperText="Top qualifiers from each group, seeded by group finish."
          />
        </>
      )}

      <style jsx global>{`
        .sandbox-select {
          background: var(--color-surface-container-low);
          border: 1px solid var(--color-border-overlay);
          color: var(--color-on-surface);
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 8px 12px;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small presentational helpers, kept local since they're only used  */
/*  by this sandbox page.                                              */
/* ------------------------------------------------------------------ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline">{label}</span>
      {children}
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-label-mono text-[11px] font-bold uppercase tracking-wide transition-colors ${
          checked
            ? "bg-theme-orange/10 border-theme-orange/40 text-theme-orange"
            : "bg-surface-container-low border-border-overlay text-outline"
        }`}
      >
        <RotateCw className="w-3 h-3" />
        {checked ? "On" : "Off"}
      </button>
    </label>
  );
}

function StandingsTable({ standings, compact }: { standings: ReturnType<typeof computeStandings>; compact?: boolean }) {
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline border-b border-border-overlay">
          <th className="py-2 pr-2">Team</th>
          <th className="py-2 px-2 text-center">P</th>
          <th className="py-2 px-2 text-center">W</th>
          {!compact && <th className="py-2 px-2 text-center">D</th>}
          <th className="py-2 px-2 text-center">L</th>
          <th className="py-2 pl-2 text-center">Pts</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((s: ReturnType<typeof computeStandings>[number], i) => (
          <tr key={s.team.id} className={`text-xs font-label-mono border-b border-border-overlay/50 ${i < 2 ? "text-theme-orange" : "text-on-surface"}`}>
            <td className="py-2 pr-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0" style={{ backgroundColor: s.team.color, color: "#fff" }}>
                {s.team.code}
              </span>
              {s.team.name}
            </td>
            <td className="py-2 px-2 text-center">{s.played}</td>
            <td className="py-2 px-2 text-center">{s.won}</td>
            {!compact && <td className="py-2 px-2 text-center">{s.drawn}</td>}
            <td className="py-2 px-2 text-center">{s.lost}</td>
            <td className="py-2 pl-2 text-center font-bold">{s.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FixtureList({ matches }: { matches: ReturnType<typeof simulateRoundRobinResults> }) {
  return (
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {matches.map((m) => (
        <div key={m.id} className="flex items-center justify-between bg-surface-container-low border border-border-overlay rounded-lg px-4 py-2.5 text-xs font-label-mono">
          <span className={m.winner === "A" ? "text-theme-orange font-bold" : "text-on-surface"}>{m.teamA.code}</span>
          <span className="text-outline">{m.scoreA} — {m.scoreB}</span>
          <span className={m.winner === "B" ? "text-theme-orange font-bold" : "text-on-surface"}>{m.teamB.code}</span>
        </div>
      ))}
    </div>
  );
}