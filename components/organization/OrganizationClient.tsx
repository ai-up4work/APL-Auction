"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Building2,
  Trophy,
  Swords,
  Users,
  Radio,
  Lock,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Link2,
  Wand2,
  Gamepad2,
  Search,
  CheckSquare,
  Square,
  Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AppHeader } from "@/components/app-header"
import { OverviewTab } from "@/components/organization/OverviewTab"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { pageStyles } from "@/data/site-data"
import { useAuth } from "@/context/AuthContext"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  getOrgForUser,
  getTournamentsForOrg,
  createTournament,
  deleteTournament,
  deleteTournaments,
  getFriendlyMatchesForOrg,
  createFriendlyMatch,
  deleteFriendlyMatch,
  deleteFriendlyMatches,
  getPlayerBank,
  addBankPlayer,
  updateBankPlayer,
  deleteBankPlayer,
  getAssignableTeamsForOrg,
  assignBankPlayerToTeam,
  getTeamPool,
  addPoolTeam,
  deletePoolTeam,
  getAssignableAuctionsForOrg,
  assignPoolTeamToAuction,
  getOverlayConfig,
  saveOverlayChannels,
  saveOverlayWeatherCoords,
  getAuctionsForOrg,
  createAuction,
  getTeamsForAuction,
  subscribeToOrgMatches,
  subscribeToOrgTournaments,
  unsubscribe,
  type OrgSummary,
  type TournamentSummary,
  type FriendlyMatchSummary,
  type BankPlayer,
  type PoolTeam,
  type AssignableTeam,
  type OverlayConfig,
  type AuctionOption,
  type AuctionSummary,
  type AuctionTeamOption,
} from "@/lib/organization/organization"

type Tab = "overview" | "matches" | "tournaments" | "teamPool" | "playerBank"
type GateState = "checking" | "denied" | "allowed"
type TeamSource = "manual" | "auction"

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: Building2 },
  { key: "matches", label: "Matches", icon: Swords },
  { key: "tournaments", label: "Tournaments", icon: Trophy },
  { key: "teamPool", label: "Team Pool", icon: Shield },
  { key: "playerBank", label: "Player Bank", icon: Users },
]

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

/* Status badge with a leading glyph, matching the ✓ Linked / ✗ None /
 * ⚠ Incomplete vocabulary used across the dashboard's quick-ref cards. */
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

// Kept for any older call sites still expecting the plain two-tone badge.
function Badge({ tone, children }: { tone: "gold" | "gray"; children: React.ReactNode }) {
  return <StatusBadge tone={tone === "gold" ? "linked" : "none"}>{children}</StatusBadge>
}

