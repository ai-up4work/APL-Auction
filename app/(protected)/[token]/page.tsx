// app/(public)/invite/[token]/page.tsx
"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { Panel } from "@/components/organization/shared"
import { acceptInvite } from "@/lib/organization/invites"

type Status = "checking" | "error" | "done"

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const { user, loading } = useAuth()
  const [status, setStatus] = useState<Status>("checking")
  const [error, setError] = useState<string | null>(null)

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

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="max-w-sm w-full">
          <Panel>
            <h2 className="text-lg font-bold text-white font-cinzel mb-2 flex items-center justify-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" /> Invite Not Accepted
            </h2>
            <p className="text-gray-500 text-sm text-center">{error}</p>
          </Panel>
        </div>
      </div>
    )
  }

  if (status === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="max-w-sm w-full">
          <Panel>
            <h2 className="text-lg font-bold text-white font-cinzel mb-2 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400" /> You're In
            </h2>
            <p className="text-gray-500 text-sm text-center">Taking you to the organization…</p>
          </Panel>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <Loader2 className="h-6 w-6 animate-spin text-gold" />
    </div>
  )
}