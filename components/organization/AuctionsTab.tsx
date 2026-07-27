"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Trash2, Loader2, AlertCircle, Landmark, ArrowRight, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  getAuctionsForOrg,
  createAuction,
  deleteAuction,
  getTournamentsForOrg,
  type OrgSummary,
  type AuctionSummary,
  type TournamentSummary,
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
/*  STATUS BADGE — auctions.status is one of setup/live/paused/          */
/*  completed (DB CHECK constraint). Each gets a distinct color so the    */
/*  list reads at a glance without needing to open anything.              */
/* ────────────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  setup: "border-gold/30 text-gold/80 bg-gold/[0.06]",
  live: "border-green-500/40 text-green-400 bg-green-500/[0.08]",
  paused: "border-amber-500/40 text-amber-400 bg-amber-500/[0.08]",
  completed: "border-white/15 text-gray-400 bg-white/[0.02]",
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.setup
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-cinzel px-2 py-1 rounded-full border ${style}`}
    >
      {status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />}
      {status}
    </span>
  )
}

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
        <StatusBadge status={auction.status} />
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
        <Link
          href={`/auction/admin/${auction.id}`}
          className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-gray-400 hover:text-gold transition-colors"
        >
          Open in admin <ArrowRight className="h-3 w-3" />
        </Link>
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

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const reload = () => getAuctionsForOrg(org.id).then((a) => setAuctions(a))

  useEffect(() => {
    reload().then(() => setLoaded(true))
    getTournamentsForOrg(org.id).then(setTournaments)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  const handleCreate = async () => {
    if (!name.trim()) return
    setIsCreating(true)
    setCreateError(null)
    const id = await createAuction(org.id, userId, {
      name: name.trim(),
      tournamentId: tournamentId || undefined,
    })
    setIsCreating(false)
    if (!id) {
      setCreateError("Couldn't create the auction — please try again.")
      return
    }
    setName("")
    setTournamentId("")
    // Jumps straight into the admin dashboard for the new auction.
    // Swap for `await reload()` instead if you'd rather stay on this
    // page and create several auctions before configuring any of them.
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
      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-1 flex items-center gap-2">
          <Plus className="h-4 w-4 text-gold" /> Create an Auction
        </h2>
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
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="mr-2 h-4 w-4" />
            {isCreating ? "Creating…" : "Create Auction"}
          </Button>
        </div>
        {createError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mt-3">
            <AlertCircle className="h-4 w-4" /> {createError}
          </p>
        )}
      </Panel>

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