"use client"

import Link from "next/link"
import { Menu, Shield, Twitter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SiteHeaderProps {
  activeSection: string
  isNavOpen: boolean
  setIsNavOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  scrollToSection: (sectionId: string) => void
  handleNavigation: (path: string) => void
}

export function SiteHeader({
  activeSection,
  isNavOpen,
  setIsNavOpen,
  scrollToSection,
  handleNavigation,
}: SiteHeaderProps) {
  const handleMobileNav = (id: string) => {
    scrollToSection(id)
    setIsNavOpen(false)
  }

  return (
    <header
      className={cn(
        "fixed top-0 left-0 w-full z-50 transition-all duration-500",
        "bg-black/85 backdrop-blur-md",
        "border-b border-transparent",
        "shadow-[0_1px_0_0_rgba(212,175,55,0.25),0_8px_24px_-12px_rgba(0,0,0,0.8)]"
      )}
    >
      <div className="w-full max-w-[1600px] mx-auto px-4">
        <div className="grid grid-cols-[auto_1fr_auto] items-center h-16 lg:h-[72px]">

          {/* Logo */}
          <div
            onClick={() => scrollToSection("home")}
            className="flex items-center gap-2.5 z-20 justify-self-start cursor-pointer group"
          >
            <span className="font-cinzel font-bold text-xl lg:text-2xl text-white tracking-wide">
              VALIANT{" "}
              <span className="text-gold transition-colors duration-300 group-hover:text-gold/80">
                LEAGUE
              </span>
            </span>
          </div>

          {/* Navigation */}
          <nav className="hidden lg:flex items-center justify-center flex-wrap gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "font-cinzel text-sm xl:text-base rounded-full px-4 transition-all duration-300",
                activeSection === "home"
                  ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/5"
              )}
              onClick={() => scrollToSection("home")}
            >
              Home
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "font-cinzel text-sm xl:text-base rounded-full px-4 transition-all duration-300",
                activeSection === "tournaments"
                  ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/5"
              )}
              onClick={() => scrollToSection("tournaments")}
            >
              All Tournaments
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "font-cinzel text-sm xl:text-base rounded-full px-4 transition-all duration-300",
                activeSection === "matches"
                  ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/5"
              )}
              onClick={() => scrollToSection("matches")}
            >
              All Matches
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "font-cinzel text-sm xl:text-base rounded-full px-4 transition-all duration-300",
                activeSection === "players"
                  ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/5"
              )}
              onClick={() => scrollToSection("players")}
            >
              Players
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "font-cinzel text-sm xl:text-base rounded-full px-4 transition-all duration-300",
                activeSection === "teams"
                  ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/5"
              )}
              onClick={() => scrollToSection("teams")}
            >
              Teams
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "font-cinzel text-sm xl:text-base rounded-full px-4 transition-all duration-300",
                activeSection === "standings"
                  ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/5"
              )}
              onClick={() => scrollToSection("standings")}
            >
              Standings
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "font-cinzel text-sm xl:text-base rounded-full px-4 transition-all duration-300",
                activeSection === "stats"
                  ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/5"
              )}
              onClick={() => scrollToSection("stats")}
            >
              Stats
            </Button>
          </nav>

          {/* Right Side */}
          <div className="flex items-center justify-end gap-3 justify-self-end">
            <div className="hidden lg:flex items-center gap-3">
              <Link href="#" target="_blank" rel="noopener noreferrer">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-gold/80 hover:text-gold hover:bg-gold/10 transition-colors"
                >
                  <Twitter className="h-4.5 w-4.5" />
                </Button>
              </Link>

              <div className="w-px h-6 bg-gold/20" />

              <Button
                variant="ghost"
                className="font-cinzel font-semibold text-white/90 hover:text-gold hover:bg-white/5"
                onClick={() => handleNavigation("/auth/login")}
              >
                Login
              </Button>

              <Button
                className="bg-gold hover:bg-gold/90 text-black font-bold font-cinzel shadow-[0_0_0_1px_rgba(212,175,55,0.3),0_4px_14px_-4px_rgba(212,175,55,0.5)] hover:shadow-[0_0_0_1px_rgba(212,175,55,0.5),0_6px_18px_-4px_rgba(212,175,55,0.65)] transition-shadow"
                onClick={() => handleNavigation("/auth/register")}
              >
                Register
              </Button>
            </div>

            {/* Mobile Menu Button */}
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
      </div>

      {/* Mobile Navigation */}
      <div
        className={`lg:hidden absolute top-full left-0 w-full bg-black/95 backdrop-blur-md border-t border-gold/20 shadow-[0_16px_32px_-16px_rgba(0,0,0,0.9)] transition-all duration-300 ${
          isNavOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <div className="container mx-auto px-4 py-6">
          {/* Crest divider */}
          <div className="flex items-center justify-center gap-2 mb-5 text-gold/50">
            <div className="h-px w-10 bg-gold/25" />
            <Shield className="h-3.5 w-3.5" />
            <div className="h-px w-10 bg-gold/25" />
          </div>

          <nav className="flex flex-col space-y-2.5">
            <Button
              variant="ghost"
              className={cn(
                "font-cinzel text-base w-full justify-start rounded-lg transition-all duration-300",
                activeSection === "home"
                  ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/5"
              )}
              onClick={() => handleMobileNav("home")}
            >
              Home
            </Button>

            <Button
              variant="ghost"
              className={cn(
                "font-cinzel text-base w-full justify-start rounded-lg transition-all duration-300",
                activeSection === "tournaments"
                  ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/5"
              )}
              onClick={() => handleMobileNav("tournaments")}
            >
              All Tournaments
            </Button>

            <Button
              variant="ghost"
              className={cn(
                "font-cinzel text-base w-full justify-start rounded-lg transition-all duration-300",
                activeSection === "matches"
                  ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/5"
              )}
              onClick={() => handleMobileNav("matches")}
            >
              All Matches
            </Button>

            <Button
              variant="ghost"
              className={cn(
                "font-cinzel text-base w-full justify-start rounded-lg transition-all duration-300",
                activeSection === "players"
                  ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/5"
              )}
              onClick={() => handleMobileNav("players")}
            >
              Players
            </Button>

            <Button
              variant="ghost"
              className={cn(
                "font-cinzel text-base w-full justify-start rounded-lg transition-all duration-300",
                activeSection === "teams"
                  ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/5"
              )}
              onClick={() => handleMobileNav("teams")}
            >
              Teams
            </Button>

            <Button
              variant="ghost"
              className={cn(
                "font-cinzel text-base w-full justify-start rounded-lg transition-all duration-300",
                activeSection === "standings"
                  ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/5"
              )}
              onClick={() => handleMobileNav("standings")}
            >
              Standings
            </Button>

            <Button
              variant="ghost"
              className={cn(
                "font-cinzel text-base w-full justify-start rounded-lg transition-all duration-300",
                activeSection === "stats"
                  ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]"
                  : "text-gray-300 hover:text-gold hover:bg-white/5"
              )}
              onClick={() => handleMobileNav("stats")}
            >
              Stats
            </Button>

            <div className="pt-3 mt-1 border-t border-gold/15 flex flex-col gap-2.5">
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
            </div>

            <div className="pt-4 flex justify-center">
              <Link
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsNavOpen(false)}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full w-10 h-10 border border-gold/25 text-gold/80 hover:text-gold hover:border-gold/60 transition-colors"
                >
                  <Twitter className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}