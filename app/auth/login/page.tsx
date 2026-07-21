"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Lock, Mail, Facebook, Instagram, Linkedin, Twitter } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // Replace with real auth call
    setTimeout(() => setLoading(false), 900)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-gradient-to-br from-background via-card to-secondary">
      <div className="absolute inset-0 z-0">
        <iframe
          src="https://my.spline.design/motiontrails-N1l4U8E0SAeloIlUTSuSUU9m/"
          frameBorder="0"
          width="100%"
          height="100%"
          className="h-full w-full"
        />
      </div>
      <div className="absolute inset-0 z-0 bg-background/20" />

      <div className="relative z-10 flex h-full items-center justify-center overflow-hidden px-6">
        <div className="flex max-h-full w-full max-w-md flex-col justify-center">
          <div className="mb-4 shrink-0 text-center animate-pulse-scale">
            <Link href="/" className="text-xl font-bold uppercase tracking-wide text-foreground">
              Valiant League
            </Link>
          </div>

          <div className="shrink-0 rounded-3xl border border-border bg-card/10 p-6 backdrop-blur-xl sm:p-7">
            <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wider text-accent-foreground/90">
              Welcome back
            </p>
            <h1 className="mb-5 text-center text-xl font-bold leading-tight text-foreground sm:text-2xl">Sign in</h1>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-foreground/70">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-full border border-input bg-input py-2.5 pl-11 pr-4 text-sm text-foreground placeholder:text-foreground/40 outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_15px_color-mix(in_oklch,var(--primary)_50%,transparent)]"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    Password
                  </label>
                  <Link
                    href="#"
                    className="text-xs text-foreground/60 transition-colors duration-300 hover:text-primary"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-full border border-input bg-input py-2.5 pl-11 pr-11 text-sm text-foreground placeholder:text-foreground/40 outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_15px_color-mix(in_oklch,var(--primary)_50%,transparent)]"
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
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="mt-1 w-full rounded-full bg-primary text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_0_20px_color-mix(in_oklch,var(--primary)_80%,transparent),0_0_40px_color-mix(in_oklch,var(--primary)_50%,transparent)] disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground/50">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button
              size="lg"
              variant="outline"
              className="w-full rounded-full border-2 border-foreground bg-transparent text-sm font-semibold uppercase tracking-wide text-foreground transition-all duration-300 hover:border-primary hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_20px_color-mix(in_oklch,var(--primary)_80%,transparent),0_0_40px_color-mix(in_oklch,var(--primary)_50%,transparent)]"
            >
              Create account
            </Button>

            <div className="mt-5 flex justify-center gap-6">
              <Twitter className="h-4 w-4 cursor-pointer text-foreground/70 transition-all duration-300 hover:text-primary hover:drop-shadow-[0_0_12px_color-mix(in_oklch,var(--primary)_90%,transparent)]" />
              <Linkedin className="h-4 w-4 cursor-pointer text-foreground/70 transition-all duration-300 hover:text-primary hover:drop-shadow-[0_0_12px_color-mix(in_oklch,var(--primary)_90%,transparent)]" />
              <Facebook className="h-4 w-4 cursor-pointer text-foreground/70 transition-all duration-300 hover:text-primary hover:drop-shadow-[0_0_12px_color-mix(in_oklch,var(--primary)_90%,transparent)]" />
              <Instagram className="h-4 w-4 cursor-pointer text-foreground/70 transition-all duration-300 hover:text-primary hover:drop-shadow-[0_0_12px_color-mix(in_oklch,var(--primary)_90%,transparent)]" />
            </div>
          </div>

          <p className="mt-3 shrink-0 text-center text-sm text-foreground/70">
            New here?{" "}
            <Link href="/signup" className="font-semibold text-foreground transition-colors duration-300 hover:text-primary">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}