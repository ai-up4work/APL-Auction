"use client"

import { useEffect, useRef, useState, useCallback } from "react"
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

// ─────────────────────────────────────────────────────────────
// INFINITE LOOP CURVED CAROUSEL TAB BAR
//
// Ported from MatchTabs' primary tab strip: several back-to-back
// copies of PRIMARY_TABS (LOOPED_TABS below) so the strip always has
// tabs on both sides no matter how far the user scrolls, the tab
// nearest the visual center lifts/scales up while the rest sink and
// fade, and once the user stops scrolling whichever tab landed dead
// center becomes the active tab — same as scrolling a picker wheel.
// Each looped copy carries a unique `extKey` (React key / per-element
// ref) while `key` stays the real Primary value the click handler and
// active-state checks key off.
// ─────────────────────────────────────────────────────────────

const LOOP_COPIES = 3

const LOOPED_TABS = Array.from({ length: LOOP_COPIES }).flatMap((_, copyIdx) =>
  PRIMARY_TABS.map((t) => ({ ...t, extKey: `${t.key}__${copyIdx}` })),
)

const ARC_RANGE = 260 // px from center before a tab is "fully off-arc"
const ARC_LIFT = 14 // px max upward lift for the centered tab
const ARC_SCALE_MAX = 1.08
const ARC_SCALE_MIN = 0.86
const ARC_OPACITY_MAX = 1
const ARC_OPACITY_MIN = 0.45

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

// Smoothstep falloff: 0 at dead center, 1 at/after ARC_RANGE.
function arcFalloff(distance: number) {
  const t = clamp(Math.abs(distance) / ARC_RANGE, 0, 1)
  return t * t * (3 - 2 * t)
}

