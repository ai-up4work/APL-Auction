"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, Copy, Award, Loader2, AlertCircle, Sparkles as SparklesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import ImageUploadField from "@/components/common/ImageUploadField"
import {
  type AwardTemplate,
  type AwardInput,
  type MatchOption,
  type DerivationMethod,
  getAwardsForTournament,
  createAward,
  updateAward,
  deleteAward,
  getMatchesForTournament,
} from "@/lib/tournament/awards"

interface AwardsManagerProps {
  tournamentId: string
  // Fired after every successful load/create/update/delete so the parent
  // (Tournament Edit page) can mirror the current list into its sidebar
  // preview + setup checklist without owning the data itself.
  onAwardsChange?: (awards: AwardTemplate[]) => void
}

const PRIZE_CATEGORIES = [
  { value: "cash", label: "Cash Prize", color: "bg-yellow-500/20 border-yellow-500/50" },
  { value: "physical", label: "Physical Item", color: "bg-purple-500/20 border-purple-500/50" },
  { value: "badge", label: "Badge", color: "bg-blue-500/20 border-blue-500/50" },
  { value: "experience", label: "Experience", color: "bg-pink-500/20 border-pink-500/50" },
] as const

type PrizeCategory = (typeof PRIZE_CATEGORIES)[number]["value"]

const AWARD_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "team", label: "Team" },
] as const

// Tournament-wide: one instance for the whole tournament (Best Player,
// 1st Place Team). Match-based: this award concept applies per match
// (Man of the Match) — see MATCH_APPLICATIONS below for whether that
// means every match or one specific match.
const AWARD_LEVELS = [
  { value: "tournament", label: "Tournament-wide (once per tournament)" },
  { value: "match", label: "Match-based (Man of the Match, etc.)" },
] as const

// Only offered when awardLevel === "tournament" — a single match has
// no "standings" to rank within.
const DERIVATION_METHODS = [
  { value: "stat_leader", label: "Statistic leaderboard (e.g. top run-scorer)" },
  { value: "standings_position", label: "Final standings position (1st, 2nd, 3rd place)" },
] as const

const MATCH_APPLICATIONS = [
  { value: "every", label: "Every match (e.g. Man of the Match)" },
  { value: "specific", label: "One specific match only" },
] as const

type AwardTypeValue = (typeof AWARD_TYPES)[number]["value"]

interface TitlePreset {
  title: string
  // Which award type(s) this preset makes sense for. A player-scoped
  // name like "Best Batter" doesn't belong under Team, and a
  // team-scoped name like "Champions Trophy" doesn't belong under
  // Individual — so each preset declares where it's valid instead of
  // one flat list being shown regardless of the Award Type selected.
  types: AwardTypeValue[]
}

// Quick-pick title presets, grouped by prize category, then further
// filtered by award type (individual vs team) at render time. Purely a
// typing shortcut — clicking a chip just fills the Title field,
// everything stays fully editable afterward, and nothing here is
// persisted or validated; it's UI sugar only.
const AWARD_TITLE_PRESETS: Record<PrizeCategory, TitlePreset[]> = {
  cash: [
    { title: "Most Valuable Player", types: ["individual"] },
    { title: "Best Batter", types: ["individual"] },
    { title: "Best Bowler", types: ["individual"] },
    { title: "Best All-Rounder", types: ["individual"] },
    { title: "Man of the Series", types: ["individual"] },
    { title: "Best Wicketkeeper", types: ["individual"] },
    { title: "Champion Team Prize", types: ["team"] },
    { title: "Runner-Up Team Prize", types: ["team"] },
  ],
  physical: [
    { title: "Champions Trophy", types: ["team"] },
    { title: "Runner-Up Trophy", types: ["team"] },
    { title: "Best Fielder", types: ["individual"] },
    { title: "Golden Bat", types: ["individual"] },
    { title: "Golden Ball", types: ["individual"] },
    { title: "Man of the Match Mementos", types: ["individual"] },
  ],
  badge: [
    { title: "Fair Play Award", types: ["individual", "team"] },
    { title: "Rising Star", types: ["individual"] },
    { title: "Most Improved Player", types: ["individual"] },
    { title: "Hat-Trick Badge", types: ["individual"] },
    { title: "Spirit of Cricket", types: ["team"] },
    { title: "Century Club", types: ["individual"] },
  ],
  experience: [
    { title: "VIP Meet & Greet", types: ["individual", "team"] },
    { title: "Training Camp Invite", types: ["individual", "team"] },
    { title: "Season Pass", types: ["individual", "team"] },
    { title: "Behind-the-Scenes Tour", types: ["individual", "team"] },
  ],
}

