"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Building2, Trophy, Swords, Users, Lock, Shield, Link2, Landmark, Tv } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppHeader } from "@/components/app-header"
import { OverviewTab } from "@/components/organization/OverviewTab"
import { MatchesTab } from "@/components/organization/MatchesTab"
import { TournamentsTab, TeamPoolTab, PlayerBankTab } from "@/components/organization/TournamentsPoolsTab"
import { SquadBoardTab } from "@/components/organization/SquadBoardTab"
import { AuctionsTab } from "@/components/organization/AuctionsTab"
import { OverlaysTab } from "@/components/organization/Overlaystab"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { pageStyles } from "@/data/site-data"
import { useAuth } from "@/context/AuthContext"
import { getOrgForUser, type OrgSummary } from "@/lib/organization/organization"
import { RegistrationsTab } from "@/components/organization/Registrationstab"


type Tab =
  | "overview"
  | "matches"
  | "overlays"
  | "tournaments"
  | "auctions"
  | "teamPool"
  | "playerBank"
  | "squadBoard"
  | "registrations"
type GateState = "checking" | "denied" | "allowed"

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: Building2 },
  { key: "matches", label: "Matches", icon: Swords },
  { key: "overlays", label: "Overlays", icon: Tv },
  { key: "tournaments", label: "Tournaments", icon: Trophy },
  { key: "auctions", label: "Auctions", icon: Landmark },
  { key: "registrations", label: "Registrations", icon: Users },
  { key: "teamPool", label: "Team Pool", icon: Shield },
  { key: "playerBank", label: "Player Pool", icon: Users },
  { key: "squadBoard", label: "Squad Board", icon: Link2 },
]

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-black/50 border border-gold/20 shine hover:border-gold/40 transition-all duration-300 rounded-lg p-6 md:p-8 shadow-lg shadow-black/40 ${className}`}
    >
      {children}
    </div>
  )
}

export default function OrganizationClient() {
  useScrollTop()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [gate, setGate] = useState<GateState>("checking")
  const [org, setOrg] = useState<OrgSummary | null>(null)
  const [tab, setTab] = useState<Tab>("overview")

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/login")
      return
    }
    let cancelled = false
    getOrgForUser(user.id).then((o) => {
      if (cancelled) return
      if (!o) {
        setGate("denied")
        return
      }
      setOrg(o)
      setGate("allowed")
    })
    return () => {
      cancelled = true
    }
  }, [authLoading, user, router])

  return (
    <main className="overflow-x-hidden max-w-full">
      <style
        dangerouslySetInnerHTML={{
          __html: `${pageStyles}
          html, body { overflow-x: hidden; max-width: 100%; }`,
        }}
      />

      <AppHeader title="Organization" />

      <section className="pt-28 sm:pt-40 pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 max-w-7xl">
          {gate === "checking" && <p className="text-center text-gray-400">Checking access…</p>}

          {gate === "denied" && (
            <Panel className="text-center">
              <Lock className="h-6 w-6 text-gold mx-auto mb-3" />
              <h1 className="text-xl font-bold text-white font-cinzel mb-2">No organization found</h1>
              <p className="text-gray-400 text-sm mb-6">
                Your account isn't attached to an organization yet, so there's nothing to manage here.
              </p>
              <Link href="/">
                <Button className="bg-gold hover:bg-gold/90 text-black font-bold">Back home</Button>
              </Link>
            </Panel>
          )}

          {gate === "allowed" && org && (
            <>
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-2 font-cinzel">
                <Building2 className="w-3.5 h-3.5" />
                Organization
              </span>
              <h1 className="text-3xl font-bold text-white font-cinzel mb-6">{org.name}</h1>

              <nav className="flex flex-wrap gap-1 mb-8 bg-black/50 border border-gold/20 p-1 rounded-lg w-fit">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`flex items-center gap-1.5 font-cinzel text-xs uppercase tracking-wide px-4 py-2 rounded-md transition-all ${
                      tab === key ? "bg-gold text-black" : "text-gray-300 hover:text-gold"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </nav>

              {tab === "overview" && (
                <div>
                  <OverviewTab
                    org={org}
                    onSelectPath={(path) => {
                      if (path === "auction") {
                        setTab("auctions")
                      } else if (path === "manual") {
                        setTab("tournaments")
                      } else {
                        setTab("matches")
                      }
                    }}
                  />
                </div>
              )}
              {tab === "matches" && <MatchesTab org={org} userId={user!.id} />}
              {tab === "overlays" && <OverlaysTab org={org} userId={user!.id} />}
              {tab === "tournaments" && <TournamentsTab org={org} userId={user!.id} />}
              {tab === "auctions" && <AuctionsTab org={org} userId={user!.id} />}
              {tab === "registrations" && <RegistrationsTab org={org} userId={user!.id} />}
              {tab === "teamPool" && <TeamPoolTab org={org} userId={user!.id} />}
              {tab === "playerBank" && <PlayerBankTab org={org} userId={user!.id} />}
              {tab === "squadBoard" && <SquadBoardTab org={org} userId={user!.id} />}
            </>
          )}
        </div>
      </section>
    </main>
  )
}