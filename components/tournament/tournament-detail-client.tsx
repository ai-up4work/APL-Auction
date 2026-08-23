// app/components/tournament/tournament-detail-client.tsx
"use client"

import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Twitter,
  MessageSquare,
  Globe,
  Trophy,
  Calendar,
  Users,
  ListOrdered,
  CalendarClock,
  Network,
  Award,
  Shield,
  Lock,
  DollarSign,
  Gift,
  BadgeCheck,
  Sparkles,
  Crown,
  Medal,
  Target,
  TrendingUp,
  Calculator,
  X,
} from "lucide-react"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { SiteHeader } from "@/components/landing/site-header"
import RelatedTournaments from "@/components/tournament/related-tournaments"
import BracketPreviewPanel from "@/components/tournament/BracketPreviewPanel"
import AdvancedMarkdown from "@/components/tournament/AdvancedMarkdown"
import { pageStyles } from "@/data/site-data"
import {
  hasMatchDetail,
  type Tournament,
  type PointsRow,
  type Fixture,
  type BracketMatch,
  type BracketTeam,
  type Squad,
  type LeaderboardRow,
  type AwardEntry,
} from "@/data/tournament-data"
import type { PlayerStatRow, BowlingStatRow } from "@/data/match-data"


/* ------------------------------------------------------------------ */
/*  NOTE ON BRACKETS:                                                   */
/*  `tournament.bracketFormat` ("single" | "double" | undefined) picks  */
/*  which bracket UI shows in the Bracket tab:                          */
/*    - set to "single" or "double" -> BracketPreviewPanel, which        */
/*      generates its own full 32-team demo bracket and previews a      */
/*      slice of it (does NOT read tournament.bracket).                 */
/*    - left unset -> falls back to the legacy flat `bracket` array     */
/*      via BracketPanel below, if present.                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  NOTE ON TABS:                                                       */
/*  Every tab (Points, Schedule, Bracket, Squads, Stats) is now always   */
/*  rendered so visitors can see the full shape of what a fully-run     */
/*  tournament looks like. If the underlying data for a tab isn't there */
/*  yet, the tab is shown with a lock icon in the strip, and its        */
/*  content renders a "coming soon" placeholder instead of being        */
/*  hidden outright.                                                    */
/*                                                                        */
/*  FIXED (tab-switch glitch): every <TabsContent> below still renders  */
/*  with `forceMount` and toggles visibility purely via CSS              */
/*  (`data-[state=inactive]:hidden`) instead of letting Radix unmount    */
/*  the panel on every switch. Previously, switching away from a tab    */
/*  containing next/image components (Squads, Schedule) tore that       */
/*  whole subtree out of the DOM, and switching back remounted it from  */
/*  scratch — every image had to re-fetch/re-decode and the page height */
/*  snapped instead of just showing/hiding, which read as a visible     */
/*  "glitch"/flash on every tab change. Keeping panels mounted and just  */
/*  hiding them fixes that; the extra always-mounted DOM is cheap next  */
/*  to what it was doing before (destroy + rebuild on every click).     */
/*                                                                        */
/*  NEW — CURVED INFINITE-LOOP TAB CAROUSEL:                            */
/*  The tab strip previously used Radix's TabsList/TabsTrigger with a   */
/*  simple "whichever tab lands nearest center becomes active" scroll   */
/*  behavior. It's now the same curved carousel used on the match       */
/*  detail page's tab bar (see components/match/match-tabs.tsx):        */
/*  several looped copies of the tab list so the strip never runs out   */
/*  of tabs to scroll into in either direction, plus a per-frame arc     */
/*  transform (lift/scale/opacity keyed off distance from center) so    */
/*  the centered tab visibly pops while neighbors sink and fade. Radix   */
/*  Tabs.Root/TabsContent are still used underneath purely to drive      */
/*  which panel is visible (via `value`/`onValueChange`) — the strip    */
/*  itself is now plain buttons rather than TabsList/TabsTrigger, since  */
/*  the arc math needs direct imperative control over each button's     */
/*  transform/opacity per scroll frame.                                 */
/*                                                                        */
/*  NEW — DEFAULT TAB NOW FOLLOWS TOURNAMENT STATUS:                    */
/*  Previously always defaulted to "points" regardless of where the     */
/*  tournament actually stood. The initial tab now depends on           */
/*  tournament.status:                                                  */
/*    - "Upcoming"  -> Schedule (nothing's been played, so the fixture   */
/*                      list is the most useful thing to land on)       */
/*    - "Live"      -> Points Table (standings are what's actively      */
/*                      moving right now)                                */
/*    - "Completed" -> Line Up (the new podium/results tab below —      */
/*                      once it's over, the champion/runner-up/         */
/*                      semifinalist result is the headline)             */
/*  Any other/unknown status falls back to Overview. This only sets the */
/*  INITIAL tab — visitors can still freely switch to any tab, and if   */
/*  the data behind the chosen default tab isn't actually there yet,    */
/*  that tab still renders its own LockedTabPlaceholder rather than     */
/*  silently redirecting elsewhere, consistent with how every other     */
/*  tab on this page already handles missing data.                      */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  NOTE ON LINE UP (new tab):                                          */
/*  A podium-style "Winners Lineup" showcase — champion in the center,  */
/*  runner-up and a semifinalist flanking it, each in a glowing gradient */
/*  ring with their team logo (same broadcast-overlay visual language   */
/*  used for the match-complete banner on the match detail page).       */
/*                                                                        */
/*  Results are derived from the legacy flat `tournament.bracket` array  */
/*  (BracketMatch[]) — the Final match's winner/loser become champion/   */
/*  runner-up, and one losing semifinalist (first found, excluding TBD)  */
/*  fills the third spot. Tournaments on the newer bracketFormat         */
/*  ("single"/"double", rendered via BracketPreviewPanel off             */
/*  bracketRounds/doubleElimData) aren't derivable here since those      */
/*  shapes aren't exposed to this file today — for those (or any        */
/*  tournament with no legacy bracket at all), this falls back to the    */
/*  Points Table's top 3 ranked teams instead, so the tab still shows    */
/*  something meaningful whenever ANY result data exists. If neither is  */
/*  available, the tab shows the same LockedTabPlaceholder pattern as    */
/*  every other tab on this page.                                        */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  NOTE ON DESCRIPTION:                                                */
/*  `tournament.description` is treated as Markdown/MDX-flavored        */
/*  source, not plain text — it's rendered through the shared           */
/*  <AdvancedMarkdown /> component (same one used on /work/[slug]       */
/*  project pages) so organizers can use headings, bold/italic,         */
/*  lists, links, images, tables, code blocks, and Mermaid diagrams      */
/*  in their tournament's "About" copy.                                 */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  NOTE ON PRIZES & AWARDS:                                            */
/*  These now live together in one tab ("Prizes & Awards") instead of   */
/*  awards being buried in Overview. `tournament.prizes` is the legacy  */
/*  place/reward list (tournament_prizes — "1st Place" -> "$500"),      */
/*  still editable from a dedicated card on the edit page. `tournament  */
/*  .awards` is the richer per-award data (tournament_award_templates,  */
/*  edited via AwardsManager) — title, description, award type, prize   */
/*  category, prize value, and an optional image per award. Both show   */
/*  in the same card on the public page since they're conceptually the  */
/*  same "what do winners get" information.                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  NOTE ON BYES (Schedule tab):                                        */
/*  A "bye" happens when a bracket size isn't a power of 2 — one team    */
/*  auto-advances a round with no actual opponent to play. Historically  */
/*  a bye written into `fixtures` (e.g. team2 = "BYE" or "") rendered as */
/*  a normal two-team FixtureCard, which looked exactly like a genuine   */
/*  completed head-to-head result even though only one team was ever     */
/*  really "there."                                                      */
/*                                                                        */
/*  FIXED: `isBye()` detects these fixtures, and they're now routed to   */
/*  a compact `ByeRow` ("Team X advances on a bye") instead of the full  */
/*  FixtureCard, so visitors can still see the round happened without it */
/*  being mistaken for an actual match. Bye fixtures are also excluded   */
/*  from the status-filter chip counts (All/Live/Upcoming/Completed) at  */
/*  the top of the Schedule panel, since counting them there would       */
/*  inflate those numbers with rounds where no game was actually played. */
/*                                                                        */
/*  FIXED (round 2): a bye's underlying `status` field is set the        */
/*  instant the bracket is generated — there's no game to play, so it    */
/*  reads "completed" from the very start, often before the tournament   */
/*  itself has even begun. That made a bye appear under the "Completed"  */
/*  filter looking exactly like a genuine result, even pre-tournament.   */
/*  Status-specific tabs (Live/Upcoming/Completed) now exclude byes      */
/*  entirely — a bye isn't a "completed match" in any meaningful sense,  */
/*  it's a walkover, and it only ever appears in the unfiltered "All"    */
/*  view via ByeRow. ByeRow also now carries an explicit "Bye" tag so    */
/*  it can't be mistaken for a played game even there.                   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  NOTE ON MATCH ORDER (Schedule tab):                                 */
/*  Fixtures within a stage previously sorted by status (completed →    */
/*  live → upcoming) with real match order never considered. Now sorts  */
/*  by `Fixture.matchNumber` first — the real tournament-wide play      */
/*  order sourced from matches.match_setup.matchNumber (see             */
/*  bracket_matches.match_number / generateBracket.ts) — falling back  */
/*  to the old status/TBD ordering only for fixtures that don't have a  */
/*  matchNumber yet (not scheduled through the live engine).            */
/* ------------------------------------------------------------------ */

