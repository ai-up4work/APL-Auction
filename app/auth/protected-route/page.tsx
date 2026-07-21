// app/auth/protected-route/page.tsx
// app/auth/protected-route/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A minimal demo of <ProtectedRoute>. Visit this route while signed out and
// you'll be bounced to /auth/login; sign in and you'll see the user's info
// below, pulled from useAuth().
// ─────────────────────────────────────────────────────────────────────────────
"use client"

import Link from "next/link"
import { LogOut, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/context/AuthContext"

function ProtectedContent() {
  const { user, signOut } = useAuth()

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-gradient-to-br from-background via-card to-secondary">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "url('/images/bg-login.png')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="absolute inset-0 z-0 hero-gradient" />

      <div className="relative z-10 flex h-full items-center justify-center overflow-hidden px-6">
        <div className="flex max-h-full w-full max-w-md flex-col justify-center">
          <div className="mb-6 shrink-0 text-center animate-pulse-scale">
            <Link href="/" className="text-2xl font-bold uppercase tracking-[0.15em] text-foreground drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
              Valiant League
            </Link>
          </div>

          <div
            className="shrink-0 rounded-3xl border border-border bg-card/10 p-7 backdrop-blur-xl sm:p-8"
            style={{
              boxShadow:
                "0 20px 60px -15px rgba(0,0,0,0.6), inset 0 1px 0 0 rgba(255,255,255,0.06), inset 0 0 40px 0 color-mix(in oklch, var(--primary) 4%, transparent)",
            }}
          >
            <div className="py-2 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                <ShieldCheck className="h-7 w-7 text-primary" />
              </div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary/90">
                Protected route
              </p>
              <h1 className="mb-2 text-2xl font-bold leading-tight text-foreground sm:text-[1.75rem]">
                You&apos;re signed in
              </h1>
              <p className="mx-auto max-w-sm text-sm text-foreground/70">
                This page only renders because <code className="text-foreground">ProtectedRoute</code> found an
                active session.
              </p>

              <div className="mt-6 space-y-2 rounded-2xl border border-border bg-black/20 p-4 text-left text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-foreground/50">Email</span>
                  <span className="truncate text-foreground">{user?.email}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-foreground/50">User ID</span>
                  <span className="truncate text-foreground">{user?.id}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-foreground/50">Name</span>
                  <span className="truncate text-foreground">
                    {(user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? "—"}
                  </span>
                </div>
              </div>

              <Button
                size="lg"
                onClick={signOut}
                variant="outline"
                className="group mt-6 w-full rounded-full border-2 border-foreground bg-transparent text-sm font-semibold uppercase tracking-wide text-foreground transition-all duration-300 hover:border-primary hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_20px_color-mix(in_oklch,var(--primary)_80%,transparent),0_0_40px_color-mix(in_oklch,var(--primary)_50%,transparent)]"
              >
                <LogOut className="mr-1.5 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProtectedRouteDemoPage() {
  return (
    <ProtectedRoute>
      <ProtectedContent />
    </ProtectedRoute>
  )
}