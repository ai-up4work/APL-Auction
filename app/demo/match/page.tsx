import { getMockMatchDetail } from "@/data/mock-match-data"
import MatchDetailClient from "@/components/tournament/match-detail-client"

export default function DemoMatchPage() {
  const result = getMockMatchDetail()
  if (!result.ok) return null
  return <MatchDetailClient match={result.match} tournamentSlug={result.match.tournamentSlug} />
}