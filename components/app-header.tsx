"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useState, useEffect } from "react"
import { ArrowLeft, LogOut, Loader2, Building2 } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { getOrgForUser, type OrgSummary } from "@/lib/organization/organization"

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
  const [organization, setOrganization] = useState<OrgSummary | null>(null)
  const [orgLoading, setOrgLoading] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  // Fetch the user's organization (logo, name, slug) via the shared helper.
  useEffect(() => {
    if (!user) {
      setOrganization(null)
      return
    }

    let cancelled = false
    setOrgLoading(true)

    getOrgForUser(user.id)
      .then((org) => {
        if (!cancelled) {
          setOrganization(org)
          setLogoFailed(false)
        }
      })
      .catch((err) => {
        console.error("Failed to fetch organization:", err)
        if (!cancelled) setOrganization(null)
      })
      .finally(() => {
        if (!cancelled) setOrgLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

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

  const goToOrganization = () => {
    router.push("/organization")
  }

  // Symmetrical Desktop clip path: 
  // Left side is 68px deep, angles up to 54px.
  // Center stays at 54px.
  // Right side angles back down to 68px to frame the user menu.
  const desktopClipPath =
    "polygon(0 0, 100% 0, 100% 68px, calc(100% - 320px) 68px, calc(100% - 360px) 54px, 360px 54px, 320px 68px, 0 68px)"

  return (
    <header className="fixed top-0 left-0 w-full z-50 transition-all duration-500">
      
      {/* Desktop Shaped Background with Crisp Symmetrical SVG Gold Outline */}
      <div className="hidden lg:block absolute inset-0 pointer-events-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)]">
        
        {/* All Black Background Layer */}
        <div
          className="w-full h-full bg-black"
          style={{ clipPath: desktopClipPath }}
        />
        
        {/* Left Side Border */}
        <div className="absolute left-0 top-0 w-1/2 h-full overflow-hidden pointer-events-none z-10">
          <svg 
            className="absolute left-0 top-0 w-[2000px] h-full" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              d="M 0 68 L 320 68 L 360 54 L 2000 54" 
              stroke="rgba(212, 175, 55, 0.6)" 
              strokeWidth="1.5" 
              fill="none" 
            />
          </svg>
        </div>

        {/* Right Side Border (Mirrored perfectly via CSS transform) */}
        <div 
          className="absolute right-0 top-0 w-1/2 h-full overflow-hidden pointer-events-none z-10"
          style={{ transform: "scaleX(-1)" }}
        >
          <svg 
            className="absolute left-0 top-0 w-[2000px] h-full" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              d="M 0 68 L 320 68 L 360 54 L 2000 54" 
              stroke="rgba(212, 175, 55, 0.6)" 
              strokeWidth="1.5" 
              fill="none" 
            />
          </svg>
        </div>

      </div>

      {/* Mobile Fallback Background */}
      <div className="lg:hidden absolute inset-0 bg-black shadow-[0_1px_0_0_rgba(212,175,55,0.4),0_8px_24px_-12px_rgba(0,0,0,0.9)]" />

      {/* Main Header Content */}
      <div className="relative z-10 container mx-auto px-4 h-[68px] flex items-start justify-between w-full max-w-[1600px]">
        
        {/* Left Side: Logo & Brand Name or Back Button (Thick Height Area: 68px) */}
        <div className="flex items-center gap-3 h-[68px] flex-shrink-0 z-20 pr-6">
          {showBackButton ? (
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex items-center gap-2 px-3 py-1.5 lg:py-2 rounded-lg border border-gold/30 text-gold hover:bg-gold/10 hover:border-gold/50 transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="hidden sm:inline text-sm font-semibold font-cinzel">BACK</span>
            </button>
          ) : (
            <Link
              href="/"
              className="flex items-center gap-3 h-[68px] cursor-pointer group min-w-0"
            >
              <div className="relative w-16 h-16 lg:w-16 lg:h-16 py-0 my-0 transition-transform duration-300 group-hover:scale-105">
                <Image
                  src="/valiant-league-logo.png"
                  alt="Valiant League Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <span className="font-cinzel font-bold text-xl lg:text-2xl text-white tracking-wide hidden sm:inline truncate">
                VALIANT{" "}
                <span className="text-gold transition-colors duration-300 group-hover:text-gold/80">
                  LEAGUE
                </span>
              </span>
            </Link>
          )}
        </div>

        {/* Center: Title (Shorter Height Section: 54px on Desktop, full 68px on Mobile) */}
        {title && (
          <div className="flex-1 flex items-center justify-center min-w-0 px-2 h-[68px] lg:h-[54px] z-10">
            <h1 className="font-cinzel text-lg sm:text-xl lg:text-lg font-bold text-center truncate">
              <span className="text-gold">{title}</span>
            </h1>
          </div>
        )}

        {/* Right Side: User Menu (Thick Height Area: 68px) */}
        <div className="flex items-center justify-end gap-3 h-[68px] z-20 flex-shrink-0">
          {loading ? (
            <div className="flex items-center gap-3 h-full">
              <div className="hidden sm:flex flex-col items-end gap-1.5 px-3 justify-center">
                <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
                <div className="h-2.5 w-32 rounded bg-white/5 animate-pulse" />
              </div>
              <div className="h-9 w-9 lg:w-10 lg:h-10 rounded-lg border border-gold/20 bg-white/5 animate-pulse" />
            </div>
          ) : (
            user && (
              <div className="flex items-center h-full gap-2 pl-2">
                
                {/* Organization: logo + name, links to /organization */}
                <button
                  type="button"
                  onClick={goToOrganization}
                  aria-label="Go to organization"
                  className="hidden sm:flex items-center gap-2.5 px-3 min-w-0 max-w-[220px] h-full group/org"
                >
                  <div className="relative w-14 h-14 lg:w-14 lg:h-14 shrink-0 rounded-full overflow-hidden bg-white/5 border border-gold/25 flex items-center justify-center group-hover/org:border-gold/60 transition-colors duration-300">
                    {orgLoading ? (
                      <div className="w-full h-full bg-white/10 animate-pulse" />
                    ) : organization?.logoUrl && !logoFailed ? (
                      <Image
                        src={organization.logoUrl}
                        alt={organization.name ? `${organization.name} logo` : "Organization logo"}
                        fill
                        sizes="36px"
                        className="object-contain p-0.5"
                        onError={() => setLogoFailed(true)}
                      />
                    ) : (
                      <Building2 className="w-4 h-4 text-gold/70" />
                    )}
                  </div>
                  <div className="flex flex-col items-end min-w-0 justify-center">
                    <p className="text-sm lg:text-[15px] text-white/95 font-semibold truncate w-full text-right tracking-wide group-hover/org:text-gold transition-colors duration-300">
                      {displayNameFor(user)}
                    </p>
                    {user.email && (
                      <p className="text-[10px] lg:text-xs text-gold/60 truncate w-full text-right font-medium">
                        {user.email.slice(0, 10)}
                        {user.email.length > 10 ? "…" : ""}
                      </p>
                    )}
                  </div>
                </button>

                {/* Upgraded Logout Button */}
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  aria-label="Log out"
                  title="Logout"
                  className="group relative flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 rounded-md bg-black/40 border border-gold/20 text-gold/90 hover:bg-red-950/40 hover:border-red-500/50 hover:text-red-400 hover:shadow-[0_0_12px_rgba(239,68,68,0.15)] overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Subtle hover gradient glow inside the button */}
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  
                  {loggingOut ? (
                    <Loader2 className="w-4 h-4 lg:w-[18px] lg:h-[18px] animate-spin relative z-10" />
                  ) : (
                    <LogOut className="w-4 h-4 lg:w-[18px] lg:h-[18px] transition-transform duration-300 group-hover:-translate-x-0.5 relative z-10" />
                  )}
                  
                  <span className="hidden sm:inline text-[11px] lg:text-[13px] font-cinzel font-bold tracking-wider relative z-10 pt-0.5">
                    {loggingOut ? "LOGGING OUT" : "LOGOUT"}
                  </span>
                </button>

              </div>
            )
          )}
        </div>
      </div>
    </header>
  )
}