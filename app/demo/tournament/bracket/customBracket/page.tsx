// File: app/tournament/[slug]/bracket/customBracket/page.tsx
"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import {
  Trophy,
  Shuffle,
  RotateCw,
  Info,
  CheckCircle2,
  Layers,
  Users,
  CalendarDays,
  ArrowRight,
  Swords,
} from "lucide-react";
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
} from "@/lib/tournament/customBracketSim";

type FormatOption =
  | "SINGLE_ELIMINATION"
  | "DOUBLE_ELIMINATION"
  | "ROUND_ROBIN"
  | "GROUP_AND_SINGLE_ELIMINATION"
  | "GROUP_AND_DOUBLE_ELIMINATION";

// Non-power-of-two counts (7, 30) sit alongside clean ones on purpose —
// every format here (including double elimination) sizes its own
// bracket up to the next power of two internally and seeds the
// leftover slots as byes to the top seeds, so no team count needs to
// be excluded from any format.
const TEAM_COUNT_OPTIONS = [4, 7, 8, 16, 30, 32, 64];

// Rotating accent palette for group cards — mirrors the emerald/orange
// treatment DoubleElimBoard uses for Winners/Losers, just cycled per
// group so a 4/8-group stage doesn't read as one giant monotone wall.
const GROUP_ACCENTS = [
  { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", bar: "bg-emerald-400" },
  { text: "text-theme-orange", bg: "bg-theme-orange/10", border: "border-theme-orange/25", bar: "bg-theme-orange" },
  { text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/25", bar: "bg-sky-400" },
  { text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/25", bar: "bg-violet-400" },
];

export default function CustomBracketSandboxPage() {
  const params = useParams<{ slug: string }>();

  const [format, setFormat] = useState<FormatOption>("SINGLE_ELIMINATION");
  const [teamCount, setTeamCount] = useState(30);
  const [seeding, setSeeding] = useState<SeedingMode>("RANKING");
  const [thirdPlaceMatch, setThirdPlaceMatch] = useState(true);
  const [grandFinalReset, setGrandFinalReset] = useState(true);
  const [groupCount, setGroupCount] = useState(4);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);
  const [seed, setSeed] = useState(0); // bump to force a fresh random simulation

  const isDoubleElim = format === "DOUBLE_ELIMINATION";
  const isGroupFormat = format === "GROUP_AND_SINGLE_ELIMINATION" || format === "GROUP_AND_DOUBLE_ELIMINATION";

  const teams: SimTeam[] = useMemo(
    () => getDemoTeams(teamCount).map((t) => ({ id: t.id, code: t.code, name: t.name, logo: t.logo, color: (t as any).color })),
    [teamCount]
  );

  const singleElimResult = useMemo(() => {
    if (format !== "SINGLE_ELIMINATION") return null;
    const rounds = simulateSingleElimination(teams, { seeding });
    const thirdPlace = thirdPlaceMatch ? simulateThirdPlaceMatch(rounds) : { match: null };
    return { rounds, thirdPlace };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, teams, seeding, thirdPlaceMatch, seed]);

  const doubleElimResult = useMemo(() => {
    if (format !== "DOUBLE_ELIMINATION") return null;
    try {
      return simulateDoubleElimination(teams, { seeding, grandFinalReset });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, teams, seeding, grandFinalReset, seed]);

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
    const thirdPlace = thirdPlaceMatch ? simulateThirdPlaceMatch(knockout) : { match: null };
    return { groupResults, knockout, thirdPlace };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, teams, groupCount, qualifiersPerGroup, thirdPlaceMatch, seed]);

  const groupDoubleElimResult = useMemo(() => {
    if (format !== "GROUP_AND_DOUBLE_ELIMINATION") return null;
    const { groupResults, qualifiers } = simulateGroupStage(teams, groupCount, qualifiersPerGroup);
    try {
      const knockout = simulateDoubleElimination(qualifiers, { seeding: "RANKING", grandFinalReset });
      return { groupResults, knockout, qualifierCount: qualifiers.length };
    } catch {
      return { groupResults, knockout: null, qualifierCount: qualifiers.length };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, teams, groupCount, qualifiersPerGroup, grandFinalReset, seed]);

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
              <option value="GROUP_AND_DOUBLE_ELIMINATION">Groups + Double Elimination</option>
            </select>
          </Field>

          <Field label="Teams">
            <select value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))} className="sandbox-select">
              {TEAM_COUNT_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Seeding">
            <select value={seeding} onChange={(e) => setSeeding(e.target.value as SeedingMode)} className="sandbox-select">
              <option value="RANKING">Ranking order</option>
              <option value="RANDOM">Random</option>
            </select>
          </Field>

          {(format === "SINGLE_ELIMINATION" || format === "GROUP_AND_SINGLE_ELIMINATION") && (
            <ToggleField label="3rd place match" checked={thirdPlaceMatch} onChange={setThirdPlaceMatch} />
          )}

          {(format === "DOUBLE_ELIMINATION" || format === "GROUP_AND_DOUBLE_ELIMINATION") && (
            <ToggleField label="Grand final reset" checked={grandFinalReset} onChange={setGrandFinalReset} />
          )}

          {isGroupFormat && (
            <>
              <Field label="Groups">
                <select value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value))} className="sandbox-select">
                  {[2, 3, 4, 8].map((c) => (
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
      </div>

      {/* --- Single Elimination --- */}
      {format === "SINGLE_ELIMINATION" && singleElimResult && (
        <>
          <TournamentBracket
            rounds={singleElimResult.rounds}
            title="Custom Knockout Sandbox"
            eyebrowLabel={`Sandbox · Single Elimination · ${teamCount} teams`}
            helperText="Randomly simulated results — hit Re-simulate for a new run."
          />
          <ThirdPlaceBlock result={singleElimResult.thirdPlace} />
        </>
      )}

      {/* --- Double Elimination --- */}
      {format === "DOUBLE_ELIMINATION" && doubleElimResult && (
        <DoubleElimBoard
          data={{
            ...doubleElimResult,
            bracketReset: doubleElimResult.bracketReset ?? null,
          }}
          title="Custom Knockout Sandbox"
          eyebrowLabel={`Sandbox · Double Elimination · ${teamCount} teams`}
          helperText="Randomly simulated results — hit Re-simulate for a new run."
          onRecordResult={() => {}}
        />
      )}

      {/* --- Round Robin --- */}
      {format === "ROUND_ROBIN" && roundRobinResult && (
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <SandboxSectionHeading
            eyebrow={`Sandbox · Round Robin · ${teamCount} teams`}
            title="Round Robin Standings"
            helperText="Randomly simulated results — hit Re-simulate for a new run."
          />
          <RoundRobinStatStrip teamCount={teamCount} matches={roundRobinResult.played} />
          <StandingsCard
            heading="Standings"
            icon={<Trophy className="w-3.5 h-3.5" />}
            accent={GROUP_ACCENTS[0]}
            standings={roundRobinResult.standings}
            qualifyCount={2}
          />
          <FixtureList matches={roundRobinResult.played} />
        </div>
      )}

      {/* --- Groups + Single Elimination --- */}
      {format === "GROUP_AND_SINGLE_ELIMINATION" && groupResult && (
        <>
          <div className="max-w-[1400px] mx-auto px-8 pt-8">
            <SandboxSectionHeading
              eyebrow={`Sandbox · Group Stage · ${teamCount} teams`}
              title="Group Stage Standings"
              helperText={`Top ${qualifiersPerGroup} per group advances to the knockout stage.`}
            />
            <StageProgress steps={["Group Stage", "Knockout · Single Elimination"]} activeIndex={0} />
          </div>
          <div className="max-w-[1400px] mx-auto px-8 pb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {groupResult.groupResults.map((gr, i) => (
              <StandingsCard
                key={gr.name}
                heading={gr.name}
                icon={<Users className="w-3.5 h-3.5" />}
                accent={GROUP_ACCENTS[i % GROUP_ACCENTS.length]}
                standings={gr.standings}
                qualifyCount={qualifiersPerGroup}
                compact
              />
            ))}
          </div>
          <div className="max-w-[1400px] mx-auto px-8">
            <StageProgress steps={["Group Stage", "Knockout · Single Elimination"]} activeIndex={1} />
          </div>
          <TournamentBracket
            rounds={groupResult.knockout}
            title="Knockout Stage"
            eyebrowLabel="Sandbox · Post-Group Knockout"
            helperText="Top qualifiers from each group, seeded by group finish."
          />
          <ThirdPlaceBlock result={groupResult.thirdPlace} />
        </>
      )}

      {/* --- Groups + Double Elimination --- */}
      {format === "GROUP_AND_DOUBLE_ELIMINATION" && groupDoubleElimResult && (
        <>
          <div className="max-w-[1400px] mx-auto px-8 pt-8">
            <SandboxSectionHeading
              eyebrow={`Sandbox · Group Stage · ${teamCount} teams`}
              title="Group Stage Standings"
              helperText={`Top ${qualifiersPerGroup} per group advances to the double-elimination knockout.`}
            />
            <StageProgress
              steps={["Group Stage", "Knockout · Double Elimination"]}
              activeIndex={groupDoubleElimResult.knockout ? 1 : 0}
            />
          </div>
          <div className="max-w-[1400px] mx-auto px-8 pb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {groupDoubleElimResult.groupResults.map((gr, i) => (
              <StandingsCard
                key={gr.name}
                icon={<Users className="w-3.5 h-3.5" />}
                accent={GROUP_ACCENTS[i % GROUP_ACCENTS.length]}
                heading={gr.name}
                standings={gr.standings}
                qualifyCount={qualifiersPerGroup}
                compact
              />
            ))}
          </div>
          {groupDoubleElimResult.knockout && (
            <DoubleElimBoard
              data={{
                ...groupDoubleElimResult.knockout,
                bracketReset: groupDoubleElimResult.knockout.bracketReset ?? null,
              }}
              onRecordResult={() => {}}
            />
          )}
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

