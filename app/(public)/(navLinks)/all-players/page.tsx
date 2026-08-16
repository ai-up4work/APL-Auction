"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Search, X, Coins, ShieldCheck, Globe2 } from "lucide-react"
import { Input } from "@/components/ui/input"
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

import {
  getPlayersForPublic,
  type PublicPlayer,
  type PlayerRole,
  type PlayerStatus,
} from "@/lib/players/players"

const ROLE_OPTIONS: PlayerRole[] = ["Batter", "Batsman", "Bowler", "All-rounder", "WK-Batter", "Wicket Keeper"]
const ROLE_VALUE_ALL = "all"

// "pool" = not yet pulled into any auction (lives in the org's player
// bank). Sits alongside the existing auction-derived statuses.
const statusFilters = ["all", "sold", "available", "pool", "unsold"] as const
type StatusFilter = (typeof statusFilters)[number]

const statusFilterMeta: Record<StatusFilter, { label: string; dot?: string }> = {
  all: { label: "All" },
  sold: { label: "Sold", dot: "bg-emerald-400" },
  available: { label: "Available", dot: "bg-blue-400" },
  pool: { label: "In Pool", dot: "bg-purple-400" },
  unsold: { label: "Unsold", dot: "bg-gray-400" },
}

// Same visual language as the tournament status pill — sold is the
// "active/settled" state so it gets green, available is blue (still in
// play), pool is purple (waiting to be drafted into an auction), and
// unsold is muted gray.
function statusPillStyle(status: PlayerStatus) {
  if (status === "sold") {
    return { label: "Sold", badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40", dotClass: "bg-emerald-400" }
  }
  if (status === "available") {
    return { label: "Available", badgeClass: "bg-blue-500/10 text-blue-300 border-blue-400/40", dotClass: "bg-blue-400" }
  }
  if (status === "pool") {
    return { label: "In Pool", badgeClass: "bg-purple-500/10 text-purple-300 border-purple-400/40", dotClass: "bg-purple-400" }
  }
  return { label: "Unsold", badgeClass: "bg-white/5 text-gray-400 border-white/15", dotClass: "bg-gray-500" }
}

// Role badges get their own small color language so the grid is
// scannable by role at a glance without reading each label.
const ROLE_STYLES: Record<PlayerRole, string> = {
  Batter: "bg-sky-500/10 text-sky-300 border-sky-400/30",
  Batsman: "bg-cyan-500/10 text-cyan-300 border-cyan-400/30",
  Bowler: "bg-orange-500/10 text-orange-300 border-orange-400/30",
  "All-rounder": "bg-violet-500/10 text-violet-300 border-violet-400/30",
  "WK-Batter": "bg-teal-500/10 text-teal-300 border-teal-400/30",
  "Wicket Keeper": "bg-emerald-500/10 text-emerald-300 border-emerald-400/30",
}

function effectivePrice(p: PublicPlayer) {
  return p.soldPrice ?? p.price ?? 0
}

const EMPTY_LIST: PublicPlayer[] = []
const PAGE_SIZE = 50

export default function AllPlayersClient() {
  useScrollTop()
  const router = useRouter()

  const [isNavOpen, setIsNavOpen] = useState(false)
  const [players, setPlayers] = useState<PublicPlayer[]>(EMPTY_LIST)
  const [isLoading, setIsLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState("")
  const [role, setRole] = useState<string>(ROLE_VALUE_ALL)
  const [status, setStatus] = useState<StatusFilter>("all")
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    getPlayersForPublic().then((data) => {
      if (cancelled) return
      setPlayers(data)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }
  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  // Players with a real photo surface first (they're the ones worth
  // looking at in a photo grid), then everyone else, alphabetically by
  // name within each group.
  const sorted = useMemo(() => {
    return [...players].sort((a, b) => {
      const aHasImg = !!a.img
      const bHasImg = !!b.img
      if (aHasImg !== bHasImg) return aHasImg ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [players])

  const q = searchQuery.trim().toLowerCase()

  const filtered = useMemo(() => {
    return sorted.filter((p) => {
      if (status !== "all" && p.status !== status) return false
      if (role !== ROLE_VALUE_ALL && p.role !== role) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.team?.name.toLowerCase().includes(q) ?? false) ||
        (p.country?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [sorted, status, role, q])

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = { all: players.length, sold: 0, available: 0, pool: 0, unsold: 0 }
    for (const p of players) base[p.status] += 1
    return base
  }, [players])

  // Any change to what's being shown should land back on page 1 —
  // otherwise a search/filter can leave you stranded on a page that no
  // longer has anything on it.
  useEffect(() => {
    setPage(1)
  }, [status, role, q])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, currentPage])

  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length)

  const goToPage = (p: number) => {
    const next = Math.min(Math.max(p, 1), totalPages)
    setPage(next)
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Windowed page numbers: first, last, current +/-1, with ellipses
  // for gaps — keeps the control compact even with a lot of pages.
  const pageNumbers = useMemo(() => {
    const nums: (number | "ellipsis")[] = []
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
        nums.push(i)
      } else if (nums[nums.length - 1] !== "ellipsis") {
        nums.push("ellipsis")
      }
    }
    return nums
  }, [totalPages, currentPage])

  return (
    <main className="overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      <SiteHeader
        activeSection="players"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      <section className="pt-24 pb-4 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-10 fade-in">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              <TypeText text="All " speed={45} />
              <TypeText text="Players" speed={45} delay={200} className="text-gold" />
            </h1>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
              Every player across Valiant League — in the player pool, and sold, available, or unsold across auctions.
            </p>
          </div>

          {/* CONTROLS — search left, filters right on desktop; stacked
              centered on mobile. Same layout pattern as the matches
              page: search is a narrow self-contained pill, filters sit
              grouped in one bordered container so Role/Status read as
              one coherent control. */}
          <div className="mt-2 flex flex-col lg:flex-row lg:items-center lg:justify-center gap-3 lg:gap-4 fade-in-up">
            <div className="relative w-full max-w-xs sm:max-w-sm mx-auto lg:mx-0 lg:w-64 shrink-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gold/50" />
              <Input
                type="text"
                placeholder="Search players, teams, countries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 rounded-full border-gold/20 bg-black/50 pl-9 pr-8 text-sm text-white placeholder:text-gray-500 focus-visible:border-gold/50 focus-visible:ring-1 focus-visible:ring-gold/40 focus-visible:ring-offset-0"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-500 hover:text-gold transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-2xl sm:rounded-full border border-gold/15 bg-black/40 px-4 py-2 lg:py-1.5">
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-[10px] font-cinzel uppercase tracking-widest text-gray-500">
                  Role
                </span>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="h-8 w-auto min-w-[8.5rem] gap-1.5 rounded-full border-gold/30 bg-black/50 px-3 text-xs font-cinzel uppercase tracking-widest text-white focus:ring-1 focus:ring-gold/40 focus:ring-offset-0">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent className="border-gold/30 bg-black text-white">
                    <SelectItem value={ROLE_VALUE_ALL} className="text-xs font-cinzel uppercase tracking-widest focus:bg-gold/10 focus:text-white">
                      All Roles
                    </SelectItem>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs font-cinzel uppercase tracking-widest focus:bg-gold/10 focus:text-white">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="hidden sm:block h-4 w-px bg-gold/20" />

              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-[10px] font-cinzel uppercase tracking-widest text-gray-500">
                  Status
                </span>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {statusFilters.map((item) => {
                    const meta = statusFilterMeta[item]
                    const active = status === item
                    return (
                      <button
                        key={item}
                        onClick={() => setStatus(item)}
                        className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-cinzel uppercase tracking-widest transition-colors ${
                          active
                            ? "border-gold bg-gold font-bold text-black"
                            : "border-gold/20 text-gray-400 hover:border-gold/50 hover:text-white"
                        }`}
                      >
                        {meta.dot && <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />}
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

      <section className="pb-16 pt-8 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 max-w-7xl mx-auto">
              <PlayerCardSkeleton />
              <PlayerCardSkeleton />
              <PlayerCardSkeleton />
              <PlayerCardSkeleton />
              <PlayerCardSkeleton />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 max-w-7xl mx-auto">
                {paginated.map((p, i) => (
                  <PlayerCard key={p.id} player={p} index={i} />
                ))}
              </div>

              {filtered.length === 0 && (
                <p className="text-center text-gray-400 mt-12 fade-in">
                  {players.length === 0 ? "No players are available yet." : "No players match your filters."}
                </p>
              )}

              {filtered.length > 0 && (
                <div className="mt-12 fade-in-up flex flex-col items-center gap-4">
                  <span className="font-mono text-xs text-gray-400 tracking-widest">
                    SHOWING {rangeStart}–{rangeEnd} OF {filtered.length} PLAYERS
                  </span>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="h-8 rounded-full border border-gold/20 px-3 text-xs font-cinzel uppercase tracking-widest text-gray-400 transition-colors hover:border-gold/50 hover:text-white disabled:opacity-30 disabled:hover:border-gold/20 disabled:hover:text-gray-400"
                      >
                        Prev
                      </button>

                      {pageNumbers.map((n, i) =>
                        n === "ellipsis" ? (
                          <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-500">
                            …
                          </span>
                        ) : (
                          <button
                            key={n}
                            type="button"
                            onClick={() => goToPage(n)}
                            className={`h-8 min-w-8 rounded-full border px-2.5 text-xs font-cinzel uppercase tracking-widest transition-colors ${
                              n === currentPage
                                ? "border-gold bg-gold font-bold text-black"
                                : "border-gold/20 text-gray-400 hover:border-gold/50 hover:text-white"
                            }`}
                          >
                            {n}
                          </button>
                        )
                      )}

                      <button
                        type="button"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="h-8 rounded-full border border-gold/20 px-3 text-xs font-cinzel uppercase tracking-widest text-gray-400 transition-colors hover:border-gold/50 hover:text-white disabled:opacity-30 disabled:hover:border-gold/20 disabled:hover:text-gray-400"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  )
}

function PlayerCard({ player: p, index }: { player: PublicPlayer; index: number }) {
  const status = statusPillStyle(p.status)
  const price = effectivePrice(p)

  return (
    <Link
      href={`/players/${p.id}`}
      className={`group rounded-lg overflow-hidden glow-effect border border-gold/20 bg-black/70 fade-in-up stagger-${
        (index % 6) + 1
      } hover:border-gold/80 transition-all duration-300 flex flex-col`}
    >
      <div className="relative h-40 sm:h-40 border-b border-gold/20 bg-black/60">
        <Image src={p.img || "/placeholder.svg"} alt={p.name} fill className="object-cover" />

        <span
          className={`absolute top-2 left-2 z-10 flex items-center gap-1 text-[9px] font-cinzel uppercase tracking-widest px-2 py-0.5 rounded-full border ${status.badgeClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
          {status.label}
        </span>

        {p.capped && (
          <span className="absolute top-2 right-2 z-10 flex items-center gap-1 text-[9px] font-cinzel uppercase tracking-widest px-2 py-0.5 rounded-full bg-gold/90 text-black font-bold">
            <ShieldCheck className="h-2.5 w-2.5" />
            Capped
          </span>
        )}
      </div>

      <div className="p-3.5 flex-1 flex flex-col gap-2">
        <div>
          <h3 className="text-sm font-bold text-white font-cinzel leading-tight truncate group-hover:text-gold transition-colors">
            {p.name}
          </h3>
          {p.country && (
            <p className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
              <Globe2 className="h-2.5 w-2.5" />
              {p.country}
            </p>
          )}
        </div>

        <span
          className={`self-start text-[9px] font-cinzel uppercase tracking-widest px-2 py-0.5 rounded-full border ${ROLE_STYLES[p.role]}`}
        >
          {p.role}
        </span>
      </div>
    </Link>
  )
}

function PlayerCardSkeleton() {
  return (
    <div className="rounded-lg overflow-hidden border border-gold/10 bg-black/50 fade-in">
      <div className="h-36 sm:h-40 animate-pulse bg-black/60 border-b border-gold/10" />
      <div className="p-3.5 space-y-2">
        <div className="h-3.5 w-3/4 rounded bg-white/10 animate-pulse" />
        <div className="h-2.5 w-1/2 rounded bg-white/5 animate-pulse" />
        <div className="h-4 w-14 rounded-full bg-white/5 animate-pulse" />
      </div>
    </div>
  )
}