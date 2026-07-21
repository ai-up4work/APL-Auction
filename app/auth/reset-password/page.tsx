// app/auth/reset-password/page.tsx
"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ResetResult {
  success: boolean
  error?: string
}

// Mocked reset-password request — swap this out for the real server action
// (e.g. requestPasswordReset) once auth is wired back up.
async function mockRequestPasswordReset(_email: string): Promise<ResetResult> {
  await new Promise((resolve) => setTimeout(resolve, 900))
  return { success: true }
}

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Lock page scroll while this screen is mounted, regardless of any
  // surrounding layout, so the viewport can never be scrolled.
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await mockRequestPasswordReset(email)
      if (!result.success) {
        throw new Error(result.error || "Failed to send reset link")
      }
      setSubmitted(true)
    } catch (err: any) {
      console.error("Password reset request error:", err)
      setError(err.message || "Failed to send reset link")
    } finally {
      setIsLoading(false)
    }
  }

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
      {/* Same overlay treatment as the login screen, for consistency
          across the app */}
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
            {submitted ? (
              <div className="py-2 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                  <CheckCircle2 className="h-7 w-7 text-primary" />
                </div>
                <h1 className="mb-2 text-2xl font-bold leading-tight text-foreground sm:text-[1.75rem]">
                  Check your email
                </h1>
                <p className="mx-auto max-w-sm text-sm text-foreground/70">
                  If an account exists for <span className="font-semibold text-foreground">{email}</span>, a password
                  reset link is on its way.
                </p>
                <Link href="/auth/login" className="mt-6 inline-block">
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full border-2 border-foreground bg-transparent text-sm font-semibold uppercase tracking-wide text-foreground transition-all duration-300 hover:border-primary hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_20px_color-mix(in_oklch,var(--primary)_80%,transparent),0_0_40px_color-mix(in_oklch,var(--primary)_50%,transparent)]"
                  >
                    Back to login
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <p className="mb-1.5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary/90">
                  Forgot password
                </p>
                <h1 className="mb-2 text-center text-2xl font-bold leading-tight text-foreground sm:text-[1.75rem]">
                  Reset your password
                </h1>
                <p className="mb-6 text-center text-sm text-foreground/70">
                  Enter your email and we&apos;ll send you a link to get back in.
                </p>

                {error && (
                  <Alert variant="destructive" className="mb-4 border-destructive/40 bg-destructive/10 py-2 text-destructive">
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-foreground/70">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                      <input
                        id="reset-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-full border border-input bg-input py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-foreground/40 outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_15px_color-mix(in_oklch,var(--primary)_50%,transparent)]"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-foreground/50">
                      We&apos;ll send a link to reset your password to this address.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={isLoading}
                    className="w-full rounded-full bg-primary text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_0_25px_color-mix(in_oklch,var(--primary)_85%,transparent),0_0_50px_color-mix(in_oklch,var(--primary)_45%,transparent)] disabled:opacity-60"
                  >
                    {isLoading ? "Sending…" : "Send reset link"}
                  </Button>
                </form>
              </>
            )}
          </div>

          {!submitted && (
            <p className="mt-4 shrink-0 text-center text-sm text-foreground/70 drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]">
              Remembered it?{" "}
              <Link href="/auth/login" className="font-semibold text-foreground transition-colors duration-300 hover:text-primary">
                Back to login
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}