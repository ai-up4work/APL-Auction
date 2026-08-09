"use client"

import { useEffect, useState } from "react"
import {
  Trophy,
  Medal,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  Info,
  Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getPrizesForTournament, savePrizesForTournament } from "@/lib/tournament/tournament"

interface PrizesManagerProps {
  tournamentId: string
  // Fired after every successful save so the parent (Tournament Edit
  // page) can mirror the current list into its sidebar preview /
  // setup checklist, same pattern AwardsManager uses for onAwardsChange.
  onPrizesChange?: (prizes: { place: string; reward: string }[]) => void
}

// Local editing row — a stable `key` lets React (and the reorder logic)
// track a row across edits/reorders even though `place` and `reward`
// are both freely editable text, so nothing here is a reliable id
// until it's actually saved.
interface PrizeRow {
  key: string
  place: string
  reward: string
}

let rowKeySeed = 0
function newRowKey() {
  rowKeySeed += 1
  return `row-${Date.now()}-${rowKeySeed}`
}

function toRows(prizes: { place: string; reward: string }[]): PrizeRow[] {
  return prizes.map((p) => ({ key: newRowKey(), place: p.place, reward: p.reward }))
}

// Rank-colored badge for the first three rows — everything past 3rd
// gets a neutral gold-outline badge instead of trying to invent a
// fourth "medal" color. Purely cosmetic; ranking here is just row
// order, not read from any `place` text (an organizer could label a
// row "Best Newcomer" and it'd still just get the badge for its
// position in the list).
const RANK_BADGE_STYLE = [
  "bg-gradient-to-br from-yellow-300 to-yellow-600 text-black border-yellow-200", // 1st
  "bg-gradient-to-br from-gray-200 to-gray-400 text-black border-gray-100", // 2nd
  "bg-gradient-to-br from-amber-600 to-amber-800 text-white border-amber-500", // 3rd
]
const RANK_BADGE_FALLBACK = "bg-black/40 text-gold border-gold/30"

function RankBadge({ index }: { index: number }) {
  const style = RANK_BADGE_STYLE[index] ?? RANK_BADGE_FALLBACK
  const Icon = index === 0 ? Trophy : index < 3 ? Medal : null
  return (
    <div
      className={`h-9 w-9 shrink-0 rounded-full border flex items-center justify-center font-cinzel font-bold text-xs ${style}`}
    >
      {Icon ? <Icon className="h-4 w-4" /> : index + 1}
    </div>
  )
}

