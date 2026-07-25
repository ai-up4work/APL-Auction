"use client"

import { useEffect, useState } from "react"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SiteHeader } from "@/components/landing/site-header"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { pageStyles } from "@/data/site-data"
import { useAuth } from "@/context/AuthContext"
import {
  getOrgForUser,
  getTournamentsForOrg,
  createTournament,
  deleteTournament,
  getFriendlyMatchesForOrg,
  createFriendlyMatch,
  deleteFriendlyMatch,
  getPlayerBank,
  addBankPlayer,
  updateBankPlayer,
  deleteBankPlayer,
  getAssignableTeamsForOrg,
  assignBankPlayerToTeam,
  getMatchesForOverlayPicker,
  getOverlayConfig,
  saveOverlayChannels,
  saveOverlayWeatherCoords,
  type OrgSummary,
  type TournamentSummary,
  type FriendlyMatchSummary,
  type BankPlayer,
  type AssignableTeam,
  type OverlayMatchOption,
  type OverlayConfig,
} from "@/lib/organization/organization"

type Tab = "overview" | "tournaments" | "matches" | "playerBank" | "overlays"
type GateState = "checking" | "denied" | "allowed"

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: Building2 },
  { key: "tournaments", label: "Tournaments", icon: Trophy },
  { key: "matches", label: "Friendly Matches", icon: Swords },
  { key: "playerBank", label: "Player Bank", icon: Users },
  { key: "overlays", label: "Overlays", icon: Radio },
]

const ROLE_OPTIONS = ["Batter", "Bowler", "All-rounder", "WK-Batter", "Batsman", "Wicket Keeper"]

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

export default function OrganizationClient() {
  useScrollTop()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [isNavOpen, setIsNavOpen] = useState(false)
  const [gate, setGate] = useState<GateState>("checking")
  const [org, setOrg] = useState<OrgSummary | null>(null)
  const [tab, setTab] = useState<Tab>("overview")

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }
  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

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

      <SiteHeader
        activeSection="tournament"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      <section className="pt-32 sm:pt-40 pb-16 relative section-pattern">
        <div className="absolute inset-0 z-0 section-gradient" />
        <div className="container mx-auto px-4 relative z-10 max-w-5xl">
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

              {tab === "overview" && <OverviewTab org={org} />}
              {tab === "tournaments" && <TournamentsTab org={org} userId={user!.id} />}
              {tab === "matches" && <FriendlyMatchesTab org={org} />}
              {tab === "playerBank" && <PlayerBankTab org={org} userId={user!.id} />}
              {tab === "overlays" && <OverlaysTab org={org} />}
            </>
          )}
        </div>
      </section>
    </main>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  OVERVIEW                                                           */
/* ────────────────────────────────────────────────────────────────── */

