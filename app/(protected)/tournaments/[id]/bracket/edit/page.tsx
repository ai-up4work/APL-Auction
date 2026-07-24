// app/(protected)/tournaments/[id]/bracket/edit/page.tsx
import { supabase } from "@/lib/supabase";
import BracketEditClient from "@/components/tournament/BracketEditClient";
import {
  getBracketMatchesForTournament,
  buildSingleEliminationRounds,
  buildDoubleEliminationData,
} from "@/lib/tournament/bracketData";

export default async function TournamentBracketEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select("id, name, format, org_id")
    .eq("id", id)
    .single();

  if (error || !tournament) {
    return <EmptyState message="Tournament not found." />;
  }

  if (tournament.format === "round_robin") {
    return (
      <EmptyState message="Round-robin tournaments don't use a bracket — there's nothing to edit here." />
    );
  }

  const rows = await getBracketMatchesForTournament(tournament.id);

  const singleRounds =
    tournament.format === "single_elimination" && rows.length > 0
      ? buildSingleEliminationRounds(rows)
      : null;

  const doubleData =
    tournament.format === "double_elimination" && rows.length > 0
      ? buildDoubleEliminationData(rows)
      : null;

  return (
    <BracketEditClient
      tournamentId={tournament.id}
      tournamentOrgId={tournament.org_id}
      tournamentName={tournament.name}
      format={tournament.format as "single_elimination" | "double_elimination"}
      initialSingleRounds={singleRounds}
      initialDoubleData={doubleData}
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