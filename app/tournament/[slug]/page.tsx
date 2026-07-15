import type { Metadata } from "next"
import { notFound } from "next/navigation"
import TournamentDetailClient from "@/components/tournament/tournament-detail-client"
import { showcaseSlides, slugify, getTournamentBySlug } from "@/data/site-data"

interface TournamentPageProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return showcaseSlides.map((t) => ({ slug: slugify(t.title) }))
}

export async function generateMetadata({ params }: TournamentPageProps): Promise<Metadata> {
  const { slug } = await params
  const tournament = getTournamentBySlug(slug)

  if (!tournament) {
    return { title: "Tournament Not Found | Valiant League" }
  }

  const title = `${tournament.title} | Valiant League Tournament`
  const description =
    tournament.description ||
    `${tournament.title} — ${tournament.by}. Run on Valiant League with live auctions, automatic brackets, and broadcast-ready overlays.`
  const url = `https://thewardens.online/tournament/${slug}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      images: [
        {
          url: tournament.image,
          width: 1200,
          height: 630,
          alt: tournament.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@thewardensgc",
      creator: "@thewardensgc",
      images: [tournament.image],
    },
  }
}

export default async function TournamentSlugPage({ params }: TournamentPageProps) {
  const { slug } = await params
  const tournament = getTournamentBySlug(slug)

  if (!tournament) {
    notFound()
  }

  return <TournamentDetailClient tournament={tournament} slug={slug} />
}