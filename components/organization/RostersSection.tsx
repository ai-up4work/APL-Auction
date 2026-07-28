// app/components/organization/Rosterssection.tsx
"use client"

import { useState } from "react"
import { Shield, Users, Link2 } from "lucide-react"
import { TeamPoolTab, PlayerBankTab } from "@/components/organization/TournamentsPoolsTab"
import { SquadBoardTab } from "@/components/organization/SquadBoardTab"
import { WorkflowBreadcrumb } from "@/components/organization/Workflowbreadcrumb"
import type { OrgSummary } from "@/lib/organization/organization"

type RosterSub = "teamPool" | "playerBank" | "squadBoard"

const SUBS: { key: RosterSub; label: string; icon: React.ComponentType<{ className?: string }>; blurb: string }[] = [
  { key: "teamPool", label: "Team Pool", icon: Shield, blurb: "Reusable teams — assign them into a Squad Board or an auction whenever you need them." },
  { key: "playerBank", label: "Player Bank", icon: Users, blurb: "Reusable players — assign them onto any team on a Squad Board, or pre-fill an auction's pool." },
  { key: "squadBoard", label: "Squad Boards", icon: Link2, blurb: "Pair Team Pool teams with Player Bank players to build a real roster, ready for a match." },
]

export function RostersSection({
  org,
  userId,
  initialSub = "teamPool",
  onNavigate,
}: {
  org: OrgSummary
  userId: string
  initialSub?: RosterSub
  onNavigate: (primary: "rosters" | "events" | "broadcast", sub: string) => void
}) {
  const [sub, setSub] = useState<RosterSub>(initialSub)
  const active = SUBS.find((s) => s.key === sub)!

  return (
    <div>
      <WorkflowBreadcrumb currentPrimary="rosters" currentSub={sub} onNavigate={onNavigate} />

      <div className="flex flex-wrap gap-1 mb-2 bg-black/40 border border-gold/15 p-1 rounded-lg w-fit">
        {SUBS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className={`flex items-center gap-1.5 font-cinzel text-xs uppercase tracking-wide px-3.5 py-1.5 rounded-md transition-all ${
              sub === key ? "bg-gold/90 text-black" : "text-gray-400 hover:text-gold"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      <p className="text-gray-500 text-xs mb-6 px-1">{active.blurb}</p>

      {sub === "teamPool" && <TeamPoolTab org={org} userId={userId} />}
      {sub === "playerBank" && <PlayerBankTab org={org} userId={userId} />}
      {sub === "squadBoard" && <SquadBoardTab org={org} userId={userId} />}
    </div>
  )
}