const emptyFormData: Partial<AwardTemplate> = {
  awardType: "individual",
  awardLevel: "tournament",
  prizeCategory: "cash",
  isDataDerived: false,
  overrideEnabled: true,
}

// Shared class string so every <select> renders identically to the
// Input/Textarea components used elsewhere in this form (same height,
// radius, border, and focus ring).
const selectClassName =
  "flex h-10 w-full rounded-md border border-gold/30 bg-black/50 px-3 py-2 text-sm text-white " +
  "focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 " +
  "disabled:cursor-not-allowed disabled:opacity-50"

function positionLabel(rank: number) {
  if (rank === 1) return "1st Place"
  if (rank === 2) return "2nd Place"
  if (rank === 3) return "3rd Place"
  return `${rank}th Place`
}

export default function AwardsManager({ tournamentId, onAwardsChange }: AwardsManagerProps) {
  // ── Loaded list — this is the source of truth once loaded; every
  // mutation below updates it optimistically only after Supabase
  // confirms the write, so the UI never shows an award that isn't
  // actually persisted. ─────────────────────────────────────────────
  const [awards, setAwards] = useState<AwardTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<AwardTemplate>>(emptyFormData)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // UI-only: whether a match-level award applies to every match or is
  // pinned to one. Derived from formData.matchId on load/edit, but
  // tracked separately so "specific" can be selected in the UI before
  // a match has actually been picked yet.
  const [matchApplication, setMatchApplication] = useState<"every" | "specific">("every")

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingDuplicateId, setPendingDuplicateId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  // ── Matches, for the match picker. Loaded lazily the first time it's
  // needed so we don't pay for it on every AwardsManager mount. ──────
  const [matches, setMatches] = useState<MatchOption[]>([])
  const [matchesLoading, setMatchesLoading] = useState(false)
  const [matchesError, setMatchesError] = useState<string | null>(null)
  const [matchesLoaded, setMatchesLoaded] = useState(false)

  // ── Load from Supabase on mount ──
  useEffect(() => {
    if (!tournamentId) return
    let cancelled = false

    setIsLoading(true)
    setLoadError(null)

    getAwardsForTournament(tournamentId)
      .then((data) => {
        if (cancelled) return
        setAwards(data)
        onAwardsChange?.(data)
      })
      .catch((err) => {
        if (cancelled) return
        console.error("[AwardsManager] load failed:", err)
        setLoadError("Couldn't load awards — please refresh the page.")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId])

  const ensureMatchesLoaded = () => {
    if (matchesLoaded || matchesLoading || !tournamentId) return

    setMatchesLoading(true)
    setMatchesError(null)

    getMatchesForTournament(tournamentId)
      .then((data) => {
        setMatches(data)
        setMatchesLoaded(true)
      })
      .catch((err) => {
        console.error("[AwardsManager] load matches failed:", err)
        setMatchesError("Couldn't load matches — please try again.")
      })
      .finally(() => setMatchesLoading(false))
  }

  const resetForm = () => {
    setFormData(emptyFormData)
    setFormError(null)
    setMatchApplication("every")
  }

  const openNewForm = () => {
    setEditingId(null)
    resetForm()
    setShowForm(true)
  }

  const handleEditAward = (award: AwardTemplate) => {
    setEditingId(award.id)
    setFormData(award)
    setFormError(null)
    setShowForm(true)

    const isSpecificMatch = award.awardLevel === "match" && !!award.matchId
    setMatchApplication(isSpecificMatch ? "specific" : "every")
    if (award.awardLevel === "match") ensureMatchesLoaded()
  }

  // ── Create / Update — writes straight to Supabase; local state only
  // updates once that write succeeds. ────────────────────────────────
  const handleSubmit = async () => {
    if (!formData.title?.trim() || !formData.description?.trim()) {
      setFormError("Title and description are required.")
      return
    }

    const awardLevel = formData.awardLevel || "tournament"
    const method = formData.derivationConfig?.method

    if (awardLevel === "match" && matchApplication === "specific" && !formData.matchId) {
      setFormError("Pick which match this award is scoped to.")
      return
    }

    if (formData.isDataDerived) {
      if (!method) {
        setFormError("Pick how the winner should be determined.")
        return
      }
      if (method === "stat_leader" && !formData.derivationConfig?.statistic?.trim()) {
        setFormError("Enter a statistic to derive this award from.")
        return
      }
    }

    const payload: AwardInput = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      awardType: formData.awardType || "individual",
      awardLevel,
      matchId:
        awardLevel === "match" && matchApplication === "specific" ? formData.matchId : undefined,
      prizeCategory: formData.prizeCategory || "cash",
      prizeValue: formData.prizeValue,
      imageUrl: formData.imageUrl,
      isDataDerived: formData.isDataDerived || false,
      derivationConfig: formData.isDataDerived
        ? {
            method: method || "stat_leader",
            statistic:
              method === "stat_leader" ? formData.derivationConfig?.statistic || "" : undefined,
            rank: formData.derivationConfig?.rank ?? 1,
          }
        : undefined,
      overrideEnabled: formData.overrideEnabled,
    }

    setIsSaving(true)
    setFormError(null)

    if (editingId) {
      const ok = await updateAward(editingId, payload)
      setIsSaving(false)
      if (!ok) {
        setFormError("Couldn't update award — please try again.")
        return
      }
      const updated = awards.map((a) => (a.id === editingId ? { ...payload, id: editingId } : a))
      setAwards(updated)
      onAwardsChange?.(updated)
    } else {
      const created = await createAward(tournamentId, payload)
      setIsSaving(false)
      if (!created) {
        setFormError("Couldn't create award — please try again.")
        return
      }
      const updated = [...awards, created]
      setAwards(updated)
      onAwardsChange?.(updated)
    }

    setShowForm(false)
    setEditingId(null)
    resetForm()
  }

  const handleDeleteAward = async (id: string) => {
    setRowError(null)
    setPendingDeleteId(id)
    const ok = await deleteAward(id)
    setPendingDeleteId(null)

    if (!ok) {
      setRowError("Couldn't delete that award — please try again.")
      return
    }

    const updated = awards.filter((a) => a.id !== id)
    setAwards(updated)
    onAwardsChange?.(updated)
  }

  const handleDuplicateAward = async (award: AwardTemplate) => {
    setRowError(null)
    setPendingDuplicateId(award.id)

    const { id, ...rest } = award
    const created = await createAward(tournamentId, { ...rest, title: `${award.title} (Copy)` })
    setPendingDuplicateId(null)

    if (!created) {
      setRowError("Couldn't duplicate that award — please try again.")
      return
    }

    const updated = [...awards, created]
    setAwards(updated)
    onAwardsChange?.(updated)
  }

  const matchLabelFor = (matchId?: string) => matches.find((m) => m.id === matchId)?.label

  const derivationBadge = (award: AwardTemplate) => {
    const levelBadge =
      award.awardLevel === "match"
        ? award.matchId
          ? `Match · ${matchLabelFor(award.matchId) || "Specific match"}`
          : "Match · Every match"
        : "Tournament"

    if (!award.isDataDerived || !award.derivationConfig) return `${levelBadge} · Manual`

    const { method, rank } = award.derivationConfig
    const methodBadge =
      method === "standings_position" ? positionLabel(rank) : "Statistic leader"

    return `${levelBadge} · ${methodBadge}`
  }

  // Presets for whatever prize category AND award type are currently
  // selected in the form — e.g. switching Award Type to "Team" hides
  // player-scoped presets like "Best Batter" and surfaces team-scoped
  // ones like "Champions Trophy" instead. Falls back to "cash" /
  // "individual" if either field somehow isn't set yet.
  const activeAwardType: AwardTypeValue = (formData.awardType as AwardTypeValue) || "individual"
  const activePresets = AWARD_TITLE_PRESETS[(formData.prizeCategory as PrizeCategory) || "cash"].filter(
    (p) => p.types.includes(activeAwardType)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white font-cinzel flex items-center gap-2 mb-1">
            <Award className="h-5 w-5 text-gold" />
            Awards Bank
          </h3>
          <p className="text-sm text-gray-400">
            Create a rich library of individual and team awards with images, prize categories.
            Changes save directly to Supabase.
          </p>
        </div>
        <Button
          onClick={openNewForm}
          disabled={isLoading}
          className="bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Award
        </Button>
      </div>

      {isLoading && (
        <p className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading awards…
        </p>
      )}

      {loadError && (
        <p className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4" /> {loadError}
        </p>
      )}

      {/* Award Form */}
      {showForm && (
        <div className="bg-black/50 border border-gold/30 rounded-lg p-6 space-y-4">
          <div>
            <label className="text-gray-400 text-sm block mb-2 font-medium">Title</label>
            <Input
              value={formData.title || ""}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., MVP Award, Most Wickets, Man of the Match"
              className="bg-black/50 border-gold/30 text-white"
            />

            {/* Quick-pick presets, filtered to the currently selected
                Prize Category AND Award Type — e.g. "Best Batter"
                only shows under Individual, "Champions Trophy" only
                under Team. Purely a shortcut — clicking one just
                fills the Title field above; nothing here is saved
                directly and the title stays fully editable
                afterward. */}
            <div className="mt-2.5">
              <p className="text-[11px] text-gray-500 flex items-center gap-1 mb-1.5">
                <SparklesIcon className="h-3 w-3 text-gold/60" />
                Quick picks for {PRIZE_CATEGORIES.find((c) => c.value === formData.prizeCategory)?.label || "Cash Prize"}
                {" · "}
                {AWARD_TYPES.find((t) => t.value === activeAwardType)?.label}
              </p>
              {activePresets.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {activePresets.map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => setFormData({ ...formData, title: preset.title })}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        formData.title === preset.title
                          ? "bg-gold text-black border-gold font-semibold"
                          : "border-gold/20 text-gray-300 hover:border-gold/50 hover:text-gold"
                      }`}
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-600 italic">
                  No presets for this combination yet — just type a title.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-2 font-medium">Description</label>
            <Textarea
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Explain what this award is for..."
              className="bg-black/50 border-gold/30 text-white min-h-24"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-2 font-medium">Award Level</label>
            <select
              value={formData.awardLevel || "tournament"}
              onChange={(e) => {
                const awardLevel = e.target.value as "tournament" | "match"
                setFormData({
                  ...formData,
                  awardLevel,
                  matchId: undefined,
                  // standings_position only makes sense tournament-wide —
                  // drop it if switching to match-based.
                  derivationConfig:
                    formData.isDataDerived && formData.derivationConfig
                      ? {
                          ...formData.derivationConfig,
                          method:
                            awardLevel === "match" ? "stat_leader" : formData.derivationConfig.method,
                        }
                      : formData.derivationConfig,
                })
                setMatchApplication("every")
                if (awardLevel === "match") ensureMatchesLoaded()
              }}
              className={selectClassName}
            >
              {AWARD_LEVELS.map((lvl) => (
                <option key={lvl.value} value={lvl.value}>
                  {lvl.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {formData.awardLevel === "match"
                ? "This award is given out per match (or for one specific match)."
                : "This award is given out once for the whole tournament."}
            </p>
          </div>

          {/* Match scoping — independent of whether the winner is
              auto-derived or manually picked; a hand-picked award can
              still belong to one specific match. */}
          {formData.awardLevel === "match" && (
            <div className="bg-black/30 border border-gold/10 rounded p-3 space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Applies to</label>
                <select
                  value={matchApplication}
                  onChange={(e) => {
                    const value = e.target.value as "every" | "specific"
                    setMatchApplication(value)
                    setFormData({
                      ...formData,
                      matchId: value === "every" ? undefined : formData.matchId,
                    })
                    if (value === "specific") ensureMatchesLoaded()
                  }}
                  className={`${selectClassName} text-sm h-9`}
                >
                  {MATCH_APPLICATIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {matchApplication === "specific" && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Match</label>
                  {matchesLoading ? (
                    <p className="flex items-center gap-2 text-gray-500 text-xs py-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading matches…
                    </p>
                  ) : matchesError ? (
                    <p className="flex items-center gap-1.5 text-red-500 text-xs py-2">
                      <AlertCircle className="h-3.5 w-3.5" /> {matchesError}
                    </p>
                  ) : matches.length === 0 ? (
                    <p className="text-gray-500 text-xs py-2">
                      No matches found for this tournament yet.
                    </p>
                  ) : (
                    <select
                      value={formData.matchId || ""}
                      onChange={(e) => setFormData({ ...formData, matchId: e.target.value })}
                      className={`${selectClassName} text-sm h-9`}
                    >
                      <option value="">Select a match…</option>
                      {matches.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-sm block mb-2 font-medium">Award Type</label>
              <select
                value={formData.awardType || "individual"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    awardType: e.target.value as "individual" | "team",
                  })
                }
                className={selectClassName}
              >
                {AWARD_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-gray-400 text-sm block mb-2 font-medium">Prize Category</label>
              <select
                value={formData.prizeCategory || "cash"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    prizeCategory: e.target.value as any,
                  })
                }
                className={selectClassName}
              >
                {PRIZE_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-2 font-medium">Prize Value</label>
            <Input
              value={formData.prizeValue || ""}
              onChange={(e) => setFormData({ ...formData, prizeValue: e.target.value })}
              placeholder="$500, MacBook Pro, Trophy, etc."
              className="bg-black/50 border-gold/30 text-white"
            />
          </div>

          {/* Image Upload Field */}
          <ImageUploadField
            label="Award Image"
            value={formData.imageUrl || ""}
            onChange={(url) => setFormData({ ...formData, imageUrl: url })}
            description="Upload a representative image for this award (e.g., trophy photo, certificate design)"
            previewClassName="w-24 h-24 rounded-lg"
            context="award"
            contextId={tournamentId}
            subType="award-images"
            awardId={editingId || "new"}
            allowManualUrl={true}
          />

          <div className="border-t border-gold/20 pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="datadriven"
                checked={formData.isDataDerived || false}
                onChange={(e) => {
                  const isDataDerived = e.target.checked
                  setFormData({
                    ...formData,
                    isDataDerived,
                    derivationConfig: isDataDerived
                      ? {
                          method: formData.derivationConfig?.method || "stat_leader",
                          statistic: formData.derivationConfig?.statistic || "",
                          rank: formData.derivationConfig?.rank ?? 1,
                        }
                      : undefined,
                  })
                }}
                className="rounded"
              />
              <label htmlFor="datadriven" className="text-sm text-gray-400">
                Auto-determine winner from tournament data
              </label>
            </div>

            {!formData.isDataDerived && (
              <p className="text-xs text-gray-500">
                Winner will be assigned manually each time this award is given.
              </p>
            )}

            {formData.isDataDerived && (
              <div className="bg-gold/5 border border-gold/20 rounded p-3 space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">How is the winner picked?</label>
                  {formData.awardLevel === "match" ? (
                    <p className="text-sm text-gray-300 py-1.5">
                      Statistic leaderboard (only option for match-based awards)
                    </p>
                  ) : (
                    <select
                      value={formData.derivationConfig?.method || "stat_leader"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          derivationConfig: {
                            method: e.target.value as DerivationMethod,
                            statistic: formData.derivationConfig?.statistic || "",
                            rank: formData.derivationConfig?.rank ?? 1,
                          },
                        })
                      }
                      className={`${selectClassName} text-sm h-9`}
                    >
                      {DERIVATION_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {(formData.derivationConfig?.method || "stat_leader") === "stat_leader" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Statistic</label>
                      <Input
                        value={formData.derivationConfig?.statistic || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            derivationConfig: {
                              method: formData.derivationConfig?.method || "stat_leader",
                              statistic: e.target.value,
                              rank: formData.derivationConfig?.rank ?? 1,
                            },
                          })
                        }
                        placeholder="runs, wickets, batting_avg"
                        className="bg-black/50 border-gold/30 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Rank</label>
                      <Input
                        type="number"
                        value={formData.derivationConfig?.rank ?? 1}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            derivationConfig: {
                              method: formData.derivationConfig?.method || "stat_leader",
                              statistic: formData.derivationConfig?.statistic || "",
                              rank: parseInt(e.target.value) || 1,
                            },
                          })
                        }
                        min="1"
                        max="10"
                        className="bg-black/50 border-gold/30 text-white text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Final Position</label>
                    <Input
                      type="number"
                      value={formData.derivationConfig?.rank ?? 1}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          derivationConfig: {
                            method: "standings_position",
                            rank: parseInt(e.target.value) || 1,
                            statistic: undefined,
                          },
                        })
                      }
                      min="1"
                      max="10"
                      className="bg-black/50 border-gold/30 text-white text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {positionLabel(formData.derivationConfig?.rank ?? 1)} in the final standings
                    </p>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={formData.overrideEnabled || false}
                    onChange={(e) =>
                      setFormData({ ...formData, overrideEnabled: e.target.checked })
                    }
                    className="rounded"
                  />
                  Allow manual override
                </label>
              </div>
            )}
          </div>

          {formError && (
            <p className="flex items-center gap-1.5 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4" /> {formError}
            </p>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex-1 bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </span>
              ) : editingId ? (
                "Update Award"
              ) : (
                "Create Award"
              )}
            </Button>
            <Button
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
                resetForm()
              }}
              disabled={isSaving}
              variant="outline"
              className="flex-1 border-gold/30 text-gold hover:bg-gold/10 disabled:opacity-50"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {rowError && (
        <p className="flex items-center gap-1.5 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4" /> {rowError}
        </p>
      )}

      {/* Awards List */}
      <div className="space-y-3">
        {!isLoading && awards.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            No awards yet. Create one to get started.
          </p>
        ) : (
          awards.map((award) => (
            <div
              key={award.id}
              className="bg-black/50 border border-gold/20 hover:border-gold/40 rounded-lg p-4 transition-all"
            >
              <div className="flex items-start gap-4">
                {award.imageUrl && (
                  <img
                    src={award.imageUrl}
                    alt={award.title}
                    className="w-16 h-16 rounded-lg object-cover shrink-0"
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-bold text-white text-sm">{award.title}</h4>
                      <p className="text-gray-400 text-xs mt-0.5">{award.description}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        onClick={() => handleEditAward(award)}
                        variant="ghost"
                        size="sm"
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                      >
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDuplicateAward(award)}
                        disabled={pendingDuplicateId === award.id}
                        variant="ghost"
                        size="sm"
                        className="text-green-400 hover:text-green-300 hover:bg-green-900/20 disabled:opacity-50"
                      >
                        {pendingDuplicateId === award.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        onClick={() => handleDeleteAward(award.id)}
                        disabled={pendingDeleteId === award.id}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20 disabled:opacity-50"
                      >
                        {pendingDeleteId === award.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center text-xs">
                    <span className="px-2 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold">
                      {AWARD_TYPES.find((t) => t.value === award.awardType)?.label}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full border ${
                        PRIZE_CATEGORIES.find((c) => c.value === award.prizeCategory)?.color ||
                        "bg-gray-900/20 border-gray-900/50"
                      }`}
                    >
                      {PRIZE_CATEGORIES.find((c) => c.value === award.prizeCategory)?.label}
                    </span>
                    {award.prizeValue && (
                      <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">
                        {award.prizeValue}
                      </span>
                    )}
                    <span className="px-2 py-1 rounded-full bg-purple-900/30 border border-purple-900/50 text-purple-300">
                      {derivationBadge(award)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}