"use client"

import Link from "next/link"
import { Menu, Shield, Twitter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Image from "next/image"

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

  // Desktop clip path: Reduced left side height to 68px, angled drop down to 54px on right
  const desktopClipPath =
    "polygon(0 0, 100% 0, 100% 54px, 340px 54px, 290px 68px, 0 68px)"

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
        {/* Left Side: Logo & Brand Name (Reduced Height Area: 68px) */}
        <div
          onClick={() => scrollToSection("home")}
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
          {[
            { id: "home", label: "Home" },
            { id: "tournaments", label: "All Tournaments" },
            { id: "matches", label: "All Matches" },
            { id: "players", label: "Players" },
            { id: "teams", label: "Teams" },
            { id: "standings", label: "Standings" },
            { id: "stats", label: "Stats" },
          ].map((item) => (
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
            <Link href="#" target="_blank" rel="noopener noreferrer">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full w-8 h-8 text-gold/80 hover:text-gold hover:bg-gold/10 transition-colors"
              >
                <Twitter className="h-4 w-4" />
              </Button>
            </Link>

            <div className="w-px h-5 bg-gold/20" />

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
          <div className="flex items-center justify-center gap-2 mb-5 text-gold/50">
            <div className="h-px w-10 bg-gold/25" />
            <Shield className="h-3.5 w-3.5" />
            <div className="h-px w-10 bg-gold/25" />
          </div>

          <nav className="flex flex-col space-y-2.5">
            {[
              { id: "home", label: "Home" },
              { id: "tournaments", label: "All Tournaments" },
              { id: "matches", label: "All Matches" },
              { id: "players", label: "Players" },
              { id: "teams", label: "Teams" },
              { id: "standings", label: "Standings" },
              { id: "stats", label: "Stats" },
            ].map((item) => (
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