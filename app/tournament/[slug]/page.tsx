// app/tournament/[slug]/page.tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import TournamentDetailClient from "@/components/tournament/tournament-detail-client"
import { getTournamentBySlug } from "@/data/tournament-data"

interface TournamentPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: TournamentPageProps): Promise<Metadata> {
  const { slug } = await params
  const tournament = getTournamentBySlug(slug)

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
    alternates: { canonical: `https://thewardens.online/tournament/${slug}` },
    openGraph: {
      title,
      description,
      images: tournament.image ? [{ url: tournament.image }] : undefined,
    },
  }
}

export default async function TournamentPage({ params }: TournamentPageProps) {
  const { slug } = await params
  const tournament = getTournamentBySlug(slug)

  if (!tournament) {
    notFound()
  }

  return <TournamentDetailClient tournament={tournament} slug={slug} />
}