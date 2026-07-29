"use client"

import { useState } from "react"
import { Plus, Trophy, Swords } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { PoolTeam, AuctionSummary } from "@/lib/organization/organization"

interface TournamentCreationDialogProps {
  onConfirm: (data: {
    name: string
    format: "single_elimination" | "double_elimination" | "round_robin"
    source: "board" | "auction"
    sourceId: string | null
  }) => Promise<void>
  poolTeams: PoolTeam[]
  auctions: AuctionSummary[]
  isLoading?: boolean
}

type Step = "source" | "details"

export function TournamentCreationDialog({
  onConfirm,
  poolTeams,
  auctions,
  isLoading = false,
}: TournamentCreationDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<Step>("source")
  const [source, setSource] = useState<"board" | "auction" | null>(null)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [format, setFormat] = useState<"single_elimination" | "double_elimination" | "round_robin">(
    "single_elimination"
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReset = () => {
    setStep("source")
    setSource(null)
    setSourceId(null)
    setName("")
    setFormat("single_elimination")
    setError(null)
    setIsSubmitting(false)
  }

  const handleClose = () => {
    handleReset()
    setIsOpen(false)
  }

  const handleSourceSelect = (selectedSource: "board" | "auction") => {
    setSource(selectedSource)
    setSourceId(null)
    setStep("details")
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Tournament name is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onConfirm({
        name: name.trim(),
        format,
        source: source || "board", // Default to board if not selected
        sourceId: sourceId || null,
      })
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tournament")
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} disabled={isLoading} className="gap-2">
        <Plus className="h-4 w-4" />
        Create Tournament
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-gold/20 rounded-lg p-6 max-w-md w-full max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-cinzel font-bold text-white">Create Tournament</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        {step === "source" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300 mb-6">
              Select where you want to create your tournament from:
            </p>

            {/* Squad Board Option */}
            <button
              onClick={() => handleSourceSelect("board")}
              className="w-full p-4 border-2 border-gold/30 rounded-lg hover:border-gold/60 hover:bg-gold/5 transition-all text-left"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded bg-gold/10 border border-gold/20">
                  <Swords className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">From Squad Board</h3>
                  <p className="text-sm text-gray-400">Use teams from your Team Pool</p>
                  <p className="text-xs text-gray-500 mt-2">You can edit teams and players later</p>
                </div>
              </div>
            </button>

            {/* Auction Option */}
            <button
              onClick={() => handleSourceSelect("auction")}
              className="w-full p-4 border-2 border-gold/30 rounded-lg hover:border-gold/60 hover:bg-gold/5 transition-all text-left"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded bg-gold/10 border border-gold/20">
                  <Trophy className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">From Auction</h3>
                  <p className="text-sm text-gray-400">Use teams and rosters from an auction</p>
                  <p className="text-xs text-gray-500 mt-2">Locked for consistency with auction rosters</p>
                </div>
              </div>
            </button>

            <Button onClick={handleClose} variant="outline" className="w-full mt-6">
              Cancel
            </Button>
          </div>
        )}

        {step === "details" && (
          <div className="space-y-4">
            {/* Back Button */}
            <button
              onClick={() => {
                setStep("source")
                setSourceId(null)
              }}
              className="text-sm text-gold hover:text-gold/80 mb-2"
            >
              ← Back to source selection
            </button>

            {/* Tournament Name */}
            <div>
              <label className="text-xs uppercase tracking-widest text-gold/70 font-cinzel block mb-2">
                Tournament Name *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Spring Championship"
                className="bg-black/50 border-gold/20"
              />
            </div>

            {/* Format */}
            <div>
              <label className="text-xs uppercase tracking-widest text-gold/70 font-cinzel block mb-2">
                Format *
              </label>
              <div className="space-y-2">
                {["single_elimination", "double_elimination", "round_robin"].map((fmt) => (
                  <label key={fmt} className="flex items-center gap-3 p-2 rounded hover:bg-gold/5 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value={fmt}
                      checked={format === fmt}
                      onChange={(e) => setFormat(e.target.value as any)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-300 capitalize">{fmt.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Source Selection */}
            {!source && (
              <div>
                <label className="text-xs uppercase tracking-widest text-gold/70 font-cinzel block mb-3">
                  Create From (Optional)
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => handleSourceSelect("board")}
                    className={`w-full p-3 border rounded text-left transition-all ${
                      source === "board"
                        ? "border-gold bg-gold/10"
                        : "border-gold/20 hover:border-gold/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Swords className="h-4 w-4 text-gold" />
                      <span className="text-sm text-gray-300">Squad Board</span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleSourceSelect("auction")}
                    className={`w-full p-3 border rounded text-left transition-all ${
                      source === "auction"
                        ? "border-gold bg-gold/10"
                        : "border-gold/20 hover:border-gold/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-gold" />
                      <span className="text-sm text-gray-300">Auction</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {source === "auction" && (
              <div>
                <label className="text-xs uppercase tracking-widest text-gold/70 font-cinzel block mb-2">
                  Select Auction (Optional)
                </label>
                <select
                  value={sourceId || ""}
                  onChange={(e) => setSourceId(e.target.value || null)}
                  className="w-full bg-black/50 border border-gold/20 text-white rounded px-3 py-2 text-sm"
                >
                  <option value="">Select an auction...</option>
                  {auctions.map((auction) => (
                    <option key={auction.id} value={auction.id}>
                      {auction.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Error */}
            {error && <div className="text-sm text-red-400 p-2 bg-red-500/10 rounded">{error}</div>}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !name.trim()}
                className="flex-1"
              >
                {isSubmitting ? "Creating..." : "Create Tournament"}
              </Button>
              <Button onClick={handleClose} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
