"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Twitter, ArrowRight } from "lucide-react"

interface ValiantFooterProps {
  onNavigate: (id: string) => void
}

const ValiantFooter = ({ onNavigate }: ValiantFooterProps) => {
  const currentYear = new Date().getFullYear()
  const router = useRouter()

  const handleConsole = () => {
    router.push("/admin")
    window.scrollTo(0, 0)
  }

  return (
    <footer className="bg-black border-t border-gold/20">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="relative w-12 h-12">
                <Image src="/valiant-league-logo.png" alt="Valiant League Logo" fill className="object-contain" />
              </div>
              <span className="font-cinzel font-bold text-2xl text-white">
                VALIANT <span className="text-gold">LEAGUE</span>
              </span>
            </div>
            <p className="text-gray-400">
              Valiant League brings live auctions, automatic brackets, and
              broadcast-ready overlays together in one platform — so any
              league can run like a proper franchise.
            </p>
          </div>

          <div>
            <h3 className="font-cinzel font-bold text-xl text-white mb-6">NAVIGATION</h3>
            <ul className="space-y-4">
              {[
                { label: "Home", id: "home" },
                { label: "Modules", id: "modules" },
                { label: "Knights of Valiant", id: "creators" },
                { label: "How It Works", id: "flow" },
                { label: "Pricing", id: "tiers" },
                { label: "Contact", id: "contact" },
              ].map((link) => (
                <li key={link.id}>
                  <div
                    onClick={() => onNavigate(link.id)}
                    className="text-gray-400 hover:text-gold transition-colors flex items-center cursor-pointer"
                  >
                    <ArrowRight className="h-4 w-4 mr-2 text-gold" />
                    {link.label}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
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
                <div
                  onClick={handleConsole}
                  className="text-gray-400 hover:text-gold transition-colors flex items-center cursor-pointer"
                >
                  <ArrowRight className="h-4 w-4 mr-2 text-gold" />
                  Open the Console
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-gold/20">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">{currentYear} Valiant League. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <div className="text-gray-400 text-sm hover:text-gold transition-colors cursor-pointer">
                Privacy Policy
              </div>
              <div className="text-gray-400 text-sm hover:text-gold transition-colors cursor-pointer">
                Terms of Service
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default ValiantFooter