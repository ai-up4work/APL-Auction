"use client"

// components/tournament/MatchesManager.tsx
// ─────────────────────────────────────────────────────────────────────────
// One section: Bracket Fixtures — one row per bracket_matches row for
// this tournament. A match is created and linked automatically the
// moment a fixture's two teams are both known (round 1 at generation
// time, or a later round the instant advanceResultToNextMatches fills in
// its second team) — see generateBracket.ts and bracketData.ts. "Create
// Match" here is a manual fallback for the rare case that auto-creation
// didn't fire. Once a match is linked, "Edit Match" opens the full match
// editor at /match/[id]/edit.
//
// Standalone, non-bracket-linked match creation has been removed — every
// match for a tournament now traces back to a bracket fixture.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, AlertCircle, Link2, Trophy, Pencil } from "lucide-react"
import {
  getFixturesWithMatches,
  createMatchForFixture,
  unlinkAndDeleteFixtureMatch,
  recordFixtureResult,
  type FixtureRow,
} from "@/lib/matches/matches"

interface MatchesManagerProps {
  tournamentId: string
  tournamentName: string
  orgId: string
}

export default function MatchesManager({ tournamentId, orgId }: MatchesManagerProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fixtures, setFixtures] = useState<FixtureRow[]>([])

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    const fx = await getFixturesWithMatches(tournamentId)
    if (!fx.ok) {
      setLoadError(fx.error)
      setLoading(false)
      return
    }
    setFixtures(fx.fixtures)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId])

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading matches…</p>
  }

  if (loadError) {
    return (
      <p className="flex items-center gap-1.5 text-red-500 text-sm">
        <AlertCircle className="h-4 w-4" /> {loadError}
      </p>
    )
  }

  return (
    <FixturesSection
      fixtures={fixtures}
      orgId={orgId}
      tournamentId={tournamentId}
      onChanged={load}
    />
  )
}

