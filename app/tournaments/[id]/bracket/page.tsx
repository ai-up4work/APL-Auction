import { supabase } from "@/lib/supabase";
import TournamentBracket from "@/components/tournament/TournamentBracket";
import DoubleElimBracketClient from "@/components/tournament/DoubleElimBracketClient";
import {
  getBracketMatchesForTournament,
  buildSingleEliminationRounds,
  buildDoubleEliminationData,
} from "@/lib/tournament/bracketData";

export default async function TournamentBracketPage({ params }: { params: { id: string } }) {
  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select("id, name, format")
    .eq("id", params.id)
    .single();

  if (error || !tournament) {
    return <EmptyState message="Tournament not found." />;
  }

  if (tournament.format === "round_robin") {
    return (
      <EmptyState message="This is a round-robin tournament — check the Points Table instead of a bracket." />
    );
  }

  const rows = await getBracketMatchesForTournament(tournament.id);
  if (rows.length === 0) {
    return <EmptyState message="The bracket hasn't been generated for this tournament yet." />;
  }

  if (tournament.format === "double_elimination") {
    const data = buildDoubleEliminationData(rows);
    if (!data) return <EmptyState message="Bracket data looks incomplete — missing a grand final." />;
    return <DoubleElimBracketClient data={data} title={tournament.name} />;
  }

  // single_elimination
  const rounds = buildSingleEliminationRounds(rows);
  return (
    <TournamentBracket
      rounds={rounds}
      title={tournament.name}
      eyebrowLabel="Knockout Stage"
      helperText="Hover or click a team to trace their path."
    />
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="min-h-[300px] w-full flex items-center justify-center text-outline font-label-mono text-sm text-center px-6">
      {message}
    </div>
  );
}