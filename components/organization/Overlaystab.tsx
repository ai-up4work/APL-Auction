"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Tv, Swords, ArrowRight, Info, Trophy } from "lucide-react"
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

type BadgeTone = "linked" | "none" | "warn" | "neutral"

function StatusBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  const styles: Record<BadgeTone, string> = {
    linked: "border-gold/40 text-gold",
    none: "border-white/15 text-gray-400",
    warn: "border-yellow-500/40 text-yellow-400",
    neutral: "border-white/15 text-gray-300",
  }
  const glyph: Record<BadgeTone, string> = {
    linked: "✓",
    none: "✗",
    warn: "⚠",
    neutral: "",
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded border ${styles[tone]}`}
    >
      {glyph[tone] && <span>{glyph[tone]}</span>}
      {children}
    </span>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  OVERLAY CARD — one match, its overlay status, and a link straight     */
/*  into the real Overlay Control Room, which lives at                     */
/*  /overlay/[auctionId]/admin and resolves strictly by `auction_id`        */
/*  (see matchPersistence.ts's getOrCreateMatch). For a manual-entry        */
/*  match, `auctionId` is a synthetic id equal to `id`; for an               */
/*  auction-sourced match it's the real auction's id — never assume the      */
/*  two are equal, always use `match.auctionId`.                            */
/*                                                                           */
/*  Now also carries the same "which tournament (if any) is this match      */
/*  tied to" badge used on MatchCard, so a tournament match reads the        */
/*  same way here as it does on the Tournaments tab — an overlay isn't a    */
/*  different kind of match, just a different thing you're configuring      */
/*  for it.                                                                  */
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

      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        {match.tournamentName ? (
          <StatusBadge tone="linked">
            {match.tournamentName}
            {match.round ? ` · ${match.round}` : ""}
          </StatusBadge>
        ) : (
          <StatusBadge tone="none">Standalone{match.round ? ` · ${match.round}` : ""}</StatusBadge>
        )}
      </div>

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
/*  MATCH GROUP — a labeled section of OverlayCards. Only rendered when   */
/*  it actually has matches, so an org with no tournament matches yet       */
/*  (or none standalone) doesn't show an empty, pointless heading.          */
/* ────────────────────────────────────────────────────────────────── */

function MatchGroup({
  title,
  icon,
  matches,
}: {
  title: string
  icon: React.ReactNode
  matches: FriendlyMatchSummary[]
}) {
  if (matches.length === 0) return null
  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-widest text-gold/70 mb-3 px-1">
        {icon} {title}
        <span className="text-gray-600 normal-case tracking-normal">({matches.length})</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {matches.map((m) => (
          <OverlayCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  OVERLAYS TAB                                                          */
/*                                                                           */
/*  Every match in the org can have an overlay, tournament-linked or not —  */
/*  unlike the Matches tab (standalone only) and the Tournaments tab         */
/*  (tournament-linked only), this tab intentionally shows both, since       */
/*  overlay setup is orthogonal to that split. To keep the two kinds from    */
/*  blurring together in one flat grid, they're separated into their own    */
/*  labeled sections instead — same visual language (tournament/standalone  */
/*  badge) as MatchCard, just grouped rather than mixed.                    */
/* ────────────────────────────────────────────────────────────────── */

export function OverlaysTab({ org }: { org: OrgSummary; userId: string }) {
  const [matches, setMatches] = useState<FriendlyMatchSummary[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getFriendlyMatchesForOrg(org.id)
      .then(setMatches)
      .finally(() => setLoaded(true))
  }, [org.id])

  const tournamentMatches = useMemo(() => matches.filter((m) => m.tournamentName), [matches])
  const standaloneMatches = useMemo(() => matches.filter((m) => !m.tournamentName), [matches])

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
          Don't see the match you want? Create a standalone one from the{" "}
          <span className="text-gold not-italic">Matches</span> tab, or connect a bracket slot from the{" "}
          <span className="text-gold not-italic">Tournaments</span> tab, then come back here to open its overlay.
        </p>
      </Panel>

      <div className="space-y-8">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 className="text-lg font-bold text-white font-cinzel">Your Overlays</h2>
        </div>

        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2 px-1">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : matches.length === 0 ? (
          <Panel>
            <p className="text-gray-500 text-sm italic text-center">
              No matches yet — create one from the Matches tab, or connect one from a tournament bracket, first.
            </p>
          </Panel>
        ) : (
          <>
            <MatchGroup
              title="Tournament Matches"
              icon={<Trophy className="h-3 w-3 text-gold/50" />}
              matches={tournamentMatches}
            />
            <MatchGroup
              title="Standalone Matches"
              icon={<Swords className="h-3 w-3 text-gold/50" />}
              matches={standaloneMatches}
            />
          </>
        )}
      </div>
    </div>
  )
}