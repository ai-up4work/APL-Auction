"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Radio, PlayCircle, Trophy, Swords, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/landing/site-header"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { pageStyles } from "@/data/site-data"
import {
  startOverlayForFixture,
  getFixturesForTournamentOverlay,
  type OverlayFixture,
  type TournamentOption,
  type AuctionOption,
} from "@/lib/tournament/overlay"

interface OverlaySelectClientProps {
  tournaments: TournamentOption[]
  auctions: AuctionOption[]
}

type Mode = "tournament" | "manual"

function formatName(format: TournamentOption["format"]) {
  return format === "single_elimination"
    ? "Single Elimination"
    : format === "double_elimination"
      ? "Double Elimination"
      : "Round Robin"
}

export default function OverlaySelectClient({ tournaments, auctions }: OverlaySelectClientProps) {
  useScrollTop()
  const router = useRouter()
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("tournament")

  // tournament path
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [fixtures, setFixtures] = useState<OverlayFixture[]>([])
  const [loadingFixtures, setLoadingFixtures] = useState(false)

  const [startingId, setStartingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }
  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  const handleSelectTournament = async (t: TournamentOption) => {
    setSelectedTournamentId(t.id)
    setLoadingFixtures(true)
    setError(null)
    const rows = await getFixturesForTournamentOverlay(t.id)
    setFixtures(rows)
    setLoadingFixtures(false)
  }

  const handleSelectFixture = async (fixture: OverlayFixture) => {
    setError(null)
    setStartingId(fixture.id)
    const result = await startOverlayForFixture(fixture.id)
    setStartingId(null)
    if (result.ok) {
      router.push(`/overlay/${result.auctionId}/admin`)
    } else {
      setError(result.error)
    }
  }

  const handleSelectAuction = (auction: AuctionOption) => {
    router.push(`/overlay/${auction.id}/admin`)
  }

  return (
    <main className="overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      <SiteHeader
        activeSection="overlay"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      <section className="pt-32 sm:pt-40 pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 max-w-3xl">
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-2 font-cinzel">
            <Radio className="w-3.5 h-3.5" />
            Live Overlay
          </span>
          <h1 className="text-3xl font-bold text-white font-cinzel mb-2">Select Match</h1>
          <p className="text-gray-400 text-sm mb-8 max-w-xl">
            Start or resume a live overlay — from a tournament fixture, or directly by auction.
          </p>

          {/* MODE TABS — same pill-tab pattern as the tournament detail page */}
          <div className="flex flex-wrap gap-1 mb-8 pb-4 border-b border-gold/10">
            <button
              onClick={() => setMode("tournament")}
              className={`flex items-center gap-1.5 text-[11px] font-cinzel uppercase tracking-widest px-4 py-2 rounded-full border transition-colors ${
                mode === "tournament"
                  ? "bg-gold text-black border-gold font-bold"
                  : "border-transparent text-gray-400 hover:text-gold hover:border-gold/20"
              }`}
            >
              <Trophy className="h-3.5 w-3.5" /> By Tournament
            </button>
            <button
              onClick={() => setMode("manual")}
              className={`flex items-center gap-1.5 text-[11px] font-cinzel uppercase tracking-widest px-4 py-2 rounded-full border transition-colors ${
                mode === "manual"
                  ? "bg-gold text-black border-gold font-bold"
                  : "border-transparent text-gray-400 hover:text-gold hover:border-gold/20"
              }`}
            >
              <Swords className="h-3.5 w-3.5" /> Manual (by Auction)
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm mb-6 bg-red-500/10 border border-red-500/20 rounded-md p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* ── TOURNAMENT MODE ─────────────────────────────────────── */}
          {mode === "tournament" && (
            <>
              {!selectedTournamentId ? (
                tournaments.length === 0 ? (
                  <div className="bg-black/50 border border-gold/20 rounded-lg p-8 text-center">
                    <Trophy className="h-6 w-6 text-gold mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">
                      No tournaments with fixtures yet — generate a bracket first.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tournaments.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTournament(t)}
                        className="w-full text-left bg-black/50 border border-gold/20 rounded-lg p-5 hover:border-gold/50 hover:bg-white/[0.02] transition-all flex items-center justify-between"
                      >
                        <div>
                          <p className="text-white font-bold font-cinzel">{t.name}</p>
                          <p className="text-gray-500 text-xs mt-1">
                            {formatName(t.format)} · {t.fixtureCount} fixture
                            {t.fixtureCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <Trophy className="h-4 w-4 text-gold/60 shrink-0" />
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <>
                  <button
                    onClick={() => {
                      setSelectedTournamentId(null)
                      setFixtures([])
                      setError(null)
                    }}
                    className="text-gold text-[11px] uppercase tracking-widest font-cinzel mb-5 hover:underline"
                  >
                    ← Back to tournaments
                  </button>

                  {loadingFixtures ? (
                    <p className="text-gray-500 text-sm">Loading fixtures…</p>
                  ) : fixtures.length === 0 ? (
                    <div className="bg-black/50 border border-gold/20 rounded-lg p-8 text-center">
                      <p className="text-gray-400 text-sm italic">
                        No fixtures with both teams resolved yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {fixtures.map((fixture) => (
                        <div
                          key={fixture.id}
                          className="bg-black/50 border border-gold/20 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                        >
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-gold font-cinzel mb-1.5">
                              Round {fixture.round} · {fixture.status}
                            </p>
                            <p className="text-white font-bold font-cinzel">
                              {fixture.teamA.name}{" "}
                              <span className="text-gray-500 font-normal">vs</span>{" "}
                              {fixture.teamB.name}
                            </p>
                            {fixture.venue && (
                              <p className="text-gray-500 text-xs mt-1.5">{fixture.venue}</p>
                            )}
                          </div>

                          <Button
                            onClick={() => handleSelectFixture(fixture)}
                            disabled={startingId === fixture.id}
                            className={
                              fixture.overlayMatchId
                                ? "bg-gold hover:bg-gold/90 text-black font-bold shrink-0 disabled:opacity-50"
                                : "bg-transparent hover:bg-gold/10 text-gold border border-gold/30 shrink-0 disabled:opacity-50"
                            }
                          >
                            {startingId === fixture.id ? (
                              "Loading…"
                            ) : fixture.overlayMatchId ? (
                              <>
                                <Radio className="mr-2 h-4 w-4" /> Resume
                              </>
                            ) : (
                              <>
                                <PlayCircle className="mr-2 h-4 w-4" /> Start Overlay
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── MANUAL MODE ─────────────────────────────────────────── */}
          {mode === "manual" && (
            <>
              {auctions.length === 0 ? (
                <div className="bg-black/50 border border-gold/20 rounded-lg p-8 text-center">
                  <Swords className="h-6 w-6 text-gold mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No auctions found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auctions.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => handleSelectAuction(a)}
                      className="w-full text-left bg-black/50 border border-gold/20 rounded-lg p-5 hover:border-gold/50 hover:bg-white/[0.02] transition-all flex items-center justify-between"
                    >
                      <div>
                        <p className="text-white font-bold font-cinzel">{a.name}</p>
                        <p className="text-gray-500 text-xs mt-1 flex items-center gap-1.5">
                          <Users className="h-3 w-3" />
                          {a.status} · {a.teamCount} team{a.teamCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Radio className="h-4 w-4 text-gold/60 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  )
}