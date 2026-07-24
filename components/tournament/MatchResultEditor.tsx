"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, X } from "lucide-react"
import { updateBracketMatchResult } from "@/lib/tournament/bracketData"

interface TeamRef {
  id: string
  code: string
  name: string
}

interface MatchResultEditorProps {
  matchId: string
  teamA: TeamRef | null
  teamB: TeamRef | null
  initialScoreA?: number | null
  initialScoreB?: number | null
  initialWinnerTeamId?: string | null
  onClose: () => void
  onSaved: () => void
}

export default function MatchResultEditor({
  matchId,
  teamA,
  teamB,
  initialScoreA,
  initialScoreB,
  initialWinnerTeamId,
  onClose,
  onSaved,
}: MatchResultEditorProps) {
  const [scoreA, setScoreA] = useState(initialScoreA != null ? String(initialScoreA) : "")
  const [scoreB, setScoreB] = useState(initialScoreB != null ? String(initialScoreB) : "")
  const [winnerTeamId, setWinnerTeamId] = useState<string | null>(initialWinnerTeamId ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    const result = await updateBracketMatchResult(matchId, {
      scoreA: scoreA === "" ? null : Number(scoreA),
      scoreB: scoreB === "" ? null : Number(scoreB),
      winnerTeamId,
      status: winnerTeamId ? "completed" : "live",
    })
    setIsSaving(false)
    if (result.ok) {
      onSaved()
    } else {
      setError(result.error ?? "Couldn't save the result.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-black border border-gold/30 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white font-cinzel">Edit Match Result</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-gray-500 text-xs mb-4">
          Manually setting a result here takes priority over the overlay — if this match is
          linked to a live match, auto-sync won't overwrite it once you save.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-white text-sm w-24 truncate">{teamA?.name ?? "TBD"}</span>
            <Input
              type="number"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              placeholder="Score"
              disabled={!teamA}
              className="bg-black/50 border-gold/30 text-white"
            />
            <button
              type="button"
              onClick={() => teamA && setWinnerTeamId(teamA.id)}
              disabled={!teamA}
              className={`text-xs px-2 py-1 rounded border shrink-0 disabled:opacity-30 ${
                winnerTeamId === teamA?.id
                  ? "bg-gold text-black border-gold"
                  : "border-gold/30 text-gray-400"
              }`}
            >
              Winner
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-white text-sm w-24 truncate">{teamB?.name ?? "TBD"}</span>
            <Input
              type="number"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              placeholder="Score"
              disabled={!teamB}
              className="bg-black/50 border-gold/30 text-white"
            />
            <button
              type="button"
              onClick={() => teamB && setWinnerTeamId(teamB.id)}
              disabled={!teamB}
              className={`text-xs px-2 py-1 rounded border shrink-0 disabled:opacity-30 ${
                winnerTeamId === teamB?.id
                  ? "bg-gold text-black border-gold"
                  : "border-gold/30 text-gray-400"
              }`}
            >
              Winner
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <Button
            onClick={handleSave}
            disabled={isSaving || (!teamA && !teamB)}
            className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save Result"}
          </Button>
          {error && (
            <span className="flex items-center gap-1.5 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4" /> {error}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}