"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import TournamentBracket from "@/components/tournament/TournamentBracket"
import type { Round } from "@/components/tournament/TournamentBracket"
import DoubleElimBoard from "@/components/tournament/DoubleElimBoard"
import type { DoubleElimData } from "@/lib/tournament/doubleElim"
import {
  getBracketMatchesForTournament,
  buildSingleEliminationRounds,
  buildDoubleEliminationData,
} from "@/lib/tournament/bracketData"

interface BracketPageClientProps {
  /** Needed to scope the realtime subscription and to re-fetch rows
   *  whenever a change comes in. */
  tournamentId: string
  format: "single" | "double"
  title: string
  tournamentOrgId: string
  singleRounds?: Round[]
  doubleData?: DoubleElimData
}

/**
 * Public, read-only bracket view. This page never shows score inputs,
 * Save buttons, or tie-break controls — that only happens on the
 * /bracket/edit route (BracketEditClient). Here we deliberately omit
 * `editable`/`onRecordResult` so TournamentBracket and DoubleElimBoard
 * fall back to their fully static rendering.
 *
 * Server-rendered `singleRounds`/`doubleData` seed the initial paint;
 * after that, a Supabase Realtime channel listens for any change to
 * this tournament's `bracket_matches` rows (inserts/updates from the
 * admin's edit page) and rebuilds local state from a fresh fetch, so
 * anyone sitting on this page sees results land without reloading.
 */
export default function BracketPageClient({
  tournamentId,
  format,
  title,
  singleRounds,
  doubleData,
}: BracketPageClientProps) {
  const [rounds, setRounds] = useState<Round[] | undefined>(singleRounds)
  const [doubleElimData, setDoubleElimData] = useState<DoubleElimData | undefined>(doubleData)

  // Re-seed local state if the server sends new props (e.g. a normal
  // Next.js navigation/re-render) — kept separate from the realtime
  // path below so the two update sources don't fight each other.
  useEffect(() => {
    setRounds(singleRounds)
  }, [singleRounds])

  useEffect(() => {
    setDoubleElimData(doubleData)
  }, [doubleData])

  useEffect(() => {
    async function refetchAndRebuild() {
      const rows = await getBracketMatchesForTournament(tournamentId)
      if (format === "double") {
        const next = buildDoubleEliminationData(rows)
        if (next) setDoubleElimData(next)
      } else {
        setRounds(buildSingleEliminationRounds(rows))
      }
    }

    const channel = supabase
      .channel(`bracket-matches-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bracket_matches",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          refetchAndRebuild()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentId, format])

  if (format === "double" && doubleElimData) {
    return (
      <DoubleElimBoard
        data={doubleElimData}
        title={title}
        eyebrowLabel="Knockout · Double Elimination"
        helperText="Hover or click a team to trace their path."
      />
    )
  }

  if (format === "single" && rounds) {
    return (
      <TournamentBracket
        rounds={rounds}
        title={title}
        eyebrowLabel="Knockout Stage"
        helperText="Hover or click a team to trace their path."
      />
    )
  }

  return null
}