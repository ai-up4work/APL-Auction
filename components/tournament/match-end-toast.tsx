"use client"

import { useEffect, useState } from "react"
import { Trophy, X } from "lucide-react"

interface MatchEndToastProps {
  show: boolean
  onDismiss: () => void
  teamAName: string
  teamBName: string
  resultNote?: string
}

export function MatchEndToast({ show, onDismiss, teamAName, teamBName, resultNote }: MatchEndToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!show) return
    setVisible(true)
    const t = setTimeout(() => {
      setVisible(false)
      onDismiss()
    }, 8000)
    return () => clearTimeout(t)
  }, [show, onDismiss])

  if (!show) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-50 max-w-sm bg-black border border-gold/40 rounded-lg shadow-xl shadow-black/60 p-4 flex items-start gap-3 transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
    >
      <div className="h-9 w-9 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
        <Trophy className="h-4 w-4 text-gold" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-white text-sm font-bold font-cinzel">Match complete</p>
        <p className="text-gray-400 text-xs mt-0.5 break-words">
          {teamAName} vs {teamBName}
          {resultNote ? ` — ${resultNote}` : ""}
        </p>
      </div>
      <button
        onClick={() => {
          setVisible(false)
          onDismiss()
        }}
        className="text-gray-500 hover:text-gray-300 shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}