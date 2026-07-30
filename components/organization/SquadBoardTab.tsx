"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  UserPlus,
  Shield,
  Link2,
  Users,
  Crown,
  FolderOpen,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  getSquadBoardsWithPreviewForOrg,
  createSquadBoard,
  deleteSquadBoard,
  getTeamPool,
  assignPoolTeamToSquadBoard,
  getTeamsForAuction,
  getPlayerBank,
  assignBankPlayerToSquadBoardTeam,
  getTeamRoster,
  getAssignedBankPlayerIdsForBoard,
  getAssignedPoolTeamIdsForBoard,
  type OrgSummary,
  type SquadBoard,
  type SquadBoardPreview,
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

function AvailabilityHint({ count, noun }: { count: number; noun: string }) {
  if (count > 0) return null
  return <p className="text-gray-500 text-xs italic">All {noun} on this board are already assigned.</p>
}

/* ────────────────────────────────────────────────────────────────── */
/*  EYEBROW — small catalog-style label used above section headings,     */
/*  reinforcing the "ledger / dossier" language established below.       */
/* ────────────────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.2em] font-cinzel text-gold/60 mb-2 flex items-center gap-1.5">
      <span className="text-gold/40">◆</span> {children}
    </p>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  PICKER CARDS — exported so other tabs (e.g. AuctionsTab's           */
/*  "pre-fill teams & players" flow at auction-creation time) can reuse  */
/*  the exact same selectable-tile UI instead of re-implementing it.     */
/* ────────────────────────────────────────────────────────────────── */

export function PoolTeamPickerCard({
  team,
  selected,
  onSelect,
}: {
  team: PoolTeam
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-2.5 text-left rounded-md border px-2.5 py-2 transition-colors ${
        selected ? "border-gold bg-gold/10" : "border-white/10 bg-black/40 hover:border-gold/40"
      }`}
    >
      <div
        className="h-8 w-8 rounded-full flex-shrink-0 border border-white/10 overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: team.color || "#e45d35" }}
      >
        {team.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logo} alt="" className="h-full w-full object-cover" />
        ) : (
          <Shield className="h-3.5 w-3.5 text-white/70" />
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-semibold truncate ${selected ? "text-gold" : "text-white"}`}>{team.name}</p>
        <p className="text-gray-500 text-[10px]">{team.code}</p>
      </div>
    </button>
  )
}

