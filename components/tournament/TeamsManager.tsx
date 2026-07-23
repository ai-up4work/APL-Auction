"use client"

import { useEffect, useState } from "react"
import {
  Shield,
  Users,
  Plus,
  Trash2,
  Crown,
  Link2,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Unlink,
  Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getTeamsWithPlayers,
  addManualTeam,
  updateManualTeam,
  deleteManualTeam,
  addManualPlayer,
  setManualCaptain,
  updateManualPlayerName,
  deleteManualPlayer,
  getLinkedAuctionInfo,
  getAllLinkedAuctions,
  getLinkableAuctionsForOrg,
  linkAuctionToTournament,
  unlinkAuctionFromTournament,
  switchManualToRealAuction,
  type ManualTeam,
  type ManualPlayerInput,
  type LinkedAuctionInfo,
  type LinkableAuction,
} from "@/lib/tournament/manualTeams"


interface TeamsManagerProps {
  tournamentId: string
  orgId: string
  tournamentName: string
}

type Phase = "loading" | "choose" | "linking" | "selectLinked" | "manage"

const ROLE_OPTIONS: ManualPlayerInput["role"][] = [
  "Batter",
  "Bowler",
  "All-rounder",
  "WK-Batter",
  "Batsman",
  "Wicket Keeper",
]

