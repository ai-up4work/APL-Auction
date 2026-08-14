"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, CalendarDays, ChevronRight, Radio, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/landing/site-header"
import { getPublicMatches, type PublicMatch } from "@/lib/public-data"

const filters = ["all", "upcoming", "live", "completed"] as const
type Filter = (typeof filters)[number]

export default function PublicMatchesClient() {
  const [matches, setMatches] = useState<PublicMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const [isNavOpen, setIsNavOpen] = useState(false)

  useEffect(() => { getPublicMatches().then((rows) => { setMatches(rows); setLoading(false) }) }, [])

  const filtered = useMemo(() => matches.filter((match) => {
    const text = `${match.teamA} ${match.teamB} ${match.venue ?? ""}`.toLowerCase()
    return (filter === "all" || match.status === filter) && (!query || text.includes(query.toLowerCase()))
  }), [filter, matches, query])
  const liveCount = matches.filter((match) => match.status === "live").length
  const grouped = useMemo(() => {
    const groups = new Map<number, PublicMatch[]>()
    filtered.forEach((match) => groups.set(match.round, [...(groups.get(match.round) ?? []), match]))
    return [...groups.entries()].sort((a, b) => a[0] - b[0])
  }, [filtered])

  const handleNavigation = (path: string) => { window.location.href = path; window.scrollTo(0, 0) }
  const scrollToSection = (sectionId: string) => { window.location.href = `/#${sectionId}` }

  return <main className="min-h-screen bg-[#0b0d11] text-white">
    <SiteHeader activeSection="matches" isNavOpen={isNavOpen} setIsNavOpen={setIsNavOpen} scrollToSection={scrollToSection} handleNavigation={handleNavigation} />
    <section className="border-b border-white/10 bg-[#11151b] pt-28 sm:pt-36"><div className="mx-auto max-w-7xl px-5 pb-14 md:px-10 lg:px-16"><div className="flex flex-col justify-between gap-10 lg:flex-row lg:items-end"><div><p className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.24em] text-gold"><CalendarDays className="size-4" /> Fixture centre</p><h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">Every match.<br /><span className="text-gold">Every moment.</span></h1><p className="mt-6 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">Track the fixtures, follow the live action, and revisit every result from every competition.</p></div><div className="flex shrink-0 gap-8 border-l border-gold/30 pl-6"><div><p className="font-mono text-3xl font-bold text-gold">{matches.length}</p><p className="mt-1 text-xs uppercase tracking-widest text-white/40">Matches</p></div><div><p className="font-mono text-3xl font-bold text-white">{liveCount}</p><p className="mt-1 text-xs uppercase tracking-widest text-white/40">Live now</p></div></div></div></div></section>
    <section className="mx-auto max-w-7xl px-5 py-10 md:px-10 lg:px-16"><div className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between"><div className="relative max-w-md flex-1"><Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" /><Input aria-label="Search matches" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teams or venues..." className="h-12 rounded-xl border-white/10 bg-white/[0.04] pl-11 text-white placeholder:text-white/30" /></div><div className="flex gap-2 overflow-x-auto">{filters.map((item) => <Button key={item} variant="ghost" onClick={() => setFilter(item)} className={`rounded-full px-4 capitalize ${filter === item ? "bg-gold text-black hover:bg-gold/90" : "text-white/50 hover:bg-white/10 hover:text-white"}`}>{item}</Button>)}</div></div>
      {loading ? <div className="grid gap-3 pt-8"><LoadingRow /><LoadingRow /><LoadingRow /></div> : grouped.length === 0 ? <div className="py-24 text-center"><CalendarDays className="mx-auto size-8 text-gold/50" /><h2 className="mt-5 text-xl font-semibold">No matches found</h2><p className="mt-2 text-sm text-white/45">Try another search or match status.</p></div> : <div className="flex flex-col gap-10 pt-8">{grouped.map(([round, rows]) => <section key={round}><div className="mb-4 flex items-center gap-3"><span className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Round {round}</span><div className="h-px flex-1 bg-white/10" /><span className="text-xs text-white/30">{rows.length} {rows.length === 1 ? "match" : "matches"}</span></div><div className="grid gap-3">{rows.map((match) => <MatchCard key={match.id} match={match} />)}</div></section>)}</div>}
      {!loading && <p className="pt-10 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-white/30">Showing {filtered.length} of {matches.length} fixtures</p>}
    </section>
  </main>
}

function MatchCard({ match }: { match: PublicMatch }) {
  const live = match.status === "live"
  const completed = match.status === "completed"
  const aWon = match.scoreA != null && match.scoreB != null && match.scoreA > match.scoreB
  const bWon = match.scoreA != null && match.scoreB != null && match.scoreB > match.scoreA
  return <Link href={`/all-matches/${match.id}`} className={`group grid gap-5 rounded-2xl border p-5 transition sm:grid-cols-[1fr_auto] sm:items-center ${live ? "border-red-400/40 bg-red-400/[0.06]" : "border-white/10 bg-white/[0.035] hover:border-gold/50 hover:bg-white/[0.06]"}`}><div className="flex items-center gap-4"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 font-mono text-xs text-white/45">{match.teamACode?.slice(0, 3) ?? "A"}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-base font-semibold sm:text-lg"><span className={aWon ? "text-white" : "text-white/75"}>{match.teamA}</span><span className="text-xs font-normal text-white/25">vs</span><span className={bWon ? "text-white" : "text-white/75"}>{match.teamB}</span></div><div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/35">{match.venue && <span>{match.venue}</span>}{match.scheduledAt && <span>{new Date(match.scheduledAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}</div></div></div><div className="flex items-center justify-between gap-5 sm:justify-end"><div className="text-left sm:text-right"><p className="font-mono text-xl font-bold tabular-nums">{match.scoreA ?? "—"}<span className="px-2 text-white/25">–</span>{match.scoreB ?? "—"}</p><span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${live ? "bg-red-400 text-black" : completed ? "bg-white/10 text-white/50" : "bg-gold/15 text-gold"}`}>{live && <Radio className="size-3" />}{match.status}</span></div><ArrowUpRight className="size-5 text-white/25 transition group-hover:text-gold" /></div></Link>
}
function LoadingRow() { return <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" /> }
