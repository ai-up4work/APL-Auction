"use client"

import { useEffect, useState } from "react"
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  UserPlus,
  Shield,
  Link2,
  Users,
  Crown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  getSquadBoardsForOrg,
  createSquadBoard,
  deleteSquadBoard,
  getTeamPool,
  assignPoolTeamToSquadBoard,
  getTeamsForAuction,
  getPlayerBank,
  assignBankPlayerToSquadBoardTeam,
  getTeamRoster,
  type OrgSummary,
  type SquadBoard,
  type PoolTeam,
  type AuctionTeamOption,
  type BankPlayer,
  type TeamRosterPlayer,
} from "@/lib/organization/organization"

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-black/50 border border-gold/20 shine hover:border-gold/40 transition-all duration-300 rounded-lg p-6 md:p-8 shadow-lg shadow-black/40 ${className}`}
    >
      {children}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  SQUAD BOARD — a named container backed by a synthetic auction. Lets   */
/*  you assign the same Team Pool team into many Squad Boards, and the    */
/*  same Player Bank player onto many teams (same board or different       */
/*  ones) — a genuine many-to-many, since every assignment is a fresh      */
/*  insert rather than a single-slot relationship.                        */
/* ────────────────────────────────────────────────────────────────── */

export function SquadBoardTab({ org, userId }: { org: OrgSummary; userId: string }) {
  const [selectedBoard, setSelectedBoard] = useState<SquadBoard | null>(null)

  if (selectedBoard) {
    return <SquadBoardDetail org={org} board={selectedBoard} onBack={() => setSelectedBoard(null)} />
  }

  return <SquadBoardListPanel org={org} userId={userId} onSelect={setSelectedBoard} />
}

/* ── Step 1: list / create Squad Boards ── */

function SquadBoardListPanel({
  org,
  userId,
  onSelect,
}: {
  org: OrgSummary
  userId: string
  onSelect: (b: SquadBoard) => void
}) {
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [boards, setBoards] = useState<SquadBoard[]>([])
  const [loaded, setLoaded] = useState(false)

  const [name, setName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const reload = () => getSquadBoardsForOrg(org.id).then((b) => setBoards(b))

  useEffect(() => {
    reload().then(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  const handleCreate = async () => {
    if (!name.trim()) return
    setIsCreating(true)
    setCreateError(null)
    // NOTE: the second argument MUST be the signed-in user's id (userId),
    // not org.id — auctions.created_by has a foreign key to auth.users,
    // so passing org.id here throws a 23503 "auctions_created_by_fkey"
    // violation.
    const id = await createSquadBoard(org.id, userId, name.trim())
    setIsCreating(false)
    if (!id) {
      setCreateError("Couldn't create the Squad Board — please try again.")
      return
    }
    setName("")
    await reload()
  }

  const handleDelete = async (board: SquadBoard) => {
    const ok = await confirm({
      title: "Delete this Squad Board?",
      description: `"${board.name}" will be permanently deleted. This fails if it still has teams or players on it — remove those first.`,
      confirmText: "Delete Squad Board",
      tone: "danger",
    })
    if (!ok) return

    setDeletingId(board.id)
    setDeleteError(null)
    const result = await deleteSquadBoard(board.id)
    setDeletingId(null)
    if (!result.ok) {
      setDeleteError(result.error ?? "Couldn't delete that Squad Board — please try again.")
      return
    }
    setBoards((prev) => prev.filter((b) => b.id !== board.id))
  }

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-1 flex items-center gap-2">
          <Plus className="h-4 w-4 text-gold" /> Create a Squad Board
        </h2>
        <p className="text-gray-500 text-xs mb-4">
          A Squad Board is its own space for assigning teams and players — the same Team Pool team or Player Bank
          player can be added to as many Squad Boards (and as many teams within a board) as you like.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Season 2 — Squad Planning"
            className="bg-black/50 border-gold/30 text-white flex-1"
          />
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="mr-2 h-4 w-4" />
            {isCreating ? "Creating…" : "Create Squad Board"}
          </Button>
        </div>
        {createError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mt-3">
            <AlertCircle className="h-4 w-4" /> {createError}
          </p>
        )}
      </Panel>

      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4">Your Squad Boards</h2>
        {deleteError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mb-3">
            <AlertCircle className="h-4 w-4" /> {deleteError}
          </p>
        )}
        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : boards.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No Squad Boards yet — create one above.</p>
        ) : (
          <div className="space-y-2">
            {boards.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 bg-white/[0.02] border border-gold/10 hover:border-gold/40 rounded-md px-4 py-3 transition-colors"
              >
                <button onClick={() => onSelect(b)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                  <div className="bg-gold/20 p-2 rounded-lg shrink-0">
                    <Users className="h-4 w-4 text-gold" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{b.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">Open to assign teams &amp; players</p>
                  </div>
                </button>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => onSelect(b)} className="text-gray-500 hover:text-gold transition-colors">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(b)}
                    disabled={deletingId === b.id}
                    className="bg-transparent border-none outline-none text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    {deletingId === b.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {ConfirmDialogElement}
    </div>
  )
}

/* ── Step 2: inside a Squad Board — assign teams, then assign players onto them ── */

function SquadBoardDetail({ org, board, onBack }: { org: OrgSummary; board: SquadBoard; onBack: () => void }) {
  const [teams, setTeams] = useState<AuctionTeamOption[]>([])
  const [teamsLoaded, setTeamsLoaded] = useState(false)

  const reloadTeams = () => getTeamsForAuction(board.id).then((t) => setTeams(t))

  useEffect(() => {
    reloadTeams().then(() => setTeamsLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id])

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-gray-400 hover:text-gold"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All Squad Boards
      </button>

      <div className="flex items-center gap-3">
        <div className="bg-gold/20 p-2.5 rounded-lg">
          <Users className="h-5 w-5 text-gold" />
        </div>
        <h2 className="text-xl font-bold text-white font-cinzel">{board.name}</h2>
      </div>

      <AssignTeamPanel org={org} board={board} onAssigned={reloadTeams} />

      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-1 flex items-center gap-2">
          <Shield className="h-4 w-4 text-gold" /> Teams on this Squad Board
        </h2>
        <p className="text-gray-500 text-xs mb-4">
          Assign Player Bank players onto any team below. A player can be assigned to more than one team, here or on
          another Squad Board.
        </p>
        {!teamsLoaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : teams.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No teams assigned to this Squad Board yet — add one above.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {teams.map((t) => (
              <SquadBoardTeamCard key={t.id} org={org} board={board} team={t} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

/* ── Assign a Team Pool entry onto the current Squad Board ── */

function AssignTeamPanel({
  org,
  board,
  onAssigned,
}: {
  org: OrgSummary
  board: SquadBoard
  onAssigned: () => void
}) {
  const [poolTeams, setPoolTeams] = useState<PoolTeam[]>([])
  const [loaded, setLoaded] = useState(false)
  const [poolTeamId, setPoolTeamId] = useState("")
  const [isAssigning, setIsAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    getTeamPool(org.id).then((t) => {
      setPoolTeams(t)
      setLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  const handleAssign = async () => {
    const poolTeam = poolTeams.find((t) => t.id === poolTeamId)
    if (!poolTeam) return
    setIsAssigning(true)
    setError(null)
    setSuccess(null)
    const result = await assignPoolTeamToSquadBoard(poolTeam, board)
    setIsAssigning(false)
    if (!result.ok) {
      setError(result.error ?? "Couldn't assign this team.")
      return
    }
    setSuccess(`${poolTeam.name} was added to this Squad Board.`)
    setPoolTeamId("")
    onAssigned()
  }

  return (
    <Panel>
      <h2 className="text-lg font-bold text-white font-cinzel mb-1 flex items-center gap-2">
        <Link2 className="h-4 w-4 text-gold" /> Assign a Team Pool Team
      </h2>
      <p className="text-gray-500 text-xs mb-4">
        Copies a Team Pool team onto this Squad Board. The pool entry itself stays untouched, so it can also be
        assigned onto other Squad Boards or real auctions.
      </p>

      {!loaded ? (
        <p className="text-gray-500 text-sm flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : poolTeams.length === 0 ? (
        <p className="text-gray-500 text-sm italic">
          No teams in the pool yet — add one from the <span className="text-gold">Team Pool</span> tab first.
        </p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <select
              value={poolTeamId}
              onChange={(e) => setPoolTeamId(e.target.value)}
              className="w-full sm:flex-1 bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5"
            >
              <option value="">Select a team…</option>
              {poolTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
            <Button
              onClick={handleAssign}
              disabled={!poolTeamId || isAssigning}
              className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50 whitespace-nowrap"
            >
              {isAssigning ? "Assigning…" : "Assign Team"}
            </Button>
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4" /> {error}
            </p>
          )}
          {success && (
            <p className="flex items-center gap-1.5 text-green-400 text-sm">
              <CheckCircle2 className="h-4 w-4" /> {success}
            </p>
          )}
        </>
      )}
    </Panel>
  )
}

/* ── One team's card on a Squad Board: its current players + an inline    */
/*    "assign a bank player onto this team" control                       */

function SquadBoardTeamCard({ org, board, team }: { org: OrgSummary; board: SquadBoard; team: AuctionTeamOption }) {
  const [players, setPlayers] = useState<TeamRosterPlayer[]>([])
  const [playersLoaded, setPlayersLoaded] = useState(false)

  const [bankPlayers, setBankPlayers] = useState<BankPlayer[]>([])
  const [bankLoaded, setBankLoaded] = useState(false)

  const [bankPlayerId, setBankPlayerId] = useState("")
  const [isCaptain, setIsCaptain] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reloadRoster = () => getTeamRoster(team.id).then((p) => setPlayers(p))

  useEffect(() => {
    reloadRoster().then(() => setPlayersLoaded(true))
    getPlayerBank(org.id).then((p) => {
      setBankPlayers(p)
      setBankLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id, org.id])

  const handleAssign = async () => {
    const bankPlayer = bankPlayers.find((p) => p.id === bankPlayerId)
    if (!bankPlayer) return
    setIsAssigning(true)
    setError(null)
    const result = await assignBankPlayerToSquadBoardTeam(bankPlayer, team, board, isCaptain)
    setIsAssigning(false)
    if (!result.ok) {
      setError(result.error ?? "Couldn't assign this player.")
      return
    }
    setBankPlayerId("")
    setIsCaptain(false)
    await reloadRoster()
  }

  return (
    <div className="bg-white/[0.02] border border-gold/10 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 rounded-full flex-shrink-0 border border-white/10 overflow-hidden flex items-center justify-center bg-black/60">
          {team.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <Shield className="h-3.5 w-3.5 text-gray-500" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold truncate">{team.name}</p>
          <p className="text-gray-500 text-xs">{team.code}</p>
        </div>
      </div>

      {!playersLoaded ? (
        <p className="text-gray-500 text-xs flex items-center gap-2 mb-3">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading roster…
        </p>
      ) : players.length === 0 ? (
        <p className="text-gray-500 text-xs italic mb-3">No players assigned yet.</p>
      ) : (
        <div className="space-y-1 mb-3">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 text-xs text-gray-300">
              {p.isCaptain && <Crown className="h-3 w-3 text-gold shrink-0" />}
              <span className="truncate">{p.name}</span>
              <span className="text-gray-600">· {p.role}</span>
            </div>
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-white/5">
        {!bankLoaded ? (
          <p className="text-gray-500 text-xs flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading player bank…
          </p>
        ) : bankPlayers.length === 0 ? (
          <p className="text-gray-500 text-xs italic">
            No players in the bank yet — add one from the <span className="text-gold">Player Bank</span> tab.
          </p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2 mb-2">
              <select
                value={bankPlayerId}
                onChange={(e) => setBankPlayerId(e.target.value)}
                className="w-full sm:flex-1 bg-black/50 border border-gold/30 rounded-md text-white text-xs px-2.5 py-2"
              >
                <option value="">Select a player…</option>
                {bankPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.role}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleAssign}
                disabled={!bankPlayerId || isAssigning}
                className="bg-gold hover:bg-gold/90 text-black text-xs font-bold disabled:opacity-50 whitespace-nowrap h-9 px-3"
              >
                <UserPlus className="mr-1.5 h-3 w-3" />
                {isAssigning ? "Adding…" : "Add"}
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" checked={isCaptain} onChange={(e) => setIsCaptain(e.target.checked)} />
              Make captain
            </label>
            {error && (
              <p className="flex items-center gap-1.5 text-red-500 text-xs mt-2">
                <AlertCircle className="h-3.5 w-3.5" /> {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}