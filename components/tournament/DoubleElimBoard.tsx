// File: components/tournament/DoubleElimBoard.tsx
"use client";
import type { ReactNode } from "react";
import { Trophy, RotateCcw, Award } from "lucide-react";
import type { Round } from "@/components/tournament/TournamentBracket";
import type { DoubleElimData } from "@/lib/tournament/doubleElim";
import MatchResultCard from "./MatchResultCard";

type RecordFn = (matchId: string, winner: "A" | "B", scoreA: number, scoreB: number) => void;

export default function DoubleElimBoard({
  data,
  onRecordResult,
}: {
  data: DoubleElimData;
  onRecordResult: RecordFn;
}) {
  return (
    <div className="w-full bg-background text-on-surface">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-overlay pb-6">
          <div>
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] font-label-mono text-theme-orange">
              <Trophy className="w-3.5 h-3.5" />
              Knockout · Double Elimination
            </span>
            <h2 className="font-headline-lg font-bold text-2xl md:text-3xl text-on-surface mt-1.5">
              Winners &amp; Losers
            </h2>
          </div>
        </div>

        <BoardSection
          title="Winners Bracket"
          icon={<Trophy className="w-3.5 h-3.5" />}
          rounds={data.winners}
          onRecordResult={onRecordResult}
        />
        <BoardSection
          title="Losers Bracket"
          icon={<RotateCcw className="w-3.5 h-3.5" />}
          rounds={data.losers}
          onRecordResult={onRecordResult}
        />

        <div>
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest font-label-mono text-theme-orange mb-3">
            <Award className="w-3.5 h-3.5" />
            Grand Final
          </span>
          <div className="max-w-sm flex flex-col gap-4 rounded-2xl border border-theme-orange/30 bg-surface-container-low/60 p-4 shadow-[0_0_32px_rgba(201,151,31,0.08)]">
            <MatchResultCard match={data.grandFinal} onRecordResult={onRecordResult} />
            {data.bracketReset && (
              <>
                <p className="text-[9px] font-label-mono font-black uppercase tracking-widest text-outline text-center -mt-1">
                  Bracket Reset
                </p>
                <MatchResultCard match={data.bracketReset} onRecordResult={onRecordResult} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BoardSection({
  title,
  icon,
  rounds,
  onRecordResult,
}: {
  title: string;
  icon: ReactNode;
  rounds: Round[];
  onRecordResult: RecordFn;
}) {
  if (rounds.length === 0) return null;
  return (
    <div>
      <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest font-label-mono text-on-surface-variant mb-4">
        {icon}
        {title}
      </span>
      <div className="flex gap-4 overflow-x-auto pb-3">
        {rounds.map((round) => (
          <div key={round.id} className="min-w-[240px] flex flex-col items-center gap-3">
            <div className="w-full text-center relative">
              <span className="inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest font-label-mono bg-surface-container-low border border-border-overlay text-on-surface-variant shadow-lg">
                {round.name}
              </span>
              <div className="absolute left-0 right-0 top-1/2 -z-10 h-px bg-gradient-to-r from-transparent via-border-overlay to-transparent" />
            </div>
            <div className="w-full flex flex-col gap-4">
              {round.matches.map((match) => (
                <MatchResultCard key={match.id} match={match} onRecordResult={onRecordResult} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}