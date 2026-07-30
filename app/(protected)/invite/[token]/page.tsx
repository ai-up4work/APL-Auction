// app/(public)/invite/[token]/page.tsx
"use client"

import type React from "react"
import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Lock, XCircle } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { Panel } from "@/components/organization/shared"
import { acceptInvite } from "@/lib/organization/invites"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Status = "checking" | "needs-password" | "error" | "done"

const TONE_STYLES = {
  gold: {
    ring: "border-gold/30 bg-gold/[0.07]",
    glow: "rgba(212, 175, 55, 0.08)",
    icon: "text-gold",
    eyebrow: "text-gold/80",
  },
  red: {
    ring: "border-red-500/30 bg-red-500/[0.07]",
    glow: "rgba(239, 68, 68, 0.08)",
    icon: "text-red-400/90",
    eyebrow: "text-red-400/70",
  },
  green: {
    ring: "border-green-500/30 bg-green-500/[0.07]",
    glow: "rgba(74, 222, 128, 0.08)",
    icon: "text-green-400/90",
    eyebrow: "text-green-400/70",
  },
} as const

/* ────────────────────────────────────────────────────────────────── */
/*  STATUS SCREEN — the one shared shell every state in this page       */
/*  renders through: an icon in a soft-glow ring badge, an uppercase     */
/*  eyebrow, a title, and a short description, with room for extra       */
/*  content (a form, a button) underneath. This is also what             */
/*  RoleGate's denied state uses, so a person bounced from either page   */
/*  sees the same visual language rather than two different "error       */
/*  screen" designs.                                                     */
/* ────────────────────────────────────────────────────────────────── */

function StatusScreen({
  tone,
  icon,
  eyebrow,
  title,
  description,
  children,
}: {
  tone: keyof typeof TONE_STYLES
  icon: React.ReactNode
  eyebrow: string
  title: string
  description?: string
  children?: React.ReactNode
}) {
  const t = TONE_STYLES[tone]
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="max-w-sm w-full animate-in fade-in duration-300">
        <Panel>
          <div className="flex flex-col items-center text-center py-2">
            <div
              className={`h-14 w-14 rounded-full border flex items-center justify-center mb-4 ${t.ring}`}
              style={{ boxShadow: `0 0 0 6px ${t.glow}` }}
            >
              <span className={t.icon}>{icon}</span>
            </div>

            <p className={`text-[10px] font-cinzel uppercase tracking-[0.2em] mb-1.5 ${t.eyebrow}`}>{eyebrow}</p>
            <h2 className="text-lg font-bold text-white font-cinzel mb-2">{title}</h2>
            {description && <p className="text-gray-500 text-sm leading-relaxed mb-1">{description}</p>}

            {children && <div className="w-full mt-4">{children}</div>}
          </div>
        </Panel>
      </div>
    </div>
  )
}

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const { user, loading } = useAuth()
  const [status, setStatus] = useState<Status>("checking")
  const [error, setError] = useState<string | null>(null)

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [settingPassword, setSettingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Effects run twice in React Strict Mode during development — without this
  // guard, the second run would find the invite already marked "accepted"
  // from the first run and surface that as an error, even though the user
  // successfully joined. This ensures acceptInvite only ever fires once per
  // mount regardless of how many times the effect body runs.
  const hasAttempted = useRef(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push(`/invite/${token}/login`)
      return
    }

    // Fresh invites (sent via Supabase's inviteUserByEmail) authenticate the
    // person automatically but leave them with no password — password_set
    // is written to user_metadata as false when the email is sent (see
    // app/api/invites/send/route.ts). Someone who came in through
    // /invite/[token]/login instead (an existing account) never has this
    // flag at all, so they skip straight past this and into acceptInvite.
    if (user.user_metadata?.password_set === false) {
      setStatus("needs-password")
      return
    }

    if (hasAttempted.current) return
    hasAttempted.current = true

    acceptInvite(token, user.id, user.email ?? "").then((result) => {
      if (!result.ok) {
        setError(result.error ?? "Couldn't accept this invite.")
        setStatus("error")
        return
      }
      setStatus("done")
      setTimeout(() => router.push("/organization"), 1200)
    })
  }, [loading, user, token, router])

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirmPassword) {
      setPasswordError("Passwords don't match.")
      return
    }

    setSettingPassword(true)
    const { error: updateErr } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
    })
    setSettingPassword(false)

    if (updateErr) {
      setPasswordError(updateErr.message)
      return
    }

    // supabase.auth.updateUser fires a USER_UPDATED event through
    // onAuthStateChange, which refreshes `user` in AuthContext with
    // password_set now true — that re-runs the effect above and it falls
    // through to acceptInvite on its own, no manual redirect needed here.
    setStatus("checking")
  }

  async function handleSignOutAndRetry() {
    await supabase.auth.signOut()
    router.push(`/invite/${token}/login`)
  }

  if (status === "needs-password") {
    return (
      <StatusScreen
        tone="gold"
        icon={<Lock className="h-6 w-6" />}
        eyebrow="Welcome"
        title="Set your password"
        description="Choose a password so you can sign back in after today."
      >
        <form onSubmit={handleSetPassword} className="space-y-3 text-left">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="bg-black/50 border-gold/30 text-white"
            required
          />
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            className="bg-black/50 border-gold/30 text-white"
            required
          />
          {passwordError && (
            <p className="flex items-center gap-1.5 text-red-500 text-xs">
              <AlertCircle className="h-3.5 w-3.5" /> {passwordError}
            </p>
          )}
          <Button
            type="submit"
            disabled={settingPassword}
            className="w-full bg-gold hover:bg-gold/90 text-black font-bold disabled:opacity-50"
          >
            {settingPassword ? "Saving…" : "Continue"}
          </Button>
        </form>
      </StatusScreen>
    )
  }

  if (status === "error") {
    const wrongEmail = error?.toLowerCase().includes("different email")
    return (
      <StatusScreen tone="red" icon={<XCircle className="h-6 w-6" />} eyebrow="Invite not accepted" title="Something's off" description={error ?? undefined}>
        <button
          onClick={wrongEmail ? handleSignOutAndRetry : () => router.push("/")}
          className="flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-gray-400 hover:text-gold transition-colors border border-white/10 hover:border-gold/30 rounded-md px-4 py-2 mx-auto"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {wrongEmail ? "Sign in with a different account" : "Back to home"}
        </button>
      </StatusScreen>
    )
  }

  if (status === "done") {
    return (
      <StatusScreen
        tone="green"
        icon={<CheckCircle2 className="h-6 w-6" />}
        eyebrow="Success"
        title="You're in"
        description="Taking you to the organization…"
      />
    )
  }

  return (
    <StatusScreen
      tone="gold"
      icon={<Loader2 className="h-6 w-6 animate-spin" />}
      eyebrow="One moment"
      title="Checking your invite"
    />
  )
}