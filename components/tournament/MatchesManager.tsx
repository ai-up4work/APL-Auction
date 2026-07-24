"use client"

// components/tournament/MatchesManager.tsx
// ─────────────────────────────────────────────────────────────────────────
// Two sections:
//   1. Bracket Fixtures — one row per bracket_matches row for this
//      tournament. Once both teams are decided, "Create Match" spins up a
//      `matches` row and links it via overlay_match_id. A result can be
//      recorded inline, which also advances the winner into the next round.
//   2. Manual Matches — matches created for this tournament with no
//      bracket fixture behind them (friendlies, exhibitions, etc).
//
// NOTE: this component needs `orgId` — the parent (tournament-edit-client)
// currently renders it as:
//   <MatchesManager tournamentId={tournament.id} tournamentName={tournament.name} />
// Update that call site to also pass orgId, matching how TeamsManager
// already receives it:
//   <MatchesManager
//     tournamentId={tournament.id}
//     tournamentName={tournament.name}
//     orgId={tournament.orgId!}
//   />
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Plus,
  Trash2,
  Swords,
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  Link2,
  Trophy,
} from "lucide-react"
import {
  getFixturesWithMatches,
  createMatchForFixture,
  unlinkAndDeleteFixtureMatch,
  recordFixtureResult,
  getStandaloneMatchesForTournament,
  createManualMatch,
  deleteStandaloneMatch,
  type FixtureRow,
  type MatchSummary,
} from "@/lib/matches/matches"

interface MatchesManagerProps {
  tournamentId: string
  tournamentName: string
  orgId: string
}

export default function MatchesManager({ tournamentId, tournamentName, orgId }: MatchesManagerProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fixtures, setFixtures] = useState<FixtureRow[]>([])
  const [standalone, setStandalone] = useState<MatchSummary[]>([])

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    const [fx, sm] = await Promise.all([
      getFixturesWithMatches(tournamentId),
      getStandaloneMatchesForTournament(tournamentId),
    ])
    if (!fx.ok) {
      setLoadError(fx.error)
      setLoading(false)
      return
    }
    if (!sm.ok) {
      setLoadError(sm.error)
      setLoading(false)
      return
    }
    setFixtures(fx.fixtures)
    setStandalone(sm.matches)
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
    <div className="space-y-8">
      <FixturesSection
        fixtures={fixtures}
        orgId={orgId}
        tournamentId={tournamentId}
        onChanged={load}
      />
      <StandaloneSection
        matches={standalone}
        orgId={orgId}
        tournamentId={tournamentId}
        tournamentName={tournamentName}
        onChanged={load}
      />
    </div>
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

// ─────────────────────────────────────────────────────────────
// STANDALONE MANUAL MATCHES
// ─────────────────────────────────────────────────────────────
function StandaloneSection({
  matches,
  orgId,
  tournamentId,
  tournamentName,
  onChanged,
}: {
  matches: MatchSummary[]
  orgId: string
  tournamentId: string
  tournamentName: string
  onChanged: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [team1, setTeam1] = useState("")
  const [team2, setTeam2] = useState("")
  const [venue, setVenue] = useState("")
  const [overs, setOvers] = useState("20")
  const [matchDate, setMatchDate] = useState("")

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const resetForm = () => {
    setTeam1("")
    setTeam2("")
    setVenue("")
    setOvers("20")
    setMatchDate("")
    setCreateError(null)
  }

  const handleCreate = async () => {
    if (!team1.trim() || !team2.trim()) {
      setCreateError("Both team names are required.")
      return
    }
    setCreating(true)
    setCreateError(null)
    const result = await createManualMatch({
      orgId,
      tournamentId,
      team1: { name: team1.trim(), short: team1.trim().slice(0, 3).toUpperCase() },
      team2: { name: team2.trim(), short: team2.trim().slice(0, 3).toUpperCase() },
      venue: venue.trim(),
      overs: overs.trim() ? Number(overs) : 20,
      matchDate: matchDate.trim(),
    })
    setCreating(false)
    if (!result.ok) {
      setCreateError(result.error)
      return
    }
    resetForm()
    setShowForm(false)
    onChanged()
  }

  const handleDelete = async (matchId: string) => {
    setDeletingId(matchId)
    setDeleteError(null)
    const result = await deleteStandaloneMatch(matchId)
    setDeletingId(null)
    if (!result.ok) {
      setDeleteError(result.error)
      return
    }
    setConfirmDeleteId(null)
    onChanged()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-white font-bold font-cinzel text-sm">
          <Swords className="h-4 w-4 text-gold" />
          Manual Matches
        </h3>
        {!showForm && (
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="bg-transparent hover:bg-gold/10 text-gold border border-gold/30"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Manual Match
          </Button>
        )}
      </div>

      <p className="text-gray-500 text-xs mb-3">
        Use this for matches that aren't part of the {tournamentName} bracket — friendlies,
        exhibitions, or one-offs.
      </p>

      {showForm && (
        <div className="border border-gold/20 rounded-md p-4 bg-white/[0.02] mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              value={team1}
              onChange={(e) => setTeam1(e.target.value)}
              placeholder="Team 1 name"
              className="bg-black/50 border-gold/30 text-white"
            />
            <Input
              value={team2}
              onChange={(e) => setTeam2(e.target.value)}
              placeholder="Team 2 name"
              className="bg-black/50 border-gold/30 text-white"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Venue"
              className="bg-black/50 border-gold/30 text-white"
            />
            <Input
              type="number"
              value={overs}
              onChange={(e) => setOvers(e.target.value)}
              placeholder="Overs"
              className="bg-black/50 border-gold/30 text-white"
            />
            <Input
              type="date"
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
              className="bg-black/50 border-gold/30 text-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create Match"}
            </Button>
            <Button
              onClick={() => {
                resetForm()
                setShowForm(false)
              }}
              className="bg-transparent hover:bg-white/5 text-gray-300 border border-white/20"
            >
              Cancel
            </Button>
            {createError && (
              <span className="flex items-center gap-1.5 text-red-500 text-xs">
                <AlertCircle className="h-3.5 w-3.5" /> {createError}
              </span>
            )}
          </div>
        </div>
      )}

      {matches.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No manual matches yet.</p>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <div
              key={m.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-gold/10 rounded-md p-3 bg-white/[0.02]"
            >
              <div>
                <p className="text-white text-sm font-semibold">
                  {m.team1.name} <span className="text-gray-500 font-normal">vs</span> {m.team2.name}
                </p>
                <p className="text-gray-400 text-xs flex items-center gap-1.5 mt-1">
                  <CalendarClock className="h-3 w-3" />
                  {m.date || "No date set"} {m.venue && `· ${m.venue}`}
                </p>
              </div>

              {confirmDeleteId === m.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs">Delete this match?</span>
                  <Button
                    size="sm"
                    disabled={deletingId === m.id}
                    onClick={() => handleDelete(m.id)}
                    className="bg-red-600/80 hover:bg-red-600 text-white text-xs"
                  >
                    {deletingId === m.id ? "Deleting…" : "Confirm"}
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
                  onClick={() => setConfirmDeleteId(m.id)}
                  className="bg-transparent hover:bg-red-600/20 text-red-500 border border-red-500/30 px-2 shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteError && (
        <p className="flex items-center gap-1.5 text-red-500 text-xs mt-2">
          <AlertCircle className="h-3.5 w-3.5" /> {deleteError}
        </p>
      )}
    </div>
  )
}