/** Same eyebrow/title/border-bottom pattern TournamentBracket and
 *  DoubleElimBoard use for their own headers — round robin and groups
 *  don't get one of those components' built-in headers, so this keeps
 *  them from reading as a plainer, less-finished section of the page. */
function SandboxSectionHeading({
  eyebrow,
  title,
  helperText,
}: {
  eyebrow: string;
  title: string;
  helperText: string;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-overlay pb-6 mb-8">
      <div>
        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] font-label-mono text-theme-orange">
          <Trophy className="w-3.5 h-3.5" />
          {eyebrow}
        </span>
        <h1 className="font-headline-lg font-bold text-3xl text-on-surface mt-1.5">{title}</h1>
      </div>
      <div className="flex items-center gap-4 bg-surface-container-low/70 backdrop-blur-xl px-4 py-2.5 rounded-xl border border-border-overlay">
        <p className="font-body-md text-[11px] text-outline">{helperText}</p>
      </div>
    </div>
  );
}

/** Breadcrumb-style stage stepper — "Group Stage → Knockout" — so a
 *  two-stage format reads as one continuous competition rather than two
 *  unrelated sections stacked on a page. Same pill/border language as
 *  the mobile round-selector pills in TournamentBracket. */
function StageProgress({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <div className="flex items-center flex-wrap gap-2 mb-8">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest font-label-mono border transition-colors ${
              i === activeIndex
                ? "bg-theme-orange border-theme-orange text-on-primary"
                : i < activeIndex
                ? "bg-theme-orange/10 border-theme-orange/40 text-theme-orange"
                : "bg-surface-container-low border-border-overlay text-outline"
            }`}
          >
            {i < activeIndex && <CheckCircle2 className="w-3 h-3 inline-block mr-1 -mt-0.5" strokeWidth={3} />}
            {step}
          </span>
          {i < steps.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-outline shrink-0" />}
        </div>
      ))}
    </div>
  );
}

/** Small stat chip strip above round-robin standings — same
 *  frosted/bordered chip DoubleElimBoard and TournamentBracket use in
 *  their headers for the live-legend/helper-text, repurposed here to
 *  surface competition shape (teams, matchdays, total fixtures) at a
 *  glance instead of making the reader count rows. */
function RoundRobinStatStrip({
  teamCount,
  matches,
}: {
  teamCount: number;
  matches: ReturnType<typeof simulateRoundRobinResults>;
}) {
  const matchdayCount = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
  const stats = [
    { label: "Teams", value: teamCount },
    { label: "Matchdays", value: matchdayCount },
    { label: "Fixtures", value: matches.length },
  ];
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex items-center gap-2 bg-surface-container-low/70 backdrop-blur-xl px-4 py-2.5 rounded-xl border border-border-overlay"
        >
          <span className="font-label-mono font-black text-sm text-theme-orange">{s.value}</span>
          <span className="font-label-mono text-[9px] uppercase tracking-widest text-outline">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Renders the 3rd-place match if one was produced, or a small inline
 *  note explaining why not (rather than just silently showing nothing,
 *  which would look like a bug rather than a deliberate bracket-shape
 *  outcome). */
function ThirdPlaceBlock({ result }: { result: { match: any; skippedReason?: string } }) {
  if (result.match) {
    return (
      <div className="max-w-xl mx-auto px-8 pb-12 -mt-4">
        <p className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline text-center mb-3">
          3rd Place Match
        </p>
        <MatchResultCard match={result.match} onRecordResult={() => {}} />
      </div>
    );
  }
  if (result.skippedReason) {
    const message =
      result.skippedReason === "NO_SEMIFINAL_ROUND"
        ? "Bracket is too small to have a distinct semifinal round, so there's no 3rd-place match to generate."
        : "A bye advanced straight into the semifinal, so there's no real loser to send to a 3rd-place decider this run.";
    return (
      <div className="max-w-xl mx-auto px-8 pb-12 -mt-4">
        <p className="flex items-center gap-2 text-[11px] font-label-mono text-outline justify-center">
          <Info className="w-3.5 h-3.5 shrink-0" />
          {message}
        </p>
      </div>
    );
  }
  return null;
}

type Accent = { text: string; bg: string; border: string; bar: string };

/** Standings, wrapped as a proper card with a banner header — same
 *  shell language as MatchResultCard (rounded-xl, bordered, shadowed
 *  surface-container-low) and the same colored-banner-with-accent-bar
 *  treatment DoubleElimBoard uses for its Winners/Losers sections, so
 *  round robin and groups don't look like a bare HTML table dropped
 *  into a much more polished page. Top 3 rows get a medal glyph instead
 *  of a plain rank number, matching the trophy-forward visual language
 *  the rest of the sandbox uses for "who's ahead". */
function StandingsCard({
  heading,
  icon,
  accent,
  standings,
  qualifyCount,
  compact,
}: {
  heading: string;
  icon: ReactNode;
  accent: Accent;
  standings: ReturnType<typeof computeStandings>;
  qualifyCount: number;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-xl overflow-hidden border ${accent.border} bg-surface-container-low shadow-2xl ${compact ? "" : "mb-8"}`}>
      <div className={`flex items-stretch ${accent.bg}`}>
        <div className={`w-1 shrink-0 ${accent.bar}`} />
        <div className="flex items-center justify-between w-full px-4 py-2.5">
          <span className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest font-label-mono ${accent.text}`}>
            {icon}
            {heading}
          </span>
          <span className="text-[9px] font-label-mono font-bold uppercase tracking-widest text-outline">
            Top {qualifyCount} qualify
          </span>
        </div>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline border-b border-border-overlay">
            <th className="py-2.5 pl-4 pr-2 w-8">#</th>
            <th className="py-2.5 pr-2">Team</th>
            <th className="py-2.5 px-2 text-center">P</th>
            <th className="py-2.5 px-2 text-center">W</th>
            {!compact && <th className="py-2.5 px-2 text-center">D</th>}
            <th className="py-2.5 px-2 text-center">L</th>
            <th className="py-2.5 pl-2 pr-4 text-center">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const qualified = i < qualifyCount;
            return (
              <tr
                key={s.team.id}
                className={`text-xs font-label-mono border-b border-border-overlay/50 last:border-b-0 transition-colors ${
                  qualified ? "bg-surface-container-high/40" : ""
                }`}
              >
                <td className="py-2.5 pl-4 pr-2 text-outline font-bold">{i + 1}</td>
                <td className="py-2.5 pr-2">
                  <div className="flex items-center gap-2.5 relative">
                    {qualified && (
                      <span className={`absolute -left-4 top-0 bottom-0 w-1 rounded-r-md ${accent.bar}`} />
                    )}
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 overflow-hidden bg-background"
                      style={{ color: s.team.color }}
                    >
                      {s.team.logo ? (
                        <img src={s.team.logo} alt="" className="w-full h-full object-cover p-0.5" />
                      ) : (
                        s.team.code
                      )}
                    </span>
                    <span className={`font-bold uppercase tracking-wide truncate ${qualified ? accent.text : "text-on-surface"}`}>
                      {s.team.name}
                    </span>
                    {qualified && <CheckCircle2 className={`w-3 h-3 shrink-0 ${accent.text}`} strokeWidth={3} />}
                  </div>
                </td>
                <td className="py-2.5 px-2 text-center text-outline">{s.played}</td>
                <td className="py-2.5 px-2 text-center text-outline">{s.won}</td>
                {!compact && <td className="py-2.5 px-2 text-center text-outline">{s.drawn}</td>}
                <td className="py-2.5 px-2 text-center text-outline">{s.lost}</td>
                <td className="py-2.5 pl-2 pr-4 text-center font-black text-on-surface">{s.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Fixtures organized into Matchday sections. Round robin ids are
 *  generated as `RR-{round}-{i}` (see generateRoundRobinSchedule), so
 *  the round number is parsed straight out of the id rather than
 *  assumed from a fixed chunk size — chunking by a fixed size breaks
 *  for odd team counts, since generateRoundRobinSchedule gives the bye
 *  team a rotating "day off" each round, so odd-count rounds have one
 *  fewer real match than even-count rounds. Parsing the id keeps every
 *  matchday grouped correctly regardless of team count parity. */
function FixtureList({
  matches,
}: {
  matches: ReturnType<typeof simulateRoundRobinResults>;
}) {
  const matchdays = useMemo(() => {
    const byRound = new Map<number, typeof matches>();
    for (const m of matches) {
      const parsed = /^RR-(\d+)-/.exec(m.id);
      const round = parsed ? Number(parsed[1]) : 1;
      if (!byRound.has(round)) byRound.set(round, []);
      byRound.get(round)!.push(m);
    }
    return [...byRound.entries()].sort((a, b) => a[0] - b[0]).map(([, ms]) => ms);
  }, [matches]);

  return (
    <div className="mt-8">
      <p className="text-[10px] font-label-mono font-black uppercase tracking-widest text-outline mb-4 flex items-center gap-2">
        <Layers className="w-3.5 h-3.5" />
        Fixtures
      </p>
      <div className="flex flex-col gap-6">
        {matchdays.map((dayMatches, i) => (
          <div key={i}>
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest font-label-mono bg-surface-container-low border border-border-overlay text-on-surface-variant shadow-lg">
                <CalendarDays className="w-3 h-3" />
                Matchday {i + 1}
              </span>
              <span className="flex-1 h-px bg-gradient-to-r from-border-overlay to-transparent" />
              <span className="flex items-center gap-1 text-[9px] font-label-mono font-bold uppercase tracking-widest text-outline">
                <Swords className="w-3 h-3" />
                {dayMatches.length} {dayMatches.length === 1 ? "match" : "matches"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dayMatches.map((m) => {
                const aWins = m.winner === "A";
                const bWins = m.winner === "B";
                return (
                  <div
                    key={m.id}
                    className="rounded-xl overflow-hidden bg-surface-container-low border border-border-overlay shadow-2xl p-2 flex flex-col gap-1.5"
                  >
                    <FixtureTeamRow code={m.teamA.code} name={m.teamA.name} color={m.teamA.color} logo={m.teamA.logo} score={m.scoreA ?? 0} winner={aWins} />
                    <FixtureTeamRow code={m.teamB.code} name={m.teamB.name} color={m.teamB.color} logo={m.teamB.logo} score={m.scoreB ?? 0} winner={bWins} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FixtureTeamRow({
  code,
  name,
  color,
  logo,
  score,
  winner,
}: {
  code: string;
  name: string;
  color: string;
  logo?: string;
  score: number;
  winner: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 p-1.5 rounded-lg relative bg-surface-container border transition-colors ${
        winner ? "border-theme-orange/40 bg-surface-container-high" : "border-border-overlay"
      }`}
    >
      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md" style={{ backgroundColor: color }} />
      <div className="flex items-center gap-2 pl-1.5 min-w-0">
        <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-background overflow-hidden font-label-mono font-black text-[9px]">
          {logo ? <img src={logo} alt="" className="w-full h-full object-cover p-0.5" /> : <span style={{ color }}>{code}</span>}
        </span>
        <span className={`font-label-mono font-bold text-xs uppercase tracking-wide truncate ${winner ? "text-theme-orange" : "text-on-surface"}`}>
          {name}
        </span>
      </div>
      <div className="flex items-center gap-1.5 pr-1 shrink-0 font-label-mono font-black text-sm">
        {winner && <CheckCircle2 className="w-3.5 h-3.5 text-theme-orange" strokeWidth={3} />}
        <span className={winner ? "text-theme-orange" : "text-outline"}>{score}</span>
      </div>
    </div>
  );
}