// components/protected-route.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Client-side route guard. Wrap any page that requires a signed-in user:
//
//   export default function DashboardPage() {
//     return (
//       <ProtectedRoute>
//         <DashboardContent />
//       </ProtectedRoute>
//     )
//   }
//
// This uses the AuthProvider's session state, so it renders a brief loading
// state on first paint while the session is restored from localStorage, then
// redirects to /unauthorized if there's no user (which in turn links to
// /auth/login and /auth/register). Because this check happens in the
// browser, it's a UX guard, not a security boundary — real authorization
// (e.g. RLS policies in Supabase) still has to enforce access on the data
// itself.
// ─────────────────────────────────────────────────────────────────────────────
"use client"

import type React from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthCOntext"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/unauthorized")
    }
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  return <>{children}</>
}