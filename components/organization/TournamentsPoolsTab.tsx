"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  Search,
  CheckSquare,
  Square,
  Shield,
  Trophy,
  UserPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  getTournamentsForOrg,
  createTournament,
  deleteTournament,
  deleteTournaments,
  getPlayerBank,
  addBankPlayer,
  deleteBankPlayer,
  getTeamPool,
  addPoolTeam,
  deletePoolTeam,
  subscribeToOrgTournaments,
  unsubscribe,
  type OrgSummary,
  type TournamentSummary,
  type BankPlayer,
  type PoolTeam,
} from "@/lib/organization/organization"

const ROLE_OPTIONS = ["Batter", "Bowler", "All-rounder", "WK-Batter", "Batsman", "Wicket Keeper"]
const TIER_OPTIONS = ["A", "B", "C", "Pro", "Elite", "Legend"]

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-black/50 border border-gold/20 shine hover:border-gold/40 transition-all duration-300 rounded-lg p-6 md:p-8 shadow-lg shadow-black/40 ${className}`}
    >
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] uppercase tracking-widest text-gold/70 font-cinzel block mb-1.5">{children}</label>
}

type BadgeTone = "linked" | "none" | "warn" | "neutral"

function StatusBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  const styles: Record<BadgeTone, string> = {
    linked: "border-gold/40 text-gold",
    none: "border-white/15 text-gray-400",
    warn: "border-yellow-500/40 text-yellow-400",
    neutral: "border-white/15 text-gray-300",
  }
  const glyph: Record<BadgeTone, string> = {
    linked: "✓",
    none: "✗",
    warn: "⚠",
    neutral: "",
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded border ${styles[tone]}`}
    >
      {glyph[tone] && <span>{glyph[tone]}</span>}
      {children}
    </span>
  )
}

/** Cover thumbnail for a tournament card. Falls back to `logoUrl`, then to
 *  a plain trophy placeholder when the tournament has no image at all. */
