import { supabase } from "@/lib/supabase";
import BracketPageClient from "@/components/tournament/BracketPageClient";
import {
  getBracketMatchesForTournament,
  buildSingleEliminationRounds,
  buildDoubleEliminationData,
} from "@/lib/tournament/bracketData";

export default async function TournamentBracketPage({
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
      <EmptyState message="This is a round-robin tournament — check the Points Table instead of a bracket." />
    );
  }

  const rows = await getBracketMatchesForTournament(tournament.id);
  if (rows.length === 0) {
    return <EmptyState message="The bracket hasn't been generated for this tournament yet." />;
  }

  // Auth/org-ownership check happens client-side in BracketPageClient
  // (same pattern as TournamentEditClient) — this just passes the org_id
  // needed for that gate. RLS on bracket_matches is the real boundary.
  if (tournament.format === "double_elimination") {
    const data = buildDoubleEliminationData(rows);
    if (!data) return <EmptyState message="Bracket data looks incomplete — missing a grand final." />;
    return (
      <BracketPageClient
        format="double"
        doubleData={data}
        title={tournament.name}
        tournamentOrgId={tournament.org_id}
      />
    );
  }

  const rounds = buildSingleEliminationRounds(rows);
  return (
    <BracketPageClient
      format="single"
      singleRounds={rounds}
      title={tournament.name}
      tournamentOrgId={tournament.org_id}
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