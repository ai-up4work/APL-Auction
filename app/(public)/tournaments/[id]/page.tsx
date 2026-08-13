// app/(protected)/tournaments/[id]/page.tsx
import type { Metadata } from "next"
import { cache } from "react"
import { notFound } from "next/navigation"
import TournamentDetailClient from "@/components/tournament/tournament-detail-client"
import { getTournamentById } from "@/lib/tournament/tournament"
import { getTournamentStats } from "@/data/match-data"
import { recomputeStandingsForTournament } from "@/lib/tournament/standings"

interface TournamentPageProps {
  params: Promise<{ id: string }>
}

const getTournamentByIdCached = cache(getTournamentById)

// 1. Handle Metadata here
export async function generateMetadata(props: TournamentPageProps): Promise<Metadata> {
  const params = await props.params
  const id = params?.id

  if (!id) return { title: "Tournament Not Found | Valiant League" }

  const tournament = await getTournamentByIdCached(id)
  return {
    metadataBase: new URL("https://thewardens.online"),
    title: tournament ? `${tournament.title} | Valiant League` : "Tournament Not Found",
  }
}

// 2. Handle params and data fetching here
export default async function TournamentPage(props: TournamentPageProps) {
  const params = await props.params
  const id = params?.id

  if (!id) notFound()

  // WHY THIS RUNS HERE:
  // getTournamentById -> getPointsTableForTournament reads FROM
  // `standings`, but nothing was writing TO `standings` -- the table
  // just sat empty, so pointsTable was always [] and the Points Table
  // tab stayed permanently locked no matter how many matches finished.
  //
  // The correct long-term fix is calling recomputeStandingsForTournament
  // right where a bracket_matches row flips to status: 'completed' (your
  // scoring/bracket-admin flow -- not shown to me yet), so standings stay
  // fresh without a write on every page load. Until that call site is
  // wired up, this route is the only place guaranteed to run before
  // anyone sees the Points Table, so it recomputes standings here,
  // awaited BEFORE fetching the tournament, so the same request's
  // getPointsTableForTournament call sees fresh rows instead of last
  // page-load's data (or nothing).
  //
  // TRADE-OFF: this makes every tournament-page view a `standings`
  // delete+reinsert, not just a read. Fine for moderate traffic; if this
  // page gets hit hard, move this call to the real match-completion
  // trigger instead and delete it from here.
  const standingsRecompute = recomputeStandingsForTournament(id)
  const statsPromise = getTournamentStats(id)

  await standingsRecompute // must finish before getTournamentById reads standings

  const [tournament, stats] = await Promise.all([
    getTournamentByIdCached(id),
    statsPromise,
  ])

  if (!tournament) notFound()

  const tournamentWithStats = {
    ...tournament,
    battingStats: stats.battingStats,
    bowlingStats: stats.bowlingStats,
  }

  // 3. Pass the clean data to your component
  return <TournamentDetailClient tournament={tournamentWithStats} slug={id} />
}