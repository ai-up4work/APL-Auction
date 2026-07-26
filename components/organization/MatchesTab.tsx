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
  Gamepad2,
  Shield,
  Search,
  CheckSquare,
  Square,
  Radio,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  getFriendlyMatchesForOrg,
  createFriendlyMatch,
  deleteFriendlyMatch,
  deleteFriendlyMatches,
  getAuctionsForOrg,
  createAuction,
  getTeamsForAuction,
  getTeamPool,
  subscribeToOrgMatches,
  unsubscribe,
  type OrgSummary,
  type FriendlyMatchSummary,
  type AuctionOption,
  type AuctionTeamOption,
  type PoolTeam,
} from "@/lib/organization/organization"

// "pool" = pick two teams that already exist in the org's Team Pool.
// "auction" = pull team names from a specific auction's sold teams.
// Free-typed team names are intentionally not supported here anymore —
// every match's teams must trace back to a real pool or auction team.
type TeamSource = "pool" | "auction"

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

/* ────────────────────────────────────────────────────────────────── */
/*  MATCHES — quick-ref cards, search, multi-select + bulk delete,      */
/*  realtime sync with admin panels                                    */
/* ────────────────────────────────────────────────────────────────── */

export function MatchesTab({ org, userId }: { org: OrgSummary; userId: string }) {
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [matches, setMatches] = useState<FriendlyMatchSummary[]>([])
  const [auctions, setAuctions] = useState<AuctionOption[]>([])
  const [loaded, setLoaded] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Creation form
  const [teamSource, setTeamSource] = useState<TeamSource>("pool")

  // Team Pool selection
  const [poolTeams, setPoolTeams] = useState<PoolTeam[]>([])
  const [poolTeamsLoaded, setPoolTeamsLoaded] = useState(false)
  const [poolTeam1Id, setPoolTeam1Id] = useState("")
  const [poolTeam2Id, setPoolTeam2Id] = useState("")

  // Auction selection
  const [auctionId, setAuctionId] = useState("")
  const [auctionTeams, setAuctionTeams] = useState<AuctionTeamOption[]>([])
  const [auctionTeamsLoaded, setAuctionTeamsLoaded] = useState(false)
  const [auctionTeam1Id, setAuctionTeam1Id] = useState("")
  const [auctionTeam2Id, setAuctionTeam2Id] = useState("")

  const [round, setRound] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Creating a brand-new auction inline, without leaving the dashboard —
  // it starts with zero teams, so it becomes usable for a match as soon as
  // teams are added for it over in the auction admin panel.
  const [newAuctionName, setNewAuctionName] = useState("")
  const [isCreatingAuction, setIsCreatingAuction] = useState(false)
  const [createAuctionError, setCreateAuctionError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Search / filter
  const [query, setQuery] = useState("")

  // Multi-select + bulk delete
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const reload = () => {
    setSyncing(true)
    return Promise.all([getFriendlyMatchesForOrg(org.id), getAuctionsForOrg(org.id)]).then(([m, a]) => {
      setMatches(m)
      setAuctions(a)
      setLoaded(true)
      setSyncing(false)
    })
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  // Real-time sync: any change to this org's matches, or to the bracket /
  // overlay tables that affect how a match's status badges render, triggers
  // a silent refetch so the dashboard stays current with admin panels.
  useEffect(() => {
    const channel = subscribeToOrgMatches(org.id, () => {
      reload()
    })
    return () => unsubscribe(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  // Load the org's Team Pool once, up front — this is the only source of
  // teams for the "pool" path.
  useEffect(() => {
    setPoolTeamsLoaded(false)
    getTeamPool(org.id).then((t) => {
      setPoolTeams(t)
      setPoolTeamsLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  useEffect(() => {
    setAuctionTeam1Id("")
    setAuctionTeam2Id("")
    if (!auctionId) {
      setAuctionTeams([])
      return
    }
    setAuctionTeamsLoaded(false)
    getTeamsForAuction(auctionId).then((t) => {
      setAuctionTeams(t)
      setAuctionTeamsLoaded(true)
    })
  }, [auctionId])

  const canCreate =
    teamSource === "pool"
      ? Boolean(poolTeam1Id && poolTeam2Id && poolTeam1Id !== poolTeam2Id)
      : Boolean(auctionTeam1Id && auctionTeam2Id && auctionTeam1Id !== auctionTeam2Id)

  const handleCreate = async () => {
    if (!canCreate) return
    setIsCreating(true)
    setCreateError(null)

    let id: string | null = null
    if (teamSource === "pool") {
      const t1 = poolTeams.find((t) => t.id === poolTeam1Id)
      const t2 = poolTeams.find((t) => t.id === poolTeam2Id)
      if (!t1 || !t2) {
        setIsCreating(false)
        setCreateError("Couldn't find those teams — please reselect and try again.")
        return
      }
      id = await createFriendlyMatch(org.id, {
        teamSource: "manual",
        team1Name: t1.name,
        team2Name: t2.name,
        round,
      })
    } else {
      id = await createFriendlyMatch(org.id, {
        teamSource: "auction",
        auctionId,
        team1Id: auctionTeam1Id,
        team2Id: auctionTeam2Id,
        round,
      })
    }

    setIsCreating(false)
    if (!id) {
      setCreateError("Couldn't create the match — please try again.")
      return
    }
    // After creating a match, redirect to the overlay admin panel with the
    // new match's id pre-populated. This route is /overlay/[auctionId]/admin
    // — a friendly match's own id doubles as its auction_id (see
    // createFriendlyMatch in organization.ts), so `id` here is exactly what
    // that route expects.
    router.push(`/match/${id}/edit`)
  }

  const handleCreateAuction = async () => {
    if (!newAuctionName.trim()) return
    setIsCreatingAuction(true)
    setCreateAuctionError(null)
    const id = await createAuction(org.id, userId, { name: newAuctionName.trim() })
    setIsCreatingAuction(false)
    if (!id) {
      setCreateAuctionError("Couldn't create the auction — please try again.")
      return
    }
    setAuctions((prev) => [
      { id, name: newAuctionName.trim(), status: "setup", tournamentName: null, createdAt: new Date().toISOString() },
      ...prev,
    ])
    setAuctionId(id)
    setNewAuctionName("")
  }

  const handleDelete = async (match: FriendlyMatchSummary) => {
    if (match.tournamentName) {
      await confirm({
        title: "Can't delete this match",
        description: `"${match.team1Name} vs ${match.team2Name}" is connected to the ${match.tournamentName} bracket. Disconnect it from the bracket on the tournament's edit page before deleting it here.`,
        confirmText: "Got it",
        cancelText: "Close",
        tone: "default",
      })
      return
    }
    const ok = await confirm({
      title: "Delete this match?",
      description: `"${match.team1Name} vs ${match.team2Name}" will be permanently deleted. This can't be undone.`,
      confirmText: "Delete match",
      tone: "danger",
    })
    if (!ok) return

    setDeletingId(match.id)
    setDeleteError(null)
    const result = await deleteFriendlyMatch(match.id)
    setDeletingId(null)
    if (!result.ok) {
      setDeleteError(result.error ?? "Couldn't delete that match — please try again.")
      return
    }
    setMatches((prev) => prev.filter((m) => m.id !== match.id))
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(match.id)
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return matches
    return matches.filter(
      (m) =>
        m.team1Name.toLowerCase().includes(q) ||
        m.team2Name.toLowerCase().includes(q) ||
        m.round.toLowerCase().includes(q) ||
        (m.tournamentName ?? "").toLowerCase().includes(q)
    )
  }, [matches, query])

  // Only standalone (non-bracket-linked) matches in the current filtered
  // view are selectable for bulk delete — bracket-linked ones must be
  // disconnected on the tournament page first, same rule as single delete.
  const selectableIds = useMemo(() => filtered.filter((m) => !m.tournamentName).map((m) => m.id), [filtered])
  const allSelectableChecked = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))

  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (allSelectableChecked) return new Set()
      return new Set(selectableIds)
    })
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
      title: `Delete ${selected.size} match${selected.size === 1 ? "" : "es"}?`,
      description: "This can't be undone. Matches with recorded play data or an active bracket link will be skipped.",
      confirmText: `Delete ${selected.size}`,
      tone: "danger",
    })
    if (!ok) return

    setBulkDeleting(true)
    setDeleteError(null)
    const { okIds, failed } = await deleteFriendlyMatches(Array.from(selected))
    setBulkDeleting(false)
    setMatches((prev) => prev.filter((m) => !okIds.includes(m.id)))
    setSelected(new Set())
    if (failed.length > 0) {
      setDeleteError(
        `${failed.length} match${failed.length === 1 ? "" : "es"} couldn't be deleted: ${failed[0].error}${
          failed.length > 1 ? ` (and ${failed.length - 1} more)` : ""
        }`
      )
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-gold" /> Create a Match
        </h2>
        <p className="text-gray-500 text-xs mb-4">
          Every match created here is standalone. A match only becomes part of a tournament when a bracket slot on
          that tournament's page is connected to it. Teams must come from your Team Pool or an auction — there's no
          free-typed team name option, so every match's teams stay tied to something real.
        </p>

        <FieldLabel>Team source</FieldLabel>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTeamSource("pool")}
            className={`flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide px-3 py-2 rounded-md border transition-colors ${
              teamSource === "pool" ? "bg-gold text-black border-gold" : "border-gold/30 text-gray-300 hover:text-gold"
            }`}
          >
            <Shield className="h-3.5 w-3.5" /> Team Pool
          </button>
          <button
            onClick={() => setTeamSource("auction")}
            className={`flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide px-3 py-2 rounded-md border transition-colors ${
              teamSource === "auction" ? "bg-gold text-black border-gold" : "border-gold/30 text-gray-300 hover:text-gold"
            }`}
          >
            <Gamepad2 className="h-3.5 w-3.5" /> From an auction
          </button>
        </div>

        {teamSource === "pool" ? (
          <div className="mb-4">
            {!poolTeamsLoaded ? (
              <p className="text-gray-500 text-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading team pool…
              </p>
            ) : poolTeams.length < 2 ? (
              <p className="text-gray-500 text-sm italic">
                You need at least two teams in the pool first.{" "}
                <span className="text-gold">Add some from the Team Pool tab →</span>
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Team 1</FieldLabel>
                  <select
                    value={poolTeam1Id}
                    onChange={(e) => setPoolTeam1Id(e.target.value)}
                    className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5"
                  >
                    <option value="">Select a team…</option>
                    {poolTeams.map((t) => (
                      <option key={t.id} value={t.id} disabled={t.id === poolTeam2Id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>Team 2</FieldLabel>
                  <select
                    value={poolTeam2Id}
                    onChange={(e) => setPoolTeam2Id(e.target.value)}
                    className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5"
                  >
                    <option value="">Select a team…</option>
                    {poolTeams.map((t) => (
                      <option key={t.id} value={t.id} disabled={t.id === poolTeam1Id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-4 space-y-4">
            <div>
              <FieldLabel>Auction</FieldLabel>
              {auctions.length === 0 ? (
                <p className="text-gray-500 text-sm italic mb-2">No auctions in this org yet.</p>
              ) : (
                <select
                  value={auctionId}
                  onChange={(e) => setAuctionId(e.target.value)}
                  className="w-full sm:w-80 bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5 mb-2"
                >
                  <option value="">Select an auction…</option>
                  {auctions.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}

              {/* Create a new auction right here — no need to leave the
                  dashboard just to get an auction that a match can pull
                  teams from. It starts empty; teams get added afterward
                  from the auction admin panel. */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={newAuctionName}
                  onChange={(e) => setNewAuctionName(e.target.value)}
                  placeholder="New auction name"
                  className="bg-black/50 border-gold/30 text-white sm:w-64 text-sm"
                />
                <Button
                  onClick={handleCreateAuction}
                  disabled={!newAuctionName.trim() || isCreatingAuction}
                  className="bg-transparent hover:bg-gold/10 text-gold border border-gold/40 font-bold disabled:opacity-50 whitespace-nowrap"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {isCreatingAuction ? "Creating…" : "Create Auction"}
                </Button>
              </div>
              {createAuctionError && (
                <p className="flex items-center gap-1.5 text-red-500 text-sm mt-2">
                  <AlertCircle className="h-4 w-4" /> {createAuctionError}
                </p>
              )}
            </div>

            {auctionId && (
              !auctionTeamsLoaded ? (
                <p className="text-gray-500 text-sm flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading teams…
                </p>
              ) : auctionTeams.length < 2 ? (
                <p className="text-gray-500 text-sm italic">
                  This auction doesn't have two teams yet.{" "}
                  <Link href="/auction/admin" className="text-gold underline hover:no-underline">
                    Set up teams in the auction admin panel →
                  </Link>{" "}
                  or add some from the{" "}
                  <span className="text-gold">Team Pool</span> tab.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Team 1</FieldLabel>
                    <select
                      value={auctionTeam1Id}
                      onChange={(e) => setAuctionTeam1Id(e.target.value)}
                      className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5"
                    >
                      <option value="">Select a team…</option>
                      {auctionTeams.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.id === auctionTeam2Id}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Team 2</FieldLabel>
                    <select
                      value={auctionTeam2Id}
                      onChange={(e) => setAuctionTeam2Id(e.target.value)}
                      className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5"
                    >
                      <option value="">Select a team…</option>
                      {auctionTeams.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.id === auctionTeam1Id}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )
            )}
            <p className="text-gray-500 text-xs">Each team's sold players are pulled in automatically.</p>
          </div>
        )}

        {createError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mb-3">
            <AlertCircle className="h-4 w-4" /> {createError}
          </p>
        )}
        <Button
          onClick={handleCreate}
          disabled={!canCreate || isCreating}
          className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
        >
          {isCreating ? "Creating…" : "Create & Continue Setup"}
        </Button>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-lg font-bold text-white font-cinzel flex items-center gap-2">
            Your Matches
            {syncing && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />}
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teams, round, tournament…"
              className="bg-black/50 border-gold/30 text-white pl-8 text-sm"
            />
          </div>
        </div>

        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : matches.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No matches yet — create one above.</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No matches match "{query}".</p>
        ) : (
          <div className="space-y-2">
            {deleteError && (
              <p className="flex items-center gap-1.5 text-red-500 text-sm mb-2">
                <AlertCircle className="h-4 w-4" /> {deleteError}
              </p>
            )}

            {selectableIds.length > 0 && (
              <div className="flex items-center justify-between gap-3 px-1 pb-1">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-gray-400 hover:text-gold"
                >
                  {allSelectableChecked ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                  {allSelectableChecked ? "Deselect all" : "Select all standalone"}
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
            )}

            {filtered.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 bg-white/[0.02] border border-gold/10 hover:border-gold/40 rounded-md px-4 py-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {!m.tournamentName && (
                    <button
                      onClick={() => toggleSelectOne(m.id)}
                      className="text-gray-500 hover:text-gold shrink-0"
                      aria-label="Select match"
                    >
                      {selected.has(m.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                  )}
                  <Link href={`/match/${m.id}`} className="min-w-0 flex-1">
                    <p className="text-white text-sm font-semibold truncate">
                      {m.team1Name} vs {m.team2Name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {m.tournamentName ? (
                        <StatusBadge tone="linked">{m.tournamentName}{m.round ? ` · ${m.round}` : ""}</StatusBadge>
                      ) : (
                        <StatusBadge tone="none">Standalone</StatusBadge>
                      )}
                      {m.overlayConfigured ? (
                        <StatusBadge tone="linked">Overlay</StatusBadge>
                      ) : (
                        <StatusBadge tone="warn">Overlay not set</StatusBadge>
                      )}
                      {m.auctionLinked && <StatusBadge tone="neutral">From auction</StatusBadge>}
                    </div>
                  </Link>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => router.push(`/overlay/${m.id}/admin`)}
                    title="Set up overlay"
                    className="text-gray-500 hover:text-gold transition-colors"
                  >
                    <Radio className="h-3.5 w-3.5" />
                  </button>
                  <Link
                    href={`/match/${m.id}/edit`}
                    className="text-gray-500 hover:text-gold transition-colors outline-none"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() => handleDelete(m)}
                    disabled={deletingId === m.id}
                    className="bg-transparent border-none outline-none text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingId === m.id ? (
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