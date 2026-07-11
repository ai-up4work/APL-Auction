// File: components/tournament/DoubleElimBoard.tsx
"use client";
import type { Round } from "@/components/tournament/TournamentBracket";
import type { DoubleElimData } from "@/lib/tournament/doubleElim";
import MatchResultCard from "./MatchResultCard";

type RecordFn = (matchId: string, winner: "A" | "B", scoreA: number, scoreB: number) => void;

export default function DoubleElimBoard({ data, onRecordResult }: { data: DoubleElimData; onRecordResult: RecordFn }) {
  return (
    <div className="flex flex-col gap-8">
      <BoardSection title="Winners Bracket" rounds={data.winners} onRecordResult={onRecordResult} />
      <BoardSection title="Losers Bracket" rounds={data.losers} onRecordResult={onRecordResult} />
      <div>
        <h3 className="font-label-mono text-[11px] font-black uppercase tracking-widest text-theme-orange mb-3">Grand Final</h3>
        <div className="max-w-sm flex flex-col gap-3">
          <MatchResultCard match={data.grandFinal} onRecordResult={onRecordResult} />
          {data.bracketReset && <MatchResultCard match={data.bracketReset} onRecordResult={onRecordResult} />}
        </div>
      </div>
    </div>
  );
}

function BoardSection({ title, rounds, onRecordResult }: { title: string; rounds: Round[]; onRecordResult: RecordFn }) {
  if (rounds.length === 0) return null;
  return (
    <div>
      <h3 className="font-label-mono text-[11px] font-black uppercase tracking-widest text-on-surface-variant mb-3">{title}</h3>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {rounds.map((round) => (
          <div key={round.id} className="min-w-[240px] flex flex-col gap-3">
            <p className="font-label-mono text-[10px] font-bold uppercase tracking-widest text-outline text-center">{round.name}</p>
            {round.matches.map((match) => (
              <MatchResultCard key={match.id} match={match} onRecordResult={onRecordResult} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}