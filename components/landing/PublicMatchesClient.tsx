"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { CalendarDays, MapPin, Radio, Search, Trophy, Clock3, Lock, Thermometer, Tv, Handshake, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SiteHeader } from "@/components/landing/site-header"
import { TypeText } from "@/components/landing/type-text"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { pageStyles } from "@/data/site-data"
import { supabase } from "@/lib/supabase"
import {
  getPublicMatchesPage,
  getPublicMatchesOverview,
  getPublicMatchesCounts,
  getTournamentOptions,
  getFriendlyMatchCount,
  formatBracketStage,
  type PublicMatch,
  type MatchStatusFilter,
  type MatchTypeFilter,
  type MatchCounts,
} from "@/lib/public-data"

const filters = ["all", "upcoming", "live", "completed"] as const
type Filter = (typeof filters)[number]

const FRIENDLY_VALUE = "__friendly__"
const PAGE_SIZE = 12
const SEARCH_DEBOUNCE_MS = 350
// Kept only as a fallback safety net for if the realtime channel below
// ever drops (network hiccup, tab backgrounded long enough to be
// throttled, etc.) — the primary sync mechanism is now the Supabase
// Realtime subscription in the "live sync" effect further down, not
// this timer. Widened from the old 30s poll-only value since realtime
// carries the normal case now.
const LIVE_SYNC_FALLBACK_MS = 45_000

const filterMeta: Record<Filter, { label: string; dot?: string }> = {
  all: { label: "All" },
  upcoming: { label: "Upcoming", dot: "bg-blue-400" },
  live: { label: "Live", dot: "bg-gold" },
  completed: { label: "Completed", dot: "bg-emerald-400" },
}

const sectionMeta: { status: "live" | "upcoming" | "completed"; label: string; dot: string }[] = [
  { status: "live", label: "Live Now", dot: "bg-gold" },
  { status: "upcoming", label: "Upcoming", dot: "bg-blue-400" },
  { status: "completed", label: "Completed", dot: "bg-emerald-400" },
]

/** HSL -> hex, so the fallback color is compatible with the "+80 alpha
 *  suffix" trick used in the card gradients (that trick only works on
 *  hex strings — appending "80" to an hsl(...) string is invalid CSS
 *  and silently drops the whole gradient, which is why friendly-match
 *  cards previously lost their color: they always hit this fallback,
 *  while bracket matches almost always have a real hex color from teams.color). */
function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100
  const lNorm = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sNorm * Math.min(lNorm, 1 - lNorm)
  const f = (n: number) => lNorm - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, "0")
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
}

function hashTeamColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return hslToHex(hue, 62, 42)
}

function isValidFilter(value: string | null): value is Filter {
  return !!value && (filters as readonly string[]).includes(value)
}

function isFriendly(match: PublicMatch) {
  return !match.tournamentId
}

type Schedule = { full: string; relative: string | null }

function formatSchedule(iso: string | null): Schedule | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null

  const full = date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

  const diffMs = date.getTime() - Date.now()
  const diffMin = Math.round(diffMs / 60_000)
  let relative: string | null = null

  if (diffMin > -1 && diffMin < 1) {
    relative = "starting now"
  } else if (diffMs > 0) {
    if (diffMin < 60) relative = `in ${diffMin}m`
    else if (diffMin < 60 * 24) relative = `in ${Math.round(diffMin / 60)}h`
    else relative = `in ${Math.round(diffMin / (60 * 24))}d`
  } else {
    const pastMin = Math.abs(diffMin)
    if (pastMin < 60) relative = `${pastMin}m ago`
    else if (pastMin < 60 * 24) relative = `${Math.round(pastMin / 60)}h ago`
  }

  return { full, relative }
}

/** Debounces a value, and exposes a flush() to apply the pending value
 *  immediately — used so the Search button (and Enter key) can jump the
 *  debounce instead of waiting out the delay. */
function useDebouncedValue<T>(value: T, delay: number): [T, () => void] {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return [debounced, () => setDebounced(value)]
}

const EMPTY_COUNTS: MatchCounts = { all: 0, upcoming: 0, live: 0, completed: 0 }

