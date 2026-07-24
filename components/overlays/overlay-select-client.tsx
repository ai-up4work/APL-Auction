"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Radio, PlayCircle, Trophy, Swords } from "lucide-react"
import { Button } from "@/components/ui/button"
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

export default function OverlaySelectClient({ tournaments, auctions }: OverlaySelectClientProps) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("tournament")

  // tournament path
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [fixtures, setFixtures] = useState<OverlayFixture[]>([])
  const [loadingFixtures, setLoadingFixtures] = useState(false)

  const [startingId, setStartingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      router.push(`/overlay/${result.auctionId}`)
    } else {
      setError(result.error)
    }
  }

  const handleSelectAuction = (auction: AuctionOption) => {
    router.push(`/overlay/${auction.id}`)
  }

  return (
    <main className="container mx-auto px-4 pt-32 sm:pt-40 pb-16 max-w-3xl">
      <h1 className="text-3xl font-bold text-white font-cinzel mb-2">Select Match</h1>
      <p className="text-gray-400 text-sm mb-6">
        Start or resume a live overlay — from a tournament fixture, or directly by auction.
      </p>

      <div className="flex gap-2 mb-6 border-b border-gold/10 pb-3">
        <button
          onClick={() => setMode("tournament")}
          className={`flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors ${
            mode === "tournament"
              ? "border-gold/40 text-gold bg-gold/10"
              : "border-transparent text-gray-400 hover:text-gold"
          }`}
        >
          <Trophy className="h-3.5 w-3.5" /> By Tournament
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors ${
            mode === "manual"
              ? "border-gold/40 text-gold bg-gold/10"
              : "border-transparent text-gray-400 hover:text-gold"
          }`}
        >
          <Swords className="h-3.5 w-3.5" /> Manual (by Auction)
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm mb-4 bg-red-500/10 border border-red-500/20 rounded-md p-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── TOURNAMENT MODE ─────────────────────────────────────────── */}
      {mode === "tournament" && (
        <>
          {!selectedTournamentId ? (
            tournaments.length === 0 ? (
              <p className="text-gray-500 text-sm italic">
                No tournaments with fixtures yet — generate a bracket first.
              </p>
            ) : (
              <div className="space-y-2">
                {tournaments.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTournament(t)}
                    className="w-full text-left bg-black/50 border border-gold/20 rounded-lg p-4 hover:border-gold/40 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="text-white font-semibold">{t.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {t.format === "single_elimination"
                          ? "Single Elimination"
                          : t.format === "double_elimination"
                            ? "Double Elimination"
                            : "Round Robin"}{" "}
                        · {t.fixtureCount} fixture{t.fixtureCount === 1 ? "" : "s"}
                      </p>
                    </div>
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
                }}
                className="text-gold text-xs uppercase tracking-widest font-cinzel mb-4 hover:underline"
              >
                ← Back to tournaments
              </button>

              {loadingFixtures ? (
                <p className="text-gray-500 text-sm">Loading fixtures…</p>
              ) : fixtures.length === 0 ? (
                <p className="text-gray-500 text-sm italic">
                  No fixtures with both teams resolved yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {fixtures.map((fixture) => (
                    <div
                      key={fixture.id}
                      className="bg-black/50 border border-gold/20 rounded-lg p-4 flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-gold font-cinzel mb-1">
                          Round {fixture.round} · {fixture.status}
                        </p>
                        <p className="text-white font-semibold">
                          {fixture.teamA.name} <span className="text-gray-500">vs</span>{" "}
                          {fixture.teamB.name}
                        </p>
                        {fixture.venue && (
                          <p className="text-gray-500 text-xs mt-1">{fixture.venue}</p>
                        )}
                      </div>

                      <Button
                        onClick={() => handleSelectFixture(fixture)}
                        disabled={startingId === fixture.id}
                        className={
                          fixture.overlayMatchId
                            ? "bg-gold hover:bg-gold/90 text-black font-bold"
                            : "bg-transparent hover:bg-gold/10 text-gold border border-gold/30"
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

      {/* ── MANUAL MODE ─────────────────────────────────────────────── */}
      {mode === "manual" && (
        <>
          {auctions.length === 0 ? (
            <p className="text-gray-500 text-sm italic">No auctions found.</p>
          ) : (
            <div className="space-y-2">
              {auctions.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleSelectAuction(a)}
                  className="w-full text-left bg-black/50 border border-gold/20 rounded-lg p-4 hover:border-gold/40 transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="text-white font-semibold">{a.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {a.status} · {a.teamCount} team{a.teamCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Radio className="h-4 w-4 text-gold shrink-0" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}