// app/tournaments/[slug]/match/[matchId]/page.tsx
import type { ComponentProps } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import MatchDetailClient from "@/components/tournament/match-detail-client"
import { getMatchDetailById, getTournamentBySlug } from "@/data/tournament-data"

interface MatchPageProps {
  params: Promise<{ slug: string; matchId: string }>
}

// `getMatchDetailById` returns tournament-data's `MatchDetail` shape, but
// `MatchDetailClient` expects the (structurally different) `MatchDetail`
// type from `@/data/match-data`. Rather than importing that type directly
// here — which would require this file to know which of the two
// same-named types is "correct" — we derive it straight from the
// component's own prop signature, the same way match-detail-client.tsx
// itself bridges the two types when passing data into MatchGraphs.
type ClientMatch = ComponentProps<typeof MatchDetailClient>["match"]

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { slug, matchId } = await params
  const match = getMatchDetailById(slug, matchId)

  if (!match) {
    return { title: "Match Not Found | Valiant League" }
  }

  const title = `${match.teamA.name} vs ${match.teamB.name} — ${match.round} | Valiant League`
  const description = `${match.round} of ${match.tournamentName}: ${match.teamA.name} vs ${match.teamB.name} at ${match.venue}.`

  return {
    title,
    description,
    alternates: { canonical: `https://thewardens.online/tournaments/${slug}/match/${matchId}` },
    openGraph: { title, description },
  }
}

/** Shown in place of the match page when either the tournament slug or
 *  the match id doesn't resolve to real data. Renders inline instead of
 *  calling notFound(), so a stale/mistyped match link stays on-brand and
 *  gives the visitor a way back, rather than dropping to Next's generic
 *  404 page. */
function MatchUnavailable({ slug, tournamentExists }: { slug: string; tournamentExists: boolean }) {
  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4 py-24">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-white/5 border border-gold/20 flex items-center justify-center">
          <SearchX className="h-7 w-7 text-gold" />
        </div>
        <h1 className="text-2xl font-bold text-white font-cinzel tracking-wide mb-3">
          {tournamentExists ? "Match not found" : "Tournament not found"}
        </h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          {tournamentExists
            ? "We couldn't find a match at this link. It may have been removed, or the link might be out of date."
            : `We couldn't find a tournament matching "${slug}". Double-check the link, or head back to browse current tournaments.`}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {tournamentExists && (
            <Link href={`/tournaments/${slug}`}>
              <Button className="bg-gold hover:bg-gold/90 text-black font-bold w-full sm:w-auto">
                Back to Tournament
              </Button>
            </Link>
          )}
          <Link href="/">
            <Button
              variant={tournamentExists ? "outline" : "default"}
              className={
                tournamentExists
                  ? "border-gold/30 text-gray-200 hover:bg-white/5 w-full sm:w-auto"
                  : "bg-gold hover:bg-gold/90 text-black font-bold w-full sm:w-auto"
              }
            >
              Back Home
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { slug, matchId } = await params
  const match = getMatchDetailById(slug, matchId)
  const tournament = getTournamentBySlug(slug)

  if (!match || !tournament) {
    return <MatchUnavailable slug={slug} tournamentExists={Boolean(tournament)} />
  }

  return <MatchDetailClient match={match as unknown as ClientMatch} tournamentSlug={slug} />
}