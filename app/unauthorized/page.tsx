// app/unauthorized/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Shown when someone lands on a protected route without a session. Link to
// this from ProtectedRoute instead of (or before) redirecting straight to
// /auth/login, if you want to explain why they were bounced.
// ─────────────────────────────────────────────────────────────────────────────
"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function UnauthorizedPage() {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    html.style.overflow = "hidden"
    body.style.overflow = "hidden"
    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
    }
  }, [])

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
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
                <ShieldAlert className="h-7 w-7 text-destructive" />
              </div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary/90">
                Restricted
              </p>
              <h1 className="mb-2 text-2xl font-bold leading-tight text-foreground sm:text-[1.75rem]">
                Sign in required
              </h1>
              <p className="mx-auto max-w-sm text-sm text-foreground/70">
                You need to be logged in to view this page. Sign in to continue, or create an account if
                you&apos;re new here.
              </p>

              <div className="mt-6 flex flex-col gap-3">
                <Link href="/auth/login">
                  <Button
                    size="lg"
                    className="w-full rounded-full bg-primary text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_0_25px_color-mix(in_oklch,var(--primary)_85%,transparent),0_0_50px_color-mix(in_oklch,var(--primary)_45%,transparent)]"
                  >
                    Go to login
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full rounded-full border-2 border-foreground bg-transparent text-sm font-semibold uppercase tracking-wide text-foreground transition-all duration-300 hover:border-primary hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_20px_color-mix(in_oklch,var(--primary)_80%,transparent),0_0_40px_color-mix(in_oklch,var(--primary)_50%,transparent)]"
                  >
                    Create an account
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <p className="mt-4 shrink-0 text-center text-sm text-foreground/70 drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]">
            <Link href="/" className="font-semibold text-foreground transition-colors duration-300 hover:text-primary">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}