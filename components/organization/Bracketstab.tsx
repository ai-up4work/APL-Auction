"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Trophy, Brackets, ArrowRight } from "lucide-react"
import { Panel, StatusBadge } from "@/components/organization/shared"
import { getTournamentsForOrg, type OrgSummary, type TournamentSummary } from "@/lib/organization/organization"

/* ────────────────────────────────────────────────────────────────── */
/*  BRACKET CARD — one tournament, its format/status, and a link         */
/*  straight into its live bracket at /tournaments/[id]/bracket — the      */
/*  same route the bracket icon on the Tournaments tab points to.          */
/*  Editing the bracket's structure still happens from Tournaments;         */
/*  this tab exists purely so a broadcast operator can pull any             */
/*  tournament's bracket up on-air without digging through Rosters/Events.  */
/* ────────────────────────────────────────────────────────────────── */

function BracketCard({ tournament }: { tournament: TournamentSummary }) {
  const thumb = tournament.logoUrl || tournament.imageUrl

  return (
    <Link
      href={`/tournaments/${tournament.id}/bracket`}
      className="block bg-black/50 border border-gold/20 hover:border-gold/40 transition-all duration-300 rounded-lg p-5 shadow-lg shadow-black/40"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="h-11 w-11 rounded-md overflow-hidden border border-gold/20 bg-black/60 flex items-center justify-center shrink-0">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <Trophy className="h-4 w-4 text-gold/30" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-bold font-cinzel truncate">{tournament.name}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <StatusBadge tone="neutral">{tournament.format.replace("_", " ")}</StatusBadge>
            <StatusBadge tone={tournament.status === "setup" ? "warn" : "linked"}>{tournament.status}</StatusBadge>
          </div>
        </div>
      </div>

      <span className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-gray-400 hover:text-gold transition-colors pt-3 border-t border-white/5">
        View bracket <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  BRACKETS TAB                                                          */
/* ────────────────────────────────────────────────────────────────── */

export function BracketsTab({ org }: { org: OrgSummary }) {
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getTournamentsForOrg(org.id)
      .then(setTournaments)
      .finally(() => setLoaded(true))
  }, [org.id])

  // Round-robin tournaments have no bracket to show — /tournaments/[id]/bracket
  // just renders an empty state pointing to the Points Table instead — so
  // they're left out of this grid rather than linking to a dead end.
  const bracketable = tournaments.filter((t) => t.format !== "round_robin")
  const roundRobinCount = tournaments.length - bracketable.length

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-1 flex items-center gap-2">
          <Brackets className="h-4 w-4 text-gold" /> Brackets
        </h2>
        <p className="text-gray-500 text-xs">
          Every knockout tournament's live bracket, one click away for on-air display. Editing a bracket's
          structure or seeding still happens from the Tournaments tab — this is just the fast path to pull one up.
          {roundRobinCount > 0 &&
            ` Round-robin tournaments aren't shown here — check their Points Table instead.`}
        </p>
      </Panel>

      {!loaded ? (
        <p className="text-gray-500 text-sm flex items-center gap-2 px-1">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : bracketable.length === 0 ? (
        <Panel>
          <p className="text-gray-500 text-sm italic text-center">
            {tournaments.length === 0
              ? "No tournaments yet — create one from the Tournaments tab first."
              : "No knockout tournaments yet — your tournaments so far are all round-robin, which use a Points Table instead of a bracket."}
          </p>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bracketable.map((t) => (
            <BracketCard key={t.id} tournament={t} />
          ))}
        </div>
      )}
    </div>
  )
}