export default function OrganizationClient() {
  useScrollTop()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [gate, setGate] = useState<GateState>("checking")
  const [org, setOrg] = useState<OrgSummary | null>(null)
  const [tab, setTab] = useState<Tab>("overview")

  const [overlayMatchId, setOverlayMatchId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/login")
      return
    }
    let cancelled = false
    getOrgForUser(user.id).then((o) => {
      if (cancelled) return
      if (!o) {
        setGate("denied")
        return
      }
      setOrg(o)
      setGate("allowed")
    })
    return () => {
      cancelled = true
    }
  }, [authLoading, user, router])

  return (
    <main className="overflow-x-hidden max-w-full">
      <style
        dangerouslySetInnerHTML={{
          __html: `${pageStyles}
          html, body { overflow-x: hidden; max-width: 100%; }`,
        }}
      />

      <AppHeader title="Organization" />

      <section className="pt-28 sm:pt-40 pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 max-w-7xl">
          {gate === "checking" && <p className="text-center text-gray-400">Checking access…</p>}

          {gate === "denied" && (
            <Panel className="text-center">
              <Lock className="h-6 w-6 text-gold mx-auto mb-3" />
              <h1 className="text-xl font-bold text-white font-cinzel mb-2">No organization found</h1>
              <p className="text-gray-400 text-sm mb-6">
                Your account isn't attached to an organization yet, so there's nothing to manage here.
              </p>
              <Link href="/">
                <Button className="bg-gold hover:bg-gold/90 text-black font-bold">Back home</Button>
              </Link>
            </Panel>
          )}

          {gate === "allowed" && org && (
            <>
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold mb-2 font-cinzel">
                <Building2 className="w-3.5 h-3.5" />
                Organization
              </span>
              <h1 className="text-3xl font-bold text-white font-cinzel mb-6">{org.name}</h1>

              <nav className="flex flex-wrap gap-1 mb-8 bg-black/50 border border-gold/20 p-1 rounded-lg w-fit">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`flex items-center gap-1.5 font-cinzel text-xs uppercase tracking-wide px-4 py-2 rounded-md transition-all ${
                      tab === key ? "bg-gold text-black" : "text-gray-300 hover:text-gold"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </nav>

              {tab === "overview" && (
                <div>
                  <OverviewTab
                    org={org}
                    onSelectPath={(path) => {
                      if (path === "auction") {
                        setTab("tournaments")
                      } else if (path === "manual") {
                        setTab("tournaments")
                      } else {
                        setTab("matches")
                      }
                    }}
                  />
                </div>
              )}
              {tab === "matches" && (
                <MatchesTab
                  org={org}
                  userId={user!.id}
                  overlayMatchId={overlayMatchId}
                  onOpenOverlay={setOverlayMatchId}
                  onCloseOverlay={() => setOverlayMatchId(null)}
                />
              )}
              {tab === "tournaments" && <TournamentsTab org={org} userId={user!.id} />}
              {tab === "teamPool" && <TeamPoolTab org={org} userId={user!.id} />}
              {tab === "playerBank" && <PlayerBankTab org={org} userId={user!.id} />}
            </>
          )}
        </div>
      </section>
    </main>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  MATCHES — quick-ref cards, search, multi-select + bulk delete,      */
/*  realtime sync with admin panels                                    */
/* ────────────────────────────────────────────────────────────────── */

function MatchesTab({
  org,
  userId,
  overlayMatchId,
  onOpenOverlay,
  onCloseOverlay,
}: {
  org: OrgSummary
  userId: string
  overlayMatchId: string | null
  onOpenOverlay: (id: string) => void
  onCloseOverlay: () => void
}) {
  const router = useRouter()
  const { confirm, confirmAndRun, ConfirmDialogElement } = useConfirmDialog()
  const [matches, setMatches] = useState<FriendlyMatchSummary[]>([])
  const [auctions, setAuctions] = useState<AuctionOption[]>([])
  const [loaded, setLoaded] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Creation form
  const [teamSource, setTeamSource] = useState<TeamSource>("manual")
  const [team1, setTeam1] = useState("")
  const [team2, setTeam2] = useState("")
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
    teamSource === "manual"
      ? Boolean(team1.trim() && team2.trim())
      : Boolean(auctionTeam1Id && auctionTeam2Id && auctionTeam1Id !== auctionTeam2Id)

  const handleCreate = async () => {
    if (!canCreate) return
    setIsCreating(true)
    setCreateError(null)
    const id = await createFriendlyMatch(
      org.id,
      teamSource === "manual"
        ? { teamSource: "manual", team1Name: team1.trim(), team2Name: team2.trim(), round }
        : { teamSource: "auction", auctionId, team1Id: auctionTeam1Id, team2Id: auctionTeam2Id, round }
    )
    setIsCreating(false)
    if (!id) {
      setCreateError("Couldn't create the match — please try again.")
      return
    }
    // After creating a match, redirect to overlay creation with match ID pre-populated
    router.push(`/overlay?matchId=${id}`)
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
          that tournament's page is connected to it.
        </p>

        <FieldLabel>Team source</FieldLabel>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTeamSource("manual")}
            className={`flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide px-3 py-2 rounded-md border transition-colors ${
              teamSource === "manual" ? "bg-gold text-black border-gold" : "border-gold/30 text-gray-300 hover:text-gold"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" /> Manual
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

        {teamSource === "manual" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <FieldLabel>Team 1 Name</FieldLabel>
              <Input value={team1} onChange={(e) => setTeam1(e.target.value)} placeholder="Emberfall Paladins" className="bg-black/50 border-gold/30 text-white" />
            </div>
            <div>
              <FieldLabel>Team 2 Name</FieldLabel>
              <Input value={team2} onChange={(e) => setTeam2(e.target.value)} placeholder="Duskmere Reapers" className="bg-black/50 border-gold/30 text-white" />
            </div>
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

        <div className="mb-4">
          <FieldLabel>Round / Label (optional)</FieldLabel>
          <Input value={round} onChange={(e) => setRound(e.target.value)} placeholder="Friendly match" className="bg-black/50 border-gold/30 text-white sm:w-80" />
        </div>

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
                    onClick={() => onOpenOverlay(m.id)}
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

      {overlayMatchId && (
        <OverlayModal matchId={overlayMatchId} onClose={onCloseOverlay} />
      )}

      {ConfirmDialogElement}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  OVERLAY MODAL — scoped to one match, opened from its row           */
/* ────────────────────────────────────────────────────────────────── */

function OverlayModal({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  const [config, setConfig] = useState<OverlayConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const [channelLabel, setChannelLabel] = useState("")
  const [channelUrl, setChannelUrl] = useState("")
  const [lat, setLat] = useState("")
  const [lng, setLng] = useState("")
  const [savingChannels, setSavingChannels] = useState(false)
  const [savingWeather, setSavingWeather] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getOverlayConfig(matchId).then((c) => {
      setConfig(c)
      setLat(c.weatherLat?.toString() ?? "")
      setLng(c.weatherLng?.toString() ?? "")
      setLoading(false)
    })
  }, [matchId])

  const addChannel = async () => {
    if (!config || !channelLabel.trim() || !channelUrl.trim()) return
    const updated = [...config.channels, { label: channelLabel.trim(), url: channelUrl.trim() }]
    setSavingChannels(true)
    const ok = await saveOverlayChannels(matchId, updated)
    setSavingChannels(false)
    if (ok) {
      setConfig({ ...config, channels: updated })
      setChannelLabel("")
      setChannelUrl("")
      setSaveMsg("Channels saved.")
      setTimeout(() => setSaveMsg(null), 2000)
    }
  }

  const removeChannel = async (index: number) => {
    if (!config) return
    const updated = config.channels.filter((_, i) => i !== index)
    setSavingChannels(true)
    const ok = await saveOverlayChannels(matchId, updated)
    setSavingChannels(false)
    if (ok) setConfig({ ...config, channels: updated })
  }

  const saveWeather = async () => {
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return
    setSavingWeather(true)
    const ok = await saveOverlayWeatherCoords(matchId, latNum, lngNum)
    setSavingWeather(false)
    if (ok) {
      setSaveMsg("Weather location saved.")
      setTimeout(() => setSaveMsg(null), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="bg-[#0a0a0a] border border-gold/30 rounded-lg p-6 max-w-lg w-full shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-white font-cinzel mb-1 flex items-center gap-2">
          <Radio className="h-4 w-4 text-gold" /> Overlay setup
        </h3>
        <p className="text-gray-400 text-sm mb-4">Channels and the weather location for this match's broadcast overlay.</p>

        {loading || !config ? (
          <p className="text-gray-500 text-sm flex items-center gap-2 mb-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading overlay config…
          </p>
        ) : (
          <>
            <h4 className="text-white font-bold font-cinzel mb-3 text-xs uppercase tracking-widest">On-Air Channels</h4>
            <div className="space-y-2 mb-4">
              {config.channels.length === 0 && (
                <p className="text-gray-500 text-sm italic">No channels linked yet.</p>
              )}
              {config.channels.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 bg-white/[0.02] border border-gold/10 rounded-md px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold">{c.label}</p>
                    <p className="text-gray-500 text-xs truncate">{c.url}</p>
                  </div>
                  <button onClick={() => removeChannel(i)} className="text-gray-500 hover:text-red-400 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mb-6">
              <Input value={channelLabel} onChange={(e) => setChannelLabel(e.target.value)} placeholder="Channel name" className="bg-black/50 border-gold/30 text-white sm:w-40" />
              <Input value={channelUrl} onChange={(e) => setChannelUrl(e.target.value)} placeholder="Stream URL" className="bg-black/50 border-gold/30 text-white flex-1" />
              <Button onClick={addChannel} disabled={!channelLabel.trim() || !channelUrl.trim() || savingChannels} className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50 whitespace-nowrap">
                <Plus className="mr-1.5 h-4 w-4" /> Add
              </Button>
            </div>

            <h4 className="text-white font-bold font-cinzel mb-3 text-xs uppercase tracking-widest">Weather Location</h4>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <FieldLabel>Latitude</FieldLabel>
                <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="6.9271" className="bg-black/50 border-gold/30 text-white" />
              </div>
              <div>
                <FieldLabel>Longitude</FieldLabel>
                <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="79.8612" className="bg-black/50 border-gold/30 text-white" />
              </div>
            </div>
            <Button onClick={saveWeather} disabled={!lat.trim() || !lng.trim() || savingWeather} className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50">
              {savingWeather ? "Saving…" : "Save Location"}
            </Button>

            {saveMsg && (
              <p className="flex items-center gap-1.5 text-green-400 text-sm mt-4">
                <CheckCircle2 className="h-4 w-4" /> {saveMsg}
              </p>
            )}
          </>
        )}

        <div className="flex justify-end mt-6">
          <Button onClick={onClose} className="bg-transparent hover:bg-white/5 text-gray-300 border border-white/20">
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  TOURNAMENTS — search, multi-select + bulk delete, realtime sync    */
/* ────────────────────────────────────────────────────────────────── */

function TournamentsTab({ org, userId }: { org: OrgSummary; userId: string }) {
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
        <div className="mb-4">
          <FieldLabel>Category (optional)</FieldLabel>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full sm:w-64 bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5"
          >
            <option value="">Not set</option>
            <option value="Auction">Auction</option>
            <option value="Bracket">Bracket</option>
            <option value="Overlay">Overlay</option>
            <option value="League">League</option>
          </select>
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
/*  TEAM POOL — mirrors Player Bank: add reusable team templates,      */
/*  assign one into a specific auction's team list                     */
/* ────────────────────────────────────────────────────────────────── */

function TeamPoolTab({ org, userId }: { org: OrgSummary; userId: string }) {
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

  const [assignTarget, setAssignTarget] = useState<PoolTeam | null>(null)

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
          Add your teams once and reuse them across auctions — assigning a pool team copies it into that auction's
          team list, the same way an assigned bank player is copied onto a roster.
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
                    className="h-8 w-8 rounded-full flex-shrink-0 border border-white/10"
                    style={{ backgroundColor: t.color || "#e45d35" }}
                  />
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{t.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {t.code} · {t.tier}
                      {t.owner ? ` · ${t.owner}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setAssignTarget(t)}
                    className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-gold border border-gold/30 hover:bg-gold/10 rounded-md px-3 py-1.5"
                  >
                    <Link2 className="h-3 w-3" /> Assign
                  </button>
                  <button onClick={() => handleDelete(t)} className="text-gray-500 hover:text-red-400 p-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {assignTarget && (
        <AssignTeamModal org={org} poolTeam={assignTarget} onClose={() => setAssignTarget(null)} />
      )}

      {ConfirmDialogElement}
    </div>
  )
}

function AssignTeamModal({ org, poolTeam, onClose }: { org: OrgSummary; poolTeam: PoolTeam; onClose: () => void }) {
  const [auctions, setAuctions] = useState<AuctionSummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selectedAuctionId, setSelectedAuctionId] = useState("")
  const [isAssigning, setIsAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    getAssignableAuctionsForOrg(org.id).then((a) => {
      setAuctions(a)
      setLoaded(true)
    })
  }, [org.id])

  const handleAssign = async () => {
    const auction = auctions.find((a) => a.id === selectedAuctionId)
    if (!auction) return
    setIsAssigning(true)
    setError(null)
    const result = await assignPoolTeamToAuction(poolTeam, auction)
    setIsAssigning(false)
    if (!result.ok) {
      setError(result.error ?? "Couldn't assign this team.")
      return
    }
    setSuccess(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="bg-[#0a0a0a] border border-gold/30 rounded-lg p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white font-cinzel mb-1">Assign {poolTeam.name}</h3>
        <p className="text-gray-400 text-sm mb-4">Copies this team into an auction's team list. The pool entry stays untouched.</p>

        {success ? (
          <div className="flex items-center gap-2 text-green-400 text-sm mb-4">
            <CheckCircle2 className="h-4 w-4" /> Assigned successfully.
          </div>
        ) : !loaded ? (
          <p className="text-gray-500 text-sm mb-4 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading auctions…
          </p>
        ) : auctions.length === 0 ? (
          <p className="text-gray-500 text-sm mb-4">No auctions found yet — create one from the Matches or Tournaments tab first.</p>
        ) : (
          <>
            <FieldLabel>Auction</FieldLabel>
            <select
              value={selectedAuctionId}
              onChange={(e) => setSelectedAuctionId(e.target.value)}
              className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5 mb-4"
            >
              <option value="">Select an auction…</option>
              {auctions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.tournamentName ? ` — ${a.tournamentName}` : ""}
                </option>
              ))}
            </select>
          </>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mb-4">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button onClick={onClose} className="bg-transparent hover:bg-white/5 text-gray-300 border border-white/20">
            {success ? "Close" : "Cancel"}
          </Button>
          {!success && (
            <Button
              onClick={handleAssign}
              disabled={!selectedAuctionId || isAssigning}
              className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
            >
              {isAssigning ? "Assigning…" : "Assign"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  PLAYER BANK                                                        */
/* ────────────────────────────────────────────────────────────────── */

function PlayerBankTab({ org, userId }: { org: OrgSummary; userId: string }) {
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [players, setPlayers] = useState<BankPlayer[]>([])
  const [loaded, setLoaded] = useState(false)

  const [name, setName] = useState("")
  const [role, setRole] = useState<BankPlayer["role"]>("Batter")
  const [origin, setOrigin] = useState("Local")
  const [country, setCountry] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [assignTarget, setAssignTarget] = useState<BankPlayer | null>(null)

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
        <div className="mb-4">
          <FieldLabel>Country (optional)</FieldLabel>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Sri Lanka" className="bg-black/50 border-gold/30 text-white sm:w-64" />
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
                  <button
                    onClick={() => setAssignTarget(p)}
                    className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-gold border border-gold/30 hover:bg-gold/10 rounded-md px-3 py-1.5"
                  >
                    <Link2 className="h-3 w-3" /> Assign
                  </button>
                  <button onClick={() => handleDelete(p)} className="text-gray-500 hover:text-red-400 p-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {assignTarget && (
        <AssignPlayerModal org={org} player={assignTarget} onClose={() => setAssignTarget(null)} />
      )}

      {ConfirmDialogElement}
    </div>
  )
}

function AssignPlayerModal({ org, player, onClose }: { org: OrgSummary; player: BankPlayer; onClose: () => void }) {
  const [teams, setTeams] = useState<AssignableTeam[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState("")
  const [isCaptain, setIsCaptain] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    getAssignableTeamsForOrg(org.id).then((t) => {
      setTeams(t)
      setLoaded(true)
    })
  }, [org.id])

  const handleAssign = async () => {
    const team = teams.find((t) => t.teamId === selectedTeamId)
    if (!team) return
    setIsAssigning(true)
    setError(null)
    const result = await assignBankPlayerToTeam(player, team, isCaptain)
    setIsAssigning(false)
    if (!result.ok) {
      setError(result.error ?? "Couldn't assign this player.")
      return
    }
    setSuccess(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="bg-[#0a0a0a] border border-gold/30 rounded-lg p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white font-cinzel mb-1">Assign {player.name}</h3>
        <p className="text-gray-400 text-sm mb-4">Copies this player onto a team's roster. The bank entry stays untouched.</p>

        {success ? (
          <div className="flex items-center gap-2 text-green-400 text-sm mb-4">
            <CheckCircle2 className="h-4 w-4" /> Assigned successfully.
          </div>
        ) : !loaded ? (
          <p className="text-gray-500 text-sm mb-4 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading teams…
          </p>
        ) : teams.length === 0 ? (
          <p className="text-gray-500 text-sm mb-4">No teams found yet — create a tournament or match with teams first.</p>
        ) : (
          <>
            <FieldLabel>Team</FieldLabel>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5 mb-3"
            >
              <option value="">Select a team…</option>
              {teams.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.teamName} ({t.teamCode}) — {t.tournamentName ?? t.auctionName}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-300 mb-4">
              <input type="checkbox" checked={isCaptain} onChange={(e) => setIsCaptain(e.target.checked)} />
              Make captain of this team
            </label>
          </>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mb-4">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button onClick={onClose} className="bg-transparent hover:bg-white/5 text-gray-300 border border-white/20">
            {success ? "Close" : "Cancel"}
          </Button>
          {!success && (
            <Button
              onClick={handleAssign}
              disabled={!selectedTeamId || isAssigning}
              className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
            >
              {isAssigning ? "Assigning…" : "Assign"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}