interface TournamentDetailClientProps {
  tournament: Tournament
  slug: string
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/** Which tab should be open on first render, based on where the
 *  tournament actually stands right now. See "NEW — DEFAULT TAB NOW
 *  FOLLOWS TOURNAMENT STATUS" above. */
function defaultTabForStatus(status: string | undefined): string {
  if (status === "Upcoming") return "schedule"
  if (status === "Live") return "points"
  if (status === "Completed") return "lineup"
  return "overview"
}

/**
 * Shared player avatar for the Stats tab: real photo when
 * PlayerStatRow/BowlingStatRow.img is set, falling back to an
 * initials badge otherwise (or if the image URL 404s/fails to load).
 *
 * FIXED: this didn't exist before — StatsSpotlightRow and
 * StatsLeaderboardCard rendered nothing but text (Spotlight) or a
 * hardcoded initials circle (Leaderboard), even though PlayerStatRow /
 * BowlingStatRow already carry a best-effort `img` resolved server-side
 * in getTournamentStats (data/match-data.ts). The data was there, it
 * just was never read on this page.
 */
function StatAvatar({ name, img, size = "md" }: { name: string; img?: string; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false)
  const dims = size === "md" ? "h-16 w-16 text-sm" : "h-12 w-12 text-[16px]"
  const showPhoto = !!img && !failed
  return (
    <div
      className={`relative ${dims} rounded-full overflow-hidden bg-gradient-to-br from-gold/20 via-black/40 to-black/60 border border-gold/20 flex items-center justify-center shrink-0`}
    >
      {showPhoto ? (
        <Image src={img} alt={name} className="w-full h-full object-cover" onError={() => setFailed(true)} width={48} height={48} />
      ) : (
        <span className="font-bold text-gold font-cinzel">{initials(name)}</span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CURVED, INFINITE-LOOP TAB CAROUSEL
//
// Same visual language as the match-detail page's tab bar
// (components/match/match-tabs.tsx): the strip is rendered as several
// back-to-back copies of the tab list (LOOP_COPIES), and the scroll
// handler silently snaps the scroll position back by one copy-width
// whenever it nears either end — so there are always tabs on both
// sides no matter how far the user scrolls. Whichever tab lands
// nearest the visual center gets lifted, scaled up, and fully opaque;
// tabs further away sink down and fade — an arc/carousel read. Locked
// tabs (no data yet) are still clickable — clicking shows that tab's
// "coming soon" placeholder — but they're skipped when deciding which
// tab a *scroll* gesture should land on, so scrolling never silently
// selects a tab with nothing behind it yet.
// ─────────────────────────────────────────────────────────────

const ARC_RANGE = 260 // px from center before a tab is "fully off-arc"
const ARC_LIFT = 14 // px max upward lift for the centered tab
const ARC_SCALE_MAX = 1.08
const ARC_SCALE_MIN = 0.86
const ARC_OPACITY_MAX = 1
const ARC_OPACITY_MIN = 0.45
const LOOP_COPIES = 3

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

// Smoothstep falloff: 0 at dead center, 1 at/after ARC_RANGE.
function arcFalloff(distance: number) {
  const t = clamp(Math.abs(distance) / ARC_RANGE, 0, 1)
  return t * t * (3 - 2 * t)
}

interface CurvedTabDef {
  key: string
  label: string
}

function useCurvedInfiniteTabs(
  tabs: CurvedTabDef[],
  activeTab: string,
  setActiveTab: (v: string) => void,
  lockedMap: Record<string, boolean>,
) {
  const loopedTabs = useMemo(
    () =>
      Array.from({ length: LOOP_COPIES }).flatMap((_, copyIdx) =>
        tabs.map((t) => ({ ...t, extKey: `${t.key}__${copyIdx}` })),
      ),
    [tabs],
  )

  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [reducedMotion, setReducedMotion] = useState(false)
  const rafId = useRef<number | null>(null)
  // Width (px) of one full copy of `tabs` inside the looped strip —
  // used to silently snap scrollLeft back by one copy whenever the
  // user nears either end, so the strip never runs out of tabs to
  // scroll into. Measured after layout, re-measured on resize.
  const setWidth = useRef(0)
  // Debounce timer for "scroll settled" detection — once the user
  // stops scrolling, whichever tab is nearest dead-center becomes the
  // active tab, the same way scrolling a native picker wheel selects
  // whatever lands in the middle.
  const settleId = useRef<number | null>(null)
  // Set right before calling setActiveTab() from the scroll-settle
  // handler so the "re-center on active tab change" effect below
  // (which also runs on click-driven changes) knows this particular
  // change already IS centered — it was the user's scroll that drove
  // it — and should skip re-scrolling, avoiding a jittery fight with
  // the user's gesture.
  const scrollDrivenChange = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const handler = () => setReducedMotion(mq.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const registerItemRef = useCallback(
    (extKey: string) => (el: HTMLButtonElement | null) => {
      if (el) itemRefs.current.set(extKey, el)
      else itemRefs.current.delete(extKey)
    },
    [],
  )

  const applyCurve = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller || reducedMotion) return
    const scrollerRect = scroller.getBoundingClientRect()
    const centerX = scrollerRect.left + scrollerRect.width / 2

    itemRefs.current.forEach((el) => {
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
  }, [reducedMotion])

  // Finds whichever looped tab button is closest to the strip's
  // visual center right now, and returns its real tab key (stripping
  // the `__copyIdx` suffix). Locked tabs are skipped here so a scroll
  // gesture never lands on a tab with nothing behind it — clicking a
  // locked tab directly still works via the button's own onClick.
  const getClosestRealKey = useCallback((): string | null => {
    const scroller = scrollerRef.current
    if (!scroller) return null
    const scrollerRect = scroller.getBoundingClientRect()
    const centerX = scrollerRect.left + scrollerRect.width / 2

    let closestKey: string | null = null
    let closestDist = Infinity
    itemRefs.current.forEach((el, extKey) => {
      const realKey = extKey.split("__")[0]
      if (lockedMap[realKey]) return
      const r = el.getBoundingClientRect()
      const dist = Math.abs(r.left + r.width / 2 - centerX)
      if (dist < closestDist) {
        closestDist = dist
        closestKey = realKey
      }
    })
    return closestKey
  }, [lockedMap])

  // Re-measures one copy-width and, on first run, parks the scroll
  // position in the middle copy so there's a full copy's worth of
  // tabs to scroll into on both sides right from the start.
  const measureAndCenterLoop = useCallback((recenter: boolean) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const width = scroller.scrollWidth / LOOP_COPIES
    setWidth.current = width
    if (recenter && width > 0) {
      scroller.scrollLeft = width // start in the middle copy
    }
  }, [])

  useEffect(() => {
    // Layout needs a tick to settle before scrollWidth is reliable.
    const raf = requestAnimationFrame(() => {
      measureAndCenterLoop(true)
      applyCurve()
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll handler: updates the curve every frame, silently wraps
  // scrollLeft back by one copy-width whenever it drifts near either
  // end of the looped strip, and — once scrolling settles — makes
  // whichever tab landed in the middle the active tab.
  const onScroll = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => {
      applyCurve()
      const scroller = scrollerRef.current
      const width = setWidth.current
      if (!scroller || width <= 0) return
      if (scroller.scrollLeft < width * 0.4) {
        scroller.scrollLeft += width
      } else if (scroller.scrollLeft > width * (LOOP_COPIES - 1.4)) {
        scroller.scrollLeft -= width
      }
    })

    if (settleId.current) window.clearTimeout(settleId.current)
    settleId.current = window.setTimeout(() => {
      const closest = getClosestRealKey()
      if (closest && closest !== activeTab) {
        scrollDrivenChange.current = true
        setActiveTab(closest)
      }
    }, 120)
  }, [applyCurve, getClosestRealKey, activeTab, setActiveTab])

  useEffect(() => {
    const handleResize = () => {
      measureAndCenterLoop(false)
      applyCurve()
    }
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      if (rafId.current) cancelAnimationFrame(rafId.current)
      if (settleId.current) window.clearTimeout(settleId.current)
    }
  }, [measureAndCenterLoop, applyCurve])

  // Center the active tab whenever it changes (click, or programmatic)
  // — picks whichever looped copy of that tab is nearest the current
  // scroll position, so the jump is always small. Skipped when the
  // change was itself driven by the user scrolling the strip to
  // center — it's already centered, so re-scrolling would just fight
  // the gesture that just finished.
  useEffect(() => {
    if (scrollDrivenChange.current) {
      scrollDrivenChange.current = false
      return
    }
    const scroller = scrollerRef.current
    if (!scroller) return
    const scrollerRect = scroller.getBoundingClientRect()
    const centerX = scrollerRect.left + scrollerRect.width / 2

    let closestEl: HTMLButtonElement | null = null
    let closestDist = Infinity
    itemRefs.current.forEach((el, extKey) => {
      if (extKey.split("__")[0] !== activeTab) return
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
    const t = setTimeout(applyCurve, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  return { loopedTabs, scrollerRef, registerItemRef, onScroll, reducedMotion }
}

/** The curved, infinite-loop tab strip itself — renders `loopedTabs`
 *  as plain buttons (no Radix TabsTrigger — the arc math needs direct
 *  imperative control over each button's transform/opacity per scroll
 *  frame) that call `setActiveTab` directly. Locked tabs still render
 *  clickable, just dimmed with a lock icon, matching how every other
 *  tab on this page shows a "coming soon" placeholder in its content
 *  rather than being disabled outright. */
function CurvedTabBar({
  tabs,
  activeTab,
  setActiveTab,
  lockedMap,
}: {
  tabs: CurvedTabDef[]
  activeTab: string
  setActiveTab: (v: string) => void
  lockedMap: Record<string, boolean>
}) {
  const { loopedTabs, scrollerRef, registerItemRef, onScroll, reducedMotion } = useCurvedInfiniteTabs(
    tabs,
    activeTab,
    setActiveTab,
    lockedMap,
  )

  return (
    <div className="relative mb-6">
      {/* subtle arc backdrop so the curve reads even before scrolling */}
      <svg
        className="pointer-events-none absolute left-0 right-0 -top-1 h-6 w-full opacity-20"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
      >
        <path d="M0,10 Q50,0 100,10" stroke="#f5a623" strokeWidth="0.5" fill="none" />
      </svg>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex flex-nowrap items-end gap-1.5 overflow-x-auto snap-x snap-mandatory
                   scrollbar-none bg-black/50 border border-gold/20 px-3 py-3 rounded-full w-full"
      >
        {loopedTabs.map(({ key, label, extKey }) => {
          const locked = lockedMap[key]
          const active = activeTab === key
          return (
            <button
              key={extKey}
              ref={registerItemRef(extKey)}
              type="button"
              onClick={() => setActiveTab(key)}
              title={locked ? `${label} — coming soon` : undefined}
              className={`snap-center shrink-0 flex items-center gap-1.5 font-cinzel text-xs uppercase
                tracking-wide px-4 py-2 rounded-full whitespace-nowrap origin-bottom
                transition-[background-color,color,border-color] duration-300 ${
                reducedMotion ? "" : "transition-transform will-change-transform"
              } ${
                active
                  ? "bg-gold text-black shadow-[0_4px_18px_rgba(245,166,35,0.35)] border border-gold"
                  : locked
                    ? "bg-white/[0.02] text-gray-600 border border-white/5 hover:text-gray-400"
                    : "bg-white/[0.03] text-gray-300 border border-gold/10 hover:text-gold hover:border-gold/30"
              }`}
            >
              {label}
              {locked && <Lock className="h-2.5 w-2.5" />}
            </button>
          )
        })}
      </div>

      {/* edge fades — purely decorative now, since the loop means the
          strip is never actually empty past these edges */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 rounded-l-full bg-gradient-to-r from-black/70 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 rounded-r-full bg-gradient-to-l from-black/70 to-transparent" />
    </div>
  )
}

const TOURNAMENT_TABS: CurvedTabDef[] = [
  { key: "overview", label: "Overview" },
  { key: "points", label: "Points Table" },
  { key: "lineup", label: "Line Up" },
  { key: "schedule", label: "Schedule" },
  { key: "bracket", label: "Bracket" },
  { key: "squads", label: "Squads" },
  { key: "stats", label: "Stats" },
  { key: "prizes", label: "Prizes" },
]

export default function TournamentDetailClient({ tournament, slug }: TournamentDetailClientProps) {
  useScrollTop()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(() => defaultTabForStatus(tournament.status))
  const [isNavOpen, setIsNavOpen] = useState(false)

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }

  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  const status = tournament.status || "Upcoming"
  const statusColor =
    status === "Live"
      ? "bg-yellow-600 hover:bg-yellow-700"
      : status === "Completed"
        ? "bg-green-600 hover:bg-green-700"
        : "bg-gold text-black hover:bg-gold/90"

  const hasPoints = !!tournament.pointsTable?.length
  const hasFixtures = !!tournament.fixtures?.length

  // Bracket tab shows if either bracketFormat is set (new chart-style
  // preview — generates its own demo data, ignores tournament.bracket)
  // or the legacy flat bracket array has entries.
  const hasBracket = !!tournament.bracketFormat || !!tournament.bracket?.length

  const hasSquads = !!tournament.squads?.length
  const hasLeaderboard = !!(tournament.battingStats?.length || tournament.bowlingStats?.length)

  const hasAwards = !!tournament.awards?.length
  const hasPrizes = !!tournament.prizes?.length

  // Team name -> logo, shared by Schedule and the new Line Up tab.
  const logoByTeam = useMemo(
    () => new Map((tournament.squads ?? []).filter((s) => s.logo).map((s) => [s.team, s.logo as string])),
    [tournament.squads],
  )

  // Champion / runner-up / semifinalist for the Line Up tab — see
  // "NOTE ON LINE UP" above for how this is derived and its fallback.
  const lineup = useMemo(
    () => deriveLineup(tournament.bracket, tournament.pointsTable, logoByTeam),
    [tournament.bracket, tournament.pointsTable, logoByTeam],
  )
  const hasLineup = !!lineup.champion

  // Which top-level tabs are locked right now — shared by the curved
  // tab bar (styling + which tabs a scroll gesture may land on).
  const lockedMap = useMemo(
    () => ({
      overview: false,
      points: !hasPoints,
      lineup: !hasLineup,
      schedule: !hasFixtures,
      bracket: !hasBracket,
      squads: !hasSquads,
      stats: !hasLeaderboard,
      prizes: false,
    }),
    [hasPoints, hasLineup, hasFixtures, hasBracket, hasSquads, hasLeaderboard],
  )

  // Shared class applied to every TabsContent so panels stay mounted
  // (forceMount) and are only ever shown/hidden via CSS driven off
  // Radix's own data-state attribute — see the NOTE ON TABS glitch fix
  // above.
  const tabContentClass = "mt-0 data-[state=inactive]:hidden"

  return (
    <main className="overflow-hidden">
       <style
        dangerouslySetInnerHTML={{
          __html: `${pageStyles}
          html, body {
            overflow-x: hidden;
            max-width: 100%;
          }`,
        }}
      />


      <SiteHeader
        activeSection={tournament.title}
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      <section className="pt-24 pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />

            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">          {/* Row 1: Banner + Tournament Information.
              A grid row stretches every cell in it to match the
              tallest one, so the banner and the info card always
              line up in height — whichever needs more room wins,
              and the shorter one is stretched to match instead of
              scrolling or leaving empty space. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:items-stretch mb-8">
            {/* Banner */}
            <div className="lg:col-span-2 fade-in">
              <div className="relative h-64 md:h-80 lg:h-full min-h-[16rem] rounded-lg overflow-hidden glow-effect border border-gold/20">
                <Image
                  src={tournament.image || "/placeholder.svg"}
                  alt={tournament.title}
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                <div className="absolute bottom-0 left-0 p-6">
                  <h1 className="text-3xl md:text-4xl font-bold text-white font-cinzel">{tournament.title}</h1>
                </div>
              </div>
            </div>

            {/* Tournament Information — no fixed height and no
                overflow-y-auto; the grid stretch above makes this
                match the banner's height (or the banner matches
                this, whichever is taller), and it never scrolls
                internally. Hidden on mobile where it just added extra
                scroll height for little value; shown again from lg:
                up where it sits neatly beside the banner. */}
            <div className="hidden lg:block lg:col-span-1 fade-in-up">
              <div className="lg:h-full bg-black/50 border border-gold/20 rounded-lg p-6 flex flex-col">
                <h3 className="text-xl font-bold text-white mb-4 font-cinzel">Tournament Information</h3>
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <Trophy className="h-4 w-4 text-gold" />
                    <div>
                      <p className="text-gray-400 text-sm">Organizer</p>
                      <p className="text-white font-semibold">{tournament.by}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-gold" />
                    <div>
                      <p className="text-gray-400 text-sm">Category</p>
                      <p className="text-white font-semibold">{tournament.tag}</p>
                    </div>
                  </div>
                  {tournament.startDate && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-gold" />
                      <div>
                        <p className="text-gray-400 text-sm">Start Date</p>
                        <p className="text-white font-semibold">{tournament.startDate}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Status</p>
                    <Badge className={statusColor}>{status}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Tabs (main) + rest of sidebar */}
          <div className="flex flex-col lg:flex-row gap-8 lg:items-stretch">
            {/* Main Content */}
            <div className="w-full lg:w-2/3 fade-in">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <CurvedTabBar
                  tabs={TOURNAMENT_TABS}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  lockedMap={lockedMap}
                />

                {/* OVERVIEW */}
                <TabsContent value="overview" forceMount className={tabContentClass}>
                  <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-4 font-cinzel">ABOUT THE TOURNAMENT</h2>
                    {tournament.description ? (
                      <AdvancedMarkdown
                        source={tournament.description}
                        className="!max-w-none !p-0"
                      />
                    ) : (
                      <p className="text-gray-500 italic text-sm">
                        No description has been added for this tournament yet.
                      </p>
                    )}
                  </div>
                </TabsContent>

                {/* POINTS TABLE */}
                <TabsContent value="points" forceMount className={tabContentClass}>
                  {hasPoints ? (
                    <PointsTablePanel rows={tournament.pointsTable!} />
                  ) : (
                    <LockedTabPlaceholder
                      icon={ListOrdered}
                      title="Points Table Coming Soon"
                      description="Once matches are played, standings, net run rate, and each team's recent form will be tracked here automatically."
                    />
                  )}
                </TabsContent>

                {/* SCHEDULE */}
                <TabsContent value="schedule" forceMount className={tabContentClass}>
                  {hasFixtures ? (
                    <SchedulePanel fixtures={tournament.fixtures!} squads={tournament.squads} slug={slug} />
                  ) : (
                    <LockedTabPlaceholder
                      icon={CalendarClock}
                      title="Schedule Not Announced Yet"
                      description="Match dates, times, and venues will appear here once the fixture list is published."
                    />
                  )}
                </TabsContent>

                {/* BRACKET */}
                <TabsContent value="bracket" forceMount className={tabContentClass}>
                  {hasBracket ? (
                    tournament.bracketFormat === "double" ? (
                      <BracketPreviewPanel format="double" slug={slug} doubleElimData={tournament.doubleElimData} />
                    ) : tournament.bracketFormat === "single" ? (
                      <BracketPreviewPanel format="single" slug={slug} bracketRounds={tournament.bracketRounds} />
                    ) : (
                      // Legacy fallback for tournaments with only the old flat `bracket`
                      // array and no bracketFormat set (e.g. round-robin tournaments).
                      <BracketPanel matches={tournament.bracket!} slug={slug} />
                    )
                  ) : (
                    <LockedTabPlaceholder
                      icon={Network}
                      title="Playoff Bracket Not Set Up"
                      description="Once the playoff stage is configured, the full knockout bracket will be previewed here."
                    />
                  )}
                </TabsContent>

                {/* SQUADS */}
                <TabsContent value="squads" forceMount className={tabContentClass}>
                  {hasSquads ? (
                    <SquadsPanel squads={tournament.squads!} />
                  ) : (
                    <LockedTabPlaceholder
                      icon={Shield}
                      title="Squads Not Added Yet"
                      description="Team rosters and captains will show up here once squads are registered for this tournament."
                    />
                  )}
                </TabsContent>

                {/* STATS / LEADERBOARD */}
                <TabsContent value="stats" forceMount className={tabContentClass}>
                  {hasLeaderboard ? (
                    <TournamentStatsPanel
                      batting={tournament.battingStats || []}
                      bowling={tournament.bowlingStats || []}
                      fixtures={tournament.fixtures || []}
                    />
                  ) : (
                    <LockedTabPlaceholder
                      icon={Award}
                      title="Leaderboard Not Available Yet"
                      description="Top run-scorers and wicket-takers will populate here once matches start being recorded."
                    />
                  )}
                </TabsContent>

                {/* LINE UP — champion / runner-up / semifinalist podium */}
                <TabsContent value="lineup" forceMount className={tabContentClass}>
                  {hasLineup ? (
                    <TeamLineupPanel
                      champion={lineup.champion}
                      runnerUp={lineup.runnerUp}
                      semifinalist={lineup.semifinalist}
                    />
                  ) : (
                    <LockedTabPlaceholder
                      icon={Crown}
                      title="Winners Lineup Not Available Yet"
                      description="Once the final has been played, the champion, runner-up, and a semifinalist will be showcased here."
                    />
                  )}
                </TabsContent>

                {/* PRIZES & AWARDS */}
                <TabsContent value="prizes" forceMount className={tabContentClass}>
                  <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-4 font-cinzel flex items-center gap-2">
                      <Award className="h-5 w-5 text-gold" />
                      PRIZES & AWARDS
                    </h2>

                    {tournament.prizePool && (
                      <p className="text-gray-300 mb-4">
                        <span className="text-gold font-semibold">Total Prize Pool: </span>
                        {tournament.prizePool}
                      </p>
                    )}

                    {/* Legacy place/reward list — tournament_prizes, still
                        editable from its own card on the edit page. Shown
                        above the awards grid, inside the same card, rather
                        than as a separate tab. */}
                    {hasPrizes && (
                      <div className="space-y-3 mb-6 pb-6 border-b border-gold/10">
                        {tournament.prizes!.map((p) => (
                          <div
                            key={p.place}
                            className="flex items-center justify-between border-b border-gold/10 pb-2 last:border-b-0 last:pb-0"
                          >
                            <span className="text-white font-semibold">{p.place}</span>
                            <span className="text-gray-300">{p.reward}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {hasAwards ? (
                      <AwardsGrid awards={tournament.awards!} />
                    ) : (
                      !hasPrizes && (
                        <p className="text-gray-400 text-sm">Prize and award breakdown to be announced.</p>
                      )
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar (rest) */}
            <div className="w-full lg:w-1/3 fade-in-up">
              {(tournament.website || tournament.twitter || tournament.discord) && (
                <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
                  <h3 className="text-xl font-bold text-white mb-4 font-cinzel">Social Links</h3>
                  <div className="space-y-3">
                    {tournament.website && (
                      <Link
                        href={tournament.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-gray-300 hover:text-gold transition-colors"
                      >
                        <Globe className="h-4 w-4" />
                        <span>Official Website</span>
                      </Link>
                    )}
                    {tournament.twitter && (
                      <Link
                        href={tournament.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-gray-300 hover:text-gold transition-colors"
                      >
                        <Twitter className="h-4 w-4" />
                        <span>Twitter</span>
                      </Link>
                    )}
                    {tournament.discord && (
                      <Link
                        href={tournament.discord}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-gray-300 hover:text-gold transition-colors"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>Discord</span>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold text-white mb-4 font-cinzel">Run Your Own</h3>
                <p className="text-gray-300 mb-4 text-sm">
                  Want your league running on Valiant League too? Start free with one live match and points table.
                </p>
                <Button className="w-full bg-gold hover:bg-gold/90 text-black font-bold">
                  <Link href="/organization" className="flex items-center justify-center gap-2 w-full">
                    Get Started
                  </Link>
                </Button>
              </div>

              {/* <RelatedTournaments currentSlug={slug} currentTag={tournament.tag} /> */}
            </div>
          </div>

          {/* <div className="mt-12 flex items-center justify-center gap-4">
            <Link href="/tournaments">
              <Button className="bg-gold hover:bg-gold/90 py-2 text-black font-bold">Back to Tournaments</Button>
            </Link>
            <Link href={`/tournaments/${slug}/edit`}>
              <Button
                variant="outline"
                className="border-gold/40 text-gold hover:bg-gold/10 hover:text-gold py-2 font-bold bg-transparent"
              >
                Edit Tournament
              </Button>
            </Link>
          </div> */}
        </div>
      </section>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────
// LOCKED TAB PLACEHOLDER — shown in place of a tab's content when
// that part of the tournament hasn't been set up yet, so visitors
// can see what a fully-run tournament will eventually show here.
// ─────────────────────────────────────────────────────────────
function LockedTabPlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-10 mb-8 flex flex-col items-center text-center gap-3">
      <div className="h-12 w-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center relative">
        <Icon className="h-5 w-5 text-gold/50" />
        <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-black border border-gold/30 flex items-center justify-center">
          <Lock className="h-2.5 w-2.5 text-gold" />
        </span>
      </div>
      <h3 className="text-white font-bold font-cinzel">{title}</h3>
      <p className="text-gray-400 text-sm max-w-sm">{description}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// POINTS TABLE PANEL — card-row standings with a visible
// qualification line, per-team NRR bar, and form pills.
//
// FIXED: standings previously sorted on `points` alone, so teams
// tied on points kept whatever order the underlying data happened
// to be in instead of being separated by the standard cricket
// tiebreaker. The sort now falls back to NRR (higher first) whenever
// two teams are level on points.
// ─────────────────────────────────────────────────────────────
function PointsTablePanel({ rows }: { rows: PointsRow[] }) {
  const sorted = [...rows].sort((a, b) => {
    const pointsDiff = b.points - a.points
    if (pointsDiff !== 0) return pointsDiff
    // Tied on points -> higher NRR ranks first
    return (parseFloat(b.nrr) || 0) - (parseFloat(a.nrr) || 0)
  })
  const maxPoints = Math.max(1, ...sorted.map((r) => r.points))
  const QUALIFY_COUNT = 4

  const nrrValues = sorted.map((r) => parseFloat(r.nrr) || 0)
  const maxAbsNrr = Math.max(0.5, ...nrrValues.map((v) => Math.abs(v)))

  const [openCalc, setOpenCalc] = useState<{ row: PointsRow; rank: number } | null>(null)

  return (
    <div className="relative bg-black/50 border border-gold/20 rounded-xl p-6 mb-8 overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gold/[0.06] blur-3xl" />

      <div className="relative flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h2 className="text-2xl font-bold text-white font-cinzel flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center">
            <ListOrdered className="h-4 w-4 text-gold" />
          </span>
          POINTS TABLE
        </h2>
        <p className="text-gray-400 text-[11px] font-cinzel uppercase tracking-widest flex items-center gap-1.5 bg-white/[0.03] border border-white/10 rounded-full px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-gold shadow-[0_0_6px_rgba(212,175,55,0.8)]" />
          Top {QUALIFY_COUNT} qualify for playoffs
        </p>
      </div>

      <div className="relative hidden sm:grid grid-cols-[2.75rem_1fr_3rem_3rem_3rem_8rem_6.5rem_3.5rem] gap-2 px-4 pb-2.5 mb-1 text-gray-500 text-[10px] uppercase tracking-widest font-cinzel border-b border-white/5">
        <span>#</span>
        <span>Team</span>
        <span className="text-center">P</span>
        <span className="text-center">W</span>
        <span className="text-center">L</span>
        <span>NRR</span>
        <span className="text-right">Form</span>
        <span className="text-right">Pts</span>
      </div>

      <div className="relative space-y-2">
        {sorted.map((row, i) => {
          const rank = i + 1
          const showQualifyDivider = rank === QUALIFY_COUNT + 1 && sorted.length > QUALIFY_COUNT
          return (
            <div key={row.short}>
              {showQualifyDivider && <QualificationDivider />}
              <PointsTableRow
                row={row}
                rank={rank}
                qualified={rank <= QUALIFY_COUNT}
                pointsBarWidth={Math.max(6, (row.points / maxPoints) * 100)}
                maxAbsNrr={maxAbsNrr}
                onShowCalculation={() => setOpenCalc({ row, rank })}
              />
            </div>
          )
        })}
      </div>

      <p className="relative text-gray-500 text-[10px] text-center mt-4 flex items-center justify-center gap-1.5">
        <Calculator className="h-3 w-3" />
        Tap any team to see how their points are calculated
      </p>

      {openCalc && (
        <PointsCalculationOverlay
          row={openCalc.row}
          rank={openCalc.rank}
          qualified={openCalc.rank <= QUALIFY_COUNT}
          onClose={() => setOpenCalc(null)}
        />
      )}
    </div>
  )
}

function QualificationDivider() {
  return (
    <div className="flex items-center gap-3 py-1.5 px-1">
      <span className="h-px flex-1 bg-gradient-to-r from-gold/50 to-transparent" />
      <span className="text-gold/70 text-[9px] font-cinzel uppercase tracking-[0.2em] whitespace-nowrap">
        Qualification Line
      </span>
      <span className="h-px flex-1 bg-gradient-to-l from-gold/50 to-transparent" />
    </div>
  )
}

function PointsTableRow({
  row,
  rank,
  qualified,
  pointsBarWidth,
  maxAbsNrr,
  onShowCalculation,
}: {
  row: PointsRow
  rank: number
  qualified: boolean
  pointsBarWidth: number
  maxAbsNrr: number
  onShowCalculation: () => void
}) {
  const nrrVal = parseFloat(row.nrr) || 0
  const nrrPositive = nrrVal >= 0
  const nrrBarWidth = Math.min(100, (Math.abs(nrrVal) / maxAbsNrr) * 100)

  const medal =
    rank === 1
      ? { Icon: Crown, badge: "bg-gradient-to-br from-yellow-300 to-gold text-black" }
      : rank === 2
        ? { Icon: Medal, badge: "bg-gradient-to-br from-gray-200 to-gray-400 text-black" }
        : rank === 3
          ? { Icon: Medal, badge: "bg-gradient-to-br from-amber-600 to-amber-800 text-white" }
          : null

  return (
    <button
      type="button"
      onClick={onShowCalculation}
      aria-label={`See how ${row.team}'s points were calculated`}
      className={`group relative w-full text-left grid grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[2.75rem_1fr_3rem_3rem_3rem_8rem_6.5rem_3.5rem] items-center gap-2 rounded-xl border px-4 py-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 ${
        qualified
          ? "border-gold/25 bg-gradient-to-r from-gold/[0.07] via-white/[0.02] to-transparent hover:border-gold/45"
          : "border-white/10 bg-white/[0.03] hover:border-white/20"
      }`}
    >
      <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-gold text-black flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 shadow-md">
        <Calculator className="h-3 w-3" />
      </span>

      {qualified && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-gold" />}

      <span
        className={`relative h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold font-cinzel shrink-0 ${
          medal ? medal.badge : qualified ? "bg-gold/15 text-gold border border-gold/40" : "bg-white/10 text-gray-200 border border-white/15"
        }`}
      >
        {medal ? <medal.Icon className="h-3.5 w-3.5" /> : rank}
      </span>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-semibold font-cinzel truncate">{row.team}</span>
          <span className="text-gray-400 text-[10px] uppercase tracking-wide sm:hidden">
            {row.played}P · {row.won}W · {row.lost}L
          </span>
        </div>
        <div className="h-1 rounded-full bg-white/10 overflow-hidden mt-1.5 max-w-[220px]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold transition-all duration-500"
            style={{ width: `${pointsBarWidth}%` }}
          />
        </div>
      </div>

      <span className="hidden sm:block text-center text-gray-200 text-sm font-medium">{row.played}</span>
      <span className="hidden sm:block text-center text-gray-200 text-sm font-medium">{row.won}</span>
      <span className="hidden sm:block text-center text-gray-200 text-sm font-medium">{row.lost}</span>

      <div className="hidden sm:flex items-center gap-2">
        <span className={`text-xs font-bold w-12 shrink-0 ${nrrPositive ? "text-green-400" : "text-red-400"}`}>
          {row.nrr}
        </span>
      </div>

      <div className="col-start-3 sm:hidden flex items-center gap-3 justify-self-end">
        <div className="flex gap-1">
          {row.form?.map((f, j) => (
            <FormPill key={j} result={f} />
          ))}
        </div>
        <span className="min-w-[2.5rem] text-right text-gold font-bold font-cinzel text-lg leading-none">
          {row.points}
        </span>
      </div>

      <div className="hidden sm:flex items-center gap-1 justify-self-end">
        {row.form?.map((f, j) => (
          <FormPill key={j} result={f} />
        ))}
      </div>

      <span className="hidden sm:block text-right text-gold font-bold font-cinzel text-xl leading-none">
        {row.points}
      </span>
    </button>
  )
}

function FormPill({ result }: { result: "W" | "L" | "NR" }) {
  return (
    <span
      className={`h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-bold ring-1 ${
        result === "W"
          ? "bg-green-600 text-white ring-green-400/40"
          : result === "L"
            ? "bg-red-600/90 text-white ring-red-400/40"
            : "bg-gray-600 text-white ring-white/20"
      }`}
    >
      {result}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// POINTS CALCULATION OVERLAY
// ─────────────────────────────────────────────────────────────
function PointsCalculationOverlay({
  row,
  rank,
  qualified,
  onClose,
}: {
  row: PointsRow
  rank: number
  qualified: boolean
  onClose: () => void
}) {
  const tied = Math.max(0, row.points - row.won * 2)
  const nrrVal = parseFloat(row.nrr) || 0
  const nrrPositive = nrrVal >= 0
  const matchBreakdown = row.matches ?? []

  const formulaRows = [
    { label: "Wins", count: row.won, per: 2, subtotal: row.won * 2 },
    ...(tied > 0 ? [{ label: "Ties", count: tied, per: 1, subtotal: tied * 1 }] : []),
    { label: "Losses", count: row.lost, per: 0, subtotal: 0 },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 mt-16"
      role="dialog"
      aria-modal="true"
      aria-label={`Points calculation for ${row.team}`}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-[#0d0d0f] border border-gold/25 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
        <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-gold/[0.08] blur-3xl" />

        <div className="relative flex items-start justify-between gap-3 p-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold font-cinzel shrink-0 ${
                rank === 1
                  ? "bg-gradient-to-br from-yellow-300 to-gold text-black"
                  : qualified
                    ? "bg-gold/15 text-gold border border-gold/40"
                    : "bg-white/10 text-gray-200 border border-white/15"
              }`}
            >
              {rank}
            </span>
            <div className="min-w-0">
              <p className="text-white font-bold font-cinzel truncate">{row.team}</p>
              <p className="text-gray-400 text-[11px] uppercase tracking-widest">
                {qualified ? "In playoff position" : "Outside playoff position"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative p-5 space-y-6 overflow-y-auto">
          <div>
            <h4 className="text-gold text-[11px] font-cinzel uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5" />
              Points Calculation
            </h4>
            <div className="space-y-1.5">
              {formulaRows.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center justify-between text-sm bg-white/[0.03] border border-white/5 rounded-md px-3 py-2"
                >
                  <span className="text-gray-300">
                    {f.label} <span className="text-gray-500">({f.count} × {f.per})</span>
                  </span>
                  <span className="text-white font-semibold font-cinzel">{f.subtotal}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm rounded-md px-3 py-2.5 bg-gold/10 border border-gold/30 mt-2">
                <span className="text-gold font-cinzel uppercase tracking-wide text-xs">Total Points</span>
                <span className="text-gold font-bold font-cinzel text-lg">{row.points}</span>
              </div>
            </div>
            <p className="text-gray-500 text-[10px] mt-2">
              {row.played} matches played · win = 2 pts, tie = 1 pt, loss = 0 pts
            </p>
          </div>

          <div>
            <h4 className="text-gold text-[11px] font-cinzel uppercase tracking-widest mb-3">Net Run Rate</h4>

            {matchBreakdown.length > 0 ? (
              <>
                <div className="space-y-1.5 mb-3">
                  {matchBreakdown.map((m) => (
                    <div
                      key={m.matchId}
                      className="flex items-center justify-between text-xs bg-white/[0.03] border border-white/5 rounded-md px-3 py-2 gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                            m.result === "W"
                              ? "bg-green-600 text-white"
                              : m.result === "L"
                                ? "bg-red-600/90 text-white"
                                : "bg-gray-600 text-white"
                          }`}
                        >
                          {m.result}
                        </span>
                        <span className="text-gray-300 truncate">vs {m.opponent}</span>
                      </div>
                      <span className="text-gray-400 font-mono shrink-0 text-right whitespace-nowrap">
                        {m.runsScored}/{m.oversFaced}ov
                        <span className="text-gray-600 mx-1">·</span>
                        conceded {m.runsConceded}/{m.oversBowled}ov
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-gray-500 text-[10px] mb-3 leading-relaxed">
                  NRR isn't averaged match-to-match — every match's runs and overs above are summed first,
                  then the rate is taken once across the total.
                </p>
              </>
            ) : (
              <p className="text-gray-500 text-[10px] mb-3 italic">
                Match-by-match breakdown not available for this team yet.
              </p>
            )}

            <div className="bg-white/[0.03] border border-white/5 rounded-md px-3 py-3">
              <p className="text-gray-400 text-xs font-mono mb-2 leading-relaxed">
                NRR = (runs scored ÷ overs faced) − (runs conceded ÷ overs bowled)
              </p>
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">Current NRR</span>
                <span className={`font-bold font-cinzel text-lg ${nrrPositive ? "text-green-400" : "text-red-400"}`}>
                  {row.nrr}
                </span>
              </div>
            </div>
            <p className="text-gray-500 text-[10px] mt-2 leading-relaxed">
              Calculated across all {row.played} completed matches per ICC rules — if a team is bowled out, their
              overs faced count as the full quota rather than the actual balls used, so a collapse can't inflate
              their own rate.
            </p>
          </div>

          {row.form && row.form.length > 0 && (
            <div>
              <h4 className="text-gold text-[11px] font-cinzel uppercase tracking-widest mb-3">
                Recent Form (last {row.form.length})
              </h4>
              <div className="flex gap-1.5">
                {row.form.map((f, j) => (
                  <FormPill key={j} result={f} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SCHEDULE PANEL
// ─────────────────────────────────────────────────────────────

// A real bye: exactly one side is a real team, the other is permanently
// empty — that team auto-advances with no opponent.
function isBye(f: Fixture) {
  const t1 = (f.team1 || "").trim().toUpperCase()
  const t2 = (f.team2 || "").trim().toUpperCase()
  const oneSideMissing = (t1 === "TBD" || !t1) !== (t2 === "TBD" || !t2)
  return oneSideMissing && f.status === "completed"
}

// A phantom double-bye: BOTH sides were byes upstream (see
// bracket_matches reconciliation), so this slot has no real team at
// all yet — it's "completed" only so it can flow forward and later be
// swapped for whichever real team eventually drops in. There is no
// advancing team to show, so this must never render as a played match
// or as a single-team ByeRow (which would incorrectly show "TBD
// advances").
function isPhantomBye(f: Fixture) {
  const t1 = (f.team1 || "").trim().toUpperCase()
  const t2 = (f.team2 || "").trim().toUpperCase()
  const bothMissing = (t1 === "TBD" || !t1) && (t2 === "TBD" || !t2)
  return bothMissing && f.status === "completed"
}

// Two Fixture rows can end up describing the exact same bye slot
// (one written for the "match", one for the auto-advance record).
// Collapse them to a single row keyed on the round + the team that
// is actually advancing, so the same bye never renders twice.
function dedupeByes(fixtures: Fixture[]): Fixture[] {
  const seen = new Set<string>()
  const result: Fixture[] = []
  for (const f of fixtures) {
    const roundLabel = (f as any).stage || (f as any).round || ""
    // Disambiguate distinct slots within the same round: two Fixture
    // rows only describe the SAME bye slot when they share a real
    // bracket identifier (matchNumber, falling back to id). Without
    // this, two different byes/phantom-byes landing in the same round
    // (e.g. Match 3 and Match 5 both being byes) collided on `round`
    // alone and the second one got silently dropped as a "duplicate".
    const slot = f.matchNumber ?? f.id ?? ""

    if (isPhantomBye(f)) {
      const key = `phantom|${roundLabel}|${slot}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push(f)
      continue
    }
    if (!isBye(f)) {
      result.push(f)
      continue
    }
    const advancingTeam = (f.team1 || "").trim().toUpperCase() === "TBD" || !f.team1 ? f.team2 : f.team1
    const key = `${roundLabel}|${(advancingTeam || "").trim().toUpperCase()}|${slot}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(f)
  }
  return result
}

function ByeRow({
  fixture: f,
  logo,
  color,
  matchNumber,
}: {
  fixture: Fixture
  logo?: string
  color: string
  matchNumber?: number
}) {
  const t1 = (f.team1 || "").trim().toUpperCase()
  const advancingTeam = t1 === "TBD" || !f.team1 ? f.team2 : f.team1
  const roundLabel = (f as any).stage || (f as any).round || (matchNumber ? `Match ${matchNumber}` : null)

  return (
    <div className="relative rounded-xl border border-gold/10 overflow-hidden h-full flex flex-col opacity-90">
      <div className="relative h-36 bg-black/60">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${color}40, rgba(0,0,0,0.94))` }}
        />

        {roundLabel && (
          <span className="absolute top-2 left-2 z-20 text-white/90 text-[10px] font-cinzel uppercase tracking-widest bg-black/50 border border-white/10 rounded-full px-2.5 py-0.5">
            {roundLabel}
          </span>
        )}
        <span className="absolute top-2 right-2 z-20 text-gray-300 text-[10px] font-bold font-cinzel px-2.5 py-1 rounded-full bg-white/10 border border-white/10">
          Bye
        </span>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1.5">
          {logo ? (
            <div
              className="relative h-20 w-20 rounded-full overflow-hidden border-2 ring-1 ring-black/40 bg-black/40"
              style={{ borderColor: color }}
            >
              <Image src={logo} alt={`${advancingTeam} logo`} fill className="object-cover" />
            </div>
          ) : (
            <div
              className="h-20 w-20 rounded-full bg-black/40 border-2 flex items-center justify-center"
              style={{ borderColor: color }}
            >
              <span className="text-white text-[13px] font-bold font-cinzel">{initials(advancingTeam || "?")}</span>
            </div>
          )}
          <span className="text-white text-[12px] font-semibold font-cinzel text-center leading-tight max-w-[160px] truncate">
            {advancingTeam || "TBD"}
          </span>
        </div>
      </div>

      <div className="bg-black/50 p-4 flex-1 flex flex-col items-center justify-center gap-1">
        <p className="text-gray-300 text-xs font-medium text-center">Advances automatically</p>
        <p className="text-gray-500 text-[10px] text-center">No opponent for this round</p>
      </div>
    </div>
  )
}

function PendingSlotRow({ fixture: f, matchNumber }: { fixture: Fixture; matchNumber?: number }) {
  const roundLabel = (f as any).stage || (f as any).round || (matchNumber ? `Match ${matchNumber}` : null)
  return (
    <div className="relative rounded-xl border border-gold/10 overflow-hidden h-full flex flex-col opacity-70">
      <div className="relative h-36 bg-black/60 flex items-center justify-center">
        {roundLabel && (
          <span className="absolute top-2 left-2 z-20 text-white/90 text-[10px] font-cinzel uppercase tracking-widest bg-black/50 border border-white/10 rounded-full px-2.5 py-0.5">
            {roundLabel}
          </span>
        )}
        <div className="h-20 w-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <span className="text-gray-500 text-[10px] font-cinzel uppercase tracking-wide">TBD</span>
        </div>
      </div>
      <div className="bg-black/50 p-4 flex-1 flex flex-col items-center justify-center gap-1">
        <p className="text-gray-400 text-xs font-medium text-center">Awaiting bracket progression</p>
        <p className="text-gray-500 text-[10px] text-center">No teams assigned to this slot yet</p>
      </div>
    </div>
  )
}

function SchedulePanel({ fixtures, squads, slug }: { fixtures: Fixture[]; squads?: Squad[]; slug: string }) {
  const [filter, setFilter] = useState<"all" | "live" | "upcoming" | "completed">("all")
  const logoByTeam = new Map(squads?.map((s) => [s.team, s.logo]) ?? [])
  const colorByTeam = new Map(squads?.map((s) => [s.team, (s as any).color as string | undefined]) ?? [])

  // Counts exclude byes — a bye isn't a played match, so it shouldn't
  // inflate the status-filter chip counts. It still shows in the list.
  const nonByeFixtures = fixtures.filter((f) => !isBye(f) && !isPhantomBye(f))
  const counts = {
    all: nonByeFixtures.length,
    live: nonByeFixtures.filter((f) => f.status === "live").length,
    upcoming: nonByeFixtures.filter((f) => f.status === "upcoming").length,
    completed: nonByeFixtures.filter((f) => f.status === "completed").length,
  }

  // Byes are excluded from status-specific filters (their "completed"
  // status isn't a real result), but always shown under "All".
  const filtered = dedupeByes(
    filter === "all" ? fixtures : fixtures.filter((f) => !isBye(f) && !isPhantomBye(f) && f.status === filter)
  )

  const stageOf = (f: Fixture) => (f as any).stage ?? "Matches"
  const stageOrder = ["Group Stage", "Round of 32", "Round of 16", "Quarterfinal", "Semifinal", "Final", "Matches"]

  const stageGroups = new Map<string, Fixture[]>()
  for (const f of filtered) {
    const s = stageOf(f)
    if (!stageGroups.has(s)) stageGroups.set(s, [])
    stageGroups.get(s)!.push(f)
  }
  const stages = [...stageGroups.keys()].sort((a, b) => {
    const ai = stageOrder.indexOf(a), bi = stageOrder.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  const statusBadge = (s: Fixture["status"]) => {
    if (s === "live") return <Badge className="bg-yellow-600 hover:bg-yellow-700">Live</Badge>
    if (s === "completed") return <Badge className="bg-green-600 hover:bg-green-700">Completed</Badge>
    return <Badge className="bg-yellow-600 hover:bg-yellow-700">Upcoming</Badge>
  }

  function getTeamColor(name: string, explicit?: string) {
    if (explicit) return explicit
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 62%, 42%)`
  }

  const filterOptions: { key: typeof filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "live", label: "Live" },
    { key: "upcoming", label: "Upcoming" },
    { key: "completed", label: "Completed" },
  ]

  const statusBadgeClass = (s: Fixture["status"], liveAccent: "red" | "green" = "red") => {
    if (s === "live") return liveAccent === "green" ? "bg-green-600 hover:bg-green-700" : "bg-yellow-600 hover:bg-yellow-700"
    if (s === "completed") return "bg-green-600 hover:bg-green-700"
    return "bg-blue-600 text-black hover:bg-blue-700/90"
  }

  const isTBD = (f: Fixture) => f.team1 === "TBD" || f.team2 === "TBD"

  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <h2 className="text-2xl font-bold text-white font-cinzel flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-gold" />
          MATCH SCHEDULE
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.map(
            ({ key, label }) =>
              counts[key] > 0 && (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`text-xs font-cinzel uppercase tracking-wide px-3 py-1.5 rounded-md border transition-colors ${
                    filter === key ? "bg-gold text-black border-gold" : "border-gold/20 text-gray-300 hover:border-gold/50"
                  }`}
                >
                  {label} <span className="opacity-60">({counts[key]})</span>
                </button>
              )
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm italic text-center py-10">
          No {filter !== "all" ? filter : ""} matches to show.
        </p>
      ) : (
        <div className="space-y-10">
          {stages.map((stage) => {
            const stageFixtures = [...stageGroups.get(stage)!].sort((a, b) => {
              if (a.matchNumber != null && b.matchNumber != null) {
                return a.matchNumber - b.matchNumber
              }
              if (a.matchNumber != null) return -1
              if (b.matchNumber != null) return 1

              const statusRank = (f: Fixture) =>
                f.status === "completed" ? 0 : f.status === "live" ? 1 : 2
              const statusDiff = statusRank(a) - statusRank(b)
              if (statusDiff !== 0) return statusDiff

              const tbdRank = (f: Fixture) => (isTBD(f) ? 1 : 0)
              return tbdRank(a) - tbdRank(b)
            })

            return (
              <div key={stage}>
                {stage !== "Matches" && (
                  <h3 className="text-white font-bold font-cinzel text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                    {stage}
                  </h3>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {stageFixtures.map((f) =>
                    isPhantomBye(f) ? (
                        <PendingSlotRow key={f.id} fixture={f} matchNumber={f.matchNumber ?? stageFixtures.indexOf(f) + 1} />
                      ) : isBye(f) ? (                      
                      <ByeRow
                        key={f.id}
                        fixture={f}
                        logo={logoByTeam.get(f.team1 !== "TBD" ? f.team1 : f.team2)}
                        color={getTeamColor(
                          f.team1 !== "TBD" ? f.team1 : f.team2,
                          colorByTeam.get(f.team1 !== "TBD" ? f.team1 : f.team2)
                        )}
                        matchNumber={f.matchNumber ?? stageFixtures.indexOf(f) + 1}
                      />
                    ) : (
                      <FixtureCard
                        key={f.id}
                        fixture={f}
                        team1Logo={logoByTeam.get(f.team1)}
                        team2Logo={logoByTeam.get(f.team2)}
                        team1Color={getTeamColor(f.team1, colorByTeam.get(f.team1))}
                        team2Color={getTeamColor(f.team2, colorByTeam.get(f.team2))}
                        statusBadgeClass={statusBadgeClass}
                        slug={slug}
                        matchNumber={f.matchNumber ?? stageFixtures.indexOf(f) + 1}
                      />
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TeamBadge({ name, logo }: { name: string; logo?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-16 shrink-0 transition-transform duration-300 group-hover:scale-[1.03]">
      {logo ? (
        <div className="relative h-10 w-10 rounded-full overflow-hidden border border-gold/25 ring-1 ring-black/40 bg-black/40 shrink-0">
          <Image src={logo} alt={`${name} logo`} fill className="object-cover" />
        </div>
      ) : (
        <div className="h-10 w-10 rounded-full bg-gold/10 border border-gold/25 flex items-center justify-center shrink-0">
          <span className="text-gold text-[10px] font-bold font-cinzel">{initials(name)}</span>
        </div>
      )}
      <span className="text-white text-[11px] font-semibold font-cinzel text-center leading-tight truncate w-full">
        {name}
      </span>
    </div>
  )
}

function FixtureCard({
  fixture: f,
  team1Logo,
  team2Logo,
  team1Color,
  team2Color,
  statusBadgeClass,
  slug,
  matchNumber,
}: {
  fixture: Fixture
  team1Logo?: string
  team2Logo?: string
  team1Color: string
  team2Color: string
  statusBadgeClass: (s: Fixture["status"], liveAccent?: "red" | "green") => string
  slug: string
  matchNumber?: number
}) {
  const isLive = f.status === "live"
  const isCompleted = f.status === "completed"
  const clickable = !!f.matchId

  const liveAccent: "red" | "green" = (f as any).liveAccent === "green" ? "green" : "red"
  const roundLabel = (f as any).stage || (f as any).round || (matchNumber ? `Match ${matchNumber}` : null)
  const timeLabel = f.time || "Time TBD"
  const venueLabel = f.venue || null
  const dateLabel = f.date && f.date !== "TBD" ? f.date : null

  const statusLabel = isLive ? "Live" : isCompleted ? "Completed" : "Upcoming"

  const card = (
    <div
      className={`group relative rounded-xl border overflow-hidden h-full flex flex-col transition-all duration-300 ${
        isLive
          ? liveAccent === "green"
            ? "border-green-500/50 shadow-[0_0_25px_-8px_rgba(34,197,94,0.35)]"
            : "border-red-500/50 shadow-[0_0_25px_-8px_rgba(220,38,38,0.35)]"
          : isCompleted
            ? "border-gold/10 opacity-70"
            : "border-gold/10"
      } ${
        clickable
          ? "cursor-pointer hover:border-gold/50 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]"
          : ""
      }`}
    >
      <div className="relative h-36 bg-black/60">
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(0 0, 58% 0, 42% 100%, 0 100%)",
            background: `linear-gradient(135deg, ${team1Color}80, rgba(0,0,0,0.92))`,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(58% 0, 100% 0, 100% 100%, 42% 100%)",
            background: `linear-gradient(225deg, ${team2Color}80, rgba(0,0,0,0.92))`,
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ clipPath: "polygon(57% 0, 60% 0, 44% 100%, 41% 100%)", background: "rgba(255,255,255,0.08)" }}
        />

        {roundLabel && (
          <span className="absolute top-2 left-2 z-20 text-white/90 text-[10px] font-cinzel uppercase tracking-widest bg-black/50 border border-white/10 rounded-full px-2.5 py-0.5">
            {roundLabel}
          </span>
        )}
        <span
          className={`absolute top-2 right-2 z-20 text-white text-[10px] font-bold font-cinzel px-2.5 py-1 rounded-full flex items-center gap-1 ${statusBadgeClass(
            f.status,
            liveAccent
          )}`}
        >
          {isLive && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
          {statusLabel}
        </span>

        <div className="absolute left-[16%] top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1.5">
          {team1Logo ? (
            <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 ring-1 ring-black/40 bg-black/40" style={{ borderColor: team1Color }}>
              <Image src={team1Logo} alt={`${f.team1} logo`} fill className="object-cover" />
            </div>
          ) : (
            <div className="h-20 w-20 rounded-full bg-black/40 border-2 flex items-center justify-center" style={{ borderColor: team1Color }}>
              <span className="text-white text-[11px] font-bold font-cinzel">{initials(f.team1)}</span>
            </div>
          )}
          <span className="text-white text-[11px] font-semibold font-cinzel text-center leading-tight max-w-[80px] truncate">
            {f.team1}
          </span>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <span className="h-8 w-8 rounded-full border border-gold/40 bg-black/70 flex items-center justify-center text-gold font-cinzel text-[10px] font-bold">
            VS
          </span>
        </div>

        <div className="absolute left-[84%] top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1.5">
          {team2Logo ? (
            <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 ring-1 ring-black/40 bg-black/40" style={{ borderColor: team2Color }}>
              <Image src={team2Logo} alt={`${f.team2} logo`} fill className="object-cover" />
            </div>
          ) : (
            <div className="h-20 w-20 rounded-full bg-black/40 border-2 flex items-center justify-center" style={{ borderColor: team2Color }}>
              <span className="text-white text-[11px] font-bold font-cinzel">{initials(f.team2)}</span>
            </div>
          )}
          <span className="text-white text-[11px] font-semibold font-cinzel text-center leading-tight max-w-[80px] truncate">
            {f.team2}
          </span>
        </div>
      </div>

      <div className="bg-black/50 p-4 flex-1">
        <p className="text-gray-300 text-xs font-medium text-center">{timeLabel}</p>
        {(dateLabel || venueLabel) && (
          <p className="text-gray-500 text-[11px] text-center mt-0.5 truncate">
            {[dateLabel, venueLabel].filter(Boolean).join(" · ")}
          </p>
        )}
        {f.result && (
          <p className="text-gold text-xs font-medium text-center mt-2 pt-2 border-t border-gold/10">{f.result}</p>
        )}
        {clickable && (
          <p className="text-gold/70 text-[10px] uppercase tracking-widest font-cinzel mt-2 text-center flex items-center justify-center gap-1 transition-transform duration-300 group-hover:gap-1.5">
            View match <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
          </p>
        )}
      </div>
    </div>
  )

  return clickable ? (
    <Link href={`/match/${f.matchId}`} className="block h-full">
      {card}
    </Link>
  ) : (
    card
  )
}

// ─────────────────────────────────────────────────────────────
// BRACKET PANEL (legacy flat-array fallback)
// ─────────────────────────────────────────────────────────────
function BracketPanel({ matches, slug }: { matches: BracketMatch[]; slug: string }) {
  const roundOf = (m: BracketMatch) =>
    (m as any).round ?? m.label.replace(/\s*-?\s*Match\s*\d+$/i, "").trim()

  const roundOrder = ["Round of 32", "Round of 16", "Quarterfinal", "Semifinal", "Final"]
  const grouped = new Map<string, BracketMatch[]>()
  for (const m of matches) {
    const r = roundOf(m)
    if (!grouped.has(r)) grouped.set(r, [])
    grouped.get(r)!.push(m)
  }

  const rounds = [...grouped.keys()].sort((a, b) => {
    const ai = roundOrder.indexOf(a)
    const bi = roundOrder.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  const COL_WIDTH = 260
  const CARD_HEIGHT = 108
  const CARD_GAP = 24

  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8 overflow-x-auto">
      <h2 className="text-2xl font-bold text-white mb-6 font-cinzel flex items-center gap-2">
        <Network className="h-5 w-5 text-gold" />
        PLAYOFF BRACKET
      </h2>

      <div
        className="flex gap-10 min-w-max pb-2"
        style={{ minWidth: rounds.length * (COL_WIDTH + 40) }}
      >
        {rounds.map((round, colIdx) => {
          const roundMatches = grouped.get(round)!
          const spacingMultiplier = Math.pow(2, colIdx)
          const topOffset = colIdx === 0 ? 0 : (CARD_HEIGHT + CARD_GAP) * (spacingMultiplier / 2 - 0.5)
          const gapBetween = (CARD_HEIGHT + CARD_GAP) * spacingMultiplier - CARD_HEIGHT

          return (
            <div key={round} style={{ width: COL_WIDTH }} className="shrink-0">
              <p className="text-gold/80 text-xs font-cinzel uppercase tracking-widest text-center mb-4 pb-2 border-b border-gold/10">
                {round}
              </p>
              <div
                className="flex flex-col"
                style={{ marginTop: topOffset, gap: gapBetween }}
              >
                {roundMatches.map((m) => (
                  <BracketCard key={m.id} match={m} height={CARD_HEIGHT} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BracketCard({ match: m, height }: { match: BracketMatch; height: number }) {
  const playable = hasMatchDetail(m.id)
  const card = (
    <div
      style={{ height }}
      className={`border border-gold/10 rounded-md p-3 bg-white/[0.02] flex flex-col justify-center transition-all ${
        playable ? "hover:border-gold/60 hover:bg-white/[0.04] cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-gold text-[10px] font-bold font-cinzel uppercase tracking-wide truncate">
          {m.label}
        </span>
        {m.date && <span className="text-gray-500 text-[10px] shrink-0 ml-2">{m.date}</span>}
      </div>
      <BracketTeamRow team={m.team1} isWinner={m.winner === m.team1.short} />
      <BracketTeamRow team={m.team2} isWinner={m.winner === m.team2.short} />
      {playable && (
        <p className="text-gold text-[9px] uppercase tracking-widest font-cinzel mt-1.5 text-right">
          View match →
        </p>
      )}
    </div>
  )

  return playable ? (
    <Link href={`/match/${m.id}`} className="block">
      {card}
    </Link>
  ) : (
    <div>{card}</div>
  )
}

function BracketTeamRow({ team, isWinner }: { team: BracketTeam; isWinner: boolean }) {
  const tbd = team.short === "TBD"
  return (
    <div
      className={`flex items-center justify-between py-2 px-2 rounded ${
        isWinner ? "bg-gold/10 border border-gold/30" : ""
      }`}
    >
      <span className={`text-sm ${tbd ? "text-gray-500 italic" : isWinner ? "text-white font-semibold" : "text-gray-300"}`}>
        {team.name}
      </span>
      {team.score && <span className="text-gray-400 text-xs">{team.score}</span>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// LINE UP — winners podium (champion / runner-up / semifinalist)
// ─────────────────────────────────────────────────────────────

interface LineupTeam {
  name: string
  short?: string
  logo?: string
}

/** Derives the champion, runner-up, and a semifinalist for the Line Up
 *  tab. See "NOTE ON LINE UP" near the top of this file for the full
 *  rationale and the Points-Table fallback used when there's no
 *  legacy `bracket` array to read from. */
function deriveLineup(
  bracket: BracketMatch[] | undefined,
  pointsTable: PointsRow[] | undefined,
  logoByTeam: Map<string, string>,
): { champion?: LineupTeam; runnerUp?: LineupTeam; semifinalist?: LineupTeam } {
  if (bracket && bracket.length > 0) {
    const roundOf = (m: BracketMatch) => (m as any).round ?? m.label.replace(/\s*-?\s*Match\s*\d+$/i, "").trim()

    // "Final" but not "Semifinal"/"Quarterfinal" (both contain "final").
    const finalMatch = bracket.find((m) => {
      const r = roundOf(m).toLowerCase()
      return r.includes("final") && !r.includes("semi") && !r.includes("quarter")
    })
    const semiMatches = bracket.filter((m) => roundOf(m).toLowerCase().includes("semi"))

    if (finalMatch && finalMatch.winner) {
      const winnerTeam = finalMatch.team1.short === finalMatch.winner ? finalMatch.team1 : finalMatch.team2
      const loserTeam = finalMatch.team1.short === finalMatch.winner ? finalMatch.team2 : finalMatch.team1

      const toLineupTeam = (t: BracketTeam): LineupTeam => ({
        name: t.name,
        short: t.short,
        logo: logoByTeam.get(t.name),
      })

      // First losing semifinalist that isn't TBD and isn't already the
      // champion/runner-up (guards against a bracket with a bye run
      // straight into the final).
      const semiLoser = semiMatches
        .map((m) => (m.team1.short === m.winner ? m.team2 : m.team1))
        .find((t) => t.short && t.short !== "TBD" && t.short !== winnerTeam.short && t.short !== loserTeam.short)

      return {
        champion: toLineupTeam(winnerTeam),
        runnerUp: toLineupTeam(loserTeam),
        semifinalist: semiLoser ? toLineupTeam(semiLoser) : undefined,
      }
    }
  }

  // Fallback: no (usable) legacy bracket — use final Points Table
  // standing instead, so the tab isn't empty whenever standings exist.
  if (pointsTable && pointsTable.length >= 2) {
    const sorted = [...pointsTable].sort((a, b) => {
      const diff = b.points - a.points
      if (diff !== 0) return diff
      return (parseFloat(b.nrr) || 0) - (parseFloat(a.nrr) || 0)
    })
    const toLineupTeam = (r: PointsRow): LineupTeam => ({ name: r.team, logo: logoByTeam.get(r.team) })
    return {
      champion: toLineupTeam(sorted[0]),
      runnerUp: sorted[1] ? toLineupTeam(sorted[1]) : undefined,
      semifinalist: sorted[2] ? toLineupTeam(sorted[2]) : undefined,
    }
  }

  return {}
}

const PODIUM_META: Record<
  1 | 2 | 3,
  { label: string; accent: string; ring: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; ringSize: string; podiumHeight: string }
> = {
  1: {
    label: "Champion",
    accent: "#F5D583",
    ring: "from-[#F5D583] via-[#D4AF37] to-[#C98A2E]",
    Icon: Crown,
    ringSize: "h-28 w-28 sm:h-36 sm:w-36",
    podiumHeight: "h-24 sm:h-28",
  },
  2: {
    label: "Runner-Up",
    accent: "#D8D8D8",
    ring: "from-[#EDEDED] via-[#C4C4C4] to-[#8A8A8A]",
    Icon: Medal,
    ringSize: "h-20 w-20 sm:h-28 sm:w-28",
    podiumHeight: "h-16 sm:h-20",
  },
  3: {
    label: "Semifinalist",
    accent: "#D8A06B",
    ring: "from-[#E3B27E] via-[#C98A4E] to-[#8B5A2B]",
    Icon: Medal,
    ringSize: "h-20 w-20 sm:h-28 sm:w-28",
    podiumHeight: "h-12 sm:h-14",
  },
}

function PodiumSpot({ team, place }: { team: LineupTeam; place: 1 | 2 | 3 }) {
  const meta = PODIUM_META[place]
  return (
    <div className="relative flex flex-col items-center flex-1 min-w-0 max-w-[8.5rem] sm:max-w-[11rem]">
      <span
        className="text-[10px] uppercase tracking-widest font-cinzel font-bold mb-2 whitespace-nowrap"
        style={{ color: meta.accent }}
      >
        {meta.label}
      </span>

      <div className={`relative ${meta.ringSize} mb-3 flex items-center justify-center shrink-0`}>
        <div
          className="absolute rounded-full blur-xl opacity-40 pointer-events-none"
          style={{ inset: "-16%", background: `radial-gradient(circle, ${meta.accent}55 0%, transparent 70%)` }}
        />
        <div className={`relative h-full w-full rounded-full p-[3px] bg-gradient-to-br ${meta.ring} shadow-lg`}>
          <div className="h-full w-full rounded-full bg-black/85 border border-white/10 flex items-center justify-center overflow-hidden">
            {team.logo ? (
              <div className="relative h-full w-full">
                <Image src={team.logo} alt={`${team.name} logo`} fill className="object-cover p-2" />
              </div>
            ) : (
              <span className="text-white text-sm font-bold font-cinzel">{initials(team.name)}</span>
            )}
          </div>
        </div>
        <span
          className="absolute -top-1 -right-1 h-7 w-7 rounded-full bg-black border-2 flex items-center justify-center shadow-md"
          style={{ borderColor: meta.accent }}
        >
          <meta.Icon className="h-3.5 w-3.5" style={{ color: meta.accent }} />
        </span>
      </div>

      <p className="text-white text-sm font-semibold font-cinzel text-center leading-tight truncate w-full mb-3">
        {team.name}
      </p>

      <div
        className={`w-full rounded-t-lg ${meta.podiumHeight} flex items-start justify-center pt-2.5`}
        style={{
          background: `linear-gradient(180deg, ${meta.accent}30, ${meta.accent}08)`,
          borderTop: `2px solid ${meta.accent}`,
        }}
      >
        <span className="text-lg font-black font-cinzel" style={{ color: meta.accent }}>
          {place}
        </span>
      </div>
    </div>
  )
}

function TeamLineupPanel({
  champion,
  runnerUp,
  semifinalist,
}: {
  champion?: LineupTeam
  runnerUp?: LineupTeam
  semifinalist?: LineupTeam
}) {
  if (!champion) return null

  return (
    <div className="relative bg-black/50 border border-gold/20 rounded-xl p-8 sm:p-10 mb-8 overflow-hidden">
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-gold/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="relative text-center mb-10">
        <p className="text-gold/70 text-[10px] uppercase tracking-[0.3em] font-cinzel mb-2 flex items-center justify-center gap-2">
          <Sparkles className="h-3 w-3" /> Tournament Complete <Sparkles className="h-3 w-3" />
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-white font-cinzel">Winners Lineup</h2>
      </div>

      <div className="relative flex items-end justify-center gap-3 sm:gap-8 max-w-3xl mx-auto">
        {runnerUp && <PodiumSpot team={runnerUp} place={2} />}
        <PodiumSpot team={champion} place={1} />
        {semifinalist && <PodiumSpot team={semifinalist} place={3} />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SQUADS PANEL
// ─────────────────────────────────────────────────────────────
function SquadsPanel({ squads }: { squads: Squad[] }) {
  return (
    <div className="space-y-4 mb-8">
      {squads.map((s) => {
        const hasRoster = s.players.length > 0
        return (
          <div key={s.team} className="bg-black/50 border border-gold/20 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                {s.logo ? (
                  <div className="relative h-9 w-9 rounded-full overflow-hidden border border-gold/20 shrink-0">
                    <Image src={s.logo} alt={`${s.team} logo`} fill className="object-cover" />
                  </div>
                ) : (
                  <span className="h-9 w-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                    <Shield className="h-4 w-4 text-gold" />
                  </span>
                )}
                <div>
                  <h3 className="text-white font-bold font-cinzel leading-tight">{s.team}</h3>
                  {s.owner && <p className="text-gray-400 text-xs">Owner: {s.owner}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-xs flex items-center gap-1.5 justify-end">
                  <Users className="h-3 w-3" />
                  {hasRoster ? `${s.players.length} players · Capt. ${s.captain}` : "Squad to be announced"}
                </p>
                {s.purseSpent != null && s.purseRemaining != null && (
                  <p className="text-gold text-xs mt-1">
                    {s.purseSpent.toLocaleString()} spent
                    <span className="text-gray-500"> · {s.purseRemaining.toLocaleString()} left</span>
                  </p>
                )}
              </div>
            </div>
            {hasRoster ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {s.players.map((p, i) => (
                  <PlayerCard key={i} player={p} />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic">Roster not finalized yet.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PlayerCard({ player: p }: { player: { name: string; isCaptain?: boolean; image?: string; role?: string } }) {
  return (
    <div className="group flex flex-col items-center gap-2 text-center">
      <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-gold/15 bg-white/[0.03] transition-all duration-300 group-hover:border-gold/50 group-hover:-translate-y-0.5">
        {p.image ? (
          <Image
            src={p.image}
            alt={p.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gold/20 via-black/40 to-black/60">
            <span className="text-gold text-lg font-bold font-cinzel">{initials(p.name)}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
        {p.isCaptain && (
          <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-gold text-black text-[10px] font-bold font-cinzel flex items-center justify-center shadow-md">
            C
          </span>
        )}
      </div>
      <div className="w-full">
        <p className="text-gray-200 text-xs font-semibold truncate leading-tight">{p.name}</p>
        {p.role && <p className="text-gray-500 text-[10px] truncate">{p.role}</p>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TOURNAMENT STATS — MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
function TournamentStatsPanel({
  batting,
  bowling,
  fixtures,
}: {
  batting: PlayerStatRow[]
  bowling: BowlingStatRow[]
  fixtures: Fixture[]
}) {
  const [mode, setMode] = useState<"batting" | "bowling">(batting.length ? "batting" : "bowling")

  const teamScores = new Map<string, { scored: number; conceded: number; games: number }>()
  for (const f of fixtures) {
    if (f.team1Score == null || f.team2Score == null) continue
    const a = teamScores.get(f.team1) ?? { scored: 0, conceded: 0, games: 0 }
    const b = teamScores.get(f.team2) ?? { scored: 0, conceded: 0, games: 0 }
    a.scored += f.team1Score; a.conceded += f.team2Score; a.games += 1
    b.scored += f.team2Score; b.conceded += f.team1Score; b.games += 1
    teamScores.set(f.team1, a); teamScores.set(f.team2, b)
  }
  const teams = [...teamScores.entries()].sort((a, b) => b[1].scored - a[1].scored)
  const playedFixtures = fixtures.filter((f) => f.team1Score != null && f.team2Score != null)

  const topBatter = batting.length ? [...batting].sort((a, b) => b.runs - a.runs)[0] : undefined
  const topBowler = bowling.length ? [...bowling].sort((a, b) => b.wkts - a.wkts)[0] : undefined
  const highestTeamTotal = teams[0]

  return (
    <div className="space-y-6 mb-8">
      <StatsSpotlightRow topBatter={topBatter} topBowler={topBowler} highestTeamTotal={highestTeamTotal} />

      <StatsLeaderboardCard batting={batting} bowling={bowling} mode={mode} onModeChange={setMode} />
    </div>
  )
}

function hashTeamColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 62%, 42%)`
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENT: spotlight cards (top scorer / top wicket-taker /
// highest team total).
//
// FIXED: each card now shows the leader's actual photo (StatAvatar,
// backed by PlayerStatRow.img / BowlingStatRow.img) instead of just
// printing their name as plain text with no avatar at all.
// ─────────────────────────────────────────────────────────────
function StatsSpotlightRow({
  topBatter,
  topBowler,
  highestTeamTotal,
}: {
  topBatter?: PlayerStatRow
  topBowler?: BowlingStatRow
  highestTeamTotal?: [string, { scored: number; conceded: number; games: number }]
}) {
  const cards = [
    topBatter && {
      label: "Leading Run Scorer",
      name: topBatter.player,
      img: topBatter.img,
      value: `${topBatter.runs}`,
      unit: "runs",
      meta: `${topBatter.matches} matches · SR ${topBatter.sr.toFixed(1)}`,
      Icon: TrendingUp,
      accent: "from-emerald-500/15 via-black/40 to-black/60 border-emerald-500/20",
      iconColor: "text-emerald-400",
    },
    topBowler && {
      label: "Leading Wicket Taker",
      name: topBowler.player,
      img: topBowler.img,
      value: `${topBowler.wkts}`,
      unit: "wickets",
      meta: `Best ${topBowler.best} · Econ ${topBowler.econ.toFixed(2)}`,
      Icon: Target,
      accent: "from-sky-500/15 via-black/40 to-black/60 border-sky-500/20",
      iconColor: "text-sky-400",
    },
    highestTeamTotal && {
      label: "Highest Team Total",
      name: highestTeamTotal[0],
      img: undefined,
      value: `${highestTeamTotal[1].scored.toLocaleString()}`,
      unit: "runs",
      meta: `${highestTeamTotal[1].games} matches played`,
      Icon: Trophy,
      accent: "from-gold/15 via-black/40 to-black/60 border-gold/25",
      iconColor: "text-gold",
    },
  ].filter(Boolean) as {
    label: string
    name: string
    img?: string
    value: string
    unit: string
    meta: string
    Icon: React.ComponentType<{ className?: string }>
    accent: string
    iconColor: string
  }[]

  if (cards.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`relative overflow-hidden rounded-lg border bg-gradient-to-br p-5 transition-all duration-300 hover:-translate-y-0.5 ${c.accent}`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-[10px] font-cinzel uppercase tracking-widest">{c.label}</span>
            <c.Icon className={`h-4 w-4 ${c.iconColor}`} />
          </div>
          <div className="flex items-center gap-3 mb-1">
            <StatAvatar name={c.name} img={c.img} size="md" />
            <p className="text-white font-bold font-cinzel text-lg leading-tight truncate">{c.name}</p>
          </div>
          <p className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-cinzel text-white">{c.value}</span>
            <span className="text-gray-400 text-xs">{c.unit}</span>
          </p>
          <p className="text-gray-500 text-[11px] mt-1.5">{c.meta}</p>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENT: ranked batting/bowling leaderboard with the toggle.
//
// FIXED: rows previously rendered a hardcoded initials circle
// regardless of whether a real photo was available. They now use
// StatAvatar, which shows r.img when present and only falls back to
// initials when there's no photo (or it fails to load).
// ─────────────────────────────────────────────────────────────
function StatsLeaderboardCard({
  batting,
  bowling,
  mode,
  onModeChange,
}: {
  batting: PlayerStatRow[]
  bowling: BowlingStatRow[]
  mode: "batting" | "bowling"
  onModeChange: (mode: "batting" | "bowling") => void
}) {
  const rows =
    mode === "batting"
      ? [...batting].sort((a, b) => b.runs - a.runs)
      : [...bowling].sort((a, b) => b.wkts - a.wkts)

  const rankStyle = (i: number) => {
    if (i === 0) return { ring: "border-gold/40 bg-gold/[0.05]", badge: "bg-gold text-black", Icon: Crown }
    if (i === 1) return { ring: "border-gray-300/25 bg-white/[0.02]", badge: "bg-gray-300 text-black", Icon: Medal }
    if (i === 2) return { ring: "border-amber-700/30 bg-white/[0.02]", badge: "bg-amber-700 text-white", Icon: Medal }
    return { ring: "border-gold/10 bg-white/[0.02]", badge: "bg-gold/10 text-gold", Icon: null as any }
  }

  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <h2 className="text-2xl font-bold text-white font-cinzel flex items-center gap-2">
          <Award className="h-5 w-5 text-gold" />
          TOURNAMENT LEADERBOARD
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {batting.length > 0 && (
            <button
              onClick={() => onModeChange("batting")}
              className={`text-xs font-cinzel uppercase tracking-wide px-3 py-1.5 rounded-md border transition-colors flex items-center gap-1.5 ${
                mode === "batting" ? "bg-gold text-black border-gold" : "border-gold/20 text-gray-300 hover:border-gold/50"
              }`}
            >
              <TrendingUp className="h-3 w-3" /> Batting
            </button>
          )}
          {bowling.length > 0 && (
            <button
              onClick={() => onModeChange("bowling")}
              className={`text-xs font-cinzel uppercase tracking-wide px-3 py-1.5 rounded-md border transition-colors flex items-center gap-1.5 ${
                mode === "bowling" ? "bg-gold text-black border-gold" : "border-gold/20 text-gray-300 hover:border-gold/50"
              }`}
            >
              <Target className="h-3 w-3" /> Bowling
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => {
          const { ring, badge, Icon } = rankStyle(i)
          const value = mode === "batting" ? (r as PlayerStatRow).runs : (r as BowlingStatRow).wkts
          return (
            <div
              key={r.player}
              className={`group flex items-center justify-between border rounded-md p-3 transition-all duration-300 hover:border-gold/50 hover:-translate-y-0.5 ${ring}`}
            >
              <div className="flex items-center gap-3">
                <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold font-cinzel shrink-0 ${badge}`}>
                  {Icon ? <Icon className="h-3 w-3" /> : i + 1}
                </span>
                <StatAvatar name={r.player} img={r.img} size="sm" />
                <div>
                  <p className="text-white text-sm font-semibold">{r.player}</p>
                  <p className="text-gray-400 text-xs">
                    {r.matches} matches · {r.inns} innings
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gold font-bold font-cinzel text-lg leading-none">{value}</p>
                <p className="text-gray-400 text-xs mt-1">{mode === "batting" ? "runs" : "wickets"}</p>
              </div>
            </div>
          )
        })}
        {rows.length === 0 && (
          <p className="text-gray-500 text-sm italic text-center py-6">No {mode} stats recorded yet.</p>
        )}
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────
// LEADERBOARD PANEL (legacy, run/wicket LeaderboardRow shape)
// ─────────────────────────────────────────────────────────────
function LeaderboardPanel({ runs, wickets }: { runs: LeaderboardRow[]; wickets: LeaderboardRow[] }) {
  const [tab, setTab] = useState<"runs" | "wickets">(runs.length ? "runs" : "wickets")
  const active = tab === "runs" ? runs : wickets

  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-8">
      <h2 className="text-2xl font-bold text-white mb-4 font-cinzel">TOURNAMENT LEADERBOARD</h2>
      <div className="flex gap-2 mb-6">
        {runs.length > 0 && (
          <button
            onClick={() => setTab("runs")}
            className={`font-cinzel text-xs uppercase tracking-wide px-4 py-2 rounded-md border transition-all ${
              tab === "runs" ? "bg-gold text-black border-gold" : "border-gold/20 text-gray-300 hover:border-gold/50"
            }`}
          >
            Most Runs
          </button>
        )}
        {wickets.length > 0 && (
          <button
            onClick={() => setTab("wickets")}
            className={`font-cinzel text-xs uppercase tracking-wide px-4 py-2 rounded-md border transition-all ${
              tab === "wickets" ? "bg-gold text-black border-gold" : "border-gold/20 text-gray-300 hover:border-gold/50"
            }`}
          >
            Most Wickets
          </button>
        )}
      </div>
      <div className="space-y-2.5">
        {active.map((row) => (
          <div key={row.player} className="flex items-center justify-between border border-gold/10 rounded-md p-3 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <span className="text-gold font-bold font-cinzel w-5 text-center">{row.rank}</span>
              <span className="h-8 w-8 rounded-full bg-gold/20 text-gold text-[10px] font-bold flex items-center justify-center font-cinzel">
                {row.img && <Image src={row.img} alt={row.player} width={32} height={32} className="rounded-full object-cover" />}
              </span>
              <div>
                <p className="text-white text-sm font-semibold">{row.player}</p>
                <p className="text-gray-400 text-xs">{row.team}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-gold font-bold font-cinzel text-lg leading-none">{row.value}</p>
              <p className="text-gray-400 text-xs mt-1">{row.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// AWARDS GRID
// ─────────────────────────────────────────────────────────────
const PUBLIC_PRIZE_CATEGORY_META: Record<
  NonNullable<AwardEntry["prizeCategory"]>,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }
> = {
  cash: {
    label: "Cash Prize",
    icon: DollarSign,
    color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  },
  physical: {
    label: "Physical Item",
    icon: Gift,
    color: "bg-violet-500/10 border-violet-500/30 text-violet-300",
  },
  badge: {
    label: "Badge",
    icon: BadgeCheck,
    color: "bg-sky-500/10 border-sky-500/30 text-sky-300",
  },
  experience: {
    label: "Experience",
    icon: Sparkles,
    color: "bg-rose-500/10 border-rose-500/30 text-rose-300",
  },
};

function AwardsGrid({ awards }: { awards: AwardEntry[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {awards.map((a, i) => {
        const categoryMeta = a.prizeCategory ? PUBLIC_PRIZE_CATEGORY_META[a.prizeCategory] : undefined
        const CategoryIcon = categoryMeta?.icon

        return (
          <div
            key={`${a.label}-${i}`}
            className="border border-gold/10 rounded-md p-4 bg-white/[0.02] flex flex-col items-center text-center"
          >
            {a.imageUrl && (
              <img
                src={a.imageUrl}
                alt={a.label}
                className="w-16 h-16 rounded-lg object-cover mb-3"
              />
            )}

            <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1.5">{a.label}</p>
            <p className="text-white font-bold font-cinzel mb-1">{a.name}</p>
            {a.note && <p className="text-gray-400 text-xs mb-3">{a.note}</p>}

            <div className="flex flex-wrap gap-1.5 justify-center mt-auto">
              {a.awardType && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-gold text-[10px] font-medium">
                  {a.awardType === "team" ? "Team" : "Individual"}
                </span>
              )}
              {categoryMeta && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${categoryMeta.color}`}
                >
                  {CategoryIcon && <CategoryIcon className="h-3 w-3" />}
                  {categoryMeta.label}
                </span>
              )}
              {a.prizeValue && (
                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300 text-[10px] font-medium">
                  {a.prizeValue}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}