"use client"

import type React from "react"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

// --- Mock auth config ---------------------------------------------------
// Emails already "taken" for the mock — try one of these to see the error state.
const TAKEN_EMAILS = ["demo@example.com", "admin@example.com"]

const MOCK_DELAY_MS = 900

function mockRegister(
  name: string,
  email: string,
  password: string
): Promise<{ success: true } | { success: false; error: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (TAKEN_EMAILS.includes(email.toLowerCase())) {
        resolve({ success: false, error: "An account with this email already exists" })
        return
      }
      if (password.length < 8) {
        resolve({ success: false, error: "Password must be at least 8 characters long" })
        return
      }
      if (typeof window !== "undefined") {
        const existing = JSON.parse(localStorage.getItem("mock-registered-users") || "[]")
        existing.push({ name, email, registeredAt: Date.now() })
        localStorage.setItem("mock-registered-users", JSON.stringify(existing))
      }
      resolve({ success: true })
    }, MOCK_DELAY_MS)
  })
}
// -------------------------------------------------------------------------

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

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
      const result = await mockRegister(name, email, password)

      if (!result.success) {
        setError(result.error)
        setIsLoading(false)
        return
      }

      router.push("/auth/login?registered=true")
    } catch (err) {
      console.error("Registration error:", err)
      setError("An unexpected error occurred. Please try again.")
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
            <p className="mb-1.5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary/90">
              New member
            </p>
            <h1 className="mb-6 text-center text-2xl font-bold leading-tight text-foreground sm:text-[1.75rem]">
              Create your account
            </h1>

            {error && (
              <Alert variant="destructive" className="mb-4 border-destructive/40 bg-destructive/10 py-2 text-destructive">
                <AlertCircle className="h-4 w-4 mr-2" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-foreground/70">
                  Full name
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full rounded-full border border-input bg-input py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-foreground/40 outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_15px_color-mix(in_oklch,var(--primary)_50%,transparent)]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-foreground/70">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-full border border-input bg-input py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-foreground/40 outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_15px_color-mix(in_oklch,var(--primary)_50%,transparent)]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-foreground/70">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-full border border-input bg-input py-3 pl-11 pr-11 text-sm text-foreground placeholder:text-foreground/40 outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_15px_color-mix(in_oklch,var(--primary)_50%,transparent)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/50 transition-colors duration-300 hover:text-primary"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-foreground/50">Must be at least 8 characters long</p>
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={isLoading}
                className="group mt-2 w-full rounded-full bg-primary text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_0_25px_color-mix(in_oklch,var(--primary)_85%,transparent),0_0_50px_color-mix(in_oklch,var(--primary)_45%,transparent)] disabled:opacity-60"
              >
                {isLoading ? "Creating account…" : "Register"}
                {!isLoading && (
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                )}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground/50">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Link href="/auth/login">
              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-full border-2 border-foreground bg-transparent text-sm font-semibold uppercase tracking-wide text-foreground transition-all duration-300 hover:border-primary hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_20px_color-mix(in_oklch,var(--primary)_80%,transparent),0_0_40px_color-mix(in_oklch,var(--primary)_50%,transparent)]"
              >
                Log in instead
              </Button>
            </Link>
          </div>

          <p className="mt-4 shrink-0 text-center text-sm text-foreground/70 drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-semibold text-foreground transition-colors duration-300 hover:text-primary">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}