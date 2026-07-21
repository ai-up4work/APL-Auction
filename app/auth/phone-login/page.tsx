// app/auth/phone-login/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Risk-free phone-OTP sign-in, separate from the email/password flow.
// Use this together with a Supabase "Test OTP" mapping (Authentication →
// Providers → Phone → Test OTPs) — e.g. +15555550100 → 123456 — so you can
// exercise the whole OTP flow with no real SMS provider or cost. Real phone
// numbers still work here too if you've configured a live SMS provider.
// ─────────────────────────────────────────────────────────────────────────────
"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowRight, KeyRound, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase"

export default function PhoneLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<"phone" | "code">("phone")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: otpError } = await supabase.auth.signInWithOtp({ phone })

    if (otpError) {
      setError(otpError.message)
      setLoading(false)
      return
    }

    setStep("code")
    setLoading(false)
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    })

    if (verifyError) {
      setError(verifyError.message)
      setLoading(false)
      return
    }

    router.push("/dashboard")
    router.refresh()
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
              {step === "phone" ? "Phone sign-in" : "Verify code"}
            </p>
            <h1 className="mb-6 text-center text-2xl font-bold leading-tight text-foreground sm:text-[1.75rem]">
              {step === "phone" ? "Sign in with your phone" : "Enter the code"}
            </h1>

            {error && (
              <Alert variant="destructive" className="mb-4 border-destructive/40 bg-destructive/10 py-2 text-destructive">
                <AlertCircle className="h-4 w-4 mr-2" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {step === "phone" ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    Phone number
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                    <input
                      id="phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+15555550100"
                      className="w-full rounded-full border border-input bg-input py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-foreground/40 outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_15px_color-mix(in_oklch,var(--primary)_50%,transparent)]"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-foreground/50">
                    Use E.164 format (e.g. +15555550100). Configure test numbers in Supabase → Auth → Providers → Phone.
                  </p>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="group mt-2 w-full rounded-full bg-primary text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_0_25px_color-mix(in_oklch,var(--primary)_85%,transparent),0_0_50px_color-mix(in_oklch,var(--primary)_45%,transparent)] disabled:opacity-60"
                >
                  {loading ? "Sending…" : "Send code"}
                  {!loading && (
                    <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label htmlFor="code" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    6-digit code
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                    <input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="w-full rounded-full border border-input bg-input py-3 pl-11 pr-4 text-center text-lg tracking-[0.3em] text-foreground placeholder:tracking-normal placeholder:text-foreground/40 outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_15px_color-mix(in_oklch,var(--primary)_50%,transparent)]"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-foreground/50">Sent to {phone}.</p>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full rounded-full bg-primary text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_0_25px_color-mix(in_oklch,var(--primary)_85%,transparent),0_0_50px_color-mix(in_oklch,var(--primary)_45%,transparent)] disabled:opacity-60"
                >
                  {loading ? "Verifying…" : "Verify & sign in"}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("phone")
                    setCode("")
                    setError(null)
                  }}
                  className="w-full text-center text-xs text-foreground/60 transition-colors duration-300 hover:text-primary"
                >
                  Use a different number
                </button>
              </form>
            )}
          </div>

          <p className="mt-4 shrink-0 text-center text-sm text-foreground/70 drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]">
            Prefer email?{" "}
            <Link href="/auth/login" className="font-semibold text-foreground transition-colors duration-300 hover:text-primary">
              Sign in with email
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}