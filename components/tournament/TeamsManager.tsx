"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, Star, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getTeamsWithPlayers,
  addManualTeam,
  updateManualTeam,
  deleteManualTeam,
  addManualPlayer,
  setManualCaptain,
  deleteManualPlayer,
  type ManualTeam,
  type ManualPlayerInput,
} from "@/lib/tournament/manualTeams"

const ROLE_OPTIONS: ManualPlayerInput["role"][] = ["Batter", "Bowler", "All-rounder", "WK-Batter"]

export default function TeamsManager({
  tournamentId,
  orgId,
  tournamentName,
}: {
  tournamentId: string
  orgId: string
  tournamentName: string
}) {
  const [teams, setTeams] = useState<ManualTeam[]>([])
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [newTeamName, setNewTeamName] = useState("")
  const [newTeamCode, setNewTeamCode] = useState("")
  const [addingTeam, setAddingTeam] = useState(false)
  const [teamError, setTeamError] = useState<string | null>(null)

  const [newPlayerName, setNewPlayerName] = useState<Record<string, string>>({})
  const [newPlayerRole, setNewPlayerRole] = useState<Record<string, ManualPlayerInput["role"]>>({})
  const [addingPlayerFor, setAddingPlayerFor] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getTeamsWithPlayers(tournamentId).then((t) => {
      if (cancelled) return
      setTeams(t)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [tournamentId])

  const toggleExpanded = (teamId: string) =>
    setExpanded((prev) => ({ ...prev, [teamId]: !prev[teamId] }))

  const handleAddTeam = async () => {
    if (!newTeamName.trim() || !newTeamCode.trim()) return
    setAddingTeam(true)
    setTeamError(null)
    const team = await addManualTeam(tournamentId, orgId, tournamentName, {
      name: newTeamName.trim(),
      code: newTeamCode.trim().toUpperCase(),
    })
    setAddingTeam(false)
    if (team) {
      setTeams((prev) => [...prev, team])
      setNewTeamName("")
      setNewTeamCode("")
    } else {
      setTeamError("Couldn't add team — check the code isn't already used.")
    }
  }

  const handleDeleteTeam = async (teamId: string) => {
    const ok = await deleteManualTeam(teamId)
    if (ok) setTeams((prev) => prev.filter((t) => t.id !== teamId))
  }

  const handleAddPlayer = async (team: ManualTeam) => {
    const name = (newPlayerName[team.id] || "").trim()
    const role = newPlayerRole[team.id] || "Batter"
    if (!name) return
    setAddingPlayerFor(team.id)
    const player = await addManualPlayer(team.auctionId, team.id, team.code, { name, role })
    setAddingPlayerFor(null)
    if (player) {
      setTeams((prev) =>
        prev.map((t) => (t.id === team.id ? { ...t, players: [...t.players, player] } : t))
      )
      setNewPlayerName((prev) => ({ ...prev, [team.id]: "" }))
    }
  }

  const handleDeletePlayer = async (teamId: string, playerId: string) => {
    const ok = await deleteManualPlayer(playerId)
    if (ok) {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId ? { ...t, players: t.players.filter((p) => p.id !== playerId) } : t
        )
      )
    }
  }

  const handleToggleCaptain = async (team: ManualTeam, playerId: string, makeCaptain: boolean) => {
    const ok = await setManualCaptain(team.id, team.code, playerId, makeCaptain)
    if (ok) {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === team.id
            ? {
                ...t,
                players: t.players.map((p) => ({
                  ...p,
                  isCaptain: p.id === playerId ? makeCaptain : makeCaptain ? false : p.isCaptain,
                })),
              }
            : t
        )
      )
    }
  }

  return (
    <div className="bg-black/50 border border-gold/20 rounded-lg p-6 mb-6">
      <h2 className="text-lg font-bold text-white font-cinzel mb-1">Teams & Squads</h2>
      <p className="text-gray-500 text-xs mb-4">
        Add teams and players directly — no auction required. These teams can be used to
        generate the bracket the same way auction-drafted teams are.
      </p>

      {!loaded ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {teams.length === 0 && (
              <p className="text-gray-500 text-sm italic">No teams added yet.</p>
            )}
            {teams.map((team) => (
              <div key={team.id} className="border border-gold/10 rounded-md bg-white/[0.02]">
                <div className="flex items-center justify-between p-3">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(team.id)}
                    className="flex items-center gap-2 text-white text-sm font-semibold flex-1 text-left"
                  >
                    {expanded[team.id] ? (
                      <ChevronDown className="h-4 w-4 text-gold" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gold" />
                    )}
                    <span
                      className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.code.slice(0, 2)}
                    </span>
                    {team.name}
                    <span className="text-gray-500 text-xs font-normal">
                      · {team.players.length} player{team.players.length === 1 ? "" : "s"}
                    </span>
                  </button>
                  <Button
                    type="button"
                    onClick={() => handleDeleteTeam(team.id)}
                    className="bg-transparent hover:bg-red-600/20 text-red-500 border border-red-500/30 px-2 h-8"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {expanded[team.id] && (
                  <div className="border-t border-gold/10 p-3 space-y-2">
                    {team.players.length === 0 && (
                      <p className="text-gray-500 text-xs italic">No players yet.</p>
                    )}
                    {team.players.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 bg-black/30 rounded px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleToggleCaptain(team, p.id, !p.isCaptain)}
                          title={p.isCaptain ? "Captain — click to unset" : "Set as captain"}
                        >
                          <Star
                            className={`h-4 w-4 ${p.isCaptain ? "fill-gold text-gold" : "text-gray-600"}`}
                          />
                        </button>
                        <span className="text-white text-sm flex-1">{p.name}</span>
                        <span className="text-gray-500 text-xs">{p.role}</span>
                        <Button
                          type="button"
                          onClick={() => handleDeletePlayer(team.id, p.id)}
                          className="bg-transparent hover:bg-red-600/20 text-red-500 border border-red-500/30 px-2 h-7"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}

                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <Input
                        value={newPlayerName[team.id] || ""}
                        onChange={(e) =>
                          setNewPlayerName((prev) => ({ ...prev, [team.id]: e.target.value }))
                        }
                        placeholder="Player name"
                        className="bg-black/50 border-gold/30 text-white text-sm flex-1"
                      />
                      <select
                        value={newPlayerRole[team.id] || "Batter"}
                        onChange={(e) =>
                          setNewPlayerRole((prev) => ({
                            ...prev,
                            [team.id]: e.target.value as ManualPlayerInput["role"],
                          }))
                        }
                        className="bg-black/50 border border-gold/30 rounded-md text-white text-sm px-2"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        onClick={() => handleAddPlayer(team)}
                        disabled={addingPlayerFor === team.id}
                        className="bg-gold hover:bg-gold/90 text-black font-bold text-sm px-3 disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-gold/10 pt-4">
            <p className="text-gray-400 text-sm mb-2">Add a team</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Team name"
                className="bg-black/50 border-gold/30 text-white flex-1"
              />
              <Input
                value={newTeamCode}
                onChange={(e) => setNewTeamCode(e.target.value)}
                placeholder="Code (e.g. RCB)"
                maxLength={5}
                className="bg-black/50 border-gold/30 text-white sm:w-32"
              />
              <Button
                type="button"
                onClick={handleAddTeam}
                disabled={addingTeam}
                className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
              >
                <Plus className="mr-2 h-4 w-4" />
                {addingTeam ? "Adding…" : "Add team"}
              </Button>
            </div>
            {teamError && <p className="text-red-500 text-xs mt-2">{teamError}</p>}
          </div>
        </>
      )}
    </div>
  )
}