export default function PublicMatchesClient() {
  useScrollTop()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [filter, setFilter] = useState<Filter>(() => {
    const s = searchParams.get("status")
    return isValidFilter(s) ? s : "all"
  })
  const [tournament, setTournament] = useState<string>(() => searchParams.get("tournament") ?? "all")
  const [queryInput, setQueryInput] = useState(() => searchParams.get("q") ?? "")
  const [debouncedQuery, flushSearch] = useDebouncedValue(queryInput, SEARCH_DEBOUNCE_MS)
  const [isNavOpen, setIsNavOpen] = useState(false)

  // Derived server params. A specific tournamentId already scopes both
  // bracket AND friendly matches tagged to it — "friendly" type is only
  // for the explicit "standalone, no tournament at all" sentinel.
  const type: MatchTypeFilter = tournament === FRIENDLY_VALUE ? "friendly" : "all"
  const tournamentId = tournament !== "all" && tournament !== FRIENDLY_VALUE ? tournament : null

  // Keep the URL in sync so the current view is shareable/bookmarkable.
  useEffect(() => {
    const params = new URLSearchParams()
    if (filter !== "all") params.set("status", filter)
    if (tournament !== "all") params.set("tournament", tournament)
    if (queryInput) params.set("q", queryInput)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, tournament, queryInput, pathname])

  // Static-ish reference data — fetched once, independent of filters.
  const [tournamentOptions, setTournamentOptions] = useState<{ id: string; name: string }[]>([])
  const [friendlyTotal, setFriendlyTotal] = useState(0)
  useEffect(() => {
    getTournamentOptions().then(setTournamentOptions)
    getFriendlyMatchCount().then(setFriendlyTotal)
  }, [])
  const hasFriendlies = friendlyTotal > 0
  const hasScopeControl = tournamentOptions.length > 0 || hasFriendlies

  // Status-pill counts — refetched whenever tournament/type/search change,
  // independent of which status tab is active. Also refreshed by the
  // realtime sync effect below whenever a match's status actually changes.
  const [counts, setCounts] = useState<MatchCounts>(EMPTY_COUNTS)
  useEffect(() => {
    let cancelled = false
    getPublicMatchesCounts({ tournamentId, type, search: debouncedQuery }).then((c) => {
      if (!cancelled) setCounts(c)
    })
    return () => {
      cancelled = true
    }
  }, [tournamentId, type, debouncedQuery])

  // "All" view state: bounded live/upcoming + paginated completed.
  const [overview, setOverview] = useState<{ live: PublicMatch[]; upcoming: PublicMatch[]; completed: PublicMatch[] }>({
    live: [],
    upcoming: [],
    completed: [],
  })
  const [completedPage, setCompletedPage] = useState(0)
  const [completedHasMore, setCompletedHasMore] = useState(false)

  // Single-status view state (filter !== "all"), fully paginated.
  const [singleList, setSingleList] = useState<PublicMatch[]>([])
  const [singlePage, setSinglePage] = useState(0)
  const [singleHasMore, setSingleHasMore] = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Main fetch — resets to page 0 whenever the active filter combo changes.
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setCompletedPage(0)
    setSinglePage(0)

    if (filter === "all") {
      getPublicMatchesOverview({ tournamentId, type, search: debouncedQuery, completedPage: 0, pageSize: PAGE_SIZE }).then(
        (res) => {
          if (cancelled) return
          setOverview({ live: res.live, upcoming: res.upcoming, completed: res.completed })
          setCompletedHasMore(res.completedHasMore)
          setIsLoading(false)
        },
      )
    } else {
      getPublicMatchesPage({
        status: filter as MatchStatusFilter,
        tournamentId,
        type,
        search: debouncedQuery,
        page: 0,
        pageSize: PAGE_SIZE,
      }).then((res) => {
        if (cancelled) return
        setSingleList(res.matches)
        setSingleHasMore(res.hasMore)
        setIsLoading(false)
      })
    }

    return () => {
      cancelled = true
    }
  }, [filter, tournamentId, type, debouncedQuery])

  // ── Realtime sync ─────────────────────────────────────────────────
  // CHANGED — previously this only re-polled on a fixed 30s interval,
  // and only ever refreshed the "live" bucket (a match transitioning
  // from upcoming -> live wouldn't move sections, or update the pill
  // counts, until the next tick — see the "still shows upcoming, not
  // live" report this was written to fix). That's replaced with a
  // Supabase Realtime subscription: the match simulator writes to
  // `matches` (match_setup.status/scoreA/scoreB, throttled to over
  // boundaries and wickets) and to `bracket_matches`
  // (status/score_a/score_b) as a match progresses, so listening for
  // UPDATE events on both tables and re-running the same fetches used
  // elsewhere on this page gets the UI in sync within roughly a second
  // of the write actually committing, rather than up to 30s later.
  //
  // The payload on a postgres_changes event is just the raw changed
  // row — not the joined/derived PublicMatch shape this page needs
  // (team names, tournament info, resolved status) — so this doesn't
  // try to patch state from the event directly. It uses the event only
  // as a "something changed, go refetch" signal, debounced slightly so
  // a burst of per-over writes during a live simulation collapses into
  // one refetch instead of one per event.
  //
  // NOTE: for this to actually receive events, Realtime replication
  // must be enabled for the `matches` and `bracket_matches` tables in
  // the Supabase dashboard (Database → Replication), and the anon/public
  // role's RLS SELECT policy on those tables must allow reading the
  // rows in question — Supabase's realtime server checks that policy
  // before delivering a change event, independent of whatever the
  // REST refetch below is separately allowed to see.
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const refreshLiveAndCounts = async () => {
      const [liveRes, upcomingRes, countsRes] = await Promise.all([
        getPublicMatchesPage({ status: "live", tournamentId, type, search: debouncedQuery, page: 0, pageSize: 50 }),
        getPublicMatchesPage({ status: "upcoming", tournamentId, type, search: debouncedQuery, page: 0, pageSize: 50 }),
        getPublicMatchesCounts({ tournamentId, type, search: debouncedQuery }),
      ])

      setCounts(countsRes)

      if (filter === "all") {
        setOverview((prev) => ({ ...prev, live: liveRes.matches, upcoming: upcomingRes.matches }))
      } else if (filter === "live") {
        const liveById = new Map(liveRes.matches.map((m) => [m.id, m]))
        setSingleList((prev) => prev.filter((m) => liveById.has(m.id)).map((m) => liveById.get(m.id) ?? m))
      } else if (filter === "upcoming") {
        const upcomingById = new Set(upcomingRes.matches.map((m) => m.id))
        setSingleList((prev) => prev.filter((m) => upcomingById.has(m.id)))
      }
    }

    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(refreshLiveAndCounts, 800)
    }

    const channel = supabase
      .channel(`public-matches-sync-${tournamentId ?? "all"}-${type}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches" }, scheduleRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bracket_matches" }, scheduleRefresh)
      .subscribe()

    // Fallback poll — only matters if the realtime channel above is
    // silently disconnected (e.g. Supabase project paused, network
    // issue). Under normal operation the channel keeps things in sync
    // well before this timer would ever fire.
    const fallbackInterval = setInterval(refreshLiveAndCounts, LIVE_SYNC_FALLBACK_MS)

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      clearInterval(fallbackInterval)
      supabase.removeChannel(channel)
    }
  }, [filter, tournamentId, type, debouncedQuery])

  const loadMoreCompleted = async () => {
    setIsLoadingMore(true)
    const nextPage = completedPage + 1
    const res = await getPublicMatchesPage({
      status: "completed",
      tournamentId,
      type,
      search: debouncedQuery,
      page: nextPage,
      pageSize: PAGE_SIZE,
    })
    setOverview((prev) => ({ ...prev, completed: [...prev.completed, ...res.matches] }))
    setCompletedPage(nextPage)
    setCompletedHasMore(res.hasMore)
    setIsLoadingMore(false)
  }

  const loadMoreSingle = async () => {
    setIsLoadingMore(true)
    const nextPage = singlePage + 1
    const res = await getPublicMatchesPage({
      status: filter as MatchStatusFilter,
      tournamentId,
      type,
      search: debouncedQuery,
      page: nextPage,
      pageSize: PAGE_SIZE,
    })
    setSingleList((prev) => [...prev, ...res.matches])
    setSinglePage(nextPage)
    setSingleHasMore(res.hasMore)
    setIsLoadingMore(false)
  }

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }
  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  const grouped = useMemo(
    () => ({ live: overview.live, upcoming: overview.upcoming, completed: overview.completed }),
    [overview],
  )

  const hasAnyResults = filter === "all" ? grouped.live.length + grouped.upcoming.length + grouped.completed.length > 0 : singleList.length > 0
  const totalShown = filter === "all" ? grouped.live.length + grouped.upcoming.length + grouped.completed.length : singleList.length

  // Label shown on the Select trigger. react-select derives this from
  // SelectValue's children matching the current value automatically,
  // but since our options list is built dynamically (tournaments +
  // an optional friendly entry) we compute it explicitly so the
  // trigger never flashes an empty state while options are loading.
  const scopeLabel =
    tournament === "all"
      ? "All Tournaments"
      : tournament === FRIENDLY_VALUE
        ? `Friendly Matches (${friendlyTotal})`
        : tournamentOptions.find((t) => t.id === tournament)?.name ?? "All Tournaments"

  return (
    <main className="overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      <SiteHeader
        activeSection="matches"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      {/* HERO */}
      <section className="pt-24 pb-8 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto grid grid-cols-3 gap-3 mb-6 fade-in-up stagger-1">
            <StatTile label="Fixtures" value={counts.all} icon={<CalendarDays className="h-4 w-4 text-gold" />} />
            <StatTile
              label="Live Now"
              value={counts.live}
              icon={<Radio className="h-4 w-4 text-gold" />}
              live={counts.live > 0}
            />
            <StatTile label="Completed" value={counts.completed} icon={<Trophy className="h-4 w-4 text-gold" />} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto fade-in-up stagger-2">
            <Input
              type="text"
              placeholder="Search teams or venues..."
              className="bg-black/50 border-gold/30 text-white"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && flushSearch()}
            />
            <Button onClick={flushSearch} className="bg-gold hover:bg-gold/90 text-black font-bold shrink-0">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>

          {/* FILTER BAR — grouped into a single bordered pill so "scope"
              (tournament / friendly) and "status" (all/upcoming/live/
              completed) read as one coherent control instead of loose
              floating buttons. Each cluster gets a small uppercase label
              on larger screens; on mobile the labels hide and the pills
              wrap naturally. */}
          <div className="flex justify-center mt-4 fade-in-up stagger-3">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-2xl sm:rounded-full border border-gold/15 bg-black/40 px-4 py-2.5">
              {hasScopeControl && (
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline text-[10px] font-cinzel uppercase tracking-widest text-gray-500">
                    Scope
                  </span>
                  <Select value={tournament} onValueChange={setTournament}>
                    <SelectTrigger className="h-8 w-auto min-w-[9.5rem] gap-1.5 rounded-full border-gold/30 bg-black/50 px-3 text-xs font-cinzel uppercase tracking-widest text-white focus:ring-1 focus:ring-gold/40 focus:ring-offset-0">
                      <SelectValue placeholder="All Tournaments">{scopeLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="border-gold/30 bg-black text-white">
                      <SelectItem value="all" className="text-xs font-cinzel uppercase tracking-widest focus:bg-gold/10 focus:text-white">
                        All Tournaments
                      </SelectItem>
                      {tournamentOptions.map((t) => (
                        <SelectItem
                          key={t.id}
                          value={t.id}
                          className="text-xs font-cinzel uppercase tracking-widest focus:bg-gold/10 focus:text-white"
                        >
                          {t.name}
                        </SelectItem>
                      ))}
                      {hasFriendlies && (
                        <SelectItem
                          value={FRIENDLY_VALUE}
                          className="text-xs font-cinzel uppercase tracking-widest text-blue-300 focus:bg-blue-400/10 focus:text-blue-200"
                        >
                          <span className="flex items-center gap-1.5">
                            <Handshake className="h-3 w-3" />
                            Friendly Matches ({friendlyTotal})
                          </span>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {hasScopeControl && <span className="hidden sm:block h-4 w-px bg-gold/20" />}

              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-[10px] font-cinzel uppercase tracking-widest text-gray-500">
                  Status
                </span>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {filters.map((item) => {
                    const meta = filterMeta[item]
                    const active = filter === item
                    return (
                      <button
                        key={item}
                        onClick={() => setFilter(item)}
                        className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-cinzel uppercase tracking-widest transition-colors ${
                          active
                            ? "border-gold bg-gold font-bold text-black"
                            : "border-gold/20 text-gray-400 hover:border-gold/50 hover:text-white"
                        }`}
                      >
                        {meta.dot && (
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${item === "live" ? "animate-pulse" : ""}`}
                          />
                        )}
                        {meta.label}
                        <span className={active ? "opacity-70" : "opacity-50"}>({counts[item]})</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FIXTURES */}
      <section className="pb-20 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 max-w-8xl">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
            </div>
          ) : !hasAnyResults ? (
            <EmptyState query={debouncedQuery} filter={filter} />
          ) : filter === "all" ? (
            <div className="space-y-12">
              {sectionMeta.map(({ status, label, dot }) => {
                const list = grouped[status]
                if (list.length === 0) return null
                return (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-5">
                      <span className={`h-2 w-2 rounded-full ${dot} ${status === "live" ? "animate-pulse" : ""}`} />
                      <h2 className="font-cinzel text-sm uppercase tracking-[0.2em] text-white font-bold">{label}</h2>
                      <span className="text-xs text-gray-500 font-mono">({list.length})</span>
                      <div className="flex-1 h-px bg-gold/10 ml-2" />
                    </div>

                    {/* Tournament and friendly matches sit together here — the badge
                        on each card (stage vs "Friendly") is the only thing that
                        tells them apart. */}
                    <MatchGrid list={list} />

                    {status === "completed" && completedHasMore && (
                      <LoadMoreButton onClick={loadMoreCompleted} loading={isLoadingMore} />
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <>
              <MatchGrid list={singleList} />
              {singleHasMore && <LoadMoreButton onClick={loadMoreSingle} loading={isLoadingMore} />}
            </>
          )}

          {!isLoading && hasAnyResults && (
            <p className="pt-14 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
              Showing {totalShown} of {counts[filter]} fixtures
            </p>
          )}
        </div>
      </section>
    </main>
  )
}

function MatchGrid({ list }: { list: PublicMatch[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {list.map((match) => (
        <MatchCard key={match.id} match={match} />
      ))}
    </div>
  )
}

function LoadMoreButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <div className="flex justify-center mt-6">
      <Button
        onClick={onClick}
        disabled={loading}
        variant="outline"
        className="border-gold/30 text-gold hover:bg-gold/10 hover:text-gold font-cinzel text-xs uppercase tracking-widest"
      >
        {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
        {loading ? "Loading..." : "Load more"}
      </Button>
    </div>
  )
}

function StatTile({
  label,
  value,
  icon,
  live,
}: {
  label: string
  value: number
  icon: React.ReactNode
  live?: boolean
}) {
  return (
    <div
      className={`relative rounded-lg border p-4 text-center overflow-hidden ${
        live ? "border-gold/50 bg-gold/[0.06] shadow-[0_0_15px_rgba(245,166,35,0.12)]" : "border-gold/20 bg-black/50"
      }`}
    >
      {live && <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />}
      <div className="flex items-center justify-center gap-1.5 mb-1.5">
        {icon}
        {live && <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />}
      </div>
      <p className="font-cinzel text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
    </div>
  )
}

function MatchCard({ match }: { match: PublicMatch }) {
  const live = match.status === "live"
  const completed = match.status === "completed"
  const upcoming = match.status === "upcoming"
  const clickable = !!match.matchId
  const friendly = isFriendly(match)

  const aWon = match.scoreA != null && match.scoreB != null && match.scoreA > match.scoreB
  const bWon = match.scoreA != null && match.scoreB != null && match.scoreB > match.scoreA

  const teamAColor = match.teamAColor || hashTeamColor(match.teamA)
  const teamBColor = match.teamBColor || hashTeamColor(match.teamB)

  const stageLabel = formatBracketStage(match.bracketType, match.round)
  const schedule = formatSchedule(match.scheduledAt)

  const card = (
    <div
      className={`group relative rounded-xl border overflow-hidden h-full flex flex-col transition-all duration-300 ${
        live
          ? "border-gold/60 shadow-[0_0_25px_-8px_rgba(245,166,35,0.4)]"
          : completed
            ? "border-gold/10 opacity-80"
            : friendly
              ? "border-blue-400/20"
              : "border-gold/10"
      } ${
        clickable
          ? "hover:border-gold/50 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]"
          : ""
      }`}
    >
      <div className="relative h-32 bg-black/60">
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(0 0, 58% 0, 42% 100%, 0 100%)",
            background: `linear-gradient(135deg, ${teamAColor}80, rgba(0,0,0,0.92))`,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(58% 0, 100% 0, 100% 100%, 42% 100%)",
            background: `linear-gradient(225deg, ${teamBColor}80, rgba(0,0,0,0.92))`,
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ clipPath: "polygon(57% 0, 60% 0, 44% 100%, 41% 100%)", background: "rgba(255,255,255,0.08)" }}
        />

        {friendly ? (
          <span className="absolute top-2 left-2 z-20 flex items-center gap-1 text-blue-200 text-[10px] font-cinzel uppercase tracking-widest bg-blue-500/20 border border-blue-400/40 rounded-full px-2.5 py-0.5">
            <Handshake className="h-2.5 w-2.5" />
            Friendly
          </span>
        ) : (
          <span className="absolute top-2 left-2 z-20 text-white/90 text-[10px] font-cinzel uppercase tracking-widest bg-black/50 border border-white/10 rounded-full px-2.5 py-0.5">
            {stageLabel}
          </span>
        )}
        <StatusPill status={match.status} />

        <TeamCrest side="left" name={match.teamA} code={match.teamACode} color={teamAColor} logo={match.teamALogo} won={aWon} />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <span className="h-8 w-8 rounded-full border border-gold/40 bg-black/70 flex items-center justify-center text-gold font-cinzel text-[10px] font-bold">
            VS
          </span>
        </div>
        <TeamCrest side="right" name={match.teamB} code={match.teamBCode} color={teamBColor} logo={match.teamBLogo} won={bWon} />
      </div>

      <div className="bg-black/50 p-4 flex-1 flex flex-col">
        {live && match.live ? (
          <div className="flex flex-col items-center gap-1 mb-2">
            <p className="font-cinzel text-2xl font-bold text-gold tabular-nums text-center">
              {match.live.runs}/{match.live.wkts}
              <span className="ml-2 text-sm font-normal text-white/60">({match.live.overs} ov)</span>
            </p>
            {match.live.battingTeam && (
              <p className="text-[10px] uppercase tracking-widest text-white/40">{match.live.battingTeam} batting</p>
            )}
          </div>
        ) : completed ? (
          <p className="font-cinzel text-xl font-bold text-white tabular-nums text-center mb-2">
            {match.scoreA ?? "—"}
            <span className="px-2 text-gray-600">–</span>
            {match.scoreB ?? "—"}
          </p>
        ) : (
          <div className="flex flex-col items-center gap-1 mb-2 py-1">
            {schedule ? (
              <>
                <p className="font-cinzel text-base font-bold text-white text-center leading-tight">{schedule.full}</p>
                {schedule.relative && (
                  <span className="text-[10px] uppercase tracking-widest text-gold/70">{schedule.relative}</span>
                )}
              </>
            ) : (
              <p className="text-center text-xs text-gray-500">Schedule TBA</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <MapPin className="size-3 text-gold/60" />
            {match.venue || "Venue TBA"}
          </span>
          {!upcoming && (
            <span className="flex items-center gap-1">
              <Clock3 className="size-3 text-gold/60" />
              {schedule ? schedule.full : "Schedule TBA"}
            </span>
          )}
          {live && match.weather?.condition && (
            <span className="flex items-center gap-1">
              <Thermometer className="size-3 text-gold/60" />
              {match.weather.tempC != null ? `${match.weather.tempC}°C, ` : ""}
              {match.weather.condition}
            </span>
          )}
        </div>

        {live && match.channels.length > 0 && (
          <div className="mt-2 flex items-center justify-center gap-1.5 flex-wrap">
            <Tv className="size-3 text-gold/50" />
            {match.channels.map((c) => (
              <span key={c} className="text-[9px] uppercase tracking-wider text-gold/80 border border-gold/30 rounded-full px-2 py-0.5">
                {c}
              </span>
            ))}
          </div>
        )}

        {clickable && (
          <p className="mt-auto pt-3 text-gold/70 text-[10px] uppercase tracking-widest font-cinzel text-center flex items-center justify-center gap-1 transition-transform duration-300 group-hover:gap-1.5">
            View match <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
          </p>
        )}
      </div>
    </div>
  )

  return clickable ? (
    <Link href={`/match/${match.matchId}`} className="block h-full">
      {card}
    </Link>
  ) : (
    card
  )
}

function StatusPill({ status }: { status: PublicMatch["status"] }) {
  if (status === "live") {
    return (
      <span className="absolute top-2 right-2 z-20 flex items-center gap-1.5 bg-gold text-black text-[10px] font-bold font-cinzel px-2.5 py-1 rounded-full shadow-[0_0_10px_rgba(245,166,35,0.5)]">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black/40" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-black" />
        </span>
        LIVE
      </span>
    )
  }
  if (status === "completed") {
    return (
      <span className="absolute top-2 right-2 z-20 text-white text-[10px] font-bold font-cinzel px-2.5 py-1 rounded-full bg-gray-700">
        Completed
      </span>
    )
  }
  return (
    <span className="absolute top-2 right-2 z-20 text-gold text-[10px] font-bold font-cinzel px-2.5 py-1 rounded-full bg-gold/15 border border-gold/30">
      Upcoming
    </span>
  )
}

function TeamCrest({
  side,
  name,
  code,
  color,
  logo,
  won,
}: {
  side: "left" | "right"
  name: string
  code: string | null
  color: string
  logo: string | null
  won: boolean
}) {
  const label = (code || name || "?").slice(0, 3).toUpperCase()
  const position = side === "left" ? "left-[16%]" : "left-[84%]"

  return (
    <div className={`absolute ${position} top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1.5`}>
      {logo ? (
        <div
          className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-full overflow-hidden border-2 ring-1 ring-black/40 bg-black/40"
          style={{ borderColor: color }}
        >
          <Image src={logo} alt={`${name} logo`} fill sizes="64px" className="object-cover" />
        </div>
      ) : (
        <div
          className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-black/40 border-2 flex items-center justify-center"
          style={{ borderColor: color }}
        >
          <span className="text-white text-[11px] font-bold font-cinzel">{label}</span>
        </div>
      )}
      <span
        className={`text-[11px] font-semibold font-cinzel text-center leading-tight max-w-[80px] truncate ${
          won ? "text-white" : "text-gray-300"
        }`}
      >
        {name}
      </span>
    </div>
  )
}

function EmptyState({ query, filter }: { query: string; filter: Filter }) {
  const detail = query
    ? `No results for "${query}"${filter !== "all" ? ` in ${filterMeta[filter].label.toLowerCase()} matches` : ""}.`
    : filter !== "all"
      ? `No ${filterMeta[filter].label.toLowerCase()} matches right now.`
      : "Try another search or match status."

  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-10 mb-8 flex flex-col items-center text-center gap-3 fade-in">
      <div className="h-12 w-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center relative">
        <CalendarDays className="h-5 w-5 text-gold/50" />
        <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-black border border-gold/30 flex items-center justify-center">
          <Lock className="h-2.5 w-2.5 text-gold" />
        </span>
      </div>
      <h2 className="text-white font-bold font-cinzel">No matches found</h2>
      <p className="text-gray-400 text-sm max-w-sm">{detail}</p>
    </div>
  )
}

function LoadingCard() {
  return <div className="h-64 animate-pulse rounded-xl border border-gold/10 bg-black/40" />
}