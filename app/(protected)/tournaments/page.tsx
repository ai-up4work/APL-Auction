// app/tournaments/page.tsx
import type { Metadata } from "next"
import TournamentClient from "@/components/tournament/TournamentClient"

export const metadata: Metadata = {
  title: "Valiant League Tournament | Live Auctions, Brackets & Broadcast Overlays",
  description:
    "Run your cricket tournament on Valiant League — live player auctions, automatic brackets, and stream-ready broadcast overlays, all from one console.",
  alternates: { canonical: "https://thewardens.online/tournament" },
  openGraph: {
    title: "Valiant League Tournament | Live Auctions, Brackets & Broadcast Overlays",
    description:
      "Run your cricket tournament on Valiant League — live player auctions, automatic brackets, and stream-ready broadcast overlays, all from one console.",
    url: "https://thewardens.online/tournament",
    images: [
      {
        url: "https://thewardens.online/images/tournament-seo-home.png",
        width: 1200,
        height: 630,
        alt: "Valiant League Tournament",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@thewardensgc",
    creator: "@thewardensgc",
    images: ["https://thewardens.online/images/tournament-seo-home.png"],
  },
}

export default function TournamentPage() {
  return <TournamentClient />
}