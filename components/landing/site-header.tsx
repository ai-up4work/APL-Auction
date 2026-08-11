"use client"

import Link from "next/link"
import { Menu, X, LogOut, Loader2, Building2, Twitter } from "lucide-react"
import { FaWhatsapp } from "react-icons/fa"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { getOrgForUser, type OrgSummary } from "@/lib/organization/organization"

interface SiteHeaderProps {
  activeSection: string
  isNavOpen: boolean
  setIsNavOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  scrollToSection: (sectionId: string) => void
  handleNavigation: (path: string) => void
}

/** Best-effort display name helper */
function displayNameFor(user: { email?: string | null; user_metadata?: Record<string, any> } | null): string {
  if (!user) return ""
  const metaName = user.user_metadata?.full_name || user.user_metadata?.name
  if (typeof metaName === "string" && metaName.trim()) return metaName
  if (user.email) return user.email.split("@")[0]
  return "Account"
}

export function SiteHeader({
  activeSection,
  isNavOpen,
  setIsNavOpen,
  scrollToSection,
  handleNavigation,
}: SiteHeaderProps) {
  const { user, loading, signOut } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [organization, setOrganization] = useState<OrgSummary | null>(null)
  const [orgLoading, setOrgLoading] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  // Fetch the user's organization (logo, name, slug) via the shared helper.
  // Keyed on user?.id (a stable primitive) rather than the user object
  // itself — Supabase's onAuthStateChange fires on tab focus/visibility
  // and hands back a new session (and therefore a new user object
  // reference) even when it's the same logged-in user. Depending on the
  // object would re-run this effect — and re-render/reload the logo
  // image — every time the tab regains focus.
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

  const handleMobileNav = (id: string) => {
    scrollToSection(id)
    setIsNavOpen(false)
  }

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await signOut()
      setLoggingOut(false)
      setIsNavOpen(false)
    } catch (err) {
      console.error("Logout failed:", err)
      setLoggingOut(false)
    }
  }

  // Navigate to the landing page (root route)
  const goToLandingPage = () => {
    handleNavigation("/")
  }

  // Navigate to the organization route
  const goToOrganization = () => {
    handleNavigation("/organization")
  }

  // Desktop clip path: Reduced left side height to 68px, angled drop down to 54px on right
  const desktopClipPath =
    "polygon(0 0, 100% 0, 100% 54px, 340px 54px, 290px 68px, 0 68px)"

  // "Home" removed — clicking the logo / SaaS name now serves that purpose
  const navItems = [
    { id: "tournaments", label: "All Tournaments" },
    { id: "matches", label: "All Matches" },
    { id: "players", label: "Players" },
    { id: "teams", label: "Teams" },
    { id: "standings", label: "Standings" },
    { id: "stats", label: "Stats" },
  ]

  return (
    <header className="fixed top-0 left-0 w-full z-50 transition-all duration-500">
      
      {/* Desktop Shaped Background with Crisp SVG Gold Outline */}
      <div className="hidden lg:block absolute inset-0 pointer-events-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)]">
        
        {/* All Black Background Layer */}
        <div
          className="w-full h-full bg-black"
          style={{ clipPath: desktopClipPath }}
        />
        
        {/* Exact SVG Bottom Outline matching the updated clip-path coordinates */}
        <svg 
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-10" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            // Traces along the bottom edge: (0,68) -> (290,68) -> (340,54) -> (End of screen,54)
            d="M 0 68 L 290 68 L 340 54 L 9999 54" 
            stroke="rgba(212, 175, 55, 0.6)" 
            strokeWidth="1.5" 
            fill="none" 
          />
        </svg>

      </div>

      {/* Mobile Fallback Background */}
      <div className="lg:hidden absolute inset-0 bg-black shadow-[0_1px_0_0_rgba(212,175,55,0.4),0_8px_24px_-12px_rgba(0,0,0,0.9)]" />

      {/* Main Header Content */}
      <div className="relative z-10 container mx-auto px-4 h-[68px] flex items-start justify-between w-full max-w-[1600px]">
        {/* Left Side: Logo & Brand Name (Reduced Height Area: 68px) — clicking leads to the landing page */}
        <div
          onClick={goToLandingPage}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") goToLandingPage()
          }}
          className="flex items-center gap-3 h-[68px] cursor-pointer group pr-6 z-20"
        >
          <div className="relative w-14 h-14 lg:w-16 lg:h-16 py-0 my-0 transition-transform duration-300 group-hover:scale-105">
            <Image
              src="/valiant-league-logo.png"
              alt="Valiant League Logo"
              fill
              className="object-contain"
              priority
            />
          </div>

          <span className="font-cinzel font-bold text-xl lg:text-2xl text-white tracking-wide">
            VALIANT{" "}
            <span className="text-gold transition-colors duration-300 group-hover:text-gold/80">
              LEAGUE
            </span>
          </span>
        </div>

        {/* Navigation Bar (Shorter Height Section: 54px) */}
        <nav className="hidden lg:flex items-center justify-center gap-1 xl:gap-2 h-[54px]">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              className={cn(
                "font-cinzel text-xs xl:text-sm rounded-full px-3.5 h-8 transition-all duration-300",
                activeSection === item.id
                  ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/5"
              )}
              onClick={() => scrollToSection(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </nav>

        {/* Right Side Controls (Shorter Height Section: 54px) */}
        <div className="flex items-center justify-end gap-3 h-[68px] lg:h-[54px]">
          <div className="hidden lg:flex items-center gap-3">


            <div className="w-px h-5 bg-gold/20" />

            {/* --- AUTHENTICATION STATE --- */}
            {loading ? (
              // Loading Skeleton
              <div className="flex items-center gap-2">
                <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                <div className="h-8 w-24 bg-white/10 rounded animate-pulse" />
              </div>
            ) : user ? (
              // Logged In: Organization Logo + Name (links to /organization) & Premium Logout
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={goToOrganization}
                  className="flex items-center gap-2 group/org"
                  aria-label="Go to organization"
                >
                  <div className="relative w-7 h-7 xl:w-8 xl:h-8 shrink-0 rounded-full overflow-hidden bg-white/5 border border-gold/25 flex items-center justify-center group-hover/org:border-gold/60 transition-colors duration-300">
                    {orgLoading ? (
                      <div className="w-full h-full bg-white/10 animate-pulse" />
                    ) : organization?.logoUrl && !logoFailed ? (
                      <Image
                        src={organization.logoUrl}
                        alt={organization.name ? `${organization.name} logo` : "Organization logo"}
                        fill
                        sizes="32px"
                        className="object-contain p-0.5"
                        onError={() => setLogoFailed(true)}
                      />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-gold/70" />
                    )}
                  </div>
                  <div className="flex flex-col items-end justify-center min-w-0 max-w-[100px] xl:max-w-[130px] text-right">
                    <p className="text-xs xl:text-[13px] text-white/95 font-semibold truncate w-full text-right tracking-wide group-hover/org:text-gold transition-colors duration-300">
                      {displayNameFor(user)}
                    </p>
                  </div>
                </button>
                <Link href="https://wa.me/+94755354830" target="_blank" rel="noopener noreferrer">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full w-10 h-10 text-gold/80 hover:text-gold hover:bg-gold/10 transition-colors"
                  >
                    <FaWhatsapp className="h-8 w-8" />
                  </Button>
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  aria-label="Log out"
                  className="group relative flex items-center gap-2 px-3 xl:px-4 py-1.5 rounded-md bg-black/40 border border-gold/20 text-gold/90 hover:bg-red-950/40 hover:border-red-500/50 hover:text-red-400 hover:shadow-[0_0_12px_rgba(239,68,68,0.15)] overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  {loggingOut ? (
                    <Loader2 className="w-3.5 h-3.5 xl:w-4 xl:h-4 animate-spin relative z-10" />
                  ) : (
                    <LogOut className="w-3.5 h-3.5 xl:w-4 xl:h-4 transition-transform duration-300 group-hover:-translate-x-0.5 relative z-10" />
                  )}
                  <span className="text-[11px] xl:text-[12px] font-cinzel font-bold tracking-wider relative z-10 pt-0.5">
                    {loggingOut ? "LOGGING OUT" : "LOGOUT"}
                  </span>
                </button>
              </div>
            ) : (
              // Logged Out: Login/Register Buttons
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="font-cinzel text-xs xl:text-sm h-8 font-semibold text-white/90 hover:text-gold hover:bg-white/5"
                  onClick={() => handleNavigation("/auth/login")}
                >
                  Login
                </Button>

                <Button
                  size="sm"
                  className="h-8 bg-gold hover:bg-gold/90 text-black text-xs xl:text-sm font-bold font-cinzel shadow-[0_0_0_1px_rgba(212,175,55,0.3),0_4px_14px_-4px_rgba(212,175,55,0.5)] transition-shadow"
                  onClick={() => handleNavigation("/auth/register")}
                >
                  Register
                </Button>
              </>
            )}
          </div>

          {/* Mobile Toggle Button */}
          <button
            type="button"
            className="lg:hidden text-white hover:text-gold z-20 relative transition-colors"
            onClick={() => setIsNavOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={isNavOpen}
          >
            {isNavOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown Menu */}
      <div
        className={`lg:hidden absolute top-full left-0 w-full bg-black/95 backdrop-blur-md border-t border-gold/20 shadow-[0_16px_32px_-16px_rgba(0,0,0,0.9)] transition-all duration-300 ${
          isNavOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <div className="container mx-auto px-4 py-6">
          <nav className="flex flex-col space-y-2.5">
            {navItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                className={cn(
                  "font-cinzel text-base w-full justify-start rounded-lg transition-all duration-300",
                  activeSection === item.id
                    ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                    : "text-gray-300 hover:text-gold hover:bg-white/5"
                )}
                onClick={() => handleMobileNav(item.id)}
              >
                {item.label}
              </Button>
            ))}

            <div className="pt-3 mt-1 border-t border-gold/15 flex flex-col gap-2.5">
              {/* MOBILE AUTHENTICATION STATE */}
              {loading ? (
                <div className="h-20 w-full bg-white/5 rounded-lg animate-pulse" />
              ) : user ? (
                <div className="flex flex-col gap-2 p-3 bg-white/5 border border-gold/10 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      goToOrganization()
                      setIsNavOpen(false)
                    }}
                    className="flex items-center gap-3 text-left"
                    aria-label="Go to organization"
                  >
                    <div className="relative w-9 h-9 shrink-0 rounded-full overflow-hidden bg-white/5 border border-gold/25 flex items-center justify-center">
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
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white/90 hover:text-gold transition-colors duration-300">
                        {displayNameFor(user)}
                      </span>
                      {user.email && <span className="text-[11px] text-gold/60">{user.email}</span>}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="mt-2 w-full font-cinzel font-bold text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-900/30 transition-all justify-center h-9"
                  >
                    {loggingOut ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
                    {loggingOut ? "LOGGING OUT" : "LOGOUT"}
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    className="font-cinzel font-semibold w-full justify-start text-white/90 hover:text-gold hover:bg-white/5"
                    onClick={() => {
                      handleNavigation("/auth/login")
                      setIsNavOpen(false)
                    }}
                  >
                    Login
                  </Button>

                  <Button
                    className="bg-gold hover:bg-gold/90 text-black font-bold font-cinzel w-full justify-start shadow-[0_0_0_1px_rgba(212,175,55,0.3)]"
                    onClick={() => {
                      handleNavigation("/auth/register")
                      setIsNavOpen(false)
                    }}
                  >
                    Register
                  </Button>
                </>
              )}
            </div>

            <div className="pt-4 flex justify-center">
              <Link
                href="https://wa.me/+94755354830"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsNavOpen(false)}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full w-10 h-10 border border-gold/25 text-gold/80 hover:text-gold hover:border-gold/60 transition-colors"
                >
                  <FaWhatsapp className="h-6 w-6" />
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}