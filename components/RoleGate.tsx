// components/RoleGate.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldAlert } from "lucide-react"
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
      setGate(allowed ? "allowed" : "denied")
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user])

  if (gate === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    )
  }

  if (gate === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm w-full">
          <Panel>
            <h2 className="text-lg font-bold text-white font-cinzel mb-2 flex items-center justify-center gap-2">
              <ShieldAlert className="h-4 w-4 text-gold" /> Access Restricted
            </h2>
            <p className="text-gray-500 text-sm text-center">
              You don't have permission to view this page. Ask your organization admin to invite you with the right
              role.
            </p>
          </Panel>
        </div>
      </div>
    )
  }

  return <>{children}</>
}