export default function PrizesManager({ tournamentId, onPrizesChange }: PrizesManagerProps) {
  const [rows, setRows] = useState<PrizeRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    if (!tournamentId) return
    let cancelled = false

    setIsLoading(true)
    setLoadError(null)

    getPrizesForTournament(tournamentId)
      .then((data) => {
        if (cancelled) return
        setRows(toRows(data))
        setIsDirty(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error("[PrizesManager] load failed:", err)
        setLoadError("Couldn't load prizes — please refresh the page.")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tournamentId])

  const markDirty = () => {
    setIsDirty(true)
    setJustSaved(false)
  }

  const updateRow = (key: string, patch: Partial<PrizeRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    markDirty()
  }

  const addRow = () => {
    // Sensible default label based on position — "1st Place", "2nd
    // Place", etc. — organizers can always overwrite it, but an empty
    // input is a worse default for something this short.
    const place = ordinalPlace(rows.length + 1)
    setRows((prev) => [...prev, { key: newRowKey(), place, reward: "" }])
    markDirty()
  }

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key))
    markDirty()
  }

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    setRows((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    markDirty()
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)

    const payload = rows
      .map((r) => ({ place: r.place.trim(), reward: r.reward.trim() }))
      .filter((p) => p.place || p.reward)

    const ok = await savePrizesForTournament(tournamentId, payload)
    setIsSaving(false)

    if (!ok) {
      setSaveError("Couldn't save prizes — please try again.")
      return
    }

    setRows(toRows(payload))
    setIsDirty(false)
    setJustSaved(true)
    onPrizesChange?.(payload)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-white font-cinzel flex items-center gap-2 mb-1">
            <Trophy className="h-5 w-5 text-gold" />
            Prize Pool
          </h3>
          <p className="text-sm text-gray-400">
            Simple place-and-reward breakdown — "1st Place" → "$500", etc.
          </p>
        </div>
        <Button
          onClick={addRow}
          disabled={isLoading}
          variant="outline"
          className="border-gold/30 text-gold hover:bg-gold/10 disabled:opacity-50"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Prize
        </Button>
      </div>

      {/* Scope note — prizes are always tournament-wide, unlike Awards
          which can optionally be scoped to a single match. Stated
          plainly here instead of leaving it implicit, since Awards
          right next to this in the edit page DOES offer match
          scoping and that asymmetry is easy to assume is a bug. */}
      <div className="flex items-start gap-2.5 rounded-lg border border-gold/15 bg-gold/[0.04] px-4 py-3">
        <Info className="h-4 w-4 text-gold/70 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-400 leading-relaxed">
          Prizes always apply to the <span className="text-gold/90 font-medium">whole tournament</span> — final
          standings only. There's no per-match option here, unlike Awards (e.g. Man of the Match), which can be
          scoped to a specific game.
        </p>
      </div>

      {isLoading && (
        <p className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading prizes…
        </p>
      )}

      {loadError && (
        <p className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4" /> {loadError}
        </p>
      )}

      {!isLoading && !loadError && (
        <>
          {/* Prize rows */}
          <div className="space-y-2.5">
            {rows.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8 border border-dashed border-gold/15 rounded-lg">
                No prizes yet. Add one to get started.
              </p>
            ) : (
              rows.map((row, i) => (
                <div
                  key={row.key}
                  className="group flex items-center gap-3 bg-black/50 border border-gold/15 hover:border-gold/30 rounded-lg p-3 transition-colors"
                >
                  <RankBadge index={i} />

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Input
                      value={row.place}
                      onChange={(e) => updateRow(row.key, { place: e.target.value })}
                      placeholder="Place (e.g. 1st Place)"
                      className="bg-black/50 border-gold/20 text-white text-sm h-9"
                    />
                    <Input
                      value={row.reward}
                      onChange={(e) => updateRow(row.key, { reward: e.target.value })}
                      placeholder="Reward (e.g. $500, Trophy)"
                      className="bg-black/50 border-gold/20 text-white text-sm h-9"
                    />
                  </div>

                  {/* Reorder + delete — visible on hover on desktop,
                      always visible on touch since there's no hover
                      state to reveal them. */}
                  <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => moveRow(i, -1)}
                      disabled={i === 0}
                      className="h-7 w-7 flex items-center justify-center rounded text-gray-400 hover:text-gold hover:bg-gold/10 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRow(i, 1)}
                      disabled={i === rows.length - 1}
                      className="h-7 w-7 flex items-center justify-center rounded text-gray-400 hover:text-gold hover:bg-gold/10 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="h-7 w-7 flex items-center justify-center rounded text-gray-400 hover:text-red-400 hover:bg-red-900/20"
                      aria-label="Remove prize"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {saveError && (
            <p className="flex items-center gap-1.5 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4" /> {saveError}
            </p>
          )}

          {/* Save bar */}
          <div className="flex items-center justify-between pt-2 border-t border-gold/10">
            <p className="text-xs text-gray-500">
              {justSaved ? (
                <span className="text-green-400">Saved.</span>
              ) : isDirty ? (
                "You have unsaved changes."
              ) : (
                "\u00A0"
              )}
            </p>
            <Button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" /> Save Prizes
                </span>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function ordinalPlace(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"
  return `${n}${suffix} Place`
}