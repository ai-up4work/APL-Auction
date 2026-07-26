"use client"

import { useCallback, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface ConfirmOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  /** "danger" renders red for destructive actions (delete, remove). Defaults to "danger". */
  tone?: "danger" | "default"
}

interface ConfirmState extends ConfirmOptions {
  onCancel: () => void
  onConfirm: () => void
  /** Set while an async onConfirm (from confirmAndRun) is running. */
  busy: boolean
}

/**
 * Promise-based replacement for window.confirm().
 *
 * Usage:
 *   const { confirm, ConfirmDialogElement } = useConfirmDialog()
 *   ...
 *   const ok = await confirm({ title: "Delete match?", description: "...", tone: "danger" })
 *   if (!ok) return
 *   ...
 *   return <>{ConfirmDialogElement}</>  // render once, anywhere in the tree
 *
 * For actions with an async side effect (e.g. showing a spinner on the
 * confirm button until a delete call resolves), use confirmAndRun instead —
 * it keeps the dialog open with a spinner until the action finishes.
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        ...options,
        busy: false,
        onCancel: () => {
          setState(null)
          resolve(false)
        },
        onConfirm: () => {
          setState(null)
          resolve(true)
        },
      })
    })
  }, [])

  /** Keeps the dialog open (with a spinner on the confirm button) until
   *  `action` resolves, then closes it. Cancel still closes immediately. */
  const confirmAndRun = useCallback((options: ConfirmOptions, action: () => Promise<void>) => {
    return new Promise<boolean>((resolve) => {
      setState({
        ...options,
        busy: false,
        onCancel: () => {
          setState(null)
          resolve(false)
        },
        onConfirm: async () => {
          setState((prev) => (prev ? { ...prev, busy: true } : prev))
          try {
            await action()
          } finally {
            setState(null)
            resolve(true)
          }
        },
      })
    })
  }, [])

  const ConfirmDialogElement = state ? (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={() => {
        if (!state.busy) state.onCancel()
      }}
    >
      <div
        className="bg-[#0a0a0a] border border-gold/30 rounded-lg p-6 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-2">
          <div
            className={`p-2 rounded-lg flex-shrink-0 ${
              state.tone === "default" ? "bg-gold/10" : "bg-red-500/10"
            }`}
          >
            <AlertTriangle className={`h-5 w-5 ${state.tone === "default" ? "text-gold" : "text-red-400"}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-white font-cinzel mb-1">{state.title}</h3>
            <p className="text-gray-400 text-sm">{state.description}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button
            onClick={state.onCancel}
            disabled={state.busy}
            className="bg-transparent hover:bg-white/5 text-gray-300 border border-white/20 disabled:opacity-50"
          >
            {state.cancelText ?? "Cancel"}
          </Button>
          <Button
            onClick={state.onConfirm}
            disabled={state.busy}
            className={
              state.tone === "default"
                ? "bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
                : "bg-red-500 hover:bg-red-600 text-white font-bold disabled:opacity-50"
            }
          >
            {state.busy ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…
              </span>
            ) : (
              state.confirmText ?? "Confirm"
            )}
          </Button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, confirmAndRun, ConfirmDialogElement }
}