"use client"

import { useState } from "react"
import { Plus, Trash2, Copy, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import ImageUploadField from "@/components/common/ImageUploadField"

interface AwardTemplate {
  id: string
  title: string
  description: string
  awardType: "individual" | "team"
  prizeCategory: "cash" | "physical" | "badge" | "experience"
  prizeValue?: string
  imageUrl?: string
  isDataDerived: boolean
  derivationConfig?: {
    statistic: string
    rank: number
  }
  overrideEnabled?: boolean
}

interface AwardsManagerProps {
  tournamentId: string
  initialAwards?: AwardTemplate[]
  onAwardsChange?: (awards: AwardTemplate[]) => void
}

const PRIZE_CATEGORIES = [
  { value: "cash", label: "💰 Cash Prize", color: "bg-yellow-500/20 border-yellow-500/50" },
  { value: "physical", label: "🎁 Physical Item", color: "bg-purple-500/20 border-purple-500/50" },
  { value: "badge", label: "🏅 Badge", color: "bg-blue-500/20 border-blue-500/50" },
  { value: "experience", label: "✨ Experience", color: "bg-pink-500/20 border-pink-500/50" },
] as const

const AWARD_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "team", label: "Team" },
] as const

export default function AwardsManager({
  tournamentId,
  initialAwards = [],
  onAwardsChange,
}: AwardsManagerProps) {
  const [awards, setAwards] = useState<AwardTemplate[]>(initialAwards)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<AwardTemplate>>({
    awardType: "individual",
    prizeCategory: "cash",
    isDataDerived: false,
    overrideEnabled: true,
  })

  const handleAddAward = () => {
    if (!formData.title || !formData.description) {
      alert("Title and description are required")
      return
    }

    if (editingId) {
      setAwards(
        awards.map((a) =>
          a.id === editingId
            ? { ...a, ...formData, id: editingId }
            : a
        )
      )
      setEditingId(null)
    } else {
      const newAward: AwardTemplate = {
        id: `award-${Date.now()}`,
        title: formData.title || "",
        description: formData.description || "",
        awardType: formData.awardType || "individual",
        prizeCategory: formData.prizeCategory || "cash",
        prizeValue: formData.prizeValue,
        imageUrl: formData.imageUrl,
        isDataDerived: formData.isDataDerived || false,
        derivationConfig: formData.derivationConfig,
        overrideEnabled: formData.overrideEnabled,
      }
      setAwards([...awards, newAward])
    }

    setShowForm(false)
    setFormData({
      awardType: "individual",
      prizeCategory: "cash",
      isDataDerived: false,
      overrideEnabled: true,
    })

    onAwardsChange?.([
      ...awards,
      ...(editingId ? [] : [{ id: `award-${Date.now()}`, ...(formData as any) }]),
    ])
  }

  const handleEditAward = (award: AwardTemplate) => {
    setEditingId(award.id)
    setFormData(award)
    setShowForm(true)
  }

  const handleDeleteAward = (id: string) => {
    const updated = awards.filter((a) => a.id !== id)
    setAwards(updated)
    onAwardsChange?.(updated)
  }

  const handleDuplicateAward = (award: AwardTemplate) => {
    const newAward: AwardTemplate = {
      ...award,
      id: `award-${Date.now()}`,
    }
    setAwards([...awards, newAward])
    onAwardsChange?.([...awards, newAward])
  }

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
            Create a rich library of individual and team awards with images, prize categories, and database-driven automation.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null)
            setFormData({
              awardType: "individual",
              prizeCategory: "cash",
              isDataDerived: false,
              overrideEnabled: true,
            })
            setShowForm(true)
          }}
          className="bg-gold hover:bg-gold/90 text-black font-bold"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Award
        </Button>
      </div>

      {/* Award Form */}
      {showForm && (
        <div className="bg-black/50 border border-gold/30 rounded-lg p-6 space-y-4">
          <div>
            <label className="text-gray-400 text-sm block mb-2 font-medium">Title</label>
            <Input
              value={formData.title || ""}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., MVP Award, Most Wickets"
              className="bg-black/50 border-gold/30 text-white"
            />
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
                className="w-full bg-black/50 border border-gold/30 text-white rounded px-3 py-2"
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
                className="w-full bg-black/50 border border-gold/30 text-white rounded px-3 py-2"
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
                onChange={(e) => setFormData({ ...formData, isDataDerived: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="datadriven" className="text-sm text-gray-400">
                Derive from tournament statistics (auto-populate based on rankings)
              </label>
            </div>

            {formData.isDataDerived && (
              <div className="bg-gold/5 border border-gold/20 rounded p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Statistic</label>
                    <Input
                      value={formData.derivationConfig?.statistic || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          derivationConfig: {
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

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleAddAward}
              className="flex-1 bg-gold hover:bg-gold/90 text-black font-bold"
            >
              {editingId ? "Update Award" : "Create Award"}
            </Button>
            <Button
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
              }}
              variant="outline"
              className="flex-1 border-gold/30 text-gold hover:bg-gold/10"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Awards List */}
      <div className="space-y-3">
        {awards.length === 0 ? (
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
                        variant="ghost"
                        size="sm"
                        className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteAward(award.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
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
                    {award.isDataDerived && (
                      <span className="px-2 py-1 rounded-full bg-purple-900/30 border border-purple-900/50 text-purple-300">
                        Data-driven
                      </span>
                    )}
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
