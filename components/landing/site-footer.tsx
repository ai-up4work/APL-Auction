"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Mail, Shield, Twitter } from "lucide-react"
import { navLinks } from "@/data/site-data"

interface SiteFooterProps {
  scrollToSection: (sectionId: string) => void
  handleNavigation: (path: string) => void
}

export function SiteFooter({ scrollToSection, handleNavigation }: SiteFooterProps) {
  return (
    <footer className="bg-black border-t border-gold/20">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="relative w-12 h-12">
                <Image src="/valiant-league-logo.png" alt="Valiant League Logo" fill className="object-contain" />
              </div>
              <span className="font-cinzel font-bold text-2xl text-white">
                VALIANT <span className="text-gold">LEAGUE</span>
              </span>
            </div>
            <p className="text-gray-300">
              Valiant League is the all-in-one platform for running a league — live auctions, automatic brackets,
              and broadcast-ready overlays, all reading from the same live data.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-cinzel font-bold text-xl text-white mb-6">NAVIGATION</h3>
            <ul className="space-y-4">
              {navLinks.map((link) => (
                <li key={link.id}>
                  <div
                    onClick={() => scrollToSection(link.id)}
                    className="text-gray-300 hover:text-gold transition-colors flex items-center cursor-pointer"
                  >
                    <ArrowRight className="h-4 w-4 mr-2 text-gold" />
                    {link.name.charAt(0) + link.name.slice(1).toLowerCase()}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Social + Console */}
          <div>
            <h3 className="font-cinzel font-bold text-xl text-white mb-6">SOCIAL LINKS</h3>
            <ul className="space-y-4">
              <li>
                <Link href="#" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-gold transition-colors flex items-center">
                  <Twitter className="h-4 w-4 mr-2 text-gold" />
                  Twitter
                </Link>
              </li>
              <li>
                <Link href="mailto:hello@valiantleague.app" className="text-gray-300 hover:text-gold transition-colors flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-gold" />
                  Email
                </Link>
              </li>
              <li>
                <div
                  onClick={() => handleNavigation("/auth/login")}
                  className="text-gray-300 hover:text-gold transition-colors flex items-center cursor-pointer"
                >
                  <Shield className="h-4 w-4 mr-2 text-gold" />
                  Open the Console
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-gold/20">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-300 text-sm">© {new Date().getFullYear()} Valiant League. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <div
                onClick={() => handleNavigation("/privacy-policy")}
                className="text-gray-300 text-sm hover:text-gold transition-colors cursor-pointer"
              >
                Privacy Policy
              </div>
              <div
                onClick={() => handleNavigation("/terms-of-service")}
                className="text-gray-300 text-sm hover:text-gold transition-colors cursor-pointer"
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