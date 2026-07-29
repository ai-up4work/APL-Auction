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
// Fixtures are grouped by bracket section (winners / losers / grand
// final — or just rounds, for round robin) and then by round within
// each section, mirroring how the bracket itself is structured.
//
// RESULT ENTRY LIVES ON THE BRACKET TAB, NOT HERE. Recording a winner/
// score and advancing the bracket (recordFixtureResult) is owned by
// BracketEditClient at /tournaments/[id]/bracket/edit — this component
// used to duplicate that with its own inline result form, which meant
// two separate code paths could mutate the same bracket_matches rows.
// This is now read-only for results: status/winner/score are shown, but
// only editable from the Bracket tab.
//
// Standalone, non-bracket-linked match creation has been removed — every
// match for a tournament now traces back to a bracket fixture.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Plus,
  Trash2,
  AlertCircle,
  Trophy,
  Pencil,
  Swords,
  Crown,
  Clock,
  CircleDot,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
} from "lucide-react"
import {
  getFixturesWithMatches,
  createMatchForFixture,
  unlinkAndDeleteFixtureMatch,
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

/* ────────────────────────────────────────────────────────────────── */
/*  GROUPING — bracket section (winners / losers / grand_final /           */
/*  round_robin) -> round number -> fixtures in that round, in the same     */
/*  order they came back from the query (already position-sorted           */
/*  upstream per the getFixturesWithMatches contract).                      */
/* ────────────────────────────────────────────────────────────────── */

type BracketType = FixtureRow["bracketType"]

const SECTION_ORDER: BracketType[] = ["winners", "losers", "grand_final", "round_robin"]

const SECTION_META: Record<BracketType, { label: string; icon: React.ReactNode }> = {
  winners: { label: "Winners Bracket", icon: <Trophy className="h-3.5 w-3.5" /> },
  losers: { label: "Losers Bracket", icon: <Swords className="h-3.5 w-3.5" /> },
  grand_final: { label: "Grand Final", icon: <Crown className="h-3.5 w-3.5" /> },
  round_robin: { label: "Round Robin", icon: <Trophy className="h-3.5 w-3.5" /> },
}

function roundLabel(bracketType: BracketType, round: number, roundsInSection: number) {
  if (bracketType === "grand_final") return round > 1 ? "Bracket Reset" : "Grand Final"
  const fromEnd = roundsInSection - round
  if (bracketType === "winners" || bracketType === "losers") {
    if (fromEnd === 0) return "Final"
    if (fromEnd === 1) return "Semifinal"
    if (fromEnd === 2) return "Quarterfinal"
  }
  return `Round ${round}`
}

function groupFixtures(fixtures: FixtureRow[]) {
  const bySection = new Map<BracketType, Map<number, FixtureRow[]>>()

  fixtures.forEach((f) => {
    const section = bySection.get(f.bracketType) ?? new Map<number, FixtureRow[]>()
    const roundList = section.get(f.round) ?? []
    roundList.push(f)
    section.set(f.round, roundList)
    bySection.set(f.bracketType, section)
  })

  return SECTION_ORDER.filter((s) => bySection.has(s)).map((section) => {
    const roundsMap = bySection.get(section)!
    const roundNumbers = [...roundsMap.keys()].sort((a, b) => a - b)
    return {
      section,
      rounds: roundNumbers.map((r) => ({
        round: r,
        label: roundLabel(section, r, roundNumbers.length),
        fixtures: roundsMap.get(r)!,
      })),
    }
  })
}

/* ────────────────────────────────────────────────────────────────── */
/*  STATUS PILL                                                            */
/* ────────────────────────────────────────────────────────────────── */

function FixtureStatusPill({ fixture }: { fixture: FixtureRow }) {
  const teamsReady = !!fixture.teamAId && !!fixture.teamBId

  if (!teamsReady) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded-full border border-white/10 text-gray-500 bg-white/[0.02]">
        <Clock className="h-2.5 w-2.5" /> Waiting
      </span>
    )
  }
  if (fixture.status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded-full border border-green-500/30 text-green-400 bg-green-500/[0.06]">
        <CheckCircle2 className="h-2.5 w-2.5" /> Completed
      </span>
    )
  }
  if (fixture.overlayMatchId) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded-full border border-gold/30 text-gold bg-gold/[0.06]">
        <CircleDot className="h-2.5 w-2.5" /> Linked
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded-full border border-blue-500/30 text-blue-400 bg-blue-500/[0.06]">
      Ready
    </span>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  TEAM ROW — read-only: name, score if recorded, winner crown if set.     */
