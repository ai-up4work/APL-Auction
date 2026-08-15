"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowLeft,
  ShieldCheck,
  Globe2,
  Coins,
  BarChart3,
} from "lucide-react"
import { SiteHeader } from "@/components/landing/site-header"
import { TypeText } from "@/components/landing/type-text"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { pageStyles } from "@/data/site-data"

import {
  getPlayerDetailForPublic,
  type PlayerDetail,
  type PlayerRole,
  type PlayerStatus,
} from "@/lib/players/players"

// Same visual language as the all-players grid, kept local to this
// page since it's the only other place these need to render.
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

const ROLE_STYLES: Record<PlayerRole, string> = {
  Batter: "bg-sky-500/10 text-sky-300 border-sky-400/30",
  Batsman: "bg-cyan-500/10 text-cyan-300 border-cyan-400/30",
  Bowler: "bg-orange-500/10 text-orange-300 border-orange-400/30",
  "All-rounder": "bg-violet-500/10 text-violet-300 border-violet-400/30",
  "WK-Batter": "bg-teal-500/10 text-teal-300 border-teal-400/30",
  "Wicket Keeper": "bg-emerald-500/10 text-emerald-300 border-emerald-400/30",
}

function fmt(n: number | null | undefined) {
  return n === null || n === undefined ? "—" : n.toLocaleString()
}

function fmtDecimal(n: number | null | undefined) {
  return n === null || n === undefined ? "—" : n.toFixed(2)
}

