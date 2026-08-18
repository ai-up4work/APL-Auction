"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Search, Trophy, Swords, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SiteHeader } from "@/components/landing/site-header"
import { TypeText } from "@/components/landing/type-text"
import { useScrollTop } from "@/hooks/use-scroll-top"
import SectionDivider from "@/components/section-divider"
import { pageStyles } from "@/data/site-data"
import { getTournamentsForPublic, type TournamentCardData } from "@/lib/tournament/tournament"

// Sort priority for status grouping. Live/ongoing tournaments surface
// first, then upcoming, then completed sink to the bottom — within each
// group, newest-created first. Matched case-insensitively against
// whatever label getTournamentsForPublic returns, so it's tolerant of
// "Live" / "Ongoing" / "In Progress" style variants without needing an
// exact enum match.
const STATUS_RANK: Record<string, number> = {
  live: 0,
  ongoing: 0,
  "in progress": 0,
  upcoming: 1,
  scheduled: 1,
  completed: 2,
  finished: 2,
  ended: 2,
}

function statusRank(status: string) {
  return STATUS_RANK[status.trim().toLowerCase()] ?? 1
}

// Visual treatment per status bucket — same normalization as
// statusRank(), so a card's colored pill always matches the group it
// sorts into. Live is a distinct green (rather than the site's usual
// gold accent) so it reads instantly as "happening now" against the
// gold-heavy UI everywhere else.
type StatusPillStyle = { label: string; badgeClass: string; dotClass: string }

function statusPillStyle(status: string): StatusPillStyle {
  const key = status.trim().toLowerCase()

  if (["live", "ongoing", "in progress"].includes(key)) {
    return {
      label: "Live",
      badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40",
      dotClass: "bg-emerald-400 animate-pulse",
    }
  }
  if (["completed", "finished", "ended"].includes(key)) {
    return {
      label: "Completed",
      badgeClass: "bg-white/5 text-green-300 border-white/15",
      dotClass: "bg-green-400",
    }
  }
  if (["upcoming", "scheduled"].includes(key)) {
    return {
      label: "Upcoming",
      badgeClass: "bg-blue-500/10 text-blue-300 border-blue-400/40",
      dotClass: "bg-blue-400",
    }
  }
  // Fallback for anything outside the known buckets (e.g. 'setup') —
  // shown as-is rather than silently relabeled, so it's obvious in the
  // UI when a tournament hasn't reached a bracketed state yet.
  return {
    label: status,
    badgeClass: "bg-white/5 text-gray-400 border-white/10",
    dotClass: "bg-gray-500",
  }
}