/*  Nothing here writes a result — that only happens on the Bracket tab.    */
/* ────────────────────────────────────────────────────────────────── */

function TeamRow({
  name,
  score,
  isWinner,
  filled,
}: {
  name: string | null
  score: number | null | undefined
  isWinner: boolean
  filled: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={`text-sm truncate flex items-center gap-1.5 ${
          !filled
            ? "text-gray-600 italic"
            : isWinner
              ? "text-white font-bold"
              : "text-gray-300"
        }`}
      >
        {isWinner && <Crown className="h-3 w-3 text-gold shrink-0" />}
        {name ?? "TBD"}
      </span>
      {score != null && (
        <span className={`text-xs font-mono shrink-0 ${isWinner ? "text-gold font-bold" : "text-gray-500"}`}>
          {score}
        </span>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  FIXTURE CARD — display + match linking only. No result form: results   */
/*  are read here exactly as the Bracket tab last saved them, and a link    */
/*  to that tab is offered once a result exists to edit, in case someone    */
/*  needs to correct one from this screen.                                  */
/* ────────────────────────────────────────────────────────────────── */

function FixtureCard({
  fixture,
  tournamentId,
  busy,
  showError,
  errorMsg,
  confirmingDelete,
  onCreateMatch,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  fixture: FixtureRow
  tournamentId: string
  busy: boolean
  showError: boolean
  errorMsg: string | null
  confirmingDelete: boolean
  onCreateMatch: () => void
  onStartDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}) {
  const teamsReady = !!fixture.teamAId && !!fixture.teamBId
  const isCompleted = fixture.status === "completed"

  return (
    <div
      className={`border rounded-lg p-4 transition-colors ${
        isCompleted
          ? "border-green-500/15 bg-green-500/[0.02]"
          : teamsReady
            ? "border-gold/15 bg-white/[0.02] hover:border-gold/30"
            : "border-white/5 bg-white/[0.01]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <FixtureStatusPill fixture={fixture} />
      </div>

      <div className="space-y-1.5 mb-1">
        <TeamRow
          name={fixture.teamAName}
          score={fixture.scoreA}
          isWinner={!!fixture.winnerTeamId && fixture.winnerTeamId === fixture.teamAId}
          filled={!!fixture.teamAId}
        />
        <div className="h-px bg-white/5" />
        <TeamRow
          name={fixture.teamBName}
          score={fixture.scoreB}
          isWinner={!!fixture.winnerTeamId && fixture.winnerTeamId === fixture.teamBId}
          filled={!!fixture.teamBId}
        />
      </div>

      {/* Actions — match creation / linking / unlinking only. Recording
          or editing a result happens on the Bracket tab. */}
      <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-white/5">
        {!teamsReady && <span className="text-gray-600 text-xs italic">Waiting on an earlier result</span>}

        {teamsReady && !fixture.overlayMatchId && !isCompleted && (
          <Button
            size="sm"
            disabled={busy}
            onClick={onCreateMatch}
            className="bg-gold hover:bg-gold/90 text-black font-bold h-7 text-xs px-2.5"
          >
            <Plus className="mr-1 h-3 w-3" />
            {busy ? "Creating…" : "Create Match"}
          </Button>
        )}

        {fixture.overlayMatchId && (
          <>
            <Link
              href={`/match/${fixture.overlayMatchId}/edit`}
              className="flex items-center gap-1 text-gold text-xs font-cinzel uppercase tracking-wide hover:underline"
            >
              <Pencil className="h-3 w-3" /> Edit Match
            </Link>
            {confirmingDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 text-xs">Remove?</span>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={onConfirmDelete}
                  className="bg-red-600/80 hover:bg-red-600 text-white text-xs h-6 px-2"
                >
                  {busy ? "…" : "Confirm"}
                </Button>
                <Button
                  size="sm"
                  onClick={onCancelDelete}
                  className="bg-transparent hover:bg-white/5 text-gray-400 border border-white/15 text-xs h-6 px-2"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                onClick={onStartDelete}
                title="Unlink match"
                className="text-gray-500 hover:text-red-400 ml-auto"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}

        {/* Once a result exists (or teams are ready but no result yet),
            point back at the Bracket tab instead of duplicating a result
            form here — single source of truth for recording results. */}
        {teamsReady && !confirmingDelete && (
          <Link
            href={`/tournaments/${tournamentId}/bracket/edit`}
            className="flex items-center gap-1 text-gray-500 hover:text-gold text-xs ml-auto shrink-0"
            title={isCompleted ? "Edit result on the Bracket tab" : "Record result on the Bracket tab"}
          >
            {isCompleted ? "Edit result" : "Record result"}
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {showError && (
        <p className="flex items-center gap-1.5 text-red-500 text-xs mt-2">
          <AlertCircle className="h-3.5 w-3.5" /> {errorMsg}
        </p>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  ROUND GROUP                                                            */
/* ────────────────────────────────────────────────────────────────── */

function RoundGroup({
  label,
  fixtures,
  defaultOpen,
  renderCard,
}: {
  label: string
  fixtures: FixtureRow[]
  defaultOpen: boolean
  renderCard: (f: FixtureRow) => React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const allCompleted = fixtures.every((f) => f.status === "completed")

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 mb-2.5 group"
      >
        <span className="text-[11px] font-cinzel uppercase tracking-widest text-gray-400 group-hover:text-gold transition-colors">
          {label}
        </span>
        <span className="text-gray-700 text-[11px]">({fixtures.length})</span>
        {allCompleted && <CheckCircle2 className="h-3 w-3 text-green-500/60" />}
        <span className="flex-1 h-px bg-white/5" />
        <ChevronDown
          className={`h-3.5 w-3.5 text-gray-600 group-hover:text-gold transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-3 mb-5">
          {fixtures.map(renderCard)}
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  FIXTURES SECTION                                                       */
/* ────────────────────────────────────────────────────────────────── */

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

  const grouped = useMemo(() => groupFixtures(fixtures), [fixtures])

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

  const renderCard = (f: FixtureRow) => (
    <FixtureCard
      key={f.id}
      fixture={f}
      tournamentId={tournamentId}
      busy={busyId === f.id}
      showError={errorId === f.id}
      errorMsg={errorMsg}
      confirmingDelete={confirmDeleteId === f.id}
      onCreateMatch={() => runAction(f.id, () => createMatchForFixture(f, orgId, tournamentId))}
      onStartDelete={() => setConfirmDeleteId(f.id)}
      onCancelDelete={() => setConfirmDeleteId(null)}
      onConfirmDelete={() =>
        runAction(f.id, () => unlinkAndDeleteFixtureMatch(f.id, f.overlayMatchId!)).then(() =>
          setConfirmDeleteId(null)
        )
      }
    />
  )

  return (
    <div>
      <h3 className="flex items-center gap-2 text-white font-bold font-cinzel text-sm mb-1">
        <Trophy className="h-4 w-4 text-gold" />
        Bracket Fixtures
      </h3>
      <p className="text-gray-500 text-xs mb-5">
        A match is created and linked automatically as soon as both of a fixture's teams are known.
        "Create Match" only shows up if that didn't happen for some reason. Results are recorded on
        the <span className="text-gold">Bracket</span> tab, not here.
      </p>

      <div className="space-y-7">
        {grouped.map(({ section, rounds }) => (
          <div key={section}>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center h-6 w-6 rounded-md bg-gold/10 border border-gold/20 text-gold shrink-0">
                {SECTION_META[section].icon}
              </span>
              <h4 className="text-xs font-cinzel uppercase tracking-widest text-gold/80">
                {SECTION_META[section].label}
              </h4>
            </div>
            <div className="pl-1 border-l border-gold/10 ml-3 space-y-1">
              <div className="pl-4">
                {rounds.map(({ round, label, fixtures: roundFixtures }) => (
                  <RoundGroup
                    key={round}
                    label={label}
                    fixtures={roundFixtures}
                    defaultOpen={roundFixtures.some((f) => f.status !== "completed")}
                    renderCard={renderCard}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}