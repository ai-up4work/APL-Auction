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

  // `logo_url` is the tournament's own logo (separate from `image_url`,
  // the banner). Joined org logo is the fallback for tournaments that
  // haven't set their own yet — same pattern as the public bracket page.
  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select("id, name, format, org_id, logo_url, organizations:org_id ( logo_url )")
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

  // Supabase returns a to-one join as an object, but as an array in a
  // couple of client-version/query-shape combinations — normalize either
  // way rather than assuming.
  const org = Array.isArray(tournament.organizations)
    ? tournament.organizations[0]
    : tournament.organizations;
  const resolvedLogo = tournament.logo_url ?? org?.logo_url ?? undefined;

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
      initialLogoUrl={resolvedLogo}
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