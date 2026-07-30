"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Building2, Trophy, Lock, Shield, Tv, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppHeader } from "@/components/app-header"
import { OverviewTab } from "@/components/organization/OverviewTab"
import { RostersSection } from "@/components/organization/RostersSection"
import { EventsSection } from "@/components/organization/EventsSection"
import { BroadcastSection } from "@/components/organization/Broadcastsection"
import { SettingsTab } from "@/components/organization/SettingsTab"
import { WorkflowProvider, useWorkflow, type WorkflowId } from "@/components/organization/Workflowcontext"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { pageStyles } from "@/data/site-data"
import { useAuth } from "@/context/AuthContext"
import { getOrgForUser, type OrgSummary } from "@/lib/organization/organization"

type Primary = "overview" | "rosters" | "events" | "broadcast" | "settings"

const PRIMARY_TABS: { key: Primary; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: Building2 },
  { key: "rosters", label: "Rosters", icon: Shield },
  { key: "events", label: "Events", icon: Trophy },
  { key: "broadcast", label: "Broadcast", icon: Tv },
  { key: "settings", label: "Settings", icon: Settings },
]
const PRIMARY_KEYS = PRIMARY_TABS.map((t) => t.key)

const ROSTER_SUBS = ["teamPool", "playerBank", "squadBoard", "registrations"] as const
type RosterSub = (typeof ROSTER_SUBS)[number]

const EVENTS_SUBS = ["tournaments", "auctions", "matches"] as const
type EventsSub = (typeof EVENTS_SUBS)[number]

const BROADCAST_SUBS = ["overlays", "brackets"] as const
type BroadcastSub = (typeof BROADCAST_SUBS)[number]

function isValid<T extends readonly string[]>(list: T, val: string | null): val is T[number] {
  return !!val && (list as readonly string[]).includes(val)
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-black/50 border border-gold/20 shine hover:border-gold/40 transition-all duration-300 rounded-lg p-6 md:p-8 shadow-lg shadow-black/40 ${className}`}
    >
      {children}
    </div>
  )
}

type GateState = "checking" | "denied" | "allowed"

function OrganizationDashboard({ org, userId }: { org: OrgSummary; userId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Hydrate initial tab/sub from the URL once, falling back to sane
  // defaults for anything missing or invalid.
  const [tab, setTab] = useState<Primary>(() => {
    const t = searchParams.get("tab")
    return isValid(PRIMARY_KEYS as any, t) ? (t as Primary) : "overview"
  })
  const [rosterSub, setRosterSub] = useState<RosterSub>(() => {
    const s = searchParams.get("sub")
    return isValid(ROSTER_SUBS, s) ? (s as RosterSub) : "teamPool"
  })
  const [eventsSub, setEventsSub] = useState<EventsSub>(() => {
    const s = searchParams.get("sub")
    return isValid(EVENTS_SUBS, s) ? (s as EventsSub) : "tournaments"
  })
  const [broadcastSub, setBroadcastSub] = useState<BroadcastSub>(() => {
    const s = searchParams.get("sub")
    return isValid(BROADCAST_SUBS, s) ? (s as BroadcastSub) : "overlays"
  })

  const { setWorkflow } = useWorkflow()

  // Keep ?tab=&sub= in sync with whichever tab/sub is active, so leaving
  // the page and coming back (including browser Back) restores the same view.
  useEffect(() => {
    const sub = tab === "rosters" ? rosterSub : tab === "events" ? eventsSub : tab === "broadcast" ? broadcastSub : undefined
    const params = new URLSearchParams()
    params.set("tab", tab)
    if (sub) params.set("sub", sub)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, rosterSub, eventsSub, broadcastSub])

  // Central place any sub-navigation (breadcrumb clicks, Overview's
  // workflow cards) routes through, so "jump to step 2" always lands on
  // the right primary tab AND the right sub-tab in one call.
  const navigate = (primary: "rosters" | "events" | "broadcast", sub: string) => {
    setTab(primary)
    if (primary === "rosters") setRosterSub(sub as RosterSub)
    if (primary === "events") setEventsSub(sub as EventsSub)
    if (primary === "broadcast") setBroadcastSub(sub as BroadcastSub)
  }

  const handleSelectPath = (path: WorkflowId) => {
    setWorkflow(path)
    if (path === "auction") navigate("events", "tournaments")
    else if (path === "manual") navigate("rosters", "teamPool")
    else navigate("rosters", "squadBoard")
  }

  return (
    <>
      <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-2 font-cinzel">
        <Building2 className="w-3.5 h-3.5" />
        Organization
      </span>
      <h1 className="text-3xl font-bold text-white font-cinzel mb-6">{org.name}</h1>

      <nav className="flex flex-wrap gap-1 mb-8 bg-black/50 border border-gold/20 p-1 rounded-lg w-fit">
        {PRIMARY_TABS.map(({ key, label, icon: Icon }) => (
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

      {tab === "overview" && <OverviewTab org={org} onSelectPath={handleSelectPath} />}
      {tab === "rosters" && (
        <RostersSection org={org} userId={userId} initialSub={rosterSub} onNavigate={navigate} />
      )}
      {tab === "events" && (
        <EventsSection org={org} userId={userId} initialSub={eventsSub} onNavigate={navigate} />
      )}
      {tab === "broadcast" && (
        <BroadcastSection org={org} userId={userId} initialSub={broadcastSub} onNavigate={navigate} />
      )}
      {tab === "settings" && <SettingsTab org={org} />}
    </>
  )
}

export default function OrganizationClient() {
  useScrollTop()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [gate, setGate] = useState<GateState>("checking")
  const [org, setOrg] = useState<OrgSummary | null>(null)

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
            <WorkflowProvider>
              <OrganizationDashboard org={org} userId={user!.id} />
            </WorkflowProvider>
          )}
        </div>
      </section>
    </main>
  )
}