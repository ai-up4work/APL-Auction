// app/match/[matchId]/page.tsx
import type { Metadata } from "next"
import MatchDetailClient from "@/components/tournament/match-detail-client"
import { getMatchDetailById } from "@/data/match-data"

interface MatchPageProps {
  params: Promise<{ matchId: string }>
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { matchId } = await params
  const result = await getMatchDetailById(matchId)

  if (!result.ok) {
    return { title: "Match Not Found | Valiant League" }
  }

  const match = result.match
  const title = `${match.teamA.name} vs ${match.teamB.name} — ${match.round} | Valiant League`
  const description = match.tournamentName
    ? `${match.round} of ${match.tournamentName}: ${match.teamA.name} vs ${match.teamB.name} at ${match.venue}.`
    : `${match.teamA.name} vs ${match.teamB.name} at ${match.venue}.`

  return {
    title,
    description,
    alternates: { canonical: `https://thewardens.online/match/${matchId}` },
    openGraph: { title, description },
  }
}

// Human-readable label + suggested next step per failure reason. Kept here
// (rather than in match-data.ts) since it's presentation, not data logic.
const REASON_COPY: Record<
  string,
  { label: string; suggestion: string }
> = {
  match_not_found: {
    label: "Match not found",
    suggestion:
      "Check that this ID exists in the \"matches\" table, and that Row-Level Security policies on \"matches\" allow this request to read it.",
  },
  match_setup_invalid: {
    label: "Match setup is malformed",
    suggestion:
      "The \"match_setup\" jsonb column is missing or doesn't have the expected teamAId/teamBId keys. Check whatever wrote this row.",
  },
  teams_not_found: {
    label: "Team data missing",
    suggestion:
      "The team IDs referenced by this match's setup don't resolve in the \"teams\" table (wrong IDs, or RLS hiding them).",
  },
  tournament_mismatch: {
    label: "Wrong tournament in URL",
    suggestion: "This match exists, but it belongs to a different tournament than the one in this URL.",
  },
  balls_query_failed: {
    label: "Ball-by-ball data query failed",
    suggestion: "The \"balls\" table query errored — check RLS policies or the query itself.",
  },
}

function MatchLookupError({
  matchId,
  reason,
  message,
  detail,
}: {
  matchId: string
  reason: string
  message: string
  detail?: string
}) {
  const copy = REASON_COPY[reason] ?? {
    label: "Unknown error",
    suggestion: "This failure reason isn't mapped yet — check match-data.ts.",
  }
  const isDev = process.env.NODE_ENV === "development"

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4 py-24">
      <div className="w-full max-w-xl bg-black/60 border border-red-500/30 rounded-xl p-8 shadow-[0_0_40px_rgba(220,38,38,0.08)]">
        <div className="flex items-center gap-3 mb-4">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
          <span className="text-red-400 text-xs uppercase tracking-widest font-bold font-cinzel">
            {copy.label}
          </span>
        </div>

        <h1 className="text-white text-lg font-semibold mb-2">{message}</h1>
        <p className="text-gray-400 text-sm mb-6">{copy.suggestion}</p>

        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 space-y-2">
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-gray-500 uppercase tracking-wide shrink-0">Match ID</span>
            <span className="text-gray-300 font-mono text-right break-all">{matchId}</span>
          </div>
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-gray-500 uppercase tracking-wide shrink-0">Reason</span>
            <span className="text-gray-300 font-mono text-right break-all">{reason}</span>
          </div>
        </div>

        {isDev && detail && (
          <div className="mt-4 bg-red-950/30 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-300 text-[10px] uppercase tracking-widest font-bold mb-2">
              Dev-only detail (hidden in production)
            </p>
            <p className="text-red-200/90 text-xs font-mono leading-relaxed break-words">{detail}</p>
          </div>
        )}

        <a
          href="/"
          className="inline-block mt-6 text-xs uppercase tracking-widest font-bold text-gold hover:underline"
        >
          ← Back home
        </a>
      </div>
    </main>
  )
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { matchId } = await params
  const result = await getMatchDetailById(matchId)

  if (!result.ok) {
    return (
      <MatchLookupError
        matchId={matchId}
        reason={result.reason}
        message={result.message}
        detail={result.detail}
      />
    )
  }

  return <MatchDetailClient match={result.match} tournamentSlug={result.match.tournamentSlug} />
}