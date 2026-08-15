// app/(public)/(navLinks)/all-players/[id]/page.tsx
import type { Metadata } from "next"
import PlayerDetailClient from "@/components/landing/player-detail-client"

export const metadata: Metadata = {
  title: "Player | Valiant League",
}

export default function PlayerDetailPage({ params }: { params: { id: string } }) {
  return <PlayerDetailClient id={params.id} />
}