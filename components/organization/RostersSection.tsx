// app/components/organization/Rosterssection.tsx
"use client"

import { useEffect, useState } from "react"
import { Shield, Users, Link2, UserPlus } from "lucide-react"
import { TeamPoolTab, PlayerBankTab } from "@/components/organization/TournamentsPoolsTab"
import { SquadBoardTab } from "@/components/organization/SquadBoardTab"
import { RegistrationsTab } from "@/components/organization/Registrationstab"
import { WorkflowBreadcrumb } from "@/components/organization/Workflowbreadcrumb"
import { SubTabBar } from "@/components/organization/Subtabbar"
import type { OrgSummary } from "@/lib/organization/organization"

type RosterSub = "teamPool" | "playerBank" | "squadBoard" | "registrations"

const SUBS: { key: RosterSub; label: string; icon: React.ComponentType<{ className?: string }>; blurb: string }[] = [
  { key: "teamPool", label: "Team Pool", icon: Shield, blurb: "Reusable teams — assign them into a Squad Board or an auction whenever you need them." },
  { key: "playerBank", label: "Player Bank", icon: Users, blurb: "Reusable players — assign them onto any team on a Squad Board, or pre-fill an auction's pool." },
  { key: "squadBoard", label: "Squad Boards", icon: Link2, blurb: "Pair Team Pool teams with Player Bank players to build a real roster, ready for a match." },
  {
    key: "registrations",
    label: "Registrations",
    icon: UserPlus,
    blurb: "Let team owners and players sign themselves up for review — approved entries land right here, in the Team Pool and Player Bank above.",
  },
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

  useEffect(() => {
    setSub(initialSub)
  }, [initialSub])

  const selectSub = (key: RosterSub) => {
    setSub(key)
    onNavigate("rosters", key)
  }

  const active = SUBS.find((s) => s.key === sub)!

  return (
    <div>
      <WorkflowBreadcrumb currentPrimary="rosters" currentSub={sub} onNavigate={onNavigate} />

      <SubTabBar
        active={sub}
        onChange={selectSub}
        options={SUBS.map(({ key, label, icon }) => ({ value: key, label, icon }))}
      />
      <p className="text-gray-500 text-xs -mt-3 mb-6 px-1">{active.blurb}</p>

      {sub === "teamPool" && <TeamPoolTab org={org} userId={userId} />}
      {sub === "playerBank" && <PlayerBankTab org={org} userId={userId} />}
      {sub === "squadBoard" && <SquadBoardTab org={org} userId={userId} />}
      {sub === "registrations" && <RegistrationsTab org={org} userId={userId} />}
    </div>
  )
}