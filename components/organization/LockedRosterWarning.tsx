"use client"

import { AlertCircle, Lock } from "lucide-react"

interface LockedRosterWarningProps {
  boardName: string
  auctionName: string
}

export function LockedRosterWarning({ boardName, auctionName }: LockedRosterWarningProps) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex gap-3 mb-4">
      <Lock className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-amber-400 mb-1">
          This Squad Board is Locked
        </h4>
        <p className="text-xs text-amber-300/80">
          <strong>&ldquo;{boardName}&rdquo;</strong> is part of the <strong>&ldquo;{auctionName}&rdquo;</strong> auction.
          Once an auction is finalized, its rosters are locked to maintain data integrity. To modify this roster,
          create a new Squad Board or contact your administrator.
        </p>
      </div>
    </div>
  )
}