export default function TeamsManager({ tournamentId, orgId, tournamentName }: TeamsManagerProps) {
  const [phase, setPhase] = useState<Phase>("loading")
  const [linkedAuction, setLinkedAuction] = useState<LinkedAuctionInfo | null>(null)
  const [teams, setTeams] = useState<ManualTeam[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  // "Link an existing auction" picker
  const [linkableAuctions, setLinkableAuctions] = useState<LinkableAuction[]>([])
  const [selectedAuctionId, setSelectedAuctionId] = useState("")
  const [isLinking, setIsLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  // Add-team form
  const [newTeamCode, setNewTeamCode] = useState("")
  const [newTeamName, setNewTeamName] = useState("")
  const [newTeamColor, setNewTeamColor] = useState("#3B8BD4")
  const [isAddingTeam, setIsAddingTeam] = useState(false)
  const [addTeamError, setAddTeamError] = useState<string | null>(null)

  // Per-team add-player forms, keyed by team id
  const [playerForms, setPlayerForms] = useState<
    Record<string, { name: string; role: ManualPlayerInput["role"]; isCaptain: boolean }>
  >({})
  const [addingPlayerFor, setAddingPlayerFor] = useState<string | null>(null)
  const [playerErrors, setPlayerErrors] = useState<Record<string, string>>({})

  // Inline team-name / player-name editing
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingTeamName, setEditingTeamName] = useState("")
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editingPlayerName, setEditingPlayerName] = useState("")

  const [isUnlinking, setIsUnlinking] = useState(false)

  // "Switch to a real auction" (manual mode only)
  const [showSwitchPicker, setShowSwitchPicker] = useState(false)
  const [switchableAuctions, setSwitchableAuctions] = useState<LinkableAuction[]>([])
  const [selectedSwitchAuctionId, setSelectedSwitchAuctionId] = useState("")
  const [isSwitching, setIsSwitching] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)

  // Multiple auctions already linked to this tournament — needs a pick
  const [linkedCandidates, setLinkedCandidates] = useState<LinkedAuctionInfo[]>([])
  const [selectedCandidateId, setSelectedCandidateId] = useState("")
  const [isSelectingLinked, setIsSelectingLinked] = useState(false)
  const [selectLinkedError, setSelectLinkedError] = useState<string | null>(null)

  const loadEverything = async () => {
    setLoadError(null)
    const candidates = await getAllLinkedAuctions(tournamentId)

    if (candidates.length === 0) {
      setLinkedAuction(null)
      setPhase("choose")
      return
    }

    if (candidates.length > 1) {
      // More than one auction is linked to this tournament — the schema
      // doesn't prevent that, but only one should actually be "active."
      // Stop and make the user choose rather than silently picking one.
      setLinkedCandidates(candidates)
      setSelectedCandidateId("")
      setSelectLinkedError(null)
      setPhase("selectLinked")
      return
    }

    setLinkedAuction(candidates[0])
    const t = await getTeamsWithPlayers(tournamentId)
    setTeams(t)
    setPhase("manage")
  }

  const confirmSelectLinked = async () => {
    if (!selectedCandidateId) return
    setIsSelectingLinked(true)
    setSelectLinkedError(null)

    const others = linkedCandidates.filter((c) => c.id !== selectedCandidateId)
    const results = await Promise.all(others.map((c) => unlinkAuctionFromTournament(c.id)))
    setIsSelectingLinked(false)

    if (results.some((ok) => !ok)) {
      setSelectLinkedError("Couldn't unlink one of the other auctions — please try again.")
      return
    }
    await loadEverything()
  }

  useEffect(() => {
    loadEverything()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId])

  const openLinkPicker = async () => {
    setPhase("linking")
    setLinkError(null)
    const options = await getLinkableAuctionsForOrg(orgId)
    setLinkableAuctions(options)
  }

  const confirmLinkAuction = async () => {
    if (!selectedAuctionId) return
    setIsLinking(true)
    setLinkError(null)
    const ok = await linkAuctionToTournament(selectedAuctionId, tournamentId)
    setIsLinking(false)
    if (!ok) {
      setLinkError("Couldn't link that auction — please try again.")
      return
    }
    await loadEverything()
  }

  const startManualMode = async () => {
    // Creating the first team is what actually creates the manual auction
    // container (getOrCreateManualAuction runs lazily inside addManualTeam),
    // so just drop straight into the manage view with an empty roster —
    // the container gets created the moment they add a team.
    setLinkedAuction({ id: "", name: `${tournamentName} — Teams`, status: "completed", isManual: true })
    setTeams([])
    setPhase("manage")
  }

  const handleUnlink = async () => {
    if (!linkedAuction?.id) return
    const message = linkedAuction.isManual
      ? "Unlink these manually-entered teams? They stay saved and untouched — just detached from this tournament's public page until you link something again."
      : "Unlink this auction? Its teams and players won't show on the tournament page anymore, but nothing gets deleted."
    if (!confirm(message)) return
    setIsUnlinking(true)
    const ok = await unlinkAuctionFromTournament(linkedAuction.id)
    setIsUnlinking(false)
    if (ok) {
      setLinkedAuction(null)
      setTeams([])
      setPhase("choose")
    }
  }

  const openSwitchPicker = async () => {
    setSwitchError(null)
    setShowSwitchPicker(true)
    const options = await getLinkableAuctionsForOrg(orgId)
    setSwitchableAuctions(options)
  }

  const confirmSwitchToRealAuction = async () => {
    if (!selectedSwitchAuctionId || !linkedAuction?.id) return
    setIsSwitching(true)
    setSwitchError(null)
    const result = await switchManualToRealAuction(tournamentId, linkedAuction.id, selectedSwitchAuctionId)
    setIsSwitching(false)
    if (!result.ok) {
      setSwitchError(result.error ?? "Couldn't switch to that auction — please try again.")
      return
    }
    setShowSwitchPicker(false)
    setSelectedSwitchAuctionId("")
    await loadEverything()
  }

  const handleAddTeam = async () => {
    if (!newTeamCode.trim() || !newTeamName.trim()) return
    setIsAddingTeam(true)
    setAddTeamError(null)
    const team = await addManualTeam(tournamentId, orgId, tournamentName, {
      code: newTeamCode.trim(),
      name: newTeamName.trim(),
      color: newTeamColor,
    })
    setIsAddingTeam(false)
    if (!team) {
      setAddTeamError("Couldn't add that team — check the code isn't already used and try again.")
      return
    }
    setTeams((prev) => [...prev, team])
    setNewTeamCode("")
    setNewTeamName("")
    setNewTeamColor("#3B8BD4")
    // First team just created the manual auction — refresh the linked-auction badge.
    if (!linkedAuction?.id) {
      const info = await getLinkedAuctionInfo(tournamentId)
      setLinkedAuction(info)
    }
  }

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Delete ${teamName}? This also removes every player on its roster.`)) return
    const ok = await deleteManualTeam(teamId)
    if (ok) setTeams((prev) => prev.filter((t) => t.id !== teamId))
  }

  const startEditTeamName = (team: ManualTeam) => {
    setEditingTeamId(team.id)
    setEditingTeamName(team.name)
  }
  const saveTeamName = async (teamId: string) => {
    if (!editingTeamName.trim()) return
    const ok = await updateManualTeam(teamId, { name: editingTeamName.trim() })
    if (ok) {
      setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, name: editingTeamName.trim() } : t)))
      setEditingTeamId(null)
    }
  }

  const getPlayerForm = (teamId: string) =>
    playerForms[teamId] ?? { name: "", role: "Batter" as ManualPlayerInput["role"], isCaptain: false }

  const setPlayerForm = (teamId: string, patch: Partial<{ name: string; role: ManualPlayerInput["role"]; isCaptain: boolean }>) =>
    setPlayerForms((prev) => ({ ...prev, [teamId]: { ...getPlayerForm(teamId), ...patch } }))

  const handleAddPlayer = async (team: ManualTeam) => {
    const form = getPlayerForm(team.id)
    if (!form.name.trim()) return
    setAddingPlayerFor(team.id)
    setPlayerErrors((prev) => ({ ...prev, [team.id]: "" }))

    const player = await addManualPlayer(team.auctionId, team.id, team.code, {
      name: form.name.trim(),
      role: form.role,
      isCaptain: form.isCaptain,
    })
    setAddingPlayerFor(null)

    if (!player) {
      setPlayerErrors((prev) => ({ ...prev, [team.id]: "Couldn't add that player — please try again." }))
      return
    }

    setTeams((prev) =>
      prev.map((t) =>
        t.id === team.id
          ? {
              ...t,
              players: form.isCaptain
                ? [...t.players.map((p) => ({ ...p, isCaptain: false })), player]
                : [...t.players, player],
            }
          : t
      )
    )
    setPlayerForms((prev) => ({ ...prev, [team.id]: { name: "", role: "Batter", isCaptain: false } }))
  }

  const handleToggleCaptain = async (team: ManualTeam, playerId: string, makeCaptain: boolean) => {
    const ok = await setManualCaptain(team.id, team.code, playerId, makeCaptain)
    if (!ok) return
    setTeams((prev) =>
      prev.map((t) =>
        t.id !== team.id
          ? t
          : {
              ...t,
              players: t.players.map((p) => ({ ...p, isCaptain: p.id === playerId ? makeCaptain : false })),
            }
      )
    )
  }

  const startEditPlayerName = (playerId: string, currentName: string) => {
    setEditingPlayerId(playerId)
    setEditingPlayerName(currentName)
  }
  const savePlayerName = async (teamId: string, playerId: string) => {
    if (!editingPlayerName.trim()) return
    const ok = await updateManualPlayerName(playerId, editingPlayerName.trim())
    if (ok) {
      setTeams((prev) =>
        prev.map((t) =>
          t.id !== teamId
            ? t
            : { ...t, players: t.players.map((p) => (p.id === playerId ? { ...p, name: editingPlayerName.trim() } : p)) }
        )
      )
      setEditingPlayerId(null)
    }
  }

  const handleDeletePlayer = async (teamId: string, playerId: string) => {
    const ok = await deleteManualPlayer(playerId)
    if (ok) {
      setTeams((prev) =>
        prev.map((t) => (t.id !== teamId ? t : { ...t, players: t.players.filter((p) => p.id !== playerId) }))
      )
    }
  }

  // ── LOADING ──────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-bold text-white font-cinzel mb-2">Teams & Players</h2>
        <p className="text-gray-500 text-sm flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking for a linked auction…
        </p>
      </div>
    )
  }

  // ── CHOOSE: no auction linked yet ───────────────────────────────────
  if (phase === "choose") {
    return (
      <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-bold text-white font-cinzel mb-2">Teams & Players</h2>
        <p className="text-gray-400 text-sm mb-6">
          This tournament doesn't have any teams yet. There are two ways to get them here — pick
          whichever matches how you're running this event.
        </p>
        {loadError && <p className="text-red-500 text-sm mb-4">{loadError}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={openLinkPicker}
            className="text-left bg-white/[0.02] border border-gold/20 hover:border-gold/60 rounded-lg p-5 transition-colors"
          >
            <Link2 className="h-5 w-5 text-gold mb-3" />
            <p className="text-white font-bold font-cinzel mb-1">Link an existing auction</p>
            <p className="text-gray-400 text-xs">
              Already ran a live bidding auction for this tournament? Attach it here — teams and
              their sold players will show up automatically, exactly as the auction settled.
            </p>
          </button>
          <button
            onClick={startManualMode}
            className="text-left bg-white/[0.02] border border-gold/20 hover:border-gold/60 rounded-lg p-5 transition-colors"
          >
            <Sparkles className="h-5 w-5 text-gold mb-3" />
            <p className="text-white font-bold font-cinzel mb-1">Add teams manually</p>
            <p className="text-gray-400 text-xs">
              No auction for this one — type in your teams and rosters directly. They'll show on
              the tournament page's Squads tab just like an auction result would.
            </p>
          </button>
        </div>
      </div>
    )
  }

  // ── LINKING: picking a real auction to attach ───────────────────────
  if (phase === "linking") {
    return (
      <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-bold text-white font-cinzel mb-4">Link an Auction</h2>
        {linkableAuctions.length === 0 ? (
          <p className="text-gray-400 text-sm mb-4">
            No unlinked auctions found in your organization. Create or finish setting up an
            auction first, then come back here to attach it.
          </p>
        ) : (
          <>
            <label className="text-gray-400 text-sm block mb-2">Choose an auction</label>
            <select
              value={selectedAuctionId}
              onChange={(e) => setSelectedAuctionId(e.target.value)}
              className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2 mb-4"
            >
              <option value="">Select an auction…</option>
              {linkableAuctions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.status}
                </option>
              ))}
            </select>
          </>
        )}
        {linkError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mb-4">
            <AlertCircle className="h-4 w-4" /> {linkError}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button
            onClick={confirmLinkAuction}
            disabled={!selectedAuctionId || isLinking}
            className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
          >
            {isLinking ? "Linking…" : "Link Auction"}
          </Button>
          <Button
            onClick={() => setPhase("choose")}
            className="bg-transparent hover:bg-white/5 text-gray-300 border border-gold/20"
          >
            Back
          </Button>
        </div>
      </div>
    )
  }

  // ── SELECT LINKED: more than one auction is linked to this tournament ─
  if (phase === "selectLinked") {
    return (
      <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-bold text-white font-cinzel mb-2">Multiple Auctions Found</h2>
        <p className="text-gray-400 text-sm mb-4">
          This tournament is currently linked to {linkedCandidates.length} auctions at once — only
          one can be active at a time. Pick which one this tournament should use below; the others
          will be unlinked, not deleted, so their data is safe and they're free to be linked to a
          different tournament later.
        </p>
        <div className="space-y-2 mb-4">
          {linkedCandidates.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-3 border border-gold/10 rounded-md p-3 bg-white/[0.02] cursor-pointer hover:border-gold/40 transition-colors"
            >
              <input
                type="radio"
                name="linkedCandidate"
                checked={selectedCandidateId === c.id}
                onChange={() => setSelectedCandidateId(c.id)}
              />
              <span className="text-white text-sm font-semibold">{c.name}</span>
              <span className="text-gray-500 text-xs">({c.isManual ? "Manual entry" : c.status})</span>
            </label>
          ))}
        </div>
        {selectLinkedError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mb-4">
            <AlertCircle className="h-4 w-4" /> {selectLinkedError}
          </p>
        )}
        <Button
          onClick={confirmSelectLinked}
          disabled={!selectedCandidateId || isSelectingLinked}
          className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
        >
          {isSelectingLinked ? "Applying…" : "Use This One"}
        </Button>
      </div>
    )
  }

  // ── MANAGE: an auction (real or manual) is linked ───────────────────
  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
        <h2 className="text-lg font-bold text-white font-cinzel">Teams & Players</h2>
        {linkedAuction && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest font-cinzel px-2 py-1 rounded bg-gold/10 text-gold border border-gold/20">
              {linkedAuction.isManual ? "Manual" : "Linked Auction"}
            </span>
            {linkedAuction.id && (
              <button
                onClick={handleUnlink}
                disabled={isUnlinking}
                className="text-gray-400 hover:text-red-400 text-xs flex items-center gap-1 disabled:opacity-50"
                title="Unlink this auction"
              >
                <Unlink className="h-3.5 w-3.5" /> Unlink
              </button>
            )}
          </div>
        )}
      </div>
      <p className="text-gray-400 text-sm mb-6">
        {linkedAuction?.isManual
          ? "Teams and players added here show up directly on the tournament page's Squads tab."
          : `Reading from "${linkedAuction?.name}". Teams and their sold players are shown below exactly as the auction settled — add more manually if you need to.`}
      </p>

      {/* Switch manual -> real auction */}
      {linkedAuction?.isManual && linkedAuction.id && !showSwitchPicker && (
        <button
          onClick={openSwitchPicker}
          className="w-full text-left bg-white/[0.02] border border-gold/20 hover:border-gold/60 rounded-lg p-4 mb-6 transition-colors flex items-center gap-3"
        >
          <Link2 className="h-4 w-4 text-gold shrink-0" />
          <span className="text-sm text-gray-300">
            <span className="text-white font-semibold">Ran a real auction after all?</span>{" "}
            Switch to it — every team and player below gets copied in as sold, just like a real
            auction result, and this manual list is retired.
          </span>
        </button>
      )}

      {linkedAuction?.isManual && showSwitchPicker && (
        <div className="border border-gold/20 rounded-lg p-4 mb-6 bg-white/[0.02]">
          <p className="text-white font-semibold text-sm mb-1">Switch to a real auction</p>
          <p className="text-gray-400 text-xs mb-3">
            All {teams.length} team{teams.length === 1 ? "" : "s"} and their players will be copied
            into the auction you pick below, marked sold exactly as-is. This manual list is then
            deleted — nothing is left duplicated.
          </p>
          {switchableAuctions.length === 0 ? (
            <p className="text-gray-400 text-sm mb-3">
              No unlinked auctions found in your organization yet.
            </p>
          ) : (
            <select
              value={selectedSwitchAuctionId}
              onChange={(e) => setSelectedSwitchAuctionId(e.target.value)}
              className="w-full bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2 mb-3"
            >
              <option value="">Select an auction…</option>
              {switchableAuctions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.status}
                </option>
              ))}
            </select>
          )}
          {switchError && (
            <p className="flex items-center gap-1.5 text-red-500 text-xs mb-3">
              <AlertCircle className="h-3.5 w-3.5" /> {switchError}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button
              onClick={confirmSwitchToRealAuction}
              disabled={!selectedSwitchAuctionId || isSwitching}
              className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
            >
              {isSwitching ? "Switching…" : "Copy & Switch"}
            </Button>
            <Button
              onClick={() => setShowSwitchPicker(false)}
              disabled={isSwitching}
              className="bg-transparent hover:bg-white/5 text-gray-300 border border-gold/20"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Team list */}
      <div className="space-y-4 mb-6">
        {teams.length === 0 && (
          <p className="text-gray-500 text-sm italic">No teams yet — add the first one below.</p>
        )}
        {teams.map((team) => (
          <div key={team.id} className="border border-gold/10 rounded-lg p-4 bg-white/[0.02]">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-4 w-4 rounded-full border border-white/20"
                  style={{ backgroundColor: team.color }}
                />
                <Shield className="h-4 w-4 text-gold" />
                {editingTeamId === team.id ? (
                  <>
                    <Input
                      value={editingTeamName}
                      onChange={(e) => setEditingTeamName(e.target.value)}
                      className="bg-black/50 border-gold/30 text-white h-8 w-48"
                    />
                    <button onClick={() => saveTeamName(team.id)} className="text-gold text-xs font-semibold">
                      Save
                    </button>
                    <button onClick={() => setEditingTeamId(null)} className="text-gray-500 text-xs">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-white font-bold font-cinzel">{team.name}</span>
                    <span className="text-gray-500 text-xs">({team.code})</span>
                    <button onClick={() => startEditTeamName(team)} className="text-gray-500 hover:text-gold">
                      <Pencil className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={() => handleDeleteTeam(team.id, team.name)}
                className="text-gray-400 hover:text-red-400 text-xs flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete team
              </button>
            </div>

            {/* Player roster */}
            <div className="space-y-1.5 mb-3">
              {team.players.length === 0 && (
                <p className="text-gray-500 text-xs italic pl-1">No players on this roster yet.</p>
              )}
              {team.players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 bg-black/30 rounded-md px-3 py-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => handleToggleCaptain(team, p.id, !p.isCaptain)}
                      title={p.isCaptain ? "Remove captain" : "Make captain"}
                    >
                      <Crown className={`h-3.5 w-3.5 shrink-0 ${p.isCaptain ? "text-gold" : "text-gray-600 hover:text-gray-400"}`} />
                    </button>
                    {editingPlayerId === p.id ? (
                      <>
                        <Input
                          value={editingPlayerName}
                          onChange={(e) => setEditingPlayerName(e.target.value)}
                          className="bg-black/50 border-gold/30 text-white h-7 w-40"
                        />
                        <button onClick={() => savePlayerName(team.id, p.id)} className="text-gold text-xs font-semibold">
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-gray-200 text-sm truncate">{p.name}</span>
                        <span className="text-gray-500 text-xs shrink-0">{p.role}</span>
                        <button
                          onClick={() => startEditPlayerName(p.id, p.name)}
                          className="text-gray-600 hover:text-gold shrink-0"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeletePlayer(team.id, p.id)}
                    className="text-gray-500 hover:text-red-400 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add player row */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center pt-2 border-t border-gold/5">
              <Input
                value={getPlayerForm(team.id).name}
                onChange={(e) => setPlayerForm(team.id, { name: e.target.value })}
                placeholder="Player name"
                className="bg-black/50 border-gold/30 text-white sm:flex-1"
              />
              <select
                value={getPlayerForm(team.id).role}
                onChange={(e) => setPlayerForm(team.id, { role: e.target.value as ManualPlayerInput["role"] })}
                className="bg-black/50 border border-gold/30 rounded-md text-white text-sm px-3 py-2"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-gray-400 px-1">
                <input
                  type="checkbox"
                  checked={getPlayerForm(team.id).isCaptain}
                  onChange={(e) => setPlayerForm(team.id, { isCaptain: e.target.checked })}
                />
                Captain
              </label>
              <Button
                onClick={() => handleAddPlayer(team)}
                disabled={addingPlayerFor === team.id || !getPlayerForm(team.id).name.trim()}
                className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50 whitespace-nowrap"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {addingPlayerFor === team.id ? "Adding…" : "Add Player"}
              </Button>
            </div>
            {playerErrors[team.id] && (
              <p className="flex items-center gap-1.5 text-red-500 text-xs mt-2">
                <AlertCircle className="h-3.5 w-3.5" /> {playerErrors[team.id]}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Add team form */}
      <div className="border-t border-gold/10 pt-4">
        <p className="text-gray-400 text-sm mb-3 flex items-center gap-1.5">
          <Users className="h-4 w-4 text-gold" /> Add a team
        </p>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <Input
            value={newTeamCode}
            onChange={(e) => setNewTeamCode(e.target.value)}
            placeholder="Code, e.g. RCB"
            maxLength={5}
            className="bg-black/50 border-gold/30 text-white sm:w-32"
          />
          <Input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Team name"
            className="bg-black/50 border-gold/30 text-white sm:flex-1"
          />
          <input
            type="color"
            value={newTeamColor}
            onChange={(e) => setNewTeamColor(e.target.value)}
            className="h-10 w-12 rounded-md border border-gold/30 bg-black/50 cursor-pointer"
            title="Team color"
          />
          <Button
            onClick={handleAddTeam}
            disabled={isAddingTeam || !newTeamCode.trim() || !newTeamName.trim()}
            className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {isAddingTeam ? "Adding…" : "Add Team"}
          </Button>
        </div>
        {addTeamError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mt-3">
            <AlertCircle className="h-4 w-4" /> {addTeamError}
          </p>
        )}
      </div>
    </div>
  )
}