function OverviewTab({ org }: { org: OrgSummary }) {
  return (
    <Panel>
      <h2 className="text-lg font-bold text-white font-cinzel mb-4">Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/[0.02] border border-gold/10 rounded-md p-4">
          <p className="text-gray-500 text-[10px] uppercase tracking-widest font-cinzel">Organization</p>
          <p className="text-white text-sm mt-1">{org.name}</p>
        </div>
        <div className="bg-white/[0.02] border border-gold/10 rounded-md p-4">
          <p className="text-gray-500 text-[10px] uppercase tracking-widest font-cinzel">Slug</p>
          <p className="text-white text-sm mt-1 font-mono">{org.slug}</p>
        </div>
        <div className="bg-white/[0.02] border border-gold/10 rounded-md p-4">
          <p className="text-gray-500 text-[10px] uppercase tracking-widest font-cinzel">Plan</p>
          <p className="text-white text-sm mt-1 capitalize">{org.plan}</p>
        </div>
      </div>
      <p className="text-gray-400 text-sm mt-6">
        Use the tabs above to create tournaments and friendly matches, manage a reusable player
        bank, and connect broadcast overlays to your matches.
      </p>
    </Panel>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  TOURNAMENTS                                                        */
/* ────────────────────────────────────────────────────────────────── */

function TournamentsTab({ org, userId }: { org: OrgSummary; userId: string }) {
  const router = useRouter()
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([])
  const [loaded, setLoaded] = useState(false)

  const [name, setName] = useState("")
  const [format, setFormat] = useState<"single_elimination" | "double_elimination" | "round_robin">(
    "single_elimination"
  )
  const [category, setCategory] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Per-row, same reasoning as FriendlyMatchesTab: only the row actually
  // being deleted should show a spinner/be disabled.
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    getTournamentsForOrg(org.id).then((t) => {
      setTournaments(t)
      setLoaded(true)
    })
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
    if (
      !confirm(
        `Delete the tournament "${t.name}"? This can't be undone, and will fail if it still has auctions, teams, or matches attached.`
      )
    ) {
      return
    }
    setDeletingId(t.id)
    setDeleteError(null)
    const result = await deleteTournament(t.id)
    setDeletingId(null)
    if (!result.ok) {
      setDeleteError(result.error ?? "Couldn't delete that tournament — please try again.")
      return
    }
    setTournaments((prev) => prev.filter((x) => x.id !== t.id))
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
          {isCreating ? "Creating…" : "Create & Continue Setup"}
        </Button>
      </Panel>

      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4">Your Tournaments</h2>
        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : tournaments.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No tournaments yet — create one above.</p>
        ) : (
          <div className="space-y-2">
            {deleteError && (
              <p className="flex items-center gap-1.5 text-red-500 text-sm mb-2">
                <AlertCircle className="h-4 w-4" /> {deleteError}
              </p>
            )}
            {tournaments.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 bg-white/[0.02] border border-gold/10 hover:border-gold/40 rounded-md px-4 py-3 transition-colors"
              >
                <Link href={`/tournaments/${t.id}`} className="min-w-0 flex-1">
                  <p className="text-white text-sm font-semibold truncate">{t.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {t.format.replace("_", " ")} · {t.status}
                    {t.category ? ` · ${t.category}` : ""}
                  </p>
                </Link>
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
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  FRIENDLY MATCHES                                                    */
/* ────────────────────────────────────────────────────────────────── */

function FriendlyMatchesTab({ org }: { org: OrgSummary }) {
  const router = useRouter()
  const [matches, setMatches] = useState<FriendlyMatchSummary[]>([])
  const [loaded, setLoaded] = useState(false)

  const [team1, setTeam1] = useState("")
  const [team2, setTeam2] = useState("")
  const [round, setRound] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Delete state is tracked per-row (deletingId) rather than as a single
  // shared bool, so removing one match doesn't disable the buttons on
  // every other row in the list while its request is in flight.
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    getFriendlyMatchesForOrg(org.id).then((m) => {
      setMatches(m)
      setLoaded(true)
    })
  }, [org.id])

  const handleCreate = async () => {
    if (!team1.trim() || !team2.trim()) return
    setIsCreating(true)
    setCreateError(null)
    const id = await createFriendlyMatch(org.id, { team1Name: team1.trim(), team2Name: team2.trim(), round })
    setIsCreating(false)
    if (!id) {
      setCreateError("Couldn't create the match — please try again.")
      return
    }
    router.push(`/match/${id}/edit`)
  }

  const handleDelete = async (match: FriendlyMatchSummary) => {
    if (
      !confirm(
        `Delete the friendly match "${match.team1Name} vs ${match.team2Name}"? This can't be undone.`
      )
    ) {
      return
    }
    setDeletingId(match.id)
    setDeleteError(null)
    const ok = await deleteFriendlyMatch(match.id)
    setDeletingId(null)
    if (!ok) {
      setDeleteError("Couldn't delete that match — please try again.")
      return
    }
    setMatches((prev) => prev.filter((m) => m.id !== match.id))
  }

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-gold" /> Create a Friendly Match
        </h2>
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
        <div className="mb-4">
          <FieldLabel>Round / Label (optional)</FieldLabel>
          <Input value={round} onChange={(e) => setRound(e.target.value)} placeholder="Friendly Match" className="bg-black/50 border-gold/30 text-white sm:w-80" />
        </div>
        {createError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mb-3">
            <AlertCircle className="h-4 w-4" /> {createError}
          </p>
        )}
        <Button
          onClick={handleCreate}
          disabled={!team1.trim() || !team2.trim() || isCreating}
          className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
        >
          {isCreating ? "Creating…" : "Create & Continue Setup"}
        </Button>
      </Panel>

      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4">Your Friendly Matches</h2>
        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : matches.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No friendly matches yet — create one above.</p>
        ) : (
          <div className="space-y-2">
            {deleteError && (
              <p className="flex items-center gap-1.5 text-red-500 text-sm mb-2">
                <AlertCircle className="h-4 w-4" /> {deleteError}
              </p>
            )}
            {matches.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 bg-white/[0.02] border border-gold/10 hover:border-gold/40 rounded-md px-4 py-3 transition-colors"
              >
                <Link href={`/match/${m.id}`} className="min-w-0 flex-1">
                  <p className="text-white text-sm font-semibold truncate">
                    {m.team1Name} vs {m.team2Name}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">{m.round}</p>
                </Link>
                <div className="flex items-center gap-3 shrink-0">
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
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  PLAYER BANK                                                         */
/* ────────────────────────────────────────────────────────────────── */

function PlayerBankTab({ org, userId }: { org: OrgSummary; userId: string }) {
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
    if (!confirm(`Remove ${player.name} from the player bank? This doesn't affect any team they're already on.`)) return
    const ok = await deleteBankPlayer(player.id)
    if (ok) setPlayers((prev) => prev.filter((p) => p.id !== player.id))
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
          <p className="text-gray-500 text-sm mb-4">No teams found yet — create a tournament or friendly match with teams first.</p>
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

/* ────────────────────────────────────────────────────────────────── */
/*  OVERLAYS                                                            */
/* ────────────────────────────────────────────────────────────────── */

function OverlaysTab({ org }: { org: OrgSummary }) {
  const [matches, setMatches] = useState<OverlayMatchOption[]>([])
  const [selectedMatchId, setSelectedMatchId] = useState("")
  const [config, setConfig] = useState<OverlayConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(false)

  const [channelLabel, setChannelLabel] = useState("")
  const [channelUrl, setChannelUrl] = useState("")
  const [lat, setLat] = useState("")
  const [lng, setLng] = useState("")

  const [savingChannels, setSavingChannels] = useState(false)
  const [savingWeather, setSavingWeather] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  useEffect(() => {
    getMatchesForOverlayPicker(org.id).then(setMatches)
  }, [org.id])

  useEffect(() => {
    if (!selectedMatchId) {
      setConfig(null)
      return
    }
    setLoadingConfig(true)
    getOverlayConfig(selectedMatchId).then((c) => {
      setConfig(c)
      setLat(c.weatherLat?.toString() ?? "")
      setLng(c.weatherLng?.toString() ?? "")
      setLoadingConfig(false)
    })
  }, [selectedMatchId])

  const addChannel = async () => {
    if (!config || !channelLabel.trim() || !channelUrl.trim()) return
    const updated = [...config.channels, { label: channelLabel.trim(), url: channelUrl.trim() }]
    setSavingChannels(true)
    const ok = await saveOverlayChannels(selectedMatchId, updated)
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
    const ok = await saveOverlayChannels(selectedMatchId, updated)
    setSavingChannels(false)
    if (ok) setConfig({ ...config, channels: updated })
  }

  const saveWeather = async () => {
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return
    setSavingWeather(true)
    const ok = await saveOverlayWeatherCoords(selectedMatchId, latNum, lngNum)
    setSavingWeather(false)
    if (ok) {
      setSaveMsg("Weather location saved.")
      setTimeout(() => setSaveMsg(null), 2000)
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4 flex items-center gap-2">
          <Radio className="h-4 w-4 text-gold" /> Connect Overlays
        </h2>
        <FieldLabel>Match</FieldLabel>
        <select
          value={selectedMatchId}
          onChange={(e) => setSelectedMatchId(e.target.value)}
          className="w-full sm:w-96 bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5"
        >
          <option value="">Select a match…</option>
          {matches.map((m) => (
            <option key={m.matchId} value={m.matchId}>{m.label}</option>
          ))}
        </select>
      </Panel>

      {selectedMatchId && (
        loadingConfig || !config ? (
          <Panel>
            <p className="text-gray-500 text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading overlay config…
            </p>
          </Panel>
        ) : (
          <>
            <Panel>
              <h3 className="text-white font-bold font-cinzel mb-4 text-sm uppercase tracking-widest">On-Air Channels</h3>
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
              <div className="flex flex-col sm:flex-row gap-2">
                <Input value={channelLabel} onChange={(e) => setChannelLabel(e.target.value)} placeholder="Channel name, e.g. YouTube" className="bg-black/50 border-gold/30 text-white sm:w-48" />
                <Input value={channelUrl} onChange={(e) => setChannelUrl(e.target.value)} placeholder="Stream URL" className="bg-black/50 border-gold/30 text-white flex-1" />
                <Button onClick={addChannel} disabled={!channelLabel.trim() || !channelUrl.trim() || savingChannels} className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50 whitespace-nowrap">
                  <Plus className="mr-1.5 h-4 w-4" /> Add
                </Button>
              </div>
            </Panel>

            <Panel>
              <h3 className="text-white font-bold font-cinzel mb-4 text-sm uppercase tracking-widest">Weather Location</h3>
              <p className="text-gray-500 text-xs mb-4">
                Sets the venue coordinates the weather overlay reads from. The live reading itself
                is populated separately — this only points it at the right place.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4 sm:w-80">
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
            </Panel>

            {saveMsg && (
              <p className="flex items-center gap-1.5 text-green-400 text-sm">
                <CheckCircle2 className="h-4 w-4" /> {saveMsg}
              </p>
            )}
          </>
        )
      )}
    </div>
  )
}