"use client"

import Image from "next/image"
import Link from "next/link"
import { Menu, Shield, Twitter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { navLinks } from "@/data/site-data"

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
  return (
    <header className="fixed top-0 left-0 w-full z-50 transition-all duration-500 bg-black/90 backdrop-blur-sm border-b border-gold/20 py-2">
      <div className="w-full max-w-[1600px] mx-auto px-4">
        {/* Desktop Layout — grid for control */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center justify-items-center">
          {/* Logo */}
          <div
            onClick={() => scrollToSection("home")}
            className="flex items-center space-x-2 z-20 justify-self-start cursor-pointer"
          >
            <div className="relative w-14 h-16 md:w-16 md:h-20">
              <Image
                src="/valiant-league-logo.png"
                alt="Valiant League Logo"
                fill
                className="object-contain"
                priority
              />
            </div>

            <span className="font-cinzel font-bold text-xl md:text-2xl text-white">
              VALIANT <span className="text-gold">LEAGUE</span>
            </span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center justify-center flex-wrap gap-2">
            {navLinks.map((link) => (
              <Button
                key={link.name}
                variant={activeSection === link.id ? "default" : "outline"}
                size="sm"
                className={cn(
                  "font-cinzel text-sm xl:text-base transition-all",
                  activeSection === link.id
                    ? "bg-gold hover:bg-gold/90 text-black"
                    : "border-gold/50 text-white hover:bg-gold/10 hover:text-gold hover:border-gold"
                )}
                onClick={() => scrollToSection(link.id)}
              >
                {link.name}
              </Button>
            ))}
          </nav>

          {/* Right Side */}
          <div className="flex items-center justify-end space-x-4 justify-self-end">
            <div className="hidden md:flex items-center space-x-2">
              <Link href="#" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="text-gold hover:text-gold/80">
                  <Twitter className="h-5 w-5" />
                </Button>
              </Link>

              <Button
                className="bg-gold hover:bg-gold/90 text-black font-bold font-cinzel"
                onClick={() => handleNavigation("/admin")}
              >
                Open the Console
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-white hover:text-gold z-20"
              onClick={() => setIsNavOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {isNavOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div
        className={`md:hidden bg-black/95 border-t border-gold/20 fixed top-[68px] left-0 w-full z-10 transition-all duration-300 ${
          isNavOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <div className="container mx-auto px-4 py-6">
          <nav className="flex flex-col space-y-4">
            {navLinks.map((link) => (
              <Button
                key={link.name}
                variant={activeSection === link.id ? "default" : "outline"}
                className={cn(
                  "font-cinzel text-base w-full justify-start transition-all",
                  activeSection === link.id
                    ? "bg-gold hover:bg-gold/90 text-black"
                    : "border-gold/50 text-white hover:bg-gold/10 hover:text-gold hover:border-gold"
                )}
                onClick={() => scrollToSection(link.id)}
              >
                {link.name}
              </Button>
            ))}

            <Button
              className="bg-gold hover:bg-gold/90 text-black font-bold font-cinzel w-full justify-start mt-2"
              onClick={() => {
                handleNavigation("/admin")
                setIsNavOpen(false)
              }}
            >
              Open the Console
            </Button>

            <div className="pt-4 border-t border-gold/20 flex justify-center">
              <Link href="#" target="_blank" rel="noopener noreferrer" onClick={() => setIsNavOpen(false)}>
                <Button variant="ghost" size="icon" className="text-gold hover:text-gold/80">
                  <Twitter className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}