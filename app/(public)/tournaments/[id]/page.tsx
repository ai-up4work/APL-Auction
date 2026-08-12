// app/(protected)/tournaments/[id]/page.tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import TournamentDetailClient from "@/components/tournament/tournament-detail-client"
import { getTournamentById } from "@/lib/tournament/tournament"
import { getTournamentStats } from "@/data/match-data"

interface TournamentPageProps {
  params: Promise<{ id: string }>
}

// 1. Handle Metadata here
export async function generateMetadata(props: TournamentPageProps): Promise<Metadata> {
  const params = await props.params;
  const id = params?.id;

  if (!id) return { title: "Tournament Not Found | Valiant League" }

  const tournament = await getTournamentById(id)
  return {
    metadataBase: new URL('https://thewardens.online'),
    title: tournament ? `${tournament.title} | Valiant League` : "Tournament Not Found",
  }
}

// 2. Handle params and data fetching here
export default async function TournamentPage(props: TournamentPageProps) {
  const params = await props.params;
  const id = params?.id;

  if (!id) notFound();

  const tournament = await getTournamentById(id)

  if (!tournament) notFound();

  // Stats (battingStats/bowlingStats) live in a separate aggregation —
  // getTournamentStats scans `balls` across every match linked to this
  // tournament (direct FK, match_setup.tournamentId, and bracket_matches)
  // and rolls it up into per-player leaderboards. It's not part of
  // getTournamentById's own return shape, so it has to be fetched and
  // merged in here — otherwise tournament.battingStats/bowlingStats are
  // always undefined and the Stats tab stays permanently locked.
  const { battingStats, bowlingStats } = await getTournamentStats(id)

  const tournamentWithStats = {
    ...tournament,
    battingStats,
    bowlingStats,
  }

  // 3. Pass the clean data to your component
  return <TournamentDetailClient tournament={tournamentWithStats} slug={id} />
}