// app/tournament/[slug]/match/[matchId]/page.tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import MatchDetailClient from "@/components/tournament/match-detail-client"
import { getMatchDetailById, getTournamentBySlug } from "@/data/tournament-data"

interface MatchPageProps {
  params: Promise<{ slug: string; matchId: string }>
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { slug, matchId } = await params
  const match = getMatchDetailById(slug, matchId)

  if (!match) {
    return { title: "Match Not Found | Valiant League" }
  }

  const title = `${match.teamA.name} vs ${match.teamB.name} — ${match.round} | Valiant League`
  const description = `${match.round} of ${match.tournamentName}: ${match.teamA.name} vs ${match.teamB.name} at ${match.venue}.`

  return {
    title,
    description,
    alternates: { canonical: `https://thewardens.online/tournament/${slug}/match/${matchId}` },
    openGraph: { title, description },
  }
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { slug, matchId } = await params
  const match = getMatchDetailById(slug, matchId)
  const tournament = getTournamentBySlug(slug)

  if (!match || !tournament) {
    notFound()
  }

  return <MatchDetailClient match={match} tournamentSlug={slug} />
}