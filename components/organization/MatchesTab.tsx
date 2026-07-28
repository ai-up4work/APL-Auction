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
  Users,
  Search,
  CheckSquare,
  Square,
  Radio,
  Swords,
  MapPin,
  Calendar,
  Clock,
  ChevronDown,
  Trophy,
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
  getSquadBoardsForOrg,
  createSquadBoard,
  subscribeToOrgMatches,
  unsubscribe,
  type OrgSummary,
  type FriendlyMatchSummary,
  type AuctionOption,
  type AuctionTeamOption,
  type SquadBoard,
} from "@/lib/organization/organization"
import { useRefetchOnFocus } from "@/hooks/use-refetch-on-focus"

// "board" = pull two rostered teams from one of the org's Squad Boards —
// these teams already have players assigned (via the Squad Board tab), so
// a match created this way is immediately playable.
// "auction" = pull team names from a specific REAL auction's sold teams.
// Free-typed team names, and picking bare Team Pool teams with no roster,
// are intentionally not supported here — every match's teams must trace
// back to something that already has (or can have) real players on it.
type TeamSource = "board" | "auction"

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

/** Shared select styling — gold border, custom chevron, disabled state —
 *  kept consistent with the pickers on the Squad Board tab. */
function StyledSelect({
  value,
  onChange,
  disabled,
  placeholder,
  children,
  className = "",
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  disabled?: boolean
  placeholder: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full appearance-none bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5 pr-9 outline-none focus:border-gold/70 focus:ring-1 focus:ring-gold/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown className="h-3.5 w-3.5 text-gold/50 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  )
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
/*  MATCH CARD                                                         */
/*                                                                       */
/*  Replaces the old flat row + tiny overlapping-dot avatars. Shows big  */
/*  team art either side of a centered "vs", the status badges, and —    */
/*  only once the match has actually been through its edit panel — a     */
/*  venue/date/time strip pulled straight from match_setup. A brand-new  */
/*  standalone match (blank venue/date/time) just omits that section     */
/*  entirely rather than showing empty placeholders.                     */
/*                                                                       */
/*  Exported so the Tournaments tab can reuse the exact same card for    */
/*  the matches that live inside a bracket — one visual language for a   */
/*  "match" everywhere it shows up, whether it's standalone or linked.   */
/* ────────────────────────────────────────────────────────────────── */

export function MatchCard({
  match,
  selected,
  onToggleSelect,
  onSetupOverlay,
  onDelete,
  deleting,
}: {
  match: FriendlyMatchSummary
  selected?: boolean
  onToggleSelect?: () => void
  onSetupOverlay: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const hasDetails = Boolean(match.venue || match.date || match.time)
  const selectable = Boolean(onToggleSelect) && !match.tournamentName

  return (
    <div className="group relative bg-white/[0.02] border border-gold/10 hover:border-gold/40 rounded-lg overflow-hidden transition-colors flex flex-col">
      {selectable && (
        <button
          onClick={onToggleSelect}
          className="absolute top-3 left-3 z-20 text-gray-300 hover:text-gold bg-black/60 rounded p-1"
          aria-label="Select match"
        >
          {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </button>
      )}

      <Link href={`/match/${match.id}`} className="block">
        {/* Banner: big team art either side of a centered "vs" */}
        <div className="relative h-28 bg-gradient-to-br from-black/60 via-black/30 to-black/60 flex items-center justify-center gap-5 px-6">
          <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-gold/30 bg-black/70 flex items-center justify-center shrink-0 shadow-lg shadow-black/50">
            {match.team1Logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={match.team1Logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <Swords className="h-6 w-6 text-gray-500" />
            )}
          </div>
          <span className="text-gold/60 font-cinzel text-[10px] uppercase tracking-widest shrink-0">vs</span>
          <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-gold/30 bg-black/70 flex items-center justify-center shrink-0 shadow-lg shadow-black/50">
            {match.team2Logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={match.team2Logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <Swords className="h-6 w-6 text-gray-500" />
            )}
          </div>
        </div>

        <div className="p-4 pb-2">
          <p className="text-white text-sm font-semibold text-center truncate">
            {match.team1Name} <span className="text-gray-500 font-normal">vs</span> {match.team2Name}
          </p>

          <div className="flex items-center justify-center gap-1.5 flex-wrap mt-2">
            {match.tournamentName ? (
              <StatusBadge tone="linked">
                {match.tournamentName}
                {match.round ? ` · ${match.round}` : ""}
              </StatusBadge>
            ) : (
              <StatusBadge tone="none">Standalone{match.round ? ` · ${match.round}` : ""}</StatusBadge>
            )}
            {match.overlayConfigured ? (
              <StatusBadge tone="linked">Overlay</StatusBadge>
            ) : (
              <StatusBadge tone="warn">Overlay not set</StatusBadge>
            )}
            {match.auctionLinked && <StatusBadge tone="neutral">From auction</StatusBadge>}
          </div>

          {hasDetails && (
            <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
              {match.venue && (
                <p className="flex items-center gap-1.5 text-xs text-gray-400 truncate">
                  <MapPin className="h-3 w-3 text-gold/50 shrink-0" /> {match.venue}
                </p>
              )}
              {(match.date || match.time) && (
                <p className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                  {match.date && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 text-gold/50 shrink-0" /> {match.date}
                    </span>
                  )}
                  {match.time && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-gold/50 shrink-0" /> {match.time}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      </Link>

      <div className="mt-auto flex items-center justify-end gap-3 px-4 py-3">
        <button onClick={onSetupOverlay} title="Set up overlay" className="text-gray-500 hover:text-gold transition-colors">
          <Radio className="h-3.5 w-3.5" />
        </button>
        <Link href={`/match/${match.id}/edit`} className="text-gray-500 hover:text-gold transition-colors outline-none">
          <Pencil className="h-3.5 w-3.5" />
        </Link>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="bg-transparent border-none outline-none text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  MATCHES — quick-ref cards, search, multi-select + bulk delete,      */
/*  realtime sync with admin panels.                                   */
/*                                                                       */
/*  Standalone only: this tab is scoped to matches that AREN'T part of  */
/*  a tournament bracket. A match that gets connected to a bracket slot */
/*  disappears from here and shows up under the Tournaments tab instead */
/*  — one home per match, so there's never a "which tab do I check"     */
/*  question. Every list/search/select/bulk-delete operation below      */
/*  works off `standaloneMatches`, not the raw `matches` fetch, so a    */
/*  freshly-linked match can't briefly double up in both places.        */
/* ────────────────────────────────────────────────────────────────── */

export function MatchesTab({ org, userId }: { org: OrgSummary; userId: string }) {
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [matches, setMatches] = useState<FriendlyMatchSummary[]>([])
  const [auctions, setAuctions] = useState<AuctionOption[]>([])
  const [loaded, setLoaded] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Creation form
  const [teamSource, setTeamSource] = useState<TeamSource>("board")

  // Squad Board selection — teams here already have a roster, since
  // they're assigned via the Squad Board tab before a match ever gets
  // created from them.
  const [boards, setBoards] = useState<SquadBoard[]>([])
  const [boardsLoaded, setBoardsLoaded] = useState(false)
  const [boardId, setBoardId] = useState("")
  const [boardTeams, setBoardTeams] = useState<AuctionTeamOption[]>([])
  const [boardTeamsLoaded, setBoardTeamsLoaded] = useState(false)
  const [boardTeam1Id, setBoardTeam1Id] = useState("")
  const [boardTeam2Id, setBoardTeam2Id] = useState("")

  // Creating a new Squad Board inline, without leaving the dashboard — it
  // starts with zero teams, so head over to the Squad Board tab afterward
  // to assign teams and players onto it.
  const [newBoardName, setNewBoardName] = useState("")
  const [isCreatingBoard, setIsCreatingBoard] = useState(false)
  const [createBoardError, setCreateBoardError] = useState<string | null>(null)

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
  // a silent refetch so the dashboard stays current with admin panels. This
  // is also what makes a match vanish from this tab the moment it gets
  // connected to a bracket slot elsewhere — the refetch picks up its new
  // tournamentName and `standaloneMatches` below filters it out.
  useEffect(() => {
    const channel = subscribeToOrgMatches(org.id, () => {
      reload()
    })
    return () => unsubscribe(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  // Catches the "created a match, got redirected to its edit page, came
  // back here and it's missing until I refresh" case — the mount effect
  // above only fires once, and coming back from the edit page often
  // restores this component from Next's router cache rather than actually
  // remounting it. Refocusing the tab/window is a reliable second signal.
  useRefetchOnFocus(reload)

  // Load the org's Squad Boards once, up front — this is the source of
  // teams for the "board" path.
  useEffect(() => {
    setBoardsLoaded(false)
    getSquadBoardsForOrg(org.id).then((b) => {
      setBoards(b)
      setBoardsLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  useEffect(() => {
    setBoardTeam1Id("")
    setBoardTeam2Id("")
    if (!boardId) {
      setBoardTeams([])
      return
    }
    setBoardTeamsLoaded(false)
    getTeamsForAuction(boardId).then((t) => {
      setBoardTeams(t)
      setBoardTeamsLoaded(true)
    })
  }, [boardId])

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
    teamSource === "board"
      ? Boolean(boardTeam1Id && boardTeam2Id && boardTeam1Id !== boardTeam2Id)
      : Boolean(auctionTeam1Id && auctionTeam2Id && auctionTeam1Id !== auctionTeam2Id)

  const handleCreate = async () => {
    if (!canCreate) return
    setIsCreating(true)
    setCreateError(null)

    // A Squad Board is stored as a synthetic auction row under the hood, so
    // its teams/players live in the exact same tables a real auction's do —
    // createFriendlyMatch's "auction" path works unchanged for either one,
    // it just needs the right container id.
    const id = await createFriendlyMatch(org.id, {
      teamSource: "auction",
      auctionId: teamSource === "board" ? boardId : auctionId,
      team1Id: teamSource === "board" ? boardTeam1Id : auctionTeam1Id,
      team2Id: teamSource === "board" ? boardTeam2Id : auctionTeam2Id,
      round,
    })

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

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return
    setIsCreatingBoard(true)
    setCreateBoardError(null)
    const id = await createSquadBoard(org.id, userId, newBoardName.trim())
    setIsCreatingBoard(false)
    if (!id) {
      setCreateBoardError("Couldn't create the Squad Board — please try again.")
      return
    }
    setBoards((prev) => [{ id, name: newBoardName.trim(), createdAt: new Date().toISOString() }, ...prev])
    setBoardId(id)
    setNewBoardName("")
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

  // Scope this whole tab to standalone matches only — tournament-linked
  // matches are managed and displayed from the Tournaments tab, next to
  // the bracket they belong to, instead of duplicated here.
  const standaloneMatches = useMemo(() => matches.filter((m) => !m.tournamentName), [matches])
  const tournamentMatchCount = matches.length - standaloneMatches.length

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return standaloneMatches
    return standaloneMatches.filter(
      (m) =>
        m.team1Name.toLowerCase().includes(q) ||
        m.team2Name.toLowerCase().includes(q) ||
        m.round.toLowerCase().includes(q)
    )
  }, [standaloneMatches, query])

  // Everything in this tab is standalone by definition now, so every
  // visible match is selectable — no more "some rows are locked" carve-out.
  const selectableIds = useMemo(() => filtered.map((m) => m.id), [filtered])
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
      description: "This can't be undone. Matches with recorded play data will be skipped.",
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
          that tournament's page is connected to it — from that point on it's managed from the Tournaments tab, not
          here. Teams come from a Squad Board (already rostered with players) or a real auction — there's no
          free-typed team name option, so every match's teams stay tied to something real.
        </p>

        <FieldLabel>Team source</FieldLabel>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTeamSource("board")}
            className={`flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide px-3 py-2 rounded-md border transition-colors ${
              teamSource === "board" ? "bg-gold text-black border-gold" : "border-gold/30 text-gray-300 hover:text-gold"
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Squad Board
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

        {teamSource === "board" ? (
          <div className="mb-4 space-y-4">
            <div>
              <FieldLabel>Squad Board</FieldLabel>
              <div className="flex flex-col sm:flex-row gap-2">
                {!boardsLoaded ? (
                  <p className="text-gray-500 text-sm flex items-center gap-2 sm:flex-1">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading Squad Boards…
                  </p>
                ) : boards.length === 0 ? (
                  <p className="text-gray-500 text-sm italic sm:flex-1 sm:self-center">No Squad Boards in this org yet.</p>
                ) : (
                  <StyledSelect
                    value={boardId}
                    onChange={(e) => setBoardId(e.target.value)}
                    placeholder="Select a Squad Board…"
                    className="sm:flex-1 sm:min-w-0"
                  >
                    {boards.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </StyledSelect>
                )}

                {/* Create a new Squad Board right here, same row as the
                    picker — no need to leave the dashboard just to get a
                    container to build a roster in. It starts empty; teams
                    and players get assigned afterward from the Squad Board
                    tab. */}
                <Input
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="New Squad Board name"
                  className="bg-black/50 border-gold/30 text-white sm:w-56 text-sm"
                />
                <Button
                  onClick={handleCreateBoard}
                  disabled={!newBoardName.trim() || isCreatingBoard}
                  className="bg-transparent hover:bg-gold/10 text-gold border border-gold/40 font-bold disabled:opacity-50 whitespace-nowrap"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {isCreatingBoard ? "Creating…" : "Create"}
                </Button>
              </div>
              {createBoardError && (
                <p className="flex items-center gap-1.5 text-red-500 text-sm mt-2">
                  <AlertCircle className="h-4 w-4" /> {createBoardError}
                </p>
              )}
            </div>

            {boardId && (
              !boardTeamsLoaded ? (
                <p className="text-gray-500 text-sm flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading teams…
                </p>
              ) : boardTeams.length < 2 ? (
                <p className="text-gray-500 text-sm italic">
                  This Squad Board doesn't have two teams yet.{" "}
                  <span className="text-gold">Assign teams and players from the Squad Board tab →</span>
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Team 1</FieldLabel>
                    <StyledSelect
                      value={boardTeam1Id}
                      onChange={(e) => setBoardTeam1Id(e.target.value)}
                      placeholder="Select a team…"
                    >
                      {boardTeams.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.id === boardTeam2Id}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </StyledSelect>
                  </div>
                  <div>
                    <FieldLabel>Team 2</FieldLabel>
                    <StyledSelect
                      value={boardTeam2Id}
                      onChange={(e) => setBoardTeam2Id(e.target.value)}
                      placeholder="Select a team…"
                    >
                      {boardTeams.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.id === boardTeam1Id}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </StyledSelect>
                  </div>
                </div>
              )
            )}
            <p className="text-gray-500 text-xs">Each team's already-assigned roster comes along automatically.</p>
          </div>
        ) : (
          <div className="mb-4 space-y-4">
            <div>
              <FieldLabel>Auction</FieldLabel>
              <div className="flex flex-col sm:flex-row gap-2">
                {auctions.length === 0 ? (
                  <p className="text-gray-500 text-sm italic sm:flex-1 sm:self-center">No auctions in this org yet.</p>
                ) : (
                  <StyledSelect
                    value={auctionId}
                    onChange={(e) => setAuctionId(e.target.value)}
                    placeholder="Select an auction…"
                    className="sm:flex-1 sm:min-w-0"
                  >
                    {auctions.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </StyledSelect>
                )}

                {/* Create a new auction right here, same row as the picker —
                    no need to leave the dashboard just to get an auction
                    that a match can pull teams from. It starts empty; teams
                    get added afterward from the auction admin panel. */}
                <Input
                  value={newAuctionName}
                  onChange={(e) => setNewAuctionName(e.target.value)}
                  placeholder="New auction name"
                  className="bg-black/50 border-gold/30 text-white sm:w-56 text-sm"
                />
                <Button
                  onClick={handleCreateAuction}
                  disabled={!newAuctionName.trim() || isCreatingAuction}
                  className="bg-transparent hover:bg-gold/10 text-gold border border-gold/40 font-bold disabled:opacity-50 whitespace-nowrap"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {isCreatingAuction ? "Creating…" : "Create"}
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
                  </Link>
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Team 1</FieldLabel>
                    <StyledSelect
                      value={auctionTeam1Id}
                      onChange={(e) => setAuctionTeam1Id(e.target.value)}
                      placeholder="Select a team…"
                    >
                      {auctionTeams.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.id === auctionTeam2Id}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </StyledSelect>
                  </div>
                  <div>
                    <FieldLabel>Team 2</FieldLabel>
                    <StyledSelect
                      value={auctionTeam2Id}
                      onChange={(e) => setAuctionTeam2Id(e.target.value)}
                      placeholder="Select a team…"
                    >
                      {auctionTeams.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.id === auctionTeam1Id}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </StyledSelect>
                  </div>
                </div>
              )
            )}
            <p className="text-gray-500 text-xs">Each team's sold players are pulled in automatically.</p>
          </div>
        )}

        <div className="mb-4 sm:w-64">
          <FieldLabel>Round (optional)</FieldLabel>
          <Input value={round} onChange={(e) => setRound(e.target.value)} placeholder="Friendly Match" className="bg-black/50 border-gold/30 text-white" />
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
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <h2 className="text-lg font-bold text-white font-cinzel flex items-center gap-2">
            Standalone Matches
            {syncing && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />}
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teams or round…"
              className="bg-black/50 border-gold/30 text-white pl-8 text-sm"
            />
          </div>
        </div>

        {tournamentMatchCount > 0 && (
          <p className="flex items-center gap-1.5 text-gray-500 text-xs mb-4">
            <Trophy className="h-3 w-3 text-gold/50" />
            {tournamentMatchCount} tournament match{tournamentMatchCount === 1 ? "" : "es"} are managed from the{" "}
            <span className="text-gold">Tournaments tab</span>.
          </p>
        )}
        {tournamentMatchCount === 0 && <div className="mb-4" />}

        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : standaloneMatches.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No standalone matches yet — create one above.</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No matches match "{query}".</p>
        ) : (
          <div className="space-y-4">
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
                  {allSelectableChecked ? "Deselect all" : "Select all"}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  selected={selected.has(m.id)}
                  onToggleSelect={() => toggleSelectOne(m.id)}
                  onSetupOverlay={() => router.push(`/overlay/${m.auctionId}/admin`)}
                  onDelete={() => handleDelete(m)}
                  deleting={deletingId === m.id}
                />
              ))}
            </div>
          </div>
        )}
      </Panel>

      {ConfirmDialogElement}
    </div>
  )
}