// ─────────────────────────────────────────────────────────────
// BRACKET FIXTURES
// ─────────────────────────────────────────────────────────────
function FixturesSection({
  fixtures,
  orgId,
  tournamentId,
  onChanged,
}: {
  fixtures: FixtureRow[]
  orgId: string
  tournamentId: string
  onChanged: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [resultFormId, setResultFormId] = useState<string | null>(null)

  const runAction = async (fixtureId: string, action: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyId(fixtureId)
    setErrorId(null)
    setErrorMsg(null)
    const result = await action()
    setBusyId(null)
    if (!result.ok) {
      setErrorId(fixtureId)
      setErrorMsg(result.error ?? "Something went wrong.")
      return
    }
    onChanged()
  }

  if (fixtures.length === 0) {
    return (
      <div>
        <h3 className="flex items-center gap-2 text-white font-bold font-cinzel text-sm mb-3">
          <Trophy className="h-4 w-4 text-gold" />
          Bracket Fixtures
        </h3>
        <p className="text-gray-500 text-sm italic">
          No bracket generated yet — build one in the Bracket section above.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="flex items-center gap-2 text-white font-bold font-cinzel text-sm mb-3">
        <Trophy className="h-4 w-4 text-gold" />
        Bracket Fixtures
      </h3>
      <p className="text-gray-500 text-xs mb-3">
        A match is created and linked automatically as soon as both of a fixture's teams are known.
        The button below only shows up if that didn't happen for some reason.
      </p>
      <div className="space-y-3">
        {fixtures.map((f) => {
          const teamsReady = !!f.teamAId && !!f.teamBId
          const busy = busyId === f.id
          const showError = errorId === f.id

          return (
            <div key={f.id} className="border border-gold/10 rounded-md p-4 bg-white/[0.02]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-gray-400 text-[10px] uppercase tracking-widest font-cinzel">
                    Round {f.round} · {f.bracketType.replace("_", " ")}
                  </p>
                  <p className="text-white font-semibold mt-1">
                    {f.teamAName ?? "TBD"}{" "}
                    <span className="text-gray-500 font-normal">vs</span> {f.teamBName ?? "TBD"}
                  </p>
                  {f.winnerTeamId && (
                    <p className="text-gold text-xs mt-1">
                      Winner: {f.winnerTeamId === f.teamAId ? f.teamAName : f.teamBName}
                      {f.scoreA != null && f.scoreB != null ? ` (${f.scoreA} – ${f.scoreB})` : ""}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!teamsReady && (
                    <span className="text-gray-500 text-xs italic">Waiting on bracket</span>
                  )}

                  {teamsReady && !f.overlayMatchId && f.status !== "completed" && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        runAction(f.id, () => createMatchForFixture(f, orgId, tournamentId))
                      }
                      className="bg-gold hover:bg-gold/90 text-black font-bold"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      {busy ? "Creating…" : "Create Match"}
                    </Button>
                  )}

                  {f.overlayMatchId && (
                    <>
                      <span className="flex items-center gap-1.5 text-green-500 text-xs">
                        <Link2 className="h-3.5 w-3.5" /> Match linked
                      </span>
                      <Link
                        href={`/match/${f.overlayMatchId}/edit`}
                        className="flex items-center gap-1.5 text-gold text-xs font-cinzel uppercase tracking-wide hover:underline"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit Match
                      </Link>
                      {confirmDeleteId === f.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-xs">Remove it?</span>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              runAction(f.id, () =>
                                unlinkAndDeleteFixtureMatch(f.id, f.overlayMatchId!)
                              )
                            }
                            className="bg-red-600/80 hover:bg-red-600 text-white text-xs"
                          >
                            {busy ? "Removing…" : "Confirm"}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setConfirmDeleteId(null)}
                            className="bg-transparent hover:bg-white/5 text-gray-300 border border-white/20 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setConfirmDeleteId(f.id)}
                          className="bg-transparent hover:bg-red-600/20 text-red-500 border border-red-500/30 px-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {teamsReady && f.status !== "completed" && (
                <div className="mt-3 pt-3 border-t border-gold/10">
                  {resultFormId === f.id ? (
                    <ResultForm
                      fixture={f}
                      busy={busy}
                      onCancel={() => setResultFormId(null)}
                      onSubmit={(winnerTeamId, scoreA, scoreB) =>
                        runAction(f.id, () => recordFixtureResult(f, winnerTeamId, scoreA, scoreB)).then(
                          () => setResultFormId(null)
                        )
                      }
                    />
                  ) : (
                    <button
                      onClick={() => setResultFormId(f.id)}
                      className="text-gold text-xs font-cinzel uppercase tracking-widest hover:underline"
                    >
                      Record result
                    </button>
                  )}
                </div>
              )}

              {showError && (
                <p className="flex items-center gap-1.5 text-red-500 text-xs mt-2">
                  <AlertCircle className="h-3.5 w-3.5" /> {errorMsg}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ResultForm({
  fixture,
  busy,
  onCancel,
  onSubmit,
}: {
  fixture: FixtureRow
  busy: boolean
  onCancel: () => void
  onSubmit: (winnerTeamId: string, scoreA: number | null, scoreB: number | null) => void
}) {
  const [winner, setWinner] = useState<string>("")
  const [scoreA, setScoreA] = useState("")
  const [scoreB, setScoreB] = useState("")

  return (
    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
      <select
        value={winner}
        onChange={(e) => setWinner(e.target.value)}
        className="bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
      >
        <option value="">Winner…</option>
        {fixture.teamAId && <option value={fixture.teamAId}>{fixture.teamAName}</option>}
        {fixture.teamBId && <option value={fixture.teamBId}>{fixture.teamBName}</option>}
      </select>
      <Input
        value={scoreA}
        onChange={(e) => setScoreA(e.target.value)}
        placeholder={`${fixture.teamAName ?? "A"} score`}
        className="bg-black/50 border-gold/30 text-white text-sm w-32"
      />
      <Input
        value={scoreB}
        onChange={(e) => setScoreB(e.target.value)}
        placeholder={`${fixture.teamBName ?? "B"} score`}
        className="bg-black/50 border-gold/30 text-white text-sm w-32"
      />
      <Button
        size="sm"
        disabled={!winner || busy}
        onClick={() =>
          onSubmit(winner, scoreA.trim() ? Number(scoreA) : null, scoreB.trim() ? Number(scoreB) : null)
        }
        className="bg-gold hover:bg-gold/90 text-black font-bold"
      >
        {busy ? "Saving…" : "Save result"}
      </Button>
      <Button
        size="sm"
        onClick={onCancel}
        className="bg-transparent hover:bg-white/5 text-gray-300 border border-white/20"
      >
        Cancel
      </Button>
    </div>
  )
}