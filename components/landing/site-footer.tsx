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
    <footer className="relative bg-black overflow-hidden pt-2 border-t border-gold/60">
      {/* Decorative Top Border Gradient */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent opacity-80" />
      
      {/* Subtle Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-gold/[0.03] rounded-full blur-[100px] pointer-events-none" />

      {/* Increased max-width here by adding w-full max-w-[1400px] to match your header */}
      <div className="relative z-10 container mx-auto px-6 py-12 lg:py-16 w-full max-w-[1400px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8">
          
          {/* Brand Section (Takes up more space on desktop) */}
          <div className="lg:col-span-5 space-y-6 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start space-x-3 group cursor-pointer" onClick={() => scrollToSection("home")}>
              <div className="relative w-16 h-16 lg:w-18 lg:h-18 transition-transform duration-500 group-hover:scale-105">
                <Image src="/valiant-league-logo.png" alt="Valiant League Logo" fill className="object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.2)]" />
              </div>
              <span className="font-cinzel font-bold text-2xl lg:text-3xl text-white tracking-widest">
                VALIANT <span className="text-gold transition-colors duration-300 group-hover:text-gold/80">LEAGUE</span>
              </span>
            </div>
            
            <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto lg:mx-0 font-light">
              Valiant League is the all-in-one platform for running a league — live auctions, automatic brackets,
              and broadcast-ready overlays, all reading from the same live data.
            </p>

            {/* Compact-view-only social row: icons, no heading, centered */}
            <div className="flex lg:hidden items-center justify-center gap-5 pt-2">
              <Link
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                className="w-11 h-11 rounded-full bg-white/5 border border-gold/20 flex items-center justify-center text-gray-400 hover:text-gold hover:border-gold hover:bg-gold/10 transition-all duration-300 shadow-[0_0_0_0_rgba(212,175,55,0)] hover:shadow-[0_0_15px_0_rgba(212,175,55,0.2)]"
              >
                <Twitter className="h-4 w-4" />
              </Link>
              <Link
                href="mailto:hello@valiantleague.app"
                aria-label="Email"
                className="w-11 h-11 rounded-full bg-white/5 border border-gold/20 flex items-center justify-center text-gray-400 hover:text-gold hover:border-gold hover:bg-gold/10 transition-all duration-300 shadow-[0_0_0_0_rgba(212,175,55,0)] hover:shadow-[0_0_15px_0_rgba(212,175,55,0.2)]"
              >
                <Mail className="h-4 w-4" />
              </Link>
              <button
                onClick={() => handleNavigation("/auth/register")}
                aria-label="Start your league"
                className="w-11 h-11 rounded-full bg-white/5 border border-gold/20 flex items-center justify-center text-gray-400 hover:text-gold hover:border-gold hover:bg-gold/10 transition-all duration-300 shadow-[0_0_0_0_rgba(212,175,55,0)] hover:shadow-[0_0_15px_0_rgba(212,175,55,0.2)]"
              >
                <Shield className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Spacer for Desktop */}
          <div className="hidden lg:block lg:col-span-1" />

          {/* Navigation — hidden below lg */}
          <div className="hidden lg:block lg:col-span-3">
            <div className="mb-6 flex flex-col gap-2">
              <h3 className="font-cinzel font-bold text-lg text-white tracking-wider">NAVIGATION</h3>
              <div className="h-[2px] w-8 bg-gold/50 rounded-full" />
            </div>
            
            <ul className="space-y-3">
              {[
                { id: "tournaments", label: "All Tournaments" },
                { id: "matches", label: "All Matches" },
                { id: "standings", label: "Standings" },
                { id: "stats", label: "Stats" },
              ].map((item) => (
                <li key={item.id}>
                  <div
                    onClick={() => scrollToSection(item.id)}
                    className="inline-flex items-center text-gray-400 hover:text-white transition-colors duration-300 cursor-pointer group py-1"
                  >
                    <ArrowRight className="h-4 w-4 mr-2 text-gold/50 transition-all duration-300 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-gold" />
                    <span className="transition-transform duration-300 group-hover:translate-x-1">
                      {item.label}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Social + Console — full version, hidden below lg */}
          <div className="hidden lg:block lg:col-span-3">
            <div className="mb-6 flex flex-col gap-2">
              <h3 className="font-cinzel font-bold text-lg text-white tracking-wider">CONNECT</h3>
              <div className="h-[2px] w-8 bg-gold/50 rounded-full" />
            </div>
            
            <ul className="space-y-3">
              <li>
                <Link
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-gray-400 hover:text-white transition-all duration-300 group py-1"
                >
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mr-3 group-hover:bg-gold/20 transition-colors border border-transparent group-hover:border-gold/30">
                    <Twitter className="h-3.5 w-3.5 text-gold" />
                  </div>
                  <span className="transition-transform duration-300 group-hover:translate-x-1">Twitter</span>
                </Link>
              </li>
              <li>
                <Link
                  href="mailto:hello@valiantleague.app"
                  className="inline-flex items-center text-gray-400 hover:text-white transition-all duration-300 group py-1"
                >
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mr-3 group-hover:bg-gold/20 transition-colors border border-transparent group-hover:border-gold/30">
                    <Mail className="h-3.5 w-3.5 text-gold" />
                  </div>
                  <span className="transition-transform duration-300 group-hover:translate-x-1">Email</span>
                </Link>
              </li>
              <li>
                <div
                  onClick={() => handleNavigation("/auth/register")}
                  className="inline-flex items-center text-gray-400 hover:text-white transition-all duration-300 cursor-pointer group py-1 mt-2"
                >
                  <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center mr-3 group-hover:bg-gold group-hover:shadow-[0_0_10px_rgba(212,175,55,0.4)] transition-all border border-gold/30 group-hover:border-gold">
                    <Shield className="h-3.5 w-3.5 text-gold group-hover:text-black transition-colors" />
                  </div>
                  <a href="/auth/register" className="text-gray-400 hover:text-white transition-colors duration-300">
                  <span className="font-semibold text-gold/90 group-hover:text-gold transition-colors">Start Your League</span>
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 lg:mt-16 pt-6 lg:pt-8 border-t border-white/10 flex flex-col lg:flex-row justify-between items-center gap-4 lg:gap-0">
          <p className="text-gray-500 text-xs lg:text-sm font-light tracking-wide">
            © {new Date().getFullYear()} Valiant League. All rights reserved.
          </p>
          <div className="flex space-x-8">
            <div
              onClick={() => handleNavigation("/privacy-policy")}
              className="text-gray-500 text-xs lg:text-sm hover:text-gold transition-colors duration-300 cursor-pointer"
            >
              Privacy Policy
            </div>
            <div
              onClick={() => handleNavigation("/terms-of-service")}
              className="text-gray-500 text-xs lg:text-sm hover:text-gold transition-colors duration-300 cursor-pointer"
            >
              Terms of Service
            </div>
          </div>
        </div>
        
      </div>
    </footer>
  )
}