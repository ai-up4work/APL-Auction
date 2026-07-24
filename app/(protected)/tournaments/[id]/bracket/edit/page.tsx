// app/(protected)/tournaments/[id]/bracket/edit/page.tsx
import { supabase } from "@/lib/supabase";
import BracketEditClient from "@/components/tournament/BracketEditClient";
import {
  getBracketMatchesForTournament,
  buildSingleEliminationRounds,
  buildDoubleEliminationData,
} from "@/lib/tournament/bracketData";

// This page reads bracket_matches straight from Supabase and relies on
// router.refresh() (called right after delete/generate mutations) to show
// the latest rows. Without this, Next.js's default fetch/route caching
// can serve a stale render — e.g. matches that were just deleted, or
// missing ones that were just created — instead of re-querying the DB.
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    <div className="min-h-[300px] w-full flex items-center justify-center text-outline font-label-mono text-sm text-center">
      {message}
    </div>
  );
}