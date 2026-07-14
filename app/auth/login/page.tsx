"use client"

import type React from "react"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, ArrowRight, Lock, Mail, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

// --- Mock auth config ---------------------------------------------------
const MOCK_USERS = [
  { email: "demo@example.com", password: "password123" },
  { email: "admin@example.com", password: "admin123" },
]

const MOCK_DELAY_MS = 900

function mockSignIn(email: string, password: string): Promise<{ error: string | null }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const match = MOCK_USERS.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      )
      if (match) {
        if (typeof window !== "undefined") {
          localStorage.setItem("mock-session", JSON.stringify({ email, loggedInAt: Date.now() }))
        }
        resolve({ error: null })
      } else {
        resolve({ error: "Those credentials don't match our records" })
      }
    }, MOCK_DELAY_MS)
  })
}

const MODULE_MARKS = ["AUCTION", "BRACKET", "BROADCAST"]
// -------------------------------------------------------------------------

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const justRegistered = searchParams.get("registered") === "true"

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await mockSignIn(email, password)

      if (result.error) {
        setError(result.error)
        setIsLoading(false)
        return
      }

      router.push("/profile")
      router.refresh()
    } catch (err) {
      console.error("Login error:", err)
      setError("An unexpected error occurred. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-black flex">
      {/* ══════════════ LEFT — brand panel, hidden below md ══════════════ */}
      <aside className="relative hidden md:flex md:w-[44%] lg:w-1/2 flex-col justify-between overflow-hidden border-r border-gold/15">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/website-background.png"
            alt=""
            fill
            priority
            className="object-cover object-center"
          />
        </div>
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/70 via-black/45 to-black/85" />
        <div className="absolute inset-0 z-0 section-pattern opacity-60" />

        <div className="relative z-10 flex flex-1 flex-col items-start justify-center px-10 lg:px-14">
          <div className="relative w-16 h-16 mb-8 floating">
            <Image src="/valiant-league-logo.png" alt="Valiant League Logo" fill className="object-contain" priority />
          </div>

          <h1 className="font-cinzel text-4xl lg:text-5xl font-bold text-white leading-[1.1] tracking-wide">
            VALIANT
            <br />
            <span className="gold-gradient-text">LEAGUE</span>
          </h1>

          <p className="mt-6 max-w-xs text-gray-300 text-sm italic leading-relaxed tracking-wide">
            Where the gavel falls, the bracket updates, and the whole room watches — live.
          </p>
        </div>

        <div className="relative z-10 px-10 lg:px-14 pb-10">
          <div className="h-px w-full bg-gradient-to-r from-gold/50 via-gold/15 to-transparent mb-4" />
          <div className="flex items-center gap-5">
            {MODULE_MARKS.map((m, i) => (
              <span key={m} className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-[0.2em] text-gold/70">{m}</span>
                {i < MODULE_MARKS.length - 1 && <span className="text-gray-600 text-xs">·</span>}
              </span>
            ))}
          </div>
        </div>
      </aside>

      {/* Crest seal straddling the divider, desktop only */}
      <div className="absolute left-[44%] lg:left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 hidden md:flex">
        <div className="relative h-12 w-12 rotate-45 border border-gold/50 bg-black flex items-center justify-center shadow-[0_0_20px_rgba(245,166,35,0.25)]">
          <Shield className="h-5 w-5 text-gold -rotate-45" strokeWidth={1.75} />
        </div>
      </div>

      {/* ══════════════ RIGHT — form panel ══════════════ */}
      <section className="relative flex-1 flex flex-col overflow-y-auto">
        {/* mobile-only background, since the aside is hidden */}
        <div className="absolute inset-0 z-0 md:hidden">
          <Image src="/images/website-background.png" alt="" fill priority className="object-cover object-center" />
          <div className="absolute inset-0 hero-gradient" />
          <div className="absolute inset-0 section-pattern" />
        </div>
        {/* desktop texture + glow, so the panel isn't flat black */}
        <div className="absolute inset-0 z-0 hidden md:block section-pattern" />
        <div
          className="absolute inset-0 z-0 hidden md:block pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(245,166,35,0.08), transparent 65%)",
          }}
        />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 md:px-12 py-8">
          <div className="w-full max-w-md">
            {/* mobile-only wordmark */}
            <Link href="/" className="md:hidden flex flex-col items-center gap-2 mb-6 group">
              <div className="relative w-12 h-12 floating">
                <Image src="/valiant-league-logo.png" alt="Valiant League Logo" fill className="object-contain" priority />
              </div>
              <h1 className="text-base font-bold text-white font-cinzel tracking-wider">
                VALIANT <span className="gold-gradient-text">LEAGUE</span>
              </h1>
            </Link>

            <div className="mb-6 fade-in">
              <p className="font-cinzel text-xs tracking-[3px] text-gray-400 mb-3">MEMBER ACCESS</p>
              <h2 className="font-cinzel text-3xl md:text-4xl font-bold text-white leading-tight">
                Welcome <span className="text-gold">Back</span>
              </h2>
              <p className="text-gray-300 text-sm mt-3">Sign in to run your next auction.</p>
            </div>

            {/* Card surface — gives the form a defined edge instead of floating in open black */}
            <div className="fade-in-up stagger-1 rounded-2xl border border-gold/15 bg-black/40 backdrop-blur-sm shadow-2xl shadow-black/60 p-6 md:p-8">
              {justRegistered && (
                <Alert className="mb-4 bg-green-900/20 border-green-900 text-green-300 py-2">
                  <AlertDescription className="text-xs">
                    Registration successful! Please log in with your new account.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive" className="mb-4 bg-red-900/20 border-red-900 text-red-300 py-2">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="block text-gray-400 text-[11px] tracking-[2px]"
                    style={{ fontFamily: "var(--font-cinzel)" }}
                  >
                    EMAIL
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gold/60 z-10 pointer-events-none" />
                    <input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ backgroundColor: "rgba(0,0,0,0.65)", color: "#ffffff", fontFamily: "var(--font-sans)" }}
                      className="w-full h-11 pl-10 pr-3 rounded-md border border-white/10 text-sm placeholder:text-gray-500 outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/10 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label
                      htmlFor="password"
                      className="block text-gray-400 text-[11px] tracking-[2px]"
                      style={{ fontFamily: "var(--font-cinzel)" }}
                    >
                      PASSWORD
                    </label>
                    <Link href="/auth/forgot-password" className="text-xs text-gold/80 hover:text-gold transition-colors">
                      Forgot?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gold/60 z-10 pointer-events-none" />
                    <input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ backgroundColor: "rgba(0,0,0,0.65)", color: "#ffffff", fontFamily: "var(--font-sans)" }}
                      className="w-full h-11 pl-10 pr-3 rounded-md border border-white/10 text-sm placeholder:text-gray-500 outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/10 transition-colors"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-gold hover:bg-gold/90 text-black font-bold font-cinzel tracking-wide hover:scale-[1.01] transition-all duration-300 group mt-2"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                      Signing in…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Sign In
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </Button>
              </form>

              <div className="mt-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] tracking-widest text-gray-600 font-mono uppercase">or</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <p className="mt-6 text-center text-sm text-gray-400">
                Don't have an account?{" "}
                <Link href="/auth/register" className="text-gold hover:underline font-medium">
                  Register
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Footer strip — mirrors the left panel's bottom rhythm so the space reads composed, not empty */}
        <div className="relative z-10 hidden md:block px-12 pb-8">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/15 to-transparent mb-4" />
          <p className="text-center text-gray-500 text-xs">
            Need help getting in? <span className="text-gold/80">hello@valiantleague.app</span>
          </p>
        </div>
      </section>
    </main>
  )
}