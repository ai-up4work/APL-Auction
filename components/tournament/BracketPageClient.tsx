"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { getOrgIdForUser } from "@/lib/tournament/tournament"
import { updateBracketMatchResult } from "@/lib/tournament/bracketData"
import TournamentBracketEditable from "@/components/demo/TournamentBracketEditable"
import type { Round, MatchNode } from "@/components/tournament/TournamentBracket"
import DoubleElimBracketClient from "@/components/tournament/DoubleElimBracketClient"
import type { DoubleElimData } from "@/lib/tournament/doubleElim"

interface BracketPageClientProps {
  format: "single" | "double"
  title: string
  tournamentOrgId: string
  singleRounds?: Round[]
  doubleData?: DoubleElimData
}

/** Finds a match anywhere across all rounds by id, so a recorded
 *  "A"/"B" winner slot can be resolved into the actual team id the
 *  match already carries (teamA.id / teamB.id) before saving. */
function findMatchInRounds(rounds: Round[], matchId: string): MatchNode | null {
  for (const round of rounds) {
    const m = round.matches.find((mm) => mm.id === matchId)
    if (m) return m
  }
  return null
}

export default function BracketPageClient({
  format,
  title,
  tournamentOrgId,
  singleRounds,
  doubleData,
}: BracketPageClientProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getOrgIdForUser(user.id).then((orgId) => {
      if (!cancelled) setIsAdmin(!!orgId && orgId === tournamentOrgId)
    })
    return () => {
      cancelled = true
    }
  }, [user, tournamentOrgId])

  const handleRecordResult = async (
    matchId: string,
    winner: "A" | "B",
    scoreA: number,
    scoreB: number
  ) => {
    if (!isAdmin || !singleRounds) return
    setSaveError(null)

    const match = findMatchInRounds(singleRounds, matchId)
    const winnerTeamId = winner === "A" ? match?.teamA?.id : match?.teamB?.id
    if (!winnerTeamId) {
      setSaveError("Couldn't determine the winning team for this match.")
      return
    }

    const res = await updateBracketMatchResult(matchId, {
      scoreA,
      scoreB,
      winnerTeamId,
      status: "completed",
    })

    if (!res.ok) {
      setSaveError(res.error ?? "Couldn't save the result.")
      return
    }

    // singleRounds is server-fetched props, not local state, so refresh
    // to pull the updated bracket_matches rows and re-render.
    router.refresh()
  }

  if (format === "double" && doubleData) {
    return (
      <DoubleElimBracketClient
        data={doubleData}
        title={title}
        tournamentOrgId={tournamentOrgId}
      />
    )
  }

  return (
    <>
      <TournamentBracketEditable
        rounds={singleRounds!}
        title={title}
        eyebrowLabel="Knockout Stage"
        helperText={
          isAdmin
            ? "Enter a score and pick a winner to record a result."
            : "Hover or click a team to trace their path."
        }
        onRecordResult={
          isAdmin
            ? handleRecordResult
            : () => {
                console.warn("Only tournament admins can record results.")
              }
        }
      />
      {saveError && (
        <p className="text-red-500 text-sm text-center mt-2">{saveError}</p>
      )}
    </>
  )
}