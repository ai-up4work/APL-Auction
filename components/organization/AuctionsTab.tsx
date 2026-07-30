"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Trash2, Loader2, AlertCircle, Landmark, ArrowRight, Trophy, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { Panel, FieldLabel, AuctionStatusBadge, CollapsibleCreatePanel } from "@/components/organization/shared"
import {
  getAuctionsForOrg,
  createAuctionWithPoolSeeds,
  deleteAuction,
  getTournamentsForOrg,
  getTeamPool,
  getPlayerBank,
  type OrgSummary,
  type AuctionSummary,
  type TournamentSummary,
  type PoolTeam,
  type BankPlayer,
} from "@/lib/organization/organization"
import { PoolTeamPickerCard, BankPlayerPickerCard } from "@/components/organization/SquadBoardTab"

/* ────────────────────────────────────────────────────────────────── */
/*  AUCTION CARD                                                          */
/* ────────────────────────────────────────────────────────────────── */

function AuctionCard({
  auction,
  onDelete,
  deleting,
}: {
  auction: AuctionSummary
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className="bg-black/50 border border-gold/20 hover:border-gold/40 transition-all duration-300 rounded-lg p-5 shadow-lg shadow-black/40">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="bg-gold/10 p-2 rounded-lg shrink-0">
          <Landmark className="h-4 w-4 text-gold" />
        </div>
        <AuctionStatusBadge status={auction.status} />
      </div>

      <p className="text-white text-sm font-bold font-cinzel truncate mb-1">{auction.name}</p>
      {auction.tournamentName ? (
        <p className="text-gray-500 text-xs flex items-center gap-1 truncate">
          <Trophy className="h-3 w-3 shrink-0" /> {auction.tournamentName}
        </p>
      ) : (
        <p className="text-gray-600 text-xs italic">Not linked to a tournament</p>
      )}

      <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-white/5">
        <div className="flex items-center gap-2">
          <Link
            href={`/auction/admin/${auction.id}`}
            className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-gray-400 hover:text-gold transition-colors"
          >
            Open in admin <ArrowRight className="h-3 w-3" />
          </Link>
          <button
            onClick={() => window.open(`/auction/results/${auction.id}`, '_blank')}
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
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  AUCTIONS TAB                                                          */
/* ────────────────────────────────────────────────────────────────── */

export function AuctionsTab({ org, userId }: { org: OrgSummary; userId: string }) {
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  const [auctions, setAuctions] = useState<AuctionSummary[]>([])
  const [loaded, setLoaded] = useState(false)

  const [tournaments, setTournaments] = useState<TournamentSummary[]>([])

  const [name, setName] = useState("")
  const [tournamentId, setTournamentId] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createPanelSignal, setCreatePanelSignal] = useState(0)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [poolTeams, setPoolTeams] = useState<PoolTeam[]>([])
  const [poolTeamsLoaded, setPoolTeamsLoaded] = useState(false)
  const [bankPlayers, setBankPlayers] = useState<BankPlayer[]>([])
  const [bankPlayersLoaded, setBankPlayersLoaded] = useState(false)

  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set())
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set())

  const reload = () => getAuctionsForOrg(org.id).then((a) => setAuctions(a))

  useEffect(() => {
    reload().then(() => setLoaded(true))
    getTournamentsForOrg(org.id).then(setTournaments)
    getTeamPool(org.id).then((t) => {
      setPoolTeams(t)
      setPoolTeamsLoaded(true)
    })
    getPlayerBank(org.id).then((p) => {
      setBankPlayers(p)
      setBankPlayersLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  const toggleTeam = (id: string) => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const resetPrefill = () => {
    setSelectedTeamIds(new Set())
    setSelectedPlayerIds(new Set())
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setIsCreating(true)
    setCreateError(null)

    const { id, teamErrors, playerErrors } = await createAuctionWithPoolSeeds(
      org.id,
      userId,
      { name: name.trim(), tournamentId: tournamentId || undefined },
      Array.from(selectedTeamIds),
      Array.from(selectedPlayerIds)
    )
    setIsCreating(false)
    if (!id) {
      setCreateError("Couldn't create the auction — please try again.")
      setCreatePanelSignal((v) => v + 1)
      return
    }
    if (teamErrors.length > 0 || playerErrors.length > 0) {
      setCreateError(
        [
          teamErrors.length > 0 ? `Teams not added: ${teamErrors.join(", ")}` : null,
          playerErrors.length > 0 ? `Players not added: ${playerErrors.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join(" — ")
      )
    }
    setName("")
    setTournamentId("")
    resetPrefill()
    router.push(`/auction/admin/${id}`)
  }

  const handleDelete = async (auction: AuctionSummary) => {
    const ok = await confirm({
      title: "Delete this auction?",
      description: `"${auction.name}" will be permanently deleted. This fails if it still has teams or players linked to it — remove those first.`,
      confirmText: "Delete auction",
      tone: "danger",
    })
    if (!ok) return

    setDeletingId(auction.id)
    setDeleteError(null)
    const result = await deleteAuction(auction.id)
    setDeletingId(null)
    if (!result.ok) {
      setDeleteError(result.error ?? "Couldn't delete that auction — please try again.")
      return
    }
    setAuctions((prev) => prev.filter((a) => a.id !== auction.id))
  }

  return (
    <div className="space-y-6">
      <CollapsibleCreatePanel
        title="Create an Auction"
        icon={<Landmark className="h-4 w-4 text-gold" />}
        defaultOpen={loaded && auctions.length === 0}
        openSignal={createPanelSignal}
      >
        <p className="text-gray-500 text-xs mb-4">
          Creates the auction record, then opens it directly in{" "}
          <Link href="/auction/admin" className="text-gold hover:underline">
            /auction/admin
          </Link>{" "}
          to configure teams, players, and rules.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Season 2 — Main Auction"
            className="bg-black/50 border-gold/30 text-white flex-1"
          />
          {tournaments.length > 0 && (
            <select
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              className="bg-black/50 border border-gold/30 text-white text-sm rounded-md px-3 py-2 sm:w-56"
            >
              <option value="">No tournament</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── Pre-fill: Team Pool teams (independent multi-select) ── */}
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
            <FieldLabel>Pre-fill teams from Team Pool (optional)</FieldLabel>
            {poolTeamsLoaded && poolTeams.length > 0 && (
              <span className="text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded border border-white/15 text-gray-400">
                {selectedTeamIds.size} selected
              </span>
            )}
          </div>
          <p className="text-gray-500 text-xs mb-3">
            These teams are copied onto the new auction ready to bid with — the pool entry itself is untouched.
          </p>

          {!poolTeamsLoaded ? (
            <p className="text-gray-500 text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading team pool…
            </p>
          ) : poolTeams.length === 0 ? (
            <p className="text-gray-500 text-sm italic">
              No teams in the pool yet — add some from the <span className="text-gold">Team Pool</span> tab first.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
              {poolTeams.map((t) => (
                <PoolTeamPickerCard
                  key={t.id}
                  team={t}
                  selected={selectedTeamIds.has(t.id)}
                  onSelect={() => toggleTeam(t.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Pre-fill: Player Bank players (independent multi-select) ── */}
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
            <FieldLabel>Pre-fill players from Player Bank (optional)</FieldLabel>
            {bankPlayersLoaded && bankPlayers.length > 0 && (
              <span className="text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded border border-white/15 text-gray-400">
                {selectedPlayerIds.size} selected
              </span>
            )}
          </div>
          <p className="text-gray-500 text-xs mb-3">
            These players are copied into the new auction's pool as available/unsold — not assigned to any team.
            They go through Shuffle and live bidding exactly like a player typed in by hand.
          </p>

          {!bankPlayersLoaded ? (
            <p className="text-gray-500 text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading player bank…
            </p>
          ) : bankPlayers.length === 0 ? (
            <p className="text-gray-500 text-sm italic">
              No players in the bank yet — add some from the <span className="text-gold">Player Bank</span> tab first.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
              {bankPlayers.map((p) => (
                <BankPlayerPickerCard
                  key={p.id}
                  player={p}
                  selected={selectedPlayerIds.has(p.id)}
                  onSelect={() => togglePlayer(p.id)}
                />
              ))}
            </div>
          )}
        </div>

        {(selectedTeamIds.size > 0 || selectedPlayerIds.size > 0) && (
          <button
            onClick={resetPrefill}
            className="mt-3 text-[10px] uppercase tracking-widest font-cinzel text-gray-500 hover:text-gold"
          >
            Clear pre-fill selection
          </button>
        )}

        {createError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mt-4">
            <AlertCircle className="h-4 w-4" /> {createError}
          </p>
        )}
        <Button
          onClick={handleCreate}
          disabled={!name.trim() || isCreating}
          className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50 mt-4"
        >
          <Plus className="mr-2 h-4 w-4" />
          {isCreating ? "Creating…" : "Create Auction"}
        </Button>
      </CollapsibleCreatePanel>

      <div>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4 px-1">Your Auctions</h2>
        {deleteError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mb-3 px-1">
            <AlertCircle className="h-4 w-4" /> {deleteError}
          </p>
        )}
        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2 px-1">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : auctions.length === 0 ? (
          <Panel>
            <p className="text-gray-500 text-sm italic text-center">No auctions yet — create one above.</p>
          </Panel>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {auctions.map((a) => (
              <AuctionCard
                key={a.id}
                auction={a}
                onDelete={() => handleDelete(a)}
                deleting={deletingId === a.id}
              />
            ))}
          </div>
        )}
      </div>

      {ConfirmDialogElement}
    </div>
  )
}
