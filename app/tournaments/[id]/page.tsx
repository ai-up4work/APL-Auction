// app/tournament/[id]/page.tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import TournamentDetailClient from "@/components/tournament/tournament-detail-client"
import { getTournamentById } from "@/lib/tournament/tournament"

interface TournamentPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: TournamentPageProps): Promise<Metadata> {
  const { id } = await params
  const tournament = await getTournamentById(id)

  if (!tournament) {
    return { title: "Tournament Not Found | Valiant League" }
  }

  const title = `${tournament.title} | Valiant League`
  const description =
    tournament.description ||
    `${tournament.title} — ${tournament.by}. Live scores, points tables, and broadcast overlays on Valiant League.`

  return {
    title,
    description,
    alternates: { canonical: `https://thewardens.online/tournament/${id}` },
    openGraph: {
      title,
      description,
      images: tournament.image ? [{ url: tournament.image }] : undefined,
    },
  }
}

export default async function TournamentPage({ params }: TournamentPageProps) {
  const { id } = await params
  const tournament = await getTournamentById(id)

  if (!tournament) {
    notFound()
  }

  return <TournamentDetailClient tournament={tournament} slug={id} />
}