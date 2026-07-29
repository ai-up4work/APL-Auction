"use client"

import { AlertTriangle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CascadeDeleteWarningProps {
  itemName: string
  itemType: "Tournament" | "Squad Board" | "Auction" | "Match"
  orphanedItems: Array<{
    type: string
    name: string
    count: number
  }>
  onConfirm: () => void
  onCancel: () => void
  isDeleting?: boolean
}

export function CascadeDeleteWarning({
  itemName,
  itemType,
  orphanedItems,
  onConfirm,
  onCancel,
  isDeleting = false,
}: CascadeDeleteWarningProps) {
  const hasOrphans = orphanedItems.length > 0

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
      <div className="flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-amber-700 mb-2">
            Delete {itemType}?
          </h4>
          <p className="text-xs text-amber-700/90 mb-3">
            You&apos;re about to delete <strong>&ldquo;{itemName}&rdquo;</strong> ({itemType}).
            {hasOrphans && (
              <>
                {" "}Your linked items will be unlinked (not deleted):
                <ul className="mt-2 space-y-1 ml-2">
                  {orphanedItems.map((item, idx) => (
                    <li key={idx} className="text-xs text-amber-700/80">
                      • <strong>{item.count}</strong> {item.type}
                      {item.count !== 1 ? "s" : ""} ({item.name})
                    </li>
                  ))}
                </ul>
              </>
            )}
          </p>

          <div className="flex gap-2 mt-4">
            <Button
              onClick={onConfirm}
              disabled={isDeleting}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {itemType}
                </>
              )}
            </Button>
            <Button
              onClick={onCancel}
              disabled={isDeleting}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold disabled:opacity-50"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
