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
//
// The Manual Matches form covers the full match_setup shape used
// elsewhere in the app: teamA/teamB (name, color, logo, shortCode, squad),
// venue, format, season, matchMeta, matchTitle, tossWinner/tossDecision,
// tournament, kickoffTime, matchNumber, tournamentName, tournamentLogoUrl.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Plus,
  Trash2,
  Swords,
  CalendarClock,
  AlertCircle,
  Link2,
  Trophy,
  ChevronDown,
  ChevronUp,
  UserPlus,
  X,
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
  type ManualMatchTeam,
  type SquadPlayer,
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

function emptyTeam(color: string): ManualMatchTeam {
  return {
    name: "",
    color,
    squad: [],
    squadPlayers: [],
    logoUrl: "",
    shortCode: "",
  }
}

function makePlayerId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `p_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

/** Compact squad-builder: add a player (name + role, optional XI flag),
 *  see them listed, remove them. Keeps the team's squadPlayers array in
 *  the parent's state — this component is just the input + list UI. */
function SquadEditor({
  team,
  onChange,
}: {
  team: ManualMatchTeam
  onChange: (players: SquadPlayer[]) => void
}) {
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [xi, setXi] = useState(true)

  const addPlayer = () => {
    if (!name.trim()) return
    onChange([...team.squadPlayers, { id: makePlayerId(), name: name.trim(), role: role.trim(), xi }])
    setName("")
    setRole("")
  }

  const removePlayer = (id: string) => {
    onChange(team.squadPlayers.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPlayer())}
          placeholder="Player name"
          className="bg-black/50 border-gold/30 text-white text-sm"
        />
        <Input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPlayer())}
          placeholder="Role (e.g. Batter)"
          className="bg-black/50 border-gold/30 text-white text-sm"
        />
        <label className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap px-1">
          <input type="checkbox" checked={xi} onChange={(e) => setXi(e.target.checked)} />
          Playing XI
        </label>
        <Button
          type="button"
          size="sm"
          onClick={addPlayer}
          className="bg-gold/15 hover:bg-gold/25 text-gold border border-gold/30 shrink-0"
        >
          <UserPlus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {team.squadPlayers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {team.squadPlayers.map((p) => (
            <span
              key={p.id}
              className="flex items-center gap-1.5 text-[11px] bg-white/[0.03] border border-gold/10 rounded-full pl-2.5 pr-1.5 py-1 text-gray-300"
            >
              {p.name}
              {p.role && <span className="text-gray-500">· {p.role}</span>}
              {!p.xi && <span className="text-gray-600 italic">bench</span>}
              <button
                type="button"
                onClick={() => removePlayer(p.id)}
                className="text-gray-500 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

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
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showSquads, setShowSquads] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // ── Core fields ──
  const [teamA, setTeamA] = useState<ManualMatchTeam>(emptyTeam("#c9971f"))
  const [teamB, setTeamB] = useState<ManualMatchTeam>(emptyTeam("#c9971f"))
  const [venue, setVenue] = useState("")
  const [format, setFormat] = useState("T20")
  const [overs, setOvers] = useState("20")
  const [kickoffTime, setKickoffTime] = useState("")

  // ── Advanced fields (collapsed by default) ──
  const [matchTitle, setMatchTitle] = useState("")
  const [matchNumber, setMatchNumber] = useState("")
  const [matchMeta, setMatchMeta] = useState("")
  const [season, setSeason] = useState("")
  const [tournament, setTournament] = useState("")
  const [tournamentNameOverride, setTournamentNameOverride] = useState("")
  const [tournamentLogoUrl, setTournamentLogoUrl] = useState("")
  const [tossWinner, setTossWinner] = useState("")
  const [tossDecision, setTossDecision] = useState("")

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const resetForm = () => {
    setTeamA(emptyTeam("#c9971f"))
    setTeamB(emptyTeam("#c9971f"))
    setVenue("")
    setFormat("T20")
    setOvers("20")
    setKickoffTime("")
    setMatchTitle("")
    setMatchNumber("")
    setMatchMeta("")
    setSeason("")
    setTournament("")
    setTournamentNameOverride("")
    setTournamentLogoUrl("")
    setTossWinner("")
    setTossDecision("")
    setCreateError(null)
    setShowAdvanced(false)
    setShowSquads(false)
  }

  const handleCreate = async () => {
    if (!teamA.name.trim() || !teamB.name.trim()) {
      setCreateError("Both team names are required.")
      return
    }
    setCreating(true)
    setCreateError(null)
    const result = await createManualMatch({
      orgId,
      tournamentId,
      teamA: {
        ...teamA,
        name: teamA.name.trim(),
        shortCode: teamA.shortCode.trim() || teamA.name.trim().slice(0, 3).toUpperCase(),
      },
      teamB: {
        ...teamB,
        name: teamB.name.trim(),
        shortCode: teamB.shortCode.trim() || teamB.name.trim().slice(0, 3).toUpperCase(),
      },
      venue: venue.trim(),
      format,
      overs: overs.trim() ? Number(overs) : 20,
      kickoffTime,
      matchTitle: matchTitle.trim(),
      matchNumber: matchNumber.trim(),
      matchMeta: matchMeta.trim(),
      season: season.trim(),
      tournament: tournament.trim(),
      tournamentName: tournamentNameOverride.trim() || tournamentName,
      tournamentLogoUrl: tournamentLogoUrl.trim(),
      tossWinner: tossWinner.trim(),
      tossDecision: tossDecision.trim(),
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
        <div className="border border-gold/20 rounded-md p-4 bg-white/[0.02] mb-4 space-y-4">
          {/* ── Core fields ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={teamA.color}
                onChange={(e) => setTeamA({ ...teamA, color: e.target.value })}
                className="h-9 w-10 rounded border border-gold/30 bg-black/50 shrink-0"
                title="Team A color"
              />
              <Input
                value={teamA.name}
                onChange={(e) => setTeamA({ ...teamA, name: e.target.value })}
                placeholder="Team A name"
                className="bg-black/50 border-gold/30 text-white"
              />
              <Input
                value={teamA.shortCode}
                onChange={(e) => setTeamA({ ...teamA, shortCode: e.target.value.toUpperCase() })}
                placeholder="Code"
                maxLength={4}
                className="bg-black/50 border-gold/30 text-white w-20 shrink-0 uppercase"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={teamB.color}
                onChange={(e) => setTeamB({ ...teamB, color: e.target.value })}
                className="h-9 w-10 rounded border border-gold/30 bg-black/50 shrink-0"
                title="Team B color"
              />
              <Input
                value={teamB.name}
                onChange={(e) => setTeamB({ ...teamB, name: e.target.value })}
                placeholder="Team B name"
                className="bg-black/50 border-gold/30 text-white"
              />
              <Input
                value={teamB.shortCode}
                onChange={(e) => setTeamB({ ...teamB, shortCode: e.target.value.toUpperCase() })}
                placeholder="Code"
                maxLength={4}
                className="bg-black/50 border-gold/30 text-white w-20 shrink-0 uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              value={teamA.logoUrl}
              onChange={(e) => setTeamA({ ...teamA, logoUrl: e.target.value })}
              placeholder="Team A logo URL"
              className="bg-black/50 border-gold/30 text-white"
            />
            <Input
              value={teamB.logoUrl}
              onChange={(e) => setTeamB({ ...teamB, logoUrl: e.target.value })}
              placeholder="Team B logo URL"
              className="bg-black/50 border-gold/30 text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Venue"
              className="bg-black/50 border-gold/30 text-white sm:col-span-2"
            />
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3"
            >
              <option value="T20">T20</option>
              <option value="ODI">ODI</option>
              <option value="Test">Test</option>
              <option value="T10">T10</option>
            </select>
            <Input
              type="number"
              value={overs}
              onChange={(e) => setOvers(e.target.value)}
              placeholder="Overs"
              className="bg-black/50 border-gold/30 text-white"
            />
          </div>

          <Input
            type="datetime-local"
            value={kickoffTime}
            onChange={(e) => setKickoffTime(e.target.value)}
            className="bg-black/50 border-gold/30 text-white"
          />

          {/* ── Squads (collapsed by default) ── */}
          <button
            type="button"
            onClick={() => setShowSquads((v) => !v)}
            className="flex items-center gap-1.5 text-gold text-xs font-cinzel uppercase tracking-widest hover:underline"
          >
            {showSquads ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showSquads ? "Hide" : "Add"} squads
          </button>

          {showSquads && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gold/10">
              <div>
                <p className="text-gray-400 text-[10px] uppercase tracking-widest font-cinzel mb-2">
                  {teamA.name || "Team A"} Squad
                </p>
                <SquadEditor team={teamA} onChange={(players) => setTeamA({ ...teamA, squadPlayers: players })} />
              </div>
              <div>
                <p className="text-gray-400 text-[10px] uppercase tracking-widest font-cinzel mb-2">
                  {teamB.name || "Team B"} Squad
                </p>
                <SquadEditor team={teamB} onChange={(players) => setTeamB({ ...teamB, squadPlayers: players })} />
              </div>
            </div>
          )}

          {/* ── Advanced fields (collapsed by default) ── */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-gold text-xs font-cinzel uppercase tracking-widest hover:underline"
          >
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showAdvanced ? "Hide" : "Show"} advanced details
          </button>

          {showAdvanced && (
            <div className="space-y-4 pt-2 border-t border-gold/10">
              <div>
                <p className="text-gray-400 text-[10px] uppercase tracking-widest font-cinzel mb-2">
                  Match Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    value={matchTitle}
                    onChange={(e) => setMatchTitle(e.target.value)}
                    placeholder="Match title (optional)"
                    className="bg-black/50 border-gold/30 text-white"
                  />
                  <Input
                    value={matchNumber}
                    onChange={(e) => setMatchNumber(e.target.value)}
                    placeholder="Match #"
                    className="bg-black/50 border-gold/30 text-white"
                  />
                </div>
                <Input
                  value={matchMeta}
                  onChange={(e) => setMatchMeta(e.target.value)}
                  placeholder="Match meta / notes (e.g. Semi-final, Round 2)"
                  className="bg-black/50 border-gold/30 text-white mt-3"
                />
              </div>

              <div>
                <p className="text-gray-400 text-[10px] uppercase tracking-widest font-cinzel mb-2">
                  Toss
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={tossWinner}
                    onChange={(e) => setTossWinner(e.target.value)}
                    className="bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
                  >
                    <option value="">Toss winner…</option>
                    {teamA.name && <option value={teamA.name}>{teamA.name}</option>}
                    {teamB.name && <option value={teamB.name}>{teamB.name}</option>}
                  </select>
                  <select
                    value={tossDecision}
                    onChange={(e) => setTossDecision(e.target.value)}
                    className="bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
                  >
                    <option value="">Elected to…</option>
                    <option value="bat">Bat</option>
                    <option value="bowl">Bowl</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="text-gray-400 text-[10px] uppercase tracking-widest font-cinzel mb-2">
                  Tournament
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    placeholder="Season"
                    className="bg-black/50 border-gold/30 text-white"
                  />
                  <Input
                    value={tournament}
                    onChange={(e) => setTournament(e.target.value)}
                    placeholder="Tournament (slug/ref, optional)"
                    className="bg-black/50 border-gold/30 text-white"
                  />
                </div>
                <Input
                  value={tournamentNameOverride}
                  onChange={(e) => setTournamentNameOverride(e.target.value)}
                  placeholder={`Tournament display name (defaults to "${tournamentName}")`}
                  className="bg-black/50 border-gold/30 text-white mt-3"
                />
                <Input
                  value={tournamentLogoUrl}
                  onChange={(e) => setTournamentLogoUrl(e.target.value)}
                  placeholder="Tournament logo URL (optional)"
                  className="bg-black/50 border-gold/30 text-white mt-3"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
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
                  {m.teamA.name} <span className="text-gray-500 font-normal">vs</span> {m.teamB.name}
                  {m.matchTitle && <span className="text-gray-500 font-normal"> — {m.matchTitle}</span>}
                </p>
                <p className="text-gray-400 text-xs flex items-center gap-1.5 mt-1">
                  <CalendarClock className="h-3 w-3" />
                  {m.kickoffTime
                    ? new Date(m.kickoffTime).toLocaleString()
                    : "No kickoff time set"}{" "}
                  {m.venue && `· ${m.venue}`}
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