function TournamentThumb({ tournament }: { tournament: TournamentSummary }) {
  const src = tournament.imageUrl || tournament.logoUrl
  return (
    <div className="h-12 w-12 rounded-md overflow-hidden border border-gold/20 bg-black/60 flex items-center justify-center shrink-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <Trophy className="h-5 w-5 text-gold/30" />
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  TOURNAMENTS — search, multi-select + bulk delete, realtime sync    */
/* ────────────────────────────────────────────────────────────────── */

export function TournamentsTab({ org, userId }: { org: OrgSummary; userId: string }) {
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [name, setName] = useState("")
  const [format, setFormat] = useState<"single_elimination" | "double_elimination" | "round_robin">(
    "single_elimination"
  )
  const [category, setCategory] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const reload = () => {
    setSyncing(true)
    return getTournamentsForOrg(org.id).then((t) => {
      setTournaments(t)
      setLoaded(true)
      setSyncing(false)
    })
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  useEffect(() => {
    const channel = subscribeToOrgTournaments(org.id, () => {
      reload()
    })
    return () => unsubscribe(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  const handleCreate = async () => {
    if (!name.trim()) return
    setIsCreating(true)
    setCreateError(null)
    const id = await createTournament(org.id, userId, {
      name: name.trim(),
      format,
      category: category ? (category as any) : undefined,
    })
    setIsCreating(false)
    if (!id) {
      setCreateError("Couldn't create the tournament — please try again.")
      return
    }
    router.push(`/tournaments/${id}/edit`)
  }

  const handleDelete = async (t: TournamentSummary) => {
    const ok = await confirm({
      title: "Delete this tournament?",
      description: `"${t.name}" will be permanently deleted. This fails if it still has auctions, teams, or bracket matches attached.`,
      confirmText: "Delete tournament",
      tone: "danger",
    })
    if (!ok) return

    setDeletingId(t.id)
    setDeleteError(null)
    const result = await deleteTournament(t.id)
    setDeletingId(null)
    if (!result.ok) {
      setDeleteError(result.error ?? "Couldn't delete that tournament — please try again.")
      return
    }
    setTournaments((prev) => prev.filter((x) => x.id !== t.id))
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(t.id)
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tournaments
    return tournaments.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.format.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q)
    )
  }, [tournaments, query])

  const allChecked = filtered.length > 0 && filtered.every((t) => selected.has(t.id))

  const toggleSelectAll = () => {
    setSelected((prev) => (allChecked ? new Set() : new Set(filtered.map((t) => t.id))))
  }

  const toggleSelectOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    const ok = await confirm({
      title: `Delete ${selected.size} tournament${selected.size === 1 ? "" : "s"}?`,
      description: "This can't be undone, and will skip any that still have auctions, teams, or matches attached.",
      confirmText: `Delete ${selected.size}`,
      tone: "danger",
    })
    if (!ok) return

    setBulkDeleting(true)
    setDeleteError(null)
    const { okIds, failedIds } = await deleteTournaments(Array.from(selected))
    setBulkDeleting(false)
    setTournaments((prev) => prev.filter((t) => !okIds.includes(t.id)))
    setSelected(new Set())
    if (failedIds.length > 0) {
      setDeleteError(
        `${failedIds.length} tournament${failedIds.length === 1 ? "" : "s"} couldn't be deleted — they still have auctions, teams, or matches attached.`
      )
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-gold" /> Create a Tournament
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="sm:col-span-2">
            <FieldLabel>Name</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Valiant League — Season 2" className="bg-black/50 border-gold/30 text-white" />
          </div>
          <div>
            <FieldLabel>Format</FieldLabel>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
              className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5"
            >
              <option value="single_elimination">Single Elimination</option>
              <option value="double_elimination">Double Elimination</option>
              <option value="round_robin">Round Robin</option>
            </select>
          </div>
        </div>
        {createError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mb-3">
            <AlertCircle className="h-4 w-4" /> {createError}
          </p>
        )}
        <Button
          onClick={handleCreate}
          disabled={!name.trim() || isCreating}
          className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
        >
          {isCreating ? "Creating…" : "Create & Build Bracket"}
        </Button>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <h2 className="text-lg font-bold text-white font-cinzel flex items-center gap-2">
            Your Tournaments
            {syncing && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />}
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, format, status…"
              className="bg-black/50 border-gold/30 text-white pl-8 text-sm"
            />
          </div>
        </div>
        <p className="text-gray-500 text-xs mb-4">
          Open a tournament's bracket to connect each slot to a match — that's where a bracket match becomes a real
          match with its own teams and, optionally, an overlay.
        </p>
        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : tournaments.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No tournaments yet — create one above.</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No tournaments match "{query}".</p>
        ) : (
          <div className="space-y-2">
            {deleteError && (
              <p className="flex items-center gap-1.5 text-red-500 text-sm mb-2">
                <AlertCircle className="h-4 w-4" /> {deleteError}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 px-1 pb-1">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-gray-400 hover:text-gold"
              >
                {allChecked ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                {allChecked ? "Deselect all" : "Select all"}
              </button>
              {selected.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Delete {selected.size} selected
                </button>
              )}
            </div>

            {filtered.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 bg-white/[0.02] border border-gold/10 hover:border-gold/40 rounded-md px-4 py-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    onClick={() => toggleSelectOne(t.id)}
                    className="text-gray-500 hover:text-gold shrink-0"
                    aria-label="Select tournament"
                  >
                    {selected.has(t.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                  <TournamentThumb tournament={t} />
                  <Link href={`/tournaments/${t.id}`} className="min-w-0 flex-1">
                    <p className="text-white text-sm font-semibold truncate">{t.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <StatusBadge tone="neutral">{t.format.replace("_", " ")}</StatusBadge>
                      <StatusBadge tone={t.status === "setup" ? "warn" : "linked"}>{t.status}</StatusBadge>
                      {t.category && <StatusBadge tone="neutral">{t.category}</StatusBadge>}
                    </div>
                  </Link>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    href={`/tournaments/${t.id}/edit`}
                    className="text-gray-500 hover:text-gold transition-colors outline-none"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() => handleDelete(t)}
                    disabled={deletingId === t.id}
                    className="bg-transparent border-none outline-none text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingId === t.id ? (
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

/* ────────────────────────────────────────────────────────────────── */
/*  TEAM POOL — reusable team templates. Assigning a pool team into an  */
/*  auction now happens from the auction admin panel itself, not here —  */
/*  this tab is purely add / browse / remove for the org's Team Pool.    */
/* ────────────────────────────────────────────────────────────────── */

export function TeamPoolTab({ org, userId }: { org: OrgSummary; userId: string }) {
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [teams, setTeams] = useState<PoolTeam[]>([])
  const [loaded, setLoaded] = useState(false)

  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [owner, setOwner] = useState("")
  const [tier, setTier] = useState<PoolTeam["tier"]>("Pro")
  const [color, setColor] = useState("#e45d35")
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const reload = () => getTeamPool(org.id).then((t) => setTeams(t))

  useEffect(() => {
    reload().then(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  const handleAdd = async () => {
    if (!name.trim() || !code.trim()) return
    setIsAdding(true)
    setAddError(null)
    const team = await addPoolTeam(org.id, userId, { name: name.trim(), code: code.trim().toUpperCase(), owner, tier, color })
    setIsAdding(false)
    if (!team) {
      setAddError("Couldn't add that team — please try again.")
      return
    }
    setTeams((prev) => [...prev, team].sort((a, b) => a.name.localeCompare(b.name)))
    setName("")
    setCode("")
    setOwner("")
  }

  const handleDelete = async (team: PoolTeam) => {
    const ok = await confirm({
      title: "Remove this team?",
      description: `"${team.name}" will be removed from the team pool. This doesn't affect any auction it's already been assigned to.`,
      confirmText: "Remove team",
      tone: "danger",
    })
    if (!ok) return
    const success = await deletePoolTeam(team.id)
    if (success) setTeams((prev) => prev.filter((t) => t.id !== team.id))
  }

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-gold" /> Add a Team to the Pool
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
          <div className="sm:col-span-2">
            <FieldLabel>Team Name</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Emberfall Paladins" className="bg-black/50 border-gold/30 text-white" />
          </div>
          <div>
            <FieldLabel>Code</FieldLabel>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EFP" maxLength={4} className="bg-black/50 border-gold/30 text-white uppercase" />
          </div>
          <div>
            <FieldLabel>Tier</FieldLabel>
            <select value={tier} onChange={(e) => setTier(e.target.value as PoolTeam["tier"])} className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5">
              {TIER_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <FieldLabel>Owner (optional)</FieldLabel>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g. Team owner name" className="bg-black/50 border-gold/30 text-white" />
          </div>
          <div>
            <FieldLabel>Color</FieldLabel>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-14 rounded-md border border-gold/30 bg-black/50 cursor-pointer"
              />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="bg-black/50 border-gold/30 text-white flex-1" />
            </div>
          </div>
        </div>
        {addError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mb-3">
            <AlertCircle className="h-4 w-4" /> {addError}
          </p>
        )}
        <Button onClick={handleAdd} disabled={!name.trim() || !code.trim() || isAdding} className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50">
          <Plus className="mr-2 h-4 w-4" />
          {isAdding ? "Adding…" : "Add to Pool"}
        </Button>
      </Panel>

      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4">Team Pool</h2>
        <p className="text-gray-500 text-xs mb-4">
          Add your teams once and reuse them across auctions and matches — pick a pool team directly when creating a
          match from the Matches tab, or from the auction admin panel when setting up an auction.
        </p>
        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : teams.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No teams in the pool yet — add one above.</p>
        ) : (
          <div className="space-y-2">
            {teams.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 bg-white/[0.02] border border-gold/10 rounded-md px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-8 w-8 rounded-full flex-shrink-0 border border-white/10 overflow-hidden flex items-center justify-center"
                    style={{ backgroundColor: t.color || "#e45d35" }}
                  >
                    {t.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.logo} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{t.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {t.code} · {t.tier}
                      {t.owner ? ` · ${t.owner}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleDelete(t)} className="text-gray-500 hover:text-red-400 p-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
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

/* ────────────────────────────────────────────────────────────────── */
/*  PLAYER BANK — assigning a bank player onto a team's roster now       */
/*  happens elsewhere (the team/auction roster view), not here — this   */
/*  tab is purely add / browse / remove for the org's Player Bank.      */
/* ────────────────────────────────────────────────────────────────── */

export function PlayerBankTab({ org, userId }: { org: OrgSummary; userId: string }) {
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [players, setPlayers] = useState<BankPlayer[]>([])
  const [loaded, setLoaded] = useState(false)

  const [name, setName] = useState("")
  const [role, setRole] = useState<BankPlayer["role"]>("Batter")
  const [origin, setOrigin] = useState("Local")
  const [country, setCountry] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const reload = () => getPlayerBank(org.id).then((p) => setPlayers(p))

  useEffect(() => {
    reload().then(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  const handleAdd = async () => {
    if (!name.trim()) return
    setIsAdding(true)
    setAddError(null)
    const player = await addBankPlayer(org.id, userId, { name: name.trim(), role, origin, country })
    setIsAdding(false)
    if (!player) {
      setAddError("Couldn't add that player — please try again.")
      return
    }
    setPlayers((prev) => [...prev, player].sort((a, b) => a.name.localeCompare(b.name)))
    setName("")
    setCountry("")
  }

  const handleDelete = async (player: BankPlayer) => {
    const ok = await confirm({
      title: "Remove this player?",
      description: `${player.name} will be removed from the player bank. This doesn't affect any team they're already on.`,
      confirmText: "Remove player",
      tone: "danger",
    })
    if (!ok) return
    const success = await deleteBankPlayer(player.id)
    if (success) setPlayers((prev) => prev.filter((p) => p.id !== player.id))
  }

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-gold" /> Add a Player to the Bank
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
          <div className="sm:col-span-2">
            <FieldLabel>Name</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" className="bg-black/50 border-gold/30 text-white" />
          </div>
          <div>
            <FieldLabel>Role</FieldLabel>
            <select value={role} onChange={(e) => setRole(e.target.value as BankPlayer["role"])} className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5">
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Origin</FieldLabel>
            <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5">
              <option value="Local">Local</option>
              <option value="Overseas">Overseas</option>
            </select>
          </div>
        </div>
        {addError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mb-3">
            <AlertCircle className="h-4 w-4" /> {addError}
          </p>
        )}
        <Button onClick={handleAdd} disabled={!name.trim() || isAdding} className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50">
          <Plus className="mr-2 h-4 w-4" />
          {isAdding ? "Adding…" : "Add to Bank"}
        </Button>
      </Panel>

      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4">Player Bank</h2>
        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : players.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No players in the bank yet — add one above.</p>
        ) : (
          <div className="space-y-2">
            {players.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 bg-white/[0.02] border border-gold/10 rounded-md px-4 py-3">
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {p.role} · {p.origin}
                    {p.country ? ` · ${p.country}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleDelete(p)} className="text-gray-500 hover:text-red-400 p-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
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