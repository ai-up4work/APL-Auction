// components/RoleGate.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldAlert, ArrowLeft } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { getMembershipRole, type MemberRole } from "@/lib/organization/invites"
import { Panel } from "@/components/organization/shared"

type GateState = "checking" | "denied" | "allowed"

interface RoleGateProps {
  /** Resolves the org_id for whatever entity this page is scoped to
   *  (auction id, match id, etc) — pass a function so the lookup only
   *  runs once we actually have the id, and so this component stays
   *  agnostic to which kind of id it's given. */
  resolveOrgId: () => Promise<string | null>
  /** Roles allowed to view this page. 'admin' is implicitly always
   *  allowed — an org admin can always reach every role's page. */
  allowedRoles: MemberRole[]
  children: React.ReactNode
}

export function RoleGate({ resolveOrgId, allowedRoles, children }: RoleGateProps) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [gate, setGate] = useState<GateState>("checking")
  const [deniedRole, setDeniedRole] = useState<MemberRole | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace("/auth/login")
      return
    }
    let cancelled = false
    ;(async () => {
      const orgId = await resolveOrgId()
      if (!orgId) {
        if (!cancelled) setGate("denied")
        return
      }
      const role = await getMembershipRole(orgId, user.id)
      if (cancelled) return
      const allowed = role === "admin" || role === "owner" || (role && allowedRoles.includes(role))
      if (allowed) {
        setGate("allowed")
      } else {
        setDeniedRole(role ?? null)
        setGate("denied")
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user])

  if (gate === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-11 w-11 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-gold/20" />
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </div>
          <p className="text-gray-600 text-xs font-cinzel uppercase tracking-[0.2em]">Checking access</p>
        </div>
      </div>
    )
  }

  if (gate === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 bg-black">
        <div className="max-w-sm w-full animate-in fade-in duration-300">
          <Panel>
            <div className="flex flex-col items-center text-center py-2">
              <div
                className="h-14 w-14 rounded-full border border-red-500/30 bg-red-500/[0.07] flex items-center justify-center mb-4"
                style={{ boxShadow: "0 0 0 6px rgba(239, 68, 68, 0.04)" }}
              >
                <ShieldAlert className="h-6 w-6 text-red-400/90" />
              </div>

              <p className="text-red-400/70 text-[10px] font-cinzel uppercase tracking-[0.2em] mb-1.5">
                Access restricted
              </p>
              <h2 className="text-lg font-bold text-white font-cinzel mb-2">This page isn't part of your role</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-1">
                Ask an organization admin to add the right role to your invite.
              </p>
              {deniedRole && (
                <p className="text-gray-600 text-xs mb-5">
                  Signed in as <span className="text-gray-400 font-medium">{deniedRole}</span>
                </p>
              )}

              <button
                onClick={() => router.push("/")}
                className="mt-4 flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-wide text-gray-400 hover:text-gold transition-colors border border-white/10 hover:border-gold/30 rounded-md px-4 py-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to dashboard
              </button>
            </div>
          </Panel>
        </div>
      </div>
    )
  }

  return <>{children}</>
}