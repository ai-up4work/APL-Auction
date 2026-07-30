"use client"

import { useEffect, useState } from "react"
import { Tv, Brackets } from "lucide-react"
import { OverlaysTab } from "@/components/organization/Overlaystab"
import { BracketsTab } from "@/components/organization/Bracketstab"
import { WorkflowBreadcrumb } from "@/components/organization/Workflowbreadcrumb"
import type { OrgSummary } from "@/lib/organization/organization"

type BroadcastSub = "overlays" | "brackets"

const SUBS: { key: BroadcastSub; label: string; icon: React.ComponentType<{ className?: string }>; blurb: string }[] = [
  { key: "overlays", label: "Overlays", icon: Tv, blurb: "Set up on-air graphics for any match, tournament-linked or standalone." },
  { key: "brackets", label: "Brackets", icon: Brackets, blurb: "Every knockout tournament's live bracket, ready to pull up on-air." },
]

export function BroadcastSection({
  org,
  userId,
  initialSub = "overlays",
  onNavigate,
}: {
  org: OrgSummary
  userId: string
  initialSub?: BroadcastSub
  onNavigate: (primary: "rosters" | "events" | "broadcast", sub: string) => void
}) {
  const [sub, setSub] = useState<BroadcastSub>(initialSub)

  // useState(initialSub) only seeds on first mount — sync down whenever
  // the parent's initialSub prop actually changes (URL back/forward,
  // breadcrumb/Overview navigation into a different sub).
  useEffect(() => {
    setSub(initialSub)
  }, [initialSub])

  // Propagate local tab clicks back up so the parent's broadcastSub (and
  // therefore the URL) stays in sync with what's actually shown here.
  const selectSub = (key: BroadcastSub) => {
    setSub(key)
    onNavigate("broadcast", key)
  }

  const active = SUBS.find((s) => s.key === sub)!

  return (
    <div>
      <WorkflowBreadcrumb currentPrimary="broadcast" currentSub={sub} onNavigate={onNavigate} />

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

      {sub === "overlays" && <OverlaysTab org={org} userId={userId} />}
      {sub === "brackets" && <BracketsTab org={org} />}
    </div>
  )
}