// NOTE: assumes TournamentCardData carries a `createdAt` (ISO string) —
// if getTournamentsForPublic doesn't currently select it, add it there;
// tournaments without it just sort to the back of their status group
// rather than crashing.
function createdAtMs(t: TournamentCardData): number {
  const raw = (t as { createdAt?: string }).createdAt
  if (!raw) return 0
  const ms = new Date(raw).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

export default function TournamentClient() {
  useScrollTop()

  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState("")
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [tournaments, setTournaments] = useState<TournamentCardData[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    getTournamentsForPublic().then((publicTournaments) => {
      if (cancelled) return
      setTournaments(publicTournaments)
      setDataLoading(false)
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

  // Status-then-creation ordering, applied once up front so search
  // filtering below never disturbs the order.
  const sortedTournaments = useMemo(() => {
    return [...tournaments].sort((a, b) => {
      const rankDiff = statusRank(a.status) - statusRank(b.status)
      if (rankDiff !== 0) return rankDiff
      return createdAtMs(b) - createdAtMs(a) // newest first within a status group
    })
  }, [tournaments])

  // Trimmed + lowercased once per render rather than inline in the
  // filter predicate — same behavior, just avoids recomputing it once
  // per tournament in the list.
  const q = searchQuery.trim().toLowerCase()

  const filteredTournaments = useMemo(() => {
    if (!q) return sortedTournaments
    return sortedTournaments.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.by.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q)
    )
  }, [sortedTournaments, q])

  const isLoading = dataLoading

  return (
    <main className="overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      <SiteHeader
        activeSection="tournament"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      <section className="pt-24 pb-4 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 fade-in">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-8 section-title inline-block">
              <TypeText text="Valiant League " speed={45} />
              <TypeText text="Tournaments" speed={45} delay={280} className="text-gold" />
            </h1>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto mt-4">
              Real leagues run on Valiant League — from live auctions to broadcast finals.
            </p>

            {/* Narrow, self-contained search — icon inline, clear (x)
                button appears once there's text so it's obvious how to
                reset. No separate Search button: filtering is a plain
                client-side array filter over already-loaded tournaments,
                so it updates on every keystroke with no debounce needed. */}
            <div className="relative max-w-xs sm:max-w-sm mx-auto mt-8 fade-in-up">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gold/50" />
              <Input
                type="text"
                placeholder="Search tournaments..."
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
          </div>
        </div>
      </section>

      <section className="pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
              <TournamentCardSkeleton />
              <TournamentCardSkeleton />
              <TournamentCardSkeleton />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
                {filteredTournaments.map((t, i) => (
                  <TournamentCard key={t.id} tournament={t} index={i} />
                ))}
              </div>

              {filteredTournaments.length === 0 && (
                <p className="text-center text-gray-400 mt-12 fade-in">
                  {tournaments.length === 0
                    ? "No public tournaments are available yet."
                    : "No tournaments match your search."}
                </p>
              )}

              <div className="text-center mt-12 fade-in-up stagger-5">
                <span className="font-mono text-xs text-gray-400 tracking-widest">
                  SHOWING {filteredTournaments.length} OF {tournaments.length} LEAGUES
                </span>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

function TournamentCard({ tournament: t, index }: { tournament: TournamentCardData; index: number }) {
  const status = statusPillStyle(t.status)

  return (
    <div
      className={`group rounded-lg overflow-hidden glow-effect border border-gold/20 bg-black/70 fade-in-up stagger-${
        (index % 6) + 1
      } hover:border-gold/80 transition-all duration-300`}
    >
      {/* Card body is its own link to the tournament's detail page —
          kept separate from the footer action links below so we don't
          end up nesting <a> tags inside each other. */}
      <Link href={`/tournaments/${t.id}`} className="block cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
        <div className="relative h-40 md:h-48 border-b border-gold/20">
          <Image src={t.image || "/placeholder.svg"} alt={t.title} fill className="object-cover" />
        </div>
        <div className="p-5 md:p-6 pb-4">
          <div className="flex items-center justify-between mb-3 gap-2">
            <span className="bg-gold text-black text-[10px] font-bold px-2.5 py-1 rounded font-cinzel tracking-wide">
              {t.tag}
            </span>
            <span
              className={`flex items-center gap-1.5 text-[10px] font-cinzel uppercase tracking-widest px-2.5 py-1 rounded-full border ${status.badgeClass}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
              {status.label}
            </span>
          </div>
          <h3 className="text-lg font-bold text-white font-cinzel mb-1 group-hover:text-gold transition-colors">
            {t.title}
          </h3>
          <p className="text-gray-300 text-xs">{t.by}</p>
        </div>
      </Link>

      {/* Footer actions — quick jumps to this tournament's bracket and
          to the public matches list pre-filtered to it (via ?tournament=
          query param, matching the scope filter on /all-matches). */}
      <div className="flex items-center gap-2 px-5 md:px-6 pb-5 md:pb-6 pt-1">
        <Link
          href={`/tournaments/${t.id}/bracket`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-gold/25 py-1.5 text-[10px] font-cinzel uppercase tracking-widest text-gold/80 transition-colors hover:border-gold/60 hover:bg-gold/10 hover:text-gold"
        >
          <Trophy className="h-3 w-3" />
          Bracket
        </Link>
        <Link
          href={{ pathname: "/all-matches", query: { tournament: t.id } }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-gold/25 py-1.5 text-[10px] font-cinzel uppercase tracking-widest text-gold/80 transition-colors hover:border-gold/60 hover:bg-gold/10 hover:text-gold"
        >
          <Swords className="h-3 w-3" />
          Matches
        </Link>
      </div>
    </div>
  )
}

function TournamentCardSkeleton() {
  return (
    <div className="rounded-lg overflow-hidden border border-gold/10 bg-black/50 fade-in">
      <div className="h-40 md:h-48 animate-pulse bg-black/60 border-b border-gold/10" />
      <div className="p-5 md:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-16 rounded bg-gold/10 animate-pulse" />
          <div className="h-3 w-14 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-white/5 animate-pulse" />
      </div>
    </div>
  )
}