// components/ui/loading.tsx
import { Loader2 } from "lucide-react"

interface LoadingProps {
  /** Optional message shown under the spinner. */
  label?: string
  /** "full" fills the viewport (for whole-page loads). "inline" sits within
   * its parent (for loading a section of an already-rendered page). */
  variant?: "full" | "inline"
  className?: string
}

export function Loading({ label = "Loading…", variant = "full", className = "" }: LoadingProps) {
  const wrapperClass =
    variant === "full"
      ? "flex min-h-screen w-full flex-col items-center justify-center gap-3"
      : "flex w-full flex-col items-center justify-center gap-3 py-16"

  return (
    <div className={`${wrapperClass} ${className}`} role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-foreground/60">{label}</p>
    </div>
  )
}