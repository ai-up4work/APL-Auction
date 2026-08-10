"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Mail, Shield, Twitter } from "lucide-react"

interface SiteFooterProps {
  scrollToSection: (sectionId: string) => void
  handleNavigation: (path: string) => void
}

export function SiteFooter({ scrollToSection, handleNavigation }: SiteFooterProps) {
  return (
    <footer className="bg-black border-t border-gold/20 ">
      <div className="container mx-auto px-0 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Brand */}
          <div className="space-y-5 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start space-x-3">
              <div className="relative w-16 h-16 lg:w-18 lg:h-18">
                <Image src="/valiant-league-logo.png" alt="Valiant League Logo" fill className="object-contain" />
              </div>
              <span className="font-cinzel font-bold text-xl lg:text-2xl text-white tracking-wide">
                VALIANT <span className="text-gold">LEAGUE</span>
              </span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto lg:mx-0">
              Valiant League is the all-in-one platform for running a league — live auctions, automatic brackets,
              and broadcast-ready overlays, all reading from the same live data.
            </p>

            {/* Compact-view-only social row: icons, no heading, centered */}
            <div className="flex lg:hidden items-center justify-center gap-4 pt-1">
              <Link
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                className="w-10 h-10 rounded-full border border-gold/25 flex items-center justify-center text-gray-400 hover:text-gold hover:border-gold/60 transition-colors"
              >
                <Twitter className="h-4 w-4" />
              </Link>
              <Link
                href="mailto:hello@valiantleague.app"
                aria-label="Email"
                className="w-10 h-10 rounded-full border border-gold/25 flex items-center justify-center text-gray-400 hover:text-gold hover:border-gold/60 transition-colors"
              >
                <Mail className="h-4 w-4" />
              </Link>
              <button
                onClick={() => handleNavigation("/auth/register")}
                aria-label="Start your league"
                className="w-10 h-10 rounded-full border border-gold/25 flex items-center justify-center text-gray-400 hover:text-gold hover:border-gold/60 transition-colors"
              >
                <Shield className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Navigation — hidden below lg (Hardcoded navigation items matching Header) */}
          <div className="hidden lg:block">
            <h3 className="font-cinzel font-bold text-xl text-white mb-6">NAVIGATION</h3>
            <ul className="space-y-4">
              {[
                { id: "tournaments", label: "All Tournaments" },
                { id: "matches", label: "All Matches" },
                { id: "standings", label: "Standings" },
                { id: "stats", label: "Stats" },
              ].map((item) => (
                <li key={item.id}>
                  <div
                    onClick={() => scrollToSection(item.id)}
                    className="text-gray-400 hover:text-gold transition-colors flex items-center cursor-pointer group"
                  >
                    <ArrowRight className="h-4 w-4 mr-2 text-gold transition-transform group-hover:translate-x-0.5" />
                    {item.label}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Social + Console — full version, hidden below lg */}
          <div className="hidden lg:block">
            <h3 className="font-cinzel font-bold text-xl text-white mb-6">SOCIAL LINKS</h3>
            <ul className="space-y-4">
              <li>
                <Link
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gold transition-colors flex items-center"
                >
                  <Twitter className="h-4 w-4 mr-2 text-gold" />
                  Twitter
                </Link>
              </li>
              <li>
                <Link
                  href="mailto:hello@valiantleague.app"
                  className="text-gray-400 hover:text-gold transition-colors flex items-center"
                >
                  <Mail className="h-4 w-4 mr-2 text-gold" />
                  Email
                </Link>
              </li>
              <li>
                <div
                  onClick={() => handleNavigation("/auth/register")}
                  className="text-gray-400 hover:text-gold transition-colors flex items-center cursor-pointer"
                >
                  <Shield className="h-4 w-4 mr-2 text-gold" />
                  Start Your League
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-2 lg:mt-8 pt-6 lg:pt-8 border-t border-gold/20">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4 lg:gap-0">
            <p className="text-gray-500 text-xs lg:text-sm">
              © {new Date().getFullYear()} Valiant League. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <div
                onClick={() => handleNavigation("/privacy-policy")}
                className="text-gray-400 text-xs lg:text-sm hover:text-gold transition-colors cursor-pointer"
              >
                Privacy Policy
              </div>
              <div
                onClick={() => handleNavigation("/terms-of-service")}
                className="text-gray-400 text-xs lg:text-sm hover:text-gold transition-colors cursor-pointer"
              >
                Terms of Service
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}