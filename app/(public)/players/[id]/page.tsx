import type { Metadata } from "next"
import PlayerDetailClient from "@/components/landing/player-detail-client"

export const metadata: Metadata = {
  title: "Player | Valiant League",
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PlayerDetailClient id={id} />
}