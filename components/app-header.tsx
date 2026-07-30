"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useState } from "react"
import { ArrowLeft, LogOut, Loader2 } from "lucide-react"
import { useAuth } from "@/context/AuthContext"

interface AppHeaderProps {
  title?: string
  showBackButton?: boolean
}

/** Best-effort display name: prefer whatever was set at signup, fall back
 *  to the local part of the email, and finally to a generic label so the
 *  header never renders "undefined". */
function displayNameFor(user: { email?: string | null; user_metadata?: Record<string, any> } | null): string {
  if (!user) return ""
  const metaName = user.user_metadata?.full_name || user.user_metadata?.name
  if (typeof metaName === "string" && metaName.trim()) return metaName
  if (user.email) return user.email.split("@")[0]
  return "Account"
}

export function AppHeader({ title, showBackButton = false }: AppHeaderProps) {
  const router = useRouter()
  const { user, loading, signOut } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (loggingOut) return // guard against double-click firing signOut twice
    setLoggingOut(true)
    try {
      await signOut()
      router.push("/auth/login")
    } catch (err) {
      console.error("Logout failed:", err)
      setLoggingOut(false) // let them retry instead of getting stuck
    }
  }

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-gradient-to-b from-black via-black/95 to-black/80 backdrop-blur-md shadow-lg shadow-gold/5">
      <div className="h-px w-full bg-gradient-to-r from-gold/40 via-gold/20 to-transparent" />

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Left: Logo / Back */}
          <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
            {showBackButton ? (
              <button
                onClick={() => router.back()}
                aria-label="Go back"
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gold/30 text-gold hover:bg-gold/10 hover:border-gold/50 transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-semibold">Back</span>
              </button>
            ) : (
              <Link
                href="/organization"
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 group min-w-0"
              >
                <div className="relative w-16 h-16 flex-shrink-0">
                  <Image
                    src="/valiant-league-logo.png"
                    alt="Valiant League Logo"
                    fill
                    className="object-contain group-hover:drop-shadow-[0_0_8px_rgba(201,151,31,0.3)] transition-all"
                    priority
                  />
                </div>
                <span className="font-cinzel font-bold text-sm sm:text-base text-white hidden sm:inline truncate group-hover:text-gold/90 transition-colors">
                  VALIANT <span className="text-gold">LEAGUE</span>
                </span>
              </Link>
            )}
          </div>

          {/* Center: Title */}
          {title && (
            <div className="flex-1 flex justify-center min-w-0 px-2">
              <h1 className="font-cinzel text-lg sm:text-xl font-bold text-center truncate">
                <span className="text-gold">{title}</span>
              </h1>
            </div>
          )}

          {/* Right: User Menu */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end gap-1.5 px-3">
                  <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
                  <div className="h-2.5 w-32 rounded bg-white/5 animate-pulse" />
                </div>
                <div className="h-9 w-9 sm:w-24 rounded-lg border border-gold/20 bg-white/5 animate-pulse" />
              </div>
            ) : (
              user && (
                <>
                  <div className="hidden sm:flex flex-col items-end px-3 min-w-0 max-w-[180px]">
                    <p className="text-xs sm:text-sm text-white font-semibold truncate w-full text-right">
                      {displayNameFor(user)}
                    </p>
                    {user.email && (
                      <p className="text-xs text-gold/60 truncate w-full text-right">{user.email}</p>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    aria-label="Log out"
                    title="Logout"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gold/30 text-gold hover:bg-red-500/10 hover:border-red-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loggingOut ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogOut className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline text-sm font-semibold">
                      {loggingOut ? "Logging out…" : "Logout"}
                    </span>
                  </button>
                </>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  )
}