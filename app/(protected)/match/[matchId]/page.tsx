// app/match/[matchId]/page.tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import MatchDetailClient from "@/components/tournament/match-detail-client"
import { getMatchDetailById } from "@/data/match-data"

interface MatchPageProps {
  params: Promise<{ matchId: string }>
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { matchId } = await params
  const match = await getMatchDetailById(matchId)

  if (!match) {
    return { title: "Match Not Found | Valiant League" }
  }

  const title = `${match.teamA.name} vs ${match.teamB.name} — ${match.round} | Valiant League`
  const description = match.tournamentName
    ? `${match.round} of ${match.tournamentName}: ${match.teamA.name} vs ${match.teamB.name} at ${match.venue}.`
    : `${match.teamA.name} vs ${match.teamB.name} at ${match.venue}.`

  return {
    title,
    description,
    alternates: { canonical: `https://thewardens.online/match/${matchId}` },
    openGraph: { title, description },
  }
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { matchId } = await params
  const match = await getMatchDetailById(matchId)

  if (!match) {
    notFound()
  }

  return <MatchDetailClient match={match} tournamentSlug={match.tournamentSlug} />
}