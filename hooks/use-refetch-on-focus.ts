// hooks/use-refetch-on-focus.ts
"use client"

import { useEffect, useRef } from "react"

/**
 * Re-runs `onRefetch` whenever the tab/window regains focus or becomes
 * visible again.
 *
 * WHY THIS EXISTS: Next.js's App Router keeps a recently-visited client
 * route's component instance (and its React state) alive for back/forward
 * navigation instead of always remounting it from scratch. So a
 * `useEffect(() => { reload() }, [org.id])` that only runs on mount does
 * NOT rerun when you navigate away — e.g. to create a tournament or match,
 * which redirects to its own edit page — and then come back, because
 * nothing actually remounted and `org.id` didn't change. The data in the
 * database is fine; the component just never asked for it again. That's
 * the "list doesn't update until I hit refresh" symptom.
 *
 * `focus` / `visibilitychange` events fire reliably regardless of whether
 * the component was truly remounted or just restored from that cache, so
 * this is what actually catches it. A manual full-page refresh "fixes" it
 * for the same reason: it forces a real remount.
 */
export function useRefetchOnFocus(onRefetch: () => void) {
  // Keep the latest callback in a ref so the listeners (registered once)
  // always call the current version, not a stale closure from first mount.
  const onRefetchRef = useRef(onRefetch)
  onRefetchRef.current = onRefetch

  useEffect(() => {
    const handleFocus = () => onRefetchRef.current()
    const handleVisibility = () => {
      if (document.visibilityState === "visible") onRefetchRef.current()
    }
    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])
}