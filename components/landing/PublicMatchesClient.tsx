"use client"

import { useEffect, useMemo, useState } from "react"
import { getPublicMatches, type PublicMatch } from "@/lib/public-data"

export default function PublicMatchesClient() {
  const [matches, setMatches] = useState<PublicMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "upcoming" | "live" | "completed">("all")

  useEffect(() => {
    getPublicMatches().then((rows) => {
      setMatches(rows)
      setLoading(false)
    })
  }, [])

  const filtered = filter === "all" ? matches : matches.filter((m) => m.status === filter)

  const grouped = useMemo(() => {
    const map = new Map<number, PublicMatch[]>()
    for (const m of filtered) {
      if (!map.has(m.round)) map.set(m.round, [])
      map.get(m.round)!.push(m)
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [filtered])

  const filters: Array<{ key: "all" | "upcoming" | "live" | "completed"; label: string }> = [
    { key: "all", label: "All" },
    { key: "upcoming", label: "Upcoming" },
    { key: "live", label: "Live" },
    { key: "completed", label: "Completed" },
  ]

  return (
    <main className="min-h-screen bg-[#0c0d11] px-5 py-12 text-white md:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#d8ad4c]">Public archive</p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight md:text-6xl">All matches</h1>
          <p className="mt-4 text-base leading-7 text-white/50">Every fixture, result, and scheduled game in one place.</p>
        </div>

        <div className="mb-10 flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={
                filter === f.key
                  ? "rounded-full bg-[#d8ad4c] px-4 py-1.5 text-sm font-semibold text-[#0c0d11] transition"
                  : "rounded-full border border-white/10 bg-transparent px-4 py-1.5 text-sm font-medium text-white/50 transition hover:border-white/25 hover:text-white"
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-white/40">Loading matches…</div>
        ) : grouped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center text-white/40">No matches found.</div>
        ) : (
          <div className="space-y-10">
            {grouped.map(([round, rows]) => (
              <section key={round}>
                <div className="mb-4 flex items-center gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/40">Round {round}</h2>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="grid gap-2.5">
                  {rows.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function MatchCard({ match }: { match: PublicMatch }) {
  const isTbd = match.teamA === "TBD" && match.teamB === "TBD"
  const aWon = match.scoreA != null && match.scoreB != null && match.scoreA > match.scoreB
  const bWon = match.scoreA != null && match.scoreB != null && match.scoreB > match.scoreA

  const statusStyles: Record<string, string> = {
    live: "bg-red-500/15 text-red-400",
    completed: "bg-white/[0.06] text-white/45",
    upcoming: "bg-[#d8ad4c]/15 text-[#d8ad4c]",
  }

  return (
    <article
      className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5 transition ${
        isTbd ? "border-white/5 bg-white/[0.015] opacity-60" : "border-white/10 bg-white/[0.035] hover:border-white/20"
      }`}
    >
      <div className="min-w-0">
        {match.venue && <p className="mb-1.5 text-xs text-white/35">{match.venue}</p>}
        <div className="flex items-center gap-2.5 text-lg font-semibold">
          <TeamLabel name={match.teamA} code={match.teamACode} color={match.teamAColor} won={aWon} />
          <span className="text-sm font-normal text-white/25">vs</span>
          <TeamLabel name={match.teamB} code={match.teamBCode} color={match.teamBColor} won={bWon} />
        </div>
        {match.scheduledAt && (
          <p className="mt-1.5 text-xs text-white/35">
            {new Date(match.scheduledAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="text-xl font-semibold tabular-nums">
          {match.scoreA ?? "—"} <span className="text-white/25">–</span> {match.scoreB ?? "—"}
        </p>
        <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs capitalize ${statusStyles[match.status] ?? "bg-white/10 text-white/45"}`}>
          {match.status}
        </span>
      </div>
    </article>
  )
}

function TeamLabel({ name, code, color, won }: { name: string; code: string | null; color: string | null; won: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${won ? "text-white" : "text-white/70"}`}>
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color ?? "#555" }} />
      {name}
      {code && <span className="text-xs text-white/30">({code})</span>}
    </span>
  )
}