function PrimaryTabBar({ tab, setTab }: { tab: Primary; setTab: (t: Primary) => void }) {
  const tabScrollerRef = useRef<HTMLDivElement>(null)
  const tabItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [tabReducedMotion, setTabReducedMotion] = useState(false)
  const tabRafId = useRef<number | null>(null)
  // Width (px) of one full copy of PRIMARY_TABS inside the looped strip
  // — used to silently snap scrollLeft back by one copy whenever the
  // user nears either end, so the strip never runs out of tabs to
  // scroll into. Measured after layout, re-measured on resize.
  const tabSetWidth = useRef(0)
  // Debounce timer for "scroll settled" detection — once the user
  // stops scrolling the strip, whichever tab is nearest dead-center
  // becomes the active tab (carousel-picker behavior).
  const tabScrollSettleId = useRef<number | null>(null)
  // Set right before calling setTab() from the scroll-settle handler so
  // the "re-center on active tab change" effect below (which also runs
  // on click-driven tab changes) knows this particular change already
  // IS centered — it was the user's scroll that drove it — and should
  // skip re-scrolling, avoiding a jittery fight with the user's gesture.
  const tabScrollDrivenChange = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setTabReducedMotion(mq.matches)
    const handler = () => setTabReducedMotion(mq.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const applyTabCurve = useCallback(() => {
    const scroller = tabScrollerRef.current
    if (!scroller || tabReducedMotion) return

    const scrollerRect = scroller.getBoundingClientRect()
    const centerX = scrollerRect.left + scrollerRect.width / 2

    tabItemRefs.current.forEach((el) => {
      const r = el.getBoundingClientRect()
      const itemCenter = r.left + r.width / 2
      const distance = itemCenter - centerX
      const f = arcFalloff(distance) // 0 = centered, 1 = far
      const lift = -ARC_LIFT * (1 - f)
      const scale = ARC_SCALE_MAX - (ARC_SCALE_MAX - ARC_SCALE_MIN) * f
      const opacity = ARC_OPACITY_MAX - (ARC_OPACITY_MAX - ARC_OPACITY_MIN) * f

      el.style.transform = `translateY(${lift}px) scale(${scale})`
      el.style.opacity = String(opacity)
    })
  }, [tabReducedMotion])

  // Finds whichever looped tab button is closest to the strip's visual
  // center right now, and returns its real Primary key (stripping the
  // `__copyIdx` suffix). Used by the scroll-settle handler below to
  // decide which tab to select once the user stops scrolling.
  const getClosestRealTabKey = useCallback((): Primary | null => {
    const scroller = tabScrollerRef.current
    if (!scroller) return null
    const scrollerRect = scroller.getBoundingClientRect()
    const centerX = scrollerRect.left + scrollerRect.width / 2

    let closestKey: Primary | null = null
    let closestDist = Infinity
    tabItemRefs.current.forEach((el, extKey) => {
      const r = el.getBoundingClientRect()
      const dist = Math.abs(r.left + r.width / 2 - centerX)
      if (dist < closestDist) {
        closestDist = dist
        closestKey = extKey.split("__")[0] as Primary
      }
    })
    return closestKey
  }, [])

  // Re-measures one copy-width and, on first run, parks the scroll
  // position in the middle copy so there's a full copy's worth of
  // tabs to scroll into on both sides right from the start.
  const measureAndCenterLoop = useCallback((recenter: boolean) => {
    const scroller = tabScrollerRef.current
    if (!scroller) return
    const width = scroller.scrollWidth / LOOP_COPIES
    tabSetWidth.current = width
    if (recenter && width > 0) {
      scroller.scrollLeft = width // start in the middle copy
    }
  }, [])

  useEffect(() => {
    // Layout needs a tick to settle before scrollWidth is reliable.
    const raf = requestAnimationFrame(() => {
      measureAndCenterLoop(true)
      applyTabCurve()
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll handler: updates the curve every frame, silently wraps
  // scrollLeft back by one copy-width whenever it drifts near either
  // end of the looped strip, and — once scrolling settles — makes
  // whichever tab landed in the middle the active tab.
  const onTabScroll = useCallback(() => {
    if (tabRafId.current) cancelAnimationFrame(tabRafId.current)
    tabRafId.current = requestAnimationFrame(() => {
      applyTabCurve()
      const scroller = tabScrollerRef.current
      const setWidth = tabSetWidth.current
      if (!scroller || setWidth <= 0) return
      if (scroller.scrollLeft < setWidth * 0.4) {
        scroller.scrollLeft += setWidth
      } else if (scroller.scrollLeft > setWidth * (LOOP_COPIES - 1.4)) {
        scroller.scrollLeft -= setWidth
      }
    })

    // Debounced "scroll settled" check — re-armed on every scroll
    // event, so it only fires once movement actually stops. Whatever
    // tab is nearest dead-center at that point becomes the active tab,
    // exactly like scrolling a carousel/picker to a selection.
    if (tabScrollSettleId.current) window.clearTimeout(tabScrollSettleId.current)
    tabScrollSettleId.current = window.setTimeout(() => {
      const closest = getClosestRealTabKey()
      if (closest && closest !== tab) {
        tabScrollDrivenChange.current = true
        setTab(closest)
      }
    }, 120)
  }, [applyTabCurve, getClosestRealTabKey, tab, setTab])

  useEffect(() => {
    const handleResize = () => {
      measureAndCenterLoop(false)
      applyTabCurve()
    }
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      if (tabRafId.current) cancelAnimationFrame(tabRafId.current)
      if (tabScrollSettleId.current) window.clearTimeout(tabScrollSettleId.current)
    }
  }, [measureAndCenterLoop, applyTabCurve])

  // Center the active tab whenever it changes (tap, or programmatic) —
  // picks whichever looped copy of that tab is nearest the current
  // scroll position, so the jump is always small. Skipped when the tab
  // change was itself driven by the user scrolling the strip to center
  // — it's already centered, so re-scrolling would just fight the
  // gesture that just finished.
  useEffect(() => {
    if (tabScrollDrivenChange.current) {
      tabScrollDrivenChange.current = false
      return
    }
    const scroller = tabScrollerRef.current
    if (!scroller) return
    const scrollerRect = scroller.getBoundingClientRect()
    const centerX = scrollerRect.left + scrollerRect.width / 2

    let closestEl: HTMLButtonElement | null = null
    let closestDist = Infinity
    tabItemRefs.current.forEach((el, extKey) => {
      if (extKey.split("__")[0] !== tab) return
      const r = el.getBoundingClientRect()
      const dist = Math.abs(r.left + r.width / 2 - centerX)
      if (dist < closestDist) {
        closestDist = dist
        closestEl = el
      }
    })
    if (!closestEl) return
    const elRect = (closestEl as HTMLButtonElement).getBoundingClientRect()
    const offset = elRect.left - scrollerRect.left - scrollerRect.width / 2 + elRect.width / 2
    scroller.scrollBy({ left: offset, behavior: "smooth" })
    const t = setTimeout(applyTabCurve, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  return (
    <div className="mb-8 max-w-full">
      {/* MOBILE — infinite-loop curved carousel. Scrolling/dragging a
          long strip is a natural touch gesture, so the loop earns its
          keep here. Hidden from md and up. */}
      <div className="relative md:hidden">
        <svg
          className="pointer-events-none absolute left-0 right-0 -top-1 h-6 w-full opacity-20"
          viewBox="0 0 100 10"
          preserveAspectRatio="none"
        >
          <path d="M0,10 Q50,0 100,10" stroke="#f5a623" strokeWidth="0.5" fill="none" />
        </svg>

        <div
          ref={tabScrollerRef}
          onScroll={onTabScroll}
          className="flex flex-nowrap items-end gap-1.5 overflow-x-auto snap-x snap-mandatory
                     scrollbar-none bg-black/50 border border-gold/20 px-3 py-3 rounded-full w-fit max-w-full"
        >
          {LOOPED_TABS.map(({ key, label, icon: Icon, extKey }) => {
            const active = tab === key
            return (
              <button
                key={extKey}
                ref={(el) => {
                  if (el) tabItemRefs.current.set(extKey, el)
                  else tabItemRefs.current.delete(extKey)
                }}
                onClick={() => setTab(key)}
                className={`snap-center shrink-0 flex items-center gap-1.5 font-cinzel text-xs uppercase
                  tracking-wide px-4 py-2 rounded-full whitespace-nowrap origin-bottom
                  transition-[background-color,color,border-color] duration-300 ${
                  tabReducedMotion ? "" : "transition-transform will-change-transform"
                } ${
                  active
                    ? "bg-gold text-black shadow-[0_4px_18px_rgba(245,166,35,0.35)] border border-gold"
                    : "bg-white/[0.03] text-gray-300 border border-gold/10 hover:text-gold hover:border-gold/30"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            )
          })}
        </div>

        {/* edge fades — purely decorative now, since the loop means the
            strip is never actually empty past these edges */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 rounded-l-full bg-gradient-to-r from-black/70 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 rounded-r-full bg-gradient-to-l from-black/70 to-transparent" />
      </div>

      {/* DESKTOP — compact single-line strip, no loop. Five tabs fit
          comfortably in one row, so the carousel's scroll/wrap
          machinery is unnecessary width and motion here. */}
      <div className="hidden md:flex flex-nowrap items-center gap-1 bg-black/50 border border-gold/20 p-1 rounded-full w-fit">
        {PRIMARY_TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 font-cinzel text-xs uppercase tracking-wide
                px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
                active
                  ? "bg-gold text-black shadow-[0_2px_10px_rgba(245,166,35,0.3)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/[0.03]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          )
        })}
      </div>
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

      <PrimaryTabBar tab={tab} setTab={setTab} />

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

      <section className="pt-26 sm:pt-30 pb-16 relative section-pattern">
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