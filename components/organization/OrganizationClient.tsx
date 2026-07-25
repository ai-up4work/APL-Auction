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
  Wand2,
  Gamepad2,
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
  // Matches: renamed conceptually to "matches" (standalone + tournament-linked),
  // but keeping existing lib function names where they already do the right thing.
  getFriendlyMatchesForOrg,
  createFriendlyMatch,
  deleteFriendlyMatch,
  getPlayerBank,
  addBankPlayer,
  updateBankPlayer,
  deleteBankPlayer,
  getAssignableTeamsForOrg,
  assignBankPlayerToTeam,
  getOverlayConfig,
  saveOverlayChannels,
  saveOverlayWeatherCoords,
  getAuctionsForOrg,
  getTeamsForAuction,
  type OrgSummary,
  type TournamentSummary,
  type FriendlyMatchSummary,
  type BankPlayer,
  type AssignableTeam,
  type OverlayConfig,
  type AuctionOption,
  type AuctionTeamOption,
} from "@/lib/organization/organization"

type Tab = "overview" | "matches" | "tournaments" | "playerBank"
type GateState = "checking" | "denied" | "allowed"
type TeamSource = "manual" | "auction"

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: Building2 },
  { key: "matches", label: "Matches", icon: Swords },
  { key: "tournaments", label: "Tournaments", icon: Trophy },
  { key: "playerBank", label: "Player Bank", icon: Users },
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

function Badge({ tone, children }: { tone: "gold" | "gray"; children: React.ReactNode }) {
  return (
    <span
      className={`text-[10px] uppercase tracking-widest font-cinzel px-2 py-0.5 rounded border ${
        tone === "gold" ? "border-gold/40 text-gold" : "border-white/15 text-gray-400"
      }`}
    >
      {children}
    </span>
  )
}

export default function OrganizationClient() {
  useScrollTop()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [isNavOpen, setIsNavOpen] = useState(false)
  const [gate, setGate] = useState<GateState>("checking")
  const [org, setOrg] = useState<OrgSummary | null>(null)
  const [tab, setTab] = useState<Tab>("overview")

  // Which match is currently having its overlay configured. Lives at this
  // level (not inside MatchesTab's local state tree) only so a future
  // "jump to overlay setup" deep link from another tab can set it directly.
  const [overlayMatchId, setOverlayMatchId] = useState<string | null>(null)

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

              {tab === "overview" && <OverviewTab org={org} onJump={setTab} />}
              {tab === "matches" && (
                <MatchesTab
                  org={org}
                  overlayMatchId={overlayMatchId}
                  onOpenOverlay={setOverlayMatchId}
                  onCloseOverlay={() => setOverlayMatchId(null)}
                />
              )}
              {tab === "tournaments" && <TournamentsTab org={org} userId={user!.id} />}
              {tab === "playerBank" && <PlayerBankTab org={org} userId={user!.id} />}
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

function OverviewTab({ org, onJump }: { org: OrgSummary; onJump: (t: Tab) => void }) {
  return (
    <div className="space-y-6">
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
      </Panel>

      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4">Where things live</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => onJump("matches")}
            className="text-left bg-white/[0.02] border border-gold/10 hover:border-gold/40 rounded-md p-4 transition-colors"
          >
            <Swords className="h-4 w-4 text-gold mb-2" />
            <p className="text-white text-sm font-semibold">Matches</p>
            <p className="text-gray-500 text-xs mt-1">
              Create a standalone match, choose manual or auction-linked teams, and optionally set up an overlay.
            </p>
          </button>
          <button
            onClick={() => onJump("tournaments")}
            className="text-left bg-white/[0.02] border border-gold/10 hover:border-gold/40 rounded-md p-4 transition-colors"
          >
            <Trophy className="h-4 w-4 text-gold mb-2" />
            <p className="text-white text-sm font-semibold">Tournaments</p>
            <p className="text-gray-500 text-xs mt-1">
              Create a tournament, then build its bracket — that's where a bracket slot gets connected to a match.
            </p>
          </button>
          <button
            onClick={() => onJump("playerBank")}
            className="text-left bg-white/[0.02] border border-gold/10 hover:border-gold/40 rounded-md p-4 transition-colors"
          >
            <Users className="h-4 w-4 text-gold mb-2" />
            <p className="text-white text-sm font-semibold">Player Bank</p>
            <p className="text-gray-500 text-xs mt-1">
              A reusable pool of players you can assign onto any team, in any match or tournament.
            </p>
          </button>
        </div>
      </Panel>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  MATCHES — standalone by default; tournament link is read-only here */
/* ────────────────────────────────────────────────────────────────── */

function MatchesTab({
  org,
  overlayMatchId,
  onOpenOverlay,
  onCloseOverlay,
}: {
  org: OrgSummary
  overlayMatchId: string | null
  onOpenOverlay: (id: string) => void
  onCloseOverlay: () => void
}) {
  const router = useRouter()
  const [matches, setMatches] = useState<FriendlyMatchSummary[]>([])
  const [auctions, setAuctions] = useState<AuctionOption[]>([])
  const [loaded, setLoaded] = useState(false)

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

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getFriendlyMatchesForOrg(org.id), getAuctionsForOrg(org.id)]).then(([m, a]) => {
      setMatches(m)
      setAuctions(a)
      setLoaded(true)
    })
  }, [org.id])

  // Once an auction is picked, load its teams so the org can choose which
  // two are actually playing — an auction usually has more than two.
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
    router.push(`/match/${id}/edit`)
  }

  const handleDelete = async (match: FriendlyMatchSummary) => {
    if (match.tournamentName) {
      alert(
        `"${match.team1Name} vs ${match.team2Name}" is connected to the ${match.tournamentName} bracket. Disconnect it from the bracket on the tournament's edit page before deleting it here.`
      )
      return
    }
    if (!confirm(`Delete the match "${match.team1Name} vs ${match.team2Name}"? This can't be undone.`)) return
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
                <p className="text-gray-500 text-sm italic">No auctions in this org yet — run one first, or use manual teams.</p>
              ) : (
                <select
                  value={auctionId}
                  onChange={(e) => setAuctionId(e.target.value)}
                  className="w-full sm:w-80 bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2.5"
                >
                  <option value="">Select an auction…</option>
                  {auctions.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
            </div>

            {auctionId && (
              !auctionTeamsLoaded ? (
                <p className="text-gray-500 text-sm flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading teams…
                </p>
              ) : auctionTeams.length < 2 ? (
                <p className="text-gray-500 text-sm italic">This auction doesn't have two teams yet.</p>
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
        <h2 className="text-lg font-bold text-white font-cinzel mb-4">Your Matches</h2>
        {!loaded ? (
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : matches.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No matches yet — create one above.</p>
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
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {m.tournamentName ? (
                      <Badge tone="gold">{m.tournamentName}{m.round ? ` · ${m.round}` : ""}</Badge>
                    ) : (
                      <Badge tone="gray">Standalone</Badge>
                    )}
                    {m.overlayConfigured && <Badge tone="gray">Overlay set up</Badge>}
                  </div>
                </Link>
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
/*  TOURNAMENTS — bracket + match-connection happens on the edit page  */
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
        `Delete the tournament "${t.name}"? This can't be undone, and will fail if it still has auctions, teams, or bracket matches attached.`
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
          {isCreating ? "Creating…" : "Create & Build Bracket"}
        </Button>
      </Panel>

      <Panel>
        <h2 className="text-lg font-bold text-white font-cinzel mb-4">Your Tournaments</h2>
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
/*  PLAYER BANK — unchanged                                             */
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