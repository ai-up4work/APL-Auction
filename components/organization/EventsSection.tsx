"use client"

import { useEffect, useState } from "react"
import { Trophy, Landmark, Swords } from "lucide-react"
import { TournamentsTab } from "@/components/organization/TournamentsPoolsTab"
import { AuctionsTab } from "@/components/organization/AuctionsTab"
import { MatchesTab } from "@/components/organization/MatchesTab"
import { WorkflowBreadcrumb } from "@/components/organization/Workflowbreadcrumb"
import type { OrgSummary } from "@/lib/organization/organization"

type EventsSub = "tournaments" | "auctions" | "matches"

const SUBS: { key: EventsSub; label: string; icon: React.ComponentType<{ className?: string }>; blurb: string }[] = [
  { key: "tournaments", label: "Tournaments", icon: Trophy, blurb: "Brackets and standings. Each tournament's connected matches show inline below it." },
  { key: "auctions", label: "Auctions", icon: Landmark, blurb: "Run a live bidding auction for teams and players, optionally linked to a tournament." },
  { key: "matches", label: "Matches", icon: Swords, blurb: "Standalone matches not part of a bracket. Teams come from a Squad Board or an auction." },
]

export function EventsSection({
  org,
  userId,
  initialSub = "tournaments",
  onNavigate,
}: {
  org: OrgSummary
  userId: string
  initialSub?: EventsSub
  onNavigate: (primary: "rosters" | "events" | "broadcast", sub: string) => void
}) {
  const [sub, setSub] = useState<EventsSub>(initialSub)

  // useState(initialSub) only seeds on first mount — if the parent later
  // changes initialSub (e.g. the URL's ?sub= changed via back/forward, or
  // WorkflowBreadcrumb/Overview navigated here with a different sub), this
  // component would otherwise keep showing its stale first-mount value.
  // Sync down whenever the prop actually changes.
  useEffect(() => {
    setSub(initialSub)
  }, [initialSub])

  // Local tab clicks must also propagate up, so the parent's eventsSub
  // (and therefore the URL) stays in lockstep with what's actually shown
  // here — otherwise clicking a sub-tab locally silently desyncs the URL.
  const selectSub = (key: EventsSub) => {
    setSub(key)
    onNavigate("events", key)
  }

  const active = SUBS.find((s) => s.key === sub)!

  return (
    <div>
      <WorkflowBreadcrumb currentPrimary="events" currentSub={sub} onNavigate={onNavigate} />

      <div className="flex flex-wrap gap-1 mb-2 bg-black/40 border border-gold/15 p-1 rounded-lg w-fit">
        {SUBS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => selectSub(key)}
            className={`flex items-center gap-1.5 font-cinzel text-xs uppercase tracking-wide px-3.5 py-1.5 rounded-md transition-all ${
              sub === key ? "bg-gold/90 text-gold" : "text-gray-400 hover:text-gold"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      <p className="text-gray-500 text-xs mb-6 px-1">{active.blurb}</p>

      {sub === "tournaments" && <TournamentsTab org={org} userId={userId} />}
      {sub === "auctions" && <AuctionsTab org={org} userId={userId} />}
      {sub === "matches" && <MatchesTab org={org} userId={userId} />}
    </div>
  )
}