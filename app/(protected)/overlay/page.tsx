// app/overlay/page.tsx
import type { Metadata } from "next"
import {
  getTournamentsWithFixtures,
  getAuctionsForManualOverlay,
} from "@/lib/tournament/overlay"
import OverlaySelectClient from "@/components/overlays/overlay-select-client"

export const metadata: Metadata = {
  title: "Select Match | Valiant League",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function OverlaySelectPage() {
  const [tournaments, auctions] = await Promise.all([
    getTournamentsWithFixtures(),
    getAuctionsForManualOverlay(),
  ])
  return <OverlaySelectClient tournaments={tournaments} auctions={auctions} />
}