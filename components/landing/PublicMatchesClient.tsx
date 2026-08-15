"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { CalendarDays, MapPin, Radio, Search, Trophy, Clock3, Lock, Thermometer, Tv, Handshake } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/landing/site-header"
import { TypeText } from "@/components/landing/type-text"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { pageStyles } from "@/data/site-data"
import { getPublicMatches, formatBracketStage, type PublicMatch } from "@/lib/public-data"

const filters = ["all", "upcoming", "live", "completed"] as const
type Filter = (typeof filters)[number]

// Sentinel used in the tournament <select> + URL to mean
// "standalone friendly matches (no tournamentId)".
const FRIENDLY_VALUE = "__friendly__"

const filterMeta: Record<Filter, { label: string; dot?: string }> = {
  all: { label: "All" },
  upcoming: { label: "Upcoming", dot: "bg-blue-400" },
  live: { label: "Live", dot: "bg-gold" },
  completed: { label: "Completed", dot: "bg-emerald-400" },
}

// Section order + labels for the grouped "all" view — live first so
// nothing in progress gets missed, then what's coming up, then results.
const sectionMeta: { status: "live" | "upcoming" | "completed"; label: string; dot: string }[] = [
  { status: "live", label: "Live Now", dot: "bg-gold" },
  { status: "upcoming", label: "Upcoming", dot: "bg-blue-400" },
  { status: "completed", label: "Completed", dot: "bg-emerald-400" },
]

/** Deterministic fallback color for teams that don't have one set,
 *  kept consistent with FixtureCard's hashing elsewhere in the app. */
function hashTeamColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 62%, 42%)`
}

function isValidFilter(value: string | null): value is Filter {
  return !!value && (filters as readonly string[]).includes(value)
}

function isFriendly(match: PublicMatch) {
  return !match.tournamentId
}

/** Splits a list into tournament vs friendly matches, for sub-grouping
 *  inside a status section so the two types don't get interleaved. */
function splitByType(list: PublicMatch[]) {
  const tournamentList = list.filter((m) => !isFriendly(m))
  const friendlyList = list.filter(isFriendly)
  return { tournamentList, friendlyList }
}

// ─────────────────────────────────────────────────────────────
// Schedule formatting — full readable date/time plus a relative
// countdown ("in 2h", "in 3d") for upcoming matches, or "Xh ago"
// for very recently completed/started ones.
// ─────────────────────────────────────────────────────────────
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
    // Older than a day ago — skip the relative tag, the full date is enough.
  }

  return { full, relative }
}

export default function PublicMatchesClient() {
  useScrollTop()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [matches, setMatches] = useState<PublicMatch[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  // Seed all filter state from the URL on first render so links like
  // /matches?status=live&tournament=xyz&q=india land on the right view.
  const [filter, setFilter] = useState<Filter>(() => {
    const s = searchParams.get("status")
    return isValidFilter(s) ? s : "all"
  })
  const [tournament, setTournament] = useState<string>(() => searchParams.get("tournament") ?? "all")
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "")
  const [isNavOpen, setIsNavOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = () => {
      getPublicMatches().then((rows) => {
        if (cancelled) return
        setMatches(rows)
        setDataLoading(false)
      })
    }

    load()

    // Light polling so live scores, weather, and channels stay fresh
    // without the person needing to refresh the page.
    const interval = setInterval(load, 30_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // Keep the URL in sync with filter/tournament/query so the current
  // view is shareable and bookmarkable. Uses replace (not push) so
  // typing in the search box doesn't spam browser history.
  useEffect(() => {
    const params = new URLSearchParams()
    if (filter !== "all") params.set("status", filter)
    if (tournament !== "all") params.set("tournament", tournament)
    if (query) params.set("q", query)
    const qs = params.toString()
    const next = qs ? `${pathname}?${qs}` : pathname
    router.replace(next, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, tournament, query, pathname])

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }
  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  // Unique tournaments derived from the loaded matches, for the filter dropdown.
  // Friendly matches (tournamentId === null) don't contribute an entry here,
  // so they get their own explicit sentinel option below instead.
  const tournaments = useMemo(() => {
    const map = new Map<string, string>()
    matches.forEach((m) => {
      if (m.tournamentId) map.set(m.tournamentId, m.tournamentName ?? m.tournamentId)
    })
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [matches])

  const friendlyCount = useMemo(() => matches.filter(isFriendly).length, [matches])
  const hasFriendlies = friendlyCount > 0

  const q = query.toLowerCase()
  const filtered = useMemo(
    () =>
      matches.filter((match) => {
        const text = `${match.teamA} ${match.teamB} ${match.venue ?? ""}`.toLowerCase()
        const matchesTournament =
          tournament === "all" ||
          (tournament === FRIENDLY_VALUE ? isFriendly(match) : match.tournamentId === tournament)
        return (
          (filter === "all" || match.status === filter) &&
          matchesTournament &&
          (!q || text.includes(q))
        )
      }),
    [filter, tournament, matches, q],
  )

  const counts = useMemo(() => {
    const base =
      tournament === "all"
        ? matches
        : tournament === FRIENDLY_VALUE
          ? matches.filter(isFriendly)
          : matches.filter((m) => m.tournamentId === tournament)
    return {
      all: base.length,
      upcoming: base.filter((m) => m.status === "upcoming").length,
      live: base.filter((m) => m.status === "live").length,
      completed: base.filter((m) => m.status === "completed").length,
    }
  }, [matches, tournament])

  const byScheduledAtAsc = (a: PublicMatch, b: PublicMatch) => {
    const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity
    const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity
    return aTime - bTime
  }

  // Grouped by status — live first, then upcoming (soonest first), then
  // completed (most recent result first). Used for the "all" filter view.
  const grouped = useMemo(() => {
    const live = filtered.filter((m) => m.status === "live").sort(byScheduledAtAsc)
    const upcoming = filtered.filter((m) => m.status === "upcoming").sort(byScheduledAtAsc)
    const completed = filtered
      .filter((m) => m.status === "completed")
      .sort((a, b) => byScheduledAtAsc(b, a)) // most recent completed first
    return { live, upcoming, completed }
  }, [filtered])

  // When a single status filter is active, just show that one list,
  // still ordered sensibly (soonest-first for live/upcoming, most
  // recent-first for completed).
  const singleStatusList = useMemo(() => {
    if (filter === "all") return []
    if (filter === "completed") return [...filtered].sort((a, b) => byScheduledAtAsc(b, a))
    return [...filtered].sort(byScheduledAtAsc)
  }, [filter, filtered])

  const isLoading = dataLoading
  const hasAnyResults = filtered.length > 0

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
          {/* Stat strip — echoes the "Tournament Information" panel styling */}
          <div className="max-w-3xl mx-auto grid grid-cols-3 gap-3 mb-6 fade-in-up stagger-1">
            <StatTile label="Fixtures" value={matches.length} icon={<CalendarDays className="h-4 w-4 text-gold" />} />
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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button className="bg-gold hover:bg-gold/90 text-black font-bold shrink-0">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>

          {/* Filters row — tournament select + status pills + a quick
              friendly-matches toggle, all combined on one line to keep
              the hero compact. Wraps on narrow screens. */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 fade-in-up stagger-3">
            {(tournaments.length > 0 || hasFriendlies) && (
              <select
                value={tournament}
                onChange={(e) => setTournament(e.target.value)}
                className="bg-black/50 border border-gold/30 text-white text-xs font-cinzel uppercase tracking-widest rounded-full px-3 py-1.5 focus:outline-none focus:border-gold/60 appearance-none cursor-pointer"
              >
                <option value="all">All Tournaments</option>
                {tournaments.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
                {hasFriendlies && <option value={FRIENDLY_VALUE}>Friendly Matches</option>}
              </select>
            )}

            {/* Quick toggle for friendlies — same URL param as the select
                above, just more discoverable next to the status pills. */}
            {hasFriendlies && (
              <button
                onClick={() => setTournament(tournament === FRIENDLY_VALUE ? "all" : FRIENDLY_VALUE)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-cinzel uppercase tracking-widest border transition-colors ${
                  tournament === FRIENDLY_VALUE
                    ? "bg-blue-400 text-black border-blue-400 font-bold"
                    : "border-blue-400/30 text-blue-300 hover:border-blue-400/60 hover:text-blue-200"
                }`}
              >
                <Handshake className="h-3 w-3" />
                Friendly
                <span className={tournament === FRIENDLY_VALUE ? "opacity-70" : "opacity-60"}>
                  ({friendlyCount})
                </span>
              </button>
            )}

            {(tournaments.length > 0 || hasFriendlies) && <span className="hidden sm:block h-4 w-px bg-gold/20 mx-1" />}

            {filters.map((item) => {
              const meta = filterMeta[item]
              const active = filter === item
              return (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-cinzel uppercase tracking-widest border transition-colors ${
                    active
                      ? "bg-gold text-black border-gold font-bold"
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
            <EmptyState />
          ) : filter === "all" ? (
            <div className="space-y-12">
              {sectionMeta.map(({ status, label, dot }) => {
                const list = grouped[status]
                if (list.length === 0) return null
                const { tournamentList, friendlyList } = splitByType(list)
                const showSubGroups = tournament === "all" && tournamentList.length > 0 && friendlyList.length > 0
                return (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-5">
                      <span className={`h-2 w-2 rounded-full ${dot} ${status === "live" ? "animate-pulse" : ""}`} />
                      <h2 className="font-cinzel text-sm uppercase tracking-[0.2em] text-white font-bold">
                        {label}
                      </h2>
                      <span className="text-xs text-gray-500 font-mono">({list.length})</span>
                      <div className="flex-1 h-px bg-gold/10 ml-2" />
                    </div>

                    {showSubGroups ? (
                      <div className="space-y-8">
                        <MatchGrid list={tournamentList} />
                        <div>
                          <div className="flex items-center gap-2 mb-4 pl-1">
                            <Handshake className="h-3.5 w-3.5 text-blue-300" />
                            <h3 className="font-cinzel text-xs uppercase tracking-[0.2em] text-blue-300 font-bold">
                              Friendly Matches
                            </h3>
                            <span className="text-[11px] text-gray-500 font-mono">({friendlyList.length})</span>
                          </div>
                          <MatchGrid list={friendlyList} />
                        </div>
                      </div>
                    ) : (
                      <MatchGrid list={list} />
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <MatchGrid list={singleStatusList} />
          )}

          {!isLoading && (
            <p className="pt-14 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
              Showing {filtered.length} of {matches.length} fixtures
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

// ─────────────────────────────────────────────────────────────
// STAT TILE — small echo of the Tournament Information panel
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// MATCH CARD — diagonal team-color split, in the same visual
// language as the tournament schedule's FixtureCard. Surfaces
// live score, weather, broadcast channels, and bracket stage
// (or a distinct "Friendly Match" badge for standalone matches
// with no bracket link — styled in blue so it reads differently
// from tournament fixtures at a glance).
// Upcoming matches lead with their full schedule + countdown
// instead of a generic "not started" message. Venue/schedule
// fall back to "TBA" rather than disappearing when unset, so
// missing data reads as missing data, not a broken card.
// ─────────────────────────────────────────────────────────────
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
      {/* Diagonal team-color banner */}
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

        <TeamCrest
          side="left"
          name={match.teamA}
          code={match.teamACode}
          color={teamAColor}
          logo={match.teamALogo}
          won={aWon}
        />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <span className="h-8 w-8 rounded-full border border-gold/40 bg-black/70 flex items-center justify-center text-gold font-cinzel text-[10px] font-bold">
            VS
          </span>
        </div>
        <TeamCrest
          side="right"
          name={match.teamB}
          code={match.teamBCode}
          color={teamBColor}
          logo={match.teamBLogo}
          won={bWon}
        />
      </div>

      {/* Details */}
      <div className="bg-black/50 p-4 flex-1 flex flex-col">
        {live && match.live ? (
          <div className="flex flex-col items-center gap-1 mb-2">
            <p className="font-cinzel text-2xl font-bold text-gold tabular-nums text-center">
              {match.live.runs}/{match.live.wkts}
              <span className="ml-2 text-sm font-normal text-white/60">({match.live.overs} ov)</span>
            </p>
            {match.live.battingTeam && (
              <p className="text-[10px] uppercase tracking-widest text-white/40">
                {match.live.battingTeam} batting
              </p>
            )}
          </div>
        ) : completed ? (
          <p className="font-cinzel text-xl font-bold text-white tabular-nums text-center mb-2">
            {match.scoreA ?? "—"}
            <span className="px-2 text-gray-600">–</span>
            {match.scoreB ?? "—"}
          </p>
        ) : (
          // Upcoming — lead with the schedule itself rather than a
          // generic placeholder, since that's the actually useful info.
          <div className="flex flex-col items-center gap-1 mb-2 py-1">
            {schedule ? (
              <>
                <p className="font-cinzel text-base font-bold text-white text-center leading-tight">
                  {schedule.full}
                </p>
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
          {/* For upcoming matches the schedule is already the headline above,
              so only repeat it here for live/completed as a quick reference. */}
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
              <span
                key={c}
                className="text-[9px] uppercase tracking-wider text-gold/80 border border-gold/30 rounded-full px-2 py-0.5"
              >
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
    <div
      className={`absolute ${position} top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1.5`}
    >
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

// ─────────────────────────────────────────────────────────────
// EMPTY STATE — matches the LockedTabPlaceholder pattern
// ─────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-10 mb-8 flex flex-col items-center text-center gap-3 fade-in">
      <div className="h-12 w-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center relative">
        <CalendarDays className="h-5 w-5 text-gold/50" />
        <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-black border border-gold/30 flex items-center justify-center">
          <Lock className="h-2.5 w-2.5 text-gold" />
        </span>
      </div>
      <h2 className="text-white font-bold font-cinzel">No matches found</h2>
      <p className="text-gray-400 text-sm max-w-sm">Try another search or match status.</p>
    </div>
  )
}

function LoadingCard() {
  return <div className="h-64 animate-pulse rounded-xl border border-gold/10 bg-black/40" />
}