"use client"

import { useEffect, useState } from "react"
import { Trophy, Sparkles, ImageOff } from "lucide-react"

interface Award {
  id: string
  title: string
  description?: string
  awardType: "individual" | "team"
  prizeCategory: "cash" | "physical" | "badge" | "experience"
  prizeValue?: string
  imageUrl?: string
  recipientName?: string
  recipientId?: string
  awardedAt?: number
  notes?: string
}

interface EnhancedAwardsPanelProps {
  awards: Award[]
  isLive?: boolean
}

const PRIZE_COLORS = {
  cash: "from-yellow-500/20 to-yellow-600/20 border-yellow-500/50",
  physical: "from-purple-500/20 to-purple-600/20 border-purple-500/50",
  badge: "from-blue-500/20 to-blue-600/20 border-blue-500/50",
  experience: "from-pink-500/20 to-pink-600/20 border-pink-500/50",
} as const

const PRIZE_EMOJIS = {
  cash: "💰",
  physical: "🎁",
  badge: "🏅",
  experience: "✨",
} as const

export default function EnhancedAwardsPanel({
  awards,
  isLive = false,
}: EnhancedAwardsPanelProps) {
  const [displayAwards, setDisplayAwards] = useState<Award[]>(awards)
  const [justAwarded, setJustAwarded] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Detect newly awarded items (within last 5 seconds)
    const now = Date.now()
    const recentlyAwarded = new Set<string>()

    awards.forEach((award) => {
      if (
        award.awardedAt &&
        now - award.awardedAt < 5000 &&
        !displayAwards.find((a) => a.id === award.id && a.awardedAt === award.awardedAt)
      ) {
        recentlyAwarded.add(award.id)
      }
    })

    if (recentlyAwarded.size > 0) {
      setJustAwarded(recentlyAwarded)
      const timer = setTimeout(() => setJustAwarded(new Set()), 5000)
      return () => clearTimeout(timer)
    }
  }, [awards, displayAwards])

  useEffect(() => {
    setDisplayAwards(awards)
  }, [awards])

  if (displayAwards.length === 0) {
    return (
      <div className="bg-black/50 border border-gold/20 rounded-lg p-8 text-center">
        <Trophy className="h-8 w-8 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No awards have been announced yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-gold" />
        <h3 className="text-lg font-bold text-white font-cinzel">Tournament Awards</h3>
        {isLive && (
          <span className="ml-auto flex items-center gap-1 text-xs bg-red-500/20 border border-red-500/50 text-red-400 px-2 py-1 rounded-full animate-pulse">
            <span className="h-1.5 w-1.5 bg-red-500 rounded-full" />
            Live
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayAwards.map((award) => {
          const isJustAwarded = justAwarded.has(award.id)
          const bgGradient = PRIZE_COLORS[award.prizeCategory]
          const emoji = PRIZE_EMOJIS[award.prizeCategory]

          return (
            <div
              key={award.id}
              className={`relative overflow-hidden rounded-lg border transition-all duration-500 ${
                isJustAwarded
                  ? `bg-gradient-to-br ${bgGradient} scale-105 shadow-lg shadow-gold/50`
                  : "bg-black/50 border-gold/20 hover:border-gold/40"
              }`}
            >
              {/* Just Awarded Badge */}
              {isJustAwarded && (
                <div className="absolute top-2 right-2 z-10 animate-bounce">
                  <div className="flex items-center gap-1 bg-gold text-black text-xs font-bold px-3 py-1 rounded-full">
                    <Sparkles className="h-3 w-3" />
                    Just awarded!
                  </div>
                </div>
              )}

              <div className="overflow-hidden">
                {/* Image Section */}
                {award.imageUrl && (
                  <div className="relative h-32 bg-gradient-to-br from-black/60 to-black/80 overflow-hidden border-b border-gold/20">
                    <img
                      src={award.imageUrl}
                      alt={award.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement
                        img.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-black/60"><div class="text-gray-600"><svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div></div>`
                      }}
                    />
                    {/* Prize Category Badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur px-2 py-1 rounded-full border border-gold/30">
                      <span className="text-sm">{emoji}</span>
                      <span className="text-xs font-semibold text-gold capitalize">
                        {award.prizeCategory}
                      </span>
                    </div>
                  </div>
                )}

                {/* Content Section */}
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-bold text-white text-sm leading-snug mb-1">
                      {award.title}
                    </h4>
                    {award.description && (
                      <p className="text-xs text-gray-400 line-clamp-2">
                        {award.description}
                      </p>
                    )}
                  </div>

                  {/* Recipient Info */}
                  {award.recipientName && (
                    <div className="bg-black/30 rounded px-3 py-2 border border-gold/10">
                      <p className="text-xs text-gray-500">Awarded to</p>
                      <p className="font-semibold text-white text-sm">{award.recipientName}</p>
                    </div>
                  )}

                  {/* Prize Value */}
                  {award.prizeValue && (
                    <div className="flex items-center justify-between pt-2 border-t border-gold/10">
                      <span className="text-xs text-gray-500">Prize</span>
                      <span className="font-bold text-gold text-sm">{award.prizeValue}</span>
                    </div>
                  )}

                  {/* Award Type */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="inline-block px-2 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-medium">
                      {award.awardType === "individual" ? "👤 Individual" : "👥 Team"}
                    </span>
                    {award.awardedAt && (
                      <span className="text-xs text-gray-500 ml-auto">
                        {new Date(award.awardedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Notes */}
                  {award.notes && (
                    <p className="text-xs text-gray-500 italic pt-2 border-t border-gold/10">
                      {award.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary Stats */}
      {displayAwards.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-4 border-t border-gold/10">
          <div className="text-center">
            <p className="text-2xl font-bold text-gold">{displayAwards.length}</p>
            <p className="text-xs text-gray-500">Total Awards</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gold">
              {displayAwards.filter((a) => a.awardType === "individual").length}
            </p>
            <p className="text-xs text-gray-500">Individual</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gold">
              {displayAwards.filter((a) => a.awardType === "team").length}
            </p>
            <p className="text-xs text-gray-500">Team</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gold">
              {displayAwards.filter((a) => a.awardedAt).length}
            </p>
            <p className="text-xs text-gray-500">Awarded</p>
          </div>
        </div>
      )}
    </div>
  )
}
