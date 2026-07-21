// app/auth/reset-password/page.tsx
"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, KeyRound, Mail, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useScrollTop } from "@/hooks/use-scroll-top"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"
import SectionDivider from "@/components/section-divider"
import { pageStyles } from "@/data/site-data"

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
  useScrollTop()
  const router = useRouter()
  const [isNavOpen, setIsNavOpen] = useState(false)

  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleNavigation = (path: string) => {
    router.push(path)
    window.scrollTo(0, 0)
  }

  const scrollToSection = (sectionId: string) => {
    router.push(`/#${sectionId}`)
    setIsNavOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
    <main className="overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      <SiteHeader
        activeSection="profile"
        isNavOpen={isNavOpen}
        setIsNavOpen={setIsNavOpen}
        scrollToSection={scrollToSection}
        handleNavigation={handleNavigation}
      />

      <section className="pt-32 sm:pt-40 pb-16 relative section-pattern min-h-screen">
        <div className="absolute inset-0 z-0 section-gradient" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-md mx-auto fade-in">
            <div className="mb-6">
              <Link href="/profile/edit">
                <Button variant="ghost" className="text-gray-300 hover:text-gold">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Account Settings
                </Button>
              </Link>
            </div>

            <div className="bg-black/50 border border-gold/20 rounded-lg overflow-hidden glow-effect fade-in-up">
              <div className="p-6 border-b border-gold/20 text-center">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
                  <KeyRound className="h-5 w-5 text-gold" />
                </div>
                <h1 className="text-2xl font-bold text-white font-cinzel">
                  Reset <span className="text-gold">Password</span>
                </h1>
                <p className="text-gray-400 text-sm mt-2">
                  Enter your email and we'll send you a link to get back in.
                </p>
              </div>

              <div className="p-6">
                {submitted ? (
                  <div className="text-center py-6">
                    <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
                      <CheckCircle2 className="h-7 w-7 text-gold" />
                    </div>
                    <h2 className="text-xl font-bold text-white font-cinzel mb-2">CHECK YOUR EMAIL</h2>
                    <p className="text-gray-300 text-sm max-w-sm mx-auto">
                      If an account exists for <span className="text-white font-semibold">{email}</span>, a password
                      reset link is on its way.
                    </p>
                    <Link href="/profile/edit" className="inline-block mt-6">
                      <Button variant="outline" className="border-gold/30 text-gold hover:bg-gold/10 bg-transparent">
                        Back to Account Settings
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                      <Alert variant="destructive" className="bg-red-900/20 border-red-900 text-red-300">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="reset-email" className="font-cinzel text-xs uppercase tracking-wide text-gray-400">
                        Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          id="reset-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder="you@example.com"
                          className="bg-black/50 border-gold/30 text-white pl-10"
                        />
                      </div>
                      <p className="text-xs text-gray-400">We'll send a link to reset your password to this address.</p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-gold hover:bg-gold/90 text-black font-bold font-cinzel"
                      disabled={isLoading}
                    >
                      {isLoading ? "Sending..." : "Send Reset Link"}
                    </Button>

                    <div className="text-center">
                      <Link href="/profile/edit" className="text-sm text-gray-400 hover:text-gold transition-colors">
                        Cancel and go back
                      </Link>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}