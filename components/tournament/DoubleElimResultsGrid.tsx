// File: components/tournament/DoubleElimResultsGrid.tsx
"use client";
import type { MatchNode, Round } from "@/components/tournament/TournamentBracket";
import type { DoubleElimData } from "@/lib/tournament/doubleElim";
import MatchResultCard from "./MatchResultCard";

type RecordFn = (matchId: string, winner: "A" | "B", scoreA: number, scoreB: number) => void;

export interface DoubleElimResultsGridProps {
  data: DoubleElimData;
  onRecordResult: RecordFn;
}

/** The double-elimination equivalent of the flat-bracket `ResultsGrid`
 *  used for single elimination / group-knockout. Those formats produce
 *  one flat Round[], so a single grid works. Double elimination's data
 *  shape is different — two separate round arrays (winners, losers)
 *  plus standalone grand-final / bracket-reset matches — so instead of
 *  forcing that into ResultsGrid's Round[] prop, this component renders
 *  three clearly labelled sections, each using the same per-round
 *  horizontal-scroll layout so it still *looks* consistent with the
 *  other formats' results grids. */
export default function DoubleElimResultsGrid({ data, onRecordResult }: DoubleElimResultsGridProps) {
  return (
    <div className="flex flex-col gap-8">
      <RoundsSection
        title="Winners bracket · enter results"
        rounds={data.winners}
        onRecordResult={onRecordResult}
        accentClass="text-emerald-400"
      />
      <RoundsSection
        title="Losers bracket · enter results"
        rounds={data.losers}
        onRecordResult={onRecordResult}
        accentClass="text-orange-400"
      />
      <FinalsSection
        grandFinal={data.grandFinal}
        bracketReset={data.bracketReset}
        onRecordResult={onRecordResult}
      />
    </div>
  );
}

function RoundsSection({
  title,
  rounds,
  onRecordResult,
  accentClass,
}: {
  title: string;
  rounds: Round[];
  onRecordResult: RecordFn;
  accentClass: string;
}) {
  if (!rounds.length) return null;
  return (
    <div>
      <h3 className={`font-label-mono text-[11px] font-black uppercase tracking-widest mb-3 ${accentClass}`}>
        {title}
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

function FinalsSection({
  grandFinal,
  bracketReset,
  onRecordResult,
}: {
  grandFinal: MatchNode;
  bracketReset?: MatchNode | null;
  onRecordResult: RecordFn;
}) {
  return (
    <div>
      <h3 className="font-label-mono text-[11px] font-black uppercase tracking-widest text-theme-orange mb-3">
        Grand final · enter results
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-2">
        <div className="min-w-[220px] flex flex-col gap-3">
          <p className="font-label-mono text-[10px] font-bold uppercase tracking-widest text-outline text-center">
            Grand final
          </p>
          <MatchResultCard match={grandFinal} onRecordResult={onRecordResult} />
        </div>
        {bracketReset && (
          <div className="min-w-[220px] flex flex-col gap-3">
            <p className="font-label-mono text-[10px] font-bold uppercase tracking-widest text-outline text-center">
              Bracket reset · decider
            </p>
            <MatchResultCard match={bracketReset} onRecordResult={onRecordResult} />
          </div>
        )}
      </div>
    </div>
  );
}