export function BankPlayerPickerCard({
  player,
  selected,
  onSelect,
}: {
  player: BankPlayer
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-2.5 text-left rounded-md border px-2.5 py-2 transition-colors ${
        selected ? "border-gold bg-gold/10" : "border-white/10 bg-black/40 hover:border-gold/40"
      }`}
    >
      <div className="relative h-8 w-8 rounded-full flex-shrink-0 border border-white/10 overflow-hidden flex items-center justify-center bg-black/60">
        {player.img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.img} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserPlus className="h-3.5 w-3.5 text-white/40" />
        )}
        {player.capped && (
          <span className="absolute -bottom-0.5 -right-0.5 bg-gold rounded-full p-[1px] border border-black/60">
            <Crown className="h-2 w-2 text-black" />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-semibold truncate ${selected ? "text-gold" : "text-white"}`}>{player.name}</p>
        <p className="text-gray-500 text-[10px] truncate">{player.role}</p>
      </div>
    </button>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  LOGO FAN — the "peeking out of the folder" stack of team logos on    */
/*  each board's folder card. Each tile overlaps the previous one and     */
/*  carries a slight alternating rotation so it reads as a loose stack    */
/*  of cards rather than a rigid grid. Caps at 4 tiles; an empty board    */
/*  gets a dashed placeholder circle instead of an empty fan.             */
/* ────────────────────────────────────────────────────────────────── */

const LOGO_FAN_MAX = 4
const LOGO_FAN_ROTATIONS = [-9, -3, 4, 10]
const LOGO_FAN_LIFTS = [0, -3, 0, -3]

function LogoFan({ logos }: { logos: string[] }) {
  if (logos.length === 0) {
    return (
      <div className="relative h-12 w-12 rounded-full border-2 border-dashed border-gold/20 flex items-center justify-center bg-black/30 shrink-0">
        <div className="absolute inset-1 rounded-full border border-dashed border-gold/10" />
        <Users className="h-4 w-4 text-gold/25" />
      </div>
    )
  }

  const visible = logos.slice(0, LOGO_FAN_MAX)
  const overflow = logos.length - visible.length

  return (
    <div className="flex items-center h-12 shrink-0">
      {visible.map((logo, i) => (
        <div
          key={i}
          className="h-10 w-10 rounded-full border-2 border-black/80 bg-black/70 overflow-hidden shadow-md shadow-black/60 first:ml-0"
          style={{
            marginLeft: i === 0 ? 0 : -14,
            transform: `rotate(${LOGO_FAN_ROTATIONS[i] ?? 0}deg) translateY(${LOGO_FAN_LIFTS[i] ?? 0}px)`,
            zIndex: visible.length - i,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="h-10 w-10 rounded-full border-2 border-black/80 bg-gold/10 flex items-center justify-center shrink-0"
          style={{ marginLeft: -14, zIndex: 0 }}
        >
          <span className="text-[10px] font-cinzel font-bold text-gold/80">+{overflow}</span>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  SEAL BADGE — a small stamped medallion that stands in for the        */
/*  plain "open folder" icon on each dossier card. Warms up on hover      */
/*  to suggest a seal catching the light.                                 */
/* ────────────────────────────────────────────────────────────────── */

function SealBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative h-9 w-9 rounded-full border-2 border-gold/40 bg-gradient-to-br from-gold/20 via-gold/5 to-transparent flex items-center justify-center shadow-inner shrink-0 transition-colors duration-300 ${className}`}
    >
      <div className="absolute inset-[3px] rounded-full border border-gold/25" />
      <Shield className="h-4 w-4 text-gold/70" />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  STAT CHIP — insignia-style pill for team/player counts.               */
/* ────────────────────────────────────────────────────────────────── */

function StatChip({ icon, label, muted = false }: { icon: React.ReactNode; label: string; muted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-cinzel px-2 py-1 rounded-full border ${
        muted ? "border-white/15 text-gray-400 bg-white/[0.02]" : "border-gold/30 text-gold/80 bg-gold/[0.06]"
      }`}
    >
      {icon}
      {label}
    </span>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  RIBBON TAB — replaces the flat gold tab with a die-cut ribbon         */
/*  bearing a catalog number, so each board reads as an entry in a        */
/*  numbered ledger rather than an arbitrary folder.                      */
/* ────────────────────────────────────────────────────────────────── */

function RibbonTab({ index }: { index: number }) {
  return (
    <div
      className="absolute -top-3 left-5 h-6 min-w-[3rem] px-2.5 bg-gradient-to-b from-gold/95 to-gold/70 flex items-center justify-center shadow-md shadow-black/50 z-10"
      style={{ clipPath: "polygon(0 0, 100% 0, 100% 68%, 50% 100%, 0 68%)" }}
    >
      <span className="text-[9px] font-cinzel font-bold tracking-widest text-black/70">
        №{String(index).padStart(2, "0")}
      </span>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  FOLDER CARD — the Squad Board list item, restyled as a numbered       */
/*  dossier: a ribbon tag replaces the flat tab, a wax-seal medallion      */
/*  replaces the plain folder icon, and stat pills read as insignia.      */
/* ────────────────────────────────────────────────────────────────── */

function FolderCard({
  board,
  index,
  onOpen,
  onDelete,
  deleting,
}: {
  board: SquadBoardPreview
  index: number
  onOpen: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className="relative group">
      <RibbonTab index={index} />

      <div className="relative bg-black/50 border border-gold/20 group-hover:border-gold/50 transition-all duration-300 rounded-lg rounded-tl-none p-5 shadow-lg shadow-black/40 group-hover:shadow-gold/10 group-hover:-translate-y-0.5">
        <button onClick={onOpen} className="w-full text-left">
          <div className="flex items-start justify-between gap-3 mb-4">
            <LogoFan logos={board.teamLogos} />
            <SealBadge className="group-hover:border-gold/70 group-hover:from-gold/35" />
          </div>

          <p className="text-white text-sm font-bold font-cinzel truncate mb-2">{board.name}</p>
          <div className="h-px w-10 bg-gold/30 mb-2.5" />

          {board.teamCount === 0 ? (
            <p className="text-gray-500 text-xs italic">Empty — assign teams to get started</p>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <StatChip
                icon={<Shield className="h-2.5 w-2.5" />}
                label={`${board.teamCount} team${board.teamCount === 1 ? "" : "s"}`}
              />
              <StatChip
                icon={<UserPlus className="h-2.5 w-2.5" />}
                label={`${board.playerCount} player${board.playerCount === 1 ? "" : "s"}`}
                muted
              />
            </div>
          )}
        </button>

        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-double border-gold/15">
          <div className="flex items-center gap-2">
            <button
              onClick={onOpen}
              className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-gray-400 hover:text-gold transition-colors"
            >
              Open <FolderOpen className="h-3 w-3" />
            </button>
            <button
              onClick={() => window.open(`/squad-board/results/${board.id}`, '_blank')}
              title="View public results"
              className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-gray-400 hover:text-gold transition-colors"
            >
              Results <BarChart3 className="h-3 w-3" />
            </button>
          </div>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="bg-transparent border-none outline-none text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  SQUAD BOARD — a named container backed by a synthetic auction.        */
/*  See detail-view components below for the assignment logic.            */
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
  const [boards, setBoards] = useState<SquadBoardPreview[]>([])
  const [loaded, setLoaded] = useState(false)

  const [name, setName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const reload = () => getSquadBoardsWithPreviewForOrg(org.id).then((b) => setBoards(b))

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

  const handleDelete = async (board: SquadBoardPreview) => {
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
        <Eyebrow>New Dossier</Eyebrow>
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
            className="bg-black/50 border-gold/30 text-white flex-1 focus-visible:ring-gold/40"
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

      <div>
        <div className="flex items-baseline justify-between gap-3 mb-4 px-1">
          <h2 className="text-lg font-bold text-white font-cinzel">Your Squad Boards</h2>
          {loaded && boards.length > 0 && (
            <span className="text-[10px] uppercase tracking-widest font-cinzel text-gold/50">
              {boards.length} catalogued
            </span>
          )}
        </div>
        {deleteError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mb-3 px-1">
            <AlertCircle className="h-4 w-4" /> {deleteError}
          </p>
        )}
        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2 px-1">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : boards.length === 0 ? (
          <Panel>
            <div className="flex flex-col items-center text-center py-4">
              <SealBadge className="h-12 w-12 mb-3 opacity-60" />
              <p className="text-gray-400 text-sm font-cinzel">No Squad Boards yet</p>
              <p className="text-gray-600 text-xs italic mt-1">Create one above to start a new dossier.</p>
            </div>
          </Panel>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2.5">
            {boards.map((b, i) => (
              <FolderCard
                key={b.id}
                board={b}
                index={i + 1}
                onOpen={() => onSelect(b)}
                onDelete={() => handleDelete(b)}
                deleting={deletingId === b.id}
              />
            ))}
          </div>
        )}
      </div>

      {ConfirmDialogElement}
    </div>
  )
}

/* ── Step 2: inside a Squad Board — assign teams, then assign players onto them ── */

function SquadBoardDetail({ org, board, onBack }: { org: OrgSummary; board: SquadBoard; onBack: () => void }) {
  const [teams, setTeams] = useState<AuctionTeamOption[]>([])
  const [teamsLoaded, setTeamsLoaded] = useState(false)

  const [assignedPoolTeamIds, setAssignedPoolTeamIds] = useState<string[]>([])
  const [assignedBankPlayerIds, setAssignedBankPlayerIds] = useState<string[]>([])

  const reloadTeams = () => getTeamsForAuction(board.id).then((t) => setTeams(t))
  const reloadAssignedPoolTeamIds = () => getAssignedPoolTeamIdsForBoard(board.id).then(setAssignedPoolTeamIds)
  const reloadAssignedBankPlayerIds = () => getAssignedBankPlayerIdsForBoard(board.id).then(setAssignedBankPlayerIds)

  const reloadAll = () =>
    Promise.all([reloadTeams(), reloadAssignedPoolTeamIds(), reloadAssignedBankPlayerIds()])

  useEffect(() => {
    reloadAll().then(() => setTeamsLoaded(true))
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
        <SealBadge className="h-11 w-11" />
        <h2 className="text-xl font-bold text-white font-cinzel">{board.name}</h2>
      </div>

      <AssignTeamPanel org={org} board={board} assignedPoolTeamIds={assignedPoolTeamIds} onAssigned={reloadAll} />

      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-1 flex items-center gap-2">
          <Shield className="h-4 w-4 text-gold" /> Teams on this Squad Board
        </h2>
        <p className="text-gray-500 text-xs mb-4">
          Assign Player Bank players onto any team below. A player already assigned somewhere on this board won't
          show up again in any team's picker — they can still go on another Squad Board, though.
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
              <SquadBoardTeamCard
                key={t.id}
                org={org}
                board={board}
                team={t}
                assignedBankPlayerIds={assignedBankPlayerIds}
                onAssigned={reloadAll}
              />
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
  assignedPoolTeamIds,
  onAssigned,
}: {
  org: OrgSummary
  board: SquadBoard
  assignedPoolTeamIds: string[]
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

  const availableTeams = useMemo(
    () => poolTeams.filter((t) => !assignedPoolTeamIds.includes(t.id)),
    [poolTeams, assignedPoolTeamIds]
  )

  const handleAssign = async () => {
    const poolTeam = availableTeams.find((t) => t.id === poolTeamId)
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
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <h2 className="text-lg font-bold text-white font-cinzel flex items-center gap-2">
          <Link2 className="h-4 w-4 text-gold" /> Assign a Team Pool Team
        </h2>
        {loaded && poolTeams.length > 0 && (
          <span className="text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded border border-white/15 text-gray-400">
            {availableTeams.length} available
          </span>
        )}
      </div>
      <p className="text-gray-500 text-xs mb-4">
        Copies a Team Pool team onto this Squad Board. The pool entry itself stays untouched, so it can also be
        assigned onto other Squad Boards or real auctions. A team already on this board won't show up here again.
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-3 max-h-64 overflow-y-auto pr-1">
            {availableTeams.map((t) => (
              <PoolTeamPickerCard
                key={t.id}
                team={t}
                selected={poolTeamId === t.id}
                onSelect={() => setPoolTeamId(poolTeamId === t.id ? "" : t.id)}
              />
            ))}
          </div>
          <AvailabilityHint count={availableTeams.length} noun="pool teams" />
          <Button
            onClick={handleAssign}
            disabled={!poolTeamId || isAssigning}
            className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50 whitespace-nowrap mt-1"
          >
            {isAssigning ? "Assigning…" : "Assign Team"}
          </Button>
          {error && (
            <p className="flex items-center gap-1.5 text-red-500 text-sm mt-3">
              <AlertCircle className="h-4 w-4" /> {error}
            </p>
          )}
          {success && (
            <p className="flex items-center gap-1.5 text-green-400 text-sm mt-3">
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

function SquadBoardTeamCard({
  org,
  board,
  team,
  assignedBankPlayerIds,
  onAssigned,
}: {
  org: OrgSummary
  board: SquadBoard
  team: AuctionTeamOption
  assignedBankPlayerIds: string[]
  onAssigned: () => void
}) {
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

  const availablePlayers = useMemo(
    () => bankPlayers.filter((p) => !assignedBankPlayerIds.includes(p.id)),
    [bankPlayers, assignedBankPlayerIds]
  )

  const handleAssign = async () => {
    const bankPlayer = availablePlayers.find((p) => p.id === bankPlayerId)
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
    onAssigned()
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
        <div className="grid grid-cols-2 gap-2 mb-3">
          {players.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 bg-black/30 border border-white/5 rounded-md px-2 py-1.5"
            >
              <div className="relative h-6 w-6 rounded-full flex-shrink-0 border border-white/10 overflow-hidden flex items-center justify-center bg-black/60">
                {p.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.img} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserPlus className="h-2.5 w-2.5 text-white/40" />
                )}
                {p.isCaptain && (
                  <span className="absolute -bottom-0.5 -right-0.5 bg-gold rounded-full p-[1px] border border-black/60">
                    <Crown className="h-2 w-2 text-black" />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-200 truncate">{p.name}</p>
                <p className="text-[10px] text-gray-600 truncate">{p.role}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-white/5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[10px] uppercase tracking-widest text-gold/70 font-cinzel">Add a Bank Player</p>
          {bankLoaded && bankPlayers.length > 0 && (
            <span className="text-[10px] uppercase tracking-widest font-cinzel px-1.5 py-0.5 rounded border border-white/15 text-gray-500">
              {availablePlayers.length} available
            </span>
          )}
        </div>
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
            <div className="grid grid-cols-2 gap-1.5 mb-2 max-h-40 overflow-y-auto pr-1">
              {availablePlayers.map((p) => (
                <BankPlayerPickerCard
                  key={p.id}
                  player={p}
                  selected={bankPlayerId === p.id}
                  onSelect={() => setBankPlayerId(bankPlayerId === p.id ? "" : p.id)}
                />
              ))}
            </div>
            <AvailabilityHint count={availablePlayers.length} noun="players" />
            <label className="flex items-center gap-2 text-xs text-gray-400 mt-2 mb-2">
              <input type="checkbox" checked={isCaptain} onChange={(e) => setIsCaptain(e.target.checked)} />
              Make captain
            </label>
            <Button
              onClick={handleAssign}
              disabled={!bankPlayerId || isAssigning}
              className="bg-gold hover:bg-gold/90 text-black text-xs font-bold disabled:opacity-50 whitespace-nowrap h-9 px-3 w-full"
            >
              <UserPlus className="mr-1.5 h-3 w-3" />
              {isAssigning ? "Adding…" : "Add Player"}
            </Button>
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
