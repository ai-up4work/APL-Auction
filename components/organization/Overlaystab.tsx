"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Tv, Swords, ArrowRight, Info } from "lucide-react"
import { getFriendlyMatchesForOrg, type OrgSummary, type FriendlyMatchSummary } from "@/lib/organization/organization"

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-black/50 border border-gold/20 shine hover:border-gold/40 transition-all duration-300 rounded-lg p-6 md:p-8 shadow-lg shadow-black/40 ${className}`}
    >
      {children}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  MATCH REFERENCE — small helper turning a match into a consistent      */
/*  "Team A vs Team B — Round" label, used on each card so the match       */
/*  reference is never ambiguous.                                          */
/* ────────────────────────────────────────────────────────────────── */

function matchLabel(m: FriendlyMatchSummary): string {
  const teams = `${m.team1Name} vs ${m.team2Name}`
  return m.round ? `${teams} — ${m.round}` : teams
}

/* ────────────────────────────────────────────────────────────────── */
/*  OVERLAY CARD — one match, its overlay status, and a link straight     */
/*  into the real Overlay Control Room, which lives at                     */
/*  /overlay/[auctionId]/admin and resolves strictly by `auction_id`        */
/*  (see matchPersistence.ts's getOrCreateMatch). For a manual-entry        */
/*  match, `auctionId` is a synthetic id equal to `id`; for an               */
/*  auction-sourced match it's the real auction's id — never assume the      */
/*  two are equal, always use `match.auctionId`. */
/* ────────────────────────────────────────────────────────────────── */

function OverlayCard({ match }: { match: FriendlyMatchSummary }) {
  return (
    <div className="bg-black/50 border border-gold/20 hover:border-gold/40 transition-all duration-300 rounded-lg p-5 shadow-lg shadow-black/40">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-full overflow-hidden border border-white/10 bg-black/60 shrink-0 flex items-center justify-center">
          {match.team1Logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.team1Logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <Swords className="h-3 w-3 text-gray-500" />
          )}
        </div>
        <div className="h-7 w-7 rounded-full overflow-hidden border border-white/10 bg-black/60 shrink-0 flex items-center justify-center -ml-2">
          {match.team2Logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.team2Logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <Swords className="h-3 w-3 text-gray-500" />
          )}
        </div>
        <span
          className={`ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded-full border ${
            match.overlayConfigured
              ? "border-green-500/40 text-green-400 bg-green-500/[0.08]"
              : "border-white/15 text-gray-500 bg-white/[0.02]"
          }`}
        >
          {match.overlayConfigured ? "Configured" : "Not configured"}
        </span>
      </div>

      <p className="text-white text-sm font-bold font-cinzel truncate mb-1">
        {match.team1Name} <span className="text-gray-500 font-normal">vs</span> {match.team2Name}
      </p>
      <p className="text-gray-500 text-xs truncate mb-4">{match.round}</p>

      <Link
        href={`/overlay/${match.auctionId}/admin`}
        className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-gray-400 hover:text-gold transition-colors pt-3 border-t border-white/5"
      >
        Open Overlay Control Room <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  OVERLAYS TAB                                                          */
/* ────────────────────────────────────────────────────────────────── */

export function OverlaysTab({ org }: { org: OrgSummary; userId: string }) {
  const [matches, setMatches] = useState<FriendlyMatchSummary[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getFriendlyMatchesForOrg(org.id)
      .then(setMatches)
      .finally(() => setLoaded(true))
  }, [org.id])

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-1 flex items-center gap-2">
          <Tv className="h-4 w-4 text-gold" /> Overlays
        </h2>
        <p className="text-gray-500 text-xs mb-3">
          Every overlay is tied to one match. Pick a match below to open its full Overlay Control Room — match
          setup, live scoring, weather, and on-air channels are all configured there.
        </p>
        <p className="text-gray-600 text-xs italic flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Don't see the match you want? Create it first from the <span className="text-gold not-italic">Matches</span>{" "}
          tab, then come back here to open its overlay.
        </p>
      </Panel>

      <div>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4 px-1">Your Overlays</h2>
        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2 px-1">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : matches.length === 0 ? (
          <Panel>
            <p className="text-gray-500 text-sm italic text-center">
              No matches yet — create one from the Matches tab first.
            </p>
          </Panel>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map((m) => (
              <OverlayCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}