export default function PlayerDetailClient({ id }: { id: string }) {
  useScrollTop()
  const router = useRouter()

  const [isNavOpen, setIsNavOpen] = useState(false)
  const [player, setPlayer] = useState<PlayerDetail | null | undefined>(undefined) // undefined = loading, null = not found

  useEffect(() => {
    let cancelled = false
    setPlayer(undefined)
    getPlayerDetailForPublic(id).then((data) => {
      if (cancelled) return
      setPlayer(data)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }
  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  return (
    <main className="overflow-hidden min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      <SiteHeader
        activeSection="players"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      <section className="pt-24 pb-16 relative section-pattern min-h-screen">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 max-w-5xl">
          <Link
            href="/players"
            className="inline-flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-widest text-gray-400 hover:text-gold transition-colors mb-6 fade-in"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Players
          </Link>

          {player === undefined && <PlayerDetailSkeleton />}

          {player === null && (
            <div className="text-center py-24 fade-in">
              <p className="text-lg text-gray-300">This player couldn't be found.</p>
              <Link
                href="/players"
                className="inline-block mt-4 text-xs font-cinzel uppercase tracking-widest text-gold hover:underline"
              >
                Back to all players
              </Link>
            </div>
          )}

          {player && (
            <div className="space-y-8 fade-in-up">
              {/* ── Identity header ─────────────────────────────── */}
              <div className="flex flex-col sm:flex-row gap-6 rounded-2xl border border-gold/20 bg-black/70 p-5 sm:p-6 glow-effect">
                <div className="relative h-48 w-40 sm:h-56 sm:w-44 mx-auto sm:mx-0 shrink-0 rounded-lg overflow-hidden border border-gold/20 bg-black/60">
                  <Image src={player.img || "/placeholder.svg"} alt={player.name} fill className="object-cover" />
                </div>

                <div className="flex-1 flex flex-col gap-3 text-center sm:text-left">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white font-cinzel">
                      <TypeText text={player.name} speed={35} />
                    </h1>
                    {player.country && (
                      <p className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-gray-400 mt-1">
                        <Globe2 className="h-3.5 w-3.5" />
                        {player.country}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span
                      className={`text-[10px] font-cinzel uppercase tracking-widest px-2.5 py-1 rounded-full border ${ROLE_STYLES[player.role]}`}
                    >
                      {player.role}
                    </span>

                    {(() => {
                      const s = statusPillStyle(player.status)
                      return (
                        <span
                          className={`flex items-center gap-1 text-[10px] font-cinzel uppercase tracking-widest px-2.5 py-1 rounded-full border ${s.badgeClass}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dotClass}`} />
                          {s.label}
                        </span>
                      )
                    })()}

                    {player.capped && (
                      <span className="flex items-center gap-1 text-[10px] font-cinzel uppercase tracking-widest px-2.5 py-1 rounded-full bg-gold/90 text-black font-bold">
                        <ShieldCheck className="h-3 w-3" />
                        Capped
                      </span>
                    )}
                  </div>

                  {/* Team + price — only meaningful once a player is in
                      an auction; pool players don't have either yet. */}
                  {player.source === "auction" ? (
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-1">
                      {player.team && (
                        <div className="flex items-center gap-2">
                          {player.team.logo ? (
                            <div className="relative h-7 w-7 rounded-full overflow-hidden border border-gold/20 bg-black/60">
                              <Image src={player.team.logo} alt={player.team.name} fill className="object-cover" />
                            </div>
                          ) : (
                            <span
                              className="h-7 w-7 rounded-full border border-gold/20"
                              style={{ backgroundColor: player.team.color }}
                            />
                          )}
                          <span className="text-sm text-white font-cinzel">{player.team.name}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-sm text-gold font-mono">
                        <Coins className="h-3.5 w-3.5" />
                        {player.status === "sold"
                          ? fmt(player.soldPrice)
                          : `Base ${fmt(player.price)}`}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      Not yet entered into an auction.
                    </p>
                  )}
                </div>
              </div>

              {/* ── Stats ────────────────────────────────────────── */}
              <div className="grid sm:grid-cols-2 gap-5">
                <StatGroup
                  title="Batting"
                  stats={[
                    { label: "Matches", value: fmt(player.matchesBatted) },
                    { label: "Runs", value: fmt(player.runsScored) },
                    { label: "Balls Faced", value: fmt(player.ballsFaced) },
                    { label: "Dismissals", value: fmt(player.dismissals) },
                    { label: "Average", value: fmtDecimal(player.battingAverage) },
                    { label: "Strike Rate", value: fmtDecimal(player.strikeRate) },
                  ]}
                />
                <StatGroup
                  title="Bowling"
                  stats={[
                    { label: "Matches", value: fmt(player.matchesBowled) },
                    { label: "Wickets", value: fmt(player.wickets) },
                    { label: "Balls Bowled", value: fmt(player.ballsBowled) },
                    { label: "Runs Conceded", value: fmt(player.runsConceded) },
                    { label: "Average", value: fmtDecimal(player.bowlingAverage) },
                    { label: "Economy", value: fmtDecimal(player.economy) },
                  ]}
                />
              </div>

              {player.matchesBatted === 0 && player.matchesBowled === 0 && (
                <p className="text-center text-xs text-gray-500">
                  No ball-by-ball data recorded for this player yet.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function StatGroup({ title, stats }: { title: string; stats: { label: string; value: string }[] }) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-black/70 p-5">
      <h2 className="flex items-center gap-2 text-sm font-cinzel uppercase tracking-widest text-gold mb-4">
        <BarChart3 className="h-4 w-4" />
        {title}
      </h2>
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-lg sm:text-xl font-bold text-white font-mono">{s.value}</div>
            <div className="text-[9px] font-cinzel uppercase tracking-widest text-gray-500 mt-1">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlayerDetailSkeleton() {
  return (
    <div className="space-y-8 fade-in">
      <div className="flex flex-col sm:flex-row gap-6 rounded-2xl border border-gold/10 bg-black/50 p-5 sm:p-6">
        <div className="h-48 w-40 sm:h-56 sm:w-44 mx-auto sm:mx-0 rounded-lg bg-black/60 animate-pulse" />
        <div className="flex-1 space-y-3">
          <div className="h-7 w-1/2 rounded bg-white/10 animate-pulse mx-auto sm:mx-0" />
          <div className="h-4 w-1/3 rounded bg-white/5 animate-pulse mx-auto sm:mx-0" />
          <div className="h-6 w-2/3 rounded-full bg-white/5 animate-pulse mx-auto sm:mx-0" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="h-48 rounded-2xl border border-gold/10 bg-black/50 animate-pulse" />
        <div className="h-48 rounded-2xl border border-gold/10 bg-black/50 animate-pulse" />
      </div>
    </div>
  )
}