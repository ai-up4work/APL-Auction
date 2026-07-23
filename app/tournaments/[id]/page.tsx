import type { Metadata } from "next"
import { notFound } from "next/navigation"
import TournamentDetailClient from "@/components/tournament/tournament-detail-client"
import { getTournamentById } from "@/lib/tournament/tournament"

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

  // 3. Pass the clean data to your component
  return <TournamentDetailClient tournament={tournament} slug={id} />
}